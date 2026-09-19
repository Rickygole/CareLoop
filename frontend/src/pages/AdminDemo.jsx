import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import ApiStatus from '../components/ApiStatus.jsx'
import FairnessChart from '../components/FairnessChart.jsx'
import FreeTextTriage from '../components/FreeTextTriage.jsx'
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
    <div className="min-h-dvh bg-console-2 text-console-ink">
      <header className="sticky top-0 z-30 border-b border-console-line bg-console-2/95 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-base font-semibold tracking-tight">
              CareLoop judge console
            </h1>
            <span className="hidden font-mono text-2xs text-console-muted sm:inline">
              live pipeline trace
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ApiStatus tone="dark" />
            <Link
              to="/dashboard"
              className="rounded-[8px] px-2 py-1 text-sm font-medium text-[#2DD4BF] transition-colors duration-150 hover:bg-console"
            >
              Patient portal
            </Link>
          </div>
        </div>
      </header>

      <main className="px-5 py-5">
        <div className="grid min-h-[600px] gap-5 lg:h-[calc(100dvh-8.5rem)] lg:grid-cols-[30%_1fr]">
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto">
            <ControlPanel
              patientId={patientId}
              onPatientChange={setPatientId}
              scenario={scenario}
              onScenarioChange={setScenarioId}
              busy={busy}
              onCall={() => run(scenario.transcript)}
            />
          </div>

          <div className="flex min-h-0 flex-col gap-4">
            <ConsoleNotice />
            <FreeTextTriage busy={busy} error={error} onSubmit={run} />
            <TriageResult
              result={result}
              latencyMs={latency}
              booking={booking}
              bookingBusy={bookingBusy}
              onBook={bookFollowUp}
            />
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
    <section className="rounded-card border border-console-line bg-console p-5">
      <h2 className="text-sm font-semibold">Run a check-in</h2>

      <label
        htmlFor="console-patient"
        className="mt-4 block font-mono text-2xs uppercase tracking-wide text-console-muted"
      >
        Patient
      </label>
      <select
        id="console-patient"
        value={patientId}
        onChange={(event) => onPatientChange(event.target.value)}
        className="mt-2 w-full rounded-[10px] border border-console-line bg-console-2 px-3 py-2.5 text-sm text-console-ink transition-colors duration-150 hover:border-console-muted"
      >
        {PATIENTS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.id})
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onCall}
        disabled={busy}
        className="mt-5 w-full rounded-[10px] bg-[#14B8A6] px-4 py-3.5 text-base font-semibold text-[#06201D] transition-[background-color,transform] duration-150 ease-out hover:bg-[#2DD4BF] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Calling...' : 'Call Now'}
      </button>
      <p className="mt-2 font-mono text-2xs leading-relaxed text-console-muted">
        Simulated check-in call. Sends the selected scenario transcript to POST
        /triage for the selected patient.
      </p>

      <h3 className="mt-6 font-mono text-2xs uppercase tracking-wide text-console-muted">
        Scenario
      </h3>
      <div role="radiogroup" aria-label="Scenario" className="mt-2 flex flex-wrap gap-2">
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
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.98] ' +
                (active
                  ? 'border-[#2DD4BF] bg-[#2DD4BF]/15 text-[#2DD4BF]'
                  : 'border-console-line text-console-muted hover:border-console-muted hover:text-console-ink')
              }
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <p className="mt-4 rounded-[10px] border border-console-line bg-console-2 px-3 py-2.5 font-mono text-xs leading-relaxed text-console-ink">
        {scenario.transcript}
      </p>
    </section>
  )
}
