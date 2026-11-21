/**
 * Content Studio's backend inside MAIOS. The studio code lives in content-studio/ and runs here on Vercel functions:
 * its database and files sit in private object storage, and generation goes to the model provider chosen per stage in
 * the studio's Settings (Anthropic, OpenAI or Google), using keys saved there encrypted.
 *
 * Storage: an S3-compatible bucket such as Cloudflare R2 when STUDIO_S3_ENDPOINT, STUDIO_S3_BUCKET,
 * STUDIO_S3_ACCESS_KEY_ID and STUDIO_S3_SECRET_ACCESS_KEY are set (content-studio/s3-store.mjs), otherwise Vercel Blob
 * (BLOB_READ_WRITE_TOKEN). Both earlier homes locked the studio out on their free plans: Vercel Blob blocks a Hobby
 * store for 30 days once its monthly operations run out, and Supabase restricts the project once storage or egress
 * goes over quota. R2 does not charge for egress. Also needs STUDIO_SECRET_KEY (32 random bytes, base64), which
 * encrypts saved API keys and signs passcode sessions.
 *
 * While STUDIO_SUPABASE_URL is still set, what the studio saved on Supabase is copied into the bucket as it is asked
 * for (content-studio/storage-move.mjs). Remove that variable once POST /api/studio/storage-move reports nothing left.
 */
import { get, put, del } from "@vercel/blob";
import { createS3Store } from "../content-studio/s3-store.mjs";
import { createSupabaseSource, withOldStore } from "../content-studio/storage-move.mjs";
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

const env = (name: string) => (process.env[name] || "").trim();
const s3Configured = () => !!(env("STUDIO_S3_ENDPOINT") && env("STUDIO_S3_BUCKET") && env("STUDIO_S3_ACCESS_KEY_ID") && env("STUDIO_S3_SECRET_ACCESS_KEY"));
/** The studio's data is still on Supabase and has to be copied out (see content-studio/storage-move.mjs). */
export const oldSupabaseConfigured = () => !!(env("STUDIO_SUPABASE_URL") && env("STUDIO_SUPABASE_SECRET_KEY"));

export function studioS3Store() {
  return createS3Store({
    endpoint: env("STUDIO_S3_ENDPOINT"), bucket: env("STUDIO_S3_BUCKET"), region: env("STUDIO_S3_REGION"),
    accessKeyId: env("STUDIO_S3_ACCESS_KEY_ID"), secretAccessKey: env("STUDIO_S3_SECRET_ACCESS_KEY"),
  });
}
export function studioOldStore() {
  return createSupabaseSource({ url: env("STUDIO_SUPABASE_URL"), key: env("STUDIO_SUPABASE_SECRET_KEY") });
}

export function studioConfigError(): string | null {
  // Never fall back to Vercel Blob while the studio's data is waiting on Supabase: that would open an old or empty board.
  if (!s3Configured() && oldSupabaseConfigured()) return "Content Studio no longer stores on Supabase. Set STUDIO_S3_ENDPOINT, STUDIO_S3_BUCKET, STUDIO_S3_ACCESS_KEY_ID and STUDIO_S3_SECRET_ACCESS_KEY (for example a Cloudflare R2 bucket) in the Vercel project, then redeploy.";
  if (!s3Configured() && !process.env.BLOB_READ_WRITE_TOKEN) return `Content Studio is not set up on this copy of MAIOS. Open it at ${STUDIO_HOME}`;
  if (!process.env.STUDIO_SECRET_KEY) return `Content Studio is missing STUDIO_SECRET_KEY on this deployment. Open it at ${STUDIO_HOME}`;
  return null;
}

export function getStudio(): Studio {
  if (!studio) {
    process.env.STUDIO_HOSTED = "1";
    let storage: unknown = { get, put, del };
    if (s3Configured()) storage = oldSupabaseConfigured() ? withOldStore(studioS3Store(), studioOldStore()) : studioS3Store();
    studio = createHostedStudio({ blob: storage, seed, cookiePath: "/api/studio" }) as Studio;
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
