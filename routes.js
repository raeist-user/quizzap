'use strict';

const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const mongoose = require('mongoose');
const {
  User, PendingReg, UpdateReq, Notice, Schedule,
  LeaderboardEntry, ScoreLog, SessionEntry,
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

// ── ROUTE REGISTRATION ────────────────────────────────────────────────────────
function initRoutes(app) {

  // ── AUTH ────────────────────────────────────────────────────────────────────

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
        if (field === 'email')    return res.status(400).json({ error: 'An account with this email already exists' });
        if (field === 'username') return res.status(400).json({ error: 'Username already taken' });
        return res.status(500).json({ error: 'Registration failed — please try again' });
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

  app.post('/api/selfquiz/report', (req, res) => {
    try {
      const { question, correct, reporterName, note } = req.body;
      if (!question?.text) return res.status(400).json({ error: 'question.text required' });

      const existing = shared.questionReports.find(r => r.question.text === question.text);
      if (existing) {
        existing.count += 1;
        existing.note   = note || existing.note;
        existing.ts     = Date.now();
      } else {
        shared.questionReports.push({
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
        });
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
}

module.exports = { initRoutes };
