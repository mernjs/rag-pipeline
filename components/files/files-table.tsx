"use client"

import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function FilesTable({ onSelect }: { onSelect?: (id: string) => void }) {
  const { data, isLoading, error } = useSWR<{ items: any[] }>("/api/files", fetcher)

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading files…</div>
  if (error) return <div className="text-sm text-red-500">Failed to load files.</div>

  const items = data?.items || []

  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="py-2 px-3 text-left">Name</th>
            <th className="py-2 px-3 text-left">Type</th>
            <th className="py-2 px-3 text-left">Collection</th>
            <th className="py-2 px-3 text-left">Chunks</th>
            <th className="py-2 px-3 text-left">Version</th>
            <th className="py-2 px-3 text-left">Uploaded</th>
            <th className="py-2 px-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t">
              <td className="py-2 px-3">{it.title}</td>
              <td className="py-2 px-3">{it.type}</td>
              <td className="py-2 px-3">{it.collection}</td>
              <td className="py-2 px-3">{it.chunks}</td>
              <td className="py-2 px-3">{it.version}</td>
              <td className="py-2 px-3">{new Date(it.createdAt).toLocaleString()}</td>
              <td className="py-2 px-3">
                <button className="text-primary hover:underline" onClick={() => onSelect?.(it.id)}>
                  View
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={7} className="py-6 px-3 text-center text-muted-foreground">
                No files uploaded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
