import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { BackendStatusProvider } from '@/context/BackendStatusContext'
import { IncidentProvider } from '@/context/IncidentContext'
import { VoiceSessionProvider } from '@/context/VoiceSessionContext'
import HomePage from '@/pages/HomePage'
import MonitorPage from '@/pages/MonitorPage'
import VoicePage from '@/pages/VoicePage'
import SettingsPage from '@/pages/SettingsPage'

export default function App() {
  return (
    <BackendStatusProvider>
      <IncidentProvider>
        <VoiceSessionProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="monitor" element={<MonitorPage />} />
              <Route path="voice" element={<VoicePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </VoiceSessionProvider>
      </IncidentProvider>
    </BackendStatusProvider>
  )
}
