/**
 * MAIOS Knowledge Engine: SQLite FTS5 retrieval, human-editable source records,
 * agent instructions, version history, and job-level source provenance.
 * No external network calls, embeddings, vector SaaS, or n8n.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {join,dirname} from 'node:path';
import {getDb} from './db.mjs';

const ROOT=dirname(fileURLToPath(import.meta.url));
const NOW=()=>new Date().toISOString();
const asJson=x=>JSON.stringify(x??null);
const parse=(x,fallback)=>{try{return x?JSON.parse(x):fallback}catch{return fallback}};
let initialized=false;
let injectedSeed=null;
/** The hosted build bundles seed.json and hands it over, because it cannot read files next to this module. */
export function setKnowledgeSeed(seed){injectedSeed=seed;}
/** Called when the database file changes underneath (hosted runtime), so the next call re-checks the schema. */
export function resetKnowledge(){initialized=false;}
const DB_SCHEMA=`
CREATE TABLE IF NOT EXISTS knowledge_items (
  id TEXT PRIMARY KEY, source_key TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
  category TEXT NOT NULL, scope TEXT NOT NULL DEFAULT 'all',
  tags TEXT NOT NULL DEFAULT '[]', body TEXT NOT NULL,
  trust TEXT NOT NULL DEFAULT 'draft', source_type TEXT NOT NULL DEFAULT 'user',
  source_url TEXT NOT NULL DEFAULT '', priority INTEGER NOT NULL DEFAULT 3,
  enabled INTEGER NOT NULL DEFAULT 1, seeded INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS knowledge_by_scope ON knowledge_items(enabled,scope,category,priority DESC);
CREATE TABLE IF NOT EXISTS knowledge_revisions (
  id TEXT PRIMARY KEY, knowledge_id TEXT NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
  actor TEXT NOT NULL, saved_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_instructions (
  kind TEXT PRIMARY KEY, title TEXT NOT NULL, model_role TEXT NOT NULL,
  instructions TEXT NOT NULL, success_criteria TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS playbooks (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
  default_outputs TEXT NOT NULL, voice TEXT NOT NULL, word_count INTEGER NOT NULL,
  graphics_count INTEGER NOT NULL, acceptance TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS knowledge_usage (
  id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  knowledge_id TEXT NOT NULL, title TEXT NOT NULL,
  trust TEXT NOT NULL, reason TEXT NOT NULL, char_count INTEGER NOT NULL,
  recorded_at TEXT NOT NULL, UNIQUE(job_id,knowledge_id)
);
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  title,body,tags, content='knowledge_items',content_rowid='rowid',tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER IF NOT EXISTS knowledge_ai AFTER INSERT ON knowledge_items BEGIN
 INSERT INTO knowledge_fts(rowid,title,body,tags) VALUES(new.rowid,new.title,new.body,new.tags);
END;
CREATE TRIGGER IF NOT EXISTS knowledge_ad AFTER DELETE ON knowledge_items BEGIN
 INSERT INTO knowledge_fts(knowledge_fts,rowid,title,body,tags) VALUES('delete',old.rowid,old.title,old.body,old.tags);
END;
CREATE TRIGGER IF NOT EXISTS knowledge_au AFTER UPDATE ON knowledge_items BEGIN
 INSERT INTO knowledge_fts(knowledge_fts,rowid,title,body,tags) VALUES('delete',old.rowid,old.title,old.body,old.tags);
 INSERT INTO knowledge_fts(rowid,title,body,tags) VALUES(new.rowid,new.title,new.body,new.tags);
END;
`;
const ALLOWED_TRUST=new Set(['policy','source','observed','reference','draft','unverified']);
const ALLOWED_SCOPE=new Set(['all','company','founder','website','social','linkedin','facebook','instagram','gbp','x']);
const stop=new Set('from with that this have were your into their these those what where which while been are for the and you not use how was will can but our about only more they them has who than when each must should also over without make every need used same such your one two may do does then there any under into keep know notes work using based some within role content marketing powered media create article page output draft website task linkedin'.split(/\s+/));
function row(item){if(!item)return null;return{...item,tags:parse(item.tags,[]),enabled:!!item.enabled,seeded:!!item.seeded};}
function checkText(value,max=250000){const v=String(value??'');if(!v.trim()||v.length>max)throw new Error('Knowledge text must be nonempty and at most '+max+' characters.');return v.trim();}
function matchScope(item,task){return item.scope==='all'||item.scope===task.channel||item.scope===task.voice||(task.board_id==='mpfresh'&&item.scope==='website')||(task.board_id==='social'&&item.scope==='social');}

