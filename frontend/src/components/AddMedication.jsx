import { useState } from 'react'

import { ADDABLE_MEDICATIONS, ADD_PRESCRIBER } from '../data/medications.js'
import { clockLabel } from '../lib/format.js'

function hourList(hours) {
  return hours
    .map((hour) => clockLabel(String(hour).padStart(2, '0') + ':00'))
    .join(', ')
}

export default function AddMedication({ busy, error, onAdd }) {
  const [choice, setChoice] = useState(ADDABLE_MEDICATIONS[0].id)
  const entry =
    ADDABLE_MEDICATIONS.find((item) => item.id === choice) ||
    ADDABLE_MEDICATIONS[0]

  const submit = (event) => {
    event.preventDefault()
    if (busy) return
    onAdd(entry)
  }

  return (
    <form onSubmit={submit} className="mt-8">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-5">
        <div>
          <label
            htmlFor="new-medication"
            className="smallcaps block text-micro text-muted"
          >
            Medicine
          </label>
          <select
            id="new-medication"
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            className="field-select mt-2.5 min-h-[52px] rounded-control border-2 border-line-strong bg-surface px-5 py-2.5 text-sm font-medium text-ink"
          >
            {ADDABLE_MEDICATIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.medication} {item.dosage_text}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="min-h-[56px] rounded-control bg-brand px-8 py-3.5 text-sm font-semibold text-white shadow-raised transition-[background-color,transform] duration-200 ease-out hover:bg-brand-deep active:translate-y-px disabled:bg-muted disabled:shadow-none"
        >
          {busy ? 'Adding...' : 'Add to the list'}
        </button>
      </div>

      <p className="measure mt-4 text-xs text-muted">
        {entry.medication} {entry.dosage_text}, {entry.frequency}, due at{' '}
        {hourList(entry.preferred_hours)}. Prescribed by {ADD_PRESCRIBER}.
      </p>

      {error ? (
        <p
          role="alert"
          className="measure enter-fade mt-5 flex items-start gap-3 border-l-4 border-emergency bg-emergency-tint px-5 py-4 text-sm text-emergency"
        >
          <span aria-hidden="true" className="leading-[1.6]">
            {String.fromCharCode(9651)}
          </span>
          <span>
            <strong className="font-semibold">
              The medicine was not added.
            </strong>{' '}
            CareLoop could not reach the record just now. Your list is unchanged.
            Press Add to the list to try again.
          </span>
        </p>
      ) : null}
    </form>
  )
}
