import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchEventsSince, traceSocketUrl } from './api.js'

const POLL_MS = 500
const RETRY_MS = 2000
const MAX_RETRIES = 5

function defaultTransport() {
  if (typeof window === 'undefined') return 'auto'
  const local = ['localhost', '127.0.0.1', '0.0.0.0']
  return local.includes(window.location.hostname) ? 'auto' : 'poll'
}

const FORCED = import.meta.env.VITE_TRACE_TRANSPORT || defaultTransport()

export const TRACE_STATUS = {
  CONNECTING: 'connecting',
  LIVE: 'live',
  POLLING: 'polling',
  RECONNECTING: 'reconnecting',
  OFFLINE: 'offline',
}

export function useTrace() {
  const [events, setEvents] = useState([])
  const [status, setStatus] = useState(TRACE_STATUS.CONNECTING)
  const [retries, setRetries] = useState(0)

  const lastSeq = useRef(0)
  const socket = useRef(null)
  const pollTimer = useRef(null)
  const retryTimer = useRef(null)
  const attempts = useRef(0)
  const alive = useRef(true)
  const polling = useRef(false)

  const push = useCallback((incoming) => {
    const numbered = incoming.filter((e) => typeof e.seq === 'number')
    if (!numbered.length) return

    const maxIncoming = Math.max(...numbered.map((e) => e.seq))
    const resynced = maxIncoming < lastSeq.current
    const floor = resynced ? 0 : lastSeq.current

    const fresh = numbered.filter((e) => e.seq > floor)
    if (!fresh.length) return

    lastSeq.current = fresh[fresh.length - 1].seq
    setEvents((prev) => (resynced ? fresh : prev.concat(fresh)))
  }, [])

  const stopPolling = useCallback(() => {
    polling.current = false
    if (pollTimer.current) {
      clearTimeout(pollTimer.current)
      pollTimer.current = null
    }
  }, [])

  const startPolling = useCallback(
    (nextStatus) => {
      if (polling.current) {
        if (nextStatus) setStatus(nextStatus)
        return
      }
      polling.current = true
      if (nextStatus) setStatus(nextStatus)

      const tick = async () => {
        if (!alive.current || !polling.current) return
        try {
          const data = await fetchEventsSince(0)
          if (!alive.current || !polling.current) return
          push(data.events || [])
          setStatus((current) =>
            current === TRACE_STATUS.OFFLINE || current === TRACE_STATUS.CONNECTING
              ? TRACE_STATUS.POLLING
              : current,
          )
        } catch {
          if (!alive.current || !polling.current) return
          setStatus(TRACE_STATUS.OFFLINE)
        }
        if (alive.current && polling.current) {
          pollTimer.current = setTimeout(tick, POLL_MS)
        }
      }

      tick()
    },
    [push],
  )

  const openSocket = useCallback(() => {
    if (!alive.current) return
    let ws
    try {
      ws = new WebSocket(traceSocketUrl())
    } catch {
      startPolling(TRACE_STATUS.RECONNECTING)
      return
    }
    socket.current = ws

    ws.onopen = () => {
      if (!alive.current) return
      attempts.current = 0
      setRetries(0)
      stopPolling()
      setStatus(TRACE_STATUS.LIVE)
    }

    ws.onmessage = (message) => {
      if (!alive.current) return
      try {
        const event = JSON.parse(message.data)
        if (event.event_type === 'PING') return
        push([event])
      } catch {
      }
    }

    ws.onerror = () => {
      try {
        ws.close()
      } catch {
      }
    }

    ws.onclose = () => {
      if (!alive.current || socket.current !== ws) return
      socket.current = null

      if (attempts.current >= MAX_RETRIES) {
        startPolling(TRACE_STATUS.POLLING)
        return
      }

      attempts.current += 1
      setRetries(attempts.current)
      startPolling(TRACE_STATUS.RECONNECTING)
      retryTimer.current = setTimeout(openSocket, RETRY_MS)
    }
  }, [push, startPolling, stopPolling])

  useEffect(() => {
    alive.current = true

    if (FORCED === 'poll') {
      startPolling(TRACE_STATUS.POLLING)
    } else {
      openSocket()
    }

    return () => {
      alive.current = false
      stopPolling()
      if (retryTimer.current) clearTimeout(retryTimer.current)
      if (socket.current) {
        const ws = socket.current
        socket.current = null
        try {
          ws.close()
        } catch {
        }
      }
    }
  }, [openSocket, startPolling, stopPolling])

  const clear = useCallback(() => {
    setEvents([])
  }, [])

  return { events, status, retries, clear, maxRetries: MAX_RETRIES }
}
