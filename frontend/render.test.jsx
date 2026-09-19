import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'

afterEach(cleanup)

function startAtFirstScreen() {
  window.location.hash = '#/'
}

const PATIENT = {
  name: 'Maria Santos',
  insurance_display_name: 'Aetna',
  connected_at: '2026-09-19T06:00:00Z',
  medication_requests: [
    { medication_id: 'med1', medication: 'Metformin', frequency: 'twice daily', prescriber: 'Dr. Elena Vance' },
  ],
  history: [
    { call_id: 'call_001', timestamp: '2026-09-17T08:02:00Z', outcome: 'answered', symptom_reported: 'mild nausea', tier: 'mild', action_taken: 'logged' },
    { call_id: 'call_002', timestamp: '2026-09-18T08:02:00Z', outcome: 'no_answer', symptom_reported: null, tier: null, action_taken: 'none' },
  ],
}

const PLAN = {
  as_of: '2026-09-19T06:00:00-04:00',
  next_dose: { medication: 'Metformin', dosage: '500mg', medication_id: 'med1', time: '20:00', status: 'upcoming', due_at: '2026-09-19T20:00:00-04:00' },
  doses: [
    { medication: 'Metformin', dosage: '500mg', medication_id: 'med1', prescriber: 'Dr. Elena Vance', time: '08:00', due_at: '2026-09-19T08:00:00-04:00', status: 'taken' },
    { medication: 'Metformin', dosage: '500mg', medication_id: 'med1', prescriber: 'Dr. Elena Vance', time: '20:00', due_at: '2026-09-19T20:00:00-04:00', status: 'upcoming' },
  ],
  doses_total: 2,
}

const REGIMEN = {
  patient_id: 'p1',
  medications: PATIENT.medication_requests,
  schedule: PLAN,
  regimen: {
    content_hash: 'a1b2c3d4e5f6',
    findings: [],
    surfaced: [],
    patient_message: null,
    limitations: 'Not a formulary check and not a drug interaction database.',
  },
}

const AFTER_ADD = {
  added: true,
  medication_id: 'med-2-p1',
  medications: [
    ...PATIENT.medication_requests,
    { medication_id: 'med-2-p1', medication: 'Warfarin', frequency: 'once daily', prescriber: 'Dr. Ana Reyes' },
  ],
  schedule: {
    ...PLAN,
    doses: [
      ...PLAN.doses,
      { medication: 'Warfarin', dosage: '5mg', medication_id: 'med-2-p1', prescriber: 'Dr. Ana Reyes', time: '18:00', due_at: '2026-09-19T18:00:00-04:00', status: 'upcoming' },
    ],
  },
  regimen: {
    content_hash: '9f9f9f9f9f9f',
    findings: [
      { check_id: 'regimen_pair', ingredients: ['warfarin', 'aspirin'], severity: 'major', concern: 'additive bleeding risk', source: 'FDA label, Coumadin, Drug Interactions', surfaced: true },
      { check_id: 'regimen_pair', ingredients: ['lisinopril', 'ibuprofen'], severity: 'moderate', concern: 'reduced antihypertensive effect', source: 'FDA label, Zestril, Drug Interactions', surfaced: false },
    ],
    surfaced: [
      { check_id: 'regimen_pair', ingredients: ['warfarin', 'aspirin'], severity: 'major', concern: 'additive bleeding risk', source: 'FDA label, Coumadin, Drug Interactions', surfaced: true },
    ],
    patient_message: 'Something on your list looks worth checking.',
    limitations: 'Not a formulary check and not a drug interaction database.',
  },
}

vi.mock('./src/lib/api.js', async () => {
  const actual = await vi.importActual('./src/lib/api.js')
  return {
    ...actual,
    health: vi.fn(async () => ({ status: 'ok' })),
    connectPatient: vi.fn(async () => ({ patient: PATIENT })),
    regimenState: vi.fn(async () => REGIMEN),
    addMedication: vi.fn(async () => AFTER_ADD),
    schedule: vi.fn(async () => PLAN),
  }
})

import App from './src/App.jsx'
import RunNarrative from './src/components/RunNarrative.jsx'
import TriageResult from './src/components/TriageResult.jsx'
import ClinicCall from './src/components/ClinicCall.jsx'
import MedicationCard from './src/components/MedicationCard.jsx'
import { tierMeta } from './src/components/TierBadge.jsx'

