import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import ConsentModal, { SHARED_ITEMS } from '../components/ConsentModal.jsx'
import Notice from '../components/Notice.jsx'
import Screen from '../components/Screen.jsx'
import { connectPatient, regimenState } from '../lib/api.js'
import { BTN_HERO, BTN_PRIMARY, BTN_QUIET } from '../lib/ui.js'
import { useSession } from '../lib/session.jsx'
import { PATIENTS, patientName } from '../data/patients.js'

const STEP_MS = 300
const MED_MS = 340
const MIN_SYNC_MS = 1200
const TAIL_MS = 520

const DONE = String.fromCharCode(10003)
const WAITING = String.fromCharCode(9675)
const LIVE = String.fromCharCode(9679)

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
      title="Start here. Connect MyHealth once."
      lead="CareLoop then reads your medicines out of the portal, works out the hour every dose is due, and phones you at those hours to ask how you are. You never log in and you never type a medicine in."
    >
      {connected && !syncing ? (
        <div>
          <p className="measure text-lg leading-[1.45] text-ink">
            MyHealth is connected for{' '}
            <strong className="font-bold">
              {record ? record.name : patientName(patientId)}
            </strong>
            . The medicines came across and CareLoop has already worked out when
            to call.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-6">
            <Link to="/meds" className={BTN_PRIMARY}>
              See your medicines and call times
            </Link>
            <button
              type="button"
              onClick={() => {
                choosePatient(patientId)
                setPhase('idle')
              }}
              className={BTN_QUIET}
            >
              Disconnect and start again
            </button>
          </div>
        </div>
      ) : null}

      {!connected && !syncing ? (
        <div>
          <fieldset className="border-0 p-0">
            <legend className="display text-xl text-ink">
              Who is this check-in for?
            </legend>
            <p className="measure mt-3 text-ink-2">
              CareLoop does not know yet. Pick the record it should read, and
              every screen after this one belongs to that person.
            </p>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {PATIENTS.map((person) => {
                const chosen = person.id === patientId
                return (
                  <label
                    key={person.id}
                    className={
                      'pressable ledge block cursor-pointer rounded-card border-2 px-6 py-6 ' +
                      (chosen
                        ? 'ledge-ink border-ink bg-sand'
                        : 'ledge-strong border-edge-strong bg-surface')
                    }
                  >
                    <span className="flex items-baseline justify-between gap-4">
                      <span className="display-tight text-lg text-ink">
                        {person.name}
                      </span>
                      <input
                        type="radio"
                        name="patient"
                        value={person.id}
                        checked={chosen}
                        onChange={() => choosePatient(person.id)}
                        className="h-6 w-6 shrink-0 accent-[var(--ink)]"
                      />
                    </span>
                    <span className="mt-4 block text-sm text-ink-2">
                      Insured with {person.insurer}
                    </span>
                    <span className="mt-1 block text-sm text-ink-2">
                      {person.medicines === 1
                        ? '1 medicine on the record'
                        : person.medicines + ' medicines on the record'}
                    </span>
                    <span
                      className={
                        'smallcaps mt-5 block text-micro ' +
                        (chosen ? 'text-ink' : 'text-ink-2 opacity-0')
                      }
                      aria-hidden={!chosen}
                    >
                      Chosen
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <button
            type="button"
            onClick={() => setConsentOpen(true)}
            className={BTN_HERO + ' mt-12 w-full sm:w-auto'}
          >
            Connect MyHealth for {patientName(patientId)}
          </button>
          <p className="measure mt-5 text-ink-2">
            MyHealth is the portal your pharmacy and your clinic already use.
            Nothing is read until you press Allow.
          </p>

          {phase === 'denied' ? (
            <Notice
              role="status"
              tone="quiet"
              word="Nothing happened"
              className="enter-fade measure mt-10"
            >
              Nothing was shared. CareLoop cannot see any of your medicines and
              will not call you. You can connect whenever you are ready.
            </Notice>
          ) : null}

          {phase === 'error' ? (
            <Notice
              role="alert"
              tone="alarm"
              word="MyHealth did not answer"
              className="enter-fade measure mt-10"
            >
              Nothing was shared and nothing was changed. Press Connect MyHealth
              to try again.
            </Notice>
          ) : null}

        </div>
      ) : null}

      {syncing ? (
        <div className="on-ocean ledge ledge-ink rounded-panel border-2 border-ink bg-brand px-7 py-9 text-brand-ink sm:px-10 sm:py-12">
          <p
            aria-live="polite"
            aria-busy="true"
            className="display flex items-start gap-4 text-xl text-brand-ink"
          >
            <span
              aria-hidden="true"
              className="mt-2 text-[0.6em] text-sand"
              style={{ animation: 'live-pulse 1100ms ease-in-out infinite' }}
            >
              {LIVE}
            </span>
            <span className="measure-tight">
              CareLoop is reading the record out of MyHealth
            </span>
          </p>

          <ul className="mt-8 max-w-[36rem]">
            {SHARED_ITEMS.map((item, index) => (
              <li
                key={item}
                className="flex items-baseline gap-4 border-b-2 border-brand-ink/20 py-4 text-sm"
              >
                <span
                  aria-hidden="true"
                  className={
                    index < landed ? 'text-sand' : 'text-brand-ink-2 opacity-60'
                  }
                >
                  {index < landed ? DONE : WAITING}
                </span>
                <span
                  className={
                    index < landed
                      ? 'font-semibold text-brand-ink'
                      : 'text-brand-ink-2'
                  }
                >
                  {item}
                  {index < landed ? ', received' : ', waiting'}
                </span>
              </li>
            ))}
          </ul>

          {pulled.length ? (
            <div className="mt-10">
              <h2 className="smallcaps text-micro text-sand">
                Medicines pulled across, nobody typed these
              </h2>

              <ul className="mt-6 flex flex-col gap-4">
                {pulled.slice(0, landedMeds).map((name, index) => (
                  <li
                    key={name + index}
                    className="enter-land ledge ledge-sand flex min-h-[64px] items-center gap-4 rounded-card bg-surface px-6 py-4"
                  >
                    <span aria-hidden="true" className="text-mild">
                      {DONE}
                    </span>
                    <span className="display-tight text-lg text-ink">
                      {name}
                    </span>
                  </li>
                ))}
              </ul>

              <p
                aria-live="polite"
                className="numeric mt-6 text-sm font-bold text-sand"
              >
                {landedMeds === pulled.length
                  ? 'All ' + pulled.length + ' received. Working out the call times now.'
                  : landedMeds + ' of ' + pulled.length + ' received from MyHealth.'}
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
