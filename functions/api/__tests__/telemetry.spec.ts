import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost } from '../telemetry'

describe('telemetry function', () => {
  const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

  beforeEach(() => {
    consoleLog.mockClear()
    consoleError.mockClear()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('logs sanitized telemetry events without sensitive fields', async () => {
    const response = await onRequestPost({
      request: new Request('https://ifinanca.pages.dev/api/telemetry', {
        method: 'POST',
        headers: {
          origin: 'https://ifinanca.pages.dev',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          events: [
            {
              name: 'auth.error',
              sessionId: 'session-1',
              path: '/login?email=user@example.com',
              properties: {
                email: 'user@example.com',
                token: 'very-secret-token',
                nested: { apiKey: 'secret-key' },
              },
            },
          ],
        }),
      }),
      env: {},
    })

    expect(response.status).toBe(204)
    expect(consoleLog).toHaveBeenCalledTimes(1)

    const logLine = String(consoleLog.mock.calls[0]?.[0])
    expect(logLine).toContain('ifinanca.telemetry')
    expect(logLine).toContain('[email]')
    expect(logLine).toContain('[redacted]')
    expect(logLine).not.toContain('user@example.com')
    expect(logLine).not.toContain('very-secret-token')
    expect(logLine).not.toContain('secret-key')
  })

  it('rejects cross-origin telemetry requests', async () => {
    const response = await onRequestPost({
      request: new Request('https://ifinanca.pages.dev/api/telemetry', {
        method: 'POST',
        headers: {
          origin: 'https://malicious.example',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ events: [{ name: 'route.view' }] }),
      }),
      env: {},
    })

    expect(response.status).toBe(400)
    expect(consoleError).toHaveBeenCalledTimes(1)
  })

  it('forwards telemetry when an ingest endpoint is configured', async () => {
    const waitUntil = vi.fn()
    const response = await onRequestPost({
      request: new Request('https://ifinanca.pages.dev/api/telemetry', {
        method: 'POST',
        headers: {
          origin: 'https://ifinanca.pages.dev',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ events: [{ name: 'route.view' }] }),
      }),
      env: {
        TELEMETRY_INGEST_URL: 'https://logs.example.test/ingest',
        TELEMETRY_INGEST_TOKEN: 'ingest-token',
      },
      waitUntil,
    })

    expect(response.status).toBe(204)
    expect(waitUntil).toHaveBeenCalledTimes(1)
  })
})
