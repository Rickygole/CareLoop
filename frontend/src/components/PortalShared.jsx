import { clockLabel } from '../lib/format.js'

export function zoneLabel(zone) {
  const name = String(zone || '')
    .split('/')
    .pop()
  return name ? name.replace(/_/g, ' ') + ' time' : 'local time'
}

export default function PortalShared({ allergies, window: contactWindow }) {
  const list = allergies || []
  if (!list.length && !contactWindow) return null

  return (
    <section
      aria-labelledby="shared-heading"
      className="rounded-card bg-sunken px-6 py-6"
    >
      <h2 id="shared-heading" className="display-tight text-lg text-ink">
        Also came across from MyHealth
      </h2>

      <h3 className="smallcaps mt-6 text-micro text-ink-2">Allergies</h3>
      {list.length ? (
        <ul className="mt-3 flex flex-col gap-3">
          {list.map((item) => (
            <li key={item.substance}>
              <p className="text-sm font-semibold text-ink">{item.substance}</p>
              <p className="mt-1 text-sm text-ink-2">
                Reaction: {item.reaction}. Recorded as {item.criticality}{' '}
                importance.
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-2">
          MyHealth reports no allergies on this record.
        </p>
      )}

      {contactWindow ? (
        <>
          <h3 className="smallcaps mt-7 text-micro text-ink-2">
            When CareLoop may call
          </h3>
          <p className="mt-3 text-sm text-ink-2">
            {clockLabel(contactWindow.start)} to {clockLabel(contactWindow.end)}
            , {zoneLabel(contactWindow.timezone)}.
          </p>
        </>
      ) : null}
    </section>
  )
}
