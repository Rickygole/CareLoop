import { useCallback, useEffect, useMemo, useState } from 'react'

import AppHeader from '../components/AppHeader.jsx'
import CallStatusBanner from '../components/CallStatusBanner.jsx'
import ConsentModal from '../components/ConsentModal.jsx'
import LoopStrip from '../components/LoopStrip.jsx'
import MedicationCard from '../components/MedicationCard.jsx'
import NextUpCard from '../components/NextUpCard.jsx'
import TierBadge from '../components/TierBadge.jsx'
import { DashboardFooter } from '../components/Disclaimers.jsx'
import { API_BASE, connectPatient, schedule } from '../lib/api.js'
import { dateTimeLabel, groupSchedule } from '../lib/format.js'
import { useTrace } from '../lib/useTrace.js'
import { DEFAULT_PATIENT_ID, PATIENTS, patientName } from '../data/patients.js'

export default function Dashboard() {
  const [patientId, setPatientId] = useState(DEFAULT_PATIENT_ID)
  const [consentOpen, setConsentOpen] = useState(false)
  const [phase, setPhase] = useState('idle')
  const [data, setData] = useState(null)
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState(null)
  const [sinceSeq, setSinceSeq] = useState(0)

  const { events } = useTrace()

  const connect = useCallback(async (id, fromSeq) => {
    setPhase('loading')
    setError(null)
    setSinceSeq(fromSeq)
    try {
      const [patientResult, planResult] = await Promise.all([
        connectPatient(id),
        schedule(id),
      ])
      setData(patientResult)
      setPlan(planResult)
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

  const doses = (plan && plan.doses) || []
  const medications = useMemo(() => {
    const requests = (data && data.patient && data.patient.medication_requests) || []
    const frequencyById = new Map(requests.map((r) => [r.medication_id, r.frequency]))
    return groupSchedule(doses).map((med) => ({
      ...med,
      frequency: frequencyById.get(med.key) || '',
    }))
  }, [doses, data])
  const nextDose = plan && plan.next_dose
  const nextCallTime = plan && plan.next_call && plan.next_call.time
  const call = useCallStatus(events, patientId, sinceSeq)

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:border focus:border-line focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lift"
      >
        Skip to content
      </a>
      <AppHeader />

      <main id="portal-main" className="mx-auto w-full max-w-5xl flex-1 px-6 py-14">
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
            nextTime={nextCallTime}
            dose={nextDose}
            call={call}
            onSwitch={() => {
              setPhase('idle')
              setData(null)
              setPlan(null)
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

function SectionHeading({ title, aside }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink/10 pb-3">
      <h2 className="font-display text-xl font-semibold tracking-[-0.008em] text-ink">
        {title}
      </h2>
      {aside ? <p className="numeric text-sm text-muted">{aside}</p> : null}
    </div>
  )
}

function Monogram({ name }) {
  const initials = String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')

  return (
    <span
      aria-hidden="true"
      className="font-display flex size-12 shrink-0 items-center justify-center rounded-full border border-brand/20 bg-brand-tint text-lg font-semibold text-brand-deep"
    >
      {initials}
    </span>
  )
}

function ConnectPanel({ patientId, onPatientChange, onConnect, error }) {
  return (
    <div>
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_18rem] lg:gap-16">
        <div>
          <h1 className="font-display max-w-[30ch] text-3xl font-semibold tracking-[-0.012em] text-ink">
            A check-in call that triages what you say and books the visit for
            you
          </h1>
          <p className="mt-5 max-w-[58ch] text-ink-2">
            CareLoop calls to check whether you took your medication, listens
            for anything that needs a clinician, and calls the clinic to book
            the visit when it does. You never log in and never type anything;
            once a portal is connected, the rest runs on its own.
          </p>

          {error ? (
            <div
              role="alert"
              className="enter-fade mt-8 rounded-card border border-emergency/30 bg-emergency-tint px-5 py-4"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-emergency">
                <span aria-hidden="true" className="font-mono">
                  [!]
                </span>
                Could not connect the portal
              </p>
              <p className="mt-1.5 text-sm text-ink-2">{error}</p>
              <p className="mt-3 font-mono text-2xs leading-relaxed text-muted">
                API base: {API_BASE}. Start the backend with uvicorn main:app,
                or set VITE_API_BASE and rebuild.
              </p>
            </div>
          ) : null}

          <div className="mt-10 text-sm">
            <LoopStrip compact />
          </div>
        </div>

        <div className="overflow-hidden rounded-card border border-dashed border-line-strong bg-surface-2 shadow-card">
          <div className="p-5">
            <p className="text-micro font-semibold uppercase text-muted">
              Demo control, not part of the product
            </p>
            <label
              htmlFor="patient"
              className="mt-3 block text-2xs font-semibold uppercase text-muted"
            >
              Preview a synthetic record
            </label>
            <select
              id="patient"
              value={patientId}
              onChange={(event) => onPatientChange(event.target.value)}
              className="field-select mt-2 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors duration-150 hover:border-line-strong"
            >
              {PATIENTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
            <p className="mt-2.5 text-2xs leading-relaxed text-muted">
              In the real product this step does not exist. A patient
              connects their portal once and CareLoop takes it from there.
            </p>
          </div>

          <div className="border-t border-line bg-surface p-5">
            <button
              type="button"
              onClick={onConnect}
              className="w-full rounded-control border border-line-strong bg-surface px-3.5 py-2.5 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-sunken"
            >
              Connect this portal
            </button>
            <p className="mt-2.5 text-2xs text-muted">
              You will be asked to consent before anything is read.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingPortal() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="text-sm font-medium text-muted">Connecting your portal...</p>
    </div>
  )
}

function patientLoopStep(call) {
  if (call.status === 'active') return 'checkin'
  if (call.status !== 'outcome') return 'reminder'
  const tier = String(call.tier || '').toLowerCase()
  return tier === 'moderate' || tier === 'severe' ? 'action' : 'triage'
}

function Portal({ patient, medications, nextTime, dose, call, onSwitch }) {
  const history = patient.history || []

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          <Monogram name={patient.name} />
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-[-0.008em] text-ink">
              {patient.name}
            </h1>
            <p className="mt-1 text-sm text-ink-2">
              {patient.insurance_display_name}
              {patient.connected_at
                ? ' ' + String.fromCharCode(183) + ' connected ' + dateTimeLabel(patient.connected_at)
                : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSwitch}
          className="rounded-control border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink-2 shadow-card transition-colors duration-150 hover:border-line-strong hover:bg-sunken"
        >
          Switch patient
        </button>
      </div>

      {call.status === 'scheduled' ? null : (
        <div className="mt-8">
          <CallStatusBanner
            status={call.status}
            nextTime={nextTime}
            transcript={call.transcript}
            tier={call.tier}
            isCrisis={call.isCrisis}
          />
        </div>
      )}

      <div className="mt-8">
        <NextUpCard dose={dose} />
      </div>

      <div className="mt-12">
        <LoopStrip activeId={patientLoopStep(call)} compact />
      </div>

      <section className="mt-14">
        <SectionHeading
          title="Today's medications"
          aside={medications.length ? medications.length + ' active' : null}
        />

        {medications.length ? (
          <ul className="mt-6 grid gap-5 sm:grid-cols-2">
            {medications.map((med, index) => (
              <MedicationCard key={med.key} med={med} index={index} />
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No active medications"
            body="This record has no active prescriptions, so CareLoop has nothing to check in about yet. Add a prescription in the portal and it will appear here."
          />
        )}
      </section>

      <section className="mt-14">
        <SectionHeading
          title="Recent check-ins"
          aside={history.length ? history.length + ' calls' : null}
        />

        {history.length ? (
          <ul className="mt-6 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
            {history.map((item, index) => (
              <li
                key={item.call_id || index}
                className="enter-rise flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors duration-150 hover:bg-surface-2"
                style={{ '--i': index }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {item.symptom_reported
                      ? 'Reported: ' + item.symptom_reported
                      : item.outcome === 'no_answer'
                        ? 'No answer'
                        : 'No symptoms reported'}
                  </p>
                  <p className="numeric mt-1 text-2xs text-muted">
                    {dateTimeLabel(item.timestamp)}
                    {' ' + String.fromCharCode(183) + ' '}
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
    <div className="mt-6 border-l-2 border-line-strong bg-surface-2 px-6 py-8">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-muted">
        {body}
      </p>
    </div>
  )
}
