import { useCallback, useEffect, useState } from 'react'

import { followups, withTimeout } from './api.js'

export function useFollowups(patientId, enabled) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(Boolean(enabled))
  const [failed, setFailed] = useState(false)
  const [failure, setFailure] = useState('')

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    setFailed(false)
    setFailure('')
    try {
      setData(await withTimeout((signal) => followups(patientId, signal)))
    } catch (error) {
      setData(null)
      setFailed(true)
      setFailure(error && error.message ? error.message : '')
    } finally {
      setLoading(false)
    }
  }, [enabled, patientId])

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, failed, failure, reload: load }
}

export function bookedVisits(data) {
  return ((data && data.visits) || []).filter((v) => v.status === 'booked')
}

export function unbookedVisits(data) {
  return ((data && data.visits) || []).filter((v) => v.status !== 'booked')
}
