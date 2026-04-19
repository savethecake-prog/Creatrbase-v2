import { useState, useEffect } from 'react';
import { AppLayout } from '../../layouts/AppLayout/AppLayout';
import { useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';
import styles from './Settings.module.css';

const PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    hint: 'Your key from console.anthropic.com. Starts with sk-ant-',
    placeholder: 'sk-ant-api03-...',
  },
];

function ApiKeySection() {
  const { user, setUser } = useAuth();
  const [keys, setKeys]     = useState([]);
  const [input, setInput]   = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get('/api/apikey').then(r => setKeys(r.keys || [])).catch(() => {});
  }, []);

  const anthropicKey = keys.find(k => k.provider === 'anthropic');

  async function handleSave() {
    setError('');
    setSuccess('');
    if (!input.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/api/apikey', { provider: 'anthropic', apiKey: input.trim() });
      setKeys(prev => {
        const next = prev.filter(k => k.provider !== 'anthropic');
        return [...next, { provider: 'anthropic', verified_at: new Date().toISOString() }];
      });
      setInput('');
      setSuccess(`Key saved — ${res.masked}`);
      // Refresh user context so isPowerUser badge appears
      const me = await api.get('/api/auth/me');
      setUser(me);
    } catch (err) {
      setError(err?.error || 'Validation failed. Check the key and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setError('');
    setSuccess('');
    setRemoving(true);
    try {
      await api.delete('/api/apikey/anthropic');
      setKeys(prev => prev.filter(k => k.provider !== 'anthropic'));
      setSuccess('Key removed.');
      const me = await api.get('/api/auth/me');
      setUser(me);
    } catch {
      setError('Failed to remove key.');
    } finally {
      setRemoving(false);
    }
  }

  const provider = PROVIDERS[0];

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Integrations</h2>
        <p className={styles.sectionDesc}>
          Connect your own AI provider key. When set, all AI features use your key — no usage limits apply, and you unlock <strong>Power User</strong> status.
        </p>
      </div>

      <div className={styles.keyCard}>
        <div className={styles.keyCardHeader}>
          <div className={styles.keyCardMeta}>
            <span className={styles.keyCardName}>{provider.name}</span>
            {anthropicKey ? (
              <span className={styles.keyBadgeActive}>Connected</span>
            ) : (
              <span className={styles.keyBadgeInactive}>Not connected</span>
            )}
          </div>
          {anthropicKey && (
            <p className={styles.keyCardVerified}>
              Verified {new Date(anthropicKey.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>

        {anthropicKey ? (
          <div className={styles.keyCardConnected}>
            <p className={styles.keyCardConnectedText}>
              Your key is stored securely. AI features across Creatrbase use it automatically.
            </p>
            <button
              type="button"
              className={styles.btnRemove}
              onClick={handleRemove}
              disabled={removing}
            >
              {removing ? 'Removing...' : 'Remove key'}
            </button>
          </div>
        ) : (
          <div className={styles.keyCardForm}>
            <p className={styles.keyCardHint}>{provider.hint}</p>
            <div className={styles.keyInputRow}>
              <input
                type="password"
                className={styles.keyInput}
                placeholder={provider.placeholder}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className={styles.btnSave}
                onClick={handleSave}
                disabled={saving || !input.trim()}
              >
                {saving ? 'Verifying...' : 'Save key'}
              </button>
            </div>
          </div>
        )}

        {error   && <p className={styles.msgError}>{error}</p>}
        {success && <p className={styles.msgSuccess}>{success}</p>}
      </div>

      {!anthropicKey && (
        <div className={styles.powerUserTeaser}>
          <div className={styles.powerUserTeaserIcon}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 2L12.5 7.5H18L13.5 11L15.5 17L10 13.5L4.5 17L6.5 11L2 7.5H7.5L10 2Z" fill="currentColor"/>
            </svg>
          </div>
          <div>
            <p className={styles.powerUserTeaserTitle}>Unlock Power User status</p>
            <p className={styles.powerUserTeaserText}>
              Connect your key to get the API Wrangler badge, unlimited AI usage, access to the live product roadmap, and a vote on what gets built next.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function Settings() {
  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Settings</h1>
        </div>
        <ApiKeySection />
      </div>
    </AppLayout>
  );
}
