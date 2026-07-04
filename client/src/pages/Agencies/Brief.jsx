import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import { AgenciesNav } from './AgenciesChrome';
import { formApi } from './formApi';
import { SAMPLE_DOSSIER_URL, TURNSTILE_SITE_KEY } from './config';
import styles from './Brief.module.css';

/**
 * /agencies/brief — the stepped conversational intake form (CB-KD-04 s.2; UI per
 * CB-KD-05 s.7 thumb-zone binding). The 9-step map is the service's validation.js, the
 * single source of truth (fork at step 1 pure taps; work email at step 2 -> magic link).
 * One question group per screen, second person, acknowledges the previous answer, visible
 * step count, back navigation, optional fields skippable. Three true interstitials
 * (pool preview, what-happens-next, modelling beat). Honeypot + env-guarded Turnstile.
 */

const FORK_OPTIONS = [
  { value: 'full_brief', label: 'I have a brief and need creators', hint: 'We source, filter and vet against your brief.' },
  { value: 'vetting_batch', label: 'I have a list that needs vetting', hint: 'You supply the creators; we supply the judgement.' },
  { value: 'score', label: 'I have a list that needs scoring', hint: 'A ranked scoresheet against your metrics. Scored, not vetted.' },
];
const PLATFORMS = ['youtube', 'instagram', 'tiktok', 'twitch', 'x'];
const BANDS = ['nano', 'micro', 'mid', 'macro', 'mega'];
const AUDIENCE = [
  { value: 'new_audiences', label: 'New audiences' },
  { value: 'existing_community', label: 'Existing community' },
  { value: 'mixed', label: 'Mixed' },
];
const SENSITIVITY_TOGGLES = ['gambling', 'alcohol', 'politics', 'competitor history'];
const TOTAL_STEPS = 9;

// Interstitials are placed AFTER a step's write: after platforms (5) -> pool preview;
// before the email step is naturally at the start, so what-happens-next shows before
// step 2; after targets (6) -> the modelling beat.

