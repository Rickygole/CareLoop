import { cleanup, render, screen, fireEvent, within } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  window.location.hash = '#/signup'
})

function startAtFirstScreen() {
  window.sessionStorage.clear()
  window.location.hash = '#/signup'
}

function openReviewerTools() {
  fireEvent.click(
    screen.getByRole('button', { name: /Show where this list comes from/ }),
  )
}

function signUp() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Sign up and choose my insurance' }),
  )
}

function connect() {
  fireEvent.click(screen.getByText(/^Connect Aetna and load my records$/))
  fireEvent.click(screen.getByText('Allow'))
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
  calls: [
    { at: '2026-09-19T08:00:00-04:00', time: '08:00', status: 'taken', medications: ['Metformin'], medication_ids: ['med1'], covers: 1, moved_into_contact_window: false },
    { at: '2026-09-19T20:00:00-04:00', time: '20:00', status: 'upcoming', medications: ['Metformin'], medication_ids: ['med1'], covers: 1, moved_into_contact_window: false },
  ],
  calls_total: 2,
  contact_window: { start: '08:00', end: '20:00' },
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
      PLAN.doses[0],
      { medication: 'Warfarin', dosage: '5mg', medication_id: 'med-2-p1', prescriber: 'Dr. Ana Reyes', time: '18:00', due_at: '2026-09-19T18:00:00-04:00', status: 'upcoming' },
      PLAN.doses[1],
    ],
    calls: [
      PLAN.calls[0],
      { at: '2026-09-19T18:00:00-04:00', time: '18:00', status: 'upcoming', medications: ['Warfarin'], medication_ids: ['med-2-p1'], covers: 1, moved_into_contact_window: false },
      PLAN.calls[1],
    ],
    calls_total: 3,
    doses_total: 3,
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
import { callState, followups, regimenState, syncPortal, withTimeout } from './src/lib/api.js'
import { tierMeta } from './src/components/TierBadge.jsx'
import { zoneLabel } from './src/components/PortalShared.jsx'
import { flaggedNames, isFlagged, pairLabels, pinFlagged } from './src/lib/flagged.js'
import { SCENARIOS } from './src/data/scenarios.js'

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

test('the sign up screen is the first screen and it collects nothing real', () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
    /Sign up for the CareLoop demonstration/,
  )
  expect(screen.getByLabelText('Full name').value).toBe('Demo Reviewer')
  expect(screen.getByLabelText('Email address').value).toBe('demo@careloop.health')
  expect(screen.getByLabelText('Password').value).toBe('careloop-demo')
  expect(screen.getByText(/Never type a real password into a demonstration/)).toBeTruthy()
  expect(screen.getByText(/No account is created here/)).toBeTruthy()
  expect(screen.getByText(/never ask you for a date of birth/)).toBeTruthy()

  for (const forbidden of [/Date of birth/i, /Member (number|id)/i, /Home address/i, /Social security/i]) {
    expect(screen.queryByLabelText(forbidden)).toBe(null)
  }

  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'someone@example.com' },
  })
  signUp()
  expect(screen.getByRole('alert').textContent).toMatch(/Nothing you type is sent anywhere/)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
    /Sign up for the CareLoop demonstration/,
  )
  fireEvent.click(
    screen.getByRole('button', { name: /Put the demonstration details back and carry on/ }),
  )
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Choose your insurance/)
})

test('the sign in screen is still there for a returning reviewer', () => {
  window.location.hash = '#/signin'
  render(<HashRouter><App /></HashRouter>)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Sign in to CareLoop/)
  expect(screen.getByLabelText('Email address').value).toBe('demo@careloop.health')
  expect(screen.getByLabelText('Password').value).toBe('careloop-demo')
  expect(screen.getByText(/Never type a real password into a demonstration/)).toBeTruthy()

  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'someone@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(screen.getByRole('alert').textContent).toMatch(/not the demo account/)
  fireEvent.click(screen.getByRole('button', { name: /Put the demo account back/ }))
  expect(screen.getByLabelText('Email address').value).toBe('demo@careloop.health')

  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Choose your insurance/)
})

