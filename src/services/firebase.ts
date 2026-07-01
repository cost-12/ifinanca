import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type Auth,
  type Unsubscribe,
  type User,
} from 'firebase/auth'
import {
  deleteField,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore/lite'
import type { AccessGoal, UserProfile } from '@/types/finance'

export interface RegisterProfileInput {
  name: string
  email: string
  password: string
  goal: AccessGoal
  monthlyIncome: number
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterResult {
  profile: UserProfile
  emailVerificationSent: boolean
}

type FirestoreProfileData = Partial<UserProfile> & {
  createdAt?: unknown
  updatedAt?: unknown
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const defaultGoal: AccessGoal = 'Organizar fluxo mensal'
const validGoals = new Set<AccessGoal>([
  'Organizar fluxo mensal',
  'Unificar bancos',
  'Acompanhar investimentos',
  'Preparar imposto de renda',
])

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
)

function getFirebaseServices() {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase nao configurado.')
  }

  if (!app) {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    db = getFirestore(app)
  }

  return {
    app,
    auth: auth as Auth,
    db: db as Firestore,
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function dateToIso(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }

  return new Date().toISOString()
}

function resolveGoal(goal: unknown): AccessGoal {
  return typeof goal === 'string' && validGoals.has(goal as AccessGoal) ? (goal as AccessGoal) : defaultGoal
}

function createAuthFlowError(code: string, message: string) {
  return Object.assign(new Error(message), { code })
}

function profileFromUser(user: User, data: FirestoreProfileData = {}): UserProfile {
  return {
    id: user.uid,
    name: normalizeName(data.name || user.displayName || 'Usuario iFinanca'),
    email: normalizeEmail(data.email || user.email || ''),
    goal: resolveGoal(data.goal),
    monthlyIncome: typeof data.monthlyIncome === 'number' ? data.monthlyIncome : 0,
    createdAt: dateToIso(data.createdAt),
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : undefined,
  }
}

async function writeInitialProfile(user: User, input?: Partial<RegisterProfileInput>) {
  const { db } = getFirebaseServices()
  const profile: UserProfile = {
    id: user.uid,
    name: normalizeName(input?.name || user.displayName || 'Usuario iFinanca'),
    email: normalizeEmail(input?.email || user.email || ''),
    goal: input?.goal || defaultGoal,
    monthlyIncome: Number(input?.monthlyIncome || 0),
    createdAt: new Date().toISOString(),
  }

  await setDoc(doc(db, 'users', user.uid), {
    ...profile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    source: 'ifinanca-vue',
  })

  return profile
}

export async function getCurrentUserProfile(user: User) {
  const { db } = getFirebaseServices()
  const profileRef = doc(db, 'users', user.uid)
  const snapshot = await getDoc(profileRef)

  if (!snapshot.exists()) {
    return writeInitialProfile(user)
  }

  return profileFromUser(user, snapshot.data() as FirestoreProfileData)
}

export function observeAuthState(onChange: (user: User | null) => void): Unsubscribe {
  if (!isFirebaseConfigured) {
    queueMicrotask(() => onChange(null))
    return () => undefined
  }

  const { auth } = getFirebaseServices()
  return onAuthStateChanged(auth, onChange)
}

export async function registerWithEmailProfile(input: RegisterProfileInput) {
  const { auth } = getFirebaseServices()
  const email = normalizeEmail(input.email)
  const name = normalizeName(input.name)
  const credential = await createUserWithEmailAndPassword(auth, email, input.password)

  await updateProfile(credential.user, { displayName: name })

  const profile = await writeInitialProfile(credential.user, {
    ...input,
    name,
    email,
  })

  await sendEmailVerification(credential.user)
  await signOut(auth)

  return {
    profile,
    emailVerificationSent: true,
  } satisfies RegisterResult
}

export async function loginWithEmailProfile(input: LoginInput) {
  const { auth } = getFirebaseServices()
  const credential = await signInWithEmailAndPassword(auth, normalizeEmail(input.email), input.password)

  await credential.user.reload()

  if (!credential.user.emailVerified) {
    await sendEmailVerification(credential.user)
    await signOut(auth)
    throw createAuthFlowError('auth/email-not-verified', 'E-mail ainda nao verificado.')
  }

  return getCurrentUserProfile(credential.user)
}

export async function signInWithGoogleProfile(input?: Partial<RegisterProfileInput>) {
  const { auth } = getFirebaseServices()
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({
    prompt: 'select_account',
  })

  const credential = await signInWithPopup(auth, provider)

  await credential.user.reload()

  if (!credential.user.emailVerified) {
    await signOut(auth)
    throw createAuthFlowError('auth/email-not-verified', 'E-mail ainda nao verificado.')
  }

  const { db } = getFirebaseServices()
  const profileRef = doc(db, 'users', credential.user.uid)
  const snapshot = await getDoc(profileRef)

  if (!snapshot.exists()) {
    return writeInitialProfile(credential.user, {
      goal: input?.goal || defaultGoal,
      monthlyIncome: Number(input?.monthlyIncome || 0),
    })
  }

  return profileFromUser(credential.user, snapshot.data() as FirestoreProfileData)
}

export async function logoutUser() {
  const { auth } = getFirebaseServices()
  await signOut(auth)
}

export async function sendLoginPasswordReset(email: string) {
  const { auth } = getFirebaseServices()
  await sendPasswordResetEmail(auth, normalizeEmail(email))
}

export async function updateUserProfileDocument(profile: UserProfile) {
  const { auth, db } = getFirebaseServices()

  if (!auth.currentUser || auth.currentUser.uid !== profile.id) {
    throw new Error('Usuario nao autenticado.')
  }

  const nextName = normalizeName(profile.name)

  if (auth.currentUser.displayName !== nextName) {
    await updateProfile(auth.currentUser, { displayName: nextName })
  }

  await updateDoc(doc(db, 'users', profile.id), {
    name: nextName,
    email: normalizeEmail(profile.email),
    goal: profile.goal,
    monthlyIncome: Number(profile.monthlyIncome),
    avatarUrl: profile.avatarUrl || deleteField(),
    updatedAt: serverTimestamp(),
  })
}

export function getFirebaseAuthErrorMessage(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''

  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'Este e-mail ja possui uma conta.',
    'auth/email-not-verified': 'Confirme seu e-mail antes de entrar. Enviamos um novo link de verificacao.',
    'auth/invalid-credential': 'E-mail ou senha invalidos.',
    'auth/invalid-email': 'Informe um e-mail valido.',
    'auth/missing-password': 'Informe sua senha.',
    'auth/network-request-failed': 'Falha de rede. Verifique sua conexao.',
    'auth/operation-not-allowed': 'Habilite o provedor Email/Senha no Firebase Authentication.',
    'auth/account-exists-with-different-credential': 'Este e-mail ja esta cadastrado com outro metodo de acesso.',
    'auth/cancelled-popup-request': 'A janela do Google foi cancelada.',
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Permita pop-ups para continuar.',
    'auth/popup-closed-by-user': 'A janela do Google foi fechada antes de concluir.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
    'auth/unauthorized-domain': 'Adicione este dominio nos dominios autorizados do Firebase Authentication.',
    'auth/user-not-found': 'Conta nao encontrada.',
    'auth/weak-password': 'Use uma senha com pelo menos 6 caracteres.',
    'auth/wrong-password': 'E-mail ou senha invalidos.',
  }

  return messages[code] || 'Nao foi possivel concluir a autenticacao agora.'
}
