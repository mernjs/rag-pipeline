"use client"

import type React from "react"

import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

function inferTypeFromNameOrMime(file: File | null): string {
  if (!file) return "text"
  const ext = (file.name.split(".").pop() || "").toLowerCase()
  const t = file.type
  if (t.includes("pdf") || ext === "pdf") return "pdf"
  if (t.includes("word") || ext === "docx") return "docx"
  if (t.includes("presentation") || ext === "pptx") return "pptx"
  if (t.includes("sheet") || ext === "xlsx") return "xlsx"
  if (t.includes("csv") || ext === "csv") return "csv"
  if (t.includes("markdown") || ext === "md") return "markdown"
  if (t.includes("html") || ext === "html" || ext === "htm") return "html"
  if (t.startsWith("text/")) return "text"
  return "text"
}

export default function UploadPanel() {
  const [pending, setPending] = useState(false)
  const [title, setTitle] = useState("")
  const [collection, setCollection] = useState("default")
  const [type, setType] = useState("text")
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const { toast } = useToast()

  async function onUpload(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    try {
      let res: Response
      if (file) {
        const fd = new FormData()
        fd.append("title", title || file.name)
        fd.append("collection", collection)
        fd.append("type", type)
        fd.append("file", file)
        res = await fetch("/api/upload", { method: "POST", body: fd })
      } else {
        res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            collection,
            type,
            text,
          }),
        })
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}) as any)
        throw new Error(err.error || "Upload failed")
      }
      const data = await res.json()
      toast({ title: "Uploaded", description: `Saved ${data.chunks} chunk(s).` })
      setText("")
      setFile(null)
      setTitle("")
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid gap-4 p-4 md:grid-cols-2">
      <div className="rounded-md border border-dashed border-border p-6 text-center">
        <label className="block cursor-pointer text-sm text-muted-foreground">
          <input
            type="file"
            accept=".txt,.md,.markdown,.csv,.xlsx,.xls,.docx,.pptx,.pdf,.html,.htm,text/plain,text/markdown,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf,text/html"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              setFile(f)
              if (f) setType(inferTypeFromNameOrMime(f))
            }}
          />
          {file ? (
            <span className="text-foreground">
              Selected: {file.name} <span className="text-muted-foreground">({inferTypeFromNameOrMime(file)})</span>
            </span>
          ) : (
            "Drag and drop files here, or click to browse"
          )}
        </label>
        <p className="mt-2 text-xs text-muted-foreground">Supported: TXT, MD, CSV, XLSX, DOCX, PPTX, PDF, HTML</p>
      </div>
      <form className="space-y-3" onSubmit={onUpload}>
        <div className="flex items-center justify-between">
          <span className="text-sm">Pipeline Status</span>
          <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
            {pending ? "Processing…" : "Idle"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required={!file}
          />
          <input
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            placeholder="Collection"
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="text">Text</option>
            <option value="markdown">Markdown</option>
            <option value="csv">CSV</option>
            <option value="xlsx">Excel (XLSX)</option>
            <option value="docx">Word (DOCX)</option>
            <option value="pptx">PowerPoint (PPTX)</option>
            <option value="html">HTML</option>
            <option value="pdf">PDF (experimental)</option>
          </select>
          <button
            type="submit"
            disabled={pending || (!file && !text.trim())}
            className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Uploading…" : "Ingest"}
          </button>
        </div>
        <textarea
          rows={5}
          placeholder="Or paste text here to ingest…"
          className="w-full rounded-md border border-border bg-background p-2 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li>• Chunking: paragraph/sentence with ~1200 char max</li>
          <li>• Embeddings: text-embedding-3-large</li>
          <li>• Retrieval: cosine similarity, top-k</li>
          <li>• PDF parsing is experimental in preview; DOCX/MD/TXT/CSV/XLSX are most reliable.</li>
        </ul>
      </form>
    </div>
  )
}
