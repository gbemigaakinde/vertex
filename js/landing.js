/* ============================================================
   js/landing.js — Public marketing homepage
   ============================================================
   A full editorial website homepage rendered via UI.mount().
   Sections: nav → hero → stats strip → features → how it works
             → quote from Master Timothy → footer CTA → footer.

   Design: Light editorial. Playfair Display headings, DM Sans
   body. Cream-white (#faf9f6) page, deep ink (#0f0e0b) text,
   warm amber (#c17f2a) accent. No cards. Large type. Thin
   rules. Generous whitespace. Scroll-triggered fade-ins.

   Navigation:
     Landing.render()       → renders this page
     Landing.goToLogin()    → Auth.renderLogin()
     Landing.goToRegister() → Auth.renderLogin() + showRegister()
   ============================================================ */
(function () {
  'use strict';

  /* ── Styles injected with the page ── */
  var STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;0,900;1,400;1,700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

    .lp {
      --ink:     #0f0e0b;
      --ink2:    #3a3830;
      --ink3:    #7a7670;
      --cream:   #faf9f6;
      --amber:   #c17f2a;
      --rule:    #e2dfd8;
      --serif:   'Playfair Display', Georgia, serif;
      --sans:    'DM Sans', system-ui, sans-serif;
      background: var(--cream);
      color: var(--ink);
      font-family: var(--sans);
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* NAV */
    .lp-nav {
      position: fixed; top:0; left:0; right:0; z-index:200;
      height: 62px;
      display: flex; align-items:center; justify-content:space-between;
      padding: 0 clamp(1.25rem, 5vw, 4rem);
      background: rgba(250,249,246,0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid transparent;
      transition: border-color 0.3s, background 0.3s;
    }
    .lp-nav.scrolled { border-bottom-color: var(--rule); background:rgba(250,249,246,0.97); }
    .lp-brand { display:flex; align-items:center; gap:.625rem; }
    .lp-mark {
      width:30px; height:30px; background:var(--ink); border-radius:5px;
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
    }
    .lp-brandname {
      font-family: var(--serif); font-size:1rem; font-weight:700;
      color:var(--ink); letter-spacing:-0.01em;
    }
    .lp-nav-right { display:flex; align-items:center; gap:.625rem; }
    .lp-nav-ghost {
      font-family:var(--sans); font-size:.8125rem; font-weight:500;
      color:var(--ink2); background:none; border:none; cursor:pointer;
      padding:.4375rem .875rem; border-radius:4px;
      transition: background .15s, color .15s;
    }
    .lp-nav-ghost:hover { background:rgba(0,0,0,.06); color:var(--ink); }
    .lp-nav-cta {
      font-family:var(--sans); font-size:.8125rem; font-weight:600;
      color:var(--cream); background:var(--ink); border:none; cursor:pointer;
      padding:.5rem 1.125rem; border-radius:3px;
      transition: background .15s, transform .15s;
    }
    .lp-nav-cta:hover { background:#2a2820; transform:translateY(-1px); }

    /* HERO */
    .lp-hero {
      min-height: 100vh;
      padding: 62px clamp(1.25rem, 5vw, 4rem) 0;
      display: flex; flex-direction: column; justify-content: center;
      position: relative; overflow: hidden;
    }
    .lp-hero-inner {
      max-width: 1080px; margin: 0 auto; width:100%;
      padding: clamp(4rem,12vh,8rem) 0 clamp(3rem,7vh,5rem);
      position: relative; z-index:1;
    }
    .lp-eyebrow {
      display:inline-flex; align-items:center; gap:.5rem;
      font-size:.6875rem; font-weight:700; letter-spacing:.18em;
      text-transform:uppercase; color:var(--amber);
      margin-bottom:1.75rem;
    }
    .lp-eyebrow-rule { width:26px; height:1px; background:var(--amber); }
    .lp-h1 {
      font-family:var(--serif);
      font-size: clamp(3rem, 8.5vw, 6.75rem);
      font-weight:900; line-height:.93; letter-spacing:-.035em;
      color:var(--ink); margin:0 0 2rem; max-width:760px;
    }
    .lp-h1 em { font-style:italic; color:var(--amber); }
    .lp-hero-sub {
      font-size: clamp(.9375rem, 2vw, 1.125rem);
      font-weight:300; color:var(--ink2); line-height:1.75;
      max-width:460px; margin:0 0 3rem;
    }
    .lp-hero-btns { display:flex; align-items:center; gap:1.5rem; flex-wrap:wrap; }
    .lp-cta-primary {
      font-family:var(--sans); font-size:.9375rem; font-weight:600;
      color:var(--cream); background:var(--ink); border:none; cursor:pointer;
      padding:.875rem 2rem; border-radius:3px;
      display:inline-flex; align-items:center; gap:.625rem;
      transition: background .15s, transform .2s, box-shadow .2s;
    }
    .lp-cta-primary:hover { background:#2a2820; transform:translateY(-2px); box-shadow:0 8px 24px rgba(15,14,11,.18); }
    .lp-cta-primary svg { transition: transform .15s; }
    .lp-cta-primary:hover svg { transform:translateX(3px); }
    .lp-cta-text {
      font-family:var(--sans); font-size:.875rem; font-weight:400;
      color:var(--ink3); background:none; border:none; cursor:pointer;
      text-decoration:underline; text-underline-offset:3px;
      transition: color .15s;
    }
    .lp-cta-text:hover { color:var(--ink); }
    /* Big decorative background word */
    .lp-hero-deco {
      position:absolute; right:-.03em; top:50%; transform:translateY(-50%);
      font-family:var(--serif);
      font-size: clamp(14rem, 28vw, 24rem);
      font-weight:900; color:transparent;
      -webkit-text-stroke: 1px rgba(15,14,11,.05);
      line-height:1; user-select:none; pointer-events:none;
      z-index:0; white-space:nowrap; letter-spacing:-.04em;
    }
    .lp-hero-rule { border:none; border-top:1px solid var(--rule); max-width:1080px; margin:0 auto; }

    /* STRIP */
    .lp-strip {
      max-width:1080px; margin:0 auto;
      padding: 2.75rem clamp(1.25rem,5vw,4rem);
      display:flex; flex-wrap:wrap; gap:0;
    }
    .lp-stat { flex:1; min-width:130px; padding:0 2.5rem 0 0; }
    .lp-stat + .lp-stat { padding-left:2.5rem; border-left:1px solid var(--rule); }
    .lp-stat-val {
      font-family:var(--serif); font-size:2.375rem; font-weight:700;
      color:var(--ink); letter-spacing:-.04em; line-height:1;
    }
    .lp-stat-label { font-size:.8125rem; color:var(--ink3); margin-top:.375rem; line-height:1.45; }

    /* SECTIONS */
    .lp-section { padding: clamp(3.5rem,9vh,6.5rem) clamp(1.25rem,5vw,4rem); border-top:1px solid var(--rule); }
    .lp-section-inner { max-width:1080px; margin:0 auto; }
    .lp-tag {
      font-size:.625rem; font-weight:700; letter-spacing:.2em;
      text-transform:uppercase; color:var(--ink3);
      display:flex; align-items:center; gap:.625rem; margin-bottom:1.25rem;
    }
    .lp-tag::before { content:''; width:16px; height:1px; background:var(--ink3); flex-shrink:0; }
    .lp-h2 {
      font-family:var(--serif);
      font-size: clamp(1.875rem,4.5vw,3.25rem);
      font-weight:700; line-height:1.08; letter-spacing:-.03em;
      color:var(--ink); max-width:620px;
    }
    .lp-h2 em { font-style:italic; color:var(--amber); }

    /* FEATURES — flowing two-column list, no cards */
    .lp-features { margin-top:3.5rem; }
    .lp-feature {
      display:flex; align-items:flex-start; gap:1.75rem;
      padding: 2.25rem 0; border-bottom:1px solid var(--rule);
      position:relative;
    }
    .lp-features-cols {
      display:grid; grid-template-columns:1fr 1fr; gap:0;
    }
    .lp-features-cols .lp-feature:nth-child(odd) {
      padding-right:3rem; border-right:1px solid var(--rule);
    }
    .lp-features-cols .lp-feature:nth-child(even) { padding-left:3rem; }
    .lp-feat-num {
      font-family:var(--serif); font-size:.6875rem; font-weight:700;
      color:var(--amber); letter-spacing:.06em; padding-top:.2rem; flex-shrink:0;
      min-width:2rem;
    }
    .lp-feat-title {
      font-family:var(--serif); font-size:1.1875rem; font-weight:700;
      color:var(--ink); margin-bottom:.4375rem; letter-spacing:-.02em;
    }
    .lp-feat-body { font-size:.9375rem; font-weight:300; color:var(--ink2); line-height:1.72; }

    /* HOW IT WORKS — horizontal steps */
    .lp-steps-row {
      display:flex; gap:0; margin-top:3.5rem; position:relative;
    }
    .lp-steps-row::before {
      content:''; position:absolute; top:1.4375rem; left:1.5rem; right:1.5rem;
      height:1px; background:var(--rule); z-index:0;
    }
    .lp-step { flex:1; padding-right:2.5rem; position:relative; z-index:1; }
    .lp-step:last-child { padding-right:0; }
    .lp-step-circle {
      width:2.875rem; height:2.875rem; border-radius:50%;
      background:var(--cream); border:1px solid var(--rule);
      display:flex; align-items:center; justify-content:center;
      font-family:var(--serif); font-size:.9375rem; font-weight:700;
      color:var(--ink); margin-bottom:1.375rem;
      transition: background .2s, border-color .2s, color .2s;
    }
    .lp-step:hover .lp-step-circle { background:var(--ink); color:var(--cream); border-color:var(--ink); }
    .lp-step-title {
      font-family:var(--serif); font-size:1.0625rem; font-weight:700;
      color:var(--ink); margin-bottom:.4375rem; letter-spacing:-.02em;
    }
    .lp-step-body { font-size:.875rem; font-weight:300; color:var(--ink3); line-height:1.72; }

    /* QUOTE — full-width dark band */
    .lp-quote-band {
      background:var(--ink); color:var(--cream);
      padding: clamp(3.5rem,9vh,6.5rem) clamp(1.25rem,5vw,4rem);
    }
    .lp-quote-inner {
      max-width:1080px; margin:0 auto;
      display:flex; gap:5rem; align-items:flex-start;
    }
    .lp-quote-kicker {
      font-size:.625rem; font-weight:700; letter-spacing:.2em;
      text-transform:uppercase; color:rgba(250,249,246,.38);
      white-space:nowrap; padding-top:.5rem; min-width:110px;
    }
    .lp-quote-right { flex:1; }
    .lp-quote-text {
      font-family:var(--serif);
      font-size: clamp(1.4375rem,3.5vw,2.5rem);
      font-style:italic; font-weight:400; line-height:1.35;
      letter-spacing:-.02em; color:var(--cream); margin:0 0 1.75rem;
    }
    .lp-quote-text em { font-style:normal; color:var(--amber); }
    .lp-quote-attr {
      font-family:var(--sans); font-size:.8125rem; font-weight:400;
      color:rgba(250,249,246,.45); font-style:normal;
    }
    .lp-quote-attr strong { color:rgba(250,249,246,.8); font-weight:600; }

    /* FOOTER CTA */
    .lp-foot-cta {
      padding: clamp(3.5rem,9vh,6.5rem) clamp(1.25rem,5vw,4rem);
      border-top:1px solid var(--rule);
    }
    .lp-foot-cta-inner {
      max-width:1080px; margin:0 auto;
      display:flex; align-items:flex-end; justify-content:space-between;
      gap:3rem; flex-wrap:wrap;
    }
    .lp-foot-h2 {
      font-family:var(--serif);
      font-size: clamp(2rem,5.5vw,3.875rem);
      font-weight:900; line-height:.96; letter-spacing:-.04em;
      color:var(--ink); margin:0 0 1rem;
    }
    .lp-foot-h2 em { font-style:italic; color:var(--amber); }
    .lp-foot-sub { font-size:1rem; font-weight:300; color:var(--ink3); line-height:1.7; max-width:380px; }
    .lp-foot-cta-right { display:flex; flex-direction:column; align-items:flex-start; gap:.875rem; }

    /* FOOTER */
    .lp-footer {
      border-top:1px solid var(--rule);
      padding: 1.75rem clamp(1.25rem,5vw,4rem);
    }
    .lp-footer-inner {
      max-width:1080px; margin:0 auto;
      display:flex; align-items:center; justify-content:space-between;
      flex-wrap:wrap; gap:.75rem;
    }
    .lp-footer-copy { font-size:.75rem; color:var(--ink3); }
    .lp-footer-copy strong { color:var(--amber); font-weight:600; }

    /* SCROLL REVEAL */
    .lp-rv {
      opacity:0; transform:translateY(26px);
      transition: opacity .72s cubic-bezier(.4,0,.2,1),
                  transform .72s cubic-bezier(.4,0,.2,1);
    }
    .lp-rv.on { opacity:1; transform:none; }
    .lp-rv.d1 { transition-delay:.1s; }
    .lp-rv.d2 { transition-delay:.22s; }
    .lp-rv.d3 { transition-delay:.34s; }
    .lp-rv.d4 { transition-delay:.46s; }

    /* RESPONSIVE */
    @media(max-width:860px){
      .lp-features-cols { grid-template-columns:1fr; }
      .lp-features-cols .lp-feature:nth-child(odd) { padding-right:0; border-right:none; }
      .lp-features-cols .lp-feature:nth-child(even) { padding-left:0; }
      .lp-steps-row { flex-direction:column; }
      .lp-steps-row::before { display:none; }
      .lp-step { padding-right:0; padding-bottom:2rem; border-left:1px solid var(--rule); padding-left:2rem; }
      .lp-step-circle { margin-left:-2.4375rem; }
      .lp-quote-inner { flex-direction:column; gap:1.25rem; }
      .lp-quote-kicker { min-width:unset; }
      .lp-foot-cta-inner { flex-direction:column; align-items:flex-start; }
    }
    @media(max-width:540px){
      .lp-stat + .lp-stat { border-left:none; padding-left:0; margin-top:1.5rem; }
      .lp-strip { flex-direction:column; }
      .lp-hero-deco { display:none; }
    }
  `;

  /* ── Arrow icon used in CTAs ── */
  var ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

  /* ── Build page HTML ── */
  function _html() {
    return (
      '<style id="lp-css">' + STYLES + '</style>' +

      '<div class="lp" id="lp-root">' +

        /* ── NAV ── */
        '<nav class="lp-nav" id="lpNav">' +
          '<div class="lp-brand">' +
            '<div class="lp-mark">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
                '<polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>' +
                '<line x1="12" y1="22" x2="12" y2="15.5"/>' +
                '<polyline points="22 8.5 12 15.5 2 8.5"/>' +
              '</svg>' +
            '</div>' +
            '<span class="lp-brandname">Vertex Tutorial</span>' +
          '</div>' +
          '<div class="lp-nav-right">' +
            '<button class="lp-nav-ghost" onclick="Landing.goToRegister()">Register</button>' +
            '<button class="lp-nav-cta"  onclick="Landing.goToLogin()">Sign In</button>' +
          '</div>' +
        '</nav>' +

        /* ── HERO ── */
        '<section class="lp-hero">' +
          '<div class="lp-hero-deco" aria-hidden="true">CBT</div>' +
          '<div class="lp-hero-inner">' +

            '<div class="lp-eyebrow lp-rv">' +
              '<span class="lp-eyebrow-rule"></span>' +
              'Vertex Tutorial Centre' +
            '</div>' +

            '<h1 class="lp-h1 lp-rv d1">' +
              'Prepare.<br><em>Practice.</em><br>Excel.' +
            '</h1>' +

            '<p class="lp-hero-sub lp-rv d2">' +
              'The computer-based testing system built exclusively for Vertex Tutorial students. ' +
              'Timed exams, instant results, curated study materials, ' +
              'and a live classroom discussion &mdash; all in one place.' +
            '</p>' +

            '<div class="lp-hero-btns lp-rv d3">' +
              '<button class="lp-cta-primary" onclick="Landing.goToLogin()">' +
                'Enter the portal ' + ARROW +
              '</button>' +
              '<button class="lp-cta-text" onclick="Landing.goToRegister()">' +
                'New student? Register here' +
              '</button>' +
            '</div>' +

          '</div>' +
          '<hr class="lp-hero-rule" />' +
        '</section>' +

        /* ── STATS STRIP ── */
        '<div class="lp-strip lp-rv">' +
          '<div class="lp-stat">' +
            '<div class="lp-stat-val">6+</div>' +
            '<div class="lp-stat-label">Subjects covered</div>' +
          '</div>' +
          '<div class="lp-stat">' +
            '<div class="lp-stat-val">40</div>' +
            '<div class="lp-stat-label">Questions per subject</div>' +
          '</div>' +
          '<div class="lp-stat">' +
            '<div class="lp-stat-val">JSS&ndash;SSS</div>' +
            '<div class="lp-stat-label">All classes supported</div>' +
          '</div>' +
          '<div class="lp-stat">' +
            '<div class="lp-stat-val">100%</div>' +
            '<div class="lp-stat-label">Free for every student</div>' +
          '</div>' +
        '</div>' +

        /* ── FEATURES ── */
        '<section class="lp-section">' +
          '<div class="lp-section-inner">' +
            '<div class="lp-tag lp-rv">What the platform offers</div>' +
            '<h2 class="lp-h2 lp-rv d1">Every tool your<br>studies demand</h2>' +
            '<div class="lp-features lp-features-cols">' +

              _feat('01', 'Timed, multi-subject exams',
                'Pick two or more subjects and sit a timed exam. The countdown is server-synced — closing the tab or switching devices never resets it. 40 questions per subject, randomly drawn each session.', 'lp-rv') +

              _feat('02', 'Instant results and explanations',
                'The moment you submit, your score, grade, and per-subject breakdown appear. Every single question carries a full written explanation so you understand exactly where marks were won or lost.', 'lp-rv d1') +

              _feat('03', 'Study Room',
                'Teacher-curated lesson notes organised by class, subject, and term. Adjustable font size, line spacing, and background theme. Your reading preferences are remembered between sessions.', 'lp-rv') +

              _feat('04', 'Public discussion chat',
                'A shared classroom for all students. Ask questions, share insights, help each other. @mention any classmate or Master Timothy directly and they receive a notification badge.', 'lp-rv d1') +

              _feat('05', 'Coaching task schedule',
                'Master Timothy assigns required practice sessions on specific dates with specific subjects. The app tracks your attendance automatically. You always know what is due and when.', 'lp-rv') +

              _feat('06', 'Progress that follows you',
                'Your results, your coaching history, your session count — all tracked and visible. Share your grade to WhatsApp or copy it to clipboard with a single tap immediately after any exam.', 'lp-rv d1') +

            '</div>' +
          '</div>' +
        '</section>' +

        /* ── HOW IT WORKS ── */
        '<section class="lp-section">' +
          '<div class="lp-section-inner">' +
            '<div class="lp-tag lp-rv">How it works</div>' +
            '<h2 class="lp-h2 lp-rv d1">From registration<br>to results in <em>minutes</em></h2>' +
            '<div class="lp-steps-row">' +

              _step('1', 'Register once',
                'Enter your name, class, school, and email. Your account is created immediately. No approval, no waiting.', 'lp-rv') +

              _step('2', 'Choose your subjects',
                'Select at least two subjects from your class bank, or follow the specific subjects Master Timothy has assigned for the day.', 'lp-rv d1') +

              _step('3', 'Sit the exam',
                'Work through questions at your pace within the time limit. Navigate freely between subjects. Return to any question before you submit.', 'lp-rv d2') +

              _step('4', 'Review and improve',
                'Read the explanation for every question. Understand exactly what you missed. Come back the next day and push the score higher.', 'lp-rv d3') +

            '</div>' +
          '</div>' +
        '</section>' +

        /* ── QUOTE ── */
        '<section class="lp-quote-band">' +
          '<div class="lp-quote-inner lp-rv">' +
            '<div class="lp-quote-kicker">From the teacher</div>' +
            '<div class="lp-quote-right">' +
              '<blockquote class="lp-quote-text" style="margin:0;">' +
                '&ldquo;Every student who practices consistently will find that the exam hall holds <em>no surprises.</em> ' +
                'This platform is your practice hall. Use it every day.&rdquo;' +
              '</blockquote>' +
              '<p class="lp-quote-attr">' +
                '&mdash; <strong>Master Timothy</strong>, Vertex Tutorial Centre' +
              '</p>' +
            '</div>' +
          '</div>' +
        '</section>' +

        /* ── FOOTER CTA ── */
        '<section class="lp-foot-cta">' +
          '<div class="lp-foot-cta-inner">' +
            '<div class="lp-rv">' +
              '<h2 class="lp-foot-h2">Ready to<br>begin <em>today?</em></h2>' +
              '<p class="lp-foot-sub">Join every Vertex Tutorial student already inside. It takes less than two minutes to register.</p>' +
            '</div>' +
            '<div class="lp-foot-cta-right lp-rv d2">' +
              '<button class="lp-cta-primary" onclick="Landing.goToLogin()">' +
                'Sign in to your account ' + ARROW +
              '</button>' +
              '<button class="lp-cta-text" onclick="Landing.goToRegister()">' +
                'No account yet? Register as a new student' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</section>' +

        /* ── FOOTER ── */
        '<footer class="lp-footer">' +
          '<div class="lp-footer-inner">' +
            '<span class="lp-footer-copy">' +
              'Vertex Tutorial Centre &mdash; Computer-Based Testing System. ' +
              'With care from <strong>Master Timothy</strong>.' +
            '</span>' +
            '<span class="lp-footer-copy" style="opacity:.5;">' +
              'For enrolled students only.' +
            '</span>' +
          '</div>' +
        '</footer>' +

      '</div>'
    );
  }

  /* ── Feature row builder ── */
  function _feat(num, title, body, cls) {
    return (
      '<div class="lp-feature ' + cls + '">' +
        '<span class="lp-feat-num">' + num + '</span>' +
        '<div>' +
          '<div class="lp-feat-title">' + title + '</div>' +
          '<p class="lp-feat-body">' + body + '</p>' +
        '</div>' +
      '</div>'
    );
  }

  /* ── Step builder ── */
  function _step(num, title, body, cls) {
    return (
      '<div class="lp-step ' + cls + '">' +
        '<div class="lp-step-circle">' + num + '</div>' +
        '<div class="lp-step-title">' + title + '</div>' +
        '<p class="lp-step-body">' + body + '</p>' +
      '</div>'
    );
  }

  /* ── Scroll nav shadow ── */
  function _initNav() {
    var nav = document.getElementById('lpNav');
    if (!nav) return;
    var fn = function () { nav.classList.toggle('scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', fn, { passive: true });
    window._lpCleanup = window._lpCleanup || [];
    window._lpCleanup.push(function () { window.removeEventListener('scroll', fn); });
  }

  /* ── IntersectionObserver scroll reveals ── */
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
    }, { threshold: 0.1, rootMargin: '0px 0px -36px 0px' });
    els.forEach(function (el) { obs.observe(el); });
    window._lpCleanup = window._lpCleanup || [];
    window._lpCleanup.push(function () { obs.disconnect(); });
  }

  /* ── Cleanup listeners when navigating away ── */
  function _cleanup() {
    (window._lpCleanup || []).forEach(function (fn) { fn(); });
    window._lpCleanup = [];
  }

  /* ── Render ── */
  function render() {
    _cleanup();
    window.scrollTo(0, 0);

    // Make #app fill full width, no padding
    var app = document.getElementById('app');
    if (app) {
      app.style.cssText = 'display:block;padding:0;min-height:100vh;';
    }

    UI.mount(_html());

    requestAnimationFrame(function () {
      _initNav();
      setTimeout(_initReveal, 60);
    });
  }

  /* ── Navigate to login ── */
  function goToLogin() {
    _cleanup();
    var app = document.getElementById('app');
    if (app) { app.style.cssText = ''; }
    Auth.renderLogin();
  }

  /* ── Navigate to register ── */
  function goToRegister() {
    _cleanup();
    var app = document.getElementById('app');
    if (app) { app.style.cssText = ''; }
    Auth.renderLogin();
    setTimeout(function () {
      if (window.Auth && typeof Auth.showRegister === 'function') Auth.showRegister();
    }, 60);
  }

  /* ── Public API ── */
  window.Landing = { render: render, goToLogin: goToLogin, goToRegister: goToRegister };

}());
