import { clockLabel } from '../lib/format.js'
import { clockAfterShift, nextDoseShiftMs } from '../lib/clock.js'
import { BTN_SECONDARY, CARD } from '../lib/ui.js'

export default function TimeTravel({ plan, shiftMs, onShift }) {
  if (!plan) return null

  const now = clockAfterShift(plan.as_of, shiftMs)
  const jump = nextDoseShiftMs(plan)
  const shifted = Boolean(shiftMs)

  return (
    <section
      aria-labelledby="clock-heading"
      className={CARD + ' mt-8 px-6 py-7'}
    >
      <h3 id="clock-heading" className="smallcaps text-micro text-clay">
        The clock
      </h3>

      <p className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="numeric display-tight text-xl text-ink">
          {now ? clockLabel(now) : 'unknown'}
        </span>
        <span className="text-sm text-ink-2">
          {shifted ? 'moved forward' : 'now'}
        </span>
      </p>

      {shifted ? (
        <button
          type="button"
          onClick={() => onShift(0)}
          className={BTN_SECONDARY + ' mt-6 w-full'}
        >
          Put the clock back
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onShift(jump)}
          disabled={!jump}
          className={
            BTN_SECONDARY +
            ' mt-6 w-full disabled:border-line disabled:text-ink-2'
          }
        >
          {jump
            ? 'Move the clock to the next dose'
            : 'Nothing is due later today'}
        </button>
      )}

    </section>
  )
}
