import { cleanup, render, screen, fireEvent, within } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'

afterEach(cleanup)

function startAtFirstScreen() {
  window.location.hash = '#/signin'
}

function signIn() {
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
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

const ALLERGIES = [
  { substance: 'Penicillin', reaction: 'hives', criticality: 'low', recorded_on: '2021-03-14' },
]

const CONTACT_WINDOW = { start: '08:00', end: '19:00', timezone: 'America/New_York' }

const SHARED = ['Active medication list', 'Dose schedule', 'Allergies', 'Preferred contact window']

const PORTAL_LIMITATIONS = 'Synthetic portal. The bundle is shaped like FHIR R4 and is not validated against a FHIR server.'

const FIRST_SYNC = {
  patient_id: 'p1',
  synced_at: '2026-09-19T06:00:00Z',
  source: 'MyHealth',
  shared: SHARED,
  bundle: { resourceType: 'Bundle', type: 'searchset', timestamp: '2026-09-19T06:00:00Z', total: 3, entry: [] },
  medications: PATIENT.medication_requests,
  allergies: ALLERGIES,
  preferred_contact_window: CONTACT_WINDOW,
  schedule: PLAN,
  regimen: REGIMEN.regimen,
  diff: { first_sync: true, changed: false, added: [], removed: [], modified: [] },
  diff_summary: 'First sync. The medication list came across from the portal.',
  portal_has_pending_change: true,
  applied: [],
  limitations: PORTAL_LIMITATIONS,
}

const PULLED_MEDICATIONS = [
  ...PATIENT.medication_requests,
  { medication_id: 'med-2-p1', medication: 'Warfarin', frequency: 'once daily', prescriber: 'Dr. Ana Reyes' },
]

const AFTER_PORTAL_PULL = {
  patient_id: 'p1',
  synced_at: '2026-09-19T06:05:00Z',
  source: 'MyHealth',
  shared: SHARED,
  bundle: { resourceType: 'Bundle', type: 'searchset', timestamp: '2026-09-19T06:05:00Z', total: 4, entry: [] },
  medications: PULLED_MEDICATIONS,
  allergies: ALLERGIES,
  preferred_contact_window: CONTACT_WINDOW,
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
  diff: {
    first_sync: false,
    changed: true,
    added: [{ medication_id: 'med-2-p1', medication: 'Warfarin', prescriber: 'Dr. Ana Reyes' }],
    removed: [],
    modified: [],
  },
  diff_summary: 'The portal reports a change. Warfarin was added by Dr. Ana Reyes.',
  portal_has_pending_change: false,
  applied: ['Warfarin'],
  limitations: PORTAL_LIMITATIONS,
}

const FOLLOWUPS = {
  patient_id: 'p1',
  as_of: '2026-09-19T06:00:00Z',
  payer_display: 'Aetna',
  payer_id: 'aetna-001',
  preferred_contact_window: CONTACT_WINDOW,
  booked_count: 1,
  visits: [
    {
      note_id: 'note-1',
      status: 'booked',
      specialty: 'Cardiology',
      provider_name: 'Dr. Elena Vance',
      slot_local: 'Tuesday, September 22 at 12:00 PM',
      due_date: '2026-09-22',
      in_network: true,
      payer_display: 'Aetna',
      prescriber: 'Dr. Elena Vance',
      reason: 'Dr. Elena Vance asked for a cardiology review in one week.',
      issue: null,
      issue_detail: null,
      reminders: [
        { kind: 'day_before', fire_at: '2026-09-21T18:00:00-04:00', visit_local: 'Tuesday, September 22 at 12:00 PM', provider_name: 'Dr. Elena Vance', script: 'Reminder.' },
        { kind: 'same_day', fire_at: '2026-09-22T09:00:00-04:00', visit_local: 'Tuesday, September 22 at 12:00 PM', provider_name: 'Dr. Elena Vance', script: 'Reminder.' },
      ],
    },
    {
      note_id: 'note-2',
      status: 'unbookable',
      specialty: 'Endocrinology',
      provider_name: null,
      slot_local: null,
      due_date: '2026-09-30',
      in_network: false,
      payer_display: 'CareFirst BlueCross',
      prescriber: 'Dr. Ana Reyes',
      reason: 'Dr. Ana Reyes asked for an endocrinology review.',
      issue: 'no_in_network_provider',
      issue_detail: 'No Endocrinology provider in network for CareFirst BlueCross.',
      reminders: [],
    },
  ],
  reminders: [],
  disclosure: 'CareLoop tells the front desk it is an automated assistant calling on behalf of the patient.',
}

const CALL_STATE = {
  leg: 'checkin',
  phase: 'ringing',
  wording: 'Your phone is ringing now.',
  attempt: 1,
  max_attempts: 3,
  retrying: false,
  call_sid: 'CA123',
}

vi.mock('./src/lib/telephony.js', async () => {
  const actual = await vi.importActual('./src/lib/telephony.js')
  return { ...actual, isConfigured: () => true }
})

vi.mock('./src/lib/api.js', async () => {
  const actual = await vi.importActual('./src/lib/api.js')
  return {
    ...actual,
    health: vi.fn(async () => ({ status: 'ok' })),
    connectPatient: vi.fn(async () => ({ patient: PATIENT })),
    regimenState: vi.fn(async () => REGIMEN),
    syncPortal: vi.fn(async (patientId, acceptChanges) =>
      acceptChanges ? AFTER_PORTAL_PULL : FIRST_SYNC,
    ),
    schedule: vi.fn(async () => PLAN),
    followups: vi.fn(async () => FOLLOWUPS),
    callState: vi.fn(async () => CALL_STATE),
  }
})

import App from './src/App.jsx'
import RunNarrative from './src/components/RunNarrative.jsx'
import TriageResult from './src/components/TriageResult.jsx'
import ClinicCall from './src/components/ClinicCall.jsx'
import MedicationCard from './src/components/MedicationCard.jsx'
import SimulatedCall from './src/components/SimulatedCall.jsx'
import { callState } from './src/lib/api.js'
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

test('the sign in screen is the first screen and it is an honest demo gate', () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Sign in to CareLoop/)
  expect(screen.getByLabelText('Email address').value).toBe('demo@careloop.health')
  expect(screen.getByLabelText('Password').value).toBe('careloop-demo')
  expect(screen.queryByText('The demo account')).toBe(null)
  expect(screen.queryByRole('button', { name: /Fill in the demo account/ })).toBe(null)
  expect(screen.getByText(/Never type a real password into a demonstration/)).toBeTruthy()

  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'someone@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nope' } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(screen.getByRole('alert').textContent).toMatch(/not the demo account/)
  fireEvent.click(screen.getByRole('button', { name: /Put the demo account back/ }))
  expect(screen.getByLabelText('Email address').value).toBe('demo@careloop.health')
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Sign in to CareLoop/)

  fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
  expect(screen.getByText(/There are no new accounts to create/)).toBeTruthy()
})

