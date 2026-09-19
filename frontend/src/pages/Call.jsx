import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import CheckIn from '../components/CheckIn.jsx'
import Screen from '../components/Screen.jsx'
import VoicePanel from '../components/VoicePanel.jsx'
import { runLoop } from '../lib/api.js'
import { applyClockShift } from '../lib/clock.js'
import { clockLabel } from '../lib/format.js'
import { isConfigured } from '../lib/voice.js'
import { useSession } from '../lib/session.jsx'
import { SCENARIOS } from '../data/scenarios.js'
import { patientName } from '../data/patients.js'

const FAILED =
  'CareLoop could not reach the line just now. Nothing was recorded. Send your answer again to retry.'

export default function CallPage() {
  const navigate = useNavigate()
  const { patientId, record, schedule, clockShiftMs, recordRun } = useSession()

  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const spoken = isConfigured()
  const plan = applyClockShift(schedule, clockShiftMs)
  const next = plan && plan.next_dose
  const due = next && (next.status === 'due_now' || next.status === 'due_soon')
  const who = record ? record.name : patientName(patientId)

  const check = useCallback(
    async (transcript) => {
      setBusy(true)
      setFailed(false)
      const started = performance.now()
      try {
        const payload = await runLoop(transcript, patientId)
        recordRun(payload, Math.round(performance.now() - started))
        return payload
      } catch {
        setFailed(true)
        return null
      } finally {
        setBusy(false)
      }
    },
    [patientId, recordRun],
  )

  const start = useCallback(
    async (transcript) => {
      const payload = await check(transcript)
      if (payload) navigate('/decision')
    },
    [check, navigate],
  )

  return (
    <Screen
      mark="03"
      label="Step 3 of 5"
      title="The call CareLoop makes"
      lead={
        'When a dose comes due, CareLoop rings ' +
        who +
        ' and asks two things: did you take it, and how are you feeling. It decides what to do about the answer while the line is still open. Take that call now.'
      }
    >
      <p className="measure mt-7 border-l-4 border-brand bg-brand-wash px-6 py-5 text-ink">
        {next ? (
          due ? (
            <span>
              <strong className="font-semibold">
                {next.medication}
                {next.dosage ? ' ' + next.dosage : ''} is due now,
              </strong>{' '}
              so this is the call CareLoop would be placing.
            </span>
          ) : (
            <span>
              <strong className="font-semibold">
                The next call is at {clockLabel(next.time)},
              </strong>{' '}
              about {next.medication}
              {next.dosage ? ' ' + next.dosage : ''}. You do not have to wait
              for it. Answer now and CareLoop handles it exactly as it would on
              the hour, or{' '}
              <Link
                to="/meds"
                className="font-semibold text-brand-deep underline"
              >
                move the clock forward
              </Link>{' '}
              first.
            </span>
          )
        ) : (
          <span>
            Nothing is due right now. You can still talk to CareLoop, and it
            will handle what you say exactly as it would on a scheduled call.
          </span>
        )}
      </p>

      <VoicePanel
        patientId={patientId}
        patientName={who}
        nextDose={next}
        scenarios={SCENARIOS}
        busy={busy}
        error={failed ? FAILED : null}
        onReply={check}
      />

      {spoken ? (
        <CheckIn
          busy={busy}
          error={failed ? FAILED : null}
          scenarios={SCENARIOS}
          onSubmit={start}
        />
      ) : null}

      <div role="status" aria-live="polite" className="empty:hidden">
        {spoken && busy ? (
          <p className="enter-fade mt-10 border-l-4 border-brand bg-brand-wash px-6 py-5 text-sm font-semibold text-brand-deep">
            CareLoop is on the call. Listening, checking, and deciding what to
            do.
          </p>
        ) : null}
      </div>
    </Screen>
  )
}
