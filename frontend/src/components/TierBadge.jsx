const TIERS = {
  mild: {
    label: 'Mild',
    text: 'text-mild',
    bg: 'bg-mild-tint',
    border: 'border-mild/30',
    glyph: 'o',
  },
  moderate: {
    label: 'Moderate',
    text: 'text-moderate',
    bg: 'bg-moderate-tint',
    border: 'border-moderate/30',
    glyph: '=',
  },
  severe: {
    label: 'Severe',
    text: 'text-severe',
    bg: 'bg-severe-tint',
    border: 'border-severe/30',
    glyph: '^',
  },
  emergency: {
    label: 'Emergency',
    text: 'text-emergency',
    bg: 'bg-emergency-tint',
    border: 'border-emergency/40',
    glyph: '!',
  },
}

export function tierMeta(tier) {
  return TIERS[String(tier || '').toLowerCase()] || TIERS.moderate
}

export default function TierBadge({ tier, size = 'md' }) {
  const meta = tierMeta(tier)
  const scale =
    size === 'sm' ? 'text-2xs px-2 py-0.5' : 'text-xs px-2.5 py-1'

  return (
    <span
      className={
        'inline-flex items-center gap-1.5 rounded-full border font-medium uppercase tracking-wide ' +
        scale +
        ' ' +
        meta.bg +
        ' ' +
        meta.text +
        ' ' +
        meta.border
      }
    >
      <span aria-hidden="true" className="font-mono leading-none">
        {meta.glyph}
      </span>
      {meta.label}
    </span>
  )
}
