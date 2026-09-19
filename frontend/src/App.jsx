import { Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout.jsx'
import CallPage from './pages/Call.jsx'
import ConnectPage from './pages/Connect.jsx'
import DecisionPage from './pages/Decision.jsx'
import EvidencePage from './pages/Evidence.jsx'
import MedsPage from './pages/Meds.jsx'
import { SessionProvider } from './lib/session.jsx'

export default function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ConnectPage />} />
          <Route path="/meds" element={<MedsPage />} />
          <Route path="/call" element={<CallPage />} />
          <Route path="/decision" element={<DecisionPage />} />
          <Route path="/evidence" element={<EvidencePage />} />
        </Route>
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/admin-demo" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionProvider>
  )
}
