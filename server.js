'use strict';

const express  = require('express');
const http     = require('http');
const path     = require('path');
const fs       = require('fs');
const mongoose = require('mongoose');

// Load .env when running locally (ignored on Render/production)
try { require('dotenv').config(); } catch(_){}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shadabcoaching';

const { ReportDB } = require('./models');
const { shared }      = require('./ws');
const { initRoutes }  = require('./routes');
const { initWS }      = require('./ws');

// ── TODAY LEADERBOARD AUTO-RESET ──────────────────────────────────────────────
// Today/week leaderboard is now computed by aggregating ScoreLog by date range —
// no daily reset is needed. This scheduler is kept as a no-op placeholder in
// case future cleanup is added (e.g. pruning old ScoreLog entries).
function scheduleTodayLBReset() {
  const now  = new Date();
  // Next midnight UTC
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  const msUntil = next - now;
  setTimeout(() => {
    console.log('[ScoreLog] New day started —', new Date().toISOString());
    scheduleTodayLBReset(); // re-schedule for next day
  }, msUntil);
  const h = Math.round(msUntil / 36000) / 100;
  console.log(`[TodayLB] Next reset in ${h}h (at 5:30 AM IST)`);
}

// ── MONGODB ───────────────────────────────────────────────────────────────────
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected — db:', mongoose.connection.db.databaseName);
    try {
      const saved = await ReportDB.find().sort({ ts: 1 }).lean();
      shared.questionReports = saved.map(r => ({
        rid:            r.rid,
        question:       r.question,
        correct:        r.correct,
        reportedAnswer: r.reportedAnswer,
        reporterName:   r.reporterName,
        reporterPids:   r.reporterPids,
        ts:             r.ts,
        count:          r.count,
        source:         r.source,
        note:           r.note,
      }));
      shared.reportCounter = shared.questionReports.reduce((m, r) => Math.max(m, r.rid || 0), 0);
      if (shared.questionReports.length)
        console.log(`[Reports] Loaded ${shared.questionReports.length} from DB`);
    } catch(e) { console.warn('[Reports] load error:', e.message); }
  })
  .catch(e => console.error('MongoDB connection FAILED:', e.message));

// ── EXPRESS ───────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Serve index.html with MY_TOKEN injected
const indexPath = path.join(__dirname, 'public', 'index.html');
app.get('/', (req, res) => {
  try {
    let html = fs.readFileSync(indexPath, 'utf8');
    const token = process.env.MY_TOKEN || '';
    html = html.replace("'%%MY_TOKEN%%'", JSON.stringify(token));
    html = html.replace("window.MY_TOKEN = '%%MY_TOKEN%%'", `window.MY_TOKEN = ${JSON.stringify(token)}`);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch(e) { res.status(500).send('Server error loading page'); }
});

// Editor page
const editorPath = path.join(__dirname, 'public', 'editor.html');
app.get('/editor', (req, res) => {
  try {
    let html = fs.readFileSync(editorPath, 'utf8');
    const token  = process.env.MY_TOKEN      || '';
    const hostPw = process.env.HOST_PASSWORD || '598359';
    html = html.replace("'%%MY_TOKEN%%'",      JSON.stringify(token));
    html = html.replace("'%%HOST_PASSWORD%%'", JSON.stringify(hostPw));
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch(e) { res.status(500).send('Server error loading page'); }
});

// Self Quiz page
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

// Redirects
app.get('/shuffle',     (req, res) => res.redirect(301, '/editor'));
app.get('/index.html',  (req, res) => res.redirect(301, '/'));

app.use(express.static(path.join(__dirname, 'public')));

// ── HTTP + WS SERVER ──────────────────────────────────────────────────────────
const server = http.createServer(app);

initRoutes(app);
initWS(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Shadab Coaching Centre → http://localhost:${PORT}`);
  scheduleTodayLBReset();
});
