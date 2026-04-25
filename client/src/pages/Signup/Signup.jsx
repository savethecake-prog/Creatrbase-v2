import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout/AuthLayout';
import { Button } from '../../components/ui/Button/Button';
import { Input } from '../../components/ui/Input/Input';
import { useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';
import { getMe } from '../../lib/auth';
import { NewsletterSignup } from '../../components/NewsletterSignup/NewsletterSignup';
import { PageMeta } from '../../components/PageMeta/PageMeta';
import styles from './Signup.module.css';

export function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const claimId = searchParams.get('claim');
  const { setUser } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [claimInfo, setClaimInfo] = useState(null);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);

  useEffect(() => {
    if (!claimId) return;
    api.get('/public/claim/' + claimId)
      .then(info => { if (!info.isClaimed) setClaimInfo(info); })
      .catch(err => console.error('[Signup]', err));
  }, [claimId]);

  function set(field) {
    return e => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/signup', form);
      const me = await getMe();
      setUser(me);
      // Subscribe to newsletter if opted in (non-blocking)
      if (newsletterOptIn) {
        api.post('/newsletter/subscribe', {
          email: form.email, source: 'product_signup',
          segments: ['creator-economy', 'ai-for-creators', 'editorial'],
          marketing_consent: true,
        }).catch(err => console.error('[Signup]', err));
      }
      // Claim the score if we have a claim param
      if (claimId) {
        try { await api.post('/public/claim', { scoreCardId: claimId }); } catch (_) {}
      }
      navigate('/onboarding');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Get your score." subtitle="Sign up to track your Commercial Viability Score over time. Free forever. Upgrade whenever you're ready." eyebrow="FREE TO START · NO CARD">
      <PageMeta title="Create your free account" noIndex={true} />
      <form className={styles.form} onSubmit={handleSubmit}>
        {claimInfo && (
          <div className={styles.claimBanner}>
            {claimInfo.channelAvatarUrl && <img src={claimInfo.channelAvatarUrl} alt="" className={styles.claimAvatar} />}
            <div>
              <strong>You're saving {claimInfo.channelName}'s score.</strong><br/>
              Connect your channel after signup to unlock the full analytics.
            </div>
          </div>
        )}
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.oauthRow}>
          <a className={styles.oauthBtn} href="/api/auth/google">
            <GoogleIcon />
            Continue with Google
          </a>
          <a className={styles.oauthBtn} href="/api/auth/twitch">
            <TwitchIcon />
            Continue with Twitch
          </a>
        </div>

        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>or</span>
          <span className={styles.dividerLine} />
        </div>

        <div className={styles.nameRow}>
          <Input
            id="firstName"
            label="First name"
            type="text"
            placeholder="Alex"
            value={form.firstName}
            onChange={set('firstName')}
            required
            autoComplete="given-name"
          />
          <Input
            id="lastName"
            label="Last name"
            type="text"
            placeholder="Rivera"
            value={form.lastName}
            onChange={set('lastName')}
            required
            autoComplete="family-name"
          />
        </div>

        <Input
          id="email"
          label="Email address"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={set('email')}
          required
          autoComplete="email"
        />
        <Input
          id="password"
          label="Password"
          type="password"
          placeholder="At least 8 characters"
          value={form.password}
          onChange={set('password')}
          required
          autoComplete="new-password"
          minLength={8}
        />

        <NewsletterSignup source="product_signup" variant="checkbox" onSubscribe={setNewsletterOptIn} />

        <Button type="submit" full disabled={loading}>
          {loading ? 'Creating account...' : 'Create free account'}
        </Button>

        <p className={styles.terms}>
          By creating an account you agree to our{' '}
          <a href="/terms" className={styles.link}>Terms</a> and{' '}
          <a href="/privacy" className={styles.link}>Privacy Policy</a>.
        </p>

        <p className={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" className={styles.footerLink}>Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function TwitchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#9146FF">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
    </svg>
  );
}
