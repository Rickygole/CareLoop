import { clockLabel } from '../lib/format.js'

const STATUS_LABEL = {
  upcoming: 'Upcoming',
  due_soon: 'Due soon',
  due_now: 'Due now',
}

export default function NextUpCard({ dose }) {
  if (!dose) {
    return (
      <section className="border-l-2 border-line-strong bg-surface-2 px-6 py-5">
        <p className="text-micro font-semibold uppercase text-muted">
          Next dose
        </p>
        <p className="mt-2 text-sm text-muted">
          Nothing due right now, so CareLoop has no reason to call yet.
        </p>
      </section>
    )
  }

  return (
    <section
      aria-label="What happens next"
      className="overflow-hidden rounded-card border border-line bg-surface px-6 py-5 shadow-card"
    >
      <p className="text-micro font-semibold uppercase text-muted">
        Next dose and check-in call
      </p>
      <p className="mt-2 flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full bg-brand"
          style={{ animation: 'pulse-ring 2.6s ease-out infinite' }}
        />
        <span className="numeric font-display text-2xl font-semibold tracking-[-0.01em] text-ink">
          {clockLabel(dose.time)}
        </span>
        <span className="numeric text-sm text-muted">
          {STATUS_LABEL[dose.status] || dose.status}
        </span>
      </p>
      <p className="mt-1.5 text-sm text-ink-2">
        {dose.medication}
        {dose.dosage ? ' ' + String.fromCharCode(183) + ' ' + dose.dosage : ''}.
        CareLoop calls at this time to ask whether it was taken.
      </p>
    </section>
  )
}
