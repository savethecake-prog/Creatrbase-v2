import { PublicNav } from '../../components/PublicNav/PublicNav';
import { MarketingFooter } from '../../components/MarketingFooter/MarketingFooter';

/**
 * Agencies-route chrome = the site's OWN header and footer, composed (never rebuilt).
 *
 * The header is the live homepage's PublicNav (variant v2, the current trajectory-mark
 * "creatrbase" logo — LogoWordmark variant="v2"), with the agencies nav entries passed via
 * the component's own props (a minimal, backward-compatible extension — not a fork). The
 * footer is the site's MarketingFooter verbatim (same v2 logo, same registration furniture).
 * This makes the agencies pages render identical chrome to https://creatrbase.com/.
 */

const AGENCIES_LINKS = [
  { to: '/agencies/methodology', label: 'Methodology' },
  { to: '/agencies/sample', label: 'Sample dossier' },
  { to: '/pricing', label: 'Pricing' },
];
const AGENCIES_CTA = { to: '/agencies/brief', label: 'Start a brief' };

export function AgenciesNav() {
  return (
    <PublicNav
      variant="v2"
      scrollEffect
      links={AGENCIES_LINKS}
      cta={AGENCIES_CTA}
      login={null}
    />
  );
}

export function AgenciesFooter() {
  return <MarketingFooter />;
}
