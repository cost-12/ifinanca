/**
 * Cloudflare Pages Function — POST /api/webhooks/pluggy
 *
 * Receives lifecycle events from the Pluggy platform (item/created,
 * item/updated, item/error) and persists them to Firestore via the
 * REST API. The Firebase Admin SDK cannot be used here because
 * Cloudflare Workers run on the V8 isolate runtime (not Node.js).
 *
 * Firestore REST docs:
 * https://firebase.google.com/docs/firestore/reference/rest
 */

interface PluggyWebhookEnv {
  PLUGGY_WEBHOOK_SECRET?: string
  /**
   * Firebase service account credentials as a JSON string.
   * Generate at: Firebase Console → Project Settings → Service Accounts → Generate new private key
   * Store in Cloudflare secrets as: FIREBASE_SERVICE_ACCOUNT
   */
  FIREBASE_SERVICE_ACCOUNT?: string
  FIREBASE_PROJECT_ID?: string
}

interface PluggyWebhookEvent {
  event?: string
  eventId?: string
  itemId?: string
  clientUserId?: string
  triggeredBy?: string
  error?: {
    code?: string
    message?: string
    parameter?: string
  }
  [key: string]: unknown
}

interface ServiceAccountCredentials {
  project_id: string
  client_email: string
  private_key: string
}

// ── Firebase JWT ──────────────────────────────────────────────────────────────

/**
 * Creates a signed JWT for a Firebase service account using the Web Crypto API,
 * which is available in all Cloudflare Workers environments.
 */
async function createServiceAccountJwt(credentials: ServiceAccountCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const expiry = now + 3600 // 1 hour

  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_')
  const payload = btoa(
    JSON.stringify({
      iss: credentials.client_email,
      sub: credentials.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      scope: 'https://www.googleapis.com/auth/datastore',
      iat: now,
      exp: expiry,
    }),
  )
    .replaceAll('=', '')
    .replaceAll('+', '-')
    .replaceAll('/', '_')

  const signingInput = `${header}.${payload}`

  // Import the RSA private key. The PEM markers and newlines must be removed.
  const pemBody = credentials.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')

  const keyBuffer = Uint8Array.from(atob(pemBody), (c) => c.codePointAt(0) || 0).buffer

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  )

  const signature = btoa(String.fromCodePoint(...new Uint8Array(signatureBuffer)))
    .replaceAll('=', '')
    .replaceAll('+', '-')
    .replaceAll('/', '_')

  return `${signingInput}.${signature}`
}

async function getFirestoreAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  const jwt = await createServiceAccountJwt(credentials)

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  })

  const body = (await response.json().catch(() => ({}))) as { access_token?: string; error?: string }

  if (!response.ok || !body.access_token) {
    throw new Error(`Failed to obtain Firestore access token: ${body.error ?? 'unknown error'}`)
  }

  return body.access_token
}

// ── Firestore REST ────────────────────────────────────────────────────────────

function firestoreStringField(value: string) {
  return { stringValue: value }
}

function firestoreTimestampField(date = new Date()) {
  return { timestampValue: date.toISOString() }
}

function firestoreNullField() {
  return { nullValue: null }
}

async function writePluggyEventToFirestore(
  event: PluggyWebhookEvent,
  projectId: string,
  accessToken: string,
): Promise<void> {
  if (!event.eventId) return

  const documentId = event.eventId
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/pluggyEvents/${encodeURIComponent(documentId)}`

  const fields: Record<string, unknown> = {
    eventId: firestoreStringField(event.eventId),
    event: firestoreStringField(event.event ?? 'unknown'),
    itemId: event.itemId ? firestoreStringField(event.itemId) : firestoreNullField(),
    clientUserId: event.clientUserId ? firestoreStringField(event.clientUserId) : firestoreNullField(),
    triggeredBy: event.triggeredBy ? firestoreStringField(event.triggeredBy) : firestoreNullField(),
    receivedAt: firestoreTimestampField(),
  }

  if (event.error) {
    fields.errorCode = event.error.code ? firestoreStringField(event.error.code) : firestoreNullField()
    fields.errorMessage = event.error.message ? firestoreStringField(event.error.message) : firestoreNullField()
  }

  await fetch(url, {
    method: 'PATCH',
    headers: {
      'authorization': `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })
}

/**
 * Updates the user profile document to reflect the current connection status.
 * Writes to users/{clientUserId}/pluggyItems/{itemId}.
 */
async function updateUserPluggyItem(
  event: PluggyWebhookEvent,
  status: 'active' | 'updating' | 'error',
  projectId: string,
  accessToken: string,
): Promise<void> {
  if (!event.clientUserId || !event.itemId) return

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users/${encodeURIComponent(event.clientUserId)}/pluggyItems/${encodeURIComponent(event.itemId)}`

  const fields: Record<string, unknown> = {
    itemId: firestoreStringField(event.itemId),
    status: firestoreStringField(status),
    updatedAt: firestoreTimestampField(),
  }

  if (event.error) {
    fields.lastError = event.error.message ? firestoreStringField(event.error.message) : firestoreNullField()
  }

  await fetch(url, {
    method: 'PATCH',
    headers: {
      'authorization': `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })
}

