let passData = null, failData = null;
const $ = s => document.getElementById(s);
// pop-out: if inside small popup, show button to open full tab
(() => {
  const btn = $('openFullBtn');
  if (!btn) return;
  const isPopup = window.innerWidth < 700 || new URLSearchParams(location.search).has('popup');
  const hasChrome = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL;
  const shouldShow = isPopup || (hasChrome && window.innerWidth < 980);
  if (shouldShow) {
    btn.style.display = 'inline-flex';
    btn.addEventListener('click', () => {
      if (hasChrome) {
        const url = chrome.runtime.getURL('app.html');
        if (chrome.tabs) chrome.tabs.create({ url });
        else window.open(url, '_blank');
      } else {
        window.open(location.href, '_blank');
      }
    });
  }
  if (new URLSearchParams(location.search).get('demo') === '1') {
    window.addEventListener('DOMContentLoaded', () => setTimeout(loadDemo, 300));
  }
})();
$('passFile').addEventListener('change', e => loadFile(e.target.files[0], 'pass'));
$('failFile').addEventListener('change', e => loadFile(e.target.files[0], 'fail'));
$('compareBtn').addEventListener('click', compare);
$('demoBtn').addEventListener('click', loadDemo);
['passCard','failCard'].forEach(id=>{
  const el=$(id); if(!el) return;
  el.addEventListener('dragover', e=>{e.preventDefault(); el.classList.add('drag')});
  el.addEventListener('dragleave', ()=> el.classList.remove('drag'));
  el.addEventListener('drop', e=>{
    e.preventDefault(); el.classList.remove('drag');
    const f=e.dataTransfer.files[0]; if(f) loadFile(f, id==='passCard'?'pass':'fail');
  });
});
function showError(msg){
  const r=$('result'); if(r) r.innerHTML=`<div class="card" style="border-left:4px solid #dc2626;background:#fef2f2;padding:12px;color:#991b1b"><b>Error:</b> ${escape(msg)}</div>`;
  const c=$('chipsStrip'); if(c) c.style.display='none';
}
const MAX_FILE_SIZE = 5 * 1024 * 1024;
function loadFile(file, side){
  if(!file) return;
  if(file.size > MAX_FILE_SIZE){ showError(`File too large: ${(file.size/1024/1024).toFixed(1)}MB > 5MB — snapshots should be <1MB. Try a smaller file.`); return; }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(reader.result);
      if(!json.schemaVersion){ json.schemaVersion='1.0'; console.warn('snapshot missing schemaVersion, assuming 1.0'); }
      if(!json.meta || !json.dom){ showError('Invalid snapshot: missing meta/dom — is this a Flake Diff snapshot.json?'); return; }
      const meta = metaLine(json);
      const v = json.schemaVersion||'1.0';
      const badge = `<span class="badge ok">${escape(file.name.slice(0,28))}</span> <span style="font-size:11px;color:#0f172a">${escape(meta)}</span> <span class="badge v2">v${escape(v)}</span>`;
      if(side==='pass'){ passData=json; $('passMeta').innerHTML = badge; }
      else { failData=json; $('failMeta').innerHTML = badge; }
      updateStatus();
    } catch(e){ showError('Invalid JSON: '+e.message); }
  };
  reader.readAsText(file);
}
function metaLine(j){
  const m=j.meta||{};
  const v=j.schemaVersion||j.version||'1.0';
  return `v${v} · ${m.testName||'?'} · ${m.status||j.status||'?'} · ${m.url||''}`.slice(0,110);
}
function updateStatus(){
  const txt=$('statusText');
  const btn=$('compareBtn');
  if(passData && failData){ txt.textContent='Ready to compare ✓'; btn.disabled=false; }
  else { txt.textContent='Waiting for 2 files'; btn.disabled=true; }
}
function getHtml(d){ return d?.htmlSnippet || d?.html || ''; }
function getStorageMap(storage){
  if(!storage) return {};
  if(Array.isArray(storage.local)){
    const m={};
    [...(storage.local||[]), ...(storage.session||[])].forEach(e=>{ if(e.key) m[e.key]=e.preview||e.valueHash||''; });
    return m;
  }
  return {...(storage.local||{}), ...(storage.session||{})};
}
function compare(){
  if(!passData || !failData) return;
  const res = $('result');
  const empty = $('emptyState');
  const chips = $('chipsStrip');
  if(empty) empty.style.display='none';
  res.innerHTML='';

  const verdicts = analyzeVerdict(passData, failData);
  const vDiv = document.createElement('div');
  const isOk = verdicts.isSame;
  vDiv.className = 'verdict ' + (isOk ? 'ok' : (verdicts.title.includes('🟡') ? 'warn' : 'bad'));
  const iconSvg = isOk
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`
    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  const ver = (passData.schemaVersion||failData.schemaVersion||'1.0');
  const vp = passData.meta?.viewport, vf=failData.meta?.viewport;
  const vpStr = vp?`${vp.width}x${vp.height}`:'';
  vDiv.innerHTML = `<div class="verdict-icon">${iconSvg}</div><div><h2>${escape(verdicts.title.replace(/^[🔴🟡🟢]\s*/,''))}</h2><p>${isOk?'PASS and FAIL look similar — check raw diff below.':'Top hypothesis — check the red chips/cards first.'}</p><div class="meta"><span class="badge v2">schema ${escape(ver)}</span><span class="badge">${escape(passData.captureMode||'lite')}</span>${vpStr?`<span class="badge">${escape(vpStr)}</span>`:''}<span class="badge ok">PASS: ${escape((passData.meta?.testName||'').slice(0,20))}</span><span class="badge bad">FAIL: ${escape((failData.meta?.testName||'').slice(0,20))}</span></div></div>`;
  res.appendChild(vDiv);

  // chips strip
  if(chips){
    chips.style.display='flex';
    chips.innerHTML='';
    const urlChanged = (passData.meta?.url||'') !== (failData.meta?.url||'');
    const qpChanged = JSON.stringify(passData.meta?.queryParams||{}) !== JSON.stringify(failData.meta?.queryParams||{});
    const domCountP = passData.dom?.counts?.total ?? 0, domCountF = failData.dom?.counts?.total ?? 0;
    const domChanged = domCountP !== domCountF;
    const consoleHasNew = (()=>{ const pe=passData.console?.errors||[], fe=failData.console?.errors||[]; return fe.filter(x=>!pe.includes(x)).length>0 })();
    const storageMapP=getStorageMap(passData.storage), storageMapF=getStorageMap(failData.storage);
    const storageChanged = Object.keys({...storageMapP,...storageMapF}).some(k=>storageMapP[k]!==storageMapF[k]);
    const testIdP=passData.dom?.testIds||{}, testIdF=failData.dom?.testIds||{};
    const testIdChanged = Object.keys({...testIdP,...testIdF}).some(k=>testIdP[k]!==testIdF[k]);
    const chipsData = [
      {label:'URL', changed:urlChanged},
      {label:'Query', changed:qpChanged},
      {label:`DOM ${domCountP}→${domCountF}`, changed:domChanged},
      {label:`Console ${failData.console?.errors?.length||0} err`, changed:consoleHasNew},
      {label:`Storage`, changed:storageChanged},
      {label:`TestIds`, changed:testIdChanged},
    ];
    chipsData.forEach(c=>{
      const el=document.createElement('div');
      el.className='chip '+(c.changed?'changed':'same');
      el.innerHTML=`<span class="dot"></span> ${escape(c.label)}`;
      chips.appendChild(el);
    });
  }

  // prioritized grid: Console full width if changed, then TestIds/Inventory, then others
  const urlChanged = (passData.meta?.url||'') !== (failData.meta?.url||'');
  const qpChanged = JSON.stringify(passData.meta?.queryParams||{}) !== JSON.stringify(failData.meta?.queryParams||{});
  const domCountP = passData.dom?.counts?.total ?? 0, domCountF = failData.dom?.counts?.total ?? 0;
  const domChanged = domCountP !== domCountF;
  const consoleHasNew = (()=>{ const pe=passData.console?.errors||[], fe=failData.console?.errors||[]; return fe.filter(x=>!pe.includes(x)).length>0 })();
  const storageMapP=getStorageMap(passData.storage), storageMapF=getStorageMap(failData.storage);
  const storageChanged = Object.keys({...storageMapP,...storageMapF}).some(k=>storageMapP[k]!==storageMapF[k]);
  const testIdP=passData.dom?.testIds||{}, testIdF=failData.dom?.testIds||{};
  const testIdChanged = Object.keys({...testIdP,...testIdF}).some(k=>testIdP[k]!==testIdF[k]);

  // Row1: Console full width if new errors
  if(consoleHasNew){
    const row=document.createElement('div'); row.className='grid'; row.style.gridTemplateColumns='1fr';
    row.appendChild(card('Console Errors', '🐞', diffConsole(passData.console, failData.console), true));
    res.appendChild(row);
  } else {
    const grid=document.createElement('div'); grid.className='grid';
    grid.appendChild(card('Console Errors', '🐞', diffConsole(passData.console, failData.console), false));
    grid.appendChild(card('URL', '🔗', diffLine(passData.meta?.url, failData.meta?.url), urlChanged));
    res.appendChild(grid);
  }

  // Row2: TestIds + Inventory side by side
  const row2=document.createElement('div'); row2.className='grid';
  row2.appendChild(card('Test IDs', '🎯', diffTestIds(testIdP, testIdF), testIdChanged));
  const invChanged = JSON.stringify(passData.dom?.locatorInventory||[])!==JSON.stringify(failData.dom?.locatorInventory||[]);
  row2.appendChild(card('Locator Inventory', '🧭', diffInventory(passData.dom?.locatorInventory, failData.dom?.locatorInventory), invChanged));
  res.appendChild(row2);

  // Row3: Query, DOM, Storage
  const row3=document.createElement('div'); row3.className='grid';
  row3.appendChild(card('Query Params', '🔍', diffQueryParams(passData.meta?.queryParams, failData.meta?.queryParams), qpChanged));
  row3.appendChild(card('DOM Count', '🧩', diffCounts(passData.dom?.counts, failData.dom?.counts), domChanged));
  res.appendChild(row3);
  const row3b=document.createElement('div'); row3b.className='grid'; row3b.style.gridTemplateColumns='1fr';
  row3b.appendChild(card('Storage', '💾', diffStorage(passData.storage, failData.storage), storageChanged));
  res.appendChild(row3b);

  // Row4: Body text
  const textCard = card('Body Text', '📝', diffText(passData.dom?.bodyText, failData.dom?.bodyText), passData.dom?.bodyText !== failData.dom?.bodyText);
  const textRow = document.createElement('div'); textRow.className='grid'; textRow.style.gridTemplateColumns='1fr';
  textRow.appendChild(textCard);
  res.appendChild(textRow);

  // if console not full width earlier, and we did separate, handle URL already
  if(consoleHasNew){
    // URL was not yet shown when console full width, add it now in row3b-like
    // already handled? we put URL in else branch, need to ensure URL shown even when console full width
    const urlRow=document.createElement('div'); urlRow.className='grid'; urlRow.style.gridTemplateColumns='1fr';
    // if not already added, add URL card - check if res already has URL
    // we haven't added URL when consoleHasNew, so add now
    // we added Console full width, but not URL - add URL now as separate
    // we already added row3 with query+dom, need URL somewhere - add to textRow top?
    // simplest: add URL card to row3 before query
    // Instead, just add URL card now
    const urlCard=card('URL', '🔗', diffLine(passData.meta?.url, failData.meta?.url), urlChanged);
    urlRow.appendChild(urlCard);
    // insert before textRow
    res.insertBefore(urlRow, textRow);
  }

  res.appendChild(collapsible('PASS htmlSnippet (20k redacted)', getHtml(passData.dom).slice(0,5000)));
  res.appendChild(collapsible('FAIL htmlSnippet (20k redacted)', getHtml(failData.dom).slice(0,5000)));
  res.appendChild(collapsible('PASS raw JSON', JSON.stringify(passData,null,2).slice(0,8000)));
  res.appendChild(collapsible('FAIL raw JSON', JSON.stringify(failData,null,2).slice(0,8000)));
}
function analyzeVerdict(pass, fail){
  const passErr = (pass.console?.errors||[]).length;
  const failErr = (fail.console?.errors||[]).length;
  const newErr = failErr - passErr;
  const passCount = pass.dom?.counts?.total || 0;
  const failCount = fail.dom?.counts?.total || 0;
  if(newErr>0) return {isSame:false, title:`🔴 Likely cause: ${newErr} new console error(s) in FAIL`};
  if(Math.abs(passCount-failCount)>50) return {isSame:false, title:`🔴 Likely cause: DOM size changed ${passCount} → ${failCount}`};
  if((pass.meta?.url||'') !== (fail.meta?.url||'')) return {isSame:false, title:`🟡 URL changed — check Query Params`};
  const pIds=pass.dom?.testIds||{}, fIds=fail.dom?.testIds||{};
  const missing=Object.keys(pIds).filter(k=>pIds[k]>0 && !fIds[k]);
  if(missing.length>0) return {isSame:false, title:`🔴 Missing element: ${missing[0]} gone in FAIL`};
  return {isSame:false, title:`🟡 No single killer — scan red chips below`};
}
function card(title, icon, html, changed){
  const d=document.createElement('div');
  d.className='card';
  const tag = changed ? `<span class="tag tag-changed">Changed</span>` : `<span class="tag tag-same">Same</span>`;
  d.innerHTML=`<div class="card-h"><div class="card-h-left"><div class="card-icon">${icon}</div><h3>${title}</h3></div>${tag}</div><div class="card-b">${html}</div>`;
  return d;
}
function diffLine(a,b){
  if(a===b) return `<span style="color:#16a34a;font-weight:600">Same:</span> <code class="inline-code">${escape(a)}</code>`;
  return `<div style="display:grid;gap:6px"><div><span class="badge ok">PASS</span> <code class="inline-code">${escape(a)}</code></div><div><span class="badge bad">FAIL</span> <code class="inline-code">${escape(b)}</code></div></div>`;
}
function diffCounts(a,b){
  const pa=a?.total ?? '?', fa=b?.total ?? '?';
  const delta = (typeof pa==='number' && typeof fa==='number') ? ` (Δ ${fa-pa>0?'+':''}${fa-pa})` : '';
  const visP=a?.visible, visF=b?.visible;
  const visLine = (visP!=null && visF!=null && visP!==visF) ? `<div class="hint">Visible: PASS ${visP} → FAIL ${visF}</div>` : (visP!=null?`<div class="hint">Visible: ${visP}</div>`:'');
  // byTag diff — show changed tags as table, not chopped JSON slice
  let byTagHtml='';
  if(a?.byTag || b?.byTag){
    const tags=[...new Set([...Object.keys(a?.byTag||{}), ...Object.keys(b?.byTag||{})])].sort();
    const changed=tags.filter(k=> (a?.byTag?.[k]||0) !== (b?.byTag?.[k]||0));
    if(changed.length===0) byTagHtml=`<div class="hint">byTag: all tags same (${tags.length})</div>`;
    else {
      byTagHtml=`<div class="hint" style="margin-top:8px;font-weight:600">byTag changed (${changed.length}):</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">`+
        changed.map(k=>`<span class="inline-code" style="background:#f8fafc">${escape(k)}: <b style="color:#16a34a">${a?.byTag?.[k]||0}</b> → <b style="color:#dc2626">${b?.byTag?.[k]||0}</b></span>`).join('')+
        `</div><details style="margin-top:6px"><summary style="font-size:11px;cursor:pointer">Show full byTag</summary><pre>${escape(JSON.stringify({PASS:a?.byTag, FAIL:b?.byTag},null,2))}</pre></details>`;
    }
  }
  return `<div style="font-weight:700" class="${pa===fa?'ok':'bad'}">Total: PASS ${pa} → FAIL ${fa}${delta}</div>${visLine}${byTagHtml}`;
}
function diffConsole(pc, fc){
  const pe=pc?.errors||[], fe=fc?.errors||[], pw=pc?.warnings||[], fw=fc?.warnings||[];
  const newErr = fe.filter(x=>!pe.includes(x));
  const newWarn = fw.filter(x=>!pw.includes(x));
  if(newErr.length===0 && newWarn.length===0) return `<span style="color:#16a34a">✓ No new errors/warnings</span><div class="hint">FAIL errors: ${fe.length} · PASS errors: ${pe.length}</div>`;
  let h=`<div style="font-weight:700;color:#dc2626;margin-bottom:6px">New errors in FAIL (${newErr.length})</div><pre>${escape(newErr.join('\n')||'none')}</pre>`;
  if(newWarn.length>0) h+=`<div style="font-weight:600;color:#d97706;margin:8px 0 4px">New warnings (${newWarn.length})</div><pre>${escape(newWarn.join('\n'))}</pre>`;
  h+=`<div class="hint">Total FAIL errors: ${fe.length} | PASS errors: ${pe.length}</div>`;
  return h;
}
function diffQueryParams(p,f){
  p=p||{}; f=f||{};
  const keys=[...new Set([...Object.keys(p),...Object.keys(f)])].sort();
  if(keys.length===0) return `<span style="color:#16a34a">✓ No query params</span>`;
  const changed = keys.filter(k=> p[k] !== f[k]);
  if(changed.length===0) return `<span style="color:#16a34a">✓ Query params same (${keys.length})</span><pre>${escape(JSON.stringify(p,null,2))}</pre>`;
  let h=`<div style="font-weight:700;color:#dc2626">Changed (${changed.length})</div><pre>${escape(changed.map(k=>`${k}: PASS=${p[k]??'∅'} → FAIL=${f[k]??'∅'}`).join('\n'))}</pre>`;
  h+=`<pre>${escape('PASS: '+JSON.stringify(p,null,2)+'\nFAIL: '+JSON.stringify(f,null,2))}</pre>`;
  return h;
}
function diffStorage(ps, fs){
  const pm=getStorageMap(ps), fm=getStorageMap(fs);
  const keys=[...new Set([...Object.keys(pm),...Object.keys(fm)])].sort();
  if(keys.length===0) return `<span style="color:#16a34a">✓ No storage keys</span>`;
  const changed=keys.filter(k=>pm[k]!==fm[k]);
  if(changed.length===0) return `<span style="color:#16a34a">✓ Storage identical (${keys.length} keys)</span>`;
  let h=`<div style="font-weight:700;color:#dc2626">Changed keys (${changed.length}/${keys.length})</div><pre>${escape(changed.map(k=>`${k}: PASS=${String(pm[k]??'∅').slice(0,60)} → FAIL=${String(fm[k]??'∅').slice(0,60)}`).join('\n'))}</pre>`;
  if(ps?.local && Array.isArray(ps.local)) h+=`<div class="hint">V2: values are hashed/preview (PII safe), size/truncated tracked</div>`;
  return h;
}
function diffTestIds(p,f){
  p=p||{}; f=f||{};
  const keys=[...new Set([...Object.keys(p),...Object.keys(f)])].sort();
  const missing = keys.filter(k=> (p[k]||0) >0 && !f[k]);
  const added = keys.filter(k=> !p[k] && (f[k]||0)>0);
  if(missing.length===0 && added.length===0) return `<span style="color:#16a34a">✓ All data-testid counts same (${keys.length})</span>`;
  let h=``;
  if(missing.length) h+=`<div style="font-weight:700;color:#dc2626">Missing in FAIL:</div><pre>${escape(missing.join(', '))}</pre>`;
  if(added.length) h+=`<div style="font-weight:600;color:#d97706">Added in FAIL:</div><pre>${escape(added.join(', '))}</pre>`;
  h+=`<pre>PASS: ${escape(JSON.stringify(p,null,2))}\nFAIL: ${escape(JSON.stringify(f,null,2))}</pre>`;
  return h;
}
function diffInventory(a,b){
  a=a||[]; b=b||[];
  if(JSON.stringify(a)===JSON.stringify(b)) return `<span style="color:#16a34a">✓ Inventory same</span>`;
  return `<pre>PASS: ${escape(JSON.stringify(a,null,2).slice(0,2000))}\nFAIL: ${escape(JSON.stringify(b,null,2).slice(0,2000))}</pre>`;
}
function diffText(a,b){
  a=(a||'').slice(0,2000); b=(b||'').slice(0,2000);
  if(a===b) return `<span style="color:#16a34a">✓ Body text identical</span>`;
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><div class="hint">PASS snippet</div><pre>${escape(a.slice(0,1000))}</pre></div><div><div class="hint">FAIL snippet</div><pre>${escape(b.slice(0,1000))}</pre></div></div>`;
}
function collapsible(title, content){
  const d=document.createElement('details');
  d.innerHTML=`<summary><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg> ${escape(title)}</summary><div style="padding:12px"><pre>${escape(content)}</pre></div>`;
  return d;
}
function escape(s){ if(s==null) return ''; return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
async function loadDemo(){
  const pass = {
    schemaVersion:"2.0", captureMode:"lite",
    meta:{testName:"checkout", status:"PASS", url:"https://shop.example.com/checkout?cart=5&coupon=SAVE10", queryParams:{cart:"5",coupon:"SAVE10"}, title:"Shop", viewport:{width:1280,height:800}},
    dom:{counts:{total:342, visible:340, byTag:{div:10,button:5}}, testIds:{"btn-pay":1,"cart":1,"results":5}, locatorInventory:[{selector:'[data-testid="btn-pay"]', testId:"btn-pay"}], htmlSnippet:"<html>...pass...</html>", bodyText:"Cart total $50 Pay"},
    console:{errors:[], warnings:[], errorHashes:[]},
    storage:{local:[{key:"token", valueHash:"abc", size:10, preview:"abc"}], session:[], count:1},
    cookies:[{name:"token", valueHash:"abc", domain:"shop.example.com"}],
    config:{maxHtml:20000, maxStorageKeys:10, redact:true}
  };
  const fail = {
    schemaVersion:"2.0", captureMode:"lite",
    meta:{testName:"checkout", status:"FAIL", url:"https://shop.example.com/checkout?cart=5", queryParams:{cart:"5"}, title:"Shop", viewport:{width:1280,height:800}},
    dom:{counts:{total:280, visible:278, byTag:{div:9,button:4}}, testIds:{"btn-pay":0,"cart":1}, locatorInventory:[], htmlSnippet:"<html>...fail missing pay...</html>", bodyText:"Cart total $50 Error: payment service unavailable"},
    console:{errors:["TypeError: Cannot read property 'pay' of null at checkout.js:42","Failed to fetch /api/pay 500"], warnings:["slow"], errorHashes:["a1","b2"]},
    storage:{local:[{key:"token", valueHash:"", size:0, preview:""}], session:[], count:1},
    cookies:[],
    config:{maxHtml:20000, maxStorageKeys:10, redact:true}
  };
  passData=pass; failData=fail;
  $('passMeta').innerHTML = `<span class="badge ok">pass.snapshot.json</span> <span style="font-size:11px">${escape(metaLine(pass))}</span> <span class="badge v2">v2.0</span>`;
  $('failMeta').innerHTML = `<span class="badge bad">fail.snapshot.json</span> <span style="font-size:11px">${escape(metaLine(fail))}</span> <span class="badge v2">v2.0</span>`;
  updateStatus();
  compare();
}
