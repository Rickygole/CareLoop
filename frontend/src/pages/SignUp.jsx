import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import Masthead from '../components/Masthead.jsx'
import Notice from '../components/Notice.jsx'
import { DashboardFooter } from '../components/Disclaimers.jsx'
import { BTN_HERO, FIELD, LINK, LINK_INLINE } from '../lib/ui.js'
import { useSession } from '../lib/session.jsx'
import { DEMO_ACCOUNT, matchesDemoSignUp } from '../data/demoAccount.js'

const CHANGED =
  'Nothing you type is sent anywhere, and nothing is stored, so there is no account to make out of it. This demonstration has one set of details and they arrive filled in.'

export default function SignUpPage() {
  const navigate = useNavigate()
  const { signIn } = useSession()

  const [fullName, setFullName] = useState(DEMO_ACCOUNT.fullName)
  const [email, setEmail] = useState(DEMO_ACCOUNT.email)
  const [password, setPassword] = useState(DEMO_ACCOUNT.password)
  const [error, setError] = useState('')

  const restore = useCallback(() => {
    setFullName(DEMO_ACCOUNT.fullName)
    setEmail(DEMO_ACCOUNT.email)
    setPassword(DEMO_ACCOUNT.password)
    setError('')
  }, [])

  const restoreAndGo = useCallback(() => {
    restore()
    signIn()
    navigate('/connect')
  }, [navigate, restore, signIn])

  const submit = useCallback(
    (event) => {
      event.preventDefault()
      if (!matchesDemoSignUp(fullName, email, password)) {
        setError(CHANGED)
        return
      }
      setError('')
      signIn()
      navigate('/connect')
    },
    [email, fullName, navigate, password, signIn],
  )

  return (
    <div>
      <Masthead />

      <main id="main" className="hold pb-10 pt-8">
        <div className="max-w-[34rem]">
          <h1 className="display text-3xl text-ink">
            Sign up for the CareLoop demonstration
          </h1>
          <p className="measure mt-3 text-ink-2">
            Three steps. You sign up, you pick your insurance, and CareLoop
            reads the health records that insurer holds for you. The details
            below are already filled in, so there is nothing to type.
          </p>

          <Notice tone="caution" word="This is a demonstration" className="mt-7">
            <p>
              No account is created here. CareLoop has no sign-up server, keeps
              no record of anything typed on this page, and will never ask you
              for a date of birth, an address, a member number or a social
              security number.
            </p>
          </Notice>

          <form onSubmit={submit} noValidate className="mt-8 max-w-[30rem]">
            <div>
              <label
                htmlFor="signup-name"
                className="block text-base font-semibold text-ink"
              >
                Full name
              </label>
              <input
                id="signup-name"
                type="text"
                name="demo-name"
                autoComplete="off"
                spellCheck="false"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                aria-describedby="signup-note"
                className={FIELD + ' mt-2'}
              />
            </div>

            <div className="mt-4">
              <label
                htmlFor="signup-email"
                className="block text-base font-semibold text-ink"
              >
                Email address
              </label>
              <input
                id="signup-email"
                type="email"
                name="demo-email"
                autoComplete="off"
                spellCheck="false"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-describedby="signup-note"
                className={FIELD + ' mt-2'}
              />
            </div>

            <div className="mt-4">
              <label
                htmlFor="signup-password"
                className="block text-base font-semibold text-ink"
              >
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                name="demo-password"
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby="signup-note"
                className={FIELD + ' mt-2'}
              />
            </div>

            <p id="signup-note" className="measure mt-3 text-base text-ink-2">
              Never type a real password into a demonstration, including this
              one. CareLoop stores no password and has no sign-in server.
            </p>

            <div role="alert" className="empty:hidden">
              {error ? (
                <Notice
                  tone="alarm"
                  word="Those are not the demonstration details"
                  className="enter-fade mt-4"
                >
                  {error}{' '}
                  <button
                    type="button"
                    onClick={restoreAndGo}
                    className={LINK_INLINE}
                  >
                    Put the demonstration details back and carry on
                  </button>
                </Notice>
              ) : null}
            </div>

            <div className="mt-6">
              <button type="submit" className={BTN_HERO}>
                Sign up and choose my insurance
              </button>
            </div>
          </form>

          <div className="mt-12 border-t border-line pt-8">
            <p className="measure text-ink-2">
              Already have the demonstration account?
            </p>
            <Link to="/signin" className={LINK + ' mt-3'}>
              Sign in instead
            </Link>
          </div>
        </div>
      </main>

      <DashboardFooter />
    </div>
  )
}
