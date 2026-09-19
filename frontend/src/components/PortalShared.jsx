import { clockLabel } from '../lib/format.js'
import { CARD } from '../lib/ui.js'

export default function PortalShared({ allergies, window: contactWindow }) {
  const list = allergies || []
  if (!list.length && !contactWindow) return null

  return (
    <section
      aria-labelledby="shared-heading"
      className={CARD + ' mt-8 px-6 py-7'}
    >
      <h2 id="shared-heading" className="display-tight text-lg text-ink">
        Also came across from MyHealth
      </h2>

      <h3 className="smallcaps mt-6 text-micro text-clay">Allergies</h3>
      {list.length ? (
        <ul className="mt-3 flex flex-col gap-3">
          {list.map((item) => (
            <li
              key={item.substance}
              className="rounded-card border border-line bg-sunken px-4 py-3"
            >
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
          <h3 className="smallcaps mt-7 text-micro text-clay">
            When CareLoop may call
          </h3>
          <p className="mt-3 text-sm text-ink-2">
            {clockLabel(contactWindow.start)} to {clockLabel(contactWindow.end)}
            , {contactWindow.timezone}. CareLoop schedules no call outside that
            window.
          </p>
        </>
      ) : null}
    </section>
  )
}
