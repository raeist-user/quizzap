/* ══════════════════════════════════════════════════════════════════════════
   #chatbox — Discord-style general chat on the home screen.
   The chat lives in ONE persistent DOM element. render() rebuilds the whole
   view often (live-quiz state, etc.), so chatPreRender()/chatMount() save and
   restore scroll position, focus and half-typed text around every render.
══════════════════════════════════════════════════════════════════════════ */
const CHAT = {
  msgs: [], pinned: [], online: [], hasMore: false, loaded: false, loadingMore: false,
  ws: null, retry: 0, retryTimer: null, tokenUsed: null,
  el: null, scrollTop: 0, stick: true,
  editingId: null, editDraft: '', pickerFor: null, actionsFor: null, popup: null,
  emojis: ['👍','👎','👋','👏','🙌','🙏','🤝','💪','✌️','👌','🤞','☝️'],
  wantFocus: false, selStart: 0, selEnd: 0, draft: '',
};
const CHAT_MAX = 1000;

function cbEsc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function cbLinkify(escaped){
  return escaped.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}
function cbTime(d){ return new Date(d).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}); }
function cbDay(d){
  const x=new Date(d), t=new Date(), y=new Date(); y.setDate(t.getDate()-1);
  const same=(a,b)=>a.toDateString()===b.toDateString();
  if(same(x,t)) return 'Today';
  if(same(x,y)) return 'Yesterday';
  return x.toLocaleDateString([], {day:'numeric',month:'short',year:'numeric'});
}
const cbIsHost = () => currentUser?.role === 'host';
const cbMe     = () => String(currentUser?.id || '');
const cbCoarse = () => window.matchMedia && matchMedia('(pointer:coarse)').matches;

