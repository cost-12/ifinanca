<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArrowRight,
  Bell,
  ChartNoAxesColumnIncreasing,
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
import type { BankConnection, UserProfile } from '@/types/finance'

const props = defineProps<{
  profile: UserProfile
}>()

const emit = defineEmits<{
  logout: []
}>()

type TabId = 'overview' | 'fluxo' | 'ativos' | 'conexoes'

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'fluxo', label: 'Fluxo' },
  { id: 'ativos', label: 'Ativos' },
  { id: 'conexoes', label: 'Conexoes' },
]

const activeTab = ref<TabId>('overview')
const menuOpen = ref(false)
const isConnecting = ref(false)
const connectMessage = ref('')
const connectedItemId = ref('')

const firstName = computed(() => props.profile.name.trim().split(' ')[0] || 'Usuario')
const activeTabLabel = computed(() => tabs.find((tab) => tab.id === activeTab.value)?.label ?? 'Overview')
const totalBalance = computed(() => bankConnections.reduce((total, bank) => total + bank.balance, 0))
const incomeTotal = computed(() => transactions.filter((item) => item.amount > 0).reduce((total, item) => total + item.amount, 0))
const outcomeTotal = computed(() => Math.abs(transactions.filter((item) => item.amount < 0).reduce((total, item) => total + item.amount, 0)))
const assetTotal = computed(() => assets.reduce((total, asset) => total + asset.amount, 0))

function tabButtonClass(tab: TabId) {
  return [
    'btn btn-sm border-0 px-4 font-bold',
    activeTab.value === tab ? 'bg-white text-[#08090d]' : 'bg-transparent text-zinc-400 hover:bg-white/10 hover:text-white',
  ]
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
  <section class="min-h-screen bg-[#06070a] text-white">
    <header class="sticky top-0 z-40 border-b border-white/10 bg-[#07080d]/95 backdrop-blur">
      <div class="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-3">
          <span class="flex size-10 items-center justify-center rounded-lg bg-white text-lg font-black text-[#08090d]">
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
          <button class="tooltip tooltip-bottom btn btn-ghost btn-square btn-sm text-zinc-400" data-tip="Tema claro" type="button">
            <Sun :size="18" />
          </button>
          <button class="tooltip tooltip-bottom btn btn-ghost btn-square btn-sm text-zinc-400" data-tip="Tema escuro" type="button">
            <Moon :size="18" />
          </button>
          <button class="tooltip tooltip-bottom btn btn-ghost btn-square btn-sm text-zinc-400" data-tip="Notificacoes" type="button">
            <Bell :size="18" />
          </button>
          <div class="avatar placeholder">
            <div class="w-9 rounded-full bg-[#17c964] text-sm font-black text-[#06130a]">
              <span>{{ firstName.slice(0, 1).toUpperCase() }}</span>
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
            <button class="btn w-full justify-start border-0 bg-[#f52a55] text-white hover:bg-[#e1264f]" type="button" @click="connectAccount">
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

            <button class="btn border-0 bg-[#f52a55] text-white hover:bg-[#e1264f] xl:hidden" :disabled="isConnecting" type="button" @click="connectAccount">
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
                  <span class="grid size-12 shrink-0 place-items-center rounded-full text-sm font-black text-white" :style="{ background: bank.color }">
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
