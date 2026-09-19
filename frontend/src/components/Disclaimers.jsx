export const DASHBOARD_DISCLAIMER =
  'CareLoop is a research prototype and is not a medical device. It does not provide medical advice, diagnosis, or treatment. If you are having a medical emergency, call 911. If you are in crisis, call or text 988.'

export const CONSOLE_DISCLAIMER =
  'Demonstration only. All patient records are synthetic. Do not enter real personal health information.'

export function DashboardFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-5xl px-6 py-5">
        <p className="max-w-[70ch] text-xs leading-relaxed text-muted">
          {DASHBOARD_DISCLAIMER}
        </p>
      </div>
    </footer>
  )
}

export function ConsoleNotice() {
  return (
    <p className="flex items-start gap-2 text-xs leading-relaxed text-console-muted">
      <span aria-hidden="true" className="font-mono text-moderate">
        [!]
      </span>
      <span>{CONSOLE_DISCLAIMER}</span>
    </p>
  )
}
