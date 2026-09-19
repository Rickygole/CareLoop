const SEVERITY = {
  contraindicated: {
    word: 'Should not be taken together',
    glyph: String.fromCharCode(9679),
    text: 'text-emergency',
    border: 'border-emergency',
    tint: 'bg-emergency-tint',
  },
  major: {
    word: 'Major interaction',
    glyph: String.fromCharCode(9670),
    text: 'text-severe',
    border: 'border-severe',
    tint: 'bg-severe-tint',
  },
  moderate: {
    word: 'Moderate interaction',
    glyph: String.fromCharCode(9651),
    text: 'text-moderate',
    border: 'border-moderate',
    tint: 'bg-moderate-tint',
  },
  minor: {
    word: 'Minor interaction',
    glyph: String.fromCharCode(9675),
    text: 'text-ink-2',
    border: 'border-line-strong',
    tint: 'bg-surface-2',
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
  if (!regimen) return null

  const surfaced = regimen.surfaced || []
  const held = (regimen.findings || []).filter((f) => !f.surfaced)

  return (
    <section
      aria-labelledby="flags-heading"
      className={'mt-14 ' + (flash ? 'trace-flash' : '')}
    >
      <h2
        id="flags-heading"
        className="font-display border-b-2 border-line-ink pb-2 text-2xl font-semibold text-ink"
      >
        {surfaced.length
          ? 'Something on this list is worth checking'
          : 'Nothing on this list conflicts'}
      </h2>

      {surfaced.length ? (
        <div className="mt-7">
          <p className="measure text-ink">{regimen.patient_message}</p>

          <ul className="mt-7">
            {surfaced.map((finding, index) => {
              const meta = severityMeta(finding.severity)
              return (
                <li
                  key={finding.ingredients.join('-')}
                  className={
                    'enter-script mt-5 border-l-4 px-6 py-5 first:mt-0 ' +
                    meta.border +
                    ' ' +
                    meta.tint
                  }
                  style={{ '--i': index }}
                >
                  <p className="flex flex-wrap items-baseline gap-x-3">
                    <span
                      aria-hidden="true"
                      className={'leading-none ' + meta.text}
                    >
                      {meta.glyph}
                    </span>
                    <span
                      className={'smallcaps text-micro ' + meta.text}
                    >
                      {meta.word}
                    </span>
                  </p>
                  <p className="font-display mt-2.5 text-xl font-semibold capitalize text-ink">
                    {pairLabel(finding.ingredients)}
                  </p>
                  <p className="measure mt-2 text-ink-2">
                    Taken together these two carry {finding.concern}.
                  </p>
                  <p className="measure mt-3 text-sm text-muted">
                    Source: {finding.source}.
                  </p>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <p className="measure mt-7 text-ink-2">
          CareLoop compared every pair of medicines on this list and found
          nothing that it checks for. That is not the same as nothing being
          wrong, which is what the next paragraph is about.
        </p>
      )}

      <div className="mt-9 border-t border-line pt-6">
        <h3 className="smallcaps text-micro text-muted">
          What this check does not do
        </h3>
        <p className="measure mt-3 text-sm text-ink-2">{regimen.limitations}</p>
      </div>

      <details className="mt-8 rounded-card border border-dashed border-line-strong bg-surface-2 px-6 py-5">
        <summary className="cursor-pointer list-none marker:content-none">
          <span className="smallcaps text-micro text-muted">
            For the clinical team, not shown to the patient
          </span>
          <span className="mt-1.5 block text-sm font-semibold text-ink">
            {held.length
              ? held.length +
                (held.length === 1
                  ? ' finding was detected and held back'
                  : ' findings were detected and held back')
              : 'Nothing was detected and held back'}
          </span>
        </summary>

        <p className="measure mt-5 text-sm text-ink-2">
          CareLoop only tells a patient about a finding at major severity or
          above. Anything below that is recorded here for the prescriber or
          pharmacist and is never raised on a call.
        </p>

        {held.length ? (
          <ul className="mt-5 border-t border-line">
            {held.map((finding) => (
              <li
                key={finding.ingredients.join('-')}
                className="border-b border-line py-4"
              >
                <p className="flex flex-wrap items-baseline gap-x-3 text-sm">
                  <span className="smallcaps text-micro text-muted">
                    {severityMeta(finding.severity).word}
                  </span>
                  <span className="font-semibold capitalize text-ink">
                    {pairLabel(finding.ingredients)}
                  </span>
                </p>
                <p className="measure mt-1.5 text-sm text-ink-2">
                  {finding.concern}
                </p>
                <p className="measure mt-1 text-xs text-muted">
                  Source: {finding.source}.
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </details>
    </section>
  )
}
