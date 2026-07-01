<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArrowRight,
  Bell,
  Camera,
  ChartNoAxesColumnIncreasing,
  CheckCheck,
  CircleDollarSign,
  CreditCard,
  Eye,
  Home,
  Landmark,
  Link2,
  LogOut,
  Menu,
  Moon,
  PiggyBank,
  Plus,
  ReceiptText,
  ShieldCheck,
  Sun,
  TrendingUp,
  Trash2,
  Wallet,
  X,
} from '@lucide/vue'
import {
  assets,
  bankConnections,
  financeAccounts,
  formatCurrency,
  formatPercent,
  monthlyFlow,
  transactions,
} from '@/data/finance'
import { openPluggyConnect } from '@/services/pluggy'
import type { AppTheme, BankConnection, UserProfile } from '@/types/finance'

const props = defineProps<{
  profile: UserProfile
  theme: AppTheme
}>()

const emit = defineEmits<{
  logout: []
  profileUpdated: [profile: UserProfile]
  themeChange: [theme: AppTheme]
}>()

type TabId = 'overview' | 'fluxo' | 'ativos' | 'conexoes'
type NotificationTone = 'success' | 'warning' | 'info'

interface NotificationItem {
  id: string
  title: string
  description: string
  time: string
  tone: NotificationTone
  actionLabel: string
  actionTab: TabId
}

const NOTIFICATION_STORAGE_PREFIX = 'ifinanca.notifications.read'
const MAX_AVATAR_BYTES = 3 * 1024 * 1024

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'fluxo', label: 'Fluxo' },
  { id: 'ativos', label: 'Ativos' },
  { id: 'conexoes', label: 'Conexoes' },
]

const activeTab = ref<TabId>('overview')
const menuOpen = ref(false)
const notificationsOpen = ref(false)
const profileMenuOpen = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)
const avatarMessage = ref('')
const avatarError = ref('')
const isConnecting = ref(false)
const connectMessage = ref('')
const connectedItemId = ref('')
const readNotificationIds = ref<string[]>(readStoredNotificationIds(props.profile.id))

const firstName = computed(() => props.profile.name.trim().split(' ')[0] || 'Usuario')
const activeTabLabel = computed(() => tabs.find((tab) => tab.id === activeTab.value)?.label ?? 'Overview')
const totalBalance = computed(() => bankConnections.reduce((total, bank) => total + bank.balance, 0))
const incomeTotal = computed(() => transactions.filter((item) => item.amount > 0).reduce((total, item) => total + item.amount, 0))
const outcomeTotal = computed(() => Math.abs(transactions.filter((item) => item.amount < 0).reduce((total, item) => total + item.amount, 0)))
const assetTotal = computed(() => assets.reduce((total, asset) => total + asset.amount, 0))
const notifications = computed<NotificationItem[]>(() => {
  const bankAlerts = bankConnections
    .filter((bank) => bank.newTransactions > 0 || bank.status === 'Pendente')
    .map((bank) => ({
      id: `bank-${bank.id}-${bank.newTransactions || bank.status}`,
      title: bank.status === 'Pendente' ? `${bank.shortName} precisa sincronizar` : 'Novos lancamentos importados',
      description:
        bank.status === 'Pendente'
          ? `Revise a conexao do ${bank.name} para concluir a importacao.`
          : `${bank.name} tem ${bank.newTransactions.toLocaleString('pt-BR')} lancamentos disponiveis.`,
      time: bank.status === 'Pendente' ? 'Agora' : 'Ha 12 min',
      tone: (bank.status === 'Pendente' ? 'warning' : 'success') as NotificationTone,
      actionLabel: 'Ver conexao',
      actionTab: 'conexoes' as TabId,
    }))

  const plannedTransactions = transactions
    .filter((transaction) => transaction.status === 'Previsto')
    .map((transaction) => ({
      id: `transaction-${transaction.id}`,
      title: 'Lancamento previsto',
      description: `${transaction.title} em ${transaction.bank}: ${formatCurrency(transaction.amount)}.`,
      time: transaction.date,
      tone: 'info' as NotificationTone,
      actionLabel: 'Ver fluxo',
      actionTab: 'fluxo' as TabId,
    }))

  return [...bankAlerts, ...plannedTransactions]
})
const unreadNotificationCount = computed(
  () => notifications.value.filter((notification) => !readNotificationIds.value.includes(notification.id)).length,
)

