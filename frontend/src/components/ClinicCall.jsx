function speakerLabel(eventType) {
  return eventType === 'CLINIC_DESK_SPEECH' ? 'Front desk' : 'CareLoop'
}

export default function ClinicCall({ events, booking, tier }) {
  const turns = (events || []).filter(
    (event) =>
      event.event_type === 'CLINIC_AGENT_SPEECH' ||
      event.event_type === 'CLINIC_DESK_SPEECH',
  )

  if (!booking) {
    const emergency = String(tier || '').toLowerCase() === 'emergency'
    return (
      <section
        aria-label="Clinic call"
        className="rounded-card border border-dashed border-console-line bg-console-panel/60 p-6"
      >
        <h2 className="font-mono text-2xs font-bold uppercase tracking-[0.18em] text-console-muted">
          Clinic call
        </h2>
        <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-console-ink-2">
          {tier
            ? emergency
              ? 'Emergency path. CareLoop does not book on an emergency by design; it escalates.'
              : 'No clinic call was needed for this tier. CareLoop only calls the clinic to book a moderate or severe visit.'
            : 'Nothing has run yet. On a moderate or severe result, the simulated clinic call and its transcript appear here.'}
        </p>
      </section>
    )
  }

  return (
    <section
      aria-label="Clinic call"
      className="enter-rise overflow-hidden rounded-card border border-console-line bg-console-panel"
    >
      <div className="border-b border-console-line bg-console-chrome px-5 py-2.5">
        <h2 className="font-mono text-2xs font-bold uppercase tracking-[0.18em] text-console-ink">
          Clinic call
        </h2>
      </div>

      <p className="border-b border-console-line bg-dark-moderate/8 px-5 py-3 text-sm leading-relaxed text-console-ink-2">
        {booking.disclosure}
      </p>

      <ol className="space-y-3 p-5">
        {turns.map((event, index) => {
          const clinic = event.event_type === 'CLINIC_DESK_SPEECH'
          return (
            <li
              key={event.seq}
              className={'enter-rise flex ' + (clinic ? 'justify-end' : 'justify-start')}
              style={{ '--i': index * 2 }}
            >
              <div
                className={
                  'max-w-[34rem] rounded-card border px-4 py-3 ' +
                  (clinic
                    ? 'border-console-line-2 bg-console-inset text-console-ink-2'
                    : 'border-console-accent/30 bg-console-accent/10 text-console-ink')
                }
              >
                <p className="font-mono text-micro uppercase tracking-[0.14em] text-console-muted">
                  {speakerLabel(event.event_type)}
                </p>
                <p className="mt-1 text-sm leading-relaxed">
                  {event.payload && event.payload.text}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
