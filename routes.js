'use strict';

const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const mongoose = require('mongoose');
const {
  User, PendingReg, UpdateReq, Notice, Schedule,
  LeaderboardEntry, ScoreLog, SessionEntry, ReportDB,
  PlannedTest, TestAttempt,
} = require('./models');
const { shared, txHost, getBackupWindow } = require('./ws');
const { SessionBackup } = require('./models');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';

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

// ── PLANNED TEST HELPERS ──────────────────────────────────────────────────────
// Returns the wall-clock timestamp (ms) at which an attempt must be auto-closed,
// or null if the test has no time limit. Anchored to the attempt's original
// startedAt so leaving/rejoining can never extend the clock.
function attemptDeadline(test, startedAt) {
  const started = new Date(startedAt).getTime();
  if (test.timerType === 'total') return started + (test.timerValue || 0) * 1000;
  if (test.timerType === 'perQuestion') return started + (test.timerValue || 0) * (test.questions?.length || 0) * 1000;
  return null; // 'none' — no deadline
}

// Scores whatever answers are on the attempt and marks it completed. Used both
// for normal submissions and for server-side auto-submission of attempts whose
// time ran out while the student was disconnected.
async function finalizeAttempt(attempt, test, { auto = false } = {}) {
  let correct = 0, incorrect = 0, skipped = 0;
  test.questions.forEach((q, i) => {
    const a = attempt.answers[i];
    if (a === null || a === undefined) skipped++;
    else if (a === q.correct) correct++;
    else incorrect++;
  });
  attempt.correct = correct;
  attempt.incorrect = incorrect;
  attempt.skipped = skipped;
  attempt.score = correct;
  attempt.completed = true;
  attempt.submittedAt = new Date();
  attempt.autoSubmitted = auto;
  await attempt.save();
  return { correct, incorrect, skipped, score: correct, total: test.questions.length };
}

// Periodic sweep: closes out any in-progress attempt whose time budget has
// expired, even if the student never reopens the app. This is what makes the
// "leave and the test just sits there" loophole impossible — the clock keeps
// running and the test gets force-submitted on schedule regardless of presence.
async function sweepExpiredAttempts() {
  try {
    const inProgress = await TestAttempt.find({ completed: false }).lean();
    if (!inProgress.length) return;
    const testIds = [...new Set(inProgress.map(a => a.testId.toString()))];
    const tests = await PlannedTest.find({ _id: { $in: testIds } }).lean();
    const testMap = new Map(tests.map(t => [t._id.toString(), t]));
    for (const a of inProgress) {
      const test = testMap.get(a.testId.toString());
      if (!test) continue;
      const deadline = attemptDeadline(test, a.startedAt);
      if (deadline !== null && Date.now() > deadline) {
        const doc = await TestAttempt.findById(a._id);
        if (doc && !doc.completed) await finalizeAttempt(doc, test, { auto: true });
      }
    }
  } catch (e) { console.warn('[Tests] sweep error:', e.message); }
}

