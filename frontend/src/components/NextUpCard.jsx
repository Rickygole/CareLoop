import { clockLabel } from '../lib/format.js'
import { doseMeta } from '../lib/dose.js'

export default function NextUpCard({ dose }) {
  if (!dose) {
    return (
      <section
        aria-labelledby="next-call-heading"
        className="mt-10 rounded-panel border-2 border-line-strong bg-surface px-7 py-7 sm:px-9"
      >
        <h2 id="next-call-heading" className="smallcaps text-micro text-muted">
          The next call
        </h2>
        <p className="measure mt-3 text-ink-2">
          Every dose on today's list is behind you, so CareLoop has no reason to
          ring today. The next call is tomorrow morning.
        </p>
      </section>
    )
  }

  const meta = doseMeta(dose.status)

  return (
    <section
      aria-labelledby="next-call-heading"
      className="enter-rise mt-10 rounded-panel border-2 border-brand bg-surface px-7 py-8 shadow-raised sm:px-9"
    >
      <h2 id="next-call-heading" className="smallcaps text-micro text-brand-deep">
        CareLoop will phone you at
      </h2>

      <p className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-3">
        <span className="numeric font-display text-4xl font-semibold text-ink">
          {clockLabel(dose.time)}
        </span>
        <span className="inline-flex items-center gap-2.5 rounded-full border-2 border-brand/45 bg-brand-tint px-4 py-1.5 text-micro font-semibold text-brand-deep">
          <span aria-hidden="true" className="text-[0.8em] leading-none">
            {meta.glyph}
          </span>
          {meta.label}
        </span>
      </p>

      <p className="measure mt-5 text-ink">
        It will ask whether you took {dose.medication}
        {dose.dosage ? ' ' + dose.dosage : ''} and how you are feeling. You did
        not set this time and you cannot forget it. CareLoop worked it out from
        the list below.
      </p>
    </section>
  )
}
