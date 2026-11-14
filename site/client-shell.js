FleetShim.ready.then(() => {
/* OSRS game chrome and RuneLite plugin workspace. All game data is observed. */
(() => {
  const app=document.querySelector('.app'),asset=n=>'client-assets/'+n;
  // The plugin panel and the toolbar stay hidden until operations.js has added its parts and chosen the first plugin,
  // so the first paint does not show a half-built panel. The timer covers a page where operations.js did not load.
  app.classList.add('shell-starting');window.atlasShellStarted=()=>app.classList.remove('shell-starting');setTimeout(window.atlasShellStarted,3000);
  // The local page is the operator's console. Hosted, the shim (window.FleetShim) says whether the owner signed in;
  // a spectator sees the game and the viewing plugins only.
  window.atlasOperator=()=>!window.FleetShim||!!window.FleetShim.signedIn?.();
  // A visitor does not see housekeeping runs, and reads a job name as words, without a trailing map position.
  window.atlasHousekeeping=text=>/^(?:read-bank|recover-|chain-)/.test(String(text??''));
  window.atlasJobName=text=>String(text??'').replace(/([a-z])-(?=[a-z])/g,'$1 ').replace(/(?:\s+at)?\s+\d{3,4},\s?\d{3,4}\b/g,'');
  // Owner-only: commands, jobs, banks, host resources, the plan (goals) and the private repository's pull requests.
  const OPERATOR_PLUGINS=['operations','dispatch','raw','jobs','machine','stock','goals','prs'];
  // One home per fact for a spectator: the open row in Fleet holds the account summary and its last run, so these two
  // plugins stay off the public toolbar.
  const PUBLIC_HIDDEN=['account','activity'];window.atlasPublicHidden=PUBLIC_HIDDEN;
  // A plugin with nothing to show a spectator now stays off the toolbar until it has: the XP Tracker needs an account
  // that plays with XP in its snapshot (the other machines share levels only).
  window.atlasPluginIdle=id=>id==='xp'&&!window.atlasOperator()&&typeof S!=='undefined'&&!!S&&!S.bots.some(b=>b.fresh&&!b.practice&&!b.reserved&&!b.remote);
  // Only the tabs with observed data and no plugin that shows the same: Fleet holds the stopped accounts (the old
  // Ignore List) and Account overview the account summary (the old Account Management tab).
  const tabs=[['skills','Skills'],['quests','Quest Journal'],['inventory','Inventory'],['equipment','Worn Equipment'],['friends','Friends List'],['logout','Logout'],['settings','Game Options']];
  // The 2004 client's side icons (client-assets/sideicons.png, 30 px each): the place of each tab's icon in the strip.
  const TAB_ICON={skills:1,quests:2,inventory:3,equipment:4,friends:7,logout:9,settings:10};
  const realSkill=k=>!/^Stat\d+$/.test(k.name)&&k.name!=='Overall';const reported=(acct,n)=>{const set=acct?.skills?.length?acct.skills:S?.bots?.flatMap(x=>x.skills||[])||[];return !set.length||set.some(k=>k.name===n||(n==='Runecraft'&&/runecraft/i.test(k.name)));};
const skills=['Attack','Hitpoints','Mining','Strength','Agility','Smithing','Defence','Herblore','Fishing','Ranged','Thieving','Cooking','Prayer','Crafting','Firemaking','Magic','Fletching','Woodcutting','Runecraft','Slayer','Farming','Construction','Hunter','Sailing'];
  const skillFile=n=>n.toLowerCase()==='runecraft'?'runecraft':n.toLowerCase();
  const hud=document.createElement('div');hud.className='game-hud';
  // A phone has no room for the chat beside the inventory: it starts hidden behind its toggle.
  // A phone starts with the chat closed; its toggle exists only at phone width, so a wider window always opens the chat.
  const phoneWidth=matchMedia('(max-width:479px)');hud.classList.toggle('chat-hidden',phoneWidth.matches);
  // A visitor on a phone starts on the world. The inventory opens from its tab buttons.
  if(phoneWidth.matches&&!window.atlasOperator())hud.classList.add('game-panel-hidden');
  phoneWidth.addEventListener('change',e=>hud.classList.toggle('chat-hidden',e.matches));
  hud.innerHTML=`<button class="game-xp" title="XP Tracker" aria-label="XP Tracker">XP</button><div class="game-orbs" aria-label="Player status"></div><div class="xp-drops" aria-hidden="true"></div><div class="xp-globes" aria-label="XP globes"></div><div class="game-overlay" aria-label="Overlay"></div><div class="game-infoboxes" aria-label="Infoboxes"></div><div class="game-tip" hidden></div><div class="game-screen" id="game-loading"><div class="game-screen-box"><h2>Welcome to RuneScape</h2><p>Loading - please wait.</p></div></div><div class="game-screen" id="game-lost" hidden><div class="game-screen-box"><p>Connection lost.</p><p>Please wait - attempting to reestablish.</p></div></div><div class="game-minimap" aria-label="Minimap"><canvas width="146" height="151"></canvas><img class="minimap-compass" src="${asset('compass.png')}" alt="" title="Compass: face north"><canvas class="minimap-frame" width="249" height="168" aria-hidden="true"></canvas><button class="game-worldmap" data-places title="Places: move the camera" aria-label="Places"><img src="${asset('worldmap-icon.png')}" alt=""></button></div><section class="game-tabs" aria-label="Game interface"><nav class="tab-row" aria-label="Primary game tabs"></nav><div class="game-panel" id="game-panel"></div><nav class="tab-row" aria-label="Social and settings tabs"></nav></section><button class="chat-toggle" aria-label="Toggle chat">▾ Chat</button><section class="game-chat" aria-label="In-game chat"><div class="game-chat-lines" role="log" aria-live="polite"></div><form class="chat-input"><span id="chat-name">Spectator:</span><input aria-label="Chat message or local command" autocomplete="off" placeholder="*"></form><nav class="chat-channels" aria-label="Chat channels"></nav></section>`;
  app.append(hud);
  const title=document.createElement('div');title.className='client-title';title.innerHTML=`<img src="${asset('runelite.png')}" alt=""><span>RuneLite — Swarm</span><span class="connection">● Live world</span><div class="focus" id="client-focus" role="group" aria-label="3D camera focus" data-state="free"><button class="focus-step" data-focus-step="-1" aria-label="Previous account in the world" title="Previous account in the world · [">‹</button><button class="focus-now" aria-haspopup="listbox" aria-expanded="false"><i class="focus-dot"></i><span class="focus-name">Free camera</span><svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4"/></svg></button><button class="focus-step" data-focus-step="1" aria-label="Next account in the world" title="Next account in the world · ]">›</button><button class="focus-wall" aria-pressed="false" hidden title="Fleet wall: up to 16 of our accounts in the world, each in its own 3D view, tiled. Click a view to focus it, double click to follow that account. · \\">Wall</button><div class="focus-menu"><input class="focus-find" aria-label="Find an account" placeholder="Find an account…" autocomplete="off" spellcheck="false"><div class="focus-list" role="listbox" aria-label="Accounts"></div></div></div><button id="client-sidebar" title="Toggle plugin sidebar" aria-label="Toggle plugin sidebar" aria-expanded="true">❯</button>`;app.append(title);
  const followTitle=()=>{const name=document.getElementById('client-plugin-name')?.textContent;document.title='RuneLite — Swarm'+(name?' · '+name:'');writeLink();};
  const plugin=document.createElement('aside');plugin.className='client-plugin';plugin.setAttribute('aria-label','RuneLite plugins');plugin.innerHTML='<div class="client-plugin-title"><span id="client-plugin-name">Fleet</span><select id="client-more" aria-label="More plugins" hidden><option value="">⋮</option><option value="raw">Raw evidence</option></select><button id="client-share" aria-label="Copy a link to this view" title="Copy a link to this view">⧉</button><button aria-label="Close plugin">×</button></div><div class="client-plugin-body"></div>';app.append(plugin);
  const body=plugin.querySelector('.client-plugin-body'),rail=document.createElement('nav');rail.className='client-rail';rail.setAttribute('aria-label','RuneLite plugin toolbar');
  const oldRail=document.querySelector('.plugin-rail');
  const plugins=[['fleet','Fleet'],['xp','XP Tracker'],['boards','Hiscores'],['world','World'],['ge','Grand Exchange'],['prs','Pull requests'],['jobs','Agents & jobs'],['goals','Project goals'],['account','Account overview'],['stock','Supply ledger'],['activity','Activity'],['machine','Host resources'],['info','Info']];
  const fallback='<svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM8 9h8m-8 5h8"/></svg>';
  // RuneLite's own sidebar icons (client-assets/rl-*.png, see ATTRIBUTION.txt), one per plugin.
  const RAIL_ICONS=['fleet','xp','hiscore','loot','worlds','ge','prs','jobs','goals','account','boards','activity','world','machine','settings','operations','dispatch','alerts','library'],RAIL_FILE={boards:'hiscore',info:'machine',machine:'library',activity:'loot'};
  const railIcon=id=>{const f=RAIL_FILE[id]||id;return RAIL_ICONS.includes(f)?`<img src="${asset('rl-'+f+'.png')}" alt="">`:null;};window.atlasRailIcon=railIcon;
  const icons={xp:railIcon('xp')};
  rail.innerHTML=plugins.filter(([id])=>window.atlasOperator()||!(OPERATOR_PLUGINS.includes(id)||PUBLIC_HIDDEN.includes(id))).map(([id,label])=>`<button data-client-plugin="${id}" aria-label="${label}" title="${label}">${railIcon(id)||oldRail.querySelector(`[data-plugin="${id}"]`)?.innerHTML||fallback}</button>`).join('')+'<span class="rail-gap"></span><button data-client-plugin="manager" aria-label="Configuration" title="Configuration">'+railIcon('settings')+'</button>';app.append(rail);
  const fleet=$('#fleet-panel'),inspect=$('#inspect-panel'),boards=$('.boards'),allocation=$('#allocation-panel'),journal=$('.map-dock'),places=$('.map-place');
  const parked=document.createElement('div');parked.hidden=true;app.append(parked);
  for(const el of [fleet,inspect,boards,allocation,journal])parked.append(el);
  const placesBox=document.createElement('div');placesBox.className='game-places';placesBox.hidden=true;placesBox.innerHTML='<strong>Places</strong><button class="game-control" data-viewer-worldmap hidden>World map: every player</button>';if(places)placesBox.append(places);hud.append(placesBox);
  let selectedTab='inventory',selectedPlugin='fleet',context=null,questDetail=null,questFilter='all',questQuery='',xpHideMaxed=false;
  const chat=[],seen=new Set(),seenChat=new Set();
  let tourTimer=null,touring=false;
  const account=()=>window.atlasFollowOther?null:S?.bots?.find(b=>b.name===sel);
  // A text node is replaced only when its text changes.
  const setText=(el,text)=>{if(el.textContent!==text)el.textContent=text;};
  const notify=text=>{chat.push({kind:'Game',text,at:Date.now()});if(chat.length>200)chat.shift();renderChat();};
  const stamp=at=>at?`<span class="chat-time">[${new Date(at).toTimeString().slice(0,5)}]</span> `:'';
  const KV=/(^|\s)([A-Za-z][A-Za-z0-9]*)=(\S+)/g;const kvWord=k=>k==='t'?'tick':k.replace(/([a-z0-9])([A-Z])/g,'$1 $2').toLowerCase();const kvValue=v=>/^\d{4,}$/.test(v)?Number(v).toLocaleString():v;
  function pretty(text){const t=String(text??'');const pairs=[...t.matchAll(KV)];if(pairs.length<2)return E(t);const head=t.slice(0,pairs[0].index).trim(),tail=t.slice(pairs[pairs.length-1].index+pairs[pairs.length-1][0].length).trim();const body=pairs.map((p,i)=>{const next=pairs[i+1],mid=next?t.slice(p.index+p[0].length,next.index).trim():'';return E(kvWord(p[2]))+' '+E(kvValue(p[3]))+(mid?' '+E(mid):'');}).join(' · ');return `<span title="${E(t)}">${head?E(head)+' ':''}${body}${tail?' '+E(tail):''}</span>`;}
  // Chat notifications (RuneLite): the name of one of our accounts in a public line is marked. The text is escaped before the mark, and a name is letters and digits, so the mark cannot change the markup. The four names that are also HTML entity words are left out.
  function mention(html){const names=(S?.bots||[]).filter(b=>!b.practice&&safeName(b.name)===b.name&&b.name.length>2&&!/^(amp|lt|gt|quot)$/i.test(b.name)).map(b=>b.name);if(!names.length)return html;const key=names.join('|');if(mention.key!==key){mention.key=key;mention.re=new RegExp('\\b('+key+')\\b','gi');}return html.replace(/<[^>]*>|[^<]+/g,part=>part[0]==='<'?part:part.replace(mention.re,'<span class="chat-hl">$1</span>'));}
  function renderChat(){const rows=chat.filter(r=>!chatOff.has(r.kind)),was=hud.querySelector('.game-chat-lines'),atEnd=was.scrollHeight-was.scrollTop-was.clientHeight<8;hud.querySelector('.game-chat-lines').innerHTML=rows.map(r=>`<p class="${r.kind==='Public'?'chat-public':r.kind==='Private'?'chat-private':'chat-system'}">${stamp(r.at)}${r.name?'<b>'+E(r.name)+'</b>: ':''}${r.kind==='Public'?mention(pretty(r.text)):pretty(r.text)}</p>`).join('')||`<p class="chat-system">${chat.length?'These lines are hidden. Press a chat button to show them.':'No fleet events yet.'}</p>`;const log=hud.querySelector('.game-chat-lines');if(atEnd)log.scrollTop=log.scrollHeight;}
  // Game: fleet events and finished jobs. Private: stopped jobs and deaths. Public: chat the 3D viewer overhears.
  const channels=['Public','Private','Game'],chatOff=new Set(),CHAT_LABEL={Public:'Public chat',Private:'Private chat',Game:'Game'};
  hud.querySelector('.chat-channels').innerHTML=channels.map(c=>`<button data-chat="${c}" aria-pressed="true" title="${CHAT_LABEL[c]}: show or hide these lines">${CHAT_LABEL[c]}<small>On</small></button>`).join('');
  const rows=hud.querySelectorAll('.tab-row');tabs.forEach(([id,label],i)=>rows[i<4?0:1].insertAdjacentHTML('beforeend',`<button data-game-tab="${id}" aria-label="${label}" title="${label}" class="${id===selectedTab?'active':''}"><span class="tab-sprite" style="background-position:-${30*TAB_ICON[id]}px 0"></span></button>`));
  function level(name){return account()?.skills?.find(s=>s.name.toLowerCase()===name.toLowerCase()||(name==='Runecraft'&&/runecraft/i.test(s.name)));}
  const qty=n=>n>=10000000?`<span class="qty qty-m">${Math.floor(n/1e6)}M</span>`:n>=100000?`<span class="qty qty-k">${Math.floor(n/1000)}K</span>`:`<span class="qty">${n}</span>`;
  // Item prices (RuneLite itemprices, bank value): the server's item value (the vault's: 7-day VWAP after 3 trades,
  // else the shop base price), and the market's ask and bid where it is a route supply. Coins are 1 gp.
  let priceAt=-1,prices=new Map();
  function price(name){if(S.economy?.pricesAt!==priceAt){priceAt=S.economy?.pricesAt;prices=new Map((S?.economy?.supplies||[]).map(s=>[String(s.name).toLowerCase(),s]));}
    if(/^coins$/i.test(name))return {value:1};const s=prices.get(String(name).toLowerCase());
    const value=S.economy?.itemValues?.[name]??null;return value==null?null:{value,ask:s?.ask??null,bid:s?.bid??null};}
  // Item stats (RuneLite's item stats): what a food or a potion does, from the server's consumption table (client-assets/item-stats.json, made by gen-item-stats.ts). The tooltip of an item shows it.
  let itemStats={};fetch(asset('item-stats.json')).then(r=>r.ok?r.json():{}).then(j=>{itemStats=j||{};},()=>{});
  window.atlasItemStats=()=>itemStats;
  function statTip(item){const t=itemStats[item.name];return (t?' · '+t:'')+(typeof cookTip==='function'?cookTip(item):'');}
  // Cooking burn chance (RuneLite's cooking plugin, with the server's roll): client-assets/cooking.json (gen-cooking.ts)
  // has the [low, high] of each raw food on a fire, a range and with cooking gauntlets. The engine (STAT_RANDOM) cooks
  // when floor(low*(99-L)/98) + floor(high*(L-1)/98) + 1 beats a roll of 0-255; L is the current Cooking level.
  // The tooltip of a raw food gives the followed account's burn chance and the level where a range stops burning it.
  let cookData={};fetch(asset('cooking.json')).then(r=>r.ok?r.json():{}).then(j=>{cookData=j||{};},()=>{});
  function cookOk(p,L){const [lo,hi]=p;if(!lo&&!hi)return 0;if(lo===1&&hi===1)return 1;L=Math.min(L,99);return Math.min(Math.floor(lo*(99-L)/98)+Math.floor(hi*(L-1)/98)+1,256)/256;}
  function cookTip(item){const r=cookData[item?.name];if(!r)return '';const b=typeof account==='function'?account():null,L=typeof curLevel==='function'?curLevel(b,'Cooking'):null;
    if(!Number.isFinite(L))return ' · cooks to '+r.c+' at Cooking '+r.lv;if(L<r.lv)return ' · Cooking '+r.lv+' needed to cook';
    const pct=p=>Math.round((1-cookOk(p,L))*100)+'%',range=r.r||r.f,parts=[r.r?'fire '+pct(r.f)+', range '+pct(r.r):'fire or range '+pct(r.f)];if(r.g)parts.push('gauntlets '+pct(r.g));
    let stop=null;for(let l=r.lv;l<=99;l++)if(cookOk(range,l)>=1){stop=l;break;}
    return ' · burn at Cooking '+L+': '+parts.join(', ')+' · '+(stop==null?'a range burns it even at 99':stop<=L?'no burns on a range':'no burns on a range from '+stop);}
  // High alchemy (RuneLite's item prices, the HA value): the server pays max(scale(6, 10, cost), 1) coins
  // (skill_magic/scripts/spells/alchemy.rs2), with the cost from client-assets/item-alch.json (gen-item-alch.ts). Coins cannot be alched.
  // The profit of one cast buys the item at the market ask and pays one nature rune; a fire staff gives the fire runes. Only a profit shows.
  let itemAlch={};fetch(asset('item-alch.json')).then(r=>r.ok?r.json():{}).then(j=>{itemAlch=j||{};},()=>{});
  function alchOf(name){if(/^coins$/i.test(name))return null;const c=itemAlch[name];return c>0?Math.max(Math.floor(c*6/10),1):null;}
  function alchTip(item){const h=alchOf(item.name);if(!h)return '';const p=price(item.name),nat=price('Nature rune'),rune=nat?(nat.ask??nat.value):null,buy=p?.ask??null;
    const profit=buy!=null&&rune!=null?Math.round(h-buy-rune):null;
    return ' · high alch '+nf(h)+(item.count>1?' ('+gp(h*item.count)+' for '+nf(item.count)+')':'')+(profit!=null?(profit>0?' · alch profit +'+nf(profit)+' a cast after the market buy and a nature rune':''):p&&h>p.value?' · alch pays '+nf(Math.round(h-p.value))+' more than the value':'');}
  function priceTip(item){const a=typeof alchTip==='function'?alchTip(item):'',p=price(item.name);if(!p||/^coins$/i.test(item.name))return a;return ' · value '+nf(Math.round(p.value))+' gp'+(item.count>1?' ('+gp(Math.round(p.value*item.count))+' for '+nf(item.count)+')':'')+(p.ask!=null||p.bid!=null?' · market buy '+(p.ask!=null?nf(p.ask):'—')+' / sell '+(p.bid!=null?nf(p.bid):'—'):'')+a;}
  function stackValue(items){let value=0,unpriced=0;for(const it of items||[]){const p=price(it.name);if(p)value+=p.value*it.count;else unpriced++;}return {value:Math.round(value),unpriced};}
  // Inventory value (RuneLite's bank value, for the inventory): the sum of the item values under the grid. A coin counts as 1 gp. An item with no value adds nothing, and the tooltip says how many have none.
  function invWorth(items){let total=0,none=0;for(const it of items){if(!it)continue;const p=price(it.name);if(p)total+=p.value*(it.count||1);else none++;}return total?`<p class="game-muted inv-worth" title="The sum of the item values${none?' · '+none+(none===1?' item has':' items have')+' no value':''}">Worth ${gp(Math.round(total))} gp</p>`:'';}
  // Item charges (RuneLite's Item Charges): the charges or doses in an item's name, "Amulet of glory(4)" or
  // "Strength potion(3)", drawn in the icon's corner as the plugin does. A stack keeps its count instead.
  const itemCharges=name=>{const m=String(name||'').match(/\((\d+)\)$/);return m?Number(m[1]):null;};
  const chargeTag=item=>{const c=item&&!(item.count>1)?itemCharges(item.name):null;return c==null?'':`<span class="qty item-charge">${c}</span>`;};
  // Inventory Tags (RuneLite's Inventory Tags): an outline in the colour of the item's group: food green, potions blue,
  // teleports purple, runes orange (item-stats.json for food and potions).
  const invTag=item=>{if(!item||typeof hl==='undefined'||!hl.invTags)return '';const n=item.name||'',st=itemStats[n]||'';return /\bheals\b/i.test(st)?' tag-food':/\(\d\)$/.test(n)&&st?' tag-potion':/teleport|^Amulet of glory|^Ring of dueling|^Games necklace|^Skills necklace|^Combat bracelet/i.test(n)?' tag-tele':/ rune$/i.test(n)?' tag-rune':'';};
  // Equipment Stats (the game's Equipment Stats screen): the sum of the worn items' bonuses (client-assets/item-bonuses.json,
  // from the server's .obj params) and the max hits by the server's formula (combat.rs2, player_combat_stat.rs2):
  // effective level = current level + 8 + the attack style bonus (0 to 3); max hit = floor((effective × (bonus + 64) + 320) / 640).
  // The attack style is not reported, so a max hit is the range from no style bonus to the +3 style. Unobserved
  // equipment (equipmentObserved false: the hosted publisher has no worn items) shows no panel, not an empty loadout.
  let itemBonusData=null,spellbookData=null;
  fetch(asset('item-bonuses.json')).then(r=>r.ok?r.json():null).then(j=>{if(j&&typeof j==='object')itemBonusData=j;},()=>{});
  fetch(asset('spellbook.json')).then(r=>r.ok?r.json():null).then(j=>{if(j&&Array.isArray(j.spells))spellbookData=j;},()=>{});
  const curLevel=(b,n)=>{const s=(b?.skills||[]).find(x=>x.name===n);return Number.isFinite(s?.currentLevel)?s.currentLevel:s?.level;};
  function wornBonuses(b){if(!itemBonusData||!Array.isArray(b?.equipment)||b.equipmentObserved===false)return null;const t=new Array(13).fill(0);for(const it of b.equipment){const v=itemBonusData[it?.name];if(Array.isArray(v))v.forEach((x,i)=>{t[i]+=x;});}return t;}
  // prayer is the server's percent (100 none, 115 for +15%): floor(level × prayer / 100) before the +8. The active prayer
  // is not reported, so the range shown is without one, and the melee top with +15% follows it.
  const maxHit=(level,bonus,style,prayer=100)=>Math.floor(((Math.floor(level*Math.max(100,prayer)/100)+8+style)*(bonus+64)+320)/640);
  function equipStats(b){
    const t=wornBonuses(b);if(!t)return '';
    const sg=v=>(v>0?'+':'')+v,cells=(from,names)=>names.map((n,i)=>'<i title="'+n+'">'+sg(t[from+i])+'</i>').join('');
    const str=curLevel(b,'Strength'),rng=curLevel(b,'Ranged'),weapon=b.equipment.find(e=>e.slot===3),ranged=(itemBonusData[weapon?.name]?.[4]||0)>0;
    const hits=[Number.isFinite(str)&&!ranged?'Melee '+maxHit(str,t[10],0)+'–'+maxHit(str,t[10],3)+' · prayer '+maxHit(str,t[10],3,115):'',ranged&&Number.isFinite(rng)?'Ranged '+maxHit(rng,t[11],0)+'–'+maxHit(rng,t[11],3):''].filter(Boolean);
    {const sp=bestSpell(b);if(sp)hits.push('Magic '+sp.name+' '+sp.max+' ×'+sp.casts);}
    const names=['Stab','Slash','Crush','Magic','Range'];
    return '<div class="equip-stats"><div class="es-title">Equipment Stats</div><div class="es-head"><span></span>'+names.map(n=>'<i title="'+n+'">'+n.slice(0,3)+'</i>').join('')+'</div><div><span>Attack</span>'+cells(0,names)+'</div><div><span>Defence</span>'+cells(5,names)+'</div><div class="es-other"><span>Other</span><i title="Strength">Str '+sg(t[10])+'</i><i title="Ranged strength">Rng '+sg(t[11])+'</i><i title="Prayer">Pray '+sg(t[12])+'</i></div>'+(hits.length?'<div class="es-hit" title="Without a prayer, from no attack style bonus to +3; the active prayer is not reported"><span>Max hit</span><b>'+hits.join('<br>')+'</b></div>':'')+'</div>';
  }
  // Teleport casts: how many casts of each teleport spell the pack's runes give (a wielded staff gives its rune without
  // limit; client-assets/spellbook.json); a spell above the account's current Magic level is dim.
  // How many casts the pack's runes give for a rune list ([[rune, count], ...]); a wielded staff gives its rune without limit.
  function runeCasts(b,runes){const have=n=>(b.inventory||[]).filter(i=>i?.name===n).reduce((t,i)=>t+(i.count||1),0),weapon=b.equipment?.find(e=>e.slot===3)?.name;const free=new Set(Object.entries(spellbookData?.staffs||{}).filter(([,s])=>Array.isArray(s)&&s.includes(weapon)).map(([r])=>r));return Math.min(...runes.map(([r,c])=>free.has(r)?Infinity:Math.floor(have(r)/c)));}
  // Magic max hit (Equipment Stats): the combat spell with the highest max hit (spellbook.json, the server's
  // magic_combat_spells.dbrow) that the account can cast now: its current Magic level, the runes for one cast, the staff
  // a spell needs worn. A spell's max hit is fixed in this game (no magic damage bonus).
  function bestSpell(b){
    if(!spellbookData?.combat?.length||!Array.isArray(b?.inventory))return null;
    const mg=curLevel(b,'Magic');if(!Number.isFinite(mg))return null;
    const worn=new Set((b.equipment||[]).map(e=>e?.name));
    let best=null;for(const [name,lv,max,runes,staff] of spellbookData.combat){if(lv>mg||(staff&&!worn.has(staff)))continue;const casts=runeCasts(b,runes);if(casts>0&&Number.isFinite(casts)&&(!best||max>best.max))best={name,max,casts};}
    return best;
  }
  function teleCasts(b){
    if(!spellbookData||!Array.isArray(b?.inventory))return [];
    const have=n=>b.inventory.filter(i=>i?.name===n).reduce((t,i)=>t+(i.count||1),0),weapon=b.equipment?.find(e=>e.slot===3)?.name;
    const free=new Set(Object.entries(spellbookData.staffs||{}).filter(([,s])=>Array.isArray(s)&&s.includes(weapon)).map(([r])=>r)),mg=curLevel(b,'Magic');
    return spellbookData.spells.map(([name,lv,runes])=>({name,lv,casts:Math.min(...runes.map(([r,c])=>free.has(r)?Infinity:Math.floor(have(r)/c))),can:!Number.isFinite(mg)||mg>=lv})).filter(s=>s.casts>0&&Number.isFinite(s.casts));
  }
  const teleLine=b=>{const l=teleCasts(b);return l.length?'<p class="tele-casts" title="'+E(l.map(s=>s.name+' ×'+s.casts+(s.can?'':' (Magic '+s.lv+' needed)')).join(', '))+'">Tele: '+l.map(s=>'<span class="'+(s.can?'':'tele-low')+'" title="'+E(s.name+' · Magic '+s.lv+(s.can?'':' (too low)'))+'">'+E(s.name.slice(0,3))+' ×'+s.casts+'</span>').join(' · ')+'</p>':'';};
  // Items kept on death (RuneLite's Items Kept on Death): in the Wilderness, the 3 items the account keeps (pvpState,
  // green) and the items of value it loses (red), on the worn items and the pack. deathMarks gives the kept units by name
  // (pvpState counts each unit of a stack once); deathCls uses them up by the stack's count, in the order the cells are
  // drawn (worn items first). A stack with only some units kept is death-part: green border, red tint.
  function deathMarks(b){try{const p=b?.inWorld&&b.pos&&wildLevel(b.pos)?pvpState(b):null;if(!p)return null;const keep=new Map();for(const k of p.kept)keep.set(k.name,(keep.get(k.name)||0)+1);return keep;}catch{return null;}}
  function deathCls(marks,item){
    if(!marks||!item?.name)return '';
    const count=Math.max(1,item.count||1),left=marks.get(item.name)||0,take=Math.min(left,count);
    if(take>0)marks.set(item.name,left-take);
    if(take>=count)return ' death-kept';
    if(take>0)return ' death-part';
    return (S?.economy?.itemValues?.[item.name]??(item.name==='Coins'?1:0))>0?' death-lost':'';
  }
  // Item identification (RuneLite's Item Identification): the game names every unidentified herb "Herb" (obj.pack
  // unidentified_*), so the item id gives its short name; a potion (a name ending in its doses, "(3)") shows its type:
  // Str, Pra, SAtt for a super attack.
  const HERB_IDS={199:'Gua',201:'Mar',203:'Tar',205:'Har',207:'Ran',209:'Iri',211:'Ava',213:'Kwu',215:'Cad',217:'Dwa',219:'Tor',2485:'Lan',3049:'Toa',3051:'Sna'};
  const POTION_IDS={attack:'Att',strength:'Str',defence:'Def',prayer:'Pra',restore:'Res',energy:'Ene',ranging:'Rng',magic:'Mag',antipoison:'AP',superantipoison:'SAP',fishing:'Fsh',agility:'Agi',combat:'Cmb',zamorak:'Zam',saradomin:'Sar',antifire:'AF',weapon:'WP'};
  function idLabel(item){
    if(!item||typeof hl==='undefined'||hl.itemIds===false)return '';
    const id=item.baseId??item.id,n=String(item.name||'');
    if(n==='Herb'&&HERB_IDS[id])return HERB_IDS[id];
    const p=n.match(/^(super ?)?([a-z]+)\b[^()]*\(\d\)$/i);
    if(p&&POTION_IDS[p[2].toLowerCase()])return (p[1]?'S':'')+POTION_IDS[p[2].toLowerCase()];
    return '';
  }
  const idTag=item=>{const l=idLabel(item);return l?'<span class="item-id">'+E(l)+'</span>':'';};
  function itemCell(item,i,extra=''){return `<button class="inventory-cell${invTag(item)}${extra}" data-item="${i}" title="${item?E(item.name)+' × '+E(item.count)+E(statTip(item)+priceTip(item)):'Empty slot'}" aria-label="${item?E(item.name)+' × '+E(item.count):'Empty inventory slot '+(i+1)}">${item?icon(item.name,32)+(item.count>1?qty(item.count):'')+chargeTag(item)+idTag(item):''}</button>`;}
  // The combat level line under the Skills tab, with the levels each style needs for the next one on hover.
  function combatLine(b){const X=window.atlasXp;if(!b?.skills?.length||!X?.combat)return '';const lv=Object.fromEntries(b.skills.map(s=>[s.name,s.level])),c=X.combat(lv);
    const n=c.next,parts=n?[['Attack/Strength',n.melee],['Defence/Hitpoints',n.defence],['Prayer',n.prayer],['Ranged',n.ranged],['Magic',n.magic]].filter(([,v])=>v!=null).map(([k,v])=>v+' '+k):[];
    return '<div class="skill-total combat-line" title="'+(n?'Next combat level ('+(c.level+1)+'): '+E(parts.join(', or '))+'.':'Highest combat level')+'">Combat level: '+c.level+(n&&parts.length?' <small>next: '+E(parts[0])+'</small>':'')+'</div>';}
  // Banked XP line (RuneLite's Banked Experience panel): under the Skills tab, each skill the bank holds XP for
  // (bankedXp), the most first, with the levels it gains; the tooltip lists them all.
  function bankedLine(b){if(typeof bankedXp!=='function'||!Array.isArray(b?.bank))return '';
    const list=skills.map(n=>{const x=bankedXp(b,n),lv=(b.skills||[]).find(k=>k.name===n)?.level;return x?{n,xp:x.xp,gain:x.level&&lv?x.level-lv:0}:null;}).filter(Boolean).sort((a,c)=>c.xp-a.xp);
    if(!list.length)return '';const t=x=>x.n+' +'+nf(x.xp)+(x.gain>0?' (+'+x.gain+' level'+(x.gain===1?'':'s')+')':'');
    return '<div class="skill-total combat-line" title="'+E('Banked XP: '+list.map(t).join(', ')+'. The bank as last observed.')+'">Banked XP: '+nf(list.reduce((n,x)=>n+x.xp,0))+' <small>'+E(list.slice(0,2).map(t).join(' · '))+'</small></div>';}
  // Death recap (RuneLite's Death Indicator, with the hits before it), at the top of the Activity plugin: the newest
  // death in the account's tick records, which the PC's dashboard reads on request (/api/death-recap). The death tile
  // shows on the minimap as a red mark.
  // A recap belongs to one reported death (deathAt) and is read again when the account reports a newer death, or when
  // it is older than the server's 30 s cache and still waits for the respawn, found no death, failed, or is of an
  // earlier death: a running record can hold the death only some seconds after the status reports it, and until then
  // the newest record with a death is an older one. A recap is of the reported death when its death time is within
  // 10 minutes before the report (the RESULT line comes when the run ends).
  let recap={name:null,state:'none',data:null,error:'',deathAt:null,at:0};
  const recapOfDeath=()=>Number.isFinite(recap.data?.at)&&Number.isFinite(recap.deathAt)&&recap.data.at<=recap.deathAt+60_000&&recap.deathAt-recap.data.at<=10*60_000;
  const recapStale=b=>!!b?.death&&!b.practice&&(recap.name!==b.name||recap.deathAt!==b.death.at||(recap.state==='ok'&&(recap.data?.kept==null||!recapOfDeath())||recap.state==='none'||recap.state==='error')&&Date.now()-recap.at>30_000);
  function loadRecap(name){
    const deathAt=S?.bots?.find(x=>x.name===name)?.death?.at??null,at=Date.now();
    if(!window.atlasOperator()){recap={name,state:'off',data:null,error:'',deathAt,at};paintRecap();return;}
    recap={name,state:'loading',data:null,error:'',deathAt,at};paintRecap();
    fetch('/api/death-recap?name='+encodeURIComponent(name)).then(r=>r.ok?r.json():Promise.reject(Error('HTTP '+r.status))).then(j=>{if(recap.name!==name||recap.at!==at)return;recap={name,state:j.recap?'ok':'none',data:j.recap||null,error:'',deathAt,at};paintRecap();minimap();},e=>{if(recap.name!==name||recap.at!==at)return;recap={name,state:'error',data:null,error:String(e?.message||e),deathAt,at};paintRecap();});
  }
  function recapHtml(r){
    const head=`<div class="xp-head"><span>Death · ${E(safeName(r.name||''))}</span>${r.data?.at?'<span class="xp-muted">'+age(r.data.at)+' ago</span>':''}</div>`;
    if(r.state==='loading')return head+'<span class="xp-muted">Reading the tick records…</span>';
    if(r.state==='off')return head+'<span class="xp-muted">The recap reads the tick records on the PC: only the dashboard on the PC shows it.</span>';
    if(r.state==='error')return head+'<span class="xp-muted">The recap could not be read: '+E(r.error)+'</span>';
    if(r.state!=='ok'||!r.data)return head+'<span class="xp-muted">No death in the newest tick records of this account.</span>';
    const d=r.data,w=d.pos?wildLevel(d.pos):0,maxHp=Math.max(1,...d.hp.map(h=>h[1]??0));
    const grid=list=>list?.length?'<div class="recap-items">'+list.map(i=>`<span class="recap-item" title="${E(i.name)} × ${i.count}">${icon(i.name,32)}${i.count>1?qty(i.count):''}</span>`).join('')+'</div>':'<span class="xp-muted">nothing</span>';
    return head+`<div class="xp-meta"><span>${d.pos?'Tile '+d.pos.x+', '+d.pos.z+(d.pos.level?' · floor '+d.pos.level:''):'Tile unknown'}</span><span>${w?'Wilderness '+w:''}</span></div>`+
      `<div class="xp-meta"><span>Last hit: <b>${E(d.killer||'no hit seen')}</b></span></div>`+
      `<div class="recap-label">Hits in the last 30 ticks</div><div class="recap-hits">${d.hits.map(h=>`<span class="hitsplat${h.damage?'':' zero'}" title="${E('tick '+h.tick+' · '+h.source)}">${h.damage}</span>`).join('')||'<span class="xp-muted">none seen</span>'}</div>`+
      `<div class="recap-label">Hitpoints</div><div class="recap-hp">${d.hp.map(h=>`<i style="height:${Math.round(100*(h[1]??0)/maxHp)}%" title="${E('tick '+h[0]+': '+(h[1]??'?')+' hp')}"></i>`).join('')}</div>`+
      `<div class="recap-label">Last actions</div><div class="xp-meta recap-actions">${d.actions.map(a=>`<span>${E(a.type)}</span>`).join('')||'<span>none</span>'}</div>`+
      `<div class="recap-label">Carried</div>${grid(d.carried)}`+(d.lost?`<div class="recap-label">Lost</div>${grid(d.lost)}<div class="recap-label">Kept</div>${grid(d.kept)}`:'<span class="xp-muted">Not respawned in the record yet: what the death took is not known.</span>')+
      `<p class="xp-muted recap-foot">${E(String(d.script).split(/[\\/]/).pop())} · tick ${d.tick}. The last death in the newest record that has one; it can be a practice run.</p>`;
  }
  // The Activity plugin (operations.js) draws the card at its top; a new state of the recap draws the plugin again.
  // Each draw of Activity checks the watched account: a newer death or a respawn reads the recap again.
  window.atlasRecapHtml=()=>{const b=typeof account==='function'?account():null;if(recap.state!=='loading'&&recapStale(b))loadRecap(b.name);return recap.name?'<div class="death-recap"><div class="xp-box">'+recapHtml(recap)+'</div></div>':'';};
  function paintRecap(){if(selectedPlugin==='activity'&&window.atlasPlugins?.activity)window.atlasPlugins.activity.render(body);}
  // Quest Journal, Fleet view (RuneLite's Quest List colours over every account): each quest with how many of our
  // accounts finished it, green when all did, yellow when some did or started it, red when none did. A click lists
  // each account in its colour.
  let questScope='account';
  const questScopeBar=()=>`<div class="quest-scope"><button data-quest-scope="account" class="${questScope==='account'?'on':''}">This account</button><button data-quest-scope="fleet" class="${questScope==='fleet'?'on':''}">Fleet</button></div>`;
  function fleetQuests(){
    const bots=S?S.bots.filter(x=>!x.practice&&!x.reserved&&Array.isArray(x.quests)&&x.quests.length):[],done=q=>q.state==='complete'||q.state==='completed',byQuest=new Map();
    for(const x of bots)for(const q of x.quests){if(!q?.name)continue;const r=byQuest.get(q.name)??{name:q.name,done:[],started:[],todo:[]};(done(q)?r.done:q.state==='started'?r.started:r.todo).push(x.name);byQuest.set(q.name,r);}
    const kind=r=>r.done.length&&!r.started.length&&!r.todo.length?'completed':r.done.length||r.started.length?'in progress':'not started',colour={completed:'#00ff00','in progress':'#ffff00','not started':'#ff0000'};
    if(questDetail&&byQuest.has(questDetail)){const r=byQuest.get(questDetail),line=(names,c,label)=>names.map(n=>`<span style="color:${c}" title="${label}">${E(safeName(n))}</span>`).join('');return '<h3>'+E(r.name)+'</h3><p style="text-align:center">'+r.done.length+' of '+(r.done.length+r.started.length+r.todo.length)+' accounts done</p><div class="game-list quest-accounts">'+line(r.done,'#00ff00','done')+line(r.started,'#ffff00','started')+line(r.todo,'#ff0000','not started')+'</div><button class="game-control" data-quest-back>Back to quest list</button>';}
    const rows=[...byQuest.values()].sort((a,c)=>a.name.localeCompare(c.name)),shown=rows.filter(r=>(questFilter==='all'||kind(r)===questFilter)&&r.name.toLowerCase().includes(questQuery.toLowerCase()));
    const any=rows.filter(r=>r.done.length).length,every=rows.filter(r=>kind(r)==='completed').length;
    if(!bots.length)return '<h3>Quest Journal</h3>'+questScopeBar()+'<p class="game-muted">No account reports its quests.</p>';
    return '<h3>Quest Journal</h3>'+questScopeBar()+'<p style="text-align:center">'+any+' of '+rows.length+' done by an account · '+every+' by all '+bots.length+'</p><div class="quest-filter">'+[['all','All'],['completed','All done'],['in progress','Some'],['not started','None']].map(([id,label])=>`<button data-quest-filter="${id}" class="${questFilter===id?'on':''}">${label} ${id==='all'?rows.length:rows.filter(r=>kind(r)===id).length}</button>`).join('')+'</div><input class="quest-search" data-quest-search placeholder="Find a quest…" aria-label="Search quests" value="'+E(questQuery)+'"><div class="game-list">'+shown.map(r=>`<button class="quest-fleet-row" style="color:${colour[kind(r)]}" data-quest="${E(r.name)}" title="${r.done.length} done, ${r.started.length} started, ${r.todo.length} not started"><span>${E(r.name)}</span><span>${r.done.length}/${r.done.length+r.started.length+r.todo.length}</span></button>`).join('')+'</div>';
  }
  function gamePanel(){
    const b=account(),panel=$('#game-panel');let html='';
    if(selectedTab==='inventory'){const dm=deathMarks(b);if(dm)for(const it of b.equipment||[])deathCls(dm,it);html=b?.inventory?'<div class="inventory-grid">'+Array.from({length:28},(_,i)=>itemCell(b.inventory[i],i,deathCls(dm,b.inventory[i]))).join('')+'</div>'+invWorth(b.inventory)+teleLine(b):'<p class="game-muted">Select an account with a reported inventory.</p>';}
    if(selectedTab==='skills'){html='<div class="skill-grid">'+skills.filter(n=>reported(b,n)).map(n=>{const s=level(n);return `<button class="game-skill" data-skill="${n}" title="${n}${s?(s.xp!=null?' · '+s.xp.toLocaleString()+' XP':' · level '+s.level):' · not reported by this game'}"><img src="${asset('skill-'+skillFile(n)+'.png')}" alt=""><span>${s?s.currentLevel??s.level:'—'}<small>／${s?s.level:'—'}</small></span></button>`;}).join('')+'</div><div class="skill-total">Total level: '+(b?.skills?.filter(realSkill).reduce((n,s)=>n+s.level,0)??'—')+'</div>'+combatLine(b)+bankedLine(b);}
    if(selectedTab==='equipment'&&b?.equipment?.length&&b.equipment.every(e=>e.slot==null)){html='<div class="game-list">'+b.equipment.map(it=>`<span class="equip-row">${icon(it.name,32)}<span>${E(it.name)}</span></span>`).join('')+'</div><p class="game-muted">The '+E(b.side||'other')+' side reports worn items without their slots. Snapshot '+age(b.at)+' old.</p>';}
    else if(selectedTab==='equipment'){const slots=[[0,'Head',78,4,0],[1,'Cape',37,43,1],[2,'Neck',78,43,2],[13,'Ammo',119,43,10],[3,'Weapon',22,82,3],[4,'Body',78,82,5],[5,'Shield',134,82,6],[7,'Legs',78,122,7],[9,'Hands',22,162,8],[10,'Feet',78,162,9],[12,'Ring',134,162,4]];const dm=deathMarks(b);html='<div class="equipment-doll">'+slots.map(([id,name,x,y,f])=>{const it=b?.equipment?.find(e=>e.slot===id),su=setupSlot(b,id,it);return `<button class="equipment-slot${su.cls}${deathCls(dm,it)}" style="left:${x}px;top:${y}px" data-equipment="${id}" title="${(it?E(it.name)+(it.count>1?' × '+E(it.count):''):name+' · '+(b?.equipment?'empty':'not reported'))+E(su.tip)}">${it?icon(it.name,32)+(it.count>1?qty(it.count):'')+chargeTag(it):'<i class="worn-icon" style="background-position:-'+32*(f%4)+'px -'+32*Math.floor(f/4)+'px"></i>'}</button>`;}).join('')+'</div>'+(b?'<p class="game-muted">'+(b.equipment?(window.atlasOperator()?'Observed ':'Updated ')+''+age(b.at)+' ago':'Equipment is not reported for this account.')+'</p>':'<p class="game-muted">Select an account in the title bar.</p>')+equipStats(b)+setupPanel(b);}
    if(selectedTab==='quests'&&questScope==='fleet')html=fleetQuests();
    else if(selectedTab==='quests'){
      const quests=b?.quests||[];
      const qp=b?.ranks?.find(r=>r.board==='Quest Points')?.level??null;const done=q=>q.state==='complete'||q.state==='completed',kind=q=>done(q)?'completed':q.state==='not started'?'not started':q.state==='started'?'in progress':'unknown',ready=q=>typeof questReady==='function'&&questReady(b,q),shown=quests.filter(q=>(questFilter==='all'||(questFilter==='ready'?ready(q):kind(q)===questFilter))&&q.name.toLowerCase().includes(questQuery.toLowerCase()));html='<h3>Quest Journal</h3>'+questScopeBar()+'<p style="text-align:center">Quest Points: '+(qp==null?'—':E(qp))+(typeof questRewardData!=='undefined'&&questRewardData&&quests.length?' · '+quests.filter(q=>!done(q)).reduce((n,q)=>n+(questRewardData[q.name]?.[0]||0),0)+' left':'')+'</p><p class="game-muted" style="text-align:center">'+(b?.questsAt?(window.atlasOperator()?'Observed ':'Updated ')+''+age(b.questsAt)+' ago':'No quest snapshot')+'</p>'+(quests.length?'<div class="quest-filter">'+[['all','All'],['completed','Done'],['in progress','Started'],['not started','To do'],['ready','Ready'],['unknown','Unknown']].filter(([id])=>id!=='ready'||(typeof questReqData!=='undefined'&&questReqData)).map(([id,label])=>`<button data-quest-filter="${id}" class="${questFilter===id?'on':''}"${id==='ready'?' title="Not done, and every requirement is met"':''}>${label} ${id==='all'?quests.length:quests.filter(q=>id==='ready'?ready(q):kind(q)===id).length}</button>`).join('')+'</div><input class="quest-search" data-quest-search placeholder="Find a quest…" aria-label="Search quests" value="'+E(questQuery)+'">':'')+'<div class="game-list">'+shown.map(q=>`<button style="color:${q.state==='complete'||q.state==='completed'?'#00ff00':q.state==='not started'?'#ff0000':q.state==='started'?'#ffff00':'#aaa'}" data-quest="${E(q.name)}" title="${E(typeof rewardText==='function'?rewardText(q.name):'')}">${E(q.name)}</button>`).join('')+'</div>';
      if(!quests.length)html+='<p class="game-muted">Quest progress has not been reported for this account.</p>';
      if(questDetail){const q=quests.find(q=>q.name===questDetail);html='<h3>'+E(questDetail)+'</h3><p style="text-align:center">'+E(q?.state||'Not reported')+'</p>'+(typeof rewardText==='function'&&rewardText(questDetail)?'<p class="quest-reward">Reward: '+E(rewardText(questDetail))+'</p>':'')+(typeof reqHtml==='function'?reqHtml(b,questDetail)+itemHtml(b,questDetail):'')+'<p class="game-muted">'+(b?.questsAt?'Last observed '+age(b.questsAt)+' ago.':'No quest snapshot.')+'</p><button class="game-control" data-quest-back>Back to quest list</button>';}
    }
    if(selectedTab==='friends'){
      if(!S)html='<h3>Friends List</h3><p class="game-muted" role="status">Waiting for fleet data…</p>';
      else{const bots=S.bots.filter(x=>!x.practice&&!x.reserved).sort((x,y)=>(y.inWorld?1:0)-(x.inWorld?1:0)||x.name.localeCompare(y.name));
      html='<h3>Friends List</h3><p style="text-align:center">Friends: '+bots.filter(x=>x.inWorld).length+' online / '+bots.length+'</p><div class="game-list friends-list">'+bots.map(x=>`<button data-friend="${E(x.name)}" title="${E(safeName(x.name))}${x.goal?' · '+E(x.goal):''}"><span>${E(safeName(x.name))}</span><span class="${x.inWorld?'friend-on':'friend-off'}">${x.inWorld?(window.atlasOperator()?E(x.side||'local'):'Online'):'Offline'}</span></button>`).join('')+'</div><button class="game-control" data-open-plugin="fleet">Fleet plugin</button>';}}
    if(selectedTab==='settings')html='<h3 class="cyan">Game Options</h3><label>Display mode<select id="game-display"><option value="open">Sidebar open</option><option value="closed" '+(app.classList.contains('client-collapsed')?'selected':'')+'>Game only</option></select></label><label>Render quality<select id="game-quality"><option value="1">Sharp</option><option value="0.75">Balanced</option><option value="0.5">Light</option></select></label>'+(window.FleetShim?'<label>Roofs<select id="game-roofs"><option value="off">Removed</option><option value="on" '+(window.atlasRoofsOff()?'':'selected')+'>Shown</option></select></label>':'')+'<button class="game-control" data-toggle-chat>Show / hide chatbox</button><button class="game-control" data-places>Places & camera</button>'+(window.atlasOperator()?'<button class="game-control" data-open-plugin="machine">Performance</button>':'');
    if(selectedTab==='logout'){const owner=window.FleetShim?.signedIn?.();html='<p style="text-align:center">'+(owner?'Logged in as '+E(owner)+'.':'You are watching as a spectator.')+'</p><p class="game-muted">Account sessions belong to their workers; logging out here never logs a bot out.</p><button class="game-control" data-logout>Click here to logout</button><button class="game-control" data-open-plugin="fleet">View active sessions</button>';}
    const active=document.activeElement,friend=panel.contains(active)?active.dataset.friend:null;
    const typing=active?.matches?.('[data-quest-search]')?[document.activeElement.selectionStart,document.activeElement.selectionEnd]:null;
    put(panel,html);
    if(!active?.isConnected){
      if(typing){const box=panel.querySelector('[data-quest-search]');if(box){box.focus({preventScroll:true});box.setSelectionRange(typing[0],typing[1]);}}
      if(friend)panel.querySelector('[data-friend="'+CSS.escape(friend)+'"]')?.focus({preventScroll:true});
    }
    hud.querySelectorAll('[data-game-tab]').forEach(el=>{el.classList.toggle('active',el.dataset.gameTab===selectedTab);el.setAttribute('aria-pressed',String(el.dataset.gameTab===selectedTab));});
    if(selectedTab==='settings')$('#game-quality').value=String(window.atlasQuality||1);
  }
  // The XP Tracker plugin (RuneLite's): gains since the account's login, XP an hour, level progress, time to level.
  // Quest rewards (Quest Journal): each quest's quest points and XP on this server (client-assets/quest-rewards.json, the
  // base XP times the XP rate), as the tooltip of its row and on its page; the header counts the quest points left.
  let questRewardData=null;
  fetch(asset('quest-rewards.json')).then(r=>r.ok?r.json():null).then(j=>{if(j&&typeof j==='object')questRewardData=j;},()=>{});
  // Quest requirements (RuneLite's Quest Helper): client-assets/quest-reqs.json (gen-quest-reqs.ts) has each quest's
  // skills [skill, level, src], quest points [n, src] and quests [name, src]; src 1 the server checks it and the wiki
  // lists it, 0 only the wiki lists it, 2 only the quest's scripts check it. A skill counts its base level.
  let questReqData=null;
  fetch(asset('quest-reqs.json')).then(r=>r.ok?r.json():null).then(j=>{if(j&&typeof j==='object')questReqData=j;},()=>{});
  const REQ_SRC=['only the wiki lists this','the server checks this','the quest scripts check this; the wiki does not list it'];
  function questReqs(b,name){const r=questReqData?.[name];if(!r)return [];const lv=n=>(b?.skills||[]).find(x=>x.name===n)?.level,qs=b?.quests||[],qp=b?.ranks?.find(x=>x.board==='Quest Points')?.level;
    const done=n=>{const q=qs.find(x=>x.name===n);return q?q.state==='complete'||q.state==='completed':null;};
    return [...r.s.map(([k,n,src])=>{const have=lv(k);return {text:n+' '+k,ok:Number.isFinite(have)?have>=n:null,have:Number.isFinite(have)?have:null,src};}),
      ...(r.qp?[{text:r.qp[0]+' quest points',ok:Number.isFinite(qp)?qp>=r.qp[0]:null,have:Number.isFinite(qp)?qp:null,src:r.qp[1]}]:[]),
      ...r.q.map(([n,src])=>({text:n,ok:done(n),have:null,src}))];}
  // Ready: not done, and every requirement is met (a quest with no listed requirement is ready). Until the data loads,
  // no quest is ready and the Ready filter is hidden.
  const questReady=(b,q)=>!!questReqData&&!(q.state==='complete'||q.state==='completed')&&questReqs(b,q.name).every(x=>x.ok===true);
  // Quest items: i [[item, count, src]] (src 1 the quest's scripts name the item, 0 only the wiki lists it), held across
  // the pack, worn gear and the bank (the bank as last observed). Items do not count for Ready: they can be bought.
  function questItems(b,name){const l=questReqData?.[name]?.i;if(!l)return [];const all=[...(b?.inventory||[]),...(b?.equipment||[]),...(b?.bank||[])].filter(Boolean);
    return l.map(([n,c,src])=>{const have=all.filter(x=>x.name===n).reduce((t,x)=>t+(x.count||1),0);return {text:(c>1?c+' ':'')+n,ok:have>=c,have,src};});}
  const itemHtml=(b,name)=>{const l=questItems(b,name);return l.length?'<p class="quest-reqs">Items: '+l.map(x=>'<span class="'+(x.ok?'req-ok':'req-miss')+(x.src===1?'':' req-soft')+'" title="'+E((x.src===1?'the quest scripts use this item':'only the wiki lists this')+' · holds '+x.have+(b?.bankAt?'':' (no bank snapshot)'))+'">'+E(x.text)+(!x.ok&&x.have?' ('+x.have+')':'')+'</span>').join(', ')+'</p>':'';};
  const reqHtml=(b,name)=>{const l=questReqs(b,name);return l.length?'<p class="quest-reqs">Needs: '+l.map(x=>'<span class="'+(x.ok===true?'req-ok':x.ok===false?'req-miss':'req-unknown')+(x.src===1?'':' req-soft')+'" title="'+E(REQ_SRC[x.src]+(x.have!=null&&!x.ok?' · has '+x.have:''))+'">'+E(x.text)+(x.have!=null&&x.ok===false?' ('+x.have+')':'')+'</span>').join(', ')+'</p>':'';};
  // The third list is XP that is one of several outcomes (a random reward): "one of".
  const rewardText=name=>{const r=questRewardData?.[name];if(!r)return '';const alt=r[2]||[];return [r[0]?r[0]+(r[0]===1?' quest point':' quest points'):'',...r[1].map(([s,x])=>nf(x)+' '+s+' XP'),alt.length?'one of: '+alt.map(([s,x])=>nf(x)+' '+s).join(', ')+' XP':''].filter(Boolean).join(' · ');};
  // Inventory Setups (RuneLite's) in the Equipment tab: choose a PvP kit (client-assets/pk-kits.json, from
  // scripts/pk-kits.ts). The doll marks each slot green when the account wears the kit's item, red when it does not, and
  // yellow when it wears something the kit leaves empty; the list below shows what the kit carries against the pack.
  let pkKits=null,setupKit=(()=>{try{return localStorage.getItem('atlas-setup-kit')||'';}catch{return '';}})();
  fetch(asset('pk-kits.json')).then(r=>r.ok?r.json():null).then(j=>{if(Array.isArray(j))pkKits=j;},()=>{});
  const setupOf=()=>pkKits?.find(k=>k.name===setupKit)||null;
  const sameItem=(it,want)=>!!it&&String(it.name).toLowerCase()===String(want[0]).toLowerCase()&&(it.count||1)>=want[1];
  const setupSlot=(b,id,it)=>{const k=setupOf();if(!k||!b?.equipment)return {cls:'',tip:''};const want=k.worn[id];if(want)return sameItem(it,want)?{cls:' setup-ok',tip:' · kit: '+want[0]}:{cls:' setup-miss',tip:' · kit wants '+want[0]+(want[1]>1?' × '+want[1]:'')};return it?{cls:' setup-extra',tip:' · the kit leaves this slot empty'}:{cls:'',tip:''};};
  function setupPanel(b){
    if(!pkKits?.length)return '';
    const k=setupOf(),opts='<option value="">No setup</option>'+pkKits.map(x=>`<option value="${E(x.name)}" ${x.name===setupKit?'selected':''}>${E(x.name)}</option>`).join('');
    let rows='';
    if(k&&b){
      const have=n=>(b.inventory||[]).filter(i=>i&&String(i.name).toLowerCase()===n.toLowerCase()).reduce((t,i)=>t+(i.count||1),0);
      // The bank's count of each kit item, for a restock (b.bank is the last observed bank).
      const banked=n=>Array.isArray(b.bank)?b.bank.filter(i=>i&&String(i.name).toLowerCase()===n.toLowerCase()).reduce((t,i)=>t+(i.count||1),0):null;
      const differ=Object.entries(k.worn).filter(([id,w])=>!sameItem(b.equipment?.find(e=>e.slot===Number(id)),w)).length;
      rows='<p class="game-muted">'+(b.equipment?differ?differ+' worn slot'+(differ===1?'':'s')+' differ from the kit':'Every worn slot matches the kit':'Equipment is not reported.')+'</p>'+k.carried.map(([n,c])=>{const h=have(n),bk=banked(n);return `<div class="setup-row ${h>=c?'setup-have':'setup-short'}" title="${E(n)}: ${nf(h)} held, ${nf(c)} in the kit${bk==null?'':', '+nf(bk)+' in the bank'}">${icon(n,24)}<span>${E(n)}</span><span>${nf(h)} / ${nf(c)}${bk==null?'':` <small class="setup-bank${h+bk<c?' setup-bank-short':''}">bank ${nf(bk)}</small>`}</span></div>`;}).join('');
    }
    // Restock: what the pack and the bank together miss for the kit, with the cost at the GE price (itemValues).
    if(k&&b&&Array.isArray(b.bank)){const price=n=>(typeof S!=='undefined'&&S?.economy?.itemValues?.[n])||0,miss=k.carried.map(([n,c])=>{const own=(b.inventory||[]).filter(i=>i&&String(i.name).toLowerCase()===n.toLowerCase()).reduce((t,i)=>t+(i.count||1),0)+b.bank.filter(i=>i&&String(i.name).toLowerCase()===n.toLowerCase()).reduce((t,i)=>t+(i.count||1),0);return [n,Math.max(0,c-own)];}).filter(([,m])=>m>0);
      if(miss.length){const cost=miss.reduce((t,[n,m])=>t+price(n)*m,0),unpriced=miss.filter(([n])=>!price(n)).length;rows+='<p class="setup-restock" title="'+E(miss.map(([n,m])=>nf(m)+' '+n+(price(n)?' at '+nf(Math.round(price(n)))+' gp':' (no GE price)')).join(', '))+'">Restock: '+E(miss.slice(0,3).map(([n,m])=>nf(m)+' '+n).join(', '))+(miss.length>3?' +'+(miss.length-3):'')+' · ≈ '+nf(Math.round(cost))+' gp'+(unpriced?' + '+unpriced+' unpriced':'')+'</p>';}}
    return `<div class="setup"><label>Setup <select data-setup-kit aria-label="Inventory setup">${opts}</select></label>${rows}</div>`;
  }
  // Screenshot (RuneLite's Screenshot plugin): the 3D view of the watched account is captured on a level-up, a death and
  // a loot item worth at least the chosen value (the viewer's {capture} message), and kept in this browser (IndexedDB,
  // the newest 60). Activity's Shots tab shows them; a click opens one full size.
  const SHOT_CFG_KEY='atlas-shots-cfg',SHOT_DEFAULT={level:true,death:true,loot:100000};
  const shotCfg=(()=>{try{return {...SHOT_DEFAULT,...JSON.parse(localStorage.getItem(SHOT_CFG_KEY)||'{}')};}catch{return {...SHOT_DEFAULT};}})();
  const saveShotCfg=()=>{try{localStorage.setItem(SHOT_CFG_KEY,JSON.stringify(shotCfg));}catch{/* private window */}};
  let shots=[];const pendingShots=new Map(),lootSeen=new Map();
  const shotDb=()=>new Promise((res,rej)=>{try{const r=indexedDB.open('atlas-shots',1);r.onupgradeneeded=()=>r.result.createObjectStore('shots',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}catch(e){rej(e);}});
  shotDb().then(db=>{const q=db.transaction('shots').objectStore('shots').getAll();q.onsuccess=()=>{shots=(q.result||[]).sort((a,b)=>b.at-a.at);};},()=>{});
  function saveShot(s){shots=[s,...shots.filter(x=>x.id!==s.id)].slice(0,60);shotDb().then(db=>{const st=db.transaction('shots','readwrite').objectStore('shots');st.put(s);const keep=new Set(shots.map(x=>x.id));const all=st.getAllKeys();all.onsuccess=()=>{for(const k of all.result||[])if(!keep.has(k))st.delete(k);};},()=>{});}
  function takeShot(name,kind,text){
    if(typeof VIEWER==='undefined'||VIEWER.state!=='ready')return;
    const id=Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    pendingShots.set(id,{name,kind,text,at:Date.now()});setTimeout(()=>pendingShots.delete(id),10_000);
    $('#rsw')?.contentWindow?.postMessage({capture:{id}},location.origin);
  }
  function shotReply(d){const p=pendingShots.get(d?.id);if(!p||typeof d.url!=='string'||!d.url.startsWith('data:image/'))return;pendingShots.delete(d.id);saveShot({id:d.id,...p,url:d.url});if(selectedPlugin==='activity')window.atlasPlugins?.activity?.render(body);}
  // Only the owner takes pictures: a signed-out viewer has no Activity plugin to see or turn them off.
  const shotFor=(b,kind,text)=>{if(b&&shotCfg[kind]&&window.atlasOperator?.()&&account()?.name===b.name)takeShot(b.name,kind,text);};
  // Loot shots: a loot item of the watched account that gained at least the chosen value since the last refresh.
  function lootShots(){
    const b=account();if(!b?.flow||!shotCfg.loot)return;
    const prev=lootSeen.get(b.name),now=new Map((b.flow.loot||[]).map(i=>[i.name,i.count]));lootSeen.set(b.name,now);
    if(!prev)return;
    for(const [n,c] of now){const d=c-(prev.get(n)??0),v=(S?.economy?.itemValues?.[n]??0)*d;if(d>0&&v>=shotCfg.loot){shotFor(b,'loot',n+(d>1?' × '+d:'')+' ('+gp(v)+')');break;}}
  }
  window.atlasShots=()=>({shots,cfg:shotCfg});
  // Tick efficiency (one box under Overall, and the waste sort of the account list): the last ticks of the status
  // timeline as a strip, the share of work and idle, and the biggest waste.
  const TICK_LABEL={xp:'XP',inventory:'items',move:'walking',anim:'animating',dialog:'dialog',stun:'stunned',idle:'idle'};
  let xpSort='rate';
  const tickStrip=(timeline,cls='xp-ticks')=>{const t=String(timeline||'').split('').filter(k=>k in window.atlasXp.TICK_KINDS),n=t.length;return `<div class="${cls}" aria-label="Last ${n} ticks">${t.map((k,i)=>{const kind=window.atlasXp.TICK_KINDS[k];return `<i style="background:var(--c-${kind})" title="${n-i} ticks ago: ${TICK_LABEL[kind]}"></i>`;}).join('')}</div>`;};
  function efficiencyBox(b){
    const e=window.atlasXp.efficiency(b.timeline);
    if(!e)return '<div class="xp-box"><div class="xp-head"><span>Tick efficiency</span></div><span class="xp-muted">No tick timeline reported.</span></div>';
    const c=b.counters||{},extra=[['walkTicks','walk ticks'],['shopTicks','shop ticks'],['stuns','stuns'],['eaten','eaten']].filter(([k])=>Number.isFinite(c[k])).map(([k,label])=>`<span>${E(label)} <b>${nf(c[k])}</b></span>`).join('');
    const stale=!b.fresh?'<span class="xp-muted">Status '+age(b.at)+' old: these ticks are not live.</span>':'';
    // Session statistics: the status `ledger` counts each kind of tick since the session started, not only the last 300.
    const L=b.ledger&&typeof b.ledger==='object'?b.ledger:null,all=L?Object.values(L).filter(Number.isFinite).reduce((n,v)=>n+v,0):0;
    const session=all?`<div class="xp-meta" title="Every tick since the session started"><span>Session <b>${nf(all)}</b> ticks</span><span>idle <b>${Math.round(100*(L.idle||0)/all)}%</b></span><span>work <b>${Math.round(100*((L.xp||0)+(L.inventory||0))/all)}%</b></span></div>`:'';
    return `<div class="xp-box xp-efficiency"><div class="xp-head"><span>Tick efficiency</span><span class="xp-gain${e.idle>=25?' xp-bad':''}">${Math.round(e.idle)}% idle</span></div>${tickStrip(b.timeline)}<div class="xp-meta"><span>Work <b>${Math.round(e.work)}%</b></span><span>${e.waste?'Most waste: '+TICK_LABEL[e.waste.kind]+' <b>'+Math.round(e.waste.share)+'%</b>':'No waste'}</span><span>${e.ticks} ticks</span></div>${session}${extra?'<div class="xp-meta">'+extra+'</div>':''}${stale}</div>`;
  }
  // Skill Calculator (RuneLite's): a click on a skill row of the XP Tracker opens it for that skill. Current level and
  // XP, a target level (the goal level, else 99), the XP left on this server's curve, the time at the account's rate,
  // and each action of the skill (client-assets/skill-actions.json, from the server's tables) with how many it takes
  // and the items they use. Actions above the current level are greyed, as RuneLite greys them.
  let calcSkill=null,calcTarget=null,skillActions=null;
  fetch(asset('skill-actions.json')).then(r=>r.ok?r.json():null).then(j=>{if(j&&typeof j==='object')skillActions=j;},()=>{});
  // Runes per essence (RuneLite's Runecraft overlay, with the server's count): client-assets/runecraft.json (gen-runecraft.ts)
  // has [level, multiplier] by rune; runecraft.rs2 crafts floor(L / multiplier) + 1 runes from each essence at the current
  // Runecraft level L, and 1 when the rune has no multiplier. The Runecraft To level line shows it and the next step.
  let runecraftData={};if(typeof asset==='function'&&typeof fetch==='function')fetch(asset('runecraft.json')).then(r=>r.ok?r.json():{}).then(j=>{runecraftData=j||{};},()=>{});
  function perEssence(rune,L){const r=runecraftData[rune];if(!r||!Number.isFinite(L))return '';const m=r[1];if(!m)return '1 per essence';const n=Math.floor(L/m)+1,next=n*m;return n+' per essence'+(next<=99?' ('+(n+1)+' at '+next+')':'');}
  // Skill guide (RuneLite's Skill Calculator, in the Skills tab tooltip and the XP globes): the best action the account
  // can do now with how many it takes to the next level, and the next actions it unlocks.
  function skillGuide(skill,xp){
    const X=window.atlasXp,acts=skillActions?.[String(skill).toLowerCase()];if(!X||!acts?.length||xp==null)return null;
    const lvl=X.levelForXp(xp),left=lvl>=99?0:Math.max(0,X.xpForLevel(lvl+1)-xp);
    const best=acts.filter(a=>a[1]<=lvl&&a[2]>0).sort((a,b)=>b[2]-a[2])[0]||null,next=acts.filter(a=>a[1]>lvl).sort((a,b)=>a[1]-b[1]||b[2]-a[2]).slice(0,3);
    return {best:best&&left?{name:best[0],count:Math.ceil(left/best[2]),item:best[4]?.[0]||best[0]}:null,next:next.map(a=>({name:a[0],level:a[1]}))};
  }
  // Banked XP (RuneLite's Banked Experience): the XP that the bank holds for a skill. Each bank item that is the only
  // kind of input of an action of the skill (a bone buried, a log burnt, a raw fish cooked, 3 dragon leathers to a body)
  // counts at the action the account can do now with the most XP per item, in whole actions. Items match by id (each
  // action's last field), as the four dragon leathers share one name. An action whose input is its own output (a bow named as its unstrung form)
  // does not count. The level is where the account's XP plus the banked XP reaches. Fishing has none: its input is the
  // bait, and a feather is no fish until it is caught.
  function bankedXp(b,skill){const acts=skillActions?.[String(skill).toLowerCase()],X=window.atlasXp;if(!acts||!Array.isArray(b?.bank)||!X||/^fishing$/i.test(String(skill)))return null;
    const s=(b.skills||[]).find(x=>x.name.toLowerCase()===String(skill).toLowerCase()),lvl=s?.xp!=null?X.levelForXp(s.xp):(s?.level??1),best=new Map();
    for(const a of acts){const ids=a[5]||[],id=ids[0];if(!id||!ids.every(x=>x===id)||a[1]>lvl||!(a[2]>0)||a[4].includes(a[3][0]))continue;const k=ids.length,cur=best.get(id);if(!cur||a[2]/k>cur.xp/cur.k)best.set(id,{k,xp:a[2]});}
    let xp=0,items=0;for(const it of b.bank){const v=it&&best.get(it.baseId??it.id);if(v){const n=Math.floor((it.count||1)/v.k);xp+=n*v.xp;items+=n*v.k;}}
    return xp?{xp:Math.round(xp),items,level:s?.xp!=null?X.levelForXp(s.xp+xp):null}:null;}
  // Best training spot (Skill Calculator): for woodcutting or mining, the best tree or rock the account can use at its
  // level (skill-actions.json, resources.json; normal trees are not in resources.json) and the nearest one on its floor.
  function bestSpot(b,skill,lvl){
    if(typeof resources==='undefined'||!resources||!/^(woodcutting|mining)$/i.test(String(skill||'')))return null;
    const kinds=resources.kinds||{},p=b?.live||b?.pos||null;
    for(const a of (skillActions?.[String(skill).toLowerCase()]||[]).filter(a=>a[1]<=lvl).sort((x,y)=>y[2]-x[2])){
      // The action's name, else its first output item, names the resource; a name that already ends in rock or tree is one
      // ("Limestone rock": skill-actions.json names some actions after their table row).
      const want=resourceOf(a[0])||resourceOf(a[4]?.[0]||'')||(/ (rock|tree)$/i.test(a[0])?a[0]:null);if(!want)continue;
      const ids=new Set(Object.keys(kinds).filter(id=>String(kinds[id]?.name||'').toLowerCase()===want.toLowerCase()).map(Number));
      const tiles=resources.tiles.filter(t=>ids.has(t[3])).map(t=>({x:t[0],z:t[1],l:t[2]}));if(!tiles.length)continue;
      const near=p?tiles.filter(t=>t.l===(p.level||0)&&(t.z>6400)===(p.z>6400)).map(t=>({...t,d:Math.max(Math.abs(t.x-p.x),Math.abs(t.z-p.z))})).sort((x,y)=>x.d-y.d)[0]||null:null;
      return {name:want,level:a[1],tiles,near,item:a[4]?.[0]||a[0]};
    }
    return null;
  }
  // Gather chance (RuneLite's Woodcutting and Mining overlays, with the server's roll): client-assets/gather-chance.json
  // (gen-gather-chance.ts) has each tree's [low, high] for each axe and each rock's [low, high], by the log or ore.
  // woodcut.rs2 and mining.rs2 roll stat_random: floor(low*(99-L)/98) + floor(high*(L-1)/98) + 1 beats a roll of 0-255.
  // A tree counts the best axe the account holds or wears; a pickaxe changes how often a rock is tried, not the roll.
  // Fish have one [low, high] each (fishing.struct). The Skills tab tooltip's To level line and the Best now line show it,
  // for Fishing, Mining and Woodcutting only: Firemaking's logs are its input, not a catch.
  let gatherData={};if(typeof asset==='function'&&typeof fetch==='function')fetch(asset('gather-chance.json')).then(r=>r.ok?r.json():{}).then(j=>{gatherData=j||{};},()=>{});
  // The roll uses the current level (a boost or a drain counts), else the level from the XP.
  function gatherText(b,item,lvl,skill){const g=gatherData[item],cur=skill&&typeof curLevel==='function'?curLevel(b,skill):null;if(Number.isFinite(cur))lvl=cur;if(!g||!Number.isFinite(lvl))return '';
    const roll=([lo,hi])=>{const l=Math.min(lvl,99);return Math.min(Math.floor(lo*(99-l)/98)+Math.floor(hi*(l-1)/98)+1,256)/256;};
    if(g.roll)return Math.round(roll(g.roll)*100)+'% a try';
    const held=new Set([...(b?.inventory||[]),...(b?.equipment||[])].filter(Boolean).map(i=>i.name));
    const t=(g.tool||[]).filter(([n])=>held.has(n)).map(([n,lo,hi])=>({n,p:roll([lo,hi])})).sort((x,y)=>y.p-x.p)[0];
    return t?Math.round(t.p*100)+'% a try with the '+t.n.toLowerCase():'no axe held';}
  const bestSpotLine=(b,lvl)=>{const s=bestSpot(b,calcSkill,lvl);return s?'<div class="calc-best">Best now: <b>'+E(s.name)+'</b> (level '+s.level+')'+(gatherText(b,s.item,lvl,calcSkill)?' · '+E(gatherText(b,s.item,lvl,calcSkill)):'')+(s.near?' · nearest '+nf(s.near.d)+' tiles':'')+' <button class="xp-reset" data-best-pin="'+E(s.name)+'">'+(sourcePin?.key==='best|'+s.name?'Shown':'Show on map')+'</button></div>':'';};
  const guideText=g=>!g?'':(g.best?' · '+nf(g.best.count)+' × '+g.best.name+' to level':'')+(g.next.length?' · next: '+g.next[0].name+' at '+g.next[0].level:'');
  function calcBox(b,row){
    const X=window.atlasXp,k=(b.skills||[]).find(x=>x.name===calcSkill);
    if(!calcSkill||!k||k.xp==null)return '';
    const lvl=X.levelForXp(k.xp),goal=b.goalSkill===calcSkill&&b.goalLevel>lvl?b.goalLevel:99,target=Math.min(99,Math.max(lvl+1,calcTarget??goal));
    const left=lvl>=99?0:Math.max(0,X.xpForLevel(target)-k.xp),rate=row?.rate>0?row.rate:b.goalSkill===calcSkill&&b.xpPerHour>0?b.xpPerHour:0;
    const acts=skillActions?.[calcSkill.toLowerCase()]||[];
    // An action that takes several of one item lists it once with the count: 5 × Runite bar.
    const inputText=l=>{const m=new Map();for(const x of l)m.set(x,(m.get(x)||0)+1);return [...m].map(([x,c])=>(c>1?c+' × ':'')+x).join(', ');};
    const list=acts.map(([name,level,xp,inputs,outputs])=>{const n=Math.ceil(left/xp),can=level<=lvl;return `<div class="calc-row${can?'':' calc-locked'}" title="${E(name+' · level '+level+' · '+xp+' xp each'+(inputs.length?' · uses '+inputText(inputs):''))}">${icon(outputs?.[0]||name,24)}<span class="calc-name">${E(name)}<small>Level ${level} · ${xp} xp${inputs.length?' · '+E(inputText(inputs)):''}</small></span><span class="calc-count">${nf(n)}</span></div>`;}).join('');
    return `<div class="xp-box calc"><div class="xp-head"><span>Skill Calculator · ${E(calcSkill)}</span><button class="xp-reset" data-calc-close>Close</button></div><div class="calc-levels"><span>Current <b>${lvl}</b> <i class="xp-muted">${nf(k.xp)} xp</i></span><label>Target <input type="number" min="${lvl+1}" max="99" value="${target}" data-calc-target aria-label="Target level"></label></div>${bestSpotLine(b,lvl)}<div class="xp-meta"><span><b>${nf(left)}</b> xp left</span><span>${left&&rate?'TTL '+dur(left/rate*3.6e6)+' at '+nf(Math.round(rate))+'/hr':left?'no rate yet':'done'}</span></div>${acts.length?'<div class="calc-list">'+list+'</div>':'<span class="xp-muted">The server has no action table for this skill.</span>'}</div>`;
  }
  const XP_STORE='atlas-xp-baselines';
  const xpStore=()=>{try{return JSON.parse(localStorage.getItem(XP_STORE)||'{}')||{};}catch{return {};}},saveXpStore=store=>{try{localStorage.setItem(XP_STORE,JSON.stringify(store));}catch{/* private window */}};
  function refreshXp(){
    const panel=body.querySelector('.xp-tracker');
    if(!panel)return;
    const b=account(),now=Date.now(),X=window.atlasXp;
    if(!b||b.remote){
      const live=S.bots.filter(x=>x.fresh&&!x.practice&&!x.reserved&&!x.remote),idle=x=>window.atlasXp.efficiency(x.timeline)?.idle??-1;
      live.sort(xpSort==='waste'?(x,y)=>idle(y)-idle(x):(x,y)=>(y.xpPerHour||0)-(x.xpPerHour||0));
      const sort=live.length?`<div class="xp-buttons"><span class="xp-muted">Sort</span><button class="xp-reset${xpSort==='rate'?' on':''}" data-xp-sort="rate">XP/hr</button><button class="xp-reset${xpSort==='waste'?' on':''}" data-xp-sort="waste">Most idle</button></div>`:'';
      return put(panel,'<div class="xp-panel"><div class="xp-box"><div class="xp-head"><span>'+(b?E(safeName(b.name)):'XP Tracker')+'</span></div><span class="xp-muted">'+(!b?'Choose an account in the title bar, or one below.':window.atlasOperator()?'The '+E(b.side)+' side shares levels, not XP.':'No XP data for this account.')+'</span>'+sort+'</div>'+(live.map(x=>{const e=window.atlasXp.efficiency(x.timeline);return `<button class="xp-box xp-row xp-pick" data-xp-focus="${E(x.name)}"><img src="${asset(trainedSkill(x)?'skill-'+skillFile(trainedSkill(x))+'.png':'rl-xp.png')}" alt=""><span class="xp-pick-main"><span class="xp-pick-line"><span class="xp-name">${E(safeName(x.name))}</span><span class="xp-gain">${x.xpPerHour?nf(Math.round(x.xpPerHour))+' XP/hr':'—'}</span></span>${e?tickStrip(x.timeline.slice(-100),'xp-ticks xp-ticks-small')+`<span class="xp-meta"><span class="${e.idle>=25?'xp-bad':''}">${Math.round(e.idle)}% idle</span><span>${e.waste?TICK_LABEL[e.waste.kind]+' '+Math.round(e.waste.share)+'%':''}</span></span>`:''}</span></button>`;}).join('')||(b?'':'<div class="xp-box"><span class="xp-muted">No account with XP data is playing now.</span></div>'))+'</div>');}
    const store=xpStore(),base=X.baseline(store,b,now);saveXpStore(store);
    // Paused: the rows and the clock stay as they were at the pause (RuneLite xptracker pause).
    const at=base.paused?.at??now,seen=base.paused?{...b,skills:(b.skills||[]).map(k=>({...k,xp:base.paused.xp[k.name]??k.xp}))}:b;
    const all=X.rows(seen,base,at,b.goalSkill&&!base.paused?{skill:b.goalSkill,xpPerHour:b.xpPerHour}:null),rows=xpHideMaxed?all.filter(r=>r.level<99):all,total=X.total(all),hours=(at-base.at)/3.6e6;
    // While the calculator's target input has focus, its draft is kept: the panel and the calculator are not replaced.
    const calcEditing=document.activeElement?.matches?.('[data-calc-target]')&&panel.contains(document.activeElement);
    if(!calcEditing)put(panel,'<div class="xp-panel"><div class="xp-box"><div class="xp-head"><span>Overall</span><span class="xp-account"></span></div><div class="xp-stats"></div><div class="xp-buttons"><button class="xp-reset" data-xp-pause>Pause</button><button class="xp-reset" data-xp-reset>Reset</button><label class="xp-hide"><input type="checkbox" data-xp-hide-maxed> Hide maxed</label></div></div>'+efficiencyBox(b)+'<div class="xp-calc"></div><div class="xp-results"></div></div>');
    if(!calcEditing)put(panel.querySelector('.xp-calc'),calcBox(b,all.find(r=>r.skill===calcSkill)));
    panel.querySelector('.xp-account').textContent=safeName(b.name);
    put(panel.querySelector('.xp-stats'),`<span>XP gained <b>${nf(total)}</b></span><span>XP/hr <b>${nf(Math.round(hours>0.001?total/hours:0))}</b></span><span>Tracked <b>${dur(at-base.at)}</b>${base.paused?' (paused)':''}</span>`);
    panel.querySelector('[data-xp-pause]').textContent=base.paused?'Resume':'Pause';
    panel.querySelector('[data-xp-hide-maxed]').checked=xpHideMaxed;
    put(panel.querySelector('.xp-results'),rows.length?rows.map(r=>{const g=r.skill===b.goalSkill?X.goalBar(r,b.goalLevel):null,v=g||r;return `<div class="xp-box xp-row" data-calc-skill="${E(r.skill)}" title="Click for the Skill Calculator"><img src="${asset('skill-'+skillFile(r.skill)+'.png')}" alt="" title="${E(r.skill)}"><div class="xp-main"><div class="xp-head"><span>${E(r.skill)}</span><span class="xp-gain">+${nf(r.gained)} xp</span></div><div class="xp-bar"${g?' title="To the goal level '+g.goal+'. Each mark is a level."':''}><i style="width:${Math.round(v.progress*100)}%"></i>${g?g.marks.map(m=>'<u style="left:'+m+'%"></u>').join(''):''}<span>${r.level} → ${g?g.goal:r.next} · ${Math.round(v.progress*100)}%</span></div><div class="xp-meta"><span>${nf(r.rate)} XP/hr</span><span>${v.ttl!=null?'TTL '+dur(v.ttl):nf(v.left)+' xp to level'}</span></div></div></div>`;}).join(''):'<div class="xp-box"><span class="xp-muted">'+(window.atlasOperator()?'No XP gained since tracking started.':'No XP gained since you opened the page.')+'</span></div>');
  }
  // Hiscore plugin (RuneLite's layout): any fleet account's levels per skill with rank and XP on hover.
  // hiscoreSel: the watched account when a name was looked up or typed. A new watched account takes the tab back.
  let hiscoreName='',hiscoreSel=null;
  function hiscoreResults(name){
    const b=S.bots.find(x=>x.name.toLowerCase()===name.toLowerCase());
    const rank=(board)=>b?.ranks?.find(r=>r.board===board);
    const cell=(skill,label,levelText,title)=>`<div class="hs-cell" title="${E(title)}"><img src="${asset('skill-'+skillFile(skill)+'.png')}" alt="${E(label)}"><span>${levelText}</span></div>`;
    const grid=b?skills.filter(n=>reported(b,n)).map(n=>{const k=b.skills?.find(x=>x.name===n),r=rank(n);return cell(n,n,k?String(k.level):'--',n+(k?'\nLevel: '+k.level+(k.xp!=null?'\nExperience: '+nf(k.xp):''):' is not reported')+(r?'\nRank: '+nf(r.rank)+(r.delta?(r.delta>0?', up ':', down ')+nf(Math.abs(r.delta))+(r.since?' in '+age(r.since):''):''):''));}).join(''):'';
    const overall=b?.ranks?.find(r=>r.board==='Overall');const total=b?.skills?.filter(realSkill).reduce((n,k)=>n+k.level,0);
    const extra=(b?.ranks||[]).filter(r=>['Quest Points','Equipment','Bank','Runite'].includes(r.board)).map(r=>`<div class="hs-row"><span>${E(r.board)}</span><span>Rank ${nf(r.rank)}</span><span>${E(r.level)}${r.board==='Quest Points'?' QP':''}</span></div>`).join('');
    return b?`<div class="hs-head"><span>${E(safeName(b.name))}</span><span>${overall?'Rank '+nf(overall.rank):''}</span></div><div class="hs-grid">${grid}<div class="hs-cell hs-overall" title="${E('Overall\nTotal level: '+total+(overall?'\nRank: '+nf(overall.rank)+'\nTime: '+overall.time:''))}"><img src="${asset('rl-xp.png')}" alt="Overall"><span>${total??'--'}</span></div></div>${extra?'<div class="hs-extra">'+extra+'</div>':''}`
        :worldLookup&&worldLookup.name.toLowerCase()===name.toLowerCase()?lookupCard(worldLookup):'<p class="xp-muted">'+(name?'Press Enter to look up '+E(name)+'.':'Type a player name.')+'</p>';
  }
  function refreshHiscoreAccount(){
    const panel=body.querySelector('.hs-wrap');
    if(!panel)return;
    const input=panel.querySelector('#hs-name');
    if(hiscoreName&&sel!==hiscoreSel&&input!==document.activeElement)hiscoreName='';
    const name=hiscoreName||sel||'';
    if(input!==document.activeElement&&input.value!==name)input.value=name;
    put(panel.querySelector('#hs-names'),S.bots.filter(b=>!b.practice).map(b=>`<option value="${E(b.name)}"></option>`).join('')+(S.roster||[]).slice(0,400).map(r=>`<option value="${E(r[0])}"></option>`).join(''));
    put(panel.querySelector('.hs-results'),hiscoreResults(name));
  }
  // Hiscores: Fleet shows the fleet's best rank per board, Rivals a board's top 10, Player any one player's levels and ranks.
  let hiscoresMode='fleet';
  function boardSummary(){
    const rows=(S?.boards||[]).filter(x=>x.best?.rank);if(!rows.length)return '';
    const best=[...rows].sort((a,b)=>a.best.rank-b.best.rank)[0],close=rows.filter(x=>x.gap&&!x.gap.ahead).sort((a,b)=>(b.gap.close||0)-(a.gap.close||0))[0],climb=[...rows].sort((a,b)=>(b.best.delta||0)-(a.best.delta||0))[0],first=rows.filter(x=>x.best.rank===1).length;
    const tile=(label,main,note)=>'<div class="op-kpi"><small>'+E(label)+'</small><b>'+main+'</b><span>'+E(note)+'</span></div>';
    return '<div class="op-kpis hs-summary">'+tile('Boards at #1',first+'<i> / '+S.boards.length+'</i>',first?'held by the fleet':'')+tile('Best rank','#'+best.best.rank.toLocaleString(),best.board+' · '+safeName(best.best.name))+(close?tile('Closest to #1',Math.round((close.gap.close||0)*100)+'%',close.board+' · '+close.gap.text):'')+(climb?.best.delta>0?tile('Biggest climb','▲'+climb.best.delta.toLocaleString(),climb.board+' · '+safeName(climb.best.name)):'')+'</div>';
  }
  function hiscores(){
    for(const el of [boards])parked.append(el);body.replaceChildren();
    const head=document.createElement('div');head.className='op-filter hs-mode';head.innerHTML=[['fleet','Fleet'],['rivals','Rivals'],['account','Player']].map(([m,l])=>`<button data-hs-mode="${m}" class="${hiscoresMode===m?'active':''}">${l}</button>`).join('');body.append(head);
    if(hiscoresMode==='fleet'){boards.hidden=false;const p=document.createElement('div');p.className='progress-head';p.innerHTML=boardSummary()+progressPanel();body.append(p,boards);if(S)boardGrid();}
    else if(hiscoresMode==='rivals'){const w=document.createElement('div');w.className='rivals-wrap';w.innerHTML=rivalsPanel();body.append(w);}
    else{const w=document.createElement('div');w.className='hs-wrap';w.innerHTML='<div class="hs-panel"><form class="hs-search" id="hs-form"><input id="hs-name" list="hs-names" maxlength="12" placeholder="Find a player…" aria-label="Player name"><datalist id="hs-names"></datalist></form><div class="hs-results"></div></div>';body.append(w);refreshHiscoreAccount();}
  }
  // Where a tile is, in words: the nearest named place within 64 tiles.
  const placeOf=(x,z)=>{if(x==null)return '';let best=null,bd=64*64;for(const [n,px,pz] of (typeof PLACES!=='undefined'?PLACES:[])){const d=(px-x)**2+(pz-z)**2;if(d<bd){bd=d;best=n;}}return best?'near '+best:x+', '+z;};
  // Board time: the demo hiscores normalise ticks to 400 ms.
  const boardTime=t=>{const s=Math.round(t*0.4);return s>=3600?Math.floor(s/3600)+'h '+Math.floor(s%3600/60)+'m':Math.floor(s/60)+'m '+s%60+'s';};
  // Rivals (Hiscores): each board's top 10 from the demo hiscores, who is ours, who is online now and where.
  let rivalBoard='Overall';
  function rivalsPanel(){
    const list=S.rivals||[];if(!list.length)return '<div class="xp-box"><span class="xp-muted">The board tops are not loaded yet. The server reads each board every 15 minutes.</span></div>';
    const b=list.find(x=>x.board===rivalBoard)||list[0];rivalBoard=b.board;
    return `<div class="xp-panel"><select id="rival-board" class="rl-search" aria-label="Board">${list.map(x=>`<option ${x.board===b.board?'selected':''}>${E(x.board)}</option>`).join('')}</select>`+
      `<div class="xp-box"><div class="xp-head"><span>${E(b.board)}</span><span class="xp-gain">read ${age(b.at)} ago</span></div><div class="xp-stats"><span>Our best <b>${b.ours?'#'+nf(b.ours.rank)+' '+E(safeName(b.ours.name)):'not ranked'}</b></span><span>Online now <b>${b.rows.filter(r=>r.online&&!r.fleet).length} of ${b.rows.filter(r=>!r.fleet).length}</b></span></div></div>`+
      overtakeBox(b.board)+'<div class="rival-row rival-head"><span>Rank</span><span>Player</span><span>Lvl</span><span>Time</span><span>Where</span></div>'+
      b.rows.map(r=>`<button class="rival-row${r.fleet?' rival-ours':''}" data-lookup="${E(r.name)}" title="${E(r.name)}: level ${r.level} in ${boardTime(r.ticks)}${r.online?', online '+whereIs(r.x,r.z):', offline'}${r.fleet?' · our account':''}"><span>#${nf(r.rank)}</span><span>${E(safeName(r.name))}</span><span>${r.level}</span><span>${boardTime(r.ticks)}</span><span class="rival-where${r.online?' on':''}">${r.online?E(whereIs(r.x,r.z).replace(/^near /,'')||'online'):''}</span></button>`).join('')+'</div>';
  }
  // Overtake planner: the fleet's best account on the board, and what it needs to pass the next rows of the top 10.
  const hoursText=h=>h==null?null:h<1?Math.max(1,Math.round(h*60))+' min':h<48?h.toFixed(1)+' h':Math.round(h/24)+' days';
  function overtakeBox(board){
    if(!window.atlasOperator())return '';const o=(S.overtake||[]).find(x=>x.board===board);if(!o)return board==='Overall'||board==='Quest Points'?'':'<div class="xp-box"><span class="xp-muted">No fleet account is ranked on this board.</span></div>';
    const line=t=>t.newAccount?`<div class="ot-row"><span>Pass #${t.rank} ${E(t.name)} (99 in ${boardTime(t.seconds/0.4)})</span><span>${o.level>=99?'board time stops at 99':'our board time is already past theirs'}: a new account must reach 99 in under ${boardTime(t.seconds/0.4)}</span></div>`
      :`<div class="ot-row"><span>Pass #${t.rank} ${E(t.name)} (level ${t.level})</span><span>level ${t.goal}${t.deadline!=null?' within '+boardTime(t.deadline/0.4)+' more board time':''}: ${t.xpNeeded==null?'XP not reported':nf(t.xpNeeded)+' XP'}${t.hours!=null?' · about '+hoursText(t.hours)+' at '+nf(Math.round(o.xpPerHour))+' XP/hr':t.xpNeeded!=null?' · not training this skill now':''}</span></div>`;
    return `<div class="xp-box"><div class="xp-head"><span>Overtake · ${E(safeName(o.account))}</span><span class="xp-gain">#${nf(o.rank)} · level ${o.level}</span></div>${o.targets.length?o.targets.map(line).join(''):'<span class="xp-muted">Already #1 on this board.</span>'}</div>`;
  }
  let worldLookup=null,worldLookupRequest=0;
  // Info (RuneLite info): what this page is, how fresh each part is, the keys, the marks as they look, the sources.
  const infoRow=(label,value,raw)=>`<div class="info-row"><span>${raw?label:E(label)}</span><span>${value}</span></div>`;
  function infoData(){
    const sides=S.fleetSides?.sides||[],hosted=S.hosted?.kind==='public';
    return infoRow('Game view','every player, live')+
      infoRow('Accounts',(hosted?'new every 10 minutes':'live')+(sides.length&&window.atlasOperator()?' · '+sides.length+' machines':''))+
      infoRow('Hiscores','new every 5 to 15 minutes');
  }
  window.atlasWallKeys=()=>{showPlugin('info');body.querySelector('.info-wall')?.scrollIntoView({block:'nearest'});};
  // One home per fact: the first box says what the page is and how fresh each part is, each key and each mark has
  // one row, and Sources names each origin with its licence. ATTRIBUTION.txt lists every file.
  function infoPanel(){
    // keys: keyboard keys. ptr: what a mouse or a finger does. A screen with no keyboard pointer (hover: none) shows the
    // ptr parts only, and no row that has keys alone.
    const keys=(...k)=>k.map(x=>'<kbd class="k">'+E(x)+'</kbd>').join(' '),ptr=(...k)=>k.map(x=>'<kbd class="p">'+E(x)+'</kbd>').join(' '),owner=window.atlasOperator();
    const link=(href,text)=>'<a href="'+href+'" target="_blank" rel="noopener">'+text+'</a>';
    return '<div class="xp-panel"><div class="xp-box"><div class="xp-head"><span>RuneLite — Swarm</span></div><p class="xp-muted">Our bot team on the rs-sdk demo world, a 2004 RuneScape server. Not the RuneLite client. Not affiliated with Jagex or RuneLite.</p><div class="info-data">'+infoData()+'</div></div>'+
      (owner?'':'<div class="xp-box"><div class="xp-head"><span>Controls</span></div>'+infoRow(keys('[',']'),'previous or next account',true)+infoRow(keys('W','A','S','D'),'fly free',true)+infoRow(ptr('Drag'),'turn the camera',true)+infoRow(ptr('Wheel','Pinch'),'zoom',true)+infoRow(ptr('Wheel on the minimap'),'zoom the minimap',true)+infoRow(keys('Ctrl','K'),'find anything',true)+'</div>')+
      '<div class="xp-box info-wall"><div class="xp-head"><span>Fleet wall</span></div>'+infoRow(keys('\\'),'our accounts side by side',true)+infoRow(keys('←','↑','↓','→')+' '+keys('H','J','K','L'),'move the focus',true)+infoRow(keys('1')+'<span class="k"> – </span>'+keys('9')+' '+ptr('Click'),'focus that view',true)+infoRow(keys('Shift','Arrow')+' '+ptr('Drag a title'),'swap two views',true)+infoRow(keys('P')+' '+ptr('Pin'),'keep a view in its place',true)+infoRow(ptr('Drag a gap'),'size the views',true)+infoRow(keys('Enter'),'make it the main view, then follow it',true)+infoRow(ptr('Double click'),'follow that account',true)+infoRow(keys('Space'),'next layout',true)+infoRow(keys('F'),'focus layout',true)+infoRow(keys('Esc'),'leave the wall',true)+'</div>'+
      '<div class="xp-box"><div class="xp-head"><span>Marks</span></div>'+
      infoRow('Ours','<b class="mark-name">Name</b> <i class="mark-dot on"></i> playing <i class="mark-dot"></i> not playing')+infoRow('Others','<i class="mark-dot other"></i> player <i class="mark-dot rival"></i> ranked rival <i class="mark-dot farm"></i> bot farm')+(owner?infoRow('⟦MAIN⟧ / Hidden','an account this page does not show')+infoRow('~ before a rank','the last rank we read; it can be old'):'')+'</div>'+
      '<div class="xp-box info-sources"><div class="xp-head"><span>Sources</span></div>'+
      infoRow('Client look, icons',link('https://github.com/runelite/runelite','RuneLite')+' · '+link(asset('RUNELITE-FULL-LICENSE.txt'),'BSD 2-Clause'))+
      infoRow('3D view, fonts, world map icon',link('https://github.com/MaxBittker/rs-world','rs-world')+' · '+link(asset('RS-WORLD-LICENSE.txt'),'BSD 2-Clause'))+
      infoRow('Items, NPCs, sprites, minimap frame',link('https://github.com/MaxBittker/rs-sdk','rs-sdk')+', Lost City content · MIT')+
      infoRow('Tab, orb, prayer, spell icons',link('https://oldschool.runescape.wiki','OSRS Wiki'))+
      infoRow('Players, hiscores, prices',link('https://rs-sdk-demo.fly.dev','rs-sdk demo server'))+
      infoRow('Game art','© Jagex')+
      infoRow('Every file',link(asset('ATTRIBUTION.txt'),'ATTRIBUTION.txt'))+'</div></div>';
  }
  // World plugin: how many players are online, how crowded the spots our bots use are, and the bot farms online.
  // A spectator gets one row per tile: several machines can use one tile, and which machine is the owner's detail.
  function worldSpots(){
    const spots=(S.contention||[]).filter(s=>s.x!=null).map(s=>({...s,label:spotName(s)}));
    if(window.atlasOperator())return spots;
    // Tiles a few steps apart share a name and most of their players, so one name is one row.
    const byName=new Map();
    for(const s of spots){const p=byName.get(s.label);if(!p)byName.set(s.label,{...s,others:[...s.others],ours:[...s.ours]});else{p.others=[...new Set([...p.others,...s.others])].sort();p.ours=[...new Set([...p.ours,...s.ours])].sort();}}
    return [...byName.values()].sort((a,b)=>b.others.length-a.others.length);
  }
  // The nearest named place within 128 tiles of a tile, with the side the tile is on when it is more than 48 tiles
  // away ("west of Ardougne"). Empty when no place is that near: a reader gets no bare coordinates.
  function placeNear(x,z){
    let best=null,bd=128*128;
    for(const [n,px,pz] of (typeof PLACES!=='undefined'?PLACES:[])){const d=(px-x)**2+(pz-z)**2;if(d<bd){bd=d;best=[n,x-px,z-pz];}}
    if(!best)return '';
    const [n,dx,dz]=best;
    return (bd>48*48?(Math.abs(dx)>Math.abs(dz)?(dx<0?'west of ':'east of '):(dz<0?'south of ':'north of ')):'')+n;
  }
  window.atlasPlaceNear=placeNear;
  // Where an online player is, in words: "near Varrock", "west of Ardougne", "under Edgeville" for a tile on the
  // dungeon plane (z of 6400 or more), or "underground". Empty when no place is near.
  function whereIs(x,z){
    const p=placeNear(x,z),side=/^(north|south|east|west) of /;
    if(p)return side.test(p)?p:'near '+p;
    if(z>=6400){const u=placeNear(x,z-6400);return u?'under '+u.replace(side,''):'underground';}
    return '';
  }
  // A spot's name: what the bots do there and where.
  function spotName(s){
    const kind=s.kind.replace(/^./,c=>c.toUpperCase()),place=placeNear(s.x,s.z);
    return place?kind+' · '+place:kind+' spot';
  }
  const nameButtons=(names,max)=>names.slice(0,max).map(n=>`<button data-lookup="${E(n)}">${E(n)}</button>`).join('')+(names.length>max?`<span class="xp-muted">+${names.length-max} more</span>`:'');
  // Highlights in the 3D view (RuneLite's Player Indicators, NPC Indicators, Ground Items, Multi-Lines, Ground Markers
  // and the Mining pies). The page builds one {overlay} message for the viewer's markers layer (rs-world Markers.ts)
  // and sends it when it changes, and every 10 s for a viewer that loaded again. The World plugin's Highlights box
  // switches each part; the choice stays in this browser.
  //   players  red: can attack the watched account now (PvP Tools); cyan: a rival from the hiscore rivals
  //   npcs     cyan: the npc types the watched account fought last
  //   ground   floor item labels with their GE value, hidden below the chosen value
  //   lines    red: multi-combat edges (client-assets/multiway.json); yellow: Wilderness levels 1, 10, 20, 30, 40, 50
  //   tiles    red: the death tile of the open recap; pies: the respawn timers
  //   marks    the Ground markers that the viewer placed; fails: orange, where an account's last run failed
  //   finder   pink: the spawns of the NPC that the NPC finder shows
  const HL_KEY='atlas-highlights',HL_DEFAULT={players:true,npcs:true,ground:true,groundMin:1000,multi:true,tiles:true,skilling:true,trail:true,marks:true,fails:true,icons:true,items:true,invTags:true,idle:true,busy:true,itemIds:true};
  const hl=(()=>{try{return {...HL_DEFAULT,...JSON.parse(localStorage.getItem(HL_KEY)||'{}')};}catch{return {...HL_DEFAULT};}})();
  const saveHl=()=>{try{localStorage.setItem(HL_KEY,JSON.stringify(hl));}catch{/* private window */}};
  // recentTargets belong to one watched account (targetsFor); another account starts an empty list.
  let multiLines=null,recentTargets=[],targetsFor=null,sentOverlay='',sentOverlayAt=0;
  // The part of a level or upright line inside the square of half-side r around (cx, cz), or null: a long line keeps
  // its part near the camera, so its middle is near too (the viewer and the minimap skip a line by its middle).
  const clipLine=(x0,z0,x1,z1,cx,cz,r)=>{const lx=Math.round(cx-r),hx=Math.round(cx+r),lz=Math.round(cz-r),hz=Math.round(cz+r);if(z0===z1){if(z0<lz||z0>hz)return null;const a=Math.max(Math.min(x0,x1),lx),b=Math.min(Math.max(x0,x1),hx);return a<b?[a,z0,b,z1]:null;}if(x0===x1){if(x0<lx||x0>hx)return null;const a=Math.max(Math.min(z0,z1),lz),b=Math.min(Math.max(z0,z1),hz);return a<b?[x0,a,x1,b]:null;}return null;};
  fetch(asset('multiway.json')).then(r=>r.ok?r.json():null).then(j=>{if(Array.isArray(j))multiLines=j;},()=>{});
  // Skilling highlights (RuneLite's Woodcutting, Mining and Fishing plugins): the resource that the watched account works
  // is outlined in cyan within 15 tiles of it. Which resource: its top loot item (Yew logs: Yew tree; Iron ore: Iron
  // rock), else every tree or rock for a woodcutting or mining goal. A fishing goal marks the fishing spots
  // (npc-names.json lists npc names by type).
  let fishingTypes=[];
  fetch(asset('npc-names.json')).then(r=>r.ok?r.json():null).then(j=>{if(Array.isArray(j))fishingTypes=j.flatMap((v,i)=>v&&/^fishing spot$/i.test(Array.isArray(v)?v[0]:v)?[i]:[]).slice(0,200);},()=>{});
  // Agility obstacles (RuneLite's Agility plugin): for an agility goal or role, the course obstacles and agility
  // shortcuts within 15 tiles are outlined in green with the game's menu option (client-assets/agility.json).
  let agilityTiles=null;
  // An obstacle that can fail carries [low, high] (gen-world-points.ts, from its handler's stat_random(agility, low,
  // high)); the label adds the fail chance at the account's current Agility level: 1 - (floor(low*(99-L)/98) +
  // floor(high*(L-1)/98) + 1) / 256, none when the roll always passes.
  function agilityLabel(label,roll,b){if(!roll)return label;const L=typeof curLevel==='function'?curLevel(b,'Agility'):null;if(!Number.isFinite(L))return label;
    const l=Math.min(L,99),pass=Math.min(Math.floor(roll[0]*(99-l)/98)+Math.floor(roll[1]*(l-1)/98)+1,256)/256,fail=Math.round((1-pass)*100);return fail>0?label+' · '+fail+'% fail':label;}
  fetch(asset('agility.json')).then(r=>r.ok?r.json():null).then(j=>{if(Array.isArray(j))agilityTiles=j;},()=>{});
  const agilityFor=b=>String(b?.goalSkill||'').toLowerCase()==='agility'||String(b?.role||'').toLowerCase()==='agility';
  // Ground markers (RuneLite's Ground Markers): tiles that the viewer marks with shift+click on the minimap or with the
  // World plugin's button, in the chosen colour, kept in this browser (the newest 200).
  const MARK_KEY='atlas-ground-marks',MARK_COLOURS=[['#ffff00','Yellow'],['#00ff00','Green'],['#00ffff','Cyan'],['#ff0000','Red'],['#ff00ff','Magenta']];
  let marks=(()=>{try{const j=JSON.parse(localStorage.getItem(MARK_KEY)||'[]');return Array.isArray(j)?j.filter(m=>Number.isInteger(m?.x)&&Number.isInteger(m?.z)):[];}catch{return [];}})(),markColour=MARK_COLOURS[0][0];
  const saveMarks=()=>{try{localStorage.setItem(MARK_KEY,JSON.stringify(marks));}catch{/* private window */}};
  function toggleMark(x,z,l){const i=marks.findIndex(m=>m.x===x&&m.z===z&&(m.l||0)===l);if(i>=0)marks.splice(i,1);else{marks.push({x,z,l,c:markColour});if(marks.length>200)marks.shift();}saveMarks();marksChanged();return i<0;}
  function marksChanged(){overlaySync(true);if(typeof minimap==='function')minimap();if(typeof selectedPlugin!=='undefined'&&selectedPlugin==='world')refreshWorld();}
  // Failure markers: each of our accounts whose last run failed in the last 24 hours and that is not in the world now,
  // at the place of its last status, with a short reason. Accounts that failed on one tile share one marker.
  //   "TickStallError: tick stream stalled: ..."                     -> "tick stream stalled"
  //   "fleet-trade 17..-a-b-bones reconcile 0/94: Error: transfer ..." -> "fleet-trade: transfer ..."
  //   "mode=giant ok=false creditedKills=16 ..." or {"ok":false,...}    -> "giant: run ended, not ok", "target not met"
  //   "travel to Ardougne failed: timeout ...: tick stream stalled"    -> "travel to Ardougne failed · tick stream stalled"
  function failReason(text){
    const t=String(text||'').replace(/^fail(ed)?\s*/i,'').trim(),cut=x=>x.trim().slice(0,60)||'failed';
    const err=t.match(/(\w*Error):\s*([^:]+)/);
    if(err){const head=t.split(/[\s:]/)[0];return cut((head&&head!==err[1]&&!/[{=]/.test(head)?head+': ':'')+err[2]);}
    if(/^[{[]|^\w+=/.test(t)){const why=t.match(/"?(?:reason|error|stop)"?\s*[=:]\s*"?([^",}\s]+)/);if(why)return cut(why[1]);if(/"?targetMet"?\s*[=:]\s*false/.test(t))return 'target not met';const mode=t.match(/mode=(\w+)/);return (mode?mode[1]+': ':'')+'run ended, not ok';}
    const first=t.split(/: /)[0];return cut(first+(/tick stream stalled/.test(t)&&!/tick stream stalled/.test(first)?' · tick stream stalled':''));
  }
  // One row a tile: the accounts, and the reason most of them share.
  function failSpots(){const by=new Map();for(const r of failRows()){const k=r.x+','+r.z+','+r.l,g=by.get(k)||{x:r.x,z:r.z,l:r.l,names:[],reasons:new Map()};g.names.push(r.name);g.reasons.set(r.reason,(g.reasons.get(r.reason)||0)+1);by.set(k,g);}
    return [...by.values()].map(g=>{const reason=[...g.reasons].sort((a,b)=>b[1]-a[1])[0][0];return {...g,reason,label:(g.names.length>1?g.names.length+' accounts':safeName(g.names[0]))+': '+reason};});}
  const failRows=()=>(S?.bots||[]).filter(x=>!x.practice&&!x.inWorld&&x.lastRes&&x.lastRes.ok===false&&!x.lastRes.died&&x.pos&&Number.isInteger(x.pos.x)&&Date.now()-x.lastRes.at<86_400_000).map(x=>({name:x.name,x:x.pos.x,z:x.pos.z,l:x.pos.level||0,reason:failReason(x.lastRes.text),text:String(x.lastRes.text||''),at:x.lastRes.at}));
  // NPC finder: type an NPC name in the World plugin; its spawns show in pink on the minimap and in the 3D view
  // (client-assets/npc-spawns.json: every NPC of the pinned server by name, with its combat levels and spawn tiles).
  let npcSpawns=null,finderQuery='',finderPick=null;
  const loadSpawns=()=>{if(npcSpawns===null){npcSpawns=[];fetch(asset('npc-spawns.json')).then(r=>r.ok?r.json():[]).then(j=>{if(Array.isArray(j)){npcSpawns=j;if(typeof selectedPlugin!=='undefined'&&selectedPlugin==='world')finderResults();}},()=>{});}};
  const spawnTiles=row=>{const t=[];for(let i=0;i+2<(row?.[3]?.length||0);i+=3)t.push({x:row[3][i],z:row[3][i+1],l:row[3][i+2]});return t;};
  const finderRow=()=>finderPick&&npcSpawns?npcSpawns.find(r=>r[0]===finderPick)||null:null;
  // Player finder: an online player of the roster ([name, x, z, level, combat]) by name; the pin follows each snapshot.
  // A name the page hides (safeName changes it) is never offered.
  let finderPlayer=null;
  const playerRow=()=>finderPlayer?(S?.roster||[]).find(r=>String(r[0]).toLowerCase()===finderPlayer)||null:null;
  function playerMatches(q){q=q.trim().toLowerCase();if(q.length<2)return [];return (S?.roster||[]).filter(r=>{const n=String(r[0]);return n.toLowerCase().includes(q)&&safeName(n)===n;}).sort((a,b)=>(String(b[0]).toLowerCase().startsWith(q)-String(a[0]).toLowerCase().startsWith(q))||String(a[0]).localeCompare(String(b[0]))).slice(0,5);}
  function finderMatches(q){q=q.trim().toLowerCase();if(q.length<2||!npcSpawns)return [];return npcSpawns.filter(r=>r[0].toLowerCase().includes(q)).sort((a,b)=>(b[0].toLowerCase().startsWith(q)-a[0].toLowerCase().startsWith(q))||b[3].length-a[3].length).slice(0,8);}
  // World Map icons (RuneLite's World Map plugin) on the minimap: teleport destinations (blue), fixed-spot transports
  // such as levers, portals and spirit trees (cyan) and agility shortcuts with
  // their level (green), from client-assets/map-icons.json; the pointer names each one, and each shop keeper.
  let mapIcons=null;
  fetch(asset('map-icons.json')).then(r=>r.ok?r.json():null).then(j=>{if(Array.isArray(j))mapIcons=j;},()=>{});
  // Item sources (Grand Exchange plugin): a route item's shops, drops, skills and floor spawns from
  // client-assets/item-sources.json. "Show on map" pins a source's tiles in pink, as the NPC finder does.
  let itemSourcesData=null,sourcePin=null;
  const loadItemSources=()=>{if(itemSourcesData===null){itemSourcesData={};fetch(asset('item-sources.json')).then(r=>r.ok?r.json():{}).then(j=>{itemSourcesData=j||{};if(typeof refreshGe==='function')refreshGe();},()=>{});}};
  // The teleport (cast from anywhere) whose destination is closest to any of these tiles (map-icons.json, kind t), for
  // the finder and the item sources; none farther than 80 tiles, where it would not save the walk.
  function nearestTeleport(tiles){let best=null;for(const t of tiles||[])for(const [x,z,l,k,label] of mapIcons||[]){if(k!=='t'||l!==(t.l||0)||(z>6400)!==(t.z>6400))continue;const d=Math.max(Math.abs(x-t.x),Math.abs(z-t.z));if(d<=80&&(!best||d<best.d))best={label,d};}return best;}
  const teleText=tiles=>{const t=nearestTeleport(tiles);return t?'Closest teleport: '+t.label+', '+t.d+' tiles':'';};
  const geTele=flat=>{const t=flat?.length?nearestTeleport(flatTiles(flat)):null;return t?' <small class="ge-tele" title="'+E('Closest teleport: '+t.label+', '+t.d+' tiles')+'">· '+E(t.label)+', '+t.d+' tiles</small>':'';};
  // Map icons by requirement (RuneLite's World Map shortcut colours): with the watched account's levels, a shortcut it
  // cannot use is red and a teleport spell it cannot cast is dark blue; true, false, or null with no level known. The game
  // checks the current level (stat(), boosts count: knowledge/teleports.json), so currentLevel, else the base level.
  const iconCan=(b,req)=>{if(!req||!b?.skills)return null;const s=b.skills.find(x=>String(x.name).toLowerCase()===String(req[0]).toLowerCase()),lv=Number.isFinite(s?.currentLevel)?s.currentLevel:s?.level;return Number.isFinite(lv)?lv>=req[1]:null;};
  const flatTiles=a=>{const t=[];for(let i=0;i+2<(a?.length||0);i+=3)t.push({x:a[i],z:a[i+1],l:a[i+2]});return t;};
  // What the pink layer shows: the NPC finder's pick, else the pinned item source.
  function pinned(){const pl=typeof playerRow==='function'?playerRow():null;if(pl)return {label:String(pl[0])+(Number.isFinite(pl[4])?' ('+pl[4]+')':''),tip:String(pl[0])+(Number.isFinite(pl[4])?' (combat '+pl[4]+')':''),tiles:[{x:pl[1],z:pl[2],l:pl[3]||0}]};const r=typeof finderRow==='function'?finderRow():null;if(r)return {label:r[0]+(r[2]?' ('+r[2]+')':''),tip:r[0]+' ('+combatText(r)+')',tiles:spawnTiles(r)};return sourcePin;}
  const combatText=r=>r[1]===r[2]?(r[1]?'level '+r[1]:'no combat'):'level '+r[1]+'–'+r[2];
  const resourceOf=item=>/ logs$/i.test(item)?item.replace(/ logs$/i,'').replace(/ tree$/i,'')+' tree':/ ore$/i.test(item)?item.replace(/ ore$/i,'')+' rock':/^(coal|clay|limestone)$/i.test(item)?item+' rock':null;
  const topLoot=b=>(b?.flow?.loot||[]).slice().sort((x,y)=>y.count-x.count)[0]||null;
  // Position trail: the last 60 places of each of our accounts, from the live roster and the status files. The watched
  // account's trail is a line on the ground (yellow for its last 20 steps); every trail shows on the minimap.
  const trails=new Map();
  // Idle markers (RuneLite's Idle Notifier, for every account): an account in the world that stays on one tile with an
  // idle last action for 3 minutes or more gets a yellow label in 3D and a yellow ring on the minimap.
  const idleSince=new Map();
  const idleRows=()=>(S?.bots||[]).filter(x=>x.inWorld&&!x.practice&&idleSince.has(x.name)&&Date.now()-idleSince.get(x.name).at>=180_000).map(x=>{const i=idleSince.get(x.name);return {name:x.name,x:i.x,z:i.z,l:i.l,ms:Date.now()-i.at};});
  function trackTrails(){
    for(const x of S?.bots||[]){
      const p=x.live||x.pos;if(!x.inWorld||!p||!Number.isInteger(p.x)||!Number.isInteger(p.z)){idleSince.delete(x.name);continue;}
      {const i=idleSince.get(x.name);if(x.action!=='idle')idleSince.delete(x.name);else if(!i||i.x!==p.x||i.z!==p.z||i.l!==(p.level||0))idleSince.set(x.name,{x:p.x,z:p.z,l:p.level||0,at:Date.now()});}
      const t=trails.get(x.name)||[],last=t[t.length-1];
      if(last&&last.x===p.x&&last.z===p.z)continue;
      if(last&&(Math.abs(last.x-p.x)>40||Math.abs(last.z-p.z)>40||last.l!==(p.level||0)))t.length=0;
      t.push({x:p.x,z:p.z,l:p.level||0});if(t.length>60)t.shift();trails.set(x.name,t);
    }
  }
  function overlayMessage(){
    const b=account(),o={tiles:[],pies:[],lines:[],players:{},npcs:[]};
    const at=window.atlasCam3d||b?.live||b?.pos||null,near=(x,z,d)=>!!at&&Math.abs(x-at.x)<=d&&Math.abs(z-at.z)<=d;
    if(hl.players){
      for(const r of S?.rivals||[])for(const x of r.rows||[]){const n=String(x.name||'').toLowerCase();if(!x.fleet&&/^[a-z0-9_ -]{1,12}$/.test(n))o.players[n]='#00ffff';}
      const p=b&&b.inWorld&&b.pos&&wildLevel(b.pos)?pvpState(b):null;
      for(const t of p?.threats||[]){const n=String(t.name).toLowerCase();if(/^[a-z0-9_ -]{1,12}$/.test(n))o.players[n]='#ff0000';}
    }
    if((b?.name??null)!==targetsFor){targetsFor=b?.name??null;recentTargets=[];}
    if(hl.npcs&&recentTargets.length)o.npcs.push({types:recentTargets.slice(),colour:'#00ffff'});
    if(hl.ground)o.ground={prices:S?.economy?.itemValues||{},min:hl.groundMin};
    if(hl.multi&&at){
      for(const [x0,z0,x1,z1,l] of multiLines||[]){const c=clipLine(x0,z0,x1,z1,at.x,at.z,60);if(c)o.lines.push({x0:c[0],z0:c[1],x1:c[2],z1:c[3],l,colour:'#ff0000'});}
      for(const lv of [1,10,20,30,40,50]){const z=3520+8*(lv-1),c=clipLine(2944,z,3392,z,at.x,at.z,60);if(c)o.lines.push({x0:c[0],z0:c[1],x1:c[2],z1:c[3],l:0,colour:'#ffff00',label:'Level '+lv});}
    }
    if(hl.skilling&&b?.inWorld&&b.pos&&typeof resources!=='undefined'&&resources){
      const want=resourceOf(topLoot(b)?.name||''),skill=String(b.goalSkill||'').toLowerCase(),kinds=resources.kinds||{};
      const fits=id=>{const n=kinds[id]?.name||'';return want?n.toLowerCase()===want.toLowerCase():skill==='woodcutting'?/ tree$/.test(n):skill==='mining'?/ rock$/.test(n):false;};
      for(const [x,z,l,id] of resources.tiles)if(l===(b.pos.level||0)&&Math.abs(x-b.pos.x)<=15&&Math.abs(z-b.pos.z)<=15&&fits(id))o.tiles.push({x,z,l,colour:'#00ffff'});
      if(skill==='fishing'&&fishingTypes.length)o.npcs.push({types:fishingTypes,colour:'#00ffff'});
    }
    if(hl.skilling&&b?.inWorld&&b.pos&&agilityTiles&&agilityFor(b))for(const [x,z,l,label,roll] of agilityTiles)if(l===(b.pos.level||0)&&Math.abs(x-b.pos.x)<=15&&Math.abs(z-b.pos.z)<=15)o.tiles.push({x,z,l,colour:'#00ff00',label:agilityLabel(label,roll,b)});
    if(hl.trail&&b){const t=trails.get(b.name)||[];for(let i=1;i<t.length;i++)if(t[i].l===t[i-1].l)o.lines.push({x0:t[i-1].x,z0:t[i-1].z,x1:t[i].x,z1:t[i].z,l:t[i].l,colour:t.length-i<=20?'#ffff00':'#9a9a00'});}
    if(hl.tiles){
      if(typeof recap!=='undefined'&&recap.state==='ok'&&recap.data?.pos&&b&&recap.name===b.name)o.tiles.push({x:recap.data.pos.x,z:recap.data.pos.z,l:recap.data.pos.level||0,colour:'#ff0000',fill:true,label:'Death'});
      for(const r of respawnRows())if(r.left!=null&&r.total)o.pies.push({x:r.x,z:r.z,l:r.l,p:Math.max(0,Math.min(1,1-r.left/r.total))});
    }
    if(hl.marks)for(const m of marks)if(near(m.x,m.z,60))o.tiles.push({x:m.x,z:m.z,l:m.l||0,colour:m.c||MARK_COLOURS[0][0]});
    if(hl.idle)for(const r of idleRows())if(near(r.x,r.z,60))o.tiles.push({x:r.x,z:r.z,l:r.l,colour:'#ffff00',label:safeName(r.name)+': idle '+Math.floor(r.ms/60000)+'m'});
    if(hl.fails)for(const f of failSpots())if(near(f.x,f.z,60))o.tiles.push({x:f.x,z:f.z,l:f.l,colour:'#ff9900',fill:true,label:f.label});
    {const pin=pinned();if(pin){let n=0;for(const t of pin.tiles)if(near(t.x,t.z,60)&&n++<40)o.tiles.push({x:t.x,z:t.z,l:t.l,colour:'#ff66ff',label:pin.label});}}
    return o;
  }
  function overlaySync(force=false){
    if(typeof VIEWER==='undefined'||VIEWER.state!=='ready')return;
    const msg=overlayMessage(),key=JSON.stringify(msg);
    if(!force&&key===sentOverlay&&Date.now()-sentOverlayAt<10_000)return;
    sentOverlay=key;sentOverlayAt=Date.now();$('#rsw')?.contentWindow?.postMessage({overlay:msg},location.origin);
  }
  function highlightsBox(){
    const box=(k,label)=>`<label class="hl-row"><input type="checkbox" data-hl="${k}" ${hl[k]?'checked':''}> ${label}</label>`;
    return `<div class="xp-box"><div class="xp-head"><span>Highlights</span><span class="xp-muted">in the 3D view</span></div><div class="hl-grid">${box('players','Players: red can attack, cyan rivals')}${box('npcs','NPCs the account fought')}${box('ground','Floor item labels')}${box('multi','Multi-combat and Wilderness lines')}${box('tiles','Death tile and respawn pies')}${box('skilling','Trees, rocks, fishing spots and agility obstacles of the account')}${box('trail','Walked path')}${box('marks','Ground markers')}${box('fails','Where runs failed (orange)')}${box('idle','Idle 3+ minutes (yellow)')}${box('icons','Minimap: teleports, shortcuts, shop names')}${box('items','Minimap: floor items (red)')}${box('busy','Minimap: busy areas (5+ players)')}${box('invTags','Inventory tags: food, potions, teleports, runes')}${box('itemIds','Item labels: herbs and potions')}<label class="hl-row">Hide labels below <select data-hl-min>${[0,1000,10000,100000].map(v=>`<option value="${v}" ${hl.groundMin===v?'selected':''}>${v?nf(v)+' gp':'nothing'}</option>`).join('')}</select></label></div></div>`;
  }
  function markersBox(){
    const b=account(),p=b?.live||b?.pos||null,colours=MARK_COLOURS.map(([c,n])=>'<option value="'+c+'" '+(c===markColour?'selected':'')+'>'+n+'</option>').join('');
    const rows=marks.slice(-20).reverse().map(m=>{const i=marks.indexOf(m);return '<div class="mark-row"><span class="mark-swatch" style="background:'+E(m.c||MARK_COLOURS[0][0])+'"></span><button class="xp-reset" data-mark-go="'+i+'" title="Move the camera there (2D)">'+m.x+', '+m.z+(m.l?' · floor '+m.l:'')+'</button><button class="xp-reset" data-mark-del="'+i+'" title="Remove this marker" aria-label="Remove marker">✕</button></div>';}).join('');
    return '<div class="xp-box"><div class="xp-head"><span>Ground markers</span><span class="xp-muted">'+marks.length+' · shift+click the minimap</span></div><div class="xp-buttons"><button class="xp-reset" data-mark-here '+(p?'':'disabled')+'>Mark the account\'s tile</button><select data-mark-colour aria-label="Marker colour">'+colours+'</select>'+(marks.length?'<button class="xp-reset" data-mark-clear>Clear all</button>':'')+'</div>'+(rows?'<div class="mark-list">'+rows+'</div>':'')+'</div>';
  }
  // Pickpocket (RuneLite's Thieving overlay, with the server's roll): client-assets/thieving.json (gen-thieving.ts) has
  // [level, xp, low, high, stun ticks, stun damage] by NPC name. thieving.rs2 passes when floor(low*(99-L)/98) +
  // floor(high*(L-1)/98) + 1 beats a roll of 0-255; L is the current Thieving level of the followed account.
  let thieveData={};fetch(asset('thieving.json')).then(r=>r.ok?r.json():{}).then(j=>{thieveData=j||{};},()=>{});
  function thieveText(name){const t=thieveData[name];if(!t)return '';const [lv,xp,lo,hi,stun,dmg]=t,b=typeof account==='function'?account():null,L=typeof curLevel==='function'?curLevel(b,'Thieving'):null;
    if(!Number.isFinite(L))return 'Pickpocket: Thieving '+lv+' · '+nf(xp)+' XP';if(L<lv)return 'Pickpocket: Thieving '+lv+' needed (has '+L+')';
    const l=Math.min(L,99),p=Math.min(Math.floor(lo*(99-l)/98)+Math.floor(hi*(l-1)/98)+1,256)/256;
    return 'Pickpocket at Thieving '+L+': '+Math.round(p*100)+'% · '+nf(Math.round(p*xp))+' XP a try'+(p<1?' · a fail stuns '+stun+' ticks and hits '+dmg:'');}
  // Melee hit chance (RuneLite's opponent information, with the server's rolls): client-assets/npc-defence.json
  // (gen-npc-defence.ts) has each variant of an NPC name as [combat, defence, magic, stab, slash, crush, magic, range
  // defence]. The account's roll is (current Attack + 8) x (worn attack bonus + 64), with no style bonus as the style is
  // not reported (player_combat_stat.rs2); the NPC's is (defence + 9) x (defence bonus + 64) (npc_combat.rs2). A hit
  // beats the roll, both drawn from 0 up to it: A > D gives 1 - (D + 2) / (2(A + 1)), else A / (2(D + 1)). The best of
  // stab, slash and crush shows; several variants show the range.
  let npcDefData={};if(typeof asset==='function'&&typeof fetch==='function')fetch(asset('npc-defence.json')).then(r=>r.ok?r.json():{}).then(j=>{npcDefData=j||{};},()=>{});
  function meleeHitText(name){const list=npcDefData[name],b=typeof account==='function'?account():null;if(!list?.length||typeof wornBonuses!=='function')return '';const bon=wornBonuses(b),L=typeof curLevel==='function'?curLevel(b,'Attack'):null;if(!bon||!Number.isFinite(L))return '';
    const hit=(A,D)=>A>D?1-(D+2)/(2*(A+1)):A/(2*(D+1)),styles=['stab','slash','crush'];
    const best=list.map(v=>styles.map((st,i)=>({st,p:hit((L+8)*(bon[i]+64),(v[1]+9)*(v[3+i]+64))})).sort((x,y)=>y.p-x.p)[0]);
    const lo=Math.round(Math.min(...best.map(x=>x.p))*100),hi=Math.round(Math.max(...best.map(x=>x.p))*100),st=[...new Set(best.map(x=>x.st))];
    // Ranged and magic, when the worn gear gives that attack bonus: the account's ranged roll (current Ranged + 8) x (range
    // attack + 64) against (defence + 9) x (range defence + 64); its magic roll (current Magic + 9: magic always has a
    // style bonus of 1) x (magic attack + 64) against the NPC's (magic level + 9) x (magic defence + 64).
    const pct=f=>{const p=list.map(f),a=Math.round(Math.min(...p)*100),z=Math.round(Math.max(...p)*100);return a===z?a+'%':a+'–'+z+'%';};
    const R=curLevel(b,'Ranged'),M=curLevel(b,'Magic'),extra=[];
    if(bon[4]>0&&Number.isFinite(R))extra.push('ranged '+pct(v=>hit((R+8)*(bon[4]+64),(v[1]+9)*(v[7]+64))));
    if(bon[3]>0&&Number.isFinite(M))extra.push('magic '+pct(v=>hit((M+9)*(bon[3]+64),(v[2]+9)*(v[6]+64))));
    return 'Melee hit at Attack '+L+': '+(lo===hi?lo+'%':lo+'–'+hi+'%')+' with '+st.join(' or ')+(extra.length?' · '+extra.join(' · '):'');}
  // Its melee against the account (npc_combat_melee.rs2): max hit floor(((strength + 9) x (strength bonus + 64) + 320) /
  // 640), and its attack roll (attack + 9) x (attack bonus + 64) against the account's (current Defence + 8) x (worn
  // defence bonus of the NPC's damage type + 64). An NPC with another damage type (ranged, magic) shows nothing.
  function npcHitsText(name){const list=(npcDefData[name]||[]).filter(v=>v.length>12&&v[12]>=0),b=typeof account==='function'?account():null;if(!list.length||typeof wornBonuses!=='function')return '';
    const bon=wornBonuses(b),D=typeof curLevel==='function'?curLevel(b,'Defence'):null;if(!bon||!Number.isFinite(D))return '';
    const hit=(A,Dr)=>A>Dr?1-(Dr+2)/(2*(A+1)):A/(2*(Dr+1)),span=a=>{const lo=Math.min(...a),hi=Math.max(...a);return lo===hi?String(lo):lo+'–'+hi;};
    const max=list.map(v=>Math.floor(((v[9]+9)*(v[11]+64)+320)/640)),p=list.map(v=>Math.round(hit((v[8]+9)*(v[10]+64),(D+8)*(bon[5+v[12]]+64))*100));
    return 'It hits up to '+span(max)+' · lands '+span(p)+'% on your Defence '+D;}
  // The XP of a kill (combat.rs2 give_combat_experience): each damage point gives 4 XP to a one-style skill and 1.33 to
  // Hitpoints, in tenths times the NPC's multiplier / 1000, and the server's XP rate (25) on top: a kill of H hitpoints is
  // H x 100 x multiplier / 1000 in one style and about H x 33.25 x multiplier / 1000 Hitpoints. The kills to the next
  // Hitpoints level follow, as every style trains it. The respawn time is the respawn rate in ticks of 0.6 s.
  // A name that also has normal variants leaves out its random-event ones (multiplier under 1000: the event Zombies).
  function killXpText(name){let list=(npcDefData[name]||[]).filter(v=>v.length>14&&v[13]>0);if(list.some(v=>v[14]>=1000))list=list.filter(v=>v[14]>=1000);if(!list.length)return '';
    const one=list.map(v=>Math.round(v[13]*100*v[14]/1000)),hp=list.map(v=>v[13]*33.25*v[14]/1000),span=a=>{const lo=Math.min(...a),hi=Math.max(...a);return lo===hi?nf(lo):nf(lo)+'–'+nf(hi);};
    let text='A kill: '+span(one)+' XP in one style + about '+span(hp.map(Math.round))+' Hitpoints';
    const respawn=list.filter(v=>v.length>15&&v[15]>0).map(v=>Math.round(v[15]*0.6));if(respawn.length)text+=' · respawns in '+span(respawn)+' s';
    const b=typeof account==='function'?account():null,s=(b?.skills||[]).find(x=>x.name==='Hitpoints'),X=window.atlasXp;
    if(s?.xp!=null&&X){const lv=X.levelForXp(s.xp);if(lv<99){const left=X.xpForLevel(lv+1)-s.xp,most=Math.max(...hp);if(most>0){const k=Math.ceil(left/most);text+=' · '+nf(k)+(k===1?' kill':' kills')+' to Hitpoints '+(lv+1);}}}
    return text;}
  function finderList(){
    if(finderPlayer){const p=playerRow(),c=miniView.PX?{x:miniView.cx,z:miniView.cz}:null,d=p&&c?Math.max(Math.abs(p[1]-c.x),Math.abs(p[2]-c.z)):null;
      return '<div class="finder-pick"><b>'+E(p?String(p[0]):finderPlayer)+'</b> <span class="xp-muted">'+(p?'combat '+(p[4]??'?')+' · '+p[1]+', '+p[2]+(d!=null?' · '+nf(d)+' tiles away':''):'not online')+'</span>'+(p?'<button class="xp-reset" data-finder-go="'+p[1]+','+p[2]+'" title="Move the camera there (2D)">Go</button><button class="xp-reset" data-lookup="'+E(String(p[0]))+'">Hiscores</button>':'')+'<button class="xp-reset" data-finder-clear>Clear</button></div>';}
    const r=finderRow();
    if(r){const tiles=spawnTiles(r),c=miniView.PX?{x:miniView.cx,z:miniView.cz}:null,best=c?tiles.map(t=>({...t,d:Math.max(Math.abs(t.x-c.x),Math.abs(t.z-c.z))})).sort((a,b)=>a.d-b.d)[0]:null;
      return '<div class="finder-pick"><b>'+E(r[0])+'</b> <span class="xp-muted">'+combatText(r)+' · '+tiles.length+(tiles.length===1?' spawn':' spawns')+'</span>'+(best?'<button class="xp-reset" data-finder-go="'+best.x+','+best.z+'" title="Move the camera there (2D)">Nearest: '+best.x+', '+best.z+' · '+nf(best.d)+' tiles</button>':'')+'<button class="xp-reset" data-finder-clear>Clear</button>'+(teleText(tiles)?'<small class="finder-tele">'+E(teleText(tiles))+'</small>':'')+(thieveText(r[0])?'<small class="finder-tele">'+E(thieveText(r[0]))+'</small>':'')+(meleeHitText(r[0])?'<small class="finder-tele">'+E(meleeHitText(r[0]))+'</small>':'')+(npcHitsText(r[0])?'<small class="finder-tele">'+E(npcHitsText(r[0]))+'</small>':'')+(killXpText(r[0])?'<small class="finder-tele">'+E(killXpText(r[0]))+'</small>':'')+'</div>';}
    // While the NPC list loads, the players (from the roster, already here) still show.
    if(npcSpawns!==null&&!npcSpawns.length&&!playerMatches(finderQuery).length)return '<span class="xp-muted">Loading NPC spawns…</span>';
    const m=finderMatches(finderQuery),pm=playerMatches(finderQuery);
    const npcs=m.map(x=>'<button class="finder-row" data-finder-pick="'+E(x[0])+'"><span>'+E(x[0])+'</span><small>'+combatText(x)+' · '+x[3].length/3+'</small></button>').join('');
    const players=pm.map(r=>'<button class="finder-row finder-player" data-finder-player="'+E(String(r[0]))+'"><span>'+E(String(r[0]))+'</span><small>player · combat '+(r[4]??'?')+'</small></button>').join('');
    return npcs||players?npcs+players:finderQuery.trim().length>=2?'<span class="xp-muted">No NPC or online player by that name.</span>':'';
  }
  function finderResults(){const el=body.querySelector('.finder-results');if(el)el.innerHTML=finderList();}
  function finderBox(){return '<div class="xp-box"><div class="xp-head"><span>NPC and player finder</span><span class="xp-muted">in pink</span></div><input class="finder-input" type="search" data-finder value="'+E(finderQuery)+'" placeholder="NPC or player name" aria-label="Find an NPC or a player"><div class="finder-results">'+finderList()+'</div></div>';}
  // Respawn timers (RuneLite's Mining and Woodcutting plugins), in World: the rocks and trees around the 3D view that
  // are depleted now, with the time to their respawn. client-assets/resources.json (gen-resources.ts) gives each
  // resource tile its name and base respawn ticks; the bridge reports the depleted tiles of the main view's feed. The
  // server scales a respawn by the players online: base * (4000 - min(players, 2000)) / 4000 ticks. A tick is the
  // live server's own length (S.world.tickMs: 400 ms on the demo server).
  let resources=null,depletedNow={tick:0,list:[],at:0};
  fetch(asset('resources.json')).then(r=>r.ok?r.json():null).then(j=>{if(j&&Array.isArray(j.tiles)&&Array.isArray(j.depleted))resources={...j,byTile:new Map(j.tiles.map(t=>[t[0]+','+t[1]+','+t[2],t[3]]))};},()=>{});
  function respawnSync(){if(resources&&typeof VIEWER!=='undefined'&&VIEWER.state==='ready')$('#rsw')?.contentWindow?.postMessage({respawnWatch:resources.depleted},location.origin);}
  function respawnRows(now=Date.now()){
    if(!resources)return [];
    const players=Math.min(2000,(S?.roster||[]).length||S?.worldPlayers||0),scale=(4000-players)/4000,sec=(S?.world?.tickMs||600)/1000;
    return depletedNow.list.map(([x,z,l,,since])=>{
      const id=resources.byTile.get(x+','+z+','+l),k=id!=null?resources.kinds[id]:null;if(!k)return null;
      const passed=since==null?null:(depletedNow.tick-since)*sec+(now-depletedNow.at)/1000,total=k.base!=null?k.base*scale*sec:null;
      const left=total!=null&&passed!=null?Math.max(0,total-passed):null,range=k.min!=null&&passed!=null?[Math.max(0,k.min*scale*sec-passed),Math.max(0,k.max*scale*sec-passed)]:null;
      return {name:k.name,x,z,l,left,range,total};
    }).filter(Boolean).sort((a,b)=>(a.left??a.range?.[0]??1e9)-(b.left??b.range?.[0]??1e9));
  }
  function respawnBox(){
    const rows=respawnRows();if(!rows.length)return '';const t=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
    return `<div class="xp-box"><div class="xp-head"><span>Respawns</span><span class="xp-muted">around the 3D view</span></div>${rows.map(r=>{const p=r.left!=null&&r.total?Math.round(100*(1-r.left/r.total)):0;return `<div class="xp-meta respawn-row"><span><i class="respawn-pie" style="--p:${p}"></i>${E(r.name)} <i class="xp-muted">${r.x}, ${r.z}</i></span><span>${r.left!=null?t(r.left):r.range?t(r.range[0])+'–'+t(r.range[1]):'depleted'}</span></div>`;}).join('')}</div>`;
  }
  setInterval(()=>{if(selectedPlugin==='world'&&depletedNow.list.length&&body.dataset.plugin==='world')refreshWorld();if(depletedNow.list.length)overlaySync();},1000);
  // Party (RuneLite's Party panel) for the PK team: one card per playing account in the Wilderness or with a PK goal,
  // with hitpoints, prayer, run energy, food left (pack items that heal, from item-stats.json), the Wilderness level and
  // how many players can attack it. A card is red while someone can attack it or its hitpoints are below 40%.
  const PK_GOAL=/\b(pk|pvp|pker|spar|tribrid|wilderness)\b/i;
  function partyMembers(){return (S?.bots||[]).filter(x=>!x.practice&&!x.reserved&&x.inWorld&&(wildLevel(x.pos)||PK_GOAL.test(String(x.currentGoal||x.goal||''))||PK_GOAL.test(String(x.role||''))));}
  function partyCard(x){
    const sk=n=>x.skills?.find(s=>s.name===n),pr=sk('Prayer'),hp=x.hp,food=(x.inventory||[]).filter(i=>i&&/\bheals\b/i.test(itemStats[i.name]||'')).reduce((n,i)=>n+(i.count||1),0);
    const w=wildLevel(x.pos),threats=w?pvpState(x)?.threats.length??0:0,low=hp&&hp.max?hp.now/hp.max<0.4:false;
    const bar=(now,max,cls)=>`<div class="party-bar ${cls}"><i style="width:${max?Math.max(0,Math.min(100,Math.round(100*now/max))):0}%"></i><span>${now??'?'} / ${max??'?'}</span></div>`;
    return `<button class="party-card${threats||low?' party-alert':''}" data-world-follow="${E(x.name)}" title="Watch ${E(safeName(x.name))}"><div class="xp-head"><span>${E(safeName(x.name))}</span><span class="xp-muted">combat ${x.combat??'?'}${w?' · wildy '+w:''}</span></div>${bar(hp?.now,hp?.max,'party-hp')}${bar(pr?.currentLevel??pr?.level,pr?.level,'party-prayer')}<div class="xp-meta"><span>Run <b>${x.runEnergy??'?'}%</b></span><span>Food <b>${food}</b></span><span class="${threats?'xp-bad':''}">${threats} can attack</span></div></button>`;
  }
  function partyBox(){const m=partyMembers();return m.length?`<div class="xp-box"><div class="xp-head"><span>Party</span><span class="xp-muted">${m.length} PK account${m.length===1?'':'s'}</span></div><div class="party-grid">${m.map(partyCard).join('')}</div></div>`:'';}
  function worldPanel(){
    if(!S)return '<p class="xp-muted">Waiting for world data…</p>';
    const owner=window.atlasOperator(),spots=worldSpots(),named=(S.contention||[]).filter(s=>s.x==null),roster=S.roster||[],fleet=new Set(S.bots.map(b=>b.name.toLowerCase()));
    const ours=roster.filter(r=>fleet.has(String(r[0]).toLowerCase())).length,most=Math.max(1,...spots.map(s=>s.others.length));
    // PvP Tools: each of our accounts in the Wilderness, with its risk and the players who can attack it now.
    const wild=S.bots.filter(x=>!x.practice&&!x.reserved&&x.inWorld&&wildLevel(x.pos)).map(x=>({b:x,p:pvpState(x)})).filter(v=>v.p);
    const party=partyBox();
    const pvp=wild.length?`<div class="xp-box"><div class="xp-head"><span>Attackable now</span><span class="xp-muted">in the Wilderness</span></div>${wild.map(({b:x,p})=>`<details class="spot-row" data-k="pvp:${E(x.name)}"><summary title="${E('Wilderness '+p.wild+' · risk '+gp(p.risk)+' · kept '+gp(p.keptValue))}"><span class="xp-name">${E(safeName(x.name))} <i class="xp-muted">lvl ${p.wild}</i></span><span class="${p.threats.length?'xp-bad':'xp-muted'}">${p.threats.length} can attack · risk ${gp(p.risk)}</span></summary>${p.threats.map(t=>`<div class="xp-meta"><span>${E(t.name)}</span><span>combat ${t.combat} · ${t.dist} tiles</span></div>`).join('')||'<div class="xp-meta"><span>Nobody in attack range within 30 tiles.</span></div>'}</details>`).join('')}</div>`:'';
    return `<div class="xp-panel"><div class="xp-box"><div class="xp-head"><span>Online now</span><span class="xp-gain">${nf(roster.length)}</span></div><div class="xp-meta"><span>${ours} of them are ours</span>${owner?'<span>world feed, every 6 s</span>':''}</div></div>`+party+pvp+respawnBox()+highlightsBox()+markersBox()+finderBox()+
      `<div class="xp-box"><div class="xp-head" title="Other players within 10 tiles of a tile our accounts use, on the ground floor."><span>Our spots</span><span class="xp-muted">other players</span></div>${spots.map(s=>`<details class="spot-row" data-k="spot:${owner?s.x+','+s.z+':'+E(s.side):E(s.label)}"><summary title="${E(s.others.length+' other players, '+s.ours.length+' of ours'+(owner?' · '+s.x+', '+s.z:''))}"><span>${E(s.label)}</span><span class="spot-ours" title="${s.ours.length} of our accounts here">${'<i></i>'.repeat(Math.min(s.ours.length,6))}</span><span class="spot-bar"><i style="width:${Math.round(s.others.length/most*100)}%"></i></span><b>${s.others.length}</b></summary>${owner?`<div class="xp-meta"><span>claimed by ${E(s.side)}</span><span>${s.x}, ${s.z}</span></div>`:''}<div class="spot-names">${nameButtons(s.others,24)||'<span class="xp-muted">No other player is here.</span>'}</div></details>`).join('')||`<span class="xp-muted">${owner?'No claimed spot has a tile.':'No spot is in use.'}</span>`}${named.length&&owner?`<p class="xp-muted">Claimed without a tile: ${named.map(s=>E(s.resource)).join(', ')}</p>`:''}</div>`+
      farmsBox(spots)+'</div>';
  }
  // A new snapshot rewrites the panel; the rows a viewer opened stay open.
  function refreshWorld(){
    if(document.activeElement?.matches?.('[data-finder]')&&body.contains(document.activeElement))return;
    const open=new Set([...body.querySelectorAll('details[data-k]')].filter(d=>d.open).map(d=>d.dataset.k)),top=body.scrollTop;
    put(body,worldPanel());body.querySelectorAll('details[data-k]').forEach(d=>{d.open=open.has(d.dataset.k);});body.scrollTop=top;
  }
  // Bot farms: other players online whose names follow one pattern, and how many of them stand at our spots.
  function farmsBox(spots){
    const farms=S.farms||[],tip='A farm is three or more online players with one name pattern: a numbered series, or random names with the same first two characters and length.';
    if(!farms.length)return `<div class="xp-box"><div class="xp-head" title="${tip}"><span>Bot farms</span></div><span class="xp-muted">None online.</span></div>`;
    const atSpot=new Set(spots.flatMap(s=>s.others)),most=Math.max(1,...farms.map(g=>g.count));
    return `<div class="xp-box"><div class="xp-head" title="${tip}"><span>Bot farms</span><span class="xp-muted">${farms.length} farms · ${nf(farms.reduce((n,g)=>n+g.count,0))} players</span></div>`+farms.slice(0,12).map(g=>{const at=g.names.filter(n=>atSpot.has(n)).length,where=[...new Map(g.tiles.map(([x,z])=>[placeOf(x,z),0])).keys()].slice(0,2).join(', ');
      return `<details class="farm-row" data-k="farm:${E(g.key)}"><summary title="${E(g.label+': '+g.count+' online'+(g.range?', numbers '+g.range[0]+' to '+g.range[1]:'')+(at?', '+at+' at our spots':''))}"><span>${E(g.label.replace(/ \(.*$/,' · random names'))}</span><span class="spot-at" title="${at} stand at our spots">${at||''}</span><span class="spot-bar"><i style="width:${Math.round(g.count/most*100)}%"></i></span><b>${g.count}</b></summary><div class="xp-meta"><span>${E(where)}</span></div><div class="spot-names">${nameButtons(g.names,24)}</div></details>`;}).join('')+'</div>';
  }
  function lookupCard(l){
    if(l.error)return '<span class="side-late">'+E(l.error)+'</span>';
    if(window.atlasLiveRoster?.()){
      const name=l.name.toLowerCase();
      const seen=LIVE_ROSTER.players.find(r=>String(r[0]).toLowerCase()===name);
      l=seen?{...l,online:true,x:seen[1],z:seen[2],plane:seen[3],combat:seen[4]}:{...l,online:false};
    }
    const rank=n=>l.rows?.find(r=>r.board===n);
    // Our best level per skill beside theirs: a red level is one where this player is ahead of every fleet account.
    const ours=n=>{let best=null;for(const b of S.bots){if(b.practice||b.reserved)continue;const s=b.skills?.find(k=>k.name===n);if(s&&(!best||s.level>best.level))best={level:s.level,name:safeName(b.name)};}return best;};
    const grid=l.rows?skills.filter(n=>reported(null,n)).map(n=>{const r=rank(n),o=ours(n);return `<div class="hs-cell${r&&o&&r.level>o.level?' hs-ahead':''}" title="${E(n+(r?'\nLevel: '+r.level+'\nRank: '+nf(r.rank)+'\nTime: '+r.time:'\nNot ranked')+(o?'\nOur best: '+o.level+' ('+o.name+')':''))}"><img src="${asset('skill-'+skillFile(n)+'.png')}" alt="${E(n)}"><span>${r?r.level:'--'}</span></div>`;}).join(''):'';
    const overall=rank('Overall'),qp=rank('Quest Points');
    return `<div class="lookup-card"><div class="xp-head"><span${l.at?' title="Hiscores read '+age(Math.min(l.at,S.now))+' ago"':''}>${E(l.name)}</span><span class="${l.online?'friend-on':'friend-off'}">${l.online?('online '+E(whereIs(l.x,l.z))).trim():l.online==null?'presence not loaded':l.lastSeen?'last seen '+age(Math.min(l.lastSeen,S.now))+' ago':'not seen online'}</span></div><div class="xp-stats">${l.combat!=null?`<span>Combat <b>${E(l.combat)}</b></span>`:''}${overall?`<span>Overall <b>#${nf(overall.rank)} · ${overall.level}</b></span>`:''}${qp?`<span>QP <b>${qp.level}</b></span>`:''}</div>`+
      (l.rows?(l.rows.length?`<div class="hs-grid">${grid}</div>`:'<p class="xp-muted">Not on the demo hiscores.</p>'):`<p class="xp-muted">${E(l.note||'Hiscores not loaded.')}</p>`)+
      // Worn items from the player's appearance in the world feed, read with the lookup (online players only).
      (Array.isArray(l.worn)?`<div class="xp-head lookup-worn-head"><span>Worn items</span>${l.wornAt?`<span class="xp-muted">${age(Math.min(l.wornAt,S.now))} ago</span>`:''}</div>`+(l.worn.length?`<div class="lookup-worn">${l.worn.map(w=>`<span class="lookup-worn-item" title="${E(w.slot+': '+w.name)}">${icon(w.name,32)}</span>`).join('')}</div>`:'<p class="xp-muted">Wears nothing.</p>'):'')+
      (l.online?`<button class="game-control" data-world-follow="${E(l.name)}">Watch in 3D</button>`:'')+'</div>';
  }
  function refreshWorldLookup(){
    refreshHiscoreAccount();
  }
  // A lookup opens Hiscores on its Player tab, as RuneLite's Lookup does: a fleet account from the snapshot, any other
  // player from the player service.
  function lookup(name){
    name=String(name||'').trim();if(!/^[A-Za-z0-9_ -]{1,12}$/.test(name))return;const request=++worldLookupRequest,ours=S?.bots?.find(b=>!b.practice&&b.name.toLowerCase()===name.toLowerCase());
    hiscoreName=ours?ours.name:name;hiscoreSel=sel;hiscoresMode='account';worldLookup=ours?null:{name,rows:null,note:'Looking up…'};
    if(selectedPlugin!=='boards'||!body.querySelector('.hs-wrap'))showPlugin('boards');else refreshHiscoreAccount();
    if(ours)return;
    fetch('/api/player?name='+encodeURIComponent(name)).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||'Player service returned HTTP '+r.status);return j;}).then(j=>{if(worldLookupRequest!==request)return;worldLookup=j;refreshWorldLookup();}).catch(e=>{if(worldLookupRequest!==request)return;worldLookup={name,rows:null,note:'Lookup failed: '+(e?.message||e)};refreshWorldLookup();});
  }
  window.atlasLookup=lookup;
  // Infoboxes (RuneLite): the watched account's session and time to target, or one box per playing bot.
  // The Wilderness level of a tile, as the server counts it (wilderness_levels.rs2, wilderness_zones.dbrow): one level for each 8 tiles north of the zone's south edge; 0 outside.
  const wildLevel=p=>{if(!p||p.x<2944||p.x>3391)return 0;const south=p.z>=3520&&p.z<=6399?3520:p.z>=9920&&p.z<=12799?9920:0;return south?Math.floor((p.z-south)/8)+1:0;};
  // PvP Tools (RuneLite's): what an account carries at the GE price, the 3 most valuable items it keeps on a death
  // without a skull (each item of a stack counts once), and the players who can attack it. The attack rule is the
  // server's (pvp_combat.rs2): both in the Wilderness, combat levels apart by at most the lower Wilderness level.
  // Roster rows are [name, x, z, level, combat]. Players up to 30 tiles away count.
  const canAttack=(a,b)=>{const w=Math.min(wildLevel(a.pos),wildLevel(b.pos));return w>=1&&Number.isFinite(a.combat)&&Number.isFinite(b.combat)&&Math.abs(a.combat-b.combat)<=w;};
  function pvpState(b){
    if(!b?.inWorld||!b.pos)return null;
    const price=n=>S.economy?.itemValues?.[n]??(n==='Coins'?1:0),carried=[...(b.equipment||[]),...(b.inventory||[])].filter(i=>i&&i.count>0&&i.name);
    const risk=carried.reduce((n,i)=>n+price(i.name)*i.count,0);
    const kept=carried.flatMap(i=>Array.from({length:Math.min(i.count,3)},()=>({name:i.name,value:price(i.name)}))).sort((x,y)=>y.value-x.value).slice(0,3);
    const keptValue=kept.reduce((n,i)=>n+i.value,0),fleet=new Set(S.bots.map(x=>x.name.toLowerCase()));
    const threats=(S.roster||[]).filter(r=>r[3]===(b.pos.level||0)&&String(r[0]).toLowerCase()!==b.name.toLowerCase()).map(r=>({name:String(r[0]),pos:{x:r[1],z:r[2]},combat:r[4],dist:Math.max(Math.abs(r[1]-b.pos.x),Math.abs(r[2]-b.pos.z)),ours:fleet.has(String(r[0]).toLowerCase())}))
      .filter(p=>p.dist<=30&&!p.ours&&canAttack({pos:b.pos,combat:b.combat},p)).sort((x,y)=>x.dist-y.dist);
    return {wild:wildLevel(b.pos),risk,kept,keptValue,lost:Math.max(0,risk-keptValue),threats};
  }
  function infoboxes(){
    const el=hud.querySelector('.game-infoboxes'),b=account();
    const set=html=>{if(el._h!==html){el._h=html;el.innerHTML=html;}};
    const box=(img,text,title,name)=>`<button class="infobox" title="${E(title)}" ${name?'data-xp-focus="'+E(name)+'"':''}><img src="${img}" alt=""><span>${E(text)}</span></button>`;
    const short=ms=>ms==null?'':ms<3600e3?Math.floor(ms/6e4)+'m':Math.floor(ms/36e5)+'h'+String(Math.floor(ms%36e5/6e4)).padStart(2,'0');
    // Nearby players (RuneLite's member counter): how many players stand within 15 tiles on the account's plane, and how many of them are ours.
    const nearby=b=>!b?.inWorld||!b.pos?[]:(S.roster||[]).filter(r=>r[3]===(b.pos.level||0)&&Math.max(Math.abs(r[1]-b.pos.x),Math.abs(r[2]-b.pos.z))<=15&&String(r[0]).toLowerCase()!==b.name.toLowerCase());
    const nearBox=b=>{const near=nearby(b);if(!near.length)return '';const fleet=new Set(S.bots.map(x=>x.name.toLowerCase())),ours=near.filter(r=>fleet.has(String(r[0]).toLowerCase())).length;return box(asset('rl-fleet.png'),String(near.length),near.length+(near.length===1?' player':' players')+' within 15 tiles'+(ours?' · '+ours+' ours':''));};
    // Ammo (RuneLite's ammo plugin): the stack in the ammo slot (13) with its count.
    // Food (RuneLite's supplies count): the food in the pack (item-stats.json: what heals) with its count; red at 2 or fewer.
    const foodBox=b=>{const f=typeof foodOf==='function'?foodOf(b):{total:0};if(!f.total)return '';const top=f.items[0],hp=f.items.reduce((n,i)=>n+(Number(String(itemStats[i.name]||'').match(/heals (\d+)/)?.[1])||0)*i.count,0);return `<button class="infobox${f.total<=2?' boost-down':''}" title="${E('Food: '+f.items.map(i=>i.name+' × '+i.count).join(', ')+(hp?' · heals '+hp+' hitpoints in all':''))}">${icon(top.name,24)}<span>${f.total}</span></button>`;};
    const ammoBox=b=>{const a=b.equipment?.find(e=>e.slot===13&&e.count>0);return a?`<button class="infobox ammo" title="${E(a.name)} × ${E(a.count)}">${icon(a.name,24)}<span>${a.count>=1e5?Math.floor(a.count/1e3)+'K':E(a.count)}</span></button>`:'';};
    if(b){set((b.uptime?box(asset('rl-activity.png'),short(b.uptime),'Session: '+dur(b.uptime)):'')+(b.goalSkill&&!(b.goalNow>=b.goalLevel)?box(asset('skill-'+skillFile(b.goalSkill)+'.png'),b.eta||String(b.goalNow??''),b.goalSkill+' '+(b.goalNow??'?')+' → '+b.goalLevel+(b.eta?' in '+b.eta:'')):'')+(b.death?box(asset('skill-hitpoints.png'),'died','Died '+age(b.death.at)+' ago: '+b.death.text+' · click for the recap').replace('class="infobox"','class="infobox boost-down" data-death="'+E(b.name)+'"'):'')+foodBox(b)+ammoBox(b)+nearBox(b)
      // Item charges: teleport jewellery on its last charge, or used up (an amulet of glory with no charges has no number).
      +(()=>{const l=[...(b.inventory||[]),...(b.equipment||[])].filter(i=>i&&/^(Amulet of glory|Ring of dueling|Games necklace)(\(1\))?$/.test(i.name)&&i.name!=='Ring of dueling'&&i.name!=='Games necklace');return l.length?`<button class="infobox boost-down" title="${E('Last charge: '+l.map(i=>i.name).join(', '))}">${icon(l[0].name,24)}<span>${l.length}</span></button>`:'';})()
      // PvP Tools: in the Wilderness, a red count of the players who can attack the account now.
      +(()=>{const p=b.inWorld&&b.pos&&wildLevel(b.pos)?pvpState(b):null;return p?.threats.length?box(asset('prayer-protect-item.png'),String(p.threats.length),p.threats.length+(p.threats.length===1?' player':' players')+' can attack: '+p.threats.slice(0,6).map(t=>t.name+' ('+t.combat+', '+t.dist+' tiles)').join(', ')).replace('class="infobox"','class="infobox boost-down"'):'';})()
      // Boosts (RuneLite boosts): a skill whose current level differs from its base; Hitpoints and Prayer are the orbs.
      +(b.skills||[]).filter(s=>realSkill(s)&&s.name!=='Hitpoints'&&s.name!=='Prayer'&&s.currentLevel!=null&&s.currentLevel!==s.level).map(s=>box(asset('skill-'+skillFile(s.name)+'.png'),s.currentLevel+'/'+s.level,s.name+(s.currentLevel>s.level?' boosted':' drained')+': '+s.currentLevel+' / '+s.level).replace('class="infobox"','class="infobox '+(s.currentLevel>s.level?'boost-up':'boost-down')+'"')).join(''));return;}
    set(S.bots.filter(x=>x.fresh&&!x.practice&&!x.reserved).slice(0,12).map(x=>{const t=trainedSkill(x);return box(asset(t?'skill-'+skillFile(t)+'.png':'rl-activity.png'),short(x.uptime),safeName(x.name)+(t?' · '+t+(x.goalNow!=null&&t===x.goalSkill?' '+x.goalNow:''):'')+(x.phaseShort?' · '+String(x.phaseShort).slice(0,60):'')+' · '+dur(x.uptime||0),x.name);}).join(''));
  }
  // Board progress (the coordinator's scoreboard): what remains, the fleet's best live level per skill, quests and items.
  function progressPanel(){
    const p=S.scoreboard;if(!p?.available)return window.atlasOperator()?'<div class="xp-box"><span class="xp-muted">The coordinator scoreboard is not available.</span></div>':'';
    const old=!p.at||Date.now()-p.at>15*60e3,frac=(a,b)=>a==null||b==null?'—':nf(a)+' / '+nf(b);
    return `<div class="xp-panel progress-panel"><div class="xp-box"><div class="xp-head"><span>Board progress</span><span class="${old?'side-late':'xp-gain'}">${p.at?'updated '+age(p.at)+' ago':'age unknown'}</span></div><div class="xp-stats"><span>Skill levels <b>${nf(p.skillLevels??0)}</b></span><span>99s <b>${p.skills99??'—'}</b></span><span>Quests live <b>${frac(p.quests.live,p.quests.total)}</b></span><span>Items held <b>${frac(p.items.held,p.items.total)}</b></span></div></div>`+
      `<div class="xp-box"><div class="xp-head"><span>Remaining</span><span class="xp-gain">${p.done?'done':p.remaining.length}</span></div><div class="progress-remaining">${p.remaining.map(r=>`<span>${E(r)}</span>`).join('')||'<span class="xp-muted">Nothing remains.</span>'}</div></div></div>`;
  }
  // Grand Exchange plugin (RuneLite's): the route supplies with the live market's buy and sell prices and stock.
  // geOpen: the item id whose sources are open; geOpenName: its display name, for the map pin.
  // GE price change: the server keeps no price history, so this browser keeps two snapshots of the buy price by item id
  // (the ask, else the average): the base, at least 20 hours old, which the change is measured from, and the next one,
  // which becomes the base when it is 24 hours old. A change under 1% shows nothing.
  const GE_TREND_KEY='atlas-ge-prices';
  function geTrend(rows,now=Date.now()){
    let st;try{st=JSON.parse(localStorage.getItem(GE_TREND_KEY)||'null');}catch{st=null;}
    const cur=Object.fromEntries((rows||[]).map(i=>[i.id,i.ask??i.vwap]).filter(([,v])=>Number.isFinite(v)&&v>0));
    // No usable price yet (the market not fetched): keep the history as it is, so the next full refresh starts it.
    if(!Object.keys(cur).length){const base=st?.base&&now-st.base.at>=72_000_000?st.base:null;return {at:base?.at??null,change:new Map()};}
    if(!st||!st.next){st={base:null,next:{at:now,p:cur}};}
    else if(now-st.next.at>=86_400_000){st={base:st.next,next:{at:now,p:cur}};}
    try{localStorage.setItem(GE_TREND_KEY,JSON.stringify(st));}catch{/* private window */}
    const base=st.base&&now-st.base.at>=72_000_000?st.base:null,out=new Map();
    if(base)for(const [id,v] of Object.entries(cur)){const b=base.p[id];if(b>0){const pct=Math.round((v-b)/b*100);if(Math.abs(pct)>=1)out.set(String(id),pct);}}
    return {at:base?.at??null,change:out};
  }
  let geQuery='',geOpen=null,geOpenName='';
  let geAll=false;
  // GE sort (RuneLite's Flipping Utilities and the HA profit): Stock (the default), Flip or Alch. Flip buys one with an
  // offer at the bid + 1 and sells it at the ask - 1, but no higher than the 7-day average trade price (vwap): one
  // seller's ask in a thin market is no price anyone pays. The 5% tax on a sale comes off (MarketStore.ts: floor(gross / 20)).
  // Alch buys one at the ask and casts high alchemy with one nature rune at its market price (alchOf). The two show only
  // the items with a profit, the most first, and the Stock column shows the profit.
  let geSort='stock';
  function geProfit(i,mode){
    if(mode==='flip'){if(i.ask==null||i.bid==null||i.vwap==null)return null;const sell=Math.floor(Math.min(i.ask-1,i.vwap)),buy=i.bid+1;return sell-Math.floor(sell/20)-buy;}
    if(mode==='alch'){const h=typeof alchOf==='function'?alchOf(i.name):null,nat=(S?.economy?.supplies||[]).find(x=>x.name==='Nature rune'),rune=nat?.ask??(typeof price==='function'?price('Nature rune')?.value:null);if(!h||i.ask==null||rune==null)return null;return Math.round(h-i.ask-rune);}
    return null;}
  function gePanel(){
    const [head,rows]=geResults();return `<div class="ge-panel"><input id="ge-search" class="rl-search" placeholder="Find an item…" value="${E(geQuery)}" aria-label="Search items"><div class="ge-results"><div class="ge-head">${head}</div><div class="ge-rows">${rows}</div></div></div>`;
  }
  function refreshGe(){
    const results=body.querySelector('.ge-results');
    if(!results)return;
    const toggleFocused=results.contains(document.activeElement)&&document.activeElement.matches('[data-ge-all]');
    const [head,rows]=geResults();put(results.querySelector('.ge-head'),head);put(results.querySelector('.ge-rows'),rows);
    if(toggleFocused)results.querySelector('[data-ge-all]')?.focus({preventScroll:true});
  }
  // The sources of one item, under its row: each with "Show on map" when it has places.
  function geSources(id){
    loadItemSources();const list=itemSourcesData?.[id];
    if(!itemSourcesData||!Object.keys(itemSourcesData).length&&list===undefined)return '<div class="ge-sources"><span class="xp-muted">Loading sources…</span></div>';
    if(!list?.length)return '<div class="ge-sources"><span class="xp-muted">No source on record: the route does not use this item.</span></div>';
    return '<div class="ge-sources">'+list.map(([k,label,tiles],j)=>'<div class="ge-source"><span class="ge-kind ge-'+E(k)+'">'+E(k)+'</span><span class="ge-label">'+E(label)+geTele(tiles)+'</span>'+(tiles.length?'<button class="xp-reset" data-src-pin="'+j+'" title="'+tiles.length/3+' places">'+(sourcePin?.key===id+'|'+j?'Shown':'Show on map')+'</button>':'')+'</div>').join('')+'</div>';
  }
  // The head (counts and the price age) and the rows are written apart: a new age does not rebuild the rows.
  function geResults(){
    if(!S)return ['<p class="xp-muted" role="status">Waiting for market data…</p>',''];
    // The game names every unidentified herb "Herb"; the item id says which one it is (obj.pack unidentified_*).
    const HERBS={199:'guam',201:'marrentill',203:'tarromin',205:'harralander',207:'ranarr',209:'irit',211:'avantoe',213:'kwuarm',215:'cadantine',217:'dwarf weed',219:'torstol',2485:'lantadyme',3049:'toadflax',3051:'snapdragon'},geName=i=>i.name==='Herb'&&HERBS[i.id]?'Herb ('+HERBS[i.id]+')':i.name;
    const offered=i=>i.ask!=null||i.bid!=null,owner=window.atlasOperator(),held=new Map(),nameOnly=new Map();
    if(owner)for(const b of S.bots)if(!b.practice&&!b.reserved&&Array.isArray(b.bank))for(const it of b.bank){const id=it.baseId??it.id,target=Number.isInteger(id)?held:nameOnly,key=Number.isInteger(id)?id:it.name;target.set(key,(target.get(key)||0)+(it.count||0));}
    const heldCount=i=>{const known=held.get(i.id)||0,unknown=nameOnly.get(i.name)||0;if(unknown&&(S?.economy?.supplies||[]).filter(x=>x.name===i.name).length>1)return known?nf(known)+' + ?':'?';return nf(known+unknown);};
    const query=geQuery.trim().toLowerCase();
    const all=(S?.economy?.supplies||[]).filter(i=>i.name&&geName(i).toLowerCase().includes(query)),hidden=all.filter(i=>!offered(i)).length;
    const gs=typeof geSort==='string'?geSort:'stock',profit=gs==='stock'?null:new Map(all.map(i=>[i,geProfit(i,gs)]));
    const rows=profit?all.filter(i=>profit.get(i)>0).sort((a,b)=>profit.get(b)-profit.get(a)):all.filter(i=>geAll||offered(i)).sort((a,b)=>Number(b.ask!=null||b.bid!=null)-Number(a.ask!=null||a.bid!=null)||(b.stock||0)-(a.stock||0)||a.name.localeCompare(b.name));
    // One header names the columns, so a row holds numbers only. A long number is cut short; the row's tooltip has it whole.
    const trend=typeof geTrend==='function'?geTrend(S?.economy?.supplies||[]):{at:null,change:new Map()},arrow=i=>{const p=trend.change.get(String(i.id));return p==null?'':'<small class="'+(p>0?'ge-up':'ge-down')+'" title="'+(p>0?'+':'')+p+'% since '+age(trend.at)+' ago">'+(p>0?'▲':'▼')+Math.abs(p)+'%</small>';};
    const exact=v=>v==null?'—':nf(Math.round(v))+' gp',short=v=>v==null?'—':v>=1e6?+(v/1e6).toFixed(2)+'M':v>=1e5?Math.round(v/1e3)+'k':nf(Math.round(v));
    return [`<div class="xp-meta"><span>${all.length-hidden} ${owner?'route supplies':'items'}</span><span>prices ${S.economy?.pricesAt?age(S.economy.pricesAt)+' old':'unknown'}</span></div><div class="ge-sort" role="group" aria-label="Sort">${[['stock','Stock','Most stock first'],['flip','Flip','Buy at the bid + 1, sell at the ask - 1 but no higher than the 7-day average, less the 5% tax'],['alch','Alch','Buy at the ask, cast high alchemy with one nature rune']].map(([id,label,tip])=>`<button class="xp-reset${gs===id?' on':''}" data-ge-sort="${id}" title="${tip}" aria-pressed="${gs===id}">${label}</button>`).join('')}</div>${hidden?`<button class="game-control" data-ge-all>${geAll?'Hide':'Show'} the ${hidden} with no offer</button>`:''}${rows.length?`<div class="ge-row ge-cols${owner?' ge-owner':''}"><span></span><span>Item</span><span title="The price to buy one, in gp">Buy</span><span title="The price to sell one, in gp">Sell</span><span${profit?' title="The profit of one, in gp"':''}>${profit?(gs==='flip'?'Flip':'Alch')+' +':'Stock'}</span>${owner?'<span title="Held in our banks">Ours</span>':''}</div>`:''}`,
      rows.slice(0,80).map(i=>`<div class="ge-row${owner?' ge-owner':''}${geOpen===String(i.id)?' ge-open':''}" data-ge-src="${E(i.id)}" data-ge-name="${E(geName(i))}" title="${E(geName(i))}: buy ${exact(i.ask)}, sell ${exact(i.bid)}, stock ${nf(i.stock||0)}, average ${exact(i.vwap)}, shop ${exact(i.base)}${profit?(gs==='flip'?', flip ':', alch ')+'+'+exact(profit.get(i))+' each':''}"><span class="ge-icon">${icon(i.name,24)}</span><span class="ge-name">${E(geName(i))}${arrow(i)}</span><b>${short(i.ask)}</b><b>${short(i.bid)}</b><span${profit?' class="ge-up"':''}>${profit?'+'+short(profit.get(i)):short(i.stock||0)}</span>${owner?`<span class="ge-ours">${heldCount(i)}</span>`:''}</div>`+(geOpen===String(i.id)?geSources(String(i.id)):'')).join('')+(rows.length?'':'<p class="xp-muted">'+(profit?'No item gives a '+(gs==='flip'?'flip':'high alch')+' profit at the prices now.':'No item matches.')+'</p>')];
  }
  // Pull requests plugin: the bot repository's open and lately merged pull requests, by the agent whose branch they are.
  const AGENT_OF=b=>/^claude-cloud\//.test(b)?'Claude cloud':/^cloud\//.test(b)?'Codex cloud':/^claude\//.test(b)?'Claude on the PC':/^codex\//.test(b)?'Codex on the PC':'Other';
  function prsPanel(){
    const rows=S.prs||[];if(!rows.length)return '<div class="xp-panel"><div class="xp-box"><span class="xp-muted">No pull requests are published.</span></div></div>';
    const groups=new Map();for(const r of rows){const k=AGENT_OF(r.branch);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
    const chipFor=r=>r.state==='MERGED'?'<span class="pr-chip merged">merged</span>':r.draft?'<span class="pr-chip draft">draft</span>':'<span class="pr-chip open">open</span>';
    return '<div class="xp-panel">'+[...groups].map(([agent,list])=>`<div class="xp-box"><div class="xp-head"><span>${E(agent)}</span><span class="xp-gain">${list.filter(r=>r.state==='OPEN').length} open</span></div>${list.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,12).map(r=>`<a class="pr-row" href="${E(r.url)}" target="_blank" rel="noopener"><span class="pr-num">#${r.number}</span><span class="pr-title">${E(r.title)}</span>${chipFor(r)}<span class="pr-age">${r.updatedAt?age(Date.parse(r.updatedAt))+' ago':''}</span></a>`).join('')}</div>`).join('')+'</div>';
  }
  new MutationObserver(followTitle).observe(plugin.querySelector('#client-plugin-name'),{childList:true,characterData:true,subtree:true});
  function renderSnapshotPlugin(id){
    if(!S){
      body.innerHTML='<p class="xp-muted" role="status" data-snapshot-loading>Waiting for fleet data…</p>';
      return;
    }
    if(id==='boards')hiscores();
    else if(id==='xp'){body.innerHTML='<div class="xp-tracker"></div>';refreshXp();}
    else body.innerHTML=infoPanel();
  }
  // Starts the enter animation of a container again (client-shell.css .enter-a and .enter-b: the same keyframes under
  // two names, so a change of class starts it with no forced layout). The class goes when the animation is over, so
  // content written after that does not animate.
  const enterTimers=new WeakMap();
  function enter(el){const next=el.classList.contains('enter-a')?'enter-b':'enter-a';el.classList.remove('enter-a','enter-b');el.classList.add(next);clearTimeout(enterTimers.get(el));enterTimers.set(el,setTimeout(()=>el.classList.remove('enter-a','enter-b'),320));}
  const syncSidebar=()=>$('#client-sidebar').setAttribute('aria-expanded',String(!app.classList.contains('client-collapsed')));
  function showPlugin(id){if(!window.atlasOperator()&&OPERATOR_PLUGINS.includes(id)){toast('Sign in as owner for the command tools.');id='fleet';}
    // A spectator's click on a board opens that board's top 10 (Hiscores, Rivals); a board with no top 10 has no more to show.
    if(!window.atlasOperator()){if(PUBLIC_HIDDEN.includes(id))id='fleet';else if(id==='board'){const key=typeof chosenBoard==='string'&&typeof boardKey==='function'?boardKey(chosenBoard):'',top=(S?.rivals||[]).find(x=>boardKey(x.board)===key);if(!top)return;rivalBoard=top.board;hiscoresMode='rivals';id='boards';}}
    const priorPlugin=selectedPlugin;window.atlasBeforePluginChange?.(priorPlugin,id);selectedPlugin=id;app.classList.remove('client-collapsed');app.classList.add('mobile-plugin');for(const el of [fleet,inspect,boards,allocation,journal])parked.append(el);body.replaceChildren();body._h=null;if(priorPlugin!==id)enter(body);$('#client-plugin-name').textContent=window.atlasPlugins?.[id]?.label||window.atlasPluginNames?.[id]||plugins.find(p=>p[0]===id)?.[1]||({raw:'Raw evidence'}[id]||'Settings');
    // Activity opens with the death recap of the watched account when it died.
    if(id==='activity'){const da=account();if(recap.state!=='loading'&&recapStale(da))loadRecap(da.name);}
    body.dataset.plugin=id;plugin.dataset.plugin=id;if(window.atlasPlugins?.[id]){window.atlasPlugins[id].render(body);}else if(['xp','boards','info'].includes(id))renderSnapshotPlugin(id);else if(id==='ge')body.innerHTML=gePanel();else if(id==='prs')body.innerHTML=prsPanel();else if(id==='fleet')body.append(fleet);else if(id==='world')body.innerHTML=worldPanel();else if(id==='activity'){body.append(journal);journal.style.setProperty('display','block','important');journal.style.position='static';journal.style.width='100%';journal.style.height='auto';}else{body.append(inspect);choose(id==='settings'?'machine':id);if(id==='goals'&&window.atlasOperator()){const form=document.createElement('form');form.className='goal-request';form.innerHTML='<input name="text" maxlength="500" placeholder="Tell the agents what you want next..." aria-label="New owner request"><button>Send</button><small>Goes to research/owner-requests.md as the next numbered row.</small>';body.prepend(form);}}
    rail.querySelectorAll('[data-client-plugin]').forEach(b=>{b.classList.toggle('on',b.dataset.clientPlugin===id);b.setAttribute('aria-pressed',String(b.dataset.clientPlugin===id));});syncSidebar();if(S&&id==='fleet')roster();window.atlasAfterPluginChange?.(priorPlugin,id);
  }
  function openBank(){
    if(!window.atlasOperator()){toast('Sign in as owner to see banks.');return;}
    const name=account()?.name;
    if(!name){toast('Choose a fleet account to see its bank.');return;}
    hud.querySelector('.game-bank')?.remove();const modal=document.createElement('section');modal.className='game-bank';modal.setAttribute('aria-label','Bank snapshot for '+safeName(name));
    modal.innerHTML='<header><span>The Bank of Gielinor</span><small class="bank-value"></small><small class="bank-count">0</small><button aria-label="Close bank">×</button></header><div class="bank-tabs"><button title="All items">∞</button>'+Array.from({length:8},(_,i)=>'<button title="Bank tab '+(i+1)+'">＋</button>').join('')+'</div><div class="bank-items"></div><footer><span class="bank-group">Rearrange mode: <button data-view-action="Swap" class="on">Swap</button><button data-view-action="Insert">Insert</button></span><span class="bank-group">Withdraw as: <button data-view-action="Withdraw as item" class="on">Item</button><button data-view-action="Withdraw as note">Note</button></span><span class="bank-group">Quantity: '+['1','5','10','X','All'].map((q,i)=>'<button data-view-action="Quantity '+q+'"'+(i===0?' class="on"':'')+'>'+q+'</button>').join('')+'</span><input aria-label="Search bank" placeholder="Find an item…"><span class="bank-age"></span></footer>';
    const draw=()=>{
      const b=account();if(b?.name!==name){modal.remove();return;}
      modal.querySelector('.bank-count').textContent=b?.bank?.length??0;
      modal.querySelector('.bank-age').textContent=safeName(name)+' · '+(b?.bankAt?'Observed '+age(b.bankAt)+' ago':'No bank snapshot');
      const value=modal.querySelector('.bank-value'),v=stackValue(b?.bank);value.hidden=!b?.bank?.length;
      const ha=typeof alchOf==='function'?(b?.bank||[]).reduce((t,i)=>t+(alchOf(i.name)||0)*i.count,0):0;
      value.textContent=gp(v.value)+(v.unpriced?' + '+v.unpriced+' unpriced':'')+(ha?' · HA '+gp(ha):'');
      value.title='Bank value at the vault prices (7-day market average, else the shop price)'+(v.unpriced?'; '+v.unpriced+' item kinds have no price':'')+(ha?'; high alchemy pays '+gp(ha)+' coins for the alchable items':'');
      const query=modal.querySelector('input').value.toLowerCase(),items=b?.bank?.filter(i=>i.name.toLowerCase().includes(query));
      modal.querySelector('.bank-items').innerHTML=items?items.map(it=>'<button class="inventory-cell" title="'+E(it.name)+' × '+it.count+E(statTip(it)+priceTip(it))+'">'+icon(it.name,32)+(it.count>1?qty(it.count):'')+(typeof idTag==='function'?idTag(it):'')+'</button>').join(''):'<p class="game-muted">No bank inventory has been reported for this account.</p>';
    };
    modal.refreshObservation=draw;
    modal.querySelector('[aria-label="Close bank"]').onclick=()=>modal.remove();modal.querySelector('input').oninput=draw;modal.querySelector('.bank-tabs').onclick=()=>toast('Only the combined bank inventory is reported.');hud.append(modal);draw();
  }
  // Orbs as RuneLite has them, on the game's orb art (34 px): a stone ring, the ball as high as the value over a
  // drained ball, the icon on top, and the number on a stone plate to the left in RuneLite's red-yellow-green.
  const STONE={edge:'#322b19',light:'#5d544a',mid:'#4c4338',well:'#28221a'};
  const orbColour=(v,max)=>{if(v==null||!max)return '#ffff00';const f=Math.max(0,Math.min(1,v/max));return `rgb(${Math.round(f<0.5?255:510*(1-f))},${Math.round(f<0.5?510*f:255)},0)`;};
  // Each orb picture is split once. The ball is every pixel inside the ring that the icon's black outline does not
  // enclose; the drained copy has a dark ball, and the ring and the icon stay as they are.
  const orbArt={};
  function orbSprite(id){
    let a=orbArt[id];if(a)return a;a=orbArt[id]={full:null,empty:null,wait:new Set()};
    const img=new Image();img.onload=()=>{
      const N=34,sheet=()=>{const c=document.createElement('canvas');c.width=c.height=N;return c;},full=sheet(),empty=sheet(),fg=full.getContext('2d');fg.drawImage(img,0,0);
      const d=fg.getImageData(0,0,N,N),p=d.data,ring=new Set([STONE.edge,STONE.light,STONE.mid].map(h=>parseInt(h.slice(1),16))),rgb=i=>p[i*4]<<16|p[i*4+1]<<8|p[i*4+2];
      const ball=i=>p[i*4+3]>0&&!ring.has(rgb(i))&&Math.hypot(i%N-16.5,(i/N|0)-16.5)<14.5,outline=i=>Math.max(p[i*4],p[i*4+1],p[i*4+2])<3;
      const open=new Uint8Array(N*N),todo=[];for(let i=0;i<N*N;i++)if(ball(i)&&[i-1,i+1,i-N,i+N].some(j=>!ball(j)))todo.push(i);
      while(todo.length){const i=todo.pop();if(open[i]||!ball(i)||outline(i))continue;open[i]=1;todo.push(i-1,i+1,i-N,i+N);}
      for(let i=0;i<N*N;i++)if(open[i]){const l=10+(p[i*4]*0.3+p[i*4+1]*0.59+p[i*4+2]*0.11)*0.14;p[i*4]=l;p[i*4+1]=l*0.9;p[i*4+2]=l*0.78;}
      empty.getContext('2d').putImageData(d,0,0);a.full=full;a.empty=empty;for(const c of a.wait)if(c.isConnected)drawOrb(c);a.wait.clear();
    };img.src=asset('orb-'+id+'.png');return a;
  }
  function drawOrb(c){
    const a=orbSprite(c.dataset.orb),g=c.getContext('2d'),frac=Number(c.dataset.frac)||0,ox=c.width-34,box=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(x,y,w,h);};
    g.clearRect(0,0,c.width,c.height);
    // The number plate: a dark well with a stone edge and cut left corners; its right end is under the orb.
    box(1,7,ox+9,20,STONE.edge);box(0,8,1,18,STONE.edge);box(1,8,ox+9,18,STONE.mid);box(1,8,ox+9,1,STONE.light);box(1,9,1,16,STONE.light);box(2,9,ox+8,16,STONE.well);
    if(!a.full){a.wait.add(c);return;}
    // The ball is 26 rows high from row 4. A value above zero shows one row or more.
    const top=frac>0?Math.min(29,4+Math.round(26*(1-frac))):30;g.drawImage(a.empty,ox,0);if(top<30)g.drawImage(a.full,0,top,34,34-top,ox,top,34,34-top);
  }
  // A disc of whole pixels: each row is as wide as the circle at the row's centre. With no colour it clears the pixels.
  const disc=(g,cx,cy,r,col)=>{if(col)g.fillStyle=col;for(let y=Math.floor(cy-r);y<=Math.ceil(cy+r);y++){const h=r*r-(y+0.5-cy)*(y+0.5-cy);if(h<0)continue;const w=Math.sqrt(h),x0=Math.ceil(cx-w-0.5),x1=Math.floor(cx+w-0.5);if(x1<x0)continue;if(col)g.fillRect(x0,y,x1-x0+1,1);else g.clearRect(x0,y,x1-x0+1,1);}};
  // The XP button has the ring of the orbs, drawn from pixels.
  {
    const c=document.createElement('canvas'),g=c.getContext('2d');c.width=c.height=27;
    for(const [r,col] of [[13.4,STONE.edge],[12.4,STONE.light],[11.4,STONE.mid],[9.4,STONE.edge],[8.4,STONE.well]])disc(g,13.5,13.5,r,col);
    hud.querySelector('.game-xp').style.backgroundImage=`url(${c.toDataURL()})`;
  }
  // The minimap frame is the game's own art, cut free of the stone wall: the two carved dragons round the map, from the
  // top-right corner of the 2004 screen frame (back.png, the 249 by 168 pixels to the right of the viewport) with the
  // minimap stone (mapback.png) in its hole at (34, 4). Magenta is the sprites' clear colour: the map and the compass
  // show through the two holes. The cut follows the art's own dark outline: the carving is every pixel that a fill
  // from the hole edges reaches before it meets the outline (luma under 40), with the outline round it; the wall
  // outside that goes clear. The compass gets the stone ring of the orbs, because the wall held its socket.
  {
    const box=hud.querySelector('.game-minimap'),c=box.querySelector('canvas.minimap-frame'),g=c.getContext('2d'),W=249,H=168,N=W*H,art=['back.png','mapback.png'].map(n=>{const i=new Image();i.src=asset(n);return i;});
    const paint=()=>{if(!art.every(i=>i.complete&&i.naturalWidth))return;g.clearRect(0,0,W,H);g.drawImage(art[0],516,0,W,H,0,0,W,H);g.drawImage(art[1],34,4);
      const d=g.getImageData(0,0,W,H),p=d.data,hole=new Uint8Array(N),dark=new Uint8Array(N);
      for(let i=0;i<N;i++){const r=p[i*4],gr=p[i*4+1],b=p[i*4+2];if(r===255&&!gr&&b===255)hole[i]=1;else if(Math.floor((r*30+gr*59+b*11)/100)<40)dark[i]=1;}
      // A fill over 4 neighbours from the seeds, through the pixels that pass.
      const fill=(seeds,pass)=>{const seen=new Uint8Array(N);while(seeds.length){const i=seeds.pop();if(seen[i]||!pass(i))continue;seen[i]=1;const x=i%W;if(x>0)seeds.push(i-1);if(x<W-1)seeds.push(i+1);if(i>=W)seeds.push(i-W);if(i<N-W)seeds.push(i+W);}return seen;};
      const beside=(i,set)=>{const x=i%W;return (x>0&&set[i-1])||(x<W-1&&set[i+1])||(i>=W&&set[i-W])||(i<N-W&&set[i+W]);};
      const rim=[];for(let i=0;i<N;i++)if(!hole[i]&&beside(i,hole))rim.push(i);
      const body=fill(rim,i=>!hole[i]&&!dark[i]),carving=new Uint8Array(N);
      for(let i=0;i<N;i++){if(hole[i])continue;const x=i%W,y=i/W|0;for(let b=-1;b<=1&&!carving[i];b++)for(let a=-1;a<=1;a++){const xx=x+a,yy=y+b;if(xx>=0&&xx<W&&yy>=0&&yy<H&&body[yy*W+xx]){carving[i]=1;break;}}}
      const border=[];for(let x=0;x<W;x++)border.push(x,N-W+x);for(let y=0;y<H;y++)border.push(y*W,y*W+W-1);
      const wall=fill(border,i=>!hole[i]&&!carving[i]);
      // Under the two heads the stone goes on to the edge of the art: the cut ends it at row 162.
      for(let i=0;i<N;i++)if(hole[i]||wall[i]||(i>=163*W&&i%W>=85&&i%W<=155))p[i*4+3]=0;
      g.putImageData(d,0,0);
      for(const [r,col] of [[20.5,STONE.edge],[19.5,STONE.light],[18.5,STONE.mid],[17,STONE.edge],[16,null]])disc(g,50.5,20.5,r,col);
      // The map canvas keeps only the pixels of the map hole (the hole that holds the centre of the map).
      const inMap=fill([84*W+132],i=>hole[i]),m=document.createElement('canvas'),mg=m.getContext('2d');m.width=146;m.height=151;const md=mg.createImageData(146,151);
      for(let y=0;y<151;y++)for(let x=0;x<146;x++)if(inMap[(y+9)*W+x+59])md.data[(y*146+x)*4+3]=255;
      mg.putImageData(md,0,0);minimap.hole=m;box.classList.add('ready');minimap();};
    // The first try waits for the rest of this script, because the cut draws the minimap.
    for(const i of art)i.addEventListener('load',paint);setTimeout(paint);
  }
  // The minimap: the 2D map art around the observed account at 4 px a tile (the wheel changes that from 2 to 8),
  // every bot a dot, the observed one a white square in the centre. With no account it shows the whole known world.
  // In 3D it turns with the viewer's camera (yaw from the bridge, the viewer's own formula) and centres on the followed
  // account, or on the camera in free camera and while it follows another player; the viewer's minimap is hidden
  // (client-viewer.css). In 2D it stays north-up.
  // The bridge sends the camera only when it moves, so the last one holds while the 3D frame is loaded.
  let miniView={cx:0,cz:0,PX:1,angle:0};
  // A dot is the game's map dot: 4 by 5 pixels with a darker right side and a black shadow under it, upright when the
  // map turns. A fleet bot is green (dim when it does not play). Another player by class (RuneLite's minimap
  // plugin colours): a ranked rival is blue, a bot farm account is grey, any other player is white. The sets are made
  // once for each snapshot.
  function minimap(){const c=hud.querySelector('.game-minimap canvas');if(!c||!S)return;const g=c.getContext('2d'),W=c.width,H=c.height,m=S.map||{x0:2368,z0:2880,w:560,h:416,scale:2};const b=account(),bp=b?.live||b?.pos,markers=mapWorld();hud.querySelector('.game-minimap')?.setAttribute('aria-label',markers.practice?'Practice minimap':'Minimap');
    const c3=typeof mode!=='undefined'&&mode==='3d'&&window.atlasCam3d&&$('#rsw')?.getAttribute('src')?window.atlasCam3d:null,p=c3&&(!bp||window.atlasFreeCamera||window.atlasFollowOther)?{x:c3.x,z:c3.z}:bp,angle=c3?(2047-c3.yaw)*Math.PI/1024:0;
    const D=minimap,PX=p?D.zoom||4:Math.min(W/(m.w*m.scale),H/(m.h*m.scale)),cx=p?p.x:m.x0+m.w*m.scale/2,cz=p?p.z:m.z0+m.h*m.scale/2;miniView={cx,cz,PX,angle};
    const compass=hud.querySelector('.minimap-compass');if(compass)compass.style.transform=angle?`rotate(${angle*180/Math.PI}deg)`:'';
    // The art covers a square that holds the canvas at every angle.
    const OX=W>>1,OY=H>>1,R=Math.ceil(Math.hypot(W,H)/2)+1,cos=Math.cos(angle),sin=Math.sin(angle);
    g.clearRect(0,0,W,H);g.fillStyle='#000';g.fillRect(0,0,W,H);g.save();g.translate(OX,OY);if(angle)g.rotate(angle);
    if(typeof MAPI!=='undefined'&&MAPI){const ppt=window.atlasMapPx||1/m.scale,span=2*R/PX*ppt,sx=(cx-m.x0+0.5)*ppt-span/2,sy=(m.z0+m.h*m.scale-cz-0.5)*ppt-span/2;g.imageSmoothingEnabled=!p||!!window.atlasMapPx;g.drawImage(MAPI,sx,sy,span,span,-R,-R,2*R,2*R);}
    if(p&&window.atlasSquare){const half=R/PX;g.imageSmoothingEnabled=PX<4;for(let mx=Math.floor((cx-half)/64);mx<=Math.floor((cx+half)/64);mx++)for(let mz=Math.floor((cz-half)/64);mz<=Math.floor((cz+half)/64);mz++){const img=window.atlasSquare(mx,mz);if(img)g.drawImage(img,(mx*64-cx-0.5)*PX,-(mz*64+64-cz-0.5)*PX,64*PX,64*PX);}}
    g.restore();
    if(!D.rival||D.at!==S.snapshotAt){D.at=S.snapshotAt;D.rival=new Set((S.rivals||[]).flatMap(r=>(r.rows||[]).filter(x=>!x.fleet).map(x=>String(x.name).toLowerCase())));D.farm=new Set((S.farms||[]).flatMap(f=>(f.names||[]).map(n=>String(n).toLowerCase())));}
    const hits=D.hits=[],dot=(qx,qz,col,shade,name,s)=>{const dx=(qx-cx)*PX,dy=(cz-qz)*PX,x=Math.round(OX+dx*cos-dy*sin),y=Math.round(OY+dx*sin+dy*cos);if(x<-2||y<-3||x>W+2||y>H+2)return;hits.push([x,y,name]);
      // On the map of the whole world a dot is a square of 2 pixels, or 3 for a fleet bot, so that a crowd stays readable.
      if(!p){const x0=x-(s>>1),y0=y-(s>>1);g.fillStyle='#000';g.fillRect(x0,y0,s+1,s+1);g.fillStyle=col;g.fillRect(x0,y0,s,s);return;}
      g.fillStyle='#000';g.fillRect(x-2,y+1,4,1);g.fillRect(x-1,y+2,2,1);g.fillStyle=col;g.fillRect(x-1,y-2,2,4);g.fillRect(x-2,y-1,4,2);g.fillStyle=shade;g.fillRect(x+1,y-1,1,2);g.fillRect(x-1,y+1,2,1);};
    // Busy areas: each 8 by 8 tile square with 5 or more players on the shown floor, shaded red (darker for more players).
    if(typeof hl!=='undefined'&&hl.busy){const floor=bp?.level||0,cell=new Map();for(const r of markers.roster){if((r[3]||0)!==floor||(r[2]>6400)!==(cz>6400))continue;const k=Math.floor(r[1]/8)+','+Math.floor(r[2]/8);cell.set(k,(cell.get(k)||0)+1);}
      const corner=(qx,qz)=>{const dx=(qx-cx-0.5)*PX,dy=(cz-qz+0.5)*PX;return [OX+dx*cos-dy*sin,OY+dx*sin+dy*cos];};
      for(const [k,n] of cell){if(n<5)continue;const [gx,gz]=k.split(',').map(Number),x0=gx*8,z0=gz*8,pts=[corner(x0,z0),corner(x0+8,z0),corner(x0+8,z0+8),corner(x0,z0+8)];g.fillStyle='rgba(255,40,0,'+Math.min(0.5,0.12+n*0.02)+')';g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();const c=corner(x0+4,z0+4);hits.push([Math.round(c[0]),Math.round(c[1]),n+' players here']);}}
    const fleetNames=new Set(markers.bots.map(o=>o.name.toLowerCase()));// In the Wilderness, a player who can attack the watched account now (PvP Tools) is a red dot.
    const attackers=new Set(((b&&b.inWorld&&b.pos&&wildLevel(b.pos)?pvpState(b)?.threats:null)||[]).map(t=>String(t.name).toLowerCase()));
    for(const [n,qx,qz] of markers.roster){const low=String(n).toLowerCase();if(fleetNames.has(low))continue;if(attackers.has(low))dot(qx,qz,'#ff2020','#b00000',n,2);else if(D.rival.has(low))dot(qx,qz,'#19b3ff','#0f84c4',n,2);else if(D.farm.has(low))dot(qx,qz,'#9a9a9a','#757575',n,2);else dot(qx,qz,'#fff','#d2d2d2',n,2);}
    for(const o of markers.bots){const q=o.live||o.pos;if(!q||(q.z>6400)!==(cz>6400)||o===b)continue;const[cl]=st(o);if(cl==='on')dot(q.x,q.z,'#2bff2b','#1fc21f',o.name,3);else dot(q.x,q.z,'#3d8a33','#2c6625',o.name,3);}
    // Death recap: the watched account's death tile, while its recap is open.
    const dt=typeof recap!=='undefined'&&recap.state==='ok'&&b&&recap.name===b.name?recap.data?.pos:null;if(dt&&(dt.z>6400)===(cz>6400))dot(dt.x,dt.z,'#ff2020','#a00000','Death tile',3);
    // Position trail on the minimap: each of our accounts' last places, a thin green line.
    if(p&&typeof hl!=='undefined'&&hl.trail&&typeof trails!=='undefined'){g.strokeStyle='#00c000';g.lineWidth=1;const tp=(qx,qz)=>{const dx=(qx-cx)*PX,dy=(cz-qz)*PX;return [OX+dx*cos-dy*sin,OY+dx*sin+dy*cos];};for(const t of trails.values()){if(t.length<2)continue;g.beginPath();t.forEach((q,i)=>{const [x,y]=tp(q.x,q.z);if(i)g.lineTo(x,y);else g.moveTo(x,y);});g.stroke();}}
    // Multi-Lines on the minimap: the red multi-combat edges near the minimap's centre, turned and scaled as the dots are.
    if(p&&typeof hl!=='undefined'&&hl.multi&&typeof multiLines!=='undefined'&&multiLines){g.strokeStyle='#ff0000';g.lineWidth=1;const px=(qx,qz)=>{const dx=(qx-cx)*PX,dy=(cz-qz)*PX;return [OX+dx*cos-dy*sin,OY+dx*sin+dy*cos];};for(const [x0,z0,x1,z1,l] of multiLines){if(l!==(b?.pos?.level||0))continue;const k=clipLine(x0,z0,x1,z1,cx,cz,80);if(!k)continue;const a=px(k[0],k[1]),c=px(k[2],k[3]);g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(c[0],c[1]);g.stroke();}}
    // Ground markers, failure markers and the NPC finder's spawns on the minimap.
    const mp=(qx,qz)=>{const dx=(qx-cx)*PX,dy=(cz-qz)*PX;return [Math.round(OX+dx*cos-dy*sin),Math.round(OY+dx*sin+dy*cos)];},sameSide=qz=>(qz>6400)===(cz>6400);
    if(typeof hl!=='undefined'&&hl.marks&&typeof marks!=='undefined'){const s=Math.max(3,Math.round(PX));const floor=bp?.level||0;for(const m of marks){if(!sameSide(m.z)||(m.l||0)!==floor)continue;const [x,y]=mp(m.x,m.z);if(x<-s||y<-s||x>W+s||y>H+s)continue;g.strokeStyle=m.c||'#ffff00';g.lineWidth=1;g.strokeRect(x-(s>>1)+0.5,y-(s>>1)+0.5,s,s);}}
    // A pin on another floor than the shown one is a darker pink, and its name says the floor.
    if(typeof pinned==='function'){const pin=pinned(),shown=bp?.level||0;if(pin)for(const t of pin.tiles)if(sameSide(t.z)){const up=(t.l||0)!==shown;dot(t.x,t.z,up?'#9a3d9a':'#ff66ff',up?'#6a2a6a':'#c040c0',(pin.tip||pin.label)+(up?' · floor '+(t.l||0):''),2);}}
    // World Map icons and the watched account's floor items (the game's red minimap dots), on the shown floor, zoomed in.
    if(p&&typeof hl!=='undefined'){const floor=bp?.level||0,inView=(x,y)=>x>=-4&&y>=-4&&x<=W+4&&y<=H+4;
      if(hl.items&&Array.isArray(b?.ground))for(const it of b.ground){if(!Array.isArray(it)||it[2]!==floor||!sameSide(it[1]))continue;const [x,y]=mp(it[0],it[1]);if(!inView(x,y))continue;g.fillStyle='#000';g.fillRect(x-1,y,3,2);g.fillStyle='#ff0000';g.fillRect(x-1,y-1,2,2);hits.push([x,y,'Floor item'+(it[4]>1?' × '+it[4]:'')]);}
      if(hl.icons&&typeof mapIcons!=='undefined'&&mapIcons)for(const [qx,qz,l,k,label,req] of mapIcons){if(l!==floor||!sameSide(qz))continue;const [x,y]=mp(qx,qz);if(!inView(x,y))continue;const can=iconCan(b,req);hits.push([x,y,label+(can===false?' · needs '+req[1]+' '+req[0]:'')]);
        // The map art already has the game's shop icons: a shop keeper is named under the pointer, with no mark of its own.
        if(k==='s')continue;g.fillStyle='#000';g.beginPath();g.arc(x+0.5,y+0.5,3.5,0,7);g.fill();g.fillStyle=k==='t'?(can===false?'#24407a':'#3f7fff'):k==='p'?'#00d0d0':can===false?'#e02020':'#2bd32b';if(k==='a')g.fillRect(x-2,y-2,5,5);else{g.beginPath();g.arc(x+0.5,y+0.5,2.5,0,7);g.fill();}}}

    if(typeof hl!=='undefined'&&hl.idle&&typeof idleRows==='function'){const shownBots=new Set(markers.bots.map(o=>o.name));for(const r of idleRows()){if(!sameSide(r.z)||!shownBots.has(r.name))continue;const [x,y]=mp(r.x,r.z);g.strokeStyle='#ffff00';g.lineWidth=1;g.beginPath();g.arc(x+0.5,y+0.5,5,0,7);g.stroke();hits.push([x,y,safeName(r.name)+' idle '+Math.floor(r.ms/60000)+'m']);}}
    if(typeof hl!=='undefined'&&hl.fails&&typeof failSpots==='function')for(const f of failSpots())if(sameSide(f.z))dot(f.x,f.z,'#ff9900','#b36b00',(f.names.length>1?f.names.length+' failed':safeName(f.names[0])+' failed')+': '+f.reason,3);
    if(p){g.fillStyle='#fff';g.fillRect(OX-1,OY-2,3,3);}
    // Only the pixels of the map hole stay: the frame is a cut-out, and it does not hide the rest of the square.
    if(D.hole){g.globalCompositeOperation='destination-in';g.drawImage(D.hole,0,0);g.globalCompositeOperation='source-over';}}
  // A click on the minimap in 2D moves the camera to that tile (free camera); in 3D the view itself moves the camera.
  const miniCanvas=hud.querySelector('.game-minimap canvas'),miniAt=e=>{const r=miniCanvas.getBoundingClientRect(),x=(e.clientX-r.left)*miniCanvas.width/r.width,y=(e.clientY-r.top)*miniCanvas.height/r.height,v=miniView,dx=x-(miniCanvas.width>>1),dy=y-(miniCanvas.height>>1),cos=Math.cos(v.angle),sin=Math.sin(v.angle);return {x,y,tx:Math.round(v.cx+(dx*cos+dy*sin)/v.PX),tz:Math.round(v.cz-(dy*cos-dx*sin)/v.PX)};};
  miniCanvas?.addEventListener('click',e=>{if(e.shiftKey){const t=miniAt(e),b=account(),l=(b?.live||b?.pos)?.level||0;toast((toggleMark(t.tx,t.tz,l)?'Marked ':'Removed the marker at ')+t.tx+', '+t.tz+'.');return;}if(typeof mode!=='undefined'&&mode==='3d'){toast('In 3D, drag the view to move the camera.');return;}const t=miniAt(e);window.atlasCamera.goto(t.tx,t.tz);});
  // The wheel zooms the minimap (the game's minimap zoom): 2 to 8 pixels a tile, kept for the next visit.
  const MINI_ZOOMS=[2,3,4,6,8];try{const z=Number(localStorage.getItem('atlasMiniZoom'));if(MINI_ZOOMS.includes(z))minimap.zoom=z;}catch{/* no storage: 4 px a tile */}
  miniCanvas?.addEventListener('wheel',e=>{e.preventDefault();const now=minimap.zoom||4,next=MINI_ZOOMS[Math.max(0,Math.min(MINI_ZOOMS.length-1,MINI_ZOOMS.indexOf(now)+(e.deltaY<0?1:-1)))];if(next===now)return;minimap.zoom=next;try{localStorage.setItem('atlasMiniZoom',String(next));}catch{/* the zoom holds for this visit */}minimap();},{passive:false});
  // The pointer on the minimap names the tile under it, and the players whose dots it touches.
  miniCanvas?.addEventListener('mousemove',e=>{const t=miniAt(e),tip=hud.querySelector('.game-tip'),cb=new Map((S?.roster||[]).map(r=>[String(r[0]).toLowerCase(),r[4]])),names=[...new Set((minimap.hits||[]).filter(h=>Math.abs(h[0]-t.x)<=3&&Math.abs(h[1]-t.y)<=3).map(h=>{const c=cb.get(String(h[2]).toLowerCase());return safeName(h[2])+(Number.isFinite(c)?' ('+c+')':'');}))];
    tip.textContent=(names.length?names.slice(0,4).join(', ')+(names.length>4?' +'+(names.length-4):'')+' · ':'')+t.tx+', '+t.tz;tip.hidden=false;const h=hud.getBoundingClientRect();tip.style.left=Math.max(0,e.clientX-h.left-tip.offsetWidth-10)+'px';tip.style.top=(e.clientY-h.top+12)+'px';});
  // Only a player dot looks up: the hits also hold floor items, markers and icons, whose labels can look like a name.
  const playerNames=()=>new Set([...(S?.roster||[]).map(r=>String(r[0]).toLowerCase()),...(S?.bots||[]).map(b=>String(b.name).toLowerCase())]);
  miniCanvas?.addEventListener('contextmenu',e=>{const t=miniAt(e),players=playerNames(),h=(minimap.hits||[]).filter(h=>Math.abs(h[0]-t.x)<=3&&Math.abs(h[1]-t.y)<=3&&/^[A-Za-z0-9_ -]{1,12}$/.test(h[2])&&players.has(String(h[2]).toLowerCase()))[0];if(!h)return;e.preventDefault();lookup(h[2]);});
  miniCanvas?.addEventListener('mouseleave',()=>{hud.querySelector('.game-tip').hidden=true;});
  // A narrow view has no room for the orbs beside the minimap: they go in a row under it, and the XP button goes to
  // the top right of the ring (client-shell.css, hud-narrow).
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>hud.classList.toggle('hud-narrow',hud.clientWidth<500)).observe(hud);
  // XP drops (OSRS): each skill gain since the last observation floats up under the XP orb with its icon.
  let dropsFor=null,dropsXp={};
  function xpDrops(b){
    if(!b||b.name!==dropsFor){dropsFor=b?.name??null;dropsXp=Object.fromEntries((b?.skills||[]).map(k=>[k.name,k.xp]));return;}
    const box=hud.querySelector('.xp-drops');let n=0;
    for(const k of b.skills||[]){const before=dropsXp[k.name];dropsXp[k.name]=k.xp;if(before==null||k.xp<=before||k.name==='Overall')continue;
      xpGlobe(k.name,k.xp);const el=document.createElement('div');el.className='xp-drop';el.style.animationDelay=(n++*260)+'ms';el.innerHTML=`<img src="${asset('skill-'+skillFile(k.name)+'.png')}" alt="">+${nf(k.xp-before)}`;box.append(el);setTimeout(()=>el.remove(),3200+n*260);}
  }
  // The overlay panel (RuneLite): the watched account's goal, phase and pace, or the fleet in free camera.
  function overlay(){
    const b=account(),el=hud.querySelector('.game-overlay');
    // The box is written only when its text changes. The infoboxes sit below the box, whatever its height.
    const set=html=>{if(el._h!==html){el._h=html;el.innerHTML=html;const ib=hud.querySelector('.game-infoboxes');if(ib&&el.offsetHeight)ib.style.top=el.offsetTop+el.offsetHeight+4+'px';}};
    const line=(k,v)=>`<div><span>${E(k)}</span><b>${E(v)}</b></div>`;
    // The race the team runs, under every state of the box: the boards it holds at #1 and the board nearest to #1.
    const ranked=(S.boards||[]).filter(x=>x.best?.rank),near=ranked.filter(x=>x.gap&&!x.gap.ahead&&x.best.rank>1).sort((a,b)=>(b.gap.close||0)-(a.gap.close||0))[0];
    const race=ranked.length?'<h4 class="race">Race to #1</h4>'+line('Boards at #1',ranked.filter(x=>x.best.rank===1).length+' / '+S.boards.length)+(near?line('Closest',near.board+' '+Math.round((near.gap.close||0)*100)+'%'):''):'';
    // The 3D camera on another player (a lookup's Follow in 3D): what the page knows of them, from the lookup.
    const other=window.atlasFollowOther;
    if(other){const l=S.lookups?.[other.toLowerCase()],ov=l?.rows?.find(r=>r.board==='Overall'),seen=S.roster?.find(r=>String(r[0]).toLowerCase()===other.toLowerCase());
      set('<h4>'+E(other)+'</h4>'+line('Status',seen?'online':'not in the roster')+line('Combat',String(l?.combat??seen?.[4]??'—'))+(ov?line('Overall','#'+nf(ov.rank)+' · '+ov.level):'')+(l?.worn?.length?line('Wears',l.worn.map(w=>w.name).join(', ').slice(0,60)):'')+line('Account','not ours')+race);return;}
    if(!b){const fleet=S.bots.filter(x=>!x.practice&&!x.reserved),live=fleet.filter(x=>x.operation==='observed'),stuck=fleet.filter(x=>['blocked','failed','died','active-stale'].includes(x.operation)),c=S.coordination?.counts;set('<h4>Fleet</h4>'+line('Playing',live.length+' / '+fleet.length)+line('Stopped',String(stuck.length))+(c&&window.atlasOperator()?line('AI jobs',(c.running??0)+' marked running · '+(c.pending??0)+' queued'):'')+(window.atlasOperator()&&S.vault?.coins?line('Vault coins',gp(S.vault.coins)):'')+(S.worldPlayers?line('Online',nf(S.worldPlayers)):'')+race);return;}
    const [,state]=st(b);
    // Attack range (RuneLite's combat level plugin): in the Wilderness, the combat levels that can fight the account (pvp_combat.rs2: the difference is at most the Wilderness level).
    // Skilling session (RuneLite's Woodcutting, Mining and Fishing session boxes): the account's top loot item since its
    // session started, with its count an hour (Loot tracker flow).
    const SESSION_VERB={woodcutting:'Logs cut',mining:'Ores mined',fishing:'Fish caught',cooking:'Food cooked',thieving:'Loot',smithing:'Made',crafting:'Made',fletching:'Made',firemaking:'Burned'};
    const sessionLine=b=>{const t=(b.flow?.loot||[]).slice().sort((x,y)=>y.count-x.count)[0];if(!t)return '';const hours=Math.max(1/60,((b.flow.at??Date.now())-b.flow.since)/3.6e6);const burnt=(b.flow?.loot||[]).filter(i=>/^burnt /i.test(i.name)).reduce((n,i)=>n+i.count,0),cooked=new Set(Object.values(typeof cookData==='object'?cookData:{}).map(r=>r.c)),made=burnt?(b.flow?.loot||[]).filter(i=>cooked.has(i.name)).reduce((n,i)=>n+i.count,0):0;
      return line(SESSION_VERB[String(b.goalSkill||'').toLowerCase()]||'Gained',t.name+' '+nf(t.count)+' · '+nf(Math.round(t.count/hours))+'/hr')+(burnt&&made?line('Burnt',nf(burnt)+' · '+Math.round(burnt*100/(burnt+made))+'% burn rate'):'');};
    // PvP Tools lines: in the Wilderness, the risk, what a death keeps and loses, and the players who can attack now.
    const wildLine=b=>{const w=b.inWorld?wildLevel(b.pos):0;if(!w)return '';const p=pvpState(b),names=p.threats.slice(0,3).map(t=>t.name+' ('+t.combat+')').join(', ');return line('Wilderness','Level '+w+(b.combat?' · '+Math.max(3,b.combat-w)+'-'+Math.min(126,b.combat+w):''))+line('Risk',gp(p.risk))+line('Kept · lost',gp(p.keptValue)+' · '+gp(p.lost))+line('Can attack',p.threats.length?p.threats.length+': '+names.slice(0,60):'nobody in 30 tiles');};
    const goalText=(b.goalSkill&&!(b.goalNow>=b.goalLevel)?b.goalSkill+' '+b.goalLevel:'')||String(b.goal||'').slice(0,60);
    set('<h4>'+E(safeName(b.name))+'</h4>'+(b.practice?line('World','practice · 2D'):'')+line('Status',state)+(goalText||window.atlasOperator()?line('Goal',goalText||'—'):'')+(b.phaseShort?line('Phase',String(b.phaseShort).slice(0,60)):'')+(b.xpPerHour?line('XP/hr',nf(Math.round(b.xpPerHour))):'')+(b.eta&&b.xpLeft>0?line('To target',b.eta):'')+(b.uptime&&b.inWorld?line('Session',dur(b.uptime)):'')+(!b.inWorld&&b.at?line('Last seen',age(b.at)+' ago'):'')+sessionLine(b)+wildLine(b)+race);
  }
  // Skills tab tooltip (OSRS): XP, next level at, remaining.
  hud.addEventListener('mouseover',e=>{const sk=e.target.closest('[data-skill]');const tip=hud.querySelector('.game-tip');if(!sk){tip.hidden=true;return;}const s=level(sk.dataset.skill),X=window.atlasXp;if(!s||!X){tip.hidden=true;return;}const lvl=Math.min(99,s.level),next=X.xpForLevel(Math.min(99,lvl+1));
    if(s.xp==null){tip.innerHTML=`<div>${E(sk.dataset.skill)} level <b>${s.level}</b></div><div>XP is not reported for this side.</div>`;}else tip.innerHTML=`<div>${E(sk.dataset.skill)} XP: <b>${nf(s.xp)}</b></div>`+(lvl<99?`<div>Next level at: <b>${nf(next)}</b></div><div>Remaining XP: <b>${nf(Math.max(0,next-s.xp))}</b></div>`:X.virtualLevel(s.xp)>99?`<div>Virtual level: <b>${X.virtualLevel(s.xp)}</b></div>`:'');
    {const g=s.xp!=null?skillGuide(sk.dataset.skill,s.xp):null;if(g){if(g.best){const ch=typeof gatherText==='function'&&/^(fishing|mining|woodcutting)$/i.test(sk.dataset.skill)?gatherText(account(),g.best.item,lvl,sk.dataset.skill):/^runecraft/i.test(sk.dataset.skill)&&typeof perEssence==='function'?perEssence(g.best.item,typeof curLevel==='function'&&Number.isFinite(curLevel(account(),s.name))?curLevel(account(),s.name):lvl):'';tip.innerHTML+=`<div>To level: <b>${nf(g.best.count)}</b> × ${E(g.best.name)}${ch?' · '+E(ch):''}</div>`;}if(g.next.length)tip.innerHTML+=`<div>Unlocks: ${g.next.map(n=>E(n.name)+' ('+n.level+')').join(', ')}</div>`;}
     const bx=typeof bankedXp==='function'?bankedXp(account(),sk.dataset.skill):null;if(bx)tip.innerHTML+=`<div>Banked: <b>+${nf(bx.xp)}</b> XP from ${nf(bx.items)} items${bx.level&&bx.level>lvl?' → level '+bx.level:''}</div>`;}
    const r=sk.getBoundingClientRect(),h=hud.getBoundingClientRect();tip.hidden=false;tip.style.left=Math.max(0,r.left-h.left-tip.offsetWidth-4)+'px';tip.style.top=(r.top-h.top)+'px';});
  hud.addEventListener('mouseout',e=>{if(e.target.closest('[data-skill]')&&!e.relatedTarget?.closest?.('[data-skill]'))hud.querySelector('.game-tip').hidden=true;});
  let welcomed=false;
  function chatFeed(){
    const owner=window.atlasOperator(),rows=[...(S.events||[]).filter(e=>!e.practice).map(e=>({at:e.at,name:e.name,text:e.full||e.text,kind:'Game'})),...(S.results||[]).filter(r=>!r.practice&&(owner||!window.atlasHousekeeping(r.text))).map(r=>({at:r.at,name:r.name,text:(r.ok?'finished: ':'stopped: ')+(owner?String(r.text):window.atlasJobName(r.text)).slice(0,120),kind:r.ok||!owner?'Game':'Private'}))]
      .sort((a,b)=>a.at-b.at).slice(-60);
    let added=0;
    for(const r of rows){const key=r.kind+'|'+r.at+'|'+r.name+'|'+r.text;if(seen.has(key))continue;seen.add(key);if(seen.size>800)seen.delete(seen.values().next().value);chat.push({kind:r.kind,name:safeName(r.name),text:r.text,at:r.at});added++;}
    if(!welcomed){welcomed=true;added++;chat.push({kind:'Game',text:'Welcome to RuneScape.',at:Date.now()});if(!window.atlasOperator())chat.push({kind:'Game',text:'You are watching our bot team live. ::help lists the chat commands.',at:Date.now()});}
    while(chat.length>200)chat.shift();
    if(added)renderChat();
  }
  // Desktop notifications (RuneLite's notifier): level-ups, deaths and idling, when the owner switched them on.
  const NOTIFY_KEY='atlas-notify';
  let notifyPending=false,notifyEpoch=0,notifyError='';
  const notifyOn=()=>{try{return localStorage.getItem(NOTIFY_KEY)==='1'&&'Notification' in window&&Notification.permission==='granted';}catch{return false;}};
  function notifyStatus(){return notifyError||(!('Notification' in window)?'This browser has no desktop notifications.':notifyPending?'Waiting for browser permission.':Notification.permission==='denied'?'Notifications are blocked for this site in the browser.':notifyOn()?'Desktop notifications on: level-ups, deaths, low hitpoints and idling.':Notification.permission==='default'?'Notifications off. Browser permission is needed.':'Desktop notifications off.');}
  function syncNotifyControls(){body.querySelectorAll('[data-notify]').forEach(el=>el.checked=notifyOn());body.querySelectorAll('[data-notify-status]').forEach(el=>el.textContent=notifyStatus());body.querySelectorAll('[data-notify-test]').forEach(el=>el.disabled=!notifyOn());body.querySelectorAll('[data-notify-cancel]').forEach(el=>el.hidden=!notifyPending);}
  async function setNotify(on){
    if(on&&notifyPending)return notifyStatus();
    const epoch=++notifyEpoch;notifyPending=false;notifyError='';
    try{localStorage.setItem(NOTIFY_KEY,'0');}catch{notifyError='Notification preference could not be saved.';}
    if(on&&'Notification' in window){
      if(Notification.permission==='default'){
        notifyPending=true;syncNotifyControls();let timer;
        try{await Promise.race([Notification.requestPermission(),new Promise(resolve=>timer=setTimeout(resolve,15000))]);}catch{if(epoch===notifyEpoch)notifyError='Browser notification permission could not be requested.';}finally{clearTimeout(timer);}
      }
      if(epoch!==notifyEpoch)return notifyStatus();
      if(Notification.permission==='granted')try{localStorage.setItem(NOTIFY_KEY,'1');}catch{notifyError='Notification preference could not be saved.';}
    }
    if(epoch!==notifyEpoch)return notifyStatus();
    notifyPending=false;syncNotifyControls();const status=notifyStatus();toast(status);return status;
  }
  function desktopNotify(text,test=false){if(!notifyOn()||(!test&&document.hasFocus()))return false;try{new Notification('RuneLite \u2014 Swarm',{body:text,icon:asset('runelite.png'),tag:text.slice(0,40)});return true;}catch{return false;}}
  function testNotify(){const sent=desktopNotify('Test notification from the dashboard.',true);toast(sent?'Test notification sent to the browser.':'Test notification could not be sent. Check browser and system notification settings.');return sent;}
  window.atlasNotify={on:notifyOn,set:setNotify,status:notifyStatus,test:testNotify};
  let idleFor=null,idleAt=null,idleRun=0,idleTold=false,hpTold=false,lastFood=null,foodTold=false;
  // The food items in an account's pack, most first (item-stats.json says what heals).
  function foodOf(b){const by=new Map();for(const i of b?.inventory||[])if(i&&/\bheals\b/i.test(itemStats[i.name]||''))by.set(i.name,(by.get(i.name)||0)+(i.count||1));const items=[...by].map(([name,count])=>({name,count})).sort((x,y)=>y.count-x.count);return {items,total:items.reduce((n,i)=>n+i.count,0)};}
  function idleNotifier(b){
    if(!b||b.practice||b.name!==idleFor){idleFor=b&&!b.practice?b.name:null;idleAt=null;idleRun=0;idleTold=false;hpTold=false;lastFood=null;foodTold=false;}
    if(!b||b.practice||!b.fresh||!Number.isFinite(b.at)||idleAt!==null&&b.at<=idleAt)return;idleAt=b.at;
    const low=b.fresh&&b.hp?.max>0&&b.hp.now<=Math.ceil(b.hp.max/4);if(low&&!hpTold){hpTold=true;notify(safeName(b.name)+' has low hitpoints: '+b.hp.now+' / '+b.hp.max);desktopNotify(safeName(b.name)+' has low hitpoints!');}else if(!low)hpTold=false;
    // Low food: the pack goes from more than 2 food items to 2 or fewer.
    const food=foodOf(b).total;if(food<=2&&lastFood!==null&&lastFood>2&&!foodTold){foodTold=true;notify(safeName(b.name)+' is low on food: '+food+' left');desktopNotify(safeName(b.name)+' is low on food!');}else if(food>2)foodTold=false;lastFood=food;
    if(b.fresh&&b.action==='idle'){idleRun++;if(idleRun>=3&&!idleTold){idleTold=true;notify(safeName(b.name)+' is now idle!');desktopNotify(safeName(b.name)+' is now idle!');}}else{idleRun=0;idleTold=false;}
  }
  // Level-ups for every live account, in the game's words, as the chat shows them.
  const levelsSeen=new Map(),xpSeen=new Map(),lastGain=new Map();
  // The skill an account trains now: its latest XP gain, else its goal skill, else a role named after a skill.
  const trainedSkill=b=>lastGain.get(b.name)||b.goalSkill||skills.find(n=>n.toLowerCase()===String(b.role||'').toLowerCase())||null;
  // Deaths in the game's words; the deaths already on record when the page opens are not announced again.
  const deathsSeen=new Set();let deathsPrimed=false;
  function deaths(){for(const b of S.bots){if(b.practice||!b.death)continue;const key=b.name+'|'+b.death.at;if(deathsSeen.has(key))continue;deathsSeen.add(key);if(deathsPrimed){chat.push({kind:'Private',name:safeName(b.name),text:'Oh dear, you are dead!',at:b.death.at});renderChat();desktopNotify(safeName(b.name)+': Oh dear, you are dead!');shotFor(b,'death','Death');}}deathsPrimed=true;}
  // Logins, logouts and rank moves as chat lines (RuneLite's Friend List notifications). The state on record when the page opens is not announced. More than four logins or logouts in one snapshot make one line.
  const worldSeen=new Map(),rankSeen=new Map();let momentsPrimed=false;
  // Session summary on a logout line: while an account is in the world, its XP when this page first saw it in the world
  // (sessionXp) and its last uptime and loot (sessionLast). A logout line adds the session length, the skill with the
  // most XP gained and the top loot item with its GE value. A session that began before the page opened counts from
  // the page's first sight of it.
  const sessionXp=new Map(),sessionLast=new Map();
  function trackSession(b){
    if(!b.inWorld)return;
    const xp=Object.fromEntries((b.skills||[]).filter(k=>k&&k.name!=='Overall'&&Number.isFinite(k.xp)).map(k=>[k.name,k.xp]));
    if(!sessionXp.has(b.name))sessionXp.set(b.name,xp);
    sessionLast.set(b.name,{xp,uptime:b.uptime,loot:b.flow?.loot||[]});
  }
  function sessionText(name){
    const start=sessionXp.get(name),last=sessionLast.get(name);sessionXp.delete(name);sessionLast.delete(name);
    if(!start||!last)return '';
    const gains=Object.entries(last.xp).map(([k,v])=>[k,v-(start[k]??v)]).filter(([,d])=>d>0).sort((a,b)=>b[1]-a[1]);
    const top=[...last.loot].sort((a,b)=>(b.count||0)-(a.count||0))[0],price=n=>S?.economy?.itemValues?.[n]??(n==='Coins'?1:0);
    const value=last.loot.reduce((t,i)=>t+price(i.name)*(i.count||0),0);
    const parts=[gains[0]?'+'+nf(Math.round(gains[0][1]))+' '+gains[0][0]+' XP':'',top&&top.count>0?nf(top.count)+' '+top.name:'',value>=1?'≈ '+gp(Math.round(value))+' gp of loot':''].filter(Boolean);
    return (last.uptime?' after '+dur(last.uptime):'')+(parts.length?': '+parts.join(', '):'');
  }
  function moments(){let n=0;const say=(kind,text)=>{chat.push({kind,text,at:Date.now()});if(chat.length>200)chat.shift();n++;};
    const moved={in:[],out:[]};
    for(const b of S.bots){if(b.practice)continue;const was=worldSeen.get(b.name),is=!!b.inWorld;worldSeen.set(b.name,is);if(momentsPrimed&&was!==undefined&&was!==is)moved[is?'in':'out'].push(is?safeName(b.name):{name:safeName(b.name),text:sessionText(b.name)});else if(!is){sessionXp.delete(b.name);sessionLast.delete(b.name);}trackSession(b);}
    for(const [k,names] of Object.entries(moved)){if(names.length>4)say('Private',names.length+' accounts have logged '+k+'.');else for(const name of names)say('Private',typeof name==='string'?name+' has logged '+k+'.':name.name+' has logged out'+name.text+'.');}
    // A board's best rank is one account's; a move is announced for the same account, and another account taking the best
    // rank is its own line (comparing two accounts' ranks made lines such as "up from" another account's rank).
    for(const x of S.boards||[]){const r=x.best?.rank,who=x.best?.name;if(!r||!who)continue;const was=rankSeen.get(x.board);rankSeen.set(x.board,{r,who});if(!momentsPrimed||!was)continue;if(was.who===who){if(was.r!==r)say('Game',safeName(who)+' is now rank '+r+' on '+x.board+' ('+(r<was.r?'up':'down')+' from '+was.r+').');}else say('Game',safeName(who)+' now holds our best '+x.board+' rank: '+r+'.');}
    momentsPrimed=true;if(n)renderChat();}
  function levelUps(){
    for(const b of S.bots){if(b.practice||!Array.isArray(b.skills))continue;const prev=levelsSeen.get(b.name);const now={};for(const k of b.skills)now[k.name]=k.level;
      const xpBefore=xpSeen.get(b.name),xpNow={};let best=0;for(const k of b.skills.filter(realSkill)){xpNow[k.name]=k.xp;const d=xpBefore?.[k.name]!=null?k.xp-xpBefore[k.name]:0;if(d>best){best=d;lastGain.set(b.name,k.name);}}xpSeen.set(b.name,xpNow);
      if(prev)for(const [skill,lvl] of Object.entries(now))if(prev[skill]!=null&&lvl>prev[skill]&&skill!=='Overall'){chat.push({kind:'Game',name:safeName(b.name),text:`Congratulations, you've just advanced ${/^[AEIOU]/.test(skill)?'an':'a'} ${skill} level. Your ${skill} level is now ${lvl}.`,at:Date.now()});if(chat.length>200)chat.shift();renderChat();desktopNotify(safeName(b.name)+' advanced '+(/^[AEIOU]/.test(skill)?'an':'a')+' '+skill+' level: '+lvl);shotFor(b,'level','Level '+lvl+' '+skill);}
      levelsSeen.set(b.name,now);}
  }
  // XP globes (RuneLite): a ring of progress to the next level for each skill gained in the last ten seconds.
  const globeTimers=new Map();
  function xpGlobe(skill,xp){
    const X=window.atlasXp,box=hud.querySelector('.xp-globes');if(!X||!box)return;const lvl=X.levelForXp(xp),floor=X.xpForLevel(lvl),ceil=X.xpForLevel(Math.min(99,lvl+1)),p=lvl>=99?1:Math.min(1,(xp-floor)/Math.max(1,ceil-floor));
    let el=box.querySelector(`[data-globe="${skill}"]`);if(!el){el=document.createElement('div');el.className='xp-globe';el.dataset.globe=skill;el.innerHTML=`<img src="${asset('skill-'+skillFile(skill)+'.png')}" alt="">`;box.append(el);}
    el.style.setProperty('--p',Math.round(p*100)+'%');const b=account(),rate=b&&b.goalSkill===skill&&b.xpPerHour>0?b.xpPerHour:null;el.title=`${skill}: ${Math.round(p*100)}% to level ${Math.min(99,lvl+1)} (${nf(Math.max(0,ceil-xp))} xp left)${rate?` · ${nf(Math.round(rate))} XP/hr`:''}${guideText(skillGuide(skill,xp))}`;
    clearTimeout(globeTimers.get(skill));globeTimers.set(skill,setTimeout(()=>{el.remove();globeTimers.delete(skill);},10000));
  }
  // The hosted page's stale bar already reports old data, and the 3D view keeps its own live world feed.
  function screens(){const loading=hud.querySelector('#game-loading'),lost=hud.querySelector('#game-lost');if(loading&&S)loading.hidden=true;if(lost)lost.hidden=!(S&&!document.documentElement.classList.contains('fleet-stale')&&(typeof connected!=='undefined'&&!connected||typeof lastReceived!=='undefined'&&Date.now()-lastReceived>10000));}
  setInterval(screens,2000);
  // Map squares (map-squares/<mx>_<mz>.png, 4 px a tile): loaded as the view needs them, drawn when ready.
  const squares=new Map(),squareRetryAt=new Map();
  window.atlasSquare=(mx,mz)=>{
    const key=mx+'_'+mz;if(Date.now()<(squareRetryAt.get(key)||0))return null;let img=squares.get(key);
    if(!img){img=new Image();img.onload=()=>{squareRetryAt.delete(key);if(typeof drawMap==='function')drawMap();minimap();};img.onerror=()=>{squares.delete(key);squareRetryAt.set(key,Date.now()+(mz>57?600000:30000));/* North of the surface export most missing files mean no map data, so those retry rarely. */};img.src='map-squares/'+key+'.png';squares.set(key,img);}
    return img.complete&&img.naturalWidth?img:null;
  };
  // The 2D camera, the game's view: it follows the watched account at FOLLOW_PX a tile and flies to a new target;
  // the wheel zooms about the cursor and a drag pans, which lets go of the account (free camera).
  const FOLLOW_PX=5,MIN_PX=0.3,MAX_PX=10;
  const cam={cx:null,cz:null,ppt:null,tx:null,tz:null,tppt:null,user:false,userPpt:null,raf:0};
  function mapInfo(){return S?.map||{x0:2368,z0:2880,w:560,h:416,scale:2};}
  function camTarget(){
    const m=mapInfo(),b=account(),p=b&&(b.live||b.pos);
    if(p&&!window.atlasFreeCamera){cam.tx=p.x;cam.tz=p.z;cam.tppt=cam.userPpt||FOLLOW_PX;return;}
    const d=window.atlasDestination;if(d&&Number.isFinite(d.x)){cam.tx=d.x;cam.tz=d.z;cam.tppt=cam.userPpt||FOLLOW_PX;return;}
    if(cam.user&&cam.cx!=null){cam.tx=cam.cx;cam.tz=cam.cz;cam.tppt=cam.ppt;return;}
    cam.tx=m.x0+m.w*m.scale/2;cam.tz=m.z0+m.h*m.scale/2;cam.tppt=window.atlasFitPpt||1;
  }
  function camStep(){
    cam.raf=0;if(cam.tx==null)return;
    if(cam.cx==null){cam.cx=cam.tx;cam.cz=cam.tz;cam.ppt=cam.tppt;}
    else{const k=0.14;cam.cx+=(cam.tx-cam.cx)*k;cam.cz+=(cam.tz-cam.cz)*k;cam.ppt+=(cam.tppt-cam.ppt)*k;}
    const done=Math.abs(cam.tx-cam.cx)<0.05&&Math.abs(cam.tz-cam.cz)<0.05&&Math.abs(cam.tppt-cam.ppt)<0.002;
    if(done){cam.cx=cam.tx;cam.cz=cam.tz;cam.ppt=cam.tppt;}
    window.atlasCam={cx:cam.cx,cz:cam.cz,ppt:cam.ppt};
    if(typeof drawMap==='function')drawMap();
    if(!done)cam.raf=requestAnimationFrame(camStep);
  }
  function camUpdate(){camTarget();if(!cam.raf)cam.raf=requestAnimationFrame(camStep);}
  window.atlasCamera={goto(x,z){window.atlasFreeCamera=true;window.atlasDestination={x,z};cam.user=false;camUpdate();},reset(){window.atlasFreeCamera=true;cam.user=false;cam.userPpt=null;window.atlasDestination=null;camUpdate();},state:()=>({...cam})};
  {
    const map=document.getElementById('map');
    if(map){
      map.addEventListener('wheel',e=>{e.preventDefault();if(cam.ppt==null)return;const r=map.getBoundingClientRect(),m=mapInfo();
        const before=cam.ppt,after=Math.min(MAX_PX,Math.max(MIN_PX,before*Math.pow(1.0015,-e.deltaY)));
        // Keep the tile under the cursor where it is.
        const mx=e.clientX-r.left-r.width/2,mz=e.clientY-r.top-r.height/2;
        cam.cx+=mx/before-mx/after;cam.cz-=mz/before-mz/after;cam.ppt=after;cam.userPpt=after;cam.user=true;
        if(window.atlasFreeCamera||!account()){cam.tx=cam.cx;cam.tz=cam.cz;}cam.tppt=after;window.atlasCam={cx:cam.cx,cz:cam.cz,ppt:cam.ppt};drawMap();},{passive:false});
      let drag=null,dragged=false;
      map.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={x:e.clientX,z:e.clientY,cx:cam.cx,cz:cam.cz};dragged=false;map.setPointerCapture(e.pointerId);});
      map.addEventListener('pointermove',e=>{if(!drag||cam.ppt==null)return;const dx=e.clientX-drag.x,dz=e.clientY-drag.z;if(!dragged&&Math.hypot(dx,dz)<4)return;dragged=true;window.atlasFreeCamera=true;window.atlasDestination=null;cam.user=true;cam.cx=drag.cx-dx/cam.ppt;cam.cz=drag.cz+dz/cam.ppt;cam.tx=cam.cx;cam.tz=cam.cz;cam.tppt=cam.ppt;window.atlasCam={cx:cam.cx,cz:cam.cz,ppt:cam.ppt};drawMap();});
      map.addEventListener('pointerup',()=>{drag=null;if(dragged)refresh();});map.addEventListener('pointercancel',()=>{drag=null;});
      map.addEventListener('click',e=>{if(dragged){dragged=false;e.stopImmediatePropagation();}},true);
    }
  }
  window.atlasOverlay=()=>{if(S)overlay();};
  function accountChoices(){const choices=S.bots.filter(b=>!b.practice).map(b=>({name:b.name,inWorld:b.inWorld}));const following=window.atlasFollowOther;if(following&&!choices.some(b=>b.name===following))choices.push({name:following,inWorld:true,following:true});if(sel&&!choices.some(b=>b.name===sel))choices.push({name:sel,inWorld:false,missing:true});return choices;}
  // Restore the plugin at startup, then restore the account and camera with the first snapshot.
  let linkedPluginRestored=false;
  function restoreLinkedPlugin(){
    linkedPluginRestored=true;
    const id=new URLSearchParams(location.hash.slice(1)).get('p');
    if(!id||!rail.querySelector('[data-client-plugin="'+CSS.escape(id)+'"]'))return false;
    showPlugin(id);
    return true;
  }
  let linkRead=false,wall=null,wallLinked=false;
  function followLinkedAccount(){
    if(linkRead)return;linkRead=true;
    const q=new URLSearchParams(location.hash.slice(1)),name=q.get('a');
    const linked=S.bots.find(b=>b.name===name);
    if(linked)pick(linked.name);
    wallLinked=q.get('wall')==='1';wallLinkRead(q);
    const watch=q.get('watch');
    if(watch&&window.atlasFollow3d(watch,true))return;
    if(q.get('cam')==='free')focusFree(linked?.name);
  }
  function writeLink(){
    if(!linkedPluginRestored)return;
    const q=new URLSearchParams({p:selectedPlugin});
    if(linkRead){
      if(sel)q.set('a',sel);
      if(window.atlasFollowOther)q.set('watch',window.atlasFollowOther);
      else if(window.atlasFreeCamera)q.set('cam','free');
      if(wall||wallLinked)wallLinkWrite(q);
    }else{
      const pending=new URLSearchParams(location.hash.slice(1));
      for(const key of ['a','watch','cam','wall','wl','wm'])if(pending.has(key))q.set(key,pending.get(key));
    }
    const hash='#'+q;if(location.hash!==hash)history.replaceState(null,'',location.pathname+location.search+hash);
  }
  let questAccount=null;
  function refresh(){if(!S)return;followLinkedAccount();wallSync();writeLink();
    const b=account(),name=b?.name??null;
    if(name!==questAccount){questAccount=name;questDetail=null;}
    app.classList.toggle('public-view',!window.atlasOperator());if(body.firstElementChild?.hasAttribute('data-snapshot-loading'))renderSnapshotPlugin(selectedPlugin);syncNotifyControls();$('#client-more').hidden=!window.atlasOperator();hud.querySelector('.game-bank')?.refreshObservation?.();camUpdate();screens();minimap();xpDrops(b);overlay();chatFeed();idleNotifier(b);levelUps();deaths();moments();if(selectedPlugin==='xp')refreshXp();if(selectedPlugin==='boards'&&body.dataset.plugin==='boards'){const head=body.querySelector('.progress-head');if(head)put(head,boardSummary()+progressPanel());const rw=body.querySelector('.rivals-wrap');if(rw&&!rw.contains(document.activeElement))put(rw,rivalsPanel());refreshHiscoreAccount();}const data=body.querySelector('.info-data');if(data)put(data,infoData());if(selectedPlugin==='ge')refreshGe();if(selectedPlugin==='world'&&body.dataset.plugin==='world')refreshWorld();infoboxes();setText(title.querySelector('.connection'),$('#connection').textContent);focusPaint();warmPlaces();respawnSync();trackTrails();overlaySync();lootShots();welcomeCard();setText($('#chat-name'),(b?safeName(b.name):'Spectator')+':');
    const orbBox=hud.querySelector('.game-orbs'),orbHtml=!b?'':[['hp','Hitpoints',b.hp?.now,b.hp?.max],['prayer','Prayer',level('Prayer')?.currentLevel,level('Prayer')?.level],['run','Run energy',b.runEnergy,100]].filter(o=>o[2]!=null).map(([id,label,value,max])=>`<div class="game-orb orb-${id}" title="${label}: ${Math.floor(value)} / ${max}"><canvas class="orb-art" width="60" height="34" data-orb="${id}" data-frac="${value!=null&&max?Math.max(0,Math.min(1,value/max)):0}"></canvas><span class="orb-num" style="color:${orbColour(value,max)}">${Math.floor(value)}</span></div>`).join('');if(orbBox._h!==orbHtml){orbBox._h=orbHtml;orbBox.innerHTML=orbHtml;orbBox.querySelectorAll('canvas').forEach(drawOrb);}if(!(selectedTab==='settings'&&$('#game-panel').contains(document.activeElement)))gamePanel();}
  const previousRender=render;render=function(){previousRender();refresh();};
  const previousDrawMap=drawMap;drawMap=function(){previousDrawMap();minimap();};
  const previousPick=pick;pick=function(name){wallEnd(false);if(!touring)tourSet(false);const from=focusTarget(),b=S?.bots?.find(b=>b.name===name);previousPick(name);cam.user=false;if(mode==='2d'&&window.atlasFreeCamera&&b?.pos)window.atlasCamera.goto(b.pos.x,b.pos.z);focusMoved(from,name);refresh();};
  rail.onclick=e=>{const b=e.target.closest('[data-client-plugin]');if(b){showPlugin(b.dataset.clientPlugin);writeLink();}};
  $('#client-share').onclick=async()=>{writeLink();try{await navigator.clipboard.writeText(location.href);toast('Link copied.');}catch{toast('Copy this link from the address bar.');}};
  const togglePlugin=()=>{app.classList.toggle('client-collapsed');app.classList.toggle('mobile-plugin',!app.classList.contains('client-collapsed'));syncSidebar();};$('#client-sidebar').onclick=togglePlugin;plugin.querySelector('[aria-label="Close plugin"]').onclick=togglePlugin;
  $('#client-more').onchange=e=>{if(e.target.value)showPlugin(e.target.value);e.target.value='';};
  // The focus switcher: the one control for what the 3D camera watches. Every account click on the page ends in pick().
  const focus=title.querySelector('#client-focus'),focusNow=focus.querySelector('.focus-now'),focusName=focus.querySelector('.focus-name'),focusFind=focus.querySelector('.focus-find'),focusList=focus.querySelector('.focus-list'),wallButton=focus.querySelector('.focus-wall');
  const focusNote=document.createElement('div');focusNote.className='focus-note';focusNote.setAttribute('role','status');hud.append(focusNote);
  let focusShown='',focusRowsHtml='',focusNoteTimer=0,flightTo=null;
  const focusLive=()=>(S?.bots||[]).filter(b=>b.inWorld&&!b.practice).sort((a,b)=>a.name.localeCompare(b.name));
  const focusTarget=()=>window.atlasFollowOther||(window.atlasFreeCamera?null:sel)||null;
  function focusState(){
    const other=window.atlasFollowOther,b=S.bots.find(x=>x.name===sel);
    if(wall)return ['Wall · '+wall.shown+(phoneWidth.matches?'/'+wall.names.length:' of '+wall.names.length+' shown'),'wall','The fleet wall shows '+wall.names.length+' of our '+focusLive().length+' accounts in the world. Click a view to focus it; double click to follow that account.'];
    if(other)return [other,'on','The 3D camera follows this player, who is not one of our accounts.'];
    if(sel&&!window.atlasFreeCamera&&b?.inWorld)return [safeName(sel),'on','The 3D camera follows this account.'];
    if(b?.inWorld)return [safeName(sel),'idle','The camera is released. Choose this account again to follow it.'];
    if(sel)return [safeName(sel),'off','Not in the world. The camera stays where it is.'];
    return ['Free camera','free','The camera follows nobody.'];
  }
  function focusRows(){
    if(!S){
      focusList.innerHTML='<p class="focus-none" role="status">Waiting for fleet data…</p>';
      return;
    }
    const q=focusFind.value.trim().toLowerCase(),current=focusTarget(),choices=accountChoices().filter(c=>!q||safeName(c.name).toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name));
    const row=c=>{const b=S.bots.find(x=>x.name===c.name),on=c.name===(current||sel),note=c.following?'another player':c.missing?'no snapshot':c.inWorld?String(b?.phaseShort||b?.goal||'').slice(0,34):'';return '<button role="option" aria-selected="'+on+'" class="focus-row'+(on?' on':'')+(c.inWorld?' live':'')+'" data-focus="'+E(c.name)+'"'+(c.missing||c.following?' disabled':'')+'><i class="focus-dot"></i><span>'+E(safeName(c.name))+'</span><small>'+E(note)+'</small></button>';};
    const group=(label,rows)=>rows.length?'<h6>'+label+' · '+rows.length+'</h6>'+rows.map(row).join(''):'';
    const free=!current&&!sel,tourRow=focusLive().length>1?'<button class="focus-tour" data-tour>'+(tourTimer?'Stop the tour':'Tour the accounts')+'<small>'+(tourTimer?'stay here':'a new one every 45 s')+'</small></button>':'',html=(q?'':tourRow+'<button role="option" aria-selected="'+free+'" class="focus-row free'+(free?' on':'')+'" data-focus=""><i class="focus-dot"></i><span>Free camera</span><small>follow nobody</small></button>')+group('In the world',choices.filter(c=>c.inWorld))+group('Not in the world',choices.filter(c=>!c.inWorld));
    if(html===focusRowsHtml)return;focusRowsHtml=html;focusList.innerHTML=html||'<p class="focus-none">No account matches.</p>';
  }
  function focusPaint(){
    const [text,state,tip]=focusState(),key=text+'|'+state,live=focusLive();
    if(key!==focusShown){const swap=focusShown&&!focusShown.startsWith(text+'|');focusShown=key;focusName.textContent=text;focus.dataset.state=state;focusNow.title=tip+' Click to choose.';if(swap){focusName.classList.remove('swap');void focusName.offsetWidth;focusName.classList.add('swap');}}
    const stuck=!!wall||!live.length||live.length===1&&live[0].name===focusTarget();focus.querySelectorAll('.focus-step').forEach(b=>{b.disabled=stuck;});
    wallButton.hidden=mode!=='3d';wallButton.disabled=VIEWER.state!=='ready';wallButton.setAttribute('aria-pressed',String(!!wall));hud.classList.toggle('wall-on',!!wall);
    if(focus.classList.contains('open'))focusRows();
  }
  function focusOpen(open){focus.classList.toggle('open',open);focusNow.setAttribute('aria-expanded',String(open));if(open){focusFind.value='';focusRows();focusList.querySelector('.on')?.scrollIntoView({block:'nearest'});focusFind.focus({preventScroll:true});}else focusList.querySelector('.hot')?.classList.remove('hot');}
  function focusSay(text,ms){clearTimeout(focusNoteTimer);focusNote.textContent=text;focusNote.classList.add('on');focusNoteTimer=setTimeout(()=>{focusNote.classList.remove('on','flying');focus.classList.remove('flying');flightTo=null;},ms);}
  function focusLanded(){if(!flightTo)return;const name=flightTo;flightTo=null;focus.classList.remove('flying');focusNote.classList.remove('flying');focusSay('Now watching '+name,1400);}
  // The viewer holds the old view until the new place has loaded, then moves the camera.
  function focusMoved(from,name){
    if(mode!=='3d'||VIEWER.state!=='ready')return;
    const to=focusTarget(),shown=safeName(to||name);
    if(!to){flightTo=null;focus.classList.remove('flying');focusNote.classList.remove('flying');focusSay(shown+' is not in the world. The camera stays here.',2600);return;}
    if(to===from)return;
    flightTo=shown;focus.classList.add('flying');focusNote.classList.add('flying');focusSay('Flying to '+shown,15000);
  }
  const focusFree=(name=null)=>{sel=name;picked=true;window.atlasFreeCamera=true;window.atlasFollowOther=null;window.atlasDestination=null;rswFor=null;$('#rsw')?.contentWindow?.postMessage({atlasFreeCamera:true},location.origin);render();};
  // The viewer loads these places while it is idle, so a swap to them has nothing to wait for. The [ and ] neighbours come
  // first, and a row under the pointer goes before them. One place stands for the accounts in the same 32-tile cell.
  let warmSent='';
  const TOUR_MS=45000;
  function warmPlaces(first){
    if(wall||mode!=='3d'||VIEWER.state!=='ready')return;
    const live=focusLive(),now=focusTarget()||sel,i=live.findIndex(b=>b.name===now),order=[];
    if(first)order.push(live.find(b=>b.name===first));
    for(let d=1;d<=live.length;d++)order.push(live[(i+d)%live.length],live[(i-d+live.length*2)%live.length]);
    const cells=new Set(),places=[];
    for(const b of order){const p=b&&b.name!==now&&(b.live||b.pos);if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.z))continue;const cell=(p.x>>5)+','+(p.z>>5);if(!cells.has(cell)){cells.add(cell);places.push([p.x,p.z]);}}
    const key=[...cells].join(' ');if(key===warmSent)return;warmSent=key;
    $('#rsw').contentWindow?.postMessage({warm:places.slice(0,12)},location.origin);
  }
  // The tour moves the camera to the next account in the world every 45 s. Any choice of account or camera ends it.
  function tourStep(){if(globalThis.atlasFollowOther){tourSet(false);return;}if(document.hidden||mode!=='3d'||VIEWER.state!=='ready')return;touring=true;focusStep(1);touring=false;}
  function tourSet(on){clearInterval(tourTimer);tourTimer=on?setInterval(tourStep,TOUR_MS):null;focusRowsHtml='';if(on)tourStep();}
  function focusStep(step){if(window.atlasWallOn?.())return;const live=focusLive();if(!live.length)return;const i=live.findIndex(b=>b.name===(focusTarget()||sel));pick(live[i<0?(step>0?0:live.length-1):(i+step+live.length)%live.length].name);}
  function focusChoose(name){focusOpen(false);focusNow.focus({preventScroll:true});if(name)pick(name);else{wallEnd(false);tourSet(false);const from=focusTarget();focusFree();if(from)focusSay('Free camera',1400);}}
  focus.addEventListener('click',e=>{if(e.target.closest('.focus-wall')){wallToggle();return;}if(e.target.closest('[data-tour]')){focusOpen(false);wallEnd(false);tourSet(!tourTimer);return;}const s=e.target.closest('[data-focus-step]');if(s){focusOpen(false);focusStep(Number(s.dataset.focusStep));return;}if(e.target.closest('.focus-now')){focusOpen(!focus.classList.contains('open'));return;}const r=e.target.closest('[data-focus]');if(r&&!r.disabled)focusChoose(r.dataset.focus);});
  // Fleet wall: up to 16 of our accounts in the world, each in its own view of the one 3D viewer. A view needs the live
  // feed, so the page asks only for accounts in the world. It sends each name as it holds it: the hidden account is its mark.
  // The views are tiled like the windows of a tiling window manager. The viewer lays the views out and moves them. The
  // page chooses the layout, the main view, the order and the focused view, and draws a frame and a title strip over
  // each view from the rectangles the viewer reports.
  const WALL_MAX=16,WALL_NAME=/^[A-Za-z0-9_-](?:[A-Za-z0-9_ -]{0,10}[A-Za-z0-9_-])?$/;
  const WALL_LAYOUTS=['grid','main','focus','columns'],WALL_LAYOUT_NAMES={grid:'Grid',main:'Main and stack',focus:'Focus',columns:'Columns'};
  // Pixels between views, the colour there (the title bar's), the localStorage key, and the longest time between the
  // two clicks of a double click.
  const WALL_GAP=4,WALL_GAP_COLOUR='#1e1e1e',WALL_STORE='atlas-wall',WALL_DOUBLE_MS=450;
  window.atlasWallOn=()=>!!wall;
  const wallPost=message=>$('#rsw')?.contentWindow?.postMessage(message,VIEWER.origin);
  const wallIsName=n=>typeof n==='string'&&(n===MARK||WALL_NAME.test(n));
  const wallSame=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
  // No moves for a reader who asked the system for reduced motion: the viewer and the page then draw each change at once.
  const wallStill=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // The clock the viewer stamps a move with: milliseconds since the Unix epoch, with fractions.
  const wallClock=()=>performance.timeOrigin+performance.now();
  // Runs fn at the start of the next frame with that frame's time on the same clock. A CSS transition that starts in
  // that frame starts at that time, which is also the time the viewer draws its next frame for. A hidden tab has no
  // frames: fn then runs 120 ms later.
  function wallNextFrame(fn){let ran=false;const run=at=>{if(!ran){ran=true;fn(at);}};requestAnimationFrame(t=>run(performance.timeOrigin+t));setTimeout(()=>run(wallClock()),120);}
  // Playing accounts first, then the others in the world; each group in the order of the [ and ] steps.
  function wallNames(){
    const seen=new Set(),live=focusLive().filter(b=>(b.name===MARK||WALL_NAME.test(b.name))&&!seen.has(b.name.toLowerCase())&&seen.add(b.name.toLowerCase())),playing=b=>st(b)[1]==='playing';
    return [...live.filter(playing),...live.filter(b=>!playing(b))].slice(0,WALL_MAX).map(b=>b.name);
  }
  const wallKey=names=>names.map(n=>n.toLowerCase()).sort().join(',');
  // The names of `names` in the order of `first` where that list has them, then the others as they are.
  function wallOrdered(names,first){
    const left=names.slice(),head=[];
    for(const n of first){const i=left.findIndex(x=>wallSame(x,n));if(i>=0)head.push(left.splice(i,1)[0]);}
    return [...head,...left];
  }
  // The layout, the main view, a hand-made order, the sizes and the pinned views stay in this browser, and
  // the share link carries the layout and the main view (wl, wm). A stored or linked value that is not a layout or a name is dropped.
  // Row and column shares from storage: at most 16 numbers over 0 and up to 1 each, or none.
  const wallSharesOf=p=>{const list=v=>Array.isArray(v)&&v.length<=WALL_MAX&&v.every(n=>typeof n==='number'&&n>0&&n<=1)?v.slice():[];return {rows:list(p?.rows),cols:list(p?.cols)};};
  const wallPrefs={layout:'grid',main:null,order:[],ratio:0.62,locked:[],shares:{grid:wallSharesOf(),columns:wallSharesOf()},strip:0};
  function wallPrefsRead(text){
    let p;try{p=JSON.parse(text);}catch{return null;}
    if(!p||typeof p!=='object')return null;
    return {layout:WALL_LAYOUTS.includes(p.layout)?p.layout:'grid',main:wallIsName(p.main)?p.main:null,order:Array.isArray(p.order)?p.order.filter(wallIsName).slice(0,64):[],
      ratio:typeof p.ratio==='number'&&p.ratio>=0.5&&p.ratio<=0.8?p.ratio:0.62,locked:Array.isArray(p.locked)?p.locked.filter(wallIsName).slice(0,64).map(n=>n.toLowerCase()):[],
      shares:{grid:wallSharesOf(p.shares?.grid),columns:wallSharesOf(p.shares?.columns)},strip:typeof p.strip==='number'&&p.strip>=0.1&&p.strip<=0.45?p.strip:0};
  }
  try{Object.assign(wallPrefs,wallPrefsRead(localStorage.getItem(WALL_STORE)));}catch{/* no storage: the wall starts as a grid */}
  function wallLinkRead(q){const layout=q.get('wl'),main=q.get('wm');if(WALL_LAYOUTS.includes(layout))wallPrefs.layout=layout;if(wallIsName(main))wallPrefs.main=main;}
  function wallLinkWrite(q){q.set('wall','1');q.set('wl',wall?wall.layout:wallPrefs.layout);const main=wall?wall.main:wallPrefs.main;if(main)q.set('wm',main);}
  // After each choice: remember it and put it in the link.
  function wallKeep(){
    if(!wall)return;
    wallPrefs.layout=wall.layout;wallPrefs.main=wall.main;if(wall.ordered)wallPrefs.order=wall.names.slice();wallPrefs.ratio=wall.ratio;wallPrefs.locked=[...wall.locked];wallPrefs.shares=wall.shares;wallPrefs.strip=wall.strip;
    try{localStorage.setItem(WALL_STORE,JSON.stringify(wallPrefs));}catch{/* the choice lasts for this page only */}
    writeLink();wallPaint();
  }
  // The views in the order the layout places them: the main view first.
  const wallShown=()=>wall?[wall.main,...wall.names.filter(n=>n!==wall.main)]:[];
  const wallLocked=name=>!!wall&&wall.locked.has(String(name).toLowerCase());
  // The view next to view `from` in a direction: one that starts past the far edge of `from`. A view level with
  // `from` wins over one that is only diagonal; then the nearest; then the one whose centre is closest in line.
  function wallNeighbour(rects,from,dir){
    const a=rects[from];if(!a)return -1;
    const across=dir==='left'||dir==='right',back=dir==='left'||dir==='up';let best=-1,bestScore=Infinity;
    rects.forEach((b,i)=>{
      if(i===from||!b)return;
      const [a0,a1,b0,b1]=across?[a.x,a.x+a.w,b.x,b.x+b.w]:[a.y,a.y+a.h,b.y,b.y+b.h],[c0,c1,d0,d1]=across?[a.y,a.y+a.h,b.y,b.y+b.h]:[a.x,a.x+a.w,b.x,b.x+b.w];
      const gap=back?a0-b1:b0-a1;if(gap<-1)return;
      const score=(Math.min(c1,d1)-Math.max(c0,d0)>0?0:1e6)+gap*1000+Math.abs((c0+c1)/2-(d0+d1)/2);
      if(score<bestScore){bestScore=score;best=i;}
    });
    return best;
  }
  const wallNext=dir=>wall?.rects?wall.names[wallNeighbour(wall.rects,wall.names.indexOf(wall.focus),dir)]??null:null;
  // A viewer rectangle list is taken only whole: one rectangle for each asked name, in the asked order, inside 8192 px.
  function wallRects(list,names){
    if(!Array.isArray(list)||list.length!==names.length)return null;
    const out=[];
    for(let i=0;i<list.length;i++){
      const r=list[i];
      if(!r||typeof r!=='object'||typeof r.name!=='string'||r.name!==MARK&&!wallSame(r.name,names[i])||![r.x,r.y,r.w,r.h].every(v=>Number.isFinite(v)&&v>=-8192&&v<=8192)||r.w<0||r.h<0)return null;
      out.push({x:r.x,y:r.y,w:r.w,h:r.h});
    }
    return out;
  }
  function wallStart(){
    if(wall||mode!=='3d'||VIEWER.state!=='ready')return false;
    const names=wallOrdered(wallNames(),wallPrefs.order);
    if(!names.length){focusSay('None of our accounts is in the world. The wall has nothing to show.',3200);return false;}
    focusOpen(false);
    const main=names.find(n=>wallSame(n,wallPrefs.main))??names[0];
    // The wall keeps the page's follow state and the tour, and gives them back when it closes.
    wall={names,sent:wallKey(names),shown:0,tour:!!tourTimer,state:{sel,free:window.atlasFreeCamera,other:window.atlasFollowOther},
      layout:wallPrefs.layout,back:'grid',main,focus:main,ordered:wallPrefs.order.length>0,ratio:wallPrefs.ratio,locked:new Set(wallPrefs.locked),shares:{grid:wallSharesOf(wallPrefs.shares.grid),columns:wallSharesOf(wallPrefs.shares.columns)},strip:wallPrefs.strip,custom:false,rects:null,move:null,moving:false,seen:new Set(),offline:new Set(),hover:null,click:null};
    clearInterval(tourTimer);tourTimer=null;focusRowsHtml='';flightTo=null;focus.classList.remove('flying');focusNote.classList.remove('flying');
    window.atlasOpponentClear?.();
    // The layout goes first, so the views open in it.
    wallPost({multiChrome:false});
    wallPost({multiLayout:{mode:wall.layout,main,gap:WALL_GAP,...(wall.ratio!==WALL_RATIO?{ratio:wall.ratio}:{}),...wallSizes(wall.layout),color:WALL_GAP_COLOUR,animate:!wallStill()}});
    wallPost({multi:names});
    wallPost({multiFocus:main});
    wallButton.blur?.();
    focusSay('Fleet wall · drag a title to move a view, double click to follow · ? shows the keys',3600);
    wallPaint();
    return true;
  }
  // The viewer returns to its single view before any follow message: a follow sent to the wall moves its first view.
  // With restore, the page follows what it followed when the wall opened. Without, the caller chooses the next follow.
  function wallEnd(restore=true){
    if(!wall)return false;
    const w=wall,ready=mode==='3d'&&VIEWER.state==='ready';wallDragEnd(null,false);wallSizeEnd(null);wallEdgeEnd(null);wall=null;
    wallPaint();
    if(ready)wallPost({multi:[]});
    sentMaxLevel=null;warmSent='';rswFor=null;
    if(!restore)return true;
    sel=w.state.sel;window.atlasFreeCamera=w.state.free;window.atlasFollowOther=w.state.other;
    const to=focusTarget();
    if(ready&&to){wallPost({follow:to});if(!w.state.other)rswFor=sel;}
    else if(ready)wallPost({atlasFreeCamera:true});
    if(w.tour){clearInterval(tourTimer);tourTimer=setInterval(tourStep,TOUR_MS);focusRowsHtml='';}
    return true;
  }
  function wallToggle(){if(wall?wallEnd():wallStart())render();}
  // Each page update: open a wall that a link asked for, close a wall that lost the 3D view, and ask again when an
  // account enters or leaves the world. The same accounts are not asked for twice. The views that stay keep their
  // order, and a new view goes last. When the main or the focused view leaves, the next view in the order takes its place.
  function wallSync(){
    if(wallLinked&&mode==='3d'&&VIEWER.state==='ready'&&(window.atlasLiveRoster?.()||wallNames().length)){wallLinked=false;wallStart();}
    if(!wall)return;
    if(mode!=='3d'||VIEWER.state!=='ready'){wallEnd();return;}
    const now=wallNames();
    if(!now.length){wallEnd();focusSay('None of our accounts is in the world now. The wall is closed.',3200);return;}
    const key=wallKey(now);if(key===wall.sent){wallPaint();return;}
    const was=wall.names,before=wallShown(),plain=wallOrdered(now,was),heir=name=>{const i=was.indexOf(name);return [...was.slice(i+1),...was.slice(0,Math.max(i,0)).reverse()].find(n=>plain.includes(n))??plain[0];};
    const next=plain.includes(wall.main)?wall.main:heir(wall.main),held=wallHold([next,...plain.filter(n=>n!==next)],before),names=held??plain;
    const main=held?held[0]:next,to=names.includes(wall.focus)?wall.focus:heir(wall.focus);
    wall.names=names;wall.sent=key;wall.shown=Math.min(wall.shown,names.length);wall.rects=null;
    wallPost({multi:names});
    if(held)wallPost({multiOrder:names});
    if(main!==wall.main){wall.main=main;wallPost({multiLayout:{main}});}
    if(to!==wall.focus){wall.focus=to;wallPost({multiFocus:to});}
    wallKeep();
  }
  // The tiling commands. Each one is a message to the viewer, which moves the views.
  function wallFocus(name){if(!wall||!wall.names.includes(name)||wall.focus===name)return;wall.focus=name;wallPost({multiFocus:name});wallPaint();}
  // Leaves the wall and follows the account of one view. That view becomes the viewer's single view, so no flight follows.
  function wallOpen(name){
    if(!wall||!wall.names.includes(name))return;
    wallPost({multiFocus:name});
    pick(name);
    if(focusTarget()===name){flightTo=null;focus.classList.remove('flying');focusNote.classList.remove('flying');focusSay('Now watching '+safeName(name),1400);}
  }
  // Enter: the focused view becomes the main view. On the main view it follows that account.
  function wallPromote(){
    if(!wall)return;
    if(wall.main===wall.focus){wallOpen(wall.focus);return;}
    if(wallLocked(wall.main)||wallLocked(wall.focus)){focusSay('A pinned view keeps its place. Unpin it to move it.',2200);return;}
    wall.main=wall.focus;wallPost({multiLayout:{main:wall.main}});wallKeep();
  }
  // With zoom, the focused view becomes the main view of the new layout in the same move.
  function wallLayout(layout,zoom=false){
    if(!wall||!WALL_LAYOUTS.includes(layout)||layout===wall.layout)return;
    wallSizeEnd(null);wallEdgeEnd(null);
    const message={mode:layout,...wallSizes(layout)};
    if(zoom&&wall.main!==wall.focus&&!wallLocked(wall.main)&&!wallLocked(wall.focus)){wall.main=wall.focus;message.main=wall.main;}
    wall.back=wall.layout;wall.layout=layout;wallPost({multiLayout:message});
    focusSay('Wall layout · '+WALL_LAYOUT_NAMES[layout],1200);wallKeep();
  }
  function wallCycle(step=1){if(wall)wallLayout(WALL_LAYOUTS[(WALL_LAYOUTS.indexOf(wall.layout)+step+WALL_LAYOUTS.length)%WALL_LAYOUTS.length]);}
  // f: the focused view at full size over the others, and back to the layout before.
  function wallZoom(){if(!wall)return;if(wall.layout==='focus')wallLayout(wall.back==='focus'?'grid':wall.back);else wallLayout('focus',true);}
  // Two views change places. A view that takes the first place is the main view. A pinned view keeps its place.
  function wallTrade(a,b){
    if(!wall||a===b)return false;
    if(wallLocked(a)||wallLocked(b)){focusSay('A pinned view keeps its place. Unpin it to move it.',2200);return false;}
    const order=wallShown(),i=order.indexOf(a),j=order.indexOf(b);if(i<0||j<0)return false;
    [order[i],order[j]]=[order[j],order[i]];
    wall.names=order;wall.ordered=true;if(wall.rects)wall.rects=null;
    wallPost({multiOrder:order});
    if(order[0]!==wall.main){wall.main=order[0];wallPost({multiLayout:{main:wall.main}});}
    wallKeep();return true;
  }
  // Shift and a direction: the focused view and its neighbour change places.
  function wallSwap(dir){const to=wallNext(dir);if(to)wallTrade(wall.focus,to);}
  // p, or the pin on a title strip: the view keeps its place. No drag, swap or new main view moves it, and it goes
  // back to its place when other views open or close.
  function wallPin(name){
    if(!wall||!wall.names.includes(name))return;
    const key=name.toLowerCase(),on=!wall.locked.has(key);
    if(on)wall.locked.add(key);else wall.locked.delete(key);
    focusSay(safeName(name)+(on?' · pinned in its place':' · unpinned'),1400);wallKeep();
  }
  // The views in `names` (the order the layout places them) with each pinned view back at the place it had in `before`.
  // Null when no view of `names` is pinned.
  function wallHold(names,before){
    const held=names.filter(n=>wallLocked(n)&&before.includes(n)).sort((a,b)=>before.indexOf(a)-before.indexOf(b));
    if(!held.length)return null;
    const out=names.filter(n=>!held.includes(n));
    for(const n of held)out.splice(Math.min(before.indexOf(n),out.length),0,n);
    return out;
  }
  // Drag a title strip onto another view: the two views change places. A drag starts after 6 px, so a click stays a
  // click. A label follows the pointer and the view under it is marked.
  let wallDrag=null;
  function wallDragStart(e,name,t){
    if(!wall||e.button>0||e.target?.closest?.('button'))return;
    wallDrag={name,t,x:e.clientX,y:e.clientY,id:e.pointerId,on:false,over:null};
    t.strip.setPointerCapture?.(e.pointerId);
  }
  function wallDragOver(x,y){
    const frame=$('#rsw').getBoundingClientRect(),px=x-frame.left,py=y-frame.top;
    for(const [n,t] of wallTiles){const r=t.at;if(n!==wallDrag.name&&r&&px>=r.x&&px<r.x+r.w&&py>=r.y&&py<r.y+r.h)return n;}
    return null;
  }
  function wallDragMove(e){
    const d=wallDrag;if(!d||e.pointerId!==d.id||!wall)return;
    if(!d.on){
      if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<6)return;
      if(wallLocked(d.name)){wallDrag=null;focusSay('This view is pinned. Unpin it to move it.',2200);return;}
      d.on=true;wallGhost.textContent=safeName(d.name);wallGhost.hidden=false;wallRoot.classList.add('dragging');
    }
    const box=wallRoot.getBoundingClientRect();wallGhost.style.left=Math.round(e.clientX-box.left+12)+'px';wallGhost.style.top=Math.round(e.clientY-box.top+14)+'px';
    const over=wallDragOver(e.clientX,e.clientY);if(over!==d.over||!d.marked){d.over=over;d.marked=true;wallPaint();}
  }
  function wallDragEnd(e,drop){
    const d=wallDrag;if(!d||e&&e.pointerId!==d.id)return;
    wallDrag=null;wallGhost.hidden=true;wallRoot.classList.remove('dragging');
    if(!d.on)return;
    // The click that ends a drag is not a click on the view.
    d.t.dragged=true;setTimeout(()=>{d.t.dragged=false;},0);
    if(drop&&d.over&&wall&&!wallLocked(d.over)){wallFocus(d.name);wallTrade(d.name,d.over);}
    else{if(drop&&d.over&&wall)focusSay('That view is pinned. Unpin it to move it.',2200);wallPaint();}
  }
  // The gap between the main view and the stack in the Main and stack layout: drag it to give the main view 50 to 80
  // percent. It stops at the listed shares unless Alt is down.
  const WALL_RATIO=0.62,WALL_RATIOS=[0.5,WALL_RATIO,2/3,0.75,0.8];
  const wallRatioOf=v=>typeof v==='number'&&v>=0.5&&v<=0.8?Math.round(v*1000)/1000:WALL_RATIO;
  // The share for a pointer at `at` px along a frame of `size` px. `free` is true with Alt.
  function wallRatioAt(at,size,free){
    const raw=Math.min(Math.max((at-WALL_GAP/2)/Math.max(size-WALL_GAP,1),0.5),0.8),stop=free?null:WALL_RATIOS.find(s=>Math.abs(s-raw)<=0.012);
    return wallRatioOf(stop??raw);
  }
  // The gaps of the Grid and Columns layouts, and the gap over the strip of the Focus layout. A drag of a gap between
  // two rows or two columns moves it: the two neighbours share their space again and the others keep theirs. No row
  // or column goes under WALL_SHARE_MIN of an even one. The gap stops where the two neighbours are equal unless Alt is
  // down. A second press within the double click time gives the even sizes back.
  const WALL_SHARE_MIN=0.3,WALL_STRIP=[0.1,0.45];
  const wallEdges=[];let wallEdge=null;
  // The rows of the reported rectangles, top to bottom, each with its rectangles left to right.
  function wallRows(rects){
    const rows=[];
    for(const r of rects.slice().sort((a,b)=>a.y-b.y||a.x-b.x)){const last=rows[rows.length-1];if(last&&last.y===r.y)last.cells.push(r);else rows.push({y:r.y,h:r.h,cells:[r]});}
    return rows;
  }
  // The gaps a pointer can move in the current layout, from the reported rectangles. sizes: the px of every row, or
  // of every column of a full row, so a move changes two of them and keeps the sum.
  function wallGaps(){
    if(!wall?.rects||wall.names.length<2)return [];
    const out=[];
    if(wall.layout==='focus'){const m=wall.rects[wall.names.indexOf(wall.main)];if(m)out.push({kind:'strip',i:0,x:m.x,y:m.y+m.h,w:m.w,h:WALL_GAP});return out;}
    if(wall.layout!=='grid'&&wall.layout!=='columns')return out;
    const rows=wallRows(wall.rects),first=rows[0],n=first.cells.length,right=first.cells[n-1],full=rows.filter(r=>r.cells.length===n),bottom=full[full.length-1];
    for(let r=0;r<rows.length-1;r++)out.push({kind:'rows',i:r,x:first.cells[0].x,y:rows[r].y+rows[r].h,w:right.x+right.w-first.cells[0].x,h:WALL_GAP,sizes:rows.map(q=>q.h)});
    for(let c=0;c<n-1;c++)out.push({kind:'cols',i:c,x:first.cells[c].x+first.cells[c].w,y:first.y,w:WALL_GAP,h:bottom.y+bottom.h-first.y,sizes:first.cells.map(q=>q.w)});
    return out;
  }
  // The shares after the gap between parts i and i+1 of `sizes` moved by `by` px. `free` is true with Alt.
  function wallSharesAt(sizes,i,by,free){
    const total=sizes.reduce((a,b)=>a+b,0),pair=sizes[i]+sizes[i+1],min=Math.min(total*WALL_SHARE_MIN/sizes.length,pair/2);
    let a=Math.min(Math.max(sizes[i]+by,min),pair-min);
    if(!free&&Math.abs(a-pair/2)<=total*0.012)a=pair/2;
    const next=sizes.slice();next[i]=a;next[i+1]=pair-a;
    return next.map(v=>Math.round(v/total*10000)/10000);
  }
  // The sizes the viewer needs with a layout: the shares of that layout's rows and columns, and the strip. Nothing
  // when the viewer holds none and the layout has none.
  function wallSizes(layout){
    const s=wall.shares[layout]??{rows:[],cols:[]},any=s.rows.length>0||s.cols.length>0||wall.strip>0;
    if(!any&&!wall.custom)return {};
    wall.custom=any;return {rows:s.rows,cols:s.cols,strip:wall.strip||0};
  }
  const wallEdgeValue=kind=>kind==='strip'?{strip:wall.strip}:{[kind]:wall.shares[wall.layout]?.[kind]??[]};
  function wallEdgeEl(){
    const el=document.createElement('div');el.className='wall-grip wall-edge';el.hidden=true;el.title='Drag to size these views · press twice for even sizes';wallRoot.append(el);
    el.addEventListener('pointerdown',e=>wallEdgeStart(e,el));el.addEventListener('pointermove',wallEdgeMove);el.addEventListener('pointerup',wallEdgeEnd);el.addEventListener('pointercancel',wallEdgeEnd);el.addEventListener('lostpointercapture',wallEdgeEnd);
    return el;
  }
  function wallEdgeStart(e,el){
    const g=el.gap;if(!wall||!g||e.button>0)return;
    const now=Date.now(),on=wall.layout+g.kind+g.i,twice=el.pressed&&el.pressedOn===on&&now-el.pressed<=WALL_DOUBLE_MS;el.pressed=twice?0:now;el.pressedOn=on;
    if(twice){if(g.kind==='strip')wall.strip=0;else wall.shares[wall.layout][g.kind]=[];wallPost({multiLayout:wallEdgeValue(g.kind)});wallKeep();return;}
    wallEdge={el,id:e.pointerId,gap:g,down:g.kind==='cols'?e.clientX:e.clientY,frame:$('#rsw').getBoundingClientRect(),wait:false};
    el.setPointerCapture?.(e.pointerId);el.classList.add('sizing');wall.custom=true;
    // The views follow the pointer with no move of their own.
    wallPost({multiLayout:{animate:false}});
  }
  function wallEdgeMove(e){
    const d=wallEdge;if(!d||e.pointerId!==d.id||!wall)return;
    const g=d.gap,at=g.kind==='cols'?e.clientX:e.clientY;
    if(g.kind==='strip'){
      const share=Math.round(Math.min(Math.max((d.frame.top+d.frame.height-at-WALL_GAP/2)/Math.max(d.frame.height,1),WALL_STRIP[0]),WALL_STRIP[1])*1000)/1000;
      if(share===wall.strip)return;
      wall.strip=share;d.el.dataset.share=Math.round(share*100)+'%';d.el.pressed=0;
    }else{
      const shares=wallSharesAt(g.sizes,g.i,at-d.down,e.altKey===true);
      if(String(shares)===String(wall.shares[wall.layout][g.kind]))return;
      wall.shares[wall.layout][g.kind]=shares;d.el.pressed=0;d.el.dataset.share=Math.round(shares[g.i]*100)+' : '+Math.round(shares[g.i+1]*100);
    }
    if(!d.wait){d.wait=true;const kind=g.kind;requestAnimationFrame(()=>{d.wait=false;if(wall)wallPost({multiLayout:wallEdgeValue(kind)});});}
  }
  function wallEdgeEnd(e){
    const d=wallEdge;if(!d||e&&e.pointerId!==d.id)return;
    wallEdge=null;d.el.classList.remove('sizing');
    if(wall){wallPost({multiLayout:{...wallEdgeValue(d.gap.kind),animate:!wallStill()}});wallKeep();}
  }
  let wallSize=null;
  function wallSizeTo(ratio){
    if(!wall||ratio===wall.ratio)return;
    wall.ratio=ratio;wallGrip.dataset.share=Math.round(ratio*100)+'%';if(wallSize)wallGrip.pressed=0;
    if(wallSize&&!wallSize.wait){wallSize.wait=true;requestAnimationFrame(()=>{if(wallSize)wallSize.wait=false;if(wall)wallPost({multiLayout:{ratio:wall.ratio}});});}
    else if(!wallSize)wallPost({multiLayout:{ratio}});
  }
  function wallSizeStart(e){
    if(!wall||wall.layout!=='main'||e.button>0)return;
    // A second press within the double click time gives the first share back.
    const now=Date.now(),twice=wallGrip.pressed&&now-wallGrip.pressed<=WALL_DOUBLE_MS;wallGrip.pressed=twice?0:now;
    if(twice){wallSizeTo(WALL_RATIO);wallKeep();return;}
    wallSize={id:e.pointerId,wait:false};wallGrip.setPointerCapture?.(e.pointerId);wallGrip.classList.add('sizing');wallGrip.dataset.share=Math.round(wall.ratio*100)+'%';
    // The views follow the pointer with no move of their own.
    wallPost({multiLayout:{animate:false}});
  }
  function wallSizeMove(e){
    if(!wallSize||e.pointerId!==wallSize.id||!wall)return;
    const frame=$('#rsw').getBoundingClientRect(),across=wallGrip.dataset.side!=='row';
    wallSizeTo(wallRatioAt(across?e.clientX-frame.left:e.clientY-frame.top,across?frame.width:frame.height,e.altKey===true));
  }
  function wallSizeEnd(e){
    if(!wallSize||e&&e.pointerId!==wallSize.id)return;
    wallSize=null;wallGrip.classList.remove('sizing');
    if(wall){wallPost({multiLayout:{ratio:wall.ratio,animate:!wallStill()}});wallKeep();}
  }
  const WALL_DIRS={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',h:'left',j:'down',k:'up',l:'right',H:'left',J:'down',K:'up',L:'right'};
  // The keys of the wall, from the page and from the viewer frame. True when the key was one of them.
  function wallPress(key,shift){
    if(!wall)return false;
    const dir=WALL_DIRS[key];
    if(dir){if(shift)wallSwap(dir);else{const to=wallNext(dir);if(to)wallFocus(to);}return true;}
    if(key==='Enter'){wallPromote();return true;}
    if(key===' '){wallCycle(shift?-1:1);return true;}
    if(key==='f'||key==='F'){wallZoom();return true;}
    if(key==='p'||key==='P'){wallPin(wall.focus);return true;}
    if(key==='?'){wallHelp();return true;}
    if(/^[1-9]$/.test(key)){const name=wallShown()[Number(key)-1];if(name)wallFocus(name);return true;}
    return false;
  }
  // The viewer's replies. The status gives the views that show their player. The layout gives the rectangle of each
  // view. A click gives a view number: the page focuses the name it asked for in that view, and a second click on the
  // same view follows that account through pick(). Text in a reply never becomes a name.
  function wallMessage(data){
    if(!wall)return;
    const list=v=>Array.isArray(v)&&v.length<=WALL_MAX&&v.every(n=>typeof n==='string'&&n.length<=12),m=data.viewerMulti;
    if(m&&typeof m==='object'&&list(m.names)&&list(m.shown)&&m.names.length===wall.names.length&&m.shown.length<=m.names.length){
      const own=v=>new Set(list(v)?wall.names.filter(n=>v.some(x=>x===n||wallSame(x,n))):[]);
      wall.seen=own(m.shown);wall.offline=own(m.offline);
      if(m.shown.length!==wall.shown){wall.shown=m.shown.length;focusPaint();}
      wallPaint();
    }
    const l=data.viewerMultiLayout;
    if(l&&typeof l==='object'&&typeof l.animating==='boolean'&&Number.isFinite(l.ms)&&l.ms>=0&&l.ms<=1000&&Number.isFinite(l.at)){
      const rects=wallRects(l.rects,wall.names);
      if(rects){
        wall.rects=rects;wall.move={ms:l.animating?l.ms:0,at:l.at};
        // The last report before a frame is the one that frame shows.
        if(!wall.moving){wall.moving=true;const w=wall;wallNextFrame(now=>{w.moving=false;if(wall===w)wallPaint(w.move,now);});}
      }
    }
    if(Number.isInteger(data.viewerMultiHover)){const name=wall.names[data.viewerMultiHover]??null;if(name!==wall.hover){wall.hover=name;wallPaint();}}
    const k=data.atlasWallKey;
    if(k&&typeof k==='object'&&typeof k.key==='string'&&k.key.length<=10&&k.key!=='\\'&&k.key!=='Escape')wallPress(k.key,k.shift===true);
    const picked=data.viewerMultiPick,name=Number.isInteger(data.index)?wall.names[data.index]:null;
    if(typeof picked!=='string'||!name||picked!==MARK&&picked.toLowerCase()!==name.toLowerCase())return;
    wallClick(name);
  }
  // A click on a view or on its title strip focuses the view. A second click on the same view within WALL_DOUBLE_MS
  // follows that account.
  function wallClick(name){
    const now=Date.now(),twice=wall.click&&wall.click.name===name&&now-wall.click.at<=WALL_DOUBLE_MS;
    wall.click=twice?null:{name,at:now};
    if(twice)wallOpen(name);else wallFocus(name);
  }
  // The page's frames over the viewer: one element for each view, with a title strip. Only the strip takes the
  // pointer, so a click in a view reaches the viewer. An element moves with a CSS transition of the viewer's own time
  // and curve, started as far in as the viewer's move already is. The transition is of left, top, width, height and a
  // registered custom property for the fade: the browser runs these in the page's own frames, so the start is the
  // frame it was set in. (A transform or opacity transition starts when the compositor takes it, which can be a frame
  // later.)
  const wallRoot=document.createElement('div');wallRoot.className='wall-chrome';hud.append(wallRoot);
  const wallGhost=document.createElement('div');wallGhost.className='wall-ghost';wallGhost.hidden=true;
  const wallGrip=document.createElement('div');wallGrip.className='wall-grip';wallGrip.hidden=true;wallGrip.title='Drag to size the main view · press twice for the first size';
  wallRoot.append(wallGrip,wallGhost);
  wallGrip.addEventListener('pointerdown',wallSizeStart);wallGrip.addEventListener('pointermove',wallSizeMove);wallGrip.addEventListener('pointerup',wallSizeEnd);wallGrip.addEventListener('pointercancel',wallSizeEnd);wallGrip.addEventListener('lostpointercapture',wallSizeEnd);
  const wallTiles=new Map(),wallIcon={grid:'M1 1h4.5v4.5H1zM6.5 1H11v4.5H6.5zM1 6.5h4.5V11H1zM6.5 6.5H11V11H6.5z',main:'M1 1h5.5v10H1zM7.5 1H11v2.7H7.5zM7.5 4.65H11v2.7H7.5zM7.5 8.3H11V11H7.5z',focus:'M1 1h10v6.5H1zM1 8.5h2.7V11H1zM4.65 8.5h2.7V11h-2.7zM8.3 8.5H11V11H8.3z',columns:'M1 1h2.7v10H1zM4.65 1h2.7v10h-2.7zM8.3 1H11v10H8.3z'};
  const wallSvg=path=>'<svg viewBox="0 0 12 12" aria-hidden="true"><path d="'+path+'"/></svg>';
  function wallTile(name){
    const make=(tag,cls)=>{const e=document.createElement(tag);e.className=cls;return e;};
    const t={el:make('div','wall-tile'),strip:make('div','wall-strip'),dot:make('i','wall-dot'),name:make('b','wall-name'),note:make('span','wall-note'),num:make('span','wall-num'),pin:make('button','wall-pin'),open:make('button','wall-open')};
    t.pin.innerHTML=wallSvg('M4 1h4v1l-.8.8v2.4L9.5 7v1H6.6v3L6 12l-.6-1V8H2.5V7l2.3-1.8V2.8L4 2z');
    t.pin.title='Pin this view in its place · p';t.pin.setAttribute('aria-label','Pin this view in its place');t.pin.setAttribute('aria-pressed','false');
    t.open.innerHTML=wallSvg('M7 1h4v4h-1.5V3.56L6.56 6.5 5.5 5.44 8.44 2.5H7zM1 3h4v1.5H2.5v5h5V7H9v4H1z');
    t.open.title='Follow this account and leave the wall';t.open.setAttribute('aria-label','Follow this account');
    t.strip.append(t.dot,t.name,t.note,t.num,t.pin,t.open);t.el.append(t.strip);
    t.strip.addEventListener('click',e=>{if(t.dragged){t.dragged=false;return;}if(e.target.closest?.('.wall-open'))wallOpen(name);else if(e.target.closest?.('.wall-pin'))wallPin(name);else if(wall)wallClick(name);});
    t.strip.addEventListener('pointerdown',e=>wallDragStart(e,name,t));t.strip.addEventListener('pointermove',wallDragMove);
    t.strip.addEventListener('pointerup',e=>wallDragEnd(e,true));t.strip.addEventListener('pointercancel',e=>wallDragEnd(e,false));t.strip.addEventListener('lostpointercapture',e=>wallDragEnd(e,false));
    return t;
  }
  // With `move` (the time and the start of the viewer's move, 0 ms for none) the frames go to the reported rectangles;
  // `now` is the time of the frame that starts the transition. Without `move` only the text and the marks of each
  // frame are brought up to date.
  function wallPaint(move,now=wallClock()){
    wallTools.hidden=!wall;
    if(!wall){
      // The frames fade while the viewer returns to its single view.
      for(const t of wallTiles.values()){if(wallStill())t.el.remove();else{t.el.style.transition='opacity .16s';t.el.style.opacity='0';setTimeout(()=>t.el.remove(),200);}}
      wallTiles.clear();wallGrip.hidden=true;wallGhost.hidden=true;for(const el of wallEdges)el.hidden=true;return;
    }
    for(const b of wallLayoutButtons)b.setAttribute('aria-pressed',String(b.dataset.wallLayout===wall.layout));
    if(wallCycleButton.dataset.wallShows!==wall.layout){wallCycleButton.dataset.wallShows=wall.layout;wallCycleButton.innerHTML=wallSvg(wallIcon[wall.layout]);wallCycleButton.title='Layout: '+WALL_LAYOUT_NAMES[wall.layout]+' · Space for the next';}
    const still=!move||!(move.ms>0)||wallStill(),delay=still?'':'-'+Math.round(Math.min(Math.max(now-move.at,0),move.ms))+'ms';
    let dx=0,dy=0;
    // A frame at a rectangle, or shrunk about its centre as the viewer shrinks a view that opens or closes.
    const put=(s,r,k=1)=>{const w=Math.round(r.w*k),h=Math.round(r.h*k);s.left=(r.x+dx+Math.round((r.w-w)/2))+'px';s.top=(r.y+dy+Math.round((r.h-h)/2))+'px';s.width=w+'px';s.height=h+'px';};
    if(move){
      const frame=$('#rsw').getBoundingClientRect(),box=wallRoot.getBoundingClientRect();dx=Math.round(frame.left-box.left);dy=Math.round(frame.top-box.top);
      wallRoot.classList.toggle('still',still);if(!still)wallRoot.style.setProperty('--wall-ms',move.ms+'ms');
      // A frame whose view closed shrinks and fades as the view does.
      for(const [name,t] of wallTiles)if(!wall.names.includes(name)){
        wallTiles.delete(name);
        if(still)t.el.remove();else{t.el.classList.add('out');t.el.style.transitionDelay=delay;put(t.el.style,t.at,.6);t.el.style.setProperty('--wall-fade','0');setTimeout(()=>t.el.remove(),move.ms+80);}
      }
    }
    const shown=wallShown();
    wall.names.forEach((name,i)=>{
      const r=wall.rects?.[i];let t=wallTiles.get(name);
      if(move&&r){
        const s=(t??(t=wallTile(name))).el.style;
        if(!wallTiles.has(name)){
          wallTiles.set(name,t);wallRoot.append(t.el);
          // A new frame grows and fades in at its place, as its view does.
          if(!still){s.transition='none';put(s,r,.6);s.setProperty('--wall-fade','0');void t.el.offsetWidth;s.transition='';}
        }
        s.transitionDelay=delay;put(s,r);s.setProperty('--wall-fade','1');t.at=r;
      }
      if(!t)return;
      const b=S.bots.find(x=>x.name===name),place=shown.indexOf(name)+1;
      const state=wall.offline.has(name)?'off':!wall.seen.has(name)?'finding':b&&st(b)[1]==='playing'?'on':'idle';
      const note=state==='off'?'not online':state==='finding'?'finding…':String(b?.phaseShort||b?.goal||(b?.combat?'level-'+b.combat:'')).slice(0,40);
      const locked=wallLocked(name),drag=wallDrag?.on?wallDrag:null;
      const cls='wall-tile'+(name===wall.focus?' wall-focus':'')+(name===wall.main?' wall-main':'')+(name===wall.hover?' wall-hover':'')+(locked?' wall-locked':'')+(drag?.name===name?' wall-drag':'')+(drag&&drag.over===name?(locked?' wall-nodrop':' wall-drop'):'');
      if(t.pin.getAttribute('aria-pressed')!==String(locked)){t.pin.setAttribute('aria-pressed',String(locked));t.pin.title=locked?'Pinned in its place · p to unpin':'Pin this view in its place · p';}
      if(t.el.className!==cls)t.el.className=cls;
      if(t.dot.className!=='wall-dot '+state)t.dot.className='wall-dot '+state;
      const label=safeName(name);if(t.name.textContent!==label)t.name.textContent=label;
      if(t.note.textContent!==note)t.note.textContent=note;
      const num=place<=9?String(place):'';if(t.num.textContent!==num)t.num.textContent=num;
    });
    // The grip lies on the gap between the main view and the stack: to the right of the main view, or under it.
    const m=wall.layout==='main'&&wall.names.length>1?wall.rects?.[wall.names.indexOf(wall.main)]:null,other=m&&wall.rects.find(r=>r!==m);
    if(move&&m&&other){
      const row=other.y>=m.y+m.h,g=wallGrip.style;wallGrip.dataset.side=row?'row':'col';
      if(row){g.left=(m.x+dx)+'px';g.top=(m.y+m.h+dy-3)+'px';g.width=m.w+'px';g.height=(WALL_GAP+6)+'px';}
      else{g.left=(m.x+m.w+dx-3)+'px';g.top=(m.y+dy)+'px';g.width=(WALL_GAP+6)+'px';g.height=m.h+'px';}
      wallGrip.hidden=false;
    }else if(!m&&!wallSize)wallGrip.hidden=true;
    // One grip on each gap between rows and between columns, and one over the strip.
    if(move){
      const gaps=wallGaps();
      gaps.forEach((g,k)=>{
        const el=wallEdges[k]??(wallEdges[k]=wallEdgeEl()),s=el.style,col=g.kind==='cols';el.gap=g;el.dataset.side=col?'col':'row';
        s.left=(g.x+dx-(col?3:0))+'px';s.top=(g.y+dy-(col?0:3))+'px';s.width=(col?WALL_GAP+6:g.w)+'px';s.height=(col?g.h:WALL_GAP+6)+'px';el.hidden=false;
      });
      for(let k=gaps.length;k<wallEdges.length;k++)if(wallEdges[k]!==wallEdge?.el){wallEdges[k].hidden=true;wallEdges[k].gap=null;}
    }
  }
  // The layout switcher and the key list, in the title bar's focus group after the Wall button. A narrow title bar
  // shows one button that steps through the layouts.
  const wallButtonOf=(cls,label,title,html)=>{const b=document.createElement('button');b.className=cls;b.setAttribute('aria-label',label);b.title=title;b.innerHTML=html;return b;};
  const wallTools=document.createElement('span');wallTools.className='wall-tools';wallTools.hidden=true;wallTools.setAttribute('role','group');wallTools.setAttribute('aria-label','Wall layout');
  const wallLayoutButtons=WALL_LAYOUTS.map(l=>{const b=wallButtonOf('wall-layout',WALL_LAYOUT_NAMES[l]+' layout',WALL_LAYOUT_NAMES[l]+(l==='focus'?' · f':'')+' · Space for the next layout',wallSvg(wallIcon[l]));b.dataset.wallLayout=l;b.setAttribute('aria-pressed','false');return b;});
  const wallCycleButton=wallButtonOf('wall-cycle','Next wall layout','',''),wallHelpButton=wallButtonOf('wall-help-button','Wall keys','Wall keys · ?','?');
  wallTools.append(...wallLayoutButtons,wallCycleButton,wallHelpButton);wallButton.after(wallTools);
  // The wall's keys are in the Info plugin with the other controls; the ? button and the ? key open them there.
  function wallHelp(){if(wall)window.atlasWallKeys?.();}
  wallTools.addEventListener('click',e=>{
    const b=e.target.closest?.('button');if(!b||!wall)return;
    e.stopPropagation();b.blur?.();
    if(b.dataset.wallLayout)wallLayout(b.dataset.wallLayout);else if(b===wallCycleButton)wallCycle();else wallHelp();
  });
  // A wall key pressed in the viewer frame arrives as a message. \ opens or closes the wall and Escape closes it, as
  // on the page; the other keys go through wallMessage while the wall is open.
  function wallFrameKey(k){
    if(!k||typeof k!=='object')return;
    if(k.key==='\\'){if(!wallButton.hidden&&!wallButton.disabled)wallToggle();}
    else if(k.key==='Escape'&&wallEnd())render();
  }
  // A change between the 3D view and the 2D map shows or hides the button at once, and closes an open wall.
  const previousSetMode=setMode;setMode=function(m,preserve){previousSetMode(m,preserve);if(S){wallSync();focusPaint();}};
  const follow3d=window.atlasFollow3d;window.atlasFollow3d=(name,allowLoading)=>{wallEnd(false);return follow3d(name,allowLoading);};
  focusFind.addEventListener('input',focusRows);
  focusList.addEventListener('pointerover',e=>{const r=e.target.closest('[data-focus]');if(r&&r.dataset.focus&&!r.disabled)warmPlaces(r.dataset.focus);});
  focusFind.addEventListener('keydown',e=>{const rows=[...focusList.querySelectorAll('.focus-row:not([disabled])')],hot=focusList.querySelector('.hot');if(e.key==='Escape'){e.stopPropagation();focusOpen(false);focusNow.focus({preventScroll:true});}else if(e.key==='Enter'){e.preventDefault();const r=hot||rows[0];if(r)focusChoose(r.dataset.focus);}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!rows.length)return;const i=rows.indexOf(hot),next=rows[i<0?(e.key==='ArrowDown'?0:rows.length-1):(i+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length];hot?.classList.remove('hot');next.classList.add('hot');next.scrollIntoView({block:'nearest'});}});
  document.addEventListener('pointerdown',e=>{if(!focus.contains(e.target))focusOpen(false);});
  const WELCOME_KEY='atlas-welcomed',tourAsked=new URLSearchParams(location.search).get('tour')==='1';
  let welcomeDone=false;
  function welcomeCard(){
    if(welcomeDone||mode!=='3d'||VIEWER.state!=='ready')return;welcomeDone=true;
    if(tourAsked){tourSet(true);return;}
    if(window.atlasOperator())return;
    try{if(localStorage.getItem(WELCOME_KEY))return;localStorage.setItem(WELCOME_KEY,'1');}catch{/* private window: the card shows on each visit */}
    const card=document.createElement('div');card.className='visitor-card';card.setAttribute('role','dialog');card.setAttribute('aria-label','About this page');
    card.innerHTML='<h2>Watch our bots play, live</h2><p>This is a live game world on the rs-sdk demo server. Gold names are our bot team, climbing the hiscores. Everyone else is another player.</p><p>The arrows in the title bar swap to the next account.</p><div><button data-card="tour">Tour the accounts</button><button data-card="boards">See the hiscores</button><button data-card="close">Just watch</button></div>';
    card.onclick=e=>{const a=e.target.closest('[data-card]')?.dataset.card;if(!a)return;card.remove();if(a==='tour')tourSet(true);if(a==='boards')showPlugin('boards');};
    hud.append(card);
  }
  function toast(text){hud.querySelector('.game-toast')?.remove();const el=document.createElement('div');el.className='game-toast';el.textContent=text;hud.append(el);setTimeout(()=>el.remove(),5000);}
  hud.addEventListener('input',e=>{if(!e.target.matches('[data-quest-search]'))return;questQuery=e.target.value;gamePanel();});
  body.addEventListener('click',e=>{if(e.target.closest('[data-notify-test]'))testNotify();if(e.target.closest('[data-notify-cancel]'))void setNotify(false);});
  hud.onclick=e=>{const t=e.target.closest('[data-game-tab]');if(t){if(t.dataset.gameTab===selectedTab)hud.classList.toggle('game-panel-hidden');else{selectedTab=t.dataset.gameTab;hud.classList.remove('game-panel-hidden');gamePanel();enter($('#game-panel'));}}const c=e.target.closest('[data-chat]');if(c){const k=c.dataset.chat;if(chatOff.has(k))chatOff.delete(k);else chatOff.add(k);const on=!chatOff.has(k),s=c.querySelector('small');c.setAttribute('aria-pressed',String(on));s.textContent=on?'On':'Off';s.className=on?'':'off';renderChat();}if(e.target.closest('.chat-toggle,[data-toggle-chat]'))hud.classList.toggle('chat-hidden');const to3d=msg=>$('#rsw')?.contentWindow?.postMessage(msg,location.origin);if(e.target.closest('.minimap-compass')){if(typeof mode!=='undefined'&&mode==='3d')to3d({atlasCompass:true});else toast('The 2D map always faces north.');}if(e.target.closest('[data-viewer-worldmap]')){to3d({atlasOpenWorldMap:true});placesBox.hidden=true;}else if(e.target.closest('[data-places]')){placesBox.hidden=!placesBox.hidden;placesBox.querySelector('[data-viewer-worldmap]').hidden=!(typeof mode!=='undefined'&&mode==='3d');}else if(!e.target.closest('.game-places'))placesBox.hidden=true;const p=e.target.closest('[data-open-plugin]');if(p)showPlugin(p.dataset.openPlugin);if(e.target.closest('.game-logout')){selectedTab='logout';hud.classList.remove('game-panel-hidden');gamePanel();}if(e.target.closest('[data-logout]')){if(window.FleetShim?.signedIn?.())window.FleetShim.signOut();else toast('Nothing to log out of: this is the spectator view.');}if(e.target.closest('.game-xp'))showPlugin('xp');const a=e.target.closest('[data-view-action]');if(a)toast(a.dataset.viewAction+' · spectator view; no game input sent');const q=e.target.closest('[data-quest]');if(q){questDetail=q.dataset.quest;gamePanel();}const fr=e.target.closest('[data-friend]');if(fr){pick(fr.dataset.friend);}if(e.target.closest('[data-quest-back]')){questDetail=null;gamePanel();}const qf=e.target.closest('[data-quest-filter]');if(qf){questFilter=qf.dataset.questFilter;gamePanel();}const qs=e.target.closest('[data-quest-scope]');if(qs){questScope=qs.dataset.questScope;questDetail=null;questFilter='all';gamePanel();}const sk=e.target.closest('[data-skill]');if(sk){const st=level(sk.dataset.skill);toast(sk.dataset.skill+(st?' · Level '+st.level+(st.xp!=null?' · '+st.xp.toLocaleString()+' XP':''):' · not reported by this game'));}};
  body.addEventListener('submit',e=>{if(e.target.id==='hs-form'){e.preventDefault();lookup(e.target.querySelector('#hs-name').value);return;}const f=e.target.closest('.goal-request');if(!f)return;e.preventDefault();const text=f.text.value.trim();if(!text)return;if(!window.atlasCommand){notify('The command desk is not loaded.');return;}f.querySelector('button').disabled=true;window.atlasCommand('request',{text}).then(r=>{notify('request: '+String(r?.status||'sent').replaceAll('-',' '));f.text.value='';},err=>notify('Refused: '+(err?.message||err))).finally(()=>{f.querySelector('button').disabled=false;});});
  body.addEventListener('change',e=>{if(e.target.matches?.('[data-mark-colour]')){markColour=e.target.value;return;}const sc=e.target.dataset?.shotCfg;if(sc&&sc in shotCfg){shotCfg[sc]=sc==='loot'?Number(e.target.value)||0:e.target.checked;saveShotCfg();return;}if(e.target.matches?.('[data-calc-target]')){const v=Number(e.target.value);calcTarget=Number.isInteger(v)?Math.max(2,Math.min(99,v)):null;refreshXp();return;}const hk=e.target.dataset?.hl;if(hk&&hk in hl){hl[hk]=e.target.checked;saveHl();overlaySync(true);return;}if(e.target.matches?.('[data-hl-min]')){hl.groundMin=Number(e.target.value)||0;saveHl();overlaySync(true);return;}if(e.target.id==='rival-board'){rivalBoard=e.target.value;const w=body.querySelector('.rivals-wrap');if(w)w.innerHTML=rivalsPanel();return;}if(e.target.dataset.notify!==undefined){void setNotify(e.target.checked);}});
  body.addEventListener('input',e=>{if(e.target.id==='ge-search'){geQuery=e.target.value;refreshGe();}if(e.target.id==='hs-name'){hiscoreName=e.target.value.trim();hiscoreSel=sel;refreshHiscoreAccount();}});
  hud.addEventListener('change',e=>{if(e.target.matches?.('[data-setup-kit]')){setupKit=e.target.value;try{localStorage.setItem('atlas-setup-kit',setupKit);}catch{/* private window */}gamePanel();}});
  hud.addEventListener('click',e=>{const dth=e.target.closest('.infobox[data-death]');if(dth){loadRecap(dth.dataset.death);showPlugin('activity');return;}const f=e.target.closest('.infobox[data-xp-focus]');if(f){pick(f.dataset.xpFocus);}});
  body.addEventListener('input',e=>{if(e.target.matches?.('[data-finder]')){finderQuery=e.target.value.slice(0,40);finderPick=null;finderPlayer=null;loadSpawns();finderResults();overlaySync(true);minimap();}});
  body.addEventListener('focusin',e=>{if(e.target.matches?.('[data-finder]'))loadSpawns();});
  body.addEventListener('click',e=>{const bp=e.target.closest('[data-best-pin]');if(bp){const b=account(),k=b?.skills?.find(x=>x.name===calcSkill),s=k?bestSpot(b,calcSkill,window.atlasXp.levelForXp(k.xp)):null;if(s){const key='best|'+s.name;sourcePin=sourcePin?.key===key?null:{key,label:s.name,tip:s.name+' (level '+s.level+')',tiles:s.tiles};finderPick=null;finderPlayer=null;overlaySync(true);minimap();refreshXp();if(sourcePin)toast('Shown in pink on the minimap and in the 3D view.');}return;}const pin=e.target.closest('[data-src-pin]');if(pin&&geOpen){const j=Number(pin.dataset.srcPin),src=itemSourcesData?.[geOpen]?.[j];if(src){const key=geOpen+'|'+j;sourcePin=sourcePin?.key===key?null:{key,label:geOpenName+': '+src[1].replace(/ ·.*$/,''),tip:geOpenName+' · '+src[1],tiles:flatTiles(src[2])};finderPick=null;finderPlayer=null;overlaySync(true);minimap();refreshGe();if(sourcePin)toast('Shown in pink on the minimap and in the 3D view.');}return;}
    const gs=e.target.closest('[data-ge-sort]');if(gs){geSort=gs.dataset.geSort;refreshGe();return;}
    const gr=e.target.closest('[data-ge-src]');if(gr){geOpen=geOpen===gr.dataset.geSrc?null:gr.dataset.geSrc;geOpenName=gr.dataset.geName||'';refreshGe();return;}},true);
  body.addEventListener('click',e=>{const mk=e.target.closest('[data-mark-here],[data-mark-del],[data-mark-go],[data-mark-clear],[data-finder-pick],[data-finder-player],[data-finder-clear],[data-finder-go]');if(mk){const d=mk.dataset,b=account(),p=b?.live||b?.pos;
      if('markHere' in d){if(p)toggleMark(p.x,p.z,p.level||0);}else if('markDel' in d){marks.splice(Number(d.markDel),1);saveMarks();marksChanged();}else if('markClear' in d){marks=[];saveMarks();marksChanged();}
      else if('markGo' in d||'finderGo' in d){const [x,z]='markGo' in d?[marks[Number(d.markGo)]?.x,marks[Number(d.markGo)]?.z]:d.finderGo.split(',').map(Number);if(Number.isInteger(x)&&Number.isInteger(z)){if(typeof mode!=='undefined'&&mode==='3d')toast('In 3D, drag the view to move the camera.');else window.atlasCamera.goto(x,z);}}
      else if('finderPlayer' in d){finderPlayer=d.finderPlayer.toLowerCase();finderPick=null;sourcePin=null;finderResults();overlaySync(true);minimap();}else if('finderPick' in d){finderPick=d.finderPick;finderPlayer=null;sourcePin=null;finderResults();overlaySync(true);minimap();}else if('finderClear' in d){finderPick=null;finderPlayer=null;finderResults();overlaySync(true);minimap();}
      return;}
    const sh=e.target.closest('[data-shot]');if(sh){const s=shots.find(x=>x.id===sh.dataset.shot);if(s){let v=document.querySelector('.shot-view');if(!v){v=document.createElement('div');v.className='shot-view';v.addEventListener('click',()=>v.remove());document.body.append(v);}v.innerHTML='<img alt=""><p></p>';v.querySelector('img').src=s.url;v.querySelector('p').textContent=safeName(s.name)+' · '+s.text+' · '+new Date(s.at).toLocaleString();}return;}const lk=e.target.closest('[data-lookup]');if(lk){lookup(lk.dataset.lookup);return;}const fw=e.target.closest('[data-world-follow]');if(fw){const name=fw.dataset.worldFollow,ours=S.bots.find(b=>b.name.toLowerCase()===name.toLowerCase()&&!b.practice),from=focusTarget();if(ours)pick(ours.name);else if(window.atlasFollow3d?.(name))focusMoved(from,name);else toast('The 3D view is not ready, so the camera cannot watch a player.');return;}if(e.target.closest('[data-ge-all]')){geAll=!geAll;refreshGe();return;}const hm=e.target.closest('[data-hs-mode]');if(hm){hiscoresMode=hm.dataset.hsMode;hiscores();return;}if(e.target.closest('[data-xp-reset]')){const store=xpStore();delete store[sel];saveXpStore(store);refreshXp();}if(e.target.closest('[data-xp-pause]')){const store=xpStore(),b=account(),base=b&&store[b.name];if(base){if(base.paused){const gap=Date.now()-base.paused.at;base.at+=gap;for(const k of b.skills||[])if(typeof k.xp==='number'&&base.paused.xp[k.name]!=null)base.xp[k.name]=(base.xp[k.name]??base.paused.xp[k.name])+(k.xp-base.paused.xp[k.name]);delete base.paused;}else base.paused={at:Date.now(),xp:Object.fromEntries((b.skills||[]).map(k=>[k.name,k.xp]))};saveXpStore(store);}refreshXp();}const hm2=e.target.closest('[data-xp-hide-maxed]');if(hm2){xpHideMaxed=hm2.checked;refreshXp();}if(e.target.closest('[data-calc-close]')){calcSkill=null;refreshXp();return;}const cs=e.target.closest('[data-calc-skill]');if(cs&&!e.target.closest('input')){calcSkill=cs.dataset.calcSkill===calcSkill?null:cs.dataset.calcSkill;calcTarget=null;refreshXp();return;}const xs=e.target.closest('[data-xp-sort]');if(xs){xpSort=xs.dataset.xpSort;refreshXp();return;}const f=e.target.closest('[data-xp-focus]');if(f){pick(f.dataset.xpFocus);showPlugin('xp');}});
  hud.onchange=e=>{if(e.target.id==='game-display'){app.classList.toggle('client-collapsed',e.target.value==='closed');app.classList.toggle('mobile-plugin',e.target.value!=='closed');syncSidebar();}if(e.target.id==='game-quality'){$('#atlas-quality').value=e.target.value;$('#atlas-quality').onchange();}if(e.target.id==='game-roofs')window.atlasSetRoofsOff(e.target.value==='off');};
  hud.addEventListener('contextmenu',e=>{const cell=e.target.closest('[data-item],[data-equipment]');if(!cell)return;e.preventDefault();const b=account(),it=cell.dataset.item!==undefined?b?.inventory?.[Number(cell.dataset.item)]:b?.equipment?.find(i=>i.slot===Number(cell.dataset.equipment));if(!it)return;context?.remove();context=document.createElement('div');context.className='game-context';context.style.left=Math.min(e.clientX,innerWidth-220)+'px';context.style.top=Math.min(e.clientY,innerHeight-110)+'px';const worn=cell.dataset.equipment!==undefined,n=String(it.name),verb=worn?'Remove':/\b(sword|axe|bow|dagger|mace|staff|scimitar|pickaxe|harpoon|rod|net|hammer|chisel|knife|spear|halberd|whip|wand|crossbow|blade|club|warhammer)\b/i.test(n)?'Wield':/\b(helm|hat|cape|amulet|body|chainbody|platebody|platelegs|plateskirt|legs|boots|gloves|shield|ring|coif|robe|hood|vambraces|chaps|mask|kiteshield|sq shield|necklace)\b/i.test(n)?'Wear':/\b(potion|brew|beer|wine|tea|milk|juice|water)\b/i.test(n)?'Drink':/\b(bread|cake|pie|stew|fish|shark|lobster|trout|salmon|tuna|swordfish|shrimps|anchovies|sardine|herring|pike|cod|bass|meat|chicken|kebab|pizza|cheese|apple|banana|bananas|peach|onion|tomato|cabbage|potato|egg|monkfish)\b/i.test(n)?'Eat':null;
    const options=worn?[['Remove',null]]:[['Use',null],...(verb?[[verb,null]]:[]),['Drop',null]];
    context.innerHTML='<strong>Choose Option</strong>'+options.map(([o])=>'<button data-view-action="'+E(o)+'">'+E(o)+' <span>'+E(n)+'</span></button>').join('')+'<button data-examine>Examine <span>'+E(n)+'</span></button><button data-cancel>Cancel</button>';context.onclick=e=>{if(e.target.closest('[data-examine]')){const p=price(n),desc=S.economy?.itemExamine?.[n];notify((desc||n)+(p&&!/^coins$/i.test(n)?' Price of '+(it.count>1?nf(it.count)+' x ':'')+n+': '+gp(Math.round(p.value*(it.count||1)))+' gp'+(it.count>1?' ('+nf(Math.round(p.value))+' each)':'')+'.':''));}else{const v=e.target.closest('[data-view-action]');if(v)toast(v.dataset.viewAction+' · spectator view; no game input sent');}context.remove();};document.body.append(context);});
  document.addEventListener('click',e=>{if(context&&!context.contains(e.target))context.remove();});
  const map=document.getElementById('map');
  if(map)map.addEventListener('contextmenu',e=>{
    const r=map.getBoundingClientRect();let best=null,bd=400;for(const [x,z,n] of map._p||[]){const d=(x-(e.clientX-r.left))**2+(z-(e.clientY-r.top))**2;if(d<bd){bd=d;best=n;}}
    if(!best){let other=null,od=200;for(const [x,z,n] of map._q||[]){const d=(x-(e.clientX-r.left))**2+(z-(e.clientY-r.top))**2;if(d<od){od=d;other=n;}}if(!other)return;e.preventDefault();context?.remove();context=document.createElement('div');context.className='game-context';context.style.left=Math.min(e.clientX,innerWidth-220)+'px';context.style.top=Math.min(e.clientY,innerHeight-80)+'px';context.innerHTML='<strong>Choose Option</strong><button data-act="lookup">Look up <span>'+E(other)+'</span></button><button data-act="cancel">Cancel</button>';context.onclick=ev=>{const act=ev.target.closest('[data-act]')?.dataset.act;context.remove();if(act==='lookup')lookup(other);};document.body.append(context);return;}
    e.preventDefault();const b=S.bots.find(x=>x.name===best);if(!b)return;context?.remove();
    const held=!!b.hold||b.operation==='paused';
    context=document.createElement('div');context.className='game-context';context.style.left=Math.min(e.clientX,innerWidth-220)+'px';context.style.top=Math.min(e.clientY,innerHeight-150)+'px';
    context.innerHTML='<strong>Choose Option</strong><button data-act="account">Account <span>'+E(safeName(best))+'</span></button><button data-act="lookup">Look up <span>'+E(safeName(best))+'</span></button><button data-act="xp">XP Tracker <span>'+E(safeName(best))+'</span></button>'+(b.reserved||b.remote||!window.atlasOperator()?'':'<button data-act="'+(held?'account-release':'account-pause')+'">'+(held?'Resume':'Pause')+' <span>'+E(safeName(best))+'</span></button>')+'<button data-act="examine">Examine <span>'+E(safeName(best))+'</span></button><button data-act="cancel">Cancel</button>';
    context.onclick=ev=>{const act=ev.target.closest('[data-act]')?.dataset.act;context.remove();if(!act||act==='cancel')return;
      if(act==='account'){pick(best);showPlugin('account');}else if(act==='xp'){pick(best);showPlugin('xp');}else if(act==='lookup')lookup(best);
      else if(act==='examine')notify(safeName(best)+' · '+(b.goal||b.role||'')+(b.phaseShort?' · '+b.phaseShort:'')+' · seen '+age(b.at)+' ago');
      else if(window.atlasCommand){notify('Sending '+act+' '+best+'…');window.atlasCommand(act,{account:best}).then(r=>notify(act+': '+String(r?.status||'sent').replaceAll('-',' ')),err=>notify('Refused: '+(err?.message||err)));}
      else notify('The command desk is not loaded.');};
    document.body.append(context);
  });
  hud.querySelector('form').onsubmit=e=>{e.preventDefault();const input=e.currentTarget.querySelector('input'),text=input.value.trim();input.value='';if(!text)return;if(text.startsWith('::plugin ')){const id=text.slice(9).trim();const usable=plugins.filter(p=>window.atlasOperator()||!(OPERATOR_PLUGINS.includes(p[0])||PUBLIC_HIDDEN.includes(p[0])));if(usable.some(p=>p[0]===id))showPlugin(id);else notify('Unknown plugin. Use '+usable.map(p=>p[0]).join(', ')+'.');}else if(text.startsWith('::focus ')){const name=text.slice(8).trim(),b=S?.bots.find(b=>b.name.toLowerCase()===name.toLowerCase());if(b)pick(b.name);else notify('No observed account matches that name.');}else if(/^::(request|pause|resume|help|swarm|job|coordinator)\b/.test(text)){
      const [,verb,rest='']=text.match(/^::(\w+)\s*(.*)$/)||[];
      if(verb==='help'){notify(window.atlasOperator()?'Commands: !lvl <skill> · !total · !qp · !cmb · !price <item> · ::request <text> · ::pause <account> · ::resume <account> · ::job <account> on|off · ::swarm pause|resume · ::coordinator pause|resume · ::plugin <id> · ::focus <account>':'Commands: !lvl <skill> · !total · !qp · !cmb · !price <item> · ::plugin <id> · ::focus <account>. Sign in as owner for ::request, ::pause, ::resume, ::job, ::swarm and ::coordinator.');return;}
      if(!window.atlasOperator()){notify('Sign in as owner to send commands.');return;}
      if(!window.atlasCommand){notify('The command desk is not loaded.');return;}
      let send=null;
      if(verb==='request')send=rest?{action:'request',extra:{text:rest.slice(0,500)}}:null;
      else if(verb==='swarm')send=/^(pause|resume)$/.test(rest)?{action:'swarm-'+rest,extra:{}}:null;
      else if(verb==='coordinator')send=/^(pause|resume)$/.test(rest)?{action:rest,extra:{}}:null;
      else if(verb==='job'){const m=rest.match(/^([A-Za-z0-9]{1,12})\s+(on|off)$/);send=m?{action:m[2]==='on'?'job-enable':'job-disable',extra:{account:m[1]}}:null;}
      else send=rest&&/^[A-Za-z0-9]{1,12}$/.test(rest)?{action:verb==='pause'?'account-pause':'account-release',extra:{account:rest}}:null;
      if(!send){notify(verb==='request'?'::request needs the request text.':verb==='swarm'||verb==='coordinator'?'::'+verb+' pause or ::'+verb+' resume.':verb==='job'?'::job <account> on or off.':'::'+verb+' needs an account name.');return;}
      notify('Sending '+send.action+(send.extra.account?' '+send.extra.account:'')+'…');
      window.atlasCommand(send.action,send.extra).then(r=>notify(send.action+': '+String(r?.status||'sent').replaceAll('-',' ')),e=>notify('Refused: '+(e?.message||e)));
    }else if(/^!(lvl|level|total|qp|cmb|price)\b/i.test(text)){const reply=chatLookup(text);chat.push({kind:'Game',name:'',text:reply,at:Date.now()});if(chat.length>200)chat.shift();renderChat();}
    else notify('Chat is view-only in spectator mode. Commands: !lvl <skill> · !total · !qp · !cmb · !price <item> · ::plugin · ::focus · ::help');};
  // Chat commands (RuneLite chatcommands): !lvl <skill>, !total, !qp and !cmb answer for the followed account in the
  // chat, with the level and its demo hiscore rank.
  // !price <item> (RuneLite chatcommands): the market's ask, bid and stock for an item, or its value when the market has no offer.
  function priceLine(q){q=q.trim().toLowerCase();if(!q)return 'Usage: !price <item>, for example !price cannonball.';const all=(S?.economy?.supplies||[]).filter(x=>x.name),n=x=>String(x.name).toLowerCase(),hit=all.find(x=>n(x)===q)||all.find(x=>n(x).startsWith(q))||all.find(x=>n(x).includes(q)),gp=v=>v==null?'none':nf(Math.round(v))+' gp';
    const ha=name=>{const h=typeof alchOf==='function'?alchOf(name):null;return h?' · high alch '+gp(h):'';};
    if(hit)return hit.name+': ask '+gp(hit.ask)+' · bid '+gp(hit.bid)+(hit.stock!=null?' · '+nf(hit.stock)+' in stock':'')+ha(hit.name)+'.';
    const v=Object.entries(S?.economy?.itemValues||{}).find(([k])=>k.toLowerCase()===q);if(v)return v[0]+': value '+gp(v[1])+ha(v[0])+' · no market offer.';
    const a=typeof itemAlch==='object'?Object.keys(itemAlch).find(k=>k.toLowerCase()===q):null;return a&&ha(a)?a+ha(a).replace(' · ',': ')+' · no market offer.':'No price for '+q+'.';}
  function chatLookup(text){if(/^!price\b/i.test(text))return priceLine(text.replace(/^!price\s*/i,''));const b=account();if(!b)return 'Follow an account first (title bar or ::focus <name>).';const [cmd,...rest]=text.slice(1).toLowerCase().split(/\s+/),arg=rest.join(' '),who=safeName(b.name),rank=board=>b.ranks?.find(r=>r.board===board),fmt=(board,level)=>{const r=rank(board);return level+(r?.rank?' · rank #'+nf(r.rank):'');};
    if(cmd==='cmb'){const lv=Object.fromEntries((b.skills||[]).map(s=>[s.name,s.level])),c=window.atlasXp?.combat?.(lv);return c?who+': combat level '+c.level+'.':who+': no levels reported.';}
    if(cmd==='qp'){const r=rank('Quest Points');return who+': '+(r?r.level+' quest points'+(r.rank?' · rank #'+nf(r.rank):''):'quest points not reported')+'.';}
    if(cmd==='total'){const t=b.skills?.filter(realSkill).reduce((n,s)=>n+s.level,0);return t?who+': total level '+fmt('Overall',t)+'.':who+': no levels reported.';}
    const alias={att:'Attack',atk:'Attack',def:'Defence',str:'Strength',hp:'Hitpoints',range:'Ranged',ranging:'Ranged',pray:'Prayer',mage:'Magic',cook:'Cooking',wc:'Woodcutting',fletch:'Fletching',fish:'Fishing',fm:'Firemaking',craft:'Crafting',smith:'Smithing',mine:'Mining',herb:'Herblore',agil:'Agility',thiev:'Thieving',rc:'Runecraft'};
    const skill=alias[arg]||skills.find(n=>n.toLowerCase()===arg||n.toLowerCase().startsWith(arg)&&arg.length>=3);if(!skill)return 'Usage: !lvl <skill>, for example !lvl mining.';const s=level(skill);return s?who+': '+skill+' level '+fmt(skill,s.level)+'.':who+': '+skill+' is not reported.';}
  // Opponent information (RuneLite opponentinfo): the followed account's target in the 3D view, with its name, combat
  // level (npc-names.json, from the server's npc configs) and hitpoints; it stays 5 seconds after combat ends.
  // One shared table load; while it loads, only the newest update draws, into the one box.
  // An NPC opponent's route-item drops (client-assets/npc-drops.json), most likely first, under its hitpoints. The keys
  // are lower case: npc-names.json says "Black Demon" where the drop table says "Black demon".
  let npcNames=null,npcNamesLoad=null,opponentHide=0,opponentLatest=null,npcDrops=null;
  fetch(asset('npc-drops.json')).then(r=>r.ok?r.json():null).then(j=>{if(j&&typeof j==='object')npcDrops=Object.fromEntries(Object.entries(j).map(([k,v])=>[k.toLowerCase(),v]));},()=>{});
  // The box belongs to the viewer that sent it: a viewer reload (a new follow) or the 2D map clears it at once.
  function opponentClear(){opponentLatest=null;clearTimeout(opponentHide);const el=hud.querySelector('.game-opponent');if(el)el.hidden=true;}
  window.atlasOpponentClear=opponentClear;$('#rsw')?.addEventListener('load',opponentClear);
  async function opponentBox(o){
    opponentLatest=o;
    if(!o){clearTimeout(opponentHide);opponentHide=setTimeout(()=>{const el=hud.querySelector('.game-opponent');if(el)el.hidden=true;},5000);return;}
    clearTimeout(opponentHide);
    if(o.kind==='npc'&&!npcNames){npcNamesLoad??=fetch(asset('npc-names.json'),{signal:AbortSignal.timeout(5000)}).then(r=>r.ok?r.json():null).catch(()=>null).finally(()=>{npcNamesLoad=null;});npcNames=await npcNamesLoad;if(opponentLatest!==o)return;}
    const [cur,max]=o.hp,npc=o.kind==='npc'?npcNames?.[o.type]:null,name=o.kind==='player'?String(o.name).slice(0,12):npc?.[0]??'Unknown npc',lvl=npc?.[1];
    let el=hud.querySelector('.game-opponent');if(!el){el=document.createElement('div');el.className='game-opponent';el.setAttribute('aria-live','polite');hud.append(el);}
    el.hidden=false;el.innerHTML='<b>'+E(name)+(lvl?' <small>(level-'+lvl+')</small>':'')+'</b><div class="opponent-hp"><i style="width:'+Math.max(0,Math.min(100,Math.round(cur/Math.max(1,max)*100)))+'%"></i><span>'+cur+' / '+max+'</span></div>'+(()=>{const d=o.kind==='npc'?npcDrops?.[String(name).toLowerCase()]:null;return d?.length?'<div class="opponent-drops">'+d.slice(0,4).map(([n,c])=>E(n)+' <small>'+E(c)+'</small>').join(' · ')+'</div>':'';})();
  }
  window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==$('#rsw').contentWindow||!e.data||typeof e.data!=='object')return;if(e.data?.viewerTiming&&!wall)focusLanded();wallMessage(e.data);wallFrameKey(e.data.atlasWallKey);if(e.data.viewerCapture)shotReply(e.data.viewerCapture);if(e.data.atlasDepleted&&Array.isArray(e.data.atlasDepleted.list)){depletedNow={tick:Number(e.data.atlasDepleted.tick)||0,list:e.data.atlasDepleted.list.slice(0,500),at:Date.now()};if(selectedPlugin==='world'&&body.dataset.plugin==='world')refreshWorld();}if(e.data?.viewerState&&S){wallSync();focusPaint();}if(e.data?.atlasStep===1||e.data?.atlasStep===-1)focusStep(e.data.atlasStep);if(e.data?.atlasRoster)window.atlasRosterIn(e.data.atlasRoster);if(e.data&&'atlasOpponent' in e.data){const o=e.data.atlasOpponent;if(o?.kind==='npc'&&Number.isInteger(o.type)){const who=account()?.name??null;if(who!==targetsFor){targetsFor=who;recentTargets=[];}if(!recentTargets.includes(o.type)){recentTargets=[o.type,...recentTargets].slice(0,3);overlaySync();}}opponentBox(o&&Array.isArray(o.hp)&&o.hp.length===2&&o.hp.every(Number.isFinite)&&(o.kind==='npc'?Number.isInteger(o.type):typeof o.name==='string')?o:null);}const c3=e.data?.atlasCamera3d;if(c3&&[c3.x,c3.z,c3.yaw].every(Number.isFinite)){window.atlasCam3d={x:c3.x,z:c3.z,yaw:c3.yaw,at:Date.now()};minimap();}const m=e.data?.atlasChat;if(typeof e.data?.atlasWorldMap==='boolean')hud.classList.toggle('worldmap-open',e.data.atlasWorldMap);if(!m||typeof m.text!=='string'||typeof m.name!=='string'||typeof m.key!=='string'||seenChat.has(m.key))return;seenChat.add(m.key);if(seenChat.size>500)seenChat.delete(seenChat.values().next().value);chat.push({kind:'Public',name:m.name.slice(0,32),text:m.text.slice(0,500),at:Date.now()});if(chat.length>200)chat.shift();renderChat();});
  const gameKeys=e=>{
    if(e.key==='Tab'&&e.target===document.body)e.stopPropagation();
    if((e.key==='['||e.key===']')&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();focusStep(e.key===']'?1:-1);}
    if(e.key==='\\'&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)&&!wallButton.hidden&&!wallButton.disabled){e.preventDefault();wallToggle();}
    // The wall's keys. Enter and Space on a button or a link stay that control's own.
    if(window.atlasWallOn?.()&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)&&!(/^(?:BUTTON|A|SUMMARY)$/.test(e.target.tagName)&&(e.key==='Enter'||e.key===' '))&&wallPress(e.key,e.shiftKey)){e.preventDefault();e.stopPropagation();return;}
    if(e.key==='Escape'){if(focus.classList.contains('open'))focusOpen(false);if(wallEnd())render();context?.remove();hud.querySelector('.game-bank')?.remove();hud.querySelector('.game-toast')?.remove();}
    const F_KEYS={F2:'skills',F3:'quests',F4:'inventory',F5:'equipment',F8:'friends',F10:'settings'};
    if(F_KEYS[e.key]&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();e.stopPropagation();selectedTab=F_KEYS[e.key];hud.classList.remove('game-panel-hidden');gamePanel();}
    if(e.key==='/'&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();e.stopPropagation();showPlugin('fleet');($('#op-fleet-search')||$('#search'))?.focus();}
  };
  window.addEventListener('keydown',gameKeys,true);
  const gameFrame=$('#rsw');
  function releaseCamera(){
    if(mode!=='3d'||window.atlasFreeCamera)return;
    tourSet(false);
    window.atlasFreeCamera=true;
    window.atlasFollowOther=null;
    window.atlasDestination=null;
    window.atlasOpponentClear?.();
    focusSay('Free camera',1400);
    render();
  }
  function bindViewerControls(){
    if(!gameFrame.contentDocument)return;
    gameFrame.contentWindow.addEventListener('keydown',gameKeys,true);
    gameFrame.contentWindow.addEventListener('atlasCameraReleased',releaseCamera);
  }
  gameFrame.addEventListener('load',bindViewerControls);
  bindViewerControls();
  window.atlasClient={follow:name=>{wallEnd(false);tourSet(false);previousPick(name);},openPlugin:showPlugin,restoreLinkedPlugin,openBank,selectedPlugin:()=>selectedPlugin,gameTab:id=>{selectedTab=id;hud.classList.remove('game-panel-hidden');gamePanel();}};
  app.classList.remove('focus-map','right-hidden','left-hidden');app.classList.toggle('public-view',!window.atlasOperator());showPlugin('fleet');renderChat();if(S)refresh();
})();

});
