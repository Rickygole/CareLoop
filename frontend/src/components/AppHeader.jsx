import { Link } from 'react-router-dom'

import ApiStatus from './ApiStatus.jsx'

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#0F766E" />
        <path
          d="M9 17.5h3.2l1.6-4.4 2.6 8 2-5.2h4.6"
          fill="none"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-base font-semibold tracking-tight">CareLoop</span>
    </span>
  )
}

export default function AppHeader({ right }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3.5">
        <div className="flex items-center gap-4">
          <Wordmark />
          <span className="hidden rounded-full bg-sunken px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-muted sm:inline">
            Research prototype
          </span>
        </div>

        <div className="flex items-center gap-4">
          {right}
          <ApiStatus />
          <Link
            to="/admin-demo"
            className="rounded-[8px] px-2 py-1 text-sm font-medium text-brand transition-colors duration-150 hover:bg-brand-tint"
          >
            Judge console
          </Link>
        </div>
      </div>
    </header>
  )
}
