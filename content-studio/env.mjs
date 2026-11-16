// Tiny .env loader shared by the server and the CLI scripts, so the app keeps zero npm dependencies.
// Real environment variables always win over values in .env.
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const envPath = join(ROOT, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let val = match[2];
    if (/^(['"]).*\1$/.test(val)) val = val.slice(1, -1);
    process.env[match[1]] = val;
  }
}
// One data directory for the database AND uploaded assets, independent of the shell's working directory.
export const DATA_DIR = resolve(ROOT, process.env.DATA_DIR || 'data');
export const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
export const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(n) && value !== '' && value != null ? n : fallback));
};
