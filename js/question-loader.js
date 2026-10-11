/* ============================================================
   js/question-loader.js — Load the question bank from Firestore

   The app already uses Firestore (window.fbDb) for everything else, so the
   question bank is read from there too: no new server, no worker changes.

   Where the data lives
   --------------------
   Collection  questionBank          (one document per class + subject)
   Document id <classKey>__<subject>  e.g.  jss1__English_Studies
   Fields
     classKey   string   e.g. "jss1"  (same keys as data/questions.js)
     subject    string   e.g. "English Studies"
     questions  array    [{ q, opts, ans, exp, svg?, optSvg?, expSvg? }, …]
     active     boolean  optional — set false to hide a document

   Sessions and terms (new)
   ------------------------
   Documents created by the teacher's Questions tab also carry
     session    string  e.g. "2025/2026"
     term       number  1, 2 or 3
     periodKey  string  e.g. "2025-2026__t1"
   and the document id becomes <classKey>__<subject>__<periodKey>.
   Students only get the documents of the ACTIVE period. The active period is
   stored in questionBank/_activePeriod { session, term } (set by the teacher);
   when that document does not exist it is worked out from today's date
   (Sept-Dec = Term 1, Jan-Apr = Term 2, May-Aug = Term 3).
   Old documents with no session/term still work: they are the fallback for
   any period that has no questions of its own for that class + subject.

   Students can also pick another session / term themselves when the teacher allows it
   (questionBank/_activePeriod.freeSelect = { all: true|false, classes: { jss1: true|false } };
   a class value overrides "all"; default is allowed). Their choice only ever offers periods
   that actually have questions for their class, and is re-checked on every screen render.

   Behaviour
   ---------
   - data/questions.js is still loaded and is the fallback. If the backend is
     empty, unreachable, slow (8 s timeout) or blocked by security rules, the
     app silently keeps using the bundled questions.
   - For every class/subject found in the backend, that subject's questions
     REPLACE the bundled ones. Subjects not in the backend stay as bundled.
   - Invalid questions are skipped (and logged); a document with no valid
     questions is ignored.
   - load() never throws and only hits the network once per page load.
   - A broken or missing data/questions.js (e.g. a SyntaxError) must never stop
     anyone from logging in: window.questions is always an object after this file
     runs, and unusable classes / subjects / questions are dropped, not thrown on.
     QuestionLoader.status.bundledOk tells the UI whether the bundle loaded.

   Firestore note: Firestore does not allow arrays inside arrays. If a question
   needs several diagrams for ONE option, store the diagrams as a JSON string:
     diagrams: JSON.stringify({ svg: …, optSvg: […], expSvg: … })
   and it is unpacked here.

   Teacher helper (browser console while logged in as the teacher):
     QuestionLoader.seedFromBundled()   // copies the bundled bank into Firestore
   ============================================================ */
