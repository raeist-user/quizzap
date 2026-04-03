/* ══════════════════════════════════════
   RENDER
══════════════════════════════════════ */
/* ── Screen key: identifies which logical screen is active.
   Transitions only animate when this changes, preventing flicker
   on frequent same-screen re-renders (WS score updates, timer ticks). ── */
let _screenKey = '';
let _renderPending = false;

function _getScreenKey(){
  if(!currentUser)                    return 'auth';
  if(showingDismissed)                return 'dismissed';
  if(showingHalted)                   return 'halted';
  if(inspectingUser)                  return 'inspect:'+inspectingUser.id+':'+inspectTab;
  if(showingProfile)                  return 'profile:'+profileTab;
  if(!role)                           return 'landing:'+homeSection+(homeSection==='leaderboard'?':'+homeLbTab:'');
  if(role==='host'&&!hostAuthed)      return 'host-pass';
  if(role==='host')                   return 'host:'+S.status;
  if(role==='participant'&&myName)    return 'participant:'+S.status;
  return 'join';
}

function render(){
  saveNavState();
  const nav=document.getElementById('main-nav');
  if(!currentUser){ nav.style.display='none'; _paintView(authHTML()); attach(); return; }

  // Safety: prevent students from accessing host views
  if(role==='host' && currentUser.role!=='host'){ role=null; hostAuthed=false; }

  const isParticipant=(role==='participant'&&myName);
  const isLanding=(!role&&!showingProfile&&!showingHalted);
  nav.style.display=(role==='host'&&hostAuthed)?'none':'flex';
  document.getElementById('nav-back-wrap').style.display=
    (!isParticipant&&(role||showingProfile||showingHalted||inspectingUser))?'block':'none';
  const navBackEl=document.getElementById('btn-nav-back');
  if(navBackEl){
    navBackEl.textContent=inspectingUser?'← Users':showingProfile?'← Home':'← Home';
  }
  document.getElementById('profile-wrap').style.display=isLanding?'flex':'none';
  document.getElementById('ci').style.display=(isParticipant||showingProfile||inspectingUser)?'none':'';
  document.getElementById('conn-lbl').style.display=(isParticipant||showingProfile||inspectingUser)?'none':'';
  document.getElementById('nav-brand').style.cssText=isParticipant?'flex:1;text-align:center;font-size:1rem':'';
  const u=currentUser;
  document.getElementById('p-avatar').textContent=u.name[0].toUpperCase();
  document.getElementById('p-name-lbl').textContent=u.name.split(' ')[0];
  document.getElementById('pd-full-name').textContent=u.name;
  document.getElementById('pd-email').textContent=u.email||(u.username?'@'+u.username:'');

  // Compute which screen we're on
  const key=_getScreenKey();
  const screenChanged=(key!==_screenKey);
  _screenKey=key;

  // Build HTML
  let html='', needTimer=false, needProfile=false, needInspect=false;
  if(showingDismissed)          { html=studentDismissedHTML(); }
  else if(showingHalted)        { html=haltedHTML(); }
  else if(inspectingUser)       { html=inspectProfileHTML(); needInspect=true; }
  else if(showingProfile)       { html=profilePageHTML();
    if(profileTab==='overview'||profileTab==='history') needProfile=true; }
  else if(!role)                { html=landingHTML(); }
  else if(role==='host'&&!hostAuthed){ html=hostPassHTML(); }
  else if(role==='host')        { html=hostHTML(); }
  else                          { html=participantHTML(); }
  if(S.status==='question') needTimer=true;

  if(screenChanged){
    _transitionView(html, ()=>{
      attach();
      if(needTimer) startTimerDisplay();
      if(needProfile) setTimeout(loadProfileData,0);
      if(needInspect) setTimeout(loadInspectData,0);
    });
  } else {
    // Same screen — swap content silently, no animation flash
    const v=document.getElementById('view');
    if(v){ v.innerHTML=html; }
    attach();
    if(needTimer) startTimerDisplay();
    if(needProfile) setTimeout(loadProfileData,0);
    if(needInspect) setTimeout(loadInspectData,0);
  }
}

function _paintView(html){
  const v=document.getElementById('view');
  if(v){ v.className=''; v.innerHTML=html; }
}

let _transitionTimer=null;
function _transitionView(html, afterFn){
  const v=document.getElementById('view');
  if(!v){ _paintView(html); afterFn && afterFn(); return; }
  // Cancel any in-flight transition
  if(_transitionTimer){ clearTimeout(_transitionTimer); _transitionTimer=null; v.className=''; }
  // Fade out
  v.classList.add('v-exit');
  _transitionTimer=setTimeout(()=>{
    v.innerHTML=html;
    v.className='v-enter';
    // afterFn runs right after DOM paint so events are ready
    afterFn && afterFn();
    void v.offsetWidth;
    _transitionTimer=setTimeout(()=>{
      v.className='';
      _transitionTimer=null;
    }, 210);
  }, 140);
}
