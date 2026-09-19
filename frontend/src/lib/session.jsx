import { createContext, useCallback, useContext, useMemo, useState } from 'react'

import { DEFAULT_PATIENT_ID } from '../data/patients.js'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [signedIn, setSignedIn] = useState(false)
  const [patientId, setPatientId] = useState(DEFAULT_PATIENT_ID)
  const [record, setRecord] = useState(null)
  const [medications, setMedications] = useState([])
  const [schedule, setSchedule] = useState(null)
  const [regimen, setRegimen] = useState(null)
  const [run, setRun] = useState(null)
  const [clockShiftMs, setClockShiftMs] = useState(0)

  const clearEverything = useCallback(() => {
    setPatientId(DEFAULT_PATIENT_ID)
    setRecord(null)
    setMedications([])
    setSchedule(null)
    setRegimen(null)
    setRun(null)
    setClockShiftMs(0)
  }, [])

  const signIn = useCallback(() => {
    setSignedIn(true)
  }, [])

  const signOut = useCallback(() => {
    setSignedIn(false)
    clearEverything()
  }, [clearEverything])

  const choosePatient = useCallback((id) => {
    setPatientId(id)
    setRecord(null)
    setMedications([])
    setSchedule(null)
    setRegimen(null)
    setRun(null)
    setClockShiftMs(0)
  }, [])

  const applyPortal = useCallback((patient, state) => {
    setRecord(patient || null)
    setMedications((state && state.medications) || [])
    setSchedule((state && state.schedule) || null)
    setRegimen((state && state.regimen) || null)
    setClockShiftMs(0)
  }, [])

  const applyRegimen = useCallback((state) => {
    if (!state) return
    setMedications(state.medications || [])
    setSchedule(state.schedule || null)
    setRegimen(state.regimen || null)
  }, [])

  const recordRun = useCallback((payload, latencyMs) => {
    setRun(
      payload
        ? { ...payload, at: new Date().toISOString(), latencyMs: latencyMs }
        : null,
    )
  }, [])

  const value = useMemo(
    () => ({
      signedIn,
      signIn,
      signOut,
      patientId,
      choosePatient,
      record,
      connected: Boolean(record),
      medications,
      schedule,
      regimen,
      applyPortal,
      applyRegimen,
      run,
      recordRun,
      clockShiftMs,
      setClockShiftMs,
    }),
    [
      signedIn,
      signIn,
      signOut,
      patientId,
      choosePatient,
      record,
      medications,
      schedule,
      regimen,
      applyPortal,
      applyRegimen,
      run,
      recordRun,
      clockShiftMs,
    ],
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession needs a SessionProvider above it')
  return value
}
