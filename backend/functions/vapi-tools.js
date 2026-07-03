/**
 * Butterbase function: handles Vapi tool-calls webhook for Senior Guardian.
 * Deployed as `vapi-tools` on app_7e7uf91ohmyx.
 *
 * Vapi POSTs tool-calls here; respond with { results: [{ toolCallId, result }] }.
 */

const MANUAL_INCIDENT_ID = 'manual-session'

function parseParameters(raw) {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return raw
}

function extractToolCalls(message) {
  const calls = []

  if (Array.isArray(message.toolCallList)) {
    for (const call of message.toolCallList) {
      calls.push({
        id: call.id,
        name: call.name || call.function?.name,
        parameters: parseParameters(call.arguments ?? call.parameters ?? call.function?.arguments),
      })
    }
  }

  if (!calls.length && Array.isArray(message.toolWithToolCallList)) {
    for (const entry of message.toolWithToolCallList) {
      const toolCall = entry.toolCall || entry
      calls.push({
        id: toolCall.id || entry.id,
        name: entry.name || toolCall.name || toolCall.function?.name,
        parameters: parseParameters(
          toolCall.parameters ??
            toolCall.function?.parameters ??
            toolCall.function?.arguments ??
            entry.parameters,
        ),
      })
    }
  }

  if (!calls.length && Array.isArray(message.toolCalls)) {
    for (const call of message.toolCalls) {
      calls.push({
        id: call.id,
        name: call.function?.name || call.name,
        parameters: parseParameters(call.function?.arguments ?? call.arguments),
      })
    }
  }

  return calls.filter((call) => call.id && call.name)
}

