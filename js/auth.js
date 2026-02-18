/* ============================================================
   js/auth.js — Authentication: login, register, password reset
   ============================================================ */

(function () {
  'use strict';

  /* -------------------------------------------------- */
  /* Registration guard flag                            */
  /*                                                    */
  /* When createUserWithEmailAndPassword succeeds,      */
  /* Firebase immediately fires onAuthStateChanged with */
  /* the new user — BEFORE the Firestore student doc    */
  /* has been written. Without a guard, app.js sees a  */
  /* signed-in user with no student profile, shows     */
  /* "Profile not found", and signs them out.           */
  /*                                                    */
  /* This flag tells app.js to ignore that transient   */
  /* auth state change during the registration flow.   */
  /* -------------------------------------------------- */
  window._registrationInProgress = false;

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
          <input id="loginEmail" type="email"    placeholder="Email address" class="mb-4" autocomplete="email" />
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
          <input id="regName"  type="text"     placeholder="Full Name"            autocomplete="name" />
          <select id="regClass">
            <option value="" disabled selected>Select Class</option>
            <option>JSS1</option><option>JSS2</option><option>JSS3</option>
            <option>SSS1</option><option>SSS2</option><option>SSS3</option>
          </select>
          <select id="regSchool">
            <option value="" disabled selected>Loading schools...</option>
          </select>
          <input id="regEmail" type="email"    placeholder="Email address"            autocomplete="email" />
          <input id="regPass"  type="password" placeholder="Password (min 6 chars)"   autocomplete="new-password" />
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

    // Guard: only init ticker if the element was actually rendered into the DOM
    if (typeof initTicker === 'function' && document.getElementById('tickerScroll')) {
      initTicker();
    }

    // Load schools into dropdown with a real-time listener.
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

    /*
     * REGISTRATION FLOW - ORDER IS CRITICAL
     *
     * 1. Set the guard flag so app.js _onLogin ignores the transient
     *    onAuthStateChanged that fires immediately after account creation.
     * 2. Create the Firebase Auth account.
     * 3. Sign out immediately - prevents app.js routing an incomplete user.
     * 4. Write the Firestore student profile using the uid from step 2.
     * 5. Clear the guard flag.
     * 6. Show success and switch to login panel.
     */

    window._registrationInProgress = true;
    let newUid = null;

    try {
      // Step 2 - Create Auth account
      const cred = await window.fbAuth.createUserWithEmailAndPassword(email, pass);
      newUid = cred.user.uid;

      // Step 3 - Sign out immediately before Firestore write.
      // onAuthStateChanged fires here but _registrationInProgress is true
      // so app.js _onLogin will bail out and not route the incomplete user.
      await window.fbAuth.signOut();

      // Step 4 - Write student profile now that the user is signed out
      await window.fbDb.collection('students').doc(newUid).set({
        name,
        class:     cls,
        school,
        email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Step 5 - Clear guard (signOut already triggered _onLogout which showed login)
      window._registrationInProgress = false;

      // Step 6 - Success
      UI.toast('Registration successful! Please log in with your new account.', 'success', 7000);

      // Pre-fill the email field to reduce friction
      const loginEmailEl = document.getElementById('loginEmail');
      if (loginEmailEl) loginEmailEl.value = email;

      showLogin();

    } catch (err) {
      window._registrationInProgress = false;

      if (newUid) {
        // Auth account was created but something failed after.
        // Log for manual cleanup - we cannot delete without a fresh credential.
        console.error('[auth] Registration incomplete. Auth account created but flow failed.', {
          uid: newUid, email, errorCode: err.code, errorMessage: err.message
        });
      }

      const msg = err.code === 'auth/email-already-in-use' ? 'An account with this email already exists.'
                : err.code === 'auth/invalid-email'        ? 'Invalid email address.'
                : err.code === 'auth/weak-password'        ? 'Password must be at least 6 characters.'
                : err.code === 'auth/operation-not-allowed'? 'Registration is currently disabled. Contact Master Timothy.'
                : err.code === 'auth/too-many-requests'    ? 'Too many attempts. Please wait and try again.'
                : 'Registration failed: ' + (err.message || 'Please try again.');
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