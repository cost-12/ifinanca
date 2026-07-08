<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  ArrowRight,
  Bell,
  Camera,
  ChartNoAxesColumnIncreasing,
  CheckCheck,
  CircleDollarSign,
  CreditCard,
  Eye,
  EyeOff,
  Home,
  Landmark,
  Link2,
  LogOut,
  Menu,
  Moon,
  PiggyBank,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Sun,
  TrendingUp,
  Trash2,
  Wallet,
  X,
} from '@lucide/vue'
import {
  assets,
  bankConnections as mockBankConnections,
  financeAccounts,
  monthlyFlow,
  transactions as mockTransactions,
} from '@/data/finance'
import { formatMoney, formatSignedPercent, translate } from '@/i18n'
import BrandLogo from '@/components/BrandLogo.vue'
import LanguageFlagSelect from '@/components/LanguageFlagSelect.vue'
import MaterialIcon from '@/components/MaterialIcon.vue'
import { loadTransactionsForUser, updateTransactionStatusInDataConnect } from '@/services/dataconnect'
import { fetchPluggyItemData, isPluggySandboxEnabled, openPluggyConnect } from '@/services/pluggy'
import type { PluggyAccount, PluggyTransaction } from '@/services/pluggy'
import type { AppLanguage, AppTheme, BankConnection, DataSource, Transaction, UserProfile } from '@/types/finance'

const props = defineProps<{
  profile: UserProfile
  theme: AppTheme
  language: AppLanguage
}>()

const emit = defineEmits<{
  logout: []
  profileUpdated: [profile: UserProfile]
  themeChange: [theme: AppTheme]
  languageChange: [language: AppLanguage]
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
const BALANCE_VISIBILITY_STORAGE_PREFIX = 'ifinanca.balance.visible'
const MAX_AVATAR_BYTES = 3 * 1024 * 1024

const activeTab = ref<TabId>('overview')
const menuOpen = ref(false)
const notificationsOpen = ref(false)
const profileMenuOpen = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)
const avatarMessage = ref('')
const avatarError = ref('')
const isConnecting = ref(false)
const connectMessage = ref('')
const connectError = ref('')
const connectedItemId = ref('')
const readNotificationIds = ref<string[]>(readStoredNotificationIds(props.profile.id))
const isBalanceVisible = ref(readStoredBalanceVisibility(props.profile.id))
const dashboardTransactions = ref<Transaction[]>([...mockTransactions])
const dashboardBankConnections = ref<BankConnection[]>([...mockBankConnections])
const transactionsSource = ref<DataSource>('mock')
const isLoadingTransactions = ref(false)
const isLoadingPluggyData = ref(false)
const pluggyDataLoadedAt = ref('')
const pluggyPartialErrors = ref<Array<{ accountId: string; message: string }>>([])
const isUpdatingTransactionStatus = ref<string | null>(null)
const transactionUpdateFeedback = ref<{ id: string; type: 'success' | 'error'; message: string } | null>(null)
const pluggySandboxEnabled = isPluggySandboxEnabled()

function tr(key: Parameters<typeof translate>[1], variables?: Parameters<typeof translate>[2]) {
  return translate(props.language, key, variables)
}

const tabs = computed<{ id: TabId; label: string }[]>(() => [
  { id: 'overview', label: tr('nav.overview') },
  { id: 'fluxo', label: tr('nav.flow') },
  { id: 'ativos', label: tr('nav.assets') },
  { id: 'conexoes', label: tr('nav.connections') },
])

