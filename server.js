'use strict';

const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));

// ── QUIZ STATE ──────────────────────────────────────────────────────────────
function emptyQuiz() {
  return {
    status: 'waiting',   // waiting | active | ended
    questions: [],
    qIndex: 0,
    questionStartedAt: null,
    answersRevealed: false,
    participants: {},    // pid → { id, name, score }
    currentAnswers: {},  // pid → answerIdx (for current question)
  };
}

let quiz = emptyQuiz();

// ── CLIENT REGISTRY ─────────────────────────────────────────────────────────
let idSeq = 0;
const clients = new Map(); // clientId → { ws, role, pid }

function send(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

// ── STATE PROJECTIONS ────────────────────────────────────────────────────────
function answerCounts() {
  const q = quiz.questions[quiz.qIndex];
  if (!q) return [];
  return q.options.map((_, i) =>
    Object.values(quiz.currentAnswers).filter(a => a === i).length
  );
}

function forHost() {
  return {
    status: quiz.status,
    questions: quiz.questions,
    qIndex: quiz.qIndex,
    questionStartedAt: quiz.questionStartedAt,
    answersRevealed: quiz.answersRevealed,
    participants: Object.values(quiz.participants),
    ansCount: answerCounts(),
    totalAnswered: Object.keys(quiz.currentAnswers).length,
  };
}

function forParticipant(pid) {
  const q = quiz.questions[quiz.qIndex];
  const myAnswer = quiz.currentAnswers[pid] ?? null;
  const canSee = myAnswer !== null || quiz.answersRevealed;
  return {
    status: quiz.status,
    qIndex: quiz.qIndex,
    totalQuestions: quiz.questions.length,
    questionStartedAt: quiz.questionStartedAt,
    answersRevealed: quiz.answersRevealed,
    participants: Object.values(quiz.participants),
    totalAnswered: Object.keys(quiz.currentAnswers).length,
    myAnswer,
    myScore: quiz.participants[pid]?.score ?? 0,
    currentQuestion: q ? {
      text: q.text,
      options: q.options,
      timeLimit: q.timeLimit,
      correct: canSee ? q.correct : -1,
    } : null,
    ansCount: canSee ? answerCounts() : null,
  };
}

function forGuest() {
  return {
    status: quiz.status,
    participants: Object.values(quiz.participants),
  };
}

function broadcastAll() {
  clients.forEach(({ ws, role, pid }) => {
    if (ws.readyState !== 1) return;
    if (role === 'host')             send(ws, { type: 'state', data: forHost() });
    else if (role === 'participant') send(ws, { type: 'state', data: forParticipant(pid) });
    else                             send(ws, { type: 'state', data: forGuest() });
  });
}

// ── SCORING ──────────────────────────────────────────────────────────────────
function scoreCurrentQuestion() {
  const q = quiz.questions[quiz.qIndex];
  if (!q || !quiz.questionStartedAt) return;
  const elapsed = (Date.now() - quiz.questionStartedAt) / 1000;
  const timeLeft = Math.max(0, q.timeLimit - elapsed);
  Object.entries(quiz.currentAnswers).forEach(([pid, ans]) => {
    if (ans === q.correct && quiz.participants[pid]) {
      quiz.participants[pid].score += Math.round(Math.max(100, timeLeft * 10));
    }
  });
}

// ── WEBSOCKET ─────────────────────────────────────────────────────────────────
wss.on('connection', ws => {
  const cid = ++idSeq;
  clients.set(cid, { ws, role: null, pid: null });
  send(ws, { type: 'hello', cid });
  send(ws, { type: 'state', data: forGuest() });

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const client = clients.get(cid);
    if (!client) return;

    switch (msg.type) {

      /* ── HOST REGISTER ── */
      case 'set_host':
        client.role = 'host';
        send(ws, { type: 'state', data: forHost() });
        break;

      /* ── PARTICIPANT JOIN (with optional pid restore) ── */
      case 'join': {
        if (!msg.name?.trim()) break;
        let pid = msg.pid;
        if (pid && quiz.participants[pid]) {
          // Restore existing participant (reconnect case)
        } else {
          pid = `p${cid}_${Date.now()}`;
          quiz.participants[pid] = { id: pid, name: msg.name.trim().slice(0, 24), score: 0 };
        }
        client.role = 'participant';
        client.pid = pid;
        send(ws, { type: 'joined', pid });
        broadcastAll();
        break;
      }

      /* ── HOST: START QUIZ ── */
      case 'start_quiz':
        if (client.role !== 'host') break;
        if (!Array.isArray(msg.questions) || !msg.questions.length) break;
        quiz.status = 'active';
        quiz.questions = msg.questions;
        quiz.qIndex = 0;
        quiz.questionStartedAt = Date.now();
        quiz.answersRevealed = false;
        quiz.currentAnswers = {};
        broadcastAll();
        break;

      /* ── HOST: REVEAL ANSWERS ── */
      case 'reveal_answers':
        if (client.role !== 'host' || quiz.status !== 'active') break;
        scoreCurrentQuestion();
        quiz.answersRevealed = true;
        broadcastAll();
        break;

      /* ── HOST: NEXT QUESTION / END ── */
      case 'next_question':
        if (client.role !== 'host' || quiz.status !== 'active') break;
        if (!quiz.answersRevealed) scoreCurrentQuestion();
        if (quiz.qIndex + 1 >= quiz.questions.length) {
          quiz.status = 'ended';
        } else {
          quiz.qIndex++;
          quiz.questionStartedAt = Date.now();
          quiz.answersRevealed = false;
          quiz.currentAnswers = {};
        }
        broadcastAll();
        break;

      /* ── PARTICIPANT: SUBMIT ANSWER ── */
      case 'answer':
        if (client.role !== 'participant' || !client.pid) break;
        if (quiz.status !== 'active' || quiz.answersRevealed) break;
        if (quiz.currentAnswers[client.pid] !== undefined) break; // already answered
        if (typeof msg.answerIdx !== 'number' || msg.answerIdx < 0 || msg.answerIdx > 3) break;
        quiz.currentAnswers[client.pid] = msg.answerIdx;
        broadcastAll();
        break;

      /* ── HOST: RESET ── */
      case 'reset':
        if (client.role !== 'host') break;
        quiz = emptyQuiz();
        broadcastAll();
        break;
    }
  });

  ws.on('close', () => clients.delete(cid));
});

// ── START ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✓ QuizZap running → http://localhost:${PORT}`));
