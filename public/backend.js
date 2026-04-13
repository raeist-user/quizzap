/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let S={}, role=null, myPid=null, myName=null, hostAuthed=false;
let currentUser=null;
let authToken=null;

// Profile page
let showingProfile=false, profileTab='overview';

// Score tracking for +N badge
let prevMyScore=0, scoreGain=0;

// Host
let questions=[], selIdx=-1, answerKey=-1, inspectPid=null;
let sidebarQOpen=false, sidebarStudOpen=false, sidebarScoreOpen=false, sidebarSchedOpen=false, showStandingsOverlay=false;
let hostTimerSeconds=0;
let hostRandomize=false; // OFF by default — questions load in file order

// Resource browser
let repoPath=null;
let subjects=[];          // [{name, path, files:[], filesLoaded:false}]
let expandedSubject=null; // which subject accordion is open in generate tab
let folderOverlaySubject=null;   // subject name whose chapter overlay is open
let folderOverlayDraft={};       // {fileName: {selected, count}} — pending selections inside overlay
let folderManageSubject=null;    // subject name whose manage overlay is open
let showNewFolderCard=false;     // whether the + new folder card input is shown
let repoLoading=false;

// Host halt confirmation menu state
let showingHaltMenu=false;
let showingHaltBomb=false, haltBombTimer=null; // bomb drop animation before halt menu
let showingDismissBomb=false, dismissBombTimer=null; // bomb before stop & dismiss fires

// Session backup / restore overlay (host only)
let showingBackupOverlay=false;
let backupOverlayState={ list:[], loading:false, error:null, restoredMsg:null };

// Host settings/shortcuts overlay
let hostSettingsOpen=false;

// Upload manage state
let manageEditMode=null;      // null | 'existing' | 'new'
let manageFolderFiles=[];     // [{name, path, sha}] files in currently selected manage folder
let manageFile=null;          // which specific .txt file is selected in manage tab
let manageNewFileName='';
let editorFullscreen=false;   // whether the editor is in fullscreen overlay mode

// Voice (host)
let localStream=null;
const peerConns={};

// Voice (student)
let remoteConn=null;

// Speak-request flow (see voice.js)
// speakRequestPending, isSpeakingNow, participantMicStream, participantPeerConn
// activeSpeakerName, activeSpeakerCid  — all declared in voice.js

// Timer
let timerInterval=null;

// Push question debounce
let pushing=false, pushTimeout=null;

// Halt flow
let showingHalted=false, haltedIsPreview=false, haltedCountdown=0, haltedTimer=null, haltedSnapshot=[];
let haltedTotalQuestions=0;   // total questions asked in the session (for score/total display)
let haltedTotalLabel='';      // denominator label for final leaderboard: 'all' or specific count string
let hostShutdownLeaderboard=null; // captured final leaderboard shown to host after Stop & Dismiss

// ── QUESTION REPORT STATE ────────────────────────────────────────────────────
let receivedReports=[];          // [{rid,question,correct,reportedAnswer,reporterName,ts,count}]
let reportsOverlayOpen=false;    // whether the host reports overlay is visible
let expandedReportRid=null;      // which report card is expanded (shows options)
let editingReportRid=null;       // which report is in edit mode
let editReportDraft={};          // {text, options:[], correct}
let myReportedQuestions=new Set(); // track question texts reported by this student (prevent duplicates)

// Dismissed flow
let showingDismissed=false, dismissedCountdown=120, dismissedTimer=null;

// Answer timing (client-side — seconds taken to answer current question)
let myLastAnswerTime=null;
let localAnswerTimes={};   // {pid: secs} built client-side from S.answers appearance time
let sessionCorrectTimes=[]; // secs for each correctly answered question this session
let studentQCount=0;       // how many questions this client has seen pushed (for student denominator)
// Cumulative answer times per player — accumulated across all revealed questions this session
// Used for tiebreaking: same pts → less total time = higher rank
let cumulativeAnswerTimes={};  // {pid: totalSecs}

// Cumulative scoring is now handled server-side via gameScores in server.js

// 🔥 Streak tracking
// For host: computed from S.history (full history available)
// For participants: tracked live in clientStreaks (persisted across renders)
let _streakCache = { histLen: -1, map: {} };
let clientStreaks = {}; // {pid: number} — maintained by participant client on each reveal
let lastFastestPid = null; // persists from revealed → idle so badge shows on waiting screen

// Home tabs
let homeSection='home'; // 'home' | 'leaderboard'

// Role-based admin state
let hostNotice='';           // text of global notice fetched from server
let joinRequests=[];         // [{id,name,email,username,createdAt}]
let updateRequests=[];       // [{id,userId,userName,type,newValue,createdAt}]
let registeredUsers=[];      // [{id,name,email,username,role,status,createdAt}]
let inspectingUser=null;     // user object host is currently inspecting
let inspectTab='overview';   // 'overview' | 'history'
let inspectCache=null;       // cached session history for inspected user
let adminLoading=false;      // whether admin requests are being fetched

// All-time leaderboard cache
let allTimeLB=null;
let todayLB=null;
let weekLB=null;
let homeLbTab='today'; // 'today' | 'week' | 'all'
// Per-tab fetch tracking: null=not started, false=loading, true=done
let lbFetched={today:null, week:null, all:null};
// Per-tab error messages (null = no error)
let lbErrors={today:null, week:null, all:null};

// Server schedules (shared between students and host)
let serverSchedules=null;
let hostSchedules=[]; // schedules shown in host panel

const STUN={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]};

// ── GITHUB CONFIG ─────────────────────────────────────────────────────────
// MY_TOKEN is injected into window.MY_TOKEN by index.html (server-side template replacement).
const MY_TOKEN = (typeof window !== 'undefined' && window.MY_TOKEN) ? window.MY_TOKEN : '';

const GITHUB_REPO  = 'raeist-user/quizzap';
const GITHUB_BRANCH = 'main';
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

/* ══════════════════════════════════════
   EVENTS
══════════════════════════════════════ */

// Set up outside-click for profile dropdown once at boot
let _outsideClickReady=false;
function setupOutsideClick(){
  if(_outsideClickReady) return;
  _outsideClickReady=true;
  // Profile button toggle — attached once here, not in attach(), so it never stacks
  document.addEventListener('click', e=>{
    const wrap=document.getElementById('profile-wrap');
    const btn=document.getElementById('profile-btn');
    if(!wrap) return;
    if(btn&&btn.contains(e.target)){
      // Toggle dropdown
      document.getElementById('p-dropdown')?.classList.toggle('hidden');
      e.stopPropagation();
      return;
    }
    // Click outside — close
    if(!wrap.contains(e.target)) document.getElementById('p-dropdown')?.classList.add('hidden');
  });
  document.addEventListener('touchstart', e=>{
    const wrap=document.getElementById('profile-wrap');
    if(wrap&&!wrap.contains(e.target)) document.getElementById('p-dropdown')?.classList.add('hidden');
  },{passive:true});
}
/* ══════════════════════════════════════
   RENDER
══════════════════════════════════════ */
/* ── Screen key: identifies which logical screen is active.
   Transitions only animate when this changes, preventing flicker
   on frequent same-screen re-renders (WS score updates, timer ticks). ── */
let _screenKey = '';
let _renderPending = false;

function _getScreenKey(){
  if(!currentUser)                    return 'auth';
  if(showingDismissed)                return 'dismissed';
  if(showingHalted)                   return 'halted';
  if(inspectingUser)                  return 'inspect:'+inspectingUser.id+':'+inspectTab;
  if(showingProfile)                  return 'profile:'+profileTab;
  if(!role)                           return 'landing:'+homeSection+(homeSection==='leaderboard'?':'+homeLbTab:'');
  if(role==='host'&&!hostAuthed)      return 'host-pass';
  if(role==='host'&&hostShutdownLeaderboard) return 'host-final-lb';
  if(role==='host')                   return 'host:'+S.status;
  if(role==='participant'&&myName)    return 'participant:'+S.status;
  return 'join';
}

