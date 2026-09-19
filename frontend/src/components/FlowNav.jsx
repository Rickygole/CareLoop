import { Link, useLocation } from 'react-router-dom'

import { SCREENS, screenIndex } from '../lib/flow.js'
import { useSession } from '../lib/session.jsx'

const CHECK = String.fromCharCode(10003)
const HERE = String.fromCharCode(9679)
const OPEN = String.fromCharCode(9675)
const LOCKED = String.fromCharCode(8213)
const CHEVRON = String.fromCharCode(8250)

export default function FlowNav() {
  const location = useLocation()
  const { connected } = useSession()
  const index = screenIndex(location.pathname)

  return (
    <nav
      aria-label="The five steps, in order"
      className="border-b-2 border-line-ink bg-surface"
    >
      <ol className="mx-auto flex max-w-[72rem] flex-wrap items-center px-6 sm:px-8">
        {SCREENS.map((screen, position) => {
          const current = position === index
          const done = position < index
          const locked = !connected && position > 0 && !current
          const glyph = done ? CHECK : current ? HERE : locked ? LOCKED : OPEN

          const inner = (
            <>
              <span
                aria-hidden="true"
                className={
                  'text-micro leading-none ' +
                  (done ? 'text-mild' : current ? 'text-brand' : 'text-muted')
                }
              >
                {glyph}
              </span>
              <span className="numeric text-micro text-muted">
                {screen.mark}
              </span>
              <span className="text-sm">{screen.nav}</span>
            </>
          )

          return (
            <li key={screen.path} className="flex items-center">
              {locked ? (
                <span
                  aria-disabled="true"
                  className="flex min-h-[56px] items-center gap-2.5 border-b-[3px] border-transparent px-3 py-3 text-muted"
                >
                  {inner}
                  <span className="sr-only">
                    , locked until you connect MyHealth
                  </span>
                </span>
              ) : (
                <Link
                  to={screen.path}
                  aria-current={current ? 'step' : undefined}
                  className={
                    'flex min-h-[56px] items-center gap-2.5 border-b-[3px] px-3 py-3 first:pl-0 transition-colors duration-150 ' +
                    (current
                      ? 'border-brand font-semibold text-ink'
                      : 'border-transparent text-ink-2 hover:text-ink')
                  }
                >
                  {inner}
                  {current ? (
                    <span className="sr-only">, the step you are on</span>
                  ) : null}
                </Link>
              )}

              {position < SCREENS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="px-1 text-micro text-muted"
                >
                  {CHEVRON}
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>

      {!connected ? (
        <p className="mx-auto max-w-[72rem] px-6 pb-3 text-sm text-muted sm:px-8">
          Steps 2 to 5 are shut until you connect MyHealth on this screen.
        </p>
      ) : null}
    </nav>
  )
}

export function FlowPager() {
  const location = useLocation()
  const { connected } = useSession()
  const index = screenIndex(location.pathname)
  const back = index > 0 ? SCREENS[index - 1] : null
  const forward = index < SCREENS.length - 1 ? SCREENS[index + 1] : null
  const held = Boolean(forward) && !connected && index === 0

  return (
    <nav
      aria-label="Move between the five steps"
      className="mt-20 border-t-2 border-line-ink pt-7"
    >
      <p className="numeric smallcaps text-micro text-muted">
        Step {index + 1} of {SCREENS.length}
      </p>

      {held ? (
        <p className="measure mt-4 text-ink-2">
          The next four steps open as soon as you press Connect MyHealth above.
          There is nothing to see in them until CareLoop has your medicines.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-stretch sm:justify-between">
          {back ? (
            <Link
              to={back.path}
              className="flex min-h-[56px] flex-col justify-center rounded-control border-2 border-line-strong bg-surface px-6 py-3 text-ink transition-colors duration-150 hover:border-ink"
            >
              <span className="smallcaps text-micro text-muted">Back to</span>
              <span className="font-display text-lg font-semibold">
                {back.mark}. {back.title}
              </span>
            </Link>
          ) : (
            <span />
          )}

          {forward ? (
            <Link
              to={forward.path}
              className="flex min-h-[56px] max-w-[26rem] flex-col justify-center rounded-control border-2 border-line-ink bg-surface px-6 py-4 text-ink shadow-raised transition-colors duration-150 hover:bg-sunken"
            >
              <span className="smallcaps text-micro text-brand-deep">
                Next, step {index + 2}
              </span>
              <span className="font-display text-lg font-semibold">
                {forward.title}
              </span>
              <span className="mt-1 text-sm text-ink-2">{forward.blurb}</span>
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </nav>
  )
}
