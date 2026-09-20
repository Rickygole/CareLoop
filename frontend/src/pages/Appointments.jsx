import { Link } from 'react-router-dom'

import { LoadFailed, Loading } from '../components/LoadState.jsx'
import Screen from '../components/Screen.jsx'
import { zoneLabel } from '../components/PortalShared.jsx'
import { Rule } from '../components/Block.jsx'
import { clockLabel, dateTimeLabel } from '../lib/format.js'
import { BTN_PRIMARY, SECTION } from '../lib/ui.js'
import { bookedVisits, unbookedVisits, useFollowups } from '../lib/useFollowups.js'
import { useSession } from '../lib/session.jsx'

const RING = String.fromCharCode(9679)

const KIND = {
  day_before: 'The day before',
  same_day: 'On the day',
}

function reminderLabel(kind) {
  return KIND[kind] || 'Reminder call'
}

function dayLabel(value) {
  const parts = String(value || '').slice(0, 10).split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return ''
  const day = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  if (Number.isNaN(day.getTime())) return ''
  return day.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function timeLabel(value) {
  const found = /T(\d{2}:\d{2})/.exec(String(value || ''))
  return found ? clockLabel(found[1]) : ''
}

function whenLabel(visit) {
  if (visit.status === 'booked') {
    if (visit.slot_local) return visit.slot_local
    const day = dayLabel(visit.starts_at || visit.slot)
    const time = timeLabel(visit.starts_at || visit.slot)
    if (day && time) return day + ' at ' + time
    return day || 'Time not given by the clinic'
  }
  const due = dayLabel(visit.due_date)
  return due ? 'Due by ' + due : 'No due date on the note'
}

function visitDay(visit) {
  return String(visit.starts_at || visit.slot || visit.due_date || '').slice(0, 10)
}

function byDay(a, b) {
  return visitDay(a).localeCompare(visitDay(b))
}

const COUNT_WORD = ['No', 'One', 'Two', 'Three', 'Four', 'Five']

function countWord(n) {
  return COUNT_WORD[n] || String(n)
}

function coverageLine(booked, unbooked) {
  if (!booked.length) return 'No visit has been booked in network yet.'
  const rest = unbooked.length
    ? ' ' +
      countWord(unbooked.length) +
      (unbooked.length === 1
        ? ' visit below could not be booked at all, and says why.'
        : ' visits below could not be booked at all, and each says why.')
    : ''
  if (booked.every((visit) => visit.in_network)) {
    return (
      (unbooked.length
        ? 'Every visit CareLoop booked was with a provider in network.'
        : 'Every visit below was booked with a provider in network.') + rest
    )
  }
  return 'Not every visit below is in network. Each visit says which.' + rest
}

function Marker({ booked }) {
  return (
    <span
      aria-hidden="true"
      className={
        'absolute left-0 top-[0.2rem] h-4 w-4 ' +
        (booked ? 'rounded-full bg-mild' : 'rotate-45 bg-moderate')
      }
    />
  )
}

function Reminders({ reminders }) {
  if (!reminders.length) {
    return (
      <p className="measure mt-6 text-sm text-ink-2">
        CareLoop has no reminder call planned for this visit.
      </p>
    )
  }

  return (
    <div className="mt-7">
      <p className="smallcaps text-micro text-clay">
        Reminder calls CareLoop would make
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {reminders.map((reminder) => (
          <li key={reminder.kind} className="flex items-baseline gap-3">
            <span aria-hidden="true" className="text-ink-2">
              {RING}
            </span>
            <span className="measure text-sm text-ink">
              <span className="font-semibold">
                {reminderLabel(reminder.kind)}
              </span>
              , planned for {dateTimeLabel(reminder.fire_at)} about{' '}
              {reminder.provider_name}.
            </span>
          </li>
        ))}
      </ul>
      <p className="measure mt-3 text-sm text-ink-2">
        Nothing in this prototype runs on a timer, so no reminder call will
        place itself. Please keep your own note of the visit.
      </p>
    </div>
  )
}

function Entry({ visit, last }) {
  const booked = visit.status === 'booked'

  return (
    <li className={'relative pl-9 ' + (last ? '' : 'pb-12')}>
      {last ? null : (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-[7px] top-7 w-px bg-line"
        />
      )}
      <Marker booked={booked} />

      <p
        className={
          'smallcaps text-micro ' + (booked ? 'text-mild' : 'text-moderate')
        }
      >
        {booked ? 'Booked' : 'Not booked'}
      </p>

      <h3 className="display-tight measure-tight mt-3 text-xl text-ink">
        {whenLabel(visit)}
      </h3>

      <p className="mt-3 text-lg font-semibold text-ink">
        {booked ? visit.provider_name : visit.specialty}
      </p>
      <p className="measure mt-1 text-sm text-ink-2">
        {booked
          ? visit.specialty +
            '. ' +
            (visit.in_network ? 'In network with ' : 'Out of network with ') +
            visit.payer_display +
            '.'
          : 'Asked for by ' + visit.prescriber + '.'}
      </p>

      <p className="measure mt-4 text-ink">{visit.reason}</p>

      {booked ? (
        <Reminders reminders={visit.reminders || []} />
      ) : (
        <div className="mt-6 border-l-4 border-l-clay pl-5">
          <p className="smallcaps text-micro text-clay">
            Why CareLoop did not book it
          </p>
          <p className="measure mt-2 text-ink">
            {visit.issue_detail || 'The clinic could not offer a time.'}
          </p>
          <p className="measure mt-3 text-sm text-ink-2">
            Nothing was booked and nothing was held. Your clinic decides what
            happens next.
          </p>
        </div>
      )}
    </li>
  )
}

export default function AppointmentsPage() {
  const { patientId, connected, restoring } = useSession()
  const { data, loading, failed, failure, reload } = useFollowups(
    patientId,
    connected,
  )

  if (restoring) {
    return (
      <Screen title="Appointments">
        <Loading what="Reading your records again after the page reloaded." />
      </Screen>
    )
  }

  if (!connected) {
    return (
      <Screen title="Appointments">
        <p className="measure text-ink-2">
          Choose your insurance to see the follow-up visits your prescriber
          asked for.
        </p>
        <Link to="/connect" className={BTN_PRIMARY + ' mt-7'}>
          Choose your insurance
        </Link>
      </Screen>
    )
  }

  const booked = bookedVisits(data)
  const unbooked = unbookedVisits(data)
  const timeline = booked.concat(unbooked).sort(byDay)
  const contactWindow = data && data.preferred_contact_window

  return (
    <Screen
      title="Appointments"
      lead={
        data
          ? 'Every follow-up visit your prescriber asked for, in the order it falls, and what CareLoop did about each one.'
          : undefined
      }
    >
      {loading ? <Loading what="Reading your appointments." /> : null}

      {failed ? (
        <LoadFailed
          what="The appointment list did not load."
          detail={failure}
          onRetry={reload}
        />
      ) : null}

      {!loading && !failed && data ? (
        <div>
          <section aria-labelledby="coverage-heading">
            <h2 id="coverage-heading" className="smallcaps text-micro text-clay">
              Your insurance
            </h2>
            <p className="display-tight mt-3 text-lg text-ink">
              {data.payer_display || 'No insurance on file'}
            </p>
            <p className="measure mt-4 text-ink">
              {coverageLine(booked, unbooked)}
            </p>
            {contactWindow ? (
              <p className="measure mt-3 text-sm text-ink-2">
                Calls only between {clockLabel(contactWindow.start)} and{' '}
                {clockLabel(contactWindow.end)},{' '}
                {zoneLabel(contactWindow.timezone)}.
              </p>
            ) : null}
            <Rule />
          </section>

          <section aria-labelledby="visits-heading" className={SECTION}>
            <h2 id="visits-heading" className="display text-2xl text-ink">
              What your prescriber asked for
            </h2>
            <Rule />
            {timeline.length ? (
              <ol className="mt-9">
                {timeline.map((visit, index) => (
                  <Entry
                    key={visit.note_id}
                    visit={visit}
                    last={index === timeline.length - 1}
                  />
                ))}
              </ol>
            ) : (
              <p className="measure mt-8 text-ink-2">
                No visit is booked at the moment.
              </p>
            )}
          </section>

          <section aria-labelledby="how-heading" className={SECTION}>
            <h2 id="how-heading" className="display text-2xl text-ink">
              How these were booked
            </h2>
            <Rule />
            <p className="measure mt-6 text-sm text-ink-2">{data.disclosure}</p>
            <Link to="/call" className={BTN_PRIMARY + ' mt-7'}>
              Go to the check-in
            </Link>
          </section>
        </div>
      ) : null}
    </Screen>
  )
}
