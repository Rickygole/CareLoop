import DoseChip from './DoseChip.jsx'
import { CARD } from '../lib/ui.js'

export default function MedicationCard({ med, index }) {
  return (
    <li
      className={'enter-script ' + CARD + ' px-7 py-7 sm:px-8'}
      style={{ '--i': index }}
    >
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <h4 className="display-tight text-xl text-ink">{med.medication}</h4>
        <p className="numeric text-lg font-bold text-clay">{med.dosage}</p>
      </div>

      <p className="measure mt-2 text-sm text-ink-2">
        {med.frequency ? med.frequency : 'As prescribed'}
        {med.prescriber ? '. Prescribed by ' + med.prescriber + '.' : '.'}
      </p>

      <p className="smallcaps mt-7 text-micro text-clay">CareLoop calls at</p>

      <ul className="mt-4 flex flex-wrap gap-3">
        {med.doses.map((dose) => (
          <li key={dose.time}>
            <DoseChip dose={dose} />
          </li>
        ))}
      </ul>
    </li>
  )
}
