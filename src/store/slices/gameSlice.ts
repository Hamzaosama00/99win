import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { Phase, PublicBet, MyBet, LeaderRow } from '@/lib/types'

export interface GameState {
  connected: boolean
  online: number
  roundId: number
  phase: Phase | null
  endsAt: number | null
  startedAt: number | null
  history: number[]
  bets: PublicBet[]
  myBets: MyBet[]
  leaderboard: LeaderRow[]
  lastGlobalCrash: number | null
}

const initialState: GameState = {
  connected: false,
  online: 0,
  roundId: 0,
  phase: null,
  endsAt: null,
  startedAt: null,
  history: [],
  bets: [],
  myBets: [],
  leaderboard: [],
  lastGlobalCrash: null,
}

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setConnected(state, action: PayloadAction<boolean>) {
      state.connected = action.payload
    },
    setPresence(state, action: PayloadAction<number>) {
      state.online = action.payload
    },
    applyState(
      state,
      action: PayloadAction<{
        roundId: number
        phase: Phase
        endsAt: number | null
        startedAt: number | null
        multiplier: number | null
        history: number[]
        bets: PublicBet[]
        leaderboard: LeaderRow[]
        onlineCount: number
        myBets: MyBet[]
      }>
    ) {
      state.roundId = action.payload.roundId
      state.phase = action.payload.phase
      state.endsAt = action.payload.endsAt
      state.startedAt = action.payload.startedAt
      state.history = action.payload.history
      state.bets = action.payload.bets
      state.leaderboard = action.payload.leaderboard
      state.online = action.payload.onlineCount
      state.myBets = action.payload.myBets ?? []
    },
    gameWaiting(
      state,
      action: PayloadAction<{ roundId: number; endsAt: number; history: number[] }>
    ) {
      state.roundId = action.payload.roundId
      state.phase = 'WAITING'
      state.endsAt = action.payload.endsAt
      state.startedAt = null
      state.history = action.payload.history
      state.bets = []
      state.myBets = []
    },
    gameStarted(
      state,
      action: PayloadAction<{ roundId: number; startedAt: number }>
    ) {
      state.roundId = action.payload.roundId
      state.phase = 'FLYING'
      state.startedAt = action.payload.startedAt
      state.endsAt = null
    },
    gameEnded(
      state,
      action: PayloadAction<{ roundId: number; crashPoint: number }>
    ) {
      state.phase = 'ENDED'
      state.lastGlobalCrash = action.payload.crashPoint
      if (
        !state.history.length ||
        state.history[0] !== action.payload.crashPoint
      ) {
        state.history.unshift(action.payload.crashPoint)
        if (state.history.length > 25) state.history.length = 25
      }
    },
    betsAdd(state, action: PayloadAction<PublicBet>) {
      state.bets.push(action.payload)
    },
    betsUpdate(
      state,
      action: PayloadAction<{
        betId: string
        status: 'WON' | 'LOST'
        multiplier?: number
        win?: number
      }>
    ) {
      const b = state.bets.find((x) => x.betId === action.payload.betId)
      if (b) {
        b.status = action.payload.status
        if (action.payload.multiplier != null) b.cashoutM = action.payload.multiplier
        if (action.payload.win != null) b.win = action.payload.win
      }
    },
    betsRemove(state, action: PayloadAction<string>) {
      state.bets = state.bets.filter((b) => b.betId !== action.payload)
    },
    betAccepted(state, action: PayloadAction<{ bet: MyBet }>) {
      state.myBets = state.myBets.filter(b => b.slot !== action.payload.bet.slot)
      state.myBets.push(action.payload.bet)
    },
    betCancelled(state, action: PayloadAction<number>) {
      state.myBets = state.myBets.filter(b => b.slot !== action.payload)
    },
    myBetResolved(
      state,
      action: PayloadAction<{ betId: string; status: 'WON' | 'LOST'; cashoutM?: number; win?: number }>
    ) {
      const bet = state.myBets.find(b => b.betId === action.payload.betId)
      if (bet) {
        bet.status = action.payload.status
        if (action.payload.cashoutM != null) bet.cashoutM = action.payload.cashoutM
        if (action.payload.win != null) bet.win = action.payload.win
      }
    },
    setLeaderboard(state, action: PayloadAction<LeaderRow[]>) {
      state.leaderboard = action.payload
    },
  },
})

export const {
  setConnected, setPresence, applyState, gameWaiting, gameStarted, gameEnded,
  betsAdd, betsUpdate, betsRemove, betAccepted, betCancelled, myBetResolved,
  setLeaderboard,
} = gameSlice.actions
export default gameSlice.reducer
