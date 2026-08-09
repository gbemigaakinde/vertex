/* ============================================================
   js/threedclass-physics.js — Interactive Physics Module
   ============================================================ */

(function () {
  'use strict';

  const THREEJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

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

  function _loadThreeJS(cb) {
    if (window.THREE) { cb(); return; }
    const s = document.createElement('script');
    s.src = THREEJS_CDN;
    s.onload = cb;
    document.head.appendChild(s);
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
        #phys-3d-canvas{display:block;width:100%!important;height:220px!important;}
        @keyframes phys-slide-in{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
        .phys-scene-label{position:absolute;padding:2px 7px;border-radius:5px;font-size:.6rem;font-weight:700;pointer-events:none;white-space:nowrap;}
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
            <div id="phys-3d-container" style="margin-bottom:.75rem;border-radius:var(--r-xl);background:#0a0a1a;border:1px solid ${sub.color}44;overflow:hidden;position:relative;height:220px;">
              <canvas id="phys-3d-canvas"></canvas>
              <div id="phys-scene-labels" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></div>
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
    cancelAnimationFrame(_three.raf);
    if (_three.renderer) {
      _three.renderer.dispose();
      _three.renderer.forceContextLoss();
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
    const canvas = document.getElementById('phys-3d-canvas');
    const container = document.getElementById('phys-3d-container');
    if (!canvas || !container || !window.THREE) return;

    const THREE = window.THREE;
    const W = container.offsetWidth, H = 220;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDark ? 0x080818 : 0x0d0d2b);
    scene.fog = new THREE.Fog(scene.background, 18, 40);

    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
    camera.position.set(0, 3, 10);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 10, 7);
    dir.castShadow = true;
    scene.add(dir);

    const group = TOPICS[_activeTab];
    const sub   = group ? group.subtopics[_activeSubIdx] : null;
    const state = { t: 0, THREE, scene, camera, renderer, W, H, isDark, color: sub ? sub.color : '#ffffff', objects: {}, labels: [] };

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

    const buildFn = sub ? buildFns[sub.id] : null;
    if (buildFn) buildFn(state);

    function animate() {
      if (!document.getElementById('phys-3d-canvas')) { _destroyThree(); return; }
      state.t += 0.016;
      if (_three && _three.updateFn) _three.updateFn(state);
      if (_three) _three.renderer.render(scene, camera);
      if (_three) _three.raf = requestAnimationFrame(animate);
    }

    _three = { renderer, scene, camera, raf: null, updateFn: null };
    _three.raf = requestAnimationFrame(animate);
  }

  function _hex(color) {
    return parseInt(color.replace('#', ''), 16);
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
    const dir   = new THREE.Vector3().subVectors(to, from).normalize();
    const len   = from.distanceTo(to);
    const arrow = new THREE.ArrowHelper(dir, from, len, color, headSize||0.35, headSize?headSize*0.6:0.2);
    return arrow;
  }

  function _makeBox(THREE, w, h, d, color, metalness, roughness) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color, metalness: metalness||0.3, roughness: roughness||0.6 });
    return new THREE.Mesh(geo, mat);
  }

  function _makeSphere(THREE, r, color, metalness) {
    const geo = new THREE.SphereGeometry(r, 32, 32);
    const mat = new THREE.MeshStandardMaterial({ color, metalness: metalness||0.4, roughness: 0.5 });
    return new THREE.Mesh(geo, mat);
  }

  function _makeGround(THREE, scene, color) {
    const geo = new THREE.PlaneGeometry(20, 20);
    const mat = new THREE.MeshStandardMaterial({ color: color||0x1e293b, roughness: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -1.5;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  function _makeGridHelper(THREE, scene) {
    const grid = new THREE.GridHelper(20, 20, 0x334155, 0x1e293b);
    grid.position.y = -1.49;
    scene.add(grid);
  }

  function _scene_newton1(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 4, 12);
    _makeGround(THREE, scene);
    _makeGridHelper(THREE, scene);

    const boxL = _makeBox(THREE, 1.2, 1.2, 1.2, 0x3b82f6);
    boxL.position.set(-3.5, -0.9, 0);
    boxL.castShadow = true;
    scene.add(boxL);

    const boxR = _makeBox(THREE, 1.2, 1.2, 1.2, 0x22c55e);
    boxR.position.set(-1, -0.9, 0);
    boxR.castShadow = true;
    scene.add(boxR);

    scene.add(_makeArrow(THREE, new THREE.Vector3(-3.5, -0.3, 0), new THREE.Vector3(-3.5, 1.4, 0), 0xef4444, 0.3));
    scene.add(_makeArrow(THREE, new THREE.Vector3(-3.5, -1.5, 0), new THREE.Vector3(-3.5, -3.0, 0), 0xef4444, 0.3));

    const velArrow = _makeArrow(THREE, new THREE.Vector3(-0.4, -0.9, 0), new THREE.Vector3(1.8, -0.9, 0), 0xf97316, 0.35);
    scene.add(velArrow);

    const trailGeo = new THREE.BufferGeometry();
    const trailMat = new THREE.LineBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.5 });
    const trailPts = [];
    for (let i = 0; i < 30; i++) trailPts.push(new THREE.Vector3(-1 - i * 0.12, -0.9, 0));
    trailGeo.setFromPoints(trailPts);
    scene.add(new THREE.Line(trailGeo, trailMat));

    s.objects.boxR = boxR;
    s.objects.velArrow = velArrow;

    _addLabel(s, 'F_net = 0  (At Rest)', 2, 8, '#3b82f6');
    _addLabel(s, 'Constant v  (No net force)', 52, 8, '#22c55e');
    _addLabel(s, 'N ↑', 26, 28, '#ef4444', 'rgba(0,0,0,0)');
    _addLabel(s, 'W ↓', 26, 68, '#ef4444', 'rgba(0,0,0,0)');

    _three.updateFn = (st) => {
      const x = -1 + (st.t * 1.2) % 5.5;
      st.objects.boxR.position.x = x;
    };
  }

  function _scene_newton2(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 4, 13);
    _makeGround(THREE, scene);
    _makeGridHelper(THREE, scene);

    const box1 = _makeBox(THREE, 1.3, 1.3, 1.3, 0x3b82f6);
    box1.castShadow = true;
    scene.add(box1);

    const box2 = _makeBox(THREE, 1.3, 1.3, 1.3, 0xf59e0b);
    box2.castShadow = true;
    scene.add(box2);

    const arr1 = _makeArrow(THREE, new THREE.Vector3(0, 0, 2), new THREE.Vector3(1.5, 0, 2), 0xf97316, 0.3);
    scene.add(arr1);
    const arr2 = _makeArrow(THREE, new THREE.Vector3(0, 0, -2), new THREE.Vector3(2.8, 0, -2), 0xef4444, 0.35);
    scene.add(arr2);

    s.objects.box1 = box1;
    s.objects.box2 = box2;
    s.objects.arr1 = arr1;
    s.objects.arr2 = arr2;

    _addLabel(s, 'F = 10N → a = 5 m/s²', 2, 8, '#f97316');
    _addLabel(s, 'F = 20N → a = 10 m/s²', 2, 80, '#ef4444');

    _three.updateFn = (st) => {
      const x1 = -5 + (st.t * 1.2) % 8;
      const x2 = -5 + (st.t * 2.4) % 8;
      st.objects.box1.position.set(x1, -0.85, 2);
      st.objects.box2.position.set(x2, -0.85, -2);
      st.objects.arr1.position.set(x1, -0.85, 2);
      st.objects.arr2.position.set(x2, -0.85, -2);
    };
  }

  function _scene_newton3(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 2, 10);
    scene.background = new THREE.Color(0x020210);

    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.45, 2, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6366f1, metalness: 0.7, roughness: 0.3 });
    const rocket = new THREE.Mesh(bodyGeo, bodyMat);
    rocket.castShadow = true;
    scene.add(rocket);

    const noseGeo = new THREE.ConeGeometry(0.35, 0.9, 16);
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x818cf8, metalness: 0.6, roughness: 0.3 });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.y = 1.45;
    rocket.add(nose);

    const finGeo = new THREE.BoxGeometry(0.1, 0.7, 0.5);
    const finMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5 });
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(finGeo, finMat);
      fin.position.y = -0.85;
      fin.rotation.y = (i / 4) * Math.PI * 2;
      fin.position.x = Math.sin(fin.rotation.y) * 0.42;
      fin.position.z = Math.cos(fin.rotation.y) * 0.42;
      rocket.add(fin);
    }

    const exhaustPts = [];
    for (let i = 0; i < 60; i++) exhaustPts.push(new THREE.Vector3((Math.random()-0.5)*0.3, -i*0.06, (Math.random()-0.5)*0.3));
    const exhaustGeo = new THREE.BufferGeometry().setFromPoints(exhaustPts);
    const exhaustMat = new THREE.PointsMaterial({ color: 0xfbbf24, size: 0.1, transparent: true, opacity: 0.8 });
    const exhaust = new THREE.Points(exhaustGeo, exhaustMat);
    exhaust.position.y = -1;
    rocket.add(exhaust);

    const actionArr = _makeArrow(THREE, new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, -4, 0), 0xef4444, 0.4);
    scene.add(actionArr);
    const reactionArr = _makeArrow(THREE, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 4.5, 0), 0x22c55e, 0.4);
    scene.add(reactionArr);

    const stars = [];
    for (let i = 0; i < 120; i++) {
      const sg = new THREE.SphereGeometry(0.04, 4, 4);
      const sm = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const star = new THREE.Mesh(sg, sm);
      star.position.set((Math.random()-0.5)*22, (Math.random()-0.5)*12, (Math.random()-0.5)*8 - 4);
      scene.add(star);
      stars.push(star);
    }

    s.objects.rocket = rocket;
    s.objects.exhaust = exhaust;
    s.objects.actionArr = actionArr;
    s.objects.reactionArr = reactionArr;

    _addLabel(s, '← REACTION (gas expelled down)', 52, 72, '#ef4444');
    _addLabel(s, '← ACTION (rocket thrust up)', 52, 18, '#22c55e');

    _three.updateFn = (st) => {
      const bob = Math.sin(st.t * 1.5) * 0.3;
      st.objects.rocket.position.y = bob;
      st.objects.actionArr.position.y = bob - 1;
      st.objects.reactionArr.position.y = bob + 1;
      const positions = st.objects.exhaust.geometry.attributes.position;
      if (positions) {
        for (let i = 0; i < positions.count; i++) {
          let y = positions.getY(i) - 0.05;
          if (y < -3.5) y = 0;
          positions.setY(i, y);
          positions.setX(i, positions.getX(i) + (Math.random()-0.5)*0.02);
        }
        positions.needsUpdate = true;
      }
    };
  }

  function _scene_friction(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 5, 13);
    _makeGround(THREE, scene, 0x374151);
    _makeGridHelper(THREE, scene);

    const surfGeo = new THREE.PlaneGeometry(14, 4);
    const surfMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.95, metalness: 0.0 });
    const surf = new THREE.Mesh(surfGeo, surfMat);
    surf.rotation.x = -Math.PI / 2;
    surf.position.y = -1.48;
    surf.receiveShadow = true;
    scene.add(surf);

    const box = _makeBox(THREE, 1.4, 1.4, 1.4, 0xf59e0b);
    box.position.y = -0.8;
    box.castShadow = true;
    scene.add(box);

    const appliedArr = _makeArrow(THREE, new THREE.Vector3(0.7, -0.8, 0), new THREE.Vector3(2.6, -0.8, 0), 0x22c55e, 0.35);
    scene.add(appliedArr);
    const frictionArr = _makeArrow(THREE, new THREE.Vector3(-0.7, -0.8, 0), new THREE.Vector3(-2.6, -0.8, 0), 0xef4444, 0.35);
    scene.add(frictionArr);
    const normalArr = _makeArrow(THREE, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2.2, 0), 0x6366f1, 0.3);
    scene.add(normalArr);
    const weightArr = _makeArrow(THREE, new THREE.Vector3(0, -0.8, 0), new THREE.Vector3(0, -2.5, 0), 0x6366f1, 0.3);
    scene.add(weightArr);

    const hatchPts = [];
    for (let x = -7; x <= 7; x += 0.6) {
      hatchPts.push(new THREE.Vector3(x, -1.47, -2));
      hatchPts.push(new THREE.Vector3(x + 0.4, -1.47, 2));
    }
    const hatchGeo = new THREE.BufferGeometry().setFromPoints(hatchPts);
    scene.add(new THREE.LineSegments(hatchGeo, new THREE.LineBasicMaterial({ color: 0x6b7280 })));

    s.objects.box = box;
    s.objects.appliedArr = appliedArr;
    s.objects.frictionArr = frictionArr;
    s.objects.normalArr = normalArr;
    s.objects.weightArr = weightArr;

    _addLabel(s, '→ F_applied (push)', 55, 38, '#22c55e');
    _addLabel(s, '← f = μN (friction)', 2, 38, '#ef4444');
    _addLabel(s, 'N ↑', 47, 14, '#6366f1', 'rgba(0,0,0,0)');
    _addLabel(s, 'W ↓', 47, 72, '#6366f1', 'rgba(0,0,0,0)');

    _three.updateFn = (st) => {
      const x = -5 + (st.t * 1.1) % 9;
      st.objects.box.position.x = x;
      st.objects.appliedArr.position.x = x;
      st.objects.frictionArr.position.x = x;
      st.objects.normalArr.position.x = x;
      st.objects.weightArr.position.x = x;
      st.objects.box.rotation.y = st.t * 0.3;
    };
  }

  function _scene_momentum(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 3, 12);
    _makeGround(THREE, scene);
    _makeGridHelper(THREE, scene);

    const b1 = _makeSphere(THREE, 0.7, 0x3b82f6, 0.5);
    b1.castShadow = true;
    scene.add(b1);
    const b2 = _makeSphere(THREE, 0.45, 0xef4444, 0.5);
    b2.castShadow = true;
    scene.add(b2);

    const arr1 = _makeArrow(THREE, new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.5, 0, 0), 0x60a5fa, 0.3);
    scene.add(arr1);
    const arr2 = _makeArrow(THREE, new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.8, 0, 0), 0xfca5a5, 0.3);
    scene.add(arr2);

    const flashGeo = new THREE.SphereGeometry(0.8, 16, 16);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0 });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    scene.add(flash);

    s.objects.b1 = b1;
    s.objects.b2 = b2;
    s.objects.arr1 = arr1;
    s.objects.arr2 = arr2;
    s.objects.flash = flash;

    _addLabel(s, 'p₁ = 4×v₁', 8, 8, '#60a5fa');
    _addLabel(s, 'p₂ (after collision)', 52, 8, '#fca5a5');
    _addLabel(s, 'Total momentum conserved', 20, 84, '#fbbf24');

    _three.updateFn = (st) => {
      const period = 3.5, phase = (st.t % period) / period;
      if (phase < 0.45) {
        const p = phase / 0.45;
        st.objects.b1.position.set(-5 + p * 4.2, -0.8, 0);
        st.objects.b2.position.set(3.5, -0.8, 0);
        st.objects.arr1.position.set(-5 + p * 4.2 + 0.7, -0.8, 0);
        st.objects.flash.material.opacity = 0;
      } else if (phase < 0.55) {
        st.objects.b1.position.set(-0.8, -0.8, 0);
        st.objects.b2.position.set(0.55, -0.8, 0);
        st.objects.flash.position.set(0, -0.8, 0);
        st.objects.flash.material.opacity = 1 - (phase - 0.45) / 0.1;
        st.objects.arr1.position.set(5, -5, 0);
      } else {
        const pp = (phase - 0.55) / 0.45;
        st.objects.b1.position.set(-0.8 + pp * 0.6, -0.8, 0);
        st.objects.b2.position.set(0.55 + pp * 4.5, -0.8, 0);
        st.objects.arr2.position.set(0.55 + pp * 4.5 + 0.45, -0.8, 0);
        st.objects.flash.material.opacity = 0;
      }
    };
  }

  function _scene_transverse(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 4, 12);
    scene.background = new THREE.Color(0x080820);

    const nPoints = 80;
    const positions = new Float32Array(nPoints * 3);
    const waveGeo = new THREE.BufferGeometry();
    waveGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const waveMat = new THREE.LineBasicMaterial({ color: _hex(s.color), linewidth: 2 });
    const waveLine = new THREE.Line(waveGeo, waveMat);
    scene.add(waveLine);

    const particleCount = 20;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: _hex(s.color), size: 0.25 });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    const axisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-6, 0, 0), new THREE.Vector3(6, 0, 0)]);
    scene.add(new THREE.Line(axisGeo, new THREE.LineDashedMaterial({ color: 0x475569, dashSize: 0.3, gapSize: 0.2 })));

    const dirArr = _makeArrow(THREE, new THREE.Vector3(-6, 0, 0), new THREE.Vector3(6, 0, 0), 0x22c55e, 0.4);
    scene.add(dirArr);

    s.objects.waveGeo = waveGeo;
    s.objects.pGeo = pGeo;

    _addLabel(s, '→ Wave travels (direction of energy)', 15, 6, '#22c55e');
    _addLabel(s, '↕ Particle oscillates perpendicular', 15, 82, _hex(s.color) > 0 ? s.color : '#06b6d4');
    _addLabel(s, 'λ', 48, 14, '#f97316');
    _addLabel(s, 'A (amplitude)', 78, 30, '#f97316');

    _three.updateFn = (st) => {
      const posArr = st.objects.waveGeo.attributes.position.array;
      for (let i = 0; i < nPoints; i++) {
        const x = -6 + (i / (nPoints - 1)) * 12;
        const y = 1.8 * Math.sin(x * 1.2 - st.t * 3.5);
        posArr[i * 3]     = x;
        posArr[i * 3 + 1] = y;
        posArr[i * 3 + 2] = 0;
      }
      st.objects.waveGeo.attributes.position.needsUpdate = true;

      const pPosArr = st.objects.pGeo.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        const x = -6 + (i / particleCount) * 12;
        const y = 1.8 * Math.sin(x * 1.2 - st.t * 3.5);
        pPosArr[i * 3]     = x;
        pPosArr[i * 3 + 1] = y;
        pPosArr[i * 3 + 2] = 0;
      }
      st.objects.pGeo.attributes.position.needsUpdate = true;
    };
  }

  function _scene_longitudinal(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 3, 12);
    scene.background = new THREE.Color(0x080820);

    const nParticles = 32;
    const spheres = [];
    for (let i = 0; i < nParticles; i++) {
      const geo = new THREE.SphereGeometry(0.18, 12, 12);
      const mat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, metalness: 0.3, roughness: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(-6 + (i / nParticles) * 12, 0, 0);
      scene.add(mesh);
      spheres.push({ mesh, x0: -6 + (i / nParticles) * 12 });
    }
    s.objects.spheres = spheres;

    const waveArr = _makeArrow(THREE, new THREE.Vector3(-6, -2.5, 0), new THREE.Vector3(6, -2.5, 0), 0x22c55e, 0.4);
    scene.add(waveArr);

    _addLabel(s, '→ Wave + particles travel same direction', 5, 8, '#22c55e');
    _addLabel(s, '■ Compression (crowded)', 5, 80, '#ef4444');
    _addLabel(s, '○ Rarefaction (spread out)', 55, 80, '#60a5fa');

    _three.updateFn = (st) => {
      st.objects.spheres.forEach(({ mesh, x0 }) => {
        const displacement = 0.7 * Math.sin((x0 * 1.1) - st.t * 3.0);
        mesh.position.x = x0 + displacement;
        const density = 1 - Math.abs(displacement) / 0.8;
        mesh.material.color.setHex(density > 0.5 ? 0xef4444 : 0x60a5fa);
        const sc = 0.8 + density * 0.4;
        mesh.scale.setScalar(sc);
      });
    };
  }

  function _scene_em_spectrum(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 5, 14);
    scene.background = new THREE.Color(0x02020f);

    const bands = [
      { label:'Radio',     color: 0x6366f1, freq: 0.3 },
      { label:'Microwave', color: 0x8b5cf6, freq: 0.6 },
      { label:'Infrared',  color: 0xf97316, freq: 1.0 },
      { label:'Visible',   color: 0x22c55e, freq: 1.5 },
      { label:'UV',        color: 0xa855f7, freq: 2.2 },
      { label:'X-ray',     color: 0x3b82f6, freq: 3.5 },
      { label:'Gamma',     color: 0xef4444, freq: 6.0 },
    ];

    const waves = [];
    bands.forEach((b, i) => {
      const z = -4 + i * 1.2;
      const pts = [];
      for (let j = 0; j < 60; j++) {
        pts.push(new THREE.Vector3(-5 + j * (10 / 60), 0, z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: b.color });
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      waves.push({ line, geo, color: b.color, freq: b.freq, z });

      const planeGeo = new THREE.PlaneGeometry(10, 0.8);
      const planeMat = new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: 0.08, side: THREE.DoubleSide });
      const plane = new THREE.Mesh(planeGeo, planeMat);
      plane.position.set(0, 0, z);
      scene.add(plane);

      _addLabel(s, b.label, 2 + i * 13.5, 8, '#' + b.color.toString(16).padStart(6, '0'), 'rgba(0,0,0,0.7)');
    });

    camera.position.set(0, 6, 10);
    camera.lookAt(0, 0, -1);

    s.objects.waves = waves;

    _addLabel(s, 'All EM waves: c = 3×10⁸ m/s in vacuum', 10, 88, '#ffffff', 'rgba(0,0,0,0.6)');

    _three.updateFn = (st) => {
      st.objects.waves.forEach(({ geo, freq, z }) => {
        const posArr = geo.attributes.position.array;
        for (let j = 0; j < 60; j++) {
          posArr[j * 3 + 1] = 0.4 * Math.sin(posArr[j * 3] * freq * 0.9 - st.t * 3.5);
        }
        geo.attributes.position.needsUpdate = true;
      });
    };
  }

  function _scene_reflection(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 5, 13);
    scene.background = new THREE.Color(0x080818);

    const ifaceGeo = new THREE.PlaneGeometry(14, 6);
    const ifaceMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    const iface = new THREE.Mesh(ifaceGeo, ifaceMat);
    iface.rotation.x = -Math.PI / 2;
    iface.position.y = 0;
    scene.add(iface);

    scene.add(new THREE.GridHelper(14, 14, 0x0ea5e9, 0x0ea5e966));

    const normalGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -3.5, 0), new THREE.Vector3(0, 3.5, 0)]);
    const normalLine = new THREE.Line(normalGeo, new THREE.LineDashedMaterial({ color: 0x94a3b8, dashSize: 0.25, gapSize: 0.15 }));
    normalLine.computeLineDistances();
    scene.add(normalLine);

    const inAngle = 35 * Math.PI / 180;
    const incidentArr = _makeArrow(THREE, new THREE.Vector3(-3 * Math.sin(inAngle), 3 * Math.cos(inAngle), 0), new THREE.Vector3(0, 0, 0), 0xf97316, 0.35);
    scene.add(incidentArr);

    const reflectedArr = _makeArrow(THREE, new THREE.Vector3(0, 0, 0), new THREE.Vector3(3 * Math.sin(inAngle), 3 * Math.cos(inAngle), 0), 0x22c55e, 0.35);
    scene.add(reflectedArr);

    const refAngle = 22 * Math.PI / 180;
    const refractedArr = _makeArrow(THREE, new THREE.Vector3(0, 0, 0), new THREE.Vector3(3 * Math.sin(refAngle), -3 * Math.cos(refAngle), 0), 0xa855f7, 0.35);
    scene.add(refractedArr);

    const denseGeo = new THREE.PlaneGeometry(14, 6);
    const denseMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.10, side: THREE.DoubleSide });
    const dense = new THREE.Mesh(denseGeo, denseMat);
    dense.rotation.x = -Math.PI / 2;
    dense.position.y = -1.5;
    scene.add(dense);

    const photon = _makeSphere(THREE, 0.15, 0xfbbf24);
    scene.add(photon);
    s.objects.photon = photon;

    _addLabel(s, '→ Incident ray (θ₁=35°)', 2, 8, '#f97316');
    _addLabel(s, '↗ Reflected ray (θᵣ=35°)', 60, 8, '#22c55e');
    _addLabel(s, '↘ Refracted ray (θ₂=22°)', 60, 62, '#a855f7');
    _addLabel(s, 'Medium 1 (faster, n₁)', 2, 32, '#94a3b8', 'rgba(0,0,0,0)');
    _addLabel(s, 'Medium 2 (slower, n₂)', 2, 62, '#0ea5e9', 'rgba(0,0,0,0)');

    _three.updateFn = (st) => {
      const period = 2.5;
      const phase = (st.t % period) / period;
      const from = new THREE.Vector3(-3 * Math.sin(inAngle), 3 * Math.cos(inAngle), 0);
      const mid  = new THREE.Vector3(0, 0, 0);
      const to   = new THREE.Vector3(3 * Math.sin(refAngle), -3 * Math.cos(refAngle), 0);
      if (phase < 0.5) {
        st.objects.photon.position.lerpVectors(from, mid, phase * 2);
      } else {
        st.objects.photon.position.lerpVectors(mid, to, (phase - 0.5) * 2);
      }
    };
  }

  function _scene_ohms_law(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 4, 12);
    scene.background = new THREE.Color(0x080818);

    const wireMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3 });
    const wireRadius = 0.1;

    function makeTube(pts) {
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 20, wireRadius, 8, false);
      return new THREE.Mesh(geo, wireMat);
    }

    const w = 5, h = 2.5;
    scene.add(makeTube([new THREE.Vector3(-w, h, 0), new THREE.Vector3(w, h, 0)]));
    scene.add(makeTube([new THREE.Vector3(w, h, 0), new THREE.Vector3(w, -h, 0)]));
    scene.add(makeTube([new THREE.Vector3(w, -h, 0), new THREE.Vector3(-w, -h, 0)]));
    scene.add(makeTube([new THREE.Vector3(-w, -h, 0), new THREE.Vector3(-w, h, 0)]));

    const batGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.4, 16);
    const batMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: 0.5, roughness: 0.4 });
    const battery = new THREE.Mesh(batGeo, batMat);
    battery.position.set(-w, 0, 0);
    battery.rotation.z = Math.PI / 2;
    scene.add(battery);

    const resGeo = new THREE.BoxGeometry(2.2, 0.5, 0.5);
    const resMat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.2, roughness: 0.7 });
    const resistor = new THREE.Mesh(resGeo, resMat);
    resistor.position.set(0, h, 0);
    scene.add(resistor);

    const nElectrons = 12;
    const electrons = [];
    for (let i = 0; i < nElectrons; i++) {
      const eg = new THREE.SphereGeometry(0.14, 8, 8);
      const em = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.5 });
      const e = new THREE.Mesh(eg, em);
      scene.add(e);
      electrons.push({ mesh: e, offset: i / nElectrons });
    }
    s.objects.electrons = electrons;

    _addLabel(s, '12V Battery', 2, 36, '#22c55e');
    _addLabel(s, 'R = 4Ω', 44, 6, '#f97316');
    _addLabel(s, 'I = 3A (electrons flowing)', 25, 90, '#fbbf24');
    _addLabel(s, 'V = IR → 12 = 3 × 4', 55, 55, '#ffffff');

    _three.updateFn = (st) => {
      const w2 = 5, h2 = 2.5;
      const perim = (w2 * 2 * 2 + h2 * 2 * 2);
      st.objects.electrons.forEach(({ mesh, offset }) => {
        const pos = ((st.t * 1.8 + offset * perim)) % perim;
        const seg1 = w2 * 2, seg2 = seg1 + h2 * 2, seg3 = seg2 + w2 * 2;
        if (pos < seg1)       mesh.position.set(-w2 + pos, h2, 0);
        else if (pos < seg2)  mesh.position.set(w2, h2 - (pos - seg1), 0);
        else if (pos < seg3)  mesh.position.set(w2 - (pos - seg2), -h2, 0);
        else                  mesh.position.set(-w2, -h2 + (pos - seg3), 0);
      });
    };
  }

  function _scene_series_parallel(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 6, 16);
    scene.background = new THREE.Color(0x080818);

    const wireMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.5 });
    const rMat1   = new THREE.MeshStandardMaterial({ color: 0xf97316 });
    const rMat2   = new THREE.MeshStandardMaterial({ color: 0xef4444 });

    function tube(p1, p2, mat) {
      const pts = [p1, p2];
      const curve = new THREE.LineCurve3(p1, p2);
      const geo = new THREE.TubeGeometry(curve, 4, 0.09, 8, false);
      return new THREE.Mesh(geo, mat || wireMat);
    }

    const sx = -4;
    scene.add(tube(new THREE.Vector3(sx-2, 2, 0), new THREE.Vector3(sx+2, 2, 0)));
    scene.add(tube(new THREE.Vector3(sx+2, 2, 0), new THREE.Vector3(sx+2, -2, 0)));
    scene.add(tube(new THREE.Vector3(sx+2, -2, 0), new THREE.Vector3(sx-2, -2, 0)));
    scene.add(tube(new THREE.Vector3(sx-2, -2, 0), new THREE.Vector3(sx-2, 2, 0)));

    const r1s = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.35), rMat1);
    r1s.position.set(sx - 0.5, 2, 0);
    scene.add(r1s);
    const r2s = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.35), rMat2);
    r2s.position.set(sx + 0.7, 2, 0);
    scene.add(r2s);

    const batS = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12), new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: 0.5 }));
    batS.position.set(sx - 2, 0, 0);
    batS.rotation.z = Math.PI / 2;
    scene.add(batS);

    const px = 4;
    scene.add(tube(new THREE.Vector3(px-2, 3, 0), new THREE.Vector3(px+2, 3, 0)));
    scene.add(tube(new THREE.Vector3(px+2, 3, 0), new THREE.Vector3(px+2, -3, 0)));
    scene.add(tube(new THREE.Vector3(px+2, -3, 0), new THREE.Vector3(px-2, -3, 0)));
    scene.add(tube(new THREE.Vector3(px-2, -3, 0), new THREE.Vector3(px-2, 3, 0)));
    scene.add(tube(new THREE.Vector3(px-2, 1, 0), new THREE.Vector3(px+2, 1, 0)));
    scene.add(tube(new THREE.Vector3(px-2, -1, 0), new THREE.Vector3(px+2, -1, 0)));

    const r1p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.35), rMat1);
    r1p.position.set(px, 2, 0);
    scene.add(r1p);
    const r2p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.35), rMat2);
    r2p.position.set(px, 0, 0);
    scene.add(r2p);

    const batP = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12), new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: 0.5 }));
    batP.position.set(px - 2, 0, 0);
    batP.rotation.z = Math.PI / 2;
    scene.add(batP);

    const nE = 6;
    const seriesElectrons = [], parallelElectrons = [];
    for (let i = 0; i < nE; i++) {
      const eg = new THREE.SphereGeometry(0.12, 8, 8);
      const em = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 0.5 });
      const e = new THREE.Mesh(eg, em);
      scene.add(e);
      seriesElectrons.push({ mesh: e, offset: i / nE });
    }
    for (let i = 0; i < nE; i++) {
      const eg = new THREE.SphereGeometry(0.12, 8, 8);
      const em = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.4 });
      const e = new THREE.Mesh(eg, em);
      scene.add(e);
      parallelElectrons.push({ mesh: e, offset: i / nE, branch: i % 2 });
    }

    s.objects.seriesElectrons = seriesElectrons;
    s.objects.parallelElectrons = parallelElectrons;

    _addLabel(s, 'SERIES — one path, same current', 2, 6, '#3b82f6');
    _addLabel(s, 'PARALLEL — split paths, same voltage', 52, 6, '#ef4444');
    _addLabel(s, 'R_total = R₁+R₂', 8, 88, '#f97316');
    _addLabel(s, '1/R_T = 1/R₁+1/R₂', 58, 88, '#22c55e');

    _three.updateFn = (st) => {
      const sPerim = 16;
      st.objects.seriesElectrons.forEach(({ mesh, offset }) => {
        const pos = (st.t * 1.4 + offset * sPerim) % sPerim;
        if (pos < 4)       mesh.position.set(sx - 2 + pos, 2, 0);
        else if (pos < 8)  mesh.position.set(sx + 2, 2 - (pos - 4), 0);
        else if (pos < 12) mesh.position.set(sx + 2 - (pos - 8), -2, 0);
        else               mesh.position.set(sx - 2, -2 + (pos - 12), 0);
      });

      const pPerim = 12;
      st.objects.parallelElectrons.forEach(({ mesh, offset, branch }) => {
        const pos = (st.t * 1.1 + offset * pPerim) % pPerim;
        const y   = branch === 0 ? 2 : 0;
        if (pos < 4)      mesh.position.set(px - 2 + pos, y, 0);
        else if (pos < 8) mesh.position.set(px + 2, y - (pos - 4) * 0.5, 0);
        else              mesh.position.set(px + 2 - (pos - 8) * 1, -2 + branch, 0);
      });
    };
  }

  function _scene_electric_field(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 2, 12);
    scene.background = new THREE.Color(0x02020f);

    const posCharge = _makeSphere(THREE, 0.7, 0xef4444, 0.6);
    posCharge.position.set(-3.5, 0, 0);
    scene.add(posCharge);

    const negCharge = _makeSphere(THREE, 0.7, 0x3b82f6, 0.6);
    negCharge.position.set(3.5, 0, 0);
    scene.add(negCharge);

    const posLight = new THREE.PointLight(0xef4444, 1.2, 6);
    posLight.position.set(-3.5, 0, 0);
    scene.add(posLight);

    const negLight = new THREE.PointLight(0x3b82f6, 1.2, 6);
    negLight.position.set(3.5, 0, 0);
    scene.add(negLight);

    const nLines = 12;
    const fieldLines = [];
    for (let i = 0; i < nLines; i++) {
      const angle = (i / nLines) * Math.PI * 2;
      const pts = [];
      for (let t = 0; t <= 1; t += 0.02) {
        const fromX = -3.5 + 0.75 * Math.cos(angle);
        const fromY = 0.75 * Math.sin(angle);
        const toX   = 3.5 + 0.75 * Math.cos(angle + Math.PI);
        const toY   = 0.75 * Math.sin(angle + Math.PI);
        const cx    = 0;
        const cy    = Math.sin(angle) * 2.5;
        const bx    = (1-t)*(1-t)*fromX + 2*(1-t)*t*cx + t*t*toX;
        const by    = (1-t)*(1-t)*fromY + 2*(1-t)*t*cy + t*t*toY;
        pts.push(new THREE.Vector3(bx, by, 0));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.45 });
      const line = new THREE.Line(geo, mat);
      scene.add(line);

      const dot = _makeSphere(THREE, 0.1, 0xfbbf24);
      scene.add(dot);
      fieldLines.push({ pts, dot, offset: i / nLines });
    }

    const posRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.04, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    posRing.position.set(-3.5, 0, 0);
    scene.add(posRing);

    const negRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.04, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6 })
    );
    negRing.position.set(3.5, 0, 0);
    scene.add(negRing);

    s.objects.fieldLines = fieldLines;
    s.objects.posCharge = posCharge;
    s.objects.negCharge = negCharge;
    s.objects.posRing   = posRing;
    s.objects.negRing   = negRing;

    _addLabel(s, '+ (Q₁)', 18, 38, '#ef4444', 'rgba(0,0,0,0)');
    _addLabel(s, '− (Q₂)', 74, 38, '#60a5fa', 'rgba(0,0,0,0)');
    _addLabel(s, 'Field lines: + → −   F = kQ₁Q₂/r²', 15, 88, '#fbbf24', 'rgba(0,0,0,0.6)');

    _three.updateFn = (st) => {
      const pulse = 1 + Math.sin(st.t * 3) * 0.04;
      st.objects.posCharge.scale.setScalar(pulse);
      st.objects.negCharge.scale.setScalar(pulse);
      st.objects.posRing.scale.setScalar(1 + Math.sin(st.t * 2) * 0.06);
      st.objects.negRing.scale.setScalar(1 + Math.cos(st.t * 2) * 0.06);

      st.objects.fieldLines.forEach(({ pts, dot, offset }) => {
        const idx = Math.floor(((st.t * 0.4 + offset) % 1) * (pts.length - 1));
        dot.position.copy(pts[idx]);
      });
    };
  }

  function _scene_ke_pe(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 4, 14);
    scene.background = new THREE.Color(0x060818);

    const nPts = 80;
    const trackPts = [];
    for (let i = 0; i < nPts; i++) {
      const t = i / (nPts - 1);
      const x = -6 + t * 12;
      const y = -1.5 + Math.pow(Math.cos(t * Math.PI), 2) * 4.5;
      trackPts.push(new THREE.Vector3(x, y, 0));
    }
    const trackCurve = new THREE.CatmullRomCurve3(trackPts);
    const trackGeo   = new THREE.TubeGeometry(trackCurve, 100, 0.08, 8, false);
    const trackMat   = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.3 });
    scene.add(new THREE.Mesh(trackGeo, trackMat));

    const cart = _makeBox(THREE, 0.9, 0.5, 0.6, 0x6366f1, 0.6, 0.3);
    cart.castShadow = true;
    scene.add(cart);

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5, metalness: 0.5 });
    const wheels = [];
    [[-0.3, -0.1], [0.3, -0.1]].forEach(([wz, wy]) => {
      const wg = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12);
      const wm = new THREE.Mesh(wg, wheelMat);
      wm.rotation.x = Math.PI / 2;
      wm.position.set(0, wy, wz);
      cart.add(wm);
      wheels.push(wm);
    });

    const keBarGeo = new THREE.BoxGeometry(0.5, 1, 0.3);
    const keBarMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf97316, emissiveIntensity: 0.2 });
    const keBar = new THREE.Mesh(keBarGeo, keBarMat);
    keBar.position.set(5, -0.5, 0);
    scene.add(keBar);

    const peBarGeo = new THREE.BoxGeometry(0.5, 1, 0.3);
    const peBarMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.2 });
    const peBar = new THREE.Mesh(peBarGeo, peBarMat);
    peBar.position.set(5.7, -0.5, 0);
    scene.add(peBar);

    const trackLight = new THREE.PointLight(0x6366f1, 0.8, 8);
    scene.add(trackLight);

    s.objects.cart = cart;
    s.objects.keBar = keBar;
    s.objects.peBar = peBar;
    s.objects.trackCurve = trackCurve;
    s.objects.trackLight = trackLight;
    s.objects.wheels = wheels;

    _addLabel(s, '🟠 KE   🟢 GPE', 72, 8, '#ffffff', 'rgba(0,0,0,0.5)');
    _addLabel(s, 'KE = ½mv²   GPE = mgh   Total = constant', 5, 88, '#ffffff', 'rgba(0,0,0,0.5)');

    _three.updateFn = (st) => {
      const frac = (Math.sin(st.t * 0.8) + 1) / 2;
      const pt   = st.objects.trackCurve.getPoint(frac);
      st.objects.cart.position.copy(pt);

      const tangent = st.objects.trackCurve.getTangent(frac);
      st.objects.cart.rotation.z = Math.atan2(tangent.y, tangent.x);

      st.objects.wheels.forEach(w => { w.rotation.z += 0.1; });

      const normY = (pt.y + 1.5) / 4.5;
      const ke    = 1 - normY;
      const pe    = normY;
      st.objects.keBar.scale.y = Math.max(0.05, ke * 3);
      st.objects.keBar.position.y = -1.5 + st.objects.keBar.scale.y * 0.5;
      st.objects.peBar.scale.y = Math.max(0.05, pe * 3);
      st.objects.peBar.position.y = -1.5 + st.objects.peBar.scale.y * 0.5;

      st.objects.keBar.material.emissiveIntensity = ke * 0.6;
      st.objects.peBar.material.emissiveIntensity = pe * 0.6;

      st.objects.trackLight.position.copy(pt);
      st.objects.trackLight.color.setHSL(0.1 + ke * 0.25, 1, 0.5);
    };
  }

  function _scene_work_power(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 4, 14);
    scene.background = new THREE.Color(0x060818);
    _makeGround(THREE, scene, 0x1e293b);
    _makeGridHelper(THREE, scene);

    const box = _makeBox(THREE, 1.2, 1.2, 1.2, 0xf59e0b, 0.3, 0.6);
    box.castShadow = true;
    scene.add(box);

    const personBody = new THREE.Mesh(
      new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.2, 0.8, 4, 8) : new THREE.CylinderGeometry(0.2, 0.2, 1, 8),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
    );
    personBody.position.y = 0.1;
    scene.add(personBody);

    const head = _makeSphere(THREE, 0.22, 0x94a3b8);
    scene.add(head);

    const pushArr = _makeArrow(THREE, new THREE.Vector3(0.6, -0.4, 0), new THREE.Vector3(2.2, -0.4, 0), 0x22c55e, 0.35);
    scene.add(pushArr);

    const trailGeo = new THREE.BufferGeometry();
    const trailPts = new Float32Array(60 * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPts, 3));
    const trailLine = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.5 }));
    scene.add(trailLine);

    const dispLight = new THREE.PointLight(0x22c55e, 0.8, 5);
    scene.add(dispLight);

    s.objects.box = box;
    s.objects.person = personBody;
    s.objects.head = head;
    s.objects.pushArr = pushArr;
    s.objects.trailGeo = trailGeo;
    s.objects.dispLight = dispLight;
    s.objects.history = [];

    _addLabel(s, '→ F = 50N', 55, 40, '#22c55e');
    _addLabel(s, 'W = F × s (Joules)  |  P = W/t (Watts)', 8, 88, '#ffffff', 'rgba(0,0,0,0.5)');

    _three.updateFn = (st) => {
      const x = -5 + (st.t * 1.3) % 9;
      st.objects.box.position.set(x, -0.9, 0);
      st.objects.box.rotation.y = st.t * 0.2;

      st.objects.person.position.set(x - 1.1, -0.4, 0);
      st.objects.head.position.set(x - 1.1, 0.75, 0);

      const legSwing = Math.sin(st.t * 8) * 0.25;
      st.objects.person.rotation.z = legSwing * 0.1;

      st.objects.pushArr.position.set(x, -0.9, 0);
      st.objects.dispLight.position.set(x, 0, 0);

      st.objects.history.push(new THREE.Vector3(x, -0.9, 0));
      if (st.objects.history.length > 60) st.objects.history.shift();
      const pts = st.objects.trailGeo.attributes.position.array;
      st.objects.history.forEach((p, i) => { pts[i*3]=p.x; pts[i*3+1]=p.y; pts[i*3+2]=p.z; });
      st.objects.trailGeo.attributes.position.needsUpdate = true;
      st.objects.trailGeo.setDrawRange(0, st.objects.history.length);
    };
  }

  function _scene_energy_transfer(s) {
    const { THREE, scene, camera } = s;
    camera.position.set(0, 4, 14);
    scene.background = new THREE.Color(0x060818);

    const inputBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 3, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.3 })
    );
    inputBar.position.set(-5, 0, 0);
    scene.add(inputBar);

    const device = _makeBox(THREE, 1.8, 2.5, 1.0, 0x334155, 0.3, 0.7);
    device.position.set(0, 0, 0);
    scene.add(device);

    const deviceGlow = new THREE.PointLight(0xfbbf24, 1.0, 5);
    deviceGlow.position.set(0, 0, 0.5);
    scene.add(deviceGlow);

    const usefulBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 2.1, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.3 })
    );
    usefulBar.position.set(4.5, 0.45, 0);
    scene.add(usefulBar);

    const wastedBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.9, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.35 })
    );
    wastedBar.position.set(4.5, -1.5, 0);
    scene.add(wastedBar);

    const connGeo1 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-4.6, 0, 0), new THREE.Vector3(-0.9, 0, 0)]);
    scene.add(new THREE.Line(connGeo1, new THREE.LineBasicMaterial({ color: 0xfbbf24 })));

    const connGeo2 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.9, 0.45, 0), new THREE.Vector3(4.1, 0.45, 0)]);
    scene.add(new THREE.Line(connGeo2, new THREE.LineBasicMaterial({ color: 0x22c55e })));

    const connGeo3 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.9, -1.5, 0), new THREE.Vector3(4.2, -1.5, 0)]);
    scene.add(new THREE.Line(connGeo3, new THREE.LineBasicMaterial({ color: 0xef4444 })));

    const nParticles = 16;
    const particles  = [];
    for (let i = 0; i < nParticles; i++) {
      const pg = new THREE.SphereGeometry(0.1, 6, 6);
      const pm = new THREE.MeshStandardMaterial({
        color: i < 11 ? 0x22c55e : 0xef4444,
        emissive: i < 11 ? 0x22c55e : 0xef4444,
        emissiveIntensity: 0.5,
      });
      const p = new THREE.Mesh(pg, pm);
      scene.add(p);
      particles.push({ mesh: p, offset: i / nParticles, type: i < 11 ? 'useful' : 'wasted' });
    }

    const heatParticles = [];
    for (let i = 0; i < 8; i++) {
      const hg = new THREE.SphereGeometry(0.08, 6, 6);
      const hm = new THREE.MeshStandardMaterial({ color: 0xff6b35, emissive: 0xff6b35, emissiveIntensity: 0.7, transparent: true, opacity: 0.7 });
      const h  = new THREE.Mesh(hg, hm);
      scene.add(h);
      heatParticles.push({ mesh: h, offset: Math.random(), startX: 4.5 + (Math.random()-0.5)*0.6, age: Math.random() });
    }

    s.objects.inputBar    = inputBar;
    s.objects.usefulBar   = usefulBar;
    s.objects.wastedBar   = wastedBar;
    s.objects.deviceGlow  = deviceGlow;
    s.objects.particles   = particles;
    s.objects.heatParticles = heatParticles;

    _addLabel(s, '100J Input', 2, 24, '#fbbf24');
    _addLabel(s, '70J Useful (KE)', 60, 18, '#22c55e');
    _addLabel(s, '30J Wasted (Heat)', 60, 64, '#ef4444');
    _addLabel(s, 'Efficiency = 70%  |  Energy is conserved', 10, 88, '#ffffff', 'rgba(0,0,0,0.5)');

    _three.updateFn = (st) => {
      const pulse = 1 + Math.sin(st.t * 2) * 0.03;
      st.objects.inputBar.scale.x = pulse;
      st.objects.deviceGlow.intensity = 0.8 + Math.sin(st.t * 4) * 0.3;

      st.objects.particles.forEach(({ mesh, offset, type }) => {
        const pos = (st.t * 1.2 + offset * 9) % 9;
        if (pos < 3.7) {
          mesh.position.set(-4.6 + pos * 1.05, 0, (Math.random()-0.5)*0.05);
        } else if (type === 'useful') {
          mesh.position.set(0.9 + (pos - 3.7) * 0.9, 0.45, 0);
        } else {
          mesh.position.set(0.9 + (pos - 3.7) * 0.7, -1.5, 0);
        }
      });

      st.objects.heatParticles.forEach((hp) => {
        hp.age += 0.008;
        if (hp.age > 1) { hp.age = 0; hp.startX = 4.5 + (Math.random()-0.5)*0.6; }
        hp.mesh.position.set(hp.startX + Math.sin(hp.age * 12) * 0.15, -1.5 + hp.age * 2.5, 0);
        hp.mesh.material.opacity = 0.7 * (1 - hp.age);
        const sc = 0.8 + hp.age * 0.5;
        hp.mesh.scale.setScalar(sc);
      });
    };
  }

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
              return `<button class="phys-quiz-opt ${cls}" ${_quizAnswered?'disabled':''} onclick="ThreeDPhysics._answerQuiz('${opt.replace(/'/g,"\\'")}')"> ${opt}</button>`;
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
    requestAnimationFrame(_launchScene);
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