test('signing in lands on the dashboard, not on a wizard step', async () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  signIn()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Today/)
  expect(screen.getByText(/Connect MyHealth to see your medicines/)).toBeTruthy()
  expect(screen.getByText('Sign out')).toBeTruthy()
  expect(screen.getByText('Demo system. All patient data is synthetic.')).toBeTruthy()

  const tabs = screen.getByRole('navigation', { name: 'Sections' })
  for (const label of ['Today', 'Medications', 'Check-in', 'Appointments', 'Safety']) {
    expect(within(tabs).getByText(label)).toBeTruthy()
  }
  expect(within(tabs).queryByText('Locked')).toBe(null)
  expect(within(tabs).getByText('Today').closest('a').getAttribute('aria-current')).toBe('page')

  fireEvent.click(within(tabs).getByText('Appointments'))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Appointments/)

  fireEvent.click(screen.getAllByText(/^Connect MyHealth$/)[0])
  expect(screen.getByText(/Who is this check-in for\?/)).toBeTruthy()
  fireEvent.click(screen.getByText(/^Connect MyHealth for/))
  const dialog = screen.getByRole('dialog')
  expect(dialog.textContent).toMatch(/MyHealth will share with CareLoop/)
  expect(screen.getByText('Allow')).toBeTruthy()
  expect(screen.getByText('Deny')).toBeTruthy()
})

