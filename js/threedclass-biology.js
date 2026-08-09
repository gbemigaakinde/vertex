/* ============================================================
   js/threedclass-biology.js — 3D Cell Structure & Systems
   ============================================================
   Modes:
     1. Animal Cell  — interactive 3D scene
     2. Plant Cell   — interactive 3D scene
     3. Compare      — side-by-side 3D animal vs plant
     4. Systems      — animated pathway walkthroughs
     5. Quiz         — identify-the-organelle flashcards

   Three.js r128 — loaded from cdnjs
   All organelles clickable via raycasting → slide-up detail panel
   OrbitControls for drag-to-rotate
   ============================================================ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════
     THREE.JS LOADER
  ══════════════════════════════════════════════════ */

  const THREE_CDN  = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const ORBIT_CDN  = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';

  let _threeReady  = false;
  let _threeQueue  = [];

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

  /* ══════════════════════════════════════════════════
     ORGANELLE DATA
  ══════════════════════════════════════════════════ */

  const ORGANELLES = {
    nucleus: {
      id: 'nucleus', label: 'Nucleus',
      color: '#6366f1', dark: '#818cf8',
      present: ['animal','plant'],
      function: 'The control centre of the cell. Contains the cell\'s DNA (genetic information) packaged into chromosomes. Directs all cellular activities including growth, metabolism, and reproduction.',
      analogy: 'Think of it as the school\'s headmaster\'s office — all major decisions and instructions come from here.',
      structure: 'Double-layered membrane (nuclear envelope) with pores, contains nucleolus and chromatin.',
      examTip: 'Remember: nucleus → nuclear envelope (double membrane) → nuclear pores → nucleoplasm → chromosomes. The nucleus is absent in prokaryotes (bacteria).',
      facts: ['Contains 46 chromosomes in human cells', 'Nuclear pores allow molecules in/out', 'Surrounded by endoplasmic reticulum', 'Directs protein synthesis via mRNA'],
      size: 'Large',
    },
    nucleolus: {
      id: 'nucleolus', label: 'Nucleolus',
      color: '#4f46e5', dark: '#6366f1',
      present: ['animal','plant'],
      function: 'A dense region inside the nucleus that manufactures ribosomal RNA (rRNA) and assembles ribosome subunits. Ribosomes cannot be made without the nucleolus.',
      analogy: 'A factory within the headmaster\'s office that produces the workers (ribosomes) for the whole school.',
      structure: 'Not membrane-bound — a condensed region of chromatin and proteins.',
      examTip: 'Nucleolus = "little nucleus". It disappears during cell division and reforms after. Cells with high protein synthesis have large nucleoli.',
      facts: ['Produces rRNA', 'Assembles ribosome subunits', 'Not membrane-bound', 'Disappears during mitosis'],
      size: 'Small',
    },
    cell_membrane: {
      id: 'cell_membrane', label: 'Cell (Plasma) Membrane',
      color: '#f59e0b', dark: '#fbbf24',
      present: ['animal','plant'],
      function: 'A selectively permeable barrier that controls what enters and exits the cell. Made of a phospholipid bilayer with embedded proteins. Maintains internal environment.',
      analogy: 'A security gate — it decides who gets in and who gets out, keeping the cell\'s environment stable.',
      structure: 'Phospholipid bilayer: hydrophilic heads face outward, hydrophobic tails face inward. Contains cholesterol, glycoproteins, channel proteins.',
      examTip: 'Key phrase: "selectively permeable". Small nonpolar molecules (O₂, CO₂) pass freely. Ions and polar molecules need protein channels. Remember fluid mosaic model.',
      facts: ['7-10 nm thick', 'Fluid mosaic model (Singer & Nicolson 1972)', 'Phospholipid bilayer', 'Contains receptor proteins'],
      size: 'Thin layer',
    },
    mitochondria: {
      id: 'mitochondria', label: 'Mitochondria',
      color: '#ef4444', dark: '#f87171',
      present: ['animal','plant'],
      function: 'The powerhouse of the cell. Produces ATP through cellular respiration. Converts glucose + oxygen into ATP + CO₂ + water via aerobic respiration.',
      analogy: 'The school\'s power generator — converts fuel (glucose) into usable electricity (ATP) that powers everything.',
      structure: 'Double membrane: outer membrane (smooth) and inner membrane (folded into cristae). Inner space = matrix. Contains own DNA and ribosomes.',
      examTip: 'Equation: C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + ATP. Inner membrane folds (cristae) increase surface area for ATP production.',
      facts: ['Has its own DNA', 'Cristae increase surface area', 'Site of Krebs cycle & oxidative phosphorylation', 'Cells needing more energy have more mitochondria'],
      size: 'Medium',
    },
    rough_er: {
      id: 'rough_er', label: 'Rough Endoplasmic Reticulum',
      color: '#8b5cf6', dark: '#a78bfa',
      present: ['animal','plant'],
      function: 'Studded with ribosomes on its outer surface. Synthesises and processes proteins destined for secretion, the cell membrane, or organelles.',
      analogy: 'A conveyor belt with workers (ribosomes) attached — proteins are built and immediately folded and packaged as they move along.',
      structure: 'Flattened membrane sacs (cisternae) continuous with nuclear envelope. Ribosomes on cytoplasmic face give "rough" appearance.',
      examTip: 'Rough ER → Golgi → Vesicle → Cell membrane/secretion. This is the protein secretory pathway.',
      facts: ['Studded with ribosomes', 'Continuous with nuclear envelope', 'Folds proteins correctly', 'Sends proteins to Golgi'],
      size: 'Large network',
    },
    smooth_er: {
      id: 'smooth_er', label: 'Smooth Endoplasmic Reticulum',
      color: '#06b6d4', dark: '#22d3ee',
      present: ['animal','plant'],
      function: 'No ribosomes. Synthesises lipids, steroids, and hormones. Detoxifies drugs and poisons (especially in liver cells). Stores calcium ions in muscle cells.',
      analogy: 'The chemistry lab of the cell — makes oils, hormones, and breaks down toxic chemicals.',
      structure: 'Tubular membrane network, no ribosomes. Continuous with rough ER.',
      examTip: 'Smooth ER is abundant in liver cells (detoxification) and steroid-producing cells (hormones). No ribosomes = no protein synthesis.',
      facts: ['No ribosomes', 'Lipid and steroid synthesis', 'Detoxification in liver', 'Ca²⁺ storage in muscle cells'],
      size: 'Medium network',
    },
    golgi: {
      id: 'golgi', label: 'Golgi Apparatus',
      color: '#10b981', dark: '#34d399',
      present: ['animal','plant'],
      function: 'Receives proteins from rough ER, modifies them, sorts them, and packages them into vesicles for delivery to the right destination.',
      analogy: 'The post office of the cell — receives packages (proteins), puts them in envelopes (vesicles), writes the address, and sends them to the right destination.',
      structure: 'Stack of flattened membrane sacs. Cis face (receiving), trans face (shipping). Vesicles bud off the trans face.',
      examTip: 'Golgi has a cis face (receives) and trans face (sends). Modifies proteins by glycosylation (adding sugars). Produces lysosomes.',
      facts: ['Cis and trans faces', 'Modifies proteins by glycosylation', 'Produces secretory vesicles', 'Makes lysosomes'],
      size: 'Medium',
    },
    ribosome: {
      id: 'ribosome', label: 'Ribosomes',
      color: '#f97316', dark: '#fb923c',
      present: ['animal','plant'],
      function: 'The site of protein synthesis. Reads messenger RNA (mRNA) and assembles amino acids into polypeptide chains (proteins).',
      analogy: 'The workers/builders of the cell — they read the blueprint (mRNA) and assemble the building blocks (amino acids) into structures (proteins).',
      structure: 'Two subunits (large + small) made of rRNA and proteins. Free ribosomes make cytoplasmic proteins. Bound ribosomes (on rough ER) make proteins for export.',
      examTip: 'Ribosomes are NOT membrane-bound — the only organelle without a membrane. Process: DNA → mRNA → Ribosome → Protein.',
      facts: ['Made of rRNA + proteins', 'Two subunits (large & small)', 'No membrane envelope', '80S in eukaryotes, 70S in prokaryotes'],
      size: 'Very small',
    },
    lysosome: {
      id: 'lysosome', label: 'Lysosome',
      color: '#ec4899', dark: '#f472b6',
      present: ['animal'],
      function: 'Contains powerful digestive enzymes. Breaks down worn-out organelles, food particles, bacteria, and cellular debris. Also involved in programmed cell death (apoptosis).',
      analogy: 'The recycling centre and waste disposal unit — breaks everything down into reusable raw materials.',
      structure: 'Membrane-bound sac containing ~50 hydrolytic enzymes. Maintains acidic pH (~4.5). Produced by Golgi.',
      examTip: '"Suicide bags" of the cell. Enzyme activity requires low pH. Absent or rare in plant cells (vacuole takes this role).',
      facts: ['pH ~4.5 inside', 'Contains ~50 enzymes', 'Made by Golgi apparatus', 'Involved in autophagy'],
      size: 'Small',
    },
    centriole: {
      id: 'centriole', label: 'Centrioles',
      color: '#64748b', dark: '#94a3b8',
      present: ['animal'],
      function: 'Organise the mitotic spindle during cell division. Help pull chromosomes apart during mitosis and meiosis. Also form the base of cilia and flagella.',
      analogy: 'The scaffolding team during construction — they set up the framework (spindle fibres) that ensures chromosomes are divided equally.',
      structure: 'Pair of cylindrical structures arranged at right angles. Each made of 9 triplets of microtubules. Located in the centrosome.',
      examTip: 'Centrioles are present in ANIMAL cells but ABSENT in most plant cells. Key difference in animal vs plant cell diagram questions.',
      facts: ['9 triplets of microtubules', 'Absent in most plant cells', 'Form centrosome in pairs', 'Base of cilia & flagella'],
      size: 'Small',
    },
    vacuole: {
      id: 'vacuole', label: 'Vacuole',
      color: '#0ea5e9', dark: '#38bdf8',
      present: ['animal','plant'],
      function: 'In animal cells: small, temporary vacuoles store water, food, or waste. In plant cells: a large central vacuole stores water (maintaining turgor pressure), pigments, and waste.',
      analogy: 'A storage tank or reservoir. In plants it\'s a huge water tower that keeps the cell firm.',
      structure: 'Membrane-bound sac (tonoplast membrane in plant central vacuole). Plant central vacuole can occupy up to 90% of cell volume.',
      examTip: 'Plant cells have ONE large central vacuole; animal cells have MANY small vacuoles. Turgor pressure from the central vacuole keeps plants upright.',
      facts: ['Plant central vacuole up to 90% of volume', 'Tonoplast = vacuole membrane', 'Maintains turgor pressure in plants', 'Multiple small vacuoles in animal cells'],
      size: 'Large (plant) / Small (animal)',
    },
    cytoplasm: {
      id: 'cytoplasm', label: 'Cytoplasm / Cytosol',
      color: '#a3e635', dark: '#bef264',
      present: ['animal','plant'],
      function: 'The jelly-like fluid filling the cell. Suspends all organelles. Site of many chemical reactions including glycolysis (first stage of respiration). Maintains cell shape.',
      analogy: 'The water in an aquarium — everything floats in it and it is where many chemical reactions happen.',
      structure: 'Cytosol (fluid: water, salts, enzymes, dissolved molecules) + cytoskeleton (protein fibres for support and transport).',
      examTip: 'Cytoplasm ≠ cytosol. Cytoplasm = everything inside cell membrane EXCEPT nucleus. Cytosol = the liquid part only. Glycolysis occurs in the cytoplasm.',
      facts: ['Site of glycolysis', '~70% water', 'Contains dissolved proteins and enzymes', 'Cytoskeleton runs through it'],
      size: 'Fills entire cell',
    },
    cell_wall: {
      id: 'cell_wall', label: 'Cell Wall',
      color: '#84cc16', dark: '#a3e635',
      present: ['plant'],
      function: 'A rigid outer layer outside the cell membrane. Provides structural support and protection. Prevents over-expansion when cell absorbs water. Made of cellulose fibres in plants.',
      analogy: 'The brick walls of a building — rigid, strong, and gives the cell its shape and protection.',
      structure: 'Primary cell wall: cellulose microfibrils in a polysaccharide matrix. Plasmodesmata are channels through the wall connecting adjacent cells.',
      examTip: 'Cell wall is made of CELLULOSE in plants (chitin in fungi, peptidoglycan in bacteria). It is OUTSIDE the cell membrane. Animal cells have NO cell wall.',
      facts: ['Made of cellulose (plants)', 'Rigid and fully permeable', 'Prevents plasmolysis extremes', 'Contains plasmodesmata'],
      size: 'Thick outer layer',
    },
    chloroplast: {
      id: 'chloroplast', label: 'Chloroplast',
      color: '#22c55e', dark: '#4ade80',
      present: ['plant'],
      function: 'Site of photosynthesis. Captures light energy and uses it to convert CO₂ and water into glucose and oxygen. Contains the green pigment chlorophyll.',
      analogy: 'A solar panel factory — captures sunlight and converts it into chemical energy (glucose) stored as food.',
      structure: 'Double membrane. Contains thylakoids (flattened membrane sacs stacked into grana). Stroma (fluid) surrounds grana. Thylakoid membranes contain chlorophyll.',
      examTip: 'Photosynthesis: 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂. Light reactions in thylakoid membranes. Calvin cycle in the stroma.',
      facts: ['Contains chlorophyll pigment', 'Has own DNA (like mitochondria)', 'Thylakoids stacked = grana', 'Stroma = site of Calvin cycle'],
      size: 'Large',
    },
    central_vacuole: {
      id: 'central_vacuole', label: 'Central Vacuole',
      color: '#38bdf8', dark: '#7dd3fc',
      present: ['plant'],
      function: 'A very large vacuole that occupies most of the plant cell\'s volume. Stores water, maintains turgor pressure, stores pigments, isolates waste products.',
      analogy: 'A giant water balloon inside the cell — when full it pushes the cytoplasm to the edges and keeps the cell firm and upright.',
      structure: 'Single large vacuole bounded by the tonoplast membrane. Can occupy 30–90% of cell volume.',
      examTip: 'When plant wilts: central vacuole loses water → turgor pressure drops → cell becomes flaccid → plant droops. Turgid vs flaccid vs plasmolysed.',
      facts: ['Occupies up to 90% of cell', 'Tonoplast is its membrane', 'Maintains turgor pressure', 'Stores pigments and waste'],
      size: 'Very large',
    },
    plasmodesmata: {
      id: 'plasmodesmata', label: 'Plasmodesmata',
      color: '#6ee7b7', dark: '#34d399',
      present: ['plant'],
      function: 'Tiny channels through the cell walls connecting adjacent plant cells. Allow direct cytoplasm-to-cytoplasm communication and transport of water, nutrients, and signalling molecules.',
      analogy: 'Doorways or tunnels in the walls between rooms — allows molecules to move directly from room to room without going outside.',
      structure: 'Narrow cytoplasmic channels (40–50 nm diameter) lined by cell membrane. Desmotubule (ER strand) runs through the centre.',
      examTip: 'Plasmodesmata enable the symplast pathway (movement through connected cytoplasm). Contrast with apoplast pathway (through cell walls).',
      facts: ['40–50 nm in diameter', 'Lined by plasma membrane', 'Enable symplast transport', 'Unique to plant cells'],
      size: 'Microscopic channels',
    },
    peroxisome: {
      id: 'peroxisome', label: 'Peroxisome',
      color: '#fbbf24', dark: '#fcd34d',
      present: ['animal','plant'],
      function: 'Breaks down fatty acids for energy. Detoxifies harmful substances (especially in liver). Neutralises hydrogen peroxide (H₂O₂) using the enzyme catalase.',
      analogy: 'The cell\'s hazmat team — neutralises toxic chemicals produced during normal cell operations.',
      structure: 'Small membrane-bound organelle containing oxidative enzymes, especially catalase. Made by budding from ER.',
      examTip: 'Key enzyme = catalase: 2H₂O₂ → 2H₂O + O₂. Peroxisomes are very abundant in liver and kidney cells. Distinct from lysosomes.',
      facts: ['Contains catalase enzyme', 'Breaks H₂O₂ → H₂O + O₂', 'Abundant in liver cells', 'Also involved in fat oxidation'],
      size: 'Small',
    },
    cytoskeleton: {
      id: 'cytoskeleton', label: 'Cytoskeleton',
      color: '#c084fc', dark: '#d8b4fe',
      present: ['animal','plant'],
      function: 'A network of protein fibres that gives the cell its shape, supports organelles, enables cell movement, and acts as tracks for transporting materials inside the cell.',
      analogy: 'The cell\'s skeleton and motorway system — provides structural support AND highways for moving cargo around.',
      structure: 'Three components: microfilaments (actin), intermediate filaments (strength), microtubules (highways for transport & spindle formation).',
      examTip: 'Three types: microfilaments (actin, thinnest), intermediate filaments (medium), microtubules (thickest — made of tubulin). Microtubules form the mitotic spindle.',
      facts: ['Microfilaments: actin (7 nm)', 'Microtubules: tubulin (25 nm)', 'Intermediate filaments (10 nm)', 'Dynamic — constantly assembles/disassembles'],
      size: 'Network throughout',
    },
  };

  /* ══════════════════════════════════════════════════
     SYSTEMS DATA
  ══════════════════════════════════════════════════ */

  const SYSTEMS = [
    {
      id: 'protein_synthesis',
      title: 'Protein Secretion Pathway',
      icon: '🔬',
      color: '#8b5cf6',
      description: 'How a cell makes and exports proteins — this pathway is called the "secretory pathway". Understanding this sequence is essential for exams.',
      steps: [
        { organelle:'nucleus',       color:'#6366f1', label:'1. DNA Blueprint',       desc:'The nucleus contains the gene (DNA). The gene is transcribed into messenger RNA (mRNA). mRNA carries the instructions for making a specific protein.' },
        { organelle:'ribosome',      color:'#f97316', label:'2. Translation',          desc:'mRNA exits the nucleus through nuclear pores and attaches to ribosomes on the rough ER. Ribosomes read the mRNA and assemble amino acids into a polypeptide chain (protein).' },
        { organelle:'rough_er',      color:'#8b5cf6', label:'3. Folding & Quality Check', desc:'As the protein is built, it enters the rough ER lumen. Here it is folded into the correct 3D shape. Incorrectly folded proteins are destroyed. The protein is then packaged into a vesicle.' },
        { organelle:'golgi',         color:'#10b981', label:'4. Modification & Sorting', desc:'Vesicles from the rough ER fuse with the Golgi apparatus (cis face). The Golgi modifies the protein (e.g., adds sugar chains — glycosylation). It then sorts and packages the protein into a new vesicle (trans face).' },
        { organelle:'cell_membrane', color:'#f59e0b', label:'5. Export (Exocytosis)', desc:'Vesicles from the Golgi travel to the cell membrane and fuse with it, releasing the protein outside the cell. This process is called exocytosis. Example: insulin secretion from pancreatic beta cells.' },
      ],
    },
    {
      id: 'energy',
      title: 'Cellular Respiration (ATP Production)',
      icon: '⚡',
      color: '#ef4444',
      description: 'How cells extract energy from glucose to produce ATP — the universal energy currency used to power ALL cellular processes.',
      steps: [
        { organelle:'cytoplasm',    color:'#a3e635', label:'1. Glycolysis',              desc:'Glucose (6 carbons) is split into 2 pyruvate molecules (3 carbons each) in the cytoplasm. Produces a small amount of ATP (net 2 ATP) and NADH. Does NOT require oxygen.' },
        { organelle:'mitochondria', color:'#ef4444', label:'2. Pyruvate Oxidation',      desc:'Pyruvate enters the mitochondrial matrix and is converted to Acetyl-CoA (2 carbons), releasing CO₂. NADH is produced. This links glycolysis to the Krebs cycle.' },
        { organelle:'mitochondria', color:'#f97316', label:'3. Krebs Cycle',             desc:'Acetyl-CoA enters the Krebs (citric acid) cycle in the mitochondrial matrix. Each turn produces CO₂, NADH, FADH₂, and 1 ATP. The cycle turns twice per glucose molecule.' },
        { organelle:'mitochondria', color:'#dc2626', label:'4. Oxidative Phosphorylation', desc:'NADH and FADH₂ donate electrons to the electron transport chain (inner mitochondrial membrane). ATP synthase uses H⁺ flow to make ATP. O₂ is the final electron acceptor (forms H₂O). Produces ~32-34 ATP per glucose.' },
      ],
    },
    {
      id: 'photosynthesis',
      title: 'Photosynthesis (Plant Cells)',
      icon: '☀️',
      color: '#22c55e',
      description: 'How plant cells capture light energy and convert it into glucose — this is the foundation of almost all food chains on Earth.',
      plantOnly: true,
      steps: [
        { organelle:'chloroplast', color:'#22c55e', label:'1. Light Absorption',          desc:'Chlorophyll pigments in the thylakoid membranes absorb light (mainly red and blue wavelengths, reflect green — which is why plants look green).' },
        { organelle:'chloroplast', color:'#16a34a', label:'2. Light Reactions (Thylakoid)', desc:'In the thylakoid membranes: water is split (photolysis) → O₂ released, H⁺ produced, electrons energised. These electrons power ATP synthesis and NADPH production.' },
        { organelle:'chloroplast', color:'#15803d', label:'3. Calvin Cycle (Stroma)',     desc:'In the stroma: CO₂ from the air is "fixed" using ATP and NADPH from the light reactions. Through a series of reactions, glucose (C₆H₁₂O₆) is produced.' },
        { organelle:'cytoplasm',   color:'#a3e635', label:'4. Glucose Usage',             desc:'Glucose produced in the Calvin cycle is used for: cellular respiration (energy), building cellulose (cell walls), making starch (storage), and producing other organic molecules.' },
      ],
    },
    {
      id: 'cell_division',
      title: 'Cell Division (Mitosis Overview)',
      icon: '🔄',
      color: '#6366f1',
      description: 'How cells reproduce — creating two identical daughter cells. Critical for growth, repair, and asexual reproduction.',
      steps: [
        { organelle:'nucleus',   color:'#6366f1', label:'1. Interphase (Preparation)', desc:'The cell grows and copies its DNA (DNA replication). Each chromosome is duplicated to form two identical sister chromatids joined at the centromere. Organelles also replicate.' },
        { organelle:'centriole', color:'#64748b', label:'2. Prophase',                desc:'Chromosomes condense and become visible. Centrioles (in animal cells) move to opposite poles. The mitotic spindle begins to form from microtubules. Nuclear envelope breaks down.' },
        { organelle:'nucleus',   color:'#4f46e5', label:'3. Metaphase',               desc:'Chromosomes line up along the cell\'s equator (metaphase plate). Spindle fibres attach to centromeres. This alignment ensures each daughter cell gets one copy of each chromosome.' },
        { organelle:'cytoplasm', color:'#a3e635', label:'4. Anaphase & Telophase',    desc:'Sister chromatids are pulled apart to opposite poles. Nuclear envelopes reform. The cell then divides by cytokinesis — animal cells pinch in, plant cells form a new cell plate.' },
      ],
    },
  ];

  /* ══════════════════════════════════════════════════
     QUIZ DATA
  ══════════════════════════════════════════════════ */

  const QUIZ_QUESTIONS = [
    { q:'Which organelle is known as the "powerhouse of the cell"?', a:'mitochondria', options:['nucleus','mitochondria','lysosome','ribosome'] },
    { q:'Where does protein synthesis (translation) occur?', a:'ribosome', options:['golgi','nucleus','ribosome','rough_er'] },
    { q:'Which organelle is ONLY found in plant cells?', a:'chloroplast', options:['mitochondria','ribosome','chloroplast','golgi'] },
    { q:'What is the "post office" of the cell — sorting and shipping proteins?', a:'golgi', options:['rough_er','golgi','lysosome','nucleus'] },
    { q:'Which organelle contains enzymes that digest worn-out organelles?', a:'lysosome', options:['peroxisome','vacuole','lysosome','smooth_er'] },
    { q:'What structure controls what enters and exits the cell?', a:'cell_membrane', options:['cell_wall','cell_membrane','cytoplasm','nuclear envelope'] },
    { q:'Which organelle makes ribosomal RNA and ribosome subunits?', a:'nucleolus', options:['nucleus','nucleolus','rough_er','ribosome'] },
    { q:'Where does the first stage of cellular respiration (glycolysis) occur?', a:'cytoplasm', options:['mitochondria','nucleus','cytoplasm','lysosome'] },
    { q:'What provides structural support and prevents over-expansion in plant cells?', a:'cell_wall', options:['cell_membrane','central_vacuole','cell_wall','cytoskeleton'] },
    { q:'Which organelle synthesises lipids and detoxifies drugs (especially in liver)?', a:'smooth_er', options:['rough_er','smooth_er','golgi','peroxisome'] },
    { q:'Where does the Calvin cycle (dark reactions of photosynthesis) occur?', a:'chloroplast', options:['cytoplasm','mitochondria','chloroplast','nucleus'] },
    { q:'Which structure is used for cell division in animals but is ABSENT in most plant cells?', a:'centriole', options:['lysosome','centriole','vacuole','peroxisome'] },
    { q:'What maintains turgor pressure in plant cells?', a:'central_vacuole', options:['cell_wall','central_vacuole','chloroplast','plasmodesmata'] },
    { q:'Which enzyme in peroxisomes neutralises harmful hydrogen peroxide?', a:'peroxisome', options:['lysosome','peroxisome','smooth_er','mitochondria'] },
    { q:'What channels connect neighbouring plant cells through cell walls?', a:'plasmodesmata', options:['plasmodesmata','vacuole','cytoskeleton','ribosome'] },
  ];

  /* ══════════════════════════════════════════════════
     MODULE STATE
  ══════════════════════════════════════════════════ */

  let _onBack       = null;
  let _mode         = 'animal';
  let _selectedOrg  = null;
  let _systemIdx    = 0;
  let _systemStep   = 0;
  let _quizIdx      = 0;
  let _quizScore    = 0;
  let _quizAnswered = false;
  let _quizSelected = null;
  let _quizDone     = false;
  let _shuffledQuiz = [];

  // Three.js scene state (one scene per cell view, destroyed on mode change)
  let _scenes = {}; // keyed by 'animal' | 'plant' | 'left' | 'right'

  /* ══════════════════════════════════════════════════
     OPEN
  ══════════════════════════════════════════════════ */

  function open(onBackCallback) {
    _onBack       = onBackCallback || null;
    _mode         = 'animal';
    _selectedOrg  = null;
    _systemIdx    = 0;
    _systemStep   = 0;
    _quizIdx      = 0;
    _quizScore    = 0;
    _quizAnswered = false;
    _quizSelected = null;
    _quizDone     = false;
    _shuffledQuiz = _shuffle([...QUIZ_QUESTIONS]);
    _render();
  }

  /* ══════════════════════════════════════════════════
     RENDER (shell)
  ══════════════════════════════════════════════════ */

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
          transition:max-height .35s cubic-bezier(0.16,1,0.3,1);
          background:var(--bg-base);border-top:2px solid var(--border);
          position:relative;z-index:30;
        ">
          <div id="bio-detail-inner" style="padding:.75rem 1rem 1.25rem;"></div>
        </div>
      </div>
      <style>
        .bio-tab {
          font-size:.625rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
          padding:4px 10px;border-radius:99px;border:1.5px solid var(--border);
          background:var(--bg-subtle);color:var(--text-3);cursor:pointer;
          white-space:nowrap;font-family:var(--font);flex-shrink:0;
          transition:all .12s ease;
        }
        .bio-tab.active { background:var(--accent);color:#fff;border-color:var(--accent); }
        .bio-step-btn {
          padding:.375rem .875rem;border-radius:var(--r-md);font-size:var(--text-sm);
          font-weight:600;border:1px solid var(--border);background:var(--bg-subtle);
          color:var(--text-2);cursor:pointer;font-family:var(--font);transition:all .12s;
        }
        .bio-step-btn:hover { background:var(--bg-muted); }
        .bio-step-btn.primary { background:var(--accent);color:#fff;border-color:var(--accent); }
        .bio-quiz-opt {
          display:block;width:100%;text-align:left;padding:.625rem 1rem;
          border-radius:var(--r-lg);border:2px solid var(--border);
          background:var(--bg-base);color:var(--text-1);
          font-family:var(--font);font-size:var(--text-sm);font-weight:500;
          cursor:pointer;margin-bottom:.5rem;transition:all .12s;
        }
        .bio-quiz-opt:hover:not(:disabled) { border-color:var(--accent);background:var(--accent-subtle); }
        .bio-quiz-opt.correct { background:#d1fae5;border-color:#22c55e;color:#14532d; }
        .bio-quiz-opt.wrong   { background:#ffe4e6;border-color:#ef4444;color:#9f1239; }
        [data-theme="dark"] .bio-quiz-opt.correct { background:#052e16;border-color:#22c55e;color:#4ade80; }
        [data-theme="dark"] .bio-quiz-opt.wrong   { background:#4c0519;border-color:#ef4444;color:#fda4af; }
        #bio-canvas-animal, #bio-canvas-plant,
        #bio-canvas-left,   #bio-canvas-right { display:block; }
      </style>`);

    // Boot Three.js after DOM is ready
    if (_mode === 'animal' || _mode === 'plant' || _mode === 'compare') {
      _loadThree(() => _bootScenes());
    }
  }

  /* ══════════════════════════════════════════════════
     TOP BAR & MODE BAR
  ══════════════════════════════════════════════════ */

  function _buildTopBar() {
    return `
      <div style="display:flex;align-items:center;gap:.5rem;padding:.45rem .875rem;
                  border-bottom:1px solid var(--border);background:var(--bg-base);
                  flex-shrink:0;min-height:2.75rem;">
        <button onclick="ThreeDCell._back()"
                style="display:inline-flex;align-items:center;font-size:var(--text-sm);
                       font-weight:500;color:var(--text-2);background:var(--bg-subtle);
                       border:1px solid var(--border);border-radius:var(--r-md);
                       padding:.275rem .6rem;cursor:pointer;font-family:var(--font);flex-shrink:0;">← Back</button>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--text-base);font-weight:700;color:var(--text-1);
                      letter-spacing:-.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            🧬 Cell Structure & Systems
          </div>
        </div>
        <span id="bio-org-count" style="font-size:.6rem;color:var(--text-4);font-weight:600;
                                         letter-spacing:.04em;flex-shrink:0;"></span>
      </div>`;
  }

  function _buildModeBar() {
    const tabs = [
      { id:'animal',  icon:'🐾', label:'Animal Cell' },
      { id:'plant',   icon:'🌿', label:'Plant Cell' },
      { id:'compare', icon:'⚖️', label:'Compare' },
      { id:'systems', icon:'🔄', label:'Systems' },
      { id:'quiz',    icon:'❓', label:'Quiz' },
    ];
    return `
      <div style="flex-shrink:0;display:flex;align-items:center;gap:.375rem;
                  padding:.35rem .875rem;border-bottom:1px solid var(--border);
                  overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;
                  background:var(--bg-base);">
        ${tabs.map(t => `
          <button class="bio-tab${_mode === t.id ? ' active' : ''}"
                  onclick="ThreeDCell._setMode('${t.id}')">
            ${t.icon} ${t.label}
          </button>`).join('')}
      </div>`;
  }

  /* ══════════════════════════════════════════════════
     CONTENT ROUTER
  ══════════════════════════════════════════════════ */

  function _buildContent() {
    if (_mode === 'animal')  return _buildCellViewHTML('animal');
    if (_mode === 'plant')   return _buildCellViewHTML('plant');
    if (_mode === 'compare') return _buildCompareHTML();
    if (_mode === 'systems') return _buildSystemsView();
    if (_mode === 'quiz')    return _buildQuizView();
    return '';
  }

  /* ══════════════════════════════════════════════════
     3D CELL VIEW HTML SCAFFOLD
  ══════════════════════════════════════════════════ */

  function _buildCellViewHTML(type) {
    const organellesInCell = Object.values(ORGANELLES)
      .filter(o => o.present.includes(type));

    return `
      <div style="display:flex;height:100%;overflow:hidden;">
        <!-- Canvas container -->
        <div id="bio-canvas-wrap-${type}" style="flex:1 1 0;position:relative;overflow:hidden;min-width:0;">
          <canvas id="bio-canvas-${type}" style="width:100%;height:100%;"></canvas>
          <!-- Overlay hint -->
          <div id="bio-hint-${type}" style="position:absolute;bottom:.6rem;left:50%;
               transform:translateX(-50%);font-size:.575rem;font-weight:600;
               letter-spacing:.05em;color:var(--text-4);text-transform:uppercase;
               pointer-events:none;white-space:nowrap;background:var(--bg-base);
               border:1px solid var(--border);border-radius:99px;padding:3px 10px;
               opacity:0.85;">
            Drag to rotate · Tap to select
          </div>
          <!-- Selected label overlay -->
          <div id="bio-selected-label-${type}" style="position:absolute;top:.6rem;left:.6rem;
               font-size:.625rem;font-weight:700;color:var(--text-1);
               background:var(--bg-base);border:1.5px solid var(--border);
               border-radius:var(--r-md);padding:3px 9px;display:none;pointer-events:none;">
          </div>
        </div>

        <!-- Legend panel -->
        <div style="width:130px;flex-shrink:0;overflow-y:auto;overflow-x:hidden;
                    border-left:1px solid var(--border);background:var(--bg-base);
                    padding:.5rem .4rem;scrollbar-width:thin;">
          <div style="font-size:.55rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
                      color:var(--text-4);margin-bottom:.4rem;padding:0 .2rem;">Organelles</div>
          ${organellesInCell.map(org => `
            <button onclick="ThreeDCell._selectOrg('${org.id}','${type}')"
                    style="display:flex;align-items:center;gap:.35rem;width:100%;
                           text-align:left;padding:.3rem .4rem;border-radius:var(--r-sm);
                           border:none;background:none;cursor:pointer;font-family:var(--font);
                           transition:background .1s;"
                    onmouseenter="this.style.background='var(--bg-subtle)'"
                    onmouseleave="this.style.background='none'">
              <span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;
                           background:${org.color};box-shadow:0 0 0 1.5px ${org.color}55;"></span>
              <span style="font-size:.575rem;font-weight:600;color:var(--text-2);line-height:1.3;">
                ${org.label}
              </span>
            </button>`).join('')}
        </div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════
     COMPARE VIEW HTML
  ══════════════════════════════════════════════════ */

  function _buildCompareHTML() {
    const diffs = [
      { feature:'Cell Wall',       animal:'✗ Absent',       plant:'✓ Cellulose cell wall' },
      { feature:'Chloroplasts',    animal:'✗ Absent',       plant:'✓ Present (photosynthesis)' },
      { feature:'Central Vacuole', animal:'✗ (many small)', plant:'✓ One large central vacuole' },
      { feature:'Centrioles',      animal:'✓ Present',      plant:'✗ Absent in most species' },
      { feature:'Lysosomes',       animal:'✓ Common',       plant:'✗ Rare (vacuole does this role)' },
      { feature:'Plasmodesmata',   animal:'✗ Absent',       plant:'✓ Present (cell-cell channels)' },
      { feature:'Shape',           animal:'Round/irregular',plant:'Rectangular/fixed' },
      { feature:'Mitochondria',    animal:'✓ Many',         plant:'✓ Present (but fewer)' },
      { feature:'Ribosomes',       animal:'✓ 80S type',     plant:'✓ 80S type' },
      { feature:'Nucleus',         animal:'✓ Present',      plant:'✓ Often to one side' },
      { feature:'Golgi',           animal:'✓ Present',      plant:'✓ Present (called dictyosome)' },
      { feature:'ER',              animal:'✓ Both types',   plant:'✓ Both types' },
    ];

    return `
      <div style="height:100%;overflow-y:auto;">
        <!-- Side by side 3D canvases -->
        <div style="display:grid;grid-template-columns:1fr 1fr;height:220px;border-bottom:1px solid var(--border);">
          <div style="position:relative;border-right:1px solid var(--border);">
            <canvas id="bio-canvas-left"  style="width:100%;height:100%;display:block;"></canvas>
            <div style="position:absolute;top:.4rem;left:50%;transform:translateX(-50%);
                        font-size:.575rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
                        color:var(--text-3);pointer-events:none;background:var(--bg-base);
                        border:1px solid var(--border);border-radius:99px;padding:2px 8px;">
              🐾 Animal Cell
            </div>
          </div>
          <div style="position:relative;">
            <canvas id="bio-canvas-right" style="width:100%;height:100%;display:block;"></canvas>
            <div style="position:absolute;top:.4rem;left:50%;transform:translateX(-50%);
                        font-size:.575rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
                        color:var(--text-3);pointer-events:none;background:var(--bg-base);
                        border:1px solid var(--border);border-radius:99px;padding:2px 8px;">
              🌿 Plant Cell
            </div>
          </div>
        </div>

        <!-- Differences table -->
        <div style="padding:.75rem;max-width:720px;margin:0 auto;">
          <div style="background:var(--bg-base);border:1px solid var(--border);
                      border-radius:var(--r-xl);overflow:hidden;margin-bottom:.75rem;">
            <div style="padding:.625rem 1rem;border-bottom:1px solid var(--border);
                        background:var(--bg-subtle);display:grid;
                        grid-template-columns:1fr 1fr 1fr;gap:.5rem;">
              <span style="font-size:.575rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--text-3);">Feature</span>
              <span style="font-size:.575rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--text-3);">🐾 Animal</span>
              <span style="font-size:.575rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--text-3);">🌿 Plant</span>
            </div>
            ${diffs.map((d, i) => `
              <div style="padding:.5rem 1rem;${i < diffs.length-1 ? 'border-bottom:1px solid var(--border);' : ''}
                          display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;align-items:center;
                          ${i%2===0 ? 'background:var(--bg-base);' : 'background:var(--bg-subtle);'}">
                <span style="font-size:var(--text-xs);font-weight:600;color:var(--text-1);">${d.feature}</span>
                <span style="font-size:var(--text-xs);color:${d.animal.startsWith('✓') ? 'var(--success)' : d.animal.startsWith('✗') ? 'var(--danger)' : 'var(--text-2)'};">${d.animal}</span>
                <span style="font-size:var(--text-xs);color:${d.plant.startsWith('✓') ? 'var(--success)' : d.plant.startsWith('✗') ? 'var(--danger)' : 'var(--text-2)'};">${d.plant}</span>
              </div>`).join('')}
          </div>

          <div style="padding:.75rem 1rem;border-radius:var(--r-xl);
                      background:var(--accent-subtle);border:1px solid var(--accent-border);">
            <div style="font-size:.625rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
                        color:var(--accent-text);margin-bottom:.35rem;">📝 Top Exam Tips</div>
            <ul style="font-size:var(--text-xs);color:var(--text-2);line-height:1.7;
                       list-style:none;padding:0;margin:0;">
              <li>• <strong>CLCV</strong> = Cell wall, Chloroplasts, Large central vacuole — all plant only</li>
              <li>• <strong>Centrioles</strong> present in animal, absent in most plants — yet plants still divide!</li>
              <li>• Plant cells are more rectangular (rigid cell wall); animal cells are more round (flexible)</li>
              <li>• Both have: nucleus, mitochondria, ribosomes, ER, Golgi, cytoplasm, cell membrane</li>
              <li>• Lysosomes common in animal cells; vacuole does similar jobs in plant cells</li>
            </ul>
          </div>
        </div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════
     THREE.JS SCENE BOOTSTRAP
  ══════════════════════════════════════════════════ */

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
      if (cL) _scenes['left']  = _createScene(cL, 'animal');
      if (cR) _scenes['right'] = _createScene(cR, 'plant');
    }
  }

  /* ══════════════════════════════════════════════════
     THREE.JS SCENE CREATION
  ══════════════════════════════════════════════════ */

  function _createScene(canvas, cellType) {
    const THREE = window.THREE;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    /* ── Renderer ── */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;

    const wrap = canvas.parentElement;
    const W = wrap.clientWidth  || 400;
    const H = wrap.clientHeight || 400;
    renderer.setSize(W, H);

    /* ── Camera ── */
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 200);
    camera.position.set(0, 0, 18);

    /* ── Scene ── */
    const scene = new THREE.Scene();

    /* ── Lights ── */
    const ambient = new THREE.AmbientLight(0xffffff, isDark ? 0.5 : 0.7);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, isDark ? 0.8 : 1.0);
    sun.position.set(10, 15, 10);
    sun.castShadow = true;
    scene.add(sun);

    const fill = new THREE.PointLight(0x8888ff, 0.4, 60);
    fill.position.set(-8, -5, 8);
    scene.add(fill);

    // Selection highlight light (starts off)
    const selectLight = new THREE.PointLight(0xffffff, 0, 20);
    scene.add(selectLight);

    /* ── OrbitControls ── */
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping    = true;
    controls.dampingFactor    = 0.08;
    controls.enablePan        = false;
    controls.minDistance      = 7;
    controls.maxDistance      = 35;
    controls.autoRotate       = true;
    controls.autoRotateSpeed  = 0.5;

    /* ── Build organelles ── */
    const meshMap = {};   // orgId → [mesh, ...]
    _buildCell3D(scene, cellType, meshMap, isDark);

    /* ── Raycaster ── */
    const raycaster = new THREE.Raycaster();
    const pointer   = new THREE.Vector2();

    function _onPointerDown(e) {
      const rect = canvas.getBoundingClientRect();
      const cx   = (e.touches ? e.touches[0].clientX : e.clientX);
      const cy   = (e.touches ? e.touches[0].clientY : e.clientY);
      pointer.x  = ((cx - rect.left)  / rect.width)  * 2 - 1;
      pointer.y  = -((cy - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const allMeshes = [];
      Object.values(meshMap).forEach(arr => arr.forEach(m => allMeshes.push(m)));
      const hits = raycaster.intersectObjects(allMeshes, true);

      if (hits.length > 0) {
        controls.autoRotate = false;
        const hit  = hits[0].object;
        const orgId = hit.userData.orgId;
        if (orgId) {
          _selectOrg(orgId, cellType);
          // Focus select light
          selectLight.position.copy(hit.position);
          selectLight.intensity = 1.5;
        }
      } else {
        controls.autoRotate = true;
        selectLight.intensity = 0;
      }
    }

    canvas.addEventListener('pointerdown', _onPointerDown);
    canvas.addEventListener('touchstart',  _onPointerDown, { passive: true });

    /* ── Resize observer ── */
    const ro = new ResizeObserver(() => {
      if (!wrap || !wrap.clientWidth) return;
      const nW = wrap.clientWidth;
      const nH = wrap.clientHeight;
      renderer.setSize(nW, nH);
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
    });
    ro.observe(wrap);

    /* ── Animation loop ── */
    let rafId;
    function animate() {
      rafId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    /* ── Return handle ── */
    return {
      renderer, scene, camera, controls, meshMap, selectLight,
      dispose() {
        cancelAnimationFrame(rafId);
        ro.disconnect();
        canvas.removeEventListener('pointerdown', _onPointerDown);
        canvas.removeEventListener('touchstart',  _onPointerDown);
        controls.dispose();
        renderer.dispose();
        // Dispose geometries + materials
        scene.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
          }
        });
      },
      highlightOrg(orgId) {
        Object.entries(meshMap).forEach(([id, meshes]) => {
          meshes.forEach(m => {
            if (!m.material) return;
            const mat = Array.isArray(m.material) ? m.material : [m.material];
            mat.forEach(mt => {
              if (id === orgId) {
                mt.opacity  = 1.0;
                mt.emissive && (mt.emissive.setHex(0x444444));
              } else {
                mt.opacity  = 0.08;
                mt.emissive && (mt.emissive.setHex(0x000000));
              }
            });
          });
        });
        if (orgId && meshMap[orgId] && meshMap[orgId][0]) {
          const pos = meshMap[orgId][0].position;
          selectLight.position.set(pos.x + 2, pos.y + 2, pos.z + 4);
          selectLight.intensity = 2.0;
        }
      },
      clearHighlight() {
        Object.values(meshMap).forEach(meshes => {
          meshes.forEach(m => {
            if (!m.material) return;
            const mat = Array.isArray(m.material) ? m.material : [m.material];
            mat.forEach(mt => {
              mt.opacity = mt.userData.baseOpacity !== undefined ? mt.userData.baseOpacity : 1.0;
              mt.emissive && mt.emissive.setHex(0x000000);
            });
          });
        });
        selectLight.intensity = 0;
      }
    };
  }

  /* ══════════════════════════════════════════════════
     BUILD CELL 3D ORGANELLES
  ══════════════════════════════════════════════════ */

  function _buildCell3D(scene, cellType, meshMap, isDark) {
    const THREE = window.THREE;

    function hex(str) { return parseInt(str.replace('#',''), 16); }
    function clr(org)  { return isDark ? hex(org.dark) : hex(org.color); }

    function mat(color, opts = {}) {
      const m = new THREE.MeshPhysicalMaterial({
        color,
        transparent: true,
        opacity:     opts.opacity !== undefined ? opts.opacity : 1.0,
        roughness:   opts.roughness !== undefined ? opts.roughness : 0.55,
        metalness:   opts.metalness !== undefined ? opts.metalness : 0.05,
        side:        opts.side || THREE.FrontSide,
        depthWrite:  opts.depthWrite !== undefined ? opts.depthWrite : true,
        ...opts.extra,
      });
      m.userData.baseOpacity = m.opacity;
      return m;
    }

    function addMesh(id, mesh) {
      mesh.userData.orgId = id;
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      if (!meshMap[id]) meshMap[id] = [];
      meshMap[id].push(mesh);
      return mesh;
    }

    function addGroup(id, group) {
      group.userData.orgId = id;
      group.traverse(c => { if (c.isMesh) { c.userData.orgId = id; c.castShadow = true; } });
      scene.add(group);
      if (!meshMap[id]) meshMap[id] = [];
      meshMap[id].push(group);
      return group;
    }

    /* ─────────────────────────────────────────────
       SHARED HELPERS
    ───────────────────────────────────────────── */

    // Outer cell membrane / wall shell
    function makeCellShell(isPlant) {
      const org = ORGANELLES['cell_membrane'];
      const c   = clr(org);
      if (isPlant) {
        // Box-ish shape via scaled sphere + cage
        const wallOrg  = ORGANELLES['cell_wall'];
        const wallMat  = mat(clr(wallOrg), { opacity:0.12, depthWrite:false, side:THREE.FrontSide,
                            extra:{ wireframe:false } });
        const wallGeo  = new THREE.BoxGeometry(13.5, 13.5, 13.5, 1, 1, 1);
        const wallMesh = new THREE.Mesh(wallGeo, wallMat);
        addMesh('cell_wall', wallMesh);

        // Wire cage for wall lattice effect
        const cageGeo  = new THREE.BoxGeometry(13.5, 13.5, 13.5);
        const cageMat  = mat(clr(wallOrg), { opacity:0.35, depthWrite:false, extra:{ wireframe:true } });
        const cage     = new THREE.Mesh(cageGeo, cageMat);
        cage.userData.orgId = 'cell_wall';
        scene.add(cage);
        if (!meshMap['cell_wall']) meshMap['cell_wall'] = [];
        meshMap['cell_wall'].push(cage);

        // Inner membrane (slightly smaller box)
        const memGeo  = new THREE.BoxGeometry(12.4, 12.4, 12.4);
        const memMat  = mat(c, { opacity:0.07, depthWrite:false, side:THREE.BackSide });
        const memMesh = new THREE.Mesh(memGeo, memMat);
        addMesh('cell_membrane', memMesh);
      } else {
        // Sphere shell
        const geo  = new THREE.SphereGeometry(6.4, 48, 48);
        const mOut = mat(c, { opacity:0.08, depthWrite:false, side:THREE.BackSide });
        const msh  = new THREE.Mesh(geo, mOut);
        addMesh('cell_membrane', msh);

        const geoFront = new THREE.SphereGeometry(6.5, 32, 32);
        const mFront   = mat(c, { opacity:0.18, depthWrite:false, side:THREE.FrontSide,
                            extra:{ wireframe:true } });
        const mshFront = new THREE.Mesh(geoFront, mFront);
        mshFront.userData.orgId = 'cell_membrane';
        scene.add(mshFront);
        if (!meshMap['cell_membrane']) meshMap['cell_membrane'] = [];
        meshMap['cell_membrane'].push(mshFront);
      }
    }

    // Nucleus (double-membrane sphere + nucleolus inside)
    function makeNucleus(pos, radius = 1.65) {
      const nOrg = ORGANELLES['nucleus'];
      const nGeo = new THREE.SphereGeometry(radius, 32, 32);
      const nMat = mat(clr(nOrg), { opacity:0.82, roughness:0.45 });
      const nMsh = new THREE.Mesh(nGeo, nMat);
      nMsh.position.set(...pos);
      addMesh('nucleus', nMsh);

      // Nuclear envelope (wireframe over)
      const envGeo = new THREE.SphereGeometry(radius * 1.07, 16, 16);
      const envMat = mat(clr(nOrg), { opacity:0.22, extra:{ wireframe:true }, depthWrite:false });
      const envMsh = new THREE.Mesh(envGeo, envMat);
      envMsh.position.set(...pos);
      envMsh.userData.orgId = 'nucleus';
      scene.add(envMsh);
      meshMap['nucleus'].push(envMsh);

      // Nucleolus
      const nlOrg = ORGANELLES['nucleolus'];
      const nlGeo = new THREE.SphereGeometry(radius * 0.42, 24, 24);
      const nlMat = mat(clr(nlOrg), { opacity:0.9, roughness:0.3 });
      const nlMsh = new THREE.Mesh(nlGeo, nlMat);
      nlMsh.position.set(pos[0] + radius*0.2, pos[1] + radius*0.1, pos[2]);
      addMesh('nucleolus', nlMsh);
    }

    // Mitochondrion (capsule shape using cylinder + two end-spheres)
    function makeMito(pos, rot, scaleX = 1) {
      const org = ORGANELLES['mitochondria'];
      const c   = clr(org);
      const grp = new THREE.Group();

      const bodyGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.4 * scaleX, 16);
      const bodyMat = mat(c, { opacity:0.9, roughness:0.5 });
      const body    = new THREE.Mesh(bodyGeo, bodyMat);
      body.rotation.z = Math.PI / 2;
      grp.add(body);

      // End caps
      [-0.7 * scaleX, 0.7 * scaleX].forEach(x => {
        const capGeo = new THREE.SphereGeometry(0.45, 16, 16);
        const cap    = new THREE.Mesh(capGeo, bodyMat.clone());
        cap.position.x = x;
        grp.add(cap);
      });

      // Inner cristae (thin disc slices)
      for (let i = -0.45; i <= 0.45; i += 0.22) {
        const dGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12);
        const dMat = mat(c, { opacity:0.5, roughness:0.6 });
        const d    = new THREE.Mesh(dGeo, dMat);
        d.rotation.z = Math.PI / 2;
        d.position.x = i * scaleX;
        grp.add(d);
      }

      grp.position.set(...pos);
      grp.rotation.set(...rot);
      addGroup('mitochondria', grp);
    }

    // Golgi stack (flattened tori / discs stacked)
    function makeGolgi(pos) {
      const org = ORGANELLES['golgi'];
      const c   = clr(org);
      const grp = new THREE.Group();

      const radii = [1.05, 1.18, 1.28, 1.35, 1.28];
      radii.forEach((r, i) => {
        const gGeo = new THREE.TorusGeometry(r, 0.14, 10, 36);
        const gMat = mat(c, { opacity: 0.7 + i * 0.04, roughness:0.55 });
        const g    = new THREE.Mesh(gGeo, gMat);
        g.position.y = (i - 2) * 0.19;
        grp.add(g);
      });

      // Vesicle buds off trans face
      [1.7, 2.05].forEach((rad, i) => {
        const vGeo = new THREE.SphereGeometry(0.2, 12, 12);
        const vMat = mat(c, { opacity:0.8 });
        const v    = new THREE.Mesh(vGeo, vMat);
        v.position.set(rad, -0.5 - i * 0.35, 0);
        grp.add(v);
      });

      grp.position.set(...pos);
      grp.rotation.x = 0.3;
      addGroup('golgi', grp);
    }

    // Rough ER — flattened disc stacks with ribosome dots
    function makeRoughER(pos) {
      const org = ORGANELLES['rough_er'];
      const c   = clr(org);
      const rOrg = ORGANELLES['ribosome'];
      const rc   = clr(rOrg);
      const grp  = new THREE.Group();

      for (let i = 0; i < 4; i++) {
        const dGeo = new THREE.CylinderGeometry(1.1 - i*0.05, 1.1 - i*0.05, 0.12, 24);
        const dMat = mat(c, { opacity:0.7, roughness:0.6 });
        const d    = new THREE.Mesh(dGeo, dMat);
        d.position.y = i * 0.28;
        grp.add(d);

        // Ribosomes on top edge
        for (let j = 0; j < 8; j++) {
          const angle = (j / 8) * Math.PI * 2;
          const rGeo  = new THREE.SphereGeometry(0.09, 8, 8);
          const rMat  = mat(rc, { opacity:0.85 });
          const r     = new THREE.Mesh(rGeo, rMat);
          r.position.set(
            Math.cos(angle) * 1.05,
            i * 0.28 + 0.1,
            Math.sin(angle) * 1.05
          );
          r.userData.orgId = 'ribosome';
          grp.add(r);
          if (!meshMap['ribosome']) meshMap['ribosome'] = [];
          meshMap['ribosome'].push(r);
        }
      }

      grp.position.set(...pos);
      grp.rotation.set(0.4, 0.3, 0.2);
      addGroup('rough_er', grp);
    }

    // Smooth ER — curved tube using TubeGeometry
    function makeSmoothER(pos) {
      const org = ORGANELLES['smooth_er'];
      const c   = clr(org);
      const grp = new THREE.Group();

      const pts = [
        new THREE.Vector3(-1.2,  0.5, 0),
        new THREE.Vector3(-0.5,  1.1, 0.3),
        new THREE.Vector3( 0.3,  0.8, -0.2),
        new THREE.Vector3( 0.9,  0.1, 0.2),
        new THREE.Vector3( 1.3, -0.6, 0),
      ];
      const curve = new THREE.CatmullRomCurve3(pts);
      const tGeo  = new THREE.TubeGeometry(curve, 24, 0.22, 10, false);
      const tMat  = mat(c, { opacity:0.8, roughness:0.5 });
      const tube  = new THREE.Mesh(tGeo, tMat);
      grp.add(tube);

      // Second branch
      const pts2 = [
        new THREE.Vector3(-0.8, -0.2, 0.2),
        new THREE.Vector3( 0.0, -0.7, -0.1),
        new THREE.Vector3( 0.8, -0.3, 0.3),
      ];
      const curve2 = new THREE.CatmullRomCurve3(pts2);
      const tGeo2  = new THREE.TubeGeometry(curve2, 16, 0.18, 8, false);
      const tube2  = new THREE.Mesh(tGeo2, tMat.clone());
      grp.add(tube2);

      grp.position.set(...pos);
      addGroup('smooth_er', grp);
    }

    // Chloroplast (flattened lens + grana discs inside)
    function makeChloroplast(pos, rot) {
      const org = ORGANELLES['chloroplast'];
      const c   = clr(org);
      const grp = new THREE.Group();

      // Outer body (scaled sphere)
      const bGeo = new THREE.SphereGeometry(0.95, 24, 24);
      const bMat = mat(c, { opacity:0.85, roughness:0.5 });
      const body = new THREE.Mesh(bGeo, bMat);
      body.scale.set(1, 0.52, 0.7);
      grp.add(body);

      // Grana stacks inside (small cylinders)
      [[-0.35, 0, 0], [0, 0, 0.15], [0.35, 0, -0.1]].forEach(([x,y,z]) => {
        for (let s = 0; s < 4; s++) {
          const sGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.055, 12);
          const sMat = mat(0x1a7a3a, { opacity:0.7 });
          const sl   = new THREE.Mesh(sGeo, sMat);
          sl.position.set(x, y + s * 0.07 - 0.1, z);
          sl.userData.orgId = 'chloroplast';
          grp.add(sl);
        }
      });

      grp.position.set(...pos);
      if (rot) grp.rotation.set(...rot);
      addGroup('chloroplast', grp);
    }

    // Lysosome
    function makeLysosome(pos) {
      const org = ORGANELLES['lysosome'];
      const geo = new THREE.SphereGeometry(0.35, 16, 16);
      const m   = mat(clr(org), { opacity:0.88, roughness:0.4 });
      const msh = new THREE.Mesh(geo, m);
      msh.position.set(...pos);
      addMesh('lysosome', msh);
    }

    // Centrioles (two perpendicular cylinders of rings)
    function makeCentrioles(pos) {
      const org = ORGANELLES['centriole'];
      const c   = clr(org);
      const grp = new THREE.Group();

      function barrel(rx, ry, rz) {
        const b = new THREE.Group();
        for (let i = 0; i < 9; i++) {
          const rGeo = new THREE.TorusGeometry(0.28, 0.055, 8, 18);
          const rMat = mat(c, { opacity:0.85 });
          const ring = new THREE.Mesh(rGeo, rMat);
          ring.position.y = (i - 4) * 0.13;
          b.add(ring);
        }
        b.rotation.set(rx, ry, rz);
        return b;
      }

      grp.add(barrel(0, 0, 0));
      const b2 = barrel(Math.PI/2, 0, 0);
      b2.position.set(0.7, 0, 0);
      grp.add(b2);

      grp.position.set(...pos);
      addGroup('centriole', grp);
    }

    // Vacuole (small spheres for animal, large for plant via central_vacuole)
    function makeVacuole(pos, radius, id = 'vacuole') {
      const org = ORGANELLES[id];
      const geo = new THREE.SphereGeometry(radius, 24, 24);
      const m   = mat(clr(org), { opacity: id === 'central_vacuole' ? 0.18 : 0.75,
                                   depthWrite: id !== 'central_vacuole', roughness:0.3 });
      const msh = new THREE.Mesh(geo, m);
      msh.position.set(...pos);
      addMesh(id, msh);
    }

    // Peroxisome
    function makePeroxisome(pos) {
      const org = ORGANELLES['peroxisome'];
      const geo = new THREE.OctahedronGeometry(0.3, 1);
      const m   = mat(clr(org), { opacity:0.88, roughness:0.4 });
      const msh = new THREE.Mesh(geo, m);
      msh.position.set(...pos);
      addMesh('peroxisome', msh);
    }

    // Cytoskeleton (thin line tubes)
    function makeCytoskeleton(isPlant) {
      const org = ORGANELLES['cytoskeleton'];
      const c   = clr(org);
      const grp = new THREE.Group();
      const pts = isPlant ? [
        [[-5,-5,-2],[5,3,2]],
        [[-4,4,1],[4,-3,-1]],
        [[-3,0,5],[3,1,-4]],
        [[0,-5,4],[1,5,-3]],
      ] : [
        [[-4,-4,-2],[4,3,2]],
        [[-3,3,1],[3,-3,-1]],
        [[-2,0,4],[2,1,-3]],
        [[0,-4,3],[1,4,-2]],
      ];

      pts.forEach(([a, b]) => {
        const curve = new THREE.LineCurve3(
          new THREE.Vector3(...a),
          new THREE.Vector3(...b)
        );
        const tGeo = new THREE.TubeGeometry(curve, 4, 0.045, 6, false);
        const tMat = mat(c, { opacity:0.22, roughness:0.8, depthWrite:false });
        const tube = new THREE.Mesh(tGeo, tMat);
        grp.add(tube);
      });

      addGroup('cytoskeleton', grp);
    }

    // Plasmodesmata (small cylinders on box faces, plant only)
    function makePlasmodesmata() {
      const org = ORGANELLES['plasmodesmata'];
      const c   = clr(org);
      const grp = new THREE.Group();
      const positions = [
        [6.8, 1.2, 0], [6.8, -0.8, 0.5], [6.8, 0, -1],
        [-6.8, 0.5, 0], [-6.8, -0.5, 0.8],
        [0, 6.8, 0.5], [0.5, 6.8, -0.3],
        [0, -6.8, 0.2], [-0.4, -6.8, 0.6],
      ];
      positions.forEach(([x,y,z]) => {
        const geo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8);
        const m   = mat(c, { opacity:0.85 });
        const cyl = new THREE.Mesh(geo, m);
        cyl.position.set(x, y, z);
        // Orient toward face
        if (Math.abs(x) > Math.abs(y)) cyl.rotation.z = Math.PI/2;
        else cyl.rotation.x = Math.PI/2;
        grp.add(cyl);
      });
      addGroup('plasmodesmata', grp);
    }

    // Cytoplasm fill (large transparent sphere/box)
    function makeCytoplasm(isPlant) {
      const org = ORGANELLES['cytoplasm'];
      if (isPlant) {
        const geo = new THREE.BoxGeometry(11.5, 11.5, 11.5);
        const m   = mat(clr(org), { opacity:0.04, depthWrite:false, side:THREE.FrontSide });
        const msh = new THREE.Mesh(geo, m);
        addMesh('cytoplasm', msh);
      } else {
        const geo = new THREE.SphereGeometry(5.8, 32, 32);
        const m   = mat(clr(org), { opacity:0.04, depthWrite:false, side:THREE.FrontSide });
        const msh = new THREE.Mesh(geo, m);
        addMesh('cytoplasm', msh);
      }
    }

    /* ─────────────────────────────────────────────
       ANIMAL CELL ASSEMBLY
    ───────────────────────────────────────────── */
    if (cellType === 'animal') {
      makeCellShell(false);
      makeCytoplasm(false);
      makeCytoskeleton(false);
      makeNucleus([0, 0.3, 0], 1.65);
      makeMito([-3.0,  1.5,  1.0], [0, 0, 0.4]);
      makeMito([ 2.8, -1.8,  0.5], [0, 0.3, -0.5]);
      makeMito([-1.5, -2.8,  1.2], [0.2, 0, 0.6]);
      makeMito([ 1.8,  2.5, -1.5], [0, 0.5, 0.2]);
      makeRoughER([2.2, 0.8, 1.5]);
      makeSmoothER([-2.0, -1.0, 1.8]);
      makeGolgi([-2.5, 1.8, -1.0]);
      makeLysosome([2.8,  2.5, -0.5]);
      makeLysosome([-1.0, 3.0,  1.0]);
      makeLysosome([3.2, -1.0,  1.2]);
      makeCentrioles([0.5, -2.2, 0.8]);
      makeVacuole([-3.2, -0.5, -1.5], 0.5);
      makeVacuole([ 2.5, -3.0,  0.5], 0.4);
      makePeroxisome([3.0,  0.5, -2.0]);
      makePeroxisome([-2.8, 2.5,  0.5]);

    /* ─────────────────────────────────────────────
       PLANT CELL ASSEMBLY
    ───────────────────────────────────────────── */
    } else {
      makeCellShell(true);
      makeCytoplasm(true);
      makeCytoskeleton(true);

      // Large central vacuole
      makeVacuole([0, 0, 0], 3.8, 'central_vacuole');

      // Nucleus pushed to edge (plant characteristic)
      makeNucleus([-3.8, 3.0, 1.0], 1.4);

      // Chloroplasts arranged around periphery
      makeChloroplast([-4.5,  1.5, 1.5], [0, 0.3, 0.5]);
      makeChloroplast([-4.5, -1.5, 0.5], [0, -0.2, -0.4]);
      makeChloroplast([ 4.5,  1.5, 1.0], [0, 0.4, -0.3]);
      makeChloroplast([ 4.5, -1.5, 1.5], [0, 0.2, 0.5]);
      makeChloroplast([ 0.5,  4.5,-0.5], [0.4, 0, 0.2]);
      makeChloroplast([-0.5, -4.5, 0.5], [0.3, 0, -0.3]);

      makeMito([4.0, 3.5, 1.5], [0, 0, 0.5]);
      makeMito([-4.2, -3.0, 1.0], [0, 0.3, -0.4]);
      makeRoughER([3.8, -3.5, 1.5]);
      makeSmoothER([-3.5, 3.5, -1.5]);
      makeGolgi([4.2, 0, -2.5]);
      makeVacuole([-3.5, -2.0, -2.0], 0.45);
      makePeroxisome([-4.5, 0, -2.0]);
      makePeroxisome([4.0, -1.5, -2.5]);
      makePlasmodesmata();
    }
  }

  /* ══════════════════════════════════════════════════
     HIGHLIGHT / SELECT ORGANELLE
  ══════════════════════════════════════════════════ */

  function _selectOrg(orgId, cellType) {
    _selectedOrg = orgId;

    // Show detail panel
    _showDetail(orgId);

    // Determine which scene key(s) to highlight
    const keys = cellType === 'animal' ? ['animal'] :
                 cellType === 'plant'  ? ['plant']  :
                 ['left','right'];

    // For 'animal'/'plant' mode, cellType is passed; for compare it may be undefined
    // Try all active scenes
    Object.entries(_scenes).forEach(([key, sc]) => {
      if (sc && sc.highlightOrg) sc.highlightOrg(orgId);
    });

    // Update selected label overlay
    const org = ORGANELLES[orgId];
    if (org) {
      ['animal','plant','left','right'].forEach(k => {
        const el = document.getElementById(`bio-selected-label-${k}`);
        if (el) {
          el.textContent = org.label;
          el.style.display = 'block';
          el.style.borderColor = org.color;
          el.style.color = org.color;
        }
      });
    }
  }

  function _closeDetail() {
    _selectedOrg = null;
    const panel  = document.getElementById('bio-detail');
    if (panel) panel.style.maxHeight = '0';

    Object.values(_scenes).forEach(sc => { if (sc && sc.clearHighlight) sc.clearHighlight(); });

    ['animal','plant','left','right'].forEach(k => {
      const el = document.getElementById(`bio-selected-label-${k}`);
      if (el) el.style.display = 'none';
    });
  }

  /* ══════════════════════════════════════════════════
     ORGANELLE DETAIL PANEL
  ══════════════════════════════════════════════════ */

  function _showDetail(orgId) {
    const org = ORGANELLES[orgId];
    if (!org) return;

    const panel = document.getElementById('bio-detail');
    const inner = document.getElementById('bio-detail-inner');
    if (!panel || !inner) return;

    const clr = org.color;

    inner.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:.625rem;margin-bottom:.5rem;">
        <div style="width:44px;height:44px;border-radius:var(--r-lg);flex-shrink:0;
                    background:${clr}22;border:2px solid ${clr};
                    display:flex;align-items:center;justify-content:center;font-size:1.3rem;">
          🔬
        </div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;margin-bottom:2px;">
            <h2 style="font-size:var(--text-md);font-weight:800;color:var(--text-1);margin:0;
                       letter-spacing:-.02em;">${org.label}</h2>
            <span style="font-size:.55rem;font-weight:700;padding:2px 7px;border-radius:99px;
                         background:${clr}22;color:${clr};border:1px solid ${clr}44;flex-shrink:0;">
              ${org.size}
            </span>
            ${org.present.length < 2
              ? `<span style="font-size:.55rem;font-weight:700;padding:2px 7px;border-radius:99px;
                              background:var(--accent-subtle);color:var(--accent-text);
                              border:1px solid var(--accent-border);flex-shrink:0;">
                  ${org.present[0] === 'plant' ? '🌿 Plant only' : '🐾 Animal only'}
                </span>` : ''}
          </div>
        </div>
        <button onclick="ThreeDCell._closeDetail()"
                style="flex-shrink:0;background:none;border:none;cursor:pointer;
                       font-size:1.2rem;color:var(--text-4);padding:2px;">×</button>
      </div>

      <div style="max-height:200px;overflow-y:auto;scrollbar-width:thin;">
        <div style="margin-bottom:.5rem;">
          <div style="font-size:.55rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
                      color:${clr};margin-bottom:.25rem;">Function</div>
          <p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.6;margin:0;
                    border-left:2px solid ${clr};padding-left:.5rem;">${org.function}</p>
        </div>

        <div style="margin-bottom:.5rem;padding:.5rem .75rem;border-radius:var(--r-md);
                    background:${clr}11;border:1px solid ${clr}33;">
          <div style="font-size:.55rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
                      color:${clr};margin-bottom:.2rem;">💡 Analogy</div>
          <p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.5;margin:0;
                    font-style:italic;">${org.analogy}</p>
        </div>

        <div style="margin-bottom:.5rem;">
          <div style="font-size:.55rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
                      color:var(--text-4);margin-bottom:.2rem;">Structure</div>
          <p style="font-size:var(--text-xs);color:var(--text-3);line-height:1.55;margin:0;">${org.structure}</p>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.275rem;margin-bottom:.5rem;">
          ${org.facts.map(f => `
            <div style="background:var(--bg-subtle);border:1px solid var(--border);
                        border-radius:var(--r-sm);padding:.25rem .4rem;
                        font-size:.575rem;color:var(--text-2);line-height:1.4;">• ${f}</div>`).join('')}
        </div>

        <div style="padding:.5rem .75rem;border-radius:var(--r-md);
                    background:var(--warning-subtle);border:1px solid var(--warning-border);">
          <div style="font-size:.55rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
                      color:var(--warning);margin-bottom:.2rem;">📝 Exam Tip</div>
          <p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.55;margin:0;">${org.examTip}</p>
        </div>
      </div>`;

    panel.style.maxHeight = '320px';
  }

  /* ══════════════════════════════════════════════════
     SYSTEMS VIEW
  ══════════════════════════════════════════════════ */

  function _buildSystemsView() {
    const sys  = SYSTEMS[_systemIdx];
    const step = sys.steps[_systemStep];
    const totalSteps = sys.steps.length;

    return `
      <div style="height:100%;display:flex;flex-direction:column;overflow:hidden;">
        <div style="flex-shrink:0;display:flex;gap:.35rem;padding:.4rem .75rem;
                    overflow-x:auto;scrollbar-width:none;border-bottom:1px solid var(--border);">
          ${SYSTEMS.map((s, i) => `
            <button onclick="ThreeDCell._setSystem(${i})"
                    style="font-size:.575rem;font-weight:700;padding:3px 10px;border-radius:99px;
                           border:1px solid ${i===_systemIdx ? s.color : 'var(--border)'};
                           background:${i===_systemIdx ? s.color+'22' : 'var(--bg-subtle)'};
                           color:${i===_systemIdx ? s.color : 'var(--text-3)'};
                           cursor:pointer;white-space:nowrap;font-family:var(--font);flex-shrink:0;">
              ${s.icon} ${s.title}
            </button>`).join('')}
        </div>

        <div style="flex:1 1 0;overflow-y:auto;padding:.75rem;">
          <div style="max-width:640px;margin:0 auto;">
            <div style="margin-bottom:.75rem;padding:.75rem 1rem;border-radius:var(--r-xl);
                        border:1.5px solid ${sys.color}44;background:${sys.color}11;">
              <div style="font-size:var(--text-md);font-weight:800;color:var(--text-1);margin-bottom:.25rem;">
                ${sys.icon} ${sys.title}
              </div>
              <p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.6;margin:0;">
                ${sys.description}
              </p>
              ${sys.plantOnly ? `<div style="margin-top:.4rem;font-size:.575rem;font-weight:700;
                color:var(--success);letter-spacing:.03em;">🌿 PLANT CELLS ONLY</div>` : ''}
            </div>

            <div style="display:flex;gap:.3rem;margin-bottom:.75rem;">
              ${sys.steps.map((s, i) => `
                <div style="flex:1;height:5px;border-radius:99px;
                            background:${i <= _systemStep ? sys.color : 'var(--border)'};
                            cursor:pointer;transition:background .2s;"
                     onclick="ThreeDCell._setStep(${i})"></div>`).join('')}
            </div>

            <div style="background:var(--bg-base);border:2px solid ${step.color}66;
                        border-radius:var(--r-xl);overflow:hidden;margin-bottom:.75rem;">
              <div style="padding:.625rem 1rem;background:${step.color}18;
                          border-bottom:1px solid ${step.color}33;">
                <div style="font-size:var(--text-md);font-weight:800;color:${step.color};">
                  ${step.label}
                </div>
                <div style="font-size:.625rem;font-weight:600;color:var(--text-4);
                            text-transform:uppercase;letter-spacing:.04em;margin-top:1px;">
                  ${ORGANELLES[step.organelle]?.label || step.organelle}
                </div>
              </div>
              <div style="padding:.875rem 1rem;">
                <p style="font-size:var(--text-sm);color:var(--text-2);line-height:1.7;margin:0;">
                  ${step.desc}
                </p>
              </div>
            </div>

            <div style="background:var(--bg-subtle);border:1px solid var(--border);
                        border-radius:var(--r-xl);padding:.625rem .875rem;margin-bottom:.75rem;">
              <div style="font-size:.575rem;font-weight:800;letter-spacing:.05em;
                          text-transform:uppercase;color:var(--text-4);margin-bottom:.4rem;">
                Pathway Overview
              </div>
              <div style="display:flex;align-items:center;flex-wrap:wrap;gap:.25rem;">
                ${sys.steps.map((s, i) => `
                  <span style="font-size:.6rem;font-weight:700;padding:2px 7px;
                               border-radius:99px;cursor:pointer;
                               background:${i === _systemStep ? s.color : 'var(--bg-muted)'};
                               color:${i === _systemStep ? '#fff' : 'var(--text-3)'};"
                        onclick="ThreeDCell._setStep(${i})">
                    ${i+1}. ${ORGANELLES[s.organelle]?.label || s.organelle}
                  </span>
                  ${i < sys.steps.length-1 ? '<span style="color:var(--text-4);font-size:.7rem;">→</span>' : ''}`).join('')}
              </div>
            </div>

            <div style="display:flex;gap:.5rem;justify-content:space-between;">
              <button class="bio-step-btn" onclick="ThreeDCell._prevStep()"
                      ${_systemStep === 0 ? 'disabled style="opacity:.4;cursor:not-allowed;"' : ''}>
                ← Previous
              </button>
              <span style="font-size:var(--text-xs);color:var(--text-4);line-height:2.2;">
                ${_systemStep+1} / ${totalSteps}
              </span>
              <button class="bio-step-btn primary" onclick="ThreeDCell._nextStep()">
                ${_systemStep < totalSteps-1 ? 'Next →' : 'Restart ↺'}
              </button>
            </div>
          </div>
        </div>
      </div>`;
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
                        color:var(--accent);margin-bottom:.5rem;">Question ${_quizIdx+1}</div>
            <p style="font-size:var(--text-md);font-weight:600;color:var(--text-1);
                      line-height:1.5;margin:0;">${q.q}</p>
          </div>

          <div id="bio-quiz-opts">
            ${opts.map(opt => {
              const org   = ORGANELLES[opt];
              const label = org ? org.label : opt;
              let extraClass = '';
              if (_quizAnswered) {
                if (opt === q.a)                         extraClass = 'correct';
                else if (opt === _quizSelected)          extraClass = 'wrong';
              }
              return `
                <button class="bio-quiz-opt ${extraClass}"
                        ${_quizAnswered ? 'disabled' : ''}
                        onclick="ThreeDCell._answerQuiz('${opt}', '${q.a}')">
                  ${label}
                </button>`;
            }).join('')}
          </div>

          ${_quizAnswered ? `
            <div style="margin-top:.75rem;padding:.75rem 1rem;border-radius:var(--r-xl);
                        background:${_quizSelected === q.a ? 'var(--success-subtle)' : 'var(--danger-subtle)'};
                        border:1px solid ${_quizSelected === q.a ? 'var(--success-border)' : 'var(--danger-border)'};">
              <div style="font-size:.6rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
                          color:${_quizSelected === q.a ? 'var(--success)' : 'var(--danger)'};margin-bottom:.35rem;">
                ${_quizSelected === q.a ? '✓ Correct!' : '✗ Incorrect'}
              </div>
              <p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.6;margin:0 0 .5rem;">
                ${ORGANELLES[q.a]?.function || ''}
              </p>
              <button class="bio-step-btn primary" onclick="ThreeDCell._nextQuestion()"
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
    const grade = pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good job!' : pct >= 40 ? 'Keep practising.' : 'More revision needed.';
    const color = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--accent)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';

    return `
      <div style="height:100%;overflow-y:auto;padding:1.5rem .875rem;">
        <div style="max-width:480px;margin:0 auto;text-align:center;">
          <div style="font-size:3.5rem;line-height:1;margin-bottom:.5rem;">
            ${pct >= 80 ? '🏆' : pct >= 60 ? '👍' : pct >= 40 ? '📚' : '🔬'}
          </div>
          <h2 style="font-size:var(--text-xl);font-weight:800;color:${color};margin-bottom:.25rem;">
            ${pct}% — ${grade}
          </h2>
          <p style="font-size:var(--text-sm);color:var(--text-3);margin-bottom:1.5rem;">
            You scored <strong>${_quizScore}</strong> out of <strong>${total}</strong> questions.
          </p>
          <div style="background:var(--bg-base);border:1px solid var(--border);border-radius:var(--r-xl);
                      padding:1rem;margin-bottom:1rem;text-align:left;">
            <div style="font-size:.575rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
                        color:var(--text-4);margin-bottom:.5rem;">Study these organelles:</div>
            ${pct < 100
              ? `<p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.7;">
                   Review the Animal Cell and Plant Cell 3D diagrams. Rotate the cell and tap each organelle to read its function.
                   Focus on: ${['mitochondria','nucleus','chloroplast','golgi','ribosome'].map(id => ORGANELLES[id].label).join(', ')}.
                 </p>`
              : '<p style="color:var(--success);font-size:var(--text-sm);">Perfect score! You know all organelles. 🎉</p>'}
          </div>
          <div style="display:flex;gap:.625rem;justify-content:center;flex-wrap:wrap;">
            <button class="bio-step-btn primary" onclick="ThreeDCell._restartQuiz()"
                    style="padding:.5rem 1.25rem;">↺ Retake Quiz</button>
            <button class="bio-step-btn" onclick="ThreeDCell._setMode('animal')"
                    style="padding:.5rem 1.25rem;">🧬 Study 3D Cells</button>
          </div>
        </div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════
     MODE SWITCHING
  ══════════════════════════════════════════════════ */

  function _setMode(mode) {
    _destroyAllScenes();
    _mode        = mode;
    _selectedOrg = null;
    _systemStep  = 0;

    const detail = document.getElementById('bio-detail');
    if (detail) detail.style.maxHeight = '0';

    const content = document.getElementById('bio-content');
    if (content) content.innerHTML = _buildContent();

    document.querySelectorAll('.bio-tab').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${mode}'`));
    });

    const cnt = document.getElementById('bio-org-count');
    if (cnt) {
      if (mode === 'animal') cnt.textContent = `${Object.keys(ORGANELLES).filter(k => ORGANELLES[k].present.includes('animal')).length} organelles`;
      else if (mode === 'plant') cnt.textContent = `${Object.keys(ORGANELLES).filter(k => ORGANELLES[k].present.includes('plant')).length} organelles`;
      else cnt.textContent = '';
    }

    if (mode === 'animal' || mode === 'plant' || mode === 'compare') {
      _loadThree(() => _bootScenes());
    }
  }

  /* ══════════════════════════════════════════════════
     SCENE CLEANUP
  ══════════════════════════════════════════════════ */

  function _destroyAllScenes() {
    Object.values(_scenes).forEach(sc => { if (sc && sc.dispose) sc.dispose(); });
    _scenes = {};
  }

  /* ══════════════════════════════════════════════════
     PUBLIC ACTIONS
  ══════════════════════════════════════════════════ */

  function _setSystem(idx) {
    _systemIdx  = idx;
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
    _quizIdx      = 0;
    _quizScore    = 0;
    _quizAnswered = false;
    _quizSelected = null;
    _quizDone     = false;
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

  /* ══════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════ */

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
