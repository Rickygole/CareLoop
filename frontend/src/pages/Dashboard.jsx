import { useCallback, useEffect, useMemo, useState } from 'react'

import AppHeader from '../components/AppHeader.jsx'
import CallStatusBanner from '../components/CallStatusBanner.jsx'
import ConsentModal from '../components/ConsentModal.jsx'
import MedicationCard from '../components/MedicationCard.jsx'
import TierBadge from '../components/TierBadge.jsx'
import { DashboardFooter } from '../components/Disclaimers.jsx'
import { API_BASE, connectPatient } from '../lib/api.js'
import { dateTimeLabel, groupSchedule, nextDoseTime } from '../lib/format.js'
import { useTrace } from '../lib/useTrace.js'
import { DEFAULT_PATIENT_ID, PATIENTS, patientName } from '../data/patients.js'

export default function Dashboard() {
  const [patientId, setPatientId] = useState(DEFAULT_PATIENT_ID)
  const [consentOpen, setConsentOpen] = useState(false)
  const [phase, setPhase] = useState('idle')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [sinceSeq, setSinceSeq] = useState(0)

  const { events } = useTrace()

  const connect = useCallback(async (id, fromSeq) => {
    setPhase('loading')
    setError(null)
    setSinceSeq(fromSeq)
    try {
      const result = await connectPatient(id)
      setData(result)
      setPhase('ready')
    } catch (err) {
      setError(err.message)
      setPhase('error')
    }
  }, [])

  const latestSeq = events.length ? events[events.length - 1].seq : 0

  const agree = useCallback(() => {
    setConsentOpen(false)
    connect(patientId, latestSeq)
  }, [connect, latestSeq, patientId])

  useEffect(() => {
    document.title = 'CareLoop portal'
  }, [])

  const schedule = (data && data.derived_schedule) || []
  const medications = useMemo(() => groupSchedule(schedule), [schedule])
  const nextTime = useMemo(() => nextDoseTime(schedule), [schedule])
  const call = useCallStatus(events, patientId, sinceSeq)

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {phase === 'idle' || phase === 'error' ? (
          <ConnectPanel
            patientId={patientId}
            onPatientChange={setPatientId}
            onConnect={() => setConsentOpen(true)}
            error={phase === 'error' ? error : null}
          />
        ) : null}

        {phase === 'loading' ? <LoadingPortal /> : null}

        {phase === 'ready' && data ? (
          <Portal
            patient={data.patient}
            medications={medications}
            nextTime={nextTime}
            call={call}
            onSwitch={() => {
              setPhase('idle')
              setData(null)
            }}
          />
        ) : null}
      </main>

      <DashboardFooter />

      <ConsentModal
        open={consentOpen}
        patientName={patientName(patientId)}
        busy={phase === 'loading'}
        onAgree={agree}
        onCancel={() => setConsentOpen(false)}
      />
    </div>
  )
}

function useCallStatus(events, patientId, sinceSeq) {
  return useMemo(() => {
    let state = { status: 'scheduled', transcript: '', tier: null, isCrisis: false }
    let mine = false

    for (const event of events) {
      if (event.seq <= sinceSeq) continue
      const payload = event.payload || {}
      switch (event.event_type) {
        case 'PATIENT_SPEECH': {
          mine = !payload.patient_id || payload.patient_id === patientId
          if (!mine) break
          state = {
            status: 'active',
            transcript: payload.text || '',
            tier: null,
            isCrisis: false,
          }
          break
        }
        case 'EMERGENCY_ESCALATION':
          if (mine) state = { ...state, isCrisis: Boolean(payload.is_crisis) }
          break
        case 'ACTION_DECIDED':
          if (mine) state = { ...state, status: 'outcome', tier: payload.tier || null }
          break
        default:
          break
      }
    }

    return state
  }, [events, patientId, sinceSeq])
}

