export const DASHBOARD_DISCLAIMER =
  'CareLoop is a research prototype and is not a medical device. It does not provide medical advice, diagnosis, or treatment. If you are having a medical emergency, call 911. If you are in crisis, call or text 988.'

export function DashboardFooter() {
  return (
    <footer className="mt-24 border-t-2 border-line-ink bg-surface">
      <div className="mx-auto max-w-[72rem] px-6 py-10 sm:px-8">
        <p className="smallcaps text-micro text-muted">Please read this</p>
        <p className="measure mt-3 text-sm text-ink-2">
          {DASHBOARD_DISCLAIMER}
        </p>
        <p className="measure mt-4 text-sm text-muted">
          Every patient, medicine and clinic on this page is made up for the
          demonstration. Nothing here belongs to a real person.
        </p>
      </div>
    </footer>
  )
}
