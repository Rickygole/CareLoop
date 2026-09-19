import { useEffect, useState } from 'react'

import { API_BASE, health } from '../lib/api.js'

const STATES = {
  checking: {
    word: 'Checking the line',
    glyph: String.fromCharCode(9675),
    light: 'text-ink-2',
    dark: 'text-console-muted',
    ocean: 'text-brand-ink-2',
  },
  ok: {
    word: 'CareLoop is online',
    glyph: String.fromCharCode(9679),
    light: 'text-mild',
    dark: 'text-dark-mild',
    ocean: 'text-sand',
  },
  down: {
    word: 'CareLoop is offline',
    glyph: String.fromCharCode(9651),
    light: 'text-emergency',
    dark: 'text-dark-emergency',
    ocean: 'text-ocean-alert',
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

  const meta = STATES[state]
  const colour = meta[tone] || meta.light

  return (
    <span
      className={
        'inline-flex items-center gap-3 text-2xs font-semibold ' + colour
      }
      title={API_BASE}
    >
      <span aria-hidden="true" className="text-[0.8em] leading-none">
        {meta.glyph}
      </span>
      <span>{meta.word}</span>
    </span>
  )
}
