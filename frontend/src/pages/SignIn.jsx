import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import Masthead from '../components/Masthead.jsx'
import { DashboardFooter } from '../components/Disclaimers.jsx'
import { BTN_HERO, BTN_QUIET, FIELD } from '../lib/ui.js'
import { useSession } from '../lib/session.jsx'
import { DEMO_ACCOUNT, matchesDemoAccount } from '../data/demoAccount.js'

const WRONG =
  'That is not the demo account. The fields arrive filled in with the only account this demonstration has.'

export default function SignInPage() {
  const navigate = useNavigate()
  const { signIn } = useSession()

  const [email, setEmail] = useState(DEMO_ACCOUNT.email)
  const [password, setPassword] = useState(DEMO_ACCOUNT.password)
  const [error, setError] = useState('')
  const [showSignUp, setShowSignUp] = useState(false)

  const restore = useCallback(() => {
    setEmail(DEMO_ACCOUNT.email)
    setPassword(DEMO_ACCOUNT.password)
    setError('')
  }, [])

  const submit = useCallback(
    (event) => {
      event.preventDefault()
      if (!matchesDemoAccount(email, password)) {
        setError(WRONG)
        return
      }
      setError('')
      signIn()
      navigate('/')
    },
    [email, navigate, password, signIn],
  )

  return (
    <div>
      <Masthead />

      <main id="main" className="hold pb-10 pt-8">
        <div className="max-w-[34rem]">
          <h1 className="display text-3xl text-ink">Sign in to CareLoop</h1>
          <p className="measure mt-3 text-ink-2">
            Demonstration sign-in. The only account this demonstration has is
            already filled in below, so there is nothing to type.
          </p>

          <form onSubmit={submit} noValidate className="mt-6 max-w-[30rem]">
            <div>
              <label
                htmlFor="signin-email"
                className="block text-base font-semibold text-ink"
              >
                Email address
              </label>
              <input
                id="signin-email"
                type="email"
                name="demo-email"
                autoComplete="off"
                spellCheck="false"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-describedby="signin-note"
                className={FIELD + ' mt-2'}
              />
            </div>

            <div className="mt-4">
              <label
                htmlFor="signin-password"
                className="block text-base font-semibold text-ink"
              >
                Password
              </label>
              <input
                id="signin-password"
                type="password"
                name="demo-password"
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby="signin-note"
                className={FIELD + ' mt-2'}
              />
            </div>

            <p id="signin-note" className="measure mt-3 text-base text-ink-2">
              Never type a real password into a demonstration, including this
              one. CareLoop stores no password and has no sign-in server.
            </p>

            <div role="alert" className="empty:hidden">
              {error ? (
                <p className="enter-fade mt-4 flex items-start gap-3 rounded-card border border-emergency bg-emergency-tint px-5 py-4 text-base text-ink">
                  <span aria-hidden="true" className="mt-0.5 text-emergency">
                    {String.fromCharCode(9670)}
                  </span>
                  <span>
                    <strong className="font-semibold">Cannot sign in.</strong>{' '}
                    {error}{' '}
                    <button
                      type="button"
                      onClick={restore}
                      className="inline-flex min-h-[44px] items-center align-middle font-semibold underline"
                    >
                      Put the demo account back
                    </button>
                  </span>
                </p>
              ) : null}
            </div>

            <div className="mt-6">
              <button type="submit" className={BTN_HERO}>
                Sign in
              </button>
            </div>
          </form>

          <div className="mt-12 border-t border-line pt-8">
            <button
              type="button"
              onClick={() => setShowSignUp((open) => !open)}
              aria-expanded={showSignUp}
              aria-controls="signup-panel"
              className={BTN_QUIET}
            >
              Sign up
            </button>

            <div id="signup-panel" className="empty:hidden">
              {showSignUp ? (
                <div className="enter-fade measure mt-4">
                  <h2 className="text-base font-semibold text-ink">
                    There are no new accounts to create
                  </h2>
                  <p className="mt-2 text-sm text-ink-2">
                    This is a demonstration with one account, already filled
                    in on this page. No names, emails or phone numbers are
                    collected.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>

      <DashboardFooter />
    </div>
  )
}
