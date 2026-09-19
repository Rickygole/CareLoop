import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import CallSchedule from '../components/CallSchedule.jsx'
import DemoControls from '../components/DemoControls.jsx'
import InteractionFlags from '../components/InteractionFlags.jsx'
import { LoadFailed, Loading, RefreshFailed } from '../components/LoadState.jsx'
import MedicationCard from '../components/MedicationCard.jsx'
import NextUpCard from '../components/NextUpCard.jsx'
import PortalShared from '../components/PortalShared.jsx'
import PortalUpdate from '../components/PortalUpdate.jsx'
import RegimenSnapshot from '../components/RegimenSnapshot.jsx'
import Screen from '../components/Screen.jsx'
import TimeTravel from '../components/TimeTravel.jsx'
import { Rule } from '../components/Block.jsx'
import { applyClockShift } from '../lib/clock.js'
import { clockLabel, dateTimeLabel, groupSchedule } from '../lib/format.js'
import { BTN_PRIMARY, CARD } from '../lib/ui.js'
import { usePortal } from '../lib/usePortal.js'
import { useSession } from '../lib/session.jsx'

const CASCADE_STEPS = [
  'A new regimen snapshot is written',
  'The call schedule is worked out again',
  'Every pair of medicines is checked',
]

function reducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function arrivalSentence(applied) {
  const names = applied || []
  if (!names.length) return 'MyHealth sent a change. '
  return names.join(' and ') + ' arrived from MyHealth. '
}

