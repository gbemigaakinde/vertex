/* ============================================================
   js/threedclass-biology.js — 3D Cell Structure & Systems
   ============================================================
   Modes:
     1. Animal Cell  — interactive labelled cross-section
     2. Plant Cell   — interactive labelled cross-section
     3. Compare      — side-by-side animal vs plant
     4. Systems      — animated pathway walkthroughs
     5. Quiz         — identify-the-organelle flashcards

   SPA integration:
     ThreeDClass launches → ThreeDCell.open(onBackCallback)
     Back button → onBackCallback() → ThreeDClass hub

   Architecture:
     CSS 3D illusion via layered SVG + z-depth shadows
     All organelles clickable → slide-up detail panel
     Fully offline, no external deps beyond existing CSS vars
   ============================================================ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════
     ORGANELLE DATA
  ══════════════════════════════════════════════════ */

  const ORGANELLES = {
    // ── Shared organelles ──────────────────────────
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
      function: 'The powerhouse of the cell. Produces ATP (adenosine triphosphate) through cellular respiration. Converts glucose + oxygen into ATP + CO₂ + water via aerobic respiration.',
      analogy: 'The school\'s power generator — converts fuel (glucose) into usable electricity (ATP) that powers everything.',
      structure: 'Double membrane: outer membrane (smooth) and inner membrane (folded into cristae). Inner space = matrix. Contains own DNA and ribosomes.',
      examTip: 'Equation: C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + ATP. Inner membrane folds (cristae) increase surface area for ATP production. Mitochondria have their own DNA — evidence for endosymbiotic theory.',
      facts: ['Has its own DNA', 'Cristae increase surface area', 'Site of Krebs cycle & oxidative phosphorylation', 'Cells needing more energy have more mitochondria'],
      size: 'Medium',
    },
    rough_er: {
      id: 'rough_er', label: 'Rough Endoplasmic Reticulum',
      color: '#8b5cf6', dark: '#a78bfa',
      present: ['animal','plant'],
      function: 'Studded with ribosomes on its outer surface. Synthesises and processes proteins destined for secretion, the cell membrane, or organelles. Folds proteins into correct 3D shapes.',
      analogy: 'A conveyor belt with workers (ribosomes) attached — proteins are built and immediately folded and packaged as they move along.',
      structure: 'Flattened membrane sacs (cisternae) continuous with nuclear envelope. Ribosomes on cytoplasmic face give "rough" appearance.',
      examTip: 'Rough ER → Golgi → Vesicle → Cell membrane/secretion. This is the protein secretory pathway. "Rough" because ribosomes are attached.',
      facts: ['Studded with ribosomes', 'Continuous with nuclear envelope', 'Folds proteins correctly', 'Sends proteins to Golgi'],
      size: 'Large network',
    },
    smooth_er: {
      id: 'smooth_er', label: 'Smooth Endoplasmic Reticulum',
      color: '#06b6d4', dark: '#22d3ee',
      present: ['animal','plant'],
      function: 'No ribosomes. Synthesises lipids (fats and phospholipids), steroids, and hormones. Detoxifies drugs and poisons (especially in liver cells). Stores calcium ions in muscle cells.',
      analogy: 'The chemistry lab of the cell — makes oils, hormones, and breaks down toxic chemicals.',
      structure: 'Tubular membrane network, no ribosomes. Continuous with rough ER.',
      examTip: 'Smooth ER is abundant in liver cells (detoxification) and steroid-producing cells (hormones). No ribosomes = no protein synthesis. Contrast with rough ER.',
      facts: ['No ribosomes', 'Lipid and steroid synthesis', 'Detoxification in liver', 'Ca²⁺ storage in muscle cells'],
      size: 'Medium network',
    },
    golgi: {
      id: 'golgi', label: 'Golgi Apparatus',
      color: '#10b981', dark: '#34d399',
      present: ['animal','plant'],
      function: 'Receives proteins from rough ER, modifies them (adds sugar chains, cuts, folds), sorts them, and packages them into vesicles for delivery to the right destination — inside or outside the cell.',
      analogy: 'The post office of the cell — receives packages (proteins), puts them in envelopes (vesicles), writes the address, and sends them to the right destination.',
      structure: 'Stack of flattened membrane sacs. Cis face (receiving, faces ER), trans face (shipping, faces cell membrane). Vesicles bud off the trans face.',
      examTip: 'Golgi has a cis face (receives) and trans face (sends). Modifies proteins by glycosylation (adding sugars). Produces lysosomes. Key exam question: sequence of protein secretion.',
      facts: ['Cis and trans faces', 'Modifies proteins by glycosylation', 'Produces secretory vesicles', 'Makes lysosomes'],
      size: 'Medium',
    },
    ribosome: {
      id: 'ribosome', label: 'Ribosomes',
      color: '#f97316', dark: '#fb923c',
      present: ['animal','plant'],
      function: 'The site of protein synthesis. Reads messenger RNA (mRNA) and assembles amino acids into polypeptide chains (proteins). Found free in cytoplasm or attached to rough ER.',
      analogy: 'The workers/builders of the cell — they read the blueprint (mRNA) and assemble the building blocks (amino acids) into structures (proteins).',
      structure: 'Two subunits (large + small) made of rRNA and proteins. Free ribosomes make cytoplasmic proteins. Bound ribosomes (on rough ER) make proteins for export.',
      examTip: 'Ribosomes are NOT membrane-bound — they are the only organelle without a membrane. Process: DNA → mRNA (transcription) → Ribosome reads mRNA → Protein (translation).',
      facts: ['Made of rRNA + proteins', 'Two subunits (large & small)', 'No membrane envelope', '80S in eukaryotes, 70S in prokaryotes'],
      size: 'Very small',
    },
    lysosome: {
      id: 'lysosome', label: 'Lysosome',
      color: '#ec4899', dark: '#f472b6',
      present: ['animal'],
      function: 'Contains powerful digestive enzymes. Breaks down worn-out organelles, food particles, bacteria, and cellular debris. Also involved in programmed cell death (apoptosis). Sometimes called "suicide bags".',
      analogy: 'The recycling centre and waste disposal unit — breaks everything down into reusable raw materials.',
      structure: 'Membrane-bound sac containing ~50 hydrolytic enzymes. Maintains acidic pH (~4.5) to activate enzymes. Produced by Golgi.',
      examTip: '"Suicide bags" of the cell. Enzyme activity requires low pH — if lysosome ruptures, enzymes are inactivated at cytoplasm pH (~7.2). Absent or rare in plant cells (vacuole takes this role).',
      facts: ['pH ~4.5 inside', 'Contains ~50 enzymes', 'Made by Golgi apparatus', 'Involved in autophagy'],
      size: 'Small',
    },
    centriole: {
      id: 'centriole', label: 'Centrioles',
      color: '#64748b', dark: '#94a3b8',
      present: ['animal'],
      function: 'Organise the mitotic spindle during cell division. Help pull chromosomes apart during mitosis and meiosis. Also form the base of cilia and flagella.',
      analogy: 'The scaffolding team during construction — they set up the framework (spindle fibres) that ensures chromosomes are divided equally.',
      structure: 'Pair of cylindrical structures arranged at right angles. Each made of 9 triplets of microtubules (9+0 arrangement). Located in the centrosome.',
      examTip: 'Centrioles are present in ANIMAL cells but ABSENT in most plant cells (plants still divide — they use other mechanisms). Key difference in animal vs plant cell diagram questions.',
      facts: ['9 triplets of microtubules', 'Absent in most plant cells', 'Form centrosome in pairs', 'Base of cilia & flagella'],
      size: 'Small',
    },
    vacuole: {
      id: 'vacuole', label: 'Vacuole',
      color: '#0ea5e9', dark: '#38bdf8',
      present: ['animal','plant'],
      function: 'In animal cells: small, temporary vacuoles store water, food, or waste. In plant cells: a large central vacuole stores water (maintaining turgor pressure), pigments, waste products, and helps maintain cell shape.',
      analogy: 'A storage tank or reservoir. In plants it\'s a huge water tower that keeps the cell firm.',
      structure: 'Membrane-bound sac (tonoplast membrane in plant central vacuole). Plant central vacuole can occupy up to 90% of cell volume.',
      examTip: 'Plant cells have ONE large central vacuole; animal cells have MANY small vacuoles. Turgor pressure from the central vacuole keeps plants upright — this is why plants wilt when dehydrated.',
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
      examTip: 'Cytoplasm ≠ cytosol. Cytoplasm = everything inside cell membrane EXCEPT nucleus. Cytosol = the liquid part only. Glycolysis occurs in the cytoplasm (not mitochondria).',
      facts: ['Site of glycolysis', '~70% water', 'Contains dissolved proteins and enzymes', 'Cytoskeleton runs through it'],
      size: 'Fills entire cell',
    },
    cell_wall: {
      id: 'cell_wall', label: 'Cell Wall',
      color: '#84cc16', dark: '#a3e635',
      present: ['plant'],
      function: 'A rigid outer layer outside the cell membrane. Provides structural support and protection. Prevents over-expansion when cell absorbs water. Made of cellulose fibres in plants.',
      analogy: 'The brick walls of a building — rigid, strong, and gives the cell its shape and protection.',
      structure: 'Primary cell wall: cellulose microfibrils in a polysaccharide matrix. Some cells have secondary cell wall (thicker, lignified). Plasmodesmata are channels through the wall connecting adjacent cells.',
      examTip: 'Cell wall is made of CELLULOSE in plants (chitin in fungi, peptidoglycan in bacteria). It is OUTSIDE the cell membrane. It is rigid and NON-LIVING. Animal cells have NO cell wall.',
      facts: ['Made of cellulose (plants)', 'Rigid and fully permeable', 'Prevents plasmolysis extremes', 'Contains plasmodesmata'],
      size: 'Thick outer layer',
    },
    chloroplast: {
      id: 'chloroplast', label: 'Chloroplast',
      color: '#22c55e', dark: '#4ade80',
      present: ['plant'],
      function: 'Site of photosynthesis. Captures light energy and uses it to convert CO₂ and water into glucose and oxygen. Only in plant cells and algae. Contains the green pigment chlorophyll.',
      analogy: 'A solar panel factory — captures sunlight and converts it into chemical energy (glucose) stored as food.',
      structure: 'Double membrane. Contains thylakoids (flattened membrane sacs stacked into grana). Stroma (fluid) surrounds grana. Thylakoid membranes contain chlorophyll.',
      examTip: 'Photosynthesis equation: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂. Light reactions occur in thylakoid membranes. Calvin cycle (dark reactions) in the stroma. Chloroplasts have own DNA — endosymbiotic theory.',
      facts: ['Contains chlorophyll pigment', 'Has own DNA (like mitochondria)', 'Thylakoids stacked = grana', 'Stroma = site of Calvin cycle'],
      size: 'Large',
    },
    central_vacuole: {
      id: 'central_vacuole', label: 'Central Vacuole',
      color: '#38bdf8', dark: '#7dd3fc',
      present: ['plant'],
      function: 'A very large vacuole that occupies most of the plant cell\'s volume. Stores water, maintains turgor pressure, stores pigments (giving flowers colour), isolates waste products, and helps the cell grow without increasing cytoplasm volume.',
      analogy: 'A giant water balloon inside the cell — when full it pushes the cytoplasm to the edges and keeps the cell firm and upright.',
      structure: 'Single large vacuole bounded by the tonoplast membrane. Can occupy 30–90% of cell volume.',
      examTip: 'When plant wilts: central vacuole loses water → turgor pressure drops → cell becomes flaccid → plant droops. Turgid cells = healthy plant. Remember: turgid (full) vs flaccid (empty) vs plasmolysed (cell membrane pulls away from wall).',
      facts: ['Occupies up to 90% of cell', 'Tonoplast is its membrane', 'Maintains turgor pressure', 'Stores pigments and waste'],
      size: 'Very large',
    },
    plasmodesmata: {
      id: 'plasmodesmata', label: 'Plasmodesmata',
      color: '#6ee7b7', dark: '#34d399',
      present: ['plant'],
      function: 'Tiny channels through the cell walls connecting adjacent plant cells. Allow direct cytoplasm-to-cytoplasm communication and transport of water, nutrients, and signalling molecules between cells.',
      analogy: 'Doorways or tunnels in the walls between rooms — allows people (molecules) to move directly from room to room without going outside.',
      structure: 'Narrow cytoplasmic channels (40–50 nm diameter) lined by cell membrane. Desmotubule (ER strand) runs through the centre.',
      examTip: 'Plasmodesmata enable the symplast pathway (movement through connected cytoplasm). Contrast with apoplast pathway (through cell walls, no membranes crossed). Important for transport topics.',
      facts: ['40–50 nm in diameter', 'Lined by plasma membrane', 'Enable symplast transport', 'Unique to plant cells'],
      size: 'Microscopic channels',
    },
    peroxisome: {
      id: 'peroxisome', label: 'Peroxisome',
      color: '#fbbf24', dark: '#fcd34d',
      present: ['animal','plant'],
      function: 'Breaks down fatty acids for energy. Detoxifies harmful substances (especially in liver). Neutralises hydrogen peroxide (H₂O₂ — a toxic by-product of metabolism) using the enzyme catalase.',
      analogy: 'The cell\'s hazmat team — neutralises toxic chemicals produced during normal cell operations.',
      structure: 'Small membrane-bound organelle containing oxidative enzymes, especially catalase. Made by budding from ER.',
      examTip: 'Key enzyme = catalase: 2H₂O₂ → 2H₂O + O₂. Peroxisomes are very abundant in liver and kidney cells (high detoxification activity). Distinct from lysosomes.',
      facts: ['Contains catalase enzyme', 'Breaks H₂O₂ → H₂O + O₂', 'Abundant in liver cells', 'Also involved in fat oxidation'],
      size: 'Small',
    },
    cytoskeleton: {
      id: 'cytoskeleton', label: 'Cytoskeleton',
      color: '#c084fc', dark: '#d8b4fe',
      present: ['animal','plant'],
      function: 'A network of protein fibres that gives the cell its shape, supports organelles, enables cell movement, and acts as tracks for transporting materials inside the cell.',
      analogy: 'The cell\'s skeleton and motorway system — provides structural support AND highways for moving cargo around.',
      structure: 'Three components: microfilaments (actin — thin, cell shape & movement), intermediate filaments (strength & anchor organelles), microtubules (thick, highways for transport & spindle formation).',
      examTip: 'Three types to remember: microfilaments (actin, thinnest), intermediate filaments (medium), microtubules (thickest — made of tubulin). Microtubules form the mitotic spindle and cilia/flagella.',
      facts: ['Microfilaments: actin (7 nm)', 'Microtubules: tubulin (25 nm)', 'Intermediate filaments (10 nm)', 'Dynamic — constantly assembles/disassembles'],
      size: 'Network throughout',
    },
  };

  /* ══════════════════════════════════════════════════
     CELL DEFINITIONS — which organelles in each cell
     and their approximate visual positions (% of cell)
  ══════════════════════════════════════════════════ */

  const ANIMAL_LAYOUT = [
    // z:0 = background fill, z:1 = cytoskeleton, z:2 = organelles, z:3 = nucleus shell, z:4 = nucleolus, z:5 = membrane/dots
    { id:'cytoplasm',    x:100, y:100, rx:88, ry:82, shape:'ellipse', z:0, size:3 },
    { id:'cytoskeleton', x:100, y:100, shape:'cyto', z:1, size:1 },
    { id:'rough_er',     x:138, y:80,  shape:'rough_er', z:2, size:2 },
    { id:'smooth_er',    x:148, y:118, shape:'smooth_er', z:2, size:2 },
    { id:'golgi',        x:72,  y:130, shape:'golgi', z:2, size:2 },
    { id:'mitochondria', x:48,  y:75,  rx:18, ry:11, shape:'mito', z:2, size:2, rotate:-25 },
    { id:'mitochondria', x:152, y:55,  rx:15, ry:9,  shape:'mito', z:2, size:2, rotate:20, instance:2 },
    { id:'mitochondria', x:60,  y:148, rx:16, ry:10, shape:'mito', z:2, size:2, rotate:15, instance:3 },
    { id:'lysosome',     x:125, y:148, rx:9,  ry:8,  shape:'ellipse', z:2, size:1 },
    { id:'lysosome',     x:80,  y:162, rx:8,  ry:7,  shape:'ellipse', z:2, size:1, instance:2 },
    { id:'vacuole',      x:44,  y:118, rx:13, ry:12, shape:'ellipse', z:2, size:1 },
    { id:'peroxisome',   x:158, y:148, rx:8,  ry:7,  shape:'ellipse', z:2, size:1 },
    { id:'ribosome',     x:122, y:68,  shape:'dot', z:5, size:1 },
    { id:'ribosome',     x:128, y:74,  shape:'dot', z:5, size:1, instance:2 },
    { id:'ribosome',     x:118, y:78,  shape:'dot', z:5, size:1, instance:3 },
    { id:'ribosome',     x:148, y:84,  shape:'dot', z:5, size:1, instance:4 },
    { id:'ribosome',     x:80,  y:62,  shape:'dot', z:5, size:1, instance:5 },
    { id:'nucleus',      x:100, y:95,  rx:30, ry:27, shape:'ellipse', z:3, size:3 },
    { id:'nucleolus',    x:100, y:92,  rx:11, ry:9,  shape:'ellipse', z:4, size:2 },
    { id:'centriole',    x:103, y:130, shape:'centriole', z:3, size:1 },
    { id:'cell_membrane',x:100, y:100, rx:90, ry:84, shape:'membrane', z:5, size:1 },
  ];

  const PLANT_LAYOUT = [
    { id:'cell_wall',       x:100, y:100, rx:92, ry:90, shape:'wall', z:0, size:3 },
    { id:'cytoplasm',       x:100, y:100, rx:84, ry:82, shape:'ellipse', z:0, size:3 },
    { id:'cytoskeleton',    x:100, y:100, shape:'cyto', z:1, size:1 },
    { id:'central_vacuole', x:100, y:97,  rx:46, ry:48, shape:'ellipse', z:1, size:3 },
    { id:'chloroplast',     x:42,  y:58,  shape:'chloro', z:2, size:2 },
    { id:'chloroplast',     x:42,  y:148, shape:'chloro', z:2, size:2, instance:2 },
    { id:'chloroplast',     x:158, y:58,  shape:'chloro', z:2, size:2, instance:3 },
    { id:'mitochondria',    x:46,  y:100, rx:16, ry:10, shape:'mito', z:2, size:2, rotate:-15 },
    { id:'mitochondria',    x:160, y:130, rx:14, ry:9,  shape:'mito', z:2, size:2, rotate:20, instance:2 },
    { id:'rough_er',        x:138, y:148, shape:'rough_er', z:2, size:2 },
    { id:'smooth_er',       x:155, y:100, shape:'smooth_er', z:2, size:2 },
    { id:'golgi',           x:158, y:170, shape:'golgi', z:2, size:2 },
    { id:'vacuole',         x:60,  y:172, rx:9,  ry:8,  shape:'ellipse', z:2, size:1 },
    { id:'peroxisome',      x:42,  y:175, rx:7,  ry:6,  shape:'ellipse', z:2, size:1 },
    { id:'ribosome',        x:130, y:140, shape:'dot', z:5, size:1 },
    { id:'ribosome',        x:136, y:146, shape:'dot', z:5, size:1, instance:2 },
    { id:'ribosome',        x:126, y:152, shape:'dot', z:5, size:1, instance:3 },
    { id:'nucleus',         x:148, y:168, rx:20, ry:18, shape:'ellipse', z:3, size:3 },
    { id:'nucleolus',       x:148, y:166, rx:8,  ry:7,  shape:'ellipse', z:4, size:2 },
    { id:'plasmodesmata',   x:100, y:100, shape:'plasmo', z:5, size:1 },
    { id:'cell_membrane',   x:100, y:100, rx:86, ry:84, shape:'membrane', z:5, size:1 },
  ];

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
        { organelle:'nucleus',    color:'#6366f1', label:'1. DNA Blueprint', desc:'The nucleus contains the gene (DNA). The gene is transcribed into messenger RNA (mRNA). mRNA carries the instructions for making a specific protein.' },
        { organelle:'ribosome',   color:'#f97316', label:'2. Translation', desc:'mRNA exits the nucleus through nuclear pores and attaches to ribosomes on the rough ER. Ribosomes read the mRNA and assemble amino acids into a polypeptide chain (protein).' },
        { organelle:'rough_er',   color:'#8b5cf6', label:'3. Folding & Quality Check', desc:'As the protein is built, it enters the rough ER lumen. Here it is folded into the correct 3D shape. Incorrectly folded proteins are destroyed. The protein is then packaged into a vesicle.' },
        { organelle:'golgi',      color:'#10b981', label:'4. Modification & Sorting', desc:'Vesicles from the rough ER fuse with the Golgi apparatus (cis face). The Golgi modifies the protein (e.g., adds sugar chains — glycosylation). It then sorts and packages the protein into a new vesicle (trans face).' },
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
        { organelle:'cytoplasm',    color:'#a3e635', label:'1. Glycolysis', desc:'Glucose (6 carbons) is split into 2 pyruvate molecules (3 carbons each) in the cytoplasm. Produces a small amount of ATP (net 2 ATP) and NADH. Does NOT require oxygen — this is why it\'s anaerobic.' },
        { organelle:'mitochondria', color:'#ef4444', label:'2. Pyruvate Oxidation', desc:'Pyruvate enters the mitochondrial matrix and is converted to Acetyl-CoA (2 carbons), releasing CO₂. NADH is produced. This links glycolysis to the Krebs cycle.' },
        { organelle:'mitochondria', color:'#f97316', label:'3. Krebs Cycle', desc:'Acetyl-CoA enters the Krebs (citric acid) cycle in the mitochondrial matrix. Each turn produces CO₂, NADH, FADH₂, and 1 ATP. The cycle turns twice per glucose molecule.' },
        { organelle:'mitochondria', color:'#dc2626', label:'4. Oxidative Phosphorylation', desc:'NADH and FADH₂ donate electrons to the electron transport chain (inner mitochondrial membrane). Electrons flow down the chain, pumping H⁺ ions. ATP synthase uses this flow to make ATP. O₂ is the final electron acceptor (forms H₂O). Produces ~32-34 ATP per glucose.' },
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
        { organelle:'chloroplast', color:'#22c55e', label:'1. Light Absorption', desc:'Chlorophyll pigments in the thylakoid membranes of the chloroplast absorb light (mainly red and blue wavelengths, reflect green — which is why plants look green). This provides energy to split water molecules.' },
        { organelle:'chloroplast', color:'#16a34a', label:'2. Light Reactions (Thylakoid)', desc:'In the thylakoid membranes: water is split (photolysis) → O₂ released, H⁺ produced, electrons energised. These electrons power ATP synthesis and NADPH production. O₂ is a by-product released into the air.' },
        { organelle:'chloroplast', color:'#15803d', label:'3. Calvin Cycle (Stroma)', desc:'In the stroma: CO₂ from the air is "fixed" (attached to organic molecules) using ATP and NADPH from the light reactions. Through a series of reactions, glucose (C₆H₁₂O₆) is produced. This does NOT directly require light.' },
        { organelle:'cytoplasm',   color:'#a3e635', label:'4. Glucose Usage', desc:'Glucose produced in the Calvin cycle is used for: cellular respiration (energy), building cellulose (cell walls), making starch (storage), and producing other organic molecules the plant needs.' },
      ],
    },
    {
      id: 'cell_division',
      title: 'Cell Division (Mitosis Overview)',
      icon: '🔄',
      color: '#6366f1',
      description: 'How cells reproduce — creating two identical daughter cells. Critical for growth, repair, and asexual reproduction.',
      steps: [
        { organelle:'nucleus',    color:'#6366f1', label:'1. Interphase (Preparation)', desc:'The cell grows and copies its DNA (DNA replication). Each chromosome is duplicated to form two identical sister chromatids joined at the centromere. Organelles also replicate. Cell is preparing for division.' },
        { organelle:'centriole',  color:'#64748b', label:'2. Prophase', desc:'Chromosomes condense and become visible. Centrioles (in animal cells) move to opposite poles. The mitotic spindle begins to form from microtubules. Nuclear envelope breaks down.' },
        { organelle:'nucleus',    color:'#4f46e5', label:'3. Metaphase', desc:'Chromosomes line up along the cell\'s equator (metaphase plate). Spindle fibres attach to centromeres. This alignment ensures each daughter cell gets one copy of each chromosome.' },
        { organelle:'cytoplasm',  color:'#a3e635', label:'4. Anaphase & Telophase', desc:'Sister chromatids are pulled apart to opposite poles by spindle fibres. Nuclear envelopes reform around each set of chromosomes. The cell then divides by cytokinesis — animal cells pinch in, plant cells form a new cell plate.' },
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

  let _onBack        = null;
  let _mode          = 'animal';   // 'animal' | 'plant' | 'compare' | 'systems' | 'quiz'
  let _selectedOrg   = null;
  let _systemIdx     = 0;
  let _systemStep    = 0;
  let _quizIdx       = 0;
  let _quizScore     = 0;
  let _quizAnswered  = false;
  let _quizSelected  = null;
  let _quizDone      = false;
  let _shuffledQuiz  = [];

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
     RENDER
  ══════════════════════════════════════════════════ */

  function _render() {
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
        .bio-org-shape { cursor:pointer; transition:filter .15s, opacity .15s; }
        .bio-org-shape:hover { filter:brightness(1.15); }
        .bio-org-label {
          font-size:6.5px;font-weight:700;text-anchor:middle;
          dominant-baseline:middle;pointer-events:none;
          fill:var(--text-1);paint-order:stroke;
          stroke:var(--bg-page);stroke-width:2.5px;
        }
        .bio-tab {
          font-size:.625rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
          padding:4px 10px;border-radius:99px;border:1.5px solid var(--border);
          background:var(--bg-subtle);color:var(--text-3);cursor:pointer;
          white-space:nowrap;font-family:var(--font);flex-shrink:0;
          transition:all .12s ease;
        }
        .bio-tab.active {
          background:var(--accent);color:#fff;border-color:var(--accent);
        }
        .bio-step-btn {
          padding:.375rem .875rem;border-radius:var(--r-md);font-size:var(--text-sm);
          font-weight:600;border:1px solid var(--border);background:var(--bg-subtle);
          color:var(--text-2);cursor:pointer;font-family:var(--font);
          transition:all .12s;
        }
        .bio-step-btn:hover { background:var(--bg-muted); }
        .bio-step-btn.primary {
          background:var(--accent);color:#fff;border-color:var(--accent);
        }
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
      </style>`);
  }

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

  function _buildContent() {
    if (_mode === 'animal')  return _buildCellView('animal');
    if (_mode === 'plant')   return _buildCellView('plant');
    if (_mode === 'compare') return _buildCompareView();
    if (_mode === 'systems') return _buildSystemsView();
    if (_mode === 'quiz')    return _buildQuizView();
    return '';
  }

  /* ══════════════════════════════════════════════════
     CELL VIEW (Animal or Plant)
  ══════════════════════════════════════════════════ */

  function _buildCellView(type) {
    const layout = type === 'animal' ? ANIMAL_LAYOUT : PLANT_LAYOUT;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    // Legend — unique organelles in this view
    const seen = new Set();
    const legendItems = layout.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id); return true;
    }).filter(item => ORGANELLES[item.id]);

    return `
      <div style="display:flex;height:100%;overflow:hidden;">

        <!-- SVG Cell diagram -->
        <div style="flex:1 1 0;overflow:hidden;position:relative;min-width:0;">
          <svg id="bio-svg-${type}" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet"
               style="width:100%;height:100%;display:block;">
            ${_buildCellSVG(type, layout, isDark)}
          </svg>
          <!-- Tap hint -->
          <div style="position:absolute;bottom:.5rem;left:50%;transform:translateX(-50%);
                      font-size:.575rem;font-weight:600;letter-spacing:.05em;color:var(--text-4);
                      text-transform:uppercase;pointer-events:none;white-space:nowrap;
                      animation:pt-hint-fade 4s ease 1s forwards;">
            Tap any organelle to learn about it
          </div>
        </div>

        <!-- Scrollable legend panel -->
        <div style="width:130px;flex-shrink:0;overflow-y:auto;overflow-x:hidden;
                    border-left:1px solid var(--border);background:var(--bg-base);
                    padding:.5rem .4rem;scrollbar-width:thin;">
          <div style="font-size:.55rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
                      color:var(--text-4);margin-bottom:.4rem;padding:0 .2rem;">Organelles</div>
          ${legendItems.map(item => {
            const org   = ORGANELLES[item.id];
            const clr   = isDark ? org.dark : org.color;
            return `
              <button onclick="ThreeDCell._selectOrg('${item.id}')"
                      style="display:flex;align-items:center;gap:.35rem;width:100%;
                             text-align:left;padding:.3rem .4rem;border-radius:var(--r-sm);
                             border:none;background:none;cursor:pointer;font-family:var(--font);
                             transition:background .1s;"
                      onmouseenter="this.style.background='var(--bg-subtle)'"
                      onmouseleave="this.style.background='none'">
                <span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;
                             background:${clr};box-shadow:0 0 0 1.5px ${clr}40;"></span>
                <span style="font-size:.575rem;font-weight:600;color:var(--text-2);line-height:1.3;">
                  ${org.label}
                </span>
              </button>`;
          }).join('')}
        </div>

      </div>`;
  }

  function _buildCellSVG(type, layout, isDark) {
    let svg = '';
    // Sort by z-index
    const sorted = [...layout].sort((a,b) => (a.z||0) - (b.z||0));

    sorted.forEach(item => {
      const org = ORGANELLES[item.id];
      if (!org) return;
      const clr  = isDark ? org.dark : org.color;
      const key  = item.id + (item.instance ? '_'+item.instance : '');

      svg += _buildOrganelleShape(item, org, clr, key, isDark);
    });

    return svg;
  }

  function _buildOrganelleShape(item, org, clr, key, isDark) {
    const onclick = `onclick="ThreeDCell._selectOrg('${item.id}')"`;
    const cls     = `class="bio-org-shape"`;
    // No text labels drawn on SVG — labels live in the sidebar legend only

    switch (item.shape) {

      // ── Plasma membrane (outermost dashed ring) ──
      case 'membrane':
        return `
          <ellipse ${cls} ${onclick} cx="${item.x}" cy="${item.y}"
            rx="${item.rx}" ry="${item.ry}"
            fill="none" stroke="${clr}" stroke-width="2"
            stroke-dasharray="5,3" opacity="0.9"/>`;

      // ── Cell wall (plant — thick solid outer + thinner inner) ──
      case 'wall':
        return `
          <ellipse cx="${item.x}" cy="${item.y}" rx="${item.rx}" ry="${item.ry}"
            fill="${clr}18" stroke="${clr}" stroke-width="5" opacity="0.7" pointer-events="none"/>
          <ellipse ${cls} ${onclick} cx="${item.x}" cy="${item.y}"
            rx="${item.rx-3}" ry="${item.ry-3}"
            fill="none" stroke="${clr}" stroke-width="1.5" stroke-dasharray="4,2" opacity="0.5"/>`;

      // ── Generic filled ellipse (nucleus, vacuoles, lysosomes, etc.) ──
      case 'ellipse': {
        const gid = `grad-${key}`;
        const isNucleus  = item.id === 'nucleus';
        const isCyto     = item.id === 'cytoplasm' || item.id === 'central_vacuole';
        const fillAlpha  = isCyto ? '18' : isNucleus ? 'cc' : 'aa';
        const strokeW    = isNucleus ? 2.5 : isCyto ? 0 : 1.5;
        return `
          <defs>
            <radialGradient id="${gid}" cx="35%" cy="28%" r="72%">
              <stop offset="0%" stop-color="${clr}" stop-opacity="${isCyto ? 0.12 : 0.6}"/>
              <stop offset="100%" stop-color="${clr}" stop-opacity="${isCyto ? 0.04 : 0.18}"/>
            </radialGradient>
          </defs>
          <ellipse ${cls} ${onclick} cx="${item.x}" cy="${item.y}"
            rx="${item.rx}" ry="${item.ry}"
            fill="url(#${gid})"
            stroke="${isCyto ? 'none' : clr}" stroke-width="${strokeW}" opacity="0.92"/>
          ${isNucleus ? `
            <ellipse cx="${item.x}" cy="${item.y}" rx="${item.rx-2}" ry="${item.ry-2}"
              fill="none" stroke="${clr}" stroke-width="1" stroke-dasharray="3,2"
              opacity="0.5" pointer-events="none"/>
            <!-- Nuclear pores — tiny notches on the envelope -->
            ${[0,45,90,135,180,225,270,315].map(deg => {
              const rad = deg * Math.PI / 180;
              const px  = item.x + item.rx * Math.cos(rad);
              const py  = item.y + item.ry * Math.sin(rad);
              return `<circle cx="${px}" cy="${py}" r="1.8" fill="${clr}" opacity="0.6" pointer-events="none"/>`;
            }).join('')}` : ''}`;
      }

      // ── Mitochondria (oval with inner cristae folds) ──
      case 'mito': {
        const r   = item.rotate || 0;
        const gid = `grad-mito-${key}`;
        const rx  = item.rx, ry = item.ry;
        return `
          <defs>
            <radialGradient id="${gid}" cx="30%" cy="28%" r="72%">
              <stop offset="0%" stop-color="${clr}" stop-opacity="0.75"/>
              <stop offset="100%" stop-color="${clr}" stop-opacity="0.25"/>
            </radialGradient>
          </defs>
          <g transform="rotate(${r},${item.x},${item.y})" ${cls} ${onclick}>
            <!-- Outer membrane -->
            <ellipse cx="${item.x}" cy="${item.y}" rx="${rx}" ry="${ry}"
              fill="url(#${gid})" stroke="${clr}" stroke-width="1.5"/>
            <!-- Inner membrane outline -->
            <ellipse cx="${item.x}" cy="${item.y}" rx="${rx-3}" ry="${ry-2.5}"
              fill="none" stroke="${clr}" stroke-width="0.8" opacity="0.5"/>
            <!-- Cristae (inner folds) -->
            <path d="M${item.x-rx*0.4},${item.y-ry*0.55} Q${item.x-rx*0.15},${item.y} ${item.x-rx*0.4},${item.y+ry*0.55}"
              fill="none" stroke="${clr}" stroke-width="1" opacity="0.65"/>
            <path d="M${item.x+rx*0.05},${item.y-ry*0.65} Q${item.x+rx*0.3},${item.y} ${item.x+rx*0.05},${item.y+ry*0.65}"
              fill="none" stroke="${clr}" stroke-width="1" opacity="0.65"/>
            <path d="M${item.x+rx*0.45},${item.y-ry*0.5} Q${item.x+rx*0.65},${item.y} ${item.x+rx*0.45},${item.y+ry*0.5}"
              fill="none" stroke="${clr}" stroke-width="1" opacity="0.65"/>
          </g>`;
      }

      // ── Rough ER (parallel wavy ribbons with ribosome dots on top edge) ──
      case 'rough_er': {
        const ox = item.x, oy = item.y;
        return `
          <g ${cls} ${onclick}>
            <!-- Three membrane layers -->
            ${[-10, 0, 10].map((dy, li) => `
              <path d="M${ox-22},${oy+dy} C${ox-15},${oy+dy-7} ${ox-7},${oy+dy+7}
                       ${ox},${oy+dy} C${ox+7},${oy+dy-7} ${ox+15},${oy+dy+7} ${ox+22},${oy+dy}"
                fill="none" stroke="${clr}" stroke-width="${li===1?1.8:1.2}" opacity="${li===1?0.9:0.65}"/>
              <!-- Ribosomes on top face of each ribbon -->
              ${[-18,-9,0,9,18].map(dx => `
                <circle cx="${ox+dx}" cy="${oy+dy-3.5}" r="1.8" fill="${clr}" opacity="0.85"/>
              `).join('')}
            `).join('')}
          </g>`;
      }

      // ── Smooth ER (wavy ribbons, NO ribosome dots) ──
      case 'smooth_er': {
        const ox = item.x, oy = item.y;
        return `
          <g ${cls} ${onclick}>
            ${[-7, 0, 7].map((dy, li) => `
              <path d="M${ox-20},${oy+dy} C${ox-13},${oy+dy-6} ${ox-6},${oy+dy+6}
                       ${ox+1},${oy+dy} C${ox+8},${oy+dy-6} ${ox+15},${oy+dy+6} ${ox+22},${oy+dy}"
                fill="none" stroke="${clr}" stroke-width="${li===1?1.8:1.2}" opacity="${li===1?0.9:0.6}"/>
            `).join('')}
            <!-- Rounded end caps to show tube structure -->
            <circle cx="${ox-20}" cy="${oy}" r="3" fill="${clr}" opacity="0.25"/>
            <circle cx="${ox+22}" cy="${oy}" r="3" fill="${clr}" opacity="0.25"/>
          </g>`;
      }

      // ── Golgi (stacked curved cisternae, cis → trans, with budding vesicles) ──
      case 'golgi': {
        const ox = item.x, oy = item.y;
        // 5 stacked arcs, widening cis→trans, with vesicle buds on trans (bottom)
        const cisternae = [
          { dy:-14, w:16, sw:1.2, op:0.55 },
          { dy:-7,  w:20, sw:1.4, op:0.65 },
          { dy: 0,  w:23, sw:1.8, op:0.85 },
          { dy: 7,  w:25, sw:1.6, op:0.75 },
          { dy:14,  w:22, sw:1.3, op:0.6  },
        ];
        return `
          <g ${cls} ${onclick}>
            ${cisternae.map(c => `
              <path d="M${ox-c.w},${oy+c.dy} Q${ox},${oy+c.dy-6} ${ox+c.w},${oy+c.dy}"
                fill="none" stroke="${clr}" stroke-width="${c.sw}" opacity="${c.op}"
                stroke-linecap="round"/>
            `).join('')}
            <!-- Trans face vesicle buds (bottom) -->
            <circle cx="${ox+28}" cy="${oy+10}" r="4" fill="${clr}" opacity="0.7"/>
            <circle cx="${ox+34}" cy="${oy+2}"  r="3" fill="${clr}" opacity="0.5"/>
            <circle cx="${ox-30}" cy="${oy+8}"  r="3.5" fill="${clr}" opacity="0.6"/>
            <!-- Cis face label line -->
            <line x1="${ox-24}" y1="${oy-14}" x2="${ox-30}" y2="${oy-14}"
              stroke="${clr}" stroke-width="0.8" opacity="0.4"/>
            <line x1="${ox-24}" y1="${oy+14}" x2="${ox-30}" y2="${oy+14}"
              stroke="${clr}" stroke-width="0.8" opacity="0.4"/>
          </g>`;
      }

      // ── Ribosome (two-subunit dot pair) ──
      case 'dot':
        return `
          <g ${cls} ${onclick}>
            <circle cx="${item.x}"   cy="${item.y}"   r="2.8" fill="${clr}" opacity="0.9"/>
            <circle cx="${item.x+3}" cy="${item.y+2}" r="2.1" fill="${clr}" opacity="0.75"/>
          </g>`;

      // ── Centrioles (two perpendicular barrels with internal rings) ──
      case 'centriole': {
        const ox = item.x, oy = item.y;
        return `
          <g ${cls} ${onclick}>
            <!-- Centriole 1 (horizontal barrel) -->
            <rect x="${ox-13}" y="${oy-4}" width="26" height="8" rx="4"
              fill="${clr}" opacity="0.75"/>
            <!-- Internal ring markings -->
            ${[-7,0,7].map(dx => `
              <ellipse cx="${ox+dx}" cy="${oy}" rx="1.5" ry="3.5"
                fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="0.8" opacity="0.6"/>
            `).join('')}
            <!-- Centriole 2 (vertical barrel, perpendicular) -->
            <rect x="${ox-4}" y="${oy+6}" width="8" height="20" rx="4"
              fill="${clr}" opacity="0.75"/>
            ${[-5,0,5].map(dy => `
              <ellipse cx="${ox}" cy="${oy+6+10+dy}" rx="3.5" ry="1.5"
                fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="0.8" opacity="0.6"/>
            `).join('')}
          </g>`;
      }

      // ── Chloroplast (lens-shaped with visible grana stacks) ──
      case 'chloro': {
        const ox = item.x, oy = item.y;
        const gid = `grad-chloro-${key}`;
        return `
          <defs>
            <radialGradient id="${gid}" cx="30%" cy="28%" r="72%">
              <stop offset="0%" stop-color="${clr}" stop-opacity="0.85"/>
              <stop offset="100%" stop-color="${clr}" stop-opacity="0.3"/>
            </radialGradient>
          </defs>
          <g ${cls} ${onclick}>
            <!-- Outer double membrane (lens shape) -->
            <ellipse cx="${ox}" cy="${oy}" rx="20" ry="11"
              fill="url(#${gid})" stroke="${clr}" stroke-width="1.8"/>
            <ellipse cx="${ox}" cy="${oy}" rx="17" ry="8.5"
              fill="none" stroke="${clr}" stroke-width="0.8" opacity="0.45"/>
            <!-- Grana stacks (thylakoid discs) -->
            ${[[-8,0,3],[-1,0,4],[7,0,3]].map(([dx,_,h]) => `
              <rect x="${ox+dx-2.5}" y="${oy-h}" width="5" height="${h*2}"
                fill="${clr}" opacity="0.6" rx="1"/>
              <!-- Individual thylakoid lines -->
              <line x1="${ox+dx-2.5}" y1="${oy-h/2}" x2="${ox+dx+2.5}" y2="${oy-h/2}"
                stroke="rgba(255,255,255,0.25)" stroke-width="0.6"/>
              <line x1="${ox+dx-2.5}" y1="${oy+h/2}" x2="${ox+dx+2.5}" y2="${oy+h/2}"
                stroke="rgba(255,255,255,0.25)" stroke-width="0.6"/>
            `).join('')}
          </g>`;
      }

      // ── Cytoskeleton (faint diagonal fibres) ──
      case 'cyto':
        return `
          <g ${cls} ${onclick} opacity="0.18">
            <line x1="30"  y1="30"  x2="170" y2="155" stroke="${clr}" stroke-width="1"   stroke-dasharray="4,6"/>
            <line x1="60"  y1="20"  x2="155" y2="170" stroke="${clr}" stroke-width="0.8" stroke-dasharray="3,6"/>
            <line x1="20"  y1="110" x2="180" y2="82"  stroke="${clr}" stroke-width="1"   stroke-dasharray="4,6"/>
            <line x1="30"  y1="155" x2="170" y2="45"  stroke="${clr}" stroke-width="0.8" stroke-dasharray="3,6"/>
            <line x1="100" y1="18"  x2="100" y2="182" stroke="${clr}" stroke-width="0.7" stroke-dasharray="3,6"/>
          </g>`;

      // ── Plasmodesmata (channels on cell wall — top and bottom edges) ──
      case 'plasmo':
        return `
          <g ${cls} ${onclick}>
            <!-- Top wall channels -->
            ${[-30,-15,0,15,30].map(dx => `
              <rect x="${100+dx-1.5}" y="8" width="3" height="11"
                fill="${clr}" opacity="0.85" rx="0.8"/>
            `).join('')}
            <!-- Bottom wall channels -->
            ${[-30,-15,0,15,30].map(dx => `
              <rect x="${100+dx-1.5}" y="181" width="3" height="11"
                fill="${clr}" opacity="0.85" rx="0.8"/>
            `).join('')}
            <!-- Left wall channels -->
            ${[-25,-8,10].map(dy => `
              <rect x="8" y="${100+dy-1.5}" width="11" height="3"
                fill="${clr}" opacity="0.7" rx="0.8"/>
            `).join('')}
            <!-- Right wall channels -->
            ${[-25,-8,10].map(dy => `
              <rect x="181" y="${100+dy-1.5}" width="11" height="3"
                fill="${clr}" opacity="0.7" rx="0.8"/>
            `).join('')}
          </g>`;

      default:
        return '';
    }
  }

  /* ══════════════════════════════════════════════════
     COMPARE VIEW
  ══════════════════════════════════════════════════ */

  function _buildCompareView() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    // Differences table
    const diffs = [
      { feature:'Cell Wall',       animal:'✗ Absent',         plant:'✓ Cellulose cell wall' },
      { feature:'Chloroplasts',    animal:'✗ Absent',         plant:'✓ Present (photosynthesis)' },
      { feature:'Central Vacuole', animal:'✗ (many small)',   plant:'✓ One large central vacuole' },
      { feature:'Centrioles',      animal:'✓ Present',        plant:'✗ Absent in most species' },
      { feature:'Lysosomes',       animal:'✓ Common',         plant:'✗ Rare (vacuole does this role)' },
      { feature:'Plasmodesmata',   animal:'✗ Absent',         plant:'✓ Present (cell-cell channels)' },
      { feature:'Shape',           animal:'Round/irregular',  plant:'Rectangular/fixed' },
      { feature:'Mitochondria',    animal:'✓ Many',           plant:'✓ Present (but fewer)' },
      { feature:'Ribosomes',       animal:'✓ 80S type',       plant:'✓ 80S type' },
      { feature:'Nucleus',         animal:'✓ Present',        plant:'✓ Often to one side' },
      { feature:'Golgi',           animal:'✓ Present',        plant:'✓ Present (called dictyosome)' },
      { feature:'ER',              animal:'✓ Both types',     plant:'✓ Both types' },
    ];

    return `
      <div style="height:100%;overflow-y:auto;padding:.75rem;">
        <div style="max-width:720px;margin:0 auto;">

          <!-- Mini diagrams side by side -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1rem;">
            <div style="background:var(--bg-base);border:1px solid var(--border);border-radius:var(--r-xl);
                        padding:.5rem;text-align:center;">
              <div style="font-size:.625rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
                          color:var(--text-3);margin-bottom:.3rem;">🐾 Animal Cell</div>
              <svg viewBox="0 0 200 200" style="width:100%;height:140px;">
                ${_buildCellSVG('animal', ANIMAL_LAYOUT, isDark)}
              </svg>
            </div>
            <div style="background:var(--bg-base);border:1px solid var(--border);border-radius:var(--r-xl);
                        padding:.5rem;text-align:center;">
              <div style="font-size:.625rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
                          color:var(--text-3);margin-bottom:.3rem;">🌿 Plant Cell</div>
              <svg viewBox="0 0 200 200" style="width:100%;height:140px;">
                ${_buildCellSVG('plant', PLANT_LAYOUT, isDark)}
              </svg>
            </div>
          </div>

          <!-- Differences table -->
          <div style="background:var(--bg-base);border:1px solid var(--border);border-radius:var(--r-xl);overflow:hidden;">
            <div style="padding:.625rem 1rem;border-bottom:1px solid var(--border);
                        background:var(--bg-subtle);display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;">
              <span style="font-size:.575rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--text-3);">Feature</span>
              <span style="font-size:.575rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--text-3);">🐾 Animal</span>
              <span style="font-size:.575rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--text-3);">🌿 Plant</span>
            </div>
            ${diffs.map((d, i) => `
              <div style="padding:.5rem 1rem;${i < diffs.length-1 ? 'border-bottom:1px solid var(--border);' : ''}
                          display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;align-items:center;
                          ${i%2===0 ? 'background:var(--bg-base);' : 'background:var(--bg-subtle);'}">
                <span style="font-size:var(--text-xs);font-weight:600;color:var(--text-1);">${d.feature}</span>
                <span style="font-size:var(--text-xs);color:${d.animal.startsWith('✓') ? 'var(--success)' : d.animal.startsWith('✗') ? 'var(--danger)' : 'var(--text-2)'};">
                  ${d.animal}
                </span>
                <span style="font-size:var(--text-xs);color:${d.plant.startsWith('✓') ? 'var(--success)' : d.plant.startsWith('✗') ? 'var(--danger)' : 'var(--text-2)'};">
                  ${d.plant}
                </span>
              </div>`).join('')}
          </div>

          <!-- Exam tip box -->
          <div style="margin-top:.75rem;padding:.75rem 1rem;border-radius:var(--r-xl);
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
     SYSTEMS VIEW
  ══════════════════════════════════════════════════ */

  function _buildSystemsView() {
    const sys  = SYSTEMS[_systemIdx];
    const step = sys.steps[_systemStep];
    const totalSteps = sys.steps.length;

    return `
      <div style="height:100%;display:flex;flex-direction:column;overflow:hidden;">

        <!-- System selector tabs -->
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

        <!-- System content -->
        <div style="flex:1 1 0;overflow-y:auto;padding:.75rem;">
          <div style="max-width:640px;margin:0 auto;">

            <!-- System header -->
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

            <!-- Step progress bar -->
            <div style="display:flex;gap:.3rem;margin-bottom:.75rem;">
              ${sys.steps.map((s, i) => `
                <div style="flex:1;height:5px;border-radius:99px;
                            background:${i <= _systemStep ? sys.color : 'var(--border)'};
                            cursor:pointer;transition:background .2s;"
                     onclick="ThreeDCell._setStep(${i})"></div>`).join('')}
            </div>

            <!-- Current step card -->
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

            <!-- All steps overview -->
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

            <!-- Nav buttons -->
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

          <!-- Score + progress -->
          <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem;">
            <div style="flex:1;height:6px;border-radius:99px;background:var(--border);overflow:hidden;">
              <div style="width:${prog}%;height:100%;background:var(--accent);border-radius:99px;transition:width .3s;"></div>
            </div>
            <span style="font-size:.6rem;font-weight:700;color:var(--text-3);white-space:nowrap;flex-shrink:0;">
              Q${_quizIdx+1}/${_shuffledQuiz.length} · Score: ${_quizScore}
            </span>
          </div>

          <!-- Question card -->
          <div style="background:var(--bg-base);border:2px solid var(--accent-border);
                      border-radius:var(--r-xl);padding:1rem 1.25rem;margin-bottom:.875rem;">
            <div style="font-size:.6rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
                        color:var(--accent);margin-bottom:.5rem;">Question ${_quizIdx+1}</div>
            <p style="font-size:var(--text-md);font-weight:600;color:var(--text-1);
                      line-height:1.5;margin:0;">${q.q}</p>
          </div>

          <!-- Options -->
          <div id="bio-quiz-opts">
            ${opts.map(opt => {
              const org  = ORGANELLES[opt];
              const label = org ? org.label : opt;
              let extraStyle = '';
              if (_quizAnswered) {
                if (opt === q.a)         extraStyle = 'correct';
                else if (opt === _quizSelected && opt !== q.a) extraStyle = 'wrong';
              }
              return `
                <button class="bio-quiz-opt ${extraStyle}"
                        ${_quizAnswered ? 'disabled' : ''}
                        onclick="ThreeDCell._answerQuiz('${opt}', '${q.a}')">
                  ${label}
                </button>`;
            }).join('')}
          </div>

          <!-- Explanation (after answer) -->
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
    const total   = _shuffledQuiz.length;
    const pct     = Math.round(_quizScore / total * 100);
    const grade   = pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good job!' : pct >= 40 ? 'Keep practising.' : 'More revision needed.';
    const color   = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--accent)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';

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
            ${pct < 100 ? `<p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.7;">
              Review the Animal Cell and Plant Cell diagrams. Tap each organelle to read its function.
              Focus on: ${['mitochondria','nucleus','chloroplast','golgi','ribosome'].map(id => ORGANELLES[id].label).join(', ')}.
            </p>` : '<p style="color:var(--success);font-size:var(--text-sm);">Perfect score! You know all organelles. 🎉</p>'}
          </div>

          <div style="display:flex;gap:.625rem;justify-content:center;flex-wrap:wrap;">
            <button class="bio-step-btn primary" onclick="ThreeDCell._restartQuiz()"
                    style="padding:.5rem 1.25rem;">
              ↺ Retake Quiz
            </button>
            <button class="bio-step-btn" onclick="ThreeDCell._setMode('animal')"
                    style="padding:.5rem 1.25rem;">
              📖 Study Cells
            </button>
          </div>
        </div>
      </div>`;
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

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const clr    = isDark ? org.dark : org.color;

    inner.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:.625rem;margin-bottom:.5rem;">
        <!-- Icon block -->
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
                </span>`
              : ''}
          </div>
        </div>
        <button onclick="ThreeDCell._closeDetail()"
                style="flex-shrink:0;background:none;border:none;cursor:pointer;
                       font-size:1.2rem;color:var(--text-4);padding:2px;">×</button>
      </div>

      <!-- Scrollable content in fixed height -->
      <div style="max-height:200px;overflow-y:auto;scrollbar-width:thin;">

        <!-- Function -->
        <div style="margin-bottom:.5rem;">
          <div style="font-size:.55rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
                      color:${clr};margin-bottom:.25rem;">Function</div>
          <p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.6;margin:0;
                    border-left:2px solid ${clr};padding-left:.5rem;">${org.function}</p>
        </div>

        <!-- Analogy -->
        <div style="margin-bottom:.5rem;padding:.5rem .75rem;border-radius:var(--r-md);
                    background:${clr}11;border:1px solid ${clr}33;">
          <div style="font-size:.55rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
                      color:${clr};margin-bottom:.2rem;">💡 Analogy</div>
          <p style="font-size:var(--text-xs);color:var(--text-2);line-height:1.5;margin:0;
                    font-style:italic;">${org.analogy}</p>
        </div>

        <!-- Structure -->
        <div style="margin-bottom:.5rem;">
          <div style="font-size:.55rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
                      color:var(--text-4);margin-bottom:.2rem;">Structure</div>
          <p style="font-size:var(--text-xs);color:var(--text-3);line-height:1.55;margin:0;">${org.structure}</p>
        </div>

        <!-- Key facts -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.275rem;margin-bottom:.5rem;">
          ${org.facts.map(f => `
            <div style="background:var(--bg-subtle);border:1px solid var(--border);
                        border-radius:var(--r-sm);padding:.25rem .4rem;
                        font-size:.575rem;color:var(--text-2);line-height:1.4;">
              • ${f}
            </div>`).join('')}
        </div>

        <!-- Exam tip -->
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
     PUBLIC ACTIONS (called from inline HTML)
  ══════════════════════════════════════════════════ */

  function _setMode(mode) {
    _mode        = mode;
    _selectedOrg = null;
    _systemStep  = 0;
    const detail = document.getElementById('bio-detail');
    if (detail) detail.style.maxHeight = '0';

    // Re-render content and mode bar only
    const content = document.getElementById('bio-content');
    if (content) content.innerHTML = _buildContent();

    // Update mode bar active state
    document.querySelectorAll('.bio-tab').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${mode}'`));
    });

    // Update org count label
    const cnt = document.getElementById('bio-org-count');
    if (cnt) {
      if (mode === 'animal') cnt.textContent = `${Object.keys(ORGANELLES).filter(k => ORGANELLES[k].present.includes('animal')).length} organelles`;
      else if (mode === 'plant') cnt.textContent = `${Object.keys(ORGANELLES).filter(k => ORGANELLES[k].present.includes('plant')).length} organelles`;
      else cnt.textContent = '';
    }
  }

  function _selectOrg(orgId) {
    _selectedOrg = orgId;
    _showDetail(orgId);
  }

  function _closeDetail() {
    _selectedOrg = null;
    const panel  = document.getElementById('bio-detail');
    if (panel) panel.style.maxHeight = '0';
  }

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
    if (_systemStep < sys.steps.length - 1) {
      _systemStep++;
    } else {
      _systemStep = 0;
    }
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
