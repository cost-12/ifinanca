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
import { initializeTelemetry, trackPageView, trackTelemetryEvent } from '@/services/telemetry'
import type { AppLanguage, AppTheme, UserProfile } from '@/types/finance'

const PROFILE_STORAGE_KEY = 'ifinanca.profile'
const THEME_STORAGE_KEY = 'ifinanca.theme'
const LANGUAGE_STORAGE_KEY = 'ifinanca.language'

type AccessMode = 'login' | 'register'
type PublicView = 'home' | 'access'

const accessRoutes: Record<AccessMode, string> = {
  login: '/login',
  register: '/cadastro',
}

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

function normalizePathname(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
}

function replacePath(pathname: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.history.replaceState(null, '', pathname)
}

function pushPath(pathname: string) {
  if (typeof window === 'undefined' || normalizePathname(window.location.pathname) === pathname) {
    return
  }

  window.history.pushState(null, '', pathname)
}

function reportPublicView(source: string) {
  trackPageView(publicView.value, {
    source,
    accessMode: publicView.value === 'access' ? accessMode.value : undefined,
  })
}

function syncPublicViewFromLocation() {
  if (typeof window === 'undefined') {
    return
  }

  // Mantém compatibilidade com links antigos e já troca a URL para rota limpa.
  const hash = window.location.hash.toLowerCase()
  if (hash === '#login' || hash === '#entrar') {
    accessMode.value = 'login'
    publicView.value = 'access'
    replacePath(accessRoutes.login)
    reportPublicView('legacy-hash')
    return
  }

  if (hash === '#cadastro' || hash === '#criar-conta') {
    accessMode.value = 'register'
    publicView.value = 'access'
    replacePath(accessRoutes.register)
    reportPublicView('legacy-hash')
    return
  }

  const pathname = normalizePathname(window.location.pathname)
  if (pathname === '/login' || pathname === '/entrar') {
    accessMode.value = 'login'
    publicView.value = 'access'
    if (pathname !== accessRoutes.login) replacePath(accessRoutes.login)
    reportPublicView('location')
    return
  }

  if (pathname === '/cadastro' || pathname === '/criar-conta') {
    accessMode.value = 'register'
    publicView.value = 'access'
    if (pathname !== accessRoutes.register) replacePath(accessRoutes.register)
    reportPublicView('location')
    return
  }

  publicView.value = 'home'
  reportPublicView('location')
}

function openAccess(nextMode: AccessMode) {
  accessMode.value = nextMode
  publicView.value = 'access'
  pushPath(accessRoutes[nextMode])
  reportPublicView('cta')
}

function openMarketingHome() {
  publicView.value = 'home'
  pushPath('/')
  reportPublicView('brand')
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
  trackTelemetryEvent('auth.authenticated', {
    hasPluggyItems: Boolean(nextProfile.pluggyItemIds?.length),
  })
}

async function handleProfileUpdated(nextProfile: UserProfile) {
  persistProfile(nextProfile)

  try {
    await updateUserProfileDocument(nextProfile)

    if (import.meta.env.VITE_FIREBASE_DATACONNECT_ENDPOINT) {
      await updateUserInDataConnect(nextProfile)
      await syncUserWithDataConnect(nextProfile)
    }
    trackTelemetryEvent('profile.updated', {
      hasAvatar: Boolean(nextProfile.avatarUrl),
      dataconnect: Boolean(import.meta.env.VITE_FIREBASE_DATACONNECT_ENDPOINT),
    })
  } catch (error) {
    authMessage.value = getFirebaseAuthErrorMessage(error, language.value)
    trackTelemetryEvent('profile.update_error', { error }, { severity: 'error' })
  }
}

function handleThemeChange(nextTheme: AppTheme) {
  theme.value = nextTheme
  window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
  trackTelemetryEvent('settings.theme_changed', { theme: nextTheme })
}

function handleLanguageChange(nextLanguage: AppLanguage) {
  language.value = nextLanguage
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)
  trackTelemetryEvent('settings.language_changed', { language: nextLanguage })
}

async function handleLogout() {
  try {
    await logoutUser()
  } finally {
    trackTelemetryEvent('auth.logout')
    clearProfile()
    openMarketingHome()
  }
}

onMounted(() => {
  initializeTelemetry()
  syncPublicViewFromLocation()
  window.addEventListener('popstate', syncPublicViewFromLocation)

  // Este listener decide se o usuário vê a área pública ou o dashboard.
  unsubscribeAuth = observeAuthState(async (user) => {
    authMessage.value = ''

    if (!user) {
      clearProfile()
      authReady.value = true
      trackTelemetryEvent('auth.state', { authenticated: false }, { severity: 'debug' })
      return
    }

    if (!user.emailVerified) {
      clearProfile()
      authMessage.value = translate(language.value, 'auth.verifyBeforeLogin')
      await logoutUser()
      authReady.value = true
      trackTelemetryEvent('auth.email_unverified', {}, { severity: 'warning' })
      return
    }

    try {
      const profileFromFirebase = await getCurrentUserProfile(user)
      persistProfile(profileFromFirebase)

      if (import.meta.env.VITE_FIREBASE_DATACONNECT_ENDPOINT) {
        await syncUserWithDataConnect(profileFromFirebase)
      }
      trackTelemetryEvent('auth.state', {
        authenticated: true,
        dataconnect: Boolean(import.meta.env.VITE_FIREBASE_DATACONNECT_ENDPOINT),
      })
    } catch (error) {
      clearProfile()
      authMessage.value = getFirebaseAuthErrorMessage(error, language.value)
      trackTelemetryEvent('auth.profile_load_error', { error }, { severity: 'error' })
    } finally {
      authReady.value = true
    }
  })
})

onUnmounted(() => {
  window.removeEventListener('popstate', syncPublicViewFromLocation)
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
