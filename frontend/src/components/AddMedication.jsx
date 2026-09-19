import { useState } from 'react'

import Notice from './Notice.jsx'
import { ADDABLE_MEDICATIONS, ADD_PRESCRIBER } from '../data/medications.js'
import { clockLabel } from '../lib/format.js'
import { BTN_PRIMARY, SELECT } from '../lib/ui.js'

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
    <form onSubmit={submit} className="mt-9">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-6">
        <div>
          <label
            htmlFor="new-medication"
            className="smallcaps block text-micro text-clay"
          >
            Medicine
          </label>
          <select
            id="new-medication"
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            className={SELECT + ' mt-3'}
          >
            {ADDABLE_MEDICATIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.medication} {item.dosage_text}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={busy} className={BTN_PRIMARY}>
          {busy ? 'Adding...' : 'Add to the list'}
        </button>
      </div>

      <p className="measure mt-5 text-sm text-ink-2">
        {entry.medication} {entry.dosage_text}, {entry.frequency}, due at{' '}
        {hourList(entry.preferred_hours)}. Prescribed by {ADD_PRESCRIBER}.
      </p>

      {error ? (
        <Notice
          role="alert"
          tone="alarm"
          word="The medicine was not added"
          className="enter-fade measure mt-6"
          size="sm"
        >
          CareLoop could not reach the record just now. Your list is unchanged.
          Press Add to the list to try again.
        </Notice>
      ) : null}
    </form>
  )
}
