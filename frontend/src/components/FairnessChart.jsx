import { useEffect, useState } from 'react'

import evalResults from '../data/eval_results.json'

export const CAPTION =
  'Internal evaluation on symptom descriptions written by the project team across several phrasing styles. This demonstrates the evaluation method, not a measurement of real world bias. The sample is small, non clinical, not representative of any population or language community, and was authored by non clinicians. No claim is made about how CareLoop would perform on real patient speech.'

function percent(value) {
  return Math.max(0, Math.min(100, Math.round(value * 1000) / 10))
}

function Row({ arm, entry, grown, placeholder }) {
  const value = entry ? entry.value : 0
  const width = grown && !placeholder ? percent(value) : 0

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line py-3.5">
      <span className="w-full text-sm text-ink sm:w-44 sm:shrink-0">
        {arm.label}
      </span>
      <div className="relative h-3 min-w-[6rem] flex-1 bg-sunken">
        <div
          className="h-full bg-ink-2 transition-[width] duration-700 ease-out"
          style={{ width: width + '%' }}
        />
      </div>
      <span className="numeric w-24 shrink-0 text-right text-sm font-semibold text-ink">
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
  const directionality = evalResults.directionality || {}

  return (
    <div>
      <section aria-labelledby="arms-heading" className="mt-12">
        <h2
          id="arms-heading"
          className="font-display border-b-2 border-line-ink pb-2 text-2xl font-semibold text-ink"
        >
          The three arms
        </h2>
        <dl className="mt-6">
          {arms.map((arm) => (
            <div
              key={arm.id}
              className="flex flex-wrap gap-x-6 gap-y-1 border-b border-line py-4"
            >
              <dt className="w-full font-semibold text-ink sm:w-52">
                {arm.label}
              </dt>
              <dd className="min-w-0 flex-1 text-ink-2">{arm.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="conditions-heading" className="mt-12">
        <h2
          id="conditions-heading"
          className="font-display border-b-2 border-line-ink pb-2 text-2xl font-semibold text-ink"
        >
          The conditions
        </h2>

        <p className="measure mt-6 text-ink-2">{evalResults.metric_label}</p>
        {placeholder ? (
          <p className="mt-3 text-sm font-semibold text-moderate">
            The test has not been run yet, so every bar is empty on purpose.
          </p>
        ) : (
          <p className="numeric mt-3 text-sm text-muted">
            {evalResults.cases} cases, {evalResults.repeats_per_case} repeats
            each, {evalResults.model}
            {evalResults.generated_at
              ? ', run ' + evalResults.generated_at
              : ''}
            .
          </p>
        )}

        <div className="mt-9 grid gap-x-14 gap-y-10 lg:grid-cols-2">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="smallcaps border-b border-line-strong pb-1.5 text-micro text-muted">
                {category}
              </h3>
              <div className="mt-2">
                {arms.map((arm) => (
                  <Row
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
      </section>

      {!placeholder && Object.keys(directionality).length ? (
        <section aria-labelledby="direction-heading" className="mt-12">
          <h2
            id="direction-heading"
            className="font-display border-b-2 border-line-ink pb-2 text-2xl font-semibold text-ink"
          >
            Which way the disagreements went
          </h2>
          <p className="measure mt-6 text-ink-2">
            When an arm disagreed with itself across phrasings, it matters which
            way it slipped. Rating an understated description as less urgent
            than the same case stated plainly is the dangerous direction.
          </p>
          <dl className="mt-6">
            {arms.map((arm) => {
              const entry = directionality[arm.id]
              if (!entry) return null
              return (
                <div
                  key={arm.id}
                  className="flex flex-wrap gap-x-6 gap-y-1 border-b border-line py-4"
                >
                  <dt className="w-full font-semibold text-ink sm:w-52">
                    {arm.label}
                  </dt>
                  <dd className="numeric min-w-0 flex-1 text-ink-2">
                    {entry.lower} landed on a less urgent tier than the majority,{' '}
                    {entry.higher} on a more urgent one.
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      ) : null}

      <p className="measure mt-12 border-t border-line pt-6 text-sm text-ink-2">
        {CAPTION}
      </p>
    </div>
  )
}
