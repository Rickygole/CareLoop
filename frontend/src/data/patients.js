export const PATIENTS = [
  {
    id: 'p1',
    name: 'Maria Santos',
    insurer: 'Aetna',
    medicines: 4,
    note: 'One pair on this list is flagged',
  },
  {
    id: 'p2',
    name: 'Dorothy Klein',
    insurer: 'CareFirst BlueCross',
    medicines: 5,
    note: 'A prescription is waiting at the portal',
  },
]

export const DEFAULT_PATIENT_ID = 'p1'

export function patientName(id) {
  const match = PATIENTS.find((p) => p.id === id)
  return match ? match.name : id
}

export function patientRecord(id) {
  return PATIENTS.find((p) => p.id === id) || null
}
