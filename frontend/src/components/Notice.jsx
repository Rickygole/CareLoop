const TONES = {
  info: {
    word: 'Note',
    glyph: String.fromCharCode(9679),
    skin: 'border-brand bg-brand-wash',
    ledge: 'ledge-strong',
    accent: 'text-brand',
  },
  good: {
    word: 'All clear',
    glyph: String.fromCharCode(10003),
    skin: 'border-mild bg-mild-tint',
    ledge: 'ledge-strong',
    accent: 'text-mild',
  },
  caution: {
    word: 'Heads up',
    glyph: String.fromCharCode(9651),
    skin: 'border-moderate bg-moderate-tint',
    ledge: 'ledge-strong',
    accent: 'text-moderate',
  },
  alarm: {
    word: 'Problem',
    glyph: String.fromCharCode(9670),
    skin: 'border-emergency bg-emergency-tint',
    ledge: 'ledge-strong',
    accent: 'text-emergency',
  },
  quiet: {
    word: '',
    glyph: String.fromCharCode(8213),
    skin: 'border-line bg-sunken',
    ledge: 'ledge-strong',
    accent: 'text-ink-2',
  },
}

export default function Notice({
  tone = 'info',
  word,
  role,
  size = 'base',
  className = '',
  children,
}) {
  const meta = TONES[tone] || TONES.info
  const heading = word === undefined ? meta.word : word

  return (
    <div
      role={role}
      className={
        'ledge rounded-card border px-6 py-5 ' +
        meta.skin +
        ' ' +
        meta.ledge +
        ' ' +
        className
      }
    >
      {heading ? (
        <p className={'flex items-center gap-3 ' + meta.accent}>
          <span aria-hidden="true" className="text-[1.15em] leading-none">
            {meta.glyph}
          </span>
          <span className="smallcaps text-micro">{heading}</span>
        </p>
      ) : null}
      <div
        className={
          'measure text-ink ' +
          (heading ? 'mt-3 ' : '') +
          (size === 'sm' ? 'text-sm' : '')
        }
      >
        {children}
      </div>
    </div>
  )
}
