// <CHANGE> switch from AI SDK to official OpenAI SDK for embeddings
import OpenAI from "openai"

// Use a singleton OpenAI client to avoid re-instantiation in dev
let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return _openai
}

export async function embedTexts(texts: string[]) {
  const openai = getOpenAI()
  const res = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: texts,
  })
  // res.data is ordered to match input
  return res.data.map((d) => d.embedding as number[])
}

export async function embedQuery(text: string) {
  const openai = getOpenAI()
  const res = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
  })
  return res.data[0].embedding as number[]
}