test('signing up lands on the insurance step and nothing is locked', async () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  signUp()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Choose your insurance/)
  expect(screen.getByText('Sign out')).toBeTruthy()
  expect(screen.getByText('Demo system. All patient data is synthetic.')).toBeTruthy()

  expect(screen.getByText(/Who insures you\?/)).toBeTruthy()
  expect(screen.getByText('Aetna')).toBeTruthy()
  expect(screen.getByText('CareFirst BlueCross')).toBeTruthy()
  expect(screen.queryByText('Maria Santos')).toBe(null)
  expect(screen.queryByText('Dorothy Klein')).toBe(null)

  expect(screen.getByRole('heading', { name: /What Aetna means here/ })).toBeTruthy()
  expect(screen.getByText('Aetna Choice network')).toBeTruthy()
  expect(screen.getByText(/No membership is checked and no insurer is contacted/)).toBeTruthy()

  const tabs = screen.getByRole('navigation', { name: 'Sections' })
  for (const label of ['Today', 'Medications', 'Check-in', 'Appointments']) {
    expect(within(tabs).getByText(label)).toBeTruthy()
  }
  expect(within(tabs).queryByText('Locked')).toBe(null)

  fireEvent.click(within(tabs).getByText('Appointments'))
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Appointments/)

  fireEvent.click(within(tabs).getByText('Today'))
  expect(screen.getByText(/Choose your insurance to see your day/)).toBeTruthy()
  fireEvent.click(screen.getAllByText(/^Choose your insurance$/)[0])
  fireEvent.click(screen.getByText(/^Connect Aetna and load my records$/))
  const dialog = screen.getByRole('dialog')
  expect(dialog.textContent).toMatch(/MyHealth will share with CareLoop/)
  expect(dialog.textContent).toMatch(/from your Aetna record/)
  expect(screen.getByText('Allow')).toBeTruthy()
  expect(screen.getByText('Deny')).toBeTruthy()
})

test('the consent modal reaches Deny before Allow, in the order they are drawn', () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  signUp()
  fireEvent.click(screen.getByText(/^Connect Aetna and load my records$/))

  const dialog = screen.getByRole('dialog')
  const buttons = within(dialog).getAllByRole('button')
  const deny = buttons.findIndex((b) => b.textContent.trim() === 'Deny')
  const allow = buttons.findIndex((b) => b.textContent.trim() === 'Allow')
  expect(deny).toBeGreaterThan(-1)
  expect(allow).toBeGreaterThan(deny)
  expect(document.activeElement).toBe(buttons[deny])

  const row = buttons[deny].parentElement
  expect(row.className).not.toMatch(/flex-col-reverse/)
})

test('denying shares nothing and stays on the connect screen', () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  signUp()
  fireEvent.click(screen.getByText(/^Connect Aetna and load my records$/))
  fireEvent.click(screen.getByText('Deny'))
  expect(screen.getByText(/Nothing was shared/)).toBeTruthy()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Choose your insurance/)
})

async function connectAndOpenMedications() {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  signUp()
  connect()
  await screen.findByRole('heading', { level: 1, name: /Today/ }, { timeout: 15000 })
  const tabs = screen.getByRole('navigation', { name: 'Sections' })
  fireEvent.click(within(tabs).getByText('Medications'))
  await screen.findByRole('heading', { level: 1, name: 'Medications' }, { timeout: 15000 })
}

test('the dashboard shows the next call, the medicines and the next appointment', async () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  signUp()
  connect()
  await screen.findByRole('heading', { level: 1, name: /Today/ }, { timeout: 4000 })
  expect(screen.getAllByText(/Metformin/).length).toBeGreaterThan(0)
  expect(
    screen.getAllByText(/CareLoop (called you|rings your telephone|will call again)/).length,
  ).toBe(2)
  expect(screen.getByText('CareLoop called you')).toBeTruthy()
  expect(screen.getByText('CareLoop rings your telephone')).toBeTruthy()
  await screen.findByText(/Tuesday, September 22 at 12:00 PM/, {}, { timeout: 4000 })
  expect(screen.getByText(/Covered by Aetna/)).toBeTruthy()
}, 10000)

test('the appointments section shows the booking, the reminders and the refusal', async () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  signUp()
  connect()
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
  expect(screen.getByRole('heading', { name: /Nothing on this list conflicts/ })).toBeTruthy()
}, 10000)

