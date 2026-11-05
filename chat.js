'use strict';
/* ══════════════════════════════════════════════════════════════════════════
   #Chatbox — Discord-style group chat for the home screen.
   • Messages, reactions, pins live in MongoDB (ChatMessage).
   • REST handles every action (auth + validation); a dedicated websocket at
     /chat broadcasts changes in real time and tracks who is online.
══════════════════════════════════════════════════════════════════════════ */
const jwt  = require('jsonwebtoken');
const mongoose = require('mongoose');
const { WebSocketServer } = require('ws');
const { ChatMessage } = require('./models');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';
const MAX_LEN    = 1000;
const MAX_PURGE  = 200;   // most messages the host's  .delete <amount>  command may remove at once
// Gestures only — no hearts or other affection emojis.
const ALLOWED_REACTIONS = ['👍','👎','👋','👏','🙌','🙏','🤝','💪','✌️','👌','🤞','☝️'];

function verify(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}
function requireAuth(req, res, next) {
  const a = req.headers.authorization;
  const u = a?.startsWith('Bearer ') ? verify(a.slice(7)) : null;
  if (!u) return res.status(401).json({ error: 'Unauthorised' });
  req.user = u; next();
}
const isId = v => mongoose.Types.ObjectId.isValid(v);

function ser(m) {
  return {
    id: String(m._id),
    userId: String(m.userId),
    userName: m.userName,
    role: m.role,
    text: m.text,
    createdAt: m.createdAt,
    editedAt: m.editedAt || null,
    pinned: !!m.pinned,
    pinnedBy: m.pinnedBy || '',
    reactions: (m.reactions || []).filter(r => r.users?.length).map(r => ({ emoji: r.emoji, users: r.users })),
  };
}

