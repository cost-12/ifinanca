<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import AccessGate from '@/components/AccessGate.vue'
import FinanceDashboard from '@/components/FinanceDashboard.vue'
import { languageLocales, translate } from '@/i18n'
import {
  getCurrentUserProfile,
  getFirebaseAuthErrorMessage,
  logoutUser,
  observeAuthState,
  updateUserProfileDocument,
} from '@/services/firebase'
import type { AppLanguage, AppTheme, UserProfile } from '@/types/finance'

const PROFILE_STORAGE_KEY = 'ifinanca.profile'
const THEME_STORAGE_KEY = 'ifinanca.theme'
const LANGUAGE_STORAGE_KEY = 'ifinanca.language'

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
  }
}

onMounted(() => {
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
      persistProfile(await getCurrentUserProfile(user))
    } catch (error) {
      clearProfile()
      authMessage.value = getFirebaseAuthErrorMessage(error, language.value)
    } finally {
      authReady.value = true
    }
  })
})

onUnmounted(() => {
  unsubscribeAuth?.()
})

watch(
  language,
  (nextLanguage) => {
    if (typeof document !== 'undefined') {
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
        <span class="loading loading-spinner loading-lg text-[#17c964]"></span>
        <p class="mt-4 text-sm font-bold text-zinc-400">{{ translate(language, 'auth.checkingSession') }}</p>
      </div>
    </section>

    <AccessGate
      v-else-if="!profile"
      :auth-message="authMessage"
      :language="language"
      @authenticated="handleAuthenticated"
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
