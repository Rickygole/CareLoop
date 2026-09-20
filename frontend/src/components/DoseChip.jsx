import { clockLabel } from '../lib/format.js'
import { doseMeta } from '../lib/dose.js'

const SKIN = {
  taken: 'border-transparent bg-mild-tint',
  due_now: 'border-brand bg-brand-wash',
  due_soon: 'border-transparent bg-sunken',
  missed: 'border-severe bg-severe-tint',
  upcoming: 'border-transparent bg-sunken',
}

export default function DoseChip({ dose, size = 'base' }) {
  const meta = doseMeta(dose.status)
  const skin = SKIN[dose.status] || SKIN.upcoming

  return (
    <span
      className={
        'inline-flex items-center gap-2.5 rounded-control border font-semibold text-ink ' +
        skin +
        ' ' +
        (size === 'sm'
          ? 'min-h-[44px] px-3.5 py-1.5 text-2xs'
          : 'min-h-[46px] px-4 py-2 text-sm')
      }
    >
      <span aria-hidden="true" className={'leading-none ' + meta.tone}>
        {meta.glyph}
      </span>
      <span className="numeric font-semibold">{clockLabel(dose.time)}</span>
      <span className="text-ink-2">{meta.label}</span>
    </span>
  )
}
