export const EVENT_STYLE = {
  CALL_INITIATED: { color: '#b9a88f', label: 'call' },
  CALL_CONNECTED: { color: '#8fd2e8', label: 'call' },
  CALL_ENDED: { color: '#b9a88f', label: 'call' },
  REMINDER_DUE: { color: '#fbf0e2', label: 'reminder' },
  AGENT_SPEECH: { color: '#e0cba8', label: 'speech' },
  PATIENT_SPEECH: { color: '#fbf0e2', label: 'speech' },
  TIER_0_CHECK: { color: '#c6b29a', label: 'tier 0' },
  TIER_0_MATCH: { color: '#f2b441', label: 'tier 0', flash: true, accent: true },
  NORMALIZE: { color: '#8fd2e8', label: 'tier 1' },
  TIER_1_CLASSIFY: { color: '#7ed9a8', label: 'tier 1', accent: true },
  ACTION_DECIDED: { color: '#ffa36b', label: 'action', accent: true },
  TOOL_CALL: { color: '#d9c08e', label: 'tool' },
  CLINIC_CALL_INITIATED: { color: '#8fd2e8', label: 'clinic call' },
  CLINIC_AGENT_SPEECH: { color: '#e0cba8', label: 'clinic speech' },
  CLINIC_DESK_SPEECH: { color: '#8fd2e8', label: 'clinic speech' },
  CLINIC_CALL_ENDED: { color: '#b9a88f', label: 'clinic call' },
  BOOKING_CONFIRMED: { color: '#7ed9a8', label: 'booking' },
  PATIENT_CONFIRMED: { color: '#7ed9a8', label: 'confirm' },
  BACKBOARD_WRITE: { color: '#c6b29a', label: 'memory' },
  EMERGENCY_ESCALATION: {
    color: '#ff968c',
    label: 'emergency',
    bold: true,
    noFade: true,
    accent: true,
  },
}

export const DEFAULT_STYLE = { color: '#c6b29a', label: 'event' }

export function styleFor(eventType) {
  return EVENT_STYLE[eventType] || DEFAULT_STYLE
}

export function clockTime(isoString) {
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return '--:--:--'
  const pad = (n) => String(n).padStart(2, '0')
  return (
    pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
  )
}

export function clockShort(isoString) {
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return '--:--'
  const pad = (n) => String(n).padStart(2, '0')
  return pad(d.getHours()) + ':' + pad(d.getMinutes())
}

export function summarize(event) {
  const p = event.payload || {}
  switch (event.event_type) {
    case 'PATIENT_SPEECH':
    case 'AGENT_SPEECH':
    case 'CLINIC_AGENT_SPEECH':
    case 'CLINIC_DESK_SPEECH':
      return quote(p.text)
    case 'REMINDER_DUE':
      return String(p.medication || '?') + ' ' + String(p.time || '') + ' (' + String(p.status || '?') + ')'
    case 'CLINIC_CALL_INITIATED':
      return String(p.provider || '?') + ' (' + String(p.specialty || '?') + ')'
    case 'CLINIC_CALL_ENDED':
      return p.booked ? 'booked' : 'ended, not booked'
    case 'PATIENT_CONFIRMED':
      return quote(p.text)
    case 'TIER_0_CHECK':
      return quote(p.transcript)
    case 'TIER_0_MATCH':
      return 'rules: ' + list(p.rules)
    case 'EMERGENCY_ESCALATION':
      return (
        (p.is_crisis ? 'CRISIS ROUTE (988) ' : 'EMERGENCY ROUTE (911) ') +
        'rules: ' +
        list(p.rules)
      )
    case 'NORMALIZE':
      return quote(p.normalized_text)
    case 'TIER_1_CLASSIFY':
      return (
        'severity=' +
        String(p.severity || '?').toLowerCase() +
        ' source=' +
        String(p.source || '?') +
        (typeof p.confidence === 'number'
          ? ' confidence=' + p.confidence.toFixed(2)
          : '')
      )
    case 'ACTION_DECIDED':
      return 'tier=' + String(p.tier || '?')
    case 'TOOL_CALL':
      return String(p.tool || 'unknown') + ' patient=' + String(p.patient_id || '-')
    case 'BOOKING_CONFIRMED':
      return (
        String(p.provider_name || '?') +
        ' (' +
        String(p.specialty || '?') +
        ') ' +
        String(p.time || '')
      )
    default:
      return compact(p)
  }
}

function quote(text) {
  if (!text) return ''
  const t = String(text).replace(/\s+/g, ' ').trim()
  return '"' + (t.length > 160 ? t.slice(0, 157) + '...' : t) + '"'
}

function list(values) {
  if (!Array.isArray(values) || !values.length) return 'none'
  return values.join(', ')
}

function compact(payload) {
  const keys = Object.keys(payload || {})
  if (!keys.length) return ''
  return keys
    .map((k) => k + '=' + String(payload[k]))
    .join(' ')
    .slice(0, 180)
}
