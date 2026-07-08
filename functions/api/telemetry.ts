interface TelemetryEnv {
  TELEMETRY_INGEST_URL?: string
  TELEMETRY_INGEST_TOKEN?: string
}

interface TelemetryContext {
  request: Request
  env: TelemetryEnv
  waitUntil?: (promise: Promise<unknown>) => void
}

interface IncomingTelemetryEvent {
  name?: string
  severity?: string
  timestamp?: string
  sessionId?: string
  path?: string
  language?: string
  release?: string
  properties?: Record<string, unknown>
}

const MAX_BODY_CHARS = 64_000
const MAX_EVENTS = 25
const SENSITIVE_KEY_PATTERN = /(password|senha|token|secret|authorization|apikey|api_key|clientsecret|idtoken|credential)/i
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

function response(status: number, payload?: unknown) {
  return payload === undefined
    ? new Response(null, { status, headers: { 'cache-control': 'no-store' } })
    : new Response(JSON.stringify(payload), {
        status,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      })
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return
  if (origin !== new URL(request.url).origin) {
    throw new Error('Cross-origin telemetry requests are not allowed')
  }
}

async function readJsonPayload(request: Request) {
  const body = await request.text()
  if (body.length > MAX_BODY_CHARS) {
    throw new Error('Telemetry payload is too large')
  }

  return body ? JSON.parse(body) : {}
}

function sanitizeString(value: string) {
  return value.replace(EMAIL_PATTERN, '[email]').slice(0, 500)
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[max-depth]'

  if (typeof value === 'string') return sanitizeString(value)
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value

  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitize(item, depth + 1))
  }

  if (typeof value === 'object' && value) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 50)
        .map(([key, nestedValue]) => [
          key,
          SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitize(nestedValue, depth + 1),
        ]),
    )
  }

  return undefined
}

function normalizeEvents(payload: unknown): IncomingTelemetryEvent[] {
  const body = payload as { events?: unknown; event?: unknown }
  const rawEvents = Array.isArray(body.events) ? body.events : body.event ? [body.event] : []

  return rawEvents
    .slice(0, MAX_EVENTS)
    .filter((event): event is IncomingTelemetryEvent => typeof event === 'object' && event !== null)
    .map((event) => ({
      name: typeof event.name === 'string' ? sanitizeString(event.name) : 'unknown',
      severity: typeof event.severity === 'string' ? sanitizeString(event.severity) : 'info',
      timestamp: typeof event.timestamp === 'string' ? sanitizeString(event.timestamp) : new Date().toISOString(),
      sessionId: typeof event.sessionId === 'string' ? sanitizeString(event.sessionId) : 'unknown',
      path: typeof event.path === 'string' ? sanitizeString(event.path) : '/',
      language: typeof event.language === 'string' ? sanitizeString(event.language) : undefined,
      release: typeof event.release === 'string' ? sanitizeString(event.release) : undefined,
      properties: sanitize(event.properties ?? {}) as Record<string, unknown>,
    }))
}

async function forwardTelemetry(env: TelemetryEnv, envelope: Record<string, unknown>) {
  if (!env.TELEMETRY_INGEST_URL) {
    return
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }

  if (env.TELEMETRY_INGEST_TOKEN) {
    headers.authorization = `Bearer ${env.TELEMETRY_INGEST_TOKEN}`
  }

  await fetch(env.TELEMETRY_INGEST_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(envelope),
  })
}

export async function onRequestPost({ request, env, waitUntil }: TelemetryContext) {
  try {
    assertSameOrigin(request)

    const payload = await readJsonPayload(request)
    const events = normalizeEvents(payload)

    if (!events.length) {
      return response(204)
    }

    const envelope = {
      type: 'ifinanca.telemetry',
      receivedAt: new Date().toISOString(),
      request: {
        path: new URL(request.url).pathname,
        userAgent: sanitizeString(request.headers.get('user-agent') ?? 'unknown'),
        cfRay: request.headers.get('cf-ray') ?? undefined,
        country: request.headers.get('cf-ipcountry') ?? undefined,
      },
      events,
    }

    console.log(JSON.stringify(envelope))

    const forwarding = forwardTelemetry(env, envelope).catch((error) => {
      console.error(
        JSON.stringify({
          type: 'ifinanca.telemetry.forward_error',
          message: error instanceof Error ? error.message : 'unknown',
        }),
      )
    })

    if (waitUntil) {
      waitUntil(forwarding)
    } else {
      await forwarding
    }

    return response(204)
  } catch (error) {
    console.error(
      JSON.stringify({
        type: 'ifinanca.telemetry.ingest_error',
        message: error instanceof Error ? error.message : 'unknown',
      }),
    )

    return response(400, { error: 'Invalid telemetry payload' })
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    },
  })
}
