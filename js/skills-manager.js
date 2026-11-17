/* ============================================================
   js/skills-manager.js — Teacher "AI Skills" tab

   Lets the teacher choose which Master Timothy AI skills are on and
   which classes may use each one. Stored at Firestore  aiSkills/config :
     { skills: { "<skillId>": { enabled, all, classes: ["sss3"] } }, updatedAt }
   The Worker (worker-skills.js) reads this document, so the setting is
   enforced on the server. A skill is only ever used when a student's
   question is about its topic AND the student's class is allowed here.

   Add a new skill here by adding an entry to SKILLS (id must match
   the id in worker-skills.js).
   Public API:  SkillsManager.render(containerId)
   ============================================================ */
(function () {
  'use strict';

  var DOC = { col: 'aiSkills', id: 'config' };
  var SKILLS = [
    {
      id: 'lekki-headmaster',
      name: 'The Lekki Headmaster (UTME novel)',
      desc: 'Master Timothy AI answers questions about the novel: chapters, characters, themes, devices and exam-style help. It is used only when a student asks about the novel.',
      defaults: { enabled: true, all: false, classes: ['sss3'] },
    },
  ];
  var BASE_CLASSES = ['jss1', 'jss2', 'jss3', 'sss1', 'sss2', 'sss3'];

  var S = { root: null, cfg: {}, dirty: {}, busy: false };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg, type) {
    if (window.UI && UI.toast) UI.toast(msg, type || 'info', 4000); else console.log('[Skills]', msg);
  }
  function isTeacher() { return !!(window.AppState && window.AppState.isTeacher); }
  function label(k) { return String(k).replace(/^([a-z]+)(\d+)$/i, function (_, a, b) { return a.toUpperCase() + ' ' + b; }); }

  function classList() {
    var set = {};
    BASE_CLASSES.forEach(function (k) { set[k] = 1; });
    try {
      var QL = window.QuestionLoader;
      [QL && QL.getBundled ? QL.getBundled() : {}, window.questions || {}].forEach(function (b) {
        Object.keys(b || {}).forEach(function (k) { set[k] = 1; });
      });
    } catch (e) { /* ignore */ }
    Object.keys(S.cfg).forEach(function (id) {
      ((S.cfg[id] && S.cfg[id].classes) || []).forEach(function (k) { set[k] = 1; });
    });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
  }

  function cfgFor(sk) {
    var c = S.cfg[sk.id];
    if (!c) c = JSON.parse(JSON.stringify(sk.defaults));
    return { enabled: c.enabled !== false, all: c.all === true, classes: (c.classes || []).slice() };
  }

  function styles() {
    if (document.getElementById('vtx-sk-css')) return;
    var st = document.createElement('style');
    st.id = 'vtx-sk-css';
    st.textContent =
      '.sk{display:flex;flex-direction:column;gap:1rem;max-width:44rem;}' +
      '.sk h2{margin:0;font-size:1.125rem;}' +
      '.sk-muted{color:var(--text-muted,#666);font-size:.8125rem;margin:0;}' +
      '.sk-card{background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:12px;padding:1rem;display:flex;flex-direction:column;gap:.75rem;}' +
      '.sk-head{display:flex;justify-content:space-between;align-items:flex-start;gap:.75rem;flex-wrap:wrap;}' +
      '.sk-title{font-weight:600;margin:0;}' +
      '.sk-row{display:flex;align-items:center;gap:.5rem;font-size:.875rem;cursor:pointer;}' +
      '.sk-row input{width:auto;margin:0;flex:none;}' +
      '.sk-classes{display:flex;flex-wrap:wrap;gap:.5rem;padding:.25rem 0 0 1.5rem;}' +
      '.sk-chip{display:inline-flex;align-items:center;gap:.375rem;padding:.3rem .6rem;border:1px solid var(--border,#ccc);border-radius:999px;font-size:.8125rem;cursor:pointer;}' +
      '.sk-chip input{width:auto;margin:0;}' +
      '.sk-chip.is-on{background:var(--primary-light,#e8f0fe);border-color:var(--primary,#2563eb);}' +
      '.sk-classes.is-off{opacity:.45;pointer-events:none;}' +
      '.sk-foot{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;}' +
      '.sk-btn{width:auto !important;padding:.5rem 1rem;border-radius:8px;border:1px solid var(--primary,#2563eb);background:var(--primary,#2563eb);color:#fff;cursor:pointer;font:inherit;font-size:.8125rem;}' +
      '.sk-btn:disabled{opacity:.5;cursor:not-allowed;}' +
      '.sk-state{font-size:.75rem;}' +
      '.sk-warn{color:#b45309;}';
    document.head.appendChild(st);
  }

  function summary(c) {
    if (!c.enabled) return 'Off for everyone';
    if (c.all) return 'On for all classes';
    if (!c.classes.length) return 'On, but no class selected (nobody can use it)';
    return 'On for: ' + c.classes.map(label).join(', ');
  }

  function draw() {
    var classes = classList();
    var html = '<div class="sk">' +
      '<div><h2>AI Skills</h2>' +
      '<p class="sk-muted">Skills give Master Timothy AI extra knowledge. A skill is used only when a student asks about its topic, and only for the classes you choose here.</p></div>';
    SKILLS.forEach(function (sk) {
      var c = cfgFor(sk);
      html += '<div class="sk-card" data-skill="' + esc(sk.id) + '">' +
        '<div class="sk-head"><div><p class="sk-title">' + esc(sk.name) + '</p>' +
        '<p class="sk-muted">' + esc(sk.desc) + '</p></div></div>' +
        '<label class="sk-row"><input type="checkbox" data-f="enabled"' + (c.enabled ? ' checked' : '') + '> Skill is on</label>' +
        '<label class="sk-row"><input type="radio" name="sk-scope-' + esc(sk.id) + '" data-f="all" value="all"' + (c.all ? ' checked' : '') + (c.enabled ? '' : ' disabled') + '> All classes</label>' +
        '<label class="sk-row"><input type="radio" name="sk-scope-' + esc(sk.id) + '" data-f="some" value="some"' + (!c.all ? ' checked' : '') + (c.enabled ? '' : ' disabled') + '> Only the classes I select</label>' +
        '<div class="sk-classes' + ((c.all || !c.enabled) ? ' is-off' : '') + '">' +
        classes.map(function (k) {
          var on = c.classes.indexOf(k) >= 0;
          return '<label class="sk-chip' + (on ? ' is-on' : '') + '"><input type="checkbox" data-cls="' + esc(k) + '"' + (on ? ' checked' : '') + '> ' + esc(label(k)) + '</label>';
        }).join('') + '</div>' +
        '<div class="sk-foot"><button type="button" class="sk-btn" data-act="save"' + (S.busy ? ' disabled' : '') + '>Save</button>' +
        '<span class="sk-state' + (c.enabled && !c.all && !c.classes.length ? ' sk-warn' : '') + '">' + esc(summary(c)) + (S.dirty[sk.id] ? ' (unsaved changes)' : '') + '</span></div>' +
        '</div>';
    });
    html += '</div>';
    S.root.innerHTML = html;
  }

  function readCard(card) {
    var out = { enabled: card.querySelector('[data-f="enabled"]').checked, all: false, classes: [] };
    out.all = card.querySelector('[data-f="all"]').checked;
    card.querySelectorAll('[data-cls]').forEach(function (i) { if (i.checked) out.classes.push(i.getAttribute('data-cls')); });
    return out;
  }

  function onChange(e) {
    var card = e.target.closest && e.target.closest('[data-skill]');
    if (!card) return;
    var id = card.getAttribute('data-skill');
    S.cfg[id] = readCard(card);
    S.dirty[id] = true;
    draw();
  }

  async function onClick(e) {
    var btn = e.target.closest && e.target.closest('[data-act="save"]');
    if (!btn || S.busy) return;
    var card = btn.closest('[data-skill]');
    var id = card.getAttribute('data-skill');
    var c = readCard(card);
    S.busy = true; draw();
    try {
      var patch = { skills: {}, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
      patch.skills[id] = { enabled: c.enabled, all: c.all, classes: c.classes };
      await window.fbDb.collection(DOC.col).doc(DOC.id).set(patch, { merge: true });
      S.cfg[id] = c; delete S.dirty[id];
      toast('Skill settings saved. Students get the change within a minute.', 'success');
    } catch (err) {
      toast('Could not save: ' + (err && err.message ? err.message : err) + '. Check that Firestore rules allow the teacher to write aiSkills/config.', 'error');
    }
    S.busy = false; draw();
  }

  async function render(containerId) {
    var root = document.getElementById(containerId);
    if (!root) return;
    if (!isTeacher()) { root.innerHTML = '<p>Teacher login required.</p>'; return; }
    styles();
    if (S.root !== root) {
      S.root = root;
      root.addEventListener('change', onChange);
      root.addEventListener('click', onClick);
    }
    if (!window.fbDb) { root.innerHTML = '<p>The database is not ready yet.</p>'; return; }
    root.innerHTML = '<p class="sk-muted">Loading…</p>';
    try {
      var snap = await window.fbDb.collection(DOC.col).doc(DOC.id).get();
      var d = snap.exists ? snap.data() : null;
      S.cfg = (d && d.skills && typeof d.skills === 'object') ? d.skills : {};
      S.dirty = {};
    } catch (e) {
      toast('Could not load skill settings: ' + (e && e.message ? e.message : e), 'error');
      S.cfg = {};
    }
    draw();
  }

  window.SkillsManager = { render: render };
})();
