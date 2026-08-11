/* ============================================================
   js/threedclass-biology.js — 3D Cell Structure & Systems
   ============================================================ */

(function () {
  'use strict';

  const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const ORBIT_CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';

  let _threeReady = false;
  let _threeQueue = [];

  function _loadThree(cb) {
    if (_threeReady) { cb(); return; }
    _threeQueue.push(cb);
    if (_threeQueue.length > 1) return;
    const s1 = document.createElement('script');
    s1.src = THREE_CDN;
    s1.onload = () => {
      const s2 = document.createElement('script');
      s2.src = ORBIT_CDN;
      s2.onload = () => {
        _threeReady = true;
        _threeQueue.forEach(fn => fn());
        _threeQueue = [];
      };
      document.head.appendChild(s2);
    };
    document.head.appendChild(s1);
  }

  const ORGANELLES = {
    nucleus: {
      id: 'nucleus', label: 'Nucleus',
      color: '#7c6af7', dark: '#a89cf8',
      present: ['animal', 'plant'],
      function: 'The control centre of the cell. Contains the cell\'s DNA packaged into chromosomes. Directs all cellular activities including growth, metabolism, and reproduction.',
      analogy: 'The headmaster\'s office — all major decisions and instructions originate here.',
      structure: 'Double-layered nuclear envelope with pores, nucleolus inside, chromatin filling the nucleoplasm.',
      examTip: 'Nucleus → nuclear envelope (double membrane) → nuclear pores → nucleoplasm → chromosomes. Absent in prokaryotes.',
      facts: ['Contains 46 chromosomes in human cells', 'Nuclear pores allow selective molecular transport', 'Continuous with the endoplasmic reticulum', 'Directs protein synthesis via mRNA'],
      size: 'Large (5–10 µm)',
    },
    nucleolus: {
      id: 'nucleolus', label: 'Nucleolus',
      color: '#5048d4', dark: '#7c72f5',
      present: ['animal', 'plant'],
      function: 'Dense region inside the nucleus that manufactures ribosomal RNA (rRNA) and assembles ribosome subunits.',
      analogy: 'A factory within the headmaster\'s office that produces the workers (ribosomes) for the whole school.',
      structure: 'Not membrane-bound — a condensed region of chromatin, rRNA, and proteins.',
      examTip: 'Nucleolus means "little nucleus". It disappears during cell division and reforms after. Cells with high protein synthesis have large nucleoli.',
      facts: ['Produces ribosomal RNA', 'Assembles ribosome subunits', 'Not membrane-bound', 'Disappears during mitosis'],
      size: 'Small (1–3 µm)',
    },
    cell_membrane: {
      id: 'cell_membrane', label: 'Cell Membrane',
      color: '#f5a623', dark: '#ffc55a',
      present: ['animal', 'plant'],
      function: 'Selectively permeable barrier controlling what enters and exits the cell. Made of a phospholipid bilayer with embedded proteins.',
      analogy: 'A security gate — it decides who gets in and who gets out.',
      structure: 'Phospholipid bilayer: hydrophilic heads outward, hydrophobic tails inward. Contains cholesterol, glycoproteins, channel proteins.',
      examTip: 'Key phrase: "selectively permeable". Small nonpolar molecules pass freely. Ions need protein channels. Fluid mosaic model (Singer & Nicolson 1972).',
      facts: ['7–10 nm thick', 'Fluid mosaic model', 'Phospholipid bilayer', 'Contains receptor proteins'],
      size: 'Thin layer (7–10 nm)',
    },
    mitochondria: {
      id: 'mitochondria', label: 'Mitochondria',
      color: '#e8524a', dark: '#ff7b73',
      present: ['animal', 'plant'],
      function: 'Powerhouse of the cell. Produces ATP through cellular respiration converting glucose and oxygen into ATP, CO2, and water.',
      analogy: 'The power generator — converts fuel (glucose) into usable electricity (ATP).',
      structure: 'Double membrane: smooth outer, inner folded into cristae. Matrix contains enzymes, own DNA, and ribosomes.',
      examTip: 'C6H12O6 + 6O2 → 6CO2 + 6H2O + ATP. Cristae increase surface area for ATP synthase. Has its own circular DNA.',
      facts: ['Has its own mitochondrial DNA', 'Cristae greatly increase surface area', 'Site of Krebs cycle and oxidative phosphorylation', 'More abundant in energy-demanding cells'],
      size: 'Medium (1–10 µm)',
    },
    rough_er: {
      id: 'rough_er', label: 'Rough ER',
      color: '#9b6dc5', dark: '#c49de0',
      present: ['animal', 'plant'],
      function: 'Studded with ribosomes. Synthesises and processes proteins destined for secretion, the cell membrane, or organelles.',
      analogy: 'A conveyor belt with workers (ribosomes) — proteins are built, folded, and packaged as they move along.',
      structure: 'Flattened membrane sacs (cisternae) continuous with the nuclear envelope. Ribosomes on cytoplasmic face.',
      examTip: 'Rough ER → Golgi → Vesicle → Cell membrane/secretion. This is the secretory pathway.',
      facts: ['Studded with ribosomes', 'Continuous with nuclear envelope', 'Folds proteins correctly', 'Sends proteins to Golgi in vesicles'],
      size: 'Large network',
    },
    smooth_er: {
      id: 'smooth_er', label: 'Smooth ER',
      color: '#2bc4d4', dark: '#5de0ee',
      present: ['animal', 'plant'],
      function: 'No ribosomes. Synthesises lipids, steroids, and hormones. Detoxifies drugs and poisons in liver cells. Stores calcium ions in muscle cells.',
      analogy: 'The chemistry laboratory — makes oils and hormones, and breaks down toxic chemicals.',
      structure: 'Tubular membrane network without ribosomes. Continuous with rough ER.',
      examTip: 'Smooth ER abundant in liver (detox) and steroid-producing cells. No ribosomes = no protein synthesis.',
      facts: ['No ribosomes', 'Lipid and steroid synthesis', 'Detoxification in liver cells', 'Ca2+ ion storage in muscle cells'],
      size: 'Medium network',
    },
    golgi: {
      id: 'golgi', label: 'Golgi Apparatus',
      color: '#27b87e', dark: '#4fd9a0',
      present: ['animal', 'plant'],
      function: 'Receives proteins from rough ER, modifies them (glycosylation), sorts them, and packages them into vesicles for the correct destination.',
      analogy: 'The post office — receives packages, writes the address, and sends them to the right destination.',
      structure: 'Stack of flattened membrane sacs. Cis face receives vesicles from ER. Trans face ships modified proteins.',
      examTip: 'Golgi has a cis (receiving) and trans (sending) face. Adds sugar chains (glycosylation). Produces lysosomes.',
      facts: ['Cis face receives, trans face ships', 'Modifies proteins by glycosylation', 'Produces secretory vesicles', 'Makes lysosomes'],
      size: 'Medium (1–3 µm stack)',
    },
    ribosome: {
      id: 'ribosome', label: 'Ribosomes',
      color: '#f97b2a', dark: '#ffab6a',
      present: ['animal', 'plant'],
      function: 'Site of protein synthesis. Reads messenger RNA and assembles amino acids into polypeptide chains.',
      analogy: 'The builders — they read the blueprint (mRNA) and assemble the components (amino acids) into structures (proteins).',
      structure: 'Two subunits (large and small) made of rRNA and proteins. Free in cytoplasm or bound to rough ER.',
      examTip: 'Not membrane-bound — the only organelle without a membrane. DNA → mRNA → Ribosome → Protein.',
      facts: ['Made of rRNA and proteins', 'Large and small subunits', 'No membrane envelope', '80S in eukaryotes, 70S in prokaryotes'],
      size: 'Very small (20–30 nm)',
    },
    lysosome: {
      id: 'lysosome', label: 'Lysosome',
      color: '#e0449e', dark: '#f47fc4',
      present: ['animal'],
      function: 'Contains digestive enzymes. Breaks down worn-out organelles, food particles, bacteria, and cellular debris. Involved in apoptosis.',
      analogy: 'The recycling centre and waste disposal — breaks everything into reusable raw materials.',
      structure: 'Membrane-bound sac containing ~50 hydrolytic enzymes. Maintained at acidic pH ~4.5. Produced by Golgi.',
      examTip: '"Suicide bags" of the cell. Enzyme activity requires low pH. Rare in plant cells (vacuole takes this role).',
      facts: ['pH ~4.5 inside', 'Contains ~50 digestive enzymes', 'Made by the Golgi apparatus', 'Involved in autophagy'],
      size: 'Small (0.1–1.2 µm)',
    },
    centriole: {
      id: 'centriole', label: 'Centrioles',
      color: '#7a8fa8', dark: '#a0b4c8',
      present: ['animal'],
      function: 'Organise the mitotic spindle during cell division. Help pull chromosomes apart. Also form the base of cilia and flagella.',
      analogy: 'The scaffolding team — they set up the framework (spindle fibres) that ensures chromosomes divide equally.',
      structure: 'Pair of cylinders at right angles. Each made of 9 triplets of microtubules arranged in a ring.',
      examTip: 'Present in ANIMAL cells but ABSENT in most plant cells. Key difference in diagram exam questions.',
      facts: ['9 triplets of microtubules', 'Absent in most plant cells', 'Occur in pairs (centrosome)', 'Form the base of cilia and flagella'],
      size: 'Small (0.2–0.5 µm)',
    },
    vacuole: {
      id: 'vacuole', label: 'Vacuole',
      color: '#3db5e8', dark: '#72d0f5',
      present: ['animal', 'plant'],
      function: 'In animal cells: small temporary vacuoles store water, food, or waste. In plant cells: one large central vacuole maintains turgor pressure.',
      analogy: 'A storage tank. In plants it is a massive water tower that keeps the cell firm and upright.',
      structure: 'Membrane-bound sac. Plant central vacuole bounded by the tonoplast; can occupy up to 90% of cell volume.',
      examTip: 'Plant = ONE large central vacuole. Animal = MANY small vacuoles. Turgor pressure keeps plants upright.',
      facts: ['Central vacuole up to 90% of plant cell volume', 'Tonoplast is the vacuole membrane', 'Maintains turgor pressure', 'Multiple small vacuoles in animal cells'],
      size: 'Variable',
    },
    cytoplasm: {
      id: 'cytoplasm', label: 'Cytoplasm',
      color: '#b8d45a', dark: '#d4ec7a',
      present: ['animal', 'plant'],
      function: 'Jelly-like fluid filling the cell. Suspends organelles. Site of glycolysis and many chemical reactions. Maintains cell shape.',
      analogy: 'The water in an aquarium — everything floats in it and many chemical reactions happen inside it.',
      structure: 'Cytosol (water, salts, enzymes) plus cytoskeleton protein fibres for support and transport.',
      examTip: 'Cytoplasm ≠ cytosol. Cytoplasm = everything inside cell membrane except nucleus. Glycolysis occurs in the cytoplasm.',
      facts: ['Site of glycolysis', 'Approximately 70% water', 'Contains dissolved proteins and enzymes', 'Cytoskeleton runs throughout'],
      size: 'Fills entire cell',
    },
    cell_wall: {
      id: 'cell_wall', label: 'Cell Wall',
      color: '#8fc43a', dark: '#b0d85a',
      present: ['plant'],
      function: 'Rigid outer layer outside the cell membrane. Structural support and protection. Prevents over-expansion when absorbing water. Made of cellulose.',
      analogy: 'The brick walls of a building — rigid, strong, gives the cell its fixed shape.',
      structure: 'Cellulose microfibrils in a polysaccharide matrix. Plasmodesmata are channels through the wall connecting adjacent cells.',
      examTip: 'Cell wall = CELLULOSE in plants (chitin in fungi, peptidoglycan in bacteria). OUTSIDE the cell membrane. Animal cells have NO cell wall.',
      facts: ['Made of cellulose in plants', 'Rigid and fully permeable', 'Prevents extreme plasmolysis', 'Contains plasmodesmata channels'],
      size: 'Thick outer layer (0.1–10 µm)',
    },
    chloroplast: {
      id: 'chloroplast', label: 'Chloroplast',
      color: '#2ab85f', dark: '#50d880',
      present: ['plant'],
      function: 'Site of photosynthesis. Captures light energy and converts CO2 and water into glucose and oxygen. Contains the pigment chlorophyll.',
      analogy: 'A solar panel factory — captures sunlight and converts it into chemical energy (glucose).',
      structure: 'Double membrane. Thylakoid membranes stacked into grana. Stroma surrounds grana. Thylakoids contain chlorophyll.',
      examTip: '6CO2 + 6H2O + light → C6H12O6 + 6O2. Light reactions in thylakoids. Calvin cycle in stroma.',
      facts: ['Contains chlorophyll pigment', 'Has own circular DNA', 'Thylakoids stacked into grana', 'Stroma is site of Calvin cycle'],
      size: 'Large (4–10 µm)',
    },
    central_vacuole: {
      id: 'central_vacuole', label: 'Central Vacuole',
      color: '#38b8e8', dark: '#70d5f8',
      present: ['plant'],
      function: 'Very large vacuole occupying most of the plant cell volume. Stores water, maintains turgor pressure, stores pigments, isolates waste.',
      analogy: 'A giant water balloon inside the cell — when full it pushes cytoplasm to the edges and keeps the cell rigid.',
      structure: 'Single large vacuole bounded by the tonoplast membrane. Can occupy 30–90% of cell volume.',
      examTip: 'When plant wilts: central vacuole loses water → turgor drops → flaccid cell → drooping plant. Know: turgid vs flaccid vs plasmolysed.',
      facts: ['Occupies up to 90% of cell volume', 'Tonoplast is its membrane', 'Maintains turgor pressure', 'Stores pigments and waste products'],
      size: 'Very large (up to 90% of cell)',
    },
    plasmodesmata: {
      id: 'plasmodesmata', label: 'Plasmodesmata',
      color: '#5ed4a8', dark: '#80ecc4',
      present: ['plant'],
      function: 'Tiny channels through cell walls connecting adjacent plant cells. Allow cytoplasm-to-cytoplasm communication and transport of water, nutrients, and signals.',
      analogy: 'Doorways or tunnels in walls between rooms — molecules move directly from cell to cell without going outside.',
      structure: 'Narrow cytoplasmic channels (40–50 nm) lined by cell membrane. A desmotubule (ER strand) runs through the centre.',
      examTip: 'Plasmodesmata enable the symplast pathway. Contrast with the apoplast pathway (through cell walls).',
      facts: ['40–50 nm in diameter', 'Lined by the plasma membrane', 'Enable symplast transport', 'Unique to plant cells'],
      size: 'Microscopic (40–50 nm)',
    },
    peroxisome: {
      id: 'peroxisome', label: 'Peroxisome',
      color: '#f5b800', dark: '#ffd040',
      present: ['animal', 'plant'],
      function: 'Breaks down fatty acids for energy. Detoxifies harmful substances especially in liver. Neutralises hydrogen peroxide using catalase.',
      analogy: 'The hazmat team — neutralises toxic chemicals produced during normal cell operations.',
      structure: 'Small membrane-bound organelle with oxidative enzymes, especially catalase. Forms by budding from ER.',
      examTip: 'Key enzyme: catalase. 2H2O2 → 2H2O + O2. Very abundant in liver and kidney cells. Distinct from lysosomes.',
      facts: ['Contains catalase enzyme', 'Converts H2O2 → H2O and O2', 'Abundant in liver cells', 'Also involved in fatty acid oxidation'],
      size: 'Small (0.1–1 µm)',
    },
    cytoskeleton: {
      id: 'cytoskeleton', label: 'Cytoskeleton',
      color: '#c47ee8', dark: '#dca8f5',
      present: ['animal', 'plant'],
      function: 'Network of protein fibres giving the cell its shape, supporting organelles, enabling movement, and acting as tracks for internal transport.',
      analogy: 'The skeleton and motorway system combined — structural support and highways for moving cargo.',
      structure: 'Three components: microfilaments (actin, 7 nm), intermediate filaments (10 nm), microtubules (tubulin, 25 nm).',
      examTip: 'Microfilaments = actin (thinnest). Intermediate filaments (medium). Microtubules = tubulin (thickest, form mitotic spindle).',
      facts: ['Microfilaments: actin, 7 nm', 'Microtubules: tubulin, 25 nm', 'Intermediate filaments: 10 nm', 'Dynamic — constantly assembles and disassembles'],
      size: 'Network throughout cell',
    },
  };

  const SYSTEMS = [
    {
      id: 'protein_synthesis',
      title: 'Protein Secretion Pathway',
      icon: 'flask',
      color: '#8b5cf6',
      description: 'How a cell makes and exports proteins — the secretory pathway. Understanding this sequence is essential for exams.',
      steps: [
        { organelle: 'nucleus', color: '#7c6af7', label: '1. DNA Blueprint', desc: 'The nucleus contains the gene (DNA). The gene is transcribed into messenger RNA (mRNA). mRNA carries the instructions for making a specific protein.' },
        { organelle: 'ribosome', color: '#f97b2a', label: '2. Translation', desc: 'mRNA exits the nucleus through nuclear pores and attaches to ribosomes on the rough ER. Ribosomes read the mRNA and assemble amino acids into a polypeptide chain.' },
        { organelle: 'rough_er', color: '#9b6dc5', label: '3. Folding and Quality Check', desc: 'The protein enters the rough ER lumen where it is folded into the correct 3D shape. Incorrectly folded proteins are destroyed. The protein is then packaged into a transport vesicle.' },
        { organelle: 'golgi', color: '#27b87e', label: '4. Modification and Sorting', desc: 'Vesicles from the rough ER fuse with the Golgi cis face. The Golgi modifies the protein by glycosylation (adding sugar chains), then sorts and packages it at the trans face.' },
        { organelle: 'cell_membrane', color: '#f5a623', label: '5. Export by Exocytosis', desc: 'Vesicles from the Golgi travel to the cell membrane and fuse with it, releasing the protein outside. This is exocytosis. Example: insulin secretion from pancreatic beta cells.' },
      ],
    },
    {
      id: 'energy',
      title: 'Cellular Respiration',
      icon: 'lightning',
      color: '#ef4444',
      description: 'How cells extract energy from glucose to produce ATP — the universal energy currency powering ALL cellular processes.',
      steps: [
        { organelle: 'cytoplasm', color: '#b8d45a', label: '1. Glycolysis', desc: 'Glucose (6 carbons) is split into 2 pyruvate molecules (3 carbons each) in the cytoplasm. Produces a net 2 ATP and NADH. Does not require oxygen.' },
        { organelle: 'mitochondria', color: '#e8524a', label: '2. Pyruvate Oxidation', desc: 'Pyruvate enters the mitochondrial matrix and is converted to Acetyl-CoA (2 carbons), releasing CO2. NADH is produced. This links glycolysis to the Krebs cycle.' },
        { organelle: 'mitochondria', color: '#f97b2a', label: '3. Krebs Cycle', desc: 'Acetyl-CoA enters the Krebs cycle in the matrix. Each turn produces CO2, NADH, FADH2, and 1 ATP. The cycle turns twice per glucose molecule.' },
        { organelle: 'mitochondria', color: '#dc2626', label: '4. Oxidative Phosphorylation', desc: 'NADH and FADH2 donate electrons to the electron transport chain on the inner membrane. ATP synthase uses H+ flow to make ATP. O2 is the final electron acceptor. Produces ~32–34 ATP per glucose.' },
      ],
    },
    {
      id: 'photosynthesis',
      title: 'Photosynthesis',
      icon: 'sun',
      color: '#22c55e',
      description: 'How plant cells capture light energy and convert it into glucose — the foundation of almost all food chains on Earth.',
      plantOnly: true,
      steps: [
        { organelle: 'chloroplast', color: '#2ab85f', label: '1. Light Absorption', desc: 'Chlorophyll pigments in thylakoid membranes absorb light (mainly red and blue wavelengths, reflecting green — why plants appear green).' },
        { organelle: 'chloroplast', color: '#1e9e52', label: '2. Light Reactions in Thylakoids', desc: 'Water is split (photolysis), releasing O2, H+, and electrons. These energised electrons power ATP synthesis and NADPH production in the thylakoid membranes.' },
        { organelle: 'chloroplast', color: '#177840', label: '3. Calvin Cycle in Stroma', desc: 'CO2 from air is fixed using ATP and NADPH from the light reactions. Through a series of reactions in the stroma, glucose is produced.' },
        { organelle: 'cytoplasm', color: '#b8d45a', label: '4. Glucose Utilisation', desc: 'Glucose is used for cellular respiration (energy), building cellulose (cell walls), making starch (storage), and producing other organic molecules.' },
      ],
    },
    {
      id: 'cell_division',
      title: 'Mitosis',
      icon: 'arrows-clockwise',
      color: '#6366f1',
      description: 'How cells reproduce — creating two genetically identical daughter cells. Critical for growth, repair, and asexual reproduction.',
      steps: [
        { organelle: 'nucleus', color: '#7c6af7', label: '1. Interphase — Preparation', desc: 'The cell grows and replicates its DNA. Each chromosome duplicates into two identical sister chromatids joined at the centromere. Organelles also replicate.' },
        { organelle: 'centriole', color: '#7a8fa8', label: '2. Prophase', desc: 'Chromosomes condense and become visible. Centrioles (animal cells) move to opposite poles. The mitotic spindle forms from microtubules. The nuclear envelope breaks down.' },
        { organelle: 'nucleus', color: '#5048d4', label: '3. Metaphase', desc: 'Chromosomes align along the equator (metaphase plate). Spindle fibres attach to centromeres. This ensures each daughter cell receives exactly one copy of each chromosome.' },
        { organelle: 'cytoplasm', color: '#b8d45a', label: '4. Anaphase and Telophase', desc: 'Sister chromatids are pulled to opposite poles. Nuclear envelopes reform around each set. Cytokinesis follows — animal cells pinch in; plant cells form a new cell plate.' },
      ],
    },
  ];

  const QUIZ_QUESTIONS = [
    { q: 'Which organelle is known as the powerhouse of the cell?', a: 'mitochondria', options: ['nucleus', 'mitochondria', 'lysosome', 'ribosome'] },
    { q: 'Where does protein synthesis (translation) occur?', a: 'ribosome', options: ['golgi', 'nucleus', 'ribosome', 'rough_er'] },
    { q: 'Which organelle is found ONLY in plant cells?', a: 'chloroplast', options: ['mitochondria', 'ribosome', 'chloroplast', 'golgi'] },
    { q: 'Which organelle sorts and ships proteins like a post office?', a: 'golgi', options: ['rough_er', 'golgi', 'lysosome', 'nucleus'] },
    { q: 'Which organelle contains enzymes that digest worn-out organelles?', a: 'lysosome', options: ['peroxisome', 'vacuole', 'lysosome', 'smooth_er'] },
    { q: 'What structure controls what enters and exits the cell?', a: 'cell_membrane', options: ['cell_wall', 'cell_membrane', 'cytoplasm', 'nuclear envelope'] },
    { q: 'Which organelle makes ribosomal RNA and ribosome subunits?', a: 'nucleolus', options: ['nucleus', 'nucleolus', 'rough_er', 'ribosome'] },
    { q: 'Where does glycolysis (first stage of respiration) occur?', a: 'cytoplasm', options: ['mitochondria', 'nucleus', 'cytoplasm', 'lysosome'] },
    { q: 'What provides structural support and prevents over-expansion in plant cells?', a: 'cell_wall', options: ['cell_membrane', 'central_vacuole', 'cell_wall', 'cytoskeleton'] },
    { q: 'Which organelle synthesises lipids and detoxifies drugs in the liver?', a: 'smooth_er', options: ['rough_er', 'smooth_er', 'golgi', 'peroxisome'] },
    { q: 'Where does the Calvin cycle of photosynthesis occur?', a: 'chloroplast', options: ['cytoplasm', 'mitochondria', 'chloroplast', 'nucleus'] },
    { q: 'Which structure organises cell division in animals but is absent in most plant cells?', a: 'centriole', options: ['lysosome', 'centriole', 'vacuole', 'peroxisome'] },
    { q: 'What maintains turgor pressure in plant cells?', a: 'central_vacuole', options: ['cell_wall', 'central_vacuole', 'chloroplast', 'plasmodesmata'] },
    { q: 'Which organelle uses catalase to neutralise hydrogen peroxide?', a: 'peroxisome', options: ['lysosome', 'peroxisome', 'smooth_er', 'mitochondria'] },
    { q: 'What microscopic channels connect neighbouring plant cells through their walls?', a: 'plasmodesmata', options: ['plasmodesmata', 'vacuole', 'cytoskeleton', 'ribosome'] },
  ];

  let _onBack = null;
  let _mode = 'animal';
  let _selectedOrg = null;
  let _systemIdx = 0;
  let _systemStep = 0;
  let _quizIdx = 0;
  let _quizScore = 0;
  let _quizAnswered = false;
  let _quizSelected = null;
  let _quizDone = false;
  let _shuffledQuiz = [];
  let _scenes = {};

  function open(onBackCallback) {
    _onBack = onBackCallback || null;
    _mode = 'animal';
    _selectedOrg = null;
    _systemIdx = 0;
    _systemStep = 0;
    _quizIdx = 0;
    _quizScore = 0;
    _quizAnswered = false;
    _quizSelected = null;
    _quizDone = false;
    _shuffledQuiz = _shuffle([...QUIZ_QUESTIONS]);
    _render();
  }

  function _render() {
    _destroyAllScenes();
    UI.mount(`
      <div id="bio-shell" style="
        display:flex;flex-direction:column;height:100dvh;
        background:var(--bg-page);overflow:hidden;font-family:var(--font);
      ">
        ${_buildTopBar()}
        ${_buildModeBar()}
        <div id="bio-content" style="flex:1 1 0;overflow:hidden;position:relative;">
          ${_buildContent()}
        </div>
        <div id="bio-detail" style="
          flex-shrink:0;max-height:0;overflow:hidden;
          transition:max-height .4s cubic-bezier(0.16,1,0.3,1);
          background:var(--bg-base);border-top:1px solid var(--border);
          position:relative;z-index:30;
        ">
          <div id="bio-detail-inner" style="padding:.75rem 1rem 1.25rem;"></div>
        </div>
      </div>
      <style>
        .bio-tab {
          font-size:.6rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
          padding:4px 12px;border-radius:99px;border:1.5px solid var(--border);
          background:var(--bg-subtle);color:var(--text-3);cursor:pointer;
          white-space:nowrap;font-family:var(--font);flex-shrink:0;
          transition:all .15s ease;
        }
        .bio-tab.active {
          background:var(--accent);color:#fff;border-color:var(--accent);
          box-shadow:0 2px 12px rgba(79,110,247,.35);
        }
        .bio-step-btn {
          padding:.375rem .875rem;border-radius:var(--r-md);font-size:var(--text-sm);
          font-weight:600;border:1px solid var(--border);background:var(--bg-subtle);
          color:var(--text-2);cursor:pointer;font-family:var(--font);transition:all .12s;
        }
        .bio-step-btn:hover { background:var(--bg-muted); }
        .bio-step-btn.primary {
          background:var(--accent);color:#fff;border-color:var(--accent);
          box-shadow:0 2px 10px rgba(79,110,247,.3);
        }
        .bio-quiz-opt {
          display:block;width:100%;text-align:left;padding:.625rem 1rem;
          border-radius:var(--r-lg);border:1.5px solid var(--border);
          background:var(--bg-base);color:var(--text-1);
          font-family:var(--font);font-size:var(--text-sm);font-weight:500;
          cursor:pointer;margin-bottom:.5rem;transition:all .12s;
        }
        .bio-quiz-opt:hover:not(:disabled) {
          border-color:var(--accent);background:var(--accent-subtle);
        }
        .bio-quiz-opt.correct { background:#d1fae5;border-color:#22c55e;color:#14532d; }
        .bio-quiz-opt.wrong   { background:#ffe4e6;border-color:#ef4444;color:#9f1239; }
        [data-theme="dark"] .bio-quiz-opt.correct { background:#052e16;border-color:#22c55e;color:#4ade80; }
        [data-theme="dark"] .bio-quiz-opt.wrong   { background:#4c0519;border-color:#ef4444;color:#fda4af; }
        .bio-legend-btn {
          display:flex;align-items:center;gap:.4rem;width:100%;
          text-align:left;padding:.3rem .45rem;border-radius:var(--r-sm);
          border:none;background:none;cursor:pointer;font-family:var(--font);
          transition:background .1s;
        }
        .bio-legend-btn:hover { background:var(--bg-subtle); }
        .bio-legend-btn.active { background:var(--bg-subtle); }
        .bio-org-dot {
          width:9px;height:9px;border-radius:50%;flex-shrink:0;
          transition:transform .15s ease;
        }
        .bio-legend-btn.active .bio-org-dot { transform:scale(1.4); }
      </style>`);

    if (_mode === 'animal' || _mode === 'plant' || _mode === 'compare') {
      _loadThree(() => _bootScenes());
    }
  }

  function _buildTopBar() {
    return `
      <div style="display:flex;align-items:center;gap:.5rem;padding:.45rem .875rem;
                  border-bottom:1px solid var(--border);background:var(--bg-base);
                  flex-shrink:0;min-height:2.75rem;">
        <button onclick="ThreeDCell._back()"
                style="display:inline-flex;align-items:center;gap:.3rem;font-size:var(--text-sm);
                       font-weight:600;color:var(--text-2);background:var(--bg-subtle);
                       border:1px solid var(--border);border-radius:var(--r-md);
                       padding:.3rem .7rem;cursor:pointer;font-family:var(--font);flex-shrink:0;">
          <i class="ph ph-arrow-left" style="font-size:.875rem;"></i> Back
        </button>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--text-base);font-weight:700;color:var(--text-1);
                      letter-spacing:-.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            Cell Structure &amp; Systems
          </div>
        </div>
        <span id="bio-org-count" style="font-size:.58rem;color:var(--text-4);font-weight:600;
                                         letter-spacing:.05em;flex-shrink:0;"></span>
      </div>`;
  }

  function _buildModeBar() {
    const tabs = [
      { id: 'animal', icon: 'ph-atom', label: 'Animal Cell' },
      { id: 'plant', icon: 'ph-tree', label: 'Plant Cell' },
      { id: 'compare', icon: 'ph-scales', label: 'Compare' },
      { id: 'systems', icon: 'ph-arrows-clockwise', label: 'Systems' },
      { id: 'quiz', icon: 'ph-question', label: 'Quiz' },
    ];
    return `
      <div style="flex-shrink:0;display:flex;align-items:center;gap:.375rem;
                  padding:.35rem .875rem;border-bottom:1px solid var(--border);
                  overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;
                  background:var(--bg-base);">
        ${tabs.map(t => `
          <button class="bio-tab${_mode === t.id ? ' active' : ''}"
                  onclick="ThreeDCell._setMode('${t.id}')">
            <i class="ph ${t.icon}" style="margin-right:3px;font-size:.7rem;"></i>${t.label}
          </button>`).join('')}
      </div>`;
  }

  function _buildContent() {
    if (_mode === 'animal') return _buildCellViewHTML('animal');
    if (_mode === 'plant') return _buildCellViewHTML('plant');
    if (_mode === 'compare') return _buildCompareHTML();
    if (_mode === 'systems') return _buildSystemsView();
    if (_mode === 'quiz') return _buildQuizView();
    return '';
  }

  function _buildCellViewHTML(type) {
    const organellesInCell = Object.values(ORGANELLES).filter(o => o.present.includes(type));
    _updateOrgCount(type);
    return `
      <div style="display:flex;height:100%;overflow:hidden;">
        <div id="bio-canvas-wrap-${type}" style="flex:1 1 0;position:relative;overflow:hidden;min-width:0;background:#080a10;">
          <canvas id="bio-canvas-${type}" style="width:100%;height:100%;display:block;"></canvas>
          <div id="bio-hint-${type}" style="position:absolute;bottom:.75rem;left:50%;
               transform:translateX(-50%);font-size:.55rem;font-weight:700;
               letter-spacing:.07em;color:rgba(255,255,255,.45);text-transform:uppercase;
               pointer-events:none;white-space:nowrap;background:rgba(0,0,0,.35);
               border:1px solid rgba(255,255,255,.1);border-radius:99px;padding:4px 12px;
               backdrop-filter:blur(8px);">
            Drag to rotate &middot; Scroll to zoom &middot; Tap to inspect
          </div>
          <div id="bio-selected-label-${type}" style="position:absolute;top:.75rem;left:.75rem;
               font-size:.625rem;font-weight:700;color:#fff;
               background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.2);
               border-radius:var(--r-md);padding:4px 10px;display:none;pointer-events:none;
               backdrop-filter:blur(8px);">
          </div>
        </div>
        <div style="width:136px;flex-shrink:0;overflow-y:auto;overflow-x:hidden;
                    border-left:1px solid var(--border);background:var(--bg-base);
                    padding:.5rem .35rem;scrollbar-width:thin;">
          <div style="font-size:.525rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
                      color:var(--text-4);margin-bottom:.4rem;padding:0 .2rem;">Organelles</div>
          ${organellesInCell.map(org => `
            <button class="bio-legend-btn${_selectedOrg === org.id ? ' active' : ''}"
                    onclick="ThreeDCell._selectOrg('${org.id}','${type}')">
              <span class="bio-org-dot" style="background:${org.color};box-shadow:0 0 0 2px ${org.color}44;"></span>
              <span style="font-size:.565rem;font-weight:600;color:var(--text-2);line-height:1.3;">
                ${org.label}
              </span>
            </button>`).join('')}
        </div>
      </div>`;
  }

  function _updateOrgCount(type) {
    const cnt = document.getElementById('bio-org-count');
    if (!cnt) return;
    if (type === 'animal') cnt.textContent = `${Object.values(ORGANELLES).filter(o => o.present.includes('animal')).length} organelles`;
    else if (type === 'plant') cnt.textContent = `${Object.values(ORGANELLES).filter(o => o.present.includes('plant')).length} organelles`;
    else cnt.textContent = '';
  }

  function _buildCompareHTML() {
    const diffs = [
      { feature: 'Cell Wall', animal: 'Absent', plant: 'Cellulose cell wall', aOk: false, pOk: true },
      { feature: 'Chloroplasts', animal: 'Absent', plant: 'Present — photosynthesis', aOk: false, pOk: true },
      { feature: 'Central Vacuole', animal: 'Many small vacuoles', plant: 'One large central vacuole', aOk: false, pOk: true },
      { feature: 'Centrioles', animal: 'Present', plant: 'Absent in most species', aOk: true, pOk: false },
      { feature: 'Lysosomes', animal: 'Common', plant: 'Rare (vacuole fills role)', aOk: true, pOk: false },
      { feature: 'Plasmodesmata', animal: 'Absent', plant: 'Present — cell channels', aOk: false, pOk: true },
      { feature: 'Shape', animal: 'Round / irregular', plant: 'Rectangular / fixed', aOk: null, pOk: null },
      { feature: 'Mitochondria', animal: 'Present — many', plant: 'Present — fewer', aOk: true, pOk: true },
      { feature: 'Ribosomes', animal: '80S type', plant: '80S type', aOk: true, pOk: true },
      { feature: 'Nucleus', animal: 'Central', plant: 'Often peripheral', aOk: true, pOk: true },
      { feature: 'Golgi Apparatus', animal: 'Present', plant: 'Present (dictyosome)', aOk: true, pOk: true },
      { feature: 'ER (both types)', animal: 'Present', plant: 'Present', aOk: true, pOk: true },
    ];
    return `
      <div style="height:100%;overflow-y:auto;">
        <div style="display:grid;grid-template-columns:1fr 1fr;height:210px;border-bottom:1px solid var(--border);background:#080a10;">
          <div style="position:relative;border-right:1px solid rgba(255,255,255,.08);">
            <canvas id="bio-canvas-left" style="width:100%;height:100%;display:block;"></canvas>
            <div style="position:absolute;top:.5rem;left:50%;transform:translateX(-50%);
                        font-size:.55rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
                        color:rgba(255,255,255,.6);pointer-events:none;background:rgba(0,0,0,.4);
                        border:1px solid rgba(255,255,255,.12);border-radius:99px;padding:3px 10px;
                        backdrop-filter:blur(8px);">
              Animal Cell
            </div>
          </div>
          <div style="position:relative;">
            <canvas id="bio-canvas-right" style="width:100%;height:100%;display:block;"></canvas>
            <div style="position:absolute;top:.5rem;left:50%;transform:translateX(-50%);
                        font-size:.55rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
                        color:rgba(255,255,255,.6);pointer-events:none;background:rgba(0,0,0,.4);
                        border:1px solid rgba(255,255,255,.12);border-radius:99px;padding:3px 10px;
                        backdrop-filter:blur(8px);">
              Plant Cell
            </div>
          </div>
        </div>
        <div style="padding:.75rem;max-width:720px;margin:0 auto;">
          <div style="background:var(--bg-base);border:1px solid var(--border);
                      border-radius:var(--r-xl);overflow:hidden;margin-bottom:.75rem;">
            <div style="padding:.6rem 1rem;border-bottom:1px solid var(--border);
                        background:var(--bg-subtle);display:grid;
                        grid-template-columns:1fr 1fr 1fr;gap:.5rem;">
              <span style="font-size:.55rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-4);">Feature</span>
              <span style="font-size:.55rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-4);">Animal</span>
              <span style="font-size:.55rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-4);">Plant</span>
            </div>
            ${diffs.map((d, i) => `
              <div style="padding:.5rem 1rem;${i < diffs.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}
                          display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;align-items:center;
                          ${i % 2 === 0 ? 'background:var(--bg-base);' : 'background:var(--bg-subtle);'}">
                <span style="font-size:var(--text-xs);font-weight:600;color:var(--text-1);">${d.feature}</span>
                <span style="font-size:var(--text-xs);color:${d.aOk === true ? 'var(--success)' : d.aOk === false ? 'var(--danger)' : 'var(--text-2)'};">
                  ${d.aOk === true ? '<i class="ph ph-check-circle" style="margin-right:3px;"></i>' : d.aOk === false ? '<i class="ph ph-x-circle" style="margin-right:3px;"></i>' : ''}${d.animal}
                </span>
                <span style="font-size:var(--text-xs);color:${d.pOk === true ? 'var(--success)' : d.pOk === false ? 'var(--danger)' : 'var(--text-2)'};">
                  ${d.pOk === true ? '<i class="ph ph-check-circle" style="margin-right:3px;"></i>' : d.pOk === false ? '<i class="ph ph-x-circle" style="margin-right:3px;"></i>' : ''}${d.plant}
                </span>
              </div>`).join('')}
          </div>
          <div style="padding:.75rem 1rem;border-radius:var(--r-xl);
                      background:var(--accent-subtle);border:1px solid var(--accent-border);">
            <div style="font-size:.575rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
                        color:var(--accent-text);margin-bottom:.4rem;display:flex;align-items:center;gap:.35rem;">
              <i class="ph ph-pencil-simple"></i> Exam Tips
            </div>
            <ul style="font-size:var(--text-xs);color:var(--text-2);line-height:1.75;
                       list-style:none;padding:0;margin:0;">
              <li>CLCV = Cell wall, Chloroplasts, Large central vacuole — plant only</li>
              <li>Centrioles present in animal cells, absent in most plants — yet plants still divide</li>
              <li>Plant cells are rectangular (rigid cell wall); animal cells are round (flexible membrane)</li>
              <li>Both cells share: nucleus, mitochondria, ribosomes, ER, Golgi, cytoplasm, cell membrane</li>
              <li>Lysosomes common in animal cells; the vacuole performs similar digestive roles in plants</li>
            </ul>
          </div>
        </div>
      </div>`;
  }

  function _bootScenes() {
    if (_mode === 'animal') {
      const canvas = document.getElementById('bio-canvas-animal');
      if (canvas) _scenes['animal'] = _createScene(canvas, 'animal');
    } else if (_mode === 'plant') {
      const canvas = document.getElementById('bio-canvas-plant');
      if (canvas) _scenes['plant'] = _createScene(canvas, 'plant');
    } else if (_mode === 'compare') {
      const cL = document.getElementById('bio-canvas-left');
      const cR = document.getElementById('bio-canvas-right');
      if (cL) _scenes['left'] = _createScene(cL, 'animal');
      if (cR) _scenes['right'] = _createScene(cR, 'plant');
    }
  }

  function _createScene(canvas, cellType) {
    const THREE = window.THREE;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.physicallyCorrectLights = true;

    const wrap = canvas.parentElement;
    const W = wrap.clientWidth || 400;
    const H = wrap.clientHeight || 400;
    renderer.setSize(W, H);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060810);
    scene.fog = new THREE.FogExp2(0x060810, 0.022);

    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 300);
    camera.position.set(0, 3, 22);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envScene = _buildEnvScene(THREE);
    const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
    scene.environment = envMap;
    pmremGenerator.dispose();
    envScene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });

    const keyLight = new THREE.DirectionalLight(0xfff4e8, 2.8);
    keyLight.position.set(12, 20, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 80;
    keyLight.shadow.camera.left = -25;
    keyLight.shadow.camera.right = 25;
    keyLight.shadow.camera.top = 25;
    keyLight.shadow.camera.bottom = -25;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xb0c8ff, 0.9);
    fillLight.position.set(-10, 5, -8);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffeedd, 0.6);
    rimLight.position.set(0, -10, -15);
    scene.add(rimLight);

    const ambientLight = new THREE.HemisphereLight(0x334466, 0x111122, 0.6);
    scene.add(ambientLight);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 6;
    controls.maxDistance = 45;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.target.set(0, 0, 0);

    const meshMap = {};
    _buildCell3D(scene, cellType, meshMap, renderer);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    function _onPointerDown(e) {
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      pointerDownPos = { x: cx, y: cy };
    }

    function _onPointerUp(e) {
      const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
      const dx = Math.abs(cx - pointerDownPos.x);
      const dy = Math.abs(cy - pointerDownPos.y);
      if (dx > 6 || dy > 6) return;

      const rect = canvas.getBoundingClientRect();
      pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((cy - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const allMeshes = [];
      Object.values(meshMap).forEach(arr => arr.forEach(m => allMeshes.push(m)));
      const hits = raycaster.intersectObjects(allMeshes, true);

      if (hits.length > 0) {
        controls.autoRotate = false;
        let orgId = null;
        let obj = hits[0].object;
        while (obj) {
          if (obj.userData && obj.userData.orgId) { orgId = obj.userData.orgId; break; }
          obj = obj.parent;
        }
        if (orgId) _selectOrg(orgId, cellType);
      } else {
        controls.autoRotate = true;
        _closeDetail();
      }
    }

    canvas.addEventListener('pointerdown', _onPointerDown);
    canvas.addEventListener('pointerup', _onPointerUp);
    canvas.addEventListener('touchstart', _onPointerDown, { passive: true });
    canvas.addEventListener('touchend', _onPointerUp, { passive: true });

    const ro = new ResizeObserver(() => {
      if (!wrap.clientWidth) return;
      const nW = wrap.clientWidth;
      const nH = wrap.clientHeight;
      renderer.setSize(nW, nH);
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
    });
    ro.observe(wrap);

    let rafId;
    function animate() {
      rafId = requestAnimationFrame(animate);
      controls.update();
      _animateOrganelles(meshMap, cellType);
      renderer.render(scene, camera);
    }
    animate();

    return {
      renderer, scene, camera, controls, meshMap,
      dispose() {
        cancelAnimationFrame(rafId);
        ro.disconnect();
        canvas.removeEventListener('pointerdown', _onPointerDown);
        canvas.removeEventListener('pointerup', _onPointerUp);
        canvas.removeEventListener('touchstart', _onPointerDown);
        canvas.removeEventListener('touchend', _onPointerUp);
        controls.dispose();
        scene.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach(m => m.dispose());
          }
        });
        envMap.dispose();
        renderer.dispose();
      },
      highlightOrg(orgId) {
        Object.entries(meshMap).forEach(([id, meshes]) => {
          meshes.forEach(m => {
            m.traverse(child => {
              if (!child.isMesh) return;
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach(mt => {
                if (id === orgId) {
                  mt.opacity = mt.userData.baseOpacity !== undefined ? mt.userData.baseOpacity : 1.0;
                  mt.transparent = mt.userData.baseTransparent !== undefined ? mt.userData.baseTransparent : false;
                  if (mt.emissive) mt.emissive.setHex(0x222222);
                  mt.emissiveIntensity = 0.4;
                } else {
                  mt.transparent = true;
                  mt.opacity = 0.055;
                  if (mt.emissive) mt.emissive.setHex(0x000000);
                  mt.emissiveIntensity = 0;
                }
              });
            });
          });
        });
      },
      clearHighlight() {
        Object.values(meshMap).forEach(meshes => {
          meshes.forEach(m => {
            m.traverse(child => {
              if (!child.isMesh) return;
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach(mt => {
                mt.opacity = mt.userData.baseOpacity !== undefined ? mt.userData.baseOpacity : 1.0;
                mt.transparent = mt.userData.baseTransparent !== undefined ? mt.userData.baseTransparent : false;
                if (mt.emissive) mt.emissive.setHex(0x000000);
                mt.emissiveIntensity = 0;
              });
            });
          });
        });
      },
    };
  }

  function _buildEnvScene(THREE) {
    const envScene = new THREE.Scene();
    const addLight = (color, intensity, x, y, z) => {
      const light = new THREE.PointLight(color, intensity, 100);
      light.position.set(x, y, z);
      envScene.add(light);
    };
    addLight(0x8888ff, 8, -20, 20, 20);
    addLight(0xffd4a0, 6, 20, 10, -10);
    addLight(0x44aaff, 4, 0, -20, 20);
    addLight(0xffeedd, 3, 10, 20, 10);
    addLight(0x6688cc, 2, -15, -10, -15);
    const geo = new THREE.SphereGeometry(50, 16, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0x111122, side: THREE.BackSide, roughness: 1 });
    envScene.add(new THREE.Mesh(geo, mat));
    return envScene;
  }

  let _animTime = 0;
  function _animateOrganelles(meshMap, cellType) {
    _animTime += 0.008;
    const T = window.THREE;
    if (!T) return;

    if (meshMap['mitochondria']) {
      meshMap['mitochondria'].forEach((grp, i) => {
        if (!grp.userData.animOffset) grp.userData.animOffset = i * 1.3;
        const off = grp.userData.animOffset;
        grp.rotation.y += 0.003;
        grp.position.y += Math.sin(_animTime * 0.7 + off) * 0.0018;
      });
    }
    if (meshMap['nucleus'] && meshMap['nucleus'][0]) {
      meshMap['nucleus'][0].rotation.y += 0.0015;
      meshMap['nucleus'][0].rotation.x += 0.0008;
    }
    if (meshMap['golgi'] && meshMap['golgi'][0]) {
      meshMap['golgi'][0].rotation.z += 0.002;
    }
    if (cellType === 'plant' && meshMap['chloroplast']) {
      meshMap['chloroplast'].forEach((grp, i) => {
        if (!grp.userData.animOffset) grp.userData.animOffset = i * 0.9;
        grp.rotation.y += 0.002;
        grp.position.y += Math.sin(_animTime * 0.5 + grp.userData.animOffset) * 0.001;
      });
    }
  }

  function _buildCell3D(scene, cellType, meshMap, renderer) {
    const THREE = window.THREE;

    function hexToNum(str) { return parseInt(str.replace('#', ''), 16); }

    function makeMat(hexColor, opts = {}) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: hexToNum(hexColor),
        roughness: opts.roughness !== undefined ? opts.roughness : 0.35,
        metalness: opts.metalness !== undefined ? opts.metalness : 0.0,
        transparent: opts.transparent || false,
        opacity: opts.opacity !== undefined ? opts.opacity : 1.0,
        side: opts.side || THREE.FrontSide,
        depthWrite: opts.depthWrite !== undefined ? opts.depthWrite : true,
        clearcoat: opts.clearcoat !== undefined ? opts.clearcoat : 0.0,
        clearcoatRoughness: opts.clearcoatRoughness !== undefined ? opts.clearcoatRoughness : 0.2,
        transmission: opts.transmission !== undefined ? opts.transmission : 0.0,
        thickness: opts.thickness !== undefined ? opts.thickness : 0.5,
        ior: opts.ior !== undefined ? opts.ior : 1.45,
        sheen: opts.sheen !== undefined ? opts.sheen : 0.0,
        sheenColor: opts.sheenColor !== undefined ? new THREE.Color(opts.sheenColor) : new THREE.Color(0xffffff),
        sheenRoughness: opts.sheenRoughness !== undefined ? opts.sheenRoughness : 0.5,
        emissive: new THREE.Color(opts.emissive !== undefined ? opts.emissive : 0x000000),
        emissiveIntensity: opts.emissiveIntensity !== undefined ? opts.emissiveIntensity : 0.0,
      });
      mat.userData.baseOpacity = mat.opacity;
      mat.userData.baseTransparent = mat.transparent;
      return mat;
    }

    function registerMesh(id, mesh) {
      mesh.userData.orgId = id;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
      mesh.traverse(child => {
        if (child.isMesh) {
          child.userData.orgId = id;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      scene.add(mesh);
      if (!meshMap[id]) meshMap[id] = [];
      meshMap[id].push(mesh);
      return mesh;
    }

    function makeCellMembrane(isPlant) {
      const col = ORGANELLES['cell_membrane'].color;
      if (isPlant) {
        const wallCol = ORGANELLES['cell_wall'].color;
        const wallGeo = new THREE.BoxGeometry(15, 15, 15);
        const wallMat = makeMat(wallCol, {
          transparent: true, opacity: 0.07, depthWrite: false,
          side: THREE.FrontSide, roughness: 0.9,
        });
        registerMesh('cell_wall', new THREE.Mesh(wallGeo, wallMat));

        const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(15, 15, 15));
        const edgeMat = new THREE.LineBasicMaterial({
          color: hexToNum(wallCol), transparent: true, opacity: 0.25,
        });
        edgeMat.userData.baseOpacity = 0.25;
        edgeMat.userData.baseTransparent = true;
        const edges = new THREE.LineSegments(edgeGeo, edgeMat);
        edges.userData.orgId = 'cell_wall';
        scene.add(edges);
        if (!meshMap['cell_wall']) meshMap['cell_wall'] = [];
        meshMap['cell_wall'].push(edges);

        const memGeo = new THREE.BoxGeometry(14.2, 14.2, 14.2);
        const memMat = makeMat(col, {
          transparent: true, opacity: 0.05, depthWrite: false,
          side: THREE.BackSide, roughness: 0.5,
        });
        registerMesh('cell_membrane', new THREE.Mesh(memGeo, memMat));
      } else {
        const geo = new THREE.SphereGeometry(7.2, 64, 64);
        const mat = makeMat(col, {
          transparent: true, opacity: 0.06, depthWrite: false,
          side: THREE.BackSide, roughness: 0.3,
          transmission: 0.0,
        });
        registerMesh('cell_membrane', new THREE.Mesh(geo, mat));

        const outerGeo = new THREE.SphereGeometry(7.3, 48, 48);
        const outerMat = makeMat(col, {
          transparent: true, opacity: 0.12, depthWrite: false,
          side: THREE.FrontSide, roughness: 0.2, metalness: 0.0,
          clearcoat: 0.8, clearcoatRoughness: 0.1,
          wireframe: false,
        });
        outerMat.userData.baseOpacity = 0.12;
        outerMat.userData.baseTransparent = true;
        const outerMesh = new THREE.Mesh(outerGeo, outerMat);
        outerMesh.userData.orgId = 'cell_membrane';
        scene.add(outerMesh);
        if (!meshMap['cell_membrane']) meshMap['cell_membrane'] = [];
        meshMap['cell_membrane'].push(outerMesh);
      }
    }

    function makeNucleus(pos, radius) {
      const grp = new THREE.Group();
      grp.userData.orgId = 'nucleus';

      const bodyGeo = new THREE.SphereGeometry(radius, 64, 64);
      const bodyMat = makeMat(ORGANELLES['nucleus'].color, {
        roughness: 0.2,
        metalness: 0.0,
        transparent: true,
        opacity: 0.88,
        transmission: 0.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        emissive: ORGANELLES['nucleus'].color,
        emissiveIntensity: 0.04,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      grp.add(body);

      const envelopeGeo = new THREE.SphereGeometry(radius * 1.045, 48, 48);
      const envelopeMat = makeMat(ORGANELLES['nucleus'].color, {
        roughness: 0.15, metalness: 0.1,
        transparent: true, opacity: 0.18, depthWrite: false,
        side: THREE.FrontSide,
        clearcoat: 1.0, clearcoatRoughness: 0.0,
      });
      grp.add(new THREE.Mesh(envelopeGeo, envelopeMat));

      const poreCount = 18;
      for (let i = 0; i < poreCount; i++) {
        const phi = Math.acos(-1 + (2 * i) / poreCount);
        const theta = Math.sqrt(poreCount * Math.PI) * phi;
        const px = Math.sin(phi) * Math.cos(theta) * (radius * 1.06);
        const py = Math.cos(phi) * (radius * 1.06);
        const pz = Math.sin(phi) * Math.sin(theta) * (radius * 1.06);
        const poreGeo = new THREE.TorusGeometry(radius * 0.085, radius * 0.022, 8, 16);
        const poreMat = makeMat('#c8b8ff', { roughness: 0.3, metalness: 0.3, transparent: true, opacity: 0.75 });
        const pore = new THREE.Mesh(poreGeo, poreMat);
        pore.position.set(px, py, pz);
        pore.lookAt(0, 0, 0);
        grp.add(pore);
      }

      const nlGeo = new THREE.SphereGeometry(radius * 0.38, 32, 32);
      const nlMat = makeMat(ORGANELLES['nucleolus'].color, {
        roughness: 0.15, metalness: 0.0,
        emissive: ORGANELLES['nucleolus'].color, emissiveIntensity: 0.12,
        clearcoat: 0.8, clearcoatRoughness: 0.05,
      });
      const nl = new THREE.Mesh(nlGeo, nlMat);
      nl.position.set(radius * 0.22, radius * 0.12, 0);
      nl.userData.orgId = 'nucleolus';
      grp.add(nl);

      if (!meshMap['nucleolus']) meshMap['nucleolus'] = [];
      meshMap['nucleolus'].push(nl);

      grp.position.set(...pos);
      registerMesh('nucleus', grp);
    }

    function makeMitochondrion(pos, rotation) {
      const grp = new THREE.Group();
      const col = ORGANELLES['mitochondria'].color;

      const outerPts = [];
      for (let i = 0; i <= 32; i++) {
        const t = i / 32;
        const angle = t * Math.PI;
        outerPts.push(new THREE.Vector2(
          Math.sin(angle) * 0.58 + (Math.sin(angle * 2) * 0.04),
          Math.cos(angle) * 1.8
        ));
      }
      const outerGeo = new THREE.LatheGeometry(outerPts, 32);
      const outerMat = makeMat(col, {
        roughness: 0.25, metalness: 0.0,
        clearcoat: 0.9, clearcoatRoughness: 0.1,
        transparent: true, opacity: 0.92,
        emissive: col, emissiveIntensity: 0.06,
      });
      const outerMesh = new THREE.Mesh(outerGeo, outerMat);
      outerMesh.rotation.z = Math.PI / 2;
      grp.add(outerMesh);

      const innerCol = '#c04040';
      const innerMat = makeMat(innerCol, { roughness: 0.4, metalness: 0.0, transparent: true, opacity: 0.65 });
      const cristaCount = 6;
      for (let i = 0; i < cristaCount; i++) {
        const t = (i / cristaCount - 0.5) * 2.8;
        const cristaGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.07, 20);
        const crista = new THREE.Mesh(cristaGeo, innerMat.clone());
        crista.rotation.z = Math.PI / 2;
        crista.position.x = t * 0.5;
        crista.scale.y = 0.7 + Math.random() * 0.3;
        grp.add(crista);
      }

      const matrixGeo = new THREE.SphereGeometry(0.44, 16, 16);
      matrixGeo.scale(3.2, 1, 1);
      const matrixMat = makeMat('#a03030', { transparent: true, opacity: 0.25, depthWrite: false, roughness: 0.8 });
      grp.add(new THREE.Mesh(matrixGeo, matrixMat));

      grp.position.set(...pos);
      grp.rotation.set(...rotation);
      registerMesh('mitochondria', grp);
      return grp;
    }

    function makeRoughER(pos) {
      const grp = new THREE.Group();
      const col = ORGANELLES['rough_er'].color;
      const ribCol = ORGANELLES['ribosome'].color;

      const layerCount = 5;
      for (let li = 0; li < layerCount; li++) {
        const r = 1.35 - li * 0.04;
        const pts = [];
        for (let j = 0; j <= 32; j++) {
          const t = j / 32;
          pts.push(new THREE.Vector2(r * 0.12, r * (t * 2 - 1)));
        }
        const discGeo = new THREE.CylinderGeometry(r, r, 0.1, 28);
        const discMat = makeMat(col, {
          roughness: 0.3, metalness: 0.0,
          transparent: true, opacity: 0.82 - li * 0.05,
          clearcoat: 0.5, clearcoatRoughness: 0.2,
        });
        const disc = new THREE.Mesh(discGeo, discMat);
        disc.position.y = li * 0.32;
        grp.add(disc);

        const ribCount = 10;
        for (let ri = 0; ri < ribCount; ri++) {
          const angle = (ri / ribCount) * Math.PI * 2 + li * 0.3;
          const rx = Math.cos(angle) * (r + 0.04);
          const rz = Math.sin(angle) * (r + 0.04);
          const ribGeo = new THREE.SphereGeometry(0.075, 10, 10);
          const ribMat = makeMat(ribCol, {
            roughness: 0.2, metalness: 0.0,
            emissive: ribCol, emissiveIntensity: 0.18,
          });
          const rib = new THREE.Mesh(ribGeo, ribMat);
          rib.position.set(rx, li * 0.32 + 0.08, rz);
          rib.userData.orgId = 'ribosome';
          grp.add(rib);
          if (!meshMap['ribosome']) meshMap['ribosome'] = [];
          meshMap['ribosome'].push(rib);
        }
      }

      grp.position.set(...pos);
      grp.rotation.set(0.35, 0.25, 0.15);
      registerMesh('rough_er', grp);
    }

    function makeSmoothER(pos) {
      const grp = new THREE.Group();
      const col = ORGANELLES['smooth_er'].color;

      const tubeMat = makeMat(col, {
        roughness: 0.2, metalness: 0.0,
        transparent: true, opacity: 0.88,
        clearcoat: 1.0, clearcoatRoughness: 0.05,
        emissive: col, emissiveIntensity: 0.05,
      });

      const paths = [
        [new THREE.Vector3(-1.4, 0.6, 0), new THREE.Vector3(-0.6, 1.3, 0.4), new THREE.Vector3(0.3, 1.0, -0.3), new THREE.Vector3(1.0, 0.2, 0.2), new THREE.Vector3(1.5, -0.7, 0)],
        [new THREE.Vector3(-1.0, -0.3, 0.3), new THREE.Vector3(-0.1, -0.9, -0.2), new THREE.Vector3(0.9, -0.5, 0.4)],
        [new THREE.Vector3(-0.5, 0.0, -0.8), new THREE.Vector3(0.4, 0.5, -0.5), new THREE.Vector3(0.8, 0.0, 0.3)],
      ];

      paths.forEach(pts => {
        const curve = new THREE.CatmullRomCurve3(pts);
        const geo = new THREE.TubeGeometry(curve, 20, 0.19, 10, false);
        grp.add(new THREE.Mesh(geo, tubeMat.clone()));
      });

      grp.position.set(...pos);
      registerMesh('smooth_er', grp);
    }

    function makeGolgi(pos) {
      const grp = new THREE.Group();
      const col = ORGANELLES['golgi'].color;
      const stackCount = 6;
      const maxR = 1.5;

      for (let i = 0; i < stackCount; i++) {
        const t = i / (stackCount - 1);
        const r = maxR * (0.75 + Math.sin(t * Math.PI) * 0.35);
        const curvature = (t - 0.5) * 1.2;

        const pts = [];
        const segments = 24;
        for (let s = 0; s <= segments; s++) {
          const angle = (s / segments - 0.5) * Math.PI * 1.4;
          pts.push(new THREE.Vector2(
            Math.cos(angle) * r + curvature * 0.18,
            Math.sin(angle) * 0.12
          ));
        }
        const stackGeo = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(Math.abs(p.x), p.y)), 32);
        const brightness = 0.7 + i * 0.06;
        const stackMat = makeMat(col, {
          roughness: 0.25 + i * 0.04,
          metalness: 0.0,
          transparent: true,
          opacity: 0.88,
          clearcoat: 0.8 - i * 0.08,
          clearcoatRoughness: 0.1,
          emissive: col,
          emissiveIntensity: 0.06,
        });
        const stackMesh = new THREE.Mesh(stackGeo, stackMat);
        stackMesh.position.y = (i - stackCount / 2) * 0.22 + Math.sin(i * 0.8) * 0.08;
        stackMesh.rotation.x = Math.PI / 2;
        grp.add(stackMesh);
      }

      const vesiclePositions = [[1.9, -0.7, 0.2], [2.2, -0.3, -0.1], [2.4, -1.1, 0.0]];
      vesiclePositions.forEach(vp => {
        const vGeo = new THREE.SphereGeometry(0.22, 16, 16);
        const vMat = makeMat(col, { roughness: 0.15, clearcoat: 1.0, clearcoatRoughness: 0.05 });
        grp.add(new THREE.Mesh(vGeo, vMat));
        grp.children[grp.children.length - 1].position.set(...vp);
      });

      grp.position.set(...pos);
      grp.rotation.x = 0.25;
      registerMesh('golgi', grp);
    }

    function makeLysosome(pos) {
      const col = ORGANELLES['lysosome'].color;
      const grp = new THREE.Group();

      const outerGeo = new THREE.SphereGeometry(0.42, 24, 24);
      const outerMat = makeMat(col, {
        roughness: 0.15, metalness: 0.0,
        clearcoat: 1.0, clearcoatRoughness: 0.05,
        transparent: true, opacity: 0.92,
        emissive: col, emissiveIntensity: 0.1,
      });
      grp.add(new THREE.Mesh(outerGeo, outerMat));

      const innerGeo = new THREE.SphereGeometry(0.28, 16, 16);
      const innerMat = makeMat('#ff88cc', {
        roughness: 0.4, transparent: true, opacity: 0.5,
        emissive: '#ff44aa', emissiveIntensity: 0.15,
      });
      grp.add(new THREE.Mesh(innerGeo, innerMat));

      grp.position.set(...pos);
      registerMesh('lysosome', grp);
    }

    function makeCentrioles(pos) {
      const grp = new THREE.Group();
      const col = ORGANELLES['centriole'].color;

      function makeBarrel(offsetX, offsetY, offsetZ, rotX, rotY, rotZ) {
        const barrel = new THREE.Group();
        const tripletCount = 9;
        const barrelRadius = 0.28;
        const tripletRadius = 0.055;
        const barrelHeight = 0.75;

        for (let t = 0; t < tripletCount; t++) {
          const angle = (t / tripletCount) * Math.PI * 2;
          const bx = Math.cos(angle) * barrelRadius;
          const bz = Math.sin(angle) * barrelRadius;
          for (let sub = 0; sub < 3; sub++) {
            const subAngle = angle + (sub - 1) * 0.18;
            const sx = Math.cos(subAngle) * (barrelRadius + sub * 0.04);
            const sz = Math.sin(subAngle) * (barrelRadius + sub * 0.04);
            const tubGeo = new THREE.CylinderGeometry(tripletRadius, tripletRadius, barrelHeight, 8);
            const tubMat = makeMat(col, {
              roughness: 0.3, metalness: 0.2,
              clearcoat: 0.6, clearcoatRoughness: 0.15,
            });
            const tub = new THREE.Mesh(tubGeo, tubMat);
            tub.position.set(sx, 0, sz);
            barrel.add(tub);
          }
        }
        barrel.position.set(offsetX, offsetY, offsetZ);
        barrel.rotation.set(rotX, rotY, rotZ);
        return barrel;
      }

      grp.add(makeBarrel(0, 0, 0, 0, 0, 0));
      grp.add(makeBarrel(0.75, 0, 0, Math.PI / 2, 0, 0));

      grp.position.set(...pos);
      registerMesh('centriole', grp);
    }

    function makeVacuole(pos, radius, id) {
      const org = ORGANELLES[id];
      const grp = new THREE.Group();
      const isLarge = id === 'central_vacuole';

      const outerGeo = new THREE.SphereGeometry(radius, 32, 32);
      const outerMat = makeMat(org.color, {
        roughness: 0.05, metalness: 0.0,
        transparent: true,
        opacity: isLarge ? 0.12 : 0.78,
        depthWrite: !isLarge,
        clearcoat: 1.0, clearcoatRoughness: 0.02,
        transmission: isLarge ? 0.0 : 0.0,
        emissive: isLarge ? org.color : '#000000',
        emissiveIntensity: isLarge ? 0.02 : 0,
      });
      grp.add(new THREE.Mesh(outerGeo, outerMat));

      if (isLarge) {
        const innerGeo = new THREE.SphereGeometry(radius * 0.96, 24, 24);
        const innerMat = makeMat(org.color, {
          side: THREE.BackSide,
          roughness: 0.05, transparent: true, opacity: 0.06, depthWrite: false,
        });
        grp.add(new THREE.Mesh(innerGeo, innerMat));
      }

      grp.position.set(...pos);
      registerMesh(id, grp);
    }

    function makeChloroplast(pos, rotation) {
      const grp = new THREE.Group();
      const col = ORGANELLES['chloroplast'].color;

      const outerPts = [];
      for (let i = 0; i <= 32; i++) {
        const angle = (i / 32) * Math.PI;
        outerPts.push(new THREE.Vector2(
          Math.sin(angle) * 0.72,
          Math.cos(angle) * 1.55
        ));
      }
      const outerGeo = new THREE.LatheGeometry(outerPts, 32);
      const outerMat = makeMat(col, {
        roughness: 0.3, metalness: 0.0,
        clearcoat: 0.7, clearcoatRoughness: 0.2,
        transparent: true, opacity: 0.9,
        emissive: col, emissiveIntensity: 0.08,
      });
      const outerMesh = new THREE.Mesh(outerGeo, outerMat);
      outerMesh.rotation.z = Math.PI / 2;
      grp.add(outerMesh);

      const innerMat = makeMat('#1a5c2a', {
        roughness: 0.5, transparent: true, opacity: 0.55,
      });
      const innerPts = [];
      for (let i = 0; i <= 32; i++) {
        const angle = (i / 32) * Math.PI;
        innerPts.push(new THREE.Vector2(Math.sin(angle) * 0.58, Math.cos(angle) * 1.3));
      }
      const innerGeo = new THREE.LatheGeometry(innerPts, 24);
      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      innerMesh.rotation.z = Math.PI / 2;
      grp.add(innerMesh);

      const granaPositions = [[-0.5, 0, 0], [0, 0, 0.2], [0.5, 0, -0.1]];
      granaPositions.forEach(gp => {
        const stackCount = 5;
        for (let s = 0; s < stackCount; s++) {
          const thylGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16);
          const thylMat = makeMat('#115520', {
            roughness: 0.2, metalness: 0.0,
            emissive: '#0a3312', emissiveIntensity: 0.2,
            clearcoat: 0.5,
          });
          const thyl = new THREE.Mesh(thylGeo, thylMat);
          thyl.position.set(gp[0], gp[1] + s * 0.07 - 0.14, gp[2]);
          thyl.userData.orgId = 'chloroplast';
          grp.add(thyl);
        }
      });

      grp.position.set(...pos);
      if (rotation) grp.rotation.set(...rotation);
      registerMesh('chloroplast', grp);
      return grp;
    }

    function makePeroxisome(pos) {
      const col = ORGANELLES['peroxisome'].color;
      const grp = new THREE.Group();

      const geo = new THREE.SphereGeometry(0.32, 20, 20);
      const mat = makeMat(col, {
        roughness: 0.2, metalness: 0.0,
        clearcoat: 1.0, clearcoatRoughness: 0.05,
        emissive: col, emissiveIntensity: 0.12,
        transparent: true, opacity: 0.9,
      });
      grp.add(new THREE.Mesh(geo, mat));

      const crystalGeo = new THREE.OctahedronGeometry(0.14, 0);
      const crystalMat = makeMat('#ffffff', {
        roughness: 0.0, metalness: 0.1,
        transparent: true, opacity: 0.45,
      });
      grp.add(new THREE.Mesh(crystalGeo, crystalMat));

      grp.position.set(...pos);
      registerMesh('peroxisome', grp);
    }

    function makeCytoskeleton(isPlant) {
      const col = ORGANELLES['cytoskeleton'].color;
      const grp = new THREE.Group();
      const scale = isPlant ? 6.5 : 6.0;

      const filaments = [
        { pts: [new THREE.Vector3(-scale, -scale * 0.7, -scale * 0.3), new THREE.Vector3(scale * 0.7, scale * 0.5, scale * 0.4)], r: 0.032 },
        { pts: [new THREE.Vector3(-scale * 0.8, scale * 0.6, scale * 0.2), new THREE.Vector3(scale * 0.6, -scale * 0.7, -scale * 0.3)], r: 0.032 },
        { pts: [new THREE.Vector3(-scale * 0.4, scale * 0.2, scale * 0.7), new THREE.Vector3(scale * 0.3, scale * 0.1, -scale * 0.6)], r: 0.025 },
        { pts: [new THREE.Vector3(0, -scale * 0.8, scale * 0.4), new THREE.Vector3(scale * 0.2, scale * 0.7, -scale * 0.3)], r: 0.025 },
        { pts: [new THREE.Vector3(-scale * 0.5, 0, -scale * 0.8), new THREE.Vector3(scale * 0.6, scale * 0.3, scale * 0.5)], r: 0.02 },
      ];

      filaments.forEach(f => {
        const curve = new THREE.LineCurve3(f.pts[0], f.pts[1]);
        const geo = new THREE.TubeGeometry(curve, 4, f.r, 6, false);
        const mat = makeMat(col, {
          roughness: 0.7, transparent: true, opacity: 0.18, depthWrite: false,
        });
        grp.add(new THREE.Mesh(geo, mat));
      });

      registerMesh('cytoskeleton', grp);
    }

    function makeCytoplasm(isPlant) {
      const col = ORGANELLES['cytoplasm'].color;
      if (isPlant) {
        const geo = new THREE.BoxGeometry(13.5, 13.5, 13.5);
        const mat = makeMat(col, { transparent: true, opacity: 0.03, depthWrite: false, side: THREE.FrontSide, roughness: 1 });
        registerMesh('cytoplasm', new THREE.Mesh(geo, mat));
      } else {
        const geo = new THREE.SphereGeometry(6.8, 32, 32);
        const mat = makeMat(col, { transparent: true, opacity: 0.03, depthWrite: false, side: THREE.FrontSide, roughness: 1 });
        registerMesh('cytoplasm', new THREE.Mesh(geo, mat));
      }
    }

    function makePlasmodesmata() {
      const col = ORGANELLES['plasmodesmata'].color;
      const grp = new THREE.Group();
      const positions = [
        [7.6, 1.5, 0.5], [7.6, -1.0, 0.8], [7.6, 0.2, -1.2],
        [-7.6, 0.8, 0.3], [-7.6, -0.6, -0.8],
        [0.5, 7.6, 0.8], [-0.6, 7.6, -0.4],
        [0.3, -7.6, 0.5], [-0.5, -7.6, 0.7],
      ];
      positions.forEach(([x, y, z]) => {
        const geo = new THREE.CylinderGeometry(0.09, 0.09, 0.55, 10);
        const mat = makeMat(col, { roughness: 0.2, emissive: col, emissiveIntensity: 0.18 });
        const cyl = new THREE.Mesh(geo, mat);
        cyl.position.set(x, y, z);
        if (Math.abs(x) > Math.abs(y)) cyl.rotation.z = Math.PI / 2;
        else cyl.rotation.x = Math.PI / 2;
        grp.add(cyl);
      });
      registerMesh('plasmodesmata', grp);
    }

    makeCytoplasm(cellType === 'plant');
    makeCellMembrane(cellType === 'plant');
    makeCytoskeleton(cellType === 'plant');

    if (cellType === 'animal') {
      makeNucleus([0, 0.4, 0], 1.9);
      makeMitochondrion([-3.2, 1.8, 1.2], [0, 0, 0.4]);
      makeMitochondrion([3.0, -2.0, 0.8], [0, 0.3, -0.5]);
      makeMitochondrion([-1.8, -3.0, 1.5], [0.2, 0, 0.6]);
      makeMitochondrion([2.0, 2.8, -1.8], [0, 0.5, 0.2]);
      makeRoughER([2.4, 1.0, 1.8]);
      makeSmoothER([-2.2, -1.2, 2.0]);
      makeGolgi([-2.8, 2.0, -1.2]);
      makeLysosome([3.0, 2.8, -0.6]);
      makeLysosome([-1.2, 3.2, 1.2]);
      makeLysosome([3.4, -1.2, 1.4]);
      makeCentrioles([0.6, -2.5, 1.0]);
      makeVacuole([-3.4, -0.6, -1.8], 0.52, 'vacuole');
      makeVacuole([2.8, -3.2, 0.6], 0.42, 'vacuole');
      makePeroxisome([3.2, 0.6, -2.2]);
      makePeroxisome([-3.0, 2.8, 0.6]);
    } else {
      makeVacuole([0, 0, 0], 4.2, 'central_vacuole');
      makeNucleus([-4.0, 3.2, 1.2], 1.55);
      makeChloroplast([-4.8, 1.8, 1.8], [0, 0.3, 0.5]);
      makeChloroplast([-4.8, -1.6, 0.6], [0, -0.2, -0.4]);
      makeChloroplast([4.8, 1.8, 1.2], [0, 0.4, -0.3]);
      makeChloroplast([4.8, -1.6, 1.8], [0, 0.2, 0.5]);
      makeChloroplast([0.6, 4.8, -0.6], [0.4, 0, 0.2]);
      makeChloroplast([-0.6, -4.8, 0.6], [0.3, 0, -0.3]);
      makeMitochondrion([4.2, 3.8, 1.8], [0, 0, 0.5]);
      makeMitochondrion([-4.4, -3.2, 1.2], [0, 0.3, -0.4]);
      makeRoughER([4.0, -3.8, 1.8]);
      makeSmoothER([-3.8, 3.8, -1.8]);
      makeGolgi([4.4, 0.2, -2.8]);
      makeVacuole([-3.8, -2.2, -2.2], 0.48, 'vacuole');
      makePeroxisome([-4.8, 0.2, -2.2]);
      makePeroxisome([4.2, -1.8, -2.8]);
      makePlasmodesmata();
    }
  }

  function _selectOrg(orgId, cellType) {
    _selectedOrg = orgId;
    _showDetail(orgId);

    Object.values(_scenes).forEach(sc => { if (sc && sc.highlightOrg) sc.highlightOrg(orgId); });

    const org = ORGANELLES[orgId];
    if (org) {
      ['animal', 'plant', 'left', 'right'].forEach(k => {
        const el = document.getElementById(`bio-selected-label-${k}`);
        if (el) {
          el.textContent = org.label;
          el.style.display = 'block';
          el.style.borderColor = org.color + '66';
        }
      });
    }

    document.querySelectorAll('.bio-legend-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${orgId}'`));
    });
  }

  function _closeDetail() {
    _selectedOrg = null;
    const panel = document.getElementById('bio-detail');
    if (panel) panel.style.maxHeight = '0';
    Object.values(_scenes).forEach(sc => { if (sc && sc.clearHighlight) sc.clearHighlight(); });
    ['animal', 'plant', 'left', 'right'].forEach(k => {
      const el = document.getElementById(`bio-selected-label-${k}`);
      if (el) el.style.display = 'none';
    });
    document.querySelectorAll('.bio-legend-btn').forEach(btn => btn.classList.remove('active'));
  }

  function _showDetail(orgId) {
    const org = ORGANELLES[orgId];
    if (!org) return;
    const panel = document.getElementById('bio-detail');
    const inner = document.getElementById('bio-detail-inner');
    if (!panel || !inner) return;

    inner.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:.625rem;margin-bottom:.5rem;">
        <div style="width:42px;height:42px;border-radius:var(--r-lg);flex-shrink:0;
                    background:${org.color}22;border:1.5px solid ${org.color}55;
                    display:flex;align-items:center;justify-content:center;">
          <i class="ph ph-cell-signal-full" style="font-size:1.2rem;color:${org.color};"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;margin-bottom:2px;">
            <h2 style="font-size:var(--text-md);font-weight:800;color:var(--text-1);margin:0;letter-spacing:-.02em;">${org.label}</h2>
            <span style="font-size:.525rem;font-weight:700;padding:2px 7px;border-radius:99px;
                         background:${org.color}22;color:${org.color};border:1px solid ${org.color}44;">
              ${org.size}
            </span>
            ${org.present.length < 2 ? `<span style="font-size:.525rem;font-weight:700;padding:2px 7px;border-radius:99px;
                              background:var(--accent-subtle);color:var(--accent-text);
                              border:1px solid var(--accent-border);">
              ${org.present[0] === 'plant' ? 'Plant only' : 'Animal only'}
            </span>` : ''}
          </div>
        </div>
        <button onclick="ThreeDCell._closeDetail()"
                style="flex-shrink:0;background:none;border:none;cursor:pointer;
                       color:var(--text-4);padding:2px;font-size:1.1rem;line-height:1;">
          <i class="ph ph-x"></i>
        </button>
      </div>
      <div style="max-height:210px;overflow-y:auto;scrollbar-width:thin;">
        <div style="margin-bottom:.5rem;">
          <div style="font-size:.525rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
                      color:${org.color};margin-bottom:.25rem;">Function</div>
          <p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.65;margin:0;
                    border-left:2px solid ${org.color};padding-left:.5rem;">${org.function}</p>
        </div>
        <div style="margin-bottom:.5rem;padding:.45rem .7rem;border-radius:var(--r-md);
                    background:${org.color}0f;border:1px solid ${org.color}2a;">
          <div style="font-size:.525rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
                      color:${org.color};margin-bottom:.2rem;display:flex;align-items:center;gap:.3rem;">
            <i class="ph ph-lightbulb"></i> Analogy
          </div>
          <p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.55;margin:0;font-style:italic;">${org.analogy}</p>
        </div>
        <div style="margin-bottom:.5rem;">
          <div style="font-size:.525rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
                      color:var(--text-4);margin-bottom:.2rem;">Structure</div>
          <p style="font-size:var(--text-xs);color:var(--text-3);line-height:1.55;margin:0;">${org.structure}</p>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.25rem;margin-bottom:.5rem;">
          ${org.facts.map(f => `
            <div style="background:var(--bg-subtle);border:1px solid var(--border);
                        border-radius:var(--r-sm);padding:.25rem .4rem;
                        font-size:.565rem;color:var(--text-2);line-height:1.4;">
              <i class="ph ph-dot-outline" style="color:${org.color};margin-right:2px;"></i>${f}
            </div>`).join('')}
        </div>
        <div style="padding:.5rem .7rem;border-radius:var(--r-md);
                    background:var(--warning-subtle);border:1px solid var(--warning-border);">
          <div style="font-size:.525rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
                      color:var(--warning);margin-bottom:.2rem;display:flex;align-items:center;gap:.3rem;">
            <i class="ph ph-pencil-simple"></i> Exam Tip
          </div>
          <p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.55;margin:0;">${org.examTip}</p>
        </div>
      </div>`;

    panel.style.maxHeight = '340px';
  }

  function _buildSystemsView() {
    const sys = SYSTEMS[_systemIdx];
    const step = sys.steps[_systemStep];
    const totalSteps = sys.steps.length;

    return `
      <div style="height:100%;display:flex;flex-direction:column;overflow:hidden;">
        <div style="flex-shrink:0;display:flex;gap:.35rem;padding:.4rem .75rem;
                    overflow-x:auto;scrollbar-width:none;border-bottom:1px solid var(--border);
                    background:var(--bg-base);">
          ${SYSTEMS.map((s, i) => `
            <button onclick="ThreeDCell._setSystem(${i})"
                    style="font-size:.565rem;font-weight:700;padding:4px 11px;border-radius:99px;
                           border:1px solid ${i === _systemIdx ? s.color : 'var(--border)'};
                           background:${i === _systemIdx ? s.color + '22' : 'var(--bg-subtle)'};
                           color:${i === _systemIdx ? s.color : 'var(--text-3)'};
                           cursor:pointer;white-space:nowrap;font-family:var(--font);flex-shrink:0;
                           transition:all .15s;">
              ${s.title}
            </button>`).join('')}
        </div>
        <div style="flex:1 1 0;overflow-y:auto;padding:.75rem;">
          <div style="max-width:640px;margin:0 auto;">
            <div style="margin-bottom:.75rem;padding:.75rem 1rem;border-radius:var(--r-xl);
                        border:1.5px solid ${sys.color}44;background:${sys.color}0d;">
              <div style="font-size:var(--text-base);font-weight:800;color:var(--text-1);margin-bottom:.25rem;">
                ${sys.title}
              </div>
              <p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.65;margin:0;">${sys.description}</p>
              ${sys.plantOnly ? `<div style="margin-top:.4rem;font-size:.55rem;font-weight:700;color:var(--success);letter-spacing:.04em;display:flex;align-items:center;gap:.3rem;"><i class="ph ph-tree"></i> Plant cells only</div>` : ''}
            </div>
            <div style="display:flex;gap:.3rem;margin-bottom:.75rem;">
              ${sys.steps.map((s, i) => `
                <div style="flex:1;height:5px;border-radius:99px;
                            background:${i <= _systemStep ? sys.color : 'var(--border)'};
                            cursor:pointer;transition:background .2s;"
                     onclick="ThreeDCell._setStep(${i})"></div>`).join('')}
            </div>
            <div style="background:var(--bg-base);border:2px solid ${step.color}55;
                        border-radius:var(--r-xl);overflow:hidden;margin-bottom:.75rem;">
              <div style="padding:.6rem 1rem;background:${step.color}16;border-bottom:1px solid ${step.color}33;">
                <div style="font-size:var(--text-base);font-weight:800;color:${step.color};">${step.label}</div>
                <div style="font-size:.55rem;font-weight:600;color:var(--text-4);
                            text-transform:uppercase;letter-spacing:.05em;margin-top:1px;">
                  ${ORGANELLES[step.organelle]?.label || step.organelle}
                </div>
              </div>
              <div style="padding:.875rem 1rem;">
                <p style="font-size:var(--text-sm);color:var(--text-2);line-height:1.72;margin:0;">${step.desc}</p>
              </div>
            </div>
            <div style="background:var(--bg-subtle);border:1px solid var(--border);
                        border-radius:var(--r-xl);padding:.6rem .875rem;margin-bottom:.75rem;">
              <div style="font-size:.525rem;font-weight:800;letter-spacing:.06em;
                          text-transform:uppercase;color:var(--text-4);margin-bottom:.4rem;">
                Pathway
              </div>
              <div style="display:flex;align-items:center;flex-wrap:wrap;gap:.25rem;">
                ${sys.steps.map((s, i) => `
                  <span style="font-size:.565rem;font-weight:700;padding:2px 8px;
                               border-radius:99px;cursor:pointer;transition:all .12s;
                               background:${i === _systemStep ? s.color : 'var(--bg-muted)'};
                               color:${i === _systemStep ? '#fff' : 'var(--text-3)'};"
                        onclick="ThreeDCell._setStep(${i})">
                    ${i + 1}. ${ORGANELLES[s.organelle]?.label || s.organelle}
                  </span>
                  ${i < sys.steps.length - 1 ? '<i class="ph ph-arrow-right" style="color:var(--text-4);font-size:.65rem;"></i>' : ''}`).join('')}
              </div>
            </div>
            <div style="display:flex;gap:.5rem;justify-content:space-between;align-items:center;">
              <button class="bio-step-btn" onclick="ThreeDCell._prevStep()"
                      ${_systemStep === 0 ? 'disabled style="opacity:.4;cursor:not-allowed;"' : ''}>
                <i class="ph ph-arrow-left" style="margin-right:3px;"></i> Previous
              </button>
              <span style="font-size:var(--text-xs);color:var(--text-4);">${_systemStep + 1} / ${totalSteps}</span>
              <button class="bio-step-btn primary" onclick="ThreeDCell._nextStep()">
                ${_systemStep < totalSteps - 1 ? 'Next <i class="ph ph-arrow-right" style="margin-left:3px;"></i>' : 'Restart <i class="ph ph-arrows-clockwise" style="margin-left:3px;"></i>'}
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }

  function _buildQuizView() {
    if (_quizDone) return _buildQuizResults();
    const q = _shuffledQuiz[_quizIdx];
    const opts = _shuffle([...q.options]);
    const prog = (_quizIdx / _shuffledQuiz.length) * 100;

    return `
      <div style="height:100%;overflow-y:auto;padding:.875rem;">
        <div style="max-width:560px;margin:0 auto;">
          <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem;">
            <div style="flex:1;height:6px;border-radius:99px;background:var(--border);overflow:hidden;">
              <div style="width:${prog}%;height:100%;background:var(--accent);border-radius:99px;transition:width .3s;box-shadow:0 0 8px rgba(79,110,247,.4);"></div>
            </div>
            <span style="font-size:.58rem;font-weight:700;color:var(--text-3);white-space:nowrap;flex-shrink:0;">
              Q${_quizIdx + 1}/${_shuffledQuiz.length} &middot; Score: ${_quizScore}
            </span>
          </div>
          <div style="background:var(--bg-base);border:2px solid var(--accent-border);
                      border-radius:var(--r-xl);padding:1rem 1.25rem;margin-bottom:.875rem;">
            <div style="font-size:.55rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
                        color:var(--accent);margin-bottom:.5rem;">Question ${_quizIdx + 1}</div>
            <p style="font-size:var(--text-md);font-weight:600;color:var(--text-1);line-height:1.5;margin:0;">${q.q}</p>
          </div>
          <div id="bio-quiz-opts">
            ${opts.map(opt => {
              const org = ORGANELLES[opt];
              const label = org ? org.label : opt;
              let cls = '';
              if (_quizAnswered) {
                if (opt === q.a) cls = 'correct';
                else if (opt === _quizSelected) cls = 'wrong';
              }
              return `
                <button class="bio-quiz-opt ${cls}"
                        ${_quizAnswered ? 'disabled' : ''}
                        onclick="ThreeDCell._answerQuiz('${opt}','${q.a}')">
                  ${label}
                </button>`;
            }).join('')}
          </div>
          ${_quizAnswered ? `
            <div style="margin-top:.75rem;padding:.75rem 1rem;border-radius:var(--r-xl);
                        background:${_quizSelected === q.a ? 'var(--success-subtle)' : 'var(--danger-subtle)'};
                        border:1px solid ${_quizSelected === q.a ? 'var(--success-border)' : 'var(--danger-border)'};">
              <div style="font-size:.58rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
                          color:${_quizSelected === q.a ? 'var(--success)' : 'var(--danger)'};
                          margin-bottom:.35rem;display:flex;align-items:center;gap:.35rem;">
                <i class="ph ${_quizSelected === q.a ? 'ph-check-circle' : 'ph-x-circle'}"></i>
                ${_quizSelected === q.a ? 'Correct' : 'Incorrect'}
              </div>
              <p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.65;margin:0 0 .5rem;">
                ${ORGANELLES[q.a]?.function || ''}
              </p>
              <button class="bio-step-btn primary" onclick="ThreeDCell._nextQuestion()"
                      style="font-size:.58rem;padding:.3rem .875rem;">
                ${_quizIdx < _shuffledQuiz.length - 1 ? 'Next Question <i class="ph ph-arrow-right" style="margin-left:3px;"></i>' : 'See Results <i class="ph ph-flag-checkered" style="margin-left:3px;"></i>'}
              </button>
            </div>` : ''}
        </div>
      </div>`;
  }

  function _buildQuizResults() {
    const total = _shuffledQuiz.length;
    const pct = Math.round((_quizScore / total) * 100);
    const grade = pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good job' : pct >= 40 ? 'Keep practising' : 'More revision needed';
    const color = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--accent)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';
    const icon = pct >= 80 ? 'ph-trophy' : pct >= 60 ? 'ph-thumbs-up' : pct >= 40 ? 'ph-book-open' : 'ph-flask';

    return `
      <div style="height:100%;overflow-y:auto;padding:1.5rem .875rem;">
        <div style="max-width:480px;margin:0 auto;text-align:center;">
          <div style="font-size:3rem;line-height:1;margin-bottom:.5rem;color:${color};">
            <i class="ph ${icon}"></i>
          </div>
          <h2 style="font-size:var(--text-xl);font-weight:800;color:${color};margin-bottom:.25rem;">
            ${pct}% — ${grade}
          </h2>
          <p style="font-size:var(--text-sm);color:var(--text-3);margin-bottom:1.5rem;">
            You scored <strong>${_quizScore}</strong> out of <strong>${total}</strong> questions.
          </p>
          <div style="background:var(--bg-base);border:1px solid var(--border);border-radius:var(--r-xl);
                      padding:1rem;margin-bottom:1rem;text-align:left;">
            <div style="font-size:.55rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
                        color:var(--text-4);margin-bottom:.5rem;">Revision focus</div>
            ${pct < 100
              ? `<p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.72;">
                   Review the Animal Cell and Plant Cell 3D diagrams. Tap each organelle to read its function.
                   Pay particular attention to: ${['mitochondria', 'nucleus', 'chloroplast', 'golgi', 'ribosome'].map(id => ORGANELLES[id].label).join(', ')}.
                 </p>`
              : '<p style="color:var(--success);font-size:var(--text-sm);">Perfect score. You know all organelles.</p>'}
          </div>
          <div style="display:flex;gap:.625rem;justify-content:center;flex-wrap:wrap;">
            <button class="bio-step-btn primary" onclick="ThreeDCell._restartQuiz()" style="padding:.5rem 1.25rem;">
              <i class="ph ph-arrows-clockwise" style="margin-right:4px;"></i> Retake Quiz
            </button>
            <button class="bio-step-btn" onclick="ThreeDCell._setMode('animal')" style="padding:.5rem 1.25rem;">
              <i class="ph ph-atom" style="margin-right:4px;"></i> Study 3D Cells
            </button>
          </div>
        </div>
      </div>`;
  }

  function _setMode(mode) {
    _destroyAllScenes();
    _mode = mode;
    _selectedOrg = null;
    _systemStep = 0;

    const detail = document.getElementById('bio-detail');
    if (detail) detail.style.maxHeight = '0';

    const content = document.getElementById('bio-content');
    if (content) content.innerHTML = _buildContent();

    document.querySelectorAll('.bio-tab').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${mode}'`));
    });

    _updateOrgCount(mode);

    if (mode === 'animal' || mode === 'plant' || mode === 'compare') {
      _loadThree(() => _bootScenes());
    }
  }

  function _destroyAllScenes() {
    Object.values(_scenes).forEach(sc => { if (sc && sc.dispose) sc.dispose(); });
    _scenes = {};
  }

  function _setSystem(idx) {
    _systemIdx = idx;
    _systemStep = 0;
    const content = document.getElementById('bio-content');
    if (content) content.innerHTML = _buildContent();
  }

  function _setStep(idx) {
    _systemStep = idx;
    const content = document.getElementById('bio-content');
    if (content) content.innerHTML = _buildContent();
  }

  function _nextStep() {
    const sys = SYSTEMS[_systemIdx];
    _systemStep = _systemStep < sys.steps.length - 1 ? _systemStep + 1 : 0;
    const content = document.getElementById('bio-content');
    if (content) content.innerHTML = _buildContent();
  }

  function _prevStep() {
    if (_systemStep > 0) {
      _systemStep--;
      const content = document.getElementById('bio-content');
      if (content) content.innerHTML = _buildContent();
    }
  }

  function _answerQuiz(selected, correct) {
    if (_quizAnswered) return;
    _quizAnswered = true;
    _quizSelected = selected;
    if (selected === correct) _quizScore++;
    const content = document.getElementById('bio-content');
    if (content) content.innerHTML = _buildContent();
  }

  function _nextQuestion() {
    _quizIdx++;
    _quizAnswered = false;
    _quizSelected = null;
    if (_quizIdx >= _shuffledQuiz.length) _quizDone = true;
    const content = document.getElementById('bio-content');
    if (content) content.innerHTML = _buildContent();
  }

  function _restartQuiz() {
    _quizIdx = 0;
    _quizScore = 0;
    _quizAnswered = false;
    _quizSelected = null;
    _quizDone = false;
    _shuffledQuiz = _shuffle([...QUIZ_QUESTIONS]);
    const content = document.getElementById('bio-content');
    if (content) content.innerHTML = _buildContent();
  }

  function _back() {
    _destroyAllScenes();
    if (typeof _onBack === 'function') _onBack();
  }

  function _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  window.ThreeDCell = {
    open,
    _back,
    _setMode,
    _selectOrg,
    _closeDetail,
    _setSystem,
    _setStep,
    _nextStep,
    _prevStep,
    _answerQuiz,
    _nextQuestion,
    _restartQuiz,
  };

}());