async function cbApi(method, path, body){
  const r = await fetch(path, {
    method,
    headers: Object.assign({'Authorization':'Bearer '+authToken}, body?{'Content-Type':'application/json'}:{}),
    body: body ? JSON.stringify(body) : undefined,
  });
  let d = {}; try{ d = await r.json(); }catch(e){}
  if(!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}

/* ── connection ─────────────────────────────────────────────────────────── */
function chatEnsure(){
  if(!currentUser || !authToken) return;
  if(CHAT.tokenUsed && CHAT.tokenUsed !== authToken) chatReset();   // different account signed in
  if(!CHAT.loaded && !CHAT.loadingInit) chatLoadHistory();
  if(!CHAT.ws || CHAT.ws.readyState > 1) chatConnect();
}
async function chatLoadHistory(){
  CHAT.loadingInit = true;
  try{
    const d = await cbApi('GET','/api/chat/messages');
    CHAT.msgs = d.messages || []; CHAT.hasMore = !!d.hasMore;
    CHAT.pinned = d.pinned || [];
    if(d.online) CHAT.online = d.online;
    if(d.reactions?.length) CHAT.emojis = d.reactions;
    CHAT.loaded = true; CHAT.error = ''; CHAT.stick = true;
  }catch(e){ CHAT.error = e.message; }
  CHAT.loadingInit = false;
  chatPaint(true);
}
function chatConnect(){
  clearTimeout(CHAT.retryTimer);
  CHAT.tokenUsed = authToken;
  const url = `${location.protocol==='https:'?'wss':'ws'}://${location.host}/chat?token=${encodeURIComponent(authToken)}`;
  let ws; try{ ws = new WebSocket(url); }catch(e){ return; }
  CHAT.ws = ws;
  ws.onopen = () => {
    const wasRetry = CHAT.retry > 0;
    CHAT.retry = 0;
    if(wasRetry && CHAT.loaded) chatLoadHistory();      // catch up on anything missed while offline
  };
  ws.onmessage = e => { let m; try{ m = JSON.parse(e.data); }catch(_){ return; } chatOnEvent(m); };
  ws.onclose = ev => {
    if(CHAT.ws !== ws) return;
    CHAT.ws = null;
    if(!authToken || ev.code === 4001) return;
    CHAT.retry++;
    CHAT.retryTimer = setTimeout(chatEnsure, Math.min(1000 * 2 ** CHAT.retry, 15000));
  };
}
function chatReset(){
  clearTimeout(CHAT.retryTimer);
  const ws = CHAT.ws; CHAT.ws = null; try{ ws?.close(); }catch(e){}
  Object.assign(CHAT, {msgs:[],pinned:[],online:[],hasMore:false,loaded:false,loadingInit:false,retry:0,tokenUsed:null,
    editingId:null,editDraft:'',pickerFor:null,actionsFor:null,popup:null,draft:'',stick:true,error:''});
  CHAT.el = null;     // rebuilt fresh for the next user
}

function chatOnEvent(m){
  switch(m.type){
    case 'presence': CHAT.online = m.users || []; chatPaintHeader(); chatPaintPopup(); break;
    case 'msg_new':
      if(!CHAT.msgs.some(x=>x.id===m.message.id)) CHAT.msgs.push(m.message);
      chatPaintList(); break;
    case 'msg_edit': chatReplace(m.message); break;
    case 'msg_react': {
      const x = CHAT.msgs.find(q=>q.id===m.id); if(x) x.reactions = m.reactions;
      const p = CHAT.pinned.find(q=>q.id===m.id); if(p) p.reactions = m.reactions;
      chatPaintList(); break; }
    case 'msg_delete':
      CHAT.msgs = CHAT.msgs.filter(x=>x.id!==m.id);
      CHAT.pinned = CHAT.pinned.filter(x=>x.id!==m.id);
      if(CHAT.editingId===m.id) CHAT.editingId=null;
      chatPaintList(); chatPaintHeader(); chatPaintPopup(); break;
    case 'msg_pin': chatReplace(m.message); break;
  }
}
function chatReplace(msg){
  const i = CHAT.msgs.findIndex(x=>x.id===msg.id);
  if(i>=0) CHAT.msgs[i] = msg;
  CHAT.pinned = CHAT.pinned.filter(x=>x.id!==msg.id);
  if(msg.pinned) CHAT.pinned.unshift(msg);
  chatPaintList(); chatPaintHeader(); chatPaintPopup();
}

/* ── render hooks (called from render()) ────────────────────────────────── */
function chatPreRender(){
  const el = CHAT.el; if(!el || !el.isConnected) return;
  const ta = el.querySelector('.cb-input');
  CHAT.wantFocus = !!ta && document.activeElement === ta;
  if(ta){ CHAT.selStart = ta.selectionStart; CHAT.selEnd = ta.selectionEnd; }
  const list = el.querySelector('.cb-list'); if(list) CHAT.scrollTop = list.scrollTop;
}
function chatMount(){
  chatEnsure();                                   // stay connected (and "online") on every screen once signed in
  const slot = document.getElementById('chatbox-slot');
  if(!slot) return;
  if(!CHAT.el) chatBuild();
  if(CHAT.el.parentNode !== slot) slot.appendChild(CHAT.el);
  const list = CHAT.el.querySelector('.cb-list');
  if(list){ if(CHAT.stick) list.scrollTop = list.scrollHeight; else list.scrollTop = CHAT.scrollTop; }
  const ta = CHAT.el.querySelector('.cb-input');
  if(ta && CHAT.wantFocus){ ta.focus({preventScroll:true}); try{ ta.setSelectionRange(CHAT.selStart, CHAT.selEnd); }catch(e){} }
}

/* ── DOM ────────────────────────────────────────────────────────────────── */
const CB_ICON = {
  pin:  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 3h6l-1 7 3 3v2H7v-2l3-3z"/></svg>',
  users:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  send: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  smile:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  trash:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
  down: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
};

function chatBuild(){
  const el = document.createElement('div');
  el.className = 'cb';
  el.innerHTML = `
    <div class="cb-head">
      <div class="cb-title"><span class="cb-hash">#</span>chatbox</div>
      <div class="cb-head-btns">
        <button class="cb-hbtn" data-act="pins" title="Pinned messages" aria-label="Pinned messages">${CB_ICON.pin}<span class="cb-count" data-role="pin-count"></span></button>
        <button class="cb-hbtn" data-act="members" title="Online members" aria-label="Online members">${CB_ICON.users}<span class="cb-count cb-count-online" data-role="online-count"></span></button>
      </div>
    </div>
    <div class="cb-body">
      <div class="cb-list"></div>
      <button class="cb-jump" data-act="jump" style="display:none">${CB_ICON.down} Jump to latest</button>
      <div class="cb-pop-wrap" style="display:none"></div>
    </div>
    <div class="cb-composer">
      <div class="cb-box">
        <textarea class="cb-input" rows="1" maxlength="${CHAT_MAX}" placeholder="Message #chatbox" enterkeyhint="send"></textarea>
        <span class="cb-limit"></span>
        <button class="cb-send" data-act="send" title="Send" aria-label="Send" disabled>${CB_ICON.send}</button>
      </div>
    </div>`;
  CHAT.el = el;

  const list = el.querySelector('.cb-list');
  list.addEventListener('scroll', () => {
    CHAT.scrollTop = list.scrollTop;
    CHAT.stick = list.scrollHeight - list.scrollTop - list.clientHeight < 70;
    el.querySelector('.cb-jump').style.display = CHAT.stick ? 'none' : 'flex';
  });

  const ta = el.querySelector('.cb-input');
  const sync = () => {
    CHAT.draft = ta.value;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';      // grows with long messages, like Discord
    el.querySelector('.cb-send').disabled = !ta.value.trim();
    const lim = el.querySelector('.cb-limit');
    lim.textContent = ta.value.length > CHAT_MAX - 200 ? `${ta.value.length}/${CHAT_MAX}` : '';
  };
  ta.addEventListener('input', sync);
  ta.addEventListener('keydown', e => {
    // Desktop: Enter sends, Shift+Enter = new line. Phones: Enter = new line, use the send button.
    if(e.key==='Enter' && !e.shiftKey && !e.isComposing && !cbCoarse()){ e.preventDefault(); chatSend(); }
  });
  ta.value = CHAT.draft; if(CHAT.draft) sync();

  el.addEventListener('click', chatClick);
  el.addEventListener('keydown', e => {
    if(e.target.classList?.contains('cb-edit-ta')){
      if(e.key==='Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); chatSaveEdit(); }
      else if(e.key==='Escape'){ CHAT.editingId=null; chatPaintList(); }
    } else if(e.key==='Escape' && CHAT.popup){ CHAT.popup=null; chatPaintPopup(); }
  });
  el.addEventListener('input', e => {
    if(e.target.classList?.contains('cb-edit-ta')){
      CHAT.editDraft = e.target.value;
      e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,160)+'px';
    }
  });

  chatPaintHeader(); chatPaintList(true); chatPaintPopup();
}

function chatPaintHeader(){
  const el = CHAT.el; if(!el) return;
  const pc = el.querySelector('[data-role="pin-count"]');
  const oc = el.querySelector('[data-role="online-count"]');
  if(pc){ pc.textContent = CHAT.pinned.length || ''; pc.style.display = CHAT.pinned.length ? '' : 'none'; }
  if(oc){ oc.textContent = CHAT.online.length || ''; oc.style.display = CHAT.online.length ? '' : 'none'; }
}

function chatMsgHTML(m, compact){
  const mine = m.userId === cbMe();
  const host = cbIsHost();
  const canEdit = mine, canDel = mine || host, canPin = host;
  const editing = CHAT.editingId === m.id;
  const rx = (m.reactions||[]).map(r=>{
    const me = r.users.includes(cbMe());
    return `<button class="cb-rx${me?' mine':''}" data-act="rx" data-id="${m.id}" data-emoji="${r.emoji}">${r.emoji}<span>${r.users.length}</span></button>`;
  }).join('');
  const picker = CHAT.pickerFor === m.id
    ? `<div class="cb-picker">${CHAT.emojis.map(e=>`<button data-act="rx" data-id="${m.id}" data-emoji="${e}">${e}</button>`).join('')}</div>` : '';
  const bar = `<div class="cb-actions">
      <button data-act="picker" data-id="${m.id}" title="React">${CB_ICON.smile}</button>
      ${canEdit?`<button data-act="edit" data-id="${m.id}" title="Edit">${CB_ICON.edit}</button>`:''}
      ${canPin?`<button data-act="pinmsg" data-id="${m.id}" title="${m.pinned?'Unpin':'Pin'}" class="${m.pinned?'on':''}">${CB_ICON.pin}</button>`:''}
      ${canDel?`<button data-act="del" data-id="${m.id}" title="Delete" class="danger">${CB_ICON.trash}</button>`:''}
    </div>`;
  const body = editing
    ? `<textarea class="cb-edit-ta" rows="1" maxlength="${CHAT_MAX}">${cbEsc(CHAT.editDraft)}</textarea>
       <div class="cb-edit-hint">escape to <a data-act="edit-cancel">cancel</a> · enter to <a data-act="edit-save">save</a></div>`
    : `<div class="cb-text">${cbLinkify(cbEsc(m.text))}${m.editedAt?'<span class="cb-edited"> (edited)</span>':''}</div>`;
  const head = compact ? '' : `<div class="cb-meta">
      <span class="cb-name${m.role==='host'?' host':''}">${cbEsc(m.userName)}</span>
      ${m.role==='host'?'<span class="cb-badge">HOST</span>':''}
      <span class="cb-time">${cbTime(m.createdAt)}</span>
    </div>`;
  const avatar = compact
    ? `<div class="cb-av-gap"><span class="cb-time-hover">${cbTime(m.createdAt).replace(/\s?[AP]M/i,'')}</span></div>`
    : `<div class="cb-av${m.role==='host'?' host':''}">${cbEsc((m.userName||'?')[0].toUpperCase())}</div>`;
  return `<div class="cb-msg${compact?' compact':''}${m.pinned?' pinned':''}${CHAT.actionsFor===m.id?' show-actions':''}" data-id="${m.id}">
    ${bar}
    ${avatar}
    <div class="cb-main">
      ${m.pinned?'<div class="cb-pinned-tag">📌 Pinned</div>':''}
      ${head}${body}
      ${rx?`<div class="cb-rxrow">${rx}</div>`:''}
      ${picker}
    </div>
  </div>`;
}

function chatPaintList(forceBottom){
  const el = CHAT.el; if(!el) return;
  const list = el.querySelector('.cb-list'); if(!list) return;
  const wasStick = CHAT.stick || forceBottom;
  const prevH = list.scrollHeight, prevTop = list.scrollTop;
  let html = '';
  if(!CHAT.loaded){
    html = CHAT.error
      ? `<div class="cb-empty">⚠️ ${cbEsc(CHAT.error)}<br><a data-act="retry">Try again</a></div>`
      : `<div class="cb-empty"><div class="spinner" style="margin:0 auto 10px"></div>Loading chat…</div>`;
  } else {
    if(CHAT.hasMore) html += `<div class="cb-more"><button data-act="older">${CHAT.loadingMore?'Loading…':'Load earlier messages'}</button></div>`;
    if(!CHAT.msgs.length) html += `<div class="cb-empty"><div style="font-size:1.6rem;margin-bottom:4px">👋</div>No messages yet — say hello!</div>`;
    let prev = null;
    CHAT.msgs.forEach(m=>{
      const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
      if(newDay) html += `<div class="cb-day"><span>${cbDay(m.createdAt)}</span></div>`;
      const compact = !newDay && prev.userId===m.userId && !prev.pinned && !m.pinned
        && (new Date(m.createdAt)-new Date(prev.createdAt)) < 5*60*1000 && CHAT.editingId!==m.id;
      html += chatMsgHTML(m, compact);
      prev = m;
    });
  }
  list.innerHTML = html;
  if(CHAT.editingId){
    const ta = list.querySelector('.cb-edit-ta');
    if(ta){ ta.style.height='auto'; ta.style.height=Math.min(ta.scrollHeight,160)+'px';
      if(!ta.dataset.focused){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); ta.dataset.focused='1'; } }
  }
  if(wasStick) list.scrollTop = list.scrollHeight;
  else if(CHAT.prepending){ list.scrollTop = prevTop + (list.scrollHeight - prevH); CHAT.prepending=false; }
  else list.scrollTop = prevTop;
  CHAT.scrollTop = list.scrollTop;
  const j = el.querySelector('.cb-jump'); if(j) j.style.display = (list.scrollHeight - list.scrollTop - list.clientHeight < 70) ? 'none' : 'flex';
}
function chatPaint(force){ chatPaintHeader(); chatPaintList(force); chatPaintPopup(); }

