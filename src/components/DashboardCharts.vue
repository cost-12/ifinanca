<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js'
import { ArrowRight, ChartNoAxesColumnIncreasing, PieChart } from '@lucide/vue'
import { formatMoney, formatSignedPercent, translate } from '@/i18n'
import type { AppLanguage, AppTheme, BankConnection, Transaction } from '@/types/finance'

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
)

const props = defineProps<{
  bankConnections: BankConnection[]
  incomeTotal: number
  isBalanceVisible: boolean
  language: AppLanguage
  outcomeTotal: number
  theme: AppTheme
  totalBalance: number
  transactions: Transaction[]
}>()

const emit = defineEmits<{
  openConnections: []
}>()

interface MonthBucket {
  key: string
  label: string
  income: number
  outcome: number
}

const flowCanvas = ref<HTMLCanvasElement | null>(null)
const categoryCanvas = ref<HTMLCanvasElement | null>(null)

let flowChart: Chart<'bar' | 'line', number[], string> | null = null
let categoryChart: Chart<'doughnut', number[], string> | null = null

function tr(key: Parameters<typeof translate>[1], variables?: Parameters<typeof translate>[2]) {
  return translate(props.language, key, variables)
}

function displayMoney(value: number) {
  return props.isBalanceVisible ? formatMoney(value, props.language) : 'R$ ••••••'
}

function shortMoney(value: number) {
  if (!props.isBalanceVisible) {
    return ''
  }

  const absValue = Math.abs(value)
  const suffix = absValue >= 1000 ? 'k' : ''
  const compactValue = absValue >= 1000 ? value / 1000 : value

  return `${compactValue.toLocaleString(props.language, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })}${suffix}`
}

function displayPercent(value: number) {
  return props.isBalanceVisible ? formatSignedPercent(value, props.language) : '••••'
}

function chartColors() {
  return {
    text: props.theme === 'light' ? '#627064' : '#a1a1aa',
    grid: props.theme === 'light' ? 'rgba(22,45,31,0.1)' : 'rgba(255,255,255,0.08)',
    tooltipBg: props.theme === 'light' ? '#ffffff' : '#101318',
    tooltipText: props.theme === 'light' ? '#151915' : '#ffffff',
  }
}

function makeMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat(props.language, { month: 'short' }).format(date).replace('.', '')
}

function lastSixMonths() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)

    return {
      key: makeMonthKey(date),
      label: monthLabel(date),
      income: 0,
      outcome: 0,
    } satisfies MonthBucket
  })
}

function monthFromTransactionDate(dateLabel: string) {
  const normalized = dateLabel.toLowerCase()
  const now = new Date()

  if (normalized.includes('amanh') || normalized.includes('tomorrow') || normalized.includes('mañana')) {
    return makeMonthKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  }

  if (normalized.includes('hoje') || normalized.includes('today') || normalized.includes('hoy')) {
    return makeMonthKey(now)
  }

  const monthAliases = [
    ['jan', 0],
    ['fev', 1],
    ['feb', 1],
    ['mar', 2],
    ['abr', 3],
    ['apr', 3],
    ['mai', 4],
    ['may', 4],
    ['jun', 5],
    ['jul', 6],
    ['ago', 7],
    ['aug', 7],
    ['set', 8],
    ['sep', 8],
    ['out', 9],
    ['oct', 9],
    ['nov', 10],
    ['dez', 11],
    ['dec', 11],
    ['dic', 11],
  ] as const

  const matchedMonth = monthAliases.find(([alias]) => normalized.includes(alias))
  if (!matchedMonth) {
    return makeMonthKey(now)
  }

  return makeMonthKey(new Date(now.getFullYear(), matchedMonth[1], 1))
}

const monthlyBuckets = computed(() => {
  const buckets = lastSixMonths()
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]))

  for (const transaction of props.transactions) {
    const bucket = bucketMap.get(monthFromTransactionDate(transaction.date))
    if (!bucket) {
      continue
    }

    if (transaction.amount >= 0) {
      bucket.income += transaction.amount
    } else {
      bucket.outcome += Math.abs(transaction.amount)
    }
  }

  return buckets
})

const flowNet = computed(() => props.incomeTotal - props.outcomeTotal)
const savingsRate = computed(() => (props.incomeTotal > 0 ? (flowNet.value / props.incomeTotal) * 100 : 0))
const averageAccountBalance = computed(() => {
  if (!props.bankConnections.length) {
    return 0
  }

  return props.totalBalance / props.bankConnections.length
})

