'use strict';

// ─── Email confidence calculator ──────────────────────────────────────────────
// Pure function — no DB calls, no I/O. Same algebraic pattern as signalQuality.js.
// ─────────────────────────────────────────────────────────────────────────────

// Generic role prefixes that commonly redirect to affiliate platforms,
// ticket systems, or shared inboxes rather than a monitored human inbox.
const HIGH_RISK_ROLES = new Set([
  'affiliates', 'affiliate', 'info', 'hello', 'contact', 'noreply', 'no-reply',
  'support', 'admin', 'sales', 'marketing', 'enquiries', 'enquiry', 'help',
  'webmaster', 'postmaster', 'abuse',
]);

// firstname.lastname pattern → named individual → higher delivery confidence
const NAMED_INDIVIDUAL_RE = /^[a-z][-a-z]*\.[a-z][-a-z]*$/i;

function getRoleRisk(localPart) {
  if (HIGH_RISK_ROLES.has(localPart.toLowerCase())) return 'high';
  if (NAMED_INDIVIDUAL_RE.test(localPart))           return 'low';
  return 'medium';
}

// ─── calculateEmailConfidence ─────────────────────────────────────────────────
// Inputs:
//   email               – full email address string
//   smtpResult          – { status: 'verified'|'catch_all'|'invalid'|'bounced'|'unknown'|'no_mx' }
//   options:
//     brandWebsite          – brand's website URL or domain (enables domain-match modifier)
//     sourceIsUserReported  – true if address came from a user (vs. seed data)
//
// Returns: { score: 0.00–1.00, factors: { base, roleRisk, roleMod, domainMod, sourceMod, status } }

function calculateEmailConfidence(email, smtpResult, { brandWebsite, sourceIsUserReported = false } = {}) {
  const atIdx      = email.indexOf('@');
  const localPart  = atIdx > 0 ? email.slice(0, atIdx) : email;
  const emailDomain = atIdx > 0 ? email.slice(atIdx + 1).toLowerCase() : '';

  // Bounce override — hard floor; no modifiers can raise this
  if (smtpResult.status === 'bounced') {
    return { score: 0.02, factors: { override: 'bounce_confirmed', status: 'bounced' } };
  }

  // Base score from SMTP result
  const BASE = {
    verified:  0.90,
    catch_all: 0.50,
    unknown:   0.35,
    invalid:   0.05,
    no_mx:     0.05,
  };
  const base = BASE[smtpResult.status] ?? 0.35;

  // Role address modifier
  const roleRisk = getRoleRisk(localPart);
  const roleMod  = roleRisk === 'high' ? 0.70 : roleRisk === 'low' ? 1.10 : 1.0;

  // Domain match modifier — email's domain matches the brand's website domain
  let domainMod = 1.0;
  if (brandWebsite && emailDomain) {
    try {
      const url      = brandWebsite.startsWith('http') ? brandWebsite : `https://${brandWebsite}`;
      const siteHost = new URL(url).hostname.replace(/^www\./, '');
      if (siteHost === emailDomain) domainMod = 1.10;
    } catch (_) { /* invalid URL — no modifier */ }
  }

  // Source modifier
  const sourceMod = sourceIsUserReported ? 1.10 : 1.0;

  // Compose, cap at 1.0, round to 2dp
  const score = Math.min(1.0, Math.round(base * roleMod * domainMod * sourceMod * 100) / 100);

  return {
    score,
    factors: { base, roleRisk, roleMod, domainMod, sourceMod, status: smtpResult.status },
  };
}

module.exports = { calculateEmailConfidence };
