import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import styles from './ContentSession.module.css';

// ─── Draft preview ─────────────────────────────────────────────────────────

function DraftPreview({ draft }) {
  if (!draft?.fields) {
    return (
      <div className={styles.draftEmpty}>
        <p>No draft yet.</p>
        <p className={styles.draftEmptyHint}>Ask the agent to draft your content. It will call <code>save_draft</code> when it has something to show.</p>
      </div>
    );
  }
  const { fields, content_type } = draft;
  return (
    <div className={styles.draftPreview}>
      {fields.title && <h2 className={styles.draftTitle}>{fields.title}</h2>}
      {fields.slug && (
        <div className={styles.draftMeta}>
          <span className={styles.draftMetaLabel}>Slug</span>
          <code className={styles.draftSlug}>/{content_type === 'blog' ? 'blog/' : ''}{fields.slug}</code>
        </div>
      )}
      {fields.meta_description && (
        <div className={styles.draftMeta}>
          <span className={styles.draftMetaLabel}>Meta</span>
          <span className={styles.draftMetaValue}>{fields.meta_description}</span>
        </div>
      )}
      {(fields.body_markdown || fields.analysis_markdown || fields.content_markdown || fields.summary_markdown) && (
        <div className={styles.draftBody}>
          <pre className={styles.draftBodyText}>
            {fields.body_markdown || fields.analysis_markdown || fields.content_markdown || fields.summary_markdown}
          </pre>
        </div>
      )}
      {fields.comparison_table && Array.isArray(fields.comparison_table) && (
        <div className={styles.draftTable}>
          <table>
            <thead><tr><th>Feature</th><th>Them</th><th>Creatrbase</th></tr></thead>
            <tbody>
              {fields.comparison_table.map((row, i) => (
                <tr key={i}><td>{row.feature}</td><td>{row.competitor}</td><td>{row.creatrbase}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {fields.key_findings && Array.isArray(fields.key_findings) && (
        <div className={styles.draftFindings}>
          <p className={styles.draftMetaLabel}>Key findings</p>
          <ol>
            {fields.key_findings.map((f, i) => (
              <li key={i}><strong>{f.finding}</strong> — {f.evidence} <em>({f.confidence})</em></li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ─── Tool use display ──────────────────────────────────────────────────────

function ToolUseBlock({ toolUse }) {
  const [open, setOpen] = useState(false);
  const toolLabels = {
    get_cpm_benchmarks:     'Fetched CPM benchmarks',
    get_niche_data:         'Fetched niche data',
    list_published_content: 'Listed published content',
    get_platform_stats:     'Fetched platform stats',
    get_voice_memory:       'Read voice memory',
    save_draft:             'Saved draft',
    search_research:        'Searched research corpus',
  };
  const label = toolLabels[toolUse.tool] || toolUse.tool;
  const isSaveDraft = toolUse.tool === 'save_draft';

  return (
    <div className={`${styles.toolUse} ${isSaveDraft ? styles.toolUseDraft : ''}`}>
      <button className={styles.toolUseHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.toolUseIcon}>{isSaveDraft ? '💾' : '⚙'}</span>
        <span className={styles.toolUseLabel}>{label}</span>
        <span className={styles.toolUseChevron}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <pre className={styles.toolUseDetails}>
          {JSON.stringify(toolUse.result, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Message bubble ────────────────────────────────────────────────────────

function Message({ msg }) {
  const isUser  = msg.role === 'user' && typeof msg.content === 'string';
  const isAgent = msg.role === 'agent';
  if (!isUser && !isAgent) return null;

  return (
    <div className={`${styles.message} ${isUser ? styles.messageUser : styles.messageAgent}`}>
      <div className={styles.messageBubble}>
        <p className={styles.messageText}>{msg.text}</p>
      </div>
      {msg.toolUses && msg.toolUses.length > 0 && (
        <div className={styles.messageTools}>
          {msg.toolUses.map((t, i) => <ToolUseBlock key={i} toolUse={t} />)}
        </div>
      )}
    </div>
  );
}

// ─── Publish confirm ───────────────────────────────────────────────────────

function PublishConfirm({ draft, onPublish, onCancel, busy }) {
  const [slug, setSlug] = useState(draft?.fields?.slug || '');
  const contentType = draft?.content_type || 'content';

  return (
    <div className={styles.publishConfirm}>
      <p className={styles.publishConfirmTitle}>Publish this {contentType}?</p>
      <div className={styles.publishSlugRow}>
        <label className={styles.publishLabel}>Slug</label>
        <input
          className={styles.publishSlugInput}
          value={slug}
          onChange={e => setSlug(e.target.value)}
          placeholder="url-slug"
        />
      </div>
      <div className={styles.publishActions}>
        <button className={styles.btnGhost} onClick={onCancel} disabled={busy}>Cancel</button>
        <button
          className={styles.btnPublish}
          onClick={() => onPublish(slug)}
          disabled={busy || !slug}
        >
          {busy ? 'Publishing...' : 'Confirm publish'}
        </button>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export function ContentSession() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [currentDraft, setCurrentDraft] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionStatus, setSessionStatus] = useState('active');
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const [briefOpen, setBriefOpen] = useState(true);

  const brief = location.state?.brief;
  const contentType = location.state?.contentType || 'content';
  const editingTitle = location.state?.editingTitle;

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    // Load existing session state
    api(`/api/admin/content/session/${id}`)
      .then(data => {
        const session = data.session;
        if (!session) return;
        setSessionStatus(session.status);
        setCurrentDraft(session.current_draft);
        // Reconstruct display messages from stored messages
        const displayMsgs = reconstructMessages(session.messages || []);
        setMessages(displayMsgs);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function reconstructMessages(storedMessages) {
    // Stored messages are Anthropic API format (role: user/assistant, content: string/array)
    // We need to extract display-friendly messages
    const display = [];
    for (const msg of storedMessages) {
      if (msg.role === 'user' && typeof msg.content === 'string') {
        display.push({ role: 'user', text: msg.content });
      }
      if (msg.role === 'assistant') {
        const content = Array.isArray(msg.content) ? msg.content : [];
        const textBlocks = content.filter(b => b.type === 'text');
        if (textBlocks.length > 0) {
          display.push({ role: 'agent', text: textBlocks.map(b => b.text).join('\n') });
        }
      }
    }
    return display;
  }

  async function sendMessage() {
    if (!input.trim() || sending || sessionStatus !== 'active') return;
    const text = input.trim();
    setInput('');
    setSending(true);

    setMessages(prev => [...prev, { role: 'user', text }]);

    try {
      const data = await api(`/api/admin/content/session/${id}/message`, {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      });

      setMessages(prev => [...prev, {
        role: 'agent',
        text: data.response,
        toolUses: data.toolUses || [],
      }]);

      if (data.currentDraft) {
        setCurrentDraft(data.currentDraft);
        // Auto-switch to draft tab when a draft is saved
        setActiveTab('draft');
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'agent', text: `Error: ${err.message}` }]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function handlePublish(slugOverride) {
    setPublishBusy(true);
    try {
      // Update slug in draft if overridden
      if (slugOverride && currentDraft?.fields) {
        currentDraft.fields.slug = slugOverride;
      }
      const data = await api(`/api/admin/content/session/${id}/publish`, {
        method: 'POST',
      });
      setPublishResult(data);
      setSessionStatus('completed');
      setPublishOpen(false);
    } catch (err) {
      alert(err.message || 'Publish failed');
    } finally {
      setPublishBusy(false);
    }
  }

  const typeLabel = { blog: 'Blog', comparison: 'Comparison', niche: 'Niche', threshold: 'Threshold', research: 'Research' }[contentType] || contentType;
  const hasDraft = Boolean(currentDraft?.fields);

  return (
    <div className={styles.layout}>
      {/* Left — research brief */}
      <aside className={`${styles.aside} ${briefOpen ? styles.asideOpen : styles.asideClosed}`}>
        <button className={styles.asideToggle} onClick={() => setBriefOpen(o => !o)}>
          {briefOpen ? '◀' : '▶'}
          {!briefOpen && <span className={styles.asideCollapsedLabel}>Brief</span>}
        </button>

        {briefOpen && (
          <>
            <div className={styles.asideHeader}>
              <p className={styles.asideTitle}>Research brief</p>
              <span className={styles.asideSubtitle}>Current knowledge corpus</span>
            </div>
            {brief ? (
              <div className={styles.briefContent}>{brief}</div>
            ) : (
              <p className={styles.briefEmpty}>No brief available. Research ran before this session but returned no context.</p>
            )}
          </>
        )}
      </aside>

      {/* Centre — conversation */}
      <main className={styles.main}>
        <div className={styles.mainHeader}>
          <div>
            <button className={styles.backBtn} onClick={() => navigate('/admin/content')}>← Content</button>
            <h1 className={styles.sessionTitle}>
              {editingTitle ? `Editing: ${editingTitle}` : `New ${typeLabel}`}
            </h1>
          </div>
          <div className={styles.tabsRow}>
            <button className={`${styles.tab} ${activeTab === 'chat' ? styles.tabActive : ''}`} onClick={() => setActiveTab('chat')}>Chat</button>
            <button className={`${styles.tab} ${activeTab === 'draft' ? styles.tabActive : ''} ${hasDraft ? styles.tabHasDraft : ''}`} onClick={() => setActiveTab('draft')}>
              Draft{hasDraft ? ' ●' : ''}
            </button>
          </div>
        </div>

        {activeTab === 'chat' && (
          <>
            <div className={styles.messages}>
              {messages.length === 0 && (
                <div className={styles.welcomeMsg}>
                  <p className={styles.welcomeTitle}>Ready to draft your {typeLabel.toLowerCase()}.</p>
                  <p className={styles.welcomeHint}>Tell the agent what you want to write, or ask it to start with a topic. It will use platform data and the research brief automatically.</p>
                </div>
              )}
              {messages.map((msg, i) => <Message key={i} msg={msg} />)}
              {sending && (
                <div className={`${styles.message} ${styles.messageAgent}`}>
                  <div className={styles.messageBubble}>
                    <span className={styles.thinkingDots}>
                      <span /><span /><span />
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className={styles.inputArea}>
              <textarea
                ref={textareaRef}
                className={styles.input}
                placeholder={sessionStatus === 'completed' ? 'Session complete.' : 'Message the agent... (Cmd+Enter to send)'}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending || sessionStatus !== 'active'}
                rows={3}
              />
              <button
                className={styles.sendBtn}
                onClick={sendMessage}
                disabled={!input.trim() || sending || sessionStatus !== 'active'}
              >
                {sending ? '...' : 'Send'}
              </button>
            </div>
          </>
        )}

        {activeTab === 'draft' && (
          <div className={styles.draftTab}>
            <DraftPreview draft={currentDraft} />
          </div>
        )}
      </main>

      {/* Right — metadata + actions */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarSection}>
          <p className={styles.sidebarLabel}>Session</p>
          <div className={styles.sidebarRow}>
            <span className={styles.sidebarKey}>Type</span>
            <span className={styles.sidebarVal}>{typeLabel}</span>
          </div>
          <div className={styles.sidebarRow}>
            <span className={styles.sidebarKey}>Status</span>
            <span className={`${styles.sessionStatus} ${styles[`status_${sessionStatus}`]}`}>{sessionStatus}</span>
          </div>
          <div className={styles.sidebarRow}>
            <span className={styles.sidebarKey}>Messages</span>
            <span className={styles.sidebarVal}>{messages.length}</span>
          </div>
        </div>

        {hasDraft && (
          <div className={styles.sidebarSection}>
            <p className={styles.sidebarLabel}>Draft</p>
            <div className={styles.sidebarRow}>
              <span className={styles.sidebarKey}>Slug</span>
              <code className={styles.sidebarCode}>{currentDraft.fields?.slug || '—'}</code>
            </div>
          </div>
        )}

        {publishResult ? (
          <div className={styles.publishSuccess}>
            <p className={styles.publishSuccessTitle}>Published!</p>
            <a href={publishResult.url} target="_blank" rel="noreferrer" className={styles.publishSuccessUrl}>
              {publishResult.url}
            </a>
          </div>
        ) : (
          <div className={styles.sidebarActions}>
            {publishOpen ? (
              <PublishConfirm
                draft={currentDraft}
                onPublish={handlePublish}
                onCancel={() => setPublishOpen(false)}
                busy={publishBusy}
              />
            ) : (
              <button
                className={`${styles.btnPublish} ${!hasDraft ? styles.btnPublishDisabled : ''}`}
                onClick={() => setPublishOpen(true)}
                disabled={!hasDraft || sessionStatus === 'completed'}
                title={!hasDraft ? 'Ask the agent to save a draft first' : ''}
              >
                Publish
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
