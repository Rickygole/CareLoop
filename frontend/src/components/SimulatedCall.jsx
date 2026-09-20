import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import CheckIn from './CheckIn.jsx'
import { SafetyNote } from './Disclaimers.jsx'
import { callState } from '../lib/api.js'
import { dateTimeLabel } from '../lib/format.js'
import {
  BTN_HERO,
  BTN_PRIMARY,
  BTN_QUIET,
  BTN_SECONDARY,
  LEAD,
} from '../lib/ui.js'
import {
  CALL_STATUS,
  callSidFrom,
  isConfigured as phoneConfigured,
  missingFrom,
  statusFromPayload,
} from '../lib/telephony.js'

export const SIMULATION_DISCLOSURE =
  'Simulated call. CareLoop is not speaking to you; this is a scripted stand-in for the voice agent.'

const GAP_SHORT = 700
const GAP = 900
const GAP_LONG = 1100
const GAP_REDUCED = 200

const POLL_MS = 2000
const MAX_POLL_FAILURES = 5

const FALLBACK_RESPONSE =
  'Thank you for telling me. I have made a note of it on your record.'

const RING = String.fromCharCode(9679)
const DASH = String.fromCharCode(8213)
const CHECK = String.fromCharCode(10003)
const DIAMOND = String.fromCharCode(9670)

const PHASE_WORD = {
  dialling: { word: 'Calling', glyph: RING },
  ringing: { word: 'Ringing', glyph: RING },
  disconnected: { word: 'Disconnected', glyph: DASH },
  redialling: { word: 'Calling again', glyph: RING },
  answered: { word: 'On the call', glyph: CHECK },
  ended: { word: 'Call ended', glyph: DASH },
  gave_up: { word: 'Stopped calling', glyph: DIAMOND },
}

const POLL_DONE = ['ended', 'gave_up']
const POLL_MAX_MS = 180000

function reducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function pause(ms) {
  const wait = reducedMotion() ? GAP_REDUCED : ms
  return new Promise((resolve) => setTimeout(resolve, wait))
}

function firstNameOf(name) {
  return (
    String(name || '')
      .trim()
      .split(/\s+/)[0] || 'there'
  )
}

function greetingLine(first) {
  return (
    'Hello ' +
    first +
    '. This is CareLoop, your medication assistant. Quick note before we ' +
    'start. I am an automated assistant, not a medical professional, and ' +
    'this is a demonstration.'
  )
}

function doseTiming(dose) {
  if (!dose || !dose.time) return { when: 'due today', dueNow: false }
  if (dose.status === 'due_now' || dose.status === 'due_soon') {
    return { when: 'due at about this time', dueNow: true }
  }
  const [h] = String(dose.time).split(':')
  const hour = Number(h)
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  const suffix = hour >= 12 ? 'pm' : 'am'
  return {
    when: 'due later today, at ' + twelve + ' ' + suffix,
    dueNow: false,
  }
}

function doseLine(first, dose, flagged) {
  const named = dose && dose.medication ? dose.medication : 'medication'
  const amount = dose && dose.dosage ? ', ' + dose.dosage : ''
  const why = dose && dose.indication ? ', the one ' + dose.indication : ''
  const { when, dueNow } = doseTiming(dose)

  if (flagged) {
    return (
      first +
      ", how have you been feeling? Separately, your prescriber's schedule " +
      'has your ' +
      named +
      amount +
      ' ' +
      when +
      '. I am not going to ask you to take it, because something on your ' +
      'medication list is worth asking your prescriber or pharmacist about ' +
      'first. Please do not start, stop or change anything because of this ' +
      'call. Tell me how you are doing.'
    )
  }

  const take = dueNow ? 'Please take it now if you have not already. ' : ''
  return (
    first +
    ', how have you been feeling? And separately, this is a reminder about ' +
    'your ' +
    named +
    amount +
    why +
    ', ' +
    when +
    '. ' +
    take +
    'Tell me how you are doing, and let me know once you have taken it.'
  )
}

