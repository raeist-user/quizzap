/* ══════════════════════════════════════
   FUNCTION.JS
   Parser · Sounds · Timer · Voice (Speak-Request Flow)
══════════════════════════════════════ */

/* ══════════════════════════════════════
   PARSER
══════════════════════════════════════ */
function urduCls(q){ return q?.subject?.toLowerCase()==='urdu'?' urdu':''; }

function parseQuestions(text){
  const out=[],lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
  for(let i=0;i<lines.length;i++){
    const qLine=lines[i],oLine=lines[i+1]||'';
    const m=oLine.match(/\(A\)([^,(]+)[,，]\s*\(B\)([^,(]+)[,，]\s*\(C\)([^,(]+)[,，]\s*\(D\)([^,(]+)/i);
    if(m){
      const rawOpts=[m[1],m[2],m[3],m[4]];
      let preCorrect=-1;
      const cleanOpts=rawOpts.map((o,idx)=>{
        if(o.includes('@')){ preCorrect=idx; return o.replace(/@/g,'').trim(); }
        return o.trim();
      });
      const entry={text:qLine.replace(/^\d+[.)]\s*/,'').trim(),options:cleanOpts};
      if(preCorrect>=0) entry.correct=preCorrect;
      out.push(entry);
      i++;
    }
  }
  return out;
}

/* ══════════════════════════════════════
   SOUNDS (Web Audio API)
══════════════════════════════════════ */
let audioCtx=null;
function getAudio(){
  if(!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended') audioCtx.resume();
  return audioCtx;
}
(function(){
  const unlock=()=>{ try{ getAudio(); }catch(e){} document.removeEventListener('click',unlock); document.removeEventListener('touchend',unlock); };
  document.addEventListener('click',unlock,{once:true});
  document.addEventListener('touchend',unlock,{once:true,passive:true});
})();

const SOUND_BASE='https://raw.githubusercontent.com/raeist-user/quizzap/main/Utility/Sounds/';
function playMp3(name){
  try{ const a=new Audio(SOUND_BASE+name); a.volume=1; a.play().catch(()=>{}); }catch(e){}
}
function playClick(){
  try{
    const a=getAudio(),o=a.createOscillator(),g=a.createGain();
    o.connect(g);g.connect(a.destination);
    o.frequency.value=900;o.type='sine';
    g.gain.setValueAtTime(.15,a.currentTime);
    g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.08);
    o.start();o.stop(a.currentTime+.08);
  }catch(e){}
}
function playCorrect(){
  try{
    const a=getAudio(); const t=a.currentTime;
    [523,659,784,1047].forEach((f,i)=>{
      const o=a.createOscillator(),g=a.createGain();
      o.connect(g);g.connect(a.destination);
      o.frequency.value=f;o.type='sine';
      const s=t+i*.13;
      g.gain.setValueAtTime(0,s);
      g.gain.linearRampToValueAtTime(.25,s+.05);
      g.gain.exponentialRampToValueAtTime(.001,s+.35);
      o.start(s);o.stop(s+.35);
    });
  }catch(e){}
}
function playWrong(){
  try{
    const a=getAudio(),o=a.createOscillator(),g=a.createGain();
    o.connect(g);g.connect(a.destination);
    o.type='sawtooth';o.frequency.value=160;
    g.gain.setValueAtTime(.2,a.currentTime);
    g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.5);
    o.start();o.stop(a.currentTime+.5);
  }catch(e){}
}
function playStreakSound(streak){
  try{
    const a=getAudio();
    if(a.state==='suspended') a.resume().then(()=>_doStreakTones(a,streak)).catch(()=>{});
    else _doStreakTones(a,streak);
  }catch(e){}
}
function _doStreakTones(a,streak){
  try{
    const t=a.currentTime;
    const baseFreqs=streak>=10?[784,1047,1319,1568]:streak>=8?[659,880,1047,1319]:streak>=5?[523,659,784,1047]:[440,523,659];
    const vol=streak>=8?.28:.22;
    baseFreqs.forEach((f,i)=>{
      const o=a.createOscillator(),g=a.createGain();
      o.connect(g);g.connect(a.destination);
      o.type='triangle';o.frequency.value=f;
      const s=t+i*.12;
      g.gain.setValueAtTime(0,s);
      g.gain.linearRampToValueAtTime(vol,s+.05);
      g.gain.exponentialRampToValueAtTime(.001,s+.45);
      o.start(s);o.stop(s+.5);
    });
  }catch(e){}
}

/* ══════════════════════════════════════
   CONFETTI ENGINE
══════════════════════════════════════ */
(function(){
  const COLORS=['#f87171','#fbbf24','#34d399','#60a5fa','#a78bfa','#f472b6','#fb923c'];
  let particles=[], raf=null, canvas, ctx;
  function init(){
    canvas=document.getElementById('confetti-canvas');
    if(!canvas) return false;
    ctx=canvas.getContext('2d');
    canvas.width=window.innerWidth; canvas.height=window.innerHeight;
    window.addEventListener('resize',()=>{if(canvas){canvas.width=window.innerWidth;canvas.height=window.innerHeight;}});
    return true;
  }
  function Particle(x,y,power){
    this.x=x; this.y=y;
    this.vx=(Math.random()-0.5)*power*2.4;
    this.vy=-(Math.random()*power*2.2+power*0.8);
    this.r=Math.random()*5+3;
    this.color=COLORS[Math.floor(Math.random()*COLORS.length)];
    this.rot=Math.random()*360; this.rotV=(Math.random()-0.5)*8;
    this.shape=Math.random()<0.5?'rect':'circle';
    this.gravity=0.22+Math.random()*0.12; this.drag=0.988; this.alpha=1; this.fadeStart=0;
  }
  Particle.prototype.update=function(elapsed){
    this.vy+=this.gravity; this.vx*=this.drag; this.vy*=this.drag;
    this.x+=this.vx; this.y+=this.vy; this.rot+=this.rotV;
    if(elapsed>1600) this.alpha=Math.max(0,1-(elapsed-1600)/800);
  };
  Particle.prototype.draw=function(){
    ctx.save(); ctx.globalAlpha=this.alpha; ctx.fillStyle=this.color;
    ctx.translate(this.x,this.y); ctx.rotate(this.rot*Math.PI/180);
    if(this.shape==='circle'){ ctx.beginPath(); ctx.arc(0,0,this.r,0,Math.PI*2); ctx.fill(); }
    else { ctx.fillRect(-this.r,-this.r/2,this.r*2,this.r); }
    ctx.restore();
  };
  function loop(start){
    const elapsed=performance.now()-start;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p=>{ p.update(elapsed); p.draw(); });
    particles=particles.filter(p=>p.alpha>0.01&&p.y<canvas.height+40);
    if(particles.length) raf=requestAnimationFrame(()=>loop(start));
    else{ ctx.clearRect(0,0,canvas.width,canvas.height); raf=null; }
  }
  window.launchConfetti=function(opts={}){
    if(!canvas&&!init()) return;
    if(raf){ cancelAnimationFrame(raf); raf=null; }
    const cx=opts.x??canvas.width/2, cy=opts.y??canvas.height*0.38;
    const count=opts.count??120, power=opts.power??9;
    for(let i=0;i<count;i++) particles.push(new Particle(cx+(Math.random()-0.5)*40,cy,power));
    raf=requestAnimationFrame(()=>loop(performance.now()));
  };
  window.launchConfettiSmall=function(x,y){
    if(!canvas&&!init()) return;
    const count=28, power=5;
    for(let i=0;i<count;i++) particles.push(new Particle(x,y,power));
    if(!raf) raf=requestAnimationFrame(()=>loop(performance.now()));
  };
})();

/* ══════════════════════════════════════
   TIMER
══════════════════════════════════════ */
function startTimerDisplay(){
  const total=S.timerSeconds, start=S.questionPushedAt;
  if(!total||!start||S.status!=='question'){
    if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
    return;
  }
  if(timerInterval && startTimerDisplay._lastStart===start) return;
  if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
  startTimerDisplay._lastStart=start;
  function tick(){
    const elapsed=Math.max(0,(Date.now()-start)/1000);
    const remaining=Math.max(0, total-elapsed);
    const displaySecs=Math.min(total, Math.ceil(remaining));
    const pct=(remaining/total)*100;
    const urgent=remaining<total*0.25;
    const studentAnswered=(typeof S!=='undefined')&&S.myAnswer!==null&&S.myAnswer!==undefined;
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

/* ══════════════════════════════════════
   VOICE — Participant speak-request flow
   raise-hand → speak_request → host Allow/Dismiss → mic → host mutes
══════════════════════════════════════ */
let speakRequestPending = false;
let isSpeakingNow       = false;
let participantMicStream = null;
let participantPeerConn  = null;
let activeSpeakerName   = null;
let activeSpeakerCid    = null;

function requestToSpeak(){
  if(speakRequestPending||isSpeakingNow) return;
  speakRequestPending=true;
  send({type:'speak_request'});
  render();
}

async function startParticipantMic(){
  try{
    if(participantMicStream){ participantMicStream.getTracks().forEach(t=>t.stop()); participantMicStream=null; }
    participantMicStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    isSpeakingNow=true; speakRequestPending=false;
    if(participantPeerConn){ try{participantPeerConn.close();}catch(e){} participantPeerConn=null; }
    const pc=new RTCPeerConnection(STUN); participantPeerConn=pc;
    participantMicStream.getTracks().forEach(t=>pc.addTrack(t,participantMicStream));
    pc.onicecandidate=ev=>{ if(ev.candidate) send({type:'rtc_ice_to_host_from_speaker',signal:ev.candidate.toJSON()}); };
    pc.onconnectionstatechange=()=>{ if(['failed','closed','disconnected'].includes(pc.connectionState)) stopParticipantMic(false); };
    const offer=await pc.createOffer(); await pc.setLocalDescription(offer);
    send({type:'rtc_speaker_offer',signal:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}});
    render(); showToast('🎙️ You can speak now. Host will mute you when done.','good');
  }catch(e){
    speakRequestPending=false; isSpeakingNow=false;
    showToast('❌ Microphone access denied.','bad'); render();
  }
}

function stopParticipantMic(notify=true){
  if(participantMicStream){ participantMicStream.getTracks().forEach(t=>t.stop()); participantMicStream=null; }
  if(participantPeerConn){ try{participantPeerConn.close();}catch(e){} participantPeerConn=null; }
  isSpeakingNow=false; speakRequestPending=false;
  if(notify) showToast('🔇 Host ended your speaking turn.','neutral');
  render();
}

async function participantHandleSpeakerAnswer(sdp){
  const pc=participantPeerConn; if(!pc||pc.signalingState==='stable') return;
  try{ await pc.setRemoteDescription(new RTCSessionDescription(sdp)); }catch(e){}
}

async function hostHandleSpeakerOffer(fromCid,sdp){
  const pc=new RTCPeerConnection(STUN); peerConns['__speaker__']=pc;
  pc.onicecandidate=ev=>{ if(ev.candidate) send({type:'rtc_ice_to_speaker',toCid:fromCid,signal:ev.candidate.toJSON()}); };
  pc.ontrack=ev=>{
    let el=document.getElementById('speaker-audio');
    if(!el){ el=document.createElement('audio'); el.id='speaker-audio'; el.autoplay=true; document.body.appendChild(el); }
    if(el.srcObject!==ev.streams[0]){ el.srcObject=ev.streams[0]; el.play().catch(()=>{}); }
    showToast(`🎙️ ${activeSpeakerName||'Student'} is speaking…`,'good');
  };
  pc.onconnectionstatechange=()=>{ if(['failed','closed','disconnected'].includes(pc.connectionState)) hostCleanupSpeaker(); };
  try{
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer=await pc.createAnswer(); await pc.setLocalDescription(answer);
    send({type:'rtc_speaker_answer',toCid:fromCid,signal:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}});
  }catch(e){}
}

function hostMuteSpeaker(){
  if(!activeSpeakerCid) return;
  send({type:'speak_end',toCid:activeSpeakerCid});
  hostCleanupSpeaker(); render();
}
function hostCleanupSpeaker(){
  const pc=peerConns['__speaker__'];
  if(pc){ try{pc.close();}catch(e){} delete peerConns['__speaker__']; }
  const el=document.getElementById('speaker-audio');
  if(el){ el.srcObject=null; el.remove(); }
  activeSpeakerName=null; activeSpeakerCid=null;
}

function showSpeakRequestToast(studentName,fromCid){
  if(activeSpeakerCid){
    send({type:'speak_dismissed',toCid:fromCid});
    showToast(`⚠️ ${studentName} wants to speak but mic is already in use.`,'neutral');
    return;
  }
  let container=document.getElementById('hand-raise-container');
  if(!container){
    container=document.createElement('div');
    container.id='hand-raise-container';
    container.style.cssText='position:fixed;top:58px;right:12px;z-index:9998;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:300px;min-width:240px';
    document.body.appendChild(container);
  }
  const card=document.createElement('div');
  card.style.cssText='background:#fff;border:1.5px solid #6366f1;border-radius:12px;padding:11px 14px;display:flex;align-items:flex-start;gap:10px;pointer-events:auto;cursor:default;opacity:0;transform:translateX(30px);transition:opacity .22s,transform .22s;position:relative;overflow:hidden';
  const bar=document.createElement('div');
  bar.style.cssText='position:absolute;bottom:0;left:0;height:3px;background:#6366f1;width:100%;border-radius:0 0 10px 10px;transition:width 12s linear';
  const inner=document.createElement('div');
  inner.style.cssText='display:flex;flex-direction:column;gap:7px;width:100%';
  inner.innerHTML='<div style="display:flex;align-items:flex-start;gap:10px">'+
    '<div style="font-size:1.4rem;flex-shrink:0;line-height:1.1">🎙️</div>'+
    '<div style="flex:1;min-width:0">'+
      '<div style="font-size:.83rem;font-weight:700;color:#3730a3;line-height:1.3">'+esc(studentName)+' wants to speak</div>'+
      '<div style="font-size:.73rem;color:#6366f1;margin-top:2px">Allow mic access?</div>'+
    '</div>'+
    '<div class="hr-x" style="font-size:.75rem;color:#6366f1;font-weight:600;flex-shrink:0;padding:1px 7px;background:#e0e7ff;border-radius:6px;cursor:pointer;line-height:1.6">&#x2715;</div>'+
  '</div>'+
  '<div style="display:flex;gap:7px;margin-top:2px">'+
    '<button class="hr-allow btn btn-sm" style="flex:1;justify-content:center;background:#4f46e5;color:#fff;border-color:#4f46e5;font-size:.76rem;padding:5px 8px">✓ Allow</button>'+
    '<button class="hr-dismiss btn btn-ghost btn-sm" style="flex:1;justify-content:center;font-size:.76rem;padding:5px 8px">✕ Dismiss</button>'+
  '</div>';
  card.appendChild(bar); card.appendChild(inner); container.appendChild(card);
  requestAnimationFrame(()=>{ card.style.opacity='1'; card.style.transform='translateX(0)'; setTimeout(()=>{ bar.style.width='0'; },30); });
  let startX=0,dragging=false;
  card.addEventListener('pointerdown',e=>{ startX=e.clientX; dragging=true; });
  card.addEventListener('pointermove',e=>{ if(!dragging) return; const dx=e.clientX-startX; if(dx>10) card.style.transform='translateX('+dx+'px)'; });
  card.addEventListener('pointerup',e=>{ dragging=false; if(e.clientX-startX>60) dismiss(false); else card.style.transform='translateX(0)'; });
  card.addEventListener('pointercancel',()=>{ dragging=false; card.style.transform='translateX(0)'; });
  const timer=setTimeout(()=>dismiss(false),12000);
  inner.querySelector('.hr-x').addEventListener('click',()=>dismiss(false));
  inner.querySelector('.hr-allow').addEventListener('click',()=>{
    clearTimeout(timer); activeSpeakerName=studentName; activeSpeakerCid=fromCid;
    send({type:'speak_allowed',toCid:fromCid});
    showActiveSpeakerBanner(studentName); dismiss(true); render();
  });
  inner.querySelector('.hr-dismiss').addEventListener('click',()=>{ send({type:'speak_dismissed',toCid:fromCid}); dismiss(false); });
  function dismiss(){ clearTimeout(timer); card.style.opacity='0'; card.style.transform='translateX(30px)'; setTimeout(()=>card.remove(),230); }
}

function showActiveSpeakerBanner(name){
  let el=document.getElementById('active-speaker-banner');
  if(!el){
    el=document.createElement('div'); el.id='active-speaker-banner';
    el.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9990;background:#4f46e5;color:#fff;border-radius:40px;padding:9px 18px;display:flex;align-items:center;gap:10px;font-size:.84rem;font-weight:600;box-shadow:0 4px 16px rgba(79,70,229,.35);pointer-events:auto;animation:popIn .2s cubic-bezier(.34,1.56,.64,1) both';
    document.body.appendChild(el);
  }
  el.innerHTML='<span style="animation:pulse 1.2s ease-in-out infinite;display:inline-block">🎙️</span>'+
    '<span>'+esc(name)+' is speaking</span>'+
    '<button id="btn-mute-speaker" style="background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:20px;padding:3px 13px;font-size:.77rem;font-weight:700;cursor:pointer;margin-left:4px">Mute</button>';
  el.querySelector('#btn-mute-speaker').addEventListener('click',()=>{ hostMuteSpeaker(); el.remove(); });
}
function removeActiveSpeakerBanner(){ document.getElementById('active-speaker-banner')?.remove(); }
