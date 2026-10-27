/* ============================================================
   js/studyroom.js — Study Room: lesson library + reader
   ============================================================
   v2 redesign
   - Library: continue-reading card, search, term + subject filters,
     per-lesson progress, collapsible subjects, skeleton/empty/error
     states, remembers filters and scroll position
   - Reader: contents drawer with "on this page" outline, reading
     settings sheet, auto-hiding top bar, resume position, next /
     previous cards, mark-as-done, keyboard + system Back support
   - Markdown is rendered by js/studyroom-md.js (VtxMarkdown)
   - Teacher lesson management below is unchanged in behaviour
   ============================================================ */

(function () {
  'use strict';

  const DEFAULT_PREFS = {
    fontSize:    17,
    fontFamily:  'serif',
    lineSpacing: 1.65,
    pageWidth:   680,
    bg:          'white',
  };

  const PREFS_KEY          = 'vtx_study_prefs';
  const _META_DEFAULT_TERM = 'studyroom_defaultTerm';
  const POS_KEY_PREFIX     = 'vtx_sr_pos_';

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

  function _nearest(val, options) {
    return options.reduce(function (best, o) { return Math.abs(o - val) < Math.abs(best - val) ? o : best; }, options[0]);
  }

  function _loadPrefs() {
    let p;
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      p = raw ? Object.assign({}, DEFAULT_PREFS, JSON.parse(raw)) : Object.assign({}, DEFAULT_PREFS);
    } catch (e) { p = Object.assign({}, DEFAULT_PREFS); }
    /* older versions stored 560 / 720 / 900 widths and a 'mono' font */
    p.pageWidth = _nearest(+p.pageWidth || 680, [540, 680, 820]);
    p.fontSize  = Math.max(14, Math.min(28, +p.fontSize || 17));
    if (['serif', 'sans', 'easy'].indexOf(p.fontFamily) === -1) p.fontFamily = 'serif';
    if (['white', 'sepia', 'warm', 'dark', 'night'].indexOf(p.bg) === -1) p.bg = 'white';
    return p;
  }

  function _savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(_prefs)); } catch (e) {}
  }

  function _saveLessonPos(lessonId, pos) {
    if (!lessonId || lessonId === '__preview__') return;
    try { localStorage.setItem(POS_KEY_PREFIX + lessonId, String(Math.round(pos))); } catch (e) {}
  }

  function _loadLessonPos(lessonId) {
    if (!lessonId || lessonId === '__preview__') return 0;
    try { return parseInt(localStorage.getItem(POS_KEY_PREFIX + lessonId) || '0', 10) || 0; } catch (e) { return 0; }
  }

  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _normSubject(s) { return (s || '').trim().toLowerCase(); }

  /* Per-class lesson index kept in studyroom_settings (already readable by students) */
  function _indexDocId(cls) { return 'index_' + String(cls || '').replace(/[\/\s]+/g, '_'); }
  const _indexHashes = {};

  function _countWords(content) {
    const t = String(content || '').replace(/<[^>]+>/g, ' ').replace(/[#>*_`|~-]/g, ' ');
    return t.split(/\s+/).filter(Boolean).length;
  }

  function _syncLessonIndexes() {
    const byClass = {};
    _teacherLessonsAll.forEach(function (l) {
      if (!l.class) return;
      (byClass[l.class] = byClass[l.class] || []).push({
        id: l.id, title: l.title || '', subject: l.subject || '', term: l.term || '',
        topic: l.topic || '', order: l.order || 0, words: _countWords(l.content),
      });
    });
    Object.keys(_indexHashes).forEach(function (c) { if (!byClass[c]) byClass[c] = []; });
    Object.keys(byClass).forEach(function (c) {
      const arr = byClass[c].sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      const hash = JSON.stringify(arr);
      if (_indexHashes[c] === hash) return;
      _indexHashes[c] = hash;
      window.fbDb.collection('studyroom_settings').doc(_indexDocId(c))
        .set({ class: c, lessons: arr, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
        .catch(function (err) { delete _indexHashes[c]; console.warn('[studyroom] index sync failed:', err); });
    });
  }


  /* ── Shared: default term (student + teacher) ── */
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


  /* ═══════════════════════════════════════════════════════
     SHARED HELPERS
  ═══════════════════════════════════════════════════════ */

  const ICON = {
    back:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    chev:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
    down:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    check:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
    list:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    aa:     '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M3 18l5-13h2l5 13h-2.2l-1.2-3.4H6.4L5.2 18H3zm4-5.2h4.2L9.1 7.1 7 12.8zM17.5 18c-1.6 0-2.7-.9-2.7-2.4 0-1.6 1.2-2.4 3.2-2.5l1.8-.1v-.5c0-.9-.6-1.4-1.7-1.4-.9 0-1.5.4-1.7 1l-1.6-.4c.4-1.3 1.7-2.1 3.4-2.1 2 0 3.3 1 3.3 2.9V18h-1.7l-.1-1c-.5.7-1.4 1.1-2.2 1zm.4-1.3c1 0 1.9-.7 1.9-1.7v-.4l-1.6.1c-1 .1-1.6.4-1.6 1.1 0 .6.5.9 1.3.9z"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    close:  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    up:     '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    clock:  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    book:   '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 004 21.5v-16z"/><path d="M4 21.5A2.5 2.5 0 016.5 19H20"/></svg>',
    retry:  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  };

  const TERM_SHORT = { 'First Term': '1st', 'Second Term': '2nd', 'Third Term': '3rd' };

  function _lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function _lsSet(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* storage full or blocked */ } }

  /* ── Progress store (per student, on this device) ── */
  let _progCache = null;
  let _progKeyCache = '';
  function _progKey() { return 'vtx_sr_v2_' + ((window.AppState && AppState.userId) || 'anon'); }
  function _prog() {
    const key = _progKey();
    if (!_progCache || _progKeyCache !== key) {
      _progKeyCache = key;
      try { _progCache = JSON.parse(_lsGet(key) || '{}') || {}; } catch (e) { _progCache = {}; }
      if (!_progCache.l) _progCache.l = {};
    }
    return _progCache;
  }
  function _saveProg() { _lsSet(_progKeyCache || _progKey(), JSON.stringify(_prog())); }
  function _lessonProg(id) { return _prog().l[id] || null; }
  function _recordProgress(id, pct) {
    if (!id || id === '__preview__') return;
    const p = _prog();
    const cur = p.l[id] || { p: 0, done: false };
    cur.p = Math.max(cur.p || 0, Math.min(100, Math.round(pct)));
    if (cur.p >= 95) cur.done = true;
    cur.at = Date.now();
    p.l[id] = cur;
    p.last = id;
    _saveProg();
  }
  function _setDone(id, done) {
    if (!id || id === '__preview__') return;
    const p = _prog();
    const cur = p.l[id] || { p: 0, done: false };
    cur.done = !!done;
    if (done) cur.p = 100; else cur.p = Math.min(cur.p, 90);
    cur.at = Date.now();
    p.l[id] = cur;
    p.last = id;
    _saveProg();
  }

  function _wordCount(lesson) {
    if (lesson._wc != null) return lesson._wc;
    if (!lesson.content && lesson.words) { lesson._wc = lesson.words; return lesson._wc; }
    const t = String(lesson.content || '').replace(/<[^>]+>/g, ' ').replace(/[#>*_`|~-]/g, ' ');
    lesson._wc = t.split(/\s+/).filter(Boolean).length;
    return lesson._wc;
  }
  function _readMinutes(words) { return Math.max(1, Math.round(words / 190)); }

  /* ── Full-bleed room chrome (replaces the padded #app card) ── */
  function _enterRoom() {
    const app = document.getElementById('app');
    if (app) { app.classList.add('exam-active', 'sr-active'); app.style.padding = '0'; }
  }
  function _leaveRoom() {
    const app = document.getElementById('app');
    if (app) { app.classList.remove('exam-active', 'sr-active'); app.style.padding = ''; }
  }

  /* ═══════════════════════════════════════════════════════
     NAVIGATION  (system Back button / swipe-back support)
     history stack while in Study Room:
       [app]  →  {vtxSr:'library'}  →  {vtxSr:'reader'}
  ═══════════════════════════════════════════════════════ */

  let _roomOpen = false;       // library or reader on screen (student mode)
  let _view = '';              // 'library' | 'reader'
  let _popBound = false;

  function _pushNav(kind) {
    try { history.pushState({ vtxSr: kind }, ''); } catch (e) { /* ignore */ }
  }
  function _histKind() { return (history.state && history.state.vtxSr) || ''; }

  function _bindPop() {
    if (_popBound) return;
    _popBound = true;
    window.addEventListener('popstate', function () {
      if (!_roomOpen || _previewMode) return;
      const kind = _histKind();
      if (kind === 'library' && _view === 'reader') {
        _showLibraryFromReader();
      } else if (!kind) {
        _exitRoom();
      }
    });
  }

  function _exitRoom() {
    _stopReaderSpeech();
    _unbindReaderKeys();
    _roomOpen = false;
    _view = '';
    _currentLesson = null;
    _siblingLessons = [];
    _leaveRoom();
    if (window.Exam && Exam.renderSubjectSelection) Exam.renderSubjectSelection();
  }

  /* ═══════════════════════════════════════════════════════
     LIBRARY  (lesson browser)
  ═══════════════════════════════════════════════════════ */

  let _studentClass   = '';
  let _cacheAt        = 0;
  let _cacheClass     = '';
  let _libState       = { term: null, subject: '', query: '' };   // term null = not chosen yet
  let _collapsed      = {};
  let _collapseInit   = false;
  let _libScroll      = 0;
  let _libSearchTimer = null;

  function _libPrefsKey() { return 'vtx_sr_filters_' + ((window.AppState && AppState.userId) || 'anon'); }
  function _loadLibPrefs() {
    try {
      const raw = JSON.parse(_lsGet(_libPrefsKey()) || 'null');
      if (raw && typeof raw === 'object') {
        if (typeof raw.term === 'string') _libState.term = raw.term;
        if (typeof raw.subject === 'string') _libState.subject = raw.subject;
      }
    } catch (e) { /* ignore */ }
  }
  function _saveLibPrefs() {
    _lsSet(_libPrefsKey(), JSON.stringify({ term: _libState.term, subject: _libState.subject }));
  }

  function openForStudent(opts) {
    const studentData = AppState.studentData;
    if (!studentData) { UI.toast('Could not load student data.', 'error'); return; }

    _previewMode  = false;
    _studentClass = studentData.class || '';
    _bindPop();

    if (!_roomOpen) {
      _roomOpen = true;
      _pushNav('library');
      _libState = { term: null, subject: '', query: '' };
      _loadLibPrefs();
      _collapseInit = false;
      _collapsed = {};
    }
    _view = 'library';
    _enterRoom();
    _mountLibrary();

    const fresh = _studentLessonsCache.length && _cacheClass === _studentClass &&
                  (Date.now() - _cacheAt) < 5 * 60 * 1000 && !(opts && opts.fresh);
    if (fresh) {
      _paintLibrary();
      return;
    }
    _loadLibraryData();
  }

  function _closeStudentRoom() {
    if (_previewMode) { _backToBrowser(); return; }
    _stopReaderSpeech();
    if (_histKind() === 'library') {
      history.back();                 // popstate handler exits the room
    } else {
      _exitRoom();
    }
  }

  function _mountLibrary() {
    UI.mount(`
      <div class="srl sr-animate-in" id="srlRoot">
        <header class="srl-top">
          <button class="srl-iconbtn srl-back" type="button" data-act="exit" aria-label="Back to dashboard">${ICON.back}<span>Back</span></button>
          <h1 class="srl-top__title">Study Room</h1>
          <span class="srl-top__stat" id="srlTopStat" aria-live="polite"></span>
        </header>
        <div class="srl-scroll" id="srlScroll">
          <div class="srl-wrap">
            <div class="srl-intro">
              <h2 class="srl-intro__title">Study Materials</h2>
              <p class="srl-intro__sub" id="srlIntroSub">${_esc(_studentClass)}</p>
            </div>
            <div id="srlContinue"></div>
            <div class="srl-controls" id="srlControls">
              <label class="srl-search">
                <span class="srl-search__icon">${ICON.search}</span>
                <input id="srlSearch" type="search" inputmode="search" enterkeyhint="search" autocomplete="off"
                       placeholder="Search lessons or topics" aria-label="Search lessons" value="${_esc(_libState.query)}">
                <button type="button" class="srl-search__clear" data-act="clear-search" aria-label="Clear search" hidden>${ICON.close}</button>
              </label>
              <div class="srl-seg" id="srlTerms" role="group" aria-label="Filter by term"></div>
              <div class="srl-chips" id="srlSubjects" role="group" aria-label="Filter by subject"></div>
            </div>
            <div id="srlResults" aria-live="polite">${_skeletonHtml()}</div>
          </div>
        </div>
      </div>`);

    const root = document.getElementById('srlRoot');
    root.addEventListener('click', _onLibraryClick);
    const search = document.getElementById('srlSearch');
    search.addEventListener('input', function () {
      clearTimeout(_libSearchTimer);
      _libSearchTimer = setTimeout(function () {
        _libState.query = search.value.trim();
        _renderResults();
      }, 120);
      const clr = document.querySelector('.srl-search__clear');
      if (clr) clr.hidden = !search.value;
    });
    const clr = document.querySelector('.srl-search__clear');
    if (clr) clr.hidden = !search.value;
  }

  function _skeletonHtml() {
    const row = '<div class="srl-skel__row"><span class="srl-skel__badge"></span><span class="srl-skel__lines"><i></i><i></i></span></div>';
    return `<div class="srl-skel" aria-busy="true" aria-label="Loading lessons">
      <div class="srl-skel__head"></div>${row}${row}${row}
      <div class="srl-skel__head"></div>${row}${row}
    </div>`;
  }

  function _loadLibraryData() {
    const results = document.getElementById('srlResults');
    if (results) results.innerHTML = _skeletonHtml();

    /* Cheap path: one small index document (titles only, no lesson text).
       Falls back to the full query if the teacher has not built it yet. */
    const fullQuery = function () {
      return window.fbDb.collection('lessons').where('class', '==', _studentClass).get()
        .then(function (snap) {
          const list = [];
          snap.forEach(function (d) { list.push(Object.assign({ id: d.id }, d.data())); });
          return list;
        });
    };
    const lessonsP = window.fbDb.collection('studyroom_settings').doc(_indexDocId(_studentClass)).get()
      .then(function (snap) {
        const d = snap && snap.exists ? snap.data() : null;
        if (d && Array.isArray(d.lessons)) {
          return d.lessons.map(function (m) { return Object.assign({}, m, { class: _studentClass, _meta: true }); });
        }
        return null;
      })
      .catch(function () { return null; })
      .then(function (list) { return list || fullQuery(); });
    const termP = new Promise(function (resolve) { _loadDefaultTerm(resolve); });

    Promise.all([lessonsP, termP]).then(function (res) {
      _studentLessonsCache = res[0];
      _cacheAt = Date.now();
      _cacheClass = _studentClass;
      _paintLibrary();
    }).catch(function (err) {
      console.error('[studyroom] load error:', err);
      _showLibraryError();
    });
  }

  function _showLibraryError() {
    const el = document.getElementById('srlResults');
    if (!el) return;
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    el.innerHTML = `
      <div class="srl-state">
        <div class="srl-state__icon">${ICON.book}</div>
        <h3>${offline ? 'You are offline' : 'Lessons could not load'}</h3>
        <p>${offline ? 'Connect to the internet and try again.' : 'Check your connection, then try again.'}</p>
        <button type="button" class="srl-btn srl-btn--primary" data-act="retry">${ICON.retry}<span>Try again</span></button>
      </div>`;
  }

  function _sortLessons(list) {
    list.sort(function (a, b) {
      const sa = _normSubject(a.subject), sb = _normSubject(b.subject);
      if (sa < sb) return -1; if (sa > sb) return 1;
      const ta = TERMS.indexOf(a.term), tb = TERMS.indexOf(b.term);
      if (ta !== tb) return ta - tb;
      return (a.order || 0) - (b.order || 0);
    });
    return list;
  }

  /* First paint after data arrives: resolve default term, build controls, render list */
  function _paintLibrary() {
    _sortLessons(_studentLessonsCache);
    if (_libState.term === null) _libState.term = _defaultTerm || '';
    if (_libState.term && !_studentLessonsCache.some(function (l) { return l.term === _libState.term; })) {
      _libState.term = '';                          // default term has no lessons: show everything
    }
    const subjects = _subjectList();
    if (_libState.subject && subjects.indexOf(_libState.subject) === -1) _libState.subject = '';

    const total = _studentLessonsCache.length;
    const done  = _studentLessonsCache.filter(function (l) { const p = _lessonProg(l.id); return p && p.done; }).length;
    const sub = document.getElementById('srlIntroSub');
    if (sub) {
      sub.textContent = total
        ? `${_studentClass} · ${total} lesson${total !== 1 ? 's' : ''}${done ? ' · ' + done + ' completed' : ''}`
        : _studentClass;
    }
    const stat = document.getElementById('srlTopStat');
    if (stat) stat.textContent = total ? `${done}/${total}` : '';
    if (stat) stat.title = total ? `${done} of ${total} lessons completed` : '';

    _renderContinue();
    _renderControls();
    _renderResults();
    const sc = document.getElementById('srlScroll');
    if (sc && _libScroll) { sc.scrollTop = _libScroll; }
  }

  function _subjectList() {
    const seen = {}, out = [];
    _studentLessonsCache.forEach(function (l) {
      const s = (l.subject || '').trim();
      if (s && !seen[_normSubject(s)]) { seen[_normSubject(s)] = 1; out.push(s); }
    });
    return out.sort(function (a, b) { return _normSubject(a) < _normSubject(b) ? -1 : 1; });
  }

  function _renderContinue() {
    const el = document.getElementById('srlContinue');
    if (!el) return;
    const p = _prog();
    const last = p.last && _studentLessonsCache.find(function (l) { return l.id === p.last; });
    if (!last) { el.innerHTML = ''; return; }
    const lp = _lessonProg(last.id) || { p: 0 };
    let target = last, label = 'Continue reading', pct = lp.p || 0;
    if (lp.done) {
      const sibs = _studentLessonsCache.filter(function (l) {
        return _normSubject(l.subject) === _normSubject(last.subject) && l.term === last.term;
      }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      const idx = sibs.findIndex(function (l) { return l.id === last.id; });
      const next = sibs[idx + 1];
      if (next) { target = next; label = 'Up next'; pct = (_lessonProg(next.id) || { p: 0 }).p || 0; }
      else { label = 'Review'; }
    }
    el.innerHTML = `
      <button type="button" class="srl-continue" data-lesson="${_esc(target.id)}">
        <span class="srl-continue__icon">${ICON.book}</span>
        <span class="srl-continue__body">
          <span class="srl-continue__label">${label}</span>
          <span class="srl-continue__title">${_esc(target.title)}</span>
          <span class="srl-continue__meta">${_esc(target.subject || 'General')}${target.term ? ' · ' + _esc(target.term) : ''}${pct > 0 && pct < 95 ? ' · ' + pct + '% read' : ''}</span>
          ${pct > 0 && pct < 95 ? `<span class="srl-bar"><i style="width:${pct}%"></i></span>` : ''}
        </span>
        <span class="srl-continue__go">${ICON.chev}</span>
      </button>`;
  }

  function _renderControls() {
    /* terms */
    const termsEl = document.getElementById('srlTerms');
    if (termsEl) {
      const present = TERMS.filter(function (t) { return _studentLessonsCache.some(function (l) { return l.term === t; }); });
      if (present.length < 2) {
        termsEl.style.display = 'none';
      } else {
        termsEl.style.display = '';
        const opts = [{ v: '', long: 'All terms', short: 'All' }].concat(present.map(function (t) {
          return { v: t, long: t, short: TERM_SHORT[t] || t };
        }));
        termsEl.innerHTML = opts.map(function (o) {
          const on = (_libState.term || '') === o.v;
          return `<button type="button" class="srl-seg__btn${on ? ' is-on' : ''}" data-term="${_esc(o.v)}" aria-pressed="${on}" title="${_esc(o.long)}">
                    <span class="srl-seg__long">${_esc(o.long)}</span><span class="srl-seg__short">${_esc(o.short)}</span>
                  </button>`;
        }).join('');
      }
    }
    /* subjects */
    const subEl = document.getElementById('srlSubjects');
    if (subEl) {
      const subjects = _subjectList();
      if (subjects.length < 2) {
        subEl.style.display = 'none';
      } else {
        subEl.style.display = '';
        const termScoped = _studentLessonsCache.filter(function (l) { return !_libState.term || l.term === _libState.term; });
        const countOf = function (s) { return termScoped.filter(function (l) { return _normSubject(l.subject) === _normSubject(s); }).length; };
        const chips = [{ v: '', label: 'All subjects', n: termScoped.length }].concat(
          subjects.map(function (s) { return { v: s, label: s, n: countOf(s) }; })
        ).filter(function (c) { return c.v === '' || c.n > 0 || c.v === _libState.subject; });
        subEl.innerHTML = chips.map(function (c) {
          const on = _libState.subject === c.v;
          return `<button type="button" class="srl-chip${on ? ' is-on' : ''}" data-subject="${_esc(c.v)}" aria-pressed="${on}">${_esc(c.label)}<em>${c.n}</em></button>`;
        }).join('');
      }
    }
  }

  function _matchesQuery(l, q) {
    if (!q) return true;
    const hay = (l.title + ' ' + (l.topic || '') + ' ' + (l.subject || '')).toLowerCase();
    return q.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
  }

  function _lessonRowHtml(l, idx) {
    const p = _lessonProg(l.id);
    const done = !!(p && p.done);
    const inProg = !done && p && p.p > 2;
    const num = l.order > 0 ? l.order : idx + 1;
    const mins = _readMinutes(_wordCount(l));
    const metaBits = [];
    if (l.topic) metaBits.push(_esc(l.topic));
    metaBits.push(`<span class="srl-lesson__time">${ICON.clock}${mins} min</span>`);
    const status = done ? 'Completed' : inProg ? p.p + '% read' : '';
    return `
      <button type="button" class="srl-lesson${done ? ' is-done' : ''}${inProg ? ' is-prog' : ''}" data-lesson="${_esc(l.id)}"
              aria-label="${_esc(l.title)}${status ? ', ' + status : ''}">
        <span class="srl-lesson__badge">${done ? ICON.check : _esc(String(num))}</span>
        <span class="srl-lesson__body">
          <span class="srl-lesson__title">${_esc(l.title)}</span>
          <span class="srl-lesson__meta">${metaBits.join('<span class="srl-dot">·</span>')}${inProg ? `<span class="srl-dot">·</span><span class="srl-lesson__pct">${p.p}%</span>` : ''}</span>
          ${inProg ? `<span class="srl-bar srl-bar--thin"><i style="width:${p.p}%"></i></span>` : ''}
        </span>
        <span class="srl-lesson__chev">${ICON.chev}</span>
      </button>`;
  }

  function _renderResults() {
    const el = document.getElementById('srlResults');
    if (!el) return;
    if (!_studentLessonsCache.length) {
      el.innerHTML = `
        <div class="srl-state">
          <div class="srl-state__icon">${ICON.book}</div>
          <h3>No lessons yet</h3>
          <p>Your teacher has not published any lessons for ${_esc(_studentClass || 'your class')} yet. Check back soon.</p>
        </div>`;
      return;
    }

    const q = _libState.query;
    let list = _studentLessonsCache.filter(function (l) {
      if (_libState.term && l.term !== _libState.term) return false;
      if (_libState.subject && _normSubject(l.subject) !== _normSubject(_libState.subject)) return false;
      return _matchesQuery(l, q);
    });

    if (!list.length) {
      el.innerHTML = `
        <div class="srl-state">
          <div class="srl-state__icon">${ICON.search}</div>
          <h3>No matching lessons</h3>
          <p>${q ? 'Nothing matches “' + _esc(q) + '”.' : 'There are no lessons for this filter.'}</p>
          <button type="button" class="srl-btn" data-act="reset-filters">Show all lessons</button>
        </div>`;
      return;
    }

    /* group: subject → term → lessons */
    const subjects = {}, order = [];
    list.forEach(function (l) {
      const key = _normSubject(l.subject) || 'general';
      if (!subjects[key]) { subjects[key] = { name: (l.subject || 'General').trim(), terms: {}, count: 0, done: 0 }; order.push(key); }
      const t = l.term || '';
      (subjects[key].terms[t] = subjects[key].terms[t] || []).push(l);
      subjects[key].count++;
      const pr = _lessonProg(l.id); if (pr && pr.done) subjects[key].done++;
    });
    order.sort(function (a, b) { return subjects[a].name.toLowerCase() < subjects[b].name.toLowerCase() ? -1 : 1; });

    /* collapse long libraries once, keep the subject being read open */
    if (!_collapseInit) {
      _collapseInit = true;
      if (list.length > 18 && order.length > 1) {
        const lastId = _prog().last;
        const lastLesson = lastId && _studentLessonsCache.find(function (l) { return l.id === lastId; });
        const keep = lastLesson ? (_normSubject(lastLesson.subject) || 'general') : order[0];
        order.forEach(function (k) { if (k !== keep) _collapsed[k] = true; });
      }
    }

    const showTermHeads = !_libState.term;
    const html = order.map(function (k) {
      const g = subjects[k];
      const isOpen = q ? true : !_collapsed[k];
      const pct = g.count ? Math.round(g.done / g.count * 100) : 0;
      const termKeys = Object.keys(g.terms).sort(function (a, b) { return TERMS.indexOf(a) - TERMS.indexOf(b); });
      const body = termKeys.map(function (t) {
        const ls = g.terms[t].sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
        const head = (showTermHeads && termKeys.length > 0 && t) ? `<div class="srl-termhead">${_esc(t)}</div>` : '';
        return head + ls.map(function (l, i) { return _lessonRowHtml(l, i); }).join('');
      }).join('');
      return `
        <section class="srl-subject${isOpen ? '' : ' is-collapsed'}" data-key="${_esc(k)}">
          <button type="button" class="srl-subject__head" data-toggle="${_esc(k)}" aria-expanded="${isOpen}">
            <span class="srl-subject__name">${_esc(g.name)}</span>
            <span class="srl-subject__count">${g.done > 0 ? g.done + ' of ' + g.count + ' done' : g.count + ' lesson' + (g.count !== 1 ? 's' : '')}</span>
            <span class="srl-subject__caret">${ICON.down}</span>
            ${g.done > 0 ? `<span class="srl-bar srl-bar--head"><i style="width:${pct}%"></i></span>` : ''}
          </button>
          <div class="srl-subject__list">${body}</div>
        </section>`;
    }).join('');

    el.innerHTML = (q ? `<p class="srl-resultcount">${list.length} result${list.length !== 1 ? 's' : ''}</p>` : '') +
                   `<div class="srl-grid">${html}</div>`;
  }

  function _onLibraryClick(e) {
    const t = e.target.closest('[data-lesson],[data-act],[data-term],[data-subject],[data-toggle]');
    if (!t) return;
    if (t.hasAttribute('data-lesson')) {
      const sc = document.getElementById('srlScroll');
      _libScroll = sc ? sc.scrollTop : 0;
      _openLesson(t.getAttribute('data-lesson'));
      return;
    }
    if (t.hasAttribute('data-term')) {
      _libState.term = t.getAttribute('data-term');
      _saveLibPrefs();
      _collapseInit = true;
      _renderControls(); _renderResults();
      return;
    }
    if (t.hasAttribute('data-subject')) {
      _libState.subject = t.getAttribute('data-subject');
      _saveLibPrefs();
      _renderControls(); _renderResults();
      return;
    }
    if (t.hasAttribute('data-toggle')) {
      const k = t.getAttribute('data-toggle');
      _collapsed[k] = !_collapsed[k];
      const sec = t.closest('.srl-subject');
      if (sec) {
        sec.classList.toggle('is-collapsed', !!_collapsed[k]);
        t.setAttribute('aria-expanded', String(!_collapsed[k]));
      }
      return;
    }
    const act = t.getAttribute('data-act');
    if (act === 'exit')          { _closeStudentRoom(); }
    else if (act === 'retry')    { _loadLibraryData(); }
    else if (act === 'clear-search') {
      const s = document.getElementById('srlSearch');
      if (s) { s.value = ''; s.focus(); }
      _libState.query = ''; t.hidden = true;
      _renderResults();
    }
    else if (act === 'reset-filters') {
      _libState.term = ''; _libState.subject = ''; _libState.query = '';
      const s = document.getElementById('srlSearch'); if (s) s.value = '';
      const c = document.querySelector('.srl-search__clear'); if (c) c.hidden = true;
      _saveLibPrefs(); _renderControls(); _renderResults();
    }
  }

  /* Old inline-handler entry point kept for compatibility */
  function _filterLessons() { _renderResults(); }

  /* ═══════════════════════════════════════════════════════
     READER
  ═══════════════════════════════════════════════════════ */

  let _readerHeadings = [];
  let _readerKeyHandler = null;
  let _lastFocus = null;

  function _openLesson(lessonId) {
    _stopReaderSpeech();

    const lesson = _studentLessonsCache.find(function (l) { return l.id === lessonId; });
    if (lesson && !(lesson._meta && !lesson.content)) {
      _openLessonObj(lesson);
      return;
    }
    if (lesson) {
      const row = document.querySelector('.srl-lesson[data-lesson="' + lessonId + '"]');
      if (row) { row.classList.add('is-loading'); row.setAttribute('aria-busy', 'true'); }
      window.fbDb.collection('lessons').doc(lessonId).get()
        .then(function (snap) {
          if (row) { row.classList.remove('is-loading'); row.removeAttribute('aria-busy'); }
          if (!snap.exists) { UI.toast('Lesson not found.', 'error'); return; }
          Object.assign(lesson, snap.data(), { _meta: false });
          _openLessonObj(lesson);
        })
        .catch(function (err) {
          if (row) { row.classList.remove('is-loading'); row.removeAttribute('aria-busy'); }
          console.error('[studyroom] _openLesson error:', err);
          UI.toast('Failed to load lesson. Please check your internet connection and try again.', 'error');
        });
      return;
    }
    window.fbDb.collection('lessons').doc(lessonId).get()
      .then(function (snap) {
        if (!snap.exists) { UI.toast('Lesson not found.', 'error'); return; }
        _openLessonObj(Object.assign({ id: snap.id }, snap.data()), true);
      })
      .catch(function (err) {
        console.error('[studyroom] _openLesson error:', err);
        UI.toast('Failed to load lesson. Please check your internet connection and try again.', 'error');
      });
  }

  function _openLessonObj(lesson, standalone) {
    const siblings = standalone ? [lesson] : _studentLessonsCache
      .filter(function (l) { return _normSubject(l.subject) === _normSubject(lesson.subject) && l.term === lesson.term; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

    const fromLibrary = _view === 'library';
    if (!_previewMode && _roomOpen) {
      if (fromLibrary) _pushNav('reader');
      else { try { history.replaceState({ vtxSr: 'reader' }, ''); } catch (e) { /* ignore */ } }
    }
    _view = 'reader';
    _renderReader(lesson, siblings, { animate: fromLibrary });
  }

  function _renderReader(lesson, siblings, opts) {
    opts = opts || {};
    _currentLesson  = lesson;
    _siblingLessons = siblings;

    const rendered = window.VtxMarkdown
      ? VtxMarkdown.render(lesson.content || '')
      : { html: '<p>' + _esc(lesson.content || '') + '</p>', headings: [], words: 0 };
    _readerHeadings = rendered.headings.filter(function (h) { return h.level >= 2 && h.level <= 3; });

    UI.mount(_buildReaderShell(lesson, siblings, rendered, !!opts.animate));
    _enterRoom();

    const shell = document.getElementById('srShell');
    _applyPrefsToReader(shell);
    _syncPrefsUI();
    _bindScrollProgress(lesson);
    _initScrollHints(document.getElementById('srContent'));
    _renderMathContent(document.getElementById('srContent'));
    _bindQuizButtons(document.getElementById('srContent'));
    _fixContrast(document.getElementById('srContent'));
    setTimeout(function () { _fixContrast(document.getElementById('srContent')); }, 700);
    _bindReaderEvents(shell);
    _bindReaderKeys();
    _wireReaderSpeech(lesson);

    /* sidebar: bring the current lesson into view */
    const sb = document.getElementById('srSidebar');
    const active = sb && sb.querySelector('.is-active');
    if (sb && active) sb.scrollTop = Math.max(0, active.offsetTop - sb.clientHeight / 3);

    _restoreScrollPos(lesson);
  }

  function _restoreScrollPos(lesson) {
    const reader = document.getElementById('srScrollReader');
    if (!reader) return;
    reader.scrollTop = 0;
    const pos = _loadLessonPos(lesson.id);
    if (pos > 240) {
      requestAnimationFrame(function () {
        reader.scrollTop = pos;
        _showSnack('Picked up where you left off', 'Start over', function () {
          reader.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });
    }
  }

  function _showSnack(msg, actionLabel, fn) {
    const shell = document.getElementById('srShell');
    if (!shell) return;
    const old = shell.querySelector('.sr-snack'); if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'sr-snack';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span>${_esc(msg)}</span>${actionLabel ? `<button type="button">${_esc(actionLabel)}</button>` : ''}`;
    shell.appendChild(el);
    const kill = function () { if (el.parentNode) el.remove(); };
    const btn = el.querySelector('button');
    if (btn) btn.addEventListener('click', function () { fn && fn(); kill(); });
    setTimeout(function () { el.classList.add('is-out'); setTimeout(kill, 300); }, 4200);
  }

  /* ── Speech, math, quiz (unchanged behaviour) ── */
    /* ─────────────────────────────────────────────────────── */
  /* Speech integration — Study Room reader                  */
  /* ─────────────────────────────────────────────────────── */

  /*
    Extract plain text from the lesson for TTS.
    Strips HTML tags, collapses whitespace, keeps sentence
    structure intact so the chunker in speech.js works well.
  */
  function _lessonPlainText(lesson) {
    // Start with title + topic as a natural opener
    let text = (lesson.title || '');
    if (lesson.topic) text += '. ' + lesson.topic;
    text += '. ';

    // Render the markdown to HTML, then strip tags
    const rendered = (window.VtxMarkdown ? VtxMarkdown.render(lesson.content || '').html : String(lesson.content || ''))
      .replace(/<(svg|style|script|pre)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g, ' ');
    const stripped = rendered
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/?(h[1-6]|p|li|td|th|blockquote|pre|div)[^>]*>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return text + stripped;
  }

  /*
    STT command handler for the study room.
    Keeps the same voice-command feel as the exam but with
    lesson-navigation commands instead of answer-selection ones.
  */
  function _handleReaderVoiceCommand(transcript) {
    const t = (transcript || '').toLowerCase().trim();
    console.log('[StudyRoom] voice command:', t);

    // Read aloud
    if (/\b(read|listen|read (the )?lesson|speak|read (it )?out)\b/.test(t)) {
      const ttsBtn = document.getElementById('srTtsBtn');
      if (ttsBtn) ttsBtn.click();
      return;
    }

    // Stop reading
    if (/\b(stop( reading| speaking)?|quiet|silence|shut up)\b/.test(t)) {
      if (window.SpeechEngine) SpeechEngine.cancel();
      UI.toast('Stopped reading.', 'info', 1500);
      return;
    }

    // Next lesson
    if (/\b(next( lesson| page)?|forward|move on|continue)\b/.test(t)) {
      const idx = _siblingLessons.findIndex(l => l.id === (_currentLesson && _currentLesson.id));
      if (idx >= 0 && idx < _siblingLessons.length - 1) {
        UI.toast('Going to next lesson…', 'info', 1500);
        _openLesson(_siblingLessons[idx + 1].id);
      } else {
        UI.toast('No next lesson in this subject.', 'info', 2000);
      }
      return;
    }

    // Previous lesson
    if (/\b(previous( lesson| page)?|prev|back|go back)\b/.test(t)) {
      const idx = _siblingLessons.findIndex(l => l.id === (_currentLesson && _currentLesson.id));
      if (idx > 0) {
        UI.toast('Going to previous lesson…', 'info', 1500);
        _openLesson(_siblingLessons[idx - 1].id);
      } else {
        UI.toast('No previous lesson in this subject.', 'info', 2000);
      }
      return;
    }

    // Scroll down
    if (/\b(scroll down|down|page down)\b/.test(t)) {
      const reader = document.getElementById('srScrollReader');
      if (reader) reader.scrollBy({ top: reader.clientHeight * 0.7, behavior: 'smooth' });
      return;
    }

    // Scroll up
    if (/\b(scroll up|up|page up)\b/.test(t)) {
      const reader = document.getElementById('srScrollReader');
      if (reader) reader.scrollBy({ top: -reader.clientHeight * 0.7, behavior: 'smooth' });
      return;
    }

    // Go to top
    if (/\b(top|beginning|start)\b/.test(t)) {
      const reader = document.getElementById('srScrollReader');
      if (reader) reader.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    UI.toast(
      'Not understood: "' + transcript + '". Try: read, stop, next lesson, previous lesson, scroll down, scroll up.',
      'info', 4000
    );
  }

  /*
    Wire the TTS and STT buttons in the reader topbar.
    Called from _renderReader() after the DOM is mounted.
  */
  function _wireReaderSpeech(lesson) {
    if (!window.SpeechEngine) return;

    // ── TTS button ──
    const ttsBtn = document.getElementById('srTtsBtn');
    if (ttsBtn) {
      ttsBtn.addEventListener('click', function () {
        if (SpeechEngine._isTtsActive && SpeechEngine._isTtsActive()) {
          SpeechEngine.cancel();
          return;
        }
        // Check internal state via cancel side-effect approach:
        // We expose a lightweight check via the button's own class.
        if (ttsBtn.classList.contains('sr-se-speaking')) {
          SpeechEngine.cancel();
          return;
        }
        const text = _lessonPlainText(lesson);
        SpeechEngine.speak(text);
        UI.toast('Reading lesson aloud. Say "stop" to stop.', 'info', 2500);
      });

      // Mirror the exam's is-speaking class onto our button via a MutationObserver
      // watching the exam's hidden seTtsBtn state-carrier, OR we track it ourselves.
      // Simpler: poll the exam TTS btn class, but there's no exam TTS btn in the study room.
      // Instead we proxy: wrap speak/cancel to toggle our button class.
      _hookTtsBtnState(ttsBtn);
    }

    // ── STT button ──
    const sttBtn = document.getElementById('srSttBtn');
    if (sttBtn) {
      sttBtn.addEventListener('click', function () {
        // Check if mic is currently on by button state
        if (sttBtn.classList.contains('is-listening')) {
          SpeechEngine.stopSTT();
          UI.toast('Microphone off.', 'info', 1500);
          _setSrSttBtn(false);
          return;
        }

        if (!SpeechEngine.sttSupported) {
          UI.toast('Voice commands are not supported in your browser. Please use Chrome or Edge.', 'warning', 5000);
          return;
        }

        UI.toast('Mic is ON. Say: read, stop, next lesson, previous lesson, scroll down, scroll up.', 'info', 4000);
        _setSrSttBtn(true);

        SpeechEngine.startSTT(
          function (bestTranscript) {
            _handleReaderVoiceCommand(bestTranscript);
          },
          null,
          function (msg) {
            _setSrSttBtn(false);
            UI.toast(msg, 'warning', 5000);
          }
        );
      });
    }
  }

  /*
    Because SpeechEngine's _setTtsBtn() targets #seTtsBtn which doesn't
    exist in the study room, we hook into the speak/cancel cycle by
    watching the SpeechEngine's publicly observable state indirectly.

    Strategy: override nothing in speech.js. Instead, use a small
    requestAnimationFrame loop that checks whether SpeechSynthesis is
    speaking and toggles our button class accordingly.
  */
  function _hookTtsBtnState(ttsBtn) {
    var _rafId = null;

    function _tick() {
      if (!document.getElementById('srTtsBtn')) {
        // Button is gone — reader was closed, stop the loop
        cancelAnimationFrame(_rafId);
        return;
      }
      const speaking = (window.SpeechEngine && SpeechEngine.isSpeaking && SpeechEngine.isSpeaking()) ||
                       (window.speechSynthesis && window.speechSynthesis.speaking);
      ttsBtn.classList.toggle('sr-se-speaking', !!speaking);
      ttsBtn.title = speaking ? 'Stop reading (click to stop)' : 'Read lesson aloud';

      // Also sync the pill data attribute so the blinking dot CSS fires
      const pill = document.getElementById('srSpeechPill');
      if (pill) pill.setAttribute('data-tts-on', speaking ? 'true' : 'false');

      _rafId = requestAnimationFrame(_tick);
    }

    _rafId = requestAnimationFrame(_tick);
  }

  /*
    Set the STT button visual state in the study room.
    Mirrors _setSttBtn in speech.js but targets our #srSttBtn.
  */
  function _setSrSttBtn(listening) {
    const btn  = document.getElementById('srSttBtn');
    const pill = document.getElementById('srSpeechPill');
    if (btn) {
      if (listening) {
        btn.classList.add('is-listening');
        btn.title = 'Mic is ON — tap to stop';
      } else {
        btn.classList.remove('is-listening');
        btn.title = 'Voice commands (tap to start)';
      }
    }
    if (pill) pill.setAttribute('data-mic-on', listening ? 'true' : 'false');
  }

  /*
    Stop all speech when leaving the reader (navigation or back button).
  */
  function _stopReaderSpeech() {
    if (window.SpeechEngine) {
      SpeechEngine.cancel();
      SpeechEngine.stopSTT();
    }
    _setSrSttBtn(false);
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

  /* ── Horizontal scroll hints ─────────────────────────────────
     Wide tables, formulas and code blocks scroll sideways. Each one gets
     a wrapper that fades the edge where more content exists and shows a
     small chevron until the reader scrolls it. */
  const _HINT_SEL = '.sr-table-wrap, .katex-display, pre';
  let _hintRO = null;

  function _hintUpdate(wrap) {
    const el = wrap && wrap.firstElementChild;
    if (!el) return;
    const max  = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft;
    wrap.classList.toggle('has-more-l', max > 4 && left > 4);
    wrap.classList.toggle('has-more-r', max > 4 && left < max - 4);
  }

  function _initScrollHints(root) {
    if (!root) return;
    if (!_hintRO && window.ResizeObserver) {
      _hintRO = new ResizeObserver(function (entries) {
        entries.forEach(function (en) {
          const w = en.target.closest('.sr-scrollhint');
          if (w) _hintUpdate(w);
        });
      });
    }
    root.querySelectorAll(_HINT_SEL).forEach(function (el) {
      if (el.closest('.sr-scrollhint') || el.parentElement.closest('pre')) return;
      const wrap = document.createElement('span');
      wrap.className = 'sr-scrollhint' + (el.classList.contains('katex-display') ? ' sr-scrollhint--math' : '') +
        (el.tagName === 'PRE' ? ' sr-scrollhint--code' : '');
      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(el);
      const cue = document.createElement('span');
      cue.className = 'sr-scrollhint__cue';
      cue.setAttribute('aria-hidden', 'true');
      cue.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
      wrap.appendChild(cue);
      el.addEventListener('scroll', function () {
        if (el.scrollLeft > 8) wrap.classList.add('is-touched');
        _hintUpdate(wrap);
      }, { passive: true });
      if (_hintRO) { _hintRO.observe(el); if (el.firstElementChild) _hintRO.observe(el.firstElementChild); }
      _hintUpdate(wrap);
    });
    root.querySelectorAll('.sr-scrollhint').forEach(_hintUpdate);
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
      _initScrollHints(containerEl);
      setTimeout(function () { _initScrollHints(containerEl); }, 600);
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


  /* ── Reader markup ── */
  function _buildReaderShell(lesson, siblings, rendered, animate) {
    const idx = siblings.findIndex(function (l) { return l.id === lesson.id; });
    const hasLessons = siblings.length > 1;
    const hasOutline = _readerHeadings.length >= 2;
    const hasNav = hasLessons || hasOutline;
    const sub = [lesson.subject, hasLessons && idx >= 0 ? `Lesson ${idx + 1} of ${siblings.length}` : ''].filter(Boolean).join(' · ');
    const mins = _readMinutes(rendered.words || _wordCount(lesson));
    const lp = _lessonProg(lesson.id);

    const speechPillHtml = window.SpeechEngine ? `
      <div class="vtx-speech-pill sr-speech-pill" id="srSpeechPill">
        <button id="srTtsBtn" class="se-tts-btn vtx-speech-btn" title="Read lesson aloud" aria-label="Read lesson aloud">
          <i class="ph ph-speaker-high" style="font-size:16px;"></i><span class="vtx-speech-label">Read</span>
        </button>
        <span class="vtx-speech-div"></span>
        <button id="srSttBtn" class="se-stt-btn vtx-speech-btn" title="Voice commands (tap to start)" aria-label="Start voice command">
          <i class="ph ph-microphone" style="font-size:16px;"></i><span class="vtx-speech-label">Listen</span>
        </button>
      </div>` : '';

    const breadcrumb = [lesson.class, lesson.term, lesson.subject].filter(Boolean)
      .map(function (b) { return `<span>${_esc(b)}</span>`; }).join('<span class="sr-sep" aria-hidden="true">/</span>');

    return `
      <div class="sr-shell sr-reader${animate ? ' sr-animate-in' : ''}${hasNav ? ' has-nav' : ''} sr-bg--${_esc(_prefs.bg)}" id="srShell">
        <div class="sr-progress-bar" aria-hidden="true"><div class="sr-progress-bar__fill" id="srProgressFill" style="width:0%"></div></div>

        <header class="sr-topbar" id="srTopbar">
          <button class="sr-iconbtn sr-topbar__back" type="button" data-sr="back" aria-label="${_previewMode ? 'Exit preview' : 'Back to all lessons'}">
            ${ICON.back}<span class="sr-topbar__backlabel">${_previewMode ? 'Exit preview' : 'Lessons'}</span>
          </button>
          <div class="sr-topbar__titles">
            <span class="sr-topbar__title" title="${_esc(lesson.title)}">${_esc(lesson.title)}</span>
            ${sub ? `<span class="sr-topbar__sub">${_esc(sub)}</span>` : ''}
          </div>
          <div class="sr-topbar__actions">
            ${speechPillHtml}
            ${hasNav ? `<button class="sr-iconbtn sr-iconbtn--sq sr-navbtn" type="button" data-sr="nav" id="srNavBtn" aria-label="Lessons and sections" aria-expanded="false" aria-controls="srSidebar" title="Lessons and sections (T)">${ICON.list}</button>` : ''}
            <button class="sr-iconbtn sr-iconbtn--sq" type="button" data-sr="prefs" id="srPrefsBtn" aria-label="Reading settings" aria-expanded="false" aria-controls="srPrefsPanel" title="Reading settings">${ICON.aa}</button>
          </div>
        </header>

        <div class="sr-layout${hasNav ? '' : ' sr-layout--no-sidebar'}" id="srLayout">
          ${hasNav ? _buildSidebar(lesson, siblings) : ''}
          ${_buildScrollReader(lesson, rendered, breadcrumb, mins, idx, siblings, lp)}
        </div>

        <button class="sr-totop" type="button" data-sr="top" id="srToTop" aria-label="Back to top" hidden>${ICON.up}</button>
        <div class="sr-backdrop" id="srBackdrop" data-sr="close-panels"></div>
        ${_buildPrefsPanel()}
      </div>`;
  }

  function _buildSidebar(lesson, siblings) {
    const heading = [lesson.subject, lesson.term].filter(Boolean).join(' · ');
    const items = siblings.map(function (s, i) {
      const p = _previewMode ? null : _lessonProg(s.id);
      const done = !!(p && p.done);
      const cur = s.id === lesson.id;
      const outline = cur && _readerHeadings.length >= 2 ? `
        <ul class="sr-outline" aria-label="On this page">
          ${_readerHeadings.map(function (h) {
            return `<li><a href="#${_esc(h.id)}" data-sr-jump="${_esc(h.id)}" class="sr-outline__link sr-outline__link--l${h.level}">${_esc(h.text)}</a></li>`;
          }).join('')}
        </ul>` : '';
      return `
        <li class="sr-side__li">
          <button type="button" class="sr-sidebar__item${cur ? ' is-active' : ''}${done ? ' is-done' : ''}" data-sr-lesson="${_esc(s.id)}" ${cur ? 'aria-current="page"' : ''}>
            <span class="sr-sidebar__num">${done ? ICON.check : _esc(String(s.order > 0 ? s.order : i + 1))}</span>
            <span class="sr-sidebar__name" title="${_esc(s.title)}">${_esc(s.title)}</span>
          </button>
          ${outline}
        </li>`;
    }).join('');

    const fallbackOutline = siblings.length <= 1 ? `
      <ul class="sr-outline sr-outline--solo" aria-label="On this page">
        ${_readerHeadings.map(function (h) {
          return `<li><a href="#${_esc(h.id)}" data-sr-jump="${_esc(h.id)}" class="sr-outline__link sr-outline__link--l${h.level}">${_esc(h.text)}</a></li>`;
        }).join('')}
      </ul>` : '';

    return `
      <aside class="sr-sidebar" id="srSidebar" aria-label="Lessons and sections">
        <div class="sr-sidebar__top">
          <div class="sr-sidebar__heading" title="${_esc(heading)}">${_esc(heading || 'On this page')}</div>
          <button class="sr-iconbtn sr-iconbtn--sq sr-sidebar__close" type="button" data-sr="close-panels" aria-label="Close lesson list">${ICON.close}</button>
        </div>
        <ul class="sr-side__list">${siblings.length > 1 ? items : ''}</ul>
        ${fallbackOutline}
      </aside>`;
  }

  function _buildScrollReader(lesson, rendered, breadcrumb, mins, idx, siblings, lp) {
    const prev = idx > 0 ? siblings[idx - 1] : null;
    const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
    const done = !!(lp && lp.done);

    const navCard = function (l, dir) {
      if (!l) return '<span class="sr-endnav__empty"></span>';
      return `<button type="button" class="sr-endnav sr-endnav--${dir}" data-sr-lesson="${_esc(l.id)}">
                <span class="sr-endnav__dir">${dir === 'next' ? 'Next lesson' : 'Previous'}</span>
                <span class="sr-endnav__title">${_esc(l.title)}</span>
              </button>`;
    };

    return `
      <main class="sr-scroll-reader" id="srScrollReader" tabindex="-1">
        <article class="sr-scroll-content" id="srScrollContent">
          <header class="sr-lesson-header">
            <div class="sr-lesson-header__breadcrumb">${breadcrumb}</div>
            <h1 class="sr-lesson-header__title">${_esc(lesson.title)}</h1>
            ${lesson.topic ? `<p class="sr-lesson-header__topic">${_esc(lesson.topic)}</p>` : ''}
            <div class="sr-lesson-header__meta"><span>${ICON.clock}${mins} min read</span>${_previewMode ? '<span class="sr-badge-preview">Preview</span>' : ''}</div>
          </header>

          <div class="sr-content" id="srContent">${rendered.html}</div>

          <footer class="sr-lesson-footer" id="srLessonFooter">
            ${_previewMode ? '' : `
            <div class="sr-finish${done ? ' is-done' : ''}" id="srFinish">
              <span class="sr-finish__icon">${ICON.check}</span>
              <span class="sr-finish__text" id="srFinishText">${done ? 'Lesson completed' : 'Reached the end?'}</span>
              <button type="button" class="srl-btn ${done ? '' : 'srl-btn--primary'}" data-sr="toggle-done" id="srDoneBtn">${done ? 'Mark as not done' : 'Mark as done'}</button>
            </div>`}
            <div class="sr-endnavs">${navCard(prev, 'prev')}${navCard(next, 'next')}</div>
            ${_previewMode ? '' : '<button type="button" class="sr-endback" data-sr="back">Back to all lessons</button>'}
          </footer>
        </article>
      </main>`;
  }

  function _buildPrefsPanel() {
    const fsOpt = function (key, val, label, extraStyle) {
      return `<button type="button" class="sr-pref-btn${_prefs[key] === val ? ' is-active' : ''}" data-pref="${key}" data-val="${val}" aria-pressed="${_prefs[key] === val}"${extraStyle ? ' style="' + extraStyle + '"' : ''}>${label}</button>`;
    };
    const bg = function (key, label) {
      return `<button type="button" class="sr-bg-btn sr-bg-btn--${key}${_prefs.bg === key ? ' is-active' : ''}" data-pref="bg" data-val="${key}" aria-label="${label} background" aria-pressed="${_prefs.bg === key}" title="${label}"></button>`;
    };
    return `
      <section class="sr-prefs-panel" id="srPrefsPanel" role="dialog" aria-modal="false" aria-labelledby="srPrefsTitle">
        <div class="sr-sheet-grab" aria-hidden="true"></div>
        <div class="sr-prefs-panel__title">
          <span id="srPrefsTitle">Reading settings</span>
          <button class="sr-iconbtn sr-iconbtn--sq" type="button" data-sr="close-panels" aria-label="Close settings">${ICON.close}</button>
        </div>

        <div class="sr-prefs-preview" id="srPrefsPreview">The quick brown fox jumps over the lazy dog.</div>

        <div class="sr-prefs-section">
          <span class="sr-prefs-section__label">Text size <b id="srFontSizeLabel">${_prefs.fontSize}px</b></span>
          <div class="sr-stepper">
            <button type="button" class="sr-pref-btn" data-step="fontSize" data-dir="-1" aria-label="Smaller text">A−</button>
            <input type="range" class="sr-pref-slider" id="srFontSize" min="14" max="28" step="1" value="${_prefs.fontSize}" aria-label="Text size" data-pref-range="fontSize">
            <button type="button" class="sr-pref-btn" data-step="fontSize" data-dir="1" aria-label="Larger text">A+</button>
          </div>
        </div>

        <div class="sr-prefs-section">
          <span class="sr-prefs-section__label">Font</span>
          <div class="sr-prefs-row">
            ${fsOpt('fontFamily', 'serif', 'Serif', "font-family:'Lora',Georgia,serif;")}
            ${fsOpt('fontFamily', 'sans', 'Sans')}
            ${fsOpt('fontFamily', 'easy', 'Easy read', "font-family:'Atkinson Hyperlegible',var(--font);")}
          </div>
        </div>

        <div class="sr-prefs-section">
          <span class="sr-prefs-section__label">Line spacing <b id="srLineSpacingLabel">${Number(_prefs.lineSpacing).toFixed(2)}×</b></span>
          <input type="range" class="sr-pref-slider" id="srLineSpacing" min="1.3" max="2.2" step="0.05" value="${_prefs.lineSpacing}" aria-label="Line spacing" data-pref-range="lineSpacing">
        </div>

        <div class="sr-prefs-section sr-prefs-section--width">
          <span class="sr-prefs-section__label">Page width</span>
          <div class="sr-prefs-row">
            ${fsOpt('pageWidth', 540, 'Narrow')}
            ${fsOpt('pageWidth', 680, 'Medium')}
            ${fsOpt('pageWidth', 820, 'Wide')}
          </div>
        </div>

        <div class="sr-prefs-section">
          <span class="sr-prefs-section__label">Background</span>
          <div class="sr-bg-swatch-row">
            ${bg('white', 'Default')}${bg('sepia', 'Sepia')}${bg('warm', 'Warm')}${bg('dark', 'Dark')}${bg('night', 'Night')}
          </div>
        </div>

        <button type="button" class="sr-pref-btn sr-pref-reset" data-sr="reset-prefs">Reset to defaults</button>
      </section>`;
  }

  /* ── Reader events (delegated, one listener per mount) ── */
  function _bindReaderEvents(shell) {
    if (!shell) return;
    shell.addEventListener('click', function (e) {
      const jump = e.target.closest('[data-sr-jump]');
      if (jump) {
        e.preventDefault();
        _scrollToHeading(jump.getAttribute('data-sr-jump'));
        _closePanels();
        return;
      }
      const les = e.target.closest('[data-sr-lesson]');
      if (les) { _openLesson(les.getAttribute('data-sr-lesson')); return; }

      const pref = e.target.closest('[data-pref]');
      if (pref) {
        let v = pref.getAttribute('data-val');
        if (/^\d+$/.test(v)) v = +v;
        _onPrefChange(pref.getAttribute('data-pref'), v);
        return;
      }
      const step = e.target.closest('[data-step]');
      if (step) {
        const k = step.getAttribute('data-step');
        const dir = +step.getAttribute('data-dir');
        _onPrefChange(k, Math.max(14, Math.min(28, (_prefs[k] || 17) + dir)));
        return;
      }
      const act = e.target.closest('[data-sr]');
      if (!act) return;
      switch (act.getAttribute('data-sr')) {
        case 'back':         _backToBrowser(); break;
        case 'nav':          _toggleNav(); break;
        case 'prefs':        _togglePrefs(); break;
        case 'close-panels': _closePanels(); break;
        case 'reset-prefs':  _resetPrefs(); break;
        case 'top': {
          const r = document.getElementById('srScrollReader');
          if (r) r.scrollTo({ top: 0, behavior: 'smooth' });
          break;
        }
        case 'toggle-done': {
          if (!_currentLesson) break;
          const lp = _lessonProg(_currentLesson.id);
          _setDone(_currentLesson.id, !(lp && lp.done));
          _syncFinish();
          _refreshSidebarStatus();
          break;
        }
      }
    });
    shell.addEventListener('input', function (e) {
      const r = e.target.closest('[data-pref-range]');
      if (r) _onPrefChange(r.getAttribute('data-pref-range'), +r.value);
    });
  }

  function _scrollToHeading(id) {
    const reader = document.getElementById('srScrollReader');
    const target = id && document.getElementById(id);
    if (!reader || !target) return;
    const topbar = document.getElementById('srTopbar');
    const offset = (topbar ? topbar.offsetHeight : 0) + 12;
    const y = target.getBoundingClientRect().top - reader.getBoundingClientRect().top + reader.scrollTop - offset + 12;
    reader.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }

  function _syncFinish() {
    const lp = _currentLesson && _lessonProg(_currentLesson.id);
    const done = !!(lp && lp.done);
    const box = document.getElementById('srFinish');
    const txt = document.getElementById('srFinishText');
    const btn = document.getElementById('srDoneBtn');
    if (box) box.classList.toggle('is-done', done);
    if (txt) txt.textContent = done ? 'Lesson completed' : 'Reached the end?';
    if (btn) { btn.textContent = done ? 'Mark as not done' : 'Mark as done'; btn.classList.toggle('srl-btn--primary', !done); }
  }

  function _refreshSidebarStatus() {
    document.querySelectorAll('#srSidebar .sr-sidebar__item').forEach(function (btn) {
      const id = btn.getAttribute('data-sr-lesson');
      const p = _lessonProg(id);
      const done = !!(p && p.done);
      btn.classList.toggle('is-done', done);
      const num = btn.querySelector('.sr-sidebar__num');
      if (!num) return;
      const idx = _siblingLessons.findIndex(function (l) { return l.id === id; });
      const s = _siblingLessons[idx];
      num.innerHTML = done ? ICON.check : _esc(String(s && s.order > 0 ? s.order : idx + 1));
    });
  }

  /* ── Panels (contents drawer + settings sheet) ── */
  function _panelsOpen() {
    const sb = document.getElementById('srSidebar');
    const pp = document.getElementById('srPrefsPanel');
    return (sb && sb.classList.contains('is-open')) || (pp && pp.classList.contains('is-open'));
  }

  function _setBackdrop() {
    const bd = document.getElementById('srBackdrop');
    if (bd) bd.classList.toggle('is-on', !!_panelsOpen());
    const shell = document.getElementById('srShell');
    if (shell) shell.classList.toggle('panel-open', !!_panelsOpen());
  }

  function _toggleNav() {
    const sb = document.getElementById('srSidebar');
    if (!sb) return;
    const open = !sb.classList.contains('is-open');
    const pp = document.getElementById('srPrefsPanel'); if (pp) pp.classList.remove('is-open');
    sb.classList.toggle('is-open', open);
    const btn = document.getElementById('srNavBtn'); if (btn) btn.setAttribute('aria-expanded', String(open));
    const pb = document.getElementById('srPrefsBtn'); if (pb) pb.setAttribute('aria-expanded', 'false');
    _setBackdrop();
    if (open) { _lastFocus = btn; const a = sb.querySelector('.is-active') || sb.querySelector('button'); if (a) a.focus({ preventScroll: true }); }
    else if (btn) btn.focus({ preventScroll: true });
  }

  function _togglePrefs() {
    const panel = document.getElementById('srPrefsPanel');
    if (!panel) return;
    const open = !panel.classList.contains('is-open');
    const sb = document.getElementById('srSidebar'); if (sb) sb.classList.remove('is-open');
    panel.classList.toggle('is-open', open);
    const btn = document.getElementById('srPrefsBtn'); if (btn) btn.setAttribute('aria-expanded', String(open));
    const nb = document.getElementById('srNavBtn'); if (nb) nb.setAttribute('aria-expanded', 'false');
    _setBackdrop();
    if (open) { const f = panel.querySelector('.sr-pref-btn.is-active, input'); if (f) f.focus({ preventScroll: true }); }
    else if (btn) btn.focus({ preventScroll: true });
  }

  function _closePanels() {
    const sb = document.getElementById('srSidebar');
    const pp = document.getElementById('srPrefsPanel');
    const wasOpen = _panelsOpen();
    if (sb) sb.classList.remove('is-open');
    if (pp) pp.classList.remove('is-open');
    ['srNavBtn', 'srPrefsBtn'].forEach(function (id) { const b = document.getElementById(id); if (b) b.setAttribute('aria-expanded', 'false'); });
    _setBackdrop();
    if (wasOpen && _lastFocus && document.body.contains(_lastFocus)) _lastFocus.focus({ preventScroll: true });
  }

  function _bindReaderKeys() {
    _unbindReaderKeys();
    _readerKeyHandler = function (e) {
      if (!document.getElementById('srShell')) return;
      const tag = (e.target && e.target.tagName) || '';
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) && e.target.type !== 'range') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        if (_panelsOpen()) { e.preventDefault(); _closePanels(); }
        return;
      }
      const idx = _siblingLessons.findIndex(function (l) { return _currentLesson && l.id === _currentLesson.id; });
      if (e.key === 'n' && idx >= 0 && idx < _siblingLessons.length - 1) _openLesson(_siblingLessons[idx + 1].id);
      else if (e.key === 'p' && idx > 0) _openLesson(_siblingLessons[idx - 1].id);
      else if (e.key === 't' && document.getElementById('srNavBtn')) _toggleNav();
    };
    document.addEventListener('keydown', _readerKeyHandler);
  }
  function _unbindReaderKeys() {
    if (_readerKeyHandler) { document.removeEventListener('keydown', _readerKeyHandler); _readerKeyHandler = null; }
  }

  /* ── Preferences ── */
  function _onPrefChange(key, value) {
    _prefs[key] = value;
    _savePrefs();
    const shell = document.getElementById('srShell');
    _applyPrefsToReader(shell);
    _syncPrefsUI();
    if (key === 'bg') _fixContrast(document.getElementById('srContent'));
  }

  function _syncPrefsUI() {
    const q = function (id) { return document.getElementById(id); };
    if (q('srFontSize')) q('srFontSize').value = _prefs.fontSize;
    if (q('srFontSizeLabel')) q('srFontSizeLabel').textContent = _prefs.fontSize + 'px';
    if (q('srLineSpacing')) q('srLineSpacing').value = _prefs.lineSpacing;
    if (q('srLineSpacingLabel')) q('srLineSpacingLabel').textContent = Number(_prefs.lineSpacing).toFixed(2) + '×';
    document.querySelectorAll('#srPrefsPanel [data-pref]').forEach(function (btn) {
      const k = btn.getAttribute('data-pref');
      let v = btn.getAttribute('data-val'); if (/^\d+$/.test(v)) v = +v;
      const on = _prefs[k] === v;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
  }

  function _applyPrefsToReader(shell) {
    if (!shell) return;
    shell.style.setProperty('--sr-fs', _prefs.fontSize + 'px');
    shell.style.setProperty('--sr-lh', String(_prefs.lineSpacing));
    shell.style.setProperty('--sr-cpl', String({ 540: 52, 680: 62, 820: 74 }[_prefs.pageWidth] || 62));
    shell.style.setProperty('--sr-font', _fontStack());
    ['white', 'sepia', 'warm', 'dark', 'night'].forEach(function (c) { shell.classList.remove('sr-bg--' + c); });
    shell.classList.add('sr-bg--' + _prefs.bg);
  }

  function _resetPrefs() {
    _prefs = Object.assign({}, DEFAULT_PREFS);
    _savePrefs();
    _applyPrefsToReader(document.getElementById('srShell'));
    _syncPrefsUI();
  }


  /* ── Contrast guard ──────────────────────────────────────────
     Lessons can contain hard-coded colours written for a white page
     (pale boxes, dark green headings). On Dark / Night / Sepia themes
     that gives unreadable text. For every text element we compare its
     colour with the background it really sits on and, if contrast is
     under WCAG AA (4.5:1), nudge the lightness of the text colour
     (keeping its hue) until it is readable. */
  function _parseColor(str) {
    const m = String(str || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
    if (p.length < 3 || p.some(isNaN)) return null;
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  function _lum(c) {
    const f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  function _ratio(a, b) {
    const la = _lum(a), lb = _lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function _rgb2hsl(c) {
    const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function _hsl2rgb(h, s, l) {
    if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const t = function (x) {
      if (x < 0) x += 1; if (x > 1) x -= 1;
      if (x < 1 / 6) return p + (q - p) * 6 * x;
      if (x < 1 / 2) return q;
      if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
      return p;
    };
    return [Math.round(t(h + 1 / 3) * 255), Math.round(t(h) * 255), Math.round(t(h - 1 / 3) * 255)];
  }
  function _over(top, bottom) {
    const a = top[3];
    return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
  }
  /* real background behind an element: composite ancestor layers up to the page */
  function _effectiveBg(el, root, pageBg) {
    const layers = [];
    for (let n = el; n && n !== root.parentNode; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;   // gradient / image: cannot judge
      const c = _parseColor(cs.backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 0.99) break; }
    }
    let base = pageBg;
    for (let i = layers.length - 1; i >= 0; i--) base = _over(layers[i], base);
    return base;
  }

  function _fixContrast(root) {
    if (!root) return;
    const shell = document.getElementById('srShell');
    const pageEl = document.getElementById('srScrollReader') || shell;
    const pageBg = _parseColor(getComputedStyle(pageEl).backgroundColor) || [255, 255, 255, 1];
    if (pageBg[3] < 1) { pageBg[3] = 1; }

    /* undo earlier adjustments (theme may have changed) */
    root.querySelectorAll('[data-sr-fixed]').forEach(function (el) {
      const orig = el.getAttribute('data-sr-fixed');
      if (orig) el.style.setProperty('color', orig); else el.style.removeProperty('color');
      el.removeAttribute('data-sr-fixed');
    });

    const els = root.querySelectorAll('*');
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      const tag = el.tagName.toLowerCase();
      if (tag === 'svg' || el.closest('svg') || tag === 'style' || tag === 'script' || tag === 'img') continue;
      let hasText = false;
      for (let k = 0; k < el.childNodes.length; k++) {
        const nd = el.childNodes[k];
        if (nd.nodeType === 3 && nd.nodeValue.trim()) { hasText = true; break; }
      }
      if (!hasText) continue;
      const cs = getComputedStyle(el);
      const fg = _parseColor(cs.color);
      if (!fg) continue;
      const bg = _effectiveBg(el, root, pageBg);
      if (!bg) continue;
      const fgSolid = fg[3] < 1 ? _over(fg, bg) : fg;
      if (_ratio(fgSolid, bg) >= 4.5) continue;

      /* move lightness away from the background until readable */
      const hsl = _rgb2hsl(fgSolid);
      const bgLight = _lum(bg) > 0.4;
      let best = null;
      const fgLum = _lum(fgSolid);
      if (bgLight && fgLum > 0.4) best = [28, 28, 30];                      // light text on a light box: use dark ink
      else if (!bgLight && fgLum < 0.2 && hsl[1] < 0.2) best = [236, 236, 241]; // grey/black text on a dark box
      for (let step = 0; best === null && step <= 40; step++) {
        const l = bgLight ? Math.max(0.06, hsl[2] - step * 0.025) : Math.min(0.96, hsl[2] + step * 0.025);
        const cand = _hsl2rgb(hsl[0], hsl[1], l);
        if (_ratio(cand, bg) >= 4.5) { best = cand; break; }
      }
      if (!best) best = bgLight ? [20, 20, 24] : [240, 240, 244];
      el.setAttribute('data-sr-fixed', el.style.getPropertyValue('color') || '');
      el.style.setProperty('color', 'rgb(' + best.join(',') + ')', 'important');
    }
  }

  function _fontStack() {
    if (_prefs.fontFamily === 'sans') return 'var(--font)';
    if (_prefs.fontFamily === 'easy') return "'Atkinson Hyperlegible', var(--font)";
    if (_prefs.fontFamily === 'mono') return "'Inconsolata','DM Mono',monospace";
    return "'Lora','Source Serif 4',Georgia,serif";
  }

  /* ── Scroll: progress, outline highlight, auto-hiding top bar ── */
  function _bindScrollProgress(lesson) {
    const reader = document.getElementById('srScrollReader');
    const fill   = document.getElementById('srProgressFill');
    const topbar = document.getElementById('srTopbar');
    const toTop  = document.getElementById('srToTop');
    if (!reader || !fill) return;

    let saveTimer = null, lastY = 0, ticking = false;
    const heads = _readerHeadings.map(function (h) { return { id: h.id, el: document.getElementById(h.id) }; }).filter(function (h) { return h.el; });

    function update() {
      ticking = false;
      const y = reader.scrollTop;
      const scrollable = reader.scrollHeight - reader.clientHeight;
      const pct = scrollable <= 0 ? 100 : y / scrollable * 100;
      fill.style.width = pct.toFixed(1) + '%';

      /* hide the bar while reading downward (phones only; CSS gates this) */
      if (topbar) {
        const speaking = document.getElementById('srSpeechPill') && document.getElementById('srSpeechPill').getAttribute('data-tts-on') === 'true';
        const hide = y > 120 && y > lastY + 6 && !_panelsOpen() && !speaking;
        const show = y < lastY - 6 || y <= 120;
        if (hide) topbar.classList.add('is-hidden');
        else if (show) topbar.classList.remove('is-hidden');
      }
      lastY = y;

      if (toTop) toTop.hidden = y < reader.clientHeight * 1.2;

      /* outline: highlight the section being read */
      if (heads.length) {
        let cur = null;
        const probe = reader.getBoundingClientRect().top + 90;
        for (let i = 0; i < heads.length; i++) {
          if (heads[i].el.getBoundingClientRect().top <= probe) cur = heads[i].id; else break;
        }
        document.querySelectorAll('#srSidebar .sr-outline__link').forEach(function (a) {
          a.classList.toggle('is-current', a.getAttribute('data-sr-jump') === cur);
        });
      }

      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        _saveLessonPos(lesson.id, y);
        if (!_previewMode) {
          _recordProgress(lesson.id, pct);
          const lp = _lessonProg(lesson.id);
          if (lp && lp.done) { _syncFinish(); _refreshSidebarStatus(); }
        }
      }, 400);
    }

    reader.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });

    /* short lessons that fit on one screen count as read after a moment */
    setTimeout(function () {
      if (!document.getElementById('srScrollReader')) return;
      if (reader.scrollHeight - reader.clientHeight <= 40 && !_previewMode) { _recordProgress(lesson.id, 100); _syncFinish(); }
    }, 1500);
  }

  function _backToBrowser() {
    _stopReaderSpeech();
    _unbindReaderKeys();
    _currentLesson  = null;
    _siblingLessons = [];

    if (_previewMode) {
      _previewMode         = false;
      _studentLessonsCache = [];
      _view = '';
      _leaveRoom();
      if (window.Teacher && typeof Teacher.renderTeacherDashboard === 'function') {
        Teacher.renderTeacherDashboard();
        setTimeout(function () {
          if (typeof Teacher.showTab === 'function') Teacher.showTab('studyroom');
        }, 0);
      }
      return;
    }
    if (_histKind() === 'reader') {
      history.back();                   // popstate → _showLibraryFromReader
    } else {
      _showLibraryFromReader();
    }
  }

  function _showLibraryFromReader() {
    _stopReaderSpeech();
    _unbindReaderKeys();
    _currentLesson = null;
    _siblingLessons = [];
    _view = 'library';
    _enterRoom();
    _mountLibrary();
    if (_studentLessonsCache.length) _paintLibrary(); else _loadLibraryData();
  }


  /* ═══════════════════════════════════════════════════════
     TEACHER — lesson management (unchanged)
  ═══════════════════════════════════════════════════════ */

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
                  <select id="srLessonClass" onchange="StudyRoom._populateSubjects()">
                    <option value="">Select class…</option>
                    ${CLASS_OPTIONS.map(c => `<option>${c}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label style="display:block;font-size:.75rem;font-weight:600;
                                color:var(--text-secondary);margin-bottom:.25rem;">Term *</label>
                  <select id="srLessonTerm" onchange="StudyRoom._populateSubjects(true)">
                    <option value="">Select term…</option>
                    ${TERMS.map(t => `<option>${t}</option>`).join('')}
                  </select>
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
                <div>
                  <label style="display:block;font-size:.75rem;font-weight:600;
                                color:var(--text-secondary);margin-bottom:.25rem;">Subject *</label>
                  <select id="srLessonSubject" onchange="StudyRoom._onSubjectChange()">
                    <option value="">Select class first…</option>
                  </select>
                  <input type="text" id="srLessonSubjectNew" placeholder="Type new subject"
                         style="display:none;margin-top:.375rem;width:100%"
                         oninput="StudyRoom._autoFillOrder()" />
                </div>
                <div>
                  <label style="display:block;font-size:.75rem;font-weight:600;
                                color:var(--text-secondary);margin-bottom:.25rem;">Order</label>
                  <input type="number" id="srLessonOrder" placeholder="auto" min="1" style="width:100%"
                         oninput="this.dataset.auto=''" />
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
        _syncLessonIndexes();
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

  function _getSubjectValue() {
    const sel = document.getElementById('srLessonSubject');
    if (!sel) return '';
    if (sel.value === '__new__') {
      return (document.getElementById('srLessonSubjectNew')?.value || '').trim();
    }
    return (sel.value || '').trim();
  }

  function _subjectsForClass(cls) {
    if (!cls) return [];
    const seen = {}, out = [];
    const add = function (n) {
      const t = (n || '').trim(), k = _normSubject(t);
      if (t && !seen[k]) { seen[k] = 1; out.push(t); }
    };
    const bank = window.questions || {};
    Object.keys(bank[cls.replace(/\s+/g, '').toLowerCase()] || {}).forEach(add);
    _teacherLessonsAll.filter(function (l) { return l.class === cls; })
      .forEach(function (l) { add(l.subject); });
    return out.sort(function (a, b) { return _normSubject(a) < _normSubject(b) ? -1 : 1; });
  }

  function _populateSubjects(keep, selectValue) {
    const sel = document.getElementById('srLessonSubject');
    if (!sel) return;
    const cls = document.getElementById('srLessonClass')?.value || '';
    const prev = selectValue != null ? selectValue : (keep ? _getSubjectValue() : '');
    const list = _subjectsForClass(cls);
    if (prev && !list.some(function (s) { return _normSubject(s) === _normSubject(prev); })) list.push(prev);
    sel.innerHTML = cls
      ? '<option value="">Select subject…</option>' +
        list.map(function (s) { return `<option value="${_esc(s)}">${_esc(s)}</option>`; }).join('') +
        '<option value="__new__">+ Add new subject…</option>'
      : '<option value="">Select class first…</option>';
    const match = list.find(function (s) { return _normSubject(s) === _normSubject(prev); });
    sel.value = match || '';
    _onSubjectChange();
  }

  function _onSubjectChange() {
    const sel = document.getElementById('srLessonSubject');
    const inp = document.getElementById('srLessonSubjectNew');
    if (inp) {
      const isNew = sel && sel.value === '__new__';
      inp.style.display = isNew ? '' : 'none';
      if (!isNew) inp.value = '';
      else inp.focus();
    }
    _autoFillOrder();
  }

  function _autoFillOrder() {
    if (_editingId) return;
    const cls     = document.getElementById('srLessonClass')?.value           || '';
    const term    = document.getElementById('srLessonTerm')?.value            || '';
    const subject = _getSubjectValue();
    const orderEl0 = document.getElementById('srLessonOrder');
    if (!cls || !term || !subject) {
      if (orderEl0 && orderEl0.dataset.auto === '1') { orderEl0.value = ''; orderEl0.dataset.auto = ''; }
      return;
    }

    const group = _teacherLessonsAll.filter(
      l => l.class === cls
        && l.term  === term
        && _normSubject(l.subject) === _normSubject(subject)
    );

    const nextOrder = group.length
      ? Math.max(...group.map(l => l.order || 0)) + 1
      : 1;

    const orderEl = document.getElementById('srLessonOrder');
    if (orderEl && (!orderEl.value || orderEl.dataset.auto === '1')) {
      orderEl.value = nextOrder;
      orderEl.dataset.auto = '1';
    }
  }

  async function _saveLesson() {
    const title    = document.getElementById('srLessonTitle')?.value.trim()   || '';
    const cls      = document.getElementById('srLessonClass')?.value           || '';
    const term     = document.getElementById('srLessonTerm')?.value            || '';
    const subject  = _getSubjectValue();
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
    _populateSubjects(false, lesson.subject || '');
    set('srLessonOrder',   lesson.order);
    const _ordEl = document.getElementById('srLessonOrder'); if (_ordEl) _ordEl.dataset.auto = '';
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
    _populateSubjects();
    const _o = document.getElementById('srLessonOrder'); if (_o) _o.dataset.auto = '';
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
      subject: _getSubjectValue(),
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
    _populateSubjects,
    _onSubjectChange,
    _syncLessonIndexes,
    cancelTeacherListeners() {
      if (_teacherLessonsUnsub) { _teacherLessonsUnsub(); _teacherLessonsUnsub = null; }
    },
  };

}());
