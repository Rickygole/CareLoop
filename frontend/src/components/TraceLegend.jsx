import { styleFor } from '../lib/trace.js'

const GROUPS = [
  {
    title: 'Tier 0, deterministic rules',
    types: ['TIER_0_CHECK', 'TIER_0_MATCH', 'EMERGENCY_ESCALATION'],
  },
  {
    title: 'Tier 1, model',
    types: ['NORMALIZE', 'TIER_1_CLASSIFY'],
  },
  {
    title: 'Call and actions',
    types: ['PATIENT_SPEECH', 'AGENT_SPEECH', 'ACTION_DECIDED', 'TOOL_CALL', 'BOOKING_CONFIRMED'],
  },
]

export default function TraceLegend() {
  return (
    <section className="rounded-card border border-console-line bg-console p-5">
      <h2 className="text-sm font-semibold">Reading the trace</h2>

      <div className="mt-4 space-y-4">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="font-mono text-2xs uppercase tracking-wide text-console-muted">
              {group.title}
            </h3>
            <ul className="mt-1.5 space-y-1">
              {group.types.map((type) => (
                <li key={type} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: styleFor(type).color }}
                  />
                  <span
                    className="font-mono text-2xs"
                    style={{ color: styleFor(type).color }}
                  >
                    {type}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-4 border-t border-console-line pt-3 text-xs leading-relaxed text-console-muted">
        Tier 0 is a deterministic safety floor and cannot be lowered by the
        model. An emergency match makes no model call at all, which is why it
        comes back fastest.
      </p>
    </section>
  )
}
