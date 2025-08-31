// Simple in-memory vector store for demo purposes.
// Data is not persisted. For production, replace with a real DB/vector DB.

type Doc = {
  id: string
  title: string
  type?: string
  collection?: string
  tags?: string[]
  text: string
  chunks: { id: string; text: string; embedding: number[] }[]
  createdAt: number
  version?: string // track dataset/document version
}

type SearchResult = {
  docId: string
  chunkId: string
  title: string
  type?: string
  collection?: string
  tags?: string[]
  text: string
  score: number
  index: number
}

type Store = {
  docs: Map<string, Doc>
  chunks: Map<string, { docId: string; id: string; text: string; embedding: number[] }>
}

declare global {
  // eslint-disable-next-line no-var
  var __VECTOR_STORE__: Store | undefined
}

function getStore(): Store {
  if (!globalThis.__VECTOR_STORE__) {
    globalThis.__VECTOR_STORE__ = {
      docs: new Map(),
      chunks: new Map(),
    }
  }
  return globalThis.__VECTOR_STORE__
}

export function resetStore() {
  const store = getStore()
  store.docs.clear()
  store.chunks.clear()
}

export function upsertDocument(doc: Omit<Doc, "createdAt">) {
  const store = getStore()
  const payload: Doc = { ...doc, createdAt: Date.now() }
  store.docs.set(payload.id, payload)
  for (const c of payload.chunks) {
    store.chunks.set(c.id, { docId: payload.id, id: c.id, text: c.text, embedding: c.embedding })
  }
  return payload
}

export function stats() {
  const store = getStore()
  const totalDocs = store.docs.size
  const totalChunks = store.chunks.size
  const byCollection: Record<string, number> = {}
  const byType: Record<string, number> = {}
  for (const d of store.docs.values()) {
    const col = d.collection ?? "uncategorized"
    byCollection[col] = (byCollection[col] ?? 0) + 1
    const t = d.type ?? "unknown"
    byType[t] = (byType[t] ?? 0) + 1
  }
  return { totalDocs, totalChunks, byCollection, byType }
}

export function getStats() {
  const store = getStore()
  const totalDocs = store.docs.size

  // No data yet
  if (totalDocs === 0) {
    return {
      sourcesCount: 0,
      collections: [] as string[],
      ingestion: { status: "—" as const },
      datasets: [] as Array<{ name: string; ver: string; status: string; color: string }>,
    }
  }

  // Aggregate by collection with latest creation time
  const collectionsMap = new Map<string, { count: number; latest: number }>()
  let latestGlobal = 0
  for (const d of store.docs.values()) {
    const col = d.collection ?? "uncategorized"
    const prev = collectionsMap.get(col) || { count: 0, latest: 0 }
    const latest = Math.max(prev.latest, d.createdAt || 0)
    collectionsMap.set(col, { count: prev.count + 1, latest })
    latestGlobal = Math.max(latestGlobal, d.createdAt || 0)
  }

  const ageToStatus = (ageMs: number) => {
    // Up-to-date < 2 minutes, Refreshing < 60 minutes, else Stale
    if (ageMs < 2 * 60 * 1000) return "Up-to-date"
    if (ageMs < 60 * 60 * 1000) return "Refreshing"
    return "Stale"
  }
  const colorFor = (status: string) =>
    status === "Up-to-date" ? "bg-emerald-500" : status === "Refreshing" ? "bg-amber-500" : "bg-rose-500"

  const now = Date.now()
  const ingestionStatus = ageToStatus(Math.max(0, now - latestGlobal))

  // Create dataset cards per collection
  const datasets = Array.from(collectionsMap.entries())
    .sort((a, b) => b[1].latest - a[1].latest)
    .map(([name, info]) => {
      const st = ageToStatus(Math.max(0, now - info.latest))
      // simple dynamic version derived from count (purely demonstrative)
      const ver = `v${1 + Math.floor(info.count / 5)}.${info.count % 10}`
      return { name, ver, status: st, color: colorFor(st) }
    })

  return {
    sourcesCount: totalDocs,
    collections: Array.from(collectionsMap.keys()),
    ingestion: { status: ingestionStatus, updatedAt: latestGlobal },
    datasets,
  }
}

function cosineSim(a: number[], b: number[]) {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8)
}

export function search(embedding: number[], k = 8): SearchResult[] {
  const store = getStore()
  const scored: SearchResult[] = []
  let idx = 0
  for (const chunk of store.chunks.values()) {
    const score = cosineSim(embedding, chunk.embedding)
    const doc = store.docs.get(chunk.docId)
    if (!doc) continue
    scored.push({
      docId: doc.id,
      chunkId: chunk.id,
      title: doc.title,
      type: doc.type,
      collection: doc.collection,
      tags: doc.tags,
      text: chunk.text,
      score,
      index: idx++,
    })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k)
}

export function listDocuments() {
  const store = getStore()
  return Array.from(store.docs.values()).map((d) => ({
    id: d.id,
    title: d.title,
    name: d.title, // alias for UI
    type: d.type ?? "unknown",
    collection: d.collection ?? "uncategorized",
    tags: d.tags ?? [],
    size: d.text.length,
    chunks: d.chunks.length,
    createdAt: d.createdAt,
    version: d.version ?? "v1.0",
  }))
}

export function getDocChunkCount(docId: string) {
  const store = getStore()
  const doc = store.docs.get(docId)
  return doc ? doc.chunks.length : 0
}

export function getDocument(docId: string) {
  const store = getStore()
  return store.docs.get(docId) ?? null
}

export function getDoc(docId: string) {
  return getStore().docs.get(docId)
}

export type { Doc, SearchResult }
