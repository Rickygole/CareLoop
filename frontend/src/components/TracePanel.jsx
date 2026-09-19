import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import TraceLine from './TraceLine.jsx'
import { TRACE_STATUS } from '../lib/useTrace.js'

const DIM_AFTER = 14

function transportLabel(status, retries, maxRetries) {
  switch (status) {
    case TRACE_STATUS.LIVE:
      return { text: 'websocket live', dot: '#4ADE80' }
    case TRACE_STATUS.POLLING:
      return { text: 'polling 500ms', dot: '#38BDF8' }
    case TRACE_STATUS.RECONNECTING:
      return {
        text: 'reconnecting ' + retries + '/' + maxRetries + ', polling',
        dot: '#FBBF24',
      }
    case TRACE_STATUS.OFFLINE:
      return { text: 'backend unreachable', dot: '#FF5A5A' }
    default:
      return { text: 'connecting', dot: '#8B8B8B' }
  }
}

export default function TracePanel({ events, status, retries, maxRetries, onClear }) {
  const scroller = useRef(null)
  const [pinned, setPinned] = useState(true)
  const baseline = useRef(null)

  if (baseline.current === null && events.length) {
    baseline.current = events[events.length - 1].seq
  }

  const onScroll = useCallback(() => {
    const el = scroller.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    setPinned(distance < 48)
  }, [])

  useLayoutEffect(() => {
    const el = scroller.current
    if (el && pinned) el.scrollTop = el.scrollHeight
  }, [events, pinned])

  useEffect(() => {
    if (!events.length) baseline.current = null
  }, [events.length])

  const transport = transportLabel(status, retries, maxRetries)
  const degraded =
    status === TRACE_STATUS.RECONNECTING || status === TRACE_STATUS.OFFLINE
  const lastIndex = events.length - 1

  return (
    <section
      aria-label="Trace log"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-console-line bg-console"
    >
      <header className="flex items-center justify-between gap-4 border-b border-console-line bg-console-2 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-console-ink">Trace</h2>
          <span className="font-mono text-2xs text-console-muted tabular-nums">
            {events.length} events
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-2 font-mono text-2xs text-console-muted">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full"
              style={{ background: transport.dot }}
            />
            {transport.text}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="rounded-[6px] border border-console-line px-2 py-1 font-mono text-2xs text-console-muted transition-colors duration-150 hover:bg-console hover:text-console-ink"
          >
            clear
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <ol
          ref={scroller}
          onScroll={onScroll}
          className="h-full overflow-y-auto py-2 font-mono text-trace leading-6"
        >
          {events.length === 0 ? (
            <li className="px-4 py-10 text-center text-console-muted">
              <p>No events yet.</p>
              <p className="mt-1">
                Type a symptom above, or press Call Now, and the pipeline shows
                up here line by line.
              </p>
            </li>
          ) : (
            events.map((event, index) => (
              <TraceLine
                key={event.seq}
                event={event}
                dimmed={index < lastIndex - DIM_AFTER}
                isNew={baseline.current !== null && event.seq > baseline.current}
              />
            ))
          )}

          {degraded ? (
            <li className="px-4 py-1 font-bold text-[#FBBF24]">
              [connection lost, reconnecting]
              {status === TRACE_STATUS.OFFLINE
                ? ' backend unreachable, still retrying'
                : ' attempt ' + retries + ' of ' + maxRetries}
            </li>
          ) : null}
        </ol>

        {!pinned && events.length ? (
          <button
            type="button"
            onClick={() => {
              setPinned(true)
              const el = scroller.current
              if (el) el.scrollTop = el.scrollHeight
            }}
            className="enter-fade absolute bottom-3 right-4 rounded-full border border-console-line bg-console-2 px-3 py-1.5 font-mono text-2xs text-console-ink shadow-lg transition-colors duration-150 hover:border-console-muted"
          >
            jump to latest
          </button>
        ) : null}
      </div>
    </section>
  )
}
