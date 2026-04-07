'use strict';

const mongoose = require('mongoose');

// ── USER ──────────────────────────────────────────────────────────────────────
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

// ── PENDING REGISTRATIONS ─────────────────────────────────────────────────────
const pendingRegSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true, maxlength: 50 },
  email:     { type: String, required: true, trim: true, lowercase: true, unique: true },
  username:  { type: String, lowercase: true, trim: true, sparse: true, unique: true, default: null },
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

// ── TODAY LEADERBOARD ─────────────────────────────────────────────────────────
const todayLBSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  userName:  { type: String },
  score:     { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});
const TodayLBEntry = mongoose.model('TodayLBEntry', todayLBSchema);

// ── WEEK LEADERBOARD ──────────────────────────────────────────────────────────
const weekLBSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  userName:  { type: String },
  score:     { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});
const WeekLBEntry = mongoose.model('WeekLBEntry', weekLBSchema);

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
  LeaderboardEntry, TodayLBEntry, WeekLBEntry,
  SessionBackup, SessionEntry, ReportDB,
};
