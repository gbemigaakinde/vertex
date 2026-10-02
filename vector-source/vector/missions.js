/* ============================================================
   vector/missions.js  |  Data-driven missions + a reusable runner.
   Pure logic (no DOM). The MissionRunner works with any MatchSim.

   Objective types:
     reach, investigate, retrieve, secure, destroy, rescue, escort,
     survive, intel, activate, deactivate, extract
   Zones (A-F, START, EXTRACT) come from the map, so one map can host
   several very different missions.
   ============================================================ */

/* ---------------------------------------------------------------
   Campaign data. Story: BLACKLINE is an independent response unit.
   You play callsign ECHO. HALCYON is your handler, RIVET your
   squadmate. VECTOR is a covert network hiding inside decommissioned
   BLACKLINE relays.
   --------------------------------------------------------------- */
export const CAMPAIGN = [
  /* ---------------- ACT I: THE SIGNAL ---------------- */
  {
    id: 'm01', act: 1, actName: 'THE SIGNAL', title: 'DEAD SIGNAL', map: 'industrial',
    summary: 'Investigate a communications blackout.',
    briefing: 'A regional relay went silent nine hours ago. Emergency traffic is being swallowed somewhere inside the district. Find where the signal goes.',
    reward: { xp: 400, unlock: 'm02' },
    intro: [
      { focus: 'A', dur: 4.5, radius: 22, height: 12, text: 'INDUSTRIAL DISTRICT. 03:12 LOCAL. All civilian traffic is dark.' },
      { focus: 'START', dur: 3.5, radius: 10, height: 5, text: 'HALCYON: Echo, you are the only unit inside the fence. Stay quiet.' },
    ],
    objectives: [
      { id: 'reach', type: 'reach', zone: 'F', text: 'Reach the relay yard' },
      { id: 'probe', type: 'investigate', zones: ['A'], hold: 2.5, text: 'Investigate the dead relay' },
      { id: 'source', type: 'investigate', zones: ['C'], hold: 3, text: 'Locate the signal source', label: 'Trace signal' },
      { id: 'hold', type: 'secure', zone: 'C', hold: 22, text: 'Secure the area', waves: [{ at: 6, zone: 'D', type: 'rifleman', n: 2 }] },
      { id: 'out', type: 'extract', zone: 'EXTRACT', hold: 3, text: 'Extract' },
    ],
    enemies: [
      { zone: 'A', type: 'rifleman', n: 2, patrol: true },
      { zone: 'B', type: 'rifleman', n: 2, patrol: true },
      { zone: 'C', type: 'scout', n: 1 },
      { zone: 'F', type: 'rifleman', n: 1, patrol: true },
    ],
    dialogue: [
      { on: 'start', who: 'HALCYON', text: 'Echo, comms are down across the district. Get eyes on the relay in the yard.' },
      { on: 'obj:probe:start', who: 'HALCYON', text: 'The relay is cold, but something is still transmitting nearby. Trace it.' },
      { on: 'alert', who: 'RIVET', text: 'Contact. They were not supposed to be here.' },
      { on: 'obj:source:done', who: 'HALCYON', text: 'That is a BLACKLINE handshake. Somebody is using our own keys.' },
      { on: 'obj:hold:start', who: 'HALCYON', text: 'Hold that position while I copy the log.' },
      { on: 'done', who: 'HALCYON', text: 'Log copied. One word repeats: VECTOR.' },
    ],
  },
  {
    id: 'm02', act: 1, actName: 'THE SIGNAL', title: 'COLD ENTRY', map: 'research',
    summary: 'Infiltrate a secured facility.',
    briefing: 'The signal ends at a research compound in the forest. A frontal attack will get you killed. Go in quietly, kill the alarm relay, take what you need.',
    reward: { xp: 500, unlock: 'm03' },
    intro: [{ focus: 'B', dur: 5, radius: 26, height: 16, text: 'RESEARCH COMPOUND. Two patrols, one gate, one fence.' }],
    objectives: [
      { id: 'reach', type: 'reach', zone: 'A', text: 'Reach the forward outpost' },
      { id: 'alarm', type: 'deactivate', zone: 'C', hold: 4, text: 'Deactivate the perimeter alarm', label: 'Disable alarm' },
      { id: 'card', type: 'retrieve', zone: 'D', item: 'access keycard', text: 'Retrieve the access keycard from the lodge' },
      { id: 'lab', type: 'intel', zones: ['B'], count: 2, text: 'Collect intelligence from the lab' },
      { id: 'out', type: 'extract', zone: 'EXTRACT', hold: 3, text: 'Extract' },
    ],
    enemies: [
      { zone: 'A', type: 'rifleman', n: 2, patrol: true }, { zone: 'C', type: 'rifleman', n: 2 },
      { zone: 'D', type: 'scout', n: 2, patrol: true }, { zone: 'B', type: 'rifleman', n: 2, patrol: true },
      { zone: 'E', type: 'support', n: 1 },
    ],
    dialogue: [
      { on: 'start', who: 'HALCYON', text: 'Stealth is your friend here. Every alarm you trip brings a squad.' },
      { on: 'obj:alarm:done', who: 'HALCYON', text: 'Alarm relay is dead. Now the lodge, they keep the keycard there.' },
      { on: 'alert', who: 'RIVET', text: 'They know we are here. Move or dig in.' },
      { on: 'done', who: 'HALCYON', text: 'The lab records point to a courier network. Ghost routes.' },
    ],
  },
  {
    id: 'm03', act: 1, actName: 'THE SIGNAL', title: 'BROKEN LINE', map: 'urban',
    summary: 'Stop an operation before communications are completely disabled.',
    briefing: 'Jammers are going up across the city block. In fifteen minutes every emergency channel will be gone. Bring them down.',
    reward: { xp: 550, unlock: 'm04' }, timeLimit: 900,
    intro: [{ focus: 'D', dur: 5, radius: 24, height: 14, text: 'URBAN BLOCK. The jammers are broadcasting a countdown.' }],
    objectives: [
      { id: 'reach', type: 'reach', zone: 'D', text: 'Reach the first jammer site' },
      { id: 'jam', type: 'destroy', zone: 'C', count: 2, hp: 90, text: 'Destroy the signal jammers', label: 'Jammer' },
      { id: 'core', type: 'deactivate', zone: 'E', hold: 5, timeLimit: 150, text: 'Deactivate the master transmitter before it locks', label: 'Disable transmitter' },
      { id: 'out', type: 'extract', zone: 'EXTRACT', hold: 3, text: 'Extract' },
    ],
    enemies: [
      { zone: 'D', type: 'rifleman', n: 2 }, { zone: 'C', type: 'rifleman', n: 2, patrol: true },
      { zone: 'C', type: 'heavy', n: 1 }, { zone: 'E', type: 'rifleman', n: 2 }, { zone: 'B', type: 'scout', n: 2, patrol: true },
    ],
    dialogue: [
      { on: 'start', who: 'HALCYON', text: 'Fifteen minutes on the clock. They are using civilian rooftops for the jammers.' },
      { on: 'obj:jam:done', who: 'RIVET', text: 'One less. The transmitter is next.' },
      { on: 'obj:core:start', who: 'HALCYON', text: 'It locks in two and a half minutes. Do not be late.' },
      { on: 'done', who: 'HALCYON', text: 'Channels are back. But the transmitter had a second address. A black site.' },
    ],
  },

  /* ---------------- ACT II: THE NETWORK ---------------- */
  {
    id: 'm04', act: 2, actName: 'THE NETWORK', title: 'BLACK SITE', map: 'coastal',
    summary: 'Investigate an abandoned covert facility.',
    briefing: 'The second address is a coastal plant that officially closed ten years ago. Lights are on. Someone is living there.',
    reward: { xp: 600, unlock: 'm05' },
    intro: [{ focus: 'A', dur: 5, radius: 28, height: 15, text: 'COASTAL FACILITY. Closed on paper. Not in practice.' }],
    objectives: [
      { id: 'probe', type: 'investigate', zones: ['A', 'D'], hold: 2.5, text: 'Investigate the plant floor and the store' },
      { id: 'files', type: 'intel', zones: ['E', 'F'], count: 3, text: 'Collect three intelligence files' },
      { id: 'saved', type: 'rescue', zone: 'C', text: 'Rescue the prisoner in the control room' },
      { id: 'out', type: 'extract', zone: 'EXTRACT', hold: 3, text: 'Extract' },
    ],
    enemies: [
      { zone: 'A', type: 'rifleman', n: 3, patrol: true }, { zone: 'D', type: 'rifleman', n: 2 }, { zone: 'E', type: 'support', n: 1 },
      { zone: 'E', type: 'rifleman', n: 2 }, { zone: 'C', type: 'heavy', n: 1 }, { zone: 'F', type: 'scout', n: 1 },
    ],
    dialogue: [
      { on: 'start', who: 'HALCYON', text: 'Thermal shows movement inside. Nobody is supposed to be there.' },
      { on: 'obj:files:done', who: 'HALCYON', text: 'Shipping manifests, payroll, and a list of relays. Ours.' },
      { on: 'obj:saved:done', who: 'PRISONER', text: 'Please. They took me because I built the handshake. Get me out.' },
    ],
  },
  {
    id: 'm05', act: 2, actName: 'THE NETWORK', title: 'GHOST ROUTE', map: 'research',
    summary: 'Track a hidden transportation route.',
    briefing: 'The manifests describe a supply road that does not appear on any map. Follow the trail and burn the fuel cache that feeds it.',
    reward: { xp: 650, unlock: 'm06' },
    intro: [{ focus: 'F', dur: 5, radius: 22, height: 14, text: 'FOREST ROAD. Tyre marks, fresh, heading nowhere.' }],
    objectives: [
      { id: 'trail', type: 'investigate', zones: ['A', 'F'], hold: 2, text: 'Follow the tracks' },
      { id: 'cache', type: 'destroy', zone: 'D', count: 3, hp: 110, text: 'Destroy the fuel cache', label: 'Fuel drum' },
      { id: 'manifest', type: 'retrieve', zone: 'B', item: 'route manifest', text: 'Retrieve the route manifest' },
      { id: 'out', type: 'extract', zone: 'EXTRACT', hold: 3, text: 'Extract' },
    ],
    enemies: [
      { zone: 'A', type: 'scout', n: 2, patrol: true }, { zone: 'F', type: 'rifleman', n: 2 }, { zone: 'D', type: 'rifleman', n: 3, patrol: true },
      { zone: 'D', type: 'heavy', n: 1 }, { zone: 'B', type: 'rifleman', n: 2 }, { zone: 'B', type: 'support', n: 1 },
    ],
    dialogue: [
      { on: 'start', who: 'RIVET', text: 'Fresh tracks. Heavy trucks. Somebody is moving a lot of gear.' },
      { on: 'obj:cache:start', who: 'HALCYON', text: 'That cache fuels the whole route. Burn it and the trucks stop.' },
      { on: 'done', who: 'HALCYON', text: 'The manifest lists buyers. One name matches a BLACKLINE contractor.' },
    ],
  },
  {
    id: 'm06', act: 2, actName: 'THE NETWORK', title: 'CROSSFIRE', map: 'urban',
    summary: 'Survive an ambush and recover critical intelligence.',
    briefing: 'The contractor sold you out. The meeting point is a trap, and the intelligence you need is inside it. Live through it.',
    reward: { xp: 700, unlock: 'm07' },
    intro: [{ focus: 'E', dur: 4.5, radius: 20, height: 12, text: 'URBAN BLOCK. Every window has a shooter.' }],
    objectives: [
      { id: 'reach', type: 'reach', zone: 'E', text: 'Reach the meeting point' },
      { id: 'ambush', type: 'survive', duration: 75, text: 'Survive the ambush',
        waves: [{ at: 2, zone: 'F', type: 'rifleman', n: 3 }, { at: 20, zone: 'B', type: 'rifleman', n: 3 }, { at: 35, zone: 'A', type: 'scout', n: 2 }, { at: 50, zone: 'F', type: 'heavy', n: 1 }] },
      { id: 'intel', type: 'intel', zones: ['E', 'D', 'C'], count: 3, text: 'Recover the intelligence caches' },
      { id: 'out', type: 'extract', zone: 'EXTRACT', hold: 3, text: 'Extract' },
    ],
    enemies: [{ zone: 'C', type: 'rifleman', n: 2 }, { zone: 'D', type: 'support', n: 1 }],
    dialogue: [
      { on: 'obj:ambush:start', who: 'RIVET', text: 'They are on the roofs! Get behind something solid!' },
      { on: 'obj:ambush:done', who: 'HALCYON', text: 'That is all of them. Grab the caches and go.' },
      { on: 'done', who: 'HALCYON', text: 'The caches point at a vault. Whoever runs VECTOR keeps its money there.' },
    ],
  },

  /* ---------------- ACT III: VECTOR ---------------- */
  {
    id: 'm07', act: 3, actName: 'VECTOR', title: 'THE VAULT', map: 'comms',
    summary: 'Break into a heavily secured location.',
    briefing: 'The vault sits beneath a communications station. Doors are on relay locks. Kill the relay, take the data, and keep the download alive.',
    reward: { xp: 800, unlock: 'm08' },
    intro: [{ focus: 'D', dur: 4.5, radius: 14, height: 8, text: 'UNDERGROUND STATION. Cold air, humming servers.' }],
    objectives: [
      { id: 'relay', type: 'deactivate', zone: 'A', hold: 4, text: 'Deactivate the door relay', label: 'Kill relay' },
      { id: 'vault', type: 'reach', zone: 'D', text: 'Enter the vault' },
      { id: 'dl', type: 'activate', zone: 'D', hold: 4, text: 'Start the data download', label: 'Start download' },
      { id: 'hold', type: 'secure', zone: 'D', hold: 30, text: 'Protect the download', waves: [{ at: 5, zone: 'B', type: 'rifleman', n: 3 }, { at: 18, zone: 'E', type: 'heavy', n: 1 }] },
      { id: 'out', type: 'extract', zone: 'EXTRACT', hold: 3, text: 'Extract' },
    ],
    enemies: [
      { zone: 'A', type: 'rifleman', n: 2 }, { zone: 'B', type: 'rifleman', n: 2, patrol: true }, { zone: 'C', type: 'heavy', n: 1 },
      { zone: 'D', type: 'support', n: 1 }, { zone: 'F', type: 'scout', n: 2, patrol: true },
    ],
    dialogue: [
      { on: 'start', who: 'HALCYON', text: 'Corridors are tight. Flash charges will save your life.' },
      { on: 'obj:dl:start', who: 'HALCYON', text: 'Download is thirty seconds. They will come for it.' },
      { on: 'done', who: 'HALCYON', text: 'Echo, the account holder is a BLACKLINE oversight board. I am checking the name.' },
    ],
  },
  {
    id: 'm08', act: 3, actName: 'VECTOR', title: 'ZERO HOUR', map: 'industrial',
    summary: 'Prevent a coordinated attack.',
    briefing: 'Three charges are placed across the district. A shared timer will trigger all of them at once. You have eight minutes to end it.',
    reward: { xp: 850, unlock: 'm09' }, timeLimit: 480,
    intro: [{ focus: 'F', dur: 4.5, radius: 26, height: 16, text: 'INDUSTRIAL DISTRICT. 07:52 remaining.' }],
    objectives: [
      { id: 'c1', type: 'destroy', zone: 'B', count: 1, hp: 140, text: 'Destroy charge one', label: 'Charge' },
      { id: 'c2', type: 'destroy', zone: 'D', count: 1, hp: 140, text: 'Destroy charge two', label: 'Charge' },
      { id: 'timer', type: 'deactivate', zone: 'E', hold: 6, text: 'Deactivate the master timer', label: 'Disable timer' },
      { id: 'out', type: 'extract', zone: 'EXTRACT', hold: 3, text: 'Extract' },
    ],
    enemies: [
      { zone: 'B', type: 'rifleman', n: 3, patrol: true }, { zone: 'D', type: 'rifleman', n: 2 }, { zone: 'D', type: 'heavy', n: 1 },
      { zone: 'E', type: 'commander', n: 1 }, { zone: 'E', type: 'rifleman', n: 2 }, { zone: 'C', type: 'scout', n: 2, patrol: true }, { zone: 'A', type: 'support', n: 1 },
    ],
    dialogue: [
      { on: 'start', who: 'HALCYON', text: 'Eight minutes. Charges first, then the timer. Go.' },
      { on: 'obj:timer:start', who: 'HALCYON', text: 'There is a commander in that building. Do not walk in blind.' },
      { on: 'done', who: 'HALCYON', text: 'Stopped. The commander carried a BLACKLINE badge, Echo. A real one.' },
    ],
  },
  {
    id: 'm09', act: 3, actName: 'VECTOR', title: 'BLACKLINE', map: 'coastal',
    summary: 'Discover the connection between VECTOR and BLACKLINE.',
    briefing: 'An informant inside the coastal complex claims to know who wrote VECTOR. Reach them and bring them out alive.',
    reward: { xp: 900, unlock: 'm10' },
    intro: [{ focus: 'D', dur: 4.5, radius: 22, height: 14, text: 'COASTAL FACILITY. The informant is holding out.' }],
    objectives: [
      { id: 'files', type: 'intel', zones: ['D', 'E', 'A'], count: 3, text: 'Collect the founding records' },
      { id: 'inf', type: 'rescue', zone: 'F', text: 'Reach and free the informant' },
      { id: 'walk', type: 'escort', to: 'EXTRACT', text: 'Escort the informant to extraction' },
      { id: 'out', type: 'extract', zone: 'EXTRACT', hold: 3, text: 'Extract' },
    ],
    enemies: [
      { zone: 'D', type: 'rifleman', n: 2 }, { zone: 'E', type: 'rifleman', n: 3, patrol: true }, { zone: 'A', type: 'heavy', n: 1 },
      { zone: 'F', type: 'commander', n: 1 }, { zone: 'F', type: 'rifleman', n: 2 }, { zone: 'B', type: 'scout', n: 2, patrol: true }, { zone: 'C', type: 'support', n: 1 },
    ],
    dialogue: [
      { on: 'obj:files:done', who: 'HALCYON', text: 'The records are ours. VECTOR was a BLACKLINE contingency network. We built it.' },
      { on: 'obj:inf:done', who: 'INFORMANT', text: 'They wanted BLACKLINE to look guilty. The order came from inside. Keep me alive.' },
      { on: 'obj:walk:start', who: 'RIVET', text: 'Stay with me and stay low. The road out is long.' },
      { on: 'done', who: 'HALCYON', text: 'Terminal facility. It is the last node. That is where it ends.' },
    ],
  },

  /* ---------------- ACT IV: LAST VECTOR ---------------- */
  {
    id: 'm10', act: 4, actName: 'LAST VECTOR', title: 'TERMINAL', map: 'comms',
    summary: 'Reach the final operational facility.',
    briefing: 'The terminal node is under a fortified station. Reach the control hall, take the corridor, and hold until the shutdown sequence starts.',
    reward: { xp: 1000, unlock: 'm11' },
    intro: [{ focus: 'F', dur: 4.5, radius: 14, height: 8, text: 'TERMINAL STATION. Last operational node.' }],
    objectives: [
      { id: 'reach', type: 'reach', zone: 'B', text: 'Reach the control hall' },
      { id: 'hold', type: 'secure', zone: 'B', hold: 30, text: 'Hold the control hall', waves: [{ at: 4, zone: 'A', type: 'rifleman', n: 3 }, { at: 12, zone: 'C', type: 'rifleman', n: 3 }, { at: 22, zone: 'E', type: 'heavy', n: 2 }] },
      { id: 'seq', type: 'activate', zone: 'D', hold: 5, text: 'Start the shutdown sequence', label: 'Start shutdown' },
      { id: 'out', type: 'extract', zone: 'EXTRACT', hold: 3, text: 'Extract' },
    ],
    enemies: [
      { zone: 'A', type: 'rifleman', n: 2 }, { zone: 'C', type: 'heavy', n: 1 }, { zone: 'D', type: 'commander', n: 1 }, { zone: 'D', type: 'rifleman', n: 2 },
      { zone: 'E', type: 'support', n: 1 }, { zone: 'F', type: 'scout', n: 2, patrol: true },
    ],
    dialogue: [
      { on: 'start', who: 'HALCYON', text: 'This is it, Echo. Everything routes through that hall.' },
      { on: 'obj:hold:start', who: 'RIVET', text: 'Here they come. Make every magazine count.' },
      { on: 'done', who: 'HALCYON', text: 'Shutdown is running. But it is spreading the keys to every relay first.' },
    ],
  },
  {
    id: 'm11', act: 4, actName: 'LAST VECTOR', title: 'COLLAPSE', map: 'industrial',
    summary: 'Stop the system before the network collapses.',
    briefing: 'The network is cannibalising the district grid to power itself. Shut down three cores before the district goes dark for good.',
    reward: { xp: 1100, unlock: 'm12' }, timeLimit: 720,
    intro: [{ focus: 'F', dur: 4.5, radius: 26, height: 16, text: 'INDUSTRIAL DISTRICT. Lights flicker district-wide.' }],
    objectives: [
      { id: 'k1', type: 'deactivate', zone: 'A', hold: 5, text: 'Deactivate core one', label: 'Core one' },
      { id: 'k2', type: 'deactivate', zone: 'C', hold: 5, text: 'Deactivate core two', label: 'Core two' },
      { id: 'gen', type: 'destroy', zone: 'D', count: 2, hp: 160, text: 'Destroy the backup generators', label: 'Generator' },
      { id: 'k3', type: 'deactivate', zone: 'E', hold: 6, text: 'Deactivate core three', label: 'Core three' },
      { id: 'out', type: 'extract', zone: 'EXTRACT', hold: 3, text: 'Extract' },
    ],
    enemies: [
      { zone: 'A', type: 'rifleman', n: 3 }, { zone: 'A', type: 'support', n: 1 }, { zone: 'C', type: 'heavy', n: 2 }, { zone: 'D', type: 'rifleman', n: 3, patrol: true },
      { zone: 'D', type: 'commander', n: 1 }, { zone: 'E', type: 'scout', n: 2 }, { zone: 'E', type: 'rifleman', n: 2 }, { zone: 'B', type: 'scout', n: 2, patrol: true },
    ],
    dialogue: [
      { on: 'start', who: 'HALCYON', text: 'Twelve minutes before the grid fails. Cores first.' },
      { on: 'obj:gen:done', who: 'RIVET', text: 'Generators are gone. One core left.' },
      { on: 'done', who: 'HALCYON', text: 'Network is fraying. One relay is still alive. Its keys are the origin.' },
    ],
  },
  {
    id: 'm12', act: 4, actName: 'LAST VECTOR', title: 'BLACKLINE PROTOCOL', map: 'urban',
    summary: 'Final mission and campaign conclusion.',
    briefing: 'The origin relay sits in the middle of the city. Whoever wrote the protocol is waiting there. End it.',
    reward: { xp: 1500, unlock: null }, final: true,
    intro: [{ focus: 'E', dur: 5, radius: 26, height: 16, text: 'URBAN BLOCK. The protocol answers to a single key.' }],
    objectives: [
      { id: 'reach', type: 'reach', zone: 'D', text: 'Fight to the origin relay' },
      { id: 'srv', type: 'destroy', zone: 'C', count: 3, hp: 170, text: 'Destroy the protocol servers', label: 'Server' },
      { id: 'boss', type: 'secure', zone: 'E', hold: 25, text: 'Hold the relay against the last guard', waves: [{ at: 3, zone: 'F', type: 'commander', n: 1 }, { at: 8, zone: 'F', type: 'heavy', n: 2 }, { at: 16, zone: 'B', type: 'rifleman', n: 4 }] },
      { id: 'kill', type: 'deactivate', zone: 'E', hold: 8, text: 'Enter the override and end BLACKLINE PROTOCOL', label: 'End protocol' },
      { id: 'out', type: 'extract', zone: 'EXTRACT', hold: 3, text: 'Extract' },
    ],
    enemies: [
      { zone: 'D', type: 'rifleman', n: 3 }, { zone: 'D', type: 'heavy', n: 1 }, { zone: 'C', type: 'rifleman', n: 3, patrol: true },
      { zone: 'C', type: 'support', n: 1 }, { zone: 'E', type: 'commander', n: 1 }, { zone: 'A', type: 'scout', n: 2, patrol: true }, { zone: 'B', type: 'heavy', n: 1 },
    ],
    dialogue: [
      { on: 'start', who: 'HALCYON', text: 'Echo. Whatever happens next, the network ends today.' },
      { on: 'obj:boss:start', who: 'RIVET', text: 'They kept the best for last. Stay behind cover!' },
      { on: 'obj:kill:done', who: 'HALCYON', text: 'It is done. Protocol closed. I will tell you who signed it when we are clear.' },
      { on: 'done', who: 'HALCYON', text: 'The signature belongs to the board that funded BLACKLINE. That is a fight for another day. Good work, Echo.' },
    ],
  },
];

