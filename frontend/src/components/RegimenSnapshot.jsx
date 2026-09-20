import { useState } from 'react'

import { BTN_QUIET } from '../lib/ui.js'

export default function RegimenSnapshot({ hash, previousHash, count, flash }) {
  const [open, setOpen] = useState(false)

  if (!hash) return null

  return (
    <section
      aria-labelledby="snapshot-heading"
      className={'mt-10 text-ink ' + (flash ? 'trace-flash' : '')}
    >
      <h2 id="snapshot-heading" className="display-tight text-lg text-ink">
        Which version of your list this is
      </h2>
      <p className="measure mt-3 text-ink-2">
        CareLoop saved this list of {count}{' '}
        {count === 1 ? 'medicine' : 'medicines'} as a version of its own. If the
        list changes, CareLoop saves a new version, so every call can be tied
        back to the exact list it was made against.
      </p>

      <button
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        aria-expanded={open}
        aria-controls="snapshot-code"
        className={BTN_QUIET + ' mt-5'}
      >
        {open ? 'Hide the version code' : 'Show the version code'}
      </button>

      <div id="snapshot-code" hidden={!open} className="mt-5">
        <p className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <span className="numeric font-mono text-lg font-semibold text-ink">
            {hash}
          </span>
          {previousHash && previousHash !== hash ? (
            <span className="numeric font-mono text-xs text-ink-2">
              replaces {previousHash}
            </span>
          ) : null}
        </p>
        <p className="measure mt-3 text-sm text-ink-2">
          A fingerprint of the list, for engineers. Nothing you need to read
          or remember.
        </p>
      </div>
    </section>
  )
}
