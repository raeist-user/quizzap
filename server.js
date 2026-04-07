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
  .then(async () => {
    console.log('MongoDB connected — db:', mongoose.connection.db.databaseName);
    // Load persisted reports into memory so host sees them immediately on connect
    try {
      const savedReports = await ReportDB.find().sort({ ts: 1 }).lean();
      questionReports = savedReports.map(r => ({ ...r, _id: undefined }));
      reportCounter   = questionReports.reduce((m, r) => Math.max(m, r.rid || 0), 0);
      console.log(`[Reports] Loaded ${questionReports.length} report(s) from DB`);
    } catch(e) { console.warn('[Reports] load error:', e.message); }
    scheduleAutoResets();
  })
  .catch(e  => console.error('MongoDB connection FAILED:', e.message));

const userSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 50 },
  // email is optional for new registrations; existing users keep their email for login
  email:       { type: String, required: false, trim: true, lowercase: true, unique: true, sparse: true, default: null },
  username:    {
    type: String, lowercase: true, trim: true, sparse: true, unique: true, default: null,
    validate: {
      validator: v => v === null || v === undefined || /^[a-zA-Z0-9_]{3,30}$/.test(v),
      message:   'Username must be 3–30 characters: letters, numbers, underscores only',
    },
  },
  password:    { type: String, required: true },
  role:        { type: String, enum: ['student','host'], default: 'student' },
  status:      { type: String, enum: ['pending','approved'], default: 'approved' },
  createdAt:   { type: Date, default: Date.now },
});
const User = mongoose.model('User', userSchema);

// Pending registrations — new users awaiting host approval
const pendingRegSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true, maxlength: 50 },
  email:     { type: String, required: false, trim: true, lowercase: true, unique: true, sparse: true, default: null },
  username:  { type: String, lowercase: true, trim: true, sparse: true, unique: true, default: null },
  password:  { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const PendingReg = mongoose.model('PendingReg', pendingRegSchema);

// Update requests — students requesting name/username changes
const updateReqSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:  { type: String },
  type:      { type: String, enum: ['name','username'], required: true },
  newValue:  { type: String, required: true, trim: true },
  status:    { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});
const UpdateReq = mongoose.model('UpdateReq', updateReqSchema);

// Global notice — host broadcasts a message to all students
const noticeSchema = new mongoose.Schema({
  text:      { type: String, default: '', maxlength: 500 },
  updatedAt: { type: Date, default: Date.now },
});
const Notice = mongoose.model('Notice', noticeSchema);

// Index cleanup removed — one-time migration already applied to cluster.
// Mongoose 8 manages sparse/unique indexes from schema definitions automatically.

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

// ── TODAY / WEEK LEADERBOARD MODELS ──────────────────────────────────────────
// Separate collections for today and week — cleared on schedule.
// AllTime uses the existing LeaderboardEntry collection.
const todayLBSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  userName:  { type: String },
  score:     { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});
const TodayLBEntry = mongoose.model('TodayLBEntry', todayLBSchema);

const weekLBSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  userName:  { type: String },
  score:     { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});
const WeekLBEntry = mongoose.model('WeekLBEntry', weekLBSchema);

// ── QUESTION REPORTS DB MODEL ─────────────────────────────────────────────────
// Persists reports across server restarts so the host never loses them.
const reportDBSchema = new mongoose.Schema({
  rid:            { type: Number, required: true, unique: true },
  question:       { type: Object },
  correct:        { type: Number, default: null },
  reportedAnswer: { type: Number, default: null },
  reporterName:   { type: String },
  reporterPids:   [{ type: String }],
  ts:             { type: Number, default: Date.now },
  count:          { type: Number, default: 1 },
  source:         { type: String, default: 'student' },
  note:           { type: String, default: '' },
});
const ReportDB = mongoose.model('ReportDB', reportDBSchema);

// ── SESSION BACKUP MODEL (sessionbackup collection) ──────────────────────────
// Persists live scores per participant for the current 5am-to-5am IST window.
// Updated on every 'reveal'. Survives host reconnects, new-session resets, and
// server glitches. Used to restore student scores on rejoin and for host recovery.
const sessionBackupSchema = new mongoose.Schema({
  windowStart:  { type: Date, required: true, unique: true, index: true },
  windowEnd:    { type: Date, required: true },
  participants: [{
    userId:      { type: String, default: null },
    pid:         { type: String },
    name:        { type: String },
    currentScore:{ type: Number, default: 0 },  // score in the most-recent mini-session
    bankedScore: { type: Number, default: 0 },  // scores from previous mini-sessions today
    totalScore:  { type: Number, default: 0 },  // currentScore + bankedScore
    updatedAt:   { type: Date,   default: Date.now },
  }],
  updatedAt:    { type: Date, default: Date.now },
});
const SessionBackup = mongoose.model('SessionBackup', sessionBackupSchema);

