export const CLINIC_PREFIX = 'CLINIC_'

export const LANES = {
  patient: {
    id: 'patient',
    label: 'Patient call',
    short: 'patient',
    color: '#E9E3D7',
  },
  clinic: {
    id: 'clinic',
    label: 'Clinic call',
    short: 'clinic',
    color: '#4FA8C9',
  },
}

export function laneFor(eventType) {
  return String(eventType || '').startsWith(CLINIC_PREFIX)
    ? LANES.clinic
    : LANES.patient
}

export const LOOP_STEPS = [
  {
    id: 'reminder',
    number: '01',
    title: 'Reminder',
    detail: 'CareLoop places the call when a dose is due, from the schedule on file.',
    patientDetail: 'CareLoop calls you when a dose is due.',
    events: ['CALL_INITIATED', 'CALL_CONNECTED', 'REMINDER_DUE'],
  },
  {
    id: 'checkin',
    number: '02',
    title: 'Check-in',
    detail: 'It asks whether the dose was taken and how the patient is feeling.',
    patientDetail: 'It asks whether you took it and how you feel.',
    events: ['AGENT_SPEECH', 'PATIENT_SPEECH'],
  },
  {
    id: 'triage',
    number: '03',
    title: 'Checking urgency',
    detail: 'Fixed safety rules run first. The computer can make an answer more urgent, never less.',
    patientDetail: 'Anything you report is checked for urgency.',
    events: ['TIER_0_CHECK', 'TIER_0_MATCH', 'NORMALIZE', 'TIER_1_CLASSIFY', 'EMERGENCY_ESCALATION'],
  },
  {
    id: 'action',
    number: '04',
    title: 'Action',
    detail: 'On moderate or severe, CareLoop calls the clinic and books the appointment.',
    patientDetail: 'If you need to be seen, CareLoop books the appointment for you.',
    events: [
      'ACTION_DECIDED',
      'TOOL_CALL',
      'BOOKING_CONFIRMED',
      'CLINIC_CALL_INITIATED',
      'CLINIC_CALL_ENDED',
    ],
  },
  {
    id: 'memory',
    number: '05',
    title: 'Confirm and remember',
    detail: 'The next call starts knowing what happened on this one.',
    patientDetail: 'The next call starts knowing what happened on this one.',
    events: ['BACKBOARD_WRITE', 'PATIENT_CONFIRMED', 'CALL_ENDED'],
  },
]

const STEP_BY_EVENT = LOOP_STEPS.reduce((map, step) => {
  for (const name of step.events) map[name] = step.id
  return map
}, {})

export function stepIdFor(eventType) {
  const name = String(eventType || '')
  if (name.startsWith(CLINIC_PREFIX)) return 'action'
  return STEP_BY_EVENT[name] || null
}

export function stepsFromEvents(events) {
  const buckets = LOOP_STEPS.map((step) => ({ ...step, matches: [] }))
  const indexById = new Map(buckets.map((step, index) => [step.id, index]))

  for (const event of events || []) {
    const id = stepIdFor(event.event_type)
    if (!id) continue
    const index = indexById.get(id)
    if (index === undefined) continue
    buckets[index].matches.push(event)
  }

  return buckets
}

export function loopProgress(events) {
  const reached = new Set()
  let latest = null

  for (const event of events || []) {
    const id = stepIdFor(event.event_type)
    if (!id) continue
    reached.add(id)
    latest = id
  }

  const latestIndex = LOOP_STEPS.findIndex((step) => step.id === latest)

  return LOOP_STEPS.map((step, index) => ({
    ...step,
    reached: reached.has(step.id),
    active: step.id === latest,
    passed: latestIndex >= 0 && index < latestIndex,
  }))
}
