import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,timeout=12000){let end=Date.now()+timeout;while(Date.now()<end){try{const value=await fn();if(value)return value;}catch{}await sleep(150);}throw new Error('Timed out connecting to test API');}

test('source-tagged knowledge, original agent instructions, provenance, and editing are live',async t=>{
 const path=mkdtempSync(join(tmpdir(),'maios-kb-test-'));
 const port=49000+Math.floor(Math.random()*1000),origin=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['server.mjs'],{
  cwd:new URL('../',import.meta.url).pathname,
  env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:path,NO_DEMO_SEED:'1',AUTO_GENERATE_ON_MOVE:'false',LM_STUDIO_BASE_URL:'http://127.0.0.1:1/v1'},
  stdio:['ignore','pipe','pipe']
 });
 let stderr='';child.stderr.on('data',c=>stderr+=c);
 t.after(()=>{child.kill('SIGTERM');rmSync(path,{recursive:true,force:true});});
 async function api(endpoint,method='GET',payload){
  const response=await fetch(origin+endpoint,{method,headers:{'Content-Type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload)});
  const body=await response.json();if(!response.ok)throw new Error(`HTTP ${response.status} ${JSON.stringify(body)}`);return body;
 }
 await until(async()=>{let s=await api('/api/health');return s.ok&&s.knowledge.total===149;});
 const stats=await api('/api/knowledge/stats');
 assert.equal(stats.total,149);assert.equal(stats.agents,4);assert.equal(stats.playbooks,7);
 assert.equal(stats.byCategory.find(x=>x.category==='agent_reference').n,33);
 assert.equal(stats.byCategory.find(x=>x.category==='historical_draft').n,70);
 const history=await api('/api/knowledge?category=historical_draft&limit=100');
 assert.equal(history.total,70);assert(history.items.every(x=>x.trust==='draft'));
 const specific=await api('/api/knowledge?q=Meta%20ads&limit=15');
 assert(specific.total>0);
 const record=history.items.find(x=>/LinkedIn/i.test(x.title));assert(record);
 const full=await api(`/api/knowledge/${record.id}`);assert(full.body.length>100);
 assert(full.source_url.startsWith('https://docs.google.com/'));
 const original=await api('/api/knowledge?category=agent_reference&limit=100');
 assert(original.items.some(x=>/Authority Content Strategist/i.test(x.title)));
 const agents=await api('/api/agents');
 assert.equal(agents.length,4);
 const playbooks=await api('/api/playbooks');
 assert(playbooks.some(x=>/Founder/i.test(x.title)));
 const order=await api('/api/commission','POST',{
  topic:'Owned AI intelligence infrastructure for hospital marketing',
  outputs:['linkedin'],voice:'founder',priority:'P1',audience:'Hospital CMOs',
  objective:'Contrast private inference with rented marketing intelligence',primary_keyword:'AI marketing infrastructure',
  word_count:320,graphics_count:2
 });
 const task=order.tasks[0];
 const inspect=await api(`/api/tasks/${task.id}/context?kind=draft`);
 assert(inspect.sources.length>=5);
 assert(inspect.user.includes('BOUNDED KNOWLEDGE CONTEXT'));
 assert(inspect.user.includes('KNOWLEDGE_SOURCE'));
 assert(inspect.system.includes('EDITABLE MAIOS SPECIALIST INSTRUCTIONS'));
 assert(inspect.system.includes('Never invent company outcomes'));
 assert(inspect.sources.some(x=>x.source_key==='foundation:founder-voice'));
 assert(inspect.sources.some(x=>x.source_key==='policy:claims'));
 assert(inspect.sources.some(x=>x.category==='agent_reference'));
 assert(inspect.sources.every(x=>x.chars>0));
 assert(!inspect.user.includes('https://drive.google.com/file/d/marketing-powered-brand-guidelines/view'));
 const originalInstructions=agents.find(x=>x.kind==='draft');
 const customMarker='Be specific about cash flows, governance, and ownership.';
 await api('/api/agents/draft','PATCH',{
  title:originalInstructions.title,
  model_role:originalInstructions.model_role,
  instructions:originalInstructions.instructions+'\n'+customMarker,
  success_criteria:originalInstructions.success_criteria,
  revision:originalInstructions.revision
 });
 const changed=await api(`/api/tasks/${task.id}/context?kind=draft`);
 assert(changed.system.includes(customMarker));
 const inserted=await api('/api/knowledge','POST',{
  title:'Verified operating rule for knowledge test',category:'policy',scope:'founder',trust:'policy',
  body:'Evidence should always have an explicit reference and a stated publication approval.',
  tags:['evidence','test'],priority:10,enabled:true
 });
 assert(inserted.id);assert.equal(inserted.revision,1);
 const updated=await api(`/api/knowledge/${inserted.id}`,'PATCH',{
  ...inserted,title:'Updated verified knowledge rule',body:inserted.body+' Always cite primary sources.',priority:9
 });
 assert.equal(updated.revision,2);
 const revs=await api(`/api/knowledge/${inserted.id}/history`);assert(revs.length===1);
 assert.equal(revs[0].revision,1);
 const disabled=await api(`/api/knowledge/${inserted.id}/enabled`,'PATCH',{enabled:false});assert.equal(disabled.enabled,false);
 const imported=await api('/api/knowledge/import','POST',{
  title:'User-supplied plan',body:'This document is an unverified operational reference.\n\nSecond section with workflow assumptions and no confirmed platform access.',
  category:'external_source',scope:'all',trust:'unverified'
 });assert.equal(imported.count,1);
 const exported=await api('/api/export');
 assert(exported.knowledge.length>=151);
 assert.equal(exported.agents.length,4);
 assert.equal(exported.playbooks.length,7);
 assert(!stderr.includes('Error:'),stderr);
});