// ── SESSION HISTORY MODEL ─────────────────────────────────────────────────────
const sessionSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date:        { type: Date, default: Date.now },
  score:       { type: Number, default: 0 },
  total:       { type: Number, default: 0 },   // total questions in session
  correct:     { type: Number, default: 0 },   // correct answers
  rank:        { type: Number, default: 0 },   // rank in that session
  participants:{ type: Number, default: 0 },   // how many players were in session
  fastestMs:   { type: Number, default: null }, // fastest correct answer in ms
  source:      { type: String, enum: ['server','client'], default: 'client' }, // server = written on shutdown, client = written by participant
});
const SessionEntry = mongoose.model('SessionEntry', sessionSchema);

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
const editorPath = path.join(__dirname, 'public', 'editor.html');
app.get('/editor', (req, res) => {
  try {
    let html = fs.readFileSync(editorPath, 'utf8');
    const token  = process.env.MY_TOKEN       || '';
    const hostPw = process.env.HOST_PASSWORD  || '598359';
    html = html.replace("'%%MY_TOKEN%%'",      JSON.stringify(token));
    html = html.replace("'%%HOST_PASSWORD%%'", JSON.stringify(hostPw));
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch(e) { res.status(500).send('Server error loading page'); }
});
// Self Quiz — standalone host practice mode
const selfquizPath = path.join(__dirname, 'public', 'selfquiz.html');
app.get('/selfquiz', (req, res) => {
  try {
    let html = fs.readFileSync(selfquizPath, 'utf8');
    const token  = process.env.MY_TOKEN      || '';
    const hostPw = process.env.HOST_PASSWORD || '598359';
    html = html.replace("'%%MY_TOKEN%%'",      JSON.stringify(token));
    html = html.replace("'%%HOST_PASSWORD%%'", JSON.stringify(hostPw));
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch(e) { res.status(500).send('Server error loading self quiz page'); }
});

// Legacy /shuffle redirect → /editor
app.get('/shuffle', (req, res) => res.redirect(301, '/editor'));
// Prevent express.static from serving index.html without token injection
app.get('/index.html', (req, res) => res.redirect(301, '/'));
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);

// ── AUTH MIDDLEWARE ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorised' });
  try { req.user = jwt.verify(auth.slice(7), JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}

function requireHost(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorised' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    if (req.user.role !== 'host') return res.status(403).json({ error: 'Host access required' });
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

// ── USER ROUTES ───────────────────────────────────────────────────────────────

// Register — username + name + password only (no email for new users)
// Existing users who registered with email can still log in with it.
app.post('/api/register', async (req, res) => {
  try {
    const { name, username, password } = req.body;
    if (!name?.trim())     return res.status(400).json({ error: 'Full name is required' });
    if (!username?.trim()) return res.status(400).json({ error: 'Username is required' });
    if (!password)         return res.status(400).json({ error: 'Password is required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const uname = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(uname))
      return res.status(400).json({ error: 'Username must be 3–30 characters: letters, numbers, underscores only' });
    if (await User.findOne({ username: uname }))
      return res.status(400).json({ error: 'Username already taken' });
    if (await PendingReg.findOne({ username: uname }))
      return res.status(400).json({ error: 'Username already taken' });

    const hashed = await bcrypt.hash(password, 10);
    await PendingReg.create({
      name:     name.trim(),
      email:    null,
      username: uname,
      password: hashed,
    });
    res.json({ pending: true, message: 'Registration submitted! Your account is pending approval by the host.' });
  } catch (e) {
    if (e.code === 11000) {
      const field = Object.keys(e.keyPattern || {})[0] || '';
      if (field === 'username') return res.status(400).json({ error: 'Username already taken' });
      return res.status(500).json({ error: 'Registration failed — please try again' });
    }
    console.error('Register error:', e.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login — accepts email or username in a single "identifier" field
app.post('/api/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier?.trim() || !password)
      return res.status(400).json({ error: 'Email/username and password required' });

    const id = identifier.trim().toLowerCase();
    let user = null;

    if (id.includes('@')) {
      user = await User.findOne({ email: id });
      if (!user) user = await User.findOne({ username: id });
    } else {
      user = await User.findOne({ username: id });
    }

    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ error: 'Invalid email/username or password' });

    // Check approval status — hosts bypass this check
    if (user.role !== 'host' && user.status === 'pending')
      return res.status(403).json({ error: 'Your account is pending approval by the host.' });

    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email || '', username: user.username || '', role: user.role },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user._id, name: user.name, email: user.email || '', username: user.username || '', role: user.role } });
  } catch (e) { res.status(500).json({ error: 'Login failed' }); }
});

// Check username availability (public — called live from register form)
app.get('/api/check-username', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username || !/^[a-zA-Z0-9_]{3,30}$/.test(username.trim()))
      return res.json({ available: false });
    const exists = await User.findOne({ username: username.trim().toLowerCase() }).lean();
    res.json({ available: !exists });
  } catch (e) { res.status(500).json({ available: false }); }
});

// Verify session — called on every page load to confirm the account still exists
// Returns fresh user data so any manual DB edits (e.g. username added) are picked up immediately
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password').lean();
    if (!user) return res.status(401).json({ error: 'Account not found' });
    // Issue a refreshed token so the client always has up-to-date claims
    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email || '', username: user.username || '', role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email || '', username: user.username || '', role: user.role }
    });
  } catch (e) {
    console.error('/api/me error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
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

// Update display name — students submit a request; hosts update directly
app.post('/api/update-name', requireAuth, async (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName?.trim()) return res.status(400).json({ error: 'Display name required' });
    if (displayName.trim().length > 32) return res.status(400).json({ error: 'Max 32 characters' });

    if (req.user.role === 'host') {
      // Hosts update directly
      const user = await User.findByIdAndUpdate(req.user.id, { name: displayName.trim() }, { new: true });
      const token = jwt.sign({ id: user._id, name: user.name, email: user.email || '', username: user.username || '', role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ ok: true, token, user: { id: user._id, name: user.name, email: user.email || '', username: user.username || '', role: user.role } });
    }

    // Students create a pending update request
    const existing = await UpdateReq.findOne({ userId: req.user.id, type: 'name', status: 'pending' });
    if (existing) {
      existing.newValue = displayName.trim();
      await existing.save();
    } else {
      const u = await User.findById(req.user.id).lean();
      await UpdateReq.create({ userId: req.user.id, userName: u?.name || req.user.name, type: 'name', newValue: displayName.trim() });
    }
    res.json({ ok: true, pending: true, message: 'Name change request submitted — awaiting host approval.' });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Set or change username — students submit a request; hosts update directly
app.post('/api/update-username', requireAuth, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username?.trim()) return res.status(400).json({ error: 'Username required' });
    const uname = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(uname))
      return res.status(400).json({ error: 'Username must be 3–30 characters: letters, numbers, underscores only' });
    const existing = await User.findOne({ username: uname }).lean();
    if (existing && existing._id.toString() !== req.user.id)
      return res.status(400).json({ error: 'Username already taken' });

    if (req.user.role === 'host') {
      // Hosts update directly
      const user = await User.findByIdAndUpdate(req.user.id, { username: uname }, { new: true });
      const token = jwt.sign({ id: user._id, name: user.name, email: user.email || '', username: user.username || '', role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ ok: true, token, user: { id: user._id, name: user.name, email: user.email || '', username: user.username || '', role: user.role } });
    }

    // Students create a pending update request
    const existingReq = await UpdateReq.findOne({ userId: req.user.id, type: 'username', status: 'pending' });
    if (existingReq) {
      existingReq.newValue = uname;
      await existingReq.save();
    } else {
      const u = await User.findById(req.user.id).lean();
      await UpdateReq.create({ userId: req.user.id, userName: u?.name || req.user.name, type: 'username', newValue: uname });
    }
    res.json({ ok: true, pending: true, message: 'Username change request submitted — awaiting host approval.' });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: 'Username already taken' });
    res.status(500).json({ error: 'Failed' });
  }
});

