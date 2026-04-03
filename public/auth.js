/* ══════════════════════════════════════
   AUTH
══════════════════════════════════════ */
function loadStoredAuth(){
  try{
    const t=localStorage.getItem('scc_token');
    const u=localStorage.getItem('scc_user');
    if(t&&u){ authToken=t; currentUser=JSON.parse(u); }
  }catch(e){}
}
function saveAuth(token,user){ authToken=token; currentUser=user; localStorage.setItem('scc_token',token); localStorage.setItem('scc_user',JSON.stringify(user)); }
function clearAuth(){ authToken=null; currentUser=null; localStorage.removeItem('scc_token'); localStorage.removeItem('scc_user'); invalidateSessionCache(); }

/* ── Server-side session sync ───────────────────────────────────────────────
   Called once on boot: verifies the stored token against the DB.
   - If the account was deleted  → clears auth and shows login screen
   - If the account data changed (e.g. username was manually added) → refreshes local session
   This ensures deleted accounts never persist in localStorage.
──────────────────────────────────────────────────────────────────────────── */
async function syncAuthWithServer(){
  if(!authToken) return; // not logged in — nothing to sync
  try{
    const r=await fetch('/api/me',{headers:{Authorization:'Bearer '+authToken}});
    if(r.status===401||r.status===403){
      // Account deleted or token invalid — force logout
      clearAuth();
      // Also clear nav state so we don't restore a stale screen
      try{ sessionStorage.removeItem('scc_nav'); sessionStorage.removeItem('qz_pid'); }catch(_){}
      render();
      return;
    }
    if(!r.ok) return; // server error — fail silently, don't log out on transient errors
    const d=await r.json();
    if(d.token&&d.user){
      // Refresh token + user data in case anything changed (e.g. username updated in DB)
      saveAuth(d.token,d.user);
      currentUser=d.user;
    }
  }catch(e){
    // Network error (offline, server starting up) — don't log out, just continue
    console.warn('Session sync skipped (network):', e.message);
  }
}

/* ── Navigation-state persistence (survives reload) ─────────────────────── */
const NAV_KEY='scc_nav';
function saveNavState(){
  try{
    // Only persist states that make sense to restore after reload.
    // We never restore a mid-question live session since WS reconnect handles that.
    const st={
      role: role,
      hostAuthed: hostAuthed,
      myName: myName,
      showingProfile: showingProfile,
      profileTab: profileTab,
      homeSection: homeSection,
    };
    sessionStorage.setItem(NAV_KEY, JSON.stringify(st));
  }catch(e){}
}
function loadNavState(){
  try{
    const raw=sessionStorage.getItem(NAV_KEY);
    if(!raw) return;
    const st=JSON.parse(raw);
    role          = st.role          ?? null;
    hostAuthed    = st.hostAuthed    ?? false;
    myName        = st.myName        ?? null;
    showingProfile= st.showingProfile?? false;
    profileTab    = st.profileTab    ?? 'overview';
    homeSection   = st.homeSection   ?? 'home';
    // myPid already persisted separately in sessionStorage by existing code
    if(myName) myPid = sessionStorage.getItem('qz_pid') || null;
  }catch(e){}
}

async function apiPost(path,body,withAuth){
  const h={'Content-Type':'application/json'};
  if(withAuth&&authToken) h['Authorization']='Bearer '+authToken;
  const r=await fetch(path,{method:'POST',headers:h,body:JSON.stringify(body)});
  const d=await r.json();
  if(!r.ok) throw new Error(d.error||'Request failed');
  return d;
}
async function apiDel(path){
  const h={'Authorization':'Bearer '+authToken};
  const r=await fetch(path,{method:'DELETE',headers:h});
  const d=await r.json();
  if(!r.ok) throw new Error(d.error||'Failed');
  return d;
}

// ── SESSION HISTORY ──────────────────────────────────────────────────────
// History is now stored server-side. We keep a short-lived in-memory cache
// so the profile page doesn't re-fetch on every tab switch.
let _sessionCache = null;       // null = not loaded yet, [] = loaded but empty
let _sessionCacheTime = 0;
const SESSION_CACHE_TTL = 30000; // 30 s

