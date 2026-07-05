/**
 * Agencies-route configuration (CB-KD-05 s.2, CB-KD-01 v1.1.1 s.3).
 *
 * The single edit point for the owner arm-steps at milestone five:
 *   - Stripe payment links: a buy button renders ONLY where a URL is set here;
 *     an empty string means the price shows with no button (CB-KD-06 s.6). Creating
 *     the ~8 Stripe price objects is the owner's task; paste each link here when made.
 *   - Sample dossier slug URL: the hosted fictional dossier (/agencies/sample links it).
 *   - Legal entity + contact: when unset, the legal pages serve a quiet
 *     "final details being completed" line in place of the placeholder — never a
 *     bracket or lorem (CB-KD-05 s.5 trust furniture).
 *   - Turnstile site key: the form renders the widget slot ONLY when set.
 *
 * The service backend lives behind /agencies-svc (nginx). Same-origin, so no host
 * needed — the form calls /agencies-svc/form/*.
 */

export const SERVICE_BASE = '/agencies-svc';

// The bridge + independence statements (CB-KD-05 s.2). The bridge is used on /agencies
// and anywhere the two sides meet; it is followed by the independence statement from
// CB-KD-01 s.10, VERBATIM. Kept as constants so the /agencies body and the footer
// disclosure draw from one canonical source and cannot drift.
export const BRIDGE_STATEMENT =
  'One engine, two sides of the table. Creators see how they score; agencies get the same rigour pointed at a brief.';
export const INDEPENDENCE_STATEMENT =
  'A creator’s purchase of any Creatrbase product never influences an agency-side vetting outcome. One engine, two sides of the table, no pay-to-play.';

// "WHY THIS EXISTS" — owner-supplied, register-checked, installed VERBATIM (2026-07-05
// design/copy cycle). Three paragraphs on /agencies (after proof); the first two are
// excerpted on /agencies/methodology. Kept here so both surfaces draw one canonical
// text and the banned-language check (which scans src/pages/Agencies/**) covers it.
export const WHY_THIS_EXISTS = [
  'Creator discovery is still, at most agencies, a manual job. Hours of scrolling, spreadsheets, screenshots, gut feel — repeated for every brief, under deadline. Doing it properly needs data access that platforms meter and price for software companies, not for a shortlist of fifty. So agencies pay twice: once in hours, once in subscriptions to creator databases that return profiles, not decisions.',
  'We built the pipeline once so you don’t have to. Creatrbase points it at what brands actually evaluate — modelled delivery against your targets, brand safety on the record, audience fit with the working shown — and delivers the finished judgement, checked the same way for every creator, every time.',
  'Databases like Modash and Kolsquare sell search over creator profiles: the haystack, sorted. Creatrbase delivers the decision layer an analyst would build from them — a dossier per creator with a verdict, evidence, and the maths shown, within 48 hours of an accepted brief.',
];

// The two real numbers the agencies side owns, rendered as stat-callout cards. Source
// lines are internal, stated — never an invented external citation (observed-never-
// invented). The labour-equivalence figure is the CB-KD-01 pricing basis.
export const STAT_CALLOUTS = [
  {
    num: '£1,000',
    unit: '–1,250',
    desc: 'A fifty-creator brief is roughly a week and £1,000–£1,250 of salary cost, done manually — the research alone, before any judgement is applied.',
    source: 'Basis · Creatrbase internal pricing model',
  },
  {
    num: '48',
    unit: 'hrs',
    desc: 'The finished shortlist — a full dossier per creator, ranked, human-reviewed — inside 48 hours of an accepted brief. The clock pauses only while a query is with you.',
    source: 'Basis · Creatrbase delivery SLA',
  },
];

// FAQ block for /agencies/methodology, marked up as JSON-LD FAQPage (CB-KD-05 s.6,
// AI-discovery). Answers are plain entity statements, register-checked. Q3/Q4/Q5 draw
// the eight dossier sections, the SLA, and the catalogue from the ratified copy.
export const METHODOLOGY_FAQ = [
  {
    q: 'What is Creatrbase for agencies?',
    a: 'Creatrbase is a creator-vetting service for agencies. You submit a campaign brief; we deliver a dossier per creator — modelled delivery against your targets, a brand-safety record, audience fit, and a verdict — with the working shown, within 48 hours. Every dossier is reviewed by a person before release.',
  },
  {
    q: 'How is Creatrbase different from creator databases like Modash or Kolsquare?',
    a: 'Databases sell you search over creator profiles — you still do the judgement. Creatrbase delivers the judgement itself: a uniform, documented vetting method applied to every creator on your shortlist, ending in a verdict you can forward to your client.',
  },
  {
    q: 'What does a dossier contain?',
    a: 'Eight sections, in order: the methodology it was built by; the attested metrics with sources and dates; modelled delivery against your targets; the hit probability with its error band; audience composition and overlap; the risk register with evidence; the working shown beneath every figure; and the verdict, last.',
  },
  {
    q: 'How fast is delivery?',
    a: 'Five full dossiers, or the shortlist for a paid brief, inside 48 hours of an accepted brief. A person reviews every dossier before release, and the clock pauses whenever a clarifying query is with you — it restarts when you answer.',
  },
  {
    q: 'What does it cost?',
    a: 'Brand Safety Scan is £39 per creator; Score is £7 per creator (minimum 10); Vetting Batch is £15 per creator (minimum 10); the Full Brief is £695 for up to 50 creators (£895 across three or more platforms); retainers run from £750 to £2,850 a month. Every organisation gets one free run: your real brief, five full dossiers, no charge. Prices exclude VAT.',
  },
];

