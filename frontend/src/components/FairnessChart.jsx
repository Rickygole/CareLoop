import { useEffect, useState } from 'react'

import { Rule } from './Block.jsx'
import { SECTION } from '../lib/ui.js'
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
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
      <span className="w-full text-sm font-semibold text-ink sm:w-56 sm:shrink-0">
        {arm.label}
      </span>
      <div className="relative h-3.5 min-w-[6rem] flex-1 overflow-hidden rounded-control bg-sand-deep">
        <div
          className="h-full rounded-control bg-brand transition-[width] duration-700 ease-out"
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

function isHeadlineCategory(category) {
  return String(category || '').toLowerCase().includes('casual and dialect')
}

function runLabel(stamp) {
  const at = new Date(stamp)
  if (Number.isNaN(at.getTime())) return String(stamp)
  return at.toLocaleString('en-US', {
    day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
    timeZone: 'UTC',
  }) + ' UTC'
}

export default function FairnessChart() {
  const [grown, setGrown] = useState(false)
  const headline = (() => {
    const rows = (evalResults.results || []).filter(
      (r) => String(r.category || '').toLowerCase().includes('casual and dialect'),
    )
    if (rows.length < 2) return null
    const full = rows.find((r) => r.arm === 'full')
    const others = rows.filter((r) => r.arm !== 'full').map((r) => r.value)
    if (!full || !others.length) return null
    if (full.value <= Math.min(...others)) return null
    return { full: full.value, best: Math.min(...others) }
  })()

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
  const noiseFloor =
    typeof evalResults.noise_floor === 'number' ? evalResults.noise_floor : null

  return (
    <div>
      {headline ? (
        <div className="rounded-card border-l-8 border border-l-moderate border-line bg-surface px-7 py-7 sm:px-9">
          <p className="smallcaps flex items-center gap-3 text-micro text-moderate">
            <span aria-hidden="true">{String.fromCharCode(9670)}</span>
            <span>What the test found, against us</span>
          </p>
          <p className="display-tight measure mt-4 text-2xl text-ink">
            On casual and dialect phrasing CareLoop raised{' '}
            {Math.round(headline.full * 100)} percent of moderate cases too
            high, against {Math.round(headline.best * 100)} percent for the
            simpler baselines.
          </p>
          <p className="measure mt-4 text-ink-2">
            We wrote down what would count as failure before we looked, so we
            report this. It is also why the emergency floor is a fixed rule
            and not a model: the rule can raise what the model says and can
            never lower it.
          </p>
        </div>
      ) : null}

      {placeholder ? (
        <p className="mt-8 text-sm font-semibold text-moderate">
          The test has not been run yet, so every bar is empty on purpose.
        </p>
      ) : null}

      <section aria-labelledby="arms-heading" className={SECTION}>
        <h2 id="arms-heading" className="display text-2xl text-ink">
          The three ways of deciding
        </h2>
        <Rule />
        <dl className="mt-6 divide-y divide-line">
          {arms.map((arm) => (
            <div
              key={arm.id}
              className="flex flex-wrap gap-x-8 gap-y-1 py-4 first:pt-0 last:pb-0"
            >
              <dt className="w-full font-semibold text-ink sm:w-64">
                {arm.label}
              </dt>
              <dd className="min-w-0 flex-1 text-ink-2">{arm.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="conditions-heading" className={SECTION}>
        <h2 id="conditions-heading" className="display text-2xl text-ink">
          How often a moderate case was raised above moderate
        </h2>
        <Rule />

        {placeholder ? null : (
          <p className="numeric mt-6 text-sm text-ink-2">
            {evalResults.cases} cases, {evalResults.repeats_per_case} repeats
            each, {evalResults.model}
            {evalResults.generated_at ? ', run ' + runLabel(evalResults.generated_at) : ''}
            .
          </p>
        )}

        {!placeholder && noiseFloor !== null ? (
          <p className="measure mt-3 text-sm text-ink-2">
            <span className="numeric font-semibold text-ink">
              {percent(noiseFloor)}%.
            </span>{' '}
            {evalResults.noise_floor_label}
          </p>
        ) : null}

        <div className="mt-8 divide-y divide-line">
          {categories.map((category) => (
            <div key={category} className="py-5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h3 className="smallcaps text-micro text-clay">{category}</h3>
                {headline && isHeadlineCategory(category) ? (
                  <span className="smallcaps text-micro text-moderate">
                    The finding above
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-col gap-2.5">
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
        <section aria-labelledby="direction-heading" className={SECTION}>
          <h2 id="direction-heading" className="display text-2xl text-ink">
            Which way the disagreements went
          </h2>
          <Rule />
          <p className="measure mt-6 text-ink-2">
            When an arm disagreed with itself across phrasings, it matters which
            way it slipped. Rating an understated description as less urgent
            than the same case stated plainly is the dangerous direction.
          </p>
          <dl className="mt-6 divide-y divide-line">
            {arms.map((arm) => {
              const entry = directionality[arm.id]
              if (!entry) return null
              return (
                <div
                  key={arm.id}
                  className="flex flex-wrap gap-x-8 gap-y-1 py-4 first:pt-0 last:pb-0"
                >
                  <dt className="w-full font-semibold text-ink sm:w-64">
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

      <div className="ledge mt-12 rounded-card border border-line bg-sunken px-6 py-7 text-ink sm:px-9">
        <p className="smallcaps text-micro text-clay">
          What this does not prove
        </p>
        <p className="measure mt-4 text-sm text-ink-2">{CAPTION}</p>
      </div>
    </div>
  )
}
