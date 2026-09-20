import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import Notice from '../components/Notice.jsx'
import Screen from '../components/Screen.jsx'
import { CallHeading, DoseRows, Event, Spine } from '../components/DaySpine.jsx'
import { InteractionPin } from '../components/InteractionFlags.jsx'
import { LoadFailed, Loading, RefreshFailed } from '../components/LoadState.jsx'
import { applyClockShift } from '../lib/clock.js'
import { clockLabel } from '../lib/format.js'
import { BTN_HERO, BTN_PRIMARY, BTN_SECONDARY, CARD } from '../lib/ui.js'
import { callEvents, coversLine, dayLabel, visitGutter } from '../lib/day.js'
import { flaggedNames, isFlagged, nameKey } from '../lib/flagged.js'
import { isConfigured as phoneConfigured } from '../lib/telephony.js'
import { bookedVisits, useFollowups } from '../lib/useFollowups.js'
import { usePortal } from '../lib/usePortal.js'
import { useSession } from '../lib/session.jsx'

const DIAMOND = String.fromCharCode(9670)

function doseLine(event) {
  const dose = (event.doses || [])[0]
  if (!dose) return ''
  return (
    dose.medication +
    (dose.dosage ? ' ' + dose.dosage : '') +
    ', ' +
    clockLabel(dose.time)
  )
}

function findingFor(event, finding, marked) {
  if (!finding) return null
  const hit = (event.doses || []).some((dose) => isFlagged(dose, marked))
  return hit ? finding : null
}

function pairNote(dose, marked, events, index) {
  if (!isFlagged(dose, marked)) return null
  const key = nameKey(dose.medication)

  for (let i = 0; i < events.length; i += 1) {
    if (i === index) continue
    for (const other of events[i].doses || []) {
      if (isFlagged(other, marked) && nameKey(other.medication) !== key) {
        return (
          <>
            <span aria-hidden="true" className="mr-2 text-severe">
              {DIAMOND}
            </span>
            paired with your {other.medication}, see{' '}
            {clockLabel(events[i].time)}
          </>
        )
      }
    }
  }
  return null
}

