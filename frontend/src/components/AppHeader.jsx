import { Link } from 'react-router-dom'

import ApiStatus from './ApiStatus.jsx'

function Wordmark() {
  return (
    <span className="inline-flex items-baseline gap-2.5">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="translate-y-[3px]"
      >
        <rect width="24" height="24" rx="6" fill="#0F766E" />
        <path
          d="M5 13h2.6l1.3-4 2.2 7.4 1.7-4.8 1 1.4H19"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-display text-xl font-semibold tracking-[-0.01em] text-ink">
        CareLoop
      </span>
    </span>
  )
}

export default function AppHeader({ right }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-4">
          <Wordmark />
          <span className="hidden border-l border-line pl-4 text-micro font-semibold uppercase text-muted sm:inline">
            Research prototype
          </span>
        </div>

        <div className="flex items-center gap-5">
          {right}
          <ApiStatus />
          <Link
            to="/admin-demo"
            className="rounded-control px-2.5 py-1.5 text-sm font-medium text-brand underline decoration-brand/30 decoration-1 underline-offset-4 transition-colors duration-150 hover:bg-brand-tint hover:decoration-brand"
          >
            Judge console
          </Link>
        </div>
      </div>
    </header>
  )
}