const firstName = computed(() => props.profile.name.trim().split(' ')[0] || 'Usuario')
const activeTabLabel = computed(() => tabs.value.find((tab) => tab.id === activeTab.value)?.label ?? tr('nav.overview'))
const totalBalance = computed(() => dashboardBankConnections.value.reduce((total, bank) => total + bank.balance, 0))
const incomeTotal = computed(() => dashboardTransactions.value.filter((item) => item.amount > 0).reduce((total, item) => total + item.amount, 0))
const outcomeTotal = computed(() => Math.abs(dashboardTransactions.value.filter((item) => item.amount < 0).reduce((total, item) => total + item.amount, 0)))
const assetTotal = computed(() => assets.reduce((total, asset) => total + asset.amount, 0))
const overviewAccounts = computed(() => {
  if (transactionsSource.value !== 'pluggy') {
    return financeAccounts.map((account) => ({ ...account, variationLabel: formatSignedPercent(account.variation, props.language) }))
  }

  return dashboardBankConnections.value.map((bank) => ({
    id: bank.id,
    bankId: bank.id,
    name: bank.name,
    type: bank.mask,
    amount: bank.balance,
    variation: 0,
    variationLabel: bankStatusLabel(bank.status),
  }))
})
// As notificacoes sao derivadas dos dados atuais, sem estado duplicado manual.
const notifications = computed<NotificationItem[]>(() => {
  const bankAlerts = dashboardBankConnections.value
    .filter((bank) => bank.newTransactions > 0 || bank.status === 'Pendente')
    .map((bank) => ({
      id: `bank-${bank.id}-${bank.newTransactions || bank.status}`,
      title: bank.status === 'Pendente' ? tr('notifications.bankSync', { bank: bank.shortName }) : tr('notifications.newTransactions'),
      description:
        bank.status === 'Pendente'
          ? tr('notifications.reviewConnection', { bank: bank.name })
          : tr('notifications.availableTransactions', { bank: bank.name, count: bank.newTransactions.toLocaleString(props.language) }),
      time: bank.status === 'Pendente' ? tr('notifications.now') : tr('notifications.minutesAgo'),
      tone: (bank.status === 'Pendente' ? 'warning' : 'success') as NotificationTone,
      actionLabel: tr('notifications.viewConnection'),
      actionTab: 'conexoes' as TabId,
    }))

  const plannedTransactions = dashboardTransactions.value
    .filter((transaction) => transaction.status === 'Previsto')
    .map((transaction) => ({
      id: `transaction-${transaction.id}`,
      title: tr('notifications.planned'),
      description: tr('notifications.plannedDescription', {
        title: transaction.title,
        bank: transaction.bank,
        amount: formatMoney(transaction.amount, props.language),
      }),
      time: transaction.date,
      tone: 'info' as NotificationTone,
      actionLabel: tr('notifications.viewFlow'),
      actionTab: 'fluxo' as TabId,
    }))

  return [...bankAlerts, ...plannedTransactions]
})
const unreadNotificationCount = computed(
  () => notifications.value.filter((notification) => !readNotificationIds.value.includes(notification.id)).length,
)
const pluggyLoadedAtLabel = computed(() => {
  if (!pluggyDataLoadedAt.value) return ''

  return new Date(pluggyDataLoadedAt.value).toLocaleString(props.language, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
})

function displayMoney(value: number) {
  return isBalanceVisible.value ? formatMoney(value, props.language) : 'R$ ••••••'
}

function balanceToggleLabel() {
  return isBalanceVisible.value ? tr('dashboard.hideBalances') : tr('dashboard.showBalances')
}

function countTransactionsByAccount(transactions: PluggyTransaction[]) {
  return transactions.reduce<Record<string, number>>((accumulator, transaction) => {
    accumulator[transaction.accountId] = (accumulator[transaction.accountId] ?? 0) + 1
    return accumulator
  }, {})
}

function mapPluggyAccount(account: PluggyAccount, index: number, newTransactions = 0): BankConnection {
  // Map Pluggy account types to display colors.
  const typeColors: Record<string, string> = {
    BANK: '#17c964',
    CREDIT: '#f52a55',
    INVESTMENT: '#3b82f6',
  }
  const displayName = account.marketingName || account.name || `Conta Pluggy ${index + 1}`
  const accountNumber = account.bankData?.transferNumber || account.number

  return {
    id: account.id,
    name: displayName,
    shortName: displayName.split(' ')[0] || displayName,
    logoText: displayName.slice(0, 2).toUpperCase(),
    color: typeColors[account.type] ?? '#7c16dd',
    balance: account.balance,
    newTransactions,
    status: 'Sincronizado',
    mask: accountNumber ? `•••• ${accountNumber.slice(-4)}` : `Conta ${index + 1}`,
  } satisfies BankConnection
}

function mapPluggyTransaction(transaction: PluggyTransaction, accountNames: Record<string, string>): Transaction {
  // A Pluggy separa CREDIT/DEBIT; o dashboard usa positivo para entrada e negativo para saida.
  const isCredit = transaction.type === 'CREDIT' || transaction.amount > 0
  const isPosted = transaction.status === 'POSTED'

  return {
    id: transaction.id,
    title: transaction.merchant?.name || transaction.description || 'Transação',
    bank: accountNames[transaction.accountId] ?? 'Pluggy',
    category: transaction.category || (isCredit ? 'Receita' : 'Despesa'),
    amount: isCredit ? Math.abs(transaction.amount) : -Math.abs(transaction.amount),
    date: new Date(transaction.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    status: isPosted ? 'Confirmado' : 'Previsto',
  } satisfies Transaction
}

function mapRemoteTransaction(transaction: { id: string; title: string; amount: number; status: string; createdAt?: string }) {
  const status = transaction.status === 'Confirmado' ? 'Confirmado' : 'Previsto'
  const lowerTitle = transaction.title.toLowerCase()
  let bank = 'Data Connect'
  if (lowerTitle.includes('salario')) bank = 'Nubank'
  else if (lowerTitle.includes('aluguel')) bank = 'Bradesco'

  const category = transaction.status === 'Confirmado' ? 'Sincronizado' : 'Previsto'

  return {
    id: transaction.id,
    title: transaction.title,
    bank,
    category,
    amount: Number(transaction.amount || 0),
    date: transaction.createdAt
      ? new Date(transaction.createdAt).toLocaleDateString(props.language, {
          day: '2-digit',
          month: 'short',
        })
      : 'Hoje',
    status,
  } satisfies Transaction
}

async function refreshTransactions() {
  // Data Connect e opcional: se nao houver dados remotos, mantemos o modo demonstracao.
  if (!props.profile.id) {
    dashboardTransactions.value = [...mockTransactions]
    transactionsSource.value = 'mock'
    return
  }

  isLoadingTransactions.value = true

  try {
    const remoteTransactions = await loadTransactionsForUser(props.profile.id)

    if (remoteTransactions.length) {
      dashboardTransactions.value = remoteTransactions.map(mapRemoteTransaction)
      transactionsSource.value = 'dataconnect'
      return
    }
  } catch {
    // Fallback to mocks when the endpoint is unavailable or returns an error.
  } finally {
    isLoadingTransactions.value = false
  }

  dashboardTransactions.value = [...mockTransactions]
  transactionsSource.value = 'mock'
}

async function toggleTransactionStatus(transactionId: string, nextStatus: Transaction['status']) {
  const target = dashboardTransactions.value.find((item) => item.id === transactionId)

  if (!target || !import.meta.env.VITE_FIREBASE_DATACONNECT_ENDPOINT) {
    return
  }

  const previousStatus = target.status
  isUpdatingTransactionStatus.value = transactionId
  transactionUpdateFeedback.value = null
  // Atualizacao otimista: a interface muda na hora e reverte se o backend falhar.
  target.status = nextStatus

  try {
    await updateTransactionStatusInDataConnect(transactionId, nextStatus)
    transactionUpdateFeedback.value = {
      id: transactionId,
      type: 'success',
      message: nextStatus === 'Confirmado' ? 'Transacao confirmada no Data Connect.' : 'Status atualizado para previsto.',
    }
  } catch {
    target.status = previousStatus
    transactionUpdateFeedback.value = {
      id: transactionId,
      type: 'error',
      message: 'Nao foi possivel atualizar o status no Data Connect.',
    }
  } finally {
    isUpdatingTransactionStatus.value = null
  }
}

function tabButtonClass(tab: TabId) {
  return [
    'btn btn-sm border-0 px-4 font-bold',
    activeTab.value === tab ? 'bg-white text-[#08090d]' : 'bg-transparent text-zinc-400 hover:bg-white/10 hover:text-white',
  ]
}

function readStoredNotificationIds(profileId: string) {
  if (globalThis.window === undefined) {
    return []
  }

  const stored = globalThis.localStorage.getItem(`${NOTIFICATION_STORAGE_PREFIX}.${profileId}`)

  try {
    return stored ? (JSON.parse(stored) as string[]) : []
  } catch {
    return []
  }
}

function readStoredBalanceVisibility(profileId: string) {
  if (globalThis.window === undefined) {
    return true
  }

  return globalThis.localStorage.getItem(`${BALANCE_VISIBILITY_STORAGE_PREFIX}.${profileId}`) !== 'false'
}

function toggleBalanceVisibility() {
  isBalanceVisible.value = !isBalanceVisible.value

  if (globalThis.window !== undefined) {
    globalThis.localStorage.setItem(`${BALANCE_VISIBILITY_STORAGE_PREFIX}.${props.profile.id}`, String(isBalanceVisible.value))
  }
}

function persistReadNotificationIds(nextIds: string[]) {
  readNotificationIds.value = nextIds

  if (globalThis.window !== undefined) {
    globalThis.localStorage.setItem(`${NOTIFICATION_STORAGE_PREFIX}.${props.profile.id}`, JSON.stringify(nextIds))
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
    reader.onerror = () => reject(new Error(tr('profile.imageReadError')))
    reader.readAsDataURL(file)
  })
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(tr('profile.imageLoadError')))
    image.src = source
  })
}

