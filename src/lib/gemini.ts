// ─── Gemini API Integration for Document Analysis ───

// Gemini 2.5 Pro — highest context window available (1M+ tokens)
const GEMINI_MODEL = "gemini-2.5-pro-preview-06-05";
const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

/* ---------- Types ---------- */

export interface GeminiConfig {
  apiKey: string;
  connected: boolean;
  connectedAt: string | null;
}

export function defaultGeminiConfig(): GeminiConfig {
  return {
    apiKey: "",
    connected: false,
    connectedAt: null,
  };
}

export interface MailAnalysis {
  title: string;
  summary: string;
  category: MailCategory;
  urgency: MailUrgency;
  sender: string;
  dateReceived: string;
  actionRequired: string;
  keyDetails: string[];
}

export type MailCategory =
  | "Invoice / Bill"
  | "Legal / Contract"
  | "Government / Tax"
  | "Insurance"
  | "Medical / Health"
  | "Banking / Financial"
  | "Subscription / Service"
  | "Personal Correspondence"
  | "Marketing / Promotional"
  | "Other";

export type MailUrgency =
  | "Critical"
  | "High"
  | "Medium"
  | "Low";

/* ---------- Analyze document with Gemini ---------- */

export async function analyzeDocument(
  apiKey: string,
  fileContent: string | ArrayBuffer,
  mimeType: string,
  fileName: string
): Promise<MailAnalysis> {
  const parts: GeminiPart[] = [];

  // Add the file content
  if (typeof fileContent === "string") {
    parts.push({ text: `File name: ${fileName}\n\nFile content:\n${fileContent}` });
  } else {
    // Binary content (PDF, images) — send as inline_data
    const base64 = Buffer.from(fileContent).toString("base64");
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: base64,
      },
    });
    parts.push({ text: `File name: ${fileName}` });
  }

  // Add the analysis prompt
  parts.push({
    text: `You are a mail sorting assistant. Analyze the above document (which was scanned from physical mail) and return a JSON object with the following fields:

{
  "title": "A short descriptive title for this piece of mail (max 80 chars)",
  "summary": "A 2-3 sentence summary of what this document is about",
  "category": one of ["Invoice / Bill", "Legal / Contract", "Government / Tax", "Insurance", "Medical / Health", "Banking / Financial", "Subscription / Service", "Personal Correspondence", "Marketing / Promotional", "Other"],
  "urgency": one of ["Critical", "High", "Medium", "Low"] based on:
    - Critical: Legal deadlines, overdue bills, court notices, urgent medical
    - High: Bills due within 2 weeks, insurance renewals, tax documents
    - Medium: Regular bills, subscription notices, important correspondence
    - Low: Marketing, informational, no action needed
  "sender": "The sender/organization name",
  "dateReceived": "The date on the document if visible, or 'Not specified'",
  "actionRequired": "What specific action the recipient needs to take, if any",
  "keyDetails": ["Array of 2-4 key facts from the document like amounts, dates, account numbers"]
}

Return ONLY the JSON object, no other text.`,
  });

  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    let message = `Gemini API error (${res.status})`;
    try {
      const parsed = JSON.parse(body);
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      if (body) message = body;
    }
    throw new Error(message);
  }

  const data = await res.json();
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Gemini did not return valid JSON analysis");
  }

  const analysis: MailAnalysis = JSON.parse(jsonMatch[0]);
  return analysis;
}

/* ---------- Test API key ---------- */

export async function testGeminiConnection(apiKey: string): Promise<boolean> {
  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "Reply with only: OK" }] }],
      generationConfig: { maxOutputTokens: 10 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    let message = `Gemini API error (${res.status})`;
    try {
      const parsed = JSON.parse(body);
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      if (body) message = body;
    }
    throw new Error(message);
  }

  return true;
}

/* ---------- Internal types ---------- */

interface GeminiPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
}
