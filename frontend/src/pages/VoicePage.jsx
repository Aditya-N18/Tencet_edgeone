import { Mic, MicOff, Phone, Volume2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GlowingCard } from '@/components/aceternity/glowing-card'
import { PulseOrb } from '@/components/aceternity/pulse-orb'
import { BackendStreamPreview } from '@/components/monitor/BackendStreamPreview'
import { useBackendStatus } from '@/context/BackendStatusContext'
import { useIncident } from '@/context/IncidentContext'
import { useVoiceSession } from '@/context/VoiceSessionContext'
import { isVapiConfigured } from '@/lib/vapi'

export default function VoicePage() {
  const { activeIncident, clearIncident } = useIncident()
  const { monitoring } = useBackendStatus()
  const {
    sessionActive,
    listening,
    transcript,
    error,
    endSession,
  } = useVoiceSession()

  const handleEnd = async () => {
    await endSession()
    if (activeIncident) clearIncident()
  }

  const glowColor = activeIncident ? 'amber' : sessionActive ? 'sky' : 'teal'
  const lastAssistantLine = transcript.split('\n').filter((l) => l.startsWith('Assistant:')).pop()

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-elder-2xl font-bold">Voice help</h1>
        <p className="mx-auto mt-3 max-w-xl text-elder-base text-muted-foreground">
          {activeIncident || sessionActive
            ? 'We noticed a possible fall. Speak naturally — your safety companion will guide you.'
            : 'Voice help starts only when a fall is detected while monitoring is on.'}
        </p>
        {activeIncident && (
          <Badge variant="warning" className="mt-4">
            Fall alert · {Math.round(Number(activeIncident.confidence || 0) * 100)}% confidence
          </Badge>
        )}
        {!isVapiConfigured && (
          <p className="mx-auto mt-4 max-w-xl text-base text-calm-amber">
            Vapi not configured yet — add keys to <code className="text-sm">frontend/.env</code> and run{' '}
            <code className="text-sm">node scripts/setup-vapi-assistant.mjs</code>
          </p>
        )}
        {error && (
          <p className="mx-auto mt-4 max-w-xl text-base text-calm-rose" role="alert">
            {error}
          </p>
        )}
      </div>

      {monitoring && (
        <GlowingCard glowColor="teal">
          <Card>
            <CardHeader>
              <CardTitle className="text-elder-lg">Camera still watching</CardTitle>
              <CardDescription>
                Monitoring stays on during your voice check-in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BackendStreamPreview streaming />
            </CardContent>
          </Card>
        </GlowingCard>
      )}

      <GlowingCard glowColor={glowColor}>
        <Card className="overflow-hidden">
          <CardHeader className="text-center">
            <div className="flex justify-center py-4">
              <PulseOrb
                status={listening ? 'listening' : activeIncident ? 'alert' : sessionActive ? 'calm' : 'safe'}
                size="xl"
                icon={listening ? Mic : Volume2}
              />
            </div>
            <CardTitle>
              {sessionActive
                ? listening
                  ? 'I am listening…'
                  : 'Thinking…'
                : activeIncident
                  ? 'Starting voice check-in…'
                  : 'Waiting for a fall alert'}
            </CardTitle>
            <CardDescription>
              {sessionActive && lastAssistantLine && (
                <span className="block mt-4 text-elder-lg text-foreground">
                  {lastAssistantLine.replace(/^Assistant:\s*/, '')}
                </span>
              )}
              {!sessionActive && !activeIncident && (
                <span className="block mt-4 text-elder-base">
                  Go to Monitor and press Start monitoring. Voice help begins automatically only if a fall is detected.
                </span>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col items-center gap-4 pb-10">
            {sessionActive ? (
              <Button size="lg" variant="outline" onClick={handleEnd} className="w-full max-w-md">
                <MicOff className="h-6 w-6" />
                I am okay — end session
              </Button>
            ) : activeIncident ? (
              <Badge variant="warning">Connecting voice companion…</Badge>
            ) : (
              <Button asChild size="xl" variant="outline" className="w-full max-w-md">
                <Link to="/monitor">Go to Monitor</Link>
              </Button>
            )}

            {sessionActive && (
              <Badge variant="success" className="mt-2">
                Voice assistant active
              </Badge>
            )}
          </CardContent>
        </Card>
      </GlowingCard>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Phone className="h-7 w-7 text-calm-amber" />
            Emergency options
          </CardTitle>
          <CardDescription>
            The voice assistant will always ask before calling 911 or texting your family.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Button variant="outline" size="lg" disabled={!sessionActive}>
            Call family (via assistant)
          </Button>
          <Button variant="destructive" size="lg" disabled={!sessionActive}>
            Call 911 (with confirmation)
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
