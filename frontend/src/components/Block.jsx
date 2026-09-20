import { SECTION } from '../lib/ui.js'

export function Eyebrow({ children, tone = 'muted' }) {
  const colour =
    tone === 'ocean' ? 'text-brand' : tone === 'clay' ? 'text-clay' : 'text-ink-2'

  return <p className={'smallcaps text-micro ' + colour}>{children}</p>
}

export function Rule() {
  return <span aria-hidden="true" className="mt-6 block h-px w-full bg-line" />
}

export default function Block({ id, eyebrow, title, lead, tone, children }) {
  const headingId = id + '-heading'

  return (
    <section aria-labelledby={headingId} id={id} className={SECTION}>
      {eyebrow ? <Eyebrow tone={tone}>{eyebrow}</Eyebrow> : null}
      <h2
        id={headingId}
        className={'display text-xl text-ink ' + (eyebrow ? 'mt-3' : '')}
      >
        {title}
      </h2>
      {lead ? <p className="measure mt-4 text-ink-2">{lead}</p> : null}
      {children}
    </section>
  )
}
