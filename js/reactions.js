/* ============================================================
   reactions.js — WhatsApp-style message reactions for group chat

   Data model (on each message doc):
     reactions: { <uid>: { e: '👍', n: 'Display name' } }
   One reaction per person per message. Picking the same emoji again
   removes it; picking another one replaces it.

   UI:
   * Hold a message (touch) or right-click (desktop) -> floating picker
     (6 quick emoji + "+" for the full grid) and Reply / Copy actions.
   * Reaction chips sit under the bubble. Tap a chip -> list of who reacted.
   * The last message in the chat also carries a tiny "add reaction" chip.
   ============================================================ */
(function () {
  'use strict';

  var QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  var MORE = [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋',
    '😎', '🤓', '🤔', '🤗', '🤭', '😏', '😌', '😴', '🥱', '😬', '🙄', '😒', '😔', '😞', '😭', '😤',
    '😡', '🥺', '😳', '🤯', '😱', '😨', '🤒', '🥳', '👏', '🙌', '👌', '✌️', '🤞', '💪', '🫡', '🤝',
    '👀', '🔥', '💯', '✅', '❌', '⭐', '🎉', '💡', '📚', '✏️', '🏆', '🎯', '💔', '💙', '💚', '💛'
  ];
  var ALLOWED = {};
  QUICK.concat(MORE).forEach(function (x) { ALLOWED[x] = true; });

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ───────── data helpers (pure) ───────── */
  // -> [{ e, uids:[], names:[], mine:bool }] sorted by count desc, then first-seen
  function summarize(map, viewerUid) {
    var out = {}, order = [];
    if (!map || typeof map !== 'object') return [];
    Object.keys(map).forEach(function (uid) {
      var r = map[uid];
      if (!r || typeof r !== 'object' || !ALLOWED[r.e]) return;
      if (!out[r.e]) { out[r.e] = { e: r.e, uids: [], names: [], mine: false }; order.push(r.e); }
      out[r.e].uids.push(uid); out[r.e].names.push(String(r.n || 'Someone'));
      if (uid === viewerUid) out[r.e].mine = true;
    });
    return order.map(function (e) { return out[e]; }).sort(function (a, b) { return b.uids.length - a.uids.length; });
  }
  function myReaction(map, uid) { var r = map && map[uid]; return r && ALLOWED[r.e] ? r.e : null; }

  /* ───────── styles ───────── */
  function css() {
    if (document.getElementById('vrxCss')) return;
    var s = document.createElement('style'); s.id = 'vrxCss';
    s.textContent =
      '.vrx-row{display:flex;flex-wrap:wrap;gap:4px;margin:-3px 0 0;position:relative;z-index:1;padding:0 .5rem}' +
      '.gc-msg-out .vrx-row,.dm-msg-out .vrx-row{justify-content:flex-end}' +
      '.vrx-chip{display:inline-flex;align-items:center;gap:3px;min-height:24px;padding:0 7px;border-radius:12px;border:1px solid var(--border,#e5e7eb);background:var(--bg-base,#fff);color:var(--text-2,#374151);font:600 .75rem/1 var(--font,inherit);cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.08);-webkit-tap-highlight-color:transparent}' +
      '.vrx-chip.mine{background:var(--accent-subtle,#eaf0ff);border-color:var(--accent,#4f6ef7);color:var(--accent-text,#2d49d6)}' +
      '.vrx-chip .e{font-size:.9375rem;line-height:1}' +
      '.vrx-add{padding:0 6px;color:var(--text-3,#6b7280)}' +
      '.vrx-chip:focus-visible,.vrx-pk button:focus-visible,.vrx-sheet button:focus-visible{outline:2px solid var(--accent,#4f6ef7);outline-offset:2px}' +
      '@media (pointer:coarse){.gc-bubble,.dm-bubble-inner,.gc-bubble *,.dm-bubble-inner *{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}}' +
      // While a message is being held (and while the menu is open) nothing on the page may be selected.
      // Inputs are left alone so typing never breaks.
      'html.vrx-hold,html.vrx-hold *:not(input):not(textarea){-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}' +
      '.vrx-back,.vrx-pk{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}' +
      '.vrx-active{box-shadow:0 0 0 2px var(--accent,#4f6ef7)}' +
      '.vrx-back{position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.18);touch-action:none}' +
      '.vrx-pk{position:fixed;z-index:99999;width:max-content;max-width:calc(100vw - 16px);font-family:var(--font,inherit)}' +
      '.vrx-bar{display:flex;align-items:center;gap:2px;padding:6px;background:var(--bg-base,#fff);border:1px solid var(--border,#e5e7eb);border-radius:28px;box-shadow:0 6px 24px rgba(0,0,0,.22);animation:vrxIn .14s ease-out}' +
      '.vrx-bar button{width:40px;height:40px;border:0;border-radius:50%;background:none;font-size:1.5rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .1s}' +
      '.vrx-bar button:hover,.vrx-bar button:active{transform:scale(1.25)}' +
      '.vrx-bar button.sel{background:var(--accent-subtle,#eaf0ff)}' +
      '.vrx-bar .plus{font-size:1.25rem;color:var(--text-3,#6b7280);background:var(--bg-subtle,#f3f4f6)}' +
      '.vrx-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:0;padding:8px;background:var(--bg-base,#fff);border:1px solid var(--border,#e5e7eb);border-radius:18px;box-shadow:0 6px 24px rgba(0,0,0,.22);width:min(344px,calc(100vw - 16px));max-height:min(260px,40vh);overflow:auto;box-sizing:border-box}' +
      '.vrx-grid button{aspect-ratio:1;border:0;background:none;border-radius:8px;font-size:1.375rem;cursor:pointer;padding:0}' +
      '.vrx-grid button:hover{background:var(--bg-subtle,#f3f4f6)}' +
      '.vrx-grid button.sel{background:var(--accent-subtle,#eaf0ff)}' +
      '.vrx-acts{display:flex;flex-direction:column;margin-top:6px;background:var(--bg-base,#fff);border:1px solid var(--border,#e5e7eb);border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.22);overflow:hidden;min-width:150px;width:max-content}' +
      '.vrx-acts button{border:0;background:none;color:var(--text-1,#111);font:600 .875rem var(--font,inherit);padding:.7rem 1rem;text-align:left;cursor:pointer;min-height:44px}' +
      '.vrx-acts button:hover{background:var(--bg-subtle,#f3f4f6)}' +
      '@keyframes vrxIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:none}}' +
      '.vrx-sheetwrap{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;font-family:var(--font,inherit)}' +
      '@media(min-width:640px){.vrx-sheetwrap{align-items:center}}' +
      '.vrx-sheet{width:100%;max-width:420px;max-height:70vh;display:flex;flex-direction:column;background:var(--bg-base,#fff);color:var(--text-1,#111);border-radius:20px 20px 0 0;padding:1rem 1rem calc(1rem + env(safe-area-inset-bottom,0px));box-sizing:border-box}' +
      '@media(min-width:640px){.vrx-sheet{border-radius:20px}}' +
      '.vrx-sheet h3{margin:0 0 .5rem;font-size:1rem;text-align:center}' +
      '.vrx-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:.5rem}' +
      '.vrx-tabs button{flex-shrink:0;min-height:34px;padding:0 .75rem;border-radius:17px;border:1px solid var(--border,#e5e7eb);background:var(--bg-base,#fff);color:var(--text-2,#374151);font:600 .8125rem var(--font,inherit);cursor:pointer}' +
      '.vrx-tabs button.on{background:var(--accent,#4f6ef7);border-color:var(--accent,#4f6ef7);color:#fff}' +
      '.vrx-list{overflow:auto;flex:1}' +
      '.vrx-li{display:flex;align-items:center;gap:.75rem;width:100%;min-height:52px;padding:.25rem .25rem;border:0;background:none;text-align:left;font:inherit;color:inherit;border-radius:10px}' +
      '.vrx-li.me{cursor:pointer}.vrx-li.me:hover{background:var(--bg-subtle,#f3f4f6)}' +
      '.vrx-li .av{width:36px;height:36px;border-radius:50%;flex-shrink:0;background:var(--accent-subtle,#eaf0ff);color:var(--accent-text,#2d49d6);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.875rem;box-sizing:border-box}' +
      '.vrx-li .nm{flex:1;min-width:0;font-weight:600;font-size:.9375rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.vrx-li .nm small{display:block;font-weight:400;font-size:.75rem;color:var(--text-3,#6b7280)}' +
      '.vrx-li .em{font-size:1.4rem}' +
      '@media (prefers-reduced-motion:reduce){.vrx-bar{animation:none}.vrx-bar button{transition:none}}';
    document.head.appendChild(s);
  }

  /* ───────── markup helpers used by the bubble renderer ───────── */
  var ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c.8 1.2 2 1.8 3.5 1.8s2.7-.6 3.5-1.8"/><path d="M9 9.5h.01M15 9.5h.01"/></svg>';

  // reactions row html for one message (chips + optional tiny add chip on the last message)
  function rowHtml(map, viewerUid, isLast, canReact) {
    var sum = summarize(map, viewerUid);
    if (!sum.length && !(isLast && canReact)) return '';
    var h = '<div class="vrx-row" data-vrx-row="1">';
    sum.forEach(function (g) {
      h += '<button type="button" class="vrx-chip' + (g.mine ? ' mine' : '') + '" data-vrx="list" aria-label="' + esc(g.e + ' ' + g.uids.length + (g.uids.length === 1 ? ' reaction' : ' reactions') + '. Show who reacted') + '">' +
        '<span class="e">' + g.e + '</span>' + (g.uids.length > 1 ? '<span>' + g.uids.length + '</span>' : '') + '</button>';
    });
    if (isLast && canReact) h += '<button type="button" class="vrx-chip vrx-add" data-vrx="add" aria-label="Add a reaction">' + ICON + '</button>';
    return h + '</div>';
  }

  /* ───────── per-surface config (group chat vs DM) ─────────
     ctx may set: wrapPrefix, wrapSel, bubbleSel, textSel, msgRef(msgId), onReact(msgId, emoji) */
  function cfg(ctx) {
    return {
      wrapPrefix: ctx.wrapPrefix || 'gcWrap-', wrapSel: ctx.wrapSel || '.gc-swipe-wrap',
      bubbleSel: ctx.bubbleSel || '.gc-bubble', textSel: ctx.textSel || '.gc-bubble-text'
    };
  }

  /* ───────── write ───────── */
  var inflight = {};
  async function setReaction(ctx, msgId, emoji) {
    var v = ctx.viewer(); if (!v || !v.uid) return;
    var k = msgId + '|' + v.uid; if (inflight[k]) return;
    if (emoji !== null && !ALLOWED[emoji]) return;
    var why = ctx.blockReason && ctx.blockReason(); if (why) { ctx.toast(why); return; }
    inflight[k] = true;
    try {
      var ref = ctx.msgRef ? ctx.msgRef(msgId) : firebase.firestore().collection('groupChats').doc(ctx.groupId()).collection('messages').doc(msgId);
      var fp = new firebase.firestore.FieldPath('reactions', v.uid);
      await ref.update(fp, emoji === null ? firebase.firestore.FieldValue.delete() : { e: emoji, n: String(v.name || 'Someone').slice(0, 60) });
      if (emoji !== null && ctx.onReact) { try { ctx.onReact(msgId, emoji, v.uid); } catch (x) {} }
    } catch (e) {
      var nf = e && (e.code === 'not-found');
      var pd = e && (e.code === 'permission-denied');
      ctx.toast(nf ? 'That message is no longer available.' : pd ? 'You do not have permission to react here.' : 'Could not save your reaction. Try again.');
    } finally { delete inflight[k]; }
  }

  /* ───────── selection lock ─────────
     iOS starts its own long-press text selection at about the same moment our menu opens, and
     sometimes it wins and highlights the whole screen. So from the first touch on a message until
     the menu closes, we switch selection off page-wide, cancel any selection that still starts,
     and wipe whatever got selected. */
  var de = document.documentElement;
  function holding() { return de.classList.contains('vrx-hold'); }
  function clearSel() { try { var s = window.getSelection && window.getSelection(); if (s && s.rangeCount) s.removeAllRanges(); } catch (x) {} }
  function holdOn() { de.classList.add('vrx-hold'); clearSel(); }
  function holdOff() { de.classList.remove('vrx-hold'); }
  document.addEventListener('selectstart', function (e) { if (holding()) e.preventDefault(); }, true);
  document.addEventListener('selectionchange', function () { if (holding()) clearSel(); });

  /* ───────── picker ───────── */
  var open = null;   // { msgId, close }

  function closePicker() { if (open) { var o = open; open = null; o.close(); } }

  function wrapFor(ctx, msgId) { return document.getElementById(cfg(ctx).wrapPrefix + msgId); }

  function openPicker(ctx, msgId) {
    css(); closePicker();
    var C = cfg(ctx);
    var wrap = wrapFor(ctx, msgId); if (!wrap) return;
    var bubble = wrap.querySelector(C.bubbleSel); if (!bubble) return;
    var canReact = !(ctx.blockReason && ctx.blockReason());
    var mine = myReaction(ctx.getMap(msgId), (ctx.viewer() || {}).uid);
    bubble.classList.add('vrx-active');
    holdOn();

    var back = document.createElement('div'); back.className = 'vrx-back';
    var pk = document.createElement('div'); pk.className = 'vrx-pk'; pk.setAttribute('role', 'dialog'); pk.setAttribute('aria-label', 'React to message');
    pk.style.top = '-9999px'; pk.style.left = '-9999px';
    var bar = document.createElement('div'); bar.className = 'vrx-bar';
    var openedAt = Date.now();
    function fresh() { return Date.now() - openedAt < 350; }   // the lift of the long-press finger can fire a stray click
    function pick(e) { if (fresh()) return; closePicker(); setReaction(ctx, msgId, e === mine ? null : e); }
    if (canReact) {
      QUICK.forEach(function (e) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = e; b.setAttribute('aria-label', 'React ' + e);
        if (e === mine) b.className = 'sel';
        b.onclick = function () { pick(e); }; bar.appendChild(b);
      });
      var plus = document.createElement('button'); plus.type = 'button'; plus.className = 'plus'; plus.textContent = '+'; plus.setAttribute('aria-label', 'More emoji');
      plus.onclick = function () {
        if (fresh()) return;
        var grid = document.createElement('div'); grid.className = 'vrx-grid';
        MORE.forEach(function (e) {
          var b = document.createElement('button'); b.type = 'button'; b.textContent = e; b.setAttribute('aria-label', 'React ' + e);
          if (e === mine) b.className = 'sel'; b.onclick = function () { pick(e); }; grid.appendChild(b);
        });
        bar.replaceWith(grid); place(); var f = grid.querySelector('button'); if (f) f.focus();
      };
      bar.appendChild(plus);
      pk.appendChild(bar);
    }
    var acts = document.createElement('div'); acts.className = 'vrx-acts';
    if (ctx.reply) {
      var r = document.createElement('button'); r.type = 'button'; r.textContent = 'Reply';
      r.onclick = function () { if (fresh()) return; closePicker(); ctx.reply(wrap); }; acts.appendChild(r);
    }
    var txt = (bubble.querySelector(C.textSel) || {}).textContent;
    if (txt && txt.trim()) {
      var c = document.createElement('button'); c.type = 'button'; c.textContent = 'Copy';
      c.onclick = function () {
        if (fresh()) return;
        closePicker();
        var t = txt.trim();
        (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).catch(function () {
          var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); } catch (x) {} ta.remove();
        }).then(function () { ctx.toast('Copied'); }, function () {});
      };
      acts.appendChild(c);
    }
    if (acts.children.length) pk.appendChild(acts);
    if (!pk.children.length) { bubble.classList.remove('vrx-active'); holdOff(); return; }

    function place() {
      var br = bubble.getBoundingClientRect(), pr = pk.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
      var top = br.top - pr.height - 8;
      if (top < 8) top = br.bottom + 8;
      top = Math.max(8, Math.min(top, vh - pr.height - 8));          // always fully on screen, even for a half-visible bubble
      var left = (wrap.classList.contains('gc-msg-out') || wrap.classList.contains('dm-msg-out')) ? br.right - pr.width : br.left;
      left = Math.max(8, Math.min(left, vw - pr.width - 8));
      pk.style.top = top + 'px'; pk.style.left = left + 'px';
    }
    function onKey(e) { if (e.key === 'Escape') closePicker(); }
    function close() {
      document.removeEventListener('keydown', onKey); window.removeEventListener('resize', closePicker);
      back.remove(); pk.remove(); bubble.classList.remove('vrx-active');
      clearSel(); holdOff();
    }
    back.addEventListener('click', function () { if (!fresh()) closePicker(); });
    back.addEventListener('contextmenu', function (e) { e.preventDefault(); closePicker(); });
    back.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('keydown', onKey); window.addEventListener('resize', closePicker);
    document.body.appendChild(back); document.body.appendChild(pk);
    place();
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (x) {} }
    open = { msgId: msgId, ctx: ctx, close: close };
    var first = pk.querySelector('button'); if (first) first.focus({ preventScroll: true });
  }

  /* ───────── who reacted ───────── */
  function openList(ctx, msgId, focusEmoji) {
    css(); closePicker();
    var map = ctx.getMap(msgId), v = ctx.viewer() || {}, sum = summarize(map, v.uid);
    if (!sum.length) return;
    var total = 0; sum.forEach(function (g) { total += g.uids.length; });
    var cur = ALLOWED[focusEmoji] ? focusEmoji : 'all';
    var wrap = document.createElement('div'); wrap.className = 'vrx-sheetwrap';
    wrap.innerHTML = '<div class="vrx-sheet" role="dialog" aria-modal="true" aria-label="Reactions"><h3>Reactions</h3><div class="vrx-tabs"></div><div class="vrx-list"></div></div>';
    var tabs = wrap.querySelector('.vrx-tabs'), list = wrap.querySelector('.vrx-list');
    function paint() {
      var m = ctx.getMap(msgId), s = summarize(m, v.uid), t = 0; s.forEach(function (g) { t += g.uids.length; });
      if (!s.length) { close(); return; }
      if (cur !== 'all' && !s.some(function (g) { return g.e === cur; })) cur = 'all';
      tabs.innerHTML = ''; list.innerHTML = '';
      var all = document.createElement('button'); all.type = 'button'; all.textContent = 'All ' + t; if (cur === 'all') all.className = 'on';
      all.onclick = function () { cur = 'all'; paint(); }; tabs.appendChild(all);
      s.forEach(function (g) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = g.e + ' ' + g.uids.length; if (cur === g.e) b.className = 'on';
        b.onclick = function () { cur = g.e; paint(); }; tabs.appendChild(b);
      });
      var rows = [];
      Object.keys(m).forEach(function (uid) { var r = m[uid]; if (r && ALLOWED[r.e] && (cur === 'all' || r.e === cur)) rows.push({ uid: uid, e: r.e, n: r.n || 'Someone' }); });
      rows.sort(function (a, b) { return (a.uid === v.uid ? -1 : 0) - (b.uid === v.uid ? -1 : 0) || String(a.n).localeCompare(String(b.n)); });
      rows.forEach(function (r) {
        var me = r.uid === v.uid, el = document.createElement(me ? 'button' : 'div');
        if (me) el.type = 'button';
        el.className = 'vrx-li' + (me ? ' me' : '');
        el.innerHTML = '<span class="av"' + (me || r.uid === ctx.teacherUid ? '' : ' data-vtx-av="' + esc(r.uid) + '"') + '>' + esc(String(r.n).charAt(0).toUpperCase() || '?') + '</span>' +
          '<span class="nm">' + esc(me ? 'You' : r.n) + (me ? '<small>Tap to remove</small>' : '') + '</span><span class="em">' + r.e + '</span>';
        if (me) el.onclick = function () { setReaction(ctx, msgId, null); };
        list.appendChild(el);
      });
      if (window.VtxAvatar && VtxAvatar.scan) VtxAvatar.scan(list);
    }
    function close() { document.removeEventListener('keydown', onKey); window.removeEventListener('vrx-refresh', paint); wrap.remove(); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    document.addEventListener('keydown', onKey); window.addEventListener('vrx-refresh', paint);
    document.body.appendChild(wrap); paint();
    var f = tabs.querySelector('button'); if (f) f.focus();
  }

  /* ───────── gesture binding (once per container) ───────── */
  function bind(container, ctx) {
    if (!container || container._vrxBound) { if (container) container._vrxCtx = ctx; return; }
    container._vrxBound = true; container._vrxCtx = ctx;
    css();
    var timer = null, sx = 0, sy = 0, firedAt = 0;

    function msgIdOf(target) {
      var C = cfg(container._vrxCtx);
      var w = target.closest && target.closest(C.wrapSel); if (!w || !w.id || w.id.indexOf(C.wrapPrefix) !== 0) return null;
      return w.id.slice(C.wrapPrefix.length);
    }
    function cancel() { clearTimeout(timer); timer = null; }

    container.addEventListener('touchstart', function (e) {
      cancel();
      if (e.touches.length !== 1) return;
      var t = e.target;
      if (t.closest('button,a,input,textarea,audio,video,.vrx-row,.gc-reply-card,.dm-reply-card')) return;       // never hijack controls
      if (!t.closest(cfg(container._vrxCtx).bubbleSel)) return;
      var id = msgIdOf(t); if (!id) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      holdOn();                                                                                   // lock selection from the very first touch
      timer = setTimeout(function () { timer = null; firedAt = Date.now(); openPicker(container._vrxCtx, id); }, 420);
    }, { passive: true });
    container.addEventListener('touchmove', function (e) {
      if (!timer) return; var p = e.touches[0];
      if (Math.abs(p.clientX - sx) > 8 || Math.abs(p.clientY - sy) > 8) { cancel(); if (!open) holdOff(); }   // scrolling or swiping to reply
    }, { passive: true });
    ['touchend', 'touchcancel'].forEach(function (n) {
      container.addEventListener(n, function () { var was = !!timer; cancel(); if (!open && was) holdOff(); }, { passive: true });   // short tap: release the lock
    });

    // desktop right-click, and Android's native long-press event (suppressed if our timer already fired)
    container.addEventListener('contextmenu', function (e) {
      if (!e.target.closest || !e.target.closest(cfg(container._vrxCtx).bubbleSel)) return;
      if (e.target.closest('a,input,textarea')) return;
      e.preventDefault();
      if (Date.now() - firedAt < 900) return;
      var id = msgIdOf(e.target); if (id) openPicker(container._vrxCtx, id);
    });

    container.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-vrx]'); if (!b) return;
      var id = msgIdOf(b); if (!id) return;
      e.stopPropagation();
      if (b.getAttribute('data-vrx') === 'add') openPicker(container._vrxCtx, id);
      else {
        var emo = (b.querySelector('.e') || {}).textContent;
        openList(container._vrxCtx, id, emo);
      }
    });
  }

  // call after every re-render: keeps an open picker honest if its message vanished
  function afterRender() {
    if (open && !wrapFor(open.ctx, open.msgId)) closePicker();
    else if (open) { var w = wrapFor(open.ctx, open.msgId), b = w && w.querySelector(cfg(open.ctx).bubbleSel); if (b) b.classList.add('vrx-active'); }
    try { window.dispatchEvent(new Event('vrx-refresh')); } catch (e) {}
  }

  window.VtxReactions = {
    rowHtml: rowHtml, bind: bind, afterRender: afterRender, close: closePicker, open: openPicker,
    _summarize: summarize, _allowed: ALLOWED, QUICK: QUICK
  };
})();
