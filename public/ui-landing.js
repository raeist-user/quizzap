/* ══════════════════════════════════════
   LANDING (HOME)
══════════════════════════════════════ */
function landingHTML(){
  const isHost = currentUser?.role === 'host';

  const tabs=`<div class="home-tabs mb3">
    <button class="home-tab${homeSection==='home'?' active':''}" id="ht-home">🏠 Home</button>
    <button class="home-tab${homeSection==='leaderboard'?' active':''}" id="ht-lb">🏆 Leaderboard</button>
  </div>`;

  if(homeSection==='leaderboard'){
    const lbData = homeLbTab==='today' ? todayLB : homeLbTab==='week' ? weekLB : allTimeLB;
    const isLoading = lbData === null;
    const hasError  = lbErrors[homeLbTab];

    function buildRows(){
      if(isLoading){
        return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;gap:12px;color:var(--mid)">
          <div class="spinner"></div><span style="font-size:.84rem">Loading…</span></div>`;
      }
      if(hasError){
        return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;gap:10px;color:var(--mid);text-align:center">
          <div style="font-size:1.8rem">⚠️</div>
          <span style="font-size:.84rem">${esc(hasError)}</span>
          <button class="btn btn-ghost btn-sm" id="btn-lb-refresh" style="margin-top:4px">Try again</button></div>`;
      }
      if(!lbData.length){
        return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;gap:10px;color:var(--mid)">
          <div style="font-size:2.4rem">🏆</div>
          <span style="font-size:.84rem">No scores yet for this period</span></div>`;
      }
      const medals=['🥇','🥈','🥉'];
      const myId=String(currentUser?.id||'');
      const myIdx=lbData.findIndex(e=>String(e.userId)===myId);
      const rows=lbData.map((e,i)=>{
        const isMe=String(e.userId)===myId;
        const medal=medals[i]||('<span style="font-size:.75rem;color:var(--mid)">#'+(i+1)+'</span>');
        const nameWt=isMe?'700':(i<3?'600':'400');
        const youTag=isMe?' <span style="font-size:.68rem;font-weight:400;color:var(--mid)">← you</span>':'';
        return `<div class="lb-row${isMe?' me':''}">
          <div class="score-rank" style="min-width:28px;text-align:center">${medal}</div>
          <div style="flex:1;font-weight:${nameWt};min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.userName||'—')}${youTag}</div>
          <div style="display:flex;align-items:center;gap:4px;flex-shrink:0"><span class="score-pts">${e.totalScore||0}<span style="font-size:.7rem;font-weight:400;color:var(--mid)"> pts</span></span></div>
        </div>`;
      }).join('');
      if(myIdx===-1&&myId){
        return rows+`<div style="border-top:2px dashed var(--line)">
          <div class="lb-row me" style="opacity:.7">
            <div class="score-rank" style="min-width:28px;text-align:center"><span style="font-size:.75rem;color:var(--mid)">—</span></div>
            <div style="flex:1;font-weight:700;min-width:0">${esc(currentUser.name||'—')} <span style="font-size:.68rem;font-weight:400;color:var(--mid)">← you · not ranked yet</span></div>
            <div class="score-pts">0<span style="font-size:.7rem;font-weight:400;color:var(--mid)"> pts</span></div>
          </div></div>`;
      }
      return rows;
    }

    const tabDefs=[
      {id:'today',label:'📅 Today',sub:'Scores earned today'},
      {id:'week', label:'📆 Week', sub:'Scores from the last 7 days'},
      {id:'all',  label:'🏆 All-time',sub:'Cumulative scores across all sessions'},
    ];
    const activeDef=tabDefs.find(t=>t.id===homeLbTab);
    const tabBar=`<div style="display:flex;border:1px solid var(--line);border-radius:var(--r);overflow:hidden;margin-bottom:14px">
      ${tabDefs.map(t=>`<button data-hlb="${t.id}"
          style="flex:1;padding:8px 4px;font-size:.8rem;font-weight:500;border:none;cursor:pointer;
                 background:${homeLbTab===t.id?'var(--ink)':'var(--faint)'};
                 color:${homeLbTab===t.id?'#fff':'var(--mid)'};
                 transition:background .15s;border-right:1px solid var(--line)"
        >${t.label}</button>`).join('')}
    </div>`;
    const count=(!isLoading&&!hasError&&lbData?.length)?lbData.length:null;
    const countTag=count!==null?`<span style="font-size:.74rem;color:var(--mid)">${count} player${count!==1?'s':''}</span>`:'';

    return `<div class="lb-full-screen">
      <div class="lb-full-inner">
        ${isHost ? controlPanelHTML() : ''}
        ${tabs}
        ${tabBar}
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:6px">
          <span style="font-size:.8rem;color:var(--mid)">${esc(activeDef?.sub||'')}</span>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            ${countTag}
            <button class="btn btn-ghost btn-sm" id="btn-lb-refresh" title="Refresh">↻</button>
          </div>
        </div>
        <div class="score-list" style="overflow-y:auto;flex:1;border-radius:var(--r)">${buildRows()}</div>
      </div>
    </div>`;
  }

  // ── HOME section ──────────────────────────────────────────────────────────
  const n=(S.participants||[]).length;
  const nextS=serverSchedules&&serverSchedules.length?serverSchedules[0]:null;
  const schedHint=nextS
    ?`<div class="notice n-accent mt3" style="text-align:left;font-size:.8rem">
        📅 Next: <strong>${esc(nextS.title)}</strong> · ${new Date(nextS.ts).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} at ${new Date(nextS.ts).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})} (${cdStr(nextS.ts)})
      </div>`
    :'';

  // Notice display for students
  const noticeDisplay=(!isHost&&hostNotice)
    ?`<div class="student-notice">
        <div class="student-notice-label">📢 Notice from Host</div>
        ${esc(hostNotice)}
      </div>`
    :'';

  // Buttons differ by role
  const actionButtons = isHost
    ? `<button class="btn btn-dark btn-lg" id="go-host">🖥 Host Interface</button>
       <button class="btn btn-ghost btn-lg" id="go-selfquiz" style="margin-top:2px">📝 Self Quiz</button>`
    : `<button class="btn btn-dark btn-lg" id="go-join">🎓 Join Session</button>`;

  return `<div class="lb-full-screen">
    <div class="lb-full-inner">
      ${isHost ? controlPanelHTML() : ''}
      ${tabs}
      <h1 class="mb1">Live Quiz</h1>
      <p class="muted mb3">Welcome, ${esc(currentUser.name.split(' ')[0])} 👋</p>
      <div class="col gap3">
        ${actionButtons}
      </div>
      ${noticeDisplay}
      ${n?`<p class="muted small mt3" style="text-align:center">${n} student${n!==1?'s':''} in session</p>`:''}
      ${schedHint}
    </div>
    <div style="text-align:center;padding:12px 0 4px;flex-shrink:0">
      <button id="btn-fetch-updates" class="btn btn-ghost btn-sm" style="gap:6px;font-size:.75rem;color:var(--mid)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        Fetch Updates
      </button>
      <p style="font-size:.68rem;color:var(--mid);margin-top:4px;opacity:.65">Tap if changes aren't showing up</p>
    </div>
  </div>`;
}

/* ══════════════════════════════════════
   HALTED SCREEN (students)
══════════════════════════════════════ */
function haltedHTML(){
  const sorted=sortParticipants(haltedSnapshot);
  const medals=['🥇','🥈','🥉'];
  const myP=sorted.find(p=>p.id===myPid);
  const myRank=sorted.findIndex(p=>p.id===myPid)+1;
  const total=haltedTotalQuestions||0;
  const totalStr=total>0?String(total):'?';
  const rows=sorted.length
    ?sorted.map((p,i)=>`
      <div class="lb-row${p.id===myPid?' me':''}">
        <div class="score-rank">${medals[i]||('#'+(i+1))}</div>
        <div style="flex:1;font-weight:${i<3?'600':'400'}">${esc(p.name)}${p.id===myPid?' <span style="font-size:.68rem;color:var(--mid)">(you)</span>':''}</div>
        <div class="score-pts"><span style="font-weight:700">${p.score||0}</span><span style="font-size:.7rem;color:var(--mid);font-weight:400">/${totalStr}</span></div>
      </div>`).join('')
    :`<div style="padding:20px;text-align:center;color:var(--mid)">No scores yet.</div>`;
  return `<div style="display:flex;flex-direction:column;height:calc(100vh - 54px);overflow:hidden;padding:16px 20px;max-width:520px;margin:0 auto">
    <div style="text-align:center;padding:20px 0 16px;flex-shrink:0">
      <div style="font-size:2.4rem;margin-bottom:10px;animation:blink 1.4s ease-in-out infinite">⏸</div>
      <h2 style="margin-bottom:6px">Session paused</h2>
      <p class="muted small">The host has paused the quiz.<br>Please wait patiently — they may continue<br>or start a new session shortly.</p>
      ${myP?`<div style="margin-top:10px;display:inline-flex;align-items:center;gap:7px;padding:5px 13px;background:#e8f5ee;border:1px solid #b7dfc7;border-radius:20px;font-size:.77rem;font-weight:600;color:#166534">Score: ${myP.score||0}/${totalStr} &nbsp;·&nbsp; Rank #${myRank}</div>`:''}
    </div>
    <div class="lb-panel" style="flex:1;overflow:hidden;display:flex;flex-direction:column">
      <div class="lb-head"><span style="font-size:.82rem;font-weight:600">🏆 Current Standings</span><span class="small muted">${sorted.length} student${sorted.length!==1?'s':''}</span></div>
      <div style="overflow-y:auto;flex:1">${rows}</div>
    </div>
  </div>`;
}

/* ══════════════════════════════════════
   DISMISSED SCREEN
══════════════════════════════════════ */
function studentDismissedHTML(){
  const sorted=sortParticipants(haltedSnapshot);
  const medals=['🥇','🥈','🥉'];
  const myP=sorted.find(p=>p.id===myPid);
  const myRank=sorted.findIndex(p=>p.id===myPid)+1;
  const total=haltedTotalQuestions||0;
  const totalStr=total>0?String(total):'?';
  const rows=sorted.length
    ?sorted.map((p,i)=>`
      <div class="lb-row${p.id===myPid?' me':''}">
        <div class="score-rank">${medals[i]||('#'+(i+1))}</div>
        <div style="flex:1;font-weight:${i<3?'600':'400'}">${esc(p.name)}${p.id===myPid?' <span style="font-size:.68rem;color:var(--mid)">(you)</span>':''}</div>
        <div class="score-pts"><span style="font-weight:700">${p.score||0}</span><span style="font-size:.7rem;color:var(--mid);font-weight:400">/${totalStr}</span></div>
      </div>`).join('')
    :`<div style="padding:20px;text-align:center;color:var(--mid)">No scores yet.</div>`;
  const circ=125.7;
  const offset=(circ*(dismissedCountdown/120)).toFixed(1);
  return `<div style="display:flex;flex-direction:column;height:calc(100vh - 54px);overflow:hidden;padding:16px 20px;max-width:520px;margin:0 auto">
    <div style="text-align:center;padding:18px 0 12px;flex-shrink:0">
      <div style="position:relative;width:72px;height:72px;margin:0 auto 14px">
        <svg width="72" height="72" viewBox="0 0 72 72" style="transform:rotate(-90deg)">
          <circle cx="36" cy="36" r="20" fill="none" stroke="var(--line)" stroke-width="4"/>
          <circle id="dismissed-ring" cx="36" cy="36" r="20" fill="none" stroke="var(--bad)" stroke-width="4"
            stroke-dasharray="${circ}" stroke-dashoffset="${offset}" style="transition:stroke-dashoffset 1s linear"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:700;color:var(--bad);line-height:1" id="dismissed-cd-num">${Math.floor(dismissedCountdown/60)}:${String(dismissedCountdown%60).padStart(2,'0')}</div>
      </div>
      <div style="font-size:2rem;margin-bottom:8px">🎓</div>
      <h2 style="margin-bottom:5px">Session has ended</h2>
      <p class="muted small">The host has closed this session.<br>Going home in ${Math.floor(dismissedCountdown/60)}m ${dismissedCountdown%60}s.</p>
      ${myP?`<div style="margin-top:10px;display:inline-flex;align-items:center;gap:7px;padding:5px 13px;background:#e8f5ee;border:1px solid #b7dfc7;border-radius:20px;font-size:.77rem;font-weight:600;color:#166534">Final: ${myP.score||0}/${totalStr} &nbsp;·&nbsp; #${myRank} of ${sorted.length}</div>`:''}
      <div style="margin-top:14px">
        <button class="btn btn-dark" id="btn-dismissed-home" style="gap:7px;padding:9px 22px">🏠 Go Home Now</button>
      </div>
    </div>
    <div style="font-size:.67rem;text-align:center;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--mid);margin-bottom:6px;flex-shrink:0">🏆 Final Leaderboard</div>
    <div class="lb-panel" style="flex:1;overflow:hidden;display:flex;flex-direction:column;margin-top:0">
      <div class="lb-head"><span style="font-size:.82rem;font-weight:600">Final Standings</span><span class="small muted">${sorted.length} student${sorted.length!==1?'s':''}</span></div>
      <div style="overflow-y:auto;flex:1">${rows}</div>
    </div>
  </div>`;
}