function render(){
  saveNavState();
  const nav=document.getElementById('main-nav');
  if(!currentUser){ nav.style.display='none'; _paintView(authHTML()); attach(); return; }

  // Safety: prevent students from accessing host views
  if(role==='host' && currentUser.role!=='host'){ role=null; hostAuthed=false; }

  const isParticipant=(role==='participant'&&myName);
  const isLanding=(!role&&!showingProfile&&!showingHalted);
  nav.style.display=(role==='host'&&hostAuthed)?'none':'flex';
  document.getElementById('nav-back-wrap').style.display=
    (!isParticipant&&(role||showingProfile||showingHalted||inspectingUser))?'block':'none';
  const navBackEl=document.getElementById('btn-nav-back');
  if(navBackEl){
    navBackEl.textContent=inspectingUser?'← Users':showingProfile?'← Home':'← Home';
  }
  document.getElementById('profile-wrap').style.display=isLanding?'flex':'none';
  document.getElementById('ci').style.display=(isParticipant||showingProfile||inspectingUser)?'none':'';
  document.getElementById('conn-lbl').style.display=(isParticipant||showingProfile||inspectingUser)?'none':'';
  document.getElementById('nav-brand').style.cssText=isParticipant?'flex:1;text-align:center;font-size:1rem':'';
  const u=currentUser;
  document.getElementById('p-avatar').textContent=u.name[0].toUpperCase();
  document.getElementById('p-name-lbl').textContent=u.name.split(' ')[0];
  document.getElementById('pd-full-name').textContent=u.name;
  document.getElementById('pd-email').textContent=u.email||(u.username?'@'+u.username:'');

  // Compute which screen we're on
  const key=_getScreenKey();
  const screenChanged=(key!==_screenKey);
  _screenKey=key;

  // Build HTML
  let html='', needTimer=false, needProfile=false, needInspect=false;
  if(showingDismissed)          { html=studentDismissedHTML(); }
  else if(showingHalted)        { html=haltedHTML(); }
  else if(inspectingUser)       { html=inspectProfileHTML(); needInspect=true; }
  else if(showingProfile)       { html=profilePageHTML();
    if(profileTab==='overview'||profileTab==='history') needProfile=true; }
  else if(!role)                { html=landingHTML(); }
  else if(role==='host'&&!hostAuthed){ html=hostPassHTML(); }
  else if(role==='host'&&hostShutdownLeaderboard){ html=hostFinalLeaderboardHTML(); }
  else if(role==='host')        { html=hostHTML(); }
  else                          { html=participantHTML(); }
  if(S.status==='question') needTimer=true;

  if(screenChanged){
    _transitionView(html, ()=>{
      attach();
      if(needTimer) startTimerDisplay();
      if(needProfile) setTimeout(loadProfileData,0);
      if(needInspect) setTimeout(loadInspectData,0);
    });
  } else {
    // Same screen — swap content silently, no animation flash
    const v=document.getElementById('view');
    if(v){ v.innerHTML=html; }
    attach();
    if(needTimer) startTimerDisplay();
    if(needProfile) setTimeout(loadProfileData,0);
    if(needInspect) setTimeout(loadInspectData,0);
  }
}

function _paintView(html){
  const v=document.getElementById('view');
  if(v){ v.className=''; v.innerHTML=html; }
}

let _transitionTimer=null;
function _transitionView(html, afterFn){
  const v=document.getElementById('view');
  if(!v){ _paintView(html); afterFn && afterFn(); return; }
  // Cancel any in-flight transition
  if(_transitionTimer){ clearTimeout(_transitionTimer); _transitionTimer=null; v.className=''; }
  // Fade out
  v.classList.add('v-exit');
  _transitionTimer=setTimeout(()=>{
    v.innerHTML=html;
    v.className='v-enter';
    // afterFn runs right after DOM paint so events are ready
    afterFn && afterFn();
    void v.offsetWidth;
    _transitionTimer=setTimeout(()=>{
      v.className='';
      _transitionTimer=null;
    }, 210);
  }, 140);
}
/* ══════════════════════════════════════
   WEBSOCKET
══════════════════════════════════════ */
let ws, myCid=null;
const WS_URL=`${location.protocol==='https:'?'wss':'ws'}://${location.host}`;
let prevStatus=null;

