import { useCallback, useEffect, useRef, useState } from 'react'

import { syncPortal, withTimeout } from './api.js'
import { useSession } from './session.jsx'

export function usePortal(enabled) {
  const { patientId, schedule, applyRegimen } = useSession()

  const [portal, setPortal] = useState(null)
  const [loading, setLoading] = useState(Boolean(enabled) && !schedule)
  const [loadFailed, setLoadFailed] = useState(false)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [failure, setFailure] = useState('')
  const haveData = useRef(Boolean(schedule))

  useEffect(() => {
    haveData.current = Boolean(schedule)
  }, [schedule])

  const sync = useCallback(
    async (accept) => {
      const result = await withTimeout((signal) =>
        syncPortal(patientId, Boolean(accept), signal),
      )
      applyRegimen(result)
      setPortal(result)
      return result
    },
    [applyRegimen, patientId],
  )

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    if (!haveData.current) setLoading(true)
    setLoadFailed(false)
    setRefreshFailed(false)
    setFailure('')
    try {
      await sync(false)
    } catch (error) {
      setFailure(error && error.message ? error.message : '')
      if (haveData.current) setRefreshFailed(true)
      else setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [enabled, sync])

  useEffect(() => {
    reload()
  }, [reload])

  return { portal, loading, loadFailed, refreshFailed, failure, reload, sync }
}
