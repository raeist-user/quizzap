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
