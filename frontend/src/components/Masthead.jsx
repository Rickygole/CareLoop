import { Link, useNavigate } from 'react-router-dom'

import ApiStatus from './ApiStatus.jsx'
import { BTN_QUIET } from '../lib/ui.js'
import { useSession } from '../lib/session.jsx'
import { DEMO_ACCOUNT } from '../data/demoAccount.js'

function Mark() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 44 44"
      aria-hidden="true"
      className="shrink-0"
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
  const { signedIn, signOut } = useSession()

  return (
    <header className="border-b border-line bg-surface">
      <div className="hold flex flex-wrap items-center justify-between gap-x-10 gap-y-4 py-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="flex items-center gap-3">
            <Mark />
            <span className="display text-xl text-ink">CareLoop</span>
          </span>
          <p className="text-sm text-ink-2">
            Demo system. All patient data is synthetic.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <ApiStatus />
          {signedIn ? (
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <p className="text-sm text-ink-2">
                <span className="smallcaps text-micro text-ink-2">
                  Signed in
                </span>
                <span className="ml-3 font-semibold text-ink">
                  {DEMO_ACCOUNT.email}
                </span>
              </p>
              <Link to="/connect" className={BTN_QUIET}>
                MyHealth connection
              </Link>
              <button
                type="button"
                onClick={() => {
                  signOut()
                  navigate('/signin')
                }}
                className={BTN_QUIET}
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
