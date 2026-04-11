/* ══════════════════════════════════════
   AUTH SCREENS
══════════════════════════════════════ */
let authTab='login';
function authHTML(){
  return `<div class="auth-page">
    <div class="auth-box">
      <div class="auth-logo">📚 Shadab Coaching Centre</div>
      <div class="auth-sub">Sign in to join or host live quizzes</div>
      <div class="auth-tabs">
        <button class="auth-tab${authTab==='login'?' active':''}" id="tab-login">Sign in</button>
        <button class="auth-tab${authTab==='register'?' active':''}" id="tab-register">Register</button>
      </div>
      ${authTab==='login'?loginFormHTML():registerFormHTML()}
    </div>
  </div>`;
}
function loginFormHTML(){
  return `<div>
    <div class="form-group"><label class="form-label">Email or username</label><input class="form-input" type="text" id="auth-identifier" placeholder="you@gmail.com or your_username" autocomplete="username" autocapitalize="none" spellcheck="false"/></div>
    <div class="form-group"><label class="form-label">Password</label><input class="form-input" type="password" id="auth-pw" placeholder="••••••••" autocomplete="current-password"/></div>
    <div id="auth-err" class="form-error"></div>
    <button class="btn btn-dark btn-full mt2" id="btn-login">Sign in →</button>
  </div>`;
}
function registerFormHTML(){
  return `<div>
    <div class="form-group"><label class="form-label">Full name</label><input class="form-input" type="text" id="auth-name" placeholder="Your name" autocomplete="name"/></div>
    <div class="form-group"><label class="form-label">Email</label><input class="form-input" type="email" id="auth-email" placeholder="you@example.com" autocomplete="email" autocapitalize="none" spellcheck="false"/></div>
    <div class="form-group"><label class="form-label">Username <span style="font-weight:400;color:var(--mid);font-size:.8rem">(optional)</span></label><div style="position:relative"><input class="form-input" type="text" id="auth-username" placeholder="your_username" autocomplete="off" autocapitalize="none" spellcheck="false" style="padding-right:36px"/><span id="un-status" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:.85rem;line-height:1;pointer-events:none"></span></div><small id="un-hint" style="font-size:.72rem;margin-top:3px;display:block;color:var(--mid)">Letters, numbers, underscores only · 3–30 characters · used to sign in</small></div>
    <div class="form-group"><label class="form-label">Password <span style="font-weight:400;text-transform:none;letter-spacing:0">(min 6 chars)</span></label><input class="form-input" type="password" id="auth-pw" placeholder="••••••••" autocomplete="new-password"/></div>
    <div id="auth-err" class="form-error"></div>
    <button class="btn btn-dark btn-full mt2" id="btn-register">Create account →</button>
  </div>`;
}
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

  if(haltedIsPreview){
    // New session — show previous session results while waiting for next question
    return `<div style="display:flex;flex-direction:column;height:calc(100vh - 54px);overflow:hidden;padding:16px 20px;max-width:520px;margin:0 auto">
      <div style="text-align:center;padding:20px 0 16px;flex-shrink:0">
        <div style="font-size:2.4rem;margin-bottom:10px">🏁</div>
        <h2 style="margin-bottom:6px">Session complete!</h2>
        <p class="muted small">The host will push new questions soon.<br>Your score resets to 0 for the new session.</p>
        ${myP?`<div style="margin-top:10px;display:inline-flex;align-items:center;gap:7px;padding:5px 13px;background:#e8f5ee;border:1px solid #b7dfc7;border-radius:20px;font-size:.77rem;font-weight:600;color:#166534">Previous: ${myP.score||0}/${totalStr} &nbsp;·&nbsp; Rank #${myRank}</div>`:''}
      </div>
      <div style="font-size:.67rem;text-align:center;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--mid);margin-bottom:6px;flex-shrink:0">📋 Previous Session Results</div>
      <div class="lb-panel" style="flex:1;overflow:hidden;display:flex;flex-direction:column">
        <div class="lb-head"><span style="font-size:.82rem;font-weight:600">Final Standings</span><span class="small muted">${sorted.length} student${sorted.length!==1?'s':''}</span></div>
        <div style="overflow-y:auto;flex:1">${rows}</div>
      </div>
    </div>`;
  }

  // Normal halt — session paused
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
/* ══════════════════════════════════════
   CONTROL PANEL (host only — between nav and home tabs)
══════════════════════════════════════ */
function controlPanelHTML(){
  const jrBadge=joinRequests.length?`<span class="req-badge">${joinRequests.length}</span>`:'';
  const urBadge=updateRequests.length?`<span class="req-badge">${updateRequests.length}</span>`:'';

  // Join Requests box
  const jrRows=joinRequests.length
    ?joinRequests.map(r=>`
      <div class="req-item">
        <div class="req-item-info">
          <div class="req-item-name">${esc(r.name)}</div>
          <div class="req-item-sub">${esc(r.email)}${r.username?' · @'+esc(r.username):''}</div>
        </div>
        <div class="req-actions">
          <button class="btn btn-good btn-sm" style="padding:3px 9px;font-size:.7rem" data-jr-approve="${r.id}">✓</button>
          <button class="btn btn-bad btn-sm" style="padding:3px 9px;font-size:.7rem" data-jr-reject="${r.id}">✕</button>
        </div>
      </div>`).join('')
    :`<div class="req-empty">No pending join requests</div>`;

  // Update Requests box
  const urRows=updateRequests.length
    ?updateRequests.map(r=>`
      <div class="req-item">
        <div class="req-item-info">
          <div class="req-item-name">${esc(r.userName)} <span style="font-size:.68rem;font-weight:400;color:var(--mid)">wants to change ${r.type}</span></div>
          <div class="req-item-sub">→ <strong>${esc(r.newValue)}</strong></div>
        </div>
        <div class="req-actions">
          <button class="btn btn-good btn-sm" style="padding:3px 9px;font-size:.7rem" data-ur-approve="${r.id}">✓</button>
          <button class="btn btn-bad btn-sm" style="padding:3px 9px;font-size:.7rem" data-ur-reject="${r.id}">✕</button>
        </div>
      </div>`).join('')
    :`<div class="req-empty">No pending update requests</div>`;

  return `<div class="ctrl-panel">
    <div class="ctrl-panel-head">
      <span class="ctrl-panel-title">⚙️ Control Panel</span>
      <button class="btn btn-ghost btn-sm" id="btn-cp-refresh" style="font-size:.7rem;padding:3px 9px">↻ Refresh</button>
    </div>

    <!-- Box-button row -->
    <div class="cp-btn-row">
      <button class="cp-btn" id="cpbtn-join" onclick="cpToggle('join')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
        <span class="cp-btn-label">Join Requests</span>
        ${joinRequests.length?`<span class="cp-btn-badge">${joinRequests.length}</span>`:''}
      </button>
      <button class="cp-btn" id="cpbtn-update" onclick="cpToggle('update')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        <span class="cp-btn-label">Update Requests</span>
        ${updateRequests.length?`<span class="cp-btn-badge">${updateRequests.length}</span>`:''}
      </button>
      <button class="cp-btn" id="cpbtn-notice" onclick="cpToggle('notice')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span class="cp-btn-label">Global Notice</span>
        ${hostNotice?'<span class="cp-btn-active">ON</span>':''}
      </button>
      <button class="cp-btn" id="cpbtn-users" onclick="cpToggle('users')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span class="cp-btn-label">Registered Users</span>
        ${registeredUsers.length?('<span style="position:absolute;bottom:4px;right:5px;font-size:.52rem;color:#9ca3af;font-weight:600">'+registeredUsers.length+'</span>'):''}
      </button>
    </div>

    <!-- Expandable panels -->
    <div class="cp-panel" id="cppanel-join">
      <div class="cp-panel-head">
        <span class="cp-panel-title">Join Requests</span>
        ${joinRequests.length?`<span class="req-badge">${joinRequests.length}</span>`:''}
      </div>
      <div style="max-height:200px;overflow-y:auto">${jrRows}</div>
    </div>

    <div class="cp-panel" id="cppanel-update">
      <div class="cp-panel-head">
        <span class="cp-panel-title">Update Requests</span>
        ${updateRequests.length?`<span class="req-badge">${updateRequests.length}</span>`:''}
      </div>
      <div style="max-height:200px;overflow-y:auto">${urRows}</div>
    </div>

    <div class="cp-panel" id="cppanel-notice">
      <div class="cp-panel-head">
        <span class="cp-panel-title">Global Notice</span>
        <span style="font-size:.68rem;color:var(--mid)">Broadcasts to all students</span>
      </div>
      <div class="notice-board-body">
        <textarea id="notice-input" placeholder="Type a notice for students…" maxlength="500">${esc(hostNotice)}</textarea>
        <button class="btn btn-dark btn-sm" id="btn-notice-post" style="flex-shrink:0;padding:8px 14px">Post</button>
      </div>
    </div>

    <div class="cp-panel" id="cppanel-users">
      <div class="cp-panel-head">
        <span class="cp-panel-title">Registered Users</span>
        <span style="font-size:.68rem;color:var(--mid)">${registeredUsers.length} account${registeredUsers.length===1?'':'s'}</span>
      </div>
      <div style="max-height:260px;overflow-y:auto">
        ${registeredUsers.length ? registeredUsers.map(u=>`
          <div class="user-inspect-row" onclick="openInspect('${u.id}')">
            <div class="user-inspect-info">
              <div class="user-inspect-name">
                <span class="name">${esc(u.name)}</span>
                <span class="user-role-pill" style="background:${u.role==='host'?'#7c3aed':'#0ea5e9'}">${u.role}</span>
              </div>
              <div class="user-inspect-sub">${esc(u.email)}${u.username?' · @'+esc(u.username):''}</div>
            </div>
            <svg style="flex-shrink:0;color:var(--mid)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,18 15,12 9,6"/></svg>
          </div>`).join('')
        : '<div class="req-empty">No registered users</div>'}
      </div>
    </div>
  </div>`;
}
/* ══════════════════════════════════════
   PARTICIPANT
══════════════════════════════════════ */
function participantHTML(){
  // Gate: if session not open and not yet joined, show no-session screen
  if(!S.sessionOpen&&!myName) return noSessionHTML();
  if(!myName)            return joinHTML();
  if(S.status==='idle')  return waitHTML();
  if(S.status==='ended') return studentEndHTML();
  return questionViewHTML();
}

function noSessionHTML(){
  const scheds=serverSchedules;
  const next=scheds&&scheds.length?scheds[0]:null;
  return `<div class="center"><div class="box" style="text-align:center">
    <div style="font-size:2.5rem;margin-bottom:16px">📚</div>
    <h2 class="mb2">No session active</h2>
    ${next
      ?`<p class="muted mb3">The next scheduled session:</p>
        <div class="sched-card" style="text-align:left;margin:0 auto 20px;max-width:320px">
          <div class="sched-date-blk"><div class="sched-day">${new Date(next.ts).getDate()}</div><div class="sched-mon">${new Date(next.ts).toLocaleString('en',{month:'short'})}</div></div>
          <div class="sched-info">
            <div class="sched-title">${esc(next.title)}</div>
            <div class="sched-meta">${new Date(next.ts).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}${next.notes?' · '+esc(next.notes):''}</div>
            <div class="sched-cd">${cdStr(next.ts)}</div>
          </div>
        </div>`
      :`<p class="muted mb3">There are no sessions scheduled.<br>Wait till the host starts a session.</p>`}
    <button class="btn btn-ghost btn-sm" id="btn-back-home">← Back</button>
  </div></div>`;
}

function joinHTML(){
  const name=currentUser?.name||'';
  const initials=name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?';
  return `<div class="center"><div class="box">
    <h2 class="mb1">Join session</h2>
    <p class="muted mb3">You'll join as:</p>
    <div style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--faint);border:1px solid var(--line);border-radius:var(--r);margin-bottom:20px">
      <div style="width:38px;height:38px;border-radius:50%;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.9rem;font-weight:600;flex-shrink:0">${initials}</div>
      <div style="min-width:0">
        <div style="font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
        <div class="muted small">${currentUser?.username?'@'+esc(currentUser.username):''}</div>
      </div>
    </div>
    <button class="btn btn-dark btn-full" id="btn-enter">Join →</button>
  </div></div>`;
}

function waitHTML(){
  const parts=S.participants||[];
  const myP=parts.find(p=>p.id===myPid);
  const history=S.myHistory||[];
  const waitMsg=history.length?'Wait for next question\u2026':'Waiting for host to start\u2026';
  const medals=['🥇','🥈','🥉'];

  // ALL students always shown, even with 0 score
  const sortedParts=sortParticipants(parts);

  // 🔥 Fastest finger: use persisted lastFastestPid (survives revealed → idle transition)
  const fastestPidP = lastFastestPid;

  // 🔥 Streak map for participant view (clientStreaks, score-diff-tracked)
  const streakMapP = getStreakMap();

  let lbRows='';
  sortedParts.forEach((p,i)=>{
    const isMe=p.id===myPid;
    const online=p.online!==false;
    const cumTime=cumulativeAnswerTimes[p.id]??null;
    const cumTimeStr=cumTime!==null?(cumTime).toFixed(2)+'s':'';
    const lastH=isMe&&history.length?history[history.length-1]:null;
    const answeredLast=lastH&&lastH.myAnswer!==null&&lastH.myAnswer!==undefined;
    const gotRight=answeredLast&&lastH.myAnswer===lastH.correct;
    const scoreColor=isMe&&answeredLast?(gotRight?'#16a34a':'var(--ink)'):'inherit';
    const isFastP=p.id===fastestPidP;
    const pStreak=streakMapP[p.id]||0;
    const rowBg=isFastP?';background:#fffbeb':'';
    lbRows+='<div class="lb-row'+(isMe?' me':'')+(online?'" style="border-left:2px solid #b7dfc7'+rowBg:'"'+(rowBg?' style="'+rowBg.slice(1)+'"':''))+'">'+
      '<div class="score-rank">'+(medals[i]||('#'+(i+1)))+'</div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(p.name)+(isMe?' <span style="font-size:.7rem;color:var(--mid)">\u2190 you</span>':'')+'</div>'+
        ((isFastP||pStreak>=3)?'<div style="display:flex;gap:4px;margin-top:2px">'+
          (isFastP?'<span class="ff-badge">⚡ Fastest</span>':'')+
          streakBadgeHTML(pStreak)+
        '</div>':'')+
      '</div>'+
      (cumTimeStr?'<span style="font-size:.68rem;color:var(--mid);min-width:42px;text-align:right;margin-right:5px" title="Cumulative answer time">⏱'+cumTimeStr+'</span>':'')+
      '<div class="score-pts" style="color:'+scoreColor+';font-weight:600">'+(p.score||0)+'</div>'+
      '</div>';
  });

  let lbHTML='';
  if(history.length){
    // After at least one question: show full leaderboard with scores
    lbHTML='<div class="lb-panel">'+
      '<div class="lb-head"><span style="font-size:.82rem;font-weight:600">🏆 Leaderboard</span><span class="small muted">'+parts.length+' students</span></div>'+
      (lbRows||'<div style="padding:16px;text-align:center;color:var(--mid);font-size:.82rem">No students yet.</div>')+
      '</div>';
  } else if(parts.length){
    // Before any question: show who has joined as chips with online/offline indicator
    const chips=parts.map(p=>{
      const isMe=p.id===myPid;
      // Only highlight the current student's own chip as green
      const avatarBg=isMe?'#16a34a':'var(--line)';
      const chipBorder=isMe?'1px solid #b7dfc7':'1px solid var(--line)';
      const chipBg=isMe?'#f0fdf4':'var(--white)';
      return '<div class="student-chip" style="background:'+chipBg+';border:'+chipBorder+'">'+
        '<div class="s-av" style="background:'+avatarBg+';color:#fff;border:none">'+esc(p.name.slice(0,2).toUpperCase())+'</div>'+
        '<span>'+esc(p.name)+(isMe?' <span style="font-size:.68rem;color:var(--mid)">\u2190 you</span>':'')+'</span>'+
        '</div>';
    }).join('');
    lbHTML='<div style="width:100%;max-width:480px;margin-top:4px">'+
      '<div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--mid);margin-bottom:8px;text-align:center">'+parts.length+' student'+(parts.length!==1?'s':'')+' joined</div>'+
      '<div class="student-grid">'+chips+'</div>'+
      '</div>';
  }

  return '<div class="wait-shell">'+
    '<div class="wait-header">'+
      '<div class="spinner"></div>'+
      '<h2>'+waitMsg+'</h2>'+
      '<p class="muted mt1">'+parts.length+' student'+(parts.length!==1?'s':'')+' in the room</p>'+
    '</div>'+
    '<div class="voice-bar" style="max-width:480px;width:100%;margin-bottom:8px">'+
      '<div id="mic-dot" class="mic-dot"></div>'+
      '<span style="flex:1;color:var(--mid);font-size:.8rem">Host voice</span>'+
    '</div>'+
    (isSpeakingNow
      ? '<div style="display:flex;align-items:center;gap:6px;margin-bottom:14px;max-width:480px;width:100%">'+
          '<div style="display:flex;align-items:center;gap:7px;padding:7px 14px;background:#ede9fe;border:1.5px solid #6366f1;border-radius:40px;font-size:.82rem;font-weight:600;color:#4338ca;flex:1">'+
            '<span>🎙️</span>'+
            'You\'re speaking — mic is live'+
          '</div>'+
          '<button class="btn btn-sm" style="background:#fee2e2;color:#be123c;border-color:#fecdd3;font-size:.76rem" id="btn-end-speak">Done</button>'+
        '</div>'
      : speakRequestPending
        ? '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:8px 14px;background:#f5f3ff;border:1.5px solid #a5b4fc;border-radius:40px;font-size:.82rem;color:#4338ca;max-width:480px;width:100%">'+
            '<div style="width:14px;height:14px;border:2px solid #a5b4fc;border-top-color:#6366f1;border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0"></div>'+
            'Waiting for host to allow…'+
          '</div>'
        : '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">'+
            '<button class="btn btn-ghost btn-sm" id="btn-leave">Leave session</button>'+
            '<button class="btn btn-ghost btn-sm" id="btn-raise-hand" style="gap:5px;font-size:.8rem">✋ Request to Speak</button>'+
          '</div>'
    )+
    lbHTML+
    '</div>';
}

function questionViewHTML(){
  const q=S.question; if(!q) return waitHTML();
  const answered=S.myAnswer!==null&&S.myAnswer!==undefined;
  const revealed=S.status==='revealed', correct=S.correct;
  const opts=q.options.map((o,i)=>{
    let cls='opt-card';
    if(revealed){cls+=' locked';if(i===S.myAnswer){cls+=(i===correct?' correct':' wrong-chosen');}}
    else if(answered){cls+=' locked';if(i===S.myAnswer)cls+=' chosen';}
    else if(i===S.myAnswer) cls+=' chosen';
    return `<div class="${cls}" data-opt="${i}"><div class="opt-key">${'ABCD'[i]}</div><span class="${''+urduCls(q)}">${renderMath(o)}</span></div>`;
  }).join('');
  let notice='';
  if(revealed&&answered){ const ok=S.myAnswer===correct; notice=`<div class="notice ${ok?'n-good':'n-bad'} mt3">${ok?'✓ Correct — +1 point':`✗ Wrong. Correct: ${esc(q.options[correct])}`}</div>`; }
  else if(answered&&!revealed){ notice=`<div class="notice n-neutral mt3">Answer submitted — waiting for reveal.</div>`; }
  const hasTimer=S.timerSeconds&&S.status==='question';
  // Report button: visible after reveal so student can flag wrong answer key
  const canReport=revealed&&q&&!myReportedQuestions.has(q.text);
  const alreadyReported=revealed&&q&&myReportedQuestions.has(q.text);
  const reportRow=revealed?`<div style="text-align:center;margin-top:14px">${canReport?`<button class="btn btn-ghost btn-sm" id="btn-report-q" style="color:var(--mid);font-size:.73rem;gap:5px;padding:5px 13px;border-color:var(--line)"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>Report wrong answer</button>`:alreadyReported?`<span style="font-size:.72rem;color:var(--good)">✓ Reported — thanks for flagging</span>`:''}</div>`:'';
  return `${scoreBannerHTML()}<div class="page">
    <div class="row between mb2">
      <div class="row gap2"><div id="mic-dot" class="mic-dot"></div><span class="small muted">Score: <strong>${S.myScore||0}</strong> pts</span></div>
      <div class="row gap2">
        ${isSpeakingNow
          ? `<button class="btn btn-sm" id="btn-end-speak" style="gap:4px;font-size:.78rem;background:#ede9fe;color:#4338ca;border-color:#a5b4fc">🎙️ Done Speaking</button>`
          : speakRequestPending
            ? `<button class="btn btn-ghost btn-sm" disabled style="gap:4px;font-size:.78rem;opacity:.6"><span style="display:inline-block;width:10px;height:10px;border:2px solid #a5b4fc;border-top-color:#6366f1;border-radius:50%;animation:spin .8s linear infinite"></span> Waiting…</button>`
            : `<button class="btn btn-ghost btn-sm" id="btn-raise-hand" style="gap:4px;font-size:.78rem" title="Request to speak">✋ Speak</button>`
        }
        <button class="btn btn-ghost btn-sm" id="btn-leave">Leave</button>
      </div>
    </div>
    ${hasTimer?`<div class="timer-wrap"><div class="timer-bar-track"><div id="timer-bar" class="timer-bar-fill" style="width:100%"></div></div><div id="timer-digits" class="timer-digits">${S.timerSeconds}s</div></div>`:''}
    <h2 class="mb3${urduCls(q)}">${renderMath(q.text)}</h2>
    <div class="opt-grid">${opts}</div>
    ${notice}
    ${reportRow}
  </div>`;
}

function studentEndHTML(){
  const sorted=sortParticipants(S.participants||[]);
  const myRank=sorted.findIndex(p=>p.id===myPid)+1;
  const medals=['🥇','🥈','🥉'];
  return `<div class="page">
    <h1 class="mb1">Session ended</h1>
    <p class="muted mb2">You finished <strong>#${myRank}</strong> of ${sorted.length}</p>
    <div class="notice n-neutral mb4" style="font-size:.82rem">The host may continue the session or close it. Please wait…</div>
    <h3 class="mb2">Leaderboard</h3>
    <div class="score-list">
      ${sorted.map((p,i)=>`<div class="score-row${p.id===myPid?' me':i<3?' top':''}">
        <div class="score-rank">${medals[i]||i+1}</div>
        <div class="score-name">${esc(p.name)}${p.id===myPid?' <span style="font-size:.7rem;color:var(--mid)">← you</span>':''}</div>
        <div class="score-pts">${p.score||0}</div>
      </div>`).join('')}
    </div>
  </div>`;
}
/* ══════════════════════════════════════
   HOST PASSWORD
══════════════════════════════════════ */
function hostPassHTML(){
  return `<div class="center"><div class="box">
    <h2 class="mb1">Host Interface</h2>
    <p class="muted mb3">Enter the host password to continue.</p>
    <input type="password" id="pw-in" placeholder="Password" maxlength="20" autocomplete="off" class="form-input"/>
    <p id="pw-err" style="color:var(--bad);font-size:.8rem;min-height:1.2em;margin-top:5px"></p>
    <div class="row gap2 mt2">
      <button class="btn btn-ghost btn-sm" id="btn-pw-back">← Back</button>
      <button class="btn btn-dark" id="btn-pw-ok" style="flex:1">Enter →</button>
    </div>
  </div></div>`;
}

/* ══════════════════════════════════════
   HALT CONFIRMATION OVERLAY (host)
══════════════════════════════════════ */
function haltBombOverlayHTML(){
  if(!showingHaltBomb) return '';
  return `<div id="halt-bomb-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:800;backdrop-filter:blur(3px)">
    <div style="text-align:center;user-select:none">
      <div id="bomb-emoji" style="font-size:5rem;line-height:1;animation:bombDrop .5s cubic-bezier(.34,1.56,.64,1) both,bombWobble .35s ease-in-out .55s 4 alternate;display:inline-block">💣</div>
      <div id="blast-rings-wrap" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none"></div>
      <div style="margin-top:18px;color:rgba(255,255,255,.7);font-size:.85rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase" id="bomb-label">${showingHaltMenu?'Halting session…':'Ending session…'}</div>
    </div>
  </div>`;
}

function dismissBombOverlayHTML(){
  if(!showingDismissBomb) return '';
  return `<div id="dismiss-bomb-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;z-index:810;backdrop-filter:blur(4px)">
    <div style="text-align:center;user-select:none;position:relative">
      <div id="dismiss-bomb-emoji" style="font-size:6rem;line-height:1;animation:bombDrop .5s cubic-bezier(.34,1.56,.64,1) both,bombWobble .3s ease-in-out .6s 5 alternate;display:inline-block">💣</div>
      <div id="dismiss-blast-rings-wrap" style="position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);pointer-events:none"></div>
      <div style="margin-top:20px;color:rgba(255,255,255,.85);font-size:1rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase" id="dismiss-bomb-label">Sending students home…</div>
      <div style="margin-top:6px;color:rgba(255,255,255,.45);font-size:.72rem">Session shutting down</div>
    </div>
  </div>`;
}


function haltMenuOverlayHTML(){
  if(!showingHaltMenu) return '';
  return `<div style="position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;z-index:500;backdrop-filter:blur(2px)">
    <div style="background:var(--white);border-radius:18px 18px 0 0;width:100%;max-width:480px;display:flex;flex-direction:column;animation:slideUp .22s ease">
      <div style="padding:16px 20px 12px;border-bottom:1px solid var(--line);flex-shrink:0;text-align:center">
        <div style="width:36px;height:4px;background:var(--line);border-radius:2px;margin:0 auto 14px"></div>
        <div style="font-size:1.6rem;margin-bottom:4px">⏸</div>
        <div style="font-size:1rem;font-weight:600;margin-bottom:2px">Session Halted</div>
        <p class="muted small">Students are on pause. What next?</p>
      </div>
      <div style="padding:14px 16px 24px;display:flex;flex-direction:column;gap:10px;flex-shrink:0">
        <button class="btn btn-lg" id="btn-restore-backup" style="justify-content:center;gap:8px;background:#0e7a5a;color:#fff;border-color:#0e7a5a">
          📥 Restore Today's Scores <span style="opacity:.75;font-weight:400;font-size:.78rem">· recover after glitch</span>
        </button>
        <button class="btn btn-lg" id="btn-stop-dismiss" style="justify-content:center;gap:8px;background:#be123c;color:#fff;border-color:#be123c">
          ⏹ Stop &amp; Dismiss Students
        </button>
        <button class="btn btn-ghost btn-sm" id="btn-halt-cancel" style="justify-content:center;margin-top:2px">Cancel — keep session going</button>
      </div>
    </div>
  </div>`;
}

function backupRestoreOverlayHTML(){
  if(!showingBackupOverlay) return '';
  const { list, loading, error, restoredMsg } = backupOverlayState;
  const medals = ['🥇','🥈','🥉'];
  const rows = loading
    ? `<div style="padding:28px;text-align:center;color:var(--mid)"><div style="width:22px;height:22px;border:2.5px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;display:inline-block"></div><div style="margin-top:8px;font-size:.8rem">Loading backup…</div></div>`
    : error
      ? `<div style="padding:20px;text-align:center;color:var(--bad);font-size:.85rem">${esc(error)}</div>`
      : !list.length
        ? `<div style="padding:20px;text-align:center;color:var(--mid);font-size:.85rem">No backup found for today's window (5 AM–5 AM IST).</div>`
        : list.map((p,i)=>`
          <div style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--line)">
            <div style="min-width:26px;text-align:center;font-size:${i<3?'1rem':'.78rem'};color:var(--mid)">${medals[i]||('#'+(i+1))}</div>
            <div style="flex:1;font-weight:${i<3?'700':'500'};font-size:.87rem;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(p.name)}</div>
            <div style="text-align:right;min-width:64px">
              <span style="font-weight:700;font-size:.9rem">${p.totalScore||0}</span>
              <span style="font-size:.67rem;color:var(--mid);display:block">total</span>
            </div>
          </div>`).join('');
  const actionBtn = restoredMsg
    ? `<div style="padding:12px 16px;background:#d4f5e8;color:#0e7a5a;border-radius:8px;font-size:.84rem;font-weight:600;text-align:center">${esc(restoredMsg)}</div>`
    : `<button class="btn btn-good btn-lg" id="btn-confirm-restore" style="justify-content:center" ${loading||error||!list.length?'disabled':''}>📥 Import & Restore These Scores</button>`;
  return `<div style="position:fixed;inset:0;background:rgba(0,0,0,.62);display:flex;align-items:flex-end;justify-content:center;z-index:700;backdrop-filter:blur(3px)">
    <div style="background:var(--white);border-radius:20px 20px 0 0;width:100%;max-width:500px;max-height:86vh;display:flex;flex-direction:column;animation:slideUp .22s ease">
      <div style="padding:16px 20px 12px;border-bottom:1px solid var(--line);flex-shrink:0;text-align:center">
        <div style="width:36px;height:4px;background:var(--line);border-radius:2px;margin:0 auto 12px"></div>
        <div style="font-size:1.5rem;margin-bottom:4px">📥</div>
        <div style="font-size:1rem;font-weight:700">Restore Today's Session Backup</div>
        <p style="font-size:.76rem;color:var(--mid);margin-top:3px">Scores saved up to the last revealed question · 5 AM–5 AM IST window</p>
      </div>
      <div style="overflow-y:auto;flex:1">${rows}</div>
      <div style="padding:14px 16px 28px;display:flex;flex-direction:column;gap:8px;flex-shrink:0;border-top:1px solid var(--line)">
        ${actionBtn}
        <button class="btn btn-ghost btn-sm" id="btn-close-backup-overlay" style="justify-content:center">Close</button>
      </div>
    </div>
  </div>`;
}


