/* ============================================================
   js/teacher.js — Teacher dashboard (UI v3)
   ============================================================ */

(function () {
  'use strict';

  const _listeners = {};

  function _reg(key, unsub) {
    if (typeof _listeners[key] === 'function') _listeners[key]();
    _listeners[key] = unsub;
  }

  function _cancel(key) {
    if (typeof _listeners[key] === 'function') {
      _listeners[key]();
      delete _listeners[key];
    }
  }

  function _cancelAll() {
    Object.keys(_listeners).forEach(k => _cancel(k));
  }

/* ── Timetable: default period structure ── */
  function _ttDefaultPeriods() {
  return [
    { time: '7:30 – 8:00',   monday: '', tuesday: '', wednesday: '', thursday: '', friday: '', saturday: '', sunday: '' },
    { time: '8:00 – 8:45',   monday: '', tuesday: '', wednesday: '', thursday: '', friday: '', saturday: '', sunday: '' },
    { time: '8:45 – 9:30',   monday: '', tuesday: '', wednesday: '', thursday: '', friday: '', saturday: '', sunday: '' },
    { time: '9:30 – 9:45',   monday: 'BREAK', tuesday: 'BREAK', wednesday: 'BREAK', thursday: 'BREAK', friday: 'BREAK', saturday: 'BREAK', sunday: 'BREAK' },
    { time: '9:45 – 10:30',  monday: '', tuesday: '', wednesday: '', thursday: '', friday: '', saturday: '', sunday: '' },
    { time: '10:30 – 11:15', monday: '', tuesday: '', wednesday: '', thursday: '', friday: '', saturday: '', sunday: '' },
    { time: '11:15 – 12:00', monday: '', tuesday: '', wednesday: '', thursday: '', friday: '', saturday: '', sunday: '' },
    { time: '12:00 – 12:45', monday: 'LUNCH', tuesday: 'LUNCH', wednesday: 'LUNCH', thursday: 'LUNCH', friday: 'LUNCH', saturday: 'LUNCH', sunday: 'LUNCH' },
    { time: '12:45 – 1:30',  monday: '', tuesday: '', wednesday: '', thursday: '', friday: '', saturday: '', sunday: '' },
    { time: '1:30 – 2:15',   monday: '', tuesday: '', wednesday: '', thursday: '', friday: '', saturday: '', sunday: '' },
    { time: '2:15 – 3:00',   monday: '', tuesday: '', wednesday: '', thursday: '', friday: '', saturday: '', sunday: '' },
  ];
}

  /* ── Timetable: build a single <tr> HTML string for the editor table ── */
  function _ttBuildPeriodRowHtml(p) {
  const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const vals     = DAY_KEYS.map(function (dk) { return (p[dk] || '').trim().toUpperCase(); });
  const isBreak  = vals.every(function (v) { return v === 'BREAK'; });
  const isLunch  = vals.every(function (v) { return v === 'LUNCH'; });
  const isSpecial = isBreak || isLunch;
  const rowBg    = isSpecial ? 'background:var(--bg-subtle);' : '';

  const inputBase = 'width:100%;box-sizing:border-box;padding:.3125rem .4375rem;' +
                    'font-size:.75rem;border:1px solid var(--border);border-radius:4px;' +
                    'background:var(--bg-base);color:var(--text-1);font-family:var(--font);';

  // Parse existing time string "HH:MM – HH:MM" into [startVal, endVal] for the two pickers
  function _parseTimeRange(t) {
    if (!t) return ['', ''];
    const normalized = (t || '').replace(/\s*[\u2013\u2014\u2212\-]\s*/g, '-');
    const m = normalized.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (!m) return ['', ''];
    const startH = String(+m[1]).padStart(2, '0');
    const startM = String(+m[2]).padStart(2, '0');
    const endH   = String(+m[3]).padStart(2, '0');
    const endM   = String(+m[4]).padStart(2, '0');
    return [`${startH}:${startM}`, `${endH}:${endM}`];
  }

  const [startVal, endVal] = _parseTimeRange(p.time || '');

  // The two time pickers write back into a hidden data-field="time" input
  // using a consistent "HH:MM – HH:MM" format (en-dash, spaces)
  const timePickerHtml =
    '<td style="padding:.25rem .3rem;border:1px solid var(--border);' + rowBg + 'white-space:nowrap;">' +
      // Hidden canonical value read by _ttReadPeriodsFromDOM
      '<input data-field="time" type="hidden" value="' + _esc(p.time || '') + '" class="tt-time-hidden" />' +
      '<div style="display:flex;align-items:center;gap:3px;">' +
        '<input type="time" class="tt-time-start" value="' + _esc(startVal) + '" ' +
          'style="width:82px;box-sizing:border-box;padding:.3125rem .375rem;' +
          'font-size:.7rem;border:1px solid var(--border);border-radius:4px;' +
          'background:var(--bg-base);color:var(--text-1);font-family:var(--font-mono);" ' +
          'onchange="Teacher._ttSyncTimeHidden(this)" />' +
        '<span style="font-size:.75rem;color:var(--text-3);flex-shrink:0;">–</span>' +
        '<input type="time" class="tt-time-end" value="' + _esc(endVal) + '" ' +
          'style="width:82px;box-sizing:border-box;padding:.3125rem .375rem;' +
          'font-size:.7rem;border:1px solid var(--border);border-radius:4px;' +
          'background:var(--bg-base);color:var(--text-1);font-family:var(--font-mono);" ' +
          'onchange="Teacher._ttSyncTimeHidden(this)" />' +
      '</div>' +
    '</td>';

  var dayCells = DAY_KEYS.map(function (dk) {
    var val        = p[dk] || '';
    var isSpecCell = ['BREAK', 'LUNCH'].includes(val.trim().toUpperCase());
    return '<td style="padding:.25rem .3rem;border:1px solid var(--border);' + rowBg + '">' +
      '<input data-field="' + dk + '" value="' + _esc(val) + '" ' +
        'style="' + inputBase +
          (isSpecCell ? 'text-align:center;font-weight:700;' +
            'color:var(--text-3);letter-spacing:.05em;' : '') +
        '" />' +
      '</td>';
  }).join('');

  return '<tr data-period-row style="' + rowBg + '">' +
    timePickerHtml +
    dayCells +
    '<td style="padding:.25rem;border:1px solid var(--border);text-align:center;' +
        'vertical-align:middle;' + rowBg + '">' +
      '<button class="tt-remove-period-btn" onclick="this.closest(\'tr\').remove()" title="Remove period" ' +
        'style="background:none;border:none;cursor:pointer;font-size:1rem;' +
          'color:var(--text-4);line-height:1;padding:2px 4px;" ' +
        'onmouseenter="this.style.color=\'var(--danger)\'" ' +
        'onmouseleave="this.style.color=\'var(--text-4)\'">×</button>' +
    '</td>' +
  '</tr>';
}

function _ttSyncTimeHidden(changedInput) {
  const row    = changedInput.closest('tr[data-period-row]');
  if (!row) return;
  const start  = row.querySelector('.tt-time-start');
  const end    = row.querySelector('.tt-time-end');
  const hidden = row.querySelector('.tt-time-hidden');
  if (!start || !end || !hidden) return;
  const sv = start.value; // "HH:MM" or ""
  const ev = end.value;
  if (sv && ev) {
    hidden.value = sv + ' \u2013 ' + ev; // "HH:MM – HH:MM" (en-dash)
  } else {
    hidden.value = sv || ev || '';
  }
  _ttSaveDraft();
}

  /* ── Timetable: append a period row to the editor tbody ── */
  function _ttAppendPeriodRowToDOM(p) {
    const tbody = document.getElementById('ttPeriodBody');
    if (!tbody) return;
    const tmp = document.createElement('tbody');
    tmp.innerHTML = _ttBuildPeriodRowHtml(p);
    if (tmp.firstElementChild) tbody.appendChild(tmp.firstElementChild);
  }

  /* ── Timetable: read all period rows from the editor table ── */
  function _ttReadPeriodsFromDOM() {
  const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const rows     = document.querySelectorAll('#ttPeriodBody tr[data-period-row]');
  const periods  = [];
  rows.forEach(function (tr) {
    const obj = {};
    // Read canonical time from hidden input
    const hidden = tr.querySelector('input.tt-time-hidden[data-field="time"]');
    obj.time = hidden ? hidden.value.trim() : '';
    // If hidden is empty but pickers have values, sync now
    if (!obj.time) {
      const sv = (tr.querySelector('.tt-time-start') || {}).value || '';
      const ev = (tr.querySelector('.tt-time-end')   || {}).value || '';
      if (sv && ev) obj.time = sv + ' \u2013 ' + ev;
      else obj.time = sv || ev || '';
    }
    // Read day inputs
    tr.querySelectorAll('input[data-field]').forEach(function (inp) {
      if (inp.dataset.field !== 'time') {
        obj[inp.dataset.field] = inp.value.trim();
      }
    });
    const hasContent = obj.time || DAY_KEYS.some(function (d) { return !!obj[d]; });
    if (hasContent) periods.push(obj);
  });
  return periods;
}

  /* ── Timetable: row-add helpers ── */
function _ttAddEmptyPeriodRow() {
  _ttAppendPeriodRowToDOM({ time: '', monday: '', tuesday: '', wednesday: '', thursday: '', friday: '', saturday: '', sunday: '' });
  _ttSaveDraft();
}
function _ttAddBreakRow() {
  _ttAppendPeriodRowToDOM({ time: '', monday: 'BREAK', tuesday: 'BREAK', wednesday: 'BREAK', thursday: 'BREAK', friday: 'BREAK', saturday: 'BREAK', sunday: 'BREAK' });
  _ttSaveDraft();
}
function _ttAddLunchRow() {
  _ttAppendPeriodRowToDOM({ time: '', monday: 'LUNCH', tuesday: 'LUNCH', wednesday: 'LUNCH', thursday: 'LUNCH', friday: 'LUNCH', saturday: 'LUNCH', sunday: 'LUNCH' });
  _ttSaveDraft();
}

function _injectTeacherNavStyles() {
  const existing = document.getElementById('_teacherNavStyle');
  if (existing) existing.remove();
  const s = document.createElement('style');
  s.id = '_teacherNavStyle';
  s.textContent = `
    /* ── Teacher Nav Shell ── */
    .vtx-td-shell {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    /* ── Top bar ── */
    .vtx-td-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid var(--border);
      gap: 1rem;
      flex-shrink: 0;
    }

    .vtx-td-brand {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      flex-shrink: 0;
    }

    .vtx-td-brand-icon {
      width: 28px;
      height: 28px;
      background: var(--accent);
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: var(--shadow-accent);
    }

    .vtx-td-brand-text {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .vtx-td-brand-name {
      font-size: var(--text-sm);
      font-weight: 700;
      color: var(--text-1);
      letter-spacing: -0.015em;
      white-space: nowrap;
    }

    .vtx-td-brand-role {
      font-size: 0.625rem;
      font-weight: 500;
      color: var(--text-4);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .vtx-td-signout {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.3125rem 0.75rem;
      font-size: var(--text-xs);
      font-weight: 500;
      color: var(--text-3);
      background: transparent;
      border: 1px solid var(--border);
      border-radius: var(--r-md);
      cursor: pointer;
      transition: color var(--t-fast), background var(--t-fast), border-color var(--t-fast);
      font-family: var(--font);
      white-space: nowrap;
      flex-shrink: 0;
    }
    .vtx-td-signout:hover {
      color: var(--danger);
      border-color: var(--danger-border);
      background: var(--danger-subtle);
    }

    /* ── Nav strip ── */
    .vtx-td-navwrap {
      position: relative;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      overflow: hidden;
    }

    .vtx-td-nav {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 0.5rem 1rem;
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
      position: relative;
      z-index: 1;
    }
    .vtx-td-nav::-webkit-scrollbar { display: none; }

    /* sliding active pill */
    .vtx-td-nav-indicator {
      position: absolute;
      bottom: 0.5rem;
      left: 0;
      height: calc(100% - 1rem);
      background: var(--accent-subtle);
      border: 1px solid var(--accent-border);
      border-radius: var(--r-md);
      transition: left 0.22s cubic-bezier(0.16,1,0.3,1),
                  width 0.22s cubic-bezier(0.16,1,0.3,1),
                  background 0.18s ease,
                  border-color 0.18s ease;
      pointer-events: none;
      z-index: 0;
    }

    /* nav item */
    .vtx-td-navitem {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      gap: 0.3125rem;
      padding: 0.375rem 0.75rem;
      border-radius: var(--r-md);
      font-size: var(--text-xs);
      font-weight: 500;
      color: var(--text-3);
      background: transparent;
      border: none;
      cursor: pointer;
      white-space: nowrap;
      transition: color 0.14s ease, background 0.14s ease;
      font-family: var(--font);
      flex-shrink: 0;
      letter-spacing: 0.01em;
      -webkit-tap-highlight-color: transparent;
    }

    .vtx-td-navitem svg {
      flex-shrink: 0;
      opacity: 0.6;
      transition: opacity 0.14s ease;
    }

    .vtx-td-navitem:hover {
      color: var(--text-1);
      background: var(--bg-subtle);
    }
    .vtx-td-navitem:hover svg { opacity: 0.9; }

    .vtx-td-navitem.is-active {
      color: var(--accent-text);
      font-weight: 600;
    }
    .vtx-td-navitem.is-active svg { opacity: 1; }

    /* special accents */
    .vtx-td-navitem[data-tab="chat"].is-active {
      color: var(--success-text);
    }
    .vtx-td-navitem[data-tab="dm"].is-active {
      color: var(--accent-text);
    }

    /* indicator colour shifts for special tabs */
    .vtx-td-nav-indicator.for-chat {
      background: var(--success-subtle);
      border-color: var(--success-border);
    }
    .vtx-td-nav-indicator.for-dm {
      background: var(--accent-subtle);
      border-color: var(--accent-border);
    }

    /* divider between groups */
    .vtx-td-navdivider {
      width: 1px;
      height: 16px;
      background: var(--border);
      flex-shrink: 0;
      margin: 0 4px;
    }

    /* notification badge on nav items */
    .vtx-td-navitem .vtx-td-badge {
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 8px;
      background: var(--danger);
      color: #fff;
      font-size: 0.5625rem;
      font-weight: 700;
      font-family: var(--font-mono);
      line-height: 16px;
      text-align: center;
      display: none;
    }
    .vtx-td-navitem .vtx-td-badge.is-visible {
      display: inline-block;
      animation: vtx-badge-pop 0.22s cubic-bezier(0.34,1.56,0.64,1) both;
    }

    /* ── Content area ── */
    .vtx-td-body {
      padding: 1.25rem 1.5rem;
      overflow: visible;
      min-width: 0;
      box-sizing: border-box;
      max-width: 100%;
    }

    /* ── Mobile: shrink labels, scroll nav ── */
    @media (max-width: 600px) {
      .vtx-td-topbar { padding: 0.625rem 1rem; }
      .vtx-td-brand-name { font-size: var(--text-xs); }
      .vtx-td-brand-role { display: none; }
      .vtx-td-nav { padding: 0.375rem 0.75rem; gap: 1px; }
      .vtx-td-navitem { padding: 0.375rem 0.5rem; font-size: 0.625rem; gap: 0.25rem; }
      .vtx-td-body { padding: 1rem; }
    }

    /* ── Tasks grid responsive ── */
    @media (max-width: 768px) { .tasks-grid { grid-template-columns: 1fr !important; } }

    /* ── Result cards ── */
    .teacher-result-card {
      cursor: pointer;
      transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
    }
    .teacher-result-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
      border-color: var(--accent-border) !important;
    }

    /* ── Review modal ── */
    #teacherReviewModal {
      position: fixed; inset: 0; background: var(--bg-overlay); z-index: 1200;
      display: flex; align-items: flex-start; justify-content: center;
      padding: 1.25rem; overflow-y: auto;
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      animation: cbt-overlay-in .16s ease-out both;
    }
    #teacherReviewModal .review-panel {
      background: var(--bg-base); border: 1px solid var(--border);
      border-radius: var(--r-xl); padding: 1.5rem; width: 100%; max-width: 760px; margin: auto;
      box-shadow: var(--shadow-xl);
      animation: cbt-modal-in .24s cubic-bezier(.34,1.45,.64,1) both;
    }
    .review-q-card { border-radius: var(--r-md); padding: 1rem; border-width: 1px; border-style: solid; }
    .review-q-card--correct  { border-color: var(--success-border); background: var(--success-subtle); }
    .review-q-card--wrong    { border-color: var(--danger-border);  background: var(--danger-subtle);  }
    .review-q-card--skipped  { border-color: var(--border);         background: var(--bg-subtle);      }
    .progress-week-row summary { cursor: pointer; list-style: none; user-select: none; }
    .progress-week-row summary::-webkit-details-marker { display: none; }

    /* ── Edit student modal ── */
    #teacherEditStudentModal {
      position: fixed; inset: 0; background: var(--bg-overlay); z-index: 1300;
      display: flex; align-items: center; justify-content: center;
      padding: 1.25rem; overflow-y: auto;
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      animation: cbt-overlay-in .16s ease-out both;
    }
  `;
  document.head.appendChild(s);
}
   
function renderTeacherDashboard() {
  AppState.isTeacher = true;

   const NAV_ITEMS = [
    {
      tab: 'approvals',
      label: 'Approvals',
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>`,
      badge: true,
      badgeClass: 'vtx-td-badge',
      badgeId: 'badge-approvals',
    },
    {
      tab: 'students',
      label: 'Students',
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    },
    {
      tab: 'results',
      label: 'Results',
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    },
    {
      tab: 'schools',
      label: 'Schools',
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    },
    {
      tab: 'tasks',
      label: 'Tasks',
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>`,
    },
    {
      tab: 'studyroom',
      label: 'Study Room',
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    },
    {
      tab: 'games',
      label: 'Games',
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4m-2-2v4"/><circle cx="16" cy="10" r="1" fill="currentColor"/><circle cx="18" cy="12" r="1" fill="currentColor"/></svg>`,
    },
    {
      tab: 'timetable',
      label: 'Timetable',
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    },
    {
      tab: 'activity',
      label: 'Activity',
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>`,
      badge: true,
      badgeClass: 'vtx-td-badge',
      badgeId: 'badge-activity',
    },
    { divider: true },
    {
      tab: 'groups',
      label: 'Groups',
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></svg>`,
    },
    {
      tab: 'chat',
      label: 'Chat',
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
      badge: true,
      badgeClass: 'vtx-td-badge',
      badgeId: 'badge-chat',
    },
    {
      tab: 'dm',
      label: 'Messages',
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
      badge: true,
      badgeClass: 'vtx-td-badge',
      badgeId: 'badge-dm',
    },
    {
      tab: 'push',
      label: 'Push',
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    },
  ];

  const navItemsHtml = NAV_ITEMS.map(item => {
    if (item.divider) return `<div class="vtx-td-navdivider"></div>`;
    const badgeId = item.badgeId || ('badge-' + item.tab);
    return `
      <button
        class="vtx-td-navitem"
        id="tab-${_esc(item.tab)}"
        data-tab="${_esc(item.tab)}"
        onclick="Teacher.showTab('${_esc(item.tab)}')"
      >
        ${item.icon}
        ${_esc(item.label)}
        ${item.badge ? `<span class="${_esc(item.badgeClass || 'vtx-td-badge')}" id="${_esc(badgeId)}"></span>` : ''}
      </button>`;
  }).join('');

  document.getElementById('app').innerHTML = `
    <div class="max-w-7xl mx-auto glass mt-6 vtx-td-shell" style="margin-bottom:1.5rem;">

      <!-- Top bar -->
      <div class="vtx-td-topbar">
        <div class="vtx-td-brand">
          <div class="vtx-td-brand-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white"
                 stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
              <line x1="12" y1="22" x2="12" y2="15.5"/>
              <polyline points="22 8.5 12 15.5 2 8.5"/>
            </svg>
          </div>
          <div class="vtx-td-brand-text">
            <span class="vtx-td-brand-name">Teacher Dashboard</span>
            <span class="vtx-td-brand-role">Administrator</span>
          </div>
        </div>
        <button class="vtx-td-signout" onclick="Teacher.logout()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      </div>

      <!-- Nav strip -->
      <div class="vtx-td-navwrap">
        <div class="vtx-td-nav" id="vtxTeacherNav">
          <div class="vtx-td-nav-indicator" id="vtxNavIndicator"></div>
          ${navItemsHtml}
        </div>
      </div>

      <!-- Content -->
      <div class="vtx-td-body">

        <div id="teacher-approvals" class="teacher-tab hidden"></div>
        <div id="teacher-students" class="teacher-tab">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
            <div>
              <h2 style="font-size:var(--text-md);font-weight:600;color:var(--text-1);letter-spacing:-0.015em;">Registered Students</h2>
              <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:2px;">Grouped by school</p>
            </div>
            <button onclick="Teacher._loadStudents()" class="btn bg-gray-500" style="font-size:var(--text-sm);">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
              </svg>
              Refresh
            </button>
          </div>
          <div id="studentsList"></div>
        </div>

        <div id="teacher-results" class="teacher-tab hidden">
          <div style="margin-bottom:1rem;">
            <h2 style="font-size:var(--text-md);font-weight:600;color:var(--text-1);letter-spacing:-0.015em;">All Exam Results</h2>
            <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:2px;">Most recent first — click any card to review the full attempt</p>
          </div>
          <div id="resultsList" class="grid gap-3 md:grid-cols-2 lg:grid-cols-3"></div>
        </div>

        <div id="teacher-schools" class="teacher-tab hidden">
          <div style="margin-bottom:1rem;">
            <h2 style="font-size:var(--text-md);font-weight:600;color:var(--text-1);letter-spacing:-0.015em;">Manage Schools</h2>
            <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:2px;">Add, rename, or remove schools from the registration list</p>
          </div>
          <div style="display:flex;gap:0.5rem;margin-bottom:1.25rem;max-width:520px;">
            <input id="newSchoolName" type="text" placeholder="New school name" style="flex:1;" />
            <button onclick="Teacher.addSchool()" class="btn" style="white-space:nowrap;font-size:var(--text-sm);">Add School</button>
          </div>
          <div id="schoolsList" class="space-y-2"></div>
        </div>

        <div id="teacher-tasks" class="teacher-tab hidden">
          <div style="margin-bottom:1.25rem;">
            <h2 style="font-size:var(--text-md);font-weight:600;color:var(--text-1);letter-spacing:-0.015em;">Coaching Tasks &amp; Messages</h2>
            <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:2px;">Configure scheduled tasks and send private messages to students</p>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;" class="tasks-grid">

            <div class="glass-dark" style="padding:1.25rem;border-radius:var(--r-lg);">
              <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;padding-bottom:0.75rem;border-bottom:1px solid var(--border);">
                <div style="width:6px;height:6px;border-radius:50%;background:var(--accent);flex-shrink:0;"></div>
                <h3 style="font-size:var(--text-base);font-weight:600;color:var(--text-1);">Coaching Tasks</h3>
              </div>

              <div style="margin-bottom:0.875rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">Recurrence</label>
                <div style="display:flex;background:var(--bg-muted);border:1px solid var(--border);border-radius:var(--r-md);padding:3px;gap:3px;">
                  <button id="taskScopeAll" onclick="Teacher._setTaskScope('once')"
                          style="flex:1;padding:0.375rem 0.25rem;font-size:var(--text-xs);font-weight:500;cursor:pointer;border:none;border-radius:5px;transition:background var(--t-fast),color var(--t-fast),box-shadow var(--t-fast);background:var(--bg-base);color:var(--text-1);box-shadow:var(--shadow-xs);font-family:inherit;">One-time</button>
                  <button id="taskScopeWeekly" onclick="Teacher._setTaskScope('weekly')"
                          style="flex:1;padding:0.375rem 0.25rem;font-size:var(--text-xs);font-weight:500;cursor:pointer;border:none;border-radius:5px;transition:background var(--t-fast),color var(--t-fast);background:transparent;color:var(--text-3);box-shadow:none;font-family:inherit;">Weekly</button>
                  <button id="taskScopeRange" onclick="Teacher._setTaskScope('range')"
                          style="flex:1;padding:0.375rem 0.25rem;font-size:var(--text-xs);font-weight:500;cursor:pointer;border:none;border-radius:5px;transition:background var(--t-fast),color var(--t-fast);background:transparent;color:var(--text-3);box-shadow:none;font-family:inherit;">Date Range</button>
                </div>
              </div>

              <div id="taskRecurrenceHint" style="display:none;margin-bottom:0.75rem;padding:0.5rem 0.75rem;background:var(--accent-subtle);border:1px solid var(--accent-border);border-radius:var(--r-md);font-size:var(--text-xs);color:var(--accent-text);line-height:1.6;"></div>

              <div id="taskAssignToWrap" style="margin-bottom:0.875rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">Assign to</label>
                <div style="display:flex;background:var(--bg-muted);border:1px solid var(--border);border-radius:var(--r-md);padding:3px;gap:3px;">
                  <button id="taskAssignAll" onclick="Teacher._setAssignScope('all')"
                          style="flex:1;padding:0.375rem 0.25rem;font-size:var(--text-xs);font-weight:500;cursor:pointer;border:none;border-radius:5px;transition:background var(--t-fast),color var(--t-fast),box-shadow var(--t-fast);background:var(--bg-base);color:var(--text-1);box-shadow:var(--shadow-xs);font-family:inherit;">All</button>
                  <button id="taskAssignClass" onclick="Teacher._setAssignScope('class')"
                          style="flex:1;padding:0.375rem 0.25rem;font-size:var(--text-xs);font-weight:500;cursor:pointer;border:none;border-radius:5px;transition:background var(--t-fast),color var(--t-fast);background:transparent;color:var(--text-3);box-shadow:none;font-family:inherit;">By Class</button>
                  <button id="taskAssignStudent" onclick="Teacher._setAssignScope('student')"
                          style="flex:1;padding:0.375rem 0.25rem;font-size:var(--text-xs);font-weight:500;cursor:pointer;border:none;border-radius:5px;transition:background var(--t-fast),color var(--t-fast);background:transparent;color:var(--text-3);box-shadow:none;font-family:inherit;">By Student</button>
                </div>
              </div>

              <div id="taskTargetClassWrap" style="display:none;margin-bottom:0.75rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">Class</label>
                <select id="taskTargetClass" onchange="Teacher._onTaskTargetChange()"></select>
              </div>

              <div id="taskTargetStudentWrap" style="display:none;margin-bottom:0.75rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">Student</label>
                <select id="taskTargetStudent" onchange="Teacher._onTaskTargetChange()"></select>
              </div>

              <label style="display:flex;align-items:center;gap:0.625rem;margin-bottom:0.875rem;cursor:pointer;padding:0.625rem 0.75rem;border-radius:var(--r-md);border:1px solid var(--border);background:var(--bg-base);">
                <input type="checkbox" id="tasksActive" style="width:1rem;height:1rem;accent-color:var(--accent);flex-shrink:0;cursor:pointer;" />
                <div>
                  <span style="font-size:var(--text-sm);font-weight:500;color:var(--text-1);">Active</span>
                  <span style="display:block;font-size:var(--text-xs);color:var(--text-3);margin-top:1px;">Students only see this task when Active is on</span>
                </div>
              </label>

              <div style="margin-bottom:0.75rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">Task Title</label>
                <input type="text" id="tasksTitle" placeholder="e.g. Term 2 Coaching Programme" />
              </div>

              <div style="margin-bottom:0.875rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">Message for Students</label>
                <textarea id="tasksMessage" placeholder="Instructions or motivation..." style="height:4rem;resize:vertical;"></textarea>
              </div>

              <div style="margin-bottom:0.875rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">
                  Exam Duration <span style="font-weight:400;text-transform:none;color:var(--text-4);">— for this task</span>
                </label>
                <select id="taskDurationMs">
                  <option value="">Use default (2 hours)</option>
                  <option value="1800000">30 minutes</option>
                  <option value="2700000">45 minutes</option>
                  <option value="3600000">1 hour</option>
                  <option value="5400000">1 hour 30 minutes</option>
                  <option value="7200000">2 hours (default)</option>
                  <option value="9000000">2 hours 30 minutes</option>
                  <option value="10800000">3 hours</option>
                </select>
              </div>

              <div id="taskDateConfigArea"></div>

              <div id="taskRecurringSubjectsWrap" style="display:none;margin-bottom:0.875rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">
                  Subject Restrictions <span style="font-weight:400;text-transform:none;color:var(--text-4);">— per day of week</span>
                </label>
                <div id="taskRecurringSubjectsList"></div>
              </div>

              <div style="display:flex;gap:0.5rem;padding-top:0.875rem;border-top:1px solid var(--border);">
                <button id="saveTasksBtn" onclick="Teacher.saveTasksConfig()" class="btn bg-green-600 hover:bg-green-700" style="flex:1;justify-content:center;font-size:var(--text-sm);">
                  Save &amp; Apply
                </button>
              </div>
            </div>

            <div class="glass-dark" style="padding:1.25rem;border-radius:var(--r-lg);">
              <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;padding-bottom:0.75rem;border-bottom:1px solid var(--border);">
                <div style="width:6px;height:6px;border-radius:50%;background:var(--danger);flex-shrink:0;"></div>
                <h3 style="font-size:var(--text-base);font-weight:600;color:var(--text-1);">Private Message</h3>
              </div>

              <div style="margin-bottom:0.75rem;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.375rem;">
                  <label style="font-size:var(--text-xs);font-weight:500;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;">Recipients</label>
                  <div style="display:flex;background:var(--bg-muted);border:1px solid var(--border);border-radius:var(--r-sm);padding:2px;gap:2px;">
                    <button id="msgModeSingle" onclick="Teacher._setMsgMode('single')"
                            style="padding:2px 9px;font-size:var(--text-xs);font-weight:500;cursor:pointer;border:none;border-radius:4px;font-family:inherit;transition:background var(--t-fast),color var(--t-fast),box-shadow var(--t-fast);background:var(--bg-base);color:var(--text-1);box-shadow:var(--shadow-xs);">Single</button>
                    <button id="msgModeMulti" onclick="Teacher._setMsgMode('multi')"
                            style="padding:2px 9px;font-size:var(--text-xs);font-weight:500;cursor:pointer;border:none;border-radius:4px;font-family:inherit;transition:background var(--t-fast),color var(--t-fast);background:transparent;color:var(--text-3);">Multiple</button>
                  </div>
                </div>
                <div id="msgSingleWrap">
                  <select id="msgStudent"><option value="">Select a student...</option></select>
                </div>
                <div id="msgMultiWrap" style="display:none;">
                  <input id="msgStudentSearch" type="text" placeholder="Search students..." oninput="Teacher._filterMsgStudents()" style="margin-bottom:0.375rem;" />
                  <div id="msgStudentList" style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-md);background:var(--bg-base);"></div>
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-top:0.375rem;">
                    <span id="msgSelectedCount" style="font-size:var(--text-xs);color:var(--text-3);">0 selected</span>
                    <div style="display:flex;gap:0.375rem;align-items:center;">
                      <button onclick="Teacher._selectAllMsgStudents()" style="font-size:var(--text-xs);font-weight:500;color:var(--accent);background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">Select all</button>
                      <span style="color:var(--border-strong);">·</span>
                      <button onclick="Teacher._clearMsgStudents()" style="font-size:var(--text-xs);font-weight:500;color:var(--text-3);background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">Clear</button>
                    </div>
                  </div>
                </div>
              </div>

              <div style="margin-bottom:0.75rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">Message</label>
                <textarea id="msgText" placeholder="Write your private message..." style="height:6rem;resize:vertical;"></textarea>
              </div>

              <div style="margin-bottom:0.875rem;">
                <label style="display:block;font-size:var(--text-xs);font-weight:500;color:var(--text-3);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:.04em;">Expires after</label>
                <select id="msgDuration">
                  <option value="3600000">1 hour</option>
                  <option value="86400000">1 day</option>
                  <option value="172800000">2 days</option>
                  <option value="259200000">3 days</option>
                  <option value="604800000">1 week</option>
                  <option value="1209600000">2 weeks</option>
                  <option value="2592000000">30 days</option>
                </select>
              </div>

              <div style="padding-top:0.875rem;border-top:1px solid var(--border);">
                <button id="sendMsgBtn" onclick="Teacher.sendPrivateMessage()" class="btn bg-red-600 hover:bg-red-700" style="width:100%;justify-content:center;font-size:var(--text-sm);">
                  Send Private Message
                </button>
              </div>
            </div>

          </div>
        </div>

        <div id="teacher-studyroom" class="teacher-tab hidden"></div>
        <div id="teacher-push" class="teacher-tab hidden">
          <div id="vtxTeacherPushPanel"></div>
        </div>
        <div id="teacher-timetable" class="teacher-tab hidden"></div>
        <div id="teacher-games" class="teacher-tab hidden">
          <div style="display:flex;gap:.375rem;margin-bottom:1rem;flex-wrap:wrap;">
            <button onclick="Teacher._showGamesSubTab('stats')" id="gamesSubTabStats" class="btn" style="font-size:var(--text-xs);">Game Stats</button>
            <button onclick="Teacher._showGamesSubTab('access')" id="gamesSubTabAccess" class="btn bg-gray-500" style="font-size:var(--text-xs);">Game Access</button>
          </div>
          <div id="teacherGameStatsContainer"></div>
          <div id="teacherGameRestrictionsContainer" class="hidden"></div>
        </div>
        <div id="teacher-activity" class="teacher-tab hidden"></div>
        <div id="teacher-groups" class="teacher-tab hidden"></div>
        <div id="teacher-dm" class="teacher-tab hidden"></div>

      </div>
    </div>`;

  _injectTeacherNavStyles();

  _startGlobalStudentCache();
  showTab('students');
}

function showTab(tab) {
   const ALL_TABS = ['approvals','students','results','schools','tasks','studyroom','games','timetable','activity','groups','chat','dm','push'];

  ALL_TABS.forEach(t => {
    const el  = document.getElementById(`teacher-${t}`);
    const btn = document.getElementById(`tab-${t}`);

    if (el) {
      if ((t === 'dm' || t === 'groups' || t === 'activity' || t === 'approvals') && t !== tab) {
        el.innerHTML = '';
      }
      el.classList.toggle('hidden', t !== tab);
    }

    if (btn) {
      btn.classList.toggle('is-active', t === tab);
    }
  });

  // Slide the indicator to the active button
  _moveNavIndicator(tab);

  // Scroll active button into view on narrow screens
  const activeBtn = document.getElementById(`tab-${tab}`);
  if (activeBtn) {
    activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  // Clean up game stats listener when leaving games tab
  if (tab !== 'games' && typeof window._teacherGameStatsCleanup === 'function') {
    window._teacherGameStatsCleanup();
  }

  if (tab === 'approvals') {
    if (window.ActivityLog && typeof ActivityLog.renderApprovalsPanel === 'function') {
      ActivityLog.renderApprovalsPanel('teacher-approvals');
    }
    return;
  }
  if (tab === 'dm')        { DM.openTeacherInbox();       return; }
  if (tab === 'chat')      { Chat.openPublicChat();        return; }
  if (tab === 'studyroom') { StudyRoom.openForTeacher();   return; }
  if (tab === 'groups')    { GroupChat.openForTeacher();   return; }
  if (tab === 'games') {
    if (typeof window._teacherGameStatsCleanup === 'function') {
      window._teacherGameStatsCleanup();
    }
    _showGamesSubTab('stats');
    return;
  }
  if (tab === 'timetable') { _loadTimetableManager();                        return; }
  if (tab === 'activity')  { _loadActivityLog();                             return; }
  if (tab === 'push')      { TeacherPush.renderPushPanel('vtxTeacherPushPanel'); return; }
  if (tab === 'students')  _loadStudents();
  if (tab === 'results')   _loadResults();
  if (tab === 'schools')   _loadSchools();
  if (tab === 'tasks')     _loadTasksManager();
}

function _moveNavIndicator(tab) {
  const nav  = document.getElementById('vtxTeacherNav');
  const ind  = document.getElementById('vtxNavIndicator');
  const btn  = document.getElementById(`tab-${tab}`);
  if (!nav || !ind || !btn) return;

  const navRect = nav.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();

  // Position relative to nav strip, accounting for scroll
  const left = btnRect.left - navRect.left + nav.scrollLeft;
  const width = btnRect.width;

  ind.style.left  = left + 'px';
  ind.style.width = width + 'px';

  // Colour for special tabs
  ind.className = 'vtx-td-nav-indicator';
  if (tab === 'chat') ind.classList.add('for-chat');
  if (tab === 'dm')   ind.classList.add('for-dm');
}

function _showGamesSubTab(sub) {
  const statsBtn   = document.getElementById('gamesSubTabStats');
  const accessBtn  = document.getElementById('gamesSubTabAccess');
  const statsPane  = document.getElementById('teacherGameStatsContainer');
  const accessPane = document.getElementById('teacherGameRestrictionsContainer');
  if (!statsPane || !accessPane) return;

  if (sub === 'access') {
    if (statsBtn)  { statsBtn.className  = 'btn bg-gray-500'; }
    if (accessBtn) { accessBtn.className = 'btn'; }
    statsPane.classList.add('hidden');
    accessPane.classList.remove('hidden');
    if (typeof window._teacherGameStatsCleanup === 'function') {
      window._teacherGameStatsCleanup();
    }
    Game.renderTeacherGameRestrictions('teacherGameRestrictionsContainer');
  } else {
    if (accessBtn) { accessBtn.className = 'btn bg-gray-500'; }
    if (statsBtn)  { statsBtn.className  = 'btn'; }
    accessPane.classList.add('hidden');
    statsPane.classList.remove('hidden');
    Game.renderTeacherGameStats('teacherGameStatsContainer');
  }
}

  function _loadStudents() {
  const container = document.getElementById('studentsList');
  if (!container) return;
  container.innerHTML = `
    <div style="text-align:center;padding:2rem;color:var(--text-3);font-size:var(--text-sm);">
      Loading students...</div>`;

  _cancel('students');
  const unsub = Db().collection('students').onSnapshot(
    snap => {
      const bySchool = {};
      snap.forEach(doc => {
        const d = doc.data();
        const school = d.school || 'No School';
        if (!bySchool[school]) bySchool[school] = [];
        bySchool[school].push({ id: doc.id, ...d });
      });
      const schools = Object.keys(bySchool).sort();
      if (schools.length === 0) {
        container.innerHTML = `
          <div style="text-align:center;padding:2rem;color:var(--text-3);font-size:var(--text-sm);">
            No students registered yet.</div>`;
        return;
      }
      container.innerHTML = schools.map(school => {
        const students = bySchool[school];
        return `
          <details class="glass-dark overflow-hidden mb-3" style="border-radius:10px;" open>
            <summary style="cursor:pointer;">
              <span style="font-weight:700;font-size:var(--text-base);">${_esc(school)}</span>
              <span style="margin-left:.5rem;font-size:var(--text-xs);font-weight:500;
                           background:var(--accent-subtle);color:var(--accent-text);
                           border:1px solid var(--accent-border);
                           padding:1px 7px;border-radius:99px;">${students.length}</span>
            </summary>
            <div style="padding:.875rem 1rem;">
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.625rem;">
                ${students.map(s => {
                  const joined = s.createdAt
                    ? new Date(s.createdAt.toDate ? s.createdAt.toDate() : s.createdAt).toLocaleDateString()
                    : '—';
                  const admno = s.admissionNo ? `<p style="font-size:var(--text-xs);color:var(--accent);
                    margin-top:2px;font-weight:600;">🪪 ${_esc(s.admissionNo)}</p>` : '';
                  return `
                    <div style="position:relative;background:var(--bg-base);
                                border:1px solid var(--border);border-radius:8px;
                                padding:.75rem .875rem .75rem 2.25rem;">
                      <button class="teacher-toggle-admin"
                              data-uid="${_esc(s.id)}" data-name="${_esc(s.name)}"
                              data-is-admin="${s.isAdmin ? 'true' : 'false'}"
                              aria-label="Toggle admin for ${_esc(s.name)}"
                              style="position:absolute;top:.5rem;left:.5rem;background:none;border:none;
                                     cursor:pointer;font-size:.875rem;line-height:1;padding:2px;
                                     color:${s.isAdmin ? 'var(--warning)' : 'var(--border-strong)'};">
                        ${s.isAdmin ? '★' : '☆'}
                      </button>
                      <button class="teacher-edit-student" data-uid="${_esc(s.id)}"
                              aria-label="Edit ${_esc(s.name)}"
                              style="position:absolute;top:.375rem;right:1.625rem;background:none;border:none;
                                     cursor:pointer;font-size:.75rem;line-height:1;padding:2px 4px;
                                     color:var(--accent);font-weight:700;"
                              onmouseenter="this.style.color='var(--accent-hover)'"
                              onmouseleave="this.style.color='var(--accent)'">✎</button>
                      <button class="teacher-delete-student" data-uid="${_esc(s.id)}"
                              aria-label="Delete ${_esc(s.name)}"
                              style="position:absolute;top:.375rem;right:.5rem;background:none;border:none;
                                     cursor:pointer;font-size:1rem;line-height:1;padding:2px 4px;
                                     color:var(--text-4);"
                              onmouseenter="this.style.color='var(--danger)'"
                              onmouseleave="this.style.color='var(--text-4)'">×</button>
                      <p style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:1rem;">
                        ${_esc(s.name)}</p>
                      <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:1px;">${_esc(s.class || '—')}</p>
                      <p style="font-size:var(--text-xs);color:var(--text-4);margin-top:3px;
                                overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(s.email || '')}</p>
                      ${admno}
                      <p style="font-size:var(--text-xs);color:var(--text-4);margin-top:4px;">Joined ${joined}</p>
                    </div>`;
                }).join('')}
              </div>
            </div>
          </details>`;
      }).join('');
    },
    err => {
      console.error('[teacher] Error loading students:', err);
      container.innerHTML = `<p style="text-align:center;color:var(--danger);font-size:var(--text-sm);">Error loading students.</p>`;
    }
  );
  _reg('students', unsub);
}

  document.addEventListener('click', async e => {
  const deleteBtn = e.target.closest('.teacher-delete-student');
  if (deleteBtn) { await removeStudent(deleteBtn.dataset.uid); return; }
  const editBtn = e.target.closest('.teacher-edit-student');
  if (editBtn) { await editStudent(editBtn.dataset.uid); return; }
  const adminBtn = e.target.closest('.teacher-toggle-admin');
  if (adminBtn) {
    await toggleAdmin(adminBtn.dataset.uid, adminBtn.dataset.name, adminBtn.dataset.isAdmin === 'true');
  }
});

  async function removeStudent(uid) {
  if (!uid) return;
  const ok = await UI.confirmAction('Permanently delete this student and all their data?');
  if (!ok) return;

  try {
    // 1. Fetch student record first (need name + admissionNo before deleting)
    const studentSnap = await Db().collection('students').doc(uid).get();
    const studentData = studentSnap.exists ? studentSnap.data() : null;
    const name        = studentData ? studentData.name        : null;
    const admissionNo = studentData ? studentData.admissionNo : null;

    const batch = Db().batch();

    // 2. Delete student profile
    batch.delete(Db().collection('students').doc(uid));

    // 3. Delete ongoing exam
    batch.delete(Db().collection('ongoingExams').doc(uid));

    // 4. Delete chat notification doc
    batch.delete(Db().collection('chatNotifications').doc(uid));

    // 5. Delete admission number lookup doc (if one exists)
    if (admissionNo) {
      batch.delete(Db().collection('admissionNumbers').doc(admissionNo.toUpperCase()));
    }

    // 6. Delete student-specific coaching task docs
    batch.delete(Db().collection('coachingTasks').doc('student_' + uid));
    batch.delete(Db().collection('coachingTasks').doc('weekly_student_' + uid));

    // Commit the core deletion first — this is the critical step.
    // Even if cleanup steps below fail, the student IS deleted.
    await batch.commit();

  } catch (err) {
    console.error('[teacher] removeStudent core batch error:', err);
    UI.toast('Failed to delete student. Please try again.', 'error');
    return; // Only bail out here — if core batch fails, nothing was deleted
  }

  // --- Core deletion succeeded. Run cleanup steps independently. ---
  // Failures here are logged but do NOT trigger the error toast,
  // because the student record is already gone.

  // 7. Delete exam results
  try {
    let resultSnap = await Db().collection('results').where('uid', '==', uid).get();
    if (resultSnap.empty && name) {
      resultSnap = await Db().collection('results').where('name', '==', name).get();
    }
    if (!resultSnap.empty) {
      const resultBatch = Db().batch();
      resultSnap.forEach(d => resultBatch.delete(d.ref));
      await resultBatch.commit();
    }
  } catch (err) {
    console.warn('[teacher] removeStudent: could not delete results (non-fatal):', err);
  }

  // 8. Delete private messages sent to this student
  try {
    const privateMsgSnap = await Db()
      .collection('privateMessages')
      .where('recipientId', '==', uid)
      .get();
    if (!privateMsgSnap.empty) {
      const pmBatch = Db().batch();
      privateMsgSnap.forEach(d => pmBatch.delete(d.ref));
      await pmBatch.commit();
    }
  } catch (err) {
    console.warn('[teacher] removeStudent: could not delete private messages (non-fatal):', err);
  }

  // 9. Delete DM thread subcollection messages (and their editHistory), then the thread doc
  try {
    const dmThreadRef = Db().collection('directMessages').doc(uid);
    const dmMsgSnap   = await dmThreadRef.collection('messages').get();

    if (!dmMsgSnap.empty) {
      // Delete editHistory sub-subcollection for each message first
      for (const msgDoc of dmMsgSnap.docs) {
        try {
          const editHistorySnap = await msgDoc.ref.collection('editHistory').get();
          if (!editHistorySnap.empty) {
            const ehBatch = Db().batch();
            editHistorySnap.forEach(d => ehBatch.delete(d.ref));
            await ehBatch.commit();
          }
        } catch (ehErr) {
          console.warn('[teacher] removeStudent: could not delete editHistory (non-fatal):', ehErr);
        }
      }

      // Now delete the messages themselves in chunks of 400
      const allMsgRefs = dmMsgSnap.docs.map(d => d.ref);
      for (let i = 0; i < allMsgRefs.length; i += 400) {
        const msgBatch = Db().batch();
        allMsgRefs.slice(i, i + 400).forEach(ref => msgBatch.delete(ref));
        await msgBatch.commit();
      }
    }

    await dmThreadRef.delete();
  } catch (err) {
    console.warn('[teacher] removeStudent: could not delete DM thread (non-fatal):', err);
  }

  UI.toast('Student and all associated data deleted.', 'success');
}

async function editStudent(uid) {
  if (!uid) return;

  let studentData;
  try {
    const snap = await Db().collection('students').doc(uid).get();
    if (!snap.exists) { UI.toast('Student not found.', 'error'); return; }
    studentData = snap.data();
  } catch (err) {
    console.error('[teacher] editStudent fetch error:', err);
    UI.toast('Failed to load student data.', 'error');
    return;
  }

  const existing = document.getElementById('teacherEditStudentModal');
  if (existing) existing.remove();

  const classOptions = ['JSS1','JSS2','JSS3','SSS1','SSS2','SSS3','TUTORIAL']
    .map(c => `<option value="${c}" ${studentData.class === c ? 'selected' : ''}>${c}</option>`)
    .join('');

  const overlay = document.createElement('div');
  overlay.id = 'teacherEditStudentModal';

  overlay.innerHTML = `
    <div style="background:var(--bg-base);border:1px solid var(--border);
                border-radius:12px;padding:1.5rem;width:100%;max-width:440px;margin:auto;
                box-shadow:var(--shadow-xl);
                animation:cbt-modal-in .22s cubic-bezier(.34,1.45,.64,1) both;">

      <div style="display:flex;align-items:center;justify-content:space-between;
                  margin-bottom:1.25rem;padding-bottom:.875rem;
                  border-bottom:1px solid var(--border);">
        <div>
          <h2 style="font-size:1rem;font-weight:700;color:var(--text-1);">Edit Student</h2>
          <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:2px;">
            ${_esc(studentData.name || '')} &bull; UID: ${_esc(uid.slice(0,8))}…
          </p>
        </div>
        <button onclick="document.getElementById('teacherEditStudentModal').remove()"
                style="background:none;border:none;cursor:pointer;font-size:1.25rem;
                       line-height:1;color:var(--text-3);padding:2px 6px;"
                onmouseenter="this.style.color='var(--danger)'"
                onmouseleave="this.style.color='var(--text-3)'">×</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:.875rem;">

        <div>
          <label style="display:block;font-size:var(--text-xs);font-weight:600;
                        color:var(--text-2);margin-bottom:.3125rem;">Full Name</label>
          <input id="editStudentName" type="text" value="${_esc(studentData.name || '')}"
                 placeholder="Student's full name"
                 style="width:100%;box-sizing:border-box;" />
        </div>

        <div>
          <label style="display:block;font-size:var(--text-xs);font-weight:600;
                        color:var(--text-2);margin-bottom:.3125rem;">Class</label>
          <select id="editStudentClass" style="width:100%;box-sizing:border-box;">
            ${classOptions}
          </select>
        </div>

        <div>
          <label style="display:block;font-size:var(--text-xs);font-weight:600;
                        color:var(--text-2);margin-bottom:.3125rem;">School</label>
          <select id="editStudentSchool" style="width:100%;box-sizing:border-box;">
            <option value="" disabled>Loading schools…</option>
          </select>
        </div>

        <div>
          <label style="display:block;font-size:var(--text-xs);font-weight:600;
                        color:var(--text-2);margin-bottom:.3125rem;">
            Admission / Registration Number
            <span style="font-weight:400;color:var(--text-3);">— optional</span>
          </label>
          <input id="editStudentAdmno" type="text"
                 value="${_esc(studentData.admissionNo || '')}"
                 placeholder="e.g. VTX-2024-001"
                 style="width:100%;box-sizing:border-box;text-transform:uppercase;"
                 oninput="this.value=this.value.toUpperCase()" />
          <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:.25rem;line-height:1.5;">
            Must be unique. Students can use this to log in instead of their email.
            Leave blank to remove.
          </p>
        </div>

        <div>
          <label style="display:block;font-size:var(--text-xs);font-weight:600;
                        color:var(--text-2);margin-bottom:.3125rem;">
            Timetable Group
            <span style="font-weight:400;color:var(--text-3);">— optional</span>
          </label>
          <select id="editStudentTimetableGroup" style="width:100%;box-sizing:border-box;">
            <option value="">None (use class timetable)</option>
            <option value="__loading__" disabled>Loading groups…</option>
          </select>
          <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:.25rem;line-height:1.5;">
            If set, this student sees the timetable for that group instead of the class timetable.
          </p>
        </div>

        <div style="padding:.625rem .875rem;background:var(--bg-subtle);
                    border:1px solid var(--border);border-radius:8px;
                    font-size:var(--text-xs);color:var(--text-3);line-height:1.6;">
          ℹ️ Email address cannot be changed here. To update a student's email,
          the student must contact you and re-register with the new email.
        </div>

      </div>

      <div style="display:flex;gap:.625rem;margin-top:1.25rem;padding-top:.875rem;
                  border-top:1px solid var(--border);">
        <button onclick="document.getElementById('teacherEditStudentModal').remove()"
                class="btn bg-gray-500 hover:bg-gray-600"
                style="flex:1;justify-content:center;font-size:var(--text-sm);">
          Cancel
        </button>
        <button id="editStudentSaveBtn"
                onclick="Teacher._saveStudentEdit('${_esc(uid)}', '${_esc(studentData.admissionNo || '')}')"
                class="btn bg-blue-600 hover:bg-blue-700"
                style="flex:1;justify-content:center;font-size:var(--text-sm);">
          Save Changes
        </button>
      </div>

    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });

  // Load schools
  try {
    const schoolsSnap = await Db().collection('schools').orderBy('name').get();
    const schoolSel   = document.getElementById('editStudentSchool');
    if (schoolSel) {
      let html = '<option value="" disabled>Select school</option>';
      if (schoolsSnap.empty) {
        html += `<option value="${_esc(studentData.school || '')}" selected>${_esc(studentData.school || 'No schools listed')}</option>`;
      } else {
        schoolsSnap.forEach(doc => {
          const n = _esc(doc.data().name);
          html += `<option value="${n}" ${studentData.school === doc.data().name ? 'selected' : ''}>${n}</option>`;
        });
        const names = schoolsSnap.docs.map(d => d.data().name);
        if (studentData.school && !names.includes(studentData.school)) {
          html += `<option value="${_esc(studentData.school)}" selected>${_esc(studentData.school)} (current)</option>`;
        }
      }
      schoolSel.innerHTML = html;
    }
  } catch (err) {
    console.warn('[teacher] editStudent school load error:', err);
    const schoolSel = document.getElementById('editStudentSchool');
    if (schoolSel) {
      schoolSel.innerHTML = `<option value="${_esc(studentData.school || '')}" selected>${_esc(studentData.school || '—')}</option>`;
    }
  }

  // Load available timetable groups from weeklyTimetable_custom
  try {
    const groupSnap = await Db().collection('weeklyTimetable_custom').get();
    const groupSel  = document.getElementById('editStudentTimetableGroup');
    if (groupSel) {
      // Extract unique group names from docs whose id starts with "group_"
      const groupNames = [];
      groupSnap.forEach(doc => {
        if (doc.id.startsWith('group_')) {
          const label = doc.data().targetLabel || doc.id.replace('group_', '').replace(/_/g, ' ');
          if (label && !groupNames.includes(label)) groupNames.push(label);
        }
      });
      groupNames.sort();

      const currentGroup = studentData.timetableGroup || '';

      let html = '<option value="">None (use class timetable)</option>';
      groupNames.forEach(g => {
        html += `<option value="${_esc(g)}" ${currentGroup === g ? 'selected' : ''}>${_esc(g)}</option>`;
      });

      // If student has a group that isn't in the list (e.g. group doc deleted), still show it
      if (currentGroup && !groupNames.includes(currentGroup)) {
        html += `<option value="${_esc(currentGroup)}" selected>${_esc(currentGroup)} (current)</option>`;
      }

      groupSel.innerHTML = html;
    }
  } catch (err) {
    console.warn('[teacher] editStudent group load error:', err);
    const groupSel = document.getElementById('editStudentTimetableGroup');
    if (groupSel) {
      const currentGroup = studentData.timetableGroup || '';
      groupSel.innerHTML = `
        <option value="">None (use class timetable)</option>
        ${currentGroup ? `<option value="${_esc(currentGroup)}" selected>${_esc(currentGroup)}</option>` : ''}`;
    }
  }
}

async function _saveStudentEdit(uid, previousAdmno) {
  const btn       = document.getElementById('editStudentSaveBtn');
  const nameEl    = document.getElementById('editStudentName');
  const classEl   = document.getElementById('editStudentClass');
  const schoolEl  = document.getElementById('editStudentSchool');
  const admnoEl   = document.getElementById('editStudentAdmno');

  const name   = (nameEl?.value   || '').trim();
  const cls    = (classEl?.value  || '').trim();
  const school = (schoolEl?.value || '').trim();
  const admno  = (admnoEl?.value  || '').trim().toUpperCase();

  if (!name)   { UI.toast('Name cannot be empty.',  'warning'); return; }
  if (!cls)    { UI.toast('Please select a class.', 'warning'); return; }
  if (!school) { UI.toast('Please select a school.','warning'); return; }

  if (admno && !/^[A-Z0-9\-_]{1,30}$/.test(admno)) {
    UI.toast(
      'Admission number can only contain letters, numbers, hyphens, and underscores (max 30 characters).',
      'warning',
      6000
    );
    return;
  }

  UI.setLoading(btn, true);

  try {
    const admnoChanged     = admno !== previousAdmno.toUpperCase();
    const removingAdmno    = admnoChanged && admno === '';
    const addingOrChanging = admnoChanged && admno !== '';

    if (addingOrChanging) {
      const existingSnap = await Db().collection('admissionNumbers').doc(admno).get();
      if (existingSnap.exists && existingSnap.data().uid !== uid) {
        UI.toast(
          `Admission number "${admno}" is already assigned to another student.`,
          'error',
          7000
        );
        UI.setLoading(btn, false);
        return;
      }
    }

    const studentSnap = await Db().collection('students').doc(uid).get();
    if (!studentSnap.exists) {
      UI.toast('Student record not found. It may have been deleted.', 'error');
      UI.setLoading(btn, false);
      return;
    }
    const email = studentSnap.data().email || '';

    const batch = Db().batch();

    const timetableGroupInput = document.getElementById('editStudentTimetableGroup');
    const timetableGroup = timetableGroupInput ? timetableGroupInput.value.trim() : undefined;
    // Update student profile
    batch.update(Db().collection('students').doc(uid), {
      name,
      class:        cls,
      school,
      admissionNo:  admno || null,
      ...(timetableGroup !== undefined ? { timetableGroup: timetableGroup || null } : {}),
    });

    // Update denormalized name in DM thread doc
    batch.set(Db().collection('directMessages').doc(uid), {
      studentName:  name,
      studentClass: cls,
    }, { merge: true });

    // Update denormalized name in student-specific coaching task docs
    batch.set(Db().collection('coachingTasks').doc('student_' + uid), {
      studentName: name,
    }, { merge: true });
    batch.set(Db().collection('coachingTasks').doc('weekly_student_' + uid), {
      studentName: name,
    }, { merge: true });

    if (addingOrChanging) {
      batch.set(Db().collection('admissionNumbers').doc(admno), { uid, email });
      if (previousAdmno) {
        batch.delete(Db().collection('admissionNumbers').doc(previousAdmno.toUpperCase()));
      }
    } else if (removingAdmno && previousAdmno) {
      batch.delete(Db().collection('admissionNumbers').doc(previousAdmno.toUpperCase()));
    }

    await batch.commit();

    // Update denormalized name in all result documents for this student
    try {
      const resultsSnap = await Db().collection('results').where('uid', '==', uid).get();
      if (!resultsSnap.empty) {
        const resultsBatch = Db().batch();
        resultsSnap.forEach(d => resultsBatch.update(d.ref, { name }));
        await resultsBatch.commit();
      }
    } catch (e) {
      console.warn('[teacher] Could not update name in results:', e);
    }

    // Update denormalized name in all public chat messages from this student
    try {
      const chatSnap = await Db().collection('publicChat').where('senderId', '==', uid).get();
      if (!chatSnap.empty) {
        const chatBatch = Db().batch();
        chatSnap.forEach(d => chatBatch.update(d.ref, { senderName: name, senderClass: cls }));
        await chatBatch.commit();
      }
    } catch (e) {
      console.warn('[teacher] Could not update name in public chat:', e);
    }

    UI.toast(`Student record updated successfully.`, 'success');
    document.getElementById('teacherEditStudentModal')?.remove();

  } catch (err) {
    console.error('[teacher] _saveStudentEdit error:', err);
    const msg = err.code === 'permission-denied'
      ? 'Permission denied. Are you logged in as a teacher?'
      : 'Failed to save changes. Please try again.';
    UI.toast(msg, 'error');
  } finally {
    UI.setLoading(btn, false);
  }
}

  async function toggleAdmin(uid, name, currentlyAdmin) {
    if (!uid) return;
    const ok = await UI.confirmAction(
      currentlyAdmin ? `Remove admin role from ${name}?` : `Give admin role to ${name}?`
    );
    if (!ok) return;
    try {
      const ref = Db().collection('admins').doc(uid);
      if (currentlyAdmin) {
        await ref.delete();
        await Db().collection('students').doc(uid).update({ isAdmin: false }).catch(() => {});
      } else {
        await ref.set({ created: firebase.firestore.FieldValue.serverTimestamp() });
        await Db().collection('students').doc(uid).update({ isAdmin: true }).catch(() => {});
      }
      UI.toast(`Admin status updated for ${name}.`, 'success');
    } catch (err) {
      console.error('[teacher] toggleAdmin error:', err);
      UI.toast('Failed to update admin status.', 'error');
    }
  }

  function _loadResults() {
    const container = document.getElementById('resultsList');
    if (!container) return;
    _cancel('results');
    const unsub = Db().collection('results').orderBy('timestamp', 'desc').onSnapshot(
      snap => {
        if (snap.empty) {
          container.innerHTML = `
            <p style="grid-column:1/-1;text-align:center;padding:2rem;
                      color:var(--text-3);font-size:var(--text-sm);">No results yet.</p>`;
          return;
        }
        container.innerHTML = snap.docs.map(doc => {
          const r = doc.data();
          const gradeColor = r.grade === 'A' ? 'var(--success)'
                           : r.grade === 'B' ? 'var(--info)'
                           : r.grade === 'C' ? 'var(--warning)'
                           : r.grade === 'D' ? 'var(--warning)'
                           : 'var(--danger)';
          const pct = r.percentage || 0;
          const ts  = r.timestamp
            ? new Date(r.timestamp.toDate ? r.timestamp.toDate() : r.timestamp).toLocaleDateString()
            : '—';
          const hasDetail = !!(r.questionSnapshots);
          return `
            <div class="teacher-result-card" data-result-id="${_esc(doc.id)}"
                 title="${hasDetail ? 'Click to review full attempt' : 'No detailed data'}"
                 style="position:relative;background:var(--bg-base);
                        border:1px solid var(--border);border-radius:10px;
                        padding:.875rem 1rem;overflow:hidden;">
              <button class="teacher-export-result" data-id="${_esc(doc.id)}" aria-label="Export result as PDF"
                      title="Export this result as a PDF"
                      style="position:absolute;top:.5rem;right:1.75rem;background:none;border:none;
                             cursor:pointer;font-size:.8125rem;line-height:1;padding:2px 4px;
                             color:var(--text-4);z-index:2;"
                      onmouseenter="this.style.color='var(--accent)'"
                      onmouseleave="this.style.color='var(--text-4)'">📄</button>
              <button class="teacher-delete-result" data-id="${_esc(doc.id)}" aria-label="Delete result"
                      style="position:absolute;top:.5rem;right:.625rem;background:none;border:none;
                             cursor:pointer;font-size:1rem;line-height:1;padding:2px 4px;
                             color:var(--text-4);z-index:2;"
                      onmouseenter="this.style.color='var(--danger)'"
                      onmouseleave="this.style.color='var(--text-4)'">×</button>
              <div style="display:flex;align-items:flex-start;gap:.625rem;margin-bottom:.625rem;">
                <div style="min-width:48px;height:48px;border-radius:8px;
                            background:var(--bg-subtle);border:1px solid var(--border);
                            display:flex;flex-direction:column;align-items:center;
                            justify-content:center;flex-shrink:0;">
                  <span style="font-size:var(--text-xs);font-weight:700;color:${gradeColor};line-height:1;">${pct}%</span>
                  <span style="font-size:1rem;font-weight:800;color:${gradeColor};line-height:1;margin-top:1px;">
                    ${_esc(r.grade || '?')}</span>
                </div>
                <div style="min-width:0;flex:1;padding-right:2.25rem;">
                  <p style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);
                             white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(r.name || '')}</p>
                  <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:1px;">
                    ${_esc(r.class || '')} · ${_esc(r.school || '')}</p>
                </div>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:.25rem;margin-bottom:.5rem;">
                ${(r.subjects || []).map(s => `
                  <span style="font-size:var(--text-xs);font-weight:600;
                               background:var(--bg-subtle);border:1px solid var(--border);
                               border-radius:4px;padding:1px 6px;color:var(--text-2);">
                    ${_esc(s)}: ${r.scores?.[s] || 0}%
                  </span>`).join('')}
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <p style="font-size:var(--text-xs);color:var(--text-4);">${ts}</p>
                ${hasDetail
                  ? `<span style="font-size:var(--text-xs);font-weight:600;color:var(--accent-text);
                                  background:var(--accent-subtle);border:1px solid var(--accent-border);
                                  border-radius:4px;padding:1px 7px;">View attempt →</span>`
                  : `<span style="font-size:var(--text-xs);color:var(--text-4);font-style:italic;">No detail</span>`}
              </div>
            </div>`;
        }).join('');
      },
      err => {
        console.error('[teacher] Error loading results:', err);
        container.innerHTML = `
          <p style="grid-column:1/-1;text-align:center;color:var(--danger);font-size:var(--text-sm);">
            Error loading results.</p>`;
      }
    );
    _reg('results', unsub);
  }

  document.addEventListener('click', async e => {
    const deleteBtn = e.target.closest('.teacher-delete-result');
    if (deleteBtn) { e.stopPropagation(); await deleteResult(deleteBtn.dataset.id); return; }
    const exportBtn = e.target.closest('.teacher-export-result');
    if (exportBtn) { e.stopPropagation(); await exportResultPDF(exportBtn.dataset.id); return; }
    const card = e.target.closest('.teacher-result-card');
    if (card && card.dataset.resultId) { await _openReviewModal(card.dataset.resultId); }
    const taskBtn = e.target.closest('.teacher-delete-task');
    if (taskBtn) { e.stopPropagation(); await deleteTask(taskBtn.dataset.taskId); }
  });

  async function deleteResult(id) {
    if (!id) return;
    const ok = await UI.confirmAction('Delete this result permanently?');
    if (!ok) return;
    try {
      await Db().collection('results').doc(id).delete();
      UI.toast('Result deleted.', 'success');
    } catch (err) {
      console.error('[teacher] deleteResult error:', err);
      UI.toast('Failed to delete result.', 'error');
    }
  }

  async function _openReviewModal(resultId) {
    const existing = document.getElementById('teacherReviewModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'teacherReviewModal';
    overlay.innerHTML = `
      <div class="review-panel" style="text-align:center;padding:3rem 1.5rem;">
        <div style="font-size:var(--text-base);color:var(--text-3);">Loading attempt…</div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });

    let r;
    try {
      const snap = await Db().collection('results').doc(resultId).get();
      if (!snap.exists) {
        overlay.querySelector('.review-panel').innerHTML = `
          <p style="color:var(--danger);font-size:var(--text-base);">Result not found.</p>
          <button onclick="document.getElementById('teacherReviewModal').remove()"
                  class="btn bg-gray-500" style="margin-top:1rem;">Close</button>`;
        return;
      }
      r = snap.data();
    } catch (err) {
      overlay.querySelector('.review-panel').innerHTML = `
        <p style="color:var(--danger);font-size:var(--text-base);">Failed to load result.</p>
        <button onclick="document.getElementById('teacherReviewModal').remove()"
                class="btn bg-gray-500" style="margin-top:1rem;">Close</button>`;
      return;
    }

    const gradeColor = r.grade === 'A' ? 'var(--success)'
                     : r.grade === 'B' ? 'var(--info)'
                     : r.grade === 'C' ? 'var(--warning)'
                     : r.grade === 'D' ? 'var(--warning)'
                     : 'var(--danger)';
    const ts = r.timestamp
      ? new Date(r.timestamp.toDate ? r.timestamp.toDate() : r.timestamp)
          .toLocaleString('en-GB', { dateStyle:'medium', timeStyle:'short' })
      : '—';

    if (!r.questionSnapshots) {
      overlay.querySelector('.review-panel').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;gap:.75rem;">
          <div style="min-width:0;">
            <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">${_esc(r.name || '')}</h2>
            <p style="font-size:var(--text-sm);color:var(--text-3);margin-top:2px;">
              ${_esc(r.class || '')} · ${_esc(r.school || '')} · ${ts}</p>
          </div>
          <div style="display:flex;gap:.5rem;flex-shrink:0;">
            <button onclick="Teacher.exportResultPDF('${_esc(resultId)}')"
                    class="btn bg-blue-600 hover:bg-blue-700" style="font-size:var(--text-sm);white-space:nowrap;">
              📄 Export PDF
            </button>
            <button onclick="document.getElementById('teacherReviewModal').remove()"
                    class="btn bg-gray-500" style="font-size:var(--text-sm);">Close</button>
          </div>
        </div>
        <div style="padding:2rem;text-align:center;background:var(--bg-subtle);
                    border-radius:8px;border:1px solid var(--border);">
          <p style="font-size:2rem;">📋</p>
          <p style="font-size:var(--text-base);font-weight:600;color:var(--text-1);margin-top:.5rem;">
            Detailed attempt data not available</p>
          <p style="font-size:var(--text-sm);color:var(--text-3);margin-top:.375rem;line-height:1.6;">
            This result was submitted before per-question tracking was introduced.</p>
        </div>`;
      return;
    }

    const subjectBlocks = (r.subjects || []).map(subj => {
      const qs = r.questionSnapshots[subj] || [];
      const correctCount = r.correctCounts?.[subj] ?? qs.filter(q => q.chosen === q.ans).length;
      const pct = r.scores?.[subj] ?? 0;
      const questionsHtml = qs.map((q, i) => {
        const isSkipped = q.chosen === null || q.chosen === undefined;
        const isCorrect = !isSkipped && q.chosen === q.ans;
        const cardClass = isCorrect ? 'review-q-card--correct' : isSkipped ? 'review-q-card--skipped' : 'review-q-card--wrong';
        const chosenColor = isCorrect ? 'var(--success)' : isSkipped ? 'var(--text-4)' : 'var(--danger)';
        const chosenText  = isSkipped ? 'Not answered' : _escQ(q.opts?.[q.chosen] ?? '—');
        const correctText = _escQ(q.opts?.[q.ans] ?? '—');
        return `
          <div class="review-q-card ${cardClass}">
            <p style="font-size:var(--text-base);font-weight:600;margin-bottom:.75rem;line-height:1.6;">
              ${i + 1}. ${_escQ(q.q)}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;font-size:var(--text-sm);margin-bottom:.75rem;">
              <div>
                <span style="font-weight:600;color:var(--text-3);">Student answered:</span>
                <span style="display:block;margin-top:2px;font-weight:500;color:${chosenColor};">${chosenText}</span>
              </div>
              <div>
                <span style="font-weight:600;color:var(--text-3);">Correct answer:</span>
                <span style="display:block;margin-top:2px;font-weight:500;color:var(--success);">${correctText}</span>
              </div>
            </div>
            ${q.exp ? `
              <div style="background:var(--bg-subtle);border:1px solid var(--border);
                          border-radius:6px;padding:.5625rem .875rem;font-size:var(--text-sm);
                          color:var(--text-2);line-height:1.6;">
                <span style="font-weight:600;">Explanation:</span> ${_escQ(q.exp)}
              </div>` : ''}
          </div>`;
      }).join('');
      return `
        <details style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:.75rem;">
          <summary style="padding:.875rem 1.125rem;font-size:var(--text-base);font-weight:700;cursor:pointer;
                          background:var(--bg-subtle);display:flex;align-items:center;
                          justify-content:space-between;list-style:none;user-select:none;">
            <span>${_esc(subj)}</span>
            <span style="font-size:var(--text-sm);font-weight:600;
                         color:${pct >= 50 ? 'var(--success)' : 'var(--danger)'};">
              ${correctCount}/${qs.length} correct · ${pct}%</span>
          </summary>
          <div style="padding:1rem;display:flex;flex-direction:column;gap:.75rem;">
            ${questionsHtml || '<p style="font-size:var(--text-sm);color:var(--text-3);">No questions found.</p>'}
          </div>
        </details>`;
    }).join('');

    overlay.querySelector('.review-panel').innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;
                  margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid var(--border);">
        <div style="min-width:0;">
          <h2 style="font-size:1.125rem;font-weight:700;color:var(--text-1);">${_esc(r.name || '')}</h2>
          <p style="font-size:var(--text-sm);color:var(--text-3);margin-top:3px;">
            ${_esc(r.class || '')} · ${_esc(r.school || '')}</p>
          <p style="font-size:var(--text-xs);color:var(--text-4);margin-top:2px;">${ts}</p>
        </div>
        <div style="display:flex;gap:.5rem;flex-shrink:0;">
          <button onclick="Teacher.exportResultPDF('${_esc(resultId)}')"
                  class="btn bg-blue-600 hover:bg-blue-700" style="font-size:var(--text-sm);white-space:nowrap;">
            📄 Export PDF
          </button>
          <button onclick="document.getElementById('teacherReviewModal').remove()"
                  class="btn bg-gray-500" style="font-size:var(--text-sm);">Close</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;
                  background:var(--bg-subtle);border:1px solid var(--border);
                  border-radius:8px;padding:.875rem 1.125rem;margin-bottom:1.25rem;">
        <div style="text-align:center;min-width:60px;">
          <div style="font-size:2rem;font-weight:800;color:${gradeColor};line-height:1;">${r.percentage || 0}%</div>
          <div style="font-size:var(--text-sm);font-weight:700;color:${gradeColor};">Grade ${_esc(r.grade || '?')}</div>
        </div>
        <div style="flex:1;display:flex;flex-wrap:wrap;gap:.375rem;">
          ${(r.subjects || []).map(s => `
            <div style="background:var(--bg-base);border:1px solid var(--border);border-radius:6px;
                        padding:.375rem .75rem;text-align:center;min-width:80px;">
              <div style="font-size:var(--text-xs);color:var(--text-3);font-weight:500;">${_esc(s)}</div>
              <div style="font-size:var(--text-base);font-weight:700;color:var(--text-1);">${r.scores?.[s] || 0}%</div>
              <div style="font-size:var(--text-xs);color:var(--text-4);">
                ${r.correctCounts?.[s] ?? '?'}/${(r.questionSnapshots?.[s] || []).length}</div>
            </div>`).join('')}
        </div>
      </div>
      <div>${subjectBlocks || '<p style="font-size:var(--text-sm);color:var(--text-3);">No subjects found.</p>'}</div>`;

    if (window._katexAutoRenderReady && window.renderMathInElement) {
      requestAnimationFrame(() => {
        try {
          renderMathInElement(overlay, {
            delimiters: [
              { left:'$$', right:'$$', display:true  },
              { left:'$',  right:'$',  display:false },
              { left:'\\(', right:'\\)', display:false },
              { left:'\\[', right:'\\]', display:true  },
            ],
            throwOnError: false,
          });
        } catch (e) { /* non-fatal */ }
      });
    }
  }

  function _escQ(str) {
    if (str == null) return '';
    const processed = (window.Exam && window.Exam.preprocessLatex)
      ? window.Exam.preprocessLatex(str) : str;
    return String(processed)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _loadSchools() {
    const container = document.getElementById('schoolsList');
    if (!container) return;
    container.innerHTML = `<p style="font-size:var(--text-sm);color:var(--text-3);">Loading...</p>`;
    _cancel('schools');
    const unsub = Db().collection('schools').orderBy('name').onSnapshot(
      snap => {
        if (snap.empty) {
          container.innerHTML = `<p style="font-size:var(--text-sm);color:var(--text-3);">No schools added yet.</p>`;
          return;
        }
        container.innerHTML = snap.docs.map(doc => `
          <div style="display:flex;align-items:center;justify-content:space-between;
                      background:var(--bg-base);border:1px solid var(--border);
                      border-radius:8px;padding:.625rem 1rem;">
            <p style="font-size:var(--text-base);font-weight:500;color:var(--text-1);">${_esc(doc.data().name)}</p>
            <div style="display:flex;gap:.375rem;align-items:center;">
              <button class="teacher-rename-school btn bg-blue-600"
                      data-id="${_esc(doc.id)}" data-name="${_esc(doc.data().name)}"
                      style="font-size:var(--text-xs);padding:.3125rem .75rem;">Rename</button>
              <button class="teacher-delete-school" data-id="${_esc(doc.id)}" data-name="${_esc(doc.data().name)}"
                      style="background:none;border:none;cursor:pointer;font-size:1rem;
                             line-height:1;padding:2px 4px;color:var(--text-4);"
                      onmouseenter="this.style.color='var(--danger)'"
                      onmouseleave="this.style.color='var(--text-4)'">×</button>
            </div>
          </div>`).join('');
      },
      err => {
        console.error('[teacher] Error loading schools:', err);
        container.innerHTML = `<p style="color:var(--danger);font-size:var(--text-sm);">Error loading schools.</p>`;
      }
    );
    _reg('schools', unsub);
  }

  document.addEventListener('click', async e => {
    const renameBtn = e.target.closest('.teacher-rename-school');
    if (renameBtn) { await renameSchool(renameBtn.dataset.id, renameBtn.dataset.name); return; }
    const deleteBtn = e.target.closest('.teacher-delete-school');
    if (deleteBtn) { await deleteSchool(deleteBtn.dataset.id, deleteBtn.dataset.name); }
  });

  async function addSchool() {
  const input = document.getElementById('newSchoolName');
  const name  = input ? input.value.trim() : '';
  if (!name) { UI.toast('Please enter a school name.', 'warning'); return; }

  const btn = document.querySelector('#teacher-schools button[onclick="Teacher.addSchool()"]');
  UI.setLoading(btn, true);
  try {
    const snap = await Db().collection('schools').where('name', '==', name).get();
    if (!snap.empty) {
      UI.toast('This school name already exists.', 'warning');
      UI.setLoading(btn, false);
      return;
    }
    await Db().collection('schools').add({ name });
    if (input) input.value = '';
    UI.toast(`School "${name}" added.`, 'success');
  } catch (err) {
    console.error('[teacher] addSchool error:', err);
    UI.toast('Failed to add school.', 'error');
  } finally {
    UI.setLoading(btn, false);
  }
}

  async function renameSchool(id, currentName) {
    const newName = window.prompt('Enter new school name:', currentName);
    if (!newName || newName.trim() === currentName) return;
    const trimmed = newName.trim();
    try {
      const snap = await Db().collection('schools').where('name', '==', trimmed).get();
      if (!snap.empty) { UI.toast('This name already exists.', 'warning'); return; }
      const ok = await UI.confirmAction(
        `Rename "${currentName}" to "${trimmed}"?\nExisting students keep their current school name.`
      );
      if (!ok) return;
      await Db().collection('schools').doc(id).update({ name: trimmed });
      UI.toast('School renamed.', 'success');
    } catch (err) {
      console.error('[teacher] renameSchool error:', err);
      UI.toast('Failed to rename school.', 'error');
    }
  }

  async function deleteSchool(id, schoolName) {
    const ok = await UI.confirmAction(
      `Delete "${schoolName}" from the list?\n\nStudents already registered keep their school name.`
    );
    if (!ok) return;
    try {
      await Db().collection('schools').doc(id).delete();
      UI.toast('School deleted.', 'success');
    } catch (err) {
      console.error('[teacher] deleteSchool error:', err);
      UI.toast('Failed to delete school.', 'error');
    }
  }

  let _taskScope   = 'once';
  let _assignScope = 'all';

  function _setTaskScope(scope) {
  _taskScope = scope;

  const btnOnce   = document.getElementById('taskScopeAll');
  const btnWeekly = document.getElementById('taskScopeWeekly');
  const btnRange  = document.getElementById('taskScopeRange');

  [btnOnce, btnWeekly, btnRange].forEach(b => {
    if (!b) return;
    b.style.background = 'transparent';
    b.style.color      = 'var(--text-3)';
    b.style.boxShadow  = 'none';
  });

  const active = scope === 'weekly' ? btnWeekly : scope === 'range' ? btnRange : btnOnce;
  if (active) {
    active.style.background = 'var(--bg-base)';
    active.style.color      = 'var(--text-1)';
    active.style.boxShadow  = 'var(--shadow-xs)';
  }

  const hint = document.getElementById('taskRecurrenceHint');
  if (hint) {
    if (scope === 'weekly') {
      hint.style.display = '';
      hint.innerHTML = '<strong>Weekly</strong>: runs every week between Start Date and End Date. Pick which days of the week are active.';
    } else if (scope === 'range') {
      hint.style.display = '';
      hint.innerHTML = '<strong>Date Range</strong>: runs every selected weekday between Start Date and End Date.';
    } else {
      hint.style.display = 'none';
      hint.innerHTML = '';
    }
  }

  _renderDateConfigArea();
  _renderRecurringSubjectPicker();
  _clearTaskFormDates();
}

  function _renderDateConfigArea() {
    const area = document.getElementById('taskDateConfigArea');
    if (!area) return;

    if (_taskScope === 'once') {
      area.innerHTML = `
        <div style="margin-bottom:.875rem;">
          <label style="display:block;font-size:var(--text-xs);font-weight:600;
                        color:var(--text-2);margin-bottom:.375rem;">
            Task Dates &amp; Subjects
          </label>
          <p style="font-size:var(--text-xs);color:var(--text-3);margin-bottom:.5rem;line-height:1.5;">
            Add each specific date, then choose which subjects are required for that day.
            Leave all unchecked = no subject restriction.
          </p>
          <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem;">
            <input type="date" id="newTaskDate" style="flex:1;" />
            <button onclick="Teacher.addTaskDate()" class="btn"
                    style="white-space:nowrap;padding:.5rem .875rem;font-size:var(--text-sm);">+ Add</button>
          </div>
          <div id="tasksDates" class="space-y-1"></div>
        </div>`;

    } else {
      const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      const rangeLabel = _taskScope === 'range' ? 'Active weekdays' : 'Days of week';

      area.innerHTML = `
        <div style="margin-bottom:.875rem;">
          <label style="display:block;font-size:var(--text-xs);font-weight:600;
                        color:var(--text-2);margin-bottom:.375rem;">Start Date <span style="color:var(--danger);">*</span></label>
          <input type="date" id="taskStartDate" style="width:100%;" />
        </div>
        <div style="margin-bottom:.875rem;">
          <label style="display:block;font-size:var(--text-xs);font-weight:600;
                        color:var(--text-2);margin-bottom:.375rem;">
            End Date
            <span style="font-weight:400;color:var(--text-3);">— leave blank for open-ended</span>
          </label>
          <input type="date" id="taskEndDate" style="width:100%;" />
        </div>
        <div style="margin-bottom:.875rem;">
          <label style="display:block;font-size:var(--text-xs);font-weight:600;
                        color:var(--text-2);margin-bottom:.375rem;">${_esc(rangeLabel)}</label>
          <div style="display:flex;flex-wrap:wrap;gap:.375rem;">
            ${dayNames.map(day => `
              <label style="display:flex;align-items:center;gap:.375rem;font-size:var(--text-sm);
                            cursor:pointer;padding:.3125rem .625rem;border-radius:6px;
                            border:1px solid var(--border);background:var(--bg-base);">
                <input type="checkbox" class="task-day-cb" value="${day}"
                       style="width:.875rem;height:.875rem;accent-color:var(--accent);cursor:pointer;" />
                ${day.slice(0,3)}
              </label>`).join('')}
          </div>
          ${_taskScope === 'range'
            ? `<p style="font-size:var(--text-xs);color:var(--text-3);margin-top:.375rem;line-height:1.4;">
                 Leave all unchecked to run every calendar day in the range.
               </p>`
            : ''}
        </div>`;
    }

    const rswWrap = document.getElementById('taskRecurringSubjectsWrap');
    if (rswWrap) rswWrap.style.display = _taskScope !== 'once' ? '' : 'none';
  }

  function _renderRecurringSubjectPicker() {
    const wrap = document.getElementById('taskRecurringSubjectsList');
    if (!wrap) return;
    if (_taskScope === 'once') { wrap.innerHTML = ''; return; }

    const subjects = _getSubjectsForCurrentScope();
    if (subjects.length === 0) {
      wrap.innerHTML = `<p style="font-size:var(--text-sm);color:var(--text-3);font-style:italic;">
        Select a target first to see available subjects.</p>`;
      return;
    }

    const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    wrap.innerHTML = dayNames.map(day => `
      <details style="border:1px solid var(--border);border-radius:8px;
                      overflow:hidden;margin-bottom:.375rem;">
        <summary style="padding:.4375rem .75rem;font-size:var(--text-sm);font-weight:600;cursor:pointer;
                        background:var(--bg-subtle);display:flex;align-items:center;
                        justify-content:space-between;list-style:none;user-select:none;">
          <span>${day}</span>
          <span class="recurring-day-count-${day}" style="font-size:var(--text-xs);color:var(--text-3);">
            (all subjects)
          </span>
        </summary>
        <div style="padding:.5rem .75rem;">
          <div style="display:flex;gap:.5rem;margin-bottom:.375rem;">
            <button onclick="Teacher._selectAllDaySubjects('${day}')"
                    style="font-size:var(--text-xs);font-weight:600;color:var(--accent);
                           background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">All</button>
            <span style="color:var(--border-strong);">·</span>
            <button onclick="Teacher._clearDaySubjects('${day}')"
                    style="font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                           background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">None</button>
          </div>
          ${subjects.map(subj => `
            <label style="display:flex;align-items:center;gap:.5rem;padding:.25rem 0;
                          font-size:var(--text-sm);cursor:pointer;">
              <input type="checkbox" class="recurring-day-subj-cb" data-day="${day}" value="${_esc(subj)}"
                     onchange="Teacher._updateDaySubjCount('${day}')"
                     style="width:.875rem;height:.875rem;accent-color:var(--accent);cursor:pointer;" />
              ${_esc(subj)}
            </label>`).join('')}
        </div>
      </details>`).join('');
  }

  function _selectAllDaySubjects(day) {
    document.querySelectorAll(`.recurring-day-subj-cb[data-day="${day}"]`)
      .forEach(cb => { cb.checked = true; });
    _updateDaySubjCount(day);
  }

  function _clearDaySubjects(day) {
    document.querySelectorAll(`.recurring-day-subj-cb[data-day="${day}"]`)
      .forEach(cb => { cb.checked = false; });
    _updateDaySubjCount(day);
  }

  function _updateDaySubjCount(day) {
    const count = document.querySelectorAll(`.recurring-day-subj-cb[data-day="${day}"]:checked`).length;
    const label = document.querySelector(`.recurring-day-count-${day}`);
    if (!label) return;
    label.textContent = count === 0 ? '(all subjects)' : `(${count} restricted)`;
    label.style.color = count === 0 ? 'var(--text-3)' : 'var(--accent)';
  }

  function _setAssignScope(scope) {
  _assignScope = scope;

  const btnAll     = document.getElementById('taskAssignAll');
  const btnClass   = document.getElementById('taskAssignClass');
  const btnStudent = document.getElementById('taskAssignStudent');
  const classWrap  = document.getElementById('taskTargetClassWrap');
  const studWrap   = document.getElementById('taskTargetStudentWrap');

  [btnAll, btnClass, btnStudent].forEach(b => {
    if (!b) return;
    b.style.background = 'transparent';
    b.style.color      = 'var(--text-3)';
    b.style.boxShadow  = 'none';
  });

  const active = scope === 'class' ? btnClass : scope === 'student' ? btnStudent : btnAll;
  if (active) {
    active.style.background = 'var(--bg-base)';
    active.style.color      = 'var(--text-1)';
    active.style.boxShadow  = 'var(--shadow-xs)';
  }

  if (classWrap) classWrap.style.display = scope === 'class'   ? '' : 'none';
  if (studWrap)  studWrap.style.display  = scope === 'student' ? '' : 'none';

  _renderRecurringSubjectPicker();
  _onTaskTargetChange();
}

  function _clearTaskFormDates() {
    const datesEl = document.getElementById('tasksDates');
    if (datesEl) datesEl.innerHTML = '';
  }

  function _clearTaskForm() {
    const activeEl    = document.getElementById('tasksActive');
    const titleEl     = document.getElementById('tasksTitle');
    const messageEl   = document.getElementById('tasksMessage');
    const startEl     = document.getElementById('taskStartDate');
    const endEl       = document.getElementById('taskEndDate');
    const durationEl  = document.getElementById('taskDurationMs');
    if (activeEl)   activeEl.checked  = false;
    if (titleEl)    titleEl.value     = '';
    if (messageEl)  messageEl.value   = '';
    if (startEl)    startEl.value     = '';
    if (endEl)      endEl.value       = '';
    if (durationEl) durationEl.value  = '';
    document.querySelectorAll('.task-day-cb').forEach(cb => { cb.checked = false; });
    document.querySelectorAll('.recurring-day-subj-cb').forEach(cb => { cb.checked = false; });
    _clearTaskFormDates();
  }

  function _currentTaskDocId() {
    const prefix = _taskScope !== 'once' ? 'weekly' : '';

    if (_assignScope === 'all') return prefix || 'global';

    if (_assignScope === 'class') {
      const sel = document.getElementById('taskTargetClass');
      const cls = sel ? sel.value.trim() : '';
      if (!cls) return null;
      const key = 'class_' + cls.replace(/\s+/g,'').toLowerCase();
      return prefix ? prefix + '_' + key : key;
    }

    if (_assignScope === 'student') {
      const sel = document.getElementById('taskTargetStudent');
      const uid = sel ? sel.value.trim() : '';
      if (!uid) return null;
      const key = 'student_' + uid;
      return prefix ? prefix + '_' + key : key;
    }

    return null;
  }

  function _onTaskTargetChange() {
    if (_taskScope !== 'once') {
      _renderRecurringSubjectPicker();
      return;
    }

    const datesEl = document.getElementById('tasksDates');
    if (!datesEl) return;
    const data = Array.from(datesEl.querySelectorAll('.task-date-row'))
      .map(r => r.dataset.date);
    datesEl.innerHTML = '';
    data.forEach(date => _appendDateItem(date, []));
  }

  function _getSubjectsForCurrentScope() {
    const qBank = window.questions || {};

    if (_assignScope === 'all') {
      const all = new Set();
      Object.values(qBank).forEach(cls => Object.keys(cls).forEach(s => all.add(s)));
      return [...all].sort();
    }

    if (_assignScope === 'class') {
      const sel = document.getElementById('taskTargetClass');
      const cls = sel ? sel.value.trim() : '';
      if (!cls) return [];
      return Object.keys(qBank[cls.replace(/\s+/g,'').toLowerCase()] || {}).sort();
    }

    if (_assignScope === 'student') {
      const sel = document.getElementById('taskTargetStudent');
      const uid = sel ? sel.value.trim() : '';
      if (!uid) return [];
      const student = _msgStudentCache.find(s => s.id === uid);
      if (!student || !student.cls) return [];
      return Object.keys(qBank[student.cls.replace(/\s+/g,'').toLowerCase()] || {}).sort();
    }

    return [];
  }

  function addTaskDate() {
    const container = document.getElementById('tasksDates');
    if (!container) return;
    const dateInput = document.getElementById('newTaskDate');
    const val = dateInput ? dateInput.value.trim() : '';
    if (!val) { UI.toast('Please select a date first.', 'warning'); return; }
    const existing = Array.from(container.querySelectorAll('.task-date-row')).map(r => r.dataset.date);
    if (existing.includes(val)) { UI.toast('This date is already in the list.', 'warning'); return; }
    _appendDateItem(val, []);
    if (dateInput) dateInput.value = '';
  }

  function _appendDateItem(dateStr, preselected) {
    const container = document.getElementById('tasksDates');
    if (!container) return;
    preselected = preselected || [];

    const subjects = _getSubjectsForCurrentScope();
    const parts    = dateStr.split('-');
    const label    = new Date(+parts[0], +parts[1] - 1, +parts[2])
      .toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });

    const subjectCheckboxesHtml = subjects.length > 0
      ? subjects.map(subj => `
          <label style="display:flex;align-items:center;gap:.5rem;padding:.3125rem .625rem;cursor:pointer;
                        border-bottom:1px solid var(--border);"
                 onmouseenter="this.style.background='var(--accent-subtle)'"
                 onmouseleave="this.style.background=''">
            <input type="checkbox" class="date-subj-cb" value="${_esc(subj)}"
                   ${preselected.includes(subj) ? 'checked' : ''}
                   style="width:.875rem;height:.875rem;accent-color:var(--accent);cursor:pointer;" />
            <span style="font-size:var(--text-sm);color:var(--text-1);">${_esc(subj)}</span>
          </label>`).join('')
      : `<p style="font-size:var(--text-sm);color:var(--text-3);padding:.5rem .75rem;font-style:italic;">
           No subjects available.</p>`;

    const div = document.createElement('div');
    div.className    = 'task-date-row';
    div.dataset.date = dateStr;
    div.style.cssText = `border:1.5px solid var(--accent-border);border-radius:8px;
      overflow:hidden;margin-bottom:.5rem;background:var(--bg-base);`;

    div.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:.5rem .75rem;background:var(--accent-subtle);cursor:pointer;"
           onclick="this.nextElementSibling.style.display =
                    this.nextElementSibling.style.display === 'none' ? '' : 'none'">
        <div style="display:flex;align-items:center;gap:.5rem;">
          <span style="font-size:var(--text-sm);font-weight:700;color:var(--accent-text);">${_esc(label)}</span>
          <span class="date-subj-count" style="font-size:var(--text-xs);font-weight:600;color:var(--text-3);">
            (all subjects)</span>
        </div>
        <div style="display:flex;align-items:center;gap:.375rem;">
          <span style="font-size:var(--text-xs);color:var(--accent);">▾ subjects</span>
          <button onclick="event.stopPropagation();this.closest('.task-date-row').remove()"
                  style="background:none;border:none;cursor:pointer;font-size:1rem;
                         line-height:1;padding:2px 4px;color:var(--danger);">×</button>
        </div>
      </div>
      <div style="border-top:1px solid var(--border);">
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:.375rem .75rem;background:var(--bg-subtle);
                    border-bottom:1px solid var(--border);">
          <span style="font-size:var(--text-xs);font-weight:600;color:var(--text-3);">
            Subjects <span style="font-weight:400;">(leave all unchecked = no restriction)</span>
          </span>
          <div style="display:flex;gap:.375rem;">
            <button onclick="Teacher._selectAllDateSubjects(this)"
                    style="font-size:var(--text-xs);font-weight:600;color:var(--accent);
                           background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">All</button>
            <span style="color:var(--border-strong);">·</span>
            <button onclick="Teacher._clearDateSubjects(this)"
                    style="font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                           background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">None</button>
          </div>
        </div>
        <div class="date-subj-list" style="max-height:130px;overflow-y:auto;">
          ${subjectCheckboxesHtml}
        </div>
      </div>`;

    container.appendChild(div);
    div.querySelectorAll('.date-subj-cb').forEach(cb => {
      cb.addEventListener('change', () => _updateDateSubjCount(div));
    });
    _updateDateSubjCount(div);
  }

  function _updateDateSubjCount(rowEl) {
    const checked = rowEl.querySelectorAll('.date-subj-cb:checked').length;
    const label   = rowEl.querySelector('.date-subj-count');
    if (!label) return;
    label.textContent = checked === 0 ? '(all subjects)' : `(${checked} subject${checked !== 1 ? 's' : ''} required)`;
    label.style.color = checked === 0 ? 'var(--text-3)' : 'var(--accent)';
  }

  function _selectAllDateSubjects(btn) {
    const row = btn.closest('.task-date-row');
    if (!row) return;
    row.querySelectorAll('.date-subj-cb').forEach(cb => { cb.checked = true; });
    _updateDateSubjCount(row);
  }

  function _clearDateSubjects(btn) {
    const row = btn.closest('.task-date-row');
    if (!row) return;
    row.querySelectorAll('.date-subj-cb').forEach(cb => { cb.checked = false; });
    _updateDateSubjCount(row);
  }

  async function saveTasksConfig() {
    const docId = _currentTaskDocId();
    if (!docId) {
      if (_assignScope === 'class')   { UI.toast('Please select a class.',   'warning'); return; }
      if (_assignScope === 'student') { UI.toast('Please select a student.', 'warning'); return; }
      UI.toast('No valid target selected.', 'warning');
      return;
    }

    const active  = !!document.getElementById('tasksActive')?.checked;
    const title   = document.getElementById('tasksTitle')?.value.trim()   || '';
    const message = document.getElementById('tasksMessage')?.value.trim() || '';

    const durationRaw = document.getElementById('taskDurationMs')?.value;
    const durationMs  = durationRaw ? parseInt(durationRaw, 10) : null;

    if (!title) { UI.toast('Please enter a task title.', 'warning'); return; }

    let payload;

    if (_taskScope === 'once') {
      const dateRows = Array.from(document.querySelectorAll('.task-date-row'));
      if (dateRows.length === 0) { UI.toast('Please add at least one date.', 'warning'); return; }

      const dates        = dateRows.map(r => r.dataset.date).filter(Boolean);
      const dateSubjects = {};
      dateRows.forEach(row => {
        dateSubjects[row.dataset.date] =
          [...row.querySelectorAll('.date-subj-cb:checked')].map(cb => cb.value);
      });

      payload = {
        recurrence:  'once',
        active, title,
        message:     message || 'Complete the required exams on the scheduled dates.',
        dates,
        dateSubjects,
        durationMs:  durationMs || null,
        assignScope: _assignScope,
        updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
      };

      if (_assignScope === 'class') {
        const sel = document.getElementById('taskTargetClass');
        if (sel) payload.className = sel.value;
      }
      if (_assignScope === 'student') {
        const sel = document.getElementById('taskTargetStudent');
        const opt = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
        if (sel)  payload.studentUid  = sel.value;
        if (opt)  payload.studentName = opt.text;
      }

    } else {
      const startDate = document.getElementById('taskStartDate')?.value.trim() || '';
      const endDate   = document.getElementById('taskEndDate')?.value.trim()   || null;

      if (!startDate) { UI.toast('Please set a start date.', 'warning'); return; }
      if (endDate && endDate < startDate) {
        UI.toast('End date must be after start date.', 'warning'); return;
      }

      const checkedDays = [...document.querySelectorAll('.task-day-cb:checked')].map(cb => cb.value);
      if (_taskScope === 'weekly' && checkedDays.length === 0) {
        UI.toast('Please select at least one day of the week.', 'warning'); return;
      }

      const dateSubjects = {};
      const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      dayNames.forEach(day => {
        const selected = [...document.querySelectorAll(`.recurring-day-subj-cb[data-day="${day}"]:checked`)]
          .map(cb => cb.value);
        if (selected.length > 0) dateSubjects[day] = selected;
      });

      payload = {
        recurrence:  _taskScope,
        active, title,
        message:     message || 'Complete the required exams on the scheduled dates.',
        startDate,
        endDate:     endDate || null,
        weeklyDays:  checkedDays,
        dateSubjects,
        durationMs:  durationMs || null,
        assignScope: _assignScope,
        updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
      };

      if (_assignScope === 'class') {
        const sel = document.getElementById('taskTargetClass');
        if (sel) payload.className = sel.value;
      }
      if (_assignScope === 'student') {
        const sel = document.getElementById('taskTargetStudent');
        const opt = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
        if (sel)  payload.studentUid  = sel.value;
        if (opt)  payload.studentName = opt.text;
      }
    }

    const btn = document.getElementById('saveTasksBtn');
    UI.setLoading(btn, true);
    try {
      await Db().collection('coachingTasks').doc(docId).set(payload);
      UI.toast('Task saved.', 'success');
      _clearTaskForm();
    } catch (err) {
      console.error('[teacher] saveTasksConfig error:', err);
      UI.toast('Failed to save task' + (err?.code ? ' (' + err.code + ')' : '') + '.', 'error');
    } finally {
      UI.setLoading(btn, false);
    }
  }
  
  function _startGlobalStudentCache() {
  _cancel('msgStudents');
  _msgStudentCache = [];
  const unsub = Db().collection('students').orderBy('name').onSnapshot(snap => {
    _msgStudentCache = [];
    snap.forEach(doc => {
      const s = doc.data();
      _msgStudentCache.push({
        id:                doc.id,
        name:              s.name           || '',
        cls:               s.class          || '',
        timetableGroup:    s.timetableGroup || '',
        coachingCompleted: s.coachingCompleted || {},
      });
    });
    _populateMsgSingleSelect();
    _populateMsgCheckboxList();
    _populateTaskStudentSelect();

    // If group member list is visible, refresh it to reflect latest state
    if (_ttSelectedScope === 'group' && (_ttSelectedGroupName || '').trim()) {
      _ttRenderGroupMembers();
    }

    const existingTasksList = document.getElementById('existingTasksList');
    if (existingTasksList) {
      Db().collection('coachingTasks').get().then(snap => {
        _renderExistingTasksList(snap.docs);
      }).catch(() => {});
    }
  });
  _reg('msgStudents', unsub);
}

  function _loadTasksManager() {
  _cancel('tasksManager');
  _taskScope   = 'once';
  _assignScope = 'all';

  _cancel('taskClassList');
  const unsubClasses = Db().collection('students').onSnapshot(snap => {
    const classes = new Set();
    snap.forEach(doc => { const c = doc.data().class; if (c) classes.add(c); });
    const sel = document.getElementById('taskTargetClass');
    if (sel) {
      let html = '<option value="">Select a class...</option>';
      [...classes].sort().forEach(c => { html += `<option value="${_esc(c)}">${_esc(c)}</option>`; });
      sel.innerHTML = html;
    }
  });
  _reg('taskClassList', unsubClasses);

  _cancel('tasksList');
  const unsubTasks = Db().collection('coachingTasks').onSnapshot(snap => {
    _renderExistingTasksList(snap.docs);
  });
  _reg('tasksList', unsubTasks);

  // Re-populate form dropdowns from the already-live global cache
  _populateMsgSingleSelect();
  _populateMsgCheckboxList();
  _populateTaskStudentSelect();

  _setTaskScope('once');
}

  function _populateTaskStudentSelect() {
    const sel = document.getElementById('taskTargetStudent');
    if (!sel) return;
    let html = '<option value="">Select a student...</option>';
    _msgStudentCache.forEach(s => {
      html += `<option value="${_esc(s.id)}">${_esc(s.name)} (${_esc(s.cls)})</option>`;
    });
    sel.innerHTML = html;
  }

function _renderExistingTasksList(docs) {
    let container = document.getElementById('existingTasksList');
    if (!container) {
      const panel = document.getElementById('teacher-tasks');
      if (!panel) return;
      const inner = panel.querySelector('[style*="padding:1.25rem 1.5rem"]') || panel;
      container = document.createElement('div');
      container.id = 'existingTasksList';
      container.style.cssText = 'margin-top:1rem;';
      inner.appendChild(container);
    }

    const tasks = docs.filter(d => d.id !== 'current');
    if (tasks.length === 0) { container.innerHTML = ''; _renderStudentProgress([]); return; }

    function scopeLabel(docId) {
      if (docId === 'global')
        return { label:'All Students', color:'var(--accent-text)', bg:'var(--accent-subtle)', border:'var(--accent-border)' };
      if (docId === 'weekly')
        return { label:'🔄 Recurring · All', color:'var(--accent-text)', bg:'var(--accent-subtle)', border:'var(--accent-border)' };
      if (docId.startsWith('weekly_class_'))
        return { label:'🔄 Recurring · Class: ' + docId.replace('weekly_class_','').toUpperCase(), color:'var(--accent-text)', bg:'var(--accent-subtle)', border:'var(--accent-border)' };
      if (docId.startsWith('weekly_student_'))
        return { label:'🔄 Recurring · Student', color:'var(--accent-text)', bg:'var(--accent-subtle)', border:'var(--accent-border)' };
      if (docId.startsWith('class_'))
        return { label:'Class: ' + docId.replace('class_','').toUpperCase(), color:'var(--warning-text)', bg:'var(--warning-subtle)', border:'var(--warning-border)' };
      if (docId.startsWith('student_'))
        return { label:'Student', color:'var(--success-text)', bg:'var(--success-subtle)', border:'var(--success-border)' };
      return { label:docId, color:'var(--text-3)', bg:'var(--bg-subtle)', border:'var(--border)' };
    }

    function resolveStudentName(docId) {
      const prefix = docId.startsWith('weekly_student_') ? 'weekly_student_'
                   : docId.startsWith('student_')        ? 'student_'
                   : null;
      if (!prefix) return null;
      const uid   = docId.replace(prefix,'');
      const found = _msgStudentCache.find(s => s.id === uid);
      return found ? found.name + ' (' + found.cls + ')' : uid;
    }

    function isRecurringTask(doc) {
      const d = doc.data();
      return d.recurrence === 'weekly' ||
             d.recurrence === 'range'  ||
             doc.id === 'weekly'       ||
             doc.id.startsWith('weekly_');
    }

    container.innerHTML =
      '<div style="border-top:1px solid var(--border);padding-top:1rem;margin-top:.25rem;">' +
      '<h3 style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);margin-bottom:.625rem;">Existing Tasks</h3>' +
      '<div style="display:flex;flex-direction:column;gap:.375rem;">' +
      tasks.map(doc => {
        const d           = doc.data();
        const scope       = scopeLabel(doc.id);
        const studentName = resolveStudentName(doc.id);
        const scopeDisp   = studentName
          ? (doc.id.startsWith('weekly_') ? '🔄 Recurring · Student: ' : 'Student: ') + studentName
          : scope.label;

        const recurring = isRecurringTask(doc);

        let datesDisplay;
        if (recurring) {
          const dayList = (d.weeklyDays && d.weeklyDays.length > 0)
          ? d.weeklyDays.join(', ')
          : (d.recurrence === 'range' ? 'All days in range' : '—');
          const start   = d.startDate || '?';
          const end     = d.endDate   || 'open-ended';
          datesDisplay  = `${d.recurrence || 'recurring'} · ${dayList} · ${start} → ${end}`;
        } else {
          datesDisplay = (d.dates || []).join(', ') || '—';
        }

        return '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;' +
          'background:var(--bg-base);border:1px solid var(--border);border-radius:8px;padding:.5rem .875rem;">' +
          '<div style="min-width:0;flex:1;">' +
          '<div style="display:flex;align-items:center;gap:.375rem;flex-wrap:wrap;margin-bottom:2px;">' +
          `<span style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);">${_esc(d.title || '—')}</span>` +
          `<span style="font-size:var(--text-xs);font-weight:600;padding:1px 7px;border-radius:99px;` +
          `background:${scope.bg};color:${scope.color};border:1px solid ${scope.border};">${_esc(scopeDisp)}</span>` +
          `<span style="font-size:var(--text-xs);font-weight:600;padding:1px 7px;border-radius:99px;` +
          (d.active
            ? 'background:var(--success-subtle);color:var(--success-text);border:1px solid var(--success-border);'
            : 'background:var(--bg-subtle);color:var(--text-4);border:1px solid var(--border);') +
          '">' + (d.active ? 'Active' : 'Inactive') + '</span>' +
          '</div>' +
          `<p style="font-size:var(--text-xs);color:var(--text-4);word-break:break-all;">${_esc(datesDisplay)}</p>` +
          '</div>' +
          '<div style="display:flex;gap:.375rem;align-items:center;flex-shrink:0;margin-top:1px;">' +
          `<button onclick="Teacher.exportTaskReportPDF('${_esc(doc.id)}')"` +
          ` style="background:var(--accent);color:var(--text-inverse);border:none;cursor:pointer;` +
          `font-size:var(--text-xs);font-weight:700;padding:3px 9px;border-radius:4px;` +
          `white-space:nowrap;font-family:inherit;line-height:1.5;` +
          `transition:background .12s;" ` +
          `onmouseenter="this.style.background='var(--accent-hover)'" onmouseleave="this.style.background='var(--accent)'"` +
          `title="Export attendance & progress report as PDF">📄 PDF</button>` +
          `<button class="teacher-delete-task" data-task-id="${_esc(doc.id)}"` +
          ` style="background:none;border:none;cursor:pointer;font-size:1rem;line-height:1;` +
          `padding:2px 4px;color:var(--text-4);"` +
          ` onmouseenter="this.style.color='var(--danger)'"` +
          ` onmouseleave="this.style.color='var(--text-4)'">&times;</button>` +
          '</div>' +
          '</div>';
      }).join('') +
      '</div></div>';

    _renderStudentProgress(tasks);
  }

  function _renderStudentProgress(taskDocs) {
    let container = document.getElementById('taskProgressPanel');
    if (!container) {
      const parent = document.getElementById('existingTasksList');
      if (!parent) return;
      container = document.createElement('div');
      container.id = 'taskProgressPanel';
      container.style.cssText = 'margin-top:1.25rem;';
      parent.parentNode.insertBefore(container, parent.nextSibling);
    }

    if (_msgStudentCache.length === 0) { container.innerHTML = ''; return; }

    const activeTasks = taskDocs.filter(doc => doc.data().active);

    if (activeTasks.length === 0) { container.innerHTML = ''; return; }

    function _localDate(d) {
      const dt = d || new Date();
      return dt.getFullYear() + '-' +
        String(dt.getMonth() + 1).padStart(2, '0') + '-' +
        String(dt.getDate()).padStart(2, '0');
    }

    const todayStr = (window.Tasks && Tasks._localDateStr) ? Tasks._localDateStr() : _localDate();

    function getTaskDates(doc) {
      const d = doc.data();
      return (window.Tasks && Tasks._resolveTaskDates)
        ? Tasks._resolveTaskDates(d, { upToDate: todayStr })
        : [];
    }

    function getStudentsForTask(doc) {
      const id = doc.id;
      if (id === 'global' || id === 'weekly') return _msgStudentCache;
      if (id.startsWith('weekly_class_')) {
        const cls = id.replace('weekly_class_', '');
        return _msgStudentCache.filter(s => s.cls.replace(/\s+/g, '').toLowerCase() === cls);
      }
      if (id.startsWith('weekly_student_')) {
        const uid = id.replace('weekly_student_', '');
        return _msgStudentCache.filter(s => s.id === uid);
      }
      if (id.startsWith('class_')) {
        const cls = id.replace('class_', '');
        return _msgStudentCache.filter(s => s.cls.replace(/\s+/g, '').toLowerCase() === cls);
      }
      if (id.startsWith('student_')) {
        const uid = id.replace('student_', '');
        return _msgStudentCache.filter(s => s.id === uid);
      }
      return [];
    }

    function groupByWeek(dates) {
      const weeks = {};
      dates.forEach(dateStr => {
        const parts  = dateStr.split('-');
        const date   = new Date(+parts[0], +parts[1] - 1, +parts[2]);
        const dow    = date.getDay();
        const diff   = dow === 0 ? -6 : 1 - dow;
        const monday = new Date(date);
        monday.setDate(date.getDate() + diff);
        const weekKey = _localDate(monday);
        if (!weeks[weekKey]) weeks[weekKey] = [];
        weeks[weekKey].push(dateStr);
      });
      return Object.keys(weeks).sort().reverse().map(weekKey => ({
        weekKey,
        dates: weeks[weekKey].sort(),
      }));
    }

    function weekLabel(weekKey) {
      const parts  = weekKey.split('-');
      const monday = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const opts = { day: 'numeric', month: 'short' };
      return monday.toLocaleDateString('en-GB', opts) + ' – ' + sunday.toLocaleDateString('en-GB', opts);
    }

    function isRecurringDoc(doc) {
      const d = doc.data();
      return d.recurrence === 'weekly' || d.recurrence === 'range' ||
             doc.id === 'weekly' || doc.id.startsWith('weekly_');
    }

    container.innerHTML = activeTasks.map(doc => {
      const d        = doc.data();
      const title    = d.title || doc.id;
      const allDates = getTaskDates(doc);
      const students = getStudentsForTask(doc);

      if (allDates.length === 0 || students.length === 0) return '';

      const recurring = isRecurringDoc(doc);
      const weeks     = groupByWeek(allDates);
      if (weeks.length === 0) return '';

      const weeksHTML = weeks.map((weekObj, wIdx) => {
        const { weekKey, dates: weekDates } = weekObj;

        const pastWeekDates = weekDates.filter(dt => dt <= todayStr);
        const allStudentsDone = pastWeekDates.length > 0 && students.every(student => {
          const comp = student.coachingCompleted || {};
          return pastWeekDates.every(dt => !!comp[dt]);
        });

        const studentRows = students.map(student => {
          const completed   = student.coachingCompleted || {};
          const doneDates   = weekDates.filter(dt => !!completed[dt]);
          const missedDates = weekDates.filter(dt => dt < todayStr && !completed[dt]);
          const doneCount   = doneDates.length;
          const missedCount = missedDates.length;
          const totalPast   = weekDates.filter(dt => dt <= todayStr).length;

          const statusColor = missedCount > 0
            ? 'var(--danger)'
            : doneCount === totalPast && totalPast > 0
              ? 'var(--success)'
              : 'var(--text-3)';

          const dayDots = weekDates.map(dt => {
            const isDone   = !!completed[dt];
            const isPast   = dt < todayStr;
            const isToday  = dt === todayStr;
            const isMissed = isPast && !isDone;
            const icon     = isDone ? '✓' : isMissed ? '✗' : isToday ? '○' : '–';
            const color    = isDone    ? 'var(--success)'
                           : isMissed  ? 'var(--danger)'
                           : isToday   ? 'var(--warning)'
                           : 'var(--border-strong)';
            const parts2   = dt.split('-');
            const dayLabel = new Date(+parts2[0], +parts2[1] - 1, +parts2[2])
              .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            return `<div style="text-align:center;min-width:60px;">` +
              `<div style="font-size:var(--text-xs);color:var(--text-4);">${_esc(dayLabel)}</div>` +
              `<div style="font-size:1rem;font-weight:700;color:${color};">${icon}</div>` +
              `</div>`;
          }).join('');

          return `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:.375rem .75rem;white-space:nowrap;border-right:1px solid var(--border);">
              <div style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);">${_esc(student.name)}</div>
              <div style="font-size:var(--text-xs);color:var(--text-3);">${_esc(student.cls)}</div>
            </td>
            <td style="padding:.375rem .75rem;text-align:center;border-right:1px solid var(--border);">
              <span style="font-size:var(--text-sm);font-weight:700;color:${statusColor};">${doneCount}/${totalPast}</span>
              ${missedCount > 0
                ? `<div style="font-size:var(--text-xs);color:var(--danger);">${missedCount} missed</div>` : ''}
            </td>
            <td style="padding:.375rem .75rem;">
              <div style="display:flex;gap:.625rem;flex-wrap:wrap;">${dayDots}</div>
            </td>
          </tr>`;
        }).join('');

        const wLabel = weekLabel(weekKey);

        return `<details class="progress-week-row" ${wIdx === 0 ? 'open' : ''} style="margin-bottom:.375rem;">
          <summary style="padding:.5rem .875rem;border-radius:8px;
                          background:${allStudentsDone ? 'var(--success-subtle)' : 'var(--bg-subtle)'};
                          border:1px solid ${allStudentsDone ? 'var(--success-border)' : 'var(--border)'};
                          display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:.5rem;">
              <span style="font-size:var(--text-xs);color:var(--text-3);">▶</span>
              <span style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);">${_esc(wLabel)}</span>
              <span style="font-size:var(--text-xs);font-weight:600;padding:1px 6px;border-radius:4px;
                           background:var(--bg-muted);color:var(--text-3);">
                ${weekDates.length} session${weekDates.length !== 1 ? 's' : ''}
              </span>
            </div>
            ${allStudentsDone
              ? `<span style="font-size:var(--text-xs);font-weight:700;color:var(--success-text);">All done ✓</span>`
              : ''}
          </summary>
          <div style="overflow-x:auto;border:1px solid var(--border);
                      border-radius:0 0 8px 8px;border-top:none;margin-top:-1px;">
            <table style="width:100%;border-collapse:collapse;min-width:360px;">
              <thead>
                <tr style="border-bottom:1.5px solid var(--border);background:var(--bg-subtle);">
                  <th style="text-align:left;padding:.375rem .75rem;border-right:1px solid var(--border);
                             font-size:var(--text-xs);font-weight:700;color:var(--text-2);">Student</th>
                  <th style="text-align:center;padding:.375rem .75rem;border-right:1px solid var(--border);
                             font-size:var(--text-xs);font-weight:700;color:var(--text-2);">Done</th>
                  <th style="text-align:left;padding:.375rem .75rem;
                             font-size:var(--text-xs);font-weight:700;color:var(--text-2);">Days</th>
                </tr>
              </thead>
              <tbody>${studentRows}</tbody>
            </table>
          </div>
        </details>`;
      }).join('');

      const totalSessions = allDates.length;
      const totalDone     = students.reduce((sum, s) =>
        sum + allDates.filter(dt => !!((s.coachingCompleted || {})[dt])).length, 0);
      const possibleTotal = students.length * totalSessions;

      const recurrenceLabel = d.recurrence
        ? d.recurrence.charAt(0).toUpperCase() + d.recurrence.slice(1)
        : 'Recurring';

      return `<div style="margin-bottom:1.5rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.625rem;">
          <div>
            <h4 style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);">
              📊 ${_esc(title)}
              ${recurring
                ? `<span style="font-size:var(--text-xs);font-weight:600;padding:1px 7px;border-radius:99px;
                               background:var(--accent-subtle);color:var(--accent-text);border:1px solid var(--accent-border);margin-left:.375rem;">
                     🔄 ${_esc(recurrenceLabel)}
                   </span>`
                : ''}
            </h4>
            <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:1px;">
              ${students.length} student${students.length !== 1 ? 's' : ''} ·
              ${totalSessions} session${totalSessions !== 1 ? 's' : ''} to date ·
              ${totalDone}/${possibleTotal} completions all-time
            </p>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:.25rem;">
          ${weeksHTML || '<p style="font-size:var(--text-sm);color:var(--text-3);">No sessions yet.</p>'}
        </div>
      </div>`;
    }).filter(Boolean).join('');
  }

  async function deleteTask(docId) {
    if (!docId) return;
    const ok = await UI.confirmAction('Delete this task? Students will stop seeing it immediately.');
    if (!ok) return;
    try {
      await Db().collection('coachingTasks').doc(docId).delete();
      UI.toast('Task deleted.', 'success');
    } catch (err) {
      console.error('[teacher] deleteTask error:', err);
      UI.toast('Failed to delete task.', 'error');
    }
  }

  async function deleteAllTasks() {
    const ok = await UI.confirmAction('Delete ALL tasks?');
    if (!ok) return;
    try {
      const snap = await Db().collection('coachingTasks').get();
      if (!snap.empty) {
        const batch = Db().batch();
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      UI.toast('All tasks deleted.', 'success');
      _clearTaskForm();
    } catch (err) {
      console.error('[teacher] deleteAllTasks error:', err);
      UI.toast('Failed to delete tasks.', 'error');
    }
  }

  let _msgStudentCache = [];
  let _msgMode = 'single';

  function _setMsgMode(mode) {
  _msgMode = mode;

  const singleWrap = document.getElementById('msgSingleWrap');
  const multiWrap  = document.getElementById('msgMultiWrap');
  const singleBtn  = document.getElementById('msgModeSingle');
  const multiBtn   = document.getElementById('msgModeMulti');

  if (!singleWrap || !multiWrap) return;

  if (mode === 'single') {
    singleWrap.style.display = '';
    multiWrap.style.display  = 'none';
    if (singleBtn) {
      singleBtn.style.background = 'var(--bg-base)';
      singleBtn.style.color      = 'var(--text-1)';
      singleBtn.style.boxShadow  = 'var(--shadow-xs)';
    }
    if (multiBtn) {
      multiBtn.style.background = 'transparent';
      multiBtn.style.color      = 'var(--text-3)';
    }
  } else {
    singleWrap.style.display = 'none';
    multiWrap.style.display  = '';
    if (multiBtn) {
      multiBtn.style.background = 'var(--bg-base)';
      multiBtn.style.color      = 'var(--text-1)';
      multiBtn.style.boxShadow  = 'var(--shadow-xs)';
    }
    if (singleBtn) {
      singleBtn.style.background = 'transparent';
      singleBtn.style.color      = 'var(--text-3)';
    }
    _populateMsgCheckboxList();
  }
}

  function _populateMsgSingleSelect() {
    const sel = document.getElementById('msgStudent');
    if (!sel) return;
    let html = '<option value="">Select a student...</option>';
    _msgStudentCache.forEach(s => {
      html += `<option value="${_esc(s.id)}">${_esc(s.name)} (${_esc(s.cls)})</option>`;
    });
    sel.innerHTML = html;
  }

  function _populateMsgCheckboxList(filter) {
    const container = document.getElementById('msgStudentList');
    if (!container) return;
    const q = (filter || document.getElementById('msgStudentSearch')?.value || '').toLowerCase();
    const filtered = q
      ? _msgStudentCache.filter(s => s.name.toLowerCase().includes(q) || s.cls.toLowerCase().includes(q))
      : _msgStudentCache;
    if (filtered.length === 0) {
      container.innerHTML = `<p style="font-size:var(--text-sm);color:var(--text-3);padding:.5rem .75rem;">No students found.</p>`;
      return;
    }
    container.innerHTML = filtered.map(s => `
      <label style="display:flex;align-items:center;gap:.625rem;padding:.4375rem .75rem;
                    cursor:pointer;border-bottom:1px solid var(--border);"
             onmouseenter="this.style.background='var(--accent-subtle)'"
             onmouseleave="this.style.background=''">
        <input type="checkbox" class="msg-student-cb" value="${_esc(s.id)}"
               onchange="Teacher._updateMsgSelectedCount()"
               style="width:.9375rem;height:.9375rem;accent-color:var(--accent);flex-shrink:0;cursor:pointer;" />
        <span style="font-size:var(--text-sm);color:var(--text-1);flex:1;
                     white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${_esc(s.name)}
          <span style="color:var(--text-3);font-size:var(--text-xs);"> — ${_esc(s.cls)}</span>
        </span>
      </label>`).join('');
    _updateMsgSelectedCount();
  }

  function _filterMsgStudents() {
    const checked = new Set([...document.querySelectorAll('.msg-student-cb:checked')].map(cb => cb.value));
    _populateMsgCheckboxList();
    document.querySelectorAll('.msg-student-cb').forEach(cb => {
      if (checked.has(cb.value)) cb.checked = true;
    });
    _updateMsgSelectedCount();
  }

  function _updateMsgSelectedCount() {
    const count = document.querySelectorAll('.msg-student-cb:checked').length;
    const el    = document.getElementById('msgSelectedCount');
    if (el) el.textContent = `${count} selected`;
  }

  function _selectAllMsgStudents() {
    document.querySelectorAll('.msg-student-cb').forEach(cb => { cb.checked = true; });
    _updateMsgSelectedCount();
  }

  function _clearMsgStudents() {
    document.querySelectorAll('.msg-student-cb').forEach(cb => { cb.checked = false; });
    _updateMsgSelectedCount();
  }

  async function sendPrivateMessage() {
    const text     = document.getElementById('msgText')?.value.trim();
    const duration = parseInt(document.getElementById('msgDuration')?.value || '86400000', 10);
    if (!text) { UI.toast('Please write a message.', 'warning'); return; }

    let recipientIds = [];
    if (_msgMode === 'single') {
      const val = document.getElementById('msgStudent')?.value;
      if (!val) { UI.toast('Please select a student.', 'warning'); return; }
      recipientIds = [val];
    } else {
      recipientIds = [...document.querySelectorAll('.msg-student-cb:checked')].map(cb => cb.value);
      if (recipientIds.length === 0) { UI.toast('Please select at least one student.', 'warning'); return; }
    }

    const btn = document.getElementById('sendMsgBtn');
    UI.setLoading(btn, true);
    try {
      const expiresAt = new Date(Date.now() + duration);
      const sentAt    = firebase.firestore.FieldValue.serverTimestamp();
      const batch     = Db().batch();
      recipientIds.forEach(id => {
        batch.set(Db().collection('privateMessages').doc(), {
          recipientId: id, message: text, sentAt, expiresAt, sentBy: 'Master Timothy',
        });
      });
      await batch.commit();
      const msgEl = document.getElementById('msgText');
      if (msgEl) msgEl.value = '';
      _clearMsgStudents();
      const singleSel = document.getElementById('msgStudent');
      if (singleSel) singleSel.value = '';
      UI.toast(`Message sent to ${recipientIds.length === 1 ? '1 student' : recipientIds.length + ' students'}.`, 'success');
    } catch (err) {
      console.error('[teacher] sendPrivateMessage error:', err);
      UI.toast('Failed to send message.', 'error');
    } finally {
      UI.setLoading(btn, false);
    }
  }

  async function logout() {
  _cancelAll();
  AppState.isTeacher = false;
  await App.logout();
}

  // ═══════════════════════════════════════════════════════════
  //  WEEKLY TIMETABLE MANAGER
  // ═══════════════════════════════════════════════════════════

  // Returns "YYYY-Www" ISO week key for a given Date (or today)
  function _isoWeekKey(date) {
  const d = date ? new Date(date) : new Date();
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(thursday.getFullYear(), 0, 4);
  const weekNum   = Math.round(((thursday - yearStart) / 86400000 + 1) / 7);
  return thursday.getFullYear() + '-W' + String(weekNum).padStart(2, '0');
}

  // Returns the Monday of the ISO week that contains a given date
  function _weekMonday(date) {
    const d   = date ? new Date(date) : new Date();
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  // Formats a Monday date for display: "Mon 2 Jun – Sun 8 Jun 2025"
  function _weekRangeLabel(mondayDate) {
    const sunday = new Date(mondayDate);
    sunday.setDate(mondayDate.getDate() + 6);
    const opts = { day: 'numeric', month: 'short' };
    return mondayDate.toLocaleDateString('en-GB', opts) +
           ' – ' +
           sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Returns the class key (same as used in questions.js) from a class name string
  function _classKeyFromStr(classStr) {
    return (classStr || '').replace(/\s+/g, '').toLowerCase();
  }

  // Collect all unique class names from the student cache
  function _getAllClasses() {
    const seen = new Set();
    _msgStudentCache.forEach(s => { if (s.cls) seen.add(s.cls); });
    return [...seen].sort();
  }

  // Collect subjects for a given class from the question bank
  function _getSubjectsForClass(classStr) {
    const key   = _classKeyFromStr(classStr);
    const qBank = window.questions || {};
    return Object.keys(qBank[key] || {}).sort();
  }

  // State for the timetable manager
  let _ttSelectedClass      = '';
  let _ttSelectedWeek       = '';
  let _ttSelectedScope      = 'class';   // 'class' | 'student' | 'group'
  let _ttSelectedStudentUid = '';
  let _ttSelectedGroupName  = '';
  let _ttUnsubAll           = null;

  let _ttWeekMondayMap = {};

  // Returns the Firestore collection and doc ID for the current timetable target
  function _ttCurrentTarget() {
    if (_ttSelectedScope === 'student') {
      return { col: 'weeklyTimetable_custom', docId: 'student_' + _ttSelectedStudentUid };
    }
    if (_ttSelectedScope === 'group') {
      const safeName = (_ttSelectedGroupName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
      return { col: 'weeklyTimetable_custom', docId: 'group_' + safeName };
    }
    // class (default)
    return { col: 'weeklyTimetable', docId: _classKeyFromStr(_ttSelectedClass) };
  }

  // ── Local draft autosave (survives refresh/reload) ──
  let _ttDraftSaveTimer = null;

  function _ttDraftStorageKey() {
    const { col, docId } = _ttCurrentTarget();
    return 'vtx_tt_draft::' + col + '::' + docId + '::' + _ttSelectedWeek;
  }

  function _ttSaveDraft() {
    clearTimeout(_ttDraftSaveTimer);
    _ttDraftSaveTimer = setTimeout(function () {
      try {
        const periods = _ttReadPeriodsFromDOM();
        const note    = (document.getElementById('ttNoteInput')?.value || '');
        const key     = _ttDraftStorageKey();
        localStorage.setItem(key, JSON.stringify({ periods, note, savedAt: Date.now() }));
        _ttShowDraftIndicator(true);
      } catch (e) {
        console.warn('[timetable] could not save draft to localStorage:', e);
      }
    }, 400);
  }

  function _ttLoadDraft() {
    try {
      const raw = localStorage.getItem(_ttDraftStorageKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.periods) || parsed.periods.length === 0) return null;
      return parsed;
    } catch (e) {
      console.warn('[timetable] could not read draft from localStorage:', e);
      return null;
    }
  }

  function _ttClearDraft(key) {
    try {
      localStorage.removeItem(key || _ttDraftStorageKey());
    } catch (e) { /* ignore */ }
  }

  function _ttShowDraftIndicator(saved) {
    const el = document.getElementById('ttDraftStatus');
    if (!el) return;
    if (saved) {
      const now = new Date();
      el.textContent = 'Draft autosaved ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } else {
      el.textContent = '';
    }
  }

  function _ttDiscardDraft() {
    _ttClearDraft();
    _ttRenderEditor();
  }

  function _setTTScope(scope) {
  _ttSelectedScope = scope;

  const btnClass   = document.getElementById('ttScopeClass');
  const btnStudent = document.getElementById('ttScopeStudent');
  const btnGroup   = document.getElementById('ttScopeGroup');
  [btnClass, btnStudent, btnGroup].forEach(b => {
    if (!b) return;
    b.style.background = 'transparent';
    b.style.color      = 'var(--text-3)';
    b.style.boxShadow  = 'none';
  });
  const active = scope === 'student' ? btnStudent : scope === 'group' ? btnGroup : btnClass;
  if (active) {
    active.style.background = 'var(--bg-base)';
    active.style.color      = 'var(--text-1)';
    active.style.boxShadow  = 'var(--shadow-xs)';
  }

  const classWrap   = document.getElementById('ttClassWrap');
  const studentWrap = document.getElementById('ttStudentWrap');
  const groupWrap   = document.getElementById('ttGroupWrap');
  if (classWrap)   classWrap.style.display   = scope === 'class'   ? '' : 'none';
  if (studentWrap) studentWrap.style.display  = scope === 'student' ? '' : 'none';
  if (groupWrap)   groupWrap.style.display    = scope === 'group'   ? '' : 'none';

  _ttRenderEditor();
  _ttListenAll();

  if (scope === 'group') {
    _ttRenderGroupMembers();
  } else {
    const memberWrap = document.getElementById('ttGroupMembersWrap');
    if (memberWrap) memberWrap.innerHTML = '';
  }
}

  function _onTTStudentChange() {
    const sel = document.getElementById('ttStudentSelect');
    if (sel) _ttSelectedStudentUid = sel.value;
    _ttRenderEditor();
    _ttListenAll();
  }

  function _onTTGroupNameChange() {
  const inp = document.getElementById('ttGroupNameInput');
  if (inp) _ttSelectedGroupName = inp.value;
  clearTimeout(_onTTGroupNameChange._t);
  _onTTGroupNameChange._t = setTimeout(function () {
    _ttRenderEditor();
    _ttListenAll();
    _ttRenderGroupMembers();
  }, 600);
}

async function _ttRenderGroupMembers() {
  let wrap = document.getElementById('ttGroupMembersWrap');
  if (!wrap) return;

  const groupName = (_ttSelectedGroupName || '').trim();
  if (!groupName) {
    wrap.innerHTML = '';
    return;
  }

  // Build a set of student UIDs currently in this group
  const inGroup = new Set(
    _msgStudentCache
      .filter(s => (s.timetableGroup || '').trim().toLowerCase() === groupName.toLowerCase())
      .map(s => s.id)
  );

  const safeName = groupName.toLowerCase().replace(/[^a-z0-9]/g, '_');

  wrap.innerHTML = `
    <div style="margin-top:1rem;border:1px solid var(--accent-border);border-radius:10px;
                overflow:hidden;background:var(--bg-base);">
      <div style="padding:.625rem 1rem;background:var(--accent-subtle);
                  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;">
        <div>
          <p style="font-size:var(--text-sm);font-weight:700;color:var(--accent-text);">
            Group Members — <em>${_esc(groupName)}</em>
          </p>
          <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:1px;">
            Tick students to add them to this group. Untick to remove.
          </p>
        </div>
        <div style="display:flex;gap:.375rem;align-items:center;">
          <button onclick="Teacher._ttSelectAllGroupMembers()"
                  style="font-size:var(--text-xs);font-weight:600;color:var(--accent);
                         background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">
            All
          </button>
          <span style="color:var(--border-strong);">·</span>
          <button onclick="Teacher._ttClearGroupMembers()"
                  style="font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                         background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">
            None
          </button>
        </div>
      </div>

      ${_msgStudentCache.length === 0
        ? `<p style="padding:.75rem 1rem;font-size:var(--text-sm);color:var(--text-3);font-style:italic;">
             No students registered yet.</p>`
        : `<div style="max-height:220px;overflow-y:auto;">
             ${_msgStudentCache
               .slice()
               .sort((a, b) => a.name.localeCompare(b.name))
               .map(s => `
                 <label style="display:flex;align-items:center;gap:.625rem;
                               padding:.4375rem 1rem;cursor:pointer;
                               border-bottom:1px solid var(--border);"
                        onmouseenter="this.style.background='var(--accent-subtle)'"
                        onmouseleave="this.style.background=''">
                   <input type="checkbox" class="tt-group-member-cb"
                          value="${_esc(s.id)}"
                          data-current-group="${_esc(s.timetableGroup || '')}"
                          ${inGroup.has(s.id) ? 'checked' : ''}
                          style="width:.9375rem;height:.9375rem;accent-color:var(--accent);
                                 flex-shrink:0;cursor:pointer;" />
                   <span style="font-size:var(--text-sm);color:var(--text-1);flex:1;
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                     ${_esc(s.name)}
                     <span style="color:var(--text-3);font-size:var(--text-xs);"> — ${_esc(s.cls)}</span>
                   </span>
                   ${(s.timetableGroup && s.timetableGroup.trim().toLowerCase() !== groupName.toLowerCase())
                     ? `<span style="font-size:var(--text-xs);color:var(--warning-text);
                                    background:var(--warning-subtle);border:1px solid var(--warning-border);
                                    border-radius:4px;padding:1px 6px;white-space:nowrap;flex-shrink:0;">
                          In: ${_esc(s.timetableGroup)}
                        </span>`
                     : ''}
                 </label>`).join('')}
           </div>`}

      <div style="padding:.625rem 1rem;border-top:1px solid var(--border);
                  display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap;">
        <span id="ttGroupMemberCount" style="font-size:var(--text-xs);color:var(--text-3);">
          ${inGroup.size} member${inGroup.size !== 1 ? 's' : ''}
        </span>
        <button id="ttSaveGroupBtn" onclick="Teacher._ttSaveGroupMembers()"
                class="btn bg-green-600" style="font-size:var(--text-sm);">
          Save Group Members
        </button>
      </div>
    </div>`;

  // Wire checkbox count update
  wrap.querySelectorAll('.tt-group-member-cb').forEach(cb => {
    cb.addEventListener('change', function () {
      const count = wrap.querySelectorAll('.tt-group-member-cb:checked').length;
      const countEl = document.getElementById('ttGroupMemberCount');
      if (countEl) countEl.textContent = count + ' member' + (count !== 1 ? 's' : '');
    });
  });
}

function _ttSelectAllGroupMembers() {
  document.querySelectorAll('.tt-group-member-cb').forEach(cb => { cb.checked = true; });
  const count = document.querySelectorAll('.tt-group-member-cb').length;
  const el = document.getElementById('ttGroupMemberCount');
  if (el) el.textContent = count + ' member' + (count !== 1 ? 's' : '');
}

function _ttClearGroupMembers() {
  document.querySelectorAll('.tt-group-member-cb').forEach(cb => { cb.checked = false; });
  const el = document.getElementById('ttGroupMemberCount');
  if (el) el.textContent = '0 members';
}

async function _ttSaveGroupMembers() {
  const groupName = (_ttSelectedGroupName || '').trim();
  if (!groupName) { UI.toast('Enter a group name first.', 'warning'); return; }

  const btn = document.getElementById('ttSaveGroupBtn');
  UI.setLoading(btn, true);

  try {
    // Collect checked and unchecked states
    const checkboxes = document.querySelectorAll('.tt-group-member-cb');
    if (checkboxes.length === 0) {
      UI.toast('No students available.', 'warning');
      UI.setLoading(btn, false);
      return;
    }

    const batch = Db().batch();
    let changeCount = 0;

    checkboxes.forEach(cb => {
      const uid          = cb.value;
      const isChecked    = cb.checked;
      const currentGroup = (cb.dataset.currentGroup || '').trim();
      const alreadyInThis = currentGroup.toLowerCase() === groupName.toLowerCase();

      if (isChecked && !alreadyInThis) {
        // Add to this group
        batch.update(Db().collection('students').doc(uid), { timetableGroup: groupName });
        changeCount++;
      } else if (!isChecked && alreadyInThis) {
        // Remove from this group (only if they were in THIS group, not another)
        batch.update(Db().collection('students').doc(uid), { timetableGroup: null });
        changeCount++;
      }
      // If checked and already in this group, or unchecked and in a different group: no change
    });

    if (changeCount === 0) {
      UI.toast('No changes to save.', 'info');
      UI.setLoading(btn, false);
      return;
    }

    await batch.commit();

    const checked = document.querySelectorAll('.tt-group-member-cb:checked').length;
    UI.toast(
      `Group "${groupName}" saved — ${checked} member${checked !== 1 ? 's' : ''}.`,
      'success'
    );

    // Re-render the member list to reflect saved state
    _ttRenderGroupMembers();

  } catch (err) {
    console.error('[timetable] _ttSaveGroupMembers error:', err);
    UI.toast('Failed to save group members.', 'error');
  } finally {
    UI.setLoading(btn, false);
  }
}

function _getMondayForWeek(weekKey) {
  if (_ttWeekMondayMap[weekKey]) return _ttWeekMondayMap[weekKey];
  const year = +weekKey.split('-W')[0];
  for (let i = -5; i <= 60; i++) {
    const d = new Date(year, 0, 4 + i * 7);
    if (_isoWeekKey(d) === weekKey) {
      const m = _weekMonday(d);
      _ttWeekMondayMap[weekKey] = m;
      return m;
    }
  }
  return _weekMonday(new Date());
}

function _loadTimetableManager() {
  const container = document.getElementById('teacher-timetable');
  if (!container) return;

  const classes  = _getAllClasses();
  const thisWeek = _isoWeekKey();

  _ttSelectedWeek  = thisWeek;
  _ttSelectedScope = 'class';
  if (!_ttSelectedClass && classes.length > 0) _ttSelectedClass = classes[0];
  _ttSelectedStudentUid   = '';
  _ttSelectedGroupName    = '';

  _ttWeekMondayMap = {};
  const weekOptions = [];
  for (let i = 0; i <= 12; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i * 7);
    const key    = _isoWeekKey(d);
    const monday = _weekMonday(d);
    const label  = _weekRangeLabel(monday);
    if (!weekOptions.find(w => w.key === key)) {
      weekOptions.push({ key, label });
      _ttWeekMondayMap[key] = new Date(monday);
    }
  }
  weekOptions.sort((a, b) => a.key.localeCompare(b.key));

  const studentOptions = _msgStudentCache
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(s => `<option value="${_esc(s.id)}">${_esc(s.name)} (${_esc(s.cls)})</option>`)
    .join('');

  container.innerHTML = `
    <div style="margin-bottom:1rem;">
      <h2 style="font-size:var(--text-md);font-weight:600;color:var(--text-1);letter-spacing:-0.015em;">
        Class Timetable
      </h2>
      <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:2px;">
        Build a period-by-period timetable for each class, individual student, or a custom group.
        Students see it as a proper school timetable grid on their dashboard.
        Set a timetable as <strong>Permanent</strong> so it never expires.
        <strong>Student and group timetables override the class timetable for those students.</strong>
      </p>
    </div>

    <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1rem;align-items:flex-end;">
      <div style="flex:1;min-width:160px;">
        <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                      margin-bottom:.375rem;text-transform:uppercase;letter-spacing:.04em;">Assign To</label>
        <div style="display:flex;background:var(--bg-muted);border:1px solid var(--border);
                    border-radius:var(--r-md);padding:3px;gap:3px;">
          <button id="ttScopeClass" onclick="Teacher._setTTScope('class')"
                  style="flex:1;padding:.35rem .25rem;font-size:var(--text-xs);font-weight:500;
                         cursor:pointer;border:none;border-radius:5px;font-family:inherit;
                         background:var(--bg-base);color:var(--text-1);box-shadow:var(--shadow-xs);
                         transition:background var(--t-fast),color var(--t-fast);">Class</button>
          <button id="ttScopeStudent" onclick="Teacher._setTTScope('student')"
                  style="flex:1;padding:.35rem .25rem;font-size:var(--text-xs);font-weight:500;
                         cursor:pointer;border:none;border-radius:5px;font-family:inherit;
                         background:transparent;color:var(--text-3);
                         transition:background var(--t-fast),color var(--t-fast);">Student</button>
          <button id="ttScopeGroup" onclick="Teacher._setTTScope('group')"
                  style="flex:1;padding:.35rem .25rem;font-size:var(--text-xs);font-weight:500;
                         cursor:pointer;border:none;border-radius:5px;font-family:inherit;
                         background:transparent;color:var(--text-3);
                         transition:background var(--t-fast),color var(--t-fast);">Group</button>
        </div>
      </div>
    </div>

    <div id="ttTargetRow" style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1.25rem;align-items:flex-end;">
      <div id="ttClassWrap" style="flex:1;min-width:160px;">
        <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                      margin-bottom:.375rem;text-transform:uppercase;letter-spacing:.04em;">Class</label>
        <select id="ttClassSelect" onchange="Teacher._onTTClassChange()" style="width:100%;">
          ${classes.length === 0
            ? '<option value="">No classes found — register students first</option>'
            : classes.map(c => `<option value="${_esc(c)}" ${c === _ttSelectedClass ? 'selected' : ''}>${_esc(c)}</option>`).join('')}
        </select>
      </div>
      <div id="ttStudentWrap" style="flex:1;min-width:160px;display:none;">
        <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                      margin-bottom:.375rem;text-transform:uppercase;letter-spacing:.04em;">Student</label>
        <select id="ttStudentSelect" onchange="Teacher._onTTStudentChange()" style="width:100%;">
          <option value="">Select a student...</option>
          ${studentOptions}
        </select>
      </div>
      <div id="ttGroupWrap" style="flex:1;min-width:200px;display:none;">
        <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                      margin-bottom:.375rem;text-transform:uppercase;letter-spacing:.04em;">Group Name</label>
        <input type="text" id="ttGroupNameInput" placeholder="e.g. Holiday Group A"
               oninput="Teacher._onTTGroupNameChange()"
               style="width:100%;box-sizing:border-box;" />
        <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:.25rem;line-height:1.5;">
          Type a group name, then add members below. Students in the group will see this timetable.
        </p>
      </div>
      <div style="flex:1;min-width:200px;">
        <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                      margin-bottom:.375rem;text-transform:uppercase;letter-spacing:.04em;">Week</label>
        <select id="ttWeekSelect" onchange="Teacher._onTTWeekChange()" style="width:100%;">
          <option value="permanent" ${_ttSelectedWeek === 'permanent' ? 'selected' : ''}>
            Permanent Timetable (active until changed)
          </option>
          <optgroup label="─ Week-specific ─">
            ${weekOptions.map(w => `
              <option value="${_esc(w.key)}" ${w.key === _ttSelectedWeek ? 'selected' : ''}>
                ${w.key === thisWeek ? '★ This week: ' : ''}${_esc(w.label)} (${_esc(w.key)})
              </option>`).join('')}
          </optgroup>
        </select>
      </div>
    </div>

    <!-- Group member manager renders here when scope = group -->
    <div id="ttGroupMembersWrap"></div>

    <div id="ttEditorWrap" style="margin-top:.75rem;">
      <div style="text-align:center;padding:2rem;color:var(--text-3);font-size:var(--text-sm);">Loading…</div>
    </div>

    <div style="margin-top:2rem;padding-top:1.25rem;border-top:1px solid var(--border);">
      <h3 style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);margin-bottom:.75rem;">
        Saved Timetables
      </h3>
      <div id="ttAllList" style="display:flex;flex-direction:column;gap:.5rem;"></div>
    </div>`;

  _ttRenderEditor();
  _ttListenAll();
}

async function _ttRenderEditor() {
  const wrap = document.getElementById('ttEditorWrap');
  if (!wrap) return;

  const scope = _ttSelectedScope;

  // Guard: make sure a valid target is selected
  if (scope === 'class' && !_ttSelectedClass) {
    wrap.innerHTML = `<p style="font-size:var(--text-sm);color:var(--text-3);">Select a class above.</p>`;
    return;
  }
  if (scope === 'student' && !_ttSelectedStudentUid) {
    wrap.innerHTML = `<p style="font-size:var(--text-sm);color:var(--text-3);">Select a student above.</p>`;
    return;
  }
  if (scope === 'group' && !(_ttSelectedGroupName || '').trim()) {
    wrap.innerHTML = `<p style="font-size:var(--text-sm);color:var(--text-3);">Enter a group name above.</p>`;
    return;
  }

  const isPermanent = _ttSelectedWeek === 'permanent';
  const thisWeek    = _isoWeekKey();
  const isThisWk    = _ttSelectedWeek === thisWeek;

  const { col, docId } = _ttCurrentTarget();

  // Human-readable label for what we are editing
  let targetLabel = '';
  if (scope === 'class') {
    targetLabel = _ttSelectedClass;
  } else if (scope === 'student') {
    const found = _msgStudentCache.find(s => s.id === _ttSelectedStudentUid);
    targetLabel = found ? found.name + ' (' + found.cls + ')' : _ttSelectedStudentUid;
  } else {
    targetLabel = (_ttSelectedGroupName || '').trim() + ' (group)';
  }

  const targetMon = isPermanent ? _weekMonday(new Date()) : _getMondayForWeek(_ttSelectedWeek);
  const weekLabel = isPermanent ? 'Permanent Timetable' : _weekRangeLabel(targetMon);

  // Scope badge colour
  const scopeBadgeStyle = scope === 'student'
    ? 'background:var(--success);color:#fff;'
    : scope === 'group'
    ? 'background:var(--purple,#7c3aed);color:#fff;'
    : 'background:var(--accent);color:#fff;';

  // Load existing data
  let periods  = _ttDefaultPeriods();
  let note     = '';
  let hasSaved = false;
  try {
    const snap = await Db().collection(col).doc(docId).get();
    if (snap.exists) {
      const allTimetables = (snap.data() || {}).timetables || {};
      const saved = allTimetables[_ttSelectedWeek];
      if (saved && Array.isArray(saved.periods) && saved.periods.length > 0) {
        periods  = saved.periods;
        note     = saved.note || '';
        hasSaved = true;
      }
    }
  } catch (e) { console.warn('[timetable] load error:', e); }

  // Check for an unsaved local draft for this exact target + week.
  // If one exists, it takes priority over the saved Firestore version
  // so the teacher's in-progress edits survive a refresh/reload.
  let draftRestored = false;
  const localDraft = _ttLoadDraft();
  if (localDraft) {
    periods = localDraft.periods;
    note    = localDraft.note || '';
    draftRestored = true;
  }

  const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DAY_KEYS  = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  const dayDates = DAY_KEYS.map((_, i) => {
    const dt = new Date(targetMon);
    dt.setDate(targetMon.getDate() + i);
    return dt.getDate() + ' ' + dt.toLocaleDateString('en-GB', { month: 'short' });
  });

  const bodyHtml = periods.map(p => _ttBuildPeriodRowHtml(p)).join('');

  const headerCells = DAY_SHORT.map((ds, i) =>
    `<th style="padding:.4375rem .5rem;border:1px solid rgba(255,255,255,.18);
                font-size:var(--text-xs);font-weight:700;color:#fff;text-align:center;
                min-width:100px;">
      ${_esc(ds)}<br>
      <span style="font-weight:400;font-size:.625rem;opacity:.8;">${isPermanent ? '—' : _esc(dayDates[i])}</span>
    </th>`
  ).join('');

  const badgeHtml = isPermanent
    ? `<span style="font-size:var(--text-xs);font-weight:700;padding:2px 9px;
                    border-radius:99px;background:var(--warning);color:#fff;">Permanent</span>`
    : isThisWk
    ? `<span style="font-size:var(--text-xs);font-weight:700;padding:2px 9px;
                    border-radius:99px;background:var(--accent);color:#fff;">Current Week</span>`
    : '';

  const subLabel = isPermanent
    ? 'This timetable is active every ' + (scope === 'class' ? 'week for this class' : 'week for this target') + ' until you change or delete it.'
    : isThisWk
    ? '★ Students see this timetable right now.'
    : `${_esc(_ttSelectedWeek)} — not yet current.`;

  const overrideNote = (scope === 'student' || scope === 'group')
    ? `<div style="display:flex;align-items:flex-start;gap:.625rem;margin-bottom:1rem;padding:.625rem .875rem;
          background:var(--success-subtle);border:1px solid var(--success-border);
          border-radius:var(--r-md);font-size:var(--text-xs);color:var(--success-text);line-height:1.6;">
        <i class="ph ph-star" style="flex-shrink:0;font-size:1rem;margin-top:1px;"></i>
        <div>
          <strong>Override timetable:</strong>
          This timetable will be shown to
          <strong>${_esc(targetLabel)}</strong>
          instead of the class timetable.
          The class timetable remains unchanged.
        </div>
      </div>`
    : '';

  const draftBannerHtml = draftRestored
    ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;
          margin-bottom:1rem;padding:.625rem .875rem;flex-wrap:wrap;
          background:var(--warning-subtle);border:1px solid var(--warning-border);
          border-radius:var(--r-md);font-size:var(--text-xs);color:var(--warning-text);line-height:1.6;">
        <span>
          <strong>Unsaved changes restored</strong> — these edits were kept on this device
          and were not yet saved. Click <strong>${isPermanent ? 'Save Permanent Timetable' : 'Save Timetable'}</strong>
          below to store them, or discard them.
        </span>
        <button onclick="Teacher._ttDiscardDraft()" class="btn bg-gray-500"
                style="font-size:var(--text-xs);white-space:nowrap;">
          Discard local draft
        </button>
      </div>`
    : '';

  wrap.innerHTML = `
    <div class="glass-dark" style="padding:1.25rem;border-radius:var(--r-lg);overflow:hidden;">

      <div style="display:flex;align-items:center;justify-content:space-between;
                  margin-bottom:1rem;padding-bottom:.75rem;border-bottom:1px solid var(--border);
                  flex-wrap:wrap;gap:.5rem;">
        <div>
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:2px;">
            <h3 style="font-size:var(--text-base);font-weight:700;color:var(--text-1);">
              ${_esc(targetLabel)} — ${_esc(weekLabel)}
            </h3>
            <span style="font-size:var(--text-xs);font-weight:700;padding:2px 8px;
                         border-radius:99px;${scopeBadgeStyle}">
              ${_esc(scope.charAt(0).toUpperCase() + scope.slice(1))}
            </span>
          </div>
          <p style="font-size:var(--text-xs);color:var(--text-3);margin-top:2px;">${subLabel}</p>
        </div>
        ${badgeHtml}
      </div>

      ${draftBannerHtml}

      ${overrideNote}

      ${isPermanent ? `
        <div style="display:flex;align-items:flex-start;gap:.625rem;margin-bottom:1rem;padding:.625rem .875rem;
            background:var(--warning-subtle);border:1px solid var(--warning-border);
            border-radius:var(--r-md);font-size:var(--text-xs);color:var(--warning-text);line-height:1.6;">
            <i class="ph ph-infinity" style="flex-shrink:0;font-size:1rem;margin-top:1px;"></i>
          <div>
            <strong>Permanent timetable:</strong> Students will see this every week, regardless of the date,
            unless a week-specific timetable exists for that week (week-specific always takes priority).
          </div>
        </div>` : ''}

      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:1rem;
                  border:1px solid var(--border);border-radius:var(--r-md);">
        <table style="border-collapse:collapse;width:100%;min-width:780px;">
          <thead>
            <tr style="background:var(--accent);">
              <th style="padding:.4375rem .625rem;border:1px solid rgba(255,255,255,.18);
                         font-size:var(--text-xs);font-weight:700;color:#fff;
                         text-align:center;min-width:98px;white-space:nowrap;">
                Time / Period
              </th>
              ${headerCells}
              <th style="padding:.4375rem .375rem;border:1px solid rgba(255,255,255,.18);
                         font-size:var(--text-xs);color:#fff;width:28px;"></th>
            </tr>
          </thead>
          <tbody id="ttPeriodBody">
            ${bodyHtml}
          </tbody>
        </table>
      </div>

      <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem;">
        <button onclick="Teacher._ttAddEmptyPeriodRow()" class="btn bg-gray-500"
                style="font-size:var(--text-sm);">+ Add Period</button>
        <button onclick="Teacher._ttAddBreakRow()" class="btn bg-gray-500"
                style="font-size:var(--text-sm);">+ Add Break</button>
        <button onclick="Teacher._ttAddLunchRow()" class="btn bg-gray-500"
                style="font-size:var(--text-sm);">+ Add Lunch</button>
      </div>

      <div style="margin-bottom:1rem;">
        <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-3);
                      margin-bottom:.375rem;text-transform:uppercase;letter-spacing:.04em;">
          Optional Note
          <span style="font-weight:400;text-transform:none;color:var(--text-4);">
            — displayed below the timetable on the student dashboard
          </span>
        </label>
        <input type="text" id="ttNoteInput" value="${_esc(note)}"
               placeholder="e.g. Assembly at 7:45 on Mondays. Bring PE kit on Wednesdays."
               style="width:100%;box-sizing:border-box;" />
      </div>

      <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;
                  padding-top:.875rem;border-top:1px solid var(--border);">
        <button id="ttSaveBtn" onclick="Teacher._saveTimetable()"
                class="btn bg-green-600" style="font-size:var(--text-sm);">
          ${isPermanent ? 'Save Permanent Timetable' : 'Save Timetable'}
        </button>
        <button onclick="Teacher._clearTimetableInputs()" class="btn bg-gray-500"
                style="font-size:var(--text-sm);">
          Reset to Defaults
        </button>
        ${hasSaved
          ? `<button onclick="Teacher._deleteTimetable('${_esc(_ttSelectedWeek)}')"
                     class="btn" style="background:var(--danger-subtle);color:var(--danger);
                                        border:1px solid var(--danger-border);font-size:var(--text-sm);">
               ${isPermanent ? 'Delete Permanent' : 'Delete This Week'}
             </button>`
          : ''}
        <span id="ttDraftStatus" style="font-size:var(--text-xs);color:var(--text-3);margin-left:.25rem;"></span>
      </div>

    </div>`;

  // Wire up autosave: any typing in the grid or note field, or removing a row,
  // saves a draft copy to this browser's local storage (debounced).
  const periodBodyEl = document.getElementById('ttPeriodBody');
  const noteInputEl  = document.getElementById('ttNoteInput');
  const _ttAutosaveHandler = function () { _ttSaveDraft(); };
  if (periodBodyEl) {
    periodBodyEl.addEventListener('input',  _ttAutosaveHandler);
    periodBodyEl.addEventListener('change', _ttAutosaveHandler);
  }
  if (noteInputEl) {
    noteInputEl.addEventListener('input', _ttAutosaveHandler);
  }
  wrap.addEventListener('click', function (e) {
    if (e.target.closest('.tt-remove-period-btn')) _ttAutosaveHandler();
  });
  if (draftRestored) _ttShowDraftIndicator(true);
}

function _ttRenderAllList(docData) {
  const container = document.getElementById('ttAllList');
  if (!container) return;

  const DAY_KEYS   = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const thisWeek   = _isoWeekKey();
  const timetables = (docData && docData.timetables) ? docData.timetables : {};
  const allKeys    = Object.keys(timetables);

  /* Separate permanent from weekly */
  const hasPermanent  = allKeys.includes('permanent');
  const weekKeys      = allKeys.filter(k => k !== 'permanent').sort().reverse();
  const orderedKeys   = hasPermanent ? ['permanent', ...weekKeys] : weekKeys;

  if (orderedKeys.length === 0) {
    container.innerHTML =
      `<p style="font-size:var(--text-sm);color:var(--text-3);font-style:italic;">
         No timetables saved for ${_esc(_ttSelectedClass || _ttSelectedGroupName || 'this target')}.
       </p>`;
    return;
  }

  container.innerHTML = orderedKeys.map(wk => {
    const tt          = timetables[wk] || {};
    const isPermanent = wk === 'permanent';
    const isThisWeek  = wk === thisWeek;
    const periods     = Array.isArray(tt.periods) ? tt.periods : [];
    const mon         = isPermanent ? _weekMonday(new Date()) : _getMondayForWeek(wk);
    const rangeLabel  = isPermanent ? 'Permanent Timetable' : _weekRangeLabel(mon);

    const lessonCount = periods.filter(p =>
      !DAY_KEYS.every(dk => ['BREAK','LUNCH',''].includes((p[dk]||'').trim().toUpperCase()))
    ).length;

    /* Mini preview: first 4 rows */
    const previewRows = periods.slice(0, 4).map(p => {
      const vals       = DAY_KEYS.map(dk => (p[dk]||'').trim());
      const firstUp    = vals[0].toUpperCase();
      const allSame    = firstUp !== '' && vals.every(v => v.toUpperCase() === firstUp);
      const isSpecial  = allSame && (firstUp === 'BREAK' || firstUp === 'LUNCH');
      const timeLabel  = _esc(p.time || '—');
      const subjLabel  = isSpecial
        ? `<em style="color:var(--text-4);">${_esc(vals[0])}</em>`
        : `<span style="color:var(--text-1);font-weight:500;">${_esc(vals[0])}</span>` +
          (vals[1] ? ` <span style="color:var(--text-3);">/ ${_esc(vals[1])}</span>` : '');
      return `<div style="font-size:var(--text-xs);padding:1px 0;display:flex;gap:.375rem;">
        <span style="color:var(--text-3);font-family:var(--font-mono);min-width:72px;flex-shrink:0;">${timeLabel}</span>
        ${subjLabel}
      </div>`;
    }).join('');

    /* Badge styling */
    const headerBg      = isPermanent ? 'var(--warning-subtle)' : isThisWeek ? 'var(--accent-subtle)' : 'var(--bg-subtle)';
    const borderColor   = isPermanent ? 'var(--warning-border)' : isThisWeek ? 'var(--accent-border)' : 'var(--border)';
    const labelColor    = isPermanent ? 'var(--warning-text)'   : isThisWeek ? 'var(--accent-text)'   : 'var(--text-1)';
    const badgeHtml     = isPermanent
      ? `<span style="font-size:var(--text-xs);font-weight:700;padding:1px 7px;border-radius:99px;
                      background:var(--warning);color:#fff;">Permanent</span>`
      : isThisWeek
      ? `<span style="font-size:var(--text-xs);font-weight:700;padding:1px 7px;border-radius:99px;
                      background:var(--accent);color:#fff;">★ Current</span>`
      : `<span style="font-size:var(--text-xs);color:var(--text-4);">${_esc(wk)}</span>`;

    return `
      <div style="border:1px solid ${borderColor};
                  border-radius:8px;overflow:hidden;background:var(--bg-base);">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem .875rem;
                    background:${headerBg};">
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">
            <span style="font-size:var(--text-sm);font-weight:700;color:${labelColor};">
              ${_esc(rangeLabel)}
            </span>
            ${badgeHtml}
            <span style="font-size:var(--text-xs);color:var(--text-3);">
              ${lessonCount} lesson period${lessonCount !== 1 ? 's' : ''}
              · ${periods.length} rows
            </span>
          </div>
          <div style="display:flex;gap:.375rem;align-items:center;flex-shrink:0;">
            <button onclick="Teacher._editTimetableWeek('${_esc(wk)}')"
                    style="font-size:var(--text-xs);font-weight:600;color:var(--accent);
                           background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">
              Edit
            </button>
            <span style="color:var(--border-strong);">·</span>
            <button onclick="Teacher._deleteTimetable('${_esc(wk)}')"
                    style="font-size:var(--text-xs);font-weight:600;color:var(--danger);
                           background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">
              Delete
            </button>
          </div>
        </div>
        ${tt.note
          ? `<div style="padding:.3125rem .875rem;font-size:var(--text-xs);color:var(--text-3);
                         font-style:italic;border-bottom:1px solid var(--border);">
                ${_esc(tt.note)}
             </div>`
          : ''}
        <div style="padding:.5rem .875rem;">
          ${previewRows}
          ${periods.length > 4
            ? `<div style="font-size:var(--text-xs);color:var(--text-4);margin-top:2px;">
                 + ${periods.length - 4} more rows…
               </div>`
            : ''}
        </div>
      </div>`;
  }).join('');
}

