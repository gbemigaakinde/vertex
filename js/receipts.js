/* ═══════════════════════════════════════════════════════════════
   receipts.js — "Message info" popup (delivered / read times)
   Shared by DM (dm.js) and Group Chat (groupchat.js).
   Any element with a  data-rc="<encoded JSON>"  attribute opens it.
   Payload shapes:
     DM    : { kind:'dm', to:'Name', sent:ms, delivered:ms|null, read:ms|null }
     Group : { kind:'group', sent:ms, people:[{name, delivered:ms|null, read:ms|null}] }
   ═══════════════════════════════════════════════════════════════ */
const VtxReceipts = (() => {
  'use strict';

  function toMs(v) {
    if (!v) return null;
    if (typeof v === 'number') return v;
    if (v.toMillis) return v.toMillis();
    if (v.toDate) return v.toDate().getTime();
    if (v.seconds) return v.seconds * 1000;
    const d = new Date(v).getTime();
    return isNaN(d) ? null : d;
  }

  /* Exact, friendly time: "Today, 14:32" / "Yesterday, 09:05" / "Mon 26 Oct, 18:40" */
  function fmt(ms) {
    if (!ms) return '—';
    const d = new Date(ms), now = new Date();
    const t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const day0 = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day0(now) - day0(d)) / 86400000);
    if (diff === 0) return 'Today, ' + t;
    if (diff === 1) return 'Yesterday, ' + t;
    const dd = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short',
                                               year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
    return dd + ', ' + t;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* Encode a payload for use inside an HTML attribute */
  function attr(payload) {
    return 'data-rc="' + encodeURIComponent(JSON.stringify(payload)) + '"';
  }

  function injectStyles() {
    if (document.getElementById('_vtxRcStyles')) return;
    const s = document.createElement('style');
    s.id = '_vtxRcStyles';
    s.textContent = `
      [data-rc]{cursor:pointer;}
      .vrc-back{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.45);display:flex;
        align-items:flex-end;justify-content:center;animation:vrcFade .15s ease;}
      @media(min-width:600px){.vrc-back{align-items:center;}}
      .vrc-card{background:var(--bg-base,#fff);color:var(--text-1,#0d0d0f);width:100%;max-width:420px;
        max-height:80vh;overflow:auto;border-radius:18px 18px 0 0;padding:1rem 1.1rem 1.25rem;
        box-shadow:0 -8px 30px rgba(0,0,0,.25);font-family:inherit;}
      @media(min-width:600px){.vrc-card{border-radius:18px;}}
      .vrc-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;}
      .vrc-title{font-size:1rem;font-weight:700;margin:0;}
      .vrc-x{border:0;background:transparent;font-size:1.4rem;line-height:1;cursor:pointer;color:var(--text-3,#6b7280);}
      .vrc-sec{font-size:.6875rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
        color:var(--text-3,#6b7280);margin:.9rem 0 .35rem;}
      .vrc-row{display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--border,#e5e7eb);}
      .vrc-row:last-child{border-bottom:0;}
      .vrc-ic{flex-shrink:0;width:22px;display:flex;justify-content:center;}
      .vrc-name{flex:1;min-width:0;font-size:.875rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .vrc-time{font-size:.75rem;color:var(--text-3,#6b7280);white-space:nowrap;}
      .vrc-empty{font-size:.8125rem;color:var(--text-3,#6b7280);padding:.4rem 0;}
      @keyframes vrcFade{from{opacity:0}to{opacity:1}}`;
    document.head.appendChild(s);
  }

  const SENT_SVG = '<svg width="12" height="12" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2" stroke="#9ca3af" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const dbl = c => '<svg width="18" height="11" viewBox="0 0 16 10" fill="none"><path d="M1 5L4.5 8.5L10.5 2" stroke="' + c + '" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 5L9 8.5L15 2" stroke="' + c + '" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const GREY = dbl('#9ca3af'), BLUE = dbl('#53c8f5');

  function row(icon, name, time) {
    return '<div class="vrc-row"><span class="vrc-ic">' + icon + '</span><span class="vrc-name">' + esc(name) +
           '</span><span class="vrc-time">' + esc(time) + '</span></div>';
  }

  function build(p) {
    let h = '<div class="vrc-sec">Sent</div>' + row(SENT_SVG, 'You', fmt(p.sent));
    if (p.kind === 'dm') {
      const to = p.to || 'Recipient';
      h += '<div class="vrc-sec">Read</div>' +
           (p.read ? row(BLUE, to, fmt(p.read)) : '<div class="vrc-empty">Not read yet</div>');
      h += '<div class="vrc-sec">Delivered</div>' +
           ((p.delivered || p.read) ? row(GREY, to, fmt(p.delivered || p.read)) : '<div class="vrc-empty">Not delivered yet</div>');
      return h;
    }
    const people = p.people || [];
    const read = people.filter(x => x.read).sort((a, b) => a.read - b.read);
    const deliv = people.filter(x => !x.read && x.delivered).sort((a, b) => a.delivered - b.delivered);
    const wait = people.filter(x => !x.read && !x.delivered);
    h += '<div class="vrc-sec">Read by ' + read.length + ' of ' + people.length + '</div>' +
         (read.length ? read.map(x => row(BLUE, x.name, fmt(x.read))).join('') : '<div class="vrc-empty">Nobody yet</div>');
    h += '<div class="vrc-sec">Delivered to</div>' +
         (deliv.length ? deliv.map(x => row(GREY, x.name, fmt(x.delivered))).join('') : '<div class="vrc-empty">—</div>');
    if (wait.length) h += '<div class="vrc-sec">Not delivered yet</div>' + wait.map(x => row(SENT_SVG, x.name, '')).join('');
    return h;
  }

  function close() { const e = document.getElementById('vrcModal'); if (e) e.remove(); }

  function open(p) {
    injectStyles(); close();
    const el = document.createElement('div');
    el.id = 'vrcModal'; el.className = 'vrc-back';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Message info');
    el.innerHTML = '<div class="vrc-card"><div class="vrc-head"><h3 class="vrc-title">Message info</h3>' +
      '<button class="vrc-x" aria-label="Close">&times;</button></div>' + build(p) + '</div>';
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('.vrc-x')) close(); });
    document.body.appendChild(el);
  }

  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-rc]');
    if (!t) return;
    try {
      const p = JSON.parse(decodeURIComponent(t.getAttribute('data-rc')));
      e.stopPropagation(); e.preventDefault();
      open(p);
    } catch (_) {}
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  return { toMs, fmt, attr, open, close };
})();
window.VtxReceipts = VtxReceipts;
