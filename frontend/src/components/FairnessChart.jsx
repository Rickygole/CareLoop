import { useEffect, useState } from 'react'

import evalResults from '../data/eval_results.json'

const CAPTION =
  'Internal evaluation on symptom descriptions written by the project team across several phrasing styles. This demonstrates the evaluation method, not a measurement of real world bias. The sample is small, non clinical, not representative of any population or language community, and was authored by non clinicians. No claim is made about how CareLoop would perform on real patient speech.'

function percent(value) {
  return Math.max(0, Math.min(100, Math.round(value * 1000) / 10))
}

function Bar({ arm, entry, grown, placeholder }) {
  const value = entry ? entry.value : 0
  const width = grown && !placeholder ? percent(value) : 0

  return (
    <div className="flex items-center gap-4">
      <span className="w-40 shrink-0 truncate text-xs text-ink-2">
        {arm.label}
      </span>
      <div className="relative h-2.5 min-w-0 flex-1 bg-sunken">
        <div
          className="h-full bg-ink-2 transition-[width] duration-700 ease-out"
          style={{ width: width + '%' }}
        />
      </div>
      <span className="numeric w-24 shrink-0 text-right text-xs text-ink">
        {placeholder
          ? '--'
          : percent(value) +
            '%' +
            (entry && entry.stderr
              ? ' ' + String.fromCharCode(177) + ' ' + percent(entry.stderr)
              : '')}
      </span>
    </div>
  )
}

export default function FairnessChart() {
  const [grown, setGrown] = useState(false)
  const placeholder = Boolean(evalResults.placeholder)

  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const lookup = new Map(
    (evalResults.results || []).map((r) => [r.category + '|' + r.arm, r]),
  )
  const arms = evalResults.arms || []
  const categories = evalResults.categories || []

  return (
    <details className="mt-10 border-t border-line pt-7">
      <summary className="cursor-pointer list-none text-sm font-semibold text-ink marker:content-none">
        <span className="smallcaps text-micro text-muted">The evidence</span>
        <span className="mt-1.5 block">
          Show how consistently CareLoop rates the same symptom said different
          ways
        </span>
      </summary>

      <div className="mt-7">
        <p className="measure text-sm text-ink-2">
          {evalResults.metric_label}
        </p>
        {placeholder ? (
          <p className="numeric mt-3 text-sm text-moderate">
            The test has not been run yet, so every bar is empty on purpose.
          </p>
        ) : (
          <p className="numeric mt-3 text-sm text-muted">
            {evalResults.cases} cases, {evalResults.repeats_per_case} repeats
            each.
          </p>
        )}

        <div className="mt-8 grid gap-x-14 gap-y-10 lg:grid-cols-2">
          {categories.map((category) => (
            <div key={category}>
              <h4 className="smallcaps border-b border-line-strong pb-1.5 text-micro text-muted">
                {category}
              </h4>
              <div className="mt-4 space-y-3">
                {arms.map((arm) => (
                  <Bar
                    key={arm.id}
                    arm={arm}
                    entry={lookup.get(category + '|' + arm.id)}
                    grown={grown}
                    placeholder={placeholder}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="measure mt-8 text-xs text-muted">{CAPTION}</p>
        {!placeholder && evalResults.model ? (
          <p className="numeric mt-3 text-xs text-muted">
            {evalResults.model}
            {evalResults.generated_at ? ', run ' + evalResults.generated_at : ''}
          </p>
        ) : null}
      </div>
    </details>
  )
}
