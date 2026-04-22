import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider }   from './lib/AuthContext';
import { RequireAuth }    from './lib/RequireAuth';
import { RequireAdmin }   from './lib/RequireAdmin';
import { ErrorBoundary }  from './components/ErrorBoundary/ErrorBoundary';
import { PageLoader }     from './components/PageLoader/PageLoader';

// ── Lazy page imports ─────────────────────────────────────────────────────────

const lazyNamed = (loader, name) => lazy(() => loader().then(m => ({ default: m[name] })));

// Public / marketing
const Landing            = lazyNamed(() => import('./pages/Landing/Landing'),                      'Landing');
const Login              = lazyNamed(() => import('./pages/Login/Login'),                          'Login');
const Signup             = lazyNamed(() => import('./pages/Signup/Signup'),                        'Signup');
const ScoringMethodology = lazyNamed(() => import('./pages/ScoringMethodology/ScoringMethodology'),'ScoringMethodology');
const BlogIndex          = lazyNamed(() => import('./pages/Blog/BlogIndex'),                       'BlogIndex');
const BlogArticle        = lazyNamed(() => import('./pages/Blog/BlogArticle'),                     'BlogArticle');
const Honesty            = lazyNamed(() => import('./pages/Honesty/Honesty'),                      'Honesty');
const Pricing            = lazyNamed(() => import('./pages/Pricing/Pricing'),                      'Pricing');
const ScoreForm          = lazyNamed(() => import('./pages/Score/ScoreForm'),                      'ScoreForm');
const About              = lazyNamed(() => import('./pages/About/About'),                          'About');
const Author             = lazyNamed(() => import('./pages/Author/Author'),                        'Author');
const Compare            = lazyNamed(() => import('./pages/Compare/Compare'),                      'Compare');
const StaticPage         = lazy(()       => import('./pages/Static/StaticPage'));

// Programmatic
const NichePage     = lazyNamed(() => import('./pages/Niche/NichePage'), 'NichePage');
const RatePage      = lazyNamed(() => import('./pages/Niche/NichePage'), 'RatePage');
const ThresholdPage = lazyNamed(() => import('./pages/Niche/NichePage'), 'ThresholdPage');
const ResearchPage  = lazyNamed(() => import('./pages/Niche/NichePage'), 'ResearchPage');

// Product (authenticated)
const Onboarding  = lazyNamed(() => import('./pages/Onboarding/Onboarding'),   'Onboarding');
const Dashboard   = lazyNamed(() => import('./pages/Dashboard/Dashboard'),     'Dashboard');
const GapTracker  = lazyNamed(() => import('./pages/GapTracker/GapTracker'),   'GapTracker');
const Tasks       = lazyNamed(() => import('./pages/Tasks/Tasks'),             'Tasks');
const Connections = lazyNamed(() => import('./pages/Connections/Connections'), 'Connections');
const Toolkit     = lazyNamed(() => import('./pages/Toolkit/Toolkit'),         'Toolkit');
const Outreach    = lazyNamed(() => import('./pages/Outreach/Outreach'),       'Outreach');
const Negotiations= lazyNamed(() => import('./pages/Negotiations/Negotiations'),'Negotiations');
const Settings    = lazyNamed(() => import('./pages/Settings/Settings'),       'Settings');
const PowerHub    = lazyNamed(() => import('./pages/PowerHub/PowerHub'),       'PowerHub');
const Community   = lazyNamed(() => import('./pages/Community/Community'),     'Community');

