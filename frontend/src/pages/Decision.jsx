import { Link } from 'react-router-dom'

import ClinicCall from '../components/ClinicCall.jsx'
import RunNarrative from '../components/RunNarrative.jsx'
import Screen from '../components/Screen.jsx'
import TechnicalDetail from '../components/TechnicalDetail.jsx'
import TierBadge from '../components/TierBadge.jsx'
import TriageResult from '../components/TriageResult.jsx'
import { Rule } from '../components/Block.jsx'
import { dateTimeLabel } from '../lib/format.js'
import { actionSentence, quoted } from '../lib/narrate.js'
import { BTN_PRIMARY, CARD } from '../lib/ui.js'
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
        title="No check-in call has happened yet"
        lead="When CareLoop has spoken to you, what you said and what it did about it will be here."
      >
        <Link to="/call" className={BTN_PRIMARY}>
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
      title="What CareLoop did about it"
      lead="You have just been on a check-in call. This is what CareLoop made of your answer, what it did next, and the whole of its working."
    >
      <TriageResult
        result={triage}
        latencyMs={run.latencyMs}
        booking={run.booking}
      />
      <ClinicCall
        events={run.events}
        booking={run.booking}
        tier={triage.tier}
      />

      <section aria-labelledby="said-heading" className="mt-20">
        <h2 id="said-heading" className="display text-2xl text-ink">
          What you said
        </h2>
        <Rule tone="sand" />

        <blockquote className={CARD + ' mt-8 px-7 py-7 sm:px-9'}>
          <p className="display-tight measure text-xl text-ink">
            {quoted(triage.transcript)}
          </p>
          <p className="numeric mt-5 text-sm text-ink-2">
            Recorded {dateTimeLabel(run.at)}
          </p>
        </blockquote>

        {triage.normalized_text ? (
          <div className="mt-10">
            <h3 className="smallcaps text-micro text-clay">
              Written down in clinical terms as
            </h3>
            <p className="display-tight measure mt-4 rounded-card border-2 border-edge-strong bg-sunken px-6 py-5 text-lg text-ink">
              {triage.normalized_text}
            </p>
            <p className="measure mt-4 text-sm text-ink-2">
              The rules and the model both work from this line rather than from
              the raw words.
            </p>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="working-heading" className="mt-20">
        <h2 id="working-heading" className="display text-2xl text-ink">
          How it got there
        </h2>
        <Rule tone="sand" />
        {rules.length ? (
          <p className="measure mt-8 text-ink-2">
            A fixed safety rule matched on {ruleWords(rules)}. A matched rule
            settles the severity on its own, which is why the answer came back
            without waiting for a model. The model is allowed to raise a
            severity afterwards. It is never allowed to lower one.
          </p>
        ) : (
          <p className="measure mt-8 text-ink-2">
            No fixed safety rule matched these words, so the question went on to
            the model. Had a rule matched, it would have settled the severity on
            its own.
          </p>
        )}
        <RunNarrative events={run.events} startIndex={2} />
      </section>

      {history.length ? (
        <section aria-labelledby="history-heading" className="mt-20">
          <h2 id="history-heading" className="display text-2xl text-ink">
            Calls before this one
          </h2>
          <Rule tone="sand" />
          <ul className="mt-8 flex flex-col gap-5">
            {history.map((item, index) => (
              <li
                key={item.call_id || index}
                className={'enter-fade ' + CARD + ' px-6 py-6 sm:px-8'}
                style={{ '--i': index }}
              >
                <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
                  <div className="min-w-0">
                    <p className="numeric smallcaps text-micro text-ink-2">
                      {dateTimeLabel(item.timestamp)}
                    </p>
                    <p className="measure mt-3 text-ink">
                      {item.symptom_reported
                        ? 'You said you had ' + item.symptom_reported + '.'
                        : item.outcome === 'no_answer'
                          ? 'You did not pick up.'
                          : 'You said you were feeling fine.'}
                    </p>
                    <p className="measure mt-2 text-sm text-ink-2">
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

      <section aria-labelledby="record-heading" className="mt-20">
        <h2 id="record-heading" className="display text-2xl text-ink">
          The machine record
        </h2>
        <Rule tone="sand" />
        <p className="measure mt-8 text-ink-2">
          Nothing is hidden. Every step the system took is written down in the
          order it happened.
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
