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

      <main id="main" className="hold pb-20 pt-10 sm:pt-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-14">
          <div>
            <p className="smallcaps text-micro text-clay">
              Demonstration sign-in
            </p>
            <h1 className="display mt-2 max-w-[18ch] text-3xl text-ink">
              Sign in to CareLoop
            </h1>
            <p className="measure mt-5 text-ink-2">
              This screen is a stand-in for a real sign-in. It checks what you
              type against one demo account that is printed on this page, and
              nothing else. Please do not type a real email address or a real
              password here, on this page or any other page of this
              demonstration.
            </p>

            <form onSubmit={submit} noValidate className="mt-9 max-w-[32rem]">
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

              <div className="mt-6">
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
                The demo account is the only account that works. Nothing you
                type is sent anywhere or saved.
              </p>

              <div role="alert" className="empty:hidden">
                {error ? (
                  <p className="enter-fade mt-6 flex items-start gap-3 rounded-card border border-emergency bg-emergency-tint px-5 py-4 text-base text-ink">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 text-emergency"
                    >
                      {String.fromCharCode(9670)}
                    </span>
                    <span>
                      <strong className="font-semibold">Cannot sign in.</strong>{' '}
                      {error}
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button type="submit" className={BTN_HERO}>
                  Sign in
                </button>
                <button type="button" onClick={fill} className={BTN_SECONDARY}>
                  Fill in the demo account
                </button>
              </div>
            </form>

            <div className="mt-10 border-t border-line pt-8">
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
                  <div className="enter-fade mt-6 max-w-[34rem] rounded-card border border-line bg-sunken px-6 py-6">
                    <h2 className="display text-xl text-ink">
                      There are no new accounts to create
                    </h2>
                    <p className="measure mt-3 text-ink-2">
                      CareLoop is a demonstration. It does not register users,
                      it does not collect names, emails, phone numbers or any
                      other personal detail, and there is no account database
                      behind this screen. So there is no sign-up form here, on
                      purpose.
                    </p>
                    <p className="measure mt-4 text-ink-2">
                      Use the demo account instead. It opens the same product
                      the rest of this demonstration runs on.
                    </p>
                    <button
                      type="button"
                      onClick={fill}
                      className={BTN_SECONDARY + ' mt-6'}
                    >
                      Use the demo account
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <aside aria-labelledby="demo-account-heading" className="lg:pt-14">
            <div className={PANEL + ' px-6 py-7 sm:px-8'}>
              <p className="smallcaps text-micro text-brand">
                Printed on purpose
              </p>
              <h2
                id="demo-account-heading"
                className="display mt-2 text-xl text-ink"
              >
                The demo account
              </h2>
              <p className="measure mt-3 text-sm text-ink-2">
                These are the only credentials this screen accepts. They are
                shown openly because nothing behind them is real.
              </p>

              <dl className="mt-6">
                <dt className="smallcaps text-micro text-ink-2">Email</dt>
                <dd className="mt-1 rounded-control border border-line bg-sunken px-4 py-3 font-mono text-sm text-ink">
                  {DEMO_ACCOUNT.email}
                </dd>
                <dt className="smallcaps mt-5 text-micro text-ink-2">
                  Password
                </dt>
                <dd className="mt-1 rounded-control border border-line bg-sunken px-4 py-3 font-mono text-sm text-ink">
                  {DEMO_ACCOUNT.password}
                </dd>
              </dl>

              <button
                type="button"
                onClick={fill}
                className={BTN_SECONDARY + ' mt-7 w-full'}
              >
                Fill in the demo account
              </button>

              <p className="mt-6 flex items-start gap-3 border-t border-line pt-5 text-sm text-ink-2">
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