test('a medicine arriving from the portal cascades through snapshot, schedule and flag', async () => {
  await connectAndOpenMedications()
  openReviewerTools()
  await screen.findByText('a1b2c3d4e5f6', {}, { timeout: 4000 })

  fireEvent.click(
    await screen.findByText('Get the new prescription from MyHealth', {}, { timeout: 4000 }),
  )

  await screen.findByText('9f9f9f9f9f9f', {}, { timeout: 4000 })
  fireEvent.click(screen.getByRole('button', { name: 'Show the version code' }))
  expect(screen.getAllByText(/replaces a1b2c3d4e5f6/).length).toBeGreaterThan(0)
  expect(screen.getByText(/Warfarin arrived from MyHealth/)).toBeTruthy()
  expect(screen.getByText('The portal reports a change. Warfarin was added by Dr. Ana Reyes.')).toBeTruthy()
  await screen.findByText(/18:00|6:00 PM/, {}, { timeout: 4000 })
  await screen.findByText(/warfarin and aspirin/i, {}, { timeout: 4000 })
  expect(screen.getByText(/FDA label, Coumadin/)).toBeTruthy()
  expect(screen.getByText(/1 finding was detected and held back/)).toBeTruthy()
  expect(screen.queryByText(/lisinopril and ibuprofen/i)).toBeTruthy()
}, 15000)

test('the check-in summary explains itself with no run', async () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  signUp()
  window.location.hash = '#/decision'
  const heading = await screen.findByRole('heading', { level: 1, name: /Check-in summary/ })
  expect(heading).toBeTruthy()
  expect(screen.getByText(/No check-in has been taken yet/)).toBeTruthy()
  expect(screen.getByText(/Go to the check-in/)).toBeTruthy()
})

test('every section is behind the sign up screen', () => {
  window.location.hash = '#/meds'
  render(<HashRouter><App /></HashRouter>)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
    /Sign up for the CareLoop demonstration/,
  )
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
  expect(screen.getByText(/CareLoop ran the booking call with Dr Vance/)).toBeTruthy()
  expect(screen.getByText(/The clinic side of that call was simulated/)).toBeTruthy()
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
  expect(screen.getByText(/This will ring your telephone/)).toBeTruthy()
  fireEvent.click(screen.getByText('Yes, call my phone'))
  await screen.findByText(/CareLoop is ringing you again now/, {}, { timeout: 4000 })
  expect(screen.getByText(/This is try 2 of 3/)).toBeTruthy()
  expect(screen.getByText('Calling again')).toBeTruthy()
  expect(screen.queryByText('Yes, call my phone')).toBe(null)
  expect(screen.getByText('Read the check-in in writing').closest('button').disabled).toBe(true)
}, 10000)

test('answering the phone does not brick the screen', async () => {
  const base = { leg: 'checkin', attempt: 1, max_attempts: 3, retrying: false, call_sid: 'CA9' }
  callState.mockResolvedValueOnce({ ...base, phase: 'ringing', wording: 'Your phone is ringing now.' })
  callState.mockResolvedValueOnce({ ...base, phase: 'answered', wording: 'You are on the call with CareLoop.' })
  callState.mockResolvedValue({ ...base, phase: 'ended', wording: 'The check-in is finished.' })

  renderCall()
  fireEvent.click(screen.getByText('Call my phone now'))
  fireEvent.click(screen.getByText('Yes, call my phone'))

  await screen.findByText(/You are on the call with CareLoop/, {}, { timeout: 15000 })
  await screen.findByText(/The check-in is finished/, {}, { timeout: 15000 })

  expect(screen.getByText('Call my phone now').closest('button').disabled).toBe(false)
  expect(screen.getByText('Read the check-in in writing').closest('button').disabled).toBe(false)
}, 40000)

