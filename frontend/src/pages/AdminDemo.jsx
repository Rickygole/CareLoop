import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import ApiStatus from '../components/ApiStatus.jsx'
import FairnessChart from '../components/FairnessChart.jsx'
import FreeTextTriage from '../components/FreeTextTriage.jsx'
import LoopStatus from '../components/LoopStatus.jsx'
import TraceLegend from '../components/TraceLegend.jsx'
import TracePanel from '../components/TracePanel.jsx'
import TriageResult from '../components/TriageResult.jsx'
import { ConsoleNotice } from '../components/Disclaimers.jsx'
import { book, triage } from '../lib/api.js'
import { useTrace } from '../lib/useTrace.js'
import { DEFAULT_PATIENT_ID, PATIENTS } from '../data/patients.js'
import { SCENARIOS } from '../data/scenarios.js'

const SPECIALTY_FOR_TIER = {
  moderate: { specialty: 'Internal Medicine', urgency: 'routine' },
  severe: { specialty: 'Internal Medicine', urgency: 'urgent' },
}

export default function AdminDemo() {
  const [patientId, setPatientId] = useState(DEFAULT_PATIENT_ID)
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [latency, setLatency] = useState(null)
  const [booking, setBooking] = useState(null)
  const [bookingBusy, setBookingBusy] = useState(false)

  const { events, status, retries, maxRetries, clear } = useTrace()
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0]

  useEffect(() => {
    document.title = 'CareLoop judge console'
  }, [])

  const run = useCallback(
    async (transcript) => {
      setBusy(true)
      setError(null)
      setBooking(null)
      const started = performance.now()
      try {
        const payload = await triage(transcript, patientId)
        setLatency(Math.round(performance.now() - started))
        setResult(payload)
      } catch (err) {
        setError(err.message)
        setResult(null)
        setLatency(null)
      } finally {
        setBusy(false)
      }
    },
    [patientId],
  )

  const bookFollowUp = useCallback(async () => {
    if (!result) return
    const plan = SPECIALTY_FOR_TIER[String(result.tier).toLowerCase()]
    if (!plan) return
    setBookingBusy(true)
    setError(null)
    try {
      setBooking(await book(plan.specialty, plan.urgency, patientId))
    } catch (err) {
      setError(err.message)
    } finally {
      setBookingBusy(false)
    }
  }, [patientId, result])

  return (
    <div className="console-scope min-h-dvh bg-console-bg text-console-ink">
      <header className="sticky top-0 z-30 border-b border-console-line bg-console-chrome">
        <div className="flex h-14 items-center justify-between gap-4 px-5">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-lg font-semibold tracking-[-0.01em] text-console-ink">
              CareLoop
            </h1>
            <span className="font-mono text-2xs uppercase tracking-[0.16em] text-console-muted">
              judge console
            </span>
          </div>
          <div className="flex items-center gap-5">
            <ApiStatus tone="dark" />
            <Link
              to="/dashboard"
              className="rounded-control px-2.5 py-1.5 text-sm font-medium text-console-accent underline decoration-console-accent/30 decoration-1 underline-offset-4 transition-colors duration-150 hover:bg-console-accent/10 hover:decoration-console-accent"
            >
              Patient portal
            </Link>
          </div>
        </div>
      </header>

      <main className="px-5 py-5">
        <div className="grid min-h-[620px] gap-5 lg:h-[calc(100dvh-7.5rem)] lg:grid-cols-[21rem_1fr]">
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto pr-1">
            <LoopStatus events={events} />
            <ControlPanel
              patientId={patientId}
              onPatientChange={setPatientId}
              scenario={scenario}
              onScenarioChange={setScenarioId}
              busy={busy}
              onCall={() => run(scenario.transcript)}
            />
            <TriageResult
              result={result}
              latencyMs={latency}
              booking={booking}
              bookingBusy={bookingBusy}
              onBook={bookFollowUp}
            />
            <TraceLegend />
          </div>

          <div className="flex min-h-0 flex-col gap-4">
            <ConsoleNotice />
            <FreeTextTriage busy={busy} error={error} onSubmit={run} />
            <TracePanel
              events={events}
              status={status}
              retries={retries}
              maxRetries={maxRetries}
              onClear={clear}
            />
          </div>
        </div>

        <div className="mt-5">
          <FairnessChart />
        </div>
      </main>
    </div>
  )
}

function ControlPanel({
  patientId,
  onPatientChange,
  scenario,
  onScenarioChange,
  busy,
  onCall,
}) {
  return (
    <section className="overflow-hidden rounded-card border border-console-line bg-console-panel">
      <h2 className="border-b border-console-line bg-console-chrome px-5 py-2.5 font-mono text-2xs font-bold uppercase tracking-[0.18em] text-console-ink">
        Run a check-in
      </h2>

      <div className="p-5">
        <label
          htmlFor="console-patient"
          className="block font-mono text-micro uppercase text-console-muted"
        >
          Patient
        </label>
        <select
          id="console-patient"
          value={patientId}
          onChange={(event) => onPatientChange(event.target.value)}
          className="field-select mt-2 w-full rounded-control border border-console-line bg-console-inset px-3 py-2.5 text-sm text-console-ink transition-colors duration-150 hover:border-console-line-2"
        >
          {PATIENTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.id})
            </option>
          ))}
        </select>

        <h3 className="mt-5 font-mono text-micro uppercase text-console-muted">
          Scenario
        </h3>
        <div
          role="radiogroup"
          aria-label="Scenario"
          className="mt-2 flex flex-wrap gap-1.5"
        >
          {SCENARIOS.map((item) => {
            const active = item.id === scenario.id
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onScenarioChange(item.id)}
                className={
                  'rounded-full border px-2.5 py-1 text-2xs font-medium transition-[background-color,border-color,color] duration-150 ease-out ' +
                  (active
                    ? 'border-console-accent/60 bg-console-accent/12 text-console-accent'
                    : 'border-console-line text-console-muted hover:border-console-line-2 hover:text-console-ink')
                }
              >
                {item.label}
              </button>
            )
          })}
        </div>

        <p className="mt-3 border-l-2 border-console-line-2 bg-console-inset py-2.5 pl-3 pr-3 font-mono text-xs leading-relaxed text-console-ink-2">
          {scenario.transcript}
        </p>

        <button
          type="button"
          onClick={onCall}
          disabled={busy}
          className="mt-4 w-full rounded-control border border-console-accent/50 bg-console-accent/10 px-4 py-3 text-sm font-bold uppercase tracking-[0.04em] text-console-accent transition-[background-color,transform] duration-150 ease-out hover:bg-console-accent/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Calling...' : 'Call Now'}
        </button>
        <p className="mt-2.5 text-2xs leading-relaxed text-console-muted">
          Simulated reminder call. Sends the selected transcript to POST
          /triage for the selected patient.
        </p>
      </div>
    </section>
  )
}
