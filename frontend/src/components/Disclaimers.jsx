export const DASHBOARD_DISCLAIMER =
  'CareLoop is a research prototype and is not a medical device. It does not provide medical advice, diagnosis, or treatment. If you are having a medical emergency, call 911. If you are in crisis, call or text 988.'

export function DashboardFooter() {
  return (
    <footer className="console-scope border-t border-line bg-console-bg text-console-ink">
      <div className="hold py-12">
        <p className="smallcaps text-micro text-console-accent">
          Please read this
        </p>
        <span
          aria-hidden="true"
          className="mt-4 block h-px w-full bg-console-line"
        />
        <p className="measure mt-6 text-console-ink">
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