test('the written stand-in says what the phone call says', async () => {
  renderCall()
  expect(
    screen.getByText(
      'Simulated call. CareLoop is not speaking to you; this is a scripted stand-in for the voice agent.',
    ),
  ).toBeTruthy()

  fireEvent.click(screen.getByText('Read the check-in in writing'))
  await screen.findByText(/This is CareLoop, your medication assistant/, {}, { timeout: 4000 })
  await screen.findByText(/how have you been feeling/, {}, { timeout: 4000 })
  await screen.findByText(/this is a reminder about your/, {}, { timeout: 4000 })
  await screen.findByText(/due later today, at 8 pm/, {}, { timeout: 4000 })
  await screen.findByText(/let me know once you have taken it/, {}, { timeout: 4000 })
  expect(screen.queryByText(/Please take it now if you have not already/)).toBe(null)
  expect(screen.queryByText(/Do you have a couple of minutes/)).toBe(null)
  expect(screen.queryByText(/Have you been able to take it/)).toBe(null)
  expect(screen.queryByText(/prescriber's schedule has your/)).toBe(null)
  expect(screen.getByText('Call my phone now').closest('button').disabled).toBe(true)
}, 10000)

test('an unanswered follow-up offer never reads like a settled thank-you', async () => {
  const onReply = vi.fn(async () => ({
    triage: {
      is_crisis: false,
      is_emergency: false,
      suggested_agent_response:
        "I'm sorry to hear that. I'd like to get you a follow-up appointment to look into this, would that be okay?",
    },
    booking: null,
    booking_offered: true,
    booking_pending: true,
  }))

  render(
    <HashRouter>
      <SimulatedCall
        patientName="Maria Santos"
        nextDose={NEXT_DOSE}
        scenarios={SCENARIOS}
        busy={false}
        error={null}
        onReply={onReply}
        onRing={async () => ({ call_sid: 'CA9' })}
      />
    </HashRouter>,
  )

  fireEvent.click(screen.getByText('Read the check-in in writing'))
  await screen.findByText(/let me know once you have taken it/, {}, { timeout: 4000 })

  fireEvent.click(screen.getByText('Dizzy and swollen'))
  const send = await screen.findByRole(
    'button',
    { name: 'Send my answer' },
    { timeout: 4000 },
  )
  fireEvent.click(send)

  await screen.findByText(/would that be okay/, {}, { timeout: 4000 })
  await screen.findByText(/That offer is still open/, {}, { timeout: 4000 })
  expect(screen.queryByText(/Thank you, Maria\. I have made a note of that/)).toBe(null)
}, 10000)

function accessibleName(element) {
  const label = element.getAttribute('aria-label')
  return String(label || element.textContent || '').trim()
}

async function openSection(label, heading) {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  signUp()
  connect()
  await screen.findByRole('heading', { level: 1, name: /Today/ }, { timeout: 15000 })
  if (!label) return
  const tabs = screen.getByRole('navigation', { name: 'Sections' })
  fireEvent.click(within(tabs).getByText(label))
  await screen.findByRole('heading', { level: 1, name: heading }, { timeout: 15000 })
}

test('every control on the medicines section is a button the accessibility tree can see', async () => {
  await connectAndOpenMedications()
  openReviewerTools()
  await screen.findByText(/Your prescriber has sent a new prescription/, {}, { timeout: 4000 })

  const buttons = screen.getAllByRole('button')
  expect(buttons.length).toBeGreaterThan(0)
  for (const button of buttons) {
    expect(accessibleName(button).length).toBeGreaterThan(0)
    expect(button.tagName).toBe('BUTTON')
  }

  expect(screen.getByRole('button', { name: /Check MyHealth for updates/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Get the new prescription from MyHealth/ })).toBeTruthy()
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
}, 20000)

test('withTimeout turns a hang into a failure and aborts the request', async () => {
  let seen = null
  const failure = await withTimeout((signal) => {
    seen = signal
    return new Promise(() => {})
  }, 40).catch((error) => error)

  expect(failure.name).toBe('ApiError')
  expect(failure.timedOut).toBe(true)
  expect(failure.message).toMatch(/got no answer/)
  expect(seen.aborted).toBe(true)

  await expect(withTimeout(async () => 'answered', 1000)).resolves.toBe('answered')
})

test('a read that hangs ends in a stated failure with a retry that works', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  followups.mockImplementation(() => new Promise(() => {}))

  try {
    await openSection('Appointments', /Appointments/)
    expect(screen.getByText(/Reading your appointments/)).toBeTruthy()
    expect(screen.getByText(/stops waiting and says so/)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBe(null)

    await vi.advanceTimersByTimeAsync(13000)

    const alarm = await screen.findByRole('alert', {}, { timeout: 4000 })
    expect(alarm.textContent).toMatch(/The appointment list did not load/)
    expect(alarm.textContent).toMatch(/got no answer/)
    expect(alarm.textContent).toMatch(/does not mean your record is empty/)
    expect(screen.queryByText(/Reading your appointments/)).toBe(null)
    expect(
      screen.queryByText(/Nothing is on file from your prescriber/),
    ).toBe(null)

    followups.mockImplementation(async () => FOLLOWUPS)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText('Dr. Elena Vance', {}, { timeout: 4000 })
    expect(screen.queryByRole('alert')).toBe(null)
  } finally {
    followups.mockImplementation(async () => FOLLOWUPS)
    vi.useRealTimers()
  }
}, 30000)

test('an empty appointment list does not read like a failed one', async () => {
  followups.mockImplementation(async () => ({
    ...FOLLOWUPS,
    booked_count: 0,
    visits: [],
  }))

  try {
    await openSection('Appointments', /Appointments/)
    await screen.findByText(
      /Nothing is on file from your prescriber/,
      {},
      { timeout: 4000 },
    )
    expect(screen.getByText(/No visit has been booked in network yet/)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBe(null)
    expect(screen.queryByText(/did not load/)).toBe(null)
    expect(screen.queryByText(/Reading your appointments/)).toBe(null)
  } finally {
    followups.mockImplementation(async () => FOLLOWUPS)
  }
}, 20000)

test('the demo details arrive in the fields so no one types a password', () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  expect(screen.getByLabelText('Full name').value).toBe('Demo Reviewer')
  expect(screen.getByLabelText('Email address').value).toBe('demo@careloop.health')
  expect(screen.getByLabelText('Password').value).toBe('careloop-demo')
  signUp()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Choose your insurance/)
})

test('the flagged pair sits above the medicine list, not below it', async () => {
  await connectAndOpenMedications()
  openReviewerTools()

  fireEvent.click(
    await screen.findByText('Get the new prescription from MyHealth', {}, { timeout: 4000 }),
  )
  const flags = await screen.findByRole(
    'heading',
    { name: /Something on this list is worth checking/ },
    { timeout: 6000 },
  )
  const list = screen.getByRole('heading', { name: 'Your medications' })

  const order = flags.compareDocumentPosition(list)
  expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByText(/Ask your prescriber or pharmacist about this/)).toBeTruthy()
}, 20000)

