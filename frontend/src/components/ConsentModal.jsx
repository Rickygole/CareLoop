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
      className="enter-fade fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 sm:items-center"
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
        className="enter-rise w-full max-w-2xl overflow-hidden rounded-panel border-2 border-line-ink bg-surface shadow-modal"
      >
        <div className="px-7 pb-8 pt-8 sm:px-10">
          <p className="smallcaps text-micro text-brand-deep">
            We ask before we read anything
          </p>
          <h2
            id="consent-title"
            className="font-display mt-3 border-b-2 border-line-ink pb-3 text-2xl font-semibold text-ink"
          >
            Before we connect your portal
          </h2>

          <div id="consent-body" className="mt-6 space-y-4 text-ink-2">
            <p className="measure">
              CareLoop will read{' '}
              {patientName ? patientName + String.fromCharCode(8217) + 's' : 'this'}{' '}
              list of medicines and the times they are due, so it can ask about
              them on a check-in call. It will keep a record of what is said on
              those calls.
            </p>
            <p className="measure">
              CareLoop is a research prototype. It is not a medical device and
              it does not give medical advice.
            </p>
          </div>

          <p className="measure mt-6 border-l-4 border-line-strong bg-surface-2 px-5 py-4 text-sm text-muted">
            This demonstration uses made up records only. Nothing here is a real
            person, and nothing you type should be real health information.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-4 border-t border-line bg-surface-2 px-7 py-6 sm:flex-row sm:justify-end sm:px-10">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[52px] rounded-control border-2 border-line-strong bg-surface px-6 py-3 text-sm font-semibold text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onAgree}
            disabled={busy}
            className="min-h-[52px] rounded-control bg-brand px-7 py-3 text-sm font-semibold text-white shadow-raised transition-[background-color,transform] duration-200 ease-out hover:bg-brand-deep active:translate-y-px disabled:bg-muted disabled:shadow-none"
          >
            {busy ? 'Connecting...' : 'Yes, connect my portal'}
          </button>
        </div>
      </div>
    </div>
  )
}
