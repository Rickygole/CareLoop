import { MARGIN_GRID } from './Section.jsx'

export default function Screen({ mark, label, title, lead, children }) {
  return (
    <div className={MARGIN_GRID + ' pt-12 sm:pt-16'}>
      <p
        aria-hidden="true"
        className="font-display numeric hidden text-right text-3xl font-semibold leading-none text-brand sm:block"
      >
        {mark}
      </p>

      <div className="min-w-0">
        <p className="smallcaps text-micro text-brand-deep">
          <span
            aria-hidden="true"
            className="font-display mr-3 text-lg font-semibold normal-case tracking-normal text-brand sm:hidden"
          >
            {mark}
          </span>
          {label}
        </p>
        <h1 className="font-display mt-3 border-b-2 border-line-ink pb-3 text-3xl font-semibold text-ink">
          {title}
        </h1>
        {lead ? <p className="measure mt-6 text-ink-2">{lead}</p> : null}
        {children}
      </div>
    </div>
  )
}
