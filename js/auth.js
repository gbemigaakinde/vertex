(function () {
  'use strict';

  window._registrationInProgress = false;
  let _pendingLoginEmail = '';
  let _loginMode = 'email';

  function renderLogin() {
    UI.mount(`
      <div class="cbt-layout cbt-layout--auth cbt-animate-in" style="padding: var(--sp-6) var(--sp-4);">

        <div style="text-align:center;margin-bottom:var(--sp-8);">
          <div role="img" aria-label="Vertex Tutorial Centre logo"
               style="display:inline-block;padding:10px 12px;background:#ffffff;
                      border:1px solid var(--border);border-radius:14px;
                      box-shadow:var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08));
                      margin-bottom:var(--sp-4);">
            <!-- vertex.jpeg cropped to the emblem. The white patch hides the small
                 "VERTEX" wordmark that sits in the lower-right of the original image. -->
            <div style="position:relative;width:52px;height:73px;overflow:hidden;
                        background:#ffffff url('vertex.jpeg') no-repeat;
                        background-size:97px 97px;background-position:-6.2px -11.9px;">
              <div style="position:absolute;left:74%;top:72%;right:0;bottom:0;background:#ffffff;"></div>
            </div>
          </div>
          <h1 style="font-size:var(--text-xl);font-weight:700;color:var(--text-1);letter-spacing:-0.025em;margin-bottom:0.25rem;">
            Vertex Tutorial
          </h1>
          <p style="font-size:var(--text-sm);color:var(--text-3);">Computer-Based Testing System</p>
        </div>

        <div class="cbt-card">

          <div id="loginPanel">

            <div style="margin-bottom:var(--sp-5);">
              <h2 style="font-size:var(--text-lg);font-weight:600;color:var(--text-1);margin-bottom:0.25rem;letter-spacing:-0.015em;">
                Sign in to your account
              </h2>
              <p style="font-size:var(--text-sm);color:var(--text-3);">
                Enter your credentials to continue
              </p>
            </div>

            <div style="display:flex;background:var(--bg-subtle);border:1px solid var(--border);
                        border-radius:var(--r-md);padding:3px;gap:3px;margin-bottom:var(--sp-4);">
              <button id="loginTabEmail" onclick="Auth._setLoginMode('email')"
                      style="flex:1;padding:.4375rem .75rem;font-size:var(--text-sm);font-weight:500;
                             cursor:pointer;border:none;border-radius:5px;font-family:inherit;
                             transition:background var(--t-fast),color var(--t-fast),box-shadow var(--t-fast);
                             background:var(--bg-base);color:var(--text-1);
                             box-shadow:var(--shadow-xs);">
                Login With Email
              </button>
              <button id="loginTabAdmno" onclick="Auth._setLoginMode('admno')"
                      style="flex:1;padding:.4375rem .75rem;font-size:var(--text-sm);font-weight:500;
                             cursor:pointer;border:none;border-radius:5px;font-family:inherit;
                             transition:background var(--t-fast),color var(--t-fast),box-shadow var(--t-fast);
                             background:transparent;color:var(--text-3);box-shadow:none;">
                Login With Reg. No.
              </button>
            </div>

            <div id="loginEmailFields">
              <div style="margin-bottom:var(--sp-3);">
                <label class="cbt-label" for="loginEmail">Email address</label>
                <input id="loginEmail" type="email" placeholder="you@example.com" autocomplete="email" />
                <div class="cbt-field-error" id="loginEmailErr" role="alert" hidden></div>
              </div>
            </div>

            <div id="loginAdmnoFields" style="display:none;">
              <div style="margin-bottom:var(--sp-3);">
                <label class="cbt-label" for="loginAdmno">Registration Number</label>
                <input id="loginAdmno" type="text" placeholder="e.g. VTX-2024-001"
                       autocomplete="off" style="text-transform:uppercase;" />
                <div class="cbt-field-error" id="loginAdmnoErr" role="alert" hidden></div>
              </div>
            </div>

            <div style="margin-bottom:var(--sp-4);">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-1);">
                <label class="cbt-label" for="loginPass" style="margin-bottom:0;">Password</label>
                <button type="button" onclick="Auth.forgotPassword()" class="cbt-text-link"
                        style="font-size:var(--text-xs);">Forgot password?</button>
              </div>
              <div class="cbt-password-wrap">
                <input id="loginPass" type="password" placeholder="••••••••" autocomplete="current-password" />
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

            <div class="cbt-field-error" id="loginPassErr" role="alert" hidden style="margin-top:-var(--sp-3);margin-bottom:var(--sp-3);"></div>
            <button id="loginBtn" onclick="Auth.login()" class="btn w-full btn-lg">
              Sign In
            </button>

            <div id="loginAdmnoHint" style="display:none;margin-top:var(--sp-3);
                 padding:.625rem .875rem;background:var(--info-subtle);
                 border:1px solid var(--info-border);border-radius:var(--r-md);
                 font-size:var(--text-xs);color:var(--info);line-height:1.6;">
              Your admission number was assigned by Master Timothy.
              If you don't have one, use the Email tab, or contact Master Timothy.
            </div>

            <div style="text-align:center;margin-top:var(--sp-4);padding-top:var(--sp-4);
                        border-top:1px solid var(--border);">
              <span style="font-size:var(--text-sm);color:var(--text-3);">New student? </span>
              <button onclick="Auth.showRegister()" class="cbt-text-link"
                      style="font-size:var(--text-sm);">Create an account</button>
            </div>

          </div>

          <div id="forgotPanel" class="hidden">
            <div style="margin-bottom:var(--sp-5);">
              <h2 style="font-size:var(--text-lg);font-weight:600;color:var(--text-1);margin-bottom:0.25rem;letter-spacing:-0.015em;">
                Reset your password
              </h2>
              <p style="font-size:var(--text-sm);color:var(--text-3);">
                Enter the email you registered with. We will send you a reset link.
              </p>
            </div>
            <div style="margin-bottom:var(--sp-4);">
              <label class="cbt-label" for="resetEmail">Email address</label>
              <input id="resetEmail" type="email" placeholder="you@example.com" autocomplete="email" />
              <div class="cbt-field-error" id="resetEmailErr" role="alert" hidden></div>
            </div>
            <div class="cbt-field-ok" id="resetOk" role="status" hidden></div>
            <button id="resetBtn" type="button" onclick="Auth.sendReset()" class="btn w-full btn-lg">Send reset link</button>
            <div style="text-align:center;margin-top:var(--sp-4);padding-top:var(--sp-4);border-top:1px solid var(--border);">
              <button type="button" onclick="Auth.showLogin()" class="cbt-text-link" style="font-size:var(--text-sm);">Back to sign in</button>
            </div>
          </div>

          <div id="registerPanel" class="hidden">

            <div style="margin-bottom:var(--sp-5);">
              <h2 style="font-size:var(--text-lg);font-weight:600;color:var(--text-1);margin-bottom:0.25rem;letter-spacing:-0.015em;">
                Create your account
              </h2>
              <p style="font-size:var(--text-sm);color:var(--text-3);">
                Fill in your details to get started
              </p>
            </div>

            <div style="display:flex;flex-direction:column;gap:var(--sp-3);">

              <div>
                <label class="cbt-label" for="regName">Full Name</label>
                <input id="regName" type="text" placeholder="Your full name" autocomplete="name" />
                <div class="cbt-field-error" id="regNameErr" role="alert" hidden></div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);">
                <div>
                  <label class="cbt-label" for="regClass">Class</label>
                  <select id="regClass">
                    <option value="" disabled selected>Select class</option>
                    <option>JSS1</option><option>JSS2</option><option>JSS3</option>
                    <option>SSS1</option><option>SSS2</option><option>SSS3</option>
                    <option>TUTORIAL</option>
                  </select>
                </div>
                <div>
                  <label class="cbt-label" for="regSchool">School</label>
                  <select id="regSchool">
                    <option value="" disabled selected>Loading...</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="cbt-label" for="regEmail">Email address</label>
                <input id="regEmail" type="email" placeholder="you@example.com" autocomplete="email" />
                <div class="cbt-field-error" id="regEmailErr" role="alert" hidden></div>
              </div>

              <div>
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
                <div class="cbt-field-error" id="regPassErr" role="alert" hidden></div>
              </div>

            </div>

            <button id="regBtn" onclick="Auth.register()" class="btn w-full btn-lg"
                    style="margin-top:var(--sp-5);">
              Create Account
            </button>

            <div style="text-align:center;margin-top:var(--sp-4);padding-top:var(--sp-4);
                        border-top:1px solid var(--border);">
              <span style="font-size:var(--text-sm);color:var(--text-3);">Already have an account? </span>
              <button onclick="Auth.showLogin()" class="cbt-text-link"
                      style="font-size:var(--text-sm);">Sign in</button>
            </div>

          </div>

        </div>

        <div class="cbt-auth-footer">
          With care from your master,
          <span style="font-weight:600;color:var(--accent);">Master Timothy</span>
        </div>

      </div>`);

    _loginMode = 'email';

    (function () {
      function _wireToggle(inputId, btnId, eyeId, eyeOffId) {
        const input  = document.getElementById(inputId);
        const btn    = document.getElementById(btnId);
        const eye    = document.getElementById(eyeId);
        const eyeOff = document.getElementById(eyeOffId);
        if (!input || !btn) return;
        btn.addEventListener('click', function () {
          const showing = input.type === 'text';
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

    _wireClear();
    const loginPassEl = document.getElementById('loginPass');
    if (loginPassEl) {
      loginPassEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') Auth.login();
      });
    }

    const admnoEl = document.getElementById('loginAdmno');
    if (admnoEl) {
      admnoEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') Auth.login();
      });
      admnoEl.addEventListener('input', function () {
        const pos = admnoEl.selectionStart;
        admnoEl.value = admnoEl.value.toUpperCase();
        admnoEl.setSelectionRange(pos, pos);
      });
    }

    const unsub = window.fbDb.collection('schools').orderBy('name').onSnapshot(snap => {
      const sel = document.getElementById('regSchool');
      if (!sel) { unsub(); AppState.cancelListener('schoolDropdown'); return; }
      let html = '<option value="" disabled selected>Select your school</option>';
      if (snap.empty) {
        html += '<option value="" disabled>No schools listed — contact Master Timothy</option>';
      } else {
        snap.forEach(doc => {
          const n = _esc(doc.data().name);
          html += `<option value="${n}">${n}</option>`;
        });
      }
      sel.innerHTML = html;
    }, err => {
      console.error('[auth] School load error:', err);
      const sel = document.getElementById('regSchool');
      if (sel) sel.innerHTML = '<option value="" disabled>Error loading schools</option>';
    });

    AppState.registerListener('schoolDropdown', unsub);

    if (_pendingLoginEmail) {
      const emailEl = document.getElementById('loginEmail');
      if (emailEl) emailEl.value = _pendingLoginEmail;
      UI.toast('Registration successful! Please sign in.', 'success', 7000);
      _pendingLoginEmail = '';
    }
  }

  function _setLoginMode(mode) {
    _loginMode = mode;

    const tabEmail  = document.getElementById('loginTabEmail');
    const tabAdmno  = document.getElementById('loginTabAdmno');
    const emailFlds = document.getElementById('loginEmailFields');
    const admnoFlds = document.getElementById('loginAdmnoFields');
    const admnoHint = document.getElementById('loginAdmnoHint');

    if (!tabEmail || !tabAdmno) return;

    if (mode === 'admno') {
      tabAdmno.style.background  = 'var(--bg-base)';
      tabAdmno.style.color       = 'var(--text-1)';
      tabAdmno.style.boxShadow   = 'var(--shadow-xs)';
      tabEmail.style.background  = 'transparent';
      tabEmail.style.color       = 'var(--text-3)';
      tabEmail.style.boxShadow   = 'none';
      if (emailFlds) emailFlds.style.display = 'none';
      if (admnoFlds) admnoFlds.style.display = '';
      if (admnoHint) admnoHint.style.display = '';
    } else {
      tabEmail.style.background  = 'var(--bg-base)';
      tabEmail.style.color       = 'var(--text-1)';
      tabEmail.style.boxShadow   = 'var(--shadow-xs)';
      tabAdmno.style.background  = 'transparent';
      tabAdmno.style.color       = 'var(--text-3)';
      tabAdmno.style.boxShadow   = 'none';
      if (emailFlds) emailFlds.style.display = '';
      if (admnoFlds) admnoFlds.style.display = 'none';
      if (admnoHint) admnoHint.style.display = 'none';
    }
  }

  function _showPanel(id) {
    ['loginPanel', 'registerPanel', 'forgotPanel'].forEach(function (p) {
      const el = document.getElementById(p);
      if (el) el.classList.toggle('hidden', p !== id);
    });
    _clearFieldErrors();
  }

  function showRegister() { _showPanel('registerPanel'); }
  function showLogin()    { _showPanel('loginPanel'); }

  // ── Field-level errors: red box, message under it, cursor lands in it ──
  function _errSlot(input) {
    let slot = document.getElementById(input.id + 'Err');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'cbt-field-error';
      slot.id = input.id + 'Err';
      slot.setAttribute('role', 'alert');
      slot.hidden = true;
      const anchor = input.closest('.cbt-password-wrap') || input;
      anchor.parentNode.insertBefore(slot, anchor.nextSibling);
    }
    return slot;
  }

  function _clearFieldError(input) {
    if (!input) return;
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
    const wrap = input.closest('.cbt-password-wrap');
    if (wrap) wrap.classList.remove('is-invalid');
    const slot = document.getElementById(input.id + 'Err');
    if (slot) { slot.hidden = true; slot.textContent = ''; }
  }

  function _clearFieldErrors() {
    document.querySelectorAll('#app .is-invalid, #app [aria-invalid]').forEach(function (el) {
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT') _clearFieldError(el);
      else el.classList.remove('is-invalid');
    });
    document.querySelectorAll('#app .cbt-field-error').forEach(function (e) { e.hidden = true; e.textContent = ''; });
  }

  // Marks every field in `ids` red. The first one gets the message and the cursor.
  // `msg` shows under the first field; extra fields are only highlighted.
  function _fieldError(ids, msg) {
    ids = [].concat(ids);
    let first = null;
    ids.forEach(function (id, i) {
      const input = document.getElementById(id);
      if (!input) return;
      if (!first) first = input;
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
      const wrap = input.closest('.cbt-password-wrap');
      if (wrap) wrap.classList.add('is-invalid');
      if (i === 0) {
        const slot = _errSlot(input);
        slot.textContent = msg;
        slot.hidden = false;
        input.setAttribute('aria-describedby', slot.id);
      }
    });
    if (first) {
      try { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
      try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
      first.classList.remove('shake'); void first.offsetWidth; first.classList.add('shake');
    }
  }

  // Typing in a red field clears its error straight away.
  function _wireClear() {
    const app = document.getElementById('app');
    if (!app || app._authClearWired) return;
    app._authClearWired = true;
    const handler = function (e) {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT') && t.classList.contains('is-invalid')) _clearFieldError(t);
    };
    app.addEventListener('input', handler);
    app.addEventListener('change', handler);
  }

  function _validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  // Decides which box a Firebase error belongs to.
  function _fieldFor(err, ctx) {
    const code = err && err.code ? String(err.code).toLowerCase() : '';
    const idField = ctx === 'login-admno' ? 'loginAdmno' : (ctx === 'register' ? 'regEmail' : (ctx === 'reset' ? 'resetEmail' : 'loginEmail'));
    const passField = ctx === 'register' ? 'regPass' : 'loginPass';
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/invalid-email':
      case 'auth/missing-email':
      case 'auth/email-already-in-use':
      case 'auth/user-disabled':
        return [idField];
      case 'auth/wrong-password':
      case 'auth/missing-password':
      case 'auth/weak-password':
        return [passField];
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
        return ctx === 'login-admno' || ctx === 'login-email' ? [passField, idField] : [idField];
      default:
        return null; // network, server, too-many-requests: no single box to blame
    }
  }

  // Shows an error. Field errors go under the box; everything else is a toast.
  function _showError(err, ctx, step) {
    const msg = describeError(err, step || ctx);
    const fields = _fieldFor(err, ctx);
    if (fields && !(typeof navigator !== 'undefined' && navigator.onLine === false)) _fieldError(fields, msg);
    else UI.toast(msg, 'error', 7000);
  }

  // ── Plain-English error messages ───────────────────────────────
  // Every Firebase Auth and Firestore error code a student could realistically hit,
  // written so a student can tell what went wrong and what to do next.
  // Nothing here ever shows a raw Firebase message or code.
  const _OFFLINE_MSG = 'You are offline. Switch on your data or Wi-Fi, then try again.';

  const _ERR_MSG = {
    // Sign-in details
    'auth/invalid-credential':     'Your details are not correct. Check them and try again.',
    'auth/invalid-login-credentials': 'Your details are not correct. Check them and try again.',
    'auth/wrong-password':         'That password is not correct. Try again, or tap "Forgot password?" to reset it.',
    'auth/user-not-found':         'We could not find an account with those details. Check the spelling and try again.',
    'auth/invalid-email':          'That email address does not look right. Check for typing mistakes, like a missing @ or a space.',
    'auth/missing-email':          'Please enter your email address.',
    'auth/missing-password':       'Please enter your password.',
    'auth/user-disabled':          'This account has been switched off. Please see Master Timothy.',
    'auth/too-many-requests':      'Too many tries in a short time. Please wait a few minutes, then try again.',
    'auth/email-already-in-use':   'An account with this email already exists. Tap "Sign in" instead, or reset your password if you forgot it.',
    'auth/weak-password':          'That password is too easy to guess. Use at least 6 characters.',
    'auth/operation-not-allowed':  'This kind of sign in is switched off right now. Please see Master Timothy.',
    // Session
    'auth/requires-recent-login':  'For your safety, please sign in again.',
    'auth/user-token-expired':     'Your sign-in has expired. Please sign in again.',
    'auth/id-token-expired':       'Your sign-in has expired. Please sign in again.',
    'auth/user-token-revoked':     'Your sign-in has expired. Please sign in again.',
    'auth/session-expired':        'Your sign-in has expired. Please sign in again.',
    // Connection
    'auth/network-request-failed': 'We could not reach the internet. Check your data or Wi-Fi and try again.',
    'auth/timeout':                'The connection is too slow and the request timed out. Check your internet and try again.',
    'auth/quota-exceeded':         'Too many people are signing in right now. Please try again in a few minutes.',
    'auth/web-storage-unsupported':'Your browser is blocking something the app needs to keep you signed in. Turn off private browsing, allow cookies, and try again.',
    // App set-up problems the student cannot fix
    'auth/internal-error':         'Something went wrong on our side. Please try again in a moment.',
    'auth/invalid-api-key':        'The app is not set up correctly. Please tell Master Timothy.',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'The app is not set up correctly. Please tell Master Timothy.',
    'auth/app-not-authorized':     'The app is not set up correctly. Please tell Master Timothy.',
    'auth/unauthorized-domain':    'This website address is not allowed to sign in. Please tell Master Timothy.',
    // School database (Firestore)
    'permission-denied':           'The school server did not allow that. Please tell Master Timothy if this keeps happening.',
    'unauthenticated':             'Please sign in again.',
    'unavailable':                 'We cannot reach the school server right now. Check your internet and try again in a moment.',
    'deadline-exceeded':           'The connection is too slow and the request timed out. Check your internet and try again.',
    'resource-exhausted':          'The school server is very busy right now. Please try again in a few minutes.',
    'not-found':                   'We could not find that record.',
    'cancelled':                   'That was interrupted. Please try again.',
    'aborted':                     'That was interrupted. Please try again.',
    'failed-precondition':         'Something went wrong on our side. Please try again, and tell Master Timothy if it keeps happening.',
    'invalid-argument':            'Something in your details is not accepted. Check them and try again.',
    'internal':                    'Something went wrong on our side. Please try again in a moment.',
    'unknown':                     'Something went wrong. Please try again in a moment.',
    'data-loss':                   'Something went wrong on our side. Please try again in a moment.'
  };

  // Where the same code needs a more specific sentence (for example, whether the
  // student signed in with an email or a registration number).
  const _CTX_MSG = {
    'login-email': {
      'auth/wrong-password':            'That password is not correct. Try again, or tap "Forgot password?" to reset it.',
      'auth/invalid-credential':        'Your email or password is not correct. Check both and try again. If you forgot your password, tap "Forgot password?".',
      'auth/invalid-login-credentials': 'Your email or password is not correct. Check both and try again. If you forgot your password, tap "Forgot password?".',
      'auth/user-not-found':            'We could not find an account with that email. Check the spelling, or tap "Create an account" if you are new.'
    },
    'login-admno': {
      'auth/invalid-credential':        'Your registration number or password is not correct. Check both and try again. If you forgot your password, switch to the Email tab and tap "Forgot password?".',
      'auth/invalid-login-credentials': 'Your registration number or password is not correct. Check both and try again. If you forgot your password, switch to the Email tab and tap "Forgot password?".',
      'auth/wrong-password':            'That password is not correct. Try again, or switch to the Email tab to reset it.',
      'auth/user-not-found':            'No account is linked to that registration number. Check the number or use the Email tab.'
    },
    'lookup': {
      'permission-denied':              'Signing in with a registration number is not available right now. Please use the Email tab, or see Master Timothy.'
    },
    'register': {
      'permission-denied':              'We could not save your details. Please try again, and tell Master Timothy if it keeps happening.',
      'auth/operation-not-allowed':     'New sign-ups are switched off right now. Please see Master Timothy.'
    },
    'reset': {
      'auth/user-not-found':            'We could not find an account with that email. Check the spelling and try again.'
    },
    'profile': {
      'permission-denied':              'You signed in, but the school server did not let us open your profile. Please tell Master Timothy.'
    }
  };

  const _FALLBACK_MSG = {
    'login-email': 'We could not sign you in. Check your details and your internet connection, then try again.',
    'login-admno': 'We could not sign you in. Check your details and your internet connection, then try again.',
    'lookup':      'We could not check that registration number. Check your internet connection and try again.',
    'register':    'We could not create your account. Check your details and your internet connection, then try again.',
    'reset':       'We could not send the reset email. Check the address and your internet connection, then try again.',
    'profile':     'Could not load your profile. Please check your internet connection and try again.'
  };

  // Turns any Firebase (Auth or Firestore) error into one plain-English sentence.
  // context: 'login-email' | 'login-admno' | 'lookup' | 'register' | 'reset' | 'profile'
  // fallback: optional sentence to use for an error we do not recognise.
  function describeError(err, context, fallback) {
    const ctx  = context || 'login-email';
    const code = err && err.code ? String(err.code).toLowerCase() : '';
    const raw  = err && err.message ? String(err.message) : '';

    if (typeof navigator !== 'undefined' && navigator.onLine === false) return _OFFLINE_MSG;

    if (_CTX_MSG[ctx] && _CTX_MSG[ctx][code]) return _CTX_MSG[ctx][code];
    if (_ERR_MSG[code]) return _ERR_MSG[code];

    // Browser-level network failures arrive without a Firebase code
    if (!code && /network|failed to fetch|load failed|timed? ?out/i.test(raw)) {
      return _ERR_MSG['auth/network-request-failed'];
    }

    return fallback || _FALLBACK_MSG[ctx] || _FALLBACK_MSG['login-email'];
  }

  async function login() {
    const btn     = document.getElementById('loginBtn');
    const pass    = document.getElementById('loginPass')?.value || '';
    const isAdmno = _loginMode === 'admno';
    const ctx     = isAdmno ? 'login-admno' : 'login-email';
    const idField = isAdmno ? 'loginAdmno' : 'loginEmail';
    _clearFieldErrors();

    const rawId = isAdmno
      ? (document.getElementById('loginAdmno')?.value || '').trim().toUpperCase()
      : (document.getElementById('loginEmail')?.value || '').trim();

    // Check what the student typed before contacting the server
    if (!rawId) {
      _fieldError(idField, isAdmno ? 'Please enter your registration number.' : 'Please enter your email address.');
      return;
    }
    if (!isAdmno && !_validEmail(rawId)) {
      _fieldError(idField, rawId.indexOf('@') === -1
        ? 'This email is missing the @ sign. It should look like name@gmail.com.'
        : 'That email address does not look right. Check for typing mistakes or spaces.');
      return;
    }
    if (!pass) { _fieldError('loginPass', 'Please enter your password.'); return; }

    UI.setLoading(btn, true);
    let step = 'signin';

    try {
      AppState.cancelListener('schoolDropdown');

      let email = rawId;

      if (isAdmno) {
        step = 'lookup';
        const notFound = 'We could not find that registration number. Check it and try again, or use the Email tab.';

        // A "/" would be read as a folder path by the database, so it cannot be a real number
        if (rawId.indexOf('/') !== -1) {
          _fieldError('loginAdmno', notFound);
          UI.setLoading(btn, false);
          return;
        }

        const indexSnap = await window.fbDb.collection('admissionNumbers').doc(rawId).get();

        if (!indexSnap.exists) {
          _fieldError('loginAdmno', notFound);
          UI.setLoading(btn, false);
          return;
        }

        const data = indexSnap.data() || {};
        if (!data.uid || !data.email) {
          console.error('[auth] admissionNumbers entry missing uid/email for:', rawId);
          _fieldError('loginAdmno', 'This registration number is not fully set up yet. Please see Master Timothy.');
          UI.setLoading(btn, false);
          return;
        }

        email = data.email;
        step = 'signin';
      }

      await window.fbAuth.signInWithEmailAndPassword(email, pass);
      // On success the auth listener in app.js takes over and opens the right screen.

    } catch (err) {
      console.error('[auth] login error at ' + step + ':', err && err.code, err);
      if (step === 'lookup') UI.toast(describeError(err, 'lookup'), 'error', 7000);
      else _showError(err, ctx);
      UI.setLoading(btn, false);
    }
  }

  async function register() {
    const btn    = document.getElementById('regBtn');
    const name   = (document.getElementById('regName')?.value   || '').trim();
    const cls    = document.getElementById('regClass')?.value   || '';
    const school = document.getElementById('regSchool')?.value  || '';
    const email  = (document.getElementById('regEmail')?.value  || '').trim();
    const pass   = document.getElementById('regPass')?.value    || '';
    _clearFieldErrors();

    if (!name)   { _fieldError('regName',   'Please enter your full name.'); return; }
    if (!cls)    { _fieldError('regClass',  'Please select your class.');    return; }
    if (!school) { _fieldError('regSchool', 'Please select your school.');   return; }
    if (!email)  { _fieldError('regEmail',  'Please enter your email address.'); return; }
    if (!_validEmail(email)) {
      _fieldError('regEmail', email.indexOf('@') === -1
        ? 'This email is missing the @ sign. It should look like name@gmail.com. If you have no email, use yourname@vertex.com.'
        : 'That email address does not look right. Check for typing mistakes or spaces.');
      return;
    }
    if (pass.length < 6) { _fieldError('regPass', 'Your password must be at least 6 characters long.'); return; }

    UI.setLoading(btn, true);
    window._registrationInProgress = true;

    let createdUid = null;

    try {
      // 1. Create Firebase Auth user
      const cred = await window.fbAuth.createUserWithEmailAndPassword(email, pass);
      createdUid = cred.user.uid;

      // 2. Write ONLY to pendingStudents — not to students collection
      await ActivityLog.submitForApproval(createdUid, email, name, cls, school);

      // 3. Registration submitted. Sign out silently, then show waiting room.
      window._registrationInProgress = false;
      await window.fbAuth.signOut();

      // 4. Remember the email so the login screen can pre-fill it
      _pendingLoginEmail = email;

      // 5. Sign in silently to attach the real-time listener for the waiting room.
      window._registrationInProgress = true;
      const reCred = await window.fbAuth.signInWithEmailAndPassword(email, pass);
      window._registrationInProgress = false;

      const uid = reCred.user.uid;
      AppState.cancelListener('schoolDropdown');
      ActivityLog.renderWaitingRoom(uid, name);

    } catch (err) {
      window._registrationInProgress = false;

      // If we created the auth user but failed afterwards, sign them out cleanly
      if (createdUid) {
        try { await window.fbDb.collection('pendingStudents').doc(createdUid).delete(); } catch (e) { /* non-fatal */ }
        try { await window.fbAuth.signOut(); } catch (e) {}
      } else if (window.fbAuth.currentUser) {
        window.fbAuth.signOut().catch(function () {});
      }

      console.error('[auth] register error:', err && err.code, err);
      _showError(err, 'register');
      UI.setLoading(btn, false);
    }
  }

  // "Forgot password?" opens an in-page form (no browser pop-up box)
  function forgotPassword() {
    if (_loginMode === 'admno') {
      UI.toast('Password reset needs your email. Switch to the Email tab, or contact Master Timothy.', 'info', 8000);
      return;
    }
    const typed = (document.getElementById('loginEmail')?.value || '').trim();
    _showPanel('forgotPanel');
    const input = document.getElementById('resetEmail');
    const ok = document.getElementById('resetOk');
    if (ok) { ok.hidden = true; ok.textContent = ''; }
    if (input) { if (typed) input.value = typed; input.focus(); }
  }

  async function sendReset() {
    const btn   = document.getElementById('resetBtn');
    const email = (document.getElementById('resetEmail')?.value || '').trim();
    const ok    = document.getElementById('resetOk');
    _clearFieldErrors();
    if (ok) { ok.hidden = true; ok.textContent = ''; }

    if (!email) { _fieldError('resetEmail', 'Please enter your email address.'); return; }
    if (!_validEmail(email)) {
      _fieldError('resetEmail', email.indexOf('@') === -1
        ? 'This email is missing the @ sign. It should look like name@gmail.com.'
        : 'That email address does not look right. Check for typing mistakes or spaces.');
      return;
    }

    UI.setLoading(btn, true);
    try {
      await window.fbAuth.sendPasswordResetEmail(email);
      if (ok) { ok.textContent = 'Reset link sent to ' + email + '. Check your inbox and your spam folder.'; ok.hidden = false; }
    } catch (err) {
      console.error('[auth] password reset error:', err && err.code, err);
      _showError(err, 'reset');
    }
    UI.setLoading(btn, false);
  }

  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.Auth = {
    renderLogin,
    showRegister,
    showLogin,
    login,
    register,
    forgotPassword,
    sendReset,
    describeError,
    _setLoginMode,
  };

})();
