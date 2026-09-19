import { useEffect, useState } from 'react'

import { API_BASE, health } from '../lib/api.js'

const STATES = {
  checking: { word: 'Checking API', light: 'bg-line-strong', dark: 'bg-console-muted' },
  ok: { word: 'API connected', light: 'bg-mild', dark: 'bg-dark-mild' },
  down: { word: 'API unreachable', light: 'bg-emergency', dark: 'bg-dark-emergency' },
}

export default function ApiStatus({ tone = 'light' }) {
  const [state, setState] = useState('checking')

  useEffect(() => {
    let alive = true

    const check = async () => {
      try {
        await health()
        if (alive) setState('ok')
      } catch {
        if (alive) setState('down')
      }
    }

    check()
    const timer = setInterval(check, 10000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  const dark = tone === 'dark'
  const meta = STATES[state]

  return (
    <span
      className={
        'hidden items-center gap-2 text-2xs font-medium sm:inline-flex ' +
        (dark ? 'text-console-muted' : 'text-muted')
      }
      title={API_BASE}
    >
      <span className="relative flex size-1.5 shrink-0">
        <span
          aria-hidden="true"
          className={'size-1.5 rounded-full ' + (dark ? meta.dark : meta.light)}
          style={
            state === 'ok'
              ? { animation: 'live-pulse 2.4s ease-in-out infinite' }
              : undefined
          }
        />
      </span>
      <span>{meta.word}</span>
    </span>
  )
}
