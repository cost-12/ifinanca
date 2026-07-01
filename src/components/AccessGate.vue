<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  ArrowRight,
  CreditCard,
  Landmark,
  Link2,
  LockKeyhole,
  Mail,
  ReceiptText,
  ShieldCheck,
  TrendingUp,
} from '@lucide/vue'
import { formatMoney, goalLabels, languageOptions, translate } from '@/i18n'
import {
  getFirebaseAuthErrorMessage,
  isFirebaseConfigured,
  loginWithEmailProfile,
  registerWithEmailProfile,
  sendLoginPasswordReset,
  signInWithGoogleProfile,
} from '@/services/firebase'
import type { AccessGoal, AppLanguage, UserProfile } from '@/types/finance'

const props = defineProps<{
  authMessage?: string
  language: AppLanguage
}>()

const emit = defineEmits<{
  authenticated: [profile: UserProfile]
  languageChange: [language: AppLanguage]
}>()

const goals: AccessGoal[] = [
  'Organizar fluxo mensal',
  'Unificar bancos',
  'Acompanhar investimentos',
  'Preparar imposto de renda',
]

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  goal: 'Organizar fluxo mensal' as AccessGoal,
  monthlyIncome: 8600,
})

const authMode = ref<'login' | 'register'>('register')
const isSubmitting = ref(false)
const isGoogleSubmitting = ref(false)
const isResettingPassword = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const firstName = computed(() => form.name.trim().split(' ')[0] || 'Matheus')
const translatedGoals = computed(() =>
  goals.map((goal) => ({
    value: goal,
    label: goalLabels[props.language][goal],
  })),
)
const isValidEmail = computed(() => /^\S+@\S+\.\S+$/.test(form.email))
const isRegisterMode = computed(() => authMode.value === 'register')
const passwordIsValid = computed(() => form.password.length >= 6)
const passwordMatches = computed(() => !isRegisterMode.value || form.password === form.confirmPassword)
const canSubmit = computed(() => {
  if (!isFirebaseConfigured || !isValidEmail.value || !passwordIsValid.value || !passwordMatches.value) {
    return false
  }

  return !isRegisterMode.value || form.name.trim().length > 1
})

function tr(key: Parameters<typeof translate>[1], variables?: Parameters<typeof translate>[2]) {
  return translate(props.language, key, variables)
}

function handleLanguageChange(event: Event) {
  emit('languageChange', (event.target as HTMLSelectElement).value as AppLanguage)
}

function setAuthMode(nextMode: 'login' | 'register') {
  authMode.value = nextMode
  errorMessage.value = ''
  successMessage.value = ''
}

async function submitAccess() {
  if (!canSubmit.value || isSubmitting.value) {
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    if (isRegisterMode.value) {
      await registerWithEmailProfile({
        name: form.name,
        email: form.email,
        password: form.password,
        goal: form.goal,
        monthlyIncome: Number(form.monthlyIncome),
      })

      successMessage.value = tr('auth.registerSuccess')
      authMode.value = 'login'
      form.password = ''
      form.confirmPassword = ''
      return
    }

    const profile = await loginWithEmailProfile({
      email: form.email,
      password: form.password,
    })

    emit('authenticated', profile)
  } catch (error) {
    errorMessage.value = getFirebaseAuthErrorMessage(error, props.language)
  } finally {
    isSubmitting.value = false
  }
}

async function resetPassword() {
  if (!isFirebaseConfigured || !isValidEmail.value || isResettingPassword.value) {
    errorMessage.value = tr('auth.resetEmailRequired')
    return
  }

  isResettingPassword.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await sendLoginPasswordReset(form.email)
    successMessage.value = tr('auth.resetSent')
  } catch (error) {
    errorMessage.value = getFirebaseAuthErrorMessage(error, props.language)
  } finally {
    isResettingPassword.value = false
  }
}

async function continueWithGoogle() {
  if (!isFirebaseConfigured || isGoogleSubmitting.value || isSubmitting.value) {
    return
  }

  isGoogleSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const profile = await signInWithGoogleProfile({
      goal: form.goal,
      monthlyIncome: Number(form.monthlyIncome),
    })

    emit('authenticated', profile)
  } catch (error) {
    errorMessage.value = getFirebaseAuthErrorMessage(error, props.language)
  } finally {
    isGoogleSubmitting.value = false
  }
}
</script>

