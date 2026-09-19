import { useEffect, useState } from 'react'

import evalResults from '../data/eval_results.json'

const BAR_COLOR = '#7E8A99'
const VARIANCE_COLOR = '#E3A13B'

const CAPTION =
  'Internal evaluation on symptom descriptions written by the project team across several phrasing styles. This demonstrates the evaluation method, not a measurement of real-world bias. The sample is small, non-clinical, not representative of any population or language community, and was authored by non-clinicians. No claim is made about how CareLoop would perform on real patient speech.'

function percent(value) {
  return Math.max(0, Math.min(100, Math.round(value * 1000) / 10))
}

function Bar({ arm, entry, grown, placeholder }) {
  const value = entry ? entry.value : 0
  const width = grown && !placeholder ? percent(value) : 0

  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 truncate font-mono text-2xs text-console-muted">
        {arm.label}
      </span>
      <div className="relative h-2 min-w-0 flex-1 bg-console-line">
        <div
          className="h-full transition-[width] duration-500 ease-out"
          style={{ width: width + '%', background: BAR_COLOR }}
        />
      </div>
      <span className="numeric w-20 shrink-0 text-right font-mono text-2xs text-console-ink-2">
        {placeholder
          ? '--'
          : percent(value) +
            '%' +
            (entry && entry.stderr ? ' ± ' + percent(entry.stderr) : '')}
      </span>
    </div>
  )
}

function OverallRow({ arms, overall }) {
  return (
    <dl className="flex flex-wrap items-end gap-x-8 gap-y-3">
      {arms.map((arm) => (
        <div key={arm.id}>
          <dt className="font-mono text-micro uppercase text-console-muted">
            {arm.label}
          </dt>
          <dd className="numeric mt-1 text-xl font-semibold tracking-[-0.02em] text-console-ink">
            {overall[arm.id]}
            <span className="ml-0.5 text-2xs font-normal text-console-muted">
              %
            </span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Directionality({ arms, directionality }) {
  return (
    <div>
      <h3 className="font-mono text-micro uppercase text-console-muted">
        Direction of every disagreement
      </h3>
      <ul className="mt-2 space-y-1">
        {arms.map((arm) => {
          const entry = directionality[arm.id] || {}
          return (
            <li
              key={arm.id}
              className="flex items-baseline justify-between gap-4 font-mono text-2xs"
            >
              <span className="text-console-muted">{arm.label}</span>
              <span className="numeric text-console-ink-2">
                {(entry.lower || 0) + ' lower, ' + (entry.higher || 0) + ' higher'}
              </span>
            </li>
          )
        })}
      </ul>
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

  const varies = new Set(
    categories.filter((category) => {
      const values = arms.map((arm) => {
        const entry = lookup.get(category + '|' + arm.id)
        return entry ? entry.value : 0
      })
      return Math.max(...values) - Math.min(...values) > 0.0001
    }),
  )

  return (
    <section
      aria-label="Evaluation"
      className="overflow-hidden rounded-card border border-console-line bg-console-panel"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-console-line bg-console-chrome px-6 py-3">
        <h2 className="font-mono text-2xs font-bold uppercase tracking-[0.18em] text-console-ink">
          Supporting evaluation
        </h2>
        {placeholder ? (
          <span className="font-mono text-2xs text-dark-moderate">
            awaiting eval run
          </span>
        ) : (
          <span className="numeric font-mono text-2xs text-console-muted">
            {evalResults.cases} cases {'×'} {evalResults.repeats_per_case}{' '}
            repeats
          </span>
        )}
      </div>

      <div className="grid gap-x-12 gap-y-8 p-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <div>
          <h3 className="text-sm font-semibold text-console-ink">
            Triage consistency across phrasing styles
          </h3>
          <p className="mt-1.5 text-2xs leading-relaxed text-console-ink-2">
            {evalResults.metric_label}
          </p>
          <p className="mt-3 max-w-[44ch] text-2xs leading-relaxed text-console-muted">
            {placeholder
              ? 'The harness has not been run, so every bar is empty on purpose. The three arms and four phrasing styles are the design of the evaluation, not a result.'
              : 'No meaningful difference between arms at this sample size.'}
          </p>

          {!placeholder && evalResults.overall ? (
            <div className="mt-6">
              <OverallRow arms={arms} overall={evalResults.overall} />
            </div>
          ) : null}

          {!placeholder && evalResults.directionality ? (
            <div className="mt-6 border-t border-console-line pt-4">
              <Directionality
                arms={arms}
                directionality={evalResults.directionality}
              />
            </div>
          ) : null}
        </div>

        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="flex items-center gap-2 text-2xs font-semibold text-console-ink">
                {category}
                {!placeholder && varies.has(category) ? (
                  <span
                    className="font-mono text-micro font-normal uppercase"
                    style={{ color: VARIANCE_COLOR }}
                  >
                    arms differ
                  </span>
                ) : null}
              </h3>
              <div className="mt-2.5 space-y-2">
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
      </div>

      <div className="border-t border-console-line px-6 py-4">
        {!placeholder && evalResults.model ? (
          <p className="numeric font-mono text-micro text-console-muted">
            {evalResults.model}
            {evalResults.temperature === null ||
            evalResults.temperature === undefined
              ? ''
              : ' at temperature ' + evalResults.temperature}
            {evalResults.generated_at ? ', run ' + evalResults.generated_at : ''}
          </p>
        ) : null}
        <p className="mt-2 max-w-[92ch] text-micro leading-relaxed text-console-muted">
          {CAPTION}
        </p>
      </div>
    </section>
  )
}
