import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import CallSchedule from '../components/CallSchedule.jsx'
import DemoControls from '../components/DemoControls.jsx'
import MedicationCard from '../components/MedicationCard.jsx'
import NextUpCard from '../components/NextUpCard.jsx'
import Notice from '../components/Notice.jsx'
import PortalShared from '../components/PortalShared.jsx'
import Screen from '../components/Screen.jsx'
import TimeTravel from '../components/TimeTravel.jsx'
import { Rule } from '../components/Block.jsx'
import { applyClockShift } from '../lib/clock.js'
import { dateTimeLabel, groupSchedule } from '../lib/format.js'
import { BTN_PRIMARY, BTN_SECONDARY, CARD } from '../lib/ui.js'
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
    medications,
    schedule,
    clockShiftMs,
    setClockShiftMs,
  } = useSession()

  const { portal, loading, loadFailed, reload } = usePortal(connected)
  const { data: visits } = useFollowups(patientId, connected)

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

  if (!connected) {
    return (
      <Screen title="Today">
        <div className={CARD + ' measure px-7 py-8'}>
          <h2 className="display-tight text-xl text-ink">
            Connect MyHealth to see your medicines
          </h2>
          <p className="mt-3 text-ink-2">
            CareLoop reads the medicine list from the portal and works out when
            to call. You never type a medicine in.
          </p>
          <Link to="/connect" className={BTN_PRIMARY + ' mt-7'}>
            Connect MyHealth
          </Link>
        </div>
      </Screen>
    )
  }

  const next = bookedVisits(visits)[0]
  const who = record ? record.name.split(' ')[0] : ''

  return (
    <Screen title={who ? 'Today, ' + who : 'Today'} lead={today()}>
      {loading ? (
        <p aria-live="polite" aria-busy="true" className="text-lg font-semibold text-ink-2">
          Loading...
        </p>
      ) : null}

      {loadFailed ? (
        <Notice role="alert" tone="alarm" word="Not loaded" className="measure">
          MyHealth did not answer.{' '}
          <button type="button" onClick={reload} className="font-semibold underline">
            Try again
          </button>
          .
        </Notice>
      ) : null}

      {!loading && !loadFailed && plan ? (
        <div>
          <NextUpCard dose={plan.next_dose} />

          <div className="mt-12 grid gap-x-12 gap-y-14 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="min-w-0">
              <h2 className="display text-2xl text-ink">Medications</h2>
              <Rule />
              {list.length ? (
                <ul className="mt-8 flex flex-col gap-6">
                  {list.slice(0, SHOWN).map((med, index) => (
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
