interface PluggyEnv {
  PLUGGY_CLIENT_ID?: string
  PLUGGY_CLIENT_SECRET?: string
  PLUGGY_WEBHOOK_URL?: string
  PLUGGY_OAUTH_REDIRECT_URI?: string
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

export async function onRequestPost({ request, env }: { request: Request; env: PluggyEnv }) {
  try {
    assertSameOrigin(request)

    const clientId = env.PLUGGY_CLIENT_ID
    const clientSecret = env.PLUGGY_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return jsonResponse({ error: 'Pluggy credentials are not configured' }, 500)
    }

    const payload = await readJson(request)
    const authResponse = await fetch(`${PLUGGY_API_URL}/auth`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        clientId,
        clientSecret,
      }),
    })

    const authPayload = await parsePluggyResponse(authResponse, 'Pluggy authentication failed')
    const apiKey = authPayload.apiKey

    if (!apiKey) {
      throw new Error('Pluggy did not return an apiKey')
    }

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
