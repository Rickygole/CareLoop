export const PATIENTS = [
  { id: 'p1', name: 'Maria Santos' },
  { id: 'p2', name: 'James Okafor' },
  { id: 'p3', name: 'Wei Chen' },
  { id: 'p4', name: 'Dorothy Klein' },
]

export const DEFAULT_PATIENT_ID = 'p1'

export function patientName(id) {
  const match = PATIENTS.find((p) => p.id === id)
  return match ? match.name : id
}
