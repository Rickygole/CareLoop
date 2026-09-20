import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { TABS, cleanPath } from '../lib/flow.js'

const TAB =
  'pressable flex min-h-[44px] items-center whitespace-nowrap rounded-control px-3 text-sm font-semibold sm:px-4'

export default function FlowNav() {
  const location = useLocation()
  const here = cleanPath(location.pathname)
  const mark = useRef(null)

  useEffect(() => {
    const active = mark.current
    const list = active && active.parentElement
    if (!list || list.scrollWidth <= list.clientWidth) return
    const centred =
      active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2
    list.scrollLeft = Math.max(0, centred)
  }, [here])

  return (
    <nav
      aria-label="Sections"
      className="-mx-1 w-full border-t border-line pt-1 sm:mx-0 sm:w-auto sm:border-0 sm:pt-0"
    >
      <ul className="flex items-center gap-x-1 overflow-x-auto pb-1 sm:gap-x-2 sm:overflow-x-visible sm:pb-0">
        {TABS.map((tab) => {
          const current = tab.path === here

          return (
            <li key={tab.path} ref={current ? mark : null} className="shrink-0">
              <Link
                to={tab.path}
                aria-current={current ? 'page' : undefined}
                className={
                  TAB +
                  (current
                    ? ' bg-sunken text-ink'
                    : ' text-ink-2 hover:bg-sunken hover:text-ink')
                }
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
