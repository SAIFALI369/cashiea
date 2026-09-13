import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { MotionConfig } from 'framer-motion'
import { useAuth } from './context/AuthContext'
import { rotateRequestId } from './lib/logger'
import { supabaseConfigured, supabaseConfigIssue } from './lib/supabase'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import ErrorBoundary from './components/ErrorBoundary'
import PageMetaSync from './components/PageMetaSync'
import StructuredData from './components/StructuredData'
import NotFound from './pages/NotFound'
import SetupScreen from './components/SetupScreen'

// ── Route-level code splitting: each page is its own chunk. ──
const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/auth/Login'))
const Signup = lazy(() => import('./pages/auth/Signup'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Khata = lazy(() => import('./pages/Khata'))
const Invoices = lazy(() => import('./pages/Invoices'))
const Reports = lazy(() => import('./pages/Reports'))
const DataEntryPage = lazy(() => import('./pages/DataEntry'))
const ProfitDashboard = lazy(() => import('./pages/ProfitDashboard'))
const BankImport = lazy(() => import('./pages/BankImport'))
const GstExport = lazy(() => import('./pages/GstExport'))
const AutoReorder = lazy(() => import('./pages/AutoReorder'))
const CashFlow = lazy(() => import('./pages/CashFlow'))
const Reminders = lazy(() => import('./pages/Reminders'))
const Duplicates = lazy(() => import('./pages/Duplicates'))
const Snapshot = lazy(() => import('./pages/Snapshot'))
const Manifest = lazy(() => import('./pages/Manifest'))
const Goals = lazy(() => import('./pages/Goals'))
const Pricing = lazy(() => import('./pages/Pricing'))
const Scorecard = lazy(() => import('./pages/Scorecard'))
const Social = lazy(() => import('./pages/Social'))
const CommandCenter = lazy(() => import('./pages/CommandCenter'))
const Vasooli = lazy(() => import('./pages/Vasooli'))
const AudioGreetings = lazy(() => import('./pages/AudioGreetings'))
const Summaries = lazy(() => import('./pages/Summaries'))
const EmailAssistant = lazy(() => import('./pages/EmailAssistant'))
const Campaigns = lazy(() => import('./pages/Campaigns'))
const CampaignBuilder = lazy(() => import('./pages/CampaignBuilder'))
const POS = lazy(() => import('./pages/POS'))
const Sales = lazy(() => import('./pages/Sales'))
const Products = lazy(() => import('./pages/Products'))
const Customers = lazy(() => import('./pages/Customers'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const Quotations = lazy(() => import('./pages/Quotations'))
const Accounts = lazy(() => import('./pages/Accounts'))
const AIAssistant = lazy(() => import('./pages/AIAssistant'))
const Team = lazy(() => import('./pages/Team'))
const AIBrain = lazy(() => import('./pages/AIBrain'))
const Integrations = lazy(() => import('./pages/Integrations'))
const ConnectApps = lazy(() => import('./pages/ConnectApps'))
const FailedJobs = lazy(() => import('./pages/FailedJobs'))
const ActivityLogs = lazy(() => import('./pages/ActivityLogs'))
const ApiKeys = lazy(() => import('./pages/ApiKeys'))
const Compliance = lazy(() => import('./pages/Compliance'))
const CaseStudy = lazy(() => import('./pages/CaseStudy'))
const Subscription = lazy(() => import('./pages/Subscription'))
const SettingsPage = lazy(() => import('./pages/Settings'))
const Support = lazy(() => import('./pages/Support'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Terms = lazy(() => import('./pages/Terms'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const AccountPage = lazy(() => import('./pages/Account'))
const AboutPage = lazy(() => import('./pages/About'))
const SuggestionsPage = lazy(() => import('./pages/Suggestions'))
const NotificationsPage = lazy(() => import('./pages/Notifications'))
const PermissionsPage = lazy(() => import('./pages/Permissions'))

// ── Public marketing / content pages (route-completeness layer) ──
const SitePricing = lazy(() => import('./pages/site/Pricing'))
const SiteFeatures = lazy(() => import('./pages/site/Features'))
const SiteAbout = lazy(() => import('./pages/site/About'))
const SiteContact = lazy(() => import('./pages/site/Contact'))
const Security = lazy(() => import('./pages/site/Security'))
const Help = lazy(() => import('./pages/site/Help'))
const HelpArticlePage = lazy(() => import('./pages/site/HelpArticlePage'))
const Blog = lazy(() => import('./pages/site/Blog'))
const BlogPostPage = lazy(() => import('./pages/site/BlogPostPage'))

/** Full-page fallback for the initial/public route load. */
function FullPageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="w-10 h-10 rounded-xl bg-surface-2 animate-pulse" />
    </div>
  )
}

function App() {
  const { user } = useAuth()
  const location = useLocation()

  // New correlation scope per page view: all logs, outgoing AI calls and
  // error reports on this route share one request id (src/lib/logger.ts).
  useEffect(() => {
    rotateRequestId()
  }, [location.pathname])

  if (!supabaseConfigured || supabaseConfigIssue) {
    return <SetupScreen issue={supabaseConfigIssue} />
  }

  return (
    // One place decides how the whole app moves:
    //   • reducedMotion="user" — the OS "reduce motion" setting turns
    //     every transform/layout animation into a fade, app-wide, so no
    //     component can forget it.
    //   • a single default transition — one signature curve everywhere.
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
    <ErrorBoundary>
    <Suspense fallback={<FullPageFallback />}>
      <PageMetaSync />
      <StructuredData />
      <Routes>
        {/* Public */}
        <Route path="/" element={user ? <Navigate to="/app" replace /> : <Landing />} />
        <Route path="/login" element={user ? <Navigate to="/app" replace /> : <Login />} />
        <Route path="/signup" element={user ? <Navigate to="/app" replace /> : <Signup />} />
        <Route path="/case-study" element={<CaseStudy />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/pricing" element={<SitePricing />} />
        <Route path="/features" element={<SiteFeatures />} />
        <Route path="/about" element={<SiteAbout />} />
        <Route path="/contact" element={<SiteContact />} />
        <Route path="/security" element={<Security />} />
        <Route path="/help" element={<Help />} />
        <Route path="/help/:slug" element={<HelpArticlePage />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />

        {/* Onboarding is protected too; it must never show a perpetual spinner
            or call profile/business writes for an anonymous visitor. */}
        <Route path="/app/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

        {/* Protected app */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="pos" element={<POS />} />
          <Route path="sales" element={<Sales />} />
          <Route path="products" element={<Products />} />
          <Route path="customers" element={<Customers />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="quotations" element={<Quotations />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="team" element={<Team />} />
          <Route path="assistant" element={<AIAssistant />} />
          <Route path="brain" element={<AIBrain />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="connect-apps" element={<ConnectApps />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="khata" element={<Khata />} />
          <Route path="reports" element={<Reports />} />
          <Route path="data-entry" element={<DataEntryPage />} />
          <Route path="summaries" element={<Summaries />} />
          <Route path="email-assistant" element={<EmailAssistant />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="campaigns/new" element={<CampaignBuilder />} />
          <Route path="campaigns/:id" element={<CampaignBuilder />} />
          <Route path="activity" element={<ActivityLogs />} />
          <Route path="failed-jobs" element={<FailedJobs />} />
          <Route path="api-keys" element={<ApiKeys />} />
          <Route path="compliance" element={<Compliance />} />
          <Route path="subscription" element={<Subscription />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="support" element={<Support />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="suggestions" element={<SuggestionsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="permissions" element={<PermissionsPage />} />
          <Route path="profit-dashboard" element={<ProfitDashboard />} />
          <Route path="bank-import" element={<BankImport />} />
          <Route path="gst-export" element={<GstExport />} />
          <Route path="manifest" element={<Manifest />} />
          <Route path="command-center" element={<CommandCenter />} />
          <Route path="vasooli" element={<Vasooli />} />
          <Route path="audio" element={<AudioGreetings />} />
          <Route path="auto-reorder" element={<AutoReorder />} />
          <Route path="cash-flow" element={<CashFlow />} />
          <Route path="reminders" element={<Reminders />} />
          <Route path="duplicates" element={<Duplicates />} />
          <Route path="snapshot" element={<Snapshot />} />
          <Route path="goals" element={<Goals />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="scorecard" element={<Scorecard />} />
          <Route path="social" element={<Social />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
    </MotionConfig>
  )
}

export default App
