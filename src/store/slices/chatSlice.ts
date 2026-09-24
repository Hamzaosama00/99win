import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { ChatMsg } from '@/lib/types'

interface ChatState {
  messages: ChatMsg[]
  open: boolean // mobile drawer
}

const initialState: ChatState = {
  messages: [],
  open: false,
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    chatMessage(state, action: PayloadAction<ChatMsg>) {
      const last = state.messages[state.messages.length - 1]
      if (last && last.id === action.payload.id) return
      state.messages.push(action.payload)
      if (state.messages.length > 120) state.messages.shift()
    },
    chatHistory(state, action: PayloadAction<ChatMsg[]>) {
      state.messages = action.payload
    },
    toggleChat(state, action: PayloadAction<boolean | undefined>) {
      state.open = action.payload ?? !state.open
    },
  },
})

export const { chatMessage, chatHistory, toggleChat } = chatSlice.actions
export default chatSlice.reducer