const events = [
  { seq: 1, timestamp: '2026-09-19T10:00:00Z', event_type: 'CALL_INITIATED', payload: { patient: 'Maria Santos' } },
  { seq: 2, timestamp: '2026-09-19T10:00:01Z', event_type: 'REMINDER_DUE', payload: { medication: 'Metformin', dosage: '500 mg', time: '08:00', status: 'due_now' } },
  { seq: 3, timestamp: '2026-09-19T10:00:02Z', event_type: 'PATIENT_SPEECH', payload: { text: 'I have been dizzy for two days' } },
  { seq: 4, timestamp: '2026-09-19T10:00:03Z', event_type: 'TIER_1_CLASSIFY', payload: { severity: 'MODERATE' } },
  { seq: 5, timestamp: '2026-09-19T10:00:04Z', event_type: 'CLINIC_CALL_INITIATED', payload: { provider: 'Dr Vance', specialty: 'Internal Medicine' } },
  { seq: 6, timestamp: '2026-09-19T10:00:05Z', event_type: 'CLINIC_AGENT_SPEECH', payload: { text: 'Hello, calling for Maria Santos.' } },
  { seq: 7, timestamp: '2026-09-19T10:00:06Z', event_type: 'BOOKING_CONFIRMED', payload: { provider_name: 'Dr Vance', time: '2026-09-21T10:00:00Z' } },
  { seq: 8, timestamp: '2026-09-19T10:00:07Z', event_type: 'BACKBOARD_WRITE', payload: {} },
  { seq: 9, timestamp: '2026-09-19T10:00:08Z', event_type: 'CALL_ENDED', payload: {} },
]

test('the connect screen is the first screen', () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/We call you/)
  expect(screen.getByText('Demo system. All patient data is synthetic.')).toBeTruthy()
  expect(screen.getByRole('navigation', { name: /five screens, in order/ })).toBeTruthy()
  fireEvent.click(screen.getByText('Connect MyHealth'))
  const dialog = screen.getByRole('dialog')
  expect(dialog.textContent).toMatch(/MyHealth will share with CareLoop/)
  expect(screen.getByText('Allow')).toBeTruthy()
  expect(screen.getByText('Deny')).toBeTruthy()
})

test('denying shares nothing and stays on the first screen', () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  fireEvent.click(screen.getByText('Connect MyHealth'))
  fireEvent.click(screen.getByText('Deny'))
  expect(screen.getByText(/Nothing was shared/)).toBeTruthy()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/We call you/)
})

test('allowing syncs and lands on the medicines screen', async () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  fireEvent.click(screen.getByText('Connect MyHealth'))
  fireEvent.click(screen.getByText('Allow'))
  await screen.findByText(/The list MyHealth sent over/, {}, { timeout: 4000 })
  expect(screen.getAllByText('Metformin').length).toBeGreaterThan(0)
  expect(screen.getByText('a1b2c3d4e5f6')).toBeTruthy()
  expect(screen.getByText(/Not a formulary check/)).toBeTruthy()
  expect(screen.getByText('Add to the list')).toBeTruthy()
  expect(screen.getByText('Move the clock to the next dose')).toBeTruthy()
  expect(screen.getByRole('heading', { name: /Nothing on this list conflicts/ })).toBeTruthy()
}, 10000)

test('adding a medicine cascades through snapshot, schedule and flag', async () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  fireEvent.click(screen.getByText('Connect MyHealth'))
  fireEvent.click(screen.getByText('Allow'))
  await screen.findByText('a1b2c3d4e5f6', {}, { timeout: 4000 })

  fireEvent.click(screen.getByText('Add to the list'))

  await screen.findByText('9f9f9f9f9f9f', {}, { timeout: 4000 })
  expect(screen.getAllByText(/replaces a1b2c3d4e5f6/).length).toBeGreaterThan(0)
  await screen.findByText(/18:00|6:00 PM/, {}, { timeout: 4000 })
  await screen.findByText(/warfarin and aspirin/i, {}, { timeout: 4000 })
  expect(screen.getByText(/FDA label, Coumadin/)).toBeTruthy()
  expect(screen.getByText(/1 finding was detected and held back/)).toBeTruthy()
  expect(screen.queryByText(/lisinopril and ibuprofen/i)).toBeTruthy()
}, 15000)

test('the decision screen explains itself with no run', () => {
  window.location.hash = '#/decision'
  render(<HashRouter><App /></HashRouter>)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Nothing has been decided yet/)
  expect(screen.getByText(/Go to the call and talk to CareLoop/)).toBeTruthy()
  window.location.hash = '#/'
})