export async function handler(req, ctx) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const secret = ctx.env.VAPI_TOOL_SECRET
  if (secret) {
    const auth = req.headers.get('Authorization') || ''
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    const provided = req.headers.get('X-Vapi-Secret') || bearer
    if (provided !== secret) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  let payload
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const message = payload.message || payload

  // Assistant serverUrl also receives status/end-of-call events — ack them.
  if (message.type && message.type !== 'tool-calls') {
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const toolCallList = extractToolCalls(message)

  if (!toolCallList.length) {
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const results = []
  for (const call of toolCallList) {
    try {
      const data = await handleTool(ctx, call.name, call.parameters || {})
      results.push({
        toolCallId: call.id,
        result: typeof data === 'string' ? data : JSON.stringify(data),
      })
    } catch (err) {
      results.push({
        toolCallId: call.id,
        result: JSON.stringify({ ok: false, error: err.message || 'Tool failed' }),
      })
    }
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function resolveIncidentId(ctx, incident_id, senior_id = 'senior_001') {
  if (incident_id && incident_id !== MANUAL_INCIDENT_ID) {
    return incident_id
  }

  const existing = await ctx.db.query(
    `SELECT id FROM incidents
     WHERE senior_id = $1 AND event_type = 'manual_checkin' AND resolved_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [senior_id],
  )
  if (existing.rows.length) {
    return existing.rows[0].id
  }

  const created = await ctx.db.query(
    `INSERT INTO incidents (senior_id, status, event_type, reason)
     VALUES ($1, 'fall_detected', 'manual_checkin', 'Manual voice wellness check')
     RETURNING id`,
    [senior_id],
  )
  return created.rows[0].id
}

async function handleTool(ctx, name, params) {
  switch (name) {
    case 'mark_voice_started':
      return markVoiceStarted(ctx, params)
    case 'save_incident_response':
      return saveIncidentResponse(ctx, params)
    case 'get_emergency_contacts':
      return getEmergencyContacts(ctx, params)
    case 'get_first_aid_guidance':
      return getFirstAidGuidance(params)
    case 'notify_family':
      return notifyFamily(ctx, params)
    case 'call_emergency_contact':
      return callEmergencyContact(ctx, params)
    case 'resolve_incident':
      return resolveIncident(ctx, params)
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

async function markVoiceStarted(ctx, { incident_id, senior_id }) {
  const id = await resolveIncidentId(ctx, incident_id, senior_id)
  await ctx.db.query(`UPDATE incidents SET voice_session_started = true WHERE id = $1`, [id])
  return { ok: true, incident_id: id }
}

async function saveIncidentResponse(ctx, { incident_id, senior_id, question, answer }) {
  if (!question) throw new Error('question required')
  const id = await resolveIncidentId(ctx, incident_id, senior_id)
  const result = await ctx.db.query(
    `INSERT INTO incident_responses (incident_id, question, answer)
     VALUES ($1, $2, $3)
     RETURNING id, created_at`,
    [id, question, answer || null],
  )
  return { ok: true, incident_id: id, response: result.rows[0] }
}

async function getEmergencyContacts(ctx, { senior_id }) {
  if (!senior_id) throw new Error('senior_id required')
  const result = await ctx.db.query(
    `SELECT name, phone, notify_sms FROM emergency_contacts
     WHERE senior_id = $1 AND notify_sms = true
     ORDER BY created_at ASC`,
    [senior_id]
  )
  return { contacts: result.rows }
}

function getFirstAidGuidance({ situation }) {
  const key = String(situation || '').toLowerCase()
  const guides = {
    fall:
      'Stay still if unsure about moving. Check for head/neck pain. Apply a cold pack to swelling. Do not rush to stand — roll to your side first if breathing is fine.',
    dizziness:
      'Sit or lie down immediately. Loosen tight clothing. Sip water slowly. Rise slowly when feeling better.',
    breathing:
      'Sit upright, lean slightly forward, breathe slowly through your nose. Loosen tight clothing. If severe, prepare to call emergency services.',
    bleeding:
      'Apply firm pressure with a clean cloth for at least 10 minutes. Elevate the area if possible. Do not remove soaked bandages — add more on top.',
    chest_pain:
      'Stop activity, sit upright, and rest. If pain is severe or radiates to arm/jaw, treat as emergency — call 911.',
  }

  for (const [term, advice] of Object.entries(guides)) {
    if (key.includes(term)) return { situation: term, guidance: advice }
  }

  return {
    situation: situation || 'general',
    guidance:
      'Stay calm and still. Breathe slowly. If pain worsens or you feel unsafe, tell me and we can contact family or emergency services.',
  }
}

async function notifyFamily(ctx, { incident_id, message, senior_id }) {
  const id = await resolveIncidentId(ctx, incident_id, senior_id)
  await ctx.db.query(
    `INSERT INTO incident_responses (incident_id, question, answer)
     VALUES ($1, $2, $3)`,
    [
      id,
      'Family notification requested',
      message || `Alert for senior ${senior_id || 'unknown'} — please check in.`,
    ],
  )
  return {
    ok: true,
    status: 'queued',
    message: 'Family notification recorded. Use call_emergency_contact to place a voice call.',
  }
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) throw new Error('Invalid phone number')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (String(phone).startsWith('+')) return String(phone)
  return `+${digits}`
}

async function resolveContact(ctx, senior_id, contact_name, contact_phone) {
  if (contact_phone) {
    return {
      name: contact_name || 'family member',
      phone: normalizePhone(contact_phone),
    }
  }

  const result = await ctx.db.query(
    `SELECT name, phone FROM emergency_contacts
     WHERE senior_id = $1 AND notify_sms = true
     ORDER BY created_at ASC`,
    [senior_id || 'senior_001'],
  )
  if (!result.rows.length) {
    throw new Error('No emergency contacts configured')
  }

  if (contact_name) {
    const key = contact_name.toLowerCase()
    const match = result.rows.find((row) => row.name.toLowerCase().includes(key))
    if (match) return { name: match.name, phone: normalizePhone(match.phone) }
  }

  const first = result.rows[0]
  return { name: first.name, phone: normalizePhone(first.phone) }
}

async function buildIncidentContext(ctx, incident_id, senior_id) {
  const id = await resolveIncidentId(ctx, incident_id, senior_id)
  const incidentResult = await ctx.db.query(`SELECT * FROM incidents WHERE id = $1`, [id])
  const incident = incidentResult.rows[0]
  if (!incident) throw new Error('Incident not found')

  const responsesResult = await ctx.db.query(
    `SELECT question, answer FROM incident_responses
     WHERE incident_id = $1
     ORDER BY created_at ASC`,
    [id],
  )

  const triageLog = responsesResult.rows
    .map((row) => `Q: ${row.question}\nA: ${row.answer || '(no answer)'}`)
    .join('\n\n')

  return { id, incident, triageLog }
}

async function callEmergencyContact(
  ctx,
  { incident_id, senior_id, contact_name, contact_phone, situation_summary },
) {
  const vapiApiKey = ctx.env.VAPI_API_KEY
  const phoneNumberId = ctx.env.VAPI_PHONE_NUMBER_ID
  const familyAssistantId = ctx.env.VAPI_FAMILY_ASSISTANT_ID

  if (!vapiApiKey || !phoneNumberId || !familyAssistantId) {
    throw new Error(
      'Outbound calling not configured. Run scripts/setup-vapi-assistant.mjs and redeploy vapi-tools.',
    )
  }

  if (!situation_summary) {
    throw new Error('situation_summary required')
  }

  const seniorId = senior_id || 'senior_001'
  const { id, incident, triageLog } = await buildIncidentContext(ctx, incident_id, seniorId)
  const contact = await resolveContact(ctx, seniorId, contact_name, contact_phone)

  const job = placeOutboundCall(ctx, {
    vapiApiKey,
    phoneNumberId,
    familyAssistantId,
    id,
    incident,
    triageLog,
    contact,
    situation_summary,
    seniorId,
  })

  if (typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(job)
  } else {
    job.catch((err) => console.error('Outbound call failed:', err))
  }

  return {
    ok: true,
    status: 'calling',
    contact: { name: contact.name, phone: contact.phone },
    message: `Background call started to ${contact.name}. Tell the senior warmly that ${contact.name} is being called now and informed of the situation. Continue the check-in — stay on the line with the senior.`,
  }
}

async function placeOutboundCall(
  ctx,
  {
    vapiApiKey,
    phoneNumberId,
    familyAssistantId,
    id,
    incident,
    triageLog,
    contact,
    situation_summary,
    seniorId,
  },
) {
  try {
    const callRes = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistantId: familyAssistantId,
        phoneNumberId,
        customer: { number: contact.phone },
        assistantOverrides: {
          variableValues: {
            contact_name: contact.name,
            senior_name: 'Margaret',
            senior_id: seniorId,
            incident_id: id,
            alert_reason: incident.reason || incident.event_type || 'wellness alert',
            confidence: String(incident.confidence ?? ''),
            situation_summary,
            triage_log: triageLog || 'No triage Q&A recorded yet.',
          },
        },
      }),
      signal: AbortSignal.timeout(15000),
    })

    const callBody = await callRes.json().catch(() => ({}))
    if (!callRes.ok) {
      throw new Error(callBody.message || callBody.error || `Vapi call failed (${callRes.status})`)
    }

    await ctx.db.query(
      `INSERT INTO incident_responses (incident_id, question, answer)
       VALUES ($1, $2, $3)`,
      [
        id,
        `Outbound call to ${contact.name}`,
        `Calling ${contact.phone}. Summary: ${situation_summary}. Vapi call id: ${callBody.id || 'unknown'}`,
      ],
    )
  } catch (err) {
    console.error('placeOutboundCall failed:', err)
    await ctx.db.query(
      `INSERT INTO incident_responses (incident_id, question, answer)
       VALUES ($1, $2, $3)`,
      [
        id,
        `Outbound call to ${contact.name} failed`,
        `${contact.phone}: ${err.message || 'unknown error'}`,
      ],
    )
  }
}

async function resolveIncident(ctx, { incident_id, senior_id, outcome, summary }) {
  const id = await resolveIncidentId(ctx, incident_id, senior_id)
  const statusMap = {
    ok: 'resolved_ok',
    needs_help: 'needs_help',
    emergency: 'emergency',
  }
  const status = statusMap[outcome] || 'resolved_ok'
  const result = await ctx.db.query(
    `UPDATE incidents
     SET status = $2, resolved_at = NOW()
     WHERE id = $1
     RETURNING id, status, resolved_at`,
    [id, status],
  )
  if (summary) {
    await ctx.db.query(
      `INSERT INTO incident_responses (incident_id, question, answer)
       VALUES ($1, $2, $3)`,
      [id, 'Session summary', summary],
    )
  }
  return { ok: true, incident: result.rows[0] }
}