function hostFinalLeaderboardHTML(){
  if(!hostShutdownLeaderboard) return '';
  const entries=hostShutdownLeaderboard;
  const medals=['🥇','🥈','🥉'];
  const totalQ=hostShutdownLeaderboard._totalQ||0;
  const totalStr=totalQ>0?String(totalQ):'?';
  const rows=entries.length
    ?entries.map((p,i)=>`
      <div class="lb-row">
        <div class="score-rank">${medals[i]||('#'+(i+1))}</div>
        <div style="flex:1;font-weight:${i<3?'600':'400'}">${esc(p.name)}</div>
        <div class="score-pts"><span style="font-weight:700">${p.score||0}</span><span style="font-size:.7rem;color:var(--mid);font-weight:400">/${totalStr}</span></div>
      </div>`).join('')
    :`<div style="padding:20px;text-align:center;color:var(--mid)">No scores to display.</div>`;
  return `<div style="display:flex;flex-direction:column;height:calc(100vh - 54px);overflow:hidden;padding:16px 20px;max-width:520px;margin:0 auto">
    <div style="text-align:center;padding:20px 0 16px;flex-shrink:0">
      <div style="font-size:2.4rem;margin-bottom:10px">🏆</div>
      <h2 style="margin-bottom:6px">Final Leaderboard</h2>
      <p class="muted small">${entries.length} student${entries.length!==1?'s':''} &nbsp;·&nbsp; ${totalStr} question${totalQ!==1?'s':''}</p>
    </div>
    <div class="lb-panel" style="flex:1;overflow:hidden;display:flex;flex-direction:column">
      <div class="lb-head"><span style="font-size:.82rem;font-weight:600">🏁 Final Standings</span><span class="small muted">${entries.length} student${entries.length!==1?'s':''}</span></div>
      <div style="overflow-y:auto;flex:1">${rows}</div>
    </div>
    <div style="padding:14px 0 8px;flex-shrink:0;display:flex;flex-direction:column;gap:8px">
      <button class="btn btn-good" id="btn-host-lb-export" style="width:100%;justify-content:center;gap:8px">
        📤 Export as CSV
      </button>
      <button class="btn btn-dark" id="btn-host-lb-close" style="width:100%;justify-content:center;gap:8px">
        ← Back to Host Menu
      </button>
    </div>
  </div>`;
}

function schedOverlayHTML(){
  if(!sidebarSchedOpen) return '';
  const upcoming=hostSchedules.filter(s=>s.ts>Date.now()-3600000);
  const schedRows=upcoming.length
    ?upcoming.map(s=>{
      const d=new Date(s.ts);
      return `<div class="sched-card" style="margin-bottom:6px;padding:8px 10px">
        <div class="sched-date-blk" style="min-width:36px;padding:4px 7px"><div class="sched-day" style="font-size:.95rem">${d.getDate()}</div><div class="sched-mon">${d.toLocaleString('en',{month:'short'})}</div></div>
        <div class="sched-info">
          <div class="sched-title" style="font-size:.8rem">${esc(s.title)}</div>
          <div class="sched-meta">${d.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}${s.notes?' · '+esc(s.notes):''}</div>
          <div class="sched-cd">${cdStr(s.ts)}</div>
        </div>
        <span class="sched-del" data-sdel="${s._id}">✕</span>
      </div>`;
    }).join('')
    :'<p class="muted small" style="padding:4px 0 10px">No upcoming sessions.</p>';
  return `<div id="sched-overlay" style="position:absolute;bottom:0;left:0;right:0;background:var(--white);border-top:2px solid var(--line);border-radius:12px 12px 0 0;padding:16px;z-index:300;max-height:70%;overflow-y:auto;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <span style="font-weight:700;font-size:.9rem">📅 Schedule</span>
      <button class="btn btn-ghost btn-sm" id="btn-sched-close">✕</button>
    </div>
    ${schedRows}
    <hr/>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
      <input class="form-input" id="sched-title" placeholder="Session title" maxlength="60" style="font-size:.82rem;padding:8px 10px"/>
      <input class="form-input" type="datetime-local" id="sched-dt" style="font-size:.82rem;padding:8px 10px"/>
      <input class="form-input" id="sched-notes" placeholder="Notes (optional)" maxlength="100" style="font-size:.82rem;padding:8px 10px"/>
      <button class="btn btn-dark btn-sm btn-full" id="btn-sched-add">+ Add to schedule</button>
      <div class="form-msg" id="sched-msg"></div>
    </div>
  </div>`;
}

