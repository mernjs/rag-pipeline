// Converts common knowledge file formats to plain text for chunking/embeddings.
// Supported: txt, md, csv, html (basic strip), docx, pptx, xlsx. PDF is experimental.
//
// Note: This aims to use pure JS libs (JSZip, xlsx) compatible with the preview environment.

type ExtractResult = { text: string; type: string }

function extOf(name?: string) {
  const n = (name || "").toLowerCase()
  const m = n.match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ""
}

function basicHtmlToText(html: string) {
  // remove scripts/styles
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/[\s\S]*?/g, "")
  // replace <br> and block tags with newlines
  const withBreaks = cleaned
    .replace(/<(?:br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|section|article|h[1-6]|li|ul|ol|table|tr|td)>/gi, "\n")
  // strip remaining tags
  const text = withBreaks.replace(/<[^>]+>/g, "")
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

async function parseDocx(ab: ArrayBuffer): Promise<string> {
  const { default: JSZip } = await import("jszip")
  const zip = await JSZip.loadAsync(ab)
  const doc = await zip.file("word/document.xml")?.async("string")
  if (!doc) return ""
  // Extract <w:t>text</w:t> nodes (DOCX stores text inside these)
  const matches = doc.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || []
  const parts = matches.map((m) =>
    (m.replace(/<[^>]+>/g, "") || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
  )
  return parts.join(" ").replace(/\s+/g, " ").trim()
}

async function parsePptx(ab: ArrayBuffer): Promise<string> {
  const { default: JSZip } = await import("jszip")
  const zip = await JSZip.loadAsync(ab)
  const names = Object.keys(zip.files).filter((n) => n.startsWith("ppt/slides/slide") && n.endsWith(".xml"))
  const all: string[] = []
  for (const n of names) {
    const xml = await zip.file(n)?.async("string")
    if (!xml) continue
    // Extract <a:t>text</a:t> nodes
    const matches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || []
    const slideText = matches.map((m) => m.replace(/<[^>]+>/g, "")).join(" ")
    if (slideText.trim()) all.push(slideText.trim())
  }
  return all.join("\n\n")
}

async function parseXlsx(ab: ArrayBuffer): Promise<string> {
  const XLSXMod: any = await import("xlsx")
  const XLSX = XLSXMod.default || XLSXMod
  const wb = XLSX.read(ab, { type: "array" })
  const out: string[] = []
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    if (!ws) continue
    // Use TSV to keep columns readable
    const tsv = XLSX.utils.sheet_to_csv(ws, { FS: "\t" })
    if (tsv?.trim()) {
      out.push(`# Sheet: ${name}\n${tsv}`)
    }
  }
  return out.join("\n\n")
}

async function parseCsvText(text: string): Promise<string> {
  // Keep as-is; embeddings perform fine with raw CSV text for a baseline.
  return text
}

// Experimental: PDF parsing often requires workers/native features.
// We'll try to use pdfjs-dist in workerless mode, and gracefully error on failure.
async function parsePdf(ab: ArrayBuffer): Promise<string> {
  try {
    // ESM build; avoid workers by using direct data
    // @ts-ignore
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")
    // Disable workers to avoid MIME/worker issues in preview env
    // @ts-ignore
    if (pdfjsLib.GlobalWorkerOptions) pdfjsLib.GlobalWorkerOptions.workerSrc = ""
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(ab),
      // worker disabled; make parsing more permissive
      // @ts-ignore
      useWorkerFetch: false,
      // @ts-ignore
      isEvalSupported: false,
      // @ts-ignore
      disableFontFace: true,
    })
    const doc = await loadingTask.promise
    const num = doc.numPages || 0
    const pages: string[] = []
    for (let i = 1; i <= num; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const text = (content.items || [])
        .map((it: any) => (typeof it.str === "string" ? it.str : ""))
        .filter(Boolean)
        .join(" ")
      if (text.trim()) pages.push(text.trim())
    }
    return pages.join("\n\n")
  } catch (err) {
    // If parsing fails, return empty and let caller handle error messaging
    return ""
  }
}

function inferTypeFromMimeOrExt(file: File): string {
  const t = file.type
  const ext = extOf(file.name)
  if (t.startsWith("text/")) {
    if (t.includes("markdown") || ext === "md") return "markdown"
    if (t.includes("csv") || ext === "csv") return "csv"
    if (t.includes("html") || ext === "html" || ext === "htm") return "html"
    return "text"
  }
  if (t.includes("pdf") || ext === "pdf") return "pdf"
  if (t.includes("word") || ext === "docx") return "docx"
  if (t.includes("presentation") || ext === "pptx") return "pptx"
  if (t.includes("sheet") || ext === "xlsx") return "xlsx"
  if (ext === "csv") return "csv"
  if (ext === "md") return "markdown"
  if (ext === "html" || ext === "htm") return "html"
  return "text"
}

export async function extractTextFromFile(file: File): Promise<ExtractResult> {
  const type = inferTypeFromMimeOrExt(file)
  // Read as ArrayBuffer for binary formats
  if (type === "docx" || type === "pptx" || type === "xlsx" || type === "pdf") {
    const ab = await file.arrayBuffer()
    if (type === "docx") {
      const text = await parseDocx(ab)
      return { text, type }
    }
    if (type === "pptx") {
      const text = await parsePptx(ab)
      return { text, type }
    }
    if (type === "xlsx") {
      const text = await parseXlsx(ab)
      return { text, type }
    }
    if (type === "pdf") {
      const text = await parsePdf(ab)
      return { text, type }
    }
  }
  // Text-like formats
  const raw = await file.text()
  if (type === "html") {
    return { text: basicHtmlToText(raw), type }
  }
  if (type === "csv") {
    return { text: await parseCsvText(raw), type }
  }
  return { text: raw, type }
}
