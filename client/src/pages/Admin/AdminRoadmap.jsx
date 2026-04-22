import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import styles from './AdminRoadmap.module.css';

const STAGES    = ['scoping', 'planning', 'building', 'launching', 'shipped'];
const STAGE_LABELS = {
  scoping: 'Scoping', planning: 'Planning', building: 'Building',
  launching: 'Launching', shipped: 'Shipped',
};
const STAGE_COLORS = {
  scoping: 'lavender', planning: 'peach', building: 'mint',
  launching: 'coral', shipped: 'grey',
};

const EMPTY_FORM = {
  title: '', description: '', status: 'scoping',
  visibility: 'all', sort_order: 0, launch_date: '', tag: '',
};

function ItemModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item ? { ...EMPTY_FORM, ...item, launch_date: item.launch_date?.slice(0, 10) || '', tag: item.tag || '' } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError('');
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{item ? 'Edit item' : 'New item'}</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <form onSubmit={handleSave} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Title</label>
            <input className={styles.input} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Feature or improvement title" required />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Description</label>
            <textarea className={`${styles.input} ${styles.textarea}`} rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional details" />
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Stage</label>
              <select className={`${styles.input} ${styles.select}`} value={form.status} onChange={e => set('status', e.target.value)}>
                {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Visibility</label>
              <select className={`${styles.input} ${styles.select}`} value={form.visibility} onChange={e => set('visibility', e.target.value)}>
                <option value="all">All users</option>
                <option value="power_users">Power users only</option>
              </select>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Launch date (target)</label>
              <input type="date" className={styles.input} value={form.launch_date} onChange={e => set('launch_date', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Tag</label>
              <input className={styles.input} value={form.tag} onChange={e => set('tag', e.target.value)} placeholder="e.g. scoring, outreach" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Sort order</label>
              <input type="number" className={styles.input} value={form.sort_order} onChange={e => set('sort_order', parseInt(e.target.value, 10) || 0)} min={0} />
            </div>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminRoadmap() {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState(null); // null | 'new' | { item }
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    api.get('/admin/roadmap')
      .then(r => setItems(r.items || []))
      .catch(err => console.error('[AdminRoadmap]', err))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(form) {
    if (modal?.item) {
      const updated = await api.patch(`/admin/roadmap/${modal.item.id}`, form);
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    } else {
      const created = await api.post('/admin/roadmap', form);
      setItems(prev => [created, ...prev]);
    }
  }

  async function handleDelete(id) {
    setDeleting(id);
    try {
      await api.delete(`/admin/roadmap/${id}`);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch { /* toast later */ }
    finally { setDeleting(null); }
  }

  const grouped = STAGES.reduce((acc, s) => { acc[s] = []; return acc; }, {});
  for (const item of items) {
    if (grouped[item.status]) grouped[item.status].push(item);
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Roadmap</h1>
        <button type="button" className={styles.addBtn} onClick={() => setModal('new')}>
          + Add item
        </button>
      </div>

      {loading && <p className={styles.loadingText}>Loading...</p>}

      {!loading && (
        <div className={styles.content}>
          {STAGES.map(stage => (
            <div key={stage} className={styles.stageGroup}>
              <div className={`${styles.stageHeader} ${styles[`stageHeader_${STAGE_COLORS[stage]}`]}`}>
                <span className={styles.stageLabel}>{STAGE_LABELS[stage]}</span>
                <span className={styles.stageCount}>{grouped[stage].length}</span>
              </div>
              {grouped[stage].length === 0 && (
                <p className={styles.stageEmpty}>No items in this stage.</p>
              )}
              {grouped[stage].map(item => (
                <div key={item.id} className={styles.itemRow}>
                  <div className={styles.itemInfo}>
                    <p className={styles.itemTitle}>{item.title}</p>
                    <div className={styles.itemMeta}>
                      {item.tag && <span className={styles.itemTag}>{item.tag}</span>}
                      {item.launch_date && (
                        <span className={styles.itemDate}>
                          Target: {new Date(item.launch_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                        </span>
                      )}
                      <span className={styles.itemVotes}>
                        +{item.upvotes || 0} / -{item.downvotes || 0}
                      </span>
                      <span className={`${styles.visibilityBadge} ${item.visibility === 'all' ? styles.visibilityAll : styles.visibilityPower}`}>
                        {item.visibility === 'all' ? 'Public' : 'Power'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.itemActions}>
                    <button type="button" className={styles.editBtn} onClick={() => setModal({ item })}>Edit</button>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(item.id)}
                      disabled={deleting === item.id}
                    >
                      {deleting === item.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {(modal === 'new' || modal?.item) && (
        <ItemModal
          item={modal?.item ?? null}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
