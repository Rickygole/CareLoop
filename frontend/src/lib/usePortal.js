import { useCallback, useEffect, useRef, useState } from 'react'

import { syncPortal } from './api.js'
import { useSession } from './session.jsx'

export function usePortal(enabled) {
  const { patientId, schedule, applyRegimen } = useSession()

  const [portal, setPortal] = useState(null)
  const [loading, setLoading] = useState(Boolean(enabled) && !schedule)
  const [loadFailed, setLoadFailed] = useState(false)
  const haveData = useRef(Boolean(schedule))

  useEffect(() => {
    haveData.current = Boolean(schedule)
  }, [schedule])

  const sync = useCallback(
    async (accept) => {
      const result = await syncPortal(patientId, Boolean(accept))
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
    setLoadFailed(false)
    try {
      await sync(false)
    } catch {
      if (!haveData.current) setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [enabled, sync])

  useEffect(() => {
    reload()
  }, [reload])

  return { portal, loading, loadFailed, reload, sync }
}
