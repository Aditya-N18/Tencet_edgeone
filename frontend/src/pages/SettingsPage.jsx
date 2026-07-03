import { Bell, Phone, User, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-elder-2xl font-bold">Settings</h1>
        <p className="mt-3 text-elder-base text-muted-foreground">
          Simple options for you or a family member to adjust.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <User className="h-7 w-7" />
            Your profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingField label="Name" value="Not set yet" />
          <SettingField label="Room" value="Living room tablet" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Phone className="h-7 w-7" />
            Emergency contacts
          </CardTitle>
          <CardDescription>People we can text when you ask for help.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-elder-base text-muted-foreground mb-4">No contacts added yet.</p>
          <Button variant="outline" size="lg">
            Add contact
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Volume2 className="h-7 w-7" />
            Sound & alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingField label="Voice volume" value="Comfortable (80%)" />
          <SettingField label="Alert chime" value="Soft bell" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Bell className="h-7 w-7" />
            Monitoring
          </CardTitle>
          <CardDescription>Camera detection sensitivity — lower means fewer alerts.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingField label="Sensitivity" value="Balanced" />
        </CardContent>
      </Card>
    </div>
  )
}

function SettingField({ label, value }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border/50 bg-muted/20 p-5 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-elder-base font-medium">{label}</span>
      <span className="text-base text-muted-foreground">{value}</span>
    </div>
  )
}
