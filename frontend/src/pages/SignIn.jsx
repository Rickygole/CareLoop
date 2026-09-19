import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import Masthead from '../components/Masthead.jsx'
import { DashboardFooter } from '../components/Disclaimers.jsx'
import { BTN_HERO, BTN_QUIET, BTN_SECONDARY, FIELD, PANEL } from '../lib/ui.js'
import { useSession } from '../lib/session.jsx'
import { DEMO_ACCOUNT, matchesDemoAccount } from '../data/demoAccount.js'

const WRONG =
  'That is not the demo account. Use the email and password printed on this page.'

export default function SignInPage() {
  const navigate = useNavigate()
  const { signIn } = useSession()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showSignUp, setShowSignUp] = useState(false)
  const emailField = useRef(null)

  const fill = useCallback(() => {
    setEmail(DEMO_ACCOUNT.email)
    setPassword(DEMO_ACCOUNT.password)
    setError('')
    if (emailField.current) emailField.current.focus()
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
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-12">
          <div>
            <h1 className="display text-3xl text-ink">Sign in to CareLoop</h1>
            <p className="measure mt-3 text-ink-2">
              Demonstration sign-in. Please do not type a real email address or
              a real password here.
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
                  ref={emailField}
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

              <p id="signin-note" className="mt-3 text-sm text-ink-2">
                Nothing you type is sent anywhere or saved.
              </p>

              <div role="alert" className="empty:hidden">
                {error ? (
                  <p className="enter-fade mt-4 flex items-start gap-3 rounded-card border border-emergency bg-emergency-tint px-5 py-4 text-base text-ink">
                    <span aria-hidden="true" className="mt-0.5 text-emergency">
                      {String.fromCharCode(9670)}
                    </span>
                    <span>
                      <strong className="font-semibold">Cannot sign in.</strong>{' '}
                      {error}
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button type="submit" className={BTN_HERO}>
                  Sign in
                </button>
                <button type="button" onClick={fill} className={BTN_SECONDARY}>
                  Fill in the demo account
                </button>
              </div>
            </form>

            <div className="mt-6 border-t border-line pt-5">
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
                      This is a demonstration with one account, printed on this
                      page. No names, emails or phone numbers are collected.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <aside aria-labelledby="demo-account-heading" className="lg:pt-2">
            <div className={PANEL + ' px-6 py-6'}>
              <h2
                id="demo-account-heading"
                className="display-tight text-lg text-ink"
              >
                The demo account
              </h2>

              <dl className="mt-4">
                <dt className="smallcaps text-micro text-ink-2">Email</dt>
                <dd className="mt-1 rounded-control border border-line bg-sunken px-4 py-3 font-mono text-sm text-ink">
                  {DEMO_ACCOUNT.email}
                </dd>
                <dt className="smallcaps mt-4 text-micro text-ink-2">
                  Password
                </dt>
                <dd className="mt-1 rounded-control border border-line bg-sunken px-4 py-3 font-mono text-sm text-ink">
                  {DEMO_ACCOUNT.password}
                </dd>
              </dl>

              <button
                type="button"
                onClick={fill}
                className={BTN_SECONDARY + ' mt-5 w-full'}
              >
                Fill in the demo account
              </button>

              <p className="mt-5 flex items-start gap-3 border-t border-line pt-4 text-sm text-ink-2">
                <span aria-hidden="true" className="mt-0.5 text-brand">
                  {String.fromCharCode(9679)}
                </span>
                <span>
                  Never type a real password into a demonstration, including
                  this one. CareLoop stores no password and has no sign-in
                  server.
                </span>
              </p>
            </div>
          </aside>
        </div>
      </main>

      <DashboardFooter />
    </div>
  )
}
