'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
  Plus, Wallet, ShieldCheck, LogOut, User as UserIcon, Wifi, WifiOff,
  MessageCircle, Menu,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { clearAuth } from '@/store/slices/authSlice'
import { openModal, setView, resetUser } from '@/store/slices/uiSlice'
import { toggleChat } from '@/store/slices/chatSlice'
import { closeSocket } from '@/lib/socket'
import { setToken } from '@/lib/api'
import { formatMoney } from '@/lib/money'

export default function Header() {
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)
  const connected = useAppSelector((s) => s.game.connected)
  const online = useAppSelector((s) => s.game.online)
  const balance = user?.balance ?? 0

  function logout() {
    setToken(null)
    closeSocket()
    dispatch(clearAuth())
    dispatch(resetUser())
  }

  return (
    <header className="game-header">
      <div className="game-header-inner">
        {/* logo */}
        <button
          onClick={() => dispatch(setView('game'))}
          className="flex items-center gap-2 mr-auto group"
          aria-label="99win home"
        >
          <span className="aviator-wordmark">Aviator</span>
        </button>

        {/* presence */}
        <div className="connection-status">
          {connected ? (
            <Wifi className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-destructive" />
          )}
          <span className="font-tabular">{online.toLocaleString()} online</span>
        </div>

        {/* balance */}
        <div className="header-wallet">
          <motion.span
            key={balance}
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
            className="header-balance font-tabular"
          >
            {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <small>PKR</small>
          </motion.span>
          <Button
            size="icon"
            onClick={() => dispatch(openModal('deposit'))}
            className="h-8 w-8 rounded-lg bg-green-600 hover:bg-green-500 text-white"
            aria-label="Deposit"
          >
            <Plus className="h-4 w-4 font-black" />
          </Button>
        </div>

        {/* chat toggle — top bar, between balance+ and profile pic (mobile) */}
        <button
          onClick={() => dispatch(toggleChat(true))}
          className="lg:hidden h-10 w-10 rounded-xl bg-secondary border border-border flex items-center justify-center hover:bg-accent transition-colors relative"
          aria-label="Open chat"
        >
          <MessageCircle className="h-5 w-5 text-primary" />
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
        </button>

        {/* profile menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-10 w-10 rounded-xl bg-secondary border border-border flex items-center justify-center font-bold text-sm uppercase hover:bg-accent transition-colors"
              style={{
                color: `hsl(${(user!.name.length * 47) % 360}, 70%, 62%)`,
              }}
              aria-label="Menu"
            >
              <Menu className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <div className="font-semibold">{user!.name}</div>
              <div className="text-xs text-muted-foreground font-normal">
                {user!.phone.replace(/(\d{4})\d+(\d{3})/, '$1****$2')}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => dispatch(openModal('deposit'))}><Plus className="h-4 w-4 mr-2" /> Deposit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => dispatch(openModal('withdraw'))}><Wallet className="h-4 w-4 mr-2" /> Withdraw</DropdownMenuItem>
            <DropdownMenuItem onClick={() => dispatch(openModal('wallet'))}>
              <Wallet className="h-4 w-4 mr-2" /> My Wallet
            </DropdownMenuItem>
            {user!.role === 'ADMIN' && (
              <DropdownMenuItem onClick={() => dispatch(setView('admin'))}>
                <ShieldCheck className="h-4 w-4 mr-2 text-gold" /> Admin Panel
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
