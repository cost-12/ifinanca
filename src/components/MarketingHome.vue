<script setup lang="ts">
import { computed } from 'vue'
import { languageOptions } from '@/i18n'
import BrandLogo from '@/components/BrandLogo.vue'
import MaterialIcon from '@/components/MaterialIcon.vue'
import type { AppLanguage } from '@/types/finance'

type AccessMode = 'login' | 'register'

const props = defineProps<{
  language: AppLanguage
}>()

const emit = defineEmits<{
  accessRequest: [mode: AccessMode]
  languageChange: [language: AppLanguage]
}>()

const copy = {
  'pt-BR': {
    navResources: 'Recursos',
    navEducation: 'Educacao',
    navSecurity: 'Seguranca',
    navLogin: 'Acessar carteira',
    heroBadge: 'Educacao e gestao financeira em uma unica plataforma',
    heroTitle: 'Assuma o controle total do seu dinheiro',
    heroBody:
      'Organize entradas, acompanhe gastos e conecte suas contas em uma experiencia simples para transformar dados financeiros em decisoes melhores.',
    primaryCta: 'Comecar gratuitamente',
    secondaryCta: 'Entrar',
    metricBanks: 'conexoes bancarias',
    metricFlow: 'visao de fluxo',
    metricAccess: 'acesso seguro',
    resourcesTitle: 'Uma home promocional para evoluir o iFinanca',
    resourcesBody:
      'A pagina inicial apresenta o produto antes do login e direciona o usuario para cadastro, acesso e secoes informativas.',
    resourceOneTitle: 'Organizacao visual',
    resourceOneBody:
      'O usuario entende rapidamente saldo, entradas, saidas e movimentacoes sem depender de planilhas espalhadas.',
    resourceTwoTitle: 'Consciencia de gastos',
    resourceTwoBody:
      'Acompanhamento de transacoes e categorias ajuda a identificar desperdicios e ajustar habitos financeiros.',
    resourceThreeTitle: 'Reservas e metas',
    resourceThreeBody:
      'Metas financeiras, renda mensal e ativos ajudam a planejar reserva de emergencia e objetivos futuros.',
    educationTitle: 'Educacao financeira aplicada ao dia a dia',
    educationBody:
      'O conceito da pagina original foi incorporado como uma camada de apresentacao: primeiro o usuario entende os pilares financeiros, depois acessa o ambiente autenticado.',
    educationOne: 'Controle entradas e saidas com frequencia.',
    educationTwo: 'Use o fluxo mensal para antecipar decisoes.',
    educationThree: 'Conecte contas para reduzir trabalho manual.',
    securityTitle: 'Do convite ao login seguro',
    securityBody:
      'Os botoes da home levam ao fluxo real do Firebase Authentication, mantendo verificacao de e-mail, Google login, App Check e credenciais sensiveis no servidor.',
    securityCta: 'Criar conta segura',
  },
  'en-US': {
    navResources: 'Features',
    navEducation: 'Education',
    navSecurity: 'Security',
    navLogin: 'Open wallet',
    heroBadge: 'Financial education and management in one platform',
    heroTitle: 'Take full control of your money',
    heroBody:
      'Organize income, track spending and connect accounts in a simple experience that turns financial data into better decisions.',
    primaryCta: 'Start for free',
    secondaryCta: 'Sign in',
    metricBanks: 'bank connections',
    metricFlow: 'cash-flow view',
    metricAccess: 'secure access',
    resourcesTitle: 'A promotional home for the next iFinanca step',
    resourcesBody:
      'The initial page presents the product before login and routes users to sign-up, access and informational sections.',
    resourceOneTitle: 'Visual organization',
    resourceOneBody: 'Users quickly understand balance, income, expenses and movements without scattered spreadsheets.',
    resourceTwoTitle: 'Spending awareness',
    resourceTwoBody: 'Transaction and category tracking helps reveal waste and adjust financial habits.',
    resourceThreeTitle: 'Savings and goals',
    resourceThreeBody: 'Financial goals, monthly income and assets help plan emergency reserves and future objectives.',
    educationTitle: 'Financial education for daily decisions',
    educationBody:
      'The original page concept now works as a presentation layer: users first understand the pillars, then enter the authenticated product.',
    educationOne: 'Track income and expenses often.',
    educationTwo: 'Use monthly flow to anticipate decisions.',
    educationThree: 'Connect accounts to reduce manual work.',
    securityTitle: 'From invitation to secure login',
    securityBody:
      'Home buttons lead to the real Firebase Authentication flow, keeping email verification, Google login, App Check and server-side credentials.',
    securityCta: 'Create secure account',
  },
  'es-ES': {
    navResources: 'Recursos',
    navEducation: 'Educacion',
    navSecurity: 'Seguridad',
    navLogin: 'Abrir cartera',
    heroBadge: 'Educacion y gestion financiera en una plataforma',
    heroTitle: 'Toma el control total de tu dinero',
    heroBody:
      'Organiza ingresos, acompana gastos y conecta cuentas en una experiencia simple para convertir datos financieros en mejores decisiones.',
    primaryCta: 'Empezar gratis',
    secondaryCta: 'Entrar',
    metricBanks: 'conexiones bancarias',
    metricFlow: 'vista de flujo',
    metricAccess: 'acceso seguro',
    resourcesTitle: 'Una home promocional para evolucionar iFinanca',
    resourcesBody:
      'La pagina inicial presenta el producto antes del login y dirige al usuario a registro, acceso y secciones informativas.',
    resourceOneTitle: 'Organizacion visual',
    resourceOneBody:
      'El usuario entiende rapidamente saldo, ingresos, salidas y movimientos sin depender de hojas dispersas.',
    resourceTwoTitle: 'Conciencia de gastos',
    resourceTwoBody:
      'El seguimiento de transacciones y categorias ayuda a identificar desperdicios y ajustar habitos financieros.',
    resourceThreeTitle: 'Reservas y metas',
    resourceThreeBody:
      'Metas financieras, ingreso mensual y activos ayudan a planear reservas de emergencia y objetivos futuros.',
    educationTitle: 'Educacion financiera aplicada al dia a dia',
    educationBody:
      'El concepto de la pagina original fue incorporado como capa de presentacion: primero se entienden los pilares y luego se accede al ambiente autenticado.',
    educationOne: 'Controla ingresos y salidas con frecuencia.',
    educationTwo: 'Usa el flujo mensual para anticipar decisiones.',
    educationThree: 'Conecta cuentas para reducir trabajo manual.',
    securityTitle: 'De la invitacion al login seguro',
    securityBody:
      'Los botones de la home llevan al flujo real de Firebase Authentication, manteniendo verificacion de email, Google login, App Check y credenciales en servidor.',
    securityCta: 'Crear cuenta segura',
  },
} satisfies Record<AppLanguage, Record<string, string>>

