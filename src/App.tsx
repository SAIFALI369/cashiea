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
import ActivityLogs from './pages/ActivityLogs'
import ApiKeys from './pages/ApiKeys'
import Compliance from './pages/Compliance'
import CaseStudy from './pages/CaseStudy'
import Subscription from './pages/Subscription'
import SettingsPage from './pages/Settings'

function App() {
  const { user } = useAuth()

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={user ? <Navigate to="/app" replace /> : <Landing />} />
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/app" replace /> : <Signup />} />
      <Route path="/case-study" element={<CaseStudy />} />

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
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
