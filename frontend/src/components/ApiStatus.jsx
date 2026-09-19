import { useEffect, useState } from 'react'

import { API_BASE, health } from '../lib/api.js'

const STATES = {
  checking: {
    word: 'Checking the line',
    glyph: '○',
    light: 'text-muted',
    dark: 'text-console-muted',
  },
  ok: {
    word: 'CareLoop is online',
    glyph: '●',
    light: 'text-mild',
    dark: 'text-dark-mild',
  },
  down: {
    word: 'CareLoop is offline',
    glyph: '△',
    light: 'text-emergency',
    dark: 'text-dark-emergency',
  },
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
        'inline-flex items-center gap-2.5 text-2xs font-medium ' +
        (dark ? meta.dark : meta.light)
      }
      title={API_BASE}
    >
      <span aria-hidden="true" className="text-[0.75em] leading-none">
        {meta.glyph}
      </span>
      <span>{meta.word}</span>
    </span>
  )
}
