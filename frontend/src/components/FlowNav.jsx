import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { TABS, cleanPath } from '../lib/flow.js'

const TAB =
  'flex min-h-[48px] items-center whitespace-nowrap rounded-control px-4 py-2 text-base font-semibold sm:px-5'

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
    <nav aria-label="Sections" className="border-b border-line bg-surface">
      <ul className="hold flex items-center gap-x-2 overflow-x-auto py-2 sm:gap-x-5 sm:overflow-x-visible sm:py-3">
        {TABS.map((tab) => {
          const current = tab.path === here

          return (
            <li key={tab.path} ref={current ? mark : null} className="shrink-0">
              <Link
                to={tab.path}
                aria-current={current ? 'page' : undefined}
                className={
                  TAB +
                  ' pressable ' +
                  (current
                    ? 'bg-brand text-brand-ink'
                    : 'text-ink-2 hover:bg-sunken hover:text-ink')
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
