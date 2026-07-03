/**
 * Creates or updates the Senior Guardian Vapi assistant.
 *
 * Usage:
 *   1. Add VAPI_API_KEY to backend/.env (private key from dashboard.vapi.ai)
 *   2. node scripts/setup-vapi-assistant.mjs
 *
 * Shell env vars override .env files. Writes assistant id to frontend/.env.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

/** Parse KEY=value lines from a .env file (no dependency). */
function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const vars = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    vars[key] = value
  }
  return vars
}

const backendEnv = loadEnvFile(join(root, 'backend', '.env'))
const frontendEnv = loadEnvFile(join(root, 'frontend', '.env'))

const env = (key) => process.env[key] || backendEnv[key] || frontendEnv[key]

const VAPI_API_KEY = env('VAPI_API_KEY')
const VAPI_PUBLIC_KEY = env('VITE_VAPI_PUBLIC_KEY') || env('VAPI_PUBLIC_KEY')
const EXISTING_ASSISTANT_ID = env('VITE_VAPI_ASSISTANT_ID') || env('VAPI_ASSISTANT_ID')
const EXISTING_FAMILY_ASSISTANT_ID = env('VAPI_FAMILY_ASSISTANT_ID')
const VAPI_PHONE_NUMBER_ID = env('VAPI_PHONE_NUMBER_ID') || 'cb7e27a3-b90b-4705-ac19-43b388cbe409'

const TOOLS_URL = 'https://api.butterbase.ai/v1/app_7e7uf91ohmyx/fn/vapi-tools'
const TOOL_SECRET = env('VAPI_TOOL_SECRET') || 'sg_vapi_tools_7k9m2x'

const VAPI_HEADERS = () => ({
  Authorization: `Bearer ${VAPI_API_KEY}`,
  'Content-Type': 'application/json',
})

/** Custom Tool definitions (POST /tool type=function) — names must match vapi-tools.js handlers. */
const FUNCTION_TOOL_DEFS = [
  {
    name: 'mark_voice_started',
    description: 'Call once at the start of the voice session to record that the check-in began.',
    parameters: {
      type: 'object',
      properties: {
        incident_id: { type: 'string', description: 'UUID of the current incident' },
      },
      required: ['incident_id'],
    },
  },
  {
    name: 'save_incident_response',
    description: 'Save one triage question and the senior answer to the incident report.',
    parameters: {
      type: 'object',
      properties: {
        incident_id: { type: 'string' },
        question: { type: 'string' },
        answer: { type: 'string' },
      },
      required: ['incident_id', 'question', 'answer'],
    },
  },
  {
    name: 'get_emergency_contacts',
    description: 'Get family contacts who can be notified by SMS.',
    parameters: {
      type: 'object',
      properties: {
        senior_id: { type: 'string' },
      },
      required: ['senior_id'],
    },
  },
  {
    name: 'get_first_aid_guidance',
    description: 'Get calm first-aid suggestions for a situation like fall, dizziness, bleeding, or chest pain.',
    parameters: {
      type: 'object',
      properties: {
        situation: {
          type: 'string',
          description: 'Brief description e.g. fall, dizziness, breathing, bleeding, chest_pain',
        },
      },
      required: ['situation'],
    },
  },
  {
    name: 'notify_family',
    description: 'Log that family should be notified. Prefer call_emergency_contact for an actual phone call.',
    parameters: {
      type: 'object',
      properties: {
        incident_id: { type: 'string' },
        senior_id: { type: 'string' },
        message: { type: 'string', description: 'Short alert message for family' },
      },
      required: ['incident_id', 'message'],
    },
  },
  {
    name: 'call_emergency_contact',
    async: true,
    description:
      'Start a background phone call to an emergency contact (e.g. son Aditya). This runs in parallel — do NOT end or pause the current conversation. After calling this tool, immediately reassure the senior that their loved one is being called and informed, then continue the check-in.',
    messages: [
      {
        type: 'request-start',
        content:
          "I'm calling your loved one right now to let them know what's going on. Please stay with me — you're not alone.",
        blocking: false,
      },
    ],
    parameters: {
      type: 'object',
      properties: {
        incident_id: { type: 'string' },
        senior_id: { type: 'string' },
        contact_name: {
          type: 'string',
          description: 'Contact to call, e.g. Aditya. Defaults to first emergency contact.',
        },
        situation_summary: {
          type: 'string',
          description: 'Brief summary of the fall/alert and how Margaret is doing right now',
        },
      },
      required: ['incident_id', 'situation_summary'],
    },
  },
  {
    name: 'resolve_incident',
    description: 'Close the incident when the check-in is complete.',
    parameters: {
      type: 'object',
      properties: {
        incident_id: { type: 'string' },
        outcome: {
          type: 'string',
          enum: ['ok', 'needs_help', 'emergency'],
          description: 'ok = fine, needs_help = family/help needed, emergency = 911 level',
        },
        summary: { type: 'string', description: 'Brief session summary for the report' },
      },
      required: ['incident_id', 'outcome', 'summary'],
    },
  },
]

