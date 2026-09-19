import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import CheckIn from '../components/CheckIn.jsx'
import Notice from '../components/Notice.jsx'
import PhoneCallCard from '../components/PhoneCallCard.jsx'
import Screen from '../components/Screen.jsx'
import VoicePanel from '../components/VoicePanel.jsx'
import { RUN_TIMEOUT_MS, ringPatient, runLoop, withTimeout } from '../lib/api.js'
import { applyClockShift } from '../lib/clock.js'
import { clockLabel } from '../lib/format.js'
import { isConfigured } from '../lib/voice.js'
import { useSession } from '../lib/session.jsx'
import { SCENARIOS } from '../data/scenarios.js'
import { patientName } from '../data/patients.js'

const FAILED =
  'CareLoop could not reach the line just now. Nothing was recorded. Send your answer again to retry.'

const TIMED_OUT =
  'CareLoop waited ' +
  Math.round(RUN_TIMEOUT_MS / 1000) +
  ' seconds for an answer from its own service and stopped. Nothing was recorded. Send your answer again to retry.'

export default function CallPage() {
  const navigate = useNavigate()
  const { patientId, record, medications, schedule, clockShiftMs, recordRun } =
    useSession()

  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState('')

  const spoken = isConfigured()
  const plan = applyClockShift(schedule, clockShiftMs)
  const dose = plan && plan.next_dose
  const prescribed =
    dose &&
    (medications || []).find(
      (item) => item.medication_id === dose.medication_id,
    )
  const next = dose
    ? { ...dose, indication: (prescribed && prescribed.indication) || '' }
    : dose
  const due = next && (next.status === 'due_now' || next.status === 'due_soon')
  const who = record ? record.name : patientName(patientId)

  const check = useCallback(
    async (transcript) => {
      setBusy(true)
      setFailed('')
      const started = performance.now()
      try {
        const payload = await withTimeout(
          (signal) => runLoop(transcript, patientId, signal),
          RUN_TIMEOUT_MS,
        )
        recordRun(payload, Math.round(performance.now() - started))
        return payload
      } catch (error) {
        setFailed(error && error.timedOut ? TIMED_OUT : FAILED)
        return null
      } finally {
        setBusy(false)
      }
    },
    [patientId, recordRun],
  )

  const ring = useCallback(async () => {
    try {
      return await withTimeout((signal) => ringPatient(patientId, signal))
    } catch {
      return null
    }
  }, [patientId])

  const start = useCallback(
    async (transcript) => {
      const payload = await check(transcript)
      if (payload) navigate('/decision')
    },
    [check, navigate],
  )

  return (
    <Screen title="Check-in">
      <Notice tone="info" word={due ? 'Due now' : 'Coming up'} className="measure">
        {next ? (
          due ? (
            <span>
              <strong className="font-semibold">
                {next.medication}
                {next.dosage ? ' ' + next.dosage : ''} is due now.
              </strong>
            </span>
          ) : (
            <span>
              <strong className="font-semibold">
                Next call at {clockLabel(next.time)},
              </strong>{' '}
              about {next.medication}
              {next.dosage ? ' ' + next.dosage : ''}. You do not have to wait
              for it.
            </span>
          )
        ) : (
          <span>Nothing is due right now. You can still take the check-in.</span>
        )}
      </Notice>

      {spoken ? <PhoneCallCard patientName={who} /> : null}

      <VoicePanel
        patientId={patientId}
        patientName={who}
        nextDose={next}
        scenarios={SCENARIOS}
        busy={busy}
        error={failed || null}
        onReply={check}
        onRing={ring}
      />

      {spoken ? (
        <CheckIn
          busy={busy}
          error={failed || null}
          scenarios={SCENARIOS}
          onSubmit={start}
        />
      ) : null}

      <div role="status" aria-live="polite" className="empty:hidden">
        {spoken && busy ? (
          <Notice
            tone="info"
            word="On the call"
            className="enter-fade measure mt-10"
          >
            The check-in is running.
          </Notice>
        ) : null}
      </div>
    </Screen>
  )
}
