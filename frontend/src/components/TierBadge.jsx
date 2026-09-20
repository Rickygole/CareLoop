const TIERS = {
  mild: {
    term: 'Mild',
    label: 'Nothing urgent',
    headline: 'Nothing urgent today',
    glyph: String.fromCharCode(9675),
    shape: 'a circle',
    text: 'text-mild',
    bg: 'bg-mild-tint',
    border: 'border-mild',
    rail: 'var(--color-mild)',
    darkText: 'text-dark-mild',
    darkBg: 'bg-dark-mild/12',
    darkBorder: 'border-dark-mild/40',
    darkRail: 'var(--color-dark-mild)',
    meaning:
      'CareLoop found nothing that needs a clinician. It noted what you said and will ask again on the next call.',
  },
  moderate: {
    term: 'Moderate',
    label: 'Worth a visit',
    headline: 'This is worth a visit',
    glyph: String.fromCharCode(9651),
    shape: 'a triangle',
    text: 'text-moderate',
    bg: 'bg-moderate-tint',
    border: 'border-moderate',
    rail: 'var(--color-moderate)',
    darkText: 'text-dark-moderate',
    darkBg: 'bg-dark-moderate/12',
    darkBorder: 'border-dark-moderate/40',
    darkRail: 'var(--color-dark-moderate)',
    meaning: 'Someone should look at this, and not in a hurry.',
  },
  severe: {
    term: 'Severe',
    label: 'Needs a visit soon',
    headline: 'You need to be seen soon',
    glyph: String.fromCharCode(9670),
    shape: 'a diamond',
    text: 'text-severe',
    bg: 'bg-severe-tint',
    border: 'border-severe',
    rail: 'var(--color-severe)',
    darkText: 'text-dark-severe',
    darkBg: 'bg-dark-severe/12',
    darkBorder: 'border-dark-severe/40',
    darkRail: 'var(--color-dark-severe)',
    meaning: 'This should not wait. You need to be seen soon.',
  },
  emergency: {
    term: 'Emergency',
    label: 'Get help now',
    headline: 'Get help right now',
    glyph: String.fromCharCode(9679),
    shape: 'a filled circle',
    text: 'text-emergency',
    bg: 'bg-emergency-tint',
    border: 'border-emergency',
    rail: 'var(--color-emergency)',
    darkText: 'text-dark-emergency',
    darkBg: 'bg-dark-emergency/14',
    darkBorder: 'border-dark-emergency/50',
    darkRail: 'var(--color-dark-emergency)',
    meaning:
      'CareLoop never books an appointment for an emergency, because an appointment is too slow. It tells you to get help now and writes down the alert it would send. It has told nobody.',
  },
}

export function tierMeta(tier) {
  const key = String(tier || '').trim().toLowerCase()
  return Object.prototype.hasOwnProperty.call(TIERS, key) ? TIERS[key] : null
}

export const UNDECIDED = {
  headline: 'CareLoop could not decide this time',
  meaning:
    'CareLoop did not come back with an answer it is willing to stand behind, so it is not guessing one. Please contact your clinic yourself. If this is an emergency, call 911. If you are in crisis, call or text 988.',
  glyph: String.fromCharCode(9633),
  shape: 'a square',
  rail: 'var(--color-ink)',
}

const SCALE = {
  sm: 'min-h-[44px] px-4 py-1.5 text-2xs gap-2.5',
  md: 'min-h-[48px] px-5 py-2 text-sm gap-3',
}

export default function TierBadge({ tier, size = 'md', tone = 'light' }) {
  const meta = tierMeta(tier)
  const dark = tone === 'dark'
  const scale = SCALE[size] || SCALE.md

  if (!meta) {
    return (
      <span
        className={
          'inline-flex items-center rounded-control border font-semibold ' +
          scale +
          ' ' +
          (dark
            ? 'border-console-line-2 text-console-ink'
            : 'border-line-strong text-ink')
        }
      >
        <span aria-hidden="true" className="text-[1.15em] leading-none">
          {UNDECIDED.glyph}
        </span>
        No decision
      </span>
    )
  }

  return (
    <span
      className={
        'inline-flex items-center rounded-control border font-semibold ' +
        scale +
        ' ' +
        (dark
          ? meta.darkBg + ' ' + meta.darkText + ' ' + meta.darkBorder
          : meta.bg + ' ' + meta.border + ' text-ink')
      }
    >
      <span
        aria-hidden="true"
        className={'text-[1.25em] leading-none ' + (dark ? '' : meta.text)}
      >
        {meta.glyph}
      </span>
      {meta.label}
    </span>
  )
}
