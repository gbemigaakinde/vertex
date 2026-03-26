'use strict';

// Register IMMEDIATELY — before DOMContentLoaded
// because beforeinstallprompt can fire very early
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Defer showing the UI until DOM is ready
  function showPrompt() {
    const promptEl = document.getElementById('install-prompt');
    if (promptEl) {
      promptEl.style.display = 'block';
    } else {
      // DOM not ready yet, wait for it
      document.addEventListener('DOMContentLoaded', showPrompt, { once: true });
    }
  }
  showPrompt();
});

document.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('install-button');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`Install prompt outcome: ${outcome}`);
      deferredPrompt = null;
      const promptEl = document.getElementById('install-prompt');
      if (promptEl) promptEl.style.display = 'none';
    });
  }

  const cancelBtn = document.getElementById('install-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      const promptEl = document.getElementById('install-prompt');
      if (promptEl) promptEl.style.display = 'none';
    });
  }
});
