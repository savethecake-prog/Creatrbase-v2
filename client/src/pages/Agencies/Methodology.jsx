import { Link } from 'react-router-dom';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import { AgenciesNav, AgenciesFooter } from './AgenciesChrome';
import { WHY_THIS_EXISTS, METHODOLOGY_FAQ } from './config';
import styles from './Agencies.module.css';

// FAQPage JSON-LD (CB-KD-05 s.6). Built from the same METHODOLOGY_FAQ the page renders,
// so the structured data and the visible answers cannot drift.
const FAQ_JSONLD = {
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: METHODOLOGY_FAQ.map((f) => ({
    '@type': 'Question', name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

/**
 * /agencies/methodology — the brochure (CB-KD-05 s.2). Plain-language: what is checked,
 * how scoring works, what the confidence tiers mean, verdict logic. Written to be read by
 * a founder in three minutes and by an AI assistant answering "what is Creatrbase":
 * clear entity definition, structured headings, no marketing fog (CB-KD-05 s.6). Includes
 * the independence statement verbatim (CB-KD-01 s.10).
 */
export function Methodology() {
  return (
    <div className={styles.page}>
      <PageMeta
        title="How Creatrbase vets creators — methodology"
        description="What Creatrbase checks, how scoring works, what the confidence tiers mean, and how verdicts are reached. Plain-language, on the record."
        canonical="https://creatrbase.com/agencies/methodology"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }} />
      <AgenciesNav />

      <article className={styles.doc}>
        <header className={styles.docHeader}>
          <h1 className={styles.docTitle}>How Creatrbase vets creators</h1>
          <p className={styles.docSub}>
            The method, in plain language. What we check, how we score, what the confidence marks
            mean, and how a verdict is reached.
          </p>
        </header>

        <section className={styles.docSection}>
          <h2>What Creatrbase is</h2>
          <p>
            Creatrbase is an independent creator-vetting service for agencies. You bring a brief or a
            list of creators; we produce research on each one — modelled estimates, delivery
            confidence figures, a risk register, and a verdict — so you can decide who to work with.
            The service replaces the research portion of the work, not the judgement of the people
            who commission it. Every figure is a modelled estimate carrying a stated error band, and
            every finding is set out with the evidence and the method behind it. We do not promise
            campaign outcomes; we set out what we checked, how we checked it, and what we found.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>Why this exists</h2>
          {/* WHY excerpt — first two paragraphs of config.WHY_THIS_EXISTS, VERBATIM. */}
          <p>{WHY_THIS_EXISTS[0]}</p>
          <p>{WHY_THIS_EXISTS[1]}</p>
        </section>

        <section className={styles.docSection}>
          <h2>What we check</h2>
          <p>For each creator, the dossier covers:</p>
          <ul className={styles.docList}>
            <li><strong>Attested metrics.</strong> Audience size, true reach, median views, engagement rate and posting cadence — each with its source and the date it was read.</li>
            <li><strong>Engagement quality.</strong> Whether the engagement is consistent with the audience size, and how it holds across recent output.</li>
            <li><strong>Audience composition.</strong> Where the audience is, and how much of it overlaps with your existing reach, which drives the overlap discount.</li>
            <li><strong>Risk register.</strong> A content-history scan against your stated sensitivities, plus a platform-standing check. Findings are evidence-first: severity, the evidence with dates, the method, and the quantified effect.</li>
          </ul>
          <p>
            Where a figure could not be obtained, the dossier says so plainly and names the reason —
            never a blank, never an invented value. Absence of findings is expressed as what was
            checked and found clear.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>How scoring works</h2>
          <p>
            Expected delivery is modelled against the targets in your brief and expressed as a range
            with a central estimate, not a single number. From that we derive a <strong>hit
            probability</strong> — the modelled probability that a creator clears your target — which
            always carries an error band. The working sits beneath each derived figure: the inputs,
            the named derivations, their confidences, and the two or three heaviest assumptions. You
            can see how every number was reached.
          </p>
          <p>
            The <strong>acceptance line</strong> is the probability at or above which we mark a
            creator as clearing your target. It defaults to 75% and is adjustable per brief. On the
            shortlist cover, the line is drawn visibly across the ranked creators; where fewer clear
            it than your brief asked for, the shortfall is stated in words on the cover, never hidden.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>What the confidence tiers mean</h2>
          <p>Every figure carries one of three confidence marks, with its source and date adjacent:</p>
          <ul className={styles.docList}>
            <li><strong>High confidence</strong> speaks plainly — the figure is well-sourced and we state it directly.</li>
            <li><strong>Medium confidence</strong> is directional, and we show the basis for it.</li>
            <li><strong>Low confidence</strong> is explicitly an estimate. Low confidence looks honest, not dangerous; it tells you where to press, not that the figure is worthless.</li>
          </ul>
        </section>

        <section className={styles.docSection}>
          <h2>How a verdict is reached</h2>
          <p>Each dossier ends with one of three verdicts, with the reasoning immediately beneath it:</p>
          <ul className={styles.docList}>
            <li><strong>Proceed.</strong> The creator clears the brief and the risk register is clean or minor.</li>
            <li><strong>Proceed with cautions.</strong> The creator is workable, but there are findings you should brief around; the cautions are named with their quantified effect.</li>
            <li><strong>Do not proceed.</strong> A finding or a shortfall makes the creator a poor fit for this brief; the reason is stated.</li>
          </ul>
        </section>

        <section className={styles.docSection}>
          <h2>Independence</h2>
          <p className={styles.independence}>
            A creator’s purchase of any Creatrbase product never influences an agency-side vetting
            outcome. One engine, two sides of the table, no pay-to-play.
          </p>
        </section>

        <section className={styles.docSection}>
          <h2>Questions agencies ask</h2>
          {METHODOLOGY_FAQ.map((f) => (
            <div key={f.q} className={styles.docFaq}>
              <h3 className={styles.docFaqQ}>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </section>

        <section className={styles.docSection}>
          <h2>See it for yourself</h2>
          <p>
            The clearest account of the method is a dossier. Read the{' '}
            <Link to="/agencies/sample">sample dossier</Link>, or{' '}
            <Link to="/agencies/brief">bring us a brief</Link> and see five real ones inside 48 hours.
          </p>
        </section>
      </article>

      <AgenciesFooter />
    </div>
  );
}
