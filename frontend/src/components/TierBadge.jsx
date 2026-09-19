const TIERS = {
  mild: {
    term: 'Mild',
    label: 'Nothing urgent',
    headline: 'Nothing urgent today',
    glyph: '○',
    shape: 'a circle',
    text: 'text-mild',
    bg: 'bg-mild-tint',
    border: 'border-mild/45',
    rail: '#1a5c3a',
    darkText: 'text-dark-mild',
    darkBg: 'bg-dark-mild/12',
    darkBorder: 'border-dark-mild/40',
    darkRail: '#5fd4b8',
    meaning:
      'CareLoop found nothing that needs a clinician. It noted what you said and will ask again on the next call.',
  },
  moderate: {
    term: 'Moderate',
    label: 'Worth a visit',
    headline: 'This is worth a visit',
    glyph: '△',
    shape: 'a triangle',
    text: 'text-moderate',
    bg: 'bg-moderate-tint',
    border: 'border-moderate/45',
    rail: '#7a4a05',
    darkText: 'text-dark-moderate',
    darkBg: 'bg-dark-moderate/12',
    darkBorder: 'border-dark-moderate/40',
    darkRail: '#f0b757',
    meaning:
      'Someone should look at this. CareLoop phoned the clinic and booked the appointment for you.',
  },
  severe: {
    term: 'Severe',
    label: 'Needs a visit soon',
    headline: 'You need to be seen soon',
    glyph: '◆',
    shape: 'a diamond',
    text: 'text-severe',
    bg: 'bg-severe-tint',
    border: 'border-severe/45',
    rail: '#963205',
    darkText: 'text-dark-severe',
    darkBg: 'bg-dark-severe/12',
    darkBorder: 'border-dark-severe/40',
    darkRail: '#ffa06b',
    meaning:
      'This should not wait. CareLoop phoned the clinic and booked the soonest appointment it could get.',
  },
  emergency: {
    term: 'Emergency',
    label: 'Get help now',
    headline: 'Get help right now',
    glyph: '●',
    shape: 'a filled circle',
    text: 'text-emergency',
    bg: 'bg-emergency-tint',
    border: 'border-emergency/50',
    rail: '#9e1c13',
    darkText: 'text-dark-emergency',
    darkBg: 'bg-dark-emergency/14',
    darkBorder: 'border-dark-emergency/50',
    darkRail: '#ff8a80',
    meaning:
      'CareLoop does not book an appointment for an emergency. It tells you to get help now and alerts your care team.',
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
      ? 'text-micro px-3 py-1.5 gap-2'
      : 'text-2xs px-4 py-2 gap-2.5'

  return (
    <span
      className={
        'inline-flex items-center rounded-full border-2 font-semibold ' +
        scale +
        ' ' +
        (dark
          ? meta.darkBg + ' ' + meta.darkText + ' ' + meta.darkBorder
          : meta.bg + ' ' + meta.text + ' ' + meta.border)
      }
    >
      <span aria-hidden="true" className="text-[0.78em] leading-none">
        {meta.glyph}
      </span>
      {meta.label}
    </span>
  )
}
