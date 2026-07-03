/** Vision (YOLO + camera) runs on the edge tablet; may be exposed via tunnel for hosted UI. */

function isLocalVisionHost() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

function stripSlash(url) {
  return String(url || '').replace(/\/$/, '')
}

/** Public tunnel or explicit backend URL (baked at build time for EdgeOne). */
export function visionBackendUrl() {
  const fromEnv = stripSlash(import.meta.env.VITE_BACKEND_URL)
  if (fromEnv) return fromEnv
  if (isLocalVisionHost()) return 'http://127.0.0.1:8080'
  return ''
}

export function visionApiBase() {
  const fromEnv = stripSlash(import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL)
  if (fromEnv) return fromEnv
  if (isLocalVisionHost()) return '/api'
  return ''
}

/** True when this browser session can talk to the edge vision service. */
export function isVisionBackendExpected() {
  return Boolean(visionBackendUrl() || visionApiBase())
}

/** Headers required by ngrok free tier (skip browser warning interstitial). */
export function visionFetchHeaders(extra = {}) {
  const url = visionBackendUrl() || visionApiBase()
  const headers = { ...extra }
  if (url.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true'
  }
  return headers
}

export function visionOfflineMessage() {
  if (isVisionBackendExpected()) {
    return 'Vision service offline — start the backend on the tablet (restart-backend.ps1) and keep the tunnel running.'
  }
  return 'Room monitoring runs on the home tablet. Voice help and fall alerts work here; start the vision service on the tablet to enable the camera.'
}

export function visionDeployNotice() {
  return 'Camera and fall detection run on the in-room tablet (edge AI). This site handles voice check-ins and family alerts via Butterbase and Vapi.'
}
