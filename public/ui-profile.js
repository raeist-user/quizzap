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

  // New Session: server banks current scores then resets to 0
  on('btn-new-session',()=>{
    if(haltBombTimer){ clearTimeout(haltBombTimer); haltBombTimer=null; }
    showingHaltMenu=false; showingHaltBomb=false;
    hostShutdownLeaderboard=null;
    cumulativeAnswerTimes={};
    send({type:'reset'});
    selIdx=questions.length>0?0:-1; answerKey=selIdx>=0?(questions[0]?.correct??-1):-1; inspectPid=null;
    render();
  });

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
  const username=document.getElementById('auth-username')?.value?.trim()||'';
  const pw=document.getElementById('auth-pw')?.value;
  const err=document.getElementById('auth-err'); if(err)err.textContent='';
  if(!name){if(err)err.textContent='Full name is required';return;}
  if(!username){if(err)err.textContent='Username is required';return;}
  if(!/^[a-zA-Z0-9_]+$/.test(username)){if(err)err.textContent='Username may only contain letters, numbers and underscores';return;}
  if(username.length<3){if(err)err.textContent='Username must be at least 3 characters';return;}
  const unHint=document.getElementById('un-hint');
  if(unHint&&unHint.textContent==='Username is already taken'){if(err)err.textContent='That username is already taken — please choose another';return;}
  try{
    const d=await apiPost('/api/register',{name,username,password:pw});
    if(d.pending){
      if(err){
        err.style.color='var(--good)';
        err.textContent='✅ '+d.message;
      }
      ['auth-name','auth-username','auth-pw'].forEach(id=>{
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
