import TierBadge, { tierMeta } from './TierBadge.jsx'
import { clockLabel } from '../lib/format.js'

export default function CallStatusBanner({ status, nextTime, transcript, tier, isCrisis }) {
  if (status === 'active') {
    return (
      <section
        aria-live="polite"
        className="enter-fade rounded-card border border-brand/30 bg-brand-tint p-4"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-1.5 size-2.5 shrink-0 rounded-full bg-brand"
            style={{ animation: 'pulse-ring 1.8s ease-out infinite' }}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-brand-deep">
              Check-in call in progress
            </p>
            <p className="mt-0.5 truncate text-sm text-ink-2">
              {transcript ? 'You said: "' + transcript + '"' : 'Listening...'}
            </p>
          </div>
        </div>
      </section>
    )
  }

  if (status === 'outcome') {
    const meta = tierMeta(tier)
    const emergency = String(tier).toLowerCase() === 'emergency'
    return (
      <section
        aria-live="assertive"
        className={
          'enter-rise rounded-card border p-4 ' + meta.bg + ' ' + meta.border
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <TierBadge tier={tier} />
          <p className="text-sm font-medium text-ink">
            {emergency
              ? isCrisis
                ? 'Crisis support offered'
                : 'Emergency care recommended'
              : 'Symptom recorded on your last check-in'}
          </p>
        </div>

        {transcript ? (
          <p className="mt-2 text-sm text-ink-2">You said: "{transcript}"</p>
        ) : null}

        {emergency ? (
          <p className={'mt-3 text-sm font-medium ' + meta.text}>
            {isCrisis
              ? 'Call or text 988 to reach the Suicide and Crisis Lifeline. CareLoop has stayed on the line.'
              : 'Call 911 or go to an emergency room now. Your care team has been alerted.'}
          </p>
        ) : null}
      </section>
    )
  }

  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-2">
          {nextTime
            ? 'Next check-in call at ' + clockLabel(nextTime)
            : 'No check-in call scheduled'}
        </p>
        <span className="inline-flex items-center gap-2 text-xs text-muted">
          <span aria-hidden="true" className="size-2 rounded-full bg-line-strong" />
          Waiting
        </span>
      </div>
    </section>
  )
}
