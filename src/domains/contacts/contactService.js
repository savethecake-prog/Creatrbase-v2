'use strict';

// ─── Contact Discovery Service ────────────────────────────────────────────────
//
// Pipeline:
//   1. Fetch brand website root page
//   2. Find team/about/contact page links (same-origin only)
//   3. For each page: extract (name, title) via JSON-LD schema first,
//      then Haiku LLM fallback only if JSON-LD yields < 2 results
//      AND the page appears to contain team content
//   4. Filter to influencer-adjacent job titles only
//   5. Generate email candidates per pattern (firstname.lastname, etc.)
//   6. SMTP verify each candidate; keep verified first, unknown as fallback
//   7. Return contact array — caller writes to brand_contacts
//
// No HTML parser library required — uses Node built-in fetch + regex.
// LLM calls (Haiku): ~$0.001 per brand, only on parse failures.
// ─────────────────────────────────────────────────────────────────────────────

const net         = require('net');
const dns         = require('dns').promises;
const Anthropic   = require('@anthropic-ai/sdk');
const { getPool } = require('../../db/pool');

// Job title keywords that indicate an influencer-facing role
const RELEVANT_ROLE_KEYWORDS = [
  'partnership', 'influencer', 'creator', 'marketing', 'brand',
  'social', 'talent', 'content', 'campaign', 'digital',
  'collaboration', 'affiliate', 'community', 'media', 'comms',
  'communications', 'sponsorship', 'acquisition', 'growth',
  'pr ', ' pr', 'public relation',
];

// Page path fragments that suggest a team/contact page
const TEAM_PATH_KEYWORDS = [
  'team', 'about', 'contact', 'people', 'meet', 'press',
  'company', 'about-us', 'our-team', 'leadership', 'staff',
  'who-we-are', 'the-team',
];

// ── HTTP fetch ────────────────────────────────────────────────────────────────

async function fetchPage(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Creatrbase/1.0; contact-discovery; +https://creatrbase.com)',
        'Accept':     'text/html,application/xhtml+xml,*/*',
      },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return text.slice(0, 400_000); // 400KB cap
  } finally {
    clearTimeout(timer);
  }
}

// ── Link extraction ───────────────────────────────────────────────────────────

function extractTeamLinks(html, baseUrl) {
  let base;
  try { base = new URL(baseUrl); } catch { return []; }

  const rx = /href=["']([^"'#\s]{1,300})["']/gi;
  const found = new Set();
  let m;

  while ((m = rx.exec(html)) !== null) {
    const href = m[1].trim();
    if (!href || href.startsWith('mailto:') || href.startsWith('javascript:')) continue;
    try {
      const url = new URL(href, base.origin);
      if (url.hostname !== base.hostname) continue;
      const path = url.pathname.toLowerCase();
      if (TEAM_PATH_KEYWORDS.some(k => path.includes(k))) {
        found.add(url.origin + url.pathname); // strip query/hash
      }
    } catch {}
  }

  return [...found].slice(0, 5); // max 5 sub-pages
}

// ── JSON-LD Person extraction ─────────────────────────────────────────────────

function extractJsonLdPeople(html) {
  const rx = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const people = [];
  let m;

  while ((m = rx.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (item['@type'] === 'Person')    people.push(item);
        if (item['@graph'])                people.push(...item['@graph'].filter(x => x['@type'] === 'Person'));
        if (item.itemListElement)          item.itemListElement.forEach(el => {
          if (el['@type'] === 'Person')    people.push(el);
          if (el.item?.['@type'] === 'Person') people.push(el.item);
        });
      }
    } catch {}
  }

  return people
    .map(p => ({ name: p.name?.trim() || null, title: (p.jobTitle || p.description || '').trim() || null }))
    .filter(p => p.name && p.name.length > 1);
}

// ── Haiku fallback extraction ─────────────────────────────────────────────────

