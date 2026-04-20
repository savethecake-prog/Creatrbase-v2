import { useState } from 'react';
import { api } from '../../lib/api';
import styles from './TokenCleanup.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(bytes) {
  const n = Number(bytes);
  if (n === 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtNum(n) {
  return Number(n).toLocaleString('en-GB');
}

function pct(before, after) {
  if (!before || before === 0) return '0%';
  return `${((before - after) / before * 100).toFixed(1)}%`;
}

function timeAgo(iso) {
  if (!iso) return 'Unknown';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function StatusBadge({ status }) {
  const cls =
    status === 'complete' || status === 'completed' ? styles.statusComplete :
    status === 'failed'                             ? styles.statusFailed :
                                                      styles.statusOther;
  return <span className={`${styles.statusBadge} ${cls}`}>{status}</span>;
}

// ── Target config ─────────────────────────────────────────────────────────────

const TARGETS = [
  {
    key:   'tool_results',
    label: 'Strip tool payloads',
    desc:  'Remove raw tool_use and tool_result blocks from stored message arrays. Keeps all readable conversation turns. Typically reclaims 50-70% of stored JSON.',
  },
  {
    key:   'old_incomplete',
    label: 'Clear old incomplete sessions',
    desc:  'Delete agent_run rows with status queued/running/failed older than 7 days, and content_sessions not completed older than 7 days. These will never be used again.',
  },
  {
    key:   'completed_old',
    label: 'Trim old completed sessions',
    desc:  'For completed sessions older than 30 days: keep only the last 6 messages (3 turns). Archived history you will realistically never read.',
  },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export function TokenCleanup() {
  const [audit,       setAudit]       = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError,  setAuditError]  = useState(null);

  const [selected,    setSelected]    = useState({ tool_results: true, old_incomplete: true, completed_old: false });
  const [dryRun,      setDryRun]      = useState(true);

  const [runResult,   setRunResult]   = useState(null);
  const [running,     setRunning]     = useState(false);
  const [runError,    setRunError]    = useState(null);

  // Confirm step: after dry run passes, show a confirm button to execute for real
  const [dryRunDone,  setDryRunDone]  = useState(false);

  async function handleAudit() {
    setAuditLoading(true);
    setAuditError(null);
    setAudit(null);
    setRunResult(null);
    setDryRunDone(false);
    try {
      const data = await api('/api/admin/token-cleanup/audit');
      setAudit(data);
    } catch (err) {
      setAuditError(err.message || 'Audit failed');
    } finally {
      setAuditLoading(false);
    }
  }

  async function handleRun(forceLive = false) {
    const targets = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (targets.length === 0) return;

    const isLive = forceLive || !dryRun;
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    try {
      const data = await api('/api/admin/token-cleanup/run', {
        method: 'POST',
        body: JSON.stringify({ dryRun: !isLive, targets }),
      });
      setRunResult({ ...data, wasLive: isLive });
      if (!isLive) setDryRunDone(true);
    } catch (err) {
      setRunError(err.message || 'Cleanup failed');
    } finally {
      setRunning(false);
    }
  }

  const anySelected = Object.values(selected).some(Boolean);
  const totalStoredMB = audit
    ? ((audit.agent_run.total_size_bytes + audit.content_sessions.total_size_bytes) / (1024 * 1024)).toFixed(2)
    : null;
  const reclaimableMB = audit
    ? (audit.estimated_reclaimable_bytes / (1024 * 1024)).toFixed(2)
    : null;

  return (
    <div>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Token Cleanup</h1>
          <p className={styles.subtitle}>Audit and reclaim storage used by AI session data in agent_run and content_sessions.</p>
        </div>
        <button
          className={styles.btnGhost}
          onClick={handleAudit}
          disabled={auditLoading}
        >
          {auditLoading ? 'Scanning...' : 'Run audit'}
        </button>
      </div>

      {auditError && <div className={styles.errorBox}>{auditError}</div>}

      {/* ── Audit panel ── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Storage audit</h2>

        {!audit && !auditLoading && (
          <div className={styles.emptyState}>
            Run the audit to see a breakdown of stored session data.
          </div>
        )}

        {auditLoading && (
          <div className={styles.loadingText}>Scanning tables...</div>
        )}

        {audit && (
          <>
            {/* Stats strip */}
            <div className={styles.statsStrip}>
              <div className={styles.stat}>
                <span className={styles.statValue}>
                  {fmtNum(audit.agent_run.total_sessions + audit.content_sessions.total_sessions)}
                </span>
                <span className={styles.statLabel}>Total sessions</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <span className={styles.statValue}>{totalStoredMB} MB</span>
                <span className={styles.statLabel}>Stored on disk</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <span className={`${styles.statValue} ${styles.statValueAccent}`}>
                  ~{reclaimableMB} MB
                </span>
                <span className={styles.statLabel}>Est. reclaimable</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <span className={styles.statValue}>
                  {fmtNum(audit.agent_run.old_incomplete + audit.content_sessions.old_incomplete)}
                </span>
                <span className={styles.statLabel}>Old incomplete</span>
              </div>
            </div>

            {/* agent_run breakdown table */}
            <p className={styles.sectionTitle} style={{ fontSize: 13, marginBottom: 8 }}>
              agent_run by type
            </p>
            <div className={styles.tableWrap} style={{ marginBottom: 16 }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Agent type</th>
                    <th>Sessions</th>
                    <th>Total size</th>
                    <th>Avg size</th>
                    <th>Est. reclaimable</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.agent_run.by_type.length === 0 && (
                    <tr><td colSpan={5} className={styles.tdDim}>No agent runs recorded.</td></tr>
                  )}
                  {audit.agent_run.by_type.map(r => (
                    <tr key={r.agent_type}>
                      <td className={styles.tdMono}>{r.agent_type}</td>
                      <td className={styles.tdMono}>{fmtNum(r.count)}</td>
                      <td className={styles.tdMono}>{fmtBytes(r.total_bytes)}</td>
                      <td className={`${styles.tdMono} ${styles.tdDim}`}>{fmtBytes(r.avg_bytes)}</td>
                      <td className={`${styles.tdMono} ${styles.statValueAccent}`}>{fmtBytes(r.reclaimable_bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Large sessions */}
            {(audit.agent_run.large_sessions.length > 0 || audit.content_sessions.large_sessions.length > 0) && (
              <>
                <p className={styles.sectionTitle} style={{ fontSize: 13, marginBottom: 8 }}>
                  Largest sessions (top 10 per table)
                </p>
                <div className={styles.largeList}>
                  {[...audit.agent_run.large_sessions, ...audit.content_sessions.large_sessions]
                    .sort((a, b) => b.size_bytes - a.size_bytes)
                    .slice(0, 10)
                    .map(s => (
                      <div key={s.id} className={styles.largeItem}>
                        <span className={styles.largeItemId}>{s.id}</span>
                        <span className={styles.largeItemType}>{s.agent_type}</span>
                        <span className={styles.largeItemSize}>{fmtBytes(s.size_bytes)}</span>
                        <span className={styles.largeItemDate}>{timeAgo(s.created_at)}</span>
                        <StatusBadge status={s.status} />
                      </div>
                    ))
                  }
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Cleanup controls ── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Cleanup controls</h2>

        <div className={styles.controlsGrid}>
          {TARGETS.map(t => (
            <label
              key={t.key}
              className={`${styles.toggleRow} ${selected[t.key] ? styles.toggleRowActive : ''}`}
            >
              <input
                type="checkbox"
                className={styles.toggleCheckbox}
                checked={!!selected[t.key]}
                onChange={e => setSelected(s => ({ ...s, [t.key]: e.target.checked }))}
              />
              <div>
                <div className={styles.toggleLabel}>{t.label}</div>
                <div className={styles.toggleDesc}>{t.desc}</div>
              </div>
            </label>
          ))}
        </div>

        <hr className={styles.divider} />

        <label className={styles.dryRunRow}>
          <input
            type="checkbox"
            className={styles.toggleCheckbox}
            checked={dryRun}
            onChange={e => { setDryRun(e.target.checked); setDryRunDone(false); setRunResult(null); }}
          />
          <div>
            <span className={styles.dryRunLabel}>Dry run mode</span>
            <span className={styles.dryRunDesc}> - compute what would be cleaned without writing any changes</span>
          </div>
        </label>

        <hr className={styles.divider} />

        {runError && <div className={styles.errorBox}>{runError}</div>}

        {/* Dry run estimate summary */}
        {runResult && runResult.dryRun && !runResult.wasLive && (
          <div className={styles.estimateBox}>
            <div className={styles.estimateTitle}>Dry run complete - estimated savings</div>
            <div className={styles.estimateValue}>
              {fmtBytes(runResult.total_bytes_before - runResult.total_bytes_after || 0)}
            </div>
            <div className={styles.estimateNote}>
              {fmtNum(runResult.agent_run.rows_affected)} agent_run rows /
              {fmtNum(runResult.content_sessions.rows_affected)} content_session rows would be affected.
              {runResult.total_bytes_before > 0 && (
                <> That is roughly {pct(runResult.total_bytes_before, runResult.total_bytes_after)} of current storage.</>
              )}
            </div>
          </div>
        )}

        <div className={styles.btnRow}>
          <button
            className={styles.btnPrimary}
            onClick={() => handleRun(false)}
            disabled={running || !anySelected || !audit}
            title={!audit ? 'Run the audit first' : undefined}
          >
            {running ? 'Running...' : dryRun ? 'Preview (dry run)' : 'Run cleanup'}
          </button>

          {/* After a successful dry run, offer a confirm-live button */}
          {dryRunDone && runResult && !running && (
            <button
              className={styles.btnDanger}
              onClick={() => handleRun(true)}
              disabled={running}
            >
              Confirm and execute for real
            </button>
          )}

          {(audit || runResult) && (
            <button
              className={styles.btnGhost}
              onClick={() => { setAudit(null); setRunResult(null); setDryRunDone(false); setRunError(null); }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Results ── */}
      {runResult && runResult.wasLive && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Results</h2>

          <div className={styles.resultsGrid}>
            <div className={styles.resultCard}>
              <div className={`${styles.resultCardValue} ${styles.resultCardValueGood}`}>
                {fmtBytes(runResult.bytes_reclaimed)}
              </div>
              <div className={styles.resultCardLabel}>Bytes reclaimed</div>
            </div>
            <div className={styles.resultCard}>
              <div className={styles.resultCardValue}>
                {fmtBytes(runResult.total_bytes_before)}
              </div>
              <div className={styles.resultCardLabel}>Before</div>
            </div>
            <div className={styles.resultCard}>
              <div className={styles.resultCardValue}>
                {fmtBytes(runResult.total_bytes_after)}
              </div>
              <div className={styles.resultCardLabel}>After</div>
            </div>
            <div className={styles.resultCard}>
              <div className={`${styles.resultCardValue} ${styles.resultCardValueGood}`}>
                {pct(runResult.total_bytes_before, runResult.total_bytes_after)}
              </div>
              <div className={styles.resultCardLabel}>Reduction</div>
            </div>
            <div className={styles.resultCard}>
              <div className={styles.resultCardValue}>
                {fmtNum(runResult.agent_run.rows_affected)}
              </div>
              <div className={styles.resultCardLabel}>agent_run rows</div>
            </div>
            <div className={styles.resultCard}>
              <div className={styles.resultCardValue}>
                {fmtNum(runResult.content_sessions.rows_affected)}
              </div>
              <div className={styles.resultCardLabel}>content_session rows</div>
            </div>
          </div>

          <div className={styles.resultNote}>
            Cleanup complete. Run the audit again to see updated storage figures.
          </div>
        </div>
      )}
    </div>
  );
}
