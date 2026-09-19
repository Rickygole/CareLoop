import { Link, useLocation } from 'react-router-dom'

import { SCREENS, screenIndex } from '../lib/flow.js'

export default function FlowNav() {
  const location = useLocation()
  const index = screenIndex(location.pathname)

  return (
    <nav
      aria-label="The five screens, in order"
      className="border-b-2 border-line-ink bg-surface"
    >
      <ol className="mx-auto flex max-w-[72rem] flex-wrap px-6 sm:px-8">
        {SCREENS.map((screen, position) => {
          const current = position === index
          return (
            <li key={screen.path}>
              <Link
                to={screen.path}
                aria-current={current ? 'step' : undefined}
                className={
                  'flex min-h-[56px] items-center gap-3 border-b-[3px] px-3 py-3 first:pl-0 ' +
                  (current
                    ? 'border-brand font-semibold text-ink'
                    : 'border-transparent text-ink-2')
                }
              >
                <span aria-hidden="true" className="numeric text-micro text-muted">
                  {screen.mark}
                </span>
                <span className="text-sm">{screen.nav}</span>
                {current ? (
                  <span className="sr-only">, the screen you are on</span>
                ) : null}
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
  const index = screenIndex(location.pathname)
  const back = index > 0 ? SCREENS[index - 1] : null
  const forward = index < SCREENS.length - 1 ? SCREENS[index + 1] : null

  return (
    <nav
      aria-label="Move between the five screens"
      className="mt-20 border-t-2 border-line-ink pt-6"
    >
      <p className="numeric text-micro font-semibold uppercase tracking-[0.13em] text-muted">
        Screen {index + 1} of {SCREENS.length}
      </p>

      <div className="mt-4 flex flex-wrap items-stretch justify-between gap-6">
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
            className="flex min-h-[56px] flex-col justify-center rounded-control border-2 border-line-ink bg-surface px-6 py-3 text-ink shadow-raised transition-colors duration-150 hover:bg-sunken sm:text-right"
          >
            <span className="smallcaps text-micro text-brand-deep">Next</span>
            <span className="font-display text-lg font-semibold">
              {forward.mark}. {forward.title}
            </span>
          </Link>
        ) : (
          <span />
        )}
      </div>
    </nav>
  )
}
