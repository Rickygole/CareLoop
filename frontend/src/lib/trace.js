/*
  Trace event presentation.

  Color carries the event class, but every line also carries the event name
  in text, so nothing here depends on a judge being able to tell teal from
  green.
*/

export const EVENT_STYLE = {
  CALL_INITIATED: { color: '#7DD3FC', label: 'call' },
  CALL_CONNECTED: { color: '#38BDF8', label: 'call' },
  CALL_ENDED: { color: '#64748B', label: 'call' },
  AGENT_SPEECH: { color: '#A78BFA', label: 'speech' },
  PATIENT_SPEECH: { color: '#E5E7EB', label: 'speech' },
  TIER_0_CHECK: { color: '#94A3B8', label: 'tier 0' },
  TIER_0_MATCH: { color: '#FBBF24', label: 'tier 0', flash: true },
  NORMALIZE: { color: '#22D3EE', label: 'tier 1' },
  TIER_1_CLASSIFY: { color: '#4ADE80', label: 'tier 1' },
  ACTION_DECIDED: { color: '#F472B6', label: 'action' },
  TOOL_CALL: { color: '#C084FC', label: 'tool' },
  BOOKING_CONFIRMED: { color: '#2DD4BF', label: 'booking' },
  BACKBOARD_WRITE: { color: '#A3A3A3', label: 'memory' },
  EMERGENCY_ESCALATION: {
    color: '#FF5A5A',
    label: 'emergency',
    bold: true,
    noFade: true,
  },
}

export const DEFAULT_STYLE = { color: '#8B8B8B', label: 'event' }

export function styleFor(eventType) {
  return EVENT_STYLE[eventType] || DEFAULT_STYLE
}

/* Time of day only. The date is always today during a demo. */
export function clockTime(isoString) {
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return '--:--:--'
  const pad = (n) => String(n).padStart(2, '0')
  return (
    pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
  )
}

/* One line of payload, readable at a glance, never wider than the panel. */
export function summarize(event) {
  const p = event.payload || {}
  switch (event.event_type) {
    case 'PATIENT_SPEECH':
    case 'AGENT_SPEECH':
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
