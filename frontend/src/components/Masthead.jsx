import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import ApiStatus from './ApiStatus.jsx'
import { useSession } from '../lib/session.jsx'
import { DEMO_ACCOUNT } from '../data/demoAccount.js'

const ACCOUNT_LINK =
  'pressable inline-flex min-h-[44px] items-center whitespace-nowrap rounded-control px-3 text-sm font-semibold text-ink-2 hover:bg-sunken hover:text-ink'

function Mark() {
  return (
    <svg
      viewBox="0 0 44 44"
      aria-hidden="true"
      className="h-9 w-9 shrink-0 sm:h-10 sm:w-10"
    >
      <rect width="44" height="44" rx="13" fill="#0A4D9E" />
      <path
        d="M31 15.5a9.5 9.5 0 1 0 2.2 9.2"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <circle cx="31.4" cy="13.4" r="3.9" fill="#FFFFFF" />
    </svg>
  )
}

export default function Masthead({ nav }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { signedIn, signOut } = useSession()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <header className="sticky top-0 z-30">
      <div className="console-scope bg-console-bg">
        <div className="hold flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-1.5">
          <p className="text-2xs text-console-muted">
            Demo system. All patient data is synthetic.
          </p>
          <ApiStatus tone="dark" />
        </div>
      </div>

      <div className="border-b border-line bg-surface">
        <div className="hold flex flex-wrap items-center gap-x-8 gap-y-0 py-2 sm:flex-nowrap sm:py-2.5">
          <div className="flex min-h-[52px] flex-1 items-center justify-between gap-x-5 sm:flex-none">
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
                className={ACCOUNT_LINK + ' sm:hidden'}
              >
                Account
              </button>
            ) : null}
          </div>

          {nav}

          {signedIn ? (
            <div
              id="masthead-account"
              className={
                (open ? 'flex' : 'hidden') +
                ' w-full flex-col items-start gap-y-1 border-t border-line py-2 sm:ml-auto sm:flex sm:w-auto sm:flex-row sm:items-center sm:gap-x-1 sm:border-0 sm:py-0'
              }
            >
              <p className="px-3 text-sm text-ink-2 sm:hidden">
                <span className="sr-only">Signed in as </span>
                {DEMO_ACCOUNT.email}
              </p>
              <Link to="/connect" className={ACCOUNT_LINK}>
                Insurance and records
              </Link>
              <button
                type="button"
                onClick={() => {
                  signOut()
                  navigate('/signup')
                }}
                className={ACCOUNT_LINK}
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