async function loadHistory(){
  if(_sessionCache !== null && (Date.now()-_sessionCacheTime) < SESSION_CACHE_TTL)
    return _sessionCache;
  if(!authToken) return [];
  try{
    const r = await fetch('/api/sessions',{headers:{Authorization:'Bearer '+authToken}});
    const d = await r.json();
    _sessionCache = d.history || [];
    _sessionCacheTime = Date.now();
    return _sessionCache;
  }catch(e){ return _sessionCache || []; }
}
function invalidateSessionCache(){ _sessionCache=null; _sessionCacheTime=0; }

async function saveSession(e){
  // Persist to DB — fire and forget, no UI block
  if(!authToken) return;
  try{
    await fetch('/api/sessions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},
      body:JSON.stringify(e)
    });
    invalidateSessionCache(); // force fresh load next time profile opens
  }catch(err){ console.warn('saveSession failed:',err.message); }
}
function computeStats(){
  const h=loadHistory(); if(!h.length) return null;
  const totalCorrect=h.reduce((s,e)=>s+(e.correct||0),0);
  const totalQs=h.reduce((s,e)=>s+(e.total||0),0);
  const accuracy=totalQs?Math.round(totalCorrect/totalQs*100):0;
  const bestScore=Math.max(...h.map(e=>e.score||0));
  const bestRank=Math.min(...h.map(e=>e.rank||999));
  const today=new Date(); today.setHours(0,0,0,0);
  const dayMs=86400000;
  const days=[...new Set(h.map(e=>{ const d=new Date(e.date); d.setHours(0,0,0,0); return d.getTime(); }))].sort((a,b)=>b-a);
  let streak=0;
  if(days.length&&(today.getTime()-days[0])<=dayMs){
    for(let i=0;i<days.length;i++){ if(Math.abs(days[i]-(today.getTime()-i*dayMs))<=dayMs) streak++; else break; }
  }
  return {sessions:h.length,totalCorrect,totalQs,accuracy,bestScore,bestRank:bestRank===999?null:bestRank,streak};
}

// ── SCHEDULES (server-side) ───────────────────────────────────────────────
function cdStr(ts){ const d=ts-Date.now(); if(d<=0)return'Now/Overdue'; const h=Math.floor(d/3600000),m=Math.floor((d%3600000)/60000); if(h>48)return'in '+Math.floor(h/24)+' days'; if(h>0)return'in '+h+'h '+m+'m'; return'in '+m+'m'; }

async function fetchSchedules(){
  try{
    const r=await fetch('/api/schedules');
    const d=await r.json();
    serverSchedules=d.schedules||[];
    render();
  }catch(e){ serverSchedules=[]; }
}

async function fetchHostSchedules(){
  try{
    const r=await fetch('/api/schedules');
    const d=await r.json();
    hostSchedules=d.schedules||[];
    render();
  }catch(e){ hostSchedules=[]; }
}

// ── NOTICE ────────────────────────────────────────────────────────────────────
async function fetchNotice(){
  try{
    const r=await fetch('/api/notice');
    const d=await r.json();
    hostNotice=d.text||'';
    render();
  }catch(e){}
}

async function postNotice(text){
  try{
    await apiPost('/api/notice',{text},true);
    hostNotice=text;
    showToast('📢 Notice broadcast to all students.','good');
    render();
  }catch(e){ showToast('Failed to post notice: '+e.message,'bad'); }
}

// ── ADMIN REQUESTS ────────────────────────────────────────────────────────────
async function fetchAdminRequests(){
  if(!authToken||currentUser?.role!=='host') return;
  const hdr={Authorization:'Bearer '+authToken};
  const safeFetch = async (url) => {
    try{
      const r = await fetch(url,{headers:hdr});
      if(!r.ok) return {};
      return await r.json();
    }catch(e){ console.warn('Fetch failed:',url,e.message); return {}; }
  };
  const [jr, ur, ru] = await Promise.all([
    safeFetch('/api/admin/join-requests'),
    safeFetch('/api/admin/update-requests'),
    safeFetch('/api/admin/users'),
  ]);
  joinRequests    = jr.requests || [];
  updateRequests  = ur.requests || [];
  registeredUsers = ru.users    || [];
  render();
}

