import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import styles from './Roadmap.module.css';

const STATUS_OPTS  = ['thinking', 'building', 'testing', 'shipped'];
const VIS_OPTS     = ['power_users', 'all'];

const STATUS_LABELS = {
  thinking: 'Thinking',
  building: 'Building',
  testing:  'Testing',
  shipped:  'Shipped',
};

const STATUS_COLORS = {
  thinking: styles.statusThinking,
  building: styles.statusBuilding,
  testing:  styles.statusTesting,
  shipped:  styles.statusShipped,
};

function CreateForm({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', status: 'thinking', visibility: 'power_users', sort_order: 0 });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const item = await api.post('/admin/roadmap', form);
      onCreated(item);
      setForm({ title: '', description: '', status: 'thinking', visibility: 'power_users', sort_order: 0 });
      setOpen(false);
    } catch { /* show nothing — form stays open */ }
    finally { setSaving(false); }
  }

  if (!open) {
    return (
      <button type="button" className={styles.newBtn} onClick={() => setOpen(true)}>
        + New item
      </button>
    );
  }

  return (
    <form className={styles.createForm} onSubmit={handleSubmit}>
      <h3 className={styles.createTitle}>New roadmap item</h3>
      <input
        className={styles.input}
        placeholder="Title"
        value={form.title}
        onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
        autoFocus
      />
      <textarea
        className={styles.textarea}
        placeholder="Description (optional)"
        value={form.description}
        onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
        rows={3}
      />
      <div className={styles.createRow}>
        <select className={styles.select} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select className={styles.select} value={form.visibility} onChange={e => setForm(p => ({ ...p, visibility: e.target.value }))}>
          {VIS_OPTS.map(v => <option key={v} value={v}>{v === 'power_users' ? 'Power users only' : 'All users'}</option>)}
        </select>
        <input
          type="number"
          className={styles.inputSm}
          placeholder="Order"
          value={form.sort_order}
          onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
        />
      </div>
      <div className={styles.createActions}>
        <button type="button" className={styles.cancelBtn} onClick={() => setOpen(false)}>Cancel</button>
        <button type="submit" className={styles.saveBtn} disabled={saving || !form.title.trim()}>
          {saving ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  );
}

function ItemRow({ item, onUpdate, onDelete }) {
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState({ title: item.title, description: item.description || '', status: item.status, visibility: item.visibility, sort_order: item.sort_order });
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.patch(`/admin/roadmap/${item.id}`, form);
      onUpdate(updated);
      setEditing(false);
    } catch { /* stays in edit */ }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/roadmap/${item.id}`);
      onDelete(item.id);
    } catch { setDeleting(false); }
  }

  if (editing) {
    return (
      <div className={styles.itemRowEdit}>
        <input className={styles.input} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
        <textarea className={styles.textarea} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
        <div className={styles.createRow}>
          <select className={styles.select} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
            {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select className={styles.select} value={form.visibility} onChange={e => setForm(p => ({ ...p, visibility: e.target.value }))}>
            {VIS_OPTS.map(v => <option key={v} value={v}>{v === 'power_users' ? 'Power users only' : 'All'}</option>)}
          </select>
          <input type="number" className={styles.inputSm} value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} />
        </div>
        <div className={styles.createActions}>
          <button type="button" className={styles.cancelBtn} onClick={() => setEditing(false)}>Cancel</button>
          <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.itemRow}>
      <div className={styles.itemRowMain}>
        <span className={`${styles.statusPill} ${STATUS_COLORS[item.status]}`}>{STATUS_LABELS[item.status]}</span>
        <div className={styles.itemRowBody}>
          <p className={styles.itemTitle}>{item.title}</p>
          {item.description && <p className={styles.itemDesc}>{item.description}</p>}
        </div>
        <div className={styles.itemMeta}>
          <span className={styles.metaVotes}>{item.vote_count} vote{item.vote_count !== 1 ? 's' : ''}</span>
          <span className={styles.metaVis}>{item.visibility === 'power_users' ? 'Power only' : 'All'}</span>
          <span className={styles.metaOrder}>#{item.sort_order}</span>
        </div>
      </div>
      <div className={styles.itemRowActions}>
        <button type="button" className={styles.editBtn} onClick={() => setEditing(true)}>Edit</button>
        <button type="button" className={styles.deleteBtn} onClick={handleDelete} disabled={deleting}>
          {deleting ? '...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

export function Roadmap() {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/roadmap')
      .then(r => setItems(r.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleCreated(item) { setItems(p => [item, ...p]); }
  function handleUpdate(updated) { setItems(p => p.map(i => i.id === updated.id ? updated : i)); }
  function handleDelete(id) { setItems(p => p.filter(i => i.id !== id)); }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Roadmap</h1>
          <p className={styles.subtitle}>Items visible to power users and (optionally) all users.</p>
        </div>
      </div>

      <CreateForm onCreated={handleCreated} />

      {loading && <p className={styles.loading}>Loading...</p>}

      {!loading && (
        <div className={styles.list}>
          {items.length === 0 && <p className={styles.empty}>No roadmap items yet.</p>}
          {items.map(item => (
            <ItemRow key={item.id} item={item} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
