import { clockLabel } from '../lib/format.js'
import { doseMeta } from '../lib/dose.js'
import { CARD } from '../lib/ui.js'

export default function CallSchedule({ plan, flash }) {
  const doses = (plan && plan.doses) || []

  return (
    <section
      aria-labelledby="schedule-heading"
      className={CARD + ' px-6 py-7 ' + (flash ? 'trace-flash' : '')}
    >
      <h2 id="schedule-heading" className="display-tight text-lg text-ink">
        Every call today
      </h2>
      <p className="mt-2 text-sm text-ink-2">
        One call for every dose, worked out by CareLoop.
      </p>

      {doses.length ? (
        <ul className="mt-6 flex flex-col gap-3">
          {doses.map((dose, index) => {
            const meta = doseMeta(dose.status)
            return (
              <li
                key={dose.medication_id + dose.time}
                className="enter-fade flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-card border border-line bg-sunken px-4 py-3"
                style={{ '--i': index }}
              >
                <span aria-hidden="true" className={'leading-none ' + meta.tone}>
                  {meta.glyph}
                </span>
                <span className="numeric text-sm font-bold text-ink">
                  {clockLabel(dose.time)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-2">
                  {dose.medication}
                </span>
                <span className={'smallcaps text-micro ' + meta.tone}>
                  {meta.label}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-ink-2">
          No doses are on today's list yet.
        </p>
      )}
    </section>
  )
}
