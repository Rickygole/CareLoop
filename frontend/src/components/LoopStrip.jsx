import { LOOP_STEPS } from '../lib/loop.js'

export default function LoopStrip({ activeId, compact }) {
  return (
    <section aria-label="How CareLoop works">
      <ol
        className={
          'grid gap-x-5 border-t-2 border-ink/12 sm:grid-cols-5 ' +
          (compact ? 'gap-y-4' : 'gap-y-6')
        }
      >
        {LOOP_STEPS.map((step, index) => {
          const active = step.id === activeId
          return (
            <li
              key={step.id}
              className={
                'enter-rise relative pt-4 ' + (compact ? 'pr-2' : 'pr-3')
              }
              style={{ '--i': index }}
              aria-current={active ? 'step' : undefined}
            >
              <span
                aria-hidden="true"
                className={
                  'absolute left-0 top-0 h-[9px] w-[2px] ' +
                  (active ? 'bg-brand' : 'bg-ink/25')
                }
              />
              <p
                className={
                  'numeric text-micro font-semibold ' +
                  (active ? 'text-brand' : 'text-muted')
                }
              >
                {step.number}
              </p>
              <h3
                className={
                  'font-display mt-1 text-base font-semibold tracking-[-0.006em] ' +
                  (active ? 'text-brand-deep' : 'text-ink')
                }
              >
                {step.title}
              </h3>
              {compact ? null : (
                <p className="mt-1.5 max-w-[30ch] text-2xs leading-relaxed text-muted">
                  {step.patientDetail}
                </p>
              )}
            </li>
          )
        })}
      </ol>

      <p className="mt-4 flex items-center gap-2 text-micro font-semibold uppercase text-muted">
        <span aria-hidden="true" className="font-mono normal-case">
          {'↵'}
        </span>
        Step 05 feeds step 01. That is the loop.
      </p>
    </section>
  )
}
