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
      className="enter-land ledge ledge-ink rounded-panel border-2 border-ink bg-sand px-7 py-9 text-ink sm:px-10 sm:py-11"
    >
      <h2 id="next-call-heading" className="smallcaps text-micro text-ink">
        CareLoop will phone you at
      </h2>

      <p className="mt-5 flex flex-wrap items-baseline gap-x-7 gap-y-4">
        <span className="numeric display text-4xl text-ink">
          {clockLabel(dose.time)}
        </span>
        <span className="inline-flex min-h-[48px] items-center gap-3 rounded-control border-2 border-ink bg-surface px-5 py-2 text-sm font-bold text-ink">
          <span aria-hidden="true" className="leading-none">
            {meta.glyph}
          </span>
          {meta.label}
        </span>
      </p>

      <p className="measure mt-7 text-ink">
        It will ask whether you took {dose.medication}
        {dose.dosage ? ' ' + dose.dosage : ''} and how you are feeling. You did
        not set this time and you cannot forget it. CareLoop worked it out from
        the list below.
      </p>
    </section>
  )
}
