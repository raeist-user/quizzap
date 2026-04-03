/* ══════════════════════════════════════
   SCORE BANNER (student)
══════════════════════════════════════ */

/* ══════════════════════════════════════
   SORT HELPERS
══════════════════════════════════════ */
// Primary: pts descending. Tiebreaker: cumulative answer time ascending (less time = higher rank).
// Players who never answered have Infinity time (go to bottom within same pts band).
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
