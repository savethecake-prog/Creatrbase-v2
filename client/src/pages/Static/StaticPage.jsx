import React from 'react';
import { useParams } from 'react-router-dom';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import { PublicNav } from '../../components/PublicNav/PublicNav';
import { MarketingFooter } from '../../components/MarketingFooter/MarketingFooter';
import styles from './StaticPage.module.css';

const CONTENT = {
  cookies: {
    title: "Cookie Policy",
    subtitle: "Last updated: April 19, 2026",
    content: (
      <>
        <p>This Cookie Policy explains what cookies and similar technologies Creatrbase uses, why we use them, and how you can control them. It should be read alongside our <a href="/privacy">Privacy Policy</a>.</p>

        <h3>1. What are cookies?</h3>
        <p>Cookies are small text files placed on your device when you visit a website. They help the site remember information about your visit so you do not have to re-enter it on each page. Some cookies are deleted when you close your browser (session cookies); others persist until they expire or you delete them (persistent cookies).</p>

        <h3>2. Cookies we use</h3>

        <h3>Essential cookies (always active)</h3>
        <p>These are strictly necessary for the platform to function. You cannot opt out of them.</p>
        <ul>
          <li>
            <strong>cb_session</strong> — httpOnly, Secure, SameSite=Lax. Stores your authentication JWT so you remain logged in between page loads. Set on login; expires when the session ends or after inactivity. No personal data beyond a session identifier.
          </li>
        </ul>

        <h3>Analytics cookies</h3>
        <p>We use <strong>Plausible Analytics</strong>, a privacy-focused tool that does not use cookies by default and does not fingerprint individual visitors. Plausible counts page views and traffic sources without collecting personal data or setting tracking cookies. No data leaves our analytics provider to third-party ad networks. No consent is strictly required under PECR/GDPR for cookieless analytics, but we include an analytics toggle in our consent banner for full transparency.</p>
        <p>If Plausible ever introduces cookies they will be listed here with the name, duration, and purpose.</p>

        <h3>Payment cookies (Stripe)</h3>
        <p>When you proceed to checkout, <strong>Stripe</strong> (our payment processor) may set cookies on its own domain to prevent fraud and remember your payment details. These cookies are set by stripe.com, not by creatrbase.com, and are governed by <a href="https://stripe.com/gb/privacy" target="_blank" rel="noopener noreferrer">Stripe's privacy policy</a>. Stripe cookies are only loaded when you actively initiate a payment flow.</p>

        <h3>localStorage items</h3>
        <p>We store the following items in your browser's localStorage (not transmitted to our servers):</p>
        <ul>
          <li><strong>creatrbase_cookie_consent</strong> — Records your cookie consent choices (analytics: true/false, marketing: true/false) and the timestamp of your decision. Expires after 12 months, after which we ask again.</li>
        </ul>

        <h3>3. Third-party embeds</h3>
        <p>Some blog articles may link to external sites. We do not embed third-party iframes, video players, or social widgets that would set cookies without your knowledge.</p>

        <h3>4. Managing your preferences</h3>
        <p>You can change your cookie preferences at any time by clicking the "Manage preferences" link in the cookie banner at the bottom of any public page. You may also clear cookies and localStorage through your browser settings — refer to your browser's help documentation for instructions.</p>
        <p>Please note that disabling essential cookies will prevent you from logging in to the platform.</p>

        <h3>5. Changes to this policy</h3>
        <p>We will update this page if we add new cookies or change how we use existing ones. Material changes will be communicated via the in-app banner and, for registered users, by email.</p>

        <h3>6. Contact</h3>
        <p>For questions about cookies or your privacy, contact us at <strong>privacy@creatrbase.com</strong>.</p>
      </>
    )
  },
  privacy: {
    title: "Privacy Policy",
    subtitle: "Last updated: April 19, 2026",
    content: (
      <>
        <p>Creatrbase ("we", "us", or "our") operates the Creatrbase platform, a creator analytics and brand partnership tool accessible at creatrbase.com. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service. Please read this policy carefully. By using Creatrbase you agree to the practices described here.</p>

        <h3>1. Who we are</h3>
        <p>Creatrbase is a sole-trader business operating in the United Kingdom. Our data protection contact is <strong>privacy@creatrbase.com</strong>. We act as data controller for all personal data processed via this platform.</p>

        <h3>2. Legal basis for processing</h3>
        <p>We rely on the following legal bases under UK GDPR / GDPR:</p>
        <ul>
          <li><strong>Contract performance (Art. 6(1)(b)):</strong> Providing your account, calculating brand-readiness scores, syncing platform metrics, and sending transactional emails. This processing is necessary to deliver the service you signed up for.</li>
          <li><strong>Legitimate interests (Art. 6(1)(f)):</strong> Security monitoring, fraud prevention, platform analytics, and improving the service. Our legitimate interests do not override your rights.</li>
          <li><strong>Consent (Art. 6(1)(a)):</strong> Sending marketing emails and newsletters. You may withdraw consent at any time via the unsubscribe link in any email or by contacting us.</li>
          <li><strong>Legal obligation (Art. 6(1)(c)):</strong> Complying with applicable law, including responding to lawful requests from authorities.</li>
        </ul>

        <h3>3. Information we collect</h3>
        <p><strong>Account information:</strong> When you register, we collect your name, email address, and a hashed password (or your Google account identifier if you sign in with Google).</p>
        <p><strong>Platform data:</strong> When you connect a social media platform (YouTube, TikTok, Instagram, Twitch, or others we add over time), we request OAuth access to retrieve your channel or profile metrics such as subscriber or follower counts, view counts, video metadata, and engagement statistics. We only request the minimum permissions needed to provide the service.</p>
        <p><strong>Usage data:</strong> We automatically collect information about how you interact with the platform, including pages visited, features used, and timestamps. This is used to improve the service and is not sold.</p>
        <p><strong>Communications:</strong> If you contact us by email, we retain that correspondence to respond to your inquiry.</p>
        <p><strong>Newsletter subscription:</strong> If you subscribe to our newsletter, we record your email address, the date of subscription, and the segments you opted in to. We record explicit consent at the point of sign-up.</p>

        <h3>4. How we use your information</h3>
        <p>We use collected information to:</p>
        <ul>
          <li>Provide, operate, and maintain the Creatrbase platform</li>
          <li>Calculate brand-readiness scores and analytics based on your platform metrics</li>
          <li>Sync your platform data on a scheduled basis to keep insights current</li>
          <li>Send transactional emails (account confirmations, weekly digests, task reminders)</li>
          <li>Send marketing emails where you have given consent</li>
          <li>Diagnose technical issues and improve platform performance</li>
          <li>Comply with legal obligations</li>
        </ul>
        <p>We do not use your data to train AI models for third parties, sell your data to advertisers, or share it with brands without your explicit action.</p>

        <h3>5. Platform integrations and third-party APIs</h3>
        <p>Creatrbase integrates with third-party platforms including Google (YouTube), TikTok, Meta (Instagram), and Twitch. By connecting a platform you authorise us to retrieve data via that platform's official API under their respective terms of service. The data we retrieve is stored securely and used solely to power your analytics dashboard.</p>
        <p>Access tokens obtained during OAuth authorisation are encrypted at rest. We store refresh tokens where permitted by the platform in order to maintain continuous sync without requiring you to re-authorise frequently. You may revoke our access at any time by disconnecting the platform within Creatrbase or by revoking app permissions directly on the third-party platform.</p>

        <h3>6. Data sharing and disclosure</h3>
        <p>We do not sell, trade, or rent your personal information. We may share data only in the following circumstances:</p>
        <ul>
          <li><strong>Service providers:</strong> We use infrastructure providers (hosting, database, email delivery via Resend, payments via Stripe) who process data on our behalf under data processing agreements.</li>
          <li><strong>Legal requirements:</strong> We may disclose information if required by law, court order, or governmental authority.</li>
          <li><strong>Business transfer:</strong> If Creatrbase is acquired or merges with another entity, your data may transfer as part of that transaction. We will notify you in advance.</li>
        </ul>

        <h3>7. Data retention</h3>
        <p>We retain your data for the following periods:</p>
        <ul>
          <li><strong>Account data (profile, email, name):</strong> For as long as your account is active. On account deletion we anonymise personal identifiers within 30 days and initiate a hard-delete process within 30 days of the soft-delete request.</li>
          <li><strong>Platform metric snapshots:</strong> Retained for 24 months, then automatically deleted or aggregated anonymously.</li>
          <li><strong>Session tokens:</strong> Deleted on logout or after 30 days of inactivity.</li>
          <li><strong>Support and email correspondence:</strong> Retained for 3 years for audit and fraud-prevention purposes.</li>
          <li><strong>Newsletter subscription records:</strong> Retained while you remain subscribed. Deleted 30 days after unsubscription unless required by law.</li>
          <li><strong>Billing records:</strong> 7 years as required by UK accounting law.</li>
        </ul>

        <h3>8. Cookies and tracking</h3>
        <p>We use a small number of cookies. See our <a href="/cookies">Cookie Policy</a> for the full list, including which are essential and which require consent. You can manage your preferences at any time via the cookie banner.</p>

        <h3>9. Your rights under UK GDPR</h3>
        <p>You have the following rights regarding your personal data:</p>
        <ul>
          <li><strong>Right of access (Subject Access Request):</strong> Request a copy of all personal data we hold about you. Use the in-app export tool at <em>Account &gt; Privacy &gt; Export my data</em> or email privacy@creatrbase.com.</li>
          <li><strong>Right to rectification:</strong> Request correction of inaccurate or incomplete data.</li>
          <li><strong>Right to erasure ("right to be forgotten"):</strong> Request deletion of your account and personal data. Use the in-app deletion tool or email us. We will complete the process within 30 days.</li>
          <li><strong>Right to data portability:</strong> Receive your data in a machine-readable format (JSON). Available via the in-app export tool.</li>
          <li><strong>Right to restrict processing:</strong> Request we limit how we use your data while a complaint is resolved.</li>
          <li><strong>Right to object:</strong> Object to processing based on legitimate interests, including profiling. Contact us and we will review within 30 days.</li>
          <li><strong>Right to withdraw consent:</strong> Where processing is based on consent (e.g. newsletters), you may withdraw at any time without affecting prior processing.</li>
        </ul>
        <p>To exercise any of these rights, email <strong>privacy@creatrbase.com</strong> with the subject line "Data Subject Request". We will respond within 30 days. If you are not satisfied with our response, you have the right to lodge a complaint with the UK Information Commissioner's Office (ICO) at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer">ico.org.uk</a>.</p>

        <h3>10. Security</h3>
        <p>We implement industry-standard security measures including encryption at rest for sensitive credentials, HTTPS for all data in transit, and access controls on our infrastructure. No system is perfectly secure; we cannot guarantee absolute security but we take reasonable steps to protect your data.</p>

        <h3>11. Children's privacy</h3>
        <p>Creatrbase is not directed at children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, contact us at hello@creatrbase.com and we will delete it promptly.</p>

        <h3>12. Changes to this policy</h3>
        <p>We may update this Privacy Policy from time to time. We will notify registered users by email of material changes. Continued use of the platform after changes take effect constitutes acceptance of the revised policy. The current version is always available at <a href="/privacy">creatrbase.com/privacy</a>.</p>

        <h3>13. Contact and DPO</h3>
        <p>For privacy-related questions, Subject Access Requests, or data deletion requests, contact our data protection contact at: <strong>privacy@creatrbase.com</strong></p>
        <p>For general enquiries: <strong>hello@creatrbase.com</strong></p>
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
        <h3>Free - £0/mo</h3>
        <p>Perfect for new creators. Track your basic stats and run manual brand-readiness checks.</p>
        <h3>Pro - £29/mo</h3>
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
    subtitle: "We're building the future, but haven't reached this corner yet.",
    content: <p>Check back soon as we expand the Creatrbase universe.</p>
  };

  return (
    <div className={styles.container}>
      <PageMeta title={page.title} description={page.subtitle} canonical={`https://creatrbase.com/${slug}`} />
      <PublicNav variant="v2" />

      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.title}>{page.title}</h1>
          <p className={styles.subtitle}>{page.subtitle}</p>
        </header>

        <section className={styles.content}>
          {page.content}
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
