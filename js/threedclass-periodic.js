/* ============================================================
   js/threedclass-periodic.js — Interactive 3D Periodic Table
   ============================================================ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════
     THREE.JS LOADER
  ══════════════════════════════════════════════════ */

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
    { n:21, sym:'Sc', name:'Scandium',       mass:44.956,   cat:'transition',     period:4, group:3,  config:'[Ar] 3d¹ 4s²',         melt:1541,    boil:2836,    density:2.985,    discovered:1879, state:'solid',  electronegativity:1.36, shells:[2,8,9,2],     desc:'Scandium is a rare, silvery-white transition metal that was predicted by Mendeleev before it was discovered, and its properties matched his predictions remarkably well. Though classified as a rare earth element, it is actually more abundant than lead — but is widely dispersed in tiny amounts in many minerals rather than concentrated in economically useful ores. Scandium is most famous for its use in aluminium-scandium alloys, which are significantly stronger and lighter than ordinary aluminium alloys. These are used in aerospace structures, sports equipment (bicycle frames, baseball bats, lacrosse sticks), and military aircraft. Scandium iodide added to mercury vapour lamps produces a light very close to natural sunlight.' },
    { n:22, sym:'Ti', name:'Titanium',       mass:47.867,   cat:'transition',     period:4, group:4,  config:'[Ar] 3d² 4s²',         melt:1668,    boil:3287,    density:4.506,    discovered:1791, state:'solid',  electronegativity:1.54, shells:[2,8,10,2],    desc:'Titanium is a strong, lustrous, silver-grey metal with a remarkable combination of properties: it is as strong as steel but 45% lighter, has the highest strength-to-weight ratio of any metal, and is exceptionally corrosion-resistant — even seawater, aqua regia, and chlorine cannot corrode it easily. It is biocompatible (non-toxic to the human body), making it the material of choice for medical implants including hip replacements, dental implants, and surgical tools. Titanium is used extensively in aircraft, spacecraft, naval vessels, and armour plating. Titanium dioxide (TiO₂) is the world\'s most widely used white pigment, found in white paints, sunscreens, toothpaste, and food colouring (E171).' },
    { n:23, sym:'V',  name:'Vanadium',       mass:50.942,   cat:'transition',     period:4, group:5,  config:'[Ar] 3d³ 4s²',         melt:1910,    boil:3407,    density:6.0,      discovered:1801, state:'solid',  electronegativity:1.63, shells:[2,8,11,2],    desc:'Vanadium is a hard, steely-grey transition metal with excellent resistance to corrosion by alkalis, acids, and saltwater. It was named after Vanadis, a Norse goddess of beauty, because of the beautiful multi-coloured compounds it forms. About 85% of vanadium produced is used to make high-strength steel alloys — a tiny amount (less than 1%) dramatically increases strength, making it ideal for tools, springs, and car parts. Vanadium redox batteries are a promising large-scale energy storage technology for grid-level use alongside wind and solar power. Vanadium compounds also show potential as insulin-mimicking agents in treating type 2 diabetes. It is an essential trace element for some organisms, including sea squirts.' },
    { n:24, sym:'Cr', name:'Chromium',       mass:51.996,   cat:'transition',     period:4, group:6,  config:'[Ar] 3d⁵ 4s¹',         melt:1907,    boil:2671,    density:7.15,     discovered:1797, state:'solid',  electronegativity:1.66, shells:[2,8,13,1],    desc:'Chromium is a hard, shiny, grey metal and the world\'s most widely recycled element after iron and aluminium. Its name comes from the Greek word "chroma" (colour) because its compounds display a vivid range of colours — rubies are red and emeralds are green because of chromium impurities. Its most important use is in making stainless steel (combined with iron and nickel), which resists corrosion due to a thin self-healing chromium oxide layer on its surface. Chrome plating — a thin layer of chromium deposited by electroplating — is used on car parts, taps, and tools for both appearance and protection. Chromium(III) is an essential trace element that helps insulin regulate blood sugar, but hexavalent chromium(VI) is highly toxic and carcinogenic.' },
    { n:25, sym:'Mn', name:'Manganese',      mass:54.938,   cat:'transition',     period:4, group:7,  config:'[Ar] 3d⁵ 4s²',         melt:1246,    boil:2061,    density:7.44,     discovered:1774, state:'solid',  electronegativity:1.55, shells:[2,8,13,2],    desc:'Manganese is a hard, brittle, silvery-grey metal that is never found in pure form in nature. About 90% of manganese is used in steel production — adding manganese removes sulfur and oxygen impurities and makes steel harder and more resistant to impacts. It is an essential trace element for all living organisms: humans need it for bone formation, enzyme function, and antioxidant defences (manganese superoxide dismutase protects cells from damage). Manganese dioxide (MnO₂) is used in dry cell batteries (the common AA and AAA types) as the cathode material. Permanganate (KMnO₄) is a powerful purple oxidising agent used in water treatment and as a disinfectant. Vast deposits of manganese nodules litter the deep ocean floor.' },
    { n:26, sym:'Fe', name:'Iron',           mass:55.845,   cat:'transition',     period:4, group:8,  config:'[Ar] 3d⁶ 4s²',         melt:1538,    boil:2861,    density:7.874,    discovered:null, state:'solid',  electronegativity:1.83, shells:[2,8,14,2],    desc:'Iron is the most abundant element on Earth by mass (forming most of the planet\'s core) and the fourth most abundant in the Earth\'s crust. It is the backbone of human civilisation — the Iron Age began around 1200 BCE when humans learned to smelt iron ore into tools and weapons. Today, about 2.5 billion tonnes of steel (mostly iron) are produced annually for construction, manufacturing, and transport. Iron is essential to life: haemoglobin in red blood cells contains iron at its core, which binds oxygen and carries it through the bloodstream. Without enough iron, the body cannot make enough red blood cells — this is the most common nutritional deficiency worldwide, causing anaemia. Meteorites are rich in iron-nickel alloys.' },
    { n:27, sym:'Co', name:'Cobalt',         mass:58.933,   cat:'transition',     period:4, group:9,  config:'[Ar] 3d⁷ 4s²',         melt:1495,    boil:2927,    density:8.9,      discovered:1735, state:'solid',  electronegativity:1.88, shells:[2,8,15,2],    desc:'Cobalt is a hard, lustrous, bluish-grey metal with a long history — cobalt compounds have been used to colour glass and ceramics an intense blue for thousands of years (seen in ancient Egyptian artefacts). Cobalt is magnetic and retains its magnetism at higher temperatures than iron. Today, its most critical use is in lithium-ion battery cathodes (smartphones, EVs, laptops) — about 60% of global cobalt comes from the Democratic Republic of Congo, making supply chain ethics a significant concern. Cobalt is also used in superalloys for jet engine turbine blades. Vitamin B12, essential for nerve function and DNA synthesis, is the only vitamin that contains a metal atom — cobalt — at its centre. Radioactive cobalt-60 is used in cancer radiotherapy and food irradiation.' },
    { n:28, sym:'Ni', name:'Nickel',         mass:58.693,   cat:'transition',     period:4, group:10, config:'[Ar] 3d⁸ 4s²',         melt:1455,    boil:2913,    density:8.908,    discovered:1751, state:'solid',  electronegativity:1.91, shells:[2,8,16,2],    desc:'Nickel is a hard, silvery-white, magnetic metal with excellent corrosion resistance, especially in alkaline environments. Its name comes from the German "Kupfernickel" (copper nickel or "Old Nick\'s copper") because miners thought it contained copper but couldn\'t extract it. About 68% of nickel production goes into stainless steel alloys. Nickel is increasingly important for energy storage — nickel-metal hydride (NiMH) batteries power hybrid cars, and nickel is a key component of next-generation EV batteries. Nickel coins (like the US 5-cent piece) actually contain very little nickel — mostly copper. Nickel is also an essential trace element for some plant enzymes. The Earth\'s core is thought to be largely iron-nickel alloy.' },
    { n:29, sym:'Cu', name:'Copper',         mass:63.546,   cat:'transition',     period:4, group:11, config:'[Ar] 3d¹⁰ 4s¹',        melt:1084.62, boil:2562,    density:8.96,     discovered:null, state:'solid',  electronegativity:1.90, shells:[2,8,18,1],    desc:'Copper is one of the few metals found in pure form in nature and was the first metal worked by humans over 10,000 years ago — the Bronze Age began when copper was alloyed with tin. Copper has the highest electrical conductivity of any non-precious metal, which is why almost all electrical wiring in buildings, motors, and electronics is made from it. It is also an excellent heat conductor, used in cookware, heat exchangers, and radiators. Copper is naturally antimicrobial — bacteria and viruses die on copper surfaces within hours — which is why hospitals use copper alloys for door handles and railings. It is an essential trace element; haemocyanin in crabs and octopuses uses copper instead of iron to carry oxygen, giving their blood a blue colour.' },
    { n:30, sym:'Zn', name:'Zinc',           mass:65.38,    cat:'transition',     period:4, group:12, config:'[Ar] 3d¹⁰ 4s²',        melt:419.53,  boil:907,     density:7.134,    discovered:1746, state:'solid',  electronegativity:1.65, shells:[2,8,18,2],    desc:'Zinc is a bluish-white metal that is brittle at room temperature but becomes malleable when heated. Its most important use is in galvanising — coating steel or iron with a thin layer of zinc to prevent rusting. This works because zinc is more reactive than iron, so it corrodes preferentially, sacrificing itself to protect the underlying metal (cathodic protection). Zinc is combined with copper to make brass. Zinc oxide (ZnO) is used in sunscreens (the white paste lifeguards wear), rubber tyres, and as a white pigment. Zinc is an essential mineral for the human immune system, wound healing, taste and smell, and over 300 enzyme reactions. Zinc deficiency affects nearly 2 billion people worldwide and impairs growth and immune function.' },
    { n:31, sym:'Ga', name:'Gallium',        mass:69.723,   cat:'post-transition',period:4, group:13, config:'[Ar] 3d¹⁰ 4s² 4p¹',   melt:29.76,   boil:2229,    density:5.907,    discovered:1875, state:'solid',  electronegativity:1.81, shells:[2,8,18,3],    desc:'Gallium is a fascinating soft, silvery metal with a melting point so low (29.76 °C) that it melts in the palm of a warm hand. It was one of the elements predicted by Mendeleev before its discovery — he called it "eka-aluminium." Despite being solid at cool room temperatures, it does not boil until 2229 °C, giving it one of the longest liquid ranges of any metal. Gallium arsenide (GaAs) and gallium nitride (GaN) are crucial semiconductors used in LEDs, laser diodes (in Blu-ray players and fibre optic communications), solar cells, and microwave circuits in smartphones and satellite communications. Gallium has an unusual property: unlike most metals, it expands when it solidifies.' },
    { n:32, sym:'Ge', name:'Germanium',      mass:72.63,    cat:'metalloid',      period:4, group:14, config:'[Ar] 3d¹⁰ 4s² 4p²',   melt:938.25,  boil:2833,    density:5.323,    discovered:1886, state:'solid',  electronegativity:2.01, shells:[2,8,18,4],    desc:'Germanium is a lustrous, grey-white metalloid (semiconductor) that was famously predicted by Mendeleev as "eka-silicon" and discovered with properties almost exactly matching his predictions. It played a crucial role in the early history of electronics — the first transistor (1947) used germanium, launching the semiconductor revolution. Today, silicon has largely replaced it in standard transistors, but germanium is essential in fibre optic cables (where germanium dioxide in the core guides light), infrared optics for night-vision devices and thermal cameras, and solar panels designed for space use. Germanium is also used in certain PET scan detector materials. Its compounds are studied for possible anti-tumour and immune-stimulating properties.' },
    { n:33, sym:'As', name:'Arsenic',        mass:74.922,   cat:'metalloid',      period:4, group:15, config:'[Ar] 3d¹⁰ 4s² 4p³',   melt:817,     boil:614,     density:5.727,    discovered:null, state:'solid',  electronegativity:2.18, shells:[2,8,18,5],    desc:'Arsenic is a notoriously toxic metalloid with a history as a poison — for centuries it was called "inheritance powder" because it was used to murder wealthy relatives. However, it has important modern uses. Gallium arsenide semiconductors are used in solar cells and microwave electronics. Arsenic-based wood preservatives (now mostly phased out in consumer products) protected timber from insects and fungi. Remarkably, arsenic trioxide is an effective treatment for a certain type of leukaemia (APL). Arsenic is also used in lead-acid battery grids and as a dopant in semiconductors. Groundwater arsenic contamination is a major public health crisis in Bangladesh and other parts of Asia, affecting hundreds of millions of people.' },
    { n:34, sym:'Se', name:'Selenium',       mass:78.971,   cat:'nonmetal',       period:4, group:16, config:'[Ar] 3d¹⁰ 4s² 4p⁴',   melt:220.8,   boil:685,     density:4.809,    discovered:1817, state:'solid',  electronegativity:2.55, shells:[2,8,18,6],    desc:'Selenium is a non-metal that exists in several forms — the most common is a grey, metallic-looking solid. Its conductivity increases dramatically when exposed to light, making it useful in photocells, solar cells, and the photocopiers and laser printers that were the dominant copying technology before digital imaging. Selenium is an essential trace element for humans and many animals — the amino acid selenocysteine, sometimes called the "21st amino acid," is found at the active site of important antioxidant enzymes (glutathione peroxidase) that protect cells from oxidative damage. However, the difference between a beneficial and toxic dose is narrow. Selenium is added to glass to remove the green tint caused by iron, and is used in the vulcanisation of rubber.' },
    { n:35, sym:'Br', name:'Bromine',        mass:79.904,   cat:'halogen',        period:4, group:17, config:'[Ar] 3d¹⁰ 4s² 4p⁵',   melt:-7.2,    boil:58.9,    density:3.122,    discovered:1826, state:'liquid', electronegativity:2.96, shells:[2,8,18,7],    desc:'Bromine is one of only two elements that are liquid at room temperature (the other being mercury), and one of only two non-metallic liquids at room temperature. It is a dark reddish-brown, volatile liquid with a strong, choking smell (its name comes from the Greek "bromos," meaning stench). Bromine vapour is toxic and corrosive. It was historically used in a wide range of applications — flame retardants in furniture and electronics, fumigants, dyes, and in early photography (silver bromide). Methyl bromide was used as an agricultural fumigant but is being phased out due to ozone depletion. Today bromine compounds are used in water treatment, pharmaceuticals, and as a drilling fluid additive in oil and gas exploration.' },
    { n:36, sym:'Kr', name:'Krypton',        mass:83.798,   cat:'noble-gas',      period:4, group:18, config:'[Ar] 3d¹⁰ 4s² 4p⁶',   melt:-157.36, boil:-153.22, density:0.00375,  discovered:1898, state:'gas',    electronegativity:3.00, shells:[2,8,18,8],    desc:'Krypton is a colourless, odourless noble gas that is about three times denser than air. Its name comes from the Greek "kryptos," meaning hidden. Despite being chemically inert, krypton can form a few compounds under extreme conditions (krypton difluoride being the most well-known). The krypton-86 isotope was historically used to define the international standard metre from 1960 to 1983 (before it was replaced by a light-speed definition). Krypton is used in certain high-powered lasers (including those used in laser eye surgery), in some types of photographic flash lamps for ultra-high-speed photography, and in specialised fluorescent lamps. Mixed with argon, it fills energy-efficient light bulbs. Despite sharing its name with Superman\'s home planet, it has no superhero properties.' },
    { n:37, sym:'Rb', name:'Rubidium',       mass:85.468,   cat:'alkali-metal',   period:5, group:1,  config:'[Kr] 5s¹',             melt:39.31,   boil:688,     density:1.532,    discovered:1861, state:'solid',  electronegativity:0.82, shells:[2,8,18,8,1],  desc:'Rubidium is a very soft, silvery-white alkali metal that ignites spontaneously in air and reacts explosively with water, making it one of the most reactive metals. It was discovered by spectroscopy in 1861 and named after the deep red (rubidus) spectral lines it produces. Rubidium atomic clocks are the most commonly used type of atomic clock in the world — they are less precise than caesium clocks but much cheaper and are found in GPS satellites, mobile phone base stations, and network timing systems. Rubidium is being researched for use in quantum computing and quantum memory applications. Its most stable isotope, Rb-87, undergoes beta decay to strontium-87, which is used in rubidium-strontium geological dating.' },
    { n:38, sym:'Sr', name:'Strontium',      mass:87.62,    cat:'alkaline-earth', period:5, group:2,  config:'[Kr] 5s²',             melt:777,     boil:1382,    density:2.64,     discovered:1790, state:'solid',  electronegativity:0.95, shells:[2,8,18,8,2],  desc:'Strontium is a soft, silvery-white, highly reactive alkaline earth metal. It reacts with water (though less vigorously than calcium) and tarnishes quickly in air. Strontium compounds burn with a brilliant crimson-red flame, making them essential in fireworks, signal flares, and emergency road flares. Strontium ranelate is used to treat osteoporosis because the body mistakes strontium for calcium and incorporates it into bone. This same property makes radioactive strontium-90 (a nuclear fission product) particularly dangerous — it can accumulate in bones and bone marrow, increasing cancer risk. Strontium titanate was once used as a diamond simulant. Strontium-90 is used in certain medical bone cancer treatments and in radioisotope thermoelectric generators.' },
    { n:39, sym:'Y',  name:'Yttrium',        mass:88.906,   cat:'transition',     period:5, group:3,  config:'[Kr] 4d¹ 5s²',         melt:1522,    boil:3345,    density:4.472,    discovered:1794, state:'solid',  electronegativity:1.22, shells:[2,8,18,9,2],  desc:'Yttrium is a silvery-white, rare earth transition metal that was one of the first rare earth elements discovered, named after the Swedish village of Ytterby — which also gives its name to ytterbium, terbium, and erbium. Yttrium is used in the red phosphors of colour television screens and LED lighting, where yttrium aluminium garnet (YAG) doped with europium produces the characteristic red colour. Yttrium-aluminium garnet (YAG) crystals doped with neodymium create Nd:YAG lasers, one of the most widely used industrial lasers for cutting, welding, and medical procedures. Yttrium barium copper oxide (YBCO) was among the first high-temperature superconductors discovered, operating at liquid nitrogen temperatures rather than the much colder liquid helium.' },
    { n:40, sym:'Zr', name:'Zirconium',      mass:91.224,   cat:'transition',     period:5, group:4,  config:'[Kr] 4d² 5s²',         melt:1855,    boil:4409,    density:6.511,    discovered:1789, state:'solid',  electronegativity:1.33, shells:[2,8,18,10,2], desc:'Zirconium is a lustrous, greyish-white, strong, corrosion-resistant transition metal. Its most critical application is in nuclear reactors — zirconium alloys (zircaloys) are used to clad uranium fuel rods because zirconium is nearly transparent to neutrons and has excellent corrosion resistance in hot water. However, at very high temperatures, zirconium reacts with steam to produce hydrogen — a factor in the Fukushima and Chernobyl nuclear accidents. Zirconium dioxide (zirconia) is used in ceramic knives and dental crowns (cubic zirconia crystals are popular diamond simulants). Zirconium is also found in the gemstone zircon, which is used in zircon dating — one of the most important tools for determining the age of ancient rocks (some are over 4.4 billion years old).' },
    { n:41, sym:'Nb', name:'Niobium',        mass:92.906,   cat:'transition',     period:5, group:5,  config:'[Kr] 4d⁴ 5s¹',         melt:2477,    boil:4744,    density:8.57,     discovered:1801, state:'solid',  electronegativity:1.60, shells:[2,8,18,12,1], desc:'Niobium is a soft, grey, ductile transition metal with a superconducting state at very low temperatures (9.2 K). It was named after Niobe, daughter of Tantalus in Greek mythology, because it is almost always found alongside tantalum and is difficult to separate from it. About 90% of niobium production goes into high-strength steel alloys (HSLA steels) — a tiny amount of niobium dramatically increases steel strength, reducing the weight needed for pipelines, car bodies, and structural steel. Superconducting niobium alloys are used in particle accelerator magnets (such as those at CERN) and in MRI machine components that require superconducting wire. Niobium is also used in jet and rocket engines. Brazil produces about 90% of the world\'s niobium supply.' },
    { n:42, sym:'Mo', name:'Molybdenum',     mass:95.95,    cat:'transition',     period:5, group:6,  config:'[Kr] 4d⁵ 5s¹',         melt:2623,    boil:4639,    density:10.28,    discovered:1781, state:'solid',  electronegativity:2.16, shells:[2,8,18,13,1], desc:'Molybdenum is a silvery-white metal with the sixth highest melting point of all elements. Its name comes from the Greek "molybdos" (lead) because its ore was confused with lead ore. About 80% of molybdenum is used in alloy steels and cast irons to increase strength, hardness, and resistance to wear and high temperatures — it is found in stainless steel, tool steels, and high-speed steels used in drill bits and cutting tools. Molybdenum disulfide (MoS₂) is a layered material similar to graphite that is used as a dry lubricant in conditions where oil-based lubricants would fail (high vacuum, extreme temperatures). Molybdenum is an essential trace element — the enzyme nitrogenase, which fixes atmospheric nitrogen into forms usable by plants, contains molybdenum at its active site.' },
    { n:43, sym:'Tc', name:'Technetium',     mass:98,       cat:'transition',     period:5, group:7,  config:'[Kr] 4d⁵ 5s²',         melt:2157,    boil:4265,    density:11.5,     discovered:1937, state:'solid',  electronegativity:1.90, shells:[2,8,18,13,2], desc:'Technetium holds the distinction of being the first element to be artificially produced — it was created in 1937 by bombarding molybdenum with deuterium nuclei in a cyclotron. Its name comes from the Greek "technetos," meaning artificial. All isotopes of technetium are radioactive (there are no stable isotopes), which is why it is extremely rare in nature. Despite this, it has an enormously important medical application: technetium-99m (a metastable nuclear isomer) is used in about 40 million nuclear medicine diagnostic procedures each year worldwide, including bone scans, heart perfusion studies, and cancer detection. It emits gamma rays ideal for imaging and has a short half-life of 6 hours, minimising radiation dose to patients.' },
    { n:44, sym:'Ru', name:'Ruthenium',      mass:101.07,   cat:'transition',     period:5, group:8,  config:'[Kr] 4d⁷ 5s¹',         melt:2334,    boil:4150,    density:12.37,    discovered:1844, state:'solid',  electronegativity:2.20, shells:[2,8,18,15,1], desc:'Ruthenium is a rare, hard, silvery-white platinum-group metal. It was the last of the platinum-group metals to be discovered and is the rarest of them. Named after Ruthenia (the Latin name for the Russian Empire), it was first isolated in 1844. Small amounts of ruthenium added to platinum and palladium dramatically increase their hardness — these alloys are used in electrical contacts and wear-resistant items. Ruthenium dioxide is used as a coating on titanium anodes in electrochemical production of chlorine. Ruthenium-based compounds are being researched as potential anti-cancer drugs as an alternative to platinum-based cisplatin. Ruthenium dye-sensitised solar cells (Grätzel cells) offer a potentially low-cost photovoltaic technology.' },
    { n:45, sym:'Rh', name:'Rhodium',        mass:102.906,  cat:'transition',     period:5, group:9,  config:'[Kr] 4d⁸ 5s¹',         melt:1964,    boil:3695,    density:12.41,    discovered:1803, state:'solid',  electronegativity:2.28, shells:[2,8,18,16,1], desc:'Rhodium is one of the rarest and most expensive metals on Earth — it is about 80 times rarer than gold, and its price has occasionally exceeded $20,000 per troy ounce. It is a hard, silvery-white platinum-group metal with excellent reflectivity and resistance to corrosion. The single most important use of rhodium is in three-way catalytic converters in car exhausts: rhodium converts toxic nitrogen oxides (NOₓ) from engine combustion into harmless nitrogen gas (a process that platinum and palladium cannot do efficiently alone). This makes rhodium critical for meeting air quality standards in petrol-powered vehicles. Rhodium plating is applied to white gold and platinum jewellery to enhance shine and scratch resistance. It is also used in speciality glassmaking equipment.' },
    { n:46, sym:'Pd', name:'Palladium',      mass:106.42,   cat:'transition',     period:5, group:10, config:'[Kr] 4d¹⁰',            melt:1554.9,  boil:2963,    density:12.023,   discovered:1803, state:'solid',  electronegativity:2.20, shells:[2,8,18,18],   desc:'Palladium is a rare, lustrous, silvery-white metal that is the least dense and lowest melting of the platinum-group metals. It was discovered in 1803 and named after the asteroid Pallas (itself named after the Greek goddess). Palladium has an extraordinary ability to absorb hydrogen gas — up to 900 times its own volume — which has led to research into its use for hydrogen storage and purification. Its most critical use today is in catalytic converters for petrol engines (it converts carbon monoxide and unburnt hydrocarbons into CO₂ and water). Palladium is used in jewellery as an alternative to platinum (sometimes marketed as "white gold"), in dental alloys, and as a catalyst in numerous chemical reactions, including the synthesis of pharmaceuticals.' },
    { n:47, sym:'Ag', name:'Silver',         mass:107.868,  cat:'transition',     period:5, group:11, config:'[Kr] 4d¹⁰ 5s¹',        melt:961.78,  boil:2162,    density:10.49,    discovered:null, state:'solid',  electronegativity:1.93, shells:[2,8,18,18,1], desc:'Silver has the highest electrical conductivity, thermal conductivity, and optical reflectivity of all metals. It has been prized since antiquity for use in coins, jewellery, and ornaments. Its name (Ag from the Latin "argentum") gives Argentina its name. In modern electronics, silver is used in contacts and switches, photovoltaic solar panels, and circuit boards. Silver halides (especially AgBr) are light-sensitive compounds that were the basis of photographic film for over 150 years. Silver has powerful antimicrobial properties — colloidal silver and silver-coated materials are used in wound dressings, medical implants, and antibacterial textiles. Silver is increasingly important in printed electronics and flexible displays. Much of the world\'s silver is produced as a by-product of copper, lead, and zinc mining.' },
    { n:48, sym:'Cd', name:'Cadmium',        mass:112.411,  cat:'transition',     period:5, group:12, config:'[Kr] 4d¹⁰ 5s²',        melt:321.07,  boil:767,     density:8.65,     discovered:1817, state:'solid',  electronegativity:1.69, shells:[2,8,18,18,2], desc:'Cadmium is a soft, bluish-white metal that is extremely toxic — it is a known carcinogen that accumulates in the kidneys and bones, causing kidney damage and a painful bone disease called itai-itai disease (caused by cadmium-contaminated rice in Japan). Despite its toxicity, cadmium has several important industrial uses. Nickel-cadmium (NiCd) rechargeable batteries were the dominant rechargeable battery technology for decades before being largely replaced by lithium-ion batteries, though they are still used in power tools and emergency lighting. Cadmium telluride (CdTe) is an efficient solar cell material used in thin-film photovoltaic panels. Cadmium sulfide (yellow) and cadmium selenide (red/orange) are used as pigments in artists\' paints. Cadmium is used in nuclear reactor control rods as a neutron absorber.' },
    { n:49, sym:'In', name:'Indium',         mass:114.818,  cat:'post-transition',period:5, group:13, config:'[Kr] 4d¹⁰ 5s² 5p¹',   melt:156.6,   boil:2072,    density:7.31,     discovered:1863, state:'solid',  electronegativity:1.78, shells:[2,8,18,18,3], desc:'Indium is a soft, silvery-white post-transition metal that has a curious property: when bent, it emits a high-pitched screaming or crackling sound due to twinning of its crystal structure (similar to "tin cry"). It was discovered in 1863 by its distinctive indigo spectral line. Indium\'s most important application is as indium tin oxide (ITO), a transparent electrical conductor deposited as a thin film on glass — it is the material that makes touchscreens, liquid crystal displays (LCDs), and flat-panel TVs work. Almost every touchscreen device you own contains indium. It is also used in low-melting-point alloys for soldering, in certain semiconductor compounds like indium phosphide (used in solar cells and lasers), and as a bearing metal in high-performance engines.' },
    { n:50, sym:'Sn', name:'Tin',            mass:118.71,   cat:'post-transition',period:5, group:14, config:'[Kr] 4d¹⁰ 5s² 5p²',   melt:231.93,  boil:2602,    density:7.287,    discovered:null, state:'solid',  electronegativity:1.96, shells:[2,8,18,18,4], desc:'Tin is a soft, silvery-white metal known since antiquity — when combined with copper it creates bronze, giving rise to the Bronze Age around 3300 BCE, one of the great technological transformations in human history. Tin is best known today for its use in tin cans (which are actually mostly steel with a thin tin coating to prevent rusting and contamination). Solder — the material used to join electronic components — has traditionally been a tin-lead alloy, though lead-free tin-silver-copper solders are now standard due to environmental concerns. Tin exists in two distinct forms: white tin (the familiar metal) and grey tin (a powdery semiconductor) — below 13.2 °C, white tin slowly transforms to grey tin, a process called "tin pest" that destroyed Napoleon\'s soldiers\' tin coat buttons in the Russian winter.' },
    { n:51, sym:'Sb', name:'Antimony',       mass:121.76,   cat:'metalloid',      period:5, group:15, config:'[Kr] 4d¹⁰ 5s² 5p³',   melt:630.63,  boil:1587,    density:6.685,    discovered:null, state:'solid',  electronegativity:2.05, shells:[2,8,18,18,5], desc:'Antimony is a lustrous, brittle, silver-white metalloid that has been known since ancient times — ancient Egyptians used antimony sulfide (stibnite) as a black eye cosmetic (kohl). Its chemical symbol Sb comes from the Latin "stibium." Antimony\'s most important modern use is in flame retardants — antimony trioxide is used with halogenated compounds to make plastics, textiles, and electronics resistant to fire. It is used in lead-acid batteries to harden the lead plates. Antimony is a critical semiconductor material: it is used in semiconductor research and in infrared detectors. Antimony drugs are still the primary treatment for leishmaniasis, a parasitic disease. Like arsenic, antimony was historically used as a poison, and distinguishing antimony poisoning from arsenic poisoning was important in early forensic chemistry.' },
    { n:52, sym:'Te', name:'Tellurium',      mass:127.6,    cat:'metalloid',      period:5, group:16, config:'[Kr] 4d¹⁰ 5s² 5p⁴',   melt:449.51,  boil:988,     density:6.232,    discovered:1782, state:'solid',  electronegativity:2.10, shells:[2,8,18,18,6], desc:'Tellurium is a rare, brittle, silver-white metalloid that is one of the least abundant stable elements in Earth\'s crust (rarer than platinum). It is a semiconductor and its conductivity increases significantly when exposed to light. Tellurium is primarily used in cadmium telluride (CdTe) thin-film solar panels, which are the second most common type of photovoltaic technology after silicon — CdTe panels are cheaper to manufacture than silicon. It is also used in thermoelectric devices (bismuth telluride), in the production of free-machining steels, and as an additive to copper and lead alloys. Tellurium was discovered in 1782 in gold ores from Transylvania; its name comes from the Latin "tellus" (Earth). Most tellurium is produced as a by-product of copper refining.' },
    { n:53, sym:'I',  name:'Iodine',         mass:126.904,  cat:'halogen',        period:5, group:17, config:'[Kr] 4d¹⁰ 5s² 5p⁵',   melt:113.7,   boil:184.4,   density:4.933,    discovered:1811, state:'solid',  electronegativity:2.66, shells:[2,8,18,18,7], desc:'Iodine is a lustrous, dark purple-grey solid that readily sublimes into a violet vapour. It is an essential trace element for human health — the thyroid gland requires iodine to produce hormones (thyroxine and triiodothyronine) that regulate metabolism, growth, and development. Iodine deficiency is the leading preventable cause of intellectual disability worldwide, affecting 2 billion people; this is why many countries add iodine to table salt (iodised salt). Iodine solution turns starch blue-black — a classic test used in biology and chemistry. It is used as an antiseptic (tincture of iodine) to disinfect wounds and skin. Radioactive iodine-131 is used to treat thyroid cancer and hyperthyroidism. Iodine is also used in X-ray contrast agents and in making polarising films for LCD screens.' },
    { n:54, sym:'Xe', name:'Xenon',          mass:131.293,  cat:'noble-gas',      period:5, group:18, config:'[Kr] 4d¹⁰ 5s² 5p⁶',   melt:-111.7,  boil:-108.1,  density:0.00589,  discovered:1898, state:'gas',    electronegativity:2.60, shells:[2,8,18,18,8], desc:'Xenon is a dense, colourless noble gas that was once thought to be completely inert — until 1962, when Neil Bartlett synthesised the first noble gas compound, xenon hexafluoroplatinate, shocking the chemistry world. Since then, many xenon compounds have been made. Xenon produces an intense white light when excited electrically, making it invaluable in high-intensity discharge lamps (HID headlights in cars, cinema projectors, and photographic flash lamps). Xenon ion thrusters provide propulsion for spacecraft, including the Dawn mission and many commercial satellites, because they are extremely fuel-efficient. Xenon is also used as a general anaesthetic in some countries, as it is non-toxic, non-flammable, and produces minimal environmental impact. Xenon-133 is used in pulmonary function imaging.' },
    { n:55, sym:'Cs', name:'Caesium',        mass:132.905,  cat:'alkali-metal',   period:6, group:1,  config:'[Xe] 6s¹',             melt:28.44,   boil:671,     density:1.93,     discovered:1860, state:'solid',  electronegativity:0.79, shells:[2,8,18,18,8,1],   desc:'Caesium (or cesium in American English) is a soft, golden-tinted metal — one of only three metals with a naturally yellowish colour (the others being gold and copper). It melts just above room temperature (28.44 °C) and reacts explosively with water. Caesium\'s most important application is in atomic clocks — the caesium-133 atom is so precise that the SI second is defined by its vibration frequency (9,192,631,770 oscillations per second). GPS satellites, internet timing, and global financial transactions all depend on caesium atomic clocks. Caesium formate is used as a dense drilling fluid in oil and gas wells. The photoelectric effect is particularly strong in caesium, making it useful in photoelectric cells and night-vision equipment. Radioactive caesium-137, a nuclear fission product, is a dangerous environmental contaminant (as seen after Chernobyl and Fukushima).' },
    { n:56, sym:'Ba', name:'Barium',         mass:137.327,  cat:'alkaline-earth', period:6, group:2,  config:'[Xe] 6s²',             melt:727,     boil:1870,    density:3.51,     discovered:1808, state:'solid',  electronegativity:0.89, shells:[2,8,18,18,8,2],   desc:'Barium is a soft, silvery-white alkaline earth metal that reacts readily with oxygen and water. Its name comes from the Greek "barys" (heavy), as its ore barite (barium sulfate) is notably dense. Barium sulfate is opaque to X-rays and completely insoluble and non-toxic, making it ideal as a "barium meal" or "barium enema" — patients drink a barium sulfate suspension that coats the digestive tract, allowing doctors to image the stomach, oesophagus, and intestines with X-rays or CT scans. Barium is also used in drilling fluids for oil and gas exploration, in producing certain types of glass and ceramics, and in vacuum tubes to absorb residual gases. Barium compounds give fireworks their brilliant green colour. Unlike barium sulfate, most other barium compounds are highly toxic.' },
    { n:57, sym:'La', name:'Lanthanum',      mass:138.905,  cat:'lanthanide',     period:6, group:3,  config:'[Xe] 5d¹ 6s²',         melt:920,     boil:3464,    density:6.145,    discovered:1839, state:'solid',  electronegativity:1.10, shells:[2,8,18,18,9,2],   desc:'Lanthanum is a soft, malleable, silvery-white rare earth metal and the first element of the lanthanide series. It is named from the Greek "lanthanein" (to lie hidden) because it hid in cerium oxide for many years before being separated. Lanthanum oxide is used to make speciality optical glasses with high refractive index, such as the lenses in high-quality cameras, binoculars, and telescopes (including the Hubble Space Telescope\'s instruments). Lanthanum is a key component in nickel-metal hydride (NiMH) batteries used in hybrid cars. La₂O₃ is used as a catalyst in fluid catalytic cracking (FCC) in oil refineries to produce petrol from crude oil. Lanthanum chloride is used in water treatment. Certain lanthanum compounds act as phosphate binders in treating kidney disease.' },
    { n:58, sym:'Ce', name:'Cerium',         mass:140.116,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹ 5d¹ 6s²',    melt:798,     boil:3443,    density:6.77,     discovered:1803, state:'solid',  electronegativity:1.12, shells:[2,8,18,19,9,2],   desc:'Cerium is the most abundant of the rare earth elements (more abundant than copper in Earth\'s crust) and is named after the dwarf planet Ceres. It is a soft, ductile, iron-grey metal that tarnishes readily in air. One of cerium\'s most familiar applications is in the flints of cigarette lighters — the alloy mischmetal (about 50% cerium) generates sparks when struck. Cerium oxide (ceria) is the most effective polishing compound for glass and is used to grind and polish glass in every type of screen, mirror, and lens. It is also used in catalytic converters where it serves as an oxygen buffer, and in self-cleaning ovens (the coating oxidises food residue at high temperature). Cerium oxide nanoparticles are being studied as antioxidants for treating various diseases. It is also used in colouring glass yellow.' },
    { n:59, sym:'Pr', name:'Praseodymium',   mass:140.908,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f³ 6s²',        melt:931,     boil:3520,    density:6.773,    discovered:1885, state:'solid',  electronegativity:1.13, shells:[2,8,18,21,8,2],   desc:'Praseodymium is a soft, silvery, malleable rare earth metal whose name comes from the Greek words for "leek green twin" — its salts are distinctly green and it was separated from neodymium (its "twin") in 1885. Praseodymium is used in strong permanent magnets: combined with neodymium to make NdPr magnets (a cost-effective variant of neodymium magnets used in motors and generators). Praseodymium oxide produces an intense yellow-green colour in glass and enamel — it is used in goggles for glassblowers and welders to filter out the bright yellow sodium flare. Praseodymium alloyed with magnesium creates a high-strength alloy used in aircraft engines. Praseodymium doped fibre amplifiers are used in certain mid-infrared laser applications and in fibre optic communications.' },
    { n:60, sym:'Nd', name:'Neodymium',      mass:144.242,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f⁴ 6s²',        melt:1021,    boil:3074,    density:7.007,    discovered:1885, state:'solid',  electronegativity:1.14, shells:[2,8,18,22,8,2],   desc:'Neodymium is a soft, silvery rare earth metal that is the star of modern magnet technology. Neodymium-iron-boron (NdFeB) magnets are the strongest permanent magnets ever made — they can be over a thousand times stronger than ordinary ferrite magnets for their volume. These tiny but powerful magnets are found in computer hard drives, headphones, speakers, MRI machines, electric motors in electric vehicles, and wind turbine generators. The transition to renewable energy and electric transport has made neodymium a strategically critical material — about 90% is produced in China. Neodymium compounds produce striking purple, blue, and red colours in glass and lasers. Nd:YAG lasers are used in laser cutting, medical procedures, and military rangefinders.' },
    { n:61, sym:'Pm', name:'Promethium',     mass:145,      cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f⁵ 6s²',        melt:1042,    boil:3000,    density:7.26,     discovered:1945, state:'solid',  electronegativity:1.13, shells:[2,8,18,23,8,2],   desc:'Promethium is the only lanthanide (and one of only two elements below uranium) that has no stable isotopes — all are radioactive. Vanishingly small amounts exist naturally as a product of spontaneous fission of uranium, but it is essentially absent from Earth\'s crust. It is named after Prometheus, the titan who stole fire from the gods, reflecting the difficult and "fiery" challenge of its isolation. Promethium was first produced artificially during the Manhattan Project in 1945 by bombarding neodymium and praseodymium with neutrons. The most stable isotope, Pm-145, has a half-life of 17.7 years. It is used in nuclear-powered betavoltaic batteries (atomic batteries for spacecraft and missile guidance systems) and in luminescent paint (it replaced radium). It is also used in portable X-ray sources and as a thickness gauge for industrial materials.' },
    { n:62, sym:'Sm', name:'Samarium',       mass:150.36,   cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f⁶ 6s²',        melt:1072,    boil:1794,    density:7.52,     discovered:1879, state:'solid',  electronegativity:1.17, shells:[2,8,18,24,8,2],   desc:'Samarium is a hard, silvery rare earth metal that was the first element discovered using spectroscopy (by its distinctive spectral lines). It was named after the mineral samarskite, itself named after a Russian mining official, Colonel Samarski — making samarium one of the few elements named indirectly after a real person. Samarium-cobalt (SmCo) magnets were the first rare earth magnets to be developed commercially and remain important where heat resistance is required (they retain their magnetism better than neodymium magnets at high temperatures). Samarium-153 (a radioactive isotope) is used in targeted radiotherapy for bone cancer pain relief, binding to bone metastases and delivering localised radiation. Samarium compounds are also used as neutron absorbers in nuclear reactors and in infrared-absorbing glass.' },
    { n:63, sym:'Eu', name:'Europium',       mass:151.964,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f⁷ 6s²',        melt:826,     boil:1529,    density:5.243,    discovered:1901, state:'solid',  electronegativity:null, shells:[2,8,18,25,8,2],   desc:'Europium is the most reactive rare earth metal — it oxidises rapidly in air and reacts with water. It is the softest lanthanide and was not isolated until 1901, although it had been observed spectroscopically earlier. Europium is exceptionally important in producing luminescent displays: europium(III) compounds produce brilliant red phosphorescence, while europium(II) compounds produce blue. These phosphors are used in fluorescent lamps, LED backlights, plasma displays, and colour television screens — essentially every colour screen uses europium phosphors. Euro banknotes contain europium-based fluorescent compounds that glow under UV light as an anti-counterfeiting measure. Europium is also used in some types of cancer imaging using fluorescent bioassays.' },
    { n:64, sym:'Gd', name:'Gadolinium',     mass:157.25,   cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f⁷ 5d¹ 6s²',   melt:1313,    boil:3273,    density:7.9,      discovered:1880, state:'solid',  electronegativity:1.20, shells:[2,8,18,25,9,2],   desc:'Gadolinium is a silvery-white, malleable, ductile rare earth metal with unusual magnetic properties — it is ferromagnetic at room temperature (one of very few non-iron metals to be magnetic), and near its Curie temperature (20 °C), it shows an unusually large magnetocaloric effect (heating when magnetised, cooling when demagnetised), making it a candidate for magnetic refrigeration technology. Its most important medical use is as an MRI contrast agent: gadolinium chelate compounds are injected intravenously and accumulate in abnormal tissues, making them appear brighter on MRI scans — about a third of all MRI scans worldwide use gadolinium contrast. Gadolinium is also used in nuclear reactor control rods and as a component in speciality alloys and phosphors for television sets and computer monitors.' },
    { n:65, sym:'Tb', name:'Terbium',        mass:158.925,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f⁹ 6s²',        melt:1356,    boil:3230,    density:8.229,    discovered:1843, state:'solid',  electronegativity:null, shells:[2,8,18,27,8,2],   desc:'Terbium is a soft, malleable, silvery-white rare earth metal named after Ytterby, Sweden (the same village that gives its name to yttrium, ytterbium, and erbium). Terbium produces a vivid green phosphorescence and is used in green phosphors for fluorescent lamps and LED lighting, producing the highly efficient warm-white light of modern compact fluorescent bulbs and LED tubes. Terbium is also essential in magneto-optical data storage and in Terfenol-D (terbium-dysprosium-iron), a magnetostrictive material that changes shape in a magnetic field — useful in sonar transducers, precision actuators, and vibration sensors. Terbium is also used as a dopant in solid-state devices and as a structural component in high-performance permanent magnets (where it improves performance at elevated temperatures).' },
    { n:66, sym:'Dy', name:'Dysprosium',     mass:162.5,    cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹⁰ 6s²',       melt:1412,    boil:2567,    density:8.55,     discovered:1886, state:'solid',  electronegativity:1.22, shells:[2,8,18,28,8,2],   desc:'Dysprosium is a soft, lustrous, silvery metal with the highest magnetic moment (strength per atom) of any naturally occurring element. Its name comes from the Greek "dysprositos," meaning "hard to get" — it was notoriously difficult to separate from the other lanthanides. Dysprosium is critical for high-performance neodymium magnets used in electric vehicle motors and wind turbines. Adding dysprosium to NdFeB magnets allows them to maintain their strength at higher temperatures — essential for the demanding environments inside electric motors. Without dysprosium, EV motors would lose their magnetism when they heat up under load. The global shift to electric vehicles has made dysprosium a strategically vital material. It is also used in nuclear reactor control rods (dysprosium oxide) and in certain speciality lasers.' },
    { n:67, sym:'Ho', name:'Holmium',        mass:164.93,   cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹¹ 6s²',       melt:1474,    boil:2700,    density:8.795,    discovered:1879, state:'solid',  electronegativity:1.23, shells:[2,8,18,29,8,2],   desc:'Holmium is a soft, malleable, silvery-white rare earth metal named after Stockholm (from the Latin "Holmia"). It has the highest magnetic dipole moment of any element, making it valuable for creating the strongest magnetic fields. Holmium pole pieces (small holmium metal inserts) are used in high-field electromagnets to concentrate and enhance the magnetic field. Ho:YAG (holmium-doped yttrium aluminium garnet) lasers emit light at 2.1 μm in the infrared, which is strongly absorbed by water in tissue. This makes them ideal for minimally invasive surgery — used in urology (breaking up kidney stones), orthopaedics (joint surgery), and ophthalmology. Holmium is also used in nuclear reactor control rods and as a neutron absorber in nuclear technology.' },
    { n:68, sym:'Er', name:'Erbium',         mass:167.259,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹² 6s²',       melt:1497,    boil:2868,    density:9.066,    discovered:1843, state:'solid',  electronegativity:1.24, shells:[2,8,18,30,8,2],   desc:'Erbium is a soft, malleable, lustrous silvery-white rare earth metal, also named after Ytterby. Erbium\'s most critical technological application is in fibre optic communications — erbium-doped fibre amplifiers (EDFAs) are the key technology that makes long-distance fibre optic internet possible. Erbium ions can absorb photons at 980 nm and re-emit them at 1550 nm (the standard wavelength used in fibre optic communications) — this allows optical signals to be amplified directly in the glass fibre without converting to electrical signals and back, allowing signals to travel thousands of kilometres via submarine cables. The internet as we know it would not function at global scale without erbium. Erbium oxide has a distinctive pink colour and is used to colour glasses and ceramics. Er:YAG lasers are used in dentistry and skin resurfacing.' },
    { n:69, sym:'Tm', name:'Thulium',        mass:168.934,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹³ 6s²',       melt:1545,    boil:1950,    density:9.321,    discovered:1879, state:'solid',  electronegativity:1.25, shells:[2,8,18,31,8,2],   desc:'Thulium is the least abundant and second rarest of the naturally occurring lanthanides (after promethium, which is radioactive). It is named after Thule, an ancient name for the far north of Scandinavia or northern lands. Thulium is a soft, silvery-grey metal. Thulium-170, produced by irradiating thulium in a nuclear reactor, emits X-rays and was developed as a portable X-ray source for use in areas where electricity is unavailable, such as remote medical clinics. Thulium-doped yttrium aluminium garnet (Tm:YAG) and thulium-doped fibre lasers emit at around 2 μm and are used in laser ranging, remote sensing, and minimally invasive medical procedures. Thulium also produces a blue-green luminescence used in high-performance phosphors.' },
    { n:70, sym:'Yb', name:'Ytterbium',      mass:173.045,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹⁴ 6s²',       melt:819,     boil:1196,    density:6.965,    discovered:1878, state:'solid',  electronegativity:null, shells:[2,8,18,32,8,2],   desc:'Ytterbium is a soft, bright, silvery rare earth metal that was discovered in 1878 and named (like yttrium, terbium, and erbium) after the village of Ytterby. It was the last of the four "Ytterby elements" to be discovered. Ytterbium is used in certain types of optical fibre amplifiers for high-power laser applications. Ytterbium-doped fibre lasers are increasingly replacing CO₂ and Nd:YAG lasers in industrial cutting and welding because they are highly energy-efficient and produce a wavelength (1064 nm) that is well absorbed by metals. Ytterbium atomic clocks are the most precise clocks ever built — operating at optical frequencies, they are accurate to within one second in 14 billion years and are used in cutting-edge tests of fundamental physics. Ytterbium is also used in some stainless steel alloys.' },
    { n:71, sym:'Lu', name:'Lutetium',       mass:174.967,  cat:'lanthanide',     period:6, group:null,config:'[Xe] 4f¹⁴ 5d¹ 6s²',  melt:1663,    boil:3402,    density:9.84,     discovered:1907, state:'solid',  electronegativity:1.27, shells:[2,8,18,32,9,2],   desc:'Lutetium is the heaviest, hardest, and densest of all the lanthanides. It is named after Lutetia, the Latin name for Paris, where it was discovered in 1907. Lutetium is rare and expensive — it is used sparingly but in high-value applications. Lutetium oxyorthosilicate (LSO and LYSO) crystals are used as scintillator detectors in PET (positron emission tomography) scanners used in cancer diagnosis — they are superior to older scintillator materials in terms of light output and speed. Lutetium-177 (a radioactive isotope) is used in targeted radionuclide therapy (Lu-DOTATATE) to treat certain neuroendocrine tumours, representing a breakthrough in cancer treatment approved in multiple countries. Lutetium aluminium garnet (LuAG) is used in high-energy physics detectors.' },
    { n:72, sym:'Hf', name:'Hafnium',        mass:178.49,   cat:'transition',     period:6, group:4,  config:'[Xe] 4f¹⁴ 5d² 6s²',  melt:2233,    boil:4603,    density:13.31,    discovered:1923, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,10,2],  desc:'Hafnium is a lustrous, silvery-grey transition metal that is almost always found in nature alongside zirconium (in zircon minerals) because their atomic radii are virtually identical — an effect of the lanthanide contraction. This makes hafnium one of the most difficult elements to separate from a companion element. Unlike zirconium, hafnium absorbs neutrons very effectively, making it invaluable as a control rod material in nuclear reactors (while zirconium is used for the fuel cladding). Hafnium oxide (HfO₂) has a very high dielectric constant, which is why it replaced silicon dioxide as the gate dielectric in Intel\'s transistors from 2007 onwards — a breakthrough that allowed continued miniaturisation of computer chips when traditional silicon oxide became too thin. Hafnium is also used in plasma cutting torch electrodes.' },
    { n:73, sym:'Ta', name:'Tantalum',       mass:180.948,  cat:'transition',     period:6, group:5,  config:'[Xe] 4f¹⁴ 5d³ 6s²',  melt:3017,    boil:5458,    density:16.69,    discovered:1802, state:'solid',  electronegativity:1.50, shells:[2,8,18,32,11,2],  desc:'Tantalum is a rare, hard, blue-grey, lustrous transition metal with an extraordinarily high melting point (3017 °C — fifth highest of all elements) and exceptional resistance to corrosion by almost all acids. It is named after the mythological Tantalus, because of the tantalising difficulty of dissolving it in acid. Tantalum\'s most critical use is in small, high-performance capacitors (tantalum electrolytic capacitors) found in mobile phones, laptops, tablets, and hearing aids — they are smaller and more reliable than equivalent aluminium capacitors. Virtually every smartphone contains tantalum capacitors. It is also used in surgical implants (especially hip and skull plates) because it is biocompatible and does not react with body fluids. Most tantalum comes from conflict-affected regions of Africa (particularly DRC), raising significant ethical supply chain concerns.' },
    { n:74, sym:'W',  name:'Tungsten',       mass:183.84,   cat:'transition',     period:6, group:6,  config:'[Xe] 4f¹⁴ 5d⁴ 6s²',  melt:3422,    boil:5555,    density:19.25,    discovered:1783, state:'solid',  electronegativity:2.36, shells:[2,8,18,32,12,2],  desc:'Tungsten has the highest melting point of all elements (3422 °C) and the highest tensile strength of any metal at temperatures above 1650 °C. Its symbol W comes from its German name "Wolfram." It is almost twice as dense as lead. The extreme heat resistance of tungsten made it the ideal material for incandescent light bulb filaments for over a century. Today its most important uses are in cemented carbide cutting tools (tungsten carbide — the material in drill bits, milling cutters, and saw tips), high-speed steel alloys for machine tools, and heavy metal alloys for military projectiles (replacing lead). Tungsten electrodes are used in TIG (tungsten inert gas) welding. Tungsten diselenide and disulfide are being researched as next-generation lubricants and 2D semiconductor materials.' },
    { n:75, sym:'Re', name:'Rhenium',        mass:186.207,  cat:'transition',     period:6, group:7,  config:'[Xe] 4f¹⁴ 5d⁵ 6s²',  melt:3186,    boil:5596,    density:21.02,    discovered:1925, state:'solid',  electronegativity:1.90, shells:[2,8,18,32,13,2],  desc:'Rhenium has the second highest melting point of all elements (3186 °C, after tungsten) and the third highest density. It was the last stable element to be discovered in nature (1925) and was one of the elements predicted by Mendeleev. It is extremely rare — only about 50 tonnes are produced annually worldwide. Rhenium\'s most important use is in superalloys for single-crystal turbine blades in jet engines and gas turbines: adding 3-6% rhenium dramatically increases the creep resistance and high-temperature strength of nickel superalloys, allowing engines to run hotter and more efficiently. Almost all aviation-grade jet engine turbine blades contain rhenium. It is also used in catalysts for oil refining (platinum-rhenium catalysts in platforming) and in high-temperature electrical contacts and filaments for mass spectrometers.' },
    { n:76, sym:'Os', name:'Osmium',         mass:190.23,   cat:'transition',     period:6, group:8,  config:'[Xe] 4f¹⁴ 5d⁶ 6s²',  melt:3033,    boil:5012,    density:22.59,    discovered:1803, state:'solid',  electronegativity:2.20, shells:[2,8,18,32,14,2],  desc:'Osmium is the densest naturally occurring element — twice as dense as lead and 10% denser than gold. Its name comes from the Greek "osme" (smell), because osmium tetroxide (OsO₄) has a pungent, acrid odour and is highly toxic. Osmium is a hard, brittle, blue-grey platinum-group metal. Osmium alloys (particularly osmium-iridium) are extremely hard and are used in the tips of fountain pen nibs, instrument pivots, and electrical contacts that require extreme wear resistance. Osmium tetroxide, despite being toxic, is used in biological electron microscopy as a fixative and stain that highlights lipid-rich structures (cell membranes) and in organic chemistry for stereospecific oxidation reactions. Osmium is about 1,000 times rarer than gold.' },
    { n:77, sym:'Ir', name:'Iridium',        mass:192.217,  cat:'transition',     period:6, group:9,  config:'[Xe] 4f¹⁴ 5d⁷ 6s²',  melt:2446,    boil:4428,    density:22.56,    discovered:1803, state:'solid',  electronegativity:2.20, shells:[2,8,18,32,15,2],  desc:'Iridium is the most corrosion-resistant metal known — it is resistant to air, water, halogens, and most acids even at very high temperatures. It is the second densest element after osmium. Named after Iris, the Greek goddess of rainbows, because of its brightly coloured salts. Iridium is crucial evidence in the K-Pg (Cretaceous-Palaeogene) boundary theory for dinosaur extinction: a thin layer of iridium-rich clay found worldwide at the geological boundary suggests a massive asteroid impact (asteroids are enriched in iridium), which would have caused the mass extinction 66 million years ago. Iridium is used in spark plugs for high-performance engines, crucibles for growing speciality crystals, and was used for the kilogram standard until 2019. Iridium-192 is used in cancer brachytherapy (internal radiotherapy).' },
    { n:78, sym:'Pt', name:'Platinum',       mass:195.084,  cat:'transition',     period:6, group:10, config:'[Xe] 4f¹⁴ 5d⁹ 6s¹',  melt:1768.3,  boil:3825,    density:21.45,    discovered:1735, state:'solid',  electronegativity:2.28, shells:[2,8,18,32,17,1],  desc:'Platinum is a dense, malleable, ductile, precious, silvery-white metal that does not oxidise at any temperature. Its name comes from the Spanish "platina" (little silver). Platinum has been prized for jewellery for centuries, but its most important modern use is in catalytic converters — platinum oxidises carbon monoxide and unburnt hydrocarbons from engine exhaust into CO₂ and water. Platinum is also a crucial catalyst in the industrial production of nitric acid (Ostwald process), used to make fertilisers and explosives. Cisplatin, a platinum compound, is one of the most widely used anti-cancer drugs, effective against testicular, ovarian, lung, and bladder cancers. Platinum electrodes are used in fuel cells for hydrogen-powered vehicles. Until 2019, the international kilogram standard (IPK) was a platinum-iridium cylinder held in France.' },
    { n:79, sym:'Au', name:'Gold',           mass:196.967,  cat:'transition',     period:6, group:11, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s¹', melt:1064.18, boil:2856,    density:19.3,     discovered:null, state:'solid',  electronegativity:2.54, shells:[2,8,18,32,18,1],  desc:'Gold is one of the few elements found in pure metallic form in nature, which, combined with its beauty and resistance to tarnishing, has made it the basis of wealth and adornment throughout human history. It is extremely malleable — one gram can be beaten into a sheet about one square metre in area (gold leaf). Gold\'s colour (unusual for metals — most are grey or silver) arises from relativistic effects on its electron orbitals. Despite its image as purely decorative, gold has critical technical uses: it is the best corrosion-resistant electrical conductor, so it is used in all critical electronic connections (computer processors, connectors, aerospace electronics). Gold nanoparticles are being developed for cancer diagnosis and treatment. All gold ever mined in history would fill only about 3.5 Olympic swimming pools.' },
    { n:80, sym:'Hg', name:'Mercury',        mass:200.592,  cat:'transition',     period:6, group:12, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s²', melt:-38.83,  boil:356.73,  density:13.534,   discovered:null, state:'liquid', electronegativity:2.00, shells:[2,8,18,32,18,2],  desc:'Mercury is the only metal that is liquid at room temperature — and the only element other than bromine that is liquid at standard conditions. It is also one of only two elements whose liquid form is denser than its solid form. Named after the fleet-footed Roman god, mercury has been known since ancient times (cinnabar — red mercury sulfide — was used as a pigment in cave paintings). Mercury was used for centuries in thermometers, barometers, electrical switches, and fluorescent lamps. However, mercury is a potent neurotoxin — the phrase "mad as a hatter" arose because hatters used mercury compounds to process felt and suffered neurological damage. Methylmercury, which accumulates in fish, causes Minamata disease. Due to toxicity, mercury is being phased out of most consumer products. It is still used in dentistry (amalgam fillings), gold mining, and chlor-alkali electrolysis.' },
    { n:81, sym:'Tl', name:'Thallium',       mass:204.38,   cat:'post-transition',period:6, group:13, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p¹',  melt:304,  boil:1473,    density:11.85,    discovered:1861, state:'solid',  electronegativity:1.62, shells:[2,8,18,32,18,3],  desc:'Thallium is a soft, grey post-transition metal that is highly toxic — it was used as a rat and ant poison and was a favourite poison in murder plots due to its colourless, tasteless nature (similar to potassium in biochemistry, it disrupts potassium channels). Its name comes from the Greek "thallos" (green shoot) because of its bright green spectral line. Thallium has niche but important applications: thallium sulfide is used in infrared-sensitive photoconductive cells; thallium bromide-iodide crystals are used as infrared lenses; and thallium-201 (a radioactive isotope) is used in cardiac stress tests to image blood flow in the heart muscle. Thallium compounds are also used in some speciality low-melting glasses. Due to its toxicity, many former applications have been discontinued.' },
    { n:82, sym:'Pb', name:'Lead',           mass:207.2,    cat:'post-transition',period:6, group:14, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p²',  melt:327.46, boil:1749, density:11.34,    discovered:null, state:'solid',  electronegativity:2.33, shells:[2,8,18,32,18,4],  desc:'Lead is a dense, soft, highly malleable post-transition metal that has been used by humans for over 6,000 years, most notably by the Romans who used lead for water pipes, cooking vessels, and even as a wine sweetener (lead acetate — a dangerous practice that may have contributed to widespread lead poisoning in the Roman aristocracy). Lead is the heaviest stable element. Despite its toxicity (it is a potent neurotoxin that accumulates in bones and damages brain development, particularly in children), lead still has important uses: it is the dominant material in lead-acid car batteries, and it provides radiation shielding in X-ray rooms and nuclear facilities. Leaded petrol was phased out globally by 2021. Lead is used in organ pipe alloys and in soldering. Lead-210 is used in radiometric dating of sediments.' },
    { n:83, sym:'Bi', name:'Bismuth',        mass:208.98,   cat:'post-transition',period:6, group:15, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p³',  melt:271.3, boil:1564, density:9.787,    discovered:null, state:'solid',  electronegativity:2.02, shells:[2,8,18,32,18,5],  desc:'Bismuth is a lustrous, brittle, pink-tinted post-transition metal with a beautiful rainbow oxide tarnish (showing blue, pink, and yellow iridescence). It is the most naturally diamagnetic element (it strongly repels magnetic fields) and has the lowest thermal conductivity of all metals except mercury. Bismuth is famously used in Pepto-Bismol (bismuth subsalicylate) to treat indigestion, diarrhoea, and nausea — it is one of the few heavy metals with low toxicity at medical doses. It is also used in low-melting-point alloys (such as Wood\'s metal, which melts around 70 °C) used in automatic fire sprinklers and fusible plugs. Bismuth is an environmentally friendly replacement for lead in shotgun pellets, fishing sinkers, and some solder alloys. Remarkably, bismuth-209 was once thought to be stable but was found in 2003 to be radioactive with a half-life of 1.9 × 10¹⁹ years.' },
    { n:84, sym:'Po', name:'Polonium',       mass:209,      cat:'post-transition',period:6, group:16, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁴',  melt:254,   boil:962,     density:9.196,    discovered:1898, state:'solid',  electronegativity:2.00, shells:[2,8,18,32,18,6],  desc:'Polonium was discovered in 1898 by Marie and Pierre Curie and named after Marie\'s homeland, Poland. It was the first element discovered by the Curies and the first element discovered based on its radioactivity rather than its chemical properties. All isotopes of polonium are radioactive; polonium-210 is one of the most intensely radioactive substances known — it emits alpha particles at a rate that makes a gram of it spontaneously heat to hundreds of degrees. This heat is harnessed in some space missions (Lunokhod rovers). Its primary non-research use is in anti-static devices (in film handling, photographic printing, and textile manufacturing). Polonium-210 gained international notoriety in 2006 when it was used to poison and kill Alexander Litvinenko, a former Russian intelligence officer, in London.' },
    { n:85, sym:'At', name:'Astatine',       mass:210,      cat:'halogen',        period:6, group:17, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁵',  melt:302,   boil:337,     density:7,        discovered:1940, state:'solid',  electronegativity:2.20, shells:[2,8,18,32,18,7],  desc:'Astatine is the rarest naturally occurring element — at any given moment, only about 25 grams exist in the entire Earth\'s crust (produced by natural radioactive decay of uranium and thorium). It is also the heaviest halogen. Its name comes from the Greek "astatos" (unstable). All isotopes are radioactive; the most stable, astatine-210, has a half-life of only 8.1 hours, making it extremely difficult to study. As a halogen, astatine is expected to behave somewhat like iodine but with more metallic character. The most promising application is in targeted alpha therapy for cancer — because astatine-211 (half-life 7.2 hours) emits alpha particles that have a very short range in tissue, it can be attached to tumour-targeting molecules to deliver precise, localised radiation to cancer cells while sparing surrounding healthy tissue.' },
    { n:86, sym:'Rn', name:'Radon',          mass:222,      cat:'noble-gas',      period:6, group:18, config:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁶',  melt:-71,   boil:-61.7,   density:0.00973,  discovered:1900, state:'gas',    electronegativity:null, shells:[2,8,18,32,18,8],  desc:'Radon is a colourless, odourless, radioactive noble gas produced by the radioactive decay of radium in the Earth\'s crust (ultimately from uranium decay). Despite being a noble gas, radon is the second leading cause of lung cancer in many countries (after cigarette smoking), because it seeps through soil and rock and can accumulate in poorly ventilated buildings. Radon-222 has a half-life of 3.8 days and decays into radioactive solid "daughters" (polonium, lead, bismuth) that can lodge in lung tissue. Health authorities recommend testing homes for radon levels. Historically, radon was used in cancer radiotherapy (replacing radium needles), but has largely been replaced by safer alternatives. Radon gas emanating from the ground has been studied as a potential precursor to earthquakes.' },
    { n:87, sym:'Fr', name:'Francium',       mass:223,      cat:'alkali-metal',   period:7, group:1,  config:'[Rn] 7s¹',             melt:27,      boil:677,     density:1.87,     discovered:1939, state:'solid',  electronegativity:0.70, shells:[2,8,18,32,18,8,1],  desc:'Francium is the second rarest naturally occurring element (after astatine) and the most unstable of the naturally occurring elements. It was the last element to be discovered in nature (1939) and was found by Marguerite Perey, the first woman to be elected to the French Academy of Sciences. Named after France, it is so rare that scientists estimate at most a few hundred grams exist in the entire Earth\'s crust at any one time (produced by actinium decay). The most stable isotope, francium-223, has a half-life of just 22 minutes. Francium is the most electropositive and most alkaline element. It is highly radioactive and so rare that it has no commercial uses. It is studied in tiny quantities (a few thousand atoms at a time) to test fundamental atomic theory and quantum mechanics.' },
    { n:88, sym:'Ra', name:'Radium',         mass:226,      cat:'alkaline-earth', period:7, group:2,  config:'[Rn] 7s²',             melt:700,     boil:1737,    density:5.5,      discovered:1898, state:'solid',  electronegativity:0.90, shells:[2,8,18,32,18,8,2],  desc:'Radium was discovered in 1898 by Marie and Pierre Curie, who extracted it (along with polonium) from tonnes of uranium ore in a gruelling multi-year process. Radium was the element that made Marie Curie famous — she won Nobel Prizes in both Physics (1903) and Chemistry (1911). Radium is intensely radioactive; it glows faintly blue-green in the dark as it ionises the air. Radium was used in luminous paint for clock dials and instrument panels from the 1910s to 1960s (the "Radium Girls" who painted these dials suffered devastating radiation-induced bone cancer). It was also used in cancer therapy before safer alternatives were developed. Today, radium-223 (Xofigo) is an approved treatment for bone metastases in prostate cancer. All radium isotopes are radioactive; radium-226 has a half-life of 1,600 years.' },
    { n:89, sym:'Ac', name:'Actinium',       mass:227,      cat:'actinide',       period:7, group:3,  config:'[Rn] 6d¹ 7s²',         melt:1050,    boil:3200,    density:10.07,    discovered:1899, state:'solid',  electronegativity:1.10, shells:[2,8,18,32,18,9,2],  desc:'Actinium is a soft, silvery-white radioactive metal that glows pale blue in the dark due to the ionisation of surrounding air by its radiation. It was discovered in 1899 — the second radioactive element to be discovered after uranium — and gives its name to the actinide series of elements. Actinium is extremely rare in nature; it exists only in trace amounts in uranium and thorium ores as a product of radioactive decay. Actinium-225 (Ac-225) has become one of the most important isotopes in nuclear medicine: it is the parent isotope used to produce bismuth-213 for targeted alpha therapy, a promising approach to cancer treatment. Ac-225 itself is being investigated directly as a targeted alpha therapy agent for prostate cancer and other malignancies. Actinium-228 is used in neutron sources.' },
    { n:90, sym:'Th', name:'Thorium',        mass:232.038,  cat:'actinide',       period:7, group:null,config:'[Rn] 6d² 7s²',        melt:1750,    boil:4788,    density:11.72,    discovered:1829, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,18,10,2], desc:'Thorium is a soft, paramagnetic, bright silvery-white actinide metal that tarnishes to a grey colour in air. It is named after Thor, the Norse god of thunder. Thorium is about three to four times more abundant in Earth\'s crust than uranium, and like uranium it is radioactive, but its dominant isotope (Th-232) has a half-life of 14 billion years — slightly longer than the age of the universe — meaning it decays very slowly and is mildly radioactive. Thorium is being seriously investigated as an alternative nuclear fuel: a thorium reactor (particularly a liquid fluoride thorium reactor, or LFTR) could produce energy from thorium with far less long-lived radioactive waste than uranium reactors, and it cannot be easily weaponised. Historically, thorium was used in gas lamp mantles (thoriated mantles glow brilliantly when heated) and in magnesium-thorium alloys for aerospace.' },
    { n:91, sym:'Pa', name:'Protactinium',   mass:231.036,  cat:'actinide',       period:7, group:null,config:'[Rn] 5f² 6d¹ 7s²',   melt:1572,    boil:4000,    density:15.37,    discovered:1913, state:'solid',  electronegativity:1.50, shells:[2,8,18,32,20,9,2],  desc:'Protactinium is a dense, highly toxic, radioactive actinide metal. Its name means "before actinium" because protactinium-231 decays to actinium-227. It was the first isotope to be discovered, in 1913, but the element\'s name was not established until 1949. Protactinium is exceptionally rare — its most stable isotope (Pa-231) has a half-life of 32,760 years and exists only in tiny quantities in uranium ores (about 3 parts per million of uranium ore is Pa-231). Due to its rarity, toxicity, and radioactivity, protactinium has few practical applications. It is used in research — specifically, the ratio of Pa-231 to thorium-230 in ocean sediments and corals is used for oceanographic dating (Pa/Th dating) to study past ocean circulation patterns and climate change over tens of thousands of years.' },
    { n:92, sym:'U',  name:'Uranium',        mass:238.029,  cat:'actinide',       period:7, group:null,config:'[Rn] 5f³ 6d¹ 7s²',   melt:1135,    boil:4131,    density:19.1,     discovered:1789, state:'solid',  electronegativity:1.38, shells:[2,8,18,32,21,9,2],  desc:'Uranium is a dense, silvery-white radioactive metal and the heaviest naturally occurring element. Named after the planet Uranus (discovered around the same time), it was isolated in 1841. Uranium consists primarily of two isotopes: U-238 (99.3%, half-life 4.5 billion years) and U-235 (0.7%, half-life 700 million years). The rarer U-235 is fissile — when struck by a slow neutron, it splits and releases a large amount of energy plus more neutrons (chain reaction). This is the basis of nuclear power (which provides about 10% of global electricity) and atomic weapons. "Enrichment" increases the proportion of U-235. Depleted uranium (mostly U-238) is extremely dense (1.7 times denser than lead) and is used in armour-piercing ammunition and radiation shielding. Before its radioactivity was discovered, uranium compounds were used as a yellow-orange glass colourant (uranium glass).' },
    { n:93, sym:'Np', name:'Neptunium',      mass:237,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f⁴ 6d¹ 7s²',   melt:639,     boil:4000,    density:20.45,    discovered:1940, state:'solid',  electronegativity:1.36, shells:[2,8,18,32,22,9,2],  desc:'Neptunium was the first transuranic element (beyond uranium) to be synthesised, created in 1940 at Berkeley by Edwin McMillan and Philip Abelson by bombarding uranium-238 with neutrons. It is named after the planet Neptune, following the pattern of uranium (Uranus) and anticipating plutonium (Pluto). Neptunium-237, the most stable isotope (half-life 2.14 million years), is produced as a by-product in nuclear reactors from U-235 via neutron capture and beta decay. Although it accumulates in significant quantities in spent nuclear fuel (a few kilograms per tonne), it has limited applications. It is used as a trigger in nuclear weapons (as a neutron reflector) and is being studied for potential use in radioisotope thermoelectric generators for deep-space missions. Neptunium is a proliferation concern because it can be converted into weapons-usable fissile material.' },
    { n:94, sym:'Pu', name:'Plutonium',      mass:244,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f⁶ 7s²',        melt:640,     boil:3228,    density:19.816,   discovered:1940, state:'solid',  electronegativity:1.28, shells:[2,8,18,32,24,8,2],  desc:'Plutonium is the most consequential transuranic element — it was produced in 1940 and was used in the first nuclear bomb tested (Trinity, July 1945) and in the atomic bomb dropped on Nagasaki. Named after Pluto (then considered a planet), it is fissile in its Pu-239 isotope, which is produced in nuclear reactors when U-238 captures a neutron. Plutonium is notoriously difficult to handle: it exists in six different crystal structures (allotropes) at different temperatures, and its intense radioactivity means it generates significant heat (it is warm to the touch). This heat is harnessed in radioisotope thermoelectric generators (RTGs) — the "nuclear batteries" that power deep-space probes including Voyager 1, New Horizons, and the Mars Science Laboratory. Plutonium is acutely toxic both due to its radioactivity and chemical toxicity.' },
    { n:95, sym:'Am', name:'Americium',      mass:243,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f⁷ 7s²',        melt:1176,    boil:2607,    density:13.67,    discovered:1944, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,25,8,2],  desc:'Americium is a synthetic radioactive actinide metal, named after the Americas. It was first synthesised in 1944 at the University of Chicago as part of the Manhattan Project. Americium has the remarkable distinction of being the only synthetic element found in nearly every home in the world — its isotope Am-241 is used in ionisation-type smoke detectors. A tiny amount (about one microcurie) is placed between two electrically charged plates; the alpha radiation ionises the air and creates a small current. When smoke particles enter the chamber, they absorb the alpha particles, the current drops, and the alarm triggers. Americium is also used in some industrial gauges for measuring thickness and density of materials. Like plutonium, it generates heat through radioactive decay and has been considered for RTGs.' },
    { n:96, sym:'Cm', name:'Curium',         mass:247,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f⁷ 6d¹ 7s²',   melt:1345,    boil:3110,    density:13.51,    discovered:1944, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,25,9,2],  desc:'Curium is a hard, dense, silvery radioactive actinide that was synthesised in 1944 by Glenn Seaborg, Ralph James, and Albert Ghiorso by bombarding plutonium-239 with helium ions. It was named in honour of Marie and Pierre Curie in recognition of their pioneering work on radioactivity. Curium glows red in the dark due to the intense heat from its radioactive decay — a sample of curium-244 generates about 2.8 watts of heat per gram. This property is exploited in radioisotope thermoelectric generators for deep-space power. The Alpha Particle X-ray Spectrometer (APXS) on Mars rovers including Spirit, Opportunity, and Curiosity contained curium-244 as an alpha particle source for analysing the chemical composition of Martian rocks and soil. Curium is also used as a source for producing other transuranic elements.' },
    { n:97, sym:'Bk', name:'Berkelium',      mass:247,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f⁹ 7s²',        melt:986,     boil:null,    density:14.78,    discovered:1949, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,27,8,2],  desc:'Berkelium is a radioactive synthetic actinide metal named after Berkeley, California, where it was first synthesised in 1949 by Stanley Thompson, Glenn Seaborg, and Albert Ghiorso at the Lawrence Berkeley National Laboratory by bombarding americium-241 with helium ions. Its most stable isotope, berkelium-247, has a half-life of 1,380 years. Berkelium has no practical applications outside of scientific research, but it plays an important role as a "target" element — very tiny quantities of berkelium-249 are produced in nuclear reactors and then used as a target for heavy ion bombardment to create even heavier elements. In 2010, the element tennessine (element 117) was first synthesised by bombarding a berkelium-249 target with calcium-48 ions at Dubna, Russia.' },
    { n:98, sym:'Cf', name:'Californium',    mass:251,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f¹⁰ 7s²',       melt:900,     boil:null,    density:15.1,     discovered:1950, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,28,8,2],  desc:'Californium is a radioactive actinide metal synthesised in 1950 at Berkeley and named after the state of California and the University of California. It is one of the few transuranic elements that has practical applications. Californium-252 is one of the most potent neutron-emitting radioisotopes known — one microgram emits 170 million neutrons per minute through spontaneous fission. This makes it invaluable as a portable neutron source: it is used to start up nuclear reactors; in neutron activation analysis for detecting trace elements; in cancer treatment (californium-252 brachytherapy); in airport security (neutron probes to detect explosives and drugs); and in oil well logging to detect oil and gas pockets. One gram of Cf-252 is worth approximately $27 million — one of the most expensive substances on Earth.' },
    { n:99, sym:'Es', name:'Einsteinium',    mass:252,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f¹¹ 7s²',       melt:860,     boil:null,    density:8.84,     discovered:1952, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,29,8,2],  desc:'Einsteinium is a synthetic radioactive actinide metal named after Albert Einstein. It was first identified in December 1952 in the radioactive fallout from the "Ivy Mike" thermonuclear device (the first hydrogen bomb) detonated in the Pacific Ocean — the extreme neutron flux of the explosion drove uranium-238 nuclei through multiple neutron captures and beta decays, creating new heavy elements including einsteinium and fermium. Its discovery was kept classified for several years. Einsteinium is only produced in tiny quantities (micrograms) in specialised high-flux nuclear reactors. It has no practical applications and is only studied in research contexts. In 2021, scientists for the first time studied the chemistry of einsteinium in solution, measuring its bond lengths using synchrotron X-ray techniques.' },
    { n:100,sym:'Fm', name:'Fermium',        mass:257,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f¹² 7s²',       melt:1527,    boil:null,    density:null,     discovered:1952, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,30,8,2],  desc:'Fermium is a synthetic radioactive actinide metal named after the nuclear physicist Enrico Fermi, who developed the first artificial nuclear reactor. Like einsteinium, it was first discovered in the radioactive debris of the first hydrogen bomb test in 1952 and remained classified for several years. Fermium-257 is the most stable isotope, with a half-life of 100.5 days. Fermium represents an important limit in nuclear chemistry: it is the heaviest element that can be produced (in weighable quantities) by bombarding lighter elements with neutrons in a nuclear reactor. Beyond fermium, elements must be made by heavy-ion bombardment in accelerators, which only creates atoms a few at a time. Due to its very limited availability and intense radioactivity, fermium has no practical applications and is studied purely in research.' },
    { n:101,sym:'Md', name:'Mendelevium',    mass:258,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f¹³ 7s²',       melt:827,     boil:null,    density:null,     discovered:1955, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,31,8,2],  desc:'Mendelevium is a synthetic radioactive actinide metal named after Dmitri Mendeleev, the Russian chemist who devised the periodic table. It was first synthesised in 1955 by Glenn Seaborg, Bernard Harvey, Gregory Choppin, Stanley Thompson, and Albert Ghiorso by bombarding einsteinium-253 with alpha particles in the cyclotron at Berkeley. At the time, only about 17 atoms were produced in the first experiment. Mendelevium-258 is the most stable isotope, with a half-life of 51.5 days. Mendelevium was the first element to be produced one atom at a time. It has no practical applications outside nuclear research. Its chemistry, studied in microscopic quantities, shows it behaves as expected for a trivalent actinide, consistent with the patterns established by the lighter actinides.' },
    { n:102,sym:'No', name:'Nobelium',       mass:259,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f¹⁴ 7s²',       melt:827,     boil:null,    density:null,     discovered:1966, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,32,8,2],  desc:'Nobelium is a synthetic radioactive actinide metal named after Alfred Nobel, the Swedish chemist who invented dynamite and established the Nobel Prizes. Its discovery was disputed between Soviet and American research teams for years. The first unambiguous synthesis was achieved at Dubna, Russia, in 1966. Nobelium-259 is the most stable isotope, with a half-life of 58 minutes. Nobelium is unique among the actinides in that it prefers the +2 oxidation state in solution (rather than the +3 state typical of other actinides), because the +2 state corresponds to a particularly stable filled 5f¹⁴ electron configuration. This makes it behave somewhat like a heavy alkaline earth metal. Nobelium has no practical applications and is only produced in atoms-at-a-time quantities for fundamental nuclear research.' },
    { n:103,sym:'Lr', name:'Lawrencium',     mass:262,      cat:'actinide',       period:7, group:null,config:'[Rn] 5f¹⁴ 7s² 7p¹',  melt:1627,    boil:null,    density:null,     discovered:1961, state:'solid',  electronegativity:1.30, shells:[2,8,18,32,32,8,3],  desc:'Lawrencium is the last actinide element and was first synthesised in 1961 at Berkeley by Albert Ghiorso, Torbjørn Sikkeland, Almon Larsh, and Robert Latimer by bombarding californium with boron ions. It is named after Ernest Orlando Lawrence, the inventor of the cyclotron particle accelerator and founder of the Lawrence Berkeley National Laboratory — the institution responsible for discovering or confirming many transuranic elements. Lawrencium-266 is the most stable isotope, with a half-life of about 11 hours. As the last actinide, lawrencium completes the 5f electron shell. Its chemistry has been studied in tiny quantities: experiments suggest it behaves more like a heavy rare earth element (trivalent) rather than a heavy actinide, which is consistent with having a complete 5f shell. It has no practical applications.' },
    { n:104,sym:'Rf', name:'Rutherfordium',  mass:267,      cat:'transition',     period:7, group:4,  config:'[Rn] 5f¹⁴ 6d² 7s²',  melt:2100,    boil:5500,    density:23.2,     discovered:1964, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,10,2], desc:'Rutherfordium is the first transactinide element — the first element beyond the actinides — and was synthesised in 1964 at Dubna, Russia (and confirmed later at Berkeley). It is named after Ernest Rutherford, the New Zealand-born physicist who discovered the atomic nucleus and pioneered nuclear physics. The most stable isotope, Rf-267, has a half-life of about 1.3 hours. Rutherfordium is produced by bombarding californium-249 (or curium-248) with carbon (or oxygen) ions in particle accelerators. Only a few hundred atoms have ever been made. Its chemistry, studied one atom at a time using rapid radiochemical techniques, confirms it behaves like a heavier hafnium (Group 4 element), as expected from periodic table trends. It has no practical applications and is studied purely for understanding nuclear structure and the limits of the periodic table.' },
    { n:105,sym:'Db', name:'Dubnium',        mass:268,      cat:'transition',     period:7, group:5,  config:'[Rn] 5f¹⁴ 6d³ 7s²',  melt:null,    boil:null,    density:29.3,     discovered:1968, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,11,2], desc:'Dubnium is a highly radioactive synthetic transactinide element. Its discovery was disputed between Dubna (Russia) and Berkeley (USA) throughout the 1960s and 70s — the IUPAC eventually approved the name dubnium (after Dubna, the Russian research city) in 1997. The most stable isotope, Db-268, has a half-life of about 29 hours. Dubnium is produced by bombarding californium-249 with nitrogen ions in heavy-ion accelerators. Only nanogram quantities have ever been detected. Its chemistry, studied atom by atom, appears to be consistent with Group 5 behaviour (similar to tantalum and niobium), though some anomalies have been observed. Relativistic effects on electrons in very heavy elements can cause unexpected chemical behaviour, and studying elements like dubnium helps test theoretical models of relativistic quantum chemistry.' },
    { n:106,sym:'Sg', name:'Seaborgium',     mass:271,      cat:'transition',     period:7, group:6,  config:'[Rn] 5f¹⁴ 6d⁴ 7s²',  melt:null,    boil:null,    density:35.0,     discovered:1974, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,12,2], desc:'Seaborgium was first synthesised in 1974 at Berkeley by a team led by Albert Ghiorso. It is named after Glenn Theodore Seaborg, the American chemist who discovered or co-discovered ten transuranium elements — seaborgium is one of only two elements named after a living person at the time of naming (Seaborg was alive when the name was approved in 1994; he died in 1999). The most stable isotope, Sg-271, has a half-life of about 2.4 minutes. Its chemistry has been studied using gas-phase and aqueous techniques; it behaves like a heavier tungsten (Group 6), forming oxohalide compounds similar to WO₂Cl₂. Seaborgium has no practical applications. Understanding its chemistry contributes to testing relativistic effects on chemical behaviour at the extreme end of the periodic table.' },
    { n:107,sym:'Bh', name:'Bohrium',        mass:272,      cat:'transition',     period:7, group:7,  config:'[Rn] 5f¹⁴ 6d⁵ 7s²',  melt:null,    boil:null,    density:37.1,     discovered:1981, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,13,2], desc:'Bohrium was first synthesised in 1981 by a team at GSI Helmholtz Centre for Heavy Ion Research in Darmstadt, Germany, led by Peter Armbruster and Gottfried Münzenberg. It is named after Niels Bohr, the Danish physicist who developed the Bohr model of the atom and made foundational contributions to quantum mechanics. The most stable isotope, Bh-270, has a half-life of about 61 seconds. Bohrium is produced by bombarding bismuth-209 with chromium-54 ions. Only about 100 atoms have ever been observed. Its chemistry has been partially studied in the gas phase; it behaves as expected for a Group 7 element (homologue of rhenium and manganese), forming Bh₂O₇ and BhO₃Cl compounds analogous to those of rhenium. Bohrium has no practical applications.' },
    { n:108,sym:'Hs', name:'Hassium',        mass:277,      cat:'transition',     period:7, group:8,  config:'[Rn] 5f¹⁴ 6d⁶ 7s²',  melt:null,    boil:null,    density:40.7,     discovered:1984, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,14,2], desc:'Hassium was first synthesised in 1984 at GSI Darmstadt by the same team that discovered bohrium, led by Peter Armbruster and Gottfried Münzenberg. It is named after the German state of Hesse (Latin: Hassia) where Darmstadt is located. The most stable isotope, Hs-269, has a half-life of about 9.7 seconds. Hassium is produced by bombarding lead-208 with iron-58 ions. Its chemistry has been partially studied in the gas phase — hassium tetroxide (HsO₄) was successfully synthesised and found to have properties very similar to osmium tetroxide (OsO₄), confirming that hassium behaves as a heavier osmium (Group 8), with relativistic effects not significantly disrupting expected periodicity. This was a landmark result confirming that superheavy elements still largely follow periodic trends. Hassium has no practical applications.' },
    { n:109,sym:'Mt', name:'Meitnerium',     mass:278,      cat:'transition',     period:7, group:9,  config:'[Rn] 5f¹⁴ 6d⁷ 7s²',  melt:null,    boil:null,    density:37.4,     discovered:1982, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,15,2], desc:'Meitnerium was first synthesised in 1982 at GSI Darmstadt by bombarding bismuth-209 with iron-58 ions. It is named after Lise Meitner, the Austrian-Swedish physicist who co-discovered nuclear fission in 1938 alongside Otto Hahn and Fritz Strassmann. Despite the fundamental importance of this discovery (for which Hahn alone received the Nobel Prize in 1944 — a controversial decision that is now widely regarded as a serious injustice), Meitner did not receive the Nobel Prize. Naming element 109 after her is considered a belated recognition. The most stable isotope, Mt-278, has a half-life of about 4 seconds. Meitnerium has no practical applications; it is produced only in particle accelerators and has been studied in extremely limited quantities.' },
    { n:110,sym:'Ds', name:'Darmstadtium',   mass:281,      cat:'transition',     period:7, group:10, config:'[Rn] 5f¹⁴ 6d⁸ 7s²',  melt:null,    boil:null,    density:34.8,     discovered:1994, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,16,2], desc:'Darmstadtium was first synthesised in 1994 at GSI Darmstadt by bombarding lead-208 with nickel-62 ions. It is named after the city of Darmstadt, Germany, where it was discovered. As expected for a Group 10 element, it should be a heavier homologue of nickel, palladium, and platinum. The most stable isotope, Ds-281, has a half-life of about 12.7 seconds. Darmstadtium exists only as individual atoms and decays too quickly for its chemistry to be studied in bulk. Theoretical calculations predict it will have unusual properties due to relativistic effects: its 6d electrons are expected to be significantly stabilised, potentially causing it to have different chemical behaviour from platinum. It has no practical applications and is of interest purely for advancing our understanding of nuclear structure and the limits of the periodic table.' },
    { n:111,sym:'Rg', name:'Roentgenium',    mass:282,      cat:'transition',     period:7, group:11, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s¹', melt:null,    boil:null,    density:28.7,     discovered:1994, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,17,2], desc:'Roentgenium was first synthesised in 1994 at GSI Darmstadt by bombarding bismuth-209 with nickel-64 ions. It is named after Wilhelm Röntgen, the German physicist who discovered X-rays in 1895 (for which he received the very first Nobel Prize in Physics in 1901). As a Group 11 element, roentgenium is the heaviest known homologue of copper, silver, and gold. The most stable isotope, Rg-282, has a half-life of about 2 minutes. Relativistic effects on roentgenium\'s electron configuration are predicted to be extreme: its 6d electrons are very strongly stabilised, which could cause it to be less reactive than gold and potentially prefer unusual oxidation states. Theoretical models suggest it may actually prefer the +5 oxidation state (unlike its lighter congeners gold and silver). It has no practical applications.' },
    { n:112,sym:'Cn', name:'Copernicium',    mass:285,      cat:'transition',     period:7, group:12, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s²', melt:null,    boil:null,    density:23.7,     discovered:1996, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,18,2], desc:'Copernicium was first synthesised in 1996 at GSI Darmstadt by bombarding lead-208 with zinc-70 ions. It is named after the Renaissance astronomer Nicolaus Copernicus, who proposed the heliocentric model of the solar system. The most stable isotope, Cn-285, has a half-life of about 29 seconds. Copernicium is predicted to have extremely unusual properties due to strong relativistic effects: its filled 6d and 7s electron shells are very tightly bound, meaning it may behave more like a noble gas than a metal — possibly existing as a gas at room temperature rather than a solid metal. If confirmed, this would make copernicium the first element whose ground state is not a solid at standard conditions while also being classified as a metal. Initial experiments (studying single atoms deposited on gold) are consistent with volatile, noble-gas-like behaviour.' },
    { n:113,sym:'Nh', name:'Nihonium',       mass:286,      cat:'post-transition',period:7, group:13, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p¹', melt:null, boil:null,    density:16.0,     discovered:2004, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,18,3], desc:'Nihonium was first synthesised in 2004 at the RIKEN institute in Japan and confirmed in 2012, making it the first element discovered in Asia. It is named after Japan (Nihon in Japanese). RIKEN began experiments to create element 113 in 2003 by bombarding bismuth-209 with zinc-70 ions in the RIKEN Linear Accelerator. After nine years of experiments producing only three detected atoms, IUPAC credited the discovery to Japan in 2015. Nihonium\'s most stable isotope, Nh-286, has a half-life of about 20 seconds. As a Group 13 element, it should be a heavier analogue of thallium. Relativistic effects are predicted to make it more inert than thallium and to affect its boiling and melting points significantly. The achievement is a point of immense national pride in Japan, representing years of patient, meticulous scientific work.' },
    { n:114,sym:'Fl', name:'Flerovium',      mass:289,      cat:'post-transition',period:7, group:14, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p²', melt:null, boil:null,    density:14.0,     discovered:1998, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,18,4], desc:'Flerovium was first synthesised in 1998 at the Joint Institute for Nuclear Research (JINR) in Dubna, Russia, by a collaboration with Lawrence Livermore National Laboratory in the USA. It is named after the Flerov Laboratory of Nuclear Reactions at JINR, which is itself named after Georgy Flyorov, the Soviet physicist who pioneered the synthesis of superheavy elements. The most stable isotope, Fl-289, has a half-life of about 2.6 seconds. Flerovium is predicted to be near the "island of stability" — a theoretical region of the nuclear chart where superheavy elements are expected to have much longer half-lives due to complete nuclear shells. As a Group 14 element, it is expected to be a heavier homologue of lead, but relativistic effects may make it volatile and inert, possibly gaseous at room temperature.' },
    { n:115,sym:'Mc', name:'Moscovium',      mass:290,      cat:'post-transition',period:7, group:15, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p³', melt:null, boil:null,    density:13.5,     discovered:2003, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,18,5], desc:'Moscovium was first synthesised in 2003 in a collaboration between JINR Dubna (Russia) and Lawrence Livermore National Laboratory (USA) by bombarding americium-243 with calcium-48 ions. It was officially named in 2016 after the Moscow Oblast, the Russian federal subject where Dubna is located. The most stable isotope, Mc-290, has a half-life of about 650 milliseconds. Moscovium is a Group 15 element and is expected to be a heavier homologue of bismuth. Only about 100 atoms have ever been observed. Its decay chain passes through nihonium (element 113), which provided important evidence for the discovery of nihonium. Theoretical predictions suggest moscovium will have properties very different from bismuth due to extreme relativistic effects, possibly displaying some noble-gas-like inertness. It has no practical applications.' },
    { n:116,sym:'Lv', name:'Livermorium',    mass:293,      cat:'post-transition',period:7, group:16, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁴', melt:null, boil:null,    density:12.9,     discovered:2000, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,18,6], desc:'Livermorium was first synthesised in 2000 at JINR Dubna in collaboration with Lawrence Livermore National Laboratory, by bombarding curium-248 with calcium-48 ions. It is named after Lawrence Livermore National Laboratory in Livermore, California. The most stable isotope, Lv-293, has a half-life of about 61 milliseconds. Livermorium is a Group 16 element and is expected to be a heavier homologue of polonium (itself a post-transition metal/metalloid). Only a few atoms have ever been produced. Theoretical predictions suggest significant relativistic effects will make its chemistry very different from the lighter chalcogens (oxygen, sulfur, selenium, tellurium, polonium). Its decay products (flerovium and copernicium isotopes) have been studied to understand the nuclear structure near the predicted "island of stability." It has no practical applications.' },
    { n:117,sym:'Ts', name:'Tennessine',     mass:294,      cat:'halogen',        period:7, group:17, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁵', melt:null, boil:null,    density:7.17,     discovered:2010, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,18,7], desc:'Tennessine was first synthesised in 2010 at JINR Dubna by a collaboration between Russia and three US institutions in Tennessee: Oak Ridge National Laboratory, Vanderbilt University, and the University of Tennessee. It is named after the state of Tennessee in recognition of these contributions. The most stable isotope, Ts-294, has a half-life of about 51 milliseconds. Tennessine is the second heaviest element ever observed (after oganesson) and the second heaviest halogen. As a Group 17 element, it is below astatine in the halogen group, but relativistic effects are expected to make it much less reactive than other halogens — it may actually behave more like a noble gas than a typical halogen. Berkleium-249 (produced in significant quantities at Oak Ridge) was used as the target, which is why Oak Ridge\'s contribution to the discovery was essential.' },
    { n:118,sym:'Og', name:'Oganesson',      mass:294,      cat:'noble-gas',      period:7, group:18, config:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁶', melt:null, boil:null,    density:4.95,     discovered:2006, state:'solid',  electronegativity:null, shells:[2,8,18,32,32,18,8], desc:'Oganesson is the heaviest known element and the last element in the periodic table as currently known. It was first synthesised in 2002 (confirmed in 2006) at JINR Dubna by bombarding californium-249 with calcium-48 ions — a feat that required over 1,000 hours of bombardment to produce just 4 atoms. It is named after Yuri Oganessian, the Russian-Armenian nuclear physicist who pioneered cold and hot fusion techniques for creating superheavy elements — one of only two elements named after a living person (the other is seaborgium). As a Group 18 element, it is nominally a noble gas, but theoretical calculations suggest that extreme relativistic effects on its electrons will make it a solid at room temperature and possibly even reactive, unlike lighter noble gases. If confirmed, oganesson would be a remarkable exception to periodic trends. Its most stable isotope, Og-294, has a half-life of about 0.7 milliseconds.' },
  ];

  /* ══════════════════════════════════════════════════
     CATEGORY COLOURS  (hex integers for Three.js)
  ══════════════════════════════════════════════════ */

  const CAT_COLORS = {
    'alkali-metal':   { bg:'#fef3c7', text:'#92400e', dark_bg:'#451a03', dark_text:'#fcd34d', hex:0xfde68a, label:'Alkali Metal' },
    'alkaline-earth': { bg:'#fef9c3', text:'#713f12', dark_bg:'#422006', dark_text:'#fde68a', hex:0xfef08a, label:'Alkaline Earth' },
    'transition':     { bg:'#dbeafe', text:'#1e3a8a', dark_bg:'#1e3a8a', dark_text:'#93c5fd', hex:0x93c5fd, label:'Transition Metal' },
    'post-transition':{ bg:'#e0e7ff', text:'#3730a3', dark_bg:'#312e81', dark_text:'#a5b4fc', hex:0xa5b4fc, label:'Post-transition' },
    'metalloid':      { bg:'#d1fae5', text:'#065f46', dark_bg:'#064e3b', dark_text:'#6ee7b7', hex:0x6ee7b7, label:'Metalloid' },
    'nonmetal':       { bg:'#dcfce7', text:'#14532d', dark_bg:'#14532d', dark_text:'#86efac', hex:0x86efac, label:'Nonmetal' },
    'halogen':        { bg:'#f0fdf4', text:'#166534', dark_bg:'#052e16', dark_text:'#4ade80', hex:0x4ade80, label:'Halogen' },
    'noble-gas':      { bg:'#fae8ff', text:'#6b21a8', dark_bg:'#3b0764', dark_text:'#e879f9', hex:0xe879f9, label:'Noble Gas' },
    'lanthanide':     { bg:'#ffedd5', text:'#9a3412', dark_bg:'#431407', dark_text:'#fdba74', hex:0xfdba74, label:'Lanthanide' },
    'actinide':       { bg:'#ffe4e6', text:'#9f1239', dark_bg:'#4c0519', dark_text:'#fda4af', hex:0xfda4af, label:'Actinide' },
  };

  const STATE_COLORS = {
    'solid':  { label:'Solid',  color:'#6366f1' },
    'liquid': { label:'Liquid', color:'#0ea5e9' },
    'gas':    { label:'Gas',    color:'#10b981' },
  };

  const CAT_COUNTS = {};
  ELEMENTS.forEach(el => { CAT_COUNTS[el.cat] = (CAT_COUNTS[el.cat] || 0) + 1; });

  /* ══════════════════════════════════════════════════
     GRID POSITION HELPER  (same logic as original)
  ══════════════════════════════════════════════════ */

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

  // Three.js handles
  let _renderer    = null;
  let _scene       = null;
  let _camera      = null;
  let _controls    = null;
  let _rafId       = null;
  let _tileMeshes  = {};   // n → mesh
  let _raycaster   = null;
  let _pointer     = new (function(){ this.x=0; this.y=0; })();
  let _canvas      = null;
  let _resizeObs   = null;
  let _labelCanvas = null; // offscreen canvas for tile textures
  let _textureCache = {};

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
        background:var(--bg-page);overflow:hidden;
        font-family:var(--font);user-select:none;-webkit-user-select:none;">

        ${_buildTopBar()}

        <!-- Category filter strip -->
        <div id="pt-filters" style="
          flex-shrink:0;display:flex;align-items:center;gap:.35rem;
          padding:.3rem .75rem;border-bottom:1px solid var(--border);
          overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;">
          <button onclick="ThreeDPeriodic._setFilter(null)" id="pt-filter-all"
                  style="flex-shrink:0;font-size:.575rem;font-weight:800;letter-spacing:.05em;
                         text-transform:uppercase;padding:3px 9px;border-radius:99px;
                         border:1px solid var(--accent);background:var(--accent);
                         color:#fff;cursor:pointer;white-space:nowrap;font-family:var(--font);">
            All · 118
          </button>
          ${Object.entries(CAT_COLORS).map(([cat, c]) => `
            <button onclick="ThreeDPeriodic._setFilter('${cat}')" id="pt-filter-${cat}"
                    data-cat="${cat}"
                    style="flex-shrink:0;font-size:.575rem;font-weight:700;letter-spacing:.04em;
                           text-transform:uppercase;padding:3px 9px;border-radius:99px;
                           border:1px solid var(--border);background:var(--bg-subtle);
                           color:var(--text-3);cursor:pointer;white-space:nowrap;
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
                    style="width:28px;height:28px;border-radius:var(--r-md);
                           background:var(--bg-base);border:1px solid var(--border);
                           font-size:1.05rem;cursor:pointer;color:var(--text-2);">+</button>
            <button onclick="ThreeDPeriodic._zoom(0.84)"
                    style="width:28px;height:28px;border-radius:var(--r-md);
                           background:var(--bg-base);border:1px solid var(--border);
                           font-size:1.05rem;cursor:pointer;color:var(--text-2);">−</button>
            <button onclick="ThreeDPeriodic._resetView()"
                    style="width:28px;height:28px;border-radius:var(--r-md);
                           background:var(--bg-base);border:1px solid var(--border);
                           font-size:.6rem;cursor:pointer;color:var(--text-3);font-weight:700;">⟳</button>
          </div>

          <!-- Drag hint -->
          <div id="pt-hint" style="position:absolute;bottom:.6rem;left:50%;
               transform:translateX(-50%);font-size:.575rem;font-weight:600;
               letter-spacing:.05em;color:var(--text-4);text-transform:uppercase;
               pointer-events:none;white-space:nowrap;background:var(--bg-base);
               border:1px solid var(--border);border-radius:99px;padding:3px 10px;
               opacity:0.85;animation:pt-hint-fade 4s ease 1.5s forwards;">
            Drag to orbit · Scroll to zoom · Tap an element
          </div>

          <!-- Loading overlay -->
          <div id="pt-loading" style="position:absolute;inset:0;display:flex;
               align-items:center;justify-content:center;background:var(--bg-page);z-index:20;">
            <div style="text-align:center;">
              <div style="font-size:2rem;margin-bottom:.5rem;">⚗️</div>
              <div style="font-size:var(--text-sm);color:var(--text-3);font-weight:600;">
                Building 3D periodic table…
              </div>
            </div>
          </div>
        </div>

        <!-- Element detail panel -->
        <div id="pt-detail" style="
          flex-shrink:0;max-height:0;overflow:hidden;
          transition:max-height .32s cubic-bezier(0.16,1,0.3,1);
          background:var(--bg-base);border-top:1px solid var(--border);
          position:relative;z-index:20;">
          <div id="pt-detail-inner" style="
            padding:.625rem .875rem .875rem;overflow-y:auto;
            -webkit-overflow-scrolling:touch;max-height:55dvh;box-sizing:border-box;">
          </div>
        </div>
      </div>

      <style>
        @keyframes pt-hint-fade { 0%,70%{opacity:1}100%{opacity:0;pointer-events:none} }
        #pt-filters::-webkit-scrollbar { display:none; }
      </style>`);
  }

  function _buildTopBar() {
    return `
      <div style="display:flex;align-items:center;gap:.5rem;padding:.4rem .75rem;
                  border-bottom:1px solid var(--border);background:var(--bg-base);
                  flex-shrink:0;min-height:2.625rem;">
        <button onclick="ThreeDPeriodic._back()"
                style="display:inline-flex;align-items:center;font-size:var(--text-sm);
                       font-weight:500;color:var(--text-2);background:var(--bg-subtle);
                       border:1px solid var(--border);border-radius:var(--r-md);
                       padding:.275rem .6rem;cursor:pointer;font-family:var(--font);flex-shrink:0;">← Back</button>
        <div style="flex:1;min-width:0;">
          <div style="font-size:var(--text-base);font-weight:700;color:var(--text-1);
                      letter-spacing:-.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            Periodic Table
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:.3rem;flex-shrink:0;
                    border:1px solid var(--border);border-radius:var(--r-md);
                    background:var(--bg-subtle);padding:.275rem .5rem;width:120px;box-sizing:border-box;">
          <svg style="flex-shrink:0;color:var(--text-4);" width="12" height="12"
               viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input id="pt-search" type="text" placeholder="Search…"
                 oninput="ThreeDPeriodic._onSearch(this.value)"
                 style="border:none;outline:none;background:transparent;
                        font-size:var(--text-xs);color:var(--text-1);
                        font-family:var(--font);width:100%;padding:0;margin:0;" />
        </div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════
     THREE.JS BOOTSTRAP
  ══════════════════════════════════════════════════ */

  function _boot3D() {
    const THREE = window.THREE;
    _canvas = document.getElementById('pt-canvas');
    if (!_canvas) return;

    const wrap = document.getElementById('pt-stage');
    const W = wrap.clientWidth  || 800;
    const H = wrap.clientHeight || 500;

    /* ── Renderer ── */
    _renderer = new THREE.WebGLRenderer({ canvas: _canvas, antialias: true, alpha: true });
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _renderer.setSize(W, H);
    _renderer.setClearColor(0x000000, 0);
    _renderer.shadowMap.enabled = true;

    /* ── Scene ── */
    _scene = new THREE.Scene();

    /* ── Camera ── */
    _camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 2000);
    _camera.position.set(0, -18, 95);

    /* ── Lights ── */
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    _scene.add(new THREE.AmbientLight(0xffffff, isDark ? 0.55 : 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, isDark ? 0.7 : 0.9);
    sun.position.set(30, 60, 80);
    sun.castShadow = true;
    _scene.add(sun);
    const fill = new THREE.PointLight(0xaabbff, 0.3, 500);
    fill.position.set(-50, -30, 60);
    _scene.add(fill);

    /* ── OrbitControls ── */
    _controls = new THREE.OrbitControls(_camera, _renderer.domElement);
    _controls.enableDamping   = true;
    _controls.dampingFactor   = 0.07;
    _controls.enablePan       = true;
    _controls.panSpeed        = 1.2;
    _controls.minDistance     = 20;
    _controls.maxDistance     = 300;
    _controls.maxPolarAngle   = Math.PI * 0.72;
    _controls.autoRotate      = false;
    _controls.target.set(0, -8, 0);

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
    if (loading) loading.style.display = 'none';

    /* ── Animate ── */
    _animate();
  }

  /* ══════════════════════════════════════════════════
     TILE TEXTURE GENERATOR
     Each element face is drawn on an offscreen canvas
     then uploaded as a THREE.CanvasTexture.
  ══════════════════════════════════════════════════ */

  function _makeTileTexture(el, highlighted, dimmed) {
    const THREE = window.THREE;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const catC   = CAT_COLORS[el.cat] || CAT_COLORS['transition'];

    const SIZE = 128;
    const cv   = document.createElement('canvas');
    cv.width = cv.height = SIZE;
    const ctx = cv.getContext('2d');

    // Background
    const bgCol = highlighted
      ? (isDark ? '#fff' : '#fff')
      : dimmed
        ? '#888'
        : (isDark ? catC.dark_bg : catC.bg);
    ctx.fillStyle = bgCol;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Border
    ctx.strokeStyle = highlighted
      ? '#6366f1'
      : dimmed ? '#555' : (isDark ? catC.dark_text : catC.text);
    ctx.lineWidth = highlighted ? 5 : 2;
    ctx.strokeRect(2, 2, SIZE - 4, SIZE - 4);

    // Atomic number  (top-left)
    const textCol = highlighted
      ? '#6366f1'
      : dimmed ? '#999'
      : (isDark ? catC.dark_text : catC.text);
    ctx.fillStyle = textCol;
    ctx.font      = 'bold 18px sans-serif';
    ctx.fillText(String(el.n), 6, 22);

    // Symbol  (centre, large)
    ctx.font      = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = highlighted
      ? '#3730a3'
      : dimmed ? '#aaa'
      : (isDark ? catC.dark_text : catC.text);
    ctx.fillText(el.sym, SIZE / 2, SIZE / 2 + 18);

    // Name  (bottom, small)
    ctx.font      = 'bold 13px sans-serif';
    ctx.fillStyle = textCol;
    const shortName = el.name.length > 9 ? el.name.slice(0, 8) + '.' : el.name;
    ctx.fillText(shortName, SIZE / 2, SIZE - 10);

    const tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  /* ══════════════════════════════════════════════════
     BUILD ALL TILES
  ══════════════════════════════════════════════════ */

  function _buildAllTiles() {
    const THREE = window.THREE;

    const TILE_W  = 3.6;
    const TILE_H  = 3.8;
    const TILE_D  = 0.28;
    const GAP     = 0.22;
    const STEP_X  = TILE_W + GAP;
    const STEP_Y  = TILE_H + GAP;
    const COLS    = 18;
    const ROWS    = 10;

    // Centre the table
    const originX = -((COLS - 1) * STEP_X) / 2;
    const originY =  ((ROWS - 1) * STEP_Y) / 2;

    ELEMENTS.forEach(el => {
      const pos = _getPosition(el);
      if (!pos) return;

      const x = originX + (pos.col - 1) * STEP_X;
      // Rows 9 & 10 (lanthanides/actinides) drop a little lower
      const rowY = pos.row <= 8
        ? -(pos.row - 1) * STEP_Y
        : -(pos.row - 1) * STEP_Y - STEP_Y * 0.55;
      const y = originY + rowY;

      // Small sinusoidal Z wobble for a floating-panel feel
      const z = Math.sin(el.n * 0.18) * 0.4;

      const geo = new THREE.BoxGeometry(TILE_W, TILE_H, TILE_D);

      // Face 0 (front, +Z) gets the textured label material
      // All other faces get a plain coloured material
      const catC   = CAT_COLORS[el.cat] || CAT_COLORS['transition'];
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

      const faceTex = _makeTileTexture(el, false, false);
      const sideCol = new THREE.Color(isDark ? catC.dark_bg : catC.bg).multiplyScalar(0.72);

      const mats = [
        new THREE.MeshPhysicalMaterial({ color: sideCol, roughness:0.7, metalness:0.05 }), // +X
        new THREE.MeshPhysicalMaterial({ color: sideCol, roughness:0.7, metalness:0.05 }), // -X
        new THREE.MeshPhysicalMaterial({ color: sideCol, roughness:0.7, metalness:0.05 }), // +Y
        new THREE.MeshPhysicalMaterial({ color: sideCol, roughness:0.7, metalness:0.05 }), // -Y
        new THREE.MeshPhysicalMaterial({ map: faceTex,   roughness:0.5, metalness:0.0  }), // +Z (front)
        new THREE.MeshPhysicalMaterial({ color: sideCol, roughness:0.7, metalness:0.05 }), // -Z (back)
      ];

      const mesh = new THREE.Mesh(geo, mats);
      mesh.position.set(x, y, z);
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      mesh.userData.el   = el;
      mesh.userData.baseZ = z;

      _scene.add(mesh);
      _tileMeshes[el.n] = mesh;
    });
  }

  /* ══════════════════════════════════════════════════
     ANIMATION LOOP
  ══════════════════════════════════════════════════ */

  function _animate() {
    _rafId = requestAnimationFrame(_animate);
    _controls.update();
    _renderer.render(_scene, _camera);
  }

  /* ══════════════════════════════════════════════════
     RAYCASTING / SELECTION
  ══════════════════════════════════════════════════ */

  let _pointerDownPos = { x: 0, y: 0 };

  function _onPointerUp(e) {
    const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
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

  /* ══════════════════════════════════════════════════
     SELECT / DESELECT
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
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

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
        mesh.material[4].map = newTex;
        mesh.material[4].needsUpdate = true;
      }

      // Side colour
      const sideBase = new THREE.Color(isDark ? catC.dark_bg : catC.bg);
      const sideMult = dimmed && !selected ? 0.25 : highlighted ? 1.1 : 0.72;
      const sideCol  = sideBase.clone().multiplyScalar(sideMult);

      for (let f = 0; f < 6; f++) {
        if (f === 4) continue;
        if (Array.isArray(mesh.material)) {
          mesh.material[f].color.set(sideCol);
        }
      }

      // Lift selected tile
      mesh.position.z = mesh.userData.baseZ + (selected ? 2.2 : 0);

      // Emissive on selected
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => {
          if (m.emissive) {
            m.emissive.setHex(selected ? 0x2233aa : 0x000000);
            m.emissiveIntensity = selected ? 0.18 : 0;
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
      allBtn.style.background  = isAll ? 'var(--accent)' : 'var(--bg-subtle)';
      allBtn.style.color       = isAll ? '#fff'          : 'var(--text-3)';
      allBtn.style.borderColor = isAll ? 'var(--accent)' : 'var(--border)';
    }
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    Object.keys(CAT_COLORS).forEach(cat => {
      const btn    = document.getElementById(`pt-filter-${cat}`);
      if (!btn) return;
      const c      = CAT_COLORS[cat];
      const active = cat === activeCat;
      btn.style.background  = active ? (isDark ? c.dark_bg   : c.bg)   : 'var(--bg-subtle)';
      btn.style.color       = active ? (isDark ? c.dark_text : c.text) : 'var(--text-3)';
      btn.style.borderColor = active ? (isDark ? c.dark_text : c.text) : 'var(--border)';
      btn.style.fontWeight  = active ? '800' : '700';
    });
  }

  /* ══════════════════════════════════════════════════
     CAMERA CONTROLS
  ══════════════════════════════════════════════════ */

  function _zoom(factor) {
    const dist = _camera.position.distanceTo(_controls.target);
    const newD = Math.max(20, Math.min(300, dist / factor));
    const dir  = _camera.position.clone().sub(_controls.target).normalize();
    _camera.position.copy(_controls.target).addScaledVector(dir, newD);
  }

  function _resetView() {
    _camera.position.set(0, -18, 95);
    _controls.target.set(0, -8, 0);
    _controls.update();
  }

  /* ══════════════════════════════════════════════════
     DETAIL PANEL  (identical logic/HTML to original)
  ══════════════════════════════════════════════════ */

  function _showDetailPanel(el) {
    const panel = document.getElementById('pt-detail');
    const inner = document.getElementById('pt-detail-inner');
    if (!panel || !inner) return;

    const colors    = CAT_COLORS[el.cat] || CAT_COLORS['transition'];
    const isDark    = document.documentElement.getAttribute('data-theme') === 'dark';
    const bg        = isDark ? colors.dark_bg   : colors.bg;
    const fg        = isDark ? colors.dark_text : colors.text;
    const fmtT      = v => v === null ? '—' : v + ' °C';
    const fmtY      = v => v === null ? 'Ancient / Unknown' : v;
    const stateInfo = el.state ? STATE_COLORS[el.state] : null;

    const shellDots = (el.shells || []).map((count, i) => {
      const shellNames = ['K','L','M','N','O','P','Q'];
      return `<div style="display:flex;align-items:center;gap:3px;">
        <span style="font-size:.5rem;color:var(--text-4);font-weight:700;width:8px;">${shellNames[i]||''}</span>
        <div style="display:flex;gap:2px;flex-wrap:wrap;max-width:80px;">
          ${Array.from({length:Math.min(count,18)}).map(() =>
            `<div style="width:5px;height:5px;border-radius:50%;background:${fg};opacity:0.7;flex-shrink:0;"></div>`
          ).join('')}
        </div>
        <span style="font-size:.5rem;color:var(--text-3);margin-left:2px;">${count}</span>
      </div>`;
    }).join('');

    inner.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:.625rem;margin-bottom:.5rem;">
        <div style="width:54px;height:54px;border-radius:8px;flex-shrink:0;
                    background:${bg};border:2px solid ${fg};
                    display:flex;flex-direction:column;align-items:center;
                    justify-content:center;position:relative;">
          <div style="font-size:7.5px;font-weight:700;color:${fg};opacity:.8;line-height:1;">${el.n}</div>
          <div style="font-size:20px;font-weight:800;color:${fg};line-height:1.1;">${el.sym}</div>
          ${stateInfo ? `<div style="position:absolute;top:3px;right:3px;width:5px;height:5px;
                                     border-radius:50%;background:${stateInfo.color};"></div>` : ''}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:.375rem;flex-wrap:wrap;margin-bottom:2px;">
            <h2 style="font-size:var(--text-md);font-weight:800;color:var(--text-1);margin:0;
                       letter-spacing:-.02em;">${el.name}</h2>
            <span style="font-size:.55rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
                         padding:2px 7px;border-radius:99px;background:${bg};color:${fg};flex-shrink:0;">
              ${colors.label}
            </span>
            ${stateInfo ? `<span style="font-size:.55rem;font-weight:700;letter-spacing:.04em;
                             text-transform:uppercase;padding:2px 7px;border-radius:99px;
                             background:${stateInfo.color}22;color:${stateInfo.color};
                             flex-shrink:0;border:1px solid ${stateInfo.color}44;">
                ${stateInfo.label}</span>` : ''}
          </div>
          <div style="font-size:var(--text-xs);color:var(--text-3);line-height:1.6;">
            Mass <strong style="color:var(--text-1);">${el.mass}</strong> u
            · Period <strong style="color:var(--text-1);">${el.period}</strong>
            ${el.group ? `· Group <strong style="color:var(--text-1);">${el.group}</strong>` : ''}
            · Discovered <strong style="color:var(--text-1);">${fmtY(el.discovered)}</strong>
          </div>
          <div style="font-size:var(--text-xs);color:var(--text-3);">
            ${el.electronegativity !== null
              ? `Electronegativity <strong style="color:var(--text-1);">${el.electronegativity}</strong> (Pauling)`
              : '<em style="color:var(--text-4);">No electronegativity (noble gas)</em>'}
          </div>
          <div style="font-size:.6rem;color:var(--text-4);margin-top:1px;font-family:var(--font-mono);">
            ${el.config}
          </div>
        </div>
        <button onclick="ThreeDPeriodic._deselectElement()"
                style="flex-shrink:0;background:none;border:none;cursor:pointer;
                       font-size:1.2rem;line-height:1;padding:2px;color:var(--text-4);">×</button>
      </div>

      ${el.shells && el.shells.length ? `
      <div style="display:flex;align-items:flex-start;gap:.5rem;margin-bottom:.5rem;
                  background:var(--bg-subtle);border:1px solid var(--border);
                  border-radius:var(--r-sm);padding:.35rem .5rem;">
        <div style="font-size:.5rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;
                    color:var(--text-4);white-space:nowrap;margin-top:1px;flex-shrink:0;">
          Electron<br>Shells
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;flex:1;">${shellDots}</div>
        <div style="font-size:.5rem;color:var(--text-4);white-space:nowrap;margin-top:1px;">
          Total: <strong style="color:var(--text-1);">${el.n}</strong> e⁻
        </div>
      </div>` : ''}

      <p style="font-size:var(--text-sm);color:var(--text-2);line-height:1.6;
                margin-bottom:.5rem;border-left:2px solid ${fg};padding-left:.5rem;">
        ${el.desc}
      </p>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.275rem;">
        ${_propBadge('Melting Pt', fmtT(el.melt))}
        ${_propBadge('Boiling Pt', fmtT(el.boil))}
        ${_propBadge('Density',    el.density !== null ? el.density + ' g/cm³' : '—')}
      </div>`;

    panel.style.maxHeight = '55dvh';
  }

  function _propBadge(label, value) {
    return `
      <div style="background:var(--bg-subtle);border:1px solid var(--border);
                  border-radius:var(--r-sm);padding:.225rem .4rem;">
        <div style="font-size:.5rem;font-weight:700;text-transform:uppercase;
                    letter-spacing:.04em;color:var(--text-4);margin-bottom:1px;">${label}</div>
        <div style="font-size:var(--text-xs);font-weight:600;color:var(--text-1);">${value}</div>
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
