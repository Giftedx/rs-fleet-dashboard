/* Full-screen map shell. Existing data/evidence renderers remain the consumers. */
(() => {
  const app=document.querySelector('.app');
  const icons={
    jobs:'M4 5h16v14H4z M8 3v4m8-4v4M7 11h3m3 0h4m-10 4h3m3 0h4',
    account:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21v-2a8 8 0 0 1 16 0v2',
    pack:'M7 8V5a5 5 0 0 1 10 0v3M5 8h14v13H5zM8 12h8v5H8z',
    gear:'m5 20 14-16 2 2L7 22M4 14l6 6M14 3l7 7',
    skills:'M4 20h16M6 17v-5h3v5m3 0V8h3v9m3 0V3h3v14',
    goals:'M12 3v18M4 4h15l-4 5 4 5H4',
    stock:'m3 7 9-4 9 4v11l-9 4-9-4zM3 7l9 5 9-5M12 12v10',
    bank:'M3 8h18L12 2zM5 10v9m5-9v9m5-9v9m5-9v9M2 22h20',
    activity:'M2 12h5l3-8 4 16 3-8h5',
    machine:'M3 4h18v13H3zM8 21h8m-4-4v4',
    world:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M2 12h20M12 2c6 7 6 13 0 20-6-7-6-13 0-20',
    focus:'M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6'
  };
  const svg=key=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[key]}"></path></svg>`;
  const rail=document.createElement('nav');rail.className='plugin-rail';rail.setAttribute('aria-label','Dashboard plugins');
  const plugins=[['jobs','Agents & jobs'],['account','Account'],['pack','Inventory'],['gear','Equipment'],['skills','Skills'],['bank','Account bank'],['goals','Goals'],['stock','Shared stock'],['activity','Activity'],['world','World'],['machine','Host resources']];
  rail.innerHTML=plugins.map(([key,label])=>`<button data-plugin="${key}" aria-label="${label}" title="${label}" aria-pressed="false">${svg(key)}</button>`).join('')+`<span class="rail-space"></span><button data-map-focus aria-label="Focus map" title="Focus map · Tab">${svg('focus')}</button><a class="rail-text" style="text-align:center" href="/RUNELITE-LICENSE.txt" target="_blank" rel="noreferrer" title="RuneLite palette attribution; independent project">RS</a>`;
  app.append(rail);
  $('#detail-menu').insertAdjacentHTML('afterbegin','<option value="jobs">Agents & jobs</option>');
  $('.brand').innerHTML='SWARM ATLAS<small>WORLD OPERATIONS</small>';
  $('.brand').insertAdjacentHTML('afterend','<button class="hud-toggle" id="toggle-fleet" aria-label="Toggle fleet" aria-expanded="true">Fleet</button><button class="hud-toggle" id="toggle-inspector" aria-label="Toggle inspector" aria-expanded="true">Inspector</button>');
  const summary=document.createElement('div');summary.className='fleet-summary';summary.id='fleet-summary';$('#fleet-panel .bar').after(summary);
  const dock=document.createElement('section');dock.className='map-dock';dock.setAttribute('aria-label','World journal');
  dock.innerHTML='<nav class="dock-tabs" aria-label="Journal views"><button data-dock="events" class="on">Journal</button><button data-dock="boards">24 boards</button><button data-dock="allocation">Allocation</button><div class="dock-end"><span id="journal-age">Read-only observations</span><button id="toggle-dock" aria-label="Collapse journal" aria-expanded="true">−</button></div></nav><div class="dock-body"><div id="world-journal"></div></div>';
  app.append(dock);$('.dock-body').append($('.boards'),$('#allocation-panel'));$('.boards').hidden=true;$('#allocation-panel').hidden=true;
  const controls=document.createElement('div');controls.className='map-place';
  controls.innerHTML='<select id="atlas-place" aria-label="Map destination">'+PLACES.map(([name,x,z])=>`<option value="${x},${z}">${E(name)}</option>`).join('')+'</select><button id="atlas-go" title="Move the camera; does not move a game account">Go</button>';
  app.append(controls);
  const quality=document.createElement('select');quality.id='atlas-quality';quality.setAttribute('aria-label','Map render quality');quality.title='Render resolution; lower it to reduce GPU use';
  quality.innerHTML='<option value="1">Sharp</option><option value="0.75">Balanced</option><option value="0.5">Light</option>';$('#world-panel>.bar').append(quality);
  window.atlasQuality=1;quality.onchange=()=>{window.atlasQuality=Number(quality.value);$('#rsw').contentWindow?.postMessage({scale:window.atlasQuality},location.origin);};
  const help=document.createElement('div');help.className='map-help';help.innerHTML='<kbd>Drag</kbd> orbit &nbsp; <kbd>Scroll</kbd> zoom<br><kbd>W A S D</kbd> move &nbsp; <kbd>Tab</kbd> focus map';app.append(help);
  let selectedJob=null,jobFilter='active',dockView='events',showInspector=true;
  const saved=(key,fallback)=>{try{return localStorage.getItem('atlas.'+key)??fallback;}catch{return fallback;}};
  const save=(key,value)=>{try{localStorage.setItem('atlas.'+key,value);}catch{}};
  if(saved('fleet','open')==='closed')app.classList.add('left-hidden');
  if(saved('inspector','open')==='closed'){app.classList.add('right-hidden');showInspector=false;}
  view='jobs';
  function markPlugins(){
    rail.querySelectorAll('[data-plugin]').forEach(b=>{const on=b.dataset.plugin===view&&showInspector;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));});
    $('#toggle-fleet').setAttribute('aria-expanded',String(!app.classList.contains('left-hidden')&&(innerWidth>760||app.classList.contains('mobile-fleet'))));
    $('#toggle-inspector').setAttribute('aria-expanded',String(showInspector));
  }
  function openInspector(){showInspector=true;app.classList.remove('right-hidden');if(innerWidth<=760)app.classList.remove('mobile-fleet');save('inspector','open');}
  function agentView(c){
    return '<div class="agent-strip">'+['codex','claude'].map(name=>{const a=c.agents?.find(a=>a.name===name),busy=a&&(a.tasks.length||a.planning),label=!c.fresh?'Queue stale':c.paused?'Paused':busy?(a.planning?'Planning':a.tasks.length+' claimed job'+(a.tasks.length>1?'s':'')):'No active claim';return `<div class="agent-card ${busy&&c.fresh?'busy':''}"><b><i class="agent-dot" style="opacity:${busy&&c.fresh?1:.25}"></i>${name==='codex'?'Codex':'Claude'}</b><small>${E(label)}</small></div>`;}).join('')+'</div>';
  }
  function jobsView(){
    const c=S.coordination||{},tasks=c.tasks||[];
    $('#inspect-title').textContent='Agents & jobs';
    if(!c.available){put('#inspector','<h3>Agents & jobs</h3><p class="subline">No coordinator state is available.</p><p class="next-proof">Game activity and AI job activity are separate observations.</p>');return;}
    const filters=[['active','Working'],['pending','Waiting'],['failed','Failures'],['all','All']];
    const chosen=selectedJob&&tasks.find(t=>t.id===selectedJob);
    const visible=tasks.filter(t=>jobFilter==='all'||jobFilter==='active'&&t.status==='running'||t.status===jobFilter).sort((a,b)=>(b.finishedAt||b.startedAt||0)-(a.finishedAt||a.startedAt||0));
    let html=agentView(c)+`<div class="job-counts"><span><b>${c.counts?.running??0}</b> working · <b>${c.counts?.pending??0}</b> waiting</span><span class="${c.fresh?'dm':'warn'}">Queue ${age(c.at)} old</span></div><div class="job-filters">`+filters.map(([id,label])=>`<button data-job-filter="${id}" class="${jobFilter===id?'on':''}">${label}</button>`).join('')+'</div>';
    if(chosen){
      const deps=chosen.dependsOn.map(id=>{const d=tasks.find(t=>t.id===id);return `${id}: ${d?.status??'not in current view'}`;});
      html+=`<div class="job-detail"><button data-job-back>← Job list</button><h4>${E(chosen.id)}</h4><p>${E(chosen.kind)} · ${E(chosen.goal)} · ${E(chosen.agent||'harness')} · ${E(chosen.status)}</p><h4>Outcome & next consumer</h4><p>${E(chosen.why)}</p>${chosen.detail?`<h4>Latest result</h4><p class="${chosen.status==='failed'?'error':''}">${E(chosen.detail)}</p>`:''}${deps.length?'<h4>Dependencies</h4><p>'+deps.map(E).join('<br>')+'</p>':''}<h4>Evidence</h4><p>${E(chosen.evidence||'No completed receipt')} · ${chosen.finishedAt?age(chosen.finishedAt)+' old':'not finished'}</p></div>`;
    }else html+=visible.map(t=>`<button class="job-card ${E(t.status)}" data-job="${E(t.id)}"><span class="job-top"><span>${E(t.agent||'harness')} / ${E(t.kind)}</span><span>${E(t.goal)}</span></span><strong>${E(t.capability||t.id)}</strong><p>${E(t.status==='failed'?t.detail||'Failed; inspect receipt':t.why)}</p><p>${E(t.status)}${t.startedAt?' · '+age(t.startedAt)+' since claim':''}</p></button>`).join('')||'<p class="dock-empty">No jobs in this view. Inspect Waiting or Failures for dependencies.</p>';
    html+='<p class="hint">AI tasks are not game progress. Native proof, live output and ranks remain separate.</p>';
    put('#inspector',html);$('#detail-menu').value='jobs';$('#detail-page').textContent=chosen?'Job detail':'Shared queue';$('#detail-prev').disabled=true;$('#detail-next').disabled=true;
  }
  function journal(){
    const c=S.coordination||{},jobs=(c.tasks||[]).filter(t=>t.status==='running'||t.finishedAt).map(t=>({at:t.finishedAt||t.startedAt,name:t.agent||'harness',status:t.status,text:t.id+(t.detail?' · '+t.detail:''),job:t.id}));
    const game=(S.results||[]).filter(r=>!r.practice).slice(0,8).map(r=>({at:r.at,name:safeName(r.name),status:resultKind(r),text:r.text,account:r.name}));
    const rows=[...jobs,...game].sort((a,b)=>b.at-a.at).slice(0,20);
    put('#world-journal',rows.map(r=>`<div class="event-line"><time>${E(hm(r.at))}</time><span class="tag ${r.status==='failed'||r.status==='fail'?'fail':r.status==='ok'?'live':''}">${r.job?'AI '+E(r.status):'GAME '+E(r.status)}</span><button ${r.job?'data-job="'+E(r.job)+'"':'data-journal-account="'+E(r.account)+'"'} class="message" title="${E(r.text)}"><b>${E(r.name)}</b> &nbsp; ${E(r.text)}</button></div>`).join('')||'<p class="dock-empty">Waiting for a completed game batch or a claimed AI job.</p>');
  }
  function mapShell(){
    if(!S)return;
    const bots=liveBots(),observed=bots.filter(b=>b.operation==='observed').length,attention=bots.filter(b=>['blocked','failed','died','active-stale'].includes(b.operation)).length;
    put('#fleet-summary',`<b>${observed}</b><span>playing</span> <b class="${attention?'warn':''}">${attention}</b><span>need attention</span>`);
    if(view==='jobs')jobsView();else $('#inspect-title').textContent=view==='account'?'Account inspector':view[0].toUpperCase()+view.slice(1);
    if(view==='goals'&&!$('#atlas-goal')){
      const chooser=document.createElement('select');chooser.id='atlas-goal';chooser.setAttribute('aria-label','Project goal');chooser.style.maxWidth='100%';
      chooser.innerHTML=goalMetrics().map((g,i)=>`<option value="${i}">${E(g.title)}</option>`).join('');chooser.value=String(lane);$('#inspector').prepend(chooser);
      chooser.onchange=()=>{lane=Number(chooser.value);detailPage=0;render();};
    }
    journal();markPlugins();
    const c=S.coordination;$('#journal-age').textContent=c?.available?`${c.counts.running} jobs · ${c.counts.pending} waiting`:'Queue unavailable';
    app.classList.toggle('shell-viewer-error',VIEWER.state==='unavailable');
  }
  const oldRender=render;render=function(){oldRender();mapShell();};
  const oldPick=pick;pick=function(name){openInspector();oldPick(name);};
  const oldChoose=choose;choose=function(next){openInspector();selectedJob=null;oldChoose(next);};
  rail.addEventListener('click',e=>{
    const button=e.target.closest('[data-plugin]');if(!button)return;
    const next=button.dataset.plugin;
    if(view===next&&showInspector){showInspector=false;app.classList.add('right-hidden');save('inspector','closed');markPlugins();}else choose(next);
  });
  $('#inspector').addEventListener('click',e=>{
    const job=e.target.closest('[data-job]');if(job){selectedJob=job.dataset.job;jobsView();}
    const filter=e.target.closest('[data-job-filter]');if(filter){jobFilter=filter.dataset.jobFilter;selectedJob=null;jobsView();}
    if(e.target.closest('[data-job-back]')){selectedJob=null;jobsView();}
  });
  dock.addEventListener('click',e=>{
    const tab=e.target.closest('[data-dock]');if(tab){dockView=tab.dataset.dock;$('#world-journal').hidden=dockView!=='events';$('.boards').hidden=dockView!=='boards';$('#allocation-panel').hidden=dockView!=='allocation';dock.querySelectorAll('[data-dock]').forEach(b=>b.classList.toggle('on',b===tab));app.classList.remove('dock-hidden');if(S){boardGrid();allocationView();}}
    const job=e.target.closest('[data-job]');if(job){choose('jobs');selectedJob=job.dataset.job;jobsView();}
    const account=e.target.closest('[data-journal-account]');if(account)pick(account.dataset.journalAccount);if(e.target.closest('[data-allocation]')){app.classList.remove('left-hidden');app.classList.add('mobile-fleet');markPlugins();}
  });
  $('#toggle-dock').onclick=()=>{const hidden=app.classList.toggle('dock-hidden');$('#toggle-dock').textContent=hidden?'+':'−';$('#toggle-dock').setAttribute('aria-expanded',String(!hidden));};
  $('#toggle-fleet').onclick=()=>{if(innerWidth<=760){if(app.classList.toggle('mobile-fleet')){showInspector=false;app.classList.add('right-hidden');}}else{app.classList.toggle('left-hidden');save('fleet',app.classList.contains('left-hidden')?'closed':'open');}markPlugins();if(S)roster();};
  $('#toggle-inspector').onclick=()=>{showInspector=!showInspector;app.classList.toggle('right-hidden',!showInspector);save('inspector',showInspector?'open':'closed');markPlugins();};
  const focusMap=()=>{app.classList.toggle('focus-map');};
  rail.querySelector('[data-map-focus]').onclick=focusMap;
  document.addEventListener('keydown',e=>{if(e.key==='Tab'&&e.target===document.body){e.preventDefault();focusMap();}if(e.key==='Escape'&&app.classList.contains('focus-map'))app.classList.remove('focus-map');if(e.key==='/'&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();app.classList.remove('left-hidden');app.classList.add('mobile-fleet');$('#search').focus();}});
  function goTo(pos){if(!Number.isFinite(pos.x)||!Number.isFinite(pos.z))return;window.atlasFreeCamera=true;window.atlasFollowOther=null;window.atlasDestination=pos;rswFor=null;request3D();$('#follow').textContent='Camera · '+pos.x+', '+pos.z+' · no game input';}
  $('#atlas-go').onclick=()=>{const [x,z]=$('#atlas-place').value.split(',').map(Number);goTo({x,z});};
  window.addEventListener('message',event=>{if(event.source!==$('#rsw').contentWindow||event.origin!==location.origin)return;const name=event.data?.atlasFollow;if(typeof name!=='string'||!S?.bots||window.atlasWallOn?.())return;const b=S.bots.find(b=>b.name.toLowerCase()===name.toLowerCase()&&!b.practice);if(b){if(sel!==b.name||window.atlasFreeCamera||window.atlasFollowOther)window.atlasClient.follow(b.name);}else if(name!==MARK&&window.atlasFollowOther!==name){window.atlasFreeCamera=false;window.atlasDestination=null;window.atlasFollowOther=name;render();}});
  document.addEventListener('visibilitychange',()=>$('#rsw').contentWindow?.postMessage({fps:document.hidden?1:20},location.origin));
  if(S?.bots&&!S.bots.some(b=>!b.practice&&b.inWorld))window.atlasFreeCamera=true;if(S)render();markPlugins();request3D();
})();
