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