function connect(){
  if(ws&&(ws.readyState===0||ws.readyState===1)) return; // already connecting or open
  if(!location.host) return; // guard against invalid URL (e.g. file:// context)
  ws=new WebSocket(WS_URL);
  ws.onopen=()=>{
    setConn(true);
    if(role==='host'&&hostAuthed)          send({type:'set_host',password:HOST_PASSWORD_INPUT||''});
    else if(role==='participant'&&myName)  send({type:'join',name:myName,pid:myPid,userId:currentUser?.id});
  };
  ws.onmessage=async e=>{
    const m=JSON.parse(e.data);
    switch(m.type){
      case 'hello':     myCid=m.cid; break;
      case 'kicked':
        { const fl = m.payload?.finalLeaderboard;
          if(fl && fl.length) haltedSnapshot = fl;
          else { const fp = m.payload?.participants||S.participants||[]; if(fp.length) haltedSnapshot=[...fp]; }
          // totalQuestions comes from server (host's pushed question count) — authoritative
          haltedTotalQuestions = m.payload?.totalQuestions || S.pushedCount || 0;
          haltedTotalLabel = haltedTotalQuestions > 0 ? String(haltedTotalQuestions) : '?';
          // ── Save session to history ──────────────────────────────────────
          if(role==='participant'&&myPid){
            const kickParts=m.payload?.participants||S.participants||[];
            const kickSorted=[...kickParts].sort((a,b)=>(b.score||0)-(a.score||0));
            const kickMe=kickParts.find(p=>p.id===myPid);
            const kickScore=kickMe?.score||S.myScore||0;
            const kickRank=kickSorted.findIndex(p=>p.id===myPid)+1;
            const kickTotal=m.payload?.totalQuestions||S.pushedCount||studentQCount||0;
            const kickHistory=m.payload?.myHistory||S.myHistory||[];
            const kickCorrect=kickHistory.length
              ? kickHistory.filter(h=>h.myAnswer!==null&&h.myAnswer===h.correct).length
              : sessionCorrectTimes.length; // fallback: count of timed correct answers
            const kickFastest=sessionCorrectTimes.length?Math.round(Math.min(...sessionCorrectTimes)*1000):null;
            saveSession({date:new Date().toISOString(),score:kickScore,total:kickTotal,rank:kickRank||0,participants:kickParts.length,correct:kickCorrect,fastestMs:kickFastest});
            sessionCorrectTimes=[];
          }
        }
        showingHalted=false; showingDismissed=true; dismissedCountdown=120;

        if(dismissedTimer){clearInterval(dismissedTimer);dismissedTimer=null;}
        dismissedTimer=setInterval(()=>{
          dismissedCountdown=Math.max(0,dismissedCountdown-1);
          const cd=document.getElementById('dismissed-cd-num');
          if(cd) cd.textContent=`${Math.floor(dismissedCountdown/60)}:${String(dismissedCountdown%60).padStart(2,'0')}`;
          const ring=document.getElementById('dismissed-ring');
          if(ring) ring.style.strokeDashoffset=(125.7*(dismissedCountdown/120)).toFixed(2);
          if(dismissedCountdown<=0){clearInterval(dismissedTimer);dismissedTimer=null;doDismissHome();}
        },1000);
        render(); break;
      case 'halted':
        { const haltedParts=m.payload?.participants||S.participants||[];
          haltedSnapshot=haltedParts;
          haltedTotalQuestions = m.payload?.totalQuestions || S.pushedCount || 0;
          haltedTotalLabel = haltedTotalQuestions > 0 ? String(haltedTotalQuestions) : '?';
        }
        showingHalted=true; haltedIsPreview=false; haltedCountdown=0;
        render();
        break;
      case 'session_preview':
        // New session started — show last session's scores while waiting for first question
        { const prevParts=m.payload?.participants||[];
          haltedSnapshot=prevParts;
          haltedTotalQuestions = m.payload?.totalQuestions || S.pushedCount || 0;
          haltedTotalLabel = haltedTotalQuestions > 0 ? String(haltedTotalQuestions) : '?';
        }
        showingHalted=true; haltedIsPreview=true;
        render();
        break;
      case 'session_resumed':
        showingHalted=false; haltedIsPreview=false; haltedSnapshot=[];
        render(); break;
      case 'state': {
        const ns=m.payload.status, inc=m.payload.myScore||0;
        if(ns==='idle'&&prevStatus==='revealed'){ scoreGain=inc-prevMyScore; if(scoreGain<0)scoreGain=0; }
        if(ns==='question'){
          scoreGain=0; prevMyScore=inc;
          // Only reset per-question timing on a BRAND NEW question push (questionPushedAt changes),
          // NOT on every state update for the same question (which would wipe the student's stored time).
          if(m.payload.questionPushedAt !== S.questionPushedAt){
            myLastAnswerTime=null;
            localAnswerTimes={};
            studentQCount++;
            startTimerDisplay._lastStart=null; // force timer restart for new question
            lastFastestPid=null; // clear fastest badge so it doesn't carry over from previous question
          }
          // Clear push-stuck state
          pushing=false;
          if(pushTimeout){ clearTimeout(pushTimeout); pushTimeout=null; }
        }
        // Accumulate per-player answer times from server when question is revealed
        if(ns==='revealed'&&prevStatus==='question'){
          const revTimes=m.payload.answerTimes||{};
          for(const [pid,secs] of Object.entries(revTimes)){
            if(secs!=null) cumulativeAnswerTimes[pid]=(cumulativeAnswerTimes[pid]||0)+parseFloat(secs);
          }
          // 🔥 Update client-side streaks for participant view
          // Participants don't receive S.answers — detect correct answers via score change
          if(role==='participant'){
            const prevParts = S.participants||[];
            const newParts  = m.payload.participants||[];
            const prevScoreMap = {};
            prevParts.forEach(p=>{ prevScoreMap[p.id]=p.score||0; });
            newParts.forEach(p=>{
              const gained = (p.score||0) - (prevScoreMap[p.id]||0);
              if(gained > 0) clientStreaks[p.id]=(clientStreaks[p.id]||0)+1;
              else clientStreaks[p.id]=0;
            });
            // Fastest: participant with lowest answerTime who got it right
            // We can infer "got it right" by score gain; pick lowest answerTime among them
            const revTimes2=m.payload.answerTimes||{};
            let bestT2=Infinity, bestPid2=null;
            newParts.forEach(p=>{
              const gained=(p.score||0)-(prevScoreMap[p.id]||0);
              const t=revTimes2[p.id];
              if(gained>0 && t!=null && parseFloat(t)<bestT2){ bestT2=parseFloat(t); bestPid2=p.id; }
            });
            // Always update (null if nobody answered correctly this round)
            lastFastestPid=bestPid2;
          }
        }
        if(ns==='idle'&&prevStatus==='idle'){ prevMyScore=inc; }
        // Save session on end (natural end — all questions done)
        if(ns==='ended'&&prevStatus!=='ended'&&role==='participant'&&myPid&&!showingDismissed){
          const pts=m.payload.participants||[];
          const sorted2=[...pts].sort((a,b)=>(b.score||0)-(a.score||0));
          const myRank2=sorted2.findIndex(p=>p.id===myPid)+1;
          const hist2=m.payload.myHistory||[];
          const correct2=hist2.filter(h=>h.myAnswer!==null&&h.myAnswer===h.correct).length;
          const fastestMs=sessionCorrectTimes.length?Math.round(Math.min(...sessionCorrectTimes)*1000):null;
          saveSession({date:new Date().toISOString(),score:inc,total:hist2.length,rank:myRank2||0,participants:pts.length,correct:correct2,fastestMs});
          sessionCorrectTimes=[];
        }
        // Detect answer reveal sounds + capture correct answer timing
        if(role==='participant'){
          if(ns==='revealed'&&prevStatus==='question'){
            const myAns=m.payload.myAnswer;
            const correct=m.payload.correct;
            if(myAns!==null&&myAns!==undefined){
              setTimeout(()=>{
                if(myAns===correct){
                  playCorrect();
                  setTimeout(()=>{
                    const sm=getStreakMap();
                    const myStreak=myPid?sm[myPid]:0;
                    if(myStreak>=3) playStreakSound(myStreak);
                  }, 120);
                } else {
                  playWrong();
                }
              }, 200);
              if(myAns===correct&&myLastAnswerTime!==null) sessionCorrectTimes.push(myLastAnswerTime);
            }
          }
        }

        prevStatus=ns; S=m.payload;
        // Invalidate streak cache when history length changes
        if((S.history||[]).length !== _streakCache.histLen) _streakCache = { histLen: -1, map: {} };
        // Exit halted screen on idle (but NOT if it's a new-session preview — that waits for question)
        if(ns==='idle'&&showingHalted&&!haltedIsPreview){ showingHalted=false; haltedSnapshot=[]; }
        // Exit new-session preview when the first question of the new session is pushed
        if(ns==='question'&&showingHalted&&haltedIsPreview){ showingHalted=false; haltedIsPreview=false; haltedSnapshot=[]; }
        render(); break;
      }
      case 'joined':    myPid=m.pid; sessionStorage.setItem('qz_pid',m.pid); break;
      case 'auth_ok':   hostAuthed=true; fetchHostSchedules(); browseRepo(); fetchAdminRequests(); navPush(); render(); break;
      case 'auth_fail': { const el=document.getElementById('pw-err'); if(el)el.textContent='Incorrect password.'; break; }
      case 'left':      doLeave(); break;
      case 'hand_raised':
      case 'speak_request': {
        // Both aliases arrive here — show Allow/Dismiss popup on host
        if(role==='host') showSpeakRequestToast(m.name, m.fromCid);
        break;
      }
      case 'speak_allowed': {
        if(role==='participant'){ speakRequestPending=false; startParticipantMic(); }
        break;
      }
      case 'speak_dismissed': {
        if(role==='participant'){
          speakRequestPending=false;
          showToast('✋ Host dismissed your speak request.','neutral');
          render();
        }
        break;
      }
      case 'speak_end': {
        if(role==='participant') stopParticipantMic(true);
        break;
      }
      case 'rtc_speaker_offer': {
        if(role==='host') hostHandleSpeakerOffer(m.fromCid, m.signal);
        break;
      }
      case 'rtc_speaker_answer': {
        if(role==='participant') participantHandleSpeakerAnswer(m.signal);
        break;
      }
      case 'rtc_ice_speaker': {
        if(role==='host'&&peerConns['__speaker__'])
          peerConns['__speaker__'].addIceCandidate(new RTCIceCandidate(m.signal)).catch(()=>{});
        if(role==='participant'&&participantPeerConn)
          participantPeerConn.addIceCandidate(new RTCIceCandidate(m.signal)).catch(()=>{});
        break;
      }
      case 'report_received': {
        receivedReports = m.reports || [];
        // Update badge in-place without full re-render (avoids flicker during live quiz)
        const rb = document.getElementById('reports-badge');
        if (rb) {
          rb.textContent = receivedReports.length;
          rb.style.display = receivedReports.length ? 'flex' : 'none';
        }
        // If overlay is open, re-render to show updated list
        if (reportsOverlayOpen) render();
        break;
      }
      case 'open_session_result':
        if(m.ok){
          playMp3('start.mp3');
          showToast('✅ Session is open! Students can now join.','good');
        } else {
          showToast('❌ Failed to open session: '+m.reason+'\nTry refreshing the page.','bad');
        }
        break;
      case 'peer_list': for(const cid of m.cids) await hostCallPeer(cid); break;
      case 'rtc_new_peer': if(role==='host') await hostCallPeer(m.cid); break;
      case 'rtc_offer':    if(role==='participant') await studentHandleOffer(m.signal); break;
      case 'rtc_answer':   if(role==='host') await hostHandleAnswer(m.fromCid,m.signal); break;
      case 'rtc_ice':
        if(role==='host'&&peerConns[m.fromCid]) peerConns[m.fromCid].addIceCandidate(new RTCIceCandidate(m.signal)).catch(()=>{});
        if(role==='participant'&&remoteConn)     remoteConn.addIceCandidate(new RTCIceCandidate(m.signal)).catch(()=>{});
        break;
      case 'shutdown_complete':
        // Server has finished persisting leaderboard — refresh today's tab
        fetchLeaderboard('today');
        break;
      case 'backup_restore_result': {
        if (m.ok) {
          backupOverlayState.restoredMsg = m.message || `${m.restored||0} score(s) restored.`;
          backupOverlayState.loading = false;
          if (m.importedRanked) backupOverlayState.list = m.importedRanked;
          showToast('✅ ' + (m.message||'Backup restored!'), 'good');
        } else {
          backupOverlayState.error = m.message || 'Restore failed.';
          backupOverlayState.loading = false;
          showToast('❌ ' + (m.message||'Restore failed'), 'bad');
        }
        render();
        break;
      }
    }
  };
  ws.onclose=()=>{ setConn(false); setTimeout(connect,2000); };
  ws.onerror=()=>ws.close();
}
function send(d){ if(ws?.readyState===1) ws.send(JSON.stringify(d)); }
function setConn(on){ document.getElementById('ci').className=on?'on':'off'; document.getElementById('conn-lbl').textContent=on?'connected':'reconnecting…'; }

