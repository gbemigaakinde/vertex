/* ════════════════════════════════════════════════════════════════
   student-sync.js
   ────────────────────────────────────────────────────────────────
   Several parts of the app keep their own COPY of a student's name
   (games, challenges, group chats, DM threads, leaderboard...).
   When a teacher renames or deletes a student, those copies used to
   be left behind. This file keeps them in step.

   Public API (teacher side only):

     StudentSync.renameEverywhere(uid, { name, class, school })
         Call after a student's record has been edited.

     StudentSync.purgeEverywhere(uid)
         Call after a student has been deleted. Removes the leftovers
         in games and group chats.

     StudentSync.repair(buttonEl)
         One-tap tidy-up of EVERYTHING that is already out of date:
         scans, shows what it found, asks, then fixes.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CHUNK = 400;

  function db() { return window.fbDb; }
  function FV() { return firebase.firestore.FieldValue; }
  function teacherUid() { return (window.AppConfig && AppConfig.TEACHER_UID) || ''; }

  /* ── Collections that hold a copy of student info ───────────── */

  // Games between two students: each side has a uid and a stored name.
  var PAIR_GAMES = [
    { coll: 'gameChallenges', label: 'Challenges',
      parts: [{ uid: 'challengerUid', name: 'challengerName' }, { uid: 'challengedUid', name: 'challengedName' }] },
    { coll: 'chessGames', label: 'Chess games',
      parts: [{ uid: 'whiteUid', name: 'whiteName' }, { uid: 'blackUid', name: 'blackName' }] },
    { coll: 'scrabbleGames', label: 'Scrabble games',
      parts: [{ uid: 'player1Uid', name: 'player1Name' }, { uid: 'player2Uid', name: 'player2Name' }] },
  ];

  // Collections where the document ID is the student's uid.
  // "remove" = delete the document when the student no longer exists.
  var BY_ID = [
    { coll: 'gameLeaderboard',  label: 'Leaderboard',      mirror: ['name', 'class', 'school'], remove: true },
    { coll: 'gameProfiles',     label: 'Game profiles',    mirror: ['class', 'school'],         remove: true },
    { coll: 'gameRestrictions', label: 'Game restrictions', mirror: [],                         remove: true },
  ];

  // Collections with many rows per student, each row carrying a uid field.
  var BY_FIELD = [
    { coll: 'gameResults',  label: 'Game results',  field: 'uid', mirror: ['name'], remove: true },
    { coll: 'gameSessions', label: 'Game sessions', field: 'uid', mirror: ['name'], remove: true },
  ];

  /* ── Small helpers ──────────────────────────────────────────── */

  async function commit(ops) {
    for (var i = 0; i < ops.length; i += CHUNK) {
      var batch = db().batch();
      ops.slice(i, i + CHUNK).forEach(function (o) {
        if (o.type === 'delete') batch.delete(o.ref);
        else batch.update(o.ref, o.data);
      });
      await batch.commit();
    }
  }

  // Which of the listed fields differ from the live record?
  function diff(data, rec, fields) {
    var out = {}, changed = false;
    fields.forEach(function (f) {
      var live = rec[f];
      if (live != null && live !== '' && data[f] !== undefined && data[f] !== live) {
        out[f] = live; changed = true;
      }
    });
    return changed ? out : null;
  }

  function uniqueDocs(lists) {
    var seen = {}, out = [];
    lists.forEach(function (snap) {
      snap.forEach(function (d) { if (!seen[d.id]) { seen[d.id] = 1; out.push(d); } });
    });
    return out;
  }

  /* ── Step builders ──────────────────────────────────────────────
     Each step returns a list of operations:
       { type:'update', ref, data, kind:'rename' }
       { type:'delete', ref, kind:'remove' }
     `lookup(uid)` answers:  record  = student exists, here are the live details
                             null    = student has been deleted
                             undefined = not our business, leave alone
     `uid` is set when working on ONE student, and empty for a full scan. */

  async function pairGameStep(spec, lookup, uid) {
    var docs;
    if (uid) {
      docs = uniqueDocs(await Promise.all(spec.parts.map(function (p) {
        return db().collection(spec.coll).where(p.uid, '==', uid).get();
      })));
    } else {
      docs = (await db().collection(spec.coll).get()).docs;
    }
    var ops = [];
    docs.forEach(function (d) {
      var data = d.data() || {};
      var gone = false, patch = {}, patched = false;
      spec.parts.forEach(function (p) {
        var rec = lookup(data[p.uid]);
        if (rec === null) { gone = true; return; }
        if (rec && rec.name && data[p.name] !== undefined && data[p.name] !== rec.name) {
          patch[p.name] = rec.name; patched = true;
        }
      });
      if (gone) ops.push({ type: 'delete', ref: d.ref, kind: 'remove' });
      else if (patched) ops.push({ type: 'update', ref: d.ref, data: patch, kind: 'rename' });
    });
    return ops;
  }

  async function byIdStep(spec, lookup, uid) {
    var docs;
    if (uid) {
      var one = await db().collection(spec.coll).doc(uid).get();
      docs = one.exists ? [one] : [];
    } else {
      docs = (await db().collection(spec.coll).get()).docs;
    }
    var ops = [];
    docs.forEach(function (d) {
      var rec = lookup(d.id);
      if (rec === null) { if (spec.remove) ops.push({ type: 'delete', ref: d.ref, kind: 'remove' }); return; }
      if (!rec) return;
      var patch = diff(d.data() || {}, rec, spec.mirror);
      if (patch) ops.push({ type: 'update', ref: d.ref, data: patch, kind: 'rename' });
    });
    return ops;
  }

  async function byFieldStep(spec, lookup, uid) {
    var docs = uid
      ? (await db().collection(spec.coll).where(spec.field, '==', uid).get()).docs
      : (await db().collection(spec.coll).get()).docs;
    var ops = [];
    docs.forEach(function (d) {
      var data = d.data() || {};
      var rec = lookup(data[spec.field]);
      if (rec === null) { if (spec.remove) ops.push({ type: 'delete', ref: d.ref, kind: 'remove' }); return; }
      if (!rec) return;
      var patch = diff(data, rec, spec.mirror);
      if (patch) ops.push({ type: 'update', ref: d.ref, data: patch, kind: 'rename' });
    });
    return ops;
  }

  // Group chats keep a list of members with their names.
  async function groupStep(lookup, uid) {
    var docs = uid
      ? (await db().collection('groupChats').where('memberUids', 'array-contains', uid).get()).docs
      : (await db().collection('groupChats').get()).docs;
    var ops = [];
    docs.forEach(function (d) {
      var data = d.data() || {};
      var members = Array.isArray(data.members) ? data.members : [];
      var removed = [], changed = false;
      var next = [];
      members.forEach(function (m) {
        var rec = lookup(m.uid);
        if (rec === null) { removed.push(m.uid); changed = true; return; }
        if (rec && ((rec.name && m.name !== rec.name) || (rec.class != null && m.cls !== rec.class))) {
          next.push(Object.assign({}, m, { name: rec.name || m.name, cls: rec.class != null ? rec.class : m.cls }));
          changed = true;
        } else {
          next.push(m);
        }
      });
      if (!changed) return;
      var patch = { members: next, memberUids: next.map(function (m) { return m.uid; }) };
      removed.forEach(function (u) { patch['unread.' + u] = FV().delete(); });
      ops.push({ type: 'update', ref: d.ref, data: patch, kind: removed.length ? 'remove' : 'rename' });
    });
    return ops;
  }

  /* Extra steps that only make sense in a full scan ─────────────── */

  // Teacher/student DM threads.
  async function dmStep(lookup) {
    var snap = await db().collection('directMessages').get();
    var ops = [];
    for (var i = 0; i < snap.docs.length; i++) {
      var d = snap.docs[i], data = d.data() || {};
      var rec = lookup(d.id);
      if (rec === null) {
        var msgs = await d.ref.collection('messages').get();
        for (var j = 0; j < msgs.docs.length; j++) {
          try {
            var eh = await msgs.docs[j].ref.collection('editHistory').get();
            eh.forEach(function (x) { ops.push({ type: 'delete', ref: x.ref, kind: 'remove' }); });
          } catch (e) { /* no edit history, fine */ }
          ops.push({ type: 'delete', ref: msgs.docs[j].ref, kind: 'remove' });
        }
        ops.push({ type: 'delete', ref: d.ref, kind: 'remove' });
      } else if (rec) {
        var patch = {};
        if (rec.name && data.studentName !== undefined && data.studentName !== rec.name) patch.studentName = rec.name;
        if (rec.class != null && data.studentClass !== undefined && data.studentClass !== rec.class) patch.studentClass = rec.class;
        if (Object.keys(patch).length) ops.push({ type: 'update', ref: d.ref, data: patch, kind: 'rename' });
      }
    }
    return ops;
  }

  // Private messages sent to a student who no longer exists.
  async function privateMessageStep(lookup) {
    var snap = await db().collection('privateMessages').get();
    var ops = [];
    snap.forEach(function (d) {
      if (lookup((d.data() || {}).recipientId) === null) ops.push({ type: 'delete', ref: d.ref, kind: 'remove' });
    });
    return ops;
  }

  // Exam results (name copy and leftovers).
  async function resultsStep(lookup) {
    var snap = await db().collection('results').get();
    var ops = [];
    snap.forEach(function (d) {
      var data = d.data() || {};
      if (!data.uid) return;
      var rec = lookup(data.uid);
      if (rec === null) { ops.push({ type: 'delete', ref: d.ref, kind: 'remove' }); return; }
      if (!rec) return;
      var patch = diff(data, rec, ['name']);
      if (patch) ops.push({ type: 'update', ref: d.ref, data: patch, kind: 'rename' });
    });
    return ops;
  }

  // Public chat: keep history, but show the current name.
  async function publicChatStep(lookup) {
    var snap = await db().collection('publicChat').get();
    var ops = [];
    snap.forEach(function (d) {
      var data = d.data() || {};
      var rec = lookup(data.senderId);
      if (!rec) return;
      var patch = {};
      if (rec.name && data.senderName !== undefined && data.senderName !== rec.name) patch.senderName = rec.name;
      if (rec.class != null && data.senderClass !== undefined && data.senderClass !== rec.class) patch.senderClass = rec.class;
      if (Object.keys(patch).length) ops.push({ type: 'update', ref: d.ref, data: patch, kind: 'rename' });
    });
    return ops;
  }

  // Personal coaching tasks: documents named student_<uid> / weekly_student_<uid>.
  async function taskStep(lookup) {
    var snap = await db().collection('coachingTasks').get();
    var ops = [];
    snap.forEach(function (d) {
      var m = /^(?:weekly_)?student_(.+)$/.exec(d.id);
      if (!m) return;
      var rec = lookup(m[1]);
      if (rec === null) { ops.push({ type: 'delete', ref: d.ref, kind: 'remove' }); return; }
      if (!rec) return;
      var patch = diff(d.data() || {}, { studentName: rec.name }, ['studentName']);
      if (patch) ops.push({ type: 'update', ref: d.ref, data: patch, kind: 'rename' });
    });
    return ops;
  }

  // Student documents that were quietly re-created by an old heartbeat
  // after the student was deleted. They hold no name, class or email.
  async function ghostStep(ghostIds) {
    return ghostIds.map(function (id) {
      return { type: 'delete', ref: db().collection('students').doc(id), kind: 'remove' };
    });
  }

  /* ── Plan + apply ───────────────────────────────────────────── */

  function allSteps(lookup, uid, ghostIds) {
    var steps = [];
    PAIR_GAMES.forEach(function (s) { steps.push({ label: s.label, run: function () { return pairGameStep(s, lookup, uid); } }); });
    BY_ID.forEach(function (s)      { steps.push({ label: s.label, run: function () { return byIdStep(s, lookup, uid); } }); });
    BY_FIELD.forEach(function (s)   { steps.push({ label: s.label, run: function () { return byFieldStep(s, lookup, uid); } }); });
    steps.push({ label: 'Group chats', run: function () { return groupStep(lookup, uid); } });

    if (!uid) { // full scan only
      steps.push({ label: 'Direct messages',  run: function () { return dmStep(lookup); } });
      steps.push({ label: 'Private messages', run: function () { return privateMessageStep(lookup); } });
      steps.push({ label: 'Exam results',     run: function () { return resultsStep(lookup); } });
      steps.push({ label: 'Public chat',      run: function () { return publicChatStep(lookup); } });
      steps.push({ label: 'Coaching tasks',   run: function () { return taskStep(lookup); } });
      steps.push({ label: 'Leftover profiles', run: function () { return ghostStep(ghostIds || []); } });
    }
    return steps;
  }

  async function buildPlan(lookup, uid, ghostIds, onProgress) {
    var steps = allSteps(lookup, uid, ghostIds);
    var plan = { groups: [], failed: [] };
    for (var i = 0; i < steps.length; i++) {
      if (onProgress) onProgress('Checking ' + steps[i].label.toLowerCase() + '…');
      try {
        var ops = await steps[i].run();
        if (ops.length) plan.groups.push({ label: steps[i].label, ops: ops });
      } catch (e) {
        console.warn('[StudentSync] could not check ' + steps[i].label + ':', e);
        plan.failed.push(steps[i].label);
      }
    }
    return plan;
  }

  async function applyPlan(plan, onProgress) {
    var report = { renamed: 0, removed: 0, failed: plan.failed.slice() };
    for (var i = 0; i < plan.groups.length; i++) {
      var g = plan.groups[i];
      if (onProgress) onProgress('Updating ' + g.label.toLowerCase() + '…');
      try {
        await commit(g.ops);
        g.ops.forEach(function (o) { if (o.kind === 'remove') report.removed++; else report.renamed++; });
      } catch (e) {
        console.warn('[StudentSync] could not update ' + g.label + ':', e);
        report.failed.push(g.label);
      }
    }
    return report;
  }

  function count(plan, kind) {
    var n = 0;
    plan.groups.forEach(function (g) { g.ops.forEach(function (o) { if (o.kind === kind) n++; }); });
    return n;
  }

  /* ── Public: one student ────────────────────────────────────── */

  async function renameEverywhere(uid, rec) {
    if (!uid || !rec) return { renamed: 0, removed: 0, failed: [] };
    var lookup = function (u) { return u === uid ? rec : undefined; };
    var plan = await buildPlan(lookup, uid, []);
    return applyPlan(plan);
  }

  async function purgeEverywhere(uid) {
    if (!uid) return { renamed: 0, removed: 0, failed: [] };
    var lookup = function (u) { return u === uid ? null : undefined; };
    var plan = await buildPlan(lookup, uid, []);
    return applyPlan(plan);
  }

  /* ── Public: tidy everything ────────────────────────────────── */

  var _running = false;

  async function repair(btn) {
    if (_running) return;
    _running = true;
    if (btn && window.UI) UI.setLoading(btn, true);
    var toast = function (m, t, ms) { if (window.UI) UI.toast(m, t || 'info', ms || 3500); };

    try {
      toast('Checking student data. This can take a moment…', 'info', 4000);

      var snap = await db().collection('students').get();
      var valid = {}, ghostIds = [], validCount = 0;
      snap.forEach(function (d) {
        var x = d.data() || {};
        if (!x.name && !x.class && !x.email) { ghostIds.push(d.id); return; }
        valid[d.id] = { name: x.name || '', class: x.class || '', school: x.school || '' };
        validCount++;
      });

      // Safety: if the student list came back empty, something is wrong.
      // Never treat that as "everybody was deleted".
      if (validCount === 0) {
        toast('Could not read the student list, so nothing was changed.', 'error', 5000);
        return;
      }

      var tUid = teacherUid();
      var lookup = function (u) {
        if (!u || u === tUid) return undefined;
        return valid[u] || null;
      };

      var plan = await buildPlan(lookup, '', ghostIds, null);
      var renames = count(plan, 'rename');
      var removals = count(plan, 'remove');

      if (renames === 0 && removals === 0) {
        toast(plan.failed.length
          ? 'Nothing to fix, but these could not be checked: ' + plan.failed.join(', ') + '.'
          : 'Everything is already up to date.', plan.failed.length ? 'warning' : 'success', 5000);
        return;
      }

      var lines = [];
      if (renames)  lines.push(renames + ' out-of-date name' + (renames === 1 ? '' : 's') + ' or class' + (renames === 1 ? '' : 'es') + ' to update');
      if (removals) lines.push(removals + ' leftover record' + (removals === 1 ? '' : 's') + ' from deleted students to remove');
      var ok = window.UI && UI.confirmAction
        ? await UI.confirmAction('Found ' + lines.join(' and ') + '. Fix these now?')
        : window.confirm('Found ' + lines.join(' and ') + '. Fix these now?');
      if (!ok) return;

      var report = await applyPlan(plan, function (m) { if (window.UI) UI.toast(m, 'info', 1200); });
      var msg = 'Done. Updated ' + report.renamed + ', removed ' + report.removed + '.';
      if (report.failed.length) {
        toast(msg + ' Could not finish: ' + report.failed.join(', ') + '.', 'warning', 7000);
      } else {
        toast(msg, 'success', 5000);
      }
    } catch (e) {
      console.error('[StudentSync] repair failed:', e);
      toast('Could not finish the tidy-up. Please try again.', 'error', 5000);
    } finally {
      _running = false;
      if (btn && window.UI) UI.setLoading(btn, false);
    }
  }

  window.StudentSync = {
    renameEverywhere: renameEverywhere,
    purgeEverywhere:  purgeEverywhere,
    repair:           repair,
  };
}());
