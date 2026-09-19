import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import ConsentModal, { SHARED_ITEMS } from '../components/ConsentModal.jsx'
import Screen from '../components/Screen.jsx'
import { connectPatient, regimenState } from '../lib/api.js'
import { useSession } from '../lib/session.jsx'
import { PATIENTS, patientName } from '../data/patients.js'

const STEP_MS = 260
const MED_MS = 240
const MIN_SYNC_MS = 1200
const TAIL_MS = 420

const DONE = String.fromCharCode(10003)
const WAITING = String.fromCharCode(9675)
const LIVE = String.fromCharCode(9679)
const WARN = String.fromCharCode(9651)

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function ConnectPage() {
  const navigate = useNavigate()
  const { patientId, choosePatient, connected, record, applyPortal } = useSession()

  const [consentOpen, setConsentOpen] = useState(false)
  const [phase, setPhase] = useState('idle')
  const [landed, setLanded] = useState(0)
  const [pulled, setPulled] = useState([])
  const [landedMeds, setLandedMeds] = useState(0)
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
    setPulled([])
    setLandedMeds(0)

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

      const names = ((state && state.medications) || []).map(
        (item) => item.medication,
      )
      setLanded(SHARED_ITEMS.length)
      setPulled(names)
      timers.current.forEach(clearTimeout)
      timers.current = names.map((_, index) =>
        setTimeout(() => setLandedMeds(index + 1), MED_MS * (index + 1)),
      )

      await wait(names.length * MED_MS + TAIL_MS)
      applyPortal(portal.patient, state)
      navigate('/meds')
    } catch {
      timers.current.forEach(clearTimeout)
      setPhase('error')
    }
  }, [applyPortal, navigate, patientId])

  const syncing = phase === 'syncing'

  return (
    <Screen
      mark="01"
      label="Step 1 of 5"
      title="Start here. Connect MyHealth once."
      lead="CareLoop then reads your medicines out of the portal, works out the hour every dose is due, and phones you at those hours to ask how you are. You never log in and you never type a medicine in."
    >
      {connected && !syncing ? (
        <div className="mt-10 border-t-2 border-line-ink pt-8">
          <p className="measure text-ink">
            MyHealth is connected for{' '}
            <strong className="font-semibold">
              {record ? record.name : patientName(patientId)}
            </strong>
            . The medicines came across and CareLoop has already worked out when
            to call.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Link
              to="/meds"
              className="inline-flex min-h-[60px] items-center rounded-control bg-brand px-9 py-4 text-lg font-semibold text-white shadow-raised transition-[background-color,transform] duration-200 ease-out hover:bg-brand-deep active:translate-y-px"
            >
              See your medicines and call times
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

      {!connected && !syncing ? (
        <div>
          <div className="mt-9">
            <button
              type="button"
              onClick={() => setConsentOpen(true)}
              className="min-h-[68px] w-full rounded-control bg-brand px-10 py-5 text-xl font-semibold text-white shadow-raised transition-[background-color,transform] duration-200 ease-out hover:bg-brand-deep active:translate-y-px sm:w-auto"
            >
              Connect MyHealth
            </button>
            <p className="measure mt-4 text-sm text-ink-2">
              MyHealth is the portal your pharmacy and your clinic already use.
              Nothing is read until you press Allow.
            </p>
          </div>

          {phase === 'denied' ? (
            <p
              role="status"
              className="measure enter-fade mt-9 border-l-4 border-line-strong bg-surface-2 px-6 py-5 text-ink-2"
            >
              Nothing was shared. CareLoop cannot see any of your medicines and
              will not call you. You can connect whenever you are ready.
            </p>
          ) : null}

          {phase === 'error' ? (
            <p
              role="alert"
              className="measure enter-fade mt-9 flex items-start gap-3 border-l-4 border-emergency bg-emergency-tint px-6 py-5 text-emergency"
            >
              <span aria-hidden="true" className="leading-[1.6]">
                {WARN}
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

          <div className="mt-14 border-t border-line pt-6">
            <label
              htmlFor="patient"
              className="smallcaps block text-micro text-muted"
            >
              Set up for this demonstration
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
              <select
                id="patient"
                value={patientId}
                onChange={(event) => choosePatient(event.target.value)}
                className="field-select min-h-[52px] rounded-control border-2 border-line-strong bg-surface px-5 py-2.5 text-sm font-medium text-ink"
              >
                {PATIENTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="max-w-[34ch] text-sm text-ink-2">
                Four made up records sit behind the portal. This picks whose
                record MyHealth hands over.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {syncing ? (
        <div className="mt-10 border-t-2 border-line-ink pt-8">
          <p
            aria-live="polite"
            aria-busy="true"
            className="font-display flex items-center gap-4 text-xl font-semibold text-ink"
          >
            <span
              aria-hidden="true"
              className="text-brand"
              style={{ animation: 'live-pulse 1100ms ease-in-out infinite' }}
            >
              {LIVE}
            </span>
            CareLoop is reading the record out of MyHealth
          </p>

          <ul className="mt-7 max-w-[34rem] border-t border-line">
            {SHARED_ITEMS.map((item, index) => (
              <li
                key={item}
                className="flex items-baseline gap-4 border-b border-line py-3.5"
              >
                <span
                  aria-hidden="true"
                  className={index < landed ? 'text-mild' : 'text-line-strong'}
                >
                  {index < landed ? DONE : WAITING}
                </span>
                <span className={index < landed ? 'text-ink' : 'text-muted'}>
                  {item}
                  {index < landed ? ', received' : ', waiting'}
                </span>
              </li>
            ))}
          </ul>

          {pulled.length ? (
            <div className="enter-fade mt-9">
              <h2 className="smallcaps text-micro text-brand-deep">
                Medicines pulled across, nobody typed these
              </h2>
              <ul className="mt-4 max-w-[34rem] border-t border-line">
                {pulled.map((name, index) => (
                  <li
                    key={name + index}
                    className="flex items-baseline gap-4 border-b border-line py-3.5"
                  >
                    <span
                      aria-hidden="true"
                      className={
                        index < landedMeds ? 'text-mild' : 'text-line-strong'
                      }
                    >
                      {index < landedMeds ? DONE : WAITING}
                    </span>
                    <span
                      className={
                        'font-display text-lg font-semibold ' +
                        (index < landedMeds ? 'text-ink' : 'text-muted')
                      }
                    >
                      {name}
                    </span>
                  </li>
                ))}
              </ul>
              <p aria-live="polite" className="mt-5 text-sm font-semibold text-brand-deep">
                {landedMeds === pulled.length
                  ? 'Working out the call times now.'
                  : 'Receiving from MyHealth.'}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <ConsentModal
        open={consentOpen}
        patientName={patientName(patientId)}
        busy={syncing}
        onAllow={allow}
        onDeny={() => {
          setConsentOpen(false)
          setPhase('denied')
        }}
      />
    </Screen>
  )
}