test('denying shares nothing and stays on the connect screen', () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  signIn()
  fireEvent.click(screen.getAllByText(/^Connect MyHealth$/)[0])
  fireEvent.click(screen.getByText(/^Connect MyHealth for/))
  fireEvent.click(screen.getByText('Deny'))
  expect(screen.getByText(/Nothing was shared/)).toBeTruthy()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Connect MyHealth/)
  window.location.hash = '#/signin'
})

async function connectAndOpenMedications() {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  signIn()
  fireEvent.click(screen.getAllByText(/^Connect MyHealth$/)[0])
  fireEvent.click(screen.getByText(/^Connect MyHealth for/))
  fireEvent.click(screen.getByText('Allow'))
  await screen.findByRole('heading', { level: 1, name: /Today/ }, { timeout: 4000 })
  const tabs = screen.getByRole('navigation', { name: 'Sections' })
  fireEvent.click(within(tabs).getByText('Medications'))
  await screen.findByRole('heading', { level: 1, name: 'Medications' }, { timeout: 4000 })
}

test('the dashboard shows the next call, the medicines and the next appointment', async () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  signIn()
  fireEvent.click(screen.getAllByText(/^Connect MyHealth$/)[0])
  fireEvent.click(screen.getByText(/^Connect MyHealth for/))
  fireEvent.click(screen.getByText('Allow'))
  await screen.findByRole('heading', { level: 1, name: /Today/ }, { timeout: 4000 })
  expect(screen.getAllByText('Metformin').length).toBeGreaterThan(0)
  await screen.findByText('Tuesday, September 22 at 12:00 PM', {}, { timeout: 4000 })
  expect(screen.getByText(/Covered by Aetna/)).toBeTruthy()
  expect(screen.getByText(/Demonstration controls, not part of the patient product/)).toBeTruthy()
}, 10000)

test('the appointments section shows the booking, the reminders and the refusal', async () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  signIn()
  fireEvent.click(screen.getAllByText(/^Connect MyHealth$/)[0])
  fireEvent.click(screen.getByText(/^Connect MyHealth for/))
  fireEvent.click(screen.getByText('Allow'))
  await screen.findByRole('heading', { level: 1, name: /Today/ }, { timeout: 4000 })
  const tabs = screen.getByRole('navigation', { name: 'Sections' })
  fireEvent.click(within(tabs).getByText('Appointments'))
  await screen.findByText('Dr. Elena Vance', {}, { timeout: 4000 })
  expect(screen.getByText('Aetna')).toBeTruthy()
  expect(screen.getByText(/In network with/)).toBeTruthy()
  expect(screen.getByText(/asked for a cardiology review/)).toBeTruthy()
  expect(screen.getByText(/The day before/)).toBeTruthy()
  expect(screen.getByText(/On the day/)).toBeTruthy()
  expect(screen.getByText('No Endocrinology provider in network for CareFirst BlueCross.')).toBeTruthy()
  expect(screen.getByText(/8:00 AM/)).toBeTruthy()
  expect(screen.getByText(/automated assistant calling on behalf of the patient/)).toBeTruthy()
}, 10000)

test('the medicines section renders what the portal sent', async () => {
  await connectAndOpenMedications()
  expect(screen.getAllByText('Metformin').length).toBeGreaterThan(0)
  expect(screen.getByText('a1b2c3d4e5f6')).toBeTruthy()
  expect(screen.getByText(/Not a formulary check/)).toBeTruthy()
  await screen.findByText(/Your prescriber has sent a new prescription to MyHealth/, {}, { timeout: 4000 })
  expect(screen.getByText('Check MyHealth for updates')).toBeTruthy()
  expect(screen.queryByText(/Add to the list/)).toBe(null)
  expect(screen.getByText('Penicillin')).toBeTruthy()
  expect(screen.getByText(/8:00 AM to 7:00 PM/)).toBeTruthy()
  expect(screen.getByText('First sync. The medication list came across from the portal.')).toBeTruthy()
  expect(screen.getByText('Move the clock to the next dose')).toBeTruthy()
  expect(screen.getByRole('heading', { name: /Nothing on this list conflicts/ })).toBeTruthy()
}, 10000)

