import { useState, useEffect } from 'react';
import styles from './OnboardingWizard.module.css';

const STORAGE_KEY = 'cb_tour_v1_done';

// ─── Screen content ───────────────────────────────────────────────────────────

const SCREENS = [
  {
    id: 'welcome',
    eyebrow: 'Getting started',
    heading: 'Your commercial HQ.',
    body: 'Creatrbase tracks your channel metrics, calculates how brand-ready you are, and tells you exactly what to do to grow your deal pipeline — week by week.',
    content: <WelcomeContent />,
  },
  {
    id: 'score',
    eyebrow: 'Your score',
    heading: 'Know exactly where you stand.',
    body: 'Your score is recalculated after every sync. Each tier unlocks new capabilities — from gifting to paid integrations to full rate negotiation.',
    content: <ScoreContent />,
  },
  {
    id: 'loop',
    eyebrow: 'Your action plan',
    heading: 'One task. Every week.',
    body: 'After every sync we generate a prioritised task targeting your top constraint. Complete it. Resync. Watch your score move.',
    content: <LoopContent />,
  },
  {
    id: 'toolkit',
    eyebrow: 'Your tools',
    heading: "Everything else is already here.",
    body: null,
    content: <ToolkitContent />,
  },
];

// ─── Sub-content components ───────────────────────────────────────────────────

function WelcomeContent() {
  const points = [
    { icon: '📊', label: 'Sync your YouTube & Twitch metrics automatically' },
    { icon: '🎯', label: 'Calculate your commercial viability score (0–100)' },
    { icon: '📋', label: 'Get a weekly task targeting your exact top constraint' },
    { icon: '🤝', label: 'Track brand deals and get nudges to follow up' },
  ];
  return (
    <div className={styles.welcomePoints}>
      {points.map(p => (
        <div key={p.label} className={styles.welcomePoint}>
          <span className={styles.welcomeIcon}>{p.icon}</span>
          <span className={styles.welcomePointText}>{p.label}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreContent() {
  const tiers = [
    { range: '0–24',   label: 'D tier', desc: 'Building foundations',         color: '#7B7A8E' },
    { range: '25–49',  label: 'C tier', desc: 'Giftable, early outreach',      color: '#FFBFA3' },
    { range: '50–74',  label: 'B tier', desc: 'Paid integrations, negotiate',  color: '#9EFFD8' },
    { range: '75–100', label: 'A tier', desc: 'Top-tier brand appeal',         color: '#D1B9FF' },
  ];
  return (
    <div className={styles.tierList}>
      {tiers.map(t => (
        <div key={t.label} className={styles.tierRow}>
          <div className={styles.tierLeft}>
            <span className={styles.tierDot} style={{ background: t.color }} />
            <span className={styles.tierLabel} style={{ color: t.color }}>{t.label}</span>
          </div>
          <span className={styles.tierRange}>{t.range}</span>
          <span className={styles.tierDesc}>{t.desc}</span>
        </div>
      ))}
    </div>
  );
}

function LoopContent() {
  const steps = ['Sync', 'Score', 'Task', 'Complete', 'Improve'];
  return (
    <div className={styles.loopRow}>
      {steps.map((s, i) => (
        <div key={s} className={styles.loopItem}>
          <div className={styles.loopPill}>{s}</div>
          {i < steps.length - 1 && <span className={styles.loopArrow}>→</span>}
        </div>
      ))}
    </div>
  );
}

function ToolkitContent() {
  const tools = [
    {
      label: 'Gap Tracker',
      path:  '/gap',
      desc:  'See exactly what metrics are holding your score back and by how much.',
    },
    {
      label: 'Brand Outreach',
      path:  '/outreach',
      desc:  'Browse brands by niche, check their minimum thresholds, add them to your pipeline.',
    },
    {
      label: 'Weekly Tasks',
      path:  '/tasks',
      desc:  'AI-generated tasks targeting your top constraint, plus recurring maintenance actions.',
    },
    {
      label: 'Negotiations',
      path:  '/negotiations',
      desc:  'Log every deal you start. Get nudged if a conversation goes quiet.',
    },
  ];
  return (
    <div className={styles.toolList}>
      {tools.map(t => (
        <div key={t.label} className={styles.toolRow}>
          <p className={styles.toolLabel}>{t.label}</p>
          <p className={styles.toolDesc}>{t.desc}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const [open, setOpen]   = useState(false);
  const [step, setStep]   = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  }

  function next() {
    if (step < SCREENS.length - 1) setStep(s => s + 1);
    else dismiss();
  }

  function back() {
    if (step > 0) setStep(s => s - 1);
  }

  if (!open) return null;

  const screen = SCREENS[step];
  const isLast = step === SCREENS.length - 1;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && dismiss()}>
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={dismiss} aria-label="Close tour">✕</button>

        <div className={styles.screenContent}>
          <p className={styles.eyebrow}>{screen.eyebrow}</p>
          <h2 className={styles.heading}>{screen.heading}</h2>
          {screen.body && <p className={styles.body}>{screen.body}</p>}
          <div className={styles.contentArea}>
            {screen.content}
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.dots}>
            {SCREENS.map((_, i) => (
              <button
                key={i}
                className={`${styles.dot} ${i === step ? styles.dotActive : ''}`}
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>
          <div className={styles.footerActions}>
            {step > 0 && (
              <button className={styles.backBtn} onClick={back}>Back</button>
            )}
            <button className={styles.nextBtn} onClick={next}>
              {isLast ? 'Go to dashboard →' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
