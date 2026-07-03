import { NavLink, Outlet } from 'react-router-dom'
import { Heart, Home, Mic, Settings, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BackgroundBeams } from '@/components/aceternity/background-beams'
import { VoiceAmbientOverlay } from '@/components/aceternity/voice-ambient-overlay'
import { useBackendStatus } from '@/context/BackendStatusContext'
import { useIncident } from '@/context/IncidentContext'
import { useVoiceSession } from '@/context/VoiceSessionContext'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/monitor', label: 'Monitor', icon: Shield },
  { to: '/voice', label: 'Voice Help', icon: Mic },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function AppLayout() {
  const { monitoring } = useBackendStatus()
  const { sessionActive } = useVoiceSession()
  const showAmbient = sessionActive && monitoring

  return (
    <div className="relative min-h-screen bg-background">
      <BackgroundBeams />
      <VoiceAmbientOverlay active={showAmbient} />

      <header className="relative z-10 border-b border-border/50 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Heart className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-elder-lg font-semibold tracking-tight">Senior Guardian</p>
              <p className="text-base text-muted-foreground">Your calm safety companion</p>
            </div>
          </div>
          <BadgeSafe />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-8 pb-32">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-border/50 bg-card/90 backdrop-blur-lg"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex max-w-6xl justify-around px-4 py-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[4.5rem] min-w-[5rem] flex-col items-center justify-center gap-2 rounded-2xl px-4 text-base font-medium transition-colors',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                )
              }
            >
              <Icon className="h-7 w-7" strokeWidth={1.75} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

function BadgeSafe() {
  const { activeIncident, connected } = useIncident()
  const { sessionActive } = useVoiceSession()

  if (sessionActive) {
    return (
      <div className="hidden items-center gap-2 rounded-full border border-calm-amber/50 bg-calm-amber/20 px-5 py-2 text-calm-amber sm:flex">
        <span className="h-2.5 w-2.5 rounded-full bg-calm-amber animate-pulse-slow" />
        <span className="text-base font-medium">Voice check-in active</span>
      </div>
    )
  }

  if (activeIncident) {
    return (
      <div className="hidden items-center gap-2 rounded-full border border-calm-amber/40 bg-calm-amber/15 px-5 py-2 text-calm-amber sm:flex">
        <span className="h-2.5 w-2.5 rounded-full bg-calm-amber animate-pulse-slow" />
        <span className="text-base font-medium">Fall detected</span>
      </div>
    )
  }

  return (
    <div className="hidden items-center gap-2 rounded-full border border-calm-sage/30 bg-calm-sage/10 px-5 py-2 text-calm-sage sm:flex">
      <span
        className={cn(
          'h-2.5 w-2.5 rounded-full animate-pulse-slow',
          connected ? 'bg-calm-sage' : 'bg-muted-foreground'
        )}
      />
      <span className="text-base font-medium">
        {connected ? 'Connected' : 'Connecting…'}
      </span>
    </div>
  )
}