test('a medicine arriving from the portal cascades through snapshot, schedule and flag', async () => {
  await connectAndOpenMedications()
  await screen.findByText('a1b2c3d4e5f6', {}, { timeout: 4000 })

  fireEvent.click(
    await screen.findByText('Pull the new prescription from MyHealth', {}, { timeout: 4000 }),
  )

  await screen.findByText('9f9f9f9f9f9f', {}, { timeout: 4000 })
  expect(screen.getAllByText(/replaces a1b2c3d4e5f6/).length).toBeGreaterThan(0)
  expect(screen.getByText(/Warfarin arrived from MyHealth/)).toBeTruthy()
  expect(screen.getByText('The portal reports a change. Warfarin was added by Dr. Ana Reyes.')).toBeTruthy()
  const callList = screen.getByRole('region', { name: /Every call today/ })
  await within(callList).findByText(/18:00|6:00 PM/, {}, { timeout: 4000 })
  await screen.findByText(/warfarin and aspirin/i, {}, { timeout: 4000 })
  expect(screen.getByText(/FDA label, Coumadin/)).toBeTruthy()
  expect(screen.getByText(/1 finding was detected and held back/)).toBeTruthy()
  expect(screen.queryByText(/lisinopril and ibuprofen/i)).toBeTruthy()
}, 15000)

test('the check-in summary explains itself with no run', async () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  signIn()
  window.location.hash = '#/decision'
  const heading = await screen.findByRole('heading', { level: 1, name: /Check-in summary/ })
  expect(heading).toBeTruthy()
  expect(screen.getByText(/No check-in has been taken yet/)).toBeTruthy()
  expect(screen.getByText(/Go to the check-in/)).toBeTruthy()
  window.location.hash = '#/signin'
})

