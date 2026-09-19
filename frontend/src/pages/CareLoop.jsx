import { useCallback, useEffect, useMemo, useState } from 'react'

import CheckIn from '../components/CheckIn.jsx'
import ClinicCall from '../components/ClinicCall.jsx'
import ConsentModal from '../components/ConsentModal.jsx'
import FairnessChart from '../components/FairnessChart.jsx'
import LoopSteps from '../components/LoopSteps.jsx'
import Masthead from '../components/Masthead.jsx'
import MedicationCard from '../components/MedicationCard.jsx'
import NextUpCard from '../components/NextUpCard.jsx'
import RunNarrative from '../components/RunNarrative.jsx'
import Section, { MARGIN_GRID } from '../components/Section.jsx'
import TechnicalDetail from '../components/TechnicalDetail.jsx'
import TierBadge from '../components/TierBadge.jsx'
import TriageResult from '../components/TriageResult.jsx'
import VoicePanel from '../components/VoicePanel.jsx'
import { DashboardFooter } from '../components/Disclaimers.jsx'
import { API_BASE, connectPatient, runLoop, schedule } from '../lib/api.js'
import { dateTimeLabel, groupSchedule } from '../lib/format.js'
import { actionSentence } from '../lib/narrate.js'
import { useTrace } from '../lib/useTrace.js'
import { DEFAULT_PATIENT_ID, patientName } from '../data/patients.js'
import { SCENARIOS } from '../data/scenarios.js'

