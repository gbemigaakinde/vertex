/**
 * Firebase Singleton Initialization
 *
 * This file initializes Firebase exactly once and exposes `auth` and `db`
 * as global constants. All other modules read these constants; they never
 * call firebase.initializeApp() themselves.
 *
 * Security note: Firebase client config is not secret — it identifies the
 * project and is protected by Firestore Security Rules, not by obscurity.
 * Ensure Firestore Security Rules are configured in the Firebase console.
 */

(function () {
  'use strict';

  const firebaseConfig = {
    apiKey: "AIzaSyCQk1Q5GyCVo3cKNcHaYHVzAnVeWlqkzns",
    authDomain: "excellencecbt.firebaseapp.com",
    projectId: "excellencecbt",
    storageBucket: "excellencecbt.firebasestorage.app",
    messagingSenderId: "24170253162",
    appId: "1:24170253162:web:6e6cb86c5ffc84aebaf313"
  };

  // Guard against double-initialization if this script is ever loaded twice.
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  // Enable offline persistence so the exam works through brief connectivity drops.
  // This is a best-effort call; failure is non-fatal.
  firebase.firestore().enablePersistence({ synchronizeTabs: false }).catch(function (err) {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open. Persistence only works in one tab at a time.
      console.warn('[Firebase] Offline persistence unavailable: multiple tabs open.');
    } else if (err.code === 'unimplemented') {
      // Browser does not support persistence.
      console.warn('[Firebase] Offline persistence not supported in this browser.');
    }
  });

  // Expose singletons globally. All modules access Firebase through these.
  window.fbAuth = firebase.auth();
  window.fbDb  = firebase.firestore();

})();