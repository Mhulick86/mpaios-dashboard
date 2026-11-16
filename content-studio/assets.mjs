// Task attachments and generated images. Local: files under DATA_DIR/assets. Hosted: private Blob storage (hosted.mjs).
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { DATA_DIR } from './env.mjs';
import { runtime } from './runtime.mjs';

const dir = () => resolve(DATA_DIR, 'assets');
const localAssets = {
  async write(name, buf) { mkdirSync(dir(), { recursive: true }); writeFileSync(join(dir(), basename(name)), buf, { flag: 'wx' }); },
  async read(name) { const p = join(dir(), basename(name)); return existsSync(p) ? readFileSync(p) : null; }
};
export const assets = () => runtime.assets || localAssets;
