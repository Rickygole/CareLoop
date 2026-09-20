import SimulatedCall from './SimulatedCall.jsx'
import VoiceAgent from './VoiceAgent.jsx'
import { SafetyNote } from './Disclaimers.jsx'
import { LEAD } from '../lib/ui.js'
import { isConfigured } from '../lib/voice.js'

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
      <h2 id="voice-heading" className="display text-xl text-ink">
        CareLoop rings your telephone
      </h2>
      <p className={LEAD + ' mt-4'}>
        You can answer out loud, the way you would on the phone.
      </p>

      <SafetyNote className="mt-4" />

      <div className="voice-mount mt-6">
        <VoiceAgent patientId={patientId} patientName={firstName} />
      </div>

      {children}
    </section>
  )
}
