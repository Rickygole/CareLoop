const TONES = {
  info: {
    word: 'Note',
    glyph: String.fromCharCode(9679),
    skin: 'border-l-brand bg-brand-wash',
    accent: 'text-brand',
  },
  good: {
    word: 'All clear',
    glyph: String.fromCharCode(10003),
    skin: 'border-l-mild bg-mild-tint',
    accent: 'text-mild',
  },
  caution: {
    word: 'Heads up',
    glyph: String.fromCharCode(9651),
    skin: 'border-l-moderate bg-moderate-tint',
    accent: 'text-moderate',
  },
  alarm: {
    word: 'Problem',
    glyph: String.fromCharCode(9670),
    skin: 'border-l-emergency bg-emergency-tint',
    accent: 'text-emergency',
  },
  quiet: {
    word: '',
    glyph: String.fromCharCode(8213),
    skin: 'border-l-line-strong bg-sunken',
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
        'rounded-card border-l-4 px-5 py-4 sm:px-6 sm:py-5 ' +
        meta.skin +
        ' ' +
        className
      }
    >
      {heading ? (
        <p className={'flex items-center gap-2.5 ' + meta.accent}>
          <span aria-hidden="true" className="text-[1.1em] leading-none">
            {meta.glyph}
          </span>
          <span className="smallcaps text-micro">{heading}</span>
        </p>
      ) : null}
      <div
        className={
          'measure text-ink ' +
          (heading ? 'mt-2.5 ' : '') +
          (size === 'sm' ? 'text-sm' : '')
        }
      >
        {children}
      </div>
    </div>
  )
}
