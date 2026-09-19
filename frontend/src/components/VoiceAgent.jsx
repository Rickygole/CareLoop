import { useCallback, useEffect, useRef, useState } from 'react'

import TriageResult from './TriageResult.jsx'
import { triage as postTriage } from '../lib/api.js'
import {
  AGENT_ID_ENV_VAR,
  getAgentId,
  isConfigured,
  start as startVoiceSession,
  stop as stopVoiceSession,
} from '../lib/voice.js'

const MIC_NOTICE =
  'Do not describe your own health information. This is a demonstration and all records are synthetic.'

const GREETING_PREVIEW =
  'Hi {patient_first_name}, this is CareLoop calling to check in on your ' +
  '{medication}. Quick note, I\\u2019m an automated check-in assistant, not a ' +
  'medical professional, and this is a demonstration. Do you have a couple ' +
  'of minutes?'

const STATUS_META = {
  idle: { text: 'Ready', dot: '#7f8896' },
  connecting: { text: 'Connecting', dot: '#e3a13b', pulse: true },
  connected: { text: 'Live', dot: '#63c9ac', pulse: true },
  ending: { text: 'Ending', dot: '#e3a13b', pulse: true },
  ended: { text: 'Ended', dot: '#7f8896' },
  error: { text: 'Session failed', dot: '#f2635a' },
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
        className="rounded-card border border-dashed border-console-line bg-console-panel/60 p-6"
      >
        <h2 className="font-mono text-2xs font-bold uppercase tracking-[0.18em] text-console-muted">
          Voice agent
        </h2>
        <p className="mt-2.5 max-w-[62ch] text-sm leading-relaxed text-console-ink-2">
          Voice agent not configured. Set{' '}
          <code className="rounded-[4px] border border-console-line-2 bg-console-inset px-1.5 py-0.5 font-mono text-2xs text-console-ink">
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
      className="relative overflow-hidden rounded-card border border-console-line-2 bg-console-panel p-5"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px] bg-console-accent"
      />

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-sm font-semibold text-console-ink">
          CareLoop voice agent
        </h2>
        <span className="inline-flex items-center gap-2 font-mono text-2xs text-console-ink-2">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full"
            style={{
              background: meta.dot,
              animation: meta.pulse ? 'live-pulse 2.4s ease-in-out infinite' : undefined,
            }}
          />
          {meta.text}
          {connected && mode ? ' · ' + mode : ''}
        </span>
      </div>

      <p className="mt-1.5 max-w-[68ch] text-2xs leading-relaxed text-console-muted">
        Agent id{' '}
        <code className="text-console-ink-2">{getAgentId()}</code>. The
        transcript below is captured client side from the conversation and
        posted to POST /triage on each completed patient turn. No ElevenLabs
        post-call webhook is used.
      </p>

      {status === 'idle' ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="rounded-control border border-dark-moderate/25 bg-dark-moderate/8 px-3.5 py-2.5 text-2xs leading-relaxed text-console-ink-2">
            {MIC_NOTICE}
          </p>
          <blockquote className="border-l-2 border-console-accent-deep pl-3.5">
            <p className="font-mono text-micro uppercase text-console-muted">
              opening line
            </p>
            <p className="mt-1.5 text-2xs italic leading-relaxed text-console-ink-2">
              {GREETING_PREVIEW}
            </p>
          </blockquote>
          <button
            type="button"
            onClick={handleStart}
            className="self-start rounded-control bg-console-accent px-5 py-3 text-sm font-bold uppercase tracking-[0.04em] text-console-accent-ink transition-[background-color,transform] duration-150 ease-out hover:bg-console-accent-deep active:scale-[0.99]"
          >
            Start voice check-in
          </button>
        </div>
      ) : null}

      {status === 'connecting' || status === 'ending' ? (
        <p className="mt-4 font-mono text-xs text-console-muted">
          {status === 'connecting' ? 'Opening the mic...' : 'Closing the call...'}
        </p>
      ) : null}

      {connected ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={handleStop}
            disabled={busy}
            className="rounded-control border border-dark-emergency/45 px-4 py-2 text-2xs font-semibold uppercase tracking-[0.04em] text-dark-emergency transition-colors duration-150 hover:bg-dark-emergency/10 disabled:opacity-50"
          >
            End call
          </button>
        </div>
      ) : null}

      {messages.length ? (
        <ol className="mt-4 flex max-h-56 flex-col gap-2 overflow-y-auto rounded-control border border-console-line bg-console-inset p-3">
          {messages.map((item) => (
            <li key={item.id} className="font-mono text-xs leading-relaxed">
              <span className="text-console-muted">
                {item.role === 'user' ? 'patient' : 'agent'}
              </span>{' '}
              <span className="text-console-ink-2">{item.text}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {status === 'error' ? (
        <div className="mt-4 flex flex-col gap-3">
          <p role="alert" className="font-mono text-xs text-dark-emergency">
            [error] {errorMessage || 'The voice session failed.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleStart}
              className="rounded-control border border-console-line-2 px-4 py-2 text-2xs font-semibold uppercase tracking-[0.04em] text-console-ink transition-colors duration-150 hover:border-console-line-2 hover:bg-console-inset"
            >
              Retry voice
            </button>
            <button
              type="button"
              onClick={focusTextFallback}
              className="rounded-control bg-console-accent px-4 py-2 text-2xs font-bold uppercase tracking-[0.04em] text-console-accent-ink transition-colors duration-150 hover:bg-console-accent-deep"
            >
              Switch to text check-in
            </button>
          </div>
        </div>
      ) : null}

      {status === 'ended' ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleStart}
            className="rounded-control border border-console-line-2 px-4 py-2 text-2xs font-semibold uppercase tracking-[0.04em] text-console-ink transition-colors duration-150 hover:bg-console-inset"
          >
            Call again
          </button>
        </div>
      ) : null}

      {triageBusy ? (
        <p className="mt-4 font-mono text-xs text-console-muted">
          Running /triage on the last patient turn...
        </p>
      ) : null}

      {triageError ? (
        <p role="alert" className="mt-4 font-mono text-xs text-dark-emergency">
          [error] {triageError}
        </p>
      ) : null}

      {triageResult ? (
        <div className="mt-4">
          <TriageResult result={triageResult} latencyMs={triageLatency} />
        </div>
      ) : null}
    </section>
  )
}
