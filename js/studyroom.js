/* ============================================================
   js/studyroom.js — Study Room: lesson browser + reader
   ============================================================
   Architecture:
     StudyRoom.openForStudent()  — called from exam.js
     StudyRoom.openTeacherTab()  — called from teacher.js tab

   Firestore collections:
     'lessons'             — lesson documents
     'studyroom_settings'  — doc 'defaults' with field defaultTerm

   Lesson document fields:
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

  const TERMS = ['First Term', 'Second Term', 'Third Term'];

  const CLASS_OPTIONS = ['JSS1','JSS2','JSS3','SSS1','SSS2','SSS3','TUTORIAL'];

  /* ── Module state ── */
  let _prefs               = _loadPrefs();
  let _currentLesson       = null;
  let _siblingLessons      = [];
  let _flipPages           = [];
  let _flipIndex           = 0;
  let _editingId           = null;
  let _teacherLessonsUnsub = null;
  let _previewMode         = false;
  let _defaultTerm         = '';
  let _studentLessonsCache = [];
  let _teacherLessonsAll   = [];

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
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(_prefs)); } catch (e) {}
  }

  function _applyPrefsToReader(containerEl) {
    if (!containerEl) return;

    /* Page width — scroll mode only */
    const scrollContent = containerEl.querySelector('.sr-scroll-content');
    if (scrollContent) scrollContent.style.maxWidth = _prefs.pageWidth + 'px';

    /* Background theme */
    containerEl.querySelectorAll('.sr-scroll-reader, .sr-flip-outer').forEach(el => {
      ['white','sepia','warm','dark','night'].forEach(c => el.classList.remove('sr-bg--' + c));
      el.classList.add('sr-bg--' + _prefs.bg);
    });

    /* Typography */
    const fontStack = _fontStack();
    containerEl.querySelectorAll('.sr-content').forEach(el => {
      el.style.fontSize   = _prefs.fontSize + 'px';
      el.style.lineHeight = _prefs.lineSpacing;
      el.style.fontFamily = fontStack;
    });

    /* Flip book pages get a slightly smaller font */
    containerEl.querySelectorAll('.sr-book__page-content .sr-content').forEach(el => {
      el.style.fontSize = Math.max(12, _prefs.fontSize - 2) + 'px';
    });
  }

  /* ══════════════════════════════════════════════════
     MARKDOWN RENDERER  (safe subset, no external lib)
     ══════════════════════════════════════════════════ */

  function _renderMarkdown(md) {
    if (!md) return '';
    let html = String(md);

    /*
     * STEP 1 — Stash verbatim HTML blocks before any processing.
     *
     * Multi-line HTML blocks (svg, figure, aside, section, style, details, table)
     * must survive the sanitiser and paragraph-wrapper unchanged. We replace each
     * block with a unique placeholder, run all markdown transforms, then restore.
     *
     * Tags whose opening tag may carry attributes (e.g. <figure>, <aside class="...">) 
     * are matched with [^>]* so the attribute content is included in the match.
     */
    const stash = [];
    const STASH_TAG = 'HTMLSTASH';

    function _stashBlock(tagName) {
      const re = new RegExp('<' + tagName + '[^>]*>[\\s\\S]*?<\\/' + tagName + '>', 'gi');
      html = html.replace(re, match => {
        stash.push(match);
        return STASH_TAG + (stash.length - 1) + '_';
      });
    }

    /* Order matters: outermost first so outer wrappers (e.g. <figure> containing <svg>)
     * are captured whole. Inner tags inside them are preserved as-is within the stash. */
    _stashBlock('script');   /* removed below — still stash to neutralise */
    _stashBlock('style');
    _stashBlock('figure');   /* must come before svg — figure may wrap svg */
    _stashBlock('section');  /* must come before aside — section may wrap aside */
    _stashBlock('details');
    _stashBlock('aside');
    _stashBlock('svg');

    /* STEP 2 — Sanitise the remaining (non-stashed) content */
    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')   /* belt-and-braces: any un-stashed scripts */
      .replace(/\bon\w+\s*=/gi, 'data-removed=')
      .replace(/javascript:/gi, '');

    /* Remove stashed <script> blocks (index already recorded, just blank them) */
    stash.forEach((block, i) => {
      if (/^<script/i.test(block)) stash[i] = '';
    });

    /* GFM tables */
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

    /* Fenced code blocks */
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/gm, (_, lang, code) => {
      const esc = code.replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return `<pre><code class="lang-${lang}">${esc}</code></pre>`;
    });

    /* Block quotes */
    html = html.replace(/^> (.+)/gm, '<blockquote>$1</blockquote>');

    /* Headings */
    html = html
      .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
      .replace(/^##### (.+)$/gm,  '<h5>$1</h5>')
      .replace(/^#### (.+)$/gm,   '<h4>$1</h4>')
      .replace(/^### (.+)$/gm,    '<h3>$1</h3>')
      .replace(/^## (.+)$/gm,     '<h2>$1</h2>')
      .replace(/^# (.+)$/gm,      '<h1>$1</h1>');

    /* Horizontal rules (also used as page-break in flip mode) */
    html = html
      .replace(/^---+$/gm,    '<hr>')
      .replace(/^\*\*\*+$/gm, '<hr>');

    /* Unordered lists */
    html = html.replace(/((?:^[-*+] .+\n?)+)/gm, block => {
      const items = block.trim().split('\n')
        .map(line => `<li>${_inlineMarkdown(line.replace(/^[-*+] /, ''))}</li>`).join('');
      return `<ul>${items}</ul>`;
    });

    /* Ordered lists */
    html = html.replace(/((?:^\d+\. .+\n?)+)/gm, block => {
      const items = block.trim().split('\n')
        .map(line => `<li>${_inlineMarkdown(line.replace(/^\d+\. /, ''))}</li>`).join('');
      return `<ol>${items}</ol>`;
    });

    /* Wrap remaining lines in <p>, treating stash placeholders as block elements */
    const blockStarters = ['<h','<ul','<ol','<li','<pre','<blockquote','<table','<hr','<p', STASH_TAG];
    const result = [];
    let buffer   = [];

    html.split('\n').forEach(line => {
      const t = line.trim();
      if (!t) {
        if (buffer.length) { result.push('<p>' + _inlineMarkdown(buffer.join(' ')) + '</p>'); buffer = []; }
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

    /* STEP 3 — Restore stashed blocks.
     *
     * Restore in REVERSE order so outer wrappers (e.g. <figure>) are restored
     * before the inner placeholders they contain (e.g. HTMLSTASH0_ for <svg>).
     * A second forward pass then resolves any inner placeholders now exposed.
     */
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

  /* ══════════════════════════════════════════════════
     FLIP MODE — split HTML into page chunks
     ══════════════════════════════════════════════════ */

  function _splitIntoPages(htmlContent) {
    if (!htmlContent) return [''];

    const SENTINEL = '<!-- __PAGEBREAK__ -->';
    const normalised = htmlContent
      .replace(/<!--\s*pagebreak\s*-->/gi, SENTINEL)
      .replace(/<hr\s*\/?>/gi, SENTINEL);

    const parts = normalised.split(SENTINEL).map(p => p.trim()).filter(Boolean);

    if (parts.length <= 1) {
      const WORDS_PER_PAGE = 250;
      const tokens  = (parts[0] || '').match(/<[^>]+>|[^<]+/g) || [];
      const pages   = [];
      let page      = '';
      let wordCount = 0;

      for (const token of tokens) {
        page += token;
        if (!token.startsWith('<')) {
          wordCount += token.split(/\s+/).filter(Boolean).length;
          if (wordCount >= WORDS_PER_PAGE) {
            pages.push(page.trim());
            page = '';
            wordCount = 0;
          }
        }
      }
      if (page.trim()) pages.push(page.trim());
      return pages.length ? pages : [''];
    }

    return parts;
  }

  /* ══════════════════════════════════════════════════
     HTML ESCAPE
     ══════════════════════════════════════════════════ */

  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ══════════════════════════════════════════════════
     HELPERS
     ══════════════════════════════════════════════════ */

  /** Normalise a subject string for case-insensitive comparison */
  function _normSubject(s) { return (s || '').trim().toLowerCase(); }

  /** Build a stable group key: subject + term (used for sibling scoping & browser grouping) */
  function _groupKey(lesson) {
    return _normSubject(lesson.subject) + '||' + (lesson.term || '');
  }

  /* ══════════════════════════════════════════════════
     DEFAULT TERM — Firestore read / write
     ══════════════════════════════════════════════════ */

  function _loadDefaultTerm(callback) {
    window.fbDb.collection('studyroom_settings').doc('defaults').get()
      .then(snap => {
        _defaultTerm = (snap.exists && snap.data().defaultTerm) ? snap.data().defaultTerm : '';
        if (callback) callback(_defaultTerm);
      })
      .catch(() => { if (callback) callback(''); });
  }

  function _saveDefaultTerm(term) {
    return window.fbDb.collection('studyroom_settings').doc('defaults')
      .set({ defaultTerm: term }, { merge: true });
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
        _studentLessonsCache = [];
        snap.forEach(doc => _studentLessonsCache.push({ id: doc.id, ...doc.data() }));

        /* Sort: subject A→Z, then term (chronological), then order numerically */
        _studentLessonsCache.sort((a, b) => {
          const sa = _normSubject(a.subject), sb = _normSubject(b.subject);
          if (sa < sb) return -1; if (sa > sb) return 1;
          const ta = TERMS.indexOf(a.term), tb = TERMS.indexOf(b.term);
          if (ta !== tb) return ta - tb;
          return (a.order || 0) - (b.order || 0);
        });

        /* Populate subject filter from unique subjects */
        const subjects = [...new Set(_studentLessonsCache.map(l => (l.subject || '').trim()).filter(Boolean))].sort();
        const subjectSel = document.getElementById('srFilterSubject');
        if (subjectSel) {
          subjectSel.innerHTML = '<option value="">All Subjects</option>' +
            subjects.map(s => `<option value="${_esc(s)}">${_esc(s)}</option>`).join('');
        }
        _filterLessons();
      })
      .catch(err => {
        console.error('[studyroom] _loadStudentLessons error:', err);
        const el = document.getElementById('srLessonBrowser');
        if (el) el.innerHTML = '<p style="color:var(--danger);text-align:center;padding:2rem;">Failed to load lessons. Please refresh.</p>';
      });
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
          <span class="sr-empty__icon"></span>
          <p class="sr-empty__text">No lessons found for this filter.</p>
        </div>`;
      return;
    }

    /*
     * Grouping strategy:
     *   - Term filter active   → group by subject only (all visible lessons share the same term)
     *   - No term filter       → group by subject + term to avoid colliding order numbers
     *                            across terms; heading shows "Subject — Term"
     */
    const byGroup = {};
    filtered.forEach(l => {
      const key = termFilter
        ? (l.subject || 'General')
        : _groupKey(l);
      if (!byGroup[key]) byGroup[key] = { subject: l.subject || 'General', term: l.term || '', lessons: [] };
      byGroup[key].lessons.push(l);
    });

    /* Sort lessons within each group by order */
    Object.values(byGroup).forEach(g => g.lessons.sort((a, b) => (a.order || 0) - (b.order || 0)));

    /* Sort groups: subject A→Z, then term chronologically */
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

  /* ══════════════════════════════════════════════════
     OPEN A LESSON
     ══════════════════════════════════════════════════ */

  function _openLesson(lessonId) {
    const lesson = _studentLessonsCache.find(l => l.id === lessonId);
    if (!lesson) {
      /* Not in cache (e.g. direct link) — fetch and open without siblings */
      window.fbDb.collection('lessons').doc(lessonId).get()
        .then(snap => {
          if (!snap.exists) { UI.toast('Lesson not found.', 'error'); return; }
          _renderReader({ id: snap.id, ...snap.data() }, []);
        })
        .catch(err => {
          console.error('[studyroom] _openLesson error:', err);
          UI.toast('Failed to load lesson.', 'error');
        });
      return;
    }

    /*
     * Siblings = lessons in the same class (guaranteed by cache) + same subject + same term.
     * Scoping by term prevents the sidebar and prev/next buttons from crossing term
     * boundaries, and also prevents colliding order numbers from different terms.
     */
    const siblings = _studentLessonsCache
      .filter(l => _normSubject(l.subject) === _normSubject(lesson.subject) && l.term === lesson.term)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    _renderReader(lesson, siblings);
  }

  /* ══════════════════════════════════════════════════
     RENDER READER
     ══════════════════════════════════════════════════ */

  function _renderReader(lesson, siblings) {
    _currentLesson  = lesson;
    _siblingLessons = siblings;

    const renderedHtml = _renderMarkdown(lesson.content || '');

    /* Pre-compute flip pages ONCE — shared by _buildFlipReader and _buildSpread */
    _flipPages = _splitIntoPages(renderedHtml);
    _flipIndex = 0;

    UI.mount(_buildReaderShell(lesson, siblings, renderedHtml));

    const app = document.getElementById('app');
    if (app) { app.classList.add('exam-active'); app.style.padding = '0'; }

    _applyPrefsToReader(document.getElementById('app'));
    _syncPrefsUI();

    if (_prefs.mode === 'scroll') _bindScrollProgress();
    if (_prefs.mode === 'flip')   _bindFlipSwipe();

    if (window._katexAutoRenderReady && window.renderMathInElement) {
      try {
        renderMathInElement(document.getElementById('app'), {
          delimiters: [{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],
          throwOnError: false,
        });
      } catch (e) {}
    }

    _bindQuizButtons(document.getElementById('app'));
  }

  /*
   * Wire up quiz check buttons that use data-q / data-ans / data-msg attributes.
   * Called after every render so buttons in both scroll and flip mode work.
   * This is necessary because the markdown sanitiser strips <script> tags and
   * on* attributes from lesson content, so inline handlers never reach the DOM.
   */
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
          fb.className  = 'ins-fb err';
          fb.textContent = 'Please select an answer first.';
          return;
        }
        fb.className  = selected.value === correct ? 'ins-fb ok' : 'ins-fb err';
        fb.textContent = selected.value === correct
          ? msg
          : 'Not quite. Review the relevant section above and try again.';
      });
    });
  }

  /* ──────────────────────────────────────────────────
     Shell builder
     ────────────────────────────────────────────────── */

  function _buildReaderShell(lesson, siblings, renderedHtml) {
    const isFlip     = _prefs.mode === 'flip';
    const hasSidebar = siblings.length > 1;

    const sidebarItems = siblings.map((s, i) => `
      <div class="sr-sidebar__item${s.id === lesson.id ? ' is-active' : ''}"
           onclick="StudyRoom._openLesson('${_esc(s.id)}')">
        <span class="sr-sidebar__num">${s.order > 0 ? s.order : i + 1}</span>
        <span class="sr-sidebar__name">${_esc(s.title)}</span>
      </div>`).join('');

    /*
     * Sidebar heading: "Subject — Term" so the student always knows which
     * term's lessons they are browsing inside the reader.
     */
    const sidebarHeading = [lesson.subject, lesson.term].filter(Boolean).join(' — ');

    return `
      <div class="sr-shell">
        <div class="sr-progress-bar">
          <div class="sr-progress-bar__fill" id="srProgressFill" style="width:0%"></div>
        </div>

        <div class="sr-topbar" id="srTopbar">
          <button class="sr-topbar__back" onclick="StudyRoom._backToBrowser()">← Lessons</button>
          <span class="sr-topbar__title">${_esc(lesson.title)}</span>
          <div class="sr-topbar__actions">
            <button class="sr-topbar__back" id="srModeToggle" onclick="StudyRoom._toggleMode()">
              ${isFlip ? 'Scroll Mode' : 'Flip Mode'}
            </button>
            <button class="sr-topbar__back" onclick="StudyRoom._togglePrefs()" id="srPrefsBtn">Aa</button>
          </div>
        </div>

        <div class="sr-layout${hasSidebar ? '' : ' sr-layout--no-sidebar'}" id="srLayout">
          ${hasSidebar ? `
            <div class="sr-sidebar" id="srSidebar">
              <div class="sr-sidebar__heading">${_esc(sidebarHeading)}</div>
              ${sidebarItems}
            </div>` : ''}

          ${isFlip ? _buildFlipReader(lesson) : _buildScrollReader(lesson, renderedHtml)}
        </div>

        ${_buildPrefsPanel()}
      </div>`;
  }

  /* ──────────────────────────────────────────────────
     Scroll reader
     ────────────────────────────────────────────────── */

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

          <div style="margin-top:var(--sp-8);padding-top:var(--sp-5);border-top:1px solid var(--border);
                      display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--sp-3);">
            ${_prevLessonBtn(lesson)}
            <span style="font-size:var(--text-xs);color:var(--text-disabled);">End of lesson</span>
            ${_nextLessonBtn(lesson)}
          </div>
        </div>
      </div>`;
  }

  /* ──────────────────────────────────────────────────
     Flip reader
     NOTE: _flipPages / _flipIndex already set by _renderReader — do NOT reset here.
     ────────────────────────────────────────────────── */

  function _buildFlipReader(lesson) {
    return `
      <div class="sr-flip-outer sr-bg--${_esc(_prefs.bg)}" id="srFlipOuter">
        <div class="sr-flip-inner">
          <div class="sr-book" id="srBook">
            ${_buildSpread()}
          </div>
          <div class="sr-flip-nav">
            <button class="sr-flip-nav__btn" id="srFlipPrev" onclick="StudyRoom._flipPrev()"
                    ${_flipIndex === 0 ? 'disabled' : ''}>
              ← Previous
            </button>
            <div class="sr-flip-nav__info" id="srFlipInfo">${_flipNavLabel()}</div>
            <button class="sr-flip-nav__btn" id="srFlipNext" onclick="StudyRoom._flipNext()"
                    ${_flipAtLastPage() ? 'disabled' : ''}>
              Next →
            </button>
          </div>
        </div>
      </div>`;
  }

  /* Returns true when there is no further page to advance to */
  function _flipAtLastPage() {
    return _flipIsMobile()
      ? _flipIndex >= _flipPages.length - 1
      : _flipIndex + 2 >= _flipPages.length;
  }

  /* On mobile we show ONE page at a time; on desktop TWO (spread) */
  function _flipIsMobile() {
    return window.innerWidth <= 768;
  }

  function _flipNavLabel() {
    const total = _flipPages.length;
    if (!total) return 'No pages';
    if (_flipIsMobile()) {
      return `Page ${_flipIndex + 1} of ${total}`;
    }
    const hi = Math.min(_flipIndex + 2, total);
    return total <= 2
      ? `Page ${_flipIndex + 1} of ${total}`
      : `Pages ${_flipIndex + 1}–${hi} of ${total}`;
  }

  function _buildSpread() {
    const isMobile  = _flipIsMobile();
    const total     = _flipPages.length;
    const left      = isMobile ? '' : (_flipPages[_flipIndex] || '');
    const right     = isMobile ? (_flipPages[_flipIndex] || '') : (_flipPages[_flipIndex + 1] || '');
    const leftNum   = _flipIndex + 1;
    const rightNum  = isMobile ? _flipIndex + 1 : _flipIndex + 2;
    const fs        = Math.max(12, _prefs.fontSize - 2);
    const fontStack = _fontStack();
    const lineH     = _prefs.lineSpacing;

    return `
      <div class="sr-book__spread" id="srSpread">
        <div class="sr-book__page sr-book__page--left">
          <div class="sr-book__page-content">
            <div class="sr-content" style="font-family:${fontStack};font-size:${fs}px;line-height:${lineH};">
              ${left || '<p style="color:var(--text-disabled);font-style:italic;text-align:center;margin-top:4rem;">— blank —</p>'}
            </div>
          </div>
          <span class="sr-book__page-num">${leftNum}</span>
        </div>
        <div class="sr-book__page sr-book__page--right">
          <div class="sr-book__page-content">
            <div class="sr-content" style="font-family:${fontStack};font-size:${fs}px;line-height:${lineH};">
              ${right || '<p style="color:var(--text-disabled);font-style:italic;text-align:center;margin-top:4rem;">— end —</p>'}
            </div>
          </div>
          <span class="sr-book__page-num">${rightNum <= total ? rightNum : ''}</span>
        </div>
      </div>`;
  }

  function _flipNext() {
    if (_flipAtLastPage()) return;
    const step = _flipIsMobile() ? 1 : 2;
    _animateFlip('left', () => { _flipIndex += step; _updateSpread(); });
  }

  function _flipPrev() {
    if (_flipIndex === 0) return;
    const step = _flipIsMobile() ? 1 : 2;
    _animateFlip('right', () => { _flipIndex = Math.max(0, _flipIndex - step); _updateSpread(); });
  }

  function _animateFlip(direction, callback) {
    const book = document.getElementById('srBook');
    if (book) {
      book.style.animation = 'none';
      void book.offsetHeight;
      book.style.animation = `sr-flip-${direction} 0.4s var(--ease) both`;
    }
    setTimeout(callback, 200);
  }

  function _updateSpread() {
    const bookEl = document.getElementById('srBook');
    if (!bookEl) return;
    bookEl.innerHTML = _buildSpread();

    const prevBtn = document.getElementById('srFlipPrev');
    const nextBtn = document.getElementById('srFlipNext');
    const info    = document.getElementById('srFlipInfo');
    if (prevBtn) prevBtn.disabled = (_flipIndex === 0);
    if (nextBtn) nextBtn.disabled = _flipAtLastPage();
    if (info)    info.textContent = _flipNavLabel();

    const fill = document.getElementById('srProgressFill');
    if (fill && _flipPages.length) {
      const pct = _flipIsMobile()
        ? (_flipIndex + 1) / _flipPages.length * 100
        : (_flipIndex + 2) / _flipPages.length * 100;
      fill.style.width = Math.min(100, pct).toFixed(1) + '%';
    }

    if (window._katexAutoRenderReady && window.renderMathInElement) {
      try {
        renderMathInElement(bookEl, {
          delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],
          throwOnError:false,
        });
      } catch(e){}
    }

    _bindQuizButtons(bookEl);
    _bindFlipSwipe();   /* re-bind swipe after innerHTML replaced */
  }

  /*
   * Swipe / drag to flip pages.
   * Works for both touch (mobile) and mouse (desktop).
   * A horizontal swipe of ≥50px triggers the appropriate direction.
   */
  function _bindFlipSwipe() {
    const book = document.getElementById('srBook');
    if (!book || book.dataset.swipeBound) return;
    book.dataset.swipeBound = '1';

    let startX = null;
    const THRESHOLD = 50;

    function onStart(x) { startX = x; }
    function onEnd(x) {
      if (startX === null) return;
      const dx = x - startX;
      startX = null;
      if (Math.abs(dx) < THRESHOLD) return;
      if (dx < 0) _flipNext();   /* swipe left  → next page  */
      else        _flipPrev();   /* swipe right → prev page  */
    }

    /* Touch */
    book.addEventListener('touchstart', e => onStart(e.touches[0].clientX),     { passive: true });
    book.addEventListener('touchend',   e => onEnd(e.changedTouches[0].clientX), { passive: true });

    /* Mouse */
    book.addEventListener('mousedown', e => onStart(e.clientX));
    book.addEventListener('mouseup',   e => onEnd(e.clientX));
  }


  function _prevLessonBtn(lesson) {
    const idx = _siblingLessons.findIndex(l => l.id === lesson.id);
    if (idx <= 0) return '<span></span>';
    const prev = _siblingLessons[idx - 1];
    return `<button class="sr-topbar__back" onclick="StudyRoom._openLesson('${_esc(prev.id)}')">← ${_esc(prev.title)}</button>`;
  }

  function _nextLessonBtn(lesson) {
    const idx = _siblingLessons.findIndex(l => l.id === lesson.id);
    if (idx < 0 || idx >= _siblingLessons.length - 1) return '<span></span>';
    const next = _siblingLessons[idx + 1];
    return `<button class="btn" onclick="StudyRoom._openLesson('${_esc(next.id)}')">${_esc(next.title)} →</button>`;
  }

  /* ══════════════════════════════════════════════════
     MODE TOGGLE
     ══════════════════════════════════════════════════ */

  function _toggleMode() {
    _prefs.mode = _prefs.mode === 'scroll' ? 'flip' : 'scroll';
    _savePrefs();
    if (_currentLesson) _renderReader(_currentLesson, _siblingLessons);
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

  /* ══════════════════════════════════════════════════
     SCROLL PROGRESS
     ══════════════════════════════════════════════════ */

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

  /* ══════════════════════════════════════════════════
     NAVIGATION
     ══════════════════════════════════════════════════ */

  function _backToBrowser() {
    const app = document.getElementById('app');
    if (app) { app.classList.remove('exam-active'); app.style.padding = ''; }
    _currentLesson  = null;
    _siblingLessons = [];

    if (_previewMode) {
      _previewMode = false;
      _studentLessonsCache = [];
      if (window.Teacher) Teacher.showTab('studyroom');
    } else {
      openForStudent();
    }
  }

  /* ══════════════════════════════════════════════════
     TEACHER PANEL
     ══════════════════════════════════════════════════ */

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

        <!-- ── Default Term Setting ── -->
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

          <!-- ── Left: Lesson form ── -->
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
                  — Use <code>---</code> as a page break in Flip Mode
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

            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.75rem;">
              <select id="srTeacherFilterClass" onchange="StudyRoom._teacherFilterLessons()" >
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

  /* ── Save teacher default term ── */
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

  /* ── Load all lessons (real-time) ── */
  function _loadTeacherLessons() {
    if (_teacherLessonsUnsub) { _teacherLessonsUnsub(); _teacherLessonsUnsub = null; }

    _teacherLessonsUnsub = window.fbDb.collection('lessons')
      .onSnapshot(snap => {
        _teacherLessonsAll = [];
        snap.forEach(doc => _teacherLessonsAll.push({ id: doc.id, ...doc.data() }));

        /* Sort: class A→Z, subject A→Z, term chronologically, order numerically */
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

  /* ── Auto-fill Order field based on class + term + subject ── */
  function _autoFillOrder() {
    if (_editingId) return;   /* never overwrite when editing an existing lesson */
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
    /* Only overwrite if the teacher has not already typed a value */
    if (orderEl && !orderEl.value) orderEl.value = nextOrder;
  }

  /* ── Save lesson ── */
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

    /* Warn (non-blocking) if another lesson in the same group already uses this order */
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

  /* ── Edit lesson ── */
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

  /* ── Cancel edit ── */
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

  /* ── Delete lesson ── */
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

  /* ── Preview lesson ── */
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

  /* ══════════════════════════════════════════════════
     PUBLIC API
     ══════════════════════════════════════════════════ */

  window.StudyRoom = {
    /* Student */
    openForStudent,
    _closeStudentRoom,
    _filterLessons,
    _openLesson,

    /* Reader */
    _backToBrowser,
    _toggleMode,
    _togglePrefs,
    _onPrefChange,
    _resetPrefs,
    _flipNext,
    _flipPrev,

    /* Teacher */
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
