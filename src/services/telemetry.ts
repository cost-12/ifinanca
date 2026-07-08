import { deleteTelemetryBatch, queueTelemetryEvents, readTelemetryQueue } from '@/services/indexeddb'

type TelemetrySeverity = 'debug' | 'info' | 'warning' | 'error'

type TelemetryProperties = Record<string, unknown>

interface TrackOptions {
  severity?: TelemetrySeverity
  immediate?: boolean
}

interface TelemetryEvent {
  name: string
  severity: TelemetrySeverity
  timestamp: string
  sessionId: string
  path: string
  language?: string
  release?: string
  properties: TelemetryProperties
}

const SESSION_STORAGE_KEY = 'ifinanca.telemetry.session'
const DEFAULT_ENDPOINT = '/api/telemetry'
const SENSITIVE_KEY_PATTERN = /(password|senha|token|secret|authorization|apikey|api_key|clientsecret|idtoken|credential)/i
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const MAX_STRING_LENGTH = 500
const MAX_DEPTH = 4

let initialized = false
let lastPageViewKey = ''
let cumulativeLayoutShift = 0
let isFlushingQueuedTelemetry = false

function telemetryEnabled() {
  const flag = import.meta.env.VITE_TELEMETRY_ENABLED
  if (flag === 'true') return true
  if (flag === 'false') return false
  return import.meta.env.PROD
}

function telemetryDebugEnabled() {
  return import.meta.env.VITE_TELEMETRY_DEBUG === 'true'
}

function telemetryEndpoint() {
  return import.meta.env.VITE_TELEMETRY_ENDPOINT || DEFAULT_ENDPOINT
}

function getSessionId() {
  if (typeof window === 'undefined') {
    return 'server'
  }

  const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (existing) {
    return existing
  }

  const generated =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, generated)
  return generated
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) {
    return '[max-depth]'
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
    }
  }

  if (typeof value === 'string') {
    return sanitizeString(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1))
  }

  if (typeof value === 'object' && value) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 30)
        .map(([key, nestedValue]) => [
          key,
          SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeValue(nestedValue, depth + 1),
        ]),
    )
  }

  return undefined
}

function sanitizeString(value: string) {
  return value.replace(EMAIL_PATTERN, '[email]').slice(0, MAX_STRING_LENGTH)
}

function buildEvent(name: string, properties: TelemetryProperties, options: TrackOptions = {}): TelemetryEvent {
  return {
    name,
    severity: options.severity ?? 'info',
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    path: typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/',
    language: typeof document !== 'undefined' ? document.documentElement.lang : undefined,
    release: import.meta.env.VITE_APP_VERSION || import.meta.env.MODE,
    properties: sanitizeValue(properties) as TelemetryProperties,
  }
}

async function fetchTelemetryPayload(payload: string) {
  const response = await fetch(telemetryEndpoint(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
    keepalive: true,
  })

  return response.ok
}

function queueEventsSilently(events: TelemetryEvent[]) {
  void queueTelemetryEvents(events).catch(() => undefined)
}

async function flushQueuedTelemetry() {
  if (isFlushingQueuedTelemetry || typeof window === 'undefined' || !telemetryEnabled() || navigator.onLine === false) {
    return
  }

  isFlushingQueuedTelemetry = true

  try {
    const batches = await readTelemetryQueue()

    for (const batch of batches) {
      const sent = await fetchTelemetryPayload(JSON.stringify({ events: batch.events }))
      if (!sent) {
        break
      }
      await deleteTelemetryBatch(batch.id)
    }
  } catch {
    // Queued telemetry is best-effort and must not affect the app.
  } finally {
    isFlushingQueuedTelemetry = false
  }
}

function sendEvents(events: TelemetryEvent[]) {
  if (!events.length || typeof window === 'undefined') return

  const payload = JSON.stringify({ events })

  if (telemetryDebugEnabled()) {
    console.info('[iFinanca telemetry]', events)
  }

  if (!telemetryEnabled()) {
    return
  }

  if (navigator.onLine === false) {
    queueEventsSilently(events)
    return
  }

  try {
    if ('sendBeacon' in navigator && payload.length < 60_000) {
      const blob = new Blob([payload], { type: 'application/json' })
      if (navigator.sendBeacon(telemetryEndpoint(), blob)) {
        void flushQueuedTelemetry()
        return
      }
    }

    void fetchTelemetryPayload(payload).then((sent) => {
      if (sent) {
        void flushQueuedTelemetry()
      } else {
        queueEventsSilently(events)
      }
    })
  } catch {
    queueEventsSilently(events)
    // Telemetry must never break user-facing flows.
  }
}

function readNavigationMetrics() {
  if (typeof performance === 'undefined') {
    return {}
  }

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  if (!navigation) {
    return {}
  }

  return {
    durationMs: Math.round(navigation.duration),
    domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
    firstByteMs: Math.round(navigation.responseStart),
    transferSize: navigation.transferSize,
  }
}

function observePerformance() {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return
  }

  window.addEventListener(
    'load',
    () => {
      window.setTimeout(() => {
        trackTelemetryEvent('performance.navigation', readNavigationMetrics(), { severity: 'debug' })
      }, 0)
    },
    { once: true },
  )

  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const entry = entries[entries.length - 1] as
        | (PerformanceEntry & { renderTime?: number; loadTime?: number; size?: number })
        | undefined

      if (!entry) return

      trackTelemetryEvent(
        'performance.lcp',
        {
          valueMs: Math.round(entry.renderTime || entry.loadTime || entry.startTime),
          size: entry.size,
        },
        { severity: 'debug' },
      )
    })
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {
    // Some browsers do not expose every PerformanceObserver entry type.
  }

  try {
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
        if (!entry.hadRecentInput) {
          cumulativeLayoutShift += entry.value ?? 0
        }
      }
    })
    clsObserver.observe({ type: 'layout-shift', buffered: true })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && cumulativeLayoutShift > 0) {
        trackTelemetryEvent('performance.cls', { value: Number(cumulativeLayoutShift.toFixed(4)) }, { severity: 'debug' })
      }
    })
  } catch {
    // Layout shift entries are Chromium-focused; skip silently elsewhere.
  }
}

export function initializeTelemetry() {
  if (initialized || typeof window === 'undefined') {
    return
  }

  initialized = true

  window.addEventListener('error', (event) => {
    trackTelemetryEvent(
      'runtime.error',
      {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        error: event.error,
      },
      { severity: 'error' },
    )
  })

  window.addEventListener('unhandledrejection', (event) => {
    trackTelemetryEvent('runtime.unhandled_rejection', { reason: event.reason }, { severity: 'error' })
  })

  observePerformance()
  window.addEventListener('online', () => {
    void flushQueuedTelemetry()
  })
  void flushQueuedTelemetry()
  trackTelemetryEvent('app.started', { mode: import.meta.env.MODE })
}

export function trackTelemetryEvent(name: string, properties: TelemetryProperties = {}, options: TrackOptions = {}) {
  const event = buildEvent(name, properties, options)
  sendEvents([event])
}

export function trackPageView(view: string, properties: TelemetryProperties = {}) {
  const routeKey = typeof window !== 'undefined' ? `${window.location.pathname}:${view}` : view
  if (routeKey === lastPageViewKey) {
    return
  }

  lastPageViewKey = routeKey
  trackTelemetryEvent('route.view', { view, ...properties })
}

export function getTelemetryContext() {
  return {
    enabled: telemetryEnabled(),
    debug: telemetryDebugEnabled(),
    endpoint: telemetryEndpoint(),
    sessionId: typeof window === 'undefined' ? 'server' : getSessionId(),
  }
}
