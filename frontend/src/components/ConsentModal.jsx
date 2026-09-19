import { useCallback, useEffect, useRef } from 'react'

import { BTN_PRIMARY, BTN_SECONDARY } from '../lib/ui.js'

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

export const SHARED_ITEMS = [
  'Active medication list',
  'Dose schedule',
  'Allergies',
  'Preferred contact window',
]

export default function ConsentModal({ open, insurerName, busy, onAllow, onDeny }) {
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
      className="enter-fade fixed inset-0 z-50 flex max-h-dvh items-end justify-center overflow-y-auto overscroll-contain bg-ink/70 p-4 sm:items-center"
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
        className="enter-land my-auto w-full max-w-2xl overflow-hidden rounded-panel border border-line bg-surface shadow-modal"
      >
        <div className="border-b border-line bg-brand-wash px-7 py-6 sm:px-10">
          <p className="smallcaps text-micro text-ink">
            We ask before we read anything
          </p>
          <h2 id="consent-title" className="display mt-3 text-xl text-ink">
            MyHealth wants to share four things
          </h2>
        </div>

        <div className="px-7 py-8 sm:px-10">
          <div id="consent-body" className="text-ink-2">
            <p className="measure text-ink">
              MyHealth will share with CareLoop
              {insurerName ? ', from your ' + insurerName + ' record' : ''}:
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              {SHARED_ITEMS.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-4 rounded-card border border-line bg-sunken px-5 py-3.5 text-sm font-semibold text-ink"
                >
                  <span aria-hidden="true" className="text-brand">
                    {String.fromCharCode(9679)}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="measure mt-7 text-ink-2">
              Nothing else is read, and nothing is shared back. CareLoop uses
              this to know when to call you and what to ask about.
            </p>
          </div>

          <p className="measure mt-7 text-sm text-ink-2">
            MyHealth is a fictional portal built for this demonstration, and
            every record behind it is made up.
          </p>
        </div>

        <div className="flex flex-col gap-y-6 border-t border-line bg-sunken px-7 py-8 sm:flex-row sm:justify-end sm:gap-x-12 sm:px-10">
          <button type="button" onClick={onDeny} className={BTN_SECONDARY}>
            Deny
          </button>
          <button
            type="button"
            onClick={onAllow}
            disabled={busy}
            className={BTN_PRIMARY}
          >
            {busy ? 'Connecting...' : 'Allow'}
          </button>
        </div>
      </div>
    </div>
  )
}
