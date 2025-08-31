import { type NextRequest, NextResponse } from "next/server"
import { chunkText } from "@/lib/chunk"
import { embedTexts } from "@/lib/embeddings"
import { upsertDocument } from "@/lib/vectorstore"
import { extractTextFromFile } from "@/lib/ingest"
import { getDb, mongoEnabled } from "@/lib/mongo"

const isMongoEnabled = mongoEnabled()

export async function POST(req: NextRequest) {
  // Accept JSON or form-data with common knowledge file types
  let payload: {
    text?: string
    title?: string
    type?: string
    collection?: string
    tags?: string[]
    version?: string
  } = {}
  const contentType = req.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    payload = await req.json()
  } else if (contentType.includes("multipart/form-data")) {
    const form = await req.formData()
    const title = (form.get("title") as string) || undefined
    const type = (form.get("type") as string) || undefined
    const collection = (form.get("collection") as string) || "default"
    const tagsRaw = (form.get("tags") as string) || ""
    const tags = tagsRaw
      ? tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : []
    const file = form.get("file") as File | null
    const version = (form.get("version") as string) || undefined
    let text = (form.get("text") as string) || ""

    if (file) {
      // Extract text from multiple formats
      const { text: extracted, type: inferredType } = await extractTextFromFile(file)
      if (!extracted || extracted.trim().length === 0) {
        return NextResponse.json(
          {
            error:
              inferredType === "pdf"
                ? "PDF parsing failed in this preview. Try DOCX/MD/TXT/CSV/XLSX or paste text."
                : "Could not extract text from the uploaded file.",
          },
          { status: 400 },
        )
      }
      text = extracted
      payload = {
        title: title || file.name,
        type: type || inferredType,
        collection,
        tags,
        text,
        version,
      }
    } else {
      payload = { title, type: type || "text", collection, tags, text, version }
    }
  } else {
    return NextResponse.json({ error: "Unsupported content type" }, { status: 400 })
  }

  if (!payload.text || !payload.title) {
    return NextResponse.json({ error: "Missing 'text' or 'title'." }, { status: 400 })
  }

  const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const chunks = chunkText(payload.text)
  const embeddings = await embedTexts(chunks)
  const chunkRecords = chunks.map((text, i) => ({
    id: `${id}_chunk_${i}`,
    text,
    embedding: embeddings[i],
  }))

  const saved = await upsertDocument({
    id,
    title: payload.title!,
    type: payload.type,
    collection: payload.collection,
    tags: payload.tags,
    version: payload.version || "v1.0",
    text: payload.text!,
    chunks: chunkRecords,
  })

  if (isMongoEnabled) {
    try {
      const db = await getDb()
      await db.collection("docs").updateOne(
        { id: saved.id },
        {
          $set: {
            id: saved.id,
            title: saved.title,
            type: saved.type ?? "unknown",
            collection: saved.collection ?? "uncategorized",
            tags: saved.tags ?? [],
            version: saved.version ?? "v1.0",
            text: saved.text,
            createdAt: saved.createdAt,
          },
        },
        { upsert: true },
      )

      if (chunkRecords.length > 0) {
        await db.collection("chunks").bulkWrite(
          chunkRecords.map((c) => ({
            updateOne: {
              filter: { id: c.id },
              update: {
                $set: {
                  id: c.id,
                  docId: saved.id,
                  text: c.text,
                  embedding: c.embedding,
                },
              },
              upsert: true,
            },
          })),
          { ordered: false },
        )
      }
    } catch (err) {
      console.log("[v0] Mongo persist failed:", (err as Error).message)
    }
  }

  return NextResponse.json({ id, chunks: chunkRecords.length })
}
