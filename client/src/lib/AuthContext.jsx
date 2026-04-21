import { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from './auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(undefined); // undefined = loading, null = logged out
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then(me => setUser(me))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
