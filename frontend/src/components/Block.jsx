export function Eyebrow({ children, tone = 'clay' }) {
  const colour =
    tone === 'ocean'
      ? 'text-brand'
      : tone === 'muted'
        ? 'text-ink-2'
        : 'text-clay'

  return (
    <p className={'smallcaps text-micro ' + colour}>
      {children}
    </p>
  )
}

export function Rule({ tone = 'sand', width = 'w-20' }) {
  const colour =
    tone === 'ocean'
      ? 'bg-brand'
      : tone === 'clay'
        ? 'bg-clay'
        : tone === 'cream'
          ? 'bg-brand-ink-2'
          : 'bg-sand'

  return (
    <span
      aria-hidden="true"
      className={'mt-5 block h-[6px] rounded-full ' + colour + ' ' + width}
    />
  )
}

export default function Block({ id, eyebrow, title, lead, tone, children }) {
  const headingId = id + '-heading'

  return (
    <section aria-labelledby={headingId} id={id} className="mt-20">
      {eyebrow ? <Eyebrow tone={tone}>{eyebrow}</Eyebrow> : null}
      <h2
        id={headingId}
        className={
          'display text-2xl text-ink ' + (eyebrow ? 'mt-3' : '')
        }
      >
        {title}
      </h2>
      <Rule tone={tone === 'ocean' ? 'ocean' : 'sand'} />
      {lead ? <p className="measure mt-6 text-ink-2">{lead}</p> : null}
      {children}
    </section>
  )
}
