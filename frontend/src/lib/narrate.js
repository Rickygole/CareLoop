import { clockLabel, dateTimeLabel } from './format.js'
import { stepIdFor, LOOP_STEPS } from './loop.js'

const OPEN = String.fromCharCode(8220)
const CLOSE = String.fromCharCode(8221)

const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/g

export function humanizeTimes(text) {
  return String(text || '').replace(ISO, (match) => dateTimeLabel(match))
}

export function quoted(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  if (!value) return ''
  return OPEN + value + CLOSE
}

const ACTIONS = {
  logged: 'made a note of it on your record',
  booked: 'booked you an appointment',
  booked_appointment: 'booked you an appointment',
  escalated: 'told you to get help straight away',
  escalated_emergency: 'told you to get help straight away',
  no_answer: 'tried again later',
  none: 'made a note of it on your record',
}

export function actionSentence(action, outcome) {
  if (String(outcome || '').toLowerCase() === 'no_answer') {
    return 'CareLoop left it and tried again on the next round.'
  }
  const key = String(action || '').toLowerCase()
  const phrase = ACTIONS[key] || key.replace(/_/g, ' ')
  return 'CareLoop ' + (phrase || 'made a note of it') + '.'
}

const SILENT = new Set([
  'CALL_CONNECTED',
  'TIER_0_CHECK',
  'NORMALIZE',
  'TOOL_CALL',
  'CLINIC_AGENT_SPEECH',
  'CLINIC_DESK_SPEECH',
  'CLINIC_CALL_ENDED',
  'AGENT_SPEECH',
])

export function sentenceFor(event) {
  const p = (event && event.payload) || {}
  switch (event.event_type) {
    case 'CALL_INITIATED':
      return {
        text: 'CareLoop rang ' + (p.patient || 'you') + ' for the check-in.',
      }
    case 'REMINDER_DUE':
      return {
        text:
          'It was time for ' +
          String(p.medication || 'your medicine') +
          (p.dosage ? ', ' + p.dosage : '') +
          ', due at ' +
          clockLabel(p.time) +
          '.',
      }
    case 'PATIENT_SPEECH':
      return { text: 'You said ' + quoted(humanizeTimes(p.text)), tone: 'said' }
    case 'TIER_0_MATCH':
      return {
        text: 'CareLoop heard words it always treats as urgent.',
        tone: 'flag',
      }
    case 'TIER_1_CLASSIFY':
      return { text: 'It weighed up how serious that sounds.' }
    case 'EMERGENCY_ESCALATION':
      return {
        text: p.is_crisis
          ? 'This is a crisis. CareLoop stayed with you and gave you the 988 lifeline.'
          : 'This is an emergency. CareLoop told you to call 911. Nobody has been notified for you. This prototype cannot contact anyone.',
        tone: 'alarm',
      }
    case 'ACTION_DECIDED': {
      const tier = String(p.tier || '').toLowerCase()
      if (tier === 'moderate' || tier === 'severe') {
        return { text: 'It decided you should be seen by a clinician.' }
      }
      if (tier === 'emergency') {
        return { text: 'It decided this could not wait for an appointment.' }
      }
      return { text: 'It decided nothing further was needed today.' }
    }
    case 'CLINIC_CALL_INITIATED':
      return {
        text:
          'CareLoop phoned ' +
          String(p.provider || 'the clinic') +
          (p.specialty ? ', ' + p.specialty : '') +
          '.',
        tone: 'act',
      }
    case 'BOOKING_CONFIRMED':
      return {
        text:
          'Booked you in with ' +
          String(p.provider_name || 'the clinic') +
          ' for ' +
          dateTimeLabel(p.time) +
          '.',
        tone: 'act',
      }
    case 'PATIENT_CONFIRMED':
      return { text: 'CareLoop told you ' + quoted(humanizeTimes(p.text)), tone: 'said' }
    case 'MEMORY_WRITE':
      return { text: 'Saved to your record, so the next call already knows.' }
    case 'CALL_ENDED':
      return { text: 'The call ended.' }
    default:
      return null
  }
}

export function narrate(events) {
  const lines = []
  for (const event of events || []) {
    if (!event || SILENT.has(event.event_type)) continue
    const sentence = sentenceFor(event)
    if (!sentence || !sentence.text) continue
    lines.push({
      seq: event.seq,
      at: event.timestamp,
      stepId: stepIdFor(event.event_type) || 'memory',
      text: sentence.text,
      tone: sentence.tone || 'plain',
    })
  }
  return lines
}

export function narrateByStep(events) {
  const lines = narrate(events)
  return LOOP_STEPS.map((step) => ({
    ...step,
    lines: lines.filter((line) => line.stepId === step.id),
  }))
}
