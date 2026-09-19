import VoiceAgent from './VoiceAgent.jsx'
import { isConfigured } from '../lib/voice.js'

const SAFETY =
  'Please do not describe your own real health. This is a demonstration and every record in it is made up.'

function SafetyNotice() {
  return (
    <p className="mt-5 flex items-start gap-3 rounded-card border-2 border-dark-moderate/45 bg-dark-moderate/10 px-5 py-4 text-xs text-console-ink">
      <span aria-hidden="true" className="leading-[1.6] text-dark-moderate">
        {String.fromCharCode(9651)}
      </span>
      <span>{SAFETY}</span>
    </p>
  )
}

export default function VoicePanel({ patientId, patientName }) {
  const configured = isConfigured()
  const firstName = String(patientName || '').trim().split(/\s+/)[0] || ''

  return (
    <section
      aria-labelledby="voice-heading"
      className="console-scope mt-8 overflow-hidden rounded-panel border-2 border-console-inset bg-console-bg text-console-ink shadow-lift"
    >
      <div className="border-b border-console-line px-6 py-6 sm:px-8">
        <p className="text-micro font-semibold uppercase text-console-accent">
          The call itself
        </p>
        <h3
          id="voice-heading"
          className="font-display mt-2 text-xl font-semibold text-console-ink"
        >
          Speak with CareLoop out loud
        </h3>
        <p className="measure mt-2 text-sm text-console-ink-2">
          This is the real thing a patient hears. CareLoop talks, you answer in
          your own voice, and it decides what to do while you are still on the
          line.
        </p>

        <SafetyNotice />
      </div>

      <div className="voice-mount px-6 py-6 sm:px-8">
        {configured ? (
          <VoiceAgent patientId={patientId} patientName={firstName} />
        ) : (
          <div className="rounded-card border-2 border-dashed border-console-line-2 bg-console-inset px-6 py-6">
            <p className="font-display text-lg font-semibold text-console-ink">
              The voice call is not switched on right now
            </p>
            <p className="measure mt-3 text-sm text-console-ink-2">
              Nothing is broken. The phone line for this demonstration has not
              been connected yet. You can type how you are feeling in the box
              below instead, and CareLoop will do exactly the same thing with
              it.
            </p>
            <a
              href="#free-text"
              className="mt-6 inline-flex min-h-[52px] items-center rounded-control bg-console-accent px-7 py-3 text-sm font-semibold text-console-accent-ink transition-[background-color,transform] duration-200 ease-out hover:bg-console-accent-deep active:translate-y-px"
            >
              Type it instead
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
