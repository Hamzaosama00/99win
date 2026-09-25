// Quick socket test for the 99win game service
import { io } from 'socket.io-client'

const socket = io('http://localhost:3003', { path: '/socket.io/', transports: ['websocket'] })

socket.on('connect', () => console.log('✓ connected', socket.id))
socket.on('game:state', (s: any) => {
  console.log('✓ game:state →', {
    phase: s.phase,
    roundId: s.roundId,
    history: s.history?.slice(0, 5),
    betsCount: s.bets?.length,
    online: s.onlineCount,
  })
})
socket.on('game:waiting', (d: any) => console.log('✓ game:waiting round', d.roundId))
socket.on('game:started', (d: any) => console.log('✓ game:started round', d.roundId))
socket.on('game:tick', (d: any) => {
  if (Math.floor(d.tMs / 1000) !== Math.floor((d.tMs - 100) / 1000) || d.tMs < 300)
    console.log('  tick t=', d.tMs, 'm=', d.m)
})
socket.on('game:ended', (d: any) => console.log('✓ game:ended crash =', d.crashPoint))
socket.on('bets:add', (d: any) => console.log('  bot bet:', d.name, '₹' + d.amount))
socket.on('bets:update', (d: any) =>
  console.log('  bet update:', d.betId.slice(0, 18), d.status, d.multiplier ?? '', d.win ?? '')
)
socket.on('chat:message', (d: any) => {
  console.log('  chat:', d.kind, d.name + ':', d.text)
})
socket.on('presence:update', (d: any) => console.log('  presence:', d.online))

setTimeout(() => {
  console.log('--- test done ---')
  process.exit(0)
}, 14000)
