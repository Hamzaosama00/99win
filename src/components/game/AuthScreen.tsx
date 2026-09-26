'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, Wallet, Zap, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { api, setToken } from '@/lib/api'
import { useAppDispatch } from '@/store/store'
import { setAuth } from '@/store/slices/authSlice'
import type { User } from '@/lib/types'

export default function AuthScreen() {
  const dispatch = useAppDispatch()
  const [loginPhone, setLoginPhone] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regName, setRegName] = useState('')
  const [regPass, setRegPass] = useState('')
  const [busy, setBusy] = useState<'login' | 'register' | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy('login')
    try {
      const d = await api<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone: loginPhone.trim(), password: loginPass }),
      })
      setToken(d.token)
      dispatch(setAuth({ user: d.user, token: d.token }))
      toast.success(`Welcome back, ${d.user.name}!`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy('register')
    try {
      const d = await api<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          phone: regPhone.trim(),
          name: regName.trim(),
          password: regPass,
        }),
      })
      setToken(d.token)
      dispatch(setAuth({ user: d.user, token: d.token }))
      toast.success('Account created — PKR 100 welcome bonus added!')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Brand side */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden lg:block"
        >
          <div className="flex items-center gap-3 mb-6">
            <img
              src="/99win-logo.svg"
              alt="99win logo"
              className="h-14 w-14 rounded-2xl shadow-[0_0_40px_rgba(232,17,75,0.5)]"
            />
            <div>
              <h1 className="text-4xl font-black tracking-tight">
                99<span className="text-primary">win</span>
              </h1>
              <p className="text-xs text-muted-foreground tracking-[0.3em] uppercase">
                Aviator · Crash Game
              </p>
            </div>
          </div>
          <h2 className="text-3xl font-bold leading-tight mb-3">
            Fly high. <span className="text-gold">Cash out</span> before the plane
            flies away.
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md">
            Real-time multiplayer crash game with live bets, instant cashouts and
            a secure wallet. Watch the multiplier climb — jump out in time.
          </p>
          <ul className="space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <span className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4 text-gold" />
              </span>
              <div>
                <p className="font-semibold">Instant rounds</p>
                <p className="text-muted-foreground">New flight every few seconds, 24/7.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <Wallet className="h-4 w-4 text-gold" />
              </span>
              <div>
                <p className="font-semibold">Cashback up to 20%</p>
                <p className="text-muted-foreground">
                  Deposit PKR 1000+ and earn tiered cashback automatically.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4 text-gold" />
              </span>
              <div>
                <p className="font-semibold">Secure wallet</p>
                <p className="text-muted-foreground">
                  All balances are processed server-side. Easypaisa supported.
                </p>
              </div>
            </li>
          </ul>
        </motion.div>

        {/* Form side */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="border-border/80 shadow-2xl">
            <CardContent className="p-6">
              <div className="lg:hidden flex items-center gap-2.5 mb-5">
                <img
                  src="/99win-logo.svg"
                  alt="99win logo"
                  className="h-10 w-10 rounded-xl"
                />
                <h1 className="text-2xl font-black">
                  99<span className="text-primary">win</span>
                </h1>
              </div>

              <Tabs defaultValue="login">
                <TabsList className="grid grid-cols-2 w-full mb-5">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="login-phone">Phone number</Label>
                      <Input
                        id="login-phone"
                        inputMode="numeric"
                        placeholder="03XX XXXXXXX"
                        value={loginPhone}
                        onChange={(e) => setLoginPhone(e.target.value.replace(/[^0-9]/g, ''))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="login-pass">Password</Label>
                      <Input
                        id="login-pass"
                        type="password"
                        placeholder="••••••"
                        value={loginPass}
                        onChange={(e) => setLoginPass(e.target.value)}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={busy === 'login'}
                      className="w-full h-11 font-bold btn-shine"
                    >
                      {busy === 'login' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Login & Play'
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-phone">Phone number</Label>
                      <Input
                        id="reg-phone"
                        inputMode="numeric"
                        placeholder="03XX XXXXXXX"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value.replace(/[^0-9]/g, ''))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-name">Display name</Label>
                      <Input
                        id="reg-name"
                        placeholder="e.g. AliKhan786"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-pass">Password</Label>
                      <Input
                        id="reg-pass"
                        type="password"
                        placeholder="Create a password (min 4 chars)"
                        value={regPass}
                        onChange={(e) => setRegPass(e.target.value)}
                        required
                      />
                    </div>
                    <div className="rounded-lg bg-gold/10 border border-gold/25 px-3 py-2 text-xs text-gold flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 shrink-0" />
                      Get PKR 100 welcome bonus instantly on signup. An approved deposit is required before withdrawing.
                    </div>
                    <Button
                      type="submit"
                      disabled={busy === 'register'}
                      className="w-full h-11 font-bold btn-shine"
                    >
                      {busy === 'register' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Create Account'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
