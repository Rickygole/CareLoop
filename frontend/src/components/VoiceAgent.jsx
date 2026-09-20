import { useCallback, useEffect, useRef, useState } from 'react'

import Notice from './Notice.jsx'
import TriageResult from './TriageResult.jsx'
import { SafetyNote } from './Disclaimers.jsx'
import { triage as postTriage } from '../lib/api.js'
import { BTN_PRIMARY, BTN_SECONDARY, CARD_ACCENT } from '../lib/ui.js'
import {
  AGENT_ID_ENV_VAR,
  isConfigured,
  start as startVoiceSession,
  stop as stopVoiceSession,
} from '../lib/voice.js'

const GREETING_PREVIEW =
  'Hi {patient_first_name}, this is CareLoop calling to check in on your ' +
  '{medication}. Quick note, I\\u2019m an automated check-in assistant, not a ' +
  'medical professional, and this is a demonstration. Do you have a couple ' +
  'of minutes?'

const STATUS_META = {
  idle: { text: 'Ready', dot: 'var(--color-ink-2)' },
  connecting: {
    text: 'Connecting',
    dot: 'var(--color-moderate)',
    pulse: true,
  },
  connected: { text: 'Live', dot: 'var(--color-mild)', pulse: true },
  ending: { text: 'Ending', dot: 'var(--color-moderate)', pulse: true },
  ended: { text: 'Ended', dot: 'var(--color-ink-2)' },
  error: { text: 'Session failed', dot: 'var(--color-emergency)' },
}

function firstName(name) {
  const value = String(name || '').trim()
  if (!value) return ''
  return value.split(/\s+/)[0]
}

function focusTextFallback() {
  const field = document.getElementById('free-text')
  if (!field) return
  field.scrollIntoView({ behavior: 'smooth', block: 'center' })
  field.focus()
}

