import { defineSecret } from 'firebase-functions/params'
import { onRequest } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2/options'

setGlobalOptions({
  region: 'southamerica-east1',
  maxInstances: 10,
})

const PLUGGY_CLIENT_ID = defineSecret('PLUGGY_CLIENT_ID')
const PLUGGY_CLIENT_SECRET = defineSecret('PLUGGY_CLIENT_SECRET')
const PLUGGY_API_URL = 'https://api.pluggy.ai'

function getConnectToken(payload) {
  return payload?.accessToken ?? payload?.connectToken ?? payload?.token
}

async function parseJsonResponse(response, fallbackMessage) {
  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = body?.message ?? body?.error ?? fallbackMessage
    throw new Error(message)
  }

  return body
}

export const createPluggyConnectToken = onRequest(
  {
    cors: true,
    secrets: [PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.set('Allow', 'POST')
      response.status(405).json({ error: 'Method not allowed' })
      return
    }

    const { clientUserId, itemId, options = {} } = request.body ?? {}

    try {
      const authResponse = await fetch(`${PLUGGY_API_URL}/auth`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          clientId: PLUGGY_CLIENT_ID.value(),
          clientSecret: PLUGGY_CLIENT_SECRET.value(),
        }),
      })

      const authPayload = await parseJsonResponse(authResponse, 'Pluggy authentication failed')
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
          ...(itemId ? { itemId } : {}),
          options: {
            ...options,
            ...(clientUserId ? { clientUserId } : {}),
            avoidDuplicates: options.avoidDuplicates ?? true,
          },
        }),
      })

      const connectTokenPayload = await parseJsonResponse(
        connectTokenResponse,
        'Pluggy connect token creation failed',
      )
      const connectToken = getConnectToken(connectTokenPayload)

      if (!connectToken) {
        throw new Error('Pluggy did not return a connect token')
      }

      response.status(200).json({
        connectToken,
        expiresAt: connectTokenPayload.expiresAt ?? null,
      })
    } catch (error) {
      response.status(502).json({
        error: error instanceof Error ? error.message : 'Unexpected Pluggy error',
      })
    }
  },
)
