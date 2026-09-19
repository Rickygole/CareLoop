import { useLayoutEffect, useMemo, useRef } from 'react'

import TraceLine from './TraceLine.jsx'
import { LANES, laneFor } from '../lib/loop.js'
import { TRACE_STATUS } from '../lib/useTrace.js'

const DIM_AFTER = 14

function transportLabel(status, retries, maxRetries) {
  switch (status) {
    case TRACE_STATUS.LIVE:
      return { text: 'websocket live', dot: '#63C9AC', pulse: true }
    case TRACE_STATUS.POLLING:
      return { text: 'polling 500ms', dot: '#4FA8C9', pulse: true }
    case TRACE_STATUS.RECONNECTING:
      return {
        text: 'reconnecting ' + retries + '/' + maxRetries,
        dot: '#E3A13B',
      }
    case TRACE_STATUS.OFFLINE:
      return { text: 'backend unreachable', dot: '#F2635A' }
    default:
      return { text: 'connecting', dot: '#7F8896' }
  }
}

function LaneKey({ lane, count, offset }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-2xs text-console-muted">
      <span aria-hidden="true" className="relative block h-3 w-3">
        <span className="absolute inset-y-0 left-[5px] w-px bg-console-line-2" />
        <span
          className="absolute top-[3px] size-[6px] rounded-full"
          style={{ background: lane.color, left: offset }}
        />
      </span>
      {lane.short}
      <span className="numeric text-[#4b5462]">{count}</span>
    </span>
  )
}

export default function TracePanel({ events, status, retries, maxRetries }) {
  const scroller = useRef(null)

  const counts = useMemo(() => {
    let patient = 0
    let clinic = 0
    for (const event of events) {
      if (laneFor(event.event_type).id === LANES.clinic.id) clinic += 1
      else patient += 1
    }
    return { patient, clinic }
  }, [events])

  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [events])

  const transport = transportLabel(status, retries, maxRetries)
  const degraded =
    status === TRACE_STATUS.RECONNECTING || status === TRACE_STATUS.OFFLINE
  const lastIndex = events.length - 1

  return (
    <section
      aria-label="Trace log"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-console-line bg-console-inset shadow-console"
    >
      <header className="border-b border-console-line bg-console-panel">
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <div className="flex items-baseline gap-3">
            <h2 className="font-mono text-2xs font-bold uppercase tracking-[0.18em] text-console-ink">
              Trace
            </h2>
            <span className="numeric font-mono text-2xs text-console-muted">
              {events.length} events
            </span>
          </div>

          <span className="inline-flex items-center gap-2 font-mono text-2xs text-console-ink-2">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full"
              style={{
                background: transport.dot,
                animation: transport.pulse
                  ? 'live-pulse 2.4s ease-in-out infinite'
                  : undefined,
              }}
            />
            {transport.text}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-console-line bg-console-chrome px-4 py-2">
          <LaneKey lane={LANES.patient} count={counts.patient} offset="0px" />
          <LaneKey lane={LANES.clinic} count={counts.clinic} offset="7px" />
          <span className="hidden font-mono text-2xs text-console-muted lg:inline">
            two tracks, two conversations
          </span>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <ol
          ref={scroller}
          className="h-full overflow-y-auto py-2 font-mono text-trace"
        >
          {events.length === 0 ? (
            <li className="flex h-full flex-col justify-end px-5 pb-6">
              <p className="font-mono text-2xs uppercase tracking-[0.16em] text-console-muted">
                Awaiting events
              </p>
              <p className="mt-3 max-w-[56ch] text-xs leading-relaxed text-console-ink-2">
                Every line the pipeline emits lands here in order, on the track
                it belongs to: the patient call on the left, the clinic call on
                the right. Type a symptom above or press Call Now.
              </p>
              <p className="mt-4 flex items-center gap-2 font-mono text-trace text-console-accent">
                <span aria-hidden="true">{'>'}</span>
                <span
                  aria-hidden="true"
                  className="inline-block h-[1.1em] w-[0.6em] bg-console-accent"
                  style={{ animation: 'live-pulse 1.1s steps(1) infinite' }}
                />
              </p>
            </li>
          ) : (
            events.map((event, index) => (
              <TraceLine
                key={event.seq}
                event={event}
                dimmed={index < lastIndex - DIM_AFTER}
                isNew={false}
              />
            ))
          )}

          {degraded ? (
            <li className="mt-1 border-l-2 border-dark-moderate bg-dark-moderate/8 py-1 pl-3 pr-4 font-mono text-trace font-bold text-dark-moderate">
              [connection lost]
              {status === TRACE_STATUS.OFFLINE
                ? ' backend unreachable, still retrying'
                : ' attempt ' + retries + ' of ' + maxRetries}
            </li>
          ) : null}
        </ol>
      </div>
    </section>
  )
}
