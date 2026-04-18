import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import styles from './Editorial.module.css';

export function EditorialHome() {
  const [agentRuns, setAgentRuns] = useState([]);
  const [voiceCount, setVoiceCount] = useState(0);

  useEffect(() => {
    api.get('/admin/agent-runs').then(d => setAgentRuns(d.runs || [])).catch(() => {});
    api.get('/admin/voice-memory').then(d => setVoiceCount((d.entries || []).length)).catch(() => {});
  }, []);

  const recentRuns = agentRuns.slice(0, 5);
  const pendingDrafts = agentRuns.filter(r => r.status === 'complete' && r.agent_type?.includes('digest')).length;

  return (
    <div>
      <h1 className={styles.title}>Editorial</h1>
      <p className={styles.subtitle}>Newsletter content, editorial sessions, and voice memory.</p>

      <div className={styles.cardGrid}>
        <Link to="/admin/editorial/session" className={styles.card}>
          <div className={styles.cardIcon}>💬</div>
          <div>
            <h3 className={styles.cardTitle}>Editorial session</h3>
            <p className={styles.cardDesc}>Start a conversational session to draft editorial content.</p>
          </div>
        </Link>
        <Link to="/admin/editorial/voice-memory" className={styles.card}>
          <div className={styles.cardIcon}>🧠</div>
          <div>
            <h3 className={styles.cardTitle}>Voice memory</h3>
            <p className={styles.cardDesc}>{voiceCount} active {voiceCount === 1 ? 'entry' : 'entries'}. Browse, edit, or add positions.</p>
          </div>
        </Link>
        <Link to="/admin/skills" className={styles.card}>
          <div className={styles.cardIcon}>📋</div>
          <div>
            <h3 className={styles.cardTitle}>Skills</h3>
            <p className={styles.cardDesc}>View and manage the 12 editorial skills.</p>
          </div>
        </Link>
      </div>

      <h2 className={styles.sectionTitle}>Recent agent runs</h2>
      {recentRuns.length === 0 ? (
        <p className={styles.empty}>No agent runs yet. Digests run Monday and Thursday at 8am UK.</p>
      ) : (
        <div className={styles.runList}>
          {recentRuns.map(r => (
            <div key={r.id} className={styles.runRow}>
              <span className={`${styles.statusDot} ${styles['status' + r.status.charAt(0).toUpperCase() + r.status.slice(1)]}`} />
              <span className={styles.runType}>{(r.agent_type || '').replace(/_/g, ' ')}</span>
              <span className={styles.runStatus}>{r.status}</span>
              <span className={styles.runTime}>{r.completed_at ? new Date(r.completed_at).toLocaleString() : r.started_at ? 'Running...' : 'Queued'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
