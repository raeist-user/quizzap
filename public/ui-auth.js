/* ══════════════════════════════════════
   AUTH SCREENS
══════════════════════════════════════ */
let authTab='login';
function authHTML(){
  return `<div class="auth-page">
    <div class="auth-box">
      <div class="auth-logo">📚 Shadab Coaching Centre</div>
      <div class="auth-sub">Sign in to join or host live quizzes</div>
      <div class="auth-tabs">
        <button class="auth-tab${authTab==='login'?' active':''}" id="tab-login">Sign in</button>
        <button class="auth-tab${authTab==='register'?' active':''}" id="tab-register">Register</button>
      </div>
      ${authTab==='login'?loginFormHTML():registerFormHTML()}
    </div>
  </div>`;
}
function loginFormHTML(){
  return `<div>
    <div class="form-group"><label class="form-label">Email or username</label><input class="form-input" type="text" id="auth-identifier" placeholder="you@gmail.com or your_username" autocomplete="username" autocapitalize="none" spellcheck="false"/></div>
    <div class="form-group"><label class="form-label">Password</label><input class="form-input" type="password" id="auth-pw" placeholder="••••••••" autocomplete="current-password"/></div>
    <div id="auth-err" class="form-error"></div>
    <button class="btn btn-dark btn-full mt2" id="btn-login">Sign in →</button>
  </div>`;
}
function registerFormHTML(){
  return `<div>
    <div class="form-group"><label class="form-label">Full name</label><input class="form-input" type="text" id="auth-name" placeholder="Your name" autocomplete="name"/></div>
    <div class="form-group"><label class="form-label">Email</label><input class="form-input" type="email" id="auth-email" placeholder="you@gmail.com" autocomplete="email" autocapitalize="none" spellcheck="false"/></div>
    <div class="form-group"><label class="form-label">Username </label><div style="position:relative"><input class="form-input" type="text" id="auth-username" placeholder="your_username" autocomplete="off" autocapitalize="none" spellcheck="false" style="padding-right:36px"/><span id="un-status" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:.85rem;line-height:1;pointer-events:none"></span></div><small id="un-hint" style="font-size:.72rem;margin-top:3px;display:block;color:var(--mid)">Letters, numbers, underscores only · used for login &amp; profile</small></div>
    <div class="form-group"><label class="form-label">Password <span style="font-weight:400;text-transform:none;letter-spacing:0">(min 6 chars)</span></label><input class="form-input" type="password" id="auth-pw" placeholder="••••••••" autocomplete="new-password"/></div>
    <div id="auth-err" class="form-error"></div>
    <button class="btn btn-dark btn-full mt2" id="btn-register">Create account →</button>
  </div>`;
}