export const MISSION_BY_ID = Object.fromEntries(CAMPAIGN.map((m) => [m.id, m]));
export function getMission(id) { return MISSION_BY_ID[id] || null; }

/* Co-op uses the campaign missions. */
export const OBJECTIVE_TYPES = ['reach', 'investigate', 'retrieve', 'secure', 'destroy', 'rescue', 'escort', 'survive', 'intel', 'activate', 'deactivate', 'extract'];

/* ---------------- Mission runner ---------------- */
export class MissionRunner {
  constructor(mission, sim) {
    this.m = mission; this.sim = sim;
    this.index = -1;
    this.done = false; this.failed = false; this.reason = '';
    this.st = null;              // state of the current objective
    this.elapsed = 0;
    this.spoken = new Set();
    this.timeLeft = mission.timeLimit || null;
    this.alerted = false;
    this.combatSpoken = false;
  }

  get current() { return this.m.objectives[this.index] || null; }

  start(index = 0) {
    this.say('start');
    this.begin(index);
  }

  say(key) {
    for (const d of this.m.dialogue || []) {
      if (d.on !== key) continue;
      const k = key + '|' + d.text;
      if (this.spoken.has(k)) continue;
      this.spoken.add(k);
      this.sim.emit({ t: 'dialogue', who: d.who, text: d.text, radio: true });
    }
  }

