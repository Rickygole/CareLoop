import { clockLabel } from '../lib/format.js'
import { doseMeta } from '../lib/dose.js'

const NODE = {
  done: 'bg-mild border-mild',
  now: 'bg-brand border-brand shadow-[0_0_0_5px_var(--color-brand-wash)]',
  later: 'bg-surface border-line-strong',
  ahead: 'bg-surface border-dashed border-line-strong',
}

const CARD_SKIN = {
  done: 'border border-line bg-sunken',
  now: 'border-2 border-brand bg-surface ledge-strong',
  later: 'border border-line-strong bg-surface',
  ahead: 'border border-line-strong bg-surface',
}

export function Spine({ children }) {
  return <ol className="mt-9 flex flex-col">{children}</ol>
}

export function Event({ time, state, tone = 'later', last, index, children }) {
  const skin = NODE[tone] || NODE.later

  return (
    <li
      className="enter-rise grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-4 pb-8 last:pb-0 sm:grid-cols-[7rem_2.5rem_minmax(0,1fr)] sm:gap-x-5"
      style={{ '--i': index || 0 }}
    >
      <p className="col-start-2 row-start-1 flex flex-wrap items-baseline gap-x-4 sm:col-start-1 sm:row-start-1 sm:block sm:pt-1 sm:text-right">
        <span className="numeric display-tight text-lg text-ink sm:block">
          {time}
        </span>
        <span className="text-sm text-ink-2 sm:block">{state}</span>
      </p>

      <span className="relative col-start-1 row-span-2 row-start-1 flex justify-center sm:col-start-2 sm:row-span-1">
        {last ? null : (
          <span
            aria-hidden="true"
            className="absolute bottom-[-2.5rem] top-2 w-[2px] bg-line-strong"
          />
        )}
        <span
          aria-hidden="true"
          className={
            'relative mt-1 h-[23px] w-[23px] shrink-0 rounded-full border-[3px] sm:mt-2 ' +
            skin
          }
        />
      </span>

      <div
        className={
          'col-start-2 row-start-2 mt-3 min-w-0 rounded-card px-4 py-4 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:px-7 sm:py-6 ' +
          (CARD_SKIN[tone] || CARD_SKIN.later)
        }
      >
        {children}
      </div>
    </li>
  )
}

export function CallHeading({ id, title, covers, mark }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
      <h3 id={id} className="display-tight text-xl text-ink">
        {title}
      </h3>
      {covers ? (
        <p className="text-sm font-semibold text-ink-2">{covers}</p>
      ) : null}
      {mark ? <div className="sm:ml-auto">{mark}</div> : null}
    </div>
  )
}

export function DoseRows({ doses, note }) {
  if (!doses || !doses.length) return null

  return (
    <ul className="mt-5 border-t border-line">
      {doses.map((dose) => {
        const meta = doseMeta(dose.status)
        const extra = note ? note(dose) : null

        return (
          <li
            key={dose.medication_id + dose.time}
            className="flex flex-wrap items-baseline gap-x-5 gap-y-2 border-b border-line py-3"
          >
            <span className="text-base font-semibold text-ink sm:min-w-[12rem]">
              {dose.medication}
              {dose.dosage ? ' ' + dose.dosage : ''}
            </span>
            <span className="numeric text-sm text-ink-2 sm:min-w-[5.5rem]">
              {clockLabel(dose.time)}
            </span>
            <span
              className={
                'inline-flex items-center gap-2 text-sm font-semibold ' +
                meta.tone
              }
            >
              <span aria-hidden="true" className="leading-none">
                {meta.glyph}
              </span>
              {meta.label}
            </span>
            {extra ? (
              <span className="text-sm text-ink-2 sm:ml-auto">{extra}</span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