// Admin
const AdminLayout      = lazyNamed(() => import('./pages/Admin/AdminLayout'),       'AdminLayout');
const AdminDashboard   = lazyNamed(() => import('./pages/Admin/AdminDashboard'),    'AdminDashboard');
const AdminPlaceholder = lazyNamed(() => import('./pages/Admin/AdminPlaceholder'),  'AdminPlaceholder');
const Subscribers      = lazyNamed(() => import('./pages/Admin/Subscribers'),       'Subscribers');
const Content          = lazyNamed(() => import('./pages/Admin/Content'),           'Content');
const TokenCleanup     = lazyNamed(() => import('./pages/Admin/TokenCleanup'),      'TokenCleanup');
const Team             = lazyNamed(() => import('./pages/Admin/Team'),              'Team');
const Acquisition      = lazyNamed(() => import('./pages/Admin/Acquisition'),       'Acquisition');
const ContentSession   = lazyNamed(() => import('./pages/Admin/ContentSession'),    'ContentSession');
const EditorialHome    = lazyNamed(() => import('./pages/Admin/EditorialHome'),     'EditorialHome');
const EditorialSession = lazyNamed(() => import('./pages/Admin/EditorialSession'),  'EditorialSession');
const VoiceMemory      = lazyNamed(() => import('./pages/Admin/VoiceMemory'),       'VoiceMemory');
const Skills           = lazyNamed(() => import('./pages/Admin/Skills'),            'Skills');
const AdminRoadmap     = lazyNamed(() => import('./pages/Admin/AdminRoadmap'),      'AdminRoadmap');
const AdminCommunity   = lazyNamed(() => import('./pages/Admin/AdminCommunity'),    'AdminCommunity');

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public */}
              <Route path="/login"              element={<Login />} />
              <Route path="/signup"             element={<Signup />} />
              <Route path="/scoring-explained"  element={<ScoringMethodology />} />
              <Route path="/blog"               element={<BlogIndex />} />
              <Route path="/blog/:slug"         element={<BlogArticle />} />
              <Route path="/honesty"            element={<Honesty />} />
              <Route path="/pricing"            element={<Pricing />} />
              <Route path="/score"              element={<ScoreForm />} />
              <Route path="/about"              element={<About />} />
              <Route path="/author/anthony-saulderson" element={<Author />} />
              <Route path="/compare/:competitor"       element={<Compare />} />
              <Route path="/niche/:slug"               element={<NichePage />} />
              <Route path="/rates/:country/:niche"     element={<RatePage />} />
              <Route path="/threshold/:metric"         element={<ThresholdPage />} />
              <Route path="/research/:slug"            element={<ResearchPage />} />
              <Route path="/:slug"                     element={<StaticPage />} />

              {/* Admin */}
              <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
                <Route index                          element={<AdminDashboard />} />
                <Route path="editorial"               element={<EditorialHome />} />
                <Route path="editorial/session"       element={<EditorialSession />} />
                <Route path="editorial/voice-memory"  element={<VoiceMemory />} />
                <Route path="skills"                  element={<Skills />} />
                <Route path="subscribers"             element={<Subscribers />} />
                <Route path="content"                 element={<Content />} />
                <Route path="content/session/:id"     element={<ContentSession />} />
                <Route path="team"                    element={<Team />} />
                <Route path="acquisition"             element={<Acquisition />} />
                <Route path="agents"                  element={<AdminPlaceholder title="Agents" />} />
                <Route path="system"                  element={<AdminPlaceholder title="System" />} />
                <Route path="token-cleanup"           element={<TokenCleanup />} />
                <Route path="revenue"                 element={<AdminPlaceholder title="Revenue" />} />
                <Route path="roadmap"                 element={<AdminRoadmap />} />
                <Route path="community"               element={<AdminCommunity />} />
              </Route>

              {/* Authenticated product */}
              <Route path="/onboarding"  element={<RequireAuth><Onboarding /></RequireAuth>} />
              <Route path="/dashboard"   element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/gap"         element={<RequireAuth><GapTracker /></RequireAuth>} />
              <Route path="/tasks"       element={<RequireAuth><Tasks /></RequireAuth>} />
              <Route path="/connections" element={<RequireAuth><Connections /></RequireAuth>} />
              <Route path="/outreach"    element={<RequireAuth><Outreach /></RequireAuth>} />
              <Route path="/negotiations"element={<RequireAuth><Negotiations /></RequireAuth>} />
              <Route path="/toolkit"     element={<RequireAuth><Toolkit /></RequireAuth>} />
              <Route path="/settings"    element={<RequireAuth><Settings /></RequireAuth>} />
              <Route path="/power"       element={<RequireAuth><PowerHub /></RequireAuth>} />
              <Route path="/community"   element={<RequireAuth><Community /></RequireAuth>} />

              {/* Root */}
              <Route path="/" element={<Landing />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
