import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import Masthead from '../components/Masthead.jsx'
import Notice from '../components/Notice.jsx'
import { DashboardFooter } from '../components/Disclaimers.jsx'
import { BTN_HERO, FIELD, LINK, LINK_INLINE } from '../lib/ui.js'
import { useSession } from '../lib/session.jsx'
import { DEMO_ACCOUNT, matchesDemoAccount } from '../data/demoAccount.js'

const WRONG =
  'That is not the demo account. The fields arrive filled in with the only account this demonstration has.'

export default function SignInPage() {
  const navigate = useNavigate()
  const { signIn, connected } = useSession()

  const [email, setEmail] = useState(DEMO_ACCOUNT.email)
  const [password, setPassword] = useState(DEMO_ACCOUNT.password)
  const [error, setError] = useState('')

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
      navigate(connected ? '/' : '/connect')
    },
    [connected, email, navigate, password, signIn],
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
                <Notice
                  tone="alarm"
                  word="Cannot sign in"
                  className="enter-fade mt-4"
                >
                  {error}{' '}
                  <button type="button" onClick={restore} className={LINK_INLINE}>
                    Put the demo account back
                  </button>
                </Notice>
              ) : null}
            </div>

            <div className="mt-6">
              <button type="submit" className={BTN_HERO}>
                Sign in
              </button>
            </div>
          </form>

          <div className="mt-12 border-t border-line pt-8">
            <h2 className="text-base font-semibold text-ink">
              Have not signed up yet?
            </h2>
            <p className="measure mt-2 text-ink-2">
              The sign up is where this demonstration starts. It creates no
              account and collects nothing.
            </p>
            <Link
              to="/signup"
              className={LINK + ' mt-3'}
            >
              Sign up instead
            </Link>
          </div>
        </div>
      </main>

      <DashboardFooter />
    </div>
  )
}