const SYSTEM_PROMPT = `You are the Senior Guardian voice companion — a calm, warm, patient helper for an older adult who may have had a fall or need a wellness check.

Context for this session:
- Senior name: {{senior_name}}
- Incident id: {{incident_id}}
- Senior id: {{senior_id}}
- Alert reason: {{alert_reason}}
- Detection confidence: {{confidence}}

Your goals:
1. Reassure the person — speak slowly, use simple words, short sentences.
2. Check if they are conscious, oriented, in pain, or unable to move.
3. Ask one question at a time. Wait for their answer before continuing.
4. After each meaningful answer, call save_incident_response with the question and their answer.
5. If they report pain, dizziness, breathing trouble, or cannot move — call get_first_aid_guidance and share the advice gently.
6. If they want family called: call get_emergency_contacts, confirm who to call, then call call_emergency_contact with a clear situation_summary (only after they agree). This starts a separate phone call in the background — it does NOT end your conversation with the senior.
   - Right after calling call_emergency_contact, warmly tell them: "I've called [contact name]. They're being told how you're doing right now. I'm still here with you."
   - Keep talking — continue the check-in, ask how they feel, and only end when they are safe (resolve_incident).
7. Never call 911 or emergency services without explicit confirmation — ask twice: "Do you want me to call emergency services?"
8. When they are safe or the check-in is complete, call resolve_incident with outcome ok, needs_help, or emergency and a brief summary.
9. At the very start of the session, call mark_voice_started with the incident_id.

Tone: like a kind neighbor, not a robot. Never rush. Never scold. If they are confused, repeat calmly.

Do not mention tools, APIs, databases, or AI. Say "I'm here to help you."`

const FAMILY_SYSTEM_PROMPT = `You are the Senior Guardian family liaison — a calm, clear caller updating a family member about their loved one.

You are calling {{contact_name}} about {{senior_name}}.

Incident context:
- Incident id: {{incident_id}}
- Alert: {{alert_reason}}
- Detection confidence: {{confidence}}
- Current situation: {{situation_summary}}

Check-in transcript so far:
{{triage_log}}

Your goals:
1. Introduce yourself: "Hello {{contact_name}}, this is Senior Guardian calling about {{senior_name}}."
2. Explain calmly what triggered the alert and what {{senior_name}} said during the voice check-in.
3. Share whether she seems okay, needs help, or may need someone to visit.
4. Ask if they can check on her or take the next step.
5. Keep the call brief (under 3 minutes). Do not diagnose or give medical advice.
6. End politely once they acknowledge.

Tone: professional, warm, not alarmist unless the situation is urgent.

Do not mention AI, tools, or databases.`

async function listVapiTools() {
  const res = await fetch('https://api.vapi.ai/tool', { headers: VAPI_HEADERS() })
  if (!res.ok) {
    throw new Error(`List tools failed (${res.status}): ${await res.text()}`)
  }
  return res.json()
}

function toolServerConfig() {
  return { url: TOOLS_URL, secret: TOOL_SECRET }
}