(function () {
  'use strict';

  var COLLECTION = 'questionBank';
  var TIMEOUT_MS = 8000;
  var MAX_DOC_CHARS = 900000;     // Firestore documents are limited to ~1 MiB

  var _promise = null;

  var status = {
    source:    'bundled', // 'bundled' | 'backend'
    bundledOk: true,      // false when data/questions.js failed to load / parse
    docs:      0,         // backend documents applied
    skipped:   0,         // invalid questions skipped
    error:     null,      // last error message, if any
  };

  function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  // Lenient shape check used on the bundled bank. Keeps the ORIGINAL object
  // (unlike cleanQuestion, which rebuilds it) so no extra fields are lost.
  function isUsable(q) {
    if (!isPlainObject(q)) return false;
    if (!Array.isArray(q.opts) || q.opts.length < 2) return false;
    var ans = Number(q.ans);
    if (q.ans == null || q.ans === '' || !isFinite(ans) || ans % 1 !== 0 || ans < 0 || ans >= q.opts.length) return false;
    var hasText = typeof q.q === 'string' && q.q.trim() !== '';
    return hasText || q.svg != null;
  }

  // Returns a safe { classKey: { subject: [questions] } } copy of whatever was loaded.
  // Non-object classes are dropped; non-array subjects are dropped; unusable questions
  // are skipped. A subject whose questions are ALL unusable is kept as an empty array
  // so the home screen can flag it instead of silently hiding it.
  function normalizeBank(raw) {
    var out = {};
    if (!isPlainObject(raw)) return out;
    Object.keys(raw).forEach(function (cls) {
      var subjects = raw[cls];
      if (!isPlainObject(subjects)) return;
      var key = normClass(cls);
      if (!key) return;
      if (!out[key]) out[key] = {};
      Object.keys(subjects).forEach(function (subj) {
        if (!Array.isArray(subjects[subj])) return;
        var good = subjects[subj].filter(isUsable);
        if (good.length !== subjects[subj].length) {
          console.warn('[QuestionLoader] ' + cls + ' / ' + subj + ': skipped ' +
                       (subjects[subj].length - good.length) + ' unusable question(s).');
        }
        out[key][subj] = good;
      });
    });
    return out;
  }

  // Snapshot of the bundled bank (data/questions.js loads before this file).
  // If that file had a SyntaxError, window.questions is undefined here — carry on with
  // an empty bank so the rest of the app (login, chat, tools…) is unaffected.
  var _bundled;
  try {
    status.bundledOk = isPlainObject(window.questions) && Object.keys(window.questions).length > 0;
    if (!status.bundledOk) console.error('[QuestionLoader] data/questions.js did not load (syntax error or empty) — starting with an empty bank.');
    _bundled = normalizeBank(window.questions);
  } catch (e) {
    status.bundledOk = false;
    console.error('[QuestionLoader] could not read the bundled question bank:', e);
    _bundled = {};
  }
  window.questions = _bundled;


  // ── Academic period helpers ────────────────────────────────
  function defaultPeriod(d) {
    d = d || new Date();
    var m = d.getMonth() + 1, y = d.getFullYear();
    var term = (m >= 9) ? 1 : (m <= 4 ? 2 : 3);
    var startYear = (m >= 9) ? y : y - 1;
    return { session: startYear + '/' + (startYear + 1), term: term };
  }
  function normSession(s) {
    var m = String(s == null ? '' : s).match(/^\s*(\d{4})\s*[\/\-]\s*(\d{4})\s*$/);
    if (!m) return '';
    var a = Number(m[1]), b = Number(m[2]);
    return (b === a + 1) ? (a + '/' + b) : '';
  }
  function normTerm(t) {
    var n = parseInt(String(t == null ? '' : t).replace(/[^0-9]/g, ''), 10);
    return (n >= 1 && n <= 3) ? n : 0;
  }
  function periodKey(session, term) {
    var s = normSession(session), t = normTerm(term);
    return (s && t) ? (s.replace('/', '-') + '__t' + t) : '';
  }
  function validPeriod(p) {
    return !!(p && normSession(p.session) && normTerm(p.term));
  }
  var activePeriod = defaultPeriod();
  status.period = activePeriod;
  status.periodSource = 'date';   // 'date' | 'teacher'

  function normClass(k) { return String(k || '').replace(/\s+/g, '').toLowerCase(); }

  function slug(s) { return String(s || '').trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }

  function withTimeout(p, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('timed out after ' + ms + 'ms')); }, ms);
      p.then(function (v) { clearTimeout(t); resolve(v); },
             function (e) { clearTimeout(t); reject(e); });
    });
  }

  // Returns a clean question object, or null when it can't be used.
  function cleanQuestion(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var q = {
      q:    raw.q == null ? '' : String(raw.q),
      opts: Array.isArray(raw.opts) ? raw.opts.map(function (o) { return o == null ? '' : String(o); }) : [],
      ans:  Number(raw.ans),
      exp:  raw.exp == null ? '' : String(raw.exp),
    };

    // Optional diagrams: direct fields, or packed in a JSON string `diagrams`.
    var d = raw;
    if (typeof raw.diagrams === 'string') {
      try { d = JSON.parse(raw.diagrams) || {}; } catch (e) { d = {}; }
    }
    if (d.svg != null && d.svg !== '')        q.svg    = d.svg;
    if (Array.isArray(d.optSvg))              q.optSvg = d.optSvg;
    if (d.expSvg != null && d.expSvg !== '')  q.expSvg = d.expSvg;

    var hasStem = q.q.trim() !== '' || q.svg != null;
    if (!hasStem)                                   return null;
    if (q.opts.length < 2)                          return null;
    if (!isFinite(q.ans) || q.ans % 1 !== 0 || q.ans < 0 || q.ans >= q.opts.length) return null;
    return q;
  }

  // ── Parsed backend documents + student period choice ───────
  var _parsed = [];                       // [{ cls, subj, legacy, key, session, term, questions }]
  var _free   = { all: true, classes: {} };   // who may pick their own session / term
  var SEL_KEY = 'vtx_period_sel';
  var _selected = null;                   // null = live period

  function samePeriod(a, b) { return periodKey(a.session, a.term) === periodKey(b.session, b.term); }

  function ingest(snap) {
    _parsed = []; _free = { all: true, classes: {} };
    activePeriod = defaultPeriod();
    status.periodSource = 'date';
    var skipped = 0;

    snap.forEach(function (doc) {
      try {                                           // one bad document must not discard the rest
        var data = doc.data() || {};
        if (doc.id === '_activePeriod') {
          if (validPeriod(data)) {
            activePeriod = { session: normSession(data.session), term: normTerm(data.term) };
            status.periodSource = 'teacher';
          }
          var fs = data.freeSelect;
          if (fs && typeof fs === 'object') {
            if (typeof fs.all === 'boolean') _free.all = fs.all;
            if (fs.classes && typeof fs.classes === 'object') {
              Object.keys(fs.classes).forEach(function (c) {
                if (typeof fs.classes[c] === 'boolean') _free.classes[normClass(c)] = fs.classes[c];
              });
            }
          }
          return;
        }
        if (String(doc.id).charAt(0) === '_') return; // other settings documents
        if (data.active === false) return;

        var cls  = normClass(data.classKey || String(doc.id).split('__')[0]);
        var subj = typeof data.subject === 'string' ? data.subject.trim() : '';
        if (!cls || !subj || !Array.isArray(data.questions)) return;

        var hasPeriod = data.session != null || data.term != null || data.periodKey;
        var key = '';
        if (hasPeriod) {
          key = data.periodKey || periodKey(data.session, data.term);
          if (!key) return;
        }
        var good = [];
        data.questions.forEach(function (raw) {
          var q = cleanQuestion(raw);
          if (q) good.push(q); else skipped++;
        });
        if (!good.length) return;                     // ignore empty / fully invalid documents

        var m = key.match(/^(\d{4})-(\d{4})__t(\d)$/);
        _parsed.push({ cls: cls, subj: subj, legacy: !hasPeriod, key: key,
                       session: m ? m[1] + '/' + m[2] : '', term: m ? Number(m[3]) : 0, questions: good });
      } catch (docErr) {
        console.warn('[QuestionLoader] skipped bad document \"' + (doc && doc.id) + '\":', docErr);
      }
    });
    status.period  = activePeriod;
    status.skipped = skipped;
  }

  // Builds window.questions for one period.
  //   live period : bundled < old (no session/term) documents < documents of that period
  //   other period: ONLY documents of that exact period (no fallbacks), so a student never
  //                 gets built-in or other-term questions labelled as a different term.
  function rebuild(period) {
    var isLive = samePeriod(period, activePeriod);
    var key = periodKey(period.session, period.term);
    var merged = {}, applied = 0;
    if (isLive) Object.keys(_bundled).forEach(function (cls) { merged[cls] = Object.assign({}, _bundled[cls]); });

    [true, false].forEach(function (legacyPass) {
      _parsed.forEach(function (d) {
        if (legacyPass) { if (!d.legacy || !isLive) return; }
        else if (d.legacy || d.key !== key) return;
        if (!merged[d.cls]) merged[d.cls] = {};
        merged[d.cls][d.subj] = d.questions;
        applied++;
      });
    });

    window.questions = merged;
    _selected = isLive ? null : { session: normSession(period.session), term: normTerm(period.term) };
    status.selected = _selected ? { session: _selected.session, term: _selected.term } : { session: activePeriod.session, term: activePeriod.term };
    if (isLive) {
      status.source = applied > 0 ? 'backend' : 'bundled';
      status.docs   = applied;
      if (!applied) console.info('[QuestionLoader] backend returned no usable questions for ' +
                                 activePeriod.session + ' term ' + activePeriod.term + ' — using bundled bank.');
    }
  }

  function applySnapshot(snap) { ingest(snap); rebuild(activePeriod); }

  // ── Student-facing period choice ───────────────────────────
  function freeSelectAllowed(classKey) {
    var c = normClass(classKey);
    if (c && typeof _free.classes[c] === 'boolean') return _free.classes[c];
    return _free.all !== false;
  }

  // Periods this class can pick: every session/term that has questions for it, plus the live one.
  function periodsFor(classKey) {
    var c = normClass(classKey), seen = {}, out = [];
    function add(session, term, count) {
      var k = periodKey(session, term); if (!k || seen[k]) return;
      seen[k] = 1; out.push({ session: normSession(session), term: normTerm(term), key: k, subjects: count });
    }
    var counts = {};
    _parsed.forEach(function (d) { if (d.cls === c && !d.legacy) counts[d.key] = (counts[d.key] || 0) + 1; });
    _parsed.forEach(function (d) { if (d.cls === c && !d.legacy) add(d.session, d.term, counts[d.key]); });
    add(activePeriod.session, activePeriod.term, counts[periodKey(activePeriod.session, activePeriod.term)] || 0);
    out.sort(function (a, b) { return a.session === b.session ? a.term - b.term : (a.session < b.session ? 1 : -1); });
    return out;
  }

  function readSaved() {
    try {
      var v = JSON.parse(localStorage.getItem(SEL_KEY) || 'null');
      return v && validPeriod(v) ? { session: normSession(v.session), term: normTerm(v.term) } : null;
    } catch (e) { return null; }
  }
  function writeSaved(p) {
    try { if (p) localStorage.setItem(SEL_KEY, JSON.stringify(p)); else localStorage.removeItem(SEL_KEY); } catch (e) {}
  }

  function getSelectedPeriod() {
    return _selected ? { session: _selected.session, term: _selected.term } : { session: activePeriod.session, term: activePeriod.term };
  }

  // Student picks a period. Returns true when applied.
  function selectPeriod(session, term, classKey) {
    var p = { session: normSession(session), term: normTerm(term) };
    if (!validPeriod(p)) return false;
    if (!samePeriod(p, activePeriod)) {
      if (!freeSelectAllowed(classKey)) return false;
      var ok = periodsFor(classKey).some(function (x) { return x.key === periodKey(p.session, p.term); });
      if (!ok) return false;
    }
    writeSaved(samePeriod(p, activePeriod) ? null : p);
    rebuild(p);
    return true;
  }

  // Called before the student's exam screen is built and before an exam starts:
  // keeps the saved choice only if it is still allowed and still has questions,
  // otherwise the live period is used.
  function applyForClass(classKey) {
    var want = readSaved();
    var target = activePeriod;
    if (want && !samePeriod(want, activePeriod) && freeSelectAllowed(classKey) &&
        periodsFor(classKey).some(function (x) { return x.key === periodKey(want.session, want.term); })) {
      target = want;
    } else if (want) {
      writeSaved(null);
    }
    var cur = getSelectedPeriod();
    if (!samePeriod(cur, target) || !window.questions || !Object.keys(window.questions).length) rebuild(target);
    return getSelectedPeriod();
  }

  function getFreeSelect() { return JSON.parse(JSON.stringify(_free)); }

  function load(opts) {
    if (_promise && !(opts && opts.force)) return _promise;

    _promise = (async function () {
      try {
        if (!window.fbDb) throw new Error('Firestore not ready');
        var snap = await withTimeout(window.fbDb.collection(COLLECTION).get(), TIMEOUT_MS);
        if (!snap || snap.empty) {
          console.info('[QuestionLoader] "' + COLLECTION + '" is empty — using bundled bank.');
        } else {
          applySnapshot(snap);
        }
        status.error = null;
      } catch (err) {
        status.error = (err && err.message) || String(err);
        console.warn('[QuestionLoader] could not load from backend, using bundled bank:', status.error);
      }
      return status;
    })();

    return _promise;
  }

  // Teacher-only helper: copy the bundled bank into Firestore (one document per class+subject).
  async function seedFromBundled() {
    if (!window.AppState || !window.AppState.isTeacher) throw new Error('Teacher login required.');
    var db = window.fbDb;
    var batch = db.batch(), n = 0, writes = 0, tooBig = [];

    Object.keys(_bundled).forEach(function (cls) {
      Object.keys(_bundled[cls]).forEach(function (subject) {
        var questions = JSON.parse(JSON.stringify(_bundled[cls][subject]));   // strips undefined
        if (JSON.stringify(questions).length > MAX_DOC_CHARS) { tooBig.push(cls + '/' + subject); return; }
        var ref = db.collection(COLLECTION).doc(cls + '__' + slug(subject));
        batch.set(ref, {
          classKey: cls, subject: subject, questions: questions, active: true,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        n++;
      });
    });

    if (n > 500) throw new Error('Too many documents for one batch (' + n + ').');
    if (n) { await batch.commit(); writes = n; }
    console.info('[QuestionLoader] seeded ' + writes + ' documents.' +
                 (tooBig.length ? ' Too large to store as one document: ' + tooBig.join(', ') : ''));
    return { written: writes, tooLarge: tooBig };
  }

  window.QuestionLoader = {
    load: load, status: status, seedFromBundled: seedFromBundled,
    COLLECTION: COLLECTION, MAX_DOC_CHARS: MAX_DOC_CHARS,
    getBundled: function () { return _bundled; },
    getActivePeriod: function () { return { session: activePeriod.session, term: activePeriod.term }; },
    getSelectedPeriod: getSelectedPeriod, selectPeriod: selectPeriod, applyForClass: applyForClass,
    periodsFor: periodsFor, freeSelectAllowed: freeSelectAllowed, getFreeSelect: getFreeSelect,
    defaultPeriod: defaultPeriod, normSession: normSession, normTerm: normTerm,
    periodKey: periodKey, normClass: normClass, slug: slug,
    _cleanQuestion: cleanQuestion, _normalizeBank: normalizeBank
  };
})();
