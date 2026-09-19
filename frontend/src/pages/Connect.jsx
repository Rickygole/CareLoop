import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import ConsentModal, { SHARED_ITEMS } from '../components/ConsentModal.jsx'
import Screen from '../components/Screen.jsx'
import { connectPatient, regimenState } from '../lib/api.js'
import { useSession } from '../lib/session.jsx'
import { PATIENTS, patientName } from '../data/patients.js'

const STEP_MS = 300
const MIN_SYNC_MS = 1300

const PROMISES = [
  'You never log in.',
  'You never type anything.',
  'You never enter a medicine.',
  'You just answer the phone.',
]

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function ConnectPage() {
  const navigate = useNavigate()
  const { patientId, choosePatient, connected, record, applyPortal } = useSession()

  const [consentOpen, setConsentOpen] = useState(false)
  const [phase, setPhase] = useState('idle')
  const [landed, setLanded] = useState(0)
  const timers = useRef([])

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
    },
    [],
  )

  const allow = useCallback(async () => {
    setConsentOpen(false)
    setPhase('syncing')
    setLanded(0)

    timers.current.forEach(clearTimeout)
    timers.current = SHARED_ITEMS.map((_, index) =>
      setTimeout(() => setLanded(index + 1), STEP_MS * (index + 1)),
    )

    const started = Date.now()
    try {
      const [portal, state] = await Promise.all([
        connectPatient(patientId),
        regimenState(patientId),
      ])
      await wait(Math.max(0, MIN_SYNC_MS - (Date.now() - started)))
      applyPortal(portal.patient, state)
      navigate('/meds')
    } catch {
      timers.current.forEach(clearTimeout)
      setPhase('error')
    }
  }, [applyPortal, navigate, patientId])

  return (
    <Screen
      mark="01"
      label="For people who take medicine every day"
      title="We call you. You just talk."
      lead="CareLoop rings you when a dose of your medicine is due. It asks whether you took it and how you are feeling. If what you say needs a doctor, CareLoop phones the clinic itself, books the appointment, and then tells you when it is."
    >
      <div className="mt-10 grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div>
          {connected && phase !== 'syncing' ? (
            <div className="border-t border-line pt-8">
              <p className="measure text-ink">
                MyHealth is already connected for{' '}
                <strong className="font-semibold">
                  {record ? record.name : patientName(patientId)}
                </strong>
                . Your medicines came across and CareLoop has worked out when to
                call.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-5">
                <Link
                  to="/meds"
                  className="inline-flex min-h-[56px] items-center rounded-control bg-brand px-8 py-3.5 text-sm font-semibold text-white shadow-raised transition-[background-color,transform] duration-200 ease-out hover:bg-brand-deep active:translate-y-px"
                >
                  See your medicines
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    choosePatient(patientId)
                    setPhase('idle')
                  }}
                  className="min-h-[52px] rounded-control border-2 border-line-strong bg-surface px-6 py-3 text-sm font-semibold text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink"
                >
                  Disconnect and start again
                </button>
              </div>
            </div>
          ) : null}

          {!connected && phase !== 'syncing' ? (
            <div className="border-t border-line pt-8">
              <p className="measure text-ink-2">
                CareLoop reads your medicines from MyHealth, the portal your
                pharmacy and your clinic already use. Connecting it is the one
                and only thing you ever have to do.
              </p>

              <button
                type="button"
                onClick={() => setConsentOpen(true)}
                className="mt-8 min-h-[56px] rounded-control bg-brand px-10 py-3.5 text-sm font-semibold text-white shadow-raised transition-[background-color,transform] duration-200 ease-out hover:bg-brand-deep active:translate-y-px"
              >
                Connect MyHealth
              </button>

              {phase === 'denied' ? (
                <p
                  role="status"
                  className="measure enter-fade mt-8 border-l-4 border-line-strong bg-surface-2 px-6 py-5 text-ink-2"
                >
                  Nothing was shared. CareLoop cannot see any of your medicines
                  and will not call you. You can connect whenever you are ready.
                </p>
              ) : null}

              {phase === 'error' ? (
                <p
                  role="alert"
                  className="measure enter-fade mt-8 flex items-start gap-3 border-l-4 border-emergency bg-emergency-tint px-6 py-5 text-emergency"
                >
                  <span aria-hidden="true" className="leading-[1.6]">
                    {String.fromCharCode(9651)}
                  </span>
                  <span>
                    <strong className="font-semibold">
                      MyHealth did not answer.
                    </strong>{' '}
                    Nothing was shared and nothing was changed. Press Connect
                    MyHealth to try again.
                  </span>
                </p>
              ) : null}

              <div className="mt-10 border-t border-line pt-6">
                <label
                  htmlFor="patient"
                  className="smallcaps block text-micro text-muted"
                >
                  Set up for this demonstration
                </label>
                <p className="measure mt-3 text-sm text-ink-2">
                  Four made up records sit behind the portal. Choose whose
                  record MyHealth hands over.
                </p>
                <select
                  id="patient"
                  value={patientId}
                  onChange={(event) => choosePatient(event.target.value)}
                  className="field-select mt-4 min-h-[52px] rounded-control border-2 border-line-strong bg-surface px-5 py-2.5 text-sm font-medium text-ink"
                >
                  {PATIENTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          {phase === 'syncing' ? (
            <div className="border-t border-line pt-8">
              <p
                aria-live="polite"
                aria-busy="true"
                className="flex items-center gap-4 text-lg font-semibold text-ink"
              >
                <span
                  aria-hidden="true"
                  className="text-brand"
                  style={{ animation: 'live-pulse 1100ms ease-in-out infinite' }}
                >
                  {String.fromCharCode(9679)}
                </span>
                Reading the record from MyHealth
              </p>

              <ul className="mt-7 border-t border-line">
                {SHARED_ITEMS.map((item, index) => (
                  <li
                    key={item}
                    className="flex items-baseline gap-4 border-b border-line py-3.5"
                  >
                    <span
                      aria-hidden="true"
                      className={
                        index < landed ? 'text-mild' : 'text-line-strong'
                      }
                    >
                      {index < landed
                        ? String.fromCharCode(10003)
                        : String.fromCharCode(9675)}
                    </span>
                    <span
                      className={index < landed ? 'text-ink' : 'text-muted'}
                    >
                      {item}
                      {index < landed ? ', received' : ', waiting'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <aside className="border-t-2 border-line-ink pt-7 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-1">
          <h2 className="smallcaps text-micro text-muted">
            What you have to do
          </h2>
          <p className="font-display mt-3 text-xl font-semibold text-ink">
            Connect the portal. Once.
          </p>
          <ul className="mt-6 space-y-3.5 text-sm text-ink-2">
            {PROMISES.map((line, index) => (
              <li key={line} className="flex items-baseline gap-3.5">
                <span
                  aria-hidden="true"
                  className={
                    'shrink-0 ' + (index === 3 ? 'text-brand' : 'text-muted')
                  }
                >
                  {index === 3
                    ? String.fromCharCode(9654)
                    : String.fromCharCode(8213)}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <ConsentModal
        open={consentOpen}
        patientName={patientName(patientId)}
        busy={phase === 'syncing'}
        onAllow={allow}
        onDeny={() => {
          setConsentOpen(false)
          setPhase('denied')
        }}
      />
    </Screen>
  )
}