function standingsOverlayHTML(){
  if(!showStandingsOverlay) return '';
  const snaps  = S.sessionSnapshots || [];
  const gcores = S.gameScores || [];       // [{id,name,total}] cumulative
  const parts  = S.participants || [];
  const medals = ['🥇','🥈','🥉'];

  // Build a master list of all known students (union of all sessions + current)
  const nameMap = {};
  snaps.forEach(sn => sn.scores.forEach(s => { nameMap[s.id] = s.name; }));
  parts.forEach(p => { nameMap[p.id] = p.name; });
  gcores.forEach(g => { nameMap[g.id] = g.name; });

  // For cumulative total use gameScores (already banked past sessions)
  // Add current live session scores on top
  const liveScoreMap = {};
  parts.forEach(p => { liveScoreMap[p.id] = p.score || 0; });

  const totalMap = {};
  gcores.forEach(g => { totalMap[g.id] = (g.total || 0); });
  // Add current session live scores (not yet banked)
  parts.forEach(p => { totalMap[p.id] = (totalMap[p.id]||0) + (p.score||0); });

  // Sort students by grand total descending
  const allIds = Object.keys(nameMap);
  allIds.sort((a,b)=>(totalMap[b]||0)-(totalMap[a]||0));

  const numSessions = snaps.length;
  const currentSessionNum = numSessions + 1;
  const hasCurrentSession = parts.length > 0;

  if(allIds.length === 0){
    return `<div class="standings-overlay">
      <div class="standings-overlay-head">
        <span style="font-weight:700;font-size:.95rem">📊 Current Standings</span>
        <button class="btn btn-ghost btn-sm" id="btn-standings-close">✕ Close</button>
      </div>
      <div style="padding:40px;text-align:center;color:var(--mid)">No data yet</div>
    </div>`;
  }

  // Header row: Name | S1 | S2 | … | Current | Total
  let thCells = `<th>Student</th>`;
  snaps.forEach((sn,i) => { thCells += `<th>${i+1}</th>`; });
  if(hasCurrentSession){ thCells += `<th>${currentSessionNum}</th>`; }
  thCells += `<th class="total-col">∑</th>`;

  // Data rows
  const rows = allIds.map((id,i) => {
    const name = nameMap[id] || '—';
    let tds = `<td><span style="min-width:20px;display:inline-block;text-align:center;font-size:.72rem;color:var(--mid)">${medals[i]||'#'+(i+1)}</span> ${esc(name)}</td>`;
    snaps.forEach(sn => {
      const entry = sn.scores.find(s=>s.id===id);
      const pts = entry ? entry.score : null;
      tds += pts===null
        ? `<td class="zero">—</td>`
        : `<td>${pts}</td>`;
    });
    if(hasCurrentSession){
      const pts = liveScoreMap[id];
      tds += pts===undefined
        ? `<td class="zero">—</td>`
        : `<td>${pts}</td>`;
    }
    const grand = totalMap[id] || 0;
    tds += `<td class="total-col">${grand}</td>`;
    return `<tr>${tds}</tr>`;
  }).join('');

  // Session separator legend below table
  const sessionCount = numSessions + (hasCurrentSession?1:0);

  return `<div class="standings-overlay">
    <div class="standings-overlay-head">
      <div>
        <span style="font-weight:700;font-size:.95rem">📊 Current Standings</span>
        <span style="margin-left:10px;font-size:.75rem;color:var(--mid)">${allIds.length} students · ${sessionCount} session${sessionCount!==1?'s':''}</span>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-standings-close">✕ Close</button>
    </div>
    <div class="standings-overlay-body">
      <table class="standings-tbl">
        <thead><tr>${thCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}


function manageOverlayHTML(){
  if(!folderManageSubject) return '';
  // Set manageFolder to match overlay subject so existing editor logic works
  const fName=folderManageSubject;

  // File list
  const fileRows=manageFolderFiles.length
    ?manageFolderFiles.map(f=>`
      <div class="mfile-row${manageFile===f.name?' editing':''}">
        <span style="flex:1;font-size:.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${manageFile===f.name?'var(--accent)':'var(--ink)'};font-weight:${manageFile===f.name?'600':'400'}">${esc(f.name)}</span>
        <button class="btn btn-ghost btn-sm" style="padding:2px 9px;font-size:.7rem;flex-shrink:0;${manageFile===f.name?'background:#e0edff;border-color:var(--accent);color:var(--accent)':''}" data-file-edit="${esc(f.name)}">${manageFile===f.name?'✎ Editing':'Edit'}</button>
        <button class="btn btn-sm" style="padding:2px 7px;flex-shrink:0;background:#fff1f2;border-color:#fecdd3;color:#be123c;font-size:.68rem" data-file-del="${esc(f.name)}" title="Delete">✕</button>
      </div>`).join('')
    :(manageFolderFiles.length===0&&manageFile===null
      ?`<div style="padding:12px;text-align:center;color:var(--mid);font-size:.78rem;background:var(--faint);border-radius:7px">No .txt files yet — create one below</div>`
      :'');

  // Inline editor (when a file is open)
  const editorBlock=manageEditMode?`
    <div style="border:1.5px solid var(--ink);border-radius:9px;overflow:hidden;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;gap:6px;padding:7px 10px;background:var(--ink);color:#fff;flex-shrink:0">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <span style="font-size:.75rem;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${esc(fName)} / ${manageEditMode==='new'
            ?`<input id="new-file-name-editor" placeholder="chapter1.txt" maxlength="60"
                style="background:rgba(255,255,255,.18);border:none;border-bottom:1px solid rgba(255,255,255,.5);color:#fff;font-size:.75rem;font-weight:600;padding:1px 5px;outline:none;width:120px;border-radius:3px"
                value="${esc(manageNewFileName)}"/>`
            :`<span style="opacity:.85">${esc(manageFile||'')}</span>`}
        </span>
        <button id="btn-editor-fullscreen" style="background:none;border:1px solid rgba(255,255,255,.3);color:#fff;padding:2px 7px;border-radius:4px;cursor:pointer;font-size:.68rem" title="${editorFullscreen?'Exit fullscreen':'Fullscreen'}">
          ${editorFullscreen
            ?`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>`
            :`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`}
        </button>
        <button id="btn-close-editor" style="background:none;border:1px solid rgba(255,255,255,.3);color:#fff;padding:2px 7px;border-radius:4px;cursor:pointer;font-size:.68rem">✕</button>
      </div>
      <div style="padding:3px 10px;background:#fafaf9;border-bottom:1px solid var(--line);font-size:.63rem;color:var(--mid);flex-shrink:0">
        <strong style="color:var(--ink)">Format:</strong> Question · <code style="background:#eee;padding:0 3px;border-radius:2px">(A)opt, (B)opt, (C)opt, (D)opt</code>
      </div>
      <textarea id="q-editor" style="width:100%;font-family:monospace;font-size:.76rem;resize:none;padding:10px 12px;border:none;outline:none;display:block;min-height:160px;box-sizing:border-box"
        placeholder="What is photosynthesis?&#10;(A)Making food from sunlight, (B)Breathing, (C)Digestion, (D)Transpiration">${esc(editingContent)}</textarea>
      <div style="display:flex;gap:6px;padding:6px 10px;background:#fafaf9;border-top:1px solid var(--line);align-items:center;flex-shrink:0">
        <button class="btn btn-good btn-sm" style="gap:4px;font-size:.75rem" id="btn-save-editor">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/></svg>Save to GitHub
        </button>
        <label class="btn btn-white btn-sm" style="cursor:pointer;gap:4px;font-size:.75rem">
          ↑ Upload .txt<input type="file" id="file-upload-inp" accept=".txt" style="display:none"/>
        </label>
      </div>
    </div>`:
    // Fullscreen editor (separate overlay)
    (editorFullscreen?`<div id="editor-fs-overlay" style="position:fixed;inset:0;z-index:900;background:#fff;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;gap:6px;padding:7px 10px;background:var(--ink);color:#fff;flex-shrink:0">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <span style="font-size:.75rem;font-weight:600;flex:1">${esc(fName)} / ${esc(manageFile||'')}</span>
        <button id="btn-editor-fullscreen" style="background:none;border:1px solid rgba(255,255,255,.3);color:#fff;padding:2px 7px;border-radius:4px;cursor:pointer;font-size:.68rem">⤡ Exit</button>
        <button id="btn-close-editor" style="background:none;border:1px solid rgba(255,255,255,.3);color:#fff;padding:2px 7px;border-radius:4px;cursor:pointer;font-size:.68rem">✕</button>
      </div>
      <textarea id="q-editor" style="flex:1;width:100%;font-family:monospace;font-size:.8rem;resize:none;padding:12px 14px;border:none;outline:none;display:block;box-sizing:border-box">${esc(editingContent)}</textarea>
      <div style="display:flex;gap:6px;padding:8px 10px;background:#fafaf9;border-top:1px solid var(--line);align-items:center;flex-shrink:0">
        <button class="btn btn-good btn-sm" id="btn-save-editor">Save to GitHub</button>
      </div>
    </div>`:'');

  return `<div class="manage-overlay-backdrop" id="manage-overlay-backdrop">
    <div class="manage-overlay-panel">
      <div class="manage-overlay-head">
        <span style="font-size:1.2rem">📁</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:.9rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(fName)}</div>
          <div style="font-size:.68rem;color:var(--mid)">${manageFolderFiles.length} file${manageFolderFiles.length!==1?'s':''}</div>
        </div>
        <button class="btn btn-ghost btn-sm" id="btn-manage-close" style="font-size:.75rem;flex-shrink:0">✕ Close</button>
      </div>
      <div class="manage-overlay-body">
        ${fileRows}
        ${editorBlock}
        ${!manageEditMode?`
        <div style="display:flex;gap:5px;margin-top:2px">
          <input class="form-input" id="new-file-name" placeholder="chapter.txt" maxlength="60" style="flex:1;font-size:.76rem;padding:5px 8px"/>
          <button class="btn btn-dark btn-sm" id="btn-create-file" style="font-size:.73rem;white-space:nowrap">+ New</button>
          <label class="btn btn-white btn-sm" style="cursor:pointer;font-size:.73rem;white-space:nowrap">
            ↑ Upload<input type="file" id="file-upload-inp" accept=".txt" style="display:none"/>
          </label>
        </div>`:''}
        <div id="upload-msg" style="font-size:.75rem">${uploadMsg}</div>
      </div>
      <div style="padding:8px 14px 22px;border-top:1px solid var(--line);flex-shrink:0">
        <button class="btn btn-sm btn-full" style="background:#fff1f2;color:#be123c;border-color:#fecdd3;font-size:.73rem;justify-content:center" id="btn-delete-folder">✕ Delete folder &amp; all files</button>
      </div>
    </div>
    ${editorFullscreen?editorBlock:''}
  </div>`;
}

function hostSettingsOverlayHTML(){
  if(!hostSettingsOpen) return '';
  return `<div class="host-settings-overlay" id="host-settings-overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts and settings">
    <div class="host-settings-panel">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
        <div>
          <div style="font-weight:700;font-size:1rem">⌨️ Keyboard Shortcuts</div>
          <div class="muted small mt1">Navigate the host panel without a mouse</div>
        </div>
        <button class="btn btn-ghost btn-sm" id="btn-settings-close" style="flex-shrink:0">✕ Close</button>
      </div>

      <div class="shortcut-section">Quiz Controls</div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">←</kbd><kbd class="kbd">→</kbd></div>
        <div class="shortcut-desc">Previous / next question</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">P</kbd></div>
        <div class="shortcut-desc">Push current question to students</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">R</kbd></div>
        <div class="shortcut-desc">Reveal the correct answer</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">N</kbd></div>
        <div class="shortcut-desc">Advance to next question (after reveal)</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">1</kbd>–<kbd class="kbd">4</kbd></div>
        <div class="shortcut-desc">Set answer key to option A – D</div>
      </div>

      <div class="shortcut-section">Tab Navigation</div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">Tab</kbd></div>
        <div class="shortcut-desc">Move focus to next control</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">⇧ Shift</kbd><kbd class="kbd">Tab</kbd></div>
        <div class="shortcut-desc">Move focus to previous control</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">Enter</kbd></div>
        <div class="shortcut-desc">Activate focused button or item</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">Space</kbd></div>
        <div class="shortcut-desc">Toggle checkbox or activate button</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">Esc</kbd></div>
        <div class="shortcut-desc">Close overlays and panels</div>
      </div>

      <div class="shortcut-section">Generate Tab — Subject Picker</div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">Tab</kbd></div>
        <div class="shortcut-desc">Focus each subject folder</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">Enter</kbd> / <kbd class="kbd">Space</kbd></div>
        <div class="shortcut-desc">Expand or collapse subject folder</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">↑</kbd> / <kbd class="kbd">↓</kbd></div>
        <div class="shortcut-desc">Move between subject folders</div>
      </div>

      <div class="shortcut-section">Answer Key Grid</div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">Tab</kbd></div>
        <div class="shortcut-desc">Focus each answer option</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">←</kbd><kbd class="kbd">→</kbd><kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd></div>
        <div class="shortcut-desc">Move between options A–D</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">Enter</kbd> / <kbd class="kbd">Space</kbd></div>
        <div class="shortcut-desc">Select this option as the answer key</div>
      </div>
    </div>
  </div>`;
}

/* ══════════════════════════════════════
   REPORTS OVERLAY (host)
══════════════════════════════════════ */
function reportsOverlayHTML(){
  if(!reportsOverlayOpen) return '';
  const reports=receivedReports;
  const hd=`<div class="standings-overlay-head">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-weight:700;font-size:.95rem">&#128297; Reported Questions</span>
      <span style="font-size:.75rem;color:var(--mid)">${reports.length} report${reports.length!==1?'s':''}</span>
    </div>
    <button class="btn btn-ghost btn-sm" id="btn-reports-close">&#x2715; Close</button>
  </div>`;
  if(!reports.length){
    return `<div class="standings-overlay" id="reports-overlay">${hd}
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;text-align:center;color:var(--mid)">
        <div style="font-size:2.4rem;margin-bottom:12px">&#128461;</div>
        <div style="font-size:.88rem;font-weight:500;margin-bottom:6px">No reports yet</div>
        <div style="font-size:.78rem">Students can flag questions using the &#128681; button after a reveal.</div>
      </div></div>`;
  }
  const cards=reports.map(r=>{
    const isX=expandedReportRid===r.rid, isEd=editingReportRid===r.rid;
    const q=r.question, uc=q&&q.subject&&q.subject.toLowerCase()==='urdu';
    const s=Math.floor((Date.now()-r.ts)/1000);
    const ago=s<60?s+'s ago':s<3600?Math.floor(s/60)+'m ago':Math.floor(s/3600)+'h ago';
    const headH=`<div class="report-card-head" data-r-expand="${r.rid}">
      <div style="flex:1;min-width:0">
        <div style="font-size:.82rem;font-weight:500;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;${uc?'direction:rtl;font-family:Noto Nastaliq Urdu,serif;font-size:.86rem':''}">
          ${renderMath(q?q.text.length>90?q.text.slice(0,88)+'\u2026':q.text:'?')}
        </div>
        <div style="display:flex;align-items:center;gap:7px;margin-top:3px;flex-wrap:wrap">
          <span style="font-size:.7rem;color:var(--mid)">&#128681; ${esc(r.reporterName)}</span>
          <span style="font-size:.7rem;color:var(--mid)">&middot; ${ago}</span>
          ${r.count>1?`<span style="background:#fee2e2;color:#be123c;font-size:.63rem;font-weight:700;padding:1px 6px;border-radius:10px">${r.count}&times; flagged</span>`:''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;padding-left:4px">
        <span style="font-size:.75rem;color:var(--mid);display:inline-block;transition:transform .2s;${isX?'transform:rotate(180deg)':''}">&#9662;</span>
        <button class="btn btn-ghost btn-sm" data-r-dismiss="${r.rid}" style="font-size:.66rem;padding:2px 7px">&#x2715;</button>
      </div>
    </div>`;
    let bodyH='';
    if(isX){
      if(isEd){
        const d=editReportDraft;
        bodyH=`<div class="report-expand-body" style="padding:13px 14px">
          <div style="margin-bottom:10px">
            <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--mid);margin-bottom:5px">Question text</div>
            <textarea id="r-edit-qtext" style="width:100%;padding:8px 10px;border:1.5px solid var(--ink);border-radius:var(--r);font-family:${uc?'Noto Nastaliq Urdu,serif':'var(--sans)'};font-size:.83rem;line-height:${uc?'2.2':'1.45'};resize:vertical;outline:none;min-height:54px;box-sizing:border-box;${uc?'direction:rtl;text-align:right;':''}">${esc(d.text||'')}</textarea>
          </div>
          <div style="margin-bottom:10px">
            <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--mid);margin-bottom:6px">Options</div>
            <div style="display:flex;flex-direction:column;gap:5px">
              ${(d.options||[]).map((o,i)=>`<div style="display:flex;align-items:center;gap:7px">
                <div style="width:24px;height:24px;border-radius:5px;background:${d.correct===i?'var(--ink)':'var(--faint)'};color:${d.correct===i?'#fff':'var(--mid)'};border:1.5px solid ${d.correct===i?'var(--ink)':'var(--line)'};display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:700;flex-shrink:0">${'ABCD'[i]}</div>
                <input class="form-input" data-r-opt="${i}" value="${esc(o)}" style="flex:1;padding:5px 9px;font-size:.82rem;${uc?'direction:rtl;text-align:right;font-family:Noto Nastaliq Urdu,serif;':''}"/></div>`).join('')}
            </div>
          </div>
          <div style="margin-bottom:13px">
            <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--mid);margin-bottom:6px">Correct answer <span style="font-weight:400;text-transform:none;letter-spacing:0">(click to select)</span></div>
            <div class="key-grid" style="min-height:unset;gap:6px">
              ${(d.options||[]).map((o,i)=>`<div class="key-card${d.correct===i?' selected':''}" data-r-key="${i}" tabindex="0" role="button" aria-label="Option ${'ABCD'[i]}"><div class="kl">${'ABCD'[i]}</div><div class="kt${uc?' urdu':''}" style="font-size:.76rem">${renderMath(o||'')}</div></div>`).join('')}
            </div>
          </div>
          <div style="display:flex;gap:7px;align-items:center">
            <button class="btn btn-dark" id="btn-save-report-edit" style="flex:1;font-size:.8rem;gap:5px;padding:9px 12px">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/></svg>Save &amp; Fix
            </button>
            <button class="btn btn-ghost" id="btn-cancel-report-edit" style="font-size:.8rem;padding:9px 14px">Cancel</button>
          </div>
          <div id="report-edit-msg" style="font-size:.75rem;margin-top:7px;min-height:1.1em"></div>
        </div>`;
      } else {
        const optR=(q&&q.options||[]).map((o,i)=>{
          const isCr=i===r.correct, isRp=r.reportedAnswer!==null&&i===r.reportedAnswer;
          let cls='r-opt-normal'; let badge='';
          if(isCr){cls='r-opt-correct';badge=`<span style="font-size:.62rem;font-weight:600;color:#16a34a;flex-shrink:0">&#10003; marked correct</span>`;}
          if(isRp&&!isCr){cls='r-opt-reported';badge=`<span style="font-size:.62rem;font-weight:600;color:#d97706;flex-shrink:0">&#9888; student picked</span>`;}
          if(isRp&&isCr){badge=`<span style="font-size:.62rem;font-weight:600;color:#16a34a;flex-shrink:0">&#10003; correct (student also chose)</span>`;}
          return `<div class="r-opt-row ${cls}">
            <div style="width:22px;height:22px;border-radius:4px;background:${isCr?'var(--good)':isRp?'#f59e0b':'var(--line)'};color:${isCr||isRp?'#fff':'var(--mid)'};display:flex;align-items:center;justify-content:center;font-size:.67rem;font-weight:700;flex-shrink:0">${'ABCD'[i]}</div>
            <span class="${uc?'urdu':''}" style="flex:1;font-size:.82rem">${renderMath(o)}</span>
            ${badge}
          </div>`;
        }).join('');
        bodyH=`<div class="report-expand-body" style="padding:12px 14px">
          <div style="margin-bottom:10px">
            <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--mid);margin-bottom:5px">Question${q&&q.subject?' &middot; '+esc(q.subject):''}${q&&q.chapter?' / '+esc(q.chapter):''}</div>
            <div class="${uc?'urdu':''}" style="font-size:.85rem;line-height:${uc?'2.2':'1.5'};padding:9px 11px;background:var(--faint);border:1px solid var(--line);border-radius:6px">${renderMath(q&&q.text||'')}</div>
          </div>
          <div style="margin-bottom:10px">${optR}</div>
          <div style="display:flex;gap:7px">
            <button class="btn btn-dark btn-sm" data-r-edit="${r.rid}" style="gap:5px;font-size:.78rem">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit
            </button>
            <button class="btn btn-ghost btn-sm" data-r-dismiss="${r.rid}" style="font-size:.78rem">&#x2715; Dismiss</button>
          </div>
        </div>`;
      }
    }
    return `<div class="report-card" data-rid="${r.rid}">${headH}${bodyH}</div>`;
  }).join('');

  return `<div class="standings-overlay" id="reports-overlay">
    ${hd}
    <div class="standings-overlay-body" style="padding:12px">${cards}</div>
  </div>`;
}