function bookingLine(booking) {
  const provider = booking.provider_name || 'the clinic'
  const when = booking.time ? ' at ' + dateTimeLabel(booking.time) : ''
  return (
    'I ran the booking call and got you a follow-up with ' +
    provider +
    when +
    '.'
  )
}

function closingLine(triage, first, bookingPending) {
  if (triage.is_crisis) {
    return (
      'I am staying on the line with you. I am not going to hang up. If you ' +
      'can, please call or text 988 now, and stay with me until someone is ' +
      'with you.'
    )
  }
  if (triage.is_emergency) {
    return 'Please do that now. I am ending this call so your line is free.'
  }
  if (bookingPending) {
    return (
      'I have not heard back from you on that, ' +
      first +
      ', so I have not booked anything yet. That offer is still open. Start ' +
      'another written check-in to say yes or no, or call your clinic ' +
      'yourself if you would rather not wait. In the meantime, please keep ' +
      'taking your medication as your prescriber directed.'
    )
  }
  return (
    'Thank you, ' +
    first +
    '. I have made a note of that on your record. Please keep taking your ' +
    'medication as your prescriber directed. I will check in with you ' +
    'again. Take care.'
  )
}

function timeLabel(at) {
  return at.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function Turn({ turn, index }) {
  const mine = turn.speaker === 'patient'

  return (
    <li
      className={
        'enter-rise rounded-card px-5 py-4 sm:px-6 sm:py-5 ' +
        (turn.booked
          ? 'border-l-4 border-l-brand bg-brand-wash sm:mr-10'
          : mine
            ? 'bg-brand-wash sm:ml-10'
            : 'border border-line bg-surface sm:mr-10')
      }
      style={{ '--i': index }}
    >
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="smallcaps text-micro text-ink">
          {turn.booked ? 'CareLoop booked it' : mine ? 'You' : 'CareLoop'}
        </span>
        <span className="numeric text-2xs text-ink-2">
          <time dateTime={turn.at.toISOString()}>{timeLabel(turn.at)}</time>
        </span>
      </p>
      <p
        className={
          turn.booked
            ? 'measure display-tight mt-2 text-lg text-ink'
            : 'measure mt-2 text-ink'
        }
      >
        {turn.text}
      </p>
      {turn.note ? (
        <p className="measure mt-4 rounded-card border-l-4 border-l-moderate bg-moderate-tint px-4 py-3 text-sm text-ink">
          <span aria-hidden="true" className="mr-3 text-moderate">
            {String.fromCharCode(9651)}
          </span>
          {turn.note}
        </p>
      ) : null}
    </li>
  )
}

const RING_WORDING = {
  [CALL_STATUS.DIALLING]: 'Placing the call. Keep your phone to hand.',
  [CALL_STATUS.RINGING]:
    'Your phone is ringing now. Pick up and CareLoop will greet you by name. If you miss it, CareLoop sends you a text message instead.',
}

export default function SimulatedCall({
  patientName,
  nextDose,
  scenarios,
  busy,
  error,
  onReply,
  onRing,
  isDoseFlagged,
  children,
}) {
  const [turns, setTurns] = useState([])
  const [phase, setPhase] = useState('idle')
  const [ringState, setRingState] = useState(CALL_STATUS.IDLE)
  const [ringSid, setRingSid] = useState('')
  const [ringMissing, setRingMissing] = useState([])
  const [live, setLive] = useState(null)
  const [stateUnread, setStateUnread] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const alive = useRef(true)
  const seq = useRef(0)
  const poll = useRef(null)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (poll.current) {
      clearInterval(poll.current)
      poll.current = null
    }
  }, [])

  useEffect(() => stopPolling, [stopPolling])

  const startPolling = useCallback(() => {
    stopPolling()
    let failures = 0
    const startedAt = Date.now()
    const read = async () => {
      if (Date.now() - startedAt > POLL_MAX_MS) {
        stopPolling()
        setRingState(CALL_STATUS.IDLE)
        return
      }
      let state = null
      try {
        state = await callState('checkin')
      } catch {
        state = null
      }
      if (!alive.current) return
      if (!state) {
        failures += 1
        setStateUnread(true)
        if (failures >= MAX_POLL_FAILURES) {
          stopPolling()
          setRingState(CALL_STATUS.IDLE)
        }
        return
      }
      failures = 0
      setStateUnread(false)
      setLive(state)
      if (POLL_DONE.includes(state.phase)) stopPolling()
    }
    read()
    poll.current = setInterval(read, POLL_MS)
  }, [stopPolling])

  const say = useCallback((speaker, text, note, booked) => {
    seq.current += 1
    const turn = {
      id: seq.current,
      speaker,
      text,
      note: note || null,
      booked: Boolean(booked),
      at: new Date(),
    }
    setTurns((list) => list.concat(turn))
  }, [])

  const begin = useCallback(async () => {
    setTurns([])
    setPhase('greeting')
    const first = firstNameOf(patientName)
    say('careloop', greetingLine(first))
    await pause(GAP_LONG)
    if (!alive.current) return
    say('careloop', doseLine(first, nextDose, isDoseFlagged))
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
      const bookingPending = Boolean(payload.booking_pending) && !booking
      await pause(GAP)
      if (!alive.current) return
      say('careloop', triage.suggested_agent_response || FALLBACK_RESPONSE)
      if (booking) {
        await pause(GAP_LONG)
        if (!alive.current) return
        say('careloop', bookingLine(booking), booking.disclosure, true)
      }
      await pause(GAP)
      if (!alive.current) return
      say(
        'careloop',
        closingLine(triage, firstNameOf(patientName), bookingPending),
      )
      setPhase('ended')
    },
    [onReply, say],
  )

  const phoneLive = phoneConfigured() && typeof onRing === 'function'

  const ring = useCallback(async () => {
    setConfirming(false)
    setRingState(CALL_STATUS.DIALLING)
    setRingMissing([])
    setLive(null)
    setStateUnread(false)
    let payload = null
    try {
      payload = await onRing()
    } catch {
      payload = null
    }
    const next = statusFromPayload(payload)
    setRingSid(callSidFrom(payload))
    setRingMissing(missingFrom(payload))
    setRingState(next)
    if (next === CALL_STATUS.RINGING) startPolling()
  }, [onRing, startPolling])

  const speaking = phase === 'greeting'
  const thinking = phase === 'thinking'

  const phoneWorking =
    ringState === CALL_STATUS.DIALLING ||
    (ringState === CALL_STATUS.RINGING &&
      Boolean(live) &&
      !POLL_DONE.includes(live.phase))
  const writtenRunning = phase !== 'idle' && phase !== 'ended'
  const awaitingRetry = phase === 'awaiting' && Boolean(error)
  const beginButtonLabel = writtenRunning
    ? awaitingRetry
      ? 'The written check-in needs another try'
      : 'The written check-in is running'
    : 'Read the check-in in writing'

  const phaseWord = live ? PHASE_WORD[live.phase] : null

  return (
    <div>
      <section aria-labelledby="simulated-call-heading">
        <h2 id="simulated-call-heading" className="display text-xl text-ink">
          {phoneLive
            ? 'CareLoop rings your telephone'
            : 'The check-in, in writing'}
        </h2>
        {phoneLive ? null : (
          <p className={LEAD + ' mt-4'}>
            Calling out needs telephone settings that are not filled in here,
            so no phone will ring, and nothing pretends otherwise.
          </p>
        )}

        <div className="mt-7">
          <div className="flex flex-col items-start gap-y-5 sm:flex-row sm:items-center sm:gap-x-8">
            {phoneLive ? (
              <>
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  disabled={phoneWorking || writtenRunning}
                  className={BTN_HERO}
                >
                  {ringState === CALL_STATUS.DIALLING
                    ? 'Ringing your phone...'
                    : 'Call my phone now'}
                </button>
                <button
                  type="button"
                  onClick={begin}
                  disabled={phoneWorking || writtenRunning}
                  className={BTN_SECONDARY}
                >
                  {beginButtonLabel}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={begin}
                disabled={writtenRunning}
                className={BTN_HERO}
              >
                {beginButtonLabel}
              </button>
            )}
          </div>

          <p className="measure mt-4 text-sm text-ink-2">
            {SIMULATION_DISCLOSURE}
          </p>

          <SafetyNote className="mt-4" />

          {confirming ? (
            <div className="enter-fade mt-7 rounded-card bg-sunken px-6 py-6">
              <h3 className="display-tight text-lg text-ink">
                This will ring your telephone
              </h3>
              <p className="measure mt-3 text-ink">
                CareLoop is about to dial the phone number on this record. Your
                telephone will ring in a moment, like any other call. Have it
                next to you before you press Yes.
              </p>
              <div className="mt-8 flex flex-col gap-y-6 sm:flex-row sm:items-center sm:gap-x-12">
                <button type="button" onClick={ring} className={BTN_HERO}>
                  Yes, call my phone
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className={BTN_QUIET}
                >
                  Not now
                </button>
              </div>
            </div>
          ) : null}

          <div role="status" aria-live="polite" className="empty:hidden">
            {RING_WORDING[ringState] && !phaseWord ? (
              <p className="measure mt-6 text-sm font-semibold text-ink">
                {RING_WORDING[ringState]}
                {ringSid ? (
                  <span className="numeric ml-3 text-sm font-normal text-ink-2">
                    Call reference {ringSid}
                  </span>
                ) : null}
              </p>
            ) : null}

            {phaseWord ? (
              <div className="mt-6">
                <p className="flex items-center gap-3 text-clay">
                  <span
                    aria-hidden="true"
                    className="text-[1.1em] leading-none"
                  >
                    {phaseWord.glyph}
                  </span>
                  <span className="smallcaps text-micro">{phaseWord.word}</span>
                </p>
                <p className="measure mt-2 text-sm font-semibold text-ink">
                  {live.wording}
                </p>
                {live.retrying && live.attempt ? (
                  <p className="numeric mt-2 text-sm text-ink-2">
                    This is try {live.attempt} of {live.max_attempts}. CareLoop
                    stops after that.
                  </p>
                ) : null}
                {live.call_sid ? (
                  <p className="numeric mt-2 text-sm text-ink-2">
                    Call reference {live.call_sid}
                  </p>
                ) : null}
              </div>
            ) : null}

            {stateUnread ? (
              <p className="measure mt-4 text-sm text-ink-2">
                CareLoop could not check on the call just now, so nothing on
                this page has moved on. The call itself carries on.
              </p>
            ) : null}

            {ringState === CALL_STATUS.UNAVAILABLE ? (
              <p className="measure mt-6 text-sm font-semibold text-severe">
                <span aria-hidden="true" className="mr-3">
                  {DIAMOND}
                </span>
                Your phone was not called. Nothing was dialled and nothing was
                recorded.
                {ringMissing.length
                  ? ' These telephone settings are missing: ' +
                    ringMissing.join(', ') +
                    '.'
                  : ''}{' '}
                Read the check-in in writing instead, or call your clinic
                directly if this is urgent.
              </p>
            ) : null}
          </div>
        </div>

        {children}

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
        ) : null}

        <div role="status" aria-live="polite" className="empty:hidden">
          {speaking || thinking ? (
            <p className="enter-fade mt-7 flex items-center gap-4 text-sm font-semibold text-clay">
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

        {phase === 'ended' ? (
          <div className="mt-9 flex flex-col gap-y-6 sm:flex-row sm:items-center sm:gap-x-12">
            <Link to="/decision" className={BTN_PRIMARY}>
              See what CareLoop decided
            </Link>
            <button type="button" onClick={begin} className={BTN_QUIET}>
              Read it again
            </button>
          </div>
        ) : null}
      </section>

      {writtenRunning ? (
        <CheckIn
          busy={busy || phase !== 'awaiting'}
          error={error}
          scenarios={scenarios}
          onSubmit={reply}
        />
      ) : null}
    </div>
  )
}
