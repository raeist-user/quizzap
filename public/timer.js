/* ══════════════════════════════════════
   TIMER
══════════════════════════════════════ */
function startTimerDisplay(){
  const total=S.timerSeconds, start=S.questionPushedAt;
  if(!total||!start||S.status!=='question'){
    if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
    return;
  }
  // Don't restart interval if already running for the same question push time
  if(timerInterval && startTimerDisplay._lastStart===start) return;
  if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
  startTimerDisplay._lastStart=start;
  function tick(){
    const elapsed=Math.max(0,(Date.now()-start)/1000);
    const remaining=Math.max(0, total-elapsed);
    // Cap display value at total so we never show more than the set timer (avoids clock skew showing +1)
    const displaySecs=Math.min(total, Math.ceil(remaining));
    const pct=(remaining/total)*100;
    const urgent=remaining<total*0.25;
    const studentAnswered=(typeof S!=='undefined')&&S.myAnswer!==null&&S.myAnswer!==undefined;
    // Student timer bar
    const bar=document.getElementById('timer-bar');
    const dig=document.getElementById('timer-digits');
    if(bar&&dig){
      bar.style.width=pct+'%';
      if(studentAnswered){ bar.className='timer-bar-fill'; bar.style.background='var(--mid)'; bar.style.opacity='.4'; }
      else{ bar.className='timer-bar-fill'+(urgent?' urgent':''); bar.style.background=''; bar.style.opacity=''; }
      dig.textContent=displaySecs+'s';
      if(studentAnswered){ dig.className='timer-digits'; dig.style.color='var(--mid)'; dig.style.opacity='.5'; }
      else{ dig.className='timer-digits'+(urgent?' urgent':''); dig.style.color=''; dig.style.opacity=''; }
    }
    // Host timer bar (in host controller)
    const hBar=document.getElementById('host-timer-bar');
    const hDig=document.getElementById('host-timer-digits');
    if(hBar&&hDig){
      hBar.style.width=pct+'%';
      hBar.style.background=urgent?'var(--bad)':'var(--accent)';
      hDig.textContent=displaySecs+'s';
      hDig.style.color=urgent?'var(--bad)':'var(--ink)';
    }

    if(remaining<=0){
      clearInterval(timerInterval);timerInterval=null;
      document.querySelectorAll('.opt-card').forEach(c=>c.classList.add('locked'));
    }
  }
  tick(); timerInterval=setInterval(tick,100);
}
