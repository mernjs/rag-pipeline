"use client"

import useSWR from "swr"
import { useState } from "react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function SettingsPanel() {
  const { data, mutate } = useSWR<{ settings: any }>("/api/settings", fetcher)
  const [saving, setSaving] = useState(false)
  const s = data?.settings || { chunkSize: 800, overlap: 200, embeddingModel: "text-embedding-3-small" }

  async function save(patch: any) {
    setSaving(true)
    await fetch("/api/settings", { method: "PUT", body: JSON.stringify(patch) })
    await mutate()
    setSaving(false)
  }

  return (
    <div className="rounded border p-4 space-y-4">
      <h3 className="font-medium">Configure Pipeline</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Chunk Size</label>
          <input
            type="number"
            className="w-full border rounded px-2 py-1 bg-background"
            defaultValue={s.chunkSize}
            min={100}
            step={50}
            onBlur={(e) => save({ chunkSize: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Overlap</label>
          <input
            type="number"
            className="w-full border rounded px-2 py-1 bg-background"
            defaultValue={s.overlap}
            min={0}
            step={20}
            onBlur={(e) => save({ overlap: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Embedding Model</label>
          <select
            className="w-full border rounded px-2 py-1 bg-background"
            defaultValue={s.embeddingModel}
            onChange={(e) => save({ embeddingModel: e.target.value })}
          >
            <option value="text-embedding-3-small">text-embedding-3-small</option>
            <option value="text-embedding-3-large">text-embedding-3-large</option>
          </select>
        </div>
      </div>
      {saving && <p className="text-sm text-muted-foreground">Saving…</p>}
    </div>
  )
}
