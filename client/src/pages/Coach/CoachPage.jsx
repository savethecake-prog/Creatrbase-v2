import { useState, useRef, useEffect } from 'react';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { UpgradeGate } from '../../components/UpgradeGate/UpgradeGate';
import { api } from '../../lib/api';
import styles from './CoachPage.module.css';

const STARTERS = [
  'How much is a mid-roll sponsorship worth on my channel right now?',
  'Why did my commercial score change?',
  "What's the one change that would move my score most?",
  'Is the rate I was offered fair?',
  'What would make me more attractive to brands in my niche?',
];

const DATA_SOURCES = {
  get_creator_profile:        'your commercial profile',
  get_niche_benchmarks:       'niche benchmark data',
  get_dimension_history:      'your score history',
  get_active_recommendations: 'your active recommendations',
};

function CitationChip({ toolsUsed }) {
  if (!toolsUsed?.length) return null;
  const labels = toolsUsed.map(t => DATA_SOURCES[t] || t).filter(Boolean);
  if (!labels.length) return null;
  return (
    <div className={styles.citation}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10H7M21 6H3M21 14H3M21 18H7" />
      </svg>
      Cited: {labels.join(', ')}
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`${styles.msgWrap} ${isUser ? styles.msgUser : styles.msgAssistant}`}>
      {!isUser && (
        <div className={styles.avatar}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </div>
      )}
      <div className={styles.bubble}>
        <p className={styles.bubbleText}>{msg.text}</p>
        {msg.toolsUsed && <CitationChip toolsUsed={msg.toolsUsed} />}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className={`${styles.msgWrap} ${styles.msgAssistant}`}>
      <div className={styles.avatar}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      </div>
      <div className={`${styles.bubble} ${styles.thinking}`}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
    </div>
  );
}

export function CoachPage() {
  return (
    <AppLayout>
      <UpgradeGate
        requiredTier="pro"
        feature="Commercial Coach"
        description="Ask your commercial coach anything about rates, brand deals, score changes, or what's blocking you from getting paid. Data-grounded answers, no guessing."
      >
        <CoachChat />
      </UpgradeGate>
    </AppLayout>
  );
}

function CoachChat() {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function ensureSession() {
    if (sessionId) return sessionId;
    const { sessionId: id } = await api.post('/coach/sessions', {});
    setSessionId(id);
    return id;
  }

  async function send(text) {
    if (!text.trim() || loading) return;
    setError('');
    const userMsg = { role: 'user', text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const sid = await ensureSession();
      const result = await api.post(`/coach/sessions/${sid}/message`, { message: text.trim() });
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: result.response,
        toolsUsed: result.toolsUsed,
      }]);
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    send(input);
  }

  const isEmpty = messages.length === 0;

  return (
    <div className={styles.layout} data-messages={messages.length > 0 ? 'true' : undefined}>

      {/* ── Left panel ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarInner}>
          <p className={styles.sidebarEyebrow}>Commercial Coach</p>
          <h2 className={styles.sidebarTitle}>What can I help with?</h2>
          <p className={styles.sidebarCopy}>I answer commercial questions about your channel using your live Creatrbase data. I cannot advise on content strategy or video ideas.</p>
          <div className={styles.starters}>
            {STARTERS.map(s => (
              <button key={s} className={styles.starter} onClick={() => send(s)} disabled={loading}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Chat panel ── */}
      <div className={styles.chat}>
        <div className={styles.messages}>
          {isEmpty && (
            <div className={styles.welcome}>
              <div className={styles.welcomeIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
              <h3 className={styles.welcomeTitle}>Your Commercial Coach</h3>
              <p className={styles.welcomeSub}>Ask me anything about your channel's brand deal potential, rates, or what's holding back your commercial score.</p>
            </div>
          )}
          {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
          {loading && <ThinkingBubble />}
          {error && <p className={styles.errorMsg}>{error}</p>}
          <div ref={bottomRef} />
        </div>

        <form className={styles.inputRow} onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about rates, score changes, brand deal readiness..."
            disabled={loading}
            autoComplete="off"
          />
          <button className={styles.sendBtn} type="submit" disabled={loading || !input.trim()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>

    </div>
  );
}
