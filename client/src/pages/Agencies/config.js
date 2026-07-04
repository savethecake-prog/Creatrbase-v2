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
