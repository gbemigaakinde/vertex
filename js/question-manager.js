/* ============================================================
   js/question-manager.js — Teacher "Questions" tab

   Lets the teacher create / edit / delete / reorder questions, set
   options and the correct answer, paste SVG diagrams, and bulk-import
   questions from JSON, per CLASS, per SUBJECT, per SESSION and per TERM.

   Storage (see question-loader.js for how students read it):
     questionBank/<classKey>__<subjectSlug>__<2025-2026>__t<1|2|3>
       { classKey, subject, session, term, periodKey, questions[], active, updatedAt }
     questionBank/_activePeriod  { session, term }   <- what students get

   Public API:  QuestionManager.render(containerId)
   ============================================================ */
(function () {
  'use strict';

  var QL = window.QuestionLoader;
  var LS_KEY = 'vtx_qm_last';
  var MAX_OPTS = 6, MIN_OPTS = 2;
  var LETTERS = 'ABCDEF';

  var S = {
    root: null, cls: '', subject: '', session: '', term: 1,
    extraSessions: [], extraClasses: [], extraSubjects: {},
    classDocs: [],          // every questionBank doc of the selected class (all periods)
    questions: [],          // questions of the selected class/subject/session/term
    docExists: false,
    form: null,             // { index: -1|n, q, opts[], optSvg[], ans, exp, svg, expSvg }
    filter: '',
    busy: false, bulkOpen: false, freeOpen: false,
    bulk: null,             // { groups, report }
    loadToken: 0,
  };

  /* ───────── tiny helpers ───────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function db() { return window.fbDb; }
  function toast(msg, type, ms) {
    if (window.UI && UI.toast) UI.toast(msg, type || 'info', ms); else console.log('[QM]', msg);
  }
  function isTeacher() { return !!(window.AppState && window.AppState.isTeacher); }
  function $(sel) { return S.root ? S.root.querySelector(sel) : null; }

  function lastUsed() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function remember() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ cls: S.cls, subject: S.subject })); } catch (e) {}
  }

  function docId(cls, subject, session, term) {
    return cls + '__' + QL.slug(subject) + '__' + QL.periodKey(session, term);
  }
  function periodLabel(session, term) { return session + ' · Term ' + term; }

  /* ───────── option lists (prepopulated) ───────── */
  function sessionOptions() {
    var act = QL.getActivePeriod();
    var start = parseInt(act.session, 10);
    var set = {};
    for (var y = start - 3; y <= start + 1; y++) set[y + '/' + (y + 1)] = 1;
    S.extraSessions.forEach(function (s) { set[s] = 1; });
    S.classDocs.forEach(function (d) { if (QL.normSession(d.session)) set[QL.normSession(d.session)] = 1; });
    set[S.session] = 1;
    return Object.keys(set).sort().reverse();
  }
  function classOptions() {
    var set = {};
    [QL.getBundled(), window.questions || {}].forEach(function (b) {
      Object.keys(b || {}).forEach(function (k) { set[k] = 1; });
    });
    S.extraClasses.forEach(function (k) { set[k] = 1; });
    if (S.cls) set[S.cls] = 1;
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
  }
  // Built-in subjects the teacher deleted for a class are hidden (see QuestionLoader.getHiddenSubjects).
  function hiddenFor(cls) {
    var all = QL.getHiddenSubjects ? QL.getHiddenSubjects() : {};
    return all[cls] || [];
  }
  function visibleBundled(cls) {
    var b = (QL.getBundled() || {})[cls] || {}, hid = hiddenFor(cls), out = {};
    Object.keys(b).forEach(function (k) { if (hid.indexOf(k) < 0) out[k] = b[k]; });
    return out;
  }
  function isBuiltIn(cls, subject) {
    return Object.prototype.hasOwnProperty.call(visibleBundled(cls), subject);
  }
  function subjectOptions() {
    var set = {};
    Object.keys(visibleBundled(S.cls)).forEach(function (k) { set[k] = 1; });
    Object.keys((window.questions || {})[S.cls] || {}).forEach(function (k) { set[k] = 1; });
    S.classDocs.forEach(function (d) { if (d.subject) set[d.subject] = 1; });
    (S.extraSubjects[S.cls] || []).forEach(function (k) { set[k] = 1; });
    if (S.subject) set[S.subject] = 1;
    return Object.keys(set).sort();
  }

  /* ───────── question normalising / validation ───────── */
  function joinSvg(v) { return Array.isArray(v) ? v.join('\n') : (v == null ? '' : String(v)); }

  function splitSvg(text) {
    text = String(text || '').trim();
    if (!text) return { value: null };
    if (!/<svg[\s>]/i.test(text)) return { error: 'SVG code must start with <svg …>.' };
    var parts = text.split(/(?=<svg[\s>])/i).map(function (p) { return p.trim(); }).filter(Boolean);
    for (var i = 0; i < parts.length; i++) {
      if (!/<\/svg>\s*$/i.test(parts[i])) return { error: 'SVG ' + (i + 1) + ' is missing its closing </svg>.' };
      if (window.SvgDiagram) {
        var r = SvgDiagram.sanitize(parts[i]);
        if (!r.ok) return { error: 'SVG ' + (i + 1) + ' cannot be shown: ' + r.reason };
      }
    }
    return { value: parts.length > 1 ? parts : parts[0] };
  }

  // Accepts the app format and common alternatives (options/answer/explanation, letter or text answers).
  function coerceQuestion(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'not an object' };
    var q = raw.q != null ? raw.q : (raw.question != null ? raw.question : raw.text);
    var opts = Array.isArray(raw.opts) ? raw.opts : (Array.isArray(raw.options) ? raw.options : null);
    var exp = raw.exp != null ? raw.exp : (raw.explanation != null ? raw.explanation : '');
    var ansRaw = raw.ans != null ? raw.ans : (raw.answer != null ? raw.answer : raw.correct);
    var out = {
      q: q == null ? '' : String(q).trim(),
      opts: opts ? opts.map(function (o) { return o == null ? '' : String(o).trim(); }) : [],
      exp: exp == null ? '' : String(exp).trim(),
    };
    var d = raw;
    if (typeof raw.diagrams === 'string') { try { d = JSON.parse(raw.diagrams) || {}; } catch (e) { d = {}; } }
    if (d.svg != null && d.svg !== '') out.svg = d.svg;
    if (d.expSvg != null && d.expSvg !== '') out.expSvg = d.expSvg;
    if (typeof raw.noShuffle === 'boolean') out.noShuffle = raw.noShuffle;
    else if (raw.noShuffle === 'true' || raw.noShuffle === 'false') out.noShuffle = raw.noShuffle === 'true';
    if (Array.isArray(d.optSvg)) out.optSvg = d.optSvg.map(function (x) { return x == null ? '' : x; });

    if (out.opts.length < MIN_OPTS) return { error: 'needs at least ' + MIN_OPTS + ' options' };
    if (out.opts.length > MAX_OPTS) return { error: 'has more than ' + MAX_OPTS + ' options' };
    if (out.opts.some(function (o, i) { return o === '' && !(out.optSvg && out.optSvg[i]); })) return { error: 'has an empty option' };
    if (!out.q && !out.svg) return { error: 'has no question text' };

    var ans = -1;
    if (typeof ansRaw === 'number' || (typeof ansRaw === 'string' && /^\d+$/.test(ansRaw.trim()))) {
      ans = Number(ansRaw);                                   // 0-based, same as data/questions.js
    } else if (typeof ansRaw === 'string') {
      var t = ansRaw.trim();
      if (/^[A-Fa-f]$/.test(t)) ans = LETTERS.indexOf(t.toUpperCase());
      else ans = out.opts.findIndex(function (o) { return o.toLowerCase() === t.toLowerCase(); });
    }
    if (ans < 0 || ans >= out.opts.length || ans % 1 !== 0) return { error: 'correct answer is missing or does not match an option' };
    out.ans = ans;

    // validate svg
    var bad = null;
    ['svg', 'expSvg'].forEach(function (k) {
      if (out[k] == null || bad) return;
      var r = splitSvg(joinSvg(out[k]));
      if (r.error) bad = k + ': ' + r.error; else if (r.value == null) delete out[k]; else out[k] = r.value;
    });
    if (!bad && out.optSvg) {
      out.optSvg = out.optSvg.slice(0, out.opts.length);
      while (out.optSvg.length < out.opts.length) out.optSvg.push('');
      for (var i = 0; i < out.optSvg.length && !bad; i++) {
        if (Array.isArray(out.optSvg[i])) { bad = 'optSvg ' + (i + 1) + ': only one diagram per option'; break; }
        var r2 = splitSvg(out.optSvg[i]);
        if (r2.error) bad = 'optSvg ' + (i + 1) + ': ' + r2.error;
        else if (Array.isArray(r2.value)) bad = 'optSvg ' + (i + 1) + ': only one diagram per option';
        else out.optSvg[i] = r2.value || '';
      }
      if (!bad && !out.optSvg.some(Boolean)) delete out.optSvg;
    }
    if (bad) return { error: bad };
    return { q: out };
  }

  function dupKey(q) { return (q.q || '').toLowerCase().replace(/\s+/g, ' ') + '|' + q.opts.join('|').toLowerCase(); }

  /* ───────── Firestore I/O ───────── */
  async function fetchClassDocs() {
    S.classDocs = [];
    if (!S.cls) return;
    try {
      var snap = await db().collection(QL.COLLECTION).where('classKey', '==', S.cls).get();
      snap.forEach(function (d) { var x = d.data() || {}; x._id = d.id; S.classDocs.push(x); });
    } catch (e) { console.warn('[QM] could not list class documents:', e); }
  }

  async function loadQuestions() {
    var token = ++S.loadToken;
    S.questions = []; S.docExists = false;
    if (!S.cls || !S.subject) return;
    try {
      var snap = await db().collection(QL.COLLECTION).doc(docId(S.cls, S.subject, S.session, S.term)).get();
      if (token !== S.loadToken) return;                       // a newer selection superseded this one
      if (snap.exists && Array.isArray((snap.data() || {}).questions)) {
        S.docExists = true;
        S.questions = snap.data().questions.map(function (raw) {
          var r = coerceQuestion(raw);
          return r.q || { q: String((raw && raw.q) || ''), opts: (raw && raw.opts) || [], ans: Number(raw && raw.ans) || 0, exp: String((raw && raw.exp) || ''), _broken: true };
        });
      }
    } catch (e) {
      toast('Could not load questions: ' + (e.message || e), 'error', 6000);
    }
  }

  async function saveQuestions(list, label) {
    if (!isTeacher()) { toast('Teacher login required.', 'error'); return false; }
    if (!S.cls || !S.subject) { toast('Choose a class and subject first.', 'warning'); return false; }
    var clean = JSON.parse(JSON.stringify(list.map(function (q) { var c = Object.assign({}, q); delete c._broken; return c; })));
    if (JSON.stringify(clean).length > QL.MAX_DOC_CHARS) {
      toast('Too many / too large questions for one subject and term (limit about 900 KB). Remove some SVGs or split the subject.', 'error', 8000);
      return false;
    }
    S.busy = true; draw();
    try {
      var ref = db().collection(QL.COLLECTION).doc(docId(S.cls, S.subject, S.session, S.term));
      if (!clean.length) {
        await ref.delete();
        S.docExists = false;
      } else {
        await ref.set({
          classKey: S.cls, subject: S.subject, session: S.session, term: S.term,
          periodKey: QL.periodKey(S.session, S.term), questions: clean, active: true,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        S.docExists = true;
      }
      S.questions = list;
      toast(label || 'Saved.', 'success');
      remember();
      await fetchClassDocs();
      QL.load({ force: true });                                // keep the teacher's own copy fresh
      return true;
    } catch (e) {
      toast('Save failed: ' + (e.message || e) + (/permission/i.test(String(e.message)) ? ' (check Firestore rules for questionBank).' : ''), 'error', 8000);
      return false;
    } finally { S.busy = false; draw(); }
  }

  // Read-modify-write of questionBank/_activePeriod so the live period and the
  // student-choice settings never overwrite each other.
  async function writeSettings(mutator) {
    var ref = db().collection(QL.COLLECTION).doc('_activePeriod');
    var snap = await ref.get();
    var data = snap.exists ? (snap.data() || {}) : {};
    mutator(data);
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await ref.set(data);
    return data;
  }

  // Hide / un-hide a built-in (data/questions.js) subject for one class. Saved in
  // questionBank/_activePeriod.hiddenSubjects so students stop receiving it too.
  async function setHidden(cls, subject, hide) {
    var data = await writeSettings(function (d) {
      var h = d.hiddenSubjects && typeof d.hiddenSubjects === 'object' && !Array.isArray(d.hiddenSubjects) ? d.hiddenSubjects : {};
      var list = Array.isArray(h[cls]) ? h[cls].filter(function (s) { return s !== subject; }) : [];
      if (hide) list.push(subject);
      if (list.length) h[cls] = list; else delete h[cls];
      d.hiddenSubjects = h;
    });
    QL.setHiddenSubjects(data.hiddenSubjects);
  }

  /* ───────── subject: rename / delete (selected class only) ───────── */
  function subjectDocs(cls, subject) {
    return S.classDocs.filter(function (d) { return typeof d.subject === 'string' && d.subject.trim() === subject; });
  }
  function isLegacyDoc(d) { return d.session == null && d.term == null && !d.periodKey; }
  function docKey(d) { return d.periodKey || QL.periodKey(d.session, d.term) || ''; }

  async function deleteSubject() {
    if (!isTeacher()) { toast('Teacher login required.', 'error'); return; }
    if (!S.cls || !S.subject) return;
    var cls = S.cls, subj = S.subject;
    await fetchClassDocs();
    var docs = subjectDocs(cls, subj), builtIn = isBuiltIn(cls, subj);
    var total = docs.reduce(function (n, d) { return n + (Array.isArray(d.questions) ? d.questions.length : 0); }, 0);
    var msg = 'Delete the subject "' + subj + '" for ' + cls.toUpperCase() + ' only?\n\n' +
      (docs.length ? total + ' saved question' + (total === 1 ? '' : 's') + ' across ' + docs.length + ' session/term' + (docs.length === 1 ? '' : 's') + ' will be permanently deleted.' : 'It has no saved questions.') +
      (builtIn ? '\nIts built-in default questions will also be removed for this class.' : '') +
      '\n\nOther classes are not affected. Students will no longer see this subject. Saved questions cannot be recovered.';
    if (!window.confirm(msg)) return;

    S.form = null; S.bulk = null; S.busy = true; draw();
    try {
      var col = db().collection(QL.COLLECTION);
      for (var i = 0; i < docs.length; i += 400) {
        var batch = db().batch();
        docs.slice(i, i + 400).forEach(function (d) { batch.delete(col.doc(d._id)); });
        await batch.commit();
      }
      if (builtIn) await setHidden(cls, subj, true);
      if (S.extraSubjects[cls]) S.extraSubjects[cls] = S.extraSubjects[cls].filter(function (x) { return x !== subj; });
      if (window.questions && window.questions[cls]) delete window.questions[cls][subj];
      S.subject = '';
      toast('Subject "' + subj + '" deleted for ' + cls.toUpperCase() + '.', 'success', 5000);
    } catch (e) {
      toast('Could not delete subject: ' + (e.message || e) + (/permission/i.test(String(e.message)) ? ' (check Firestore rules for questionBank).' : ''), 'error', 8000);
    } finally { S.busy = false; }
    await fetchClassDocs();
    if (!S.subject && subjectOptions().indexOf(subj) < 0) S.subject = subjectOptions()[0] || '';
    else if (!S.subject) S.subject = subj;                      // delete failed: stay on the same subject
    await loadQuestions(); remember(); draw();
    QL.load({ force: true });
  }

  async function renameSubject() {
    if (!isTeacher()) { toast('Teacher login required.', 'error'); return; }
    var inp = $('#qmNewVal'); var v = inp ? inp.value.trim().replace(/\s+/g, ' ') : '';
    var cls = S.cls, old = S.subject;
    if (!cls || !old) return;
    if (!v) { toast('Type the new subject name first.', 'warning'); return; }
    if (v === old) { var nr0 = $('#qmNewRow'); if (nr0) nr0.innerHTML = ''; return; }
    if (v.length > 60 || /[\/\\]/.test(v) || !QL.slug(v)) { toast('Subject names must be 1-60 characters, include a letter or number, and not contain / or \\.', 'warning', 6000); return; }
    var clash = subjectOptions().some(function (x) { return x !== old && (x.toLowerCase() === v.toLowerCase() || QL.slug(x) === QL.slug(v)); });
    if (clash) { toast('"' + v + '" already exists for ' + cls.toUpperCase() + '. Choose a different name.', 'warning', 6000); return; }
    if (S.form && !window.confirm('Discard the question you are editing?')) return;

    await fetchClassDocs();
    var docs = subjectDocs(cls, old), builtIn = isBuiltIn(cls, old);
    var live = QL.getActivePeriod(), liveKey = QL.periodKey(live.session, live.term);
    // Students get built-in questions only while no saved document overrides them in the live period.
    // Renaming a built-in subject therefore copies its built-in bank into the live period under the new name.
    var overridesLive = docs.some(function (d) {
      if (d.active === false || !Array.isArray(d.questions) || !d.questions.some(function (r) { return QL._cleanQuestion(r); })) return false;
      return isLegacyDoc(d) || docKey(d) === liveKey;
    });
    var bundledQs = null;
    if (builtIn && !overridesLive) {
      bundledQs = JSON.parse(JSON.stringify(visibleBundled(cls)[old] || []));
      if (!bundledQs.length) bundledQs = null;
      else if (JSON.stringify(bundledQs).length > QL.MAX_DOC_CHARS) {
        toast('The built-in questions for this subject are too large to move under a new name. Add a new subject and import them instead.', 'error', 8000);
        return;
      }
    }

    S.form = null; S.bulk = null; S.busy = true; draw();
    try {
      var col = db().collection(QL.COLLECTION), ts = firebase.firestore.FieldValue.serverTimestamp();
      var slugNew = QL.slug(v);
      for (var i = 0; i < docs.length; i += 200) {
        var batch = db().batch();
        docs.slice(i, i + 200).forEach(function (d) {
          var data = {};
          Object.keys(d).forEach(function (k) { if (k !== '_id') data[k] = d[k]; });
          data.subject = v; data.updatedAt = ts;
          var key = isLegacyDoc(d) ? '' : docKey(d);
          var newId = cls + '__' + slugNew + (key ? '__' + key : '');
          batch.set(col.doc(newId), data);
          if (newId !== d._id) batch.delete(col.doc(d._id));
        });
        await batch.commit();
      }
      if (bundledQs) {
        await col.doc(cls + '__' + slugNew + '__' + liveKey).set({
          classKey: cls, subject: v, session: live.session, term: live.term, periodKey: liveKey,
          questions: bundledQs, active: true, updatedAt: ts,
        });
      }
      if (builtIn) await setHidden(cls, old, true);
      if (S.extraSubjects[cls]) S.extraSubjects[cls] = S.extraSubjects[cls].map(function (x) { return x === old ? v : x; });
      if (window.questions && window.questions[cls]) delete window.questions[cls][old];
      S.subject = v; S.filter = '';
      toast('Subject renamed to "' + v + '" for ' + cls.toUpperCase() + '.', 'success', 5000);
    } catch (e) {
      toast('Could not rename subject: ' + (e.message || e) + (/permission/i.test(String(e.message)) ? ' (check Firestore rules for questionBank).' : ''), 'error', 8000);
    } finally { S.busy = false; }
    await fetchClassDocs();
    await loadQuestions(); remember(); draw();
    QL.load({ force: true });
  }

  function showRenameRow() {
    var row = $('#qmNewRow'); if (!row || !S.subject) return;
    row.innerHTML = '<div class="qm-field"><label for="qmNewVal">Rename "' + esc(S.subject) + '" (' + esc(S.cls.toUpperCase()) + ' only)</label>' +
      '<input type="text" id="qmNewVal" maxlength="60" value="' + esc(S.subject) + '" /></div>' +
      '<button class="qm-btn qm-primary" data-act="saverename">Save name</button><button class="qm-btn" data-act="cancelnew">Cancel</button>';
    var inp = $('#qmNewVal'); if (inp) { inp.focus(); inp.select(); }
  }

  async function setLivePeriod() {
    if (!window.confirm('Make ' + periodLabel(S.session, S.term) + ' the default period students get questions from?')) return;
    try {
      await writeSettings(function (d) { d.session = S.session; d.term = S.term; });
      await QL.load({ force: true });
      toast('Default for students is now ' + periodLabel(S.session, S.term) + ' (they see it on next page load).', 'success', 6000);
      draw();
    } catch (e) { toast('Could not change the live period: ' + (e.message || e), 'error', 7000); }
  }

  async function setFreeSelect(scope, value) {      // scope: 'all' or a class key; value: 'on' | 'off' | 'default'
    try {
      await writeSettings(function (d) {
        var fs = d.freeSelect && typeof d.freeSelect === 'object' ? d.freeSelect : {};
        if (typeof fs.all !== 'boolean') fs.all = true;
        if (!fs.classes || typeof fs.classes !== 'object') fs.classes = {};
        if (scope === 'all') fs.all = value === 'on';
        else if (value === 'default') delete fs.classes[scope];
        else fs.classes[scope] = value === 'on';
        d.freeSelect = fs;
      });
      await QL.load({ force: true });
      toast('Saved. Students see the change on their next page load.', 'success', 5000);
    } catch (e) { toast('Could not save: ' + (e.message || e), 'error', 7000); }
    draw();
  }

  /* ───────── rendering ───────── */
  function styles() {
    if (document.getElementById('vtx-qm-css')) return;
    var st = document.createElement('style');
    st.id = 'vtx-qm-css';
    st.textContent =
      '.qm{display:flex;flex-direction:column;gap:1rem;}' +
      '.qm-card{background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:12px;padding:1rem;}' +
      '.qm-row{display:flex;flex-wrap:wrap;gap:.75rem;align-items:flex-end;}' +
      '.qm-field{display:flex;flex-direction:column;gap:.25rem;min-width:140px;flex:1 1 140px;}' +
      '.qm-field label{font-size:.75rem;font-weight:600;opacity:.75;}' +
      '.qm input[type=text],.qm select,.qm textarea{width:100%;box-sizing:border-box;padding:.5rem .625rem;border:1px solid var(--border,#ccc);border-radius:8px;font:inherit;background:var(--bg,#fff);color:inherit;}' +
      '.qm textarea{min-height:70px;resize:vertical;font-family:ui-monospace,Menlo,monospace;font-size:.8125rem;}' +
      '.qm textarea.qm-plain{font-family:inherit;font-size:inherit;}' +
      '.qm-btn{padding:.45rem .8rem;border-radius:8px;border:1px solid var(--border,#ccc);background:var(--surface,#fff);color:inherit;cursor:pointer;font:inherit;font-size:.8125rem;}' +
      '.qm-btn:disabled{opacity:.5;cursor:not-allowed;}' +
      '.qm-primary{background:var(--accent,#007AFF);border-color:var(--accent,#007AFF);color:#fff;}' +
      '.qm-danger{color:#c62828;border-color:#e57373;}' +
      '.qm-live{padding:.6rem .8rem;border-radius:10px;font-size:.8125rem;display:flex;gap:.75rem;flex-wrap:wrap;align-items:center;justify-content:space-between;}' +
      '.qm-live.ok{background:rgba(46,160,67,.12);border:1px solid rgba(46,160,67,.35);}' +
      '.qm-live.warn{background:rgba(255,160,0,.12);border:1px solid rgba(255,160,0,.45);}' +
      '.qm-item{display:flex;flex-wrap:wrap;gap:.4rem .6rem;align-items:flex-start;padding:.7rem 0;border-bottom:1px solid var(--border,#eee);}' +
      '.qm-item:last-child{border-bottom:0;}' +
      '.qm-num{min-width:2rem;font-weight:700;opacity:.6;}' +
      '.qm-txt{flex:1 1 0;min-width:0;font-size:.875rem;line-height:1.45;overflow-wrap:anywhere;}' +
      '.qm-tag{display:inline-block;font-size:.6875rem;padding:.05rem .4rem;border-radius:99px;background:var(--accent-subtle,rgba(0,122,255,.1));margin-left:.25rem;}' +
      '.qm-tag.bad{background:rgba(198,40,40,.15);color:#c62828;}' +
      '.qm-acts{display:flex;gap:.25rem;flex-wrap:wrap;justify-content:flex-end;flex:0 0 auto;}' +
      '@media (max-width:640px){.qm-acts{flex:1 1 100%;justify-content:flex-start;padding-left:2.5rem;}}' +
      '.qm-stack{display:flex;flex-direction:column;gap:.75rem;margin-top:.75rem;}' +
      '.qm-stack>.qm-field,.qm-opt .qm-field{flex:0 0 auto;min-width:0;}' +
      '.qm .qm-btn{width:auto !important;}' +
      '.qm #qmFilter{flex:1 1 160px;width:auto !important;min-width:0;}' +
      '.qm input[type=radio]{-webkit-appearance:radio !important;appearance:radio !important;width:1.15rem !important;height:1.15rem !important;min-width:1.15rem;padding:0 !important;margin:0;flex:0 0 auto;accent-color:var(--accent,#007AFF);cursor:pointer;}' +
      '.qm textarea{min-height:0 !important;}' +
      '.teacher-tab .qm details>summary{padding:.4rem .5rem !important;font-size:.8125rem !important;font-weight:600 !important;background:transparent !important;border-radius:8px !important;}' +
      '.teacher-tab .qm details[open]>summary{background:var(--accent-subtle,rgba(0,122,255,.08)) !important;}' +
      '.qm details>textarea{margin-top:.4rem;}' +
      '.qm-opt{display:flex;flex-direction:column;gap:.15rem;padding:.4rem .5rem;border:1px solid var(--border,#ddd);border-radius:8px;margin-bottom:.5rem;}' +
      '.qm-opt-top{display:flex;gap:.5rem;align-items:center;}' +
      '.qm-opt-top input[type=text]{flex:1 1 0;min-width:0;}' +
      '.qm-opt-top .qm-btn{flex:0 0 auto;padding:.35rem .6rem;}' +
      '.qm-prev{margin-top:.35rem;font-size:.75rem;}' +
      '.qm-err{color:#c62828;font-size:.75rem;}' +
      '.qm-ok{color:#2e7d32;font-size:.75rem;}' +
      '.qm-muted{font-size:.75rem;opacity:.7;overflow-wrap:anywhere;}' +
      '.qm-subjbar{display:flex;flex-wrap:wrap;gap:.5rem .75rem;align-items:center;margin-top:.5rem;}' +
      '.qm-subjbar .qm-muted{flex:1 1 180px;min-width:0;}' +
      '@media (max-width:640px){.qm-subjbar .qm-muted{flex:1 1 100%;}#qmNewRow .qm-field{flex:1 1 100%;}}' +
      '.qm-report{max-height:220px;overflow:auto;font-size:.8125rem;border:1px solid var(--border,#ddd);border-radius:8px;padding:.5rem;}' +
      '.qm details>summary{cursor:pointer;font-size:.8125rem;font-weight:600;}';
    document.head.appendChild(st);
  }

  function selectHtml(id, label, options, value, extra) {
    var h = '<div class="qm-field"><label for="' + id + '">' + label + '</label><select id="' + id + '">';
    options.forEach(function (o) {
      var v = typeof o === 'object' ? o.value : o, t = typeof o === 'object' ? o.text : o;
      h += '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(t) + '</option>';
    });
    return h + (extra || '') + '</select></div>';
  }

  function freePanel() {
    var fs = QL.getFreeSelect();
    var sel = function (id, val, withDefault) {
      return '<select id="' + id + '" data-free="1">' +
        (withDefault ? '<option value="default"' + (val === 'default' ? ' selected' : '') + '>Same as everyone</option>' : '') +
        '<option value="on"' + (val === 'on' ? ' selected' : '') + '>Allowed</option>' +
        '<option value="off"' + (val === 'off' ? ' selected' : '') + '>Not allowed (live period only)</option></select>';
    };
    var h = '<div style="margin-top:.75rem;display:flex;flex-direction:column;gap:.6rem;">' +
      '<div class="qm-muted">When allowed, a student can pick any session and term that has questions for their class. Everyone starts on the live period. Turning it off sends students back to the live period.</div>' +
      '<div class="qm-row" style="align-items:center;"><div style="min-width:120px;"><strong>All classes</strong></div><div class="qm-field">' + sel('qmFreeAll', fs.all ? 'on' : 'off', false) + '</div></div>';
    classOptions().forEach(function (c) {
      var v = typeof fs.classes[c] === 'boolean' ? (fs.classes[c] ? 'on' : 'off') : 'default';
      h += '<div class="qm-row" style="align-items:center;"><div style="min-width:120px;">' + esc(c.toUpperCase()) + '</div><div class="qm-field">' + sel('qmFree_' + c, v, true) + '</div></div>';
    });
    return h + '</div>';
  }

  function draw() {
    if (!S.root) return;
    var live = QL.getActivePeriod();
    var isLive = live.session === S.session && live.term === S.term;
    var counts = {};
    S.classDocs.forEach(function (d) {
      if (d.periodKey === QL.periodKey(S.session, S.term) && Array.isArray(d.questions)) counts[d.subject] = d.questions.length;
    });
    var bundled = visibleBundled(S.cls);

    var subjOpts = subjectOptions().map(function (s) {
      var n = counts[s];
      return { value: s, text: s + (n ? ' (' + n + ')' : (bundled[s] ? ' (default bank)' : '')) };
    });
    subjOpts.push({ value: '__new', text: '+ New subject…' });
    var clsOpts = classOptions().map(function (c) { return { value: c, text: c.toUpperCase() }; });
    clsOpts.push({ value: '__new', text: '+ New class…' });
    var sesOpts = sessionOptions().map(function (s) { return { value: s, text: s }; });
    sesOpts.push({ value: '__new', text: '+ Add session…' });

    var q = S.filter.toLowerCase();
    var listHtml = '';
    S.questions.forEach(function (it, i) {
      if (q && (it.q + ' ' + it.opts.join(' ')).toLowerCase().indexOf(q) < 0) return;
      var hasSvg = it.svg || it.expSvg || (it.optSvg && it.optSvg.some(Boolean));
      listHtml += '<div class="qm-item" data-i="' + i + '"><div class="qm-num">' + (i + 1) + '</div><div class="qm-txt">' +
        esc((it.q || '(diagram question)').slice(0, 160)) + ((it.q || '').length > 160 ? '…' : '') +
        '<div class="qm-muted">Answer: ' + (LETTERS[it.ans] || '?') + ' · ' + it.opts.length + ' options' +
        (hasSvg ? '<span class="qm-tag">SVG</span>' : '') + (QL.keepsOrder && QL.keepsOrder(it) ? '<span class="qm-tag">fixed order</span>' : '') + (it._broken ? '<span class="qm-tag bad">needs fixing</span>' : '') + '</div></div>' +
        '<div class="qm-acts">' +
        '<button class="qm-btn" data-act="edit" data-i="' + i + '"' + (S.busy ? ' disabled' : '') + '>Edit</button>' +
        '<button class="qm-btn" data-act="dup" data-i="' + i + '"' + (S.busy ? ' disabled' : '') + '>Copy</button>' +
        '<button class="qm-btn" data-act="up" data-i="' + i + '"' + (S.busy || i === 0 ? ' disabled' : '') + ' aria-label="Move up">↑</button>' +
        '<button class="qm-btn" data-act="down" data-i="' + i + '"' + (S.busy || i === S.questions.length - 1 ? ' disabled' : '') + ' aria-label="Move down">↓</button>' +
        '<button class="qm-btn qm-danger" data-act="del" data-i="' + i + '"' + (S.busy ? ' disabled' : '') + '>Delete</button></div></div>';
    });
    if (!listHtml) listHtml = '<p class="qm-muted" style="margin:.5rem 0;">' +
      (S.questions.length ? 'No question matches your search.' :
        'No questions yet for ' + esc(S.cls.toUpperCase()) + ' · ' + esc(S.subject || '—') + ' · ' + esc(periodLabel(S.session, S.term)) +
        '. Add one, import a JSON file, or copy from another term below.' +
        (bundled[S.subject] ? ' Students currently get the built-in default bank for this subject (' + bundled[S.subject].length + ' questions) until you save questions here.' : '')) + '</p>';

    // copy-from sources: other periods of the same class+subject, plus built-in bank
    var srcOpts = '';
    S.classDocs.forEach(function (d) {
      if (d.subject === S.subject && d.periodKey && d.periodKey !== QL.periodKey(S.session, S.term) && Array.isArray(d.questions) && d.questions.length)
        srcOpts += '<option value="' + esc(d._id) + '">' + esc(periodLabel(d.session, d.term)) + ' (' + d.questions.length + ')</option>';
    });
    if (bundled[S.subject] && bundled[S.subject].length) srcOpts += '<option value="__bundled">Built-in default bank (' + bundled[S.subject].length + ')</option>';

    S.root.innerHTML =
      '<div class="qm">' +
      '<div class="qm-live ' + (isLive ? 'ok' : 'warn') + '"><div><strong>Live for students:</strong> ' + esc(periodLabel(live.session, live.term)) +
        (QL.status.periodSource === 'date' ? ' <span class="qm-muted">(worked out from today\'s date)</span>' : '') +
        (isLive ? '' : '<br>You are editing <strong>' + esc(periodLabel(S.session, S.term)) + '</strong>. Students only see these by default once you make it the default; if you allow free choice they can also pick it themselves.') + '</div>' +
        (isLive ? '' : '<button class="qm-btn qm-primary" data-act="golive">Make ' + esc(periodLabel(S.session, S.term)) + ' the default</button>') +
        (isLive && QL.status.periodSource === 'date' ? '<button class="qm-btn" data-act="golive">Lock this period</button>' : '') + '</div>' +

      '<div class="qm-card"><details id="qmFreeBox"' + (S.freeOpen ? ' open' : '') + '><summary>Let students choose their own session / term</summary>' + freePanel() + '</details></div>' +

      '<div class="qm-card"><div class="qm-row">' +
        selectHtml('qmSession', 'Session', sesOpts, S.session) +
        selectHtml('qmTerm', 'Term', [{ value: 1, text: 'Term 1' }, { value: 2, text: 'Term 2' }, { value: 3, text: 'Term 3' }], S.term) +
        selectHtml('qmClass', 'Class', clsOpts, S.cls) +
        selectHtml('qmSubject', 'Subject', subjOpts, S.subject) +
      '</div>' +
      (S.subject ? '<div class="qm-subjbar">' +
        '<span class="qm-muted">Subject <strong>' + esc(S.subject) + '</strong> · applies to ' + esc(S.cls.toUpperCase()) + ' only</span>' +
        '<button class="qm-btn" data-act="renamesubj"' + (S.busy ? ' disabled' : '') + '>Edit name</button>' +
        '<button class="qm-btn qm-danger" data-act="delsubj"' + (S.busy ? ' disabled' : '') + '>Delete subject</button></div>' : '') +
      '<div id="qmNewRow" class="qm-row" style="margin-top:.5rem;"></div></div>' +

      '<div class="qm-card"><div class="qm-row" style="justify-content:space-between;align-items:center;margin-bottom:.5rem;">' +
        '<strong>' + S.questions.length + ' question' + (S.questions.length === 1 ? '' : 's') + '</strong>' +
        '<div class="qm-row"><input type="text" id="qmFilter" placeholder="Search questions…" value="' + esc(S.filter) + '" style="width:180px;" />' +
        '<button class="qm-btn qm-primary" data-act="add"' + (S.busy || !S.subject ? ' disabled' : '') + '>+ Add question</button></div></div>' +
        '<div id="qmList">' + listHtml + '</div></div>' +

      '<div id="qmForm"></div>' +

      '<div class="qm-card"><details id="qmBulkBox"' + (S.bulkOpen ? ' open' : '') + '><summary>Bulk upload / copy / export</summary><div style="margin-top:.75rem;display:flex;flex-direction:column;gap:.75rem;">' +
        '<div class="qm-muted">Upload a <strong>.json</strong> file (or paste JSON). A plain list of questions goes to the class, subject, session and term selected above. ' +
        'You can also include <code>"session"</code>, <code>"term"</code>, <code>"class"</code>, <code>"subject"</code> in the file, or use the full layout <code>{"jss1":{"Maths":[…]}}</code>. ' +
        '<code>ans</code> is the 0-based option number (0 = A) or a letter like "B".</div>' +
        '<div class="qm-row"><input type="file" id="qmFile" accept=".json,application/json" />' +
          '<button class="qm-btn" data-act="template">Download template</button>' +
          '<button class="qm-btn" data-act="export"' + (S.questions.length ? '' : ' disabled') + '>Export current</button></div>' +
        '<textarea id="qmPaste" placeholder=\'[{"q":"2 + 2 = ?","opts":["3","4","5","6"],"ans":1,"exp":"Two plus two is four."}]\'></textarea>' +
        '<div class="qm-row"><div class="qm-field" style="flex:0 1 220px;"><label for="qmMode">If questions already exist</label><select id="qmMode">' +
          '<option value="append">Add to existing (skip duplicates)</option><option value="replace">Replace existing</option></select></div>' +
          '<button class="qm-btn" data-act="check">Check file</button>' +
          '<button class="qm-btn qm-primary" data-act="import" id="qmImportBtn" disabled>Import</button></div>' +
        '<div id="qmReport"></div>' +
        (srcOpts ? '<div class="qm-row" style="border-top:1px solid var(--border,#ddd);padding-top:.75rem;"><div class="qm-field"><label for="qmCopySrc">Copy questions into this term from</label><select id="qmCopySrc">' + srcOpts + '</select></div>' +
          '<button class="qm-btn" data-act="copy"' + (S.busy ? ' disabled' : '') + '>Copy here</button></div>' : '') +
      '</div></details></div></div>';

    if (S.form) drawForm();
    if (S.bulk) drawReport();
    // A class with no subjects only offers "+ New subject…", which is already selected and so can't be
    // clicked to fire a change event: show the new-subject box straight away.
    if (!S.subject && S.cls) showNewRow('Subject', true);
  }

  /* ───────── question form ───────── */
  function blankForm() {
    return { index: -1, q: '', opts: ['', '', '', ''], optSvg: ['', '', '', ''], ans: -1, exp: '', svg: '', expSvg: '', order: 'auto' };
  }
  function formFromQuestion(i) {
    var it = S.questions[i];
    return {
      index: i, q: it.q || '', opts: it.opts.slice(), ans: it.ans, exp: it.exp || '',
      optSvg: it.opts.map(function (_, k) { return it.optSvg && it.optSvg[k] ? joinSvg(it.optSvg[k]) : ''; }),
      svg: joinSvg(it.svg), expSvg: joinSvg(it.expSvg),
      order: it.noShuffle === true ? 'fixed' : (it.noShuffle === false ? 'shuffle' : 'auto'),
    };
  }

  function svgField(id, label, value, size) {
    return '<details' + (value ? ' open' : '') + '><summary>' + label + '</summary>' +
      '<textarea id="' + id + '" data-svg="' + size + '" placeholder="&lt;svg viewBox=&quot;0 0 200 100&quot;&gt;…&lt;/svg&gt;">' + esc(value) + '</textarea>' +
      '<div class="qm-prev" data-prev-for="' + id + '"></div></details>';
  }

  function drawForm() {
    var f = S.form, host = $('#qmForm');
    if (!host) return;
    var optsHtml = '';
    f.opts.forEach(function (o, i) {
      optsHtml += '<div class="qm-opt"><div class="qm-opt-top">' +
        '<input type="radio" name="qmAns" id="qmAns' + i + '" value="' + i + '"' + (f.ans === i ? ' checked' : '') + ' aria-label="Correct answer ' + LETTERS[i] + '" />' +
        '<strong style="min-width:1.2rem;">' + LETTERS[i] + '</strong>' +
        '<input type="text" id="qmOpt' + i + '" value="' + esc(o) + '" placeholder="Option ' + LETTERS[i] + '" />' +
        (f.opts.length > MIN_OPTS ? '<button class="qm-btn qm-danger" data-act="rmopt" data-i="' + i + '" aria-label="Remove option ' + LETTERS[i] + '">✕</button>' : '') +
        '</div>' + svgField('qmOptSvg' + i, 'Diagram for option ' + LETTERS[i], f.optSvg[i] || '', 'option') + '</div>';
    });
    host.innerHTML = '<div class="qm-card"><strong>' + (f.index < 0 ? 'New question' : 'Edit question ' + (f.index + 1)) + '</strong>' +
      '<div class="qm-stack">' +
      '<div class="qm-field"><label for="qmQ">Question</label><textarea id="qmQ" class="qm-plain" rows="3">' + esc(f.q) + '</textarea></div>' +
      svgField('qmSvg', 'Diagram for the question (SVG code)', f.svg, 'question') +
      '<div><label class="qm-muted">Options. Tick the circle beside the correct answer.</label>' + optsHtml +
        '<button class="qm-btn" data-act="addopt"' + (f.opts.length >= MAX_OPTS ? ' disabled' : '') + '>+ Add option</button></div>' +
      '<div class="qm-field"><label for="qmOrder">Option order for students</label><select id="qmOrder">' +
        '<option value="auto"' + (f.order === 'auto' ? ' selected' : '') + '>Automatic (recommended)</option>' +
        '<option value="shuffle"' + (f.order === 'shuffle' ? ' selected' : '') + '>Always shuffle</option>' +
        '<option value="fixed"' + (f.order === 'fixed' ? ' selected' : '') + '>Keep in the order I typed</option></select>' +
        '<div class="qm-muted">Automatic shuffles the options, except for "All of the above", True/False and similar.</div></div>' +
      '<div class="qm-field"><label for="qmExp">Explanation (shown after the exam)</label><textarea id="qmExp" class="qm-plain" rows="2">' + esc(f.exp) + '</textarea></div>' +
      svgField('qmExpSvg', 'Diagram for the explanation (SVG code)', f.expSvg, 'explanation') +
      '<div id="qmFormErr" class="qm-err" role="alert"></div>' +
      '<div class="qm-row"><button class="qm-btn qm-primary" data-act="saveq"' + (S.busy ? ' disabled' : '') + '>' + (f.index < 0 ? 'Save question' : 'Save changes') + '</button>' +
      (f.index < 0 ? '<button class="qm-btn" data-act="saveq-next"' + (S.busy ? ' disabled' : '') + '>Save and add another</button>' : '') +
      '<button class="qm-btn" data-act="cancelq">Cancel</button></div></div></div>';
    host.querySelectorAll('textarea[data-svg]').forEach(updatePreview);
    var qEl = $('#qmQ'); if (qEl && f.index < 0 && !f.q) { try { qEl.focus({ preventScroll: false }); } catch (e) {} }
  }

  function updatePreview(ta) {
    var prev = S.root.querySelector('[data-prev-for="' + ta.id + '"]');
    if (!prev) return;
    var r = splitSvg(ta.value);
    if (r.error) { prev.innerHTML = '<span class="qm-err">' + esc(r.error) + '</span>'; return; }
    if (r.value == null) { prev.innerHTML = ''; return; }
    if (ta.dataset.svg === 'option' && Array.isArray(r.value)) { prev.innerHTML = '<span class="qm-err">Only one diagram per option.</span>'; return; }
    prev.innerHTML = '<span class="qm-ok">Diagram OK</span>' + (window.SvgDiagram ? SvgDiagram.html(r.value, { size: ta.dataset.svg }) : '');
  }

  function syncForm() {
    var f = S.form; if (!f) return;
    var g = function (id) { var e = $(id); return e ? e.value : null; };
    var v;
    if ((v = g('#qmQ')) != null) f.q = v;
    if ((v = g('#qmExp')) != null) f.exp = v;
    if ((v = g('#qmOrder')) != null) f.order = v;
    if ((v = g('#qmSvg')) != null) f.svg = v;
    if ((v = g('#qmExpSvg')) != null) f.expSvg = v;
    f.opts = f.opts.map(function (o, i) { var x = g('#qmOpt' + i); return x != null ? x : o; });
    f.optSvg = f.opts.map(function (_, i) { var x = g('#qmOptSvg' + i); return x != null ? x : (f.optSvg[i] || ''); });
    var checked = S.root.querySelector('input[name=qmAns]:checked');
    f.ans = checked ? Number(checked.value) : f.ans;
  }

  function formToQuestion() {
    syncForm();
    var f = S.form;
    var raw = { q: f.q, opts: f.opts, ans: f.ans, exp: f.exp };
    if (f.ans < 0) return { error: 'Select the correct answer (tick the circle beside it).' };
    if (f.order === 'fixed') raw.noShuffle = true; else if (f.order === 'shuffle') raw.noShuffle = false;
    if (f.svg.trim()) raw.svg = f.svg;
    if (f.expSvg.trim()) raw.expSvg = f.expSvg;
    if (f.optSvg.some(function (x) { return x.trim(); })) raw.optSvg = f.optSvg;
    // reject an empty option unless it has a diagram
    for (var i = 0; i < f.opts.length; i++) {
      if (!f.opts[i].trim() && !(f.optSvg[i] || '').trim()) return { error: 'Option ' + LETTERS[i] + ' is empty. Fill it in or remove it.' };
    }
    var r = coerceQuestion(raw);
    if (r.error) return { error: r.error.charAt(0).toUpperCase() + r.error.slice(1) + '.' };
    var q = r.q;
    // same options twice is almost always a typo
    var seen = {};
    for (var j = 0; j < q.opts.length; j++) {
      var k = q.opts[j].toLowerCase();
      if (k && seen[k]) return { error: 'Options ' + LETTERS[seen[k] - 1] + ' and ' + LETTERS[j] + ' are identical.' };
      seen[k] = j + 1;
    }
    return { q: q };
  }

  async function saveForm(addAnother) {
    var r = formToQuestion();
    var errEl = $('#qmFormErr');
    if (r.error) { if (errEl) errEl.textContent = r.error; return; }
    var list = S.questions.slice();
    var idx = S.form.index;
    var dupAt = list.findIndex(function (x, i) { return i !== idx && dupKey(x) === dupKey(r.q); });
    if (dupAt >= 0 && !window.confirm('This looks the same as question ' + (dupAt + 1) + '. Save it anyway?')) return;
    if (idx < 0) list.push(r.q); else list[idx] = r.q;
    var ok = await saveQuestions(list, idx < 0 ? 'Question added.' : 'Question updated.');
    if (ok) { S.form = addAnother ? blankForm() : null; draw(); }
  }

  /* ───────── bulk import ───────── */
  function parseBulk(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return { error: 'This is not valid JSON: ' + e.message }; }
    var groups = [];
    function add(cls, subject, session, term, arr, src) {
      groups.push({ cls: cls, subject: subject, session: session, term: term, raw: arr, src: src });
    }
    var defSes = S.session, defTerm = S.term;
    function ctx(o) {
      var ses = o && o.session != null ? QL.normSession(o.session) : defSes;
      var tm = o && o.term != null ? QL.normTerm(o.term) : defTerm;
      return { ses: ses, tm: tm, badSes: o && o.session != null && !ses, badTm: o && o.term != null && !tm };
    }
    if (Array.isArray(data)) {
      add(S.cls, S.subject, defSes, defTerm, data, 'list');
    } else if (data && typeof data === 'object') {
      var c = ctx(data);
      if (c.badSes) return { error: 'Invalid "session" in the file. Use a form like 2025/2026.' };
      if (c.badTm) return { error: 'Invalid "term" in the file. Use 1, 2 or 3.' };
      if (Array.isArray(data.questions)) {
        var cls = data.class || data.classKey ? QL.normClass(data.class || data.classKey) : S.cls;
        var sub = data.subject ? String(data.subject).trim() : S.subject;
        add(cls, sub, c.ses, c.tm, data.questions, 'object');
      } else {
        Object.keys(data).forEach(function (ck) {
          if (['session', 'term'].indexOf(ck) >= 0) return;
          var v = data[ck];
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            Object.keys(v).forEach(function (sk) {
              if (Array.isArray(v[sk])) add(QL.normClass(ck), sk.trim(), c.ses, c.tm, v[sk], 'bank');
            });
          }
        });
      }
    }
    if (!groups.length) return { error: 'No questions found. Use a list of questions, {"questions":[…]}, or {"jss1":{"Subject":[…]}}.' };
    var out = [];
    groups.forEach(function (g) {
      var res = { cls: g.cls, subject: g.subject, session: g.session, term: g.term, good: [], bad: [], notes: [] };
      if (!g.cls) res.notes.push('Choose a class first.');
      if (!g.subject) res.notes.push('Choose a subject first (or add "subject" to the file).');
      if (!QL.normSession(g.session) || !QL.normTerm(g.term)) res.notes.push('Invalid session or term.');
      var seen = {};
      g.raw.forEach(function (raw, i) {
        var r = coerceQuestion(raw);
        if (r.error) { res.bad.push('#' + (i + 1) + ' ' + r.error); return; }
        var k = dupKey(r.q);
        if (seen[k]) { res.bad.push('#' + (i + 1) + ' duplicate of #' + seen[k]); return; }
        seen[k] = i + 1;
        res.good.push(r.q);
      });
      if (!res.good.length && !res.notes.length) res.notes.push('No valid questions.');
      out.push(res);
    });
    return { groups: out };
  }

  function drawReport() {
    var host = $('#qmReport'), btn = $('#qmImportBtn');
    if (!host) return;
    var b = S.bulk;
    if (!b) { host.innerHTML = ''; return; }
    if (b.error) { host.innerHTML = '<div class="qm-err" role="alert">' + esc(b.error) + '</div>'; if (btn) btn.disabled = true; return; }
    var html = '<div class="qm-report">', total = 0;
    b.groups.forEach(function (g) {
      total += g.notes.length ? 0 : g.good.length;
      html += '<div><strong>' + esc((g.cls || '?').toUpperCase()) + ' · ' + esc(g.subject || '?') + ' · ' + esc(periodLabel(g.session, g.term)) + '</strong>: ' +
        '<span class="qm-ok">' + g.good.length + ' ready</span>' + (g.bad.length ? ', <span class="qm-err">' + g.bad.length + ' skipped</span>' : '') + '</div>';
      g.notes.forEach(function (n) { html += '<div class="qm-err">' + esc(n) + '</div>'; });
      g.bad.slice(0, 40).forEach(function (m) { html += '<div class="qm-err" style="margin-left:.75rem;">' + esc(m) + '</div>'; });
      if (g.bad.length > 40) html += '<div class="qm-muted" style="margin-left:.75rem;">…and ' + (g.bad.length - 40) + ' more</div>';
    });
    host.innerHTML = html + '</div>';
    if (btn) btn.disabled = total === 0 || S.busy;
  }

  async function runImport() {
    var b = S.bulk;
    if (!b || !b.groups || S.busy) return;
    if (!isTeacher()) { toast('Teacher login required.', 'error'); return; }
    var modeEl = $('#qmMode'), replace = modeEl && modeEl.value === 'replace';
    var todo = b.groups.filter(function (g) { return !g.notes.length && g.good.length; });
    if (!todo.length) return;
    if (replace && !window.confirm('Replace existing questions for the matching subject(s) and term(s)? This cannot be undone.')) return;
    S.busy = true; draw();
    var done = 0, added = 0, failures = [];
    for (var gi = 0; gi < todo.length; gi++) {
      var g = todo[gi];
      try {
        var ref = db().collection(QL.COLLECTION).doc(docId(g.cls, g.subject, g.session, g.term));
        var existing = [];
        if (!replace) {
          var snap = await ref.get();
          if (snap.exists) existing = (snap.data().questions || []).map(function (x) { var r = coerceQuestion(x); return r.q || x; });
        }
        var keys = {};
        existing.forEach(function (x) { if (x && x.opts) keys[dupKey(x)] = 1; });
        var fresh = g.good.filter(function (x) { return !keys[dupKey(x)]; });
        var merged = existing.concat(fresh);
        var clean = JSON.parse(JSON.stringify(merged));
        if (JSON.stringify(clean).length > QL.MAX_DOC_CHARS) throw new Error('too large for one document (limit about 900 KB)');
        await ref.set({
          classKey: g.cls, subject: g.subject, session: QL.normSession(g.session), term: g.term,
          periodKey: QL.periodKey(g.session, g.term), questions: clean, active: true,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        done++; added += fresh.length;
      } catch (e) { failures.push(g.cls.toUpperCase() + ' ' + g.subject + ': ' + (e.message || e)); }
    }
    S.busy = false; S.bulk = null;
    if (failures.length) toast('Some imports failed: ' + failures.join('; '), 'error', 9000);
    if (done) toast('Imported ' + added + ' new question' + (added === 1 ? '' : 's') + ' into ' + done + ' subject' + (done === 1 ? '' : 's') + '.', 'success', 6000);
    await fetchClassDocs();
    await loadQuestions();
    QL.load({ force: true });
    draw();
  }

  function download(name, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ───────── events ───────── */
  async function onSelectionChange(which) {
    var el = $('#qm' + which);
    if (!el) return;
    var val = el.value;
    if (S.form && !window.confirm('Discard the question you are editing?')) { draw(); return; }
    S.form = null; S.bulk = null;
    if (val === '__new') { showNewRow(which); el.value = which === 'Session' ? S.session : which === 'Class' ? S.cls : S.subject; return; }
    if (which === 'Session') S.session = val;
    else if (which === 'Term') S.term = Number(val);
    else if (which === 'Class') {
      S.cls = val; S.subject = '';
      await fetchClassDocs();
      var subs = subjectOptions(); S.subject = subs[0] || '';
    } else if (which === 'Subject') S.subject = val;
    await loadQuestions(); remember(); draw();
  }

  function showNewRow(which, noFocus) {
    var row = $('#qmNewRow'); if (!row) return;
    var ph = which === 'Session' ? '2026/2027' : which === 'Class' ? 'e.g. JSS 3 or Primary 4' : 'e.g. Civic Education';
    row.innerHTML = '<div class="qm-field"><label for="qmNewVal">New ' + which.toLowerCase() + '</label><input type="text" id="qmNewVal" placeholder="' + ph + '" /></div>' +
      '<button class="qm-btn qm-primary" data-act="addnew" data-which="' + which + '">Add</button>' +
      (which === 'Subject' && !S.subject ? '' : '<button class="qm-btn" data-act="cancelnew">Cancel</button>');
    var inp = $('#qmNewVal'); if (inp && !noFocus) inp.focus();
  }

  async function addNew(which) {
    var inp = $('#qmNewVal'); var v = inp ? inp.value.trim() : '';
    if (!v) { toast('Type a value first.', 'warning'); return; }
    if (which === 'Session') {
      var s = QL.normSession(v);
      if (!s) { toast('Use a session like 2025/2026 (the second year must follow the first).', 'warning', 5000); return; }
      if (S.extraSessions.indexOf(s) < 0) S.extraSessions.push(s);
      S.session = s;
    } else if (which === 'Class') {
      var k = QL.normClass(v);
      if (!/^[a-z0-9]+$/.test(k)) { toast('Class names may only contain letters and numbers (e.g. JSS3).', 'warning', 5000); return; }
      if (S.extraClasses.indexOf(k) < 0) S.extraClasses.push(k);
      S.cls = k; S.subject = ''; await fetchClassDocs();
      var subs = subjectOptions(); S.subject = subs[0] || '';
    } else {
      v = v.replace(/\s+/g, ' ');
      if (v.length > 60 || /[\/\\]/.test(v)) { toast('Subject names must be under 60 characters and not contain / or \\.', 'warning', 5000); return; }
      var existing = subjectOptions().find(function (x) { return x.toLowerCase() === v.toLowerCase(); });
      if (!existing) {                                   // typing the name of a deleted built-in subject restores it
        var hid = hiddenFor(S.cls).find(function (x) { return x.toLowerCase() === v.toLowerCase(); });
        if (hid) {
          try { await setHidden(S.cls, hid, false); existing = hid; toast('Restored the built-in "' + hid + '" subject.', 'success', 5000); QL.load({ force: true }); }
          catch (e) { toast('Could not restore that subject: ' + (e.message || e), 'error', 6000); return; }
        }
      }
      v = existing || v;
      if (!existing) { (S.extraSubjects[S.cls] = S.extraSubjects[S.cls] || []).push(v); }
      S.subject = v;
    }
    S.form = null;
    await loadQuestions(); remember(); draw();
  }

  async function onClick(e) {
    var t = e.target.closest('[data-act]');
    if (!t || !S.root.contains(t)) return;
    var act = t.dataset.act, i = Number(t.dataset.i);
    if (S.busy && act !== 'cancelq' && act !== 'cancelnew') return;

    if (act === 'golive') return setLivePeriod();
    if (act === 'add') { S.form = blankForm(); drawForm(); var h = $('#qmForm'); if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (act === 'edit') { S.form = formFromQuestion(i); drawForm(); var h2 = $('#qmForm'); if (h2) h2.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (act === 'cancelq') { S.form = null; var fh = $('#qmForm'); if (fh) fh.innerHTML = ''; return; }
    if (act === 'addopt') { syncForm(); if (S.form.opts.length < MAX_OPTS) { S.form.opts.push(''); S.form.optSvg.push(''); } drawForm(); return; }
    if (act === 'rmopt') {
      syncForm();
      if (S.form.opts.length <= MIN_OPTS) return;
      S.form.opts.splice(i, 1); S.form.optSvg.splice(i, 1);
      if (S.form.ans === i) S.form.ans = -1; else if (S.form.ans > i) S.form.ans--;
      drawForm(); return;
    }
    if (act === 'saveq') return saveForm(false);
    if (act === 'saveq-next') return saveForm(true);
    if (act === 'del') {
      if (!window.confirm('Delete question ' + (i + 1) + '?' + (S.questions.length === 1 ? ' This is the last one, so students will go back to the built-in default bank for this subject (if any).' : ''))) return;
      var l = S.questions.slice(); l.splice(i, 1); S.form = null;
      return void (await saveQuestions(l, 'Question deleted.'));
    }
    if (act === 'dup') { var l2 = S.questions.slice(); l2.splice(i + 1, 0, JSON.parse(JSON.stringify(S.questions[i]))); return void (await saveQuestions(l2, 'Question copied.')); }
    if (act === 'up' || act === 'down') {
      var j = act === 'up' ? i - 1 : i + 1; if (j < 0 || j >= S.questions.length) return;
      var l3 = S.questions.slice(); var tmp = l3[i]; l3[i] = l3[j]; l3[j] = tmp; S.form = null;
      return void (await saveQuestions(l3, 'Order saved.'));
    }
    if (act === 'addnew') return addNew(t.dataset.which);
    if (act === 'renamesubj') return showRenameRow();
    if (act === 'saverename') return renameSubject();
    if (act === 'delsubj') return deleteSubject();
    if (act === 'cancelnew') { var nr = $('#qmNewRow'); if (nr) nr.innerHTML = ''; return; }
    if (act === 'template') {
      return download('questions-template.json', JSON.stringify({
        session: S.session, term: S.term, class: S.cls, subject: S.subject || 'Subject name',
        questions: [{ q: 'What is 2 + 2?', opts: ['3', '4', '5', '6'], ans: 1, exp: 'Two plus two is four.' },
          { q: 'Which shape is shown?', svg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="black"/></svg>', opts: ['Circle', 'Square', 'Triangle'], ans: 'A', exp: 'It has no corners.' }],
      }, null, 2));
    }
    if (act === 'export') {
      return download((S.cls + '_' + QL.slug(S.subject) + '_' + QL.periodKey(S.session, S.term) + '.json'),
        JSON.stringify({ session: S.session, term: S.term, class: S.cls, subject: S.subject, questions: S.questions.map(function (q) { var c = Object.assign({}, q); delete c._broken; return c; }) }, null, 2));
    }
    if (act === 'check') {
      var ta = $('#qmPaste'), text = ta ? ta.value.trim() : '';
      if (!text) { toast('Choose a file or paste JSON first.', 'warning'); return; }
      S.bulk = parseBulk(text); drawReport(); return;
    }
    if (act === 'import') return runImport();
    if (act === 'copy') return copyFrom();
  }

  async function copyFrom() {
    var sel = $('#qmCopySrc'); if (!sel) return;
    var src;
    if (sel.value === '__bundled') src = (visibleBundled(S.cls)[S.subject]) || [];
    else {
      var d = S.classDocs.find(function (x) { return x._id === sel.value; });
      src = d && Array.isArray(d.questions) ? d.questions : [];
    }
    var fresh = [], keys = {};
    S.questions.forEach(function (x) { keys[dupKey(x)] = 1; });
    src.forEach(function (raw) { var r = coerceQuestion(raw); if (r.q && !keys[dupKey(r.q)]) { keys[dupKey(r.q)] = 1; fresh.push(r.q); } });
    if (!fresh.length) { toast('Nothing new to copy (everything is already here).', 'info'); return; }
    if (!window.confirm('Copy ' + fresh.length + ' question(s) into ' + periodLabel(S.session, S.term) + '?')) return;
    await saveQuestions(S.questions.concat(fresh), 'Copied ' + fresh.length + ' questions.');
  }

  function onInput(e) {
    var t = e.target;
    if (t.id === 'qmFilter') {
      S.filter = t.value;
      var pos = t.selectionStart;
      draw(); var f = $('#qmFilter'); if (f) { f.focus(); try { f.setSelectionRange(pos, pos); } catch (x) {} }
      return;
    }
    if (t.matches && t.matches('textarea[data-svg]')) updatePreview(t);
  }

  function onChange(e) {
    var t = e.target;
    if (t.dataset && t.dataset.free) { return void setFreeSelect(t.id === 'qmFreeAll' ? 'all' : t.id.slice(7), t.value); }
    if (['qmSession', 'qmTerm', 'qmClass', 'qmSubject'].indexOf(t.id) >= 0) return void onSelectionChange(t.id.slice(2));
    if (t.id === 'qmFile' && t.files && t.files[0]) {
      var file = t.files[0];
      if (file.size > 5 * 1024 * 1024) { toast('That file is over 5 MB. Split it into smaller files.', 'error'); t.value = ''; return; }
      var rd = new FileReader();
      rd.onload = function () {
        var ta = $('#qmPaste'); if (ta) ta.value = String(rd.result || '').replace(/^\uFEFF/, '');
        S.bulk = parseBulk(String(rd.result || '').replace(/^\uFEFF/, '')); drawReport();
      };
      rd.onerror = function () { toast('Could not read that file.', 'error'); };
      rd.readAsText(file);
    }
  }

  /* ───────── entry point ───────── */
  async function render(containerId) {
    var root = document.getElementById(containerId);
    if (!root) return;
    if (!isTeacher()) { root.innerHTML = '<p>Teacher login required.</p>'; return; }
    styles();
    if (S.root !== root) {
      S.root = root;
      root.addEventListener('click', onClick);
      root.addEventListener('input', onInput);
      root.addEventListener('change', onChange);
      root.addEventListener('keydown', function (e) {          // Enter submits the new / rename subject box
        if (e.key !== 'Enter' || !e.target || e.target.id !== 'qmNewVal') return;
        e.preventDefault();
        var b = $('#qmNewRow [data-act="saverename"], #qmNewRow [data-act="addnew"]'); if (b) b.click();
      });
      root.addEventListener('toggle', function (e) {
        if (e.target && e.target.id === 'qmBulkBox') S.bulkOpen = e.target.open;
        if (e.target && e.target.id === 'qmFreeBox') S.freeOpen = e.target.open;
      }, true);
    }
    if (!window.fbDb || !QL) { root.innerHTML = '<p>Question tools are not available (database not ready).</p>'; return; }
    root.innerHTML = '<p class="qm-muted">Loading…</p>';

    var live = QL.getActivePeriod(), last = lastUsed();
    S.session = S.session || live.session;               // prepopulate with the live period
    S.term = S.term || live.term;
    var classes = classOptions();
    S.cls = S.cls || (last.cls && classes.indexOf(last.cls) >= 0 ? last.cls : classes[0] || '');
    S.form = null; S.bulk = null; S.filter = '';
    await fetchClassDocs();
    var subs = subjectOptions();
    S.subject = S.subject && subs.indexOf(S.subject) >= 0 ? S.subject : (last.subject && subs.indexOf(last.subject) >= 0 ? last.subject : subs[0] || '');
    await loadQuestions();
    draw();
  }

  window.QuestionManager = {
    render: render,
    _internals: { coerceQuestion: coerceQuestion, parseBulk: parseBulk, splitSvg: splitSvg, state: S, docId: docId },
  };
})();
