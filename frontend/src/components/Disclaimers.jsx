export const DASHBOARD_DISCLAIMER =
  'CareLoop is a research prototype and is not a medical device. It does not provide medical advice, diagnosis, or treatment. If you are having a medical emergency, call 911. If you are in crisis, call or text 988.'

export function DashboardFooter() {
  return (
    <footer className="border-t border-line bg-sunken text-ink-2">
      <div className="hold py-10">
        <p className="smallcaps text-micro text-clay">
          Please read this
        </p>
        <span
          aria-hidden="true"
          className="mt-4 block h-px w-full bg-line"
        />
        <p className="measure mt-6 text-sm text-ink-2">
          {DASHBOARD_DISCLAIMER}
        </p>
        <p className="measure mt-5 text-sm text-ink-2">
          Every patient, medicine and clinic on this page is made up for the
          demonstration. Nothing here belongs to a real person.
        </p>
      </div>
    </footer>
  )
}
