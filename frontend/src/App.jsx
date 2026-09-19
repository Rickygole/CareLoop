import { Navigate, Route, Routes } from 'react-router-dom'

import CareLoopPage from './pages/CareLoop.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CareLoopPage />} />
      <Route path="/dashboard" element={<CareLoopPage />} />
      <Route path="/admin-demo" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
