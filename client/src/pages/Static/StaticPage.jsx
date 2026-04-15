import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button/Button';
import { LogoWordmark } from '../../components/ui/LogoWordmark';
import styles from './StaticPage.module.css';

const CONTENT = {
  privacy: {
    title: "Privacy Policy",
    subtitle: "Your data is yours. We just help you use it.",
    content: (
      <>
        <p>At Creatrbase, we take your privacy seriously. We only access the data you explicitly authorize via Google OAuth to provide you with insights into your creator journey.</p>
        <h3>Data Collection</h3>
        <p>We collect public YouTube statistics (subscriber counts, view history, and public video metadata) to calculate your brand-readiness scores.</p>
        <h3>Third Parties</h3>
        <p>We do not sell your data. Never. We are built for creators, which means we protect your independence from opaque algorithms and data brokers.</p>
      </>
    )
  },
  terms: {
    title: "Terms of Service",
    subtitle: "The rules of the game.",
    content: (
      <>
        <p>By using Creatrbase, you agree to represent yourself with integrity. Our tools are designed for self-sufficient creators to grow their business.</p>
        <h3>Usage</h3>
        <p>You may use our "Oracle" and "Brain" tools for personal business development. Redistribution of our proprietary "Brand-Ready" logic is prohibited.</p>
      </>
    )
  },
  features: {
    title: "Platform Features",
    subtitle: "Everything you need to own your worth.",
    content: (
      <>
        <p>Explore the tools we've built to help you cut out the agency middleman.</p>
        <h3>The brain</h3>
        <p>Semantic analysis of your content footprint to find commercial intent.</p>
        <h3>The Oracle</h3>
        <p>Proprietary mapping of agency thresholds to tell you exactly how to bridge the gap.</p>
      </>
    )
  },
  pricing: {
    title: "Pricing & Plans",
    subtitle: "Simple, transparent pricing for every stage of your journey.",
    content: (
      <>
        <p>Whether you're just starting or managing a full roster, we have a plan built for you.</p>
        <h3>Free - $0/mo</h3>
        <p>Perfect for new creators. Track your basic stats and run manual brand-readiness checks.</p>
        <h3>Pro - $29/mo</h3>
        <p>The standard for professional creators. Automated gap tracking, direct "Oracle" mapping, and full outreach kits.</p>
        <h3>Agency - Custom</h3>
        <p>For organizations managing multiple creators. Multi-user dashboard, aggregated analytics, and white-labeled reports.</p>
      </>
    )
  }
};

export default function StaticPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const page = CONTENT[slug] || { 
    title: "Page Not Found", 
    subtitle: "We're building the future, but hasn't reached this corner yet.",
    content: <p>Check back soon as we expand the Creatrbase universe.</p>
  };

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link to="/">
            <LogoWordmark className={styles.logo} />
          </Link>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="outline" size="sm" onClick={() => window.history.back()}>
              Back
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/dashboard')}>
              Dashboard
            </Button>
          </div>
        </div>
      </nav>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.title}>{page.title}</h1>
          <p className={styles.subtitle}>{page.subtitle}</p>
        </header>

        <section className={styles.content}>
          {page.content}
        </section>
      </main>

      <footer className={styles.footer}>
        <p>© 2026 Creatrbase. Building for the independent creator.</p>
      </footer>
    </div>
  );
}
