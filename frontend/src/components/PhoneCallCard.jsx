import { useState } from 'react'

import { BTN_PRIMARY } from '../lib/ui.js'
import {
  CALL_STATUS,
  callSidFrom,
  isConfigured,
  missingFrom,
  statusFromPayload,
} from '../lib/telephony.js'

const RING = String.fromCharCode(9679)
const DASH = String.fromCharCode(8213)

const WORDING = {
  [CALL_STATUS.DIALLING]: 'Placing the call.',
  [CALL_STATUS.RINGING]: 'Your phone is ringing now. Pick up and talk to CareLoop.',
  [CALL_STATUS.CONNECTED]: 'You are on the call with CareLoop.',
  [CALL_STATUS.ENDED]: 'The call has ended.',
}

function Channel({ live, heading, body, children }) {
  return (
    <div
      className={
        'ledge rounded-card border px-6 py-6 ' +
        (live
          ? 'ledge-strong border-line-strong bg-surface'
          : 'ledge-strong border-line bg-sunken')
      }
    >
      <p
        className={
          'flex items-center gap-3 ' + (live ? 'text-clay' : 'text-ink-2')
        }
      >
        <span aria-hidden="true" className="text-[1.1em] leading-none">
          {live ? RING : DASH}
        </span>
        <span className="smallcaps text-micro">
          {live ? 'Live here' : 'Not switched on here'}
        </span>
      </p>
      <h3 className="display-tight mt-3 text-lg text-ink">{heading}</h3>
      <p className="measure mt-2 text-sm text-ink-2">{body}</p>
      {children}
    </div>
  )
}

export default function PhoneCallCard({ patientName, onRing }) {
  const [status, setStatus] = useState(CALL_STATUS.IDLE)
  const [sid, setSid] = useState('')
  const [missing, setMissing] = useState([])

  const phoneLive = isConfigured() && typeof onRing === 'function'

  const ring = async () => {
    setStatus(CALL_STATUS.DIALLING)
    setMissing([])
    let payload = null
    try {
      payload = await onRing()
    } catch {
      payload = null
    }
    const next = statusFromPayload(payload)
    setSid(callSidFrom(payload))
    setMissing(missingFrom(payload))
    setStatus(next)
  }

  return (
    <section
      aria-labelledby="channel-heading"
      className="on-ocean ledge-strong mt-10 rounded-panel bg-brand px-6 py-8 text-brand-ink sm:px-10 sm:py-10"
    >
      <p className="smallcaps text-micro text-brand-ink-2">
        How this check-in reaches you
      </p>
      <h2 id="channel-heading" className="display mt-4 text-xl text-brand-ink">
        CareLoop calls you. You never call it.
      </h2>
      <p className="measure mt-4 text-brand-ink-2">
        There are two ways the same check-in can run, and the decision it
        reaches is identical either way. Only the one marked live is running
        here.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Channel
          live={phoneLive}
          heading="A real telephone call"
          body={
            phoneLive
              ? 'CareLoop dials the number on the record and ' +
                (patientName || 'the patient') +
                ' answers an ordinary phone call. No app, no screen.'
              : 'Outbound calling needs telephony credentials that are not set here, so no phone will ring. Nothing is faked to cover for it.'
          }
        >
          {phoneLive ? (
            <div className="mt-6">
              <button
                type="button"
                onClick={ring}
                disabled={
                  status === CALL_STATUS.DIALLING ||
                  status === CALL_STATUS.RINGING
                }
                className={BTN_PRIMARY}
              >
                {status === CALL_STATUS.DIALLING
                  ? 'Dialling...'
                  : 'Ring my phone now'}
              </button>

              <div role="status" aria-live="polite" className="mt-5 empty:hidden">
                {WORDING[status] ? (
                  <p className="text-sm font-semibold text-ink">
                    {WORDING[status]}
                    {sid ? (
                      <span className="numeric ml-3 font-mono text-xs font-normal text-ink-2">
                        {sid}
                      </span>
                    ) : null}
                  </p>
                ) : null}
                {status === CALL_STATUS.UNAVAILABLE ? (
                  <p className="text-sm font-semibold text-severe">
                    The call was not placed.
                    {missing.length
                      ? ' Missing settings: ' + missing.join(', ') + '.'
                      : ' The line did not answer.'}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </Channel>

        <Channel
          live={!phoneLive}
          heading="The same call, written out"
          body={
            phoneLive
              ? 'Available any time as a written stand-in, turn by turn, if you would rather read than talk.'
              : 'The check-in plays out below in writing, turn by turn. Every decision in it comes from the real CareLoop service, not from a script.'
          }
        />
      </div>
    </section>
  )
}
