/*
  Every network call in the app goes through this file.

  One env var, VITE_API_BASE, points the whole frontend at a backend. It
  defaults to localhost so a fresh clone runs with no .env at all.
*/

export const API_BASE = (
  import.meta.env.VITE_API_BASE || 'http://localhost:8000'
).replace(/\/+$/, '')

// Optional shared secret. The backend only checks it when it has one set.
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
      // Non JSON error body. The status line is enough.
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
