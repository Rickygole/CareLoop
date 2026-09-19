import { clockTime, styleFor, summarize } from '../lib/trace.js'
import { LANES, laneFor } from '../lib/loop.js'

function LaneGutter({ lane }) {
  const clinic = lane.id === LANES.clinic.id
  return (
    <span
      aria-hidden="true"
      className="relative w-7 shrink-0"
      title={lane.label}
    >
      <span className="absolute inset-y-0 left-[7px] w-px bg-console-line" />
      <span className="absolute inset-y-0 left-[19px] w-px bg-console-line" />
      <span
        className="absolute top-[7px] size-[7px] rounded-full"
        style={{
          background: lane.color,
          left: clinic ? '16px' : '4px',
        }}
      />
    </span>
  )
}

export default function TraceLine({ event, dimmed, isNew }) {
  const style = styleFor(event.event_type)
  const lane = laneFor(event.event_type)
  const clinic = lane.id === LANES.clinic.id
  const faded = dimmed && !style.noFade
  const flash = isNew && style.flash

  return (
    <li
      className={
        'relative flex items-stretch py-[3px] pl-2 pr-4 transition-opacity duration-300 hover:bg-white/[0.03] ' +
        (flash ? 'trace-flash ' : '') +
        (isNew ? 'enter-trace ' : '') +
        (style.bold
          ? 'bg-dark-emergency/8 '
          : clinic
            ? 'bg-[#4FA8C9]/[0.045] '
            : '') +
        (faded ? 'opacity-55' : 'opacity-100')
      }
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[2px]"
        style={{
          background: style.color,
          opacity: style.accent ? 0.95 : 0.3,
        }}
      />

      <span className="numeric w-9 shrink-0 pr-2.5 text-right text-[#4b5462]">
        {event.seq}
      </span>
      <LaneGutter lane={lane} />
      <span className="numeric shrink-0 pl-2 pr-4 text-console-muted">
        {clockTime(event.timestamp)}
      </span>
      <span
        className={
          'w-[12.5rem] shrink-0 pr-4 tracking-[0.01em] ' +
          (style.bold ? 'font-bold' : 'font-medium')
        }
        style={{ color: style.color }}
      >
        {event.event_type}
      </span>
      <span
        className={
          'min-w-0 flex-1 break-words ' +
          (style.bold ? 'font-bold text-dark-emergency' : 'text-console-ink')
        }
      >
        <span className="sr-only">{lane.label + ': '}</span>
        {summarize(event)}
      </span>
    </li>
  )
}
