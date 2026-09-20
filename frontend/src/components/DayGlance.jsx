const TONES = {
  now: {
    accent: 'text-brand',
    glyph: String.fromCharCode(9679),
  },
  alert: {
    accent: 'text-severe',
    glyph: String.fromCharCode(9651),
  },
  caution: {
    accent: 'text-moderate',
    glyph: String.fromCharCode(9651),
  },
  clear: {
    accent: 'text-mild',
    glyph: String.fromCharCode(10003),
  },
  quiet: {
    accent: 'text-ink-2',
    glyph: String.fromCharCode(9675),
  },
}

export function Glance({ children }) {
  return (
    <ul className="mt-6 grid overflow-hidden rounded-card border border-line sm:grid-cols-3">
      {children}
    </ul>
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
      className="enter-rise border-b border-line px-6 py-6 last:border-b-0 sm:border-b-0 sm:border-r sm:px-7 sm:py-7 sm:last:border-r-0"
      style={{ '--i': index }}
    >
      <p className={'smallcaps flex items-center gap-2.5 text-micro ' + meta.accent}>
        <span aria-hidden="true" className="text-[1.05em] leading-none">
          {meta.glyph}
        </span>
        {label}
      </p>
      <p className="display-tight numeric mt-3 text-xl text-ink">{value}</p>
      {detail ? (
        <p className="mt-2 text-sm leading-[1.5] text-ink-2">{detail}</p>
      ) : null}
      {children}
    </li>
  )
}
