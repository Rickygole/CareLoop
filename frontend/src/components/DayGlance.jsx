import { CARD } from '../lib/ui.js'

const TONES = {
  now: {
    rail: 'border-l-brand',
    accent: 'text-brand',
    glyph: String.fromCharCode(9679),
  },
  alert: {
    rail: 'border-l-severe',
    accent: 'text-severe',
    glyph: String.fromCharCode(9651),
  },
  caution: {
    rail: 'border-l-moderate',
    accent: 'text-moderate',
    glyph: String.fromCharCode(9651),
  },
  clear: {
    rail: 'border-l-mild',
    accent: 'text-mild',
    glyph: String.fromCharCode(10003),
  },
  quiet: {
    rail: 'border-l-line-strong',
    accent: 'text-ink-2',
    glyph: String.fromCharCode(9675),
  },
}

export function Glance({ children }) {
  return (
    <ul className="mt-7 grid gap-4 sm:grid-cols-3 sm:gap-5">{children}</ul>
  )
}

export function GlanceTile({
  tone = 'quiet',
  label,
  value,
  detail,
  index = 0,
  children,
}) {
  const meta = TONES[tone] || TONES.quiet

  return (
    <li
      className={'enter-rise ' + CARD + ' border-l-4 px-6 py-5 ' + meta.rail}
      style={{ '--i': index }}
    >
      <p className={'smallcaps flex items-center gap-2 text-micro ' + meta.accent}>
        <span aria-hidden="true" className="text-[1.1em] leading-none">
          {meta.glyph}
        </span>
        {label}
      </p>
      <p className="display-tight numeric mt-3 text-lg text-ink">{value}</p>
      {detail ? <p className="mt-2 text-sm text-ink-2">{detail}</p> : null}
      {children}
    </li>
  )
}