/* ══════════════════════════════════════
   HOST KEYBOARD SHORTCUTS (global handler — added/removed by attach)
══════════════════════════════════════ */
function hostKeyDown(e){
  if(!hostAuthed||role!=='host') return;
  // Close settings with Escape
  if(hostSettingsOpen&&e.key==='Escape'){ hostSettingsOpen=false; render(); return; }
  if(reportsOverlayOpen&&e.key==='Escape'){ reportsOverlayOpen=false; editingReportRid=null; editReportDraft={}; render(); return; }
  if(folderManageSubject&&e.key==='Escape'){ folderManageSubject=null; manageFolder=null; manageEditMode=null; manageFile=null; manageFolderFiles=[]; editingContent=''; editingSha=null; uploadMsg=''; editorFullscreen=false; render(); return; }
  if(folderOverlaySubject&&e.key==='Escape'){ folderOverlaySubject=null; folderOverlayDraft={}; render(); return; }
  // Close halt/sched overlays with Escape
  if((showingHaltMenu||sidebarSchedOpen)&&e.key==='Escape'){
    showingHaltMenu=false; sidebarSchedOpen=false; render(); return;
  }
  // Don't fire shortcuts when typing in an input/textarea/select
  const tag=document.activeElement?.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT') return;
  // Don't fire when inside an overlay other than the main panel
  if(hostSettingsOpen||showingHaltMenu||sidebarSchedOpen) return;
  switch(e.key){
    case 'ArrowLeft':
      e.preventDefault();
      document.getElementById('btn-q-prev')?.click(); break;
    case 'ArrowRight':
      e.preventDefault();
      document.getElementById('btn-q-next')?.click(); break;
    case 'p': case 'P':
      e.preventDefault();
      document.getElementById('btn-push')?.click(); break;
    case 'r': case 'R':
      e.preventDefault();
      document.getElementById('btn-reveal')?.click(); break;
    case 'n': case 'N':
      e.preventDefault();
      document.getElementById('btn-next')?.click(); break;
    case '1': case '2': case '3': case '4':{
      e.preventDefault();
      const idx=parseInt(e.key)-1;
      const cards=[...document.querySelectorAll('.key-card[data-key]')];
      if(cards[idx]) cards[idx].click();
      break;
    }
  }
}

