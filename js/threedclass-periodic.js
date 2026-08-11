/* ============================================================
   js/threedclass-periodic.js — Interactive 3D Periodic Table
   ============================================================ */

(function () {
  'use strict';

  const THREE_CDN  = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const ORBIT_CDN  = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';

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

  /* ══════════════════════════════════════════════════
     ELEMENT DATA
  ══════════════════════════════════════════════════ */

  const ELEMENTS = [
    { n:1,  sym:'H',  name:'Hydrogen',      mass:1.008,    cat:'nonmetal',       period:1, group:1,  config:'1s¹',                  melt:-259.14, boil:-252.87, density:0.00009,  discovered:1766, state:'gas',    electronegativity:2.20, shells:[1],           desc:'Hydrogen is the lightest and most abundant element in the universe, making up about 75% of all normal matter by mass. It is the primary fuel of stars, including our Sun, through nuclear fusion. On Earth, it exists mostly as water (H₂O) and organic compounds. It is colourless, odourless, and highly flammable as a gas. Scientists are exploring hydrogen as a clean fuel source for cars and power plants, since burning it produces only water. It is also essential for making ammonia, which is used in fertilisers that feed billions of people.' },
    { n:2,  sym:'He', name:'Helium',         mass:4.003,    cat:'noble-gas',      period:1, group:18, config:'1s²',                  melt:null,    boil:-268.93, density:0.000179, discovered:1868, state:'gas',    electronegativity:null, shells:[2],           desc:'Helium is the second most abundant element in the universe but is surprisingly rare on Earth. It was first discovered in the Sun\'s spectrum before it was found on Earth — its name comes from Helios, the Greek god of the Sun. Because it is lighter than air and non-flammable, it is used to fill balloons and airships safely. Liquid helium, which is extremely cold at −269 °C, is used to cool the superconducting magnets in MRI scanners. Helium is a noble gas and completely unreactive — it forms no chemical compounds under normal conditions.' },
    { n:3,  sym:'Li', name:'Lithium',        mass:6.941,    cat:'alkali-metal',   period:2, group:1,  config:'[He] 2s¹',             melt:180.54,  boil:1342,    density:0.534,    discovered:1817, state:'solid',  electronegativity:0.98, shells:[2,1],         desc:'Lithium is the lightest solid metal on Earth — so light it can float on water. It reacts vigorously with water, releasing flammable hydrogen gas. It is best known today for powering lithium-ion batteries found in smartphones, laptops, and electric vehicles. Lithium compounds are also used in psychiatric medicine to treat bipolar disorder. In industry, it is used to make ceramics, glass, and lubricating greases. Its name comes from the Greek word "lithos," meaning stone, because it was first found in minerals.' },
    { n:4,  sym:'Be', name:'Beryllium',      mass:9.012,    cat:'alkaline-earth', period:2, group:2,  config:'[He] 2s²',             melt:1287,    boil:2470,    density:1.85,     discovered:1798, state:'solid',  electronegativity:1.57, shells:[2,2],         desc:'Beryllium is a hard, lightweight, grey-white metal with a very high melting point relative to its low density. It is combined with copper to make a tough alloy used in aerospace components, springs, and tools that need to be non-sparking around flammable gases. Beryllium is transparent to X-rays, which makes it ideal for windows in X-ray machines. However, beryllium dust is highly toxic and can cause a serious lung disease called berylliosis. It is found in gemstones like emerald and aquamarine.' },
    { n:5,  sym:'B',  name:'Boron',          mass:10.811,   cat:'metalloid',      period:2, group:13, config:'[He] 2s² 2p¹',         melt:2076,    boil:3927,    density:2.34,     discovered:1808, state:'solid',  electronegativity:2.04, shells:[2,3],         desc:'Boron is a hard, dark metalloid that behaves partly like a metal and partly like a non-metal. It is an essential trace element for plant growth and is found in many fertilisers. Boron compounds are used in household borax cleaners, heat-resistant Pyrex glass, and fibreglass insulation. Boron fibre is stronger than steel by weight and is used in aerospace and military armour. Boron-10 is particularly good at absorbing neutrons, which makes it valuable in nuclear reactor control rods and cancer therapy (BNCT — Boron Neutron Capture Therapy).' },
    { n:6,  sym:'C',  name:'Carbon',         mass:12.011,   cat:'nonmetal',       period:2, group:14, config:'[He] 2s² 2p²',         melt:3642,    boil:3642,    density:2.267,    discovered:null, state:'solid',  electronegativity:2.55, shells:[2,4],         desc:'Carbon is the foundation of all known life on Earth. Every living thing is built from carbon compounds — DNA, proteins, fats, and carbohydrates are all carbon-based. Carbon is remarkable because it exists in several very different forms (called allotropes): soft graphite used in pencils, the hardest natural substance diamond, and the modern wonder materials graphene (a single layer of atoms) and fullerenes (hollow spheres). Carbon dioxide in the atmosphere drives photosynthesis and regulates Earth\'s temperature. Carbon dating uses the radioactive isotope C-14 to determine the age of ancient organic materials up to about 50,000 years old.' },
    { n:7,  sym:'N',  name:'Nitrogen',       mass:14.007,   cat:'nonmetal',       period:2, group:15, config:'[He] 2s² 2p³',         melt:-210.01, boil:-195.79, density:0.00125,  discovered:1772, state:'gas',    electronegativity:3.04, shells:[2,5],         desc:'Nitrogen makes up about 78% of the air we breathe, yet most organisms cannot use it directly from the air. Instead, special bacteria in soil "fix" atmospheric nitrogen into a usable form for plants. Nitrogen is absolutely essential for making amino acids, proteins, and DNA. Industrially, nitrogen is turned into ammonia through the Haber process, which is used to manufacture fertilisers that feed roughly half the world\'s population. Liquid nitrogen (−196 °C) is widely used to freeze and preserve biological samples, food, and in cryotherapy. It is also used to fill tyres and in fire suppression systems.' },
    { n:8,  sym:'O',  name:'Oxygen',         mass:15.999,   cat:'nonmetal',       period:2, group:16, config:'[He] 2s² 2p⁴',         melt:-218.3,  boil:-182.96, density:0.00143,  discovered:1774, state:'gas',    electronegativity:3.44, shells:[2,6],         desc:'Oxygen is the third most abundant element in the universe and makes up about 21% of Earth\'s atmosphere. It is essential for the respiration of almost all living organisms — cells use it to extract energy from glucose. Oxygen is also vital for combustion; nothing burns without it. It makes up about 65% of the human body by mass (mostly in water and organic molecules). Ozone (O₃), a molecule made of three oxygen atoms, forms a protective layer in the upper atmosphere that shields life from harmful ultraviolet radiation. Liquid oxygen is used as a powerful rocket propellant, and medical oxygen is used in hospitals for patients with breathing difficulties.' },
    { n:9,  sym:'F',  name:'Fluorine',       mass:18.998,   cat:'halogen',        period:2, group:17, config:'[He] 2s² 2p⁵',         melt:-219.67, boil:-188.11, density:0.001696, discovered:1886, state:'gas',    electronegativity:3.98, shells:[2,7],         desc:'Fluorine is the most electronegative element on the periodic table, meaning it attracts electrons more strongly than any other element. It is a pale yellow, extremely reactive gas that can react with almost every substance, including some noble gases. Despite its dangerous pure form, fluorine compounds are common and useful: fluoride is added to toothpaste and water supplies to prevent tooth decay; Teflon (PTFE) — the non-stick coating on cookware — is a fluorine compound; and HFCs are used in air conditioning. Fluorine is also used in uranium enrichment for nuclear fuel and in some anaesthetic gases used in surgery.' },
    { n:10, sym:'Ne', name:'Neon',           mass:20.18,    cat:'noble-gas',      period:2, group:18, config:'[He] 2s² 2p⁶',         melt:-248.59, boil:-246.08, density:0.0009,   discovered:1898, state:'gas',    electronegativity:null, shells:[2,8],         desc:'Neon is a colourless, odourless noble gas that glows a distinctive red-orange when electricity passes through it — giving rise to the famous "neon sign" technology used in advertising since the 1920s. Despite its association with signs, actual neon only produces red and orange colours; other colours use different gases. Neon is the fifth most abundant element in the universe but is very rare in Earth\'s atmosphere. It is extracted from air by fractional distillation. Like all noble gases, neon is completely chemically inert — it forms no stable chemical compounds. It is also used in high-voltage indicators and cryogenic refrigeration.' },
    { n:11, sym:'Na', name:'Sodium',         mass:22.99,    cat:'alkali-metal',   period:3, group:1,  config:'[Ne] 3s¹',             melt:97.72,   boil:883,     density:0.968,    discovered:1807, state:'solid',  electronegativity:0.93, shells:[2,8,1],       desc:'Sodium is a soft, silvery-white metal so reactive that it must be stored under oil to prevent it from reacting with moisture in the air. When dropped in water, it fizzes violently, releasing hydrogen gas and heat — it can even catch fire. Despite this, sodium is essential for all animal life: it regulates blood pressure, nerve impulses, and muscle contractions. Table salt (sodium chloride, NaCl) is one of the most important chemicals in human history, used for food preservation and flavouring. Sodium is also used in street lamps (giving their orange glow), as a coolant in some nuclear reactors, and in making paper and textiles.' },
    { n:12, sym:'Mg', name:'Magnesium',      mass:24.305,   cat:'alkaline-earth', period:3, group:2,  config:'[Ne] 3s²',             melt:650,     boil:1090,    density:1.738,    discovered:1755, state:'solid',  electronegativity:1.31, shells:[2,8,2],       desc:'Magnesium is a lightweight, silvery-white metal that burns with an intensely bright white flame — so bright it was used in early camera flashes and is still used in fireworks and flares. It is the eighth most abundant element in Earth\'s crust and the fourth most common element in the Earth as a whole (in its core and mantle). Magnesium is at the centre of the chlorophyll molecule, which plants use to capture sunlight during photosynthesis — without magnesium, there would be no green plants. In the human body, it is essential for over 300 enzyme reactions and for muscle and nerve function. Magnesium alloys are used in aircraft, car parts, and laptop cases because they are strong yet lightweight.' },
    { n:13, sym:'Al', name:'Aluminium',      mass:26.982,   cat:'post-transition',period:3, group:13, config:'[Ne] 3s² 3p¹',         melt:660.32,  boil:2519,    density:2.698,    discovered:1825, state:'solid',  electronegativity:1.61, shells:[2,8,3],       desc:'Aluminium is the most abundant metal and the third most abundant element in Earth\'s crust (after oxygen and silicon), yet it was once more valuable than gold because it was so difficult to extract. Today, the Hall-Héroult process (electrolysis of alumina) makes it cheaply available. Aluminium is lightweight, corrosion-resistant (it forms a thin oxide layer that protects it), conducts electricity well, and is 100% recyclable. These properties make it essential in aircraft, cars, drink cans, food packaging, power lines, and building construction. It is also non-magnetic and non-toxic, making it useful in kitchen foil and cooking utensils.' },
    { n:14, sym:'Si', name:'Silicon',        mass:28.086,   cat:'metalloid',      period:3, group:14, config:'[Ne] 3s² 3p²',         melt:1414,    boil:2900,    density:2.329,    discovered:1824, state:'solid',  electronegativity:1.90, shells:[2,8,4],       desc:'Silicon is the second most abundant element in Earth\'s crust (after oxygen) and is found in sand, quartz, and most rocks as silicon dioxide (SiO₂). Its most transformative use is as a semiconductor — silicon\'s electrical conductivity can be precisely controlled, making it the backbone of all modern electronics including computer chips, solar cells, and transistors. "Silicon Valley" is named after it. Silicon is also used to make glass, cement, ceramics, and silicones (flexible polymers used in sealants, medical implants, and cookware). Interestingly, despite silicon\'s abundance and similarity to carbon, no life forms are known to be silicon-based.' },
    { n:15, sym:'P',  name:'Phosphorus',     mass:30.974,   cat:'nonmetal',       period:3, group:15, config:'[Ne] 3s² 3p³',         melt:44.15,   boil:280.5,   density:1.823,    discovered:1669, state:'solid',  electronegativity:2.19, shells:[2,8,5],       desc:'Phosphorus exists in several forms: highly toxic and flammable white phosphorus, stable red phosphorus used in match heads, and rare black phosphorus. It is essential for life — every cell\'s energy currency (ATP), the backbone of DNA and RNA, and bones and teeth (calcium phosphate) all depend on phosphorus. It was first isolated from urine in 1669 by German alchemist Hennig Brand, who was trying to make gold. Today, the main use is in fertilisers (about 80% of production) to replace soil phosphorus depleted by farming. It is also used in detergents, food additives, and some nerve agents (organophosphates). Unlike carbon and nitrogen, there is no atmospheric reservoir of phosphorus — once used, it must be recycled or mined.' },
    { n:16, sym:'S',  name:'Sulfur',         mass:32.06,    cat:'nonmetal',       period:3, group:16, config:'[Ne] 3s² 3p⁴',         melt:115.21,  boil:444.61,  density:2.067,    discovered:null, state:'solid',  electronegativity:2.58, shells:[2,8,6],       desc:'Sulfur is a bright yellow, brittle solid known since ancient times — it was called "brimstone" (burning stone) in the Bible. It is found around volcanic vents and hot springs. Sulfur is essential to life; amino acids like cysteine and methionine contain it, and it helps give garlic and onions their pungent smell. Its most important industrial use is making sulfuric acid (H₂SO₄), the world\'s most widely produced industrial chemical, used in fertilisers, batteries, and refining metals. Sulfur is also used in vulcanising rubber (making it tough and elastic), in fungicides, and historically in gunpowder. Burning sulfur-containing fuels releases sulfur dioxide, which causes acid rain.' },
    { n:17, sym:'Cl', name:'Chlorine',       mass:35.45,    cat:'halogen',        period:3, group:17, config:'[Ne] 3s² 3p⁵',         melt:-101.5,  boil:-34.04,  density:0.00321,  discovered:1774, state:'gas',    electronegativity:3.16, shells:[2,8,7],       desc:'Chlorine is a pale yellow-green, pungent gas that is highly toxic — it was used as a chemical weapon in World War I. However, in controlled amounts it is one of the most beneficial elements in modern life. Small amounts of chlorine are added to drinking water and swimming pools to kill harmful bacteria and prevent waterborne diseases like cholera and typhoid. It is used to make PVC (polyvinyl chloride) plastic, bleach (sodium hypochlorite), and many pharmaceuticals and pesticides. Chlorine also bonds with sodium to form ordinary table salt (NaCl). The ozone layer is depleted by chlorofluorocarbons (CFCs), which release chlorine atoms in the upper atmosphere.' },
    { n:18, sym:'Ar', name:'Argon',          mass:39.948,   cat:'noble-gas',      period:3, group:18, config:'[Ne] 3s² 3p⁶',         melt:-189.36, boil:-185.85, density:0.00178,  discovered:1894, state:'gas',    electronegativity:null, shells:[2,8,8],       desc:'Argon is the third most abundant gas in Earth\'s atmosphere (about 0.93%), despite being entirely useless to most life forms — it is completely chemically inert. Its inertness makes it extremely valuable industrially: argon is used as a protective atmosphere during welding and metal cutting to prevent oxidation; it fills incandescent light bulbs to extend filament life; and it is used in windows (between the panes of double-glazing) for insulation. Argon is also used in plasma TVs, in the production of semiconductors and solar panels, and to preserve historical documents like the US Declaration of Independence. It was the last of the "classical" noble gases to be discovered.' },
    { n:19, sym:'K',  name:'Potassium',      mass:39.098,   cat:'alkali-metal',   period:4, group:1,  config:'[Ar] 4s¹',             melt:63.38,   boil:759,     density:0.862,    discovered:1807, state:'solid',  electronegativity:0.82, shells:[2,8,8,1],     desc:'Potassium is a soft, silvery-white metal that reacts even more vigorously with water than sodium — it ignites spontaneously, producing a bright lilac flame. Its chemical symbol K comes from the Latin "kalium" (from Arabic "qali," meaning alkali). Potassium is the eighth most abundant element in Earth\'s crust and one of the most essential minerals for life. In the body, it works alongside sodium to maintain fluid balance, generate nerve signals, and enable muscle contractions — including the heartbeat. A potassium deficiency causes muscle cramps and heart arrhythmia. Potassium is heavily used in fertilisers (as potash) since it promotes strong plant roots and disease resistance. Radioactive K-40 in our own bodies is one source of our natural background radiation.' },
    { n:20, sym:'Ca', name:'Calcium',        mass:40.078,   cat:'alkaline-earth', period:4, group:2,  config:'[Ar] 4s²',             melt:842,     boil:1484,    density:1.55,     discovered:1808, state:'solid',  electronegativity:1.00, shells:[2,8,8,2],     desc:'Calcium is the fifth most abundant element in Earth\'s crust and the most abundant mineral in the human body — about 99% of the body\'s calcium is stored in bones and teeth as hydroxyapatite. It is also essential for blood clotting, muscle contraction, nerve transmission, and hormone secretion. As calcium carbonate (limestone, chalk, and marble), it forms vast sedimentary rock formations and is used in making cement, concrete, and glass. Calcium oxide (quicklime), produced by heating limestone, is used in water treatment, steel production, and agriculture to reduce soil acidity. Calcium also gives many mineral springs their hardness and the distinctive drip formations (stalactites and stalagmites) in caves.' },
    { n:21, sym:'Sc', name:'Scandium',       mass:44.956,   cat:'transition',     period:4, group:3,  config:'[Ar] 3d¹ 4s²',         melt:1541,    boil:2836,    density:2.985,    discovered:1879, state:'solid',  electronegativity:1.36, shells:[2,8,9,2],     desc:'Scandium is a rare, silvery-white transition metal.' },
    { n:22, sym:'Ti', name:'Titanium',       mass:47.867,   cat:'transition',     period:4, group:4,  config:'[Ar] 3d² 4s²',         melt:1668,    boil:3287,    density:4.506,    discovered:1791, state:'solid',  electronegativity:1.54, shells:[2,8,10,2],    desc:'Titanium is a strong, lustrous, silver-grey metal.' },
    { n:23, sym:'V',  name:'Vanadium',       mass:50.942,   cat:'transition',     period:4, group:5,  config:'[Ar] 3d³ 4s²',         melt:1910,    boil:3407,    density:6.0,      discovered:1801, state:'solid',  electronegativity:1.63, shells:[2,8,11,2],    desc:'Vanadium is a hard, steely-grey transition metal.' },
    { n:24, sym:'Cr', name:'Chromium',       mass:51.996,   cat:'transition',     period:4, group:6,  config:'[Ar] 3d⁵ 4s¹',         melt:1907,    boil:2671,    density:7.15,     discovered:1797, state:'solid',  electronegativity:1.66, shells:[2,8,13,1],    desc:'Chromium is a hard, shiny, grey metal.' },
    { n:25, sym:'Mn', name:'Manganese',      mass:54.938,   cat:'transition',     period:4, group:7,  config:'[Ar] 3d⁵ 4s²',         melt:1246,    boil:2061,    density:7.44,     discovered:1774, state:'solid',  electronegativity:1.55, shells:[2,8,13,2],    desc:'Manganese is a hard, brittle, silvery-grey metal.' },
    { n:26, sym:'Fe', name:'Iron',           mass:55.845,   cat:'transition',     period:4, group:8,  config:'[Ar] 3d⁶ 4s²',         melt:1538,    boil:2861,    density:7.874,    discovered:null, state:'solid',  electronegativity:1.83, shells:[2,8,14,2],    desc:'Iron is the most abundant element on Earth by mass.' },
    { n:27, sym:'Co', name:'Cobalt',         mass:58.933,   cat:'transition',     period:4, group:9,  config:'[Ar] 3d⁷ 4s²',         melt:1495,    boil:2927,    density:8.9,      discovered:1735, state:'solid',  electronegativity:1.88, shells:[2,8,15,2],    desc:'Cobalt is a hard, lustrous, bluish-grey metal.' },
    { n:28, sym:'Ni', name:'Nickel',         mass:58.693,   cat:'transition',     period:4, group:10, config:'[Ar] 3d⁸ 4s²',         melt:1455,    boil:2913,    density:8.908,    discovered:1751, state:'solid',  electronegativity:1.91, shells:[2,8,16,2],    desc:'Nickel is a hard, silvery-white, magnetic metal.' },
    { n:29, sym:'Cu', name:'Copper',         mass:63.546,   cat:'transition',     period:4, group:11, config:'[Ar] 3d¹⁰ 4s¹',        melt:1084.62, boil:2562,    density:8.96,     discovered:null, state:'solid',  electronegativity:1.90, shells:[2,8,18,1],    desc:'Copper is one of the few metals found in pure form in nature.' },
    { n:30, sym:'Zn', name:'Zinc',           mass:65.38,    cat:'transition',     period:4, group:12, config:'[Ar] 3d¹⁰ 4s²',        melt:419.53,  boil:907,     density:7.134,    discovered:1746, state:'solid',  electronegativity:1.65, shells:[2,8,18,2],    desc:'Zinc is a bluish-white metal.' },
    { n:31, sym:'Ga', name:'Gallium',        mass:69.723,   cat:'post-transition',period:4, group:13, config:'[Ar] 3d¹⁰ 4s² 4p¹',   melt:29.76,   boil:2229,    density:5.907,    discovered:1875, state:'solid',  electronegativity:1.81, shells:[2,8,18,3],    desc:'Gallium is a soft, silvery metal that melts in the palm of a hand.' },
    { n:32, sym:'Ge', name:'Germanium',      mass:72.63,    cat:'metalloid',      period:4, group:14, config:'[Ar] 3d¹⁰ 4s² 4p²',   melt:938.25,  boil:2833,    density:5.323,    discovered:1886, state:'solid',  electronegativity:2.01, shells:[2,8,18,4],    desc:'Germanium is a lustrous, grey-white metalloid.' },
    { n:33, sym:'As', name:'Arsenic',        mass:74.922,   cat:'metalloid',      period:4, group:15, config:'[Ar] 3d¹⁰ 4s² 4p³',   melt:817,     boil:614,     density:5.727,    discovered:null, state:'solid',  electronegativity:2.18, shells:[2,8,18,5],    desc:'Arsenic is a notoriously toxic metalloid.' },
    { n:34, sym:'Se', name:'Selenium',       mass:78.971,   cat:'nonmetal',       period:4, group:16, config:'[Ar] 3d¹⁰ 4s² 4p⁴',   melt:220.8,   boil:685,     density:4.809,    discovered:1817, state:'solid',  electronegativity:2.55, shells:[2,8,18,6],    desc:'Selenium is a non-metal that exists in several forms.' },
    { n:35, sym:'Br', name:'Bromine',        mass:79.904,   cat:'halogen',        period:4, group:17, config:'[Ar] 3d¹⁰ 4s² 4p⁵',   melt:-7.2,    boil:58.9,    density:3.122,    discovered:1826, state:'liquid', electronegativity:2.96, shells:[2,8,18,7],    desc:'Bromine is one of only two elements that are liquid at room temperature.' },
    { n:36, sym:'Kr', name:'Krypton',        mass:83.798,   cat:'noble-gas',      period:4, group:18, config:'[Ar] 3d¹⁰ 4s² 4p⁶',   melt:-157.36, boil:-153.22, density:0.00375,  discovered:1898, state:'gas',    electronegativity:3.00, shells:[2,8,18,8],    desc:'Krypton is a colourless, odourless noble gas.' },
    { n:37, sym:'Rb', name:'Rubidium',       mass:85.468,   cat:'alkali-metal',   period:5, group:1,  config:'[Kr] 5s¹',             melt:39.31,   boil:688,     density:1.532,    discovered:1861, state:'solid',  electronegativity:0.82, shells:[2,8,18,8,1],  desc:'Rubidium is a very soft, silvery-white alkali metal.' },
    { n:38, sym:'Sr', name:'Strontium',      mass:87.62,    cat:'alkaline-earth', period:5, group:2,  config:'[Kr] 5s²',             melt:777,     boil:1382,    density:2.64,     discovered:1790, state:'solid',  electronegativity:0.95, shells:[2,8,18,8,2],  desc:'Strontium is a soft, silvery-white, highly reactive alkaline earth metal.' },
    { n:39, sym:'Y',  name:'Yttrium',        mass:88.906,   cat:'transition',     period:5, group:3,  config:'[Kr] 4d¹ 5s²',         melt:1522,    boil:3345,    density:4.472,    discovered:1794, state:'solid',  electronegativity:1.22, shells:[2,8,18,9,2],  desc:'Yttrium is a silvery-white, rare earth transition metal.' },
    { n:40, sym:'Zr', name:'Zirconium',      mass:91.224,   cat:'transition',     period:5, group:4,  config:'[Kr] 4d² 5s²',         melt:1855,    boil:4409,    density:6.511,    discovered:1789, state:'solid',  electronegativity:1.33, shells:[2,8,18,10,2], desc:'Zirconium is a lustrous, greyish-white, strong, corrosion-resistant transition metal.' },
    { n:41, sym:'Nb', name:'Niobium',        mass:92.906,   cat:'transition',     period:5, group:5,  config:'[Kr] 4d⁴ 5s¹',         melt:2477,    boil:4744,    density:8.57,     discovered:1801, state:'solid',  electronegativity:1.60, shells:[2,8,18,12,1], desc:'Niobium is a soft, grey, ductile transition metal.' },
    { n:42, sym:'Mo', name:'Molybdenum',     mass:95.95,    cat:'transition',     period:5, group:6,  config:'[Kr] 4d⁵ 5s¹',         melt:2623,    boil:4639,    density:10.28,    discovered:1781, state:'solid',  electronegativity:2.16, shells:[2,8,18,13,1], desc:'Molybdenum is a silvery-white metal with the sixth highest melting point of all elements.' },
    { n:43, sym:'Tc', name:'Technetium',     mass:98,       cat:'transition',     period:5, group:7,  config:'[Kr] 4d⁵ 5s²',         melt:2157,    boil:4265,    density:11.5,     discovered:1937, state:'solid',  electronegativity:1.90, shells:[2,8,18,13,2], desc:'Technetium was the first element to be artificially produced.' },
    { n:44, sym:'Ru', name:'Ruthenium',      mass:101.07,   cat:'transition',     period:5, group:8,  config:'[Kr] 4d⁷ 5s¹',         melt:2334,    boil:4150,    density:12.37,    discovered:1844, state:'solid',  electronegativity:2.20, shells:[2,8,18,15,1], desc:'Ruthenium is a rare, hard, silvery-white platinum-group metal.' },
    { n:45, sym:'Rh', name:'Rhodium',        mass:102.906,  cat:'transition',     period:5, group:9,  config:'[Kr] 4d⁸ 5s¹',         melt:1964,    boil:3695,    density:12.41,    discovered:1803, state:'solid',  electronegativity:2.28, shells:[2,8,18,16,1], desc:'Rhodium is one of the rarest and most expensive metals on Earth.' },
    { n:46, sym:'Pd', name:'Palladium',      mass:106.42,   cat:'transition',     period:5, group:10, config:'[Kr] 4d¹⁰',            melt:1554.9,  boil:2963,    density:12.023,   discovered:1803, state:'solid',  electronegativity:2.20, shells:[2,8,18,18],   desc:'Palladium is a rare, lustrous, silvery-white metal.' },
    { n:47, sym:'Ag', name:'Silver',         mass:107.868,  cat:'transition',     period:5, group:11, config:'[Kr] 4d¹⁰ 5s¹',        melt:961.78,  boil:2162,    density:10.49,    discovered:null, state:'solid',  electronegativity:1.93, shells:[2,8,18,18,1], desc:'Silver has the highest electrical conductivity of all metals.' },
    { n:48, sym:'Cd', name:'Cadmium',        mass:112.411,  cat:'transition',     period:5, group:12, config:'[Kr] 4d¹⁰ 5s²',        melt:321.07,  boil:767,     density:8.65,     discovered:1817, state:'solid',  electronegativity:1.69, shells:[2,8,18,18,2], desc:'Cadmium is a soft, bluish-white metal that is extremely toxic.' },
    { n:49, sym:'In', name:'Indium',         mass:114.818,  cat:'post-transition',period:5, group:13, config:'[Kr] 4d¹⁰ 5s² 5p¹',   melt:156.6,   boil:2072,    density:7.31,     discovered:1863, state:'solid',  electronegativity:1.78, shells:[2,8,18,18,3], desc:'Indium is a soft, silvery-white post-transition metal.' },
    { n:50, sym:'Sn', name:'Tin',            mass:118.71,   cat:'post-transition',period:5, group:14, config:'[Kr] 4d¹⁰ 5s² 5p²',   melt:231.93,  boil:2602,    density:7.287,    discovered:null, state:'solid',  electronegativity:1.96, shells:[2,8,18,18,4], desc:'Tin is a soft, silvery-white metal known since antiquity.' },
    { n:51, sym:'Sb', name:'Antimony',       mass:121.76,   cat:'metalloid',      period:5, group:15, config:'[Kr] 4d¹⁰ 5s² 5p³',   melt:630.63,  boil:1587,    density:6.685,    discovered:null, state:'solid',  electronegativity:2.05, shells:[2,8,18,18,5], desc:'Antimony is a lustrous, brittle, silver-white metalloid.' },
    { n:52, sym:'Te', name:'Tellurium',      mass:127.6,    cat:'metalloid',      period:5, group:16, config:'[Kr] 4d¹⁰ 5s² 5p⁴',   melt:449.51,  boil:988,     density:6.232,    discovered:1782, state:'solid',  electronegativity:2.10, shells:[2,8,18,18,6], desc:'Tellurium is a rare, brittle, silver-white metalloid.' },
    { n:53, sym:'I',  name:'Iodine',         mass:126.904,  cat:'halogen',        period:5, group:17, config:'[Kr] 4d¹⁰ 5s² 5p⁵',   melt:113.7,   boil:184.4,   density:4.933,    discovered:1811, state:'solid',  electronegativity:2.66, shells:[2,8,18,18,7], desc:'Iodine is a lustrous, dark purple-grey solid.' },
    { n:54, sym:'Xe', name:'Xenon',          mass:131.293,  cat:'noble-gas',      period:5, group:18, config:'[Kr] 4d¹⁰ 5s² 5p⁶',   melt:-111.7,  boil:-108.1,  density:0.00589,  discovered:1898, state:'gas',    electronegativity:2.60, shells:[2,8,18,18,8], desc:'Xenon is a dense, colourless noble gas.' },
    { n:55, sym:'Cs', name:'Caesium',        mass:132.905,  cat:'alkali-metal',   period:6, group:1,  config:'[Xe] 6s¹',             melt:28.44,   boil:671,     density:1.93,     discovered:1860, state:'solid',  electronegativity:0.79, shells:[2,8,18,18,8,1],   desc:'Caesium is a soft, golden-tinted metal.' },
    { n:56, sym:'Ba', name:'Barium',         mass:137.327,  cat:'alkaline-earth', period:6, group:2,  config:'[Xe] 6s²',             melt:727,     boil:1870,    density:3.51,     discovered:1808, state:'solid',  electronegativity:0.89, shells:[2,8,18,18,8,2],   desc:'Barium is a soft, silvery-white alkaline earth metal.' },
    { n:57, sym:'La', name:'Lanthanum',      mass:138.905,  cat:'lanthanide',     period:6, group:3,  config:'[Xe] 5d¹ 6s²',         melt:920,     boil:3464,    density:6.145,    discovered:1839, state:'solid',  electronegativity:1.10, shells:[2,8,18,18,9,2],   desc:'Lanthanum is a soft, malleable, silvery-white rare earth metal.' },
    { n:58, sym:'Ce', name:'Cerium',         mass:140.116,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹ 5d¹ 6s²',    melt:798,     boil:3443,    density:6.77,     discovered:1803, state:'solid',  electronegativity:1.12, shells:[2,8,18,19,9,2],   desc:'Cerium is the most abundant of the rare earth elements.' },
    { n:59, sym:'Pr', name:'Praseodymium',   mass:140.908,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f³ 6s²',        melt:931,     boil:3520,    density:6.773,    discovered:1885, state:'solid',  electronegativity:1.13, shells:[2,8,18,21,8,2],   desc:'Praseodymium is a soft, silvery, malleable rare earth metal.' },
    { n:60, sym:'Nd', name:'Neodymium',      mass:144.242,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f⁴ 6s²',        melt:1021,    boil:3074,    density:7.007,    discovered:1885, state:'solid',  electronegativity:1.14, shells:[2,8,18,22,8,2],   desc:'Neodymium magnets are the strongest permanent magnets ever made.' },
    { n:61, sym:'Pm', name:'Promethium',     mass:145,      cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f⁵ 6s²',        melt:1042,    boil:3000,    density:7.26,     discovered:1945, state:'solid',  electronegativity:1.13, shells:[2,8,18,23,8,2],   desc:'Promethium is the only lanthanide with no stable isotopes.' },
    { n:62, sym:'Sm', name:'Samarium',       mass:150.36,   cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f⁶ 6s²',        melt:1072,    boil:1794,    density:7.52,     discovered:1879, state:'solid',  electronegativity:1.17, shells:[2,8,18,24,8,2],   desc:'Samarium is a hard, silvery rare earth metal.' },
    { n:63, sym:'Eu', name:'Europium',       mass:151.964,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f⁷ 6s²',        melt:826,     boil:1529,    density:5.243,    discovered:1901, state:'solid',  electronegativity:null, shells:[2,8,18,25,8,2],   desc:'Europium is the most reactive rare earth metal.' },
    { n:64, sym:'Gd', name:'Gadolinium',     mass:157.25,   cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f⁷ 5d¹ 6s²',   melt:1313,    boil:3273,    density:7.9,      discovered:1880, state:'solid',  electronegativity:1.20, shells:[2,8,18,25,9,2],   desc:'Gadolinium has unusual magnetic properties.' },
    { n:65, sym:'Tb', name:'Terbium',        mass:158.925,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f⁹ 6s²',        melt:1356,    boil:3230,    density:8.229,    discovered:1843, state:'solid',  electronegativity:null, shells:[2,8,18,27,8,2],   desc:'Terbium is a soft, malleable, silvery-white rare earth metal.' },
    { n:66, sym:'Dy', name:'Dysprosium',     mass:162.5,    cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹⁰ 6s²',       melt:1412,    boil:2567,    density:8.55,     discovered:1886, state:'solid',  electronegativity:1.22, shells:[2,8,18,28,8,2],   desc:'Dysprosium has the highest magnetic moment of any naturally occurring element.' },
    { n:67, sym:'Ho', name:'Holmium',        mass:164.93,   cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹¹ 6s²',       melt:1474,    boil:2700,    density:8.795,    discovered:1879, state:'solid',  electronegativity:1.23, shells:[2,8,18,29,8,2],   desc:'Holmium has the highest magnetic dipole moment of any element.' },
    { n:68, sym:'Er', name:'Erbium',         mass:167.259,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹² 6s²',       melt:1497,    boil:2868,    density:9.066,    discovered:1843, state:'solid',  electronegativity:1.24, shells:[2,8,18,30,8,2],   desc:'Erbium-doped fibre amplifiers make long-distance internet possible.' },
    { n:69, sym:'Tm', name:'Thulium',        mass:168.934,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹³ 6s²',       melt:1545,    boil:1950,    density:9.321,    discovered:1879, state:'solid',  electronegativity:1.25, shells:[2,8,18,31,8,2],   desc:'Thulium is the least abundant of the naturally occurring lanthanides.' },
    { n:70, sym:'Yb', name:'Ytterbium',      mass:173.045,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹⁴ 6s²',       melt:819,     boil:1196,    density:6.965,    discovered:1878, state:'solid',  electronegativity:null, shells:[2,8,18,32,8,2],   desc:'Ytterbium atomic clocks are the most precise clocks ever built.' },
    { n:71, sym:'Lu', name:'Lutetium',       mass:174.967,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹⁴ 5d¹ 6s²',  melt:1663,    boil:3402,    density:9.84,     discovered:1907, state:'solid',  electronegativity:1.27, shells:[2,8,18,32,9,2],   desc:'Lutetium is the heaviest, hardest, and densest of all the lanthanides.' },
    { n:72, sym:'Hf', name:'Hafnium',        mass:178.49,   cat:'transition',     period:6, group:4,  config:'[Xe] 4f¹⁴ 5d² 6s²',  melt:2233,    boil:4603,    density:13.31,    discovered:1923, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,10,2],  desc:'Hafnium is invaluable as a control rod material in nuclear reactors.' },
    { n:73, sym:'Ta', name:'Tantalum',       mass:180.948,  cat:'transition',     period:6, group:5,  config:'[Xe] 4f¹⁴ 5d³ 6s²',  melt:3017,    boil:5458,    density:16.69,    discovered:1802, state:'solid',  electronegativity:1.50, shells:[2,8,18,32,11,2],  desc:'Tantalum capacitors are in virtually every smartphone.' },
    { n:74, sym:'W',  name:'Tungsten',       mass:183.84,   cat:'transition',     period:6, group:6,  config:'[Xe] 4f¹⁴ 5d⁴ 6s²',  melt:3422,    boil:5555,    density:19.25,    discovered:1783, state:'solid',  electronegativity:2.36, shells:[2,8,18,32,12,2],  desc:'Tungsten has the highest melting point of all elements.' },
    { n:75, sym:'Re', name:'Rhenium',        mass:186.207,  cat:'transition',     period:6, group:7,  config:'[Xe] 4f¹⁴ 5d⁵ 6s²',  melt:3186,    boil:5596,    density:21.02,    discovered:1925, state:'solid',  electronegativity:1.90, shells:[2,8,18,32,13,2],  desc:'Rhenium has the second highest melting point of all elements.' },
    { n:76, sym:'Os', name:'Osmium',         mass:190.23,   cat:'transition',     period:6, group:8,  config:'[Xe] 4f¹⁴ 5d⁶ 6s²',  melt:3033,    boil:5012,    density:22.59,    discovered:1803, state:'solid',  electronegativity:2.20, shells:[2,8,18,32,14,2],  desc:'Osmium is the densest naturally occurring element.' },
    { n:77, sym:'Ir', name:'Iridium',        mass:192.217,  cat:'transition',     period:6, group:9,  config:'[Xe] 4f¹⁴ 5d⁷ 6s²',  melt:2446,    boil:4428,    density:22.56,    discovered:1803, state:'solid',  electronegativity:2.20, shells:[2,8,18,32,15,2],  desc:'Iridium is the most corrosion-resistant metal known.' },
    { n:78, sym:'Pt', name:'Platinum',       mass:195.084,  cat:'transition',     period:6, group:10, config:'[Xe] 4f¹⁴ 5d⁹ 6s¹',  melt:1768.3,  boil:3825,    density:21.45,    discovered:1735, state:'solid',  electronegativity:2.28, shells:[2,8,18,32,17,1],  desc:'Platinum is a dense, malleable, ductile, precious metal.' },
    { n:79, sym:'Au', name:'Gold',           mass:196.967,  cat:'transition',     period:6, group:11, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s¹', melt:1064.18, boil:2856,    density:19.3,     discovered:null, state:'solid',  electronegativity:2.54, shells:[2,8,18,32,18,1],  desc:'Gold has been prized since antiquity for its beauty and corrosion resistance.' },
    { n:80, sym:'Hg', name:'Mercury',        mass:200.592,  cat:'transition',     period:6, group:12, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s²', melt:-38.83,  boil:356.73,  density:13.534,   discovered:null, state:'liquid', electronegativity:2.00, shells:[2,8,18,32,18,2],  desc:'Mercury is the only metal that is liquid at room temperature.' },
    { n:81, sym:'Tl', name:'Thallium',       mass:204.38,   cat:'post-transition',period:6, group:13, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p¹',  melt:304,  boil:1473,    density:11.85,    discovered:1861, state:'solid',  electronegativity:1.62, shells:[2,8,18,32,18,3],  desc:'Thallium is a soft, grey post-transition metal.' },
    { n:82, sym:'Pb', name:'Lead',           mass:207.2,    cat:'post-transition',period:6, group:14, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p²',  melt:327.46, boil:1749, density:11.34,    discovered:null, state:'solid',  electronegativity:2.33, shells:[2,8,18,32,18,4],  desc:'Lead is the heaviest stable element.' },
    { n:83, sym:'Bi', name:'Bismuth',        mass:208.98,   cat:'post-transition',period:6, group:15, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p³',  melt:271.3, boil:1564, density:9.787,    discovered:null, state:'solid',  electronegativity:2.02, shells:[2,8,18,32,18,5],  desc:'Bismuth is the most naturally diamagnetic element.' },
    { n:84, sym:'Po', name:'Polonium',       mass:209,      cat:'post-transition',period:6, group:16, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁴',  melt:254,   boil:962,     density:9.196,    discovered:1898, state:'solid',  electronegativity:2.00, shells:[2,8,18,32,18,6],  desc:'Polonium was discovered by Marie and Pierre Curie in 1898.' },
    { n:85, sym:'At', name:'Astatine',       mass:210,      cat:'halogen',        period:6, group:17, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁵',  melt:302,   boil:337,     density:7,        discovered:1940, state:'solid',  electronegativity:2.20, shells:[2,8,18,32,18,7],  desc:'Astatine is the rarest naturally occurring element.' },
    { n:86, sym:'Rn', name:'Radon',          mass:222,      cat:'noble-gas',      period:6, group:18, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁶',  melt:-71,   boil:-61.7,   density:0.00973,  discovered:1900, state:'gas',    electronegativity:null, shells:[2,8,18,32,18,8],  desc:'Radon is a colourless, odourless, radioactive noble gas.' },
    { n:87, sym:'Fr', name:'Francium',       mass:223,      cat:'alkali-metal',   period:7, group:1,  config:'[Rn] 7s¹',             melt:27,      boil:677,     density:1.87,     discovered:1939, state:'solid',  electronegativity:0.70, shells:[2,8,18,32,18,8,1],  desc:'Francium is the second rarest naturally occurring element.' },
    { n:88, sym:'Ra', name:'Radium',         mass:226,      cat:'alkaline-earth', period:7, group:2,  config:'[Rn] 7s²',             melt:700,     boil:1737,    density:5.5,      discovered:1898, state:'solid',  electronegativity:0.90, shells:[2,8,18,32,18,8,2],  desc:'Radium was discovered by Marie and Pierre Curie in 1898.' },
    { n:89, sym:'Ac', name:'Actinium',       mass:227,      cat:'actinide',       period:7, group:3,  config:'[Rn] 6d¹ 7s²',         melt:1050,    boil:3200,    density:10.07,    discovered:1899, state:'solid',  electronegativity:1.10, shells:[2,8,18,32,18,9,2],  desc:'Actinium glows pale blue in the dark due to its radiation.' },
    { n:90, sym:'Th', name:'Thorium',        mass:232.038,  cat:'actinide',       period:7, group:null,config:'[Rn] 6d² 7s²',        melt:1750,    boil:4788,    density:11.72,    discovered:1829, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,18,10,2], desc:'Thorium is being investigated as an alternative nuclear fuel.' },
    { n:91, sym:'Pa', name:'Protactinium',   mass:231.036,  cat:'actinide',       period:7, group:null,config:'[Rn] 5f² 6d¹ 7s²',   melt:1572,    boil:4000,    density:15.37,    discovered:1913, state:'solid',  electronegativity:1.50, shells:[2,8,18,32,20,9,2],  desc:'Protactinium is a dense, highly toxic, radioactive actinide metal.' },
    { n:92, sym:'U',  name:'Uranium',        mass:238.029,  cat:'actinide',       period:7, group:null,config:'[Rn] 5f³ 6d¹ 7s²',   melt:1135,    boil:4131,    density:19.1,     discovered:1789, state:'solid',  electronegativity:1.38, shells:[2,8,18,32,21,9,2],  desc:'Uranium is the heaviest naturally occurring element.' },
    { n:93, sym:'Np', name:'Neptunium',      mass:237,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f⁴ 6d¹ 7s²',   melt:639,     boil:4000,    density:20.45,    discovered:1940, state:'solid',  electronegativity:1.36, shells:[2,8,18,32,22,9,2],  desc:'Neptunium was the first transuranic element to be synthesised.' },
    { n:94, sym:'Pu', name:'Plutonium',      mass:244,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f⁶ 7s²',        melt:640,     boil:3228,    density:19.816,   discovered:1940, state:'solid',  electronegativity:1.28, shells:[2,8,18,32,24,8,2],  desc:'Plutonium is the most consequential transuranic element.' },
    { n:95, sym:'Am', name:'Americium',      mass:243,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f⁷ 7s²',        melt:1176,    boil:2607,    density:13.67,    discovered:1944, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,25,8,2],  desc:'Americium is found in nearly every home in smoke detectors.' },
    { n:96, sym:'Cm', name:'Curium',         mass:247,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f⁷ 6d¹ 7s²',   melt:1345,    boil:3110,    density:13.51,    discovered:1944, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,25,9,2],  desc:'Curium glows red in the dark due to its radioactive decay.' },
    { n:97, sym:'Bk', name:'Berkelium',      mass:247,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f⁹ 7s²',        melt:986,     boil:null,    density:14.78,    discovered:1949, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,27,8,2],  desc:'Berkelium is a radioactive synthetic actinide metal.' },
    { n:98, sym:'Cf', name:'Californium',    mass:251,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f¹⁰ 7s²',       melt:900,     boil:null,    density:15.1,     discovered:1950, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,28,8,2],  desc:'Californium is one of the most potent neutron-emitting radioisotopes known.' },
    { n:99, sym:'Es', name:'Einsteinium',    mass:252,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f¹¹ 7s²',       melt:860,     boil:null,    density:8.84,     discovered:1952, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,29,8,2],  desc:'Einsteinium was first found in the fallout of the first hydrogen bomb.' },
    { n:100,sym:'Fm', name:'Fermium',        mass:257,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f¹² 7s²',       melt:1527,    boil:null,    density:null,     discovered:1952, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,30,8,2],  desc:'Fermium is named after nuclear physicist Enrico Fermi.' },
    { n:101,sym:'Md', name:'Mendelevium',    mass:258,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f¹³ 7s²',       melt:827,     boil:null,    density:null,     discovered:1955, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,31,8,2],  desc:'Mendelevium is named after Dmitri Mendeleev.' },
    { n:102,sym:'No', name:'Nobelium',       mass:259,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f¹⁴ 7s²',       melt:827,     boil:null,    density:null,     discovered:1966, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,32,8,2],  desc:'Nobelium is named after Alfred Nobel.' },
    { n:103,sym:'Lr', name:'Lawrencium',     mass:262,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f¹⁴ 7s² 7p¹',  melt:1627,    boil:null,    density:null,     discovered:1961, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,32,8,3],  desc:'Lawrencium is the last actinide element.' },
    { n:104,sym:'Rf', name:'Rutherfordium',  mass:267,      cat:'transition',     period:7, group:4,  config:'[Rn] 5f¹⁴ 6d² 7s²',  melt:2100,    boil:5500,    density:23.2,     discovered:1964, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,10,2], desc:'Rutherfordium is the first transactinide element.' },
    { n:105,sym:'Db', name:'Dubnium',        mass:268,      cat:'transition',     period:7, group:5,  config:'[Rn] 5f¹⁴ 6d³ 7s²',  melt:null,    boil:null,    density:29.3,     discovered:1968, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,11,2], desc:'Dubnium is named after the Russian research city of Dubna.' },
    { n:106,sym:'Sg', name:'Seaborgium',     mass:271,      cat:'transition',     period:7, group:6,  config:'[Rn] 5f¹⁴ 6d⁴ 7s²',  melt:null,    boil:null,    density:35.0,     discovered:1974, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,12,2], desc:'Seaborgium is named after Glenn Theodore Seaborg.' },
    { n:107,sym:'Bh', name:'Bohrium',        mass:272,      cat:'transition',     period:7, group:7,  config:'[Rn] 5f¹⁴ 6d⁵ 7s²',  melt:null,    boil:null,    density:37.1,     discovered:1981, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,13,2], desc:'Bohrium is named after Niels Bohr.' },
    { n:108,sym:'Hs', name:'Hassium',        mass:277,      cat:'transition',     period:7, group:8,  config:'[Rn] 5f¹⁴ 6d⁶ 7s²',  melt:null,    boil:null,    density:40.7,     discovered:1984, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,14,2], desc:'Hassium is named after the German state of Hesse.' },
    { n:109,sym:'Mt', name:'Meitnerium',     mass:278,      cat:'transition',     period:7, group:9,  config:'[Rn] 5f¹⁴ 6d⁷ 7s²',  melt:null,    boil:null,    density:37.4,     discovered:1982, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,15,2], desc:'Meitnerium is named after Lise Meitner.' },
    { n:110,sym:'Ds', name:'Darmstadtium',   mass:281,      cat:'transition',     period:7, group:10, config:'[Rn] 5f¹⁴ 6d⁸ 7s²',  melt:null,    boil:null,    density:34.8,     discovered:1994, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,16,2], desc:'Darmstadtium is named after the city of Darmstadt.' },
    { n:111,sym:'Rg', name:'Roentgenium',    mass:282,      cat:'transition',     period:7, group:11, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s¹', melt:null,    boil:null,    density:28.7,     discovered:1994, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,17,2], desc:'Roentgenium is named after Wilhelm Röntgen.' },
    { n:112,sym:'Cn', name:'Copernicium',    mass:285,      cat:'transition',     period:7, group:12, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s²', melt:null,    boil:null,    density:23.7,     discovered:1996, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,18,2], desc:'Copernicium is named after the astronomer Nicolaus Copernicus.' },
    { n:113,sym:'Nh', name:'Nihonium',       mass:286,      cat:'post-transition',period:7, group:13, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p¹', melt:null, boil:null,    density:16.0,     discovered:2004, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,18,3], desc:'Nihonium was first synthesised in Japan.' },
    { n:114,sym:'Fl', name:'Flerovium',      mass:289,      cat:'post-transition',period:7, group:14, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p²', melt:null, boil:null,    density:14.0,     discovered:1998, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,18,4], desc:'Flerovium is near the predicted island of stability.' },
    { n:115,sym:'Mc', name:'Moscovium',      mass:290,      cat:'post-transition',period:7, group:15, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p³', melt:null, boil:null,    density:13.5,     discovered:2003, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,18,5], desc:'Moscovium is named after the Moscow Oblast.' },
    { n:116,sym:'Lv', name:'Livermorium',    mass:293,      cat:'post-transition',period:7, group:16, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁴', melt:null, boil:null,    density:12.9,     discovered:2000, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,18,6], desc:'Livermorium is named after Lawrence Livermore National Laboratory.' },
    { n:117,sym:'Ts', name:'Tennessine',     mass:294,      cat:'halogen',        period:7, group:17, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁵', melt:null, boil:null,    density:7.17,     discovered:2010, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,18,7], desc:'Tennessine is named after the state of Tennessee.' },
    { n:118,sym:'Og', name:'Oganesson',      mass:294,      cat:'noble-gas',      period:7, group:18, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁶', melt:null, boil:null,    density:4.95,     discovered:2006, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,18,8], desc:'Oganesson is the heaviest known element.' },
  ];

  /* ══════════════════════════════════════════════════
     CATEGORY COLOURS — vivid, saturated, dramatic
  ══════════════════════════════════════════════════ */

  const CAT_COLORS = {
    'alkali-metal':   { bg:'#FF6B35', text:'#fff', dark_bg:'#FF6B35', dark_text:'#fff', hex:0xFF6B35, emissive:0xFF3300, label:'Alkali Metal' },
    'alkaline-earth': { bg:'#FFB627', text:'#1a0a00', dark_bg:'#FFB627', dark_text:'#1a0a00', hex:0xFFB627, emissive:0xFF8800, label:'Alkaline Earth' },
    'transition':     { bg:'#4CC9F0', text:'#001a26', dark_bg:'#4CC9F0', dark_text:'#001a26', hex:0x4CC9F0, emissive:0x0077AA, label:'Transition Metal' },
    'post-transition':{ bg:'#7B2FBE', text:'#fff', dark_bg:'#7B2FBE', dark_text:'#fff', hex:0x7B2FBE, emissive:0x4A0080, label:'Post-transition' },
    'metalloid':      { bg:'#06D6A0', text:'#002a1e', dark_bg:'#06D6A0', dark_text:'#002a1e', hex:0x06D6A0, emissive:0x008855, label:'Metalloid' },
    'nonmetal':       { bg:'#52B788', text:'#001a0d', dark_bg:'#52B788', dark_text:'#001a0d', hex:0x52B788, emissive:0x1A6644, label:'Nonmetal' },
    'halogen':        { bg:'#80ED99', text:'#001a0d', dark_bg:'#80ED99', dark_text:'#001a0d', hex:0x80ED99, emissive:0x2AAA44, label:'Halogen' },
    'noble-gas':      { bg:'#E040FB', text:'#fff', dark_bg:'#E040FB', dark_text:'#fff', hex:0xE040FB, emissive:0x9900CC, label:'Noble Gas' },
    'lanthanide':     { bg:'#FF8FA3', text:'#3d0010', dark_bg:'#FF8FA3', dark_text:'#3d0010', hex:0xFF8FA3, emissive:0xCC2244, label:'Lanthanide' },
    'actinide':       { bg:'#FF4D6D', text:'#fff', dark_bg:'#FF4D6D', dark_text:'#fff', hex:0xFF4D6D, emissive:0xAA0022, label:'Actinide' },
  };

  const STATE_COLORS = {
    'solid':  { label:'Solid',  color:'#6366f1' },
    'liquid': { label:'Liquid', color:'#0ea5e9' },
    'gas':    { label:'Gas',    color:'#10b981' },
  };

  const CAT_COUNTS = {};
  ELEMENTS.forEach(el => { CAT_COUNTS[el.cat] = (CAT_COUNTS[el.cat] || 0) + 1; });

  function _getPosition(el) {
    if (el.cat === 'lanthanide') return { row:9,  col:3 + (el.n - 57) };
    if (el.cat === 'actinide' && el.n >= 90) return { row:10, col:3 + (el.n - 90) };
    if (el.n === 57) return { row:6, col:3 };
    if (el.n === 89) return { row:7, col:3 };
    const grp = el.group;
    if (!grp) return null;
    return { row:el.period, col:grp };
  }

  /* ══════════════════════════════════════════════════
     MODULE STATE
  ══════════════════════════════════════════════════ */

  let _onBack      = null;
  let _selectedEl  = null;
  let _filterCat   = null;
  let _searchQuery = '';
  let _renderer    = null;
  let _scene       = null;
  let _camera      = null;
  let _controls    = null;
  let _rafId       = null;
  let _tileMeshes  = {};
  let _raycaster   = null;
  let _pointer     = { x: 0, y: 0 };
  let _canvas      = null;
  let _resizeObs   = null;
  let _particleSystem = null;
  let _time        = 0;

  /* ══════════════════════════════════════════════════
     OPEN
  ══════════════════════════════════════════════════ */

  function open(onBackCallback) {
    _onBack      = onBackCallback || null;
    _selectedEl  = null;
    _filterCat   = null;
    _searchQuery = '';
    _render();
    _loadThree(_boot3D);
  }

  /* ══════════════════════════════════════════════════
     HTML SHELL
  ══════════════════════════════════════════════════ */

  function _render() {
    UI.mount(`
      <div id="pt-shell" style="
        display:flex;flex-direction:column;height:100dvh;
        background:#060612;overflow:hidden;
        font-family:var(--font);user-select:none;-webkit-user-select:none;">

        ${_buildTopBar()}

        <!-- Category filter strip -->
        <div id="pt-filters" style="
          flex-shrink:0;display:flex;align-items:center;gap:.35rem;
          padding:.3rem .75rem;border-bottom:1px solid rgba(255,255,255,0.08);
          overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;
          background:rgba(0,0,0,0.4);">
          <button onclick="ThreeDPeriodic._setFilter(null)" id="pt-filter-all"
                  style="flex-shrink:0;font-size:.575rem;font-weight:800;letter-spacing:.05em;
                         text-transform:uppercase;padding:3px 9px;border-radius:99px;
                         border:1px solid #6366f1;background:#6366f1;
                         color:#fff;cursor:pointer;white-space:nowrap;font-family:var(--font);">
            All · 118
          </button>
          ${Object.entries(CAT_COLORS).map(([cat, c]) => `
            <button onclick="ThreeDPeriodic._setFilter('${cat}')" id="pt-filter-${cat}"
                    data-cat="${cat}"
                    style="flex-shrink:0;font-size:.575rem;font-weight:700;letter-spacing:.04em;
                           text-transform:uppercase;padding:3px 9px;border-radius:99px;
                           border:1px solid rgba(255,255,255,0.15);background:${c.bg}22;
                           color:${c.bg};cursor:pointer;white-space:nowrap;
                           font-family:var(--font);transition:all .1s ease;">
              ${c.label} · ${CAT_COUNTS[cat] || 0}
            </button>`).join('')}
        </div>

        <!-- 3D canvas stage -->
        <div id="pt-stage" style="flex:1 1 0;position:relative;overflow:hidden;">
          <canvas id="pt-canvas" style="display:block;width:100%;height:100%;"></canvas>

          <!-- Zoom / reset controls -->
          <div style="position:absolute;right:.5rem;top:50%;transform:translateY(-50%);
                      display:flex;flex-direction:column;gap:.3rem;z-index:10;">
            <button onclick="ThreeDPeriodic._zoom(1.18)"
                    style="width:32px;height:32px;border-radius:8px;
                           background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);
                           font-size:1.2rem;cursor:pointer;color:#fff;backdrop-filter:blur(8px);">+</button>
            <button onclick="ThreeDPeriodic._zoom(0.84)"
                    style="width:32px;height:32px;border-radius:8px;
                           background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);
                           font-size:1.2rem;cursor:pointer;color:#fff;backdrop-filter:blur(8px);">−</button>
            <button onclick="ThreeDPeriodic._resetView()"
                    style="width:32px;height:32px;border-radius:8px;
                           background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);
                           font-size:.65rem;cursor:pointer;color:#fff;font-weight:700;backdrop-filter:blur(8px);">⟳</button>
          </div>

          <!-- Drag hint -->
          <div id="pt-hint" style="position:absolute;bottom:.6rem;left:50%;
               transform:translateX(-50%);font-size:.575rem;font-weight:600;
               letter-spacing:.05em;color:rgba(255,255,255,0.7);text-transform:uppercase;
               pointer-events:none;white-space:nowrap;background:rgba(0,0,0,0.5);
               border:1px solid rgba(255,255,255,0.15);border-radius:99px;padding:4px 12px;
               backdrop-filter:blur(8px);animation:pt-hint-fade 4s ease 1.5s forwards;">
            Drag to orbit · Scroll to zoom · Tap an element
          </div>

          <!-- Loading overlay -->
          <div id="pt-loading" style="position:absolute;inset:0;display:flex;
               align-items:center;justify-content:center;background:#060612;z-index:20;">
            <div style="text-align:center;">
              <div style="font-size:2.5rem;margin-bottom:.75rem;animation:pt-spin 2s linear infinite;display:inline-block;">⚗️</div>
              <div style="font-size:.875rem;color:rgba(255,255,255,0.6);font-weight:600;letter-spacing:.05em;">
                Building 3D Periodic Table…
              </div>
              <div style="margin-top:.5rem;width:120px;height:2px;background:rgba(255,255,255,0.1);border-radius:99px;overflow:hidden;margin-left:auto;margin-right:auto;">
                <div style="width:40%;height:100%;background:#6366f1;border-radius:99px;animation:pt-load 1.2s ease-in-out infinite;"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Element detail panel -->
        <div id="pt-detail" style="
          flex-shrink:0;max-height:0;overflow:hidden;
          transition:max-height .32s cubic-bezier(0.16,1,0.3,1);
          background:#0d0d1a;border-top:1px solid rgba(255,255,255,0.1);
          position:relative;z-index:20;">
          <div id="pt-detail-inner" style="
            padding:.625rem .875rem .875rem;overflow-y:auto;
            -webkit-overflow-scrolling:touch;max-height:55dvh;box-sizing:border-box;">
          </div>
        </div>
      </div>

      <style>
        @keyframes pt-hint-fade { 0%,70%{opacity:1}100%{opacity:0;pointer-events:none} }
        @keyframes pt-spin { to { transform: rotate(360deg); } }
        @keyframes pt-load { 0%{transform:translateX(-100%)}100%{transform:translateX(350%)} }
        #pt-filters::-webkit-scrollbar { display:none; }
        #pt-shell * { box-sizing: border-box; }
      </style>`);
  }

  function _buildTopBar() {
    return `
      <div style="display:flex;align-items:center;gap:.5rem;padding:.4rem .75rem;
                  border-bottom:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.6);
                  flex-shrink:0;min-height:2.75rem;backdrop-filter:blur(12px);">
        <button onclick="ThreeDPeriodic._back()"
                style="display:inline-flex;align-items:center;font-size:var(--text-sm);
                       font-weight:500;color:rgba(255,255,255,0.8);background:rgba(255,255,255,0.08);
                       border:1px solid rgba(255,255,255,0.15);border-radius:var(--r-md);
                       padding:.275rem .6rem;cursor:pointer;font-family:var(--font);flex-shrink:0;">← Back</button>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--text-base);font-weight:700;color:#fff;
                      letter-spacing:-.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ⚗️ Periodic Table
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:.3rem;flex-shrink:0;
                    border:1px solid rgba(255,255,255,0.15);border-radius:var(--r-md);
                    background:rgba(255,255,255,0.08);padding:.275rem .5rem;width:130px;box-sizing:border-box;">
          <svg style="flex-shrink:0;color:rgba(255,255,255,0.4);" width="12" height="12"
               viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input id="pt-search" type="text" placeholder="Search…"
                 oninput="ThreeDPeriodic._onSearch(this.value)"
                 style="border:none!important;outline:none!important;background:transparent!important;
                        font-size:var(--text-xs)!important;color:#fff!important;
                        font-family:var(--font)!important;width:100%!important;padding:0!important;margin:0!important;" />
        </div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════
     THREE.JS BOOTSTRAP — DRAMATIC DARK SPACE SCENE
  ══════════════════════════════════════════════════ */

  function _boot3D() {
    const THREE = window.THREE;
    _canvas = document.getElementById('pt-canvas');
    if (!_canvas) return;

    const wrap = document.getElementById('pt-stage');
    const W = wrap.clientWidth  || 800;
    const H = wrap.clientHeight || 500;

    /* ── Renderer ── */
    _renderer = new THREE.WebGLRenderer({ canvas: _canvas, antialias: true, alpha: false });
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _renderer.setSize(W, H);
    _renderer.setClearColor(0x060612, 1);
    _renderer.shadowMap.enabled = true;
    _renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    _renderer.toneMapping = THREE.ACESFilmicToneMapping;
    _renderer.toneMappingExposure = 1.2;

    /* ── Scene ── */
    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0x060612);
    _scene.fog = new THREE.FogExp2(0x060612, 0.008);

    /* ── Camera — dramatic low angle ── */
    _camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 2000);
    _camera.position.set(0, -8, 110);

    /* ── Lights — cinematic setup ── */
    // Ambient — dark, mostly from scene fog
    const ambient = new THREE.AmbientLight(0x111133, 0.8);
    _scene.add(ambient);

    // Key light — top front, cool white
    const key = new THREE.DirectionalLight(0xaabbff, 1.4);
    key.position.set(20, 60, 80);
    key.castShadow = true;
    key.shadow.mapSize.width = 2048;
    key.shadow.mapSize.height = 2048;
    _scene.add(key);

    // Fill light — warm, from below left
    const fill = new THREE.PointLight(0xff6633, 0.6, 300);
    fill.position.set(-80, -40, 50);
    _scene.add(fill);

    // Rim light — right side, blue
    const rim = new THREE.PointLight(0x4466ff, 0.8, 400);
    rim.position.set(80, 30, -20);
    _scene.add(rim);

    // Top glow
    const top = new THREE.PointLight(0x9933ff, 0.4, 500);
    top.position.set(0, 80, 0);
    _scene.add(top);

    /* ── Stars background ── */
    _addStars(THREE);

    /* ── Nebula particles ── */
    _addNebula(THREE);

    /* ── OrbitControls ── */
    _controls = new THREE.OrbitControls(_camera, _renderer.domElement);
    _controls.enableDamping   = true;
    _controls.dampingFactor   = 0.06;
    _controls.enablePan       = true;
    _controls.panSpeed        = 1.0;
    _controls.minDistance     = 25;
    _controls.maxDistance     = 280;
    _controls.maxPolarAngle   = Math.PI * 0.75;
    _controls.autoRotate      = false;
    _controls.target.set(0, -5, 0);

    /* ── Raycaster ── */
    _raycaster = new THREE.Raycaster();

    /* ── Build tiles ── */
    _buildAllTiles();

    /* ── Events ── */
    _canvas.addEventListener('pointerup', _onPointerUp);
    _canvas.addEventListener('touchend',  _onPointerUp, { passive: true });

    /* ── Resize observer ── */
    _resizeObs = new ResizeObserver(() => {
      if (!wrap.clientWidth) return;
      const nW = wrap.clientWidth;
      const nH = wrap.clientHeight;
      _renderer.setSize(nW, nH);
      _camera.aspect = nW / nH;
      _camera.updateProjectionMatrix();
    });
    _resizeObs.observe(wrap);

    /* ── Hide loading overlay ── */
    const loading = document.getElementById('pt-loading');
    if (loading) {
      loading.style.transition = 'opacity 0.5s ease';
      loading.style.opacity = '0';
      setTimeout(() => { if (loading) loading.style.display = 'none'; }, 500);
    }

    /* ── Animate ── */
    _animate();
  }

  function _addStars(THREE) {
    const geo  = new THREE.BufferGeometry();
    const count = 1200;
    const pos  = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 600;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 400;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 200 - 50;
      sizes[i] = Math.random() * 2 + 0.5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.5,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    });
    _scene.add(new THREE.Points(geo, mat));
  }

  function _addNebula(THREE) {
    // Coloured cloud particles behind the table
    const colors = [0x6633ff, 0xff3366, 0x33aaff, 0xff6600];
    colors.forEach((col, ci) => {
      const geo = new THREE.BufferGeometry();
      const count = 200;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3]     = (Math.random() - 0.5) * 220 + (ci % 2 === 0 ? -40 : 40);
        pos[i * 3 + 1] = (Math.random() - 0.5) * 120;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 30 - 20;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: col,
        size: 1.2,
        transparent: true,
        opacity: 0.15,
        sizeAttenuation: true,
      });
      _scene.add(new THREE.Points(geo, mat));
    });
  }

  /* ══════════════════════════════════════════════════
     TILE TEXTURE GENERATOR — vivid, high-contrast
  ══════════════════════════════════════════════════ */

  function _makeTileTexture(el, highlighted, dimmed) {
    const THREE = window.THREE;
    const catC  = CAT_COLORS[el.cat] || CAT_COLORS['transition'];

    const SIZE = 256; // Higher resolution for clarity
    const cv   = document.createElement('canvas');
    cv.width = cv.height = SIZE;
    const ctx = cv.getContext('2d');

    // Background — solid vivid colour
    if (highlighted) {
      // Selected: bright white
      const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#e8e8ff');
      ctx.fillStyle = grad;
    } else if (dimmed) {
      ctx.fillStyle = '#0a0a1a';
    } else {
      // Normal: vivid category colour with gradient
      const hex = catC.bg;
      ctx.fillStyle = hex;
      // Subtle gradient overlay
      const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
      grad.addColorStop(0, 'rgba(255,255,255,0.25)');
      grad.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = grad;
    }
    ctx.fillRect(0, 0, SIZE, SIZE);

    if (!highlighted && !dimmed) {
      // Inner glow effect
      const glow = ctx.createRadialGradient(SIZE/2, SIZE/2, 0, SIZE/2, SIZE/2, SIZE/2);
      glow.addColorStop(0, 'rgba(255,255,255,0.18)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, SIZE, SIZE);
    }

    // Border
    if (highlighted) {
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 10;
    } else if (dimmed) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 3;
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 4;
    }
    ctx.strokeRect(4, 4, SIZE - 8, SIZE - 8);

    // Text colours
    const textCol = highlighted
      ? '#3730a3'
      : dimmed
        ? 'rgba(255,255,255,0.2)'
        : catC.text;

    // Atomic number (top-left)
    ctx.fillStyle = highlighted
      ? '#4338ca'
      : dimmed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(el.n), 10, 38);

    // Symbol (centre, large)
    ctx.font = 'bold 100px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = highlighted
      ? '#312e81'
      : dimmed ? 'rgba(255,255,255,0.15)' : '#ffffff';
    // Shadow for depth
    if (!dimmed) {
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    }
    ctx.fillText(el.sym, SIZE / 2, SIZE / 2 + 36);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Name (bottom)
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = highlighted
      ? '#4338ca'
      : dimmed ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.85)';
    const shortName = el.name.length > 10 ? el.name.slice(0, 9) + '.' : el.name;
    ctx.fillText(shortName, SIZE / 2, SIZE - 14);

    // Mass (bottom-right tiny)
    if (!dimmed) {
      ctx.font = '18px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'right';
      ctx.fillText(el.mass, SIZE - 8, 28);
    }

    const tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  /* ══════════════════════════════════════════════════
     BUILD ALL TILES — dramatic 3D with depth & glow
  ══════════════════════════════════════════════════ */

  function _buildAllTiles() {
    const THREE = window.THREE;

    const TILE_W  = 3.8;
    const TILE_H  = 4.0;
    const TILE_D  = 0.55; // Thicker for 3D feel
    const GAP     = 0.20;
    const STEP_X  = TILE_W + GAP;
    const STEP_Y  = TILE_H + GAP;
    const COLS    = 18;
    const ROWS    = 10;

    const originX = -((COLS - 1) * STEP_X) / 2;
    const originY =  ((ROWS - 1) * STEP_Y) / 2;

    ELEMENTS.forEach(el => {
      const pos = _getPosition(el);
      if (!pos) return;

      const catC = CAT_COLORS[el.cat] || CAT_COLORS['transition'];

      const x = originX + (pos.col - 1) * STEP_X;
      const rowY = pos.row <= 8
        ? -(pos.row - 1) * STEP_Y
        : -(pos.row - 1) * STEP_Y - STEP_Y * 0.6;
      const y = originY + rowY;

      // Unique Z offset per element for floating depth effect
      const baseZ = Math.sin(el.n * 0.42) * 0.8 + Math.cos(el.n * 0.27) * 0.5;

      const geo = new THREE.BoxGeometry(TILE_W, TILE_H, TILE_D);

      const faceTex = _makeTileTexture(el, false, false);

      // Front face: textured
      // Side faces: solid vivid colour with slight metallic sheen
      const sideColor = new THREE.Color(catC.bg).multiplyScalar(0.5);

      const mats = [
        new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.3, metalness: 0.7 }), // +X
        new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.3, metalness: 0.7 }), // -X
        new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.3, metalness: 0.7 }), // +Y
        new THREE.MeshStandardMaterial({ color: new THREE.Color(catC.bg).multiplyScalar(0.3), roughness: 0.5, metalness: 0.5 }), // -Y
        new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.2, metalness: 0.0, emissive: new THREE.Color(catC.emissive), emissiveIntensity: 0.08 }), // +Z front
        new THREE.MeshStandardMaterial({ color: new THREE.Color(catC.bg).multiplyScalar(0.2), roughness: 0.6, metalness: 0.4 }), // -Z back
      ];

      const mesh = new THREE.Mesh(geo, mats);
      mesh.position.set(x, y, baseZ);
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      mesh.userData.el   = el;
      mesh.userData.baseZ = baseZ;
      mesh.userData.baseX = x;
      mesh.userData.baseY = y;
      mesh.userData.floatOffset = Math.random() * Math.PI * 2; // random phase for float

      _scene.add(mesh);
      _tileMeshes[el.n] = mesh;
    });
  }

  /* ══════════════════════════════════════════════════
     ANIMATION LOOP — with float & pulse effects
  ══════════════════════════════════════════════════ */

  function _animate() {
    _rafId = requestAnimationFrame(_animate);
    _time += 0.016;
    _controls.update();

    // Subtle float animation on all tiles
    Object.values(_tileMeshes).forEach(mesh => {
      const el    = mesh.userData.el;
      const catC  = CAT_COLORS[el.cat] || CAT_COLORS['transition'];
      const phase = mesh.userData.floatOffset;
      const isSelected = _selectedEl && el.n === _selectedEl.n;

      // Float Z
      if (!isSelected) {
        mesh.position.z = mesh.userData.baseZ + Math.sin(_time * 0.7 + phase) * 0.15;
      }

      // Pulse emissive on front face
      if (Array.isArray(mesh.material) && mesh.material[4]) {
        const pulse = Math.sin(_time * 1.5 + phase) * 0.04 + 0.08;
        mesh.material[4].emissiveIntensity = isSelected ? 0.4 : pulse;
      }
    });

    _renderer.render(_scene, _camera);
  }

  /* ══════════════════════════════════════════════════
     RAYCASTING / SELECTION
  ══════════════════════════════════════════════════ */

  let _isDragging = false;
  let _pointerDownX = 0;
  let _pointerDownY = 0;

  function _onPointerUp(e) {
    const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

    // Ignore if it was a drag
    if (Math.abs(cx - _pointerDownX) > 8 || Math.abs(cy - _pointerDownY) > 8) return;

    const rect = _canvas.getBoundingClientRect();
    _pointer.x =  ((cx - rect.left) / rect.width)  * 2 - 1;
    _pointer.y = -((cy - rect.top)  / rect.height) * 2 + 1;

    _raycaster.setFromCamera(_pointer, _camera);
    const meshes = Object.values(_tileMeshes);
    const hits   = _raycaster.intersectObjects(meshes, false);
    if (hits.length > 0) {
      const hit = hits[0].object;
      if (hit.userData.el) _selectElement(hit.userData.el.n);
    } else {
      _deselectElement();
    }
  }

  // Track pointer down for drag detection
  function _onPointerDown(e) {
    const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    _pointerDownX = cx;
    _pointerDownY = cy;
  }

  /* ══════════════════════════════════════════════════
     SELECT / DESELECT — dramatic pop effect
  ══════════════════════════════════════════════════ */

  function _selectElement(n) {
    const el = ELEMENTS.find(e => e.n === n);
    if (!el) return;
    _selectedEl = el;
    _updateTileVisuals();
    _showDetailPanel(el);
  }

  function _deselectElement() {
    _selectedEl = null;
    _updateTileVisuals();
    const panel = document.getElementById('pt-detail');
    if (panel) panel.style.maxHeight = '0';
  }

  function _updateTileVisuals() {
    const THREE  = window.THREE;

    Object.values(_tileMeshes).forEach(mesh => {
      const el    = mesh.userData.el;
      const catC  = CAT_COLORS[el.cat] || CAT_COLORS['transition'];

      let passes = true;
      if (_filterCat)    passes = (el.cat === _filterCat);
      if (_searchQuery && passes) {
        passes = (
          el.sym.toLowerCase().includes(_searchQuery)  ||
          el.name.toLowerCase().includes(_searchQuery) ||
          String(el.n).includes(_searchQuery)          ||
          (CAT_COLORS[el.cat]?.label || '').toLowerCase().includes(_searchQuery)
        );
      }

      const selected    = _selectedEl && el.n === _selectedEl.n;
      const highlighted = selected;
      const dimmed      = !passes || (_selectedEl && !selected);

      // Rebuild face texture
      const newTex = _makeTileTexture(el, highlighted, dimmed && !selected);
      if (Array.isArray(mesh.material)) {
        if (mesh.material[4].map) mesh.material[4].map.dispose();
        mesh.material[4].map = newTex;
        mesh.material[4].needsUpdate = true;
      }

      // Side colours
      const sideBase = new THREE.Color(catC.bg);
      const sideMult = dimmed && !selected ? 0.08 : highlighted ? 1.0 : 0.5;
      const sideCol  = sideBase.clone().multiplyScalar(sideMult);

      for (let f = 0; f < 6; f++) {
        if (f === 4) continue;
        if (Array.isArray(mesh.material)) {
          mesh.material[f].color.set(sideCol);
          mesh.material[f].emissiveIntensity = 0;
        }
      }

      // Pop selected tile forward dramatically
      if (selected) {
        mesh.position.z = mesh.userData.baseZ + 4.0;
        mesh.position.y = mesh.userData.baseY + 0.5;
        mesh.scale.set(1.12, 1.12, 1.12);
      } else if (dimmed) {
        mesh.position.z = mesh.userData.baseZ;
        mesh.position.y = mesh.userData.baseY;
        mesh.scale.set(0.95, 0.95, 0.95);
      } else {
        mesh.position.z = mesh.userData.baseZ;
        mesh.position.y = mesh.userData.baseY;
        mesh.scale.set(1, 1, 1);
      }

      // Emissive glow
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m, fi) => {
          if (!m.emissive) return;
          if (fi === 4) {
            m.emissive.setHex(selected ? 0x4444ff : catC.emissive);
            m.emissiveIntensity = selected ? 0.5 : (dimmed && !selected) ? 0 : 0.08;
          } else {
            m.emissive = m.emissive || new THREE.Color(0);
            m.emissive.setHex(selected ? 0x2233aa : 0x000000);
            m.emissiveIntensity = selected ? 0.3 : 0;
          }
        });
      }
    });
  }

  /* ══════════════════════════════════════════════════
     FILTER + SEARCH
  ══════════════════════════════════════════════════ */

  function _setFilter(cat) {
    _filterCat   = cat;
    _searchQuery = '';
    _selectedEl  = null;
    const searchEl = document.getElementById('pt-search');
    if (searchEl) searchEl.value = '';
    const panel = document.getElementById('pt-detail');
    if (panel) panel.style.maxHeight = '0';
    _updateTileVisuals();
    _updateFilterButtons(cat);
  }

  function _onSearch(query) {
    _searchQuery = query.toLowerCase().trim();
    _filterCat   = null;
    _selectedEl  = null;
    const panel  = document.getElementById('pt-detail');
    if (panel) panel.style.maxHeight = '0';
    _updateTileVisuals();
    _updateFilterButtons(null);

    if (_searchQuery.length >= 1) {
      const exact = ELEMENTS.find(el =>
        el.sym.toLowerCase()  === _searchQuery ||
        el.name.toLowerCase() === _searchQuery ||
        String(el.n)          === _searchQuery
      );
      if (exact) _selectElement(exact.n);
    }
  }

  function _updateFilterButtons(activeCat) {
    const allBtn = document.getElementById('pt-filter-all');
    const isAll  = activeCat === null && _searchQuery === '';
    if (allBtn) {
      allBtn.style.background  = isAll ? '#6366f1' : 'rgba(99,102,241,0.15)';
      allBtn.style.color       = isAll ? '#fff'    : '#6366f1';
      allBtn.style.borderColor = isAll ? '#6366f1' : 'rgba(99,102,241,0.3)';
    }
    Object.keys(CAT_COLORS).forEach(cat => {
      const btn = document.getElementById(`pt-filter-${cat}`);
      if (!btn) return;
      const c      = CAT_COLORS[cat];
      const active = cat === activeCat;
      btn.style.background  = active ? c.bg  : `${c.bg}22`;
      btn.style.color       = active ? c.text : c.bg;
      btn.style.borderColor = active ? c.bg   : `${c.bg}44`;
      btn.style.fontWeight  = active ? '800' : '700';
    });
  }

  /* ══════════════════════════════════════════════════
     CAMERA CONTROLS
  ══════════════════════════════════════════════════ */

  function _zoom(factor) {
    const dist = _camera.position.distanceTo(_controls.target);
    const newD = Math.max(25, Math.min(280, dist / factor));
    const dir  = _camera.position.clone().sub(_controls.target).normalize();
    _camera.position.copy(_controls.target).addScaledVector(dir, newD);
  }

  function _resetView() {
    _camera.position.set(0, -8, 110);
    _controls.target.set(0, -5, 0);
    _controls.update();
  }

  /* ══════════════════════════════════════════════════
     DETAIL PANEL — dark theme to match
  ══════════════════════════════════════════════════ */

  function _showDetailPanel(el) {
    const panel = document.getElementById('pt-detail');
    const inner = document.getElementById('pt-detail-inner');
    if (!panel || !inner) return;

    const colors    = CAT_COLORS[el.cat] || CAT_COLORS['transition'];
    const bg        = colors.bg;
    const fg        = colors.text;
    const fmtT      = v => v === null ? '—' : v + ' °C';
    const fmtY      = v => v === null ? 'Ancient / Unknown' : v;
    const stateInfo = el.state ? STATE_COLORS[el.state] : null;

    const shellDots = (el.shells || []).map((count, i) => {
      const shellNames = ['K','L','M','N','O','P','Q'];
      return `<div style="display:flex;align-items:center;gap:3px;">
        <span style="font-size:.5rem;color:rgba(255,255,255,0.4);font-weight:700;width:8px;">${shellNames[i]||''}</span>
        <div style="display:flex;gap:2px;flex-wrap:wrap;max-width:80px;">
          ${Array.from({length:Math.min(count,18)}).map(() =>
            `<div style="width:5px;height:5px;border-radius:50%;background:${bg};opacity:0.9;flex-shrink:0;box-shadow:0 0 3px ${bg};"></div>`
          ).join('')}
        </div>
        <span style="font-size:.5rem;color:rgba(255,255,255,0.5);margin-left:2px;">${count}</span>
      </div>`;
    }).join('');

    inner.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:.625rem;margin-bottom:.5rem;">
        <div style="width:58px;height:58px;border-radius:10px;flex-shrink:0;
                    background:${bg};border:2px solid ${bg};
                    display:flex;flex-direction:column;align-items:center;
                    justify-content:center;position:relative;
                    box-shadow:0 0 20px ${bg}88,0 4px 12px rgba(0,0,0,0.5);">
          <div style="font-size:7.5px;font-weight:700;color:${fg};opacity:.9;line-height:1;">${el.n}</div>
          <div style="font-size:20px;font-weight:800;color:${fg};line-height:1.1;text-shadow:0 1px 4px rgba(0,0,0,0.5);">${el.sym}</div>
          ${stateInfo ? `<div style="position:absolute;top:3px;right:3px;width:6px;height:6px;
                                     border-radius:50%;background:${stateInfo.color};
                                     box-shadow:0 0 6px ${stateInfo.color};"></div>` : ''}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:.375rem;flex-wrap:wrap;margin-bottom:2px;">
            <h2 style="font-size:var(--text-md);font-weight:800;color:#fff;margin:0;
                       letter-spacing:-.02em;">${el.name}</h2>
            <span style="font-size:.55rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
                         padding:2px 7px;border-radius:99px;background:${bg}33;color:${bg};
                         border:1px solid ${bg}66;flex-shrink:0;">
              ${colors.label}
            </span>
            ${stateInfo ? `<span style="font-size:.55rem;font-weight:700;letter-spacing:.04em;
                             text-transform:uppercase;padding:2px 7px;border-radius:99px;
                             background:${stateInfo.color}22;color:${stateInfo.color};
                             flex-shrink:0;border:1px solid ${stateInfo.color}44;">
                ${stateInfo.label}</span>` : ''}
          </div>
          <div style="font-size:var(--text-xs);color:rgba(255,255,255,0.5);line-height:1.6;">
            Mass <strong style="color:rgba(255,255,255,0.9);">${el.mass}</strong> u
            · Period <strong style="color:rgba(255,255,255,0.9);">${el.period}</strong>
            ${el.group ? `· Group <strong style="color:rgba(255,255,255,0.9);">${el.group}</strong>` : ''}
            · Discovered <strong style="color:rgba(255,255,255,0.9);">${fmtY(el.discovered)}</strong>
          </div>
          <div style="font-size:var(--text-xs);color:rgba(255,255,255,0.4);">
            ${el.electronegativity !== null
              ? `EN <strong style="color:rgba(255,255,255,0.8);">${el.electronegativity}</strong> (Pauling)`
              : '<em style="color:rgba(255,255,255,0.25);">Noble gas — no EN</em>'}
          </div>
          <div style="font-size:.6rem;color:${bg};margin-top:1px;font-family:var(--font-mono);">
            ${el.config}
          </div>
        </div>
        <button onclick="ThreeDPeriodic._deselectElement()"
                style="flex-shrink:0;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);
                       cursor:pointer;font-size:1rem;line-height:1;padding:4px 8px;color:rgba(255,255,255,0.5);
                       border-radius:6px;">×</button>
      </div>

      ${el.shells && el.shells.length ? `
      <div style="display:flex;align-items:flex-start;gap:.5rem;margin-bottom:.5rem;
                  background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
                  border-radius:8px;padding:.35rem .5rem;">
        <div style="font-size:.5rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;
                    color:rgba(255,255,255,0.3);white-space:nowrap;margin-top:1px;flex-shrink:0;">
          Electron<br>Shells
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;flex:1;">${shellDots}</div>
        <div style="font-size:.5rem;color:rgba(255,255,255,0.3);white-space:nowrap;margin-top:1px;">
          Total: <strong style="color:rgba(255,255,255,0.8);">${el.n}</strong> e⁻
        </div>
      </div>` : ''}

      <p style="font-size:var(--text-sm);color:rgba(255,255,255,0.7);line-height:1.65;
                margin-bottom:.5rem;border-left:3px solid ${bg};padding-left:.5rem;
                box-shadow:-3px 0 12px ${bg}44;">
        ${el.desc}
      </p>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.275rem;">
        ${_propBadge('Melting Pt', fmtT(el.melt), bg)}
        ${_propBadge('Boiling Pt', fmtT(el.boil), bg)}
        ${_propBadge('Density',    el.density !== null ? el.density + ' g/cm³' : '—', bg)}
      </div>`;

    panel.style.maxHeight = '55dvh';
  }

  function _propBadge(label, value, accent) {
    return `
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
                  border-radius:6px;padding:.225rem .4rem;border-top:2px solid ${accent}66;">
        <div style="font-size:.5rem;font-weight:700;text-transform:uppercase;
                    letter-spacing:.04em;color:${accent};margin-bottom:1px;">${label}</div>
        <div style="font-size:var(--text-xs);font-weight:600;color:rgba(255,255,255,0.8);">${value}</div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════
     CLEANUP
  ══════════════════════════════════════════════════ */

  function _destroy() {
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    if (_resizeObs) { _resizeObs.disconnect(); _resizeObs = null; }
    if (_canvas) {
      _canvas.removeEventListener('pointerup', _onPointerUp);
      _canvas.removeEventListener('touchend',  _onPointerUp);
      _canvas.removeEventListener('pointerdown', _onPointerDown);
      _canvas.removeEventListener('touchstart', _onPointerDown);
    }
    if (_controls) { _controls.dispose(); _controls = null; }
    if (_scene) {
      _scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
        }
      });
      _scene = null;
    }
    if (_renderer) { _renderer.dispose(); _renderer = null; }
    _tileMeshes = {};
  }

  function _back() {
    _destroy();
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
