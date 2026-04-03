/* ============================================================
   js/threedclass-periodic.js — Interactive 3D Periodic Table
   ============================================================
   Architecture:
     - CSS 3D transforms (no Three.js) for mobile performance
     - All 118 elements with full property data
     - Touch gesture support: swipe rotate, pinch zoom, tap select
     - Element detail panel slides up on selection
     - Keyboard navigation on desktop
     - Renders into #app via UI.mount(), integrates fully with SPA

   Called by:
     ThreeDPeriodic.open(onBackCallback)

   Returns:
     onBackCallback() when the user navigates back
   ============================================================ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════
     ELEMENT DATA — All 118 elements
  ══════════════════════════════════════════════════ */

  const ELEMENTS = [
    // period 1
    { n:1,  sym:'H',  name:'Hydrogen',      mass:1.008,    cat:'nonmetal',       period:1, group:1,  config:'1s¹',           melt:-259.14, boil:-252.87, density:0.00009,  discovered:1766, desc:'The lightest and most abundant element in the universe. Essential for water, life, and stars.' },
    { n:2,  sym:'He', name:'Helium',         mass:4.003,    cat:'noble-gas',      period:1, group:18, config:'1s²',           melt:null,    boil:-268.93, density:0.000179, discovered:1868, desc:'A colourless noble gas. Second most abundant in the universe. Used in balloons and MRI machines.' },
    // period 2
    { n:3,  sym:'Li', name:'Lithium',        mass:6.941,    cat:'alkali-metal',   period:2, group:1,  config:'[He] 2s¹',      melt:180.54,  boil:1342,    density:0.534,    discovered:1817, desc:'Lightest metal. Used in batteries, ceramics, and psychiatric medicine.' },
    { n:4,  sym:'Be', name:'Beryllium',      mass:9.012,    cat:'alkaline-earth', period:2, group:2,  config:'[He] 2s²',      melt:1287,    boil:2470,    density:1.85,     discovered:1798, desc:'Lightweight, stiff metal. Used in aerospace alloys and X-ray equipment.' },
    { n:5,  sym:'B',  name:'Boron',          mass:10.811,   cat:'metalloid',      period:2, group:13, config:'[He] 2s² 2p¹',  melt:2076,    boil:3927,    density:2.34,     discovered:1808, desc:'A metalloid used in glass, detergents, and semiconductor doping.' },
    { n:6,  sym:'C',  name:'Carbon',         mass:12.011,   cat:'nonmetal',       period:2, group:14, config:'[He] 2s² 2p²',  melt:3642,    boil:3642,    density:2.267,    discovered:null, desc:'The basis of all organic life. Exists as diamond, graphite, graphene, and fullerene.' },
    { n:7,  sym:'N',  name:'Nitrogen',       mass:14.007,   cat:'nonmetal',       period:2, group:15, config:'[He] 2s² 2p³',  melt:-210.01, boil:-195.79, density:0.00125,  discovered:1772, desc:'Makes up 78% of Earth\'s atmosphere. Essential for amino acids and DNA.' },
    { n:8,  sym:'O',  name:'Oxygen',         mass:15.999,   cat:'nonmetal',       period:2, group:16, config:'[He] 2s² 2p⁴',  melt:-218.3,  boil:-182.96, density:0.00143,  discovered:1774, desc:'Essential for respiration and combustion. Third most abundant element in the universe.' },
    { n:9,  sym:'F',  name:'Fluorine',       mass:18.998,   cat:'halogen',        period:2, group:17, config:'[He] 2s² 2p⁵',  melt:-219.67, boil:-188.11, density:0.001696, discovered:1886, desc:'Most electronegative element. Highly reactive. Used in Teflon and toothpaste.' },
    { n:10, sym:'Ne', name:'Neon',           mass:20.18,    cat:'noble-gas',      period:2, group:18, config:'[He] 2s² 2p⁶',  melt:-248.59, boil:-246.08, density:0.0009,   discovered:1898, desc:'Inert noble gas. Famous for glowing red-orange in neon signs and lasers.' },
    // period 3
    { n:11, sym:'Na', name:'Sodium',         mass:22.99,    cat:'alkali-metal',   period:3, group:1,  config:'[Ne] 3s¹',      melt:97.72,   boil:883,     density:0.968,    discovered:1807, desc:'A soft, silvery-white metal. Essential electrolyte in biology. Reacts explosively with water.' },
    { n:12, sym:'Mg', name:'Magnesium',      mass:24.305,   cat:'alkaline-earth', period:3, group:2,  config:'[Ne] 3s²',      melt:650,     boil:1090,    density:1.738,    discovered:1755, desc:'Lightweight structural metal. Essential for chlorophyll and human metabolism.' },
    { n:13, sym:'Al', name:'Aluminium',      mass:26.982,   cat:'post-transition',period:3, group:13, config:'[Ne] 3s² 3p¹',  melt:660.32,  boil:2519,    density:2.698,    discovered:1825, desc:'Most abundant metal in Earth\'s crust. Lightweight, corrosion-resistant, widely used.' },
    { n:14, sym:'Si', name:'Silicon',        mass:28.086,   cat:'metalloid',      period:3, group:14, config:'[Ne] 3s² 3p²',  melt:1414,    boil:2900,    density:2.329,    discovered:1824, desc:'Second most abundant element in crust. The foundation of computer chips and glass.' },
    { n:15, sym:'P',  name:'Phosphorus',     mass:30.974,   cat:'nonmetal',       period:3, group:15, config:'[Ne] 3s² 3p³',  melt:44.15,   boil:280.5,   density:1.823,    discovered:1669, desc:'Essential for DNA, ATP, and bones. Used in fertilisers and matches.' },
    { n:16, sym:'S',  name:'Sulfur',         mass:32.06,    cat:'nonmetal',       period:3, group:16, config:'[Ne] 3s² 3p⁴',  melt:115.21,  boil:444.61,  density:2.067,    discovered:null, desc:'Yellow nonmetal known since antiquity. Used in gunpowder, rubber vulcanisation, and acids.' },
    { n:17, sym:'Cl', name:'Chlorine',       mass:35.45,    cat:'halogen',        period:3, group:17, config:'[Ne] 3s² 3p⁵',  melt:-101.5,  boil:-34.04,  density:0.00321,  discovered:1774, desc:'Pungent yellow-green gas. Used for water disinfection, PVC, and bleach.' },
    { n:18, sym:'Ar', name:'Argon',          mass:39.948,   cat:'noble-gas',      period:3, group:18, config:'[Ne] 3s² 3p⁶',  melt:-189.36, boil:-185.85, density:0.00178,  discovered:1894, desc:'Third most abundant gas in atmosphere. Used in welding and incandescent bulbs.' },
    // period 4
    { n:19, sym:'K',  name:'Potassium',      mass:39.098,   cat:'alkali-metal',   period:4, group:1,  config:'[Ar] 4s¹',      melt:63.38,   boil:759,     density:0.862,    discovered:1807, desc:'Vital electrolyte for nerve and muscle function. Reacts vigorously with water.' },
    { n:20, sym:'Ca', name:'Calcium',        mass:40.078,   cat:'alkaline-earth', period:4, group:2,  config:'[Ar] 4s²',      melt:842,     boil:1484,    density:1.55,     discovered:1808, desc:'Most abundant mineral in the body. Essential for bones, teeth, and nerve signals.' },
    { n:21, sym:'Sc', name:'Scandium',       mass:44.956,   cat:'transition',     period:4, group:3,  config:'[Ar] 3d¹ 4s²',  melt:1541,    boil:2836,    density:2.985,    discovered:1879, desc:'Rare transition metal. Used in aluminium alloys for aerospace and sports equipment.' },
    { n:22, sym:'Ti', name:'Titanium',       mass:47.867,   cat:'transition',     period:4, group:4,  config:'[Ar] 3d² 4s²',  melt:1668,    boil:3287,    density:4.506,    discovered:1791, desc:'Strong, lightweight, corrosion-resistant. Used in aircraft, implants, and spacecraft.' },
    { n:23, sym:'V',  name:'Vanadium',       mass:50.942,   cat:'transition',     period:4, group:5,  config:'[Ar] 3d³ 4s²',  melt:1910,    boil:3407,    density:6.0,      discovered:1801, desc:'Hard, bluish-silver metal. Used in high-strength steel alloys and redox batteries.' },
    { n:24, sym:'Cr', name:'Chromium',       mass:51.996,   cat:'transition',     period:4, group:6,  config:'[Ar] 3d⁵ 4s¹',  melt:1907,    boil:2671,    density:7.15,     discovered:1797, desc:'Shiny, hard metal. Used in stainless steel and decorative chrome plating.' },
    { n:25, sym:'Mn', name:'Manganese',      mass:54.938,   cat:'transition',     period:4, group:7,  config:'[Ar] 3d⁵ 4s²',  melt:1246,    boil:2061,    density:7.44,     discovered:1774, desc:'Used in steel production and dry cell batteries. Essential trace element in biology.' },
    { n:26, sym:'Fe', name:'Iron',           mass:55.845,   cat:'transition',     period:4, group:8,  config:'[Ar] 3d⁶ 4s²',  melt:1538,    boil:2861,    density:7.874,    discovered:null, desc:'Most common metal on Earth. Basis of steel. Essential in haemoglobin for oxygen transport.' },
    { n:27, sym:'Co', name:'Cobalt',         mass:58.933,   cat:'transition',     period:4, group:9,  config:'[Ar] 3d⁷ 4s²',  melt:1495,    boil:2927,    density:8.9,      discovered:1735, desc:'Magnetic metal. Used in lithium-ion batteries, alloys, and Vitamin B12.' },
    { n:28, sym:'Ni', name:'Nickel',         mass:58.693,   cat:'transition',     period:4, group:10, config:'[Ar] 3d⁸ 4s²',  melt:1455,    boil:2913,    density:8.908,    discovered:1751, desc:'Corrosion-resistant metal. Used in stainless steel, coins, and rechargeable batteries.' },
    { n:29, sym:'Cu', name:'Copper',         mass:63.546,   cat:'transition',     period:4, group:11, config:'[Ar] 3d¹⁰ 4s¹', melt:1084.62, boil:2562,    density:8.96,     discovered:null, desc:'Excellent electrical conductor. Oldest metal used by humans. Essential trace element.' },
    { n:30, sym:'Zn', name:'Zinc',           mass:65.38,    cat:'transition',     period:4, group:12, config:'[Ar] 3d¹⁰ 4s²', melt:419.53,  boil:907,     density:7.134,    discovered:1746, desc:'Used in galvanising steel and in alloys like brass. Essential mineral for immune function.' },
    { n:31, sym:'Ga', name:'Gallium',        mass:69.723,   cat:'post-transition',period:4, group:13, config:'[Ar] 3d¹⁰ 4s² 4p¹', melt:29.76, boil:2229, density:5.907,   discovered:1875, desc:'Melts just above room temperature. Used in semiconductors and LEDs.' },
    { n:32, sym:'Ge', name:'Germanium',      mass:72.63,    cat:'metalloid',      period:4, group:14, config:'[Ar] 3d¹⁰ 4s² 4p²', melt:938.25, boil:2833, density:5.323,  discovered:1886, desc:'Metalloid semiconductor. Used in fibre optics and early transistors.' },
    { n:33, sym:'As', name:'Arsenic',        mass:74.922,   cat:'metalloid',      period:4, group:15, config:'[Ar] 3d¹⁰ 4s² 4p³', melt:817,  boil:614,   density:5.727,   discovered:null, desc:'Toxic metalloid. Used in semiconductors, wood preservatives, and historically as poison.' },
    { n:34, sym:'Se', name:'Selenium',       mass:78.971,   cat:'nonmetal',       period:4, group:16, config:'[Ar] 3d¹⁰ 4s² 4p⁴', melt:220.8, boil:685,  density:4.809,   discovered:1817, desc:'Essential trace element. Used in photocopiers, solar cells, and glass manufacturing.' },
    { n:35, sym:'Br', name:'Bromine',        mass:79.904,   cat:'halogen',        period:4, group:17, config:'[Ar] 3d¹⁰ 4s² 4p⁵', melt:-7.2,  boil:58.9, density:3.122,   discovered:1826, desc:'One of two liquid elements at room temperature. Used in flame retardants and dyes.' },
    { n:36, sym:'Kr', name:'Krypton',        mass:83.798,   cat:'noble-gas',      period:4, group:18, config:'[Ar] 3d¹⁰ 4s² 4p⁶', melt:-157.36, boil:-153.22, density:0.00375, discovered:1898, desc:'Noble gas used in high-power lasers, flash photography, and some fluorescent lamps.' },
    // period 5
    { n:37, sym:'Rb', name:'Rubidium',       mass:85.468,   cat:'alkali-metal',   period:5, group:1,  config:'[Kr] 5s¹',      melt:39.31,   boil:688,     density:1.532,    discovered:1861, desc:'Very soft, silvery-white alkali metal. Used in atomic clocks and photoelectric cells.' },
    { n:38, sym:'Sr', name:'Strontium',      mass:87.62,    cat:'alkaline-earth', period:5, group:2,  config:'[Kr] 5s²',      melt:777,     boil:1382,    density:2.64,     discovered:1790, desc:'Alkaline earth metal. Used in fireworks (red colour), CRT screens, and bone cancer therapy.' },
    { n:39, sym:'Y',  name:'Yttrium',        mass:88.906,   cat:'transition',     period:5, group:3,  config:'[Kr] 4d¹ 5s²',  melt:1522,    boil:3345,    density:4.472,    discovered:1794, desc:'Rare transition metal. Used in LED phosphors, laser crystals, and superconductors.' },
    { n:40, sym:'Zr', name:'Zirconium',      mass:91.224,   cat:'transition',     period:5, group:4,  config:'[Kr] 4d² 5s²',  melt:1855,    boil:4409,    density:6.511,    discovered:1789, desc:'Corrosion-resistant metal used in nuclear reactors, ceramics, and dental prosthetics.' },
    { n:41, sym:'Nb', name:'Niobium',        mass:92.906,   cat:'transition',     period:5, group:5,  config:'[Kr] 4d⁴ 5s¹',  melt:2477,    boil:4744,    density:8.57,     discovered:1801, desc:'Superconducting metal used in MRI magnets, jet engines, and high-strength steel.' },
    { n:42, sym:'Mo', name:'Molybdenum',     mass:95.95,    cat:'transition',     period:5, group:6,  config:'[Kr] 4d⁵ 5s¹',  melt:2623,    boil:4639,    density:10.28,    discovered:1781, desc:'High-melting metal. Used in steel alloys, lubricants, and as an essential enzyme cofactor.' },
    { n:43, sym:'Tc', name:'Technetium',     mass:98,       cat:'transition',     period:5, group:7,  config:'[Kr] 4d⁵ 5s²',  melt:2157,    boil:4265,    density:11.5,     discovered:1937, desc:'First artificially produced element. Used extensively in nuclear medicine diagnostics.' },
    { n:44, sym:'Ru', name:'Ruthenium',      mass:101.07,   cat:'transition',     period:5, group:8,  config:'[Kr] 4d⁷ 5s¹',  melt:2334,    boil:4150,    density:12.37,    discovered:1844, desc:'Rare platinum-group metal. Used in electronics, solar cells, and catalysis.' },
    { n:45, sym:'Rh', name:'Rhodium',        mass:102.906,  cat:'transition',     period:5, group:9,  config:'[Kr] 4d⁸ 5s¹',  melt:1964,    boil:3695,    density:12.41,    discovered:1803, desc:'One of the rarest metals. Used in catalytic converters and jewellery plating.' },
    { n:46, sym:'Pd', name:'Palladium',      mass:106.42,   cat:'transition',     period:5, group:10, config:'[Kr] 4d¹⁰',     melt:1554.9,  boil:2963,    density:12.023,   discovered:1803, desc:'Used in catalytic converters, hydrogen purification, and jewellery (white gold).' },
    { n:47, sym:'Ag', name:'Silver',         mass:107.868,  cat:'transition',     period:5, group:11, config:'[Kr] 4d¹⁰ 5s¹', melt:961.78,  boil:2162,    density:10.49,    discovered:null, desc:'Best electrical conductor of all metals. Used in electronics, photography, and medicine.' },
    { n:48, sym:'Cd', name:'Cadmium',        mass:112.411,  cat:'transition',     period:5, group:12, config:'[Kr] 4d¹⁰ 5s²', melt:321.07,  boil:767,     density:8.65,     discovered:1817, desc:'Toxic metal used in NiCd batteries, solar cells, and as a neutron absorber in reactors.' },
    { n:49, sym:'In', name:'Indium',         mass:114.818,  cat:'post-transition',period:5, group:13, config:'[Kr] 4d¹⁰ 5s² 5p¹', melt:156.6, boil:2072, density:7.31,    discovered:1863, desc:'Soft metal that cries when bent. Used in LCD touchscreens (ITO) and semiconductors.' },
    { n:50, sym:'Sn', name:'Tin',            mass:118.71,   cat:'post-transition',period:5, group:14, config:'[Kr] 4d¹⁰ 5s² 5p²', melt:231.93, boil:2602, density:7.287,   discovered:null, desc:'Known since antiquity. Used in bronze, solder, tin cans, and organ pipes.' },
    { n:51, sym:'Sb', name:'Antimony',       mass:121.76,   cat:'metalloid',      period:5, group:15, config:'[Kr] 4d¹⁰ 5s² 5p³', melt:630.63, boil:1587, density:6.685,  discovered:null, desc:'Metalloid used in flame retardants, batteries, and historically in eye cosmetics.' },
    { n:52, sym:'Te', name:'Tellurium',      mass:127.6,    cat:'metalloid',      period:5, group:16, config:'[Kr] 4d¹⁰ 5s² 5p⁴', melt:449.51, boil:988,  density:6.232,   discovered:1782, desc:'Rare metalloid used in solar panels, thermoelectric devices, and alloys.' },
    { n:53, sym:'I',  name:'Iodine',         mass:126.904,  cat:'halogen',        period:5, group:17, config:'[Kr] 4d¹⁰ 5s² 5p⁵', melt:113.7,  boil:184.4,density:4.933,   discovered:1811, desc:'Essential trace element for thyroid hormones. Used as an antiseptic and in X-ray contrast.' },
    { n:54, sym:'Xe', name:'Xenon',          mass:131.293,  cat:'noble-gas',      period:5, group:18, config:'[Kr] 4d¹⁰ 5s² 5p⁶', melt:-111.7, boil:-108.1,density:0.00589, discovered:1898, desc:'Dense noble gas used in high-intensity lamps, ion thrusters, and anaesthesia.' },
    // period 6
    { n:55, sym:'Cs', name:'Caesium',        mass:132.905,  cat:'alkali-metal',   period:6, group:1,  config:'[Xe] 6s¹',      melt:28.44,   boil:671,     density:1.93,     discovered:1860, desc:'Softest metal. Used in atomic clocks (defines the SI second) and photoelectric cells.' },
    { n:56, sym:'Ba', name:'Barium',         mass:137.327,  cat:'alkaline-earth', period:6, group:2,  config:'[Xe] 6s²',      melt:727,     boil:1870,    density:3.51,     discovered:1808, desc:'Dense alkaline earth metal. Used in drilling fluids, medical imaging, and fireworks (green).' },
    { n:57, sym:'La', name:'Lanthanum',      mass:138.905,  cat:'lanthanide',     period:6, group:3,  config:'[Xe] 5d¹ 6s²',  melt:920,     boil:3464,    density:6.145,    discovered:1839, desc:'First lanthanide. Used in camera and telescope lenses, hydrogen storage, and catalysts.' },
    { n:58, sym:'Ce', name:'Cerium',         mass:140.116,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹ 5d¹ 6s²', melt:798, boil:3443, density:6.77,     discovered:1803, desc:'Most abundant rare earth element. Used in catalytic converters, glass polishing, and lighters.' },
    { n:59, sym:'Pr', name:'Praseodymium',   mass:140.908,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f³ 6s²', melt:931,     boil:3520,    density:6.773,    discovered:1885, desc:'Used in high-strength magnets, aircraft engines, and glass for welders and glassmakers.' },
    { n:60, sym:'Nd', name:'Neodymium',      mass:144.242,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f⁴ 6s²', melt:1021,    boil:3074,    density:7.007,    discovered:1885, desc:'Used in the world\'s strongest permanent magnets. Essential for EV motors and wind turbines.' },
    { n:61, sym:'Pm', name:'Promethium',     mass:145,      cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f⁵ 6s²', melt:1042,    boil:3000,    density:7.26,     discovered:1945, desc:'Radioactive lanthanide. No stable isotopes. Used in nuclear batteries and research.' },
    { n:62, sym:'Sm', name:'Samarium',       mass:150.36,   cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f⁶ 6s²', melt:1072,    boil:1794,    density:7.52,     discovered:1879, desc:'Used in SmCo permanent magnets and cancer treatment via samarium-153.' },
    { n:63, sym:'Eu', name:'Europium',       mass:151.964,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f⁷ 6s²', melt:826,     boil:1529,    density:5.243,    discovered:1901, desc:'Most reactive lanthanide. Used in red and blue phosphors in TV screens and euro banknotes.' },
    { n:64, sym:'Gd', name:'Gadolinium',     mass:157.25,   cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f⁷ 5d¹ 6s²', melt:1313, boil:3273, density:7.9,     discovered:1880, desc:'Used as MRI contrast agent, neutron absorber in reactors, and in phosphors.' },
    { n:65, sym:'Tb', name:'Terbium',        mass:158.925,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f⁹ 6s²', melt:1356,    boil:3230,    density:8.229,    discovered:1843, desc:'Used in green phosphors for LED lamps, magneto-optic data storage, and sonar systems.' },
    { n:66, sym:'Dy', name:'Dysprosium',     mass:162.5,    cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹⁰ 6s²',melt:1412,    boil:2567,    density:8.55,     discovered:1886, desc:'Critical for high-performance magnets in EV motors. Has the highest magnetic moment.' },
    { n:67, sym:'Ho', name:'Holmium',        mass:164.93,   cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹¹ 6s²',melt:1474,    boil:2700,    density:8.795,    discovered:1879, desc:'Strongest magnetic moment of any element. Used in magnetic pole pieces and lasers.' },
    { n:68, sym:'Er', name:'Erbium',         mass:167.259,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹² 6s²',melt:1497,    boil:2868,    density:9.066,    discovered:1843, desc:'Used in fibre optic amplifiers (EDFA) and pink colouring for glasses and cubic zirconia.' },
    { n:69, sym:'Tm', name:'Thulium',        mass:168.934,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹³ 6s²',melt:1545,    boil:1950,    density:9.321,    discovered:1879, desc:'Rarest stable lanthanide. Used in portable X-ray devices and blue-green laser sources.' },
    { n:70, sym:'Yb', name:'Ytterbium',      mass:173.045,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹⁴ 6s²',melt:819,     boil:1196,    density:6.965,    discovered:1878, desc:'Used in optical fibre amplifiers, atomic clocks, and stainless steel alloys.' },
    { n:71, sym:'Lu', name:'Lutetium',       mass:174.967,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹⁴ 5d¹ 6s²', melt:1663, boil:3402, density:9.84,   discovered:1907, desc:'Hardest and densest lanthanide. Used in PET scan detectors and cancer therapy.' },
    { n:72, sym:'Hf', name:'Hafnium',        mass:178.49,   cat:'transition',     period:6, group:4,  config:'[Xe] 4f¹⁴ 5d² 6s²', melt:2233, boil:4603, density:13.31,  discovered:1923, desc:'Used in nuclear control rods, microprocessor gate dielectrics, and plasma cutting tips.' },
    { n:73, sym:'Ta', name:'Tantalum',       mass:180.948,  cat:'transition',     period:6, group:5,  config:'[Xe] 4f¹⁴ 5d³ 6s²', melt:3017, boil:5458, density:16.69,  discovered:1802, desc:'Highly corrosion-resistant. Used in capacitors for phones, surgical implants, and jet engines.' },
    { n:74, sym:'W',  name:'Tungsten',       mass:183.84,   cat:'transition',     period:6, group:6,  config:'[Xe] 4f¹⁴ 5d⁴ 6s²', melt:3422, boil:5555, density:19.25,  discovered:1783, desc:'Highest melting point of all elements (3422°C). Used in light bulb filaments and armour.' },
    { n:75, sym:'Re', name:'Rhenium',        mass:186.207,  cat:'transition',     period:6, group:7,  config:'[Xe] 4f¹⁴ 5d⁵ 6s²', melt:3186, boil:5596, density:21.02,  discovered:1925, desc:'Second highest melting point. Used in superalloys for jet engines and filaments.' },
    { n:76, sym:'Os', name:'Osmium',         mass:190.23,   cat:'transition',     period:6, group:8,  config:'[Xe] 4f¹⁴ 5d⁶ 6s²', melt:3033, boil:5012, density:22.59,  discovered:1803, desc:'Densest naturally occurring element. Used in fountain pen nibs and electrical contacts.' },
    { n:77, sym:'Ir', name:'Iridium',        mass:192.217,  cat:'transition',     period:6, group:9,  config:'[Xe] 4f¹⁴ 5d⁷ 6s²', melt:2446, boil:4428, density:22.56,  discovered:1803, desc:'Most corrosion-resistant metal. Used in spark plugs, crucibles, and the K/Pg boundary layer.' },
    { n:78, sym:'Pt', name:'Platinum',       mass:195.084,  cat:'transition',     period:6, group:10, config:'[Xe] 4f¹⁴ 5d⁹ 6s¹', melt:1768.3, boil:3825, density:21.45, discovered:1735, desc:'Precious metal used in catalytic converters, jewellery, fuel cells, and cancer chemotherapy.' },
    { n:79, sym:'Au', name:'Gold',           mass:196.967,  cat:'transition',     period:6, group:11, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s¹', melt:1064.18, boil:2856, density:19.3, discovered:null, desc:'Noble metal prized since antiquity. Excellent conductor. Unreactive. Used in electronics.' },
    { n:80, sym:'Hg', name:'Mercury',        mass:200.592,  cat:'transition',     period:6, group:12, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s²', melt:-38.83, boil:356.73, density:13.534, discovered:null, desc:'Only liquid metal at room temperature. Toxic. Used in thermometers and fluorescent lamps.' },
    { n:81, sym:'Tl', name:'Thallium',       mass:204.38,   cat:'post-transition',period:6, group:13, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p¹', melt:304, boil:1473, density:11.85, discovered:1861, desc:'Highly toxic soft metal. Used in electronics, infrared detectors, and historically as poison.' },
    { n:82, sym:'Pb', name:'Lead',           mass:207.2,    cat:'post-transition',period:6, group:14, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p²', melt:327.46, boil:1749, density:11.34, discovered:null, desc:'Dense, toxic metal. Historically used in pipes and paint. Still used in batteries and shielding.' },
    { n:83, sym:'Bi', name:'Bismuth',        mass:208.98,   cat:'post-transition',period:6, group:15, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p³', melt:271.3, boil:1564, density:9.787, discovered:null, desc:'Pink-tinted heavy metal. Used in cosmetics, pharmaceuticals (Pepto-Bismol), and alloys.' },
    { n:84, sym:'Po', name:'Polonium',       mass:209,      cat:'post-transition',period:6, group:16, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁴', melt:254,   boil:962,  density:9.196, discovered:1898, desc:'Highly radioactive metalloid discovered by Marie Curie. Used in anti-static devices.' },
    { n:85, sym:'At', name:'Astatine',       mass:210,      cat:'halogen',        period:6, group:17, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁵', melt:302,   boil:337,  density:7,     discovered:1940, desc:'Rarest naturally occurring element. Radioactive halogen investigated for cancer therapy.' },
    { n:86, sym:'Rn', name:'Radon',          mass:222,      cat:'noble-gas',      period:6, group:18, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁶', melt:-71,   boil:-61.7,density:0.00973, discovered:1900, desc:'Radioactive noble gas produced by uranium decay. Second leading cause of lung cancer.' },
    // period 7
    { n:87, sym:'Fr', name:'Francium',       mass:223,      cat:'alkali-metal',   period:7, group:1,  config:'[Rn] 7s¹',      melt:27,      boil:677,     density:1.87,     discovered:1939, desc:'Most unstable of the naturally occurring elements. Extremely rare and radioactive.' },
    { n:88, sym:'Ra', name:'Radium',         mass:226,      cat:'alkaline-earth', period:7, group:2,  config:'[Rn] 7s²',      melt:700,     boil:1737,    density:5.5,      discovered:1898, desc:'Discovered by Marie Curie. Highly radioactive. Historical use in luminescent watch dials.' },
    { n:89, sym:'Ac', name:'Actinium',       mass:227,      cat:'actinide',       period:7, group:3,  config:'[Rn] 6d¹ 7s²',  melt:1050,    boil:3200,    density:10.07,    discovered:1899, desc:'First actinide. Intensely radioactive. Used in neutron sources and cancer research.' },
    { n:90, sym:'Th', name:'Thorium',        mass:232.038,  cat:'actinide',       period:7, group:null,config:'[Rn] 6d² 7s²', melt:1750,    boil:4788,    density:11.72,    discovered:1829, desc:'Radioactive metal investigated as nuclear fuel. More abundant than uranium.' },
    { n:91, sym:'Pa', name:'Protactinium',   mass:231.036,  cat:'actinide',       period:7, group:null,config:'[Rn] 5f² 6d¹ 7s²', melt:1572, boil:4000, density:15.37,   discovered:1913, desc:'Rare, toxic, and radioactive. An intermediate in uranium decay chains.' },
    { n:92, sym:'U',  name:'Uranium',        mass:238.029,  cat:'actinide',       period:7, group:null,config:'[Rn] 5f³ 6d¹ 7s²', melt:1135, boil:4131, density:19.1,    discovered:1789, desc:'Used as nuclear fuel in power plants. Basis of both nuclear power and atomic weapons.' },
    { n:93, sym:'Np', name:'Neptunium',      mass:237,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f⁴ 6d¹ 7s²', melt:639,  boil:4000, density:20.45,   discovered:1940, desc:'First transuranic element. Produced in nuclear reactors as a by-product of plutonium production.' },
    { n:94, sym:'Pu', name:'Plutonium',      mass:244,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f⁶ 7s²', melt:640,     boil:3228,    density:19.816,   discovered:1940, desc:'Key fissile material in nuclear weapons and some reactors. Highly toxic and radioactive.' },
    { n:95, sym:'Am', name:'Americium',      mass:243,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f⁷ 7s²', melt:1176,    boil:2607,    density:13.67,    discovered:1944, desc:'Found in smoke detectors. Produced in nuclear reactors from plutonium-239.' },
    { n:96, sym:'Cm', name:'Curium',         mass:247,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f⁷ 6d¹ 7s²', melt:1345, boil:3110, density:13.51,   discovered:1944, desc:'Named after Marie and Pierre Curie. Used as a power source in spacecraft.' },
    { n:97, sym:'Bk', name:'Berkelium',      mass:247,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f⁹ 7s²', melt:986,     boil:null,    density:14.78,    discovered:1949, desc:'Synthetic radioactive element used only in research. Produced in nuclear reactors.' },
    { n:98, sym:'Cf', name:'Californium',    mass:251,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f¹⁰ 7s²',melt:900,     boil:null,    density:15.1,     discovered:1950, desc:'Strong neutron emitter. Used for starting nuclear reactors and treating certain cancers.' },
    { n:99, sym:'Es', name:'Einsteinium',    mass:252,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f¹¹ 7s²',melt:860,     boil:null,    density:8.84,     discovered:1952, desc:'Named after Einstein. First identified in the fallout of the first hydrogen bomb test.' },
    { n:100,sym:'Fm', name:'Fermium',        mass:257,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f¹² 7s²',melt:1527,    boil:null,    density:null,     discovered:1952, desc:'Named after Fermi. Heaviest element that can be produced by neutron bombardment.' },
    { n:101,sym:'Md', name:'Mendelevium',    mass:258,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f¹³ 7s²',melt:827,     boil:null,    density:null,     discovered:1955, desc:'Named after Mendeleev. Produced in tiny amounts by bombarding einsteinium with alpha particles.' },
    { n:102,sym:'No', name:'Nobelium',       mass:259,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f¹⁴ 7s²',melt:827,     boil:null,    density:null,     discovered:1966, desc:'Named after Nobel. Highly unstable synthetic element with no known uses outside research.' },
    { n:103,sym:'Lr', name:'Lawrencium',     mass:262,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f¹⁴ 7s² 7p¹', melt:1627, boil:null, density:null,    discovered:1961, desc:'Last actinide. Named after cyclotron inventor Ernest Lawrence. Extremely short-lived.' },
    { n:104,sym:'Rf', name:'Rutherfordium',  mass:267,      cat:'transition',     period:7, group:4,  config:'[Rn] 5f¹⁴ 6d² 7s²', melt:2100, boil:5500, density:23.2,   discovered:1964, desc:'First transactinide. Named after Rutherford. Has a half-life of only about 65 seconds.' },
    { n:105,sym:'Db', name:'Dubnium',        mass:268,      cat:'transition',     period:7, group:5,  config:'[Rn] 5f¹⁴ 6d³ 7s²', melt:null,  boil:null, density:29.3,   discovered:1968, desc:'Named after Dubna, Russia. Highly unstable synthetic element with no known uses.' },
    { n:106,sym:'Sg', name:'Seaborgium',     mass:271,      cat:'transition',     period:7, group:6,  config:'[Rn] 5f¹⁴ 6d⁴ 7s²', melt:null,  boil:null, density:35.0,   discovered:1974, desc:'Named after Glenn Seaborg. Decays in seconds. Studied only through nuclear reactions.' },
    { n:107,sym:'Bh', name:'Bohrium',        mass:272,      cat:'transition',     period:7, group:7,  config:'[Rn] 5f¹⁴ 6d⁵ 7s²', melt:null,  boil:null, density:37.1,   discovered:1981, desc:'Named after Niels Bohr. Extremely short-lived with no known applications.' },
    { n:108,sym:'Hs', name:'Hassium',        mass:277,      cat:'transition',     period:7, group:8,  config:'[Rn] 5f¹⁴ 6d⁶ 7s²', melt:null,  boil:null, density:40.7,   discovered:1984, desc:'Named after the German state of Hesse. Has a half-life of about 9.7 seconds.' },
    { n:109,sym:'Mt', name:'Meitnerium',     mass:278,      cat:'transition',     period:7, group:9,  config:'[Rn] 5f¹⁴ 6d⁷ 7s²', melt:null,  boil:null, density:37.4,   discovered:1982, desc:'Named after Lise Meitner, a pioneer of nuclear fission. Properties largely unknown.' },
    { n:110,sym:'Ds', name:'Darmstadtium',   mass:281,      cat:'transition',     period:7, group:10, config:'[Rn] 5f¹⁴ 6d⁸ 7s²', melt:null,  boil:null, density:34.8,   discovered:1994, desc:'Named after Darmstadt, Germany. Extremely unstable with a half-life of about 10 seconds.' },
    { n:111,sym:'Rg', name:'Roentgenium',    mass:282,      cat:'transition',     period:7, group:11, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s¹', melt:null, boil:null, density:28.7,  discovered:1994, desc:'Named after Wilhelm Röntgen (discoverer of X-rays). Decays within milliseconds.' },
    { n:112,sym:'Cn', name:'Copernicium',    mass:285,      cat:'transition',     period:7, group:12, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s²', melt:null, boil:null, density:23.7,  discovered:1996, desc:'Named after Copernicus. May be gaseous at room temperature. Half-life of ~29 seconds.' },
    { n:113,sym:'Nh', name:'Nihonium',       mass:286,      cat:'post-transition',period:7, group:13, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p¹', melt:null, boil:null, density:16.0, discovered:2004, desc:'First element discovered in Asia (Japan). Half-life of about 20 seconds.' },
    { n:114,sym:'Fl', name:'Flerovium',      mass:289,      cat:'post-transition',period:7, group:14, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p²', melt:null, boil:null, density:14.0, discovered:1998, desc:'Named after Flerov Laboratory in Russia. Likely a gas at room temperature.' },
    { n:115,sym:'Mc', name:'Moscovium',      mass:290,      cat:'post-transition',period:7, group:15, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p³', melt:null, boil:null, density:13.5, discovered:2003, desc:'Named after Moscow Oblast. Properties largely theoretical due to extreme instability.' },
    { n:116,sym:'Lv', name:'Livermorium',    mass:293,      cat:'post-transition',period:7, group:16, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁴', melt:null, boil:null, density:12.9, discovered:2000, desc:'Named after Lawrence Livermore National Laboratory. Half-life of about 61 milliseconds.' },
    { n:117,sym:'Ts', name:'Tennessine',     mass:294,      cat:'halogen',        period:7, group:17, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁵', melt:null, boil:null, density:7.17, discovered:2010, desc:'Named after Tennessee. Second heaviest element ever observed.' },
    { n:118,sym:'Og', name:'Oganesson',      mass:294,      cat:'noble-gas',      period:7, group:18, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁶', melt:null, boil:null, density:4.95, discovered:2006, desc:'Heaviest known element. Named after Yuri Oganessian. May not behave like a noble gas.' },
  ];

  /* ══════════════════════════════════════════════════
     CATEGORY COLOURS (mapped to CSS vars)
  ══════════════════════════════════════════════════ */

  const CAT_COLORS = {
    'alkali-metal':   { bg: '#fef3c7', text: '#92400e', dark_bg: '#451a03', dark_text: '#fcd34d', label: 'Alkali Metal' },
    'alkaline-earth': { bg: '#fef9c3', text: '#713f12', dark_bg: '#422006', dark_text: '#fde68a', label: 'Alkaline Earth' },
    'transition':     { bg: '#dbeafe', text: '#1e3a8a', dark_bg: '#1e3a8a', dark_text: '#93c5fd', label: 'Transition Metal' },
    'post-transition':{ bg: '#e0e7ff', text: '#3730a3', dark_bg: '#312e81', dark_text: '#a5b4fc', label: 'Post-transition' },
    'metalloid':      { bg: '#d1fae5', text: '#065f46', dark_bg: '#064e3b', dark_text: '#6ee7b7', label: 'Metalloid' },
    'nonmetal':       { bg: '#dcfce7', text: '#14532d', dark_bg: '#14532d', dark_text: '#86efac', label: 'Nonmetal' },
    'halogen':        { bg: '#f0fdf4', text: '#166534', dark_bg: '#052e16', dark_text: '#4ade80', label: 'Halogen' },
    'noble-gas':      { bg: '#fae8ff', text: '#6b21a8', dark_bg: '#3b0764', dark_text: '#e879f9', label: 'Noble Gas' },
    'lanthanide':     { bg: '#ffedd5', text: '#9a3412', dark_bg: '#431407', dark_text: '#fdba74', label: 'Lanthanide' },
    'actinide':       { bg: '#ffe4e6', text: '#9f1239', dark_bg: '#4c0519', dark_text: '#fda4af', label: 'Actinide' },
  };

  /* ══════════════════════════════════════════════════
     PERIODIC TABLE LAYOUT
     Standard layout: row = period, position = group
     Lanthanides/Actinides: separate rows at bottom
  ══════════════════════════════════════════════════ */

  // Standard table layout:  [atomicNumber, row, col]  (1-indexed)
  // row 1-7 = periods, row 9 = lanthanides, row 10 = actinides
  // col 1-18 = groups

  function _getPosition(el) {
    if (el.cat === 'lanthanide') {
      // La-Lu: n 57-71, cols 3-17 in row 9
      return { row: 9, col: 3 + (el.n - 57) };
    }
    if (el.cat === 'actinide' && el.n >= 90) {
      // Th-Lr: n 90-103, row 10
      return { row: 10, col: 3 + (el.n - 90) };
    }
    if (el.n === 57) return { row: 6, col: 3 };  // La placeholder in main table
    if (el.n === 89) return { row: 7, col: 3 };  // Ac placeholder

    // All others: use period + group
    const grp = el.group;
    if (!grp) return null;
    return { row: el.period, col: grp };
  }

  /* ══════════════════════════════════════════════════
     MODULE STATE
  ══════════════════════════════════════════════════ */

  let _onBack         = null;
  let _selectedEl     = null;
  let _filterCat      = null;
  let _searchQuery    = '';

  // 3D rotation state
  let _rotX    = -8;    // pitch (deg) — slight tilt toward viewer
  let _rotY    = 0;     // yaw (deg)
  let _scale   = 1;
  let _isDragging     = false;
  let _lastX          = 0;
  let _lastY          = 0;
  let _lastTouchDist  = 0;
  let _velocity       = { x: 0, y: 0 };
  let _rafId          = null;
  let _animFrame      = null;

  const MIN_SCALE = 0.45;
  const MAX_SCALE = 2.5;

  /* ══════════════════════════════════════════════════
     OPEN — entry point
  ══════════════════════════════════════════════════ */

  function open(onBackCallback) {
    _onBack      = onBackCallback || null;
    _selectedEl  = null;
    _filterCat   = null;
    _searchQuery = '';
    _rotX        = -8;
    _rotY        = 0;
    _scale       = 1;
    _velocity    = { x: 0, y: 0 };

    _render();
    _bindEvents();
    _startInertia();
  }

  /* ══════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════ */

  function _render() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    UI.mount(`
      <div id="pt-shell" style="
        display:flex;flex-direction:column;height:100dvh;
        background:var(--bg-page);overflow:hidden;
        font-family:var(--font);user-select:none;
        -webkit-user-select:none;
      ">

        ${_buildTopBar()}

        <!-- Legend & filters row -->
        <div id="pt-filters" style="
          flex-shrink:0;display:flex;align-items:center;gap:.5rem;
          padding:.375rem .875rem;border-bottom:1px solid var(--border);
          overflow-x:auto;-webkit-overflow-scrolling:touch;
          scrollbar-width:none;
        ">
          <button onclick="ThreeDPeriodic._setFilter(null)"
                  id="pt-filter-all"
                  style="flex-shrink:0;font-size:.625rem;font-weight:700;letter-spacing:.05em;
                         text-transform:uppercase;padding:3px 9px;border-radius:99px;
                         border:1px solid var(--border);background:var(--accent);
                         color:#fff;cursor:pointer;white-space:nowrap;font-family:var(--font);">
            All
          </button>
          ${Object.entries(CAT_COLORS).map(([cat, c]) => `
            <button onclick="ThreeDPeriodic._setFilter('${cat}')"
                    id="pt-filter-${cat}"
                    style="flex-shrink:0;font-size:.625rem;font-weight:700;letter-spacing:.04em;
                           text-transform:uppercase;padding:3px 9px;border-radius:99px;
                           border:1px solid var(--border);
                           background:var(--bg-subtle);color:var(--text-3);
                           cursor:pointer;white-space:nowrap;font-family:var(--font);
                           transition:background var(--t-fast),color var(--t-fast);"
                    data-cat="${cat}">
              ${c.label}
            </button>`).join('')}
        </div>

        <!-- 3D stage -->
        <div id="pt-stage" style="
          flex:1 1 0;overflow:hidden;position:relative;
          cursor:grab;touch-action:none;
          display:flex;align-items:center;justify-content:center;
        ">

          <!-- Hint -->
          <div id="pt-hint" style="
            position:absolute;bottom:.75rem;left:50%;transform:translateX(-50%);
            font-size:.625rem;font-weight:500;letter-spacing:.05em;
            color:var(--text-4);text-transform:uppercase;pointer-events:none;
            white-space:nowrap;z-index:5;
            animation:pt-hint-fade 3s ease 1.5s forwards;
          ">
            Drag to rotate · Pinch to zoom · Tap element
          </div>

          <!-- Table wrapper — 3D perspective container -->
          <div id="pt-perspective" style="
            perspective:1800px;perspective-origin:50% 50%;
            width:100%;height:100%;display:flex;
            align-items:center;justify-content:center;
          ">
            <div id="pt-table-3d" style="
              transform-style:preserve-3d;
              transform:rotateX(${_rotX}deg) rotateY(${_rotY}deg) scale(${_scale});
              transition:none;
              position:relative;
            ">
              ${_buildTable()}
            </div>
          </div>

          <!-- Zoom controls -->
          <div style="
            position:absolute;right:.75rem;top:50%;transform:translateY(-50%);
            display:flex;flex-direction:column;gap:.375rem;z-index:10;
          ">
            <button onclick="ThreeDPeriodic._zoom(0.15)"
                    style="width:32px;height:32px;border-radius:var(--r-md);
                           background:var(--glass-bg);border:1px solid var(--border);
                           font-size:1.1rem;cursor:pointer;display:flex;align-items:center;
                           justify-content:center;color:var(--text-2);
                           backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
                           font-family:var(--font);">+</button>
            <button onclick="ThreeDPeriodic._zoom(-0.15)"
                    style="width:32px;height:32px;border-radius:var(--r-md);
                           background:var(--glass-bg);border:1px solid var(--border);
                           font-size:1.1rem;cursor:pointer;display:flex;align-items:center;
                           justify-content:center;color:var(--text-2);
                           backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
                           font-family:var(--font);">−</button>
            <button onclick="ThreeDPeriodic._resetView()"
                    style="width:32px;height:32px;border-radius:var(--r-md);
                           background:var(--glass-bg);border:1px solid var(--border);
                           font-size:.65rem;cursor:pointer;display:flex;align-items:center;
                           justify-content:center;color:var(--text-3);
                           backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
                           font-family:var(--font);font-weight:700;">⟳</button>
          </div>
        </div>

        <!-- Element detail panel (slides up on selection) -->
        <div id="pt-detail" style="
          flex-shrink:0;max-height:0;overflow:hidden;
          transition:max-height .35s cubic-bezier(0.16,1,0.3,1);
          background:var(--bg-base);border-top:1px solid var(--border);
          position:relative;z-index:20;
        ">
          <div id="pt-detail-inner" style="padding:.875rem 1rem 1.25rem;"></div>
        </div>

      </div>

      <style>
        @keyframes pt-hint-fade {
          0%   { opacity:1; }
          80%  { opacity:1; }
          100% { opacity:0; pointer-events:none; }
        }
        #pt-filters::-webkit-scrollbar { display:none; }
        .pt-cell {
          box-sizing:border-box;
          transition:filter .12s ease, transform .12s ease;
          will-change:filter,transform;
        }
        .pt-cell:active { transform:scale(0.92) !important; }
        .pt-cell.is-dimmed { filter:opacity(0.2) grayscale(0.8); }
        .pt-cell.is-highlighted { filter:brightness(1.08) !important; }
      </style>`);
  }

  /* ── Top bar ── */
  function _buildTopBar() {
    return `
      <div style="
        display:flex;align-items:center;gap:.5rem;
        padding:.5rem .875rem;border-bottom:1px solid var(--border);
        background:var(--bg-base);flex-shrink:0;min-height:3rem;
      ">
        <button onclick="ThreeDPeriodic._back()"
                style="display:inline-flex;align-items:center;gap:.375rem;
                       font-size:var(--text-sm);font-weight:500;color:var(--text-2);
                       background:var(--bg-subtle);border:1px solid var(--border);
                       border-radius:var(--r-md);padding:.3rem .625rem;
                       cursor:pointer;white-space:nowrap;font-family:var(--font);flex-shrink:0;">
          ← Back
        </button>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--text-base);font-weight:700;color:var(--text-1);
                      letter-spacing:-0.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ⚗️ Periodic Table
          </div>
          <div style="font-size:.625rem;color:var(--text-4);letter-spacing:.03em;margin-top:1px;">
            118 ELEMENTS · TAP TO EXPLORE
          </div>
        </div>
        <!-- Search -->
        <div style="position:relative;flex-shrink:0;">
          <input id="pt-search" type="text" placeholder="Search…"
                 oninput="ThreeDPeriodic._onSearch(this.value)"
                 style="width:110px;padding:.3125rem .5rem .3125rem 1.75rem;
                        font-size:var(--text-xs);border-radius:var(--r-md);
                        border:1px solid var(--border);background:var(--bg-subtle);
                        color:var(--text-1);font-family:var(--font);
                        transition:width var(--t-base);outline:none;" />
          <svg style="position:absolute;left:.5rem;top:50%;transform:translateY(-50%);
                      pointer-events:none;color:var(--text-4);"
               width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
      </div>`;
  }

  /* ── Build the periodic table HTML grid ── */
  function _buildTable() {
    const CELL_W = 40;   // px per cell (desktop-ish)
    const CELL_H = 42;
    const GAP    = 2;
    const COLS   = 18;

    // Map elements to grid positions
    const grid = {};  // key: "row,col" -> element

    ELEMENTS.forEach(el => {
      const pos = _getPosition(el);
      if (!pos) return;
      grid[`${pos.row},${pos.col}`] = el;
    });

    // Determine dimensions
    const maxRow = 10;
    const maxCol = 18;

    const tableW = maxCol * (CELL_W + GAP);
    const tableH = (maxRow + 1) * (CELL_H + GAP); // +1 for lanthanide/actinide gap row

    let html = `<div style="
      position:relative;
      width:${tableW}px;
      height:${tableH + 30}px;
    ">`;

    // Row labels
    for (let r = 1; r <= 7; r++) {
      html += `<div style="
        position:absolute;
        left:-18px;top:${(r - 1) * (CELL_H + GAP) + CELL_H / 2}px;
        transform:translateY(-50%);
        font-size:9px;font-weight:700;color:var(--text-4);
        width:14px;text-align:right;line-height:1;
      ">${r}</div>`;
    }

    // Lanthanide/actinide separator marker
    html += `<div style="
      position:absolute;
      left:${2 * (CELL_W + GAP)}px;
      top:${7.5 * (CELL_H + GAP)}px;
      width:${CELL_W}px;height:${CELL_H}px;
      display:flex;align-items:center;justify-content:center;
      font-size:7px;color:var(--text-4);font-weight:700;
      border:1px dashed var(--border);border-radius:3px;
      box-sizing:border-box;
    ">*</div>`;

    // Render all cells
    for (let r = 1; r <= 10; r++) {
      for (let c = 1; c <= maxCol; c++) {
        const el = grid[`${r},${c}`];

        // Calculate pixel position (offset row 9,10 down by half a row for separation)
        const yOffset = r >= 9 ? (CELL_H + GAP) * 0.6 : 0;
        const px = (c - 1) * (CELL_W + GAP);
        const py = (r - 1) * (CELL_H + GAP) + yOffset;

        if (el) {
          const colors = CAT_COLORS[el.cat] || CAT_COLORS['transition'];
          html += _buildCell(el, px, py, CELL_W, CELL_H, colors);
        }
      }
    }

    // Group number labels (top)
    const groupLabels = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18];
    groupLabels.forEach(g => {
      const px = (g - 1) * (CELL_W + GAP);
      html += `<div style="
        position:absolute;
        left:${px}px;top:-16px;
        width:${CELL_W}px;height:14px;
        display:flex;align-items:center;justify-content:center;
        font-size:8px;font-weight:700;color:var(--text-4);line-height:1;
      ">${g}</div>`;
    });

    // Section labels for lanthanides/actinides
    html += `<div style="
      position:absolute;
      left:-2px;top:${8 * (CELL_H + GAP) + (CELL_H + GAP) * 0.6}px;
      font-size:7px;font-weight:700;color:var(--text-4);
      writing-mode:horizontal-tb;line-height:1.3;
      width:${2 * (CELL_W + GAP) - GAP}px;text-align:right;
    ">Lanthanides</div>`;

    html += `<div style="
      position:absolute;
      left:-2px;top:${9 * (CELL_H + GAP) + (CELL_H + GAP) * 0.6}px;
      font-size:7px;font-weight:700;color:var(--text-4);
      writing-mode:horizontal-tb;line-height:1.3;
      width:${2 * (CELL_W + GAP) - GAP}px;text-align:right;
    ">Actinides</div>`;

    html += '</div>';
    return html;
  }

  /* ── Build a single element cell ── */
  function _buildCell(el, px, py, w, h, colors) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const bg     = isDark ? colors.dark_bg   : colors.bg;
    const fg     = isDark ? colors.dark_text : colors.text;

    // Z-depth: vary by atomic number for subtle 3D layering (cosmetic, not functional)
    const zDepth = Math.sin(el.n * 0.15) * 3;

    return `
      <div class="pt-cell" id="pt-cell-${el.n}"
           data-n="${el.n}" data-cat="${el.cat}"
           onclick="ThreeDPeriodic._selectElement(${el.n})"
           style="
             position:absolute;
             left:${px}px;top:${py}px;
             width:${w}px;height:${h}px;
             background:${bg};
             color:${fg};
             border-radius:4px;
             border:1px solid rgba(0,0,0,${isDark ? '0.3' : '0.08'});
             display:flex;flex-direction:column;
             align-items:center;justify-content:center;
             gap:0;
             cursor:pointer;
             box-shadow:${isDark
               ? '0 1px 3px rgba(0,0,0,0.4)'
               : '0 1px 2px rgba(0,0,0,0.08)'};
             transform:translateZ(${zDepth}px);
             box-sizing:border-box;
             overflow:hidden;
             -webkit-tap-highlight-color:transparent;
           ">
        <div style="font-size:7.5px;font-weight:700;color:${fg};opacity:0.7;line-height:1;margin-top:2px;">
          ${el.n}
        </div>
        <div style="font-size:13px;font-weight:800;color:${fg};line-height:1.1;letter-spacing:-0.02em;">
          ${el.sym}
        </div>
        <div style="font-size:5.5px;font-weight:600;color:${fg};opacity:0.8;
                    line-height:1;text-align:center;padding:0 2px;
                    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">
          ${el.name.length > 9 ? el.name.slice(0, 8) + '.' : el.name}
        </div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════
     BIND EVENTS — mouse, touch, keyboard
  ══════════════════════════════════════════════════ */

  function _bindEvents() {
    const stage = document.getElementById('pt-stage');
    if (!stage) return;

    // Mouse drag
    stage.addEventListener('mousedown', _onMouseDown, { passive: false });
    window.addEventListener('mousemove', _onMouseMove, { passive: true });
    window.addEventListener('mouseup',   _onMouseUp,   { passive: true });

    // Touch
    stage.addEventListener('touchstart', _onTouchStart, { passive: false });
    stage.addEventListener('touchmove',  _onTouchMove,  { passive: false });
    stage.addEventListener('touchend',   _onTouchEnd,   { passive: true });

    // Mouse wheel zoom
    stage.addEventListener('wheel', _onWheel, { passive: false });

    // Keyboard navigation
    window.addEventListener('keydown', _onKeyDown);
  }

  function _unbindEvents() {
    window.removeEventListener('mousemove', _onMouseMove);
    window.removeEventListener('mouseup',   _onMouseUp);
    window.removeEventListener('keydown',   _onKeyDown);
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
  }

  /* ── Mouse handlers ── */

  function _onMouseDown(e) {
    if (e.target.closest('.pt-cell') || e.target.closest('button') || e.target.closest('input')) return;
    _isDragging = true;
    _lastX = e.clientX;
    _lastY = e.clientY;
    _velocity = { x: 0, y: 0 };
    const stage = document.getElementById('pt-stage');
    if (stage) stage.style.cursor = 'grabbing';
    e.preventDefault();
  }

  function _onMouseMove(e) {
    if (!_isDragging) return;
    const dx = e.clientX - _lastX;
    const dy = e.clientY - _lastY;
    _velocity = { x: dx * 0.4, y: dy * 0.4 };
    _rotY += dx * 0.35;
    _rotX += dy * 0.25;
    _rotX = Math.max(-40, Math.min(40, _rotX));
    _lastX = e.clientX;
    _lastY = e.clientY;
    _applyTransform();
  }

  function _onMouseUp() {
    if (!_isDragging) return;
    _isDragging = false;
    const stage = document.getElementById('pt-stage');
    if (stage) stage.style.cursor = 'grab';
    _startInertia();
  }

  /* ── Touch handlers ── */

  function _onTouchStart(e) {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      if (t.target.closest('.pt-cell') || t.target.closest('button') || t.target.closest('input')) return;
      _isDragging = true;
      _lastX = t.clientX;
      _lastY = t.clientY;
      _velocity = { x: 0, y: 0 };
      e.preventDefault();
    } else if (e.touches.length === 2) {
      _isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      _lastTouchDist = Math.hypot(dx, dy);
      e.preventDefault();
    }
  }

  function _onTouchMove(e) {
    if (e.touches.length === 1 && _isDragging) {
      const t = e.touches[0];
      const dx = t.clientX - _lastX;
      const dy = t.clientY - _lastY;
      _velocity = { x: dx * 0.4, y: dy * 0.4 };
      _rotY += dx * 0.35;
      _rotX += dy * 0.25;
      _rotX = Math.max(-40, Math.min(40, _rotX));
      _lastX = t.clientX;
      _lastY = t.clientY;
      _applyTransform();
      e.preventDefault();
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = (dist - _lastTouchDist) * 0.004;
      _scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, _scale + delta));
      _lastTouchDist = dist;
      _applyTransform();
      e.preventDefault();
    }
  }

  function _onTouchEnd() {
    _isDragging = false;
    _startInertia();
  }

  /* ── Wheel zoom ── */

  function _onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    _scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, _scale + delta));
    _applyTransform();
  }

  /* ── Keyboard nav ── */

  function _onKeyDown(e) {
    if (e.target.tagName === 'INPUT') return;
    if (!document.getElementById('pt-shell')) return;

    if (e.key === 'ArrowLeft')  { _rotY -= 8; _applyTransform(); }
    if (e.key === 'ArrowRight') { _rotY += 8; _applyTransform(); }
    if (e.key === 'ArrowUp')    { _rotX -= 5; _rotX = Math.max(-40, _rotX); _applyTransform(); }
    if (e.key === 'ArrowDown')  { _rotX += 5; _rotX = Math.min(40,  _rotX); _applyTransform(); }
    if (e.key === '+' || e.key === '=') _zoom(0.1);
    if (e.key === '-')                  _zoom(-0.1);
    if (e.key === 'r' || e.key === 'R') _resetView();
    if (e.key === 'Escape') {
      if (_selectedEl) _deselectElement();
      else _back();
    }
  }

  /* ══════════════════════════════════════════════════
     APPLY 3D TRANSFORM
  ══════════════════════════════════════════════════ */

  function _applyTransform(animated) {
    const el = document.getElementById('pt-table-3d');
    if (!el) return;
    el.style.transition = animated ? 'transform .4s cubic-bezier(0.16,1,0.3,1)' : 'none';
    el.style.transform = `rotateX(${_rotX}deg) rotateY(${_rotY}deg) scale(${_scale})`;
  }

  /* ── Inertia (momentum scrolling after drag ends) ── */

  function _startInertia() {
    if (_rafId) cancelAnimationFrame(_rafId);
    const decay = 0.92;

    function tick() {
      if (Math.abs(_velocity.x) < 0.05 && Math.abs(_velocity.y) < 0.05) {
        _velocity = { x: 0, y: 0 };
        return;
      }
      _rotY += _velocity.x * 0.35;
      _rotX += _velocity.y * 0.25;
      _rotX = Math.max(-40, Math.min(40, _rotX));
      _velocity.x *= decay;
      _velocity.y *= decay;
      _applyTransform();
      _rafId = requestAnimationFrame(tick);
    }

    _rafId = requestAnimationFrame(tick);
  }

  /* ══════════════════════════════════════════════════
     ELEMENT SELECTION
  ══════════════════════════════════════════════════ */

  function _selectElement(n) {
    const el = ELEMENTS.find(e => e.n === n);
    if (!el) return;

    _selectedEl = el;

    // Highlight selected, dim others
    document.querySelectorAll('.pt-cell').forEach(cell => {
      const cellN = parseInt(cell.dataset.n, 10);
      cell.classList.toggle('is-dimmed', cellN !== n);
      cell.classList.toggle('is-highlighted', cellN === n);
    });

    // Animate selected cell a bit
    const cellEl = document.getElementById(`pt-cell-${n}`);
    if (cellEl) {
      cellEl.style.transform = `translateZ(12px) scale(1.08)`;
      cellEl.style.boxShadow = '0 8px 24px rgba(79,110,247,0.35)';
      cellEl.style.border    = '2px solid var(--accent)';
    }

    _showDetailPanel(el);
  }

  function _deselectElement() {
    _selectedEl = null;

    document.querySelectorAll('.pt-cell').forEach(cell => {
      const n = parseInt(cell.dataset.n, 10);
      const el = ELEMENTS.find(e => e.n === n);
      if (!el) return;
      const zDepth = Math.sin(n * 0.15) * 3;
      cell.classList.remove('is-dimmed', 'is-highlighted');
      cell.style.transform = `translateZ(${zDepth}px)`;
      cell.style.boxShadow = '';
      cell.style.border    = '';
    });

    const panel = document.getElementById('pt-detail');
    if (panel) panel.style.maxHeight = '0';
  }

  /* ── Detail panel ── */

  function _showDetailPanel(el) {
    const panel  = document.getElementById('pt-detail');
    const inner  = document.getElementById('pt-detail-inner');
    if (!panel || !inner) return;

    const colors = CAT_COLORS[el.cat] || CAT_COLORS['transition'];
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const bg     = isDark ? colors.dark_bg   : colors.bg;
    const fg     = isDark ? colors.dark_text : colors.text;

    const fmt = v => (v === null || v === undefined) ? '—' : v;
    const fmtTemp = v => v === null ? '—' : v + ' °C';
    const fmtYear = v => v === null ? 'Ancient' : v;

    inner.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:.875rem;margin-bottom:.75rem;">

        <!-- Big symbol -->
        <div style="
          width:56px;height:56px;border-radius:8px;flex-shrink:0;
          background:${bg};border:2px solid ${fg};
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          box-shadow:var(--shadow-sm);
        ">
          <div style="font-size:9px;font-weight:700;color:${fg};opacity:0.8;line-height:1;">${el.n}</div>
          <div style="font-size:22px;font-weight:800;color:${fg};line-height:1.1;">${el.sym}</div>
        </div>

        <!-- Name & category -->
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:3px;">
            <h2 style="font-size:var(--text-md);font-weight:800;color:var(--text-1);
                       margin:0;letter-spacing:-0.02em;">${el.name}</h2>
            <span style="font-size:.625rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
                         padding:2px 8px;border-radius:99px;background:${bg};color:${fg};flex-shrink:0;">
              ${colors.label}
            </span>
          </div>
          <div style="font-size:var(--text-xs);color:var(--text-3);">
            Atomic mass: <strong style="color:var(--text-1);">${el.mass}</strong> u
            &nbsp;·&nbsp; Config: <strong style="color:var(--text-1);font-family:var(--font-mono);">${el.config}</strong>
          </div>
          <div style="font-size:var(--text-xs);color:var(--text-3);margin-top:2px;">
            Discovered: <strong style="color:var(--text-1);">${fmtYear(el.discovered)}</strong>
          </div>
        </div>

        <!-- Close -->
        <button onclick="ThreeDPeriodic._deselectElement()"
                style="flex-shrink:0;background:none;border:none;cursor:pointer;
                       font-size:1.25rem;line-height:1;padding:4px;color:var(--text-4);">×</button>
      </div>

      <!-- Description -->
      <p style="font-size:var(--text-sm);color:var(--text-2);line-height:1.6;
                margin-bottom:.75rem;border-left:2px solid ${fg};padding-left:.75rem;">
        ${el.desc}
      </p>

      <!-- Properties grid -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.375rem;">
        ${_propBadge('Melting Pt', fmtTemp(el.melt))}
        ${_propBadge('Boiling Pt', fmtTemp(el.boil))}
        ${_propBadge('Density',    el.density !== null ? el.density + ' g/cm³' : '—')}
        ${_propBadge('Period',     el.period)}
        ${_propBadge('Group',      fmt(el.group))}
        ${_propBadge('At. No.',    el.n)}
      </div>`;

    // Animate open
    panel.style.maxHeight = '320px';
  }

  function _propBadge(label, value) {
    return `
      <div style="background:var(--bg-subtle);border:1px solid var(--border);
                  border-radius:var(--r-sm);padding:.3125rem .5rem;">
        <div style="font-size:.5625rem;font-weight:700;text-transform:uppercase;
                    letter-spacing:.04em;color:var(--text-4);margin-bottom:1px;">${label}</div>
        <div style="font-size:var(--text-xs);font-weight:600;color:var(--text-1);">${value}</div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════
     FILTER & SEARCH
  ══════════════════════════════════════════════════ */

  function _setFilter(cat) {
    _filterCat = cat;
    _searchQuery = '';
    const searchEl = document.getElementById('pt-search');
    if (searchEl) searchEl.value = '';
    _applyFilter();
    _updateFilterButtons(cat);
    _deselectElement();
  }

  function _onSearch(query) {
    _searchQuery = query.toLowerCase().trim();
    _filterCat   = null;
    _applyFilter();
    _updateFilterButtons(null);
  }

  function _applyFilter() {
    const cells = document.querySelectorAll('.pt-cell');

    cells.forEach(cell => {
      const n = parseInt(cell.dataset.n, 10);
      const el = ELEMENTS.find(e => e.n === n);
      if (!el) return;

      let visible = true;

      if (_filterCat) {
        visible = el.cat === _filterCat;
      }

      if (_searchQuery && visible) {
        visible = (
          el.sym.toLowerCase().includes(_searchQuery) ||
          el.name.toLowerCase().includes(_searchQuery) ||
          String(el.n).includes(_searchQuery) ||
          (CAT_COLORS[el.cat]?.label || '').toLowerCase().includes(_searchQuery)
        );
      }

      const zDepth = Math.sin(n * 0.15) * 3;
      cell.classList.toggle('is-dimmed', !visible);
      cell.style.transform = visible ? `translateZ(${zDepth}px)` : `translateZ(${zDepth}px)`;
    });
  }

  function _updateFilterButtons(activeCat) {
    const allBtn = document.getElementById('pt-filter-all');
    if (allBtn) {
      allBtn.style.background = activeCat === null ? 'var(--accent)' : 'var(--bg-subtle)';
      allBtn.style.color      = activeCat === null ? '#fff'          : 'var(--text-3)';
      allBtn.style.border     = activeCat === null ? '1px solid var(--accent)' : '1px solid var(--border)';
    }

    Object.keys(CAT_COLORS).forEach(cat => {
      const btn = document.getElementById(`pt-filter-${cat}`);
      if (!btn) return;
      const colors = CAT_COLORS[cat];
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const isActive = cat === activeCat;

      if (isActive) {
        btn.style.background = isDark ? colors.dark_bg   : colors.bg;
        btn.style.color      = isDark ? colors.dark_text : colors.text;
        btn.style.border     = `1px solid ${isDark ? colors.dark_text : colors.text}`;
      } else {
        btn.style.background = 'var(--bg-subtle)';
        btn.style.color      = 'var(--text-3)';
        btn.style.border     = '1px solid var(--border)';
      }
    });
  }

  /* ══════════════════════════════════════════════════
     ZOOM & RESET
  ══════════════════════════════════════════════════ */

  function _zoom(delta) {
    _scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, _scale + delta));
    _applyTransform(true);
  }

  function _resetView() {
    _rotX  = -8;
    _rotY  = 0;
    _scale = 1;
    _velocity = { x: 0, y: 0 };
    _applyTransform(true);
  }

  /* ══════════════════════════════════════════════════
     BACK NAVIGATION
  ══════════════════════════════════════════════════ */

  function _back() {
    _unbindEvents();
    _selectedEl = null;
    if (typeof _onBack === 'function') _onBack();
  }

  /* ══════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════ */

  window.ThreeDPeriodic = {
    open,
    _back,
    _selectElement,
    _deselectElement,
    _setFilter,
    _onSearch,
    _zoom,
    _resetView,
  };

}());
