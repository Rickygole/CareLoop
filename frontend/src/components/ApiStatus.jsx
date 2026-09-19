import { useEffect, useState } from 'react'

import { API_BASE, health } from '../lib/api.js'

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

  const dot =
    state === 'ok' ? 'bg-mild' : state === 'down' ? 'bg-emergency' : 'bg-muted'
  const word =
    state === 'ok' ? 'API connected' : state === 'down' ? 'API unreachable' : 'Checking API'
  const text = tone === 'dark' ? 'text-console-muted' : 'text-muted'

  return (
    <span
      className={'inline-flex items-center gap-2 text-xs ' + text}
      title={API_BASE}
    >
      <span className={'size-2 rounded-full ' + dot} aria-hidden="true" />
      <span>{word}</span>
    </span>
  )
}
