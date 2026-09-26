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
    <div ref={scrollRef} className="chat-messages">
      {messages.map((m) =>
        m.kind === 'system' ? (
          <div key={m.id} className="text-center py-0.5">
            <span className="text-[11px] italic text-muted-foreground/80 bg-secondary/60 rounded-full px-2.5 py-0.5">
              {renderRichText(m.text)}
            </span>
          </div>
        ) : (
          <div key={m.id} className="chat-message">
            <span
              className="chat-avatar"
              style={{
                background: `hsl(${m.hue} 55% 22%)`,
                color: `hsl(${m.hue} 85% 68%)`,
              }}
            >
              {m.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="chat-bubble">
              <span
                className="text-[11px] font-bold mr-1.5"
                style={{ color: `hsl(${m.hue} 85% 68%)` }}
              >
                {m.name}
              </span>
              <time className="chat-time">{new Date(m.ts).toLocaleTimeString([], { hour12: false })}</time>
              <span className="chat-message-text">{renderRichText(m.text)}</span>
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
    <form onSubmit={send} className="chat-composer">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={user ? 'Your message…' : 'Login to chat'}
        disabled={!user}
        maxLength={160}
        className="h-9 text-xs"
      />
      <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!user || !text.trim()}>
        <Send className="h-5 w-5" /><span className="sr-only">Send message</span>
      </Button>
    </form>
  )
}

/** Desktop chat card */
export default function ChatPanel() {
  const online = useAppSelector(s => s.game.online)
  return (
    <Card className="chat-card">
      <CardHeader className="chat-heading">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <span className="chat-info" title="Live community chat">i</span>
          <span className="chat-online">Online: <b>{online.toLocaleString()}</b></span>
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
