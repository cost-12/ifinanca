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
import {
  getFirebaseAuthErrorMessage,
  isFirebaseConfigured,
  loginWithEmailProfile,
  registerWithEmailProfile,
  sendLoginPasswordReset,
} from '@/services/firebase'
import type { AccessGoal, UserProfile } from '@/types/finance'

defineProps<{
  authMessage?: string
}>()

const emit = defineEmits<{
  authenticated: [profile: UserProfile]
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
const isResettingPassword = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const firstName = computed(() => form.name.trim().split(' ')[0] || 'Matheus')
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
    const profile = isRegisterMode.value
      ? await registerWithEmailProfile({
          name: form.name,
          email: form.email,
          password: form.password,
          goal: form.goal,
          monthlyIncome: Number(form.monthlyIncome),
        })
      : await loginWithEmailProfile({
          email: form.email,
          password: form.password,
        })

    emit('authenticated', profile)
  } catch (error) {
    errorMessage.value = getFirebaseAuthErrorMessage(error)
  } finally {
    isSubmitting.value = false
  }
}

async function resetPassword() {
  if (!isFirebaseConfigured || !isValidEmail.value || isResettingPassword.value) {
    errorMessage.value = 'Informe seu e-mail para receber o link de redefinicao.'
    return
  }

  isResettingPassword.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await sendLoginPasswordReset(form.email)
    successMessage.value = 'Enviamos um link de redefinicao para seu e-mail.'
  } catch (error) {
    errorMessage.value = getFirebaseAuthErrorMessage(error)
  } finally {
    isResettingPassword.value = false
  }
}
</script>

