import { clockTime, styleFor, summarize } from '../lib/trace.js'

export default function TraceLine({ event, dimmed, isNew }) {
  const style = styleFor(event.event_type)
  const faded = dimmed && !style.noFade
  const flash = isNew && style.flash

  return (
    <li
      className={
        'flex gap-3 px-4 py-1 transition-opacity duration-300 ' +
        (flash ? 'trace-flash ' : '') +
        (faded ? 'opacity-70' : 'opacity-100')
      }
    >
      <span className="w-10 shrink-0 text-right text-console-muted tabular-nums">
        {event.seq}
      </span>
      <span className="shrink-0 text-console-muted tabular-nums">
        {clockTime(event.timestamp)}
      </span>
      <span
        className={'w-52 shrink-0 ' + (style.bold ? 'font-bold' : '')}
        style={{ color: style.color }}
      >
        {event.event_type}
      </span>
      <span
        className={
          'min-w-0 break-words ' +
          (style.bold ? 'font-bold text-[#FF8A8A]' : 'text-console-ink')
        }
      >
        {summarize(event)}
      </span>
    </li>
  )
}
