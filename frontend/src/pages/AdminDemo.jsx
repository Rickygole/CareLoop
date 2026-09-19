import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import ApiStatus from '../components/ApiStatus.jsx'
import ClinicCall from '../components/ClinicCall.jsx'
import FairnessChart from '../components/FairnessChart.jsx'
import FreeTextTriage from '../components/FreeTextTriage.jsx'
import LoopRibbon from '../components/LoopRibbon.jsx'
import TracePanel from '../components/TracePanel.jsx'
import TriageResult from '../components/TriageResult.jsx'
import VoiceAgent from '../components/VoiceAgent.jsx'
import { ConsoleNotice } from '../components/Disclaimers.jsx'
import { runLoop } from '../lib/api.js'
import { useTrace } from '../lib/useTrace.js'
import { DEFAULT_PATIENT_ID, PATIENTS, patientName } from '../data/patients.js'
import { SCENARIOS } from '../data/scenarios.js'

export default function AdminDemo() {
  const [patientId, setPatientId] = useState(DEFAULT_PATIENT_ID)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [run, setRun] = useState(null)
  const [latency, setLatency] = useState(null)

  const { events, status, retries, maxRetries } = useTrace()

  useEffect(() => {
    document.title = 'CareLoop judge console'
  }, [])

  const runFullLoop = useCallback(
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
          <div className="flex items-center gap-4">
            <label htmlFor="console-patient" className="sr-only">
              Patient
            </label>
            <select
              id="console-patient"
              value={patientId}
              onChange={(event) => setPatientId(event.target.value)}
              className="field-select rounded-control border border-console-line bg-console-inset px-2.5 py-1.5 text-2xs text-console-ink transition-colors duration-150 hover:border-console-line-2"
            >
              {PATIENTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
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

      <main className="mx-auto max-w-6xl px-5 py-6">
        <div className="flex flex-col gap-5">
          <ConsoleNotice />

          <VoiceAgent patientId={patientId} patientName={patientName(patientId)} />

          <FreeTextTriage
            busy={busy}
            error={error}
            scenarios={SCENARIOS}
            onSubmit={runFullLoop}
          />

          <LoopRibbon run={run} busy={busy} />

          <TriageResult result={run && run.triage} latencyMs={latency} />

          <ClinicCall
            events={run ? run.events : []}
            booking={run && run.booking}
            tier={run && run.triage && run.triage.tier}
          />

          <TracePanel
            events={events}
            status={status}
            retries={retries}
            maxRetries={maxRetries}
          />

          <FairnessChart />
        </div>
      </main>
    </div>
  )
}
