"use client"

import { useState } from "react"
import AssistantPanel from "@/components/chat/assistant-panel"
import { FilesTable } from "@/components/files/files-table"
import { DocViewer } from "@/components/viewer/doc-viewer"

export default function ChatWithViewer() {
  const [docId, setDocId] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <div className="md:col-span-3 space-y-4">
        <AssistantPanel />
        <div className="rounded border p-3">
          <h3 className="font-medium mb-2">Files</h3>
          <FilesTable onSelect={setDocId} />
        </div>
      </div>
      <div className="md:col-span-2 space-y-4">
        <div className="rounded border p-3">
          <h3 className="font-medium mb-2">Document Viewer</h3>
          <DocViewer docId={docId} />
        </div>
      </div>
    </div>
  )
}
