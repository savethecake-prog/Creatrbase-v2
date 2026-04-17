import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button/Button';
import { BrandCheck } from '../../components/landing/BrandCheck/BrandCheck';
import { useIntersection } from '../../hooks/useIntersection';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import { PublicNav } from '../../components/PublicNav/PublicNav';
import { LogoWordmark } from '../../components/ui/LogoWordmark';
import styles from './Landing.module.css';

function logSignal(signalType, payload) {
  fetch('/api/public/signal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signal_type: signalType,
      vector: 'organic',
      source_surface: 'web:landing',
      signal_payload: payload || {},
    }),
  }).catch(function() {});
}

function FaqItem({ question, answer, id }) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    if (!open) logSignal('faq_open', { question: id });
    setOpen(!open);
  };

  return (
    <div className={styles.faqItem} onClick={toggle} role="button" tabIndex={0}>
      <h4 className={styles.faqQuestion}>
        {question}
        <span className={styles.faqToggle}>{open ? '\u2212' : '+'}</span>
      </h4>
      {open && <p className={styles.faqAnswer}>{answer}</p>}
    </div>
  );
}

export function Landing() {
  const navigate = useNavigate();
  const [heroRef, heroVisible] = useIntersection({ once: true, threshold: 0.1 });
  const [problemRef, problemVisible] = useIntersection({ once: true, threshold: 0.1 });
  const [aiRef, aiVisible] = useIntersection({ once: true, threshold: 0.1 });
  const [pillarsRef, pillarsVisible] = useIntersection({ once: true, threshold: 0.1 });
  const [faqRef, faqVisible] = useIntersection({ once: true, threshold: 0.1 });
  const [pricingRef, pricingVisible] = useIntersection({ once: true, threshold: 0.1 });
  const [ctaRef, ctaVisible] = useIntersection({ once: true, threshold: 0.1 });

  const [scrollPercent, setScrollPercent] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollY = window.scrollY;
      setScrollPercent((scrollY / (documentHeight - windowHeight)) * 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // UTM persistence
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function(k) {
      if (params.get(k)) utm[k] = params.get(k);
    });
    if (Object.keys(utm).length > 0) {
      document.cookie = 'cb_utm=' + encodeURIComponent(JSON.stringify(utm)) + ';max-age=2592000;path=/;SameSite=Lax';
      logSignal('utm_landing', utm);
    }
  }, []);

  const scrollToScore = () => {
    const el = document.getElementById('score');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={styles.container}>
      <PageMeta
        title="Commercial Intelligence for Independent Creators"
        description="Know your Commercial Viability Score. Track your gap to brand deals. Represent yourself directly — without an agency."
        canonical="https://creatrbase.com/"
      />
      {/* Organization JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Creatrbase',
        url: 'https://creatrbase.com',
        description: 'The commercial intelligence platform for independent YouTube and Twitch creators.',
      }) }} />

      <div className={styles.scrollProgress} style={{ width: `${scrollPercent}%` }} />
      <PublicNav scrollEffect />

      {/* Hero */}
      <header ref={heroRef} className={`${styles.hero} ${heroVisible ? styles.visible : ''}`}>
        <div className={styles.heroContent}>
          <h1 className={`${styles.heroTitle} ${styles.reveal}`}>
            Know your Commercial Viability Score<br />
            <span className={styles.gradientText}>in 60 seconds. Free.</span>
          </h1>
          <p className={`${styles.heroSub} ${styles.reveal} ${styles.stagger1}`}>
            The commercial intelligence platform for independent YouTube and Twitch creators. No agency, no commission, no signup required to see your score.
          </p>

          <div className={`${styles.heroMain} ${styles.reveal} ${styles.stagger2}`}>
            <div className={styles.heroLeft}>
              <BrandCheck />
            </div>
            <div className={styles.heroRight}>
              {/* Static sample score card */}
              <div className={styles.sampleCard}>
                <div className={styles.sampleHeader}>
                  <span className={styles.sampleLabel}>COMMERCIAL VIABILITY SCORE</span>
                </div>
                <div className={styles.sampleScore}>67</div>
                <div className={styles.sampleOf}>/100</div>
                <div className={styles.sampleTier}>Emerging</div>
                <div className={styles.sampleConf}>Medium confidence — 47 comparable creators</div>
                <div className={styles.sampleRange}>Sponsored integration tier: £800–£1,400/mo</div>
                <div className={styles.sampleConstraint}>Top constraint: Engagement quality below your tier benchmark</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.sectionDivider} />

      {/* Market Reality */}
      <section ref={problemRef} className={`${styles.problemSection} ${problemVisible ? styles.visible : ''}`}>
        <div className={styles.contentWrap}>
          <div className={`${styles.label} ${styles.reveal}`}>THE MARKET</div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal} ${styles.stagger1}`}>Not every creator needs an agency.</h2>
          <div className={styles.problemGrid}>
            <div className={`${styles.problemText} ${styles.reveal} ${styles.stagger2}`}>
              <p>Agency representation makes sense for some creators — typically those above 250k subscribers with the deal volume to justify the commission. For independent creators in the 1k–100k range, the maths often does not work.</p>
              <p><strong>Creatrbase exists for the second group.</strong> We give you the commercial intelligence and self-representation tools to close deals directly — so 100% of what you earn is yours.</p>
            </div>
            <div className={`${styles.statCallout} ${styles.reveal} ${styles.stagger3}`}>
              <div className={styles.calloutItem}>
                <span className={styles.calloutNum}>0%</span>
                <span className={styles.calloutLabel}>Commission on deals you close</span>
              </div>
              <div className={styles.calloutItem}>
                <span className={styles.calloutNum}>£10</span>
                <span className={styles.calloutLabel}>Flat subscription per month</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.sectionDivider} />

      {/* Technology */}
      <section ref={aiRef} className={`${styles.aiSection} ${aiVisible ? styles.visible : ''}`}>
        <div className={styles.aiHeader}>
          <div className={`${styles.label} ${styles.reveal}`}>THE TECHNOLOGY</div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal} ${styles.stagger1}`}>Two layers of intelligence</h2>
          <p className={`${styles.sectionSub} ${styles.reveal} ${styles.stagger2}`}>Your content tells brands more than you think. We read the signals they care about.</p>
        </div>

        <div className={styles.aiGrid}>
          <div className={`${styles.aiFeature} ${styles.reveal} ${styles.stagger1}`}>
            <div className={styles.aiIcon}></div>
            <h3>Content Analysis Layer</h3>
            <p>Scans your content footprint — titles, descriptions, tags, affiliate signals, posting cadence — to classify your niche and identify commercial patterns that brands respond to.</p>
          </div>
          <div className={`${styles.aiFeature} ${styles.reveal} ${styles.stagger2}`}>
            <div className={styles.aiIcon}></div>
            <h3>Brand Intelligence Layer</h3>
            <p>Reads observed brand-creator interactions to learn what brands in your niche actually pay for. Your score reflects real market behaviour — not what an industry report says it should be.</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section ref={pillarsRef} className={`${styles.pillarsSection} ${pillarsVisible ? styles.visible : ''}`}>
        <div className={styles.contentWrap}>
          <div className={`${styles.label} ${styles.reveal}`}>HOW IT WORKS</div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal} ${styles.stagger1}`}>How Creatrbase works</h2>
          <div className={styles.pillarGrid}>
            <div className={`${styles.pillar} ${styles.reveal} ${styles.stagger1}`}>
              <h3>1. Reads your channel data</h3>
              <p>Connects to your YouTube or Twitch analytics via read-only OAuth. No publishing access, no DM access.</p>
              <ul className={styles.pillarList}>
                <li>Subscriber growth velocity</li>
                <li>Engagement quality benchmarking</li>
                <li>Audience geography analysis</li>
              </ul>
            </div>
            <div className={`${styles.pillar} ${styles.reveal} ${styles.stagger2}`}>
              <h3>2. Tells you where you stand commercially</h3>
              <p>Scores you across six dimensions that map to how brands actually evaluate creators.</p>
              <ul className={styles.pillarList}>
                <li>Commercial Viability Score (0–100)</li>
                <li>Tier placement with milestone tracking</li>
                <li>Primary constraint identification</li>
              </ul>
            </div>
            <div className={`${styles.pillar} ${styles.reveal} ${styles.stagger3}`}>
              <h3>3. Gives you the toolkit to represent yourself</h3>
              <p>Brand outreach, deal tracking, and negotiation support — so you can pitch with data, not guesswork.</p>
              <ul className={styles.pillarList}>
                <li>Brand outreach log with niche filtering</li>
                <li>Deal pipeline and rate tracking</li>
                <li>AI-generated gap closure tasks</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.sectionDivider} />

      {/* Pricing */}
      <section ref={pricingRef} className={`${styles.pricingSection} ${pricingVisible ? styles.visible : ''}`}>
        <div className={styles.contentWrap}>
          <div className={`${styles.label} ${styles.reveal}`}>PRICING</div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal} ${styles.stagger1}`}>Pricing</h2>
          <p className={`${styles.sectionSub} ${styles.reveal} ${styles.stagger2}`}>14-day trial. No card required to start.</p>
          <div className={`${styles.pricingGrid} ${styles.reveal} ${styles.stagger2}`}>

            <div className={styles.priceCard}>
              <div className={styles.priceTier}>Core</div>
              <div className={styles.priceAmount}>£10<span>/mo</span></div>
              <ul className={styles.featureList}>
                <li>Viability Score across 6 dimensions</li>
                <li>Gap Tracker &amp; Milestone Forecasting</li>
                <li>AI Weekly Quest Board</li>
                <li>Brand Outreach Log</li>
                <li>YouTube &amp; Twitch Connect</li>
              </ul>
              <Button variant="outline" onClick={() => navigate('/signup')}>Start 14-day Trial</Button>
            </div>

            <div className={`${styles.priceCard} ${styles.featured}`}>
              <div className={styles.featuredBadge}>Most Popular</div>
              <div className={styles.priceTier}>Pro</div>
              <div className={styles.priceAmount}>£20<span>/mo</span></div>
              <ul className={styles.featureList}>
                <li>Everything in Core</li>
                <li>AI Recommendation Engine</li>
                <li>Deal Pipeline &amp; Negotiations</li>
                <li>Brand Intelligence Layer</li>
                <li>Rate Negotiation Tools</li>
                <li>Priority Support</li>
              </ul>
              <Button variant="primary" onClick={() => navigate('/signup')}>Start 14-day Trial</Button>
            </div>

          </div>
        </div>
      </section>

      <div className={styles.sectionDivider} />

      {/* FAQ */}
      <section ref={faqRef} className={`${styles.faqSection} ${faqVisible ? styles.visible : ''}`}>
        <div className={styles.contentWrap}>
          <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>Frequently Asked Questions</h2>
          <div className={styles.faqGrid}>
            <FaqItem
              id="bad-score"
              question="What if my score is bad?"
              answer="The score is a diagnostic, not a verdict. It tells you exactly which of the six dimensions is holding you back and what to do about it. Most creators improve their weakest dimension within 30 days of connecting."
            />
            <FaqItem
              id="different"
              question="How is this different from creator analytics tools?"
              answer="Most tools count views and followers. Creatrbase scores commercial viability — the specific metrics brands use when deciding whether to pay you. Subscriber count is one of six dimensions, and not the most important one."
            />
            <FaqItem
              id="data"
              question="What data do you need from me?"
              answer="Read-only OAuth access to YouTube Analytics or Twitch. No publishing permissions, no DM access, no subscriber list. You can disconnect at any time from the Connections page."
            />
            <FaqItem
              id="tiktok"
              question="What if I'm on TikTok or Instagram?"
              answer="Currently YouTube and Twitch only. TikTok and Instagram support is on the roadmap. You can score your YouTube or Twitch channel now and we'll notify you when other platforms launch."
            />
            <FaqItem
              id="accuracy"
              question="How accurate is the score?"
              answer="Every score carries a confidence tier — high, medium, or low — so you always know how much weight to put on it. The more data we have (analytics access, posting history, niche classification), the higher the confidence. A public-data-only score is directional; a full-access score is actionable."
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section ref={ctaRef} className={`${styles.ctaSection} ${ctaVisible ? styles.visible : ''}`}>
        <div className={`${styles.ctaCard} ${styles.reveal}`}>
          <h2>Score your channel.</h2>
          <p>Built by Anthony Nell, creator-economy operator. No VC funding, no inflated metrics — just the tools independent creators actually need.</p>
          <Button variant="primary" size="lg" onClick={scrollToScore}>
            Get my score
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerMain}>
            <div className={styles.footerBrand}>
              <LogoWordmark className={styles.logo} />
              <p className={styles.footerTagline}>Commercial intelligence for independent creators. Building the infrastructure for the self-represented era.</p>
            </div>
            <div className={styles.footerLinksGrid}>
              <div className={styles.footerCol}>
                <h5>Product</h5>
                <Link to="/scoring-explained">How Scoring Works</Link>
                <Link to="/blog">Blog</Link>
              </div>
              <div className={styles.footerCol}>
                <h5>Legal</h5>
                <Link to="/privacy">Privacy</Link>
                <Link to="/terms">Terms</Link>
              </div>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p>&copy; 2026 Creatrbase. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
