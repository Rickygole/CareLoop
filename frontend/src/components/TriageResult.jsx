import TierBadge from './TierBadge.jsx'

function Field({ label, value }) {
  return (
    <div>
      <dt className="font-mono text-2xs uppercase tracking-wide text-console-muted">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-xs text-console-ink">{value}</dd>
    </div>
  )
}

export default function TriageResult({ result, latencyMs, booking, onBook, bookingBusy }) {
  if (!result) return null

  const emergency = String(result.tier).toLowerCase() === 'emergency'
  const bookable =
    !emergency &&
    (String(result.tier).toLowerCase() === 'moderate' ||
      String(result.tier).toLowerCase() === 'severe')

  return (
    <section
      aria-live="polite"
      className="enter-rise rounded-card border border-console-line bg-console-2 p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <TierBadge tier={result.tier} />
        {result.is_crisis ? (
          <span className="rounded-full border border-[#FF5A5A]/50 px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide text-[#FF8A8A]">
            Crisis route, 988
          </span>
        ) : null}
        {emergency && !result.is_crisis ? (
          <span className="rounded-full border border-[#FF5A5A]/50 px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide text-[#FF8A8A]">
            Emergency route, 911
          </span>
        ) : null}
        {typeof latencyMs === 'number' ? (
          <span className="ml-auto font-mono text-2xs text-console-muted tabular-nums">
            {latencyMs} ms
          </span>
        ) : null}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
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
        <p className="mt-4 max-w-[70ch] text-sm text-console-ink/80">
          {result.reasoning}
        </p>
      ) : null}

      <blockquote className="mt-4 border-l-2 border-console-line pl-3 text-sm text-console-ink">
        <span className="mr-2 font-mono text-2xs uppercase tracking-wide text-console-muted">
          agent says
        </span>
        {result.suggested_agent_response}
      </blockquote>

      {bookable ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBook}
            disabled={bookingBusy || Boolean(booking)}
            className="rounded-[10px] border border-console-line bg-console px-3 py-2 text-sm font-medium text-console-ink transition-[background-color,transform] duration-150 ease-out hover:border-console-muted active:scale-[0.98] disabled:opacity-60"
          >
            {bookingBusy ? 'Booking...' : 'Book follow-up'}
          </button>
          {booking ? (
            <p className="font-mono text-xs text-[#2DD4BF]">
              confirmed {booking.provider_name} ({booking.specialty}){' '}
              {booking.time}
            </p>
          ) : null}
        </div>
      ) : null}

      {emergency ? (
        <p className="mt-4 font-mono text-xs text-[#FF8A8A]">
          Booking is disabled on the emergency path by design.
        </p>
      ) : null}
    </section>
  )
}
