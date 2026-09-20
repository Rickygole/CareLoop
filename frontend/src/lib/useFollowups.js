import { useCallback, useEffect, useState } from 'react'

import { followups, withTimeout } from './api.js'

const CATCH_UP_DELAYS_MS = [1500, 3500]

export function useFollowups(patientId, enabled) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(Boolean(enabled))
  const [failed, setFailed] = useState(false)
  const [failure, setFailure] = useState('')

  const fetchOnce = useCallback(
    async (showSpinner) => {
      if (showSpinner) setLoading(true)
      setFailed(false)
      setFailure('')
      try {
        setData(await withTimeout((signal) => followups(patientId, signal)))
      } catch (error) {
        setData(null)
        setFailed(true)
        setFailure(error && error.message ? error.message : '')
      } finally {
        if (showSpinner) setLoading(false)
      }
    },
    [patientId],
  )

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    await fetchOnce(true)
  }, [enabled, fetchOnce])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return undefined
    }
    let cancelled = false
    fetchOnce(true)
    const timers = CATCH_UP_DELAYS_MS.map((delay) =>
      setTimeout(() => {
        if (!cancelled) fetchOnce(false)
      }, delay),
    )
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [enabled, fetchOnce])

  return { data, loading, failed, failure, reload: load }
}

export function bookedVisits(data) {
  return ((data && data.visits) || []).filter((v) => v.status === 'booked')
}

export function unbookedVisits(data) {
  return ((data && data.visits) || []).filter((v) => v.status !== 'booked')
}