function hostHTML(){
  if(S.status==='ended') return hostEndedHTML();

  const parts=S.participants||[];
  const sorted=sortParticipants(parts);
  const isLive=S.status==='question'||S.status==='revealed';
  const isRevealed=S.status==='revealed';
  const answered=S.totalAnswered||0;
  const medals=['🥇','🥈','🥉'];

  // ── 1. LIVE SCORE NAV ──────────────────────────────────────────────────
  const snaps = S.sessionSnapshots || [];
  const currentSessionLabel = snaps.length > 0 ? `S${snaps.length + 1}` : 'S1';
  const pushedSoFar = S.pushedCount || 0;
  const totalLoaded = questions.length || 0;
  const standingsLabel = parts.length
    ? `📊 ${currentSessionLabel} · ${parts.length} joined`
    : `📊 Standings`;
  const pushedLabel = totalLoaded > 0
    ? `Q${pushedSoFar}/${totalLoaded}`
    : pushedSoFar > 0 ? `Q${pushedSoFar}` : '';
  const liveNav=`
    <div class="host-live-nav">
      <button class="btn btn-ghost btn-sm" id="btn-host-home" style="flex-shrink:0;padding:4px 10px;font-size:.75rem;gap:4px">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15,18 9,12 15,6"/></svg>Host Menu
      </button>
      <div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:center">
          ${standingsLabel}
        </button>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-sched-nav" style="flex-shrink:0;padding:4px 8px;gap:4px;font-size:.75rem">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Sched
      </button>
      <div style="position:relative;flex-shrink:0">
        <button class="btn btn-ghost btn-sm" id="btn-reports-open" title="Received question reports" style="padding:4px 8px;font-size:.75rem;gap:4px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
        </button>
        <span id="reports-badge" class="reports-badge" style="display:${receivedReports.length?'flex':'none'};align-items:center;justify-content:center">${receivedReports.length||0}</span>
      </div>
    </div>`;

  // SVG icons — refined set
  const iconNew=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`;
  const iconPlay=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"/></svg>`;
  const iconStop=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  const iconReset=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>`;

  // Session status banner — shows clearly whether students can join
  const sessionBanner=!isLive?(S.sessionOpen
    ?`<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:#e8f5ee;border-bottom:1px solid #b7dfc7;font-size:.8rem;flex-shrink:0">
        <span class="dot-live"></span>
        <span style="color:#166534;font-weight:600">Session open — students can join now</span>
        <span style="color:#166534;opacity:.7;margin-left:auto">${parts.length} joined</span>
      </div>`
    :`<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:var(--faint);border-bottom:1px solid var(--line);font-size:.8rem;flex-shrink:0">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--mid);flex-shrink:0;display:inline-block"></span>
        <span style="color:var(--mid)">Session closed — press <strong>Start</strong> to let students join</span>
      </div>`)
    :'';

  const ctrlBar=`
    <div class="host-ctrl-bar">
      <button class="btn btn-sm" style="flex:1;justify-content:center;background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe;gap:5px" id="btn-reload">${iconNew} New</button>
      ${!S.sessionOpen
        ?`<button class="btn btn-sm" style="flex:1;justify-content:center;background:#f0fdf4;color:#15803d;border-color:#bbf7d0;gap:5px;font-weight:600" id="btn-open-session">${iconPlay} Start</button>`
        :`<button class="btn btn-sm" style="flex:1;justify-content:center;background:#dcfce7;color:#15803d;border-color:#86efac;gap:5px;opacity:.6;cursor:default" disabled>${iconPlay} Open ✓</button>`}
      <button class="btn btn-sm" style="flex:1;justify-content:center;background:#fff1f2;color:#be123c;border-color:#fecdd3;gap:5px" id="btn-halt">${iconStop} Halt</button>
      <button class="btn btn-sm" style="flex:1;justify-content:center;background:#f5f3ff;color:#6d28d9;border-color:#ddd6fe;gap:5px" onclick="openEditorPicker(event)">✏️ Editor</button>
    </div>
    ${sessionBanner}`;

  // ── 3. STUDENTS PANEL ────────────────────────────────────────────────
  function initials(n){return n.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();}

  // Compute fastest-finger: the correct answerer with the lowest answerTime this question
  let fastestPid = null;
  if(isRevealed && S.correct !== null && S.correct !== undefined){
    let bestTime = Infinity;
    Object.entries(S.answerTimes||{}).forEach(([pid,t])=>{
      if(S.answers?.[pid]===S.correct && t!=null && parseFloat(t)<bestTime){
        bestTime=parseFloat(t); fastestPid=pid;
      }
    });
  }

  // 🔥 Streak map for all participants
  const streakMap = getStreakMap();

  const studentRows=sorted.length
    ?sorted.map((p,i)=>{
        const ans=S.answers?.[p.id];
        const ansStr=ans!==undefined&&ans!==null?'ABCD'[ans]:'—';
        const ansTime = S.answerTimes?.[p.id] ?? null;
        const cumTime = S.cumulativeTimes?.[p.id] ?? null;
        const isCorrect=ans!==undefined&&ans!==null&&ans===S.correct;
        const isWrong=ans!==undefined&&ans!==null&&ans!==S.correct;
        const isFastest = isRevealed && p.id===fastestPid;
        const pStreak = streakMap[p.id] || 0;
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--line);font-size:.83rem${isFastest?';background:#fffbeb':''}">
          <div style="min-width:22px;text-align:center;font-size:.72rem;color:var(--mid)">${medals[i]||('#'+(i+1))}</div>
          <div class="j-av" style="flex-shrink:0${isFastest?';background:#f59e0b;color:#fff':''}">${initials(p.name)}</div>
          <div style="flex:1;overflow:hidden;min-width:0">
            <div style="white-space:nowrap;text-overflow:ellipsis;overflow:hidden">${esc(p.name)}</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:1px">
              ${isFastest?'<span class="ff-badge">⚡ Fastest</span>':''}
              ${streakBadgeHTML(pStreak)}
            </div>
          </div>
          <div style="font-size:.72rem;font-weight:700;min-width:26px;text-align:center;padding:2px 5px;border-radius:4px;${isCorrect?'background:#dcfce7;color:#16a34a':isWrong?'background:#fee2e2;color:#be123c':ans!==undefined&&ans!==null?'background:var(--faint);color:var(--mid)':'color:var(--mid)'}">${ansStr}</div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;min-width:52px;gap:1px">
            ${ansTime!=null?`<span style="font-size:.7rem;color:var(--mid)">${parseFloat(ansTime).toFixed(2)}s</span>`:'<span style="min-height:14px"></span>'}
            ${cumTime!=null?`<span style="font-size:.62rem;color:#a0a0ac" title="Cumulative">Σ${parseFloat(cumTime).toFixed(1)}s</span>`:''}
          </div>
          <div style="font-weight:600;min-width:44px;text-align:right">${p.score||0} <span style="font-size:.68rem;color:var(--mid)">pts</span></div>
        </div>`;
      }).join('')
    :`<div style="padding:20px;text-align:center;color:var(--mid);font-size:.83rem">Waiting for students to join…</div>`;

  const studentsPanel=`
    <div class="host-students-panel">
      <div class="host-students-head">
        <h3 style="margin:0">Students${parts.length?' ('+parts.length+')':''}</h3>
        ${pushedLabel?`<span style="font-size:.72rem;font-weight:700;color:var(--accent);background:#eff6ff;border:1px solid #bfdbfe;padding:2px 8px;border-radius:20px">${pushedLabel}</span>`:''}
        ${isLive
          ?`<span class="small muted">${answered}/${parts.length} answered</span>`
          :S.sessionOpen
            ?`<span class="tag tag-green"><span class="dot-live"></span> Open</span>`
            :`<span class="small muted">Session not started</span>`}
      </div>
      <div class="host-students-inner">${studentRows}</div>
    </div>`;

  // ── 4. BOTTOM CONTROLS ───────────────────────────────────────────────

  // No questions loaded → show upload/generate panel
  if(!questions.length){
    const totalSelectedFiles=subjects.reduce((n,s)=>n+s.files.filter(f=>f.selected).length,0);
    // Chapter overlay HTML (rendered on top of everything when a folder is tapped)
    const chapterOverlayHTML=(()=>{
      if(!folderOverlaySubject) return '';
      const subj=subjects.find(s=>s.name===folderOverlaySubject);
      if(!subj) return '';
      const draft=folderOverlayDraft;
      const selCount=Object.values(draft).filter(d=>d.selected).length;
      const rows=subj.filesLoaded
        ?(subj.files.length
          ?subj.files.map(f=>{
              const d=draft[f.name]||{selected:false,count:0};
              return `<div class="chapter-row${d.selected?' sel':''}" data-ch-toggle="${esc(f.name)}">
                <div class="ch-check">${d.selected?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>':''}</div>
                <span class="ch-name">${esc(f.name.replace(/\.txt$/i,''))}</span>
                ${d.selected?`<input class="ch-count" type="number" min="0" max="999" value="${d.count||''}" placeholder="all" data-ch-cnt="${esc(f.name)}" title="0 or blank = all questions" onclick="event.stopPropagation()"/>`:
                  '<span style="width:44px"></span>'}
              </div>`;
            }).join('')
          :'<p class="muted" style="padding:20px;text-align:center;font-size:.84rem">No .txt files in this folder.</p>')
        :'<div style="padding:32px;text-align:center"><div class="spinner" style="margin:0 auto 10px"></div><p class="muted small">Loading chapters…</p></div>';
      return `<div class="chapter-overlay-backdrop" id="ch-overlay-backdrop">
        <div class="chapter-overlay-panel">
          <div class="chapter-overlay-head">
            <div class="chapter-overlay-title">
              <span style="font-size:1.3rem">📁</span>
              <span>${esc(folderOverlaySubject)}</span>

            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="btn btn-ghost btn-sm" id="btn-ch-clear" style="font-size:.72rem;color:var(--mid)">✕ Clear</button>
              <button class="btn btn-ghost btn-sm" id="btn-ch-cancel" style="font-size:.76rem">Cancel</button>
              <button class="btn btn-accent btn-sm" id="btn-ch-save" style="font-size:.76rem;font-weight:600">Save ✓</button>
            </div>
          </div>
          <div class="chapter-overlay-body">${rows}</div>
        </div>
      </div>`;
    })();

    const generatePanel=`
      ${chapterOverlayHTML}
      ${subjects.length?`
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
          <button class="btn btn-ghost btn-sm" id="btn-browse" style="padding:4px 9px;font-size:.72rem">${repoLoading?'⏳ Loading':'↻ Refresh'}</button>
          <button class="btn btn-accent btn-sm" id="btn-gen" title="Generate quiz" style="padding:4px 10px;font-size:.72rem;gap:4px" ${subjects.some(s=>s.files.some(f=>f.selected))?'':'disabled'}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>Quiz</button>
          <div style="display:flex;align-items:center;gap:5px;margin-left:auto">
            <button id="btn-toggle-random" title="${hostRandomize?'Randomise ON — click to turn off':'Randomise OFF — click to turn on'}"
              style="padding:3px 8px;font-size:.7rem;font-weight:600;border-radius:var(--r);border:1.5px solid ${hostRandomize?'var(--accent)':'var(--line)'};background:${hostRandomize?'#eff6ff':'var(--faint)'};color:${hostRandomize?'var(--accent)':'var(--mid)'};cursor:pointer;display:flex;align-items:center;gap:4px;white-space:nowrap;transition:all .15s">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
              ${hostRandomize?'Rand: ON':'Rand: OFF'}
            </button>
            <span style="font-size:.72rem;color:var(--mid)">⏱</span>
            <input type="number" min="0" max="300" value="${hostTimerSeconds}" id="timer-sec-input" class="q-count-input" style="width:46px;font-size:.75rem;padding:3px 6px"/>
            <span style="font-size:.72rem;color:var(--mid)">s</span>
          </div>
        </div>

        <div class="folder-grid">
          ${subjects.map(s=>{
            const selCount=s.files.filter(f=>f.selected).length;
            return `<div class="folder-card${selCount?' has-sel':''}" data-folder-name="${esc(s.name)}" style="position:relative" tabindex="0" role="button" aria-label="${esc(s.name)}">
              ${selCount?`<div class="fc-badge">${selCount}</div>`:''}
              <div class="fc-icon">${selCount?'📂':'📁'}</div>
              <div class="fc-name">${esc(s.name)}</div>
            </div>`;
          }).join('')}
          <div class="folder-card-add${showNewFolderCard?' active':''}" id="btn-new-folder-card" tabindex="0" role="button" aria-label="Create new folder">
            ${showNewFolderCard
              ?`<input id="new-folder-name" placeholder="Folder name" maxlength="40" autofocus
                  style="width:100%;font-size:.68rem;padding:3px 5px;border:1px solid var(--accent);border-radius:5px;outline:none;text-align:center"
                  onclick="event.stopPropagation()"/>`
              :`<div style="font-size:1.1rem;color:var(--mid)">＋</div>
                <div style="font-size:.62rem;font-weight:600;color:var(--mid)">New folder</div>`}
          </div>
        </div>
        ${showNewFolderCard?`<div style="display:flex;gap:5px;margin-top:-4px;margin-bottom:6px">
          <button class="btn btn-accent btn-sm" id="btn-create-folder" style="flex:1;font-size:.74rem">Create</button>
          <button class="btn btn-ghost btn-sm" id="btn-cancel-new-folder" style="font-size:.74rem">Cancel</button>
        </div>`:''}
        <div id="gen-msg"></div>
      `:`
        <div id="repo-msg"></div>
        <button class="btn btn-dark btn-sm" id="btn-browse" style="margin-top:6px;width:100%">${repoLoading?'⏳ Loading…':'Load subjects from GitHub →'}</button>
      `}`;

    return `<div class="host-full" style="position:relative">
      ${liveNav}
      ${ctrlBar}
      ${studentsPanel}
      <div class="host-bottom">
        <div class="host-bottom-scroll" style="padding-top:5px">${generatePanel}</div>
      </div>
      ${manageOverlayHTML()}
      ${schedOverlayHTML()}
      ${haltBombOverlayHTML()}
      ${haltMenuOverlayHTML()}
      ${backupRestoreOverlayHTML()}
      ${standingsOverlayHTML()}
      ${reportsOverlayHTML()}
      ${hostSettingsOverlayHTML()}
    ${dismissBombOverlayHTML()}
    </div>`;
  }

  // Questions loaded — build controller
  const q=selIdx>=0?questions[selIdx]:(isLive?S.question:null);

  // Question navigation bar
  const qNav=`<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
    ${selIdx>0?`<button class="btn btn-ghost btn-sm" style="padding:3px 10px" id="btn-q-prev">‹</button>`:'<span style="width:32px"></span>'}
    <span class="muted small" style="flex:1;text-align:center">Q${selIdx>=0?selIdx+1:'?'}/${questions.length}${q&&q.subject?' · '+esc(q.subject):''}</span>
    ${selIdx<questions.length-1?`<button class="btn btn-ghost btn-sm" style="padding:3px 10px" id="btn-q-next">›</button>`:'<span style="width:32px"></span>'}
  </div>`;

  // Timer row — shows input when idle, live countdown when question is live
  const timerTotal=S.timerSeconds||hostTimerSeconds;
  const timerLeft=timerTotal&&S.questionPushedAt&&isLive
    ?Math.max(0,timerTotal-(Date.now()-S.questionPushedAt)/1000)
    :null;
  const timerRow=`
    <div class="timer-input-row" style="flex-shrink:0">
      <span style="flex:1;font-size:.8rem;color:var(--mid)">⏱ Timer per question</span>
      ${isLive&&timerLeft!==null
        ?`<div style="display:flex;align-items:center;gap:8px">
            <div style="width:80px;height:6px;background:var(--line);border-radius:3px;overflow:hidden">
              <div id="host-timer-bar" style="height:100%;background:${timerLeft<timerTotal*0.25?'var(--bad)':'var(--accent)'};border-radius:3px;width:${timerTotal?((timerLeft/timerTotal)*100).toFixed(1):0}%;transition:width .5s linear"></div>
            </div>
            <span id="host-timer-digits" style="font-size:.85rem;font-weight:700;color:${timerLeft<timerTotal*0.25?'var(--bad)':'var(--ink)'};min-width:28px;text-align:right">${Math.min(timerTotal,Math.ceil(timerLeft))}s</span>
          </div>`
        :`<input type="number" min="0" max="300" value="${hostTimerSeconds}" id="timer-sec-live" class="q-count-input" style="width:60px"/>
           <span class="muted small">sec</span>`}
    </div>`;

  // Question text
  const qInfo=q?`<p class="${''+urduCls(q)}" style="font-size:.83rem;line-height:${urduCls(q)?'2.2':'1.4'};flex-shrink:0;color:var(--ink)">${renderMath(q.text.length>130?q.text.slice(0,128)+'…':q.text)}</p>`
    :`<p class="muted small" style="flex-shrink:0">Select a question above or use ‹ › to navigate.</p>`;

  // Live response bars (shown when live instead of key)
  let liveBars='';
  if(isLive&&q){
    const counts=S.answerCounts||[], total=Math.max(1,counts.reduce((a,b)=>a+b,0));
    liveBars=q.options.map((o,i)=>{
      const cnt=counts[i]||0,pct=(cnt/total*100).toFixed(0);
      return `<div class="bar-row">
        <div class="bar-meta"><span class="${''+urduCls(q)}">${'ABCD'[i]}) ${renderMath(o)}${S.correct===i?' ✓':''}</span><span>${cnt}</span></div>
        <div class="bar-track"><div class="bar-fill${S.correct===i?' correct':''}" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');
  }

  // Answer key (shown when not live)
  const keyGrid=(!isLive&&q)?`
    <div class="key-grid" style="flex-shrink:0">
      ${q.options.map((o,i)=>`
        <div class="key-card${answerKey===i?' selected':''}" data-key="${i}" tabindex="0" role="button" aria-pressed="${answerKey===i}" aria-label="Option ${'ABCD'[i]}">
          <div class="kl">${'ABCD'[i]}</div><div class="kt${urduCls(q)}">${renderMath(o)}</div>
        </div>`).join('')}
    </div>`:'';

  // Mic/music state
  const micOn=!!localStream;

  // SVG action icons — refined
  const iconSend=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9" fill="currentColor" stroke="none"/></svg>`;
  const iconEye=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const iconNext=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>`;
  const iconMicOn=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
  const iconMicOff=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;

  // Action buttons — no margin-top:auto (space goes below, not above)
  const actionBtns=`
    <div style="display:flex;gap:6px;flex-shrink:0;padding-top:8px;border-top:1px solid var(--line);margin-top:4px">
      <button class="btn btn-lg" style="flex:1;font-size:.78rem;padding:10px 4px;gap:5px;background:#1e293b;color:#fff;border-color:#1e293b;justify-content:center" id="btn-push"
        ${(!q||answerKey<0||pushing||isLive)?'disabled':''}>${iconSend}${pushing?'Sending…':'Push'}</button>
      <button class="btn btn-lg" style="flex:1;font-size:.78rem;padding:10px 4px;gap:5px;background:#f59e0b;color:#fff;border-color:#f59e0b;justify-content:center" id="btn-reveal"
        ${(!isLive||isRevealed)?'disabled':''}>${iconEye} Reveal</button>
      <button class="btn btn-lg" style="flex:1;font-size:.78rem;padding:10px 4px;gap:5px;background:#0ea5e9;color:#fff;border-color:#0ea5e9;justify-content:center" id="btn-next"
        ${!isRevealed?'disabled':''}>${iconNext} Next</button>
      <button class="btn btn-lg" style="padding:10px 12px;flex-shrink:0;justify-content:center;${micOn?'background:#fee2e2;color:#be123c;border-color:#fecaca':'background:var(--faint);color:var(--mid);border-color:var(--line)'}"
        id="${micOn?'btn-mic-stop':'btn-mic-start'}" title="${micOn?'Stop mic':'Start mic'}">${micOn?iconMicOff:iconMicOn}</button>
    </div>`;

  return `<div class="host-full" style="position:relative">
    ${liveNav}
    ${ctrlBar}
    ${studentsPanel}
    <div class="host-bottom">
      ${qNav}
      ${timerRow}
      ${qInfo}
      <div style="flex:1;overflow-y:auto;min-height:0">
        ${isLive
          ?`<div>${liveBars}</div>`
          :keyGrid}
      </div>
      ${actionBtns}
    </div>
    ${schedOverlayHTML()}
    ${haltBombOverlayHTML()}
    ${haltMenuOverlayHTML()}
    ${backupRestoreOverlayHTML()}
    ${standingsOverlayHTML()}
    ${reportsOverlayHTML()}
    ${hostSettingsOverlayHTML()}
  </div>`;
}

/* ══════════════════════════════════════
   HOST ENDED
══════════════════════════════════════ */
function hostEndedHTML(){
  const history=S.history||[], parts=S.participants||[];
  const sorted=[...parts].sort((a,b)=>(b.score||0)-(a.score||0));
  const partMap={}; parts.forEach(p=>partMap[p.id]=p);
  const totalQs=history.length;
  const totalLabel=String(totalQs||S.pushedCount||0);
  const table=parts.length&&history.length?`<div class="itbl-wrap"><table class="itbl">
    <thead><tr><th>Student</th>${history.map((_,i)=>`<th>Q${i+1}</th>`).join('')}<th>Score</th></tr></thead>
    <tbody>${sorted.map(p=>`<tr data-pid="${p.id}"><td><strong>${esc(p.name)}</strong></td>
      ${history.map(h=>{const ans=h.answers[p.id]??null;if(ans===null)return'<td class="c-nil">—</td>';return`<td class="${ans===h.correct?'c-ok':'c-bad'}">${'ABCD'[ans]}${ans===h.correct?' ✓':' ✗'}</td>`;}).join('')}
      <td><strong>${p.score||0}</strong><span style="font-size:.7rem;color:var(--mid)">/${totalLabel}</span></td></tr>`).join('')}</tbody>
  </table></div>`:'<div class="notice n-neutral">No data recorded.</div>';
  let detail='';
  if(inspectPid&&partMap[inspectPid]){
    const p=partMap[inspectPid];
    detail=`<div class="detail-wrap"><div class="detail-head"><span><strong>${esc(p.name)}</strong> — ${p.score||0}/${totalLabel}</span><button class="btn btn-ghost btn-sm" id="btn-close-inspect">Close</button></div>
      ${history.map((h,i)=>{const ans=h.answers[p.id]??null;return`<div class="detail-row"><div class="detail-q">Q${i+1}: ${renderMath(h.question.text)}</div>
        <div class="ans-chips">${h.question.options.map((o,oi)=>{let cls='ac-none';if(oi===h.correct)cls='ac-good';if(ans===oi&&oi!==h.correct)cls='ac-bad';const mark=oi===ans?(oi===h.correct?' ✓':' ✗'):'';
          return`<span class="ans-chip ${cls}" style="${oi===ans||oi===h.correct?'font-weight:600':''}">${'ABCD'[oi]}) ${renderMath(o)}${mark}</span>`;}).join('')}${ans===null?'<span class="ans-chip ac-none">No answer</span>':''}</div></div>`;}).join('')}
    </div>`;
  }
  return `<div style="position:relative;padding:16px;width:100%;box-sizing:border-box">
    <div class="results-header">
      <h2>Results</h2>
      <div class="results-btns">
        <button class="btn btn-good btn-sm" id="btn-continue-session">▶ Continue</button>
        <button class="btn btn-warn btn-sm" id="btn-halt">⏹ Halt &amp; Dismiss</button>
        <button class="btn btn-ghost btn-sm" id="btn-reset">↺ Reset</button>
      </div>
    </div>
    <div class="notice n-neutral mb3" style="font-size:.79rem">
      <strong>Continue</strong> — return to waiting room &nbsp;·&nbsp; <strong>Halt</strong> — send students home
    </div>
    <p class="muted small mb2">Tap any row to inspect answers.</p>${table}${detail}
    ${haltBombOverlayHTML()}
    ${haltMenuOverlayHTML()}
    ${backupRestoreOverlayHTML()}
    ${dismissBombOverlayHTML()}
  </div>`;
}
/* ══════════════════════════════════════
   PROFILE PAGE
══════════════════════════════════════ */
function buildRankCardHTML(){
  if(!currentUser) return '';
  const myId = String(currentUser.id || '');
  const myEntry    = allTimeLB ? allTimeLB.find(e => String(e.userId) === myId) : null;
  const myRankAll  = allTimeLB ? allTimeLB.findIndex(e => String(e.userId) === myId) + 1 : 0;
  const totalPlayers = allTimeLB ? allTimeLB.length : 0;
  const totalPts   = myEntry ? (myEntry.totalScore || 0) : 0;
  if(allTimeLB===null)
    return `<div class="prank-card" id="profile-rank-card"><div class="prank-num" style="font-size:1.2rem;color:var(--mid)">…</div><div class="prank-info"><div class="prank-label">All-Time Rank</div><div class="prank-sub">Loading leaderboard…</div></div></div>`;
  if(myEntry)
    return `<div class="prank-card" id="profile-rank-card"><div class="prank-num">#${myRankAll}</div><div class="prank-info"><div class="prank-label">All-Time Rank</div><div class="prank-sub">of ${totalPlayers} players · ${totalPts} total pts</div></div><div style="font-size:1.4rem">🏅</div></div>`;
  return `<div class="prank-card" id="profile-rank-card"><div class="prank-num" style="font-size:1rem;color:var(--mid)">—</div><div class="prank-info"><div class="prank-label">All-Time Rank</div><div class="prank-sub">Not yet ranked on the leaderboard</div></div></div>`;
}
/* ── async profile data loader ─────────────────────────────────────────── */
async function loadProfileData(){
  const el=document.getElementById('profile-data-body');
  if(!el) return;
  try{
    const history=await loadHistory();
    if(profileTab==='overview') el.innerHTML=buildOverviewHTML(history);
    else if(profileTab==='history') el.innerHTML=buildHistoryHTML(history);
    requestAnimationFrame(setupProfileCharts);
  }catch(err){
    if(el) el.innerHTML=`<div class="no-data-notice"><span>⚠️</span><b style="color:var(--ink)">Failed to load</b><br><span style="font-size:.75rem;font-family:monospace">${err.message}</span></div>`;
  }
}

function buildOverviewHTML(history){
  if(!history.length)
    return '<div class="no-data-notice"><span>📊</span>No sessions yet. Complete a quiz to see your stats here!</div>';
  const totalCorrect=history.reduce((s,e)=>s+(e.correct||0),0);
  const totalQs=history.reduce((s,e)=>s+(e.total||0),0);
  const accuracy=totalQs?Math.round(totalCorrect/totalQs*100):0;
  const bestScore=Math.max(...history.map(e=>e.score||0));
  const allFastMs=history.map(e=>e.fastestMs).filter(v=>v!=null&&v>0);
  const fastestMs=allFastMs.length?Math.min(...allFastMs):null;
  const fastLabel=fastestMs!=null?(fastestMs<1000?(fastestMs+'ms'):(fastestMs/1000).toFixed(1)+'s'):'—';
  const statsHTML='<div class="pov-stats">'
    +'<div class="pov-stat"><div class="pov-stat-num">'+history.length+'</div><div class="pov-stat-lbl">Sessions</div></div>'
    +'<div class="pov-stat"><div class="pov-stat-num">'+accuracy+'%</div><div class="pov-stat-lbl">Accuracy</div></div>'
    +'<div class="pov-stat"><div class="pov-stat-num">'+bestScore+'</div><div class="pov-stat-lbl">Best Score</div></div>'
    +'<div class="pov-stat"><div class="pov-stat-num" style="font-size:'+(fastestMs&&fastestMs<10000?'1.25rem':'1rem')+'">'+fastLabel+'</div><div class="pov-stat-lbl">Fastest Correct ⚡</div></div>'
    +'</div>';
  // Score bar chart
  const last15=[...history].reverse().slice(-15);
  const scores=last15.map(e=>e.score||0);
  const maxScore=Math.max(...scores,1);
  const step=profileNiceStep(maxScore);
  const gridMax=Math.ceil(maxScore/step)*step;
  const gridLines=[];
  for(let v=0;v<=gridMax;v+=step) gridLines.push(v);
  const W=520,H=140,PL=36,PB=24,PT=10,PR=6;
  const cW=W-PL-PR,cH=H-PT-PB;
  const bc=last15.length,bW=Math.floor(cW/bc*0.6),bG=cW/bc;
  const mIdx=scores.indexOf(Math.max(...scores));
  let svgBars='',svgGrid='',svgLbls='';
  gridLines.forEach(v=>{
    const y=PT+cH-(v/gridMax)*cH;
    svgGrid+='<line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+y+'" y2="'+y+'" stroke="#e4e3df" stroke-width="1"/>';
    svgLbls+='<text x="'+(PL-4)+'" y="'+(y+4)+'" text-anchor="end" font-size="10" fill="#9a9990">'+v+'</text>';
  });
  svgGrid+='<line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+(PT+cH)+'" y2="'+(PT+cH)+'" stroke="#e4e3df" stroke-width="1"/>';
  last15.forEach((e,i)=>{
    const x=PL+i*bG+bG/2;
    const bH=scores[i]>0?(scores[i]/gridMax)*cH:2;
    const y=PT+cH-bH;
    const fill=i===mIdx?'#111110':'#c8c7c3';
    const d=new Date(e.date);
    const lbl=d.toLocaleDateString('en',{weekday:'short',month:'short',day:'numeric'});
    svgBars+='<rect class="bar-rect" x="'+(x-bW/2)+'" y="'+y+'" width="'+bW+'" height="'+bH+'" rx="2" fill="'+fill+'" data-score="'+scores[i]+'" data-label="'+lbl+'" style="cursor:pointer"/>';
  });
  const barChartHTML='<div class="pchart-card"><div class="pchart-head"><span class="pchart-title">Score History</span><span style="font-size:.7rem;color:var(--mid)">Last '+last15.length+' sessions</span></div>'
    +'<div class="chart-wrap" id="score-chart-wrap"><div class="chart-tooltip" id="score-tooltip"></div>'
    +'<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block;overflow:visible"><g>'+svgGrid+svgLbls+svgBars+'</g></svg></div></div>';
  // Accuracy chart
  const accs=last15.map(e=>e.total?Math.round(e.correct/e.total*100):null);
  const validAccs=accs.filter(v=>v!==null);
  const avgAcc=validAccs.length?Math.round(validAccs.reduce((a,b)=>a+b,0)/validAccs.length):0;
  const pbAcc=Math.max(...validAccs,0);
  const pbAccIdx=accs.indexOf(pbAcc);
  const AW=520,AH=150,AL=36,AB=24,AT=18,AR=6;
  const achW=AW-AL-AR,achH=AH-AT-AB;
  const pts2=accs.map((v,i)=>v!==null?{x:AL+i*(achW/(last15.length-1||1)),y:AT+achH-(v/100)*achH}:null);
  const validPts=pts2.filter(p=>p!==null);
  const curvePath=profileCatmullToCubic(validPts);
  const fillPath=validPts.length>1?(curvePath+' L'+validPts[validPts.length-1].x+','+( AT+achH)+' L'+validPts[0].x+','+(AT+achH)+' Z'):'';
  let accGrid='',accLbls='';
  [0,25,50,75,100].forEach(v=>{
    const y=AT+achH-(v/100)*achH;
    accGrid+='<line x1="'+AL+'" x2="'+(AW-AR)+'" y1="'+y+'" y2="'+y+'" stroke="#e4e3df" stroke-width="1" stroke-dasharray="'+(v===0?'none':'3,3')+'"/>';
    accLbls+='<text x="'+(AL-4)+'" y="'+(y+4)+'" text-anchor="end" font-size="10" fill="#9a9990">'+v+'</text>';
  });
  const pbY=AT+achH-(pbAcc/100)*achH,avgY=AT+achH-(avgAcc/100)*achH;
  const pbLine='<line x1="'+AL+'" x2="'+(AW-AR)+'" y1="'+pbY+'" y2="'+pbY+'" stroke="#2d6a4f" stroke-width="1.5" stroke-dasharray="5,3" opacity=".8"/>';
  const avgLine='<line x1="'+AL+'" x2="'+(AW-AR)+'" y1="'+avgY+'" y2="'+avgY+'" stroke="#9a9990" stroke-width="1.5" stroke-dasharray="5,3" opacity=".7"/>';
  let dots='';
  accs.forEach((v,i)=>{
    if(v===null) return;
    const p=pts2[i];
    const isPB=i===pbAccIdx,isLast=i===last15.length-1,isBig=isPB||isLast;
    let fill=v>=avgAcc?'#2d9e6b':'#c1121f'; if(isPB) fill='#2d6a4f';
    const d=new Date(last15[i].date);
    const lbl=v+'% · '+d.toLocaleDateString('en',{weekday:'short',month:'short',day:'numeric'});
    dots+='<circle class="acc-dot" cx="'+p.x+'" cy="'+p.y+'" r="'+(isBig?5:3.5)+'" fill="'+fill+'" stroke="'+(isBig?'white':'none')+'" stroke-width="'+(isBig?1.5:0)+'" data-label="'+lbl+'" style="cursor:pointer"/>';
  });
  const gId='accGrad';
  const accChartHTML='<div class="pchart-card"><div class="pchart-head"><span class="pchart-title">Accuracy Trend</span>'
    +'<div class="pchart-legend"><div class="pchart-leg-item"><div class="pchart-leg-dash" style="border-top:2px dashed #2d6a4f;height:0"></div><span>PB '+pbAcc+'%</span></div>'
    +'<div class="pchart-leg-item"><div class="pchart-leg-dash" style="border-top:2px dashed #9a9990;height:0"></div><span>Avg '+avgAcc+'%</span></div></div></div>'
    +'<div class="chart-wrap" id="acc-chart-wrap"><div class="chart-tooltip" id="acc-tooltip"></div>'
    +'<svg viewBox="0 0 '+AW+' '+AH+'" style="width:100%;height:auto;display:block;overflow:visible">'
    +'<defs><linearGradient id="'+gId+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2d9e6b" stop-opacity=".22"/><stop offset="100%" stop-color="#2d9e6b" stop-opacity="0"/></linearGradient></defs>'
    +accGrid+accLbls
    +(fillPath?'<path d="'+fillPath+'" fill="url(#'+gId+')"/>' : '')
    +(validPts.length>1?'<path d="'+curvePath+'" fill="none" stroke="#2d9e6b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' : '')
    +avgLine+pbLine+dots
    +'</svg></div></div>';
  // Heatmap
  const now=new Date(); now.setHours(23,59,59,999);
  const hmStart=new Date(now); hmStart.setDate(hmStart.getDate()-104); hmStart.setHours(0,0,0,0);
  const dayCounts={};
  history.forEach(e=>{ const k=new Date(e.date).toDateString(); dayCounts[k]=(dayCounts[k]||0)+1; });
  let cols='';
  for(let w=0;w<15;w++){
    let cells='';
    for(let day=0;day<7;day++){
      const dt=new Date(hmStart); dt.setDate(dt.getDate()+w*7+day);
      if(dt>now){ cells+='<div class="hm-cell" data-v="0" style="opacity:.2"></div>'; continue; }
      const cnt=dayCounts[dt.toDateString()]||0;
      const v=cnt===0?0:cnt===1?1:cnt===2?2:cnt<=4?3:4;
      const lbl=cnt?(dt.toLocaleDateString('en',{month:'short',day:'numeric'})+': '+cnt+' session'+(cnt>1?'s':'')):dt.toLocaleDateString('en',{month:'short',day:'numeric'});
      cells+='<div class="hm-cell" data-v="'+v+'" title="'+lbl+'"></div>';
    }
    cols+='<div class="hm-col">'+cells+'</div>';
  }
  const hmHTML='<div class="pchart-card"><div class="pchart-head"><span class="pchart-title">Activity</span></div>'
    +'<div class="heatmap-grid">'+cols+'</div>'
    +'<div class="hm-legend"><span>Less</span>'
    +'<div class="hm-swatch" style="background:#edecea"></div><div class="hm-swatch" style="background:#b7dfc7"></div>'
    +'<div class="hm-swatch" style="background:#74c69d"></div><div class="hm-swatch" style="background:#40916c"></div>'
    +'<div class="hm-swatch" style="background:#1b4332"></div><span>More</span></div></div>';
  // Breakdown
  const avgScore=history.length?Math.round(history.reduce((s,e)=>s+(e.score||0),0)/history.length):0;
  const bestRanks=history.map(e=>e.rank||999).filter(r=>r>0);
  const bestRank=bestRanks.length?Math.min(...bestRanks):null;
  const since=new Date(history[history.length-1].date).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'});
  const breakdownHTML='<div class="pchart-card"><div class="pchart-head"><span class="pchart-title">Breakdown</span></div>'
    +'<div class="prow"><span>Avg score per session</span><span class="prow-val">'+avgScore+' pts</span></div>'
    +'<div class="prow"><span>Personal best accuracy</span><span class="prow-val" style="color:var(--good)">'+pbAcc+'%</span></div>'
    +(bestRank?'<div class="prow"><span>Best rank achieved</span><span class="prow-val">#'+bestRank+'</span></div>':'')
    +'<div class="prow"><span>Total questions seen</span><span class="prow-val">'+totalQs+'</span></div>'
    +'<div class="prow"><span>Total correct answers</span><span class="prow-val">'+totalCorrect+'</span></div>'
    +'<div class="prow"><span>Playing since</span><span class="prow-val">'+since+'</span></div></div>';
  return statsHTML+barChartHTML+accChartHTML+hmHTML+breakdownHTML+buildRankCardHTML();
}

function buildHistoryHTML(history){
  if(!history.length)
    return '<div class="no-data-notice"><span>📋</span>No sessions recorded yet.</div>';
  const maxScore=Math.max(...history.map(e=>e.score||0));
  const rows=history.map(e=>{
    const d=new Date(e.date);
    const acc=e.total?Math.round(e.correct/e.total*100):null;
    const cls=acc===null?'ok':acc>=70?'good':acc>=45?'ok':'bad';
    const isPB=e.score===maxScore;
    const rankStr=e.rank&&e.participants?('#'+e.rank+' of '+e.participants):e.rank?('#'+e.rank):'';
    return '<div class="hist-row">'
      +'<div class="col" style="min-width:80px;flex-shrink:0">'
      +'<span class="hist-date">'+d.toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'})+'</span>'
      +'<span class="hist-date" style="margin-top:1px">'+d.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})+'</span></div>'
      +'<div class="hist-score">'+(e.score||0)+' pts'+(isPB?'<span class="hist-pb-badge">PB</span>':'')+'</div>'
      +'<div class="hist-rank">'+rankStr+'</div>'
      +'<div class="hist-acc '+cls+'">'+(acc!==null?acc+'%':'—')+'</div>'
      +'</div>';
  }).join('');
  return '<div style="margin-bottom:6px;font-size:.75rem;color:var(--mid)">'+history.length+' session'+(history.length>1?'s':'')+' recorded</div>'+rows;
}

