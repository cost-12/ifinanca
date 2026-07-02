import type { ConnectEventPayload, PluggyConnectProps } from 'pluggy-connect-sdk'
import type { PluggyAccount, PluggyTransaction } from '@/../functions/api/pluggy-data'

export type { PluggyAccount, PluggyTransaction }

export interface PluggyConnectionRequest {
  clientUserId: string
  userEmail: string
  onEvent?: (payload: ConnectEventPayload) => void
}

export type PluggyConnectionStatus = 'connected' | 'closed' | 'error'

export interface PluggyConnectionResult {
  status: PluggyConnectionStatus
  itemId: string
  message: string
}

export interface PluggyItemData {
  accounts: PluggyAccount[]
  transactions: PluggyTransaction[]
}

interface ConnectTokenResponse {
  accessToken?: string
  connectToken?: string
  token?: string
}

const tokenEndpoint = import.meta.env.VITE_PLUGGY_CONNECT_TOKEN_URL
const dataEndpoint = '/api/pluggy-data'

async function fetchConnectToken(request: PluggyConnectionRequest, idToken?: string) {
  if (!tokenEndpoint) {
    throw new Error('VITE_PLUGGY_CONNECT_TOKEN_URL não configurado')
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`
  }

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      clientUserId: request.clientUserId,
      userEmail: request.userEmail,
      options: {
        clientUserId: request.clientUserId,
        avoidDuplicates: true,
      },
    }),
  })

  if (response.status === 401) {
    throw new Error('Sessão expirada. Faça login novamente para conectar sua conta.')
  }

  if (!response.ok) {
    throw new Error('Não foi possível gerar o connect token Pluggy')
  }

  const payload = (await response.json()) as ConnectTokenResponse
  const connectToken = payload.connectToken ?? payload.accessToken ?? payload.token

  if (!connectToken) {
    throw new Error('Endpoint Pluggy não retornou connectToken')
  }

  return connectToken
}

/**
 * Fetches accounts and transactions for a connected Pluggy item.
 * Requires a valid Firebase ID token when the backend has FIREBASE_WEB_API_KEY set.
 */
export async function fetchPluggyItemData(itemId: string, idToken?: string): Promise<PluggyItemData> {
  const headers: Record<string, string> = {}

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`
  }

  const response = await fetch(`${dataEndpoint}?itemId=${encodeURIComponent(itemId)}`, { headers })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.error ?? 'Não foi possível carregar dados do Pluggy')
  }

  return response.json() as Promise<PluggyItemData>
}

/**
 * Gets the current Firebase ID token for the authenticated user.
 * Returns null when firebase/auth is unavailable or user is not signed in.
 */
async function getCurrentIdToken(): Promise<string | null> {
  try {
    const { getAuth } = await import('firebase/auth')
    const auth = getAuth()
    const user = auth.currentUser
    if (!user) return null
    return user.getIdToken()
  } catch {
    return null
  }
}

export async function openPluggyConnect(
  request: PluggyConnectionRequest,
): Promise<PluggyConnectionResult> {
  const idToken = await getCurrentIdToken()

  let connectToken: string

  try {
    connectToken = await fetchConnectToken(request, idToken ?? undefined)
  } catch (error) {
    // Surface auth and config errors immediately instead of falling back silently.
    const message = error instanceof Error ? error.message : 'Erro ao conectar com o Pluggy'
    return {
      status: 'error',
      itemId: '',
      message,
    }
  }

  const { PluggyConnect } = await import('pluggy-connect-sdk')

  return new Promise<PluggyConnectionResult>((resolve) => {
    const countries = ['BR'] as PluggyConnectProps['countries']
    const products = [
      'ACCOUNTS',
      'TRANSACTIONS',
      'CREDIT_CARDS',
      'INVESTMENTS',
    ] as PluggyConnectProps['products']

    const widgetProps: PluggyConnectProps = {
      connectToken,
      allowConnectInBackground: true,
      countries,
      includeSandbox: import.meta.env.VITE_PLUGGY_INCLUDE_SANDBOX === 'true',
      language: 'pt',
      products,
      theme: 'dark',
      onEvent: request.onEvent,
      onSuccess: ({ item }) => {
        resolve({
          status: 'connected',
          itemId: item.id,
          message: 'Conta conectada com sucesso pela Pluggy.',
        })
      },
      onError: (error) => {
        resolve({
          status: 'error',
          itemId: '',
          message: error.message || 'Erro ao conectar conta bancária.',
        })
      },
      onClose: () => {
        resolve({
          status: 'closed',
          itemId: '',
          message: 'Conexão encerrada pelo usuário antes da confirmação.',
        })
      },
    }

    const pluggyConnect = new PluggyConnect(widgetProps)

    pluggyConnect.init().catch((error: unknown) => {
      resolve({
        status: 'error',
        itemId: '',
        message: error instanceof Error ? error.message : 'Falha ao abrir o Pluggy Connect.',
      })
    })
  })
}
