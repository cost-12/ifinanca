import type { UserProfile } from '@/types/finance'

export interface DataConnectTransactionPayload {
  id: string
  title: string
  amount: number
  currency: string
  status: string
  createdAt?: string
}

interface DataConnectUserPayload {
  id: string
  name: string
  email: string
}

interface DataConnectResponse<T> {
  data?: T
  errors?: Array<{ message?: string }>
}

function getEndpoint() {
  return import.meta.env.VITE_FIREBASE_DATACONNECT_ENDPOINT?.trim() || ''
}

async function postDataConnect<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  const url = getEndpoint()

  if (!url) {
    return null
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as DataConnectResponse<T>
  return payload.data ?? null
}

export async function syncUserWithDataConnect(profile: UserProfile | DataConnectUserPayload) {
  const mutation = `
    mutation CreateUser($id: String!, $name: String!, $email: String!) {
      user_insert(data: { id: $id, name: $name, email: $email }) {
        id
        name
        email
      }
    }
  `

  const result = await postDataConnect<{ user_insert: DataConnectUserPayload }>(mutation, {
    id: profile.id,
    name: profile.name,
    email: profile.email,
  })

  return result?.user_insert ?? null
}

export async function updateUserInDataConnect(profile: UserProfile | DataConnectUserPayload) {
  const mutation = `
    mutation UpdateUser($id: String!, $name: String!, $email: String!) {
      user_update(key: { id: $id }, data: { name: $name, email: $email }) {
        id
        name
        email
      }
    }
  `

  const result = await postDataConnect<{ user_update: DataConnectUserPayload }>(mutation, {
    id: profile.id,
    name: profile.name,
    email: profile.email,
  })

  return result?.user_update ?? null
}

export async function loadTransactionsForUser(userId: string) {
  const query = `
    query ListTransactionsForUser($userId: String!) {
      transactionList(filter: { userId: { eq: $userId } }) {
        id
        title
        amount
        currency
        status
        createdAt
      }
    }
  `

  const result = await postDataConnect<{ transactionList: DataConnectTransactionPayload[] }>(query, { userId })
  return result?.transactionList ?? []
}

export async function updateTransactionStatusInDataConnect(transactionId: string, status: string) {
  const mutation = `
    mutation UpdateTransactionStatus($id: String!, $status: String!) {
      transaction_update(key: { id: $id }, data: { status: $status }) {
        id
        status
      }
    }
  `

  const result = await postDataConnect<{ transaction_update: { id: string; status: string } }>(mutation, {
    id: transactionId,
    status,
  })

  return result?.transaction_update ?? null
}
