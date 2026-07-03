import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { butterbaseConfig } from '@/lib/butterbase'

const IncidentContext = createContext(null)

const RECONNECT_MS = 3000

function isFallIncident(record) {
  return (
    record?.status === 'fall_detected' &&
    !record?.resolved_at &&
    record?.event_type !== 'manual_checkin'
  )
}

export function IncidentProvider({ children }) {
  const [activeIncident, setActiveIncident] = useState(null)
  const [connected, setConnected] = useState(false)
  const reconnectTimer = useRef(null)
  const activeIncidentId = useRef(null)

  useEffect(() => {
    activeIncidentId.current = activeIncident?.id ?? null
  }, [activeIncident?.id])

  const handleIncident = useCallback((record) => {
    if (!isFallIncident(record)) return
    setActiveIncident(record)
  }, [])

  const clearIncident = useCallback(() => {
    setActiveIncident(null)
  }, [])

  useEffect(() => {
    let ws
    let cancelled = false

    const connect = () => {
      if (cancelled) return
      ws = new WebSocket(butterbaseConfig.realtimeUrl)

      ws.onopen = () => {
        setConnected(true)
        ws.send(JSON.stringify({ type: 'subscribe', table: 'incidents' }))
      }

      ws.onmessage = (event) => {
        let msg
        try {
          msg = JSON.parse(event.data)
        } catch {
          return
        }

        if (msg.type !== 'change' || msg.table !== 'incidents') return

        if (msg.op === 'INSERT' && isFallIncident(msg.record)) {
          handleIncident(msg.record)
          return
        }

        if (msg.op === 'UPDATE' && msg.record?.id === activeIncidentId.current) {
          if (msg.record.resolved_at) {
            setActiveIncident(null)
          } else {
            setActiveIncident(msg.record)
          }
        }
      }

      ws.onclose = () => {
        setConnected(false)
        if (!cancelled) {
          reconnectTimer.current = window.setTimeout(connect, RECONNECT_MS)
        }
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      ws?.close()
    }
  }, [handleIncident])

  return (
    <IncidentContext.Provider
      value={{ activeIncident, connected, clearIncident, handleIncident }}
    >
      {children}
    </IncidentContext.Provider>
  )
}

export function useIncident() {
  const ctx = useContext(IncidentContext)
  if (!ctx) {
    throw new Error('useIncident must be used within IncidentProvider')
  }
  return ctx
}
