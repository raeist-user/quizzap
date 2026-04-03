/* ══════════════════════════════════════
   HOST PASSWORD
══════════════════════════════════════ */
function hostPassHTML(){
  return `<div class="center"><div class="box">
    <h2 class="mb1">Host Interface</h2>
    <p class="muted mb3">Enter the host password to continue.</p>
    <input type="password" id="pw-in" placeholder="Password" maxlength="20" autocomplete="off" class="form-input"/>
    <p id="pw-err" style="color:var(--bad);font-size:.8rem;min-height:1.2em;margin-top:5px"></p>
    <div class="row gap2 mt2">
      <button class="btn btn-ghost btn-sm" id="btn-pw-back">← Back</button>
      <button class="btn btn-dark" id="btn-pw-ok" style="flex:1">Enter →</button>
    </div>
  </div></div>`;
}

/* ══════════════════════════════════════
   HALT CONFIRMATION OVERLAY (host)
══════════════════════════════════════ */
function haltBombOverlayHTML(){
  if(!showingHaltBomb) return '';
  return `<div id="halt-bomb-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:800;backdrop-filter:blur(3px)">
    <div style="text-align:center;user-select:none">
      <div id="bomb-emoji" style="font-size:5rem;line-height:1;animation:bombDrop .5s cubic-bezier(.34,1.56,.64,1) both,bombWobble .35s ease-in-out .55s 4 alternate;display:inline-block">💣</div>
      <div id="blast-rings-wrap" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none"></div>
      <div style="margin-top:18px;color:rgba(255,255,255,.7);font-size:.85rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase" id="bomb-label">${showingHaltMenu?'Halting session…':'Ending session…'}</div>
    </div>
  </div>`;
}

function dismissBombOverlayHTML(){
  if(!showingDismissBomb) return '';
  return `<div id="dismiss-bomb-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;z-index:810;backdrop-filter:blur(4px)">
    <div style="text-align:center;user-select:none;position:relative">
      <div id="dismiss-bomb-emoji" style="font-size:6rem;line-height:1;animation:bombDrop .5s cubic-bezier(.34,1.56,.64,1) both,bombWobble .3s ease-in-out .6s 5 alternate;display:inline-block">💣</div>
      <div id="dismiss-blast-rings-wrap" style="position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);pointer-events:none"></div>
      <div style="margin-top:20px;color:rgba(255,255,255,.85);font-size:1rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase" id="dismiss-bomb-label">Sending students home…</div>
      <div style="margin-top:6px;color:rgba(255,255,255,.45);font-size:.72rem">Session shutting down</div>
    </div>
  </div>`;
}


function haltMenuOverlayHTML(){
  if(!showingHaltMenu) return '';
  return `<div style="position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;z-index:500;backdrop-filter:blur(2px)">
    <div style="background:var(--white);border-radius:18px 18px 0 0;width:100%;max-width:480px;display:flex;flex-direction:column;animation:slideUp .22s ease">
      <div style="padding:16px 20px 12px;border-bottom:1px solid var(--line);flex-shrink:0;text-align:center">
        <div style="width:36px;height:4px;background:var(--line);border-radius:2px;margin:0 auto 14px"></div>
        <div style="font-size:1.6rem;margin-bottom:4px">⏸</div>
        <div style="font-size:1rem;font-weight:600;margin-bottom:2px">Session Halted</div>
        <p class="muted small">Students are on pause. What next?</p>
      </div>
      <div style="padding:14px 16px 24px;display:flex;flex-direction:column;gap:10px;flex-shrink:0">
        <button class="btn btn-lg" id="btn-new-session" style="justify-content:center;gap:8px;background:#1a56db;color:#fff;border-color:#1a56db">
          🔄 New Session <span style="opacity:.75;font-weight:400;font-size:.78rem">· resets scores to 0</span>
        </button>
        <button class="btn btn-lg" id="btn-restore-backup" style="justify-content:center;gap:8px;background:#0e7a5a;color:#fff;border-color:#0e7a5a">
          📥 Restore Today's Scores <span style="opacity:.75;font-weight:400;font-size:.78rem">· recover after glitch</span>
        </button>
        <button class="btn btn-lg" id="btn-stop-dismiss" style="justify-content:center;gap:8px;background:#be123c;color:#fff;border-color:#be123c">
          ⏹ Stop &amp; Dismiss Students
        </button>
        <button class="btn btn-ghost btn-sm" id="btn-halt-cancel" style="justify-content:center;margin-top:2px">Cancel — keep session going</button>
      </div>
    </div>
  </div>`;
}

function backupRestoreOverlayHTML(){
  if(!showingBackupOverlay) return '';
  const { list, loading, error, restoredMsg } = backupOverlayState;
  const medals = ['🥇','🥈','🥉'];
  const rows = loading
    ? `<div style="padding:28px;text-align:center;color:var(--mid)"><div style="width:22px;height:22px;border:2.5px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;display:inline-block"></div><div style="margin-top:8px;font-size:.8rem">Loading backup…</div></div>`
    : error
      ? `<div style="padding:20px;text-align:center;color:var(--bad);font-size:.85rem">${esc(error)}</div>`
      : !list.length
        ? `<div style="padding:20px;text-align:center;color:var(--mid);font-size:.85rem">No backup found for today's window (5 AM–5 AM IST).</div>`
        : list.map((p,i)=>`
          <div style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--line)">
            <div style="min-width:26px;text-align:center;font-size:${i<3?'1rem':'.78rem'};color:var(--mid)">${medals[i]||('#'+(i+1))}</div>
            <div style="flex:1;font-weight:${i<3?'700':'500'};font-size:.87rem;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(p.name)}</div>
            <div style="text-align:right;min-width:64px">
              <span style="font-weight:700;font-size:.9rem">${p.totalScore||0}</span>
              <span style="font-size:.67rem;color:var(--mid);display:block">total</span>
            </div>
          </div>`).join('');
  const actionBtn = restoredMsg
    ? `<div style="padding:12px 16px;background:#d4f5e8;color:#0e7a5a;border-radius:8px;font-size:.84rem;font-weight:600;text-align:center">${esc(restoredMsg)}</div>`
    : `<button class="btn btn-good btn-lg" id="btn-confirm-restore" style="justify-content:center" ${loading||error||!list.length?'disabled':''}>📥 Import & Restore These Scores</button>`;
  return `<div style="position:fixed;inset:0;background:rgba(0,0,0,.62);display:flex;align-items:flex-end;justify-content:center;z-index:700;backdrop-filter:blur(3px)">
    <div style="background:var(--white);border-radius:20px 20px 0 0;width:100%;max-width:500px;max-height:86vh;display:flex;flex-direction:column;animation:slideUp .22s ease">
      <div style="padding:16px 20px 12px;border-bottom:1px solid var(--line);flex-shrink:0;text-align:center">
        <div style="width:36px;height:4px;background:var(--line);border-radius:2px;margin:0 auto 12px"></div>
        <div style="font-size:1.5rem;margin-bottom:4px">📥</div>
        <div style="font-size:1rem;font-weight:700">Restore Today's Session Backup</div>
        <p style="font-size:.76rem;color:var(--mid);margin-top:3px">Scores saved up to the last revealed question · 5 AM–5 AM IST window</p>
      </div>
      <div style="overflow-y:auto;flex:1">${rows}</div>
      <div style="padding:14px 16px 28px;display:flex;flex-direction:column;gap:8px;flex-shrink:0;border-top:1px solid var(--line)">
        ${actionBtn}
        <button class="btn btn-ghost btn-sm" id="btn-close-backup-overlay" style="justify-content:center">Close</button>
      </div>
    </div>
  </div>`;
}


