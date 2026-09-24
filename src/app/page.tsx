'use client'

import { Provider } from 'react-redux'
import { getStore } from '@/store/store'
import GameRoot from '@/components/game/GameRoot'

export default function Page() {
  return (
    <Provider store={getStore()}>
      <GameRoot />
    </Provider>
  )
}
