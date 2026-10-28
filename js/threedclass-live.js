/* ============================================================
   js/threedclass-live.js -- LIVE CLASS with Master Timothy AI
   ============================================================
   A real-time voice class:
     - Student talks (speech-to-text) or types.
     - Master Timothy answers by STREAMING a lesson from the Worker
       (POST /live). The stream is newline-delimited JSON:
           {"say":"..."}            -> spoken aloud + caption
           {"do":"add", ...}        -> changes the 3D stage / whiteboard
     - Speech and visuals are played in order, so what Timothy says
       and what appears on screen stay in sync.
     - The student can interrupt at any time (mic, typing, or tapping
       an object on the stage).

   Public API:  ThreeDLive.open(onBackCallback)

   Depends on (all already in the app):
     UI (mount, toast), AppState, SpeechEngine (speak, cancel),
     window.katex (optional, equations), Three.js r128 (loaded on demand)
   ============================================================ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════
     CONSTANTS
  ══════════════════════════════════════════════════ */

  const LIVE_URL    = 'https://vertex-worker.gbemigaakinde.workers.dev/live';
  const THREE_CDN   = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const ORBIT_CDN   = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
  const JSX_JS     = 'https://cdn.jsdelivr.net/npm/jsxgraph@1.9.2/distrib/jsxgraphcore.js';
  const JSX_CSS    = 'https://cdn.jsdelivr.net/npm/jsxgraph@1.9.2/distrib/jsxgraph.css';
  const MAX_OBJS    = 60;   // objects the AI may add by itself (presets are exempt)
  const MAX_BOARD   = 40;   // whiteboard items kept on screen
  const DEFAULT_CAM = { pos: [0, 4, 11], look: [0, 0, 0] };

  const TOPICS = [
    'The Solar System', 'Structure of the Atom', 'Projectile Motion',
    'Waves', 'The Pendulum', 'The Water Molecule', 'Quadratic Graphs',
  ];

  /* ══════════════════════════════════════════════════
     SMALL SAFE HELPERS
  ══════════════════════════════════════════════════ */

  function _num(v, def, min, max) {
    v = Number(v);
    if (!isFinite(v)) return def;
    return Math.min(max, Math.max(min, v));
  }

  function _vec(v, def) {
    if (!Array.isArray(v) || v.length < 3) return def.slice();
    return [_num(v[0], def[0], -12, 12), _num(v[1], def[1], -12, 12), _num(v[2], def[2], -12, 12)];
  }

  function _color(c, def) {
    return (typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) ? c : def;
  }

  function _id(v) {
    if (v == null) return null;
    const s = String(v).replace(/[^a-z0-9_\-]/gi, '').slice(0, 32);
    return s || null;
  }

  function _text(v, max) { return String(v == null ? '' : v).slice(0, max || 200); }

  function _el(id) { return document.getElementById(id); }

  function _toast(msg, type, ms) {
    if (window.UI && typeof UI.toast === 'function') UI.toast(msg, type || 'info', ms || 4000);
  }

  /* ══════════════════════════════════════════════════
     SAFE MATH EXPRESSION COMPILER  (for board graphs)
     Never uses eval. Supports: + - * / ^ ( ) x pi e
     and sin cos tan asin acos atan sqrt abs ln log exp.
  ══════════════════════════════════════════════════ */

  const _FUNCS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp,
  };
  const _FN_NAMES = Object.keys(_FUNCS).sort((a, b) => b.length - a.length);

  function _compileExpr(src) {
    src = String(src || '').slice(0, 120).toLowerCase()
      .replace(/\s+/g, '').replace(/\*\*/g, '^').replace(/\u03c0/g, 'pi');
    if (!src) throw new Error('empty');

    /* tokenise */
    const raw = [];
    let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (/[0-9.]/.test(ch)) {
        let j = i;
        while (j < src.length && /[0-9.]/.test(src[j])) j++;
        const n = parseFloat(src.slice(i, j));
        if (!isFinite(n)) throw new Error('bad number');
        raw.push({ t: 'n', v: n });
        i = j;
      } else if (/[a-z]/.test(ch)) {
        let j = i;
        while (j < src.length && /[a-z]/.test(src[j])) j++;
        let word = src.slice(i, j);
        while (word) {                       /* split things like "xsin" or "2xe" */
          const fn = _FN_NAMES.find(f => word.indexOf(f) === 0);
          if (fn)                    { raw.push({ t: 'f', v: fn });   word = word.slice(fn.length); }
          else if (word.indexOf('pi') === 0) { raw.push({ t: 'n', v: Math.PI, c: 1 }); word = word.slice(2); }
          else if (word[0] === 'x')  { raw.push({ t: 'x' });           word = word.slice(1); }
          else if (word[0] === 'e')  { raw.push({ t: 'n', v: Math.E, c: 1 }); word = word.slice(1); }
          else throw new Error('unknown name');
        }
        i = j;
      } else if ('+-*/^(),'.indexOf(ch) !== -1) {
        raw.push({ t: ch });
        i++;
      } else {
        throw new Error('bad character');
      }
    }

    /* implicit multiplication:  2x, 3(x+1), (x)(x+2), x sin(x) ... */
    const toks = [];
    raw.forEach(tk => {
      const prev = toks[toks.length - 1];
      const prevVal = prev && (prev.t === 'n' || prev.t === 'x' || prev.t === ')');
      const curStart = tk.t === 'n' || tk.t === 'x' || tk.t === 'f' || tk.t === '(';
      if (prevVal && curStart) toks.push({ t: '*' });
      toks.push(tk);
    });

    /* recursive-descent parser -> closure tree */
    let p = 0;
    const peek = () => toks[p];
    const eat  = t => { if (toks[p] && toks[p].t === t) { p++; return true; } return false; };

    function parseExpr() {
      let left = parseTerm();
      for (;;) {
        if (eat('+')) { const a = left, b = parseTerm(); left = x => a(x) + b(x); }
        else if (eat('-')) { const a = left, b = parseTerm(); left = x => a(x) - b(x); }
        else return left;
      }
    }
    function parseTerm() {
      let left = parseUnary();
      for (;;) {
        if (eat('*')) { const a = left, b = parseUnary(); left = x => a(x) * b(x); }
        else if (eat('/')) { const a = left, b = parseUnary(); left = x => a(x) / b(x); }
        else return left;
      }
    }
    function parseUnary() {
      if (eat('-')) { const a = parseUnary(); return x => -a(x); }
      if (eat('+')) return parseUnary();
      return parsePower();
    }
    function parsePower() {
      const base = parseAtom();
      if (eat('^')) { const ex = parseUnary(); return x => Math.pow(base(x), ex(x)); }
      return base;
    }
    function parseAtom() {
      const tk = peek();
      if (!tk) throw new Error('unexpected end');
      if (tk.t === 'n') { p++; const v = tk.v; return () => v; }
      if (tk.t === 'x') { p++; return x => x; }
      if (tk.t === 'f') {
        p++;
        if (!eat('(')) throw new Error('function needs (');
        const arg = parseExpr();
        if (!eat(')')) throw new Error('missing )');
        const fn = _FUNCS[tk.v];
        return x => fn(arg(x));
      }
      if (eat('(')) {
        const inner = parseExpr();
        if (!eat(')')) throw new Error('missing )');
        return inner;
      }
      throw new Error('unexpected token');
    }

    const fnc = parseExpr();
    if (p !== toks.length) throw new Error('unexpected token');
    return fnc;
  }

  /* ══════════════════════════════════════════════════
     NDJSON LINE PARSING  (tolerant of small model slips)
  ══════════════════════════════════════════════════ */

  /* Turn a lone backslash (invalid JSON escape, e.g. \alpha) into a valid one. */
  function _sanitizeBackslashes(s) {
    return s.replace(/\\(?!["\\\/bfnrtu])/g, '\\\\');
  }

  /* JSON turns "\frac" into form-feed+"rac", "\theta" into tab+"heta", etc.
     Undo that inside LaTeX so equations still render. */
  function _fixTex(s) {
    return String(s)
      .replace(/\f/g, '\\f').replace(/\t/g, '\\t').replace(/\x08/g, '\\b')
      .replace(/\r/g, '\\r').replace(/\n/g, '\\n');
  }

  function _parseLine(line) {
    line = line.trim();
    if (!line || /^```/.test(line)) return [];
    const out = [];

    function tryParse(str) {
      try { return JSON.parse(_sanitizeBackslashes(str)); } catch (e) { return undefined; }
    }

    if (line[0] !== '{') {
      /* model forgot JSON: treat it as something to say */
      const plain = line.replace(/^["'\s]+|["'\s,]+$/g, '');
      return plain.length > 1 ? [{ say: plain }] : [];
    }

    let obj = tryParse(line);
    if (obj !== undefined) { if (obj && typeof obj === 'object') out.push(obj); return out; }

    /* several objects glued on one line: {"a":1}{"b":2} */
    const pieces = line.split(/\}\s*(?=\{)/).map((s, i, a) => (i < a.length - 1 ? s + '}' : s));
    if (pieces.length > 1) {
      pieces.forEach(pc => {
        const o = tryParse(pc);
        if (o && typeof o === 'object') out.push(o);
      });
    }
    return out;
  }

  /* ══════════════════════════════════════════════════
     THREE.JS LOADER  (reuses the r128 build other modules load)
  ══════════════════════════════════════════════════ */

  let _T = null;
  let _loadQueue = [];

  function _findThree() {
    const cands = [window._vtxLiveTHREE, window._vtxPhysTHREE, window.THREE];
    for (let i = 0; i < cands.length; i++) {
      const c = cands[i];
      if (c && String(c.REVISION) === '128' && c.OrbitControls) return c;
    }
    return null;
  }

  function _loadThree(cb) {
    if (_T) { cb(true); return; }
    const found = _findThree();
    if (found) { _T = found; window._vtxLiveTHREE = found; cb(true); return; }

    _loadQueue.push(cb);
    if (_loadQueue.length > 1) return;

    function flush(ok) {
      const fns = _loadQueue.slice();
      _loadQueue = [];
      fns.forEach(fn => fn(ok));
    }

    const s1 = document.createElement('script');
    s1.src = THREE_CDN;
    s1.onload = () => {
      window._vtxLiveTHREE = window.THREE;
      _T = window.THREE;
      const s2 = document.createElement('script');
      s2.src = ORBIT_CDN;
      s2.onload  = () => flush(true);
      s2.onerror = () => flush(true);   /* still works, just no touch-orbit */
      document.head.appendChild(s2);
    };
    s1.onerror = () => flush(false);
    document.head.appendChild(s1);
  }

  /* ══════════════════════════════════════════════════
     SESSION STATE
  ══════════════════════════════════════════════════ */

  let _onBack = null;

  const G = {
    gen: 0,              // bumps on every interruption: stale callbacks ignore themselves
    history: [],         // chat history sent to the teacher
    topic: '',
    started: false,
    fetching: false,
    speaking: false,
    pumping: false,
    queue: [],           // pending {k:'say'|'do'} items, played in order
    lineBuf: '',
    ctrl: null,          // AbortController of the in-flight request
    handsFree: false,
    rec: null,
    listening: false,
    recLang: 'en-NG',
    emptyListens: 0,
    mobileTab: 'stage',
    speakTimer: null,
    plan: [], cur: -1, curDone: true, turns: 0, retries: 0,
    awaiting: false, finished: false, paused: false,
    kind: 'qa', contTimer: null, awaitTimer: null,
  };

  const S = {            // 3D stage state
    renderer: null, scene: null, camera: null, controls: null, grid: null,
    raf: 0, last: 0, t: 0, ro: null,
    objs: new Map(), tweens: [], updaters: [],
    ray: null, ptr: null, onResize: null,
  };

  function _busy() { return G.fetching || G.speaking || G.queue.length > 0; }

  /* ══════════════════════════════════════════════════
     OPEN / CLOSE
  ══════════════════════════════════════════════════ */

  function open(onBackCallback) {
    _onBack = onBackCallback || null;
    _destroy();
    G.history = []; G.topic = ''; G.started = false; G.handsFree = false;
    G.mobileTab = 'stage'; G.emptyListens = 0;
    G.plan = []; G.cur = -1; G.curDone = true; G.turns = 0; G.retries = 0;
    G.awaiting = false; G.finished = false; G.paused = false; G.kind = 'qa';
    _render();
  }

  function _back() {
    _destroy();
    if (typeof _onBack === 'function') _onBack();
    else if (window.ThreeDClass && ThreeDClass._backToHub) ThreeDClass._backToHub();
  }

  function _destroy() {
    _interrupt();
    _stopListening(false);
    if (S.raf) cancelAnimationFrame(S.raf);
    S.raf = 0;
    clearTimeout(S.frameT); S.shotAt = 0; S.userAt = 0;
    if (S.ro) { try { S.ro.disconnect(); } catch (e) {} S.ro = null; }
    if (S.onResize) { window.removeEventListener('resize', S.onResize); S.onResize = null; }
    if (S.scene) {
      S.scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
        }
      });
    }
    if (S.controls) { try { S.controls.dispose(); } catch (e) {} }
    if (S.renderer) { try { S.renderer.dispose(); } catch (e) {} }
    S.renderer = S.scene = S.camera = S.controls = S.grid = null;
    S.objs = new Map(); S.tweens = []; S.updaters = [];
    G.started = false;
  }

  /* ══════════════════════════════════════════════════
     RENDER UI
  ══════════════════════════════════════════════════ */

  function _render() {
    const topicChips = TOPICS.map(t =>
      `<button class="lv-chip" data-topic="${t}">${t}</button>`).join('');

    UI.mount(`
      <div id="lv-shell">
        <div id="lv-top">
          <button id="lv-back" class="lv-btn"><i class="ph ph-arrow-left"></i> Back</button>
          <div class="lv-title">
            <div class="lv-h1">Live Class</div>
            <div class="lv-sub" id="lv-topic">with Master Timothy AI</div>
          </div>
          <div id="lv-status" class="lv-pill" data-s="idle">
            <span class="lv-bars"><i></i><i></i><i></i><i></i></span>
            <span id="lv-status-text">Ready</span>
          </div>
        </div>

        <div id="lv-progress" style="display:none;">
          <div id="lv-prog-text"></div>
          <div id="lv-prog-bar"><i id="lv-prog-fill"></i></div>
        </div>

        <div id="lv-tabs">
          <button class="lv-tab active" data-tab="stage">3D Stage</button>
          <button class="lv-tab" data-tab="board">Whiteboard<span class="lv-dot" id="lv-dot-board"></span></button>
          <button class="lv-tab" data-tab="notes">Class Notes</button>
        </div>

        <div id="lv-main">
          <section class="lv-panel active" data-panel="stage" id="lv-stage-panel">
            <div id="lv-stage"></div>
            <div id="lv-caption"></div>
            <div id="lv-stage-tools">
              <button class="lv-mini" id="lv-reset-cam" title="Reset view"><i class="ph ph-arrows-clockwise"></i> View</button>
            </div>
            <div id="lv-loading">Loading 3D stage…</div>
          </section>

          <div id="lv-side">
            <section class="lv-panel" data-panel="board" id="lv-board-panel">
              <div id="lv-wb">
                <div id="lv-wb-frame">
                  <div id="lv-wb-surface">
                    <div id="lv-board"><div class="lv-empty">Master Timothy will write key points, equations and graphs here.</div></div>
                    <canvas id="lv-ink"></canvas>
                  </div>
                  <div id="lv-wb-tray">
                    <button class="lv-tool active" data-tool="hand" title="Scroll the board">&#9995;</button>
                    <button class="lv-tool" data-tool="pen" title="Pen: sketch or write">&#9999;&#65039;</button>
                    <button class="lv-tool" data-tool="eraser" title="Eraser">&#129533;</button>
                    <span class="lv-sep"></span>
                    <button class="lv-marker" data-color="#1d4ed8" style="--mc:#1d4ed8" title="Blue"></button>
                    <button class="lv-marker" data-color="#dc2626" style="--mc:#dc2626" title="Red"></button>
                    <button class="lv-marker" data-color="#16a34a" style="--mc:#16a34a" title="Green"></button>
                    <button class="lv-marker" data-color="#111827" style="--mc:#111827" title="Black"></button>
                    <span class="lv-sep"></span>
                    <button class="lv-tool" id="lv-ink-undo" title="Undo stroke">&#8630;</button>
                    <button class="lv-tool" id="lv-ink-clear" title="Clear my drawing">&#128465;</button>
                  </div>
                </div>
              </div>
            </section>
            <section class="lv-panel" data-panel="notes" id="lv-notes-panel">
              <div class="lv-ptitle">Class Notes</div>
              <div id="lv-notes"></div>
            </section>
          </div>
        </div>

        <div id="lv-controls">
          <div id="lv-row">
            <button id="lv-mic" class="lv-mic" title="Talk to Master Timothy">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>
            </button>
            <input id="lv-input" type="text" autocomplete="off" maxlength="400" placeholder="Ask a question or answer Master Timothy…" />
            <button id="lv-send" class="lv-send">Send</button>
            <button id="lv-stop" class="lv-stop" title="Pause class" style="display:none;"><i class="ph ph-pause"></i></button>
            <button id="lv-resume" class="lv-stop lv-resume" title="Resume class" style="display:none;"><i class="ph ph-play"></i></button>
          </div>
          <div id="lv-opts">
            <label class="lv-toggle"><input type="checkbox" id="lv-hf" /> Hands-free (auto-listen)</label>
            <span class="lv-hint">Tip: tap any object in 3D to ask about it.</span>
          </div>
        </div>

        <div id="lv-start">
          <div class="lv-card">
            <div class="lv-card-icon"><i class="ph ph-chalkboard-teacher"></i></div>
            <h2>Join a Live Class</h2>
            <p>Master Timothy AI will teach you out loud, build 3D models and write on the whiteboard. Talk to him or type. You can interrupt any time.</p>
            <div class="lv-chips">${topicChips}</div>
            <input id="lv-topic-input" type="text" maxlength="100" placeholder="…or type any topic you want to learn" />
            <button id="lv-begin" class="lv-begin">Start Class</button>
            <div class="lv-note">Use headphones for the best hands-free experience.</div>
          </div>
        </div>
      </div>
      <style>${_css()}</style>`);

    _bindUI();
    _initInk();
    _loadFont();
    _setTab('stage');
    _loadThree(ok => {
      if (!ok || !_T) {
        const l = _el('lv-loading');
        if (l) l.textContent = '3D could not load. Check your internet connection and reopen.';
        return;
      }
      requestAnimationFrame(_initStage);
    });
  }

  function _css() {
    return `
    #lv-shell{position:relative;display:flex;flex-direction:column;height:100dvh;background:var(--bg-page);font-family:var(--font);overflow:hidden;}
    #lv-top{display:flex;align-items:center;gap:.6rem;padding:.55rem .75rem;border-bottom:1px solid var(--border);background:var(--bg-base);flex-shrink:0;}
    .lv-btn{font-size:var(--text-sm);font-weight:500;color:var(--text-2);background:var(--bg-subtle);border:1px solid var(--border);border-radius:var(--r-md);padding:.3rem .6rem;cursor:pointer;font-family:var(--font);white-space:nowrap;}
    .lv-title{min-width:0;flex:1;}
    .lv-h1{font-size:var(--text-md);font-weight:700;color:var(--text-1);line-height:1.2;}
    .lv-sub{font-size:var(--text-xs);color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .lv-pill{display:inline-flex;align-items:center;gap:.4rem;font-size:.7rem;font-weight:700;padding:.25rem .6rem;border-radius:99px;border:1px solid var(--border);background:var(--bg-subtle);color:var(--text-2);white-space:nowrap;}
    .lv-pill[data-s="speaking"]{background:var(--accent-subtle);color:var(--accent-text,var(--accent));border-color:var(--accent-border,var(--accent));}
    .lv-pill[data-s="listening"]{background:#fee2e2;color:#b91c1c;border-color:#fca5a5;}
    .lv-pill[data-s="thinking"]{background:#fef3c7;color:#92400e;border-color:#fcd34d;}
    .lv-bars{display:inline-flex;align-items:flex-end;gap:2px;height:12px;}
    .lv-bars i{display:block;width:3px;height:3px;background:currentColor;border-radius:2px;opacity:.5;}
    .lv-pill[data-s="speaking"] .lv-bars i,.lv-pill[data-s="listening"] .lv-bars i{animation:lv-bar .8s ease-in-out infinite;opacity:1;}
    .lv-bars i:nth-child(2){animation-delay:.15s!important}.lv-bars i:nth-child(3){animation-delay:.3s!important}.lv-bars i:nth-child(4){animation-delay:.45s!important}
    @keyframes lv-bar{0%,100%{height:3px}50%{height:12px}}
    #lv-tabs{display:flex;gap:.4rem;padding:.4rem .75rem;border-bottom:1px solid var(--border);background:var(--bg-base);flex-shrink:0;}
    .lv-tab{position:relative;font-size:.7rem;font-weight:700;letter-spacing:.03em;text-transform:uppercase;padding:.3rem .75rem;border-radius:99px;border:1.5px solid var(--border);background:var(--bg-subtle);color:var(--text-2);cursor:pointer;font-family:var(--font);}
    .lv-tab.active{background:var(--accent);color:#fff;border-color:var(--accent);}
    .lv-dot{display:none;position:absolute;top:-2px;right:-2px;width:9px;height:9px;border-radius:50%;background:#ef4444;}
    .lv-dot.on{display:block;}
    #lv-main{flex:1 1 0;min-height:0;display:flex;position:relative;}
    .lv-panel{display:none;flex:1;min-width:0;min-height:0;position:relative;}
    .lv-panel.active{display:flex;flex-direction:column;}
    #lv-side{display:contents;}
    #lv-stage-panel{background:#0b1220;}
    #lv-stage{position:absolute;inset:0;touch-action:none;}
    #lv-stage canvas{display:block;width:100%;height:100%;}
    #lv-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:var(--text-sm);pointer-events:none;text-align:center;padding:1rem;}
    #lv-caption{position:absolute;left:.75rem;right:.75rem;bottom:.75rem;padding:.6rem .85rem;border-radius:var(--r-lg);background:rgba(8,12,24,.78);color:#f8fafc;font-size:.95rem;line-height:1.45;font-weight:500;backdrop-filter:blur(6px);display:none;pointer-events:none;}
    #lv-stage-tools{position:absolute;top:.5rem;right:.5rem;display:flex;gap:.4rem;}
    .lv-mini{font-size:.7rem;font-weight:700;padding:.25rem .55rem;border-radius:var(--r-md);border:1px solid rgba(255,255,255,.2);background:rgba(15,23,42,.7);color:#e2e8f0;cursor:pointer;font-family:var(--font);}
    .lv-ptitle{font-size:.7rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--text-3);padding:.5rem .85rem .25rem;flex-shrink:0;}
    #lv-board,#lv-notes{flex:1;min-height:0;overflow-y:auto;padding:.5rem .85rem 1rem;background:var(--bg-base);}
    .lv-empty{color:var(--text-4);font-size:var(--text-sm);padding:1rem 0;}
    .lv-b-title{font-size:1.1rem;font-weight:800;color:var(--text-1);margin:.5rem 0 .35rem;animation:lv-in .35s ease;}
    .lv-b-line{font-size:.95rem;color:var(--text-2);line-height:1.5;margin:.3rem 0;animation:lv-in .35s ease;}
    .lv-b-eq{margin:.5rem 0;padding:.5rem .75rem;background:var(--accent-subtle);border-radius:var(--r-md);overflow-x:auto;animation:lv-in .35s ease;}
    .lv-b-table{border-collapse:collapse;margin:.5rem 0;font-size:.85rem;animation:lv-in .35s ease;}
    .lv-b-table th,.lv-b-table td{border:1px solid var(--border);padding:.3rem .6rem;text-align:left;color:var(--text-2);}
    .lv-b-table th{background:var(--bg-subtle);color:var(--text-1);}
    .lv-graph{margin:.5rem 0;animation:lv-in .35s ease;}
    .lv-graph svg{width:100%;height:auto;max-width:460px;background:var(--bg-subtle);border:1px solid var(--border);border-radius:var(--r-md);}
    .lv-graph .cap{font-size:.75rem;color:var(--text-3);margin-top:.2rem;}
    #lv-wb{flex:1;min-height:0;display:flex;flex-direction:column;padding:.5rem;background:var(--bg-base);}
    #lv-wb-frame{flex:1;min-height:0;display:flex;flex-direction:column;border-radius:12px;padding:9px 9px 0;background:linear-gradient(180deg,#eef0f3,#aeb4bf 55%,#cfd4dc);box-shadow:0 6px 18px rgba(0,0,0,.35),inset 0 1px 0 #fff;}
    #lv-wb-surface{position:relative;flex:1;min-height:0;overflow:hidden;border-radius:4px;background:radial-gradient(ellipse at 20% 15%,rgba(255,255,255,.9),rgba(255,255,255,0) 60%),linear-gradient(135deg,#fdfdfd,#f4f6f8 60%,#fbfcfd);box-shadow:inset 0 0 0 1px rgba(0,0,0,.18),inset 0 8px 16px rgba(0,0,0,.07);}
    #lv-wb-surface #lv-board{position:absolute;inset:0;overflow-y:auto;padding:14px 20px 40px;background:transparent;color:#111827;font-family:'Caveat','Segoe Print','Bradley Hand','Comic Sans MS',cursive;}
    #lv-ink{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;touch-action:none;}
    #lv-wb-surface.pen #lv-ink{pointer-events:auto;cursor:crosshair;}
    #lv-wb-surface #lv-board .lv-empty{color:#94a3b8;font-size:1.35rem;font-style:italic;}
    #lv-board .lv-b-title{font-size:2rem;font-weight:700;color:#1e3a8a;margin:.2rem 0 .5rem;padding-bottom:.25rem;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='6' viewBox='0 0 40 6'%3E%3Cpath d='M0 3 Q5 0 10 3 T20 3 T30 3 T40 3' fill='none' stroke='%231e3a8a' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") repeat-x left bottom;animation:lv-wipe var(--wd,1s) ease-out both;}
    #lv-board .lv-b-line{font-size:1.5rem;line-height:1.35;color:#111827;margin:.15rem 0;animation:lv-wipe var(--wd,1s) ease-out both;}
    #lv-board .lv-b-eq{margin:.6rem 0;padding:.3rem .6rem;border:none;border-left:0;background:transparent;color:#be123c;font-size:1.25rem;animation:lv-wipe 1.2s ease-out both;}
    #lv-board .lv-b-table{border-collapse:collapse;margin:.6rem 0;font-size:1.35rem;animation:lv-wipe 1.2s ease-out both;}
    #lv-board .lv-b-table th,#lv-board .lv-b-table td{border:2px solid #334155;padding:.15rem .8rem;color:#111827;background:transparent;}
    #lv-board .lv-b-table th{color:#1e3a8a;}
    #lv-board .lv-graph{animation:lv-wipe 1.2s ease-out both;}
    #lv-board .lv-graph svg{background:#fff;border:2px solid #94a3b8;}
    #lv-board .lv-graph .cap{font-size:1.25rem;color:#1e3a8a;}
    .lv-jxg{width:100%;max-width:480px;aspect-ratio:3/2;background:#fff;border:2px solid #94a3b8;border-radius:8px;overflow:hidden;touch-action:none;}
    @keyframes lv-wipe{from{clip-path:inset(0 100% 0 0);}to{clip-path:inset(0 0 0 0);}}
    #lv-wb-tray{display:flex;align-items:center;justify-content:center;gap:.3rem;flex-wrap:nowrap;flex-shrink:0;margin:8px -9px 0;padding:7px 10px;background:linear-gradient(180deg,#9aa1ad,#c9ced6 40%,#8e95a1);border-radius:0 0 12px 12px;box-shadow:inset 0 2px 3px rgba(0,0,0,.25);}
    .lv-tool{flex-shrink:0;padding:0 .3rem;border:1px solid rgba(0,0,0,.25);background:#f1f5f9;border-radius:8px;min-width:32px;height:30px;font-size:1rem;cursor:pointer;color:#111827;}
    .lv-tool.active{background:#fde68a;border-color:#b45309;box-shadow:0 0 0 2px rgba(180,83,9,.35);}
    .lv-marker{flex-shrink:0;width:34px;height:15px;border-radius:8px 4px 4px 8px;border:1px solid rgba(0,0,0,.4);background:linear-gradient(90deg,var(--mc) 0 70%,#e5e7eb 70% 100%);cursor:pointer;padding:0;box-shadow:0 2px 3px rgba(0,0,0,.3);}
    .lv-marker.active{transform:translateY(-4px);outline:2px solid #fff;}
    .lv-sep{flex-shrink:0;width:1px;height:20px;background:rgba(0,0,0,.25);}
    @media (max-width:420px){.lv-marker{width:26px;}.lv-tool{min-width:28px;}#lv-wb{padding:.3rem;}#lv-board .lv-b-title{font-size:1.7rem;}#lv-board .lv-b-line{font-size:1.3rem;}}
    #lv-wb-surface #lv-board{-webkit-overflow-scrolling:touch;overscroll-behavior:contain;}

    @keyframes lv-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    .lv-msg{margin:.4rem 0;padding:.5rem .7rem;border-radius:var(--r-lg);font-size:.88rem;line-height:1.45;max-width:92%;}
    .lv-msg.t{background:var(--accent-subtle);color:var(--text-1);border:1px solid var(--accent-border,var(--border));}
    .lv-msg.u{background:var(--bg-subtle);color:var(--text-1);border:1px solid var(--border);margin-left:auto;}
    .lv-msg b{display:block;font-size:.65rem;letter-spacing:.04em;text-transform:uppercase;color:var(--text-3);margin-bottom:2px;}
    #lv-controls{flex-shrink:0;padding:.55rem .75rem calc(.55rem + env(safe-area-inset-bottom,0px));border-top:1px solid var(--border);background:var(--bg-base);}
    #lv-row{display:flex;align-items:center;gap:.5rem;}
    .lv-mic{width:46px;height:46px;border-radius:50%;border:none;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:transform .15s;}
    .lv-mic.on{background:#dc2626;animation:lv-pulse 1.2s infinite;}
    @keyframes lv-pulse{0%{box-shadow:0 0 0 0 rgba(220,38,38,.5)}70%{box-shadow:0 0 0 14px rgba(220,38,38,0)}100%{box-shadow:0 0 0 0 rgba(220,38,38,0)}}
    #lv-input{flex:1;min-width:0;font-size:16px;padding:.65rem .85rem;border-radius:var(--r-lg);border:1.5px solid var(--border);background:var(--bg-subtle);color:var(--text-1);font-family:var(--font);outline:none;}
    #lv-input:focus{border-color:var(--accent);}
    .lv-send{padding:.65rem 1rem;border-radius:var(--r-lg);border:none;background:var(--accent);color:#fff;font-weight:700;cursor:pointer;font-family:var(--font);}
    .lv-stop{width:42px;height:42px;border-radius:var(--r-lg);border:1.5px solid var(--border);background:var(--bg-subtle);color:var(--text-1);cursor:pointer;font-size:.9rem;}
    #lv-opts{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-top:.4rem;flex-wrap:wrap;}
    .lv-toggle{font-size:.75rem;color:var(--text-2);display:inline-flex;align-items:center;gap:.35rem;cursor:pointer;}
    .lv-hint{font-size:.7rem;color:var(--text-4);}
    #lv-start{position:absolute;inset:0;z-index:20;background:rgba(10,15,30,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto;}
    .lv-card{background:var(--bg-base);border:1px solid var(--border);border-radius:var(--r-xl);padding:1.5rem;max-width:460px;width:100%;box-shadow:var(--shadow-lg,0 20px 50px rgba(0,0,0,.3));text-align:center;}
    .lv-card-icon{font-size:2.4rem;margin-bottom:.4rem;color:var(--accent,#3b82f6);display:flex;justify-content:center;}
    .lv-resume{background:var(--accent,#3b82f6);color:#fff;border-color:transparent;}
    .lv-stop i,.lv-btn i,.lv-mini i{vertical-align:-.12em;}
    #lv-progress{padding:.35rem .75rem;border-bottom:1px solid var(--border);background:var(--bg-base);flex-shrink:0;}
    #lv-prog-text{font-size:.72rem;font-weight:600;color:var(--text-2);margin-bottom:.25rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    #lv-prog-bar{height:4px;border-radius:4px;background:var(--bg-subtle);overflow:hidden;}
    #lv-prog-fill{display:block;height:100%;width:0;background:var(--accent,#3b82f6);transition:width .5s ease;}
    .lv-card h2{font-size:var(--text-xl);font-weight:800;color:var(--text-1);margin:0 0 .4rem;}
    .lv-card p{font-size:var(--text-sm);color:var(--text-3);line-height:1.55;margin:0 0 1rem;}
    .lv-chips{display:flex;flex-wrap:wrap;gap:.4rem;justify-content:center;margin-bottom:.75rem;}
    .lv-chip{font-size:.78rem;font-weight:600;padding:.35rem .75rem;border-radius:99px;border:1.5px solid var(--border);background:var(--bg-subtle);color:var(--text-2);cursor:pointer;font-family:var(--font);}
    .lv-chip.sel{background:var(--accent);color:#fff;border-color:var(--accent);}
    #lv-topic-input{width:100%;box-sizing:border-box;font-size:16px;padding:.65rem .85rem;border-radius:var(--r-lg);border:1.5px solid var(--border);background:var(--bg-subtle);color:var(--text-1);font-family:var(--font);margin-bottom:.75rem;outline:none;}
    .lv-begin{width:100%;padding:.8rem;border-radius:var(--r-lg);border:none;background:var(--accent);color:#fff;font-size:var(--text-md);font-weight:800;cursor:pointer;font-family:var(--font);}
    .lv-note{font-size:.7rem;color:var(--text-4);margin-top:.6rem;}
    @media (min-width:900px){
      #lv-tabs{display:none;}
      #lv-main{display:grid;grid-template-columns:1.6fr 1fr;grid-template-rows:1fr;}
      #lv-side{display:grid;grid-template-rows:2.4fr 1fr;min-height:0;border-left:1px solid var(--border);}
      .lv-panel{display:flex;flex-direction:column;}
      #lv-stage-panel{grid-column:1;}
      #lv-board-panel,#lv-notes-panel{background:var(--bg-base);}
      #lv-notes-panel{border-top:1px solid var(--border);}
    }`;
  }

  /* ══════════════════════════════════════════════════
     UI WIRING
  ══════════════════════════════════════════════════ */

  function _bindUI() {
    _el('lv-back').addEventListener('click', _back);

    document.querySelectorAll('.lv-tab').forEach(b =>
      b.addEventListener('click', () => _setTab(b.getAttribute('data-tab'))));

    document.querySelectorAll('.lv-chip').forEach(b =>
      b.addEventListener('click', () => {
        document.querySelectorAll('.lv-chip').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        _el('lv-topic-input').value = b.getAttribute('data-topic');
      }));

    _el('lv-begin').addEventListener('click', _beginClass);
    _el('lv-topic-input').addEventListener('keydown', e => { if (e.key === 'Enter') _beginClass(); });

    _el('lv-send').addEventListener('click', _sendTyped);
    _el('lv-input').addEventListener('keydown', e => { if (e.key === 'Enter') _sendTyped(); });
    _el('lv-mic').addEventListener('click', _micToggle);
    _el('lv-stop').addEventListener('click', _pause);
    _el('lv-resume').addEventListener('click', _resumeClass);
    _el('lv-input').addEventListener('input', () => { clearTimeout(G.awaitTimer); });
    _el('lv-reset-cam').addEventListener('click', () => _cameraTo(DEFAULT_CAM.pos, DEFAULT_CAM.look, 700));
    _el('lv-hf').addEventListener('change', e => {
      G.handsFree = !!e.target.checked;
      G.emptyListens = 0;
      if (G.handsFree && G.started && !_busy() && !G.listening) _startListening();
      if (!G.handsFree && G.listening) _stopListening(false);
    });
  }

  function _setTab(tab) {
    G.mobileTab = tab;
    document.querySelectorAll('.lv-tab').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
    document.querySelectorAll('.lv-panel').forEach(p => p.classList.toggle('active', p.getAttribute('data-panel') === tab));
    if (tab === 'board') { const d = _el('lv-dot-board'); if (d) d.classList.remove('on'); }
    setTimeout(_resize, 30);
  }

  function _setStatus(s) {
    const pill = _el('lv-status'), txt = _el('lv-status-text');
    if (!pill) return;
    pill.setAttribute('data-s', s);
    txt.textContent = ({
      idle: 'Ready', thinking: 'Thinking…', speaking: 'Master Timothy is speaking',
      listening: 'Listening…', paused: 'Paused', done: 'Class complete',
    })[s] || 'Ready';
    const stop = _el('lv-stop');
    if (stop) stop.style.display = (s === 'thinking' || s === 'speaking') ? '' : 'none';
    const rs = _el('lv-resume');
    if (rs) rs.style.display = (s === 'paused') ? '' : 'none';
  }

  function _caption(text) {
    const c = _el('lv-caption');
    if (!c) return;
    if (!text) { c.style.display = 'none'; c.textContent = ''; return; }
    c.textContent = text;
    c.style.display = 'block';
  }

  function _note(who, text) {
    const box = _el('lv-notes');
    if (!box) return;
    const d = document.createElement('div');
    d.className = 'lv-msg ' + (who === 'you' ? 'u' : 't');
    const b = document.createElement('b');
    b.textContent = who === 'you' ? 'You' : 'Master Timothy';
    const p = document.createElement('span');
    p.textContent = text;
    d.appendChild(b); d.appendChild(p);
    box.appendChild(d);
    while (box.children.length > 80) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  }

  /* ══════════════════════════════════════════════════
     START CLASS
  ══════════════════════════════════════════════════ */

  function _beginClass() {
    const typed = (_el('lv-topic-input').value || '').trim();
    const topic = typed || 'a topic of my choice';
    G.topic = topic;
    G.started = true;
    const ov = _el('lv-start'); if (ov) ov.remove();
    const tl = _el('lv-topic'); if (tl) tl.textContent = typed ? typed : 'with Master Timothy AI';

    const sd   = (window.AppState && AppState.studentData) || {};
    const first = String(sd.name || '').trim().split(/\s+/)[0] || 'my friend';

    /* Greet immediately (inside the tap, so phones allow audio) while the
       first lesson request is already travelling to the Worker. */
    G.queue.push({
      k: 'say',
      text: typed
        ? `Welcome to class, ${first}! Today we are learning about ${typed}. Watch the stage.`
        : `Welcome to class, ${first}! Tell me what you would like to learn today.`,
    });
    _pump();

    if (typed) {
      G.cur = 0; G.curDone = false;
      _ask('[START] Begin the lesson on: ' + typed + '. I have already greeted the student. FIRST output the lesson plan as one {"do":"plan","steps":[...]} line (4 to 6 short step titles, the last one a recap with a quick check). THEN teach step 1 only, with visuals and speech.',
        { display: null, noInterrupt: true, kind: 'lesson' });
    } else {
      _setStatus('idle');
    }
  }

  /* ══════════════════════════════════════════════════
     ASKING THE TEACHER  (streaming)
  ══════════════════════════════════════════════════ */

  function _sendTyped() {
    const inp = _el('lv-input');
    if (!inp || !G.started) return;
    const t = inp.value.trim();
    if (!t) return;
    inp.value = '';
    _ask(t);
  }

  function _studentId() {
    const sd = (window.AppState && AppState.studentData) || {};
    try {
      if (window.firebase && firebase.auth && firebase.auth().currentUser) return firebase.auth().currentUser.uid;
    } catch (e) {}
    return sd.id || sd.uid || sd.name || 'anon';
  }

  function _sceneSummary() {
    const parts = [];
    S.objs.forEach((e, id) => {
      if (parts.length >= 40) return;
      const p = e.obj.position;
      parts.push(`${id}=${e.shape}${e.label ? '("' + e.label.slice(0, 24) + '")' : ''}@${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`);
    });
    const bc = _el('lv-board') ? _el('lv-board').querySelectorAll('[data-bi]').length : 0;
    return (parts.join('; ') || 'empty') + ' | whiteboard items: ' + bc;
  }

  function _ask(text, opts) {
    opts = opts || {};
    text = String(text || '').trim();
    if (!text || !G.started) return;

    if (!opts.noInterrupt) _interrupt();
    const myGen = G.gen;
    G.kind = opts.kind || 'qa';
    G.paused = false;
    G.finished = G.finished && G.kind === 'lesson';
    clearTimeout(G.contTimer); clearTimeout(G.awaitTimer);
    if (G.kind === 'qa') { G.awaiting = false; G.retries = 0; }
    G.turnProduced = 0;

    G.history.push({ role: 'user', content: text.slice(0, 600) });
    if (G.history.length > 20) G.history = G.history.slice(-20);
    if (opts.display !== null) _note('you', opts.display || text);

    _setStatus('thinking');
    G.fetching = true;
    G.lineBuf = '';
    const ctrl = new AbortController();
    G.ctrl = ctrl;
    const sd = (window.AppState && AppState.studentData) || {};
    const produced = [];   // raw lines kept for history

    _getToken().then(tok => fetch(LIVE_URL, {
      method:  'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { 'Authorization': 'Bearer ' + tok } : {}),
      signal:  ctrl.signal,
      body: JSON.stringify({
        studentId:    _studentId(),
        studentName:  sd.name  || '',
        studentClass: sd.class || '',
        topic:        G.topic,
        scene:        _sceneSummary(),
        history:      G.history,
      }),
    }))
    .then(res => {
      if (!res.ok) {
        return res.json().catch(() => ({})).then(j => {
          const err = new Error(j.message || j.error || ('HTTP ' + res.status));
          err.status = res.status; throw err;
        });
      }
      return _readStream(res, myGen, produced);
    })
    .then(() => {
      if (myGen !== G.gen) return;
      G.fetching = false;
      G.ctrl = null;
      _flushLineBuf(produced);
      if (!produced.length && G.kind === 'lesson') G.retries++;
      else if (produced.length) G.retries = 0;
      if (produced.length) {
        let kept = '';
        for (let i = 0; i < produced.length; i++) {
          if ((kept + produced[i]).length > 1700) break;
          kept += produced[i] + '\n';
        }
        G.history.push({ role: 'assistant', content: kept.trim() });
      } else {
        G.history.pop();    // nothing came back; drop the unanswered question
      }
      _pump();
    })
    .catch(err => {
      if (myGen !== G.gen || (err && err.name === 'AbortError')) return;
      G.fetching = false; G.ctrl = null;
      G.history.pop();
      if (G.kind === 'lesson' && G.retries < 2 && !(err && (err.status === 429 || err.status === 401))) {
        G.retries++;
        _setStatus('thinking');
        clearTimeout(G.contTimer);
        G.contTimer = setTimeout(() => _continue(true), 1500);
        return;
      }
      const msg = (err && (err.status === 429 || err.status === 401) && err.message)
        ? err.message
        : 'I lost my connection for a moment. Please ask me again.';
      _caption(msg);
      _toast(msg, 'error', 5000);
      if (!G.queue.length && !G.speaking) _setStatus('idle');
      else _pump();
    });
  }

  function _readStream(res, gen, produced) {
    function feed(delta) {
      G.lineBuf += delta;
      let nl;
      while ((nl = G.lineBuf.indexOf('\n')) !== -1) {
        const line = G.lineBuf.slice(0, nl);
        G.lineBuf = G.lineBuf.slice(nl + 1);
        _acceptLine(line, produced);
      }
    }

    function eatSSE(chunkText) {
      chunkText.split('\n').forEach(l => {
        l = l.trim();
        if (l.indexOf('data:') !== 0) return;
        const payload = l.slice(5).trim();
        if (!payload || payload === '[DONE]') return;
        try {
          const j = JSON.parse(payload);
          const ch = j.choices && j.choices[0];
          const d  = ch && ((ch.delta && ch.delta.content) || (ch.message && ch.message.content));
          if (d) feed(d);
        } catch (e) { /* partial or non-JSON keep-alive */ }
      });
    }

    if (!res.body || !res.body.getReader) {
      return res.text().then(t => { if (gen === G.gen) eatSSE(t); });
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let sseBuf = '';

    function step() {
      return reader.read().then(r => {
        if (gen !== G.gen) { try { reader.cancel(); } catch (e) {} return; }
        if (r.done) { if (sseBuf) eatSSE(sseBuf); return; }
        sseBuf += dec.decode(r.value, { stream: true });
        const cut = sseBuf.lastIndexOf('\n');
        if (cut !== -1) {
          eatSSE(sseBuf.slice(0, cut));
          sseBuf = sseBuf.slice(cut + 1);
        }
        return step();
      });
    }
    return step();
  }

  function _flushLineBuf(produced) {
    if (G.lineBuf.trim()) _acceptLine(G.lineBuf, produced);
    G.lineBuf = '';
  }

  function _acceptLine(line, produced) {
    const items = _parseLine(line);
    if (!items.length) return;
    if (produced) produced.push(line.trim());
    G.turnProduced = (G.turnProduced || 0) + items.length;
    items.forEach(o => {
      if (typeof o.say === 'string' && o.say.trim()) {
        G.queue.push({ k: 'say', text: o.say.trim().slice(0, 400) });
        if (G.speaking) _prefetchNext();
      } else if (typeof o.do === 'string') {
        G.queue.push({ k: 'do', o: o });
      }
    });
    _pump();
  }

  /* ══════════════════════════════════════════════════
     PLAYBACK: speech + visuals in order
  ══════════════════════════════════════════════════ */

  function _pump() {
    if (G.pumping) return;
    G.pumping = true;
    try {
      while (G.queue.length && !G.speaking) {
        const it = G.queue.shift();
        if (it.k === 'do') {
          try { _exec(it.o); } catch (e) { console.warn('[LiveClass] op failed:', it.o && it.o.do, e); }
        } else {
          _speak(it.text);   /* loop condition stops us while speech is playing */
        }
      }
    } finally {
      G.pumping = false;
    }
    if (!G.queue.length && !G.speaking && !G.fetching) _turnDone();
  }

  function _speak(raw) {
    const text = String(raw).replace(/\$+/g, '').replace(/\s+/g, ' ').trim();
    G.speaking = true;
    _setStatus('speaking');
    _caption(text);
    _note('teacher', text);
    _prefetchNext();

    const gen = G.gen;
    const words = text.split(' ').length;
    let finished = false;

    function finish() {
      if (finished || gen !== G.gen) return;
      finished = true;
      clearTimeout(G.speakTimer);
      G.speaking = false;
      _pump();
    }

    const canTalk = window.SpeechEngine && SpeechEngine.ttsSupported;
    /* Safety net in case the audio never reports back */
    G.speakTimer = setTimeout(finish, canTalk ? words * 700 + 9000 : words * 330 + 900);

    if (canTalk) {
      try { SpeechEngine.speak(text, finish, true); }
      catch (e) { setTimeout(finish, words * 330 + 900); }
    }
  }

  /* Pre-fetch the audio of the NEXT sentence while the current one is playing. */
  function _prefetchNext() {
    try {
      if (!window.SpeechEngine || !SpeechEngine.prefetch) return;
      for (let i = 0; i < G.queue.length; i++) {
        if (G.queue[i].k === 'say') {
          SpeechEngine.prefetch(String(G.queue[i].text).replace(/\$+/g, '').replace(/\s+/g, ' ').trim());
          break;
        }
      }
    } catch (e) {}
  }

  /* Firebase ID token sent to the Worker, which verifies it. */
  function _getToken() {
    try {
      const u = window.fbAuth && window.fbAuth.currentUser;
      if (u && typeof u.getIdToken === 'function') return u.getIdToken().catch(() => null);
    } catch (e) {}
    return Promise.resolve(null);
  }

  function _turnDone() {
    if (G.paused) { _setStatus('paused'); return; }
    if (G.kind === 'lesson' && G.turnProduced) {
      G.curDone = true; G.retries = 0; G.turnProduced = 0;
      if (G.cur >= 0 && G.plan.length) { G.cur++; }
    }
    _updateProgress();
    if (G.started && !G.finished && G.plan.length && G.cur >= G.plan.length) { _finishClass(); return; }
    if (G.finished) { _setStatus('done'); return; }
    _setStatus('idle');
    if (G.started && G.plan.length && G.turns < 30 && G.retries < 3) {
      clearTimeout(G.contTimer); clearTimeout(G.awaitTimer);
      if (G.awaiting) {
        /* teacher asked a question: wait for the student, then move on */
        G.awaitTimer = setTimeout(() => {
          if (_busy() || G.paused || G.listening) return;
          G.awaiting = false;
          _continue(false, true);
        }, G.handsFree ? 30000 : 40000);
      } else {
        G.contTimer = setTimeout(() => _continue(false), 700);
      }
    }
    if (G.handsFree && G.started && !G.listening) {
      setTimeout(() => { if (G.handsFree && G.started && !_busy() && !G.listening) _startListening(); }, 450);
    }
  }

  /* ── lesson continuation loop ── */
  function _continue(isRetry, noAnswer) {
    if (!G.started || G.paused || G.finished || _busy() || !G.plan.length) return;
    if (G.listening) { _stopListening(false); }
    if (G.cur >= G.plan.length) { _finishClass(); return; }
    G.turns++;
    const n = G.plan.length;
    const k = Math.max(0, G.cur);
    const title = G.plan[k] || '';
    let msg;
    if (isRetry || !G.curDone) {
      msg = '[CONTINUE] Resume step ' + (k + 1) + ' of ' + n + ' (' + title + '). Do not restart the lesson. Briefly pick up where you left off, then teach this step.';
    } else {
      msg = '[CONTINUE] ' + (noAnswer ? 'The student did not answer. Give the answer in one short sentence, then ' : '') +
            'Teach step ' + (k + 1) + ' of ' + n + ': ' + title + '. Build on the existing stage, add new visuals, speak 4 to 7 short lines. ' +
            (k === n - 1 ? 'This is the last step: recap, then output {"do":"end"}.' : 'Do not repeat earlier steps.');
    }
    G.curDone = false;
    _ask(msg, { display: null, noInterrupt: true, kind: 'lesson' });
  }

  function _updateProgress() {
    const box = _el('lv-progress'); if (!box) return;
    if (!G.plan.length) { box.style.display = 'none'; return; }
    box.style.display = '';
    const n = G.plan.length;
    const idx = Math.min(G.cur < 0 ? 0 : G.cur, n - 1);
    const done = G.finished ? n : Math.max(0, Math.min(n, G.curDone ? G.cur : G.cur));
    const t = _el('lv-prog-text'), fl = _el('lv-prog-fill');
    if (t) t.textContent = G.finished ? 'Lesson complete' : ('Step ' + (idx + 1) + ' of ' + n + ': ' + G.plan[idx]);
    if (fl) fl.style.width = Math.round((done / n) * 100) + '%';
  }

  function _finishClass() {
    G.finished = true; G.awaiting = false;
    clearTimeout(G.contTimer); clearTimeout(G.awaitTimer);
    _updateProgress();
    _setStatus('done');
    _note('teacher', 'That is the end of today\'s class. Ask me anything about it, or pick a new topic.');
  }

  function _pause() {
    if (!G.started) return;
    _interrupt();
    G.paused = true;
    if (G.kind === 'lesson') { G.curDone = false; }
    _setStatus('paused');
  }

  function _resumeClass() {
    if (!G.started || !G.paused) return;
    G.paused = false;
    if (G.plan.length && !G.finished) _continue(true);
    else _setStatus('idle');
  }

  /* Stop everything Master Timothy is doing right now. */
  function _interrupt() {
    G.gen++;
    clearTimeout(G.contTimer); clearTimeout(G.awaitTimer);
    if (G.started && G.kind === 'lesson' && (G.fetching || G.speaking || G.queue.length)) G.curDone = false;
    if (G.ctrl) { try { G.ctrl.abort(); } catch (e) {} G.ctrl = null; }
    clearTimeout(G.speakTimer);
    G.queue = [];
    G.lineBuf = '';
    G.speaking = false;
    G.fetching = false;
    try { if (window.SpeechEngine && SpeechEngine.cancel) SpeechEngine.cancel(); } catch (e) {}
  }

  /* ══════════════════════════════════════════════════
     MICROPHONE  (speech-to-text)
  ══════════════════════════════════════════════════ */

  const _SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  function _sttAvailable() {
    if (!_SR) return false;
    const iosStandalone = /iphone|ipad|ipod/i.test(navigator.userAgent) && navigator.standalone;
    return !iosStandalone;
  }

  function _setMic(on) {
    const m = _el('lv-mic');
    if (m) m.classList.toggle('on', !!on);
  }

  function _micToggle() {
    if (!G.started) { _toast('Pick a topic and tap Start Class first.', 'info'); return; }
    if (!_sttAvailable()) {
      _toast('Voice input is not supported here. Please type your question (Chrome or Edge supports the mic).', 'warning', 5000);
      return;
    }
    if (G.listening) { _stopListening(true); return; }
    if (_busy()) { _interrupt(); _setStatus('idle'); }   /* barge-in: student takes the floor */
    _startListening();
  }

  function _startListening() {
    if (!_sttAvailable() || G.listening) return;
    const input = _el('lv-input');
    const rec = new _SR();
    rec.lang = G.recLang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let finalText = '';
    let errCode = '';

    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      if (input) input.value = (finalText + interim).trim();
    };

    rec.onerror = e => {
      errCode = e.error || 'error';
      if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
        G.handsFree = false;
        const hf = _el('lv-hf'); if (hf) hf.checked = false;
        _toast('Microphone is blocked. Allow mic access in your browser settings, or type instead.', 'error', 6000);
      } else if (errCode === 'language-not-supported' && G.recLang !== 'en-US') {
        G.recLang = 'en-US';
      }
    };

    rec.onend = () => {
      G.listening = false; G.rec = null; _setMic(false);
      const said = (finalText || (input ? input.value : '')).trim();
      if (input) input.value = '';
      if (said) {
        G.emptyListens = 0;
        _ask(said);
        return;
      }
      if (_busy()) return;
      _setStatus('idle');
      const fatal = errCode === 'not-allowed' || errCode === 'service-not-allowed';
      if (G.handsFree && !fatal && G.started) {
        G.emptyListens++;
        if (G.emptyListens >= 5) {
          G.handsFree = false;
          const hf = _el('lv-hf'); if (hf) hf.checked = false;
          _toast('I stopped listening. Tap the mic when you are ready.', 'info');
          return;
        }
        setTimeout(() => { if (G.handsFree && G.started && !_busy() && !G.listening) _startListening(); }, 500);
      }
    };

    try {
      rec.start();
      G.rec = rec; G.listening = true;
      _setMic(true); _setStatus('listening');
    } catch (e) {
      G.rec = null; G.listening = false; _setMic(false);
    }
  }

  function _stopListening(submit) {
    const rec = G.rec;
    if (!rec) { G.listening = false; _setMic(false); return; }
    if (!submit) {
      rec.onend = null; rec.onresult = null;     /* never submit text after an abort */
      G.rec = null; G.listening = false; _setMic(false);
    }
    try { submit ? rec.stop() : rec.abort(); } catch (e) {}
  }

  /* ══════════════════════════════════════════════════
     3D STAGE
  ══════════════════════════════════════════════════ */

  function _initStage() {
    const wrap = _el('lv-stage');
    if (!wrap || !_T) return;
    const T = _T;

    const loading = _el('lv-loading'); if (loading) loading.remove();

    S.scene = new T.Scene();
    S.scene.background = new T.Color('#0b1220');
    S.scene.fog = new T.Fog(0x0b1220, 22, 55);
    S.camera = new T.PerspectiveCamera(50, 1, 0.1, 200);
    S.camera.position.set(DEFAULT_CAM.pos[0], DEFAULT_CAM.pos[1], DEFAULT_CAM.pos[2]);

    S.renderer = new T.WebGLRenderer({ antialias: true });
    S.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    wrap.appendChild(S.renderer.domElement);

    S.scene.add(new T.AmbientLight(0xffffff, 0.65));
    S.scene.add(new T.HemisphereLight(0xbfd7ff, 0x1b2438, 0.55));
    const dl = new T.DirectionalLight(0xffffff, 0.9);
    dl.position.set(5, 9, 7);
    S.scene.add(dl);

    S.grid = new T.GridHelper(26, 26, 0x2b3a55, 0x18233a);
    S.grid.position.y = -2;
    S.scene.add(S.grid);

    if (T.OrbitControls) {
      S.controls = new T.OrbitControls(S.camera, S.renderer.domElement);
      S.controls.enableDamping = true;
      S.controls.dampingFactor = 0.08;
      S.controls.maxDistance = 40;
      S.controls.minDistance = 2;
      S.controls.target.set(DEFAULT_CAM.look[0], DEFAULT_CAM.look[1], DEFAULT_CAM.look[2]);
      S.controls.addEventListener('start', () => { S.userAt = performance.now(); S.tweens = S.tweens.filter(t => !t.cam); });
      S.controls.addEventListener('end', () => { S.userAt = performance.now(); });
    }
    S.camera.lookAt(0, 0, 0);

    S.ray = new T.Raycaster();
    const cv = S.renderer.domElement;
    cv.addEventListener('pointerdown', e => { S.ptr = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    cv.addEventListener('pointerup', _onStageTap);

    S.onResize = _resize;
    window.addEventListener('resize', S.onResize);
    if (window.ResizeObserver) { S.ro = new ResizeObserver(_resize); S.ro.observe(wrap); }
    _resize();

    S.last = 0;
    S.raf = requestAnimationFrame(_loop);
  }

  function _resize() {
    const wrap = _el('lv-stage');
    if (!wrap || !S.renderer) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    S.renderer.setSize(w, h, false);
    S.camera.aspect = w / h;
    S.camera.updateProjectionMatrix();
  }

  function _loop() {
    S.raf = requestAnimationFrame(_loop);
    if (!S.renderer || document.hidden) { S.last = 0; return; }
    const now = performance.now();
    const dt = Math.min(0.05, (now - (S.last || now)) / 1000);
    const rdt = Math.min(0.5, (now - (S.last || now)) / 1000);   /* real elapsed time: camera moves stay on schedule even on slow phones */
    S.last = now; S.t += dt;

    /* tweens */
    for (let i = S.tweens.length - 1; i >= 0; i--) {
      const tw = S.tweens[i];
      tw.el += rdt * 1000;
      const k = Math.min(1, tw.el / tw.ms);
      tw.fn(tw.cam ? (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2) : k * k * (3 - 2 * k));
      if (k >= 1) S.tweens.splice(i, 1);
    }

    /* per-object spin / orbit */
    S.objs.forEach(e => {
      if (e.spin) e.obj.rotation[e.spin.axis] += e.spin.speed * dt;
      if (e.orbit) {
        const o = e.orbit;
        o.a += o.speed * dt;
        let cx = 0, cy = 0, cz = 0;
        if (o.centerId) {
          const c = S.objs.get(o.centerId);
          if (c) { cx = c.obj.position.x; cy = c.obj.position.y; cz = c.obj.position.z; }
        } else { cx = o.center[0]; cy = o.center[1]; cz = o.center[2]; }
        e.obj.position.set(
          cx + o.r * Math.cos(o.a),
          cy + o.r * Math.sin(o.a) * Math.sin(o.tilt),
          cz + o.r * Math.sin(o.a) * Math.cos(o.tilt));
      }
    });

    /* preset simulations */
    S.updaters.forEach(u => u.fn(dt, S.t));
    _director(dt, now);

    if (S.controls) S.controls.update();
    S.renderer.render(S.scene, S.camera);
  }

  function _tween(ms, fn, cam) { S.tweens.push({ el: 0, ms: Math.max(50, ms), fn, cam: !!cam }); }

  /* Cinematic camera: eased arc (orbit-style) move between two framings. */
  function _cameraTo(pos, look, ms, auto) {
    if (!S.camera) return;
    const T = _T;
    S.tweens = S.tweens.filter(t => !t.cam);
    const t0 = S.controls ? S.controls.target.clone() : new T.Vector3(0, 0, 0);
    const p1 = new T.Vector3(pos[0], pos[1], pos[2]);
    const l1 = new T.Vector3(look[0], look[1], look[2]);
    const o0 = S.camera.position.clone().sub(t0), o1 = p1.clone().sub(l1);
    const r0 = Math.max(0.5, o0.length()), r1 = Math.max(0.5, o1.length());
    const cl = v => Math.max(-1, Math.min(1, v));
    const th0 = Math.atan2(o0.x, o0.z), th1 = Math.atan2(o1.x, o1.z);
    const ph0 = Math.asin(cl(o0.y / r0)), ph1 = Math.asin(cl(o1.y / r1));
    let dth = th1 - th0;
    while (dth > Math.PI) dth -= 2 * Math.PI;
    while (dth < -Math.PI) dth += 2 * Math.PI;
    if (!auto) S.shotAt = performance.now();
    _tween(ms || 1600, k => {
      const r = r0 + (r1 - r0) * k, th = th0 + dth * k, ph = ph0 + (ph1 - ph0) * k;
      const tg = new T.Vector3().lerpVectors(t0, l1, k), cp = Math.cos(ph);
      S.camera.position.set(tg.x + r * cp * Math.sin(th), tg.y + r * Math.sin(ph), tg.z + r * cp * Math.cos(th));
      if (S.controls) S.controls.target.copy(tg);
      S.camera.lookAt(tg);
    }, true);
  }

  /* Idle "director": slow drift + gentle breathing so the stage never feels frozen. */
  function _director(dt, now) {
    if (!S.controls || !G.started || !S.camera) return;
    if (S.tweens.some(t => t.cam)) return;
    if (now - (S.userAt || 0) < 6000) return;
    const tg = S.controls.target, p = S.camera.position;
    const a = 0.05 * dt * (G.speaking ? 1 : 0.5), c = Math.cos(a), sn = Math.sin(a);
    const ox = p.x - tg.x, oz = p.z - tg.z;
    p.x = tg.x + ox * c - oz * sn;
    p.z = tg.z + ox * sn + oz * c;
    p.y += Math.sin(S.t * 0.45) * 0.12 * dt;
  }

  function _sceneBounds() {
    const T = _T, b = new T.Box3(); let n = 0;
    S.objs.forEach(e => {
      if (!e.obj || e.obj.visible === false) return;
      const bb = new T.Box3().setFromObject(e.obj);
      if (isFinite(bb.min.x) && !bb.isEmpty()) { b.union(bb); n++; }
    });
    return n ? b : null;
  }

  function _fitDist(radius) {
    const fov = S.camera.fov * Math.PI / 180;
    const asp = Math.max(0.5, S.camera.aspect || 1);
    const half = Math.min(fov / 2, Math.atan(Math.tan(fov / 2) * asp));
    return Math.min(32, Math.max(6, radius / Math.sin(half) * 0.9));
  }

  /* After things are added, re-frame so everything is in view (unless a shot was just called). */
  function _scheduleFrame() {
    clearTimeout(S.frameT);
    S.frameT = setTimeout(() => {
      if (!S.scene || !S.camera || !S.controls) return;
      const now = performance.now();
      if (now - (S.shotAt || 0) < 3500 || now - (S.userAt || 0) < 8000) return;
      const bb = _sceneBounds(); if (!bb) return;
      const T = _T, c = bb.getCenter(new T.Vector3());
      const radius = Math.max(3, bb.getSize(new T.Vector3()).length() / 2);
      const fit = _fitDist(radius);
      const tg = S.controls.target;
      const cur = S.camera.position.distanceTo(tg);
      if (Math.abs(cur - fit) / fit < 0.3 && c.distanceTo(tg) < 1.5) return;
      const dir = S.camera.position.clone().sub(tg).normalize().multiplyScalar(fit);
      _cameraTo([c.x + dir.x, Math.max(-1, c.y + dir.y), c.z + dir.z], [c.x, c.y, c.z], 1800, true);
    }, 500);
  }

  /* Named camera shots, like a film director. */
  function _shot(o) {
    if (!S.camera) return;
    const T = _T, type = String(o.type || 'wide');
    const bb = _sceneBounds();
    const center = new T.Vector3(0, 0, 0); let radius = 4;
    if (bb) { bb.getCenter(center); radius = Math.max(3, bb.getSize(new T.Vector3()).length() / 2); }
    const fit = _fitDist(radius);
    const ent = o.id ? S.objs.get(_id(o.id)) : null;
    let ep = null, er = 1;
    if (ent) {
      ep = ent.obj.getWorldPosition(new T.Vector3());
      er = Math.max(0.8, new T.Box3().setFromObject(ent.obj).getSize(new T.Vector3()).length() / 2);
    }
    let tgt = center, dir = [0.3, 0.4, 1], dist = fit, ms = 1800;
    switch (type) {
      case 'close':  tgt = ep || center; dist = Math.max(3, er * 3.2); dir = [0.55, 0.25, 1]; ms = 1600; break;
      case 'medium': tgt = ep || center; dist = ep ? Math.max(5, er * 5) : fit * 0.7; dir = [0.45, 0.3, 1]; break;
      case 'top':    dist = fit; dir = [0.02, 1, 0.18]; ms = 2000; break;
      case 'low':    tgt = ep || center; dist = fit * 0.8; dir = [0.5, -0.05, 1]; break;
      case 'reveal': dist = fit * 1.15; dir = [0.35, 0.4, 1]; ms = 3600; break;
      case 'orbit': {
        tgt = ep || center;
        const base = S.controls ? S.controls.target : center;
        const cur = S.camera.position.clone().sub(base), a = 1.6, c = Math.cos(a), sn = Math.sin(a);
        _cameraTo([tgt.x + cur.x * c - cur.z * sn, tgt.y + cur.y, tgt.z + cur.x * sn + cur.z * c], [tgt.x, tgt.y, tgt.z], 4200);
        return;
      }
      default: break;
    }
    const d = new T.Vector3(dir[0], dir[1], dir[2]).normalize().multiplyScalar(dist);
    _cameraTo([tgt.x + d.x, Math.max(-1, tgt.y + d.y), tgt.z + d.z], [tgt.x, tgt.y, tgt.z], ms);
  }

  function _onStageTap(e) {
    if (!S.ptr || !S.renderer || !G.started) return;
    const moved = Math.hypot(e.clientX - S.ptr.x, e.clientY - S.ptr.y);
    const dur = performance.now() - S.ptr.t;
    S.ptr = null;
    if (moved > 6 || dur > 500) return;

    const rect = S.renderer.domElement.getBoundingClientRect();
    const m = new _T.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    S.ray.setFromCamera(m, S.camera);
    const hits = S.ray.intersectObjects(S.scene.children, true);
    for (let i = 0; i < hits.length; i++) {
      let o = hits[i].object;
      while (o && !(o.userData && o.userData.id)) o = o.parent;
      if (o && o.userData.id) {
        const ent = S.objs.get(o.userData.id);
        const name = (ent && ent.label) || o.userData.id;
        _pulse(o.userData.id);
        _ask('[EVENT] The student tapped the object "' + name + '" (id: ' + o.userData.id + ') on the 3D stage. Explain it briefly and clearly.',
          { display: 'Tapped: ' + name });
        return;
      }
    }
  }

  /* ── labels ── */
  function _makeLabel(text) {
    const T = _T;
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    const ctx = cv.getContext('2d');
    let t = String(text).slice(0, 40);
    let fs = 48;
    ctx.font = '700 ' + fs + 'px Arial, sans-serif';
    while (fs > 16 && ctx.measureText(t).width > 480) { fs -= 2; ctx.font = '700 ' + fs + 'px Arial, sans-serif'; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(8,12,24,.95)'; ctx.lineJoin = 'round';
    ctx.strokeText(t, 256, 64);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(t, 256, 64);
    const tex = new T.CanvasTexture(cv);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(2.6, 0.65, 1);
    sp.renderOrder = 10;
    return sp;
  }

  function _setLabel(ent, text) {
    if (ent.labelSprite) {
      ent.obj.remove(ent.labelSprite);
      if (ent.labelSprite.material.map) ent.labelSprite.material.map.dispose();
      ent.labelSprite.material.dispose();
      ent.labelSprite = null;
    }
    ent.label = text ? _text(text, 40) : '';
    if (ent.label) {
      const sp = _makeLabel(ent.label);
      sp.position.y = (ent.size * 0.5) / (ent.scaleNow || 1) + 0.55;
      if (ent.shape === 'group') sp.position.y = 0.35;
      sp.userData = { id: ent.id };
      ent.obj.add(sp);
      ent.labelSprite = sp;
    }
  }

  /* ── object creation ── */
  function _add(o, internal) {
    const T = _T;
    const id = _id(o.id);
    if (!id) return null;
    if (S.objs.has(id)) _remove(id);
    if (!internal && S.objs.size >= MAX_OBJS) return null;

    const shape = String(o.shape || 'sphere').toLowerCase();
    const size  = _num(o.size, 1, 0.05, 8);
    const col   = _color(o.color, '#60a5fa');
    const pos   = _vec(o.pos, [0, 0, 0]);
    const opac  = _num(o.opacity, 1, 0.05, 1);

    let obj;

    if (shape === 'group') {
      obj = new T.Group();
    } else if (shape === 'arrow' || shape === 'line') {
      const to  = _vec(o.to, [pos[0] + 1, pos[1], pos[2]]);
      const dir = new T.Vector3(to[0] - pos[0], to[1] - pos[1], to[2] - pos[2]);
      let len = dir.length();
      if (len < 0.01) { dir.set(1, 0, 0); len = 1; }
      dir.normalize();
      if (shape === 'arrow') {
        obj = new T.ArrowHelper(dir, new T.Vector3(0, 0, 0), len, new T.Color(col).getHex(), Math.min(0.5, len * 0.28), Math.min(0.25, len * 0.14));
      } else {
        const g = new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), dir.clone().multiplyScalar(len)]);
        obj = new T.Line(g, new T.LineBasicMaterial({ color: col, transparent: true, opacity: opac }));
      }
    } else {
      let geo;
      switch (shape) {
        case 'box':       geo = new T.BoxGeometry(size, size, size); break;
        case 'cylinder':  geo = new T.CylinderGeometry(size * 0.3, size * 0.3, size, 28); break;
        case 'cone':      geo = new T.ConeGeometry(size * 0.4, size, 28); break;
        case 'torus':     geo = new T.TorusGeometry(size * 0.5, size * 0.1, 14, 56); break;
        case 'orbitline': geo = new T.TorusGeometry(size * 0.5, 0.012, 6, 140); break;
        case 'plane':     geo = new T.PlaneGeometry(size * 6, size * 6); break;
        default:          geo = new T.SphereGeometry(size * 0.5, 32, 20);
      }
      const mat = new T.MeshStandardMaterial({
        color: col, roughness: 0.45, metalness: 0.1,
        transparent: opac < 1 || shape === 'orbitline', opacity: shape === 'orbitline' ? 0.35 : opac,
        side: (shape === 'plane') ? T.DoubleSide : T.FrontSide,
      });
      if (o.glow) { mat.emissive = new T.Color(col); mat.emissiveIntensity = 0.65; }
      obj = new T.Mesh(geo, mat);
      if (shape === 'plane') obj.rotation.x = -Math.PI / 2;
    }

    obj.position.set(pos[0], pos[1], pos[2]);
    obj.userData = { id: id, shape: shape };

    const parent = o.parent ? S.objs.get(_id(o.parent)) : null;
    (parent ? parent.obj : S.scene).add(obj);

    const ent = { id, shape, obj, size, label: '', labelSprite: null, spin: null, orbit: null,
                  parent: parent ? parent.id : null, scaleNow: 1 };
    S.objs.set(id, ent);
    if (o.label) _setLabel(ent, o.label);

    /* pop-in animation */
    if (!internal) {
      obj.scale.setScalar(0.01);
      _tween(450, k => obj.scale.setScalar(Math.max(0.01, k)));
    }
    return ent;
  }

  function _remove(id) {
    id = _id(id);
    const ent = S.objs.get(id);
    if (!ent) return;
    S.objs.forEach(e => { if (e.parent === id) _remove(e.id); });
    if (ent.labelSprite) {
      if (ent.labelSprite.material.map) ent.labelSprite.material.map.dispose();
      ent.labelSprite.material.dispose();
    }
    if (ent.obj.parent) ent.obj.parent.remove(ent.obj);
    ent.obj.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) { (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => m.dispose()); }
    });
    S.objs.delete(id);
  }

  function _clearStage() {
    Array.from(S.objs.keys()).forEach(_remove);
    S.updaters = [];
    S.tweens = [];
    if (S.grid) S.grid.visible = true;
  }

  function _pulse(id) {
    const ent = S.objs.get(_id(id));
    if (!ent) return;
    const base = ent.obj.scale.x || 1;
    _tween(700, k => ent.obj.scale.setScalar(base * (1 + 0.35 * Math.sin(k * Math.PI))));
  }

  function _setProps(o) {
    const ent = S.objs.get(_id(o.id));
    if (!ent) return;
    const T = _T;
    if (o.color !== undefined) {
      const c = _color(o.color, null);
      if (c) {
        if (ent.shape === 'arrow') ent.obj.setColor(new T.Color(c));
        else if (ent.obj.material) { ent.obj.material.color.set(c); if (ent.obj.material.emissive && ent.obj.material.emissiveIntensity) ent.obj.material.emissive.set(c); }
      }
    }
    if (o.size !== undefined && ent.shape !== 'arrow' && ent.shape !== 'line') {
      const s = _num(o.size, ent.size, 0.05, 8) / ent.size;
      const from = ent.obj.scale.x;
      ent.scaleNow = s;
      _tween(500, k => ent.obj.scale.setScalar(from + (s - from) * k));
    }
    if (o.opacity !== undefined && ent.obj.material) {
      ent.obj.material.transparent = true;
      ent.obj.material.opacity = _num(o.opacity, 1, 0.05, 1);
    }
    if (o.visible !== undefined) ent.obj.visible = !!o.visible;
    if (o.label !== undefined) _setLabel(ent, o.label);
  }

  function _move(o) {
    const ent = S.objs.get(_id(o.id));
    if (!ent) return;
    const to = _vec(o.to, [ent.obj.position.x, ent.obj.position.y, ent.obj.position.z]);
    const p0 = ent.obj.position.clone();
    ent.orbit = null;
    _tween(_num(o.ms, 1000, 100, 8000), k => {
      ent.obj.position.set(p0.x + (to[0] - p0.x) * k, p0.y + (to[1] - p0.y) * k, p0.z + (to[2] - p0.z) * k);
    });
  }

  function _orbit(o) {
    const ent = S.objs.get(_id(o.id));
    if (!ent) return;
    const centerId = (typeof o.around === 'string') ? _id(o.around) : null;
    const center = Array.isArray(o.around) ? _vec(o.around, [0, 0, 0]) : [0, 0, 0];
    let phase = Number(o.phase);
    if (!isFinite(phase)) {
      let h = 0; const sid = ent.id;
      for (let i = 0; i < sid.length; i++) h = (h * 31 + sid.charCodeAt(i)) % 628;
      phase = h / 100;
    }
    ent.orbit = {
      centerId: centerId && S.objs.has(centerId) ? centerId : null,
      center, r: _num(o.radius, 3, 0.2, 14), speed: _num(o.speed, 0.6, -6, 6),
      tilt: _num(o.tilt, 0, -90, 90) * Math.PI / 180, a: phase,
    };
  }

  function _spin(o) {
    const ent = S.objs.get(_id(o.id));
    if (!ent) return;
    const axis = ['x', 'y', 'z'].indexOf(o.axis) !== -1 ? o.axis : 'y';
    const speed = _num(o.speed, 1, -8, 8);
    ent.spin = speed === 0 ? null : { axis, speed };
  }

  /* ── executing one {"do": ...} command ── */
  function _exec(o) {
    if (o.do === 'plan' || o.do === 'await' || o.do === 'end') { /* control ops never need the stage */ }
    else if (!S.scene) return;
    switch (o.do) {
      case 'add':    _add(o, false); _scheduleFrame(); break;
      case 'group':  _add(Object.assign({}, o, { shape: 'group' }), false); break;
      case 'set':    _setProps(o); break;
      case 'move':   _move(o); break;
      case 'spin':   _spin(o); break;
      case 'orbit':  _orbit(o); break;
      case 'remove': _remove(o.id); break;
      case 'clear':  _clearStage(); break;
      case 'focus': {
        const ent = S.objs.get(_id(o.id));
        if (ent) {
          _pulse(o.id);
          const p = ent.obj.getWorldPosition(new _T.Vector3());
          const cam = S.camera.position;
          _shot({ type: 'close', id: o.id });
        }
        break;
      }
      case 'camera':
        _cameraTo(_vec(o.pos, DEFAULT_CAM.pos), _vec(o.look, DEFAULT_CAM.look), 1800);
        break;
      case 'shot':   _shot(o); break;
      case 'preset': _preset(String(o.name || ''), (o.params && typeof o.params === 'object') ? o.params : {}); _scheduleFrame(); break;
      case 'board':  _board(o); break;
      case 'plan': {
        const st = (Array.isArray(o.steps) ? o.steps : []).map(x => _text(x, 70)).filter(Boolean).slice(0, 8);
        if (st.length >= 2) { G.plan = st; if (G.cur < 0) G.cur = 0; _updateProgress(); }
        break;
      }
      case 'await': G.awaiting = true; break;
      case 'end':   G.cur = G.plan.length || 1; G.finished = true; break;
      default: break;
    }
  }

  /* ══════════════════════════════════════════════════
     PRESET SCENES
  ══════════════════════════════════════════════════ */

  function _bond(id, a, b, parent, radius) {
    const T = _T;
    const va = new T.Vector3(a[0], a[1], a[2]), vb = new T.Vector3(b[0], b[1], b[2]);
    const dir = new T.Vector3().subVectors(vb, va);
    const len = dir.length();
    const geo = new T.CylinderGeometry(radius || 0.07, radius || 0.07, len, 12);
    const mesh = new T.Mesh(geo, new T.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.5 }));
    mesh.position.copy(va).add(vb).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
    mesh.userData = { id: id, shape: 'bond' };
    const par = parent ? S.objs.get(parent) : null;
    (par ? par.obj : S.scene).add(mesh);
    S.objs.set(id, { id, shape: 'bond', obj: mesh, size: 1, label: '', labelSprite: null, spin: null, orbit: null, parent: parent || null, scaleNow: 1 });
  }

  function _molecule(name) {
    _add({ id: 'mol', shape: 'group', pos: [0, 0.5, 0] }, true);
    const atom = (id, pos, size, color, label) =>
      _add({ id, shape: 'sphere', pos, size, color, label, parent: 'mol', glow: false }, true);

    if (name === 'water_molecule') {
      const hx = 1.0 * Math.sin(52.25 * Math.PI / 180), hy = -1.0 * Math.cos(52.25 * Math.PI / 180);
      atom('o1', [0, 0, 0], 1.2, '#ef4444', 'Oxygen (O)');
      atom('h1', [hx, hy, 0], 0.7, '#f1f5f9', 'Hydrogen (H)');
      atom('h2', [-hx, hy, 0], 0.7, '#f1f5f9', '');
      _bond('b1', [0, 0, 0], [hx, hy, 0], 'mol');
      _bond('b2', [0, 0, 0], [-hx, hy, 0], 'mol');
    } else if (name === 'co2_molecule') {
      atom('c1', [0, 0, 0], 0.9, '#9ca3af', 'Carbon (C)');
      atom('o1', [1.9, 0, 0], 1.1, '#ef4444', 'Oxygen (O)');
      atom('o2', [-1.9, 0, 0], 1.1, '#ef4444', '');
      [['b1', 1.9, 0.1], ['b2', 1.9, -0.1], ['b3', -1.9, 0.1], ['b4', -1.9, -0.1]].forEach(b =>
        _bond(b[0], [0, 0, b[2]], [b[1], 0, b[2]], 'mol', 0.05));
    } else {                       /* methane */
      atom('c1', [0, 0, 0], 1.0, '#9ca3af', 'Carbon (C)');
      [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].forEach((v, i) => {
        const n = Math.hypot(v[0], v[1], v[2]);
        const p = [v[0] / n * 1.4, v[1] / n * 1.4, v[2] / n * 1.4];
        atom('h' + i, p, 0.62, '#f1f5f9', i === 0 ? 'Hydrogen (H)' : '');
        _bond('b' + i, [0, 0, 0], p, 'mol');
      });
    }
    _spin({ id: 'mol', axis: 'y', speed: 0.6 });
    _cameraTo([0, 1.8, 7], [0, 0.5, 0], 900);
  }

  function _preset(name, p) {
    _clearStage();
    const T = _T;

    if (name === 'solar_system') {
      _add({ id: 'sun', shape: 'sphere', pos: [0, 0, 0], size: 1.6, color: '#fbbf24', glow: true, label: 'Sun' }, true);
      [['mercury', 0.2, '#a8a29e', 2.3, 1.7, 'Mercury'], ['venus', 0.32, '#fcd34d', 3.2, 1.25, 'Venus'],
       ['earth', 0.36, '#3b82f6', 4.3, 1.0, 'Earth'], ['mars', 0.28, '#ef4444', 5.4, 0.8, 'Mars'],
       ['jupiter', 0.9, '#f59e0b', 7.0, 0.5, 'Jupiter'], ['saturn', 0.7, '#fde68a', 8.7, 0.38, 'Saturn']]
      .forEach(pl => {
        _add({ id: pl[0] + '_path', shape: 'orbitline', pos: [0, 0, 0], size: pl[3] * 2, color: '#64748b' }, true);
        S.objs.get(pl[0] + '_path').obj.rotation.x = Math.PI / 2;
        _add({ id: pl[0], shape: 'sphere', pos: [pl[3], 0, 0], size: pl[1], color: pl[2], label: pl[5] }, true);
        _orbit({ id: pl[0], around: 'sun', radius: pl[3], speed: pl[4] * 0.45 });
      });
      _add({ id: 'saturn_ring', shape: 'torus', size: 1.5, color: '#fde68a', parent: 'saturn', opacity: 0.7 }, true);
      S.objs.get('saturn_ring').obj.rotation.x = Math.PI / 2.4;
      _spin({ id: 'sun', axis: 'y', speed: 0.2 });
      _cameraTo([0, 8, 15], [0, 0, 0], 1200);

    } else if (name === 'atom') {
      const pr = Math.round(_num(p.protons, 6, 1, 18));
      const ne = Math.round(_num(p.neutrons, pr, 0, 20));
      _add({ id: 'nucleus', shape: 'sphere', pos: [0, 0, 0], size: 0.9 + (pr + ne) * 0.02, color: '#ef4444', glow: true,
             label: 'Nucleus (' + pr + 'p, ' + ne + 'n)' }, true);
      const caps = [2, 8, 8];
      let left = pr, shell = 0;
      while (left > 0 && shell < caps.length) {
        const n = Math.min(caps[shell], left);
        left -= n;
        const r = 1.7 + shell * 1.2, tilt = shell * 38;
        _add({ id: 'shell' + shell, shape: 'orbitline', pos: [0, 0, 0], size: r * 2, color: '#38bdf8' }, true);
        S.objs.get('shell' + shell).obj.rotation.x = Math.PI / 2 - tilt * Math.PI / 180;
        for (let i = 0; i < n; i++) {
          const id = 'e' + shell + '_' + i;
          _add({ id, shape: 'sphere', pos: [r, 0, 0], size: 0.28, color: '#38bdf8', glow: true,
                 label: (shell === 0 && i === 0) ? 'Electron' : '' }, true);
          _orbit({ id, around: 'nucleus', radius: r, speed: 1.9 / (shell + 1), tilt: tilt, phase: (i / n) * Math.PI * 2 });
        }
        shell++;
      }
      _cameraTo([0, 3, 9], [0, 0, 0], 1000);

    } else if (name === 'water_molecule' || name === 'co2_molecule' || name === 'methane_molecule') {
      _molecule(name);

    } else if (name === 'wave') {
      const A = _num(p.amplitude, 1, 0.2, 2.2), L = _num(p.wavelength, 4, 1, 7), v = _num(p.speed, 1.5, 0.3, 5);
      const N = 49, balls = [];
      _add({ id: 'axis', shape: 'line', pos: [-6.5, 0, 0], to: [6.5, 0, 0], color: '#64748b' }, true);
      for (let i = 0; i < N; i++) {
        const x = -6 + 12 * i / (N - 1);
        const e = _add({ id: 'w' + i, shape: 'sphere', pos: [x, 0, 0], size: 0.24, color: '#38bdf8', glow: true,
                         label: i === 0 ? 'Wave' : '' }, true);
        balls.push({ e, x });
      }
      const k = 2 * Math.PI / L, w = k * v;
      S.updaters.push({ key: 'wave', fn: (dt, t) => balls.forEach(b => { b.e.obj.position.y = A * Math.sin(k * b.x - w * t); }) });
      _cameraTo([0, 2, 12], [0, 0, 0], 900);

    } else if (name === 'projectile') {
      const g = _num(p.gravity, 9.8, 1, 25), v0 = _num(p.speed, 18, 5, 30), th = _num(p.angle, 45, 5, 85) * Math.PI / 180;
      const vx = v0 * Math.cos(th), vy = v0 * Math.sin(th);
      const T_ = 2 * vy / g, R = vx * T_, H = vy * vy / (2 * g);
      const k = Math.min(0.28, 13 / Math.max(R, 1), 6.5 / Math.max(H, 0.5));
      const x0 = -Math.min(7, R * k / 2);
      if (S.grid) S.grid.visible = false;
      _add({ id: 'ground', shape: 'plane', pos: [0, -0.2, 0], size: 4, color: '#1e3a2f' }, true);
      _add({ id: 'launcher', shape: 'cylinder', pos: [x0, -0.05, 0], size: 0.4, color: '#94a3b8' }, true);
      const ball = _add({ id: 'ball', shape: 'sphere', pos: [x0, 0.2, 0], size: 0.4, color: '#f97316', glow: true, label: 'Ball' }, true);
      _add({ id: 'info', shape: 'group', pos: [0, 6.2, 0], label: 'Range ' + R.toFixed(1) + ' m | Max height ' + H.toFixed(1) + ' m | Time ' + T_.toFixed(1) + ' s' }, true);
      const MAXP = 240, arr = new Float32Array(MAXP * 3);
      const tg = new T.BufferGeometry();
      tg.setAttribute('position', new T.BufferAttribute(arr, 3));
      tg.setDrawRange(0, 0);
      const trail = new T.Line(tg, new T.LineBasicMaterial({ color: '#fdba74' }));
      trail.frustumCulled = false;
      S.scene.add(trail);
      let t = 0, n = 0;
      S.updaters.push({ key: 'projectile', fn: dt => {
        t += dt;
        if (t > T_ + 1.4) { t = 0; n = 0; tg.setDrawRange(0, 0); }
        const tt = Math.min(t, T_);
        const px = x0 + vx * tt * k, py = Math.max(0.2, 0.2 + (vy * tt - 0.5 * g * tt * tt) * k);
        ball.obj.position.set(px, py, 0);
        if (t <= T_ && n < MAXP) {
          arr[n * 3] = px; arr[n * 3 + 1] = py; arr[n * 3 + 2] = 0; n++;
          tg.setDrawRange(0, n); tg.attributes.position.needsUpdate = true;
        }
      } });
      _cameraTo([0, 3.5, 15], [0, 2.5, 0], 900);

    } else if (name === 'pendulum') {
      const L = _num(p.length, 3, 1, 5), th0 = _num(p.angle, 30, 5, 60) * Math.PI / 180, g = 9.8;
      const sc = 0.9, py0 = 5.4;
      if (S.grid) S.grid.visible = false;
      _add({ id: 'support', shape: 'box', pos: [0, py0 + 0.2, 0], size: 0.4, color: '#94a3b8' }, true);
      S.objs.get('support').obj.scale.set(8, 1, 1.5);
      const bob = _add({ id: 'bob', shape: 'sphere', pos: [0, py0 - L * sc, 0], size: 0.7, color: '#ef4444', glow: true, label: 'Bob' }, true);
      const lg = new T.BufferGeometry().setFromPoints([new T.Vector3(0, py0, 0), new T.Vector3(0, py0 - L * sc, 0)]);
      const string = new T.Line(lg, new T.LineBasicMaterial({ color: '#e2e8f0' }));
      string.frustumCulled = false;
      S.scene.add(string);
      _add({ id: 'info', shape: 'group', pos: [0, 0.2, 0], label: 'Period T = 2\u03c0\u221a(L/g) \u2248 ' + (2 * Math.PI * Math.sqrt(L / g)).toFixed(2) + ' s  (L = ' + L.toFixed(1) + ' m)' }, true);
      let th = th0, om = 0;
      S.updaters.push({ key: 'pendulum', fn: dt => {
        const sub = 4, h = dt / sub;
        for (let i = 0; i < sub; i++) { om += -(g / L) * Math.sin(th) * h; th += om * h; }
        const x = L * sc * Math.sin(th), y = py0 - L * sc * Math.cos(th);
        bob.obj.position.set(x, y, 0);
        const a = lg.attributes.position;
        a.setXYZ(1, x, y, 0); a.needsUpdate = true;
      } });
      _cameraTo([0, 3, 12], [0, 2.8, 0], 900);
    }
  }

  /* ══════════════════════════════════════════════════
     WHITEBOARD
  ══════════════════════════════════════════════════ */

  /* ══════════════════════════════════════════════════
     FREEHAND PEN  (student sketching on the whiteboard)
     Pointer events, pressure-aware, smoothed with quadratic curves.
  ══════════════════════════════════════════════════ */
  const INK = { strokes: [], cur: null, color: '#1d4ed8', tool: 'hand', cv: null, ctx: null, w: 0, h: 0, penSeen: false };

  function _loadFont() {
    if (document.getElementById('lv-font')) return;
    const l = document.createElement('link');
    l.id = 'lv-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap';
    document.head.appendChild(l);
  }

  function _initInk() {
    const cv = _el('lv-ink'), surf = _el('lv-wb-surface');
    if (!cv || !surf) return;
    INK.cv = cv; INK.ctx = cv.getContext('2d'); INK.strokes = []; INK.cur = null; INK.tool = 'hand';

    const fit = () => {
      const r = cv.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      INK.w = r.width; INK.h = r.height;
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      INK.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      _inkRedraw();
    };
    if (window.ResizeObserver) new ResizeObserver(fit).observe(cv); else window.addEventListener('resize', fit);

    const pos = e => {
      const r = cv.getBoundingClientRect();
      const p = (e.pointerType !== 'mouse' && e.pressure > 0) ? e.pressure : 0.5;
      return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, p: p };
    };
    cv.addEventListener('pointerdown', e => {
      if (INK.tool === 'hand') return;
      if (e.pointerType === 'pen') INK.penSeen = true;
      if (e.pointerType === 'touch' && INK.penSeen) return;     // palm rejection
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      INK.cur = { c: INK.color, w: INK.tool === 'eraser' ? 22 : 3.2, er: INK.tool === 'eraser', pts: [pos(e)], id: e.pointerId };
      INK.strokes.push(INK.cur);
      _inkDot(INK.cur);
    });
    cv.addEventListener('pointermove', e => {
      const s = INK.cur; if (!s || e.pointerId !== s.id) return;
      e.preventDefault();
      const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [e];
      evs.forEach(ev => {
        s.pts.push(pos(ev));
        if (s.pts.length >= 3) _inkSeg(INK.ctx, s, s.pts.length - 2);
      });
    });
    const end = e => {
      const s = INK.cur; if (!s || (e && e.pointerId !== s.id)) return;
      if (s.pts.length >= 2) _inkSeg(INK.ctx, s, s.pts.length - 1);
      INK.cur = null;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);

    const tray = _el('lv-wb-tray');
    const setTool = t => {
      INK.tool = t;
      surf.classList.toggle('pen', t !== 'hand');
      tray.querySelectorAll('.lv-tool[data-tool]').forEach(b => b.classList.toggle('active', b.getAttribute('data-tool') === t));
    };
    tray.querySelectorAll('.lv-tool[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.getAttribute('data-tool'))));
    tray.querySelectorAll('.lv-marker').forEach(b => b.addEventListener('click', () => {
      INK.color = b.getAttribute('data-color');
      tray.querySelectorAll('.lv-marker').forEach(m => m.classList.toggle('active', m === b));
      setTool('pen');
    }));
    const first = tray.querySelector('.lv-marker'); if (first) first.classList.add('active');
    _el('lv-ink-undo').addEventListener('click', () => { INK.strokes.pop(); _inkRedraw(); });
    _el('lv-ink-clear').addEventListener('click', _inkClear);
  }

  function _inkSetup(ctx, s) {
    ctx.globalCompositeOperation = s.er ? 'destination-out' : 'source-over';
    ctx.strokeStyle = s.c; ctx.fillStyle = s.c;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  }
  function _inkDot(s) {
    const ctx = INK.ctx, p = s.pts[0];
    ctx.save(); _inkSetup(ctx, s);
    ctx.beginPath(); ctx.arc(p.x * INK.w, p.y * INK.h, s.w * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function _inkSeg(ctx, s, i) {
    const a = s.pts[i - 1], b = s.pts[i], c = s.pts[i + 1], W = INK.w, H = INK.h;
    if (!a || !b) return;
    const sx = (i === 1) ? a.x : (a.x + b.x) / 2, sy = (i === 1) ? a.y : (a.y + b.y) / 2;
    const ex = c ? (b.x + c.x) / 2 : b.x, ey = c ? (b.y + c.y) / 2 : b.y;
    ctx.save(); _inkSetup(ctx, s);
    ctx.lineWidth = s.er ? s.w : s.w * (0.6 + b.p * 0.9);
    ctx.beginPath();
    ctx.moveTo(sx * W, sy * H);
    ctx.quadraticCurveTo(b.x * W, b.y * H, ex * W, ey * H);
    ctx.stroke();
    ctx.restore();
  }
  function _inkRedraw() {
    if (!INK.ctx || !INK.w) return;
    INK.ctx.clearRect(0, 0, INK.w, INK.h);
    INK.strokes.forEach(s => {
      _inkDot(s);
      if (s.pts.length === 1) return;
      for (let i = 1; i < s.pts.length; i++) _inkSeg(INK.ctx, s, i);
    });
  }
  function _inkClear() { INK.strokes = []; INK.cur = null; _inkRedraw(); }

  function _board(o) {
    const el = _el('lv-board');
    if (!el) return;
    const op = String(o.op || '');

    if (op === 'clear') {
      el.innerHTML = '';
      _inkClear();
      return;
    }
    const empty = el.querySelector('.lv-empty');
    if (empty) empty.remove();

    let node = null;

    if (op === 'title' || op === 'line') {
      node = document.createElement('div');
      node.className = op === 'title' ? 'lv-b-title' : 'lv-b-line';
      node.textContent = _text(o.text, 240);
      node.style.setProperty('--wd', Math.min(3.2, 0.5 + node.textContent.length * 0.04) + 's');

    } else if (op === 'eq') {
      node = document.createElement('div');
      node.className = 'lv-b-eq';
      const tex = _fixTex(_text(o.tex, 240));
      if (window.katex && typeof katex.render === 'function') {
        try { katex.render(tex, node, { throwOnError: false, displayMode: true }); }
        catch (e) { node.textContent = tex; }
      } else {
        node.textContent = tex;
      }

    } else if (op === 'table') {
      const rows = Array.isArray(o.rows) ? o.rows.slice(0, 12) : [];
      if (!rows.length) return;
      node = document.createElement('table');
      node.className = 'lv-b-table';
      rows.forEach((r, ri) => {
        if (!Array.isArray(r)) return;
        const tr = document.createElement('tr');
        r.slice(0, 6).forEach(c => {
          const cell = document.createElement(ri === 0 ? 'th' : 'td');
          cell.textContent = _text(c, 40);
          tr.appendChild(cell);
        });
        node.appendChild(tr);
      });

    } else if (op === 'graph') {
      node = _buildGraph(o);
      if (!node) return;
    } else {
      return;
    }

    node.setAttribute('data-bi', '1');
    el.appendChild(node);
    if (typeof node._init === 'function') node._init();
    while (el.querySelectorAll('[data-bi]').length > MAX_BOARD) {
      const first = el.querySelector('[data-bi]');
      if (first) first.remove(); else break;
    }
    el.scrollTop = el.scrollHeight;

    if (G.mobileTab !== 'board') {
      const d = _el('lv-dot-board'); if (d) d.classList.add('on');
    }
  }

  let _jxgN = 0, _jxgState = 0, _jxgWait = [];
  function _loadJSX(cb) {
    if (window.JXG && window.JXG.JSXGraph) return cb(true);
    _jxgWait.push(cb);
    if (_jxgState === 1) return;
    _jxgState = 1;
    const done = ok => { _jxgState = ok ? 2 : 0; const w = _jxgWait; _jxgWait = []; w.forEach(f => f(ok)); };
    if (!document.querySelector('link[data-jsx]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = JSX_CSS; l.setAttribute('data-jsx', '1');
      document.head.appendChild(l);
    }
    const sc = document.createElement('script');
    sc.src = JSX_JS; sc.async = true;
    sc.onload = () => done(!!(window.JXG && window.JXG.JSXGraph));
    sc.onerror = () => done(false);
    document.head.appendChild(sc);
  }

  /* Interactive graph (JSXGraph). Falls back to the plain SVG graph if it cannot load. */
  function _buildGraph(o) {
    let f;
    try { f = _compileExpr(o.expr); } catch (e) { return null; }
    const xmin = _num(o.xmin, -5, -1e3, 1e3);
    let xmax = _num(o.xmax, 5, -1e3, 1e3);
    if (xmax <= xmin) xmax = xmin + 10;
    let ymin = Number(o.ymin), ymax = Number(o.ymax);
    if (!isFinite(ymin) || !isFinite(ymax) || ymax <= ymin) {
      ymin = Infinity; ymax = -Infinity;
      for (let i = 0; i <= 120; i++) {
        const y = f(xmin + (xmax - xmin) * i / 120);
        if (isFinite(y) && Math.abs(y) < 1e6) { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
      }
      if (!isFinite(ymin) || !isFinite(ymax)) return null;
      const padY = (ymax - ymin) * 0.1 || 1;
      ymin -= padY; ymax += padY;
    }
    const box = document.createElement('div');
    box.className = 'lv-graph';
    const holder = document.createElement('div');
    holder.className = 'lv-jxg';
    holder.id = 'lv-jxg-' + (++_jxgN);
    box.appendChild(holder);
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.textContent = _text(o.label || ('y = ' + o.expr), 100);
    box.appendChild(cap);

    function fallback() {
      const fb = _buildGraphSVG(o);
      if (fb && box.parentNode) box.parentNode.replaceChild(fb, box);
    }
    box._init = function () {
      _loadJSX(ok => {
        if (!ok) return fallback();
        let jb = null;
        const make = () => {
          try {
            jb = JXG.JSXGraph.initBoard(holder.id, {
              boundingbox: [xmin, ymax, xmax, ymin], axis: true, grid: true,
              showCopyright: false, showNavigation: false, keepAspectRatio: false,
              pan: { enabled: true, needTwoFingers: true },
              zoom: { wheel: false, pinch: true, needShift: false },
            });
            const curve = jb.create('functiongraph', [x => { const y = f(x); return isFinite(y) ? y : NaN; }],
              { strokeColor: '#1d4ed8', strokeWidth: 3, highlightStrokeColor: '#1d4ed8' });
            try { jb.create('glider', [(xmin + xmax) / 2, 0, curve], { name: '', size: 4, fillColor: '#dc2626', strokeColor: '#dc2626', showInfobox: true }); } catch (e) {}
          } catch (e) { console.warn('[LiveClass] JSXGraph failed', e); fallback(); }
        };
        const ro = window.ResizeObserver ? new ResizeObserver(() => {
          const w = holder.clientWidth, h = holder.clientHeight;
          if (!w || !h) return;
          if (!jb) make();
          else { try { jb.resizeContainer(w, h, true); jb.update(); } catch (e) {} }
        }) : null;
        if (ro) ro.observe(holder); else make();
      });
    };
    return box;
  }

  function _buildGraphSVG(o) {
    let f;
    try { f = _compileExpr(o.expr); } catch (e) { return null; }

    const NS = 'http://www.w3.org/2000/svg';
    const W = 360, H = 240, pad = 28;
    const xmin = _num(o.xmin, -5, -1e3, 1e3);
    let xmax = _num(o.xmax, 5, -1e3, 1e3);
    if (xmax <= xmin) xmax = xmin + 10;

    /* auto y-range if not given */
    let ymin = Number(o.ymin), ymax = Number(o.ymax);
    if (!isFinite(ymin) || !isFinite(ymax) || ymax <= ymin) {
      ymin = Infinity; ymax = -Infinity;
      for (let i = 0; i <= 120; i++) {
        const y = f(xmin + (xmax - xmin) * i / 120);
        if (isFinite(y) && Math.abs(y) < 1e6) { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
      }
      if (!isFinite(ymin) || !isFinite(ymax)) return null;
      const padY = (ymax - ymin) * 0.1 || 1;
      ymin -= padY; ymax += padY;
    }

    const sx = x => pad + (x - xmin) / (xmax - xmin) * (W - 2 * pad);
    const sy = y => H - pad - (y - ymin) / (ymax - ymin) * (H - 2 * pad);

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    function line(x1, y1, x2, y2, stroke, w) {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
      l.setAttribute('stroke', stroke); l.setAttribute('stroke-width', w);
      svg.appendChild(l);
    }
    function label(x, y, txt, anchor) {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x); t.setAttribute('y', y);
      t.setAttribute('font-size', '10'); t.setAttribute('fill', 'currentColor');
      t.setAttribute('text-anchor', anchor || 'middle');
      t.setAttribute('opacity', '.65');
      t.textContent = txt;
      svg.appendChild(t);
    }
    const fmt = v => (Math.abs(v) >= 100 || Number.isInteger(v)) ? String(Math.round(v)) : v.toFixed(1);

    for (let i = 0; i <= 4; i++) {
      const gx = pad + i * (W - 2 * pad) / 4, gy = pad + i * (H - 2 * pad) / 4;
      line(gx, pad, gx, H - pad, 'rgba(148,163,184,.25)', 1);
      line(pad, gy, W - pad, gy, 'rgba(148,163,184,.25)', 1);
    }
    if (ymin < 0 && ymax > 0) line(pad, sy(0), W - pad, sy(0), 'rgba(148,163,184,.8)', 1.4);
    if (xmin < 0 && xmax > 0) line(sx(0), pad, sx(0), H - pad, 'rgba(148,163,184,.8)', 1.4);
    label(pad, H - 10, fmt(xmin)); label(W - pad, H - 10, fmt(xmax));
    label(pad - 4, H - pad, fmt(ymin), 'end'); label(pad - 4, pad + 8, fmt(ymax), 'end');

    /* the curve, broken wherever the function is undefined or jumps off-screen */
    let d = '', pen = false;
    const STEPS = 240;
    for (let i = 0; i <= STEPS; i++) {
      const x = xmin + (xmax - xmin) * i / STEPS, y = f(x);
      if (!isFinite(y) || y > ymax + (ymax - ymin) * 2 || y < ymin - (ymax - ymin) * 2) { pen = false; continue; }
      d += (pen ? ' L' : ' M') + sx(x).toFixed(1) + ' ' + sy(y).toFixed(1);
      pen = true;
    }
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d.trim()); path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#6366f1'); path.setAttribute('stroke-width', '2.4');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);

    const box = document.createElement('div');
    box.className = 'lv-graph';
    box.appendChild(svg);
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.textContent = _text(o.label || ('y = ' + o.expr), 100);
    box.appendChild(cap);
    return box;
  }

  /* ══════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════ */

  window.ThreeDLive = {
    open,
    _test: { compileExpr: _compileExpr, parseLine: _parseLine, fixTex: _fixTex, stage: function () { return S; } },
  };

}());