// Toast notifications
function showToast(msg, type='neutral'){
  let container=document.getElementById('toast-container');
  if(!container){
    container=document.createElement('div');
    container.id='toast-container';
    container.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;max-width:90vw';
    document.body.appendChild(container);
  }
  const t=document.createElement('div');
  const bg=type==='good'?'#166534':type==='bad'?'#be123c':'#1e293b';
  t.style.cssText=`background:${bg};color:#fff;padding:10px 18px;border-radius:8px;font-size:.85rem;font-weight:500;box-shadow:var(--sh-sm);pointer-events:auto;line-height:1.4;white-space:pre-wrap;text-align:center;opacity:0;transition:opacity .2s`;
  t.textContent=msg;
  container.appendChild(t);
  requestAnimationFrame(()=>{ t.style.opacity='1'; });
  setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(),220); },4000);
}

// Speak-request popup for host — Allow / Dismiss buttons, auto-vanishes in 12s
function showSpeakRequestToast(studentName, fromCid){
  // If someone is already speaking, auto-dismiss new request
  if(activeSpeakerCid){
    send({type:'speak_dismissed',toCid:fromCid});
    showToast(`⚠️ ${studentName} wants to speak but mic is already in use.`,'neutral');
    return;
  }
  let container=document.getElementById('hand-raise-container');
  if(!container){
    container=document.createElement('div');
    container.id='hand-raise-container';
    container.style.cssText='position:fixed;top:58px;right:12px;z-index:9998;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:300px;min-width:240px';
    document.body.appendChild(container);
  }
  const card=document.createElement('div');
  card.style.cssText='background:#fff;border:1.5px solid #6366f1;border-radius:12px;padding:11px 14px;pointer-events:auto;cursor:default;opacity:0;transform:translateX(30px);transition:opacity .22s,transform .22s;position:relative;overflow:hidden';
  const bar=document.createElement('div');
  bar.style.cssText='position:absolute;bottom:0;left:0;height:3px;background:#6366f1;width:100%;border-radius:0 0 10px 10px;transition:width 12s linear';
  const inner=document.createElement('div');
  inner.style.cssText='display:flex;flex-direction:column;gap:8px';
  inner.innerHTML=
    '<div style="display:flex;align-items:flex-start;gap:10px">'+
      '<div style="font-size:1.3rem;flex-shrink:0">🎙️</div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:.83rem;font-weight:700;color:#3730a3;line-height:1.3">'+esc(studentName)+' wants to speak</div>'+
        '<div style="font-size:.73rem;color:#6366f1;margin-top:2px">Allow mic so only you hear them?</div>'+
      '</div>'+
      '<div class="hr-x" style="font-size:.75rem;color:#6366f1;font-weight:600;flex-shrink:0;padding:1px 7px;background:#e0e7ff;border-radius:6px;cursor:pointer;line-height:1.6">&#x2715;</div>'+
    '</div>'+
    '<div style="display:flex;gap:7px">'+
      '<button class="hr-allow btn btn-sm" style="flex:1;justify-content:center;background:#4f46e5;color:#fff;border-color:#4f46e5;font-size:.76rem;padding:5px 8px">✓ Allow</button>'+
      '<button class="hr-dismiss btn btn-ghost btn-sm" style="flex:1;justify-content:center;font-size:.76rem;padding:5px 8px">✕ Dismiss</button>'+
    '</div>';
  card.appendChild(bar); card.appendChild(inner); container.appendChild(card);
  requestAnimationFrame(()=>{
    card.style.opacity='1'; card.style.transform='translateX(0)';
    setTimeout(()=>{ bar.style.width='0'; },30);
  });
  let startX=0, dragging=false;
  card.addEventListener('pointerdown',e=>{ startX=e.clientX; dragging=true; });
  card.addEventListener('pointermove',e=>{ if(!dragging)return; const dx=e.clientX-startX; if(dx>10) card.style.transform='translateX('+dx+'px)'; });
  card.addEventListener('pointerup',e=>{ dragging=false; if(e.clientX-startX>60) dismiss(); else card.style.transform='translateX(0)'; });
  card.addEventListener('pointercancel',()=>{ dragging=false; card.style.transform='translateX(0)'; });
  const timer=setTimeout(dismiss, 12000);
  inner.querySelector('.hr-x').addEventListener('click', dismiss);
  inner.querySelector('.hr-allow').addEventListener('click',()=>{
    clearTimeout(timer);
    activeSpeakerName=studentName; activeSpeakerCid=fromCid;
    send({type:'speak_allowed',toCid:fromCid});
    showActiveSpeakerBanner(studentName);
    dismissCard(); render();
  });
  inner.querySelector('.hr-dismiss').addEventListener('click',()=>{
    send({type:'speak_dismissed',toCid:fromCid}); dismiss();
  });
  function dismiss(){ clearTimeout(timer); dismissCard(); }
  function dismissCard(){ card.style.opacity='0'; card.style.transform='translateX(30px)'; setTimeout(()=>card.remove(),230); }
}

// Store host password input for reconnection — persisted in sessionStorage to survive refresh
let HOST_PASSWORD_INPUT = sessionStorage.getItem('scc_hpw') || '';

// ── Speak-request state (participant side) ────────────────────────────────────
let speakRequestPending = false;
let isSpeakingNow       = false;
let participantMicStream = null;
let participantPeerConn  = null;
// Speak-request state (host side)
let activeSpeakerName = null;
let activeSpeakerCid  = null;

// Floating banner on host showing who is speaking + Mute button
function showActiveSpeakerBanner(name){
  let el=document.getElementById('active-speaker-banner');
  if(!el){
    el=document.createElement('div'); el.id='active-speaker-banner';
    el.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9990;background:#4f46e5;color:#fff;border-radius:40px;padding:9px 18px;display:flex;align-items:center;gap:10px;font-size:.84rem;font-weight:600;box-shadow:0 4px 16px rgba(79,70,229,.35);pointer-events:auto';
    document.body.appendChild(el);
  }
  el.innerHTML='<span>🎙️</span><span>'+esc(name)+' is speaking</span>'+
    '<button id="btn-mute-speaker" style="background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:20px;padding:3px 13px;font-size:.77rem;font-weight:700;cursor:pointer;margin-left:4px">Mute</button>';
  el.querySelector('#btn-mute-speaker').addEventListener('click',()=>{
    send({type:'speak_end',toCid:activeSpeakerCid});
    hostCleanupSpeaker(); el.remove();
  });
}
function hostCleanupSpeaker(){
  const pc=peerConns['__speaker__'];
  if(pc){ try{pc.close();}catch(e){} delete peerConns['__speaker__']; }
  const el=document.getElementById('speaker-audio');
  if(el){ el.srcObject=null; el.remove(); }
  activeSpeakerName=null; activeSpeakerCid=null;
}

