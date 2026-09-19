import ApiStatus from './ApiStatus.jsx'

function Wordmark() {
  return (
    <span className="inline-flex items-baseline gap-3">
      <svg
        width="30"
        height="30"
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="translate-y-[4px]"
      >
        <rect width="24" height="24" rx="5" fill="#0B5148" />
        <path
          d="M5 13h2.6l1.3-4 2.2 7.4 1.7-4.8 1 1.4H19"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-display text-xl font-semibold text-ink">
        CareLoop
      </span>
    </span>
  )
}

export default function Masthead() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[72rem] flex-wrap items-center justify-between gap-x-8 gap-y-2 px-6 py-4 sm:px-8">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <Wordmark />
          <p className="text-2xs text-muted">
            Demo system. All patient data is synthetic.
          </p>
        </div>
        <ApiStatus />
      </div>
    </header>
  )
}
