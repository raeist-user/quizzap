/* ══════════════════════════════════════
   SOUNDS (Web Audio API)
══════════════════════════════════════ */
let audioCtx=null;
function getAudio(){
  if(!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended') audioCtx.resume();
  return audioCtx;
}
// Unlock AudioContext on first touch/click so sounds work on mobile
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
    this.rot=Math.random()*360;
    this.rotV=(Math.random()-0.5)*8;
    this.shape=Math.random()<0.5?'rect':'circle';
    this.gravity=0.22+Math.random()*0.12;
    this.drag=0.988;
    this.alpha=1;
    this.fadeStart=0;
  }

  Particle.prototype.update=function(elapsed){
    this.vy+=this.gravity;
    this.vx*=this.drag; this.vy*=this.drag;
    this.x+=this.vx; this.y+=this.vy;
    this.rot+=this.rotV;
    if(elapsed>1600) this.alpha=Math.max(0,1-(elapsed-1600)/800);
  };
  Particle.prototype.draw=function(){
    ctx.save();
    ctx.globalAlpha=this.alpha;
    ctx.fillStyle=this.color;
    ctx.translate(this.x,this.y);
    ctx.rotate(this.rot*Math.PI/180);
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
