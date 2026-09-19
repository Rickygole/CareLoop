export const PATIENTS = [
  {
    id: 'p1',
    name: 'Maria Santos',
    insurer: 'Aetna',
    plan: 'Aetna Choice POS II',
    network: 'Aetna Choice network',
    portal: 'MyHealth',
    covers: [
      'Primary care and specialist visits inside the network',
      'Prescriptions filled at any network pharmacy',
      'One wellness visit a year at no charge',
    ],
    medicines: 4,
  },
  {
    id: 'p2',
    name: 'Dorothy Klein',
    insurer: 'CareFirst BlueCross',
    plan: 'CareFirst BlueChoice Advantage',
    network: 'BlueChoice network',
    portal: 'MyHealth',
    covers: [
      'Primary care and specialist visits inside the network',
      'Prescriptions filled at any network pharmacy',
      'Specialist visits outside the network at a higher share of the cost',
    ],
    medicines: 5,
  },
]

export const DEFAULT_PATIENT_ID = 'p1'

export const INSURERS = PATIENTS.map((patient) => ({
  id: patient.id,
  insurer: patient.insurer,
  plan: patient.plan,
  network: patient.network,
  portal: patient.portal,
  covers: patient.covers,
  medicines: patient.medicines,
}))

export function patientName(id) {
  const match = PATIENTS.find((p) => p.id === id)
  return match ? match.name : id
}

export function patientRecord(id) {
  return PATIENTS.find((p) => p.id === id) || null
}

export function insurerFor(id) {
  return INSURERS.find((p) => p.id === id) || null
}

export function insurerName(id) {
  const match = insurerFor(id)
  return match ? match.insurer : ''
}