test('the call button asks before it rings a real telephone', async () => {
  const onRing = vi.fn(async () => ({ call_sid: 'CA9' }))
  render(
    <HashRouter>
      <SimulatedCall
        patientName="Maria Santos"
        nextDose={NEXT_DOSE}
        scenarios={[]}
        busy={false}
        error={null}
        onReply={async () => null}
        onRing={onRing}
      />
    </HashRouter>,
  )

  fireEvent.click(screen.getByText('Call my phone now'))
  expect(screen.getByText(/This will ring your telephone/)).toBeTruthy()
  expect(screen.getByText(/CareLoop is about to dial the phone number on this record/)).toBeTruthy()
  expect(onRing).not.toHaveBeenCalled()

  fireEvent.click(screen.getByText('Not now'))
  expect(screen.queryByText(/This will ring your telephone/)).toBe(null)
  expect(onRing).not.toHaveBeenCalled()

  fireEvent.click(screen.getByText('Call my phone now'))
  fireEvent.click(screen.getByText('Yes, call my phone'))
  expect(onRing).toHaveBeenCalledTimes(1)
}, 10000)

test('clocks and dates read the way a patient in the US says them', async () => {
  const { clockLabel, dateTimeLabel } = await import('./src/lib/format.js')
  expect(clockLabel('20:00')).toBe('8:00 PM')
  expect(clockLabel('08:30')).toBe('8:30 AM')
  expect(clockLabel('00:15')).toBe('12:15 AM')

  const label = dateTimeLabel('2026-09-21T18:00:00-04:00')
  expect(label).toMatch(/September 21 at/)
  expect(label).not.toMatch(/18:00/)
  expect(label).not.toMatch(/Sep 21,/)
})

