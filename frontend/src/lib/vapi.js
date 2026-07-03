const publicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY
const assistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID

const PLACEHOLDER_KEYS = ['your-vapi-public-key', 'your-assistant-id', '']

export const isVapiConfigured = Boolean(
  publicKey &&
    assistantId &&
    !PLACEHOLDER_KEYS.includes(publicKey) &&
    !PLACEHOLDER_KEYS.includes(assistantId),
)

let client = null
let clientPromise = null

function resolveVapiConstructor(module) {
  const candidate = module?.default ?? module
  if (typeof candidate === 'function') return candidate
  if (typeof candidate?.default === 'function') return candidate.default
  return null
}

export async function getVapiClient() {
  if (!isVapiConfigured) return null
  if (client) return client

  if (!clientPromise) {
    clientPromise = import('@vapi-ai/web').then((mod) => {
      const Vapi = resolveVapiConstructor(mod)
      if (!Vapi) throw new Error('Vapi SDK failed to load')
      client = new Vapi(publicKey)
      return client
    })
  }

  return clientPromise
}

export { assistantId }
