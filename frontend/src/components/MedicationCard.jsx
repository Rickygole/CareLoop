import { clockLabel } from '../lib/format.js'

export default function MedicationCard({ med, index, nextTime }) {
  return (
    <li
      className="enter-rise rounded-card border border-line bg-surface p-5 transition-shadow duration-150 ease-out hover:shadow-[0_8px_24px_-16px_rgba(22,25,29,0.4)]"
      style={{ '--i': index }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-lg font-semibold tracking-tight">{med.medication}</h3>
        <span className="text-sm text-ink-2">{med.dosage}</span>
      </div>

      <p className="mt-1 text-sm text-muted">
        {med.frequency}
        {med.prescriber ? ' \u00b7 ' + med.prescriber : ''}
      </p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {med.times.map((time) => {
          const isNext = time === nextTime
          return (
            <li key={time}>
              <span
                className={
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ' +
                  (isNext
                    ? 'border-brand/30 bg-brand-tint text-brand'
                    : 'border-line bg-sunken text-ink-2')
                }
              >
                <span aria-hidden="true" className="font-mono leading-none">
                  {isNext ? '>' : '\u00b7'}
                </span>
                {clockLabel(time)}
                {isNext ? <span className="sr-only">next dose</span> : null}
              </span>
            </li>
          )
        })}
      </ul>
    </li>
  )
}
