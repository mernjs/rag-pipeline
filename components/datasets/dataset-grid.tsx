"use client"

import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function DatasetGrid() {
  const { data } = useSWR("/api/stats", fetcher, { refreshInterval: 15000 })
  const datasets: Array<{ name: string; ver: string; status: string; color: string }> = data?.datasets || []

  if (!data) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-md border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-5 w-12 animate-pulse rounded bg-muted" />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="size-2 rounded-full bg-muted" aria-hidden />
              <span className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {datasets.map((d) => (
        <div key={d.name} className="rounded-md border border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">{d.name}</h3>
            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{d.ver}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`size-2 rounded-full ${d.color}`} aria-hidden />
            <span className="text-muted-foreground">{d.status}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
