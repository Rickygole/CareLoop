import { useRef, useState } from 'react'

import Notice from './Notice.jsx'
import { BTN_HERO, BTN_QUIET, FIELD, PANEL } from '../lib/ui.js'

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
    <form onSubmit={submit} className="mt-10">
      <div className={PANEL + ' px-6 py-8 sm:px-10 sm:py-10'}>
        <label htmlFor="free-text" className="display block text-xl text-ink">
          Answer in writing
        </label>
        <p className="measure mt-3 text-ink-2">
          Say how you are feeling in your own words. There is no right way to
          put it.
        </p>

        {scenarios && scenarios.length ? (
          <div className="mt-8">
            <p className="smallcaps text-micro text-clay">
              Not sure what to say? Borrow one of these
            </p>
            <div className="mt-5 flex flex-wrap gap-5">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => pick(scenario)}
                  className={BTN_QUIET}
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
          className={FIELD + ' mt-8 block resize-y'}
        />

        <div className="mt-7 flex flex-wrap items-center gap-x-10 gap-y-6">
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className={BTN_HERO}
          >
            {busy ? 'Sending your answer...' : 'Send my answer'}
          </button>
          <p className="max-w-[30ch] text-sm text-ink-2">
            Your answer is written to a made up patient record, not to you.
          </p>
        </div>

        {error ? (
          <Notice
            role="alert"
            tone="alarm"
            word="CareLoop could not send your answer"
            className="enter-fade mt-8"
            size="sm"
          >
            {error}
          </Notice>
        ) : null}
      </div>
    </form>
  )
}