test('every section is behind the sign in screen', () => {
  window.location.hash = '#/meds'
  render(<HashRouter><App /></HashRouter>)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Sign in to CareLoop/)
  window.location.hash = '#/signin'
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

const NEXT_DOSE = {
  medication: 'Metformin',
  dosage: '500mg',
  indication: 'for your blood sugar',
  medication_id: 'med1',
  time: '20:00',
  status: 'upcoming',
}

function renderCall() {
  return render(
    <HashRouter>
      <SimulatedCall
        patientName="Maria Santos"
        nextDose={NEXT_DOSE}
        scenarios={[]}
        busy={false}
        error={null}
        onReply={async () => null}
        onRing={async () => ({ call_sid: 'CA9' })}
      />
    </HashRouter>,
  )
}

test('the phone call reports what it is doing, including a redial', async () => {
  callState.mockResolvedValueOnce({
    leg: 'checkin',
    phase: 'redialling',
    wording: 'That call did not go through. CareLoop is ringing you again now.',
    attempt: 2,
    max_attempts: 3,
    retrying: true,
    call_sid: 'CA9',
  })

  renderCall()
  expect(screen.getByText(/Simulated call. CareLoop is not speaking to you/)).toBeTruthy()

  fireEvent.click(screen.getByText('Call my phone now'))
  await screen.findByText(/CareLoop is ringing you again now/, {}, { timeout: 4000 })
  expect(screen.getByText('Attempt 2 of 3')).toBeTruthy()
  expect(screen.getByText('Calling again')).toBeTruthy()
  expect(screen.getByText('Not the path you are on')).toBeTruthy()
  expect(screen.getByText('Read the check-in in writing').closest('button').disabled).toBe(true)
}, 10000)

test('answering the phone does not brick the screen', async () => {
  const base = { leg: 'checkin', attempt: 1, max_attempts: 3, retrying: false, call_sid: 'CA9' }
  callState.mockResolvedValueOnce({ ...base, phase: 'ringing', wording: 'Your phone is ringing now.' })
  callState.mockResolvedValueOnce({ ...base, phase: 'answered', wording: 'You are on the call with CareLoop.' })
  callState.mockResolvedValue({ ...base, phase: 'ended', wording: 'The check-in is finished.' })

  renderCall()
  fireEvent.click(screen.getByText('Call my phone now'))

  await screen.findByText(/You are on the call with CareLoop/, {}, { timeout: 5000 })
  await screen.findByText(/The check-in is finished/, {}, { timeout: 8000 })

  expect(screen.getByText('Call my phone now').closest('button').disabled).toBe(false)
  expect(screen.getByText('Read the check-in in writing').closest('button').disabled).toBe(false)
}, 20000)

test('the written stand-in says what the phone call says', async () => {
  renderCall()
  expect(screen.getByText(/not a recording of the real phone call/)).toBeTruthy()

  fireEvent.click(screen.getByText('Read the check-in in writing'))
  await screen.findByText(/This is CareLoop, your medication assistant/, {}, { timeout: 4000 })
  await screen.findByText(/Have you been able to take it/, {}, { timeout: 4000 })
  expect(screen.queryByText(/Do you have a couple of minutes/)).toBe(null)
  expect(screen.queryByText(/Did you take your/)).toBe(null)
  expect(screen.getByText('Call my phone now').closest('button').disabled).toBe(true)
}, 10000)

function accessibleName(element) {
  const label = element.getAttribute('aria-label')
  return String(label || element.textContent || '').trim()
}

async function openSection(label, heading) {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  signIn()
  fireEvent.click(screen.getAllByText(/^Connect MyHealth$/)[0])
  fireEvent.click(screen.getByText(/^Connect MyHealth for/))
  fireEvent.click(screen.getByText('Allow'))
  await screen.findByRole('heading', { level: 1, name: /Today/ }, { timeout: 4000 })
  if (!label) return
  const tabs = screen.getByRole('navigation', { name: 'Sections' })
  fireEvent.click(within(tabs).getByText(label))
  await screen.findByRole('heading', { level: 1, name: heading }, { timeout: 4000 })
}

test('every control on the medicines section is a button the accessibility tree can see', async () => {
  await connectAndOpenMedications()
  await screen.findByText(/Your prescriber has sent a new prescription/, {}, { timeout: 4000 })

  const buttons = screen.getAllByRole('button')
  expect(buttons.length).toBeGreaterThan(0)
  for (const button of buttons) {
    expect(accessibleName(button).length).toBeGreaterThan(0)
    expect(button.tagName).toBe('BUTTON')
  }

  expect(screen.getByRole('button', { name: /Check MyHealth for updates/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Pull the new prescription from MyHealth/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Move the clock to the next dose/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /detected and held back/ })).toBeTruthy()
}, 15000)

test('the held back findings open from the keyboard and say so to a screen reader', async () => {
  await connectAndOpenMedications()

  const disclosure = await screen.findByRole('button', { name: /detected and held back/ }, { timeout: 4000 })
  expect(disclosure.tagName).toBe('BUTTON')
  expect(disclosure.getAttribute('type')).toBe('button')
  expect(disclosure.getAttribute('aria-expanded')).toBe('false')

  const panel = document.getElementById(disclosure.getAttribute('aria-controls'))
  expect(panel).toBeTruthy()
  expect(panel.hidden).toBe(true)

  disclosure.focus()
  expect(document.activeElement).toBe(disclosure)

  fireEvent.keyDown(disclosure, { key: 'Enter', code: 'Enter' })
  fireEvent.click(disclosure)

  expect(disclosure.getAttribute('aria-expanded')).toBe('true')
  expect(panel.hidden).toBe(false)
  expect(panel.textContent).toMatch(/only tells a patient about a finding at major severity/)
}, 15000)

test('the appointments and today sections expose named controls too', async () => {
  await openSection('Appointments', /Appointments/)
  await screen.findByText('Dr. Elena Vance', {}, { timeout: 4000 })
  for (const control of [...screen.getAllByRole('button'), ...screen.getAllByRole('link')]) {
    expect(accessibleName(control).length).toBeGreaterThan(0)
    expect(['BUTTON', 'A']).toContain(control.tagName)
  }
  cleanup()

  await openSection(null)
  for (const control of [...screen.getAllByRole('button'), ...screen.getAllByRole('link')]) {
    expect(accessibleName(control).length).toBeGreaterThan(0)
    expect(['BUTTON', 'A']).toContain(control.tagName)
  }
  expect(screen.getByRole('button', { name: /Move the clock to the next dose/ })).toBeTruthy()
}, 20000)

test('the demo account arrives in the fields so no one types a password', () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  expect(screen.getByLabelText('Email address').value).toBe('demo@careloop.health')
  expect(screen.getByLabelText('Password').value).toBe('careloop-demo')
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Today/)
  window.location.hash = '#/signin'
})
