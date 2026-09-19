import Notice from './Notice.jsx'
import { Rule } from './Block.jsx'
import { humanizeTimes } from '../lib/narrate.js'
import { tierMeta } from './TierBadge.jsx'

function speakerLabel(eventType) {
  return eventType === 'CLINIC_DESK_SPEECH' ? 'Front desk' : 'CareLoop'
}

export default function ClinicCall({ events, booking, tier }) {
  if (!booking) {
    const level = String(tier || '').trim().toLowerCase()
    if (!level) return null
    const known = tierMeta(level)
    return (
      <section aria-labelledby="clinic-heading" className="mt-16">
        <h3 id="clinic-heading" className="display text-xl text-ink">
          No call to the clinic this time
        </h3>
        <Rule tone="sand" width="w-14" />
        <p className="measure mt-6 text-ink-2">
          {level === 'emergency'
            ? 'CareLoop never books an appointment for an emergency. An appointment is too slow, so it tells you to get help now and records the escalation it would send. Nobody is notified by this prototype.'
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

  return (
    <section aria-labelledby="clinic-heading" className="mt-16">
      <h3 id="clinic-heading" className="display text-xl text-ink">
        The call CareLoop made for you
      </h3>
      <Rule tone="sand" width="w-14" />

      <p className="measure mt-6 text-ink-2">
        You did not have to phone anyone. CareLoop ran the booking call with{' '}
        {booking.provider_name}, waited for the front desk, and took the time it
        was offered. The front desk on the other end was simulated, as the note
        below says.
      </p>

      <Notice tone="caution" word="Disclosed on the call" className="mt-7">
        {booking.disclosure}
      </Notice>

      <ol className="mt-8 flex flex-col gap-5">
        {turns.map((event, index) => {
          const desk = event.event_type === 'CLINIC_DESK_SPEECH'
          return (
            <li
              key={event.seq}
              className={
                'enter-rise ledge ledge-strong rounded-card border px-6 py-5 ' +
                (desk
                  ? 'border-line bg-sunken sm:ml-10'
                  : 'border-line bg-surface sm:mr-10')
              }
              style={{ '--i': index }}
            >
              <p className="smallcaps text-micro text-ink">
                {speakerLabel(event.event_type)}
              </p>
              <p className="measure mt-3 text-ink">
                {humanizeTimes(event.payload && event.payload.text)}
              </p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