function tabButtonClass(tab: TabId) {
  return [
    'btn btn-sm border-0 px-4 font-bold',
    activeTab.value === tab ? 'bg-white text-[#08090d]' : 'bg-transparent text-zinc-400 hover:bg-white/10 hover:text-white',
  ]
}

function readStoredNotificationIds(profileId: string) {
  if (typeof window === 'undefined') {
    return []
  }

  const stored = window.localStorage.getItem(`${NOTIFICATION_STORAGE_PREFIX}.${profileId}`)

  try {
    return stored ? (JSON.parse(stored) as string[]) : []
  } catch {
    return []
  }
}

function persistReadNotificationIds(nextIds: string[]) {
  readNotificationIds.value = nextIds

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(`${NOTIFICATION_STORAGE_PREFIX}.${props.profile.id}`, JSON.stringify(nextIds))
  }
}

function isNotificationRead(notificationId: string) {
  return readNotificationIds.value.includes(notificationId)
}

function markNotificationRead(notificationId: string) {
  if (isNotificationRead(notificationId)) {
    return
  }

  persistReadNotificationIds([...readNotificationIds.value, notificationId])
}

function markAllNotificationsRead() {
  persistReadNotificationIds(notifications.value.map((notification) => notification.id))
}

function openNotificationAction(notification: NotificationItem) {
  markNotificationRead(notification.id)
  activeTab.value = notification.actionTab
  notificationsOpen.value = false
}

function notificationToneClass(tone: NotificationTone) {
  return {
    success: 'bg-[#17c964]',
    warning: 'bg-[#f59e0b]',
    info: 'bg-[#3b82f6]',
  }[tone]
}

function toggleNotifications() {
  notificationsOpen.value = !notificationsOpen.value
  profileMenuOpen.value = false
}

function toggleProfileMenu() {
  profileMenuOpen.value = !profileMenuOpen.value
  notificationsOpen.value = false
  avatarError.value = ''
  avatarMessage.value = ''
}

function setTheme(nextTheme: AppTheme) {
  emit('themeChange', nextTheme)
}

function openAvatarPicker() {
  avatarInput.value?.click()
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Nao foi possivel ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Nao foi possivel carregar a imagem.'))
    image.src = source
  })
}

async function createAvatarDataUrl(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem.')
  }

  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('Use uma imagem de ate 3 MB.')
  }

  const source = await readFileAsDataUrl(file)
  const image = await loadImage(source)
  const canvas = document.createElement('canvas')
  const size = Math.min(image.width, image.height)
  const offsetX = Math.max((image.width - size) / 2, 0)
  const offsetY = Math.max((image.height - size) / 2, 0)
  const targetSize = 256
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Nao foi possivel preparar a imagem.')
  }

  canvas.width = targetSize
  canvas.height = targetSize
  context.drawImage(image, offsetX, offsetY, size, size, 0, 0, targetSize, targetSize)

  return canvas.toDataURL('image/jpeg', 0.86)
}

async function handleAvatarSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  avatarError.value = ''
  avatarMessage.value = ''

  try {
    const avatarUrl = await createAvatarDataUrl(file)
    emit('profileUpdated', { ...props.profile, avatarUrl })
    avatarMessage.value = 'Foto atualizada.'
    profileMenuOpen.value = false
  } catch (error) {
    avatarError.value = error instanceof Error ? error.message : 'Nao foi possivel alterar a foto.'
  } finally {
    input.value = ''
  }
}