const categoryTotals = computed(() => {
  const totals = props.transactions
    .filter((transaction) => transaction.amount < 0)
    .reduce<Record<string, number>>((accumulator, transaction) => {
      accumulator[transaction.category] = (accumulator[transaction.category] ?? 0) + Math.abs(transaction.amount)
      return accumulator
    }, {})

  return Object.entries(totals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
})

const topExpense = computed(() => categoryTotals.value[0])
const maxAccountBalance = computed(() =>
  Math.max(1, ...props.bankConnections.map((bank) => Math.abs(bank.balance))),
)
const accountBalanceRows = computed(() =>
  props.bankConnections.map((bank) => ({
    ...bank,
    width: `${Math.max(6, (Math.abs(bank.balance) / maxAccountBalance.value) * 100)}%`,
  })),
)

function destroyCharts() {
  flowChart?.destroy()
  categoryChart?.destroy()
  flowChart = null
  categoryChart = null
}

function makeFlowChartConfig(): ChartConfiguration<'bar' | 'line', number[], string> {
  const colors = chartColors()
  const buckets = monthlyBuckets.value
  let runningBalance = props.totalBalance - buckets.reduce((total, bucket) => total + bucket.income - bucket.outcome, 0)
  const balanceTrend = buckets.map((bucket) => {
    runningBalance += bucket.income - bucket.outcome
    return runningBalance
  })

  return {
    type: 'bar',
    data: {
      labels: buckets.map((bucket) => bucket.label),
      datasets: [
        {
          label: tr('dashboard.transactionIncome'),
          data: buckets.map((bucket) => bucket.income),
          backgroundColor: '#17c964',
          borderRadius: 8,
          borderSkipped: false,
          order: 2,
        },
        {
          label: tr('dashboard.transactionExpense'),
          data: buckets.map((bucket) => bucket.outcome),
          backgroundColor: '#f52a55',
          borderRadius: 8,
          borderSkipped: false,
          order: 2,
        },
        {
          type: 'line',
          label: tr('dashboard.balanceTrend'),
          data: balanceTrend,
          borderColor: '#7db4ff',
          backgroundColor: 'rgba(125,180,255,0.12)',
          borderWidth: 3,
          fill: true,
          pointBackgroundColor: '#7db4ff',
          pointBorderWidth: 0,
          pointRadius: 3,
          tension: 0.35,
          order: 1,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: {
          labels: {
            boxWidth: 10,
            color: colors.text,
            font: { family: 'Inter, sans-serif', size: 12, weight: 'bold' },
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          borderColor: colors.grid,
          borderWidth: 1,
          bodyColor: colors.tooltipText,
          callbacks: {
            label: (context) => `${context.dataset.label}: ${displayMoney(Number(context.parsed.y || 0))}`,
          },
          titleColor: colors.tooltipText,
        },
      },
      scales: {
        x: {
          border: { display: false },
          grid: { display: false },
          ticks: { color: colors.text, font: { weight: 'bold' } },
        },
        y: {
          border: { display: false },
          grid: { color: colors.grid },
          ticks: {
            callback: (value) => shortMoney(Number(value)),
            color: colors.text,
            maxTicksLimit: 5,
          },
        },
      },
    },
  }
}

function makeCategoryChartConfig(): ChartConfiguration<'doughnut', number[], string> {
  const colors = chartColors()
  const palette = ['#f52a55', '#17c964', '#7db4ff', '#f59e0b', '#8b5cf6', '#14b8a6']
  const entries = categoryTotals.value.length ? categoryTotals.value : [{ name: tr('dashboard.noExpenses'), value: 1 }]

  return {
    type: 'doughnut',
    data: {
      labels: entries.map((entry) => entry.name),
      datasets: [
        {
          data: entries.map((entry) => entry.value),
          backgroundColor: palette.slice(0, entries.length),
          borderColor: props.theme === 'light' ? '#ffffff' : '#101318',
          borderWidth: 4,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      cutout: '68%',
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          borderColor: colors.grid,
          borderWidth: 1,
          bodyColor: colors.tooltipText,
          callbacks: {
            label: (context) => `${context.label}: ${displayMoney(Number(context.parsed || 0))}`,
          },
          titleColor: colors.tooltipText,
        },
      },
    },
  }
}

async function renderCharts() {
  await nextTick()

  if (!flowCanvas.value || !categoryCanvas.value) {
    return
  }

  destroyCharts()
  flowChart = new Chart(flowCanvas.value, makeFlowChartConfig())
  categoryChart = new Chart(categoryCanvas.value, makeCategoryChartConfig())
}

onMounted(renderCharts)
onBeforeUnmount(destroyCharts)

watch(
  () => [
    props.bankConnections,
    props.incomeTotal,
    props.isBalanceVisible,
    props.language,
    props.outcomeTotal,
    props.theme,
    props.totalBalance,
    props.transactions,
  ],
  renderCharts,
  { deep: true },
)
</script>

<template>
  <section class="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
    <div class="rounded-lg border border-white/10 bg-[#101318] p-5">
      <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-sm font-bold text-zinc-400">{{ tr('dashboard.monthlyFlow') }}</p>
          <h2 class="mt-1 text-2xl font-black">{{ tr('dashboard.incomeOutcome') }}</h2>
        </div>
        <span class="badge border-[#173423] bg-[#102217] text-[#76eaa2]">
          <ChartNoAxesColumnIncreasing :size="15" />
          Chart.js
        </span>
      </div>

      <div class="mb-5 grid gap-3 sm:grid-cols-3">
        <div class="rounded-lg bg-[#0b0d12] p-3">
          <p class="text-xs font-bold uppercase text-zinc-500">{{ tr('dashboard.netFlow') }}</p>
          <p :class="flowNet >= 0 ? 'text-[#76eaa2]' : 'text-[#ff6b7f]'" class="mt-1 text-xl font-black">
            {{ displayMoney(flowNet) }}
          </p>
        </div>
        <div class="rounded-lg bg-[#0b0d12] p-3">
          <p class="text-xs font-bold uppercase text-zinc-500">{{ tr('dashboard.savingsRate') }}</p>
          <p :class="savingsRate >= 0 ? 'text-[#76eaa2]' : 'text-[#ff6b7f]'" class="mt-1 text-xl font-black">
            {{ displayPercent(savingsRate) }}
          </p>
        </div>
        <div class="rounded-lg bg-[#0b0d12] p-3">
          <p class="text-xs font-bold uppercase text-zinc-500">{{ tr('dashboard.averageAccountBalance') }}</p>
          <p class="mt-1 text-xl font-black">{{ displayMoney(averageAccountBalance) }}</p>
        </div>
      </div>

      <div class="h-80">
        <canvas ref="flowCanvas" :aria-label="tr('dashboard.incomeOutcome')" role="img"></canvas>
      </div>
    </div>

    <div class="grid gap-6">
      <div class="rounded-lg border border-white/10 bg-[#101318] p-5">
        <div class="mb-5 flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-bold text-zinc-400">{{ tr('dashboard.expenseBreakdown') }}</p>
            <h2 class="mt-1 text-2xl font-black">{{ tr('dashboard.categories') }}</h2>
          </div>
          <PieChart class="text-[#f52a55]" :size="24" />
        </div>

        <div class="grid gap-4 sm:grid-cols-[160px_1fr] xl:grid-cols-1 2xl:grid-cols-[160px_1fr]">
          <div class="relative h-40">
            <canvas ref="categoryCanvas" :aria-label="tr('dashboard.expenseBreakdown')" role="img"></canvas>
          </div>
          <div class="space-y-3">
            <div class="rounded-lg bg-[#0b0d12] p-3">
              <p class="text-xs font-bold uppercase text-zinc-500">{{ tr('dashboard.topExpense') }}</p>
              <p class="mt-1 truncate font-black">{{ topExpense?.name ?? tr('dashboard.noExpenses') }}</p>
              <p class="mt-1 text-sm font-bold text-[#ff6b7f]">{{ displayMoney(topExpense?.value ?? 0) }}</p>
            </div>

            <div class="space-y-2">
              <div v-for="category in categoryTotals.slice(0, 4)" :key="category.name" class="flex items-center justify-between gap-3 text-sm">
                <span class="truncate text-zinc-400">{{ category.name }}</span>
                <span class="shrink-0 font-black">{{ displayMoney(category.value) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-white/10 bg-[#101318] p-5">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <p class="text-sm font-bold text-zinc-400">{{ tr('dashboard.accountBalances') }}</p>
            <h2 class="mt-1 text-2xl font-black">{{ tr('dashboard.connected') }}</h2>
          </div>
          <button class="btn btn-square btn-sm border-0 bg-white/10 text-white hover:bg-white/20" type="button" @click="emit('openConnections')">
            <ArrowRight :size="17" />
          </button>
        </div>

        <div class="space-y-4">
          <div v-for="account in accountBalanceRows" :key="account.id" class="space-y-2">
            <div class="flex items-center justify-between gap-3 text-sm">
              <span class="truncate font-black">{{ account.name }}</span>
              <span :class="account.balance >= 0 ? 'text-[#7db4ff]' : 'text-[#ff6b7f]'" class="shrink-0 font-black">
                {{ displayMoney(account.balance) }}
              </span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-[#0b0d12]">
              <span
                class="block h-full rounded-full"
                :class="account.balance >= 0 ? 'bg-[#17c964]' : 'bg-[#f52a55]'"
                :style="{ width: account.width }"
              ></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
