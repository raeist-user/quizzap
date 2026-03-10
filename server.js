'use strict';

const express  = require('express');
const http     = require('http');
const path     = require('path');
const { WebSocketServer } = require('ws');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

// Load .env file when running locally (ignored on Render/production)
try { require('dotenv').config(); } catch(_){}

const JWT_SECRET    = process.env.JWT_SECRET    || 'change-this-in-production';
const MONGODB_URI   = process.env.MONGODB_URI   || 'mongodb://localhost:27017/shadabcoaching';
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

// FIX #6-9: Schedule and Leaderboard models were missing entirely
const scheduleSchema = new mongoose.Schema({
  title:     { type: String, required: true, trim: true, maxlength: 60 },
  ts:        { type: Number, required: true },
  notes:     { type: String, trim: true, maxlength: 100, default: '' },
  createdAt: { type: Date, default: Date.now },
});
const Schedule = mongoose.model('Schedule', scheduleSchema);

// FIX #12: Leaderboard model to persist cumulative scores across sessions
const leaderboardSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  userName:       { type: String },
  totalScore:     { type: Number, default: 0 },
  sessionsPlayed: { type: Number, default: 0 },
  updatedAt:      { type: Date, default: Date.now },
});
const LeaderboardEntry = mongoose.model('LeaderboardEntry', leaderboardSchema);

// ── EXPRESS ───────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
// Serve index.html with MY_TOKEN injected so the browser can use it safely
const fs = require('fs');
const indexPath = path.join(__dirname, 'public', 'index.html');
app.get('/', (req, res) => {
  try {
    let html = fs.readFileSync(indexPath, 'utf8');
    const token = process.env.MY_TOKEN || '';
    html = html.replace("'%%MY_TOKEN%%'", JSON.stringify(token));
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch(e) { res.status(500).send('Server error loading page'); }
});
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);

// ── AUTH MIDDLEWARE ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorised' });
  try { req.user = jwt.verify(auth.slice(7), JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}

// ── USER ROUTES ───────────────────────────────────────────────────────────────

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
    // FIX #11: include displayName in response so join screen shows correct name immediately
    res.json({ token, user: { id: user._id, name: user.name, displayName: user.displayName || '', email: user.email, role: user.role } });
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
    const token = jwt.sign({ id: user._id, name: user.name, displayName: user.displayName || '', email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    // FIX #11: include displayName in login response so quiz name is correct
    res.json({ token, user: { id: user._id, name: user.name, displayName: user.displayName || '', email: user.email, role: user.role } });
  } catch (e) { res.status(500).json({ error: 'Login failed' }); }
});

