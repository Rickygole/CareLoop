import { clockLabel } from '../lib/format.js'
import { doseMeta } from '../lib/dose.js'
import { CARD } from '../lib/ui.js'

export default function NextUpCard({ dose }) {
  if (!dose) {
    return (
      <section
        aria-labelledby="next-call-heading"
        className={CARD + ' px-7 py-8 sm:px-10'}
      >
        <h2 id="next-call-heading" className="smallcaps text-micro text-ink-2">
          The next call
        </h2>
        <p className="measure mt-4 text-ink-2">
          Every dose on today's list is behind you. The next call is tomorrow
          morning.
        </p>
      </section>
    )
  }

  const meta = doseMeta(dose.status)

  return (
    <section
      aria-labelledby="next-call-heading"
      className="enter-land ledge-strong rounded-panel border border-line bg-brand-wash px-7 py-8 text-ink sm:px-10 sm:py-9"
    >
      <h2 id="next-call-heading" className="smallcaps text-micro text-brand">
        Next call
      </h2>

      <p className="mt-5 flex flex-wrap items-baseline gap-x-7 gap-y-4">
        <span className="numeric display text-3xl text-ink">
          {clockLabel(dose.time)}
        </span>
        <span className="inline-flex min-h-[48px] items-center gap-3 rounded-control border border-line bg-surface px-5 py-2 text-sm font-semibold text-ink">
          <span aria-hidden="true" className="leading-none">
            {meta.glyph}
          </span>
          {meta.label}
        </span>
      </p>

      <p className="measure mt-7 text-ink">
        About {dose.medication}
        {dose.dosage ? ' ' + dose.dosage : ''}.
      </p>
    </section>
  )
}
