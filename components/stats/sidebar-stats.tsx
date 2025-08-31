"use client"

import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function SidebarStats() {
  const { data } = useSWR("/api/stats", fetcher, { refreshInterval: 10000 })

  const sourcesCount = data?.sourcesCount ?? "—"
  const collectionsCount = data?.collections?.length ?? "—"
  const ingestionStatus: string = data?.ingestion?.status ?? "—"

  const dotClass =
    ingestionStatus === "—"
      ? "bg-muted"
      : ingestionStatus === "Up-to-date"
        ? "bg-emerald-500"
        : ingestionStatus === "Refreshing"
          ? "bg-amber-500"
          : "bg-rose-500"

  return (
    <nav className="p-2">
      <ul className="flex flex-col gap-1">
        <li>
          <button
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
            aria-label="All sources"
          >
            <span className="truncate">All Sources</span>
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
              {sourcesCount}
            </span>
          </button>
        </li>
        <li>
          <button className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted">
            <span className="truncate">Collections</span>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{collectionsCount}</span>
          </button>
        </li>
        <li>
          <button className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted">
            <span className="truncate">Ingestion</span>
            <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs">
              <span className={`size-2 rounded-full ${dotClass}`} aria-hidden />
              <span className="text-muted-foreground">{ingestionStatus}</span>
            </span>
          </button>
        </li>
        <li>
          <button className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted">
            <span className="truncate">Settings</span>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">—</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
