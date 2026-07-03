import { Link } from 'react-router-dom'
import { Mic, Shield, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GlowingCard } from '@/components/aceternity/glowing-card'
import { PulseOrb } from '@/components/aceternity/pulse-orb'

const features = [
  {
    icon: Shield,
    title: 'Gentle monitoring',
    description: 'Cameras watch quietly. We only speak up when something may need attention.',
  },
  {
    icon: Mic,
    title: 'Voice help nearby',
    description: 'Tap to talk anytime, or let a calm voice start automatically if a fall is detected.',
  },
  {
    icon: Users,
    title: 'Family stays informed',
    description: 'Loved ones receive updates when you want help or when you say you are okay.',
  },
]

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="text-center">
        <PulseOrb status="safe" size="xl" icon={Shield} className="mx-auto mb-8" />
        <h1 className="text-elder-2xl font-bold tracking-tight text-balance">
          You are safe. We are here with you.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-elder-lg text-muted-foreground leading-relaxed">
          Senior Guardian keeps a peaceful eye on your space and listens when you need help —
          no complicated buttons, just a calm voice and clear choices.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild size="xl">
            <Link to="/monitor">
              <Shield className="h-6 w-6" />
              Start monitoring
            </Link>
          </Button>
          <Button asChild variant="outline" size="xl">
            <Link to="/voice">
              <Mic className="h-6 w-6" />
              Talk to helper
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <GlowingCard key={title} glowColor="teal">
            <Card>
              <CardHeader>
                <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-7 w-7" strokeWidth={1.75} />
                </div>
                <CardTitle className="text-elder-lg">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </GlowingCard>
        ))}
      </section>

      <GlowingCard glowColor="sky">
        <Card>
          <CardHeader>
            <CardTitle>Need help right now?</CardTitle>
            <CardDescription>
              Press the button below to talk to your safety companion, or start monitoring for automatic fall alerts.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row">
            <Button asChild size="xl" className="w-full sm:w-auto">
              <Link to="/voice">
                <Mic className="h-6 w-6" />
                Start voice session
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline" className="w-full sm:w-auto">
              <Link to="/monitor">
                <Shield className="h-6 w-6" />
                Go to monitor
              </Link>
            </Button>
          </CardContent>
        </Card>
      </GlowingCard>
    </div>
  )
}