function hasTeamContent(html) {
  const teamSignals = /\b(team|staff|people|leadership|meet us|our team|who we are)\b/i;
  const textLen = html.replace(/<[^>]+>/g, '').length;
  return textLen > 800 && teamSignals.test(html);
}

function htmlToText(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000); // keep input tokens minimal
}

async function extractPeopleWithAI(html) {
  const text = htmlToText(html);
  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 512,
      messages:   [{
        role:    'user',
        content: `Extract every person from this company team page. Return ONLY a JSON array like [{"name":"Full Name","title":"Job Title"}]. If no people found, return []. No explanation, no markdown.\n\n${text}`,
      }],
    });

    const raw = (msg.content[0]?.text || '').trim();
    const start = raw.indexOf('[');
    const end   = raw.lastIndexOf(']');
    if (start === -1 || end === -1) return [];

    const parsed = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Role filtering ────────────────────────────────────────────────────────────

function isRelevantRole(title) {
  if (!title) return false;
  const t = title.toLowerCase();
  return RELEVANT_ROLE_KEYWORDS.some(k => t.includes(k));
}

// ── Email candidate generation ────────────────────────────────────────────────

function generateCandidates(fullName, domain) {
  const parts = fullName.trim().toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  if (parts.length < 2) return [];

  const first = parts[0];
  const last  = parts[parts.length - 1];
  const fi    = first[0] || '';

  if (!first || !last || !fi) return [];

  // Ordered by real-world frequency of corporate email patterns
  return [
    `${first}.${last}@${domain}`,
    `${fi}.${last}@${domain}`,
    `${first}@${domain}`,
    `${fi}${last}@${domain}`,
    `${first}_${last}@${domain}`,
    `${first}${last}@${domain}`,
  ];
}

// ── SMTP verification ─────────────────────────────────────────────────────────

async function getMxHost(domain) {
  try {
    const records = await dns.resolveMx(domain);
    if (!records?.length) return null;
    return records.sort((a, b) => a.priority - b.priority)[0].exchange;
  } catch {
    return null;
  }
}

function smtpProbe(email, mxHost) {
  return new Promise(resolve => {
    const timer = setTimeout(() => { socket.destroy(); resolve('unknown'); }, 8000);

    const socket = net.createConnection({ host: mxHost, port: 25 });
    let stage = 0;
    let buf   = '';

    socket.on('data', chunk => {
      buf += chunk.toString();
      const lines = buf.split('\r\n');
      buf = lines.pop(); // keep partial line

      for (const line of lines) {
        if (line.length < 3) continue;
        const code = parseInt(line.slice(0, 3), 10);
        if (isNaN(code)) continue;

        if (stage === 0 && code === 220) {
          stage = 1;
          socket.write('EHLO discover.creatrbase.com\r\n');

        } else if (stage === 1 && code === 250 && line.charAt(3) !== '-') {
          // Final line of multi-line 250 EHLO response
          stage = 2;
          socket.write('MAIL FROM:<noreply@creatrbase.com>\r\n');

        } else if (stage === 2 && code === 250) {
          stage = 3;
          socket.write(`RCPT TO:<${email}>\r\n`);

        } else if (stage === 3) {
          clearTimeout(timer);
          socket.write('QUIT\r\n');
          socket.destroy();
          if (code >= 200 && code < 300)      resolve('verified');
          else if (code >= 500 && code < 600) resolve('unverified');
          else                                resolve('unknown');
          return;

        } else if (code >= 400 && stage > 0) {
          // Temporary error or banner rejection
          clearTimeout(timer);
          socket.destroy();
          resolve('unknown');
          return;
        }
      }
    });

    socket.on('error', () => { clearTimeout(timer); resolve('unknown'); });
    socket.on('close', () => { clearTimeout(timer); resolve('unknown'); });
  });
}

async function smtpVerify(email, domain, mxHost) {
  try {
    return await smtpProbe(email, mxHost);
  } catch {
    return 'unknown';
  }
}

// ── Main discovery function ───────────────────────────────────────────────────

