import TimeTravel from './TimeTravel.jsx'
import { useSession } from '../lib/session.jsx'

export const MADE_UP =
  'Every patient, medicine and clinic on this page is made up for the demonstration. Nothing here belongs to a real person.'

export default function DemoStrip() {
  const { schedule, clockShiftMs, setClockShiftMs } = useSession()

  return (
    <aside
      aria-label="Demonstration"
      className="console-scope bg-console-bg text-console-ink"
    >
      <div className="hold flex flex-wrap items-center gap-x-8 gap-y-4 py-3">
        <p className="measure text-sm text-console-ink-2">
          <span className="smallcaps mr-3 text-micro text-console-accent">
            Demonstration
          </span>
          {MADE_UP}
        </p>

        <div className="sm:ml-auto">
          <TimeTravel
            plan={schedule}
            shiftMs={clockShiftMs}
            onShift={setClockShiftMs}
          />
        </div>
      </div>
    </aside>
  )
}
