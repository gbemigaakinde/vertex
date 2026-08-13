(function () {
  'use strict';

  window._registrationInProgress = false;
  let _pendingLoginEmail = '';
  let _loginMode = 'email';

  function renderLogin() {
    UI.mount(`
      <div class="cbt-layout cbt-layout--auth cbt-animate-in" style="padding: var(--sp-6) var(--sp-4);">

        <div style="text-align:center;margin-bottom:var(--sp-8);">
          <div style="display:inline-flex;align-items:center;justify-content:center;
                      width:40px;height:40px;background:var(--accent);border-radius:10px;
                      margin-bottom:var(--sp-4);box-shadow:var(--shadow-accent);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white"
                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
              <line x1="12" y1="22" x2="12" y2="15.5"/>
              <polyline points="22 8.5 12 15.5 2 8.5"/>
            </svg>
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
              </div>
            </div>

            <div id="loginAdmnoFields" style="display:none;">
              <div style="margin-bottom:var(--sp-3);">
                <label class="cbt-label" for="loginAdmno">Registration Number</label>
                <input id="loginAdmno" type="text" placeholder="e.g. VTX-2024-001"
                       autocomplete="off" style="text-transform:uppercase;" />
              </div>
            </div>

            <div style="margin-bottom:var(--sp-4);">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-1);">
                <label class="cbt-label" for="loginPass" style="margin-bottom:0;">Password</label>
                <button onclick="Auth.forgotPassword()" class="cbt-text-link"
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

  function showRegister() {
    document.getElementById('loginPanel').classList.add('hidden');
    document.getElementById('registerPanel').classList.remove('hidden');
  }

  function showLogin() {
    document.getElementById('registerPanel').classList.add('hidden');
    document.getElementById('loginPanel').classList.remove('hidden');
  }

  async function login() {
    const btn  = document.getElementById('loginBtn');
    const pass = document.getElementById('loginPass')?.value || '';

    if (!pass) { UI.toast('Please enter your password.', 'warning'); return; }

    UI.setLoading(btn, true);

    try {
      AppState.cancelListener('schoolDropdown');

      if (_loginMode === 'admno') {
        const rawAdmno = (document.getElementById('loginAdmno')?.value || '').trim().toUpperCase();
        if (!rawAdmno) {
          UI.toast('Please enter your admission number.', 'warning');
          UI.setLoading(btn, false);
          return;
        }

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
          console.error('[auth] admissionNumbers entry missing uid/email for:', rawAdmno);
          UI.toast('Account data error. Please contact Master Timothy.', 'error');
          UI.setLoading(btn, false);
          return;
        }

        await window.fbAuth.signInWithEmailAndPassword(email, pass);

      } else {
        const email = (document.getElementById('loginEmail')?.value || '').trim();
        if (!email) {
          UI.toast('Please enter your email and password.', 'warning');
          UI.setLoading(btn, false);
          return;
        }
        await window.fbAuth.signInWithEmailAndPassword(email, pass);
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
        class:       cls,
        school,
        email,
        admissionNo: null,
        createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
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
      UI.setLoading(btn, false);
    }
  }

  async function forgotPassword() {
    if (_loginMode === 'admno') {
      UI.toast(
        'Password reset requires your email. Switch to the Email tab, or contact Master Timothy.',
        'info',
        8000
      );
      return;
    }

    const email = window.prompt('Enter your registered email address:');
    if (!email) return;
    if (!email.includes('@')) { UI.toast('Please enter a valid email address.', 'warning'); return; }
    try {
      await window.fbAuth.sendPasswordResetEmail(email.trim());
      UI.toast('Password reset email sent! Check your inbox.', 'success', 6000);
    } catch (err) {
      const msg = err.code === 'auth/user-not-found' ? 'No account with this email.'
                : 'Could not send reset email. Try again.';
      UI.toast(msg, 'error');
    }
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
    _setLoginMode,
  };

})();
