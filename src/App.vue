<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import AccessGate from '@/components/AccessGate.vue'
import BrandLogo from '@/components/BrandLogo.vue'
import FinanceDashboard from '@/components/FinanceDashboard.vue'
import MarketingHome from '@/components/MarketingHome.vue'
import { languageLocales, translate } from '@/i18n'
import {
  getCurrentUserProfile,
  getFirebaseAuthErrorMessage,
  logoutUser,
  observeAuthState,
  updateUserProfileDocument,
} from '@/services/firebase'
import { syncUserWithDataConnect, updateUserInDataConnect } from '@/services/dataconnect'
import type { AppLanguage, AppTheme, UserProfile } from '@/types/finance'

const PROFILE_STORAGE_KEY = 'ifinanca.profile'
const THEME_STORAGE_KEY = 'ifinanca.theme'
const LANGUAGE_STORAGE_KEY = 'ifinanca.language'

type AccessMode = 'login' | 'register'
type PublicView = 'home' | 'access'

function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' ? 'light' : 'dark'
}

function readStoredLanguage(): AppLanguage {
  if (typeof window === 'undefined') {
    return 'pt-BR'
  }

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return stored === 'en-US' || stored === 'es-ES' ? stored : 'pt-BR'
}

let unsubscribeAuth: (() => void) | null = null

const profile = ref<UserProfile | null>(null)
const theme = ref<AppTheme>(readStoredTheme())
const language = ref<AppLanguage>(readStoredLanguage())
const authReady = ref(false)
const authMessage = ref('')
const accessMode = ref<AccessMode>('register')
const publicView = ref<PublicView>('home')

function syncPublicViewFromHash() {
  if (typeof window === 'undefined') {
    return
  }

  // Usa hashes simples para abrir login/cadastro sem adicionar Vue Router.
  const hash = window.location.hash.toLowerCase()

  if (hash === '#login' || hash === '#entrar') {
    accessMode.value = 'login'
    publicView.value = 'access'
    return
  }

  if (hash === '#cadastro' || hash === '#criar-conta') {
    accessMode.value = 'register'
    publicView.value = 'access'
    return
  }

  publicView.value = 'home'
}

function replaceHash(hash: string) {
  if (typeof window === 'undefined' || window.location.hash === hash) {
    return
  }

  window.history.pushState(null, '', hash)
}

function openAccess(nextMode: AccessMode) {
  accessMode.value = nextMode
  publicView.value = 'access'
  replaceHash(nextMode === 'login' ? '#login' : '#cadastro')
}

function openMarketingHome() {
  publicView.value = 'home'

  if (
    typeof window !== 'undefined' &&
    ['#login', '#entrar', '#cadastro', '#criar-conta'].includes(window.location.hash.toLowerCase())
  ) {
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`)
  }
}

function persistProfile(nextProfile: UserProfile) {
  profile.value = nextProfile
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfile))
}

function clearProfile() {
  profile.value = null
  window.localStorage.removeItem(PROFILE_STORAGE_KEY)
}

function handleAuthenticated(nextProfile: UserProfile) {
  persistProfile(nextProfile)
}

async function handleProfileUpdated(nextProfile: UserProfile) {
  persistProfile(nextProfile)

  try {
    await updateUserProfileDocument(nextProfile)

    if (import.meta.env.VITE_FIREBASE_DATACONNECT_ENDPOINT) {
      await updateUserInDataConnect(nextProfile)
      await syncUserWithDataConnect(nextProfile)
    }
  } catch (error) {
    authMessage.value = getFirebaseAuthErrorMessage(error, language.value)
  }
}

function handleThemeChange(nextTheme: AppTheme) {
  theme.value = nextTheme
  window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
}

function handleLanguageChange(nextLanguage: AppLanguage) {
  language.value = nextLanguage
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)
}

async function handleLogout() {
  try {
    await logoutUser()
  } finally {
    clearProfile()
    openMarketingHome()
  }
}

onMounted(() => {
  syncPublicViewFromHash()
  window.addEventListener('hashchange', syncPublicViewFromHash)
  window.addEventListener('popstate', syncPublicViewFromHash)

  // Este listener decide se o usuario ve a area publica ou o dashboard.
  unsubscribeAuth = observeAuthState(async (user) => {
    authMessage.value = ''

    if (!user) {
      clearProfile()
      authReady.value = true
      return
    }

    if (!user.emailVerified) {
      clearProfile()
      authMessage.value = translate(language.value, 'auth.verifyBeforeLogin')
      await logoutUser()
      authReady.value = true
      return
    }

    try {
      const profileFromFirebase = await getCurrentUserProfile(user)
      persistProfile(profileFromFirebase)

      if (import.meta.env.VITE_FIREBASE_DATACONNECT_ENDPOINT) {
        await syncUserWithDataConnect(profileFromFirebase)
      }
    } catch (error) {
      clearProfile()
      authMessage.value = getFirebaseAuthErrorMessage(error, language.value)
    } finally {
      authReady.value = true
    }
  })
})

onUnmounted(() => {
  window.removeEventListener('hashchange', syncPublicViewFromHash)
  window.removeEventListener('popstate', syncPublicViewFromHash)
  unsubscribeAuth?.()
})

watch(
  language,
  (nextLanguage) => {
    if (typeof document !== 'undefined') {
      // Mantem atributos globais coerentes para acessibilidade e SEO basico.
      document.documentElement.lang = languageLocales[nextLanguage]
      document.documentElement.dir = 'ltr'
    }
  },
  { immediate: true },
)
</script>

<template>
  <main :data-theme="theme === 'dark' ? 'business' : 'emerald'" class="ifinanca-app min-h-screen">
    <section v-if="!authReady" class="grid min-h-screen place-items-center bg-[#07080d] px-4 text-white">
      <div class="text-center">
        <div class="mb-6 inline-flex items-center gap-3">
          <BrandLogo class="size-11 shrink-0 rounded-xl shadow-lg shadow-black/30" variant="favicon" />
          <span class="text-2xl font-black tracking-normal">iFinanca</span>
        </div>
        <span class="loading loading-spinner loading-lg text-[#17c964]"></span>
        <p class="mt-4 text-sm font-bold text-zinc-400">{{ translate(language, 'auth.checkingSession') }}</p>
      </div>
    </section>

    <MarketingHome
      v-else-if="!profile && publicView === 'home'"
      :language="language"
      @access-request="openAccess"
      @language-change="handleLanguageChange"
    />
    <AccessGate
      v-else-if="!profile"
      :auth-message="authMessage"
      :initial-mode="accessMode"
      :language="language"
      @authenticated="handleAuthenticated"
      @back-home="openMarketingHome"
      @language-change="handleLanguageChange"
    />
    <FinanceDashboard
      v-else
      :profile="profile"
      :theme="theme"
      :language="language"
      @logout="handleLogout"
      @profile-updated="handleProfileUpdated"
      @theme-change="handleThemeChange"
      @language-change="handleLanguageChange"
    />
  </main>
</template>
