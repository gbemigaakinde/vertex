/* ============================================================
   js/threedclass.js — 3D Class Hub
   ============================================================
   Routing:
     openForStudent() → renderHub() → [subject card click] →
       ThreeDPeriodic.open()  (Chemistry)
       ThreeDCell.open()      (Biology)
       ThreeDPhysics.open()   (Physics)
     → [back button] → renderHub()
   ============================================================ */

(function () {
  'use strict';

  let _activeModule = null;

  const SUBJECTS = [
    {
      id:          'chemistry',
      title:       'Chemistry',
      subtitle:    'Interactive Periodic Table',
      description: 'Explore all 118 elements in 3D. Tap any element for detailed properties, electron configuration, discovery history, and group information.',
      icon:        '⚗️',
      color:       'var(--accent)',
      colorBg:     'var(--accent-subtle)',
      colorBorder: 'var(--accent-border)',
      available:   true,
      launch:      () => {
        if (window.ThreeDPeriodic) {
          ThreeDPeriodic.open(_backToHub);
        } else {
          UI.toast('Chemistry module not loaded. Please refresh.', 'error');
        }
      },
    },
    {
      id:          'biology',
      title:       'Biology',
      subtitle:    'Cell Structure & Systems',
      description: 'Interactive 3D animal and plant cells. Tap any organelle to learn its function, structure, and exam tips. Compare cells, explore pathways, and test yourself.',
      icon:        '🧬',
      color:       'var(--success)',
      colorBg:     'var(--success-subtle)',
      colorBorder: 'var(--success-border)',
      available:   true,
      launch:      () => {
        if (window.ThreeDCell) {
          ThreeDCell.open(_backToHub);
        } else {
          UI.toast('Biology module not loaded. Please refresh.', 'error');
        }
      },
    },
    {
      id:          'physics',
      title:       'Physics',
      subtitle:    'Forces, Waves & Energy',
      description: 'Animated 3D visualisations of Newton\'s Laws, waves, electricity circuits, and energy transfer. Live canvas animations make every concept "alive". Includes a timed quiz.',
      icon:        '⚛️',
      color:       'var(--warning)',
      colorBg:     'var(--warning-subtle)',
      colorBorder: 'var(--warning-border)',
      available:   true,
      launch:      () => {
        if (window.ThreeDPhysics) {
          ThreeDPhysics.open(_backToHub);
        } else {
          UI.toast('Physics module not loaded. Please refresh.', 'error');
        }
      },
    },
    {
      id:          'commerce',
      title:       'Commerce',
      subtitle:    'Economics & Finance',
      description: 'Coming soon — interactive economic models, supply & demand curves, and financial charts.',
      icon:        '📊',
      color:       'var(--info)',
      colorBg:     'var(--info-subtle)',
      colorBorder: 'var(--info-border)',
      available:   false,
      launch:      null,
    },
  ];

  /* ══════════════════════════════════════════════════
     OPEN FOR STUDENT
  ══════════════════════════════════════════════════ */

  function openForStudent() {
    _activeModule = null;
    _renderHub();
  }

  /* ══════════════════════════════════════════════════
     CLOSE — back to exam.js subject selection
  ══════════════════════════════════════════════════ */

  function _close() {
    _activeModule = null;
    const app = document.getElementById('app');
    if (app) { app.classList.remove('exam-active'); app.style.padding = ''; }
    if (window.Exam && typeof Exam.renderSubjectSelection === 'function') {
      Exam.renderSubjectSelection();
    }
  }

  /* ══════════════════════════════════════════════════
     BACK TO HUB — from a subject module
  ══════════════════════════════════════════════════ */

  function _backToHub() {
    _activeModule = null;
    const app = document.getElementById('app');
    if (app) { app.classList.remove('exam-active'); app.style.padding = ''; }
    _renderHub();
  }

  /* ══════════════════════════════════════════════════
     RENDER HUB
  ══════════════════════════════════════════════════ */

  function _renderHub() {
    const cardsHtml = SUBJECTS.map(subj => _buildSubjectCard(subj)).join('');

    UI.mount(`
      <div style="max-width:860px;margin:0 auto;padding:var(--sp-5) var(--sp-4);
                  min-height:100dvh;box-sizing:border-box;">

        <!-- Top bar -->
        <div style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-6);">
          <button onclick="ThreeDClass._close()"
                  style="display:inline-flex;align-items:center;gap:.375rem;
                         font-size:var(--text-sm);font-weight:500;color:var(--text-2);
                         background:var(--bg-subtle);border:1px solid var(--border);
                         border-radius:var(--r-md);padding:.3rem .625rem;
                         cursor:pointer;transition:background var(--t-fast),color var(--t-fast);
                         white-space:nowrap;font-family:var(--font);flex-shrink:0;"
                  onmouseenter="this.style.background='var(--bg-muted)';this.style.color='var(--text-1)'"
                  onmouseleave="this.style.background='var(--bg-subtle)';this.style.color='var(--text-2)'">
            ← Back
          </button>
          <div style="min-width:0;flex:1;">
            <h1 style="font-size:var(--text-xl);font-weight:700;color:var(--text-1);
                       letter-spacing:-0.02em;line-height:1.2;margin:0;">3D Class</h1>
            <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:2px;">
              Interactive 3D learning modules
            </p>
          </div>
        </div>

        <!-- Subject grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:var(--sp-4);">
          ${cardsHtml}
        </div>

        <p style="text-align:center;font-size:var(--text-xs);color:var(--text-4);
                  margin-top:var(--sp-8);padding-bottom:var(--sp-4);">
          More subjects coming soon. All modules work offline once loaded.
        </p>

      </div>`);
  }

  function _buildSubjectCard(subj) {
    if (subj.available) {
      return `
        <div onclick="ThreeDClass._launch('${_esc(subj.id)}')"
             style="background:var(--bg-base);border:1.5px solid var(--border);
                    border-radius:var(--r-xl);padding:var(--sp-5);cursor:pointer;
                    transition:border-color var(--t-base),box-shadow var(--t-base),transform var(--t-base);
                    position:relative;overflow:hidden;"
             onmouseenter="this.style.borderColor='${subj.color}';this.style.boxShadow='var(--shadow-md)';this.style.transform='translateY(-2px)'"
             onmouseleave="this.style.borderColor='var(--border)';this.style.boxShadow='none';this.style.transform='translateY(0)'">

          <div style="position:absolute;top:var(--sp-3);right:var(--sp-3);
                      font-size:.625rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
                      padding:2px 7px;border-radius:var(--r-sm);
                      background:${subj.colorBg};color:${subj.color};border:1px solid ${subj.colorBorder};">
            Available
          </div>

          <div style="font-size:2.25rem;margin-bottom:var(--sp-3);line-height:1;">${subj.icon}</div>

          <div style="font-size:var(--text-md);font-weight:700;color:var(--text-1);
                      letter-spacing:-0.015em;margin-bottom:3px;">${_esc(subj.title)}</div>
          <div style="font-size:var(--text-xs);font-weight:600;color:${subj.color};
                      margin-bottom:var(--sp-3);">${_esc(subj.subtitle)}</div>

          <p style="font-size:var(--text-sm);color:var(--text-3);line-height:1.6;
                    margin:0 0 var(--sp-4) 0;">${_esc(subj.description)}</p>

          <div style="display:flex;align-items:center;gap:.375rem;">
            <span style="font-size:var(--text-xs);font-weight:600;color:${subj.color};">
              Open 3D Module →
            </span>
          </div>
        </div>`;
    }

    return `
      <div style="background:var(--bg-subtle);border:1.5px solid var(--border);
                  border-radius:var(--r-xl);padding:var(--sp-5);
                  position:relative;overflow:hidden;opacity:0.65;">
        <div style="position:absolute;top:var(--sp-3);right:var(--sp-3);
                    font-size:.625rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
                    padding:2px 7px;border-radius:var(--r-sm);
                    background:var(--bg-muted);color:var(--text-4);border:1px solid var(--border);">
          Soon
        </div>
        <div style="font-size:2.25rem;margin-bottom:var(--sp-3);line-height:1;filter:grayscale(1);">${subj.icon}</div>
        <div style="font-size:var(--text-md);font-weight:700;color:var(--text-2);
                    letter-spacing:-0.015em;margin-bottom:3px;">${_esc(subj.title)}</div>
        <div style="font-size:var(--text-xs);font-weight:600;color:var(--text-4);
                    margin-bottom:var(--sp-3);">${_esc(subj.subtitle)}</div>
        <p style="font-size:var(--text-sm);color:var(--text-4);line-height:1.6;margin:0;">
          ${_esc(subj.description)}
        </p>
      </div>`;
  }

  /* ══════════════════════════════════════════════════
     LAUNCH
  ══════════════════════════════════════════════════ */

  function _launch(id) {
    const subj = SUBJECTS.find(s => s.id === id);
    if (!subj || !subj.available || !subj.launch) {
      UI.toast('This module is not available yet.', 'info');
      return;
    }
    _activeModule = id;
    subj.launch();
  }

  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ══════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════ */

  window.ThreeDClass = {
    openForStudent,
    _close,
    _backToHub,
    _launch,
  };

}());