async function upsertFunctionTool(existingTools, def) {
  const existing = existingTools.find(
    (t) => t.type === 'function' && t.function?.name === def.name,
  )
  const patchBody = {
    function: {
      name: def.name,
      description: def.description,
      parameters: def.parameters,
    },
    server: toolServerConfig(),
    async: def.async ?? false,
    ...(def.messages ? { messages: def.messages } : {}),
  }

  if (existing) {
    const res = await fetch(`https://api.vapi.ai/tool/${existing.id}`, {
      method: 'PATCH',
      headers: VAPI_HEADERS(),
      body: JSON.stringify(patchBody),
    })
    if (!res.ok) {
      throw new Error(`PATCH tool ${def.name} failed (${res.status}): ${await res.text()}`)
    }
    const tool = await res.json()
    console.log(`  updated custom tool: ${def.name} (${tool.id})`)
    return tool
  }

  const res = await fetch('https://api.vapi.ai/tool', {
    method: 'POST',
    headers: VAPI_HEADERS(),
    body: JSON.stringify({ type: 'function', ...patchBody }),
  })
  if (!res.ok) {
    throw new Error(`POST tool ${def.name} failed (${res.status}): ${await res.text()}`)
  }
  const tool = await res.json()
  console.log(`  created custom tool: ${def.name} (${tool.id})`)
  return tool
}

async function ensureEndCallTool(existingTools) {
  const existing = existingTools.find((t) => t.type === 'endCall')
  if (existing) {
    console.log(`  using endCall tool (${existing.id})`)
    return existing
  }
  const res = await fetch('https://api.vapi.ai/tool', {
    method: 'POST',
    headers: VAPI_HEADERS(),
    body: JSON.stringify({ type: 'endCall' }),
  })
  if (!res.ok) {
    throw new Error(`POST endCall tool failed (${res.status}): ${await res.text()}`)
  }
  const tool = await res.json()
  console.log(`  created endCall tool (${tool.id})`)
  return tool
}

/** Create/update Custom Tools in Vapi dashboard library and return their IDs. */
async function syncCustomTools() {
  console.log('Syncing Custom Tools (POST /tool)…')
  let existingTools = await listVapiTools()

  const functionTools = []
  for (const def of FUNCTION_TOOL_DEFS) {
    const tool = await upsertFunctionTool(existingTools, def)
    functionTools.push(tool)
    existingTools = await listVapiTools()
  }

  const endCallTool = await ensureEndCallTool(existingTools)
  const toolIds = [...functionTools.map((t) => t.id), endCallTool.id]
  console.log(`Linked ${toolIds.length} tool IDs for assistant`)
  return toolIds
}

function buildAssistantPayload(toolIds) {
  return {
    name: 'Senior Guardian — Fall Triage',
    firstMessage:
      "Hello {{senior_name}}, I'm your safety companion. Our room monitor noticed something and I want to make sure you're alright. Can you hear me okay?",
    firstMessageMode: 'assistant-speaks-first',
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.4,
      maxTokens: 300,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }],
      toolIds,
      tools: [],
    },
    voice: {
      provider: '11labs',
      voiceId: 'EXAVITQu4vr4xnSDxMaL',
      stability: 0.65,
      similarityBoost: 0.75,
    },
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
      language: 'en',
    },
    backgroundSound: 'off',
    maxDurationSeconds: 900,
    silenceTimeoutSeconds: 45,
    serverUrl: TOOLS_URL,
    serverUrlSecret: TOOL_SECRET,
  }
}

function buildFamilyAssistantPayload() {
  return {
    name: 'Senior Guardian — Family Liaison',
    firstMessage:
      "Hello {{contact_name}}, this is Senior Guardian calling about {{senior_name}}. I'm reaching out because our room monitor noticed something and I want to make sure you're informed. Do you have a moment?",
    firstMessageMode: 'assistant-speaks-first',
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.3,
      maxTokens: 250,
      messages: [{ role: 'system', content: FAMILY_SYSTEM_PROMPT }],
      toolIds: [],
      tools: [],
    },
    voice: {
      provider: '11labs',
      voiceId: 'EXAVITQu4vr4xnSDxMaL',
      stability: 0.7,
      similarityBoost: 0.75,
    },
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
      language: 'en',
    },
    backgroundSound: 'off',
    maxDurationSeconds: 300,
    silenceTimeoutSeconds: 30,
  }
}

