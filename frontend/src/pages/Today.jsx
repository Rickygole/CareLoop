import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import Notice from '../components/Notice.jsx'
import Screen from '../components/Screen.jsx'
import { CallHeading, DoseRows, Event, Spine } from '../components/DaySpine.jsx'
import { Glance, GlanceTile } from '../components/DayGlance.jsx'
import { InteractionPin } from '../components/InteractionFlags.jsx'
import { LoadFailed, Loading, RefreshFailed } from '../components/LoadState.jsx'
import { Rule } from '../components/Block.jsx'
import { applyClockShift } from '../lib/clock.js'
import { clockLabel } from '../lib/format.js'
import {
  BTN_HERO,
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD,
  LINK,
  SECTION,
} from '../lib/ui.js'
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

function coveredLine(event) {
  const names = []
  for (const dose of (event && event.doses) || []) {
    if (!names.includes(dose.medication)) names.push(dose.medication)
  }
  if (!names.length) return ''
  if (names.length === 1) return 'Covers your ' + names[0] + '.'
  return (
    'Covers your ' +
    names.slice(0, -1).join(', ') +
    ' and ' +
    names[names.length - 1] +
    '.'
  )
}

function attentionLine(notConfirmed, flagged) {
  const parts = []
  if (notConfirmed) {
    parts.push(
      notConfirmed +
        (notConfirmed === 1 ? ' dose not confirmed' : ' doses not confirmed'),
    )
  }
  if (flagged) {
    parts.push(flagged + (flagged === 1 ? ' pair flagged' : ' pairs flagged'))
  }
  return parts.join(', ')
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
  const nextEvent = nextIndex === -1 ? null : events[nextIndex]
  const gutter = visit ? visitGutter(visit) : null
  const notConfirmed = ((plan && plan.doses) || []).filter(
    (dose) => dose.status === 'missed',
  ).length
  const flaggedCount = ((regimen && regimen.surfaced) || []).length
  const needsYou = notConfirmed + flaggedCount

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
        <div>
          <section aria-labelledby="day-heading">
            <h2 id="day-heading" className="display text-2xl text-ink">
              {dayLabel(plan)}
            </h2>

            <Glance>
              <GlanceTile
                index={0}
                tone={nextEvent ? 'now' : 'quiet'}
                label="Next call"
                value={
                  nextEvent
                    ? clockLabel(nextEvent.time)
                    : events.length
                      ? 'None left today'
                      : 'No calls today'
                }
                detail={
                  nextEvent
                    ? coveredLine(nextEvent)
                    : events.length
                      ? 'Every call planned for today is behind you.'
                      : 'There is nothing on this record to ring you about.'
                }
              />

              <GlanceTile
                index={1}
                tone={needsYou ? 'alert' : 'clear'}
                label="Needs you"
                value={
                  needsYou
                    ? attentionLine(notConfirmed, flaggedCount)
                    : 'Nothing so far'
                }
                detail={
                  needsYou
                    ? flaggedCount
                      ? 'What the pair is, and where it came from, is set out under Medications.'
                      : 'A dose from earlier today was never confirmed to CareLoop.'
                    : 'Every dose so far is confirmed, and no pair on your list is flagged.'
                }
              >
                {flaggedCount ? (
                  <Link to="/meds" className={LINK + ' mt-1 text-sm'}>
                    Read the flagged pair
                  </Link>
                ) : null}
              </GlanceTile>

              <GlanceTile
                index={2}
                tone={visitsFailed ? 'caution' : 'quiet'}
                label="Next appointment"
                value={
                  gutter
                    ? gutter.time + ', ' + gutter.state
                    : visitsLoading
                      ? 'Being read'
                      : visitsFailed
                        ? 'Not loaded'
                        : 'None booked'
                }
                detail={
                  visit
                    ? visit.specialty + ' with ' + visit.provider_name + '.'
                    : visitsLoading
                      ? 'CareLoop is asking your insurer for it.'
                      : visitsFailed
                        ? 'That read failed, which does not mean you have none.'
                        : 'CareLoop books one only when you say yes on a call.'
                }
              />
            </Glance>
          </section>

          <section aria-labelledby="calls-heading" className={SECTION}>
            <h2 id="calls-heading" className="display text-2xl text-ink">
              Your calls today
            </h2>
            <Rule />

            <Spine>
              {events.length ? null : (
                <Event index={0} time="Today" state="No calls" tone="ahead" last>
                  <h3 className="display-tight text-xl text-ink">
                    There are no calls on today's list
                  </h3>
                  <p className="measure mt-3 text-sm text-ink-2">
                    There are no medicines on this record, so CareLoop has
                    nothing to ring you about. If that is wrong, refresh the
                    record from your insurer.
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
                const tone = done
                  ? 'done'
                  : missed
                    ? 'alert'
                    : next
                      ? 'now'
                      : 'later'
                const state = done
                  ? 'Done'
                  : missed
                    ? 'Not confirmed'
                    : next
                      ? 'Next'
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
                    last={!closing && index === events.length - 1}
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
                  last
                  index={events.length}
                  time="Done"
                  state="Today"
                  tone="ahead"
                >
                  <h3 className="display-tight text-xl text-ink">
                    No call is left today
                  </h3>
                  <p className="measure mt-3 text-sm text-ink-2">
                    Every call CareLoop planned for today is behind you. The
                    next one is on tomorrow's list.
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
            </Spine>
          </section>

          <section aria-labelledby="ahead-heading" className={SECTION}>
            <h2 id="ahead-heading" className="display text-2xl text-ink">
              Coming up
            </h2>
            <Rule />

            <div className={CARD + ' mt-8 px-6 py-7 sm:px-8'}>
              {visit ? (
                <>
                  <p className="smallcaps text-micro text-mild">Booked</p>
                  <h3 className="display-tight mt-3 text-xl text-ink">
                    {visit.provider_name}, {visit.specialty}
                  </h3>
                  <p className="measure mt-3 text-base text-ink">
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
              <Link to="/appointments" className={BTN_SECONDARY + ' mt-7'}>
                All appointments
              </Link>
            </div>
          </section>
        </div>
      ) : null}
    </Screen>
  )
}
