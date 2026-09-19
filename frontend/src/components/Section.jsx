export const MARGIN_GRID =
  'sm:grid sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-8'

export const ROW_GRID = 'sm:grid sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-x-6'

export const MARK =
  'numeric mb-2 block text-left text-micro font-semibold text-muted sm:mb-0 sm:text-right'

export default function Section({ mark, label, title, lead, id, children }) {
  const headingId = id + '-heading'

  return (
    <section
      aria-labelledby={headingId}
      id={id}
      className={MARGIN_GRID + ' mt-20 sm:mt-24'}
    >
      <p
        aria-hidden="true"
        className="font-display numeric hidden text-right text-3xl font-semibold leading-none text-brand sm:block"
      >
        {mark}
      </p>

      <div className="min-w-0">
        {label ? (
          <p className="smallcaps text-micro text-muted">
            <span
              aria-hidden="true"
              className="font-display mr-3 text-lg font-semibold normal-case tracking-normal text-brand sm:hidden"
            >
              {mark}
            </span>
            {label}
          </p>
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
