import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteDashboardSnapshot,
  queueTelemetryEvents,
  readDashboardSnapshot,
  readTelemetryQueue,
} from '../indexeddb'

describe('indexeddb service', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fails softly when IndexedDB is not available in the runtime', async () => {
    await expect(readDashboardSnapshot('user-1')).resolves.toBeNull()
    await expect(deleteDashboardSnapshot('user-1')).resolves.toBeUndefined()
    await expect(queueTelemetryEvents([{ name: 'offline.test' }])).resolves.toBeUndefined()
    await expect(readTelemetryQueue()).resolves.toEqual([])
  })
})