function _editTimetableWeek(weekKey) {
  _ttSelectedWeek = weekKey;
  const sel = document.getElementById('ttWeekSelect');
  if (sel) {
    let found = false;
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === weekKey) { sel.selectedIndex = i; found = true; break; }
    }
    if (!found && weekKey !== 'permanent') {
      const opt   = document.createElement('option');
      opt.value   = weekKey;
      opt.text    = weekKey;
      const optgroup = sel.querySelector('optgroup');
      if (optgroup) optgroup.insertBefore(opt, optgroup.firstChild);
      else sel.appendChild(opt);
      sel.value = weekKey;
    }
  }
  _ttRenderEditor();
  const wrap = document.getElementById('ttEditorWrap');
  if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

  function _onTTClassChange() {
    const sel = document.getElementById('ttClassSelect');
    if (sel) _ttSelectedClass = sel.value;
    _ttRenderEditor();
    _ttListenAll();
  }

  function _onTTWeekChange() {
    const sel = document.getElementById('ttWeekSelect');
    if (sel) _ttSelectedWeek = sel.value;
    _ttRenderEditor();
  }

  function _ttListenAll() {
  if (typeof _ttUnsubAll === 'function') { _ttUnsubAll(); _ttUnsubAll = null; }

  const scope = _ttSelectedScope;
  if (scope === 'class' && !_ttSelectedClass) return;
  if (scope === 'student' && !_ttSelectedStudentUid) return;
  if (scope === 'group' && !(_ttSelectedGroupName || '').trim()) return;

  const { col, docId } = _ttCurrentTarget();
  if (!docId) return;

  _ttUnsubAll = Db().collection(col).doc(docId).onSnapshot(
    function (snap) { _ttRenderAllList(snap.exists ? snap.data() : {}); },
    function (err)  { console.warn('[timetable] listen error:', err); }
  );
}

  function _clearTimetableInputs() {
    const tbody = document.getElementById('ttPeriodBody');
    if (tbody) {
      tbody.innerHTML = _ttDefaultPeriods().map(p => _ttBuildPeriodRowHtml(p)).join('');
    }
    const noteEl = document.getElementById('ttNoteInput');
    if (noteEl) noteEl.value = '';
    _ttSaveDraft();
  }