test('an unknown tier never renders as moderate', () => {
  expect(tierMeta('moderate')).toBeTruthy()
  expect(tierMeta('')).toBe(null)
  expect(tierMeta(null)).toBe(null)
  expect(tierMeta('tier_9')).toBe(null)

  render(<TriageResult result={{ tier: 'tier_9', source: 'llm' }} latencyMs={10} booking={null} />)
  expect(screen.getByText(/could not decide this time/)).toBeTruthy()
  expect(screen.queryByText(/worth a visit/i)).toBe(null)
})

test('no booking claim is made unless a booking came back', () => {
  render(<TriageResult result={{ tier: 'moderate', source: 'llm', suggested_agent_response: 'ok' }} latencyMs={412} booking={null} />)
  expect(screen.getByText(/No appointment was booked on this call/)).toBeTruthy()
  expect(screen.queryByText(/booked the appointment for you/)).toBe(null)
  cleanup()

  render(<TriageResult result={{ tier: 'moderate', source: 'llm', suggested_agent_response: 'ok' }} latencyMs={412} booking={{ provider_name: 'Dr Vance', time: '2026-09-21T10:00:00Z' }} />)
  expect(screen.getByText(/CareLoop phoned Dr Vance and booked an appointment/)).toBeTruthy()
})

test('run pieces render', () => {
  render(<div>
    <TriageResult result={{ tier: 'moderate', source: 'llm', reasoning: 'r', suggested_agent_response: 'ok' }} latencyMs={412} booking={{ provider_name: 'Dr Vance', time: '2026-09-21T10:00:00Z' }} />
    <RunNarrative events={events} startIndex={2} />
    <ClinicCall events={events} booking={{ provider_name: 'Dr Vance', disclosure: 'This is an automated call.' }} tier="moderate" />
    <ul><MedicationCard index={0} med={{ key: 'm', medication: 'Metformin', dosage: '500 mg', frequency: 'twice a day', prescriber: 'Dr Vance', doses: [{ time: '08:00', status: 'taken' }, { time: '20:00', status: 'upcoming' }] }} /></ul>
  </div>)
  expect(screen.getByText(/This is worth a visit/)).toBeTruthy()
  expect(screen.getByText(/Booked you in with Dr Vance/)).toBeTruthy()
  expect(screen.getByText(/Dr Vance, waited for the front desk/)).toBeTruthy()
})

test('narrator humanizes real payloads', async () => {
  const { narrate, humanizeTimes, actionSentence } = await import('./src/lib/narrate.js')
  const lines = narrate([
    { seq: 1, timestamp: '2026-09-19T10:00:00Z', event_type: 'PATIENT_CONFIRMED', payload: { text: "You're booked with Dr. Elena Vance at 2026-09-20T10:00:00Z." } },
    { seq: 2, timestamp: '2026-09-19T10:00:00Z', event_type: 'ACTION_DECIDED', payload: { tier: 'moderate' } },
    { seq: 3, timestamp: '2026-09-19T10:00:00Z', event_type: 'NORMALIZE', payload: { normalized_text: 'x' } },
  ])
  expect(lines.length).toBe(2)
  expect(lines[0].text).not.toMatch(/T10:00:00Z/)
  expect(lines[1].text).toMatch(/seen by a clinician/)
  expect(humanizeTimes('offer 2026-09-20T10:00:00Z.')).not.toMatch(/T10/)
  expect(actionSentence('logged')).toBe('CareLoop made a note of it on your record.')
})

test('no booking explains itself', () => {
  render(<ClinicCall events={[]} booking={null} tier="emergency" />)
  expect(screen.getByText(/never books an appointment for an emergency/)).toBeTruthy()
  cleanup()
  render(<ClinicCall events={[]} booking={null} tier="mild" />)
  expect(screen.getByText(/only rings the clinic when/)).toBeTruthy()
  cleanup()
  render(<ClinicCall events={[]} booking={null} tier="tier_9" />)
  expect(screen.getByText(/No appointment exists/)).toBeTruthy()
  cleanup()
  const { container } = render(<ClinicCall events={[]} booking={null} tier={null} />)
  expect(container.textContent).toBe('')
})

test('the clock helper moves the day forward', async () => {
  const { applyClockShift, nextDoseShiftMs, clockAfterShift } = await import('./src/lib/clock.js')
  const shift = nextDoseShiftMs(PLAN)
  expect(shift).toBeGreaterThan(0)
  const moved = applyClockShift(PLAN, shift)
  expect(moved.next_dose.status).toBe('due_now')
  expect(clockAfterShift(PLAN.as_of, shift)).toBe('20:00')
})
