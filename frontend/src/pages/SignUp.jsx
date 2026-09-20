import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import Masthead from '../components/Masthead.jsx'
import Notice from '../components/Notice.jsx'
import { BTN_PRIMARY, FIELD, LABEL, LINK, LINK_INLINE, PANEL } from '../lib/ui.js'
import { useSession } from '../lib/session.jsx'
import { DEMO_ACCOUNT, matchesDemoSignUp } from '../data/demoAccount.js'

const STEPS = [
  {
    title: 'Sign up',
    detail: 'No account is made, and nothing you type leaves this page.',
  },
  {
    title: 'Pick your insurance',
    detail: 'Every insurer, plan, patient and medicine here is fictional.',
  },
  {
    title: 'CareLoop reads the records',
    detail:
      'It takes the medicine list from those records and works out when to call. You never type a medicine in.',
  },
]

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

      <main id="main" className="hold pb-24 pt-12 sm:pt-20">
        <div className="grid items-start gap-x-20 gap-y-14 lg:grid-cols-[minmax(0,1fr)_29rem]">
          <div className="enter-rise">
            <p className="smallcaps text-micro text-brand">
              Medication adherence, by telephone
            </p>
            <h1 className="display mt-5 max-w-[16ch] text-4xl text-ink">
              Sign up for the CareLoop demonstration
            </h1>
            <p className="measure mt-6 text-lg leading-[1.5] text-ink-2">
              Three steps. You sign up, you pick your insurance, and CareLoop
              reads the health records that insurer holds for you. The details
              below are already filled in, so there is nothing to type.
            </p>

            <ol className="mt-10 max-w-[30rem] border-t border-line">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="flex gap-5 border-b border-line py-5"
                >
                  <span
                    aria-hidden="true"
                    className="numeric mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-wash text-sm font-bold text-brand"
                  >
                    {index + 1}
                  </span>
                  <span>
                    <span className="block font-semibold text-ink">
                      {step.title}
                    </span>
                    <span className="mt-1 block text-sm text-ink-2">
                      {step.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="enter-rise" style={{ '--i': 1 }}>
            <div className={PANEL + ' ledge-strong px-6 py-8 sm:px-9 sm:py-10'}>
              <h2 className="display text-xl text-ink">
                Your demonstration details
              </h2>

              <form onSubmit={submit} noValidate className="mt-7">
                <div>
                  <label htmlFor="signup-name" className={LABEL}>
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

                <div className="mt-5">
                  <label htmlFor="signup-email" className={LABEL}>
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

                <div className="mt-5">
                  <label htmlFor="signup-password" className={LABEL}>
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

                <p id="signup-note" className="mt-4 text-sm text-ink-2">
                  Never type a real password into a demonstration, including
                  this one. CareLoop stores no password and has no sign-in
                  server.
                </p>

                <div role="alert" className="empty:hidden">
                  {error ? (
                    <Notice
                      tone="alarm"
                      word="Those are not the demonstration details"
                      size="sm"
                      className="enter-fade mt-5"
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

                <button
                  type="submit"
                  className={BTN_PRIMARY + ' mt-7 min-h-[56px] w-full'}
                >
                  Sign up and choose my insurance
                </button>
              </form>

              <div className="mt-7 border-t border-line pt-5">
                <p className="text-sm text-ink-2">
                  Already have the demonstration account?
                </p>
                <Link to="/signin" className={LINK + ' text-sm'}>
                  Sign in instead
                </Link>
              </div>
            </div>

            <Notice
              tone="caution"
              word="This is a demonstration"
              size="sm"
              className="mt-6"
            >
              <p>
                No account is created here. CareLoop has no sign-up server,
                keeps no record of anything typed on this page, and will never
                ask you for a date of birth, an address, a member number or a
                social security number.
              </p>
            </Notice>
          </div>
        </div>
      </main>
    </div>
  )
}