async function _saveTimetable() {
  const scope = _ttSelectedScope;
  if (!_ttSelectedWeek) { UI.toast('Please select a week.', 'warning'); return; }
  if (scope === 'class' && !_ttSelectedClass)          { UI.toast('Please select a class.', 'warning');   return; }
  if (scope === 'student' && !_ttSelectedStudentUid)   { UI.toast('Please select a student.', 'warning'); return; }
  if (scope === 'group' && !(_ttSelectedGroupName||'').trim()) { UI.toast('Please enter a group name.', 'warning'); return; }

  const periods = _ttReadPeriodsFromDOM();
  if (periods.length === 0) {
    UI.toast('Add at least one period before saving.', 'warning'); return;
  }

  const isPermanent = _ttSelectedWeek === 'permanent';
  const note        = (document.getElementById('ttNoteInput')?.value || '').trim();
  const { col, docId } = _ttCurrentTarget();
  const btn         = document.getElementById('ttSaveBtn');

  // Build a human-readable label to store so the list can display it
  let targetLabel = '';
  if (scope === 'class') {
    targetLabel = _ttSelectedClass;
  } else if (scope === 'student') {
    const found = _msgStudentCache.find(s => s.id === _ttSelectedStudentUid);
    targetLabel = found ? found.name + ' (' + found.cls + ')' : _ttSelectedStudentUid;
  } else {
    targetLabel = (_ttSelectedGroupName || '').trim();
  }

  UI.setLoading(btn, true);
  try {
    await Db().collection(col).doc(docId).set({
      targetScope: scope,
      targetLabel,
      targetId: docId,
      ...(scope === 'class'   ? { className: _ttSelectedClass } : {}),
      ...(scope === 'student' ? { studentUid: _ttSelectedStudentUid } : {}),
      ...(scope === 'group'   ? { groupName: (_ttSelectedGroupName || '').trim() } : {}),
      timetables: {
        [_ttSelectedWeek]: {
          periods,
          note,
          isPermanent: isPermanent || false,
          savedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
      },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const successMsg = isPermanent
      ? `Permanent timetable saved for ${targetLabel}.`
      : `Timetable saved for ${targetLabel} — ${_ttSelectedWeek}.`;
    UI.toast(successMsg, 'success');
    _ttClearDraft();
    _ttRenderEditor();
  } catch (err) {
    console.error('[timetable] save error:', err);
    UI.toast('Failed to save timetable.', 'error');
  } finally {
    UI.setLoading(btn, false);
  }
}

async function _deleteTimetable(weekKey) {
  const scope = _ttSelectedScope;
  if (!weekKey) return;

  const { col, docId } = _ttCurrentTarget();
  const isPermanent = weekKey === 'permanent';

  let targetLabel = _ttSelectedClass;
  if (scope === 'student') {
    const found = _msgStudentCache.find(s => s.id === _ttSelectedStudentUid);
    targetLabel = found ? found.name : _ttSelectedStudentUid;
  } else if (scope === 'group') {
    targetLabel = (_ttSelectedGroupName || '').trim();
  }

  const confirmMsg = isPermanent
    ? `Delete the permanent timetable for ${targetLabel}?`
    : `Delete timetable for ${targetLabel} — ${weekKey}? This cannot be undone.`;
  const ok = await UI.confirmAction(confirmMsg);
  if (!ok) return;

  try {
    await Db().collection(col).doc(docId).update({
      [`timetables.${weekKey}`]: firebase.firestore.FieldValue.delete(),
    });
    UI.toast(isPermanent ? 'Permanent timetable deleted.' : 'Timetable deleted.', 'success');
    if (weekKey === _ttSelectedWeek) _ttClearDraft();
    _ttRenderEditor();
  } catch (err) {
    console.error('[timetable] delete error:', err);
    UI.toast('Failed to delete timetable.', 'error');
  }
}

  // ═══════════════════════════════════════════════════════════
  //  END WEEKLY TIMETABLE MANAGER
  // ═══════════════════════════════════════════════════════════

  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function Db() { return window.fbDb; }

  function _loadJsPDF() {
    return new Promise((resolve, reject) => {
      if (window.jspdf && window.jspdf.jsPDF) { resolve(window.jspdf.jsPDF); return; }

      function loadScript(src) {
        return new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = src; s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }

      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
        .then(() => loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'))
        .then(() => resolve(window.jspdf.jsPDF))
        .catch(reject);
    });
  }

  async function exportTaskReportPDF(docId) {
    if (!docId) return;

    UI.toast('Generating PDF report…', 'info', 3000);

    let jsPDF;
    try {
      jsPDF = await _loadJsPDF();
    } catch (e) {
      UI.toast('Could not load PDF library. Check your internet connection.', 'error');
      return;
    }

    let taskDoc;
    try {
      const snap = await Db().collection('coachingTasks').doc(docId).get();
      if (!snap.exists) { UI.toast('Task not found.', 'error'); return; }
      taskDoc = snap.data();
    } catch (e) {
      console.error('[teacher] exportTaskReportPDF fetch error:', e);
      UI.toast('Failed to fetch task data.', 'error');
      return;
    }

    const todayStr = (window.Tasks && Tasks._localDateStr) ? Tasks._localDateStr() : (() => {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    })();

    const allDates = (window.Tasks && Tasks._resolveTaskDates)
      ? Tasks._resolveTaskDates(taskDoc, { upToDate: todayStr })
      : (taskDoc.dates || []).filter(d => d <= todayStr);

    function getStudentsForDocId(id) {
      if (id === 'global' || id === 'weekly') return _msgStudentCache;
      if (id.startsWith('weekly_class_')) {
        const cls = id.replace('weekly_class_', '');
        return _msgStudentCache.filter(s => s.cls.replace(/\s+/g,'').toLowerCase() === cls);
      }
      if (id.startsWith('weekly_student_')) {
        const uid = id.replace('weekly_student_', '');
        return _msgStudentCache.filter(s => s.id === uid);
      }
      if (id.startsWith('class_')) {
        const cls = id.replace('class_', '');
        return _msgStudentCache.filter(s => s.cls.replace(/\s+/g,'').toLowerCase() === cls);
      }
      if (id.startsWith('student_')) {
        const uid = id.replace('student_', '');
        return _msgStudentCache.filter(s => s.id === uid);
      }
      return [];
    }

    const students = getStudentsForDocId(docId);

    function fmtDate(str) {
      if (!str) return '-';
      const p = str.split('-');
      return new Date(+p[0], +p[1]-1, +p[2]).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
    }
    function fmtDateShort(str) {
      if (!str) return '-';
      const p = str.split('-');
      return new Date(+p[0], +p[1]-1, +p[2]).toLocaleDateString('en-GB', { day:'numeric', month:'short' });
    }
    function fmtDuration(ms) {
      if (!ms) return 'Default (2 hrs)';
      const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000);
      if (h===0) return m + ' min';
      if (m===0) return h + ' hr';
      return h + ' hr ' + m + ' min';
    }
    function scopeText(id) {
      if (id === 'global' || id === 'weekly') return 'All Students';
      if (id.startsWith('weekly_class_') || id.startsWith('class_')) {
        const cls = id.replace('weekly_class_','').replace('class_','');
        return 'Class: ' + cls.toUpperCase();
      }
      if (id.startsWith('weekly_student_') || id.startsWith('student_')) {
        const uid = id.replace('weekly_student_','').replace('student_','');
        const s = _msgStudentCache.find(x => x.id === uid);
        return 'Student: ' + (s ? s.name : uid);
      }
      return id;
    }
    function recurrenceText(d) {
      if (!d.recurrence || d.recurrence === 'once') return 'One-time';
      if (d.recurrence === 'weekly') return 'Weekly (recurring)';
      if (d.recurrence === 'range') return 'Date range';
      return d.recurrence;
    }

    const studentStats = students.map(s => {
      const comp = s.coachingCompleted || {};
      const done = allDates.filter(d => !!comp[d]).length;
      const pastOnly = allDates.filter(d => d < todayStr);
      const missed = pastOnly.filter(d => !comp[d]).length;
      const pct = allDates.length > 0 ? Math.round((done / allDates.length) * 100) : 0;
      return { ...s, done, missed, total: allDates.length, pct, comp };
    }).sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));

    const cohortDone     = studentStats.reduce((n, s) => n + s.done, 0);
    const cohortPossible = studentStats.length * allDates.length;
    const cohortPct      = cohortPossible > 0 ? Math.round((cohortDone / cohortPossible) * 100) : 0;

    const byClass = {};
    studentStats.forEach(s => {
      if (!byClass[s.cls]) byClass[s.cls] = { done:0, total:0, count:0 };
      byClass[s.cls].done  += s.done;
      byClass[s.cls].total += s.total;
      byClass[s.cls].count++;
    });

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const PAGE_W    = 210;
    const PAGE_H    = 297;
    const MARGIN    = 14;
    const CONTENT_W = PAGE_W - MARGIN * 2;

    const C = {
      brand:       [59, 91, 219],
      brandLight:  [237, 242, 255],
      brandBorder: [186, 200, 255],
      success:     [47, 158, 68],
      successBg:   [235, 251, 238],
      danger:      [224, 49, 49],
      dangerBg:    [255, 245, 245],
      warning:     [232, 137, 12],
      warningBg:   [255, 249, 219],
      text:        [17, 24, 39],
      textSec:     [55, 65, 81],
      textTert:    [107, 114, 128],
      textDis:     [156, 163, 175],
      border:      [229, 231, 235],
      surface:     [255, 255, 255],
      surfaceMuted:[243, 244, 246],
      purple:      [124, 58, 237],
      purpleBg:    [245, 243, 255],
    };

    let y = 0;

    function checkPage(needed) {
      if (y + needed > PAGE_H - 16) {
        doc.addPage();
        y = MARGIN;
        _drawPageFooter();
      }
    }

    function fillRect(x, ry, w, h, color, stroke) {
      doc.setFillColor(...color);
      if (stroke) { doc.setDrawColor(...stroke); doc.roundedRect(x, ry, w, h, 2, 2, 'FD'); }
      else { doc.roundedRect(x, ry, w, h, 2, 2, 'F'); }
    }

    // Draws a real filled progress bar using jsPDF drawing primitives — no Unicode
    function drawProgressBar(x, ry, w, h, pct, filledColor) {
      const radius = h / 2;
      // Track (background)
      doc.setFillColor(...C.border);
      doc.roundedRect(x, ry, w, h, radius, radius, 'F');
      // Fill
      if (pct > 0) {
        const fillW = Math.max(w * pct / 100, h); // minimum fill = diameter so it stays rounded
        doc.setFillColor(...filledColor);
        doc.roundedRect(x, ry, fillW, h, radius, radius, 'F');
      }
    }

    function _drawPageHeader() {
      doc.setFillColor(...C.brand);
      doc.rect(0, 0, PAGE_W, 22, 'F');

      doc.setFillColor(255,255,255);
      doc.roundedRect(MARGIN, 5, 12, 12, 2, 2, 'F');
      doc.setTextColor(...C.brand);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('V', MARGIN + 6, 13.5, { align: 'center' });

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Vertex Tutorial CBT', MARGIN + 16, 12.5);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text('COACHING TASK REPORT', PAGE_W - MARGIN, 9, { align: 'right' });
      doc.text('Generated: ' + new Date().toLocaleString('en-GB', { dateStyle:'medium', timeStyle:'short' }), PAGE_W - MARGIN, 14, { align: 'right' });

      y = 28;
    }

    function _drawPageFooter() {
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, PAGE_H - 10, PAGE_W - MARGIN, PAGE_H - 10);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.textDis);
      doc.text('Vertex Tutorial CBT - Confidential Report', MARGIN, PAGE_H - 5.5);
      doc.text('Page ' + doc.internal.getNumberOfPages(), PAGE_W - MARGIN, PAGE_H - 5.5, { align: 'right' });
    }

    function sectionHeading(text) {
      checkPage(14);
      doc.setFillColor(...C.surfaceMuted);
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1.5, 1.5, 'FD');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.brand);
      doc.text(text.toUpperCase(), MARGIN + 4, y + 5.3);
      y += 11;
    }

    function kvRow(label, value, accent) {
      checkPage(8);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.textTert);
      doc.text(label, MARGIN + 2, y + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...(accent || C.text));
      doc.text(String(value), MARGIN + 48, y + 4.5);
      y += 6.5;
    }

    function pctColor(pct) {
      if (pct >= 80) return C.success;
      if (pct >= 50) return C.warning;
      return C.danger;
    }

    // ── PAGE 1 HEADER ──────────────────────────────────────────────
    _drawPageHeader();

    // Title card
    fillRect(MARGIN, y, CONTENT_W, 28, C.brandLight, C.brandBorder);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.brand);
    const titleLines = doc.splitTextToSize(taskDoc.title || 'Untitled Task', CONTENT_W - 30);
    doc.text(titleLines, MARGIN + 5, y + 9);

    const badgeX = PAGE_W - MARGIN - 30;
    if (taskDoc.active) {
      fillRect(badgeX, y + 4, 26, 7, C.success);
      doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
      doc.text('ACTIVE', badgeX + 13, y + 8.8, { align:'center' });
    } else {
      fillRect(badgeX, y + 4, 26, 7, C.surfaceMuted, C.border);
      doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...C.textDis);
      doc.text('INACTIVE', badgeX + 13, y + 8.8, { align:'center' });
    }

    const recTxt = recurrenceText(taskDoc);
    const isRec  = taskDoc.recurrence && taskDoc.recurrence !== 'once';
    fillRect(MARGIN + 5, y + 18, 40, 6, isRec ? C.purpleBg : C.surfaceMuted);
    doc.setFontSize(7); doc.setFont('helvetica','bold');
    doc.setTextColor(...(isRec ? C.purple : C.textTert));
    doc.text((isRec ? 'RECURRING  ' : '') + recTxt, MARGIN + 7, y + 22.2);

    y += 32;

    // ── TASK DETAILS ───────────────────────────────────────────────
    sectionHeading('Task Details');
    kvRow('Scope',      scopeText(docId));
    kvRow('Recurrence', recurrenceText(taskDoc));
    kvRow('Status',     taskDoc.active ? 'Active (visible to students)' : 'Inactive', taskDoc.active ? C.success : C.textDis);
    kvRow('Duration',   fmtDuration(taskDoc.durationMs));
    kvRow('Sessions',   allDates.length + ' scheduled (to date)');
    kvRow('Students',   students.length + ' enrolled');

    if (taskDoc.message) {
      checkPage(18);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.textTert);
      doc.text('Task Message', MARGIN + 2, y + 4);
      y += 6;
      const msgLines = doc.splitTextToSize(taskDoc.message, CONTENT_W - 10);
      const msgH = msgLines.length * 4.5 + 5;
      checkPage(msgH + 4);
      fillRect(MARGIN, y, CONTENT_W, msgH, C.surfaceMuted, C.border);
      doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...C.textSec);
      doc.text(msgLines, MARGIN + 4, y + 4.5);
      y += msgH + 4;
    }

    y += 2;

    // ── TIMETABLE ─────────────────────────────────────────────────
    sectionHeading('Timetable & Schedule');

    if (taskDoc.recurrence && taskDoc.recurrence !== 'once') {
      kvRow('Start Date', taskDoc.startDate ? fmtDate(taskDoc.startDate) : '-');
      kvRow('End Date',   taskDoc.endDate   ? fmtDate(taskDoc.endDate)   : 'Open-ended');
      kvRow('Active Days', (taskDoc.weeklyDays && taskDoc.weeklyDays.length > 0)
        ? taskDoc.weeklyDays.join(', ')
        : taskDoc.recurrence === 'range' ? 'All calendar days' : '-');
    }

    if (allDates.length > 0) {
      checkPage(14);
      doc.setFontSize(7.5);
      doc.setFont('helvetica','bold');
      doc.setTextColor(...C.textTert);
      doc.text('Scheduled Sessions to Date (' + allDates.length + ' total)', MARGIN + 2, y + 4);
      y += 7;

      const COLS = 4;
      const colW = CONTENT_W / COLS;
      const chunks = [];
      for (let i = 0; i < allDates.length; i += COLS) chunks.push(allDates.slice(i, i + COLS));

      const rowH = 8;

      chunks.forEach((row, ri) => {
        checkPage(rowH + 2);
        row.forEach((dateStr, ci) => {
          const cx = MARGIN + ci * colW;
          const ry2 = y;
          const isPast  = dateStr < todayStr;
          const isToday = dateStr === todayStr;

          const completedCount = studentStats.filter(s => !!s.comp[dateStr]).length;
          const allDone = completedCount === studentStats.length && studentStats.length > 0;

          const bgColor     = isToday ? C.warningBg : allDone ? C.successBg : isPast ? C.surfaceMuted : C.surface;
          const borderColor = isToday ? C.warning   : allDone ? C.success   : C.border;

          fillRect(cx + 1, ry2, colW - 2, rowH - 1, bgColor, borderColor);

          doc.setFontSize(6.5); doc.setFont('helvetica','bold');
          doc.setTextColor(...(isToday ? C.warning : allDone ? C.success : C.text));
          doc.text(fmtDateShort(dateStr), cx + 3, ry2 + 4);

          doc.setFontSize(5.5); doc.setFont('helvetica','normal');
          doc.setTextColor(...C.textTert);
          doc.text(completedCount + '/' + studentStats.length + ' done', cx + 3, ry2 + 7);
        });
        y += rowH;
      });

      y += 4;
    }

    // ── SUBJECT RESTRICTIONS ───────────────────────────────────────
    const dsKeys = Object.keys(taskDoc.dateSubjects || {});
    if (dsKeys.length > 0) {
      sectionHeading('Subject Restrictions');
      const subjRows = dsKeys.map(k => [
        k.match(/^\d{4}-\d{2}-\d{2}$/) ? fmtDate(k) : k,
        (taskDoc.dateSubjects[k] || []).join(', ') || 'None'
      ]);
      doc.autoTable({
        startY: y,
        head: [['Date / Day', 'Required Subjects']],
        body: subjRows,
        margin: { left: MARGIN, right: MARGIN },
        headStyles: {
          fillColor: C.brand,
          textColor: [255,255,255],
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: { top:3, bottom:3, left:4, right:4 },
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: C.text,
          cellPadding: { top:2.5, bottom:2.5, left:4, right:4 },
        },
        alternateRowStyles: { fillColor: C.surfaceMuted },
        tableLineColor: C.border,
        tableLineWidth: 0.2,
        theme: 'grid',
      });
      y = doc.lastAutoTable.finalY + 6;
    }

    _drawPageFooter();

    // ── PAGE 2: STUDENT ATTENDANCE & PROGRESS ─────────────────────
    doc.addPage();
    _drawPageHeader();
    _drawPageFooter();

    sectionHeading('Student Attendance & Progress');

    // Cohort summary stat bar
    checkPage(24);
    fillRect(MARGIN, y, CONTENT_W, 20, C.brandLight, C.brandBorder);

    const statCols = [
      { label:'Students Enrolled', value: students.length,    color: C.brand   },
      { label:'Sessions to Date',  value: allDates.length,    color: C.brand   },
      { label:'Total Completions', value: cohortDone,         color: C.success },
      { label:'Cohort Attendance', value: cohortPct + '%',    color: pctColor(cohortPct) },
    ];
    const sw = CONTENT_W / statCols.length;
    statCols.forEach((sc, i) => {
      const sx = MARGIN + i * sw;
      if (i > 0) {
        doc.setDrawColor(...C.brandBorder);
        doc.setLineWidth(0.3);
        doc.line(sx, y + 3, sx, y + 17);
      }
      doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(...sc.color);
      doc.text(String(sc.value), sx + sw/2, y + 11, { align:'center' });
      doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(...C.textTert);
      doc.text(sc.label, sx + sw/2, y + 17, { align:'center' });
    });
    y += 24;

    // ── MAIN ATTENDANCE TABLE ──────────────────────────────────────
    // Show up to 10 most recent date columns
    const MAX_DATE_COLS = 10;
    const displayDates  = allDates.slice(-MAX_DATE_COLS);
    const hasMore       = allDates.length > MAX_DATE_COLS;

    // Date column headers: short day + date e.g. "F 7/3"
    const dateHeaders = displayDates.map(d => {
      const p  = d.split('-');
      const dt = new Date(+p[0], +p[1]-1, +p[2]);
      const dayInitial = dt.toLocaleDateString('en-GB', { weekday:'narrow' });
      const dayNum     = dt.getDate();
      const month      = dt.getMonth() + 1;
      return dayInitial + '\n' + dayNum + '/' + month;
    });

    // Progress column is drawn via willDrawCell — the cell text carries the numeric pct
    // Status dot columns use plain ASCII: Y (done), N (missed), - (upcoming/today)
    const tableHead = [['#', 'Student', 'Class', 'Done', 'Miss', '%', 'Progress', ...dateHeaders]];

    const PROGRESS_COL_IDX = 6; // 0-based index of the "Progress" column
    const FIRST_DATE_COL   = 7;

    const tableBody = studentStats.map((s, idx) => {
      // Status dots: Y / N / - only (ASCII — renders perfectly in Helvetica)
      const dateDots = displayDates.map(d => {
        if (s.comp[d])          return 'Y';   // completed
        if (d < todayStr)       return 'N';   // past, not done
        if (d === todayStr)     return 'O';   // today, not done yet
        return '-';                            // future
      });
      return [
        String(idx + 1),
        s.name,
        s.cls || '-',
        String(s.done),
        String(s.missed),
        s.pct + '%',
        String(s.pct),   // numeric string — willDrawCell draws the bar, hides this text
        ...dateDots
      ];
    });

    doc.autoTable({
      startY: y,
      head: tableHead,
      body: tableBody,
      margin: { left: MARGIN, right: MARGIN },
      headStyles: {
        fillColor: C.brand,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 6,
        cellPadding: { top:2, bottom:2, left:2, right:2 },
        halign: 'center',
        valign: 'middle',
      },
      columnStyles: {
        0: { cellWidth: 7,  halign:'center', fontSize: 6 },
        1: { cellWidth: 30, halign:'left',   fontStyle:'bold', fontSize: 7 },
        2: { cellWidth: 16, halign:'left',   fontSize: 6.5 },
        3: { cellWidth: 9,  halign:'center', fontSize: 7 },
        4: { cellWidth: 9,  halign:'center', fontSize: 7 },
        5: { cellWidth: 10, halign:'center', fontStyle:'bold', fontSize: 7 },
        6: { cellWidth: 24, halign:'left',   fontSize: 1 }, // text hidden; bar drawn in willDrawCell
      },
      bodyStyles: {
        fontSize: 6,
        textColor: C.text,
        cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
        valign: 'middle',
      },
      alternateRowStyles: { fillColor: C.surfaceMuted },
      tableLineColor: C.border,
      tableLineWidth: 0.2,
      theme: 'grid',
      didDrawCell: function(data) {
        if (data.section !== 'body') return;

        // ── Progress bar (column 6) ──────────────────────────────
        if (data.column.index === PROGRESS_COL_IDX) {
          const pct    = parseInt(data.cell.raw, 10) || 0;
          const color  = pctColor(pct);
          const pad    = 2;
          const barX   = data.cell.x + pad;
          const barW   = data.cell.width - pad * 2;
          const barH   = 3;
          const barY   = data.cell.y + (data.cell.height - barH) / 2;
          // Track
          doc.setFillColor(...C.border);
          doc.roundedRect(barX, barY, barW, barH, barH/2, barH/2, 'F');
          // Fill
          if (pct > 0) {
            const fillW = Math.max(barW * pct / 100, barH);
            doc.setFillColor(...color);
            doc.roundedRect(barX, barY, fillW, barH, barH/2, barH/2, 'F');
          }
          // Percentage label centered on bar
          doc.setFontSize(5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(pct > 55 ? 255 : color[0], pct > 55 ? 255 : color[1], pct > 55 ? 255 : color[2]);
          doc.text(pct + '%', barX + barW / 2, barY + barH - 0.6, { align:'center' });
        }

        // ── Date status dots (columns 7+) ────────────────────────
        if (data.column.index >= FIRST_DATE_COL) {
          const txt  = (data.cell.raw || '').toString().trim();
          const cx   = data.cell.x + data.cell.width / 2;
          const cy   = data.cell.y + data.cell.height / 2;
          const r    = 2.2;

          if (txt === 'Y') {
            doc.setFillColor(...C.success);
            doc.circle(cx, cy, r, 'F');
            doc.setFontSize(5.5); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
            doc.text('Y', cx, cy + 1.8, { align:'center' });
          } else if (txt === 'N') {
            doc.setFillColor(...C.danger);
            doc.circle(cx, cy, r, 'F');
            doc.setFontSize(5.5); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
            doc.text('N', cx, cy + 1.8, { align:'center' });
          } else if (txt === 'O') {
            doc.setDrawColor(...C.warning);
            doc.setLineWidth(0.5);
            doc.circle(cx, cy, r, 'S');
            doc.setFontSize(5); doc.setFont('helvetica','normal'); doc.setTextColor(...C.warning);
            doc.text('O', cx, cy + 1.8, { align:'center' });
          } else {
            // future: small grey dash
            doc.setDrawColor(...C.border);
            doc.setLineWidth(0.4);
            doc.line(cx - 1.5, cy, cx + 1.5, cy);
          }
        }

        // ── Colour %  column (col 5) ────────────────────────────
        if (data.column.index === 5) {
          const pct = parseInt(data.cell.raw, 10) || 0;
          // Re-draw the text in the correct colour (autoTable draws it black first)
          doc.setFillColor(...(data.row.index % 2 === 0 ? C.surface : C.surfaceMuted));
          doc.rect(data.cell.x + 0.1, data.cell.y + 0.1, data.cell.width - 0.2, data.cell.height - 0.2, 'F');
          doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...pctColor(pct));
          doc.text(pct + '%', data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 2, { align:'center' });
        }

        // ── Colour Done / Miss columns (cols 3 & 4) ─────────────
        if (data.column.index === 3 || data.column.index === 4) {
          const val = parseInt(data.cell.raw, 10) || 0;
          if (val > 0) {
            const color = data.column.index === 3 ? C.success : C.danger;
            doc.setFillColor(...(data.row.index % 2 === 0 ? C.surface : C.surfaceMuted));
            doc.rect(data.cell.x + 0.1, data.cell.y + 0.1, data.cell.width - 0.2, data.cell.height - 0.2, 'F');
            doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...color);
            doc.text(String(val), data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 2, { align:'center' });
          }
        }
      },
    });

    y = doc.lastAutoTable.finalY + 4;

    if (hasMore) {
      checkPage(8);
      doc.setFontSize(7); doc.setFont('helvetica','italic'); doc.setTextColor(...C.textTert);
      doc.text(
        '* Showing most recent ' + MAX_DATE_COLS + ' sessions. ' + (allDates.length - MAX_DATE_COLS) + ' earlier session(s) omitted from date columns but included in totals.',
        MARGIN, y + 4
      );
      y += 8;
    }

    // ── CLASS BREAKDOWN ────────────────────────────────────────────
    const classKeys = Object.keys(byClass);
    if (classKeys.length > 1) {
      checkPage(20);
      y += 4;
      sectionHeading('Class Breakdown');

      doc.autoTable({
        startY: y,
        head: [['Class', 'Students', 'Sessions', 'Total Done', 'Attendance %']],
        body: classKeys.sort().map(cls => {
          const b   = byClass[cls];
          const pct = b.total > 0 ? Math.round((b.done / b.total) * 100) : 0;
          return [cls || '-', String(b.count), String(b.total / b.count | 0), String(b.done), pct + '%'];
        }),
        margin: { left: MARGIN, right: MARGIN },
        headStyles: {
          fillColor: C.brand,
          textColor: [255,255,255],
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: { top:3, bottom:3, left:4, right:4 },
        },
        bodyStyles: {
          fontSize: 7.5,
          cellPadding: { top:2.5, bottom:2.5, left:4, right:4 },
        },
        columnStyles: {
          0: { fontStyle:'bold' },
          4: { fontStyle:'bold' },
        },
        alternateRowStyles: { fillColor: C.surfaceMuted },
        tableLineColor: C.border,
        tableLineWidth: 0.2,
        theme: 'grid',
        didDrawCell: function(data) {
          if (data.column.index === 4 && data.section === 'body') {
            const pct = parseInt(data.cell.raw, 10) || 0;
            doc.setFillColor(...(data.row.index % 2 === 0 ? C.surface : C.surfaceMuted));
            doc.rect(data.cell.x + 0.1, data.cell.y + 0.1, data.cell.width - 0.2, data.cell.height - 0.2, 'F');
            doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(...pctColor(pct));
            doc.text(pct + '%', data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 2.5, { align:'center' });
          }
        },
      });
      y = doc.lastAutoTable.finalY + 4;
    }

    // ── PER-STUDENT DETAIL PAGES ───────────────────────────────────
    if (allDates.length > 0 && studentStats.length <= 30) {
      studentStats.forEach((s) => {
        doc.addPage();
        _drawPageHeader();
        _drawPageFooter();

        // Student header card
        fillRect(MARGIN, y, CONTENT_W, 22, C.brandLight, C.brandBorder);
        doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(...C.brand);
        doc.text(s.name, MARGIN + 5, y + 9);
        doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(...C.textSec);
        doc.text(s.cls || '-', MARGIN + 5, y + 15);

        // Stat pills
        const pills = [
          { label:'Done',    value: s.done,      color: C.success      },
          { label:'Missed',  value: s.missed,    color: C.danger       },
          { label:'Total',   value: s.total,     color: C.brand        },
          { label:'Rate',    value: s.pct + '%', color: pctColor(s.pct) },
        ];
        pills.forEach((p, pi) => {
          const px = MARGIN + 70 + pi * 32;
          fillRect(px, y + 4, 28, 13, C.surface, C.border);
          doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...p.color);
          doc.text(String(p.value), px + 14, y + 12, { align:'center' });
          doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(...C.textTert);
          doc.text(p.label, px + 14, y + 16, { align:'center' });
        });

        y += 26;

        // Attendance progress bar
        checkPage(10);
        doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...C.textTert);
        doc.text('ATTENDANCE PROGRESS', MARGIN, y + 4);
        doc.setTextColor(...pctColor(s.pct));
        doc.text(s.pct + '%', PAGE_W - MARGIN, y + 4, { align:'right' });
        y += 6;
        drawProgressBar(MARGIN, y, CONTENT_W, 4, s.pct, pctColor(s.pct));
        y += 9;

        sectionHeading('Session Log - ' + s.name);

        // Session log table: status as plain text labels, no Unicode
        const sessionRows = allDates.map((dateStr, i) => {
          const done    = !!s.comp[dateStr];
          const isPast  = dateStr < todayStr;
          const isToday = dateStr === todayStr;
          // Plain ASCII status text
          const status  = done    ? 'Done'
                        : isToday ? 'Today'
                        : isPast  ? 'Missed'
                        : 'Upcoming';
          const p2 = dateStr.split('-');
          const dayName = new Date(+p2[0], +p2[1]-1, +p2[2]).toLocaleDateString('en-GB', { weekday:'long' });
          const subjList = (taskDoc.dateSubjects || {})[dateStr] || (taskDoc.dateSubjects || {})[dayName] || [];
          return [
            String(i + 1),
            dayName,
            fmtDate(dateStr),
            subjList.join(', ') || 'No restriction',
            status,
          ];
        });

        doc.autoTable({
          startY: y,
          head: [['#', 'Day', 'Date', 'Required Subjects', 'Status']],
          body: sessionRows,
          margin: { left: MARGIN, right: MARGIN },
          headStyles: {
            fillColor: C.brand,
            textColor: [255,255,255],
            fontStyle: 'bold',
            fontSize: 7.5,
            cellPadding: { top:3, bottom:3, left:3, right:3 },
          },
          columnStyles: {
            0: { cellWidth: 8,  halign:'center', fontSize:7 },
            1: { cellWidth: 26, fontSize:7.5 },
            2: { cellWidth: 38, fontSize:7.5 },
            3: { cellWidth: 50, fontSize:7 },
            4: { cellWidth: 30, fontStyle:'bold', halign:'center', fontSize:7.5 },
          },
          bodyStyles: {
            fontSize: 7,
            cellPadding: { top:2.5, bottom:2.5, left:3, right:3 },
          },
          alternateRowStyles: { fillColor: C.surfaceMuted },
          tableLineColor: C.border,
          tableLineWidth: 0.2,
          theme: 'grid',
          didDrawCell: function(data) {
            if (data.column.index === 4 && data.section === 'body') {
              const txt   = (data.cell.raw || '').toString();
              const color = txt === 'Done'     ? C.success
                          : txt === 'Missed'   ? C.danger
                          : txt === 'Today'    ? C.warning
                          : C.textDis;
              // Repaint cell background then re-draw coloured text
              doc.setFillColor(...(data.row.index % 2 === 0 ? C.surface : C.surfaceMuted));
              doc.rect(data.cell.x + 0.1, data.cell.y + 0.1, data.cell.width - 0.2, data.cell.height - 0.2, 'F');
              doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...color);
              doc.text(txt, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 2.3, { align:'center' });
            }
          },
        });

        y = doc.lastAutoTable.finalY + 6;
      });
    }

    // ── SAVE ──────────────────────────────────────────────────────
    const safeName  = (taskDoc.title || 'task').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStamp = todayStr.replace(/-/g,'');
    doc.save('vtx_report_' + safeName + '_' + dateStamp + '.pdf');
    UI.toast('PDF report downloaded.', 'success');
  }

