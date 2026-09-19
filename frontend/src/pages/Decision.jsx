import { Link } from 'react-router-dom'

import ClinicCall from '../components/ClinicCall.jsx'
import RunNarrative from '../components/RunNarrative.jsx'
import Screen from '../components/Screen.jsx'
import TechnicalDetail from '../components/TechnicalDetail.jsx'
import TierBadge from '../components/TierBadge.jsx'
import TriageResult from '../components/TriageResult.jsx'
import { MARK, ROW_GRID } from '../components/Section.jsx'
import { dateTimeLabel } from '../lib/format.js'
import { actionSentence, quoted } from '../lib/narrate.js'
import { useTrace } from '../lib/useTrace.js'
import { useSession } from '../lib/session.jsx'

function ruleWords(rules) {
  return (rules || []).map((rule) => String(rule).replace(/_/g, ' ')).join(', ')
}

export default function DecisionPage() {
  const { run, record } = useSession()
  const { events, status, retries, maxRetries } = useTrace()

  if (!run) {
    return (
      <Screen
        mark="04"
        label="Step 4 of 5"
        title="Nothing has been decided yet"
        lead="This screen holds what came back from a check-in call: what was said, what CareLoop made of it, and what it did about it. No check-in has happened in this session, so there is nothing to show."
      >
        <Link
          to="/call"
          className="mt-9 inline-flex min-h-[56px] items-center rounded-control bg-brand px-8 py-3.5 text-sm font-semibold text-white shadow-raised transition-[background-color,transform] duration-200 ease-out hover:bg-brand-deep active:translate-y-px"
        >
          Go to the call and talk to CareLoop
        </Link>
      </Screen>
    )
  }

  const triage = run.triage || {}
  const rules = triage.matched_rules || []
  const history = (record && record.history) || []

  return (
    <Screen
      mark="04"
      label="Step 4 of 5"
      title="What CareLoop did about it"
      lead="You have just been on a check-in call. This is what CareLoop made of your answer, what it did next, and the whole of its working."
    >
      <section aria-labelledby="verdict-heading" className="mt-10">
        <h2
          id="verdict-heading"
          className="font-display border-b-2 border-line-ink pb-2 text-2xl font-semibold text-ink"
        >
          The decision
        </h2>
        <div className="mt-7">
          <TriageResult
            result={triage}
            latencyMs={run.latencyMs}
            booking={run.booking}
          />
        </div>
        <ClinicCall
          events={run.events}
          booking={run.booking}
          tier={triage.tier}
        />
      </section>

      <section aria-labelledby="said-heading" className="mt-16">
        <h2
          id="said-heading"
          className="font-display border-b-2 border-line-ink pb-2 text-2xl font-semibold text-ink"
        >
          What you said
        </h2>
        <blockquote className="mt-7 border-l-4 border-brand pl-6">
          <p className="font-display measure text-lg text-ink">
            {quoted(triage.transcript)}
          </p>
        </blockquote>
        <p className="numeric mt-5 text-sm text-muted">
          Recorded {dateTimeLabel(run.at)}
        </p>

        {triage.normalized_text ? (
          <div className="mt-9">
            <h3 className="smallcaps text-micro text-muted">
              Written down in clinical terms as
            </h3>
            <p className="font-display measure mt-3 border-l-4 border-line-strong bg-surface-2 px-6 py-5 text-lg text-ink">
              {triage.normalized_text}
            </p>
            <p className="measure mt-4 text-sm text-ink-2">
              The rules and the model both work from this line rather than from
              the raw words.
            </p>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="working-heading" className="mt-16">
        <h2
          id="working-heading"
          className="font-display border-b-2 border-line-ink pb-2 text-2xl font-semibold text-ink"
        >
          How it got there
        </h2>
        {rules.length ? (
          <p className="measure mt-7 text-ink-2">
            A fixed safety rule matched on {ruleWords(rules)}. A matched rule
            settles the severity on its own, which is why the answer came back
            without waiting for a model. The model is allowed to raise a
            severity afterwards. It is never allowed to lower one.
          </p>
        ) : (
          <p className="measure mt-7 text-ink-2">
            No fixed safety rule matched these words, so the question went on to
            the model. Had a rule matched, it would have settled the severity on
            its own.
          </p>
        )}
        <RunNarrative events={run.events} startIndex={2} />
      </section>

      {history.length ? (
        <section aria-labelledby="history-heading" className="mt-16">
          <h2
            id="history-heading"
            className="font-display border-b-2 border-line-ink pb-2 text-2xl font-semibold text-ink"
          >
            Calls before this one
          </h2>
          <ul className="mt-2">
            {history.map((item, index) => (
              <li
                key={item.call_id || index}
                className={'enter-fade border-t border-line py-6 ' + ROW_GRID}
                style={{ '--i': index }}
              >
                <p aria-hidden="true" className={MARK + ' sm:pt-1.5'}>
                  {String(index + 1).padStart(2, '0')}
                </p>
                <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
                  <div className="min-w-0">
                    <p className="numeric text-micro text-muted">
                      {dateTimeLabel(item.timestamp)}
                    </p>
                    <p className="measure mt-1.5 text-ink">
                      {item.symptom_reported
                        ? 'You said you had ' + item.symptom_reported + '.'
                        : item.outcome === 'no_answer'
                          ? 'You did not pick up.'
                          : 'You said you were feeling fine.'}
                    </p>
                    <p className="mt-1.5 text-sm text-muted">
                      {actionSentence(item.action_taken, item.outcome)}
                    </p>
                  </div>
                  {item.tier ? <TierBadge tier={item.tier} size="sm" /> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="record-heading" className="mt-16">
        <h2
          id="record-heading"
          className="font-display border-b-2 border-line-ink pb-2 text-2xl font-semibold text-ink"
        >
          The machine record
        </h2>
        <p className="measure mt-7 text-ink-2">
          Nothing is hidden. Every step the system took is written down in the
          order it happened, and this is that list.
        </p>
        <TechnicalDetail
          events={events}
          status={status}
          retries={retries}
          maxRetries={maxRetries}
        />
      </section>
    </Screen>
  )
}
