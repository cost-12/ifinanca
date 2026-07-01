import type { FirebaseApp } from 'firebase/app'
import type { Firestore } from 'firebase/firestore/lite'
import type { UserProfile } from '@/types/finance'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let app: FirebaseApp | null = null
let db: Firestore | null = null
let servicePromise: Promise<{
  app: FirebaseApp
  db: Firestore
  addDoc: typeof import('firebase/firestore/lite').addDoc
  collection: typeof import('firebase/firestore/lite').collection
  serverTimestamp: typeof import('firebase/firestore/lite').serverTimestamp
}> | null = null

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
)

async function getFirebaseServices() {
  if (!isFirebaseConfigured) {
    return null
  }

  if (!servicePromise) {
    servicePromise = Promise.all([
      import('firebase/app'),
      import('firebase/firestore/lite'),
    ]).then(([appModule, firestoreModule]) => {
      if (!app) {
        app = appModule.initializeApp(firebaseConfig)
        db = firestoreModule.getFirestore(app)
      }

      return {
        app: app as FirebaseApp,
        db: db as Firestore,
        addDoc: firestoreModule.addDoc,
        collection: firestoreModule.collection,
        serverTimestamp: firestoreModule.serverTimestamp,
      }
    })
  }

  return servicePromise
}

function persistLeadLocally(profile: UserProfile) {
  if (typeof window === 'undefined') {
    return
  }

  const stored = window.localStorage.getItem('ifinanca.leads')
  const leads = stored ? (JSON.parse(stored) as UserProfile[]) : []
  window.localStorage.setItem('ifinanca.leads', JSON.stringify([profile, ...leads].slice(0, 20)))
}

export async function saveLead(profile: UserProfile) {
  persistLeadLocally(profile)

  const services = await getFirebaseServices()
  if (!services) {
    return { mode: 'local' as const }
  }

  await services.addDoc(services.collection(services.db, 'ifinanca_leads'), {
    ...profile,
    createdAt: services.serverTimestamp(),
    source: 'ifinanca-vue',
  })

  return { mode: 'firebase' as const }
}
