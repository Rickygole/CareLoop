import { clockLabel } from '../lib/format.js'

const STATUS_LABEL = {
  taken: 'Taken',
  due_soon: 'Due soon',
  due_now: 'Due now',
  missed: 'Missed',
  upcoming: 'Upcoming',
}

const STATUS_STYLE = {
  taken: 'border-mild/40 bg-mild-tint text-mild',
  due_soon: 'border-line-strong bg-surface text-ink-2',
  due_now: 'border-brand bg-brand text-white',
  missed: 'border-severe/40 bg-severe-tint text-severe',
  upcoming: 'border-line-strong bg-surface text-ink-2',
}

export default function MedicationCard({ med, index }) {
  return (
    <li
      className="enter-rise group relative flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-[box-shadow,border-color,transform] duration-200 ease-out hover:-translate-y-px hover:border-line-strong hover:shadow-lift"
      style={{ '--i': index }}
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-ink">{med.medication}</h3>
          <span className="numeric shrink-0 rounded-md bg-sunken px-2 py-0.5 text-2xs font-medium text-ink-2">
            {med.dosage}
          </span>
        </div>

        <p className="mt-1.5 text-sm text-muted">
          {med.frequency}
          {med.prescriber ? ' · ' + med.prescriber : ''}
        </p>
      </div>

      <div className="border-t border-line bg-surface-2 px-5 py-4">
        <p className="text-micro font-semibold uppercase text-muted">
          Doses today
        </p>
        <ul className="mt-2.5 flex flex-wrap gap-2">
          {med.doses.map((dose) => (
            <li key={dose.time}>
              <span
                className={
                  'numeric inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-medium ' +
                  (STATUS_STYLE[dose.status] || STATUS_STYLE.upcoming)
                }
              >
                <span className="text-micro font-semibold uppercase opacity-80">
                  {STATUS_LABEL[dose.status] || dose.status}
                </span>
                {clockLabel(dose.time)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </li>
  )
}
