/* ============================================================
   js/landing.js — Public marketing homepage
   ============================================================
   Editorial homepage. Ink / warm white / indigo accent.
   Instrument Serif headings. DM Sans body. No emojis, no
   gradients, no cards. Typography does the work.

   Accent colour: #4f6ef7 (indigo) — matches --accent in main.css.
   Dark mode accent: #6b87f8 — matches dark --accent in main.css.

   Dark mode: responds to [data-theme="dark"] on <html>.

   Navigation:
     Landing.render()       → renders this page
     Landing.goToLogin()    → Auth.renderLogin()
     Landing.goToRegister() → Auth.renderLogin() + showRegister()
   ============================================================ */
(function () {
  'use strict';

  var STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&display=swap');

    /* ── Light mode tokens (default) ── */
    .lp {
      --lp-ink:              #0e0e0f;
      --lp-ink-2:            #3a3a40;
      --lp-ink-3:            #6a6a70;
      --lp-ink-4:            #a4a4aa;
      --lp-ink-5:            #d8d8da;
      --lp-cream:            #fafaf8;
      --lp-cream-2:          #f5f4f0;
      /* Indigo accent — matches --accent in main.css */
      --lp-accent:           #4f6ef7;
      --lp-accent-dk:        #3a58e8;
      --lp-accent-lt:        rgba(79, 110, 247, 0.08);
      --lp-accent-border:    rgba(79, 110, 247, 0.22);
      --lp-rule:             #e4e2dc;
      --lp-nav-bg:           rgba(250,250,248,0.88);
      --lp-nav-bg-scrolled:  rgba(250,250,248,0.97);
      --lp-quote-bg:         #0e0e0f;
      --lp-quote-text:       #fafaf8;
      --lp-quote-attr:       rgba(250,250,248,0.4);
      --lp-quote-attr-name:  rgba(250,250,248,0.75);
      --lp-quote-label:      rgba(250,250,248,0.3);
      --lp-serif:            'Instrument Serif', Georgia, serif;
      --lp-sans:             'DM Sans', system-ui, sans-serif;
      background: var(--lp-cream);
      color: var(--lp-ink);
      font-family: var(--lp-sans);
      min-height: 100vh;
      overflow-x: hidden;
      line-height: 1.6;
      transition: background 0.25s, color 0.25s;
    }

    /* ── Dark mode: re-map every token ── */
    [data-theme="dark"] .lp {
      --lp-ink:              #f0f0f2;
      --lp-ink-2:            #c4c4cc;
      --lp-ink-3:            #86868f;
      --lp-ink-4:            #56565e;
      --lp-ink-5:            #3a3a42;
      --lp-cream:            #111113;
      --lp-cream-2:          #18181b;
      /* Dark indigo accent — matches dark --accent in main.css */
      --lp-accent:           #6b87f8;
      --lp-accent-dk:        #5a78f6;
      --lp-accent-lt:        rgba(107, 135, 248, 0.1);
      --lp-accent-border:    rgba(107, 135, 248, 0.28);
      --lp-rule:             #2a2a30;
      --lp-nav-bg:           rgba(17,17,19,0.88);
      --lp-nav-bg-scrolled:  rgba(17,17,19,0.97);
      --lp-quote-bg:         #0d0d0f;
      --lp-quote-text:       #f0f0f2;
      --lp-quote-attr:       rgba(240,240,242,0.4);
      --lp-quote-attr-name:  rgba(240,240,242,0.75);
      --lp-quote-label:      rgba(240,240,242,0.3);
    }

    /* ── NAV ── */
    .lp-nav {
      position: fixed; top:0; left:0; right:0; z-index:200;
      height: 60px;
      display: flex; align-items:center; justify-content:space-between;
      padding: 0 clamp(1.25rem, 5vw, 4rem);
      background: var(--lp-nav-bg);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-bottom: 1px solid transparent;
      transition: border-color 0.3s, background 0.3s;
    }
    .lp-nav.scrolled {
      border-bottom-color: var(--lp-rule);
      background: var(--lp-nav-bg-scrolled);
    }
    .lp-brand { display:flex; align-items:center; gap:.625rem; text-decoration:none; }
    .lp-mark {
      width:28px; height:28px; background:var(--lp-ink); border-radius:4px;
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
      transition: background 0.25s;
    }
    .lp-mark svg { display:block; }
    .lp-brandname {
      font-family: var(--lp-serif); font-size:.9375rem; font-weight:400;
      color:var(--lp-ink); letter-spacing:0.01em;
    }
    .lp-nav-right { display:flex; align-items:center; gap:.5rem; }
    .lp-btn-ghost {
      font-family:var(--lp-sans); font-size:.8125rem; font-weight:500;
      color:var(--lp-ink-2); background:none; border:1px solid var(--lp-rule);
      cursor:pointer; padding:.4375rem .875rem; border-radius:4px;
      transition: background .12s, border-color .12s, color .12s;
    }
    .lp-btn-ghost:hover { background:var(--lp-cream-2); border-color:var(--lp-ink-5); color:var(--lp-ink); }
    .lp-btn-solid {
      font-family:var(--lp-sans); font-size:.8125rem; font-weight:600;
      color:#fff; background:var(--lp-accent); border:none; cursor:pointer;
      padding:.5rem 1.125rem; border-radius:4px;
      transition: background .12s, transform .15s, box-shadow .15s;
    }
    .lp-btn-solid:hover {
      background:var(--lp-accent-dk);
      transform:translateY(-1px);
      box-shadow: 0 4px 12px rgba(79,110,247,0.28);
    }

    /* ── HERO ── */
    .lp-hero {
      padding: 60px clamp(1.25rem,5vw,4rem) 0;
      min-height: 100vh;
      display: flex; flex-direction:column; justify-content:center;
      position: relative; overflow:hidden;
    }
    .lp-hero-inner {
      max-width:1040px; margin:0 auto; width:100%;
      padding: clamp(4rem,12vh,8rem) 0 clamp(3rem,7vh,5rem);
      position:relative; z-index:1;
    }
    .lp-eyebrow {
      display:inline-flex; align-items:center; gap:.625rem;
      font-size:.6875rem; font-weight:600; letter-spacing:.2em;
      text-transform:uppercase; color:var(--lp-accent);
      margin-bottom:1.75rem;
    }
    .lp-eyebrow-line { width:24px; height:1px; background:var(--lp-accent); }
    .lp-h1 {
      font-family:var(--lp-serif);
      font-size: clamp(2.75rem, 8vw, 6.25rem);
      font-weight:400; line-height:.94; letter-spacing:-.025em;
      color:var(--lp-ink); margin:0 0 2rem; max-width:720px;
    }
    .lp-h1 i { font-style:italic; color:var(--lp-accent); }
    .lp-hero-sub {
      font-size: clamp(.9375rem,1.8vw,1.0625rem);
      font-weight:300; color:var(--lp-ink-2); line-height:1.78;
      max-width:440px; margin:0 0 3rem;
    }
    .lp-hero-actions { display:flex; align-items:center; gap:1.5rem; flex-wrap:wrap; }
    .lp-cta-main {
      font-family:var(--lp-sans); font-size:.9375rem; font-weight:600;
      color:#fff; background:var(--lp-accent); border:none; cursor:pointer;
      padding:.875rem 1.875rem; border-radius:4px;
      display:inline-flex; align-items:center; gap:.5rem;
      transition: background .12s, transform .18s, box-shadow .18s;
      text-decoration:none;
    }
    .lp-cta-main:hover {
      background:var(--lp-accent-dk);
      transform:translateY(-2px);
      box-shadow:0 6px 20px rgba(79,110,247,0.3);
    }
    .lp-cta-main svg { transition:transform .12s; }
    .lp-cta-main:hover svg { transform:translateX(3px); }
    .lp-cta-secondary {
      font-family:var(--lp-sans); font-size:.875rem; font-weight:400;
      color:var(--lp-ink-3); background:none; border:none; cursor:pointer;
      text-decoration:underline; text-underline-offset:3px;
      transition:color .12s;
    }
    .lp-cta-secondary:hover { color:var(--lp-ink); }

    /* Decorative background word */
    .lp-hero-deco {
      position:absolute; right:-.02em; top:50%; transform:translateY(-50%);
      font-family:var(--lp-serif);
      font-size: clamp(12rem,26vw,22rem);
      font-weight:400; color:transparent;
      -webkit-text-stroke: 1px var(--lp-rule);
      line-height:1; user-select:none; pointer-events:none;
      z-index:0; white-space:nowrap; letter-spacing:-.025em;
      font-style:italic;
    }

    .lp-hero-rule {
      border:none; border-top:1px solid var(--lp-rule);
      max-width:1040px; margin:0 auto;
    }

    /* ── STATS STRIP ── */
    .lp-strip {
      max-width:1040px; margin:0 auto;
      padding: 2.5rem clamp(1.25rem,5vw,4rem);
      display:flex; flex-wrap:wrap; gap:0;
    }
    .lp-stat { flex:1; min-width:120px; padding:0 2.25rem 0 0; }
    .lp-stat + .lp-stat { padding-left:2.25rem; border-left:1px solid var(--lp-rule); }
    .lp-stat-val {
      font-family:var(--lp-serif); font-size:2.25rem; font-weight:400;
      color:var(--lp-ink); letter-spacing:-.03em; line-height:1;
    }
    .lp-stat-label {
      font-size:.8125rem; color:var(--lp-ink-3); margin-top:.375rem; line-height:1.45;
    }

    /* ── SECTIONS ── */
    .lp-section {
      padding: clamp(3rem,8vh,6rem) clamp(1.25rem,5vw,4rem);
      border-top:1px solid var(--lp-rule);
    }
    .lp-section-inner { max-width:1040px; margin:0 auto; }
    .lp-section-tag {
      font-size:.625rem; font-weight:600; letter-spacing:.22em;
      text-transform:uppercase; color:var(--lp-ink-4);
      display:flex; align-items:center; gap:.625rem; margin-bottom:1.25rem;
    }
    .lp-section-tag::before {
      content:''; width:14px; height:1px; background:var(--lp-ink-4); flex-shrink:0;
    }
    .lp-h2 {
      font-family:var(--lp-serif);
      font-size: clamp(1.75rem,4vw,3rem);
      font-weight:400; line-height:1.1; letter-spacing:-.025em;
      color:var(--lp-ink); max-width:580px;
    }
    .lp-h2 i { font-style:italic; color:var(--lp-accent); }

    /* ── FEATURES ── */
    .lp-features { margin-top:3rem; }
    .lp-features-grid {
      display:grid; grid-template-columns:1fr 1fr; gap:0;
    }
    .lp-feature {
      display:flex; align-items:flex-start; gap:1.5rem;
      padding:2rem 0; border-bottom:1px solid var(--lp-rule);
    }
    .lp-features-grid .lp-feature:nth-child(odd) {
      padding-right:3rem; border-right:1px solid var(--lp-rule);
    }
    .lp-features-grid .lp-feature:nth-child(even) { padding-left:3rem; }
    .lp-feat-n {
      font-family:var(--lp-serif); font-size:.6875rem; font-weight:400;
      color:var(--lp-accent); letter-spacing:.04em; padding-top:.15rem;
      flex-shrink:0; min-width:1.75rem; font-style:italic;
    }
    .lp-feat-title {
      font-family:var(--lp-serif); font-size:1.125rem; font-weight:400;
      color:var(--lp-ink); margin-bottom:.375rem; letter-spacing:-.015em;
    }
    .lp-feat-body {
      font-size:.9375rem; font-weight:300; color:var(--lp-ink-2); line-height:1.72;
    }

    /* ── HOW IT WORKS ── */
    .lp-steps {
      display:flex; gap:0; margin-top:3rem; position:relative;
    }
    .lp-steps::before {
      content:''; position:absolute; top:1.375rem; left:1.375rem; right:1.375rem;
      height:1px; background:var(--lp-rule); z-index:0;
    }
    .lp-step { flex:1; padding-right:2.25rem; position:relative; z-index:1; }
    .lp-step:last-child { padding-right:0; }
    .lp-step-circle {
      width:2.75rem; height:2.75rem; border-radius:50%;
      background:var(--lp-cream); border:1px solid var(--lp-rule);
      display:flex; align-items:center; justify-content:center;
      font-family:var(--lp-serif); font-size:.9375rem; font-weight:400; font-style:italic;
      color:var(--lp-ink); margin-bottom:1.25rem;
      transition: background .18s, border-color .18s, color .18s;
    }
    .lp-step:hover .lp-step-circle {
      background:var(--lp-accent); color:#fff; border-color:var(--lp-accent);
    }
    .lp-step-title {
      font-family:var(--lp-serif); font-size:1rem; font-weight:400;
      color:var(--lp-ink); margin-bottom:.375rem; letter-spacing:-.01em;
    }
    .lp-step-body {
      font-size:.875rem; font-weight:300; color:var(--lp-ink-3); line-height:1.72;
    }

    /* ── QUOTE BAND ── */
    .lp-quote-band {
      background:var(--lp-quote-bg);
      padding: clamp(3rem,8vh,6rem) clamp(1.25rem,5vw,4rem);
    }
    .lp-quote-inner {
      max-width:1040px; margin:0 auto;
      display:flex; gap:5rem; align-items:flex-start;
    }
    .lp-quote-label {
      font-size:.625rem; font-weight:600; letter-spacing:.22em;
      text-transform:uppercase; color:var(--lp-quote-label);
      white-space:nowrap; padding-top:.375rem; min-width:100px;
    }
    .lp-quote-right { flex:1; }
    .lp-quote-text {
      font-family:var(--lp-serif);
      font-size: clamp(1.375rem,3.2vw,2.375rem);
      font-style:italic; font-weight:400; line-height:1.35;
      letter-spacing:-.015em; color:var(--lp-quote-text); margin:0 0 1.5rem;
    }
    /* Highlighted words in quote use indigo instead of amber */
    .lp-quote-text em {
      font-style:normal;
      color: #6b87f8;
    }
    [data-theme="dark"] .lp-quote-text em {
      color: #8da2fa;
    }
    .lp-quote-attr {
      font-size:.8125rem; color:var(--lp-quote-attr);
    }
    .lp-quote-attr strong { color:var(--lp-quote-attr-name); font-weight:500; }

    /* ── FOOTER CTA ── */
    .lp-foot-cta {
      padding: clamp(3rem,8vh,6rem) clamp(1.25rem,5vw,4rem);
      border-top:1px solid var(--lp-rule);
    }
    .lp-foot-cta-inner {
      max-width:1040px; margin:0 auto;
      display:flex; align-items:flex-end; justify-content:space-between;
      gap:3rem; flex-wrap:wrap;
    }
    .lp-foot-h2 {
      font-family:var(--lp-serif);
      font-size: clamp(2rem,5vw,3.75rem);
      font-weight:400; line-height:.96; letter-spacing:-.03em;
      color:var(--lp-ink); margin:0 0 .875rem;
    }
    .lp-foot-h2 i { font-style:italic; color:var(--lp-accent); }
    .lp-foot-sub {
      font-size:.9375rem; font-weight:300; color:var(--lp-ink-3);
      line-height:1.7; max-width:360px;
    }
    .lp-foot-actions {
      display:flex; flex-direction:column; align-items:flex-start; gap:.75rem;
    }

    /* ── FOOTER ── */
    .lp-footer {
      border-top:1px solid var(--lp-rule);
      padding:1.625rem clamp(1.25rem,5vw,4rem);
    }
    .lp-footer-inner {
      max-width:1040px; margin:0 auto;
      display:flex; align-items:center; justify-content:space-between;
      flex-wrap:wrap; gap:.625rem;
    }
    .lp-footer-copy { font-size:.75rem; color:var(--lp-ink-4); }
    .lp-footer-copy strong { color:var(--lp-accent); font-weight:500; }

    /* ── SCROLL REVEAL ── */
    .lp-rv {
      opacity:0; transform:translateY(22px);
      transition: opacity .7s cubic-bezier(.4,0,.2,1), transform .7s cubic-bezier(.4,0,.2,1);
    }
    .lp-rv.on { opacity:1; transform:none; }
    .lp-rv.d1 { transition-delay:.1s; }
    .lp-rv.d2 { transition-delay:.2s; }
    .lp-rv.d3 { transition-delay:.3s; }
    .lp-rv.d4 { transition-delay:.4s; }

    /* ── RESPONSIVE ── */
    @media(max-width:860px){
      .lp-features-grid { grid-template-columns:1fr; }
      .lp-features-grid .lp-feature:nth-child(odd) { padding-right:0; border-right:none; }
      .lp-features-grid .lp-feature:nth-child(even) { padding-left:0; }
      .lp-steps { flex-direction:column; }
      .lp-steps::before { display:none; }
      .lp-step { padding-right:0; padding-bottom:1.75rem; border-left:1px solid var(--lp-rule); padding-left:1.875rem; }
      .lp-step-circle { margin-left:-2.375rem; }
      .lp-quote-inner { flex-direction:column; gap:1rem; }
      .lp-quote-label { min-width:unset; }
      .lp-foot-cta-inner { flex-direction:column; align-items:flex-start; }
    }
    @media(max-width:540px){
      .lp-stat + .lp-stat { border-left:none; padding-left:0; margin-top:1.5rem; }
      .lp-strip { flex-direction:column; }
      .lp-hero-deco { display:none; }
    }
  `;

  var ARROW_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

  var LOGO_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>';

  function _feat(n, title, body, cls) {
    return (
      '<div class="lp-feature ' + (cls || '') + '">' +
        '<span class="lp-feat-n">' + n + '</span>' +
        '<div>' +
          '<div class="lp-feat-title">' + title + '</div>' +
          '<p class="lp-feat-body">' + body + '</p>' +
        '</div>' +
      '</div>'
    );
  }

  function _step(n, title, body, cls) {
    return (
      '<div class="lp-step ' + (cls || '') + '">' +
        '<div class="lp-step-circle">' + n + '</div>' +
        '<div class="lp-step-title">' + title + '</div>' +
        '<p class="lp-step-body">' + body + '</p>' +
      '</div>'
    );
  }

  function _html() {
    return (
      '<style id="lp-css">' + STYLES + '</style>' +

      '<div class="lp" id="lp-root">' +

        /* NAV */
        '<nav class="lp-nav" id="lpNav">' +
          '<div class="lp-brand">' +
            '<div class="lp-mark">' + LOGO_SVG + '</div>' +
            '<span class="lp-brandname">Vertex Tutorial</span>' +
          '</div>' +
          '<div class="lp-nav-right">' +
            '<button class="lp-btn-ghost" onclick="Landing.goToRegister()">Register</button>' +
            '<button class="lp-btn-solid" onclick="Landing.goToLogin()">Sign In</button>' +
          '</div>' +
        '</nav>' +

        /* HERO */
        '<section class="lp-hero">' +
          '<div class="lp-hero-deco" aria-hidden="true">CBT</div>' +
          '<div class="lp-hero-inner">' +
            '<div class="lp-eyebrow lp-rv">' +
              '<span class="lp-eyebrow-line"></span>' +
              'Vertex Tutorial Centre' +
            '</div>' +
            '<h1 class="lp-h1 lp-rv d1">Prepare.<br><i>Practice.</i><br>Excel.</h1>' +
            '<p class="lp-hero-sub lp-rv d2">' +
              'The computer-based testing system built exclusively for Vertex Tutorial students. ' +
              'Timed exams, instant results, curated study materials, ' +
              'and a live classroom discussion &mdash; all in one place.' +
            '</p>' +
            '<div class="lp-hero-actions lp-rv d3">' +
              '<button class="lp-cta-main" onclick="Landing.goToLogin()">Enter the portal ' + ARROW_SVG + '</button>' +
              '<button class="lp-cta-secondary" onclick="Landing.goToRegister()">New student? Register here</button>' +
            '</div>' +
          '</div>' +
          '<hr class="lp-hero-rule" />' +
        '</section>' +

        /* STATS */
        '<div class="lp-strip lp-rv">' +
          '<div class="lp-stat"><div class="lp-stat-val">6+</div><div class="lp-stat-label">Subjects covered</div></div>' +
          '<div class="lp-stat"><div class="lp-stat-val">40</div><div class="lp-stat-label">Questions per subject</div></div>' +
          '<div class="lp-stat"><div class="lp-stat-val">JSS&ndash;SSS</div><div class="lp-stat-label">All classes supported</div></div>' +
          '<div class="lp-stat"><div class="lp-stat-val">Free</div><div class="lp-stat-label">For every enrolled student</div></div>' +
        '</div>' +

        /* FEATURES */
        '<section class="lp-section">' +
          '<div class="lp-section-inner">' +
            '<div class="lp-section-tag lp-rv">What the platform offers</div>' +
            '<h2 class="lp-h2 lp-rv d1">Every tool your<br>studies demand</h2>' +
            '<div class="lp-features lp-features-grid">' +
              _feat('i', 'Timed, multi-subject exams',
                'Pick two or more subjects and sit a timed exam. The countdown is server-synced &mdash; closing the tab or switching devices never resets it. 40 questions per subject, randomly drawn each session.', 'lp-rv') +
              _feat('ii', 'Instant results and explanations',
                'The moment you submit, your score, grade, and per-subject breakdown appear. Every question carries a full written explanation so you understand exactly where marks were won or lost.', 'lp-rv d1') +
              _feat('iii', 'Study Room',
                'Teacher-curated lesson notes organised by class, subject, and term. Adjustable font size, line spacing, and background theme. Your reading preferences are saved between sessions.', 'lp-rv') +
              _feat('iv', 'Public discussion chat',
                'A shared classroom for all students. Ask questions, share insights, help each other. @mention any classmate or Master Timothy directly and they receive a notification.', 'lp-rv d1') +
              _feat('v', 'Coaching task schedule',
                'Master Timothy assigns required practice sessions on specific dates with specific subjects. The app tracks your attendance automatically. You always know what is due and when.', 'lp-rv') +
              _feat('vi', 'Progress that follows you',
                'Your results, your coaching history, your session count &mdash; all tracked. Share your grade to WhatsApp or copy it to clipboard with a single tap immediately after any exam.', 'lp-rv d1') +
            '</div>' +
          '</div>' +
        '</section>' +

        /* HOW IT WORKS */
        '<section class="lp-section">' +
          '<div class="lp-section-inner">' +
            '<div class="lp-section-tag lp-rv">How it works</div>' +
            '<h2 class="lp-h2 lp-rv d1">From registration<br>to results in <i>minutes</i></h2>' +
            '<div class="lp-steps">' +
              _step('1', 'Register once',
                'Enter your name, class, school, and email. Your account is created immediately. No approval, no waiting.', 'lp-rv') +
              _step('2', 'Choose your subjects',
                'Select at least two subjects from your class bank, or follow the specific subjects Master Timothy has assigned for the day.', 'lp-rv d1') +
              _step('3', 'Sit the exam',
                'Work through questions at your own pace within the time limit. Navigate freely between subjects and return to any question before you submit.', 'lp-rv d2') +
              _step('4', 'Review and improve',
                'Read the explanation for every question. Understand exactly what you missed. Come back the next day and push the score higher.', 'lp-rv d3') +
            '</div>' +
          '</div>' +
        '</section>' +

        /* QUOTE */
        '<section class="lp-quote-band">' +
          '<div class="lp-quote-inner lp-rv">' +
            '<div class="lp-quote-label">From the teacher</div>' +
            '<div class="lp-quote-right">' +
              '<blockquote class="lp-quote-text">' +
                '&ldquo;Every student who practices consistently will find that the exam hall holds <em>no surprises.</em> ' +
                'This platform is your practice hall. Use it every day.&rdquo;' +
              '</blockquote>' +
              '<p class="lp-quote-attr">&mdash; <strong>Master Timothy</strong>, Vertex Tutorial Centre</p>' +
            '</div>' +
          '</div>' +
        '</section>' +

        /* FOOTER CTA */
        '<section class="lp-foot-cta">' +
          '<div class="lp-foot-cta-inner">' +
            '<div class="lp-rv">' +
              '<h2 class="lp-foot-h2">Ready to<br>begin <i>today?</i></h2>' +
              '<p class="lp-foot-sub">Join every Vertex Tutorial student already inside. It takes less than two minutes to register.</p>' +
            '</div>' +
            '<div class="lp-foot-actions lp-rv d2">' +
              '<button class="lp-cta-main" onclick="Landing.goToLogin()">Sign in to your account ' + ARROW_SVG + '</button>' +
              '<button class="lp-cta-secondary" onclick="Landing.goToRegister()">No account yet? Register as a new student</button>' +
            '</div>' +
          '</div>' +
        '</section>' +

        /* FOOTER */
        '<footer class="lp-footer">' +
          '<div class="lp-footer-inner">' +
            '<span class="lp-footer-copy">Vertex Tutorial Centre &mdash; Computer-Based Testing. With care from <strong>Master Timothy</strong>.</span>' +
            '<span class="lp-footer-copy" style="opacity:.55;">For enrolled students only.</span>' +
          '</div>' +
        '</footer>' +

      '</div>'
    );
  }

  function _initNav() {
    var nav = document.getElementById('lpNav');
    if (!nav) return;
    var fn = function () { nav.classList.toggle('scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', fn, { passive: true });
    window._lpCleanup = window._lpCleanup || [];
    window._lpCleanup.push(function () { window.removeEventListener('scroll', fn); });
  }

  function _initReveal() {
    var els = document.querySelectorAll('.lp-rv');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('on'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('on'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
    els.forEach(function (el) { obs.observe(el); });
    window._lpCleanup = window._lpCleanup || [];
    window._lpCleanup.push(function () { obs.disconnect(); });
  }

  function _cleanup() {
    (window._lpCleanup || []).forEach(function (fn) { fn(); });
    window._lpCleanup = [];
  }

  function render() {
    _cleanup();
    window.scrollTo(0, 0);
    var app = document.getElementById('app');
    if (app) { app.style.cssText = 'display:block;padding:0;min-height:100vh;'; }
    UI.mount(_html());
    requestAnimationFrame(function () {
      _initNav();
      setTimeout(_initReveal, 60);
    });
  }

  function goToLogin() {
    _cleanup();
    var app = document.getElementById('app');
    if (app) { app.style.cssText = ''; }
    Auth.renderLogin();
  }

  function goToRegister() {
    _cleanup();
    var app = document.getElementById('app');
    if (app) { app.style.cssText = ''; }
    Auth.renderLogin();
    setTimeout(function () {
      if (window.Auth && typeof Auth.showRegister === 'function') Auth.showRegister();
    }, 60);
  }

  window.Landing = { render: render, goToLogin: goToLogin, goToRegister: goToRegister };

}());