async function createAvatarDataUrl(file: File) {
  // Normaliza qualquer foto em JPEG quadrado para evitar uploads grandes no perfil.
  if (!file.type.startsWith('image/')) {
    throw new Error(tr('profile.imageTypeError'))
  }

  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error(tr('profile.imageSizeError'))
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
    throw new Error(tr('profile.imagePrepareError'))
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
    avatarMessage.value = tr('profile.photoUpdated')
    profileMenuOpen.value = false
  } catch (error) {
    avatarError.value = error instanceof Error ? error.message : tr('profile.imageGenericError')
  } finally {
    input.value = ''
  }
}

function removeAvatar() {
  const nextProfile: UserProfile = { ...props.profile }
  delete nextProfile.avatarUrl
  emit('profileUpdated', nextProfile)
  avatarMessage.value = tr('profile.photoRemoved')
  avatarError.value = ''
}

async function loadPluggyData(itemId: string) {
  if (!itemId || isLoadingPluggyData.value) return

  isLoadingPluggyData.value = true
  connectError.value = ''
  pluggyPartialErrors.value = []

  try {
    const data = await fetchPluggyItemData(itemId)
    const transactionCounts = countTransactionsByAccount(data.transactions)
    const accountNames = data.accounts.reduce<Record<string, string>>((accumulator, account, index) => {
      accumulator[account.id] = account.marketingName || account.name || `Conta Pluggy ${index + 1}`
      return accumulator
    }, {})

    if (data.accounts.length) {
      dashboardBankConnections.value = data.accounts.map((account, index) =>
        mapPluggyAccount(account, index, transactionCounts[account.id] ?? 0),
      )
    }

    dashboardTransactions.value = data.transactions.map((transaction) => mapPluggyTransaction(transaction, accountNames))
    transactionsSource.value = 'pluggy'
    pluggyDataLoadedAt.value = data.loadedAt ?? new Date().toISOString()
    pluggyPartialErrors.value = data.partialErrors ?? []

    if (!data.accounts.length && !data.transactions.length) {
      connectMessage.value = 'Conexao Pluggy encontrada, mas os dados ainda nao foram sincronizados.'
    } else if (data.partialErrors?.length) {
      connectMessage.value = 'Dados Pluggy carregados com avisos em algumas contas.'
    }
  } catch (error) {
    connectError.value = error instanceof Error ? error.message : 'Erro ao carregar dados do Pluggy'
  } finally {
    isLoadingPluggyData.value = false
  }
}

