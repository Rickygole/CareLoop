import { Link } from 'react-router-dom'

import Notice from '../components/Notice.jsx'
import { LoadFailed, Loading } from '../components/LoadState.jsx'
import Screen from '../components/Screen.jsx'
import { Rule } from '../components/Block.jsx'
import { clockLabel, dateTimeLabel } from '../lib/format.js'
import { BTN_PRIMARY, BTN_SECONDARY, CARD } from '../lib/ui.js'
import { bookedVisits, unbookedVisits, useFollowups } from '../lib/useFollowups.js'
import { useSession } from '../lib/session.jsx'

const CHECK = String.fromCharCode(10003)
const RING = String.fromCharCode(9679)

const KIND = {
  day_before: 'The day before',
  same_day: 'On the day',
}

function reminderLabel(kind) {
  return KIND[kind] || 'Reminder call'
}

function Visit({ visit }) {
  const reminders = visit.reminders || []

  return (
    <li className={CARD + ' px-6 py-6 sm:px-8'}>
      <p className="flex items-center gap-3 text-mild">
        <span aria-hidden="true" className="text-[1.1em] leading-none">
          {CHECK}
        </span>
        <span className="smallcaps text-micro">Booked</span>
      </p>

      <h3 className="display-tight mt-3 text-xl text-ink">
        {visit.provider_name}
      </h3>
      <p className="mt-1 text-sm text-ink-2">{visit.specialty}</p>
      <p className="numeric mt-4 text-lg font-semibold text-ink">
        {visit.slot_local}
      </p>

      <dl className="mt-5 flex flex-col gap-3">
        <div>
          <dt className="smallcaps text-micro text-clay">Reason</dt>
          <dd className="measure mt-1 text-sm text-ink">{visit.reason}</dd>
        </div>
        <div>
          <dt className="smallcaps text-micro text-clay">Network</dt>
          <dd className="mt-1 text-sm text-ink">
            {visit.in_network ? 'In network with ' : 'Out of network with '}
            {visit.payer_display}
          </dd>
        </div>
      </dl>

      {reminders.length ? (
        <div className="mt-6 rounded-card border border-line bg-sunken px-5 py-4">
          <p className="smallcaps text-micro text-clay">Reminder calls scheduled</p>
          <ul className="mt-3 flex flex-col gap-3">
            {reminders.map((reminder) => (
              <li key={reminder.kind} className="flex items-baseline gap-3">
                <span aria-hidden="true" className="text-ink-2">
                  {RING}
                </span>
                <span className="text-sm text-ink">
                  <span className="font-semibold">
                    {reminderLabel(reminder.kind)}
                  </span>
                  , scheduled for {dateTimeLabel(reminder.fire_at)} about{' '}
                  {reminder.provider_name}.
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-6 text-sm text-ink-2">
          No reminder call is scheduled for this visit.
        </p>
      )}
    </li>
  )
}

function NotBooked({ visit }) {
  return (
    <li>
      <Notice tone="caution" word="Not booked">
        <p className="text-ink">
          <strong className="font-semibold">{visit.specialty}</strong>, asked
          for by {visit.prescriber}
          {visit.due_date ? ', due by ' + visit.due_date : ''}.
        </p>
        <p className="measure mt-3 text-sm text-ink">
          {visit.issue_detail || 'The clinic could not offer a time.'}
        </p>
        <p className="measure mt-3 text-sm text-ink-2">
          Nothing was booked and nothing was held. Your clinic decides what
          happens next.
        </p>
      </Notice>
    </li>
  )
}

export default function AppointmentsPage() {
  const { patientId, connected } = useSession()
  const { data, loading, failed, failure, reload } = useFollowups(
    patientId,
    connected,
  )

  if (!connected) {
    return (
      <Screen title="Appointments">
        <p className="measure text-ink-2">
          Connect MyHealth to see the follow-up visits your prescriber asked
          for.
        </p>
        <Link to="/connect" className={BTN_PRIMARY + ' mt-7'}>
          Connect MyHealth
        </Link>
      </Screen>
    )
  }

  const booked = bookedVisits(data)
  const unbooked = unbookedVisits(data)
  const contactWindow = data && data.preferred_contact_window

  return (
    <Screen title="Appointments">
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
          <section aria-labelledby="coverage-heading" className={CARD + ' px-6 py-6 sm:px-8'}>
            <h2 id="coverage-heading" className="smallcaps text-micro text-clay">
              Coverage
            </h2>
            <p className="mt-3 text-xl font-semibold text-ink">
              {data.payer_display || 'No payer on file'}
            </p>
            <p className="numeric mt-1 text-sm text-ink-2">{data.payer_id}</p>
            <p className="measure mt-4 text-sm text-ink">
              {booked.length
                ? booked.every((visit) => visit.in_network)
                  ? 'Every visit below was booked with a provider in network.'
                  : 'Not every visit below is in network. Each card says which.'
                : 'No visit has been booked in network yet.'}
            </p>
            {contactWindow ? (
              <p className="measure mt-4 text-sm text-ink-2">
                Calls only between {clockLabel(contactWindow.start)} and{' '}
                {clockLabel(contactWindow.end)}, {contactWindow.timezone}.
              </p>
            ) : null}
          </section>

          <section aria-labelledby="booked-heading" className="mt-12">
            <h2 id="booked-heading" className="display text-2xl text-ink">
              Upcoming visits
            </h2>
            <Rule />
            {booked.length ? (
              <ul className="mt-8 flex flex-col gap-6">
                {booked.map((visit) => (
                  <Visit key={visit.note_id} visit={visit} />
                ))}
              </ul>
            ) : (
              <p className="measure mt-8 text-ink-2">
                No visit is booked at the moment.
              </p>
            )}
          </section>

          {unbooked.length ? (
            <section aria-labelledby="unbooked-heading" className="mt-12">
              <h2 id="unbooked-heading" className="display text-2xl text-ink">
                Asked for, not booked
              </h2>
              <Rule />
              <p className="measure mt-6 text-ink-2">
                These were requested by a prescriber and CareLoop could not
                book them. The reason is written out rather than hidden.
              </p>
              <ul className="mt-8 flex flex-col gap-6">
                {unbooked.map((visit) => (
                  <NotBooked key={visit.note_id} visit={visit} />
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="how-heading" className="mt-12">
            <h2 id="how-heading" className="display text-2xl text-ink">
              How these were booked
            </h2>
            <Rule />
            <p className="measure mt-6 text-sm text-ink-2">{data.disclosure}</p>
            <Link to="/call" className={BTN_SECONDARY + ' mt-7'}>
              Go to the check-in
            </Link>
          </section>
        </div>
      ) : null}
    </Screen>
  )
}