function hostFinalLeaderboardHTML(){
  if(!hostShutdownLeaderboard) return '';
  const entries=hostShutdownLeaderboard;
  const medals=['🥇','🥈','🥉'];
  const totalQ=hostShutdownLeaderboard._totalQ||0;
  const totalQStr=totalQ>0?String(totalQ):'?';
  const rows=entries.length
    ?entries.map((e,i)=>`
      <div style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--line);animation:rowIn .18s ease both;animation-delay:${i*30}ms">
        <div style="min-width:28px;text-align:center;font-size:${i<3?'1.1rem':'.78rem'};color:var(--mid)">${medals[i]||('#'+(i+1))}</div>
        <div style="flex:1;font-weight:${i<3?'700':'500'};font-size:.88rem;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(e.name)}</div>
        <div style="font-weight:700;font-size:.9rem">${e.score||0}<span style="font-size:.68rem;color:var(--mid);font-weight:400"> /${totalQStr}</span></div>
      </div>`).join('')
    :`<div style="padding:24px;text-align:center;color:var(--mid)">No scores to display.</div>`;
  return `<div style="position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;z-index:600;backdrop-filter:blur(3px)">
    <div style="background:var(--white);border-radius:20px 20px 0 0;width:100%;max-width:520px;max-height:88vh;display:flex;flex-direction:column;animation:slideUp .25s ease">
      <div style="padding:16px 20px 14px;border-bottom:1px solid var(--line);flex-shrink:0;text-align:center">
        <div style="width:36px;height:4px;background:var(--line);border-radius:2px;margin:0 auto 14px"></div>
        <div style="font-size:2rem;margin-bottom:6px">🏆</div>
        <div style="font-size:1.05rem;font-weight:700;margin-bottom:3px">Final Leaderboard</div>
        <p style="font-size:.78rem;color:var(--mid)">${entries.length} student${entries.length!==1?'s':''} &nbsp;·&nbsp; ${totalQStr} question${totalQ!==1?'s':''}</p>
      </div>
      <div style="overflow-y:auto;flex:1">${rows}</div>
      <div style="padding:14px 16px 24px;flex-shrink:0;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-good" id="btn-host-lb-export" style="width:100%;justify-content:center;gap:8px">
          📤 Export as CSV
        </button>
        <button class="btn btn-dark" id="btn-host-lb-close" style="width:100%;justify-content:center;gap:8px">
          ← Back to Host Menu
        </button>
      </div>
    </div>
  </div>`;
}

function schedOverlayHTML(){
  if(!sidebarSchedOpen) return '';
  const upcoming=hostSchedules.filter(s=>s.ts>Date.now()-3600000);
  const schedRows=upcoming.length
    ?upcoming.map(s=>{
      const d=new Date(s.ts);
      return `<div class="sched-card" style="margin-bottom:6px;padding:8px 10px">
        <div class="sched-date-blk" style="min-width:36px;padding:4px 7px"><div class="sched-day" style="font-size:.95rem">${d.getDate()}</div><div class="sched-mon">${d.toLocaleString('en',{month:'short'})}</div></div>
        <div class="sched-info">
          <div class="sched-title" style="font-size:.8rem">${esc(s.title)}</div>
          <div class="sched-meta">${d.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}${s.notes?' · '+esc(s.notes):''}</div>
          <div class="sched-cd">${cdStr(s.ts)}</div>
        </div>
        <span class="sched-del" data-sdel="${s._id}">✕</span>
      </div>`;
    }).join('')
    :'<p class="muted small" style="padding:4px 0 10px">No upcoming sessions.</p>';
  return `<div id="sched-overlay" style="position:absolute;bottom:0;left:0;right:0;background:var(--white);border-top:2px solid var(--line);border-radius:12px 12px 0 0;padding:16px;z-index:300;max-height:70%;overflow-y:auto;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <span style="font-weight:700;font-size:.9rem">📅 Schedule</span>
      <button class="btn btn-ghost btn-sm" id="btn-sched-close">✕</button>
    </div>
    ${schedRows}
    <hr/>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
      <input class="form-input" id="sched-title" placeholder="Session title" maxlength="60" style="font-size:.82rem;padding:8px 10px"/>
      <input class="form-input" type="datetime-local" id="sched-dt" style="font-size:.82rem;padding:8px 10px"/>
      <input class="form-input" id="sched-notes" placeholder="Notes (optional)" maxlength="100" style="font-size:.82rem;padding:8px 10px"/>
      <button class="btn btn-dark btn-sm btn-full" id="btn-sched-add">+ Add to schedule</button>
      <div class="form-msg" id="sched-msg"></div>
    </div>
  </div>`;
}

