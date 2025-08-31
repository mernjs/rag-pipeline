"use client"

import useSWR from "swr"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function DocViewer({ docId }: { docId?: string | null }) {
  const { data, isLoading } = useSWR(docId ? `/api/files/${docId}` : null, fetcher)

  if (!docId) return <div className="text-sm text-muted-foreground">Select a document to preview.</div>
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>
  const item = data?.item
  if (!item) return <div className="text-sm text-red-500">Document not found.</div>

  const isMarkdown = /(?:readme\.md$|\.md$)/i.test(item.name || item.title)

  return (
    <div className="prose max-w-none dark:prose-invert">
      {isMarkdown ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.text || ""}</ReactMarkdown>
      ) : (
        <pre className="bg-muted p-3 rounded max-h-[70vh] overflow-auto whitespace-pre-wrap">{item.text || ""}</pre>
      )}
    </div>
  )
}
