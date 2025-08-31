import { NextResponse } from "next/server"
import { listDocuments } from "@/lib/vectorstore"

export async function GET() {
  const items = listDocuments()
  return NextResponse.json({ items })
}
