import TierBadge, { tierMeta } from './TierBadge.jsx'
import { clockLabel } from '../lib/format.js'

function Shell({ rail, tone, live, children }) {
  return (
    <section
      aria-live={live}
      className={
        'enter-fade relative overflow-hidden rounded-card border shadow-card ' +
        tone
      }
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: rail }}
      />
      <div className="py-5 pl-6 pr-5">{children}</div>
    </section>
  )
}

export default function CallStatusBanner({
  status,
  nextTime,
  transcript,
  tier,
  isCrisis,
}) {
  if (status === 'active') {
    return (
      <Shell rail="#0f766e" tone="border-brand/25 bg-brand-wash" live="polite">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-[7px] size-2 shrink-0 rounded-full bg-brand"
            style={{ animation: 'pulse-ring 1.8s ease-out infinite' }}
          />
          <div className="min-w-0">
            <p className="text-micro font-semibold uppercase text-brand">
              Live now
            </p>
            <p className="mt-1 text-lg font-semibold text-ink">
              Check-in call in progress
            </p>
            <p className="mt-1.5 truncate text-sm text-ink-2">
              {transcript
                ? 'You said: \u201c' + transcript + '\u201d'
                : 'Listening...'}
            </p>
          </div>
        </div>
      </Shell>
    )
  }

  if (status === 'outcome') {
    const meta = tierMeta(tier)
    const emergency = String(tier).toLowerCase() === 'emergency'

    return (
      <Shell
        rail={meta.rail}
        tone={meta.border + ' ' + meta.bg}
        live="assertive"
      >
        <div className="flex flex-wrap items-center gap-3">
          <TierBadge tier={tier} />
          <p className="text-micro font-semibold uppercase text-muted">
            Last check-in outcome
          </p>
        </div>

        <p className="mt-2 text-lg font-semibold text-ink">
          {emergency
            ? isCrisis
              ? 'Crisis support offered'
              : 'Emergency care recommended'
            : 'Symptom recorded on your last check-in'}
        </p>

        {transcript ? (
          <p className="mt-2 border-l-2 border-line-strong pl-3 text-sm text-ink-2">
            {'You said: \u201c' + transcript + '\u201d'}
          </p>
        ) : null}

        {emergency ? (
          <p
            className={
              'mt-4 max-w-[60ch] text-sm font-semibold leading-relaxed ' +
              meta.text
            }
          >
            {isCrisis
              ? 'Call or text 988 to reach the Suicide and Crisis Lifeline. CareLoop has stayed on the line.'
              : 'Call 911 or go to an emergency room now. Your care team has been alerted.'}
          </p>
        ) : null}
      </Shell>
    )
  }

  return (
    <Shell rail="#c9c9c1" tone="border-line bg-surface" live="off">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-micro font-semibold uppercase text-muted">
            Next check-in
          </p>
          <p className="numeric mt-1 text-lg font-semibold text-ink">
            {nextTime ? clockLabel(nextTime) : 'Not scheduled'}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-2xs font-medium text-muted">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-line-strong"
          />
          Waiting
        </span>
      </div>
    </Shell>
  )
}
