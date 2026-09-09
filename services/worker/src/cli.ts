/** Dev CLI:  pnpm etl <collection> <path-or-url-or-text>   |   pnpm search "<query>" [collection] */
import path from 'node:path';
import { one, pool } from './db.ts';
import { createEtlJob, runEtlJob } from './etl/pipeline.ts';
import { searchKnowledge, formatCitations } from './knowledge/search.ts';
import { scanKbRoot } from './etl/watcher.ts';

const [cmd, ...args] = process.argv.slice(2);
try {
  if (cmd === 'etl') {
    const [collection, source, ...rest] = args;
    const col = await one<{ id: string }>('select id from knowledge_collections where slug = $1', [collection]);
    if (!col) throw new Error(`collection ${collection} not found`);
    const isUrl = /^https?:\/\//.test(source);
    const jobId = await createEtlJob({ collectionId: col.id, sourceType: isUrl ? 'url' : 'file', sourceUri: isUrl ? source : `file://${path.resolve(source)}`, title: rest[0], force: true });
    await runEtlJob(jobId);
    console.log(JSON.stringify(await one('select status, stage, result, error from etl_jobs where id = $1', [jobId]), null, 2));
  } else if (cmd === 'scan') {
    console.log(await scanKbRoot(args[0]));
  } else if (cmd === 'search') {
    const [q, collection] = args;
    const cols = collection ? [(await one<{ id: string }>('select id from knowledge_collections where slug = $1', [collection]))!.id] : undefined;
    const hits = await searchKnowledge({ query: q, userId: process.env.AS_USER || null, collectionIds: cols, limit: 5 });
    console.log(formatCitations(hits) || '(no hits)');
  } else {
    console.log('usage: cli etl <collection> <file|url> [title] | scan [root] | search "<query>" [collection]');
  }
} finally { await pool.end(); }
