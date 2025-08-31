import { type NextRequest, NextResponse } from "next/server"
import { embedQuery } from "@/lib/embeddings"
import { search } from "@/lib/vectorstore"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") || ""
  const k = Number(searchParams.get("k") || "8")
  if (!q.trim()) return NextResponse.json({ results: [] })

  const embedding = await embedQuery(q)
  const results = search(embedding, isNaN(k) ? 8 : k).map((r) => ({
    docId: r.docId,
    chunkId: r.chunkId,
    title: r.title,
    type: r.type,
    collection: r.collection,
    tags: r.tags,
    text: r.text,
    score: r.score,
  }))

  return NextResponse.json({ query: q, results })
}
