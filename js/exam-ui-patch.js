/* ============================================================
   js/exam-ui-patch.js
   ============================================================
   PRESENTATION-ONLY patch — enhances the HTML that exam.js
   generates to use the redesigned CSS classes.

   HOW TO USE:
     Add this script tag to index.html AFTER exam.js:
       <script src="js/exam-ui-patch.js"></script>

   WHAT IT DOES:
     1. Upgrades option labels to use option-letter tags (A B C D)
        and proper .option-label selected class management.
     2. Injects a fixed mobile bottom bar for Prev/Next/Chat.
     3. Applies .exam-layout wrapper so the exam body uses
        the new spacing.
     4. Enhances subject tab buttons with progress fractions.

   WHAT IT DOES NOT TOUCH:
     - Answer saving logic (_saveAnswer)
     - Timer logic
     - Submit logic
     - Any Firestore calls
     - Any IDs used by exam.js
   ============================================================ */

(function () {
  'use strict';

  var _origRenderExam = null;

  document.addEventListener('DOMContentLoaded', function () {
    /* Wait one tick for exam.js to define window.Exam */
    setTimeout(function () {
      if (!window.Exam) return;

      _origRenderExam = window.Exam.renderExam;

      window.Exam.renderExam = function () {
        /* Run original render first */
        _origRenderExam.apply(this, arguments);

        /* Then apply presentation enhancements */
        _upgradeOptionLabels();
        _injectMobileBar();
        _wrapExamLayout();
        _upgradeSubjectTabs();
        _syncExamHeader();
      };

      /* Also patch _updateOptionsDisplay to use class instead of inline style */
      var _origUpdateOptions = window.Exam._updateOptionsDisplay;
      if (typeof _origUpdateOptions === 'function') {
        /* exam.js doesn't expose this — handled below via event patch */
      }

      /* Listen for answer selections and update class instead of inline style */
      document.addEventListener('change', function (e) {
        if (e.target && e.target.name === 'option') {
          _upgradeOptionLabels();
          /* sync nav button */
          var exam = AppState.exam;
          if (!exam) return;
          var subj = exam.currentSubject;
          var idx  = exam.currentIndex;
          var btn  = document.querySelector('#navGrid button:nth-child(' + (idx + 1) + ')');
          if (btn) btn.classList.add('answered');
        }
      }, true);

    }, 50);
  });

  /* ── Upgrade option labels ── */
  function _upgradeOptionLabels() {
    var labels = document.querySelectorAll('.option-label');
    var letters = ['A', 'B', 'C', 'D', 'E'];

    labels.forEach(function (lbl, i) {
      /* Already upgraded */
      if (lbl.querySelector('.option-letter')) return;

      var radio = lbl.querySelector('input[type="radio"]');
      var textSpan = lbl.querySelector('span');
      if (!radio || !textSpan) return;

      /* Remove inline style — use class instead */
      lbl.removeAttribute('style');

      /* Build letter badge */
      var letterBadge = document.createElement('span');
      letterBadge.className = 'option-letter';
      letterBadge.setAttribute('aria-hidden', 'true');
      letterBadge.textContent = letters[i] || String(i + 1);

      /* Add option-text class to text span */
      textSpan.className = 'option-text';

      /* Clear and rebuild label content */
      lbl.innerHTML = '';
      lbl.appendChild(radio);
      lbl.appendChild(letterBadge);
      lbl.appendChild(textSpan);

      /* Apply selected class if radio is checked */
      if (radio.checked) {
        lbl.classList.add('selected');
      }

      /* Handle selection via click */
      lbl.addEventListener('click', function () {
        document.querySelectorAll('.option-label').forEach(function (l) {
          l.classList.remove('selected');
        });
        lbl.classList.add('selected');
      });
    });

    /* Sync selected class with checked state */
    labels.forEach(function (lbl) {
      var radio = lbl.querySelector('input[type="radio"]');
      if (radio && radio.checked) {
        lbl.classList.add('selected');
      }
    });
  }

  /* ── Inject fixed mobile bottom bar ── */
  function _injectMobileBar() {
    /* Remove existing bar */
    var existing = document.getElementById('examMobileBar');
    if (existing) existing.remove();

    var exam = window.AppState && window.AppState.exam;
    if (!exam) return;

    var bar = document.createElement('div');
    bar.id        = 'examMobileBar';
    bar.className = 'exam-mobile-bar';
    bar.setAttribute('aria-label', 'Exam navigation');

    var prevDisabled = exam.currentIndex === 0 ? 'disabled' : '';

    bar.innerHTML =
      '<button onclick="Exam.prevQuestion()" class="btn btn-secondary" ' + prevDisabled + '>' +
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
          '<path d="M10 12L6 8L10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>' +
        'Prev' +
      '</button>' +
      '<button onclick="Chat.openPublicChat()" class="btn" style="background:#16a34a; flex:0 0 auto; padding:0.6875rem 1rem;">' +
        'Chat' +
      '</button>' +
      '<button onclick="Exam.nextQuestion()" class="btn">' +
        'Next' +
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
          '<path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>' +
      '</button>';

    document.body.appendChild(bar);
  }

  /* ── Wrap exam layout in proper container ── */
  function _wrapExamLayout() {
    var app = document.getElementById('app');
    if (!app) return;

    /* The outermost div inside #app — add exam-layout class */
    var firstChild = app.firstElementChild;
    if (firstChild && !firstChild.classList.contains('exam-layout')) {
      /* Add id for skip-link */
      firstChild.id = 'mainContent';

      /* Add exam-layout spacing — preserve existing classes */
      firstChild.classList.add('exam-layout');

      /* Remove conflicting Tailwind padding classes that duplicate our CSS */
      firstChild.classList.remove('p-4');
    }
  }

  /* ── Upgrade subject tab buttons with progress fractions ── */
  function _upgradeSubjectTabs() {
    var exam = window.AppState && window.AppState.exam;
    if (!exam) return;

    var tabButtons = document.querySelectorAll('[onclick^="Exam.switchSubject"]');
    tabButtons.forEach(function (btn) {
      /* Extract subject name from onclick attr */
      var match = btn.getAttribute('onclick').match(/switchSubject\('([^']+)'\)/);
      if (!match) return;
      var subj = match[1];
      var qs   = (exam.questions || {})[subj] || [];
      var answered = qs.filter(function (_, i) {
        return (exam.answers || {})[subj + '-' + i] !== undefined;
      }).length;

      /* Add progress fraction if not already there */
      if (!btn.querySelector('.subject-tab-progress')) {
        var prog = document.createElement('span');
        prog.className = 'subject-tab-progress';
        prog.textContent = answered + '/' + qs.length;
        btn.appendChild(prog);
      } else {
        var existing = btn.querySelector('.subject-tab-progress');
        existing.textContent = answered + '/' + qs.length;
      }
    });
  }

  /* ── Sync the fixed header ── */
  function _syncExamHeader() {
    if (typeof window._syncExamHeader === 'function') {
      window._syncExamHeader();
    }
  }

}());