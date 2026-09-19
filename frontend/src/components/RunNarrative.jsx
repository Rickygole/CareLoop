import { narrateByStep } from '../lib/narrate.js'
import { clockShort } from '../lib/trace.js'

const MARK = {
  said: String.fromCharCode(8213),
  act: String.fromCharCode(9654),
  flag: String.fromCharCode(9651),
  alarm: String.fromCharCode(9679),
  plain: String.fromCharCode(183),
}

const TONE = {
  said: 'text-ink',
  act: 'font-bold text-brand',
  flag: 'font-bold text-moderate',
  alarm: 'font-bold text-emergency',
  plain: 'text-ink-2',
}

export default function RunNarrative({ events, startIndex = 0 }) {
  const steps = narrateByStep(events).filter((step) => step.lines.length)
  if (!steps.length) return null

  let order = startIndex

  return (
    <div className="mt-10 flex flex-col gap-8">
      {steps.map((step) => {
        const headIndex = order
        return (
          <div
            key={step.id}
            className="enter-step ledge ledge-strong rounded-card border border-line bg-surface px-6 py-6 sm:px-8"
            style={{ '--i': headIndex }}
          >
            <h4 className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="numeric display-tight text-lg text-clay">
                {step.number}
              </span>
              <span className="smallcaps text-micro text-ink-2">
                {step.title}
              </span>
            </h4>

            <ul className="mt-5 flex flex-col gap-4">
              {step.lines.map((line) => {
                const index = order
                order += 1
                return (
                  <li
                    key={line.seq}
                    className="enter-step flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-5"
                    style={{ '--i': index }}
                  >
                    <time className="numeric shrink-0 text-2xs text-ink-2 sm:w-20">
                      {clockShort(line.at)}
                    </time>
                    <p className="measure flex items-start gap-4 text-sm">
                      <span
                        aria-hidden="true"
                        className={
                          'shrink-0 leading-[1.6] ' + (TONE[line.tone] || TONE.plain)
                        }
                      >
                        {MARK[line.tone] || MARK.plain}
                      </span>
                      <span className={TONE[line.tone] || TONE.plain}>
                        {line.text}
                      </span>
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
