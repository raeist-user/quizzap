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
            '<span style="animation:pulse 1.2s ease-in-out infinite;display:inline-block">🎙️</span>'+
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
