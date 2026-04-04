/* ══════════════════════════════════════
   VOICE — Participant speak-request flow
   Handles: raise-hand → speak request → host allow/dismiss → participant mic → host mutes
══════════════════════════════════════ */

// ── State ──────────────────────────────────────────────────────────────────
let speakRequestPending = false;   // participant waiting for host to allow
let isSpeakingNow      = false;   // participant mic is live
let participantMicStream = null;  // MediaStream from participant mic
let participantPeerConn  = null;  // RTCPeerConnection participant→host

// Host-side: track who is currently speaking (by name + cid)
let activeSpeakerName = null;
let activeSpeakerCid  = null;

// ── PARTICIPANT: request to speak ──────────────────────────────────────────
function requestToSpeak() {
  if (speakRequestPending || isSpeakingNow) return;
  speakRequestPending = true;
  send({ type: 'speak_request' });
  render(); // update button to "pending" state
}

// ── PARTICIPANT: host allowed → start mic & stream to host ─────────────────
async function startParticipantMic() {
  try {
    if (participantMicStream) {
      participantMicStream.getTracks().forEach(t => t.stop());
      participantMicStream = null;
    }
    participantMicStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false
    });
    isSpeakingNow = true;
    speakRequestPending = false;

    // Set up peer connection from participant → host
    if (participantPeerConn) {
      try { participantPeerConn.close(); } catch(e) {}
      participantPeerConn = null;
    }
    const pc = new RTCPeerConnection(STUN);
    participantPeerConn = pc;

    participantMicStream.getTracks().forEach(t => pc.addTrack(t, participantMicStream));

    pc.onicecandidate = ev => {
      if (ev.candidate) send({ type: 'rtc_ice_to_host_from_speaker', signal: ev.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        stopParticipantMic(false);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: 'rtc_speaker_offer', signal: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });

    render();
    showToast('🎙️ You can speak now. Host will mute you when done.', 'good');
  } catch (e) {
    speakRequestPending = false;
    isSpeakingNow = false;
    showToast('❌ Microphone access denied.', 'bad');
    render();
  }
}

// ── PARTICIPANT: stop mic (called by host mute signal or manually) ──────────
function stopParticipantMic(notify = true) {
  if (participantMicStream) {
    participantMicStream.getTracks().forEach(t => t.stop());
    participantMicStream = null;
  }
  if (participantPeerConn) {
    try { participantPeerConn.close(); } catch(e) {}
    participantPeerConn = null;
  }
  isSpeakingNow = false;
  speakRequestPending = false;
  if (notify) showToast('🔇 Host ended your speaking turn.', 'neutral');
  render();
}

// ── PARTICIPANT: handle answer from host for speaker WebRTC ────────────────
async function participantHandleSpeakerAnswer(sdp) {
  const pc = participantPeerConn;
  if (!pc || pc.signalingState === 'stable') return;
  try {
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  } catch(e) {}
}

// ── HOST: handle incoming speaker offer from an allowed participant ──────────
async function hostHandleSpeakerOffer(fromCid, sdp) {
  // Create a new peer connection to receive participant audio
  const pc = new RTCPeerConnection(STUN);

  // Store under a dedicated key so it doesn't collide with host-broadcast peerConns
  peerConns['__speaker__'] = pc;

  pc.onicecandidate = ev => {
    if (ev.candidate) send({ type: 'rtc_ice_to_speaker', toCid: fromCid, signal: ev.candidate.toJSON() });
  };
  pc.ontrack = ev => {
    // Play participant audio on host side
    let el = document.getElementById('speaker-audio');
    if (!el) {
      el = document.createElement('audio');
      el.id = 'speaker-audio';
      el.autoplay = true;
      document.body.appendChild(el);
    }
    if (el.srcObject !== ev.streams[0]) {
      el.srcObject = ev.streams[0];
      el.play().catch(() => {});
    }
    showToast(`🎙️ ${activeSpeakerName || 'Student'} is speaking…`, 'good');
  };
  pc.onconnectionstatechange = () => {
    if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
      hostCleanupSpeaker();
    }
  };

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    send({ type: 'rtc_speaker_answer', toCid: fromCid, signal: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
  } catch(e) {}
}

// ── HOST: mute/end the active speaker ─────────────────────────────────────
function hostMuteSpeaker() {
  if (!activeSpeakerCid) return;
  send({ type: 'speak_end', toCid: activeSpeakerCid });
  hostCleanupSpeaker();
  render();
}

function hostCleanupSpeaker() {
  const pc = peerConns['__speaker__'];
  if (pc) { try { pc.close(); } catch(e) {} delete peerConns['__speaker__']; }
  const el = document.getElementById('speaker-audio');
  if (el) { el.srcObject = null; el.remove(); }
  activeSpeakerName = null;
  activeSpeakerCid  = null;
}

