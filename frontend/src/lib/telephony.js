export const CALL_ENDPOINTS = {
  patient: '/call/start',
  clinic: '/call/clinic',
}

export const CALL_STATUS = {
  IDLE: 'idle',
  DIALLING: 'dialling',
  RINGING: 'ringing',
  CONNECTED: 'connected',
  ENDED: 'ended',
  UNAVAILABLE: 'unavailable',
}

export function isConfigured() {
  return String(import.meta.env.VITE_TELEPHONY_ENABLED || '').trim() === 'true'
}

export function missingFrom(payload) {
  if (!payload) return []
  const missing = payload.missing || payload.missing_env || []
  return Array.isArray(missing) ? missing.map(String) : []
}

export function callSidFrom(payload) {
  if (!payload) return ''
  return String(payload.call_sid || payload.sid || '')
}

export function statusFromPayload(payload) {
  if (!payload) return CALL_STATUS.UNAVAILABLE
  if (payload.configured === false) return CALL_STATUS.UNAVAILABLE
  return callSidFrom(payload) ? CALL_STATUS.RINGING : CALL_STATUS.UNAVAILABLE
}
