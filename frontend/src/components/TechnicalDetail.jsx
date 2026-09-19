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
    <details className="console-scope mt-10 overflow-hidden rounded-panel border-2 border-console-inset bg-console-bg text-console-ink">
      <summary className="cursor-pointer list-none px-6 py-5 text-sm font-semibold text-console-ink marker:content-none sm:px-8">
        <span className="smallcaps text-micro text-console-accent">
          For the engineers
        </span>
        <span className="mt-1.5 block">
          Show the raw machine record of every call
        </span>
        <span className="numeric mt-1 block text-xs font-normal text-console-muted">
          {events.length} entries, {transportLabel(status, retries, maxRetries)}
        </span>
      </summary>

      <div className="border-t border-console-line px-2 py-4 sm:px-4">
        {hidden > 0 ? (
          <p className="numeric px-4 pb-3 font-mono text-trace text-console-muted">
            {hidden} earlier entries not shown
          </p>
        ) : null}

        {visible.length ? (
          <ol className="tape-edge pl-5 font-mono text-trace">
            {visible.map((event) => {
              const style = styleFor(event.event_type)
              return (
                <li
                  key={event.seq}
                  className="flex flex-wrap items-baseline gap-x-4 border-l-2 py-1.5 pl-4 pr-3"
                  style={{ borderColor: style.color }}
                >
                  <span className="numeric text-console-muted">
                    {clockTime(event.timestamp)}
                  </span>
                  <span
                    className={
                      'min-w-[14rem] ' + (style.bold ? 'font-bold' : 'font-medium')
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
          <p className="px-6 py-6 font-mono text-trace text-console-muted">
            Nothing has run yet. Start a check-in and every step the system
            takes will be recorded here in order.
          </p>
        )}
      </div>
    </details>
  )
}
