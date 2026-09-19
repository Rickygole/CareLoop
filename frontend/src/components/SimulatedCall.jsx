import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import CheckIn from './CheckIn.jsx'
import Notice from './Notice.jsx'
import { clockLabel, dateTimeLabel } from '../lib/format.js'
import { BTN_HERO, BTN_PRIMARY, BTN_QUIET, PANEL } from '../lib/ui.js'

export const SIMULATION_DISCLOSURE =
  'Simulated call. CareLoop is not speaking to you; this is a scripted stand-in for the voice agent.'

const GAP_SHORT = 700
const GAP = 900
const GAP_LONG = 1100
const GAP_REDUCED = 200

const SAFETY =
  'Please do not describe your own real health. This is a demonstration and every record in it is made up.'

const FALLBACK_RESPONSE =
  'Thank you for telling me. I have passed that on and made a note of it on your record.'

function reducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function pause(ms) {
  const wait = reducedMotion() ? GAP_REDUCED : ms
  return new Promise((resolve) => setTimeout(resolve, wait))
}

function firstNameOf(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'there'
}

function greetingLine(first, dose) {
  const medication = dose && dose.medication ? 'your ' + dose.medication : 'your medication'
  return (
    'Hi ' +
    first +
    ', this is CareLoop calling to check in on ' +
    medication +
    ". Quick note, I'm an automated check-in assistant, not a medical " +
    'professional, and this is a demonstration. Do you have a couple of ' +
    'minutes?'
  )
}

function doseLine(dose) {
  if (!dose || !dose.medication) {
    return 'Did you take your medication today, and how have you been feeling since?'
  }
  const named = dose.dosage
    ? 'your ' + dose.dosage + ' ' + dose.medication
    : 'your ' + dose.medication
  const when = dose.time ? ' It is on your schedule for ' + clockLabel(dose.time) + '.' : ''
  return 'Did you take ' + named + ' today?' + when + ' And how have you been feeling since?'
}

function bookingLine(booking) {
  const provider = booking.provider_name || 'the clinic'
  const when = booking.time ? ' at ' + dateTimeLabel(booking.time) : ''
  return (
    'I have rung the clinic for you and booked a follow-up with ' +
    provider +
    when +
    '.'
  )
}

function closingLine(triage) {
  if (triage.is_crisis) {
    return 'I am staying on the line with you. This call does not end here, and I am not going anywhere.'
  }
  if (triage.is_emergency) {
    return 'I am alerting your care team now. Please do what I said as soon as we hang up.'
  }
  return 'That is everything I needed for this check-in. Take care, and I will call again next time.'
}

