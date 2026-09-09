import { Worker } from 'bullmq';
import { config } from './config.ts';
import { redis } from './queues.ts';
import { runEtlJob } from './etl/pipeline.ts';
import { runWorkflow } from './workflows/runner.ts';
import { startScheduler, startEventListener } from './workflows/scheduler.ts';
import { scanKbRoot } from './etl/watcher.ts';
import { buildServer } from './http.ts';

async function main() {
  const etlWorker = new Worker('etl', async (job) => runEtlJob(job.data.jobId), { connection: redis, concurrency: Number(process.env.ETL_CONCURRENCY || 2) });
  const wfWorker = new Worker('workflow', async (job) => runWorkflow(job.data.runId), { connection: redis, concurrency: Number(process.env.WORKFLOW_CONCURRENCY || 4) });
  for (const w of [etlWorker, wfWorker]) {
    w.on('failed', (job, err) => console.error(`[${w.name}] job ${job?.id} failed:`, err.message));
    w.on('completed', (job) => console.log(`[${w.name}] job ${job.id} completed`));
  }
  startScheduler();
  await startEventListener();
  if (config.kbRoot) {
    const scan = () => scanKbRoot().then((r) => { if (r.queued) console.log(`[watcher] queued ${r.queued} of ${r.seen} files`); }).catch((e) => console.error('[watcher]', e.message));
    scan(); setInterval(scan, config.kbScanIntervalSec * 1000);
  }
  const app = await buildServer();
  await app.listen({ port: config.httpPort, host: '0.0.0.0' });
  console.log(`MAIOS worker up: http :${config.httpPort}, embeddings ${config.embeddings.model} @ ${config.embeddings.baseUrl}, llm ${config.llm.model}`);
  const shutdown = async () => { await Promise.all([etlWorker.close(), wfWorker.close(), app.close()]); process.exit(0); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}
main().catch((e) => { console.error(e); process.exit(1); });
