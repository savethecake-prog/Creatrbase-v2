import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import styles from './Editorial.module.css';

export function VoiceMemory() {
  const [entries, setEntries] = useState([]);
  const [topicFilter, setTopicFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [confFilter, setConfFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ topic: '', position: '', context: '', confidence: 'medium' });

  function loadEntries() {
    let url = '/admin/voice-memory?';
    if (topicFilter) url += `topic=${encodeURIComponent(topicFilter)}&`;
    if (sourceFilter) url += `source=${sourceFilter}&`;
    if (confFilter) url += `confidence=${confFilter}&`;
    api.get(url).then(d => setEntries(d.entries || [])).catch(err => console.error('[VoiceMemory]', err));
  }

  useEffect(loadEntries, [topicFilter, sourceFilter, confFilter]);

  async function handleAdd(e) {
    e.preventDefault();
    await api.post('/admin/voice-memory', form);
    setShowForm(false);
    setForm({ topic: '', position: '', context: '', confidence: 'medium' });
    loadEntries();
  }

  async function handleDeprecate(id) {
    await api.delete(`/admin/voice-memory/${id}`);
    loadEntries();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <h1 className={styles.title}>Voice memory</h1>
          <p className={styles.subtitle}>Editorial positions and decisions. The compounding layer.</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'New entry'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className={styles.entry} style={{ marginBottom: 20 }}>
          <input className={styles.filterInput} placeholder="Topic (kebab-case)" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} required style={{ marginBottom: 8, width: '100%' }} />
          <textarea className={styles.filterInput} placeholder="Position statement" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} required style={{ marginBottom: 8, width: '100%', minHeight: 60 }} />
          <textarea className={styles.filterInput} placeholder="Context (optional)" value={form.context} onChange={e => setForm(f => ({ ...f, context: e.target.value }))} style={{ marginBottom: 8, width: '100%' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <select className={styles.filterSelect} value={form.confidence} onChange={e => setForm(f => ({ ...f, confidence: e.target.value }))}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button type="submit" className={styles.addBtn}>Save</button>
          </div>
        </form>
      )}

      <div className={styles.filterBar}>
        <input className={styles.filterInput} placeholder="Search topics..." value={topicFilter} onChange={e => setTopicFilter(e.target.value)} />
        <select className={styles.filterSelect} value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="">All sources</option>
          <option value="anthony">Anthony</option>
          <option value="inferred">Inferred</option>
          <option value="published">Published</option>
        </select>
        <select className={styles.filterSelect} value={confFilter} onChange={e => setConfFilter(e.target.value)}>
          <option value="">All confidence</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className={styles.entryList}>
        {entries.length === 0 && <p className={styles.empty}>No voice memory entries yet. Add one above or start an editorial session.</p>}
        {entries.map(e => (
          <div key={e.id} className={styles.entry}>
            <div className={styles.entryTopic}>{e.topic}</div>
            <div className={styles.entryPosition}>{e.position}</div>
            {e.context && <div className={styles.entryContext}>{e.context}</div>}
            <div className={styles.entryMeta}>
              <span className={`${styles.badge} ${e.source === 'anthony' ? styles.badgeAnthony : styles.badgeInferred}`}>{e.source}</span>
              <span className={`${styles.badge} ${styles['badge' + e.confidence.charAt(0).toUpperCase() + e.confidence.slice(1)]}`}>{e.confidence}</span>
              <span className={styles.entryDate}>{new Date(e.created_at).toLocaleDateString()}</span>
              <div className={styles.entryActions}>
                <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => handleDeprecate(e.id)}>Deprecate</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
