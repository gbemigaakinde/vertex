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

  window.fbAuth = firebase.auth();
  window.fbDb   = firebase.firestore();

  /*
   * enablePersistence() is intentionally NOT called here.
   *
   * This app uses a Service Worker with clients.claim() and skipWaiting().
   * When the SW takes control of an already-open page, Firestore's IndexedDB
   * persistence lock becomes invalid, causing all subsequent Firestore reads
   * and writes to silently hang or fail — resulting in a blank screen after
   * login because the student profile read in app.js never resolves.
   *
   * Firestore's built-in network reconnection handles offline recovery
   * adequately for this use case. The SW caches the app shell and static
   * assets; Firestore data is always fetched live.
   *
   * Do not re-enable persistence without first removing skipWaiting() from
   * sw.js install and clients.claim() from sw.js activate, and testing
   * thoroughly across Chrome Android standalone mode.
   */

})();