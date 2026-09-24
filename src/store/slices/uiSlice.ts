import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { BetRow, Tx } from '@/lib/types'

export type ModalName = 'deposit' | 'withdraw' | 'wallet' | null

export type ViewName = 'game' | 'admin' | 'signals'

interface UiState {
  view: ViewName
  modal: ModalName
  myBets: BetRow[]
  transactions: Tx[]
}

const initialState: UiState = {
  view: 'game',
  modal: null,
  myBets: [],
  transactions: [],
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setView(state, action: PayloadAction<ViewName>) {
      state.view = action.payload
    },
    openModal(state, action: PayloadAction<Exclude<ModalName, null>>) {
      state.modal = action.payload
    },
    closeModal(state) {
      state.modal = null
    },
    setMyBets(state, action: PayloadAction<BetRow[]>) {
      state.myBets = action.payload
    },
    setTransactions(state, action: PayloadAction<Tx[]>) {
      state.transactions = action.payload
    },
    resetUser() {
      return initialState
    },
  },
})

export const {
  setView, openModal, closeModal, setMyBets, setTransactions, resetUser,
} = uiSlice.actions
export default uiSlice.reducer
