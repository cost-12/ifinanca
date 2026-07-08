<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  ArrowRight,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from '@lucide/vue'
import { formatMoney, goalLabels, translate } from '@/i18n'
import BrandLogo from '@/components/BrandLogo.vue'
import GoogleLogo from '@/components/GoogleLogo.vue'
import LanguageFlagSelect from '@/components/LanguageFlagSelect.vue'
import MaterialIcon from '@/components/MaterialIcon.vue'
import {
  ensureAppCheckReady,
  getAppCheckErrorMessage,
  getAppCheckSiteKey,
  getFirebaseAuthErrorMessage,
  isFirebaseConfigured,
  loginWithEmailProfile,
  registerWithEmailProfile,
  retryAppCheckWarmUp,
  sendLoginPasswordReset,
  signInWithGoogleProfile,
  warmUpAppCheck,
  type AppCheckStatus,
} from '@/services/firebase'
import { trackTelemetryEvent } from '@/services/telemetry'
import type { AccessGoal, AppLanguage, UserProfile } from '@/types/finance'

const props = defineProps<{
  authMessage?: string
  initialMode?: 'login' | 'register'
  language: AppLanguage
}>()

const emit = defineEmits<{
  authenticated: [profile: UserProfile]
  backHome: []
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

const authMode = ref<'login' | 'register'>(props.initialMode ?? 'register')
const isSubmitting = ref(false)
const isGoogleSubmitting = ref(false)
const isResettingPassword = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const appCheckSiteKey = getAppCheckSiteKey()
const appCheckStatus = ref<AppCheckStatus>(appCheckSiteKey ? 'loading' : 'disabled')

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
// Centraliza a regra de habilitacao do formulario para cadastro e login.
const canSubmit = computed(() => {
  if (!isFirebaseConfigured || !isValidEmail.value || !passwordIsValid.value || !passwordMatches.value) {
    return false
  }

  return !isRegisterMode.value || form.name.trim().length > 1
})

function tr(key: Parameters<typeof translate>[1], variables?: Parameters<typeof translate>[2]) {
  return translate(props.language, key, variables)
}

function errorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown'
}

function setAuthMode(nextMode: 'login' | 'register') {
  authMode.value = nextMode
  errorMessage.value = ''
  successMessage.value = ''
  trackTelemetryEvent('auth.mode_changed', { mode: nextMode })
}

watch(
  () => props.initialMode,
  (nextMode) => {
    // A home muda a rota; o App repassa o modo correto para este componente.
    if (!nextMode || nextMode === authMode.value) {
      return
    }

    setAuthMode(nextMode)
  },
)

onMounted(() => {
  if (!appCheckSiteKey) {
    return
  }

  // Aquece o App Check antes do clique no Google para reduzir falhas no popup.
  void warmUpAppCheck().then((status) => {
    appCheckStatus.value = status
    trackTelemetryEvent('app_check.warmup', { status }, { severity: status === 'ready' ? 'debug' : 'warning' })
  })
})

async function retrySecurityCheck() {
  errorMessage.value = ''
  appCheckStatus.value = 'loading'
  trackTelemetryEvent('app_check.retry')
  const status = await retryAppCheckWarmUp()
  appCheckStatus.value = status
  trackTelemetryEvent('app_check.retry_result', { status }, { severity: status === 'ready' ? 'info' : 'warning' })
}

