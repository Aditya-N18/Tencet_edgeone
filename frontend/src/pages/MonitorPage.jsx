import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, Camera, Eye, Mic, Square, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GlowingCard } from '@/components/aceternity/glowing-card'
import { PulseOrb } from '@/components/aceternity/pulse-orb'
import { BackendStreamPreview } from '@/components/monitor/BackendStreamPreview'
import { useBackendStatus } from '@/context/BackendStatusContext'
import { useIncident } from '@/context/IncidentContext'
import { useVoiceSession } from '@/context/VoiceSessionContext'
import {
  visionApiBase,
  visionDeployNotice,
  visionFetchHeaders,
  visionOfflineMessage,
} from '@/lib/visionBackend'

const API_BASE = visionApiBase()

const mockEvents = [
  { id: 1, time: '2:14 PM', type: 'Routine check', status: 'All clear' },
  { id: 2, time: '11:30 AM', type: 'Movement detected', status: 'Normal activity' },
  { id: 3, time: 'Yesterday', type: 'Voice check-in', status: 'You said you feel fine' },
]

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function MonitorPage() {
  const { status, error: backendError, visionExpected, refresh } = useBackendStatus()
  const { activeIncident } = useIncident()
  const { sessionActive, listening } = useVoiceSession()
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [actionError, setActionError] = useState(null)
  const monitoringRef = useRef(false)

  const backendRunning = Boolean(status?.pipeline?.running)
  const active = isMonitoring || backendRunning
  const framesProcessed = status?.pipeline?.frames_processed ?? 0
  const lastEvent = status?.pipeline?.last_event ?? 'idle'

  const syncFromBackend = useCallback(async () => {
    const data = await refresh()
    const running = Boolean(data?.pipeline?.running)
    setIsMonitoring(running)
    monitoringRef.current = running
    return data
  }, [refresh])

  useEffect(() => {
    syncFromBackend()
  }, [syncFromBackend])

  useEffect(() => {
    monitoringRef.current = isMonitoring
  }, [isMonitoring])

  const startMonitoring = useCallback(async () => {
    setStarting(true)
    setActionError(null)
    try {
      const res = await fetch(`${API_BASE}/pipeline/start`, {
        method: 'POST',
        headers: visionFetchHeaders(),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.reason || 'Could not start monitoring')
      }
      if (!data.started && data.reason === 'already_running') {
        setIsMonitoring(true)
        monitoringRef.current = true
        await syncFromBackend()
        return
      }
      if (!data.started) {
        throw new Error(data.reason || 'Could not start monitoring')
      }

      setIsMonitoring(true)
      monitoringRef.current = true

      for (let i = 0; i < 40; i += 1) {
        await wait(500)
        const health = await refresh()
        if (health?.pipeline?.model_ready) break
      }
    } catch (err) {
      setIsMonitoring(false)
      monitoringRef.current = false
      setActionError(err.message)
    } finally {
      setStarting(false)
    }
  }, [refresh])

  const stopMonitoring = useCallback(async () => {
    setStopping(true)
    setActionError(null)
    setIsMonitoring(false)
    monitoringRef.current = false

    try {
      const res = await fetch(`${API_BASE}/pipeline/stop`, {
        method: 'POST',
        headers: visionFetchHeaders(),
      })
      if (!res.ok) throw new Error('Could not stop monitoring')
      await refresh()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setStopping(false)
    }
  }, [refresh])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-elder-2xl font-bold">Room monitor</h1>
        <p className="mt-3 text-elder-base text-muted-foreground">
          {active
            ? 'Camera is on and YOLO is watching quietly.'
            : visionExpected
              ? 'Camera stays off until you press Start monitoring.'
              : 'Voice help and alerts work here. Camera AI runs on the home tablet.'}
        </p>
      </div>

      {!visionExpected && (
        <div className="rounded-xl border border-calm-sky/30 bg-calm-sky/10 px-5 py-4 text-base text-muted-foreground">
          {visionDeployNotice()}
        </div>
      )}

      <GlowingCard glowColor={sessionActive ? 'amber' : active ? 'teal' : 'sky'}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Camera className="h-8 w-8 text-primary" />
              Live camera
            </CardTitle>
            <CardDescription>
              {sessionActive
                ? 'Camera stays on while your voice check-in is in progress.'
                : 'Your laptop camera only turns on while monitoring is active.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <BackendStreamPreview streaming={active} />

            {sessionActive && (
              <div className="flex items-center justify-center gap-3 rounded-xl border border-calm-amber/40 bg-calm-amber/10 px-5 py-4">
                <Mic className="h-6 w-6 text-calm-amber" />
                <div className="text-left">
                  <p className="text-elder-base font-medium text-calm-amber">
                    {listening ? 'Voice companion is listening…' : 'Voice companion is speaking…'}
                  </p>
                  <p className="text-base text-muted-foreground">
                    Stay on this page or anywhere in the app — help is active.
                  </p>
                </div>
              </div>
            )}

            {activeIncident && !sessionActive && (
              <div className="flex items-center justify-center gap-3 rounded-xl border border-calm-amber/40 bg-calm-amber/10 px-5 py-4">
                <PulseOrb status="alert" size="sm" icon={Mic} />
                <p className="text-elder-base font-medium text-calm-amber">
                  Fall detected — starting voice check-in…
                </p>
              </div>
            )}

            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              {!active ? (
                <Button
                  size="xl"
                  onClick={startMonitoring}
                  disabled={starting || !visionExpected || !!backendError}
                >
                  <Camera className="h-6 w-6" />
                  {starting ? 'Starting camera…' : 'Start monitoring'}
                </Button>
              ) : (
                <Button
                  size="xl"
                  variant="destructive"
                  onClick={stopMonitoring}
                  disabled={stopping || sessionActive}
                >
                  <Square className="h-6 w-6" />
                  {stopping ? 'Stopping…' : sessionActive ? 'End voice check-in first' : 'Stop monitoring'}
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Badge variant={active ? 'success' : 'secondary'}>
                {active ? 'Camera on' : 'Camera off'}
              </Badge>
              <Badge variant={status?.pipeline?.model_ready ? 'success' : 'secondary'}>
                {status?.pipeline?.model_ready ? 'YOLO active' : starting ? 'YOLO loading…' : 'YOLO idle'}
              </Badge>
            </div>

            {backendError && visionExpected && (
              <p className="text-center text-base text-calm-amber">
                {visionOfflineMessage()}
              </p>
            )}
            {actionError && (
              <p className="text-center text-base text-calm-rose">{actionError}</p>
            )}
          </CardContent>
        </Card>
      </GlowingCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Eye className="h-8 w-8 text-primary" />
              Detection status
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-4">
            <PulseOrb status={active ? 'safe' : 'calm'} size="lg" icon={Eye} />
            <p className="mt-4 text-elder-base font-medium capitalize">{lastEvent.replace(/_/g, ' ')}</p>
            <p className="mt-2 text-base text-muted-foreground">
              {framesProcessed} frames analyzed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-calm-sky" />
              System health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusRow
              icon={Wifi}
              label="Vision service"
              value={
                !visionExpected
                  ? 'On home tablet'
                  : backendError
                    ? 'Offline'
                    : 'Connected'
              }
              ok={!visionExpected || !backendError}
            />
            <StatusRow icon={Camera} label="Camera" value={active ? 'On' : 'Off'} ok={!active} />
            <StatusRow icon={Eye} label="Monitoring" value={active ? 'Active' : 'Stopped'} ok={active} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>A simple log — no scary technical details.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {mockEvents.map((event) => (
              <li
                key={event.id}
                className="flex flex-col gap-1 rounded-xl border border-border/50 bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-elder-base font-medium">{event.type}</p>
                  <p className="text-base text-muted-foreground">{event.time}</p>
                </div>
                <Badge variant="success">{event.status}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function StatusRow({ icon: Icon, label, value, ok }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/30 p-4">
      <div className="flex items-center gap-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
        <span className="text-elder-base">{label}</span>
      </div>
      <span className={ok ? 'text-calm-sage font-medium' : 'text-calm-amber font-medium'}>
        {value}
      </span>
    </div>
  )
}
