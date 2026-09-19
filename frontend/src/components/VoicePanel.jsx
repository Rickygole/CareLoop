import SimulatedCall from './SimulatedCall.jsx'
import VoiceAgent from './VoiceAgent.jsx'
import { isConfigured } from '../lib/voice.js'

const SAFETY =
  'Please do not describe your own real health. This is a demonstration and every record in it is made up.'

function SafetyNotice() {
  return (
    <p className="mt-6 flex items-start gap-4 rounded-card border border-moderate bg-moderate-tint px-5 py-4 text-sm text-ink">
      <span aria-hidden="true" className="leading-[1.6] text-moderate">
        {String.fromCharCode(9651)}
      </span>
      <span className="measure">{SAFETY}</span>
    </p>
  )
}

export default function VoicePanel({
  patientId,
  patientName,
  nextDose,
  scenarios,
  busy,
  error,
  onReply,
  onRing,
}) {
  const configured = isConfigured()
  const firstName = String(patientName || '').trim().split(/\s+/)[0] || ''

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
      />
    )
  }

  return (
    <section
      aria-labelledby="voice-heading"
      className="ledge ledge-strong mt-10 overflow-hidden rounded-panel border border-line bg-surface text-ink"
    >
      <div className="px-6 py-8 sm:px-10">
        <h2 id="voice-heading" className="display text-xl text-ink">
          Answer out loud
        </h2>
        <p className="measure mt-3 text-ink-2">
          Press the button, and CareLoop speaks to you the way it would on the
          phone. Or type your answer further down instead.
        </p>

        <SafetyNotice />
      </div>

      <div className="voice-mount border-t border-line px-6 py-7 sm:px-10">
        <VoiceAgent patientId={patientId} patientName={firstName} />
      </div>
    </section>
  )
}
