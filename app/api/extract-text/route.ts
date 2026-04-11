/**
 * Extracts text from uploaded files (PDF, DOCX, etc.)
 * Accepts base64-encoded file data and returns extracted text.
 */

import { requireAuth } from "@/lib/apiAuth";

export async function POST(req: Request) {
  try {
    await requireAuth();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const { fileName, fileType, base64Data } = await req.json();

  if (!base64Data) {
    return Response.json({ error: "No file data provided" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(base64Data, "base64");

    if (fileType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf")) {
      // Extract text from PDF using a simple regex-based approach
      // This handles most text-based PDFs (not scanned images)
      const text = extractTextFromPDF(buffer);
      if (text.trim().length > 50) {
        return Response.json({ text, method: "pdf-extract" });
      }
      // Fallback: return raw string content (sometimes works for simple PDFs)
      const rawText = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, " ");
      const cleaned = rawText.match(/[A-Za-z]{3,}/g);
      if (cleaned && cleaned.length > 20) {
        return Response.json({ text: rawText.slice(0, 100000), method: "pdf-raw" });
      }
      return Response.json({ text: `[PDF file: ${fileName} — ${(buffer.length / 1024).toFixed(0)}KB. Text extraction limited. The PDF may contain scanned images rather than text.]`, method: "pdf-fallback" });
    }

    // For other binary files, try to read as text
    const text = buffer.toString("utf-8");
    return Response.json({ text: text.slice(0, 100000) });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    );
  }
}

/**
 * Simple PDF text extractor — parses PDF stream objects for text content.
 * Works for most text-based PDFs without requiring external dependencies.
 */
function extractTextFromPDF(buffer: Buffer): string {
  const content = buffer.toString("latin1");
  const textChunks: string[] = [];

  // Method 1: Extract text between BT (Begin Text) and ET (End Text) operators
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(content)) !== null) {
    const block = match[1];
    // Extract text from Tj, TJ, and ' operators
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      const decoded = decodePDFString(tjMatch[1]);
      if (decoded.trim()) textChunks.push(decoded);
    }

    // TJ operator (array of strings)
    const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
    let tjArrMatch;
    while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
      const parts = tjArrMatch[1].match(/\(([^)]*)\)/g);
      if (parts) {
        const line = parts.map((p) => decodePDFString(p.slice(1, -1))).join("");
        if (line.trim()) textChunks.push(line);
      }
    }
  }

  // Method 2: Look for stream content with readable text
  if (textChunks.length < 5) {
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    while ((match = streamRegex.exec(content)) !== null) {
      const streamContent = match[1];
      // Check if it contains readable ASCII text
      const readable = streamContent.replace(/[^\x20-\x7E\n\r]/g, "").trim();
      if (readable.length > 50 && /[a-zA-Z]{3,}/.test(readable)) {
        textChunks.push(readable);
      }
    }
  }

  return textChunks.join("\n").replace(/\s{3,}/g, " ").trim();
}

function decodePDFString(str: string): string {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}