async function approveJoinReq(id){
  try{
    const r=await fetch('/api/admin/join-requests/'+id+'/approve',{method:'POST',headers:{Authorization:'Bearer '+authToken}});
    const d=await r.json();
    if(!r.ok) throw new Error(d.error||'Failed');
    showToast('✅ User approved and account created.','good');
    await fetchAdminRequests();
  }catch(e){ showToast('Error: '+e.message,'bad'); }
}

async function rejectJoinReq(id){
  try{
    const r=await fetch('/api/admin/join-requests/'+id+'/reject',{method:'POST',headers:{Authorization:'Bearer '+authToken}});
    if(!r.ok) throw new Error('Failed');
    showToast('Request rejected.','neutral');
    await fetchAdminRequests();
  }catch(e){ showToast('Error: '+e.message,'bad'); }
}

async function approveUpdateReq(id){
  try{
    const r=await fetch('/api/admin/update-requests/'+id+'/approve',{method:'POST',headers:{Authorization:'Bearer '+authToken}});
    const d=await r.json();
    if(!r.ok) throw new Error(d.error||'Failed');
    showToast('✅ Update approved.','good');
    await fetchAdminRequests();
  }catch(e){ showToast('Error: '+e.message,'bad'); }
}

async function rejectUpdateReq(id){
  try{
    const r=await fetch('/api/admin/update-requests/'+id+'/reject',{method:'POST',headers:{Authorization:'Bearer '+authToken}});
    if(!r.ok) throw new Error('Failed');
    showToast('Update rejected.','neutral');
    await fetchAdminRequests();
  }catch(e){ showToast('Error: '+e.message,'bad'); }
}

async function deleteUser(id, name){
  if(!confirm(`Permanently delete "${name}"?\n\nThis will purge their account, session history, leaderboard scores and all pending requests. This cannot be undone.`)) return;
  try{
    const r=await fetch('/api/admin/users/'+id,{method:'DELETE',headers:{Authorization:'Bearer '+authToken}});
    const d=await r.json();
    if(!r.ok) throw new Error(d.error||'Failed');
    showToast('🗑 Account deleted and fully purged.','neutral');
    await fetchAdminRequests();
  }catch(e){ showToast('Error: '+e.message,'bad'); }
}

function openInspect(id){
  const u = registeredUsers.find(u=>String(u.id)===String(id));
  if(!u) return;
  inspectingUser = u;
  inspectTab = 'overview';
  inspectCache = null;
  render();
}

function inspectProfileHTML(){
  const u = inspectingUser;
  const initials = u.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const TABS = [['overview','📈 Overview'],['history','📋 History']];
  const tabsHTML = TABS.map(([t,l])=>`<div class="ptab${inspectTab===t?' active':''}" data-itab="${t}">${l}</div>`).join('');
  const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en',{year:'numeric',month:'short',day:'numeric'}) : '';
  return `<div class="profile-page">
    <div class="row gap2 mb3">
      <span style="font-size:.95rem;font-weight:600">Inspecting Account</span>
    </div>
    <div class="profile-hero">
      <div class="ph-avatar">${initials}</div>
      <div class="ph-info">
        <div class="ph-name">${esc(u.name)}</div>
        <div class="ph-email">${esc(u.email)}${u.username?`<span style="color:var(--mid);margin-left:5px">· @${esc(u.username)}</span>`:''}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:5px">
          <span class="user-role-pill" style="background:${u.role==='host'?'#7c3aed':'#0ea5e9'}">${u.role}</span>
          ${joined?`<span style="font-size:.68rem;color:var(--mid)">Joined ${joined}</span>`:''}
        </div>
      </div>
      <button class="btn btn-bad btn-sm" style="flex-shrink:0;align-self:flex-start;padding:5px 10px" data-user-delete="${u.id}" data-user-name="${esc(u.name)}">🗑</button>
    </div>
    <div class="ptabs">${tabsHTML}</div>
    <div id="inspect-data-body">
      <div style="text-align:center;padding:48px 16px;color:var(--mid)">
        <div style="font-size:1.5rem;margin-bottom:10px;opacity:.4">⏳</div>
        <div style="font-size:.83rem">Loading…</div>
      </div>
    </div>
  </div>`;
}

