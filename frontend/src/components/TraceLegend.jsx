import { styleFor } from '../lib/trace.js'

const GROUPS = [
  {
    title: 'Deterministic rules',
    types: ['TIER_0_CHECK', 'TIER_0_MATCH', 'EMERGENCY_ESCALATION'],
  },
  {
    title: 'Model',
    types: ['NORMALIZE', 'TIER_1_CLASSIFY'],
  },
  {
    title: 'Call and actions',
    types: [
      'PATIENT_SPEECH',
      'AGENT_SPEECH',
      'ACTION_DECIDED',
      'TOOL_CALL',
      'BOOKING_CONFIRMED',
    ],
  },
]

export default function TraceLegend() {
  return (
    <section className="overflow-hidden rounded-card border border-console-line bg-console-panel">
      <h2 className="border-b border-console-line bg-console-chrome px-5 py-2.5 font-mono text-2xs font-bold uppercase tracking-[0.18em] text-console-ink">
        Reading the trace
      </h2>

      <div className="space-y-4 p-5">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="font-mono text-micro uppercase text-console-muted">
              {group.title}
            </h3>
            <ul className="mt-1.5 space-y-1">
              {group.types.map((type) => (
                <li key={type} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-[2px] shrink-0"
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

      <p className="border-t border-console-line px-5 py-4 text-2xs leading-relaxed text-console-muted">
        Warm hues are the deterministic floor and the human voice. Cool hues
        are the model and the plumbing. Tier 0 cannot be lowered by Tier 1, and
        an emergency match makes no model call at all, which is why it comes
        back fastest.
      </p>
    </section>
  )
}
