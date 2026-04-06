/* ══════════════════════════════════════
   SCORE.JS
   Leaderboard state · Streaks · Score Banner · Leaderboard Fetch
══════════════════════════════════════ */

// ── LEADERBOARD STATE (declared here so score.js loads before backend.js) ────
let allTimeLB  = null;
let todayLB    = null;
let weekLB     = null;
let homeLbTab  = 'today'; // 'today' | 'week' | 'all'
// Per-tab fetch tracking: null=not started, false=in-flight, true=settled
let lbFetched  = { today: null, week: null, all: null };
// Per-tab error messages
let lbErrors   = { today: null, week: null, all: null };

/* ══════════════════════════════════════
   🔥 STREAK HELPER
   Computes current consecutive-correct tail for every pid from S.history.
   Memoised on history length so it's O(1) on re-renders with no new question.
══════════════════════════════════════ */
function getStreakMap(){
  // Participants don't receive full S.history — use live-tracked clientStreaks
  if(role==='participant') return clientStreaks;
  // Host has full S.history
  const hist = S.history || [];
  if(hist.length === _streakCache.histLen) return _streakCache.map;
  const map = {};
  const pids = new Set();
  hist.forEach(h => Object.keys(h.answers||{}).forEach(pid => pids.add(pid)));
  pids.forEach(pid => {
    let streak = 0;
    for(let i = hist.length - 1; i >= 0; i--){
      const ans = hist[i].answers?.[pid];
      if(ans === undefined || ans === null) break;
      if(ans === hist[i].correct) streak++;
      else break;
    }
    if(streak > 0) map[pid] = streak;
  });
  _streakCache = { histLen: hist.length, map };
  return map;
}

function streakBadgeHTML(n){
  if(!n || n < 3) return '';
  const cls = n>=10?'s10':n>=8?'s8':n>=5?'s5':'s3';
  return `<span class="streak-badge ${cls}">🔥×${n}</span>`;
}

/* ══════════════════════════════════════
   SORT HELPERS + SCORE BANNER
══════════════════════════════════════ */
function sortParticipants(parts){
  return [...parts].sort((a,b)=>{
    const sd=(b.score||0)-(a.score||0);
    if(sd!==0) return sd;
    const ta=cumulativeAnswerTimes[a.id]??Infinity;
    const tb=cumulativeAnswerTimes[b.id]??Infinity;
    return ta-tb;
  });
}

function scoreBannerHTML(){
  if(!myPid||(S.status!=='question'&&S.status!=='revealed')) return '';
  const sorted=sortParticipants(S.participants||[]);
  if(!sorted.length) return '';
  const medals=['🥇','🥈','🥉'];
  const myRank=sorted.findIndex(p=>p.id===myPid)+1;
  const myP=sorted.find(p=>p.id===myPid);
  let chips=sorted.slice(0,5).map((p,i)=>`<div class="sb-chip${p.id===myPid?' me':''}"><span>${medals[i]||'#'+(i+1)}</span><span>${esc(p.name.length>12?p.name.slice(0,11)+'…':p.name)}</span><span class="sb-pts">${p.score||0}</span></div>`).join('');
  if(myRank>5&&myP) chips+=`<span style="color:var(--line);font-size:.8rem">···</span><div class="sb-chip me"><span>#${myRank}</span><span>${esc(myP.name.slice(0,11))}</span><span class="sb-pts">${myP.score||0}</span></div>`;
  return `<div class="score-banner">${chips}</div>`;
}

/* ══════════════════════════════════════
   LEADERBOARD FETCH
   Fetches today / week / all from /api/leaderboard?period=
   Each tab loads independently. Cached per-tab in todayLB / weekLB / allTimeLB.
══════════════════════════════════════ */
async function fetchLeaderboard(period){
  const periods = period ? [period] : ['today','week','all'];

  const cache = {
    today: { get:()=>todayLB,   set:(v)=>{ todayLB=v;   }, key:'today' },
    week:  { get:()=>weekLB,    set:(v)=>{ weekLB=v;    }, key:'week'  },
    all:   { get:()=>allTimeLB, set:(v)=>{ allTimeLB=v; }, key:'all'   },
  };

  periods.forEach(p => {
    cache[p].set(null);
    lbFetched[p] = false;
    lbErrors[p]  = null;
  });

  render();

  await Promise.all(periods.map(async (p) => {
    try {
      const r = await fetch('/api/leaderboard?period=' + p);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || ('Server error (' + r.status + ')'));
      cache[p].set(Array.isArray(d.leaderboard) ? d.leaderboard : []);
      lbErrors[p] = null;
    } catch(e) {
      console.error('fetchLeaderboard [' + p + ']:', e.message);
      cache[p].set([]);
      lbErrors[p] = e.message || 'Failed to load';
    } finally {
      lbFetched[p] = true;
    }
  }));

  // If viewing profile overview, patch just the rank card without full re-render
  if(showingProfile && profileTab==='overview'){
    const rc = document.getElementById('profile-rank-card');
    if(rc){ rc.outerHTML = buildRankCardHTML(); return; }
  }

  render();
}
