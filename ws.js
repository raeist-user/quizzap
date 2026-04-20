'use strict';

const { WebSocketServer } = require('ws');
const {
  SessionBackup, LeaderboardEntry, ScoreLog, ReportDB,
} = require('./models');

const HOST_PASSWORD = process.env.HOST_PASSWORD || '2325';

// ── SHARED STATE (also read by routes.js) ────────────────────────────────────
// Wrap in an object so routes.js always sees the live values via the same ref.
const shared = {
  questionReports: [],  // { rid, question, correct, reportedAnswer, reporterName, reporterPids, ts, count }
  reportCounter:   0,
};

// ── GAME STATE ────────────────────────────────────────────────────────────────
let state            = fresh();
let gameScores       = {};          // key → { name, userId, total }
let sessionSnapshots = [];
let sessionCounter   = 0;
let grandTotalPushed = 0;           // cumulative questions pushed across all sub-sessions (survives reset)
let bannedPids       = new Set();   // pids/userIds banned for the current session (cleared on shutdown)

// ── WS CLIENT REGISTRY ────────────────────────────────────────────────────────
let seq     = 0;
let hostCid = null;
const clients = new Map();

// ── TRANSPORT HELPERS ─────────────────────────────────────────────────────────
function tx(ws, d)     { if (ws.readyState === 1) ws.send(JSON.stringify(d)); }
function txCid(cid, d) { const c = clients.get(cid); if (c) tx(c.ws, d); }
function txHost(d)     { if (hostCid !== null) txCid(hostCid, d); }
function broadcast()   {
  clients.forEach(({ ws, role, pid }) =>
    tx(ws, { type: 'state', payload: project(role, pid) })
  );
}

// ── STATE HELPERS ─────────────────────────────────────────────────────────────
function fresh() {
  return {
    status:           'idle',
    sessionOpen:      false,
    question:         null,
    correct:          null,
    answers:          {},
    answerTimes:      {},
    cumulativeTimes:  {},
    participants:     {},
    history:          [],
    timerSeconds:     0,
    questionPushedAt: null,
    totalQuestions:   0,
    pushedCount:      0,
    thumbsUp:         [],  // pids who sent 👍 for the current question
  };
}

function project(role, pid) {
  const onlinePids = new Set();
  clients.forEach(c => { if (c.role === 'participant' && c.pid) onlinePids.add(c.pid); });

  const isEnded = state.status === 'ended';
  const ranked = Object.values(state.participants)
    .map(p => ({ ...p, online: onlinePids.has(p.id) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (isEnded) return 0;
      const tA = state.cumulativeTimes[a.id] ?? Infinity;
      const tB = state.cumulativeTimes[b.id] ?? Infinity;
      return tA - tB;
    })
    .map((p, i) => ({ ...p, rank: i + 1 }));

  const base = {
    status:           state.status,
    sessionOpen:      state.sessionOpen,
    question:         state.question,
    participants:     ranked,
    totalAnswered:    Object.keys(state.answers).length,
    answerCounts:     state.question
      ? state.question.options.map((_, i) =>
          Object.values(state.answers).filter(a => a === i).length)
      : [],
    timerSeconds:     state.timerSeconds,
    questionPushedAt: state.questionPushedAt,
    answerTimes:      state.answerTimes,
    cumulativeTimes:  state.cumulativeTimes,
    totalQuestions:   state.totalQuestions,
    pushedCount:      state.pushedCount,
    thumbsUp:         state.thumbsUp,   // array of pids who sent 👍 this question
  };

  if (role === 'host') return {
    ...base,
    correct:          state.correct,
    answers:          state.answers,
    history:          state.history,
    sessionSnapshots,
    grandTotalPushed, // cumulative across all sub-sessions (survives reset)
    gameScores:       Object.entries(gameScores).map(([pid, g]) => ({ id: pid, name: g.name, userId: g.userId || null, total: g.total })),
  };

  if (role === 'participant') {
    const myHistory = state.history.map(h => ({
      question: h.question, correct: h.correct, myAnswer: h.answers[pid] ?? null,
    }));
    return {
      ...base,
      correct:   (state.status === 'revealed' || state.status === 'ended') ? state.correct : null,
      myAnswer:  state.answers[pid] ?? null,
      myScore:   state.participants[pid]?.score ?? 0,
      myTime:    state.cumulativeTimes[pid] ?? null,
      myRank:    ranked.find(p => p.id === pid)?.rank ?? null,
      myHistory,
    };
  }

  return { status: base.status, sessionOpen: base.sessionOpen, participants: ranked };
}

function bankGameScores() {
  const snap = [];
  Object.values(state.participants).forEach(p => {
    const key = p.userId ? `user_${p.userId}` : p.id;
    if (!gameScores[key]) {
      gameScores[key] = { name: p.name, userId: p.userId || null, total: 0 };
    }
    const pts = p.score || 0;
    gameScores[key].total  += pts;
    gameScores[key].name    = p.name;
    gameScores[key].userId  = p.userId || gameScores[key].userId;
    snap.push({ id: p.id, name: p.name, score: pts });
  });
  if (snap.length) {
    sessionCounter += 1;
    sessionSnapshots.push({ sessionNum: sessionCounter, scores: snap });
  }
  // NOTE: saveSessionBackup is NOT called here — bankGameScores already added scores to
  // gameScores.total; calling it here would double-count bankedScore + currentScore.
}

// ── SESSION BACKUP ────────────────────────────────────────────────────────────
function getBackupWindow() {
  const now = Date.now();
  const d   = new Date(now);
  const todayBoundary = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 30, 0, 0);
  const windowStart = now >= todayBoundary
    ? new Date(todayBoundary)
    : new Date(todayBoundary - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);
  return { windowStart, windowEnd };
}

