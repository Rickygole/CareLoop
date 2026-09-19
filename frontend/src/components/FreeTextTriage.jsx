import { useEffect, useRef, useState } from 'react'

export default function FreeTextTriage({ busy, error, onSubmit }) {
  const [text, setText] = useState('')
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
    <form onSubmit={submit} className="rounded-card border border-console-line bg-console-2 p-4">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor="free-text" className="text-sm font-semibold text-console-ink">
          Type a symptom in your own words
        </label>
        <span className="hidden font-mono text-2xs text-console-muted sm:inline">
          press / to focus, Enter to run
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id="free-text"
          ref={input}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="my chest is killing me and it hurts to breathe"
          autoComplete="off"
          spellCheck="false"
          className="min-w-0 flex-1 rounded-[10px] border border-console-line bg-console px-4 py-3 text-base text-console-ink placeholder:text-console-muted/70 transition-colors duration-150 hover:border-console-muted focus:border-[#2DD4BF]"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="shrink-0 rounded-[10px] bg-[#14B8A6] px-5 py-3 text-base font-semibold text-[#06201D] transition-[background-color,transform] duration-150 ease-out hover:bg-[#2DD4BF] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Running triage...' : 'Run triage'}
        </button>
      </div>

      <p className="mt-2 font-mono text-2xs text-console-muted">
        Goes straight to POST /triage. Nothing is scripted: whatever you type is
        what the pipeline sees.
      </p>

      {error ? (
        <p role="alert" className="mt-2 font-mono text-xs text-[#FF8A8A]">
          [error] {error}
        </p>
      ) : null}
    </form>
  )
}
