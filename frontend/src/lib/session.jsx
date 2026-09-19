import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { connectPatient, regimenState } from './api.js'
import { DEFAULT_PATIENT_ID } from '../data/patients.js'

const SessionContext = createContext(null)

export const STATE_KEY = 'careloop.session.state'

function readSaved() {
  try {
    const raw = window.sessionStorage.getItem(STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function writeSaved(state) {
  try {
    window.sessionStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    return
  }
}

export function SessionProvider({ children }) {
  const saved = useMemo(readSaved, [])

  const [signedIn, setSignedIn] = useState(Boolean(saved && saved.signedIn))
  const [patientId, setPatientId] = useState(
    (saved && saved.patientId) || DEFAULT_PATIENT_ID,
  )
  const [connected, setConnected] = useState(Boolean(saved && saved.connected))
  const [restoring, setRestoring] = useState(
    Boolean(saved && saved.signedIn && saved.connected),
  )
  const [restoreFailed, setRestoreFailed] = useState(false)

  const [record, setRecord] = useState(null)
  const [medications, setMedications] = useState([])
  const [schedule, setSchedule] = useState(null)
  const [regimen, setRegimen] = useState(null)
  const [run, setRun] = useState(null)
  const [clockShiftMs, setClockShiftMs] = useState(0)

  useEffect(() => {
    writeSaved({ signedIn, patientId, connected })
  }, [connected, patientId, signedIn])

  useEffect(() => {
    if (!restoring) return undefined
    let live = true

    Promise.all([connectPatient(patientId), regimenState(patientId)])
      .then(([portal, state]) => {
        if (!live) return
        setRecord((portal && portal.patient) || null)
        setMedications((state && state.medications) || [])
        setSchedule((state && state.schedule) || null)
        setRegimen((state && state.regimen) || null)
        setRestoring(false)
      })
      .catch(() => {
        if (!live) return
        setConnected(false)
        setRestoreFailed(true)
        setRestoring(false)
      })

    return () => {
      live = false
    }
  }, [patientId, restoring])

  const clearEverything = useCallback(() => {
    setPatientId(DEFAULT_PATIENT_ID)
    setConnected(false)
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
    setRestoring(false)
    setRestoreFailed(false)
    clearEverything()
  }, [clearEverything])

  const choosePatient = useCallback((id) => {
    setPatientId(id)
    setConnected(false)
    setRestoreFailed(false)
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
    setConnected(Boolean(patient))
    setRestoreFailed(false)
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
      connected,
      restoring,
      restoreFailed,
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
      connected,
      restoring,
      restoreFailed,
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
