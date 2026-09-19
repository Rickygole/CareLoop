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

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(API_BASE + path, options)
  } catch {
    throw new ApiError(
      'Cannot reach the CareLoop API at ' + API_BASE + '. Is the backend running?',
      0,
    )
  }

  if (!response.ok) {
    let detail = 'Request failed with status ' + response.status
    try {
      const body = await response.json()
      if (body && body.detail) detail = String(body.detail)
    } catch {
    }
    throw new ApiError(detail, response.status)
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

export function triage(transcript, patientId) {
  return post('/triage', { transcript, patient_id: patientId || null })
}

export function runLoop(transcript, patientId) {
  return post('/loop/run', { patient_id: patientId, transcript })
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

export function fetchEventsSince(since) {
  return request('/trace/events?since=' + since)
}

export function health() {
  return request('/health')
}

export function traceSocketUrl() {
  const base = API_BASE.replace(/^http/, 'ws')
  return base + '/trace' + (TRACE_TOKEN ? '?token=' + encodeURIComponent(TRACE_TOKEN) : '')
}
