/**
 * Encryption for stored API keys (AES-256-GCM). The key comes from STUDIO_SECRET_KEY (base64, 32 bytes), which the
 * hosted deployment sets as a Vercel environment variable. Locally, a key is generated once and kept in
 * DATA_DIR/.studio-secret with owner-only permissions. Encrypted values never leave the server.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './env.mjs';

let cached = null;
function masterKey() {
  if (cached) return cached;
  const fromEnv = (process.env.STUDIO_SECRET_KEY || '').trim();
  if (fromEnv) {
    const key = Buffer.from(fromEnv, 'base64');
    if (key.length !== 32) throw new Error('STUDIO_SECRET_KEY must be 32 bytes, base64 encoded.');
    return (cached = key);
  }
  if (process.env.STUDIO_HOSTED === '1' || process.env.VERCEL) throw new Error('STUDIO_SECRET_KEY is not set on this deployment. Add it in the Vercel project settings.');
  const file = join(DATA_DIR, '.studio-secret');
  if (!existsSync(file)) { mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(file, randomBytes(32).toString('base64'), { mode: 0o600 }); }
  return (cached = Buffer.from(readFileSync(file, 'utf8').trim(), 'base64'));
}
export function encrypt(plain) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', masterKey(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${data.toString('base64')}`;
}
export function decrypt(sealed) {
  const [v, iv, tag, data] = String(sealed || '').split(':');
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('Stored key is unreadable.');
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
/** Keyed hash for the hosted passcode: fast to check per request, useless without the server's secret. */
export const passcodeHash = (passcode) => createHmac('sha256', masterKey()).update(`studio-passcode:${passcode}`).digest('base64');
export function passcodeMatches(passcode, stored) {
  if (typeof passcode !== 'string' || !stored) return false;
  const a = Buffer.from(passcodeHash(passcode)), b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}
/**
 * Hosted sign-in session: "v1.<expires ms>.<signature>". The signature covers the stored passcode hash, so changing
 * the passcode signs every browser out. Nothing is stored server-side.
 */
const sessionSig = (expires, stored) => createHmac('sha256', masterKey()).update(`studio-session:${expires}:${stored}`).digest('base64url');
export function signSession(stored, days = 90) {
  const expires = Date.now() + days * 86400000;
  return `v1.${expires}.${sessionSig(expires, stored)}`;
}
export function verifySession(token, stored) {
  const [v, expires, sig] = String(token || '').split('.');
  if (v !== 'v1' || !stored || !sig || !(Number(expires) > Date.now())) return false;
  const a = Buffer.from(sig), b = Buffer.from(sessionSig(expires, stored));
  return a.length === b.length && timingSafeEqual(a, b);
}
