/* ══════════════════════════════════════════════════════════════════════════
   #chatbox — client for the #Chatbox group chat (opens in its own window).
   Hooks used elsewhere:
     chatPreRender()    – called at the start of render(); parks #chatbox safely
     chatMount()        – called from attach(); keeps socket/unread alive and,
                          on the chat screen, seats #chatbox in #chatbox-slot
     chatReset()        – called on logout; closes socket and clears state
     chatUnreadLabel()  – text for the unread badge on the Home button
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
    back:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    dots:'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>',
    down:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
  };
  const DEFAULT_RX = ['👍','👎','👋','👏','🙌','🙏','🤝','💪','✌️','👌','🤞','☝️'];

  let el = null;            // the persistent #chatbox element
  let ws = null, wsTimer = null, wsToken = null, closed = false;
  let msgs = [], pinned = [], online = [], rxList = DEFAULT_RX;
  let onlineKnown = false;  // false until the server has told us who is online (and again while disconnected)
  let hasMore = false, loaded = false, loading = false, loadErr = '';
  let popup = null;         // 'online' | 'pins' | null
  let editingId = null;
  let actionsFor = null;    // the selected message (drives the reaction bar + highlight)
  let menuFor = null;       // message whose 3-dot menu is open
  let pickerFor = null;     // message whose emoji menu is open (opened from its single reaction icon)
  let stick = true;         // keep scrolled to bottom
  let draft = '';
  let readTs = null;        // ms timestamp of the newest message the user has seen

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
        <button class="cb-back" data-cb="back" title="Back to Home" aria-label="Back to Home">${ICON.back}</button>
        <div class="cb-title"><span class="cb-hash">#</span>Chatbox</div>
        <div class="cb-head-btns">
          <button class="cb-hbtn" data-cb="pins" title="Pinned messages">${ICON.pin}<span class="cb-count" id="cb-pin-n"></span></button>
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
          <textarea class="cb-input" id="cb-input" rows="1" maxlength="1000" placeholder="Message #Chatbox" enterkeyhint="send" autocomplete="off"></textarea>
          <button class="cb-send" id="cb-send" disabled title="Send">${ICON.send}</button>
        </div>
      </div>`;
    const inp = $('#cb-input');
    inp.value = draft;
    autosize(inp); updateSend();
  }

  function autosize(t) {
    if (!t || !t.isConnected) return;            // detached => scrollHeight is 0 and the box would collapse
    t.style.height = 'auto';
    const h = Math.max(42, Math.min(t.scrollHeight, 140));
    t.style.height = h + 'px';
    t.style.overflowY = t.scrollHeight > 140 ? 'auto' : 'hidden';
    const list = $('#cb-list'); if (list && stick) list.scrollTop = list.scrollHeight;
  }
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

    const selected = actionsFor === m.id;
    // Reaction row: existing reactions first, then (only while the message is selected) a single
    // reaction icon. The full emoji menu opens only after that icon is clicked, and closes again
    // right after one reaction is picked – leaving just the icon.
    const chips = (m.reactions || []).map(r => `<button class="cb-rx ${r.users.includes(myId()) ? 'mine' : ''}" data-cb="react" data-id="${m.id}" data-emoji="${r.emoji}">${r.emoji}<span>${r.users.length}</span></button>`).join('');
    const pickerOpen = selected && pickerFor === m.id;
    const addBtn = selected ? `<button class="cb-rxadd ${pickerOpen ? 'on' : ''}" data-cb="rxopen" data-id="${m.id}" title="Add reaction" aria-label="Add reaction" aria-expanded="${pickerOpen}">${ICON.smile}</button>` : '';
    const picker = pickerOpen ? `<div class="cb-picker">${rxList.map(e => `<button data-cb="react" data-id="${m.id}" data-emoji="${e}">${e}</button>`).join('')}</div>` : '';
    const rx = (chips || addBtn) ? `<div class="cb-rxrow">${chips}${addBtn}${picker}</div>` : '';

    // 3-dot menu: edit / pin / delete (only shown when there is something to do)
    const canEdit = mine, canPin = isHost(), canDel = mine || isHost();
    const menu = menuFor === m.id
      ? `<div class="cb-menu">
          ${canEdit ? `<button data-cb="edit" data-id="${m.id}">${ICON.edit}<span>Edit</span></button>` : ''}
          ${canPin ? `<button data-cb="pin" data-id="${m.id}">${ICON.pin}<span>${m.pinned ? 'Unpin' : 'Pin'}</span></button>` : ''}
          ${canDel ? `<button class="danger" data-cb="del" data-id="${m.id}">${ICON.del}<span>Delete</span></button>` : ''}
        </div>` : '';
    const actions = (canEdit || canPin || canDel)
      ? `<div class="cb-actions"><button class="cb-dots ${menuFor === m.id ? 'on' : ''}" data-cb="dots" data-id="${m.id}" title="More" aria-label="More options" aria-haspopup="true">${ICON.dots}</button>${menu}</div>` : '';

    const lead = compact
      ? `<div class="cb-av-gap"><span class="cb-time-hover">${fmtTime(m.createdAt)}</span></div>`
      : `<div class="cb-av ${host ? 'host' : ''}">${initial(m.userName)}</div>`;
    const meta = compact ? '' : `<div class="cb-meta"><span class="cb-name ${host ? 'host' : ''}">${E(m.userName)}</span>${host ? '<span class="cb-badge">HOST</span>' : ''}<span class="cb-time">${fmtTime(m.createdAt)}</span></div>`;
    const pinTag = m.pinned ? `<div class="cb-pinned-tag">📌 Pinned${m.pinnedBy ? ' by ' + E(m.pinnedBy) : ''}</div>` : '';

    return `${day}<div class="cb-msg ${compact ? 'compact' : ''} ${m.pinned ? 'pinned' : ''} ${selected ? 'selected' : ''}" data-mid="${m.id}">
      ${lead}<div class="cb-main">${pinTag}${meta}${body}${rx}</div>${actions}</div>`;
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
    const p = $('#cb-pin-n');
    if (p) p.textContent = pinned.length || '';
    document.querySelectorAll('.online-n').forEach(n => { n.textContent = onlineKnown ? online.length : '–'; });
    if (onlinePopEl && onlinePopEl.classList.contains('show')) paintOnlinePop();
  }

  /* ── online members popup (opened from the Home screen) ── */
  let onlinePopEl = null;
  /* single source of truth for the online list (used by both the home popup and the in-chat popup) */
  function onlineTitle() { return onlineKnown ? `Members online — ${online.length}` : 'Members online'; }
  function onlineRowsHTML() {
    if (!onlineKnown) return '<div class="cb-empty">Connecting…</div>';
    if (!online.length) return '<div class="cb-empty">Nobody online</div>';
    return online.map(u => `<div class="cb-member"><div class="cb-av sm ${u.role === 'host' ? 'host' : ''}">${initial(u.name)}</div><div class="cb-mname">${E(u.name)}${u.role === 'host' ? ' <small>host</small>' : ''}</div><span class="cb-member-ic">${ICON.users}</span></div>`).join('');
  }
  function paintOnlinePop() {
    if (!onlinePopEl) return;
    onlinePopEl.innerHTML = `<div class="cb-pop"><div class="cb-pop-head"><b>${ICON.users} ${onlineTitle()}</b><button data-close>✕</button></div><div class="cb-pop-body">${onlineRowsHTML()}</div></div>`;
  }
  window.chatOnlinePopup = function () {
    if (!onlinePopEl) {
      onlinePopEl = document.createElement('div');
      onlinePopEl.className = 'cb-online-ov';
      onlinePopEl.addEventListener('click', ev => {
        if (ev.target === onlinePopEl || ev.target.closest('[data-close]')) onlinePopEl.classList.remove('show');
      });
      document.body.appendChild(onlinePopEl);
    }
    paintOnlinePop();
    onlinePopEl.classList.add('show');
  };
  window.chatOnlineCount = () => (onlineKnown ? online.length : 0);
  const navOn = document.getElementById('nav-online');
  if (navOn) navOn.addEventListener('click', () => window.chatOnlinePopup());

  function paintPopup() {
    const host = $('#cb-pop'); if (!host) return;
    if (!popup) { host.innerHTML = ''; return; }
    let title, body;
    if (popup === 'online') {
      title = `${ICON.users} ${onlineTitle()}`;
      body = onlineRowsHTML();
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
      msgs = j.messages || []; pinned = j.pinned || []; if (j.online) { online = j.online; onlineKnown = true; }
      if (j.reactions?.length) rxList = j.reactions;
      hasMore = !!j.hasMore; loaded = true; stick = true;
      initRead();
    } catch (e) { loadErr = 'Could not load chat. ' + e.message; }
    loading = false;
    paintList(); paintPopup();
    if (loaded) {
      if (isOpen()) markRead(); else paintBadge();
    }
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
    // Host-only slash-style commands (typed as ".command"). They are never posted as messages.
    if (isHost() && /^\.delete(\s|$)/i.test(text)) { runDelete(text, inp); return; }
    inp.value = ''; draft = ''; autosize(inp); updateSend();
    try { inp.focus({ preventScroll: true }); } catch { }   // keep the keyboard open after sending
    try {
      const j = await api('/messages', { method: 'POST', body: { text } });
      if (j.message && !msgs.some(m => m.id === j.message.id)) msgs.push(j.message);
      stick = true; paintList();
    } catch (e) { toast(e.message); inp.value = text; draft = text; autosize(inp); updateSend(); }
  }

  /* ── host command:  .delete <amount>  →  removes the latest <amount> messages ── */
  const MAX_PURGE = 200;
  async function runDelete(text, inp) {
    const m = text.match(/^\.delete\s+(\d+)$/i);
    const n = m ? parseInt(m[1], 10) : 0;
    if (!m || n < 1) { toast('Usage: .delete <amount>   e.g. .delete 10', 'neutral'); return; }
    if (n > MAX_PURGE) { toast(`You can delete at most ${MAX_PURGE} messages at a time.`, 'neutral'); return; }
    inp.value = ''; draft = ''; autosize(inp); updateSend();
    try { inp.focus({ preventScroll: true }); } catch { }
    try {
      const j = await api('/purge', { method: 'POST', body: { amount: n } });
      const gone = new Set(j.ids || []);
      msgs = msgs.filter(x => !gone.has(x.id)); pinned = pinned.filter(x => !gone.has(x.id));
      actionsFor = null; menuFor = null; pickerFor = null; stick = true;
      paintList(); paintBadge();
      toast(j.deleted ? `Deleted ${j.deleted} message${j.deleted === 1 ? '' : 's'}` : 'No messages to delete', j.deleted ? 'good' : 'neutral');
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
      // Disconnected: we no longer know who is online — don't show a stale list.
      online = []; onlineKnown = false; paintCounts(); if (popup === 'online') paintPopup();
      if (closed || e.code === 4001) return;
      clearTimeout(wsTimer); wsTimer = setTimeout(() => { connect(); if (loaded) refreshQuiet(); }, 3000);
    };
    ws.onerror = () => { };
  }

  async function refreshQuiet() {
    try {
      const j = await api('/messages');
      msgs = j.messages || []; pinned = j.pinned || []; hasMore = !!j.hasMore;
      if (j.online) { online = j.online; onlineKnown = true; }
      paintList();
      if (isOpen()) markRead(); else paintBadge(true);
    } catch { }
  }

  function handle(d) {
    const list = $('#cb-list');
    const atBottom = list ? (list.scrollHeight - list.scrollTop - list.clientHeight < 80) : true;
    if (d.type === 'presence') { online = d.users || []; onlineKnown = true; paintCounts(); if (popup === 'online') paintPopup(); return; }
    if (!loaded) return;
    if (d.type === 'msg_new') {
      if (msgs.some(m => m.id === d.message.id)) return;
      msgs.push(d.message);
      stick = atBottom || String(d.message.userId) === myId();
      paintList();
      if (!stick) { const j = $('#cb-jump'); if (j) j.style.display = 'flex'; }
      if (isOpen()) markRead();
      else if (String(d.message.userId) !== myId()) paintBadge(true);
    } else if (d.type === 'msg_edit') {
      const i = msgs.findIndex(m => m.id === d.message.id); if (i >= 0) msgs[i] = d.message;
      const p = pinned.findIndex(m => m.id === d.message.id); if (p >= 0) pinned[p] = d.message;
      stick = false; paintList();
    } else if (d.type === 'msg_delete') {
      msgs = msgs.filter(m => m.id !== d.id); pinned = pinned.filter(m => m.id !== d.id);
      stick = false; paintList(); if (popup === 'pins') paintPopup();
      paintBadge();
    } else if (d.type === 'msg_purge') {
      const gone = new Set(d.ids || []);
      msgs = msgs.filter(m => !gone.has(m.id)); pinned = pinned.filter(m => !gone.has(m.id));
      if (actionsFor && gone.has(actionsFor)) { actionsFor = null; pickerFor = null; }
      if (menuFor && gone.has(menuFor)) menuFor = null;
      stick = false; paintList(); if (popup === 'pins') paintPopup();
      paintBadge();
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
    const clearSel = () => {
      if (!actionsFor && !menuFor && !pickerFor) return;
      actionsFor = null; menuFor = null; pickerFor = null; stick = false; paintList();
    };
    el.addEventListener('click', async ev => {
      const t = ev.target.closest('[data-cb]');
      if (!t) {
        // Tap a message to select it (shows the reaction bar); tap it again or tap anywhere else to unselect.
        const m = ev.target.closest('.cb-msg');
        if (!m) { clearSel(); return; }
        if (ev.target.closest('a, textarea, .cb-menu, .cb-actions')) return;
        if (editingId === m.dataset.mid) return;
        if (String(window.getSelection && window.getSelection()) !== '') return;   // user is selecting text
        actionsFor = actionsFor === m.dataset.mid ? null : m.dataset.mid; menuFor = null; pickerFor = null;
        stick = false; paintList();
        return;
      }
      const a = t.dataset.cb, id = t.dataset.id;
      if (a === 'popbg') { if (ev.target === t) { popup = null; paintPopup(); } return; }
      ev.stopPropagation();
      try {
        if (a === 'online' || a === 'pins') { popup = popup === (a === 'pins' ? 'pins' : 'online') ? null : (a === 'pins' ? 'pins' : 'online'); paintPopup(); }
        else if (a === 'popclose') { popup = null; paintPopup(); }
        else if (a === 'back') { if (typeof doBack === 'function') doBack(); }
        else if (a === 'more') loadOlder();
        else if (a === 'retry') { loaded = false; load(); }
        else if (a === 'dots') { menuFor = menuFor === id ? null : id; actionsFor = id; pickerFor = null; stick = false; paintList(); }
        else if (a === 'rxopen') { pickerFor = pickerFor === id ? null : id; actionsFor = id; menuFor = null; stick = false; paintList(); }
        else if (a === 'react') {
          // Close the emoji menu straight away (message stays selected, so only the reaction icon remains);
          // the live update then re-paints the row with the new reaction.
          pickerFor = null; stick = false; paintList();
          await api(`/messages/${id}/react`, { method: 'POST', body: { emoji: t.dataset.emoji } });
        }
        else if (a === 'edit') { editingId = id; menuFor = null; actionsFor = null; pickerFor = null; stick = false; paintList(); }
        else if (a === 'edit-cancel') { editingId = null; stick = false; paintList(); }
        else if (a === 'edit-save') saveEdit(id);
        else if (a === 'del') { menuFor = null; actionsFor = null; pickerFor = null; stick = false; paintList(); if (confirm('Delete this message?')) await api(`/messages/${id}`, { method: 'DELETE' }); }
        else if (a === 'pin') { menuFor = null; pickerFor = null; stick = false; paintList(); const m = msgs.find(x => x.id === id); await api(`/messages/${id}/pin`, { method: 'POST', body: { pinned: !m?.pinned } }); }
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
      if (ev.key === 'Escape' && (actionsFor || menuFor || pickerFor) && !ev.target.matches('[data-edit-ta]')) { clearSel(); return; }
      if (ev.target.id === 'cb-input' && ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); send(); }
      else if (ev.target.matches('[data-edit-ta]')) {
        if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); saveEdit(ev.target.dataset.editTa); }
        else if (ev.key === 'Escape') { editingId = null; stick = false; paintList(); }
      }
    });

    el.addEventListener('click', ev => { if (ev.target.closest('#cb-send')) send(); if (ev.target.closest('#cb-jump')) { stick = true; paintList(); ev.target.closest('#cb-jump').style.display = 'none'; } });

    // Esc anywhere unselects the message (and closes its menu)
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && el && el.isConnected && (actionsFor || menuFor || pickerFor) && !(ev.target.matches && ev.target.matches('[data-edit-ta]'))) clearSel(); });

    // Tapping Send must not steal focus from the textarea (that is what closes the mobile keyboard).
    el.addEventListener('mousedown', ev => { if (ev.target.closest('#cb-send')) ev.preventDefault(); });
    // When the keyboard opens, re-fit the window to the visible area a few times while it animates.
    el.addEventListener('focusin', ev => {
      if (ev.target.id === 'cb-input') [0, 80, 250, 500].forEach(d => setTimeout(fit, d));
    });
    el.addEventListener('focusout', ev => {
      if (ev.target.id === 'cb-input') [0, 250].forEach(d => setTimeout(fit, d));
    });

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

  /* ── unread tracking ── */
  const readKey = () => 'cb_read_' + myId();
  const ts = m => new Date(m.createdAt).getTime();
  function initRead() {
    let v = null;
    try { v = localStorage.getItem(readKey()); } catch { }
    if (v !== null && v !== '' && !isNaN(+v)) { readTs = +v; return; }
    // First time on this device: start from "everything seen" so a new user isn't shown 50 unread.
    readTs = msgs.length ? Math.max(...msgs.map(ts)) : 0;
    try { localStorage.setItem(readKey(), String(readTs)); } catch { }
  }
  function unreadCount() {
    if (readTs === null) return 0;
    return msgs.filter(m => String(m.userId) !== myId() && ts(m) > readTs).length;
  }
  function unreadLabel() {
    const n = unreadCount(); if (!n) return '';
    const more = hasMore && msgs.length && ts(msgs[0]) > readTs;   // older unread messages not loaded
    return n > 99 ? '99+' : n + (more ? '+' : '');
  }
  const isOpen = () => !!(el && el.isConnected && el.closest('#chat-page')) && document.visibilityState === 'visible';

  function markRead() {
    if (msgs.length) {
      const latest = Math.max(...msgs.map(ts));
      if (readTs === null || latest > readTs) {
        readTs = latest;
        try { localStorage.setItem(readKey(), String(latest)); } catch { }
      }
    }
    paintBadge();
  }

  // Badge on the Home screen's #Chatbox button
  function paintBadge(bump) {
    const label = unreadLabel();
    document.querySelectorAll('.chat-unread').forEach(b => {
      b.textContent = label;
      b.style.display = label ? '' : 'none';
      if (bump && label) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    });
  }

  /* ── keyboard-aware sizing ──
     The chat window is sized to the *visual* viewport, so when the on-screen keyboard
     opens, the composer sits directly above it (iOS Safari and Android Chrome). */
  let fitRaf = 0;
  function fit() {
    const page = document.getElementById('chat-page');
    const root = document.documentElement;
    if (!page) { root.classList.remove('chat-open'); return; }
    root.classList.add('chat-open');
    const vv = window.visualViewport;
    const h = vv ? vv.height : window.innerHeight;
    const top = vv ? vv.offsetTop : 0;
    page.style.setProperty('--vvh', Math.round(h) + 'px');
    page.style.setProperty('--vvt', Math.round(top) + 'px');
    page.classList.toggle('kb-open', window.innerHeight - h > 100);
    const list = $('#cb-list'); if (list && stick) list.scrollTop = list.scrollHeight;
  }
  function scheduleFit() { if (fitRaf) return; fitRaf = requestAnimationFrame(() => { fitRaf = 0; fit(); }); }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleFit);
    window.visualViewport.addEventListener('scroll', scheduleFit);
  }
  window.addEventListener('resize', scheduleFit);
  window.addEventListener('orientationchange', scheduleFit);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && isOpen()) markRead(); });

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
    document.documentElement.classList.remove('chat-open');
    if (el && el.parentNode && el.parentNode.id !== 'cb-parking') {
      let park = document.getElementById('cb-parking');
      if (!park) { park = document.createElement('div'); park.id = 'cb-parking'; park.style.display = 'none'; document.body.appendChild(park); }
      park.appendChild(el);
    }
  };

  window.chatMount = function () {
    if (typeof authToken === 'undefined' || !authToken || !me()) return;
    closed = false;
    ensure();
    // Runs on every screen so the socket stays up and the unread badge stays current.
    const slot = document.getElementById('chatbox-slot');
    if (slot && el.parentNode !== slot) slot.appendChild(el);
    if (!loaded && !loading) load();
    else if (slot) paintList();
    connect();
    paintBadge();
    if (slot) {
      stick = true; popup = null; paintPopup();
      autosize($('#cb-input'));
      fit(); markRead();
      const list = $('#cb-list'); if (list) list.scrollTop = list.scrollHeight;
    }
  };

  // Keep the presence socket up on every screen, even if a render path never calls chatMount().
  setInterval(() => {
    try { if (!closed && typeof authToken !== 'undefined' && authToken && me() && !ws) connect(); } catch { }
  }, 5000);

  window.chatUnreadLabel = unreadLabel;

  window.chatReset = function () {
    closed = true; clearTimeout(wsTimer);
    if (onlinePopEl) onlinePopEl.classList.remove('show');
    try { ws && ws.close(); } catch { }
    ws = null; wsToken = null;
    msgs = []; pinned = []; online = []; onlineKnown = false; hasMore = false; loaded = false; loading = false; loadErr = '';
    popup = null; menuFor = null; pickerFor = null; editingId = null; actionsFor = null; draft = ''; stick = true;
    readTs = null;
    paintCounts();
    document.documentElement.classList.remove('chat-open');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = null;
  };
})();
