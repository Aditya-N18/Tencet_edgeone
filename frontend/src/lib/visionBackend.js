/** Vision (YOLO + camera) runs on the edge tablet, not on butterbase.dev. */

export function isLocalVisionHost() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

export function visionBackendUrl() {
  return import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8080'
}

export function visionApiBase() {
  return import.meta.env.VITE_API_URL || '/api'
}

/** True when this browser session can talk to the edge vision service. */
export function isVisionBackendExpected() {
  if (import.meta.env.VITE_BACKEND_URL) return true
  return isLocalVisionHost()
}

export function visionOfflineMessage() {
  if (isVisionBackendExpected()) {
    return 'Vision service offline — run .\\restart-backend.ps1 in the backend folder.'
  }
  return 'Room monitoring runs on the home tablet. Voice help and fall alerts work here; start the vision service on the tablet to enable the camera.'
}

export function visionDeployNotice() {
  return 'Camera and fall detection run on the in-room tablet (edge AI). This web app handles voice check-ins and family alerts via the cloud.'
}