<template>
  <section class="min-h-screen overflow-hidden bg-[#07080d]">
    <header class="mx-auto flex h-16 w-full max-w-[1480px] items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
      <div class="flex items-center gap-3">
        <span class="flex size-10 items-center justify-center rounded-lg bg-[#17c964] text-lg font-black text-[#06130a]">
          iF
        </span>
        <span class="text-xl font-black">iFinanca</span>
      </div>
      <div class="flex items-center gap-2 text-sm text-zinc-400">
        <div class="hidden items-center gap-3 sm:flex">
          <span class="badge border-[#1f2937] bg-[#101318] text-zinc-300">Vue</span>
          <span class="badge border-[#1f2937] bg-[#101318] text-zinc-300">Firebase</span>
          <span class="badge border-[#1f2937] bg-[#101318] text-zinc-300">Pluggy</span>
        </div>
        <label class="sr-only" for="access-language">{{ tr('common.language') }}</label>
        <select
          id="access-language"
          class="select select-sm w-20 border-white/10 bg-[#101318] text-white"
          :value="language"
          @change="handleLanguageChange"
        >
          <option v-for="option in languageOptions" :key="option.value" :value="option.value">
            {{ option.shortLabel }}
          </option>
        </select>
      </div>
    </header>

    <div class="mx-auto grid min-h-[calc(100vh-64px)] max-w-[1480px] grid-cols-1 gap-8 px-4 pb-10 sm:min-h-[calc(100vh-80px)] sm:px-6 lg:grid-cols-[1fr_minmax(390px,440px)] lg:items-center lg:gap-12 lg:px-8 2xl:grid-cols-[1fr_460px]">
      <div class="order-2 grid gap-8 lg:order-1 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center xl:grid-cols-[minmax(0,1fr)_390px]">
        <div class="max-w-2xl">
          <div class="mb-5 inline-flex items-center gap-2 rounded-full border border-[#21312a] bg-[#101a16] px-4 py-2 text-sm font-semibold text-[#76eaa2]">
            <ShieldCheck :size="17" />
            {{ tr('hero.badge') }}
          </div>

          <h1 class="max-w-2xl text-4xl font-black leading-[1.05] text-white sm:text-5xl xl:text-6xl">
            {{ tr('hero.title') }}
          </h1>

          <p class="mt-6 max-w-xl text-lg leading-8 text-zinc-400">
            {{ tr('hero.body') }}
          </p>

          <div class="mt-8 grid max-w-xl grid-cols-3 gap-3">
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p class="text-2xl font-black text-white">4</p>
              <p class="text-sm text-zinc-500">{{ tr('hero.banks') }}</p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p class="text-2xl font-black text-white">2.5k</p>
              <p class="text-sm text-zinc-500">{{ tr('hero.transactions') }}</p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p class="text-2xl font-black text-white">30m</p>
              <p class="text-sm text-zinc-500">{{ tr('hero.sync') }}</p>
            </div>
          </div>
        </div>

        <div class="mx-auto hidden w-full max-w-[360px] lg:block">
          <div class="phone-shell bg-[#101318] p-3 shadow-2xl shadow-black/40">
            <div class="overflow-hidden rounded-[26px] bg-[#f4f6f2] text-[#222]">
              <div class="bg-[#17c964] px-6 pb-16 pt-7 text-white">
                <div class="flex items-center justify-between text-sm font-bold">
                  <span>9:41</span>
                  <span class="h-3 w-8 rounded-full border border-white/70"></span>
                </div>
                <div class="mt-9 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="grid size-12 place-items-center rounded-full bg-[#0b8d3f] font-black text-white">
                      {{ firstName.slice(0, 1).toUpperCase() }}
                    </div>
                    <div>
                      <p class="text-sm font-semibold text-white/85">{{ tr('phone.goodMorning') }}</p>
                      <p class="text-xl font-black">{{ firstName }}</p>
                    </div>
                  </div>
                  <div class="flex gap-3">
                    <span class="grid size-10 place-items-center rounded-lg bg-black/15">
                      <Link2 :size="20" />
                    </span>
                    <span class="grid size-10 place-items-center rounded-lg bg-black/15">
                      <ReceiptText :size="20" />
                    </span>
                  </div>
                </div>
              </div>

              <div class="-mt-10 space-y-4 px-5 pb-6">
                <div class="rounded-lg bg-white p-5 shadow-lg shadow-black/10">
                  <div class="flex items-center justify-between">
                    <p class="text-sm font-semibold text-zinc-500">{{ tr('phone.available') }}</p>
                    <button class="btn btn-sm border-0 bg-[#daf9e6] text-[#0d9447] hover:bg-[#c8f4d9]">
                      {{ tr('phone.view') }}
                    </button>
                  </div>
                  <div class="mt-4 flex -space-x-2">
                    <span class="grid size-8 place-items-center rounded-full bg-[#7c16dd] text-xs font-black text-white">nu</span>
                    <span class="grid size-8 place-items-center rounded-full bg-[#ff6b00] text-xs font-black text-white">it</span>
                    <span class="grid size-8 place-items-center rounded-full bg-[#0879bd] text-xs font-black text-white">cx</span>
                    <span class="grid size-8 place-items-center rounded-full bg-[#d7193f] text-xs font-black text-white">br</span>
                  </div>
                </div>

                <div class="rounded-lg bg-white p-5 shadow-sm">
                  <p class="text-sm font-semibold text-zinc-500">{{ tr('phone.balance') }}</p>
                  <p class="mt-1 text-2xl font-black">R$ 61.624,08</p>
                  <div class="divider my-3"></div>
                  <div class="space-y-4">
                    <div class="flex items-center justify-between">
                      <span class="flex items-center gap-3 font-bold"><Landmark :size="20" /> Nubank</span>
                      <span class="font-black text-blue-600">R$ 60.500,56</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="flex items-center gap-3 font-bold"><CreditCard :size="20" /> Itau</span>
                      <span class="font-black text-rose-500">-R$ 126,48</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="flex items-center gap-3 font-bold"><TrendingUp :size="20" /> Caixa</span>
                      <span class="font-black text-blue-600">R$ 1.250,00</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <form class="order-1 rounded-lg border border-white/10 bg-[#101318] p-5 shadow-2xl shadow-black/30 sm:p-6 lg:order-2" @submit.prevent="submitAccess">
        <div class="mb-6">
          <p class="text-sm font-bold uppercase text-[#17c964]">{{ tr('auth.secureAccess') }}</p>
          <h2 class="mt-2 text-3xl font-black text-white">
            {{ isRegisterMode ? tr('auth.createTitle') : tr('auth.loginTitle') }}
          </h2>
          <p class="mt-2 text-sm leading-6 text-zinc-400">
            {{ isRegisterMode ? tr('auth.createSubtitle') : tr('auth.loginSubtitle') }}
          </p>
        </div>

        <div class="join mb-5 grid grid-cols-2">
          <button
            :class="['join-item btn btn-sm', isRegisterMode ? 'border-0 bg-[#17c964] text-[#06130a]' : 'border-white/10 bg-[#0b0d12] text-zinc-300']"
            type="button"
            @click="setAuthMode('register')"
          >
            {{ tr('auth.createTab') }}
          </button>
          <button
            :class="['join-item btn btn-sm', !isRegisterMode ? 'border-0 bg-[#17c964] text-[#06130a]' : 'border-white/10 bg-[#0b0d12] text-zinc-300']"
            type="button"
            @click="setAuthMode('login')"
          >
            {{ tr('auth.loginTab') }}
          </button>
        </div>

        <p v-if="!isFirebaseConfigured" class="alert alert-warning mb-4 rounded-lg text-sm">
          {{ tr('auth.firebaseWarning') }}
        </p>

        <p v-if="authMessage" class="alert alert-error mb-4 rounded-lg text-sm">{{ authMessage }}</p>

        <button
          class="btn mb-5 w-full border-white/10 bg-white text-[#1f2937] hover:bg-zinc-100"
          type="button"
          :disabled="!isFirebaseConfigured || isGoogleSubmitting || isSubmitting"
          @click="continueWithGoogle"
        >
          <span v-if="isGoogleSubmitting" class="loading loading-spinner loading-sm"></span>
          <span v-else class="grid size-5 place-items-center rounded-full border border-zinc-300 text-sm font-black text-[#4285f4]">G</span>
          <span>{{ isGoogleSubmitting ? tr('common.openingGoogle') : tr('common.google') }}</span>
        </button>

        <div class="mb-5 flex items-center gap-3 text-xs font-bold uppercase text-zinc-500">
          <span class="h-px flex-1 bg-white/10"></span>
          <span>{{ tr('common.emailPassword') }}</span>
          <span class="h-px flex-1 bg-white/10"></span>
        </div>

        <label v-if="isRegisterMode" class="form-control">
          <span class="label-text text-zinc-300">{{ tr('auth.name') }}</span>
          <input v-model="form.name" class="input w-full border-white/10 bg-[#0b0d12] text-white" :placeholder="tr('auth.namePlaceholder')" type="text" />
        </label>

        <label class="form-control" :class="{ 'mt-4': isRegisterMode }">
          <span class="label-text text-zinc-300">{{ tr('auth.email') }}</span>
          <label class="input flex w-full items-center gap-2 border-white/10 bg-[#0b0d12] text-white">
            <Mail class="text-zinc-500" :size="18" />
            <input v-model="form.email" class="grow bg-transparent" :placeholder="tr('auth.emailPlaceholder')" type="email" />
          </label>
        </label>

        <label class="form-control mt-4">
          <span class="label-text text-zinc-300">{{ tr('auth.password') }}</span>
          <label class="input flex w-full items-center gap-2 border-white/10 bg-[#0b0d12] text-white">
            <LockKeyhole class="text-zinc-500" :size="18" />
            <input v-model="form.password" class="grow bg-transparent" :placeholder="tr('auth.passwordPlaceholder')" type="password" />
          </label>
        </label>

        <label v-if="isRegisterMode" class="form-control mt-4">
          <span class="label-text text-zinc-300">{{ tr('auth.confirmPassword') }}</span>
          <input v-model="form.confirmPassword" class="input w-full border-white/10 bg-[#0b0d12] text-white" :placeholder="tr('auth.confirmPasswordPlaceholder')" type="password" />
          <span v-if="form.confirmPassword && !passwordMatches" class="mt-2 text-sm font-semibold text-[#ff6b7f]">
            {{ tr('auth.passwordMismatch') }}
          </span>
        </label>

        <label v-if="isRegisterMode" class="form-control mt-4">
          <span class="label-text text-zinc-300">{{ tr('auth.goal') }}</span>
          <select v-model="form.goal" class="select w-full border-white/10 bg-[#0b0d12] text-white">
            <option v-for="goal in translatedGoals" :key="goal.value" :value="goal.value">{{ goal.label }}</option>
          </select>
        </label>

        <label v-if="isRegisterMode" class="form-control mt-4">
          <span class="label-text text-zinc-300">{{ tr('auth.monthlyIncome') }}</span>
          <input v-model.number="form.monthlyIncome" class="range range-success" max="40000" min="1200" step="100" type="range" />
          <span class="mt-2 text-sm font-semibold text-zinc-400">
            {{ formatMoney(Number(form.monthlyIncome), language) }}
          </span>
        </label>

        <button
          v-if="!isRegisterMode"
          class="btn btn-link mt-3 h-auto min-h-0 p-0 text-sm font-bold text-[#17c964]"
          type="button"
          :disabled="isResettingPassword"
          @click="resetPassword"
        >
          {{ isResettingPassword ? tr('auth.sendingReset') : tr('auth.forgotPassword') }}
        </button>

        <p v-if="successMessage" class="alert alert-success mt-4 rounded-lg text-sm">{{ successMessage }}</p>
        <p v-if="errorMessage" class="alert alert-error mt-4 rounded-lg text-sm">{{ errorMessage }}</p>

        <button class="btn mt-6 w-full border-0 bg-[#f52a55] text-base font-black text-white hover:bg-[#e1264f]" :disabled="!canSubmit || isSubmitting">
          <span v-if="isSubmitting" class="loading loading-spinner loading-sm"></span>
          <span>{{ isSubmitting ? tr('common.loading') : isRegisterMode ? tr('auth.submitRegister') : tr('auth.submitLogin') }}</span>
          <ArrowRight :size="18" />
        </button>
      </form>
    </div>
  </section>
</template>
