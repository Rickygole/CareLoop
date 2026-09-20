import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import CheckIn from '../components/CheckIn.jsx'
import Notice from '../components/Notice.jsx'
import Screen from '../components/Screen.jsx'
import VoicePanel from '../components/VoicePanel.jsx'
import { CallHeading, Event, Spine } from '../components/DaySpine.jsx'
import { InteractionPin } from '../components/InteractionFlags.jsx'
import {
  RUN_TIMEOUT_MS,
  ringPatient,
  runLoop,
  withTimeout,
} from '../lib/api.js'
import { applyClockShift } from '../lib/clock.js'
import { clockLabel } from '../lib/format.js'
import { callEvents, countWord, dayLabel, nextCallIndex } from '../lib/day.js'
import { flaggedNames, isFlagged } from '../lib/flagged.js'
import { isConfigured } from '../lib/voice.js'
import { useSession } from '../lib/session.jsx'
import { SCENARIOS } from '../data/scenarios.js'
import { patientName } from '../data/patients.js'

const CHECK = String.fromCharCode(10003)

const FAILED =
  'CareLoop could not reach its own service just now. Nothing was recorded. Press Send again to retry, or call your clinic directly if this is urgent.'

const TIMED_OUT =
  'CareLoop waited ' +
  Math.round(RUN_TIMEOUT_MS / 1000) +
  ' seconds for an answer from its own service and stopped. Nothing was recorded. Press Send again to retry, or call your clinic directly if this is urgent.'

function whereInTheDay(events, index) {
  if (!events.length) {
    return 'No call is planned today. You can still take a check-in.'
  }
  if (index === -1) {
    return 'Every call today is behind you. You can still take a check-in.'
  }
  return ''
}

function medicinesLine(event) {
  const names = event.medications || []
  if (names.length < 2) {
    const dose = (event.doses || [])[0]
    return dose
      ? dose.medication +
          (dose.dosage ? ' ' + dose.dosage : '') +
          ', ' +
          clockLabel(dose.time)
      : ''
  }
  return (
    names.slice(0, -1).join(', ') +
    ' and ' +
    names[names.length - 1] +
    ', one call'
  )
}

function takenLine(event) {
  const n = event.covers || (event.doses || []).length
  if (n === 1) return 'Taken'
  if (n === 2) return 'Both taken'
  return 'All ' + countWord(n) + ' taken'
}

export default function CallPage() {
  const navigate = useNavigate()
  const {
    patientId,
    record,
    medications,
    schedule,
    clockShiftMs,
    recordRun,
    regimen,
  } = useSession()

  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState('')

  const spoken = isConfigured()
  const plan = applyClockShift(schedule, clockShiftMs)
  const events = callEvents(plan)
  const index = nextCallIndex(plan, events)
  const openCall = index === -1 ? null : events[index]

  const dose = plan && plan.next_dose
  const prescribed =
    dose &&
    (medications || []).find(
      (item) => item.medication_id === dose.medication_id,
    )
  const next = dose
    ? { ...dose, indication: (prescribed && prescribed.indication) || '' }
    : dose
  const who = record ? record.name : patientName(patientId)

  const marked = flaggedNames((regimen && regimen.surfaced) || [])
  const finding =
    openCall && (openCall.doses || []).some((item) => isFlagged(item, marked))
      ? ((regimen && regimen.surfaced) || [])[0]
      : null
  const isDoseFlagged = isFlagged(next, marked)

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

  const where = whereInTheDay(events, index)

  const asks = [
    next
      ? 'Did you take your ' +
        next.medication +
        (next.dosage ? ' ' + next.dosage : '')
      : 'Did you take the medicine on your list',
    index > 0
      ? 'How are you feeling since the last call'
      : 'How are you feeling today',
    'Anything new you have noticed since then',
  ]

  const panel = (
    <>
      <VoicePanel
        patientId={patientId}
        patientName={who}
        nextDose={next}
        scenarios={SCENARIOS}
        busy={busy}
        error={failed || null}
        onReply={check}
        isDoseFlagged={isDoseFlagged}
        onRing={ring}
      >
        <div className="mt-8">
          {finding ? <InteractionPin finding={finding} /> : null}

          <details className="mt-7">
            <summary className="marker:text-clay cursor-pointer py-3 text-base font-semibold text-ink">
              What CareLoop asks on this call
            </summary>
            <ol className="mt-3 flex flex-col gap-2">
              {asks.map((question, position) => (
                <li key={question} className="flex gap-x-4 text-base text-ink">
                  <span className="numeric font-semibold text-ink-2">
                    {position + 1}.
                  </span>
                  <span>{question}</span>
                </li>
              ))}
            </ol>
          </details>
        </div>
      </VoicePanel>

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
    </>
  )

  return (
    <Screen title="Check-in">
      <section aria-labelledby="call-day-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-x-10 gap-y-2">
          <h2 id="call-day-heading" className="display text-lg text-ink-2">
            {dayLabel(plan)}
          </h2>
          {where ? (
            <p className="text-sm font-semibold text-ink-2">{where}</p>
          ) : null}
        </div>

        <Spine>
          {events.map((event, position) => {
            if (position === index) {
              return (
                <Event
                  key={event.at + event.time}
                  index={position}
                  time={clockLabel(event.time)}
                  state="Now"
                  tone="now"
                  last={position === events.length - 1}
                >
                  {panel}
                </Event>
              )
            }

            const done = event.status === 'taken'
            const missed = event.status === 'missed'

            return (
              <Event
                key={event.at + event.time}
                index={position}
                time={clockLabel(event.time)}
                state={done ? 'Done' : missed ? 'Not confirmed' : 'Later'}
                tone={done ? 'done' : missed ? 'alert' : 'later'}
                last={position === events.length - 1}
              >
                <CallHeading
                  title={
                    done || missed
                      ? 'CareLoop called you'
                      : 'CareLoop will call again'
                  }
                  covers={medicinesLine(event)}
                  mark={
                    done ? (
                      <p className="flex items-center gap-2 text-sm font-semibold text-mild">
                        <span aria-hidden="true" className="leading-none">
                          {CHECK}
                        </span>
                        {takenLine(event)}
                      </p>
                    ) : null
                  }
                />
              </Event>
            )
          })}

          {index === -1 ? (
            <Event
              last
              index={events.length}
              time="Now"
              state="Any time"
              tone="now"
            >
              {panel}
            </Event>
          ) : null}
        </Spine>
      </section>
    </Screen>
  )
}
