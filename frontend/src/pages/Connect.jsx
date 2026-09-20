import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import ConsentModal, { SHARED_ITEMS } from '../components/ConsentModal.jsx'
import Notice from '../components/Notice.jsx'
import Screen from '../components/Screen.jsx'
import { Glance, GlanceTile } from '../components/DayGlance.jsx'
import { connectPatient, regimenState } from '../lib/api.js'
import { clockLabel } from '../lib/format.js'
import { BTN_HERO, BTN_QUIET, CARD, LEAD } from '../lib/ui.js'
import { useSession } from '../lib/session.jsx'
import { INSURERS, insurerFor, insurerName, patientName } from '../data/patients.js'

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
  const {
    patientId,
    choosePatient,
    connected,
    record,
    applyPortal,
    medications,
    schedule,
    regimen,
  } = useSession()

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
      navigate('/')
    } catch {
      timers.current.forEach(clearTimeout)
      setPhase('error')
    }
  }, [applyPortal, navigate, patientId])

  const syncing = phase === 'syncing'
  const chosen = insurerFor(patientId)
  const nextDose = schedule && schedule.next_dose
  const flaggedCount = ((regimen && regimen.surfaced) || []).length
  const readCount = (medications || []).length

  return (
    <Screen
      title={connected ? 'Your insurance and records' : 'Choose your insurance'}
      lead={
        connected
          ? 'CareLoop reads your medicines from the records your insurer holds, and works out when to call you. You never type a medicine in.'
          : 'CareLoop connects to your insurer and reads the health records held for you there. You never type a medicine in.'
      }
    >
      {connected && !syncing ? (
        <div>
          <p className={LEAD}>
            {insurerName(patientId)} is connected, and the records for{' '}
            <strong className="font-semibold">
              {record ? record.name : patientName(patientId)}
            </strong>{' '}
            have been loaded.
          </p>

          <Glance>
            <GlanceTile
              index={0}
              tone={nextDose ? 'now' : 'quiet'}
              label="Next call"
              value={nextDose ? clockLabel(nextDose.time) : 'None left today'}
              detail={
                nextDose
                  ? 'CareLoop rings you about your ' + nextDose.medication + '.'
                  : 'Every call planned for today is behind you.'
              }
            />

            <GlanceTile
              index={1}
              tone={flaggedCount ? 'alert' : 'clear'}
              label="Interaction check"
              value={
                flaggedCount
                  ? flaggedCount +
                    (flaggedCount === 1 ? ' pair flagged' : ' pairs flagged')
                  : 'Nothing flagged'
              }
              detail={
                flaggedCount
                  ? 'Set out in full on the call it belongs to, and on your medicines.'
                  : 'No pair on this list is one CareLoop would raise with you.'
              }
            />

            <GlanceTile
              index={2}
              tone="quiet"
              label="Medicines read"
              value={readCount === 1 ? '1 medicine' : readCount + ' medicines'}
              detail="Read from the records your insurer holds. You typed none of them in."
            />
          </Glance>

          <div className="mt-10">
            <Link to="/" className={BTN_HERO}>
              Go to Today
            </Link>
          </div>

          <div className="mt-12 border-t border-line pt-8">
            <p className="measure text-ink-2">
              Disconnecting clears the medicine list from CareLoop. You would
              have to choose your insurance again to get it back.
            </p>
            <button
              type="button"
              onClick={() => {
                choosePatient(patientId)
                setPhase('idle')
              }}
              className={BTN_QUIET + ' mt-6'}
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
              Who insures you?
            </legend>
            <p className="measure mt-3 text-ink-2">
              Every insurer, plan, patient and medicine here is fictional. Your
              choice decides which sample record CareLoop reads.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {INSURERS.map((payer) => {
                const picked = payer.id === patientId
                return (
                  <label
                    key={payer.id}
                    className={
                      'pressable block cursor-pointer rounded-card border px-6 py-5 ' +
                      (picked
                        ? 'border-brand bg-brand-wash ring-1 ring-brand'
                        : 'border-line bg-surface hover:border-line-strong hover:bg-sunken')
                    }
                  >
                    <span className="flex items-baseline justify-between gap-4">
                      <span className="display-tight text-lg text-ink">
                        {payer.insurer}
                      </span>
                      <input
                        type="radio"
                        name="insurer"
                        value={payer.id}
                        checked={picked}
                        onChange={() => choosePatient(payer.id)}
                        className="h-6 w-6 shrink-0 accent-[var(--color-brand)]"
                      />
                    </span>
                    <span className="mt-3 block text-sm text-ink-2">
                      {payer.plan}
                    </span>
                    <span className="mt-1 block text-sm text-ink-2">
                      Records held in {payer.portal}
                    </span>
                    <span
                      className={
                        'smallcaps mt-4 flex items-center gap-2 text-micro ' +
                        (picked ? 'text-brand' : 'text-ink-2 opacity-0')
                      }
                      aria-hidden={!picked}
                    >
                      <span aria-hidden="true">{DONE}</span>
                      Chosen
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {chosen ? (
            <section
              aria-labelledby="plan-heading"
              className={CARD + ' enter-fade mt-8 px-6 py-7 sm:px-8'}
            >
              <h2 id="plan-heading" className="display text-lg text-ink">
                What {chosen.insurer} means here
              </h2>
              <dl className="mt-6 grid gap-6 sm:grid-cols-2 sm:gap-x-12">
                <div>
                  <dt className="smallcaps text-micro text-ink-2">Plan</dt>
                  <dd className="mt-1 text-base text-ink">{chosen.plan}</dd>
                </div>
                <div>
                  <dt className="smallcaps text-micro text-ink-2">Network</dt>
                  <dd className="mt-1 text-base text-ink">{chosen.network}</dd>
                </div>
                <div>
                  <dt className="smallcaps text-micro text-ink-2">
                    Roughly what it covers
                  </dt>
                  <dd className="mt-2">
                    <ul className="flex flex-col gap-2">
                      {chosen.covers.map((line) => (
                        <li key={line} className="flex items-baseline gap-3">
                          <span aria-hidden="true" className="text-brand">
                            {DONE}
                          </span>
                          <span className="measure text-sm text-ink">
                            {line}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
                <div>
                  <dt className="smallcaps text-micro text-ink-2">
                    Records CareLoop would read
                  </dt>
                  <dd className="mt-1 text-base text-ink">
                    {chosen.medicines === 1
                      ? '1 active medicine, with its dose times'
                      : chosen.medicines +
                        ' active medicines, with their dose times'}
                  </dd>
                </div>
              </dl>
              <p className="measure mt-6 border-t border-line pt-5 text-sm text-ink-2">
                {chosen.insurer} is used here as a familiar name only. This
                plan, its network and everything listed above were written for
                the demonstration. No membership is checked and no insurer is
                contacted.
              </p>
            </section>
          ) : null}

          <button
            type="button"
            onClick={() => setConsentOpen(true)}
            className={BTN_HERO + ' mt-9 w-full sm:w-auto'}
          >
            Connect {insurerName(patientId)} and load my records
          </button>
          <p className="measure mt-4 text-sm text-ink-2">
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
              Nothing was shared and nothing was changed. Press Connect to try
              again, or call your clinic directly if this is urgent.
            </Notice>
          ) : null}
        </div>
      ) : null}

      {syncing ? (
        <div className="on-ocean ledge-strong rounded-panel bg-brand px-7 py-8 text-brand-ink sm:px-10 sm:py-10">
          <p
            aria-live="polite"
            aria-busy="true"
            className="display flex items-start gap-4 text-xl text-brand-ink"
          >
            <span
              aria-hidden="true"
              className="mt-2 text-[0.6em] text-brand-ink"
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
                className="flex items-baseline gap-4 border-b border-brand-ink/25 py-4 text-sm"
              >
                <span
                  aria-hidden="true"
                  className={
                    index < landed ? 'text-brand-ink' : 'text-brand-ink-2 opacity-70'
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
              <h2 className="smallcaps text-micro text-brand-ink-2">
                Medicines read from MyHealth
              </h2>

              <ul className="mt-6 flex flex-col gap-4">
                {pulled.slice(0, landedMeds).map((name, index) => (
                  <li
                    key={name + index}
                    className="enter-land flex min-h-[64px] items-center gap-4 rounded-card bg-surface px-6 py-4"
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
                className="numeric mt-6 text-sm font-semibold text-brand-ink"
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
        insurerName={insurerName(patientId)}
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