async function saveSessionBackup() {
  try {
    const { windowStart, windowEnd } = getBackupWindow();

    const byUserId = {};
    Object.values(gameScores).forEach(g => {
      if (!g.userId) return;
      const uid = String(g.userId);
      if (!byUserId[uid]) byUserId[uid] = { userId: uid, name: g.name, bankedScore: 0 };
      byUserId[uid].bankedScore += (g.total || 0);
    });

    Object.values(state.participants).forEach(p => {
      if (!p.userId) return;
      const uid = String(p.userId);
      if (!byUserId[uid]) byUserId[uid] = { userId: uid, name: p.name, bankedScore: 0 };
      byUserId[uid].name = p.name;
      byUserId[uid].currentScore = p.score || 0;
    });

    const participantList = Object.values(byUserId).map(entry => ({
      userId:       entry.userId,
      pid:          null,
      name:         entry.name,
      currentScore: entry.currentScore || 0,
      bankedScore:  entry.bankedScore  || 0,
      totalScore:   (entry.bankedScore || 0) + (entry.currentScore || 0),
      updatedAt:    new Date(),
    }));

    if (!participantList.length) return;

    const existing = await SessionBackup.findOne({ windowStart }).lean();
    if (existing) {
      const existingMap = {};
      existing.participants.forEach(ep => { if (ep.userId) existingMap[String(ep.userId)] = ep; });
      participantList.forEach(np => { existingMap[np.userId] = np; });
      await SessionBackup.findOneAndUpdate(
        { windowStart },
        { $set: { participants: Object.values(existingMap), updatedAt: new Date() } }
      );
    } else {
      await SessionBackup.create({ windowStart, windowEnd, participants: participantList });
    }
  } catch (e) {
    console.warn('[SessionBackup] save error:', e.message);
  }
}

async function getBackupEntry(userId) {
  if (!userId) return null;
  try {
    const { windowStart } = getBackupWindow();
    const backup = await SessionBackup.findOne({ windowStart }).lean();
    if (!backup) return null;
    return backup.participants.find(p => p.userId && p.userId === String(userId)) || null;
  } catch (e) {
    console.warn('[SessionBackup] lookup error:', e.message);
    return null;
  }
}

