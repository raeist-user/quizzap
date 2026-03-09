'use strict';

const express  = require('express');
const http     = require('http');
const path     = require('path');
const { WebSocketServer } = require('ws');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

const JWT_SECRET   = process.env.JWT_SECRET   || 'scc-quiz-secret-change-in-prod';
const MONGODB_URI  = process.env.MONGODB_URI  || 'mongodb://localhost:27017/shadabcoaching';
const HOST_PASSWORD = process.env.HOST_PASSWORD || '2325';

// ── MONGODB ───────────────────────────────────────────────────────────────────
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(e  => console.warn('MongoDB not connected:', e.message));

const userSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 50 },
  displayName: { type: String, trim: true, maxlength: 32, default: '' },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true },
  role:        { type: String, enum: ['student','host'], default: 'student' },
  createdAt:   { type: Date, default: Date.now },
});
const User = mongoose.model('User', userSchema);

// ── EXPRESS ───────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ error: 'All fields required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(400).json({ error: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name: name.trim(), email: email.toLowerCase(), password: hashed });
    const token = jwt.sign({ id: user._id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { res.status(500).json({ error: 'Registration failed' }); }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ id: user._id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { res.status(500).json({ error: 'Login failed' }); }
});

// ── AUTH MIDDLEWARE ───────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorised' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

// Change password
app.post('/api/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const user = await User.findById(req.user.id);
    if (!user || !(await bcrypt.compare(currentPassword, user.password)))
      return res.status(400).json({ error: 'Current password is incorrect' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Failed to change password' }); }
});

// Update display name
app.post('/api/update-name', authMiddleware, async (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName?.trim()) return res.status(400).json({ error: 'Display name required' });
    if (displayName.trim().length > 32) return res.status(400).json({ error: 'Max 32 characters' });
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { displayName: displayName.trim() },
      { new: true }
    );
    const token = jwt.sign({ id: user._id, name: user.name, displayName: user.displayName, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token, user: { id: user._id, name: user.name, displayName: user.displayName, email: user.email, role: user.role } });
  } catch (e) { res.status(500).json({ error: 'Failed to update name' }); }
});


let state = fresh();
function fresh() {
  return {
    status: 'idle',
    question: null, correct: null,
    answers: {},              // pid → optIdx
    participants: {},         // pid → { id, name, score }
    history: [],
    timerSeconds: 0,
    questionPushedAt: null,
  };
}

// ── WS CLIENT REGISTRY ───────────────────────────────────────────────────────
let seq = 0, hostCid = null;
const clients = new Map();

function tx(ws, d)      { if (ws.readyState === 1) ws.send(JSON.stringify(d)); }
function txCid(cid, d)  { const c = clients.get(cid); if (c) tx(c.ws, d); }
function txHost(d)      { if (hostCid !== null) txCid(hostCid, d); }
function broadcast()    {
  clients.forEach(({ ws, role, pid }) =>
    tx(ws, { type: 'state', payload: project(role, pid) })
  );
}

function project(role, pid) {
  const base = {
    status:          state.status,
    question:        state.question,
    participants:    Object.values(state.participants),
    totalAnswered:   Object.keys(state.answers).length,
    answerCounts:    state.question
      ? state.question.options.map((_, i) =>
          Object.values(state.answers).filter(a => a === i).length)
      : [],
    timerSeconds:    state.timerSeconds,
    questionPushedAt: state.questionPushedAt,
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
const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  const cid = ++seq;
  clients.set(cid, { ws, role: null, pid: null });
  tx(ws, { type: 'hello', cid });
  tx(ws, { type: 'state', payload: project(null, null) });

  ws.on('message', raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const client = clients.get(cid); if (!client) return;

    switch (msg.type) {
      case 'set_host':
        if (msg.password !== HOST_PASSWORD) { tx(ws, { type: 'auth_fail' }); break; }
        client.role = 'host'; hostCid = cid;
        tx(ws, { type: 'auth_ok' });
        tx(ws, { type: 'state', payload: project('host', null) });
        break;

      case 'join': {
        if (!msg.name?.trim()) break;
        let pid = msg.pid;
        if (!pid || !state.participants[pid]) {
          pid = `p${cid}_${Date.now()}`;
          state.participants[pid] = { id: pid, name: msg.name.trim().slice(0, 32), score: 0 };
        }
        client.role = 'participant'; client.pid = pid; client.name = state.participants[pid].name;
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

      case 'push_question':
        if (client.role !== 'host') break;
        if (!msg.question?.text || !Array.isArray(msg.question.options)) break;
        if (msg.correct < 0 || msg.correct > 3) break;
        state.status = 'question';
        state.question = msg.question;
        state.correct = msg.correct;
        state.answers = {};
        state.timerSeconds = Math.max(0, parseInt(msg.timerSeconds) || 0);
        state.questionPushedAt = Date.now();
        broadcast(); break;

      case 'reveal':
        if (client.role !== 'host' || state.status !== 'question') break;
        Object.entries(state.answers).forEach(([pid, ans]) => {
          if (ans === state.correct && state.participants[pid])
            state.participants[pid].score += 1;
        });
        state.history.push({ question: state.question, correct: state.correct, answers: { ...state.answers } });
        state.status = 'revealed'; state.timerSeconds = 0;
        broadcast(); break;

      case 'clear':
        if (client.role !== 'host') break;
        state.status = 'idle'; state.question = null; state.correct = null;
        state.answers = {}; state.timerSeconds = 0; state.questionPushedAt = null;
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
        state = fresh();
        clients.forEach((c) => {
          if (c.role === 'participant' && c.pid && c.name)
            state.participants[c.pid] = { id: c.pid, name: c.name, score: 0 };
        });
        broadcast(); break;

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

      // WebRTC relay
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

  ws.on('close', () => { if (cid === hostCid) hostCid = null; clients.delete(cid); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Shadab Coaching Centre → http://localhost:${PORT}`));
