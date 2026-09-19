import { useState } from 'react'

import { BTN_HERO, BTN_QUIET } from '../lib/ui.js'
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
  [CALL_STATUS.DIALLING]: 'Placing the call. Keep your phone to hand.',
  [CALL_STATUS.RINGING]: 'Your phone is ringing now. Pick up and talk to CareLoop.',
  [CALL_STATUS.CONNECTED]: 'You are on the call with CareLoop.',
  [CALL_STATUS.ENDED]: 'The call has ended.',
}

function Channel({ live, label, heading, body, children }) {
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
          {label || (live ? 'Live here' : 'Not switched on here')}
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
  const [confirming, setConfirming] = useState(false)

  const phoneLive = isConfigured() && typeof onRing === 'function'

  const ring = async () => {
    setConfirming(false)
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
        CareLoop rings your telephone. You never call it.
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
              ? 'Press the button and the telephone rings, like any other call. CareLoop dials the number on this record and ' +
                (patientName || 'the patient') +
                ' picks up. No app, no screen.'
              : 'Calling out needs telephone settings that are not filled in here, so no phone will ring. Nothing is faked to cover for it.'
          }
        >
          {phoneLive ? (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={
                  status === CALL_STATUS.DIALLING ||
                  status === CALL_STATUS.RINGING
                }
                className={BTN_HERO}
              >
                {status === CALL_STATUS.DIALLING
                  ? 'Ringing your phone...'
                  : 'Ring my phone now'}
              </button>

              {confirming ? (
                <div className="enter-fade mt-7 rounded-card border border-line-strong bg-sand px-6 py-6">
                  <h4 className="display-tight text-lg text-ink">
                    This will ring your telephone
                  </h4>
                  <p className="measure mt-3 text-ink">
                    CareLoop is about to dial the phone number on this record.
                    Your telephone will ring in a moment, like any other call.
                    Have it next to you before you press Yes.
                  </p>
                  <div className="mt-8 flex flex-col gap-y-6 sm:flex-row sm:items-center sm:gap-x-12">
                    <button type="button" onClick={ring} className={BTN_HERO}>
                      Yes, ring my phone
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className={BTN_QUIET}
                    >
                      Not now
                    </button>
                  </div>
                </div>
              ) : null}

              <div role="status" aria-live="polite" className="mt-5 empty:hidden">
                {WORDING[status] ? (
                  <p className="text-sm font-semibold text-ink">
                    {WORDING[status]}
                    {sid ? (
                      <span className="numeric ml-3 text-sm font-normal text-ink-2">
                        Call reference {sid}
                      </span>
                    ) : null}
                  </p>
                ) : null}
                {status === CALL_STATUS.UNAVAILABLE ? (
                  <p className="measure text-sm font-semibold text-severe">
                    <span aria-hidden="true" className="mr-3">
                      {String.fromCharCode(9670)}
                    </span>
                    Your phone was not called. Nothing was dialled.
                    {missing.length
                      ? ' These telephone settings are missing: ' +
                        missing.join(', ') + '.'
                      : ''}{' '}
                    Answer in writing further down instead, or call your clinic
                    directly if this is urgent.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </Channel>

        <Channel
          live
          label="Also available"
          heading="The same check-in, in writing"
          body="If you would rather read and type than talk, answer in writing further down this page. Your answer goes to the same CareLoop service and the decision is the same."
        />
      </div>
    </section>
  )
}
