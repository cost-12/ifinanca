import type { BankConnection, DataSource, Transaction } from '@/types/finance'

const DB_NAME = 'ifinanca-client-cache'
const DB_VERSION = 1
const DASHBOARD_STORE = 'dashboardSnapshots'
const TELEMETRY_STORE = 'telemetryQueue'
const MAX_TELEMETRY_BATCHES = 20

export interface DashboardSnapshot {
  profileId: string
  savedAt: string
  source: DataSource
  bankConnections: BankConnection[]
  transactions: Transaction[]
  connectedItemId: string
  pluggyDataLoadedAt: string
  pluggyPartialErrors: Array<{ accountId: string; message: string }>
}

export interface QueuedTelemetryBatch {
  id: string
  createdAt: string
  events: unknown[]
}

let databasePromise: Promise<IDBDatabase | null> | null = null

function hasIndexedDB() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
}

function createId(prefix: string) {
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  return `${prefix}-${randomPart}`
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
  })
}

function openDatabase() {
  if (!hasIndexedDB()) {
    return Promise.resolve(null)
  }

  if (databasePromise) {
    return databasePromise
  }

  databasePromise = new Promise<IDBDatabase | null>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(DASHBOARD_STORE)) {
        db.createObjectStore(DASHBOARD_STORE, { keyPath: 'profileId' })
      }

      if (!db.objectStoreNames.contains(TELEMETRY_STORE)) {
        const telemetryStore = db.createObjectStore(TELEMETRY_STORE, { keyPath: 'id' })
        telemetryStore.createIndex('createdAt', 'createdAt')
      }
    }

    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
        databasePromise = null
      }
      resolve(db)
    }
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'))
    request.onblocked = () => reject(new Error('IndexedDB upgrade was blocked by another tab'))
  }).catch(() => null)

  return databasePromise
}

export async function saveDashboardSnapshot(snapshot: DashboardSnapshot) {
  const db = await openDatabase()
  if (!db) return

  const transaction = db.transaction(DASHBOARD_STORE, 'readwrite')
  transaction.objectStore(DASHBOARD_STORE).put(snapshot)
  await transactionDone(transaction)
}

export async function readDashboardSnapshot(profileId: string) {
  const db = await openDatabase()
  if (!db) return null

  const transaction = db.transaction(DASHBOARD_STORE, 'readonly')
  const snapshot = await requestToPromise<DashboardSnapshot | undefined>(
    transaction.objectStore(DASHBOARD_STORE).get(profileId),
  )
  await transactionDone(transaction)

  return snapshot ?? null
}

export async function deleteDashboardSnapshot(profileId: string) {
  const db = await openDatabase()
  if (!db) return

  const transaction = db.transaction(DASHBOARD_STORE, 'readwrite')
  transaction.objectStore(DASHBOARD_STORE).delete(profileId)
  await transactionDone(transaction)
}

export async function queueTelemetryEvents(events: unknown[]) {
  if (!events.length) return

  const db = await openDatabase()
  if (!db) return

  const transaction = db.transaction(TELEMETRY_STORE, 'readwrite')
  const store = transaction.objectStore(TELEMETRY_STORE)

  store.put({
    id: createId('telemetry'),
    createdAt: new Date().toISOString(),
    events,
  } satisfies QueuedTelemetryBatch)

  await transactionDone(transaction)
  await trimTelemetryQueue()
}

export async function readTelemetryQueue(limit = 8) {
  const db = await openDatabase()
  if (!db) return []

  const transaction = db.transaction(TELEMETRY_STORE, 'readonly')
  const index = transaction.objectStore(TELEMETRY_STORE).index('createdAt')
  const batches = await requestToPromise<QueuedTelemetryBatch[]>(index.getAll(undefined, limit))
  await transactionDone(transaction)

  return batches
}

export async function deleteTelemetryBatch(id: string) {
  const db = await openDatabase()
  if (!db) return

  const transaction = db.transaction(TELEMETRY_STORE, 'readwrite')
  transaction.objectStore(TELEMETRY_STORE).delete(id)
  await transactionDone(transaction)
}

async function trimTelemetryQueue() {
  const db = await openDatabase()
  if (!db) return

  const transaction = db.transaction(TELEMETRY_STORE, 'readwrite')
  const store = transaction.objectStore(TELEMETRY_STORE)
  const index = store.index('createdAt')
  const batches = await requestToPromise<QueuedTelemetryBatch[]>(
    index.getAll(undefined, MAX_TELEMETRY_BATCHES + 10),
  )

  const excess = Math.max(0, batches.length - MAX_TELEMETRY_BATCHES)
  for (const batch of batches.slice(0, excess)) {
    store.delete(batch.id)
  }

  await transactionDone(transaction)
}
