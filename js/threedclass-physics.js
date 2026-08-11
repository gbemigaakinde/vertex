/* ============================================================
   js/threedclass-physics.js — Interactive Physics Module
   ============================================================ */

(function () {
  'use strict';

  const THREEJS_CDN  = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const ORBIT_CDN    = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';

  let _threeLoaded = false;
  let _threeQueue  = [];

  function _loadThreeJS(cb) {
    if (_threeLoaded && window.THREE && window.THREE.OrbitControls) { cb(); return; }
    _threeQueue.push(cb);
    if (_threeQueue.length > 1) return;
    if (window.THREE && !window.THREE.OrbitControls) {
      // Three loaded but no OrbitControls
      const s2 = document.createElement('script');
      s2.src = ORBIT_CDN;
      s2.onload = () => {
        _threeLoaded = true;
        _threeQueue.forEach(fn => fn());
        _threeQueue = [];
      };
      document.head.appendChild(s2);
      return;
    }
    if (!window.THREE) {
      const s1 = document.createElement('script');
      s1.src = THREEJS_CDN;
      s1.onload = () => {
        const s2 = document.createElement('script');
        s2.src = ORBIT_CDN;
        s2.onload = () => {
          _threeLoaded = true;
          _threeQueue.forEach(fn => fn());
          _threeQueue = [];
        };
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
    }
  }

  const TOPICS = {
    forces: {
      id: 'forces', label: 'Forces & Motion', icon: '🚀',
      color: '#f97316', dark: '#fb923c',
      subtopics: [
        {
          id: 'newton1', title: "Newton's First Law", subtitle: 'Law of Inertia',
          color: '#f97316', equation: 'If F_net = 0, then a = 0',
          description: "An object at rest stays at rest, and an object in motion stays in motion at constant velocity, unless acted on by an unbalanced (net) force. This is called INERTIA — the resistance of an object to changes in its state of motion.",
          analogy: "A book sitting on a table stays still because friction and normal force balance. A hockey puck sliding on frictionless ice would go forever.",
          examTip: "Key phrase: 'unbalanced force'. If forces are balanced (F_net = 0), there is no acceleration — the object either stays still OR moves at constant speed.",
          facts: ["Mass is the measure of inertia", "Greater mass = greater inertia", "No net force = no acceleration", "Applies to both rest and uniform motion"],
        },
        {
          id: 'newton2', title: "Newton's Second Law", subtitle: 'F = ma',
          color: '#ef4444', equation: 'F = ma',
          description: "The acceleration of an object is directly proportional to the net force applied, and inversely proportional to its mass. Doubling the force doubles the acceleration. Doubling the mass halves the acceleration.",
          analogy: "Pushing a shopping trolley: push harder (more F) = accelerates faster. A full trolley (more m) = harder to accelerate.",
          examTip: "F is the NET force (resultant of all forces). Always use SI units: F in Newtons (N), m in kg, a in m/s². Rearrange: a = F/m, m = F/a.",
          facts: ["F = ma (F in N, m in kg, a in m/s²)", "Net force causes acceleration", "Acceleration is in the direction of net force", "1 Newton = 1 kg·m/s²"],
        },
        {
          id: 'newton3', title: "Newton's Third Law", subtitle: 'Action & Reaction',
          color: '#8b5cf6', equation: 'F_AB = −F_BA',
          description: "For every action force, there is an equal and opposite reaction force. Forces always come in pairs — they act on DIFFERENT objects, so they do NOT cancel each other.",
          analogy: "A rocket expels gas downward (action) — the gas pushes the rocket upward (reaction). Your feet push the Earth backward; the Earth pushes your feet forward.",
          examTip: "Critical: action-reaction pairs act on DIFFERENT objects. They are equal in magnitude, opposite in direction, and of the SAME TYPE. They never cancel because they act on different bodies.",
          facts: ["Forces come in pairs", "Equal magnitude, opposite direction", "Act on DIFFERENT objects", "Same type of force (e.g. both gravitational)"],
        },
        {
          id: 'friction', title: 'Friction', subtitle: 'Resistive Force',
          color: '#10b981', equation: 'f = μN',
          description: "Friction is a contact force that opposes relative motion or attempted motion between surfaces. Static friction prevents motion from starting; kinetic friction opposes ongoing motion.",
          analogy: "Walking works because of friction — your foot pushes backward, friction pushes you forward. On ice, friction is very low so you slip.",
          examTip: "μ = coefficient of friction (no units). f = μN where N is the normal force. Static friction (μₛ) > kinetic friction (μₖ) — it's harder to START sliding than to KEEP sliding.",
          facts: ["f = μN (friction = μ × normal force)", "μₛ > μₖ always", "Acts parallel to surface", "Converted to heat energy"],
        },
        {
          id: 'momentum', title: 'Momentum & Impulse', subtitle: 'p = mv',
          color: '#0ea5e9', equation: 'p = mv,  J = FΔt = Δp',
          description: "Momentum (p) is mass × velocity. Impulse (J) is the change in momentum, equal to force × time. Conservation of momentum: total momentum before = total momentum after in a closed system.",
          analogy: "A cricket ball and a shot put thrown at the same speed have very different momenta. A crumple zone increases collision time, reducing force on passengers.",
          examTip: "Conservation: m₁u₁ + m₂u₂ = m₁v₁ + m₂v₂. Elastic collision: KE conserved. Inelastic: KE not conserved. Impulse = area under F-t graph.",
          facts: ["p = mv (kg·m/s)", "J = FΔt = Δp", "Momentum is conserved in closed systems", "Vector quantity — direction matters"],
        },
      ],
    },
    waves: {
      id: 'waves', label: 'Waves', icon: '〰️',
      color: '#06b6d4', dark: '#22d3ee',
      subtopics: [
        {
          id: 'transverse', title: 'Transverse Waves', subtitle: 'Perpendicular oscillation',
          color: '#06b6d4', equation: 'v = fλ',
          description: "In a transverse wave, particles oscillate perpendicular (at 90°) to the direction of wave travel. Light, water ripples, and S-waves are transverse.",
          analogy: "Shaking a rope up-and-down while the wave travels horizontally. The rope particles move up and down — the wave moves sideways.",
          examTip: "v = fλ. Period T = 1/f. Amplitude = maximum displacement. Wavelength = crest to crest distance. For light: c = fλ where c = 3×10⁸ m/s.",
          facts: ["Particles oscillate ⊥ to wave direction", "Examples: light, water waves, S-waves", "v = fλ", "T = 1/f"],
        },
        {
          id: 'longitudinal', title: 'Longitudinal Waves', subtitle: 'Parallel oscillation',
          color: '#8b5cf6', equation: 'v = fλ',
          description: "In a longitudinal wave, particles oscillate parallel to the direction of wave travel, forming compressions (high pressure) and rarefactions (low pressure). Sound and P-waves are longitudinal.",
          analogy: "Push-and-pull a slinky along its length — coils bunch together (compression) and spread apart (rarefaction), but each coil only moves back and forth.",
          examTip: "Sound is longitudinal — cannot travel in vacuum. Compression = high pressure. Rarefaction = low pressure. Wavelength = distance between two adjacent compressions.",
          facts: ["Particles oscillate ∥ to wave direction", "Examples: sound, P-waves, ultrasound", "Compressions and rarefactions", "Can travel through all states of matter"],
        },
        {
          id: 'em_spectrum', title: 'Electromagnetic Spectrum', subtitle: 'The family of EM waves',
          color: '#f59e0b', equation: 'c = fλ = 3×10⁸ m/s',
          description: "Electromagnetic waves are transverse waves that carry energy and travel at the speed of light (3×10⁸ m/s) in a vacuum. They require NO medium. The spectrum ranges from radio waves to gamma rays.",
          analogy: "A piano keyboard — low notes (radio) at one end, high notes (gamma) at the other. All EM waves travel at the same speed in a vacuum.",
          examTip: "ORDER: Radio → Microwave → Infrared → Visible → UV → X-ray → Gamma. 'Raving Martians Invaded Venus Using X-ray Guns'. Higher frequency = more energy.",
          facts: ["All travel at c = 3×10⁸ m/s in vacuum", "Transverse waves, no medium needed", "Higher f → shorter λ → more energy", "Radio waves: km wavelengths; Gamma: picometres"],
        },
        {
          id: 'reflection_refraction', title: 'Reflection & Refraction', subtitle: 'Wave behaviour at boundaries',
          color: '#22c55e', equation: 'n = c/v,  n₁sinθ₁ = n₂sinθ₂',
          description: "Reflection: wave bounces off a surface (angle of incidence = angle of reflection). Refraction: wave changes speed when passing from one medium to another. Slowing down bends toward the normal.",
          analogy: "Light bending in a glass of water — your straw looks 'broken'. This is refraction. A mirror gives reflection.",
          examTip: "Snell's Law: n₁sinθ₁ = n₂sinθ₂. n = c/v. Denser medium = higher n = slower speed = bends toward normal. Total internal reflection when angle > critical angle.",
          facts: ["Angle of incidence = angle of reflection", "Refraction: speed change → direction change", "n = c/v (refractive index)", "Snell's Law: n₁sinθ₁ = n₂sinθ₂"],
        },
      ],
    },
    electricity: {
      id: 'electricity', label: 'Electricity', icon: '⚡',
      color: '#f59e0b', dark: '#fbbf24',
      subtopics: [
        {
          id: 'ohms_law', title: "Ohm's Law", subtitle: 'V = IR',
          color: '#f59e0b', equation: 'V = IR',
          description: "Ohm's Law states that the voltage across a conductor is directly proportional to the current flowing through it, provided temperature remains constant.",
          analogy: "Water in a pipe: voltage = water pressure, current = flow rate, resistance = pipe narrowness.",
          examTip: "V = IR triangle: cover what you want. Power: P = IV = I²R = V²/R. Ohmic conductor = straight V-I graph. Filament bulb = non-ohmic.",
          facts: ["V = IR (Volts, Amps, Ohms)", "P = IV = I²R = V²/R", "Ohmic: straight V-I graph", "Series: R_total = R₁+R₂; Parallel: 1/R_T = 1/R₁+1/R₂"],
        },
        {
          id: 'series_parallel', title: 'Series & Parallel Circuits', subtitle: 'Circuit configurations',
          color: '#ef4444', equation: 'Series: I same; Parallel: V same',
          description: "Series circuit: components in one loop. Same current everywhere. If one fails, all fail. Parallel circuit: components across same two points. Same voltage everywhere. Independent paths.",
          analogy: "Series = one road. Parallel = a motorway with multiple lanes — traffic splits.",
          examTip: "Series: V_total = V₁+V₂, R_total = R₁+R₂. Parallel: I_total = I₁+I₂, 1/R_T = 1/R₁+1/R₂. Household wiring is parallel.",
          facts: ["Series: current same throughout", "Parallel: voltage same throughout", "Household circuits: parallel", "Parallel: more components = less total resistance"],
        },
        {
          id: 'electric_field', title: 'Electric Fields & Charge', subtitle: "Coulomb's Law",
          color: '#8b5cf6', equation: 'F = kQ₁Q₂/r²',
          description: "An electric field is a region where a charged particle experiences a force. Like charges repel; unlike charges attract. Force depends on charge magnitudes and distance.",
          analogy: "A positive charge pushes everyone away; a negative charge pulls everyone in.",
          examTip: "Field lines go from + to −. Closer lines = stronger field. E = F/q (N/C or V/m). Between parallel plates: E = V/d.",
          facts: ["Like charges repel; unlike attract", "F = kQ₁Q₂/r² (Coulomb's Law)", "E = F/q (N/C)", "Field lines: + to −, never cross"],
        },
      ],
    },
    energy: {
      id: 'energy', label: 'Energy', icon: '🔋',
      color: '#22c55e', dark: '#4ade80',
      subtopics: [
        {
          id: 'ke_pe', title: 'Kinetic & Potential Energy', subtitle: 'Mechanical energy forms',
          color: '#22c55e', equation: 'KE = ½mv²,  GPE = mgh',
          description: "Kinetic energy (KE) is the energy an object has due to its motion. Gravitational potential energy (GPE) is energy stored due to position. In a closed system, mechanical energy is conserved.",
          analogy: "A roller coaster: at the top, all GPE and no KE. At the bottom, all KE and no GPE. Total stays the same.",
          examTip: "KE = ½mv². GPE = mgh (g = 9.8 or 10 m/s²). Conservation: ½mv² = mgh → v = √(2gh).",
          facts: ["KE = ½mv² (Joules)", "GPE = mgh (Joules)", "Mechanical energy = KE + GPE", "Conserved when no friction/air resistance"],
        },
        {
          id: 'work_power', title: 'Work, Power & Efficiency', subtitle: 'Energy in action',
          color: '#f97316', equation: 'W = Fs,  P = W/t,  Eff = P_out/P_in',
          description: "Work is done when a force moves an object through a distance. Power is the rate of doing work. Efficiency measures how much input energy is usefully transferred.",
          analogy: "Work = how much you've done. Power = how fast you do it. An efficient car converts more petrol to motion, less to heat.",
          examTip: "W = Fs (J). P = W/t = Fv (W). Efficiency = useful output / total input × 100%. Sankey diagrams show energy transfers.",
          facts: ["W = Fs (Joules)", "P = W/t (Watts)", "Efficiency = (useful output / total input) × 100%", "1 W = 1 J/s"],
        },
        {
          id: 'energy_transfer', title: 'Energy Transfer & Conservation', subtitle: 'The big law of physics',
          color: '#0ea5e9', equation: 'Energy cannot be created or destroyed',
          description: "Energy cannot be created or destroyed, only converted from one form to another. Forms include: kinetic, gravitational potential, elastic potential, thermal, chemical, electrical, nuclear, light, and sound.",
          analogy: "Energy is like money — you can transfer it between accounts, but the total never changes.",
          examTip: "Sankey diagram: wider arrow = more energy. The arrow splits into useful and wasted (usually heat). Total width must be conserved.",
          facts: ["Energy is always conserved", "8 main forms of energy", "Thermal (heat) is the most common wasted form", "Sankey diagrams show transfers visually"],
        },
      ],
    },
  };

  const QUIZ_QUESTIONS = [
    { q: "A 5 kg object accelerates at 3 m/s². What is the net force?", a: "15 N", options: ["8 N", "15 N", "1.67 N", "35 N"], explain: "F = ma = 5 × 3 = 15 N" },
    { q: "What is the momentum of a 2 kg ball moving at 10 m/s?", a: "20 kg·m/s", options: ["5 kg·m/s", "12 kg·m/s", "20 kg·m/s", "8 kg·m/s"], explain: "p = mv = 2 × 10 = 20 kg·m/s" },
    { q: "Which type of wave requires NO medium to travel?", a: "Electromagnetic", options: ["Sound", "Seismic", "Electromagnetic", "Water waves"], explain: "Electromagnetic waves travel through a vacuum — no medium needed." },
    { q: "A circuit has V = 12 V and R = 4 Ω. What is the current?", a: "3 A", options: ["48 A", "3 A", "8 A", "0.33 A"], explain: "I = V/R = 12/4 = 3 A (Ohm's Law)" },
    { q: "KE = ½mv². What is the KE of a 4 kg object moving at 6 m/s?", a: "72 J", options: ["48 J", "12 J", "72 J", "144 J"], explain: "KE = ½ × 4 × 6² = ½ × 4 × 36 = 72 J" },
    { q: "Newton's First Law is also known as the Law of...", a: "Inertia", options: ["Gravity", "Action-Reaction", "Inertia", "Momentum"], explain: "Newton's First Law (inertia): objects resist changes to their state of motion unless acted on by an unbalanced force." },
    { q: "In a parallel circuit with R₁=6Ω and R₂=3Ω, what is the total resistance?", a: "2 Ω", options: ["9 Ω", "4.5 Ω", "2 Ω", "18 Ω"], explain: "1/R_T = 1/6 + 1/3 = 3/6 = 1/2, so R_T = 2 Ω" },
    { q: "GPE = mgh. What is the GPE of a 3 kg object at height 5 m? (g=10)", a: "150 J", options: ["15 J", "150 J", "50 J", "30 J"], explain: "GPE = mgh = 3 × 10 × 5 = 150 J" },
    { q: "Which quantity is preserved in an elastic collision?", a: "Both momentum and KE", options: ["Momentum only", "KE only", "Both momentum and KE", "Neither"], explain: "Elastic collision: both momentum AND kinetic energy are conserved." },
    { q: "A wave has frequency 200 Hz and wavelength 1.5 m. What is its speed?", a: "300 m/s", options: ["133 m/s", "201.5 m/s", "300 m/s", "298.5 m/s"], explain: "v = fλ = 200 × 1.5 = 300 m/s" },
    { q: "Power = Work / Time. If 600 J is done in 3 s, what is the power?", a: "200 W", options: ["1800 W", "200 W", "300 W", "100 W"], explain: "P = W/t = 600/3 = 200 W" },
    { q: "In a transverse wave, particles oscillate...", a: "Perpendicular to wave travel", options: ["Parallel to wave travel", "In circular paths", "Perpendicular to wave travel", "Randomly"], explain: "Transverse waves: particle motion is at 90° to the direction of wave propagation." },
    { q: "What is the unit of electric charge?", a: "Coulomb (C)", options: ["Ampere (A)", "Volt (V)", "Coulomb (C)", "Ohm (Ω)"], explain: "The SI unit of electric charge is the Coulomb (C)." },
    { q: "Work = Force × Distance. A 20 N force moves an object 3 m. Work done?", a: "60 J", options: ["60 J", "23 J", "6.67 J", "17 J"], explain: "W = Fs = 20 × 3 = 60 J" },
    { q: "An efficiency of 75% means...", a: "25% energy is wasted", options: ["75% energy is wasted", "25% energy is wasted", "All energy is useful", "None of the above"], explain: "Efficiency 75% → 25% is wasted. Only 75% of input energy does useful work." },
  ];

  let _onBack       = null;
  let _activeTab    = 'forces';
  let _activeSubIdx = 0;
  let _quizIdx      = 0;
  let _quizScore    = 0;
  let _quizAnswered = false;
  let _quizSelected = null;
  let _quizDone     = false;
  let _shuffledQuiz = [];
  let _three        = null;

  function open(onBackCallback) {
    _onBack       = onBackCallback || null;
    _activeTab    = 'forces';
    _activeSubIdx = 0;
    _quizIdx      = 0;
    _quizScore    = 0;
    _quizAnswered = false;
    _quizSelected = null;
    _quizDone     = false;
    _shuffledQuiz = _shuffle([...QUIZ_QUESTIONS]);
    _destroyThree();
    _loadThreeJS(() => _render());
  }

  function _render() {
    UI.mount(`
      <div id="phys-shell" style="display:flex;flex-direction:column;height:100dvh;background:var(--bg-page);overflow:hidden;font-family:var(--font);">
        ${_buildTopBar()}
        ${_buildTabBar()}
        <div id="phys-content" style="flex:1 1 0;overflow:hidden;position:relative;">
          ${_buildContent()}
        </div>
      </div>
      <style>
        .phys-tab{font-size:.625rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:4px 10px;border-radius:99px;border:1.5px solid var(--border);background:var(--bg-subtle);color:var(--text-3);cursor:pointer;white-space:nowrap;font-family:var(--font);flex-shrink:0;transition:all .12s ease;}
        .phys-tab.active{background:var(--accent);color:#fff;border-color:var(--accent);}
        .phys-sub-btn{text-align:left;width:100%;padding:.5rem .75rem;border-radius:var(--r-lg);border:2px solid var(--border);background:var(--bg-base);color:var(--text-2);font-family:var(--font);font-size:var(--text-xs);font-weight:600;cursor:pointer;transition:all .12s;display:flex;align-items:center;gap:.5rem;}
        .phys-sub-btn.active{border-color:var(--accent);background:var(--accent-subtle);color:var(--accent-text);}
        .phys-sub-btn:hover:not(.active){border-color:var(--border-strong);background:var(--bg-subtle);}
        .phys-quiz-opt{display:block;width:100%;text-align:left;padding:.625rem 1rem;border-radius:var(--r-lg);border:2px solid var(--border);background:var(--bg-base);color:var(--text-1);font-family:var(--font);font-size:var(--text-sm);font-weight:500;cursor:pointer;margin-bottom:.5rem;transition:all .12s;}
        .phys-quiz-opt:hover:not(:disabled){border-color:var(--accent);background:var(--accent-subtle);}
        .phys-quiz-opt.correct{background:#d1fae5;border-color:#22c55e;color:#14532d;}
        .phys-quiz-opt.wrong{background:#ffe4e6;border-color:#ef4444;color:#9f1239;}
        [data-theme="dark"] .phys-quiz-opt.correct{background:#052e16;border-color:#22c55e;color:#4ade80;}
        [data-theme="dark"] .phys-quiz-opt.wrong{background:#4c0519;border-color:#ef4444;color:#fda4af;}
        .phys-step-btn{padding:.375rem .875rem;border-radius:var(--r-md);font-size:var(--text-sm);font-weight:600;border:1px solid var(--border);background:var(--bg-subtle);color:var(--text-2);cursor:pointer;font-family:var(--font);transition:all .12s;}
        .phys-step-btn.primary{background:var(--accent);color:#fff;border-color:var(--accent);}
        .phys-3d-canvas-wrap{width:100%!important;height:220px!important;display:block!important;position:relative!important;overflow:hidden!important;}
        #phys-3d-canvas{display:block!important;width:100%!important;height:220px!important;position:absolute!important;top:0!important;left:0!important;}
        @keyframes phys-slide-in{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
        .phys-scene-label{position:absolute;padding:2px 7px;border-radius:5px;font-size:.6rem;font-weight:700;pointer-events:none;white-space:nowrap;z-index:5;}
      </style>`);
    requestAnimationFrame(() => _launchScene());
  }

  function _buildTopBar() {
    return `
      <div style="display:flex;align-items:center;gap:.5rem;padding:.45rem .875rem;border-bottom:1px solid var(--border);background:var(--bg-base);flex-shrink:0;min-height:2.75rem;">
        <button onclick="ThreeDPhysics._back()" style="display:inline-flex;align-items:center;font-size:var(--text-sm);font-weight:500;color:var(--text-2);background:var(--bg-subtle);border:1px solid var(--border);border-radius:var(--r-md);padding:.275rem .6rem;cursor:pointer;font-family:var(--font);flex-shrink:0;">← Back</button>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--text-base);font-weight:700;color:var(--text-1);letter-spacing:-.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">⚛️ Physics — Forces, Waves & Energy</div>
        </div>
      </div>`;
  }

  function _buildTabBar() {
    const tabs = [
      { id:'forces', icon:'🚀', label:'Forces' },
      { id:'waves', icon:'〰️', label:'Waves' },
      { id:'electricity', icon:'⚡', label:'Electric' },
      { id:'energy', icon:'🔋', label:'Energy' },
      { id:'quiz', icon:'🧮', label:'Quiz' },
    ];
    return `
      <div style="flex-shrink:0;display:flex;align-items:center;gap:.375rem;padding:.35rem .875rem;border-bottom:1px solid var(--border);overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;background:var(--bg-base);">
        ${tabs.map(t => `<button class="phys-tab${_activeTab===t.id?' active':''}" onclick="ThreeDPhysics._setTab('${t.id}')">${t.icon} ${t.label}</button>`).join('')}
      </div>`;
  }

  function _buildContent() {
    if (_activeTab === 'quiz') return _buildQuizView();
    const group = TOPICS[_activeTab];
    if (!group) return '';
    return _buildTopicView(group);
  }

  function _buildTopicView(group) {
    const sub = group.subtopics[_activeSubIdx] || group.subtopics[0];
    return `
      <div style="display:flex;height:100%;overflow:hidden;">
        <div style="width:148px;flex-shrink:0;overflow-y:auto;border-right:1px solid var(--border);background:var(--bg-base);padding:.5rem .4rem;scrollbar-width:thin;">
          <div style="font-size:.5rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--text-4);margin-bottom:.4rem;padding:0 .25rem;">Topics</div>
          ${group.subtopics.map((s,i) => `
            <button class="phys-sub-btn${i===_activeSubIdx?' active':''}" onclick="ThreeDPhysics._setSub(${i})">
              <span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:${s.color};"></span>
              <span style="line-height:1.35;">${s.title}</span>
            </button>`).join('')}
        </div>
        <div style="flex:1 1 0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;">
          <div style="padding:.75rem;max-width:700px;margin:0 auto;animation:phys-slide-in .3s ease;">
            <div style="margin-bottom:.75rem;padding:.875rem 1rem;border-radius:var(--r-xl);background:${sub.color}14;border:1.5px solid ${sub.color}44;">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;">
                <div>
                  <div style="font-size:var(--text-md);font-weight:800;color:var(--text-1);letter-spacing:-.02em;margin-bottom:2px;">${sub.title}</div>
                  <div style="font-size:.6rem;font-weight:600;color:${sub.color};text-transform:uppercase;letter-spacing:.05em;">${sub.subtitle}</div>
                </div>
                <div style="background:${sub.color};color:#fff;border-radius:var(--r-md);padding:.25rem .625rem;font-family:monospace;font-size:.75rem;font-weight:700;white-space:nowrap;flex-shrink:0;box-shadow:0 2px 8px ${sub.color}55;">${sub.equation}</div>
              </div>
            </div>

            <!-- 3D Canvas container — FIXED sizing -->
            <div id="phys-3d-container" class="phys-3d-canvas-wrap" style="margin-bottom:.75rem;border-radius:var(--r-xl);background:#0a0a1a;border:1px solid ${sub.color}44;">
              <canvas id="phys-3d-canvas" width="1" height="1"></canvas>
              <div id="phys-scene-labels" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:4;"></div>
            </div>

            <div style="margin-bottom:.625rem;border-left:3px solid ${sub.color};padding:.5rem .75rem;background:var(--bg-base);border-radius:0 var(--r-md) var(--r-md) 0;">
              <p style="font-size:var(--text-sm);color:var(--text-2);line-height:1.7;margin:0;">${sub.description}</p>
            </div>
            <div style="margin-bottom:.625rem;padding:.5rem .75rem;border-radius:var(--r-lg);background:${sub.color}0d;border:1px solid ${sub.color}30;">
              <div style="font-size:.5rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:${sub.color};margin-bottom:.2rem;">💡 Real-World Analogy</div>
              <p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.55;margin:0;font-style:italic;">${sub.analogy}</p>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem;margin-bottom:.625rem;">
              ${sub.facts.map(f=>`<div style="background:var(--bg-subtle);border:1px solid var(--border);border-radius:var(--r-sm);padding:.3rem .5rem;font-size:.575rem;color:var(--text-2);line-height:1.45;">● ${f}</div>`).join('')}
            </div>
            <div style="padding:.625rem .875rem;border-radius:var(--r-lg);background:var(--warning-subtle);border:1px solid var(--warning-border);">
              <div style="font-size:.5rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--warning);margin-bottom:.25rem;">📝 Exam Tip</div>
              <p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.6;margin:0;">${sub.examTip}</p>
            </div>
            <div style="display:flex;gap:.5rem;justify-content:space-between;margin-top:.75rem;padding-bottom:.75rem;">
              <button class="phys-step-btn" onclick="ThreeDPhysics._prevSub()" ${_activeSubIdx===0?'disabled style="opacity:.4;cursor:not-allowed;"':''}>← Previous</button>
              <span style="font-size:var(--text-xs);color:var(--text-4);line-height:2.2;">${_activeSubIdx+1} / ${group.subtopics.length}</span>
              <button class="phys-step-btn primary" onclick="ThreeDPhysics._nextSub()">${_activeSubIdx<group.subtopics.length-1?'Next →':'Done ✓'}</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  function _destroyThree() {
    if (!_three) return;
    if (_three.raf) cancelAnimationFrame(_three.raf);
    if (_three.renderer) {
      _three.renderer.dispose();
      try { _three.renderer.forceContextLoss(); } catch(e){}
    }
    if (_three.scene) {
      _three.scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    }
    _three = null;
  }

  function _launchScene() {
    _destroyThree();
    if (_activeTab === 'quiz') return;
    if (!window.THREE) { setTimeout(_launchScene, 200); return; }

    const canvas    = document.getElementById('phys-3d-canvas');
    const container = document.getElementById('phys-3d-container');
    if (!canvas || !container) return;

    const THREE = window.THREE;

    // Force explicit pixel dimensions
    const W = container.offsetWidth  || 360;
    const H = 220;

    canvas.width  = W * (window.devicePixelRatio || 1);
    canvas.height = H * (window.devicePixelRatio || 1);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch(e) {
      console.warn('WebGL failed:', e);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    renderer.shadowMap.enabled = true;
    renderer.setClearColor(0x080818, 1);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDark ? 0x080818 : 0x0d0d2b);
    scene.fog = new THREE.Fog(isDark ? 0x080818 : 0x0d0d2b, 18, 45);

    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
    camera.position.set(0, 3, 10);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, 10, 7);
    dir.castShadow = true;
    scene.add(dir);

    const fill = new THREE.PointLight(0x4466ff, 0.6, 30);
    fill.position.set(-5, 5, 5);
    scene.add(fill);

    const group = TOPICS[_activeTab];
    const sub   = group ? group.subtopics[_activeSubIdx] : null;

    // Create _three object BEFORE calling build function
    _three = { renderer, scene, camera, raf: null, updateFn: null, W, H };

    const buildFns = {
      newton1:               _scene_newton1,
      newton2:               _scene_newton2,
      newton3:               _scene_newton3,
      friction:              _scene_friction,
      momentum:              _scene_momentum,
      transverse:            _scene_transverse,
      longitudinal:          _scene_longitudinal,
      em_spectrum:           _scene_em_spectrum,
      reflection_refraction: _scene_reflection,
      ohms_law:              _scene_ohms_law,
      series_parallel:       _scene_series_parallel,
      electric_field:        _scene_electric_field,
      ke_pe:                 _scene_ke_pe,
      work_power:            _scene_work_power,
      energy_transfer:       _scene_energy_transfer,
    };

    const state = { t: 0, THREE, scene, camera, renderer, W, H, isDark,
                    color: sub ? sub.color : '#ffffff', objects: {}, labels: [] };

    const buildFn = sub ? buildFns[sub.id] : null;
    if (buildFn) {
      try { buildFn(state); } catch(e) { console.warn('Scene build error:', e); }
    }

    // Store updateFn
    _three.updateFn = state._updateFn || null;

    function animate() {
      if (!_three || !document.getElementById('phys-3d-canvas')) {
        _destroyThree();
        return;
      }
      state.t += 0.016;
      if (_three.updateFn) {
        try { _three.updateFn(state); } catch(e){}
      }
      _three.renderer.render(scene, camera);
      _three.raf = requestAnimationFrame(animate);
    }

    _three.raf = requestAnimationFrame(animate);
  }

  function _hex(color) {
    return parseInt(String(color).replace('#', ''), 16);
  }

  function _addLabel(state, text, x, y, color, bg) {
    const el = document.createElement('div');
    el.className = 'phys-scene-label';
    el.textContent = text;
    el.style.cssText = `left:${x}%;top:${y}%;color:${color||'#fff'};background:${bg||'rgba(0,0,0,0.55)'};`;
    const container = document.getElementById('phys-scene-labels');
    if (container) container.appendChild(el);
    state.labels.push(el);
  }

  function _makeArrow(THREE, from, to, color, headSize) {
    const dir  = new THREE.Vector3().subVectors(to, from).normalize();
    const len  = from.distanceTo(to);
    return new THREE.ArrowHelper(dir, from, len, color, headSize||0.35, headSize?headSize*0.6:0.2);
  }

  function _makeBox(THREE, w, h, d, color, metalness, roughness) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color, metalness: metalness||0.3, roughness: roughness||0.6 });
    return new THREE.Mesh(geo, mat);
  }

  function _makeSphere(THREE, r, color, metalness) {
    const geo = new THREE.SphereGeometry(r, 24, 24);
    const mat = new THREE.MeshStandardMaterial({ color, metalness: metalness||0.4, roughness: 0.5 });
    return new THREE.Mesh(geo, mat);
  }

  function _makeGround(THREE, scene, color) {
    const geo = new THREE.PlaneGeometry(22, 22);
    const mat = new THREE.MeshStandardMaterial({ color: color||0x1e293b, roughness: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -1.5;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  function _makeGridHelper(THREE, scene) {
    const grid = new THREE.GridHelper(22, 22, 0x334155, 0x1e293b);
    grid.position.y = -1.49;
    scene.add(grid);
  }

  /* ══════════════════════════════════════════════════
     SCENE BUILDERS — each sets state._updateFn
  ══════════════════════════════════════════════════ */

  function _scene_newton1(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 4, 13);
    _makeGround(THREE, scene);
    _makeGridHelper(THREE, scene);

    // Static box — at rest, forces balanced
    const boxL = _makeBox(THREE, 1.3, 1.3, 1.3, 0x3b82f6);
    boxL.position.set(-3.5, -0.85, 0);
    boxL.castShadow = true;
    scene.add(boxL);

    // Normal and weight arrows on static box
    scene.add(_makeArrow(THREE, new THREE.Vector3(-3.5,-0.2,0), new THREE.Vector3(-3.5,1.3,0), 0xff4444, 0.28));
    scene.add(_makeArrow(THREE, new THREE.Vector3(-3.5,-1.5,0), new THREE.Vector3(-3.5,-2.8,0), 0xff4444, 0.28));

    // Moving box — constant velocity
    const boxR = _makeBox(THREE, 1.3, 1.3, 1.3, 0x22c55e);
    boxR.position.set(-1, -0.85, 0);
    boxR.castShadow = true;
    scene.add(boxR);

    // Trail dots
    for (let i = 0; i < 8; i++) {
      const dot = _makeSphere(THREE, 0.06, 0xf97316);
      dot.position.set(-1.5 - i * 0.55, -1.45, 0);
      scene.add(dot);
    }

    // Velocity arrow
    const velArr = _makeArrow(THREE, new THREE.Vector3(0, -0.85, 0), new THREE.Vector3(2.2, -0.85, 0), 0xf97316, 0.32);
    scene.add(velArr);

    s.objects.boxR = boxR;
    s.objects.velArr = velArr;

    _addLabel(s, 'F_net = 0 → At Rest', 2, 8, '#60a5fa');
    _addLabel(s, 'F_net = 0 → Constant Velocity', 42, 8, '#4ade80');
    _addLabel(s, 'N↑   W↓', 18, 35, '#ff4444', 'rgba(0,0,0,0)');

    s._updateFn = (st) => {
      const x = -1 + (st.t * 1.3) % 6.5;
      st.objects.boxR.position.x = x;
      st.objects.velArr.position.x = x;
    };
  }

  function _scene_newton2(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 4.5, 14);
    _makeGround(THREE, scene);
    _makeGridHelper(THREE, scene);

    const box1 = _makeBox(THREE, 1.4, 1.4, 1.4, 0x3b82f6, 0.4, 0.5);
    box1.castShadow = true;
    scene.add(box1);

    const box2 = _makeBox(THREE, 1.4, 1.4, 1.4, 0xf59e0b, 0.4, 0.5);
    box2.castShadow = true;
    scene.add(box2);

    const arr1 = _makeArrow(THREE, new THREE.Vector3(0,0,2.5), new THREE.Vector3(1.8,0,2.5), 0x60a5fa, 0.28);
    scene.add(arr1);
    const arr2 = _makeArrow(THREE, new THREE.Vector3(0,0,-2.5), new THREE.Vector3(3.0,0,-2.5), 0xfbbf24, 0.32);
    scene.add(arr2);

    // Force labels
    _addLabel(s, 'F=10N → slower (a=5 m/s²)', 2, 8, '#60a5fa');
    _addLabel(s, 'F=20N → faster (a=10 m/s²)', 2, 82, '#fbbf24');

    s.objects.box1 = box1;
    s.objects.box2 = box2;
    s.objects.arr1 = arr1;
    s.objects.arr2 = arr2;

    s._updateFn = (st) => {
      const x1 = -5.5 + (st.t * 1.1) % 9;
      const x2 = -5.5 + (st.t * 2.2) % 9;
      st.objects.box1.position.set(x1, -0.8, 2.5);
      st.objects.box2.position.set(x2, -0.8, -2.5);
      st.objects.arr1.position.set(x1 + 0.7, -0.8, 2.5);
      st.objects.arr2.position.set(x2 + 0.7, -0.8, -2.5);
    };
  }

  function _scene_newton3(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 2.5, 11);
    scene.background = new THREE.Color(0x020210);
    scene.fog = new THREE.Fog(0x020210, 20, 50);

    // Rocket body
    const bodyGeo = new THREE.CylinderGeometry(0.38, 0.48, 2.2, 20);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6366f1, metalness: 0.8, roughness: 0.2 });
    const rocket = new THREE.Mesh(bodyGeo, bodyMat);
    rocket.castShadow = true;
    scene.add(rocket);

    const noseGeo = new THREE.ConeGeometry(0.38, 1.0, 20);
    const nose = new THREE.Mesh(noseGeo, new THREE.MeshStandardMaterial({ color: 0x818cf8, metalness: 0.7 }));
    nose.position.y = 1.6;
    rocket.add(nose);

    // Fins
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.7, 0.55),
        new THREE.MeshStandardMaterial({ color: 0x4f46e5 })
      );
      const angle = (i / 4) * Math.PI * 2;
      fin.position.set(Math.sin(angle) * 0.44, -0.9, Math.cos(angle) * 0.44);
      fin.rotation.y = angle;
      rocket.add(fin);
    }

    // Exhaust particles
    const exhaustGeo = new THREE.BufferGeometry();
    const exhaustPos = new Float32Array(80 * 3);
    for (let i = 0; i < 80; i++) {
      exhaustPos[i * 3]     = (Math.random() - 0.5) * 0.35;
      exhaustPos[i * 3 + 1] = -i * 0.065;
      exhaustPos[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
    }
    exhaustGeo.setAttribute('position', new THREE.BufferAttribute(exhaustPos, 3));
    const exhaust = new THREE.Points(exhaustGeo,
      new THREE.PointsMaterial({ color: 0xfbbf24, size: 0.12, transparent: true, opacity: 0.9 })
    );
    exhaust.position.y = -1.1;
    rocket.add(exhaust);

    // Action / Reaction arrows
    const reactionArr = _makeArrow(THREE, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 5, 0), 0x4ade80, 0.4);
    scene.add(reactionArr);
    const actionArr   = _makeArrow(THREE, new THREE.Vector3(0, -1.1, 0), new THREE.Vector3(0, -4.5, 0), 0xf87171, 0.4);
    scene.add(actionArr);

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      starPos[i*3]   = (Math.random()-0.5) * 30;
      starPos[i*3+1] = (Math.random()-0.5) * 18;
      starPos[i*3+2] = (Math.random()-0.5) * 10 - 5;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.06 })));

    scene.add(new THREE.AmbientLight(0x334466, 1.0));
    const rocketLight = new THREE.PointLight(0x8888ff, 1.5, 15);
    rocketLight.position.set(0, 2, 2);
    scene.add(rocketLight);

    s.objects.rocket = rocket;
    s.objects.exhaust = exhaust;
    s.objects.reactionArr = reactionArr;
    s.objects.actionArr   = actionArr;
    s.objects.rocketLight = rocketLight;

    _addLabel(s, '↑ REACTION — rocket thrust up', 52, 12, '#4ade80');
    _addLabel(s, '↓ ACTION — gas expelled down', 52, 72, '#f87171');

    s._updateFn = (st) => {
      const bob = Math.sin(st.t * 1.2) * 0.4;
      st.objects.rocket.position.y = bob;
      st.objects.reactionArr.position.y = bob + 1;
      st.objects.actionArr.position.y   = bob - 1.1;
      st.objects.rocketLight.position.y = bob + 2;

      const pos = st.objects.exhaust.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - 0.04;
        if (y < -5) y = 0;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + (Math.random()-0.5)*0.015);
      }
      pos.needsUpdate = true;
    };
  }

  function _scene_friction(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 5, 14);
    _makeGround(THREE, scene, 0x374151);
    _makeGridHelper(THREE, scene);

    // Rough surface texture effect
    const surfGeo = new THREE.PlaneGeometry(16, 5, 8, 4);
    const surfMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.98 });
    const surf = new THREE.Mesh(surfGeo, surfMat);
    surf.rotation.x = -Math.PI / 2;
    surf.position.y = -1.485;
    scene.add(surf);

    const box = _makeBox(THREE, 1.5, 1.5, 1.5, 0xf59e0b, 0.3, 0.5);
    box.position.y = -0.75;
    box.castShadow = true;
    scene.add(box);

    // Force arrows
    const pushArr   = _makeArrow(THREE, new THREE.Vector3(0.75,-0.75,0), new THREE.Vector3(3.0,-0.75,0), 0x4ade80, 0.32);
    const fricArr   = _makeArrow(THREE, new THREE.Vector3(-0.75,-0.75,0), new THREE.Vector3(-3.0,-0.75,0), 0xf87171, 0.32);
    const normalArr = _makeArrow(THREE, new THREE.Vector3(0,-0.0,0), new THREE.Vector3(0,2.5,0), 0x60a5fa, 0.28);
    const weightArr = _makeArrow(THREE, new THREE.Vector3(0,-0.75,0), new THREE.Vector3(0,-2.8,0), 0xa78bfa, 0.28);
    scene.add(pushArr, fricArr, normalArr, weightArr);

    s.objects = { box, pushArr, fricArr, normalArr, weightArr };
    _addLabel(s, '→ F_applied', 56, 36, '#4ade80');
    _addLabel(s, '← f = μN', 2, 36, '#f87171');
    _addLabel(s, 'N↑', 46, 12, '#60a5fa', 'rgba(0,0,0,0)');
    _addLabel(s, 'W↓', 46, 72, '#a78bfa', 'rgba(0,0,0,0)');

    s._updateFn = (st) => {
      const x = -5.5 + (st.t * 1.0) % 10;
      st.objects.box.position.x = x;
      st.objects.pushArr.position.x  = x;
      st.objects.fricArr.position.x  = x;
      st.objects.normalArr.position.x = x;
      st.objects.weightArr.position.x = x;
      st.objects.box.rotation.y = st.t * 0.25;
    };
  }

  function _scene_momentum(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 3.5, 13);
    _makeGround(THREE, scene);
    _makeGridHelper(THREE, scene);

    const b1 = _makeSphere(THREE, 0.75, 0x3b82f6, 0.5);
    b1.castShadow = true;
    scene.add(b1);

    const b2 = _makeSphere(THREE, 0.48, 0xef4444, 0.5);
    b2.castShadow = true;
    scene.add(b2);

    const arr1 = _makeArrow(THREE, new THREE.Vector3(0,0,0), new THREE.Vector3(1.8,0,0), 0x60a5fa, 0.28);
    const arr2 = _makeArrow(THREE, new THREE.Vector3(0,0,0), new THREE.Vector3(2.2,0,0), 0xfca5a5, 0.28);
    scene.add(arr1, arr2);

    const flash = _makeSphere(THREE, 1.0, 0xfbbf24);
    (flash.material).transparent = true;
    flash.material.opacity = 0;
    scene.add(flash);

    s.objects = { b1, b2, arr1, arr2, flash };
    _addLabel(s, 'p₁ = m×v (heavier ball)', 5, 8, '#60a5fa');
    _addLabel(s, 'Collision! Momentum conserved', 28, 78, '#fbbf24');

    s._updateFn = (st) => {
      const period = 3.8, phase = (st.t % period) / period;
      if (phase < 0.42) {
        const p = phase / 0.42;
        st.objects.b1.position.set(-5.5 + p * 4.8, -0.75, 0);
        st.objects.b2.position.set(3.8, -0.75, 0);
        st.objects.arr1.position.set(-5.5 + p * 4.8 + 0.75, -0.75, 0);
        st.objects.flash.material.opacity = 0;
        st.objects.arr2.position.set(10, -10, 0);
      } else if (phase < 0.52) {
        const pp = (phase - 0.42) / 0.10;
        st.objects.b1.position.set(-0.78, -0.75, 0);
        st.objects.b2.position.set(0.55, -0.75, 0);
        st.objects.flash.position.set(-0.1, -0.75, 0);
        st.objects.flash.material.opacity = Math.max(0, 1 - pp * 10);
        st.objects.arr1.position.set(20, 0, 0);
      } else {
        const pp = (phase - 0.52) / 0.48;
        st.objects.b1.position.set(-0.78 + pp * 0.8, -0.75, 0);
        st.objects.b2.position.set(0.55 + pp * 5.0, -0.75, 0);
        st.objects.arr2.position.set(0.55 + pp * 5.0 + 0.48, -0.75, 0);
        st.objects.flash.material.opacity = 0;
      }
    };
  }

  function _scene_transverse(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 4.5, 13);
    scene.background = new THREE.Color(0x080820);

    const nPts = 100;
    const wavePos = new Float32Array(nPts * 3);
    const waveGeo = new THREE.BufferGeometry();
    waveGeo.setAttribute('position', new THREE.BufferAttribute(wavePos, 3));
    const waveLine = new THREE.Line(waveGeo,
      new THREE.LineBasicMaterial({ color: _hex(s.color) || 0x06b6d4, linewidth: 3 })
    );
    scene.add(waveLine);

    // Particles on wave
    const pCount = 18;
    const pGeo   = new THREE.BufferGeometry();
    const pPos   = new Float32Array(pCount * 3);
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    scene.add(new THREE.Points(pGeo,
      new THREE.PointsMaterial({ color: _hex(s.color) || 0x06b6d4, size: 0.3 })
    ));

    // Axis
    const axisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-6.5, 0, 0), new THREE.Vector3(6.5, 0, 0)
    ]);
    scene.add(new THREE.Line(axisGeo,
      new THREE.LineDashedMaterial({ color: 0x475569, dashSize: 0.3, gapSize: 0.2 })
    ));

    // Direction arrow
    scene.add(_makeArrow(THREE, new THREE.Vector3(-6.5,-2.2,0), new THREE.Vector3(6.5,-2.2,0), 0x4ade80, 0.4));

    // Amplitude marker
    scene.add(_makeArrow(THREE, new THREE.Vector3(7.0, 0, 0), new THREE.Vector3(7.0, 1.8, 0), 0xfbbf24, 0.28));

    s.objects = { waveGeo, pGeo };
    _addLabel(s, '→ Wave direction (energy travels)', 15, 76, '#4ade80');
    _addLabel(s, '↕ Particles oscillate perpendicular', 15, 8, s.color);
    _addLabel(s, 'A', 88, 28, '#fbbf24', 'rgba(0,0,0,0)');

    s._updateFn = (st) => {
      const posArr = st.objects.waveGeo.attributes.position.array;
      for (let i = 0; i < nPts; i++) {
        const x = -6.5 + (i / (nPts - 1)) * 13;
        posArr[i*3]   = x;
        posArr[i*3+1] = 1.8 * Math.sin(x * 1.1 - st.t * 3.2);
        posArr[i*3+2] = 0;
      }
      st.objects.waveGeo.attributes.position.needsUpdate = true;

      const pArr = st.objects.pGeo.attributes.position.array;
      for (let i = 0; i < pCount; i++) {
        const x = -6.5 + (i / pCount) * 13;
        pArr[i*3]   = x;
        pArr[i*3+1] = 1.8 * Math.sin(x * 1.1 - st.t * 3.2);
        pArr[i*3+2] = 0;
      }
      st.objects.pGeo.attributes.position.needsUpdate = true;
    };
  }

  function _scene_longitudinal(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 3, 13);
    scene.background = new THREE.Color(0x080820);

    const nP = 32;
    const spheres = [];
    for (let i = 0; i < nP; i++) {
      const geo = new THREE.SphereGeometry(0.2, 16, 16);
      const mat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, metalness: 0.3, roughness: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      const x0 = -6 + (i / nP) * 12;
      mesh.position.set(x0, 0, 0);
      mesh.castShadow = true;
      scene.add(mesh);
      spheres.push({ mesh, x0 });
    }
    s.objects.spheres = spheres;

    scene.add(_makeArrow(THREE, new THREE.Vector3(-6,-2.5,0), new THREE.Vector3(6,-2.5,0), 0x4ade80, 0.4));

    _addLabel(s, '→ Wave + particle motion: SAME direction', 5, 8, '#4ade80');
    _addLabel(s, '● Compression (dense)', 5, 80, '#ef4444');
    _addLabel(s, '○ Rarefaction (sparse)', 55, 80, '#60a5fa');

    s._updateFn = (st) => {
      st.objects.spheres.forEach(({ mesh, x0 }) => {
        const d = 0.72 * Math.sin((x0 * 1.15) - st.t * 3.0);
        mesh.position.x = x0 + d;
        const density = 1 - Math.abs(d) / 0.8;
        mesh.material.color.setHex(density > 0.5 ? 0xef4444 : 0x60a5fa);
        const sc = 0.75 + density * 0.5;
        mesh.scale.setScalar(sc);
      });
    };
  }

  function _scene_em_spectrum(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 6, 12);
    camera.lookAt(0, 0, -1);
    scene.background = new THREE.Color(0x02020f);

    const bands = [
      { label:'Radio',     color: 0x6366f1, freq: 0.28 },
      { label:'Microwave', color: 0x8b5cf6, freq: 0.55 },
      { label:'Infrared',  color: 0xf97316, freq: 0.95 },
      { label:'Visible',   color: 0x22c55e, freq: 1.5  },
      { label:'UV',        color: 0xa855f7, freq: 2.2  },
      { label:'X-ray',     color: 0x3b82f6, freq: 3.5  },
      { label:'Gamma',     color: 0xef4444, freq: 6.0  },
    ];

    const waveDatas = [];
    bands.forEach((b, i) => {
      const z = -3.8 + i * 1.15;
      const pts = [];
      for (let j = 0; j < 60; j++) pts.push(new THREE.Vector3(-5.5 + j * (11/60), 0, z));
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: b.color }));
      scene.add(line);
      waveDatas.push({ geo, freq: b.freq, z });

      const hexStr = '#' + b.color.toString(16).padStart(6,'0');
      _addLabel(s, b.label, 2 + i * 13.5, 8, hexStr, 'rgba(0,0,0,0.65)');
    });
    s.objects.waveDatas = waveDatas;

    _addLabel(s, 'All EM waves: c = 3×10⁸ m/s in vacuum', 10, 88, '#ffffff', 'rgba(0,0,0,0.55)');

    s._updateFn = (st) => {
      st.objects.waveDatas.forEach(({ geo, freq }) => {
        const arr = geo.attributes.position.array;
        for (let j = 0; j < 60; j++) {
          arr[j*3+1] = 0.42 * Math.sin(arr[j*3] * freq * 0.9 - st.t * 3.5);
        }
        geo.attributes.position.needsUpdate = true;
      });
    };
  }

  function _scene_reflection(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 5, 14);
    scene.background = new THREE.Color(0x080818);

    // Interface plane
    const iface = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 7),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
    );
    iface.rotation.x = -Math.PI / 2;
    scene.add(iface);
    scene.add(new THREE.GridHelper(16, 16, 0x0ea5e9, 0x0ea5e944));

    // Normal line
    const normGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0,-3.5,0), new THREE.Vector3(0,3.5,0)
    ]);
    const normLine = new THREE.Line(normGeo, new THREE.LineDashedMaterial({ color:0x94a3b8, dashSize:0.25, gapSize:0.15 }));
    normLine.computeLineDistances();
    scene.add(normLine);

    const ang = 35 * Math.PI / 180;
    scene.add(_makeArrow(THREE, new THREE.Vector3(-3*Math.sin(ang), 3*Math.cos(ang), 0), new THREE.Vector3(0,0,0), 0xf97316, 0.32));
    scene.add(_makeArrow(THREE, new THREE.Vector3(0,0,0), new THREE.Vector3(3*Math.sin(ang), 3*Math.cos(ang),0), 0x4ade80, 0.32));

    const refAng = 22 * Math.PI / 180;
    scene.add(_makeArrow(THREE, new THREE.Vector3(0,0,0), new THREE.Vector3(3*Math.sin(refAng),-3*Math.cos(refAng),0), 0xa855f7, 0.32));

    // Moving photon
    const photon = _makeSphere(THREE, 0.16, 0xfbbf24);
    scene.add(photon);
    s.objects.photon = photon;

    _addLabel(s, '→ Incident (35°)', 2, 8, '#f97316');
    _addLabel(s, '↗ Reflected (35°)', 60, 8, '#4ade80');
    _addLabel(s, '↘ Refracted (22°)', 60, 60, '#a855f7');
    _addLabel(s, 'Medium 1 (n₁)', 2, 30, '#94a3b8', 'rgba(0,0,0,0)');
    _addLabel(s, 'Medium 2 (n₂ > n₁)', 2, 60, '#0ea5e9', 'rgba(0,0,0,0)');

    s._updateFn = (st) => {
      const period = 2.8, phase = (st.t % period) / period;
      const from = new THREE.Vector3(-3*Math.sin(ang), 3*Math.cos(ang), 0);
      const mid  = new THREE.Vector3(0, 0, 0);
      const to   = new THREE.Vector3(3*Math.sin(refAng), -3*Math.cos(refAng), 0);
      if (phase < 0.5) st.objects.photon.position.lerpVectors(from, mid, phase * 2);
      else             st.objects.photon.position.lerpVectors(mid, to, (phase-0.5)*2);
    };
  }

  function _scene_ohms_law(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 4, 13);
    scene.background = new THREE.Color(0x080818);

    const wireMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
    const mkTube = (p1, p2) => {
      const curve = new THREE.LineCurve3(p1, p2);
      return new THREE.Mesh(new THREE.TubeGeometry(curve, 4, 0.09, 8, false), wireMat);
    };
    const W = 5.2, H2 = 2.6;
    scene.add(mkTube(new THREE.Vector3(-W,H2,0),  new THREE.Vector3(W,H2,0)));
    scene.add(mkTube(new THREE.Vector3(W,H2,0),   new THREE.Vector3(W,-H2,0)));
    scene.add(mkTube(new THREE.Vector3(W,-H2,0),  new THREE.Vector3(-W,-H2,0)));
    scene.add(mkTube(new THREE.Vector3(-W,-H2,0), new THREE.Vector3(-W,H2,0)));

    // Battery
    const bat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 1.5, 20),
      new THREE.MeshStandardMaterial({ color:0x22c55e, metalness:0.6 })
    );
    bat.position.set(-W, 0, 0);
    bat.rotation.z = Math.PI/2;
    scene.add(bat);

    // Resistor
    const res = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.55, 0.55),
      new THREE.MeshStandardMaterial({ color:0xf97316, roughness:0.6 })
    );
    res.position.set(0, H2, 0);
    scene.add(res);

    // Flowing electrons
    const nE = 14;
    const electrons = [];
    for (let i = 0; i < nE; i++) {
      const eg = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 8),
        new THREE.MeshStandardMaterial({ color:0xfbbf24, emissive:0xfbbf24, emissiveIntensity:0.7 })
      );
      scene.add(eg);
      electrons.push({ mesh: eg, offset: i / nE });
    }
    s.objects.electrons = electrons;

    _addLabel(s, '12V', 2, 36, '#4ade80');
    _addLabel(s, 'R = 4Ω', 42, 6, '#fb923c');
    _addLabel(s, '● Electrons (I = 3A)', 25, 88, '#fbbf24');
    _addLabel(s, 'V=IR: 12=3×4', 58, 55, '#ffffff', 'rgba(0,0,0,0.5)');

    s._updateFn = (st) => {
      const perim = (W*2*2 + H2*2*2);
      st.objects.electrons.forEach(({ mesh, offset }) => {
        const pos = (st.t * 1.9 + offset * perim) % perim;
        const seg1 = W*2, seg2 = seg1+H2*2, seg3 = seg2+W*2;
        if (pos < seg1)      mesh.position.set(-W + pos, H2, 0);
        else if (pos < seg2) mesh.position.set(W, H2-(pos-seg1), 0);
        else if (pos < seg3) mesh.position.set(W-(pos-seg2), -H2, 0);
        else                 mesh.position.set(-W, -H2+(pos-seg3), 0);
      });
    };
  }

  function _scene_series_parallel(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 6.5, 18);
    scene.background = new THREE.Color(0x080818);

    const wireMat = new THREE.MeshStandardMaterial({ color:0x64748b, metalness:0.5 });
    const mkTube  = (p1, p2, mat) => {
      const curve = new THREE.LineCurve3(p1, p2);
      return new THREE.Mesh(new THREE.TubeGeometry(curve, 4, 0.09, 8, false), mat || wireMat);
    };

    // SERIES (left)
    const sx = -4.5;
    scene.add(mkTube(new THREE.Vector3(sx-2,2,0), new THREE.Vector3(sx+2,2,0)));
    scene.add(mkTube(new THREE.Vector3(sx+2,2,0), new THREE.Vector3(sx+2,-2,0)));
    scene.add(mkTube(new THREE.Vector3(sx+2,-2,0),new THREE.Vector3(sx-2,-2,0)));
    scene.add(mkTube(new THREE.Vector3(sx-2,-2,0),new THREE.Vector3(sx-2,2,0)));
    const r1s = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.38,0.38), new THREE.MeshStandardMaterial({color:0xf97316}));
    r1s.position.set(sx-0.4, 2, 0); scene.add(r1s);
    const r2s = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.38,0.38), new THREE.MeshStandardMaterial({color:0xef4444}));
    r2s.position.set(sx+0.9, 2, 0); scene.add(r2s);
    const batS = new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,0.95,16),new THREE.MeshStandardMaterial({color:0x22c55e,metalness:0.5}));
    batS.position.set(sx-2,0,0); batS.rotation.z=Math.PI/2; scene.add(batS);

    // PARALLEL (right)
    const px = 4.5;
    scene.add(mkTube(new THREE.Vector3(px-2,3,0), new THREE.Vector3(px+2,3,0)));
    scene.add(mkTube(new THREE.Vector3(px+2,3,0), new THREE.Vector3(px+2,-3,0)));
    scene.add(mkTube(new THREE.Vector3(px+2,-3,0),new THREE.Vector3(px-2,-3,0)));
    scene.add(mkTube(new THREE.Vector3(px-2,-3,0),new THREE.Vector3(px-2,3,0)));
    scene.add(mkTube(new THREE.Vector3(px-2,1,0), new THREE.Vector3(px+2,1,0)));
    scene.add(mkTube(new THREE.Vector3(px-2,-1,0),new THREE.Vector3(px+2,-1,0)));
    const r1p = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.38,0.38),new THREE.MeshStandardMaterial({color:0xf97316}));
    r1p.position.set(px,2,0); scene.add(r1p);
    const r2p = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.38,0.38),new THREE.MeshStandardMaterial({color:0xef4444}));
    r2p.position.set(px,0,0); scene.add(r2p);
    const batP = new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,0.95,16),new THREE.MeshStandardMaterial({color:0x22c55e,metalness:0.5}));
    batP.position.set(px-2,0,0); batP.rotation.z=Math.PI/2; scene.add(batP);

    const sE = [], pE = [];
    for (let i=0;i<8;i++){
      const e=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,8),new THREE.MeshStandardMaterial({color:0x3b82f6,emissive:0x3b82f6,emissiveIntensity:0.6}));
      scene.add(e); sE.push({mesh:e,offset:i/8});
    }
    for (let i=0;i<8;i++){
      const e=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,8),new THREE.MeshStandardMaterial({color:0xef4444,emissive:0xef4444,emissiveIntensity:0.5}));
      scene.add(e); pE.push({mesh:e,offset:i/8,branch:i%2});
    }
    s.objects = { sE, pE };

    _addLabel(s, 'SERIES — one path', 2, 6, '#60a5fa');
    _addLabel(s, 'PARALLEL — split paths', 54, 6, '#f87171');
    _addLabel(s, 'R_T = R₁+R₂', 5, 88, '#f97316');
    _addLabel(s, '1/R_T = 1/R₁+1/R₂', 56, 88, '#4ade80');

    s._updateFn = (st) => {
      const sPerim = 16;
      st.objects.sE.forEach(({mesh,offset})=>{
        const pos=(st.t*1.5+offset*sPerim)%sPerim;
        if(pos<4)      mesh.position.set(sx-2+pos,2,0);
        else if(pos<8) mesh.position.set(sx+2,2-(pos-4),0);
        else if(pos<12)mesh.position.set(sx+2-(pos-8),-2,0);
        else           mesh.position.set(sx-2,-2+(pos-12),0);
      });
      const pPerim=10;
      st.objects.pE.forEach(({mesh,offset,branch})=>{
        const pos=(st.t*1.1+offset*pPerim)%pPerim;
        const y=branch===0?2:0;
        if(pos<4)      mesh.position.set(px-2+pos,y,0);
        else if(pos<7) mesh.position.set(px+2,y-(pos-4)*0.67,0);
        else           mesh.position.set(px+2-(pos-7)*1.33,-2+branch,0);
      });
    };
  }

  function _scene_electric_field(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 2.5, 13);
    scene.background = new THREE.Color(0x02020f);

    const pos = _makeSphere(THREE, 0.75, 0xef4444, 0.7);
    pos.position.set(-3.8, 0, 0);
    scene.add(pos);
    const neg = _makeSphere(THREE, 0.75, 0x3b82f6, 0.7);
    neg.position.set(3.8, 0, 0);
    scene.add(neg);

    scene.add(new THREE.PointLight(0xef4444, 1.5, 8, 2));
    const pl = new THREE.PointLight(0x3b82f6, 1.5, 8, 2);
    pl.position.set(3.8, 0, 0);
    scene.add(pl);

    const fieldLines = [];
    const nLines = 10;
    for (let i = 0; i < nLines; i++) {
      const angle = (i / nLines) * Math.PI * 2;
      const pts = [];
      for (let t = 0; t <= 1; t += 0.025) {
        const fx = -3.8 + 0.82 * Math.cos(angle);
        const fy = 0.82 * Math.sin(angle);
        const tx = 3.8 + 0.82 * Math.cos(angle + Math.PI);
        const ty = 0.82 * Math.sin(angle + Math.PI);
        const cx = 0, cy = Math.sin(angle) * 2.8;
        const bx = (1-t)*(1-t)*fx + 2*(1-t)*t*cx + t*t*tx;
        const by = (1-t)*(1-t)*fy + 2*(1-t)*t*cy + t*t*ty;
        pts.push(new THREE.Vector3(bx, by, 0));
      }
      const geo  = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color:0xfbbf24, transparent:true, opacity:0.4 }));
      scene.add(line);
      const dot = _makeSphere(THREE, 0.11, 0xfbbf24);
      scene.add(dot);
      fieldLines.push({ pts, dot, offset: i / nLines });
    }
    s.objects = { pos, neg, fieldLines };

    _addLabel(s, '+', 18, 38, '#f87171', 'rgba(0,0,0,0)');
    _addLabel(s, '−', 76, 38, '#60a5fa', 'rgba(0,0,0,0)');
    _addLabel(s, 'Field lines: + → −   F = kQ₁Q₂/r²', 15, 88, '#fbbf24', 'rgba(0,0,0,0.55)');

    s._updateFn = (st) => {
      const pulse = 1 + Math.sin(st.t * 3) * 0.05;
      st.objects.pos.scale.setScalar(pulse);
      st.objects.neg.scale.setScalar(pulse);
      st.objects.fieldLines.forEach(({ pts, dot, offset }) => {
        const idx = Math.floor(((st.t * 0.38 + offset) % 1) * (pts.length-1));
        dot.position.copy(pts[idx]);
      });
    };
  }

  function _scene_ke_pe(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 4.5, 15);
    scene.background = new THREE.Color(0x060818);

    const nPts = 80;
    const trackPts = [];
    for (let i = 0; i < nPts; i++) {
      const t = i / (nPts - 1);
      const x = -6.5 + t * 13;
      const y = -1.5 + Math.pow(Math.cos(t * Math.PI), 2) * 4.8;
      trackPts.push(new THREE.Vector3(x, y, 0));
    }
    const trackCurve = new THREE.CatmullRomCurve3(trackPts);
    scene.add(new THREE.Mesh(
      new THREE.TubeGeometry(trackCurve, 100, 0.09, 8, false),
      new THREE.MeshStandardMaterial({ color:0x64748b, metalness:0.8 })
    ));

    const cart = _makeBox(THREE, 0.95, 0.55, 0.65, 0x6366f1, 0.6, 0.3);
    cart.castShadow = true;
    scene.add(cart);

    // KE / PE bars
    const keBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 1, 0.35),
      new THREE.MeshStandardMaterial({ color:0xf97316, emissive:0xf97316, emissiveIntensity:0.3 })
    );
    keBar.position.set(5.2, -0.5, 0);
    scene.add(keBar);

    const peBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 1, 0.35),
      new THREE.MeshStandardMaterial({ color:0x22c55e, emissive:0x22c55e, emissiveIntensity:0.3 })
    );
    peBar.position.set(5.9, -0.5, 0);
    scene.add(peBar);

    const glow = new THREE.PointLight(0x6366f1, 1.0, 10);
    scene.add(glow);

    s.objects = { cart, keBar, peBar, glow, trackCurve };
    _addLabel(s, '🟠 KE  🟢 GPE  (sum = constant)', 58, 8, '#ffffff', 'rgba(0,0,0,0.5)');
    _addLabel(s, 'KE = ½mv²   GPE = mgh', 5, 88, '#ffffff', 'rgba(0,0,0,0.45)');

    s._updateFn = (st) => {
      const frac = (Math.sin(st.t * 0.75) + 1) / 2;
      const pt   = st.objects.trackCurve.getPoint(frac);
      const tang = st.objects.trackCurve.getTangent(frac);
      st.objects.cart.position.copy(pt);
      st.objects.cart.rotation.z = Math.atan2(tang.y, tang.x);

      const normY = (pt.y + 1.5) / 4.8;
      const ke = Math.max(0.05, 1 - normY);
      const pe = Math.max(0.05, normY);
      st.objects.keBar.scale.y = ke * 3;
      st.objects.keBar.position.y = -1.5 + ke * 3 * 0.5;
      st.objects.peBar.scale.y = pe * 3;
      st.objects.peBar.position.y = -1.5 + pe * 3 * 0.5;
      st.objects.keBar.material.emissiveIntensity = ke * 0.7;
      st.objects.peBar.material.emissiveIntensity = pe * 0.7;
      st.objects.glow.position.copy(pt);
    };
  }

  function _scene_work_power(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 4.5, 15);
    scene.background = new THREE.Color(0x060818);
    _makeGround(THREE, scene, 0x1e293b);
    _makeGridHelper(THREE, scene);

    const box = _makeBox(THREE, 1.3, 1.3, 1.3, 0xf59e0b, 0.3, 0.5);
    box.castShadow = true;
    scene.add(box);

    const pushArr = _makeArrow(THREE, new THREE.Vector3(0.65,-0.9,0), new THREE.Vector3(2.5,-0.9,0), 0x4ade80, 0.32);
    scene.add(pushArr);

    // Trail
    const trailGeo = new THREE.BufferGeometry();
    const trailPos = new Float32Array(60 * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color:0x3b82f6, transparent:true, opacity:0.5 }));
    scene.add(trail);

    const glow = new THREE.PointLight(0xf97316, 0.9, 6);
    scene.add(glow);

    s.objects = { box, pushArr, trail, trailGeo, glow, history: [] };
    _addLabel(s, '→ F = 50N', 58, 36, '#4ade80');
    _addLabel(s, 'W = F×s   P = W/t', 10, 88, '#ffffff', 'rgba(0,0,0,0.45)');

    s._updateFn = (st) => {
      const x = -6 + (st.t * 1.25) % 10;
      st.objects.box.position.set(x, -0.85, 0);
      st.objects.box.rotation.y = st.t * 0.2;
      st.objects.pushArr.position.set(x, -0.85, 0);
      st.objects.glow.position.set(x, -0.85, 0);

      st.objects.history.push(new THREE.Vector3(x, -0.85, 0));
      if (st.objects.history.length > 60) st.objects.history.shift();
      const arr = st.objects.trailGeo.attributes.position.array;
      st.objects.history.forEach((p, i) => { arr[i*3]=p.x; arr[i*3+1]=p.y; arr[i*3+2]=p.z; });
      st.objects.trailGeo.attributes.position.needsUpdate = true;
      st.objects.trailGeo.setDrawRange(0, st.objects.history.length);
    };
  }

  function _scene_energy_transfer(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 4.5, 15);
    scene.background = new THREE.Color(0x060818);

    const inBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 3.2, 0.55),
      new THREE.MeshStandardMaterial({ color:0xfbbf24, emissive:0xfbbf24, emissiveIntensity:0.35 })
    );
    inBar.position.set(-5.5, 0, 0);
    scene.add(inBar);

    const device = _makeBox(THREE, 2.0, 2.7, 1.1, 0x334155, 0.3, 0.7);
    scene.add(device);

    const usBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 2.2, 0.55),
      new THREE.MeshStandardMaterial({ color:0x22c55e, emissive:0x22c55e, emissiveIntensity:0.35 })
    );
    usBar.position.set(5.0, 0.5, 0);
    scene.add(usBar);

    const waBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 1.0, 0.55),
      new THREE.MeshStandardMaterial({ color:0xef4444, emissive:0xef4444, emissiveIntensity:0.4 })
    );
    waBar.position.set(5.0, -1.7, 0);
    scene.add(waBar);

    // Connector lines
    const mkLine = (p1, p2, col) => {
      const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      scene.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col })));
    };
    mkLine(new THREE.Vector3(-5.1,0,0), new THREE.Vector3(-1,0,0), 0xfbbf24);
    mkLine(new THREE.Vector3(1,0.5,0),  new THREE.Vector3(4.6,0.5,0), 0x22c55e);
    mkLine(new THREE.Vector3(1,-1.7,0), new THREE.Vector3(4.7,-1.7,0), 0xef4444);

    const devGlow = new THREE.PointLight(0xfbbf24, 1.2, 7);
    scene.add(devGlow);

    // Energy particles
    const particles = [];
    for (let i = 0; i < 18; i++) {
      const isUseful = i < 12;
      const e = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 8),
        new THREE.MeshStandardMaterial({
          color: isUseful ? 0x22c55e : 0xef4444,
          emissive: isUseful ? 0x22c55e : 0xef4444,
          emissiveIntensity: 0.6
        })
      );
      scene.add(e);
      particles.push({ mesh: e, offset: i / 18, type: isUseful ? 'useful' : 'wasted' });
    }

    s.objects = { inBar, usBar, waBar, devGlow, particles };
    _addLabel(s, '100J Input', 2, 24, '#fbbf24');
    _addLabel(s, '70J Useful', 66, 18, '#4ade80');
    _addLabel(s, '30J Wasted (heat)', 66, 62, '#f87171');
    _addLabel(s, 'Efficiency = 70%  |  Energy conserved', 8, 88, '#ffffff', 'rgba(0,0,0,0.5)');

    s._updateFn = (st) => {
      st.objects.inBar.scale.x = 1 + Math.sin(st.t * 2) * 0.03;
      st.objects.devGlow.intensity = 0.9 + Math.sin(st.t * 4) * 0.35;

      st.objects.particles.forEach(({ mesh, offset, type }) => {
        const pos = (st.t * 1.1 + offset * 10) % 10;
        if (pos < 4.5) {
          mesh.position.set(-5.1 + pos * 0.91, 0, 0);
        } else if (type === 'useful') {
          mesh.position.set(1 + (pos - 4.5) * 0.73, 0.5, 0);
        } else {
          mesh.position.set(1 + (pos - 4.5) * 0.65, -1.7, 0);
        }
      });
    };
  }

  /* ══════════════════════════════════════════════════
     QUIZ
  ══════════════════════════════════════════════════ */

  function _buildQuizView() {
    if (_quizDone) return _buildQuizResults();
    const q    = _shuffledQuiz[_quizIdx];
    const opts = _shuffle([...q.options]);
    const prog = _quizIdx / _shuffledQuiz.length * 100;
    return `
      <div style="height:100%;overflow-y:auto;padding:.875rem;">
        <div style="max-width:560px;margin:0 auto;">
          <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem;">
            <div style="flex:1;height:6px;border-radius:99px;background:var(--border);overflow:hidden;">
              <div style="width:${prog}%;height:100%;background:var(--accent);border-radius:99px;transition:width .3s;"></div>
            </div>
            <span style="font-size:.6rem;font-weight:700;color:var(--text-3);white-space:nowrap;flex-shrink:0;">Q${_quizIdx+1}/${_shuffledQuiz.length} · Score: ${_quizScore}</span>
          </div>
          <div style="background:var(--bg-base);border:2px solid var(--accent-border);border-radius:var(--r-xl);padding:1rem 1.25rem;margin-bottom:.875rem;">
            <div style="font-size:.6rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--accent);margin-bottom:.5rem;">⚛️ Physics Q${_quizIdx+1}</div>
            <p style="font-size:var(--text-md);font-weight:600;color:var(--text-1);line-height:1.5;margin:0;">${q.q}</p>
          </div>
          <div>
            ${opts.map(opt => {
              let cls = '';
              if (_quizAnswered) {
                if (opt === q.a) cls = 'correct';
                else if (opt === _quizSelected && opt !== q.a) cls = 'wrong';
              }
              return `<button class="phys-quiz-opt ${cls}" ${_quizAnswered?'disabled':''} onclick="ThreeDPhysics._answerQuiz(${JSON.stringify(opt)})">${opt}</button>`;
            }).join('')}
          </div>
          ${_quizAnswered ? `
            <div style="margin-top:.75rem;padding:.75rem 1rem;border-radius:var(--r-xl);background:${_quizSelected===q.a?'var(--success-subtle)':'var(--danger-subtle)'};border:1px solid ${_quizSelected===q.a?'var(--success-border)':'var(--danger-border)'};">
              <div style="font-size:.6rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${_quizSelected===q.a?'var(--success)':'var(--danger)'};margin-bottom:.35rem;">${_quizSelected===q.a?'✓ Correct!':'✗ Not quite — Correct: '+q.a}</div>
              <p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.6;margin:0 0 .5rem;">${q.explain}</p>
              <button class="phys-step-btn primary" onclick="ThreeDPhysics._nextQuestion()" style="font-size:.6rem;padding:.3rem .875rem;">${_quizIdx<_shuffledQuiz.length-1?'Next Question →':'See Results'}</button>
            </div>` : ''}
        </div>
      </div>`;
  }

  function _buildQuizResults() {
    const total = _shuffledQuiz.length;
    const pct   = Math.round(_quizScore / total * 100);
    const grade = pct >= 80 ? 'Excellent! 🏆' : pct >= 60 ? 'Good job! 👍' : pct >= 40 ? 'Keep revising 📚' : 'More practice needed 🔬';
    const clr   = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--accent)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';
    return `
      <div style="height:100%;overflow-y:auto;padding:1.5rem .875rem;">
        <div style="max-width:480px;margin:0 auto;text-align:center;">
          <div style="font-size:3.5rem;line-height:1;margin-bottom:.5rem;">⚛️</div>
          <h2 style="font-size:var(--text-xl);font-weight:800;color:${clr};margin-bottom:.25rem;">${pct}% — ${grade}</h2>
          <p style="font-size:var(--text-sm);color:var(--text-3);margin-bottom:1.5rem;">You scored <strong>${_quizScore}</strong> out of <strong>${total}</strong>.</p>
          <div style="background:var(--bg-base);border:1px solid var(--border);border-radius:var(--r-xl);padding:1rem;margin-bottom:1rem;text-align:left;">
            <div style="font-size:.575rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--text-4);margin-bottom:.5rem;">Key formulae to review:</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem;">
              ${['F = ma','p = mv','v = fλ','V = IR','KE = ½mv²','GPE = mgh','W = Fs','P = W/t'].map(f=>`<div style="font-family:monospace;font-size:.75rem;font-weight:700;background:var(--bg-subtle);border:1px solid var(--border);border-radius:var(--r-sm);padding:.25rem .5rem;color:var(--accent);">${f}</div>`).join('')}
            </div>
          </div>
          <div style="display:flex;gap:.625rem;justify-content:center;flex-wrap:wrap;">
            <button class="phys-step-btn primary" onclick="ThreeDPhysics._restartQuiz()" style="padding:.5rem 1.25rem;">↺ Retake Quiz</button>
            <button class="phys-step-btn" onclick="ThreeDPhysics._setTab('forces')" style="padding:.5rem 1.25rem;">📖 Study Topics</button>
          </div>
        </div>
      </div>`;
  }

  function _setTab(tab) {
    _destroyThree();
    _activeTab    = tab;
    _activeSubIdx = 0;
    _reRenderContent();
    _updateTabBar();
    if (tab !== 'quiz') requestAnimationFrame(_launchScene);
  }

  function _setSub(idx) {
    _destroyThree();
    _activeSubIdx = idx;
    _reRenderContent();
    requestAnimationFrame(_launchScene);
  }

  function _nextSub() {
    const group = TOPICS[_activeTab];
    if (!group) return;
    if (_activeSubIdx < group.subtopics.length - 1) _setSub(_activeSubIdx + 1);
  }

  function _prevSub() {
    if (_activeSubIdx > 0) _setSub(_activeSubIdx - 1);
  }

  function _reRenderContent() {
    const el = document.getElementById('phys-content');
    if (el) el.innerHTML = _buildContent();
  }

  function _updateTabBar() {
    document.querySelectorAll('.phys-tab').forEach(btn => {
      const match = btn.getAttribute('onclick').match(/'([^']+)'/);
      if (match) btn.classList.toggle('active', match[1] === _activeTab);
    });
  }

  function _answerQuiz(selected) {
    if (_quizAnswered) return;
    _quizAnswered = true;
    _quizSelected = selected;
    if (selected === _shuffledQuiz[_quizIdx].a) _quizScore++;
    _reRenderContent();
  }

  function _nextQuestion() {
    _quizIdx++;
    _quizAnswered = false;
    _quizSelected = null;
    if (_quizIdx >= _shuffledQuiz.length) _quizDone = true;
    _reRenderContent();
  }

  function _restartQuiz() {
    _quizIdx      = 0;
    _quizScore    = 0;
    _quizAnswered = false;
    _quizSelected = null;
    _quizDone     = false;
    _shuffledQuiz = _shuffle([...QUIZ_QUESTIONS]);
    _reRenderContent();
  }

  function _back() {
    _destroyThree();
    if (typeof _onBack === 'function') _onBack();
  }

  function _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  window.ThreeDPhysics = {
    open,
    _back,
    _setTab,
    _setSub,
    _nextSub,
    _prevSub,
    _answerQuiz,
    _nextQuestion,
    _restartQuiz,
  };

}());