test('a planned reminder call never claims it will place itself', async () => {
  await openSection('Appointments', /Appointments/)
  await screen.findByText('Dr. Elena Vance', {}, { timeout: 4000 })

  expect(screen.getByText(/Reminder calls CareLoop would make/)).toBeTruthy()
  expect(screen.getByText(/Nothing in this prototype runs on a timer/)).toBeTruthy()
  expect(screen.queryByText(/Reminder calls scheduled/)).toBe(null)
  expect(screen.queryByText('aetna-001')).toBe(null)
}, 20000)

function headingLevels() {
  return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(
    (node) => Number(node.tagName.slice(1)),
  )
}

test('the flagged medicine is pinned into a shortened list', () => {
  const list = [
    { key: 'a', medication: 'Levothyroxine' },
    { key: 'b', medication: 'Metformin' },
    { key: 'c', medication: 'Aspirin' },
    { key: 'd', medication: 'Coumadin' },
  ]
  const finding = {
    ingredients: ['warfarin', 'aspirin'],
    labels: ['Coumadin (warfarin)', 'Aspirin'],
  }

  const names = flaggedNames([finding])
  expect(names.has('coumadin')).toBe(true)
  expect(names.has('aspirin')).toBe(true)

  const shown = pinFlagged(list, names, 3).map((med) => med.medication)
  expect(shown).toContain('Coumadin')
  expect(shown).toContain('Aspirin')
  expect(shown.length).toBe(3)

  expect(isFlagged({ medication: 'Coumadin' }, names)).toBe(true)
  expect(isFlagged({ medication: 'Metformin' }, names)).toBe(false)
  expect(pinFlagged(list, flaggedNames([]), 3).length).toBe(3)
  expect(pairLabels(finding)).toEqual(['Coumadin (warfarin)', 'Aspirin'])
})

test('no heading level is skipped on Today or on Medications', async () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  signUp()
  connect()
  await screen.findByRole('heading', { level: 1, name: /Today/ }, { timeout: 15000 })

  expect(document.querySelectorAll('h4').length).toBe(0)
  let levels = headingLevels()
  expect(levels[0]).toBe(1)
  for (let i = 1; i < levels.length; i += 1) {
    expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1)
  }

  const tabs = screen.getByRole('navigation', { name: 'Sections' })
  fireEvent.click(within(tabs).getByText('Medications'))
  await screen.findByRole('heading', { level: 1, name: 'Medications' }, { timeout: 15000 })

  expect(document.querySelectorAll('h4').length).toBe(0)
  levels = headingLevels()
  for (let i = 1; i < levels.length; i += 1) {
    expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1)
  }
}, 20000)

test('the flagged pair is a heading a screen reader can jump to', async () => {
  await connectAndOpenMedications()
  openReviewerTools()
  fireEvent.click(
    await screen.findByText('Get the new prescription from MyHealth', {}, { timeout: 4000 }),
  )
  const pair = await screen.findByRole(
    'heading',
    { name: /warfarin and aspirin/i },
    { timeout: 6000 },
  )
  expect(pair.tagName).toBe('H3')
}, 20000)

test('a reload keeps the reviewer signed in and the records connected', async () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  signUp()
  connect()
  await screen.findByRole('heading', { level: 1, name: /Today/ }, { timeout: 15000 })

  const saved = JSON.parse(window.sessionStorage.getItem('careloop.session.state'))
  expect(saved).toMatchObject({ signedIn: true, connected: true, patientId: 'p1' })

  cleanup()
  window.location.hash = '#/'
  render(<HashRouter><App /></HashRouter>)

  expect(screen.queryByText(/Sign up for the CareLoop demonstration/)).toBe(null)
  await screen.findByRole('heading', { level: 1, name: /Today/ }, { timeout: 15000 })
  expect(screen.queryByText(/Choose your insurance to see your day/)).toBe(null)
  await screen.findAllByText(/Metformin/, {}, { timeout: 6000 })
}, 30000)

test('the appointments section says New York time, not a timezone identifier', async () => {
  startAtFirstScreen()
  render(<HashRouter><App /></HashRouter>)
  signUp()
  connect()
  await screen.findByRole('heading', { level: 1, name: /Today/ }, { timeout: 15000 })
  const tabs = screen.getByRole('navigation', { name: 'Sections' })
  fireEvent.click(within(tabs).getByText('Appointments'))
  await screen.findByText('Dr. Elena Vance', {}, { timeout: 4000 })

  expect(screen.getByText(/New York time/)).toBeTruthy()
  expect(screen.queryByText(/America\/New_York/)).toBe(null)
  expect(zoneLabel('America/New_York')).toBe('New York time')
  expect(zoneLabel('')).toBe('local time')
}, 20000)

