import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import AddMedication from '../components/AddMedication.jsx'
import CallSchedule from '../components/CallSchedule.jsx'
import InteractionFlags from '../components/InteractionFlags.jsx'
import MedicationCard from '../components/MedicationCard.jsx'
import NextUpCard from '../components/NextUpCard.jsx'
import RegimenSnapshot from '../components/RegimenSnapshot.jsx'
import Screen from '../components/Screen.jsx'
import TimeTravel from '../components/TimeTravel.jsx'
import { addMedication, regimenState } from '../lib/api.js'
import { applyClockShift } from '../lib/clock.js'
import { clockLabel, groupSchedule } from '../lib/format.js'
import { useSession } from '../lib/session.jsx'
import { ADD_PRESCRIBER } from '../data/medications.js'
import { patientName } from '../data/patients.js'

const CASCADE_STEPS = [
  'A new regimen snapshot is written',
  'The call schedule is worked out again',
  'Every pair of medicines is checked',
]

function reducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function MedsPage() {
  const {
    patientId,
    connected,
    record,
    medications,
    schedule,
    regimen,
    applyRegimen,
    clockShiftMs,
    setClockShiftMs,
  } = useSession()

  const [loading, setLoading] = useState(!schedule)
  const [loadFailed, setLoadFailed] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addFailed, setAddFailed] = useState(false)
  const [prior, setPrior] = useState(null)
  const [stage, setStage] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const timers = useRef([])

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
    },
    [],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      applyRegimen(await regimenState(patientId))
    } catch {
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [applyRegimen, patientId])

  useEffect(() => {
    if (!schedule && !loadFailed) load()
  }, [schedule, loadFailed, load])

  const add = useCallback(
    async (entry) => {
      setAdding(true)
      setAddFailed(false)
      const before = { medications, schedule, regimen }
      const gap = reducedMotion() ? 320 : 850

      try {
        const result = await addMedication({
          patient_id: patientId,
          medication: entry.medication,
          dosage_text: entry.dosage_text,
          frequency: entry.frequency,
          preferred_hours: entry.preferred_hours,
          prescriber: ADD_PRESCRIBER,
        })

        timers.current.forEach(clearTimeout)
        setPrior(before)
        setStage(1)
        applyRegimen(result)
        setAnnouncement(
          'Snapshot ' + result.regimen.content_hash + ' replaces ' +
            (before.regimen ? before.regimen.content_hash : 'the last one') + '.',
        )

        const nextPlan = applyClockShift(result.schedule, clockShiftMs)
        const flagged = (result.regimen.surfaced || [])[0]

        timers.current = [
          setTimeout(() => {
            setStage(2)
            setAnnouncement(
              nextPlan && nextPlan.next_dose
                ? 'Schedule worked out again. The next call is at ' +
                    clockLabel(nextPlan.next_dose.time) + '.'
                : 'Schedule worked out again. No call is left today.',
            )
          }, gap),
          setTimeout(() => {
            setStage(3)
            setAnnouncement(
              flagged
                ? 'Interaction flagged, ' +
                    flagged.ingredients.join(' and ') + ', ' +
                    flagged.severity + '.'
                : 'Checked every pair. Nothing to raise with the patient.',
            )
          }, gap * 2),
          setTimeout(() => {
            setPrior(null)
            setStage(0)
          }, gap * 3),
        ]
      } catch {
        setAddFailed(true)
      } finally {
        setAdding(false)
      }
    },
    [applyRegimen, clockShiftMs, medications, patientId, regimen, schedule],
  )

  const cascading = Boolean(prior)
  const shownRequests = cascading && stage < 2 ? prior.medications : medications
  const shownPlanRaw = cascading && stage < 2 ? prior.schedule : schedule
  const shownRegimen = cascading && stage < 3 ? prior.regimen : regimen
  const shownHash =
    cascading && stage < 1
      ? prior.regimen && prior.regimen.content_hash
      : regimen && regimen.content_hash

  const plan = useMemo(
    () => applyClockShift(shownPlanRaw, clockShiftMs),
    [shownPlanRaw, clockShiftMs],
  )

  const list = useMemo(() => {
    const frequencyById = new Map(
      (shownRequests || []).map((r) => [r.medication_id, r.frequency]),
    )
    return groupSchedule((plan && plan.doses) || []).map((med) => ({
      ...med,
      frequency: frequencyById.get(med.key) || '',
    }))
  }, [plan, shownRequests])

  const who = record ? record.name : patientName(patientId)
  const count = (shownRequests || []).length

  return (
    <Screen
      mark="02"
      label="Step 2 of 5"
      title="CareLoop went and got these"
      lead={
        count
          ? count +
            (count === 1 ? ' medicine came ' : ' medicines came ') +
            'across from MyHealth for ' +
            who +
            '. Nobody typed a word of it. CareLoop worked out the hour of every dose, and the call that goes with it, from the list itself.'
          : 'CareLoop reads the medicine list straight out of MyHealth and works out the hour of every dose, and the call that goes with it, from the list itself.'
      }
    >
      {!connected ? (
        <p className="measure mt-7 border-l-4 border-line-strong bg-surface-2 px-6 py-4 text-sm text-ink-2">
          You came straight to this screen. The list below is the same one the
          portal returns.{' '}
          <Link to="/" className="font-semibold text-brand-deep underline">
            Go back and connect MyHealth
          </Link>{' '}
          to see how it arrives.
        </p>
      ) : null}

      {loading ? (
        <p
          aria-live="polite"
          aria-busy="true"
          className="mt-10 border-t border-line pt-8 text-sm font-semibold text-muted"
        >
          Reading the medicine list...
        </p>
      ) : null}

      {loadFailed ? (
        <p
          role="alert"
          className="measure mt-10 flex items-start gap-3 border-l-4 border-emergency bg-emergency-tint px-6 py-5 text-emergency"
        >
          <span aria-hidden="true" className="leading-[1.6]">
            {String.fromCharCode(9651)}
          </span>
          <span>
            <strong className="font-semibold">
              The medicine list did not load.
            </strong>{' '}
            CareLoop could not reach the record.{' '}
            <button
              type="button"
              onClick={load}
              className="font-semibold text-emergency underline"
            >
              Try again
            </button>
            .
          </span>
        </p>
      ) : null}

      {!loading && !loadFailed && plan ? (
        <div>
          <NextUpCard dose={plan.next_dose} />

          <div className="mt-16 grid gap-x-14 gap-y-14 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0">
              <h2 className="font-display border-b-2 border-line-ink pb-2 text-2xl font-semibold text-ink">
                Your medicines, and when the call comes
              </h2>

              {list.length ? (
                <ul className="mt-2">
                  {list.map((med, index) => (
                    <MedicationCard key={med.key} med={med} index={index} />
                  ))}
                </ul>
              ) : (
                <p className="measure mt-7 text-ink-2">
                  There are no medicines on this record, so CareLoop has nothing
                  to call about. Add one below and the whole list wakes up.
                </p>
              )}
            </div>

            <aside className="border-t-2 border-line-ink pt-7 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-1">
              <CallSchedule plan={plan} flash={cascading && stage >= 2} />
              <TimeTravel
                plan={shownPlanRaw}
                shiftMs={clockShiftMs}
                onShift={setClockShiftMs}
              />
            </aside>
          </div>

          <InteractionFlags
            regimen={shownRegimen}
            flash={cascading && stage >= 3}
          />

          <section
            aria-labelledby="change-heading"
            className="mt-20 border-t-2 border-line-ink pt-8"
          >
            <h2
              id="change-heading"
              className="font-display text-2xl font-semibold text-ink"
            >
              If the list changes, the times change on their own
            </h2>
            <p className="measure mt-4 text-ink-2">
              Say a prescriber adds something tomorrow. Nobody tells CareLoop
              and nobody edits a schedule. Press the button and watch the call
              times and the safety check above redo themselves.
            </p>

            <AddMedication busy={adding} error={addFailed} onAdd={add} />

            <div role="status" aria-live="polite" className="mt-8">
              {cascading ? (
                <div className="enter-fade rounded-card border border-line bg-surface-2 px-6 py-5">
                  <p className="smallcaps text-micro text-muted">
                    What that just set off
                  </p>
                  <ol className="mt-3.5">
                    {CASCADE_STEPS.map((label, index) => {
                      const done = stage > index
                      return (
                        <li
                          key={label}
                          className="flex items-baseline gap-3.5 py-1.5"
                        >
                          <span
                            aria-hidden="true"
                            className={done ? 'text-mild' : 'text-line-strong'}
                          >
                            {done
                              ? String.fromCharCode(10003)
                              : String.fromCharCode(9675)}
                          </span>
                          <span
                            className={
                              'text-sm ' +
                              (done ? 'font-semibold text-ink' : 'text-muted')
                            }
                          >
                            {label}
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                  <p className="measure mt-3 text-sm text-ink-2">
                    {announcement}
                  </p>
                </div>
              ) : null}
            </div>

            <RegimenSnapshot
              hash={shownHash}
              previousHash={cascading ? prior.regimen.content_hash : null}
              count={(shownRequests || []).length}
              flash={cascading && stage >= 1}
            />
          </section>
        </div>
      ) : null}
    </Screen>
  )
}
