const appId = import.meta.env.VITE_BUTTERBASE_APP_ID || 'app_7e7uf91ohmyx'
const apiUrl = import.meta.env.VITE_BUTTERBASE_API_URL || 'https://api.butterbase.ai'

export const butterbaseConfig = {
  appId,
  apiUrl,
  realtimeUrl: `${apiUrl.replace(/^https/, 'wss').replace(/^http/, 'ws')}/v1/${appId}/realtime`,
}

// @butterbase/sdk can be wired later for auth/CRUD once Vite browser compat is configured.
