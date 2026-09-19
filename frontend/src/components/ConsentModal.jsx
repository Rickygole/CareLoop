import { useCallback, useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

export default function ConsentModal({ open, patientName, busy, onAgree, onCancel }) {
  const panel = useRef(null)
  const opener = useRef(null)

  const handleKey = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCancel()
        return
      }
      if (event.key !== 'Tab' || !panel.current) return

      const items = Array.from(panel.current.querySelectorAll(FOCUSABLE))
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [onCancel],
  )

  useEffect(() => {
    if (!open) return undefined

    opener.current = document.activeElement
    const body = document.body
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'

    const firstButton = panel.current && panel.current.querySelector('button')
    if (firstButton) firstButton.focus()

    return () => {
      body.style.overflow = previousOverflow
      if (opener.current && opener.current.focus) opener.current.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="enter-fade fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        aria-describedby="consent-body"
        onKeyDown={handleKey}
        className="enter-rise w-full max-w-lg overflow-hidden rounded-panel border border-line bg-surface shadow-modal"
      >
        <div className="px-7 pt-7 pb-6">
          <p className="text-micro font-semibold uppercase text-brand">
            Consent required
          </p>
          <h2
            id="consent-title"
            className="font-display mt-2 text-xl font-semibold tracking-[-0.008em] text-ink"
          >
            Before we connect your portal
          </h2>

          <div id="consent-body" className="mt-4 space-y-3 text-sm text-ink-2">
            <p className="max-w-[60ch]">
              CareLoop will read{' '}
              {patientName ? patientName + '\u2019s' : 'this'} medication list
              and dosing schedule so it can ask about doses during a check-in
              call, and it will record what is said on those calls.
            </p>
            <p className="max-w-[60ch]">
              CareLoop is a research prototype, not a medical device. It does
              not provide medical advice, diagnosis, or treatment.
            </p>
          </div>

          <p className="mt-5 rounded-control border border-line bg-surface-2 px-4 py-3 text-2xs leading-relaxed text-muted">
            This demo uses synthetic patient records only. Nothing here is a
            real person and nothing you enter should be real health
            information.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-line bg-surface-2 px-7 py-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink-2 transition-colors duration-150 hover:border-line-strong hover:bg-sunken"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onAgree}
            disabled={busy}
            className="rounded-control bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-[background-color,transform] duration-150 ease-out hover:bg-brand-deep active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? 'Connecting...' : 'I agree, connect my portal'}
          </button>
        </div>
      </div>
    </div>
  )
}