function chatPaintPopup(){
  const el = CHAT.el; if(!el) return;
  const wrap = el.querySelector('.cb-pop-wrap'); if(!wrap) return;
  if(!CHAT.popup){ wrap.style.display='none'; wrap.innerHTML=''; return; }
  let inner = '';
  if(CHAT.popup === 'members'){
    inner = `<div class="cb-pop-head"><b>Online — ${CHAT.online.length}</b><button data-act="popup-close" aria-label="Close">✕</button></div>
      <div class="cb-pop-body">${CHAT.online.length ? CHAT.online.map(u=>`
        <div class="cb-member">
          <div class="cb-av sm${u.role==='host'?' host':''}">${cbEsc((u.name||'?')[0].toUpperCase())}<i class="cb-dot"></i></div>
          <span class="cb-mname">${cbEsc(u.name)}${u.id===cbMe()?' <small>(you)</small>':''}</span>
          ${u.role==='host'?'<span class="cb-badge">HOST</span>':''}
        </div>`).join('') : '<div class="cb-empty">Nobody online</div>'}</div>`;
  } else {
    inner = `<div class="cb-pop-head"><b>📌 Pinned — ${CHAT.pinned.length}</b><button data-act="popup-close" aria-label="Close">✕</button></div>
      <div class="cb-pop-body">${CHAT.pinned.length ? CHAT.pinned.map(m=>`
        <div class="cb-pin-item" data-act="goto" data-id="${m.id}">
          <div class="cb-meta"><span class="cb-name${m.role==='host'?' host':''}">${cbEsc(m.userName)}</span><span class="cb-time">${cbDay(m.createdAt)} · ${cbTime(m.createdAt)}</span></div>
          <div class="cb-text">${cbLinkify(cbEsc(m.text))}</div>
          ${m.pinnedBy?`<div class="cb-pinby">pinned by ${cbEsc(m.pinnedBy)}</div>`:''}
          ${cbIsHost()?`<button class="cb-unpin" data-act="pinmsg" data-id="${m.id}">Unpin</button>`:''}
        </div>`).join('') : '<div class="cb-empty">No pinned messages yet.</div>'}</div>`;
  }
  wrap.style.display = 'flex';
  wrap.innerHTML = `<div class="cb-pop">${inner}</div>`;
}

