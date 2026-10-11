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

  function applySnapshot(snap) {
    // Start from a copy of the bundled bank so the original is never mutated.
    var merged = {};
    Object.keys(_bundled).forEach(function (cls) { merged[cls] = Object.assign({}, _bundled[cls]); });

    // 1) the teacher's chosen active period (falls back to the date-based default)
    activePeriod = defaultPeriod();
    status.periodSource = 'date';
    snap.forEach(function (doc) {
      if (doc.id !== '_activePeriod') return;
      var d = doc.data() || {};
      if (validPeriod(d)) {
        activePeriod = { session: normSession(d.session), term: normTerm(d.term) };
        status.periodSource = 'teacher';
      }
    });
    status.period = activePeriod;
    var activeKey = periodKey(activePeriod.session, activePeriod.term);

    var legacy = {}, current = {};          // legacy[cls][subj], current[cls][subj]
    var applied = 0, skipped = 0;
    snap.forEach(function (doc) {
      try {                                           // one bad document must not discard the rest
        if (String(doc.id).charAt(0) === '_') return; // settings documents
        var data = doc.data() || {};
        if (data.active === false) return;

        var cls  = normClass(data.classKey || String(doc.id).split('__')[0]);
        var subj = typeof data.subject === 'string' ? data.subject.trim() : '';
        if (!cls || !subj || !Array.isArray(data.questions)) return;

        var hasPeriod = data.session != null || data.term != null || data.periodKey;
        var bucket = legacy;
        if (hasPeriod) {
          var k = data.periodKey || periodKey(data.session, data.term);
          if (!k || k !== activeKey) return;          // belongs to another session / term
          bucket = current;
        }

        var good = [];
        data.questions.forEach(function (raw) {
          var q = cleanQuestion(raw);
          if (q) good.push(q); else skipped++;
        });
        if (!good.length) return;                     // ignore empty / fully invalid documents

        if (!bucket[cls]) bucket[cls] = {};
        bucket[cls][subj] = good;
      } catch (docErr) {
        console.warn('[QuestionLoader] skipped bad document \"' + (doc && doc.id) + '\":', docErr);
      }
    });

    // 2) bundled < legacy backend docs < documents of the active session/term
    [legacy, current].forEach(function (src) {
      Object.keys(src).forEach(function (cls) {
        Object.keys(src[cls]).forEach(function (subj) {
          if (!merged[cls]) merged[cls] = {};
          merged[cls][subj] = src[cls][subj];
          applied++;
        });
      });
    });

    status.skipped = skipped;
    if (applied > 0) {
      window.questions = merged;
      status.source = 'backend';
      status.docs   = applied;
    } else {
      console.info('[QuestionLoader] backend returned no usable questions for ' +
                   activePeriod.session + ' term ' + activePeriod.term + ' — using bundled bank.');
    }
  }

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
    defaultPeriod: defaultPeriod, normSession: normSession, normTerm: normTerm,
    periodKey: periodKey, normClass: normClass, slug: slug,
    _cleanQuestion: cleanQuestion, _normalizeBank: normalizeBank
  };
})();
