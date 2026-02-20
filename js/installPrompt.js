// js/installPrompt.js
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  let deferredPrompt = null;

  // Listen for the beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();

    // Save the event for later
    deferredPrompt = e;

    // Show your custom install prompt
    const promptEl = document.getElementById('install-prompt');
    if (promptEl) {
      promptEl.style.display = 'block';
    }
  });

  // Handle the install button click
  const installBtn = document.getElementById('install-button');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;

      // Show the native install prompt
      deferredPrompt.prompt();

      // Wait for the user to respond
      const { outcome } = await deferredPrompt.userChoice;

      console.log(`Install prompt outcome: ${outcome}`);

      // Reset the deferred prompt variable
      deferredPrompt = null;

      // Hide the custom prompt
      const promptEl = document.getElementById('install-prompt');
      if (promptEl) {
        promptEl.style.display = 'none';
      }
    });
  }

  // Handle the cancel button click
  const cancelBtn = document.getElementById('install-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      const promptEl = document.getElementById('install-prompt');
      if (promptEl) {
        promptEl.style.display = 'none';
      }
    });
  }
});