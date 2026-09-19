import { narrateByStep } from '../lib/narrate.js'
import { clockTime } from '../lib/trace.js'
import { MARGIN_GRID } from './Section.jsx'

const MARK = {
  said: String.fromCharCode(8213),
  act: String.fromCharCode(9654),
  flag: String.fromCharCode(9651),
  alarm: String.fromCharCode(9679),
  plain: String.fromCharCode(183),
}

const TONE = {
  said: 'text-ink',
  act: 'font-semibold text-brand-deep',
  flag: 'font-semibold text-moderate',
  alarm: 'font-semibold text-emergency',
  plain: 'text-ink-2',
}

export default function RunNarrative({ events, startIndex = 0 }) {
  const steps = narrateByStep(events).filter((step) => step.lines.length)
  if (!steps.length) return null

  let order = startIndex

  return (
    <div className="mt-10">
      {steps.map((step) => {
        const headIndex = order
        return (
          <div key={step.id} className="mt-9 first:mt-0">
            <div className={MARGIN_GRID}>
              <div
                aria-hidden="true"
                className="numeric enter-step font-display pt-1 text-right text-lg font-semibold text-brand"
                style={{ '--i': headIndex }}
              >
                {step.number}
              </div>
              <h4
                className="enter-step smallcaps border-b border-line-strong pb-1.5 text-micro text-muted"
                style={{ '--i': headIndex }}
              >
                {step.title}
              </h4>
            </div>

            <ul>
              {step.lines.map((line) => {
                const index = order
                order += 1
                return (
                  <li
                    key={line.seq}
                    className={'enter-step pt-4 ' + MARGIN_GRID}
                    style={{ '--i': index }}
                  >
                    <time className="numeric pt-1 text-right text-micro text-muted">
                      {clockTime(line.at)}
                    </time>
                    <p className="measure flex items-start gap-3.5 text-sm">
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
