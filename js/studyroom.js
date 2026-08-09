/* ============================================================
   js/studyroom.js — Study Room: lesson browser + reader
   ============================================================

   Content format: Markdown (safe subset, sanitised on render)
   ============================================================ */

(function () {
  'use strict';

  const DEFAULT_PREFS = {
    fontSize:    16,
    fontFamily:  'serif',
    lineSpacing: 1.75,
    pageWidth:   720,
    bg:          'white',
  };

  const PREFS_KEY = 'vtx_study_prefs';

  const TERMS = ['First Term', 'Second Term', 'Third Term'];

  const CLASS_OPTIONS = ['JSS1','JSS2','JSS3','SSS1','SSS2','SSS3','TUTORIAL'];

  let _prefs               = _loadPrefs();
  let _currentLesson       = null;
  let _siblingLessons      = [];
  let _editingId           = null;
  let _teacherLessonsUnsub = null;
  let _previewMode         = false;
  let _defaultTerm         = '';
  let _studentLessonsCache = [];
  let _teacherLessonsAll   = [];
  let _katexLoadPromise    = null;

  function _loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? Object.assign({}, DEFAULT_PREFS, JSON.parse(raw)) : Object.assign({}, DEFAULT_PREFS);
    } catch (e) { return Object.assign({}, DEFAULT_PREFS); }
  }

  function _savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(_prefs)); } catch (e) {}
  }

  function _applyPrefsToReader(containerEl) {
    if (!containerEl) return;

    const fontStack = _fontStack();

    const scrollReader  = containerEl.querySelector('.sr-scroll-reader');
    const scrollContent = containerEl.querySelector('.sr-scroll-content');
    if (scrollContent) {
      scrollContent.style.maxWidth = _prefs.pageWidth + 'px';
    }
    if (scrollReader) {
      scrollReader.style.setProperty('--sr-page-width', _prefs.pageWidth + 'px');
    }

    containerEl.querySelectorAll('.sr-scroll-reader').forEach(el => {
      ['white','sepia','warm','dark','night'].forEach(c => el.classList.remove('sr-bg--' + c));
      el.classList.add('sr-bg--' + _prefs.bg);
    });

    containerEl.querySelectorAll('.sr-content').forEach(el => {
      el.style.setProperty('font-size',   _prefs.fontSize + 'px');
      el.style.setProperty('line-height', String(_prefs.lineSpacing));
      el.style.setProperty('font-family', fontStack);
    });

    const textTags = 'p, li, td, th, blockquote, figcaption, aside, h1, h2, h3, h4, h5, h6';
    containerEl.querySelectorAll('.sr-content ' + textTags).forEach(el => {
      el.style.setProperty('font-family', fontStack);
    });
  }

  function _renderMarkdown(md) {
    if (!md) return '';

    // Normalise line endings and strip carriage returns
    let html = String(md).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const stash = [];
    const STASH_TAG = 'HTMLSTASH';

    function _stashBlock(tagName) {
      const re = new RegExp('<' + tagName + '[^>]*>[\\s\\S]*?<\\/' + tagName + '>', 'gi');
      html = html.replace(re, match => {
        stash.push(match);
        return STASH_TAG + (stash.length - 1) + '_';
      });
    }

    _stashBlock('script');
    _stashBlock('style');
    _stashBlock('figure');
    _stashBlock('section');
    _stashBlock('details');
    _stashBlock('aside');
    _stashBlock('svg');

    html = html.replace(/\$\$[\s\S]+?\$\$/g, match => {
      stash.push(match);
      return STASH_TAG + (stash.length - 1) + '_';
    });
    html = html.replace(/\$[^\$\n]+?\$/g, match => {
      stash.push(match);
      return STASH_TAG + (stash.length - 1) + '_';
    });

    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\bon\w+\s*=/gi, 'data-removed=')
      .replace(/javascript:/gi, '');

    stash.forEach((block, i) => {
      if (/^<script/i.test(block)) stash[i] = '';
    });

    html = html.replace(/^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)*)/gm, (_, header, rows) => {
      const ths = header.split('|').filter(Boolean)
        .map(c => `<th>${_inlineMarkdown(c.trim())}</th>`).join('');
      const trs = rows.trim().split('\n').map(row => {
        const tds = row.split('|').filter(Boolean)
          .map(c => `<td>${_inlineMarkdown(c.trim())}</td>`).join('');
        return `<tr>${tds}</tr>`;
      }).join('');
      return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
    });

    html = html.replace(/```(\w*)\n?([\s\S]*?)```/gm, (_, lang, code) => {
      const esc = code.replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return `<pre><code class="lang-${lang}">${esc}</code></pre>`;
    });

    // Headings — run _inlineMarkdown on content
    html = html
      .replace(/^###### (.+)$/gm, (_, t) => `<h6>${_inlineMarkdown(t.trim())}</h6>`)
      .replace(/^##### (.+)$/gm,  (_, t) => `<h5>${_inlineMarkdown(t.trim())}</h5>`)
      .replace(/^#### (.+)$/gm,   (_, t) => `<h4>${_inlineMarkdown(t.trim())}</h4>`)
      .replace(/^### (.+)$/gm,    (_, t) => `<h3>${_inlineMarkdown(t.trim())}</h3>`)
      .replace(/^## (.+)$/gm,     (_, t) => `<h2>${_inlineMarkdown(t.trim())}</h2>`)
      .replace(/^# (.+)$/gm,      (_, t) => `<h1>${_inlineMarkdown(t.trim())}</h1>`);

    html = html
      .replace(/^---+$/gm,    '<hr>')
      .replace(/^\*\*\*+$/gm, '<hr>');

    html = html.replace(/((?:^[ \t]*[-*+] .+\n?)+)/gm, block => {
      const items = block.trim().split('\n').map(line => {
        const indented = /^[ \t]+[-*+] /.test(line);
        const text = line.replace(/^[ \t]*[-*+] /, '');
        return indented
          ? `<li class="sr-sub-item">${_inlineMarkdown(text)}</li>`
          : `<li>${_inlineMarkdown(text)}</li>`;
      }).join('');
      return `<ul>${items}</ul>`;
    });

    html = html.replace(/((?:^\d+\. .+\n?)+)/gm, block => {
      const items = block.trim().split('\n')
        .map(line => `<li>${_inlineMarkdown(line.replace(/^\d+\. /, ''))}</li>`).join('');
      return `<ol>${items}</ol>`;
    });

    const blockStarters = ['<h','<ul','<ol','<li','<pre','<blockquote','<table','<hr','<p', STASH_TAG];
    const result = [];
    let buffer   = [];

    html.split('\n').forEach(line => {
      // Trim trailing whitespace but preserve the line
      const t = line.trim();

      if (!t) {
        if (buffer.length) { result.push('<p>' + _inlineMarkdown(buffer.join(' ')) + '</p>'); buffer = []; }
        return;
      }

      if (/^>[ \u00a0]/.test(t)) {
        if (buffer.length) { result.push('<p>' + _inlineMarkdown(buffer.join(' ')) + '</p>'); buffer = []; }
        result.push(`<blockquote>${_inlineMarkdown(t.replace(/^>[ \u00a0]/, ''))}</blockquote>`);
        return;
      }
      if (/^&gt;[ \u00a0]/.test(t)) {
        if (buffer.length) { result.push('<p>' + _inlineMarkdown(buffer.join(' ')) + '</p>'); buffer = []; }
        result.push(`<blockquote>${_inlineMarkdown(t.replace(/^&gt;[ \u00a0]/, ''))}</blockquote>`);
        return;
      }

      if (blockStarters.some(tag => t.startsWith(tag))) {
        if (buffer.length) { result.push('<p>' + _inlineMarkdown(buffer.join(' ')) + '</p>'); buffer = []; }
        result.push(t);
      } else {
        buffer.push(t);
      }
    });
    if (buffer.length) result.push('<p>' + _inlineMarkdown(buffer.join(' ')) + '</p>');

    let output = result.join('\n');
    for (let i = stash.length - 1; i >= 0; i--) {
      output = output.split(STASH_TAG + i + '_').join(stash[i]);
    }
    for (let i = 0; i < stash.length; i++) {
      output = output.split(STASH_TAG + i + '_').join(stash[i]);
    }

    return output;
  }
   
  function _inlineMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/\*\*\*(.+?)\*\*\*/g,  '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g,      '<strong>$1</strong>')
      .replace(/__(.+?)__/g,          '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,          '<em>$1</em>')
      .replace(/_(.+?)_/g,            '<em>$1</em>')
      .replace(/`(.+?)`/g,            '<code>$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/!\[(.+?)\]\((.+?)\)/g,'<img src="$2" alt="$1">');
  }

  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _normSubject(s) { return (s || '').trim().toLowerCase(); }

  function _groupKey(lesson) {
    return _normSubject(lesson.subject) + '||' + (lesson.term || '');
  }

  const _META_DEFAULT_TERM = 'studyroom_defaultTerm';

  function _loadDefaultTerm(callback) {
    window.fbDb.collection('studyroom_settings').doc('defaults').get()
      .then(snap => {
        const term = (snap.exists && snap.data().defaultTerm) ? snap.data().defaultTerm : '';
        _defaultTerm = term;
        if (callback) callback(term);
      })
      .catch(err => {
        console.warn('[studyroom] _loadDefaultTerm error:', err);
        if (callback) callback(_defaultTerm || '');
      });
  }

  function _saveDefaultTerm(term) {
    return window.fbDb.collection('studyroom_settings').doc('defaults')
      .set({ defaultTerm: term }, { merge: true });
  }

  function openForStudent() {
    const studentData = AppState.studentData;
    if (!studentData) { UI.toast('Could not load student data.', 'error'); return; }

    const studentClass = studentData.class || '';

    UI.mount(`
      <div class="sr-shell sr-animate-in">
        <div class="sr-topbar">
          <button class="sr-topbar__back" onclick="StudyRoom._closeStudentRoom()">← Back</button>
          <span class="sr-topbar__title">Study Room</span>
        </div>
        <div class="sr-browser">
          <div class="sr-browser__header">
            <h2 style="font-size:var(--text-xl);font-weight:700;color:var(--text-primary);margin-bottom:.25rem;">
              Study Materials
            </h2>
            <p style="font-size:var(--text-sm);color:var(--text-tertiary);">
              ${_esc(studentClass)} — Select a lesson to start reading
            </p>
          </div>
          <div class="sr-browser__filters">
            <select id="srFilterTerm" onchange="StudyRoom._filterLessons()">
              <option value="">All Terms</option>
              ${TERMS.map(t => `<option value="${_esc(t)}">${_esc(t)}</option>`).join('')}
            </select>
            <select id="srFilterSubject" onchange="StudyRoom._filterLessons()">
              <option value="">All Subjects</option>
            </select>
          </div>
          <div id="srLessonBrowser">
            <div style="text-align:center;padding:3rem 1rem;color:var(--text-tertiary);">Loading lessons…</div>
          </div>
        </div>
      </div>`);

    _loadDefaultTerm(function (defaultTerm) {
      if (defaultTerm) {
        const sel = document.getElementById('srFilterTerm');
        if (sel) sel.value = defaultTerm;
      }
      _loadStudentLessons(studentClass);
    });
  }

  function _closeStudentRoom() {
    if (window.Exam && Exam.renderSubjectSelection) Exam.renderSubjectSelection();
  }

  function _loadStudentLessons(studentClass) {
    window.fbDb.collection('lessons')
      .where('class', '==', studentClass)
      .get()
      .then(snap => {
        const lessons = [];
        snap.forEach(doc => lessons.push({ id: doc.id, ...doc.data() }));
        _renderStudentLessons(lessons);
      })
      .catch(err => {
        console.error('[studyroom] _loadStudentLessons error:', err);
        _showLessonLoadError('Failed to load lessons. Please check your internet connection and try again.');
      });
  }

  function _showLessonLoadError(message) {
    const el = document.getElementById('srLessonBrowser');
    if (el) el.innerHTML = `
      <div class="sr-empty" style="padding:2rem 1rem;text-align:center;">
        <div style="font-size:2rem;margin-bottom:.75rem;">📚</div>
        <p style="color:var(--text-tertiary);font-size:.9rem;line-height:1.6;">${_esc(message)}</p>
      </div>`;
  }

  function _renderStudentLessons(lessons) {
    _studentLessonsCache = lessons;

    _studentLessonsCache.sort((a, b) => {
      const sa = _normSubject(a.subject), sb = _normSubject(b.subject);
      if (sa < sb) return -1; if (sa > sb) return 1;
      const ta = TERMS.indexOf(a.term), tb = TERMS.indexOf(b.term);
      if (ta !== tb) return ta - tb;
      return (a.order || 0) - (b.order || 0);
    });

    const subjects = [...new Set(
      _studentLessonsCache.map(l => (l.subject || '').trim()).filter(Boolean)
    )].sort();

    const subjectSel = document.getElementById('srFilterSubject');
    if (subjectSel) {
      subjectSel.innerHTML = '<option value="">All Subjects</option>' +
        subjects.map(s => `<option value="${_esc(s)}">${_esc(s)}</option>`).join('');
    }

    _filterLessons();
  }

  function _filterLessons() {
    const termFilter    = (document.getElementById('srFilterTerm')?.value    || '').trim();
    const subjectFilter = (document.getElementById('srFilterSubject')?.value || '').trim();

    let filtered = _studentLessonsCache;
    if (termFilter)    filtered = filtered.filter(l => l.term === termFilter);
    if (subjectFilter) filtered = filtered.filter(l => _normSubject(l.subject) === _normSubject(subjectFilter));

    const browser = document.getElementById('srLessonBrowser');
    if (!browser) return;

    if (!filtered.length) {
      browser.innerHTML = `
        <div class="sr-empty">
          <p class="sr-empty__text">No lessons found for this filter.</p>
        </div>`;
      return;
    }

    const byGroup = {};
    filtered.forEach(l => {
      const key = termFilter ? (l.subject || 'General') : _groupKey(l);
      if (!byGroup[key]) byGroup[key] = { subject: l.subject || 'General', term: l.term || '', lessons: [] };
      byGroup[key].lessons.push(l);
    });

    Object.values(byGroup).forEach(g => g.lessons.sort((a, b) => (a.order || 0) - (b.order || 0)));

    const sortedKeys = Object.keys(byGroup).sort((ka, kb) => {
      const ga = byGroup[ka], gb = byGroup[kb];
      const sa = _normSubject(ga.subject), sb = _normSubject(gb.subject);
      if (sa < sb) return -1; if (sa > sb) return 1;
      return TERMS.indexOf(ga.term) - TERMS.indexOf(gb.term);
    });

    browser.innerHTML = sortedKeys.map(key => {
      const { subject, term, lessons } = byGroup[key];
      const heading = termFilter
        ? _esc(subject)
        : `${_esc(subject)}<span class="sr-subject-group__term"> — ${_esc(term)}</span>`;
      const count = lessons.length;

      return `
        <div class="sr-subject-group">
          <div class="sr-subject-group__header">
            <span class="sr-subject-group__name">${heading}</span>
            <span class="sr-subject-group__count">${count} lesson${count !== 1 ? 's' : ''}</span>
          </div>
          ${lessons.map((l, idx) => `
            <div class="sr-lesson-card" onclick="StudyRoom._openLesson('${_esc(l.id)}')">
              <div class="sr-lesson-card__num">${l.order > 0 ? l.order : idx + 1}</div>
              <div class="sr-lesson-card__body">
                <div class="sr-lesson-card__title">${_esc(l.title)}</div>
                <div class="sr-lesson-card__meta">${_esc(l.term || '')}${l.topic ? ' · ' + _esc(l.topic) : ''}</div>
              </div>
              <span class="sr-lesson-card__arrow">›</span>
            </div>`).join('')}
        </div>`;
    }).join('');
  }

  function _openLesson(lessonId) {
    const lesson = _studentLessonsCache.find(l => l.id === lessonId);
    if (lesson) {
      const siblings = _studentLessonsCache
        .filter(l => _normSubject(l.subject) === _normSubject(lesson.subject) && l.term === lesson.term)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      _renderReader(lesson, siblings);
      return;
    }

    window.fbDb.collection('lessons').doc(lessonId).get()
      .then(snap => {
        if (!snap.exists) { UI.toast('Lesson not found.', 'error'); return; }
        const fetched = { id: snap.id, ...snap.data() };
        _renderReader(fetched, []);
      })
      .catch(err => {
        console.error('[studyroom] _openLesson error:', err);
        UI.toast('Failed to load lesson. Please check your internet connection and try again.', 'error');
      });
  }

  function _renderReader(lesson, siblings) {
    _currentLesson  = lesson;
    _siblingLessons = siblings;

    const renderedHtml = _renderMarkdown(lesson.content || '');

    UI.mount(_buildReaderShell(lesson, siblings, renderedHtml));

    const app = document.getElementById('app');
    if (app) { app.classList.add('exam-active'); app.style.padding = '0'; }

    _applyPrefsToReader(document.getElementById('app'));
    _syncPrefsUI();
    _bindScrollProgress();
    _renderMathContent(document.getElementById('app'));
    _bindQuizButtons(document.getElementById('app'));
  }

  function _ensureKatex() {
    if (window.renderMathInElement) return Promise.resolve();
    if (_katexLoadPromise) return _katexLoadPromise;

    _katexLoadPromise = new Promise(resolve => {
      let waited = 0;
      const poll = setInterval(() => {
        if (window.renderMathInElement) {
          clearInterval(poll);
          resolve();
          return;
        }
        waited += 150;
        if (waited >= 4000) {
          clearInterval(poll);
          _loadKatexFromCdn().then(resolve).catch(() => resolve());
        }
      }, 150);
    });

    return _katexLoadPromise;
  }

  function _loadKatexFromCdn() {
    const cssHref = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
    if (!document.querySelector('link[href="' + cssHref + '"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssHref;
      document.head.appendChild(link);
    }

    return _loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js')
      .then(() => _loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js'));
  }

  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function _renderMathContent(containerEl) {
    if (!containerEl) return;
    _ensureKatex().then(() => {
      if (!window.renderMathInElement) return;
      try {
        window.renderMathInElement(containerEl, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
          ],
          throwOnError: false,
        });
      } catch (e) {}
    });
  }

  function _bindQuizButtons(containerEl) {
    if (!containerEl) return;
    containerEl.querySelectorAll('button[data-q]').forEach(btn => {
      if (btn.dataset.quizBound) return;
      btn.dataset.quizBound = '1';
      btn.addEventListener('click', () => {
        const qId      = btn.getAttribute('data-q');
        const correct  = btn.getAttribute('data-ans');
        const msg      = btn.getAttribute('data-msg');
        const selected = containerEl.querySelector('input[name="' + qId + '"]:checked');
        const fb       = containerEl.querySelector('#' + qId + '-fb');
        if (!fb) return;
        if (!selected) {
          fb.className   = 'ins-fb err';
          fb.textContent = 'Please select an answer first.';
          return;
        }
        fb.className   = selected.value === correct ? 'ins-fb ok' : 'ins-fb err';
        fb.textContent = selected.value === correct
          ? msg
          : 'Not quite. Review the relevant section above and try again.';
      });
    });
  }

  function _buildReaderShell(lesson, siblings, renderedHtml) {
    const hasSidebar = siblings.length > 1;

    const sidebarItems = siblings.map((s, i) => `
      <div class="sr-sidebar__item${s.id === lesson.id ? ' is-active' : ''}"
           onclick="StudyRoom._openLesson('${_esc(s.id)}')">
        <span class="sr-sidebar__num">${s.order > 0 ? s.order : i + 1}</span>
        <span class="sr-sidebar__name" title="${_esc(s.title)}">${_esc(s.title)}</span>
      </div>`).join('');

    const sidebarHeading = [lesson.subject, lesson.term].filter(Boolean).join(' — ');

    return `
      <div class="sr-shell">
        <div class="sr-progress-bar">
          <div class="sr-progress-bar__fill" id="srProgressFill" style="width:0%"></div>
        </div>

        <div class="sr-topbar" id="srTopbar">
          <button class="sr-topbar__back" onclick="StudyRoom._backToBrowser()" title="Back to Lessons">← Lessons</button>
          <span class="sr-topbar__title" title="${_esc(lesson.title)}">${_esc(lesson.title)}</span>
          <div class="sr-topbar__actions">
            <button class="sr-topbar__back" onclick="StudyRoom._togglePrefs()" id="srPrefsBtn">Aa</button>
          </div>
        </div>

        <div class="sr-layout${hasSidebar ? '' : ' sr-layout--no-sidebar'}" id="srLayout">
          ${hasSidebar ? `
            <div class="sr-sidebar" id="srSidebar">
              <div class="sr-sidebar__heading" title="${_esc(sidebarHeading)}">${_esc(sidebarHeading)}</div>
              ${sidebarItems}
            </div>` : ''}

          ${_buildScrollReader(lesson, renderedHtml)}
        </div>

        ${_buildPrefsPanel()}
      </div>`;
  }

  function _buildScrollReader(lesson, renderedHtml) {
    const breadcrumb = [lesson.class, lesson.term, lesson.subject]
      .filter(Boolean)
      .map(b => `<span>${_esc(b)}</span>`)
      .join('<span style="opacity:.5;margin:0 .2em"> / </span>');

    return `
      <div class="sr-scroll-reader sr-bg--${_esc(_prefs.bg)}" id="srScrollReader">
        <div class="sr-scroll-content" id="srScrollContent" style="max-width:${_prefs.pageWidth}px;">

          <div class="sr-lesson-header">
            <div class="sr-lesson-header__breadcrumb">${breadcrumb}</div>
            <h1 class="sr-lesson-header__title">${_esc(lesson.title)}</h1>
            ${lesson.topic ? `<p class="sr-lesson-header__topic">${_esc(lesson.topic)}</p>` : ''}
          </div>

          <div class="sr-content" id="srContent"
               style="font-family:${_fontStack()};font-size:${_prefs.fontSize}px;line-height:${_prefs.lineSpacing};">
            ${renderedHtml}
          </div>

          <div class="sr-lesson-footer">
            ${_prevLessonBtn(lesson)}
            <span style="font-size:var(--text-xs);color:var(--text-disabled);flex-shrink:0;">End of lesson</span>
            ${_nextLessonBtn(lesson)}
          </div>
        </div>
      </div>`;
  }

  function _prevLessonBtn(lesson) {
    const idx = _siblingLessons.findIndex(l => l.id === lesson.id);
    if (idx <= 0) return '<span></span>';
    const prev = _siblingLessons[idx - 1];
    return `<button class="sr-topbar__back sr-lesson-nav-btn"
                    title="${_esc(prev.title)}"
                    onclick="StudyRoom._openLesson('${_esc(prev.id)}')">←&nbsp;<span class="sr-lesson-nav-btn__label">${_esc(prev.title)}</span></button>`;
  }

  function _nextLessonBtn(lesson) {
    const idx = _siblingLessons.findIndex(l => l.id === lesson.id);
    if (idx < 0 || idx >= _siblingLessons.length - 1) return '<span></span>';
    const next = _siblingLessons[idx + 1];
    return `<button class="btn sr-lesson-nav-btn"
                    title="${_esc(next.title)}"
                    onclick="StudyRoom._openLesson('${_esc(next.id)}')"><span class="sr-lesson-nav-btn__label">${_esc(next.title)}</span>&nbsp;→</button>`;
  }

  function _buildPrefsPanel() {
    return `
      <div class="sr-prefs-panel" id="srPrefsPanel">
        <div class="sr-prefs-panel__title">
          Reading Settings
          <button onclick="StudyRoom._togglePrefs()"
                  style="background:none;border:none;cursor:pointer;font-size:1.25rem;
                         color:var(--text-tertiary);line-height:1;padding:0;">×</button>
        </div>

        <div class="sr-prefs-section">
          <span class="sr-prefs-section__label">Font Size</span>
          <input type="range" class="sr-pref-slider" id="srFontSize"
                 min="12" max="26" step="1" value="${_prefs.fontSize}"
                 oninput="StudyRoom._onPrefChange('fontSize', +this.value)" />
          <div id="srFontSizeLabel"
               style="text-align:center;font-size:var(--text-xs);color:var(--text-tertiary);margin-top:.25rem;">
            ${_prefs.fontSize}px
          </div>
        </div>

        <div class="sr-prefs-section">
          <span class="sr-prefs-section__label">Font Style</span>
          <div class="sr-prefs-row">
            <button class="sr-pref-btn${_prefs.fontFamily === 'serif' ? ' is-active' : ''}"
                    onclick="StudyRoom._onPrefChange('fontFamily','serif')"
                    style="font-family:'Lora',Georgia,serif;">Serif</button>
            <button class="sr-pref-btn${_prefs.fontFamily === 'sans' ? ' is-active' : ''}"
                    onclick="StudyRoom._onPrefChange('fontFamily','sans')">Sans</button>
            <button class="sr-pref-btn${_prefs.fontFamily === 'mono' ? ' is-active' : ''}"
                    onclick="StudyRoom._onPrefChange('fontFamily','mono')"
                    style="font-family:'Inconsolata',monospace;">Mono</button>
          </div>
        </div>

        <div class="sr-prefs-section">
          <span class="sr-prefs-section__label">Line Spacing</span>
          <input type="range" class="sr-pref-slider" id="srLineSpacing"
                 min="1.3" max="2.4" step="0.05" value="${_prefs.lineSpacing}"
                 oninput="StudyRoom._onPrefChange('lineSpacing', +this.value)" />
          <div id="srLineSpacingLabel"
               style="text-align:center;font-size:var(--text-xs);color:var(--text-tertiary);margin-top:.25rem;">
            ${Number(_prefs.lineSpacing).toFixed(2)}×
          </div>
        </div>

        <div class="sr-prefs-section">
          <span class="sr-prefs-section__label">Page Width</span>
          <div class="sr-prefs-row">
            <button class="sr-pref-btn${_prefs.pageWidth === 560 ? ' is-active' : ''}"
                    onclick="StudyRoom._onPrefChange('pageWidth',560)">Narrow</button>
            <button class="sr-pref-btn${_prefs.pageWidth === 720 ? ' is-active' : ''}"
                    onclick="StudyRoom._onPrefChange('pageWidth',720)">Medium</button>
            <button class="sr-pref-btn${_prefs.pageWidth === 900 ? ' is-active' : ''}"
                    onclick="StudyRoom._onPrefChange('pageWidth',900)">Wide</button>
          </div>
        </div>

        <div class="sr-prefs-section">
          <span class="sr-prefs-section__label">Background</span>
          <div class="sr-bg-swatch-row">
            <button class="sr-bg-btn sr-bg-btn--white${_prefs.bg === 'white' ? ' is-active' : ''}"
                    onclick="StudyRoom._onPrefChange('bg','white')" title="White"></button>
            <button class="sr-bg-btn sr-bg-btn--sepia${_prefs.bg === 'sepia' ? ' is-active' : ''}"
                    onclick="StudyRoom._onPrefChange('bg','sepia')" title="Sepia"></button>
            <button class="sr-bg-btn sr-bg-btn--warm${_prefs.bg === 'warm' ? ' is-active' : ''}"
                    onclick="StudyRoom._onPrefChange('bg','warm')" title="Warm"></button>
            <button class="sr-bg-btn sr-bg-btn--dark${_prefs.bg === 'dark' ? ' is-active' : ''}"
                    onclick="StudyRoom._onPrefChange('bg','dark')" title="Dark"></button>
            <button class="sr-bg-btn sr-bg-btn--night${_prefs.bg === 'night' ? ' is-active' : ''}"
                    onclick="StudyRoom._onPrefChange('bg','night')" title="Night"></button>
          </div>
        </div>

        <div style="padding-top:var(--sp-4);border-top:1px solid var(--border);">
          <button class="sr-pref-btn" onclick="StudyRoom._resetPrefs()" style="width:100%;">
            Reset to Defaults
          </button>
        </div>
      </div>`;
  }

  function _togglePrefs() {
    const panel = document.getElementById('srPrefsPanel');
    if (panel) panel.classList.toggle('is-open');
  }

  function _onPrefChange(key, value) {
    _prefs[key] = value;
    _savePrefs();
    _applyPrefsToReader(document.getElementById('app'));
    _syncPrefsUI();
  }

  function _syncPrefsUI() {
    const fsEl = document.getElementById('srFontSize');
    if (fsEl) fsEl.value = _prefs.fontSize;
    const fsLbl = document.getElementById('srFontSizeLabel');
    if (fsLbl) fsLbl.textContent = _prefs.fontSize + 'px';

    const lsEl = document.getElementById('srLineSpacing');
    if (lsEl) lsEl.value = _prefs.lineSpacing;
    const lsLbl = document.getElementById('srLineSpacingLabel');
    if (lsLbl) lsLbl.textContent = Number(_prefs.lineSpacing).toFixed(2) + '×';

    document.querySelectorAll('.sr-pref-btn[onclick*="fontFamily"]').forEach(btn => {
      const m = btn.getAttribute('onclick').match(/'(\w+)'\)/);
      if (m) btn.classList.toggle('is-active', m[1] === _prefs.fontFamily);
    });

    document.querySelectorAll('.sr-pref-btn[onclick*="pageWidth"]').forEach(btn => {
      const m = btn.getAttribute('onclick').match(/(\d+)\)/);
      if (m) btn.classList.toggle('is-active', +m[1] === _prefs.pageWidth);
    });

    document.querySelectorAll('.sr-bg-btn').forEach(btn => {
      const m = btn.getAttribute('onclick')?.match(/'(\w+)'\)/);
      if (m) btn.classList.toggle('is-active', m[1] === _prefs.bg);
    });
  }

  function _resetPrefs() {
    _prefs = Object.assign({}, DEFAULT_PREFS);
    _savePrefs();
    if (_currentLesson) _renderReader(_currentLesson, _siblingLessons);
  }

  function _fontStack() {
    if (_prefs.fontFamily === 'sans') return 'var(--font)';
    if (_prefs.fontFamily === 'mono') return "'Inconsolata','DM Mono',monospace";
    return "'Lora','Source Serif 4',Georgia,serif";
  }

  function _bindScrollProgress() {
    const reader = document.getElementById('srScrollReader');
    const fill   = document.getElementById('srProgressFill');
    if (!reader || !fill) return;
    reader.addEventListener('scroll', () => {
      const scrollable = reader.scrollHeight - reader.clientHeight;
      fill.style.width = scrollable <= 0 ? '100%'
        : (reader.scrollTop / scrollable * 100).toFixed(1) + '%';
    }, { passive: true });
  }

  function _backToBrowser() {
    const app = document.getElementById('app');
    if (app) { app.classList.remove('exam-active'); app.style.padding = ''; }
    _currentLesson  = null;
    _siblingLessons = [];

    if (_previewMode) {
      _previewMode         = false;
      _studentLessonsCache = [];
      if (window.Teacher && typeof Teacher.renderTeacherDashboard === 'function') {
        Teacher.renderTeacherDashboard();
        setTimeout(() => {
          if (typeof Teacher.showTab === 'function') Teacher.showTab('studyroom');
        }, 0);
      }
    } else {
      openForStudent();
    }
  }

  function openTeacherTab() {
    const container = document.getElementById('teacher-studyroom');
    if (!container) return;
    _editingId = null;

    _loadDefaultTerm(function (currentDefault) {
      container.innerHTML = `
        <div style="margin-bottom:1.25rem;">
          <h2 style="font-size:1rem;font-weight:700;">Study Room — Lesson Management</h2>
          <p style="font-size:.75rem;color:var(--text-tertiary);margin-top:2px;">
            Create and manage lessons for students. Write content in Markdown.
          </p>
        </div>

        <div class="sr-form-card" style="margin-bottom:1.25rem;">
          <div class="sr-form-card__title">
            <span class="sr-form-card__dot" style="background:var(--warning);"></span>
            Student Browser Default
          </div>
          <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;">
            <label style="font-size:.8125rem;font-weight:600;color:var(--text-secondary);white-space:nowrap;">
              Default Term shown to students:
            </label>
            <select id="srDefaultTermSel" style="flex:1;min-width:160px;max-width:220px;">
              <option value="">— No default (show All Terms) —</option>
              ${TERMS.map(t =>
                `<option value="${_esc(t)}"${t === currentDefault ? ' selected' : ''}>${_esc(t)}</option>`
              ).join('')}
            </select>
            <button id="srSaveDefaultTermBtn" onclick="StudyRoom._saveDefaultTermSetting()"
                    style="background:var(--brand);color:#fff;border:none;padding:.4375rem .875rem;
                           border-radius:var(--r-md);font-size:.8125rem;font-weight:700;
                           cursor:pointer;font-family:var(--font);white-space:nowrap;">
              Save Default
            </button>
          </div>
          <p style="font-size:.6875rem;color:var(--text-tertiary);margin-top:.5rem;">
            When students open the Study Room, this term will be pre-selected in their filter.
          </p>
        </div>

        <div class="sr-teacher-panel">

          <div class="sr-form-card">
            <div class="sr-form-card__title">
              <span class="sr-form-card__dot"></span>
              <span id="srFormTitle">New Lesson</span>
              <span id="srEditBadge" style="display:none;margin-left:auto;font-size:.6875rem;
                    font-weight:700;padding:1px 7px;border-radius:99px;
                    background:var(--warning-bg);color:var(--warning-text);
                    border:1px solid var(--warning-border);">Editing</span>
            </div>

            <div style="display:flex;flex-direction:column;gap:.75rem;">

              <div>
                <label style="display:block;font-size:.75rem;font-weight:600;
                              color:var(--text-secondary);margin-bottom:.25rem;">Title *</label>
                <input type="text" id="srLessonTitle" placeholder="e.g. Introduction to Fractions" />
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
                <div>
                  <label style="display:block;font-size:.75rem;font-weight:600;
                                color:var(--text-secondary);margin-bottom:.25rem;">Class *</label>
                  <select id="srLessonClass" onchange="StudyRoom._autoFillOrder()">
                    <option value="">Select class…</option>
                    ${CLASS_OPTIONS.map(c => `<option>${c}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label style="display:block;font-size:.75rem;font-weight:600;
                                color:var(--text-secondary);margin-bottom:.25rem;">Term *</label>
                  <select id="srLessonTerm" onchange="StudyRoom._autoFillOrder()">
                    <option value="">Select term…</option>
                    ${TERMS.map(t => `<option>${t}</option>`).join('')}
                  </select>
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
                <div>
                  <label style="display:block;font-size:.75rem;font-weight:600;
                                color:var(--text-secondary);margin-bottom:.25rem;">Subject *</label>
                  <input type="text" id="srLessonSubject" placeholder="e.g. Mathematics"
                         oninput="StudyRoom._autoFillOrder()" />
                </div>
                <div>
                  <label style="display:block;font-size:.75rem;font-weight:600;
                                color:var(--text-secondary);margin-bottom:.25rem;">Order</label>
                  <input type="number" id="srLessonOrder" placeholder="auto" min="1" style="width:100%" />
                </div>
              </div>

              <div>
                <label style="display:block;font-size:.75rem;font-weight:600;
                              color:var(--text-secondary);margin-bottom:.25rem;">Topic / Subtitle</label>
                <input type="text" id="srLessonTopic" placeholder="e.g. Understanding numerators and denominators" />
              </div>

              <div>
                <label style="display:block;font-size:.75rem;font-weight:600;
                              color:var(--text-secondary);margin-bottom:.25rem;">Lesson Content (Markdown) *</label>
                <textarea id="srLessonContent" class="sr-content-editor"
                          placeholder="# Lesson Title&#10;&#10;Write your lesson here using Markdown…&#10;&#10;## Section 1&#10;&#10;Content goes here."></textarea>
                <div class="sr-markdown-hint">
                  <code># H1</code> <code>## H2</code> <code>**bold**</code> <code>*italic*</code>
                  <code>\`code\`</code> <code>- list item</code> <code>| table |</code>
                </div>
              </div>

              <div style="display:flex;gap:.625rem;padding-top:.75rem;border-top:1px solid var(--border);">
                <button id="srSaveBtn" onclick="StudyRoom._saveLesson()"
                        class="btn bg-green-600" style="flex:1;justify-content:center;">
                  Save Lesson
                </button>
                <button onclick="StudyRoom._previewLesson()" class="btn bg-blue-600"
                        style="justify-content:center;">
                  Preview
                </button>
                <button onclick="StudyRoom._cancelEdit()" class="btn bg-gray-500"
                        id="srCancelBtn" style="display:none;justify-content:center;">
                  Cancel
                </button>
              </div>
            </div>
          </div>

          <div class="sr-form-card">
            <div class="sr-form-card__title">
              <span class="sr-form-card__dot" style="background:var(--success);"></span>
              Published Lessons
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.75rem;">
              <select id="srTeacherFilterClass" onchange="StudyRoom._teacherFilterLessons()">
                <option value="">All Classes</option>
                ${CLASS_OPTIONS.map(c => `<option>${c}</option>`).join('')}
              </select>
              <select id="srTeacherFilterTerm" onchange="StudyRoom._teacherFilterLessons()">
                <option value="">All Terms</option>
                ${TERMS.map(t => `<option value="${_esc(t)}">${_esc(t)}</option>`).join('')}
              </select>
              <select id="srTeacherFilterSubject" onchange="StudyRoom._teacherFilterLessons()">
                <option value="">All Subjects</option>
              </select>
            </div>

            <div class="sr-teacher-lessons" id="srTeacherLessonList">
              <p style="font-size:.875rem;color:var(--text-tertiary);padding:.5rem 0;">Loading…</p>
            </div>
          </div>

        </div>`;

      _loadTeacherLessons();
    });
  }

  function _saveDefaultTermSetting() {
    const sel  = document.getElementById('srDefaultTermSel');
    const term = sel ? sel.value : '';
    const btn  = document.getElementById('srSaveDefaultTermBtn');
    if (btn) btn.textContent = 'Saving…';

    _saveDefaultTerm(term)
      .then(() => {
        _defaultTerm = term;
        UI.toast(term ? `Default term set to "${term}".` : 'Default term cleared.', 'success');
        if (btn) btn.textContent = 'Save Default';
      })
      .catch(err => {
        console.error('[studyroom] _saveDefaultTermSetting error:', err);
        UI.toast('Failed to save default term.', 'error');
        if (btn) btn.textContent = 'Save Default';
      });
  }

  function _loadTeacherLessons() {
    if (_teacherLessonsUnsub) { _teacherLessonsUnsub(); _teacherLessonsUnsub = null; }

    _teacherLessonsUnsub = window.fbDb.collection('lessons')
      .onSnapshot(snap => {
        _teacherLessonsAll = [];
        snap.forEach(doc => _teacherLessonsAll.push({ id: doc.id, ...doc.data() }));

        _teacherLessonsAll.sort((a, b) => {
          const ca = (a.class   || '').toLowerCase(), cb = (b.class   || '').toLowerCase();
          if (ca < cb) return -1; if (ca > cb) return 1;
          const sa = _normSubject(a.subject),          sb = _normSubject(b.subject);
          if (sa < sb) return -1; if (sa > sb) return 1;
          const ta = TERMS.indexOf(a.term),            tb = TERMS.indexOf(b.term);
          if (ta !== tb) return ta - tb;
          return (a.order || 0) - (b.order || 0);
        });

        _populateTeacherSubjectFilter();
        _teacherFilterLessons();
      }, err => {
        console.error('[studyroom] _loadTeacherLessons error:', err);
      });

    if (window.AppState && typeof AppState.registerListener === 'function') {
      AppState.registerListener('studyroomLessons', _teacherLessonsUnsub);
    }
  }

  function _populateTeacherSubjectFilter() {
    const cls  = document.getElementById('srTeacherFilterClass')?.value || '';
    const term = document.getElementById('srTeacherFilterTerm')?.value  || '';

    const subjects = [...new Set(
      _teacherLessonsAll
        .filter(l => (!cls  || l.class === cls)
                  && (!term || l.term  === term))
        .map(l => (l.subject || '').trim())
        .filter(Boolean)
    )].sort();

    const sel = document.getElementById('srTeacherFilterSubject');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">All Subjects</option>' +
      subjects.map(s => `<option${_normSubject(s) === _normSubject(cur) ? ' selected' : ''}>${_esc(s)}</option>`).join('');
  }

  function _teacherFilterLessons() {
    _populateTeacherSubjectFilter();
    const cls  = document.getElementById('srTeacherFilterClass')?.value   || '';
    const term = document.getElementById('srTeacherFilterTerm')?.value    || '';
    const subj = document.getElementById('srTeacherFilterSubject')?.value || '';

    let filtered = _teacherLessonsAll;
    if (cls)  filtered = filtered.filter(l => l.class === cls);
    if (term) filtered = filtered.filter(l => l.term  === term);
    if (subj) filtered = filtered.filter(l => _normSubject(l.subject) === _normSubject(subj));

    const container = document.getElementById('srTeacherLessonList');
    if (!container) return;

    if (!filtered.length) {
      container.innerHTML = '<p style="font-size:.875rem;color:var(--text-tertiary);padding:.5rem 0;text-align:center;">No lessons found.</p>';
      return;
    }

    container.innerHTML = filtered.map(l => `
      <div class="sr-teacher-lesson-row" id="srRow-${_esc(l.id)}">
        <span class="sr-teacher-lesson-row__num">${l.order || 1}</span>
        <div class="sr-teacher-lesson-row__info">
          <div class="sr-teacher-lesson-row__title" title="${_esc(l.title)}">${_esc(l.title)}</div>
          <div class="sr-teacher-lesson-row__meta">
            ${_esc(l.class)} · ${_esc(l.term || '')} · ${_esc(l.subject || '')}
          </div>
        </div>
        <div class="sr-teacher-lesson-row__actions">
          <button onclick="StudyRoom._editLesson('${_esc(l.id)}')"
                  style="background:var(--brand);color:#fff;border:none;border-radius:4px;
                         padding:3px 9px;font-size:.6875rem;font-weight:700;cursor:pointer;
                         font-family:var(--font);"
                  onmouseenter="this.style.background='var(--brand-hover)'"
                  onmouseleave="this.style.background='var(--brand)'">Edit</button>
          <button onclick="StudyRoom._deleteLesson('${_esc(l.id)}')"
                  style="background:none;border:none;cursor:pointer;font-size:1rem;
                         line-height:1;padding:2px 5px;color:var(--text-disabled);"
                  onmouseenter="this.style.color='var(--danger)'"
                  onmouseleave="this.style.color='var(--text-disabled)'">×</button>
        </div>
      </div>`).join('');
  }

  function _autoFillOrder() {
    if (_editingId) return;
    const cls     = document.getElementById('srLessonClass')?.value           || '';
    const term    = document.getElementById('srLessonTerm')?.value            || '';
    const subject = document.getElementById('srLessonSubject')?.value.trim() || '';
    if (!cls || !term || !subject) return;

    const group = _teacherLessonsAll.filter(
      l => l.class === cls
        && l.term  === term
        && _normSubject(l.subject) === _normSubject(subject)
    );

    const nextOrder = group.length
      ? Math.max(...group.map(l => l.order || 0)) + 1
      : 1;

    const orderEl = document.getElementById('srLessonOrder');
    if (orderEl && !orderEl.value) orderEl.value = nextOrder;
  }

  async function _saveLesson() {
    const title    = document.getElementById('srLessonTitle')?.value.trim()   || '';
    const cls      = document.getElementById('srLessonClass')?.value           || '';
    const term     = document.getElementById('srLessonTerm')?.value            || '';
    const subject  = document.getElementById('srLessonSubject')?.value.trim() || '';
    const orderRaw = document.getElementById('srLessonOrder')?.value          || '';
    const order    = parseInt(orderRaw, 10) || 1;
    const topic    = document.getElementById('srLessonTopic')?.value.trim()   || '';
    const content  = document.getElementById('srLessonContent')?.value        || '';

    if (!title)   { UI.toast('Please enter a lesson title.',    'warning'); return; }
    if (!cls)     { UI.toast('Please select a class.',          'warning'); return; }
    if (!term)    { UI.toast('Please select a term.',           'warning'); return; }
    if (!subject) { UI.toast('Please enter a subject.',         'warning'); return; }
    if (!content) { UI.toast('Please add some lesson content.', 'warning'); return; }

    const duplicate = _teacherLessonsAll.find(
      l => l.class === cls
        && l.term  === term
        && _normSubject(l.subject) === _normSubject(subject)
        && (l.order || 0) === order
        && l.id !== _editingId
    );
    if (duplicate) {
      UI.toast(
        `Order ${order} is already used by "${duplicate.title}" in this group. ` +
        `Consider a different number to keep sequencing unambiguous.`,
        'warning'
      );
    }

    const btn = document.getElementById('srSaveBtn');
    if (btn) UI.setLoading(btn, true);

    const payload = {
      title, class: cls, term, subject, topic, content, order,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
      if (_editingId) {
        await window.fbDb.collection('lessons').doc(_editingId).update(payload);
        UI.toast('Lesson updated.', 'success');
      } else {
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await window.fbDb.collection('lessons').add(payload);
        UI.toast('Lesson published.', 'success');
      }
      _cancelEdit();
    } catch (err) {
      console.error('[studyroom] _saveLesson error:', err);
      UI.toast('Failed to save lesson.', 'error');
    } finally {
      if (btn) UI.setLoading(btn, false);
    }
  }

  function _editLesson(id) {
    const lesson = _teacherLessonsAll.find(l => l.id === id);
    if (!lesson) return;
    _editingId = id;

    const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val ?? ''; };
    set('srLessonTitle',   lesson.title);
    set('srLessonClass',   lesson.class);
    set('srLessonTerm',    lesson.term);
    set('srLessonSubject', lesson.subject);
    set('srLessonOrder',   lesson.order);
    set('srLessonTopic',   lesson.topic);
    set('srLessonContent', lesson.content);

    const formTitle = document.getElementById('srFormTitle');
    const editBadge = document.getElementById('srEditBadge');
    const cancelBtn = document.getElementById('srCancelBtn');
    if (formTitle) formTitle.textContent = 'Edit Lesson';
    if (editBadge) editBadge.style.display = '';
    if (cancelBtn) cancelBtn.style.display = '';

    document.getElementById('srLessonTitle')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function _cancelEdit() {
    _editingId = null;
    ['srLessonTitle','srLessonClass','srLessonTerm','srLessonSubject',
     'srLessonOrder','srLessonTopic','srLessonContent'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const formTitle = document.getElementById('srFormTitle');
    const editBadge = document.getElementById('srEditBadge');
    const cancelBtn = document.getElementById('srCancelBtn');
    if (formTitle) formTitle.textContent = 'New Lesson';
    if (editBadge) editBadge.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
  }

  async function _deleteLesson(id) {
    const ok = await UI.confirmAction('Delete this lesson permanently?');
    if (!ok) return;
    try {
      await window.fbDb.collection('lessons').doc(id).delete();
      UI.toast('Lesson deleted.', 'success');
    } catch (err) {
      console.error('[studyroom] _deleteLesson error:', err);
      UI.toast('Failed to delete lesson.', 'error');
    }
  }

  function _previewLesson() {
    const fakeLesson = {
      id:      '__preview__',
      title:   document.getElementById('srLessonTitle')?.value.trim()   || 'Preview',
      content: document.getElementById('srLessonContent')?.value        || '',
      topic:   document.getElementById('srLessonTopic')?.value.trim()   || '',
      class:   document.getElementById('srLessonClass')?.value           || '',
      term:    document.getElementById('srLessonTerm')?.value            || '',
      subject: document.getElementById('srLessonSubject')?.value.trim() || '',
      order:   1,
    };
    _studentLessonsCache = [fakeLesson];
    _previewMode = true;
    _renderReader(fakeLesson, [fakeLesson]);
  }

  window.StudyRoom = {
    openForStudent,
    _closeStudentRoom,
    _filterLessons,
    _openLesson,
    _backToBrowser,
    _togglePrefs,
    _onPrefChange,
    _resetPrefs,
    openTeacherTab,
    openForTeacher: openTeacherTab,
    _saveLesson,
    _editLesson,
    _cancelEdit,
    _deleteLesson,
    _previewLesson,
    _teacherFilterLessons,
    _saveDefaultTermSetting,
    _autoFillOrder,
    cancelTeacherListeners() {
      if (_teacherLessonsUnsub) { _teacherLessonsUnsub(); _teacherLessonsUnsub = null; }
    },
  };

}());
