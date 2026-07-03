import { createContext, useContext, useEffect, useRef } from 'react'
import { useIncident } from '@/context/IncidentContext'
import { useVapiSession } from '@/hooks/useVapiSession'

const VoiceSessionContext = createContext(null)

export function VoiceSessionProvider({ children }) {
  const { activeIncident, clearIncident } = useIncident()
  const startedForRef = useRef(null)

  const session = useVapiSession({
    incident: activeIncident,
    onCallEnd: clearIncident,
  })

  const { isConfigured, sessionActive, startSession } = session

  useEffect(() => {
    // Auto-start voice only when a fall incident arrives (never on page load / manual).
    if (!activeIncident || !isConfigured || sessionActive) return
    if (activeIncident.status !== 'fall_detected') return
    if (activeIncident.event_type === 'manual_checkin') return
    if (startedForRef.current === activeIncident.id) return

    startedForRef.current = activeIncident.id
    startSession(activeIncident)
  }, [activeIncident, isConfigured, sessionActive, startSession])

  useEffect(() => {
    if (!activeIncident) {
      startedForRef.current = null
    }
  }, [activeIncident])

  return (
    <VoiceSessionContext.Provider value={session}>
      {children}
    </VoiceSessionContext.Provider>
  )
}

export function useVoiceSession() {
  const ctx = useContext(VoiceSessionContext)
  if (!ctx) {
    throw new Error('useVoiceSession must be used within VoiceSessionProvider')
  }
  return ctx
}
