import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import styles from './Editorial.module.css';

export function EditorialSession() {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceMemory, setVoiceMemory] = useState([]);
  const chatRef = useRef(null);

  useEffect(() => {
    api.get('/admin/voice-memory').then(d => setVoiceMemory((d.entries || []).slice(0, 20))).catch(err => console.error('[EditorialSession]', err));
  }, []);

  async function startSession() {
    const { sessionId: id } = await api.post('/admin/editorial/session/start');
    setSessionId(id);
    setMessages([]);
    sendMessage(id, 'Start the editorial session. Load voice memory and recent ingestion, then present questions.');
  }

  async function sendMessage(sid, msg) {
    const sId = sid || sessionId;
    if (!sId || !msg.trim()) return;

    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setInput('');
    setLoading(true);

    try {
      const result = await api.post('/admin/editorial/session/message', { sessionId: sId, message: msg });
      const agentMsg = { role: 'agent', text: result.response || '' };
      if (result.toolUses?.length) agentMsg.tools = result.toolUses;
      setMessages(prev => [...prev, agentMsg]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'agent', text: 'Error: ' + (err.message || 'Something went wrong.') }]);
    } finally {
      setLoading(false);
    }
  }

  async function endCurrentSession() {
    if (sessionId) {
      await api.post('/admin/editorial/session/end', { sessionId }).catch(err => console.error('[EditorialSession]', err));
      setSessionId(null);
    }
  }

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendMessage(null, input);
    }
  }

  return (
    <div>
      <h1 className={styles.title}>Editorial session</h1>
      <p className={styles.subtitle}>Conversational drafting with the editorial composer agent.</p>

      {!sessionId ? (
        <button className={styles.addBtn} onClick={startSession}>Start new session</button>
      ) : (
        <div className={styles.sessionLayout}>
          <div className={styles.sessionSidebar}>
            <div className={styles.sidebarTitle}>Voice memory</div>
            {voiceMemory.map(v => (
              <div key={v.id} className={styles.sidebarEntry}>
                <strong>{v.topic}</strong><br />{v.position.slice(0, 80)}...
              </div>
            ))}
            {voiceMemory.length === 0 && <p className={styles.empty}>No entries yet.</p>}
          </div>

          <div className={styles.sessionChat}>
            <div className={styles.chatMessages} ref={chatRef}>
              {messages.map((m, i) => (
                <div key={i}>
                  <div className={m.role === 'user' ? styles.msgUser : styles.msgAgent}>
                    {m.text}
                  </div>
                  {m.tools?.map((t, j) => (
                    <div key={j} className={styles.msgTool}>
                      Tool: {t.tool} {t.result?.error ? '(error)' : ''}
                    </div>
                  ))}
                </div>
              ))}
              {loading && <div className={styles.msgAgent}>Thinking...</div>}
            </div>
            <div className={styles.chatInput}>
              <textarea
                className={styles.chatTextarea}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your response... (Cmd+Enter to send)"
                disabled={loading}
              />
              <button className={styles.chatSend} onClick={() => sendMessage(null, input)} disabled={loading || !input.trim()}>
                Send
              </button>
            </div>
          </div>

          <div className={styles.sessionState}>
            <div className={styles.stateLabel}>Session</div>
            <div className={styles.stateValue}>Active</div>
            <div className={styles.stateLabel}>Messages</div>
            <div className={styles.stateValue}>{messages.length}</div>
            <button className={styles.actionBtn} onClick={endCurrentSession} style={{ marginTop: 16 }}>End session</button>
          </div>
        </div>
      )}
    </div>
  );
}
