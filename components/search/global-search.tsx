"use client"

import type React from "react"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"

export default function GlobalSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initial = searchParams.get("q") ?? ""
  const [q, setQ] = useState(initial)

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const sp = new URLSearchParams(Array.from(searchParams.entries()))
      if (q) sp.set("q", q)
      else sp.delete("q")
      router.replace(`?${sp.toString()}`)
    },
    [q, router, searchParams],
  )

  return (
    <form className="w-full max-w-xl" onSubmit={onSubmit}>
      <label htmlFor="global-search" className="sr-only">
        Global search
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-5 shrink-0 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          id="global-search"
          name="q"
          placeholder="Search Knowledge Hub..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Search Knowledge Hub"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <kbd className="hidden rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground md:block">⌘K</kbd>
      </div>
    </form>
  )
}
