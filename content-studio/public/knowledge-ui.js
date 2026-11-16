/**
 * Knowledge Library and Specialist Instruction Studio for MAIOS Content Studio.
 * All data and edits persist on the studio backend (local SQLite, or private Vercel Blob storage inside MAIOS).
 */
export function makeKnowledgeUI({api,html,toast,commissionModal}){
 const $=(q,root=document)=>root.querySelector(q);
 const $all=(q,root=document)=>[...root.querySelectorAll(q)];
 let records=[],total=0,stats=null,agents=[],playbooks=[],selected=null,editorType=null,promptKind='draft',timer=null,loading=false,filter={q:'',category:''};
 const catLabels={brand_strategy:'Brand strategy',voice:'Brand voice',workflow:'Production SOPs',policy:'Compliance & QA',domain:'Domain intelligence',visual:'Creative guidelines',source_document:'Official sources',agent_reference:'Original MPAIOS agents',historical_draft:'Historical social drafts',strategy_draft:'Working strategy drafts',custom:'Custom knowledge',external_source:'Imported source'};
 const trusted={policy:'Policy',source:'Original source',observed:'Observed workflow',reference:'Reference',draft:'Unapproved draft',unverified:'Unverified'};
 const isGoodLink=url=>{try{const u=new URL(url);return u.protocol==='https:'||u.protocol==='http:'?u.href:'#'}catch{return '#'}};
 const short=(str,n=180)=>String(str||'').length>n?String(str).slice(0,n)+'…':String(str||'');
 const marked=str=>html(str).replace(/\[\[/g,'<mark>').replace(/\]\]/g,'</mark>');
 const topLine=()=>`<div class="kb-hero-sub">${stats?.active??0} enabled knowledge records · ${stats?.agents??0} original execution roles · ${stats?.playbooks??0} commission playbooks</div>`;
 function getPlaybooks(){return playbooks;}
 function getStats(){return stats;}
 async function initialize(){
  try{const [a,p,s]=await Promise.all([api('/api/agents'),api('/api/playbooks'),api('/api/knowledge/stats')]);agents=a;playbooks=p;stats=s;$('#knowledgeNavCount').textContent=s.active;return true;}
  catch(err){console.error('KB initialize:',err);return false;}
 }
 async function loadKnowledge(keepQuery=true){
  loading=true;
  try{const q=encodeURIComponent(filter.q||''),cat=encodeURIComponent(filter.category||'');const r=await api(`/api/knowledge?q=${q}&category=${cat}&limit=250`);
   records=r.items;total=r.total;stats=await api('/api/knowledge/stats');$('#knowledgeNavCount').textContent=stats.active;
   renderKnowledge();
  }catch(err){toast('Knowledge retrieval failed: '+err.message,'error');}finally{loading=false;}
 }
 function metricsMarkup(){
  const active=stats?.active??0,original=(stats?.byCategory||[]).find(x=>x.category==='agent_reference')?.n??0,
    historical=(stats?.byCategory||[]).find(x=>x.category==='historical_draft')?.n??0,policy=(stats?.byCategory||[]).filter(x=>['policy','voice','workflow','domain','brand_strategy','visual'].includes(x.category)).reduce((s,x)=>s+x.n,0);
  return [['KNOWLEDGE ITEMS',active,'Enabled and searchable','◈'],['ORIGINAL AGENTS',original,'MPAIOS role source material','✧'],['SOCIAL DRAFTS',historical,'Historical LinkedIn + Facebook','▤'],['OPERATING RULES',policy,'Voice, QA, workflow, strategy','✓']].map(([label,num,sub,ico])=>`<div class="metric"><div class="metric-top"><span>${label}</span><span class="metric-icon">${ico}</span></div><div class="metric-value">${num}</div><div class="metric-foot">${html(sub)}</div></div>`).join('');
 }
 function renderKnowledge(){
  const board=$('#board'),list=$('#listView');if(!list)return;
  board.hidden=true;list.hidden=false;
  const cats=stats?.byCategory||[],items=records;
  list.innerHTML=`<div class="kb-shell">
    <div class="kb-heading"><div><div class="eyebrow">PROVENANCE-AWARE INTELLIGENCE</div><h2>Knowledge library</h2><p>Original Marketing Powered documents, operating policies and historic examples. Every item is traceable, searchable, editable and versioned.</p></div><div class="kb-heading-actions"><button class="button ghost" id="kbImportBtn">↑ Import text</button><button class="button primary" id="kbAddBtn">＋ New knowledge</button></div></div>
    <div class="kb-infobar"><span>▣ Ranked local full-text search</span><span>◈ ${total} matching records</span><span>✓ Source trust labels</span><span>⛨ Human editable</span></div>
    <div class="kb-columns">
      <aside class="kb-filters"><h3>Collections</h3><button class="kb-filter ${!filter.category?'active':''}" data-kb-category=""><span>All sources</span><span>${stats?.total??0}</span></button>${cats.map(c=>`<button class="kb-filter ${filter.category===c.category?'active':''}" data-kb-category="${html(c.category)}"><span>${html(catLabels[c.category]||c.category)}</span><span>${c.n}</span></button>`).join('')}<div class="kb-filter-help">The archive includes unapproved drafts. They are reference examples, not verified claims or evidence of publication.</div></aside>
      <section class="kb-results"><div class="kb-results-toolbar"><div class="kb-search-shell"><span>⌕</span><input id="kbSearch" type="search" value="${html(filter.q)}" autocomplete="off" placeholder="Search topics, rules, examples, or sources" /></div><span>${items.length} shown</span></div>
      <div class="kb-record-list">${items.map(x=>`<button class="kb-record ${x.enabled?'':'kb-disabled'}" data-kb-id="${html(x.id)}"><div class="kb-record-top"><span class="kb-source-type">${html(catLabels[x.category]||x.category)}</span><span class="kb-trust ${html(x.trust)}">${html(trusted[x.trust]||x.trust)}</span><span class="kb-priority">P${x.priority}</span>${!x.enabled?'<span class="kb-trust draft">Disabled</span>':''}</div><strong>${html(x.title)}</strong><p>${marked(short(x.snippet,240))}</p><div class="kb-record-footer"><span>${html(x.source_type||'Internal')}</span><span>${html(x.scope)}</span><span>v${x.revision}</span><span>${x.seeded?'Source archive':'Added manually'}</span></div></button>`).join('')||'<div class="kb-empty">No matching knowledge. Try another category or search.</div>'}</div>
      ${total>items.length?`<p class="kb-limit-note">Showing ${items.length} of ${total}. Narrow the search to find additional records.</p>`:''}
      </section>
    </div>
  </div>`;
 }
 function renderInstructions(){
  const board=$('#board'),list=$('#listView');if(!list)return;board.hidden=true;list.hidden=false;
  list.innerHTML=`<div class="kb-shell"><div class="kb-heading"><div><div class="eyebrow">CODE-BASED AGENT EXECUTION</div><h2>Agent instruction studio</h2><p>Four stage-specific specialists backed by the original 33-agent MPAIOS reference library. Edit behavioral rules without changing application code.</p></div><div class="kb-heading-actions"><button class="button ghost" data-kb-open="knowledge">Open knowledge library ↗</button></div></div>
  <div class="agent-intro"><div class="agent-intro-icon">✧</div><div><strong>These instructions are sent with every model request.</strong><p>Every generation combines a fixed safety baseline, the selected specialist's editable rules, the task commission, previous artifacts, voice profile and a bounded set of relevant knowledge excerpts.</p></div></div>
  <div class="kb-section-title"><h3>Execution specialists</h3><span>4 active stages</span></div><div class="agent-grid">${agents.map(x=>`<button class="agent-card" data-agent-kind="${html(x.kind)}"><div class="agent-card-head"><div class="agent-symbol">${{brief:'◎',draft:'✎',graphics:'▧',qa:'✓'}[x.kind]}</div><span class="kb-trust policy">Revision ${x.revision}</span></div><h3>${html(x.title)}</h3><p>${html(short(x.instructions,260))}</p><div class="agent-card-foot"><span>${html(x.model_role.split('_').join(' '))}</span><strong>Open instructions →</strong></div></button>`).join('')}</div>
  <div class="kb-section-title"><h3>Commission playbooks</h3><span>${playbooks.length} ready-to-use production patterns</span></div>
  <div class="playbook-grid">${playbooks.map(p=>`<div class="playbook-card"><div class="playbook-icon">▦</div><h3>${html(p.title)}</h3><p>${html(p.description)}</p><div class="playbook-badges">${p.default_outputs.map(ch=>`<span>${html(ch)}</span>`).join('')}</div><div class="playbook-bottom"><small>${html(p.voice)} voice · ${p.graphics_count} visuals</small><button class="command-btn" data-use-playbook="${html(p.id)}">Commission ↗</button></div><div class="playbook-criteria">${html(p.acceptance)}</div></div>`).join('')}</div>
  <div class="agent-footnote">The full historical agent library is available under Knowledge library → Original MPAIOS agents. The historical content drafts are examples, not authoritative facts. Publication always requires human approval.</div></div>`;
 }
 function close(){selected=null;editorType=null;$('#knowledgeBackdrop').hidden=true;$('#knowledgeDrawer').hidden=true;}
 function openPanel(){ $('#knowledgeBackdrop').hidden=false;$('#knowledgeDrawer').hidden=false; }
 function editorSelect(name,values,value){return `<select name="${name}">${values.map(v=>`<option value="${html(v)}" ${v===value?'selected':''}>${html(catLabels[v]||v)}</option>`).join('')}</select>`;}
 async function openKnowledge(id){
  try{
   editorType='knowledge';selected=id?await api('/api/knowledge/'+id):null;openPanel();renderKnowledgeEditor();
  }catch(err){toast(err.message,'error');}
 }
 function renderKnowledgeEditor(){
  const d=selected??{id:null,title:'',body:'',category:'custom',scope:'all',trust:'unverified',tags:[],priority:3,source_url:'',revision:1,enabled:true};
  const drawer=$('#knowledgeDrawer');
  drawer.innerHTML=`<div class="drawer-header"><div class="drawer-eyebrow">KNOWLEDGE RECORD / ${d.id?'EDIT':'NEW'} / ${html(d.source_type||'USER')}</div><div class="drawer-actions"><button class="icon-btn" id="closeKnowledge" aria-label="Close">✕</button></div></div><div class="drawer-scroll"><h2 class="detail-title">${d.id?'Edit knowledge source':'Add operational knowledge'}</h2><p class="kb-editor-intro">Every saved change is immediately searchable by local agents. Revisions are preserved and future generation jobs use the new version.</p>
  <form id="knowledgeEditForm"><input type="hidden" name="revision" value="${d.revision}" />
  <div class="detail-grid"><div class="detail-field full"><label class="field-label">SOURCE TITLE</label><input name="title" value="${html(d.title)}" maxlength="200" required /></div>
  <div class="detail-field"><label class="field-label">COLLECTION</label>${editorSelect('category',[...new Set([...Object.keys(catLabels),d.category])],d.category)}</div>
  <div class="detail-field"><label class="field-label">RELEVANCE SCOPE</label>${editorSelect('scope',['all','company','founder','website','social','linkedin','facebook','instagram','gbp','x'],d.scope)}</div>
  <div class="detail-field"><label class="field-label">SOURCE TRUST</label>${editorSelect('trust',['policy','source','observed','reference','draft','unverified'],d.trust)}</div>
  <div class="detail-field"><label class="field-label">RETRIEVAL PRIORITY (0-10)</label><input type="number" name="priority" min="0" max="10" value="${d.priority}" /></div>
  <div class="detail-field full"><label class="field-label">TOPIC TAGS (comma separated)</label><input name="tags" value="${html((d.tags||[]).join(', '))}" /></div>
  <div class="detail-field full"><label class="field-label">VERIFIABLE SOURCE URL (optional)</label><input type="url" name="source_url" value="${html(d.source_url||'')}" placeholder="https://..." /></div>
  <div class="detail-field full"><label class="field-label">SUBSTANTIVE KNOWLEDGE / INSTRUCTION</label><textarea name="body" class="kb-body-edit" required spellcheck="true">${html(d.body)}</textarea></div>
  <div class="detail-field full"><label class="kb-enabled"><input type="checkbox" name="enabled" ${d.enabled?'checked':''}/> Available for model retrieval</label></div></div>
  <div class="kb-editor-footer"><button class="button primary" type="submit">Save knowledge ${d.id?'revision':'record'}</button>${d.id?`<button class="button ghost" type="button" id="kbHistoryBtn">Version history</button>`:''}</div></form>
  ${d.id?`<div class="kb-source-meta"><strong>Provenance</strong><p>${html(d.source_type)} · ${d.seeded?'built-in source':'manually entered'} · version ${d.revision}</p>${d.source_url?`<a href="${html(isGoodLink(d.source_url))}" target="_blank" rel="noreferrer noopener">Open original source ↗</a>`:''}</div>`:''}
  <div id="kbHistoryPanel"></div></div>`;
 }
 async function openAgent(kind){
  try{editorType='agent';selected=agents.find(x=>x.kind===kind);if(!selected)throw new Error('Agent not found');openPanel();renderAgentEditor();}
  catch(err){toast(err.message,'error');}
 }
 function renderAgentEditor(){
  const d=selected;$('#knowledgeDrawer').innerHTML=`<div class="drawer-header"><div class="drawer-eyebrow">MAIOS EXECUTION ROLE / ${html(d.kind.toUpperCase())}</div><div class="drawer-actions"><button class="icon-btn" id="closeKnowledge">✕</button></div></div><div class="drawer-scroll"><h2 class="detail-title">${html(d.title)}</h2><p class="kb-editor-intro">These instructions are included in the model system message for every ${html(d.kind)} generation. They are distinct from historical document excerpts and should describe the agent's actual responsibilities.</p>
  <form id="agentEditForm"><input type="hidden" name="revision" value="${d.revision}" /><div class="detail-grid">
  <div class="detail-field full"><label class="field-label">ROLE TITLE</label><input name="title" value="${html(d.title)}" required /></div>
  <div class="detail-field full"><label class="field-label">MODEL ROUTING PROFILE</label><input name="model_role" value="${html(d.model_role)}" required /></div>
  <div class="detail-field full"><label class="field-label">DETAILED OPERATING INSTRUCTIONS</label><textarea name="instructions" class="kb-body-edit" style="min-height:400px" required>${html(d.instructions)}</textarea></div>
  <div class="detail-field full"><label class="field-label">ACCEPTANCE AND QUALITY CRITERIA</label><textarea name="success_criteria" rows="7" required>${html(d.success_criteria)}</textarea></div></div><div class="kb-editor-footer"><button class="button primary" type="submit">Save specialist instructions</button></div></form>
  <div class="kb-source-meta"><strong>Source architecture</strong><p>The relevant original MPAIOS agents live in the knowledge library. This execution role is a condensed operating instruction that is actually attached to every relevant generation job.</p><span>v${d.revision} · Updated ${html(d.updated_at?.slice(0,10))}</span></div></div>`;
 }
 function applyPlaybook(id){
  const p=playbooks.find(x=>x.id===id),form=$('#commissionForm');if(!p||!form)return;
  const sel=(name)=>form.elements.namedItem(name);
  if(sel('voice'))sel('voice').value=p.voice;
  if(sel('word_count'))sel('word_count').value=p.word_count;
  if(sel('graphics_count'))sel('graphics_count').value=p.graphics_count;
  $all('input[name="outputs"]',form).forEach(el=>el.checked=p.default_outputs.includes(el.value));
  if($('#commissionPlaybook'))$('#commissionPlaybook').value=id;
  $('#playbookCriteria')&&( $('#playbookCriteria').textContent=p.acceptance);
 }
 function commissionedSelect(){return `<div class="modal-field full"><label>PRODUCTION PLAYBOOK</label><select id="commissionPlaybook" name="playbook_id"><option value="">Custom commission</option>${playbooks.map(p=>`<option value="${html(p.id)}">${html(p.title)}</option>`).join('')}</select><span class="field-hint" id="playbookCriteria">Selecting a playbook fills the voice, channel mix, length and creative request. All fields remain editable.</span></div>`;}
 function renderTaskKnowledge(task){
   const area=$('#taskKnowledgeArea');if(!area)return;
   area.innerHTML=`<div class="kb-preview-intro">See exactly which internal policies, historical source excerpts and specialist instructions will be supplied to the model. Historical drafts are not authoritative factual sources.</div>
     <div class="kb-context-picker"><label>Generation stage</label><select id="taskContextKind">${['brief','draft','graphics','qa'].map(kind=>`<option value="${kind}" ${promptKind===kind?'selected':''}>${kind}</option>`).join('')}</select><button id="taskContextRefresh" class="command-btn">Refresh context</button></div><div id="taskContextContent" class="kb-context-loading">Retrieving knowledge context…</div>`;
   loadTaskContext(task.id);
 }
 async function loadTaskContext(taskId){
  const area=$('#taskContextContent');if(!area)return;
  try{
   const [r,used]=await Promise.all([api(`/api/tasks/${taskId}/context?kind=${promptKind}`),api(`/api/tasks/${taskId}/sources`)]);
   if(!$('#taskContextContent'))return;
   area.innerHTML=`<div class="kb-context-stats"><strong>${r.sources.length} records</strong><span>≈ ${r.approxKnowledgeTokens.toLocaleString()} knowledge tokens</span><span>≈ ${(r.approxPromptTokens||0).toLocaleString()} tokens in the full prompt</span><span>${html(r.kind)} stage${r.mode==='revise'?' · revision':''}</span>${r.openFeedback?`<span>${r.openFeedback} open reviewer comment${r.openFeedback>1?'s':''} included</span>`:''}</div>
   <h4>Knowledge selected for this task</h4>${r.sources.map(x=>`<div class="kb-context-source"><div class="kb-record-top"><span class="kb-trust ${html(x.trust)}">${html(trusted[x.trust]||x.trust)}</span><span class="kb-source-type">${html(x.reason)}</span></div><strong>${html(x.title)}</strong><p>${html(short(x.snippet,170))}</p><small>${html(x.category)} · ${x.chars} characters</small></div>`).join('')}
   <h4>Actual sources used by completed agent jobs</h4>${used.length?`<p class="kb-editor-intro">${used.length} source references were recorded across generation jobs.</p>${used.slice(0,12).map(x=>`<div class="kb-job-source">${html(x.kind)} · ${html(x.title)}</div>`).join('')}`:'<p class="kb-editor-intro">No completed model jobs have recorded source usage yet.</p>'}
   <details class="kb-prompt-inspector"><summary>Inspect the exact instructions and prompt sent to the model</summary><strong>System instructions</strong><pre>${html(r.system)}</pre><strong>Commission, artifacts and relevant knowledge</strong><pre>${html(r.user)}</pre></details>`;
  }catch(e){if(area)area.textContent='Unable to assemble prompt: '+e.message;}
 }
 function install(){
  $('#knowledgeBackdrop').addEventListener('click',close);
  document.addEventListener('click',async e=>{
   const record=e.target.closest('[data-kb-id]');if(record){await openKnowledge(record.dataset.kbId);return;}
   const btn=e.target.closest('[data-agent-kind]');if(btn){await openAgent(btn.dataset.agentKind);return;}
   const use=e.target.closest('[data-use-playbook]');if(use){commissionModal(null,use.dataset.usePlaybook);return;}
   const cat=e.target.closest('[data-kb-category]');if(cat){filter.category=cat.dataset.kbCategory;await loadKnowledge();return;}
   if(e.target.closest('[data-kb-open]')){document.querySelector('[data-view="knowledge"]')?.click();return;}
   if(e.target.id==='kbAddBtn'){await openKnowledge(null);return;}
   if(e.target.id==='kbImportBtn'){editorType='import';openPanel();$('#knowledgeDrawer').innerHTML=`<div class="drawer-header"><div class="drawer-eyebrow">SOURCE INGESTION</div><button class="icon-btn" id="closeKnowledge">✕</button></div><div class="drawer-scroll"><h2 class="detail-title">Import source material</h2><p class="kb-editor-intro">Paste a verified transcript excerpt, strategy document, company policy, approved article or research text. The server divides long inputs into retrievable chunks. Original source text never leaves your backend.</p><form id="kbImportForm"><div class="detail-grid"><div class="detail-field full"><label class="field-label">SOURCE TITLE</label><input name="title" required placeholder="e.g. Q4 Marketing Strategy, approved" /></div><div class="detail-field"><label class="field-label">CATEGORY</label>${editorSelect('category',['external_source','workflow','brand_strategy','policy','historical_draft','custom'],'external_source')}</div><div class="detail-field"><label class="field-label">SCOPE</label>${editorSelect('scope',['all','company','founder','website','social','linkedin','facebook','instagram','gbp','x'],'all')}</div><div class="detail-field"><label class="field-label">SOURCE TRUST</label>${editorSelect('trust',['unverified','draft','reference','observed','source','policy'],'unverified')}</div><div class="detail-field full"><label class="field-label">SOURCE URL</label><input name="source_url" type="url" /></div><div class="detail-field full"><label class="field-label">TEXT TO IMPORT</label><textarea name="body" class="kb-body-edit" required placeholder="Paste the source text. Do not include secrets or patient data."></textarea></div></div><div class="kb-editor-footer"><button class="button primary" type="submit">Import and index source</button></div></form></div>`;return;}
   if(e.target.id==='closeKnowledge'){close();return;}
   if(e.target.id==='kbHistoryBtn'&&selected?.id){try{const history=await api(`/api/knowledge/${selected.id}/history`);const p=$('#kbHistoryPanel');if(p)p.innerHTML=`<h4>Previous versions</h4>${history.map(x=>`<details class="kb-history"><summary>v${x.revision} · ${html(x.actor)} · ${html(x.saved_at.slice(0,16))}</summary><pre>${html(x.body.slice(0,35000))}</pre></details>`).join('')||'No previous revisions.'}`;}catch(e){toast(e.message,'error');}return;}
   if(e.target.id==='taskContextRefresh'){const card=$('#taskDrawer');const id=card?.dataset.taskId||window.location.hash.slice(6);if(id)await loadTaskContext(id);return;}
  });
  document.addEventListener('change',e=>{
   if(e.target.id==='commissionPlaybook')applyPlaybook(e.target.value);
   if(e.target.id==='taskContextKind'){promptKind=e.target.value;const id=$('#taskDrawer')?.dataset.taskId||location.hash.slice(6);if(id)loadTaskContext(id);}
  });
  document.addEventListener('input',e=>{
   if(e.target.id==='kbSearch'){filter.q=e.target.value;clearTimeout(timer);timer=setTimeout(()=>loadKnowledge(),300);}
  });
  document.addEventListener('submit',async e=>{
   if(e.target.id==='knowledgeEditForm'){
    e.preventDefault();const fd=new FormData(e.target),body={...Object.fromEntries(fd.entries())};body.tags=String(body.tags||'').split(',').map(x=>x.trim()).filter(Boolean);body.priority=Number(body.priority);body.revision=Number(body.revision);body.enabled=fd.has('enabled');
    try{let rec=await api(selected?.id?`/api/knowledge/${selected.id}`:'/api/knowledge',{method:selected?.id?'PATCH':'POST',body});selected=rec;toast('Knowledge saved. Future model runs will use the latest version.');await loadKnowledge();renderKnowledgeEditor();}
    catch(err){toast(err.message,'error');}return;
   }
   if(e.target.id==='kbImportForm'){
    e.preventDefault();const fd=new FormData(e.target),body=Object.fromEntries(fd.entries());
    try{let result=await api('/api/knowledge/import',{method:'POST',body});toast(`Indexed ${result.count} knowledge chunks.`);close();await loadKnowledge();}
    catch(err){toast(err.message,'error');}return;
   }
   if(e.target.id==='agentEditForm'){
    e.preventDefault();const fd=new FormData(e.target),body=Object.fromEntries(fd.entries());body.revision=Number(body.revision);
    try{selected=await api('/api/agents/'+selected.kind,{method:'PATCH',body});agents=agents.map(x=>x.kind===selected.kind?selected:x);toast('Agent instructions updated.');renderAgentEditor();}
    catch(err){toast(err.message,'error');}return;
   }
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#knowledgeBackdrop').hidden)close();});
 }
 return {initialize,loadKnowledge,renderKnowledge,renderInstructions,openKnowledge,openAgent,close,install,getPlaybooks,getStats,metricsMarkup,applyPlaybook,commissionedSelect,renderTaskKnowledge};
}
