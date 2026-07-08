export type AccessGoal =
  | 'Organizar fluxo mensal'
  | 'Unificar bancos'
  | 'Acompanhar investimentos'
  | 'Preparar imposto de renda'

export interface UserProfile {
  id: string
  name: string
  email: string
  goal: AccessGoal
  monthlyIncome: number
  createdAt: string
  avatarUrl?: string
  /** Pluggy item IDs connected by this user via the Pluggy widget. */
  pluggyItemIds?: string[]
}

/** Indicates where dashboard data is coming from. */
export type DataSource = 'mock' | 'manual' | 'pluggy' | 'dataconnect'

export type AppTheme = 'dark' | 'light'
export type AppLanguage = 'pt-BR' | 'en-US' | 'es-ES'

export interface BankConnection {
  id: string
  name: string
  shortName: string
  logoText: string
  color: string
  balance: number
  newTransactions: number
  status: 'Sincronizado' | 'Pendente' | 'Sem novos lançamentos'
  mask: string
}

export interface FinanceAccount {
  id: string
  bankId: string
  name: string
  type: string
  amount: number
  variation: number
}

export interface Transaction {
  id: string
  title: string
  bank: string
  category: string
  amount: number
  date: string
  status: 'Confirmado' | 'Previsto'
}

export interface AssetPosition {
  id: string
  name: string
  allocation: number
  amount: number
  variation: number
  tone: string
}
