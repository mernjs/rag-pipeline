import type { NextRequest } from "next/server"
import OpenAI from "openai"
import { embedQuery } from "@/lib/embeddings"
import { search } from "@/lib/vectorstore"

// Build a singleton OpenAI client
let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

export async function POST(req: NextRequest) {
  const { messages } = await req.json()

  // Find the latest user message content for augmentation
  const lastUser = [...(messages as any[])].reverse().find((m) => m.role === "user")?.content as
    | string
    | undefined
  const userQuery = (lastUser || "").slice(0, 4000)

  // RAG retrieval
  const embedding = userQuery ? await embedQuery(userQuery) : undefined
  const top = embedding ? search(embedding, 6) : []

  const sourcesList =
    top
      .map(
        (r, i) => `[${i + 1}] ${r.title}${r.type ? ` (${r.type})` : ""}${r.collection ? ` — ${r.collection}` : ""}`,
      )
      .join("\n") || "No sources available."

  const contextBlocks = top.map((r, i) => `[#${i + 1}] ${r.text}`).join("\n\n") || "No relevant context found."

  const system = `You are an AI assistant for an internal Knowledge Hub.
Use the provided context to answer accurately and concisely.
Always cite sources inline like [1], [2]. If unsure, say you don't know.

Sources:
${sourcesList}`

  const prompt = `User question: """${userQuery}"""

Context snippets:
${contextBlocks}

Instructions:
- Answer clearly, with bullet points if helpful.
- Include inline citations [n] that refer to the sources list above.
- Add a brief "Sources:" section at the end with the cited numbers.`

  // Build chat history: we keep non-user messages (e.g., assistant/system) for continuity,
  // and append a single augmented user message containing the prompt above.
  const prior = ((messages as any[]) || []).filter((m) => m.role !== "user")

  const openai = getOpenAI()
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    stream: true,
    messages: [
      { role: "system", content: system },
      ...prior.map((m) => ({ role: m.role as "assistant" | "system", content: String(m.content || "") })),
      { role: "user", content: prompt },
    ],
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of completion) {
          const delta = part.choices?.[0]?.delta?.content
          if (delta) {
            controller.enqueue(encoder.encode(delta))
          }
        }
      } catch (err) {
        controller.enqueue(encoder.encode("\n[Stream error]\n"))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  })
}