function standingsOverlayHTML(){
  if(!showStandingsOverlay) return '';
  const snaps  = S.sessionSnapshots || [];
  const gcores = S.gameScores || [];       // [{id,name,total}] cumulative
  const parts  = S.participants || [];
  const medals = ['🥇','🥈','🥉'];

  // Build a master list of all known students (union of all sessions + current)
  const nameMap = {};
  snaps.forEach(sn => sn.scores.forEach(s => { nameMap[s.id] = s.name; }));
  parts.forEach(p => { nameMap[p.id] = p.name; });
  gcores.forEach(g => { nameMap[g.id] = g.name; });

  // For cumulative total use gameScores (already banked past sessions)
  // Add current live session scores on top
  const liveScoreMap = {};
  parts.forEach(p => { liveScoreMap[p.id] = p.score || 0; });

  const totalMap = {};
  gcores.forEach(g => { totalMap[g.id] = (g.total || 0); });
  // Add current session live scores (not yet banked)
  parts.forEach(p => { totalMap[p.id] = (totalMap[p.id]||0) + (p.score||0); });

  // Sort students by grand total descending
  const allIds = Object.keys(nameMap);
  allIds.sort((a,b)=>(totalMap[b]||0)-(totalMap[a]||0));

  const numSessions = snaps.length;
  const currentSessionNum = numSessions + 1;
  const hasCurrentSession = parts.length > 0;

  if(allIds.length === 0){
    return `<div class="standings-overlay">
      <div class="standings-overlay-head">
        <span style="font-weight:700;font-size:.95rem">📊 Current Standings</span>
        <button class="btn btn-ghost btn-sm" id="btn-standings-close">✕ Close</button>
      </div>
      <div style="padding:40px;text-align:center;color:var(--mid)">No data yet</div>
    </div>`;
  }

  // Header row: Name | S1 | S2 | … | Current | Total
  let thCells = `<th>Student</th>`;
  snaps.forEach((sn,i) => { thCells += `<th>${i+1}</th>`; });
  if(hasCurrentSession){ thCells += `<th>${currentSessionNum}</th>`; }
  thCells += `<th class="total-col">∑</th>`;

  // Data rows
  const rows = allIds.map((id,i) => {
    const name = nameMap[id] || '—';
    let tds = `<td><span style="min-width:20px;display:inline-block;text-align:center;font-size:.72rem;color:var(--mid)">${medals[i]||'#'+(i+1)}</span> ${esc(name)}</td>`;
    snaps.forEach(sn => {
      const entry = sn.scores.find(s=>s.id===id);
      const pts = entry ? entry.score : null;
      tds += pts===null
        ? `<td class="zero">—</td>`
        : `<td>${pts}</td>`;
    });
    if(hasCurrentSession){
      const pts = liveScoreMap[id];
      tds += pts===undefined
        ? `<td class="zero">—</td>`
        : `<td>${pts}</td>`;
    }
    const grand = totalMap[id] || 0;
    tds += `<td class="total-col">${grand}</td>`;
    return `<tr>${tds}</tr>`;
  }).join('');

  // Session separator legend below table
  const sessionCount = numSessions + (hasCurrentSession?1:0);

  return `<div class="standings-overlay">
    <div class="standings-overlay-head">
      <div>
        <span style="font-weight:700;font-size:.95rem">📊 Current Standings</span>
        <span style="margin-left:10px;font-size:.75rem;color:var(--mid)">${allIds.length} students · ${sessionCount} session${sessionCount!==1?'s':''}</span>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-standings-close">✕ Close</button>
    </div>
    <div class="standings-overlay-body">
      <table class="standings-tbl">
        <thead><tr>${thCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}


function manageOverlayHTML(){
  if(!folderManageSubject) return '';
  // Set manageFolder to match overlay subject so existing editor logic works
  const fName=folderManageSubject;

  // File list
  const fileRows=manageFolderFiles.length
    ?manageFolderFiles.map(f=>`
      <div class="mfile-row${manageFile===f.name?' editing':''}">
        <span style="flex:1;font-size:.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${manageFile===f.name?'var(--accent)':'var(--ink)'};font-weight:${manageFile===f.name?'600':'400'}">${esc(f.name)}</span>
        <button class="btn btn-ghost btn-sm" style="padding:2px 9px;font-size:.7rem;flex-shrink:0;${manageFile===f.name?'background:#e0edff;border-color:var(--accent);color:var(--accent)':''}" data-file-edit="${esc(f.name)}">${manageFile===f.name?'✎ Editing':'Edit'}</button>
        <button class="btn btn-sm" style="padding:2px 7px;flex-shrink:0;background:#fff1f2;border-color:#fecdd3;color:#be123c;font-size:.68rem" data-file-del="${esc(f.name)}" title="Delete">✕</button>
      </div>`).join('')
    :(manageFolderFiles.length===0&&manageFile===null
      ?`<div style="padding:12px;text-align:center;color:var(--mid);font-size:.78rem;background:var(--faint);border-radius:7px">No .txt files yet — create one below</div>`
      :'');

  // Inline editor (when a file is open)
  const editorBlock=manageEditMode?`
    <div style="border:1.5px solid var(--ink);border-radius:9px;overflow:hidden;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;gap:6px;padding:7px 10px;background:var(--ink);color:#fff;flex-shrink:0">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <span style="font-size:.75rem;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${esc(fName)} / ${manageEditMode==='new'
            ?`<input id="new-file-name-editor" placeholder="chapter1.txt" maxlength="60"
                style="background:rgba(255,255,255,.18);border:none;border-bottom:1px solid rgba(255,255,255,.5);color:#fff;font-size:.75rem;font-weight:600;padding:1px 5px;outline:none;width:120px;border-radius:3px"
                value="${esc(manageNewFileName)}"/>`
            :`<span style="opacity:.85">${esc(manageFile||'')}</span>`}
        </span>
        <button id="btn-editor-fullscreen" style="background:none;border:1px solid rgba(255,255,255,.3);color:#fff;padding:2px 7px;border-radius:4px;cursor:pointer;font-size:.68rem" title="${editorFullscreen?'Exit fullscreen':'Fullscreen'}">
          ${editorFullscreen
            ?`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>`
            :`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`}
        </button>
        <button id="btn-close-editor" style="background:none;border:1px solid rgba(255,255,255,.3);color:#fff;padding:2px 7px;border-radius:4px;cursor:pointer;font-size:.68rem">✕</button>
      </div>
      <div style="padding:3px 10px;background:#fafaf9;border-bottom:1px solid var(--line);font-size:.63rem;color:var(--mid);flex-shrink:0">
        <strong style="color:var(--ink)">Format:</strong> Question · <code style="background:#eee;padding:0 3px;border-radius:2px">(A)opt, (B)opt, (C)opt, (D)opt</code>
      </div>
      <textarea id="q-editor" style="width:100%;font-family:monospace;font-size:.76rem;resize:none;padding:10px 12px;border:none;outline:none;display:block;min-height:160px;box-sizing:border-box"
        placeholder="What is photosynthesis?&#10;(A)Making food from sunlight, (B)Breathing, (C)Digestion, (D)Transpiration">${esc(editingContent)}</textarea>
      <div style="display:flex;gap:6px;padding:6px 10px;background:#fafaf9;border-top:1px solid var(--line);align-items:center;flex-shrink:0">
        <button class="btn btn-good btn-sm" style="gap:4px;font-size:.75rem" id="btn-save-editor">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/></svg>Save to GitHub
        </button>
        <label class="btn btn-white btn-sm" style="cursor:pointer;gap:4px;font-size:.75rem">
          ↑ Upload .txt<input type="file" id="file-upload-inp" accept=".txt" style="display:none"/>
        </label>
      </div>
    </div>`:
    // Fullscreen editor (separate overlay)
    (editorFullscreen?`<div id="editor-fs-overlay" style="position:fixed;inset:0;z-index:900;background:#fff;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;gap:6px;padding:7px 10px;background:var(--ink);color:#fff;flex-shrink:0">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <span style="font-size:.75rem;font-weight:600;flex:1">${esc(fName)} / ${esc(manageFile||'')}</span>
        <button id="btn-editor-fullscreen" style="background:none;border:1px solid rgba(255,255,255,.3);color:#fff;padding:2px 7px;border-radius:4px;cursor:pointer;font-size:.68rem">⤡ Exit</button>
        <button id="btn-close-editor" style="background:none;border:1px solid rgba(255,255,255,.3);color:#fff;padding:2px 7px;border-radius:4px;cursor:pointer;font-size:.68rem">✕</button>
      </div>
      <textarea id="q-editor" style="flex:1;width:100%;font-family:monospace;font-size:.8rem;resize:none;padding:12px 14px;border:none;outline:none;display:block;box-sizing:border-box">${esc(editingContent)}</textarea>
      <div style="display:flex;gap:6px;padding:8px 10px;background:#fafaf9;border-top:1px solid var(--line);align-items:center;flex-shrink:0">
        <button class="btn btn-good btn-sm" id="btn-save-editor">Save to GitHub</button>
      </div>
    </div>`:'');

  return `<div class="manage-overlay-backdrop" id="manage-overlay-backdrop">
    <div class="manage-overlay-panel">
      <div class="manage-overlay-head">
        <span style="font-size:1.2rem">📁</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:.9rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(fName)}</div>
          <div style="font-size:.68rem;color:var(--mid)">${manageFolderFiles.length} file${manageFolderFiles.length!==1?'s':''}</div>
        </div>
        <button class="btn btn-ghost btn-sm" id="btn-manage-close" style="font-size:.75rem;flex-shrink:0">✕ Close</button>
      </div>
      <div class="manage-overlay-body">
        ${fileRows}
        ${editorBlock}
        ${!manageEditMode?`
        <div style="display:flex;gap:5px;margin-top:2px">
          <input class="form-input" id="new-file-name" placeholder="chapter.txt" maxlength="60" style="flex:1;font-size:.76rem;padding:5px 8px"/>
          <button class="btn btn-dark btn-sm" id="btn-create-file" style="font-size:.73rem;white-space:nowrap">+ New</button>
          <label class="btn btn-white btn-sm" style="cursor:pointer;font-size:.73rem;white-space:nowrap">
            ↑ Upload<input type="file" id="file-upload-inp" accept=".txt" style="display:none"/>
          </label>
        </div>`:''}
        <div id="upload-msg" style="font-size:.75rem">${uploadMsg}</div>
      </div>
      <div style="padding:8px 14px 22px;border-top:1px solid var(--line);flex-shrink:0">
        <button class="btn btn-sm btn-full" style="background:#fff1f2;color:#be123c;border-color:#fecdd3;font-size:.73rem;justify-content:center" id="btn-delete-folder">✕ Delete folder &amp; all files</button>
      </div>
    </div>
    ${editorFullscreen?editorBlock:''}
  </div>`;
}

function hostSettingsOverlayHTML(){
  if(!hostSettingsOpen) return '';
  return `<div class="host-settings-overlay" id="host-settings-overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts and settings">
    <div class="host-settings-panel">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
        <div>
          <div style="font-weight:700;font-size:1rem">⌨️ Keyboard Shortcuts</div>
          <div class="muted small mt1">Navigate the host panel without a mouse</div>
        </div>
        <button class="btn btn-ghost btn-sm" id="btn-settings-close" style="flex-shrink:0">✕ Close</button>
      </div>

      <div class="shortcut-section">Quiz Controls</div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">←</kbd><kbd class="kbd">→</kbd></div>
        <div class="shortcut-desc">Previous / next question</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">P</kbd></div>
        <div class="shortcut-desc">Push current question to students</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">R</kbd></div>
        <div class="shortcut-desc">Reveal the correct answer</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">N</kbd></div>
        <div class="shortcut-desc">Advance to next question (after reveal)</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">1</kbd>–<kbd class="kbd">4</kbd></div>
        <div class="shortcut-desc">Set answer key to option A – D</div>
      </div>

      <div class="shortcut-section">Tab Navigation</div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">Tab</kbd></div>
        <div class="shortcut-desc">Move focus to next control</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">⇧ Shift</kbd><kbd class="kbd">Tab</kbd></div>
        <div class="shortcut-desc">Move focus to previous control</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">Enter</kbd></div>
        <div class="shortcut-desc">Activate focused button or item</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">Space</kbd></div>
        <div class="shortcut-desc">Toggle checkbox or activate button</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">Esc</kbd></div>
        <div class="shortcut-desc">Close overlays and panels</div>
      </div>

      <div class="shortcut-section">Generate Tab — Subject Picker</div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">Tab</kbd></div>
        <div class="shortcut-desc">Focus each subject folder</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">Enter</kbd> / <kbd class="kbd">Space</kbd></div>
        <div class="shortcut-desc">Expand or collapse subject folder</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">↑</kbd> / <kbd class="kbd">↓</kbd></div>
        <div class="shortcut-desc">Move between subject folders</div>
      </div>

      <div class="shortcut-section">Answer Key Grid</div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">Tab</kbd></div>
        <div class="shortcut-desc">Focus each answer option</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">←</kbd><kbd class="kbd">→</kbd><kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd></div>
        <div class="shortcut-desc">Move between options A–D</div>
      </div>
      <div class="shortcut-row">
        <div class="shortcut-keys"><kbd class="kbd">Enter</kbd> / <kbd class="kbd">Space</kbd></div>
        <div class="shortcut-desc">Select this option as the answer key</div>
      </div>
    </div>
  </div>`;
}

/* ══════════════════════════════════════
   REPORTS OVERLAY (host)
══════════════════════════════════════ */
function reportsOverlayHTML(){
  if(!reportsOverlayOpen) return '';
  const reports=receivedReports;
  const hd=`<div class="standings-overlay-head">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-weight:700;font-size:.95rem">&#128297; Reported Questions</span>
      <span style="font-size:.75rem;color:var(--mid)">${reports.length} report${reports.length!==1?'s':''}</span>
    </div>
    <button class="btn btn-ghost btn-sm" id="btn-reports-close">&#x2715; Close</button>
  </div>`;
  if(!reports.length){
    return `<div class="standings-overlay" id="reports-overlay">${hd}
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;text-align:center;color:var(--mid)">
        <div style="font-size:2.4rem;margin-bottom:12px">&#128461;</div>
        <div style="font-size:.88rem;font-weight:500;margin-bottom:6px">No reports yet</div>
        <div style="font-size:.78rem">Students can flag questions using the &#128681; button after a reveal.</div>
      </div></div>`;
  }
  const cards=reports.map(r=>{
    const isX=expandedReportRid===r.rid, isEd=editingReportRid===r.rid;
    const q=r.question, uc=q&&q.subject&&q.subject.toLowerCase()==='urdu';
    const s=Math.floor((Date.now()-r.ts)/1000);
    const ago=s<60?s+'s ago':s<3600?Math.floor(s/60)+'m ago':Math.floor(s/3600)+'h ago';
    const headH=`<div class="report-card-head" data-r-expand="${r.rid}">
      <div style="flex:1;min-width:0">
        <div style="font-size:.82rem;font-weight:500;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;${uc?'direction:rtl;font-family:Noto Nastaliq Urdu,serif;font-size:.86rem':''}">
          ${renderMath(q?q.text.length>90?q.text.slice(0,88)+'\u2026':q.text:'?')}
        </div>
        <div style="display:flex;align-items:center;gap:7px;margin-top:3px;flex-wrap:wrap">
          <span style="font-size:.7rem;color:var(--mid)">&#128681; ${esc(r.reporterName)}</span>
          <span style="font-size:.7rem;color:var(--mid)">&middot; ${ago}</span>
          ${r.count>1?`<span style="background:#fee2e2;color:#be123c;font-size:.63rem;font-weight:700;padding:1px 6px;border-radius:10px">${r.count}&times; flagged</span>`:''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;padding-left:4px">
        <span style="font-size:.75rem;color:var(--mid);display:inline-block;transition:transform .2s;${isX?'transform:rotate(180deg)':''}">&#9662;</span>
        <button class="btn btn-ghost btn-sm" data-r-dismiss="${r.rid}" style="font-size:.66rem;padding:2px 7px">&#x2715;</button>
      </div>
    </div>`;
    let bodyH='';
    if(isX){
      if(isEd){
        const d=editReportDraft;
        bodyH=`<div class="report-expand-body" style="padding:13px 14px">
          <div style="margin-bottom:10px">
            <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--mid);margin-bottom:5px">Question text</div>
            <textarea id="r-edit-qtext" style="width:100%;padding:8px 10px;border:1.5px solid var(--ink);border-radius:var(--r);font-family:${uc?'Noto Nastaliq Urdu,serif':'var(--sans)'};font-size:.83rem;line-height:${uc?'2.2':'1.45'};resize:vertical;outline:none;min-height:54px;box-sizing:border-box;${uc?'direction:rtl;text-align:right;':''}">${esc(d.text||'')}</textarea>
          </div>
          <div style="margin-bottom:10px">
            <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--mid);margin-bottom:6px">Options</div>
            <div style="display:flex;flex-direction:column;gap:5px">
              ${(d.options||[]).map((o,i)=>`<div style="display:flex;align-items:center;gap:7px">
                <div style="width:24px;height:24px;border-radius:5px;background:${d.correct===i?'var(--ink)':'var(--faint)'};color:${d.correct===i?'#fff':'var(--mid)'};border:1.5px solid ${d.correct===i?'var(--ink)':'var(--line)'};display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:700;flex-shrink:0">${'ABCD'[i]}</div>
                <input class="form-input" data-r-opt="${i}" value="${esc(o)}" style="flex:1;padding:5px 9px;font-size:.82rem;${uc?'direction:rtl;text-align:right;font-family:Noto Nastaliq Urdu,serif;':''}"/></div>`).join('')}
            </div>
          </div>
          <div style="margin-bottom:13px">
            <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--mid);margin-bottom:6px">Correct answer <span style="font-weight:400;text-transform:none;letter-spacing:0">(click to select)</span></div>
            <div class="key-grid" style="min-height:unset;gap:6px">
              ${(d.options||[]).map((o,i)=>`<div class="key-card${d.correct===i?' selected':''}" data-r-key="${i}" tabindex="0" role="button" aria-label="Option ${'ABCD'[i]}"><div class="kl">${'ABCD'[i]}</div><div class="kt${uc?' urdu':''}" style="font-size:.76rem">${renderMath(o||'')}</div></div>`).join('')}
            </div>
          </div>
          <div style="display:flex;gap:7px;align-items:center">
            <button class="btn btn-dark" id="btn-save-report-edit" style="flex:1;font-size:.8rem;gap:5px;padding:9px 12px">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/></svg>Save &amp; Fix
            </button>
            <button class="btn btn-ghost" id="btn-cancel-report-edit" style="font-size:.8rem;padding:9px 14px">Cancel</button>
          </div>
          <div id="report-edit-msg" style="font-size:.75rem;margin-top:7px;min-height:1.1em"></div>
        </div>`;
      } else {
        const optR=(q&&q.options||[]).map((o,i)=>{
          const isCr=i===r.correct, isRp=r.reportedAnswer!==null&&i===r.reportedAnswer;
          let cls='r-opt-normal'; let badge='';
          if(isCr){cls='r-opt-correct';badge=`<span style="font-size:.62rem;font-weight:600;color:#16a34a;flex-shrink:0">&#10003; marked correct</span>`;}
          if(isRp&&!isCr){cls='r-opt-reported';badge=`<span style="font-size:.62rem;font-weight:600;color:#d97706;flex-shrink:0">&#9888; student picked</span>`;}
          if(isRp&&isCr){badge=`<span style="font-size:.62rem;font-weight:600;color:#16a34a;flex-shrink:0">&#10003; correct (student also chose)</span>`;}
          return `<div class="r-opt-row ${cls}">
            <div style="width:22px;height:22px;border-radius:4px;background:${isCr?'var(--good)':isRp?'#f59e0b':'var(--line)'};color:${isCr||isRp?'#fff':'var(--mid)'};display:flex;align-items:center;justify-content:center;font-size:.67rem;font-weight:700;flex-shrink:0">${'ABCD'[i]}</div>
            <span class="${uc?'urdu':''}" style="flex:1;font-size:.82rem">${renderMath(o)}</span>
            ${badge}
          </div>`;
        }).join('');
        bodyH=`<div class="report-expand-body" style="padding:12px 14px">
          <div style="margin-bottom:10px">
            <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--mid);margin-bottom:5px">Question${q&&q.subject?' &middot; '+esc(q.subject):''}${q&&q.chapter?' / '+esc(q.chapter):''}</div>
            <div class="${uc?'urdu':''}" style="font-size:.85rem;line-height:${uc?'2.2':'1.5'};padding:9px 11px;background:var(--faint);border:1px solid var(--line);border-radius:6px">${renderMath(q&&q.text||'')}</div>
          </div>
          <div style="margin-bottom:10px">${optR}</div>
          <div style="display:flex;gap:7px">
            <button class="btn btn-dark btn-sm" data-r-edit="${r.rid}" style="gap:5px;font-size:.78rem">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit
            </button>
            <button class="btn btn-ghost btn-sm" data-r-dismiss="${r.rid}" style="font-size:.78rem">&#x2715; Dismiss</button>
          </div>
        </div>`;
      }
    }
    return `<div class="report-card" data-rid="${r.rid}">${headH}${bodyH}</div>`;
  }).join('');

  return `<div class="standings-overlay" id="reports-overlay">
    ${hd}
    <div class="standings-overlay-body" style="padding:12px">${cards}</div>
  </div>`;
}

