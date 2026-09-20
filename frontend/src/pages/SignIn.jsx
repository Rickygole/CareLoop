import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import Masthead from '../components/Masthead.jsx'
import Notice from '../components/Notice.jsx'
import { BTN_PRIMARY, FIELD, LABEL, LINK, LINK_INLINE, PANEL } from '../lib/ui.js'
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

      <main id="main" className="hold pb-24 pt-14 sm:pt-24">
        <div className="enter-rise mx-auto max-w-[30rem]">
          <h1 className="display text-3xl text-ink">Sign in to CareLoop</h1>
          <p className="measure mt-4 text-lg leading-[1.5] text-ink-2">
            Demonstration sign-in. The only account this demonstration has is
            already filled in below, so there is nothing to type.
          </p>

          <div className={PANEL + ' ledge-strong mt-9 px-6 py-8 sm:px-9'}>
            <form onSubmit={submit} noValidate>
              <div>
                <label htmlFor="signin-email" className={LABEL}>
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

              <div className="mt-5">
                <label htmlFor="signin-password" className={LABEL}>
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

              <p id="signin-note" className="mt-4 text-sm text-ink-2">
                Never type a real password into a demonstration, including this
                one. CareLoop stores no password and has no sign-in server.
              </p>

              <div role="alert" className="empty:hidden">
                {error ? (
                  <Notice
                    tone="alarm"
                    word="Cannot sign in"
                    size="sm"
                    className="enter-fade mt-5"
                  >
                    {error}{' '}
                    <button
                      type="button"
                      onClick={restore}
                      className={LINK_INLINE}
                    >
                      Put the demo account back
                    </button>
                  </Notice>
                ) : null}
              </div>

              <button
                type="submit"
                className={BTN_PRIMARY + ' mt-7 min-h-[56px] w-full'}
              >
                Sign in
              </button>
            </form>
          </div>

          <div className="mt-10 border-t border-line pt-8">
            <h2 className="display text-lg text-ink">
              Have not signed up yet?
            </h2>
            <p className="measure mt-2 text-sm text-ink-2">
              The sign up is where this demonstration starts. It creates no
              account and collects nothing.
            </p>
            <Link to="/signup" className={LINK + ' mt-2 text-sm'}>
              Sign up instead
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