export default function VoiceAgent({ patientId, patientName }) {
  const [status, setStatus] = useState('idle')
  const [mode, setMode] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [messages, setMessages] = useState([])
  const [triageBusy, setTriageBusy] = useState(false)
  const [triageError, setTriageError] = useState(null)
  const [triageResult, setTriageResult] = useState(null)
  const [triageLatency, setTriageLatency] = useState(null)

  const conversationRef = useRef(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (conversationRef.current) {
        stopVoiceSession(conversationRef.current)
        conversationRef.current = null
      }
    }
  }, [])

  const runTriageForUtterance = useCallback(
    async (text) => {
      if (!text || !text.trim()) return
      setTriageBusy(true)
      setTriageError(null)
      const started = performance.now()
      try {
        const result = await postTriage(text, patientId)
        if (!aliveRef.current) return
        setTriageResult(result)
        setTriageLatency(Math.round(performance.now() - started))
      } catch (err) {
        if (!aliveRef.current) return
        setTriageError(err.message)
      } finally {
        if (aliveRef.current) setTriageBusy(false)
      }
    },
    [patientId],
  )

  const handleMessage = useCallback(
    (payload) => {
      if (!aliveRef.current) return
      const role = payload.role || (payload.source === 'user' ? 'user' : 'agent')
      setMessages((prev) => prev.concat([{ id: prev.length, role, text: payload.message }]))
      if (role === 'user') runTriageForUtterance(payload.message)
    },
    [runTriageForUtterance],
  )

  const handleStart = useCallback(async () => {
    setErrorMessage(null)
    setMessages([])
    setTriageResult(null)
    setTriageError(null)
    setStatus('connecting')

    try {
      const conversation = await startVoiceSession({
        patientId,
        patientFirstName: firstName(patientName),
        onStatusChange: (nextStatus) => {
          if (!aliveRef.current) return
          if (nextStatus === 'connected') setStatus('connected')
          else if (nextStatus === 'connecting') setStatus('connecting')
          else if (nextStatus === 'disconnecting') setStatus('ending')
          else if (nextStatus === 'disconnected') {
            setStatus((current) => (current === 'error' ? current : 'ended'))
          }
        },
        onModeChange: (nextMode) => {
          if (aliveRef.current) setMode(nextMode)
        },
        onMessage: handleMessage,
        onError: (message) => {
          if (!aliveRef.current) return
          setErrorMessage(message)
          setStatus('error')
        },
      })
      if (!aliveRef.current) {
        stopVoiceSession(conversation)
        return
      }
      conversationRef.current = conversation
    } catch (err) {
      if (!aliveRef.current) return
      setErrorMessage(err.message)
      setStatus('error')
    }
  }, [patientId, patientName, handleMessage])

  const handleStop = useCallback(async () => {
    setStatus('ending')
    const conversation = conversationRef.current
    conversationRef.current = null
    await stopVoiceSession(conversation)
    if (aliveRef.current) setStatus('ended')
  }, [])

  if (!isConfigured()) {
    return (
      <section
        aria-label="Voice agent"
        className="rounded-card border border-dashed border-line bg-sunken p-6"
      >
        <h2 className="font-mono text-2xs font-semibold uppercase tracking-[0.18em] text-ink-2">
          Voice agent
        </h2>
        <p className="mt-2.5 max-w-[62ch] text-sm leading-relaxed text-ink-2">
          Voice agent not configured. Set{' '}
          <code className="rounded-[4px] border border-line-strong bg-sunken px-1.5 py-0.5 font-mono text-2xs text-ink">
            {AGENT_ID_ENV_VAR}
          </code>{' '}
          to the ElevenLabs Agent ID to enable the live check-in call. See
          docs/AGENT_CONFIG.md for how to create the agent and find its ID.
        </p>
      </section>
    )
  }

  const meta = STATUS_META[status] || STATUS_META.idle
  const connected = status === 'connected'
  const busy = status === 'connecting' || status === 'ending'

  return (
    <section
      aria-label="Voice agent"
      className={CARD_ACCENT + ' px-6 py-6 sm:px-7'}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <h3 className="display-tight text-lg text-ink">
          CareLoop voice agent
        </h3>
        <span className="smallcaps inline-flex items-center gap-3 text-micro text-ink-2">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{
              background: meta.dot,
              animation: meta.pulse
                ? 'live-pulse 2.4s ease-in-out infinite'
                : undefined,
            }}
          />
          {meta.text}
          {connected && mode ? ', ' + mode : ''}
        </span>
      </div>

      <p className="measure mt-3 text-sm text-ink-2">
        You answer out loud. Each time you finish speaking, what you said is
        sent for triage and the answer appears below.
      </p>

      {status === 'idle' ? (
        <div className="mt-6">
          <SafetyNote />
          <blockquote className="mt-6 border-l-4 border-l-brand pl-5">
            <p className="smallcaps text-micro text-clay">Opening line</p>
            <p className="measure mt-2 text-sm text-ink">{GREETING_PREVIEW}</p>
          </blockquote>
          <button
            type="button"
            onClick={handleStart}
            className={BTN_PRIMARY + ' mt-6'}
          >
            Start voice check-in
          </button>
        </div>
      ) : null}

      <div role="status" aria-live="polite" className="empty:hidden">
        {status === 'connecting' || status === 'ending' ? (
          <p className="mt-6 text-sm font-semibold text-ink">
            {status === 'connecting'
              ? 'Opening your microphone...'
              : 'Closing the call...'}
          </p>
        ) : null}
      </div>

      {connected ? (
        <div className="mt-6">
          <button
            type="button"
            onClick={handleStop}
            disabled={busy}
            className={BTN_SECONDARY}
          >
            End call
          </button>
        </div>
      ) : null}

      {messages.length ? (
        <ol className="mt-6 flex max-h-72 flex-col gap-4 overflow-y-auto rounded-card border border-line bg-sunken px-5 py-4">
          {messages.map((item) => (
            <li key={item.id}>
              <p className="smallcaps text-micro text-clay">
                {item.role === 'user' ? 'You' : 'CareLoop'}
              </p>
              <p className="measure mt-1 text-sm text-ink">{item.text}</p>
            </li>
          ))}
        </ol>
      ) : null}

      {status === 'error' ? (
        <div className="mt-6">
          <Notice role="alert" tone="alarm" word="The call did not connect" size="sm">
            {errorMessage || 'The voice session failed.'}
          </Notice>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-4">
            <button type="button" onClick={handleStart} className={BTN_SECONDARY}>
              Try the call again
            </button>
            <button
              type="button"
              onClick={focusTextFallback}
              className={BTN_PRIMARY}
            >
              Answer in writing instead
            </button>
          </div>
        </div>
      ) : null}

      {status === 'ended' ? (
        <div className="mt-6">
          <button type="button" onClick={handleStart} className={BTN_SECONDARY}>
            Call again
          </button>
        </div>
      ) : null}

      <div role="status" aria-live="polite" className="empty:hidden">
        {triageBusy ? (
          <p className="mt-6 text-sm font-semibold text-ink">
            CareLoop is working out what to do about that.
          </p>
        ) : null}
      </div>

      {triageError ? (
        <Notice
          role="alert"
          tone="alarm"
          word="Not recorded"
          className="mt-6"
          size="sm"
        >
          {triageError}
        </Notice>
      ) : null}

      {triageResult ? (
        <div className="mt-8">
          <TriageResult result={triageResult} latencyMs={triageLatency} />
        </div>
      ) : null}
    </section>
  )
}
