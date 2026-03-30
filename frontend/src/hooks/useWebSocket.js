import { useEffect, useRef, useCallback, useState } from 'react'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
const MAX_BACKOFF = 30000

export function useWebSocket(path, onMessage) {
  const wsRef = useRef(null)
  const retryRef = useRef(0)
  const timerRef = useRef(null)
  const pingRef = useRef(null)
  const [connected, setConnected] = useState(false)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(`${WS_URL}${path}`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      retryRef.current = 0
      // Ping every 30s to keep alive
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, 30000)
    }

    ws.onmessage = (event) => {
      if (event.data === 'pong') return
      try {
        const data = JSON.parse(event.data)
        onMessage?.(data)
      } catch {
        // ignore non-JSON
      }
    }

    ws.onclose = () => {
      setConnected(false)
      clearInterval(pingRef.current)
      // Exponential backoff: 1s, 2s, 4s, 8s... max 30s
      const delay = Math.min(1000 * Math.pow(2, retryRef.current), MAX_BACKOFF)
      retryRef.current++
      timerRef.current = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [path, onMessage])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(timerRef.current)
      clearInterval(pingRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { connected }
}

export function useJobWebSocket(jobId, onUpdate) {
  return useWebSocket(`/ws/jobs/${jobId}`, onUpdate)
}

export function useDashboardWebSocket(onUpdate) {
  return useWebSocket('/ws/dashboard', onUpdate)
}
