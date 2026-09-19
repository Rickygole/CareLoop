import { clockLabel } from '../lib/format.js'
import { MARK, ROW_GRID } from './Section.jsx'

const STATUS = {
  taken: {
    label: 'Taken',
    glyph: String.fromCharCode(10003),
    tone: 'text-mild',
  },
  due_now: {
    label: 'Due now',
    glyph: String.fromCharCode(9679),
    tone: 'text-brand-deep',
  },
  due_soon: {
    label: 'Due soon',
    glyph: String.fromCharCode(9675),
    tone: 'text-ink-2',
  },
  missed: {
    label: 'Missed',
    glyph: String.fromCharCode(9651),
    tone: 'text-severe',
  },
  upcoming: {
    label: 'Later today',
    glyph: String.fromCharCode(9675),
    tone: 'text-ink-2',
  },
}

export default function MedicationCard({ med, index }) {
  return (
    <li
      className={'enter-script border-t border-line py-7 ' + ROW_GRID}
      style={{ '--i': index }}
    >
      <p aria-hidden="true" className={MARK + ' sm:pt-2'}>
        {String(index + 1).padStart(2, '0')}
      </p>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h4 className="font-display text-xl font-semibold text-ink">
            {med.medication}
          </h4>
          <p className="numeric text-sm font-semibold text-ink-2">
            {med.dosage}
          </p>
        </div>

        <p className="measure mt-1.5 text-sm text-ink-2">
          {med.frequency ? med.frequency : 'As prescribed'}
          {med.prescriber ? '. Prescribed by ' + med.prescriber + '.' : '.'}
        </p>

        <ul className="mt-5 flex flex-wrap gap-x-9 gap-y-4">
          {med.doses.map((dose) => {
            const meta = STATUS[dose.status] || STATUS.upcoming
            return (
              <li key={dose.time} className="flex items-baseline gap-2.5">
                <span
                  aria-hidden="true"
                  className={'text-micro leading-none ' + meta.tone}
                >
                  {meta.glyph}
                </span>
                <span className="numeric text-sm font-semibold text-ink">
                  {clockLabel(dose.time)}
                </span>
                <span className={'smallcaps text-micro ' + meta.tone}>
                  {meta.label}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </li>
  )
}
