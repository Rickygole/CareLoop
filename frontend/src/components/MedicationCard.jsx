import DoseChip from './DoseChip.jsx'

export default function MedicationCard({ med, index }) {
  return (
    <li
      className="enter-script border-b border-line py-5 last:border-b-0 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] sm:items-start sm:gap-x-8 sm:py-6"
      style={{ '--i': index }}
    >
      <div className="min-w-0">
        <h3 className="display-tight text-lg text-ink">
          {med.medication}{' '}
          <span className="numeric font-semibold text-ink-2">{med.dosage}</span>
        </h3>
        <p className="measure mt-1 text-sm text-ink-2">
          {med.frequency ? med.frequency : 'As prescribed'}
          {med.prescriber ? '. Prescribed by ' + med.prescriber + '.' : '.'}
        </p>
      </div>

      <ul className="mt-3 flex flex-wrap gap-2 sm:mt-0">
        {med.doses.map((dose) => (
          <li key={dose.time}>
            <DoseChip dose={dose} />
          </li>
        ))}
      </ul>
    </li>
  )
}