// ── ADMIN ROUTES (host only) ──────────────────────────────────────────────────

// GET /api/admin/join-requests
app.get('/api/admin/join-requests', requireHost, async (req, res) => {
  try {
    const reqs = await PendingReg.find().sort({ createdAt: 1 }).lean();
    res.json({ requests: reqs.map(r => ({ id: r._id, name: r.name, email: r.email, username: r.username || '', createdAt: r.createdAt })) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/admin/join-requests/:id/approve', requireHost, async (req, res) => {
  try {
    console.log('[approve] DB:', mongoose.connection.db.databaseName);
    const pr = await PendingReg.findById(req.params.id);
    if (!pr) return res.status(404).json({ error: 'Request not found' });
    // Email uniqueness check only needed if this pending user has an email
    if (pr.email && await User.findOne({ email: pr.email })) {
      await PendingReg.findByIdAndDelete(pr._id);
      return res.status(400).json({ error: 'Email already registered' });
    }
    const newUser = await User.create({ name: pr.name, email: pr.email || null, username: pr.username || null, password: pr.password, role: 'student', status: 'approved' });
    console.log('[approve] User created:', newUser._id, newUser.username || newUser.email);
    await PendingReg.findByIdAndDelete(pr._id);
    res.json({ ok: true });
  } catch (e) {
    console.error('[approve] Error:', e.message, e.code);
    if (e.code === 11000) return res.status(400).json({ error: 'Username or email conflict' });
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/admin/join-requests/:id/reject', requireHost, async (req, res) => {
  try {
    await PendingReg.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// GET /api/admin/update-requests
app.get('/api/admin/update-requests', requireHost, async (req, res) => {
  try {
    const reqs = await UpdateReq.find({ status: 'pending' }).sort({ createdAt: 1 }).lean();
    res.json({ requests: reqs.map(r => ({ id: r._id, userId: String(r.userId), userName: r.userName || '', type: r.type, newValue: r.newValue, createdAt: r.createdAt })) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/admin/update-requests/:id/approve', requireHost, async (req, res) => {
  try {
    const ur = await UpdateReq.findById(req.params.id);
    if (!ur) return res.status(404).json({ error: 'Request not found' });
    const update = ur.type === 'name' ? { name: ur.newValue } : { username: ur.newValue };
    await User.findByIdAndUpdate(ur.userId, update);
    ur.status = 'approved'; await ur.save();
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: 'Username already taken' });
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/admin/update-requests/:id/reject', requireHost, async (req, res) => {
  try {
    await UpdateReq.findByIdAndUpdate(req.params.id, { status: 'rejected' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// GET /api/admin/users — list all registered users
app.get('/api/admin/users', requireHost, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: 1 }).select('-password').lean();
    res.json({ users: users.map(u => ({
      id:        u._id,
      name:      u.name,
      email:     u.email || '',
      username:  u.username || '',
      role:      u.role,
      status:    u.status,
      createdAt: u.createdAt,
    }))});
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// DELETE /api/admin/users/:id — purge account + all related records
app.delete('/api/admin/users/:id', requireHost, async (req, res) => {
  try {
    const uid = req.params.id;
    // Prevent host from deleting their own account
    if (uid === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Purge every trace from every collection
    await Promise.all([
      User.findByIdAndDelete(uid),
      UpdateReq.deleteMany({ userId: uid }),
      LeaderboardEntry.deleteMany({ userId: uid }),
      SessionEntry.deleteMany({ userId: uid }),
    ]);
    console.log('[delete-user] Purged user:', uid, user.email);
    res.json({ ok: true });
  } catch (e) {
    console.error('[delete-user] Error:', e.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// PATCH /api/admin/users/:id/role — change student ↔ host
app.patch('/api/admin/users/:id/role', requireHost, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['student', 'host'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const uid = req.params.id;
    if (uid === req.user.id) return res.status(400).json({ error: 'Cannot change your own role' });
    const user = await User.findByIdAndUpdate(uid, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true, role: user.role });
  } catch (e) { res.status(500).json({ error: 'Failed to update role' }); }
});

// GET /api/notice
app.get('/api/notice', async (req, res) => {
  try {
    const n = await Notice.findOne().lean();
    res.json({ text: n?.text || '' });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// POST /api/notice (host only)
app.post('/api/notice', requireHost, async (req, res) => {
  try {
    const { text } = req.body;
    await Notice.findOneAndUpdate({}, { text: (text || '').slice(0, 500), updatedAt: new Date() }, { upsert: true });
    res.json({ ok: true });
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

// ── AUTO-RESET LEADERBOARD SCHEDULER ─────────────────────────────────────────
// Checked every minute. Resets fire once per window using a simple last-reset tracker.
let _lastTodayReset = '';   // YYYY-MM-DD string of last today reset
let _lastWeekReset  = '';   // ISO date string of last week reset
let _lastAllReset   = '';   // YYYY string of last all-time reset

function scheduleAutoResets() {
  setInterval(async () => {
    const now     = new Date();
    const utcH    = now.getUTCHours();
    const utcM    = now.getUTCMinutes();
    const utcDay  = now.getUTCDay();    // 0=Sun
    const utcDate = now.getUTCDate();
    const utcMon  = now.getUTCMonth(); // 0=Jan
    const utcYear = now.getUTCFullYear();
    const todayKey = `${utcYear}-${utcMon}-${utcDate}`;
    const weekKey  = `${utcYear}-W${Math.floor(utcDate/7)}`;
    const yearKey  = `${utcYear}`;

    // ── Today: reset at 23:30 UTC (= 5:00 AM IST next day) ─────────────────
    if (utcH === 23 && utcM === 30 && _lastTodayReset !== todayKey) {
      _lastTodayReset = todayKey;
      try { await TodayLBEntry.deleteMany({}); console.log('[AutoReset] Today LB cleared (5am IST)'); }
      catch(e) { console.warn('[AutoReset] today clear error:', e.message); }
    }

    // ── Week: reset every Sunday at 23:30 UTC ────────────────────────────────
    if (utcDay === 0 && utcH === 23 && utcM === 30 && _lastWeekReset !== weekKey) {
      _lastWeekReset = weekKey;
      try { await WeekLBEntry.deleteMany({}); console.log('[AutoReset] Week LB cleared'); }
      catch(e) { console.warn('[AutoReset] week clear error:', e.message); }
    }

    // ── All-time: reset on Feb 18 at 00:00 UTC ───────────────────────────────
    if (utcMon === 1 && utcDate === 18 && utcH === 0 && utcM === 0 && _lastAllReset !== yearKey) {
      _lastAllReset = yearKey;
      try {
        await LeaderboardEntry.deleteMany({});
        console.log('[AutoReset] All-time LB cleared on Feb 18');
      } catch(e) { console.warn('[AutoReset] all-time clear error:', e.message); }
    }
  }, 60 * 1000);
}

// ── REST: reports ──────────────────────────────────────────────────────────────
app.get('/api/reports', requireHost, (req, res) => {
  res.json({ reports: questionReports });
});

app.delete('/api/reports/:rid', requireHost, async (req, res) => {
  const rid = parseInt(req.params.rid);
  questionReports = questionReports.filter(r => r.rid !== rid);
  try { await ReportDB.deleteOne({ rid }); } catch(e) {}
  txHost({ type: 'report_received', reports: questionReports });
  res.json({ ok: true });
});

// ── LEADERBOARD ROUTES ────────────────────────────────────────────────────────
// GET /api/leaderboard?period=today|week|all
//
// today  — sum of scores from SessionEntry since today's UTC midnight
// week   — sum of scores from SessionEntry in the rolling last-7-days window
// all    — cumulative totals from LeaderboardEntry (written on each shutdown)
//
// All three return: [{ userId:string, userName:string, totalScore:number, sessions:number }]
// sorted highest-first. userId is always a plain string so the client can safely
// compare it against currentUser.id (which is also a string from the JWT payload).

app.get('/api/leaderboard', async (req, res) => {
  try {
    const period = req.query.period || 'all';

    if (period === 'all') {
      const raw = await LeaderboardEntry.find().sort({ totalScore: -1 }).lean();
      return res.json({ leaderboard: raw.map(e => ({
        userId: String(e.userId), userName: e.userName || 'Unknown',
        totalScore: e.totalScore || 0, sessions: e.sessionsPlayed || 0,
      }))});
    }

    // today and week: read from dedicated collections
    const Model = period === 'today' ? TodayLBEntry : WeekLBEntry;
    const raw = await Model.find().sort({ score: -1 }).lean();

    // Look up fresh display names from users collection
    const userIds = raw.map(e => e.userId).filter(Boolean);
    const users   = await mongoose.model('User').find({ _id: { $in: userIds } }).select('name').lean();
    const nameMap = {};
    users.forEach(u => { nameMap[String(u._id)] = u.name; });

    const leaderboard = raw.map(e => ({
      userId:     String(e.userId),
      userName:   nameMap[String(e.userId)] || e.userName || 'Unknown',
      totalScore: e.score || 0,
      sessions:   1,
    }));
    res.json({ leaderboard });
  } catch (e) {
    console.error('/api/leaderboard error:', e.message);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// POST /api/leaderboard — called once per game day on Stop & Dismiss
// snap.score is the cumulative total for THIS game day only.
// We $inc onto the all-time record so scores accumulate across separate game days.
app.post('/api/leaderboard', requireAuth, async (req, res) => {
  try {
    const entries = req.body.entries;
    if (!Array.isArray(entries) || !entries.length)
      return res.status(400).json({ error: 'entries array required' });

    for (const e of entries) {
      if (!e.userId) continue;
      await LeaderboardEntry.findOneAndUpdate(
        { userId: e.userId },
        {
          $inc: { totalScore: e.totalScore || 0, sessionsPlayed: 1 },
          $set: { userName: e.userName, updatedAt: new Date() },
        },
        { upsert: true }
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Failed to save leaderboard' }); }
});

// ── SESSION HISTORY ROUTES ────────────────────────────────────────────────────

// GET /api/admin/sessions/:userId — host inspects any user's session history
app.get('/api/admin/sessions/:userId', requireHost, async (req, res) => {
  try {
    // Explicitly cast to ObjectId — Mongoose 8 does not auto-cast strings in find()
    let uid;
    try { uid = new mongoose.Types.ObjectId(req.params.userId); }
    catch(castErr) { return res.status(400).json({ error: 'Invalid user ID' }); }
    const sessions = await SessionEntry.find({ userId: uid })
      .sort({ date: -1 })
      .limit(100)
      .lean();
    const history = sessions.map(s => ({
      date:         s.date.toISOString(),
      score:        s.score,
      total:        s.total,
      correct:      s.correct,
      rank:         s.rank,
      participants: s.participants,
      fastestMs:    s.fastestMs ?? null,
    }));
    res.json({ history });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /api/sessions — return logged-in user's history (newest first, max 100)
app.get('/api/sessions', requireAuth, async (req, res) => {
  try {
    const sessions = await SessionEntry.find({ userId: req.user.id })
      .sort({ date: -1 })
      .limit(100)
      .lean();
    // Shape to match what the client expects
    const history = sessions.map(s => ({
      date:         s.date.toISOString(),
      score:        s.score,
      total:        s.total,
      correct:      s.correct,
      rank:         s.rank,
      participants: s.participants,
      fastestMs:    s.fastestMs ?? null,
    }));
    res.json({ history });
  } catch (e) {
    console.error('/api/sessions GET error:', e.message);
    res.status(500).json({ error: 'Failed to fetch session history' });
  }
});

// POST /api/sessions — save one session after a game ends
app.post('/api/sessions', requireAuth, async (req, res) => {
  try {
    const { date, score, total, correct, rank, participants, fastestMs } = req.body;

    // Skip if server already wrote an authoritative SessionEntry on shutdown (within last 3 min)
    // This prevents double-counting on the today/week leaderboard aggregation.
    const recentServer = await SessionEntry.findOne({
      userId: req.user.id,
      source: 'server',
      date:   { $gte: new Date(Date.now() - 3 * 60 * 1000) },
    }).lean();
    if (recentServer) return res.json({ ok: true });

    await SessionEntry.create({
      userId:       req.user.id,
      date:         date ? new Date(date) : new Date(),
      score:        Number(score)        || 0,
      total:        Number(total)        || 0,
      correct:      Number(correct)      || 0,
      rank:         Number(rank)         || 0,
      participants: Number(participants) || 0,
      fastestMs:    fastestMs != null ? Number(fastestMs) : null,
      source:       'client',
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('/api/sessions POST error:', e.message);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

// ── SELF QUIZ REPORT API ──────────────────────────────────────────────────────
// POST /api/selfquiz/report — host self-quiz sends flagged questions to the shared report list
app.post('/api/selfquiz/report', (req, res) => {
  try {
    const { question, correct, reporterName, note } = req.body;
    if (!question?.text) return res.status(400).json({ error: 'question.text required' });

    // De-duplicate by question text — only one report per question
    const existing = questionReports.find(r => r.question.text === question.text);
    if (existing) {
      existing.count   += 1;
      existing.note     = note || existing.note;
      existing.ts       = Date.now();
    } else {
      questionReports.push({
        rid:            ++reportCounter,
        question,
        correct:        correct ?? null,
        reportedAnswer: null,
        reporterName:   (reporterName || 'Host (Self Quiz)').slice(0, 40),
        reporterPids:   ['selfquiz'],
        note:           note || '',
        ts:             Date.now(),
        count:          1,
        source:         'selfquiz',
      });
    }

    // Notify the host via WebSocket if connected
    txHost({ type: 'report_received', reports: questionReports });
    res.json({ ok: true });
  } catch(e) {
    console.error('/api/selfquiz/report error:', e.message);
    res.status(500).json({ error: 'Failed to save report' });
  }
});

// GET /api/selfquiz/reports — fetch all current reports (host only)
app.get('/api/selfquiz/reports', requireHost, (req, res) => {
  res.json({ reports: questionReports });
});

// ── SESSION BACKUP HELPERS ────────────────────────────────────────────────────

/**
 * Returns the start/end of the current 5am-to-5am IST window.
 * IST = UTC+5:30, so 5:00 IST = 23:30 UTC the *previous* calendar day.
 */
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

/**
 * Persist CURRENT SESSION scores only to the sessionbackup collection.
 * Only tracks state.participants (live session) — NOT gameScores (banked previous sessions).
 * This ensures the backup reflects exactly one session: if restored, students get this
 * session's scores, not an accumulation of all sessions today.
 * Called after every 'reveal'. Cleared on reset (new session) and shutdown.
 */
async function saveSessionBackup() {
  try {
    const { windowStart, windowEnd } = getBackupWindow();

    // Only save participants from the current live session
    const participantList = Object.values(state.participants)
      .filter(p => p.userId)
      .map(p => ({
        userId:       String(p.userId),
        pid:          p.id,
        name:         p.name,
        currentScore: p.score || 0,
        bankedScore:  0,          // always 0 — backup is per-session only
        totalScore:   p.score || 0,
        updatedAt:    new Date(),
      }));

    if (!participantList.length) return;

    // Always overwrite completely — do not merge with previous session data
    await SessionBackup.findOneAndUpdate(
      { windowStart },
      { $set: { participants: participantList, updatedAt: new Date() } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch (e) {
    console.warn('[SessionBackup] save error:', e.message);
  }
}

/**
 * Look up a student's backed-up score for today's window by userId.
 */
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

// ── SESSION BACKUP REST API ───────────────────────────────────────────────────

// GET /api/session-backup — returns the current window's backup, sorted by totalScore desc.
// Host uses this to preview and/or import scores into a recovering session.
app.get('/api/session-backup', requireHost, async (req, res) => {
  try {
    const { windowStart, windowEnd } = getBackupWindow();
    // getBackupWindow is defined later in the file; mongoose query is lazy so it's fine.
    const backup = await SessionBackup.findOne({ windowStart }).lean();
    if (!backup) return res.json({ ok: true, found: false, participants: [], windowStart, windowEnd });
    const participants = backup.participants
      .slice()
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    res.json({ ok: true, found: true, participants, windowStart: backup.windowStart, windowEnd: backup.windowEnd, updatedAt: backup.updatedAt });
  } catch (e) {
    console.error('/api/session-backup GET error:', e.message);
    res.status(500).json({ error: 'Failed to fetch backup' });
  }
});

// POST /api/session-backup/restore — host imports backup scores into the live session.
// This merges backed-up totalScore into state.participants + gameScores so the
// restored scores show up on the leaderboard immediately and accumulate correctly.
app.post('/api/session-backup/restore', requireHost, async (req, res) => {
  try {
    const { windowStart } = getBackupWindow();
    const backup = await SessionBackup.findOne({ windowStart }).lean();
    if (!backup) return res.status(404).json({ error: 'No backup found for today\'s window' });

    let restored = 0;
    backup.participants.forEach(bp => {
      if (!bp.userId) return;
      const uid = String(bp.userId);

      // Find if this user already has live state entry
      const existing = Object.values(state.participants).find(
        p => p.userId && String(p.userId) === uid
      );

      // Check current total for this userId across ALL gameScores entries (by userId key)
      const gKey = `user_${uid}`;
      const bankedTotal = gameScores[gKey]?.total || 0;
      const liveScore   = existing?.score || 0;
      const currentTotal = bankedTotal + liveScore;
      const backupTotal  = bp.totalScore || 0;

      if (backupTotal <= currentTotal) return; // already at or above backup — skip
      const extra = backupTotal - currentTotal;

      if (existing) {
        existing.score = (existing.score || 0) + extra;
        // Ensure userId-keyed gameScores slot exists
        if (!gameScores[gKey]) {
          gameScores[gKey] = { name: existing.name, userId: existing.userId, total: 0 };
        }
        restored++;
      } else {
        // Student not currently in session — add to gameScores so they appear at shutdown
        if (!gameScores[gKey]) {
          gameScores[gKey] = { name: bp.name, userId: bp.userId, total: bp.totalScore };
          restored++;
        }
      }
    });

    broadcast();
    console.log(`[SessionBackup] Restored ${restored} participant(s) from backup`);
    res.json({ ok: true, restored, message: `${restored} participant score(s) restored from today's backup` });
  } catch (e) {
    console.error('/api/session-backup/restore error:', e.message);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// ── QUIZ STATE ────────────────────────────────────────────────────────────────
let state = fresh();
// gameScores: pid → { name, userId, total } — accumulates across resets within one game day
// Cleared only when the host explicitly does a full reset or shutdown
let gameScores = {};
// sessionSnapshots: array of { sessionNum, scores: [{id,name,score}] } — one entry per completed session
let sessionSnapshots = [];
let sessionCounter = 0;
// ── QUESTION REPORTS ──────────────────────────────────────────────────────────
// Students can flag questions they believe have a wrong answer
let questionReports = []; // { rid, question, correct, reportedAnswer, reporterName, reporterPids, ts, count }
let reportCounter = 0;

function bankGameScores() {
  const snap = [];
  Object.values(state.participants).forEach(p => {
    // Use userId as the canonical key if available, fall back to pid.
    // This prevents the same user from accumulating two separate gameScores entries
    // when they get a new pid after a reset (the root cause of score doubling).
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
  // Persist to backup so banked scores survive a server glitch / new-session
  saveSessionBackup().catch(e => console.warn('[SessionBackup] bankGameScores save failed:', e.message));
}
function fresh() {
  return {
    status:           'idle',
    sessionOpen:      false,
    question:         null,
    correct:          null,
    answers:          {},       // pid → optIdx
    answerTimes:      {},       // pid → seconds for the CURRENT question only
    cumulativeTimes:  {},       // pid → total seconds summed across all answered questions (tie-breaker)
    participants:     {},       // pid → { id, name, score, userId }
    history:          [],
    timerSeconds:     0,
    questionPushedAt: null,
    totalQuestions:   0,        // total questions loaded by host — used as denominator
    pushedCount:      0,        // how many questions have actually been pushed this session
  };
}

// ── SESSION BACKUP HELPERS ────────────────────────────────────────────────────

/**
 * Returns the start/end of the current 5am-to-5am IST window.
 * IST = UTC+5:30, so 5:00 IST = 23:30 UTC the *previous* calendar day.
 */

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
  // Build set of pids that currently have an active WebSocket connection
  const onlinePids = new Set();
  clients.forEach(c => { if (c.role === 'participant' && c.pid) onlinePids.add(c.pid); });

  // ── RANKED PARTICIPANTS ────────────────────────────────────────────────────
  // Per-question leaderboard (question / revealed / idle): score desc, time asc tie-breaker.
  // Final leaderboard (ended): score desc only — time tie-breaker does NOT apply.
  const isEnded = state.status === 'ended';
  const ranked = Object.values(state.participants)
    .map(p => ({ ...p, online: onlinePids.has(p.id) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;           // higher score first
      if (isEnded) return 0;                                       // final board: no time tie-breaker
      const tA = state.cumulativeTimes[a.id] ?? Infinity;          // no time → worst
      const tB = state.cumulativeTimes[b.id] ?? Infinity;
      return tA - tB;                                              // less time first
    })
    .map((p, i) => ({ ...p, rank: i + 1 }));                       // attach 1-based rank

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
    answerTimes:      state.answerTimes,       // per-question times (current question)
    cumulativeTimes:  state.cumulativeTimes,   // cumulative times for tie-breaking display
    totalQuestions:   state.totalQuestions,    // denominator — total questions loaded by host
    pushedCount:      state.pushedCount,       // questions actually pushed this session
  };
  if (role === 'host') return { ...base, correct: state.correct, answers: state.answers, history: state.history, sessionSnapshots, gameScores: Object.entries(gameScores).map(([pid,g])=>({id:pid,name:g.name,total:g.total})) };
  if (role === 'participant') {
    const myHistory = state.history.map(h => ({
      question: h.question, correct: h.correct, myAnswer: h.answers[pid] ?? null,
    }));
    return {
      ...base,
      correct:         (state.status === 'revealed' || state.status === 'ended') ? state.correct : null,
      myAnswer:        state.answers[pid] ?? null,
      myScore:         state.participants[pid]?.score ?? 0,
      myTime:          state.cumulativeTimes[pid] ?? null,  // own cumulative time
      myRank:          ranked.find(p => p.id === pid)?.rank ?? null,
      myHistory,
    };
  }
  return { status: base.status, sessionOpen: base.sessionOpen, participants: ranked };
}

// ── WEBSOCKET ─────────────────────────────────────────────────────────────────
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
        // Send any existing reports accumulated before host connected
        if (questionReports.length) tx(ws, { type: 'report_received', reports: questionReports });
        break;

      case 'join': {
        if (!msg.name?.trim()) break;
        let pid = msg.pid;

        // ── Reconnect path 1: same pid still alive in state ─────────────────
        if (pid && state.participants[pid]) {
          state.participants[pid].name = msg.name.trim().slice(0, 32);
          if (!state.participants[pid].userId && msg.userId)
            state.participants[pid].userId = msg.userId;

        // ── Reconnect path 2: same userId, different pid (page-refresh) ──────
        } else if (msg.userId) {
          const existingByUser = Object.values(state.participants)
            .find(p => p.userId && String(p.userId) === String(msg.userId));

          if (existingByUser) {
            // Reuse the existing participant entry — no duplicate created
            pid = existingByUser.id;
            existingByUser.name = msg.name.trim().slice(0, 32);
          } else {
            // ── Brand-new join: check backup to restore score ────────────────
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
            // Restore banked score using the userId-keyed gameScores convention.
            // This ensures bankGameScores() will find and merge into the same slot
            // rather than creating a new duplicate entry.
            if (restoredBanked > 0 || restoredCurrent > 0) {
              const gKey = `user_${msg.userId}`;
              if (!gameScores[gKey]) {
                gameScores[gKey] = {
                  name:   msg.name.trim().slice(0, 32),
                  userId: msg.userId || null,
                  total:  restoredBanked,
                };
              }
              // Also map the pid so project() / shutdown can find it
              gameScores[pid] = gameScores[gKey];
            }
          }

        } else {
          // ── Guest (no userId): reconnect by pid or create fresh entry ───────
          if (!pid || !state.participants[pid]) {
            pid = `p${cid}_${Date.now()}`;
            state.participants[pid] = {
              id: pid, name: msg.name.trim().slice(0, 32), score: 0, userId: null,
            };
          } else {
            state.participants[pid].name = msg.name.trim().slice(0, 32);
          }
        }

        client.role = 'participant'; client.pid = pid;
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
        // ── Idempotent: if session is already open, just confirm without touching state ──
        // This prevents a host WS reconnect from re-triggering open_session effects.
        if (state.sessionOpen) {
          tx(ws, { type: 'open_session_result', ok: true });
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
        state.answerTimes      = {};
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
          // Accumulate time for every participant who answered (tie-breaker: less total time = better rank)
          if (state.answerTimes[pid] != null) {
            state.cumulativeTimes[pid] = parseFloat(
              ((state.cumulativeTimes[pid] || 0) + state.answerTimes[pid]).toFixed(2)
            );
          }
        });
        state.history.push({ question: state.question, correct: state.correct, answers: { ...state.answers } });
        state.status = 'revealed'; state.timerSeconds = 0;
        broadcast();
        // ── Persist to sessionbackup after every reveal ──────────────────────
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
            // Accumulate time for this final question too
            if (state.answerTimes[pid] != null) {
              state.cumulativeTimes[pid] = parseFloat(
                ((state.cumulativeTimes[pid] || 0) + state.answerTimes[pid]).toFixed(2)
              );
            }
          });
          state.history.push({ question: state.question, correct: state.correct, answers: { ...state.answers } });
        }
        state.status = 'ended';
        // NOTE: we do NOT persist to LeaderboardEntry here.
        // persistLeaderboard is only called from shutdown, which uses gameScores
        // (the true cumulative total across all sessions in a game day).
        // Calling it here would cause double-counting when the host later shuts down.
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
        {
          // 1. Capture current leaderboard BEFORE banking — this becomes the preview snapshot
          const previewParticipants = Object.values(state.participants)
            .slice()
            .sort((a, b) => b.score - a.score);
          const previewTotal = state.pushedCount || 0;

          // 2. Bank current session scores into gameScores
          bankGameScores();

          // 3. Clear backup so new session starts fresh (single-session backup contract)
          (async () => {
            try {
              const { windowStart } = getBackupWindow();
              await SessionBackup.deleteOne({ windowStart });
              console.log('[SessionBackup] Cleared on new session (reset).');
            } catch (e) { console.warn('[SessionBackup] clear on reset failed:', e.message); }
          })();

          // 4. Send session_preview to participants — they see the last session's scores
          //    and wait on that screen until the host pushes the first question of the new session.
          clients.forEach((c) => {
            if (c.role === 'participant')
              tx(c.ws, { type: 'session_preview', payload: { participants: previewParticipants, totalQuestions: previewTotal } });
          });

          // 5. Reset state to fresh (0 scores) and re-add currently connected participants
          state = fresh();
          state.sessionOpen = true;
          clients.forEach((c) => {
            if (c.role === 'participant' && c.pid && c.name) {
              state.participants[c.pid] = { id: c.pid, name: c.name, score: 0, userId: c.userId || null };
              if (c.userId) {
                const gKey = `user_${c.userId}`;
                if (gameScores[gKey] && !gameScores[c.pid]) {
                  gameScores[c.pid] = gameScores[gKey];
                }
              }
            }
          });
          broadcast();
          if (questionReports.length) txHost({ type: 'report_received', reports: questionReports });
        }
        break;

      // halt: sends halted message to students, host sees the halt menu
      case 'halt':
        if (client.role !== 'host') break;
        {
          const haltParticipants = Object.values(state.participants)
            .slice()
            .sort((a, b) => b.score - a.score);
          clients.forEach((c) => {
            if (c.role === 'participant')
              tx(c.ws, { type: 'halted', payload: { participants: haltParticipants, totalQuestions: state.pushedCount } });
          });
          // Write current session scores to today + week leaderboards
          (async () => {
            for (const p of haltParticipants) {
              if (!p.userId || String(p.userId).startsWith('p')) continue;
              try {
                await TodayLBEntry.findOneAndUpdate(
                  { userId: p.userId },
                  { $inc: { score: p.score || 0 }, $set: { userName: p.name, updatedAt: new Date() } },
                  { upsert: true }
                );
                await WeekLBEntry.findOneAndUpdate(
                  { userId: p.userId },
                  { $inc: { score: p.score || 0 }, $set: { userName: p.name, updatedAt: new Date() } },
                  { upsert: true }
                );
              } catch(e) { console.warn('[LB] halt write error:', e.message); }
            }
          })();
        }
        broadcast();
        break;

      // shutdown: bank scores, persist to DB, dismiss all students, reset state
      case 'shutdown':
        if (client.role !== 'host') break;
        {
          // Write SessionEntry for every participant BEFORE banking so we have per-session scores
          // This makes today/week leaderboard data reliable regardless of client connectivity
          const sdParts   = Object.values(state.participants);
          const sdTotal   = state.pushedCount || state.history.length || 0;
          const sdSorted  = sdParts.slice().sort((a, b) => b.score - a.score);
          const sdParticipantCount = sdParts.length;
          const sdNow     = new Date();
          (async () => {
            for (const p of sdParts) {
              if (!p.userId || String(p.userId).startsWith('p')) continue;
              const rank    = sdSorted.findIndex(s => s.id === p.id) + 1;
              const correct = state.history.reduce((n, h) => (h.answers[p.id] === h.correct ? n + 1 : n), 0);
              try {
                await SessionEntry.create({
                  userId:       p.userId,
                  date:         sdNow,
                  score:        p.score || 0,
                  total:        sdTotal,
                  correct,
                  rank:         rank || 0,
                  participants: sdParticipantCount,
                  fastestMs:    null,
                  source:       'server',
                });
              } catch (e) { console.warn('[SessionEntry] server write error:', e.message); }
            }
          })();

          bankGameScores();
          // De-duplicate gameScores by userId before computing final leaderboard.
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
          clients.forEach((c) => {
            if (c.role === 'participant') {
              tx(c.ws, { type: 'kicked', payload: { finalLeaderboard, totalQuestions: state.pushedCount } });
              c.role = null; c.pid = null;
            }
          });
          // Clear the session backup on shutdown
          (async () => {
            try {
              const { windowStart } = getBackupWindow();
              await SessionBackup.deleteOne({ windowStart });
              console.log('[SessionBackup] Cleared on shutdown.');
            } catch (e) { console.warn('[SessionBackup] clear on shutdown failed:', e.message); }
          })();
        }
        gameScores = {};
        sessionSnapshots = [];
        sessionCounter = 0;
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
        // Record timeTaken sent by the student — this is the authoritative source
        if (typeof msg.timeTaken === 'number' && msg.timeTaken >= 0)
          state.answerTimes[client.pid] = parseFloat(msg.timeTaken.toFixed(2));
        broadcast();
        break;

      // ── RAISE HAND / SPEAK REQUEST ────────────────────────────────────────────
      case 'raise_hand': {
        // Legacy alias — treat as speak_request so old clients still work
        if (client.role !== 'participant' || !client.pid) break;
        const raiseName = (msg.name || client.name || 'A student').slice(0, 40);
        txHost({ type: 'speak_request', name: raiseName, pid: client.pid, fromCid: cid });
        break;
      }
      case 'speak_request': {
        if (client.role !== 'participant' || !client.pid) break;
        txHost({ type: 'speak_request', name: (client.name||'A student').slice(0,40), pid: client.pid, fromCid: cid });
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

      // ── UPDATE QUESTION (host fix via report) ────────────────────────────────
      case 'update_question': {
        if (client.role !== 'host') break;
        if (!msg.question?.text || !Array.isArray(msg.question.options)) break;
        // Only update if this question is currently live/revealed
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
        const existingRep = questionReports.find(r =>
          r.question.text === msg.question.text && r.reporterPids.includes(client.pid)
        );
        if (existingRep) break;
        const dupRep = questionReports.find(r => r.question.text === msg.question.text);
        if (dupRep) {
          dupRep.count += 1;
          dupRep.reporterPids.push(client.pid);
          ReportDB.findOneAndUpdate({ rid: dupRep.rid }, { count: dupRep.count, reporterPids: dupRep.reporterPids }).catch(()=>{});
        } else {
          const newRep = {
            rid:            ++reportCounter,
            question:       msg.question,
            correct:        msg.correct ?? null,
            reportedAnswer: msg.reportedAnswer ?? null,
            reporterName:   client.name || 'Unknown',
            reporterPids:   [client.pid],
            ts:             Date.now(),
            count:          1,
          };
          questionReports.push(newRep);
          ReportDB.create(newRep).catch(()=>{});
        }
        txHost({ type: 'report_received', reports: questionReports });
        break;
      }

      // ── DISMISS REPORT (host only) ───────────────────────────────────────────
      case 'dismiss_report': {
        if (client.role !== 'host') break;
        questionReports = questionReports.filter(r => r.rid !== msg.rid);
        ReportDB.deleteOne({ rid: msg.rid }).catch(()=>{});
        txHost({ type: 'report_received', reports: questionReports });
        break;
      }

      // ── RESTORE BACKUP (host only — load today's backup into live scores) ───────
      case 'restore_backup': {
        if (client.role !== 'host') break;
        (async () => {
          try {
            const { windowStart } = getBackupWindow();
            const backup = await SessionBackup.findOne({ windowStart }).lean();
            if (!backup) { txHost({ type: 'backup_restore_result', ok: false, message: 'No backup found for today\'s window.' }); return; }

            // Build imported leaderboard for host overlay display
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

              if (backupTotal <= currentTotal) return; // nothing to restore
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
    const c = clients.get(cid);
    // When a participant disconnects we intentionally keep their entry in
    // state.participants so their score survives a page refresh / reconnect.
    // We only clear their answers so the answer-count stays accurate.
    if (c?.role === 'participant' && c.pid) {
      delete state.answers[c.pid];
      // Mark as offline so host can see who is still connected (optional broadcast)
      broadcast();
    }
    if (cid === hostCid) hostCid = null;
    clients.delete(cid);
  });
});

// ── LEADERBOARD HELPER ───────────────────────────────────────────────────────
async function persistLeaderboard(entries) {
  try {
    for (const p of entries) {
      const uid = p.userId || p.id;
      if (!uid || uid.toString().startsWith('p')) continue; // skip guests
      // All-time
      await LeaderboardEntry.findOneAndUpdate(
        { userId: uid },
        { $inc: { totalScore: p.score || 0, sessionsPlayed: 1 }, $set: { userName: p.name, updatedAt: new Date() } },
        { upsert: true }
      );
      // Today
      await TodayLBEntry.findOneAndUpdate(
        { userId: uid },
        { $inc: { score: p.score || 0 }, $set: { userName: p.name, updatedAt: new Date() } },
        { upsert: true }
      );
      // Week
      await WeekLBEntry.findOneAndUpdate(
        { userId: uid },
        { $inc: { score: p.score || 0 }, $set: { userName: p.name, updatedAt: new Date() } },
        { upsert: true }
      );
    }
  } catch (e) {
    console.warn('Leaderboard persist error:', e.message);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Shadab Coaching Centre → http://localhost:${PORT}`));
