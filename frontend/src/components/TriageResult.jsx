import { tierMeta } from './TierBadge.jsx'
import { useCountUp } from '../lib/useCountUp.js'

const OPEN = String.fromCharCode(8220)
const CLOSE = String.fromCharCode(8221)

function Fact({ label, value }) {
  return (
    <div>
      <dt className="text-micro font-semibold uppercase text-muted">{label}</dt>
      <dd className="numeric mt-1.5 text-sm font-semibold text-ink">{value}</dd>
    </div>
  )
}

export default function TriageResult({ result, latencyMs }) {
  const ms = useCountUp(result ? latencyMs : null, 900, 260)

  if (!result) return null

  const tier = String(result.tier || '').toLowerCase()
  const meta = tierMeta(tier)
  const emergency = tier === 'emergency'
  const ruleOnly = result.source === 'rule'

  return (
    <section
      aria-labelledby="verdict-heading"
      className="enter-verdict relative overflow-hidden rounded-panel border-2 border-line-ink bg-surface shadow-lift"
    >
      <span
        aria-hidden="true"
        className="enter-rule absolute inset-x-0 top-0 h-[6px]"
        style={{ background: meta.rail }}
      />

      <div className="px-6 py-8 sm:px-10 sm:py-10">
        <p className="text-micro font-semibold uppercase text-muted">
          What CareLoop decided
        </p>

        <h3
          id="verdict-heading"
          className="font-display mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-2 text-3xl font-semibold"
          style={{ color: meta.rail }}
        >
          <span aria-hidden="true" className="text-[0.55em] leading-none">
            {meta.glyph}
          </span>
          {meta.headline}
        </h3>

        <p className="measure mt-5 text-ink-2">{meta.meaning}</p>

        {emergency ? (
          <p
            className="mt-6 flex items-start gap-3 rounded-card border-2 px-5 py-4 font-semibold text-emergency"
            style={{ borderColor: meta.rail }}
          >
            <span aria-hidden="true" className="leading-[1.6]">
              {String.fromCharCode(9679)}
            </span>
            <span className="measure">
              {result.is_crisis
                ? 'Call or text 988 to reach the Suicide and Crisis Lifeline. CareLoop stays on the line with you.'
                : 'Call 911 or go to an emergency room now. Your care team has been told.'}
            </span>
          </p>
        ) : null}

        <blockquote className="mt-8 border-l-4 border-brand pl-6">
          <p className="text-micro font-semibold uppercase text-muted">
            What CareLoop said to you
          </p>
          <p className="font-display measure mt-3 text-lg text-ink">
            {OPEN}
            {result.suggested_agent_response}
            {CLOSE}
          </p>
        </blockquote>

        {result.reasoning ? (
          <p className="measure mt-7 text-sm text-ink-2">{result.reasoning}</p>
        ) : null}
      </div>

      <div className="border-t border-line bg-surface-2 px-6 py-6 sm:px-10">
        <dl className="flex flex-wrap gap-x-14 gap-y-5">
          <Fact
            label="Severity recorded"
            value={meta.term + ', shown as ' + meta.shape}
          />
          <Fact
            label="Decided by"
            value={
              ruleOnly
                ? 'A fixed safety rule'
                : result.source === 'llm'
                  ? 'The rules, then the model'
                  : 'The rules, model unavailable'
            }
          />
          <Fact
            label="Time taken"
            value={typeof ms === 'number' ? ms + ' ms' : 'not measured'}
          />
        </dl>

        {ruleOnly ? (
          <p className="measure mt-5 text-xs text-brand-deep">
            No model was asked. A fixed rule matched the words you used, which
            is why the answer came back instantly. The model can raise the
            severity of an answer but it is never allowed to lower it.
          </p>
        ) : null}
      </div>
    </section>
  )
}
