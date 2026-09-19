import { useEffect, useState } from 'react'

import evalResults from '../data/eval_results.json'

const ARM_COLOR = {
  naive: '#64748B',
  cot: '#38BDF8',
  normalized: '#2DD4BF',
}

const CAPTION =
  'Internal evaluation on symptom descriptions written by the project team across several phrasing styles. This demonstrates the evaluation method, not a measurement of real-world bias. The sample is small, non-clinical, not representative of any population or language community, and was authored by non-clinicians. No claim is made about how CareLoop would perform on real patient speech.'

function percent(value) {
  return Math.max(0, Math.min(100, Math.round(value * 100)))
}

function Bar({ arm, entry, grown, placeholder }) {
  const color = ARM_COLOR[arm.id] || '#8B8B8B'
  const value = entry ? entry.value : 0
  const width = grown && !placeholder ? percent(value) : 0

  return (
    <div className="flex items-center gap-3">
      <span className="w-44 shrink-0 truncate font-mono text-2xs text-console-muted">
        {arm.label}
      </span>
      <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-console-line">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: width + '%', background: color }}
        />
      </div>
      <span className="w-24 shrink-0 text-right font-mono text-2xs text-console-muted tabular-nums">
        {placeholder
          ? '--'
          : percent(value) +
            '%' +
            (entry && entry.stderr ? ' ± ' + percent(entry.stderr) : '')}
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

  return (
    <section
      aria-label="Fairness evaluation"
      className="rounded-card border border-console-line bg-console-2 p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-console-ink">
            Triage consistency across phrasing styles
          </h2>
          <p className="mt-1 text-sm text-console-muted">
            {evalResults.metric_label}
          </p>
        </div>

        {placeholder ? (
          <span className="rounded-full border border-[#FBBF24]/50 px-3 py-1 text-2xs font-semibold uppercase tracking-wide text-[#FBBF24]">
            Awaiting eval run
          </span>
        ) : (
          <span className="font-mono text-2xs text-console-muted">
            {evalResults.cases} cases {'×'} {evalResults.repeats_per_case}{' '}
            repeats
          </span>
        )}
      </div>

      {placeholder ? (
        <p className="mt-4 max-w-[70ch] rounded-[10px] border border-[#FBBF24]/30 bg-[#FBBF24]/10 px-4 py-3 text-sm text-console-ink">
          No numbers yet. The harness has not been run, so every bar below is
          empty on purpose. The three arms and four phrasing styles shown are
          the design of the evaluation, not a result.
        </p>
      ) : null}

      <div className="mt-6 space-y-6">
        {(evalResults.categories || []).map((category) => (
          <div key={category}>
            <h3 className="text-sm font-medium text-console-ink">{category}</h3>
            <div className="mt-2 space-y-2">
              {(evalResults.arms || []).map((arm) => (
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

      <p className="mt-6 max-w-[75ch] text-xs leading-relaxed text-console-muted">
        {CAPTION}
      </p>
    </section>
  )
}
