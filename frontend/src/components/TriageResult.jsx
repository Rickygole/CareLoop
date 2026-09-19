import { tierMeta } from './TierBadge.jsx'

function titleCase(value) {
  const word = String(value || '').toLowerCase()
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : 'Unknown'
}

export default function TriageResult({ result, latencyMs }) {
  if (!result) {
    return (
      <section
        aria-label="Verdict"
        className="rounded-card border border-dashed border-console-line bg-console-panel/60 p-6"
      >
        <h2 className="font-mono text-2xs font-bold uppercase tracking-[0.18em] text-console-muted">
          Verdict
        </h2>
        <p className="mt-2.5 max-w-[48ch] text-sm leading-relaxed text-console-muted">
          The tier, its source, and the round trip time will appear here
          after the first run.
        </p>
      </section>
    )
  }

  const tier = String(result.tier || '').toLowerCase()
  const meta = tierMeta(tier)
  const emergency = tier === 'emergency'
  const ruleOnly = result.source === 'rule'

  return (
    <section
      aria-live="polite"
      aria-label="Verdict"
      className="enter-rise relative overflow-hidden rounded-card border border-console-line bg-console-panel pl-1"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: meta.darkRail }}
      />

      <div className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1
            className="font-display text-3xl font-semibold tracking-[-0.02em]"
            style={{ color: meta.darkRail }}
          >
            {meta.label}
          </h1>
          {result.is_crisis ? (
            <span className="rounded-full border border-dark-emergency/45 px-2.5 py-1 text-micro font-semibold uppercase text-dark-emergency">
              Crisis route, 988
            </span>
          ) : emergency ? (
            <span className="rounded-full border border-dark-emergency/45 px-2.5 py-1 text-micro font-semibold uppercase text-dark-emergency">
              Emergency route, 911
            </span>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <p className="font-mono text-micro uppercase text-console-muted">
              source
            </p>
            <p className="mt-1 text-sm font-medium text-console-ink">
              {titleCase(result.source) || 'Unknown'}
            </p>
          </div>
          <div>
            <p className="font-mono text-micro uppercase text-console-muted">
              round trip
            </p>
            <p className="numeric mt-1 text-sm font-medium text-console-ink">
              {typeof latencyMs === 'number' ? latencyMs + ' ms' : 'n/a'}
            </p>
          </div>
        </div>

        {ruleOnly ? (
          <p className="mt-5 max-w-[62ch] text-sm leading-relaxed text-console-accent">
            No model was consulted. This tier came from a deterministic rule
            match, which is also why it came back fastest.
          </p>
        ) : null}

        {result.reasoning ? (
          <p className="mt-5 max-w-[62ch] text-sm leading-relaxed text-console-ink-2">
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
    </section>
  )
}
