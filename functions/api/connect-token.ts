interface PluggyEnv {
  PLUGGY_CLIENT_ID?: string
  PLUGGY_CLIENT_SECRET?: string
  PLUGGY_WEBHOOK_URL?: string
  PLUGGY_OAUTH_REDIRECT_URI?: string
  /** Firebase Web API Key — used to verify Firebase ID tokens via the Google Identity REST API. */
  FIREBASE_WEB_API_KEY?: string
}

interface ConnectTokenRequest {
  clientUserId?: string
  itemId?: string
  options?: {
    clientUserId?: string
    webhookUrl?: string
    oauthRedirectUri?: string
    avoidDuplicates?: boolean
    connectorSortAlphabetically?: boolean
  }
}

const PLUGGY_API_URL = 'https://api.pluggy.ai'

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

async function readJson(request: Request) {
  try {
    return (await request.json()) as ConnectTokenRequest
  } catch {
    return {} as ConnectTokenRequest
  }
}

async function parsePluggyResponse(response: Response, fallbackMessage: string) {
  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = body?.message ?? body?.error ?? fallbackMessage
    throw new Error(message)
  }

  return body
}

function sanitizeOptions(payload: ConnectTokenRequest, env: PluggyEnv) {
  const options = payload.options ?? {}
  const connectOptions: Record<string, string | boolean> = {
    avoidDuplicates: typeof options.avoidDuplicates === 'boolean' ? options.avoidDuplicates : true,
  }

  const clientUserId = payload.clientUserId ?? options.clientUserId
  if (typeof clientUserId === 'string' && clientUserId.trim()) {
    connectOptions.clientUserId = clientUserId.trim()
  }

  const webhookUrl = options.webhookUrl ?? env.PLUGGY_WEBHOOK_URL
  if (typeof webhookUrl === 'string' && webhookUrl.trim()) {
    connectOptions.webhookUrl = webhookUrl.trim()
  }

  const oauthRedirectUri = options.oauthRedirectUri ?? env.PLUGGY_OAUTH_REDIRECT_URI
  if (typeof oauthRedirectUri === 'string' && oauthRedirectUri.trim()) {
    connectOptions.oauthRedirectUri = oauthRedirectUri.trim()
  }

  if (typeof options.connectorSortAlphabetically === 'boolean') {
    connectOptions.connectorSortAlphabetically = options.connectorSortAlphabetically
  }

  return connectOptions
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin')

  if (!origin) {
    return
  }

  if (origin !== new URL(request.url).origin) {
    throw new Error('Cross-origin requests are not allowed')
  }
}

/**
 * Validates a Firebase ID token using the Google Identity Platform REST API.
 *
 * We cannot use the Firebase Admin SDK here because Cloudflare Workers run on
 * the V8 isolate runtime (not Node.js). The REST endpoint is the officially
 * supported alternative for edge environments.
 *
 * Ref: https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 * REST: POST https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=<apiKey>
 *
 * Returns the decoded user UID on success; throws on failure.
 */
async function verifyFirebaseIdToken(idToken: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
    },
  )

  const body = (await response.json().catch(() => ({}))) as {
    users?: Array<{ localId?: string; emailVerified?: boolean }>
    error?: { message?: string }
  }

  if (!response.ok || !body.users?.length) {
    const reason = body.error?.message || 'Token inválido'
    throw Object.assign(new Error(`Firebase token verification failed: ${reason}`), {
      code: 'auth/invalid-id-token',
    })
  }

  const user = body.users[0]

  if (!user.emailVerified) {
    throw Object.assign(new Error('Firebase user email is not verified'), {
      code: 'auth/email-not-verified',
    })
  }

  const uid = user.localId
  if (!uid) {
    throw Object.assign(new Error('Firebase user ID missing in token lookup response'), {
      code: 'auth/invalid-id-token',
    })
  }

  return uid
}

/**
 * Extracts the Bearer token from the Authorization header.
 * Returns null if the header is absent or malformed.
 */
function extractBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')
  if (!authorization) {
    return null
  }

  const parts = authorization.split(' ')
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null
  }

  return parts[1].trim() || null
}

async function getPluggyApiKey(clientId: string, clientSecret: string): Promise<string> {
  const authResponse = await fetch(`${PLUGGY_API_URL}/auth`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ clientId, clientSecret }),
  })

  const authPayload = await parsePluggyResponse(authResponse, 'Pluggy authentication failed')
  if (!authPayload.apiKey) {
    throw new Error('Pluggy did not return an apiKey')
  }

  return authPayload.apiKey
}

export async function onRequestPost({ request, env }: { request: Request; env: PluggyEnv }) {
  try {
    assertSameOrigin(request)

    // ── Firebase ID token verification ────────────────────────────────────────
    // When FIREBASE_WEB_API_KEY is configured we require a valid Firebase ID
    // token in the Authorization header. This prevents any unauthenticated
    // visitor from generating Pluggy connect tokens.
    if (env.FIREBASE_WEB_API_KEY) {
      const idToken = extractBearerToken(request)

      if (!idToken) {
        return jsonResponse(
          { error: 'Missing Firebase ID token. Include Authorization: Bearer <token> in the request.' },
          401,
        )
      }

      try {
        await verifyFirebaseIdToken(idToken, env.FIREBASE_WEB_API_KEY)
      } catch (authError) {
        return jsonResponse(
          { error: authError instanceof Error ? authError.message : 'Authentication failed' },
          401,
        )
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const clientId = env.PLUGGY_CLIENT_ID
    const clientSecret = env.PLUGGY_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return jsonResponse({ error: 'Pluggy credentials are not configured' }, 500)
    }

    const payload = await readJson(request)
    const apiKey = await getPluggyApiKey(clientId, clientSecret)

    const connectTokenResponse = await fetch(`${PLUGGY_API_URL}/connect_token`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        ...(typeof payload.itemId === 'string' && payload.itemId.trim()
          ? { itemId: payload.itemId.trim() }
          : {}),
        options: sanitizeOptions(payload, env),
      }),
    })

    const connectTokenPayload = await parsePluggyResponse(
      connectTokenResponse,
      'Pluggy connect token creation failed',
    )
    const accessToken = connectTokenPayload.accessToken

    if (!accessToken) {
      throw new Error('Pluggy did not return an accessToken')
    }

    return jsonResponse({
      accessToken,
      connectToken: accessToken,
    })
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected Pluggy error' },
      502,
    )
  }
}
