/* ══════════════════════════════════════
   WEBRTC HOST
══════════════════════════════════════ */
async function startMic(){
  try{
    if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;}
    localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    render(); send({type:'get_peers'});
  }catch(e){ alert('Microphone access denied.'); }
}
function stopMic(){
  if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;}
  Object.values(peerConns).forEach(pc=>pc.close());
  Object.keys(peerConns).forEach(k=>delete peerConns[k]);
  render();
}
async function hostCallPeer(cid){
  if(!localStream) return;
  if(peerConns[cid]){peerConns[cid].close();delete peerConns[cid];}
  const pc=new RTCPeerConnection(STUN); peerConns[cid]=pc;
  localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
  pc.onicecandidate=ev=>{ if(ev.candidate) send({type:'rtc_ice_to_peer',toCid:cid,signal:ev.candidate.toJSON()}); };
  pc.onconnectionstatechange=()=>{ if(['failed','closed','disconnected'].includes(pc.connectionState)){pc.close();delete peerConns[cid];} };
  try{ const offer=await pc.createOffer(); await pc.setLocalDescription(offer); send({type:'rtc_offer',toCid:cid,signal:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}}); }catch(e){}
}
async function hostHandleAnswer(cid,sdp){
  const pc=peerConns[cid]; if(!pc||pc.signalingState==='stable') return;
  try{ await pc.setRemoteDescription(new RTCSessionDescription(sdp)); }catch(e){}
}

/* ══════════════════════════════════════
   WEBRTC STUDENT
══════════════════════════════════════ */
async function studentHandleOffer(sdp){
  if(remoteConn){try{remoteConn.close();}catch(e){} remoteConn=null;}
  const pc=new RTCPeerConnection(STUN); remoteConn=pc;
  pc.onicecandidate=ev=>{ if(ev.candidate) send({type:'rtc_ice_to_host',signal:ev.candidate.toJSON()}); };
  pc.ontrack=ev=>{ const a=document.getElementById('remote-audio'); if(a&&a.srcObject!==ev.streams[0]){a.srcObject=ev.streams[0];a.play().catch(()=>{});} updateMicDot(); };
  pc.oniceconnectionstatechange=()=>updateMicDot();
  try{ await pc.setRemoteDescription(new RTCSessionDescription(sdp)); const ans=await pc.createAnswer(); await pc.setLocalDescription(ans); send({type:'rtc_answer',signal:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}}); }catch(e){}
}
function updateMicDot(){ const d=document.getElementById('mic-dot'); if(!d)return; const st=remoteConn?.iceConnectionState; d.className='mic-dot'+(st==='connected'||st==='completed'?' live':st==='failed'?' err':''); }
