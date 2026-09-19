import { clockLabel } from '../lib/format.js'
import { countWord } from '../lib/day.js'
import { doseMeta } from '../lib/dose.js'
import { CARD } from '../lib/ui.js'

function grouping(plan) {
  const calls = (plan && plan.calls_total) || 0
  const doses = (plan && plan.doses_total) || 0
  if (!calls || calls === doses) {
    return 'Every dose on the record, with the time CareLoop calls about it.'
  }
  return (
    'Doses close together are grouped into one call, so your phone rings ' +
    countWord(calls) +
    ' times rather than ' +
    countWord(doses) +
    '.'
  )
}

export default function CallSchedule({ plan, flash }) {
  const doses = (plan && plan.doses) || []

  return (
    <section
      aria-labelledby="schedule-heading"
      className={CARD + ' px-6 py-7 ' + (flash ? 'trace-flash' : '')}
    >
      <h2 id="schedule-heading" className="display-tight text-lg text-ink">
        Every dose today
      </h2>
      <p className="mt-2 text-sm text-ink-2">
        {grouping(plan)} The day itself, call by call, is on Today. Nothing in
        this prototype runs on a timer, so a call happens only when you start
        the check-in.
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
                <span
                  aria-hidden="true"
                  className={'leading-none ' + meta.tone}
                >
                  {meta.glyph}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-3">
                    <span className="numeric text-sm font-semibold text-ink">
                      {clockLabel(dose.time)}
                    </span>
                    <span className={'smallcaps text-micro ' + meta.tone}>
                      {meta.label}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-ink-2">
                    {dose.medication}
                  </span>
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