// ── HOST: show speak-request toast with Allow / Dismiss ───────────────────
function showSpeakRequestToast(studentName, fromCid) {
  // Only one speaker at a time — if someone is already speaking, auto-dismiss new requests
  if (activeSpeakerCid) {
    send({ type: 'speak_dismissed', toCid: fromCid });
    showToast(`⚠️ ${studentName} wants to speak but mic is already in use.`, 'neutral');
    return;
  }

  let container = document.getElementById('hand-raise-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'hand-raise-container';
    container.style.cssText = 'position:fixed;top:58px;right:12px;z-index:9998;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:300px;min-width:240px';
    document.body.appendChild(container);
  }

  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;border:1.5px solid #6366f1;border-radius:12px;padding:11px 14px;display:flex;align-items:flex-start;gap:10px;pointer-events:auto;cursor:default;opacity:0;transform:translateX(30px);transition:opacity .22s,transform .22s;position:relative;overflow:hidden';

  const bar = document.createElement('div');
  bar.style.cssText = 'position:absolute;bottom:0;left:0;height:3px;background:#6366f1;width:100%;border-radius:0 0 10px 10px;transition:width 12s linear';

  const inner = document.createElement('div');
  inner.style.cssText = 'display:flex;flex-direction:column;gap:7px;width:100%';
  inner.innerHTML =
    '<div style="display:flex;align-items:flex-start;gap:10px">' +
      '<div style="font-size:1.4rem;flex-shrink:0;line-height:1.1">🎙️</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:.83rem;font-weight:700;color:#3730a3;line-height:1.3">' + esc(studentName) + ' wants to speak</div>' +
        '<div style="font-size:.73rem;color:#6366f1;margin-top:2px">Allow mic access?</div>' +
      '</div>' +
      '<div class="hr-x" style="font-size:.75rem;color:#6366f1;font-weight:600;flex-shrink:0;padding:1px 7px;background:#e0e7ff;border-radius:6px;cursor:pointer;line-height:1.6">&#x2715;</div>' +
    '</div>' +
    '<div style="display:flex;gap:7px;margin-top:2px">' +
      '<button class="hr-allow btn btn-sm" style="flex:1;justify-content:center;background:#4f46e5;color:#fff;border-color:#4f46e5;font-size:.76rem;padding:5px 8px">✓ Allow</button>' +
      '<button class="hr-dismiss btn btn-ghost btn-sm" style="flex:1;justify-content:center;font-size:.76rem;padding:5px 8px">✕ Dismiss</button>' +
    '</div>';

  card.appendChild(bar);
  card.appendChild(inner);
  container.appendChild(card);

  requestAnimationFrame(() => {
    card.style.opacity = '1';
    card.style.transform = 'translateX(0)';
    setTimeout(() => { bar.style.width = '0'; }, 30);
  });

  // Swipe to dismiss
  let startX = 0, dragging = false;
  card.addEventListener('pointerdown', e => { startX = e.clientX; dragging = true; });
  card.addEventListener('pointermove', e => { if (!dragging) return; const dx = e.clientX - startX; if (dx > 10) card.style.transform = 'translateX(' + dx + 'px)'; });
  card.addEventListener('pointerup', e => { dragging = false; if (e.clientX - startX > 60) dismiss(false); else card.style.transform = 'translateX(0)'; });
  card.addEventListener('pointercancel', () => { dragging = false; card.style.transform = 'translateX(0)'; });

  // Auto-dismiss after 12s
  const timer = setTimeout(() => dismiss(false), 12000);

  inner.querySelector('.hr-x').addEventListener('click', () => dismiss(false));

  inner.querySelector('.hr-allow').addEventListener('click', () => {
    clearTimeout(timer);
    activeSpeakerName = studentName;
    activeSpeakerCid  = fromCid;
    send({ type: 'speak_allowed', toCid: fromCid });
    // Show mute button on host UI
    showActiveSpeakerBanner(studentName);
    dismiss(true);
    render();
  });

  inner.querySelector('.hr-dismiss').addEventListener('click', () => {
    send({ type: 'speak_dismissed', toCid: fromCid });
    dismiss(false);
  });

  function dismiss(allowed) {
    clearTimeout(timer);
    card.style.opacity = '0';
    card.style.transform = 'translateX(30px)';
    setTimeout(() => card.remove(), 230);
  }
}

// ── HOST: floating banner showing active speaker + mute button ─────────────
function showActiveSpeakerBanner(name) {
  let el = document.getElementById('active-speaker-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'active-speaker-banner';
    el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9990;background:#4f46e5;color:#fff;border-radius:40px;padding:9px 18px;display:flex;align-items:center;gap:10px;font-size:.84rem;font-weight:600;box-shadow:0 4px 16px rgba(79,70,229,.35);pointer-events:auto;animation:popIn .2s cubic-bezier(.34,1.56,.64,1) both';
    document.body.appendChild(el);
  }
  el.innerHTML =
    '<span style="animation:pulse 1.2s ease-in-out infinite;display:inline-block">🎙️</span>' +
    '<span>' + esc(name) + ' is speaking</span>' +
    '<button id="btn-mute-speaker" style="background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:20px;padding:3px 13px;font-size:.77rem;font-weight:700;cursor:pointer;margin-left:4px">Mute</button>';

  el.querySelector('#btn-mute-speaker').addEventListener('click', () => {
    hostMuteSpeaker();
    el.remove();
  });
}

function removeActiveSpeakerBanner() {
  document.getElementById('active-speaker-banner')?.remove();
}
