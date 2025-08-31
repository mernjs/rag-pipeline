"use client"

import useSWR from "swr"
import { useSearchParams } from "next/navigation"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function highlight(text: string, q: string) {
  if (!q) return text
  try {
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")})`, "ig")
    return text.split(re).map((part, i) =>
      re.test(part) ? (
        <mark key={i} className="bg-secondary/20 text-foreground">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      ),
    )
  } catch {
    return text
  }
}

export default function SearchResults() {
  const params = useSearchParams()
  const q = params.get("q") ?? ""
  const { data, isLoading } = useSWR(q ? `/api/search?q=${encodeURIComponent(q)}` : null, fetcher)

  if (!q) {
    return (
      <div className="p-4">
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No results yet. Try searching or asking the assistant on the right.
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Active facets:</span>
          <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">—</span>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Searching “{q}”…
        </div>
      </div>
    )
  }

  const results = data?.results ?? []

  return (
    <div className="p-4">
      {results.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No matches for “{q}”.
        </div>
      ) : (
        <ul className="space-y-3">
          {results.map((r: any) => (
            <li key={r.chunkId} className="rounded-md border border-border p-3">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-sm font-medium">{r.title}</div>
                <div className="flex items-center gap-2">
                  {r.collection && (
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{r.collection}</span>
                  )}
                  {r.type && (
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{r.type}</span>
                  )}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">{highlight(r.text, q)}</div>
              <div className="mt-2 text-[11px] text-muted-foreground">Score: {r.score.toFixed(3)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