async function connectAccount() {
  if (isConnecting.value) {
    return
  }

  isConnecting.value = true
  connectMessage.value = ''
  connectError.value = ''

  // O widget da Pluggy devolve status; apenas "connected" gera persistencia do itemId.
  const result = await openPluggyConnect({
    clientUserId: props.profile.id,
    userEmail: props.profile.email,
    onEvent: (payload) => {
      connectMessage.value = tr('pluggy.event', { event: payload.event })
    },
  })

  isConnecting.value = false

  if (result.status === 'connected' && result.itemId) {
    connectedItemId.value = result.itemId
    connectMessage.value = result.message

    // Persist the new itemId into the user profile so it survives page reload.
    const updatedItemIds = [...(props.profile.pluggyItemIds ?? [])]
    if (!updatedItemIds.includes(result.itemId)) {
      updatedItemIds.push(result.itemId)
    }
    emit('profileUpdated', { ...props.profile, pluggyItemIds: updatedItemIds })

    // Load real financial data from Pluggy.
    await loadPluggyData(result.itemId)
  } else if (result.status === 'error') {
    connectError.value = result.message
  } else {
    // status === 'closed': user dismissed the widget voluntarily.
    connectMessage.value = result.message
  }
}

function newLaunchLabel(bank: BankConnection) {
  if (!bank.newTransactions) {
    return bankStatusLabel(bank.status)
  }

  return tr('notifications.newTransactionsCount', {
    count: bank.newTransactions.toLocaleString(props.language),
  })
}

function bankStatusLabel(status: BankConnection['status']) {
  if (status === 'Sincronizado') {
    return tr('status.synced')
  }

  if (status === 'Pendente') {
    return tr('status.pending')
  }

  return tr('status.noNewTransactions')
}

function transactionStatusLabel(status: Transaction['status']) {
  return status === 'Confirmado' ? tr('status.confirmed') : tr('status.planned')
}

async function restoreDashboardData() {
  dashboardBankConnections.value = [...mockBankConnections]
  pluggyDataLoadedAt.value = ''
  pluggyPartialErrors.value = []

  // If the user already has connected items from a previous session, Pluggy has
  // priority over Data Connect/mock so the dashboard does not flicker backwards.
  const existingItemIds = props.profile.pluggyItemIds ?? []
  const latestItemId = existingItemIds[existingItemIds.length - 1]
  if (latestItemId) {
    connectedItemId.value = latestItemId
    await loadPluggyData(latestItemId)
    return
  }

  connectedItemId.value = ''
  await refreshTransactions()
}

onMounted(async () => {
  await restoreDashboardData()
})

watch(
  () => props.profile.id,
  () => {
    readNotificationIds.value = readStoredNotificationIds(props.profile.id)
    isBalanceVisible.value = readStoredBalanceVisibility(props.profile.id)
    void restoreDashboardData()
  },
)
</script>

