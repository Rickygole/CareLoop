import { useEffect, useRef } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import FlowNav, { FlowPager } from './FlowNav.jsx'
import Masthead from './Masthead.jsx'
import { DashboardFooter } from './Disclaimers.jsx'
import { SCREENS, screenIndex } from '../lib/flow.js'
import { useSession } from '../lib/session.jsx'

export default function Layout() {
  const location = useLocation()
  const { signedIn } = useSession()
  const main = useRef(null)
  const first = useRef(true)

  useEffect(() => {
    const screen = SCREENS[screenIndex(location.pathname)]
    document.title =
      'CareLoop, step ' +
      (SCREENS.indexOf(screen) + 1) +
      ' of ' +
      SCREENS.length +
      ', ' +
      screen.title

    if (first.current) {
      first.current = false
      return
    }
    if (typeof document !== 'undefined') {
      document.documentElement.scrollTop = 0
    }
    if (main.current) main.current.focus()
  }, [location.pathname])

  if (!signedIn) return <Navigate to="/signin" replace />

  return (
    <div>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-5 focus:top-5 focus:z-50 focus:rounded-control focus:bg-ink focus:px-6 focus:py-3 focus:text-sm focus:font-semibold focus:text-surface"
      >
        Skip to the main content
      </a>

      <Masthead />
      <FlowNav />

      <main id="main" ref={main} tabIndex={-1} className="focus:outline-none">
        <Outlet />
        <div className="hold pb-24">
          <FlowPager />
        </div>
      </main>

      <DashboardFooter />
    </div>
  )
}
