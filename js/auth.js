/* ============================================================
   js/auth.js — Authentication: login, register, password reset
   ============================================================
   CHANGES FROM v3:
   - Login panel now supports TWO modes:
       1. Email + Password  (existing, unchanged)
       2. Admission No + Password  (new)
     A tab toggle switches between them. Both paths ultimately
     call Firebase signInWithEmailAndPassword — the admissionNo
     path first resolves the email via the admissionNumbers
     index collection, then proceeds identically.
   - Register form unchanged except admissionNo field is NOT
     shown to students — only teachers assign admission numbers.
   - forgotPassword works only with email (admission-no users
     must contact Master Timothy to reset).
   ============================================================ */

(function () {
  'use strict';

  window._registrationInProgress = false;
  let _pendingLoginEmail = '';

  /* ── Which login mode is active ── */
  let _loginMode = 'email'; // 'email' | 'admno'

  /* ── Render login page ── */
  function renderLogin() {
    UI.mount(`
      <div class="cbt-layout cbt-layout--auth cbt-animate-in">

        <div class="cbt-card">

          <!-- Brand header -->
          <div style="text-align:center;margin-bottom:var(--sp-6);">
            <div style="display:inline-flex;align-items:center;justify-content:center;
                        width:40px;height:40px;background:var(--brand);border-radius:10px;
                        margin-bottom:var(--sp-3);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white"
                   stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
                <line x1="12" y1="22" x2="12" y2="15.5"/>
                <polyline points="22 8.5 12 15.5 2 8.5"/>
              </svg>
            </div>
            <h1 class="cbt-brand-title">Vertex Tutorial</h1>
            <p class="cbt-brand-subtitle">Computer-Based Testing System</p>
          </div>

          <!-- LOGIN PANEL -->
          <div id="loginPanel">

            <!-- Login mode toggle -->
            <div style="display:flex;gap:0;border:1px solid var(--border,#e5e7eb);
                        border-radius:8px;overflow:hidden;margin-bottom:var(--sp-4);">
              <button id="loginTabEmail" onclick="Auth._setLoginMode('email')"
                      style="flex:1;padding:.5rem .75rem;font-size:.8125rem;font-weight:600;
                             cursor:pointer;border:none;font-family:inherit;transition:background .12s,color .12s;
                             background:var(--brand,#3b5bdb);color:#fff;">
                Email
              </button>
              <button id="loginTabAdmno" onclick="Auth._setLoginMode('admno')"
                      style="flex:1;padding:.5rem .75rem;font-size:.8125rem;font-weight:600;
                             cursor:pointer;border:none;border-left:1px solid var(--border,#e5e7eb);
                             font-family:inherit;transition:background .12s,color .12s;
                             background:var(--surface-muted,#f3f4f6);color:var(--text-tertiary,#6b7280);">
                Admission No
              </button>
            </div>

            <!-- Email login fields -->
            <div id="loginEmailFields">
              <div class="cbt-field" style="margin-bottom:var(--sp-3);">
                <label class="cbt-label" for="loginEmail">Email address</label>
                <input id="loginEmail" type="email" placeholder="yourname@vertex.com"
                       autocomplete="email" />
              </div>
            </div>

            <!-- Admission No login field -->
            <div id="loginAdmnoFields" style="display:none;">
              <div class="cbt-field" style="margin-bottom:var(--sp-3);">
                <label class="cbt-label" for="loginAdmno">Admission / Registration Number</label>
                <input id="loginAdmno" type="text" placeholder="e.g. VTX-2024-001"
                       autocomplete="username" style="text-transform:uppercase;" />
              </div>
            </div>

            <!-- Shared password field -->
            <div class="cbt-field" style="margin-bottom:var(--sp-5);">
              <label class="cbt-label" for="loginPass">Password</label>
              <div class="cbt-password-wrap">
                <input id="loginPass" type="password" placeholder="••••••••"
                       autocomplete="current-password" />
                <button type="button" id="loginPassToggle" class="cbt-eye-btn"
                        aria-label="Show password" aria-pressed="false">
                  <svg id="loginPassEye" xmlns="http://www.w3.org/2000/svg"
                       width="16" height="16" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  <svg id="loginPassEyeOff" xmlns="http://www.w3.org/2000/svg"
                       width="16" height="16" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                       style="display:none;">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                </button>
              </div>
            </div>

            <button id="loginBtn" onclick="Auth.login()"
                    class="btn w-full" style="margin-bottom:var(--sp-3);">
              Sign In
            </button>

            <div style="text-align:center;font-size:var(--text-sm);color:var(--text-tertiary);">
              <span>New student? </span>
              <button onclick="Auth.showRegister()" class="cbt-text-link">Register here</button>
            </div>

            <div style="text-align:center;margin-top:var(--sp-2);font-size:var(--text-sm);">
              <button onclick="Auth.forgotPassword()" class="cbt-text-link">
                Forgot password?
              </button>
            </div>

            <!-- Admission No hint -->
            <div id="loginAdmnoHint" style="display:none;margin-top:var(--sp-3);
                 padding:.625rem .875rem;background:var(--brand-bg,#edf2ff);
                 border:1px solid var(--brand-border,#bac8ff);border-radius:8px;
                 font-size:.8125rem;color:var(--brand-text,#3730a3);line-height:1.6;">
              ℹ️ Your admission number was assigned by Master Timothy.
              If you don't have one, use the <strong>Email</strong> tab instead,
              or contact Master Timothy.
            </div>

          </div>

          <!-- REGISTER PANEL -->
          <div id="registerPanel" class="hidden">
            <div style="display:flex;flex-direction:column;gap:var(--sp-3);">

              <div class="cbt-field">
                <label class="cbt-label" for="regName">Full Name</label>
                <input id="regName" type="text" placeholder="Your full name"
                       autocomplete="name" />
              </div>

              <div class="cbt-field">
                <label class="cbt-label" for="regClass">Class</label>
                <select id="regClass">
                  <option value="" disabled selected>Select your class</option>
                  <option>JSS1</option><option>JSS2</option><option>JSS3</option>
                  <option>SSS1</option><option>SSS2</option><option>SSS3</option>
                  <option>TUTORIAL</option>
                </select>
              </div>

              <div class="cbt-field">
                <label class="cbt-label" for="regSchool">School</label>
                <select id="regSchool">
                  <option value="" disabled selected>Loading schools...</option>
                </select>
              </div>

              <div class="cbt-field">
                <label class="cbt-label" for="regEmail">Email address</label>
                <input id="regEmail" type="email" placeholder="yourname@vertex.com"
                       autocomplete="email" />
              </div>

              <div class="cbt-field">
                <label class="cbt-label" for="regPass">Password</label>
                <div class="cbt-password-wrap">
                  <input id="regPass" type="password" placeholder="At least 6 characters"
                         autocomplete="new-password" />
                  <button type="button" id="regPassToggle" class="cbt-eye-btn"
                          aria-label="Show password" aria-pressed="false">
                    <svg id="regPassEye" xmlns="http://www.w3.org/2000/svg"
                         width="16" height="16" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    <svg id="regPassEyeOff" xmlns="http://www.w3.org/2000/svg"
                         width="16" height="16" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                         style="display:none;">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  </button>
                </div>
              </div>

            </div>

            <button id="regBtn" onclick="Auth.register()"
                    class="btn w-full" style="margin-top:var(--sp-4);margin-bottom:var(--sp-3);">
              Create Account
            </button>

            <div style="text-align:center;font-size:var(--text-sm);color:var(--text-tertiary);">
              Already registered?
              <button onclick="Auth.showLogin()" class="cbt-text-link">Back to sign in</button>
            </div>
          </div>

          <!-- Footer -->
          <div class="cbt-auth-footer">
            With care from your master,
            <span style="font-weight:600;color:var(--brand);">Master Timothy</span>
          </div>

        </div><!-- /cbt-card -->

        <!-- News ticker -->
        <div class="news-ticker-container" role="region"
             aria-label="Notice ticker" aria-live="polite"
             style="margin-top:var(--sp-4);">
          <div class="ticker-wrapper">
            <div class="ticker-label">
              <span class="ticker-label-icon" aria-hidden="true">•</span>
              <span>NOTE</span>
            </div>
            <div class="ticker-content">
              <div class="ticker-text speed-normal" id="tickerScroll"></div>
            </div>
            <button class="ticker-close" onclick="closeTicker()" aria-label="Close ticker">×</button>
          </div>
        </div>

      </div>`);

    if (typeof initTicker === 'function' && document.getElementById('tickerScroll')) {
      initTicker();
    }

    // Restore login mode state
    _loginMode = 'email';

    // Wire up password visibility toggles
    (function () {
      function _wireToggle(inputId, btnId, eyeId, eyeOffId) {
        var input  = document.getElementById(inputId);
        var btn    = document.getElementById(btnId);
        var eye    = document.getElementById(eyeId);
        var eyeOff = document.getElementById(eyeOffId);
        if (!input || !btn) return;
        btn.addEventListener('click', function () {
          var showing = input.type === 'text';
          input.type           = showing ? 'password' : 'text';
          eye.style.display    = showing ? ''         : 'none';
          eyeOff.style.display = showing ? 'none'     : '';
          btn.setAttribute('aria-label',   showing ? 'Show password' : 'Hide password');
          btn.setAttribute('aria-pressed', String(!showing));
        });
      }
      _wireToggle('loginPass', 'loginPassToggle', 'loginPassEye', 'loginPassEyeOff');
      _wireToggle('regPass',   'regPassToggle',   'regPassEye',   'regPassEyeOff');
    }());

    // Allow Enter key on password field to submit
    var loginPassEl = document.getElementById('loginPass');
    if (loginPassEl) {
      loginPassEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') Auth.login();
      });
    }

    // Allow Enter on admission no field too
    var admnoEl = document.getElementById('loginAdmno');
    if (admnoEl) {
      admnoEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') Auth.login();
      });
      // Auto-uppercase as user types
      admnoEl.addEventListener('input', function () {
        var pos = admnoEl.selectionStart;
        admnoEl.value = admnoEl.value.toUpperCase();
        admnoEl.setSelectionRange(pos, pos);
      });
    }

    const unsub = window.fbDb.collection('schools').orderBy('name').onSnapshot(snap => {
      const sel = document.getElementById('regSchool');
      if (!sel) {
        unsub();
        AppState.cancelListener('schoolDropdown');
        return;
      }
      let html = '<option value="" disabled selected>Select your school</option>';
      if (snap.empty) {
        html += '<option value="" disabled>No schools listed yet — contact Master Timothy</option>';
      } else {
        snap.forEach(doc => {
          const n = _esc(doc.data().name);
          html += '<option value="' + n + '">' + n + '</option>';
        });
      }
      sel.innerHTML = html;
    }, err => {
      console.error('[auth] School load error:', err);
      const sel = document.getElementById('regSchool');
      if (sel) sel.innerHTML = '<option value="" disabled>Error loading schools — refresh page</option>';
    });

    AppState.registerListener('schoolDropdown', unsub);

    if (_pendingLoginEmail) {
      const emailEl = document.getElementById('loginEmail');
      if (emailEl) emailEl.value = _pendingLoginEmail;
      UI.toast('Registration successful! Please sign in with your new account.', 'success', 7000);
      _pendingLoginEmail = '';
    }
  }

  /* ── Switch login mode (email vs admission no) ── */
  function _setLoginMode(mode) {
    _loginMode = mode;

    var tabEmail  = document.getElementById('loginTabEmail');
    var tabAdmno  = document.getElementById('loginTabAdmno');
    var emailFlds = document.getElementById('loginEmailFields');
    var admnoFlds = document.getElementById('loginAdmnoFields');
    var admnoHint = document.getElementById('loginAdmnoHint');

    if (!tabEmail || !tabAdmno) return;

    if (mode === 'admno') {
      tabAdmno.style.background = 'var(--brand,#3b5bdb)';
      tabAdmno.style.color      = '#fff';
      tabEmail.style.background = 'var(--surface-muted,#f3f4f6)';
      tabEmail.style.color      = 'var(--text-tertiary,#6b7280)';
      if (emailFlds) emailFlds.style.display = 'none';
      if (admnoFlds) admnoFlds.style.display = '';
      if (admnoHint) admnoHint.style.display = '';
    } else {
      tabEmail.style.background = 'var(--brand,#3b5bdb)';
      tabEmail.style.color      = '#fff';
      tabAdmno.style.background = 'var(--surface-muted,#f3f4f6)';
      tabAdmno.style.color      = 'var(--text-tertiary,#6b7280)';
      if (emailFlds) emailFlds.style.display = '';
      if (admnoFlds) admnoFlds.style.display = 'none';
      if (admnoHint) admnoHint.style.display = 'none';
    }
  }

  function showRegister() {
    document.getElementById('loginPanel').classList.add('hidden');
    document.getElementById('registerPanel').classList.remove('hidden');
  }

  function showLogin() {
    document.getElementById('registerPanel').classList.add('hidden');
    document.getElementById('loginPanel').classList.remove('hidden');
  }

  /* ── Login ── */
  async function login() {
    const btn  = document.getElementById('loginBtn');
    const pass = document.getElementById('loginPass')?.value || '';

    if (!pass) {
      UI.toast('Please enter your password.', 'warning');
      return;
    }

    UI.setLoading(btn, true);

    try {
      AppState.cancelListener('schoolDropdown');

      if (_loginMode === 'admno') {
        // ── Admission No path ──
        const rawAdmno = (document.getElementById('loginAdmno')?.value || '').trim().toUpperCase();
        if (!rawAdmno) {
          UI.toast('Please enter your admission number.', 'warning');
          UI.setLoading(btn, false);
          return;
        }

        // 1. Look up the admissionNo index
        let indexSnap;
        try {
          indexSnap = await window.fbDb.collection('admissionNumbers').doc(rawAdmno).get();
        } catch (fetchErr) {
          console.error('[auth] admissionNumbers lookup error:', fetchErr);
          UI.toast('Could not verify admission number. Please try again.', 'error');
          UI.setLoading(btn, false);
          return;
        }

        if (!indexSnap.exists) {
          UI.toast('Admission number not found. Check the number or use the Email tab.', 'error');
          UI.setLoading(btn, false);
          return;
        }

        const { uid, email } = indexSnap.data();

        if (!uid || !email) {
          // Index entry is malformed — shouldn't happen in normal operation
          console.error('[auth] admissionNumbers entry missing uid/email for:', rawAdmno);
          UI.toast('Account data error. Please contact Master Timothy.', 'error');
          UI.setLoading(btn, false);
          return;
        }

        // 2. Sign in with the resolved email
        await window.fbAuth.signInWithEmailAndPassword(email, pass);
        // On success the DOM is replaced by onAuthStateChanged

      } else {
        // ── Email path (unchanged) ──
        const email = (document.getElementById('loginEmail')?.value || '').trim();
        if (!email) {
          UI.toast('Please enter your email and password.', 'warning');
          UI.setLoading(btn, false);
          return;
        }
        await window.fbAuth.signInWithEmailAndPassword(email, pass);
        // On success the DOM is replaced by onAuthStateChanged
      }

    } catch (err) {
      const msg = err.code === 'auth/user-not-found'     ? 'No account found with this email.'
                : err.code === 'auth/wrong-password'     ? 'Incorrect password.'
                : err.code === 'auth/too-many-requests'  ? 'Too many failed attempts. Try again later.'
                : err.code === 'auth/invalid-email'      ? 'Invalid email address.'
                : err.code === 'auth/invalid-credential' ? 'Incorrect credentials. Please check and try again.'
                : 'Login failed. Please try again.';
      UI.toast(msg, 'error');
      UI.setLoading(btn, false);
    }
  }

  /* ── Register ── */
  async function register() {
  const btn    = document.getElementById('regBtn');
  const name   = (document.getElementById('regName')?.value   || '').trim();
  const cls    = document.getElementById('regClass')?.value   || '';
  const school = document.getElementById('regSchool')?.value  || '';
  const email  = (document.getElementById('regEmail')?.value  || '').trim();
  const pass   = document.getElementById('regPass')?.value    || '';

  if (!name)           { UI.toast('Please enter your full name.',             'warning'); return; }
  if (!cls)            { UI.toast('Please select your class.',                'warning'); return; }
  if (!school)         { UI.toast('Please select your school.',               'warning'); return; }
  if (!email)          { UI.toast('Please enter your email.',                 'warning'); return; }
  if (pass.length < 6) { UI.toast('Password must be at least 6 characters.', 'warning'); return; }

  UI.setLoading(btn, true);
  window._registrationInProgress = true;

  try {
    const cred = await window.fbAuth.createUserWithEmailAndPassword(email, pass);
    const uid  = cred.user.uid;

    await window.fbDb.collection('students').doc(uid).set({
      name,
      class:     cls,
      school,
      email,
      admissionNo: null,   // placeholder — teacher assigns later
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    window._registrationInProgress = false;
    _pendingLoginEmail = email;
    await window.fbAuth.signOut();
    // signOut triggers onAuthStateChanged → renderLogin()

  } catch (err) {
    window._registrationInProgress = false;

    if (window.fbAuth.currentUser) {
      window.fbAuth.signOut().catch(() => {});
    }

    const msg = err.code === 'auth/email-already-in-use'  ? 'An account with this email already exists.'
              : err.code === 'auth/invalid-email'         ? 'Invalid email address.'
              : err.code === 'auth/weak-password'         ? 'Password must be at least 6 characters.'
              : err.code === 'auth/operation-not-allowed' ? 'Registration is currently disabled. Contact Master Timothy.'
              : err.code === 'auth/too-many-requests'     ? 'Too many attempts. Please wait and try again.'
              : err.code === 'permission-denied'          ? 'Could not save profile. Please try again.'
              : 'Registration failed. Please try again.';
    UI.toast(msg, 'error', 8000);
    UI.setLoading(btn, false);
  }
}

  /* ── Forgot password ── */
  async function forgotPassword() {
    // Only email-based reset is supported — admission no users must contact teacher
    if (_loginMode === 'admno') {
      UI.toast(
        'Password reset requires your email address. Switch to the Email tab, or contact Master Timothy.',
        'info',
        8000
      );
      return;
    }

    const email = window.prompt('Enter your registered email address:');
    if (!email) return;
    if (!email.includes('@')) {
      UI.toast('Please enter a valid email address.', 'warning');
      return;
    }
    try {
      await window.fbAuth.sendPasswordResetEmail(email.trim());
      UI.toast('Password reset email sent! Check your inbox.', 'success', 6000);
    } catch (err) {
      const msg = err.code === 'auth/user-not-found' ? 'No account with this email.'
                : 'Could not send reset email. Try again.';
      UI.toast(msg, 'error');
    }
  }

  /* ── Private helpers ── */
  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Expose ── */
  window.Auth = {
    renderLogin,
    showRegister,
    showLogin,
    login,
    register,
    forgotPassword,
    _setLoginMode,
  };

})();