export default function CareLoopPage() {
  const [patientId, setPatientId] = useState(DEFAULT_PATIENT_ID)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [run, setRun] = useState(null)
  const [latency, setLatency] = useState(null)

  const [consentOpen, setConsentOpen] = useState(false)
  const [phase, setPhase] = useState('idle')
  const [record, setRecord] = useState(null)
  const [plan, setPlan] = useState(null)
  const [portalError, setPortalError] = useState(null)

  const { events, status, retries, maxRetries } = useTrace()

  useEffect(() => {
    document.title = 'CareLoop'
  }, [])

  const choosePatient = useCallback((id) => {
    setPatientId(id)
    setRun(null)
    setLatency(null)
    setError(null)
    setPhase('idle')
    setRecord(null)
    setPlan(null)
  }, [])

  const startCheckIn = useCallback(
    async (transcript) => {
      setBusy(true)
      setError(null)
      const started = performance.now()
      try {
        const payload = await runLoop(transcript, patientId)
        setLatency(Math.round(performance.now() - started))
        setRun(payload)
      } catch (err) {
        setError(err.message)
        setRun(null)
        setLatency(null)
      } finally {
        setBusy(false)
      }
    },
    [patientId],
  )

  const connect = useCallback(async () => {
    setConsentOpen(false)
    setPhase('loading')
    setPortalError(null)
    try {
      const [patientResult, planResult] = await Promise.all([
        connectPatient(patientId),
        schedule(patientId),
      ])
      setRecord(patientResult)
      setPlan(planResult)
      setPhase('ready')
    } catch (err) {
      setPortalError(err.message)
      setPhase('error')
    }
  }, [patientId])

  const medications = useMemo(() => {
    const doses = (plan && plan.doses) || []
    const requests =
      (record && record.patient && record.patient.medication_requests) || []
    const frequencyById = new Map(
      requests.map((r) => [r.medication_id, r.frequency]),
    )
    return groupSchedule(doses).map((med) => ({
      ...med,
      frequency: frequencyById.get(med.key) || '',
    }))
  }, [plan, record])

  const patient = record && record.patient
  const history = (patient && patient.history) || []

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-5 focus:top-5 focus:z-50 focus:rounded-control focus:border-2 focus:border-line-ink focus:bg-surface focus:px-5 focus:py-3 focus:text-sm focus:font-semibold"
      >
        Skip to the main content
      </a>

      <Masthead />

      <main id="main" className="mx-auto max-w-[72rem] px-6 pb-8 sm:px-8">
        <div className="grid gap-x-16 gap-y-12 pt-16 lg:grid-cols-[minmax(0,1fr)_19rem] lg:pt-24">
          <div>
            <p className="smallcaps text-micro text-brand-deep">
              A check-in call that does the next part for you
            </p>
            <h1 className="font-display mt-5 max-w-[15ch] text-3xl font-semibold text-ink sm:text-4xl">
              We call. You talk. We handle it.
            </h1>
            <p className="measure mt-8 text-ink-2">
              CareLoop telephones you when a dose of your medicine is due. It
              asks whether you took it and how you are feeling. If what you say
              needs a doctor, it telephones the clinic and books the
              appointment itself, then tells you when it is.
            </p>
          </div>

          <aside className="border-t-2 border-line-ink pt-7 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-1">
            <h2 className="smallcaps text-micro text-muted">
              What you have to do
            </h2>
            <p className="font-display mt-3 text-xl font-semibold text-ink">
              Connect your pharmacy portal. Once.
            </p>
            <ul className="mt-6 space-y-3.5 text-sm text-ink-2">
              {[
                'You never log in.',
                'You never type anything.',
                'You never enter a medicine.',
                'You just answer the phone.',
              ].map((line, index) => (
                <li key={line} className="flex items-baseline gap-3.5">
                  <span
                    aria-hidden="true"
                    className={
                      'shrink-0 ' + (index === 3 ? 'text-brand' : 'text-muted')
                    }
                  >
                    {index === 3
                      ? String.fromCharCode(9654)
                      : String.fromCharCode(8213)}
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <Section
          id="loop"
          mark="01"
          label="How it goes"
          title="Five things happen on every call"
          lead="This is the whole product. It takes about a minute, and the patient only has to talk."
        >
          <LoopSteps />
        </Section>

        <Section
          id="try"
          mark="02"
          label="See it happen"
          title="Say how you are feeling"
          lead="Everything below is real. What you say goes to the triage engine, and what comes back is what a patient would actually be told."
        >
          <VoicePanel
            patientId={patientId}
            patientName={patientName(patientId)}
          />

          <CheckIn
            busy={busy}
            error={error}
            scenarios={SCENARIOS}
            patientId={patientId}
            onPatientChange={choosePatient}
            onSubmit={startCheckIn}
          />

          {busy ? (
            <p
              aria-live="polite"
              className="enter-fade mt-10 border-l-4 border-brand bg-brand-wash px-6 py-5 text-sm font-semibold text-brand-deep"
            >
              CareLoop is on the call. Listening, checking, and deciding what to
              do.
            </p>
          ) : null}

          {run ? (
            <div className="mt-10">
              <div style={{ '--i': 0 }}>
                <TriageResult result={run.triage} latencyMs={latency} />
              </div>
              <RunNarrative events={run.events} startIndex={2} />
              <ClinicCall
                events={run.events}
                booking={run.booking}
                tier={run.triage && run.triage.tier}
              />
            </div>
          ) : null}
        </Section>

        <Section
          id="portal"
          mark="03"
          label="The patient side"
          title="What is on your phone afterwards"
          lead="CareLoop builds this from your pharmacy record the moment you connect it. Nobody types a medicine in, and nobody keeps it up to date by hand."
        >
          {phase === 'idle' || phase === 'error' ? (
            <div className="mt-9 border-t border-line pt-9">
              <p className="measure text-ink-2">
                Connecting the portal is the one and only thing a patient ever
                does. Press the button to see it happen.
              </p>

              {phase === 'error' && portalError ? (
                <p
                  role="alert"
                  className="measure enter-fade mt-6 border-l-4 border-emergency bg-emergency-tint px-6 py-5 text-sm text-emergency"
                >
                  <strong className="font-semibold">
                    The portal did not connect.
                  </strong>{' '}
                  {portalError} CareLoop was looking for the service at{' '}
                  {API_BASE}.
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => setConsentOpen(true)}
                className="mt-8 min-h-[56px] rounded-control border-2 border-line-ink bg-surface px-8 py-3.5 text-sm font-semibold text-ink shadow-raised transition-[background-color,transform] duration-200 ease-out hover:bg-sunken active:translate-y-px"
              >
                Connect the portal
              </button>
            </div>
          ) : null}

          {phase === 'loading' ? (
            <p
              aria-busy="true"
              aria-live="polite"
              className="mt-9 border-t border-line pt-9 text-sm font-semibold text-muted"
            >
              Reading the pharmacy record...
            </p>
          ) : null}

          {phase === 'ready' && patient ? (
            <div className="mt-9">
              <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-t border-line pt-8">
                <h3 className="font-display text-xl font-semibold text-ink">
                  {patient.name}
                </h3>
                <p className="numeric text-sm text-muted">
                  {patient.insurance_display_name}
                  {patient.connected_at
                    ? ', connected ' + dateTimeLabel(patient.connected_at)
                    : ''}
                </p>
              </div>

              <div className="mt-8">
                <NextUpCard dose={plan && plan.next_dose} />
              </div>

              <h4 className="smallcaps mt-14 text-micro text-muted">
                Your medicines today
              </h4>
              {medications.length ? (
                <ul className="mt-5">
                  {medications.map((med, index) => (
                    <MedicationCard key={med.key} med={med} index={index} />
                  ))}
                </ul>
              ) : (
                <p className="measure mt-5 border-t border-line pt-7 text-ink-2">
                  This record has no medicines on it yet, so CareLoop has
                  nothing to ring about.
                </p>
              )}

              <h4 className="smallcaps mt-14 text-micro text-muted">
                Calls CareLoop has already made
              </h4>
              {history.length ? (
                <ul className="mt-5">
                  {history.map((item, index) => (
                    <li
                      key={item.call_id || index}
                      className={
                        'enter-script border-t border-line py-6 ' + MARGIN_GRID
                      }
                      style={{ '--i': index }}
                    >
                      <time className="numeric pt-1 text-right text-micro text-muted">
                        {dateTimeLabel(item.timestamp)}
                      </time>
                      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
                        <div className="min-w-0">
                          <p className="measure text-ink">
                            {item.symptom_reported
                              ? 'You said you had ' + item.symptom_reported + '.'
                              : item.outcome === 'no_answer'
                                ? 'You did not pick up.'
                                : 'You said you were feeling fine.'}
                          </p>
                          <p className="mt-1.5 text-sm text-muted">
                            {actionSentence(item.action_taken)}
                          </p>
                        </div>
                        {item.tier ? (
                          <TierBadge tier={item.tier} size="sm" />
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="measure mt-5 border-t border-line pt-7 text-ink-2">
                  CareLoop has not rung this person yet. Once it does, every
                  call and what came of it is listed here.
                </p>
              )}
            </div>
          ) : null}
        </Section>

        <Section
          id="work"
          mark="04"
          label="Check our work"
          title="We will show you everything underneath"
          lead="Nothing here is hidden. The machine record of every call and the test results behind the triage decisions are both open."
        >
          <TechnicalDetail
            events={events}
            status={status}
            retries={retries}
            maxRetries={maxRetries}
          />
          <FairnessChart />
        </Section>
      </main>

      <DashboardFooter />

      <ConsentModal
        open={consentOpen}
        patientName={patientName(patientId)}
        busy={phase === 'loading'}
        onAgree={connect}
        onCancel={() => setConsentOpen(false)}
      />
    </div>
  )
}