/* ── actions ────────────────────────────────────────────────────────────── */
async function chatClick(e){
  const t = e.target.closest('[data-act]');
  if(!t){
    // tap on empty space closes the popup backdrop / hides touch action bar
    if(e.target.classList?.contains('cb-pop-wrap')){ CHAT.popup=null; chatPaintPopup(); return; }
    const row = e.target.closest('.cb-msg');
    if(row && cbCoarse() && !e.target.closest('a,textarea')){
      CHAT.actionsFor = CHAT.actionsFor===row.dataset.id ? null : row.dataset.id; CHAT.pickerFor=null; chatPaintList();
    }
    return;
  }
  const act = t.dataset.act, id = t.dataset.id;
  try{
    switch(act){
      case 'send':   return chatSend();
      case 'members': CHAT.popup = CHAT.popup==='members'?null:'members'; return chatPaintPopup();
      case 'pins':    CHAT.popup = CHAT.popup==='pins'?null:'pins'; return chatPaintPopup();
      case 'popup-close': CHAT.popup=null; return chatPaintPopup();
      case 'jump': { const l=CHAT.el.querySelector('.cb-list'); CHAT.stick=true; l.scrollTop=l.scrollHeight; return; }
      case 'retry': CHAT.error=''; return chatLoadHistory();
      case 'older': return chatLoadOlder();
      case 'picker': CHAT.pickerFor = CHAT.pickerFor===id?null:id; return chatPaintList();
      case 'rx': {
        CHAT.pickerFor = null; chatPaintList();
        await cbApi('POST', `/api/chat/messages/${id}/react`, {emoji:t.dataset.emoji}); return; }
      case 'edit': {
        const m = CHAT.msgs.find(x=>x.id===id); if(!m) return;
        CHAT.editingId=id; CHAT.editDraft=m.text; CHAT.pickerFor=null; return chatPaintList(); }
      case 'edit-cancel': CHAT.editingId=null; return chatPaintList();
      case 'edit-save':   return chatSaveEdit();
      case 'del': {
        const m = CHAT.msgs.find(x=>x.id===id);
        if(!confirm(m && m.userId!==cbMe() ? `Delete ${m.userName}'s message?` : 'Delete this message?')) return;
        await cbApi('DELETE', `/api/chat/messages/${id}`); return; }
      case 'pinmsg': {
        const m = CHAT.msgs.find(x=>x.id===id) || CHAT.pinned.find(x=>x.id===id); if(!m) return;
        await cbApi('POST', `/api/chat/messages/${id}/pin`, {pinned:!m.pinned}); return; }
      case 'goto': {
        if(e.target.closest('.cb-unpin')) return;
        CHAT.popup=null; chatPaintPopup();
        const row = CHAT.el.querySelector(`.cb-msg[data-id="${id}"]`);
        if(row){ CHAT.stick=false; row.scrollIntoView({block:'center',behavior:'smooth'}); row.classList.add('flash'); setTimeout(()=>row.classList.remove('flash'),1500); }
        else showToast('That message is further up — load earlier messages.','neutral');
        return; }
    }
  }catch(err){ showToast(err.message || 'Something went wrong','bad'); }
}