// Participant mic functions (called from speak_allowed / speak_end / btn-end-speak)
async function startParticipantMic(){
  try{
    if(participantMicStream){ participantMicStream.getTracks().forEach(t=>t.stop()); participantMicStream=null; }
    participantMicStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    isSpeakingNow=true; speakRequestPending=false;
    if(participantPeerConn){ try{participantPeerConn.close();}catch(e){} participantPeerConn=null; }
    const pc=new RTCPeerConnection(STUN); participantPeerConn=pc;
    participantMicStream.getTracks().forEach(t=>pc.addTrack(t,participantMicStream));
    pc.onicecandidate=ev=>{ if(ev.candidate) send({type:'rtc_ice_to_host_from_speaker',signal:ev.candidate.toJSON()}); };
    pc.onconnectionstatechange=()=>{ if(['failed','closed','disconnected'].includes(pc.connectionState)) stopParticipantMic(false); };
    const offer=await pc.createOffer(); await pc.setLocalDescription(offer);
    send({type:'rtc_speaker_offer',signal:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}});
    render(); showToast('🎙️ You can speak now. Host will mute you when done.','good');
  }catch(e){
    speakRequestPending=false; isSpeakingNow=false;
    showToast('❌ Microphone access denied.','bad'); render();
  }
}
function stopParticipantMic(notify=true){
  if(participantMicStream){ participantMicStream.getTracks().forEach(t=>t.stop()); participantMicStream=null; }
  if(participantPeerConn){ try{participantPeerConn.close();}catch(e){} participantPeerConn=null; }
  isSpeakingNow=false; speakRequestPending=false;
  if(notify) showToast('🔇 Host ended your speaking turn.','neutral');
  render();
}
async function participantHandleSpeakerAnswer(sdp){
  const pc=participantPeerConn; if(!pc||pc.signalingState==='stable') return;
  try{ await pc.setRemoteDescription(new RTCSessionDescription(sdp)); }catch(e){}
}
async function hostHandleSpeakerOffer(fromCid,sdp){
  const pc=new RTCPeerConnection(STUN); peerConns['__speaker__']=pc;
  pc.onicecandidate=ev=>{ if(ev.candidate) send({type:'rtc_ice_to_speaker',toCid:fromCid,signal:ev.candidate.toJSON()}); };
  pc.ontrack=ev=>{
    let el=document.getElementById('speaker-audio');
    if(!el){ el=document.createElement('audio'); el.id='speaker-audio'; el.autoplay=true; document.body.appendChild(el); }
    if(el.srcObject!==ev.streams[0]){ el.srcObject=ev.streams[0]; el.play().catch(()=>{}); }
    showToast(`🎙️ ${activeSpeakerName||'Student'} is speaking…`,'good');
  };
  pc.onconnectionstatechange=()=>{ if(['failed','closed','disconnected'].includes(pc.connectionState)) hostCleanupSpeaker(); };
  try{
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer=await pc.createAnswer(); await pc.setLocalDescription(answer);
    send({type:'rtc_speaker_answer',toCid:fromCid,signal:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}});
  }catch(e){}
}
function requestToSpeak(){
  if(speakRequestPending||isSpeakingNow) return;
  speakRequestPending=true;
  send({type:'speak_request'});
  render();
}
/* ══════════════════════════════════════
   WEBRTC HOST
══════════════════════════════════════ */
async function startMic(){
  try{
    if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;}
    localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    render(); send({type:'get_peers'});
  }catch(e){ alert('Microphone access denied.'); }
}
function stopMic(){
  if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;}
  Object.values(peerConns).forEach(pc=>pc.close());
  Object.keys(peerConns).forEach(k=>delete peerConns[k]);
  render();
}
async function hostCallPeer(cid){
  if(!localStream) return;
  if(peerConns[cid]){peerConns[cid].close();delete peerConns[cid];}
  const pc=new RTCPeerConnection(STUN); peerConns[cid]=pc;
  localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
  pc.onicecandidate=ev=>{ if(ev.candidate) send({type:'rtc_ice_to_peer',toCid:cid,signal:ev.candidate.toJSON()}); };
  pc.onconnectionstatechange=()=>{ if(['failed','closed','disconnected'].includes(pc.connectionState)){pc.close();delete peerConns[cid];} };
  try{ const offer=await pc.createOffer(); await pc.setLocalDescription(offer); send({type:'rtc_offer',toCid:cid,signal:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}}); }catch(e){}
}
async function hostHandleAnswer(cid,sdp){
  const pc=peerConns[cid]; if(!pc||pc.signalingState==='stable') return;
  try{ await pc.setRemoteDescription(new RTCSessionDescription(sdp)); }catch(e){}
}

/* ══════════════════════════════════════
   WEBRTC STUDENT
══════════════════════════════════════ */
async function studentHandleOffer(sdp){
  if(remoteConn){try{remoteConn.close();}catch(e){} remoteConn=null;}
  const pc=new RTCPeerConnection(STUN); remoteConn=pc;
  pc.onicecandidate=ev=>{ if(ev.candidate) send({type:'rtc_ice_to_host',signal:ev.candidate.toJSON()}); };
  pc.ontrack=ev=>{ const a=document.getElementById('remote-audio'); if(a&&a.srcObject!==ev.streams[0]){a.srcObject=ev.streams[0];a.play().catch(()=>{});} updateMicDot(); };
  pc.oniceconnectionstatechange=()=>updateMicDot();
  try{ await pc.setRemoteDescription(new RTCSessionDescription(sdp)); const ans=await pc.createAnswer(); await pc.setLocalDescription(ans); send({type:'rtc_answer',signal:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}}); }catch(e){}
}
function updateMicDot(){ const d=document.getElementById('mic-dot'); if(!d)return; const st=remoteConn?.iceConnectionState; d.className='mic-dot'+(st==='connected'||st==='completed'?' live':st==='failed'?' err':''); }
/* ══════════════════════════════════════
   RESOURCE BROWSER / GITHUB MANAGER
══════════════════════════════════════ */

// Upload panel state
let uploadTab='generate'; // 'generate' | 'manage'
let manageFolder=null;    // currently selected folder for editing
let editingContent='';    // textarea content while editing
let editingSha=null;      // SHA of existing file (for update)
let uploadMsg='';
let uploadSubjects=[];    // folders list for manage tab

function isValidToken() { 
  return MY_TOKEN && MY_TOKEN.length > 0;
}
// GET requests must NOT include Content-Type — triggers CORS preflight that GitHub rejects
function ghReadHeaders(){
  const h={'Accept':'application/vnd.github+json'};
  if(isValidToken()) h['Authorization']='Bearer '+MY_TOKEN;
  return h;
}
// PUT/POST/DELETE can and should include Content-Type
function ghWriteHeaders(){
  const h={'Accept':'application/vnd.github+json','Content-Type':'application/json'};
  if(isValidToken()) h['Authorization']='Bearer '+MY_TOKEN;
  return h;
}
function ghHeaders(){ return ghReadHeaders(); } // legacy alias