/* ══════════════════════════════════════
   HOST KEYBOARD SHORTCUTS (global handler — added/removed by attach)
══════════════════════════════════════ */
function hostKeyDown(e){
  if(!hostAuthed||role!=='host') return;
  // Close settings with Escape
  if(hostSettingsOpen&&e.key==='Escape'){ hostSettingsOpen=false; render(); return; }
  if(reportsOverlayOpen&&e.key==='Escape'){ reportsOverlayOpen=false; editingReportRid=null; editReportDraft={}; render(); return; }
  if(folderManageSubject&&e.key==='Escape'){ folderManageSubject=null; manageFolder=null; manageEditMode=null; manageFile=null; manageFolderFiles=[]; editingContent=''; editingSha=null; uploadMsg=''; editorFullscreen=false; render(); return; }
  if(folderOverlaySubject&&e.key==='Escape'){ folderOverlaySubject=null; folderOverlayDraft={}; render(); return; }
  // Close halt/sched overlays with Escape
  if((showingHaltMenu||sidebarSchedOpen)&&e.key==='Escape'){
    showingHaltMenu=false; sidebarSchedOpen=false; render(); return;
  }
  // Don't fire shortcuts when typing in an input/textarea/select
  const tag=document.activeElement?.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT') return;
  // Don't fire when inside an overlay other than the main panel
  if(hostSettingsOpen||showingHaltMenu||sidebarSchedOpen) return;
  switch(e.key){
    case 'ArrowLeft':
      e.preventDefault();
      document.getElementById('btn-q-prev')?.click(); break;
    case 'ArrowRight':
      e.preventDefault();
      document.getElementById('btn-q-next')?.click(); break;
    case 'p': case 'P':
      e.preventDefault();
      document.getElementById('btn-push')?.click(); break;
    case 'r': case 'R':
      e.preventDefault();
      document.getElementById('btn-reveal')?.click(); break;
    case 'n': case 'N':
      e.preventDefault();
      document.getElementById('btn-next')?.click(); break;
    case '1': case '2': case '3': case '4':{
      e.preventDefault();
      const idx=parseInt(e.key)-1;
      const cards=[...document.querySelectorAll('.key-card[data-key]')];
      if(cards[idx]) cards[idx].click();
      break;
    }
  }
}

