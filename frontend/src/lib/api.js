import { CALL_ENDPOINTS } from './telephony.js'

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0']

function defaultApiBase() {
  if (typeof window === 'undefined') return 'http://localhost:8000'
  return LOCAL_HOSTS.includes(window.location.hostname)
    ? 'http://localhost:8000'
    : '/api'
}

export const API_BASE = (
  import.meta.env.VITE_API_BASE || defaultApiBase()
).replace(/\/+$/, '')

export const TRACE_TOKEN = import.meta.env.VITE_TRACE_TOKEN || ''

const UNREACHABLE = 'CareLoop could not reach its own service just now.'

export class ApiError extends Error {
  constructor(message, status, technical) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.technical = technical || message
  }
}

const SESSION_HEADER = 'X-CareLoop-Session'
const SESSION_KEY = 'careloop.session'

function sessionId() {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const minted =
      window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : String(Date.now()) + '-' + Math.random().toString(36).slice(2)
    window.sessionStorage.setItem(SESSION_KEY, minted)
    return minted
  } catch {
    return ''
  }
}

async function request(path, options = {}) {
  const id = sessionId()
  if (id) {
    options = {
      ...options,
      headers: { ...(options.headers || {}), [SESSION_HEADER]: id },
    }
  }
  let response
  try {
    response = await fetch(API_BASE + path, options)
  } catch {
    throw new ApiError(UNREACHABLE, 0, 'network failure calling ' + API_BASE + path)
  }

  if (!response.ok) {
    let detail = 'status ' + response.status
    try {
      const body = await response.json()
      if (body && body.detail) detail = String(body.detail)
    } catch {
    }
    throw new ApiError(UNREACHABLE, response.status, detail)
  }

  return response.json()
}

function post(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function connectPatient(patientId) {
  return post('/portal/connect', { patient_id: patientId })
}

export function syncPortal(patientId, acceptChanges) {
  return post('/portal/sync', {
    patient_id: patientId,
    accept_portal_changes: Boolean(acceptChanges),
  })
}

export function triage(transcript, patientId) {
  return post('/triage', { transcript, patient_id: patientId || null })
}

export function runLoop(transcript, patientId) {
  return post('/loop/run', { patient_id: patientId, transcript })
}

export function regimenState(patientId) {
  return request('/regimen/' + encodeURIComponent(patientId))
}

export function schedule(patientId) {
  return request('/schedule/' + encodeURIComponent(patientId))
}

export function book(specialty, urgency, patientId) {
  return post('/book', {
    specialty,
    urgency,
    patient_id: patientId || null,
  })
}

export const CALL_TOKEN = import.meta.env.VITE_CALL_TOKEN || ''

export function ringPatient(patientId) {
  return post(CALL_ENDPOINTS.patient, {
    patient_id: patientId || null,
    secret: CALL_TOKEN || null,
  })
}

export function ringClinic(patientId, specialty) {
  return post(CALL_ENDPOINTS.clinic, {
    patient_id: patientId || null,
    specialty: specialty || null,
    secret: CALL_TOKEN || null,
  })
}

export function callState(leg) {
  return request('/call/state?leg=' + encodeURIComponent(leg || 'checkin'))
}

export function followups(patientId) {
  return request('/followups/' + encodeURIComponent(patientId))
}

export function fetchEventsSince(since) {
  return request('/trace/events?since=' + since)
}

export function health() {
  return request('/health')
}

export function traceSocketUrl() {
  const base = API_BASE.replace(/^http/, 'ws')
  const params = []
  if (TRACE_TOKEN) params.push('token=' + encodeURIComponent(TRACE_TOKEN))
  const id = sessionId()
  if (id) params.push('session_id=' + encodeURIComponent(id))
  return base + '/trace' + (params.length ? '?' + params.join('&') : '')
}
