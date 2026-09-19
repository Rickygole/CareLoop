import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import CheckIn from '../components/CheckIn.jsx'
import Screen from '../components/Screen.jsx'
import VoicePanel from '../components/VoicePanel.jsx'
import { runLoop } from '../lib/api.js'
import { applyClockShift } from '../lib/clock.js'
import { clockLabel } from '../lib/format.js'
import { useSession } from '../lib/session.jsx'
import { SCENARIOS } from '../data/scenarios.js'
import { patientName } from '../data/patients.js'

export default function CallPage() {
  const navigate = useNavigate()
  const { patientId, record, schedule, clockShiftMs, recordRun } = useSession()

  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const plan = applyClockShift(schedule, clockShiftMs)
  const next = plan && plan.next_dose
  const due = next && (next.status === 'due_now' || next.status === 'due_soon')
  const who = record ? record.name : patientName(patientId)

  const start = useCallback(
    async (transcript) => {
      setBusy(true)
      setFailed(false)
      const started = performance.now()
      try {
        const payload = await runLoop(transcript, patientId)
        recordRun(payload, Math.round(performance.now() - started))
        navigate('/decision')
      } catch {
        setFailed(true)
      } finally {
        setBusy(false)
      }
    },
    [navigate, patientId, recordRun],
  )

  return (
    <Screen
      mark="03"
      label="The call"
      title="Talk to CareLoop"
      lead={
        'This is the call itself. CareLoop asks ' +
        who +
        ' whether the dose went down and how they are feeling, and it decides what to do while the line is still open.'
      }
    >
      <p className="measure mt-7 border-l-4 border-brand bg-brand-wash px-6 py-5 text-ink">
        {next ? (
          due ? (
            <span>
              <strong className="font-semibold">
                {next.medication}
                {next.dosage ? ' ' + next.dosage : ''} is due now.
              </strong>{' '}
              This is the call CareLoop would place.
            </span>
          ) : (
            <span>
              The next dose, {next.medication}
              {next.dosage ? ' ' + next.dosage : ''}, is due at{' '}
              {clockLabel(next.time)}. You do not have to wait for it:{' '}
              <Link
                to="/meds"
                className="font-semibold text-brand-deep underline"
              >
                move the clock forward on the medicines screen
              </Link>{' '}
              and come back.
            </span>
          )
        ) : (
          <span>
            Nothing is due right now. You can still talk to CareLoop, and it
            will handle what you say exactly as it would on a scheduled call.
          </span>
        )}
      </p>

      <VoicePanel patientId={patientId} patientName={who} />

      <CheckIn
        busy={busy}
        error={
          failed
            ? 'CareLoop could not reach the line just now. Nothing was recorded. Press Start the check-in to try again.'
            : null
        }
        scenarios={SCENARIOS}
        patientId={patientId}
        onSubmit={start}
      />

      <div role="status" aria-live="polite" className="empty:hidden">
        {busy ? (
          <p className="enter-fade mt-10 border-l-4 border-brand bg-brand-wash px-6 py-5 text-sm font-semibold text-brand-deep">
            CareLoop is on the call. Listening, checking, and deciding what to
            do.
          </p>
        ) : null}
      </div>
    </Screen>
  )
}