  zone(id) {
    const z = this.sim.map.zones[id];
    if (!z) throw new Error('Mission ' + this.m.id + ' references unknown zone ' + id);
    return z;
  }

  begin(index) {
    this.index = index;
    const o = this.current;
    if (!o) return this.win();
    this.st = { progress: 0, count: 0, need: 1, timer: 0, ids: [], waveI: 0, text: o.text };
    this.sim.emit({ t: 'objective', id: o.id, text: o.text, index });
    this.say('obj:' + o.id + ':start');
    const zoneObj = o.zone ? this.zone(o.zone) : null;
    switch (o.type) {
      case 'investigate': {
        this.st.need = o.zones.length;
        for (const zid of o.zones) {
          const z = this.zone(zid);
          const p = this.sim.map.randomWalkable(z.x, z.z, Math.max(1.5, z.r * 0.5), this.sim.rndSpawn) || z;
          this.st.ids.push(this.sim.addInteractable({ kind: 'point', x: p.x, z: p.z, hold: o.hold || 2, label: o.label || 'Investigate', obj: o.id }).id);
        }
        break;
      }
      case 'intel': {
        this.st.need = o.count;
        const zs = o.zones;
        for (let i = 0; i < o.count; i++) {
          const z = this.zone(zs[i % zs.length]);
          const p = this.sim.map.randomWalkable(z.x, z.z, Math.max(1.5, z.r * 0.7), this.sim.rndSpawn) || z;
          this.st.ids.push(this.sim.addInteractable({ kind: 'intel', x: p.x, z: p.z, hold: 1.2, label: 'Collect intel', obj: o.id }).id);
        }
        break;
      }
      case 'retrieve': {
        const p = this.sim.map.randomWalkable(zoneObj.x, zoneObj.z, Math.max(1.5, zoneObj.r * 0.5), this.sim.rndSpawn) || zoneObj;
        this.st.ids.push(this.sim.addInteractable({ kind: 'item', x: p.x, z: p.z, hold: 1.5, label: 'Take ' + (o.item || 'item'), obj: o.id, item: o.item || 'item' }).id);
        break;
      }
      case 'activate': case 'deactivate': {
        const p = this.sim.map.randomWalkable(zoneObj.x, zoneObj.z, Math.max(1.2, zoneObj.r * 0.4), this.sim.rndSpawn) || zoneObj;
        this.st.ids.push(this.sim.addInteractable({ kind: 'device', x: p.x, z: p.z, hold: o.hold || 4, label: o.label || (o.type === 'activate' ? 'Activate' : 'Deactivate'), obj: o.id }).id);
        if (o.timeLimit) this.st.timer = o.timeLimit;
        break;
      }
      case 'rescue': {
        const p = this.sim.map.randomWalkable(zoneObj.x, zoneObj.z, Math.max(1.2, zoneObj.r * 0.4), this.sim.rndSpawn) || zoneObj;
        const npc = this.sim.addNpc({ x: p.x, z: p.z, name: 'Captive', state: 'captive' });
        const it = this.sim.addInteractable({ kind: 'hostage', x: p.x, z: p.z, hold: 3, label: 'Free captive', obj: o.id, npc: npc.id });
        this.st.ids.push(it.id);
        break;
      }
      case 'escort': {
        const npc = this.sim.npcs.find((n) => n.alive);
        if (!npc) { this.sim.addNpc({ x: this.sim.firstPlayerPos().x, z: this.sim.firstPlayerPos().z, name: 'Ally', state: 'follow' }); }
        break;
      }
      case 'destroy': {
        this.st.need = o.count || 1;
        // Destroying hardened targets eats ammo, so every such objective ships with a supply drop.
        for (let k = 0; k < 2; k++) this.sim.addPickup('ammo', zoneObj.x + (k ? 2.2 : -2.2), zoneObj.z + 1.5);
        for (let i = 0; i < this.st.need; i++) {
          const p = this.sim.map.randomWalkable(zoneObj.x, zoneObj.z, Math.max(2, zoneObj.r * 0.8), this.sim.rndSpawn) || zoneObj;
          this.st.ids.push(this.sim.spawnTarget({ x: p.x, z: p.z, hp: o.hp || 100, label: o.label || 'Target', obj: o.id }).id);
        }
        break;
      }
      case 'survive': this.st.timer = o.duration; break;
      case 'secure': this.st.timer = 0; break;
      default: break;
    }
  }

