import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';
import logoMonogram from '../../assets/logo-monogram.svg';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import styles from './Onboarding.module.css';

// ── Progress step definitions ─────────────────────────────────────────────────

const PROGRESS_STEPS = [
  { id: 'metrics',  label: 'Fetching your channel metrics' },
  { id: 'niche',    label: 'Analysing your content niche' },
  { id: 'score',    label: 'Calculating your commercial score' },
];

// ── Onboarding ────────────────────────────────────────────────────────────────

export function Onboarding() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const firstName = user?.displayName?.split(' ')[0] ?? 'there';

  // 'connect' | 'processing' | 'done'
  const [step, setStep]           = useState('connect');
  const [stepsDone, setStepsDone] = useState(new Set());
  const [activeStep, setActiveStep] = useState(null);
  const pollRef                   = useRef(null);

  // On mount: check if platform already connected (returning to this page after OAuth)
  useEffect(() => {
    api.get('/connect/platforms').then(({ platforms }) => {
      const yt = platforms.find(p => p.platform === 'youtube' && p.sync_status !== 'disconnected');
      if (yt) setStep('processing');
    }).catch(() => {});
  }, []);

  // Polling — runs when step === 'processing'
  useEffect(() => {
    if (step !== 'processing') return;

    setActiveStep('metrics');

    async function poll() {
      try {
        const [platforms, nicheRes, scoreRes] = await Promise.allSettled([
          api.get('/connect/platforms'),
          api.get('/creator/niche'),
          api.get('/creator/score'),
        ]);

        const yt = platforms.status === 'fulfilled'
          ? platforms.value.platforms?.find(p => p.platform === 'youtube')
          : null;

        const nicheReady  = nicheRes.status === 'fulfilled' && nicheRes.value.status === 'ready';
        const scoreReady  = scoreRes.status === 'fulfilled' && scoreRes.value.status === 'ready';
        const metricsReady = yt?.subscriber_count != null;

        setStepsDone(prev => {
          const next = new Set(prev);
          if (metricsReady) next.add('metrics');
          if (nicheReady)   next.add('niche');
          if (scoreReady)   next.add('score');
          return next;
        });

        // Drive the "active" indicator forward
        if (!metricsReady)      setActiveStep('metrics');
        else if (!nicheReady)   setActiveStep('niche');
        else if (!scoreReady)   setActiveStep('score');

        if (scoreReady) {
          clearInterval(pollRef.current);
          setActiveStep(null);
          setStep('done');
          // Small pause so user sees all steps checked, then redirect
          setTimeout(() => navigate('/dashboard?welcome=1', { replace: true }), 1200);
        }
      } catch {
        // Non-fatal — keep polling
      }
    }

    poll(); // Immediate first check
    pollRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollRef.current);
  }, [step, navigate]);

  return (
    <div className={styles.page}>
      <PageMeta title="Set up your account" noIndex={true} />
      <div className={styles.logoBar}>
        <img src={logoMonogram} alt="Creatrbase" className={styles.logo} />
      </div>

      <div className={styles.content}>
        {step === 'connect' && (
          <ConnectStep firstName={firstName} />
        )}

        {(step === 'processing' || step === 'done') && (
          <ProcessingStep
            stepsDone={stepsDone}
            activeStep={activeStep}
            done={step === 'done'}
          />
        )}
      </div>
    </div>
  );
}

// ── Connect step ──────────────────────────────────────────────────────────────

function ConnectStep({ firstName }) {
  return (
    <div className={styles.connectWrap}>
      <p className={styles.eyebrow}>Setup · Step 1 of 2</p>
      <h1 className={styles.heading}>Welcome, {firstName}.</h1>
      <p className={styles.subheading}>
        Connect your YouTube channel and we'll calculate your commercial viability score — telling you exactly which brands to approach, when, and why you qualify.
      </p>

      <div className={styles.connectCard}>
        <div className={styles.connectCardHeader}>
          <YoutubeIcon />
          <div>
            <p className={styles.connectCardTitle}>Connect YouTube</p>
            <p className={styles.connectCardDesc}>Read-only access to your analytics and channel data</p>
          </div>
        </div>

        <div className={styles.connectPoints}>
          <ConnectPoint>Your commercial viability score (0–100) and what it means</ConnectPoint>
          <ConnectPoint>Which brands are a match for your size and niche</ConnectPoint>
          <ConnectPoint>Exactly what to fix to unlock more brand deals</ConnectPoint>
          <ConnectPoint>A weekly prioritised task based on your top constraint</ConnectPoint>
        </div>

        <a href="/api/connect/youtube" className={styles.connectBtn}>
          Connect YouTube
        </a>

        <p className={styles.connectSecurity}>
          Read-only access. We never post, upload, or interact with your channel.
        </p>
      </div>

      <a href="/dashboard" className={styles.skipLink}>
        Skip for now — go to dashboard
      </a>
    </div>
  );
}

function ConnectPoint({ children }) {
  return (
    <div className={styles.connectPoint}>
      <span className={styles.connectPointDot} />
      <span>{children}</span>
    </div>
  );
}

// ── Processing step ───────────────────────────────────────────────────────────

function ProcessingStep({ stepsDone, activeStep, done }) {
  return (
    <div className={styles.processingWrap}>
      <p className={styles.eyebrow}>Setup · Step 2 of 2</p>
      <h1 className={styles.heading}>
        {done ? 'Your profile is ready.' : 'Setting up your profile…'}
      </h1>
      <p className={styles.subheading}>
        {done
          ? 'Taking you to your dashboard now.'
          : 'This takes about 30–60 seconds. Hang tight.'}
      </p>

      <div className={styles.progressList}>
        {PROGRESS_STEPS.map(s => {
          const isDone   = stepsDone.has(s.id);
          const isActive = !isDone && activeStep === s.id;
          return (
            <div key={s.id} className={[
              styles.progressItem,
              isDone   ? styles.progressDone   : '',
              isActive ? styles.progressActive : '',
            ].filter(Boolean).join(' ')}>
              <span className={styles.progressIcon}>
                {isDone ? '✓' : isActive ? <SpinnerIcon /> : '·'}
              </span>
              <span className={styles.progressLabel}>{s.label}</span>
            </div>
          );
        })}
      </div>

      {!done && (
        <p className={styles.processingHint}>
          Your data is being fetched and analysed in the background.
        </p>
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function YoutubeIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
      <rect width="28" height="20" rx="4" fill="#FF0000" />
      <path d="M11 14V6l8 4-8 4z" fill="white" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className={styles.spinner} width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="25" strokeDashoffset="8" strokeLinecap="round" />
    </svg>
  );
}
