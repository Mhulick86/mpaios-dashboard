/**
 * Content Studio's backend inside MAIOS. The studio code lives in content-studio/ and runs here on Vercel functions:
 * its database and files sit in private Vercel Blob storage, and generation goes to the model provider chosen per
 * stage in the studio's Settings (Anthropic, OpenAI or Google), using keys saved there encrypted.
 *
 * Needs BLOB_READ_WRITE_TOKEN (connect a private Blob store to the project) and STUDIO_SECRET_KEY (32 random bytes,
 * base64), which encrypts saved API keys and signs passcode sessions.
 */
import { get, put, del } from "@vercel/blob";
// @ts-expect-error plain ESM module without type declarations
import { createHostedStudio } from "../content-studio/hosted.mjs";
import seed from "../content-studio/knowledge/seed.json";

type Reply = { status: number; json?: unknown; body?: string | Uint8Array; headers?: Record<string, string> };
type Studio = {
  handle(req: unknown): Promise<Reply>;
  background(opts: { deadline: number }): Promise<void>;
  tick(opts: { deadline: number }): Promise<unknown>;
};

let studio: Studio | null = null;

// Other Vercel projects build this same repository without the studio's storage; send people to the real one.
const STUDIO_HOME = process.env.STUDIO_HOME_URL || "https://maios.marketingpowered.ai/content-studio";

export function studioConfigError(): string | null {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return `Content Studio is not set up on this copy of MAIOS. Open it at ${STUDIO_HOME}`;
  if (!process.env.STUDIO_SECRET_KEY) return `Content Studio is missing STUDIO_SECRET_KEY on this deployment. Open it at ${STUDIO_HOME}`;
  return null;
}

export function getStudio(): Studio {
  if (!studio) {
    process.env.STUDIO_HOSTED = "1";
    studio = createHostedStudio({ blob: { get, put, del }, seed, cookiePath: "/api/studio" }) as Studio;
  }
  return studio;
}

export function toResponse(reply: Reply): Response {
  if (reply.json !== undefined) {
    return new Response(JSON.stringify(reply.json), {
      status: reply.status,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...(reply.headers || {}) },
    });
  }
  return new Response(reply.body as BodyInit, { status: reply.status, headers: reply.headers || {} });
}
