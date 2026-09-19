import { loopProgress } from '../lib/loop.js'

export default function LoopStatus({ events }) {
  const steps = loopProgress(events)

  return (
    <section
      aria-label="Pipeline loop"
      className="rounded-card border border-console-line bg-console-panel p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-2xs font-bold uppercase tracking-[0.18em] text-console-ink">
          The loop
        </h2>
        <span className="font-mono text-2xs text-console-muted">
          lights up live
        </span>
      </div>

      <ol className="relative mt-4">
        <span
          aria-hidden="true"
          className="absolute bottom-3 left-[4px] top-3 w-px bg-console-line"
        />
        {steps.map((step) => (
          <li
            key={step.id}
            className="relative flex gap-3 py-1.5 pl-5"
            aria-current={step.active ? 'step' : undefined}
          >
            <span
              aria-hidden="true"
              className={
                'absolute left-0 top-[11px] size-[9px] rounded-full border ' +
                (step.active
                  ? 'border-console-accent bg-console-accent'
                  : step.reached
                    ? 'border-console-accent-deep bg-console-accent-deep'
                    : 'border-console-line-2 bg-console-inset')
              }
              style={
                step.active
                  ? { animation: 'live-pulse 1.8s ease-in-out infinite' }
                  : undefined
              }
            />
            <span className="numeric shrink-0 font-mono text-2xs text-console-muted">
              {step.number}
            </span>
            <span className="min-w-0">
              <span
                className={
                  'block text-xs font-semibold ' +
                  (step.reached ? 'text-console-ink' : 'text-console-muted')
                }
              >
                {step.title}
                {step.active ? (
                  <span className="ml-2 font-mono text-micro font-normal uppercase text-console-accent">
                    running
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-2xs leading-relaxed text-console-muted">
                {step.detail}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