  advance() {
    const o = this.current;
    this.sim.emit({ t: 'objectiveDone', id: o.id, index: this.index });
    this.sim.creditObjective();
    this.say('obj:' + o.id + ':done');
    for (const id of this.st.ids) this.sim.removeInteractable(id);
    this.sim.markCheckpoint(this.index + 1);
    if (this.index + 1 >= this.m.objectives.length) return this.win();
    this.begin(this.index + 1);
  }

  win() {
    if (this.done) return;
    this.done = true;
    this.say('done');
    this.sim.finish('SUCCESS', 'Mission complete');
  }
  fail(reason) {
    if (this.done || this.failed) return;
    this.failed = true; this.reason = reason;
    this.sim.finish('FAILED', reason);
  }

  /* Waves reinforce the player during secure and survive objectives. */
  runWaves(o, t) {
    const waves = o.waves || [];
    while (this.st.waveI < waves.length && t >= waves[this.st.waveI].at) {
      const w = waves[this.st.waveI++];
      this.sim.spawnGroup({ zone: w.zone, type: w.type, n: w.n, alert: true, wave: true });
      this.sim.emit({ t: 'wave', n: w.n, type: w.type });
    }
  }

  onInteract(inter, player) {
    const o = this.current;
    if (!o || inter.obj !== o.id) return;
    const idx = this.st.ids.indexOf(inter.id);
    if (idx < 0) return;
    switch (inter.kind) {
      case 'point': case 'intel':
        this.st.count++;
        this.sim.removeInteractable(inter.id);
        this.st.ids.splice(idx, 1);
        this.sim.emit({ t: 'collected', kind: inter.kind, x: inter.x, z: inter.z });
        if (this.st.count >= this.st.need) this.advance();
        break;
      case 'item':
        player.missionItem = inter.item;
        this.sim.removeInteractable(inter.id);
        this.sim.emit({ t: 'collected', kind: 'item', item: inter.item, x: inter.x, z: inter.z });
        this.advance();
        break;
      case 'device':
        this.sim.removeInteractable(inter.id);
        this.sim.emit({ t: 'device', obj: o.id, x: inter.x, z: inter.z, on: o.type === 'activate' });
        this.advance();
        break;
      case 'hostage': {
        const npc = this.sim.npcs.find((n) => n.id === inter.npc);
        if (npc) npc.state = 'follow';
        this.sim.removeInteractable(inter.id);
        this.sim.emit({ t: 'collected', kind: 'hostage', x: inter.x, z: inter.z });
        this.advance();
        break;
      }
      default: break;
    }
  }