// The hosted fictional sample dossier (rendered by the vetting repo's render_sample.py,
// uploaded via upload_bundles conventions). Slug URL serves at /agencies-svc/d/<slug>/.
export const SAMPLE_DOSSIER_URL =
  'https://creatrbase.com/agencies-svc/d/8a713c212fe0bb1365a6582f5a4cc321/';

// Cloudflare Turnstile site key. Empty => the form omits the widget slot entirely.
export const TURNSTILE_SITE_KEY = '';

// Legal placeholders (CB-KD-04 s.5 / CB-KD-05 s.5). Empty => quiet completion line.
export const LEGAL_ENTITY_LINE = '';
export const LEGAL_CONTACT_EMAIL = '';
export const LEGAL_PENDING_LINE = 'Final details are being completed.';

// The CB-KD-01 v1.1.1 s.3 catalogue. Prices exclude VAT. `stripeLink` empty until the
// owner creates the Stripe object — the button is suppressed while empty.
export const CATALOGUE = [
  {
    id: 'brand_safety_scan',
    name: 'Brand Safety Scan',
    price: '£39',
    unit: 'per creator',
    blurb: 'A single creator, checked. Content-history scan against your stated sensitivities, a platform-standing check, a risk register and a verdict — the full dossier’s risk sections at unit size. Purchasable without a conversation.',
    stripeLink: '',
  },
  {
    id: 'score',
    name: 'Score',
    price: '£7',
    unit: 'per creator, minimum 10',
    blurb: 'You supply the list; we return a ranked scoresheet: hit probability against your stated metrics with surfaced math, delivery bands, the deterministic flags, and the acceptance line drawn across the set. Scored, not vetted — no content-history safety screen is run, and the cover says so. Any scored creator upgrades to a full dossier for the difference.',
    stripeLink: '',
  },
  {
    id: 'vetting_batch',
    name: 'Vetting Batch',
    price: '£15',
    unit: 'per creator, minimum 10',
    blurb: 'You supply the list; we supply the judgement layer. A full dossier per creator, discovery excluded — for agencies that run their own discovery tooling.',
    stripeLink: '',
  },
  {
    id: 'full_brief',
    name: 'Full Brief',
    price: '£695',
    priceAlt: '£895',
    unit: 'up to 50 creators · £895 across three or more platforms',
    blurb: 'Discovery plus vetting against a structured brief: candidate sourcing, filtering to your constraints, a full dossier per shortlisted creator, ranked by hit probability. The hero product.',
    stripeLink: '',
  },
  {
    id: 'retainer_foundation',
    name: 'Retainer — Foundation',
    price: '£750',
    unit: 'per month',
    blurb: 'Two Full Briefs a month plus roster monitoring: a monthly re-scan of your booked creators, immediate alerts on any new Critical flag, and a monthly digest for everything else.',
    stripeLink: '',
  },
  {
    id: 'retainer_desk',
    name: 'Retainer — Desk',
    price: '£1,500',
    unit: 'per month',
    blurb: 'Four Full Briefs a month, unlimited Score jobs on your lists, roster monitoring as above, and a 24-hour priority SLA.',
    stripeLink: '',
  },
  {
    id: 'retainer_research_desk',
    name: 'Retainer — Research Desk',
    price: '£2,850',
    unit: 'per month',
    blurb: 'The research desk of the agency, priced at the loaded cost of one junior executive. Up to ten Full Briefs a month under fair use, unlimited Score jobs, whole-roster monitoring, same-day scoring, white-label dossiers as standard, and a quarterly calibration report of predicted against achieved delivery.',
    stripeLink: '',
  },
];

// The free run — presented as the honest sample it is, not a paid row.
export const FREE_RUN = {
  name: 'Free Run',
  price: '£0',
  unit: 'one per organisation',
  blurb: 'Your real brief, run through the full pipeline, returning five creators at complete dossier quality — the same object as the paid product, deliberately smaller. A business email domain is required. The delivery email quotes the Full Brief price with a 48-hour completion promise, because discovery for the full shortlist is already done.',
};
