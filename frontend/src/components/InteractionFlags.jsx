import { useState } from 'react'

import { FOLD, FOLD_BODY, FOLD_TOGGLE, LEAD, SECTION } from '../lib/ui.js'

const SEVERITY = {
  contraindicated: {
    word: 'Should not be taken together',
    glyph: String.fromCharCode(9679),
    text: 'text-emergency',
    skin: 'bg-emergency-tint',
    rail: 'border-l-4 border-l-emergency',
  },
  major: {
    word: 'Major interaction',
    glyph: String.fromCharCode(9670),
    text: 'text-severe',
    skin: 'bg-severe-tint',
    rail: 'border-l-4 border-l-severe',
  },
  moderate: {
    word: 'Moderate interaction',
    glyph: String.fromCharCode(9651),
    text: 'text-moderate',
    skin: 'bg-moderate-tint',
    rail: 'border-l-4 border-l-moderate',
  },
  minor: {
    word: 'Minor interaction',
    glyph: String.fromCharCode(9675),
    text: 'text-ink-2',
    skin: 'bg-sunken',
    rail: 'border-l-4 border-l-line-strong',
  },
}

export function severityMeta(severity) {
  return SEVERITY[String(severity || '').toLowerCase()] || SEVERITY.minor
}

export function pairLabel(ingredients) {
  const [a, b] = ingredients || []
  return String(a || '') + ' and ' + String(b || '')
}

export function InteractionPin({ finding, lead, children }) {
  if (!finding) return null

  const meta = severityMeta(finding.severity)
  const [first, second] = finding.labels || finding.ingredients || []

  return (
    <div
      className={
        'mt-5 flex gap-x-2.5 rounded-card px-3 py-4 sm:gap-x-4 sm:px-5 ' +
        meta.skin +
        ' ' +
        meta.rail
      }
    >
      <span
        aria-hidden="true"
        className={'text-[1.3em] leading-[1.3] ' + meta.text}
      >
        {meta.glyph}
      </span>
      <p className="measure text-sm text-ink">
        <strong className={'font-semibold ' + meta.text}>
          {lead || meta.word + ', this call.'}
        </strong>{' '}
        Your {String(first || '')} and your {String(second || '')} carry{' '}
        {finding.concern} together. Source: {finding.source}.{' '}
        <strong className="font-semibold">
          CareLoop cannot tell you what to do about this and has told no one.
        </strong>{' '}
        Do not start, stop or change any medicine because of it. Please speak to
        your prescriber or pharmacist.
        {children}
      </p>
    </div>
  )
}

export function InteractionLimits({ regimen }) {
  const [heldOpen, setHeldOpen] = useState(false)

  if (!regimen) return null

  const held = (regimen.findings || []).filter((f) => !f.surfaced)

  return (
    <section aria-labelledby="limits-heading" className={SECTION}>
      <details className={FOLD}>
        <summary className={FOLD_TOGGLE + ' fold-summary'}>
          <span className="smallcaps text-micro text-ink-2">
            The limits of this check
          </span>
          <h2
            id="limits-heading"
            className="mt-2 block text-sm font-semibold text-ink"
          >
            What this check does not do
          </h2>
        </summary>
        <div className={FOLD_BODY}>
          <p className="measure text-sm text-ink-2">{regimen.limitations}</p>
        </div>
      </details>

      <div className={FOLD + ' mt-4 text-ink'}>
        <button
          type="button"
          onClick={() => setHeldOpen((open) => !open)}
          aria-expanded={heldOpen}
          aria-controls="held-back-panel"
          className={FOLD_TOGGLE}
        >
          <span className="smallcaps text-micro text-clay">
            What CareLoop held back
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
          className={FOLD_BODY}
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
                    <span className="inline-block text-sm font-semibold text-ink first-letter:uppercase">
                      {pairLabel(finding.labels || finding.ingredients)}
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

export default function InteractionFlags({ regimen, flash }) {
  if (!regimen) return null

  const surfaced = regimen.surfaced || []

  return (
    <section
      aria-labelledby="flags-heading"
      className={flash ? 'trace-flash' : ''}
    >
      <h2 id="flags-heading" className="display text-xl text-ink">
        {surfaced.length
          ? 'Something on this list is worth checking'
          : 'Nothing on this list conflicts'}
      </h2>

      {surfaced.length ? (
        <div className="mt-6">
          <ul className="flex flex-col gap-6">
            {surfaced.map((finding, index) => {
              const meta = severityMeta(finding.severity)
              return (
                <li
                  key={finding.ingredients.join('-')}
                  className={
                    'enter-script rounded-card px-6 py-6 sm:px-7 ' +
                    meta.skin +
                    ' ' +
                    meta.rail
                  }
                  style={{ '--i': index }}
                >
                  <p className={'flex items-center gap-3 ' + meta.text}>
                    <span
                      aria-hidden="true"
                      className="text-[1.3em] leading-none"
                    >
                      {meta.glyph}
                    </span>
                    <span className="smallcaps text-sm">{meta.word}</span>
                  </p>
                  <h3 className="display mt-4 text-xl text-ink first-letter:uppercase">
                    {pairLabel(finding.labels || finding.ingredients)}
                  </h3>
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

          <p className={LEAD + ' mt-7'}>
            Ask your prescriber or pharmacist about this. CareLoop has not told
            anyone and cannot change what you were prescribed.
          </p>
        </div>
      ) : (
        <p className="measure mt-5 text-ink-2">
          CareLoop compared every pair of medicines on this list and found
          nothing it checks for. That is not the same as nothing being wrong.
          What this check does not cover is set out below.
        </p>
      )}
    </section>
  )
}
