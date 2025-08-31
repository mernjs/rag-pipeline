import { MongoClient, type Db } from "mongodb"

let client: MongoClient | null = null
let db: Db | null = null

// Helper to check if Mongo is configured
export function useMongo(): boolean {
  return !!(process.env.MONGODB_URI && process.env.MONGODB_DB)
}

// Non-hook helper to check if Mongo is configured
export function mongoEnabled(): boolean {
  return Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB)
}

export async function getDb() {
  if (db) return db
  const uri = process.env.MONGODB_URI
  const name = process.env.MONGODB_DB
  if (!uri || !name) {
    throw new Error("Missing MONGODB_URI or MONGODB_DB")
  }
  if (!client) {
    client = new MongoClient(uri, { connectTimeoutMS: 15_000 })
  }
  if (!client.topology?.isConnected()) {
    await client.connect()
  }
  db = client.db(name)
  return db
}