async function browseRepo(){
  repoPath=GITHUB_REPO;
  const msg=document.getElementById('repo-msg');
  if(msg) msg.innerHTML='<div class="notice n-neutral mt2">Loading subjects…</div>';
  repoLoading=true; render();
  try{
    const res=await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/resources?ref=${GITHUB_BRANCH}`,{headers:ghHeaders()});
    if(!res.ok) throw new Error(`GitHub API ${res.status}: Check token and repo.`);
    const items=await res.json();
    const dirs=items.filter(i=>i.type==='dir');
    if(!dirs.length) throw new Error('No subject folders found inside "resources" folder.');
    // Keep existing file selections if subject already loaded
    subjects=dirs.map(d=>{
      const existing=subjects.find(s=>s.name===d.name);
      return existing||{name:d.name,path:d.path,files:[],filesLoaded:false};
    });
    repoLoading=false;
    if(msg) msg.innerHTML='';
    render();
  }catch(e){ repoLoading=false; if(msg) msg.innerHTML=`<div class="notice n-bad mt2">${esc(e.message)}</div>`; render(); }
}

// Load all .txt files inside a subject folder (called when subject is expanded)
async function loadSubjectFiles(subjName){
  const subj=subjects.find(s=>s.name===subjName);
  if(!subj||subj.filesLoaded) return;
  try{
    const encodedPath=subj.path.split('/').map(encodeURIComponent).join('/');
    const res=await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${encodedPath}?ref=${GITHUB_BRANCH}`,{headers:ghHeaders()});
    if(!res.ok) throw new Error(`GitHub API ${res.status}`);
    const items=await res.json();
    subj.files=items
      .filter(i=>i.type==='file'&&i.name.endsWith('.txt')&&i.name!=='.gitkeep')
      .map(i=>({name:i.name,path:i.path,sha:i.sha,selected:false,count:0}));
    subj.filesLoaded=true;
    // If folder overlay is open for this subject, seed draft with newly loaded files
    if(folderOverlaySubject===subjName){
      subj.files.forEach(f=>{ if(!folderOverlayDraft[f.name]) folderOverlayDraft[f.name]={selected:f.selected,count:f.count||0}; });
      // Patch only the overlay body to avoid full-page re-render flicker
      const body=document.querySelector('.chapter-overlay-body');
      if(body){
        body.innerHTML=subj.files.length
          ?subj.files.map(f=>{
              const d=folderOverlayDraft[f.name]||{selected:false,count:0};
              return `<div class="chapter-row${d.selected?' sel':''}" data-ch-toggle="${esc(f.name)}">
                <div class="ch-check">${d.selected?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>':''}</div>
                <span class="ch-name">${esc(f.name.replace(/\.txt$/i,''))}</span>
                ${d.selected?`<input class="ch-count" type="number" min="0" max="999" value="${d.count||''}" placeholder="all" data-ch-cnt="${esc(f.name)}" title="0 or blank = all questions" onclick="event.stopPropagation()"/>`:'<span style="width:44px"></span>'}
              </div>`;
            }).join('')
          :'<p class="muted" style="padding:20px;text-align:center;font-size:.84rem">No .txt files in this folder.</p>';
        // Re-attach event listeners for the newly injected rows
        body.querySelectorAll('[data-ch-toggle]').forEach(el=>{
          el.addEventListener('click',e=>{
            if(e.target.tagName==='INPUT') return;
            const fn=el.dataset.chToggle;
            if(!folderOverlayDraft[fn]) folderOverlayDraft[fn]={selected:false,count:0};
            const nowSel=!folderOverlayDraft[fn].selected;
            folderOverlayDraft[fn].selected=nowSel;
            el.classList.toggle('sel',nowSel);
            const chk=el.querySelector('.ch-check');
            if(chk) chk.innerHTML=nowSel?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>':'';
            const existingInput=el.querySelector('.ch-count');
            const existingSpacer=el.querySelector('span[style*="width:44px"]');
            if(nowSel&&!existingInput){
              if(existingSpacer) existingSpacer.remove();
              const inp=document.createElement('input');
              inp.className='ch-count'; inp.type='number'; inp.min='0'; inp.max='999';
              inp.value=folderOverlayDraft[fn].count||''; inp.placeholder='all';
              inp.dataset.chCnt=fn; inp.title='0 or blank = all questions';
              inp.onclick=ev=>ev.stopPropagation();
              inp.addEventListener('change',()=>{ folderOverlayDraft[fn].count=Math.max(0,parseInt(inp.value)||0); });
              el.appendChild(inp);
            } else if(!nowSel&&existingInput){
              existingInput.remove();
              const sp=document.createElement('span'); sp.style.width='44px'; el.appendChild(sp);
            }
          });
        });
      }
    }
    render();
  }catch(e){ console.warn('Could not load files for',subjName,e.message); subj.filesLoaded=true; render(); }
}

async function loadUploadFolders(){
  try{
    const res=await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/resources?ref=${GITHUB_BRANCH}`,{headers:ghHeaders()});
    if(!res.ok) throw new Error(`GitHub API ${res.status}`);
    const items=await res.json();
    uploadSubjects=items.filter(i=>i.type==='dir').map(d=>({name:d.name,path:d.path}));
    render();
  }catch(e){ uploadSubjects=[]; render(); }
}

// Load all .txt files inside a folder for the manage tab
async function loadFolderFiles(folderName){
  try{
    const encoded=folderName.split('/').map(encodeURIComponent).join('/');
    const res=await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/resources/${encoded}?ref=${GITHUB_BRANCH}`,{headers:ghHeaders()});
    if(!res.ok) throw new Error(`GitHub API ${res.status}`);
    const items=await res.json();
    manageFolderFiles=items
      .filter(i=>i.type==='file'&&i.name.endsWith('.txt')&&i.name!=='.gitkeep')
      .map(i=>({name:i.name,path:i.path,sha:i.sha}));
    render();
  }catch(e){ manageFolderFiles=[]; render(); }
}

async function createFolder(){
  const inp=document.getElementById('new-folder-name');
  if(!inp) return;
  const name=inp.value.trim().replace(/[^a-zA-Z0-9_\- ]/g,'');
  if(!name){setUploadMsg('Folder name required','bad');return;}
  if(!isValidToken()){setUploadMsg('GitHub token not configured — add it to the source to enable uploads','bad');return;}
  setUploadMsg('Creating folder…','neutral');
  try{
    const path=`resources/${name}/.gitkeep`;
    const res=await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,{
      method:'PUT',headers:ghWriteHeaders(),
      body:JSON.stringify({message:`Create ${name} folder`,content:btoa(''),branch:GITHUB_BRANCH})
    });
    if(!res.ok) throw new Error(`GitHub API ${res.status}`);
    setUploadMsg(`Folder "${name}" created!`,'good');
    inp.value='';
    await loadUploadFolders();
  }catch(e){setUploadMsg(e.message,'bad');}
}

async function deleteFolder(folderName){
  if(!isValidToken()){setUploadMsg('GitHub token not configured — add it to the source to enable uploads','bad');return;}
  setUploadMsg('Deleting folder…','neutral');
  try{
    // List all files in the folder
    const res=await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/resources/${folderName}?ref=${GITHUB_BRANCH}`,{headers:ghHeaders()});
    if(!res.ok) throw new Error(`GitHub API ${res.status}`);
    const items=await res.json();
    // Delete each file
    for(const item of items){
      const dr=await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${item.path}`,{
        method:'DELETE',headers:ghWriteHeaders(),
        body:JSON.stringify({message:`Delete ${item.path}`,sha:item.sha,branch:GITHUB_BRANCH})
      });
      if(!dr.ok) throw new Error(`Failed to delete ${item.name}`);
    }
    manageFolder=null; manageEditMode=null; manageFile=null; manageFolderFiles=[]; manageNewFileName=''; editingContent=''; editingSha=null;
    setUploadMsg(`Folder "${folderName}" deleted.`,'good');
    await loadUploadFolders();
  }catch(e){setUploadMsg(e.message,'bad');}
}

async function deleteFile(folderName, fileName){
  if(!isValidToken()){setUploadMsg('GitHub token not configured','bad');return;}
  setUploadMsg(`Deleting ${fileName}…`,'neutral');
  try{
    const encodedFolder=encodeURIComponent(folderName);
    const encodedFile=encodeURIComponent(fileName);
    const apiUrl=`https://api.github.com/repos/${GITHUB_REPO}/contents/resources/${encodedFolder}/${encodedFile}`;
    // Get SHA
    const chk=await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`,{headers:ghHeaders()});
    if(!chk.ok) throw new Error(`Could not find file: ${chk.status}`);
    const d=await chk.json();
    const res=await fetch(apiUrl,{
      method:'DELETE',headers:ghWriteHeaders(),
      body:JSON.stringify({message:`Delete resources/${folderName}/${fileName}`,sha:d.sha,branch:GITHUB_BRANCH})
    });
    if(!res.ok) throw new Error(`GitHub API ${res.status}`);
    // If the deleted file was being edited, close the editor
    if(manageFile===fileName){ manageEditMode=null; manageFile=null; manageNewFileName=''; editingContent=''; editingSha=null; }
    setUploadMsg(`"${fileName}" deleted.`,'good');
    await loadFolderFiles(folderName);
  }catch(e){setUploadMsg(e.message,'bad');}
}

async function openFolderEdit(folderName, fileName){
  manageFolder=folderName; manageFile=fileName; editingContent=''; editingSha=null;
  setUploadMsg(`Loading ${esc(fileName)}…`,'neutral');
  render();
  try{
    const encodedFolder=encodeURIComponent(folderName);
    const encodedFile=encodeURIComponent(fileName);
    const res=await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/resources/${encodedFolder}/${encodedFile}?ref=${GITHUB_BRANCH}`,{headers:ghHeaders()});
    if(res.status===404){ editingContent=''; editingSha=null; setUploadMsg(`${fileName} not found. Write content below to create it.`,'neutral'); render(); return; }
    if(!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data=await res.json();
    editingSha=data.sha;
    const bytes=Uint8Array.from(atob(data.content.replace(/\n/g,'')),c=>c.charCodeAt(0));
    editingContent=new TextDecoder('utf-8').decode(bytes);
    setUploadMsg('','');
    render();
    setTimeout(()=>{ const ta=document.getElementById('q-editor'); if(ta){ ta.value=editingContent; ta.focus(); } },50);
  }catch(e){setUploadMsg(e.message,'bad');}
}

