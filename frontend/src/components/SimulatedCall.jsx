import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import CheckIn from './CheckIn.jsx'
import Notice from './Notice.jsx'
import { callState } from '../lib/api.js'
import { clockLabel, dateTimeLabel } from '../lib/format.js'
import { BTN_HERO, BTN_PRIMARY, BTN_QUIET, PANEL } from '../lib/ui.js'
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

const SAFETY =
  'Please do not describe your own real health. This is a demonstration and every record in it is made up.'

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
  return String(name || '').trim().split(/\s+/)[0] || 'there'
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

function doseLine(first, dose) {
  const named = dose && dose.medication ? dose.medication : 'medication'
  const amount = dose && dose.dosage ? ', ' + dose.dosage : ''
  const why = dose && dose.indication ? ', the one ' + dose.indication : ''
  return (
    first +
    ', this is a reminder to take your ' +
    named +
    amount +
    why +
    '. Please take it now if you have not already. When you have, tell me ' +
    'you took it, and tell me how you have been feeling since.'
  )
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

function closingLine(triage, first) {
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
  return (
    'Thank you, ' +
    first +
    '. I have made a note of that on your record. Please keep taking your ' +
    'medication as your prescriber directed. I will check in with you ' +
    'again. Take care.'
  )
}

function timeLabel(at) {
  return at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function Turn({ turn, index }) {
  const mine = turn.speaker === 'patient'

  return (
    <li
      className={
        'enter-rise ledge ledge-strong rounded-card border px-6 py-5 ' +
        (mine
          ? 'border-line bg-sand sm:ml-10'
          : 'border-line bg-surface sm:mr-10')
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
        <p className="measure mt-4 rounded-card border border-moderate bg-moderate-tint px-4 py-3 text-sm text-ink">
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

function Path({ state, label, heading, body, children }) {
  const active = state === 'active'
  const meta =
    state === 'active'
      ? { glyph: RING, tone: 'text-clay' }
      : { glyph: DASH, tone: 'text-ink-2' }

  return (
    <div
      className={
        'ledge ledge-strong rounded-card border px-6 py-6 ' +
        (active ? 'border-line-strong bg-surface' : 'border-line bg-sunken')
      }
    >
      <p className={'flex items-center gap-3 ' + meta.tone}>
        <span aria-hidden="true" className="text-[1.1em] leading-none">
          {meta.glyph}
        </span>
        <span className="smallcaps text-micro">{label}</span>
      </p>
      <h3 className="display-tight mt-3 text-lg text-ink">{heading}</h3>
      <div className="measure mt-2 text-sm text-ink-2">{body}</div>
      {children}
    </div>
  )
}

export default function SimulatedCall({
  patientName,
  nextDose,
  scenarios,
  busy,
  error,
  onReply,
  onRing,
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

  const say = useCallback((speaker, text, note) => {
    seq.current += 1
    const turn = { id: seq.current, speaker, text, note: note || null, at: new Date() }
    setTurns((list) => list.concat(turn))
  }, [])

  const begin = useCallback(async () => {
    setTurns([])
    setPhase('greeting')
    const first = firstNameOf(patientName)
    say('careloop', greetingLine(first))
    await pause(GAP_LONG)
    if (!alive.current) return
    say('careloop', doseLine(first, nextDose))
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
      say('careloop', closingLine(triage, firstNameOf(patientName)))
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

  const phoneState = phoneWorking ? 'active' : 'waiting'
  const writtenState = writtenRunning ? 'active' : 'waiting'
  const phoneLabel = phoneLive
    ? phoneWorking
      ? 'Running now, the real call'
      : writtenRunning
        ? 'Not the path you are on'
        : 'The real call'
    : 'Not switched on here'
  const writtenLabel = writtenRunning
    ? 'Running now, in writing'
    : phoneWorking
      ? 'Not the path you are on'
      : 'A written stand-in'
  const phaseWord = live ? PHASE_WORD[live.phase] : null

  return (
    <div className="mt-10">
      <section
        aria-labelledby="simulated-call-heading"
        className={PANEL + ' px-6 py-8 sm:px-10 sm:py-10'}
      >
        <h2 id="simulated-call-heading" className="display text-xl text-ink">
          The check-in call, one way or the other
        </h2>
        <p className="measure mt-3 text-ink-2">
          There are two ways to take this check-in and only one of them runs at
          a time. Take the real phone call, or read the same check-in in
          writing. The decision at the end comes from the real CareLoop service
          either way.
        </p>

        <Notice tone="quiet" word="Safety" className="mt-7" size="sm">
          {SAFETY}
        </Notice>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Path
            state={phoneLive ? phoneState : 'waiting'}
            label={phoneLabel}
            heading="Take the real phone call"
            body={
              phoneLive
                ? 'This is the real thing. Press the button and your telephone rings, like any other call. CareLoop dials the number on this record and speaks to you. No app and no screen.'
                : 'Calling out needs telephone settings that are not filled in here, so no phone will ring. Nothing is faked to cover for it.'
            }
          >
            {phoneLive ? (
              <div className="mt-6">
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

                {confirming ? (
                  <div className="enter-fade mt-7 rounded-card border border-line-strong bg-sand px-6 py-6">
                    <h4 className="display-tight text-lg text-ink">
                      This will ring your telephone
                    </h4>
                    <p className="measure mt-3 text-ink">
                      CareLoop is about to dial the phone number on this record.
                      Your telephone will ring in a moment, like any other call.
                      Have it next to you before you press Yes.
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
                        <span aria-hidden="true" className="text-[1.1em] leading-none">
                          {phaseWord.glyph}
                        </span>
                        <span className="smallcaps text-micro">
                          {phaseWord.word}
                        </span>
                      </p>
                      <p className="measure mt-2 text-sm font-semibold text-ink">
                        {live.wording}
                      </p>
                      {live.retrying && live.attempt ? (
                        <p className="numeric mt-2 text-sm text-ink-2">
                          This is try {live.attempt} of {live.max_attempts}.
                          CareLoop stops after that.
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
                      CareLoop could not check on the call just now, so nothing
                      on this page has moved on. The call itself carries on.
                    </p>
                  ) : null}

                  {ringState === CALL_STATUS.UNAVAILABLE ? (
                    <p className="measure mt-6 text-sm font-semibold text-severe">
                      <span aria-hidden="true" className="mr-3">
                        {DIAMOND}
                      </span>
                      Your phone was not called. Nothing was dialled and
                      nothing was recorded.
                      {ringMissing.length
                        ? ' These telephone settings are missing: ' +
                          ringMissing.join(', ') + '.'
                        : ''}{' '}
                      Read the check-in in writing instead, or call your clinic
                      directly if this is urgent.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </Path>

          <Path
            state={writtenState}
            label={writtenLabel}
            heading="Read the same check-in in writing"
            body={
              <>
                <span className="block">
                  A written stand-in for the voice agent, turn by turn. It is
                  not a recording of the real phone call and not a transcript of
                  one. It says what the phone call says, and your answer goes to
                  the same CareLoop service.
                </span>
                <Notice tone="caution" word="Simulated" className="mt-5" size="sm">
                  {SIMULATION_DISCLOSURE}
                </Notice>
              </>
            }
          >
            <div className="mt-6">
              <button
                type="button"
                onClick={begin}
                disabled={phoneWorking || writtenRunning}
                className={phoneLive ? BTN_QUIET : BTN_HERO}
              >
                {writtenRunning
                  ? 'The written check-in is running'
                  : 'Read the check-in in writing'}
              </button>
            </div>
          </Path>
        </div>

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
