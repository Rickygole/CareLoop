import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'

afterEach(cleanup)

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
  next_dose: { medication: 'Metformin', dosage: '500mg', time: '20:00', status: 'upcoming' },
  doses: [
    { medication: 'Metformin', dosage: '500mg', medication_id: 'med1', prescriber: 'Dr. Elena Vance', time: '08:00', status: 'taken' },
    { medication: 'Metformin', dosage: '500mg', medication_id: 'med1', prescriber: 'Dr. Elena Vance', time: '20:00', status: 'upcoming' },
  ],
}

vi.mock('./src/lib/api.js', async () => {
  const actual = await vi.importActual('./src/lib/api.js')
  return {
    ...actual,
    health: vi.fn(async () => ({ status: 'ok' })),
    connectPatient: vi.fn(async () => ({ patient: PATIENT })),
    schedule: vi.fn(async () => PLAN),
  }
})

import App from './src/App.jsx'
import RunNarrative from './src/components/RunNarrative.jsx'
import TriageResult from './src/components/TriageResult.jsx'
import ClinicCall from './src/components/ClinicCall.jsx'
import MedicationCard from './src/components/MedicationCard.jsx'

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

test('page renders', () => {
  render(<HashRouter><App /></HashRouter>)
  expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
  expect(document.getElementById('free-text')).toBeTruthy()
  fireEvent.click(screen.getByText('Connect the portal'))
  expect(screen.getByRole('dialog')).toBeTruthy()
})

test('run pieces render', () => {
  render(<div>
    <TriageResult result={{ tier: 'moderate', source: 'llm', reasoning: 'r', suggested_agent_response: 'ok' }} latencyMs={412} />
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

test('portal connects and the prescription list arrives', async () => {
  render(<HashRouter><App /></HashRouter>)
  fireEvent.click(screen.getByText('Connect the portal'))
  fireEvent.click(screen.getByText('Yes, connect my portal'))
  await screen.findByText('Maria Santos')
  expect(screen.getByText('Metformin')).toBeTruthy()
  expect(screen.getByText(/twice daily/)).toBeTruthy()
  expect(screen.getByText(/mild nausea/)).toBeTruthy()
  expect(screen.getByText(/did not pick up/)).toBeTruthy()
  expect(screen.getByText('CareLoop made a note of it on your record.')).toBeTruthy()
  expect(screen.getByText(/tried again on the next round/)).toBeTruthy()
  expect(screen.getAllByText('Nothing urgent').length).toBeGreaterThan(0)
})

test('no booking explains itself', () => {
  render(<ClinicCall events={[]} booking={null} tier="emergency" />)
  expect(screen.getByText(/never books an appointment for an emergency/)).toBeTruthy()
  cleanup()
  render(<ClinicCall events={[]} booking={null} tier="mild" />)
  expect(screen.getByText(/only rings the clinic when/)).toBeTruthy()
  cleanup()
  const { container } = render(<ClinicCall events={[]} booking={null} tier={null} />)
  expect(container.textContent).toBe('')
})