// ── LEADERBOARD PERSIST ───────────────────────────────────────────────────────
async function persistLeaderboard(entries) {
  try {
    for (const p of entries) {
      const uid = p.userId || p.id;
      if (!uid || String(uid).startsWith('p')) continue;
      // Update all-time cumulative leaderboard
      await LeaderboardEntry.findOneAndUpdate(
        { userId: uid },
        { $inc: { totalScore: p.score || 0, sessionsPlayed: 1 }, $set: { userName: p.name, updatedAt: new Date() } },
        { upsert: true }
      );
      // Write a ScoreLog entry so today/week leaderboard aggregation picks it up
      await ScoreLog.create({
        userId:   uid,
        userName: p.name,
        score:    p.score || 0,
        date:     new Date(),
      });
    }
  } catch (e) {
    console.warn('Leaderboard persist error:', e.message);
  }
}

// ── WEBSOCKET SERVER ──────────────────────────────────────────────────────────
function initWS(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', ws => {
    const cid = ++seq;
    clients.set(cid, { ws, role: null, pid: null, userId: null });
    tx(ws, { type: 'hello', cid });
    tx(ws, { type: 'state', payload: project(null, null) });

    ws.on('message', async raw => {
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      const client = clients.get(cid); if (!client) return;

      switch (msg.type) {

        case 'set_host':
          if (msg.password !== HOST_PASSWORD) { tx(ws, { type: 'auth_fail' }); break; }
          client.role = 'host'; hostCid = cid;
          tx(ws, { type: 'auth_ok' });
          tx(ws, { type: 'state', payload: project('host', null) });
          if (shared.questionReports.length)
            tx(ws, { type: 'report_received', reports: shared.questionReports });
          break;

        case 'join': {
          if (!msg.name?.trim()) break;
          let pid = msg.pid;

          // Block banned participants from rejoining this session
          const isBannedPid    = pid && bannedPids.has(pid);
          const isBannedUserId = msg.userId && bannedPids.has(String(msg.userId));
          if (isBannedPid || isBannedUserId) {
            tx(ws, { type: 'host_kicked' }); // tell client they're still banned
            break;
          }

          if (pid && state.participants[pid]) {
            state.participants[pid].name = msg.name.trim().slice(0, 32);
            if (!state.participants[pid].userId && msg.userId)
              state.participants[pid].userId = msg.userId;

          } else if (msg.userId) {
            const existingByUser = Object.values(state.participants)
              .find(p => p.userId && String(p.userId) === String(msg.userId));

            if (existingByUser) {
              pid = existingByUser.id;
              existingByUser.name = msg.name.trim().slice(0, 32);
            } else {
              pid = `p${cid}_${Date.now()}`;
              let restoredCurrent = 0;
              let restoredBanked  = 0;
              const backupEntry = await getBackupEntry(msg.userId);
              if (backupEntry) {
                restoredCurrent = backupEntry.currentScore || 0;
                restoredBanked  = backupEntry.bankedScore  || 0;
              }
              state.participants[pid] = {
                id:     pid,
                name:   msg.name.trim().slice(0, 32),
                score:  restoredCurrent,
                userId: msg.userId || null,
              };
              if (restoredBanked > 0 || restoredCurrent > 0) {
                const gKey = `user_${msg.userId}`;
                if (!gameScores[gKey]) {
                  gameScores[gKey] = {
                    name:   msg.name.trim().slice(0, 32),
                    userId: msg.userId || null,
                    total:  restoredBanked,
                  };
                }
                gameScores[pid] = gameScores[gKey];
              }
            }

          } else {
            if (!pid || !state.participants[pid]) {
              pid = `p${cid}_${Date.now()}`;
              state.participants[pid] = {
                id: pid, name: msg.name.trim().slice(0, 32), score: 0, userId: null,
              };
            } else {
              state.participants[pid].name = msg.name.trim().slice(0, 32);
            }
          }

          client.role   = 'participant'; client.pid = pid;
          client.name   = state.participants[pid].name;
          client.userId = msg.userId || null;
          tx(ws, { type: 'joined', pid });
          broadcast();
          txHost({ type: 'rtc_new_peer', cid });
          break;
        }

        case 'get_peers': {
          if (client.role !== 'host') break;
          const peerCids = [];
          clients.forEach((c, id) => { if (c.role === 'participant') peerCids.push(id); });
          tx(ws, { type: 'peer_list', cids: peerCids });
          break;
        }

        case 'open_session':
          if (client.role !== 'host') {
            tx(ws, { type: 'open_session_result', ok: false, reason: 'Not authenticated as host' });
            break;
          }
          if (state.sessionOpen) { tx(ws, { type: 'open_session_result', ok: true }); break; }
          state.sessionOpen = true;
          broadcast();
          tx(ws, { type: 'open_session_result', ok: true });
          break;

        case 'push_question':
          if (client.role !== 'host') break;
          if (!msg.question?.text || !Array.isArray(msg.question.options)) break;
          if (msg.correct < 0 || msg.correct > 3) break;
          state.status           = 'question';
          state.question         = msg.question;
          state.correct          = msg.correct;
          state.answers          = {};
          state.answerTimes      = {};
          state.thumbsUp         = [];   // reset thumbs for new question
          state.timerSeconds     = Math.max(0, parseInt(msg.timerSeconds) || 0);
          state.questionPushedAt = Date.now();
          state.pushedCount      += 1;
          if (msg.totalQuestions > 0) state.totalQuestions = parseInt(msg.totalQuestions);
          broadcast();
          break;

        case 'reveal':
          if (client.role !== 'host' || state.status !== 'question') break;
          Object.entries(state.answers).forEach(([pid, ans]) => {
            if (ans === state.correct && state.participants[pid])
              state.participants[pid].score += 1;
            if (state.answerTimes[pid] != null) {
              state.cumulativeTimes[pid] = parseFloat(
                ((state.cumulativeTimes[pid] || 0) + state.answerTimes[pid]).toFixed(2)
              );
            }
          });
          state.history.push({ question: state.question, correct: state.correct, answers: { ...state.answers } });
          state.status = 'revealed'; state.timerSeconds = 0;
          broadcast();
          saveSessionBackup().catch(e => console.warn('[SessionBackup] reveal save failed:', e.message));
          break;

        case 'clear':
          if (client.role !== 'host') break;
          state.status           = 'idle';
          state.question         = null;
          state.correct          = null;
          state.answers          = {};
          state.timerSeconds     = 0;
          state.questionPushedAt = null;
          broadcast();
          break;

        case 'end_session':
          if (client.role !== 'host') break;
          if (state.status === 'question') {
            Object.entries(state.answers).forEach(([pid, ans]) => {
              if (ans === state.correct && state.participants[pid])
                state.participants[pid].score += 1;
              if (state.answerTimes[pid] != null) {
                state.cumulativeTimes[pid] = parseFloat(
                  ((state.cumulativeTimes[pid] || 0) + state.answerTimes[pid]).toFixed(2)
                );
              }
            });
            state.history.push({ question: state.question, correct: state.correct, answers: { ...state.answers } });
          }
          state.status = 'ended';
          broadcast();
          break;

        case 'continue_session':
          if (client.role !== 'host') break;
          state.status           = 'idle';
          state.question         = null;
          state.correct          = null;
          state.answers          = {};
          state.timerSeconds     = 0;
          state.questionPushedAt = null;
          clients.forEach((c) => {
            if (c.role === 'participant') tx(c.ws, { type: 'session_resumed' });
          });
          broadcast();
          break;

        case 'reset':
          if (client.role !== 'host') break;
          {
            const previewParts = Object.values(state.participants)
              .slice().sort((a, b) => b.score - a.score);
            const previewTotal = state.pushedCount || 0;

            (async () => {
              for (const p of previewParts) {
                if (!p.userId || String(p.userId).startsWith('p')) continue;
                try {
                  await LeaderboardEntry.findOneAndUpdate(
                    { userId: p.userId },
                    { $inc: { totalScore: p.score || 0, sessionsPlayed: 1 }, $set: { userName: p.name, updatedAt: new Date() } },
                    { upsert: true }
                  );
                  // Write ScoreLog entry for today/week leaderboard
                  await ScoreLog.create({
                    userId:   p.userId,
                    userName: p.name,
                    score:    p.score || 0,
                    date:     new Date(),
                  });
                } catch(e) { console.warn('[reset] DB write error:', e.message); }
              }
            })();

            bankGameScores();

            // Accumulate grand total of pushed questions across all sub-sessions
            grandTotalPushed += previewTotal;
            // Clear bans for the new sub-session
            bannedPids = new Set();

            clients.forEach(c => {
              if (c.role === 'participant')
                tx(c.ws, { type: 'session_preview', payload: { participants: previewParts, totalQuestions: previewTotal } });
            });

            state = fresh();
            state.sessionOpen = true;
            clients.forEach(c => {
              if (c.role === 'participant' && c.pid && c.name) {
                state.participants[c.pid] = { id: c.pid, name: c.name, score: 0, userId: c.userId || null };
                if (c.userId) {
                  const gKey = `user_${c.userId}`;
                  if (gameScores[gKey] && !gameScores[c.pid]) gameScores[c.pid] = gameScores[gKey];
                }
              }
            });
            // Save backup with score=0 so reconnecting students start fresh after reset
            saveSessionBackup().catch(e => console.warn('[SessionBackup] post-reset save failed:', e.message));
            broadcast();
            if (shared.questionReports.length)
              txHost({ type: 'report_received', reports: shared.questionReports });
          }
          break;

        case 'halt':
          if (client.role !== 'host') break;
          {
            const haltParticipants = Object.values(state.participants)
              .slice().sort((a, b) => b.score - a.score);
            const haltTotalQ = grandTotalPushed + (state.pushedCount || 0);
            clients.forEach((c) => {
              if (c.role === 'participant')
                tx(c.ws, { type: 'halted', payload: { participants: haltParticipants, totalQuestions: haltTotalQ } });
            });
          }
          broadcast();
          break;

        case 'shutdown':
          if (client.role !== 'host') break;
          bankGameScores();
          {
            const seenUserIds = new Set();
            const finalLeaderboard = Object.entries(gameScores)
              .filter(([pid, g]) => {
                if (!g.userId) return true;
                const uid = String(g.userId);
                if (seenUserIds.has(uid)) return false;
                seenUserIds.add(uid);
                return true;
              })
              .map(([pid, g]) => ({ id: pid, name: g.name, userId: g.userId, score: g.total }))
              .sort((a, b) => b.score - a.score);
            persistLeaderboard(finalLeaderboard);
            // grandTotalPushed includes the current sub-session's pushedCount too
            const finalTotalQ = grandTotalPushed + (state.pushedCount || 0);
            clients.forEach((c) => {
              if (c.role === 'participant') {
                tx(c.ws, { type: 'kicked', payload: { finalLeaderboard, totalQuestions: finalTotalQ } });
                c.role = null; c.pid = null;
              }
            });
            // Tell host to refresh leaderboard once DB persist is done
            txHost({ type: 'shutdown_complete' });
            (async () => {
              try {
                const { windowStart } = getBackupWindow();
                await SessionBackup.deleteOne({ windowStart });
                console.log('[SessionBackup] Cleared on shutdown (manual halt).');
              } catch (e) { console.warn('[SessionBackup] clear on shutdown failed:', e.message); }
            })();
          }
          gameScores = {};
          sessionSnapshots = [];
          sessionCounter = 0;
          grandTotalPushed = 0;
          bannedPids = new Set();
          state = fresh();
          broadcast();
          break;

        case 'leave':
          if (client.role !== 'participant' || !client.pid) break;
          // Remove the pending answer so it doesn't get counted, but keep the
          // participant in state so their score survives until shutdown/reset.
          delete state.answers[client.pid];
          client.role = null; client.pid = null;
          tx(ws, { type: 'left' });
          broadcast();
          break;

        case 'kick_student': {
          if (client.role !== 'host') break;
          const kickPid = msg.pid;
          if (!kickPid) break;

          // Add the pid (and userId if available) to the ban set for this session
          bannedPids.add(kickPid);
          const kickedParticipant = state.participants[kickPid];
          if (kickedParticipant?.userId) bannedPids.add(String(kickedParticipant.userId));

          // Find the WS client for this pid and send them the kick message
          clients.forEach((c) => {
            if (c.pid === kickPid) {
              tx(c.ws, { type: 'host_kicked' });
              // Clean up their client state
              delete state.answers[c.pid];
              c.role = null; c.pid = null;
            }
          });

          // Remove from participants so they disappear from the board
          delete state.participants[kickPid];
          delete state.answers[kickPid];
          delete state.answerTimes[kickPid];
          delete state.cumulativeTimes[kickPid];

          console.log(`[kick] Banned pid=${kickPid}`);
          broadcast();
          break;
        }

        case 'thumb_up': {
          // Any participant can send a thumbs up; deduplicate by pid
          if (client.role !== 'participant' || !client.pid) break;
          if (!state.thumbsUp.includes(client.pid)) {
            state.thumbsUp.push(client.pid);
          }
          // Notify host immediately with a lightweight badge update message
          txHost({ type: 'thumb_up_received', pid: client.pid, name: client.name || 'Student' });
          broadcast();
          break;
        }

        case 'answer':
          if (client.role !== 'participant' || !client.pid) break;
          if (state.status !== 'question') break;
          if (state.answers[client.pid] !== undefined) break;
          if (typeof msg.idx !== 'number' || msg.idx < 0 || msg.idx > 3) break;
          state.answers[client.pid] = msg.idx;
          if (typeof msg.timeTaken === 'number' && msg.timeTaken >= 0)
            state.answerTimes[client.pid] = parseFloat(msg.timeTaken.toFixed(2));
          broadcast();
          break;

        case 'raise_hand': {
          if (client.role !== 'participant' || !client.pid) break;
          const raiseName = (msg.name || client.name || 'A student').slice(0, 40);
          txHost({ type: 'speak_request', name: raiseName, pid: client.pid, fromCid: cid });
          break;
        }
        case 'speak_request': {
          if (client.role !== 'participant' || !client.pid) break;
          const speakName = (client.name || 'A student').slice(0, 40);
          txHost({ type: 'speak_request', name: speakName, pid: client.pid, fromCid: cid });
          break;
        }
        case 'speak_allowed':
        case 'speak_dismissed':
        case 'speak_end': {
          if (client.role !== 'host') break;
          txCid(msg.toCid, { type: msg.type });
          break;
        }
        case 'speak_end_self': {
          if (client.role !== 'participant') break;
          txHost({ type: 'speak_end_self', fromCid: cid, pid: client.pid });
          break;
        }
        case 'rtc_speaker_offer': {
          if (client.role !== 'participant') break;
          txHost({ type: 'rtc_speaker_offer', fromCid: cid, signal: msg.signal });
          break;
        }
        case 'rtc_speaker_answer': {
          if (client.role !== 'host') break;
          txCid(msg.toCid, { type: 'rtc_speaker_answer', signal: msg.signal });
          break;
        }
        case 'rtc_ice_to_host_from_speaker': {
          if (client.role !== 'participant') break;
          txHost({ type: 'rtc_ice_speaker', fromCid: cid, signal: msg.signal });
          break;
        }
        case 'rtc_ice_to_speaker': {
          if (client.role !== 'host') break;
          txCid(msg.toCid, { type: 'rtc_ice_speaker', signal: msg.signal });
          break;
        }

        case 'update_question': {
          if (client.role !== 'host') break;
          if (!msg.question?.text || !Array.isArray(msg.question.options)) break;
          if (state.question && state.question.text === msg.question.text) {
            state.question = msg.question;
            if (typeof msg.correct === 'number') state.correct = msg.correct;
            broadcast();
          }
          break;
        }

        case 'report_question': {
          if (client.role !== 'participant' || !client.pid) break;
          if (!msg.question?.text) break;
          const existingRep = shared.questionReports.find(r =>
            r.question.text === msg.question.text && r.reporterPids.includes(client.pid)
          );
          if (existingRep) break;
          const dupRep = shared.questionReports.find(r => r.question.text === msg.question.text);
          if (dupRep) {
            dupRep.count += 1;
            dupRep.reporterPids.push(client.pid);
            ReportDB.findOneAndUpdate(
              { rid: dupRep.rid },
              { $set: { count: dupRep.count, reporterPids: dupRep.reporterPids } }
            ).catch(() => {});
          } else {
            const newRep = {
              rid:            ++shared.reportCounter,
              question:       msg.question,
              correct:        msg.correct ?? null,
              reportedAnswer: msg.reportedAnswer ?? null,
              reporterName:   client.name || 'Unknown',
              reporterPids:   [client.pid],
              ts:             Date.now(),
              count:          1,
            };
            shared.questionReports.push(newRep);
            ReportDB.create(newRep).catch(e => console.warn('[ReportDB] save error:', e.message));
          }
          txHost({ type: 'report_received', reports: shared.questionReports });
          break;
        }

        case 'dismiss_report': {
          if (client.role !== 'host') break;
          shared.questionReports = shared.questionReports.filter(r => r.rid !== msg.rid);
          ReportDB.deleteOne({ rid: msg.rid }).catch(() => {});
          txHost({ type: 'report_received', reports: shared.questionReports });
          break;
        }

        case 'restore_backup': {
          if (client.role !== 'host') break;
          (async () => {
            try {
              const { windowStart } = getBackupWindow();
              const backup = await SessionBackup.findOne({ windowStart }).lean();
              if (!backup) {
                txHost({ type: 'backup_restore_result', ok: false, message: "No backup found for today's window." });
                return;
              }
              const importedRanked = backup.participants
                .slice()
                .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

              let restored = 0;
              backup.participants.forEach(bp => {
                if (!bp.userId) return;
                const uid   = String(bp.userId);
                const gKey  = `user_${uid}`;
                const existing = Object.values(state.participants).find(
                  p => p.userId && String(p.userId) === uid
                );
                const bankedTotal  = gameScores[gKey]?.total || 0;
                const liveScore    = existing?.score || 0;
                const currentTotal = bankedTotal + liveScore;
                const backupTotal  = bp.totalScore || 0;

                if (backupTotal <= currentTotal) return;
                const extra = backupTotal - currentTotal;

                if (existing) {
                  existing.score = (existing.score || 0) + extra;
                  if (!gameScores[gKey]) {
                    gameScores[gKey] = { name: existing.name, userId: existing.userId, total: 0 };
                  }
                  restored++;
                } else {
                  if (!gameScores[gKey]) {
                    gameScores[gKey] = { name: bp.name, userId: bp.userId, total: bp.totalScore };
                    restored++;
                  }
                }
              });
              broadcast();
              txHost({ type: 'backup_restore_result', ok: true, restored, importedRanked, message: `${restored} score(s) restored from today's backup.` });
            } catch (e) {
              txHost({ type: 'backup_restore_result', ok: false, message: 'Restore failed: ' + e.message });
            }
          })();
          break;
        }

        case 'rtc_offer':
        case 'rtc_ice_to_peer':
          if (client.role !== 'host') break;
          txCid(msg.toCid, { type: msg.type === 'rtc_offer' ? 'rtc_offer' : 'rtc_ice', signal: msg.signal });
          break;
        case 'rtc_answer':
        case 'rtc_ice_to_host':
          if (client.role !== 'participant') break;
          txHost({ type: msg.type === 'rtc_answer' ? 'rtc_answer' : 'rtc_ice', fromCid: cid, signal: msg.signal });
          break;
      }
    });

    ws.on('close', () => {
      const c = clients.get(cid);
      if (c?.role === 'participant' && c.pid) {
        delete state.answers[c.pid];
        broadcast();
      }
      if (cid === hostCid) hostCid = null;
      clients.delete(cid);
    });
  });
}

module.exports = { initWS, shared, txHost, getBackupWindow };
