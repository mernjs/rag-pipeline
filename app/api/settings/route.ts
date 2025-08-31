import { NextResponse } from "next/server"

type Settings = {
  chunkSize: number
  overlap: number
  embeddingModel: string
}

const defaults: Settings = {
  chunkSize: 800,
  overlap: 200,
  embeddingModel: "text-embedding-3-small",
}

const memory: { value: Settings } = {
  value: defaults,
}

export async function GET() {
  return NextResponse.json({ settings: memory.value })
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Partial<Settings>
  memory.value = { ...memory.value, ...body }
  return NextResponse.json({ settings: memory.value })
}
