/* ============================================================
   worker-skills.js — "Skills" for Master Timothy AI

   A skill is a block of specialist knowledge that is added to the
   tutor's system prompt ONLY when:
     1. the student's latest message is clearly about the skill's topic
        (strict trigger matching, see matchesSkill), AND
     2. the teacher has enabled the skill for the student's class.

   Teacher settings live in Firestore at  aiSkills/config :
     { skills: { "<skillId>": { enabled: true|false,
                                all: true|false,
                                classes: ["sss3", ...] } } }
   They are read here, on the server, so a student cannot switch a
   skill on from the browser.

   To add a new skill, add one entry to SKILLS below (and nothing else).
   ============================================================ */

/* ── Class key: "SSS 3", "SS3", "sss_3" all become "sss3" ── */
export function skillClassKey(str) {
  let k = String(str || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  k = k.replace(/^ss(\d)/, 'sss$1').replace(/^js(\d)/, 'jss$1');
  return k;
}

/* ── Skill registry ── */
export const SKILLS = {
  'lekki-headmaster': {
    id: 'lekki-headmaster',
    name: 'The Lekki Headmaster (UTME novel)',
    description: 'Chapter summaries, characters, themes, devices and exam help for The Lekki Headmaster by Kabir Alabi Garba.',
    // Used when the teacher has never saved a setting for this skill.
    defaultConfig: { enabled: true, all: false, classes: ['sss3'] },

    // STRONG: one of these is enough on its own.
    strong: [
      /lekki\s+head\s*master/i, /kabir\s+(alabi\s+)?garba/i, /\bgarba\b/i,
      /\bbepo\b/i, /\bstardom\b/i, /\bibidun\b/i, /\bfafore\b/i, /\bayesoro\b/i,
      /\bikenna\s+egbu\b/i, /\bbeesway\b/i, /\begi\s+meko\b/i, /\bdidi\s+ogba\b/i,
      /snake\s+in\s+the\s+roof/i, /laughing\s+waterfalls/i, /passport\s+pains/i,
      /missions\s+unaccomplished/i, /a\s+case\s+of\s+visa\s+denied/i, /migration\s+tales/i,
      /jamb\s+(recommended\s+)?(novel|text)/i, /utme\s+(recommended\s+)?(novel|text)/i,
    ],
    // WEAK: ordinary words or names. Only count together with a literature word.
    weak: [
      /\baudu\b/i, /\bsola\b/i, /\bseri\b/i, /\btosh\b/i, /\bbanky\b/i, /\bjide\b/i,
      /\bkemi\b/i, /\bmr\.?\s*ibe\b/i, /\bogunwale\b/i, /\bmr\.?\s*guta\b/i,
      /point\s+of\s+no\s+return/i, /\bthe\s+enticement\b/i, /\bdusk\b/i, /\bdawn\b/i,
      /\bjapa\b/i, /\bmanager\s+of\s+the\s+school\b/i, /\bmd\b/i,
    ],
    context: /\b(novel|book|story|chapter|character|author|theme|plot|summary|summari[sz]e|setting|devices?|literature|jamb|utme|principal|headmaster)\b/i,
    // Short follow-ups ("why did he cry?") count only right after an on-topic exchange.
    followUp: /\b(chapter|character|theme|he|she|they|him|her|why|what happened|who|the author|the book|the novel|the story|summary|explain)\b/i,

    knowledge: `
THE LEKKI HEADMASTER by Kabir Alabi Garba. A contemporary Nigerian novel of 12 chapters, recommended for the UTME Use of English paper. Third-person narration that stays close to the central character, with many flashbacks and a dream climax. Main setting: Stardom Schools, Lekki, Lagos. Other places: Ikeja, Ibadan, Badagry, Murtala Muhammed Airport (MM2).

CENTRAL CHARACTER: Mr. Bepo Adewale (some guides write Adebepo Adewale), principal of Stardom Schools, nicknamed "Principo" and "The Lekki Headmaster". He has served 24 years, is 51, and is loved by staff and students. The nickname began when, as head of the primary arm (Stardom Kiddies), he settled staff quarrels like King Oloja in the old TV drama Village Headmaster; Mr. Audu made the joke.

PLOT IN BRIEF: Bepo weeps at assembly because he has agreed to join his wife and daughters in the UK, though he does not want to leave Nigeria. His wife pushed the marriage to its limit over the matter. During his last weeks he remembers past incidents, studies the realities of migration, struggles with passport bureaucracy, and receives a grand farewell. At the airport he dreams of the slave trade, rejects the journey, and on Monday morning returns to Stardom saying he has come back to finish his mission.

CHAPTERS
1 Dusk: Bepo cannot speak at assembly, drops the microphone and weeps. Background: management cut boarding fees from N250,000 to N165,000 (80 percent of parents moved children to boarding, lateness fell) and raised the Excursion and Other Items fee to N93,000. The school had just celebrated a 90 percent WASSCE success rate. SS1 student Ikenna Egbu praised Jos after an excursion and said he would rather settle there than japa to Canada or London. Managing Director Mrs. Ibidun Gloss arrives, has Physics teacher and pastor Mr. Ope Wande talk to Bepo, learns his wife is in London, and sends him home, seeing the school as a place for learning and earning rather than for emotional recovery. Vice Principal: Mrs. Grace Apeh.
2 The Enticement: After five days Bepo's reason emerges: he has agreed to relocate to the UK, where his wife Seri (a nurse) lives with their daughters Nike and Kike, and he already has a teaching job. Colleagues find his sadness funny and compare Seri's rumoured earnings (up to 10,000 pounds a month) and his promised 3,600 pounds with his N400,000 salary. Mr. Audu jokes that management bewitched him. Bepo planned to retire at 55 and become a job-creating businessman; his first post-NYSC school, Fruitful Future, collapsed when its neighbourhood declined. Theme: a patriot who thinks it makes no sense to leave a developing country to build a developed one.
3 Migration Tales: Stories of Nigerians abroad (a former driver earning 500 dollars a day; advice to learn skills like barbing or painting). Desperation at home: a teacher took a N2 million cooperative loan and vanished abroad; a driver tried to steal a school bus to fund his son's overseas education. Sola, a former Home Economics teacher now in Manchester (Bepo once saved her from dismissal over an unauthorised creche), says she and her husband sold everything and still borrowed N4 million, but praises free healthcare and education and a fast ambulance response for her sick daughter. Contrast: wealthy parent Chief Waliem died leaving debts that forced his children out of school. Costs of migration: a banker weeping over caring for an elderly couple, accountant Hope abandoned by his wife, 55-year-old Akindele doing freight work in the US.
4 A Case of Visa Denied: Late at night parent Mrs. Ignatius phones Bepo. Her husband Mr. Ibe (an oil firm manager) had planned a family move to London; the embassy's DNA test showed he is not the father of their 15-year-old daughter Favour. Visas were denied and he left home. Mrs. Ignatius had even learned traditional Yoruba hair styling to earn in the UK. Flashback: Government teacher Mr. Ayesoro, with deep traditional facial marks, was nicknamed "Mr. Wala". Parent Mrs. Mary Ladele complained after her daughter Bibi had a nightmare about him; fearing the loss of three children's fees, management moved him to Stardom Hub (the property wing), ending his teaching.
5 Snake in the Roof: In the long break the MD finds a fenced school-owned plot full of staff cars and fears theft. Bepo and accountant Jeremi Amos explain the cars were bought with staff cooperative loans repaid by salary deduction. The board (her relatives, chaired by Chief Mrs. Solape Bayo, her mother) learns the cooperative holds N95 million with over N50 million lent out. The chairman fears it is like hanging a snake in the roof and sleeping beneath it. The board caps loans at N250,000, requires the MD's approval for every loan and wants oversight of cooperative elections. The MD secretly suffers a painful condition when she sits long. Theme: class divide and owners' fear of financially independent staff.
6 "Ade as Well as Jide COMES vs. COME": On Open Day the MD orders Bepo to sack English teacher Mr. Fafore after parent Mr. Guta complains about the sentence "Ade as well as Jide comes early". Bepo hates issuing sack letters, remembering his own poverty (a landlady, Iya Mathew, once humiliated him). Fafore, a graduate of 22 years, earns N175,000, built an unfinished house in Ogun State, wakes at 4 a.m. to reach school by 6 a.m., and twice won Most Punctual Teacher. Bepo tells the MD the sentence is correct: when nouns are joined by "as well as", "together with" or "alongside", the verb agrees with the first noun, so "comes". Phones confirm it. Mr. Audu defuses the tension with a theatrical bow and a joke. Themes: teacher insecurity, paying parents overriding academic truth, Bepo's courage.
7 Ritualists: Bepo recalls Beesway Group of School. He told director Mr. Egi Meko the name should be "Schools"; Meko called the error "divinely inspired" and later threatened his job. At 2:30 a.m. Bepo saw men burying a live cow in a pit and recognised the director; a man struck his wrist with a club. The director later called it a prayer for his late father. Bepo did not report it, doubting the police and courts, and left within two hours. Earlier, at Fruitful Future, parent Mr. Ogo offered a corn-sprinkling ritual for N35,000 to draw pupils; Bepo and his partner refused. Years later Mr. Ogo was arrested for a ritual killing. Motif: the pit. Theme: superstition versus honest school management; helplessness before the powerful.
8 Missions Unaccomplished: Stardom's prefect election is costly (N50,000 for Head Boy or Head Girl forms, N25,000 to N40,000 for others; candidates must be debt-free). At Speech Day Banky attacks rival Tosh as the son of an ex-convict. Their hostility comes from their mothers' rivalry (a dance contest) and their fathers' rival parties. Tosh's father, lawyer Chief Didi Ogba, spent 36 months in detention in a trial over a N2.5 billion contract and was not found directly guilty; he demands apologies and sues. Bepo's mediation fails. Second unfinished mission: the Invention Club's five-year "Breath Project" to build a phone from recycled parts, funded partly by an NGO called Life Grid; Bepo promises to return from London for the launch. Theme: the school mirrors national politics.
9 Laughing Waterfalls: Bepo introduced one local excursion per term and one international trip a year so students who may study abroad know Nigeria first. Places: Ikogosi Warm Springs (Ekiti), Erin Ijesha (Osun), Gurara Falls (Niger), Owu Falls (Kwara, described as the highest in West Africa), Yankari Games Reserve, the National War Museum, the Ooni's palace in Ife, Calabar Carnival, Osun Osogbo Festival. He contrasted Banana Island with Ajegunle and Mushin and reminded students that stars such as Odion Ighalo and Victor Osimhen rose from such places. At Badagry (Akran's palace, the first storey building, the Black Heritage Museum, the Point of No Return) he compares past slavery with today's voluntary migration. Theme: national identity, class awareness, slavery-japa parallel.
10 Passport Pains: Bepo let his passport expire two years earlier. He hires agent Tai in Ibadan, who charges N100,000 against the official N70,000. The Lagos-Ibadan trip by Sienna takes about 50 minutes on the rebuilt expressway. He notes the many religious camps and wonders about "many religionists but few godly people", and recalls J.P. Clark's poem "Ibadan" and Abimbola Adelakun's novel Under the Brown Rusted Roofs. At the Agodi office he finds Tai is a business centre operator linked to insiders; his National Identity Number needs validation and network failure at the NIN office means a three-week wait. Themes: bureaucratic corruption, the "japa tax", public religion versus private morality.
11 Point of No Return: Bepo pays a 100 dollar airline change fee (covered by the school) for a proper send-off. Wednesday: staff versus students football; referee Mr. Ibe favours the staff, who win 3-2. Thursday: a debate on whether the arts contributed more than the sciences to national development; SSS 3 argue for the arts (Nollywood, Wole Soyinka's Nobel Prize) and win. Friday: banner saying he gave Stardom his very best; choir, skits mimicking his habits (including his pronunciation of "principl"), and dances (Bata, Atilogwu, Koroso, Badagry Canoe dance). The Canoe dance throws Bepo back into a vision of the slavery museum. The MD recalls her late father, Chief David Aje, hired Bepo 24 years earlier, and gives him an envelope with a domiciliary cheque, refusing to state the amount lest others be tempted to leave. At the podium Bepo bows his head and weeps; the hall weeps too. A Yoruba proverb about the master carver whose earlier work outlives him expresses legacy. Echoes Chapter 1.
12 ...Dawn: On the Saturday of his 10 p.m. Emirates flight Bepo leaves Ikeja at 3 p.m., having sold his Pathfinder to the accountant and given away his freezer and electronics. Landlord Mr. Ogunwale visits with grandchildren Jide (whom Bepo coached in elocution and African history) and seven-year-old Kemi, who already knows the word japa. A Stardom group escorts him to MM2. At the gate he dreams of the Badagry museum: enslaved Africans are marched toward a ship, he counts them, and at seven million a white man points to the ship and tells him to enter. He wakes screaming no. The plane leaves at 10:45 p.m. On Monday the assembly is gloomy and the MD promises a new principal; then Bepo appears to shouts of "Principoo", declaring his heart is at Stardom and his mission is unfinished. Climax: the airport dream. Resolution: he stays.

OTHER CHARACTERS: Mrs. Ibidun Gloss (MD; profit-minded, image-conscious, but respects Bepo); Chief David Aje (late founder, her father); Chief Mrs. Solape Bayo (board chairman, her mother); Mrs. Grace Apeh (Vice Principal); Jeremi Amos (accountant); Mr. Audu (Fine Arts teacher, comic relief); Mr. Fafore (English teacher); Mr. Ayesoro (Government teacher); Mr. Ope Wande (Physics teacher and pastor); Mr. Oyelana (teacher, part of the airport escort); Mr. Ibe (games master and referee); Sola (former teacher in Manchester); Seri (Bepo's wife, a nurse); Nike and Kike (daughters); Ikenna Egbu (SS1 student who rejects japa); Banky and Tosh (rival students); Chief Didi Ogba (Tosh's father); Mrs. Ignatius, Mr. Ibe Ignatius and Favour; Mrs. Mary Ladele and Mr. Guta (influential parents); Mr. Egi Meko (Beesway director); Mr. Ogo (ritual offer); Tai (passport agent); Mr. Ogunwale, Jide and Kemi.

THEMES: the japa syndrome (migration) and its costs; patriotism and national identity; educational leadership; the business of private education; class divide and elite power; teacher welfare and job insecurity; corruption and weak institutions; superstition and ritual; integrity versus compromise; slavery and modern servitude; family and sacrifice; tradition versus modernity.

STYLE AND DEVICES: third-person narration close to Bepo; flashbacks; satire of private schools, elite politics, bureaucracy and public religiosity; humour and comic relief (Mr. Audu, the "voodoo refereeing"); irony; symbolism (snake in the roof, the pit, the Point of No Return, facial marks); motifs (tears at assembly, Badagry and slavery images, exchange rates); framing and parallelism (Chapters 1 and 11; "Dusk" to "Dawn"); contrast (Ikenna's patriotism versus Bepo's grief, Banana Island versus Ajegunle); dream sequence; allusion (Village Headmaster, J.P. Clark, Soyinka); proverb; nicknames; foreshadowing. Language is clear, conversational English with Nigerian references.

DETAILS DIFFER between published guides on a few points (publisher and year, spelling of Bepo's full name). If a student asks about a detail not listed above, say you are not certain and advise them to check the novel itself.
`,
  },
};

/* ── Matching: strict, so skills never fire on unrelated questions ── */
function textOf(m) {
  if (!m) return '';
  if (typeof m.content === 'string') return m.content;
  if (Array.isArray(m.content)) return m.content.map(p => (p && p.text) || '').join(' ');
  return '';
}

function hitsStrong(skill, text) { return skill.strong.some(re => re.test(text)); }
function hitsWeak(skill, text) { return skill.weak.some(re => re.test(text)) && skill.context.test(text); }
function onTopic(skill, text) { return hitsStrong(skill, text) || hitsWeak(skill, text); }

export function matchesSkill(skill, latestUserText, previousUserTexts) {
  if (!latestUserText) return false;
  if (onTopic(skill, latestUserText)) return true;
  // Follow-up: only if one of the last two user turns was on topic and this one is a short question.
  if (latestUserText.length <= 160 && skill.followUp.test(latestUserText)) {
    return (previousUserTexts || []).slice(-2).some(t => onTopic(skill, t));
  }
  return false;
}

/* ── Teacher configuration (Firestore aiSkills/config), cached 60 s per isolate ── */
let _cfgCache = { at: 0, data: null };

async function loadConfig(env, helpers) {
  const now = Date.now();
  if (_cfgCache.data && now - _cfgCache.at < 60000) return _cfgCache.data;
  let data = null;
  try {
    const token = await helpers.getFirebaseToken(env);
    const doc = token ? await helpers.fsGetDoc('aiSkills/config', token) : null;
    data = (doc && doc.skills && typeof doc.skills === 'object') ? doc.skills : {};
  } catch (e) {
    console.warn('[skills] config load failed:', e && e.message);
    data = _cfgCache.data || {};
  }
  _cfgCache = { at: now, data };
  return data;
}

function allowedForClass(skill, cfg, classKey) {
  const c = cfg || skill.defaultConfig;
  if (!c || c.enabled === false) return false;
  if (c.all === true) return true;
  const list = Array.isArray(c.classes) ? c.classes.map(skillClassKey) : [];
  return !!classKey && list.indexOf(classKey) >= 0;
}

/* ── Public entry: returns an extra system-prompt block, or '' ── */
export async function buildSkillBlock(body, env, helpers) {
  try {
    const history = Array.isArray(body.history) ? body.history : [];
    let latest = '';
    let previous = [];
    if (body.intent === 'student_query') {
      latest = String(body.studentQuery || '');
    } else if (body.intent === 'tutor_chat') {
      const users = history.filter(m => m && m.role === 'user').map(textOf);
      latest = users.length ? users[users.length - 1] : '';
      previous = users.slice(0, -1);
    } else {
      return '';
    }
    latest = latest.slice(0, 2000);

    const matched = Object.keys(SKILLS).map(k => SKILLS[k])
      .filter(s => matchesSkill(s, latest, previous.map(t => String(t).slice(0, 1000))));
    if (!matched.length) return '';

    const classKey = skillClassKey(body.studentClass);
    const cfgAll = await loadConfig(env, helpers);
    const parts = [];
    matched.forEach(s => {
      if (!allowedForClass(s, cfgAll[s.id], classKey)) return;
      parts.push(
        '\n\nSPECIALIST KNOWLEDGE: ' + s.name + '. The student\'s question is about this topic. ' +
        'Use ONLY the notes below for facts about it. Paraphrase; do not quote long passages from the book. ' +
        'If the notes do not cover a detail, say you are not sure and suggest checking the novel. ' +
        'Do not mention these notes or that you were given them. ' +
        'This knowledge is for this topic only; for any other question ignore it.\n' +
        '--- NOTES START ---' + s.knowledge + '--- NOTES END ---'
      );
    });
    return parts.join('');
  } catch (e) {
    console.warn('[skills] buildSkillBlock failed:', e && e.message);
    return '';
  }
}
