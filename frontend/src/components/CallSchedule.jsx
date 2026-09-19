import { clockLabel } from '../lib/format.js'
import { doseMeta } from '../lib/dose.js'

export default function CallSchedule({ plan, flash }) {
  const doses = (plan && plan.doses) || []
  const next = plan && plan.next_dose

  return (
    <section
      aria-labelledby="schedule-heading"
      className={flash ? 'trace-flash' : undefined}
    >
      <h2 id="schedule-heading" className="smallcaps text-micro text-muted">
        When CareLoop will call
      </h2>

      {next ? (
        <div className="mt-4">
          <p className="numeric font-display text-3xl font-semibold text-ink">
            {clockLabel(next.time)}
          </p>
          <p className="measure mt-2 text-sm text-ink-2">
            The next call. CareLoop will ask about {next.medication}
            {next.dosage ? ' ' + next.dosage : ''} and how you are feeling.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-2">
          Every dose on today's list is behind you, so there is no call left to
          make today.
        </p>
      )}

      <h3 className="smallcaps mt-9 text-micro text-muted">All of today</h3>
      {doses.length ? (
        <ul className="mt-3">
          {doses.map((dose, index) => {
            const meta = doseMeta(dose.status)
            return (
              <li
                key={dose.medication_id + dose.time}
                className="enter-fade flex flex-wrap items-baseline gap-x-3 border-b border-line py-3"
                style={{ '--i': index }}
              >
                <span
                  aria-hidden="true"
                  className={'text-micro leading-none ' + meta.tone}
                >
                  {meta.glyph}
                </span>
                <span className="numeric text-sm font-semibold text-ink">
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
        <p className="mt-3 text-sm text-ink-2">
          No doses are on today's list yet.
        </p>
      )}
    </section>
  )
}
