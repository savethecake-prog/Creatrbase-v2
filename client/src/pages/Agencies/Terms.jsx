import { PageMeta } from '../../components/PageMeta/PageMeta';
import { AgenciesNav, AgenciesFooter } from './AgenciesLayout';
import { LEGAL_ENTITY_LINE, LEGAL_CONTACT_EMAIL, LEGAL_PENDING_LINE } from './config';
import styles from './Agencies.module.css';

/**
 * /agencies/terms — the terms of service (CB-KD-06 s.7; draft in
 * agencies-service/legal/terms-of-service.md), folding in the CB-KD-04 s.5 calibration
 * clause verbatim. Entity + contact placeholders read from config; when unset, a quiet
 * completion line stands in — never lorem or brackets (CB-KD-05 s.5).
 */
export function Terms() {
  const entityAndContact = () => {
    if (LEGAL_ENTITY_LINE && LEGAL_CONTACT_EMAIL) {
      return <>{LEGAL_ENTITY_LINE}. Contact us at <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.</>;
    }
    if (LEGAL_CONTACT_EMAIL) {
      return <>Contact us at <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. {LEGAL_PENDING_LINE}</>;
    }
    return `${LEGAL_PENDING_LINE} The trading entity name, address and contact will be published here.`;
  };

  return (
    <div className={styles.page}>
      <PageMeta
        title="Terms of service — Creatrbase for agencies"
        description="The terms that govern the agency-side services offered by Creatrbase, including the calibration and aggregate-use clause."
        canonical="https://creatrbase.com/agencies/terms"
        noIndex
      />
      <AgenciesNav />

      <article className={styles.doc}>
        <header className={styles.docHeader}>
          <p className={styles.docFlag}>Draft for review — a professional review pass is recommended before first paid use.</p>
          <h1 className={styles.docTitle}>Terms of Service</h1>
          <p className={styles.docSub}>Creatrbase — agencies service · last updated 3 July 2026 (draft)</p>
        </header>

        <p>
          These terms govern the agency-side services offered by Creatrbase: the Brand Safety Scan,
          the Score, the Vetting Batch, the Full Brief, and the retainer tiers. By placing an order or
          submitting a brief, you agree to them.
        </p>

        <section className={styles.docSection}>
          <h2>1. What the service is</h2>
          <p>
            Creatrbase produces research on creators — modelled estimates, delivery confidence
            figures, risk registers, and a verdict — to help an agency decide who to work with. The
            service replaces the research portion of the work, not the judgement of the people who
            commission it. Every figure we provide is a modelled estimate carrying a stated error
            band, and every finding is set out with the evidence and the method behind it. We do not
            promise campaign outcomes; we set out what we checked, how we checked it, and what we
            found.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>2. Your brief and your data</h2>
          <p>
            You are responsible for the accuracy of the brief you submit and for having the right to
            share any information in it. We process the brief to prepare the dossiers you have
            requested, as described in our Privacy Notice.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>3. The free run</h2>
          <p>
            The free run is one real brief per organisation, run through the full pipeline, returning
            five creators at complete dossier quality. Eligibility is one free run per organisation,
            identified by email domain, and a business email address is required. Where several
            agencies share a domain, we maintain a manual list to keep the rule fair; contact us if
            this affects you. A second free-run request from the same organisation is offered the
            Vetting Batch instead.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>4. Delivery</h2>
          <p>
            For the free run and the Full Brief, we deliver within 48 hours of an accepted brief. Every
            dossier is read by a person before it is released to you. Where a brief raises a question
            we cannot resolve on our own, we pause the clock and send you the questions in a single
            email before continuing.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>5. Fees and payment</h2>
          <p>
            Prices are those shown on the agencies page at the time of your order. One-off services are
            paid up front through the payment links provided. Retainers are billed monthly. Invoicing
            is available on request for retainers.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>6. Calibration and aggregate use</h2>
          <p>
            Creatrbase retains campaign outcome data supplied by clients and uses it in anonymised,
            aggregated form to calibrate its scoring models and publish aggregate benchmarks. No
            client, campaign, brand or creator is identifiable in any aggregate use. A client may opt
            out of aggregate use in writing without affecting service.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>7. Independence</h2>
          <p className={styles.independence}>
            A creator’s purchase of any Creatrbase product never influences an agency-side vetting
            outcome. One engine serves both sides of the table, and there is no pay-to-play.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>8. Limits on our responsibility</h2>
          <p>
            The research we provide is a considered, evidence-led estimate, not a statement of
            certainty, and you remain responsible for your own commissioning decisions. To the extent
            the law allows, our liability arising from the service is limited to the fees you paid for
            the piece of work in question. Nothing in these terms limits any liability that cannot
            lawfully be limited.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>9. Changes to these terms</h2>
          <p>
            We may update these terms from time to time. The version in force is the one published at
            the time of your order.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>10. Governing law</h2>
          <p>
            These terms are governed by the law of England and Wales, and the courts of England and
            Wales have jurisdiction over any dispute.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>11. Contact</h2>
          <p>{entityAndContact()}</p>
        </section>

        <p className={styles.docFine}>
          This draft is provided for review. It is not legal advice. A professional review pass is
          recommended before the terms are published or relied upon for any paid engagement. The
          calibration clause in section 6 is reproduced exactly as drafted in the intake and funnel
          specification and is intended for such review.
        </p>
      </article>

      <AgenciesFooter />
    </div>
  );
}
