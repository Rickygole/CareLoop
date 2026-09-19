import { useRef, useState } from 'react'

export default function CheckIn({ busy, error, scenarios, onSubmit }) {
  const [text, setText] = useState('')
  const input = useRef(null)

  const submit = (event) => {
    event.preventDefault()
    const value = text.trim()
    if (!value || busy) return
    onSubmit(value)
  }

  const pick = (scenario) => {
    setText(scenario.transcript)
    if (input.current) input.current.focus()
  }

  return (
    <form onSubmit={submit} className="mt-8">
      <div className="rounded-panel border-2 border-line-ink bg-surface p-6 shadow-raised sm:p-8">
        <label
          htmlFor="free-text"
          className="font-display block text-xl font-semibold text-ink"
        >
          Answer in writing
        </label>
        <p className="measure mt-2 text-sm text-ink-2">
          Say how you are feeling in your own words. There is no right way to
          put it.
        </p>

        {scenarios && scenarios.length ? (
          <div className="mt-6">
            <p className="text-sm text-ink-2">
              Not sure what to say? Borrow one of these.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => pick(scenario)}
                  className="min-h-[44px] rounded-control border-2 border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink"
                >
                  {scenario.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <textarea
          id="free-text"
          ref={input}
          value={text}
          rows={3}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              submit(event)
            }
          }}
          placeholder="I have been dizzy for two days and my ankles are swollen"
          autoComplete="off"
          className="mt-6 block w-full resize-y rounded-card border-2 border-line-strong bg-surface-2 px-5 py-4 text-ink placeholder:text-muted focus:border-brand"
        />

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="min-h-[60px] rounded-control bg-brand px-9 py-4 text-lg font-semibold text-white shadow-raised transition-[background-color,transform,box-shadow] duration-200 ease-out hover:bg-brand-deep hover:shadow-lift active:translate-y-px disabled:cursor-not-allowed disabled:bg-muted disabled:shadow-none"
          >
            {busy ? 'CareLoop is calling...' : 'Start the check-in'}
          </button>
          <p className="text-sm text-muted">
            Nothing is stored about you. These are made up records.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="enter-fade mt-6 flex items-start gap-3 rounded-card border-2 border-emergency/50 bg-emergency-tint px-5 py-4 text-sm text-emergency"
          >
            <span aria-hidden="true" className="leading-[1.55]">
              {String.fromCharCode(9651)}
            </span>
            <span>
              <strong className="font-semibold">
                CareLoop could not place the call.
              </strong>{' '}
              {error}
            </span>
          </p>
        ) : null}
      </div>
    </form>
  )
}
