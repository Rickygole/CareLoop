import { clockLabel } from '../lib/format.js'
import { doseMeta } from '../lib/dose.js'

const SKIN = {
  taken: 'border-mild-edge bg-mild-tint',
  due_now: 'border-brand bg-brand-tint',
  due_soon: 'border-edge-strong bg-sunken',
  missed: 'border-severe-edge bg-severe-tint',
  upcoming: 'border-edge-strong bg-sunken',
}

export default function DoseChip({ dose, size = 'base' }) {
  const meta = doseMeta(dose.status)
  const skin = SKIN[dose.status] || SKIN.upcoming

  return (
    <span
      className={
        'inline-flex items-center gap-3 rounded-control border-2 font-semibold text-ink ' +
        skin +
        ' ' +
        (size === 'sm'
          ? 'min-h-[40px] px-4 py-1.5 text-2xs'
          : 'min-h-[48px] px-5 py-2 text-sm')
      }
    >
      <span aria-hidden="true" className={'leading-none ' + meta.tone}>
        {meta.glyph}
      </span>
      <span className="numeric font-bold">{clockLabel(dose.time)}</span>
      <span className="text-ink-2">{meta.label}</span>
    </span>
  )
}
