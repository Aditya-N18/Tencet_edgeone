import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  isVisionBackendExpected,
  visionApiBase,
  visionFetchHeaders,
} from '@/lib/visionBackend'

const POLL_MS = 8000

const BackendStatusContext = createContext({
  status: null,
  error: null,
  monitoring: false,
  visionExpected: true,
  refresh: async () => {},
})

export function BackendStatusProvider({ children }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const visionExpected = isVisionBackendExpected()
  const apiBase = visionApiBase()

  const refresh = useCallback(async () => {
    if (!visionExpected) {
      setError(null)
      setStatus(null)
      return null
    }
    try {
      const res = await fetch(`${apiBase}/health`, {
        headers: visionFetchHeaders(),
      })
      if (!res.ok) throw new Error(`Health check failed (${res.status})`)
      const data = await res.json()
      setStatus(data)
      setError(null)
      return data
    } catch (err) {
      setError(err.message)
      setStatus(null)
      return null
    }
  }, [apiBase, visionExpected])

  useEffect(() => {
    if (!visionExpected) return undefined

    refresh()

    const id = setInterval(() => {
      if (document.hidden) return
      refresh()
    }, POLL_MS)

    const onVisible = () => {
      if (!document.hidden) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh, visionExpected])

  const monitoring = Boolean(status?.pipeline?.running)

  return (
    <BackendStatusContext.Provider
      value={{ status, error, monitoring, visionExpected, refresh }}
    >
      {children}
    </BackendStatusContext.Provider>
  )
}

export function useBackendStatus() {
  return useContext(BackendStatusContext)
}
