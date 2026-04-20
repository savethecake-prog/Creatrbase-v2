import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { api } from './api';

function Cheeky404() {
  return (
    <div style={{
      minHeight: '100vh', background: '#FAF6EF', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif", color: '#1B1040',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🧢</div>
        <div style={{ fontSize: 120, lineHeight: 1, marginBottom: 24 }}>🫣</div>
        <h1 style={{ fontFamily: "'Outfit', 'DM Sans', sans-serif", fontSize: 32, marginBottom: 12 }}>
          Naughty naughty!
        </h1>
        <p style={{ fontSize: 16, color: '#76688F', lineHeight: 1.6, marginBottom: 32 }}>
          You're not meant to be here darlin'. This bit's for the gaffer only, innit. Jog on before someone notices.
        </p>
        <a href="/" style={{
          display: 'inline-block', padding: '12px 28px', background: '#1B1040',
          color: '#FAF6EF', borderRadius: 10, textDecoration: 'none',
          fontWeight: 600, fontSize: 14,
        }}>Take me home</a>
      </div>
    </div>
  );
}

export function RequireAdmin({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    if (authLoading || !user) return;
    api.get('/admin/me')
      .then(() => setIsAdmin(true))
      .catch(() => setIsAdmin(false));
  }, [user, authLoading]);

  if (authLoading) return null;
  if (!user) return <Cheeky404 />;
  if (isAdmin === null) return null;
  if (!isAdmin) return <Cheeky404 />;

  return children;
}
