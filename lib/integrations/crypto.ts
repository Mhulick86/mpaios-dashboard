/**
 * Application-level encryption for integration credentials plus HMAC-signed
 * OAuth state. Tokens are stored in Supabase only as AES-256-GCM ciphertext;
 * the key lives in the INTEGRATIONS_ENCRYPTION_KEY env var on the server, so
 * even an admin reading the table through the API sees nothing usable.
 *
 * Generate a key:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ENV = "INTEGRATIONS_ENCRYPTION_KEY";

export class EncryptionNotConfiguredError extends Error {
  constructor() {
    super(`${ENV} is not set. Generate a 32-byte key and add it to the environment before connecting integrations.`);
    this.name = "EncryptionNotConfiguredError";
  }
}

function keyBytes(): Buffer {
  const raw = process.env[ENV];
  if (!raw) throw new EncryptionNotConfiguredError();
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error(`${ENV} must decode to exactly 32 bytes (64 hex chars or 44 base64 chars).`);
  return buf;
}

export function isEncryptionConfigured(): boolean {
  try {
    keyBytes();
    return true;
  } catch {
    return false;
  }
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), enc.toString("base64url"), tag.toString("base64url")].join(".");
}

export function decrypt(token: string): string {
  const [v, ivB, encB, tagB] = token.split(".");
  if (v !== "v1" || !ivB || !encB || !tagB) throw new Error("Unrecognised ciphertext format");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(ivB, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encB, "base64url")), decipher.final()]).toString("utf8");
}

function sign(payload: string): string {
  return createHmac("sha256", keyBytes()).update("maios-oauth-state:" + payload).digest("base64url");
}

export interface OAuthState {
  /** provider id */
  p: string;
  /** user id that started the flow */
  u: string;
  /** nonce, mirrored in an httpOnly cookie */
  n: string;
  /** issued-at (ms) */
  t: number;
}

export function encodeState(state: OAuthState): string {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the state when the signature is valid and it is younger than maxAgeMs. */
export function decodeState(raw: string | null, maxAgeMs = 10 * 60 * 1000): OAuthState | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
    if (typeof state.p !== "string" || typeof state.u !== "string" || typeof state.n !== "string" || typeof state.t !== "number") return null;
    if (Date.now() - state.t > maxAgeMs) return null;
    return state;
  } catch {
    return null;
  }
}

export function randomNonce(): string {
  return randomBytes(16).toString("base64url");
}
