// Simple text chunker that tries to split on paragraphs and sentences
// with a max size to stay within embedding context.
export function chunkText(input: string, maxLen = 1200) {
  const paragraphs = input.split(/\n{2,}/g)
  const chunks: string[] = []
  for (const p of paragraphs) {
    if (p.length <= maxLen) {
      chunks.push(p.trim())
      continue
    }
    // split on sentences if paragraph is too long
    const sentences = p.split(/(?<=[.!?])\s+/)
    let buf = ""
    for (const s of sentences) {
      if ((buf + " " + s).trim().length > maxLen) {
        if (buf.trim().length) chunks.push(buf.trim())
        buf = s
      } else {
        buf = (buf + " " + s).trim()
      }
    }
    if (buf.trim().length) chunks.push(buf.trim())
  }
  // filter super-short chunks
  return chunks.filter((c) => c.trim().length >= 20)
}
