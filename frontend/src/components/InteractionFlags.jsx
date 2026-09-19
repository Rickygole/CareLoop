import { useState } from 'react'

import { Rule } from './Block.jsx'

const SEVERITY = {
  contraindicated: {
    word: 'Should not be taken together',
    glyph: String.fromCharCode(9679),
    text: 'text-emergency',
    skin: 'border-emergency bg-emergency-tint',
  },
  major: {
    word: 'Major interaction',
    glyph: String.fromCharCode(9670),
    text: 'text-severe',
    skin: 'border-severe bg-severe-tint',
  },
  moderate: {
    word: 'Moderate interaction',
    glyph: String.fromCharCode(9651),
    text: 'text-moderate',
    skin: 'border-moderate bg-moderate-tint',
  },
  minor: {
    word: 'Minor interaction',
    glyph: String.fromCharCode(9675),
    text: 'text-ink-2',
    skin: 'border-line bg-sunken',
  },
}

function severityMeta(severity) {
  return SEVERITY[String(severity || '').toLowerCase()] || SEVERITY.minor
}

function pairLabel(ingredients) {
  const [a, b] = ingredients || []
  return String(a || '') + ' and ' + String(b || '')
}

export default function InteractionFlags({ regimen, flash }) {
  const [heldOpen, setHeldOpen] = useState(false)

  if (!regimen) return null

  const surfaced = regimen.surfaced || []
  const held = (regimen.findings || []).filter((f) => !f.surfaced)

  return (
    <section
      aria-labelledby="flags-heading"
      className={'mt-12 ' + (flash ? 'trace-flash' : '')}
    >
      <h2 id="flags-heading" className="display text-2xl text-ink">
        {surfaced.length
          ? 'Something on this list is worth checking'
          : 'Nothing on this list conflicts'}
      </h2>
      <Rule tone={surfaced.length ? 'clay' : 'sand'} />

      {surfaced.length ? (
        <div className="mt-8">
          <p className="measure text-lg leading-[1.45] text-ink">
            {regimen.patient_message}
          </p>

          <ul className="mt-8 flex flex-col gap-6">
            {surfaced.map((finding, index) => {
              const meta = severityMeta(finding.severity)
              return (
                <li
                  key={finding.ingredients.join('-')}
                  className={
                    'enter-script ledge ledge-strong rounded-card border px-7 py-7 ' +
                    meta.skin
                  }
                  style={{ '--i': index }}
                >
                  <p className={'flex items-center gap-3 ' + meta.text}>
                    <span aria-hidden="true" className="text-[1.15em] leading-none">
                      {meta.glyph}
                    </span>
                    <span className="smallcaps text-micro">{meta.word}</span>
                  </p>
                  <p className="display-tight mt-4 text-xl capitalize text-ink">
                    {pairLabel(finding.ingredients)}
                  </p>
                  <p className="measure mt-3 text-ink">
                    Taken together these two carry {finding.concern}.
                  </p>
                  <p className="measure mt-4 text-sm text-ink-2">
                    Source: {finding.source}.
                  </p>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <p className="measure mt-8 text-ink-2">
          CareLoop compared every pair of medicines on this list and found
          nothing that it checks for. That is not the same as nothing being
          wrong, which is what the next paragraph is about.
        </p>
      )}

      <div className="mt-10">
        <h3 className="smallcaps text-micro text-clay">
          What this check does not do
        </h3>
        <p className="measure mt-3 text-sm text-ink-2">{regimen.limitations}</p>
      </div>

      <div className="ledge mt-10 overflow-hidden rounded-card border border-line bg-sunken text-ink">
        <button
          type="button"
          onClick={() => setHeldOpen((open) => !open)}
          aria-expanded={heldOpen}
          aria-controls="held-back-panel"
          className="block w-full cursor-pointer px-6 py-6 text-left sm:px-8"
        >
          <span className="smallcaps text-micro text-clay">
            For the clinical team, not shown to the patient
          </span>
          <span className="mt-2 block text-sm font-semibold text-ink">
            {held.length
              ? held.length +
                (held.length === 1
                  ? ' finding was detected and held back'
                  : ' findings were detected and held back')
              : 'Nothing was detected and held back'}
          </span>
        </button>

        <div
          id="held-back-panel"
          hidden={!heldOpen}
          className="border-t border-line px-6 py-6 sm:px-8"
        >
          <p className="measure text-sm text-ink-2">
            CareLoop only tells a patient about a finding at major severity or
            above. Anything below that is recorded here for the prescriber or
            pharmacist and is never raised on a call.
          </p>

          {held.length ? (
            <ul className="mt-6 flex flex-col gap-4">
              {held.map((finding) => (
                <li
                  key={finding.ingredients.join('-')}
                  className="rounded-card border border-line bg-surface px-5 py-4"
                >
                  <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="smallcaps text-micro text-clay">
                      {severityMeta(finding.severity).word}
                    </span>
                    <span className="text-sm font-semibold capitalize text-ink">
                      {pairLabel(finding.ingredients)}
                    </span>
                  </p>
                  <p className="measure mt-2 text-sm text-ink-2">
                    {finding.concern}
                  </p>
                  <p className="measure mt-1.5 text-xs text-ink-2">
                    Source: {finding.source}.
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  )
}