export default function MedsPage() {
  const {
    medications,
    schedule,
    regimen,
    connected,
    clockShiftMs,
    setClockShiftMs,
  } = useSession()

  const { portal, loading, loadFailed, refreshFailed, failure, reload, sync } =
    usePortal(connected)

  const [checking, setChecking] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [syncFailed, setSyncFailed] = useState(false)
  const [prior, setPrior] = useState(null)
  const [stage, setStage] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const timers = useRef([])

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
    },
    [],
  )

  const check = useCallback(async () => {
    setChecking(true)
    setSyncFailed(false)
    try {
      await sync(false)
    } catch {
      setSyncFailed(true)
    } finally {
      setChecking(false)
    }
  }, [sync])

  const pull = useCallback(async () => {
    setPulling(true)
    setSyncFailed(false)
    const before = { medications, schedule, regimen }
    const gap = reducedMotion() ? 320 : 850

    try {
      const result = await sync(true)

      timers.current.forEach(clearTimeout)
      setPrior(before)
      setStage(1)
      setAnnouncement(
        arrivalSentence(result.applied) +
          'Snapshot ' + result.regimen.content_hash + ' replaces ' +
          (before.regimen ? before.regimen.content_hash : 'the last one') + '.',
      )

      const nextPlan = applyClockShift(result.schedule, clockShiftMs)
      const flagged = (result.regimen.surfaced || [])[0]

      timers.current = [
        setTimeout(() => {
          setStage(2)
          setAnnouncement(
            nextPlan && nextPlan.next_dose
              ? 'Schedule worked out again. The next call is at ' +
                  clockLabel(nextPlan.next_dose.time) + '.'
              : 'Schedule worked out again. No call is left today.',
          )
        }, gap),
        setTimeout(() => {
          setStage(3)
          setAnnouncement(
            flagged
              ? 'Interaction flagged, ' +
                  flagged.ingredients.join(' and ') + ', ' +
                  flagged.severity + '.'
              : 'Checked every pair. Nothing to raise with the patient.',
          )
        }, gap * 2),
        setTimeout(() => {
          setPrior(null)
          setStage(0)
        }, gap * 3),
      ]
    } catch {
      setSyncFailed(true)
    } finally {
      setPulling(false)
    }
  }, [clockShiftMs, medications, regimen, schedule, sync])

  const cascading = Boolean(prior)
  const shownRequests = cascading && stage < 2 ? prior.medications : medications
  const shownPlanRaw = cascading && stage < 2 ? prior.schedule : schedule
  const shownRegimen = cascading && stage < 3 ? prior.regimen : regimen
  const shownHash =
    cascading && stage < 1
      ? prior.regimen && prior.regimen.content_hash
      : regimen && regimen.content_hash

  const plan = useMemo(
    () => applyClockShift(shownPlanRaw, clockShiftMs),
    [shownPlanRaw, clockShiftMs],
  )

  const list = useMemo(() => {
    const frequencyById = new Map(
      (shownRequests || []).map((r) => [r.medication_id, r.frequency]),
    )
    return groupSchedule((plan && plan.doses) || []).map((med) => ({
      ...med,
      frequency: frequencyById.get(med.key) || '',
    }))
  }, [plan, shownRequests])

  if (!connected) {
    return (
      <Screen title="Medications">
        <div className={CARD + ' measure px-7 py-8'}>
          <h2 className="display-tight text-xl text-ink">
            Connect MyHealth to see your medicines
          </h2>
          <p className="mt-3 text-ink-2">
            The list comes from the portal. You never type a medicine in.
          </p>
          <Link to="/connect" className={BTN_PRIMARY + ' mt-7'}>
            Connect MyHealth
          </Link>
        </div>
      </Screen>
    )
  }

  const syncedAt = portal && portal.synced_at

  return (
    <Screen title="Medications">
      {loading ? <Loading what="Reading your medicines from MyHealth." /> : null}

      {loadFailed ? (
        <LoadFailed
          what="MyHealth did not answer, so your medicines were not read."
          detail={failure}
          onRetry={reload}
        />
      ) : null}

      {refreshFailed ? (
        <RefreshFailed
          what="MyHealth did not answer, so this list was not refreshed."
          detail={failure}
          onRetry={reload}
        />
      ) : null}

      {!loading && !loadFailed && plan ? (
        <div>
          <NextUpCard dose={plan.next_dose} />

          <div className="mt-12 grid gap-x-12 gap-y-14 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="min-w-0">
              <h2 className="display text-2xl text-ink">Your medications</h2>
              <Rule />

              {list.length ? (
                <ul className="mt-8 flex flex-col gap-6">
                  {list.map((med, index) => (
                    <MedicationCard key={med.key} med={med} index={index} />
                  ))}
                </ul>
              ) : (
                <p className="measure mt-8 text-ink-2">
                  There are no medicines on this record.
                </p>
              )}
            </div>

            <aside className="lg:pt-2">
              <CallSchedule plan={plan} flash={cascading && stage >= 2} />
              <PortalShared
                allergies={portal && portal.allergies}
                window={portal && portal.preferred_contact_window}
              />
            </aside>
          </div>

          <InteractionFlags
            regimen={shownRegimen}
            flash={cascading && stage >= 3}
          />

          <section aria-labelledby="change-heading" className="mt-12">
            <h2 id="change-heading" className="display text-2xl text-ink">
              Connected to MyHealth
              {syncedAt ? ', last synced ' + dateTimeLabel(syncedAt) : ''}
            </h2>
            <Rule />

            <PortalUpdate
              syncedAt={syncedAt}
              summary={portal && portal.diff_summary}
              pending={Boolean(portal && portal.portal_has_pending_change)}
              checking={checking}
              pulling={pulling}
              failed={syncFailed}
              onCheck={check}
              onPull={pull}
            />

            <div role="status" aria-live="polite" className="mt-9 empty:hidden">
              {cascading ? (
                <div className={'enter-fade ' + CARD + ' px-7 py-7'}>
                  <p className="smallcaps text-micro text-clay">
                    What the portal just set off
                  </p>
                  <ol className="mt-5 flex flex-col gap-3">
                    {CASCADE_STEPS.map((label, index) => {
                      const done = stage > index
                      return (
                        <li
                          key={label}
                          className={
                            'flex items-baseline gap-4 rounded-card border px-5 py-3 ' +
                            (done
                              ? 'border-mild bg-mild-tint'
                              : 'border-line bg-sunken')
                          }
                        >
                          <span
                            aria-hidden="true"
                            className={done ? 'text-mild' : 'text-ink-2'}
                          >
                            {done
                              ? String.fromCharCode(10003)
                              : String.fromCharCode(9675)}
                          </span>
                          <span
                            className={
                              'text-sm ' +
                              (done ? 'font-semibold text-ink' : 'text-ink-2')
                            }
                          >
                            {label}
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                  <p className="measure mt-5 text-sm text-ink-2">
                    {announcement}
                  </p>
                </div>
              ) : null}
            </div>

            <RegimenSnapshot
              hash={shownHash}
              previousHash={cascading ? prior.regimen.content_hash : null}
              count={(shownRequests || []).length}
              flash={cascading && stage >= 1}
            />
          </section>

          <DemoControls>
            <TimeTravel
              plan={shownPlanRaw}
              shiftMs={clockShiftMs}
              onShift={setClockShiftMs}
            />
          </DemoControls>
        </div>
      ) : null}
    </Screen>
  )
}
