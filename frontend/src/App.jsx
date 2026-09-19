import { Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout.jsx'
import AppointmentsPage from './pages/Appointments.jsx'
import CallPage from './pages/Call.jsx'
import ConnectPage from './pages/Connect.jsx'
import DecisionPage from './pages/Decision.jsx'
import MedsPage from './pages/Meds.jsx'
import SafetyPage from './pages/Safety.jsx'
import SignInPage from './pages/SignIn.jsx'
import SignUpPage from './pages/SignUp.jsx'
import TodayPage from './pages/Today.jsx'
import { SessionProvider } from './lib/session.jsx'

export default function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<TodayPage />} />
          <Route path="/connect" element={<ConnectPage />} />
          <Route path="/meds" element={<MedsPage />} />
          <Route path="/call" element={<CallPage />} />
          <Route path="/decision" element={<DecisionPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/safety" element={<SafetyPage />} />
        </Route>
        <Route path="/evidence" element={<Navigate to="/safety" replace />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/admin-demo" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionProvider>
  )
}