async function saveEditorContent(){
  if(!manageFolder){setUploadMsg('No folder selected','bad');return;}
  // For new files, get filename from input
  let fileName=manageFile;
  if(manageEditMode==='new'){
    const inp=document.getElementById('new-file-name-editor');
    let n=inp?inp.value.trim():manageNewFileName;
    if(!n){setUploadMsg('Enter a file name','bad');return;}
    if(!n.endsWith('.txt')) n+='.txt';
    fileName=n;
  }
  if(!fileName){setUploadMsg('No file selected','bad');return;}
  if(!isValidToken()){setUploadMsg('GitHub token not configured — add it to the source to enable uploads','bad');return;}
  const ta=document.getElementById('q-editor');
  const content=ta?ta.value:'';
  if(!content.trim()){setUploadMsg('Content is empty','bad');return;}
  setUploadMsg('Saving…','neutral');
  try{
    const encodedFolder=encodeURIComponent(manageFolder);
    const encodedFile=encodeURIComponent(fileName);
    const apiPath=`resources/${manageFolder}/${fileName}`;
    const apiUrl=`https://api.github.com/repos/${GITHUB_REPO}/contents/resources/${encodedFolder}/${encodedFile}`;
    // Always fetch latest SHA before saving to prevent 409 Conflict
    let sha=editingSha;
    if(!sha){
      const chk=await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`,{headers:ghHeaders()});
      if(chk.ok){ const d=await chk.json(); sha=d.sha; }
    }
    const body={message:`Update ${apiPath}`,content:btoa(unescape(encodeURIComponent(content))),branch:GITHUB_BRANCH};
    if(sha) body.sha=sha;
    const res=await fetch(apiUrl,{method:'PUT',headers:ghWriteHeaders(),body:JSON.stringify(body)});
    if(!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data=await res.json();
    editingSha=data.content?.sha||sha;
    manageFile=fileName;
    setUploadMsg('Saved successfully!','good');
    await loadFolderFiles(manageFolder);
  }catch(e){setUploadMsg(e.message,'bad');}
}

async function uploadQuestionsFile(){
  if(!manageFolder){setUploadMsg('Select a folder first','bad');return;}
  if(!isValidToken()){setUploadMsg('GitHub token not configured — add it to the source to enable uploads','bad');return;}
  const inp=document.getElementById('file-upload-inp');
  if(!inp||!inp.files.length){setUploadMsg('Choose a .txt file first','bad');return;}
  const file=inp.files[0];
  if(!file.name.endsWith('.txt')){setUploadMsg('Only .txt files allowed','bad');return;}
  const targetFile=file.name; // use the actual uploaded filename
  setUploadMsg('Reading file…','neutral');
  const reader=new FileReader();
  reader.onload=async(ev)=>{
    const content=ev.target.result;
    try{
      setUploadMsg('Uploading…','neutral');
      const encodedFolder=encodeURIComponent(manageFolder);
      const encodedFile=encodeURIComponent(targetFile);
      const apiUrl=`https://api.github.com/repos/${GITHUB_REPO}/contents/resources/${encodedFolder}/${encodedFile}`;
      // Fetch existing SHA to avoid 409 if file exists
      let sha=null;
      const chk=await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`,{headers:ghHeaders()});
      if(chk.ok){ const d=await chk.json(); sha=d.sha; }
      const body={message:`Upload resources/${manageFolder}/${targetFile}`,content:btoa(unescape(encodeURIComponent(content))),branch:GITHUB_BRANCH};
      if(sha) body.sha=sha;
      const res=await fetch(apiUrl,{method:'PUT',headers:ghWriteHeaders(),body:JSON.stringify(body)});
      if(!res.ok) throw new Error(`GitHub API ${res.status}`);
      setUploadMsg(`Uploaded as ${targetFile}!`,'good');
      await loadFolderFiles(manageFolder);
    }catch(err){setUploadMsg(err.message,'bad');}
  };
  reader.readAsText(file);
}

function setUploadMsg(msg,type){
  uploadMsg=msg?`<div class="notice n-${type} mt2">${esc(msg)}</div>`:'';
  const el=document.getElementById('upload-msg');
  if(el) el.innerHTML=uploadMsg;
}

async function generateQuiz(){
  const msg=document.getElementById('gen-msg'); if(!msg)return;
  const selections=[];
  subjects.forEach(s=>{
    s.files.filter(f=>f.selected).forEach(f=>selections.push({file:f,subjName:s.name}));
  });
  if(!selections.length){msg.innerHTML='<div class="notice n-bad mt2">Select at least one chapter file above.</div>';return;}
  // Denominator is now based on questions actually pushed, not questions loaded
  msg.innerHTML='<div class="notice n-neutral mt2">Fetching questions…</div>';
  let all=[];
  try{
    for(const {file,subjName} of selections){
      // Use GitHub contents API (not raw.githubusercontent.com) — avoids CORS preflight rejection
      const encodedPath=file.path.split('/').map(encodeURIComponent).join('/');
      const apiUrl=`https://api.github.com/repos/${GITHUB_REPO}/contents/${encodedPath}?ref=${GITHUB_BRANCH}`;
      const res=await fetch(apiUrl,{headers:ghHeaders()});
      if(!res.ok) throw new Error(`Could not fetch ${file.name} (HTTP ${res.status})`);
      const data=await res.json();
      // Decode base64 content (handles UTF-8 / Hindi / Urdu etc.)
      const bytes=Uint8Array.from(atob(data.content.replace(/\n/g,'')),c=>c.charCodeAt(0));
      const text=new TextDecoder('utf-8').decode(bytes);
      const parsed=parseQuestions(text);
      if(!parsed.length) throw new Error(`No valid questions found in ${file.name}`);
      const take=(file.count>0)?Math.min(file.count,parsed.length):parsed.length;
      const ordered=hostRandomize?[...parsed].sort(()=>Math.random()-.5):parsed;
      const picked=ordered.slice(0,take);
      picked.forEach(q=>{ q.subject=subjName; q.chapter=file.name.replace(/\.txt$/i,''); });
      all=[...all,...picked];
    }
    questions=all; selIdx=0; answerKey=all[0]?.correct??-1;
    msg.innerHTML=''; render();
  }catch(e){ msg.innerHTML=`<div class="notice n-bad mt2">${esc(e.message)}</div>`; }
}