function removeAvatar() {
  const nextProfile: UserProfile = { ...props.profile }
  delete nextProfile.avatarUrl
  emit('profileUpdated', nextProfile)
  avatarMessage.value = 'Foto removida.'
  avatarError.value = ''
}

async function connectAccount() {
  if (isConnecting.value) {
    return
  }

  isConnecting.value = true
  connectMessage.value = ''

  const result = await openPluggyConnect({
    clientUserId: props.profile.id,
    userEmail: props.profile.email,
    onEvent: (payload) => {
      connectMessage.value = `Evento Pluggy: ${payload.event}`
    },
  })

  connectedItemId.value = result.itemId
  connectMessage.value = result.message
  isConnecting.value = false
}

function newLaunchLabel(bank: BankConnection) {
  if (!bank.newTransactions) {
    return bank.status
  }

  return `${bank.newTransactions.toLocaleString('pt-BR')} novos lancamentos`
}
</script>

<template>
  <section class="dashboard-shell min-h-screen" :data-mode="theme">
    <header class="dashboard-header sticky top-0 z-40 border-b backdrop-blur">
      <div class="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-3">
          <span class="brand-mark flex size-10 items-center justify-center rounded-lg text-lg font-black">
            iF
          </span>
          <span class="text-xl font-black">iFinanca</span>
        </div>

        <nav class="hidden items-center gap-2 md:flex">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="tabButtonClass(tab.id)"
            type="button"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </nav>

        <div class="flex items-center gap-2">
          <button
            :class="['tooltip tooltip-bottom btn btn-ghost btn-square btn-sm', theme === 'light' ? 'text-[#17c964]' : 'text-zinc-400']"
            data-tip="Tema claro"
            type="button"
            @click="setTheme('light')"
          >
            <Sun :size="18" />
          </button>
          <button
            :class="['tooltip tooltip-bottom btn btn-ghost btn-square btn-sm', theme === 'dark' ? 'text-[#17c964]' : 'text-zinc-400']"
            data-tip="Tema escuro"
            type="button"
            @click="setTheme('dark')"
          >
            <Moon :size="18" />
          </button>

          <div class="relative">
            <button
              class="tooltip tooltip-bottom btn btn-ghost btn-square btn-sm text-zinc-400"
              data-tip="Notificacoes"
              type="button"
              @click="toggleNotifications"
            >
              <Bell :size="18" />
              <span
                v-if="unreadNotificationCount"
                class="keep-white absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-[#f52a55] text-[10px] font-black text-white"
              >
                {{ unreadNotificationCount }}
              </span>
            </button>

            <div
              v-if="notificationsOpen"
              class="dashboard-popover absolute right-0 top-11 z-50 w-[min(92vw,380px)] rounded-lg border p-3 shadow-2xl"
            >
              <div class="flex items-center justify-between gap-3 px-1 pb-2">
                <div>
                  <p class="text-sm font-black">Notificacoes</p>
                  <p class="text-xs text-zinc-500">{{ unreadNotificationCount }} pendentes</p>
                </div>
                <button class="btn btn-ghost btn-square btn-xs text-zinc-400" type="button" @click="markAllNotificationsRead">
                  <CheckCheck :size="16" />
                </button>
              </div>

              <div class="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                <button
                  v-for="notification in notifications"
                  :key="notification.id"
                  class="dashboard-notification w-full rounded-lg p-3 text-left"
                  type="button"
                  @click="openNotificationAction(notification)"
                >
                  <div class="flex gap-3">
                    <span class="mt-1 size-2.5 rounded-full" :class="notificationToneClass(notification.tone)"></span>
                    <span class="min-w-0 flex-1">
                      <span class="flex items-start justify-between gap-3">
                        <span class="font-black">{{ notification.title }}</span>
                        <span class="shrink-0 text-xs text-zinc-500">{{ notification.time }}</span>
                      </span>
                      <span class="mt-1 block text-sm leading-5 text-zinc-400">{{ notification.description }}</span>
                      <span class="mt-2 block text-xs font-black text-[#17c964]">{{ notification.actionLabel }}</span>
                    </span>
                    <span v-if="!isNotificationRead(notification.id)" class="mt-1 size-2 rounded-full bg-[#f52a55]"></span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div class="relative">
            <button
              class="avatar-button avatar placeholder"
              type="button"
              aria-label="Abrir menu do perfil"
              @click="toggleProfileMenu"
            >
              <div class="w-9 overflow-hidden rounded-full bg-[#17c964] text-sm font-black text-[#06130a]">
                <img v-if="profile.avatarUrl" class="h-full w-full object-cover" :src="profile.avatarUrl" alt="" />
                <span v-else>{{ firstName.slice(0, 1).toUpperCase() }}</span>
              </div>
            </button>

            <input ref="avatarInput" class="hidden" accept="image/*" type="file" @change="handleAvatarSelected" />

            <div
              v-if="profileMenuOpen"
              class="dashboard-popover absolute right-0 top-11 z-50 w-[min(92vw,300px)] rounded-lg border p-4 shadow-2xl"
            >
              <div class="flex items-center gap-3">
                <div class="grid size-12 overflow-hidden rounded-full bg-[#17c964] text-base font-black text-[#06130a]">
                  <img v-if="profile.avatarUrl" class="h-full w-full object-cover" :src="profile.avatarUrl" alt="" />
                  <span v-else class="grid place-items-center">{{ firstName.slice(0, 1).toUpperCase() }}</span>
                </div>
                <div class="min-w-0">
                  <p class="truncate font-black">{{ profile.name }}</p>
                  <p class="truncate text-sm text-zinc-500">{{ profile.email }}</p>
                </div>
              </div>

              <div class="mt-4 grid gap-2">
                <button class="btn btn-sm justify-start border-0 bg-[#17c964] text-[#06130a] hover:bg-[#13b45a]" type="button" @click="openAvatarPicker">
                  <Camera :size="16" />
                  Alterar foto
                </button>
                <button class="btn btn-sm justify-start border-white/10 bg-transparent text-zinc-300 hover:bg-white/10" type="button" @click="removeAvatar">
                  <Trash2 :size="16" />
                  Remover foto
                </button>
              </div>

              <p v-if="avatarMessage" class="mt-3 text-sm font-semibold text-[#17c964]">{{ avatarMessage }}</p>
              <p v-if="avatarError" class="mt-3 text-sm font-semibold text-[#ff6b7f]">{{ avatarError }}</p>
            </div>
          </div>
          <button class="tooltip tooltip-bottom btn btn-ghost btn-square btn-sm text-zinc-400" data-tip="Sair" type="button" @click="emit('logout')">
            <LogOut :size="18" />
          </button>
          <button class="btn btn-ghost btn-square btn-sm text-zinc-400 md:hidden" type="button" @click="menuOpen = !menuOpen">
            <X v-if="menuOpen" :size="20" />
            <Menu v-else :size="20" />
          </button>
        </div>
      </div>

      <nav v-if="menuOpen" class="grid gap-2 border-t border-white/10 px-4 py-3 md:hidden">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="tabButtonClass(tab.id)"
          type="button"
          @click="activeTab = tab.id; menuOpen = false"
        >
          {{ tab.label }}
        </button>
      </nav>
    </header>

    <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="grid gap-8 xl:grid-cols-[250px_1fr]">
        <aside class="hidden xl:block">
          <div class="sticky top-24 space-y-3">
            <button class="keep-white btn w-full justify-start border-0 bg-[#f52a55] text-white hover:bg-[#e1264f]" type="button" @click="connectAccount">
              <Link2 :size="18" />
              Conectar conta
            </button>
            <div class="rounded-lg border border-white/10 bg-[#101318] p-4">
              <p class="text-sm font-bold text-zinc-400">Sincronizacao</p>
              <p class="mt-2 text-2xl font-black text-white">4 bancos</p>
              <p class="mt-1 text-sm text-zinc-500">Futuros lancamentos importados a cada 6 horas.</p>
            </div>
            <div class="rounded-lg border border-white/10 bg-[#101318] p-4">
              <p class="text-sm font-bold text-zinc-400">Item Pluggy</p>
              <p class="mt-2 break-all text-sm text-[#76eaa2]">{{ connectedItemId || 'Aguardando conexao' }}</p>
            </div>
          </div>
        </aside>

        <div class="min-w-0">
          <div class="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="text-sm font-bold uppercase text-[#17c964]">{{ activeTab }}</p>
              <h1 class="mt-2 text-4xl font-black text-white sm:text-5xl">{{ activeTabLabel }}</h1>
              <p class="mt-3 max-w-2xl text-zinc-400">
                Bom dia, {{ firstName }}. Seus dados financeiros ficam em um so lugar, com conexoes bancarias, fluxo e patrimonio.
              </p>
            </div>

            <button class="keep-white btn border-0 bg-[#f52a55] text-white hover:bg-[#e1264f] xl:hidden" :disabled="isConnecting" type="button" @click="connectAccount">
              <span v-if="isConnecting" class="loading loading-spinner loading-sm"></span>
              <Link2 v-else :size="18" />
              Conectar conta
            </button>
          </div>

          <div v-if="connectMessage" class="alert mb-6 rounded-lg border border-[#273529] bg-[#102118] text-[#96f0b7]">
            <ShieldCheck :size="19" />
            <span>{{ connectMessage }}</span>
          </div>

          <div v-if="activeTab === 'overview'" class="space-y-6">
            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div class="rounded-lg border border-white/10 bg-[#101318] p-5">
                <div class="flex items-center justify-between text-zinc-400">
                  <span class="text-sm font-bold">Saldo geral</span>
                  <Eye :size="18" />
                </div>
                <p class="mt-4 text-3xl font-black">{{ formatCurrency(totalBalance) }}</p>
                <p class="mt-2 text-sm font-semibold text-[#76eaa2]">+8,4% no mes</p>
              </div>

              <div class="rounded-lg border border-white/10 bg-[#101318] p-5">
                <div class="flex items-center justify-between text-zinc-400">
                  <span class="text-sm font-bold">Entradas</span>
                  <CircleDollarSign :size="18" />
                </div>
                <p class="mt-4 text-3xl font-black">{{ formatCurrency(incomeTotal) }}</p>
                <p class="mt-2 text-sm font-semibold text-[#76eaa2]">Confirmadas</p>
              </div>

              <div class="rounded-lg border border-white/10 bg-[#101318] p-5">
                <div class="flex items-center justify-between text-zinc-400">
                  <span class="text-sm font-bold">Saidas</span>
                  <CreditCard :size="18" />
                </div>
                <p class="mt-4 text-3xl font-black">{{ formatCurrency(outcomeTotal) }}</p>
                <p class="mt-2 text-sm font-semibold text-[#ff6b7f]">Previstas e pagas</p>
              </div>

              <div class="rounded-lg border border-white/10 bg-[#101318] p-5">
                <div class="flex items-center justify-between text-zinc-400">
                  <span class="text-sm font-bold">Patrimonio</span>
                  <PiggyBank :size="18" />
                </div>
                <p class="mt-4 text-3xl font-black">{{ formatCurrency(assetTotal) }}</p>
                <p class="mt-2 text-sm font-semibold text-[#7db4ff]">Ativos conectados</p>
              </div>
            </section>

            <section class="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <div class="rounded-lg border border-white/10 bg-[#101318] p-5">
                <div class="mb-5 flex items-center justify-between">
                  <div>
                    <p class="text-sm font-bold text-zinc-400">Fluxo mensal</p>
                    <h2 class="mt-1 text-2xl font-black">Receitas e gastos</h2>
                  </div>
                  <ChartNoAxesColumnIncreasing class="text-[#f52a55]" :size="24" />
                </div>

                <div class="grid h-64 grid-cols-6 items-end gap-4">
                  <div v-for="month in monthlyFlow" :key="month.label" class="flex h-full flex-col justify-end gap-2">
                    <div class="flex flex-1 items-end gap-1">
                      <span class="block w-full rounded-t bg-[#17c964]" :style="{ height: `${month.income * 5}%` }"></span>
                      <span class="block w-full rounded-t bg-[#f52a55]" :style="{ height: `${month.outcome * 5}%` }"></span>
                    </div>
                    <span class="text-center text-xs font-bold text-zinc-500">{{ month.label }}</span>
                  </div>
                </div>
              </div>

              <div class="rounded-lg border border-white/10 bg-[#101318] p-5">
                <div class="mb-5 flex items-center justify-between">
                  <div>
                    <p class="text-sm font-bold text-zinc-400">Minhas contas</p>
                    <h2 class="mt-1 text-2xl font-black">Conectadas</h2>
                  </div>
                  <button class="btn btn-square btn-sm border-0 bg-white/10 text-white hover:bg-white/20" type="button" @click="activeTab = 'conexoes'">
                    <ArrowRight :size="17" />
                  </button>
                </div>

                <div class="space-y-3">
                  <div v-for="account in financeAccounts" :key="account.id" class="flex items-center justify-between rounded-lg bg-[#0b0d12] p-4">
                    <div class="min-w-0">
                      <p class="truncate font-black">{{ account.name }}</p>
                      <p class="text-sm text-zinc-500">{{ account.type }}</p>
                    </div>
                    <div class="text-right">
                      <p :class="account.amount >= 0 ? 'text-[#7db4ff]' : 'text-[#ff6b7f]'" class="font-black">
                        {{ formatCurrency(account.amount) }}
                      </p>
                      <p :class="account.variation >= 0 ? 'text-[#76eaa2]' : 'text-[#ff6b7f]'" class="text-xs font-bold">
                        {{ formatPercent(account.variation) }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section class="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
              <div class="rounded-lg border border-white/10 bg-[#101318] p-5">
                <p class="text-sm font-bold text-zinc-400">Distribuicao</p>
                <h2 class="mt-1 text-2xl font-black">Ativos</h2>
                <div class="mt-5 space-y-4">
                  <div v-for="asset in assets" :key="asset.id">
                    <div class="mb-2 flex items-center justify-between text-sm">
                      <span class="font-bold text-zinc-300">{{ asset.name }}</span>
                      <span class="font-black">{{ asset.allocation }}%</span>
                    </div>
                    <progress class="progress h-3 bg-[#0b0d12]" :style="{ color: asset.tone }" :value="asset.allocation" max="100"></progress>
                  </div>
                </div>
              </div>

              <div class="rounded-lg border border-white/10 bg-[#101318] p-5">
                <div class="mb-5 flex items-center justify-between">
                  <div>
                    <p class="text-sm font-bold text-zinc-400">Lancamentos</p>
                    <h2 class="mt-1 text-2xl font-black">Recentes</h2>
                  </div>
                  <ReceiptText class="text-[#17c964]" :size="24" />
                </div>

                <div class="overflow-x-auto">
                  <table class="table">
                    <thead>
                      <tr class="border-white/10 text-zinc-500">
                        <th>Descricao</th>
                        <th>Banco</th>
                        <th>Status</th>
                        <th class="text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="transaction in transactions" :key="transaction.id" class="border-white/10">
                        <td>
                          <p class="font-black text-white">{{ transaction.title }}</p>
                          <p class="text-sm text-zinc-500">{{ transaction.category }} - {{ transaction.date }}</p>
                        </td>
                        <td class="text-zinc-300">{{ transaction.bank }}</td>
                        <td>
                          <span class="badge border-white/10 bg-white/5 text-zinc-300">{{ transaction.status }}</span>
                        </td>
                        <td :class="transaction.amount >= 0 ? 'text-[#76eaa2]' : 'text-[#ff6b7f]'" class="text-right font-black">
                          {{ formatCurrency(transaction.amount) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>

          <div v-else-if="activeTab === 'conexoes'" class="grid gap-4 md:grid-cols-2">
            <article v-for="bank in bankConnections" :key="bank.id" class="rounded-lg border border-white/10 bg-[#101318] p-5">
              <div class="flex items-center justify-between gap-4">
                <div class="flex min-w-0 items-center gap-4">
                  <span class="keep-white grid size-12 shrink-0 place-items-center rounded-full text-sm font-black text-white" :style="{ background: bank.color }">
                    {{ bank.logoText }}
                  </span>
                  <div class="min-w-0">
                    <h2 class="truncate text-xl font-black">{{ bank.name }}</h2>
                    <p class="text-sm text-zinc-500">{{ bank.mask }}</p>
                    <p :class="bank.newTransactions ? 'text-[#7db4ff]' : 'text-zinc-500'" class="mt-2 text-sm font-black">
                      {{ newLaunchLabel(bank) }}
                    </p>
                  </div>
                </div>
                <button class="btn btn-square btn-ghost text-[#17c964]" type="button">
                  <ArrowRight :size="22" />
                </button>
              </div>
            </article>
          </div>

          <div v-else-if="activeTab === 'ativos'" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article v-for="asset in assets" :key="asset.id" class="rounded-lg border border-white/10 bg-[#101318] p-5">
              <Wallet class="mb-8" :style="{ color: asset.tone }" :size="28" />
              <p class="text-sm font-bold text-zinc-400">{{ asset.allocation }}% alocado</p>
              <h2 class="mt-2 text-2xl font-black">{{ asset.name }}</h2>
              <p class="mt-4 text-3xl font-black">{{ formatCurrency(asset.amount) }}</p>
              <p :class="asset.variation >= 0 ? 'text-[#76eaa2]' : 'text-[#ff6b7f]'" class="mt-2 text-sm font-black">
                {{ formatPercent(asset.variation) }}
              </p>
            </article>
          </div>

          <div v-else class="rounded-lg border border-white/10 bg-[#101318] p-5">
            <div class="mb-5 flex items-center justify-between">
              <div>
                <p class="text-sm font-bold text-zinc-400">Fluxo previsto</p>
                <h2 class="mt-1 text-2xl font-black">Proximos lancamentos</h2>
              </div>
              <Plus class="text-[#17c964]" :size="24" />
            </div>

            <div class="grid gap-3">
              <div v-for="transaction in transactions" :key="transaction.id" class="flex items-center justify-between rounded-lg bg-[#0b0d12] p-4">
                <div>
                  <p class="font-black">{{ transaction.title }}</p>
                  <p class="text-sm text-zinc-500">{{ transaction.category }} - {{ transaction.date }}</p>
                </div>
                <p :class="transaction.amount >= 0 ? 'text-[#76eaa2]' : 'text-[#ff6b7f]'" class="font-black">
                  {{ formatCurrency(transaction.amount) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="dock border-t border-white/10 bg-[#07080d] text-zinc-400 md:hidden">
      <button :class="{ 'text-[#17c964]': activeTab === 'overview' }" type="button" @click="activeTab = 'overview'">
        <Home :size="22" />
      </button>
      <button :class="{ 'text-[#17c964]': activeTab === 'fluxo' }" type="button" @click="activeTab = 'fluxo'">
        <ReceiptText :size="22" />
      </button>
      <button class="bg-[#17c964] text-[#06130a]" type="button" @click="connectAccount">
        <Plus :size="24" />
      </button>
      <button :class="{ 'text-[#17c964]': activeTab === 'ativos' }" type="button" @click="activeTab = 'ativos'">
        <TrendingUp :size="22" />
      </button>
      <button :class="{ 'text-[#17c964]': activeTab === 'conexoes' }" type="button" @click="activeTab = 'conexoes'">
        <Landmark :size="22" />
      </button>
    </div>
  </section>
</template>
