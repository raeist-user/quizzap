/* ══════════════════════════════════════════════════════════════════════════
   #chatbox — client for the home-screen group chat.
   Hooks used elsewhere:
     chatPreRender() – called at the start of render(); parks #chatbox safely
     chatMount()     – called from attach(); seats #chatbox in #chatbox-slot
     chatReset()     – called on logout; closes socket and clears state
   Server: REST /api/chat/*  +  websocket /chat?token=...
══════════════════════════════════════════════════════════════════════════ */
(function(){
  const ICON = {
    send:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    users:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    pin:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 3h6l-1 7 3 3v2H7v-2l3-3z"/></svg>',
    smile:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    edit:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    del:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
    down:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
  };
  const DEFAULT_RX = ['👍','👎','👋','👏','🙌','🙏','🤝','💪','✌️','👌','🤞','☝️'];

  let el = null;            // the persistent #chatbox element
  let ws = null, wsTimer = null, wsToken = null, closed = false;
  let msgs = [], pinned = [], online = [], rxList = DEFAULT_RX;
  let hasMore = false, loaded = false, loading = false, loadErr = '';
  let popup = null;         // 'online' | 'pins' | null
  let pickerFor = null, editingId = null, actionsFor = null;
  let stick = true;         // keep scrolled to bottom
  let draft = '';

  const $ = s => el && el.querySelector(s);
  const E = s => (typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'));
  const me = () => (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null;
  const myId = () => String(me()?.id || '');
  const isHost = () => me()?.role === 'host';
  const toast = (m, t) => { try { typeof showToast === 'function' ? showToast(m, t || 'error') : alert(m); } catch { } };

  function api(path, opts = {}) {
    const headers = { Authorization: 'Bearer ' + authToken };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch('/api/chat' + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(async r => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Something went wrong');
        return j;
      });
  }

  /* ── formatting ── */
  const fmtTime = d => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  function fmtDay(d) {
    const x = new Date(d), t = new Date(), y = new Date(); y.setDate(t.getDate() - 1);
    if (x.toDateString() === t.toDateString()) return 'Today';
    if (x.toDateString() === y.toDateString()) return 'Yesterday';
    return x.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function linkify(s) {
    return E(s).replace(/(https?:\/\/[^\s<]+)/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
  }
  const initial = n => E((n || '?').trim().charAt(0).toUpperCase());

  /* ── rendering ── */
  function shell() {
    el.innerHTML = `
      <div class="cb-head">
        <div class="cb-title"><span class="cb-hash">#</span>general</div>
        <div class="cb-head-btns">
          <button class="cb-hbtn" data-cb="pins" title="Pinned messages">${ICON.pin}<span class="cb-count" id="cb-pin-n"></span></button>
          <button class="cb-hbtn" data-cb="online" title="Online">${ICON.users}<span class="cb-count cb-count-online" id="cb-on-n"></span></button>
        </div>
      </div>
      <div class="cb-body">
        <div class="cb-list" id="cb-list"></div>
        <button class="cb-jump" id="cb-jump" style="display:none">${ICON.down} New messages</button>
        <div id="cb-pop"></div>
      </div>
      <div class="cb-composer">
        <div class="cb-box">
          <span class="cb-limit" id="cb-limit"></span>
          <textarea class="cb-input" id="cb-input" rows="1" maxlength="1000" placeholder="Message #general"></textarea>
          <button class="cb-send" id="cb-send" disabled title="Send">${ICON.send}</button>
        </div>
      </div>`;
    const inp = $('#cb-input');
    inp.value = draft;
    autosize(inp); updateSend();
  }

  function autosize(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px'; }
  function updateSend() {
    const inp = $('#cb-input'), b = $('#cb-send'), lim = $('#cb-limit');
    if (!inp) return;
    const n = inp.value.trim().length;
    b.disabled = !n;
    lim.textContent = inp.value.length > 850 ? (1000 - inp.value.length) : '';
  }

  function msgHTML(m, prev) {
    const mine = String(m.userId) === myId();
    const sameDay = prev && new Date(prev.createdAt).toDateString() === new Date(m.createdAt).toDateString();
    const compact = prev && sameDay && prev.userId === m.userId && (new Date(m.createdAt) - new Date(prev.createdAt)) < 5 * 60000 && !m.pinned;
    const day = !sameDay ? `<div class="cb-day">${E(fmtDay(m.createdAt))}</div>` : '';
    const host = m.role === 'host';

    let body;
    if (editingId === m.id) {
      body = `<textarea class="cb-edit-ta" data-edit-ta="${m.id}" rows="2" maxlength="1000">${E(m.text)}</textarea>
              <div class="cb-edit-hint">Enter to <a data-cb="edit-save" data-id="${m.id}">save</a> · Esc to <a data-cb="edit-cancel">cancel</a></div>`;
    } else {
      body = `<div class="cb-text">${linkify(m.text)}${m.editedAt ? ' <span class="cb-edited">(edited)</span>' : ''}</div>`;
    }

    const rx = (m.reactions || []).length
      ? `<div class="cb-rxrow">${m.reactions.map(r => `<button class="cb-rx ${r.users.includes(myId()) ? 'mine' : ''}" data-cb="react" data-id="${m.id}" data-emoji="${r.emoji}">${r.emoji}<span>${r.users.length}</span></button>`).join('')}</div>` : '';
    const picker = pickerFor === m.id
      ? `<div class="cb-picker">${rxList.map(e => `<button data-cb="react" data-id="${m.id}" data-emoji="${e}">${e}</button>`).join('')}</div>` : '';

    const actions = `<div class="cb-actions">
      <button data-cb="picker" data-id="${m.id}" title="React">${ICON.smile}</button>
      ${mine ? `<button data-cb="edit" data-id="${m.id}" title="Edit">${ICON.edit}</button>` : ''}
      ${isHost() ? `<button class="${m.pinned ? 'on' : ''}" data-cb="pin" data-id="${m.id}" title="${m.pinned ? 'Unpin' : 'Pin'}">${ICON.pin}</button>` : ''}
      ${(mine || isHost()) ? `<button class="danger" data-cb="del" data-id="${m.id}" title="Delete">${ICON.del}</button>` : ''}
    </div>`;

    const lead = compact
      ? `<div class="cb-av-gap"><span class="cb-time-hover">${fmtTime(m.createdAt)}</span></div>`
      : `<div class="cb-av ${host ? 'host' : ''}">${initial(m.userName)}</div>`;
    const meta = compact ? '' : `<div class="cb-meta"><span class="cb-name ${host ? 'host' : ''}">${E(m.userName)}</span>${host ? '<span class="cb-badge">HOST</span>' : ''}<span class="cb-time">${fmtTime(m.createdAt)}</span></div>`;
    const pinTag = m.pinned ? `<div class="cb-pinned-tag">📌 Pinned${m.pinnedBy ? ' by ' + E(m.pinnedBy) : ''}</div>` : '';

    return `${day}<div class="cb-msg ${compact ? 'compact' : ''} ${m.pinned ? 'pinned' : ''} ${actionsFor === m.id ? 'show-actions' : ''}" data-mid="${m.id}">
      ${lead}<div class="cb-main">${pinTag}${meta}${body}${rx}${picker}</div>${actions}</div>`;
  }

  function paintList(keepScroll) {
    const list = $('#cb-list'); if (!list) return;
    const prevH = list.scrollHeight, prevTop = list.scrollTop;
    let h = '';
    if (!loaded && !loadErr) h = '<div class="cb-empty">Loading chat…</div>';
    else if (loadErr) h = `<div class="cb-empty">${E(loadErr)}<br><a data-cb="retry">Try again</a></div>`;
    else {
      if (hasMore) h += `<div class="cb-more"><button data-cb="more">${loading ? 'Loading…' : 'Load older messages'}</button></div>`;
      if (!msgs.length) h += '<div class="cb-empty">No messages yet. Say hello 👋</div>';
      h += msgs.map((m, i) => msgHTML(m, msgs[i - 1])).join('');
    }
    list.innerHTML = h;
    if (keepScroll === 'older') list.scrollTop = list.scrollHeight - prevH + prevTop;
    else if (stick) list.scrollTop = list.scrollHeight;
    else list.scrollTop = prevTop;
    const ed = list.querySelector('[data-edit-ta]');
    if (ed && !ed._f) { ed._f = 1; ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length); }
    paintCounts();
  }

  function paintCounts() {
    const p = $('#cb-pin-n'), o = $('#cb-on-n');
    if (p) p.textContent = pinned.length || '';
    if (o) o.textContent = online.length || '';
  }

  function paintPopup() {
    const host = $('#cb-pop'); if (!host) return;
    if (!popup) { host.innerHTML = ''; return; }
    let title, body;
    if (popup === 'online') {
      title = `Online — ${online.length}`;
      body = online.length ? online.map(u => `<div class="cb-member"><div class="cb-av sm ${u.role === 'host' ? 'host' : ''}">${initial(u.name)}<span class="cb-dot"></span></div><div class="cb-mname">${E(u.name)}${u.role === 'host' ? ' <small>host</small>' : ''}</div></div>`).join('') : '<div class="cb-empty">Nobody online</div>';
    } else {
      title = `Pinned — ${pinned.length}`;
      body = pinned.length ? pinned.map(m => `<div class="cb-pin-item" data-cb="jump" data-id="${m.id}"><div class="cb-name ${m.role === 'host' ? 'host' : ''}">${E(m.userName)}</div><div class="cb-text">${E(m.text.length > 160 ? m.text.slice(0, 160) + '…' : m.text)}</div><div class="cb-pinby">${m.pinnedBy ? 'Pinned by ' + E(m.pinnedBy) : ''}</div>${isHost() ? `<button class="cb-unpin" data-cb="unpin" data-id="${m.id}">Unpin</button>` : ''}</div>`).join('') : '<div class="cb-empty">No pinned messages</div>';
    }
    host.innerHTML = `<div class="cb-pop-wrap" style="display:flex" data-cb="popbg"><div class="cb-pop"><div class="cb-pop-head"><b>${title}</b><button data-cb="popclose">✕</button></div><div class="cb-pop-body">${body}</div></div></div>`;
  }

  /* ── data ── */
  async function load() {
    if (!authToken || loading) return;
    loading = true; loadErr = '';
    try {
      const j = await api('/messages');
      msgs = j.messages || []; pinned = j.pinned || []; online = j.online || online;
      if (j.reactions?.length) rxList = j.reactions;
      hasMore = !!j.hasMore; loaded = true; stick = true;
    } catch (e) { loadErr = 'Could not load chat. ' + e.message; }
    loading = false;
    paintList(); paintPopup();
  }

  async function loadOlder() {
    if (loading || !msgs.length) return;
    loading = true; paintList('older');
    try {
      const j = await api('/messages?before=' + msgs[0].id);
      msgs = (j.messages || []).concat(msgs); hasMore = !!j.hasMore;
    } catch (e) { toast(e.message); }
    loading = false; paintList('older');
  }

  async function send() {
    const inp = $('#cb-input'); if (!inp) return;
    const text = inp.value.trim(); if (!text) return;
    inp.value = ''; draft = ''; autosize(inp); updateSend();
    try {
      const j = await api('/messages', { method: 'POST', body: { text } });
      if (j.message && !msgs.some(m => m.id === j.message.id)) msgs.push(j.message);
      stick = true; paintList();
    } catch (e) { toast(e.message); inp.value = text; draft = text; autosize(inp); updateSend(); }
  }

  /* ── websocket ── */
  function connect() {
    if (!authToken || closed) return;
    if (ws && (ws.readyState === 0 || ws.readyState === 1) && wsToken === authToken) return;
    try { ws && ws.close(); } catch { }
    wsToken = authToken;
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/chat?token=${encodeURIComponent(authToken)}`);
    ws.onmessage = ev => { let d; try { d = JSON.parse(ev.data); } catch { return; } handle(d); };
    ws.onclose = e => {
      ws = null;
      if (closed || e.code === 4001) return;
      clearTimeout(wsTimer); wsTimer = setTimeout(() => { connect(); if (loaded) refreshQuiet(); }, 3000);
    };
    ws.onerror = () => { };
  }

  async function refreshQuiet() {
    try {
      const j = await api('/messages');
      msgs = j.messages || []; pinned = j.pinned || []; hasMore = !!j.hasMore; paintList();
    } catch { }
  }

  function handle(d) {
    const list = $('#cb-list');
    const atBottom = list ? (list.scrollHeight - list.scrollTop - list.clientHeight < 80) : true;
    if (d.type === 'presence') { online = d.users || []; paintCounts(); if (popup === 'online') paintPopup(); return; }
    if (!loaded) return;
    if (d.type === 'msg_new') {
      if (msgs.some(m => m.id === d.message.id)) return;
      msgs.push(d.message);
      stick = atBottom || String(d.message.userId) === myId();
      paintList();
      if (!stick) { const j = $('#cb-jump'); if (j) j.style.display = 'flex'; }
    } else if (d.type === 'msg_edit') {
      const i = msgs.findIndex(m => m.id === d.message.id); if (i >= 0) msgs[i] = d.message;
      const p = pinned.findIndex(m => m.id === d.message.id); if (p >= 0) pinned[p] = d.message;
      stick = false; paintList();
    } else if (d.type === 'msg_delete') {
      msgs = msgs.filter(m => m.id !== d.id); pinned = pinned.filter(m => m.id !== d.id);
      stick = false; paintList(); if (popup === 'pins') paintPopup();
    } else if (d.type === 'msg_react') {
      const m = msgs.find(m => m.id === d.id); if (m) m.reactions = d.reactions;
      stick = false; paintList();
    } else if (d.type === 'msg_pin') {
      const i = msgs.findIndex(m => m.id === d.message.id); if (i >= 0) msgs[i] = d.message;
      pinned = pinned.filter(m => m.id !== d.message.id);
      if (d.message.pinned) pinned.unshift(d.message);
      stick = false; paintList(); if (popup === 'pins') paintPopup();
    }
  }

  /* ── events (delegated, bound once on the persistent element) ── */
  function bind() {
    el.addEventListener('click', async ev => {
      const t = ev.target.closest('[data-cb]');
      if (!t) {
        const m = ev.target.closest('.cb-msg');
        if (m && window.matchMedia('(pointer:coarse)').matches) { actionsFor = actionsFor === m.dataset.mid ? null : m.dataset.mid; stick = false; paintList(); }
        return;
      }
      const a = t.dataset.cb, id = t.dataset.id;
      if (a === 'popbg') { if (ev.target === t) { popup = null; paintPopup(); } return; }
      ev.stopPropagation();
      try {
        if (a === 'online' || a === 'pins') { popup = popup === (a === 'pins' ? 'pins' : 'online') ? null : (a === 'pins' ? 'pins' : 'online'); paintPopup(); }
        else if (a === 'popclose') { popup = null; paintPopup(); }
        else if (a === 'more') loadOlder();
        else if (a === 'retry') { loaded = false; load(); }
        else if (a === 'picker') { pickerFor = pickerFor === id ? null : id; stick = false; paintList(); }
        else if (a === 'react') { pickerFor = null; stick = false; paintList(); await api(`/messages/${id}/react`, { method: 'POST', body: { emoji: t.dataset.emoji } }); }
        else if (a === 'edit') { editingId = id; stick = false; paintList(); }
        else if (a === 'edit-cancel') { editingId = null; stick = false; paintList(); }
        else if (a === 'edit-save') saveEdit(id);
        else if (a === 'del') { if (confirm('Delete this message?')) await api(`/messages/${id}`, { method: 'DELETE' }); }
        else if (a === 'pin') { const m = msgs.find(x => x.id === id); await api(`/messages/${id}/pin`, { method: 'POST', body: { pinned: !m?.pinned } }); }
        else if (a === 'unpin') { await api(`/messages/${id}/pin`, { method: 'POST', body: { pinned: false } }); }
        else if (a === 'jump') {
          popup = null; paintPopup();
          const node = el.querySelector(`[data-mid="${id}"]`);
          if (node) { node.scrollIntoView({ block: 'center' }); node.classList.add('flash'); setTimeout(() => node.classList.remove('flash'), 1500); }
          else toast('That message is older — load earlier messages first.', 'neutral');
        }
      } catch (e) { toast(e.message); }
    });

    el.addEventListener('input', ev => {
      if (ev.target.id === 'cb-input') { draft = ev.target.value; autosize(ev.target); updateSend(); }
      else if (ev.target.matches('[data-edit-ta]')) { ev.target.style.height = 'auto'; ev.target.style.height = Math.min(ev.target.scrollHeight, 160) + 'px'; }
    });

    el.addEventListener('keydown', ev => {
      if (ev.target.id === 'cb-input' && ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); send(); }
      else if (ev.target.matches('[data-edit-ta]')) {
        if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); saveEdit(ev.target.dataset.editTa); }
        else if (ev.key === 'Escape') { editingId = null; stick = false; paintList(); }
      }
    });

    el.addEventListener('click', ev => { if (ev.target.closest('#cb-send')) send(); if (ev.target.closest('#cb-jump')) { stick = true; paintList(); ev.target.closest('#cb-jump').style.display = 'none'; } });

    el.addEventListener('scroll', ev => {
      if (ev.target.id !== 'cb-list') return;
      const l = ev.target; stick = l.scrollHeight - l.scrollTop - l.clientHeight < 80;
      if (stick) { const j = $('#cb-jump'); if (j) j.style.display = 'none'; }
    }, true);
  }

  async function saveEdit(id) {
    const ta = el.querySelector('[data-edit-ta]'); if (!ta) return;
    const text = ta.value.trim();
    const cur = msgs.find(m => m.id === id);
    if (!text || (cur && cur.text === text)) { editingId = null; stick = false; paintList(); return; }
    try { await api(`/messages/${id}`, { method: 'PUT', body: { text } }); editingId = null; } catch (e) { toast(e.message); }
  }

  /* ── lifecycle hooks used by ui.js / backend.js ── */
  function ensure() {
    if (el) return el;
    el = document.createElement('div');
    el.id = 'chatbox'; el.className = 'cb';
    shell(); bind();
    return el;
  }

  // Park #chatbox outside #view before render() wipes innerHTML, so it survives.
  window.chatPreRender = function () {
    if (el && el.parentNode && el.parentNode.id !== 'cb-parking') {
      let park = document.getElementById('cb-parking');
      if (!park) { park = document.createElement('div'); park.id = 'cb-parking'; park.style.display = 'none'; document.body.appendChild(park); }
      park.appendChild(el);
    }
  };

  window.chatMount = function () {
    const slot = document.getElementById('chatbox-slot');
    if (!slot) return;                       // not on the home screen
    if (typeof authToken === 'undefined' || !authToken || !me()) return;
    closed = false;
    ensure();
    if (el.parentNode !== slot) slot.appendChild(el);
    if (!loaded && !loading) load();
    else { paintList(); }
    connect();
    const list = $('#cb-list'); if (list && stick) list.scrollTop = list.scrollHeight;
  };

  window.chatReset = function () {
    closed = true; clearTimeout(wsTimer);
    try { ws && ws.close(); } catch { }
    ws = null; wsToken = null;
    msgs = []; pinned = []; online = []; hasMore = false; loaded = false; loading = false; loadErr = '';
    popup = null; pickerFor = null; editingId = null; actionsFor = null; draft = ''; stick = true;
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = null;
  };
})();
