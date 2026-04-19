import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import { RequireAuth } from './lib/RequireAuth';
import { Login } from './pages/Login/Login';
import { Signup } from './pages/Signup/Signup';
import { Landing } from './pages/Landing/Landing';
import { Onboarding } from './pages/Onboarding/Onboarding';
import { Dashboard }   from './pages/Dashboard/Dashboard';
import { GapTracker }  from './pages/GapTracker/GapTracker';
import { Tasks }       from './pages/Tasks/Tasks';
import { Connections } from './pages/Connections/Connections';
import { Outreach }      from './pages/Outreach/Outreach';
import { Negotiations }  from './pages/Negotiations/Negotiations';
import StaticPage from './pages/Static/StaticPage';
import { ScoringMethodology } from './pages/ScoringMethodology/ScoringMethodology';
import { BlogIndex }    from './pages/Blog/BlogIndex';
import { BlogArticle }  from './pages/Blog/BlogArticle';
import { Honesty }      from './pages/Honesty/Honesty';
import { Pricing }      from './pages/Pricing/Pricing';
import { ScoreForm }    from './pages/Score/ScoreForm';
import { AdminLayout }    from './pages/Admin/AdminLayout';
import { AdminDashboard } from './pages/Admin/AdminDashboard';
import { AdminPlaceholder } from './pages/Admin/AdminPlaceholder';
import { Subscribers }      from './pages/Admin/Subscribers';
import { Content }          from './pages/Admin/Content';
import { TokenCleanup }     from './pages/Admin/TokenCleanup';
import { ContentSession }   from './pages/Admin/ContentSession';
import { EditorialHome }  from './pages/Admin/EditorialHome';
import { EditorialSession } from './pages/Admin/EditorialSession';
import { VoiceMemory }    from './pages/Admin/VoiceMemory';
import { Skills }         from './pages/Admin/Skills';
import { About }         from './pages/About/About';
import { Author }         from './pages/Author/Author';
import { Compare }        from './pages/Compare/Compare';
import { NichePage, RatePage, ThresholdPage, ResearchPage } from './pages/Niche/NichePage';
import { RequireAdmin }   from './lib/RequireAdmin';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/scoring-explained" element={<ScoringMethodology />} />
          <Route path="/blog"        element={<BlogIndex />} />
          <Route path="/blog/:slug"  element={<BlogArticle />} />
          <Route path="/honesty"     element={<Honesty />} />
          <Route path="/pricing"     element={<Pricing />} />
          <Route path="/score"       element={<ScoreForm />} />
          <Route path="/about"       element={<About />} />
          <Route path="/author/anthony-saulderson" element={<Author />} />
          <Route path="/compare/:competitor" element={<Compare />} />
          <Route path="/niche/:slug" element={<NichePage />} />
          <Route path="/rates/:country/:niche" element={<RatePage />} />
          <Route path="/threshold/:metric" element={<ThresholdPage />} />
          <Route path="/research/:slug" element={<ResearchPage />} />
          <Route path="/:slug" element={<StaticPage />} />
          <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<AdminDashboard />} />
            <Route path="editorial" element={<EditorialHome />} />
            <Route path="editorial/session" element={<EditorialSession />} />
            <Route path="editorial/voice-memory" element={<VoiceMemory />} />
            <Route path="skills" element={<Skills />} />
            <Route path="subscribers" element={<Subscribers />} />
            <Route path="content" element={<Content />} />
            <Route path="content/session/:id" element={<ContentSession />} />
            <Route path="creators" element={<AdminPlaceholder title="Creators" />} />
            <Route path="agents" element={<AdminPlaceholder title="Agents" />} />
            <Route path="system" element={<AdminPlaceholder title="System" />} />
            <Route path="token-cleanup" element={<TokenCleanup />} />
            <Route path="revenue" element={<AdminPlaceholder title="Revenue" />} />
          </Route>
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
          <Route path="/" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
