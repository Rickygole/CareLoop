import { Link, useLocation } from 'react-router-dom'

import { SCREENS, screenIndex } from '../lib/flow.js'
import { useSession } from '../lib/session.jsx'

const CHECK = String.fromCharCode(10003)
const HERE = String.fromCharCode(9679)
const OPEN = String.fromCharCode(9675)
const LOCKED = String.fromCharCode(8213)

const CHIP =
  'flex min-h-[48px] items-center gap-3 rounded-control px-4 py-2 text-sm font-semibold'

export default function FlowNav() {
  const location = useLocation()
  const { connected } = useSession()
  const index = screenIndex(location.pathname)

  return (
    <nav
      aria-label="The five steps, in order"
      className="border-b border-line bg-surface text-ink"
    >
      <ol className="hold flex flex-wrap items-center gap-x-2 gap-y-2 py-3">
        {SCREENS.map((screen, position) => {
          const current = position === index
          const done = position < index
          const locked = !connected && position > 0 && !current
          const glyph = done ? CHECK : current ? HERE : locked ? LOCKED : OPEN

          const inner = (
            <>
              <span aria-hidden="true" className="text-[1.1em] leading-none">
                {glyph}
              </span>
              <span className="numeric text-micro">{screen.mark}</span>
              <span>{screen.nav}</span>
              {locked ? (
                <span className="smallcaps text-micro">Locked</span>
              ) : null}
            </>
          )

          if (locked) {
            return (
              <li key={screen.path}>
                <span
                  aria-disabled="true"
                  className={CHIP + ' text-ink-2 opacity-80'}
                >
                  {inner}
                  <span className="sr-only">
                    , locked until you connect MyHealth
                  </span>
                </span>
              </li>
            )
          }

          return (
            <li key={screen.path}>
              <Link
                to={screen.path}
                aria-current={current ? 'step' : undefined}
                className={
                  CHIP +
                  ' pressable ' +
                  (current
                    ? 'bg-brand text-brand-ink'
                    : done
                      ? 'border border-line bg-surface text-ink hover:bg-sunken'
                      : 'border border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink')
                }
              >
                {inner}
                {current ? (
                  <span className="sr-only">, the step you are on</span>
                ) : null}
                {done ? <span className="sr-only">, finished</span> : null}
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function FlowPager() {
  const location = useLocation()
  const { connected } = useSession()
  const index = screenIndex(location.pathname)
  const back = index > 0 ? SCREENS[index - 1] : null
  const forward = index < SCREENS.length - 1 ? SCREENS[index + 1] : null

  if (!connected && index === 0) return null

  return (
    <nav aria-label="Move between the five steps" className="mt-16">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-stretch sm:justify-between">
        {back ? (
            <Link
              to={back.path}
              className="pressable ledge flex min-h-[64px] flex-col justify-center rounded-card border border-line bg-surface px-6 py-4 text-ink hover:bg-sunken"
            >
              <span className="smallcaps text-micro text-ink-2">Back to</span>
              <span className="display-tight mt-1 text-lg">
                {back.mark}. {back.title}
              </span>
            </Link>
        ) : (
          <span />
        )}

        {forward ? (
            <Link
              to={forward.path}
              className="pressable ledge flex min-h-[64px] max-w-[30rem] flex-col justify-center rounded-card bg-brand px-6 py-5 text-brand-ink hover:bg-brand-deep"
            >
              <span className="smallcaps text-micro text-brand-ink-2">
                Next
              </span>
              <span className="display-tight mt-1 text-lg">
                {forward.title}
              </span>
              <span className="mt-2 text-sm text-brand-ink-2">
                {forward.blurb}
              </span>
            </Link>
        ) : (
          <span />
        )}
      </div>
    </nav>
  )
}
