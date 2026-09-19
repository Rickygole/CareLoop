import { clockLabel, relativeLabel } from '../lib/format.js'

function Pane({ label, children, bordered }) {
  return (
    <div
      className={
        'px-6 py-5 ' + (bordered ? 'border-t border-line sm:border-l sm:border-t-0' : '')
      }
    >
      <p className="text-micro font-semibold uppercase text-muted">{label}</p>
      {children}
    </div>
  )
}

export default function NextUpCard({ dose }) {
  if (!dose) {
    return (
      <section className="border-l-2 border-line-strong bg-surface-2 px-6 py-5">
        <p className="text-micro font-semibold uppercase text-muted">
          Next dose
        </p>
        <p className="mt-2 text-sm text-muted">
          Nothing scheduled, so CareLoop has no reason to call yet.
        </p>
      </section>
    )
  }

  const relative = relativeLabel(dose.time)

  return (
    <section
      aria-label="What happens next"
      className="grid overflow-hidden rounded-card border border-line bg-surface shadow-card sm:grid-cols-2"
    >
      <Pane label="Next dose">
        <p className="mt-2 flex items-baseline gap-2.5">
          <span className="numeric font-display text-2xl font-semibold tracking-[-0.01em] text-ink">
            {clockLabel(dose.time)}
          </span>
          <span className="numeric text-sm text-muted">{relative}</span>
        </p>
        <p className="mt-1.5 text-sm text-ink-2">
          {dose.medication}
          {dose.dosage ? ' · ' + dose.dosage : ''}
        </p>
      </Pane>

      <Pane label="Next check-in call" bordered>
        <p className="mt-2 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full bg-brand"
            style={{ animation: 'pulse-ring 2.6s ease-out infinite' }}
          />
          <span className="numeric font-display text-2xl font-semibold tracking-[-0.01em] text-ink">
            {clockLabel(dose.time)}
          </span>
        </p>
        <p className="mt-1.5 max-w-[34ch] text-sm text-ink-2">
          CareLoop calls when the dose is due and asks whether you took it.
        </p>
      </Pane>
    </section>
  )
}
