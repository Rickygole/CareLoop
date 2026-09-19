import { useEffect, useRef, useState } from 'react'

function Kbd({ children }) {
  return (
    <kbd className="rounded-[4px] border border-console-line-2 bg-console-inset px-1.5 py-0.5 font-mono text-micro font-medium text-console-ink-2">
      {children}
    </kbd>
  )
}

export default function FreeTextTriage({ busy, error, onSubmit }) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const input = useRef(null)

  useEffect(() => {
    const onKey = (event) => {
      const active = document.activeElement
      const typing =
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.isContentEditable)
      if (event.key === '/' && !typing) {
        event.preventDefault()
        if (input.current) input.current.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const submit = (event) => {
    event.preventDefault()
    const value = text.trim()
    if (!value || busy) return
    onSubmit(value)
  }

  return (
    <form
      onSubmit={submit}
      className="relative overflow-hidden rounded-card border border-console-line-2 bg-console-panel p-5"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[3px] bg-console-accent"
      />

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <label htmlFor="free-text" className="text-sm font-semibold text-console-ink">
          Type a symptom in your own words
        </label>
        <p className="hidden items-center gap-2 text-2xs text-console-muted sm:flex">
          <Kbd>/</Kbd>
          <span>to focus</span>
          <Kbd>Enter</Kbd>
          <span>to run</span>
        </p>
      </div>

      <p className="mt-1.5 max-w-[68ch] text-2xs leading-relaxed text-console-muted">
        Nothing here is scripted. This goes straight to POST /triage and the
        trace below is the pipeline reacting to your words.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div
          className={
            'flex min-w-0 flex-1 items-center rounded-control border bg-console-inset px-3 transition-colors duration-150 ' +
            (focused
              ? 'border-console-accent'
              : 'border-console-line hover:border-console-line-2')
          }
        >
          <span
            aria-hidden="true"
            className="shrink-0 pr-2 font-mono text-base text-console-accent"
          >
            {'>'}
          </span>
          <input
            id="free-text"
            ref={input}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="my chest is killing me and it hurts to breathe"
            autoComplete="off"
            spellCheck="false"
            className="min-w-0 flex-1 bg-transparent py-3.5 font-mono text-base text-console-ink outline-none placeholder:text-console-muted/60"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="shrink-0 rounded-control bg-console-accent px-5 py-3.5 text-sm font-bold uppercase tracking-[0.04em] text-console-accent-ink transition-[background-color,transform] duration-150 ease-out hover:bg-console-accent-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Running...' : 'Run triage'}
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 border-l-2 border-dark-emergency pl-3 font-mono text-xs text-dark-emergency"
        >
          [error] {error}
        </p>
      ) : null}
    </form>
  )
}
