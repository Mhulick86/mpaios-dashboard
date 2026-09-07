import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from './config.ts';

export const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
export const etlQueue = new Queue('etl', { connection: redis });
export const workflowQueue = new Queue('workflow', { connection: redis });
export const outboxQueue = new Queue('outbox', { connection: redis });
