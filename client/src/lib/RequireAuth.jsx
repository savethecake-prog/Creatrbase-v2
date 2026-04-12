import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null; // spinner could go here later
  if (!user)   return <Navigate to="/login" replace />;

  return children;
}
