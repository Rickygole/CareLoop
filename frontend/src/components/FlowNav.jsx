import { Link, useLocation } from 'react-router-dom'

import { TABS, cleanPath } from '../lib/flow.js'

const TAB =
  'flex min-h-[48px] items-center rounded-control px-5 py-2 text-base font-semibold'

export default function FlowNav() {
  const location = useLocation()
  const here = cleanPath(location.pathname)

  return (
    <nav aria-label="Sections" className="border-b border-line bg-surface">
      <ul className="hold flex flex-wrap items-center gap-x-5 gap-y-3 py-3">
        {TABS.map((tab) => {
          const current = tab.path === here

          return (
            <li key={tab.path}>
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
