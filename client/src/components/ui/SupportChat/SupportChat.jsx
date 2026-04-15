import { useState, useEffect, useRef } from 'react';
import { api } from '../../../lib/api';
import styles from './SupportChat.module.css';

const MAX_LENGTH = 500;

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke="#05040A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <line x1="22" y1="2" x2="11" y2="13" stroke="#05040A" strokeWidth="2.5" strokeLinecap="round"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="#05040A" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

export function SupportChat() {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState(null); // null = not loaded yet
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const messagesEndRef           = useRef(null);
  const inputRef                 = useRef(null);

  // Load existing conversation when panel first opens
  useEffect(() => {
    if (!open || messages !== null) return;
    api.get('/support/chat/history')
      .then(({ messages: msgs }) => setMessages(msgs ?? []))
      .catch(() => setMessages([]));
  }, [open, messages]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setError(null);
    setLoading(true);

    // Optimistically add user message
    const userMsg = { role: 'user', content: text, ts: new Date().toISOString() };
    setMessages(prev => [...(prev ?? []), userMsg]);

    try {
      const { reply, escalated } = await api.post('/support/chat', { message: text });
      const assistantMsg = {
        role:      'assistant',
        content:   reply,
        ts:        new Date().toISOString(),
        escalated: escalated ?? false,
      };
      setMessages(prev => [...(prev ?? []), assistantMsg]);
    } catch (err) {
      const msg = err?.data?.error ?? 'Something went wrong. Please try again.';
      setError(msg);
      // Remove the optimistic user message on error
      setMessages(prev => prev?.slice(0, -1) ?? []);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const charLeft = MAX_LENGTH - input.length;
  const showCharCount = input.length > 400;

  return (
    <>
      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelTitle}>Support</p>
              <p className={styles.panelSub}>Ask anything about Creatrbase</p>
            </div>
            <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close support chat">✕</button>
          </div>

          <div className={styles.messages}>
            {messages === null && (
              <div className={styles.empty}>
                <div className={styles.typing}>
                  <div className={styles.dot} />
                  <div className={styles.dot} />
                  <div className={styles.dot} />
                </div>
              </div>
            )}

            {messages !== null && messages.length === 0 && (
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>How can we help?</p>
                <p className={styles.emptyText}>Ask about your score, trial, connecting platforms, tasks, or billing.</p>
              </div>
            )}

            {messages !== null && messages.map((msg, i) => (
              <div
                key={i}
                className={
                  msg.role === 'user'
                    ? styles.bubbleUser
                    : msg.escalated
                      ? styles.bubbleEscalated
                      : styles.bubbleAssistant
                }
              >
                {msg.content}
              </div>
            ))}

            {loading && (
              <div className={styles.typing}>
                <div className={styles.dot} />
                <div className={styles.dot} />
                <div className={styles.dot} />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {showCharCount && (
            <p className={`${styles.charCount} ${charLeft < 50 ? styles.charCountWarn : ''}`}>
              {charLeft} left
            </p>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.inputArea}>
            <textarea
              ref={inputRef}
              className={styles.input}
              placeholder="Type a message…"
              value={input}
              onChange={e => setInput(e.target.value.slice(0, MAX_LENGTH))}
              onKeyDown={handleKeyDown}
              disabled={loading}
              rows={1}
            />
            <button
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={!input.trim() || loading}
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      )}

      <button
        className={styles.trigger}
        onClick={() => setOpen(o => !o)}
        aria-label="Open support chat"
      >
        <ChatIcon />
      </button>
    </>
  );
}