<template>
  <section class="dashboard-shell min-h-screen" :data-mode="theme">
    <header class="dashboard-header sticky top-0 z-40 border-b backdrop-blur">
      <div class="mx-auto flex h-17 max-w-370 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div class="inline-flex items-center gap-2 text-xl font-black tracking-normal">
          <BrandLogo class="size-9 shrink-0 rounded-xl shadow-sm shadow-black/30" variant="favicon" />
          <span>iFinanca</span>
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
          <LanguageFlagSelect
            :label="tr('common.language')"
            :language="language"
            :tone="theme === 'light' ? 'light' : 'dark'"
            @language-change="emit('languageChange', $event)"
          />

          <button
            :class="['tooltip tooltip-bottom btn btn-ghost btn-square btn-sm hidden sm:inline-flex', theme === 'light' ? 'text-[#17c964]' : 'text-zinc-400']"
            :data-tip="tr('common.themeLight')"
            type="button"
            @click="setTheme('light')"
          >
            <Sun :size="18" />
          </button>
          <button
            :class="['tooltip tooltip-bottom btn btn-ghost btn-square btn-sm hidden sm:inline-flex', theme === 'dark' ? 'text-[#17c964]' : 'text-zinc-400']"
            :data-tip="tr('common.themeDark')"
            type="button"
            @click="setTheme('dark')"
          >
            <Moon :size="18" />
          </button>

          <div class="relative">
            <button
              class="tooltip tooltip-bottom btn btn-ghost btn-square btn-sm text-zinc-400"
              :data-tip="tr('notifications.title')"
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
                  <p class="text-sm font-black">{{ tr('notifications.title') }}</p>
                  <p class="text-xs text-zinc-500">{{ tr('notifications.pending', { count: unreadNotificationCount }) }}</p>
                </div>
                <button class="btn btn-ghost btn-square btn-xs text-zinc-400" :title="tr('notifications.markAll')" type="button" @click="markAllNotificationsRead">
                  <CheckCheck :size="16" />
                </button>
              </div>

              <div class="max-h-90 space-y-2 overflow-y-auto pr-1">
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
              class="avatar-button grid size-9 place-items-center overflow-hidden rounded-full bg-[#17c964] text-sm font-black leading-none text-[#06130a]"
              type="button"
              :aria-label="tr('profile.openMenu')"
              @click="toggleProfileMenu"
            >
              <img v-if="profile.avatarUrl" class="h-full w-full object-cover" :src="profile.avatarUrl" alt="" />
              <span v-else class="grid size-full place-items-center leading-none">{{ firstName.slice(0, 1).toUpperCase() }}</span>
            </button>

            <label for="avatarInput" class="sr-only">Selecionar avatar</label>
            <input id="avatarInput" ref="avatarInput" class="hidden" accept="image/*" type="file" @change="handleAvatarSelected" />

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
                  {{ tr('profile.changePhoto') }}
                </button>
                <button class="btn btn-sm justify-start border-white/10 bg-transparent text-zinc-300 hover:bg-white/10" type="button" @click="removeAvatar">
                  <Trash2 :size="16" />
                  {{ tr('profile.removePhoto') }}
                </button>
                <button class="btn btn-sm justify-start border-white/10 bg-transparent text-zinc-300 hover:bg-white/10 sm:hidden" type="button" @click="emit('logout')">
                  <LogOut :size="16" />
                  {{ tr('common.logout') }}
                </button>
              </div>

              <p v-if="avatarMessage" class="mt-3 text-sm font-semibold text-[#17c964]">{{ avatarMessage }}</p>
              <p v-if="avatarError" class="mt-3 text-sm font-semibold text-[#ff6b7f]">{{ avatarError }}</p>
            </div>
          </div>
          <button class="tooltip tooltip-bottom btn btn-ghost btn-square btn-sm hidden text-zinc-400 sm:inline-flex" :data-tip="tr('common.logout')" type="button" @click="emit('logout')">
            <LogOut :size="18" />
          </button>
          <button class="btn btn-ghost btn-square btn-sm text-zinc-400 md:hidden" type="button" @click="menuOpen = !menuOpen">
            <X v-if="menuOpen" :size="20" />
            <Menu v-else :size="20" />
          </button>
        </div>
      </div>

      <nav v-if="menuOpen" class="grid gap-2 border-t border-white/10 px-4 py-3 md:hidden">
        <div class="grid grid-cols-2 gap-2 sm:hidden">
          <button class="btn btn-sm border-white/10 bg-transparent text-zinc-300" type="button" @click="setTheme('light')">
            <Sun :size="16" />
            {{ tr('common.themeLight') }}
          </button>
          <button class="btn btn-sm border-white/10 bg-transparent text-zinc-300" type="button" @click="setTheme('dark')">
            <Moon :size="16" />
            {{ tr('common.themeDark') }}
          </button>
        </div>
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

    <div class="mx-auto max-w-370 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div class="grid gap-8 xl:grid-cols-[260px_1fr] 2xl:grid-cols-[300px_1fr]">
        <aside class="hidden xl:block">
          <div class="sticky top-24 space-y-3">
            <button class="keep-white btn w-full justify-start border-0 bg-[#f52a55] text-white hover:bg-[#e1264f]" :disabled="isConnecting" type="button" @click="connectAccount">
              <span v-if="isConnecting" class="loading loading-spinner loading-sm"></span>
              <Link2 v-else :size="18" />
              {{ tr('dashboard.connectAccount') }}
            </button>
            <div class="rounded-lg border border-white/10 bg-[#101318] p-4">
              <p class="text-sm font-bold text-zinc-400">{{ tr('dashboard.sync') }}</p>
              <p class="mt-2 text-2xl font-black text-white">
                <span v-if="isLoadingPluggyData" class="loading loading-dots loading-md"></span>
                <span v-else>{{ dashboardBankConnections.length }} {{ tr('dashboard.banksShort') }}</span>
              </p>
              <p class="mt-1 text-sm text-zinc-500">
                {{ pluggyLoadedAtLabel ? tr('dashboard.lastSync', { time: pluggyLoadedAtLabel }) : tr('dashboard.futureImports') }}
              </p>
            </div>
            <div class="rounded-lg border border-white/10 bg-[#101318] p-4">
              <div class="flex items-center justify-between gap-2">
                <p class="text-sm font-bold text-zinc-400">{{ tr('dashboard.pluggyItem') }}</p>
                <button
                  v-if="connectedItemId"
                  class="btn btn-ghost btn-square btn-xs text-zinc-400"
                  :disabled="isLoadingPluggyData"
                  :title="tr('dashboard.refreshPluggy')"
                  type="button"
                  @click="loadPluggyData(connectedItemId)"
                >
                  <RefreshCw :class="{ 'animate-spin': isLoadingPluggyData }" :size="14" />
                </button>
              </div>
              <p class="mt-2 break-all text-sm text-[#76eaa2]">{{ connectedItemId || tr('dashboard.waitingConnection') }}</p>
            </div>
            <div v-if="pluggySandboxEnabled" class="rounded-lg border border-[#244332] bg-[#0d1c14] p-4 text-sm">
              <p class="font-black text-[#76eaa2]">{{ tr('dashboard.sandboxTitle') }}</p>
              <p class="mt-2 text-zinc-400">{{ tr('dashboard.sandboxCredentials') }}</p>
            </div>
          </div>
        </aside>

        <div class="min-w-0">
          <div class="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="text-sm font-bold uppercase text-[#17c964]">{{ activeTabLabel }}</p>
              <h1 class="mt-2 text-3xl font-black text-white sm:text-5xl">{{ activeTabLabel }}</h1>
              <p class="mt-3 max-w-2xl text-zinc-400">
                {{ tr('dashboard.greeting', { name: firstName }) }}
              </p>
            </div>

            <button class="keep-white btn w-full border-0 bg-[#f52a55] text-white hover:bg-[#e1264f] sm:w-auto xl:hidden" :disabled="isConnecting" type="button" @click="connectAccount">
              <span v-if="isConnecting" class="loading loading-spinner loading-sm"></span>
              <Link2 v-else :size="18" />
              {{ tr('dashboard.connectAccount') }}
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
                  <span class="text-sm font-bold">{{ tr('dashboard.totalBalance') }}</span>
                  <button class="btn btn-ghost btn-square btn-xs text-zinc-400 hover:text-white" :title="balanceToggleLabel()" type="button" @click="toggleBalanceVisibility">
                    <EyeOff v-if="isBalanceVisible" :size="18" />
                    <Eye v-else :size="18" />
                  </button>
                </div>
                <p class="mt-4 text-3xl font-black">{{ displayMoney(totalBalance) }}</p>
                <p class="mt-2 text-sm font-semibold text-[#76eaa2]">{{ tr('dashboard.monthGrowth') }}</p>
              </div>

              <div class="rounded-lg border border-white/10 bg-[#101318] p-5">
                <div class="flex items-center justify-between text-zinc-400">
                  <span class="text-sm font-bold">{{ tr('dashboard.income') }}</span>
                  <CircleDollarSign :size="18" />
                </div>
                <p class="mt-4 text-3xl font-black">{{ displayMoney(incomeTotal) }}</p>
                <p class="mt-2 text-sm font-semibold text-[#76eaa2]">{{ tr('dashboard.confirmed') }}</p>
              </div>

              <div class="rounded-lg border border-white/10 bg-[#101318] p-5">
                <div class="flex items-center justify-between text-zinc-400">
                  <span class="text-sm font-bold">{{ tr('dashboard.outcome') }}</span>
                  <CreditCard :size="18" />
                </div>
                <p class="mt-4 text-3xl font-black">{{ displayMoney(outcomeTotal) }}</p>
                <p class="mt-2 text-sm font-semibold text-[#ff6b7f]">{{ tr('dashboard.plannedPaid') }}</p>
              </div>

              <div class="rounded-lg border border-white/10 bg-[#101318] p-5">
                <div class="flex items-center justify-between text-zinc-400">
                  <span class="text-sm font-bold">{{ tr('dashboard.netWorth') }}</span>
                  <PiggyBank :size="18" />
                </div>
                <p class="mt-4 text-3xl font-black">{{ displayMoney(assetTotal) }}</p>
                <p class="mt-2 text-sm font-semibold text-[#7db4ff]">{{ tr('dashboard.connectedAssets') }}</p>
              </div>
            </section>

            <section class="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <div class="rounded-lg border border-white/10 bg-[#101318] p-5">
                <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p class="text-sm font-bold text-zinc-400">{{ tr('dashboard.monthlyFlow') }}</p>
                    <h2 class="mt-1 text-2xl font-black">{{ tr('dashboard.incomeOutcome') }}</h2>
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
                    <p class="text-sm font-bold text-zinc-400">{{ tr('dashboard.myAccounts') }}</p>
                    <h2 class="mt-1 text-2xl font-black">{{ tr('dashboard.connected') }}</h2>
                  </div>
                  <button class="btn btn-square btn-sm border-0 bg-white/10 text-white hover:bg-white/20" type="button" @click="activeTab = 'conexoes'">
                    <ArrowRight :size="17" />
                  </button>
                </div>

                <div class="space-y-3">
                  <div v-for="account in overviewAccounts" :key="account.id" class="flex items-center justify-between rounded-lg bg-[#0b0d12] p-4">
                    <div class="min-w-0">
                      <p class="truncate font-black">{{ account.name }}</p>
                      <p class="text-sm text-zinc-500">{{ account.type }}</p>
                    </div>
                    <div class="text-right">
                      <p :class="account.amount >= 0 ? 'text-[#7db4ff]' : 'text-[#ff6b7f]'" class="font-black">
                        {{ displayMoney(account.amount) }}
                      </p>
                      <p :class="account.variation >= 0 ? 'text-[#76eaa2]' : 'text-[#ff6b7f]'" class="text-xs font-bold">
                        {{ account.variationLabel }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section class="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
              <div class="rounded-lg border border-white/10 bg-[#101318] p-5">
                <p class="text-sm font-bold text-zinc-400">{{ tr('dashboard.distribution') }}</p>
                <h2 class="mt-1 text-2xl font-black">{{ tr('nav.assets') }}</h2>
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
                    <p class="text-sm font-bold text-zinc-400">{{ tr('dashboard.transactions') }}</p>
                    <h2 class="mt-1 text-2xl font-black">{{ tr('dashboard.recentTransactions') }}</h2>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span v-if="isLoadingTransactions || isLoadingPluggyData" class="text-sm font-semibold text-zinc-400">Carregando...</span>
                    <span v-if="transactionsSource === 'dataconnect'" class="badge border-[#173423] bg-[#102217] text-[#76eaa2]">
                      Sincronizado com Data Connect
                    </span>
                    <span v-else-if="transactionsSource === 'pluggy'" class="badge border-[#173423] bg-[#102217] text-[#76eaa2]">
                      Dados reais · Pluggy
                    </span>
                    <span v-else class="badge border-white/10 bg-white/5 text-zinc-500">
                      Demonstração
                    </span>
                    <ReceiptText class="text-[#17c964]" :size="24" />
                  </div>
                </div>

                <div v-if="transactionUpdateFeedback" class="mb-3 rounded-lg border px-3 py-2 text-sm" :class="transactionUpdateFeedback.type === 'success' ? 'border-[#173423] bg-[#102217] text-[#76eaa2]' : 'border-[#3a1f26] bg-[#22141a] text-[#ff8a9b]'">
                  {{ transactionUpdateFeedback.message }}
                </div>

                <div class="overflow-x-auto">
                  <table class="table">
                    <thead>
                      <tr class="border-white/10 text-zinc-500">
                        <th>{{ tr('dashboard.description') }}</th>
                        <th>{{ tr('dashboard.bank') }}</th>
                        <th>{{ tr('dashboard.status') }}</th>
                        <th class="text-right">{{ tr('dashboard.value') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="transaction in dashboardTransactions" :key="transaction.id" class="border-white/10">
                        <td>
                          <p class="font-black text-white">{{ transaction.title }}</p>
                          <p class="text-sm text-zinc-500">{{ transaction.category }} - {{ transaction.date }}</p>
                        </td>
                        <td class="text-zinc-300">{{ transaction.bank }}</td>
                        <td>
                          <button
                            v-if="transactionsSource === 'dataconnect'"
                            class="badge flex items-center gap-2 border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                            type="button"
                            @click="toggleTransactionStatus(transaction.id, transaction.status === 'Confirmado' ? 'Previsto' : 'Confirmado')"
                          >
                            <span v-if="isUpdatingTransactionStatus === transaction.id" class="loading loading-spinner loading-xs"></span>
                            <span>{{ transactionStatusLabel(transaction.status) }}</span>
                          </button>
                          <span v-else class="badge border-white/10 bg-white/5 text-zinc-300">{{ transactionStatusLabel(transaction.status) }}</span>
                        </td>
                        <td :class="transaction.amount >= 0 ? 'text-[#76eaa2]' : 'text-[#ff6b7f]'" class="text-right font-black">
                          {{ displayMoney(transaction.amount) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>

          <div v-else-if="activeTab === 'conexoes'" class="space-y-4">
            <!-- Error banner -->
            <div v-if="connectError" class="flex items-start gap-3 rounded-lg border border-[#3a1f26] bg-[#22141a] px-4 py-3 text-sm text-[#ff8a9b]">
              <ShieldAlert :size="18" class="mt-0.5 shrink-0" />
              <p>{{ connectError }}</p>
            </div>

            <div v-if="pluggySandboxEnabled" class="rounded-lg border border-[#244332] bg-[#0d1c14] p-4 text-sm xl:hidden">
              <p class="font-black text-[#76eaa2]">{{ tr('dashboard.sandboxTitle') }}</p>
              <p class="mt-2 text-zinc-400">{{ tr('dashboard.sandboxCredentials') }}</p>
            </div>

            <div v-if="pluggyPartialErrors.length" class="rounded-lg border border-[#3b3217] bg-[#201a0d] p-4 text-sm text-[#ffd36a]">
              {{ tr('dashboard.partialPluggyErrors', { count: pluggyPartialErrors.length }) }}
            </div>

            <template v-if="isLoadingPluggyData">
              <div class="flex items-center gap-2 text-sm font-bold text-zinc-400">
                <span class="loading loading-spinner loading-xs text-[#17c964]"></span>
                {{ tr('dashboard.loadingPluggy') }}
              </div>
              <article v-for="index in 3" :key="index" class="rounded-lg border border-white/10 bg-[#101318] p-5">
                <div class="flex items-center gap-4">
                  <div class="skeleton size-12 rounded-full bg-white/10"></div>
                  <div class="min-w-0 flex-1 space-y-3">
                    <div class="skeleton h-5 w-44 max-w-full bg-white/10"></div>
                    <div class="skeleton h-4 w-28 bg-white/10"></div>
                  </div>
                  <div class="skeleton h-8 w-24 rounded bg-white/10"></div>
                </div>
              </article>
            </template>

            <!-- Real bank connections from Pluggy -->
            <template v-else-if="transactionsSource === 'pluggy' && dashboardBankConnections.length">
              <div class="flex flex-col gap-2 text-sm font-bold text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
                <span class="flex items-center gap-2">
                  <span class="size-2 rounded-full bg-[#17c964]"></span>
                  {{ tr('dashboard.realPluggyAccounts') }}
                </span>
                <button class="btn btn-xs border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10" type="button" @click="loadPluggyData(connectedItemId)">
                  <RefreshCw :class="{ 'animate-spin': isLoadingPluggyData }" :size="14" />
                  {{ tr('dashboard.refreshPluggy') }}
                </button>
              </div>
              <article v-for="bank in dashboardBankConnections" :key="bank.id" class="rounded-lg border border-[#173423] bg-[#101318] p-5">
                <div class="flex items-center justify-between gap-4">
                  <div class="flex min-w-0 items-center gap-4">
                    <span class="keep-white grid size-12 shrink-0 place-items-center rounded-full text-sm font-black text-white" :style="{ background: bank.color }">
                      <MaterialIcon fill name="account_balance" :size="24" />
                    </span>
                    <div class="min-w-0">
                      <h2 class="truncate text-xl font-black">{{ bank.name }}</h2>
                      <p class="text-sm text-zinc-500">{{ bank.mask }}</p>
                      <p class="mt-2 text-sm font-black text-[#76eaa2]">{{ bankStatusLabel(bank.status) }}</p>
                    </div>
                  </div>
                  <div class="shrink-0 text-right">
                    <p class="text-lg font-black text-white">{{ displayMoney(bank.balance) }}</p>
                    <p class="text-xs font-bold text-zinc-500">{{ newLaunchLabel(bank) }}</p>
                    <button class="btn btn-square btn-ghost mt-2 text-[#17c964]" type="button" @click="activeTab = 'fluxo'">
                      <ArrowRight :size="22" />
                    </button>
                  </div>
                </div>
              </article>
            </template>

            <!-- Mock / demo connections -->
            <template v-else>
              <div class="flex items-center gap-2 text-sm font-bold text-zinc-400">
                <span class="size-2 rounded-full bg-zinc-600"></span>
                Contas de demonstração · Conecte um banco para ver dados reais
              </div>
              <article v-for="bank in dashboardBankConnections" :key="bank.id" class="rounded-lg border border-white/10 bg-[#101318] p-5">
                <div class="flex items-center justify-between gap-4">
                  <div class="flex min-w-0 items-center gap-4">
                    <span class="keep-white grid size-12 shrink-0 place-items-center rounded-full text-sm font-black text-white" :style="{ background: bank.color }">
                      <MaterialIcon fill name="account_balance" :size="24" />
                    </span>
                    <div class="min-w-0">
                      <h2 class="truncate text-xl font-black">{{ bank.name }}</h2>
                      <p class="text-sm text-zinc-500">{{ bank.mask }}</p>
                      <p :class="bank.newTransactions ? 'text-[#7db4ff]' : 'text-zinc-500'" class="mt-2 text-sm font-black">
                        {{ newLaunchLabel(bank) }}
                      </p>
                    </div>
                  </div>
                  <div class="shrink-0 text-right">
                    <p class="text-lg font-black text-white">{{ displayMoney(bank.balance) }}</p>
                    <button class="btn btn-square btn-ghost mt-2 text-[#17c964]" type="button" @click="activeTab = 'fluxo'">
                      <ArrowRight :size="22" />
                    </button>
                  </div>
                </div>
              </article>
            </template>
          </div>

          <div v-else-if="activeTab === 'ativos'" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article v-for="asset in assets" :key="asset.id" class="rounded-lg border border-white/10 bg-[#101318] p-5">
              <Wallet class="mb-8" :style="{ color: asset.tone }" :size="28" />
              <p class="text-sm font-bold text-zinc-400">{{ tr('dashboard.allocation', { value: asset.allocation }) }}</p>
              <h2 class="mt-2 text-2xl font-black">{{ asset.name }}</h2>
              <p class="mt-4 text-3xl font-black">{{ displayMoney(asset.amount) }}</p>
              <p :class="asset.variation >= 0 ? 'text-[#76eaa2]' : 'text-[#ff6b7f]'" class="mt-2 text-sm font-black">
                {{ formatSignedPercent(asset.variation, language) }}
              </p>
            </article>
          </div>

          <div v-else class="rounded-lg border border-white/10 bg-[#101318] p-5">
            <div class="mb-5 flex items-center justify-between">
              <div>
                <p class="text-sm font-bold text-zinc-400">{{ tr('dashboard.plannedFlow') }}</p>
                <h2 class="mt-1 text-2xl font-black">{{ tr('dashboard.nextTransactions') }}</h2>
              </div>
              <Plus class="text-[#17c964]" :size="24" />
            </div>

            <div class="grid gap-3">
              <div v-for="transaction in dashboardTransactions" :key="transaction.id" class="flex flex-col gap-2 rounded-lg bg-[#0b0d12] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                  <p class="font-black">{{ transaction.title }}</p>
                  <p class="text-sm text-zinc-500">{{ transaction.category }} - {{ transaction.date }}</p>
                </div>
                <p :class="transaction.amount >= 0 ? 'text-[#76eaa2]' : 'text-[#ff6b7f]'" class="font-black sm:text-right">
                  {{ displayMoney(transaction.amount) }}
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
