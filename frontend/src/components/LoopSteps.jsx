import { LOOP_STEPS } from '../lib/loop.js'
import { ROW_GRID } from './Section.jsx'

export default function LoopSteps() {
  return (
    <ol className="mt-10">
      {LOOP_STEPS.map((step, index) => (
        <li
          key={step.id}
          className={'enter-step border-t border-line py-7 ' + ROW_GRID}
          style={{ '--i': index }}
        >
          <span
            aria-hidden="true"
            className="font-display numeric mb-2 block text-left text-2xl font-semibold leading-none text-brand sm:mb-0 sm:text-right sm:text-3xl"
          >
            {step.number}
          </span>

          <div className="min-w-0">
            <h3 className="font-display text-xl font-semibold text-ink">
              {step.title}
            </h3>
            <p className="measure mt-2.5 text-ink">{step.patientDetail}</p>
            <p className="measure mt-2 text-sm text-muted">{step.detail}</p>
          </div>
        </li>
      ))}

      <li className={'border-t-2 border-line-ink pt-7 ' + ROW_GRID}>
        <span
          aria-hidden="true"
          className="mb-2 block text-left text-2xl leading-none text-brand sm:mb-0 sm:text-right"
        >
          {String.fromCharCode(8629)}
        </span>
        <p className="font-display measure text-lg font-semibold text-brand-deep">
          Step five feeds step one. That is the loop, and it is why the next
          call already knows what happened on this one.
        </p>
      </li>
    </ol>
  )
}
