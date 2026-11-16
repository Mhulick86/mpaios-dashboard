#!/usr/bin/env node
// Runs the studio against the built-in mock model so the full flow can be explored with no LM Studio.
// Uses a separate data directory (data-demo/) so it never touches real work.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createMockModel } from './mock-model.mjs';

const mock = createMockModel();
const port = await mock.listen(Number(process.env.MOCK_MODEL_PORT || 0));
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'inherit',
  env: { ...process.env, LM_STUDIO_BASE_URL: `http://127.0.0.1:${port}/v1`, LM_STUDIO_MODEL: '', DATA_DIR: process.env.DATA_DIR || 'data-demo' }
});
console.log(`DEMO MODE: generation uses canned placeholder text from the mock model on port ${port}.`);
const stop = () => { child.kill('SIGTERM'); mock.close().then(() => process.exit(0)); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
child.on('exit', (code) => mock.close().then(() => process.exit(code ?? 0)));
