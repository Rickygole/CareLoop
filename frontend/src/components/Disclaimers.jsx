export const DASHBOARD_DISCLAIMER =
  'CareLoop is a research prototype and is not a medical device. It does not provide medical advice, diagnosis, or treatment. If you are having a medical emergency, call 911. If you are in crisis, call or text 988.'

export function DashboardFooter() {
  return (
    <footer className="console-scope border-t-4 border-ink bg-console-bg text-console-ink">
      <div className="hold py-16">
        <p className="smallcaps text-micro text-console-accent">
          Please read this
        </p>
        <span
          aria-hidden="true"
          className="mt-5 block h-[6px] w-20 rounded-full bg-console-accent"
        />
        <p className="measure mt-7 text-console-ink">
          {DASHBOARD_DISCLAIMER}
        </p>
        <p className="measure mt-5 text-sm text-console-ink-2">
          Every patient, medicine and clinic on this page is made up for the
          demonstration. Nothing here belongs to a real person.
        </p>
      </div>
    </footer>
  )
}
