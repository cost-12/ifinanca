import type { AssetPosition, BankConnection, FinanceAccount, Transaction } from '@/types/finance'

export const bankConnections: BankConnection[] = [
  {
    id: 'bradesco',
    name: 'Bradesco',
    shortName: 'Bradesco',
    logoText: 'b',
    color: '#d7193f',
    balance: 18450.8,
    newTransactions: 2387,
    status: 'Sincronizado',
    mask: 'CPF *** *** *** - 00',
  },
  {
    id: 'nubank',
    name: 'Nubank',
    shortName: 'Nubank',
    logoText: 'nu',
    color: '#7c16dd',
    balance: 60500.56,
    newTransactions: 145,
    status: 'Sincronizado',
    mask: 'CPF *** *** *** - 00',
  },
  {
    id: 'itau',
    name: 'Itau',
    shortName: 'Itau',
    logoText: 'ita',
    color: '#ff6b00',
    balance: -126.48,
    newTransactions: 0,
    status: 'Sem novos lançamentos',
    mask: 'CPF *** *** *** - 00',
  },
  {
    id: 'caixa',
    name: 'Caixa Economica Federal',
    shortName: 'Caixa',
    logoText: 'cx',
    color: '#0879bd',
    balance: 1250,
    newTransactions: 32,
    status: 'Pendente',
    mask: 'CPF *** *** *** - 00',
  },
]

export const financeAccounts: FinanceAccount[] = [
  {
    id: 'nucash',
    bankId: 'nubank',
    name: 'Nucash',
    type: 'Conta corrente',
    amount: 60500.56,
    variation: 8.4,
  },
  {
    id: 'bradesco-carteira',
    bankId: 'bradesco',
    name: 'Carteira essencial',
    type: 'Conta corrente',
    amount: 18450.8,
    variation: 2.1,
  },
  {
    id: 'caixa-reserva',
    bankId: 'caixa',
    name: 'Reserva Caixa',
    type: 'Poupanca',
    amount: 1250,
    variation: 0.8,
  },
  {
    id: 'itau-cartao',
    bankId: 'itau',
    name: 'Cartao Itau',
    type: 'Credito',
    amount: -126.48,
    variation: -1.2,
  },
]

export const transactions: Transaction[] = [
  {
    id: 'trx-1',
    title: 'Salario',
    bank: 'Nubank',
    category: 'Receita',
    amount: 12400,
    date: 'Hoje',
    status: 'Confirmado',
  },
  {
    id: 'trx-2',
    title: 'Aluguel',
    bank: 'Bradesco',
    category: 'Moradia',
    amount: -3200,
    date: 'Amanha',
    status: 'Previsto',
  },
  {
    id: 'trx-3',
    title: 'ETF BOVA11',
    bank: 'Caixa',
    category: 'Investimento',
    amount: -1500,
    date: '27 jun',
    status: 'Confirmado',
  },
  {
    id: 'trx-4',
    title: 'Assinaturas',
    bank: 'Itau',
    category: 'Servicos',
    amount: -126.48,
    date: '25 jun',
    status: 'Confirmado',
  },
]

export const assets: AssetPosition[] = [
  {
    id: 'asset-1',
    name: 'Renda fixa',
    allocation: 46,
    amount: 38200,
    variation: 1.8,
    tone: '#17c964',
  },
  {
    id: 'asset-2',
    name: 'Acoes Brasil',
    allocation: 24,
    amount: 19840,
    variation: 3.4,
    tone: '#3b82f6',
  },
  {
    id: 'asset-3',
    name: 'Fundos',
    allocation: 18,
    amount: 14920,
    variation: -0.6,
    tone: '#f97316',
  },
  {
    id: 'asset-4',
    name: 'Cripto',
    allocation: 12,
    amount: 9820,
    variation: 5.1,
    tone: '#f52a55',
  },
]

export const monthlyFlow = [
  { label: 'Jan', income: 11.8, outcome: 7.2 },
  { label: 'Fev', income: 10.4, outcome: 6.4 },
  { label: 'Mar', income: 12.1, outcome: 7.9 },
  { label: 'Abr', income: 14.3, outcome: 8.1 },
  { label: 'Mai', income: 13.7, outcome: 8.8 },
  { label: 'Jun', income: 15.8, outcome: 9.4 },
]

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatPercent(value: number) {
  return `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })}%`
}
