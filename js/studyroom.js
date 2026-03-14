/* ============================================================
   js/studyroom.js — Study Room: lesson browser + reader
   ============================================================
   Architecture:
     StudyRoom.openForStudent()  — called from exam.js
     StudyRoom.openTeacherTab()  — called from teacher.js tab

   Firestore collection: 'lessons'
   Document fields:
     title, class, term, subject, topic, content,
     order, createdAt, updatedAt

   Content format: Markdown (safe subset, sanitised on render)
   ============================================================ */

(function () {
  'use strict';

  /* ── Defaults ── */
  const DEFAULT_PREFS = {
    fontSize:    16,
    fontFamily:  'serif',
    lineSpacing: 1.75,
    pageWidth:   720,
    bg:          'white',
    mode:        'scroll',   // 'scroll' | 'flip'
  };

  const PREFS_KEY = 'vtx_study_prefs';

  const TERMS = [
    'First Term', 'Second Term', 'Third Term',
  ];

  const CLASS_OPTIONS = [
    'JSS1','JSS2','JSS3','SSS1','SSS2','SSS3','TUTORIAL'
  ];

  /* ── State ── */
  let _prefs        = _loadPrefs();
  let _currentLesson = null;
  let _siblingLessons = [];
  let _flipPages    = [];
  let _flipIndex    = 0;
  let _editingId    = null;   // teacher edit mode
  let _teacherLessonsUnsub = null;

  /* ══════════════════════════════════════════════════
     PREFERENCES
     ══════════════════════════════════════════════════ */

  function _loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? Object.assign({}, DEFAULT_PREFS, JSON.parse(raw)) : Object.assign({}, DEFAULT_PREFS);
    } catch (e) { return Object.assign({}, DEFAULT_PREFS); }
  }

  function _savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(_prefs)); } catch (e) { /* */ }
  }

  function _applyPrefsToReader(containerEl) {
    if (!containerEl) return;
    const content = containerEl.querySelector('.sr-scroll-content, .sr-book');
    if (content) {
      content.style.maxWidth  = _prefs.pageWidth + 'px';
    }
    const reader = containerEl.querySelector('.sr-scroll-reader, .sr-flip-outer');
    if (reader) {
      // Remove old bg classes
      ['sr-bg--white','sr-bg--sepia','sr-bg--warm','sr-bg--dark','sr-bg--night'].forEach(c => reader.classList.remove(c));
      reader.classList.add('sr-bg--' + _prefs.bg);
    }
    const srContent = containerEl.querySelector('.sr-content');
    if (srContent) {
      srContent.style.fontSize   = _prefs.fontSize + 'px';
      srContent.style.lineHeight = _prefs.lineSpacing;
      srContent.style.fontFamily = _prefs.fontFamily === 'serif'
        ? "'Lora', 'Source Serif 4', Georgia, serif"
        : _prefs.fontFamily === 'sans'
          ? "var(--font)"
          : "'Inconsolata', 'DM Mono', monospace";
    }
    const bookPages = containerEl.querySelectorAll('.sr-book__page-content .sr-content');
    bookPages.forEach(el => {
      el.style.fontSize   = Math.max(12, _prefs.fontSize - 2) + 'px';
      el.style.lineHeight = _prefs.lineSpacing;
      el.style.fontFamily = _prefs.fontFamily === 'serif'
        ? "'Lora', 'Source Serif 4', Georgia, serif"
        : "var(--font)";
    });
  }

  /* ══════════════════════════════════════════════════
     MARKDOWN RENDERER
     (safe subset, no external library needed)
     ══════════════════════════════════════════════════ */

  function _renderMarkdown(md) {
    if (!md) return '';

    let html = String(md);

    // Sanitise: strip script tags and on* attributes
    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\bon\w+\s*=/gi, 'data-removed=')
      .replace(/javascript:/gi, '');

    // Tables (must come before inline processing)
    html = html.replace(/^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)*)/gm, function (_, header, rows) {
      const ths = header.split('|').filter(Boolean).map(c =>
        `<th>${_inlineMarkdown(c.trim())}</th>`).join('');
      const trs = rows.trim().split('\n').map(row => {
        const tds = row.split('|').filter(Boolean).map(c =>
          `<td>${_inlineMarkdown(c.trim())}</td>`).join('');
        return `<tr>${tds}</tr>`;
      }).join('');
      return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
    });

    // Fenced code blocks
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/gm, function (_, lang, code) {
      const escaped = code.replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return `<pre><code class="lang-${lang}">${escaped}</code></pre>`;
    });

    // Block quotes
    html = html.replace(/^> (.+)/gm, '<blockquote>$1</blockquote>');

    // Headings
    html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Horizontal rule
    html = html.replace(/^---+$/gm, '<hr>');
    html = html.replace(/^\*\*\*+$/gm, '<hr>');

    // Unordered lists
    html = html.replace(/((?:^[-*+] .+\n?)+)/gm, function (block) {
      const items = block.trim().split('\n').map(line =>
        `<li>${_inlineMarkdown(line.replace(/^[-*+] /, ''))}</li>`).join('');
      return `<ul>${items}</ul>`;
    });

    // Ordered lists
    html = html.replace(/((?:^\d+\. .+\n?)+)/gm, function (block) {
      const items = block.trim().split('\n').map(line =>
        `<li>${_inlineMarkdown(line.replace(/^\d+\. /, ''))}</li>`).join('');
      return `<ol>${items}</ol>`;
    });

    // Paragraphs — wrap lines that aren't already block elements
    const lines = html.split('\n');
    const result = [];
    let buffer = [];
    const blockTags = ['<h','<ul','<ol','<li','<pre','<blockquote','<table','<hr','<p'];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) {
        if (buffer.length) {
          result.push('<p>' + _inlineMarkdown(buffer.join(' ')) + '</p>');
          buffer = [];
        }
        return;
      }
      const isBlock = blockTags.some(t => trimmed.startsWith(t));
      if (isBlock) {
        if (buffer.length) {
          result.push('<p>' + _inlineMarkdown(buffer.join(' ')) + '</p>');
          buffer = [];
        }
        result.push(trimmed);
      } else {
        buffer.push(trimmed);
      }
    });

    if (buffer.length) {
      result.push('<p>' + _inlineMarkdown(buffer.join(' ')) + '</p>');
    }

    return result.join('\n');
  }

  function _inlineMarkdown(text) {
    if (!text) return '';
    return text
      // Bold + italic
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      // Inline code
      .replace(/`(.+?)`/g, '<code>$1</code>')
      // Link
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      // Image
      .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1">');
  }

  /* ══════════════════════════════════════════════════
     FLIP MODE — split content into pages
     ══════════════════════════════════════════════════ */

  function _splitIntoPages(htmlContent) {
    // Split on <hr> or manual page break <!-- pagebreak -->
    const parts = htmlContent
      .replace(/<!--\s*pagebreak\s*-->/gi, '<hr class="__pb__">')
      .split(/<hr class="__pb__">|(?=<h1[^>]*>)/);

    const pages = parts.map(p => p.trim()).filter(Boolean);

    // If still one big block, auto-split by word count (~250 words per page)
    if (pages.length === 1 && pages[0]) {
      const WORDS_PER_PAGE = 250;
      const words = pages[0].split(/\s+/);
      const result = [];
      for (let i = 0; i < words.length; i += WORDS_PER_PAGE) {
        result.push(words.slice(i, i + WORDS_PER_PAGE).join(' '));
      }
      return result.length ? result : pages;
    }

    return pages;
  }

  /* ══════════════════════════════════════════════════
     HTML ESCAPE
     ══════════════════════════════════════════════════ */

  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ══════════════════════════════════════════════════
     STUDENT — OPEN STUDY ROOM BROWSER
     ══════════════════════════════════════════════════ */

  function openForStudent() {
    const studentData = AppState.studentData;
    if (!studentData) { UI.toast('Could not load student data.', 'error'); return; }

    const studentClass = studentData.class || '';

    UI.mount(`
      <div class="sr-shell sr-animate-in">
        <div class="sr-topbar">
          <button class="sr-topbar__back" onclick="StudyRoom._closeStudentRoom()">
            ← Back
          </button>
          <span class="sr-topbar__title">Study Room</span>
        </div>

        <div class="sr-browser">
          <div class="sr-browser__header">
            <h2 style="font-size:var(--text-xl);font-weight:700;color:var(--text-primary);margin-bottom:0.25rem;">
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
            <div style="text-align:center;padding:3rem 1rem;color:var(--text-tertiary);">
              Loading lessons…
            </div>
          </div>
        </div>
      </div>`);

    _loadStudentLessons(studentClass);
  }

  function _closeStudentRoom() {
    // Go back to subject selection
    if (window.Exam && Exam.renderSubjectSelection) {
      Exam.renderSubjectSelection();
    }
  }

  let _studentLessonsCache = [];

  function _loadStudentLessons(studentClass) {
    // Single-field filter only — no compound orderBy so no composite index is needed.
    // Sorting is done client-side after the fetch.
    window.fbDb.collection('lessons')
      .where('class', '==', studentClass)
      .get()
      .then(snap => {
        _studentLessonsCache = [];
        snap.forEach(doc => _studentLessonsCache.push({ id: doc.id, ...doc.data() }));

        // Sort client-side: subject A→Z, then order numerically within subject
        _studentLessonsCache.sort((a, b) => {
          const sa = (a.subject || '').toLowerCase();
          const sb = (b.subject || '').toLowerCase();
          if (sa < sb) return -1;
          if (sa > sb) return  1;
          return (a.order || 0) - (b.order || 0);
        });

        // Populate subject filter
        const subjects = [...new Set(_studentLessonsCache.map(l => l.subject).filter(Boolean))].sort();
        const subjectSel = document.getElementById('srFilterSubject');
        if (subjectSel) {
          subjectSel.innerHTML = '<option value="">All Subjects</option>' +
            subjects.map(s => `<option value="${_esc(s)}">${_esc(s)}</option>`).join('');
        }

        _filterLessons();
      })
      .catch(err => {
        console.error('[studyroom] _loadStudentLessons error:', err);
        const browser = document.getElementById('srLessonBrowser');
        if (browser) browser.innerHTML = '<p style="color:var(--danger);text-align:center;padding:2rem;">Failed to load lessons. Please refresh.</p>';
      });
  }

  function _filterLessons() {
    const termFilter    = (document.getElementById('srFilterTerm')?.value    || '').trim();
    const subjectFilter = (document.getElementById('srFilterSubject')?.value || '').trim();

    let filtered = _studentLessonsCache;
    if (termFilter)    filtered = filtered.filter(l => l.term    === termFilter);
    if (subjectFilter) filtered = filtered.filter(l => l.subject === subjectFilter);

    const browser = document.getElementById('srLessonBrowser');
    if (!browser) return;

    if (filtered.length === 0) {
      browser.innerHTML = `
        <div class="sr-empty">
          <span class="sr-empty__icon">📭</span>
          <p class="sr-empty__text">No lessons found for this filter.</p>
        </div>`;
      return;
    }

    // Group by subject
    const bySubject = {};
    filtered.forEach(l => {
      const key = l.subject || 'General';
      if (!bySubject[key]) bySubject[key] = [];
      bySubject[key].push(l);
    });

    browser.innerHTML = Object.keys(bySubject).sort().map(subj => {
      const lessons = bySubject[subj];
      return `
        <div class="sr-subject-group">
          <div class="sr-subject-group__header">
            <span class="sr-subject-group__name">${_esc(subj)}</span>
            <span class="sr-subject-group__count">${lessons.length} lesson${lessons.length !== 1 ? 's' : ''}</span>
          </div>
          ${lessons.map(l => `
            <div class="sr-lesson-card" onclick="StudyRoom._openLesson('${_esc(l.id)}')">
              <div class="sr-lesson-card__num">${l.order || 1}</div>
              <div class="sr-lesson-card__body">
                <div class="sr-lesson-card__title">${_esc(l.title)}</div>
                <div class="sr-lesson-card__meta">
                  ${_esc(l.term || '')} · ${_esc(l.topic || '')}
                </div>
              </div>
              <span class="sr-lesson-card__arrow">›</span>
            </div>`).join('')}
        </div>`;
    }).join('');
  }

  /* ══════════════════════════════════════════════════
     OPEN A LESSON
     ══════════════════════════════════════════════════ */

  function _openLesson(lessonId) {
    const lesson = _studentLessonsCache.find(l => l.id === lessonId);
    if (!lesson) {
      // Fetch from Firestore if not cached
      window.fbDb.collection('lessons').doc(lessonId).get()
        .then(snap => {
          if (!snap.exists) { UI.toast('Lesson not found.', 'error'); return; }
          _renderReader({ id: snap.id, ...snap.data() }, []);
        })
        .catch(err => { console.error('[studyroom] _openLesson error:', err); UI.toast('Failed to load lesson.', 'error'); });
      return;
    }

    // Build sibling list (same subject)
    const siblings = _studentLessonsCache
      .filter(l => l.subject === lesson.subject)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    _renderReader(lesson, siblings);
  }

  /* ══════════════════════════════════════════════════
     RENDER READER
     ══════════════════════════════════════════════════ */

  function _renderReader(lesson, siblings) {
    _currentLesson = lesson;
    _siblingLessons = siblings;

    const renderedHtml = _renderMarkdown(lesson.content || '');
    _flipPages = _splitIntoPages(renderedHtml);
    _flipIndex = 0;

    UI.mount(_buildReaderShell(lesson, siblings, renderedHtml));

    // Set app to full-width mode
    const app = document.getElementById('app');
    if (app) {
      app.classList.add('exam-active');
      app.style.padding = '0';
    }

    _applyPrefsToReader(document.getElementById('app'));
    _syncPrefsUI();
    _bindScrollProgress();

    // Re-render KaTeX if available
    if (window._katexAutoRenderReady && window.renderMathInElement) {
      try {
        renderMathInElement(document.getElementById('app'), {
          delimiters: [
            { left:'$$', right:'$$', display:true  },
            { left:'$',  right:'$',  display:false },
          ],
          throwOnError: false,
        });
      } catch (e) { /* non-fatal */ }
    }
  }

  function _buildReaderShell(lesson, siblings, renderedHtml) {
    const isFlip = _prefs.mode === 'flip';
    const sidebarItems = siblings.map((s, i) => `
      <div class="sr-sidebar__item${s.id === lesson.id ? ' is-active' : ''}"
           onclick="StudyRoom._openLesson('${_esc(s.id)}')">
        <span class="sr-sidebar__num">${s.order || i + 1}</span>
        <span class="sr-sidebar__name">${_esc(s.title)}</span>
      </div>`).join('');

    const breadcrumb = [lesson.class, lesson.term, lesson.subject]
      .filter(Boolean)
      .map(b => `<span>${_esc(b)}</span>`)
      .join('<span style="color:var(--border-medium)"> / </span>');

    return `
      <div class="sr-shell">
        <div class="sr-progress-bar"><div class="sr-progress-bar__fill" id="srProgressFill" style="width:0%"></div></div>

        <div class="sr-topbar">
          <button class="sr-topbar__back" onclick="StudyRoom._backToBrowser()">
            ← Lessons
          </button>
          <span class="sr-topbar__title">${_esc(lesson.title)}</span>
          <div class="sr-topbar__actions">
            <button class="sr-topbar__back" id="srModeToggle" onclick="StudyRoom._toggleMode()" style="gap:0.25rem;">
              ${_prefs.mode === 'scroll' ? '📖 Flip Mode' : '📄 Scroll Mode'}
            </button>
            <button class="sr-topbar__back" onclick="StudyRoom._togglePrefs()" id="srPrefsBtn">
              ⚙ Aa
            </button>
          </div>
        </div>

        <div class="sr-layout" id="srLayout">
          ${siblings.length > 1 ? `
            <div class="sr-sidebar">
              <div class="sr-sidebar__heading">${_esc(lesson.subject || 'Lessons')}</div>
              ${sidebarItems}
            </div>` : ''}

          ${isFlip ? _buildFlipReader(lesson, renderedHtml) : _buildScrollReader(lesson, renderedHtml)}
        </div>

        ${_buildPrefsPanel()}
      </div>`;
  }

  /* ── Scroll reader ── */
  function _buildScrollReader(lesson, renderedHtml) {
    const breadcrumb = [lesson.class, lesson.term, lesson.subject]
      .filter(Boolean)
      .map(b => `<span>${_esc(b)}</span>`)
      .join('<span style="opacity:.5;margin:0 .2em"> / </span>');

    return `
      <div class="sr-scroll-reader sr-bg--${_prefs.bg}" id="srScrollReader">
        <div class="sr-scroll-content sr-animate-in" id="srScrollContent"
             style="max-width:${_prefs.pageWidth}px;font-size:${_prefs.fontSize}px;line-height:${_prefs.lineSpacing};">

          <div class="sr-lesson-header">
            <div class="sr-lesson-header__breadcrumb">${breadcrumb}</div>
            <h1 class="sr-lesson-header__title">${_esc(lesson.title)}</h1>
            ${lesson.topic ? `<p class="sr-lesson-header__topic">${_esc(lesson.topic)}</p>` : ''}
          </div>

          <div class="sr-content" id="srContent"
               style="font-family:${_fontStack()};font-size:${_prefs.fontSize}px;line-height:${_prefs.lineSpacing};">
            ${renderedHtml}
          </div>

          <div style="margin-top:var(--sp-8);padding-top:var(--sp-5);border-top:1px solid var(--border);
                      display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--sp-3);">
            ${_prevLessonBtn(lesson)}
            <span style="font-size:var(--text-xs);color:var(--text-disabled);">End of lesson</span>
            ${_nextLessonBtn(lesson)}
          </div>
        </div>
      </div>`;
  }

  /* ── Flip reader ── */
  function _buildFlipReader(lesson, renderedHtml) {
    _flipPages = _splitIntoPages(renderedHtml);
    _flipIndex = 0;
    return `
      <div class="sr-flip-outer sr-bg--${_prefs.bg}" id="srFlipOuter">
        <div class="sr-book" id="srBook">
          ${_buildSpread()}
        </div>
        <div class="sr-flip-nav">
          <button class="sr-flip-nav__btn" id="srFlipPrev" onclick="StudyRoom._flipPrev()"
                  ${_flipIndex === 0 ? 'disabled' : ''}>
            ← Previous
          </button>
          <div class="sr-flip-nav__info" id="srFlipInfo">
            Page ${_flipIndex + 1} – ${Math.min(_flipIndex + 2, _flipPages.length)} of ${_flipPages.length}
          </div>
          <button class="sr-flip-nav__btn" id="srFlipNext" onclick="StudyRoom._flipNext()"
                  ${_flipIndex + 2 >= _flipPages.length ? 'disabled' : ''}>
            Next →
          </button>
        </div>
      </div>`;
  }

  function _buildSpread() {
    const left  = _flipPages[_flipIndex]     || '';
    const right = _flipPages[_flipIndex + 1] || '';
    const totalPages = _flipPages.length;
    const leftNum  = _flipIndex + 1;
    const rightNum = _flipIndex + 2;

    return `
      <div class="sr-book__spread" id="srSpread">
        <div class="sr-book__page sr-book__page--left">
          <div class="sr-book__page-content">
            <div class="sr-content" style="font-family:${_fontStack()};font-size:${Math.max(12,_prefs.fontSize-2)}px;line-height:${_prefs.lineSpacing};">
              ${left}
            </div>
          </div>
          <span class="sr-book__page-num">${leftNum}</span>
        </div>
        <div class="sr-book__page sr-book__page--right">
          <div class="sr-book__page-content">
            <div class="sr-content" style="font-family:${_fontStack()};font-size:${Math.max(12,_prefs.fontSize-2)}px;line-height:${_prefs.lineSpacing};">
              ${right || '<p style="color:var(--text-disabled);font-style:italic;text-align:center;margin-top:4rem;">— end —</p>'}
            </div>
          </div>
          <span class="sr-book__page-num">${rightNum <= totalPages ? rightNum : ''}</span>
        </div>
      </div>`;
  }

  function _flipNext() {
    if (_flipIndex + 2 >= _flipPages.length) return;
    const book = document.getElementById('srBook');
    if (book) {
      book.style.animation = 'none';
      book.offsetHeight; // reflow
      book.style.animation = 'sr-flip-left 0.5s var(--ease)';
    }
    setTimeout(() => {
      _flipIndex += 2;
      _updateSpread();
    }, 200);
  }

  function _flipPrev() {
    if (_flipIndex === 0) return;
    const book = document.getElementById('srBook');
    if (book) {
      book.style.animation = 'none';
      book.offsetHeight;
      book.style.animation = 'sr-flip-right 0.5s var(--ease)';
    }
    setTimeout(() => {
      _flipIndex = Math.max(0, _flipIndex - 2);
      _updateSpread();
    }, 200);
  }

  function _updateSpread() {
    const bookEl = document.getElementById('srBook');
    if (!bookEl) return;
    bookEl.innerHTML = _buildSpread();

    const prevBtn = document.getElementById('srFlipPrev');
    const nextBtn = document.getElementById('srFlipNext');
    const info    = document.getElementById('srFlipInfo');
    if (prevBtn) prevBtn.disabled = _flipIndex === 0;
    if (nextBtn) nextBtn.disabled = _flipIndex + 2 >= _flipPages.length;
    if (info)    info.textContent = `Page ${_flipIndex + 1}–${Math.min(_flipIndex + 2, _flipPages.length)} of ${_flipPages.length}`;

    // Update progress
    const fill = document.getElementById('srProgressFill');
    if (fill) fill.style.width = ((_flipIndex + 2) / _flipPages.length * 100).toFixed(1) + '%';

    // Re-render KaTeX
    if (window._katexAutoRenderReady && window.renderMathInElement) {
      try { renderMathInElement(bookEl, { delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}], throwOnError:false }); } catch(e){}
    }
  }

  /* ── Helpers for prev/next lesson buttons ── */
  function _prevLessonBtn(lesson) {
    const idx = _siblingLessons.findIndex(l => l.id === lesson.id);
    if (idx <= 0) return '<span></span>';
    const prev = _siblingLessons[idx - 1];
    return `<button class="sr-topbar__back" onclick="StudyRoom._openLesson('${_esc(prev.id)}')">
      ← ${_esc(prev.title)}
    </button>`;
  }

  function _nextLessonBtn(lesson) {
    const idx = _siblingLessons.findIndex(l => l.id === lesson.id);
    if (idx < 0 || idx >= _siblingLessons.length - 1) return '<span></span>';
    const next = _siblingLessons[idx + 1];
    return `<button class="btn" onclick="StudyRoom._openLesson('${_esc(next.id)}')">
      ${_esc(next.title)} →
    </button>`;
  }

  /* ══════════════════════════════════════════════════
     MODE TOGGLE
     ══════════════════════════════════════════════════ */

  function _toggleMode() {
    _prefs.mode = _prefs.mode === 'scroll' ? 'flip' : 'scroll';
    _savePrefs();
    if (_currentLesson) {
      const renderedHtml = _renderMarkdown(_currentLesson.content || '');
      _renderReader(_currentLesson, _siblingLessons);
    }
  }

  /* ══════════════════════════════════════════════════
     PREFERENCES PANEL
     ══════════════════════════════════════════════════ */

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
          <div style="text-align:center;font-size:var(--text-xs);color:var(--text-tertiary);margin-top:0.25rem;">
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
    // Font size label
    const fsEl = document.getElementById('srFontSize');
    if (fsEl) {
      fsEl.value = _prefs.fontSize;
      const label = fsEl.nextElementSibling;
      if (label) label.textContent = _prefs.fontSize + 'px';
    }
    const lsEl = document.getElementById('srLineSpacing');
    if (lsEl) lsEl.value = _prefs.lineSpacing;

    // Active buttons — font
    document.querySelectorAll('.sr-pref-btn[onclick*="fontFamily"]').forEach(btn => {
      const match = btn.getAttribute('onclick').match(/'(\w+)'\)/);
      if (match) btn.classList.toggle('is-active', match[1] === _prefs.fontFamily);
    });
    // Active buttons — pageWidth
    document.querySelectorAll('.sr-pref-btn[onclick*="pageWidth"]').forEach(btn => {
      const match = btn.getAttribute('onclick').match(/(\d+)\)/);
      if (match) btn.classList.toggle('is-active', +match[1] === _prefs.pageWidth);
    });
    // Active bg buttons
    document.querySelectorAll('.sr-bg-btn').forEach(btn => {
      const match = btn.getAttribute('onclick')?.match(/'(\w+)'\)/);
      if (match) btn.classList.toggle('is-active', match[1] === _prefs.bg);
    });
  }

  function _resetPrefs() {
    _prefs = Object.assign({}, DEFAULT_PREFS);
    _savePrefs();
    if (_currentLesson) _renderReader(_currentLesson, _siblingLessons);
  }

  function _fontStack() {
    if (_prefs.fontFamily === 'sans')  return "var(--font)";
    if (_prefs.fontFamily === 'mono')  return "'Inconsolata','DM Mono',monospace";
    return "'Lora','Source Serif 4',Georgia,serif";
  }

  /* ══════════════════════════════════════════════════
     SCROLL PROGRESS
     ══════════════════════════════════════════════════ */

  function _bindScrollProgress() {
    const reader = document.getElementById('srScrollReader');
    const fill   = document.getElementById('srProgressFill');
    if (!reader || !fill) return;

    reader.addEventListener('scroll', function () {
      const scrollable = reader.scrollHeight - reader.clientHeight;
      if (scrollable <= 0) { fill.style.width = '100%'; return; }
      fill.style.width = (reader.scrollTop / scrollable * 100).toFixed(1) + '%';
    }, { passive: true });
  }

  /* ══════════════════════════════════════════════════
     NAVIGATION
     ══════════════════════════════════════════════════ */

  function _backToBrowser() {
    // Restore app layout
    const app = document.getElementById('app');
    if (app) {
      app.classList.remove('exam-active');
      app.style.padding = '';
    }
    _currentLesson  = null;
    _siblingLessons = [];
    openForStudent();
  }

  /* ══════════════════════════════════════════════════
     TEACHER PANEL
     ══════════════════════════════════════════════════ */

  function openTeacherTab() {
    const container = document.getElementById('teacher-studyroom');
    if (!container) return;

    _editingId = null;

    container.innerHTML = `
      <div style="margin-bottom:1.25rem;">
        <h2 style="font-size:1rem;font-weight:700;">Study Room — Lesson Management</h2>
        <p style="font-size:.75rem;color:var(--text-tertiary);margin-top:2px;">
          Create and manage lessons for students. Write content in Markdown.
        </p>
      </div>

      <div class="sr-teacher-panel">

        <!-- ── Left: Lesson form ── -->
        <div class="sr-form-card">
          <div class="sr-form-card__title">
            <span class="sr-form-card__dot"></span>
            <span id="srFormTitle">New Lesson</span>
            <span id="srEditBadge" style="display:none;margin-left:auto;
                  font-size:.6875rem;font-weight:700;padding:1px 7px;border-radius:99px;
                  background:var(--warning-bg);color:var(--warning-text);border:1px solid var(--warning-border);">
              Editing
            </span>
          </div>

          <div style="display:flex;flex-direction:column;gap:.75rem;">

            <div>
              <label style="display:block;font-size:.75rem;font-weight:600;
                            color:var(--text-secondary);margin-bottom:.25rem;">Title *</label>
              <input type="text" id="srLessonTitle" placeholder="Lesson title e.g. Introduction to Fractions" />
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
              <div>
                <label style="display:block;font-size:.75rem;font-weight:600;
                              color:var(--text-secondary);margin-bottom:.25rem;">Class *</label>
                <select id="srLessonClass">
                  <option value="">Select class…</option>
                  ${CLASS_OPTIONS.map(c => `<option>${c}</option>`).join('')}
                </select>
              </div>
              <div>
                <label style="display:block;font-size:.75rem;font-weight:600;
                              color:var(--text-secondary);margin-bottom:.25rem;">Term *</label>
                <select id="srLessonTerm">
                  <option value="">Select term…</option>
                  ${TERMS.map(t => `<option>${t}</option>`).join('')}
                </select>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
              <div>
                <label style="display:block;font-size:.75rem;font-weight:600;
                              color:var(--text-secondary);margin-bottom:.25rem;">Subject *</label>
                <input type="text" id="srLessonSubject" placeholder="e.g. Mathematics" />
              </div>
              <div>
                <label style="display:block;font-size:.75rem;font-weight:600;
                              color:var(--text-secondary);margin-bottom:.25rem;">Order</label>
                <input type="number" id="srLessonOrder" placeholder="1" min="1" style="width:100%" />
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
                — Use <code>---</code> as a page break for Flip Mode
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

        <!-- ── Right: Lesson list ── -->
        <div class="sr-form-card">
          <div class="sr-form-card__title">
            <span class="sr-form-card__dot" style="background:var(--success);"></span>
            Published Lessons
          </div>

          <div style="display:flex;gap:.5rem;margin-bottom:.75rem;">
            <select id="srTeacherFilterClass" onchange="StudyRoom._teacherFilterLessons()" style="flex:1;">
              <option value="">All Classes</option>
              ${CLASS_OPTIONS.map(c => `<option>${c}</option>`).join('')}
            </select>
            <select id="srTeacherFilterSubject" onchange="StudyRoom._teacherFilterLessons()" style="flex:1;">
              <option value="">All Subjects</option>
            </select>
          </div>

          <div class="sr-teacher-lessons" id="srTeacherLessonList">
            <p style="font-size:.875rem;color:var(--text-tertiary);padding:.5rem 0;">Loading…</p>
          </div>
        </div>

      </div>`;

    _loadTeacherLessons();
  }

  /* ── Teacher: load all lessons ── */
  let _teacherLessonsAll = [];

  function _loadTeacherLessons() {
    if (_teacherLessonsUnsub) { _teacherLessonsUnsub(); _teacherLessonsUnsub = null; }

    // No compound orderBy — avoids composite index requirement.
    // Sort is done client-side after each snapshot.
    _teacherLessonsUnsub = window.fbDb.collection('lessons')
      .onSnapshot(snap => {
        _teacherLessonsAll = [];
        snap.forEach(doc => _teacherLessonsAll.push({ id: doc.id, ...doc.data() }));
        _teacherLessonsAll.sort((a, b) => {
          const ca = (a.class || '').toLowerCase(), cb = (b.class || '').toLowerCase();
          if (ca < cb) return -1; if (ca > cb) return 1;
          const sa = (a.subject || '').toLowerCase(), sb = (b.subject || '').toLowerCase();
          if (sa < sb) return -1; if (sa > sb) return 1;
          return (a.order || 0) - (b.order || 0);
        });
        _populateTeacherSubjectFilter();
        _teacherFilterLessons();
      }, err => {
        console.error('[studyroom] _loadTeacherLessons error:', err);
      });

    AppState.registerListener('studyroomLessons', _teacherLessonsUnsub);
  }

  function _populateTeacherSubjectFilter() {
    const cls = document.getElementById('srTeacherFilterClass')?.value || '';
    const subjects = [...new Set(
      _teacherLessonsAll
        .filter(l => !cls || l.class === cls)
        .map(l => l.subject).filter(Boolean)
    )].sort();
    const sel = document.getElementById('srTeacherFilterSubject');
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = '<option value="">All Subjects</option>' +
        subjects.map(s => `<option ${s === cur ? 'selected' : ''}>${_esc(s)}</option>`).join('');
    }
  }

  function _teacherFilterLessons() {
    _populateTeacherSubjectFilter();
    const cls  = document.getElementById('srTeacherFilterClass')?.value  || '';
    const subj = document.getElementById('srTeacherFilterSubject')?.value || '';

    let filtered = _teacherLessonsAll;
    if (cls)  filtered = filtered.filter(l => l.class   === cls);
    if (subj) filtered = filtered.filter(l => l.subject === subj);

    const container = document.getElementById('srTeacherLessonList');
    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `<p style="font-size:.875rem;color:var(--text-tertiary);padding:.5rem 0;text-align:center;">
        No lessons yet.</p>`;
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

  /* ── Teacher: save lesson ── */
  async function _saveLesson() {
    const title   = document.getElementById('srLessonTitle')?.value.trim()   || '';
    const cls     = document.getElementById('srLessonClass')?.value           || '';
    const term    = document.getElementById('srLessonTerm')?.value            || '';
    const subject = document.getElementById('srLessonSubject')?.value.trim() || '';
    const order   = parseInt(document.getElementById('srLessonOrder')?.value  || '1', 10) || 1;
    const topic   = document.getElementById('srLessonTopic')?.value.trim()   || '';
    const content = document.getElementById('srLessonContent')?.value        || '';

    if (!title)   { UI.toast('Please enter a lesson title.',   'warning'); return; }
    if (!cls)     { UI.toast('Please select a class.',         'warning'); return; }
    if (!term)    { UI.toast('Please select a term.',          'warning'); return; }
    if (!subject) { UI.toast('Please enter a subject.',        'warning'); return; }
    if (!content) { UI.toast('Please add some lesson content.','warning'); return; }

    const btn = document.getElementById('srSaveBtn');
    UI.setLoading(btn, true);

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
      UI.setLoading(btn, false);
    }
  }

  /* ── Teacher: edit lesson ── */
  function _editLesson(id) {
    const lesson = _teacherLessonsAll.find(l => l.id === id);
    if (!lesson) return;

    _editingId = id;

    const setVal = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };

    setVal('srLessonTitle',   lesson.title);
    setVal('srLessonClass',   lesson.class);
    setVal('srLessonTerm',    lesson.term);
    setVal('srLessonSubject', lesson.subject);
    setVal('srLessonOrder',   lesson.order);
    setVal('srLessonTopic',   lesson.topic);
    setVal('srLessonContent', lesson.content);

    const formTitle  = document.getElementById('srFormTitle');
    const editBadge  = document.getElementById('srEditBadge');
    const cancelBtn  = document.getElementById('srCancelBtn');
    if (formTitle) formTitle.textContent = 'Edit Lesson';
    if (editBadge) editBadge.style.display = '';
    if (cancelBtn) cancelBtn.style.display = '';

    // Scroll form into view
    document.getElementById('srLessonTitle')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ── Teacher: cancel edit ── */
  function _cancelEdit() {
    _editingId = null;
    const fields = ['srLessonTitle','srLessonClass','srLessonTerm','srLessonSubject',
                    'srLessonOrder','srLessonTopic','srLessonContent'];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    const formTitle = document.getElementById('srFormTitle');
    const editBadge = document.getElementById('srEditBadge');
    const cancelBtn = document.getElementById('srCancelBtn');
    if (formTitle) formTitle.textContent = 'New Lesson';
    if (editBadge) editBadge.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
  }

  /* ── Teacher: delete lesson ── */
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

  /* ── Teacher: preview lesson ── */
  function _previewLesson() {
    const title   = document.getElementById('srLessonTitle')?.value.trim()   || 'Preview';
    const content = document.getElementById('srLessonContent')?.value        || '';
    const topic   = document.getElementById('srLessonTopic')?.value.trim()   || '';
    const cls     = document.getElementById('srLessonClass')?.value           || '';
    const term    = document.getElementById('srLessonTerm')?.value            || '';
    const subject = document.getElementById('srLessonSubject')?.value.trim() || '';

    const fakeLesson = { id: '__preview__', title, topic, content, class: cls, term, subject };
    _studentLessonsCache = [fakeLesson];

    // Store a flag so backToBrowser re-opens teacher tab
    _previewMode = true;
    _renderReader(fakeLesson, [fakeLesson]);
  }

  let _previewMode = false;

  // Override _backToBrowser for preview mode
  const _originalBackToBrowser = _backToBrowser;

  function _backToBrowserSafe() {
    const app = document.getElementById('app');
    if (app) { app.classList.remove('exam-active'); app.style.padding = ''; }
    _currentLesson = null;
    _siblingLessons = [];
    if (_previewMode) {
      _previewMode = false;
      _studentLessonsCache = [];
      // Return to teacher dashboard
      if (window.Teacher) Teacher.showTab('studyroom');
    } else {
      openForStudent();
    }
  }

  /* ══════════════════════════════════════════════════
     EXPOSE
     ══════════════════════════════════════════════════ */

  window.StudyRoom = {
    openForStudent,
    openTeacherTab,
    openForTeacher: openTeacherTab,   // alias used by teacher.js
    _closeStudentRoom,
    _backToBrowser: _backToBrowserSafe,
    _filterLessons,
    _openLesson,
    _toggleMode,
    _togglePrefs,
    _onPrefChange,
    _resetPrefs,
    _flipNext,
    _flipPrev,
    _saveLesson,
    _editLesson,
    _cancelEdit,
    _deleteLesson,
    _previewLesson,
    _teacherFilterLessons,
    // For teacher.js tab routing
    cancelTeacherListeners() {
      if (_teacherLessonsUnsub) { _teacherLessonsUnsub(); _teacherLessonsUnsub = null; }
    },
  };

}());
