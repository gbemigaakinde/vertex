/* ============================================================
   js/auth.js — Authentication: login, register, password reset
   ============================================================
   CHANGES FROM v2:
   - Login/register template uses design-system classes
   - Removed animated gradient title (institutional context)
   - Button sizes normalised — no oversized padding
   - Password toggle uses cbt-eye-btn class
   - Panel transitions are smooth
   - No functional logic changes
   ============================================================ */

(function () {
  'use strict';

  window._registrationInProgress = false;
  let _pendingLoginEmail = '';

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
            <div class="cbt-field" style="margin-bottom:var(--sp-3);">
              <label class="cbt-label" for="loginEmail">Email address</label>
              <input id="loginEmail" type="email" placeholder="yourname@vertex.com"
                     autocomplete="email" />
            </div>

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