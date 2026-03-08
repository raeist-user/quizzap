'use strict';

const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));

// ── STATE ─────────────────────────────────────────────────────────────────────
let state = fresh();
function fresh() {
  return {
    status: 'idle',
    question: null,
    correct: null,
    answers: {},
    participants: {},   // pid → { id, name, score }
    history: [],
  };
}

// ── CLIENT REGISTRY ───────────────────────────────────────────────────────────
let seq = 0;
let hostCid = null;
const clients = new Map(); // cid → { ws, role, pid }

function tx(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}
function txCid(cid, data) {
  const c = clients.get(cid); if (c) tx(c.ws, data);
}
function txHost(data) {
  if (hostCid !== null) txCid(hostCid, data);
}
function broadcast() {
  clients.forEach(({ ws, role, pid }) =>
    tx(ws, { type: 'state', payload: project(role, pid) })
  );
}

function project(role, pid) {
  const base = {
    status:        state.status,
    question:      state.question,
    participants:  Object.values(state.participants),
    totalAnswered: Object.keys(state.answers).length,
    answerCounts:  state.question
      ? state.question.options.map((_, i) =>
          Object.values(state.answers).filter(a => a === i).length)
      : [],
  };
  if (role === 'host') return { ...base, correct: state.correct, answers: state.answers, history: state.history };
  if (role === 'participant') {
    const myHistory = state.history.map(h => ({
      question: h.question, correct: h.correct, myAnswer: h.answers[pid] ?? null,
    }));
    return {
      ...base,
      correct:  (state.status === 'revealed' || state.status === 'ended') ? state.correct : null,
      myAnswer: state.answers[pid] ?? null,
      myScore:  state.participants[pid]?.score ?? 0,
      myHistory,
    };
  }
  return { status: base.status, participants: base.participants };
}

// ── WEBSOCKET ─────────────────────────────────────────────────────────────────
wss.on('connection', ws => {
  const cid = ++seq;
  clients.set(cid, { ws, role: null, pid: null });
  tx(ws, { type: 'hello', cid });
  tx(ws, { type: 'state', payload: project(null, null) });

  ws.on('message', raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const client = clients.get(cid);
    if (!client) return;

    switch (msg.type) {

      case 'set_host':
        if (msg.password !== '2325') { tx(ws, { type: 'auth_fail' }); break; }
        client.role = 'host'; hostCid = cid;
        tx(ws, { type: 'auth_ok' });
        tx(ws, { type: 'state', payload: project('host', null) });
        break;

      case 'join': {
        if (!msg.name?.trim()) break;
        let pid = msg.pid;
        if (!pid || !state.participants[pid]) {
          pid = `p${cid}_${Date.now()}`;
          state.participants[pid] = { id: pid, name: msg.name.trim().slice(0, 28), score: 0 };
        }
        client.role = 'participant'; client.pid = pid;
        tx(ws, { type: 'joined', pid });
        broadcast();
        // Notify host to call this new peer (if voice is live)
        txHost({ type: 'rtc_new_peer', cid });
        break;
      }

      // Host asks for all current participant cids (called when mic starts)
      case 'get_peers': {
        if (client.role !== 'host') break;
        const peerCids = [];
        clients.forEach((c, id) => { if (c.role === 'participant') peerCids.push(id); });
        tx(ws, { type: 'peer_list', cids: peerCids });
        break;
      }

      case 'push_question':
        if (client.role !== 'host') break;
        if (!msg.question?.text || !Array.isArray(msg.question.options)) break;
        if (msg.correct < 0 || msg.correct > 3) break;
        state.status = 'question'; state.question = msg.question;
        state.correct = msg.correct; state.answers = {};
        broadcast(); break;

      case 'reveal':
        if (client.role !== 'host' || state.status !== 'question') break;
        Object.entries(state.answers).forEach(([pid, ans]) => {
          if (ans === state.correct && state.participants[pid])
            state.participants[pid].score += 1;   // 1 pt per correct answer
        });
        state.history.push({ question: state.question, correct: state.correct, answers: { ...state.answers } });
        state.status = 'revealed';
        broadcast(); break;

      case 'clear':
        if (client.role !== 'host') break;
        state.status = 'idle'; state.question = null; state.correct = null; state.answers = {};
        broadcast(); break;

      case 'end_session':
        if (client.role !== 'host') break;
        if (state.status === 'question') {
          Object.entries(state.answers).forEach(([pid, ans]) => {
            if (ans === state.correct && state.participants[pid])
              state.participants[pid].score += 1;
          });
          state.history.push({ question: state.question, correct: state.correct, answers: { ...state.answers } });
        }
        state.status = 'ended'; broadcast(); break;

      case 'reset':
        if (client.role !== 'host') break;
        state = fresh(); broadcast(); break;

      case 'leave':
        if (client.role !== 'participant' || !client.pid) break;
        delete state.participants[client.pid]; delete state.answers[client.pid];
        client.role = null; client.pid = null;
        tx(ws, { type: 'left' }); broadcast(); break;

      case 'answer':
        if (client.role !== 'participant' || !client.pid) break;
        if (state.status !== 'question') break;
        if (state.answers[client.pid] !== undefined) break;
        if (typeof msg.idx !== 'number' || msg.idx < 0 || msg.idx > 3) break;
        state.answers[client.pid] = msg.idx;
        broadcast(); break;

      // ── WebRTC signaling (pure relay, no validation of signal content) ──
      case 'rtc_offer':
      case 'rtc_ice_to_peer':
        if (client.role !== 'host') break;
        txCid(msg.toCid, {
          type:   msg.type === 'rtc_offer' ? 'rtc_offer' : 'rtc_ice',
          signal: msg.signal,
        });
        break;

      case 'rtc_answer':
      case 'rtc_ice_to_host':
        if (client.role !== 'participant') break;
        txHost({
          type:    msg.type === 'rtc_answer' ? 'rtc_answer' : 'rtc_ice',
          fromCid: cid,
          signal:  msg.signal,
        });
        break;
    }
  });

  ws.on('close', () => {
    if (cid === hostCid) hostCid = null;
    clients.delete(cid);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`QuizZap → http://localhost:${PORT}`));
