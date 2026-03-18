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
  .then(() => console.log('MongoDB connected — db:', mongoose.connection.db.databaseName))
  .catch(e  => console.error('MongoDB connection FAILED:', e.message));

const userSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 50 },
  email:       { type: String, required: true, trim: true, lowercase: true, unique: true },
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
  email:     { type: String, required: true, trim: true, lowercase: true, unique: true },
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

// Register — creates a PendingReg entry; host must approve before account is active
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, username, password } = req.body;
    if (!name?.trim())  return res.status(400).json({ error: 'Full name is required' });
    if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return res.status(400).json({ error: 'Enter a valid email address' });
    if (!password)      return res.status(400).json({ error: 'Password is required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const uname = username?.trim() || null;
    if (uname) {
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(uname))
        return res.status(400).json({ error: 'Username must be 3–30 characters: letters, numbers, underscores only' });
      if (await User.findOne({ username: uname.toLowerCase() }))
        return res.status(400).json({ error: 'Username already taken' });
      if (await PendingReg.findOne({ username: uname.toLowerCase() }))
        return res.status(400).json({ error: 'Username already taken' });
    }

    if (await User.findOne({ email: email.trim().toLowerCase() }))
      return res.status(400).json({ error: 'An account with this email already exists' });
    if (await PendingReg.findOne({ email: email.trim().toLowerCase() }))
      return res.status(400).json({ error: 'A registration request with this email is already pending' });

    const hashed = await bcrypt.hash(password, 10);
    await PendingReg.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      username: uname ? uname.toLowerCase() : null,
      password: hashed,
    });
    res.json({ pending: true, message: 'Registration submitted! Your account is pending approval by the host.' });
  } catch (e) {
    if (e.code === 11000) {
      const field = Object.keys(e.keyPattern || {})[0] || '';
      if (field === 'email') return res.status(400).json({ error: 'An account with this email already exists' });
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
    if (await User.findOne({ email: pr.email })) {
      await PendingReg.findByIdAndDelete(pr._id);
      return res.status(400).json({ error: 'Email already registered' });
    }
    const newUser = await User.create({ name: pr.name, email: pr.email, username: pr.username || null, password: pr.password, role: 'student', status: 'approved' });
    console.log('[approve] User created:', newUser._id, newUser.email);
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

    // ── ALL-TIME ───────────────────────────────────────────────────────────────
    if (period === 'all') {
      const raw = await LeaderboardEntry.find()
        .sort({ totalScore: -1 })
        .lean();
      const leaderboard = raw.map(e => ({
        userId:       String(e.userId),          // ObjectId → string
        userName:     e.userName || 'Unknown',
        totalScore:   e.totalScore   || 0,
        sessions:     e.sessionsPlayed || 0,
      }));
      return res.json({ leaderboard });
    }

    // ── TODAY / WEEK (aggregate from SessionEntry) ─────────────────────────────
    // "today"  = from 05:00 IST today  (IST = UTC+5:30, so 05:00 IST = 23:30 UTC previous day)
    // "week"   = rolling 7-day window from exactly 7*24h ago
    let since;
    if (period === 'today') {
      // Find the most recent 23:30 UTC (= 05:00 IST next calendar day)
      const now = new Date();
      // Build candidate: 23:30 UTC on the current UTC date
      const candidate = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
        23, 30, 0, 0
      ));
      // If we haven't reached 23:30 UTC today yet, roll back to yesterday's 23:30 UTC
      since = candidate > now
        ? new Date(candidate.getTime() - 24 * 60 * 60 * 1000)
        : candidate;
    } else {
      since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    const entries = await SessionEntry.aggregate([
      // Step 1: only sessions within the requested window
      { $match: { date: { $gte: since } } },

      // Step 2: sum score per user
      {
        $group: {
          _id:        '$userId',
          totalScore: { $sum: '$score' },
          sessions:   { $sum:  1      },
        },
      },

      // Step 3: sort highest first
      { $sort: { totalScore: -1 } },

      // Step 4: pull display name from users collection
      {
        $lookup: {
          from:         'users',
          localField:   '_id',
          foreignField: '_id',
          as:           'userDoc',
        },
      },

      // Step 5: flatten the joined array (preserveNull handles deleted accounts)
      { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },

      // Step 6: project clean fields only — suppress _id, stringify userId
      {
        $project: {
          _id:        0,
          userId:     { $toString: '$_id' },
          userName:   { $ifNull: ['$userDoc.name', 'Unknown'] },
          totalScore: 1,
          sessions:   1,
        },
      },
    ]);

    res.json({ leaderboard: entries });
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
    await SessionEntry.create({
      userId:       req.user.id,
      date:         date ? new Date(date) : new Date(),
      score:        Number(score)        || 0,
      total:        Number(total)        || 0,
      correct:      Number(correct)      || 0,
      rank:         Number(rank)         || 0,
      participants: Number(participants) || 0,
      fastestMs:    fastestMs != null ? Number(fastestMs) : null,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('/api/sessions POST error:', e.message);
    res.status(500).json({ error: 'Failed to save session' });
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
    if (!gameScores[p.id]) {
      gameScores[p.id] = { name: p.name, userId: p.userId || null, total: 0 };
    }
    const pts = p.score || 0;
    gameScores[p.id].total  += pts;
    gameScores[p.id].name    = p.name;
    gameScores[p.id].userId  = p.userId || gameScores[p.id].userId;
    snap.push({ id: p.id, name: p.name, score: pts });
  });
  if (snap.length) {
    sessionCounter += 1;
    sessionSnapshots.push({ sessionNum: sessionCounter, scores: snap });
  }
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

  ws.on('message', raw => {
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
        // Reconnect path: participant already exists in state (disconnected but not removed)
        if (pid && state.participants[pid]) {
          // Restore their session — keep score and userId intact
          state.participants[pid].name = msg.name.trim().slice(0, 32); // refresh name in case of display name change
          if (!state.participants[pid].userId && msg.userId) state.participants[pid].userId = msg.userId;
        } else {
          // New join — assign a fresh pid
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
        // Bank current session scores before wiping
        bankGameScores();
        state = fresh();
        clients.forEach((c) => {
          if (c.role === 'participant' && c.pid && c.name)
            state.participants[c.pid] = { id: c.pid, name: c.name, score: 0, userId: c.userId || null };
        });
        broadcast();
        // Re-send any persisted reports so host sees them after new session starts
        if (questionReports.length) txHost({ type: 'report_received', reports: questionReports });
        break;

      // halt: sends halted message to students, host sees the halt menu
      case 'halt':
        if (client.role !== 'host') break;
        {
          // Final halt leaderboard: score only — no time tie-breaker
          const haltParticipants = Object.values(state.participants)
            .slice()
            .sort((a, b) => b.score - a.score);
          clients.forEach((c) => {
            if (c.role === 'participant')
              tx(c.ws, { type: 'halted', payload: { participants: haltParticipants, totalQuestions: state.pushedCount } });
          });
        }
        broadcast();
        break;

      // shutdown: bank scores, persist to DB, dismiss all students, reset state
      case 'shutdown':
        if (client.role !== 'host') break;
        bankGameScores();
        {
          const finalLeaderboard = Object.entries(gameScores)
            .map(([pid, g]) => ({ id: pid, name: g.name, userId: g.userId, score: g.total }))
            .sort((a, b) => b.score - a.score);
          persistLeaderboard(finalLeaderboard);
          clients.forEach((c) => {
            if (c.role === 'participant') {
              tx(c.ws, { type: 'kicked', payload: { finalLeaderboard, totalQuestions: state.pushedCount } });
              c.role = null; c.pid = null;
            }
          });
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

      // ── RAISE HAND ──────────────────────────────────────────────────────────
      case 'raise_hand': {
        if (client.role !== 'participant' || !client.pid) break;
        const raiseName = (msg.name || client.name || 'A student').slice(0, 40);
        txHost({ type: 'hand_raised', name: raiseName, pid: client.pid });
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
      // Student flags a question they believe has an incorrect answer key
      case 'report_question': {
        if (client.role !== 'participant' || !client.pid) break;
        if (!msg.question?.text) break;
        // De-duplicate: one report per student per question text
        const existingRep = questionReports.find(r =>
          r.question.text === msg.question.text && r.reporterPids.includes(client.pid)
        );
        if (existingRep) break;
        const dupRep = questionReports.find(r => r.question.text === msg.question.text);
        if (dupRep) {
          // Already reported — just add this student to it
          dupRep.count += 1;
          dupRep.reporterPids.push(client.pid);
        } else {
          questionReports.push({
            rid:           ++reportCounter,
            question:      msg.question,
            correct:       msg.correct ?? null,
            reportedAnswer: msg.reportedAnswer ?? null,
            reporterName:  client.name || 'Unknown',
            reporterPids:  [client.pid],
            ts:            Date.now(),
            count:         1,
          });
        }
        // Notify host immediately
        txHost({ type: 'report_received', reports: questionReports });
        break;
      }

      // ── DISMISS REPORT (host only) ───────────────────────────────────────────
      case 'dismiss_report': {
        if (client.role !== 'host') break;
        questionReports = questionReports.filter(r => r.rid !== msg.rid);
        txHost({ type: 'report_received', reports: questionReports });
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
      if (!uid || uid.startsWith('p')) continue; // skip non-ObjectId pids (guests)
      await LeaderboardEntry.findOneAndUpdate(
        { userId: uid },
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