  onTargetDestroyed(target) {
    const o = this.current;
    if (!o || o.type !== 'destroy' || target.obj !== o.id) return;
    this.st.count++;
    const i = this.st.ids.indexOf(target.id);
    if (i >= 0) this.st.ids.splice(i, 1);
    if (this.st.count >= this.st.need) this.advance();
  }

  onNpcDead(npc) {
    const o = this.current;
    if (o && (o.type === 'escort' || o.type === 'rescue')) this.fail('The ally was killed');
    else if (this.m.objectives.some((x) => x.type === 'escort') && npc.state !== 'captive') this.fail('The ally was killed');
  }

  onAlert() {
    if (!this.alerted) { this.alerted = true; this.say('alert'); }
  }

  update(dt) {
    if (this.done || this.failed) return;
    this.elapsed += dt;
    if (this.timeLeft !== null) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.fail('Time ran out'); return; }
    }
    const o = this.current;
    if (!o) return;
    const sim = this.sim;
    const st = this.st;
    const alive = sim.activePlayers();
    switch (o.type) {
      case 'reach': {
        const z = this.zone(o.zone);
        if (alive.some((p) => Math.hypot(p.x - z.x, p.z - z.z) <= (o.radius || z.r))) this.advance();
        break;
      }
      case 'secure': {
        const z = this.zone(o.zone);
        st.timer += 0; // inside timer handled below
        const inside = alive.some((p) => Math.hypot(p.x - z.x, p.z - z.z) <= z.r + 3);
        const hostile = sim.enemies.some((e) => e.alive && Math.hypot(e.x - z.x, e.z - z.z) <= z.r + 7);
        st.contested = hostile;
        if (!st.started && inside) st.started = true;
        if (st.started) {
          st.elapsedWave = (st.elapsedWave || 0) + dt;
          this.runWaves(o, st.elapsedWave);
          if (inside && !hostile) { st.progress = Math.min(1, st.progress + dt / o.hold); }
          if (st.progress >= 1) this.advance();
        }
        break;
      }
      case 'survive': {
        st.timer -= dt;
        st.progress = 1 - Math.max(0, st.timer) / o.duration;
        this.runWaves(o, o.duration - st.timer);
        if (st.timer <= 0) this.advance();
        break;
      }
      case 'deactivate': case 'activate': {
        if (o.timeLimit) {
          st.timer -= dt;
          if (st.timer <= 0) this.fail('The device was not shut down in time');
        }
        break;
      }
      case 'escort': {
        const z = this.zone(o.to);
        const npc = sim.npcs.find((n) => n.alive);
        if (!npc) { this.fail('The ally was killed'); break; }
        if (npc.state !== 'follow') npc.state = 'follow';
        if (Math.hypot(npc.x - z.x, npc.z - z.z) <= z.r) this.advance();
        break;
      }
      case 'extract': {
        const z = this.zone(o.zone);
        const need = sim.activePlayers();
        const insideAll = need.length > 0 && need.every((p) => Math.hypot(p.x - z.x, p.z - z.z) <= z.r);
        const npcOk = sim.npcs.filter((n) => n.alive && n.state === 'follow').every((n) => Math.hypot(n.x - z.x, n.z - z.z) <= z.r + 3);
        if (insideAll && npcOk) { st.progress = Math.min(1, st.progress + dt / (o.hold || 3)); }
        else st.progress = Math.max(0, st.progress - dt * 0.5);
        if (st.progress >= 1) this.advance();
        break;
      }
      default: break;
    }
  }

  /* Small public view for snapshots / HUD. */
  view() {
    const o = this.current;
    return {
      i: this.index, n: this.m.objectives.length, id: o ? o.id : null, text: o ? o.text : '', type: o ? o.type : null,
      p: +(this.st ? this.st.progress : 0).toFixed(3), c: this.st ? this.st.count : 0, need: this.st ? this.st.need : 0,
      tl: this.timeLeft !== null ? Math.max(0, Math.round(this.timeLeft)) : null,
      dt: o && o.timeLimit && this.st ? Math.max(0, Math.round(this.st.timer)) : (o && o.type === 'survive' && this.st ? Math.max(0, Math.round(this.st.timer)) : null),
      contested: !!(this.st && this.st.contested),
      zone: o && o.zone ? o.zone : (o && o.to ? o.to : (o && o.zones ? o.zones[0] : null)),
      done: this.done, failed: this.failed, reason: this.reason,
    };
  }
}
