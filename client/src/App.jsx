import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import { RequireAuth } from './lib/RequireAuth';
import { Login } from './pages/Login/Login';
import { Signup } from './pages/Signup/Signup';
import { Onboarding } from './pages/Onboarding/Onboarding';
import { Dashboard }   from './pages/Dashboard/Dashboard';
import { GapTracker }  from './pages/GapTracker/GapTracker';
import { Tasks }       from './pages/Tasks/Tasks';
import { Connections } from './pages/Connections/Connections';
import { Outreach }      from './pages/Outreach/Outreach';
import { Negotiations }  from './pages/Negotiations/Negotiations';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={
            <RequireAuth><Onboarding /></RequireAuth>
          } />
          <Route path="/dashboard" element={
            <RequireAuth><Dashboard /></RequireAuth>
          } />
          <Route path="/gap" element={
            <RequireAuth><GapTracker /></RequireAuth>
          } />
          <Route path="/tasks" element={
            <RequireAuth><Tasks /></RequireAuth>
          } />
          <Route path="/connections" element={
            <RequireAuth><Connections /></RequireAuth>
          } />
          <Route path="/outreach" element={
            <RequireAuth><Outreach /></RequireAuth>
          } />
          <Route path="/negotiations" element={
            <RequireAuth><Negotiations /></RequireAuth>
          } />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
