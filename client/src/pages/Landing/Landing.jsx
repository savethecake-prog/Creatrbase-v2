import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button/Button';
import { Card } from '../../components/ui/Card/Card';
import { BrandCheck } from '../../components/landing/BrandCheck/BrandCheck';
import { ProductMockup } from '../../components/landing/ProductMockup/ProductMockup';
import { useIntersection } from '../../hooks/useIntersection';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import { PublicNav } from '../../components/PublicNav/PublicNav';
import { LogoWordmark } from '../../components/ui/LogoWordmark';
import styles from './Landing.module.css';

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
      const percent = (scrollY / (documentHeight - windowHeight)) * 100;
      setScrollPercent(percent);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={styles.container}>
      <PageMeta
        title="Commercial Intelligence for Independent Creators"
        description="Know your Commercial Viability Score. Track your gap to brand deals. Represent yourself directly — without an agency."
        canonical="https://creatrbase.com"
      />
      <div className={styles.scrollProgress} style={{ width: `${scrollPercent}%` }} />
      <PublicNav scrollEffect />

      {/* Hero Section */}
      <header ref={heroRef} className={`${styles.hero} ${heroVisible ? styles.visible : ''}`}>
        <div className={styles.heroContent}>
          <h1 className={`${styles.heroTitle} ${styles.reveal}`}>
            Boss the Algo. <br /><span className={styles.gradientText}>Bag the Brand.</span>
          </h1>
          <p className={`${styles.heroSub} ${styles.reveal} ${styles.stagger1}`}>
            The era of opaque agencies is over. We give you the "Agency in a Box" to track your real worth, hit your milestones, and represent yourself directly to the world's biggest brands.
          </p>
          
          <div className={`${styles.heroMain} ${styles.reveal} ${styles.stagger2}`}>
            <div className={styles.heroLeft}>
              <BrandCheck />
            </div>
            <div className={styles.heroRight}>
              <ProductMockup />
            </div>
          </div>
        </div>
      </header>

      <div className={styles.sectionDivider} />

      {/* The Creator Tax: The Problem */}
      <section ref={problemRef} className={`${styles.problemSection} ${problemVisible ? styles.visible : ''}`}>
        <div className={styles.contentWrap}>
          <div className={`${styles.label} ${styles.reveal}`}>THE PROBLEM</div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal} ${styles.stagger1}`}>The "Creator Tax" is holding you back.</h2>
          <div className={styles.problemGrid}>
            <div className={`${styles.problemText} ${styles.reveal} ${styles.stagger2}`}>
              <p>For too long, the path to a professional creator career has been guarded by gatekeepers. Traditional agencies take up to 30% of your earnings just for "managing" your inbox and keeping you in the dark about your true market value.</p>
              <p><strong>Creatrbase was built to change that.</strong> We believe every creator, from 1k to 1M followers, deserves the same data, tools, and negotiation power that the top 1% have.</p>
            </div>
            <div className={`${styles.statCallout} ${styles.reveal} ${styles.stagger3}`}>
              <div className={styles.calloutItem}>
                <span className={styles.calloutNum}>30%</span>
                <span className={styles.calloutLabel}>Average Agency Fee</span>
              </div>
              <div className={styles.calloutItem}>
                <span className={styles.calloutNum}>$0</span>
                <span className={styles.calloutLabel}>Fee with Creatrbase</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.sectionDivider} />

      {/* Social-First Content Section */}
      {/* AI Deep Dive Section (The Secret Sauce) */}
      <section ref={aiRef} className={`${styles.aiSection} ${aiVisible ? styles.visible : ''}`}>
        <div className={styles.aiHeader}>
          <div className={`${styles.label} ${styles.reveal}`}>THE TECHNOLOGY</div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal} ${styles.stagger1}`}>The Brain & The Oracle</h2>
          <p className={`${styles.sectionSub} ${styles.reveal} ${styles.stagger2}`}>Our AI doesn't just count views. It understands your worth.</p>
        </div>

        <div className={styles.aiGrid}>
          <div className={`${styles.aiFeature} ${styles.reveal} ${styles.stagger1}`}>
            <div className={styles.aiIcon}>🧠</div>
            <h3>The Brain</h3>
            <p><strong>The Brain</strong> scans your entire content footprint. It reads your transcripts, tags, and descriptions to find "Commercial Intent"—the hidden patterns that tell brands you're a perfect match.</p>
          </div>
          <div className={`${styles.aiFeature} ${styles.reveal} ${styles.stagger2}`}>
            <div className={styles.aiIcon}>🔮</div>
            <h3>The Oracle</h3>
            <p>We've mapped the secret requirements of over 50 top agencies. <strong>The Oracle</strong> cross-references your profile against these thresholds to tell you exactly how to bridge the gap and start getting paid.</p>
          </div>
        </div>
      </section>

      {/* Main Features removed in favor of The 3 Pillars overhaul */}

      {/* Detailed Features: The 3 Pillars */}
      <section ref={pillarsRef} className={`${styles.pillarsSection} ${pillarsVisible ? styles.visible : ''}`}>
        <div className={styles.contentWrap}>
          <div className={`${styles.label} ${styles.reveal}`}>HOW IT WORKS</div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal} ${styles.stagger1}`}>The Three Pillars of Your Growth</h2>
          <div className={styles.pillarGrid}>
            <div className={`${styles.pillar} ${styles.reveal} ${styles.stagger1}`}>
              <div className={styles.pillarIcon}>🛠️</div>
              <h3>1. The Data Foundation</h3>
              <p>We connect directly to your YouTube Analytics to pull metrics that actually matter to brands. No vanity metrics — just hard data on your commercial trajectory.</p>
              <ul className={styles.pillarList}>
                <li>View Consistency Tracking</li>
                <li>Niche Commercial Density</li>
                <li>Growth Velocity Mapping</li>
              </ul>
            </div>
            <div className={`${styles.pillar} ${styles.reveal} ${styles.stagger2}`}>
              <div className={styles.pillarIcon}>📈</div>
              <h3>2. The Gap Tracker</h3>
              <p>Know exactly where you stand. Our engine tells you the precise distance between your current profile and the next pay tier in your niche.</p>
              <ul className={styles.pillarList}>
                <li>Milestone Forecasting</li>
                <li>Watch-hour Acceleration</li>
                <li>Sub-tier Unlocks</li>
              </ul>
            </div>
            <div className={`${styles.pillar} ${styles.reveal} ${styles.stagger3}`}>
              <div className={styles.pillarIcon}>🤝</div>
              <h3>3. The Self-Rep Suite</h3>
              <p>Professional outreach templates and negotiation playbooks used by top agents, now in your hands. Represent yourself with total confidence.</p>
              <ul className={styles.pillarList}>
                <li>Automated Pitch Kits</li>
                <li>Contract Checklists</li>
                <li>Rate Calculator</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.sectionDivider} />

      {/* Pricing Section */}
      <section ref={pricingRef} className={`${styles.pricingSection} ${pricingVisible ? styles.visible : ''}`}>
        <div className={styles.contentWrap}>
          <div className={`${styles.label} ${styles.reveal}`}>PRICING</div>
          <h2 className={`${styles.sectionTitle} ${styles.reveal} ${styles.stagger1}`}>Simple, honest pricing.</h2>
          <p className={`${styles.sectionSub} ${styles.reveal} ${styles.stagger2}`}>14-day free trial. No card required. Cancel anytime.</p>
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

      {/* FAQ Section */}
      <section ref={faqRef} className={`${styles.faqSection} ${faqVisible ? styles.visible : ''}`}>
        <div className={styles.contentWrap}>
          <h2 className={`${styles.sectionTitle} ${styles.reveal}`}>Frequently Asked Questions</h2>
          <div className={styles.faqGrid}>
            <div className={`${styles.faqItem} ${styles.reveal} ${styles.stagger1}`}>
              <h4>Is Creatrbase an agency?</h4>
              <p>No. Creatrbase is a software platform that empowers you to be your own agency. We don't take a commission on your deals.</p>
            </div>
            <div className={`${styles.faqItem} ${styles.reveal} ${styles.stagger2}`}>
              <h4>Who is this for?</h4>
              <p>Micro-creators between 1,000 and 100,000 subscribers who want to professionalize their business and land their first or next brand deal.</p>
            </div>
            <div className={`${styles.faqItem} ${styles.reveal} ${styles.stagger3}`}>
              <h4>Is my data safe?</h4>
              <p>Absolutely. We use Google-verified OAuth to connect to your stats and we never share your private data with third parties without your consent.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section ref={ctaRef} className={`${styles.ctaSection} ${ctaVisible ? styles.visible : ''}`}>
        <div className={`${styles.ctaCard} ${styles.reveal}`}>
          <h2>Ready to bag the brand?</h2>
          <p>Join 2,000+ creators who are using the "Answer Book" to own their value.</p>
          <Button variant="primary" size="lg" onClick={() => navigate('/signup')}>
            Get Started Today
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerMain}>
            <div className={styles.footerBrand}>
              <LogoWordmark className={styles.logo} />
              <p className={styles.footerTagline}>The companion app for modern creators. Building the infrastructure for the self-represented era.</p>
            </div>
            <div className={styles.footerLinksGrid}>
              <div className={styles.footerCol}>
                <h5>Product</h5>
                <Link to="/features">Features</Link>
                <Link to="/pricing">Pricing</Link>
                <Link to="/roadmap">Roadmap</Link>
              </div>
              <div className={styles.footerCol}>
                <h5>Resources</h5>
                <Link to="/blog">Blog</Link>
                <Link to="/guides">Creator Guides</Link>
                <Link to="/support">Support</Link>
              </div>
              <div className={styles.footerCol}>
                <h5>Legal</h5>
                <Link to="/privacy">Privacy</Link>
                <Link to="/terms">Terms</Link>
                <Link to="/cookies">Cookies</Link>
              </div>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p>© 2026 Creatrbase. All rights reserved. Crafted for creators, by creators.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
