import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import ApiStatus from './ApiStatus.jsx'
import { BTN_QUIET } from '../lib/ui.js'
import { useSession } from '../lib/session.jsx'
import { DEMO_ACCOUNT } from '../data/demoAccount.js'

function Mark() {
  return (
    <svg
      viewBox="0 0 44 44"
      aria-hidden="true"
      className="h-8 w-8 shrink-0 sm:h-10 sm:w-10"
    >
      <rect width="44" height="44" rx="10" fill="#0F4C81" />
      <path
        d="M30.5 16.5a10 10 0 1 0 2 9.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="30.5" cy="14" r="4" fill="#FFFFFF" />
    </svg>
  )
}

export default function Masthead() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signedIn, signOut } = useSession()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  const shown = open || !signedIn

  return (
    <header className="border-b border-line bg-surface">
      <div className="hold flex flex-wrap items-center gap-x-8 gap-y-4 py-3 sm:gap-y-3 sm:py-4">
        <div className="flex w-full items-center justify-between gap-x-5 sm:w-auto">
          <span className="flex items-center gap-3">
            <Mark />
            <span className="display text-xl text-ink">CareLoop</span>
          </span>
          {signedIn ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls="masthead-account"
              onClick={() => setOpen((was) => !was)}
              className={BTN_QUIET + ' sm:hidden'}
            >
              Account
            </button>
          ) : null}
        </div>

        <div
          id="masthead-account"
          className={
            (shown ? 'flex' : 'hidden') +
            ' w-full flex-col items-start gap-y-4 sm:contents'
          }
        >
          <p className="text-sm text-ink-2 sm:border-l sm:border-line sm:pl-5">
            Demo system. All patient data is synthetic.
          </p>
          <ApiStatus />
          {signedIn ? (
            <div className="flex w-full flex-col items-start gap-y-4 sm:contents">
              <p className="text-sm text-ink-2">
                <span className="smallcaps text-micro text-ink-2">
                  Signed in
                </span>
                <span className="ml-3 font-semibold text-ink">
                  {DEMO_ACCOUNT.email}
                </span>
              </p>
              <Link to="/connect" className={BTN_QUIET + ' w-full sm:w-auto'}>
                Insurance and records
              </Link>
              <button
                type="button"
                onClick={() => {
                  signOut()
                  navigate('/signup')
                }}
                className={BTN_QUIET + ' w-full sm:w-auto'}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
