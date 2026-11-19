/* ============================================================
   js/exam-history.js — Exam History (student) + access control (teacher)

   STUDENT: a screen where students the teacher has opened it for can
   look back at every exam they took and review it question by question
   (their answer, the correct answer, explanation, passages, diagrams, maths).
   It reads the exact snapshot saved with each result, so the review matches
   what the student saw on the day, even after closing the app.

   ACCESS (set by the teacher, Firestore  appSettings/examHistory):
     { all: bool, classes: ["sss3", ...], uids: ["<studentUid>", ...] }
   Default is OFF. Access is re-checked every time the screen opens.

   Public API:
     ExamHistory.canAccess()         -> Promise<boolean>
     ExamHistory.revealTile()        -> shows the dashboard tile if allowed
     ExamHistory.open()              -> opens the history screen
     ExamHistory.renderAdmin(id)     -> teacher settings panel
   ============================================================ */
(function () {
  'use strict';

  var CFG = { col: 'appSettings', id: 'examHistory' };
  var cfgCache = { at: 0, data: null };
  var S = { list: null, loading: false, err: '', openId: null, subj: '', filter: 'all' };
  var A = { root: null, cfg: null, students: [], q: '', busy: false };

  /* ───────── helpers ───────── */
  function db() { return window.fbDb; }
  function app() { return window.AppState || {}; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(m, t) { if (window.UI && UI.toast) UI.toast(m, t || 'info', 4000); }
  function classKey(str) {
    var k = String(str || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return k.replace(/^ss(\d)/, 'sss$1').replace(/^js(\d)/, 'jss$1');
  }
  function safe(s) { return window.Exam && Exam._safeQ ? Exam._safeQ(s) : esc(s); }
  function diag(v, size) { try { return window.SvgDiagram && v ? SvgDiagram.html(v, { size: size || 'question' }) : ''; } catch (e) { return ''; } }
  function optDiag(q, i) { try { return window.SvgDiagram ? SvgDiagram.optionHtml(q, i) : ''; } catch (e) { return ''; } }
  function math() { if (window.Exam && Exam._renderKatex) Exam._renderKatex(); }
  function gradeColor(g) {
    return g === 'A' ? 'var(--success)' : g === 'B' ? 'var(--info)' : (g === 'C' || g === 'D') ? 'var(--warning)' : 'var(--danger)';
  }
  function ms(r) {
    var t = r && r.timestamp;
    if (t && typeof t.toMillis === 'function') return t.toMillis();
    if (t && typeof t.seconds === 'number') return t.seconds * 1000;
    if (r && r.sessionDate) { var d = Date.parse(r.sessionDate + 'T12:00:00'); if (!isNaN(d)) return d; }
    return 0;
  }
  function fmtDate(t) {
    if (!t) return 'Date not recorded';
    return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtTime(t) {
    if (!t) return '';
    return new Date(t).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  }
  function monthLabel(t) {
    if (!t) return 'Earlier';
    return new Date(t).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  function ring(pct, color, size, stroke) {
    var r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, Number(pct) || 0));
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--border)" stroke-width="' + stroke + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="round" ' +
      'stroke-dasharray="' + (c * p / 100) + ' ' + c + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>';
  }

  /* ───────── access ───────── */
  async function loadConfig(force) {
    if (!force && cfgCache.data && Date.now() - cfgCache.at < 60000) return cfgCache.data;
    var data = { all: false, classes: [], uids: [] };
    try {
      var snap = await db().collection(CFG.col).doc(CFG.id).get();
      if (snap.exists) {
        var d = snap.data() || {};
        data = { all: d.all === true, classes: Array.isArray(d.classes) ? d.classes : [], uids: Array.isArray(d.uids) ? d.uids : [] };
      }
    } catch (e) { data = cfgCache.data || data; }
    cfgCache = { at: Date.now(), data: data };
    return data;
  }
  async function canAccess(force) {
    var st = app();
    if (!st.userId || st.isTeacher || !st.studentData || !db()) return false;
    var c = await loadConfig(force);
    if (c.all) return true;
    if (c.uids.indexOf(st.userId) >= 0) return true;
    var k = classKey(st.studentData.class);
    return !!k && c.classes.map(classKey).indexOf(k) >= 0;
  }
  async function revealTile() {
    var b = document.getElementById('historyBtn');
    if (!b) return;
    var ok = await canAccess(false);
    var again = document.getElementById('historyBtn');
    if (again && ok) again.style.removeProperty('display');
  }

  /* ───────── styles ───────── */
  function styles() {
    if (document.getElementById('vtx-xh-css')) return;
    var st = document.createElement('style');
    st.id = 'vtx-xh-css';
    st.textContent = [
      '.xh{max-width:46rem;margin:0 auto;padding:1rem 1rem 5rem;font-family:var(--font);color:var(--text-1);}',
      '.xh *{box-sizing:border-box;}',
      '.xh-top{display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem;}',
      '.xh-back{display:inline-flex;align-items:center;justify-content:center;width:2.5rem;height:2.5rem;flex:none;border-radius:50%;border:1px solid var(--border);background:var(--bg-base);color:var(--text-1);cursor:pointer;font-size:1.125rem;}',
      '.xh-back:hover{border-color:var(--accent);color:var(--accent);}',
      '.xh-h1{font-size:1.375rem;font-weight:700;letter-spacing:-.02em;margin:0;line-height:1.2;}',
      '.xh-sub{font-size:.8125rem;color:var(--text-3);margin:.125rem 0 0;}',
      '.xh-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.625rem;margin-bottom:1.5rem;}',
      '.xh-stat{background:var(--bg-base);border:1px solid var(--border);border-radius:var(--r-lg);padding:.75rem .875rem;min-width:0;}',
      '.xh-stat b{display:block;font-size:1.25rem;letter-spacing:-.02em;}',
      '.xh-stat span{font-size:.6875rem;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.05em;}',
      '.xh-month{font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-4);margin:1.5rem 0 .625rem;}',
      '.xh-card{display:flex;align-items:center;gap:.875rem;width:100%;text-align:left;background:var(--bg-base);border:1px solid var(--border);border-radius:var(--r-xl);padding:.875rem;margin-bottom:.625rem;cursor:pointer;font:inherit;color:inherit;transition:border-color .15s,transform .15s,box-shadow .15s;-webkit-tap-highlight-color:transparent;}',
      '.xh-card:hover{border-color:var(--accent);transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.07);}',
      '.xh-card:focus-visible,.xh-back:focus-visible,.xh-chip:focus-visible,.xh-dot:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}',
      '.xh-ringwrap{position:relative;width:3.5rem;height:3.5rem;flex:none;}',
      '.xh-ringwrap svg{position:absolute;inset:0;}',
      '.xh-ringwrap span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:.8125rem;font-weight:700;}',
      '.xh-cbody{min-width:0;flex:1;}',
      '.xh-ctitle{font-size:.9375rem;font-weight:600;overflow-wrap:anywhere;line-height:1.35;}',
      '.xh-cmeta{font-size:.75rem;color:var(--text-3);margin-top:.25rem;display:flex;flex-wrap:wrap;gap:.25rem .625rem;align-items:center;}',
      '.xh-grade{font-weight:700;font-size:.6875rem;padding:.125rem .5rem;border-radius:99px;border:1px solid currentColor;}',
      '.xh-tag{font-size:.6875rem;padding:.125rem .5rem;border-radius:99px;background:var(--bg-subtle);color:var(--text-2);}',
      '.xh-chev{color:var(--text-4);font-size:1rem;flex:none;}',
      '.xh-skel{border-radius:10px;background:linear-gradient(90deg,var(--border) 25%,rgba(128,128,128,.12) 50%,var(--border) 75%);background-size:200% 100%;animation:xh-sh 1.2s infinite linear;}',
      '@keyframes xh-sh{0%{background-position:200% 0}100%{background-position:-200% 0}}',
      '.xh-empty{text-align:center;padding:3rem 1rem;color:var(--text-3);}',
      '.xh-empty b{display:block;color:var(--text-1);font-size:1.0625rem;margin-bottom:.375rem;}',
      '.xh-btn{display:inline-flex;align-items:center;justify-content:center;padding:.5625rem 1.125rem;border-radius:99px;border:1px solid var(--accent);background:var(--accent);color:#fff;font:inherit;font-size:.8125rem;font-weight:600;cursor:pointer;width:auto;margin-top:.875rem;}',
      '.xh-hero{display:flex;align-items:center;gap:1.125rem;background:var(--bg-subtle);border:1px solid var(--border);border-radius:var(--r-xl);padding:1.125rem;margin-bottom:1rem;}',
      '.xh-hero .xh-ringwrap{width:5.5rem;height:5.5rem;}',
      '.xh-hero .xh-ringwrap span{font-size:1.375rem;}',
      '.xh-hnote{font-size:.8125rem;color:var(--text-3);line-height:1.5;}',
      '.xh-chips{display:flex;gap:.5rem;overflow-x:auto;padding:.125rem 0 .5rem;margin:0 -1rem;padding-left:1rem;padding-right:1rem;scrollbar-width:none;}',
      '.xh-chips::-webkit-scrollbar{display:none;}',
      '.xh-chip{flex:none;display:inline-flex;align-items:center;gap:.5rem;padding:.4375rem .875rem;border-radius:99px;border:1px solid var(--border);background:var(--bg-base);font:inherit;font-size:.8125rem;font-weight:600;color:var(--text-2);cursor:pointer;width:auto;white-space:nowrap;}',
      '.xh-chip.is-on{background:var(--text-1);border-color:var(--text-1);color:var(--bg-base);}',
      '.xh-chip small{font-size:.6875rem;opacity:.75;font-weight:600;}',
      '.xh-nav{display:flex;flex-wrap:wrap;gap:.375rem;margin:.5rem 0 1rem;}',
      '.xh-dot{width:2rem;height:2rem;border-radius:.5rem;border:1.5px solid var(--border);background:var(--bg-base);font:inherit;font-size:.75rem;font-weight:700;cursor:pointer;color:var(--text-2);padding:0;display:inline-flex;align-items:center;justify-content:center;}',
      '.xh-dot.ok{background:var(--success-subtle);border-color:var(--success);color:var(--success);}',
      '.xh-dot.bad{background:var(--danger-subtle);border-color:var(--danger);color:var(--danger);}',
      '.xh-dot.skip{background:var(--bg-subtle);border-style:dashed;}',
      '.xh-seg{display:inline-flex;background:var(--bg-subtle);border-radius:99px;padding:.1875rem;margin-bottom:1rem;max-width:100%;overflow-x:auto;}',
      '.xh-seg button{border:0;background:transparent;font:inherit;font-size:.75rem;font-weight:600;padding:.375rem .875rem;border-radius:99px;color:var(--text-3);cursor:pointer;width:auto;white-space:nowrap;}',
      '.xh-seg button.is-on{background:var(--bg-base);color:var(--text-1);box-shadow:0 1px 4px rgba(0,0,0,.12);}',
      '.xh-q{background:var(--bg-base);border:1px solid var(--border);border-left-width:4px;border-radius:var(--r-xl);padding:1rem;margin-bottom:.875rem;min-width:0;scroll-margin-top:1rem;}',
      '.xh-q.ok{border-left-color:var(--success);} .xh-q.bad{border-left-color:var(--danger);} .xh-q.skip{border-left-color:var(--text-4);}',
      '.xh-qhead{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.625rem;}',
      '.xh-qn{font-size:.6875rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3);}',
      '.xh-pill{font-size:.6875rem;font-weight:700;padding:.1875rem .625rem;border-radius:99px;}',
      '.xh-pill.ok{background:var(--success-subtle);color:var(--success);} .xh-pill.bad{background:var(--danger-subtle);color:var(--danger);} .xh-pill.skip{background:var(--bg-subtle);color:var(--text-3);}',
      '.xh-qt{font-size:.9375rem;font-weight:600;line-height:1.55;margin:0 0 .75rem;overflow-wrap:anywhere;white-space:pre-line;}',
      '.xh-opts{display:flex;flex-direction:column;gap:.5rem;}',
      '.xh-opt{display:flex;align-items:flex-start;gap:.625rem;padding:.625rem .75rem;border:1px solid var(--border);border-radius:var(--r-lg);font-size:.875rem;line-height:1.5;min-width:0;}',
      '.xh-opt i{font-style:normal;flex:none;width:1.5rem;height:1.5rem;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:.6875rem;font-weight:700;background:var(--bg-subtle);color:var(--text-2);}',
      '.xh-opt div{min-width:0;overflow-wrap:anywhere;flex:1;}',
      '.xh-opt em{font-style:normal;font-size:.6875rem;font-weight:700;flex:none;margin-left:auto;padding-left:.5rem;}',
      '.xh-opt.right{border-color:var(--success);background:var(--success-subtle);} .xh-opt.right i{background:var(--success);color:#fff;} .xh-opt.right em{color:var(--success);}',
      '.xh-opt.wrong{border-color:var(--danger);background:var(--danger-subtle);} .xh-opt.wrong i{background:var(--danger);color:#fff;} .xh-opt.wrong em{color:var(--danger);}',
      '.xh-exp{margin-top:.75rem;padding:.75rem .875rem;background:var(--bg-subtle);border-radius:var(--r-lg);font-size:.8125rem;line-height:1.65;color:var(--text-2);overflow-wrap:anywhere;white-space:pre-line;}',
      '.xh-exp b{display:block;font-size:.6875rem;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3);margin-bottom:.25rem;}',
      '.xh-note{font-size:.75rem;color:var(--text-3);background:var(--bg-subtle);border-radius:var(--r-lg);padding:.625rem .875rem;margin:.5rem 0 1rem;line-height:1.5;}',
      '.xh-q img,.xh-q svg{max-width:100%;}',
      '@media (min-width:640px){.xh{padding:1.5rem 1.5rem 5rem;}.xh-chips{margin:0;padding-left:0;padding-right:0;}}',
      '@media (prefers-reduced-motion:reduce){.xh-skel{animation:none;}.xh-card{transition:none;}}',
      /* teacher panel */
      '.xa{max-width:44rem;display:flex;flex-direction:column;gap:1rem;}',
      '.xa-card{background:var(--surface,var(--bg-base,#fff));border:1px solid var(--border,#ddd);border-radius:12px;padding:1rem;display:flex;flex-direction:column;gap:.75rem;}',
      '.xa h2{margin:0;font-size:1.125rem;} .xa-muted{margin:0;font-size:.8125rem;color:var(--text-3,#666);}',
      '.xa-row{display:flex;align-items:center;gap:.5rem;font-size:.875rem;cursor:pointer;} .xa-row input{width:auto;margin:0;flex:none;}',
      '.xa-chips{display:flex;flex-wrap:wrap;gap:.5rem;}',
      '.xa-chip{display:inline-flex;align-items:center;gap:.375rem;padding:.3rem .6rem;border:1px solid var(--border,#ccc);border-radius:999px;font-size:.8125rem;cursor:pointer;} .xa-chip input{width:auto;margin:0;} .xa-chip.is-on{background:var(--accent-subtle,#e8f0fe);border-color:var(--accent,#2563eb);}',
      '.xa-list{max-height:18rem;overflow:auto;border:1px solid var(--border,#ddd);border-radius:10px;}',
      '.xa-item{display:flex;align-items:center;gap:.625rem;padding:.5rem .75rem;font-size:.8125rem;border-bottom:1px solid var(--border,#eee);cursor:pointer;} .xa-item:last-child{border-bottom:0;} .xa-item input{width:auto;margin:0;flex:none;} .xa-item span{min-width:0;overflow-wrap:anywhere;flex:1;} .xa-item small{color:var(--text-3,#777);flex:none;}',
      '.xa-off{opacity:.45;pointer-events:none;}',
      '.xa-foot{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;}',
      '.xa-warn{color:#b45309;}'
    ].join('');
    document.head.appendChild(st);
  }

  /* ───────── data ───────── */
  async function fetchResults() {
    var uid = app().userId;
    var q = db().collection('results').where('uid', '==', uid);
    var snap;
    try { snap = await q.get(); }
    catch (e) {
      try { snap = await q.get({ source: 'cache' }); } catch (e2) { throw e; }
    }
    var out = [];
    snap.forEach(function (d) { var r = d.data() || {}; r._id = d.id; r._ms = ms(r); out.push(r); });
    out.sort(function (a, b) { return b._ms - a._ms; });
    return out;
  }

  /* ───────── list view ───────── */
  function skeletonList() {
    var cards = '';
    for (var i = 0; i < 4; i++) cards += '<div class="xh-skel" style="height:5rem;margin-bottom:.625rem;border-radius:var(--r-xl)"></div>';
    return '<div class="xh" aria-busy="true" aria-label="Loading exam history"><div class="xh-skel" style="height:2.5rem;width:60%;margin-bottom:1.25rem"></div>' +
      '<div class="xh-skel" style="height:4rem;margin-bottom:1.5rem"></div>' + cards + '</div>';
  }
  function topBar(title, sub, backFn) {
    return '<div class="xh-top"><button class="xh-back" type="button" aria-label="Back" onclick="' + backFn + '"><i class="ph ph-arrow-left"></i></button>' +
      '<div style="min-width:0"><h1 class="xh-h1">' + esc(title) + '</h1>' + (sub ? '<p class="xh-sub">' + esc(sub) + '</p>' : '') + '</div></div>';
  }
  function resultTitle(r) {
    var s = Array.isArray(r.subjects) ? r.subjects : [];
    return s.length ? s.join(', ') : 'Exam';
  }
  function renderList() {
    var rs = S.list || [];
    var html = '<div class="xh">' + topBar('My exam history', rs.length ? rs.length + (rs.length === 1 ? ' exam' : ' exams') + ' taken' : '', 'ExamHistory.close()');
    if (!rs.length) {
      html += '<div class="xh-empty"><b>No exams yet</b>Exams you take will appear here so you can review them any time.</div></div>';
      return mount(html);
    }
    var sum = 0, best = 0;
    rs.forEach(function (r) { var p = Number(r.percentage) || 0; sum += p; if (p > best) best = p; });
    html += '<div class="xh-stats"><div class="xh-stat"><b>' + rs.length + '</b><span>Exams</span></div>' +
      '<div class="xh-stat"><b>' + Math.round(sum / rs.length) + '%</b><span>Average</span></div>' +
      '<div class="xh-stat"><b>' + best + '%</b><span>Best</span></div></div>';
    var lastMonth = null;
    rs.forEach(function (r) {
      var m = monthLabel(r._ms);
      if (m !== lastMonth) { html += '<p class="xh-month">' + esc(m) + '</p>'; lastMonth = m; }
      var p = Number(r.percentage) || 0, col = gradeColor(r.grade);
      var has = !!r.questionSnapshots;
      html += '<button type="button" class="xh-card" data-open="' + esc(r._id) + '">' +
        '<span class="xh-ringwrap">' + ring(p, col, 56, 5) + '<span style="color:' + col + '">' + p + '%</span></span>' +
        '<span class="xh-cbody"><span class="xh-ctitle" style="display:block">' + esc(resultTitle(r)) + '</span>' +
        '<span class="xh-cmeta"><span>' + esc(fmtDate(r._ms)) + (r._ms ? ' · ' + esc(fmtTime(r._ms)) : '') + '</span>' +
        '<span class="xh-grade" style="color:' + col + '">Grade ' + esc(r.grade || '-') + '</span>' +
        (r.crossClass && r.examClassLabel ? '<span class="xh-tag">' + esc(r.examClassLabel) + ' exam</span>' : '') +
        (has ? '' : '<span class="xh-tag">Summary only</span>') + '</span></span>' +
        '<span class="xh-chev"><i class="ph ph-caret-right"></i></span></button>';
    });
    html += '</div>';
    mount(html);
    document.querySelectorAll('.xh-card').forEach(function (b) {
      b.addEventListener('click', function () { openResult(b.getAttribute('data-open')); });
    });
  }

  function mount(html) {
    if (window.UI && UI.mount) UI.mount(html);
    else { var a = document.getElementById('app'); if (a) a.innerHTML = html; }
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  /* ───────── detail view ───────── */
  function statusOf(q) {
    if (q.chosen === null || q.chosen === undefined) return 'skip';
    return Number(q.chosen) === Number(q.ans) ? 'ok' : 'bad';
  }
  function qCard(r, subj, q, i, qs) {
    var st = statusOf(q), L = 'ABCDEF';
    var opts = Array.isArray(q.opts) ? q.opts : [];
    var passage = '';
    if (q.passage && (i === 0 || !q.passageId || !qs[i - 1] || qs[i - 1].passageId !== q.passageId) && window.Exam && Exam._passageHtml) {
      try { passage = Exam._passageHtml({ passages: {} }, subj, q, i, qs, true); } catch (e) { passage = ''; }
    }
    var h = '<article class="xh-q ' + st + '" id="xhq-' + i + '">' + passage +
      '<div class="xh-qhead"><span class="xh-qn">Question ' + (i + 1) + '</span><span class="xh-pill ' + st + '">' +
      (st === 'ok' ? 'Correct' : st === 'bad' ? 'Wrong' : 'Not answered') + '</span></div>' +
      '<p class="xh-qt">' + safe(q.q) + '</p>' + diag(q.svg, 'question') + '<div class="xh-opts">';
    if (!opts.length) h += '<div class="xh-note">The options for this question were not saved.</div>';
    opts.forEach(function (o, k) {
      var cls = '', tag = '';
      if (k === Number(q.ans)) { cls = ' right'; tag = (st === 'ok') ? 'Your answer' : 'Correct'; }
      if (st === 'bad' && k === Number(q.chosen)) { cls = ' wrong'; tag = 'Your answer'; }
      h += '<div class="xh-opt' + cls + '"><i>' + (L[k] || (k + 1)) + '</i><div>' + safe(o) + optDiag(q, k) + '</div>' + (tag ? '<em>' + tag + '</em>' : '') + '</div>';
    });
    h += '</div>';
    if (q.exp && String(q.exp).trim()) h += '<div class="xh-exp"><b>Explanation</b>' + safe(q.exp) + diag(q.expSvg, 'explanation') + '</div>';
    else if (q.expSvg) h += '<div class="xh-exp"><b>Explanation</b>' + diag(q.expSvg, 'explanation') + '</div>';
    return h + '</article>';
  }
  function subjStats(r, subj) {
    var qs = (r.questionSnapshots && r.questionSnapshots[subj]) || [];
    var c = 0; qs.forEach(function (q) { if (statusOf(q) === 'ok') c++; });
    return { total: qs.length, correct: c, pct: qs.length ? Math.round(c / qs.length * 100) : 0 };
  }
  function renderDetail() {
    var r = (S.list || []).filter(function (x) { return x._id === S.openId; })[0];
    if (!r) { renderList(); return; }
    var col = gradeColor(r.grade), p = Number(r.percentage) || 0;
    var subs = r.questionSnapshots ? Object.keys(r.questionSnapshots) : (r.subjects || []);
    if (Array.isArray(r.subjects) && r.questionSnapshots) subs = r.subjects.filter(function (s) { return r.questionSnapshots[s]; }).concat(subs.filter(function (s) { return r.subjects.indexOf(s) < 0; }));
    if (!S.subj || subs.indexOf(S.subj) < 0) S.subj = subs[0] || '';

    var html = '<div class="xh">' + topBar(resultTitle(r), fmtDate(r._ms) + (r._ms ? ' · ' + fmtTime(r._ms) : ''), 'ExamHistory.backToList()');
    html += '<div class="xh-hero"><span class="xh-ringwrap">' + ring(p, col, 88, 8) + '<span style="color:' + col + '">' + p + '%</span></span>' +
      '<div><div class="xh-grade" style="color:' + col + ';display:inline-block;margin-bottom:.375rem">Grade ' + esc(r.grade || '-') + '</div>' +
      '<div class="xh-hnote">' + esc(r.name || '') + (r.class ? ' · ' + esc(r.class) : '') +
      (r.crossClass && r.examClassLabel ? '<br>You took the ' + esc(r.examClassLabel) + ' exam' : '') + '</div></div></div>';

    if (!r.questionSnapshots) {
      html += '<div class="xh-note">The questions for this exam were not saved, so only the scores are available.</div>';
      html += '<div class="xh-stats" style="grid-template-columns:repeat(auto-fit,minmax(8rem,1fr))">' +
        (r.subjects || []).map(function (s) {
          var sc = r.scores && r.scores[s] != null ? r.scores[s] : '-';
          return '<div class="xh-stat"><b>' + esc(sc) + (sc === '-' ? '' : '%') + '</b><span>' + esc(s) + '</span></div>';
        }).join('') + '</div></div>';
      return mount(html);
    }

    html += '<div class="xh-chips" role="tablist">' + subs.map(function (s) {
      var st = subjStats(r, s);
      return '<button type="button" role="tab" class="xh-chip' + (s === S.subj ? ' is-on' : '') + '" data-subj="' + esc(s) + '">' + esc(s) + ' <small>' + st.correct + '/' + st.total + '</small></button>';
    }).join('') + '</div>';

    var qs = r.questionSnapshots[S.subj] || [];
    html += '<div class="xh-nav" aria-label="Jump to question">' + qs.map(function (q, i) {
      return '<button type="button" class="xh-dot ' + statusOf(q) + '" data-jump="' + i + '" aria-label="Question ' + (i + 1) + '">' + (i + 1) + '</button>';
    }).join('') + '</div>';

    var counts = { all: qs.length, bad: 0, skip: 0 };
    qs.forEach(function (q) { var s = statusOf(q); if (s === 'bad') counts.bad++; if (s === 'skip') counts.skip++; });
    html += '<div class="xh-seg" role="tablist">' +
      '<button type="button" data-filter="all" class="' + (S.filter === 'all' ? 'is-on' : '') + '">All ' + counts.all + '</button>' +
      '<button type="button" data-filter="bad" class="' + (S.filter === 'bad' ? 'is-on' : '') + '">Wrong ' + counts.bad + '</button>' +
      '<button type="button" data-filter="skip" class="' + (S.filter === 'skip' ? 'is-on' : '') + '">Not answered ' + counts.skip + '</button></div>';

    if (!r.snapshotVersion || r.snapshotVersion < 2) {
      html += '<div class="xh-note">This exam was saved before diagrams were stored with results, so some diagrams may be missing.</div>';
    }
    var shown = 0;
    qs.forEach(function (q, i) {
      if (S.filter !== 'all' && statusOf(q) !== S.filter) return;
      shown++; html += qCard(r, S.subj, q, i, qs);
    });
    if (!shown) html += '<div class="xh-empty"><b>Nothing here</b>' + (S.filter === 'bad' ? 'You got no questions wrong in this subject.' : 'You answered every question in this subject.') + '</div>';
    html += '</div>';
    mount(html);

    document.querySelectorAll('.xh-chip').forEach(function (b) {
      b.addEventListener('click', function () { S.subj = b.getAttribute('data-subj'); S.filter = 'all'; renderDetail(); });
    });
    document.querySelectorAll('.xh-seg button').forEach(function (b) {
      b.addEventListener('click', function () { S.filter = b.getAttribute('data-filter'); renderDetail(); });
    });
    document.querySelectorAll('.xh-dot').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = b.getAttribute('data-jump');
        if (S.filter !== 'all') { S.filter = 'all'; renderDetail(); }
        var el = document.getElementById('xhq-' + i);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    math();
  }

  /* ───────── public student API ───────── */
  async function load(force) {
    mount(skeletonList());
    try {
      if (!(await canAccess(true))) {
        mount('<div class="xh">' + topBar('My exam history', '', 'ExamHistory.close()') +
          '<div class="xh-empty"><b>Not available</b>Your teacher has not turned on exam history for you.</div></div>');
        return;
      }
      if (force || !S.list) S.list = await fetchResults();
      S.err = '';
      renderList();
    } catch (e) {
      mount('<div class="xh">' + topBar('My exam history', '', 'ExamHistory.close()') +
        '<div class="xh-empty"><b>Could not load your history</b>' + esc((e && e.message) || 'Check your connection and try again.') +
        '<br><button class="xh-btn" type="button" onclick="ExamHistory.retry()">Try again</button></div></div>');
    }
  }
  async function open() {
    var st = app();
    if (st.exam) { toast('Finish your current exam first.', 'info'); return; }
    styles();
    S.openId = null; S.subj = ''; S.filter = 'all';
    await load(true);
  }
  function openResult(id) { S.openId = id; S.subj = ''; S.filter = 'all'; renderDetail(); }
  function backToList() { S.openId = null; renderList(); }
  function retry() { load(true); }
  function close() {
    S.openId = null;
    if (window.Exam && Exam.renderSubjectSelection) Exam.renderSubjectSelection();
  }

  /* ───────── teacher panel ───────── */
  function aSkeleton() {
    return '<div class="xa" aria-busy="true"><div class="xh-skel" style="height:1.4rem;width:10rem"></div>' +
      '<div class="xa-card"><div class="xh-skel" style="height:1rem;width:40%"></div><div class="xh-skel" style="height:1rem;width:55%"></div>' +
      '<div class="xh-skel" style="height:8rem"></div><div class="xh-skel" style="height:2.2rem;width:5.5rem"></div></div></div>';
  }
  function aErr(msg) {
    return '<div class="xa"><div class="xa-card" style="border-color:#dc2626"><p class="xa-muted" style="color:inherit;font-weight:600">Exam History settings could not load</p><p class="xa-muted">' + esc(msg) +
      '</p><div><button type="button" class="xh-btn" data-aact="retry" style="margin-top:0">Try again</button></div></div></div>';
  }
  function mode() { return A.cfg.all ? 'all' : (A.cfg.off ? 'off' : 'some'); }
  function aDraw() {
    var c = A.cfg, m = mode();
    var classes = {}, byKey = {};
    A.students.forEach(function (s) { var k = classKey(s.class); if (k) { byKey[k] = s.class; } });
    Object.keys(byKey).forEach(function (k) { classes[k] = byKey[k]; });
    c.classes.forEach(function (k) { if (!classes[k]) classes[k] = k.toUpperCase(); });
    var q = A.q.trim().toLowerCase();
    var list = A.students.filter(function (s) { return !q || (s.name || '').toLowerCase().indexOf(q) >= 0 || (s.class || '').toLowerCase().indexOf(q) >= 0; });
    var shown = list.slice(0, 80);
    var summary = m === 'all' ? 'On for every student' : m === 'off' ? 'Off for everyone'
      : (!c.classes.length && !c.uids.length ? 'Nobody selected yet' : c.classes.length + ' class(es) and ' + c.uids.length + ' student(s) selected');
    A.root.innerHTML = '<div class="xa"><div><h2>Exam History</h2>' +
      '<p class="xa-muted">Let chosen students look back at their own past exams and review them with answers and explanations. It is off for everyone until you turn it on.</p></div>' +
      '<div class="xa-card">' +
      '<label class="xa-row"><input type="radio" name="xa-mode" value="off"' + (m === 'off' ? ' checked' : '') + '> Off for everyone</label>' +
      '<label class="xa-row"><input type="radio" name="xa-mode" value="some"' + (m === 'some' ? ' checked' : '') + '> Only selected classes and students</label>' +
      '<label class="xa-row"><input type="radio" name="xa-mode" value="all"' + (m === 'all' ? ' checked' : '') + '> Every student</label>' +
      '<div class="' + (m === 'some' ? '' : 'xa-off') + '"><p class="xa-muted" style="margin:.5rem 0">Classes</p><div class="xa-chips">' +
      (Object.keys(classes).sort().map(function (k) {
        var on = c.classes.indexOf(k) >= 0;
        return '<label class="xa-chip' + (on ? ' is-on' : '') + '"><input type="checkbox" data-cls="' + esc(k) + '"' + (on ? ' checked' : '') + '> ' + esc(classes[k]) + '</label>';
      }).join('') || '<span class="xa-muted">No classes found yet.</span>') +
      '</div><p class="xa-muted" style="margin:.875rem 0 .5rem">Individual students</p>' +
      '<input type="search" data-aq placeholder="Search name or class" value="' + esc(A.q) + '" style="width:100%;margin-bottom:.5rem" autocomplete="off">' +
      '<div class="xa-list">' + (shown.map(function (s) {
        var on = c.uids.indexOf(s.uid) >= 0;
        return '<label class="xa-item"><input type="checkbox" data-uid="' + esc(s.uid) + '"' + (on ? ' checked' : '') + '><span>' + esc(s.name || 'Unnamed') + '</span><small>' + esc(s.class || '') + '</small></label>';
      }).join('') || '<div class="xa-item"><span class="xa-muted">No students match.</span></div>') +
      (list.length > shown.length ? '<div class="xa-item"><span class="xa-muted">Showing the first ' + shown.length + '. Search to narrow down.</span></div>' : '') +
      '</div></div>' +
      '<div class="xa-foot"><button type="button" class="xh-btn" data-aact="save" style="margin-top:0"' + (A.busy ? ' disabled' : '') + '>Save</button>' +
      '<span class="xa-muted' + (m === 'some' && !c.classes.length && !c.uids.length ? ' xa-warn' : '') + '">' + esc(summary) + (A.dirty ? ' (unsaved changes)' : '') + '</span></div></div></div>';
    var qi = A.root.querySelector('[data-aq]');
    if (qi && A.focusSearch) { qi.focus(); try { qi.setSelectionRange(qi.value.length, qi.value.length); } catch (e) {} }
    A.focusSearch = false;
  }
  async function aLoad() {
    A.root.innerHTML = aSkeleton();
    try {
      var snap = await db().collection(CFG.col).doc(CFG.id).get();
      var d = snap.exists ? (snap.data() || {}) : {};
      A.cfg = { all: d.all === true, off: !(d.all === true) && !(d.classes && d.classes.length) && !(d.uids && d.uids.length),
        classes: (Array.isArray(d.classes) ? d.classes : []).map(classKey), uids: Array.isArray(d.uids) ? d.uids.slice() : [] };
      var ss = await db().collection('students').get();
      A.students = [];
      ss.forEach(function (x) { var s = x.data() || {}; A.students.push({ uid: x.id, name: s.name || '', class: s.class || '' }); });
      A.students.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
      A.dirty = false; A.q = '';
      aDraw();
    } catch (e) {
      var denied = e && (e.code === 'permission-denied' || /permission/i.test(e.message || ''));
      A.root.innerHTML = aErr(denied ? 'Firestore refused the request. Publish the appSettings rule, then try again.' : ((e && e.message) || 'Unknown error'));
    }
  }
  async function aSave() {
    if (A.busy) return;
    var c = A.cfg, m = mode();
    var payload = { all: m === 'all', classes: m === 'some' ? c.classes : [], uids: m === 'some' ? c.uids : [], updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    A.busy = true; aDraw();
    try {
      await db().collection(CFG.col).doc(CFG.id).set(payload);
      A.dirty = false; cfgCache = { at: 0, data: null };
      toast('Exam history settings saved.', 'success');
    } catch (e) {
      toast('Could not save: ' + ((e && e.message) || e), 'error');
    }
    A.busy = false; aDraw();
  }
  function aEvents(e) {
    var t = e.target;
    if (t.closest && t.closest('[data-aact="retry"]')) { aLoad(); return; }
    if (t.closest && t.closest('[data-aact="save"]')) { aSave(); return; }
  }
  function aChange(e) {
    var t = e.target;
    if (t.name === 'xa-mode') {
      var v = t.value;
      A.cfg.all = v === 'all'; A.cfg.off = v === 'off';
    } else if (t.hasAttribute && t.hasAttribute('data-cls')) {
      var k = t.getAttribute('data-cls'), i = A.cfg.classes.indexOf(k);
      if (t.checked && i < 0) A.cfg.classes.push(k); if (!t.checked && i >= 0) A.cfg.classes.splice(i, 1);
      if (A.cfg.off) A.cfg.off = false;
    } else if (t.hasAttribute && t.hasAttribute('data-uid')) {
      var u = t.getAttribute('data-uid'), j = A.cfg.uids.indexOf(u);
      if (t.checked && j < 0) A.cfg.uids.push(u); if (!t.checked && j >= 0) A.cfg.uids.splice(j, 1);
      if (A.cfg.off) A.cfg.off = false;
    } else return;
    A.dirty = true; aDraw();
  }
  function aInput(e) {
    if (e.target.hasAttribute && e.target.hasAttribute('data-aq')) { A.q = e.target.value; A.focusSearch = true; aDraw(); }
  }
  async function renderAdmin(id) {
    var root = document.getElementById(id);
    if (!root) return;
    styles();
    if (!app().isTeacher) { root.innerHTML = aErr('Teacher login required.'); A.root = root; return; }
    if (A.root !== root) {
      A.root = root;
      root.addEventListener('click', aEvents);
      root.addEventListener('change', aChange);
      root.addEventListener('input', aInput);
    }
    if (!db()) { root.innerHTML = aErr('The database is not ready yet.'); return; }
    await aLoad();
  }

  window.ExamHistory = {
    canAccess: canAccess, revealTile: revealTile, open: open, close: close,
    backToList: backToList, retry: retry, renderAdmin: renderAdmin,
  };
})();
