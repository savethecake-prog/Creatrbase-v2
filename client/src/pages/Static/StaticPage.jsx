import React from 'react';
import { useParams } from 'react-router-dom';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import { PublicNav } from '../../components/PublicNav/PublicNav';
import styles from './StaticPage.module.css';

const CONTENT = {
  privacy: {
    title: "Privacy Policy",
    subtitle: "Last updated: April 16, 2026",
    content: (
      <>
        <p>Creatrbase ("we", "us", or "our") operates the Creatrbase platform, a creator analytics and brand partnership tool accessible at creatrbase.com. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service. Please read this policy carefully. By using Creatrbase you agree to the practices described here.</p>

        <h3>1. Information We Collect</h3>
        <p><strong>Account information:</strong> When you register, we collect your name, email address, and a hashed password (or your Google account identifier if you sign in with Google).</p>
        <p><strong>Platform data:</strong> When you connect a social media platform (YouTube, TikTok, Instagram, Twitch, or others we add over time), we request OAuth access to retrieve your channel or profile metrics — such as subscriber or follower counts, view counts, video metadata, and engagement statistics. We only request the minimum permissions needed to provide the service.</p>
        <p><strong>Usage data:</strong> We automatically collect information about how you interact with the platform, including pages visited, features used, and timestamps. This is used to improve the service and is not sold.</p>
        <p><strong>Communications:</strong> If you contact us by email, we retain that correspondence to respond to your inquiry.</p>

        <h3>2. How We Use Your Information</h3>
        <p>We use collected information to:</p>
        <ul>
          <li>Provide, operate, and maintain the Creatrbase platform</li>
          <li>Calculate brand-readiness scores and analytics based on your platform metrics</li>
          <li>Sync your platform data on a scheduled basis to keep insights current</li>
          <li>Send transactional emails (account confirmations, weekly digests, task reminders)</li>
          <li>Diagnose technical issues and improve platform performance</li>
          <li>Comply with legal obligations</li>
        </ul>
        <p>We do not use your data to train AI models for third parties, sell your data to advertisers, or share it with brands without your explicit action.</p>

        <h3>3. Platform Integrations and Third-Party APIs</h3>
        <p>Creatrbase integrates with third-party platforms including Google (YouTube), TikTok, Meta (Instagram), and Twitch. By connecting a platform you authorise us to retrieve data via that platform's official API under their respective terms of service. The data we retrieve is stored securely and used solely to power your analytics dashboard.</p>
        <p>Access tokens obtained during OAuth authorisation are encrypted at rest. We store refresh tokens where permitted by the platform in order to maintain continuous sync without requiring you to re-authorise frequently. You may revoke our access at any time by disconnecting the platform within Creatrbase or by revoking app permissions directly on the third-party platform.</p>

        <h3>4. Data Sharing and Disclosure</h3>
        <p>We do not sell, trade, or rent your personal information. We may share data only in the following circumstances:</p>
        <ul>
          <li><strong>Service providers:</strong> We use infrastructure providers (hosting, database, email delivery) who process data on our behalf under data processing agreements.</li>
          <li><strong>Legal requirements:</strong> We may disclose information if required by law, court order, or governmental authority.</li>
          <li><strong>Business transfer:</strong> If Creatrbase is acquired or merges with another entity, your data may transfer as part of that transaction. We will notify you in advance.</li>
        </ul>

        <h3>5. Data Retention</h3>
        <p>We retain your account data for as long as your account is active. If you delete your account, we will delete your personal data within 30 days, except where retention is required by law. Platform metric snapshots (historical analytics) may be retained in anonymised aggregate form.</p>

        <h3>6. Security</h3>
        <p>We implement industry-standard security measures including encryption at rest for sensitive credentials, HTTPS for all data in transit, and access controls on our infrastructure. No system is perfectly secure; we cannot guarantee absolute security but we take reasonable steps to protect your data.</p>

        <h3>7. Your Rights</h3>
        <p>Depending on your jurisdiction, you may have the right to access, correct, delete, or export your personal data. To exercise these rights, email us at hello@creatrbase.com. We will respond within 30 days.</p>

        <h3>8. Cookies</h3>
        <p>We use session cookies to keep you authenticated while using the platform. We do not use third-party advertising cookies or tracking pixels.</p>

        <h3>9. Children's Privacy</h3>
        <p>Creatrbase is not directed at children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, contact us at hello@creatrbase.com and we will delete it promptly.</p>

        <h3>10. Changes to This Policy</h3>
        <p>We may update this Privacy Policy from time to time. We will notify registered users by email of material changes. Continued use of the platform after changes take effect constitutes acceptance of the revised policy.</p>

        <h3>11. Contact</h3>
        <p>For privacy-related questions or requests, contact us at: <strong>hello@creatrbase.com</strong></p>
      </>
    )
  },
  terms: {
    title: "Terms of Service",
    subtitle: "Last updated: April 16, 2026",
    content: (
      <>
        <p>These Terms of Service ("Terms") govern your access to and use of Creatrbase ("the Service"), operated by Creatrbase ("we", "us", "our"). By creating an account or using the Service you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>

        <h3>1. The Service</h3>
        <p>Creatrbase is a creator analytics platform that connects to your social media accounts (YouTube, TikTok, Instagram, Twitch, and others) to provide brand-readiness scoring, engagement analytics, outreach tracking, and related tools to help independent creators manage and grow their business relationships with brands.</p>

        <h3>2. Account Registration</h3>
        <p>You must create an account to use the Service. You agree to provide accurate, current, and complete information during registration and to keep your account credentials secure. You are responsible for all activity that occurs under your account. Notify us immediately at hello@creatrbase.com if you suspect unauthorised access.</p>

        <h3>3. Platform Connections</h3>
        <p>The Service allows you to connect your social media platform accounts via OAuth. By connecting a platform you confirm that you are the authorised owner of that account and that you have the right to grant us access to its data. You may disconnect any platform at any time from your Connections page. We will retain historical metric snapshots taken prior to disconnection.</p>

        <h3>4. Acceptable Use</h3>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose or in violation of any third-party platform's terms of service</li>
          <li>Attempt to gain unauthorised access to any part of the Service or its infrastructure</li>
          <li>Scrape, copy, or redistribute Creatrbase's proprietary scoring logic, analytics models, or brand registry data</li>
          <li>Upload or transmit malicious code, viruses, or harmful content</li>
          <li>Impersonate another person or entity</li>
          <li>Use the Service to spam, harass, or send unsolicited commercial messages</li>
          <li>Interfere with or disrupt the integrity or performance of the Service</li>
        </ul>

        <h3>5. Intellectual Property</h3>
        <p>All content, features, and functionality of the Service — including but not limited to the brand-readiness scoring algorithm, platform design, and brand registry — are owned by Creatrbase and are protected by applicable intellectual property laws. You are granted a limited, non-exclusive, non-transferable licence to use the Service for your own personal or business purposes. You may not copy, modify, distribute, or create derivative works from any part of the Service without our express written permission.</p>
        <p>Your data (your channel metrics, personal information, and content) remains yours. We claim no ownership over it.</p>

        <h3>6. Third-Party Services</h3>
        <p>The Service integrates with third-party platforms and APIs. Your use of those platforms is governed by their own terms of service and privacy policies. We are not responsible for the practices of third-party platforms.</p>

        <h3>7. Email Communications</h3>
        <p>By creating an account you consent to receive transactional emails from Creatrbase, including weekly digest emails, task reminders, and account notifications. You may opt out of non-essential communications at any time.</p>

        <h3>8. Disclaimers</h3>
        <p>The Service is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not warrant that the Service will be uninterrupted, error-free, or that any analytics or scores will be accurate or complete. Brand-readiness scores are informational estimates based on available data and do not guarantee brand partnership outcomes.</p>

        <h3>9. Limitation of Liability</h3>
        <p>To the fullest extent permitted by law, Creatrbase shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Service, even if we have been advised of the possibility of such damages. Our total liability to you for any claims arising under these Terms shall not exceed the amount you paid us in the 12 months preceding the claim.</p>

        <h3>10. Termination</h3>
        <p>We may suspend or terminate your account at any time if you violate these Terms or if we reasonably believe your use poses a risk to the Service or other users. You may delete your account at any time by contacting hello@creatrbase.com. Upon termination, your right to use the Service ceases immediately.</p>

        <h3>11. Changes to These Terms</h3>
        <p>We may update these Terms from time to time. We will notify you of material changes by email. Continued use of the Service after changes take effect constitutes your acceptance of the revised Terms.</p>

        <h3>12. Governing Law</h3>
        <p>These Terms are governed by and construed in accordance with applicable law. Any disputes shall be resolved through good-faith negotiation in the first instance. If unresolved, disputes shall be subject to binding arbitration or the courts of competent jurisdiction.</p>

        <h3>13. Contact</h3>
        <p>For questions about these Terms, contact us at: <strong>hello@creatrbase.com</strong></p>
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
  const { slug } = useParams();
  const page = CONTENT[slug] || { 
    title: "Page Not Found", 
    subtitle: "We're building the future, but hasn't reached this corner yet.",
    content: <p>Check back soon as we expand the Creatrbase universe.</p>
  };

  return (
    <div className={styles.container}>
      <PageMeta title={page.title} description={page.subtitle} canonical={`https://creatrbase.com/${slug}`} />
      <PublicNav />

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
