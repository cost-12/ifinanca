import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadTransactionsForUser, syncUserWithDataConnect } from '@/services/dataconnect'

describe('dataconnect service', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubEnv('VITE_FIREBASE_DATACONNECT_ENDPOINT', 'https://example.test/dataconnect')
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sends a user sync mutation when the endpoint is configured', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { user_insert: { id: 'user-1', name: 'Thiago', email: 'thiago@example.com' } } }),
    })

    const result = await syncUserWithDataConnect({ id: 'user-1', name: 'Thiago', email: 'thiago@example.com' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ id: 'user-1', name: 'Thiago', email: 'thiago@example.com' })
  })

  it('returns an empty list when loading transactions without a successful response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ errors: [{ message: 'Unavailable' }] }),
    })

    const result = await loadTransactionsForUser('user-1')

    expect(result).toEqual([])
  })
})
