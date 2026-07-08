import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet } from '../pluggy-data'

const env = {
  PLUGGY_CLIENT_ID: 'client-id',
  PLUGGY_CLIENT_SECRET: 'client-secret',
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('pluggy-data function', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads accounts and transactions through Pluggy v2 transactions API', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/auth')) {
        return json({ apiKey: 'api-key' })
      }

      if (url.startsWith('https://api.pluggy.ai/accounts')) {
        return json({
          results: [
            {
              id: 'account-1',
              itemId: 'item-1',
              name: 'Pluggy Bank',
              number: '1234',
              type: 'BANK',
              subtype: 'CHECKING_ACCOUNT',
              currencyCode: 'BRL',
              balance: 1200,
            },
          ],
        })
      }

      if (url.startsWith('https://api.pluggy.ai/v2/transactions')) {
        return json({
          results: [
            {
              id: 'transaction-1',
              accountId: 'account-1',
              description: 'Pix recebido',
              currencyCode: 'BRL',
              amount: 250,
              date: '2026-07-08',
              type: 'CREDIT',
              status: 'POSTED',
            },
          ],
          next: null,
        })
      }

      return json({ message: 'unexpected request' }, 500)
    })

    const response = await onRequestGet({
      request: new Request('https://ifinanca.pages.dev/api/pluggy-data?itemId=item-1'),
      env,
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      itemId: 'item-1',
      accounts: [{ id: 'account-1' }],
      transactions: [{ id: 'transaction-1', accountId: 'account-1' }],
      partialErrors: [],
    })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://api.pluggy.ai/v2/transactions?'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-KEY': 'api-key' }),
      }),
    )
  })

  it('returns partialErrors when one account transaction fetch fails', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/auth')) {
        return json({ apiKey: 'api-key' })
      }

      if (url.startsWith('https://api.pluggy.ai/accounts')) {
        return json({
          results: [
            { id: 'account-1', itemId: 'item-1', name: 'A', number: '1', type: 'BANK', subtype: 'CHECKING_ACCOUNT', currencyCode: 'BRL', balance: 10 },
            { id: 'account-2', itemId: 'item-1', name: 'B', number: '2', type: 'BANK', subtype: 'CHECKING_ACCOUNT', currencyCode: 'BRL', balance: 20 },
          ],
        })
      }

      if (url.includes('accountId=account-1')) {
        return json({ results: [], next: null })
      }

      if (url.includes('accountId=account-2')) {
        return json({ message: 'transaction service unavailable' }, 500)
      }

      return json({ message: 'unexpected request' }, 500)
    })

    const response = await onRequestGet({
      request: new Request('https://ifinanca.pages.dev/api/pluggy-data?itemId=item-1'),
      env,
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.partialErrors).toEqual([
      {
        accountId: 'account-2',
        message: 'transaction service unavailable',
      },
    ])
  })
})