function profileNiceStep(max){
  const raw=max/5;
  const mag=Math.pow(10,Math.floor(Math.log10(raw||1)));
  const norm=raw/mag;
  const nice=norm<=1?1:norm<=2?2:norm<=5?5:10;
  return Math.max(1,nice*mag);
}
function profileCatmullToCubic(pts){
  if(pts.length<2) return '';
  let d=`M${pts[0].x},${pts[0].y}`;
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[Math.max(i-1,0)], p1=pts[i], p2=pts[i+1], p3=pts[Math.min(i+2,pts.length-1)];
    const cp1x=p1.x+(p2.x-p0.x)/6, cp1y=p1.y+(p2.y-p0.y)/6;
    const cp2x=p2.x-(p3.x-p1.x)/6, cp2y=p2.y-(p3.y-p1.y)/6;
    d+=` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}
function profilePageHTML(){
  const u=currentUser;
  const initials=u.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  // Schedule tab removed — only in host panel
  const TABS=[['overview','📈 Overview'],['history','📋 History'],['settings','⚙️ Settings']];
  const tabsHTML=TABS.map(([t,l])=>`<div class="ptab${profileTab===t?' active':''}" data-ptab="${t}">${l}</div>`).join('');

  let body='';

  if(profileTab==='overview'||profileTab==='history'){
    // Render a skeleton — real data loaded async by loadProfileData()
    body=`<div id="profile-data-body">
      <div style="text-align:center;padding:48px 16px;color:var(--mid)">
        <div style="font-size:1.5rem;margin-bottom:10px;opacity:.4">⏳</div>
        <div style="font-size:.83rem">Loading…</div>
      </div>
    </div>`;
  }
  if(profileTab==='settings'){
    const hasUsername=!!(u.username);
    const isStudent = u.role !== 'host';
    const approvalNote = isStudent
      ? `<div class="notice n-accent" style="font-size:.77rem;margin-bottom:10px">ℹ️ Name and username changes require host approval before taking effect.</div>`
      : '';
    body=`
    <div class="psec">
      <h3>🎭 Session Display Name</h3>
      ${approvalNote}
      <p class="muted small mb2" style="font-size:.77rem">Shown during quizzes instead of your full name.</p>
      <div class="form-row"><label>Display name</label><input class="form-input" id="p-disp-in" maxlength="32" value="${esc(u.name)}" placeholder="Your quiz nickname"/></div>
      <button class="btn btn-dark btn-sm" id="btn-save-disp">Submit${isStudent?' for approval':''}</button>
      <div class="form-msg" id="p-disp-msg"></div>
    </div>
    <div class="psec">
      <h3>🪪 Username</h3>
      ${hasUsername
        ? `<p class="muted small mb2" style="font-size:.77rem">Your username is used for login. Once set it cannot be removed, only changed.</p>
           <div class="form-row"><label>Username</label><div style="position:relative"><input class="form-input" id="p-uname-in" maxlength="30" value="${esc(u.username)}" placeholder="your_username" autocapitalize="none" spellcheck="false" style="padding-right:36px"/><span id="p-un-status" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:.85rem;line-height:1;pointer-events:none"></span></div></div>
           <small id="p-un-hint" style="font-size:.72rem;margin-top:3px;display:block;color:var(--mid)">Letters, numbers, underscores · 3–30 characters</small>`
        : `<p class="muted small mb2" style="font-size:.77rem">You didn't set a username when registering. Add one now to log in without email. Once set it cannot be removed.</p>
           <div class="form-row"><label>Username</label><div style="position:relative"><input class="form-input" id="p-uname-in" maxlength="30" placeholder="your_username" autocapitalize="none" spellcheck="false" style="padding-right:36px"/><span id="p-un-status" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:.85rem;line-height:1;pointer-events:none"></span></div></div>
           <small id="p-un-hint" style="font-size:.72rem;margin-top:3px;display:block;color:var(--mid)">Letters, numbers, underscores · 3–30 characters</small>`
      }
      <button class="btn btn-dark btn-sm mt1" id="btn-save-uname">${hasUsername?`Update username${isStudent?' (submit for approval)':''}`:isStudent?'Set username (submit for approval)':'Set username'}</button>
      <div class="form-msg" id="p-uname-msg"></div>
    </div>
    <div class="psec">
      <h3>🔑 Change Password</h3>
      <div class="form-row"><label>Current password</label><input class="form-input" type="password" id="p-pw-cur" placeholder="Current password"/></div>
      <div class="form-row"><label>New password</label><input class="form-input" type="password" id="p-pw-new" placeholder="Min 6 characters"/></div>
      <div class="form-row"><label>Confirm new</label><input class="form-input" type="password" id="p-pw-new2" placeholder="Repeat new password"/></div>
      <button class="btn btn-dark btn-sm" id="btn-save-pw">Update password</button>
      <div class="form-msg" id="p-pw-msg"></div>
    </div>`;
  }

  const disp=u.name;
  return `<div class="profile-page">
    <div class="row gap2 mb3">
      <span style="font-size:.95rem;font-weight:600">My Profile</span>
    </div>
    <div class="profile-hero">
      <div class="ph-avatar">${initials}</div>
      <div class="ph-info">
        <div class="ph-name">${esc(disp)}</div>
        <div class="ph-email">${u.email ? esc(u.email) : ''}${u.username ? `<span style="color:var(--mid);margin-left:6px">· @${esc(u.username)}</span>` : ''}</div>
      </div>
    </div>
    <div class="ptabs">${tabsHTML}</div>
    ${body}
  </div>`;
}

/* ══════════════════════════════════════
   PROFILE CHART INTERACTIONS
══════════════════════════════════════ */
let _chartListenerAC = null;
function setupProfileCharts(){
  // Kill any previous tooltip listeners before re-attaching
  if(_chartListenerAC) _chartListenerAC.abort();
  _chartListenerAC = new AbortController();
  const sig = _chartListenerAC.signal;

  function attachTooltip(wrapId, tooltipId, selector, getContent){
    const wrap=document.getElementById(wrapId);
    const tip=document.getElementById(tooltipId);
    if(!wrap||!tip) return;
    let dismissTimer=null;
    const show=(el)=>{
      clearTimeout(dismissTimer);
      const content=getContent(el);
      if(!content) return;
      tip.textContent=content;
      const wrapRect=wrap.getBoundingClientRect();
      const elRect=el.getBoundingClientRect();
      const cx=elRect.left+elRect.width/2-wrapRect.left;
      tip.style.left=Math.max(5,Math.min(95,(cx/wrapRect.width)*100))+'%';
      tip.style.opacity='1';
    };
    const hide=()=>{ tip.style.opacity='0'; };
    wrap.querySelectorAll(selector).forEach(el=>{
      el.addEventListener('mouseenter',()=>show(el),{signal:sig});
      el.addEventListener('mouseleave',hide,{signal:sig});
      el.addEventListener('touchstart',e=>{ e.preventDefault(); show(el); clearTimeout(dismissTimer); dismissTimer=setTimeout(hide,1400); },{passive:false,signal:sig});
    });
  }

  attachTooltip('score-chart-wrap','score-tooltip','.bar-rect',el=>`${el.dataset.score} pts · ${el.dataset.label}`);
  attachTooltip('acc-chart-wrap','acc-tooltip','.acc-dot',el=>el.dataset.label);
}

function attach(){
  // Click sounds on interactive elements
  document.querySelectorAll('.btn,.key-card,.auth-tab,.home-tab').forEach(el=>
    el.addEventListener('click',playClick,{capture:true,once:true})
  );

  // Auth
  on('tab-login',  ()=>{ authTab='login';  render(); });
  on('tab-register',()=>{ authTab='register'; render(); });
  on('btn-login',   doLogin);
  on('btn-register',doRegister);
  document.getElementById('auth-pw')?.addEventListener('keydown',e=>{ if(e.key==='Enter'){ if(authTab==='login') doLogin(); else doRegister(); }});
  document.getElementById('auth-username')?.addEventListener('keydown',e=>{ if(e.key==='Enter'){ document.getElementById('auth-pw')?.focus(); }});
  // Live username availability check (register tab only)
  if(authTab==='register'){
    _unLastChecked=''; // reset cache on each render
    document.getElementById('auth-username')?.addEventListener('input',e=>{
      liveCheckUsername(e.target.value.trim());
    });
  }

  // Profile dropdown — one-time setup handled in setupOutsideClick() above
  setupOutsideClick();
  on('btn-logout', doLogout);
  on('btn-profile',()=>{ showingProfile=true; profileTab='overview'; document.getElementById('p-dropdown')?.classList.add('hidden'); navPush(); render(); if(!allTimeLB) fetchLeaderboard('all'); });
  on('btn-profile-back',()=>{ showingProfile=false; render(); });
  document.querySelectorAll('.ptab[data-ptab]').forEach(el=>el.addEventListener('click',()=>{
    profileTab=el.dataset.ptab;
    render();
    if(profileTab==='overview'&&!allTimeLB) fetchLeaderboard('all');
  }));
  document.querySelectorAll('.ptab[data-itab]').forEach(el=>el.addEventListener('click',()=>{
    inspectTab=el.dataset.itab;
    inspectCache=null;
    render();
  }));
  if(showingProfile){
    requestAnimationFrame(setupProfileCharts);
  }

  on('btn-dismissed-home', doDismissHome);
  on('btn-fetch-updates', ()=>{
    const btn=document.getElementById('btn-fetch-updates');
    if(btn){ btn.disabled=true; btn.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin .7s linear infinite"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Updating…'; }
    setTimeout(()=>location.reload(), 400);
  });
  on('btn-lb-refresh',()=>{
    // Refresh only the currently visible tab; reset its cache and re-fetch
    const p = homeLbTab;
    if(p==='today')  todayLB=null;
    else if(p==='week') weekLB=null;
    else allTimeLB=null;
    lbFetched[p]=null; lbErrors[p]=null;
    render();
    fetchLeaderboard(p);
  });

  // Home leaderboard tabs — switch tab; fetch lazily only if not yet cached
  document.querySelectorAll('[data-hlb]').forEach(el=>{
    el.addEventListener('click',()=>{
      const p = el.dataset.hlb;
      homeLbTab = p;
      render(); // switch tab immediately (shows cached data or spinner)
      // Fetch only if this tab has never been loaded
      const cached = p==='today' ? todayLB : p==='week' ? weekLB : allTimeLB;
      if(cached === null && lbFetched[p] !== false) fetchLeaderboard(p);
    });
  });

  // Host home button (inside full-window host nav)
  on('btn-host-home', doBack);
  on('btn-pw-back', doBack);
  // Question prev/next inside host controller
  on('btn-q-prev',()=>{ if(selIdx>0){selIdx--;answerKey=questions[selIdx].correct??-1;render();} });
  on('btn-q-next',()=>{ if(selIdx<questions.length-1){selIdx++;answerKey=questions[selIdx].correct??-1;render();} });

  // Nav back button — delegates to shared doBack()
  on('btn-nav-back', doBack);

  // Profile settings
  on('btn-save-disp', async ()=>{
    const v=document.getElementById('p-disp-in')?.value?.trim();
    const msg=document.getElementById('p-disp-msg'); if(!msg)return;
    if(!v){msg.className='form-msg err';msg.textContent='Name required';return;}
    try{
      const d=await apiPost('/api/update-name',{displayName:v},true);
      if(d.pending){
        msg.className='form-msg ok';
        msg.textContent='⏳ '+d.message;
      } else {
        saveAuth(d.token,d.user); msg.className='form-msg ok'; msg.textContent='✓ Saved!';
        setTimeout(()=>render(),700);
      }
    }catch(e){msg.className='form-msg err';msg.textContent=e.message;}
  });
  // Username live availability check in profile settings
  document.getElementById('p-uname-in')?.addEventListener('input', async (e)=>{
    const val=e.target.value.trim();
    const status=document.getElementById('p-un-status');
    const hint=document.getElementById('p-un-hint');
    if(!status)return;
    if(!val||val.length<3){status.textContent='';return;}
    if(!/^[a-zA-Z0-9_]+$/.test(val)){status.textContent='🚫';if(hint)hint.textContent='Letters, numbers, underscores only';return;}
    // If same as current username, no need to check
    if(currentUser?.username&&val.toLowerCase()===currentUser.username.toLowerCase()){status.textContent='✅';if(hint)hint.textContent='This is your current username';return;}
    try{
      const r=await fetch('/api/check-username?username='+encodeURIComponent(val));
      const j=await r.json();
      status.textContent=j.available?'✅':'🚫';
      if(hint)hint.textContent=j.available?'Username is available':'Username is already taken';
    }catch(_){status.textContent='';}
  });
  on('btn-save-uname', async ()=>{
    const v=document.getElementById('p-uname-in')?.value?.trim();
    const msg=document.getElementById('p-uname-msg'); if(!msg)return;
    if(!v){msg.className='form-msg err';msg.textContent='Username required';return;}
    if(!/^[a-zA-Z0-9_]{3,30}$/.test(v)){msg.className='form-msg err';msg.textContent='3–30 chars, letters/numbers/underscores only';return;}
    const status=document.getElementById('p-un-status');
    if(status?.textContent==='🚫'){msg.className='form-msg err';msg.textContent='That username is already taken';return;}
    try{
      const d=await apiPost('/api/update-username',{username:v},true);
      if(d.pending){
        msg.className='form-msg ok';
        msg.textContent='⏳ '+d.message;
      } else {
        saveAuth(d.token,d.user); msg.className='form-msg ok'; msg.textContent='✓ Username saved!';
        setTimeout(()=>render(),800);
      }
    }catch(e){msg.className='form-msg err';msg.textContent=e.message;}
  });
  on('btn-save-pw', async ()=>{
    const cur=document.getElementById('p-pw-cur')?.value;
    const nw=document.getElementById('p-pw-new')?.value;
    const nw2=document.getElementById('p-pw-new2')?.value;
    const msg=document.getElementById('p-pw-msg'); if(!msg)return;
    if(!cur||!nw||!nw2){msg.className='form-msg err';msg.textContent='Fill all fields';return;}
    if(nw!==nw2){msg.className='form-msg err';msg.textContent='New passwords do not match';return;}
    try{
      await apiPost('/api/change-password',{currentPassword:cur,newPassword:nw},true);
      msg.className='form-msg ok'; msg.textContent='✓ Password updated!';
      ['p-pw-cur','p-pw-new','p-pw-new2'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
    }catch(e){msg.className='form-msg err';msg.textContent=e.message;}
  });

  // Host schedule (sidebar)
  on('btn-sched-add', async ()=>{
    const title=document.getElementById('sched-title')?.value?.trim();
    const dt=document.getElementById('sched-dt')?.value;
    const notes=document.getElementById('sched-notes')?.value?.trim();
    const msg=document.getElementById('sched-msg'); if(!msg)return;
    if(!title||!dt){msg.className='form-msg err';msg.textContent='Title and date required';return;}
    const ts=new Date(dt).getTime();
    if(ts<=Date.now()){msg.className='form-msg err';msg.textContent='Choose a future date';return;}
    try{
      await apiPost('/api/schedules',{title,ts,notes:notes||''},true);
      msg.className='form-msg ok'; msg.textContent='✓ Scheduled!';
      await fetchHostSchedules();
      setTimeout(()=>{ if(document.getElementById('sched-msg')) document.getElementById('sched-msg').textContent=''; },2000);
    }catch(e){ msg.className='form-msg err'; msg.textContent=e.message; }
  });
  document.querySelectorAll('[data-sdel]').forEach(el=>el.addEventListener('click', async()=>{
    try{ await apiDel('/api/schedules/'+el.dataset.sdel); await fetchHostSchedules(); }catch(e){}
  }));

  // Landing tabs
  on('ht-home',()=>{ homeSection='home'; render(); });
  on('ht-lb',()=>{
    const wasAlreadyOnLb = homeSection==='leaderboard';
    homeSection='leaderboard';
    if(!wasAlreadyOnLb) homeLbTab='today';
    render();
    // Fetch only tabs that haven't been loaded yet — preserve cached data
    ['today','week','all'].forEach(p=>{
      const cached=p==='today'?todayLB:p==='week'?weekLB:allTimeLB;
      if(cached===null&&lbFetched[p]!==false) fetchLeaderboard(p);
    });
  });

  // Control Panel — box button toggle
  window.openInspect = openInspect;
  window.cpToggle = function(key){
    const panels = ['join','update','notice','users'];
    const btns   = ['join','update','notice','users'];
    panels.forEach(k=>{
      const panel = document.getElementById('cppanel-'+k);
      const btn   = document.getElementById('cpbtn-'+k);
      if(k===key){
        const isOpen = panel && panel.classList.contains('open');
        if(panel) panel.classList.toggle('open',!isOpen);
        if(btn)   btn.classList.toggle('active',!isOpen);
      } else {
        if(panel) panel.classList.remove('open');
        if(btn)   btn.classList.remove('active');
      }
    });
  };

  // Control Panel — admin request actions
  on('btn-cp-refresh', ()=>fetchAdminRequests());
  document.querySelectorAll('[data-jr-approve]').forEach(el=>{
    el.addEventListener('click',()=>approveJoinReq(el.dataset.jrApprove));
  });
  document.querySelectorAll('[data-jr-reject]').forEach(el=>{
    el.addEventListener('click',()=>rejectJoinReq(el.dataset.jrReject));
  });
  document.querySelectorAll('[data-ur-approve]').forEach(el=>{
    el.addEventListener('click',()=>approveUpdateReq(el.dataset.urApprove));
  });
  document.querySelectorAll('[data-ur-reject]').forEach(el=>{
    el.addEventListener('click',()=>rejectUpdateReq(el.dataset.urReject));
  });
  // Registered Users panel — delete
  document.querySelectorAll('[data-user-delete]').forEach(el=>{
    el.addEventListener('click',()=>deleteUser(el.dataset.userDelete, el.dataset.userName));
  });
  on('btn-notice-post', async ()=>{
    const txt=document.getElementById('notice-input')?.value||'';
    await postNotice(txt);
  });

  // Landing nav — role-based
  on('go-host', ()=>{ role='host'; hostAuthed=false; navPush(); render(); });
  on('go-selfquiz', ()=>{ location.href='/selfquiz'; });
  on('go-join',  ()=>{
    role='participant';
    fetchSchedules();
    navPush(); render();
  });
  on('btn-back-home',()=>{ role=null; myName=null; myPid=null; render(); });

  // Host pass
  // btn-pw-back handled above via doBack
  on('btn-pw-ok',  doHostLogin);
  document.getElementById('pw-in')?.addEventListener('keydown',e=>{ if(e.key==='Enter') doHostLogin(); });
  document.getElementById('pw-in')?.focus();

  // Student join (no name input now — uses account name)
  on('btn-enter', doJoin);

  // Leave
  on('btn-leave',()=>{ if(confirm('Leave the session?')) send({type:'leave'}); });

  // Resource browser / upload panel
  on('btn-browse', browseRepo);

  // Folder cards — single tap = chapter overlay only (editing moved to /editor page)
  document.querySelectorAll('.folder-card[data-folder-name]').forEach(el=>{
    const name=el.dataset.folderName;
    el.addEventListener('click', ()=>{ openFolderOverlay(name); });
    el.addEventListener('keydown', e=>{
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openFolderOverlay(name); return; }
      const all=[...document.querySelectorAll('.folder-card[data-folder-name]')];
      const i=all.indexOf(el);
      if(e.key==='ArrowRight'||e.key==='ArrowDown'){ e.preventDefault(); all[(i+1)%all.length]?.focus(); }
      if(e.key==='ArrowLeft'||e.key==='ArrowUp')  { e.preventDefault(); all[(i-1+all.length)%all.length]?.focus(); }
    });
  });

  // + New folder card
  on('btn-new-folder-card', ()=>{
    if(!showNewFolderCard){ showNewFolderCard=true; render(); setTimeout(()=>document.getElementById('new-folder-name')?.focus(),40); }
  });
  on('btn-cancel-new-folder', ()=>{ showNewFolderCard=false; render(); });
  on('btn-create-folder', async ()=>{
    await createFolder();
    showNewFolderCard=false;
    // also refresh subjects list
    browseRepo();
  });

  // Editing has moved to /editor page — no manage overlay bindings needed here

  // Host settings overlay
  on('btn-host-settings', ()=>{ hostSettingsOpen=true; render(); setTimeout(()=>document.getElementById('btn-settings-close')?.focus(),50); });
  on('btn-settings-close', ()=>{ hostSettingsOpen=false; render(); });
  document.getElementById('host-settings-overlay')?.addEventListener('click', e=>{
    if(e.target.id==='host-settings-overlay'){ hostSettingsOpen=false; render(); }
  });

  // Generate tab — folder card: open chapter overlay
  function openFolderOverlay(name){
    folderOverlaySubject=name;
    const subj=subjects.find(s=>s.name===name);
    folderOverlayDraft={};
    if(subj){ subj.files.forEach(f=>{ folderOverlayDraft[f.name]={selected:f.selected,count:f.count||0}; }); }
    if(subj&&!subj.filesLoaded) loadSubjectFiles(name);
    render();
  }
  document.querySelectorAll('[data-folder-open]').forEach(el=>{
    el.addEventListener('click', ()=> openFolderOverlay(el.dataset.folderOpen));
    el.addEventListener('keydown', e=>{
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openFolderOverlay(el.dataset.folderOpen); return; }
      const all=[...document.querySelectorAll('[data-folder-open]')];
      const i=all.indexOf(el);
      if(e.key==='ArrowRight'||e.key==='ArrowDown'){ e.preventDefault(); all[(i+1)%all.length]?.focus(); }
      if(e.key==='ArrowLeft'||e.key==='ArrowUp'){ e.preventDefault(); all[(i-1+all.length)%all.length]?.focus(); }
    });
  });

  // Chapter overlay — cancel
  on('btn-ch-cancel', ()=>{ folderOverlaySubject=null; folderOverlayDraft={}; render(); });

  // Chapter overlay — save (commit draft back to subjects)
  on('btn-ch-save', ()=>{
    const subj=subjects.find(s=>s.name===folderOverlaySubject);
    if(subj){
      document.querySelectorAll('[data-ch-cnt]').forEach(inp=>{
        const fn=inp.dataset.chCnt;
        if(folderOverlayDraft[fn]) folderOverlayDraft[fn].count=Math.max(0,parseInt(inp.value)||0);
      });
      subj.files.forEach(f=>{
        const d=folderOverlayDraft[f.name];
        if(d){ f.selected=d.selected; f.count=d.count; }
      });
    }
    folderOverlaySubject=null; folderOverlayDraft={};
    render();
  });

  // Chapter overlay — clear all (patch in place, no full re-render)
  on('btn-ch-clear', ()=>{
    Object.keys(folderOverlayDraft).forEach(k=>{ folderOverlayDraft[k].selected=false; });
    document.querySelectorAll('[data-ch-toggle]').forEach(el=>{
      el.classList.remove('sel');
      const chk=el.querySelector('.ch-check'); if(chk) chk.innerHTML='';
      const inp=el.querySelector('.ch-count');
      if(inp){ inp.remove(); const sp=document.createElement('span'); sp.style.width='44px'; el.appendChild(sp); }
    });
  });

  // Chapter overlay — backdrop click to cancel
  document.getElementById('ch-overlay-backdrop')?.addEventListener('click', e=>{
    if(e.target.id==='ch-overlay-backdrop'){ folderOverlaySubject=null; folderOverlayDraft={}; render(); }
  });

  // Chapter overlay — toggle chapter row (no full re-render — patch in place to prevent flicker)
  document.querySelectorAll('[data-ch-toggle]').forEach(el=>{
    el.addEventListener('click', e=>{
      if(e.target.tagName==='INPUT') return;
      const fn=el.dataset.chToggle;
      if(!folderOverlayDraft[fn]) folderOverlayDraft[fn]={selected:false,count:0};
      const nowSel=!folderOverlayDraft[fn].selected;
      folderOverlayDraft[fn].selected=nowSel;

      // Patch the row class
      el.classList.toggle('sel', nowSel);

      // Patch the checkbox
      const chk=el.querySelector('.ch-check');
      if(chk) chk.innerHTML=nowSel?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>':'';

      // Patch the count input / spacer
      const existingInput=el.querySelector('.ch-count');
      const existingSpacer=el.querySelector('span[style*="width:44px"]');
      if(nowSel && !existingInput){
        if(existingSpacer) existingSpacer.remove();
        const inp=document.createElement('input');
        inp.className='ch-count'; inp.type='number'; inp.min='0'; inp.max='999';
        inp.value=folderOverlayDraft[fn].count||''; inp.placeholder='all';
        inp.dataset.chCnt=fn; inp.title='0 or blank = all questions';
        inp.onclick=ev=>ev.stopPropagation();
        inp.addEventListener('change',()=>{ folderOverlayDraft[fn].count=Math.max(0,parseInt(inp.value)||0); });
        el.appendChild(inp);
      } else if(!nowSel && existingInput){
        existingInput.remove();
        const sp=document.createElement('span');
        sp.style.width='44px'; el.appendChild(sp);
      }
    });
  });

  // Chapter overlay — count inputs (update draft without re-render)
  document.querySelectorAll('[data-ch-cnt]').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const fn=inp.dataset.chCnt;
      if(!folderOverlayDraft[fn]) folderOverlayDraft[fn]={selected:true,count:0};
      folderOverlayDraft[fn].count=Math.max(0,parseInt(inp.value)||0);
    });
  });

  on('btn-gen', ()=>{
    hostTimerSeconds=Math.max(0,parseInt(document.getElementById('timer-sec-input')?.value)||0);
    generateQuiz();
  });
  on('btn-toggle-random', ()=>{
    hostTimerSeconds=Math.max(0,parseInt(document.getElementById('timer-sec-input')?.value)||0);
    hostRandomize=!hostRandomize;
    render();
  });
  on('btn-reload',()=>{ questions=[]; selIdx=-1; answerKey=-1; subjects=[]; expandedSubject=null; repoPath=null; folderOverlaySubject=null; folderOverlayDraft={}; folderManageSubject=null; showNewFolderCard=false; manageFolder=null; manageFile=null; manageFolderFiles=[]; manageEditMode=null; manageNewFileName=''; editingContent=''; editingSha=null; uploadMsg=''; editorFullscreen=false; haltedTotalLabel=''; reportsOverlayOpen=false; expandedReportRid=null; editingReportRid=null; editReportDraft={}; hostRandomize=false; render(); });

  // Timer input (live)
  document.getElementById('timer-sec-live')?.addEventListener('change',e=>{ hostTimerSeconds=Math.max(0,parseInt(e.target.value)||0); });
  // Host open session — re-authenticate if needed, then open
  on('btn-open-session',()=>{
    if(ws?.readyState===1){
      // Re-send set_host first to ensure server has host role, then open_session
      // This handles edge cases where WS reconnected but role wasn't confirmed
      if(HOST_PASSWORD_INPUT) send({type:'set_host',password:HOST_PASSWORD_INPUT});
      setTimeout(()=>send({type:'open_session'}), HOST_PASSWORD_INPUT?80:0);
      const btn=document.getElementById('btn-open-session');
      if(btn){ btn.textContent='Opening…'; btn.disabled=true; btn.style.opacity='.6'; }
    } else {
      showToast('Not connected to server.\nCheck your connection and try again.','bad');
    }
  });

  // Sidebar toggles
  on('sb-toggle-q',     ()=>{ sidebarQOpen=!sidebarQOpen; render(); });
  on('sb-toggle-stud',  ()=>{ sidebarStudOpen=!sidebarStudOpen; render(); });
  on('sb-toggle-sched', ()=>{ sidebarSchedOpen=!sidebarSchedOpen; render(); });
  on('btn-sched-nav',   ()=>{ sidebarSchedOpen=!sidebarSchedOpen; render(); });
  on('btn-sched-close', ()=>{ sidebarSchedOpen=false; render(); });
  on('btn-standings-open',  ()=>{ showStandingsOverlay=true;  render(); });
  on('btn-standings-close', ()=>{ showStandingsOverlay=false; render(); });

  // Q selection
  document.querySelectorAll('.q-row[data-qi]').forEach(el=>
    el.addEventListener('click',()=>{ if(S.status==='question'||S.status==='revealed') return; selIdx=+el.dataset.qi; answerKey=questions[selIdx]?.correct??-1; render(); })
  );

  // Answer key
  document.querySelectorAll('.key-card[data-key]').forEach(el=>{
    el.addEventListener('click', ()=>{ answerKey=+el.dataset.key; render(); });
    el.addEventListener('keydown', e=>{
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); el.click(); return; }
      const all=[...document.querySelectorAll('.key-card[data-key]')];
      const idx=all.indexOf(el);
      // Arrow keys navigate the 2×2 grid: Right/Down = next, Left/Up = prev
      const delta={'ArrowRight':1,'ArrowDown':2,'ArrowLeft':-1,'ArrowUp':-2};
      if(delta[e.key]!==undefined){
        e.preventDefault();
        const next=all[(idx+delta[e.key]+all.length)%all.length];
        next?.focus();
      }
    });
  });

  // Push question (with debounce to prevent stuck)
  on('btn-push',()=>{
    if(pushing||selIdx<0||answerKey<0) return;
    const t=Math.max(0,parseInt(document.getElementById('timer-sec-live')?.value)||hostTimerSeconds);
    pushing=true;
    send({type:'push_question',question:questions[selIdx],correct:answerKey,timerSeconds:t,totalQuestions:questions.length});
    // Safety: reset push flag after 4s if no state update comes
    pushTimeout=setTimeout(()=>{ pushing=false; pushTimeout=null; render(); },4000);
    render();
  });

  on('btn-reveal',()=>send({type:'reveal'}));
  on('btn-next',  ()=>{ send({type:'clear'}); selIdx=selIdx+1<questions.length?selIdx+1:-1; answerKey=selIdx>=0?(questions[selIdx]?.correct??-1):-1; });
  on('btn-end',   ()=>{ if(confirm('End session and show results?')) send({type:'end_session'}); });
  on('btn-reset', ()=>{ if(confirm('Reset everything?')){ send({type:'reset'}); questions=[]; selIdx=-1; answerKey=-1; inspectPid=null; subjects=[]; repoPath=null; stopMic(); cumulativeAnswerTimes={}; render(); } });
  on('btn-close-inspect',()=>{ inspectPid=null; render(); });

  // Host ended — Continue
  on('btn-continue-session',()=>{ send({type:'continue_session'}); });
  // Halt: show halt menu directly (bomb only plays on Stop & Dismiss)
  on('btn-halt',()=>{ showingHaltMenu=true; render(); });

  // Stop & Dismiss: server builds authoritative final leaderboard from its own gameScores
  // and sends it to every student inside the kicked message
  on('btn-stop-dismiss',()=>{
    showingHaltMenu=false;
    showingHaltBomb=true; render();
    // Play stop.mp3 alongside animation (fuse sound)
    playMp3('stop.mp3');
    // BOOM visual at 1.2s
    setTimeout(()=>{
      const lbl=document.getElementById('bomb-label');
      const bomb=document.getElementById('bomb-emoji');
      if(lbl) lbl.textContent='💥 BOOM!';
      if(bomb){ bomb.style.animation='bombGrow .2s ease-in both'; bomb.style.filter='drop-shadow(0 0 28px #f97316)'; }
      const wrap=document.getElementById('blast-rings-wrap');
      if(wrap){
        [[0,'rgba(251,146,60,.7)',80],[70,'rgba(253,186,116,.5)',120],[150,'rgba(254,215,170,.35)',160]].forEach(([delay,col,size])=>{
          const r=document.createElement('div'); r.className='blast-ring';
          r.style.cssText='width:'+size+'px;height:'+size+'px;margin-left:-'+(size/2)+'px;margin-top:-'+(size/2)+'px;background:'+col+';animation-delay:'+delay+'ms';
          wrap.appendChild(r);
        });
      }
      const panel=document.querySelector('#main-view>div')||document.body;
      panel.style.animation='screenShake .35s ease both';
      setTimeout(()=>{ if(panel) panel.style.animation=''; },370);
    }, 1200);
    if(haltBombTimer){ clearTimeout(haltBombTimer); }
    haltBombTimer=setTimeout(()=>{
      showingHaltBomb=false; haltBombTimer=null;
      // Deduplicate by userId so leave/rejoin after reset doesn't double-count scores
      const gcores=S.gameScores||[], parts=S.participants||[];
      const mergedByKey={}, pidToKey={};
      gcores.forEach(g=>{
        const key=g.userId?'u_'+g.userId:'p_'+g.id;
        if(!mergedByKey[key]) mergedByKey[key]={name:g.name,score:g.total};
        pidToKey[g.id]=key;
      });
      parts.forEach(p=>{
        const key=p.userId?'u_'+p.userId:'p_'+p.id;
        if(mergedByKey[key]){
          // Only add live score for this pid if it's the canonical key (not a stale banked pid)
          if(!pidToKey[p.id]||pidToKey[p.id]===key) mergedByKey[key].score+=(p.score||0);
          mergedByKey[key].name=p.name;
        } else {
          mergedByKey[key]={name:p.name,score:p.score||0};
        }
      });
      const finalList=Object.values(mergedByKey).map(g=>({name:g.name,score:g.score})).sort((a,b)=>b.score-a.score);
      finalList._totalQ=S.pushedCount||0;
      hostShutdownLeaderboard=finalList;
      send({type:'shutdown'}); render();
    }, 2000);
  });

  on('btn-halt-cancel',()=>{
    if(haltBombTimer){ clearTimeout(haltBombTimer); haltBombTimer=null; }
    showingHaltBomb=false; showingHaltMenu=false; render();
  });

  // ── BACKUP RESTORE ────────────────────────────────────────────────────────
  // "Restore Today's Scores" in halt menu → open overlay and load backup list
  on('btn-restore-backup', async ()=>{
    showingHaltMenu=false;
    showingBackupOverlay=true;
    backupOverlayState={ list:[], loading:true, error:null, restoredMsg:null };
    render();
    try {
      const r = await fetch('/api/session-backup', { headers:{ Authorization:'Bearer '+authToken } });
      const d = await r.json();
      if(!r.ok) throw new Error(d.error||'Failed to fetch backup');
      backupOverlayState.loading=false;
      backupOverlayState.list=d.participants||[];
      if(!d.found) backupOverlayState.error='No backup found for today\'s window (5 AM–5 AM IST).';
    } catch(e){
      backupOverlayState.loading=false;
      backupOverlayState.error=e.message||'Failed to load backup.';
    }
    render();
  });

  // "Import & Restore These Scores" — fire the WS restore command
  on('btn-confirm-restore', ()=>{
    backupOverlayState.loading=true;
    backupOverlayState.error=null;
    render();
    send({ type:'restore_backup' });
    // Result comes back via backup_restore_result WS message
  });

  // Close backup overlay
  on('btn-close-backup-overlay', ()=>{
    showingBackupOverlay=false;
    backupOverlayState={ list:[], loading:false, error:null, restoredMsg:null };
    render();
  });

  on('btn-host-lb-close',()=>{ hostShutdownLeaderboard=null; render(); });

  // Export final leaderboard as a CSV file
  on('btn-host-lb-export',()=>{
    const entries = hostShutdownLeaderboard;
    if(!entries||!entries.length){ showToast('No leaderboard data to export.','bad'); return; }
    const totalQ = entries._totalQ || S.pushedCount || 0;
    const dateStr = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}).replace(/ /g,'-');
    const header = 'Rank,Name,Score,Total Questions,Percentage\n';
    const csvRows = entries.map((e,i)=>{
      const pct = totalQ>0 ? ((e.score||0)/totalQ*100).toFixed(1)+'%' : 'N/A';
      return `${i+1},"${(e.name||'').replace(/"/g,'""')}",${e.score||0},${totalQ},${pct}`;
    }).join('\n');
    const csv = header + csvRows;
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `SCC-Session-${dateStr}.csv`;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 500);
    showToast('✅ CSV downloaded!','good');
  });
  on('btn-shutdown',()=>{ if(confirm('Shut down session?')) send({type:'shutdown'}); });

  document.querySelectorAll('.itbl tbody tr[data-pid]').forEach(row=>
    row.addEventListener('click',()=>{ inspectPid=row.dataset.pid; render(); })
  );

  // Mic
  on('btn-mic-start',()=>startMic());
  on('btn-mic-stop', ()=>stopMic());

  // Answer options
  document.querySelectorAll('.opt-card[data-opt]').forEach(el=>
    el.addEventListener('click',()=>{
      if(S.myAnswer!==null&&S.myAnswer!==undefined) return;
      if(S.status==='revealed') return;
      if(el.classList.contains('locked')) return;
      // Record how many seconds since question was pushed — with sub-second precision
      const ms = S.questionPushedAt ? Date.now()-S.questionPushedAt : null;
      const secs = ms!==null ? parseFloat(Math.max(0,ms/1000).toFixed(2)) : null;
      myLastAnswerTime = secs;
      if(secs!==null && myPid) localAnswerTimes[myPid]=secs; // precise click-time for self
      send({type:'answer',idx:+el.dataset.opt, ...(secs!==null?{timeTaken:secs}:{})});
    })
  );

  // ── STUDENT: Report wrong answer button ──────────────────────────────────
  on('btn-report-q', ()=>{
    const q=S.question; if(!q) return;
    if(myReportedQuestions.has(q.text)) return;
    myReportedQuestions.add(q.text);
    send({type:'report_question',question:q,correct:S.correct??null,reportedAnswer:S.myAnswer??null});
    const btn=document.getElementById('btn-report-q');
    if(btn){ btn.disabled=true; btn.innerHTML='&#10003; Reported — thanks!'; btn.style.color='var(--good)'; btn.style.borderColor='var(--good)'; }
  });

  // ── STUDENT: Raise hand button ───────────────────────────────────────────
  on('btn-raise-hand', ()=>{
    send({type:'raise_hand', name:myName||currentUser?.name||'Student'});
    const btn=document.getElementById('btn-raise-hand');
    if(btn){ btn.disabled=true; btn.style.opacity='.5'; setTimeout(()=>{ btn.disabled=false; btn.style.opacity=''; },10000); }
  });

  updateMicDot();

  // Global host keyboard shortcuts — re-attach fresh on every render
  document.removeEventListener('keydown', hostKeyDown);
  if(role==='host'&&hostAuthed) document.addEventListener('keydown', hostKeyDown);

  // ── HOST: Reports overlay ─────────────────────────────────────────────────
  on('btn-reports-open', ()=>{ reportsOverlayOpen=true; render(); });
  on('btn-reports-close',()=>{ reportsOverlayOpen=false; editingReportRid=null; editReportDraft={}; render(); });

  // Expand/collapse individual report card
  document.querySelectorAll('[data-r-expand]').forEach(el=>{
    el.addEventListener('click', e=>{
      if(e.target.closest('[data-r-dismiss]')||e.target.closest('[data-r-edit]')) return;
      const rid=+el.dataset.rExpand;
      if(expandedReportRid===rid){ expandedReportRid=null; editingReportRid=null; editReportDraft={}; }
      else { expandedReportRid=rid; editingReportRid=null; editReportDraft={}; }
      render();
    });
  });

  // Dismiss report
  document.querySelectorAll('[data-r-dismiss]').forEach(el=>{
    el.addEventListener('click', e=>{
      e.stopPropagation();
      const rid=+el.dataset.rDismiss;
      send({type:'dismiss_report', rid});
      if(expandedReportRid===rid){ expandedReportRid=null; editingReportRid=null; editReportDraft={}; }
    });
  });

  // Enter edit mode for a report
  document.querySelectorAll('[data-r-edit]').forEach(el=>{
    el.addEventListener('click', e=>{
      e.stopPropagation();
      const rid=+el.dataset.rEdit;
      const rep=receivedReports.find(r=>r.rid===rid);
      if(!rep) return;
      editingReportRid=rid;
      editReportDraft={
        text: rep.question?.text||'',
        options: (rep.question?.options||[]).slice(),
        correct: rep.correct??0,
        rid,
      };
      render();
      setTimeout(()=>document.getElementById('r-edit-qtext')?.focus(),40);
    });
  });

  // Answer key selection inside report edit
  document.querySelectorAll('[data-r-key]').forEach(el=>{
    el.addEventListener('click', ()=>{
      editReportDraft.correct=+el.dataset.rKey;
      // Patch key cards in-place (no full re-render) for snappy response
      document.querySelectorAll('[data-r-key]').forEach(k=>{
        k.classList.toggle('selected', +k.dataset.rKey===editReportDraft.correct);
      });
    });
  });

  // Cancel edit mode
  on('btn-cancel-report-edit',()=>{ editingReportRid=null; editReportDraft={}; render(); });

  // Save & Fix — write to GitHub and dismiss the report
  on('btn-save-report-edit', async ()=>{
    const msg=document.getElementById('report-edit-msg');
    if(msg){ msg.textContent='Saving…'; msg.style.color='var(--mid)'; }
    // Read live textarea / input values into draft
    const ta=document.getElementById('r-edit-qtext');
    if(ta) editReportDraft.text=ta.value;
    document.querySelectorAll('[data-r-opt]').forEach(inp=>{ editReportDraft.options[+inp.dataset.rOpt]=inp.value; });
    if(!editReportDraft.text?.trim()){ if(msg){msg.textContent='Question text cannot be empty';msg.style.color='var(--bad)';}return; }
    const rep=receivedReports.find(r=>r.rid===editReportDraft.rid);
    if(!rep){ if(msg){msg.textContent='Report not found';msg.style.color='var(--bad)';}return; }
    const result=await updateReportedQuestionInGitHub(
      rep.question,
      editReportDraft.text,
      editReportDraft.options,
      editReportDraft.correct
    );
    if(result.ok){
      // ── Update the live questions array instantly ──────────────────────────
      const fixedQ={
        ...rep.question,
        text: editReportDraft.text.trim(),
        options: editReportDraft.options.slice(),
        correct: editReportDraft.correct,
      };
      // Update in host's local questions array
      const qi=questions.findIndex(q=>q.text===rep.question.text);
      if(qi>=0){
        questions[qi]=fixedQ;
        // If this is the currently selected question, update answerKey too
        if(selIdx===qi) answerKey=editReportDraft.correct;
      }
      // Tell server to update the live state question if it's currently pushed
      send({type:'update_question', question:fixedQ, correct:editReportDraft.correct});
      // Dismiss the report
      send({type:'dismiss_report', rid:rep.rid});
      editingReportRid=null; editReportDraft={}; expandedReportRid=null;
      showToast('✅ Question fixed, saved to GitHub, and pushed live!','good');
      render();
    } else {
      if(msg){ msg.textContent='Error: '+result.error; msg.style.color='var(--bad)'; }
    }
  });
}

