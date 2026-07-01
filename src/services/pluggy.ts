import type { ConnectEventPayload, PluggyConnectProps } from 'pluggy-connect-sdk'

export interface PluggyConnectionRequest {
  clientUserId: string
  userEmail: string
  onEvent?: (payload: ConnectEventPayload) => void
}

export interface PluggyConnectionResult {
  status: 'connected' | 'demo'
  itemId: string
  message: string
}

interface ConnectTokenResponse {
  connectToken?: string
  token?: string
}

const tokenEndpoint = import.meta.env.VITE_PLUGGY_CONNECT_TOKEN_URL

async function fetchConnectToken(request: PluggyConnectionRequest) {
  if (!tokenEndpoint) {
    throw new Error('VITE_PLUGGY_CONNECT_TOKEN_URL nao configurado')
  }

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientUserId: request.clientUserId,
      userEmail: request.userEmail,
      options: {
        clientUserId: request.clientUserId,
        avoidDuplicates: true,
      },
    }),
  })

  if (!response.ok) {
    throw new Error('Nao foi possivel gerar o connect token Pluggy')
  }

  const payload = (await response.json()) as ConnectTokenResponse
  const connectToken = payload.connectToken ?? payload.token

  if (!connectToken) {
    throw new Error('Endpoint Pluggy nao retornou connectToken')
  }

  return connectToken
}

function createDemoResult(): Promise<PluggyConnectionResult> {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      resolve({
        status: 'demo',
        itemId: `demo-${Date.now()}`,
        message: 'Modo demonstracao ativo: configure o endpoint Pluggy para abrir o widget real.',
      })
    }, 500)
  })
}

export async function openPluggyConnect(
  request: PluggyConnectionRequest,
): Promise<PluggyConnectionResult> {
  try {
    const connectToken = await fetchConnectToken(request)
    const { PluggyConnect } = await import('pluggy-connect-sdk')

    return await new Promise<PluggyConnectionResult>((resolve, reject) => {
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
          reject(new Error(error.message))
        },
        onClose: () => {
          resolve({
            status: 'demo',
            itemId: `closed-${Date.now()}`,
            message: 'Conexao encerrada antes da confirmacao.',
          })
        },
      }

      const pluggyConnect = new PluggyConnect(widgetProps)

      pluggyConnect.init().catch((error: unknown) => {
        reject(error instanceof Error ? error : new Error('Falha ao abrir Pluggy Connect'))
      })
    })
  } catch {
    return createDemoResult()
  }
}
