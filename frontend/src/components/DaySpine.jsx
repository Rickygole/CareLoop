import { clockLabel } from '../lib/format.js'
import { doseMeta } from '../lib/dose.js'

const NODE = {
  done: 'bg-mild border-mild',
  now: 'bg-brand border-brand shadow-[0_0_0_5px_var(--color-brand-wash)]',
  alert: 'bg-severe border-severe shadow-[0_0_0_5px_var(--color-severe-tint)]',
  later: 'bg-surface border-line-strong',
  ahead: 'bg-surface border-dashed border-line-strong',
}

const STATE_TONE = {
  done: 'text-ink-2',
  now: 'font-semibold text-brand',
  alert: 'font-semibold text-severe',
  later: 'text-ink-2',
  ahead: 'text-ink-2',
}

const CARD_SKIN = {
  done: 'px-0 py-0',
  now: 'ledge-strong rounded-card border border-brand bg-surface px-4 py-5 sm:px-7 sm:py-7',
  alert:
    'rounded-card border border-line border-l-4 border-l-severe bg-surface px-4 py-5 sm:px-7 sm:py-6',
  later: 'px-0 py-0',
  ahead: 'px-0 py-0',
}

export function Spine({ children }) {
  return <ol className="mt-8 flex flex-col">{children}</ol>
}

export function Event({ time, state, tone = 'later', last, index, children }) {
  const skin = NODE[tone] || NODE.later
  const flat = tone !== 'now' && tone !== 'alert'

  return (
    <li
      className={
        'enter-rise grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[6rem_2rem_minmax(0,1fr)] sm:gap-x-5 ' +
        (last ? 'pb-0' : 'pb-10 sm:pb-12')
      }
      style={{ '--i': index || 0 }}
    >
      <p className="col-start-2 row-start-1 flex flex-wrap items-baseline gap-x-4 sm:col-start-1 sm:row-start-1 sm:block sm:pt-0.5 sm:text-right">
        <span className="numeric display-tight text-lg text-ink sm:block">
          {time}
        </span>
        <span
          className={
            'text-sm sm:mt-0.5 sm:block ' +
            (STATE_TONE[tone] || STATE_TONE.later)
          }
        >
          {state}
        </span>
      </p>

      <span className="relative col-start-1 row-span-2 row-start-1 flex justify-center sm:col-start-2 sm:row-span-1">
        {last ? null : (
          <span
            aria-hidden="true"
            className="absolute bottom-[-3.5rem] top-3 w-px bg-line"
          />
        )}
        <span
          aria-hidden="true"
          className={
            'relative mt-1.5 h-[18px] w-[18px] shrink-0 rounded-full border-[3px] ' +
            skin
          }
        />
      </span>

      <div
        className={
          'col-start-2 row-start-2 min-w-0 sm:col-start-3 sm:row-start-1 ' +
          (flat ? 'mt-2 sm:mt-0 ' : 'mt-3 sm:mt-0 ') +
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
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h3 id={id} className="display-tight text-lg text-ink">
        {title}
      </h3>
      {covers ? <p className="text-sm text-ink-2">{covers}</p> : null}
      {mark ? <div className="sm:ml-auto">{mark}</div> : null}
    </div>
  )
}

export function DoseRows({ doses, note }) {
  if (!doses || !doses.length) return null

  return (
    <ul className="mt-4 max-w-[44rem] border-t border-line">
      {doses.map((dose) => {
        const meta = doseMeta(dose.status)
        const extra = note ? note(dose) : null

        return (
          <li
            key={dose.medication_id + dose.time}
            className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-line py-3"
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
              <span className="text-sm text-ink-2">{extra}</span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