function on(id,fn){ document.getElementById(id)?.addEventListener('click',fn); }
// Submit cumulative scores to all-time leaderboard (POST /api/leaderboard)
// Server uses $inc so these totals are ADDED to any existing all-time record.
// All-time leaderboard is now written server-side in persistLeaderboard() on shutdown

function doDismissHome(){
  if(dismissedTimer){clearInterval(dismissedTimer);dismissedTimer=null;}
  showingDismissed=false; showingHalted=false; haltedSnapshot=[]; haltedTotalQuestions=0;
  role=null; myName=null; myPid=null; showingProfile=false; prevMyScore=0; scoreGain=0; myLastAnswerTime=null; localAnswerTimes={}; cumulativeAnswerTimes={}; sessionCorrectTimes=[]; startTimerDisplay._lastStart=null; studentQCount=0; haltedTotalLabel=''; haltedTotalQuestions=0;
  // Wipe all LB caches so scores are fresh the next time the user opens the leaderboard
  todayLB=null; weekLB=null; allTimeLB=null;
  lbFetched={today:null, week:null, all:null};
  lbErrors={today:null, week:null, all:null};
  sessionStorage.removeItem('qz_pid'); sessionStorage.removeItem(NAV_KEY);
  render();
  // Pre-fetch all three tabs in the background ready for when the user opens LB
  fetchLeaderboard();
}
function doLogout(){ clearAuth(); role=null; myPid=null; myName=null; hostAuthed=false; HOST_PASSWORD_INPUT=''; showingProfile=false; prevMyScore=0; scoreGain=0; myLastAnswerTime=null; localAnswerTimes={}; cumulativeAnswerTimes={}; sessionCorrectTimes=[]; startTimerDisplay._lastStart=null; studentQCount=0; todayLB=null; weekLB=null; allTimeLB=null; lbFetched={today:null,week:null,all:null}; lbErrors={today:null,week:null,all:null}; serverSchedules=null; hostSchedules=[]; hostNotice=''; joinRequests=[]; updateRequests=[]; sessionStorage.removeItem(NAV_KEY); sessionStorage.removeItem('scc_hpw'); _screenKey=''; render(); }

