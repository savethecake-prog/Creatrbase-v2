import { PageMeta } from '../../components/PageMeta/PageMeta';
import { AgenciesNav, AgenciesFooter } from './AgenciesLayout';
import { LEGAL_CONTACT_EMAIL, LEGAL_PENDING_LINE } from './config';
import styles from './Agencies.module.css';

/**
 * /agencies/privacy — the privacy notice (CB-KD-06 s.7; draft in
 * agencies-service/legal/privacy-notice.md). Contact placeholder reads from config; when
 * unset, a quiet completion line stands in — never lorem or brackets (CB-KD-05 s.5).
 */
export function Privacy() {
  const contact = LEGAL_CONTACT_EMAIL
    ? <>To exercise any of these, contact us at <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.</>
    : `${LEGAL_PENDING_LINE} A contact address will be published here.`;

  return (
    <div className={styles.page}>
      <PageMeta
        title="Privacy notice — Creatrbase for agencies"
        description="What personal data the Creatrbase agencies service collects, why we hold it, how long we keep it, and your rights."
        canonical="https://creatrbase.com/agencies/privacy"
        noIndex
      />
      <AgenciesNav />

      <article className={styles.doc}>
        <header className={styles.docHeader}>
          <p className={styles.docFlag}>Draft for review — a professional review pass is recommended before first paid use.</p>
          <h1 className={styles.docTitle}>Privacy Notice</h1>
          <p className={styles.docSub}>Creatrbase — agencies service · last updated 3 July 2026 (draft)</p>
        </header>

        <p>
          This notice explains what personal data Creatrbase collects through its agencies service,
          why we hold it, how long we keep it, and the rights you have. It is written to be read, not
          to be waded through. If anything here is unclear, contact us at the address at the end.
        </p>
        <p>Creatrbase is the data controller for the processing described below.</p>

        <section className={styles.docSection}>
          <h2>1. The brief form</h2>
          <p>
            When you complete a brief on the agencies route, we collect the information you enter:
            your work email, your agency name, your name and role, your campaign description, the
            platforms and counts you specify, your success metrics, your audience requirement, any
            brand sensitivities and exclusions you note, your timeframe, and anything else you choose
            to add.
          </p>
          <p>
            We use this information to prepare and deliver the dossiers you have asked for, to contact
            you about your brief, and to operate the free run and its one-per-organisation rule. Our
            lawful basis is the performance of the service you have requested, and, for the free-run
            eligibility check, our legitimate interest in running the offer fairly.
          </p>
          <p>
            If you begin a brief and leave, we may hold the partial draft so that a save-and-resume
            link can return you to it. A draft that is never completed is removed after the period
            stated in section 5.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>2. Prospect data held for outreach</h2>
          <p>
            We identify UK agencies that may find the service useful and hold business contact details
            for them — typically a corporate email address, a name and role, and the agency name — so
            that we can send a small volume of relevant, honestly identified business email.
          </p>
          <p>
            Our lawful basis is legitimate interest: contacting a business about a service relevant to
            its work, using corporate contact details, with a clear identification of who we are and a
            working way to opt out. We do not use this basis for individual subscribers, and
            sole-trader personal addresses are filtered out before any contact is made.
          </p>
          <p>
            Every message carries a way to opt out. When you opt out, we record that on a suppression
            list and honour it immediately and permanently. You can also ask us to remove your details
            entirely.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>3. Creator data processed for vetting</h2>
          <p>
            To vet and score creators for a brief, we process information about those creators. This is
            drawn from publicly available sources — their public profiles, public posts, and published
            platform figures — and from reference data. We use it to produce the modelled estimates,
            delivery confidence figures, and risk registers that make up a dossier.
          </p>
          <p>
            Our lawful basis is legitimate interest: assessing publicly available professional
            information about a creator’s public activity, for the purpose of a considered,
            evidence-led vetting judgement. A creator’s own purchase of any Creatrbase product never
            influences an agency-side vetting outcome.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>4. Cookies</h2>
          <p>
            The service sets only strictly necessary cookies — an administrator session cookie and,
            where a dossier is access-controlled, a short-lived session cookie for that dossier. These
            are required for the service to function, so no consent banner is shown. We do not use
            advertising or cross-site tracking cookies. Our analytics are cookieless.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>5. How long we keep data</h2>
          <p>The retention periods below are proposed and should be confirmed on professional review before first paid use.</p>
          <ul className={styles.docList}>
            <li><strong>Completed brief and its dossiers:</strong> for the life of the client relationship and up to 24 months after the last engagement, then reviewed for deletion or anonymisation.</li>
            <li><strong>Incomplete form drafts:</strong> 30 days from the last activity, then deleted.</li>
            <li><strong>Campaign outcome data used for calibration:</strong> retained in anonymised, aggregated form indefinitely; the identifiable source record follows the brief retention above.</li>
            <li><strong>Prospect contact details:</strong> until you opt out or ask for removal, or until we judge the record no longer relevant, whichever comes first.</li>
            <li><strong>Suppression-list entries:</strong> kept indefinitely, because their whole purpose is to make an opt-out permanent.</li>
            <li><strong>Transactional email records:</strong> 24 months, for delivery and dispute records.</li>
          </ul>
        </section>

        <section className={styles.docSection}>
          <h2>6. Who we share data with</h2>
          <p>
            We use a small number of service providers to run the service — for example an email
            delivery provider for transactional messages, and hosting on our own server. These
            providers process data on our instructions only. We do not sell personal data, and we do
            not share it for anyone else’s marketing.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>7. Your rights</h2>
          <p>
            You have the right to ask for a copy of the personal data we hold about you, to ask us to
            correct it, to ask us to delete it, to object to processing based on legitimate interest,
            and to ask us to restrict processing while a question is resolved. {contact} You also have
            the right to complain to the Information Commissioner’s Office.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>8. Contact</h2>
          <p>{LEGAL_CONTACT_EMAIL ? <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> : LEGAL_PENDING_LINE}</p>
        </section>

        <p className={styles.docFine}>
          This draft is provided for review. It is not legal advice. A professional review pass is
          recommended before the notice is published or relied upon for any paid engagement.
        </p>
      </article>

      <AgenciesFooter />
    </div>
  );
}
