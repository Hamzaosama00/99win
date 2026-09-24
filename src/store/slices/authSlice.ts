import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { User } from '@/lib/types'

interface AuthState {
  user: User | null
  token: string | null
  status: 'idle' | 'loading' | 'ready'
}

const initialState: AuthState = {
  user: null,
  token: null,
  status: 'idle',
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authLoading(state) {
      state.status = 'loading'
    },
    setAuth(state, action: PayloadAction<{ user: User; token: string }>) {
      state.user = action.payload.user
      state.token = action.payload.token
      state.status = 'ready'
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload
      state.status = 'ready'
    },
    patchWallet(
      state,
      action: PayloadAction<{ balance?: number; totalWin?: number; totalLoss?: number }>
    ) {
      if (!state.user) return
      const { balance, totalWin, totalLoss } = action.payload
      if (typeof balance === 'number') state.user.balance = balance
      if (typeof totalWin === 'number') state.user.totalWin = totalWin
      if (typeof totalLoss === 'number') state.user.totalLoss = totalLoss
    },
    clearAuth(state) {
      state.user = null
      state.token = null
      state.status = 'idle'
    },
  },
})

export const { authLoading, setAuth, setUser, patchWallet, clearAuth } =
  authSlice.actions
export default authSlice.reducer