function timeLabel(at) {
  return at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function Turn({ turn, index }) {
  const mine = turn.speaker === 'patient'

  return (
    <li
      className={
        'enter-rise ledge ledge-strong rounded-card border-2 px-6 py-5 ' +
        (mine
          ? 'border-ink bg-sand sm:ml-10'
          : 'border-edge-strong bg-surface sm:mr-10')
      }
      style={{ '--i': index }}
    >
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="smallcaps text-micro text-ink">
          {mine ? 'You' : 'CareLoop'}
        </span>
        <span className="numeric text-2xs text-ink-2">
          <time dateTime={turn.at.toISOString()}>{timeLabel(turn.at)}</time>
        </span>
      </p>
      <p className="measure mt-3 text-ink">{turn.text}</p>
      {turn.note ? (
        <p className="measure mt-4 rounded-card border-2 border-moderate bg-moderate-tint px-4 py-3 text-sm text-ink">
          <span aria-hidden="true" className="mr-3 text-moderate">
            {String.fromCharCode(9651)}
          </span>
          {turn.note}
        </p>
      ) : null}
    </li>
  )
}

export default function SimulatedCall({
  patientName,
  nextDose,
  scenarios,
  busy,
  error,
  onReply,
}) {
  const [turns, setTurns] = useState([])
  const [phase, setPhase] = useState('idle')
  const alive = useRef(true)
  const seq = useRef(0)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const say = useCallback((speaker, text, note) => {
    seq.current += 1
    const turn = { id: seq.current, speaker, text, note: note || null, at: new Date() }
    setTurns((list) => list.concat(turn))
  }, [])

  const begin = useCallback(async () => {
    setTurns([])
    setPhase('greeting')
    say('careloop', greetingLine(firstNameOf(patientName), nextDose))
    await pause(GAP_LONG)
    if (!alive.current) return
    say('careloop', doseLine(nextDose))
    await pause(GAP_SHORT)
    if (!alive.current) return
    setPhase('awaiting')
  }, [nextDose, patientName, say])

  const reply = useCallback(
    async (transcript) => {
      say('patient', transcript)
      setPhase('thinking')
      let payload = null
      try {
        payload = await onReply(transcript)
      } catch {
        payload = null
      }
      if (!alive.current) return
      if (!payload) {
        setPhase('awaiting')
        return
      }
      const triage = payload.triage || {}
      const booking = payload.booking
      await pause(GAP)
      if (!alive.current) return
      say('careloop', triage.suggested_agent_response || FALLBACK_RESPONSE)
      if (booking) {
        await pause(GAP_LONG)
        if (!alive.current) return
        say('careloop', bookingLine(booking), booking.disclosure)
      }
      await pause(GAP)
      if (!alive.current) return
      say('careloop', closingLine(triage))
      setPhase('ended')
    },
    [onReply, say],
  )

  const speaking = phase === 'greeting'
  const thinking = phase === 'thinking'

  return (
    <div className="mt-10">
      <section
        aria-labelledby="simulated-call-heading"
        className={PANEL + ' px-6 py-8 sm:px-10 sm:py-10'}
      >
        <h2 id="simulated-call-heading" className="display text-xl text-ink">
          A simulated check-in call
        </h2>
        <p className="measure mt-3 text-ink-2">
          The spoken version needs a voice service that is not switched on
          here, so the call plays out in writing, turn by turn. Every decision
          in it comes from the real CareLoop service.
        </p>

        <Notice tone="caution" word="Simulated" className="mt-7">
          {SIMULATION_DISCLOSURE}
        </Notice>

        <Notice tone="quiet" word="Safety" className="mt-5" size="sm">
          {SAFETY}
        </Notice>

        {turns.length ? (
          <ol
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Call transcript"
            className="mt-9 flex flex-col gap-5"
          >
            {turns.map((turn, index) => (
              <Turn key={turn.id} turn={turn} index={index} />
            ))}
          </ol>
        ) : (
          <p className="measure mt-9 text-ink-2">
            No call has been placed yet.
          </p>
        )}

        <div role="status" aria-live="polite" className="empty:hidden">
          {speaking || thinking ? (
            <p className="enter-fade mt-7 flex items-center gap-4 text-sm font-bold text-clay">
              <span
                aria-hidden="true"
                className="inline-block h-3.5 w-3.5 shrink-0 rounded-full bg-clay"
              />
              <span>
                {thinking
                  ? 'CareLoop is working out what to do about that.'
                  : 'CareLoop is speaking. Wait for the question.'}
              </span>
            </p>
          ) : null}
        </div>

        {phase === 'idle' ? (
          <button type="button" onClick={begin} className={BTN_HERO + ' mt-9'}>
            Start the simulated call
          </button>
        ) : null}

        {phase === 'ended' ? (
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link to="/decision" className={BTN_PRIMARY}>
              See what CareLoop decided
            </Link>
            <button type="button" onClick={begin} className={BTN_QUIET}>
              Run the call again
            </button>
          </div>
        ) : null}
      </section>

      {phase === 'idle' || phase === 'ended' ? null : (
        <CheckIn
          busy={busy || phase !== 'awaiting'}
          error={error}
          scenarios={scenarios}
          onSubmit={reply}
        />
      )}
    </div>
  )
}
