export const MARGIN_GRID =
  'grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-x-10'

export function Margin({ children, className = '' }) {
  return (
    <div
      className={
        'numeric pt-1 text-right text-micro font-semibold uppercase text-muted ' +
        className
      }
    >
      {children}
    </div>
  )
}

export default function Section({ mark, label, title, lead, id, children }) {
  const headingId = id + '-heading'

  return (
    <section aria-labelledby={headingId} id={id} className={MARGIN_GRID + ' mt-20'}>
      <div
        aria-hidden="true"
        className="font-display numeric text-right text-2xl font-semibold leading-none text-brand sm:text-3xl"
      >
        {mark}
      </div>

      <div className="min-w-0">
        {label ? (
          <p className="smallcaps text-micro text-muted">{label}</p>
        ) : null}
        <h2
          id={headingId}
          className="font-display mt-2 border-b-2 border-line-ink pb-2 text-2xl font-semibold text-ink"
        >
          {title}
        </h2>
        {lead ? <p className="measure mt-5 text-ink-2">{lead}</p> : null}
        {children}
      </div>
    </section>
  )
}
