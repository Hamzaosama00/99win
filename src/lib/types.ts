/** 99win — shared client types */

export interface User {
  id: string
  phone: string
  name: string
  role: 'USER' | 'ADMIN' | string
  balance: number
  totalDeposit: number
  totalWin: number
  totalLoss: number
  cashbackEarned: number
  createdAt: string
}

export type Phase = 'WAITING' | 'FLYING' | 'ENDED'

export interface PublicBet {
  betId: string
  name: string
  hue: number
  amount: number
  status: 'ACTIVE' | 'WON' | 'LOST'
  cashoutM: number | null
  win: number | null
  isBot: boolean
}

export interface MyBet {
  slot: number
  betId: string
  amount: number
  autoCashout: number | null
  status: 'ACTIVE' | 'WON' | 'LOST'
  cashoutM: number | null
  win: number | null
}

export interface ChatMsg {
  id: string
  name: string
  hue: number
  text: string
  ts: number
  kind: 'user' | 'bot' | 'system'
}

export interface LeaderRow {
  name: string
  hue: number
  multiplier: number
  win: number
  ts: number
}

export interface Tx {
  id: string
  type: 'DEPOSIT' | 'WITHDRAW' | 'CASHBACK' | 'BONUS' | string
  amount: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED' | string
  method?: string | null
  txnId?: string | null
  account?: string | null
  note?: string | null
  createdAt: string
  processedAt?: string | null
}

export interface BetRow {
  id: string
  roundId: number
  amount: number
  crashPoint: number
  cashedOutAt: number | null
  winAmount: number | null
  status: 'ACTIVE' | 'CASHED_OUT' | 'CRASHED' | 'CANCELLED' | string
  createdAt: string
}

export interface AdminUser {
  status: string
  online: boolean
  lastSeenAt: string | null
  id: string
  phone: string
  name: string
  role: string
  balance: number
  totalDeposit: number
  totalWin: number
  totalLoss: number
  cashbackEarned: number
  createdAt: string
  betsCount: number
  wagered: number
  paidOut: number
}

export interface AdminTx extends Tx {
  user: { id: string; phone: string; name: string; balance: number }
}

export interface AdminStats {
  users: number
  pendingDeposits: number
  pendingWithdrawals: number
  totalDeposited: number
  totalWithdrawn: number
  totalBets: number
  wagered: number
  paidOut: number
  houseProfit: number
}