function hostHTML(){
  if(S.status==='ended') return hostEndedHTML();

  const parts=S.participants||[];
  const sorted=sortParticipants(parts);
  const isLive=S.status==='question'||S.status==='revealed';
  const isRevealed=S.status==='revealed';
  const answered=S.totalAnswered||0;
  const medals=['🥇','🥈','🥉'];

  // ── 1. LIVE SCORE NAV ──────────────────────────────────────────────────
  const snaps = S.sessionSnapshots || [];
  const currentSessionLabel = snaps.length > 0 ? `S${snaps.length + 1}` : 'S1';
  const pushedSoFar = S.pushedCount || 0;
  const totalLoaded = questions.length || 0;
  const standingsLabel = parts.length
    ? `📊 ${currentSessionLabel} · ${parts.length} joined`
    : `📊 Standings`;
  const pushedLabel = totalLoaded > 0
    ? `Q${pushedSoFar}/${totalLoaded}`
    : pushedSoFar > 0 ? `Q${pushedSoFar}` : '';
  const liveNav=`
    <div class="host-live-nav">
      <button class="btn btn-ghost btn-sm" id="btn-host-home" style="flex-shrink:0;padding:4px 10px;font-size:.75rem;gap:4px">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15,18 9,12 15,6"/></svg>Host Menu
      </button>
      <div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:center">
          ${standingsLabel}
        </button>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-sched-nav" style="flex-shrink:0;padding:4px 8px;gap:4px;font-size:.75rem">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Sched
      </button>
      <div style="position:relative;flex-shrink:0">
        <button class="btn btn-ghost btn-sm" id="btn-reports-open" title="Received question reports" style="padding:4px 8px;font-size:.75rem;gap:4px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
        </button>
        <span id="reports-badge" class="reports-badge" style="display:${receivedReports.length?'flex':'none'};align-items:center;justify-content:center">${receivedReports.length||0}</span>
      </div>
    </div>`;

  // SVG icons — refined set
  const iconNew=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`;
  const iconPlay=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"/></svg>`;
  const iconStop=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  const iconReset=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>`;

  // Session status banner — shows clearly whether students can join
  const sessionBanner=!isLive?(S.sessionOpen
    ?`<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:#e8f5ee;border-bottom:1px solid #b7dfc7;font-size:.8rem;flex-shrink:0">
        <span class="dot-live"></span>
        <span style="color:#166534;font-weight:600">Session open — students can join now</span>
        <span style="color:#166534;opacity:.7;margin-left:auto">${parts.length} joined</span>
      </div>`
    :`<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:var(--faint);border-bottom:1px solid var(--line);font-size:.8rem;flex-shrink:0">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--mid);flex-shrink:0;display:inline-block"></span>
        <span style="color:var(--mid)">Session closed — press <strong>Start</strong> to let students join</span>
      </div>`)
    :'';

  const ctrlBar=`
    <div class="host-ctrl-bar">
      <button class="btn btn-sm" style="flex:1;justify-content:center;background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe;gap:5px" id="btn-reload">${iconNew} New</button>
      ${!S.sessionOpen
        ?`<button class="btn btn-sm" style="flex:1;justify-content:center;background:#f0fdf4;color:#15803d;border-color:#bbf7d0;gap:5px;font-weight:600" id="btn-open-session">${iconPlay} Start</button>`
        :`<button class="btn btn-sm" style="flex:1;justify-content:center;background:#dcfce7;color:#15803d;border-color:#86efac;gap:5px;opacity:.6;cursor:default" disabled>${iconPlay} Open ✓</button>`}
      <button class="btn btn-sm" style="flex:1;justify-content:center;background:#fff1f2;color:#be123c;border-color:#fecdd3;gap:5px" id="btn-halt">${iconStop} Halt</button>
      <button class="btn btn-sm" style="flex:1;justify-content:center;background:#f5f3ff;color:#6d28d9;border-color:#ddd6fe;gap:5px" onclick="openEditorPicker(event)">✏️ Editor</button>
    </div>
    ${sessionBanner}`;

  // ── 3. STUDENTS PANEL ────────────────────────────────────────────────
  function initials(n){return n.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();}

  // Compute fastest-finger: the correct answerer with the lowest answerTime this question
  let fastestPid = null;
  if(isRevealed && S.correct !== null && S.correct !== undefined){
    let bestTime = Infinity;
    Object.entries(S.answerTimes||{}).forEach(([pid,t])=>{
      if(S.answers?.[pid]===S.correct && t!=null && parseFloat(t)<bestTime){
        bestTime=parseFloat(t); fastestPid=pid;
      }
    });
  }

  // 🔥 Streak map for all participants
  const streakMap = getStreakMap();

  const studentRows=sorted.length
    ?sorted.map((p,i)=>{
        const ans=S.answers?.[p.id];
        const ansStr=ans!==undefined&&ans!==null?'ABCD'[ans]:'—';
        const ansTime = S.answerTimes?.[p.id] ?? null;
        const cumTime = S.cumulativeTimes?.[p.id] ?? null;
        const isCorrect=ans!==undefined&&ans!==null&&ans===S.correct;
        const isWrong=ans!==undefined&&ans!==null&&ans!==S.correct;
        const isFastest = isRevealed && p.id===fastestPid;
        const pStreak = streakMap[p.id] || 0;
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--line);font-size:.83rem${isFastest?';background:#fffbeb':''}">
          <div style="min-width:22px;text-align:center;font-size:.72rem;color:var(--mid)">${medals[i]||('#'+(i+1))}</div>
          <div class="j-av" style="flex-shrink:0${isFastest?';background:#f59e0b;color:#fff':''}">${initials(p.name)}</div>
          <div style="flex:1;overflow:hidden;min-width:0">
            <div style="white-space:nowrap;text-overflow:ellipsis;overflow:hidden">${esc(p.name)}</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:1px">
              ${isFastest?'<span class="ff-badge">⚡ Fastest</span>':''}
              ${streakBadgeHTML(pStreak)}
            </div>
          </div>
          <div style="font-size:.72rem;font-weight:700;min-width:26px;text-align:center;padding:2px 5px;border-radius:4px;${isCorrect?'background:#dcfce7;color:#16a34a':isWrong?'background:#fee2e2;color:#be123c':ans!==undefined&&ans!==null?'background:var(--faint);color:var(--mid)':'color:var(--mid)'}">${ansStr}</div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;min-width:52px;gap:1px">
            ${ansTime!=null?`<span style="font-size:.7rem;color:var(--mid)">${parseFloat(ansTime).toFixed(2)}s</span>`:'<span style="min-height:14px"></span>'}
            ${cumTime!=null?`<span style="font-size:.62rem;color:#a0a0ac" title="Cumulative">Σ${parseFloat(cumTime).toFixed(1)}s</span>`:''}
          </div>
          <div style="font-weight:600;min-width:44px;text-align:right">${p.score||0} <span style="font-size:.68rem;color:var(--mid)">pts</span></div>
        </div>`;
      }).join('')
    :`<div style="padding:20px;text-align:center;color:var(--mid);font-size:.83rem">Waiting for students to join…</div>`;

  const studentsPanel=`
    <div class="host-students-panel">
      <div class="host-students-head">
        <h3 style="margin:0">Students${parts.length?' ('+parts.length+')':''}</h3>
        ${pushedLabel?`<span style="font-size:.72rem;font-weight:700;color:var(--accent);background:#eff6ff;border:1px solid #bfdbfe;padding:2px 8px;border-radius:20px">${pushedLabel}</span>`:''}
        ${isLive
          ?`<span class="small muted">${answered}/${parts.length} answered</span>`
          :S.sessionOpen
            ?`<span class="tag tag-green"><span class="dot-live"></span> Open</span>`
            :`<span class="small muted">Session not started</span>`}
      </div>
      <div class="host-students-inner">${studentRows}</div>
    </div>`;

  // ── 4. BOTTOM CONTROLS ───────────────────────────────────────────────

  // No questions loaded → show upload/generate panel
  if(!questions.length){
    const totalSelectedFiles=subjects.reduce((n,s)=>n+s.files.filter(f=>f.selected).length,0);
    // Chapter overlay HTML (rendered on top of everything when a folder is tapped)
    const chapterOverlayHTML=(()=>{
      if(!folderOverlaySubject) return '';
      const subj=subjects.find(s=>s.name===folderOverlaySubject);
      if(!subj) return '';
      const draft=folderOverlayDraft;
      const selCount=Object.values(draft).filter(d=>d.selected).length;
      const rows=subj.filesLoaded
        ?(subj.files.length
          ?subj.files.map(f=>{
              const d=draft[f.name]||{selected:false,count:0};
              return `<div class="chapter-row${d.selected?' sel':''}" data-ch-toggle="${esc(f.name)}">
                <div class="ch-check">${d.selected?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>':''}</div>
                <span class="ch-name">${esc(f.name.replace(/\.txt$/i,''))}</span>
                ${d.selected?`<input class="ch-count" type="number" min="0" max="999" value="${d.count||''}" placeholder="all" data-ch-cnt="${esc(f.name)}" title="0 or blank = all questions" onclick="event.stopPropagation()"/>`:
                  '<span style="width:44px"></span>'}
              </div>`;
            }).join('')
          :'<p class="muted" style="padding:20px;text-align:center;font-size:.84rem">No .txt files in this folder.</p>')
        :'<div style="padding:32px;text-align:center"><div class="spinner" style="margin:0 auto 10px"></div><p class="muted small">Loading chapters…</p></div>';
      return `<div class="chapter-overlay-backdrop" id="ch-overlay-backdrop">
        <div class="chapter-overlay-panel">
          <div class="chapter-overlay-head">
            <div class="chapter-overlay-title">
              <span style="font-size:1.3rem">📁</span>
              <span>${esc(folderOverlaySubject)}</span>

            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="btn btn-ghost btn-sm" id="btn-ch-clear" style="font-size:.72rem;color:var(--mid)">✕ Clear</button>
              <button class="btn btn-ghost btn-sm" id="btn-ch-cancel" style="font-size:.76rem">Cancel</button>
              <button class="btn btn-accent btn-sm" id="btn-ch-save" style="font-size:.76rem;font-weight:600">Save ✓</button>
            </div>
          </div>
          <div class="chapter-overlay-body">${rows}</div>
        </div>
      </div>`;
    })();

    const generatePanel=`
      ${chapterOverlayHTML}
      ${subjects.length?`
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
          <button class="btn btn-ghost btn-sm" id="btn-browse" style="padding:4px 9px;font-size:.72rem">${repoLoading?'⏳ Loading':'↻ Refresh'}</button>
          <button class="btn btn-accent btn-sm" id="btn-gen" title="Generate quiz" style="padding:4px 10px;font-size:.72rem;gap:4px" ${subjects.some(s=>s.files.some(f=>f.selected))?'':'disabled'}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>Quiz</button>
          <div style="display:flex;align-items:center;gap:5px;margin-left:auto">
            <button id="btn-toggle-random" title="${hostRandomize?'Randomise ON — click to turn off':'Randomise OFF — click to turn on'}"
              style="padding:3px 8px;font-size:.7rem;font-weight:600;border-radius:var(--r);border:1.5px solid ${hostRandomize?'var(--accent)':'var(--line)'};background:${hostRandomize?'#eff6ff':'var(--faint)'};color:${hostRandomize?'var(--accent)':'var(--mid)'};cursor:pointer;display:flex;align-items:center;gap:4px;white-space:nowrap;transition:all .15s">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
              ${hostRandomize?'Rand: ON':'Rand: OFF'}
            </button>
            <span style="font-size:.72rem;color:var(--mid)">⏱</span>
            <input type="number" min="0" max="300" value="${hostTimerSeconds}" id="timer-sec-input" class="q-count-input" style="width:46px;font-size:.75rem;padding:3px 6px"/>
            <span style="font-size:.72rem;color:var(--mid)">s</span>
          </div>
        </div>

        <div class="folder-grid">
          ${subjects.map(s=>{
            const selCount=s.files.filter(f=>f.selected).length;
            return `<div class="folder-card${selCount?' has-sel':''}" data-folder-name="${esc(s.name)}" style="position:relative" tabindex="0" role="button" aria-label="${esc(s.name)}">
              ${selCount?`<div class="fc-badge">${selCount}</div>`:''}
              <div class="fc-icon">${selCount?'📂':'📁'}</div>
              <div class="fc-name">${esc(s.name)}</div>
            </div>`;
          }).join('')}
          <div class="folder-card-add${showNewFolderCard?' active':''}" id="btn-new-folder-card" tabindex="0" role="button" aria-label="Create new folder">
            ${showNewFolderCard
              ?`<input id="new-folder-name" placeholder="Folder name" maxlength="40" autofocus
                  style="width:100%;font-size:.68rem;padding:3px 5px;border:1px solid var(--accent);border-radius:5px;outline:none;text-align:center"
                  onclick="event.stopPropagation()"/>`
              :`<div style="font-size:1.1rem;color:var(--mid)">＋</div>
                <div style="font-size:.62rem;font-weight:600;color:var(--mid)">New folder</div>`}
          </div>
        </div>
        ${showNewFolderCard?`<div style="display:flex;gap:5px;margin-top:-4px;margin-bottom:6px">
          <button class="btn btn-accent btn-sm" id="btn-create-folder" style="flex:1;font-size:.74rem">Create</button>
          <button class="btn btn-ghost btn-sm" id="btn-cancel-new-folder" style="font-size:.74rem">Cancel</button>
        </div>`:''}
        <div id="gen-msg"></div>
      `:`
        <div id="repo-msg"></div>
        <button class="btn btn-dark btn-sm" id="btn-browse" style="margin-top:6px;width:100%">${repoLoading?'⏳ Loading…':'Load subjects from GitHub →'}</button>
      `}`;

    return `<div class="host-full" style="position:relative">
      ${liveNav}
      ${ctrlBar}
      ${studentsPanel}
      <div class="host-bottom">
        <div class="host-bottom-scroll" style="padding-top:5px">${generatePanel}</div>
      </div>
      ${manageOverlayHTML()}
      ${schedOverlayHTML()}
      ${haltBombOverlayHTML()}
      ${haltMenuOverlayHTML()}
      ${backupRestoreOverlayHTML()}
      ${standingsOverlayHTML()}
      ${reportsOverlayHTML()}
      ${hostSettingsOverlayHTML()}
      ${hostFinalLeaderboardHTML()}
    ${dismissBombOverlayHTML()}
    </div>`;
  }

  // Questions loaded — build controller
  const q=selIdx>=0?questions[selIdx]:(isLive?S.question:null);

  // Question navigation bar
  const qNav=`<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
    ${selIdx>0?`<button class="btn btn-ghost btn-sm" style="padding:3px 10px" id="btn-q-prev">‹</button>`:'<span style="width:32px"></span>'}
    <span class="muted small" style="flex:1;text-align:center">Q${selIdx>=0?selIdx+1:'?'}/${questions.length}${q&&q.subject?' · '+esc(q.subject):''}</span>
    ${selIdx<questions.length-1?`<button class="btn btn-ghost btn-sm" style="padding:3px 10px" id="btn-q-next">›</button>`:'<span style="width:32px"></span>'}
  </div>`;

  // Timer row — shows input when idle, live countdown when question is live
  const timerTotal=S.timerSeconds||hostTimerSeconds;
  const timerLeft=timerTotal&&S.questionPushedAt&&isLive
    ?Math.max(0,timerTotal-(Date.now()-S.questionPushedAt)/1000)
    :null;
  const timerRow=`
    <div class="timer-input-row" style="flex-shrink:0">
      <span style="flex:1;font-size:.8rem;color:var(--mid)">⏱ Timer per question</span>
      ${isLive&&timerLeft!==null
        ?`<div style="display:flex;align-items:center;gap:8px">
            <div style="width:80px;height:6px;background:var(--line);border-radius:3px;overflow:hidden">
              <div id="host-timer-bar" style="height:100%;background:${timerLeft<timerTotal*0.25?'var(--bad)':'var(--accent)'};border-radius:3px;width:${timerTotal?((timerLeft/timerTotal)*100).toFixed(1):0}%;transition:width .5s linear"></div>
            </div>
            <span id="host-timer-digits" style="font-size:.85rem;font-weight:700;color:${timerLeft<timerTotal*0.25?'var(--bad)':'var(--ink)'};min-width:28px;text-align:right">${Math.min(timerTotal,Math.ceil(timerLeft))}s</span>
          </div>`
        :`<input type="number" min="0" max="300" value="${hostTimerSeconds}" id="timer-sec-live" class="q-count-input" style="width:60px"/>
           <span class="muted small">sec</span>`}
    </div>`;

  // Question text
  const qInfo=q?`<p class="${''+urduCls(q)}" style="font-size:.83rem;line-height:${urduCls(q)?'2.2':'1.4'};flex-shrink:0;color:var(--ink)">${renderMath(q.text.length>130?q.text.slice(0,128)+'…':q.text)}</p>`
    :`<p class="muted small" style="flex-shrink:0">Select a question above or use ‹ › to navigate.</p>`;

  // Live response bars (shown when live instead of key)
  let liveBars='';
  if(isLive&&q){
    const counts=S.answerCounts||[], total=Math.max(1,counts.reduce((a,b)=>a+b,0));
    liveBars=q.options.map((o,i)=>{
      const cnt=counts[i]||0,pct=(cnt/total*100).toFixed(0);
      return `<div class="bar-row">
        <div class="bar-meta"><span class="${''+urduCls(q)}">${'ABCD'[i]}) ${renderMath(o)}${S.correct===i?' ✓':''}</span><span>${cnt}</span></div>
        <div class="bar-track"><div class="bar-fill${S.correct===i?' correct':''}" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');
  }

  // Answer key (shown when not live)
  const keyGrid=(!isLive&&q)?`
    <div class="key-grid" style="flex-shrink:0">
      ${q.options.map((o,i)=>`
        <div class="key-card${answerKey===i?' selected':''}" data-key="${i}" tabindex="0" role="button" aria-pressed="${answerKey===i}" aria-label="Option ${'ABCD'[i]}">
          <div class="kl">${'ABCD'[i]}</div><div class="kt${urduCls(q)}">${renderMath(o)}</div>
        </div>`).join('')}
    </div>`:'';

  // Mic/music state
  const micOn=!!localStream;

  // SVG action icons — refined
  const iconSend=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9" fill="currentColor" stroke="none"/></svg>`;
  const iconEye=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const iconNext=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>`;
  const iconMicOn=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
  const iconMicOff=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;

  // Action buttons — no margin-top:auto (space goes below, not above)
  const actionBtns=`
    <div style="display:flex;gap:6px;flex-shrink:0;padding-top:8px;border-top:1px solid var(--line);margin-top:4px">
      <button class="btn btn-lg" style="flex:1;font-size:.78rem;padding:10px 4px;gap:5px;background:#1e293b;color:#fff;border-color:#1e293b;justify-content:center" id="btn-push"
        ${(!q||answerKey<0||pushing||isLive)?'disabled':''}>${iconSend}${pushing?'Sending…':'Push'}</button>
      <button class="btn btn-lg" style="flex:1;font-size:.78rem;padding:10px 4px;gap:5px;background:#f59e0b;color:#fff;border-color:#f59e0b;justify-content:center" id="btn-reveal"
        ${(!isLive||isRevealed)?'disabled':''}>${iconEye} Reveal</button>
      <button class="btn btn-lg" style="flex:1;font-size:.78rem;padding:10px 4px;gap:5px;background:#0ea5e9;color:#fff;border-color:#0ea5e9;justify-content:center" id="btn-next"
        ${!isRevealed?'disabled':''}>${iconNext} Next</button>
      <button class="btn btn-lg" style="padding:10px 12px;flex-shrink:0;justify-content:center;${micOn?'background:#fee2e2;color:#be123c;border-color:#fecaca':'background:var(--faint);color:var(--mid);border-color:var(--line)'}"
        id="${micOn?'btn-mic-stop':'btn-mic-start'}" title="${micOn?'Stop mic':'Start mic'}">${micOn?iconMicOff:iconMicOn}</button>
    </div>`;

  return `<div class="host-full" style="position:relative">
    ${liveNav}
    ${ctrlBar}
    ${studentsPanel}
    <div class="host-bottom">
      ${qNav}
      ${timerRow}
      ${qInfo}
      <div style="flex:1;overflow-y:auto;min-height:0">
        ${isLive
          ?`<div>${liveBars}</div>`
          :keyGrid}
      </div>
      ${actionBtns}
    </div>
    ${schedOverlayHTML()}
    ${haltBombOverlayHTML()}
    ${haltMenuOverlayHTML()}
    ${backupRestoreOverlayHTML()}
    ${standingsOverlayHTML()}
    ${reportsOverlayHTML()}
    ${hostSettingsOverlayHTML()}
    ${hostFinalLeaderboardHTML()}
  </div>`;
}

/* ══════════════════════════════════════
   HOST ENDED
══════════════════════════════════════ */
function hostEndedHTML(){
  const history=S.history||[], parts=S.participants||[];
  const sorted=[...parts].sort((a,b)=>(b.score||0)-(a.score||0));
  const partMap={}; parts.forEach(p=>partMap[p.id]=p);
  const totalQs=history.length;
  const totalLabel=String(totalQs||S.pushedCount||0);
  const table=parts.length&&history.length?`<div class="itbl-wrap"><table class="itbl">
    <thead><tr><th>Student</th>${history.map((_,i)=>`<th>Q${i+1}</th>`).join('')}<th>Score</th></tr></thead>
    <tbody>${sorted.map(p=>`<tr data-pid="${p.id}"><td><strong>${esc(p.name)}</strong></td>
      ${history.map(h=>{const ans=h.answers[p.id]??null;if(ans===null)return'<td class="c-nil">—</td>';return`<td class="${ans===h.correct?'c-ok':'c-bad'}">${'ABCD'[ans]}${ans===h.correct?' ✓':' ✗'}</td>`;}).join('')}
      <td><strong>${p.score||0}</strong><span style="font-size:.7rem;color:var(--mid)">/${totalLabel}</span></td></tr>`).join('')}</tbody>
  </table></div>`:'<div class="notice n-neutral">No data recorded.</div>';
  let detail='';
  if(inspectPid&&partMap[inspectPid]){
    const p=partMap[inspectPid];
    detail=`<div class="detail-wrap"><div class="detail-head"><span><strong>${esc(p.name)}</strong> — ${p.score||0}/${totalLabel}</span><button class="btn btn-ghost btn-sm" id="btn-close-inspect">Close</button></div>
      ${history.map((h,i)=>{const ans=h.answers[p.id]??null;return`<div class="detail-row"><div class="detail-q">Q${i+1}: ${renderMath(h.question.text)}</div>
        <div class="ans-chips">${h.question.options.map((o,oi)=>{let cls='ac-none';if(oi===h.correct)cls='ac-good';if(ans===oi&&oi!==h.correct)cls='ac-bad';const mark=oi===ans?(oi===h.correct?' ✓':' ✗'):'';
          return`<span class="ans-chip ${cls}" style="${oi===ans||oi===h.correct?'font-weight:600':''}">${'ABCD'[oi]}) ${renderMath(o)}${mark}</span>`;}).join('')}${ans===null?'<span class="ans-chip ac-none">No answer</span>':''}</div></div>`;}).join('')}
    </div>`;
  }
  return `<div style="position:relative;padding:16px;width:100%;box-sizing:border-box">
    <div class="results-header">
      <h2>Results</h2>
      <div class="results-btns">
        <button class="btn btn-good btn-sm" id="btn-continue-session">▶ Continue</button>
        <button class="btn btn-warn btn-sm" id="btn-halt">⏹ Halt &amp; Dismiss</button>
        <button class="btn btn-ghost btn-sm" id="btn-reset">↺ Reset</button>
      </div>
    </div>
    <div class="notice n-neutral mb3" style="font-size:.79rem">
      <strong>Continue</strong> — return to waiting room &nbsp;·&nbsp; <strong>Halt</strong> — send students home
    </div>
    <p class="muted small mb2">Tap any row to inspect answers.</p>${table}${detail}
    ${haltBombOverlayHTML()}
    ${haltMenuOverlayHTML()}
    ${backupRestoreOverlayHTML()}
    ${hostFinalLeaderboardHTML()}
    ${dismissBombOverlayHTML()}
  </div>`;
}
