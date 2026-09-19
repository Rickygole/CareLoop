import { clockLabel } from '../lib/format.js'

const STATUS_LABEL = {
  upcoming: 'Coming up',
  due_soon: 'Due soon',
  due_now: 'Due now',
  missed: 'Missed',
  taken: 'Taken',
}

export default function NextUpCard({ dose }) {
  if (!dose) {
    return (
      <section className="rounded-card border-l-4 border-line-strong bg-surface-2 px-6 py-6">
        <p className="text-micro font-semibold uppercase text-muted">
          Your next dose
        </p>
        <p className="measure mt-3 text-ink-2">
          Nothing is due right now, so CareLoop has no reason to call yet.
        </p>
      </section>
    )
  }

  return (
    <section
      aria-label="Your next dose"
      className="enter-rise overflow-hidden rounded-panel border-2 border-brand bg-surface px-6 py-7 shadow-raised sm:px-8"
    >
      <p className="text-micro font-semibold uppercase text-brand-deep">
        Your next dose, and the call that comes with it
      </p>

      <p className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <span className="numeric font-display text-3xl font-semibold text-ink">
          {clockLabel(dose.time)}
        </span>
        <span className="inline-flex items-center gap-2.5 rounded-full border-2 border-brand/45 bg-brand-tint px-4 py-1.5 text-micro font-semibold text-brand-deep">
          <span aria-hidden="true" className="text-[0.8em] leading-none">
            {String.fromCharCode(9679)}
          </span>
          {STATUS_LABEL[dose.status] || dose.status}
        </span>
      </p>

      <p className="measure mt-4 text-ink-2">
        {dose.medication}
        {dose.dosage ? ', ' + dose.dosage : ''}. CareLoop will ring you at this
        time and ask whether you took it.
      </p>
    </section>
  )
}
