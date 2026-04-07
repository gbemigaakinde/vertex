/* ============================================================
   js/threedclass-physics.js — Interactive Physics Module
   ============================================================
   Tabs:
     1. Forces & Motion    — animated force diagrams, Newton's laws
     2. Waves              — live animated transverse/longitudinal waves
     3. Electricity        — animated circuit with current flow
     4. Energy             — energy transfer animations
     5. Quiz               — identify/calculate flashcards

   SPA integration:
     ThreeDClass launches → ThreeDPhysics.open(onBackCallback)
     Back button          → onBackCallback() → ThreeDClass hub
   ============================================================ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════
     TOPIC DATA
  ══════════════════════════════════════════════════ */

  const TOPICS = {
    forces: {
      id: 'forces', label: "Forces & Motion", icon: '🚀',
      color: '#f97316', dark: '#fb923c',
      subtopics: [
        {
          id: 'newton1',
          title: "Newton's First Law",
          subtitle: 'Law of Inertia',
          color: '#f97316',
          equation: 'If F_net = 0, then a = 0',
          description: "An object at rest stays at rest, and an object in motion stays in motion at constant velocity, unless acted on by an unbalanced (net) force. This is called INERTIA — the resistance of an object to changes in its state of motion.",
          analogy: "A book sitting on a table stays still because friction and normal force balance. A hockey puck sliding on frictionless ice would go forever.",
          examTip: "Key phrase: 'unbalanced force'. If forces are balanced (F_net = 0), there is no acceleration — the object either stays still OR moves at constant speed.",
          facts: ["Mass is the measure of inertia", "Greater mass = greater inertia", "No net force = no acceleration", "Applies to both rest and uniform motion"],
          animation: 'newton1',
        },
        {
          id: 'newton2',
          title: "Newton's Second Law",
          subtitle: 'F = ma',
          color: '#ef4444',
          equation: 'F = ma',
          description: "The acceleration of an object is directly proportional to the net force applied, and inversely proportional to its mass. Doubling the force doubles the acceleration. Doubling the mass halves the acceleration.",
          analogy: "Pushing a shopping trolley: push harder (more F) = accelerates faster. A full trolley (more m) = harder to accelerate.",
          examTip: "F is the NET force (resultant of all forces). Always use SI units: F in Newtons (N), m in kg, a in m/s². Rearrange: a = F/m, m = F/a.",
          facts: ["F = ma (F in N, m in kg, a in m/s²)", "Net force causes acceleration", "Acceleration is in the direction of net force", "1 Newton = 1 kg·m/s²"],
          animation: 'newton2',
        },
        {
          id: 'newton3',
          title: "Newton's Third Law",
          subtitle: 'Action & Reaction',
          color: '#8b5cf6',
          equation: 'F_AB = −F_BA',
          description: "For every action force, there is an equal and opposite reaction force. Forces always come in pairs — they act on DIFFERENT objects, so they do NOT cancel each other.",
          analogy: "A rocket expels gas downward (action) — the gas pushes the rocket upward (reaction). Your feet push the Earth backward; the Earth pushes your feet forward.",
          examTip: "Critical: action-reaction pairs act on DIFFERENT objects. They are equal in magnitude, opposite in direction, and of the SAME TYPE. They never cancel because they act on different bodies.",
          facts: ["Forces come in pairs", "Equal magnitude, opposite direction", "Act on DIFFERENT objects", "Same type of force (e.g. both gravitational)"],
          animation: 'newton3',
        },
        {
          id: 'friction',
          title: "Friction",
          subtitle: 'Resistive Force',
          color: '#10b981',
          equation: 'f = μN',
          description: "Friction is a contact force that opposes relative motion or attempted motion between surfaces. Static friction prevents motion from starting; kinetic friction opposes ongoing motion. It depends on surface roughness and the normal force.",
          analogy: "Walking works because of friction — your foot pushes backward, friction pushes you forward. On ice, friction is very low so you slip.",
          examTip: "μ = coefficient of friction (no units). f = μN where N is the normal force. Static friction (μₛ) > kinetic friction (μₖ) for same surfaces — it's harder to START sliding than to KEEP sliding.",
          facts: ["f = μN (friction = μ × normal force)", "μₛ > μₖ always", "Acts parallel to surface", "Converted to heat energy"],
          animation: 'friction',
        },
        {
          id: 'momentum',
          title: "Momentum & Impulse",
          subtitle: 'p = mv',
          color: '#0ea5e9',
          equation: 'p = mv,  J = FΔt = Δp',
          description: "Momentum (p) is mass × velocity. Impulse (J) is the change in momentum, equal to force × time. The law of conservation of momentum states: total momentum before = total momentum after, in a closed system with no external forces.",
          analogy: "A cricket ball and a shot put thrown at the same speed have very different momenta. A crumple zone in a car increases collision time, reducing force on passengers (same impulse, longer Δt = smaller F).",
          examTip: "Conservation of momentum: m₁u₁ + m₂u₂ = m₁v₁ + m₂v₂. Elastic collision: KE conserved. Inelastic: KE not conserved. Impulse = area under F-t graph.",
          facts: ["p = mv (kg·m/s)", "J = FΔt = Δp", "Momentum is conserved in closed systems", "Vector quantity — direction matters"],
          animation: 'momentum',
        },
      ],
    },

    waves: {
      id: 'waves', label: 'Waves', icon: '〰️',
      color: '#06b6d4', dark: '#22d3ee',
      subtopics: [
        {
          id: 'transverse',
          title: 'Transverse Waves',
          subtitle: 'Perpendicular oscillation',
          color: '#06b6d4',
          equation: 'v = fλ',
          description: "In a transverse wave, particles oscillate perpendicular (at 90°) to the direction of wave travel. Light, water ripples, and secondary seismic waves (S-waves) are transverse. Key terms: amplitude (A), wavelength (λ), frequency (f), period (T), wave speed (v).",
          analogy: "Shaking a rope up-and-down while the wave travels horizontally. The rope particles move up and down — the wave moves sideways.",
          examTip: "v = fλ. Period T = 1/f. Amplitude = maximum displacement from equilibrium. Wavelength = distance between two identical adjacent points (crest to crest). For light: c = fλ where c = 3×10⁸ m/s.",
          facts: ["Particles oscillate ⊥ to wave direction", "Examples: light, water waves, S-waves", "v = fλ (wave speed = frequency × wavelength)", "T = 1/f"],
          animation: 'transverse',
        },
        {
          id: 'longitudinal',
          title: 'Longitudinal Waves',
          subtitle: 'Parallel oscillation',
          color: '#8b5cf6',
          equation: 'v = fλ',
          description: "In a longitudinal wave, particles oscillate parallel to the direction of wave travel, forming compressions (high pressure) and rarefactions (low pressure). Sound and primary seismic waves (P-waves) are longitudinal. These waves CAN travel through solids, liquids, and gases.",
          analogy: "Push-and-pull a slinky along its length — the coils bunch together (compression) and spread apart (rarefaction), but each coil only moves back and forth in place.",
          examTip: "Sound is longitudinal — cannot travel in a vacuum. Compression = high pressure region. Rarefaction = low pressure region. Wavelength = distance between two adjacent compressions (or two rarefactions).",
          facts: ["Particles oscillate ∥ to wave direction", "Examples: sound, P-waves, ultrasound", "Compressions and rarefactions", "Can travel through all states of matter"],
          animation: 'longitudinal',
        },
        {
          id: 'em_spectrum',
          title: 'Electromagnetic Spectrum',
          subtitle: 'The family of EM waves',
          color: '#f59e0b',
          equation: 'c = fλ = 3×10⁸ m/s',
          description: "Electromagnetic waves are transverse waves that carry energy and travel at the speed of light (3×10⁸ m/s) in a vacuum. They require NO medium. The EM spectrum ranges from low-frequency radio waves to high-frequency gamma rays.",
          analogy: "A piano keyboard — low notes (radio) at one end, high notes (gamma) at the other. All are sound, but very different frequencies. All EM waves travel at the same speed in a vacuum.",
          examTip: "ORDER (low f/long λ → high f/short λ): Radio → Microwave → Infrared → Visible → UV → X-ray → Gamma. 'Raving Martians Invaded Venus Using X-ray Guns'. Higher frequency = more energy = more dangerous.",
          facts: ["All travel at c = 3×10⁸ m/s in vacuum", "Transverse waves, no medium needed", "Higher f → shorter λ → more energy", "Radio waves: km wavelengths; Gamma: picometres"],
          animation: 'em_spectrum',
        },
        {
          id: 'reflection_refraction',
          title: 'Reflection & Refraction',
          subtitle: 'Wave behaviour at boundaries',
          color: '#22c55e',
          equation: 'n = c/v,  n₁sinθ₁ = n₂sinθ₂',
          description: "Reflection: wave bounces off a surface (angle of incidence = angle of reflection). Refraction: wave changes speed (and direction) when passing from one medium to another. Slowing down bends toward the normal; speeding up bends away.",
          analogy: "Light bending in a glass of water — your straw looks 'broken'. This is refraction. A mirror gives reflection. Both happen at every interface.",
          examTip: "Snell's Law: n₁sinθ₁ = n₂sinθ₂. n = refractive index = c/v. Denser medium = higher n = slower speed = bends toward normal. Total internal reflection when angle > critical angle.",
          facts: ["Angle of incidence = angle of reflection", "Refraction: speed change → direction change", "n = c/v (refractive index)", "Snell's Law: n₁sinθ₁ = n₂sinθ₂"],
          animation: 'reflection_refraction',
        },
      ],
    },

    electricity: {
      id: 'electricity', label: 'Electricity', icon: '⚡',
      color: '#f59e0b', dark: '#fbbf24',
      subtopics: [
        {
          id: 'ohms_law',
          title: "Ohm's Law",
          subtitle: 'V = IR',
          color: '#f59e0b',
          equation: 'V = IR',
          description: "Ohm's Law states that the voltage (potential difference) across a conductor is directly proportional to the current flowing through it, provided temperature remains constant. V = voltage (volts, V), I = current (amperes, A), R = resistance (ohms, Ω).",
          analogy: "Water in a pipe: voltage = water pressure, current = flow rate, resistance = pipe narrowness. Higher pressure (V) = more flow (I). Narrower pipe (R) = less flow.",
          examTip: "V = IR triangle: cover what you want. Rearrange to I = V/R or R = V/I. Power: P = IV = I²R = V²/R. An ohmic conductor gives a straight line on a V-I graph. A filament bulb is non-ohmic (R increases with temperature).",
          facts: ["V = IR (Volts, Amps, Ohms)", "P = IV = I²R = V²/R", "Ohmic: straight V-I graph", "Series: R_total = R₁+R₂; Parallel: 1/R_T = 1/R₁+1/R₂"],
          animation: 'ohms_law',
        },
        {
          id: 'series_parallel',
          title: 'Series & Parallel Circuits',
          subtitle: 'Circuit configurations',
          color: '#ef4444',
          equation: 'Series: I same; Parallel: V same',
          description: "Series circuit: components connected end-to-end in a single loop. Same current everywhere. Voltages add up. If one component fails, all fail. Parallel circuit: components connected across the same two points. Same voltage everywhere. Currents add up. Independent paths — one fails, others work.",
          analogy: "Series = one road — all cars go through one route. Parallel = a motorway with multiple lanes — traffic splits and each lane carries some cars.",
          examTip: "Series: V_total = V₁+V₂, I = same, R_total = R₁+R₂. Parallel: I_total = I₁+I₂, V = same, 1/R_T = 1/R₁+1/R₂. Household wiring is parallel — each device gets the full mains voltage.",
          facts: ["Series: current same throughout", "Parallel: voltage same throughout", "Household circuits: parallel", "Parallel: adding more components decreases total resistance"],
          animation: 'series_parallel',
        },
        {
          id: 'electric_field',
          title: 'Electric Fields & Charge',
          subtitle: 'Coulomb\'s Law',
          color: '#8b5cf6',
          equation: "F = kQ₁Q₂/r²",
          description: "An electric field is a region where a charged particle experiences a force. Like charges repel; unlike charges attract. The strength of the electric force depends on the magnitude of the charges and the distance between them (Coulomb's Law).",
          analogy: "A magnetic field is similar — invisible lines of force that can attract or repel. A positive charge is like a person pushing everyone away; a negative charge is like someone pulling everyone in.",
          examTip: "Electric field lines go from positive (+) to negative (−). Closer lines = stronger field. E = F/q (field strength = force per unit charge). Units: N/C or V/m. Between parallel plates: E = V/d.",
          facts: ["Like charges repel; unlike attract", "F = kQ₁Q₂/r² (Coulomb's Law)", "E = F/q (N/C)", "Field lines: + to −, never cross"],
          animation: 'electric_field',
        },
      ],
    },

    energy: {
      id: 'energy', label: 'Energy', icon: '🔋',
      color: '#22c55e', dark: '#4ade80',
      subtopics: [
        {
          id: 'ke_pe',
          title: 'Kinetic & Potential Energy',
          subtitle: 'Mechanical energy forms',
          color: '#22c55e',
          equation: 'KE = ½mv²,  GPE = mgh',
          description: "Kinetic energy (KE) is the energy an object has due to its motion. Gravitational potential energy (GPE) is energy stored due to position in a gravitational field. In a closed system, mechanical energy is conserved — KE and GPE convert into each other.",
          analogy: "A roller coaster: at the top of a hill, all GPE and no KE. At the bottom, all KE and no GPE (ignoring friction). The total energy stays the same.",
          examTip: "KE = ½mv². GPE = mgh (g = 9.8 or 10 m/s² depending on question). Conservation: KE gained = GPE lost (no friction). ½mv² = mgh → v = √(2gh). This is used in projectile, pendulum, and roller-coaster problems.",
          facts: ["KE = ½mv² (Joules)", "GPE = mgh (Joules)", "Mechanical energy = KE + GPE", "Conserved when no friction/air resistance"],
          animation: 'ke_pe',
        },
        {
          id: 'work_power',
          title: 'Work, Power & Efficiency',
          subtitle: 'Energy in action',
          color: '#f97316',
          equation: 'W = Fs,  P = W/t,  Eff = P_out/P_in',
          description: "Work is done when a force moves an object through a distance in the direction of the force. Power is the rate of doing work (or transferring energy). Efficiency measures how much of the input energy is usefully transferred — no machine is 100% efficient.",
          analogy: "Work = how much you've done. Power = how fast you do it. A 100W bulb uses energy twice as fast as a 50W bulb. An efficient car converts more petrol energy into motion, less into heat.",
          examTip: "W = Fs (F in N, s in m, W in J). P = W/t = Fv (watts, W). Efficiency = useful output energy/total input energy × 100%. Energy wasted is usually as heat or sound. Sankey diagrams show energy transfers.",
          facts: ["W = Fs (Joules)", "P = W/t (Watts)", "Efficiency = (useful output / total input) × 100%", "1 W = 1 J/s"],
          animation: 'work_power',
        },
        {
          id: 'energy_transfer',
          title: 'Energy Transfer & Conservation',
          subtitle: 'The big law of physics',
          color: '#0ea5e9',
          equation: 'Energy cannot be created or destroyed',
          description: "The law of conservation of energy: energy cannot be created or destroyed, only converted from one form to another. Energy forms include: kinetic, gravitational potential, elastic potential, thermal, chemical, electrical, nuclear, light, and sound.",
          analogy: "Energy is like money — you can transfer it between accounts, but the total amount in the system never changes. Burning petrol converts chemical energy to kinetic, thermal, and sound energy.",
          examTip: "Sankey diagram: wider arrow = more energy. The arrow splits into useful output and wasted (usually heat). Total width must be conserved. Common energy chains: chemical → kinetic → electrical → light.",
          facts: ["Energy is always conserved", "8 main forms of energy", "Thermal (heat) is the most common 'wasted' form", "Sankey diagrams show transfers visually"],
          animation: 'energy_transfer',
        },
      ],
    },
  };

  /* ══════════════════════════════════════════════════
     QUIZ DATA
  ══════════════════════════════════════════════════ */

  const QUIZ_QUESTIONS = [
    { q: "A 5 kg object accelerates at 3 m/s². What is the net force?", a: "15 N", options: ["8 N", "15 N", "1.67 N", "35 N"], explain: "F = ma = 5 × 3 = 15 N" },
    { q: "What is the momentum of a 2 kg ball moving at 10 m/s?", a: "20 kg·m/s", options: ["5 kg·m/s", "12 kg·m/s", "20 kg·m/s", "8 kg·m/s"], explain: "p = mv = 2 × 10 = 20 kg·m/s" },
    { q: "Which type of wave requires NO medium to travel?", a: "Electromagnetic", options: ["Sound", "Seismic", "Electromagnetic", "Water waves"], explain: "Electromagnetic waves (light, radio, X-rays) travel through a vacuum — no medium needed." },
    { q: "A circuit has V = 12 V and R = 4 Ω. What is the current?", a: "3 A", options: ["48 A", "3 A", "8 A", "0.33 A"], explain: "I = V/R = 12/4 = 3 A (Ohm's Law)" },
    { q: "KE = ½mv². What is the KE of a 4 kg object moving at 6 m/s?", a: "72 J", options: ["48 J", "12 J", "72 J", "144 J"], explain: "KE = ½ × 4 × 6² = ½ × 4 × 36 = 72 J" },
    { q: "Newton's First Law is also known as the Law of...", a: "Inertia", options: ["Gravity", "Action-Reaction", "Inertia", "Momentum"], explain: "Newton's First Law (inertia): objects resist changes to their state of motion unless acted on by an unbalanced force." },
    { q: "In a parallel circuit with R₁=6Ω and R₂=3Ω, what is the total resistance?", a: "2 Ω", options: ["9 Ω", "4.5 Ω", "2 Ω", "18 Ω"], explain: "1/R_T = 1/6 + 1/3 = 1/6 + 2/6 = 3/6 = 1/2, so R_T = 2 Ω" },
    { q: "GPE = mgh. What is the GPE of a 3 kg object at height 5 m? (g=10)", a: "150 J", options: ["15 J", "150 J", "50 J", "30 J"], explain: "GPE = mgh = 3 × 10 × 5 = 150 J" },
    { q: "Which quantity is preserved in an elastic collision?", a: "Both momentum and KE", options: ["Momentum only", "KE only", "Both momentum and KE", "Neither"], explain: "Elastic collision: both momentum AND kinetic energy are conserved. Inelastic: only momentum conserved." },
    { q: "A wave has frequency 200 Hz and wavelength 1.5 m. What is its speed?", a: "300 m/s", options: ["133 m/s", "201.5 m/s", "300 m/s", "298.5 m/s"], explain: "v = fλ = 200 × 1.5 = 300 m/s" },
    { q: "Power = Work / Time. If 600 J is done in 3 s, what is the power?", a: "200 W", options: ["1800 W", "200 W", "300 W", "100 W"], explain: "P = W/t = 600/3 = 200 W" },
    { q: "In a transverse wave, particles oscillate...", a: "Perpendicular to wave travel", options: ["Parallel to wave travel", "In circular paths", "Perpendicular to wave travel", "Randomly"], explain: "Transverse waves: particle motion is at 90° (perpendicular) to the direction of wave propagation." },
    { q: "What is the unit of electric charge?", a: "Coulomb (C)", options: ["Ampere (A)", "Volt (V)", "Coulomb (C)", "Ohm (Ω)"], explain: "The SI unit of electric charge is the Coulomb (C). Current (A) = charge flow rate = Q/t." },
    { q: "Work = Force × Distance. A 20 N force moves an object 3 m. Work done?", a: "60 J", options: ["60 J", "23 J", "6.67 J", "17 J"], explain: "W = Fs = 20 × 3 = 60 J" },
    { q: "An efficiency of 75% means...", a: "25% energy is wasted", options: ["75% energy is wasted", "25% energy is wasted", "All energy is useful", "None of the above"], explain: "Efficiency 75% → 25% is wasted (as heat, sound, etc.). Only 75% of input energy does useful work." },
  ];

  /* ══════════════════════════════════════════════════
     MODULE STATE
  ══════════════════════════════════════════════════ */

  let _onBack       = null;
  let _activeTab    = 'forces';
  let _activeSubIdx = 0;
  let _animFrames   = {};    // key → requestAnimationFrame id
  let _animState    = {};    // per-animation data
  let _quizIdx      = 0;
  let _quizScore    = 0;
  let _quizAnswered = false;
  let _quizSelected = null;
  let _quizDone     = false;
  let _shuffledQuiz = [];

  /* ══════════════════════════════════════════════════
     OPEN
  ══════════════════════════════════════════════════ */

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
    _stopAllAnimations();
    _render();
  }

  /* ══════════════════════════════════════════════════
     MAIN RENDER
  ══════════════════════════════════════════════════ */

  function _render() {
    UI.mount(`
      <div id="phys-shell" style="
        display:flex;flex-direction:column;height:100dvh;
        background:var(--bg-page);overflow:hidden;font-family:var(--font);
      ">
        ${_buildTopBar()}
        ${_buildTabBar()}
        <div id="phys-content" style="flex:1 1 0;overflow:hidden;position:relative;">
          ${_buildContent()}
        </div>
      </div>
      <style>
        .phys-tab {
          font-size:.625rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
          padding:4px 10px;border-radius:99px;border:1.5px solid var(--border);
          background:var(--bg-subtle);color:var(--text-3);cursor:pointer;
          white-space:nowrap;font-family:var(--font);flex-shrink:0;
          transition:all .12s ease;
        }
        .phys-tab.active { background:var(--accent);color:#fff;border-color:var(--accent); }
        .phys-sub-btn {
          text-align:left;width:100%;padding:.5rem .75rem;border-radius:var(--r-lg);
          border:2px solid var(--border);background:var(--bg-base);color:var(--text-2);
          font-family:var(--font);font-size:var(--text-xs);font-weight:600;
          cursor:pointer;transition:all .12s;display:flex;align-items:center;gap:.5rem;
        }
        .phys-sub-btn.active { border-color:var(--accent);background:var(--accent-subtle);color:var(--accent-text); }
        .phys-sub-btn:hover:not(.active) { border-color:var(--border-strong);background:var(--bg-subtle); }
        .phys-quiz-opt {
          display:block;width:100%;text-align:left;padding:.625rem 1rem;
          border-radius:var(--r-lg);border:2px solid var(--border);
          background:var(--bg-base);color:var(--text-1);
          font-family:var(--font);font-size:var(--text-sm);font-weight:500;
          cursor:pointer;margin-bottom:.5rem;transition:all .12s;
        }
        .phys-quiz-opt:hover:not(:disabled) { border-color:var(--accent);background:var(--accent-subtle); }
        .phys-quiz-opt.correct { background:#d1fae5;border-color:#22c55e;color:#14532d; }
        .phys-quiz-opt.wrong   { background:#ffe4e6;border-color:#ef4444;color:#9f1239; }
        [data-theme="dark"] .phys-quiz-opt.correct { background:#052e16;border-color:#22c55e;color:#4ade80; }
        [data-theme="dark"] .phys-quiz-opt.wrong   { background:#4c0519;border-color:#ef4444;color:#fda4af; }
        .phys-step-btn {
          padding:.375rem .875rem;border-radius:var(--r-md);font-size:var(--text-sm);
          font-weight:600;border:1px solid var(--border);background:var(--bg-subtle);
          color:var(--text-2);cursor:pointer;font-family:var(--font);transition:all .12s;
        }
        .phys-step-btn.primary { background:var(--accent);color:#fff;border-color:var(--accent); }
        @keyframes phys-pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes phys-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes phys-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes phys-slide-in { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
      </style>`);

    // Start animations after DOM is ready
    requestAnimationFrame(() => {
      _launchAnimation();
    });
  }

  function _buildTopBar() {
    return `
      <div style="display:flex;align-items:center;gap:.5rem;padding:.45rem .875rem;
                  border-bottom:1px solid var(--border);background:var(--bg-base);
                  flex-shrink:0;min-height:2.75rem;">
        <button onclick="ThreeDPhysics._back()"
                style="display:inline-flex;align-items:center;font-size:var(--text-sm);
                       font-weight:500;color:var(--text-2);background:var(--bg-subtle);
                       border:1px solid var(--border);border-radius:var(--r-md);
                       padding:.275rem .6rem;cursor:pointer;font-family:var(--font);flex-shrink:0;">← Back</button>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--text-base);font-weight:700;color:var(--text-1);
                      letter-spacing:-.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ⚛️ Physics — Forces, Waves & Energy
          </div>
        </div>
      </div>`;
  }

  function _buildTabBar() {
    const tabs = [
      { id:'forces',      icon:'🚀', label:'Forces' },
      { id:'waves',       icon:'〰️', label:'Waves' },
      { id:'electricity', icon:'⚡', label:'Electric' },
      { id:'energy',      icon:'🔋', label:'Energy' },
      { id:'quiz',        icon:'🧮', label:'Quiz' },
    ];
    return `
      <div style="flex-shrink:0;display:flex;align-items:center;gap:.375rem;
                  padding:.35rem .875rem;border-bottom:1px solid var(--border);
                  overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;
                  background:var(--bg-base);">
        ${tabs.map(t => `
          <button class="phys-tab${_activeTab === t.id ? ' active' : ''}"
                  onclick="ThreeDPhysics._setTab('${t.id}')">
            ${t.icon} ${t.label}
          </button>`).join('')}
      </div>`;
  }

  function _buildContent() {
    if (_activeTab === 'quiz') return _buildQuizView();
    const group = TOPICS[_activeTab];
    if (!group) return '';
    return _buildTopicView(group);
  }

  /* ══════════════════════════════════════════════════
     TOPIC VIEW (Forces / Waves / Electricity / Energy)
  ══════════════════════════════════════════════════ */

  function _buildTopicView(group) {
    const sub = group.subtopics[_activeSubIdx] || group.subtopics[0];
    return `
      <div style="display:flex;height:100%;overflow:hidden;">

        <!-- LEFT: subtopic list -->
        <div style="width:150px;flex-shrink:0;overflow-y:auto;border-right:1px solid var(--border);
                    background:var(--bg-base);padding:.5rem .4rem;scrollbar-width:thin;">
          <div style="font-size:.5rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase;
                      color:var(--text-4);margin-bottom:.4rem;padding:0 .25rem;">Topics</div>
          ${group.subtopics.map((s, i) => `
            <button class="phys-sub-btn${i === _activeSubIdx ? ' active' : ''}"
                    onclick="ThreeDPhysics._setSub(${i})">
              <span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:${s.color};"></span>
              <span style="line-height:1.35;">${s.title}</span>
            </button>`).join('')}
        </div>

        <!-- RIGHT: detail + animation -->
        <div style="flex:1 1 0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;">
          <div style="padding:.75rem;max-width:700px;margin:0 auto;animation:phys-slide-in .3s ease;">

            <!-- Header -->
            <div style="margin-bottom:.75rem;padding:.875rem 1rem;border-radius:var(--r-xl);
                        background:${sub.color}14;border:1.5px solid ${sub.color}44;">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;">
                <div>
                  <div style="font-size:var(--text-md);font-weight:800;color:var(--text-1);
                              letter-spacing:-.02em;margin-bottom:2px;">${sub.title}</div>
                  <div style="font-size:.6rem;font-weight:600;color:${sub.color};
                              text-transform:uppercase;letter-spacing:.05em;">${sub.subtitle}</div>
                </div>
                <div style="background:${sub.color};color:#fff;border-radius:var(--r-md);
                            padding:.25rem .625rem;font-family:monospace;font-size:.75rem;
                            font-weight:700;white-space:nowrap;flex-shrink:0;
                            box-shadow:0 2px 8px ${sub.color}55;">
                  ${sub.equation}
                </div>
              </div>
            </div>

            <!-- ANIMATION CANVAS -->
            <div id="phys-anim-container" style="
              margin-bottom:.75rem;border-radius:var(--r-xl);
              background:var(--bg-subtle);border:1px solid var(--border);
              overflow:hidden;position:relative;min-height:170px;">
              <canvas id="phys-canvas" style="display:block;width:100%;height:170px;"></canvas>
              <div id="phys-anim-label" style="
                position:absolute;bottom:.5rem;right:.625rem;
                font-size:.5rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
                color:var(--text-4);pointer-events:none;"></div>
            </div>

            <!-- Description -->
            <div style="margin-bottom:.625rem;border-left:3px solid ${sub.color};
                        padding:.5rem .75rem;background:var(--bg-base);border-radius:0 var(--r-md) var(--r-md) 0;">
              <p style="font-size:var(--text-sm);color:var(--text-2);line-height:1.7;margin:0;">${sub.description}</p>
            </div>

            <!-- Analogy -->
            <div style="margin-bottom:.625rem;padding:.5rem .75rem;border-radius:var(--r-lg);
                        background:${sub.color}0d;border:1px solid ${sub.color}30;">
              <div style="font-size:.5rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
                          color:${sub.color};margin-bottom:.2rem;">💡 Real-World Analogy</div>
              <p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.55;margin:0;font-style:italic;">${sub.analogy}</p>
            </div>

            <!-- Key Facts -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem;margin-bottom:.625rem;">
              ${sub.facts.map(f => `
                <div style="background:var(--bg-subtle);border:1px solid var(--border);
                            border-radius:var(--r-sm);padding:.3rem .5rem;
                            font-size:.575rem;color:var(--text-2);line-height:1.45;">
                  ● ${f}
                </div>`).join('')}
            </div>

            <!-- Exam Tip -->
            <div style="padding:.625rem .875rem;border-radius:var(--r-lg);
                        background:var(--warning-subtle);border:1px solid var(--warning-border);">
              <div style="font-size:.5rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
                          color:var(--warning);margin-bottom:.25rem;">📝 Exam Tip</div>
              <p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.6;margin:0;">${sub.examTip}</p>
            </div>

            <!-- Nav buttons -->
            <div style="display:flex;gap:.5rem;justify-content:space-between;margin-top:.75rem;padding-bottom:.75rem;">
              <button class="phys-step-btn" onclick="ThreeDPhysics._prevSub()"
                      ${_activeSubIdx === 0 ? 'disabled style="opacity:.4;cursor:not-allowed;"' : ''}>
                ← Previous
              </button>
              <span style="font-size:var(--text-xs);color:var(--text-4);line-height:2.2;">
                ${_activeSubIdx+1} / ${group.subtopics.length}
              </span>
              <button class="phys-step-btn primary" onclick="ThreeDPhysics._nextSub()">
                ${_activeSubIdx < group.subtopics.length - 1 ? 'Next →' : 'Done ✓'}
              </button>
            </div>

          </div>
        </div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════
     ANIMATION ENGINE
  ══════════════════════════════════════════════════ */

  function _stopAllAnimations() {
    Object.values(_animFrames).forEach(id => cancelAnimationFrame(id));
    _animFrames = {};
    _animState  = {};
  }

  function _launchAnimation() {
    _stopAllAnimations();
    if (_activeTab === 'quiz') return;

    const canvas = document.getElementById('phys-canvas');
    if (!canvas) return;

    const container = document.getElementById('phys-anim-container');
    const W = container ? container.offsetWidth : 400;
    canvas.width  = W * window.devicePixelRatio;
    canvas.height = 170 * window.devicePixelRatio;
    canvas.style.width  = W + 'px';
    canvas.style.height = '170px';
    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const group = TOPICS[_activeTab];
    if (!group) return;
    const sub = group.subtopics[_activeSubIdx];
    if (!sub) return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    _animState[sub.id] = { t: 0, W, H: 170, ctx, isDark, color: sub.color };

    const animFns = {
      newton1:             _animNewton1,
      newton2:             _animNewton2,
      newton3:             _animNewton3,
      friction:            _animFriction,
      momentum:            _animMomentum,
      transverse:          _animTransverse,
      longitudinal:        _animLongitudinal,
      em_spectrum:         _animEMSpectrum,
      reflection_refraction: _animReflection,
      ohms_law:            _animOhmsLaw,
      series_parallel:     _animSeriesParallel,
      electric_field:      _animElectricField,
      ke_pe:               _animKEPE,
      work_power:          _animWorkPower,
      energy_transfer:     _animEnergyTransfer,
    };

    const fn = animFns[sub.id];
    if (!fn) return;

    function loop() {
      if (!document.getElementById('phys-canvas')) { _stopAllAnimations(); return; }
      _animState[sub.id].t += 0.016;
      fn(_animState[sub.id]);
      _animFrames[sub.id] = requestAnimationFrame(loop);
    }
    _animFrames[sub.id] = requestAnimationFrame(loop);
  }

  /* ── Drawing helpers ── */
  function _clr(isDark, lightClr, darkClr) { return isDark ? darkClr : lightClr; }
  function _bg(isDark) { return isDark ? '#1a1a2e' : '#f8fafc'; }
  function _txt(isDark) { return isDark ? '#e2e8f0' : '#1e293b'; }
  function _grid(isDark) { return isDark ? '#334155' : '#e2e8f0'; }

  function _clearCanvas(s) {
    const { ctx, W, H, isDark } = s;
    ctx.fillStyle = _bg(isDark);
    ctx.fillRect(0, 0, W, H);
    // Subtle grid
    ctx.strokeStyle = _grid(isDark);
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  }

  function _drawArrow(ctx, x1, y1, x2, y2, color, width, label) {
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = width || 2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 10;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
    ctx.closePath(); ctx.fill();
    if (label) {
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const mx = (x1+x2)/2, my = (y1+y2)/2;
      const ox = -(y2-y1)*0.0008 * 50 * (Math.abs(y2-y1) < 5 ? 1 : 0);
      const oy = (y2-y1 > 5 || y1 === y2) ? -14 : 12;
      ctx.fillText(label, mx + ox, my + oy);
    }
    ctx.restore();
  }

  function _drawBox(ctx, x, y, w, h, fill, stroke, r) {
    ctx.save();
    r = r || 6;
    ctx.beginPath();
    ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
    ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore();
  }

  function _label(ctx, text, x, y, color, size, align) {
    ctx.save();
    ctx.fillStyle = color; ctx.font = `bold ${size||11}px var(--font, sans-serif)`;
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y); ctx.restore();
  }

  /* ══════════════════════════════════════════════════
     INDIVIDUAL ANIMATION FUNCTIONS
  ══════════════════════════════════════════════════ */

  /* ── Newton 1: Object at rest vs object in motion ── */
  function _animNewton1(s) {
    const { ctx, W, H, isDark, t } = s;
    _clearCanvas(s);

    // Scene divider
    ctx.strokeStyle = _grid(isDark); ctx.lineWidth = 1; ctx.setLineDash([6,4]);
    ctx.beginPath(); ctx.moveTo(W/2, 20); ctx.lineTo(W/2, H-20); ctx.stroke();
    ctx.setLineDash([]);

    // --- LEFT: At rest (balanced forces) ---
    const lx = W/4, by = H - 40;
    // Ground
    ctx.fillStyle = _clr(isDark,'#94a3b8','#475569');
    ctx.fillRect(20, by+28, W/2-40, 5);
    // Box
    _drawBox(ctx, lx-20, by-20, 40, 40, _clr(isDark,'#dbeafe','#1e3a8a'), '#3b82f6');
    _label(ctx, 'm', lx, by, _txt(isDark), 12);
    // Forces: gravity down, normal up — equal, so balanced
    const bounce = Math.sin(t*2) * 0; // static — no bounce
    _drawArrow(ctx, lx, by-20, lx, by-20-35, '#ef4444', 2, 'N');
    _drawArrow(ctx, lx, by+20, lx, by+20+35, '#ef4444', 2, 'W');
    _label(ctx, 'F_net = 0', lx, by-65, '#10b981', 10);
    _label(ctx, 'At Rest', lx, H-18, _txt(isDark), 10);

    // --- RIGHT: In motion (no net force → constant velocity) ---
    const rx = W/2 + W/4;
    const bx = W/2 + 30 + ((t * 35) % (W/2 - 60)); // scrolling object
    const bxWrapped = W/2 + 30 + ((t * 35) % (W/2 - 60));
    _drawBox(ctx, bxWrapped - 18, by - 18, 36, 36, _clr(isDark,'#dcfce7','#052e16'), '#22c55e');
    _label(ctx, 'm', bxWrapped, by, _txt(isDark), 12);
    // velocity arrow
    _drawArrow(ctx, bxWrapped+18, by, bxWrapped+50, by, '#f97316', 2.5, 'v');
    // Ground
    ctx.fillStyle = _clr(isDark,'#94a3b8','#475569');
    ctx.fillRect(W/2+5, by+28, W/2-25, 5);
    // Motion lines
    for (let i = 1; i <= 3; i++) {
      ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1; ctx.globalAlpha = 0.4 - i*0.1;
      ctx.beginPath();
      ctx.moveTo(bxWrapped - 22 - i*10, by - 8);
      ctx.lineTo(bxWrapped - 18 - i*10, by + 8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    _label(ctx, 'Constant v (no F_net)', rx, H-18, _txt(isDark), 10);

    // Labels
    _label(ctx, 'INERTIA — Law 1', W/2, 14, _txt(isDark), 11);
  }

  /* ── Newton 2: F=ma — bigger force → bigger acceleration ── */
  function _animNewton2(s) {
    const { ctx, W, H, isDark, t } = s;
    _clearCanvas(s);

    const by = H - 38;
    ctx.fillStyle = _clr(isDark,'#94a3b8','#475569');
    ctx.fillRect(20, by+28, W-40, 4);

    // Two boxes: same mass, different force
    const box1x = 40 + (t * 25) % (W/2 - 80);
    const box2x = W/2 + 20 + (t * 50) % (W/2 - 60);

    // Box 1: small force
    _drawBox(ctx, box1x, by-20, 36, 36, _clr(isDark,'#dbeafe','#1e3a8a'), '#3b82f6');
    _label(ctx, '2kg', box1x+18, by, _txt(isDark), 9);
    _drawArrow(ctx, box1x+36, by, box1x+36+30, by, '#f97316', 2, '10N');
    // Motion lines
    for (let i=1;i<=2;i++) {
      ctx.strokeStyle='#f97316';ctx.lineWidth=1;ctx.globalAlpha=0.3;
      ctx.beginPath();ctx.moveTo(box1x-i*9,by-6);ctx.lineTo(box1x-i*9+4,by+6);ctx.stroke();
    }
    ctx.globalAlpha=1;
    _label(ctx, 'a = 5 m/s²', box1x+18, by+40, '#f97316', 9);

    // Box 2: large force
    _drawBox(ctx, box2x, by-20, 36, 36, _clr(isDark,'#fef3c7','#451a03'), '#f59e0b');
    _label(ctx, '2kg', box2x+18, by, _txt(isDark), 9);
    _drawArrow(ctx, box2x+36, by, box2x+36+55, by, '#ef4444', 3, '20N');
    for (let i=1;i<=4;i++) {
      ctx.strokeStyle='#ef4444';ctx.lineWidth=1.5;ctx.globalAlpha=0.35;
      ctx.beginPath();ctx.moveTo(box2x-i*7,by-7);ctx.lineTo(box2x-i*7+4,by+7);ctx.stroke();
    }
    ctx.globalAlpha=1;
    _label(ctx, 'a = 10 m/s²', box2x+18, by+40, '#ef4444', 9);

    // Equation banner
    ctx.fillStyle = _clr(isDark,'rgba(99,102,241,0.12)','rgba(99,102,241,0.3)');
    ctx.fillRect(W/2-70, 8, 140, 22);
    _label(ctx, 'F = ma  →  more F = more a', W/2, 20, _clr(isDark,'#4f46e5','#a5b4fc'), 10);
  }

  /* ── Newton 3: Action-reaction pair (rocket) ── */
  function _animNewton3(s) {
    const { ctx, W, H, isDark, t } = s;
    _clearCanvas(s);

    const cx = W/2, cy = H/2 - 5;

    // Rocket body
    const rocketY = cy - Math.sin(t*1.5) * 8;
    ctx.save();
    ctx.translate(cx, rocketY);
    // Body
    _drawBox(ctx, -15, -30, 30, 40, _clr(isDark,'#e0e7ff','#312e81'), '#6366f1', 5);
    // Nose cone
    ctx.fillStyle = '#6366f1';
    ctx.beginPath(); ctx.moveTo(0,-30); ctx.lineTo(-12,-30); ctx.lineTo(12,-30); ctx.closePath(); ctx.fill();
    // Nose tip
    ctx.beginPath(); ctx.moveTo(0,-48); ctx.lineTo(-12,-30); ctx.lineTo(12,-30); ctx.closePath();
    ctx.fillStyle = '#818cf8'; ctx.fill();
    // Flame plume
    const flameSize = 15 + Math.sin(t * 12) * 6;
    const grad = ctx.createRadialGradient(0, 15, 0, 0, 15+flameSize, flameSize);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.3, '#fbbf24');
    grad.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(0, 15+flameSize/2, 8+Math.sin(t*8)*2, flameSize, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // Action arrow (thrust DOWN)
    _drawArrow(ctx, cx, rocketY+15, cx, rocketY+75, '#ef4444', 3, '');
    _label(ctx, 'REACTION', cx+50, rocketY+45, '#ef4444', 10);
    _label(ctx, '(gas pushed down)', cx+50, rocketY+57, _txt(isDark), 9);

    // Reaction arrow (rocket goes UP)
    _drawArrow(ctx, cx, rocketY-30, cx, rocketY-75, '#22c55e', 3, '');
    _label(ctx, 'ACTION', cx-55, rocketY-55, '#22c55e', 10);
    _label(ctx, '(rocket pushed up)', cx-55, rocketY-67, _txt(isDark), 9);

    _label(ctx, "Newton's 3rd Law: F_action = −F_reaction", W/2, H-12, _txt(isDark), 10);
  }

  /* ── Friction: box sliding on surface ── */
  function _animFriction(s) {
    const { ctx, W, H, isDark, t } = s;
    _clearCanvas(s);

    const by = H/2 + 20;
    const bx = 60 + (t * 20) % (W - 130);

    // Rough surface (hatching)
    ctx.fillStyle = _clr(isDark,'#94a3b8','#374151');
    ctx.fillRect(30, by+25, W-60, 10);
    for (let x = 35; x < W-35; x += 12) {
      ctx.strokeStyle = _clr(isDark,'#64748b','#1f2937');
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, by+25); ctx.lineTo(x+8, by+35); ctx.stroke();
    }

    // Box
    _drawBox(ctx, bx-22, by-22, 44, 44, _clr(isDark,'#fef3c7','#451a03'), '#f59e0b');
    _label(ctx, 'm', bx, by, _txt(isDark), 12);

    // Applied force (right)
    _drawArrow(ctx, bx+22, by, bx+70, by, '#22c55e', 2.5, 'F_applied');

    // Friction force (left — opposing motion)
    const frictionPulse = 0.85 + Math.sin(t*8)*0.15;
    ctx.globalAlpha = frictionPulse;
    _drawArrow(ctx, bx-22, by, bx-70, by, '#ef4444', 2.5, 'f = μN');
    ctx.globalAlpha = 1;

    // Weight arrow (down)
    _drawArrow(ctx, bx, by+22, bx, by+55, '#6366f1', 2, 'W=mg');
    // Normal arrow (up)
    _drawArrow(ctx, bx, by-22, bx, by-55, '#6366f1', 2, 'N');

    // μ label
    _label(ctx, 'f = μN  (μ = coefficient of friction)', W/2, H-15, _txt(isDark), 10);
    _label(ctx, 'μₛ (static) > μₖ (kinetic)', W/2, H-4, _clr(isDark,'#f59e0b','#fbbf24'), 10);
  }

  /* ── Momentum: two balls collide ── */
  function _animMomentum(s) {
    const { ctx, W, H, isDark, t } = s;
    _clearCanvas(s);

    const cy = H/2;
    const period = 3.5;
    const phase = (t % period) / period;

    // Ball 1 (heavier, blue)
    const b1r = 20;
    let b1x, b2x, b2r = 14;
    const startX1 = 60, startX2 = W - 60;
    const collisionX = W/2;

    if (phase < 0.45) {
      // Approaching
      b1x = startX1 + (collisionX - startX1 - b1r - b2r) * (phase / 0.45);
      b2x = startX2 - (startX2 - collisionX - b1r - b2r) * 0;
      b2x = startX2;
      // Arrow on b1
      _drawArrow(ctx, b1x+b1r, cy, b1x+b1r+40, cy, '#3b82f6', 2.5, 'p₁=mv₁');
    } else if (phase < 0.55) {
      // Collision flash
      b1x = collisionX - b1r;
      b2x = collisionX + b2r;
      // Impact burst
      const flashAlpha = 1 - (phase - 0.45) / 0.1;
      ctx.globalAlpha = flashAlpha;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(collisionX, cy, 30, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      _label(ctx, 'COLLISION!', W/2, cy - 45, '#f97316', 12);
    } else {
      // After: b1 slows, b2 moves right
      const pp = (phase - 0.55) / 0.45;
      b1x = collisionX - b1r + pp * 20; // b1 slows
      b2x = collisionX + b2r + pp * (W - collisionX - b2r - 70);
      _drawArrow(ctx, b1x+b1r, cy, b1x+b1r+20, cy, '#3b82f6', 2, 'p₁\'');
      _drawArrow(ctx, b2x+b2r, cy, b2x+b2r+50, cy, '#ef4444', 2.5, 'p₂\'');
    }

    // Draw balls
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.arc(b1x, cy, b1r, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2; ctx.stroke();
    _label(ctx, '4kg', b1x, cy, '#fff', 10);

    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(b2x, cy, b2r, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 2; ctx.stroke();
    _label(ctx, '2kg', b2x, cy, '#fff', 9);

    _label(ctx, 'Conservation: p_total = p₁+p₂ = constant', W/2, H-12, _txt(isDark), 10);
  }

  /* ── Transverse wave — sine wave with particle markers ── */
  function _animTransverse(s) {
    const { ctx, W, H, isDark, t, color } = s;
    _clearCanvas(s);

    const cy = H/2;
    const A = 40, λ = 80, speed = 60;

    // Draw wave path
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    for (let x = 0; x <= W; x++) {
      const y = cy + A * Math.sin((2*Math.PI/λ) * (x - speed*t));
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Particle dots (oscillate perpendicular to travel)
    for (let x = 20; x < W; x += λ/4) {
      const y = cy + A * Math.sin((2*Math.PI/λ) * (x - speed*t));
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2); ctx.fill();
      // Vertical oscillation arrow for one particle
      if (Math.abs(x - W/3) < λ/8) {
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, cy-A-8); ctx.lineTo(x, cy+A+8); ctx.stroke();
        _label(ctx, '↕ particle', x+14, cy, '#ef4444', 9);
      }
    }

    // Direction of travel arrow
    _drawArrow(ctx, W-80, 15, W-20, 15, '#22c55e', 2, 'wave');

    // Labels
    _label(ctx, 'A', W-20, cy-A-5, _txt(isDark), 10);
    ctx.strokeStyle = _txt(isDark); ctx.lineWidth = 1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(0,cy); ctx.lineTo(W,cy); ctx.stroke();
    ctx.setLineDash([]);

    // Wavelength bracket
    const wx = 60;
    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(wx, cy+A+18); ctx.lineTo(wx+λ, cy+A+18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx, cy+A+13); ctx.lineTo(wx, cy+A+23); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx+λ, cy+A+13); ctx.lineTo(wx+λ, cy+A+23); ctx.stroke();
    _label(ctx, 'λ (wavelength)', wx+λ/2, cy+A+30, '#f97316', 9);

    _label(ctx, 'TRANSVERSE  v = fλ', W/2, H-10, _txt(isDark), 10);
  }

  /* ── Longitudinal wave — compressions and rarefactions ── */
  function _animLongitudinal(s) {
    const { ctx, W, H, isDark, t, color } = s;
    _clearCanvas(s);

    const cy = H/2;
    const nParticles = 28;
    const spacing = W / (nParticles + 1);
    const A = 12, λ = 90, speed = 55;

    // Draw particles as circles displaced along x-axis
    for (let i = 1; i <= nParticles; i++) {
      const x0 = i * spacing;
      const displacement = A * Math.sin((2*Math.PI/λ) * (x0 - speed*t));
      const px = x0 + displacement;

      // Colour based on compression/rarefaction
      const density = Math.abs(displacement) < 3 ? 0.9 : 0.3;
      ctx.fillStyle = displacement < 0
        ? `rgba(239,68,68,${density})`    // compression
        : `rgba(96,165,250,${density})`;  // rarefaction
      ctx.beginPath(); ctx.arc(px, cy, 5, 0, Math.PI*2); ctx.fill();
    }

    // Compression label
    _label(ctx, 'Compression', W*0.22, cy-40, '#ef4444', 10);
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W*0.22, cy-30); ctx.lineTo(W*0.22, cy-14); ctx.stroke();

    _label(ctx, 'Rarefaction', W*0.72, cy-40, '#60a5fa', 10);
    ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W*0.72, cy-30); ctx.lineTo(W*0.72, cy-14); ctx.stroke();

    // Direction of travel (same as particle oscillation)
    _drawArrow(ctx, W*0.05, cy+50, W*0.35, cy+50, '#22c55e', 2.5, 'wave travels');
    _drawArrow(ctx, W*0.25, cy+70, W*0.45, cy+70, '#f97316', 1.5, 'particles oscillate ↔');

    _label(ctx, 'LONGITUDINAL  (Sound, P-waves)', W/2, H-10, _txt(isDark), 10);
  }

  /* ── EM Spectrum — animated spectrum bar with labels ── */
  function _animEMSpectrum(s) {
    const { ctx, W, H, isDark, t } = s;
    _clearCanvas(s);

    const bands = [
      { label:'Radio', color:'#6366f1', frac:0 },
      { label:'Micro\nwave', color:'#8b5cf6', frac:1 },
      { label:'Infrared', color:'#f97316', frac:2 },
      { label:'Visible', color:'#22c55e', frac:3 },
      { label:'UV', color:'#a855f7', frac:4 },
      { label:'X-ray', color:'#3b82f6', frac:5 },
      { label:'Gamma', color:'#ef4444', frac:6 },
    ];

    const barY = H/2 - 15, barH = 30;
    const bw = (W - 40) / bands.length;

    // Rainbow spectrum bar
    const grad = ctx.createLinearGradient(20, 0, W-20, 0);
    grad.addColorStop(0,    '#6366f1');
    grad.addColorStop(0.33, '#f97316');
    grad.addColorStop(0.5,  '#22c55e');
    grad.addColorStop(0.67, '#a855f7');
    grad.addColorStop(0.83, '#3b82f6');
    grad.addColorStop(1,    '#ef4444');
    ctx.fillStyle = grad;
    ctx.fillRect(20, barY, W-40, barH);

    // Band dividers and labels
    bands.forEach((b, i) => {
      const bx = 20 + i * bw;
      if (i > 0) {
        ctx.strokeStyle = _clr(isDark,'rgba(0,0,0,0.2)','rgba(255,255,255,0.2)');
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bx, barY); ctx.lineTo(bx, barY+barH); ctx.stroke();
      }
      // Pulsing highlight on "active" band cycling through
      const highlight = Math.floor(t / 0.8) % bands.length;
      if (highlight === i) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(bx, barY, bw, barH);
      }
      ctx.fillStyle = '#fff';
      ctx.font = `bold 8px sans-serif`;
      ctx.textAlign = 'center';
      const lx = bx + bw/2;
      b.label.split('\n').forEach((line, li) => {
        ctx.fillText(line, lx, barY + barH + 12 + li*11);
      });
    });

    // Frequency arrows
    _drawArrow(ctx, W-30, barY-25, 30, barY-25, '#94a3b8', 1.5, '');
    _label(ctx, '← Frequency increases', 30, barY-35, _txt(isDark), 9, 'left');
    _drawArrow(ctx, 30, barY-12, W-30, barY-12, '#94a3b8', 1.5, '');
    _label(ctx, 'Wavelength increases →', W-20, barY-22, _txt(isDark), 9, 'right');

    _label(ctx, 'All EM waves: c = 3×10⁸ m/s in vacuum', W/2, H-8, _txt(isDark), 10);
  }

  /* ── Reflection & Refraction ── */
  function _animReflection(s) {
    const { ctx, W, H, isDark, t } = s;
    _clearCanvas(s);

    const iy = H/2;  // interface y

    // Interface (boundary between media)
    ctx.fillStyle = _clr(isDark,'rgba(14,165,233,0.12)','rgba(14,165,233,0.18)');
    ctx.fillRect(0, iy, W, H - iy);
    ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, iy); ctx.lineTo(W, iy); ctx.stroke();

    // Labels
    _label(ctx, 'Medium 1 (n₁, faster)', W/2, iy-60, _clr(isDark,'#94a3b8','#475569'), 9);
    _label(ctx, 'Medium 2 (n₂, slower)', W/2, iy+20, '#0ea5e9', 9);

    // Normal line (dashed)
    const ix = W * 0.37;
    ctx.strokeStyle = _clr(isDark,'#94a3b8','#cbd5e1'); ctx.lineWidth = 1; ctx.setLineDash([5,5]);
    ctx.beginPath(); ctx.moveTo(ix, iy-75); ctx.lineTo(ix, iy+70); ctx.stroke();
    ctx.setLineDash([]);
    _label(ctx, 'Normal', ix+22, iy-62, _clr(isDark,'#94a3b8','#475569'), 9);

    // Incident ray (animated)
    const angle = 35 * Math.PI / 180;
    const len1 = 70;
    const incX = ix - len1 * Math.sin(angle);
    const incY = iy - len1 * Math.cos(angle);
    _drawArrow(ctx, incX, incY, ix, iy, '#f97316', 2.5, '');
    _label(ctx, 'θ₁=35°', ix-40, iy-28, '#f97316', 9);

    // Reflected ray
    const refX = ix + len1 * Math.sin(angle);
    const refY = iy - len1 * Math.cos(angle);
    _drawArrow(ctx, ix, iy, refX, refY, '#22c55e', 2, '');
    _label(ctx, 'θᵣ=35°', ix+22, iy-28, '#22c55e', 9);

    // Refracted ray (bends toward normal since slowing down)
    const refractAngle = 22 * Math.PI / 180; // smaller angle (bends toward normal)
    const len2 = 65;
    const refractX = ix + len2 * Math.sin(refractAngle);
    const refractY = iy + len2 * Math.cos(refractAngle);
    _drawArrow(ctx, ix, iy, refractX, refractY, '#a855f7', 2.5, '');
    _label(ctx, 'θ₂=22°', ix+32, iy+35, '#a855f7', 9);

    // RIGHT SIDE: TIR demo
    const tix = W * 0.72;
    ctx.fillStyle = _clr(isDark,'rgba(251,191,36,0.08)','rgba(251,191,36,0.12)');
    ctx.fillRect(tix-40, iy, 80, H-iy);
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(tix-40, iy); ctx.lineTo(tix+40, iy); ctx.stroke();
    // Bouncing ray above critical angle
    const phase2 = (t * 1.2) % 2;
    const tirY = iy - 20 - Math.abs(Math.sin(phase2 * Math.PI)) * 50;
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tix-30, tirY); ctx.lineTo(tix, iy-5); ctx.lineTo(tix+30, tirY); ctx.stroke();
    _label(ctx, 'TIR', tix, iy-60, '#fbbf24', 9);

    // Legend
    _label(ctx, '→ Incident  →Reflected  →Refracted  →TIR', W/2, H-10, _txt(isDark), 9);
  }

  /* ── Ohm's Law: animated current through resistor ── */
  function _animOhmsLaw(s) {
    const { ctx, W, H, isDark, t } = s;
    _clearCanvas(s);

    const cy = H/2;
    const wireY = cy + 10;
    const L = W - 60, startX = 30;

    // Battery (left)
    ctx.fillStyle = _clr(isDark,'#1e3a8a','#dbeafe');
    ctx.fillRect(startX, wireY-20, 20, 40);
    ctx.fillStyle = '#22c55e'; ctx.fillRect(startX+20, wireY-14, 6, 28);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(startX+26, wireY-8, 3, 16);
    _label(ctx, '+', startX+36, wireY-10, '#ef4444', 12);
    _label(ctx, '−', startX+36, wireY+10, '#22c55e', 12);
    _label(ctx, '12V', startX+10, wireY-30, '#fbbf24', 10);

    // Wires
    ctx.strokeStyle = _clr(isDark,'#94a3b8','#475569'); ctx.lineWidth = 3;
    // Top wire
    ctx.beginPath(); ctx.moveTo(startX+23, wireY-14); ctx.lineTo(startX+23, wireY-45);
    ctx.lineTo(W-40, wireY-45); ctx.lineTo(W-40, wireY-10); ctx.stroke();
    // Bottom wire
    ctx.beginPath(); ctx.moveTo(startX+23, wireY+14); ctx.lineTo(startX+23, wireY+45);
    ctx.lineTo(W-40, wireY+45); ctx.lineTo(W-40, wireY+10); ctx.stroke();

    // Resistor (zig-zag)
    const rx = W/2 - 30, rw = 60, rh = 16;
    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(rx, wireY-10);
    const zigPts = 6;
    for (let i = 0; i <= zigPts; i++) {
      const zx = rx + (i / zigPts) * rw;
      const zy = wireY - 10 + (i % 2 === 0 ? -rh/2 : rh/2);
      ctx.lineTo(zx, zy);
    }
    ctx.lineTo(rx+rw, wireY-10);
    ctx.stroke();
    _label(ctx, 'R = 4Ω', rx+rw/2, wireY-10-rh-8, '#f97316', 10);

    // Ammeter
    ctx.fillStyle = 'transparent'; ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W-60, wireY+45, 12, 0, Math.PI*2); ctx.stroke();
    _label(ctx, 'A', W-60, wireY+45, '#22c55e', 10);
    _label(ctx, 'I=3A', W-60, wireY+62, '#22c55e', 9);

    // Animated electrons (orange dots flowing)
    const nElectrons = 8;
    const pathLen = 2 * ((W - 70) + 90); // approximate perimeter
    for (let i = 0; i < nElectrons; i++) {
      const pos = ((t * 55 + i * (pathLen / nElectrons)) % pathLen);
      let ex, ey;
      const segA = W - 70;
      const segB = segA + 45;
      const segC = segB + (W - 70);
      const segD = segC + 45;
      if (pos < segA) { ex = startX+23 + pos; ey = wireY - 45; }
      else if (pos < segB) { ex = W-40; ey = wireY - 45 + (pos-segA); }
      else if (pos < segC) { ex = W-40 - (pos-segB); ey = wireY+45; }
      else { ex = startX+23; ey = wireY+45 - (pos-segC); }

      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#1e293b'; ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('e⁻', ex, ey);
    }

    _label(ctx, 'V = IR → 12 = 3 × 4', W/2, H-10, _txt(isDark), 10);
  }

  /* ── Series & Parallel circuits ── */
  function _animSeriesParallel(s) {
    const { ctx, W, H, isDark, t } = s;
    _clearCanvas(s);

    // --- LEFT: Series ---
    const lx = W * 0.22, sy = H/2;
    _label(ctx, 'SERIES', lx, 18, '#3b82f6', 11);
    _label(ctx, 'Same current, V adds', lx, 30, _clr(isDark,'#94a3b8','#475569'), 9);

    // Circuit outline
    const sw = 70, sh = 55;
    ctx.strokeStyle = _clr(isDark,'#94a3b8','#475569'); ctx.lineWidth = 2.5;
    ctx.strokeRect(lx - sw/2, sy - sh/2, sw, sh);

    // Two resistors in series (inline on top wire)
    const zig = (cx, cy2, w, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy2);
      for (let i = 0; i <= 4; i++) {
        ctx.lineTo(cx + i*w/4, cy2 + (i%2===0 ? -7 : 7));
      }
      ctx.lineTo(cx+w, cy2); ctx.stroke();
    };
    zig(lx-28, sy-sh/2, 24, '#f97316');
    zig(lx+4,  sy-sh/2, 24, '#f97316');
    _label(ctx, 'R₁', lx-16, sy-sh/2-14, '#f97316', 9);
    _label(ctx, 'R₂', lx+16, sy-sh/2-14, '#f97316', 9);

    // Battery on left wire
    ctx.fillStyle = '#22c55e'; ctx.fillRect(lx-sw/2-3, sy-10, 6, 20);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(lx-sw/2-1, sy-6, 2, 12);

    // Single current path (pulsing dots)
    const nSer = 4;
    for (let i = 0; i < nSer; i++) {
      const pos = ((t * 40 + i * (sw*2+sh*2)/nSer)) % (sw*2+sh*2);
      let dx, dy;
      const a = sw, b = a+sh, c = b+sw, d = c+sh;
      if (pos < a)      { dx = lx-sw/2+pos; dy = sy-sh/2; }
      else if (pos < b) { dx = lx+sw/2;     dy = sy-sh/2+(pos-a); }
      else if (pos < c) { dx = lx+sw/2-(pos-b); dy = sy+sh/2; }
      else              { dx = lx-sw/2;     dy = sy+sh/2-(pos-c); }
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath(); ctx.arc(dx, dy, 4, 0, Math.PI*2); ctx.fill();
    }
    _label(ctx, 'R_total = R₁+R₂', lx, H-12, '#3b82f6', 9);

    // Divider
    ctx.strokeStyle = _grid(isDark); ctx.lineWidth = 1; ctx.setLineDash([6,4]);
    ctx.beginPath(); ctx.moveTo(W/2, 10); ctx.lineTo(W/2, H-10); ctx.stroke();
    ctx.setLineDash([]);

    // --- RIGHT: Parallel ---
    const rx = W * 0.72, py = H/2;
    _label(ctx, 'PARALLEL', rx, 18, '#22c55e', 11);
    _label(ctx, 'Same voltage, I splits', rx, 30, _clr(isDark,'#94a3b8','#475569'), 9);

    const pw = 75, ph = 60;
    // Outer rectangle
    ctx.strokeStyle = _clr(isDark,'#94a3b8','#475569'); ctx.lineWidth = 2.5;
    ctx.strokeRect(rx-pw/2, py-ph/2, pw, ph);

    // Two parallel branches inside
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5;
    const mid1 = py - ph/6, mid2 = py + ph/6;
    ctx.beginPath(); ctx.moveTo(rx-pw/2+8, mid1); ctx.lineTo(rx+pw/2-8, mid1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx-pw/2+8, mid2); ctx.lineTo(rx+pw/2-8, mid2); ctx.stroke();

    zig(rx-8, mid1, 16, '#ef4444');
    zig(rx-8, mid2, 16, '#f97316');
    _label(ctx, 'R₁', rx+14, mid1, '#ef4444', 9);
    _label(ctx, 'R₂', rx+14, mid2, '#f97316', 9);

    // Battery
    ctx.fillStyle = '#22c55e'; ctx.fillRect(rx-pw/2-3, py-10, 6, 20);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(rx-pw/2-1, py-6, 2, 12);

    // Two current paths
    const nPar = 3;
    for (let bi = 0; bi < 2; bi++) {
      const bY = bi === 0 ? mid1 : mid2;
      for (let i = 0; i < nPar; i++) {
        const pos = ((t * 35 + i * pw/nPar + bi*7)) % (pw+ph*0.6);
        let dx, dy;
        if (pos < pw*0.45)          { dx = rx-pw/2+8+pos; dy = bY; }
        else if (pos < pw*0.45+ph*0.3) { dx = rx+pw/2-8;   dy = bY+(pos-pw*0.45); }
        else                         { dx = rx+pw/2-8-(pos-pw*0.45-ph*0.3); dy = bY+ph*0.3; }
        ctx.fillStyle = bi === 0 ? '#ef4444' : '#f97316';
        ctx.beginPath(); ctx.arc(dx, dy, 3.5, 0, Math.PI*2); ctx.fill();
      }
    }
    _label(ctx, '1/R_T = 1/R₁+1/R₂', rx, H-12, '#22c55e', 9);
  }

  /* ── Electric Field lines ── */
  function _animElectricField(s) {
    const { ctx, W, H, isDark, t } = s;
    _clearCanvas(s);

    const px = W * 0.28, nx = W * 0.72, cy = H/2;

    // Field lines (from + to -)
    const nLines = 10;
    for (let i = 0; i < nLines; i++) {
      const angle = (i / nLines) * Math.PI * 2;
      const lineColor = `rgba(251,191,36,${0.4 + 0.3*Math.abs(Math.cos(angle))})`;
      ctx.strokeStyle = lineColor; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px + 22 * Math.cos(angle), cy + 22 * Math.sin(angle));
      // Curved line toward −
      const cp1x = px + 80 * Math.cos(angle) + 30*Math.sin(angle);
      const cp1y = cy + 80 * Math.sin(angle) - 10*Math.cos(angle);
      const cp2x = nx - 80 * Math.cos(angle) + 30*Math.sin(angle);
      const cp2y = cy - 80 * Math.sin(angle) - 10*Math.cos(angle);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y,
        nx + 22 * Math.cos(angle + Math.PI), cy + 22 * Math.sin(angle + Math.PI));
      ctx.stroke();

      // Animated charge moving along line
      const phasePt = (t * 0.5 + i / nLines) % 1;
      function bezierPt(p, x0,y0,cp1x,cp1y,cp2x,cp2y,x1,y1) {
        const q = 1-p;
        return {
          x: q*q*q*x0 + 3*q*q*p*cp1x + 3*q*p*p*cp2x + p*p*p*x1,
          y: q*q*q*y0 + 3*q*q*p*cp1y + 3*q*p*p*cp2y + p*p*p*y1,
        };
      }
      const pt = bezierPt(phasePt,
        px+22*Math.cos(angle), cy+22*Math.sin(angle),
        cp1x, cp1y, cp2x, cp2y,
        nx+22*Math.cos(angle+Math.PI), cy+22*Math.sin(angle+Math.PI));
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI*2); ctx.fill();
    }

    // + charge
    const pulsePlus = 1 + Math.sin(t*3)*0.05;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(px, cy, 20*pulsePlus, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, cy, 20*pulsePlus, 0, Math.PI*2); ctx.stroke();
    _label(ctx, '+', px, cy, '#fff', 16);
    _label(ctx, 'Q₁', px, cy+34, '#ef4444', 9);

    // − charge
    const pulseNeg = 1 + Math.cos(t*3)*0.05;
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.arc(nx, cy, 20*pulseNeg, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(nx, cy, 20*pulseNeg, 0, Math.PI*2); ctx.stroke();
    _label(ctx, '−', nx, cy, '#fff', 16);
    _label(ctx, 'Q₂', nx, cy+34, '#3b82f6', 9);

    _label(ctx, 'Field lines: + → −  |  F = kQ₁Q₂/r²', W/2, H-10, _txt(isDark), 10);
  }

  /* ── KE & PE: pendulum / roller coaster ── */
  function _animKEPE(s) {
    const { ctx, W, H, isDark, t } = s;
    _clearCanvas(s);

    // Roller coaster hill
    const hillTop = H * 0.2;
    const floorY  = H - 30;
    const hillX   = W * 0.4;

    // Hill shape
    ctx.fillStyle = _clr(isDark,'#334155','#e2e8f0');
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.bezierCurveTo(hillX*0.3, floorY, hillX*0.6, hillTop+10, hillX, hillTop);
    ctx.bezierCurveTo(hillX+hillX*0.3, hillTop-5, hillX+hillX*0.4, floorY-20, W, floorY);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

    // Track line
    ctx.strokeStyle = _clr(isDark,'#64748b','#94a3b8'); ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.bezierCurveTo(hillX*0.3, floorY, hillX*0.6, hillTop+10, hillX, hillTop);
    ctx.bezierCurveTo(hillX+hillX*0.3, hillTop-5, hillX+hillX*0.4, floorY-20, W, floorY);
    ctx.stroke();

    // Cart position on track (oscillates)
    const phase = (Math.cos(t * 1.0) + 1) / 2; // 0=top, 1=bottom, but bezier
    function getTrackPt(frac) {
      if (frac <= 0.5) {
        const p = frac / 0.5;
        const q = 1-p;
        return {
          x: q*q*q*0 + 3*q*q*p*hillX*0.3 + 3*q*p*p*hillX*0.6 + p*p*p*hillX,
          y: q*q*q*floorY + 3*q*q*p*floorY + 3*q*p*p*(hillTop+10) + p*p*p*hillTop,
        };
      } else {
        const p = (frac-0.5)/0.5;
        const q = 1-p;
        return {
          x: q*q*q*hillX + 3*q*q*p*(hillX+hillX*0.3) + 3*q*p*p*(hillX+hillX*0.4) + p*p*p*W,
          y: q*q*q*hillTop + 3*q*q*p*(hillTop-5) + 3*q*p*p*(floorY-20) + p*p*p*floorY,
        };
      }
    }

    const frac = Math.abs(Math.sin(t * 0.7)) * 0.9;
    const pt   = getTrackPt(frac);

    // Energy bars (right side)
    const barX = W - 55, barMaxH = 80, barY0 = H - 35;
    const ke   = frac > 0.45 ? 1.0 - Math.abs(frac - 0.5) * 4 : Math.abs(frac - 0.5) * 4;
    const peH  = Math.max(0, (1 - frac * 1.8)) * barMaxH;
    const keH  = Math.min(barMaxH, (frac < 0.5 ? frac*2 : (1-frac)*2)) * barMaxH;

    // GPE bar
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(barX, barY0 - peH, 18, peH);
    ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY0 - barMaxH, 18, barMaxH);
    _label(ctx, 'GPE', barX+9, barY0+10, '#22c55e', 8);

    // KE bar
    ctx.fillStyle = '#f97316';
    ctx.fillRect(barX+22, barY0 - keH, 18, keH);
    ctx.strokeStyle = '#ea580c'; ctx.lineWidth = 1;
    ctx.strokeRect(barX+22, barY0 - barMaxH, 18, barMaxH);
    _label(ctx, 'KE', barX+31, barY0+10, '#f97316', 8);

    // Cart
    _drawBox(ctx, pt.x - 14, pt.y - 16, 28, 16, '#6366f1', '#4f46e5', 4);
    ctx.fillStyle = _clr(isDark,'#c7d2fe','#3730a3');
    ctx.beginPath(); ctx.arc(pt.x-8, pt.y, 5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(pt.x+8, pt.y, 5, 0, Math.PI*2); ctx.fill();

    // Energy label on cart
    _label(ctx, frac < 0.25 ? 'High GPE\nLow KE' : 'Low GPE\nHigh KE', pt.x, pt.y-30, _txt(isDark), 8);

    _label(ctx, 'KE = ½mv²   GPE = mgh   Total = constant', W/2, H-10, _txt(isDark), 10);
  }

  /* ── Work & Power ── */
  function _animWorkPower(s) {
    const { ctx, W, H, isDark, t } = s;
    _clearCanvas(s);

    const by = H - 40;
    const bx = 50 + (t * 30) % (W - 120);

    // Ground
    ctx.fillStyle = _clr(isDark,'#334155','#e2e8f0');
    ctx.fillRect(30, by+20, W-60, 6);

    // Push person
    const px = bx - 45;
    // Person stick figure
    ctx.strokeStyle = _clr(isDark,'#94a3b8','#475569'); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(px, by-45, 8, 0, Math.PI*2); ctx.stroke(); // head
    ctx.beginPath(); ctx.moveTo(px, by-37); ctx.lineTo(px, by-18); ctx.stroke(); // body
    const legSwing = Math.sin(t * 8) * 0.3;
    ctx.beginPath(); ctx.moveTo(px, by-18); ctx.lineTo(px+12*Math.sin(legSwing+0.5), by); ctx.stroke(); // leg1
    ctx.beginPath(); ctx.moveTo(px, by-18); ctx.lineTo(px-8*Math.sin(legSwing), by); ctx.stroke(); // leg2
    ctx.beginPath(); ctx.moveTo(px, by-30); ctx.lineTo(px+20, by-22); ctx.stroke(); // arm pushing

    // Box being pushed
    _drawBox(ctx, bx-20, by-22, 40, 38, _clr(isDark,'#fef3c7','#451a03'), '#f59e0b');
    _label(ctx, '10kg', bx, by-4, _txt(isDark), 9);

    // Force arrow
    _drawArrow(ctx, bx+20, by-10, bx+60, by-10, '#22c55e', 2.5, 'F=50N');

    // Displacement arrow (below)
    const dispLen = (bx - 50);
    if (dispLen > 20) {
      ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(50, by+30); ctx.lineTo(bx, by+30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(50, by+25); ctx.lineTo(50, by+35); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by+25); ctx.lineTo(bx, by+35); ctx.stroke();
      _label(ctx, `s = ${(dispLen/30).toFixed(1)}m`, 50+dispLen/2, by+42, '#3b82f6', 9);
    }

    // Work & Power display
    const s_val = (dispLen / 30).toFixed(1);
    const work  = (50 * parseFloat(s_val)).toFixed(0);
    const power = (50 * 30 / 100).toFixed(0);

    ctx.fillStyle = _clr(isDark,'rgba(34,197,94,0.12)','rgba(34,197,94,0.1)');
    ctx.fillRect(W-140, 10, 130, 50);
    _label(ctx, `W = F×s = ${work}J`, W-75, 26, '#22c55e', 10);
    _label(ctx, `P = W/t = ${power}W`, W-75, 44, '#f97316', 10);

    _label(ctx, 'W = Fs (Joules)  |  P = W/t (Watts)', W/2, H-10, _txt(isDark), 10);
  }

  /* ── Energy Transfer: Sankey diagram ── */
  function _animEnergyTransfer(s) {
    const { ctx, W, H, isDark, t } = s;
    _clearCanvas(s);

    // Input energy bar (left)
    const inX = 30, barY = H/2 - 50, totalH = 100;

    // Animated input bar
    const inputPulse = 1 + Math.sin(t * 2) * 0.03;
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(inX, barY, 30, totalH * inputPulse);
    _label(ctx, '100J', inX+15, barY - 12, '#fbbf24', 10);
    _label(ctx, 'Input', inX+15, barY + totalH + 14, _txt(isDark), 9);

    // Arrow
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(inX+30, barY, 40, totalH);

    // "Device" box
    const devX = inX + 70;
    _drawBox(ctx, devX, barY - 5, 55, totalH + 10, _clr(isDark,'#1e293b','#f1f5f9'), _clr(isDark,'#475569','#94a3b8'), 8);
    _label(ctx, '⚡', devX+27, barY + totalH/2 - 12, _txt(isDark), 18);
    _label(ctx, 'Motor', devX+27, barY + totalH/2 + 12, _txt(isDark), 9);

    // Useful output (large, green — 70%)
    const useH = totalH * 0.7;
    const useY = barY + (totalH - useH) / 2;
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(devX+55, useY, 60, useH);
    _label(ctx, '70J', devX+55+30, useY-12, '#22c55e', 10);
    _label(ctx, 'Useful (KE)', devX+55+30, useY + useH + 14, '#22c55e', 9);

    // Wasted heat (small, red — 30%)
    const wasteH = totalH * 0.3;
    const wasteAnim = Math.max(0, Math.sin(t * 4)) * 5;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(devX+55+70, barY + useH, 40 + wasteAnim, wasteH);
    _label(ctx, '30J', devX+55+90, barY + useH - 12, '#ef4444', 10);
    _label(ctx, 'Wasted (Heat)', devX+55+90, barY + totalH + 14, '#ef4444', 9);

    // Heat wave particles
    for (let i = 0; i < 4; i++) {
      const hx = devX+55+70+20 + i*10;
      const hy = barY + useH + wasteH + 5 + Math.sin(t*5 + i*0.8)*5;
      ctx.fillStyle = `rgba(239,68,68,${0.3-i*0.05})`;
      ctx.beginPath(); ctx.arc(hx, hy, 5-i, 0, Math.PI*2); ctx.fill();
    }

    // Efficiency
    _label(ctx, 'Efficiency = 70/100 × 100% = 70%', W/2, H-10, _txt(isDark), 10);

    // Total energy conserved line
    _label(ctx, 'Total energy IN = Total energy OUT (conserved)', W/2, barY - 25, _clr(isDark,'#94a3b8','#64748b'), 9);
  }

  /* ══════════════════════════════════════════════════
     QUIZ VIEW
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
            <span style="font-size:.6rem;font-weight:700;color:var(--text-3);white-space:nowrap;flex-shrink:0;">
              Q${_quizIdx+1}/${_shuffledQuiz.length} · Score: ${_quizScore}
            </span>
          </div>

          <div style="background:var(--bg-base);border:2px solid var(--accent-border);
                      border-radius:var(--r-xl);padding:1rem 1.25rem;margin-bottom:.875rem;">
            <div style="font-size:.6rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
                        color:var(--accent);margin-bottom:.5rem;">⚛️ Physics Q${_quizIdx+1}</div>
            <p style="font-size:var(--text-md);font-weight:600;color:var(--text-1);line-height:1.5;margin:0;">
              ${q.q}
            </p>
          </div>

          <div>
            ${opts.map(opt => {
              let cls = '';
              if (_quizAnswered) {
                if (opt === q.a)         cls = 'correct';
                else if (opt === _quizSelected && opt !== q.a) cls = 'wrong';
              }
              return `
                <button class="phys-quiz-opt ${cls}"
                        ${_quizAnswered ? 'disabled' : ''}
                        onclick="ThreeDPhysics._answerQuiz('${opt.replace(/'/g,"\\'")}')">
                  ${opt}
                </button>`;
            }).join('')}
          </div>

          ${_quizAnswered ? `
            <div style="margin-top:.75rem;padding:.75rem 1rem;border-radius:var(--r-xl);
                        background:${_quizSelected === q.a ? 'var(--success-subtle)' : 'var(--danger-subtle)'};
                        border:1px solid ${_quizSelected === q.a ? 'var(--success-border)' : 'var(--danger-border)'};">
              <div style="font-size:.6rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
                          color:${_quizSelected === q.a ? 'var(--success)' : 'var(--danger)'};margin-bottom:.35rem;">
                ${_quizSelected === q.a ? '✓ Correct!' : '✗ Not quite — Correct: ' + q.a}
              </div>
              <p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.6;margin:0 0 .5rem;">
                ${q.explain}
              </p>
              <button class="phys-step-btn primary" onclick="ThreeDPhysics._nextQuestion()"
                      style="font-size:.6rem;padding:.3rem .875rem;">
                ${_quizIdx < _shuffledQuiz.length - 1 ? 'Next Question →' : 'See Results'}
              </button>
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
          <h2 style="font-size:var(--text-xl);font-weight:800;color:${clr};margin-bottom:.25rem;">
            ${pct}% — ${grade}
          </h2>
          <p style="font-size:var(--text-sm);color:var(--text-3);margin-bottom:1.5rem;">
            You scored <strong>${_quizScore}</strong> out of <strong>${total}</strong>.
          </p>
          <div style="background:var(--bg-base);border:1px solid var(--border);border-radius:var(--r-xl);
                      padding:1rem;margin-bottom:1rem;text-align:left;">
            <div style="font-size:.575rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
                        color:var(--text-4);margin-bottom:.5rem;">Key formulae to review:</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem;">
              ${['F = ma','p = mv','v = fλ','V = IR','KE = ½mv²','GPE = mgh','W = Fs','P = W/t'].map(f =>
                `<div style="font-family:monospace;font-size:.75rem;font-weight:700;
                             background:var(--bg-subtle);border:1px solid var(--border);
                             border-radius:var(--r-sm);padding:.25rem .5rem;color:var(--accent);">${f}</div>`
              ).join('')}
            </div>
          </div>
          <div style="display:flex;gap:.625rem;justify-content:center;flex-wrap:wrap;">
            <button class="phys-step-btn primary" onclick="ThreeDPhysics._restartQuiz()"
                    style="padding:.5rem 1.25rem;">↺ Retake Quiz</button>
            <button class="phys-step-btn" onclick="ThreeDPhysics._setTab('forces')"
                    style="padding:.5rem 1.25rem;">📖 Study Topics</button>
          </div>
        </div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════
     PUBLIC ACTIONS
  ══════════════════════════════════════════════════ */

  function _setTab(tab) {
    _stopAllAnimations();
    _activeTab    = tab;
    _activeSubIdx = 0;
    _reRenderContent();
    _updateTabBar();
    requestAnimationFrame(_launchAnimation);
  }

  function _setSub(idx) {
    _stopAllAnimations();
    _activeSubIdx = idx;
    _reRenderContent();
    requestAnimationFrame(_launchAnimation);
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
      const tab = btn.getAttribute('onclick').match(/'([^']+)'/)?.[1];
      btn.classList.toggle('active', tab === _activeTab);
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
    _stopAllAnimations();
    if (typeof _onBack === 'function') _onBack();
  }

  /* ── Utility ── */
  function _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ══════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════ */

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
