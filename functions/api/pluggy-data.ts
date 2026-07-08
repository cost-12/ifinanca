interface PluggyDataEnv {
  PLUGGY_CLIENT_ID?: string
  PLUGGY_CLIENT_SECRET?: string
  /** Firebase Web API Key — used to verify Firebase ID tokens via the Google Identity REST API. */
  FIREBASE_WEB_API_KEY?: string
}

const PLUGGY_API_URL = 'https://api.pluggy.ai'
const MAX_ACCOUNTS_TO_FETCH = 5
const MAX_TRANSACTION_PAGES = 2

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
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
    throw new Error('Cross-origin requests are not allowed')
  }
}

function extractBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')
  if (!authorization) return null
  const parts = authorization.split(' ')
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') return null
  return parts[1]?.trim() || null
}

async function verifyFirebaseIdToken(idToken: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  )

  const body = (await response.json().catch(() => ({}))) as {
    users?: Array<{ localId?: string; emailVerified?: boolean }>
    error?: { message?: string }
  }

  if (!response.ok || !body.users?.length) {
    const reason = body.error?.message || 'Token inválido'
    throw new Error(`Firebase token verification failed: ${reason}`)
  }

  const user = body.users[0]
  if (!user) throw new Error('Firebase user not found in response')
  if (!user.emailVerified) throw new Error('Firebase user email is not verified')
  if (!user.localId) throw new Error('Firebase user ID missing')
  return user.localId
}

async function getPluggyApiKey(clientId: string, clientSecret: string): Promise<string> {
  const response = await fetch(`${PLUGGY_API_URL}/auth`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ clientId, clientSecret }),
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(body?.message ?? 'Pluggy authentication failed')
  }

  const apiKey = body?.apiKey
  if (!apiKey) throw new Error('Pluggy did not return an apiKey')
  return apiKey
}

async function fetchPluggyAccounts(apiKey: string, itemId: string) {
  const url = new URL(`${PLUGGY_API_URL}/accounts`)
  url.searchParams.set('itemId', itemId)

  const response = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
      'X-API-KEY': apiKey,
    },
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.message ?? 'Failed to fetch Pluggy accounts')
  return (body?.results ?? []) as PluggyAccount[]
}

function defaultDateFrom() {
  const date = new Date()
  date.setMonth(date.getMonth() - 12)
  return date.toISOString().slice(0, 10)
}

interface PluggyListResponse<T> {
  results?: T[]
  next?: string | null
  message?: string
}

async function fetchPluggyTransactions(apiKey: string, accountId: string) {
  const transactions: PluggyTransaction[] = []
  let after: string | null = null

  for (let page = 0; page < MAX_TRANSACTION_PAGES; page += 1) {
    const url = new URL(`${PLUGGY_API_URL}/v2/transactions`)
    url.searchParams.set('accountId', accountId)
    url.searchParams.set('dateFrom', defaultDateFrom())
    if (after) {
      url.searchParams.set('after', after)
    }

    const response = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        'X-API-KEY': apiKey,
      },
    })

    const body = (await response.json().catch(() => ({}))) as PluggyListResponse<PluggyTransaction>
    if (!response.ok) throw new Error(body?.message ?? 'Failed to fetch Pluggy transactions')

    transactions.push(...(body.results ?? []))
    after = body.next || null
    if (!after) break
  }

  return transactions
}

// ── Pluggy API types ──────────────────────────────────────────────────────────

export interface PluggyAccount {
  id: string
  itemId: string
  name: string
  marketingName?: string
  number: string
  type: 'BANK' | 'CREDIT' | 'INVESTMENT' | (string & {})
  subtype: string
  currencyCode: string
  balance: number
  bankData?: {
    transferNumber?: string
    closingBalance?: number
    automaticallyInvestedBalance?: number
    overdraftContractedLimit?: number
    overdraftUsedLimit?: number
    unarrangedOverdraftAmount?: number
  }
  creditData?: {
    creditLimit: number
    availableCreditLimit: number
    balanceCloseDate?: string
    balanceDueDate?: string
  }
  investmentData?: {
    rate?: number
    rateType?: string
    fixedAnnualRate?: number
    issuerName?: string
    isinCode?: string
  }
  owner?: string
  taxNumber?: string
  updatedAt?: string
}

export interface PluggyTransaction {
  id: string
  accountId: string
  description: string
  descriptionRaw?: string
  currencyCode: string
  amount: number
  date: string
  balance?: number
  category?: string
  categoryId?: string
  type: 'DEBIT' | 'CREDIT' | (string & {})
  status: 'POSTED' | 'PENDING' | (string & {})
  paymentData?: {
    payer?: { name?: string; documentNumber?: { type?: string; value?: string } }
    receiver?: { name?: string; documentNumber?: { type?: string; value?: string } }
    paymentMethod?: string
    referenceNumber?: string
  }
  merchant?: {
    name?: string
    businessName?: string
    cnpj?: string
    category?: string
  }
}

export interface PluggyDataResponse {
  itemId: string
  loadedAt: string
  accounts: PluggyAccount[]
  transactions: PluggyTransaction[]
  partialErrors: Array<{ accountId: string; message: string }>
}

// ─────────────────────────────────────────────────────────────────────────────

export async function onRequestGet({ request, env }: { request: Request; env: PluggyDataEnv }) {
  try {
    assertSameOrigin(request)

    // ── Auth gate ────────────────────────────────────────────────────────────
    if (env.FIREBASE_WEB_API_KEY) {
      const idToken = extractBearerToken(request)
      if (!idToken) {
        return jsonResponse({ error: 'Missing Firebase ID token' }, 401)
      }
      await verifyFirebaseIdToken(idToken, env.FIREBASE_WEB_API_KEY)
    }

    const url = new URL(request.url)
    const itemId = url.searchParams.get('itemId')?.trim()

    if (!itemId) {
      return jsonResponse({ error: 'itemId query parameter is required' }, 400)
    }

    const clientId = env.PLUGGY_CLIENT_ID
    const clientSecret = env.PLUGGY_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return jsonResponse({ error: 'Pluggy credentials are not configured' }, 500)
    }

    const apiKey = await getPluggyApiKey(clientId, clientSecret)
    const accounts = await fetchPluggyAccounts(apiKey, itemId)

    // The current Pluggy recommendation is cursor pagination through /v2/transactions.
    // We cap the amount of account/page fan-out so the Pages Function remains responsive.
    const accountsToFetch = accounts.slice(0, MAX_ACCOUNTS_TO_FETCH)
    const transactionsByAccount = await Promise.allSettled(
      accountsToFetch.map((account) => fetchPluggyTransactions(apiKey, account.id)),
    )

    const transactions: PluggyTransaction[] = transactionsByAccount.flatMap((result) =>
      result.status === 'fulfilled' ? result.value : [],
    )
    const partialErrors = transactionsByAccount.flatMap((result, index) => {
      if (result.status === 'fulfilled') return []

      return [
        {
          accountId: accountsToFetch[index]?.id ?? 'unknown',
          message: result.reason instanceof Error ? result.reason.message : 'Failed to fetch Pluggy transactions',
        },
      ]
    })

    return jsonResponse({
      itemId,
      loadedAt: new Date().toISOString(),
      accounts,
      transactions,
      partialErrors,
    } satisfies PluggyDataResponse)
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unexpected error fetching Pluggy data' },
      502,
    )
  }
}
