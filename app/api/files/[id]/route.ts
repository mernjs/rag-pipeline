import { NextResponse } from "next/server"
import { getDocument } from "@/lib/vectorstore"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const doc = getDocument(params.id)
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({
    item: {
      id: doc.id,
      name: doc.title,
      title: doc.title,
      type: doc.type ?? "unknown",
      collection: doc.collection ?? "uncategorized",
      tags: doc.tags ?? [],
      version: doc.version ?? "v1.0",
      createdAt: doc.createdAt,
      text: doc.text,
      chunks: doc.chunks.length,
    },
  })
}
