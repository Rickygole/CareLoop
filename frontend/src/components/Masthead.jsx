import ApiStatus from './ApiStatus.jsx'

function Mark() {
  return (
    <svg
      width="46"
      height="46"
      viewBox="0 0 44 44"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="44" height="44" rx="14" fill="#F0C36B" />
      <path
        d="M30.5 16.5a10 10 0 1 0 2 9.5"
        fill="none"
        stroke="#0E3A4A"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <circle cx="30.5" cy="14" r="4.5" fill="#8E2F16" />
    </svg>
  )
}

export default function Masthead() {
  return (
    <header className="on-ocean border-b-4 border-ink bg-brand text-brand-ink">
      <div className="hold flex flex-wrap items-center justify-between gap-x-10 gap-y-4 py-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="flex items-center gap-4">
            <Mark />
            <span className="display text-xl text-brand-ink">CareLoop</span>
          </span>
          <p className="text-sm text-brand-ink-2">
            Demo system. All patient data is synthetic.
          </p>
        </div>
        <ApiStatus tone="ocean" />
      </div>
    </header>
  )
}