async function chatSend(){
  const ta = CHAT.el?.querySelector('.cb-input'); if(!ta) return;
  const text = ta.value.trim(); if(!text) return;
  ta.value=''; CHAT.draft=''; ta.style.height='auto';
  CHAT.el.querySelector('.cb-send').disabled = true;
  CHAT.el.querySelector('.cb-limit').textContent='';
  CHAT.stick = true;
  ta.focus({preventScroll:true});
  try{
    const d = await cbApi('POST','/api/chat/messages',{text});
    if(!CHAT.msgs.some(x=>x.id===d.message.id)) CHAT.msgs.push(d.message);
    chatPaintList(true);
  }catch(err){
    ta.value = text; CHAT.draft = text; ta.dispatchEvent(new Event('input'));   // give the text back
    showToast(err.message || 'Could not send','bad');
  }
}
async function chatSaveEdit(){
  const id = CHAT.editingId; if(!id) return;
  const text = CHAT.editDraft.trim();
  if(!text){ showToast('Message can\u2019t be empty — delete it instead.','bad'); return; }
  const old = CHAT.msgs.find(x=>x.id===id);
  if(old && old.text === text){ CHAT.editingId=null; return chatPaintList(); }
  try{
    const d = await cbApi('PUT',`/api/chat/messages/${id}`,{text});
    CHAT.editingId=null; chatReplace(d.message);
  }catch(err){ showToast(err.message || 'Could not edit','bad'); }
}
async function chatLoadOlder(){
  if(CHAT.loadingMore || !CHAT.msgs.length) return;
  CHAT.loadingMore = true; chatPaintList();
  try{
    const d = await cbApi('GET', `/api/chat/messages?before=${CHAT.msgs[0].id}`);
    CHAT.hasMore = !!d.hasMore;
    CHAT.msgs = (d.messages||[]).concat(CHAT.msgs);
    CHAT.stick = false; CHAT.prepending = true;
  }catch(err){ showToast(err.message,'bad'); }
  CHAT.loadingMore = false; chatPaintList();
}