// Change password
app.post('/api/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Min 6 characters' });
    const user = await User.findById(req.user.id);
    if (!user || !(await bcrypt.compare(currentPassword, user.password)))
      return res.status(400).json({ error: 'Current password is incorrect' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Update display name
app.post('/api/update-name', requireAuth, async (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName?.trim()) return res.status(400).json({ error: 'Display name required' });
    if (displayName.trim().length > 32) return res.status(400).json({ error: 'Max 32 characters' });
    const user = await User.findByIdAndUpdate(req.user.id, { displayName: displayName.trim() }, { new: true });
    const token = jwt.sign({ id: user._id, name: user.name, displayName: user.displayName, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token, user: { id: user._id, name: user.name, displayName: user.displayName, email: user.email, role: user.role } });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// ── SCHEDULE ROUTES (FIX #6, #7, #8) ─────────────────────────────────────────

// GET all upcoming schedules (public — students and host both call this)
app.get('/api/schedules', async (req, res) => {
  try {
    const schedules = await Schedule.find({ ts: { $gt: Date.now() - 3600000 } })
      .sort({ ts: 1 })
      .lean();
    res.json({ schedules });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch schedules' }); }
});

// POST create a new schedule (host only via auth)
app.post('/api/schedules', requireAuth, async (req, res) => {
  try {
    const { title, ts, notes } = req.body;
    if (!title?.trim() || !ts) return res.status(400).json({ error: 'Title and timestamp required' });
    if (ts <= Date.now()) return res.status(400).json({ error: 'Timestamp must be in the future' });
    const schedule = await Schedule.create({ title: title.trim(), ts, notes: notes?.trim() || '' });
    res.json({ ok: true, schedule });
  } catch (e) { res.status(500).json({ error: 'Failed to create schedule' }); }
});

// DELETE a schedule by ID
app.delete('/api/schedules/:id', requireAuth, async (req, res) => {
  try {
    const result = await Schedule.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Schedule not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Failed to delete schedule' }); }
});

// ── LEADERBOARD ROUTE (FIX #9) ────────────────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await LeaderboardEntry.find()
      .sort({ totalScore: -1 })
      .limit(50)
      .lean();
    res.json({ leaderboard });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch leaderboard' }); }
});

// POST /api/leaderboard — called by host client on Stop & Dismiss
// Accepts { entries: [{userId, userName, totalScore}] }
// Uses $inc so scores accumulate across separate game days
app.post('/api/leaderboard', requireAuth, async (req, res) => {
  try {
    const entries = req.body.entries;
    if (!Array.isArray(entries) || !entries.length)
      return res.status(400).json({ error: 'entries array required' });

    for (const e of entries) {
      if (!e.userId) continue;  // skip guests without accounts
      await LeaderboardEntry.findOneAndUpdate(
        { userId: e.userId },
        {
          $inc: { totalScore: e.totalScore || 0, sessionsPlayed: e.sessionsPlayed || 1 },
          $set: { userName: e.userName, updatedAt: new Date() },
        },
        { upsert: true }
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Failed to save leaderboard' }); }
});

// ── QUIZ STATE ────────────────────────────────────────────────────────────────
let state = fresh();
function fresh() {
  return {
    status:           'idle',
    sessionOpen:      false,  // FIX #1: was missing — students always saw "No session active"
    question:         null,
    correct:          null,
    answers:          {},     // pid → optIdx
    participants:     {},     // pid → { id, name, score, userId }
    history:          [],
    timerSeconds:     0,
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
    status:           state.status,
    sessionOpen:      state.sessionOpen,  // FIX #2: was missing — client never knew when joining was allowed
    question:         state.question,
    participants:     Object.values(state.participants),
    totalAnswered:    Object.keys(state.answers).length,
    answerCounts:     state.question
      ? state.question.options.map((_, i) =>
          Object.values(state.answers).filter(a => a === i).length)
      : [],
    timerSeconds:     state.timerSeconds,
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
  return { status: base.status, sessionOpen: base.sessionOpen, participants: base.participants };
}

// ── WEBSOCKET ─────────────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  const cid = ++seq;
  clients.set(cid, { ws, role: null, pid: null, userId: null });
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
          // FIX #10: store userId on participant so leaderboard can attribute scores
          state.participants[pid] = { id: pid, name: msg.name.trim().slice(0, 32), score: 0, userId: msg.userId || null };
        }
        client.role = 'participant'; client.pid = pid;
        client.name = state.participants[pid].name;
        client.userId = msg.userId || null;  // FIX #10: save on client too for end_session
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
        state.timerSeconds     = Math.max(0, parseInt(msg.timerSeconds) || 0);
        state.questionPushedAt = Date.now();
        broadcast();
        break;

      case 'reveal':
        if (client.role !== 'host' || state.status !== 'question') break;
        Object.entries(state.answers).forEach(([pid, ans]) => {
          if (ans === state.correct && state.participants[pid])
            state.participants[pid].score += 1;
        });
        state.history.push({ question: state.question, correct: state.correct, answers: { ...state.answers } });
        state.status = 'revealed'; state.timerSeconds = 0;
        broadcast();
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
          });
          state.history.push({ question: state.question, correct: state.correct, answers: { ...state.answers } });
        }
        state.status = 'ended';
        // FIX #12: persist scores to leaderboard DB
        persistLeaderboard(Object.values(state.participants));
        broadcast();
        break;

      // FIX #5: continue_session was completely missing — "Continue" button did nothing
      case 'continue_session':
        if (client.role !== 'host') break;
        state.status           = 'idle';
        state.question         = null;
        state.correct          = null;
        state.answers          = {};
        state.timerSeconds     = 0;
        state.questionPushedAt = null;
        // Tell all participants to exit halted/ended screen and return to waiting room
        clients.forEach((c) => {
          if (c.role === 'participant') tx(c.ws, { type: 'session_resumed' });
        });
        broadcast();
        break;

      case 'reset':
        if (client.role !== 'host') break;
        // Persist current session scores before wiping — so New Session doesn't lose them
        persistLeaderboard(Object.values(state.participants));
        state = fresh();
        clients.forEach((c) => {
          if (c.role === 'participant' && c.pid && c.name)
            state.participants[c.pid] = { id: c.pid, name: c.name, score: 0, userId: c.userId || null };
        });
        broadcast();
        break;

      // FIX #4: halt was completely missing — "End & dismiss students" did nothing
      case 'halt':
        if (client.role !== 'host') break;
        // First send halted event so students see the pause/standings screen briefly
        clients.forEach((c) => {
          if (c.role === 'participant')
            tx(c.ws, { type: 'halted', payload: { participants: Object.values(state.participants) } });
        });
        // Then kick everyone and reset
        clients.forEach((c) => {
          if (c.role === 'participant') { tx(c.ws, { type: 'kicked' }); c.role = null; c.pid = null; }
        });
        state = fresh();
        broadcast();
        break;

      case 'shutdown':
        if (client.role !== 'host') break;
        // Persist final session scores before dismissing
        persistLeaderboard(Object.values(state.participants));
        clients.forEach((c) => {
          if (c.role === 'participant') { tx(c.ws, { type: 'kicked' }); c.role = null; c.pid = null; }
        });
        state = fresh();
        broadcast();
        break;

      case 'leave':
        if (client.role !== 'participant' || !client.pid) break;
        delete state.participants[client.pid];
        delete state.answers[client.pid];
        client.role = null; client.pid = null;
        tx(ws, { type: 'left' });
        broadcast();
        break;

      case 'answer':
        if (client.role !== 'participant' || !client.pid) break;
        if (state.status !== 'question') break;
        if (state.answers[client.pid] !== undefined) break;
        if (typeof msg.idx !== 'number' || msg.idx < 0 || msg.idx > 3) break;
        state.answers[client.pid] = msg.idx;
        broadcast();
        break;

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

  ws.on('close', () => {
    // FIX: clean up disconnected participant from state so counts stay accurate
    const c = clients.get(cid);
    if (c?.role === 'participant' && c.pid) {
      delete state.participants[c.pid];
      delete state.answers[c.pid];
      broadcast();
    }
    if (cid === hostCid) hostCid = null;
    clients.delete(cid);
  });
});

// ── LEADERBOARD HELPER (FIX #12) ─────────────────────────────────────────────
async function persistLeaderboard(participants) {
  try {
    for (const p of participants) {
      if (!p.userId) continue;
      await LeaderboardEntry.findOneAndUpdate(
        { userId: p.userId },
        {
          $inc: { totalScore: p.score || 0, sessionsPlayed: 1 },
          $set: { userName: p.name, updatedAt: new Date() },
        },
        { upsert: true }
      );
    }
  } catch (e) {
    console.warn('Leaderboard persist error:', e.message);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Shadab Coaching Centre → http://localhost:${PORT}`));
