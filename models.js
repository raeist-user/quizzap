'use strict';

const mongoose = require('mongoose');

// ── USER ──────────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 50 },
  // email is optional for new users — sparse index ignores MISSING fields (undefined), not null
  // Do NOT set default:null here; omit the field entirely when not provided
  email:       { type: String, required: false, trim: true, lowercase: true, unique: true, sparse: true },
  username:    {
    type: String, lowercase: true, trim: true, sparse: true, unique: true,
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

// ── PENDING REGISTRATIONS ─────────────────────────────────────────────────────
const pendingRegSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true, maxlength: 50 },
  // email omitted entirely (undefined) when not provided — sparse index won't index it
  email:     { type: String, required: false, trim: true, lowercase: true, unique: true, sparse: true },
  username:  { type: String, lowercase: true, trim: true, sparse: true, unique: true },
  password:  { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const PendingReg = mongoose.model('PendingReg', pendingRegSchema);

// ── UPDATE REQUESTS ───────────────────────────────────────────────────────────
const updateReqSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:  { type: String },
  type:      { type: String, enum: ['name','username'], required: true },
  newValue:  { type: String, required: true, trim: true },
  status:    { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});
const UpdateReq = mongoose.model('UpdateReq', updateReqSchema);

// ── GLOBAL NOTICE ─────────────────────────────────────────────────────────────
const noticeSchema = new mongoose.Schema({
  text:      { type: String, default: '', maxlength: 500 },
  updatedAt: { type: Date, default: Date.now },
});
const Notice = mongoose.model('Notice', noticeSchema);

// ── SCHEDULE ──────────────────────────────────────────────────────────────────
const scheduleSchema = new mongoose.Schema({
  title:     { type: String, required: true, trim: true, maxlength: 60 },
  ts:        { type: Number, required: true },
  notes:     { type: String, trim: true, maxlength: 100, default: '' },
  createdAt: { type: Date, default: Date.now },
});
const Schedule = mongoose.model('Schedule', scheduleSchema);

// ── LEADERBOARD (all-time cumulative) ─────────────────────────────────────────
const leaderboardSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  userName:       { type: String },
  totalScore:     { type: Number, default: 0 },
  sessionsPlayed: { type: Number, default: 0 },
  updatedAt:      { type: Date, default: Date.now },
});
const LeaderboardEntry = mongoose.model('LeaderboardEntry', leaderboardSchema);

// ── SCORE LOG (one doc per user per shutdown — drives today/week leaderboard) ─
// Replaces the old TodayLBEntry + WeekLBEntry collections.
// The leaderboard API aggregates this by date range; no manual resets needed.
const scoreLogSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userName: { type: String },
  score:    { type: Number, default: 0 },
  date:     { type: Date,   default: Date.now, index: true },
});
const ScoreLog = mongoose.model('ScoreLog', scoreLogSchema);

// ── SESSION BACKUP ────────────────────────────────────────────────────────────
const sessionBackupSchema = new mongoose.Schema({
  windowStart:  { type: Date, required: true, unique: true, index: true },
  windowEnd:    { type: Date, required: true },
  participants: [{
    userId:       { type: String, default: null },
    pid:          { type: String },
    name:         { type: String },
    currentScore: { type: Number, default: 0 },
    bankedScore:  { type: Number, default: 0 },
    totalScore:   { type: Number, default: 0 },
    updatedAt:    { type: Date,   default: Date.now },
  }],
  updatedAt: { type: Date, default: Date.now },
});
const SessionBackup = mongoose.model('SessionBackup', sessionBackupSchema);

// ── SESSION HISTORY ───────────────────────────────────────────────────────────
const sessionSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date:         { type: Date, default: Date.now },
  score:        { type: Number, default: 0 },
  total:        { type: Number, default: 0 },
  correct:      { type: Number, default: 0 },
  rank:         { type: Number, default: 0 },
  participants: { type: Number, default: 0 },
  fastestMs:    { type: Number, default: null },
});
const SessionEntry = mongoose.model('SessionEntry', sessionSchema);

// ── PLANNED TEST ──────────────────────────────────────────────────────────────
const plannedTestSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true, maxlength: 100 },
  subject:     { type: String, trim: true, maxlength: 80, default: '' },
  timerType:   { type: String, enum: ['total','perQuestion','none'], default: 'none' },
  timerValue:  { type: Number, default: 0 },          // seconds (total) or seconds per Q
  questions:   [{                                       // baked-in at creation time
    text:    { type: String },
    options: [{ type: String }],
    correct: { type: Number },
  }],
  // Source metadata (for display / audit)
  sourceRepo:   { type: String, default: '' },
  sourceFiles:  [{ type: String }],
  sourceStart:  { type: Number, default: 0 },         // nth question start index
  sourceCount:  { type: Number, default: 0 },
  status:       { type: String, enum: ['active','closed'], default: 'active' },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt:    { type: Date, default: Date.now },
});
const PlannedTest = mongoose.model('PlannedTest', plannedTestSchema);

// ── TEST ATTEMPT ──────────────────────────────────────────────────────────────
const testAttemptSchema = new mongoose.Schema({
  testId:     { type: mongoose.Schema.Types.ObjectId, ref: 'PlannedTest', required: true, index: true },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:   { type: String },
  // answers[i] = chosen option index (0-3), or null = skipped
  answers:    [{ type: Number, default: null }],
  correct:    { type: Number, default: 0 },
  incorrect:  { type: Number, default: 0 },
  skipped:    { type: Number, default: 0 },
  score:      { type: Number, default: 0 },
  startedAt:  { type: Date, default: Date.now },
  submittedAt:{ type: Date, default: null },
  completed:  { type: Boolean, default: false },
  // Tracks furthest question reached — lets a rejoining student resume exactly
  // where they left off, and lets the server know how far the clock has run.
  currentQIdx:{ type: Number, default: 0 },
  // Real-world anchor for the CURRENT question's own timer (perQuestion mode).
  // Updated only at the moment a question actually becomes visible to the
  // student, so unused time on a question never bleeds into the next one —
  // every question gets exactly timerValue seconds, no more, no less.
  questionStartedAt: { type: Date, default: Date.now },
  // True once an attempt was closed out automatically by the server because
  // its time budget ran out while the student was away (no exit loophole).
  autoSubmitted: { type: Boolean, default: false },
  // Question-level reports submitted during this attempt
  reports:    [{
    questionIdx: Number,
    reportedAnswer: Number,
    note: String,
    ts: { type: Date, default: Date.now },
  }],
});
// One in-progress (or completed) attempt per student per test — fast lookup
// for resume/rejoin checks on the available-tests list and on /take.
testAttemptSchema.index({ testId: 1, userId: 1 });
const TestAttempt = mongoose.model('TestAttempt', testAttemptSchema);

// ── QUESTION REPORTS ──────────────────────────────────────────────────────────
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

module.exports = {
  User, PendingReg, UpdateReq, Notice, Schedule,
  LeaderboardEntry, ScoreLog,
  SessionBackup, SessionEntry, ReportDB,
  PlannedTest, TestAttempt,
};
