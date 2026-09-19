export const EVENT_STYLE = {
  CALL_INITIATED: { color: '#7B8C9E', label: 'call' },
  CALL_CONNECTED: { color: '#4FA8C9', label: 'call' },
  CALL_ENDED: { color: '#778799', label: 'call' },
  REMINDER_DUE: { color: '#E9E3D7', label: 'reminder' },
  AGENT_SPEECH: { color: '#A695CB', label: 'speech' },
  PATIENT_SPEECH: { color: '#E9E3D7', label: 'speech' },
  TIER_0_CHECK: { color: '#8A9AAB', label: 'tier 0' },
  TIER_0_MATCH: { color: '#E3A13B', label: 'tier 0', flash: true, accent: true },
  NORMALIZE: { color: '#4FA8C9', label: 'tier 1' },
  TIER_1_CLASSIFY: { color: '#63C9AC', label: 'tier 1', accent: true },
  ACTION_DECIDED: { color: '#D2694B', label: 'action', accent: true },
  TOOL_CALL: { color: '#9A8FBE', label: 'tool' },
  CLINIC_CALL_INITIATED: { color: '#4FA8C9', label: 'clinic call' },
  CLINIC_AGENT_SPEECH: { color: '#A695CB', label: 'clinic speech' },
  CLINIC_DESK_SPEECH: { color: '#4FA8C9', label: 'clinic speech' },
  CLINIC_CALL_ENDED: { color: '#778799', label: 'clinic call' },
  BOOKING_CONFIRMED: { color: '#4FB89B', label: 'booking' },
  PATIENT_CONFIRMED: { color: '#4FB89B', label: 'confirm' },
  BACKBOARD_WRITE: { color: '#77839A', label: 'memory' },
  EMERGENCY_ESCALATION: {
    color: '#F2635A',
    label: 'emergency',
    bold: true,
    noFade: true,
    accent: true,
  },
}

export const DEFAULT_STYLE = { color: '#8A9AAB', label: 'event' }

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
