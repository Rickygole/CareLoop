import { useEffect, useRef, useState } from 'react'

function prefersReduced() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useCountUp(target, duration = 900, delay = 0) {
  const safe = typeof target === 'number' && Number.isFinite(target) ? target : null
  const [value, setValue] = useState(safe === null ? null : 0)
  const frame = useRef(0)
  const timer = useRef(0)

  useEffect(() => {
    if (safe === null) {
      setValue(null)
      return undefined
    }

    if (prefersReduced() || safe === 0) {
      setValue(safe)
      return undefined
    }

    setValue(0)
    let start = 0

    const tick = (now) => {
      if (!start) start = now
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(safe * eased))
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }

    timer.current = window.setTimeout(() => {
      frame.current = requestAnimationFrame(tick)
    }, delay)

    return () => {
      window.clearTimeout(timer.current)
      cancelAnimationFrame(frame.current)
    }
  }, [safe, duration, delay])

  return value
}
