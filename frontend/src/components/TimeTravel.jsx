import { clockLabel } from '../lib/format.js'
import { clockAfterShift, nextDoseShiftMs } from '../lib/clock.js'

export default function TimeTravel({ plan, shiftMs, onShift }) {
  if (!plan) return null

  const now = clockAfterShift(plan.as_of, shiftMs)
  const jump = nextDoseShiftMs(plan)
  const shifted = Boolean(shiftMs)

  return (
    <section
      aria-labelledby="clock-heading"
      className="mt-10 border-t border-line pt-7"
    >
      <h3 id="clock-heading" className="smallcaps text-micro text-muted">
        The clock
      </h3>

      <p className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="numeric font-display text-xl font-semibold text-ink">
          {now ? clockLabel(now) : 'unknown'}
        </span>
        <span className="text-sm text-ink-2">
          {shifted ? 'moved forward for the demonstration' : 'the real time'}
        </span>
      </p>

      {shifted ? (
        <button
          type="button"
          onClick={() => onShift(0)}
          className="mt-5 min-h-[52px] w-full rounded-control border-2 border-line-strong bg-surface px-5 py-3 text-sm font-semibold text-ink transition-colors duration-150 hover:border-ink"
        >
          Put the clock back
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onShift(jump)}
          disabled={!jump}
          className="mt-5 min-h-[52px] w-full rounded-control border-2 border-line-ink bg-surface px-5 py-3 text-sm font-semibold text-ink shadow-raised transition-colors duration-150 hover:bg-sunken disabled:border-line-strong disabled:text-muted disabled:shadow-none"
        >
          {jump
            ? 'Move the clock to the next dose'
            : 'Nothing is due later today'}
        </button>
      )}

      <p className="measure mt-4 text-xs text-ink-2">
        Doses come due at fixed hours, so waiting for one is no way to watch a
        demonstration. This moves the clock on these two screens forward to the
        next dose, which is what makes the call due. Times recorded on the call
        itself still come from the real clock.
      </p>
    </section>
  )
}
