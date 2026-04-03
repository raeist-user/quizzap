/* ══════════════════════════════════════
   EVENTS
══════════════════════════════════════ */

// Set up outside-click for profile dropdown once at boot
let _outsideClickReady=false;
function setupOutsideClick(){
  if(_outsideClickReady) return;
  _outsideClickReady=true;
  // Profile button toggle — attached once here, not in attach(), so it never stacks
  document.addEventListener('click', e=>{
    const wrap=document.getElementById('profile-wrap');
    const btn=document.getElementById('profile-btn');
    if(!wrap) return;
    if(btn&&btn.contains(e.target)){
      // Toggle dropdown
      document.getElementById('p-dropdown')?.classList.toggle('hidden');
      e.stopPropagation();
      return;
    }
    // Click outside — close
    if(!wrap.contains(e.target)) document.getElementById('p-dropdown')?.classList.add('hidden');
  });
  document.addEventListener('touchstart', e=>{
    const wrap=document.getElementById('profile-wrap');
    if(wrap&&!wrap.contains(e.target)) document.getElementById('p-dropdown')?.classList.add('hidden');
  },{passive:true});
}
