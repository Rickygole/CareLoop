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
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 enter-fade sm:items-center"
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
        className="w-full max-w-lg rounded-[16px] border border-line bg-surface p-6 shadow-[0_20px_60px_-20px_rgba(22,25,29,0.35)] enter-rise sm:p-8"
      >
        <h2 id="consent-title" className="text-xl font-semibold tracking-tight">
          Before we connect your portal
        </h2>

        <div id="consent-body" className="mt-4 space-y-3 text-sm text-ink-2">
          <p>
            CareLoop will read {patientName ? patientName + "'s" : 'this'} medication
            list and dosing schedule so it can ask about doses during a check-in
            call, and it will record what is said on those calls.
          </p>
          <p>
            CareLoop is a research prototype, not a medical device. It does not
            provide medical advice, diagnosis, or treatment.
          </p>
          <p className="rounded-[10px] bg-sunken px-3 py-2 text-xs text-muted">
            This demo uses synthetic patient records only. Nothing here is a real
            person and nothing you enter should be real health information.
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[10px] border border-line px-4 py-2.5 text-sm font-medium text-ink-2 transition-colors duration-150 hover:bg-sunken"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onAgree}
            disabled={busy}
            className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white transition-[background-color,transform] duration-150 ease-out hover:bg-brand-deep active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? 'Connecting...' : 'I agree, connect my portal'}
          </button>
        </div>
      </div>
    </div>
  )
}