const text = computed(() => copy[props.language])

function handleLanguageChange(event: Event) {
  emit('languageChange', (event.target as HTMLSelectElement).value as AppLanguage)
}

function openAccess(mode: AccessMode) {
  emit('accessRequest', mode)
}
</script>

<template>
  <section class="min-h-screen bg-[#f7faf8] text-[#172019]">
    <header class="sticky top-0 z-50 border-b border-[#dce7df] bg-white/95 backdrop-blur">
      <div class="mx-auto flex h-16 w-full max-w-370 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a class="inline-flex items-center gap-2 text-xl font-black tracking-normal" href="#inicio" aria-label="iFinanca">
          <BrandLogo class="size-9 shrink-0 rounded-xl shadow-sm" variant="favicon" />
          <span>iFinanca</span>
        </a>

        <nav class="hidden items-center gap-6 text-sm font-bold text-[#54645a] md:flex">
          <a class="transition hover:text-[#0f7b3a]" href="#recursos">{{ text.navResources }}</a>
          <a class="transition hover:text-[#0f7b3a]" href="#educacao">{{ text.navEducation }}</a>
          <a class="transition hover:text-[#0f7b3a]" href="#seguranca">{{ text.navSecurity }}</a>
        </nav>

        <div class="flex items-center gap-2">
          <label class="sr-only" for="home-language">Idioma</label>
          <select
            id="home-language"
            class="select select-sm w-20 border-[#d7e3dc] bg-white text-[#172019]"
            :value="language"
            @change="handleLanguageChange"
          >
            <option v-for="option in languageOptions" :key="option.value" :value="option.value">
              {{ option.shortLabel }}
            </option>
          </select>
          <button
            class="btn btn-sm hidden border-0 bg-[#101318] px-4 font-bold text-white hover:bg-[#1d2430] sm:inline-flex"
            type="button"
            @click="openAccess('login')"
          >
            <MaterialIcon fill name="account_balance_wallet" :size="16" />
            {{ text.navLogin }}
          </button>
        </div>
      </div>
    </header>

    <main>
      <section
        id="inicio"
        class="relative isolate min-h-[74vh] overflow-hidden bg-[#111827] px-4 py-16 text-white sm:px-6 lg:px-8"
      >
        <img
          class="absolute inset-0 -z-20 h-full w-full object-cover"
          src="/marketing/planning-table.jpg"
          alt="Pessoa organizando financas em uma mesa com planilha e caderno"
        />
        <div class="absolute inset-0 -z-10 bg-black/62"></div>
        <div class="mx-auto flex min-h-[calc(74vh-8rem)] max-w-370 items-center">
          <div class="max-w-3xl">
            <div class="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-white/12 px-4 py-2 text-sm font-bold text-white backdrop-blur">
              <MaterialIcon fill name="savings" :size="17" />
              <span class="min-w-0">{{ text.heroBadge }}</span>
            </div>
            <h1 class="max-w-3xl text-3xl font-black leading-[1.04] min-[360px]:text-4xl sm:text-6xl lg:text-7xl">
              {{ text.heroTitle }}
            </h1>
            <p class="mt-6 max-w-2xl text-base leading-7 text-white/82 sm:text-xl sm:leading-8">
              {{ text.heroBody }}
            </p>
            <div class="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                class="btn border-0 bg-[#17c964] px-6 text-base font-black text-[#06130a] hover:bg-[#49dd82]"
                type="button"
                @click="openAccess('register')"
              >
                {{ text.primaryCta }}
                <MaterialIcon name="arrow_forward" :size="19" :weight="700" />
              </button>
              <button
                class="btn border-white/35 bg-white/10 px-6 text-base font-black text-white hover:bg-white/20"
                type="button"
                @click="openAccess('login')"
              >
                <MaterialIcon name="lock_open" :size="18" :weight="700" />
                {{ text.secondaryCta }}
              </button>
            </div>

            <div class="mt-10 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
              <div class="rounded-lg border border-white/18 bg-white/10 p-4 backdrop-blur">
                <p class="text-2xl font-black">4+</p>
                <p class="text-sm font-semibold text-white/72">{{ text.metricBanks }}</p>
              </div>
              <div class="rounded-lg border border-white/18 bg-white/10 p-4 backdrop-blur">
                <p class="text-2xl font-black">360</p>
                <p class="text-sm font-semibold text-white/72">{{ text.metricFlow }}</p>
              </div>
              <div class="rounded-lg border border-white/18 bg-white/10 p-4 backdrop-blur">
                <p class="text-2xl font-black">24h</p>
                <p class="text-sm font-semibold text-white/72">{{ text.metricAccess }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" class="border-b border-[#dce7df] bg-white px-4 py-14 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-370">
          <div class="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
            <div>
              <p class="text-sm font-black uppercase tracking-wide text-[#0f8f45]">{{ text.navResources }}</p>
              <h2 class="mt-2 max-w-xl text-3xl font-black leading-tight text-[#172019] sm:text-4xl">
                {{ text.resourcesTitle }}
              </h2>
            </div>
            <p class="max-w-2xl text-base leading-7 text-[#66766b] lg:justify-self-end">
              {{ text.resourcesBody }}
            </p>
          </div>

          <div class="mt-9 grid gap-5 md:grid-cols-3">
            <article class="overflow-hidden rounded-lg border border-[#dce7df] bg-[#fbfdfb]">
              <img
                class="h-48 w-full object-cover"
                src="/marketing/budget-organization.jpg"
                alt="Mesa com calculadora, dinheiro e planejamento financeiro"
              />
              <div class="p-5">
                <MaterialIcon class="mb-4 text-[#3498db]" fill name="monitoring" :size="28" />
                <h3 class="text-xl font-black">{{ text.resourceOneTitle }}</h3>
                <p class="mt-3 leading-7 text-[#66766b]">{{ text.resourceOneBody }}</p>
              </div>
            </article>

            <article class="overflow-hidden rounded-lg border border-[#dce7df] bg-[#fbfdfb]">
              <img class="h-48 w-full object-cover" src="/marketing/financial-plan.jpg" alt="Blocos formando a palavra plano com moedas" />
              <div class="p-5">
                <MaterialIcon class="mb-4 text-[#0f8f45]" fill name="menu_book" :size="28" />
                <h3 class="text-xl font-black">{{ text.resourceTwoTitle }}</h3>
                <p class="mt-3 leading-7 text-[#66766b]">{{ text.resourceTwoBody }}</p>
              </div>
            </article>

            <article class="overflow-hidden rounded-lg border border-[#dce7df] bg-[#fbfdfb]">
              <img class="h-48 w-full object-cover" src="/marketing/clean-desk.jpg" alt="Mesa limpa com calculadora, teclado e caderno" />
              <div class="p-5">
                <MaterialIcon class="mb-4 text-[#f52a55]" fill name="target" :size="28" />
                <h3 class="text-xl font-black">{{ text.resourceThreeTitle }}</h3>
                <p class="mt-3 leading-7 text-[#66766b]">{{ text.resourceThreeBody }}</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="educacao" class="bg-[#edf5f0] px-4 py-14 sm:px-6 lg:px-8">
        <div class="mx-auto grid max-w-370 gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <p class="text-sm font-black uppercase tracking-wide text-[#0f8f45]">{{ text.navEducation }}</p>
            <h2 class="mt-2 max-w-2xl text-3xl font-black leading-tight sm:text-4xl">{{ text.educationTitle }}</h2>
            <p class="mt-5 max-w-2xl text-base leading-7 text-[#66766b]">{{ text.educationBody }}</p>
          </div>
          <div class="grid gap-3">
            <div class="flex items-start gap-3 rounded-lg border border-[#d1e4d8] bg-white p-4">
              <MaterialIcon class="mt-1 shrink-0 text-[#0f8f45]" fill name="check_circle" :size="21" />
              <p class="font-bold text-[#243029]">{{ text.educationOne }}</p>
            </div>
            <div class="flex items-start gap-3 rounded-lg border border-[#d1e4d8] bg-white p-4">
              <MaterialIcon class="mt-1 shrink-0 text-[#0f8f45]" fill name="check_circle" :size="21" />
              <p class="font-bold text-[#243029]">{{ text.educationTwo }}</p>
            </div>
            <div class="flex items-start gap-3 rounded-lg border border-[#d1e4d8] bg-white p-4">
              <MaterialIcon class="mt-1 shrink-0 text-[#0f8f45]" fill name="check_circle" :size="21" />
              <p class="font-bold text-[#243029]">{{ text.educationThree }}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="seguranca" class="bg-[#101318] px-4 py-14 text-white sm:px-6 lg:px-8">
        <div class="mx-auto grid max-w-370 gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <div class="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-bold text-[#76eaa2]">
              <MaterialIcon fill name="verified_user" :size="17" />
              {{ text.navSecurity }}
            </div>
            <h2 class="max-w-2xl text-3xl font-black leading-tight sm:text-4xl">{{ text.securityTitle }}</h2>
            <p class="mt-5 max-w-2xl text-base leading-7 text-zinc-400">{{ text.securityBody }}</p>
            <button
              class="btn mt-7 border-0 bg-[#17c964] px-6 font-black text-[#06130a] hover:bg-[#49dd82]"
              type="button"
              @click="openAccess('register')"
            >
              {{ text.securityCta }}
              <MaterialIcon name="arrow_forward" :size="18" :weight="700" />
            </button>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="rounded-lg border border-white/10 bg-white/6 p-5">
              <MaterialIcon class="mb-4 text-[#76eaa2]" fill name="lock" :size="28" />
              <p class="text-lg font-black">Firebase Auth</p>
              <p class="mt-2 text-sm leading-6 text-zinc-400">E-mail, Google e verificacao de conta antes do dashboard.</p>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/6 p-5">
              <MaterialIcon class="mb-4 text-[#7dcfff]" fill name="account_balance" :size="28" />
              <p class="text-lg font-black">Pluggy Connect</p>
              <p class="mt-2 text-sm leading-6 text-zinc-400">Token emitido por funcao serverless e credenciais fora do navegador.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  </section>
</template>
