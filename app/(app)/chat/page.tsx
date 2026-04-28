"use client"

import { useEffect, useRef, useState } from "react"
import { Send, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type Role = "user" | "assistant"

type ChatMessage = {
  id: string
  role: Role
  text: string
  toolsUsed: string[]
}

const TOOL_LABELS: Record<string, string> = {
  get_current_month_summary: "Reviewing this month's budget",
  get_spending_by_category: "Looking up category spending",
  list_recent_transactions: "Fetching recent transactions",
  search_transactions: "Searching transactions",
  get_account_balances: "Checking account balances",
}

const SUGGESTIONS = [
  "How am I doing on my budget this month?",
  "What did I spend on groceries this month?",
  "Show me my biggest purchases this week",
  "What's my net worth right now?",
]

function newId() {
  return Math.random().toString(36).slice(2)
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, busy])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setError(null)
    setInput("")

    const userMsg: ChatMessage = { id: newId(), role: "user", text: trimmed, toolsUsed: [] }
    const assistantMsg: ChatMessage = { id: newId(), role: "assistant", text: "", toolsUsed: [] }
    const nextMessages = [...messages, userMsg, assistantMsg]
    setMessages(nextMessages)
    setBusy(true)

    const apiMessages = nextMessages
      .filter((m) => m.id !== assistantMsg.id)
      .map((m) => ({ role: m.role, content: m.text }))

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(errBody.error ?? `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split("\n\n")
        buffer = events.pop() ?? ""
        for (const evt of events) {
          const line = evt.split("\n").find((l) => l.startsWith("data: "))
          if (!line) continue
          const payload = JSON.parse(line.slice(6))
          if (payload.type === "text") {
            setMessages((curr) =>
              curr.map((m) => (m.id === assistantMsg.id ? { ...m, text: m.text + payload.text } : m)),
            )
          } else if (payload.type === "tool_use") {
            setMessages((curr) =>
              curr.map((m) =>
                m.id === assistantMsg.id ? { ...m, toolsUsed: [...m.toolsUsed, payload.name] } : m,
              ),
            )
          } else if (payload.type === "error") {
            throw new Error(payload.message)
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong"
      setError(msg)
      setMessages((curr) => curr.filter((m) => m.id !== assistantMsg.id))
    } finally {
      setBusy(false)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 pt-6 pb-4">
        <div className="container mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-6 pt-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold">Ask Bloom</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ask questions about your budget, spending, and progress.
                </p>
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-lg border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {m.role === "assistant" && m.toolsUsed.length > 0 && (
                  <div className="mb-1.5 space-y-0.5 text-xs text-muted-foreground">
                    {m.toolsUsed.map((name, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="inline-block h-1 w-1 rounded-full bg-current" />
                        {TOOL_LABELS[name] ?? name}
                      </div>
                    ))}
                  </div>
                )}
                {m.text || (m.role === "assistant" && busy ? "…" : "")}
              </div>
            </div>
          ))}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-background px-4 py-3 pb-[max(env(safe-area-inset-bottom,0px),12px)] md:pb-3">
        <div className="container mx-auto flex max-w-2xl items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about your budget…"
            rows={1}
            className="min-h-[44px] max-h-32 resize-none"
            disabled={busy}
          />
          <Button onClick={() => send(input)} disabled={busy || !input.trim()} size="icon" className="h-11 w-11 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