/* Shared back navigation */
function doBack(){
  if(showingDismissed){ doDismissHome(); return; }
  if(inspectingUser){ inspectingUser=null; inspectTab='overview'; inspectCache=null; render(); return; }
  if(showingProfile){
    showingProfile=false;
    navPush(); // push a new state so further back press goes home
    render(); return;
  }
  if(role==='host'&&hostAuthed){
    if(!confirm('Leave host panel and go home?')) return;
    role=null; hostAuthed=false; hostShutdownLeaderboard=null; showingHaltBomb=false; if(haltBombTimer){clearTimeout(haltBombTimer);haltBombTimer=null;} HOST_PASSWORD_INPUT=''; sessionStorage.removeItem('scc_hpw'); stopMic();
    navPush(); render(); return;
  }
  if(role==='host'&&!hostAuthed){
    role=null; render(); return;
  }
  if(role==='participant'&&myName){
    if(!confirm('Leave the session and go home?')) return;
    send({type:'leave'}); return;
  }
  role=null; hostAuthed=false; myName=null; myPid=null; showingProfile=false; render();
}
function doHostLogin(){
  const v=document.getElementById('pw-in')?.value?.trim();
  if(!v)return;
  HOST_PASSWORD_INPUT=v;
  sessionStorage.setItem('scc_hpw', v);
  send({type:'set_host',password:v});
}
function doLeave(){ role=null; myName=null; myPid=null; showingProfile=false; prevMyScore=0; scoreGain=0; myLastAnswerTime=null; localAnswerTimes={}; cumulativeAnswerTimes={}; clientStreaks={}; lastFastestPid=null; sessionCorrectTimes=[]; startTimerDisplay._lastStart=null; studentQCount=0; haltedTotalLabel=''; haltedTotalQuestions=0; sessionStorage.removeItem('qz_pid'); sessionStorage.removeItem(NAV_KEY); _screenKey=''; render(); }
function doJoin(){
  const name=currentUser?.name||'';
  if(!name)return;
  myName=name;
  myPid=sessionStorage.getItem('qz_pid');
  send({type:'join',name:myName,pid:myPid,userId:currentUser?.id});
  render();
}

/* ── Live username availability check ──────────────────────────────────── */
let _unCheckTimer=null;
let _unLastChecked='';
function liveCheckUsername(val){
  const status=document.getElementById('un-status');
  const hint=document.getElementById('un-hint');
  if(!status||!hint) return;
  // Clear previous debounce
  if(_unCheckTimer){ clearTimeout(_unCheckTimer); _unCheckTimer=null; }
  if(!val){ status.textContent=''; hint.textContent='Letters, numbers, underscores only'; hint.style.color='var(--mid)'; return; }
  // Validate format first
  if(!/^[a-zA-Z0-9_]+$/.test(val)){
    status.textContent='✗'; status.style.color='var(--bad)';
    hint.textContent='Only letters, numbers and underscores allowed'; hint.style.color='var(--bad)';
    return;
  }
  if(val.length<3){
    status.textContent=''; hint.textContent='At least 3 characters required'; hint.style.color='var(--bad)'; return;
  }
  if(val===_unLastChecked) return; // already checked this exact value
  // Show spinner while waiting
  status.textContent='⏳'; status.style.color='var(--mid)';
  hint.textContent='Checking availability…'; hint.style.color='var(--mid)';
  _unCheckTimer=setTimeout(async()=>{
    _unLastChecked=val;
    try{
      const r=await fetch('/api/check-username?username='+encodeURIComponent(val));
      // If endpoint doesn't exist yet (404 or non-JSON), just reset to neutral — don't show an error
      if(!r.ok){ status.textContent=''; hint.textContent='Letters, numbers, underscores only'; hint.style.color='var(--mid)'; return; }
      const d=await r.json();
      // Only update if input still matches (user may have kept typing)
      const cur=document.getElementById('auth-username')?.value?.trim();
      if(cur!==val) return;
      if(d.available){
        status.textContent='✓'; status.style.color='var(--good)';
        hint.textContent='Username is available!'; hint.style.color='var(--good)';
      } else {
        status.textContent='✗'; status.style.color='var(--bad)';
        hint.textContent='Username is already taken'; hint.style.color='var(--bad)';
      }
    }catch(e){
      // Network error or endpoint missing — silently reset, don't alarm the user
      status.textContent=''; hint.textContent='Letters, numbers, underscores only'; hint.style.color='var(--mid)';
    }
  }, 450); // 450ms debounce
}

async function doLogin(){
  const identifier=document.getElementById('auth-identifier')?.value?.trim();
  const pw=document.getElementById('auth-pw')?.value;
  const err=document.getElementById('auth-err'); if(err)err.textContent='';
  if(!identifier){if(err)err.textContent='Email or username is required';return;}
  try{
    const d=await apiPost('/api/login',{identifier,password:pw});
    saveAuth(d.token,d.user); render(); connect();
  }catch(e){ if(err)err.textContent=e.message; }
}
async function doRegister(){
  const name=document.getElementById('auth-name')?.value?.trim();
  const email=document.getElementById('auth-email')?.value?.trim();
  const username=document.getElementById('auth-username')?.value?.trim()||'';
  const pw=document.getElementById('auth-pw')?.value;
  const err=document.getElementById('auth-err'); if(err)err.textContent='';
  if(!name){if(err)err.textContent='Full name is required';return;}
  if(!email){if(err)err.textContent='Email is required';return;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){if(err)err.textContent='Enter a valid email address';return;}
  if(username){
    if(!/^[a-zA-Z0-9_]+$/.test(username)){if(err)err.textContent='Username may only contain letters, numbers and underscores';return;}
    if(username.length<3){if(err)err.textContent='Username must be at least 3 characters';return;}
    const unHint=document.getElementById('un-hint');
    if(unHint&&unHint.textContent==='Username is already taken'){if(err)err.textContent='That username is already taken — please choose another';return;}
  }
  try{
    const d=await apiPost('/api/register',{name,email,username:username||undefined,password:pw});
    if(d.pending){
      // Show pending message — do NOT log in
      if(err){
        err.style.color='var(--good)';
        err.textContent='✅ '+d.message;
      }
      // Clear the form fields
      ['auth-name','auth-email','auth-username','auth-pw'].forEach(id=>{
        const el=document.getElementById(id); if(el) el.value='';
      });
    } else {
      saveAuth(d.token,d.user); render(); connect();
    }
  }catch(e){ if(err){ err.style.color='var(--bad)'; err.textContent=e.message; } }
}

function esc(s){ return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Render LaTeX within $...$ (inline) and $$...$$ (display-block) delimiters.
// Non-math segments are HTML-escaped; math segments are rendered by KaTeX.
function renderMath(str){
  if(!str) return '';
  const out=[];
  // A single formula unit: starts with a letter, has ≥1 sub/superscript group.
  // Each _/^ group can use bare chars OR {braces}, and may be followed by trailing letters
  // (e.g. H_2O — the O after the subscript).
  // Examples matched: Na_2O, H_2SO_4, O^{2-}, H^+, OH^-, CuSO_4, Fe^{3+}
  const UNIT='[A-Za-z][A-Za-z0-9]*(?:[_^](?:\\{[^}]*\\}|[A-Za-z0-9+\\-]+)[A-Za-z0-9]*)+';
  // A \cdot bridge (possibly with a leading coefficient like 5 or 1/2) connecting two units.
  // Examples: \cdot 5H_2O  \cdot 1/2H_2O
  const BRIDGE='(?:\\s*\\\\cdot\\s*[\\d./]*[A-Za-z][A-Za-z0-9]*(?:[_^](?:\\{[^}]*\\}|[A-Za-z0-9+\\-]+)[A-Za-z0-9]*)*)*';
  const re=new RegExp('(\\$\\$[\\s\\S]+?\\$\\$|\\$[^$\\n]+?\\$|'+UNIT+BRIDGE+')','g');
  let last=0, m;
  while((m=re.exec(str))!==null){
    if(m.index>last) out.push(esc(str.slice(last,m.index)));
    const raw=m[0];
    let inner=raw, display=false;
    if(raw.startsWith('$$')){ display=true; inner=raw.slice(2,-2); }
    else if(raw.startsWith('$')){ inner=raw.slice(1,-1); }
    // bare chemistry/math token — pass directly to KaTeX
    try{ out.push(katex.renderToString(inner,{displayMode:display,throwOnError:false,output:'html'})); }
    catch(e){ out.push(esc(raw)); }
    last=m.index+raw.length;
  }
  if(last<str.length) out.push(esc(str.slice(last)));
  return out.join('');
}