function initChat(app) {
  const wss = new WebSocketServer({ noServer: true });
  // userId -> { name, role, sockets:Set }
  const online = new Map();

  function sendAll(obj) {
    const raw = JSON.stringify(obj);
    for (const ws of wss.clients) if (ws.readyState === 1) ws.send(raw);
  }
  function presenceList() {
    return [...online.entries()]
      .map(([id, v]) => ({ id, name: v.name, role: v.role }))
      .sort((a, b) => (a.role === 'host' ? -1 : 1) - (b.role === 'host' ? -1 : 1) || a.name.localeCompare(b.name));
  }

  wss.on('connection', (ws, req) => {
    const token = new URL(req.url, 'http://x').searchParams.get('token');
    const user = verify(token);
    if (!user) { ws.close(4001, 'unauthorised'); return; }
    const uid = String(user.id);
    let entry = online.get(uid);
    if (!entry) { entry = { name: user.name, role: user.role, sockets: new Set() }; online.set(uid, entry); }
    entry.sockets.add(ws);
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.send(JSON.stringify({ type: 'presence', users: presenceList() }));
    sendAll({ type: 'presence', users: presenceList() });

    ws.on('close', () => {
      entry.sockets.delete(ws);
      if (!entry.sockets.size) online.delete(uid);
      sendAll({ type: 'presence', users: presenceList() });
    });
    ws.on('error', () => {});
  });

  // Drop dead connections so "online" stays accurate (also keeps proxies from idling out)
  setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false; try { ws.ping(); } catch {}
    }
  }, 30000);

  // ── REST ───────────────────────────────────────────────────────────────────
  // History: newest 50 (or 50 before a given message id). Pinned list is sent with the first page.
  app.get('/api/chat/messages', requireAuth, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 100);
      const q = {};
      if (req.query.before && isId(req.query.before)) q._id = { $lt: req.query.before };
      const docs = await ChatMessage.find(q).sort({ _id: -1 }).limit(limit + 1).lean();
      const hasMore = docs.length > limit;
      const messages = docs.slice(0, limit).reverse().map(ser);
      const out = { messages, hasMore };
      if (!req.query.before) {
        out.pinned = (await ChatMessage.find({ pinned: true }).sort({ _id: -1 }).lean()).map(ser);
        out.online = presenceList();
        out.reactions = ALLOWED_REACTIONS;
      }
      res.json(out);
    } catch (e) { res.status(500).json({ error: 'Could not load chat' }); }
  });

  const lastSent = new Map();
  app.post('/api/chat/messages', requireAuth, async (req, res) => {
    try {
      const text = String(req.body?.text || '').replace(/\r\n/g, '\n').trim();
      if (!text) return res.status(400).json({ error: 'Message is empty' });
      if (text.length > MAX_LEN) return res.status(400).json({ error: `Max ${MAX_LEN} characters` });
      const now = Date.now(), uid = String(req.user.id);
      if (now - (lastSent.get(uid) || 0) < 400) return res.status(429).json({ error: 'Slow down a little' });
      lastSent.set(uid, now);
      const m = await ChatMessage.create({ userId: req.user.id, userName: req.user.name, role: req.user.role === 'host' ? 'host' : 'student', text });
      const msg = ser(m);
      sendAll({ type: 'msg_new', message: msg });
      res.json({ message: msg });
    } catch (e) { res.status(500).json({ error: 'Could not send' }); }
  });

  app.put('/api/chat/messages/:id', requireAuth, async (req, res) => {
    try {
      if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const text = String(req.body?.text || '').replace(/\r\n/g, '\n').trim();
      if (!text) return res.status(400).json({ error: 'Message is empty' });
      if (text.length > MAX_LEN) return res.status(400).json({ error: `Max ${MAX_LEN} characters` });
      const m = await ChatMessage.findById(req.params.id);
      if (!m) return res.status(404).json({ error: 'Message not found' });
      if (String(m.userId) !== String(req.user.id)) return res.status(403).json({ error: 'You can only edit your own messages' });
      m.text = text; m.editedAt = new Date(); await m.save();
      sendAll({ type: 'msg_edit', message: ser(m) });
      res.json({ message: ser(m) });
    } catch (e) { res.status(500).json({ error: 'Could not edit' }); }
  });

  app.delete('/api/chat/messages/:id', requireAuth, async (req, res) => {
    try {
      if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const m = await ChatMessage.findById(req.params.id);
      if (!m) return res.json({ ok: true });
      const own = String(m.userId) === String(req.user.id);
      if (!own && req.user.role !== 'host') return res.status(403).json({ error: 'Not allowed' });
      await m.deleteOne();
      sendAll({ type: 'msg_delete', id: String(m._id) });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Could not delete' }); }
  });

  // Host command  .delete <amount>  — removes the newest <amount> messages (anyone's, pinned included).
  app.post('/api/chat/purge', requireAuth, async (req, res) => {
    try {
      if (req.user.role !== 'host') return res.status(403).json({ error: 'Host only' });
      const raw = req.body?.amount;
      const n = typeof raw === 'number' ? raw : (/^\d+$/.test(String(raw ?? '').trim()) ? parseInt(raw, 10) : NaN);
      if (!Number.isInteger(n) || n < 1) return res.status(400).json({ error: 'Usage: .delete <amount>' });
      if (n > MAX_PURGE) return res.status(400).json({ error: `You can delete at most ${MAX_PURGE} messages at a time` });
      const docs = await ChatMessage.find({}).sort({ _id: -1 }).limit(n).select('_id').lean();
      const ids = docs.map(d => d._id);
      if (ids.length) await ChatMessage.deleteMany({ _id: { $in: ids } });
      const sids = ids.map(String);
      if (sids.length) sendAll({ type: 'msg_purge', ids: sids });
      res.json({ ok: true, deleted: sids.length, ids: sids });
    } catch (e) { res.status(500).json({ error: 'Could not delete messages' }); }
  });

  app.post('/api/chat/messages/:id/react', requireAuth, async (req, res) => {
    try {
      const emoji = req.body?.emoji;
      if (!ALLOWED_REACTIONS.includes(emoji)) return res.status(400).json({ error: 'Emoji not allowed' });
      if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const m = await ChatMessage.findById(req.params.id);
      if (!m) return res.status(404).json({ error: 'Message not found' });
      const uid = String(req.user.id);
      let r = m.reactions.find(x => x.emoji === emoji);
      if (!r) { m.reactions.push({ emoji, users: [uid] }); }
      else if (r.users.includes(uid)) { r.users = r.users.filter(u => u !== uid); }
      else { r.users.push(uid); }
      m.reactions = m.reactions.filter(x => x.users.length);
      m.markModified('reactions');
      await m.save();
      sendAll({ type: 'msg_react', id: String(m._id), reactions: ser(m).reactions });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Could not react' }); }
  });

  app.post('/api/chat/messages/:id/pin', requireAuth, async (req, res) => {
    try {
      if (req.user.role !== 'host') return res.status(403).json({ error: 'Host only' });
      if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
      const m = await ChatMessage.findById(req.params.id);
      if (!m) return res.status(404).json({ error: 'Message not found' });
      m.pinned = !!req.body?.pinned;
      m.pinnedBy = m.pinned ? req.user.name : '';
      await m.save();
      sendAll({ type: 'msg_pin', message: ser(m) });
      res.json({ message: ser(m) });
    } catch (e) { res.status(500).json({ error: 'Could not pin' }); }
  });

  return wss;
}

module.exports = { initChat };
