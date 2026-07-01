<script setup lang="ts">
import { ref } from 'vue'
import AccessGate from '@/components/AccessGate.vue'
import FinanceDashboard from '@/components/FinanceDashboard.vue'
import type { UserProfile } from '@/types/finance'

function readStoredProfile() {
  if (typeof window === 'undefined') {
    return null
  }

  const stored = window.localStorage.getItem('ifinanca.profile')
  return stored ? (JSON.parse(stored) as UserProfile) : null
}

const profile = ref<UserProfile | null>(readStoredProfile())

function handleRegistered(nextProfile: UserProfile) {
  profile.value = nextProfile
  window.localStorage.setItem('ifinanca.profile', JSON.stringify(nextProfile))
}

function handleLogout() {
  profile.value = null
  window.localStorage.removeItem('ifinanca.profile')
}
</script>

<template>
  <main data-theme="business" class="min-h-screen bg-[#06070a] text-white">
    <AccessGate v-if="!profile" @registered="handleRegistered" />
    <FinanceDashboard v-else :profile="profile" @logout="handleLogout" />
  </main>
</template>
