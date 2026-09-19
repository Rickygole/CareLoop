import { useCallback, useState } from 'react'

import { clockLabel } from '../lib/format.js'
import { applyClockShift, clockAfterShift, nextDoseShiftMs } from '../lib/clock.js'
import { BTN_SECONDARY, CARD } from '../lib/ui.js'

function sentence(plan, ms) {
  const moved = applyClockShift(plan, ms)
  const at = clockAfterShift(plan.as_of, ms)
  const dose = moved && moved.next_dose
  const where = ms
    ? 'The clock moved forward to ' + (at ? clockLabel(at) : 'a later hour') + '. '
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
    (taken === 1
      ? '1 dose is behind you.'
      : taken + ' doses are behind you.')
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
          onClick={() => move(0)}
          className={BTN_SECONDARY + ' mt-6 w-full'}
        >
          Put the clock back
        </button>
      ) : (
        <button
          type="button"
          onClick={() => move(jump)}
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

      <div role="status" aria-live="polite" className="mt-5 empty:hidden">
        {note ? <p className="measure text-sm text-ink-2">{note}</p> : null}
      </div>
    </section>
  )
}