// ── Webhook helpers ───────────────────────────────────────────────────────────

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

async function readWebhookEvent(request: Request) {
  try {
    return (await request.json()) as PluggyWebhookEvent
  } catch {
    return {} as PluggyWebhookEvent
  }
}

function assertWebhookSecret(request: Request, env: PluggyWebhookEnv) {
  if (!env.PLUGGY_WEBHOOK_SECRET) {
    return
  }

  const url = new URL(request.url)
  const token = request.headers.get('x-ifinanca-webhook-secret') ?? url.searchParams.get('token')

  if (token !== env.PLUGGY_WEBHOOK_SECRET) {
    throw new Error('Invalid webhook secret')
  }
}

async function handleItemCreated(event: PluggyWebhookEvent, projectId: string, accessToken: string) {
  console.log('Pluggy item created', {
    eventId: event.eventId,
    itemId: event.itemId,
    clientUserId: event.clientUserId,
    triggeredBy: event.triggeredBy,
  })

  await Promise.allSettled([
    writePluggyEventToFirestore(event, projectId, accessToken),
    updateUserPluggyItem(event, 'active', projectId, accessToken),
  ])
}

async function handleItemUpdated(event: PluggyWebhookEvent, projectId: string, accessToken: string) {
  console.log('Pluggy item updated', {
    eventId: event.eventId,
    itemId: event.itemId,
    clientUserId: event.clientUserId,
    triggeredBy: event.triggeredBy,
  })

  await Promise.allSettled([
    writePluggyEventToFirestore(event, projectId, accessToken),
    updateUserPluggyItem(event, 'updating', projectId, accessToken),
  ])
}

async function handleItemError(event: PluggyWebhookEvent, projectId: string, accessToken: string) {
  console.error('Pluggy item error', {
    eventId: event.eventId,
    itemId: event.itemId,
    clientUserId: event.clientUserId,
    error: event.error,
  })

  await Promise.allSettled([
    writePluggyEventToFirestore(event, projectId, accessToken),
    updateUserPluggyItem(event, 'error', projectId, accessToken),
  ])
}

async function handleWebhookEvent(event: PluggyWebhookEvent, env: PluggyWebhookEnv) {
  console.log('Received Pluggy webhook', {
    event: event.event,
    eventId: event.eventId,
    itemId: event.itemId,
  })

  // Resolve Firestore credentials. If not configured, fall back to logging only.
  let projectId: string | null = null
  let accessToken: string | null = null

  if (env.FIREBASE_SERVICE_ACCOUNT && env.FIREBASE_PROJECT_ID) {
    try {
      const credentials = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccountCredentials
      projectId = env.FIREBASE_PROJECT_ID
      accessToken = await getFirestoreAccessToken(credentials)
    } catch (error) {
      console.error('Failed to obtain Firestore access token — events will only be logged', error)
    }
  } else {
    console.warn(
      'FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID not configured. ' +
        'Webhook events will only be logged and not persisted.',
    )
  }

  if (!projectId || !accessToken) {
    // Credentials unavailable — log-only mode.
    console.log('Webhook event (log-only mode):', JSON.stringify(event))
    return
  }

  switch (event.event) {
    case 'item/created':
      await handleItemCreated(event, projectId, accessToken)
      break
    case 'item/updated':
      await handleItemUpdated(event, projectId, accessToken)
      break
    case 'item/error':
      await handleItemError(event, projectId, accessToken)
      break
    default:
      console.log('Unhandled Pluggy webhook event', {
        event: event.event,
        eventId: event.eventId,
      })
      // Still persist the raw event for observability.
      if (projectId && accessToken) {
        await writePluggyEventToFirestore(event, projectId, accessToken).catch(console.error)
      }
  }
}

export async function onRequestPost({
  request,
  env,
  waitUntil,
}: {
  request: Request
  env: PluggyWebhookEnv
  waitUntil: (promise: Promise<unknown>) => void
}) {
  try {
    assertWebhookSecret(request, env)
    const event = await readWebhookEvent(request)

    waitUntil(
      handleWebhookEvent(event, env).catch((error) => {
        console.error('Pluggy webhook background processing failed', error)
      }),
    )

    return jsonResponse({
      received: true,
      event: event.event ?? null,
      eventId: event.eventId ?? null,
    })
  } catch (error) {
    return jsonResponse(
      { received: false, error: error instanceof Error ? error.message : 'Invalid webhook' },
      401,
    )
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      allow: 'POST, OPTIONS',
    },
  })
}
