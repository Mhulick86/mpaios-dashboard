import { config } from '../config.ts';
export async function notifySlack(text: string, blocks?: unknown[]): Promise<boolean> {
  if (!config.slackWebhookUrl) return false;
  const res = await fetch(config.slackWebhookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, blocks }) });
  return res.ok;
}