async function upsertFamilyAssistant() {
  const payload = buildFamilyAssistantPayload()
  const headers = VAPI_HEADERS()

  if (EXISTING_FAMILY_ASSISTANT_ID) {
    const res = await fetch(`https://api.vapi.ai/assistant/${EXISTING_FAMILY_ASSISTANT_ID}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      throw new Error(`PATCH family assistant failed (${res.status}): ${await res.text()}`)
    }
    return res.json()
  }

  const res = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`POST family assistant failed (${res.status}): ${await res.text()}`)
  }
  return res.json()
}

async function upsertAssistant(toolIds) {
  const payload = buildAssistantPayload(toolIds)
  const headers = VAPI_HEADERS()

  if (EXISTING_ASSISTANT_ID) {
    const res = await fetch(`https://api.vapi.ai/assistant/${EXISTING_ASSISTANT_ID}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`PATCH assistant failed (${res.status}): ${text}`)
    }
    return res.json()
  }

  const res = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST assistant failed (${res.status}): ${text}`)
  }
  return res.json()
}

function updateFrontendEnv(assistantId) {
  const envPath = join(root, 'frontend', '.env')
  const examplePath = join(root, 'frontend', '.env.example')
  let content = existsSync(envPath) ? readFileSync(envPath, 'utf8') : readFileSync(examplePath, 'utf8')

  const set = (key, value) => {
    const re = new RegExp(`^${key}=.*$`, 'm')
    if (re.test(content)) content = content.replace(re, `${key}=${value}`)
    else content += `\n${key}=${value}`
  }

  if (assistantId) set('VITE_VAPI_ASSISTANT_ID', assistantId)
  if (VAPI_PUBLIC_KEY) set('VITE_VAPI_PUBLIC_KEY', VAPI_PUBLIC_KEY)

  writeFileSync(envPath, content.trim() + '\n')
  console.log(`Updated ${envPath}`)
}

function updateBackendEnv({ familyAssistantId }) {
  const envPath = join(root, 'backend', '.env')
  const examplePath = join(root, 'backend', '.env.example')
  let content = existsSync(envPath) ? readFileSync(envPath, 'utf8') : readFileSync(examplePath, 'utf8')

  const set = (key, value) => {
    const re = new RegExp(`^${key}=.*$`, 'm')
    if (re.test(content)) content = content.replace(re, `${key}=${value}`)
    else content += `\n${key}=${value}`
  }

  if (familyAssistantId) set('VAPI_FAMILY_ASSISTANT_ID', familyAssistantId)
  set('VAPI_PHONE_NUMBER_ID', VAPI_PHONE_NUMBER_ID)

  writeFileSync(envPath, content.trim() + '\n')
  console.log(`Updated ${envPath}`)
}

async function main() {
  if (!VAPI_API_KEY) {
    console.error('Missing VAPI_API_KEY.')
    console.error('Add it to backend/.env:  VAPI_API_KEY=your-private-key')
    console.error('Get the key from dashboard.vapi.ai → API Keys → Private Key')
    process.exit(1)
  }

  const toolIds = await syncCustomTools()
  const familyAssistant = await upsertFamilyAssistant()
  const assistant = await upsertAssistant(toolIds)
  console.log('\nAssistants ready:')
  console.log('  triage id:', assistant.id)
  console.log('  family liaison id:', familyAssistant.id)
  console.log('  phone number id:', VAPI_PHONE_NUMBER_ID)
  console.log('  name:', assistant.name)
  console.log('  serverUrl:', assistant.serverUrl || TOOLS_URL)
  console.log('  toolIds:', assistant.model?.toolIds?.length ?? toolIds.length)

  updateFrontendEnv(assistant.id)
  updateBackendEnv({ familyAssistantId: familyAssistant.id })

  if (!VAPI_PUBLIC_KEY) {
    console.log('\nAdd your Vapi PUBLIC key to frontend/.env as VITE_VAPI_PUBLIC_KEY')
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
