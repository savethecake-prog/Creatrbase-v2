import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicNav } from '../../components/PublicNav/PublicNav';
import { MarketingFooter } from '../../components/MarketingFooter/MarketingFooter';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import styles from './Pricing.module.css';

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    title: 'Score',
    monthly: 0,
    annual: 0,
    cta: { label: 'Score my channel →', href: '/#score' },
    features: [
      'Full Commercial Viability Score',
      'All six dimensions, with weightings',
      'Confidence levels on every result',
      'Share your score card publicly',
      'Weekly refresh, for as long as you want',
    ],
  },
  {
    id: 'core',
    name: 'Core',
    title: 'Gap tracker',
    monthly: 9.99,
    annual: 7.99,
    featured: true,
    cta: { label: 'Start 14-day trial →', to: '/signup' },
    features: [
      'Everything in Free',
      'Task engine — weekly gap-closing tasks',
      'Projection view — your score in 90 days',
      'Peer benchmarking against your tier',
      'Audience demographics deep-dive',
      'Milestone alerts on every dimension',
      'Historical tracking, all metrics',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    title: 'Full stack',
    monthly: 19.99,
    annual: 15.99,
    cta: { label: 'Start 14-day trial →', to: '/signup' },
    features: [
      'Everything in Core',
      'Brand outreach agent',
      'Drafted pitch emails in your voice',
      'Rate intelligence for your tier',
      'Follow-up sequences, auto-scheduled',
      'Media kit generator',
      'Contract review helper',
    ],
  },
];

const COMPARISON = [
  { feature: 'Commercial Viability Score', free: true, core: true, pro: true },
  { feature: 'Six-dimension breakdown', free: true, core: true, pro: true },
  { feature: 'Confidence levels', free: true, core: true, pro: true },
  { feature: 'Shareable score card', free: true, core: true, pro: true },
  { feature: 'Weekly refresh', free: true, core: true, pro: true },
  { feature: 'Task engine', free: false, core: true, pro: true },
  { feature: 'Score projection (90-day)', free: false, core: true, pro: true },
  { feature: 'Peer benchmarking', free: false, core: true, pro: true },
  { feature: 'Audience demographics', free: false, core: true, pro: true },
  { feature: 'Milestone alerts', free: false, core: true, pro: true },
  { feature: 'Historical tracking', free: false, core: true, pro: true },
  { feature: 'Brand outreach agent', free: false, core: false, pro: true },
  { feature: 'Pitch email drafts', free: false, core: false, pro: true },
  { feature: 'Rate intelligence', free: false, core: false, pro: true },
  { feature: 'Follow-up sequences', free: false, core: false, pro: true },
  { feature: 'Media kit generator', free: false, core: false, pro: true },
  { feature: 'Contract review helper', free: false, core: false, pro: true },
];

const FAQS = [
  { q: 'Can I cancel anytime?', a: 'Yes. One click in your settings. No calls, no retention flows. Your score data stays in read-only mode for 30 days.' },
  { q: 'Is there a free trial?', a: 'Core and Pro both include a 14-day free trial. No card required to start.' },
  { q: 'What happens if I downgrade?', a: 'You keep access to your historical data. Features above your tier become read-only. Nothing is deleted.' },
  { q: 'Do you offer team or agency plans?', a: 'Not yet. Creatrbase is built for individual creators. If you manage multiple channels, each needs its own account.' },
  { q: 'What currency are prices in?', a: 'All prices are in GBP (£). We accept all major cards. VAT is included where applicable.' },
  { q: 'Can I get an invoice?', a: 'Yes. Invoices are generated automatically after each payment and available in your settings.' },
];

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className={styles.page}>
      <PageMeta
        title="Pricing — Creatrbase"
        description="Free forever for one channel. Pro tiers for serious creators. No hidden fees, no demo calls, no contracts. Cancel anytime."
        canonical="https://creatrbase.com/pricing"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'WebPage',
        name: 'Pricing', url: 'https://creatrbase.com/pricing',
        description: 'Creatrbase pricing plans.',
        breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://creatrbase.com' },
          { '@type': 'ListItem', position: 2, name: 'Pricing', item: 'https://creatrbase.com/pricing' },
        ] },
      }) }} />

      <PublicNav variant="v2" />

      <main className={styles.main}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}><span className={styles.eyebrowDot} /> Pricing</span>
          <h1 className={styles.heroTitle}>Honest prices. No&nbsp;surprises.</h1>
          <p className={styles.heroDesc}>Score your channel free. Upgrade if you want the tools that close the gap. No &ldquo;contact us,&rdquo; no enterprise tier, no upsell funnels.</p>
        </header>

        {/* Billing toggle */}
        <div className={styles.toggle}>
          <button className={`${styles.toggleBtn} ${!annual ? styles.toggleActive : ''}`} onClick={() => setAnnual(false)}>Monthly</button>
          <button className={`${styles.toggleBtn} ${annual ? styles.toggleActive : ''}`} onClick={() => setAnnual(true)}>
            Annual
            <span className={styles.toggleBadge}>Save 20%</span>
          </button>
        </div>

        {/* Tier cards */}
        <div className={styles.tiersGrid}>
          {TIERS.map(t => (
            <div key={t.id} className={`${styles.tierCard} ${t.featured ? styles.tierFeatured : ''}`}>
              {t.featured && <div className={styles.tierBadge}>Most chosen</div>}
              <div className={styles.tierName}>{t.name}</div>
              <h3 className={styles.tierTitle}>{t.title}</h3>
              <div className={styles.tierPrice}>
                <span className={styles.priceNum}>&pound;{annual ? t.annual : t.monthly}</span>
                <span className={styles.pricePeriod}>{t.monthly === 0 ? 'forever · no card' : '/ month'}</span>
              </div>
              <ul className={styles.tierFeatures}>
                {t.features.map(f => <li key={f}>{f}</li>)}
              </ul>
              {t.cta.to ? (
                <Link to={t.cta.to} className={`${styles.tierBtn} ${t.featured ? styles.tierBtnFeatured : ''}`}>{t.cta.label}</Link>
              ) : (
                <a href={t.cta.href} className={styles.tierBtn}>{t.cta.label}</a>
              )}
            </div>
          ))}
        </div>

        <p className={styles.freeNote}>The free score is free forever. No card, no timer.</p>

        {/* Feature comparison */}
        <section className={styles.comparison}>
          <h2 className={styles.sectionTitle}>Feature comparison</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Free</th>
                  <th>Core</th>
                  <th>Pro</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(row => (
                  <tr key={row.feature}>
                    <td>{row.feature}</td>
                    <td className={styles.check}>{row.free ? '✓' : '—'}</td>
                    <td className={styles.check}>{row.core ? '✓' : '—'}</td>
                    <td className={styles.check}>{row.pro ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className={styles.faqSection}>
          <h2 className={styles.sectionTitle}>Questions about pricing</h2>
          <div className={styles.faqGrid}>
            {FAQS.map(f => (
              <div key={f.q} className={styles.faqItem}>
                <h4 className={styles.faqQ}>{f.q}</h4>
                <p className={styles.faqA}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className={styles.cta}>
          <h2 className={styles.ctaTitle}>Score your channel for free.</h2>
          <a href="/#score" className={styles.ctaBtn}>Get my score &rarr;</a>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
