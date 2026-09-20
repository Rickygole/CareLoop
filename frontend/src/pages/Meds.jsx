import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import InteractionFlags, {
  InteractionLimits,
} from '../components/InteractionFlags.jsx'
import { LoadFailed, Loading, RefreshFailed } from '../components/LoadState.jsx'
import MedicationCard from '../components/MedicationCard.jsx'
import PortalShared from '../components/PortalShared.jsx'
import PortalUpdate from '../components/PortalUpdate.jsx'
import RegimenSnapshot from '../components/RegimenSnapshot.jsx'
import Screen from '../components/Screen.jsx'
import { Rule } from '../components/Block.jsx'
import { applyClockShift } from '../lib/clock.js'
import { clockLabel, dateTimeLabel, groupSchedule } from '../lib/format.js'
import {
  BTN_PRIMARY,
  CARD,
  FOLD,
  FOLD_BODY,
  FOLD_TOGGLE,
  SECTION,
} from '../lib/ui.js'
import { usePortal } from '../lib/usePortal.js'
import { useSession } from '../lib/session.jsx'

const CASCADE_STEPS = [
  'Your list is saved as a new version',
  'The call times are worked out again',
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
  const { medications, schedule, regimen, connected, restoring, clockShiftMs } =
    useSession()

  const { portal, loading, loadFailed, refreshFailed, failure, reload, sync } =
    usePortal(connected)

  const [toolsOpen, setToolsOpen] = useState(false)
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
          'Your list has been saved as a new version.',
      )

      const nextPlan = applyClockShift(result.schedule, clockShiftMs)
      const flagged = (result.regimen.surfaced || [])[0]

      timers.current = [
        setTimeout(() => {
          setStage(2)
          setAnnouncement(
            nextPlan && nextPlan.next_dose
              ? 'Call times worked out again. The next call is at ' +
                  clockLabel(nextPlan.next_dose.time) +
                  '.'
              : 'Call times worked out again. No call is left today.',
          )
        }, gap),
        setTimeout(() => {
          setStage(3)
          setAnnouncement(
            flagged
              ? 'Worth checking, ' +
                  flagged.ingredients.join(' and ') +
                  '. Shown at the top of this page.'
              : 'Checked every pair. Nothing worth raising with you.',
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

  if (restoring) {
    return (
      <Screen title="Medications">
        <Loading what="Reading your records again after the page reloaded." />
      </Screen>
    )
  }

  if (!connected) {
    return (
      <Screen title="Medications">
        <div className={CARD + ' measure px-7 py-8'}>
          <h2 className="display-tight text-xl text-ink">
            Choose your insurance to see your medicines
          </h2>
          <p className="mt-3 text-ink-2">
            The list comes from the records your insurer holds. You never type a
            medicine in.
          </p>
          <Link to="/connect" className={BTN_PRIMARY + ' mt-7'}>
            Choose your insurance
          </Link>
        </div>
      </Screen>
    )
  }

  const syncedAt = portal && portal.synced_at

  return (
    <Screen title="Medications">
      {loading ? (
        <Loading what="Reading your medicines from MyHealth." />
      ) : null}

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
          <InteractionFlags
            regimen={shownRegimen}
            flash={cascading && stage >= 3}
          />

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
              <PortalShared
                allergies={portal && portal.allergies}
                window={portal && portal.preferred_contact_window}
              />
            </aside>
          </div>

          <InteractionLimits regimen={shownRegimen} />

          <div className={FOLD + ' ' + SECTION}>
            <button
              type="button"
              onClick={() => setToolsOpen((open) => !open)}
              aria-expanded={toolsOpen}
              aria-controls="reviewer-panel"
              className={FOLD_TOGGLE}
            >
              <span className="smallcaps text-micro text-clay">
                Record source
              </span>
              <span className="mt-2 block text-sm font-semibold text-ink">
                {toolsOpen
                  ? 'Hide where this list comes from'
                  : 'Show where this list comes from'}
              </span>
            </button>

            <div
              id="reviewer-panel"
              hidden={!toolsOpen}
              className={FOLD_BODY}
            >
              <section aria-labelledby="change-heading">
                <h2 id="change-heading" className="display text-2xl text-ink">
                  Where this list comes from
                  {syncedAt ? ', last read ' + dateTimeLabel(syncedAt) : ''}
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

                <div
                  role="status"
                  aria-live="polite"
                  className="mt-9 empty:hidden"
                >
                  {cascading ? (
                    <div className={'enter-fade ' + CARD + ' px-7 py-7'}>
                      <p className="smallcaps text-micro text-clay">
                        What that change set off
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
                                  (done
                                    ? 'font-semibold text-ink'
                                    : 'text-ink-2')
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
            </div>
          </div>
        </div>
      ) : null}
    </Screen>
  )
}
