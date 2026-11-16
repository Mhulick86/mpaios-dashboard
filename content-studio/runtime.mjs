/**
 * Where the studio is running. The local server keeps the defaults: one process, SQLite on disk, assets on disk,
 * live output in memory. The hosted runtime (hosted.mjs, used by MAIOS on Vercel) swaps in versions that persist
 * the database and assets to private Vercel Blob storage and let several short-lived functions cooperate.
 */
export const runtime = {
  hosted: false,
  /** Run a database mutation and make it durable. Hosted: reloads and retries on a concurrent write. */
  async commit(fn) { return fn(); },
  /** Live model output while a job runs. */
  live: {
    store: new Map(),
    async set(jobId, text) { this.store.set(jobId, text); },
    async get(jobId) { return this.store.get(jobId); },
    async remove(jobId) { this.store.delete(jobId); }
  },
  /** Was this job cancelled by someone else (another function instance)? Local cancels abort in-process instead. */
  async cancelRequested() { return false; },
  /** Uploaded files and generated images. Local default is set by assets.mjs. */
  assets: null,
  /** Background work started by a request (image generation). Hosted: runs after the response, once the commit has succeeded. */
  defer(fn) { Promise.resolve().then(fn).catch((e) => console.error('Background task:', e)); }
};
export function configureRuntime(overrides) { Object.assign(runtime, overrides); }
