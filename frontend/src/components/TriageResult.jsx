import { tierMeta, UNDECIDED } from './TierBadge.jsx'
import { dateTimeLabel } from '../lib/format.js'
import { useCountUp } from '../lib/useCountUp.js'

const OPEN = String.fromCharCode(34)
const CLOSE = String.fromCharCode(34)

function Fact({ label, value }) {
  return (
    <div>
      <dt className="smallcaps text-micro text-ink-2">{label}</dt>
      <dd className="numeric mt-2 text-sm font-semibold text-ink">{value}</dd>
    </div>
  )
}

function bookingSentence(tier, booking) {
  if (booking && booking.confirmed !== false) {
    return (
      'CareLoop ran the booking call with ' +
      booking.provider_name +
      ' and holds an appointment for ' +
      dateTimeLabel(booking.time) +
      '. The clinic side of that call was simulated.'
    )
  }
  if (tier === 'emergency') {
    return 'No appointment was booked. An appointment is too slow for an emergency.'
  }
  if (tier === 'moderate' || tier === 'severe') {
    return 'No appointment was booked on this call. If nobody contacts you, please phone your clinic yourself.'
  }
  return 'No appointment was needed, so none was booked.'
}

export default function TriageResult({ result, latencyMs, booking }) {
  const ms = useCountUp(result ? latencyMs : null, 900, 260)

  if (!result) return null

  const tier = String(result.tier || '').trim().toLowerCase()
  const meta = tierMeta(tier)

  if (!meta) {
    return (
      <section
        aria-labelledby="verdict-heading"
        className="enter-verdict ledge ledge-ink overflow-hidden rounded-panel border border-line bg-surface px-6 py-9 sm:px-10 sm:py-12"
      >
        <p className="smallcaps text-micro text-ink-2">What CareLoop decided</p>
        <h2
          id="verdict-heading"
          className="display mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-2xl text-ink"
        >
          <span aria-hidden="true" className="text-[0.55em] leading-none">
            {UNDECIDED.glyph}
          </span>
          {UNDECIDED.headline}
        </h2>
        <p className="measure mt-6 text-ink-2">{UNDECIDED.meaning}</p>
      </section>
    )
  }

  const emergency = tier === 'emergency'
  const ruleOnly = result.source === 'rule'

  return (
    <section
      aria-labelledby="verdict-heading"
      className="enter-verdict ledge-strong relative overflow-hidden rounded-panel border border-line bg-surface"
    >
      <span
        aria-hidden="true"
        className="enter-rule absolute inset-x-0 top-0 h-2"
        style={{ background: meta.rail }}
      />

      <div className="px-6 py-9 sm:px-10 sm:py-10">
        <p className="smallcaps text-micro text-ink-2">What CareLoop decided</p>

        <h2
          id="verdict-heading"
          className="display mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-3xl"
          style={{ color: meta.rail }}
        >
          <span aria-hidden="true" className="text-[0.5em] leading-none">
            {meta.glyph}
          </span>
          {meta.headline}
        </h2>

        <p className="measure mt-6 text-lg leading-[1.45] text-ink">
          {meta.meaning}
        </p>

        {emergency ? (
          <p
            className="mt-8 flex items-start gap-4 rounded-card border border-emergency bg-emergency-tint px-6 py-5 text-lg font-semibold text-ink"
          >
            <span aria-hidden="true" className="leading-[1.5] text-emergency">
              {String.fromCharCode(9679)}
            </span>
            <span className="measure">
              {result.is_crisis
                ? 'Call or text 988 to reach the Suicide and Crisis Lifeline. CareLoop stays on the line with you.'
                : 'Call 911 or go to an emergency room now. Nobody has been notified for you. This prototype cannot contact a person.'}
            </span>
          </p>
        ) : null}

        <div className="mt-8 rounded-card border border-line bg-sunken px-6 py-6 sm:px-8">
          <p className="smallcaps text-micro text-clay">
            What CareLoop said to you
          </p>
          <p className="display-tight measure mt-4 text-lg text-ink">
            {OPEN}
            {result.suggested_agent_response}
            {CLOSE}
          </p>
        </div>

        <p className="measure mt-8 text-lg font-semibold leading-[1.45] text-ink">
          {bookingSentence(tier, booking)}
        </p>

        {result.reasoning ? (
          <p className="measure mt-5 text-sm text-ink-2">{result.reasoning}</p>
        ) : null}
      </div>

      <div className="border-t border-line bg-sunken px-6 py-7 sm:px-10">
        <dl className="flex flex-wrap gap-x-14 gap-y-6">
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
            value={
              typeof ms !== 'number'
                ? 'not measured'
                : ms < 1000
                  ? 'Less than a second'
                  : (Math.round(ms / 100) / 10).toFixed(1) + ' seconds'
            }
          />
        </dl>

        {ruleOnly ? (
          <p className="measure mt-6 text-sm text-ink-2">
            No model was asked. A fixed rule matched the words you used, which
            is why the answer came back instantly. The model can raise the
            severity of an answer but it is never allowed to lower it.
          </p>
        ) : null}
      </div>
    </section>
  )
}
