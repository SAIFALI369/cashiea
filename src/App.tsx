import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import Landing from './pages/Landing'
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import Dashboard from './pages/Dashboard'
import Invoices from './pages/Invoices'
import Reports from './pages/Reports'
import DataEntryPage from './pages/DataEntry'
import Summaries from './pages/Summaries'
import EmailAssistant from './pages/EmailAssistant'
import Campaigns from './pages/Campaigns'
import CampaignBuilder from './pages/CampaignBuilder'
import POS from './pages/POS'
import Products from './pages/Products'
import Customers from './pages/Customers'
import Suppliers from './pages/Suppliers'
import Quotations from './pages/Quotations'
import Accounts from './pages/Accounts'
import AIAssistant from './pages/AIAssistant'
import AIBrain from './pages/AIBrain'
import Integrations from './pages/Integrations'
import ActivityLogs from './pages/ActivityLogs'
import ApiKeys from './pages/ApiKeys'
import Compliance from './pages/Compliance'
import CaseStudy from './pages/CaseStudy'
import Subscription from './pages/Subscription'
import SettingsPage from './pages/Settings'
import Support from './pages/Support'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'

function App() {
  const { user } = useAuth()

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={user ? <Navigate to="/app" replace /> : <Landing />} />
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/app" replace /> : <Signup />} />
      <Route path="/case-study" element={<CaseStudy />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

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
        <Route path="products" element={<Products />} />
        <Route path="customers" element={<Customers />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="quotations" element={<Quotations />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="assistant" element={<AIAssistant />} />
        <Route path="brain" element={<AIBrain />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="reports" element={<Reports />} />
        <Route path="data-entry" element={<DataEntryPage />} />
        <Route path="summaries" element={<Summaries />} />
        <Route path="email-assistant" element={<EmailAssistant />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="campaigns/new" element={<CampaignBuilder />} />
        <Route path="campaigns/:id" element={<CampaignBuilder />} />
        <Route path="activity" element={<ActivityLogs />} />
        <Route path="api-keys" element={<ApiKeys />} />
        <Route path="compliance" element={<Compliance />} />
        <Route path="subscription" element={<Subscription />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="support" element={<Support />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
