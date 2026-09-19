const TIERS = {
  mild: {
    label: 'Mild',
    glyph: '\u25cb',
    text: 'text-mild',
    bg: 'bg-mild-tint',
    border: 'border-mild/25',
    darkText: 'text-dark-mild',
    darkBg: 'bg-dark-mild/12',
    darkBorder: 'border-dark-mild/35',
    rail: '#0f766e',
    darkRail: '#5eead4',
  },
  moderate: {
    label: 'Moderate',
    glyph: '\u25b3',
    text: 'text-moderate',
    bg: 'bg-moderate-tint',
    border: 'border-moderate/25',
    darkText: 'text-dark-moderate',
    darkBg: 'bg-dark-moderate/12',
    darkBorder: 'border-dark-moderate/35',
    rail: '#8f5405',
    darkRail: '#fbbf24',
  },
  severe: {
    label: 'Severe',
    glyph: '\u25c6',
    text: 'text-severe',
    bg: 'bg-severe-tint',
    border: 'border-severe/25',
    darkText: 'text-dark-severe',
    darkBg: 'bg-dark-severe/12',
    darkBorder: 'border-dark-severe/35',
    rail: '#ab3f0b',
    darkRail: '#fb923c',
  },
  emergency: {
    label: 'Emergency',
    glyph: '\u25cf',
    text: 'text-emergency',
    bg: 'bg-emergency-tint',
    border: 'border-emergency/30',
    darkText: 'text-dark-emergency',
    darkBg: 'bg-dark-emergency/14',
    darkBorder: 'border-dark-emergency/45',
    rail: '#b42318',
    darkRail: '#ff7a70',
  },
}

export function tierMeta(tier) {
  return TIERS[String(tier || '').toLowerCase()] || TIERS.moderate
}

export default function TierBadge({ tier, size = 'md', tone = 'light' }) {
  const meta = tierMeta(tier)
  const dark = tone === 'dark'
  const scale =
    size === 'sm'
      ? 'text-micro px-2 py-[3px] gap-1.5'
      : 'text-2xs px-2.5 py-1 gap-2'

  return (
    <span
      className={
        'inline-flex items-center rounded-full border font-semibold uppercase ' +
        scale +
        ' ' +
        (dark
          ? meta.darkBg + ' ' + meta.darkText + ' ' + meta.darkBorder
          : meta.bg + ' ' + meta.text + ' ' + meta.border)
      }
      style={{ letterSpacing: '0.06em' }}
    >
      <span
        aria-hidden="true"
        className="text-[0.7em] leading-none opacity-80"
        style={{ transform: 'translateY(-0.5px)' }}
      >
        {meta.glyph}
      </span>
      {meta.label}
    </span>
  )
}
