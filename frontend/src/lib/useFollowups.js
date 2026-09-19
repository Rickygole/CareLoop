import { useCallback, useEffect, useState } from 'react'

import { followups } from './api.js'

export function useFollowups(patientId, enabled) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(Boolean(enabled))
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    setFailed(false)
    try {
      setData(await followups(patientId))
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [enabled, patientId])

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, failed, reload: load }
}

export function bookedVisits(data) {
  return ((data && data.visits) || []).filter((v) => v.status === 'booked')
}

export function unbookedVisits(data) {
  return ((data && data.visits) || []).filter((v) => v.status !== 'booked')
}