/**
 * Crawls a brand's website and returns an array of contacts.
 *
 * @param {string} tenantId
 * @param {string} brandId
 * @returns {Promise<Array<{full_name, job_title, email, email_verified, source, source_url, confidence}>>}
 */
async function discoverContacts(tenantId, brandId) {
  const pool = getPool();

  // Load brand
  const { rows: [brand] } = await pool.query(
    'SELECT id, website, brand_name FROM brands WHERE id = $1',
    [brandId],
  );
  if (!brand?.website) throw new Error('Brand has no website');

  // Normalise domain
  const rawSite = brand.website.startsWith('http') ? brand.website : `https://${brand.website}`;
  let domain;
  try {
    domain = new URL(rawSite).hostname;
  } catch {
    throw new Error(`Invalid website URL: ${brand.website}`);
  }

  // Pre-flight: check MX record exists (avoids wasted crawl for domains with no mail)
  const mxHost = await getMxHost(domain);
  // mxHost may be null — we still crawl, just skip SMTP step if so

  // ── Crawl ────────────────────────────────────────────────────────────────────

  let rootHtml;
  try {
    rootHtml = await fetchPage(`https://${domain}`);
  } catch {
    try {
      rootHtml = await fetchPage(`http://${domain}`);
    } catch (err) {
      throw new Error(`Could not reach ${domain}: ${err.message}`);
    }
  }

  const teamLinks = extractTeamLinks(rootHtml, `https://${domain}`);

  // Fetch sub-pages in parallel (with individual error handling)
  const subPages = await Promise.all(
    teamLinks.map(async url => {
      try   { return { url, html: await fetchPage(url) }; }
      catch { return null; }
    }),
  );

  const pages = [
    { url: `https://${domain}`, html: rootHtml },
    ...subPages.filter(Boolean),
  ];

  // ── Extract people ────────────────────────────────────────────────────────────

  const allPeople = [];

  for (const { url, html } of pages) {
    let people = extractJsonLdPeople(html);

    // Fallback to AI extraction only when JSON-LD is sparse and page looks relevant
    if (people.length < 2 && hasTeamContent(html)) {
      people = await extractPeopleWithAI(html);
    }

    // Attach source URL and filter to relevant roles
    const relevant = people
      .filter(p => isRelevantRole(p.title))
      .map(p => ({ ...p, source_url: url }));

    allPeople.push(...relevant);
  }

  // Deduplicate by normalised name
  const seenNames = new Set();
  const uniquePeople = allPeople.filter(p => {
    if (!p.name) return false;
    const key = p.name.toLowerCase().trim();
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });

  // ── Build and verify email candidates ────────────────────────────────────────

  const results = [];

  for (const person of uniquePeople.slice(0, 12)) {
    const candidates = generateCandidates(person.name, domain);
    if (!candidates.length) continue;

    let stored = false;
    const unknownCandidates = [];

    for (const email of candidates) {
      // Small delay to avoid triggering rate limits on the target mail server
      await new Promise(r => setTimeout(r, 400));

      let verified = 'unknown';
      if (mxHost) {
        verified = await smtpVerify(email, domain, mxHost);
      }

      if (verified === 'verified') {
        results.push({
          full_name:      person.name,
          job_title:      person.title,
          email,
          email_verified: 'verified',
          source:         'website_crawl',
          source_url:     person.source_url,
          confidence:     'high',
        });
        stored = true;
        break; // First verified address is the one we want
      } else if (verified === 'unknown') {
        unknownCandidates.push(email);
      }
      // 'unverified' = skip entirely
    }

    // If no verified hit, store the top-ranked unknown candidate
    if (!stored && unknownCandidates.length > 0) {
      results.push({
        full_name:      person.name,
        job_title:      person.title,
        email:          unknownCandidates[0],
        email_verified: 'unknown',
        source:         'website_crawl',
        source_url:     person.source_url,
        confidence:     'medium',
      });
    }
  }

  return results;
}

module.exports = { discoverContacts };
