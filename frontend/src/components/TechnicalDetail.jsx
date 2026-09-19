import { clockTime, styleFor, summarize } from '../lib/trace.js'
import { TRACE_STATUS } from '../lib/useTrace.js'

const SHOW = 60

function transportLabel(status, retries, maxRetries) {
  switch (status) {
    case TRACE_STATUS.LIVE:
      return 'live feed'
    case TRACE_STATUS.POLLING:
      return 'checking every half second'
    case TRACE_STATUS.RECONNECTING:
      return 'reconnecting, attempt ' + retries + ' of ' + maxRetries
    case TRACE_STATUS.OFFLINE:
      return 'not connected'
    default:
      return 'connecting'
  }
}

export default function TechnicalDetail({ events, status, retries, maxRetries }) {
  const visible = events.slice(-SHOW)
  const hidden = events.length - visible.length

  return (
    <details className="console-scope ledge ledge-night mt-10 overflow-hidden rounded-panel border border-console-line bg-console-bg text-console-ink">
      <summary className="cursor-pointer list-none px-6 py-6 marker:content-none sm:px-9">
        <span className="smallcaps text-micro text-console-accent">
          For the engineers
        </span>
        <span className="mt-2 block text-sm font-bold text-console-ink">
          Show the raw machine record of every call
        </span>
        <span className="numeric mt-1.5 block text-xs text-console-muted">
          {events.length} entries, {transportLabel(status, retries, maxRetries)}
        </span>
      </summary>

      <div className="border-t border-console-line px-3 py-5 sm:px-6">
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
                      'min-w-[15rem] ' + (style.bold ? 'font-bold' : 'font-normal')
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
            Nothing has run yet. Start a check-in and every step the system
            takes will be recorded here in order.
          </p>
        )}
      </div>
    </details>
  )
}
