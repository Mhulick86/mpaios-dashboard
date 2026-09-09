/** TaskProvider adapter for Asana (server-side, PAT from env). Mirrors lib/asana.ts in the dashboard. */
import { config } from '../config.ts';
import { query } from '../db.ts';

const BASE = 'https://app.asana.com/api/1.0';

async function asana<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!config.asana.pat) throw new Error('ASANA_PAT not configured');
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { authorization: `Bearer ${config.asana.pat}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`Asana ${path} -> ${res.status} ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).data as T;
}

export const asanaProvider = {
  capabilities: { tasks: true, projects: true, sections: true, comments: true },
  async listProjects(): Promise<{ gid: string; name: string }[]> {
    return asana(`/projects?workspace=${config.asana.workspaceGid}&archived=false&limit=100`);
  },
  async createProject(input: { name: string; notes?: string; sections?: string[]; teamGid?: string }): Promise<{ gid: string; url: string; sections: Record<string, string> }> {
    const project = await asana<{ gid: string }>('/projects', { method: 'POST', body: JSON.stringify({ data: { name: input.name, notes: input.notes || '', workspace: config.asana.workspaceGid, layout: 'board', ...(input.teamGid ? { team: input.teamGid } : {}) } }) });
    const sections: Record<string, string> = {};
    for (const name of input.sections || ['To Do', 'In Progress', 'Done']) {
      const s = await asana<{ gid: string }>(`/projects/${project.gid}/sections`, { method: 'POST', body: JSON.stringify({ data: { name } }) });
      sections[name] = s.gid;
    }
    return { gid: project.gid, url: `https://app.asana.com/0/${project.gid}`, sections };
  },
  async createTask(input: { name: string; notes?: string; projectGid?: string; sectionGid?: string; dueOn?: string; assigneeGid?: string; canonicalType?: string; canonicalId?: string; idempotencyKey?: string }): Promise<{ gid: string; url: string }> {
    if (input.idempotencyKey) {
      const hit = await query<{ external_id: string, external_url: string }>(`select external_id, external_url from external_object_map where provider = 'asana' and object_type = 'task' and canonical_type = 'idempotency' and canonical_id = md5($1)::uuid`, [input.idempotencyKey]);
      if (hit.length) return { gid: hit[0].external_id, url: hit[0].external_url };
    }
    const data: Record<string, unknown> = { name: input.name, notes: input.notes || '', workspace: config.asana.workspaceGid };
    if (input.projectGid) { data.projects = [input.projectGid]; if (input.sectionGid) data.memberships = [{ project: input.projectGid, section: input.sectionGid }]; }
    if (input.dueOn) data.due_on = input.dueOn;
    if (input.assigneeGid) data.assignee = input.assigneeGid;
    const task = await asana<{ gid: string }>('/tasks', { method: 'POST', body: JSON.stringify({ data }) });
    const url = `https://app.asana.com/0/${input.projectGid || 0}/${task.gid}`;
    if (input.canonicalType && input.canonicalId) {
      await query(`insert into external_object_map (provider, object_type, canonical_type, canonical_id, external_id, external_url) values ('asana','task',$1,$2,$3,$4) on conflict (provider, object_type, external_id) do nothing`, [input.canonicalType, input.canonicalId, task.gid, url]);
    }
    if (input.idempotencyKey) {
      await query(`insert into external_object_map (provider, object_type, canonical_type, canonical_id, external_id, external_url) values ('asana','task','idempotency', md5($1)::uuid, $2, $3) on conflict (provider, object_type, external_id) do nothing`, [input.idempotencyKey, task.gid, url]);
    }
    return { gid: task.gid, url };
  },
  async addComment(taskGid: string, text: string) {
    return asana(`/tasks/${taskGid}/stories`, { method: 'POST', body: JSON.stringify({ data: { text } }) });
  },
};