export function Brief() {
  const [params] = useSearchParams();
  const [phase, setPhase] = useState('form');   // 'form' | 'interstitial' | 'done'
  const [interstitial, setInterstitial] = useState(null);
  const [step, setStep] = useState(1);
  const [draftId, setDraftId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [magicToken, setMagicToken] = useState(null);
  const [pool, setPool] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [result, setResult] = useState(null);

  // Resume from a magic link (?resume=<token>).
  useEffect(() => {
    const token = params.get('resume');
    if (!token) return;
    setBusy(true);
    formApi.resume(token)
      .then((r) => {
        setDraftId(r.draft_id);
        setAnswers({ fork_choice: r.fork_choice, ...(r.data || {}) });
        setStep(Math.min(r.step + 1, TOTAL_STEPS));
      })
      .catch(() => setError('That resume link is invalid or has expired. You can start again below.'))
      .finally(() => setBusy(false));
  }, [params]);

  const set = (key, value) => setAnswers((a) => ({ ...a, [key]: value }));

  const goBack = () => {
    setError(null);
    if (phase === 'interstitial') { setPhase('form'); return; }
    setStep((s) => Math.max(1, s - 1));
  };

  // Advance from the current step: write it, then either show an interstitial or move on.
  const advance = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      if (step === 1) {
        // create the draft (fork + agency name). Honeypot + Turnstile ride here.
        const r = await formApi.createDraft(
          { fork_choice: answers.fork_choice, agency_name: answers.agency_name },
          { company_website: honeypot, turnstile_token: answers.turnstile_token },
        );
        if (!r.draft_id) { setError('Something went wrong. Please try again.'); setBusy(false); return; }
        setDraftId(r.draft_id);
        // what-happens-next beat before the email step (step 2).
        setInterstitial('what_next');
        setPhase('interstitial');
        setBusy(false);
        return;
      }

      const stepAnswers = stepPayload(step, answers);
      const r = await formApi.patchDraft(draftId, step, stepAnswers, { company_website: honeypot });
      if (r.magic_token) setMagicToken(r.magic_token);

      if (step === 5) {
        // pool preview interstitial from the live endpoint.
        try {
          const p = await formApi.poolPreview(answers.platforms_counts || []);
          setPool(p);
        } catch {
          setPool({ error: true });
        }
        setInterstitial('pool');
        setPhase('interstitial');
      } else if (step === 6) {
        setInterstitial('modelling');
        setPhase('interstitial');
      } else {
        setStep((s) => s + 1);
      }
    } catch (e) {
      setError(firstDetail(e) || 'Please check the highlighted answer and try again.');
    } finally {
      setBusy(false);
    }
  }, [step, answers, draftId, honeypot]);

  const continueFromInterstitial = () => {
    setPhase('form');
    if (interstitial === 'what_next') setStep(2);
    else setStep((s) => s + 1);
    setInterstitial(null);
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      // write the last step, then submit the full record.
      await formApi.patchDraft(draftId, step, stepPayload(step, answers), { company_website: honeypot });
      const r = await formApi.submit(draftId, {
        company_website: honeypot,
        turnstile_token: answers.turnstile_token,
      });
      setResult(r);
      setPhase('done');
    } catch (e) {
      setError(firstDetail(e) || 'Please check your answers and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'done') {
    return <Confirmation result={result} answers={answers} pool={pool} />;
  }

  return (
    <div className={styles.page}>
      <PageMeta title="Start a brief — Creatrbase for agencies" noIndex
        canonical="https://creatrbase.com/agencies/brief" />
      <AgenciesNav />

      <main className={styles.formMain}>
        {/* honeypot: hidden from real users, catches bots */}
        <input
          type="text" name="company_website" tabIndex={-1} autoComplete="off"
          className={styles.honeypot} aria-hidden="true"
          value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
        />

        {phase === 'interstitial' ? (
          <Interstitial kind={interstitial} pool={pool} answers={answers} onContinue={continueFromInterstitial} onBack={goBack} busy={busy} />
        ) : (
          <>
            <div className={styles.progress}>
              <span className={styles.stepCount}>Step {step} of {TOTAL_STEPS}</span>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
              </div>
            </div>

            <div className={styles.question}>
              <StepFields step={step} answers={answers} set={set} />
            </div>

            <p className={styles.assurance}>{assuranceFor(step)}</p>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              {step > 1 && (
                <button type="button" className={styles.back} onClick={goBack} disabled={busy}>
                  Back
                </button>
              )}
              {step < TOTAL_STEPS ? (
                <button type="button" className={styles.primary} onClick={advance} disabled={busy || !stepReady(step, answers)}>
                  {busy ? 'Saving…' : 'Continue'}
                </button>
              ) : (
                <button type="button" className={styles.primary} onClick={submit} disabled={busy || !stepReady(step, answers)}>
                  {busy ? 'Submitting…' : 'Submit brief'}
                </button>
              )}
            </div>

            {magicToken && step >= 2 && (
              <p className={styles.savedNote}>
                Saved. If you leave, the link we emailed you brings you back to this point.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ── per-step question fields ──────────────────────────────────────────────────
function StepFields({ step, answers, set }) {
  const ack = (text) => <p className={styles.ack}>{text}</p>;

  switch (step) {
    case 1:
      return (
        <>
          <h1 className={styles.qTitle}>What do you need?</h1>
          <p className={styles.qHint}>One tap. We route the rest for you.</p>
          <div className={styles.taps}>
            {FORK_OPTIONS.map((o) => (
              <button key={o.value} type="button"
                className={`${styles.tap} ${answers.fork_choice === o.value ? styles.tapActive : ''}`}
                onClick={() => set('fork_choice', o.value)}>
                <span className={styles.tapLabel}>{o.label}</span>
                <span className={styles.tapHint}>{o.hint}</span>
              </button>
            ))}
          </div>
          <label className={styles.field}>
            <span className={styles.label}>Your agency name</span>
            <input className={styles.input} value={answers.agency_name || ''}
              onChange={(e) => set('agency_name', e.target.value)} placeholder="e.g. Northlight Talent" />
          </label>
        </>
      );
    case 2:
      return (
        <>
          {answers.agency_name && ack(`Thanks, ${answers.agency_name}.`)}
          <h1 className={styles.qTitle}>What’s your work email?</h1>
          <p className={styles.qHint}>We email your dossiers here, and a link so you can step away and come back.</p>
          <label className={styles.field}>
            <span className={styles.label}>Work email</span>
            <input type="email" className={styles.input} value={answers.work_email || ''}
              onChange={(e) => set('work_email', e.target.value)} placeholder="you@agency.com" />
          </label>
        </>
      );
    case 3:
      return (
        <>
          <h1 className={styles.qTitle}>Who are we speaking with?</h1>
          <p className={styles.qHint}>Your name and role. It personalises the delivery.</p>
          <label className={styles.field}>
            <span className={styles.label}>Your name and role</span>
            <input className={styles.input} value={answers.contact_name_role || ''}
              onChange={(e) => set('contact_name_role', e.target.value)} placeholder="e.g. Priya Shah, Head of Talent" />
          </label>
        </>
      );
    case 4:
      return (
        <>
          <h1 className={styles.qTitle}>Your campaign, in one line.</h1>
          <p className={styles.qHint}>Context for every judgement we make. Forcing it into a line forces the clarity.</p>
          <label className={styles.field}>
            <span className={styles.label}>Campaign in one line</span>
            <input className={styles.input} maxLength={140} value={answers.campaign_one_liner || ''}
              onChange={(e) => set('campaign_one_liner', e.target.value)}
              placeholder="e.g. Family-friendly gaming launch, UK, autumn" />
            <span className={styles.counter}>{(answers.campaign_one_liner || '').length}/140</span>
          </label>
        </>
      );
    case 5:
      return <PlatformsField answers={answers} set={set} />;
    case 6:
      return <MetricsField answers={answers} set={set} />;
    case 7:
      return (
        <>
          <h1 className={styles.qTitle}>Where should the audience come from?</h1>
          <div className={styles.taps}>
            {AUDIENCE.map((o) => (
              <button key={o.value} type="button"
                className={`${styles.tap} ${audienceChoice(answers) === o.value ? styles.tapActive : ''}`}
                onClick={() => set('audience_requirement', { choice: o.value, note: audienceNote(answers) })}>
                <span className={styles.tapLabel}>{o.label}</span>
              </button>
            ))}
          </div>
          <label className={styles.field}>
            <span className={styles.label}>Acceptance line <span className={styles.optional}>optional</span></span>
            <input type="number" min={0} max={100} className={styles.input}
              value={answers.acceptance_line ?? ''} placeholder="75"
              onChange={(e) => set('acceptance_line', e.target.value)} />
            <span className={styles.help}>The modelled probability at or above which we mark a creator as clearing your target. Leave blank for the 75% default.</span>
          </label>
        </>
      );
    case 8:
      return <SensitivitiesField answers={answers} set={set} />;
    case 9:
      return (
        <>
          <h1 className={styles.qTitle}>When does this run?</h1>
          <p className={styles.qHint}>Scheduling context. Your shortlist arrives in 48 hours regardless.</p>
          <label className={styles.field}>
            <span className={styles.label}>Timeframe</span>
            <input className={styles.input} value={answers.timeframe || ''}
              onChange={(e) => set('timeframe', e.target.value)} placeholder="e.g. October–November 2026" />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Anything else <span className={styles.optional}>optional</span></span>
            <textarea className={styles.textarea} rows={3} value={answers.anything_else || ''}
              onChange={(e) => set('anything_else', e.target.value)}
              placeholder="Anything that would change our judgement. Unclear points become questions, never guesses." />
          </label>
        </>
      );
    default:
      return null;
  }
}

function PlatformsField({ answers, set }) {
  const rows = answers.platforms_counts || [{ platform: 'youtube', count: '', band: '' }];
  const update = (i, patch) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    set('platforms_counts', next);
  };
  const add = () => set('platforms_counts', [...rows, { platform: 'youtube', count: '', band: '' }]);
  const remove = (i) => set('platforms_counts', rows.filter((_, idx) => idx !== i));
  return (
    <>
      <h1 className={styles.qTitle}>Which platforms, and how big?</h1>
      <p className={styles.qHint}>Add a row per platform. The band is optional — followers, subscribers or concurrents as the platform dictates.</p>
      {rows.map((r, i) => (
        <div key={i} className={styles.row}>
          <select className={styles.select} value={r.platform} onChange={(e) => update(i, { platform: e.target.value })}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input className={styles.input} type="number" min={0} placeholder="count"
            value={r.count} onChange={(e) => update(i, { count: e.target.value })} />
          <select className={styles.select} value={r.band || ''} onChange={(e) => update(i, { band: e.target.value })}>
            <option value="">band (optional)</option>
            {BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          {rows.length > 1 && <button type="button" className={styles.rowRemove} onClick={() => remove(i)}>×</button>}
        </div>
      ))}
      <button type="button" className={styles.addRow} onClick={add}>+ Add a platform</button>
    </>
  );
}

function MetricsField({ answers, set }) {
  const rows = answers.success_metrics || [{ metric: '', value: '', target_type: 'floor' }];
  const update = (i, patch) => set('success_metrics', rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = () => set('success_metrics', [...rows, { metric: '', value: '', target_type: 'floor' }]);
  const remove = (i) => set('success_metrics', rows.filter((_, idx) => idx !== i));
  return (
    <>
      <h1 className={styles.qTitle}>What does success look like?</h1>
      <p className={styles.qHint}>A floor is what the campaign must hit; a stretch is what you hope for.</p>
      {rows.map((r, i) => (
        <div key={i} className={styles.row}>
          <input className={styles.input} placeholder="metric (e.g. avg views)" value={r.metric}
            onChange={(e) => update(i, { metric: e.target.value })} />
          <input className={styles.input} placeholder="value" value={r.value}
            onChange={(e) => update(i, { value: e.target.value })} />
          <select className={styles.select} value={r.target_type}
            onChange={(e) => update(i, { target_type: e.target.value })}>
            <option value="floor">floor</option>
            <option value="stretch">stretch</option>
          </select>
          {rows.length > 1 && <button type="button" className={styles.rowRemove} onClick={() => remove(i)}>×</button>}
        </div>
      ))}
      <button type="button" className={styles.addRow} onClick={add}>+ Add a metric</button>
    </>
  );
}

function SensitivitiesField({ answers, set }) {
  const s = answers.sensitivities || { text: '', toggles: [] };
  const toggle = (t) => {
    const has = (s.toggles || []).includes(t);
    set('sensitivities', { ...s, toggles: has ? s.toggles.filter((x) => x !== t) : [...(s.toggles || []), t] });
  };
  return (
    <>
      <h1 className={styles.qTitle}>Any brand sensitivities?</h1>
      <p className={styles.qHint}>What must a creator not be near? We capture this verbatim.</p>
      <div className={styles.toggles}>
        {SENSITIVITY_TOGGLES.map((t) => (
          <button key={t} type="button"
            className={`${styles.toggleChip} ${(s.toggles || []).includes(t) ? styles.toggleActive : ''}`}
            onClick={() => toggle(t)}>{t}</button>
        ))}
      </div>
      <label className={styles.field}>
        <span className={styles.label}>In your own words</span>
        <textarea className={styles.textarea} rows={3} value={s.text || ''}
          onChange={(e) => set('sensitivities', { ...s, text: e.target.value })}
          placeholder="e.g. no gambling adjacency; family-safe language throughout" />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Hard exclusions <span className={styles.optional}>optional</span></span>
        <textarea className={styles.textarea} rows={2} value={answers.hard_exclusions || ''}
          onChange={(e) => set('hard_exclusions', e.target.value)}
          placeholder="Named creators or attributes never to be shortlisted." />
      </label>
    </>
  );
}

// ── interstitials — every one states something true (CB-KD-04 s.2.1) ──────────
function Interstitial({ kind, pool, answers, onContinue, onBack, busy }) {
  let body;
  if (kind === 'pool') body = <PoolBody pool={pool} />;
  else if (kind === 'what_next') body = (
    <>
      <h1 className={styles.qTitle}>Here’s what you get.</h1>
      <p className={styles.interLede}>Five full dossiers, inside 48 hours. A person reviews every dossier before it reaches you. No drip sequence — one delivery email, and the door stays open if you want more.</p>
    </>
  );
  else body = (
    <>
      <h1 className={styles.qTitle}>We’re modelling against your targets.</h1>
      <p className={styles.interLede}>
        Your metrics{metricSummary(answers)} become the line we score each creator against: expected
        delivery as a range, and a hit probability with its error band. Not a promise — a modelled
        estimate you can interrogate.
      </p>
    </>
  );
  return (
    <div className={styles.interstitial}>
      {body}
      <div className={styles.actions}>
        <button type="button" className={styles.back} onClick={onBack} disabled={busy}>Back</button>
        <button type="button" className={styles.primary} onClick={onContinue} disabled={busy}>Continue</button>
      </div>
    </div>
  );
}

function PoolBody({ pool }) {
  if (!pool || pool.error) {
    return (
      <>
        <h1 className={styles.qTitle}>Your mix is in.</h1>
        <p className={styles.interLede}>We’ll size the discovery pool against your platforms when we run the brief.</p>
      </>
    );
  }
  const range = pool.range;
  const figure = pool.basis === 'cache' && typeof pool.count === 'number'
    ? `about ${pool.count.toLocaleString()} creators`
    : range
      ? `roughly ${range.low.toLocaleString()}–${range.high.toLocaleString()} creators`
      : 'a live discovery pool';
  return (
    <>
      <h1 className={styles.qTitle}>Your mix maps to {figure}.</h1>
      <p className={styles.interLede}>
        {pool.note || 'Computed live from our discovery data for the platforms you gave us.'}
      </p>
    </>
  );
}

// ── confirmation — real payoff at submission (CB-KD-04 s.2.2) ─────────────────
function Confirmation({ result, answers, pool }) {
  const gateBlocked = result?.status === 'gate_blocked';
  const poolFigure = pool && pool.basis === 'cache' && typeof pool.count === 'number'
    ? `about ${pool.count.toLocaleString()} creators`
    : pool && pool.range ? `roughly ${pool.range.low.toLocaleString()}–${pool.range.high.toLocaleString()} creators` : null;

  return (
    <div className={styles.page}>
      <PageMeta title="Brief received — Creatrbase for agencies" noIndex />
      <AgenciesNav />
      <main className={styles.formMain}>
        <div className={styles.confirm}>
          {gateBlocked ? (
            <>
              <h1 className={styles.qTitle}>Your organisation has already had its free run.</h1>
              <p className={styles.interLede}>{result.message}</p>
              <Link to="/agencies#pricing" className={styles.primary}>See the Vetting Batch</Link>
            </>
          ) : (
            <>
              <h1 className={styles.qTitle}>Brief received. The clock starts now.</h1>
              {answers.campaign_one_liner && (
                <p className={styles.confirmLine}>“{answers.campaign_one_liner}”</p>
              )}
              <ul className={styles.confirmList}>
                <li>Five full dossiers, ranked by modelled hit probability, inside 48 hours.</li>
                <li>A person reviews every dossier before it is released to you.</li>
                {poolFigure && <li>Your mix maps to a discovery pool of {poolFigure}.</li>}
              </ul>
              <p className={styles.interLede}>
                While you wait, this is exactly what each dossier looks like:{' '}
                <a href={SAMPLE_DOSSIER_URL} target="_blank" rel="noopener noreferrer">the sample dossier</a>.
              </p>
              <div className={styles.actions}>
                <a href={SAMPLE_DOSSIER_URL} className={styles.primary} target="_blank" rel="noopener noreferrer">Open the sample</a>
              </div>
            </>
          )}
          <p className={styles.privacyNote}>
            We process your brief to prepare your dossiers. See the{' '}
            <Link to="/agencies/privacy">privacy notice</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function stepPayload(step, a) {
  switch (step) {
    case 2: return { work_email: a.work_email };
    case 3: return { contact_name_role: a.contact_name_role };
    case 4: return { campaign_one_liner: a.campaign_one_liner };
    case 5: return { platforms_counts: cleanPlatforms(a.platforms_counts) };
    case 6: return { success_metrics: cleanMetrics(a.success_metrics) };
    case 7: return {
      audience_requirement: a.audience_requirement,
      ...(a.acceptance_line !== '' && a.acceptance_line != null ? { acceptance_line: Number(a.acceptance_line) } : {}),
    };
    case 8: return { sensitivities: a.sensitivities, ...(a.hard_exclusions ? { hard_exclusions: a.hard_exclusions } : {}) };
    case 9: return { timeframe: a.timeframe, ...(a.anything_else ? { anything_else: a.anything_else } : {}) };
    default: return {};
  }
}

function cleanPlatforms(rows) {
  return (rows || [])
    .filter((r) => r.platform && r.count !== '' && r.count != null)
    .map((r) => ({ platform: r.platform, count: Number(r.count), ...(r.band ? { band: r.band } : {}) }));
}
function cleanMetrics(rows) {
  return (rows || [])
    .filter((r) => r.metric && r.value !== '' && r.value != null)
    .map((r) => ({ metric: r.metric, value: r.value, target_type: r.target_type || 'floor' }));
}

function stepReady(step, a) {
  switch (step) {
    case 1: return Boolean(a.fork_choice && a.agency_name?.trim());
    case 2: return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.work_email || '');
    case 3: return Boolean(a.contact_name_role?.trim());
    case 4: return Boolean(a.campaign_one_liner?.trim());
    case 5: return cleanPlatforms(a.platforms_counts).length > 0;
    case 6: return cleanMetrics(a.success_metrics).length > 0;
    case 7: return Boolean(audienceChoice(a));
    case 8: {
      const s = a.sensitivities;
      return Boolean((s?.text && s.text.trim()) || (s?.toggles && s.toggles.length));
    }
    case 9: return Boolean(a.timeframe?.trim());
    default: return true;
  }
}

function audienceChoice(a) {
  const v = a.audience_requirement;
  return typeof v === 'object' && v !== null ? v.choice : v;
}
function audienceNote(a) {
  const v = a.audience_requirement;
  return typeof v === 'object' && v !== null ? v.note : undefined;
}

function assuranceFor(step) {
  const map = {
    1: 'One question at a time. You can go back at any point.',
    2: 'We use this to send your dossiers and a save-and-resume link — nothing else.',
    3: 'This personalises your delivery. It never leaves the brief.',
    4: 'Every judgement we make traces back to this line.',
    5: 'The band is optional; skip it if you’re not sure.',
    6: 'Floor or stretch — one sentence of helper text explains the difference above.',
    7: 'Leave the acceptance line blank if you’re unsure; 75% is a sound default.',
    8: 'Captured verbatim. Anything unclear becomes a question to you, never a guess.',
    9: 'Almost there. Your shortlist arrives within 48 hours of an accepted brief.',
  };
  return map[step] || '';
}

function metricSummary(a) {
  const rows = cleanMetrics(a.success_metrics);
  if (!rows.length) return '';
  const first = rows[0];
  return ` (${first.metric}: ${first.value}${rows.length > 1 ? `, +${rows.length - 1} more` : ''})`;
}

function firstDetail(e) {
  const d = e?.data?.details;
  return Array.isArray(d) && d.length ? d[0] : null;
}

// Turnstile note: TURNSTILE_SITE_KEY (config.js) is empty at launch, so no widget renders.
// When the owner sets it, render the widget in the step-one/submit flow and feed
// answers.turnstile_token before advance()/submit(); the service verifies it (env-guarded
// turnstile.verify). Referenced here so the config import stays live until then.
void TURNSTILE_SITE_KEY;
