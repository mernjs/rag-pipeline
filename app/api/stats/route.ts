import { NextResponse } from "next/server"
import { getStats } from "@/lib/vectorstore"

export async function GET() {
  const data = getStats()
  return NextResponse.json(data)
}
