import SimulatedCall from './SimulatedCall.jsx'
import VoiceAgent from './VoiceAgent.jsx'
import { isConfigured } from '../lib/voice.js'

const SAFETY =
  'Please do not describe your own real health. This is a demonstration and every record in it is made up.'

export default function VoicePanel({
  patientId,
  patientName,
  nextDose,
  scenarios,
  busy,
  error,
  onReply,
  onRing,
  isDoseFlagged,
  children,
}) {
  const configured = isConfigured()
  const firstName =
    String(patientName || '')
      .trim()
      .split(/\s+/)[0] || ''

  if (!configured) {
    return (
      <SimulatedCall
        patientName={patientName}
        nextDose={nextDose}
        scenarios={scenarios}
        busy={busy}
        error={error}
        onReply={onReply}
        onRing={onRing}
        isDoseFlagged={isDoseFlagged}
      >
        {children}
      </SimulatedCall>
    )
  }

  return (
    <section aria-labelledby="voice-heading">
      <h2 id="voice-heading" className="display text-2xl text-ink">
        CareLoop rings your telephone
      </h2>
      <p className="measure mt-4 text-lg leading-[1.45] text-ink">
        You can answer out loud, the way you would on the phone.
      </p>

      <p className="measure mt-4 flex items-start gap-3 text-sm text-ink">
        <span aria-hidden="true" className="leading-[1.6] text-moderate">
          {String.fromCharCode(9651)}
        </span>
        <span>{SAFETY}</span>
      </p>

      <div className="voice-mount mt-6">
        <VoiceAgent patientId={patientId} patientName={firstName} />
      </div>

      {children}
    </section>
  )
}
