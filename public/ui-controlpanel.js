/* ══════════════════════════════════════
   CONTROL PANEL (host only — between nav and home tabs)
══════════════════════════════════════ */
function controlPanelHTML(){
  const jrBadge=joinRequests.length?`<span class="req-badge">${joinRequests.length}</span>`:'';
  const urBadge=updateRequests.length?`<span class="req-badge">${updateRequests.length}</span>`:'';

  // Join Requests box
  const jrRows=joinRequests.length
    ?joinRequests.map(r=>`
      <div class="req-item">
        <div class="req-item-info">
          <div class="req-item-name">${esc(r.name)}</div>
          <div class="req-item-sub">${esc(r.email)}${r.username?' · @'+esc(r.username):''}</div>
        </div>
        <div class="req-actions">
          <button class="btn btn-good btn-sm" style="padding:3px 9px;font-size:.7rem" data-jr-approve="${r.id}">✓</button>
          <button class="btn btn-bad btn-sm" style="padding:3px 9px;font-size:.7rem" data-jr-reject="${r.id}">✕</button>
        </div>
      </div>`).join('')
    :`<div class="req-empty">No pending join requests</div>`;

  // Update Requests box
  const urRows=updateRequests.length
    ?updateRequests.map(r=>`
      <div class="req-item">
        <div class="req-item-info">
          <div class="req-item-name">${esc(r.userName)} <span style="font-size:.68rem;font-weight:400;color:var(--mid)">wants to change ${r.type}</span></div>
          <div class="req-item-sub">→ <strong>${esc(r.newValue)}</strong></div>
        </div>
        <div class="req-actions">
          <button class="btn btn-good btn-sm" style="padding:3px 9px;font-size:.7rem" data-ur-approve="${r.id}">✓</button>
          <button class="btn btn-bad btn-sm" style="padding:3px 9px;font-size:.7rem" data-ur-reject="${r.id}">✕</button>
        </div>
      </div>`).join('')
    :`<div class="req-empty">No pending update requests</div>`;

  return `<div class="ctrl-panel">
    <div class="ctrl-panel-head">
      <span class="ctrl-panel-title">⚙️ Control Panel</span>
      <button class="btn btn-ghost btn-sm" id="btn-cp-refresh" style="font-size:.7rem;padding:3px 9px">↻ Refresh</button>
    </div>

    <!-- Box-button row -->
    <div class="cp-btn-row">
      <button class="cp-btn" id="cpbtn-join" onclick="cpToggle('join')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
        <span class="cp-btn-label">Join Requests</span>
        ${joinRequests.length?`<span class="cp-btn-badge">${joinRequests.length}</span>`:''}
      </button>
      <button class="cp-btn" id="cpbtn-update" onclick="cpToggle('update')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        <span class="cp-btn-label">Update Requests</span>
        ${updateRequests.length?`<span class="cp-btn-badge">${updateRequests.length}</span>`:''}
      </button>
      <button class="cp-btn" id="cpbtn-notice" onclick="cpToggle('notice')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span class="cp-btn-label">Global Notice</span>
        ${hostNotice?'<span class="cp-btn-active">ON</span>':''}
      </button>
      <button class="cp-btn" id="cpbtn-users" onclick="cpToggle('users')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span class="cp-btn-label">Registered Users</span>
        ${registeredUsers.length?('<span style="position:absolute;bottom:4px;right:5px;font-size:.52rem;color:#9ca3af;font-weight:600">'+registeredUsers.length+'</span>'):''}
      </button>
    </div>

    <!-- Expandable panels -->
    <div class="cp-panel" id="cppanel-join">
      <div class="cp-panel-head">
        <span class="cp-panel-title">Join Requests</span>
        ${joinRequests.length?`<span class="req-badge">${joinRequests.length}</span>`:''}
      </div>
      <div style="max-height:200px;overflow-y:auto">${jrRows}</div>
    </div>

    <div class="cp-panel" id="cppanel-update">
      <div class="cp-panel-head">
        <span class="cp-panel-title">Update Requests</span>
        ${updateRequests.length?`<span class="req-badge">${updateRequests.length}</span>`:''}
      </div>
      <div style="max-height:200px;overflow-y:auto">${urRows}</div>
    </div>

    <div class="cp-panel" id="cppanel-notice">
      <div class="cp-panel-head">
        <span class="cp-panel-title">Global Notice</span>
        <span style="font-size:.68rem;color:var(--mid)">Broadcasts to all students</span>
      </div>
      <div class="notice-board-body">
        <textarea id="notice-input" placeholder="Type a notice for students…" maxlength="500">${esc(hostNotice)}</textarea>
        <button class="btn btn-dark btn-sm" id="btn-notice-post" style="flex-shrink:0;padding:8px 14px">Post</button>
      </div>
    </div>

    <div class="cp-panel" id="cppanel-users">
      <div class="cp-panel-head">
        <span class="cp-panel-title">Registered Users</span>
        <span style="font-size:.68rem;color:var(--mid)">${registeredUsers.length} account${registeredUsers.length===1?'':'s'}</span>
      </div>
      <div style="max-height:260px;overflow-y:auto">
        ${registeredUsers.length ? registeredUsers.map(u=>`
          <div class="user-inspect-row" onclick="openInspect('${u.id}')">
            <div class="user-inspect-info">
              <div class="user-inspect-name">
                <span class="name">${esc(u.name)}</span>
                <span class="user-role-pill" style="background:${u.role==='host'?'#7c3aed':'#0ea5e9'}">${u.role}</span>
              </div>
              <div class="user-inspect-sub">${esc(u.email)}${u.username?' · @'+esc(u.username):''}</div>
            </div>
            <svg style="flex-shrink:0;color:var(--mid)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,18 15,12 9,6"/></svg>
          </div>`).join('')
        : '<div class="req-empty">No registered users</div>'}
      </div>
    </div>
  </div>`;
}
