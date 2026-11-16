// Copies the Content Studio browser UI (content-studio/public) into public/studio so Next serves it at /studio/.
// Runs before `next dev` and `next build`. Only the static UI is copied: the studio's server, knowledge pack
// and data never become part of the website.
import { cpSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../content-studio/public', import.meta.url));
const dest = fileURLToPath(new URL('../public/studio', import.meta.url));
if (!existsSync(src)) { console.error('sync-studio: content-studio/public is missing'); process.exit(1); }
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log('sync-studio: content-studio/public -> public/studio');
