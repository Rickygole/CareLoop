import { LOOP_STEPS } from '../lib/loop.js'
import { clockLabel, dateTimeLabel } from '../lib/format.js'

const STATE_LABEL = {
  pending: 'design',
  running: 'running',
  done: 'done',
  'skipped-by-design': 'skipped by design',
}

const STATE_COLOR = {
  pending: 'text-console-muted',
  running: 'text-console-accent',
  done: 'text-dark-mild',
  'skipped-by-design': 'text-console-muted',
}

function quote(text) {
  const value = String(text || '').trim()
  if (!value) return ''
  return '“' + value + '”'
}

function titleCase(value) {
  const word = String(value || '').toLowerCase()
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : 'Unknown'
}

function stepState(step, run, busy) {
  if (busy) return 'running'
  if (!run) return 'pending'
  if (step.id === 'action') return run.booking ? 'done' : 'skipped-by-design'
  return 'done'
}

function stepLine(step, run) {
  if (!run) return step.detail

  const triage = run.triage
  const plan = run.plan
  const booking = run.booking

  switch (step.id) {
    case 'reminder': {
      const dose = plan && plan.next_dose
      return dose
        ? dose.medication + ', ' + clockLabel(dose.time)
        : 'Check-in call placed'
    }
    case 'checkin':
      return triage && triage.transcript ? quote(triage.transcript) : step.detail
    case 'triage':
      return triage
        ? titleCase(triage.tier) + ' via ' + (triage.source || 'unknown')
        : step.detail
    case 'action':
      if (booking) return booking.provider_name + ', ' + dateTimeLabel(booking.time)
      if (triage && String(triage.tier).toLowerCase() === 'emergency') {
        return 'Escalated, not booked by design'
      }
      return 'No visit needed for this tier'
    case 'memory':
      return booking
        ? 'You are booked with ' + booking.provider_name + ' at ' + dateTimeLabel(booking.time) + '.'
        : 'Outcome saved for the next call.'
    default:
      return step.detail
  }
}

export default function LoopRibbon({ run, busy }) {
  return (
    <section
      aria-label="The loop, this run"
      className="overflow-hidden rounded-card border border-console-line bg-console-panel"
    >
      <div className="grid grid-cols-1 divide-y divide-console-line sm:grid-cols-5 sm:divide-x sm:divide-y-0">
        {LOOP_STEPS.map((step, index) => {
          const state = stepState(step, run, busy)
          return (
            <div
              key={step.id}
              className="enter-rise p-5"
              style={{ '--i': index }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="numeric font-mono text-2xs text-console-muted">
                  {step.number}
                </span>
                <span
                  className={
                    'font-mono text-micro uppercase tracking-[0.14em] ' +
                    STATE_COLOR[state]
                  }
                  style={
                    state === 'running'
                      ? { animation: 'live-pulse 1.8s ease-in-out infinite' }
                      : undefined
                  }
                >
                  {STATE_LABEL[state]}
                </span>
              </div>
              <h3 className="mt-2 text-xl font-semibold text-console-ink">
                {step.title}
              </h3>
              <p
                className={
                  'mt-2 min-h-[2.6em] text-sm leading-relaxed ' +
                  (state === 'skipped-by-design'
                    ? 'italic text-console-muted'
                    : 'text-console-ink-2')
                }
              >
                {stepLine(step, run)}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