async function submitAccess() {
  if (!canSubmit.value || isSubmitting.value) {
    return
  }

  const mode = isRegisterMode.value ? 'register' : 'login'
  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  trackTelemetryEvent('auth.submit', { mode, provider: 'password' })

  try {
    // Cadastro cria perfil e volta para login; login emite o perfil autenticado.
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
      trackTelemetryEvent('auth.success', { mode, provider: 'password', emailVerificationRequired: true })
      return
    }

    const profile = await loginWithEmailProfile({
      email: form.email,
      password: form.password,
    })

    emit('authenticated', profile)
    trackTelemetryEvent('auth.success', { mode, provider: 'password' })
  } catch (error) {
    errorMessage.value = getFirebaseAuthErrorMessage(error, props.language)
    trackTelemetryEvent('auth.error', { mode, provider: 'password', code: errorCode(error), error }, { severity: 'error' })
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
  trackTelemetryEvent('auth.password_reset_requested')

  try {
    await sendLoginPasswordReset(form.email)
    successMessage.value = tr('auth.resetSent')
    trackTelemetryEvent('auth.password_reset_sent')
  } catch (error) {
    errorMessage.value = getFirebaseAuthErrorMessage(error, props.language)
    trackTelemetryEvent('auth.password_reset_error', { code: errorCode(error), error }, { severity: 'error' })
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
  trackTelemetryEvent('auth.submit', { mode: 'login', provider: 'google', appCheckStatus: appCheckStatus.value })

  try {
    // Quando App Check esta configurado, o token precisa estar valido antes do Google.
    if (appCheckSiteKey) {
      await ensureAppCheckReady()
      appCheckStatus.value = 'ready'
    }

    const profile = await signInWithGoogleProfile({
      goal: form.goal,
      monthlyIncome: Number(form.monthlyIncome),
    })

    emit('authenticated', profile)
    trackTelemetryEvent('auth.success', { provider: 'google' })
  } catch (error) {
    const code = errorCode(error)

    if (appCheckSiteKey && code.startsWith('app-check/')) {
      appCheckStatus.value = 'error'
      errorMessage.value = ''
    } else {
      errorMessage.value = getFirebaseAuthErrorMessage(error, props.language)
    }
    trackTelemetryEvent('auth.error', { provider: 'google', code, error }, { severity: 'error' })
  } finally {
    isGoogleSubmitting.value = false
  }
}
</script>

<template>
  <section class="min-h-screen overflow-hidden bg-[#07080d]">
    <header class="mx-auto flex h-16 w-full max-w-370 items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
      <button class="inline-flex items-center gap-2 text-left text-xl font-black tracking-normal text-white" type="button" @click="emit('backHome')">
        <BrandLogo class="size-9 shrink-0 rounded-xl shadow-sm shadow-black/30" variant="favicon" />
        <span>iFinanca</span>
      </button>
      <div class="flex items-center gap-2 text-sm text-zinc-400">
        <div class="hidden items-center gap-3 sm:flex">
          <span class="badge border-[#1f2937] bg-[#101318] text-zinc-300">Vue</span>
          <span class="badge border-[#1f2937] bg-[#101318] text-zinc-300">Firebase</span>
          <span class="badge border-[#1f2937] bg-[#101318] text-zinc-300">Pluggy</span>
        </div>
        <LanguageFlagSelect :label="tr('common.language')" :language="language" tone="dark" @language-change="emit('languageChange', $event)" />
      </div>
    </header>

    <div class="mx-auto grid min-h-[calc(100vh-64px)] max-w-370 grid-cols-1 gap-8 px-4 pb-10 sm:min-h-[calc(100vh-80px)] sm:px-6 lg:grid-cols-[1fr_minmax(390px,440px)] lg:items-center lg:gap-12 lg:px-8 2xl:grid-cols-[1fr_460px]">
      <div class="order-2 grid gap-8 lg:order-1 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center xl:grid-cols-[minmax(0,1fr)_390px]">
        <div class="max-w-2xl">
          <div class="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-[#21312a] bg-[#101a16] px-4 py-2 text-sm font-semibold text-[#76eaa2]">
            <ShieldCheck :size="17" />
            <span class="min-w-0">{{ tr('hero.badge') }}</span>
          </div>

          <h1 class="max-w-2xl text-3xl font-black leading-[1.05] text-white min-[360px]:text-4xl sm:text-5xl xl:text-6xl">
            {{ tr('hero.title') }}
          </h1>

          <p class="mt-6 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg sm:leading-8">
            {{ tr('hero.body') }}
          </p>

          <div class="mt-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
            <div class="rounded-lg border border-white/10 bg-white/4 p-4">
              <p class="text-2xl font-black text-white">4</p>
              <p class="text-sm text-zinc-500">{{ tr('hero.banks') }}</p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/4 p-4">
              <p class="text-2xl font-black text-white">2.5k</p>
              <p class="text-sm text-zinc-500">{{ tr('hero.transactions') }}</p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/4 p-4">
              <p class="text-2xl font-black text-white">30m</p>
              <p class="text-sm text-zinc-500">{{ tr('hero.sync') }}</p>
            </div>
          </div>
        </div>

        <div class="mx-auto hidden w-full max-w-90 lg:block">
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
                      <MaterialIcon name="link" :size="20" />
                    </span>
                    <span class="grid size-10 place-items-center rounded-lg bg-black/15">
                      <MaterialIcon name="receipt_long" :size="20" />
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
                    <span class="grid size-8 place-items-center rounded-full bg-[#7c16dd] text-white">
                      <MaterialIcon fill name="account_balance" :size="17" />
                    </span>
                    <span class="grid size-8 place-items-center rounded-full bg-[#ff6b00] text-white">
                      <MaterialIcon fill name="credit_card" :size="17" />
                    </span>
                    <span class="grid size-8 place-items-center rounded-full bg-[#0879bd] text-white">
                      <MaterialIcon fill name="savings" :size="17" />
                    </span>
                    <span class="grid size-8 place-items-center rounded-full bg-[#d7193f] text-white">
                      <MaterialIcon fill name="monitoring" :size="17" />
                    </span>
                  </div>
                </div>

                <div class="rounded-lg bg-white p-5 shadow-sm">
                  <p class="text-sm font-semibold text-zinc-500">{{ tr('phone.balance') }}</p>
                  <p class="mt-1 text-2xl font-black">R$ 61.624,08</p>
                  <div class="divider my-3"></div>
                  <div class="space-y-4">
                    <div class="flex items-center justify-between">
                      <span class="flex items-center gap-3 font-bold"><MaterialIcon fill name="account_balance" :size="20" /> Nubank</span>
                      <span class="font-black text-blue-600">R$ 60.500,56</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="flex items-center gap-3 font-bold"><MaterialIcon fill name="credit_card" :size="20" /> Itau</span>
                      <span class="font-black text-rose-500">-R$ 126,48</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="flex items-center gap-3 font-bold"><MaterialIcon fill name="trending_up" :size="20" /> Caixa</span>
                      <span class="font-black text-blue-600">R$ 1.250,00</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <form class="order-1 w-full rounded-lg border border-white/10 bg-[#101318] p-5 shadow-2xl shadow-black/30 sm:p-6 lg:order-2" @submit.prevent="submitAccess">
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

        <p v-if="!isFirebaseConfigured" class="alert alert-warning mb-4 rounded-lg text-sm leading-6">
          {{ tr('auth.firebaseWarning') }}
        </p>

        <p v-if="authMessage" class="alert alert-error mb-4 rounded-lg text-sm leading-6">{{ authMessage }}</p>

        <button
          class="btn mb-3 w-full border-white/10 bg-white text-[#1f2937] hover:bg-zinc-100"
          type="button"
          :disabled="!isFirebaseConfigured || isGoogleSubmitting || isSubmitting || appCheckStatus === 'loading'"
          @click="continueWithGoogle"
        >
          <span v-if="isGoogleSubmitting" class="loading loading-spinner loading-sm"></span>
          <GoogleLogo v-else class="size-5" />
          <span>{{ isGoogleSubmitting ? tr('common.openingGoogle') : tr('common.google') }}</span>
        </button>

        <p v-if="appCheckSiteKey && appCheckStatus === 'loading'" class="mb-4 text-center text-xs font-semibold text-zinc-400">
          {{ tr('auth.recaptchaLoading') }}
        </p>
        <div v-if="appCheckSiteKey && appCheckStatus === 'error'" class="alert alert-warning mb-4 flex flex-col items-start rounded-lg text-sm leading-6 sm:flex-row sm:items-center">
          <span class="min-w-0">{{ getAppCheckErrorMessage(language) }}</span>
          <button
            class="btn btn-link h-auto min-h-0 shrink-0 self-start p-0 text-sm font-bold text-[#17c964] sm:self-auto"
            type="button"
            @click="retrySecurityCheck"
          >
            {{ tr('auth.appCheckRetry') }}
          </button>
        </div>

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
