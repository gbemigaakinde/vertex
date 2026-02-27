/* ============================================================
   js/auth.js — Authentication: login, register, password reset
   ============================================================ */

(function () {
  'use strict';

  window._registrationInProgress = false;
  let _pendingLoginEmail = '';

  /* ── Render login page ── */
  function renderLogin() {
    UI.mount(`
      <div class="max-w-md w-full glass p-10 animate-fadeIn">
        <div class="text-center mb-10">
          <h1 class="animated-text mb-3">
               Vertex Tutorial
          </h1>
          <p class="text-xl text-gray-600">Computer-Based Testing System</p>
        </div>

        <!-- LOGIN PANEL -->
        <div id="loginPanel">
          <input id="loginEmail" type="email" placeholder="Email address" class="mb-4" autocomplete="email" />
          <div class="mb-6" style="position:relative;display:flex;align-items:center;">
            <input id="loginPass" type="password" placeholder="Password" style="padding-right:3rem;margin-bottom:0;" autocomplete="current-password" />
            <button type="button" id="loginPassToggle"
              aria-label="Show password" aria-pressed="false"
              style="position:absolute;right:.75rem;top:50%;transform:translateY(-50%);
                     width:32px;height:32px;background:none;border:none;cursor:pointer;
                     display:flex;align-items:center;justify-content:center;
                     color:#9ca3af;border-radius:6px;padding:0;transition:color .15s;">
              <svg id="loginPassEye" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <svg id="loginPassEyeOff" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>
          <button id="loginBtn" onclick="Auth.login()" class="btn w-full text-xl py-5 mb-4">LOGIN</button>
          <p class="text-center text-sm text-gray-600 mb-3">
            New student?
            <button onclick="Auth.showRegister()" class="text-purple-600 underline font-medium">Register</button>
          </p>
          <p class="text-center text-sm">
            <button onclick="Auth.forgotPassword()" class="text-purple-600 underline font-medium">Forgot Password?</button>
          </p>
          <p class="text-center text-xs text-gray-500 mt-8">
            With love from your master,<br>
            <span class="font-semibold text-purple-600">Master Timothy</span>
          </p>
        </div>

        <!-- REGISTER PANEL -->
        <div id="registerPanel" class="hidden space-y-4">
          <input id="regName"  type="text"  placeholder="Full Name"  autocomplete="name" />
          <select id="regClass">
            <option value="" disabled selected>Select Class</option>
            <option>JSS1</option><option>JSS2</option><option>JSS3</option>
            <option>SSS1</option><option>SSS2</option><option>SSS3</option>
            <option>TUTORIAL</option>
          </select>
          <select id="regSchool">
            <option value="" disabled selected>Loading schools...</option>
          </select>
          <input id="regEmail" type="email" placeholder="Email address" autocomplete="email" />
          <div style="position:relative;display:flex;align-items:center;">
            <input id="regPass" type="password" placeholder="Password (min 6 chars)" style="padding-right:3rem;margin-bottom:0;" autocomplete="new-password" />
            <button type="button" id="regPassToggle"
              aria-label="Show password" aria-pressed="false"
              style="position:absolute;right:.75rem;top:50%;transform:translateY(-50%);
                     width:32px;height:32px;background:none;border:none;cursor:pointer;
                     display:flex;align-items:center;justify-content:center;
                     color:#9ca3af;border-radius:6px;padding:0;transition:color .15s;">
              <svg id="regPassEye" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <svg id="regPassEyeOff" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>
          <button id="regBtn" onclick="Auth.register()" class="btn w-full text-xl py-5">REGISTER</button>
          <p class="text-center text-sm text-gray-600">
            <button onclick="Auth.showLogin()" class="text-purple-600 underline font-medium">Back to Login</button>
          </p>
        </div>
      </div>

      <!-- News ticker -->
      <div class="news-ticker-container" role="region" aria-label="Notice ticker" aria-live="polite">
        <div class="ticker-wrapper">
          <div class="ticker-label">
            <span class="ticker-label-icon" aria-hidden="true">•</span>
            <span>NOTE</span>
          </div>
          <div class="ticker-content">
            <div class="ticker-text speed-normal" id="tickerScroll"></div>
          </div>
          <button class="ticker-close" onclick="closeTicker()" aria-label="Close ticker">x</button>
        </div>
      </div>`);

    if (typeof initTicker === 'function' && document.getElementById('tickerScroll')) {
      initTicker();
    }

    // Wire up password visibility toggles
    (function () {
      function _wireToggle(inputId, btnId, eyeId, eyeOffId) {
        var input  = document.getElementById(inputId);
        var btn    = document.getElementById(btnId);
        var eye    = document.getElementById(eyeId);
        var eyeOff = document.getElementById(eyeOffId);
        if (!input || !btn) return;
        btn.addEventListener('mouseover', function () { btn.style.color = '#4f46e5'; });
        btn.addEventListener('mouseout',  function () { btn.style.color = '#9ca3af'; });
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

    const unsub = window.fbDb.collection('schools').orderBy('name').onSnapshot(snap => {
      const sel = document.getElementById('regSchool');
      if (!sel) {
        unsub();
        AppState.cancelListener('schoolDropdown');
        return;
      }
      let html = '<option value="" disabled selected>Select your school</option>';
      if (snap.empty) {
        html += '<option value="" disabled>No schools listed yet - contact Master Timothy</option>';
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
      if (sel) sel.innerHTML = '<option value="" disabled>Error loading schools - refresh page</option>';
    });

    AppState.registerListener('schoolDropdown', unsub);

    if (_pendingLoginEmail) {
      const emailEl = document.getElementById('loginEmail');
      if (emailEl) emailEl.value = _pendingLoginEmail;
      UI.toast('Registration successful! Please log in with your new account.', 'success', 7000);
      _pendingLoginEmail = '';
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
    const btn   = document.getElementById('loginBtn');
    const email = (document.getElementById('loginEmail')?.value || '').trim();
    const pass  = document.getElementById('loginPass')?.value || '';

    if (!email || !pass) {
      UI.toast('Please enter your email and password.', 'warning');
      return;
    }

    UI.setLoading(btn, true);
    try {
      AppState.cancelListener('schoolDropdown');
      await window.fbAuth.signInWithEmailAndPassword(email, pass);
    } catch (err) {
      const msg = err.code === 'auth/user-not-found'     ? 'No account found with this email.'
                : err.code === 'auth/wrong-password'     ? 'Incorrect password.'
                : err.code === 'auth/too-many-requests'  ? 'Too many failed attempts. Try again later.'
                : err.code === 'auth/invalid-email'      ? 'Invalid email address.'
                : err.code === 'auth/invalid-credential' ? 'Incorrect email or password.'
                : 'Login failed. Please try again.';
      UI.toast(msg, 'error');
    } finally {
      if (document.getElementById('loginBtn')) {
        UI.setLoading(btn, false);
      }
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
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      window._registrationInProgress = false;
      _pendingLoginEmail = email;
      await window.fbAuth.signOut();

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

    } finally {
      if (document.getElementById('regBtn')) {
        UI.setLoading(btn, false);
      }
    }
  }

  /* ── Forgot password ── */
  async function forgotPassword() {
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
  window.Auth = { renderLogin, showRegister, showLogin, login, register, forgotPassword };

})();