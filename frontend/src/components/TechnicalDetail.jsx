import { useState } from 'react'

import { clockTime, styleFor, summarize } from '../lib/trace.js'
import { TRACE_STATUS } from '../lib/useTrace.js'
import { FOLD_TOGGLE } from '../lib/ui.js'

const SHOW = 60

function transportLabel(status, retries, maxRetries) {
  switch (status) {
    case TRACE_STATUS.LIVE:
      return 'live feed'
    case TRACE_STATUS.POLLING:
      return 'updating automatically'
    case TRACE_STATUS.RECONNECTING:
      return 'reconnecting, attempt ' + retries + ' of ' + maxRetries
    case TRACE_STATUS.OFFLINE:
      return 'not connected'
    default:
      return 'connecting'
  }
}

export default function TechnicalDetail({ events, status, retries, maxRetries }) {
  const [open, setOpen] = useState(false)
  const visible = events.slice(-SHOW)
  const hidden = events.length - visible.length

  return (
    <div className="console-scope ledge-night mt-10 overflow-hidden rounded-panel border border-console-line bg-console-bg text-console-ink">
      <button
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        aria-expanded={open}
        aria-controls="machine-record-panel"
        className={FOLD_TOGGLE}
      >
        <span className="smallcaps text-micro text-console-accent">
          Audit trail
        </span>
        <span className="mt-2 block text-sm font-semibold text-console-ink">
          {open ? 'Hide every recorded event' : 'Show every recorded event'}
        </span>
        <span className="numeric mt-1.5 block text-xs text-console-muted">
          {events.length} entries, {transportLabel(status, retries, maxRetries)}
        </span>
      </button>

      <div
        id="machine-record-panel"
        hidden={!open}
        className="border-t border-console-line px-3 py-5 sm:px-6"
      >
        {hidden > 0 ? (
          <p className="numeric px-4 pb-4 font-mono text-trace text-console-muted">
            {hidden} earlier entries not shown
          </p>
        ) : null}

        {visible.length ? (
          <ol className="font-mono text-trace">
            {visible.map((event) => {
              const style = styleFor(event.event_type)
              return (
                <li
                  key={event.seq}
                  className="flex flex-wrap items-baseline gap-x-4 border-l-4 py-2 pl-4 pr-3"
                  style={{ borderColor: style.color }}
                >
                  <span className="numeric text-console-muted">
                    {clockTime(event.timestamp)}
                  </span>
                  <span
                    className={
                      'min-w-[15rem] ' + (style.bold ? 'font-semibold' : 'font-normal')
                    }
                    style={{ color: style.color }}
                  >
                    {event.event_type}
                  </span>
                  <span className="min-w-0 flex-1 break-words text-console-ink-2">
                    {summarize(event)}
                  </span>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="measure px-4 py-6 font-mono text-trace text-console-muted">
            {status === TRACE_STATUS.OFFLINE
              ? 'The feed is not connected, so nothing can be shown. This is not a statement that nothing has run.'
              : 'Nothing has run yet. Start a check-in and every step is recorded here in order.'}
          </p>
        )}
      </div>
    </div>
  )
}
