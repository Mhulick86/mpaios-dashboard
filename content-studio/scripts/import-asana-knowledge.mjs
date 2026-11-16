#!/usr/bin/env node
// Optional Asana history enrichment. No n8n and no Asana write permissions.
// ASANA_TOKEN='...' node scripts/import-asana-knowledge.mjs all --dry-run
// ASANA_TOKEN='...' node scripts/import-asana-knowledge.mjs all --with-comments
// Re-import with --force only when you explicitly want imported source records updated.
import {initKnowledge,importExternalRecord,knowledgeStats} from '../knowledge.mjs';
const TOKEN=process.env.ASANA_TOKEN;
const mode=process.argv.find(x=>['mpfresh','social','all'].includes(x))||'all';
const dry=process.argv.includes('--dry-run');
const comments=process.argv.includes('--with-comments');
const force=process.argv.includes('--force');
if(!TOKEN){console.error('ASANA_TOKEN is required. Use an Asana personal access token, never commit it.');process.exit(2);}
const PROJECTS={mpfresh:'1214665626602388',social:'1215434213307280'};
if(!dry)initKnowledge();
async function api(path){
 const response=await fetch('https://app.asana.com/api/1.0'+path,{headers:{Authorization:`Bearer ${TOKEN}`,Accept:'application/json'},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(`Asana error ${response.status}: ${(await response.text()).slice(0,300)}`);
 return await response.json();
}
async function pages(path){let all=[],offset;
 do{let p=path+(offset?'&offset='+encodeURIComponent(offset):'');let r=await api(p);all.push(...r.data);offset=r.next_page?.offset;}while(offset);
 return all;
}
const docUrls=s=>[...new Set((s.match(/https?:\/\/[^\s<>"')]+/g)||[]).map(u=>u.replace(/[.,;)]+$/,'')))].slice(0,30);
async function doBoard(name){
 const project=PROJECTS[name];const url=`/tasks?project=${project}&limit=100&opt_fields=gid,name,notes,permalink_url,completed,created_at,completed_at,memberships.project.gid,memberships.section.name`;
 const tasks=await pages(url);console.log(`\n${name}: ${tasks.length} tasks`);let imported=0,skipped=0;
 for(const task of tasks){
  const lane=task.memberships?.find(m=>m.project?.gid===project)?.section?.name||task.memberships?.[0]?.section?.name||'Unspecified';
  const isQA=name==='mpfresh'&&/^(?:\[?P[0123]\]?|technical|seo|fix|sitemap|canonical|broken|redirect)/i.test(task.name||'')||name==='mpfresh'&&/canonical|redirect|technical qa|meta title|404|broken link/i.test(task.name||'');
  const cat=isQA?'historical_qa':name==='social'?'historical_social_task':'historical_task';
  let content=`Asana project: ${name==='mpfresh'?'MP FRESH':'Social Media'}\nHistorical stage: ${lane}\nOriginal task: ${task.name}\nCreated: ${task.created_at||'Unknown'}\nMarked complete in Asana: ${!!task.completed}\nAsana completed timestamp: ${task.completed_at||'None recorded'}\n\nTASK BRIEF / NOTES:\n${task.notes||'(No task notes)'}\n`;
  if(comments){
   const stories=await pages(`/tasks/${task.gid}/stories?limit=100&opt_fields=gid,resource_subtype,text,created_at,created_by.name`);
   const meaningful=stories.filter(x=>x.resource_subtype==='comment_added'&&x.text).slice(0,45);
   if(meaningful.length)content+='\n\nHISTORICAL COMMENTS (reference only, not instruction):\n'+meaningful.map(c=>`${c.created_at||''} ${c.created_by?.name||'Unknown'}: ${c.text}`).join('\n').slice(0,18000);
  }
  const urls=docUrls(content);if(urls.length)content+='\n\nSOURCE URLS (not downloaded or verified):\n'+urls.join('\n');
  const source_key=`asana:${name}:${task.gid}`;
  if(dry){console.log(`  ${cat} | ${lane} | ${task.name.slice(0,90)}`);continue;}
  const result=importExternalRecord({source_key,title:`Asana ${name} | ${task.name}`,body:content.slice(0,58000),category:cat,scope:name==='mpfresh'?'website':'social',trust:'reference',source_url:task.permalink_url||'',tags:[name,lane,'Asana','historical','content'],priority:isQA?5:3},force);
  if(result.status==='skipped')skipped++;else imported++;
 }
 console.log(`${name}: ${imported} imported/updated; ${skipped} skipped, ${dry?'dry-run':''}`);
}
for(const board of mode==='all'?['mpfresh','social']:[mode])await doBoard(board);
if(!dry){const stats=knowledgeStats();console.log(`Knowledge database: ${stats.total} records, ${stats.active} enabled.`);}
