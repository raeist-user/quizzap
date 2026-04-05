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
      case 'hand_raised': {
        if(role==='host') showHandRaiseToast(m.name);
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

// Hand-raise notification for host — rich card, auto-vanishes in 5s, swipeable
function showHandRaiseToast(studentName){
  let container=document.getElementById('hand-raise-container');
  if(!container){
    container=document.createElement('div');
    container.id='hand-raise-container';
    container.style.cssText='position:fixed;top:58px;right:12px;z-index:9998;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:300px;min-width:240px';
    document.body.appendChild(container);
  }
  const card=document.createElement('div');
  card.style.cssText='background:#fff;border:1.5px solid #fbbf24;border-radius:12px;padding:11px 14px;display:flex;align-items:flex-start;gap:10px;pointer-events:auto;cursor:default;opacity:0;transform:translateX(30px);transition:opacity .22s,transform .22s;position:relative;overflow:hidden';
  const bar=document.createElement('div');
  bar.style.cssText='position:absolute;bottom:0;left:0;height:3px;background:#fbbf24;width:100%;border-radius:0 0 10px 10px;transition:width 5s linear';
  const inner=document.createElement('div');
  inner.style.cssText='display:flex;align-items:flex-start;gap:10px;width:100%';
  inner.innerHTML='<div style="font-size:1.4rem;flex-shrink:0;line-height:1.1">\u270B</div>'
    +'<div style="flex:1;min-width:0"><div style="font-size:.83rem;font-weight:700;color:#92400e;line-height:1.3">'+esc(studentName)+' raised their hand</div>'
    +'<div style="font-size:.73rem;color:#b45309;margin-top:2px">Waiting on WhatsApp for queries</div></div>'
    +'<div class="hr-x" style="font-size:.75rem;color:#d97706;font-weight:600;flex-shrink:0;padding:1px 7px;background:#fef3c7;border-radius:6px;cursor:pointer;line-height:1.6">&#x2715;</div>';
  card.appendChild(bar);
  card.appendChild(inner);
  container.appendChild(card);
  requestAnimationFrame(()=>{
    card.style.opacity='1'; card.style.transform='translateX(0)';
    setTimeout(()=>{ bar.style.width='0'; },30);
  });
  let startX=0, dragging=false;
  card.addEventListener('pointerdown',e=>{ startX=e.clientX; dragging=true; });
  card.addEventListener('pointermove',e=>{ if(!dragging) return; const dx=e.clientX-startX; if(dx>10) card.style.transform='translateX('+dx+'px)'; });
  card.addEventListener('pointerup',e=>{ dragging=false; if(e.clientX-startX>60) dismiss(); else card.style.transform='translateX(0)'; });
  card.addEventListener('pointercancel',()=>{ dragging=false; card.style.transform='translateX(0)'; });
  inner.querySelector('.hr-x').addEventListener('click', dismiss);
  const timer=setTimeout(dismiss, 5000);
  function dismiss(){
    clearTimeout(timer);
    card.style.opacity='0'; card.style.transform='translateX(30px)';
    setTimeout(()=>card.remove(), 230);
  }
}

// Store host password input for reconnection — persisted in sessionStorage to survive refresh
let HOST_PASSWORD_INPUT = sessionStorage.getItem('scc_hpw') || '';
