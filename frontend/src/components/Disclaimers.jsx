export const DASHBOARD_DISCLAIMER =
  'CareLoop is a research prototype and is not a medical device. It does not provide medical advice, diagnosis, or treatment. If you are having a medical emergency, call 911. If you are in crisis, call or text 988.'

export const CONSOLE_DISCLAIMER =
  'Demonstration only. All patient records are synthetic. Do not enter real personal health information.'

export function DashboardFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto max-w-5xl px-6 py-7">
        <p className="text-micro font-semibold uppercase text-muted">
          Important
        </p>
        <p className="mt-2 max-w-[72ch] text-2xs leading-relaxed text-muted">
          {DASHBOARD_DISCLAIMER}
        </p>
      </div>
    </footer>
  )
}

export function ConsoleNotice() {
  return (
    <p className="flex items-center gap-2.5 rounded-control border border-dark-moderate/25 bg-dark-moderate/8 px-3.5 py-2.5 text-2xs leading-relaxed text-console-ink-2">
      <span
        aria-hidden="true"
        className="shrink-0 font-mono text-2xs font-bold text-dark-moderate"
      >
        [!]
      </span>
      <span>{CONSOLE_DISCLAIMER}</span>
    </p>
  )
}
