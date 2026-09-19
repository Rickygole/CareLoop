import { humanizeTimes } from '../lib/narrate.js'

function speakerLabel(eventType) {
  return eventType === 'CLINIC_DESK_SPEECH' ? 'Front desk' : 'CareLoop'
}

export default function ClinicCall({ events, booking, tier }) {
  if (!booking) return null

  const turns = (events || []).filter(
    (event) =>
      event.event_type === 'CLINIC_AGENT_SPEECH' ||
      event.event_type === 'CLINIC_DESK_SPEECH',
  )

  return (
    <section aria-labelledby="clinic-heading" className="mt-14">
      <h3
        id="clinic-heading"
        className="font-display border-b-2 border-line-ink pb-3 text-xl font-semibold text-ink"
      >
        The call CareLoop made for you
      </h3>

      <p className="measure mt-5 text-ink-2">
        You did not have to phone anyone. CareLoop rang{' '}
        {booking.provider_name}, waited for the front desk, and booked the
        appointment while you got on with your day.
      </p>

      <p className="mt-6 flex items-start gap-3 border-l-4 border-moderate bg-moderate-tint px-5 py-4 text-sm text-ink">
        <span aria-hidden="true" className="leading-[1.6] text-moderate">
          {String.fromCharCode(9651)}
        </span>
        <span className="measure">{booking.disclosure}</span>
      </p>

      <ol className="mt-8 border-t border-line">
        {turns.map((event, index) => {
          const desk = event.event_type === 'CLINIC_DESK_SPEECH'
          return (
            <li
              key={event.seq}
              className="enter-rise grid grid-cols-1 gap-x-8 gap-y-1.5 border-b border-line py-5 sm:grid-cols-[7rem_minmax(0,1fr)]"
              style={{ '--i': index }}
            >
              <p
                className={
                  'pt-0.5 text-xs font-semibold sm:text-right ' +
                  (desk ? 'text-muted' : 'text-brand')
                }
              >
                {speakerLabel(event.event_type)}
              </p>
              <p className="measure text-sm text-ink">
                {humanizeTimes(event.payload && event.payload.text)}
              </p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
