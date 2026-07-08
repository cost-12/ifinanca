import type { ConnectEventPayload, PluggyConnectProps } from 'pluggy-connect-sdk'
import type { PluggyAccount, PluggyDataResponse, PluggyTransaction } from '@/../functions/api/pluggy-data'

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
  itemId?: string
  loadedAt?: string
  accounts: PluggyAccount[]
  transactions: PluggyTransaction[]
  partialErrors?: PluggyDataResponse['partialErrors']
}

interface ConnectTokenResponse {
  accessToken?: string
  connectToken?: string
  token?: string
}

const tokenEndpoint = import.meta.env.VITE_PLUGGY_CONNECT_TOKEN_URL || '/api/connect-token'
const dataEndpoint = '/api/pluggy-data'

export function isPluggySandboxEnabled() {
  return import.meta.env.VITE_PLUGGY_INCLUDE_SANDBOX === 'true'
}

async function fetchConnectToken(request: PluggyConnectionRequest, idToken?: string) {
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
  const resolvedIdToken = idToken ?? (await getCurrentIdToken()) ?? undefined
  const headers: Record<string, string> = {}

  if (resolvedIdToken) {
    headers['Authorization'] = `Bearer ${resolvedIdToken}`
  }

  const response = await fetch(`${dataEndpoint}?itemId=${encodeURIComponent(itemId)}`, { headers })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.error ?? 'Não foi possível carregar dados do Pluggy')
  }

  const payload = (await response.json()) as PluggyItemData

  return {
    itemId: payload.itemId ?? itemId,
    loadedAt: payload.loadedAt,
    accounts: Array.isArray(payload.accounts) ? payload.accounts : [],
    transactions: Array.isArray(payload.transactions) ? payload.transactions : [],
    partialErrors: Array.isArray(payload.partialErrors) ? payload.partialErrors : [],
  }
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

  // Importacao sob demanda evita carregar o widget Pluggy antes de o usuario conectar uma conta.
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
      allowFullscreen: true,
      countries,
      includeSandbox: isPluggySandboxEnabled(),
      language: 'pt',
      products,
      // The Pluggy iframe owns its internal styles; light mode keeps sandbox credential
      // selectors readable even when the dashboard behind the modal is dark.
      theme: 'light',
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
