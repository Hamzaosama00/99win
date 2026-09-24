'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, MessageCircle, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { toggleChat } from '@/store/slices/chatSlice'
import { getSocket } from '@/lib/socket'
import { getToken } from '@/lib/api'
import type { ChatMsg } from '@/lib/types'
import { renderRichText } from '@/components/game/icons'

function MessageList() {
  const messages = useAppSelector((s) => s.chat.messages)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
      {messages.map((m) =>
        m.kind === 'system' ? (
          <div key={m.id} className="text-center py-0.5">
            <span className="text-[11px] italic text-muted-foreground/80 bg-secondary/60 rounded-full px-2.5 py-0.5">
              {renderRichText(m.text)}
            </span>
          </div>
        ) : (
          <div key={m.id} className="flex gap-2 items-start">
            <span
              className="mt-0.5 h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
              style={{
                background: `hsl(${m.hue} 55% 22%)`,
                color: `hsl(${m.hue} 85% 68%)`,
              }}
            >
              {m.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 leading-snug">
              <span
                className="text-[11px] font-bold mr-1.5"
                style={{ color: `hsl(${m.hue} 85% 68%)` }}
              >
                {m.name}
              </span>
              <span className="text-xs text-foreground/90 break-words">{renderRichText(m.text)}</span>
            </div>
          </div>
        )
      )}
    </div>
  )
}

function ChatComposer() {
  const [text, setText] = useState('')
  const user = useAppSelector((s) => s.auth.user)

  function send(e?: React.FormEvent) {
    e?.preventDefault()
    const t = text.trim()
    if (!t || !user) return
    getSocket(getToken()).emit('chat:send', { text: t })
    setText('')
  }

  return (
    <form onSubmit={send} className="flex gap-2 p-3 border-t border-border">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={user ? 'Say something…' : 'Login to chat'}
        disabled={!user}
        maxLength={180}
        className="h-9 text-xs"
      />
      <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!user || !text.trim()}>
        <Send className="h-4 w-4" />
      </Button>
    </form>
  )
}

/** Desktop chat card */
export default function ChatPanel() {
  return (
    <Card className="border-border/80 flex flex-col h-[420px]">
      <CardHeader className="py-3 px-4 border-b border-border">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          Live Chat
          <span className="ml-auto text-[10px] font-normal text-muted-foreground">
            500+ players online
          </span>
        </CardTitle>
      </CardHeader>
      <MessageList />
      <ChatComposer />
    </Card>
  )
}

/** Mobile chat slide-up drawer — trigger button lives in the top Header bar */
export function ChatMobile() {
  const dispatch = useAppDispatch()
  const open = useAppSelector((s) => s.chat.open)

  if (!open) return null

  return (
    <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => dispatch(toggleChat(false))}
          />
          <div className="relative h-[70vh] bg-card border-t border-border rounded-t-2xl flex flex-col animate-rise">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-bold text-sm flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" /> Live Chat
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => dispatch(toggleChat(false))}
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <MessageList />
            <ChatComposer />
          </div>
    </div>
  )
}
