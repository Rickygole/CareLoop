import { SECTION } from '../lib/ui.js'
import { humanizeTimes } from '../lib/narrate.js'
import { tierMeta } from './TierBadge.jsx'

function speakerLabel(eventType) {
  return eventType === 'CLINIC_DESK_SPEECH' ? 'Front desk' : 'CareLoop'
}

function textOf(event) {
  return String((event.payload && event.payload.text) || '')
}

function bookingTurnIndex(turns) {
  let found = -1
  turns.forEach((event, index) => {
    if (
      event.event_type === 'CLINIC_DESK_SPEECH' &&
      /booked with/i.test(textOf(event))
    ) {
      found = index
    }
  })
  return found
}

function Disclosure({ text, className = '' }) {
  return (
    <div className={className}>
      <p className="smallcaps text-micro text-ink-2">About this call</p>
      <p className="measure mt-2 text-sm text-ink-2">{text}</p>
      <p className="measure mt-2 text-sm text-ink-2">
        No confirmation was sent to anyone. The front desk here is simulated,
        so nothing left this prototype.
      </p>
    </div>
  )
}

export default function ClinicCall({ events, booking, tier }) {
  if (!booking) {
    const level = String(tier || '').trim().toLowerCase()
    if (!level) return null
    const known = tierMeta(level)
    return (
      <section aria-labelledby="clinic-heading" className={SECTION}>
        <h2 id="clinic-heading" className="display text-xl text-ink">
          No call to the clinic this time
        </h2>
        <p className="measure mt-4 text-ink-2">
          {level === 'emergency'
            ? 'CareLoop never books an appointment for an emergency. An appointment is too slow, so it tells you to get help now and writes down the alert it would send. Nobody is notified by this prototype.'
            : known
              ? 'CareLoop only rings the clinic when what you said means you should be seen. Nothing you said today needed that, so it did not take up an appointment.'
              : 'CareLoop did not ring the clinic, because it did not reach a decision it was willing to act on. No appointment exists. If you think you should be seen, please phone your clinic yourself.'}
        </p>
      </section>
    )
  }

  const turns = (events || []).filter(
    (event) =>
      event.event_type === 'CLINIC_AGENT_SPEECH' ||
      event.event_type === 'CLINIC_DESK_SPEECH',
  )
  const bookedAt = bookingTurnIndex(turns)

  return (
    <section aria-labelledby="clinic-heading" className={SECTION}>
      <h2 id="clinic-heading" className="display text-xl text-ink">
        The call CareLoop made for you
      </h2>

      <p className="measure mt-4 text-ink-2">
        You did not have to phone anyone. CareLoop ran the booking call with{' '}
        {booking.provider_name}, waited for the front desk, and took the time it
        was offered. The front desk on the other end was simulated, as the note
        below says.
      </p>

      <ol className="mt-8 flex flex-col gap-5">
        {turns.map((event, index) => {
          const desk = event.event_type === 'CLINIC_DESK_SPEECH'

          if (index === bookedAt) {
            return (
              <li
                key={event.seq}
                className="enter-rise border-l-4 border-l-brand pl-5 sm:pl-6"
                style={{ '--i': index }}
              >
                <p className="smallcaps text-micro text-brand">
                  The front desk booked it
                </p>
                <p className="display-tight measure mt-2 text-lg text-ink">
                  {humanizeTimes(textOf(event))}
                </p>
                <Disclosure text={booking.disclosure} className="mt-6" />
              </li>
            )
          }

          return (
            <li
              key={event.seq}
              className={'enter-rise ' + (desk ? 'sm:pl-14' : '')}
              style={{ '--i': index }}
            >
              <p
                className={
                  'smallcaps text-micro ' + (desk ? 'text-ink-2' : 'text-ink')
                }
              >
                {speakerLabel(event.event_type)}
              </p>
              <p className="measure mt-2 text-ink">
                {humanizeTimes(textOf(event))}
              </p>
            </li>
          )
        })}
      </ol>

      {bookedAt === -1 ? (
        <Disclosure text={booking.disclosure} className="mt-9" />
      ) : null}
    </section>
  )
}
