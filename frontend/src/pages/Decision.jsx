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
import { BTN_PRIMARY, CARD, LEAD, SECTION } from '../lib/ui.js'
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
      <Screen title="Check-in summary" lead="No check-in has been taken yet.">
        <Link to="/call" className={BTN_PRIMARY}>
          Go to the check-in
        </Link>
      </Screen>
    )
  }

  const triage = run.triage || {}
  const rules = triage.matched_rules || []
  const history = (record && record.history) || []
  const notableHistory = history.filter(
    (item) => item.symptom_reported || item.outcome === 'no_answer',
  )
  const quietHistory = history.filter(
    (item) => !item.symptom_reported && item.outcome !== 'no_answer',
  )
  const quietTier =
    quietHistory.length &&
    quietHistory.every((item) => item.tier === quietHistory[0].tier)
      ? quietHistory[0].tier
      : null
  const tier = String(triage.tier || '').trim().toLowerCase()
  const simulatedBooking = Boolean(run.booking && run.booking.confirmed !== false)
  const needsClinic = tier === 'moderate' || tier === 'severe' || simulatedBooking

  return (
    <Screen title="Check-in summary">
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

      <section aria-labelledby="next-heading" className={SECTION}>
        <h2 id="next-heading" className="display text-xl text-ink">
          What to do next
        </h2>
        <Rule />
        {tier === 'emergency' ? (
          <p className={LEAD + ' mt-6'}>
            No appointment exists and an appointment would be too slow anyway.
            If you have not already, call 911 now.
          </p>
        ) : needsClinic ? (
          <p className={LEAD + ' mt-6'}>
            No appointment exists. Any booking call shown above was simulated,
            and no real clinic was contacted. In a real deployment CareLoop
            would book you in. Here it cannot, so please telephone your clinic
            yourself and tell them what you told CareLoop. If this becomes an
            emergency, call 911.
          </p>
        ) : (
          <p className={LEAD + ' mt-6'}>
            Nothing was booked, and on this answer nothing needed to be. If
            anything changes, take another check-in or telephone your clinic.
          </p>
        )}
        <p className="measure mt-5 text-ink-2">
          CareLoop has written this check-in down on the sample record. It has
          told nobody, and nothing in this prototype runs on a timer.
        </p>
        <Link to="/" className={BTN_PRIMARY + ' mt-7'}>
          Back to Today
        </Link>
      </section>

      <section aria-labelledby="said-heading" className={SECTION}>
        <h2 id="said-heading" className="display text-xl text-ink">
          What you said
        </h2>
        <Rule />

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
            <p className="display-tight measure mt-4 rounded-card border border-line bg-sunken px-6 py-5 text-lg text-ink">
              {triage.normalized_text}
            </p>
            <p className="measure mt-4 text-sm text-ink-2">
              The rules and the model both work from this line rather than from
              the raw words.
            </p>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="working-heading" className={SECTION}>
        <h2 id="working-heading" className="display text-xl text-ink">
          How it got there
        </h2>
        <Rule />
        {rules.length ? (
          <p className="measure mt-8 text-ink-2">
            A fixed safety rule matched on {ruleWords(rules)}. A matched rule
            settles the severity on its own, which is why the answer came back
            without waiting for a model. The model may raise that severity
            afterwards. It may never lower it.
          </p>
        ) : (
          <p className="measure mt-8 text-ink-2">
            No fixed safety rule matched these words, so the question went on
            to the model. A matched rule would have settled the severity on its
            own.
          </p>
        )}
        <RunNarrative events={run.events} startIndex={2} />
      </section>

      {history.length ? (
        <section aria-labelledby="history-heading" className={SECTION}>
          <h2 id="history-heading" className="display text-xl text-ink">
            Earlier check-ins on this record
          </h2>
          <Rule />
          <p className="measure mt-6 text-ink-2">
            These calls arrived with the sample record as an example of what a
            week looks like. You did not take them, and nothing here was said
            by you.
          </p>
          <ul className="mt-8 flex flex-col gap-5">
            {notableHistory.map((item, index) => (
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
                        ? 'The patient reported ' + item.symptom_reported + '.'
                        : 'The call was not answered.'}
                    </p>
                    <p className="measure mt-2 text-sm text-ink-2">
                      {actionSentence(item.action_taken, item.outcome)}
                    </p>
                  </div>
                  {item.tier ? <TierBadge tier={item.tier} size="sm" /> : null}
                </div>
              </li>
            ))}
            {quietHistory.length ? (
              <li
                key="quiet-history-summary"
                className={'enter-fade ' + CARD + ' px-6 py-6 sm:px-8'}
                style={{ '--i': notableHistory.length }}
              >
                <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
                  <div className="min-w-0">
                    <p className="numeric smallcaps text-micro text-ink-2">
                      {dateTimeLabel(quietHistory[0].timestamp)}
                    </p>
                    <p className="measure mt-3 text-ink">
                      {quietHistory.length === 1
                        ? 'One earlier check-in on this record, and it had nothing to report.'
                        : quietHistory.length +
                          ' earlier check-ins on this record, and none of them had anything to report.'}
                    </p>
                  </div>
                  {quietTier ? <TierBadge tier={quietTier} size="sm" /> : null}
                </div>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="record-heading" className={SECTION}>
        <h2 id="record-heading" className="display text-xl text-ink">
          Activity log
        </h2>
        <Rule />
        <p className="measure mt-8 text-ink-2">
          Every step of this check-in, in the order it happened.
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
