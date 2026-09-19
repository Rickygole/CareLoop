import { countWord, sentenceCase } from '../lib/day.js'
import { useSession } from '../lib/session.jsx'

export const DASHBOARD_DISCLAIMER =
  'CareLoop is a research prototype and is not a medical device. It does not provide medical advice, diagnosis, or treatment. If you are having a medical emergency, call 911. If you are in crisis, call or text 988.'

function blankFields(medications) {
  return (medications || [])
    .filter((item) => !item.prescriber)
    .map(
      (item) =>
        'the prescriber name on ' +
        item.medication +
        (item.dosage_text ? ' ' + item.dosage_text : ''),
    )
}

function readingLine(medications, record) {
  const count = (medications || []).length
  if (!count) {
    return 'No record has been read yet. CareLoop reads the medicine list from the records your insurer holds, and never asks you to type one in.'
  }

  const source = record && record.insurance_display_name
  const blanks = blankFields(medications)
  const blank = blanks.length
    ? (blanks.length === 1
        ? 'One field was blank: '
        : 'Some fields were blank: ') +
      blanks.join(', ') +
      '.'
    : 'No field on that list was blank.'

  return (
    sentenceCase(countWord(count)) +
    (count === 1 ? ' medicine was' : ' medicines were') +
    ' read from the ' +
    (source || 'insurer') +
    ' record. ' +
    blank +
    ' Dose times are as the record holds them.'
  )
}

function decidedLine(schedule, regimen) {
  const calls = (schedule && schedule.calls_total) || 0
  const doses = (schedule && schedule.doses_total) || 0
  const surfaced = ((regimen && regimen.surfaced) || []).length
  const held = ((regimen && regimen.findings) || []).filter(
    (finding) => !finding.surfaced,
  ).length

  const grouping =
    calls && doses
      ? 'Call times were worked out from the dose times on the record, and doses close together were grouped into one call so your phone rings ' +
        countWord(calls) +
        ' times rather than ' +
        countWord(doses) +
        '. '
      : 'Call times are worked out from the dose times on the record, and doses close together are grouped into one call. '

  const raised = surfaced
    ? countWord(surfaced) +
      (surfaced === 1
        ? ' was raised with you today. '
        : ' were raised with you today. ')
    : 'Nothing was raised with you today. '

  const back = held
    ? countWord(held) + (held === 1 ? ' was held back. ' : ' were held back. ')
    : 'Nothing was held back. '

  return (
    grouping +
    'When you answer, a fixed rule layer runs alongside the model and can only ever raise how serious your answer is judged to be, never lower it. Findings: ' +
    raised.toLowerCase() +
    back +
    'CareLoop only raises a finding at major severity or above. Anything below that is recorded for your prescriber or pharmacist and never mentioned on a call.'
  )
}

export function DashboardFooter() {
  const { medications, record, schedule, regimen } = useSession()

  return (
    <footer className="border-t border-line bg-sunken text-ink-2">
      <div className="hold py-12">
        <p className="smallcaps text-micro text-clay">Please read this</p>
        <h2 className="display mt-3 text-2xl text-ink">After the last call</h2>
        <span aria-hidden="true" className="mt-5 block h-px w-full bg-line" />

        <div className="mt-8 grid gap-x-12 gap-y-9 lg:grid-cols-3">
          <section>
            <h3 className="display-tight text-lg text-ink">
              It notifies no human being
            </h3>
            <p className="mt-3 text-sm text-ink-2">
              Nobody is watching your day. No nurse, doctor or family member is
              told what you said. CareLoop rings a clinic only when it asks you
              on a call and you say yes.
            </p>
          </section>

          <section>
            <h3 className="display-tight text-lg text-ink">
              It is not a medical device
            </h3>
            <p className="mt-3 text-sm text-ink-2">{DASHBOARD_DISCLAIMER}</p>
          </section>

          <section>
            <h3 className="display-tight text-lg text-ink">
              What it could not read
            </h3>
            <p className="mt-3 text-sm text-ink-2">
              {readingLine(medications, record)}
            </p>
          </section>
        </div>

        <details className="mt-9 border-t border-line pt-4">
          <summary className="flex min-h-[44px] cursor-pointer items-center text-base font-semibold text-ink">
            How today was decided, and what was held back
          </summary>
          <p className="measure mt-3 text-sm text-ink-2">
            {decidedLine(schedule, regimen)}
          </p>
        </details>
      </div>
    </footer>
  )
}