function ConnectPanel({ patientId, onPatientChange, onConnect, error }) {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Connect your patient portal
      </h1>
      <p className="mt-3 max-w-[65ch] text-ink-2">
        CareLoop calls to check whether you took your medication and listens for
        anything that needs a clinician. Connect a portal to see the schedule it
        will call about.
      </p>

      <div className="mt-8 rounded-card border border-line bg-surface p-6">
        <label
          htmlFor="patient"
          className="block text-sm font-medium text-ink-2"
        >
          Demo patient record
        </label>
        <select
          id="patient"
          value={patientId}
          onChange={(event) => onPatientChange(event.target.value)}
          className="mt-2 w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm transition-colors duration-150 hover:border-line-strong"
        >
          {PATIENTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.id})
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-muted">
          Synthetic records. No real patient data is used anywhere in CareLoop.
        </p>

        <button
          type="button"
          onClick={onConnect}
          className="mt-5 w-full rounded-[10px] bg-brand px-4 py-3 text-sm font-medium text-white transition-[background-color,transform] duration-150 ease-out hover:bg-brand-deep active:scale-[0.98]"
        >
          Connect portal
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="enter-fade mt-6 rounded-card border border-emergency/40 bg-emergency-tint p-4"
        >
          <p className="text-sm font-medium text-emergency">
            <span aria-hidden="true" className="font-mono">
              [!]{' '}
            </span>
            Could not connect the portal
          </p>
          <p className="mt-1 text-sm text-ink-2">{error}</p>
          <p className="mt-2 text-xs text-muted">
            API base: {API_BASE}. Start the backend with uvicorn main:app, or set
            VITE_API_BASE and rebuild.
          </p>
        </div>
      ) : null}
    </div>
  )
}

function LoadingPortal() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Connecting your portal</span>
      <div className="skeleton h-8 w-56 rounded-[8px]" />
      <div className="skeleton mt-3 h-4 w-72 rounded-[6px]" />
      <div className="skeleton mt-8 h-16 w-full rounded-card" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="skeleton h-40 rounded-card" />
        <div className="skeleton h-40 rounded-card" />
      </div>
    </div>
  )
}

function Portal({ patient, medications, nextTime, call, onSwitch }) {
  const history = patient.history || []

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Patient portal</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
            {patient.name}
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            {patient.insurance_display_name}
            {patient.connected_at
              ? ' \u00b7 connected ' + dateTimeLabel(patient.connected_at)
              : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onSwitch}
          className="rounded-[10px] border border-line px-3 py-2 text-sm font-medium text-ink-2 transition-colors duration-150 hover:bg-sunken"
        >
          Switch patient
        </button>
      </div>

      <div className="mt-6">
        <CallStatusBanner
          status={call.status}
          nextTime={nextTime}
          transcript={call.transcript}
          tier={call.tier}
          isCrisis={call.isCrisis}
        />
      </div>

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Today's medications
          </h2>
          <span className="text-sm text-muted">
            {medications.length} active
          </span>
        </div>

        {medications.length ? (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {medications.map((med, index) => (
              <MedicationCard
                key={med.key}
                med={med}
                index={index}
                nextTime={nextTime}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No active medications"
            body="This record has no active prescriptions, so CareLoop has nothing to check in about yet. Add a prescription in the portal and it will appear here."
          />
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Recent check-ins</h2>

        {history.length ? (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {history.map((item, index) => (
              <li
                key={item.call_id || index}
                className="enter-rise flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                style={{ '--i': index }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {item.symptom_reported
                      ? 'Reported: ' + item.symptom_reported
                      : item.outcome === 'no_answer'
                        ? 'No answer'
                        : 'No symptoms reported'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {dateTimeLabel(item.timestamp)} {'\u00b7'}{' '}
                    {String(item.action_taken || '').replace(/_/g, ' ')}
                  </p>
                </div>
                {item.tier ? <TierBadge tier={item.tier} size="sm" /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No check-in calls yet"
            body="Once CareLoop places its first check-in call, the outcome and anything reported during the call will be listed here."
          />
        )}
      </section>
    </div>
  )
}

function EmptyState({ title, body }) {
  return (
    <div className="mt-4 rounded-card border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-[52ch] text-sm text-muted">{body}</p>
    </div>
  )
}
