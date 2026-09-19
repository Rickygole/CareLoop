export const PATIENTS = [
  { id: 'p1', name: 'Maria Santos', insurer: 'Aetna', medicines: 1 },
  { id: 'p2', name: 'Dorothy Klein', insurer: 'CareFirst BlueCross', medicines: 2 },
]

export const DEFAULT_PATIENT_ID = 'p1'

export function patientName(id) {
  const match = PATIENTS.find((p) => p.id === id)
  return match ? match.name : id
}

export function patientRecord(id) {
  return PATIENTS.find((p) => p.id === id) || null
}