export function initKnowledge(){
 if(initialized)return;
 const db=getDb();db.exec(DB_SCHEMA);
 const seed=injectedSeed||JSON.parse(readFileSync(join(ROOT,'knowledge','seed.json'),'utf8'));
 const insert=db.prepare(`INSERT OR IGNORE INTO knowledge_items
 (id,source_key,title,category,scope,tags,body,trust,source_type,source_url,priority,enabled,seeded,created_at,updated_at)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
 const agent=db.prepare(`INSERT OR IGNORE INTO agent_instructions
 (kind,title,model_role,instructions,success_criteria,updated_at) VALUES(?,?,?,?,?,?)`);
 const play=db.prepare(`INSERT OR IGNORE INTO playbooks
 (id,title,description,default_outputs,voice,word_count,graphics_count,acceptance,updated_at)
 VALUES(?,?,?,?,?,?,?,?,?)`);
 db.exec('BEGIN');try{
  for(const i of seed.items)insert.run(randomUUID(),i.key,i.title,i.category,i.scope,asJson(i.tags),i.body,i.trust,i.source_type,i.source_url||'',i.priority,Number(i.enabled),1,NOW(),NOW());
  for(const i of seed.agents)agent.run(i.kind,i.title,i.model_role,i.instructions,i.success,NOW());
  for(const i of seed.playbooks)play.run(i.id,i.title,i.description,asJson(i.default_outputs),i.voice,i.word_count,i.graphics_count,i.acceptance,NOW());
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 initialized=true;
}
export function knowledgeStats(){
 initKnowledge();const db=getDb();return{
   total:db.prepare('SELECT count(*) n FROM knowledge_items').get().n,
   active:db.prepare('SELECT count(*) n FROM knowledge_items WHERE enabled=1').get().n,
   sourceCount:db.prepare('SELECT count(distinct source_type) n FROM knowledge_items').get().n,
   byCategory:db.prepare('SELECT category,count(*) n FROM knowledge_items WHERE enabled=1 GROUP BY category ORDER BY n DESC').all(),
   agents:db.prepare('SELECT count(*) n FROM agent_instructions').get().n,
   playbooks:db.prepare('SELECT count(*) n FROM playbooks').get().n
 };}
export function listKnowledge({q='',category='',scope='',limit=100,offset=0}={}){
 initKnowledge();const db=getDb();const clauses=[],bind=[];
 if(category){clauses.push('k.category=?');bind.push(String(category).slice(0,60));}
 if(scope){clauses.push('k.scope=?');bind.push(String(scope).slice(0,40));}
 const lim=Math.max(1,Math.min(300,Number(limit)||100)),off=Math.max(0,Number(offset)||0);
 const cols='k.id,k.source_key,k.title,k.category,k.scope,k.tags,k.trust,k.source_type,k.source_url,k.priority,k.enabled,k.seeded,k.revision,k.updated_at';
 const shape=r=>({...r,tags:parse(r.tags,[]),enabled:!!r.enabled,seeded:!!r.seeded});
 const text=String(q||'').trim().slice(0,150);
 if(text){
  // Ranked full-text search first (every word must match, prefixes allowed, title weighted highest).
  const terms=(text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)||[]).slice(0,10);
  if(terms.length){
   try{
    const match=terms.map(t=>'"'+t+'"*').join(' ');
    const where=['knowledge_fts MATCH ?',...clauses].join(' AND ');
    const from='FROM knowledge_fts JOIN knowledge_items k ON k.rowid=knowledge_fts.rowid';
    const total=db.prepare(`SELECT COUNT(*) n ${from} WHERE ${where}`).get(match,...bind).n;
    if(total){
     const rows=db.prepare(`SELECT ${cols},snippet(knowledge_fts,1,'[[',']]','…',30) snippet ${from} WHERE ${where} ORDER BY k.enabled DESC,bm25(knowledge_fts,6.0,1.0,3.0) ASC LIMIT ? OFFSET ?`).all(match,...bind,lim,off);
     return {total,ranked:true,items:rows.map(shape)};
    }
   }catch(e){console.error('Knowledge search:',e.message);}
  }
  // Fallback: literal substring match, for punctuation-heavy queries the tokenizer cannot express.
  clauses.push('(k.title LIKE ? OR k.tags LIKE ? OR k.body LIKE ?)');for(let i=0;i<3;i++)bind.push('%'+text+'%');
 }
 const where=clauses.length?'WHERE '+clauses.join(' AND '):'';
 const count=db.prepare(`SELECT COUNT(*) n FROM knowledge_items k ${where}`).get(...bind).n;
 const data=db.prepare(`SELECT ${cols},substr(k.body,1,260) snippet FROM knowledge_items k ${where} ORDER BY k.enabled DESC,k.priority DESC,k.updated_at DESC LIMIT ? OFFSET ?`).all(...bind,lim,off);
 return {total:count,ranked:false,items:data.map(shape)};
}
export function getKnowledge(id){initKnowledge();return row(getDb().prepare('SELECT * FROM knowledge_items WHERE id=?').get(id));}
export function saveKnowledge(input,actor='Mike'){
 initKnowledge();const db=getDb(),now=NOW(),id=input.id||randomUUID();
 let existing=db.prepare('SELECT * FROM knowledge_items WHERE id=?').get(id);
 const title=checkText(input.title,200),body=checkText(input.body);
 const category=String(input.category||'custom').slice(0,50);
 const scope=ALLOWED_SCOPE.has(input.scope)?input.scope:'all';
 const trust=ALLOWED_TRUST.has(input.trust)?input.trust:'unverified';
 const tags=Array.isArray(input.tags)?input.tags.map(v=>String(v).slice(0,60)).slice(0,25):String(input.tags||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,25);
 const sourceUrl=String(input.source_url||'').slice(0,1600);
 if(sourceUrl&&!/^https?:\/\//i.test(sourceUrl))throw new Error('Source URL must use http:// or https://.');
 const priority=Math.max(0,Math.min(10,Number(input.priority)||0)),enabled=Number(input.enabled!==false);
 if(existing){
  if(input.revision!==undefined&&Number(input.revision)!==existing.revision)throw new Error('Knowledge record changed since you opened it. Refresh before saving.');
  db.prepare('INSERT INTO knowledge_revisions (id,knowledge_id,revision,title,body,actor,saved_at) VALUES(?,?,?,?,?,?,?)').run(randomUUID(),id,existing.revision,existing.title,existing.body,String(actor).slice(0,80),now);
  db.prepare(`UPDATE knowledge_items SET title=?,body=?,category=?,scope=?,tags=?,trust=?,source_url=?,priority=?,enabled=?,revision=revision+1,updated_at=? WHERE id=?`)
    .run(title,body,category,scope,asJson(tags),trust,sourceUrl,priority,enabled,now,id);
 }else{
  db.prepare(`INSERT INTO knowledge_items(id,source_key,title,category,scope,tags,body,trust,source_type,source_url,priority,enabled,seeded,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,'user:'+id,title,category,scope,asJson(tags),body,trust,'user',sourceUrl,priority,enabled,0,now,now);
 }
 return getKnowledge(id);
}
/** Optional historical source import. Idempotent by source_key, never overwrites user-edited records. */
export function importExternalRecord({source_key,title,body,category,scope='all',trust='reference',source_url='',tags=[],priority=3},force=false){
 initKnowledge();const db=getDb(),now=NOW();
 const key=checkText(source_key,160),name=checkText(title,200),text=checkText(body,60000);
 const old=db.prepare('SELECT * FROM knowledge_items WHERE source_key=?').get(key);
 if(old&&!force)return {id:old.id,status:'skipped',revision:old.revision};
 if(!ALLOWED_SCOPE.has(scope))scope='all';
 if(!ALLOWED_TRUST.has(trust))trust='reference';
 const values=[name,String(category||'historical_task').slice(0,50),scope,asJson((Array.isArray(tags)?tags:[]).slice(0,25)),text,trust,String(source_url||'').slice(0,1600),Math.min(10,Math.max(0,Number(priority)||3)),now];
 if(old){
  db.prepare('INSERT INTO knowledge_revisions (id,knowledge_id,revision,title,body,actor,saved_at) VALUES(?,?,?,?,?,?,?)').run(randomUUID(),old.id,old.revision,old.title,old.body,'Asana source refresh',now);
  db.prepare('UPDATE knowledge_items SET title=?,category=?,scope=?,tags=?,body=?,trust=?,source_url=?,priority=?,updated_at=?,enabled=1,revision=revision+1 WHERE id=?').run(...values,old.id);
  return {id:old.id,status:'updated',revision:old.revision+1};
 }
 const id=randomUUID();
 db.prepare(`INSERT INTO knowledge_items (id,source_key,title,category,scope,tags,body,trust,source_type,source_url,priority,enabled,seeded,created_at,updated_at)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,key,name,values[1],scope,values[3],text,trust,'asana_history',values[6],values[7],1,0,now,now);
 return{id,status:'created',revision:1};
}
export function setKnowledgeEnabled(id,enabled){initKnowledge();const db=getDb();const r=db.prepare('UPDATE knowledge_items SET enabled=?,revision=revision+1,updated_at=? WHERE id=?').run(Number(!!enabled),NOW(),id);if(!r.changes)throw new Error('Knowledge record not found.');return getKnowledge(id);}
export function knowledgeHistory(id){initKnowledge();return getDb().prepare('SELECT revision,title,body,actor,saved_at FROM knowledge_revisions WHERE knowledge_id=? ORDER BY revision DESC LIMIT 20').all(id);}
export function importKnowledge({title,body,category='external_source',scope='all',trust='unverified',source_url='',tags=[]}={},actor='Mike'){
 const all=checkText(body,1000000);const chunks=[];
 // Paragraph-aware segmentation to limit retrieval context and protect small models.
 let current='';for(const para of all.split(/\n\s*\n/)){
  for(let cursor=0;cursor<para.length;cursor+=4500){const part=para.slice(cursor,cursor+4500).trim();if(current.length+part.length>4500&&current){chunks.push(current);current='';}current+=(current?'\n\n':'')+part;}
 }
 if(current)chunks.push(current);
 if(chunks.length>180)throw new Error('Too many chunks in one import. Maximum 180.');
 const out=[];for(let i=0;i<chunks.length;i++)out.push(saveKnowledge({title:`${title} [${i+1}/${chunks.length}]`,body:chunks[i],category,scope,trust,source_url,tags,priority:2,enabled:true},actor));
 return {count:out.length,ids:out.map(x=>x.id)};
}
export function listAgents(){initKnowledge();return getDb().prepare('SELECT * FROM agent_instructions ORDER BY kind').all();}
export function getAgent(kind){initKnowledge();return getDb().prepare('SELECT * FROM agent_instructions WHERE kind=?').get(kind);}
export function saveAgent(kind,{instructions,success_criteria,title,model_role,revision},actor='Mike'){
 initKnowledge();const db=getDb(),existing=getAgent(kind);if(!existing)throw new Error('Unknown agent role.');
 if(revision!==undefined&&Number(revision)!==existing.revision)throw new Error('Agent instructions changed. Reload before saving.');
 const body=checkText(instructions,15000),criteria=checkText(success_criteria,6000);
 db.prepare('UPDATE agent_instructions SET instructions=?,success_criteria=?,title=?,model_role=?,revision=revision+1,updated_at=? WHERE kind=?').run(body,criteria,String(title||existing.title).slice(0,120),String(model_role||existing.model_role).slice(0,80),NOW(),kind);
 return getAgent(kind);
}
export function listPlaybooks(){initKnowledge();return getDb().prepare('SELECT * FROM playbooks ORDER BY title').all().map(p=>({...p,default_outputs:parse(p.default_outputs,[])}));}

function queryTerms(task,kind){
 let text=[task.title,task.topic,task.objective,task.audience,task.primary_keyword,...task.secondary_keywords||[],task.channel,task.voice,kind,task.instructions?.slice(0,600)].join(' ');
 let terms=[...new Set((text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]).filter(x=>!stop.has(x)))];
 return terms.slice(0,18);
}
function targetKeys(task,kind){
 const x=['foundation:positioning','policy:claims','policy:research',task.voice==='founder'?'foundation:founder-voice':'foundation:company-voice'];
 if(task.channel==='website')x.push('foundation:home','workflow:mpfresh','method:seo');
 else x.push('workflow:social','method:channel');
 if(kind==='graphics')x.push('workflow:graphics','reference:brand-guidelines');
 if(kind==='qa')x.push('policy:qa','method:failure');
 if(kind==='brief')x.push('method:commissioning');
 return x;
}
/** Build context within a bounded character/token budget; provenance is first-class. */
export function assembleKnowledge(task,kind,{budgetChars=19000}={}){
 initKnowledge();const db=getDb();
 const budget=Math.max(4000,Math.min(35000,Number(budgetChars)||19000));
 const must=targetKeys(task,kind);
 const selected=[],seen=new Set();let used=0;
 const pick=(r,reason,cap)=>{
  if(!r||!r.enabled||seen.has(r.id)||!matchScope(r,task))return;
  const room=budget-used;
  if(room<300)return;
  let body=r.body;
  const maxLen=Math.min(cap,room-200);
  if(body.length>maxLen)body=body.slice(0,maxLen)+'\n[Excerpt truncated; use original source for full details.]';
  selected.push({id:r.id,source_key:r.source_key,title:r.title,category:r.category,trust:r.trust,source_url:r.source_url,reason,body,chars:body.length});
  used+=body.length+250;seen.add(r.id);
 };
 for(const key of must){const item=db.prepare('SELECT * FROM knowledge_items WHERE source_key=? AND enabled=1').get(key);pick(item,'standard',kind==='draft'?2350:1700);}
 const refs={brief:['03','10','21'],draft:task.channel==='website'?['04']:['04','11'],graphics:['05','20'],qa:['22']};
 for(const num of refs[kind]||[]){const item=db.prepare('SELECT * FROM knowledge_items WHERE source_key=? AND enabled=1').get('agent-ref:'+num);pick(item,'original_agent',kind==='draft'?1800:1200);}
 const terms=queryTerms(task,kind);
 if(terms.length){
  const fts=terms.map(t=>'"'+t.replaceAll('"','')+'"').join(' OR ');
  try{
   const rows=db.prepare(`SELECT k.*,bm25(knowledge_fts,5.0,1.0,2.5) as rank
     FROM knowledge_fts JOIN knowledge_items k ON k.rowid=knowledge_fts.rowid
     WHERE knowledge_fts MATCH ? AND k.enabled=1 ORDER BY rank ASC LIMIT 80`).all(fts);
   // Rank with priority and matchScope; draft samples should supplement, not override.
   rows.sort((a,b)=>{
    const calc=r=>(-r.rank)+r.priority*0.18+(r.trust==='policy'?1.3:r.trust==='source'?0.7:0)-(r.trust==='draft'?1.0:0);
    return calc(b)-calc(a);
   });
   let examples=0;for(const r of rows){if(!matchScope(r,task)||seen.has(r.id))continue;
     if(r.category==='historical_draft'&&examples>=2)continue;
     if(r.category==='historical_draft')examples++;
     pick(r,'topic_match',r.category==='historical_draft'?1400:2000);
     if(selected.length>=17||used>=budget-350)break;
   }
  }catch(e){console.error('Knowledge FTS:',e.message);}
 }
 const context=selected.map((r,i)=>`<KNOWLEDGE_SOURCE index="${i+1}" id="${r.id}" trust="${r.trust}" type="${r.category}" origin="${r.reason}">\nTITLE: ${r.title}\nSOURCE: ${r.source_url||'Internal curated record'}\n${r.body}\n</KNOWLEDGE_SOURCE>`).join('\n\n');
 return {context,selected:selected.map(({body,...r})=>({...r,snippet:body.slice(0,270)})),estimatedTokens:Math.ceil(context.length/3.7),budgetChars:budget,queryTerms:terms};
}
export function recordKnowledgeUsage(jobId,refs){initKnowledge();const db=getDb();const stmt=db.prepare('INSERT OR IGNORE INTO knowledge_usage (id,job_id,knowledge_id,title,trust,reason,char_count,recorded_at) VALUES(?,?,?,?,?,?,?,?)');for(const item of refs||[])stmt.run(randomUUID(),jobId,item.id,item.title,item.trust,item.reason,item.chars,NOW());}
export function getKnowledgeUsage(taskId){initKnowledge();return getDb().prepare(`SELECT ku.*,j.kind,j.status,j.created_at job_created_at FROM knowledge_usage ku JOIN jobs j ON j.id=ku.job_id WHERE j.task_id=? ORDER BY j.created_at DESC,ku.recorded_at DESC LIMIT 100`).all(taskId);}
