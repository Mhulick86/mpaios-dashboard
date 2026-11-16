import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const temp=mkdtempSync(join(tmpdir(),'maios-test-'));
let serverProc,modelServer;
const port=47770+Math.floor(Math.random()*900);
const mport=48770+Math.floor(Math.random()*900);
const API=`http://127.0.0.1:${port}`;

async function request(path,method='GET',body){
 const r=await fetch(API+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json();if(!r.ok)throw new Error(`${r.status}: ${data.error}`);return data;
}
async function waitFor(fn,timeout=45000){const deadline=Date.now()+timeout;while(Date.now()<deadline){const v=await fn();if(v)return v;await sleep(700);}throw new Error('Timed out waiting for state change.');}

function modelStub(req,res){
 if(req.url==='/v1/models'){
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({data:[{id:'local-test-instruct',owned_by:'local'}]}));return;
 }
 if(req.url==='/v1/chat/completions'){
  let text='';req.on('data',x=>text+=x);req.on('end',()=>{
   const q=JSON.parse(text);assert.equal(q.model,'local-test-instruct');
   assert(q.messages[0].content.includes('EDITABLE MAIOS SPECIALIST INSTRUCTIONS'));
   assert(q.messages.at(-1).content.includes('BOUNDED KNOWLEDGE CONTEXT'));
   const prompt=q.messages.at(-1).content;
   const result=prompt.includes('Editorial')?'## Content strategy\nOriginal insight.\n## CTA\nRead more.':
    prompt.includes('visual concepts')?'## Graphic 1\nA process diagram showing how qualified leads move through a system.':
    prompt.includes('publication readiness')?'## Verdict\nPASS\n## Findings\nNo issues detected in stub.':
    '# Content generated\nA concrete marketing system delivers better measurement than isolated campaigns.\n\n## Evidence\nOnly verified claims should be published.\n\n## CTA\nTalk to the team.';
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{role:'assistant',content:result}}]}));
  });return;
 }
 res.writeHead(404);res.end();
}

test('commission, generate, QA, review, publish, and export without n8n',async(t)=>{
  modelServer=http.createServer(modelStub);
  await new Promise(resolve=>modelServer.listen(mport,'127.0.0.1',resolve));
  serverProc=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url).pathname,
    env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:temp,NO_DEMO_SEED:'1',LM_STUDIO_BASE_URL:`http://127.0.0.1:${mport}/v1`,STUDIO_MODEL_BRIEF:'lmstudio:auto',STUDIO_MODEL_DRAFT:'lmstudio:auto',STUDIO_MODEL_GRAPHICS:'lmstudio:auto',STUDIO_MODEL_QA:'lmstudio:auto',AUTO_GENERATE_ON_MOVE:'true'},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{serverProc.kill('SIGTERM');modelServer.closeAllConnections?.();await new Promise(resolve=>modelServer.close(resolve));rmSync(temp,{recursive:true,force:true});});
  let stderr='';serverProc.stderr.on('data',c=>stderr+=c.toString());
  await waitFor(async()=>{try{return(await request('/api/health')).ok}catch{return false}},14000);
  let b=await request('/api/bootstrap');
  assert.equal(b.boards.length,2);assert.equal(b.lanes.length,16);assert.equal(b.tasks.length,0);
  const models=await request('/api/models');assert.equal(models.connected,true);assert.equal(models.ai.stages.draft,'lmstudio:auto');
  const order=await request('/api/commission','POST',{
    topic:'Owned AI vs rented marketing intelligence for hospital systems',outputs:['website','linkedin'],voice:'founder',priority:'P1',
    audience:'Hospital CMOs',objective:'Explain infrastructure economics',primary_keyword:'AI data sovereignty',
    secondary_keywords:['marketing intelligence','local AI'],source_urls:['https://example.org/source'],word_count:1200,graphics_count:2,reviewer:'Mike'
  });
  assert.equal(order.tasks.length,2);const website=order.tasks.find(x=>x.channel==='website'),social=order.tasks.find(x=>x.channel==='linkedin');
  assert(website);assert(social);assert.equal(website.campaign_id,social.campaign_id);
  assert.equal(website.lane_id,'mpfresh:backlog');assert.equal(social.lane_id,'social:post_plan');
  await request(`/api/tasks/${website.id}/comment`,'POST',{author:'Emily',text:'Use an operator-led narrative and evidence.'});
  await request(`/api/tasks/${website.id}/move`,'POST',{laneId:'mpfresh:ready_brief'});
  let task=await waitFor(async()=>{const x=await request(`/api/tasks/${website.id}`);return x.lane_id==='mpfresh:brief_complete'?x:false});
  assert(task.artifacts.some(a=>a.kind==='brief'));
  const usedSources=await request(`/api/tasks/${website.id}/sources`);assert(usedSources.length>=4);
  assert(usedSources.some(x=>x.reason==='standard'));
  await request(`/api/tasks/${website.id}/move`,'POST',{laneId:'mpfresh:ready_writing'});
  task=await waitFor(async()=>{const x=await request(`/api/tasks/${website.id}`);return x.lane_id==='mpfresh:draft_complete'?x:false});
  assert(task.artifacts.some(a=>a.kind==='draft'));
  await request(`/api/tasks/${website.id}/move`,'POST',{laneId:'mpfresh:graphics'});
  task=await waitFor(async()=>{const x=await request(`/api/tasks/${website.id}`);return x.artifacts.some(a=>a.kind==='graphics')?x:false});
  await request(`/api/tasks/${website.id}/move`,'POST',{laneId:'mpfresh:final_approval'});
  task=await waitFor(async()=>{const x=await request(`/api/tasks/${website.id}`);return x.artifacts.some(a=>a.kind==='qa')?x:false});
  assert(task.comments.length===1);assert.equal(task.related.length,1);
  const approval=await request(`/api/tasks/${website.id}/approve`,'POST',{});
  assert.equal(approval.lane_id,'mpfresh:ship_dev');assert(approval.approved_at);
  const published=await request(`/api/tasks/${website.id}/publish`,'POST',{url:'https://marketingpowered.ai/resources/example'});
  assert(published.published_at);
  await request(`/api/tasks/${social.id}/move`,'POST',{laneId:'social:content_drafting'});
  const ready=await waitFor(async()=>{const x=await request(`/api/tasks/${social.id}`);return x.lane_id==='social:content_review'?x:false});
  assert(ready.artifacts.some(a=>a.kind==='draft'));
  const patched=await request(`/api/tasks/${social.id}`,'PATCH',{title:'A better LinkedIn angle',priority:'P0',owner:'Rimsha'});
  assert.equal(patched.priority,'P0');
  const manual=await request(`/api/tasks/${social.id}/artifact`,'POST',{kind:'draft',body:'Edited founder post with specific analysis and a clear business lesson.'});
  assert.equal(manual.artifacts.filter(a=>a.kind==='draft').length,2);
  const exported=await request('/api/export');assert.equal(exported.tasks.length,2);assert(exported.events.length>8);
  const mockFile=Buffer.from('%PDF-1.7\nHello pdf data');
  const asset=await request(`/api/tasks/${website.id}/asset`,'POST',{name:'notes.pdf',mime:'application/pdf',data:mockFile.toString('base64')});
  assert.equal(asset.assets.length,1);
  const response=await fetch(`${API}/api/assets/${asset.assets[0].id}`);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');
  const cleared=await request('/api/demo/clear','POST',{});assert.equal(cleared.removed,0);
  assert(!stderr.includes('Error:'),stderr);
});
