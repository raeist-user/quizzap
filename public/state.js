/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let S={}, role=null, myPid=null, myName=null, hostAuthed=false;
let currentUser=null;
let authToken=null;

// Profile page
let showingProfile=false, profileTab='overview';

// Score tracking for +N badge
let prevMyScore=0, scoreGain=0;

// Host
let questions=[], selIdx=-1, answerKey=-1, inspectPid=null;
let sidebarQOpen=false, sidebarStudOpen=false, sidebarScoreOpen=false, sidebarSchedOpen=false, showStandingsOverlay=false;
let hostTimerSeconds=0;
let hostRandomize=false; // OFF by default — questions load in file order

// Resource browser
let repoPath=null;
let subjects=[];          // [{name, path, files:[], filesLoaded:false}]
let expandedSubject=null; // which subject accordion is open in generate tab
let folderOverlaySubject=null;   // subject name whose chapter overlay is open
let folderOverlayDraft={};       // {fileName: {selected, count}} — pending selections inside overlay
let folderManageSubject=null;    // subject name whose manage overlay is open
let showNewFolderCard=false;     // whether the + new folder card input is shown
let repoLoading=false;

// Host halt confirmation menu state
let showingHaltMenu=false;
let showingHaltBomb=false, haltBombTimer=null; // bomb drop animation before halt menu
let showingDismissBomb=false, dismissBombTimer=null; // bomb before stop & dismiss fires

// Session backup / restore overlay (host only)
let showingBackupOverlay=false;
let backupOverlayState={ list:[], loading:false, error:null, restoredMsg:null };

// Host settings/shortcuts overlay
let hostSettingsOpen=false;

// Upload manage state
let manageEditMode=null;      // null | 'existing' | 'new'
let manageFolderFiles=[];     // [{name, path, sha}] files in currently selected manage folder
let manageFile=null;          // which specific .txt file is selected in manage tab
let manageNewFileName='';
let editorFullscreen=false;   // whether the editor is in fullscreen overlay mode

// Voice (host)
let localStream=null;
const peerConns={};

// Voice (student)
let remoteConn=null;

// Speak-request flow (see voice.js)
// speakRequestPending, isSpeakingNow, participantMicStream, participantPeerConn
// activeSpeakerName, activeSpeakerCid  — all declared in voice.js

// Timer
let timerInterval=null;

// Push question debounce
let pushing=false, pushTimeout=null;

// Halt flow
let showingHalted=false, haltedCountdown=0, haltedTimer=null, haltedSnapshot=[];
let haltedTotalQuestions=0;   // total questions asked in the session (for score/total display)
let haltedTotalLabel='';      // denominator label for final leaderboard: 'all' or specific count string
let hostShutdownLeaderboard=null; // captured final leaderboard shown to host after Stop & Dismiss

// ── QUESTION REPORT STATE ────────────────────────────────────────────────────
let receivedReports=[];          // [{rid,question,correct,reportedAnswer,reporterName,ts,count}]
let reportsOverlayOpen=false;    // whether the host reports overlay is visible
let expandedReportRid=null;      // which report card is expanded (shows options)
let editingReportRid=null;       // which report is in edit mode
let editReportDraft={};          // {text, options:[], correct}
let myReportedQuestions=new Set(); // track question texts reported by this student (prevent duplicates)

// Dismissed flow
let showingDismissed=false, dismissedCountdown=120, dismissedTimer=null;

// Answer timing (client-side — seconds taken to answer current question)
let myLastAnswerTime=null;
let localAnswerTimes={};   // {pid: secs} built client-side from S.answers appearance time
let sessionCorrectTimes=[]; // secs for each correctly answered question this session
let studentQCount=0;       // how many questions this client has seen pushed (for student denominator)
// Cumulative answer times per player — accumulated across all revealed questions this session
// Used for tiebreaking: same pts → less total time = higher rank
let cumulativeAnswerTimes={};  // {pid: totalSecs}

// Cumulative scoring is now handled server-side via gameScores in server.js

// 🔥 Streak tracking
// For host: computed from S.history (full history available)
// For participants: tracked live in clientStreaks (persisted across renders)
let _streakCache = { histLen: -1, map: {} };
let clientStreaks = {}; // {pid: number} — maintained by participant client on each reveal
let lastFastestPid = null; // persists from revealed → idle so badge shows on waiting screen

// Home tabs
let homeSection='home'; // 'home' | 'leaderboard'

// Role-based admin state
let hostNotice='';           // text of global notice fetched from server
let joinRequests=[];         // [{id,name,email,username,createdAt}]
let updateRequests=[];       // [{id,userId,userName,type,newValue,createdAt}]
let registeredUsers=[];      // [{id,name,email,username,role,status,createdAt}]
let inspectingUser=null;     // user object host is currently inspecting
let inspectTab='overview';   // 'overview' | 'history'
let inspectCache=null;       // cached session history for inspected user
let adminLoading=false;      // whether admin requests are being fetched

// All-time leaderboard cache
let allTimeLB=null;
let todayLB=null;
let weekLB=null;
let homeLbTab='today'; // 'today' | 'week' | 'all'
// Per-tab fetch tracking: null=not started, false=loading, true=done
let lbFetched={today:null, week:null, all:null};
// Per-tab error messages (null = no error)
let lbErrors={today:null, week:null, all:null};

// Server schedules (shared between students and host)
let serverSchedules=null;
let hostSchedules=[]; // schedules shown in host panel

const STUN={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]};

// ── GITHUB CONFIG ─────────────────────────────────────────────────────────
const MY_TOKEN = '%%MY_TOKEN%%';

const GITHUB_REPO  = 'raeist-user/quizzap';
const GITHUB_BRANCH = 'main';
