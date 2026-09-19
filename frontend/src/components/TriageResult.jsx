import TierBadge from './TierBadge.jsx'

function Field({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-micro uppercase text-console-muted">
        {label}
      </dt>
      <dd className="mt-1 break-words font-mono text-xs text-console-ink">
        {value}
      </dd>
    </div>
  )
}

export default function TriageResult({ result, latencyMs, booking, onBook, bookingBusy }) {
  if (!result) {
    return (
      <section className="rounded-card border border-dashed border-console-line bg-console-panel/60 p-5">
        <h2 className="font-mono text-2xs font-bold uppercase tracking-[0.18em] text-console-muted">
          Result
        </h2>
        <p className="mt-2.5 max-w-[42ch] text-2xs leading-relaxed text-console-muted">
          The classification, its source, and the response the agent would
          speak will appear here after the first run.
        </p>
      </section>
    )
  }

  const tier = String(result.tier).toLowerCase()
  const emergency = tier === 'emergency'
  const bookable = !emergency && (tier === 'moderate' || tier === 'severe')

  return (
    <section
      aria-live="polite"
      className="enter-rise overflow-hidden rounded-card border border-console-line bg-console-panel"
    >
      <div className="flex items-center justify-between gap-3 border-b border-console-line bg-console-chrome px-5 py-2.5">
        <h2 className="font-mono text-2xs font-bold uppercase tracking-[0.18em] text-console-ink">
          Result
        </h2>
        {typeof latencyMs === 'number' ? (
          <p className="numeric font-mono text-2xs text-console-muted">
            <span className="text-console-ink">{latencyMs}</span> ms round trip
          </p>
        ) : null}
      </div>

      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <TierBadge tier={result.tier} tone="dark" />
          {result.is_crisis ? (
            <span className="rounded-full border border-dark-emergency/45 px-2.5 py-1 text-micro font-semibold uppercase text-dark-emergency">
              Crisis route, 988
            </span>
          ) : null}
          {emergency && !result.is_crisis ? (
            <span className="rounded-full border border-dark-emergency/45 px-2.5 py-1 text-micro font-semibold uppercase text-dark-emergency">
              Emergency route, 911
            </span>
          ) : null}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">
          <Field label="source" value={result.source || 'unknown'} />
          <Field
            label="confidence"
            value={
              typeof result.confidence === 'number'
                ? result.confidence.toFixed(2)
                : 'n/a'
            }
          />
          <Field
            label="rules"
            value={
              result.matched_rules && result.matched_rules.length
                ? result.matched_rules.join(', ')
                : 'none'
            }
          />
          <Field label="normalized" value={result.normalized_text || 'n/a'} />
        </dl>

        {result.reasoning ? (
          <p className="mt-5 max-w-[62ch] text-xs leading-relaxed text-console-ink-2">
            {result.reasoning}
          </p>
        ) : null}

        <blockquote className="mt-5 border-l-2 border-console-accent-deep pl-3.5">
          <p className="font-mono text-micro uppercase text-console-muted">
            agent says
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-console-ink">
            {result.suggested_agent_response}
          </p>
        </blockquote>
      </div>

      {bookable ? (
        <div className="border-t border-console-line bg-console-chrome px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onBook}
              disabled={bookingBusy || Boolean(booking)}
              className="rounded-control border border-console-accent/50 bg-console-accent/10 px-3.5 py-2 text-xs font-semibold text-console-accent transition-[background-color,transform] duration-150 ease-out hover:bg-console-accent/20 active:scale-[0.99] disabled:opacity-50"
            >
              {bookingBusy ? 'Calling clinic...' : 'Book the follow-up'}
            </button>
            {booking ? (
              <p className="numeric font-mono text-xs text-console-accent">
                confirmed {booking.provider_name} ({booking.specialty}){' '}
                {booking.time}
              </p>
            ) : (
              <p className="text-2xs text-console-muted">
                Step 04. CareLoop contacts the clinic and books the visit.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {emergency ? (
        <div className="border-t border-console-line bg-dark-emergency/8 px-5 py-3">
          <p className="font-mono text-xs text-dark-emergency">
            Booking is disabled on the emergency path by design.
          </p>
        </div>
      ) : null}
    </section>
  )
}
