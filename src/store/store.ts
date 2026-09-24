'use client'

import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux'
import auth from './slices/authSlice'
import game from './slices/gameSlice'
import chat from './slices/chatSlice'
import ui from './slices/uiSlice'

export const makeStore = () =>
  configureStore({
    reducer: { auth, game, chat, ui },
  })

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']

// singleton for the SPA
let clientStore: AppStore | undefined

export function getStore(): AppStore {
  if (!clientStore) clientStore = makeStore()
  return clientStore
}

export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
