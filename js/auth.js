/* ============================================================
   js/auth.js — Authentication: login, register, password reset
   ============================================================ */

(function () {
  'use strict';

  /* ── Render login page ── */
  function renderLogin() {
    UI.mount(`
      <div class="max-w-md w-full glass p-10 animate-fadeIn">
        <div class="text-center mb-10">
          <h1 class="text-5xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">
            Excellence Tutorial
          </h1>
          <p class="text-xl text-gray-600">Computer-Based Testing System</p>
        </div>

        <!-- LOGIN PANEL -->
        <div id="loginPanel">
          <input id="loginEmail" type="email" placeholder="Email address" class="mb-4" autocomplete="email" />
          <input id="loginPass"  type="password" placeholder="Password"      class="mb-6" autocomplete="current-password" />
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
          <input id="regName"  type="text"     placeholder="Full Name" autocomplete="name" />
          <select id="regClass">
            <option value="" disabled selected>Select Class</option>
            <option>JSS1</option><option>JSS2</option><option>JSS3</option>
            <option>SSS1</option><option>SSS2</option><option>SSS3</option>
          </select>
          <select id="regSchool">
            <option value="" disabled selected>Loading schools...</option>
          </select>
          <input id="regEmail" type="email"    placeholder="Email address"         autocomplete="email" />
          <input id="regPass"  type="password" placeholder="Password (min 6 chars)" autocomplete="new-password" />
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
          <button class="ticker-close" onclick="closeTicker()" aria-label="Close ticker">×</button>
        </div>
      </div>`);

    // Initialize news ticker if available
    if (typeof initTicker === 'function') initTicker();

    // Load schools into dropdown with a real-time listener
    const unsub = fbDb.collection('schools').orderBy('name').onSnapshot(snap => {
      const sel = document.getElementById('regSchool');
      if (!sel) { unsub(); return; }
      let html = '<option value="" disabled selected>Select your school</option>';
      if (snap.empty) {
        html += '<option value="" disabled>No schools listed yet — contact Master Timothy</option>';
      } else {
        snap.forEach(doc => {
          const n = doc.data().name;
          html += `<option value="${n}">${n}</option>`;
        });
      }
      sel.innerHTML = html;
    }, err => {
      console.error('[Auth] school load error:', err);
      const sel = document.getElementById('regSchool');
      if (sel) sel.innerHTML = '<option value="" disabled>Error loading schools — refresh page</option>';
    });

    // Cancel school listener when user navigates away
    AppState.registerListener('schoolDropdown', unsub);
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
      await fbAuth.signInWithEmailAndPassword(email, pass);
      // auth.onAuthStateChanged in app.js handles the next step
    } catch (err) {
      const msg = err.code === 'auth/user-not-found'     ? 'No account found with this email.'
                : err.code === 'auth/wrong-password'      ? 'Incorrect password.'
                : err.code === 'auth/too-many-requests'   ? 'Too many failed attempts. Try again later.'
                : err.code === 'auth/invalid-email'       ? 'Invalid email address.'
                : 'Login failed. Please try again.';
      UI.toast(msg, 'error');
    } finally {
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

    if (!name) { UI.toast('Please enter your full name.', 'warning'); return; }
    if (!cls)  { UI.toast('Please select your class.',    'warning'); return; }
    if (!school) { UI.toast('Please select your school.', 'warning'); return; }
    if (!email)  { UI.toast('Please enter your email.',   'warning'); return; }
    if (pass.length < 6) { UI.toast('Password must be at least 6 characters.', 'warning'); return; }

    UI.setLoading(btn, true);
    try {
      const cred = await fbAuth.createUserWithEmailAndPassword(email, pass);
      await fbDb.collection('students').doc(cred.user.uid).set({
        name,
        class:     cls,
        school,
        email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      UI.toast('Registration successful! Please log in.', 'success');
      showLogin();
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use' ? 'An account with this email already exists.'
                : err.code === 'auth/invalid-email'        ? 'Invalid email address.'
                : 'Registration failed. Please try again.';
      UI.toast(msg, 'error');
    } finally {
      UI.setLoading(btn, false);
    }
  }

  /* ── Forgot password ── */
  async function forgotPassword() {
    const email = window.prompt('Enter your registered email address:');
    if (!email || !email.includes('@')) {
      if (email !== null) UI.toast('Please enter a valid email address.', 'warning');
      return;
    }
    try {
      await fbAuth.sendPasswordResetEmail(email.trim());
      UI.toast('Password reset email sent! Check your inbox.', 'success', 6000);
    } catch (err) {
      const msg = err.code === 'auth/user-not-found' ? 'No account with this email.'
                : 'Could not send reset email. Try again.';
      UI.toast(msg, 'error');
    }
  }

  /* ── Expose ── */
  window.Auth = { renderLogin, showRegister, showLogin, login, register, forgotPassword };

})();