// ── ROUTE REGISTRATION ────────────────────────────────────────────────────────
function initRoutes(app) {
  // Run every 20 s — frequent enough that a student can never sit on an
  // expired/unattended test for long, cheap enough not to matter at this scale.
  setInterval(sweepExpiredAttempts, 20 * 1000);

  // ── AUTH ────────────────────────────────────────────────────────────────────

  app.post('/api/register', async (req, res) => {
    try {
      const { name, email, username, password } = req.body;
      if (!name?.trim())  return res.status(400).json({ error: 'Full name is required' });
      if (!password)      return res.status(400).json({ error: 'Password is required' });
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

      // Email is optional for new users — validate only if provided
      const emailVal = email?.trim() || null;
      if (emailVal) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal))
          return res.status(400).json({ error: 'Enter a valid email address' });
      }

      // Username is required for new users (replaces email as primary identifier)
      const uname = username?.trim() || null;
      if (!uname) return res.status(400).json({ error: 'Username is required' });
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(uname))
        return res.status(400).json({ error: 'Username must be 3–30 characters: letters, numbers, underscores only' });
      if (await User.findOne({ username: uname.toLowerCase() }))
        return res.status(400).json({ error: 'Username already taken' });
      if (await PendingReg.findOne({ username: uname.toLowerCase() }))
        return res.status(400).json({ error: 'Username already taken' });

      // Check email uniqueness only if an email was provided
      if (emailVal) {
        if (await User.findOne({ email: emailVal.toLowerCase() }))
          return res.status(400).json({ error: 'An account with this email already exists' });
        if (await PendingReg.findOne({ email: emailVal.toLowerCase() }))
          return res.status(400).json({ error: 'A registration request with this email is already pending' });
      }

      const hashed = await bcrypt.hash(password, 10);
      const pendingDoc = {
        name: name.trim(),
        username: uname.toLowerCase(),
        password: hashed,
      };
      // Only set email if one was actually provided — omitting it entirely avoids
      // the sparse-index conflict that null would cause with other no-email users
      if (emailVal) pendingDoc.email = emailVal.toLowerCase();
      await PendingReg.create(pendingDoc);
      res.json({ pending: true, message: 'Registration submitted! Your account is pending approval by the host.' });
    } catch (e) {
      if (e.code === 11000) {
        const field = Object.keys(e.keyPattern || {})[0] || '';
        if (field === 'username') return res.status(400).json({ error: 'Username already taken' });
        if (field === 'email')    return res.status(400).json({ error: 'An account with this email already exists' });
        return res.status(400).json({ error: 'Username already taken — please choose another' });
      }
      console.error('Register error:', e.message);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

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
      if (user.role !== 'host' && user.status === 'pending')
        return res.status(403).json({ error: 'Your account is pending approval by the host.' });

      const token = jwt.sign(
        { id: user._id, name: user.name, email: user.email || '', username: user.username || '', role: user.role },
        JWT_SECRET, { expiresIn: '7d' }
      );
      res.json({ token, user: { id: user._id, name: user.name, email: user.email || '', username: user.username || '', role: user.role } });
    } catch (e) { res.status(500).json({ error: 'Login failed' }); }
  });

  app.get('/api/check-username', async (req, res) => {
    try {
      const { username } = req.query;
      if (!username || !/^[a-zA-Z0-9_]{3,30}$/.test(username.trim()))
        return res.json({ available: false });
      const exists = await User.findOne({ username: username.trim().toLowerCase() }).lean();
      res.json({ available: !exists });
    } catch (e) { res.status(500).json({ available: false }); }
  });

  app.get('/api/me', requireAuth, async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select('-password').lean();
      if (!user) return res.status(401).json({ error: 'Account not found' });
      const token = jwt.sign(
        { id: user._id, name: user.name, email: user.email || '', username: user.username || '', role: user.role },
        JWT_SECRET, { expiresIn: '7d' }
      );
      res.json({ token, user: { id: user._id, name: user.name, email: user.email || '', username: user.username || '', role: user.role } });
    } catch (e) {
      console.error('/api/me error:', e.message);
      res.status(500).json({ error: 'Server error' });
    }
  });

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

  app.post('/api/update-name', requireAuth, async (req, res) => {
    try {
      const { displayName } = req.body;
      if (!displayName?.trim()) return res.status(400).json({ error: 'Display name required' });
      if (displayName.trim().length > 32) return res.status(400).json({ error: 'Max 32 characters' });

      if (req.user.role === 'host') {
        const user = await User.findByIdAndUpdate(req.user.id, { name: displayName.trim() }, { new: true });
        const token = jwt.sign({ id: user._id, name: user.name, email: user.email || '', username: user.username || '', role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({ ok: true, token, user: { id: user._id, name: user.name, email: user.email || '', username: user.username || '', role: user.role } });
      }

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
        const user = await User.findByIdAndUpdate(req.user.id, { username: uname }, { new: true });
        const token = jwt.sign({ id: user._id, name: user.name, email: user.email || '', username: user.username || '', role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({ ok: true, token, user: { id: user._id, name: user.name, email: user.email || '', username: user.username || '', role: user.role } });
      }

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

  // ── ADMIN ───────────────────────────────────────────────────────────────────

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
      // Check email conflict only if email was provided
      if (pr.email && await User.findOne({ email: pr.email })) {
        await PendingReg.findByIdAndDelete(pr._id);
        return res.status(400).json({ error: 'Email already registered' });
      }
      const newUserDoc = {
        name: pr.name,
        username: pr.username || undefined,
        password: pr.password,
        role: 'student',
        status: 'approved',
      };
      // Only set email if it was provided — omit entirely to avoid sparse-index conflict
      if (pr.email) newUserDoc.email = pr.email;
      const newUser = await User.create(newUserDoc);
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

  app.get('/api/admin/users', requireHost, async (req, res) => {
    try {
      const users = await User.find().sort({ createdAt: 1 }).select('-password').lean();
      res.json({ users: users.map(u => ({
        id: u._id, name: u.name, email: u.email || '', username: u.username || '',
        role: u.role, status: u.status, createdAt: u.createdAt,
      }))});
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
  });

  app.delete('/api/admin/users/:id', requireHost, async (req, res) => {
    try {
      const uid = req.params.id;
      if (uid === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
      const user = await User.findById(uid);
      if (!user) return res.status(404).json({ error: 'User not found' });
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

  // ── NOTICE ──────────────────────────────────────────────────────────────────

  app.get('/api/notice', async (req, res) => {
    try {
      const n = await Notice.findOne().lean();
      res.json({ text: n?.text || '' });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/notice', requireHost, async (req, res) => {
    try {
      const { text } = req.body;
      await Notice.findOneAndUpdate({}, { text: (text || '').slice(0, 500), updatedAt: new Date() }, { upsert: true });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
  });

  // ── SCHEDULES ────────────────────────────────────────────────────────────────

  app.get('/api/schedules', async (req, res) => {
    try {
      const schedules = await Schedule.find({ ts: { $gt: Date.now() - 3600000 } }).sort({ ts: 1 }).lean();
      res.json({ schedules });
    } catch (e) { res.status(500).json({ error: 'Failed to fetch schedules' }); }
  });

  app.post('/api/schedules', requireAuth, async (req, res) => {
    try {
      const { title, ts, notes } = req.body;
      if (!title?.trim() || !ts) return res.status(400).json({ error: 'Title and timestamp required' });
      if (ts <= Date.now()) return res.status(400).json({ error: 'Timestamp must be in the future' });
      const schedule = await Schedule.create({ title: title.trim(), ts, notes: notes?.trim() || '' });
      res.json({ ok: true, schedule });
    } catch (e) { res.status(500).json({ error: 'Failed to create schedule' }); }
  });

  app.delete('/api/schedules/:id', requireAuth, async (req, res) => {
    try {
      const result = await Schedule.findByIdAndDelete(req.params.id);
      if (!result) return res.status(404).json({ error: 'Schedule not found' });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Failed to delete schedule' }); }
  });

  // ── LEADERBOARD ──────────────────────────────────────────────────────────────

  app.get('/api/leaderboard', async (req, res) => {
    try {
      const period = req.query.period || 'all';

      // ── All-time: read from the cumulative LeaderboardEntry table ─────────
      if (period === 'all') {
        const raw = await LeaderboardEntry.find().sort({ totalScore: -1 }).lean();
        return res.json({ leaderboard: raw.map(e => ({
          userId:     String(e.userId),
          userName:   e.userName || 'Unknown',
          totalScore: e.totalScore || 0,
          sessions:   e.sessionsPlayed || 0,
        }))});
      }

      // ── Today / Week: aggregate ScoreLog entries within the date window ───
      const now = new Date();
      let since;
      if (period === 'today') {
        // Midnight of the current UTC day
        since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      } else {
        // Rolling 7-day window
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      const agg = await ScoreLog.aggregate([
        { $match: { date: { $gte: since } } },
        { $group: {
            _id:        '$userId',
            totalScore: { $sum: '$score' },
            userName:   { $last: '$userName' },
            sessions:   { $sum: 1 },
        }},
        { $sort: { totalScore: -1 } },
      ]);

      return res.json({ leaderboard: agg.map(e => ({
        userId:     String(e._id),
        userName:   e.userName || 'Unknown',
        totalScore: e.totalScore || 0,
        sessions:   e.sessions  || 1,
      }))});
    } catch (e) {
      console.error('/api/leaderboard error:', e.message);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  app.post('/api/leaderboard', requireAuth, async (req, res) => {
    try {
      const entries = req.body.entries;
      if (!Array.isArray(entries) || !entries.length)
        return res.status(400).json({ error: 'entries array required' });
      for (const e of entries) {
        if (!e.userId) continue;
        await LeaderboardEntry.findOneAndUpdate(
          { userId: e.userId },
          { $inc: { totalScore: e.totalScore || 0, sessionsPlayed: 1 }, $set: { userName: e.userName, updatedAt: new Date() } },
          { upsert: true }
        );
      }
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Failed to save leaderboard' }); }
  });

  // ── SESSION HISTORY ──────────────────────────────────────────────────────────

  app.get('/api/admin/sessions/:userId', requireHost, async (req, res) => {
    try {
      let uid;
      try { uid = new mongoose.Types.ObjectId(req.params.userId); }
      catch(castErr) { return res.status(400).json({ error: 'Invalid user ID' }); }
      const sessions = await SessionEntry.find({ userId: uid }).sort({ date: -1 }).limit(100).lean();
      res.json({ history: sessions.map(s => ({
        date: s.date.toISOString(), score: s.score, total: s.total,
        correct: s.correct, rank: s.rank, participants: s.participants, fastestMs: s.fastestMs ?? null,
      }))});
    } catch (e) { res.status(500).json({ error: 'Failed to fetch sessions' }); }
  });

  app.get('/api/sessions', requireAuth, async (req, res) => {
    try {
      const sessions = await SessionEntry.find({ userId: req.user.id }).sort({ date: -1 }).limit(100).lean();
      res.json({ history: sessions.map(s => ({
        date: s.date.toISOString(), score: s.score, total: s.total,
        correct: s.correct, rank: s.rank, participants: s.participants, fastestMs: s.fastestMs ?? null,
      }))});
    } catch (e) {
      console.error('/api/sessions GET error:', e.message);
      res.status(500).json({ error: 'Failed to fetch session history' });
    }
  });

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

  // ── SELF QUIZ REPORTS ────────────────────────────────────────────────────────

  app.post('/api/selfquiz/report', async (req, res) => {
    try {
      const { question, correct, reporterName, note } = req.body;
      if (!question?.text) return res.status(400).json({ error: 'question.text required' });

      const existing = shared.questionReports.find(r => r.question.text === question.text);
      if (existing) {
        existing.count += 1;
        existing.note   = note || existing.note;
        existing.ts     = Date.now();
        // Sync update to DB
        ReportDB.findOneAndUpdate(
          { rid: existing.rid },
          { $set: { count: existing.count, note: existing.note, ts: existing.ts } }
        ).catch(() => {});
      } else {
        const newRep = {
          rid:            ++shared.reportCounter,
          question,
          correct:        correct ?? null,
          reportedAnswer: null,
          reporterName:   (reporterName || 'Host (Self Quiz)').slice(0, 40),
          reporterPids:   ['selfquiz'],
          note:           note || '',
          ts:             Date.now(),
          count:          1,
          source:         'selfquiz',
        };
        shared.questionReports.push(newRep);
        // Persist to MongoDB so reports survive server restarts
        ReportDB.create(newRep).catch(e => console.warn('[ReportDB] selfquiz save error:', e.message));
      }
      txHost({ type: 'report_received', reports: shared.questionReports });
      res.json({ ok: true });
    } catch(e) {
      console.error('/api/selfquiz/report error:', e.message);
      res.status(500).json({ error: 'Failed to save report' });
    }
  });

  app.get('/api/selfquiz/reports', requireHost, (req, res) => {
    res.json({ reports: shared.questionReports });
  });

  // ── SESSION BACKUP ───────────────────────────────────────────────────────────

  app.get('/api/session-backup', requireHost, async (req, res) => {
    try {
      const { windowStart, windowEnd } = getBackupWindow();
      const backup = await SessionBackup.findOne({ windowStart }).lean();
      if (!backup) return res.json({ ok: true, found: false, participants: [], windowStart, windowEnd });
      const participants = backup.participants.slice().sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
      res.json({ ok: true, found: true, participants, windowStart: backup.windowStart, windowEnd: backup.windowEnd, updatedAt: backup.updatedAt });
    } catch (e) {
      console.error('/api/session-backup GET error:', e.message);
      res.status(500).json({ error: 'Failed to fetch backup' });
    }
  });

  app.post('/api/session-backup/restore', requireHost, async (req, res) => {
    try {
      const { windowStart } = getBackupWindow();
      const backup = await SessionBackup.findOne({ windowStart }).lean();
      if (!backup) return res.status(404).json({ error: "No backup found for today's window" });
      // Note: actual score restoration via WebSocket 'restore_backup' message is preferred.
      // This REST endpoint exists as a fallback for HTTP-only clients.
      res.json({ ok: true, message: 'Use the restore_backup WebSocket message to restore scores into the live session.' });
    } catch (e) {
      console.error('/api/session-backup/restore error:', e.message);
      res.status(500).json({ error: 'Failed to restore backup' });
    }
  });
  /* ══════════════════════════════════════════════════════════════════════════
     PLANNED TEST API
  ══════════════════════════════════════════════════════════════════════════ */

  // ── Host: create a test ────────────────────────────────────────────────────
  app.post('/api/tests', requireHost, async (req, res) => {
    try {
      const { title, subject, timerType, timerValue, questions,
              sourceRepo, sourceFiles, sourceStart, sourceCount } = req.body;
      if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
      if (!questions?.length) return res.status(400).json({ error: 'No questions provided' });
      const test = await PlannedTest.create({
        title: title.trim(), subject: (subject||'').trim(),
        timerType: timerType||'none', timerValue: timerValue||0,
        questions, sourceRepo, sourceFiles, sourceStart, sourceCount,
        createdBy: req.user.id,
      });
      res.json({ ok: true, test });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Host: list all tests ───────────────────────────────────────────────────
  app.get('/api/tests/host', requireHost, async (req, res) => {
    try {
      const tests = await PlannedTest.find({ createdBy: req.user.id })
        .select('-questions').sort({ createdAt: -1 }).lean();
      res.json({ tests });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Host: get one test with full questions ─────────────────────────────────
  app.get('/api/tests/:id/host', requireHost, async (req, res) => {
    try {
      const test = await PlannedTest.findById(req.params.id).lean();
      if (!test) return res.status(404).json({ error: 'Not found' });
      res.json({ test });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Host: update status (close/reopen) ────────────────────────────────────
  app.put('/api/tests/:id/status', requireHost, async (req, res) => {
    try {
      const { status } = req.body;
      if (!['active','closed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
      const test = await PlannedTest.findOneAndUpdate(
        { _id: req.params.id, createdBy: req.user.id },
        { status }, { new: true }
      );
      if (!test) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true, test });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Host: delete a test ───────────────────────────────────────────────────
  app.delete('/api/tests/:id', requireHost, async (req, res) => {
    try {
      await PlannedTest.findOneAndDelete({ _id: req.params.id, createdBy: req.user.id });
      await TestAttempt.deleteMany({ testId: req.params.id });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Host: get all attempts for a test ─────────────────────────────────────
  app.get('/api/tests/:id/attempts', requireHost, async (req, res) => {
    try {
      const attempts = await TestAttempt.find({ testId: req.params.id })
        .sort({ score: -1, submittedAt: 1 }).lean();
      res.json({ attempts });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Host: get one attempt in full (per-question detail) ───────────────────
  app.get('/api/tests/:testId/attempts/:attemptId', requireHost, async (req, res) => {
    try {
      const attempt = await TestAttempt.findById(req.params.attemptId).lean();
      const test    = await PlannedTest.findById(req.params.testId).lean();
      if (!attempt || !test) return res.status(404).json({ error: 'Not found' });
      res.json({ attempt, questions: test.questions });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Student: list available (active) tests ────────────────────────────────
  app.get('/api/tests', requireAuth, async (req, res) => {
    try {
      const tests = await PlannedTest.find({ status: 'active' })
        .select('title subject timerType timerValue questions createdAt sourceRepo')
        .lean();
      // Which of these does this student already have an unfinished attempt on?
      // Drives the Start → Rejoin button swap on the client.
      const myAttempts = await TestAttempt.find({
        userId: req.user.id, completed: false, testId: { $in: tests.map(t => t._id) },
      }).select('testId').lean();
      const inProgressSet = new Set(myAttempts.map(a => a.testId.toString()));
      const questionCounts = tests.map(t => ({
        ...t,
        questionCount: t.questions?.length || 0,
        questions: undefined,
        inProgress: inProgressSet.has(t._id.toString()),
      }));
      res.json({ tests: questionCounts });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Student: start / resume a test ─────────────────────────────────────────
  // Idempotent: calling this again for a test the student already started
  // (rejoin after closing the browser, switching apps, losing connection, etc.)
  // returns the SAME attempt — same startedAt, same saved answers — so the
  // clock can never be reset and progress is never lost. If the time budget
  // ran out while they were away, it is auto-submitted here instead.
  app.get('/api/tests/:id/take', requireAuth, async (req, res) => {
    try {
      const test = await PlannedTest.findById(req.params.id).lean();
      if (!test || test.status !== 'active') return res.status(404).json({ error: 'Test not available' });

      const existingDone = await TestAttempt.findOne({ testId: req.params.id, userId: req.user.id, completed: true });
      if (existingDone) return res.status(409).json({ error: 'Already submitted', attemptId: existingDone._id });

      // Strip correct answers — never sent to student
      const questions = test.questions.map(q => ({ text: q.text, options: q.options }));

      let attempt = await TestAttempt.findOne({ testId: req.params.id, userId: req.user.id, completed: false });

      if (attempt) {
        const deadline = attemptDeadline(test, attempt.startedAt);
        if (deadline !== null && Date.now() > deadline) {
          const result = await finalizeAttempt(attempt, test, { auto: true });
          return res.status(409).json({ error: 'Time ran out while you were away — test was auto-submitted', autoSubmitted: true, result });
        }
        // Resume exactly where they left off.
        return res.json({
          test: { ...test, questions },
          attempt: { id: attempt._id, startedAt: attempt.startedAt, answers: attempt.answers, currentQIdx: attempt.currentQIdx },
          resuming: true,
        });
      }

      attempt = await TestAttempt.create({
        testId: req.params.id,
        userId: req.user.id,
        userName: req.user.name,
        answers: new Array(test.questions.length).fill(null),
        startedAt: new Date(),
        currentQIdx: 0,
        completed: false,
      });
      res.json({
        test: { ...test, questions },
        attempt: { id: attempt._id, startedAt: attempt.startedAt, answers: attempt.answers, currentQIdx: attempt.currentQIdx },
        resuming: false,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Student: save progress on one question (locks in answer, marks furthest
  //    question reached) — called after every answer so a rejoin can resume
  //    mid-test even if the student never gets to hit Submit themselves. ──────
  app.post('/api/tests/:id/progress', requireAuth, async (req, res) => {
    try {
      const { questionIdx, answer } = req.body;
      if (typeof questionIdx !== 'number') return res.status(400).json({ error: 'questionIdx required' });
      const attempt = await TestAttempt.findOne({ testId: req.params.id, userId: req.user.id, completed: false });
      if (!attempt) return res.status(404).json({ error: 'No active attempt' });
      const test = await PlannedTest.findById(req.params.id).lean();
      if (test) {
        const deadline = attemptDeadline(test, attempt.startedAt);
        if (deadline !== null && Date.now() > deadline) {
          const result = await finalizeAttempt(attempt, test, { auto: true });
          return res.status(409).json({ error: 'Time ran out — test was auto-submitted', autoSubmitted: true, result });
        }
      }
      if (questionIdx >= 0 && questionIdx < attempt.answers.length) {
        attempt.answers[questionIdx] = (answer === null || answer === undefined) ? null : answer;
      }
      attempt.currentQIdx = Math.max(attempt.currentQIdx, questionIdx + 1);
      await attempt.save();

      // Reveal correctness for THIS question only, now that the student has
      // committed to an answer — never sent for unanswered/future questions.
      const q = test ? test.questions[questionIdx] : null;
      const reveal = (q && answer !== null && answer !== undefined)
        ? { isCorrect: answer === q.correct, correctIndex: q.correct }
        : null;
      res.json({ ok: true, reveal });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Student: submit attempt ────────────────────────────────────────────────
  app.post('/api/tests/:id/submit', requireAuth, async (req, res) => {
    try {
      const test = await PlannedTest.findById(req.params.id).lean();
      if (!test || test.status !== 'active') return res.status(404).json({ error: 'Test not available' });

      let attempt = await TestAttempt.findOne({ testId: req.params.id, userId: req.user.id, completed: false });
      const existingDone = await TestAttempt.findOne({ testId: req.params.id, userId: req.user.id, completed: true });
      if (existingDone) return res.status(409).json({ error: 'Already submitted' });

      const { answers } = req.body; // array of number|null, length == questions.length
      if (!Array.isArray(answers) || answers.length !== test.questions.length)
        return res.status(400).json({ error: 'Answers array length mismatch' });

      // Normally an attempt was created on /take and tracked via /progress —
      // finalize that same record so the original startedAt (and the time
      // limit anchored to it) is preserved. Only fabricate a new one as a
      // defensive fallback if somehow no attempt record exists.
      if (!attempt) {
        attempt = await TestAttempt.create({
          testId: req.params.id, userId: req.user.id, userName: req.user.name,
          answers, startedAt: new Date(), currentQIdx: test.questions.length, completed: false,
        });
      } else {
        attempt.answers = answers;
      }

      const result = await finalizeAttempt(attempt, test, { auto: false });
      res.json({ ok: true, result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Student: my attempts (summary only — no per-question answers) ─────────
  app.get('/api/my-attempts', requireAuth, async (req, res) => {
    try {
      const attempts = await TestAttempt.find({ userId: req.user.id, completed: true })
        .select('-answers').populate('testId', 'title subject questionCount').sort({ submittedAt: -1 }).lean();
      res.json({ attempts });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Student: submit a question report during a test ───────────────────────
  app.post('/api/tests/:testId/report', requireAuth, async (req, res) => {
    try {
      const { questionIdx, reportedAnswer, note } = req.body;
      const test = await PlannedTest.findById(req.params.testId).lean();
      if (!test) return res.status(404).json({ error: 'Test not found' });
      const q = test.questions[questionIdx];
      if (!q) return res.status(400).json({ error: 'Invalid question index' });
      // Also save to the main ReportDB so host sees it in the reports panel
      const nextRid = (await ReportDB.countDocuments()) + 1;
      await ReportDB.create({
        rid: nextRid,
        question: { text: q.text, options: q.options },
        correct: q.correct,
        reportedAnswer: reportedAnswer ?? null,
        reporterName: req.user.name,
        reporterPids: [],
        note: note || '',
        source: 'test',
        ts: Date.now(),
        count: 1,
      });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
}

module.exports = { initRoutes };
