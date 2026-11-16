// One-time historic Asana snapshot import. No n8n, no ongoing Asana dependency.
// Usage: ASANA_TOKEN=... node scripts/import-asana.mjs [mpfresh|social] [--dry-run] [--with-comments]
import { getDb, event } from '../db.mjs';
import { randomUUID } from 'node:crypto';
const token=process.env.ASANA_TOKEN;
if(!token){console.error('Missing ASANA_TOKEN. Set it for this command only. Do not commit it.');process.exit(2);}
const mode=process.argv.find(x=>['mpfresh','social','all'].includes(x))||'mpfresh';
const dry=process.argv.includes('--dry-run'),withComments=process.argv.includes('--with-comments');
const projects={mpfresh:'1214665626602388',social:'1215434213307280'};
const db=dry?null:getDb();
async function asana(path){
 const r=await fetch('https://app.asana.com/api/1.0'+path,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
 if(!r.ok)throw new Error(`Asana HTTP ${r.status}: ${(await r.text()).slice(0,280)}`);
 return(await r.json());
}
async function pages(path){let items=[],offset=null;do{
 const url=path+(offset?(path.includes('?')?'&':'?')+'offset='+encodeURIComponent(offset):'');
 const res=await asana(url);items.push(...(res.data||[]));offset=res.next_page?.offset||null;
}while(offset);return items;}
function deriveField(notes,pattern){return(notes.match(pattern)||[])[1]?.trim()||'';}
async function importBoard(name){
 const project=projects[name],fields=['gid','name','notes','completed','completed_at','created_at','due_on','assignee.name','permalink_url','memberships.project.gid','memberships.section.gid','memberships.section.name'];
 const tasks=await pages(`/tasks?project=${project}&limit=100&opt_fields=${fields.join(',')}`);
 const current=db?.prepare('SELECT id,name,slug FROM lanes WHERE board_id=?').all(name)||[];
 const laneNames=Object.fromEntries(current.map(s=>[s.name.toLowerCase(),s.id]));
 const fallback=name==='mpfresh'?'mpfresh:backlog':'social:post_plan';
 console.log(`${name}: received ${tasks.length} Asana tasks`);
 let added=0,updated=0,commentsAdded=0;
 for(const t of tasks){
  const membership=(t.memberships||[]).find(x=>x.project?.gid===project)||(t.memberships||[])[0];
  const stage=membership?.section?.name||'';
  const lane=laneNames[stage.toLowerCase()]||fallback;
  const notes=t.notes||'';
  const keyword=deriveField(notes,/(?:Primary Keyword|Focus Keyword)\s*:\s*([^\n]+)/i);
  const wordCount=Number(deriveField(notes,/(?:Target Word Count|Word Count|Wordcount)\s*:\s*([\d,]+)/i).replace(',','')) || (name==='mpfresh'?1500:230);
  const links=[...new Set((notes.match(/https?:\/\/[^\s<>"')]+/g)||[]).map(x=>x.replace(/[.,;]+$/,'')))].slice(0,20);
  const priority=deriveField(notes,/(?:Priority Group|Priority)\s*:\s*(P[0-3])/i)||'P2';
  console.log(`  ${stage||'(unsectioned)'} / ${t.name} -> ${lane}`);
  if(dry)continue;
  const existing=db.prepare('SELECT * FROM tasks WHERE asana_gid=?').get(t.gid);
  const id=existing?.id||randomUUID(),now=new Date().toISOString();
  if(existing){
    db.prepare('UPDATE tasks SET title=?,lane_id=?,owner=?,due_date=?,instructions=?,source_urls=?,primary_keyword=?,word_count=?,updated_at=? WHERE id=?')
      .run(t.name,lane,t.assignee?.name||'Unassigned',t.due_on||null,notes,JSON.stringify(links),keyword,wordCount,now,id);
    updated++;
  }else{
    const sort=db.prepare('SELECT COALESCE(MAX(sort_order),0)+1 n FROM tasks WHERE lane_id=?').get(lane)?.n||1;
    db.prepare(`INSERT INTO tasks (id,board_id,lane_id,title,content_type,channel,priority,owner,reviewer,topic,objective,audience,primary_keyword,secondary_keywords,source_urls,due_date,word_count,graphics_count,voice,cta,instructions,created_at,updated_at,sort_order,demo,asana_gid) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,name,lane,t.name,name==='mpfresh'?'article':'company_post',name==='mpfresh'?'website':'linkedin',priority,t.assignee?.name||'Unassigned','Mike',t.name,'Replicate historic Asana commission','',keyword,'[]',JSON.stringify(links),t.due_on||null,wordCount,3,'company','',notes,t.created_at||now,now,sort,0,t.gid);
    event(id,'imported','Imported historical Asana task','Asana',{asana_gid:t.gid,source:t.permalink_url,original_completed:!!t.completed,original_completed_at:t.completed_at||null});
    added++;
  }
  if(withComments){
    const stories=await pages(`/tasks/${t.gid}/stories?limit=100&opt_fields=gid,resource_subtype,text,created_at,created_by.name`);
    for(const s of stories.filter(x=>x.resource_subtype==='comment_added' && x.text)){
      const marker=`[Asana ${s.gid}]`;
      if(db.prepare('SELECT 1 FROM comments WHERE task_id=? AND body LIKE ?').get(id,marker+'%'))continue;
      db.prepare('INSERT INTO comments (id,task_id,author,body,created_at) VALUES (?,?,?,?,?)')
        .run(randomUUID(),id,s.created_by?.name||'Asana',marker+' '+s.text,s.created_at||now);
      commentsAdded++;
    }
  }
 }
 console.log(`RESULT ${name}: ${added} new, ${updated} updated, ${commentsAdded} comments imported${dry?' (DRY RUN)':''}`);
}
for(const name of mode==='all'?['mpfresh','social']:[mode])await importBoard(name);