<template>
  <section class="min-h-screen overflow-hidden bg-[#07080d]">
    <header class="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <div class="flex items-center gap-3">
        <span class="flex size-10 items-center justify-center rounded-lg bg-[#17c964] text-lg font-black text-[#06130a]">
          iF
        </span>
        <span class="text-xl font-black">iFinanca</span>
      </div>
      <div class="hidden items-center gap-3 text-sm text-zinc-400 sm:flex">
        <span class="badge border-[#1f2937] bg-[#101318] text-zinc-300">Vue</span>
        <span class="badge border-[#1f2937] bg-[#101318] text-zinc-300">Firebase</span>
        <span class="badge border-[#1f2937] bg-[#101318] text-zinc-300">Pluggy</span>
      </div>
    </header>

    <div class="mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl grid-cols-1 gap-10 px-4 pb-10 sm:px-6 lg:grid-cols-[1fr_420px] lg:items-center lg:px-8">
      <div class="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
        <div class="max-w-2xl">
          <div class="mb-5 inline-flex items-center gap-2 rounded-full border border-[#21312a] bg-[#101a16] px-4 py-2 text-sm font-semibold text-[#76eaa2]">
            <ShieldCheck :size="17" />
            Open Finance Brasil para sua rotina
          </div>

          <h1 class="max-w-2xl text-5xl font-black leading-[1.04] text-white sm:text-6xl">
            Sua central financeira conectada
          </h1>

          <p class="mt-6 max-w-xl text-lg leading-8 text-zinc-400">
            Cadastre-se para acessar uma visao unificada de contas, cartoes, fluxo de caixa e patrimonio com base visual inspirada no Meu Pluggy.
          </p>

          <div class="mt-8 grid max-w-xl grid-cols-3 gap-3">
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p class="text-2xl font-black text-white">4</p>
              <p class="text-sm text-zinc-500">bancos</p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p class="text-2xl font-black text-white">2.5k</p>
              <p class="text-sm text-zinc-500">lancamentos</p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p class="text-2xl font-black text-white">30m</p>
              <p class="text-sm text-zinc-500">sync</p>
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
                      <p class="text-sm font-semibold text-white/85">Bom dia,</p>
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
                    <p class="text-sm font-semibold text-zinc-500">Lancamentos disponiveis</p>
                    <button class="btn btn-sm border-0 bg-[#daf9e6] text-[#0d9447] hover:bg-[#c8f4d9]">
                      Visualizar
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
                  <p class="text-sm font-semibold text-zinc-500">Saldo geral</p>
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

      <form class="rounded-lg border border-white/10 bg-[#101318] p-5 shadow-2xl shadow-black/30 sm:p-6" @submit.prevent="submitAccess">
        <div class="mb-6">
          <p class="text-sm font-bold uppercase text-[#17c964]">Acesso seguro</p>
          <h2 class="mt-2 text-3xl font-black text-white">
            {{ isRegisterMode ? 'Crie sua conta' : 'Entre na sua conta' }}
          </h2>
          <p class="mt-2 text-sm leading-6 text-zinc-400">
            {{ isRegisterMode ? 'Seu perfil sera protegido por Firebase Auth.' : 'Use seu e-mail e senha cadastrados.' }}
          </p>
        </div>

        <div class="join mb-5 grid grid-cols-2">
          <button
            :class="['join-item btn btn-sm', isRegisterMode ? 'border-0 bg-[#17c964] text-[#06130a]' : 'border-white/10 bg-[#0b0d12] text-zinc-300']"
            type="button"
            @click="setAuthMode('register')"
          >
            Criar conta
          </button>
          <button
            :class="['join-item btn btn-sm', !isRegisterMode ? 'border-0 bg-[#17c964] text-[#06130a]' : 'border-white/10 bg-[#0b0d12] text-zinc-300']"
            type="button"
            @click="setAuthMode('login')"
          >
            Entrar
          </button>
        </div>

        <p v-if="!isFirebaseConfigured" class="alert alert-warning mb-4 rounded-lg text-sm">
          Configure as variaveis Firebase e habilite Email/Senha no Firebase Authentication.
        </p>

        <p v-if="authMessage" class="alert alert-error mb-4 rounded-lg text-sm">{{ authMessage }}</p>

        <label v-if="isRegisterMode" class="form-control">
          <span class="label-text text-zinc-300">Nome</span>
          <input v-model="form.name" class="input w-full border-white/10 bg-[#0b0d12] text-white" placeholder="Seu nome" type="text" />
        </label>

        <label class="form-control" :class="{ 'mt-4': isRegisterMode }">
          <span class="label-text text-zinc-300">E-mail</span>
          <label class="input flex w-full items-center gap-2 border-white/10 bg-[#0b0d12] text-white">
            <Mail class="text-zinc-500" :size="18" />
            <input v-model="form.email" class="grow bg-transparent" placeholder="voce@email.com" type="email" />
          </label>
        </label>

        <label class="form-control mt-4">
          <span class="label-text text-zinc-300">Senha</span>
          <label class="input flex w-full items-center gap-2 border-white/10 bg-[#0b0d12] text-white">
            <LockKeyhole class="text-zinc-500" :size="18" />
            <input v-model="form.password" class="grow bg-transparent" placeholder="Minimo 6 caracteres" type="password" />
          </label>
        </label>

        <label v-if="isRegisterMode" class="form-control mt-4">
          <span class="label-text text-zinc-300">Confirmar senha</span>
          <input v-model="form.confirmPassword" class="input w-full border-white/10 bg-[#0b0d12] text-white" placeholder="Repita sua senha" type="password" />
          <span v-if="form.confirmPassword && !passwordMatches" class="mt-2 text-sm font-semibold text-[#ff6b7f]">
            As senhas precisam ser iguais.
          </span>
        </label>

        <label v-if="isRegisterMode" class="form-control mt-4">
          <span class="label-text text-zinc-300">Objetivo</span>
          <select v-model="form.goal" class="select w-full border-white/10 bg-[#0b0d12] text-white">
            <option v-for="goal in goals" :key="goal" :value="goal">{{ goal }}</option>
          </select>
        </label>

        <label v-if="isRegisterMode" class="form-control mt-4">
          <span class="label-text text-zinc-300">Receita mensal estimada</span>
          <input v-model.number="form.monthlyIncome" class="range range-success" max="40000" min="1200" step="100" type="range" />
          <span class="mt-2 text-sm font-semibold text-zinc-400">
            R$ {{ Number(form.monthlyIncome).toLocaleString('pt-BR') }}
          </span>
        </label>

        <button
          v-if="!isRegisterMode"
          class="btn btn-link mt-3 h-auto min-h-0 p-0 text-sm font-bold text-[#17c964]"
          type="button"
          :disabled="isResettingPassword"
          @click="resetPassword"
        >
          {{ isResettingPassword ? 'Enviando link...' : 'Esqueci minha senha' }}
        </button>

        <p v-if="successMessage" class="alert alert-success mt-4 rounded-lg text-sm">{{ successMessage }}</p>
        <p v-if="errorMessage" class="alert alert-error mt-4 rounded-lg text-sm">{{ errorMessage }}</p>

        <button class="btn mt-6 w-full border-0 bg-[#f52a55] text-base font-black text-white hover:bg-[#e1264f]" :disabled="!canSubmit || isSubmitting">
          <span v-if="isSubmitting" class="loading loading-spinner loading-sm"></span>
          <span>{{ isSubmitting ? 'Validando' : isRegisterMode ? 'Criar conta segura' : 'Entrar com Firebase' }}</span>
          <ArrowRight :size="18" />
        </button>
      </form>
    </div>
  </section>
</template>
