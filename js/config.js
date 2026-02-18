/* ============================================================
   js/config.js — Firebase initialization
   Only this file touches the Firebase config.
   ============================================================ */

(function () {
  'use strict';

  const firebaseConfig = {
    apiKey:            "AIzaSyCQk1Q5GyCVo3cKNcHaYHVzAnVeWlqkzns",
    authDomain:        "excellencecbt.firebaseapp.com",
    projectId:         "excellencecbt",
    storageBucket:     "excellencecbt.firebasestorage.app",
    messagingSenderId: "24170253162",
    appId:             "1:24170253162:web:6e6cb86c5ffc84aebaf313"
  };

  firebase.initializeApp(firebaseConfig);

  // Expose singletons globally — all other modules use these references
  window.fbAuth = firebase.auth();
  window.fbDb   = firebase.firestore();

  // Enable offline persistence (helps on flaky connections)
  window.fbDb.enablePersistence({ synchronizeTabs: true }).catch(err => {
    // failed-precondition: multiple tabs open; ignore
    // unimplemented: browser doesn't support; ignore
    console.warn('[Firebase] Persistence not available:', err.code);
  });

})();