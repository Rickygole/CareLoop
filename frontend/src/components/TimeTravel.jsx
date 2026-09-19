import { useCallback, useState } from 'react'

import { clockLabel } from '../lib/format.js'
import {
  applyClockShift,
  clockAfterShift,
  nextDoseShiftMs,
} from '../lib/clock.js'

const NIGHT_BUTTON =
  'pressable inline-flex min-h-[44px] items-center justify-center rounded-control border border-console-muted px-5 text-base font-semibold text-console-ink hover:bg-console-panel disabled:border-console-line-2 disabled:text-console-muted'

function sentence(plan, ms) {
  const moved = applyClockShift(plan, ms)
  const at = clockAfterShift(plan.as_of, ms)
  const dose = moved && moved.next_dose
  const where = ms
    ? 'The clock moved forward to ' +
      (at ? clockLabel(at) : 'a later hour') +
      '. '
    : 'The clock is back to now. '
  const taken = ((moved && moved.doses) || []).filter(
    (item) => item.status === 'taken',
  ).length
  const next = dose
    ? 'The next call is at ' +
      clockLabel(dose.time) +
      ', about ' +
      dose.medication +
      '. '
    : 'No call is left today. '
  return (
    where +
    next +
    (taken === 1 ? '1 dose is behind you.' : taken + ' doses are behind you.')
  )
}

export default function TimeTravel({ plan, shiftMs, onShift }) {
  const [note, setNote] = useState('')

  const move = useCallback(
    (ms) => {
      onShift(ms)
      setNote(plan ? sentence(plan, ms) : '')
    },
    [onShift, plan],
  )

  if (!plan) return null

  const now = clockAfterShift(plan.as_of, shiftMs)
  const jump = nextDoseShiftMs(plan)
  const shifted = Boolean(shiftMs)

  return (
    <section
      aria-label="The demonstration clock"
      className="flex flex-wrap items-center gap-x-6 gap-y-3"
    >
      <p className="flex items-baseline gap-x-3">
        <span className="smallcaps text-micro text-console-muted">Clock</span>
        <span className="numeric text-base font-semibold text-console-ink">
          {now ? clockLabel(now) : 'unknown'}
        </span>
        <span className="text-sm text-console-ink-2">
          {shifted ? 'moved forward' : 'now'}
        </span>
      </p>

      {shifted ? (
        <button type="button" onClick={() => move(0)} className={NIGHT_BUTTON}>
          Put the clock back
        </button>
      ) : (
        <button
          type="button"
          onClick={() => move(jump)}
          disabled={!jump}
          className={NIGHT_BUTTON}
        >
          {jump
            ? 'Move the clock to the next dose'
            : 'Nothing is due later today'}
        </button>
      )}

      <div
        role="status"
        aria-live="polite"
        className="w-full empty:hidden sm:w-auto"
      >
        {note ? (
          <p className="measure text-sm text-console-ink-2">{note}</p>
        ) : null}
      </div>
    </section>
  )
}