export default function TodayPage() {
  const {
    patientId,
    record,
    connected,
    restoring,
    restoreFailed,
    schedule,
    clockShiftMs,
    regimen,
  } = useSession()

  const { loading, loadFailed, refreshFailed, failure, reload } =
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

  const events = useMemo(() => callEvents(plan), [plan])

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
          <Notice
            role="alert"
            tone="alarm"
            word="Not read"
            className="measure mb-10"
          >
            CareLoop could not read your records again after the page reloaded.
            Nothing on the record changed. Choose your insurance again below.
          </Notice>
        ) : null}
        <div className={CARD + ' measure px-7 py-8'}>
          <h2 className="display-tight text-xl text-ink">
            Choose your insurance to see your day
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

  const who = record ? record.name.split(' ')[0] : ''
  const finding = ((regimen && regimen.surfaced) || [])[0] || null
  const marked = flaggedNames((regimen && regimen.surfaced) || [])
  const phoneLive = phoneConfigured()

  const nextDose = plan && plan.next_dose
  const nextIndex = nextDose
    ? events.findIndex((event) =>
        (event.doses || []).some(
          (dose) =>
            dose.medication_id === nextDose.medication_id &&
            dose.time === nextDose.time,
        ),
      )
    : -1

  const visit = bookedVisits(visits)[0]
  const closing = nextIndex === -1 && events.length > 0

  return (
    <Screen title={who ? 'Today, ' + who : 'Today'}>
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
          what="MyHealth did not answer, so this page was not refreshed."
          detail={failure}
          onRetry={reload}
        />
      ) : null}

      {!loading && !loadFailed && plan ? (
        <section aria-labelledby="day-heading">
          <h2 id="day-heading" className="display text-2xl text-ink">
            {dayLabel(plan)}
          </h2>

          <Spine>
            {events.length ? null : (
              <Event index={0} time="Today" state="No calls" tone="ahead">
                <h3 className="display-tight text-xl text-ink">
                  There are no calls on today's list
                </h3>
                <p className="measure mt-3 text-sm text-ink-2">
                  There are no medicines on this record, so CareLoop has nothing
                  to ring you about. If that is wrong, refresh the record from
                  your insurer.
                </p>
                <Link to="/meds" className={BTN_SECONDARY + ' mt-6'}>
                  Go to medications
                </Link>
              </Event>
            )}

            {events.map((event, index) => {
              const done = event.status === 'taken'
              const missed = event.status === 'missed'
              const next = index === nextIndex
              const tone = done ? 'done' : next ? 'now' : 'later'
              const state = done
                ? 'Done'
                : next
                  ? 'Next'
                  : missed
                    ? 'Not confirmed'
                    : 'Later'
              const title =
                done || missed
                  ? 'CareLoop called you'
                  : next
                    ? 'CareLoop rings your telephone'
                    : 'CareLoop will call again'
              const pin = next ? findingFor(event, finding, marked) : null
              const note = (dose) =>
                pin ? null : pairNote(dose, marked, events, index)
              const doses = event.doses || []
              const single = doses.length < 2 && !doses.some(note)

              return (
                <Event
                  key={event.at + event.time}
                  index={index}
                  time={clockLabel(event.time)}
                  state={state}
                  tone={tone}
                >
                  <CallHeading
                    title={title}
                    covers={single ? doseLine(event) : coversLine(event)}
                  />

                  {single ? null : <DoseRows doses={doses} note={note} />}

                  {pin ? <InteractionPin finding={pin} /> : null}

                  {next ? (
                    <div className="mt-7">
                      <Link to="/call" className={BTN_HERO}>
                        {phoneLive ? 'Call my phone now' : 'Start my check-in'}
                      </Link>
                      {phoneLive ? null : (
                        <p className="measure mt-4 text-sm text-ink-2">
                          No telephone settings are filled in here, so the
                          check-in runs in writing.
                        </p>
                      )}
                    </div>
                  ) : null}
                </Event>
              )
            })}

            {closing ? (
              <Event
                index={events.length}
                time="Done"
                state="Today"
                tone="ahead"
              >
                <h3 className="display-tight text-xl text-ink">
                  No call is left today
                </h3>
                <p className="measure mt-3 text-sm text-ink-2">
                  Every call CareLoop planned for today is behind you. The next
                  one is on tomorrow's list.
                </p>
                {finding ? (
                  <InteractionPin
                    finding={finding}
                    lead="Still worth asking about."
                  />
                ) : null}
                <Link to="/call" className={BTN_SECONDARY + ' mt-6'}>
                  Take a check-in anyway
                </Link>
              </Event>
            ) : null}

            <Event
              last
              index={events.length + 1}
              time={visit ? visitGutter(visit).time : 'Ahead'}
              state={visit ? visitGutter(visit).state : 'Nothing yet'}
              tone="ahead"
            >
              {visit ? (
                <>
                  <h3 className="display-tight text-xl text-ink">
                    {visit.provider_name}, {visit.specialty}
                  </h3>
                  <p className="mt-3 text-base text-ink">
                    {visit.slot_local}. Covered by{' '}
                    {visit.payer_display || (visits && visits.payer_display)}
                    {visit.in_network ? ', inside the network' : ''}.
                  </p>
                </>
              ) : visitsLoading ? (
                <p aria-live="polite" aria-busy="true" className="text-ink-2">
                  Reading your appointments.
                </p>
              ) : visitsFailed ? (
                <>
                  <Notice role="alert" tone="alarm" word="Not loaded" size="sm">
                    CareLoop could not read your appointments just now, which
                    does not mean you have none. Press Try again, or call your
                    clinic directly if this is urgent.
                  </Notice>
                  <button
                    type="button"
                    onClick={reloadVisits}
                    className={BTN_SECONDARY + ' mt-6'}
                  >
                    Try again
                  </button>
                </>
              ) : (
                <>
                  <h3 className="display-tight text-xl text-ink">
                    No visit is booked at the moment
                  </h3>
                  <p className="measure mt-3 text-sm text-ink-2">
                    CareLoop books a visit only when it offers one on a call and
                    you say yes.
                  </p>
                </>
              )}
              <Link to="/appointments" className={BTN_SECONDARY + ' mt-6'}>
                All appointments
              </Link>
            </Event>
          </Spine>
        </section>
      ) : null}
    </Screen>
  )
}