/* ══════════════════════════════════════
   GITHUB QUESTION UPDATER
   Reads the source .txt file, finds the question, moves the @ marker
   to the newly selected correct option, and writes back to GitHub.
══════════════════════════════════════ */
async function updateReportedQuestionInGitHub(q, newText, newOptions, newCorrect){
  if(!q||!q.subject||!q.chapter) return {ok:false,error:'No subject/chapter info on question'};
  if(!isValidToken())             return {ok:false,error:'No GitHub token configured'};
  const fileName=q.chapter+'.txt';
  const encS=q.subject.split('/').map(encodeURIComponent).join('/');
  const encF=encodeURIComponent(fileName);
  const apiUrl=`https://api.github.com/repos/${GITHUB_REPO}/contents/resources/${encS}/${encF}?ref=${GITHUB_BRANCH}`;
  try{
    const res=await fetch(apiUrl,{headers:ghHeaders()});
    if(!res.ok) throw new Error(`Cannot read file (HTTP ${res.status})`);
    const data=await res.json();
    const bytes=Uint8Array.from(atob(data.content.replace(/\n/g,'')),c=>c.charCodeAt(0));
    const fileText=new TextDecoder('utf-8').decode(bytes);
    const lines=fileText.split('\n');
    // Find question line — strip leading "1. " numbering before comparing
    const origText=q.text.trim();
    let qi=-1;
    for(let i=0;i<lines.length;i++){
      const stripped=lines[i].trim().replace(/^\d+[.)]\s*/,'');
      if(stripped===origText&&i+1<lines.length&&/\(A\)/i.test(lines[i+1])){ qi=i; break; }
    }
    if(qi<0) return {ok:false,error:'Question not found in file — edit manually'};
    // Preserve existing number prefix  e.g. "12. "
    const pfx=(lines[qi].match(/^(\d+[.)]\s*)/))||[''];
    lines[qi]=pfx[0]+newText.trim();
    // Rebuild option line with @ on correct answer
    lines[qi+1]=newOptions.map((o,i)=>`(${['A','B','C','D'][i]}) ${o.replace(/@/g,'').trim()}${i===newCorrect?' @':''}`).join(', ');
    const newContent=lines.join('\n');
    const writeUrl=`https://api.github.com/repos/${GITHUB_REPO}/contents/resources/${encS}/${encF}`;
    const wr=await fetch(writeUrl,{method:'PUT',headers:ghWriteHeaders(),body:JSON.stringify({
      message:`Fix answer: ${newText.trim().slice(0,55)}`,
      content:btoa(unescape(encodeURIComponent(newContent))),
      sha:data.sha, branch:GITHUB_BRANCH
    })});
    if(!wr.ok) throw new Error(`Write failed (HTTP ${wr.status})`);
    return {ok:true};
  }catch(e){ return {ok:false,error:e.message}; }
}
/* ══════════════════════════════════════
   BOOT
══════════════════════════════════════ */

/* Push a history entry whenever we navigate deeper, so the phone's
   hardware/gesture back button can pop back to the previous screen. */
function navPush(){
  history.pushState({qz:true}, '', location.href);
}

// Intercept browser/phone back button
window.addEventListener('popstate', ()=>{
  // If we're somewhere deep, go back one level
  if(showingDismissed||showingProfile||role||showingHalted){
    doBack();
    // Re-push so the next back press also works
    history.pushState({qz:true}, '', location.href);
  }
});

/* ══════════════════════════════════════
   ANIMATION ENHANCEMENTS
══════════════════════════════════════ */

// Stagger lb-rows and hist-rows after each render
function animateStagger(selector, delayStep=40, maxDelay=400){
  document.querySelectorAll(selector).forEach((el,i)=>{
    el.style.animationDelay = Math.min(i*delayStep, maxDelay)+'ms';
    el.style.animationFillMode = 'backwards';
  });
}

// Score flash — briefly highlight a score cell when it changes
let _lastScores={};
function flashScoreChanges(){
  document.querySelectorAll('.lb-row, .score-row').forEach(row=>{
    const pts=row.querySelector('.score-pts, .sb-pts');
    if(!pts) return;
    const pid=row.dataset.pid||row.dataset.id||pts.textContent;
    const val=pts.textContent;
    if(_lastScores[pid]!==undefined && _lastScores[pid]!==val){
      pts.animate([
        {color:'#16a34a',transform:'scale(1.25)'},
        {color:'inherit', transform:'scale(1)'}
      ],{duration:500,easing:'cubic-bezier(.34,1.56,.64,1)'});
    }
    _lastScores[pid]=val;
  });
}

// Patch render to trigger animations
const _origRender = render;
window.render = function(){
  _origRender.apply(this, arguments);
  requestAnimationFrame(()=>{
    animateStagger('.lb-row', 35, 350);
    animateStagger('.hist-row', 45, 500);
    animateStagger('.student-chip', 30, 300);
    animateStagger('.sb-chip', 25, 200);
    animateStagger('.score-row', 35, 400);
    animateStagger('.sched-card', 50, 300);
    animateStagger('.pov-stat', 40, 200);
    flashScoreChanges();
  });
};

/* ══════════════════════════════════════
   EDITOR PICKER POPUP
══════════════════════════════════════ */
(function(){
  // Create the overlay backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'editor-picker-backdrop';
  backdrop.style.cssText = 'display:none;position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.25);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)';

  // Create the popup card
  const popup = document.createElement('div');
  popup.id = 'editor-picker-popup';
  popup.style.cssText = [
    'position:fixed;z-index:9999;background:#fff;border:1px solid #e2e0da',
    'border-radius:14px;padding:8px;min-width:220px;box-shadow:0 8px 32px rgba(14,14,18,.16)',
    'display:none;flex-direction:column;gap:4px;animation:popIn .18s cubic-bezier(.34,1.56,.64,1) both'
  ].join(';');

  popup.innerHTML = `
    <div style="padding:8px 10px 6px;font-size:.65rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#6e6e7a">Open Editor</div>
    <button id="ep-local" style="display:flex;align-items:center;gap:10px;padding:11px 12px;border:none;background:transparent;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.84rem;font-weight:600;color:#0e0e12;text-align:left;transition:background .14s ease" onmouseover="this.style.background='#f0efe9'" onmouseout="this.style.background='transparent'">
      <span style="font-size:1.1rem">📄</span>
      <span><span style="display:block">Local Editor</span><span style="font-size:.71rem;font-weight:500;color:#6e6e7a">/editor (built-in)</span></span>
    </button>
    <button id="ep-remote" style="display:flex;align-items:center;gap:10px;padding:11px 12px;border:none;background:transparent;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.84rem;font-weight:600;color:#0e0e12;text-align:left;transition:background .14s ease" onmouseover="this.style.background='#f0efe9'" onmouseout="this.style.background='transparent'">
      <span style="font-size:1.1rem">🌐</span>
      <span><span style="display:block">Page Editor</span><span style="font-size:.71rem;font-weight:500;color:#6e6e7a">pageeditor.onrender.com</span></span>
    </button>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(popup);

  function closeEditorPicker(){
    backdrop.style.display = 'none';
    popup.style.display = 'none';
  }

  window.openEditorPicker = function(e){
    e.stopPropagation();
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    // Position popup above or below the button depending on space
    const spaceBelow = window.innerHeight - rect.bottom;
    const popH = 160; // estimated popup height
    if(spaceBelow >= popH || spaceBelow >= 100){
      popup.style.top = (rect.bottom + 6) + 'px';
      popup.style.bottom = 'auto';
    } else {
      popup.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
      popup.style.top = 'auto';
    }
    // Align to button left, but clamp to viewport
    let left = rect.left;
    const popW = 224;
    if(left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    popup.style.left = Math.max(8, left) + 'px';

    backdrop.style.display = 'block';
    popup.style.display = 'flex';
  };

  document.getElementById('ep-local').addEventListener('click', function(){
    closeEditorPicker();
    location.href = '/editor';
  });

  document.getElementById('ep-remote').addEventListener('click', function(){
    closeEditorPicker();
    window.open('https://pageeditor.onrender.com/', '_blank');
  });

  backdrop.addEventListener('click', closeEditorPicker);
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeEditorPicker(); });
})();

loadStoredAuth();
loadNavState(); // restore navigation position from before reload
// Seed the history stack so popstate always has a base entry
history.replaceState({qz:true}, '', location.href);
render();
// Always connect WebSocket — needed for host-only sessions (no currentUser) and participant reconnects
connect();
if(currentUser){
  fetchSchedules();
  fetchLeaderboard();
  fetchNotice();
  if(currentUser.role==='host') fetchAdminRequests();
}
// Sync session with DB on every page load:
// - Clears session if account was deleted
// - Refreshes user data if anything was manually updated (e.g. username added)
syncAuthWithServer().then(()=>{
  render();
  if(currentUser){
    fetchSchedules();
    fetchLeaderboard();
    fetchNotice();
    if(currentUser.role==='host') fetchAdminRequests();
  }
});