test('the check-in answer chips read as things a patient would say', () => {
  const labels = SCENARIOS.map((scenario) => scenario.label)
  expect(labels).not.toContain('Says no pain')
  expect(labels).not.toContain('In Spanish')
  for (const label of labels) {
    expect(label).not.toMatch(/^Says /)
    expect(label).not.toMatch(/^In (Spanish|English)$/)
  }
  expect(labels).toContain('No pain today')
  expect(labels).toContain('Dolor en el pecho')
})

test('the medicines section keeps its reviewer panels collapsed', async () => {
  await connectAndOpenMedications()

  const disclosure = screen.getByRole('button', {
    name: /Show where this list comes from/,
  })
  const panel = document.getElementById(disclosure.getAttribute('aria-controls'))
  expect(disclosure.getAttribute('aria-expanded')).toBe('false')
  expect(panel.hidden).toBe(true)

  fireEvent.click(disclosure)
  expect(disclosure.getAttribute('aria-expanded')).toBe('true')
  expect(panel.hidden).toBe(false)
  expect(panel.textContent).toMatch(/Where this list comes from/)
}, 15000)

async function openTodayWithPlan(schedule, regimen) {
  const state = {
    ...REGIMEN,
    schedule,
    regimen: regimen || REGIMEN.regimen,
  }
  regimenState.mockImplementation(async () => state)
  syncPortal.mockImplementation(async () => ({ ...FIRST_SYNC, ...state }))
  try {
    startAtFirstScreen()
    render(<HashRouter><App /></HashRouter>)
    signUp()
    connect()
    await screen.findByRole('heading', { level: 1, name: /Today/ }, { timeout: 15000 })
    await screen.findByRole('heading', { level: 2, name: /September/ }, { timeout: 15000 })
  } finally {
    regimenState.mockImplementation(async () => REGIMEN)
    syncPortal.mockImplementation(async (patientId, acceptChanges) =>
      acceptChanges ? AFTER_PORTAL_PULL : FIRST_SYNC,
    )
  }
}

test('doses hang off the call that covers them, and the next call carries the button', async () => {
  const schedule = {
    ...PLAN,
    calls: [
      { at: '2026-09-19T08:00:00-04:00', time: '08:00', status: 'taken', medications: ['Metformin', 'Aspirin'], medication_ids: ['med1', 'med-2-p1'], covers: 2, moved_into_contact_window: false },
      PLAN.calls[1],
    ],
    doses: [
      PLAN.doses[0],
      { medication: 'Aspirin', dosage: '81mg', medication_id: 'med-2-p1', prescriber: 'Dr. Ana Reyes', time: '08:00', due_at: '2026-09-19T08:00:00-04:00', status: 'taken' },
      PLAN.doses[1],
    ],
    doses_total: 3,
  }

  await openTodayWithPlan(schedule)

  const morning = screen.getByText('CareLoop called you').closest('li')
  expect(within(morning).getByText('One call, two doses')).toBeTruthy()
  expect(within(morning).getAllByText('Taken').length).toBe(2)
  expect(within(morning).queryByText(/Start my check-in|Call my phone now/)).toBe(null)

  const next = screen.getByText('CareLoop rings your telephone').closest('li')
  expect(within(next).getByText(/Start my check-in|Call my phone now/)).toBeTruthy()
}, 25000)

test('a day with every call behind you is an honest empty spine, not a broken one', async () => {
  const schedule = {
    ...PLAN,
    doses: PLAN.doses.map((dose) => ({ ...dose, status: 'taken' })),
    calls: PLAN.calls.map((call) => ({ ...call, status: 'taken' })),
    next_dose: null,
    next_call: null,
  }

  await openTodayWithPlan(schedule)

  expect(
    screen.getByRole('heading', { name: 'No call is left today' }),
  ).toBeTruthy()
  expect(screen.getByText(/Every call CareLoop planned for today is behind you/)).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Take a check-in anyway' })).toBeTruthy()
  expect(screen.queryByRole('alert')).toBe(null)
  await screen.findByText(/Tuesday, September 22 at 12:00 PM/, {}, { timeout: 6000 })
}, 25000)

