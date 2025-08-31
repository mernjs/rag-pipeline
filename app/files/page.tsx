"use client"

import { useState } from "react"
import { FilesTable } from "@/components/files/files-table"
import { DocViewer } from "@/components/viewer/doc-viewer"

export default function Page() {
  const [docId, setDocId] = useState<string | null>(null)
  return (
    <main className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Files</h1>
      <FilesTable onSelect={setDocId} />
      <div className="rounded border p-4">
        <h3 className="font-medium mb-3">Preview</h3>
        <DocViewer docId={docId} />
      </div>
    </main>
  )
}