async function loadInspectData(){
  const el = document.getElementById('inspect-data-body');
  if(!el || !inspectingUser) return;
  try{
    if(!inspectCache){
      const r = await fetch('/api/admin/sessions/'+inspectingUser.id, {headers:{Authorization:'Bearer '+authToken}});
      if(r.status === 404){
        // Route not deployed yet — show clear message
        el.innerHTML='<div class="no-data-notice"><span>🚫</span><b style="color:var(--ink)">Deploy updated server.js</b><br><span style="font-size:.75rem;color:var(--mid)">The /api/admin/sessions route is not available on the server yet.</span></div>';
        return;
      }
      if(!r.ok){
        el.innerHTML='<div class="no-data-notice"><span>⚠️</span>Server error ('+r.status+')</div>';
        return;
      }
      let d; try{ d = await r.json(); }catch(_){ d = {}; }
      inspectCache = d.history || [];
    }
    if(inspectTab==='overview') el.innerHTML = buildOverviewHTML(inspectCache);
    else el.innerHTML = buildHistoryHTML(inspectCache);
    requestAnimationFrame(setupProfileCharts);
  }catch(err){
    if(el) el.innerHTML=`<div class="no-data-notice"><span>⚠️</span><b style="color:var(--ink)">Failed to load</b><br><span style="font-size:.75rem;font-family:monospace">${err.message}</span></div>`;
    console.error('loadInspectData:', err.message);
  }
}

// ── LEADERBOARD ───────────────────────────────────────────────────────────────
// Three separate fetch calls so each tab loads independently.
// All three use the same endpoint with a ?period= param.
/* ── fetchLeaderboard ────────────────────────────────────────────────────────
   Fetch one or all leaderboard periods from the server.

   period: 'today' | 'week' | 'all' | undefined (= all three)

   Each period is fetched independently so a failure in one tab does not
   affect the others.  Loading state is tracked per-tab via lbFetched so
   the spinner only appears while that tab is genuinely in-flight, and
   cached results are never wiped unnecessarily.
──────────────────────────────────────────────────────────────────────────── */
async function fetchLeaderboard(period){
  const periods = period ? [period] : ['today','week','all'];

  // Map each period to its cache variable getter/setter
  const cache = {
    today: { get:()=>todayLB,   set:(v)=>{ todayLB=v;   }, key:'today' },
    week:  { get:()=>weekLB,    set:(v)=>{ weekLB=v;     }, key:'week'  },
    all:   { get:()=>allTimeLB, set:(v)=>{ allTimeLB=v;  }, key:'all'   },
  };

  // Mark each requested period as loading and clear its error
  periods.forEach(p => {
    cache[p].set(null);      // null = loading sentinel
    lbFetched[p] = false;    // false = in-flight
    lbErrors[p]  = null;
  });

  render(); // show spinners immediately

  // Fire all fetches concurrently
  await Promise.all(periods.map(async (p) => {
    try {
      const r = await fetch('/api/leaderboard?period=' + p);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || ('Server error (' + r.status + ')'));
      cache[p].set(Array.isArray(d.leaderboard) ? d.leaderboard : []);
      lbErrors[p]  = null;
    } catch(e) {
      console.error('fetchLeaderboard [' + p + ']:', e.message);
      cache[p].set([]);              // empty array so UI shows "no scores"
      lbErrors[p]  = e.message || 'Failed to load';
    } finally {
      lbFetched[p] = true;           // true = settled (success or error)
    }
  }));

  // If viewing profile overview, patch just the rank card without a full re-render
  if(showingProfile && profileTab==='overview'){
    const rc = document.getElementById('profile-rank-card');
    if(rc){ rc.outerHTML = buildRankCardHTML(); return; }
  }

  render();
}
