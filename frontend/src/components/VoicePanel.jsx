import SimulatedCall from './SimulatedCall.jsx'
import VoiceAgent from './VoiceAgent.jsx'
import { isConfigured } from '../lib/voice.js'

const SAFETY =
  'Please do not describe your own real health. This is a demonstration and every record in it is made up.'

function SafetyNotice() {
  return (
    <p className="mt-6 flex items-start gap-4 rounded-card border-2 border-dark-moderate/45 bg-dark-moderate/10 px-5 py-4 text-sm text-console-ink">
      <span aria-hidden="true" className="leading-[1.6] text-dark-moderate">
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
      className="console-scope ledge ledge-night mt-10 overflow-hidden rounded-panel border-2 border-ink bg-console-bg text-console-ink"
    >
      <div className="px-6 py-8 sm:px-10">
        <h2 id="voice-heading" className="display text-xl text-console-ink">
          Answer out loud
        </h2>
        <p className="measure mt-3 text-console-ink-2">
          Press the button, and CareLoop speaks to you the way it would on the
          phone. Or type your answer further down instead.
        </p>

        <SafetyNotice />
      </div>

      <div className="voice-mount border-t-2 border-console-line px-6 py-7 sm:px-10">
        <VoiceAgent patientId={patientId} patientName={firstName} />
      </div>
    </section>
  )
}
