"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"

type Msg = { id: string; role: "user" | "assistant"; content: string }

export default function AssistantPanel() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const content = input.trim()
    if (!content || isLoading) return

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content }
    const assistantMsg: Msg = { id: crypto.randomUUID(), role: "assistant", content: "" }
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })),
        }),
      })
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `Request failed with ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let done = false

      while (!done) {
        const { value, done: d } = await reader.read()
        done = d
        if (value) {
          const chunk = decoder.decode(value, { stream: true })
          setMessages((prev) => {
            const next = [...prev]
            const idx = next.findIndex((m) => m.id === assistantMsg.id)
            if (idx !== -1) {
              next[idx] = { ...next[idx], content: next[idx].content + chunk }
            }
            return next
          })
        }
      }
    } catch (_err) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: "Sorry, something went wrong." },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-[420px] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Ask a question about your knowledge base and get cited answers.
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex flex-col items-start gap-2">
              <div
                className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
                }`}
                aria-live={m.role === "assistant" ? "polite" : undefined}
              >
                <MessageContent content={m.content} />
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <form className="border-t border-border p-3" onSubmit={onSubmit}>
        <label htmlFor="assistant-input" className="sr-only">
          Ask the assistant
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <textarea
            id="assistant-input"
            rows={1}
            placeholder="Ask a question and cite sources..."
            className="max-h-32 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs text-accent-foreground hover:opacity-90 disabled:opacity-50"
            aria-label="Send message"
          >
            {isLoading ? "Sending…" : "Send"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Tip: Highlight text in results to “Ask about selection”.</p>
      </form>
    </div>
  )
}

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/\n{2,}/)
  return (
    <div className="space-y-2">
      {parts.map((p, i) => {
        if (p.trim().toLowerCase().startsWith("sources:")) {
          return (
            <div key={i} className="rounded-md bg-background/30 p-2 text-xs">
              <div className="mb-1 font-medium">Sources</div>
              <div className="space-y-1">
                {p
                  .split("\n")
                  .slice(1)
                  .filter(Boolean)
                  .map((line, li) => (
                    <div key={li}>{line}</div>
                  ))}
              </div>
            </div>
          )
        }
        return <p key={i}>{p}</p>
      })}
    </div>
  )
}
