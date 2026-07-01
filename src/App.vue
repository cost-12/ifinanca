<script setup lang="ts">
import { ref } from 'vue'
import AccessGate from '@/components/AccessGate.vue'
import FinanceDashboard from '@/components/FinanceDashboard.vue'
import type { AppTheme, UserProfile } from '@/types/finance'

const PROFILE_STORAGE_KEY = 'ifinanca.profile'
const THEME_STORAGE_KEY = 'ifinanca.theme'

function readStoredProfile() {
  if (typeof window === 'undefined') {
    return null
  }

  const stored = window.localStorage.getItem(PROFILE_STORAGE_KEY)
  return stored ? (JSON.parse(stored) as UserProfile) : null
}

function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' ? 'light' : 'dark'
}

const profile = ref<UserProfile | null>(readStoredProfile())
const theme = ref<AppTheme>(readStoredTheme())

function persistProfile(nextProfile: UserProfile) {
  profile.value = nextProfile
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfile))
}

function handleRegistered(nextProfile: UserProfile) {
  persistProfile(nextProfile)
}

function handleProfileUpdated(nextProfile: UserProfile) {
  persistProfile(nextProfile)
}

function handleThemeChange(nextTheme: AppTheme) {
  theme.value = nextTheme
  window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
}

function handleLogout() {
  profile.value = null
  window.localStorage.removeItem(PROFILE_STORAGE_KEY)
}
</script>

<template>
  <main :data-theme="theme === 'dark' ? 'business' : 'emerald'" class="ifinanca-app min-h-screen">
    <AccessGate v-if="!profile" @registered="handleRegistered" />
    <FinanceDashboard
      v-else
      :profile="profile"
      :theme="theme"
      @logout="handleLogout"
      @profile-updated="handleProfileUpdated"
      @theme-change="handleThemeChange"
    />
  </main>
</template>