async function exportResultPDF(resultId) {
    if (!resultId) return;

    UI.toast('Generating PDF report…', 'info', 3000);

    let jsPDF;
    try {
      jsPDF = await _loadJsPDF();
    } catch (e) {
      UI.toast('Could not load PDF library. Check your internet connection.', 'error');
      return;
    }

    let r;
    try {
      const snap = await Db().collection('results').doc(resultId).get();
      if (!snap.exists) { UI.toast('Result not found.', 'error'); return; }
      r = snap.data();
    } catch (e) {
      console.error('[teacher] exportResultPDF fetch error:', e);
      UI.toast('Failed to fetch result data.', 'error');
      return;
    }

    // ── Strip LaTeX/KaTeX math delimiters and convert to readable plain text ──
    function _stripLatex(str) {
      if (str == null) return '';
      return String(str)
        // Display math: $$...$$ or \[...\]
        .replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => m.trim())
        .replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => m.trim())
        // Inline math: $...$ or \(...\)
        .replace(/\$([\s\S]*?)\$/g, (_, m) => m.trim())
        .replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => m.trim())
        // Common LaTeX commands to readable text
        .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
        .replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)')
        .replace(/\\sqrt\s/g, 'sqrt ')
        .replace(/\^2/g, '²')
        .replace(/\^3/g, '³')
        .replace(/\^\{([^}]*)\}/g, '^($1)')
        .replace(/\_\{([^}]*)\}/g, '_($1)')
        .replace(/\\times/g, '×')
        .replace(/\\div/g, '÷')
        .replace(/\\pm/g, '±')
        .replace(/\\leq/g, '≤')
        .replace(/\\geq/g, '≥')
        .replace(/\\neq/g, '≠')
        .replace(/\\approx/g, '≈')
        .replace(/\\cdot/g, '·')
        .replace(/\\pi/g, 'π')
        .replace(/\\alpha/g, 'α')
        .replace(/\\beta/g, 'β')
        .replace(/\\theta/g, 'θ')
        .replace(/\\Delta/g, 'Δ')
        .replace(/\\implies/g, '⟹')
        .replace(/\\text\{([^}]*)\}/g, '$1')
        .replace(/\\mathbf\{([^}]*)\}/g, '$1')
        .replace(/\\mathrm\{([^}]*)\}/g, '$1')
        .replace(/\{|\}/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function _pdfText(str) {
      if (str == null) return '';
      return _stripLatex(String(str)).replace(/\s+/g, ' ').trim();
    }

    // ── PascalCase file naming (no underscores or hyphens) ──
    function _toPascalCase(str) {
      return (str || '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const PAGE_W    = 210;
    const PAGE_H    = 297;
    const MARGIN    = 16;
    const CONTENT_W = PAGE_W - MARGIN * 2;

    const C = {
      text:    [30, 30, 30],
      muted:   [120, 120, 120],
      faint:   [165, 165, 165],
      divider: [222, 222, 222],
      accent:  [59, 91, 219],
      success: [34, 140, 60],
      danger:  [200, 45, 45],
      warning: [190, 130, 10],
    };

    function pctColor(pct) {
      if (pct >= 75) return C.success;
      if (pct >= 50) return C.warning;
      return C.danger;
    }

    let y = 0;

    function _drawPageHeader() {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.muted);
      doc.text('VERTEX TUTORIAL CBT', MARGIN, 12);

      doc.setFont('helvetica', 'normal');
      doc.text('Exam Result Report', PAGE_W - MARGIN, 10, { align: 'right' });
      doc.setFontSize(6.5);
      doc.setTextColor(...C.faint);
      doc.text(
        'Generated ' + new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
        PAGE_W - MARGIN, 14, { align: 'right' }
      );

      doc.setDrawColor(...C.divider);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, 17, PAGE_W - MARGIN, 17);

      y = 25;
    }

    function _drawPageFooter() {
      doc.setDrawColor(...C.divider);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.faint);
      doc.text('Vertex Tutorial CBT — Confidential', MARGIN, PAGE_H - 7);
      doc.text('Page ' + doc.internal.getNumberOfPages(), PAGE_W - MARGIN, PAGE_H - 7, { align: 'right' });
    }

    function checkPage(needed) {
      if (y + needed > PAGE_H - 16) {
        doc.addPage();
        _drawPageHeader();
        _drawPageFooter();
      }
    }

    function divider() {
      doc.setDrawColor(...C.divider);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 5;
    }

    // ── PAGE 1 ──────────────────────────────────────────────────
    _drawPageHeader();
    _drawPageFooter();

    // Student name
    doc.setFontSize(17);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.text);
    doc.text(_pdfText(r.name) || 'Unnamed Student', MARGIN, y);
    y += 7;

    // Meta line: class / school (left) — date (right)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    const metaLeft = [r.class, r.school].filter(Boolean).map(_pdfText).join('   ·   ');
    doc.text(metaLeft, MARGIN, y);

    const ts = r.timestamp
      ? new Date(r.timestamp.toDate ? r.timestamp.toDate() : r.timestamp)
          .toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
      : '—';
    doc.text(ts, PAGE_W - MARGIN, y, { align: 'right' });
    y += 8;

    divider();

    // ── OVERALL SCORE + SUBJECT TABLE ─────────────────────────────
    const pct      = r.percentage || 0;
    const gradeClr = pctColor(pct);
    const subjects = r.subjects || [];
    const blockStartY = y;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.muted);
    doc.text('OVERALL SCORE', MARGIN, blockStartY);

    doc.setFontSize(30);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...gradeClr);
    doc.text(pct + '%', MARGIN, blockStartY + 17);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.text);
    doc.text('Grade ' + (r.grade || '—'), MARGIN, blockStartY + 23);

    let rightBlockH = 0;
    if (subjects.length > 0) {
      const tblX = MARGIN + 55;
      const tblW = CONTENT_W - 55;
      let ty = blockStartY + 2;

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.muted);
      doc.text('SUBJECT', tblX, ty);
      doc.text('SCORE', tblX + tblW, ty, { align: 'right' });
      ty += 4;
      doc.setDrawColor(...C.divider);
      doc.setLineWidth(0.2);
      doc.line(tblX, ty, tblX + tblW, ty);
      ty += 5;

      subjects.forEach(subj => {
        const sp    = r.scores?.[subj] ?? 0;
        const cc    = r.correctCounts?.[subj];
        const total = (r.questionSnapshots?.[subj] || []).length;

        // Subject name — wrap if needed
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.text);
        const subjLabel = _pdfText(subj);
        const subjLines = doc.splitTextToSize(subjLabel, tblW - 40);
        doc.text(subjLines, tblX, ty);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...pctColor(sp));
        const scoreLabel = sp + '%' + (cc != null && total ? '  (' + cc + '/' + total + ')' : '');
        doc.text(scoreLabel, tblX + tblW, ty, { align: 'right' });
        ty += subjLines.length * 5.5;
      });

      rightBlockH = ty - blockStartY;
    }

    y = blockStartY + Math.max(28, rightBlockH) + 6;
    divider();

    // ── NO DETAILED DATA FALLBACK ─────────────────────────────────
    if (!r.questionSnapshots) {
      checkPage(20);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...C.muted);
      const noteLines = doc.splitTextToSize(
        'A detailed question-by-question breakdown is not available for this result. ' +
        'It was submitted before per-question tracking was introduced.',
        CONTENT_W
      );
      doc.text(noteLines, MARGIN, y + 4);

      const safeName = _toPascalCase(r.name || 'Student');
      doc.save('VtxResult' + safeName + '.pdf');
      UI.toast('PDF downloaded.', 'success');
      return;
    }

    // ── QUESTION BREAKDOWN ───────────────────────────────────────
    checkPage(12);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.muted);
    doc.text('QUESTION BREAKDOWN', MARGIN, y);
    y += 8;

    subjects.forEach(subj => {
      const qs = r.questionSnapshots[subj] || [];
      if (qs.length === 0) return;

      const correctCount = r.correctCounts?.[subj] ?? qs.filter(q => q.chosen === q.ans).length;
      const subjPct      = r.scores?.[subj] ?? 0;

      checkPage(14);
      doc.setFontSize(11.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.accent);
      doc.text(_pdfText(subj), MARGIN, y);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...pctColor(subjPct));
      doc.text(correctCount + '/' + qs.length + ' correct   ·   ' + subjPct + '%', PAGE_W - MARGIN, y, { align: 'right' });
      y += 3;
      doc.setDrawColor(...C.accent);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 6;

      qs.forEach((q, i) => {
        const isSkipped = q.chosen === null || q.chosen === undefined;
        const isCorrect = !isSkipped && q.chosen === q.ans;
        const statusWord  = isCorrect ? 'Correct' : isSkipped ? 'Skipped' : 'Incorrect';
        const statusColor = isCorrect ? C.success : isSkipped ? C.faint : C.danger;

        // Clean all text through _pdfText which strips LaTeX
        const qText  = _pdfText(q.q || '');
        // IMPORTANT: set the exact font size/style that will be used to DRAW this text
        // before measuring the wrap width, otherwise splitTextToSize measures against
        // the wrong font and the drawn text overflows the page margin.
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const qLines = doc.splitTextToSize((i + 1) + '. ' + qText, CONTENT_W);

        const chosenRaw   = isSkipped ? 'Not answered' : _pdfText(q.opts?.[q.chosen] ?? '—');
        doc.setFontSize(8.3);
        doc.setFont('helvetica', 'bold');
        const answerLines = doc.splitTextToSize('Answer (' + statusWord + '): ' + chosenRaw, CONTENT_W - 4);

        const showCorrect  = !isCorrect;
        const correctRaw   = _pdfText(q.opts?.[q.ans] ?? '—');
        doc.setFontSize(8.3);
        doc.setFont('helvetica', 'normal');
        const correctLines = showCorrect ? doc.splitTextToSize('Correct answer: ' + correctRaw, CONTENT_W - 4) : [];

        const expText  = q.exp ? _pdfText(q.exp) : '';
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        const expLines = expText ? doc.splitTextToSize('Explanation: ' + expText, CONTENT_W - 4) : [];

        const neededH =
          qLines.length * 4.3 + 2 +
          answerLines.length * 4 + 1.5 +
          (correctLines.length ? correctLines.length * 4 + 1.5 : 0) +
          (expLines.length ? expLines.length * 3.8 + 2 : 0) + 6;

        checkPage(neededH);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.text);
        doc.text(qLines, MARGIN, y);
        y += qLines.length * 4.3 + 2;

        doc.setFontSize(8.3);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...statusColor);
        doc.text(answerLines, MARGIN + 2, y);
        y += answerLines.length * 4 + 1.5;

        if (showCorrect) {
          doc.setFontSize(8.3);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...C.success);
          doc.text(correctLines, MARGIN + 2, y);
          y += correctLines.length * 4 + 1.5;
        }

        if (expLines.length) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(...C.muted);
          doc.text(expLines, MARGIN + 2, y);
          y += expLines.length * 3.8 + 2;
        }

        y += 2.5;
        if (i < qs.length - 1) {
          doc.setDrawColor(...C.divider);
          doc.setLineWidth(0.15);
          doc.line(MARGIN, y, PAGE_W - MARGIN, y);
          y += 4;
        }
      });

      y += 4;
    });

    const safeName = _toPascalCase(r.name || 'Student');
    doc.save('VtxResult' + safeName + '.pdf');
    UI.toast('PDF downloaded.', 'success');
  }
  
   /* ─────────────────────────────────────────────────────── */
  /* Activity Log                                            */
  /* ─────────────────────────────────────────────────────── */
  let _activityUnsub = null;
  let _activityNewCount = 0;

  const ACTION_META = {
    login:               { icon: 'ph-sign-in',         label: 'Logged in',           color: 'var(--success)' },
    logout:              { icon: 'ph-sign-out',        label: 'Logged out',          color: 'var(--danger)'  },
    dashboard_view:      { icon: 'ph-house',           label: 'Opened dashboard',    color: 'var(--accent)'  },
    exam_start:          { icon: 'ph-note-pencil',     label: 'Started exam',        color: 'var(--accent)'  },
    exam_timer_start:    { icon: 'ph-timer',           label: 'Timer started',       color: 'var(--accent)'  },
    exam_resume:         { icon: 'ph-arrow-counter-clockwise', label: 'Resumed exam', color: 'var(--warning)' },
    exam_submit:         { icon: 'ph-check-circle',    label: 'Submitted exam',      color: 'var(--success)' },
    exam_switch_subject: { icon: 'ph-books',           label: 'Switched subject',    color: 'var(--info)'    },
    exam_tab_switch:     { icon: 'ph-warning',         label: 'Switched tabs',       color: 'var(--danger)'  },
    chat_open:           { icon: 'ph-chat-circle',     label: 'Opened Chat',         color: 'var(--success)' },
    groupchat_open:      { icon: 'ph-users',           label: 'Opened Group Chat',   color: 'var(--success)' },
    dm_open:             { icon: 'ph-envelope',        label: 'Opened Messages',     color: 'var(--accent)'  },
    studyroom_open:      { icon: 'ph-book-open',       label: 'Opened Study Room',   color: 'var(--info)'    },
    threedclass_open:    { icon: 'ph-cube',            label: 'Opened 3D Class',     color: 'var(--accent)'  },
    general_studies_open:{ icon: 'ph-book-bookmark',   label: 'Opened Gen. Studies', color: '#7c3aed'         },
    game_lobby_open:     { icon: 'ph-game-controller', label: 'Opened Games',        color: 'var(--accent)'  },
    ai_tutor_open:       { icon: 'ph-robot',           label: 'Opened AI Tutor',     color: 'var(--accent)'  },
  };
  
  function _activityTimeAgo(ts) {
    if (!ts) return '';

    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);

    if (diff < 5) return 'just now';
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';

    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short'
    });
  }

  function _renderActivityFeed(docs) {
    const container = document.getElementById('activityFeedList');

    if (!container) return;

    if (docs.length === 0) {
      container.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
          'gap:.625rem;text-align:center;padding:3rem 1rem;color:var(--text-3);' +
          'font-size:var(--text-sm);">' +
          '<i class="ph ph-tray" style="font-size:1.75rem;color:var(--text-4);"></i>' +
          '<span>No activity yet. Actions taken by students will appear here in real time.</span>' +
        '</div>';

      return;
    }

    container.innerHTML = docs.map(function (doc) {
      const d = doc.data();

      const meta = ACTION_META[d.action] || {
        icon: 'ph-circle',
        label: d.action || 'Unknown activity',
        color: 'var(--text-3)'
      };

      const timeAgo = _activityTimeAgo(d.timestamp);

      const ts = d.timestamp
        ? (d.timestamp.toDate ? d.timestamp.toDate() : new Date(d.timestamp))
            .toLocaleString('en-GB', {
              dateStyle: 'short',
              timeStyle: 'medium'
            })
        : '';

      // Extra detail chip for exam results
      let extraChip = '';

      if (d.action === 'exam_submit' && d.percentage != null) {
        const gradeColor =
          d.percentage >= 70
            ? 'var(--success)'
            : d.percentage >= 50
              ? 'var(--warning)'
              : 'var(--danger)';

        extraChip =
          '<span style="display:inline-flex;align-items:center;gap:.25rem;' +
            'font-size:.625rem;font-weight:700;padding:1px 7px;border-radius:99px;' +
            'background:' + gradeColor + ';color:#fff;margin-left:.375rem;">' +
            d.percentage + '% · Grade ' + (d.grade || '?') +
          '</span>';
      }

      if (d.action === 'exam_tab_switch' && d.warningNumber) {
        extraChip =
          '<span style="font-size:.625rem;font-weight:700;padding:1px 7px;border-radius:99px;' +
            'background:var(--danger-subtle);color:var(--danger);' +
            'border:1px solid var(--danger-border);margin-left:.375rem;">' +
            'Warning ' + d.warningNumber + '/3' +
          '</span>';
      }

      return (
        '<div style="display:flex;align-items:flex-start;gap:.75rem;padding:.75rem 1rem;' +
          'border-bottom:1px solid var(--border);transition:background .1s;" ' +
          'onmouseenter="this.style.background=\'var(--bg-subtle)\'" ' +
          'onmouseleave="this.style.background=\'\'">' +

          // Action icon
          '<div style="flex-shrink:0;width:34px;height:34px;border-radius:var(--r-full);' +
            'background:var(--bg-subtle);border:1px solid var(--border);' +
            'display:flex;align-items:center;justify-content:center;' +
            'color:' + meta.color + ';" ' +
            'title="' + _esc(meta.label) + '">' +
            '<i class="ph ' + meta.icon + '" style="font-size:1.125rem;line-height:1;"></i>' +
          '</div>' +

          // Content
          '<div style="flex:1;min-width:0;">' +

            '<div style="display:flex;align-items:center;gap:.375rem;flex-wrap:wrap;">' +

              '<span style="font-size:var(--text-sm);font-weight:700;color:var(--text-1);">' +
                _esc(d.name || 'Unknown') +
              '</span>' +

              '<span style="font-size:.6875rem;font-weight:500;color:var(--text-4);">·</span>' +

              '<span style="font-size:.6875rem;color:var(--text-3);">' +
                _esc(d.class || '') +
              '</span>' +

              extraChip +

            '</div>' +

            '<p style="font-size:var(--text-sm);color:var(--text-2);margin-top:2px;' +
              'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
              _esc(d.detail || meta.label) +
            '</p>' +

          '</div>' +

          // Time
          '<div style="flex-shrink:0;text-align:right;">' +

            '<span style="font-size:.625rem;color:var(--text-4);white-space:nowrap;" ' +
              'title="' + _esc(ts) + '">' +
              _esc(timeAgo) +
            '</span>' +

          '</div>' +

        '</div>'
      );
    }).join('');
  }

  function _loadActivityLog() {
    const container = document.getElementById('teacher-activity');

    if (!container) return;

    // Cancel any previous listener
    if (_activityUnsub) {
      _activityUnsub();
      _activityUnsub = null;
    }

    _activityNewCount = 0;
    _updateActivityBadge(0);

    // Merge approval-related action meta from ActivityLog module (lazy — runs after all scripts load)
    if (window._ApprovalActionMeta) {
      Object.assign(ACTION_META, window._ApprovalActionMeta);
    }

    container.innerHTML =
      '<div style="margin-bottom:1rem;">' +

        '<div style="display:flex;align-items:center;justify-content:space-between;' +
          'flex-wrap:wrap;gap:.75rem;">' +

          '<div>' +

            '<h2 style="font-size:var(--text-md);font-weight:600;color:var(--text-1);' +
              'letter-spacing:-0.015em;">' +
              'Student Activity Log' +
            '</h2>' +

            '<p style="font-size:var(--text-xs);color:var(--text-3);margin-top:2px;">' +
              'Real-time feed of everything students do, with live updates.' +
            '</p>' +

          '</div>' +

          '<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">' +

            '<select id="activityFilterAction" onchange="Teacher._filterActivity()" ' +

              'style="font-size:var(--text-xs);padding:.3125rem .625rem;' +
                'border-radius:var(--r-md);border:1px solid var(--border);' +
                'background:var(--bg-base);color:var(--text-1);' +
                'font-family:var(--font);cursor:pointer;">' +

              '<option value="">All actions</option>' +
              '<option value="login">Logins</option>' +
              '<option value="logout">Logouts</option>' +
              '<option value="exam_start,exam_timer_start,exam_submit,exam_resume">Exam activity</option>' +
              '<option value="exam_tab_switch">Tab switches</option>' +
              '<option value="chat_open,groupchat_open,dm_open">Chat & Messages</option>' +
              '<option value="game_lobby_open">Games</option>' +
              '<option value="ai_tutor_open">AI Tutor</option>' +
              '<option value="registration_pending,registration_approved,registration_declined">Registrations</option>' +

            '</select>' +

            '<input id="activityFilterName" type="text" placeholder="Filter by name…" ' +
              'oninput="Teacher._filterActivity()" ' +

              'style="font-size:var(--text-xs);padding:.3125rem .625rem;' +
                'border-radius:var(--r-md);border:1px solid var(--border);' +
                'background:var(--bg-base);color:var(--text-1);' +
                'font-family:var(--font);width:130px;" />' +

            '<div id="activityLiveIndicator" ' +

              'style="display:inline-flex;align-items:center;gap:.3rem;font-size:.6875rem;' +
                'font-weight:600;color:var(--success);white-space:nowrap;">' +

              '<span style="width:7px;height:7px;border-radius:50%;background:var(--success);' +
                'display:inline-block;animation:cbt-pulse 1.5s ease-in-out infinite;"></span>' +

              'LIVE' +

            '</div>' +

          '</div>' +

        '</div>' +

      '</div>' +

      '<div id="activityStatsBar" style="display:flex;gap:.625rem;flex-wrap:wrap;' +
        'margin-bottom:1rem;"></div>' +

      '<div style="border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;' +
        'background:var(--bg-base);">' +

        '<div id="activityFeedList">' +

          '<div style="text-align:center;padding:3rem;color:var(--text-3);' +
            'font-size:var(--text-sm);">' +
            'Loading…' +
          '</div>' +

        '</div>' +

      '</div>';

    let _allDocs = [];

    function _buildStats(docs) {
      const bar = document.getElementById('activityStatsBar');

      if (!bar) return;

      const now = Date.now();
      const recentUids = new Set();

      const loginCount = docs.filter(function (d) {
        return d.data().action === 'login';
      }).length;

      const examCount = docs.filter(function (d) {
        return d.data().action === 'exam_submit';
      }).length;

      const tabWarnings = docs.filter(function (d) {
        return d.data().action === 'exam_tab_switch';
      }).length;

      const pendingRegs = docs.filter(function (d) {
        return d.data().action === 'registration_pending';
      }).length;

      docs.forEach(function (d) {
        const ts = d.data().timestamp;
        if (!ts) return;
        const t = ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
        if (now - t < 30 * 60 * 1000) {
          recentUids.add(d.data().uid);
        }
      });

      const stats = [
        {
          label: 'Active (30 min)',
          value: recentUids.size,
          color: 'var(--success)'
        },
        {
          label: 'Logins today',
          value: loginCount,
          color: 'var(--accent)'
        },
        {
          label: 'Exams submitted',
          value: examCount,
          color: 'var(--info)'
        },
        {
          label: 'Tab warnings',
          value: tabWarnings,
          color: tabWarnings > 0 ? 'var(--danger)' : 'var(--text-3)'
        },
        {
          label: 'Pending signups',
          value: pendingRegs,
          color: pendingRegs > 0 ? 'var(--warning)' : 'var(--text-3)'
        }
      ];

      bar.innerHTML = stats.map(function (s) {
        return (
          '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
            'min-width:80px;padding:.5rem .875rem;border-radius:var(--r-lg);' +
            'border:1px solid var(--border);background:var(--bg-base);">' +
            '<span style="font-size:1.25rem;font-weight:800;color:' + s.color + ';line-height:1;">' +
              s.value +
            '</span>' +
            '<span style="font-size:.5625rem;font-weight:600;color:var(--text-4);' +
              'text-transform:uppercase;letter-spacing:.06em;margin-top:2px;white-space:nowrap;">' +
              _esc(s.label) +
            '</span>' +
          '</div>'
        );
      }).join('');
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    _activityUnsub = window.fbDb
      .collection('activityLog')
      .where('timestamp', '>=', since)
      .orderBy('timestamp', 'desc')
      .limit(200)
      .onSnapshot(
        function (snap) {
          _allDocs = snap.docs;

          _buildStats(_allDocs);

          Teacher._filterActivity();

          if (snap.docChanges) {
            const newAdded = snap.docChanges().filter(function (c) {
              return c.type === 'added';
            });

            if (newAdded.length > 0 && _allDocs.length > newAdded.length) {
              _activityNewCount += newAdded.length;
              _updateActivityBadge(_activityNewCount);
            }
          }
        },

        function (err) {
          console.error('[teacher] activityLog listener error:', err);

          const feedEl = document.getElementById('activityFeedList');

          if (feedEl) {
            feedEl.innerHTML =
              '<div style="display:flex;flex-direction:column;align-items:center;' +
                'justify-content:center;gap:.5rem;text-align:center;padding:2rem;' +
                'color:var(--danger);font-size:var(--text-sm);">' +
                '<i class="ph ph-warning-circle" style="font-size:1.5rem;"></i>' +
                '<span>Could not load activity log. Check Firestore rules.</span>' +
              '</div>';
          }
        }
      );

    _reg('activityLog', _activityUnsub);

    window._activityAllDocs = function () {
      return _allDocs;
    };
  }

  function _filterActivity() {
    const allDocs = window._activityAllDocs
      ? window._activityAllDocs()
      : [];

    const nameQ = (
      (document.getElementById('activityFilterName') || {}).value || ''
    ).toLowerCase().trim();

    const actionQ = (
      (document.getElementById('activityFilterAction') || {}).value || ''
    ).trim();

    const actionList = actionQ
      ? actionQ.split(',')
      : [];

    const filtered = allDocs.filter(function (doc) {
      const d = doc.data();

      if (
        nameQ &&
        !(d.name || '').toLowerCase().includes(nameQ)
      ) {
        return false;
      }

      if (
        actionList.length > 0 &&
        !actionList.includes(d.action)
      ) {
        return false;
      }

      return true;
    });

    _renderActivityFeed(filtered);

    _activityNewCount = 0;
    _updateActivityBadge(0);
  }

  function _updateActivityBadge(count) {
    const badge = document.getElementById('badge-activity');

    if (!badge) return;

    if (count > 0) {
      badge.textContent = count > 99
        ? '99+'
        : String(count);

      badge.classList.add('is-visible');
    } else {
      badge.textContent = '';
      badge.classList.remove('is-visible');
    }
  }
  
  window.Teacher = {
  renderTeacherDashboard,
  showTab,
  logout,
  _loadStudents,
  removeStudent,
  editStudent,
  _saveStudentEdit,
  toggleAdmin,
  deleteResult,
  addSchool,
  renameSchool,
  deleteSchool,
  addTaskDate,
  deleteTask,
  deleteAllTasks,
  saveTasksConfig,
  sendPrivateMessage,
  _setMsgMode,
  _filterMsgStudents,
  _updateMsgSelectedCount,
  _selectAllMsgStudents,
  _clearMsgStudents,
  _setTaskScope,
  _setAssignScope,
  _onTaskTargetChange,
  _selectAllDateSubjects,
  _clearDateSubjects,
  _selectAllDaySubjects,
  _clearDaySubjects,
  _updateDaySubjCount,
  exportTaskReportPDF,
  exportResultPDF,
  _loadTimetableManager,
  _onTTClassChange,
  _onTTWeekChange,
  _ttListenAll,
  _ttRenderEditor,
  _ttAddEmptyPeriodRow,
  _ttAddBreakRow,
  _ttAddLunchRow,
  _saveTimetable,
  _deleteTimetable,
  _editTimetableWeek,
  _clearTimetableInputs,
  _getMondayForWeek,
  _showGamesSubTab,
  _ttSyncTimeHidden,
  _setTTScope,
  _onTTStudentChange,
  _onTTGroupNameChange,
  _ttRenderGroupMembers,
  _ttSelectAllGroupMembers,
  _ttClearGroupMembers,
  _ttSaveGroupMembers,
  _ttDiscardDraft,
  _moveNavIndicator,
  _injectTeacherNavStyles,
  _loadActivityLog,
  _filterActivity,
  _updateActivityBadge,
  get _msgStudentCache() { return _msgStudentCache; },
};

})();
