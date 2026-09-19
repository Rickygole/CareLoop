import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import DemoBanner from './DemoBanner.jsx'
import FlowNav, { FlowPager } from './FlowNav.jsx'
import Masthead from './Masthead.jsx'
import { DashboardFooter } from './Disclaimers.jsx'
import { SCREENS, screenIndex } from '../lib/flow.js'

export default function Layout() {
  const location = useLocation()
  const main = useRef(null)
  const first = useRef(true)

  useEffect(() => {
    const screen = SCREENS[screenIndex(location.pathname)]
    document.title = 'CareLoop, ' + screen.title

    if (first.current) {
      first.current = false
      return
    }
    if (typeof document !== 'undefined') {
      document.documentElement.scrollTop = 0
    }
    if (main.current) main.current.focus()
  }, [location.pathname])

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-5 focus:top-5 focus:z-50 focus:rounded-control focus:border-2 focus:border-line-ink focus:bg-surface focus:px-5 focus:py-3 focus:text-sm focus:font-semibold"
      >
        Skip to the main content
      </a>

      <Masthead />
      <DemoBanner />
      <FlowNav />

      <main
        id="main"
        ref={main}
        tabIndex={-1}
        className="mx-auto max-w-[72rem] px-6 pb-10 focus:outline-none sm:px-8"
      >
        <Outlet />
        <FlowPager />
      </main>

      <DashboardFooter />
    </div>
  )
}