test('one medicine is a timeline of one event rather than a broken page', async () => {
  const schedule = {
    ...PLAN,
    doses: [PLAN.doses[1]],
    calls: [PLAN.calls[1]],
    calls_total: 1,
    doses_total: 1,
  }

  await openTodayWithPlan(schedule)

  expect(screen.getAllByText(/CareLoop (called you|rings your telephone|will call again)/).length).toBe(1)
}, 25000)

test('a record with no medicines says so on the spine and keeps the booking', async () => {
  const schedule = {
    ...PLAN,
    doses: [],
    calls: [],
    calls_total: 0,
    doses_total: 0,
    next_dose: null,
    next_call: null,
  }

  await openTodayWithPlan(schedule)

  expect(
    screen.getByRole('heading', { name: /There are no calls on today's list/ }),
  ).toBeTruthy()
  await screen.findByText(/Tuesday, September 22 at 12:00 PM/, {}, { timeout: 6000 })
}, 25000)

test('the limits of the pair check stay on the page, one disclosure away', async () => {
  await connectAndOpenMedications()

  const summary = screen.getByText('What this check does not do').closest('summary')
  const panel = summary.closest('details')
  expect(panel.open).toBe(false)
  expect(panel.textContent).toMatch(/Not a formulary check and not a drug interaction database/)

  fireEvent.click(summary)
  expect(panel.open).toBe(true)
}, 20000)

test('the interaction is pinned inside the call it qualifies, not floating at the top', async () => {
  const finding = {
    check_id: 'regimen_pair',
    ingredients: ['warfarin', 'aspirin'],
    labels: ['Coumadin (warfarin)', 'Aspirin'],
    severity: 'major',
    concern: 'additive bleeding risk',
    source: 'FDA label, Coumadin, Drug Interactions',
    surfaced: true,
  }
  const schedule = {
    ...PLAN,
    doses: [
      { medication: 'Aspirin', dosage: '81mg', medication_id: 'med-2-p1', prescriber: 'Dr. Ana Reyes', time: '08:00', due_at: '2026-09-19T08:00:00-04:00', status: 'taken' },
      { medication: 'Coumadin', dosage: '5mg', medication_id: 'med-3-p1', prescriber: 'Dr. Elena Vance', time: '18:00', due_at: '2026-09-19T18:00:00-04:00', status: 'upcoming' },
    ],
    calls: [
      { at: '2026-09-19T08:00:00-04:00', time: '08:00', status: 'taken', medications: ['Aspirin'], medication_ids: ['med-2-p1'], covers: 1, moved_into_contact_window: false },
      { at: '2026-09-19T18:00:00-04:00', time: '18:00', status: 'upcoming', medications: ['Coumadin'], medication_ids: ['med-3-p1'], covers: 1, moved_into_contact_window: false },
    ],
    next_dose: { medication: 'Coumadin', dosage: '5mg', medication_id: 'med-3-p1', time: '18:00', status: 'upcoming', due_at: '2026-09-19T18:00:00-04:00' },
    doses_total: 2,
  }

  await openTodayWithPlan(schedule, {
    ...REGIMEN.regimen,
    findings: [finding],
    surfaced: [finding],
  })

  const pin = screen.getByText(/Major interaction, this call/)
  const card = pin.closest('li')
  expect(within(card).getByText('CareLoop rings your telephone')).toBeTruthy()
  expect(pin.closest('ol').firstChild).not.toBe(card)

  const text = card.textContent
  expect(text).toMatch(/Coumadin \(warfarin\)/)
  expect(text).toMatch(/Aspirin/)
  expect(text).toMatch(/additive bleeding risk/)
  expect(text).toMatch(/FDA label, Coumadin, Drug Interactions/)
  expect(text).toMatch(/CareLoop cannot tell you what to do about this and has told no one/)
  expect(text).toMatch(/Do not start, stop or change any medicine/)
  expect(text).toMatch(/Please speak to your prescriber or pharmacist/)

  const morning = screen.getByText('CareLoop called you').closest('li')
  expect(morning.textContent).toMatch(/paired with your Coumadin, see 6:00 PM/)
}, 25000)

