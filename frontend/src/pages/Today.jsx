import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import CallSchedule from '../components/CallSchedule.jsx'
import DemoControls from '../components/DemoControls.jsx'
import MedicationCard from '../components/MedicationCard.jsx'
import { LoadFailed, Loading, RefreshFailed } from '../components/LoadState.jsx'
import NextUpCard from '../components/NextUpCard.jsx'
import Notice from '../components/Notice.jsx'
import PortalShared from '../components/PortalShared.jsx'
import Screen from '../components/Screen.jsx'
import TimeTravel from '../components/TimeTravel.jsx'
import { Rule } from '../components/Block.jsx'
import { applyClockShift } from '../lib/clock.js'
import { dateTimeLabel, groupSchedule } from '../lib/format.js'
import { BTN_HERO, BTN_PRIMARY, BTN_SECONDARY, CARD } from '../lib/ui.js'
import { flaggedNames, isFlagged, pairLabels, pinFlagged } from '../lib/flagged.js'
import { bookedVisits, useFollowups } from '../lib/useFollowups.js'
import { usePortal } from '../lib/usePortal.js'
import { useSession } from '../lib/session.jsx'

const SHOWN = 3

function today() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export default function TodayPage() {
  const {
    patientId,
    record,
    connected,
    restoring,
    restoreFailed,
    medications,
    schedule,
    clockShiftMs,
    setClockShiftMs,
    regimen,
  } = useSession()

  const { portal, loading, loadFailed, refreshFailed, failure, reload } =
    usePortal(connected)
  const {
    data: visits,
    loading: visitsLoading,
    failed: visitsFailed,
    reload: reloadVisits,
  } = useFollowups(patientId, connected)

  const plan = useMemo(
    () => applyClockShift(schedule, clockShiftMs),
    [schedule, clockShiftMs],
  )

  const list = useMemo(() => {
    const frequencyById = new Map(
      (medications || []).map((r) => [r.medication_id, r.frequency]),
    )
    return groupSchedule((plan && plan.doses) || []).map((med) => ({
      ...med,
      frequency: frequencyById.get(med.key) || '',
    }))
  }, [plan, medications])

  if (restoring) {
    return (
      <Screen title="Today">
        <Loading what="Reading your records again after the page reloaded." />
      </Screen>
    )
  }

  if (!connected) {
    return (
      <Screen title="Today">
        {restoreFailed ? (
          <Notice role="alert" tone="alarm" word="Not read" className="measure mb-10">
            CareLoop could not read your records again after the page
            reloaded. Nothing on the record changed. Choose your insurance
            again below.
          </Notice>
        ) : null}
        <div className={CARD + ' measure px-7 py-8'}>
          <h2 className="display-tight text-xl text-ink">
            Choose your insurance to see your medicines
          </h2>
          <p className="mt-3 text-ink-2">
            CareLoop reads the medicine list from the records your insurer
            holds, and works out when to call. You never type a medicine in.
          </p>
          <Link to="/connect" className={BTN_PRIMARY + ' mt-7'}>
            Choose your insurance
          </Link>
        </div>
      </Screen>
    )
  }

  const next = bookedVisits(visits)[0]
  const who = record ? record.name.split(' ')[0] : ''
  const flagged = (regimen && regimen.surfaced) || []
  const marked = flaggedNames(flagged)
  const shown = pinFlagged(list, marked, SHOWN)
  const pinned =
    list.length > SHOWN && shown.some((med) => isFlagged(med, marked))

  return (
    <Screen title={who ? 'Today, ' + who : 'Today'} lead={today()}>
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
          what="MyHealth did not answer, so this page was not refreshed."
          detail={failure}
          onRetry={reload}
        />
      ) : null}

      {!loading && !loadFailed && plan ? (
        <div>
          {flagged.length ? (
            <Notice
              tone="caution"
              word="Worth checking"
              className="measure mb-10"
            >
              <p className="text-lg leading-[1.45] text-ink">
                Two of your medicines are worth asking about:{' '}
                <strong className="inline-block font-semibold first-letter:uppercase">
                  {pairLabels(flagged[0]).join(' and ')}
                </strong>
                . Both are in the list below.
              </p>
              <Link to="/meds" className={BTN_SECONDARY + ' mt-6'}>
                See what to ask about
              </Link>
            </Notice>
          ) : null}

          <NextUpCard dose={plan.next_dose} />

          <div className="mt-9">
            <Link to="/call" className={BTN_HERO}>
              Start my check-in
            </Link>
            <p className="measure mt-4 text-ink-2">
              You do not have to wait for the call. You can take the check-in
              whenever you like.
            </p>
          </div>

          <div className="mt-12 grid gap-x-12 gap-y-14 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="min-w-0">
              <h2 className="display text-2xl text-ink">Medications</h2>
              <Rule />
              {pinned ? (
                <p className="measure mt-5 text-sm text-ink-2">
                  The medicines named above are shown first, so a short list
                  never hides the pair worth asking about.
                </p>
              ) : null}
              {list.length ? (
                <ul className="mt-8 flex flex-col gap-6">
                  {shown.map((med, index) => (
                    <MedicationCard key={med.key} med={med} index={index} />
                  ))}
                </ul>
              ) : (
                <p className="measure mt-8 text-ink-2">
                  There are no medicines on this record.
                </p>
              )}
              <Link to="/meds" className={BTN_SECONDARY + ' mt-8'}>
                {list.length > SHOWN
                  ? 'All ' + list.length + ' medications'
                  : 'Go to medications'}
              </Link>
            </div>

            <aside className="lg:pt-2">
              <CallSchedule plan={plan} />

              <section
                aria-labelledby="visit-heading"
                className={CARD + ' mt-8 px-6 py-7'}
              >
                <h2 id="visit-heading" className="display-tight text-lg text-ink">
                  Next appointment
                </h2>
                {next ? (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-ink">
                      {next.provider_name}
                    </p>
                    <p className="text-sm text-ink-2">{next.specialty}</p>
                    <p className="numeric mt-2 text-sm text-ink">
                      {next.slot_local}
                    </p>
                  </div>
                ) : visitsLoading ? (
                  <p
                    aria-live="polite"
                    aria-busy="true"
                    className="mt-4 text-sm text-ink-2"
                  >
                    Reading your appointments.
                  </p>
                ) : visitsFailed ? (
                  <div className="mt-4">
                    <Notice role="alert" tone="alarm" word="Not loaded" size="sm">
                      CareLoop could not read your appointments just now. This
                      is not a statement that you have none. Press Try again,
                      or call your clinic directly if this is urgent.
                    </Notice>
                    <button
                      type="button"
                      onClick={reloadVisits}
                      className={BTN_SECONDARY + ' mt-6 w-full'}
                    >
                      Try again
                    </button>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-ink-2">
                    No visit is booked at the moment.
                  </p>
                )}
                {visits && visits.payer_display ? (
                  <p className="mt-4 border-t border-line pt-4 text-sm text-ink-2">
                    Covered by {visits.payer_display}.
                  </p>
                ) : null}
                <Link to="/appointments" className={BTN_SECONDARY + ' mt-6 w-full'}>
                  All appointments
                </Link>
              </section>

              <PortalShared
                allergies={portal && portal.allergies}
                window={portal && portal.preferred_contact_window}
              />
            </aside>
          </div>

          <DemoControls>
            <TimeTravel
              plan={schedule}
              shiftMs={clockShiftMs}
              onShift={setClockShiftMs}
            />
            <p className="measure mt-6 text-sm text-ink-2">
              Last read from MyHealth{' '}
              {portal && portal.synced_at ? dateTimeLabel(portal.synced_at) : 'on this visit'}.
            </p>
          </DemoControls>
        </div>
      ) : null}
    </Screen>
  )
}
