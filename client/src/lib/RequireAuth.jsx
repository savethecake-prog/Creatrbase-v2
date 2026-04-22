import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { PageLoader } from '../components/PageLoader/PageLoader';

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user)   return <Navigate to="/login" replace />;

  return children;
}
