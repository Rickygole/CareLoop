import { useCallback, useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

export const SHARED_ITEMS = [
  'Active medication list',
  'Dose schedule',
  'Allergies',
  'Preferred contact window',
]

export default function ConsentModal({ open, patientName, busy, onAllow, onDeny }) {
  const panel = useRef(null)
  const opener = useRef(null)

  const handleKey = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onDeny()
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
    [onDeny],
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
      className="enter-fade fixed inset-0 z-50 flex max-h-dvh items-end justify-center overflow-y-auto overscroll-contain bg-ink/60 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDeny()
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        aria-describedby="consent-body"
        onKeyDown={handleKey}
        className="enter-rise my-auto w-full max-w-2xl overflow-hidden rounded-panel border-2 border-line-ink bg-surface shadow-modal"
      >
        <div className="px-7 pb-8 pt-8 sm:px-10">
          <p className="smallcaps text-micro text-brand-deep">
            We ask before we read anything
          </p>
          <h2
            id="consent-title"
            className="font-display mt-3 border-b-2 border-line-ink pb-3 text-2xl font-semibold text-ink"
          >
            MyHealth wants to share four things
          </h2>

          <div id="consent-body" className="mt-6 text-ink-2">
            <p className="measure">
              MyHealth will share with CareLoop
              {patientName ? ', from the record for ' + patientName : ''}:
            </p>
            <ul className="mt-5 border-t border-line">
              {SHARED_ITEMS.map((item) => (
                <li
                  key={item}
                  className="flex items-baseline gap-4 border-b border-line py-3.5 text-ink"
                >
                  <span aria-hidden="true" className="text-muted">
                    {String.fromCharCode(8213)}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="measure mt-6">
              Nothing else is read, and nothing is shared back. CareLoop uses
              this to know when to call you and what to ask about.
            </p>
          </div>

          <p className="measure mt-6 border-l-4 border-line-strong bg-surface-2 px-5 py-4 text-sm text-muted">
            MyHealth is a fictional portal built for this demonstration, and
            every record behind it is made up.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-4 border-t border-line bg-surface-2 px-7 py-6 sm:flex-row sm:justify-end sm:px-10">
          <button
            type="button"
            onClick={onDeny}
            className="min-h-[52px] rounded-control border-2 border-line-strong bg-surface px-8 py-3 text-sm font-semibold text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={onAllow}
            disabled={busy}
            className="min-h-[52px] rounded-control bg-brand px-10 py-3 text-sm font-semibold text-white shadow-raised transition-[background-color,transform] duration-200 ease-out hover:bg-brand-deep active:translate-y-px disabled:bg-muted disabled:shadow-none"
          >
            {busy ? 'Connecting...' : 'Allow'}
          </button>
        </div>
      </div>
    </div>
  )
}
