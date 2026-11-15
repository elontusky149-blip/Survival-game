// Progression: stages, quests, blueprints, journals, radio and the ending.
import { G, on, emit } from './util.js';
import { STAGES, BLUEPRINTS, ITEMS, PIECES } from './items.js';
import { ISLANDS } from './world.js';

export const JOURNALS = {
  j_boat1: { t: "Skipper's Note", x: "Engine dead. Radio dead. I wired what was left of the receiver into a schematic anyone could follow — if you find this, build one. The Array stations still broadcast on the old band. Somebody out there is still listening. I'm going to swim for the cay to the east.\n\n— M. Okafor, survey ketch Petrel" },
  j_cay: { t: 'Castaway Diary', x: "Day 9 on the cay. Coconuts, crabs, rain when it comes. At night I watch the storms walk along the horizon like they are looking for something.\n\nBefore the Long Tide the sea never did that. The Array kept it quiet. Then the Core went dark and the water came up over everything.\n\nThere is a bigger island west of here, green to the top. I saw smoke there once. I am building a raft." },
  j_village: { t: 'Village Ledger', x: "Forty of us came ashore at Verdant Reach after the Tide. Good water at the falls. Potatoes take in this soil.\n\nThe black-sailed ships found us in the second year. They take a tithe of everything and call it protection. Those who argued were carried off east, to the Hold.\n\nWe are leaving on the next calm. Whoever reads this: the old diver hid his tank drawings in the boulder cave on the north slope. He said the wrecks are full of what the world used to be." },
  j_cave: { t: "Diver's Sketchbook", x: "Pressure is the real killer, not the sharks. Without a tank you get thirty metres and half a minute. With one, the cargo decks open up.\n\nBelow eighty metres the trench begins and my lamp stops meaning anything. I have heard it down there. Not whale song. Lower. Like a choir holding one note, forever." },
  j_mine: { t: 'Foreman\'s Log', x: "Ironback gave us good ore until the surveyors from Meridian came. They said the rock here 'rings' and bought every tonne. Paid in circuit boards and promises.\n\nThey wanted titanium more than iron. Said the only clean seams left were on the ice island far to the north, and in the deep where no sane miner goes." },
  j_fort: { t: "Captain Vane's Log", x: "The Dread Tide keeps station off the burning mountain. Nothing passes east without paying.\n\nMy lookouts say the old station folk hid a key in the trench, another on the ice, another at their precious Meridian. Three keys, one lock, out on the floating Core in the far north-east. They say whoever turns it commands the sea itself.\n\nI do not want the sea commanded. A quiet sea needs no pirates.\n\nBuried the season's best takings under the ruins on the southern island. Map is in my chest." },
  j_meridian: { t: 'Station Notice', x: "TO ALL ARRAY STAFF: Evacuation is now mandatory. Take only personal effects. Engine schematics have been left in the central terminal for any survivors who reach this station — you will need more than sails to cross the eastern passage.\n\nDo not attempt to reach the Core. Director Hale has sealed the keycards in separate sites for a reason." },
  j_meridian_log: { t: 'Terminal: Director Hale', x: "The Choir is real. It is a standing resonance in the trench, older than anything we can date. The Array did not create it — we only learned to answer it. While we answered, the sea stayed calm.\n\nThen someone at the Core changed the reply. I do not know who, or why. The storms came within the hour.\n\nThe Core can be restarted with all three keycards: this one, the one in the Frostfang laboratory, and the one in the pressure vault on the trench floor. I am too old for the dive. Perhaps you are not.\n\n[KEYCARD A dispensed]" },
  j_dish: { t: 'Technician\'s Note', x: "Dish alignment drifts two degrees every storm. I keep correcting it and the Core keeps not answering. The carrier wave is still there though. Faint. North-east. If anyone builds a decent receiver they will hear it." },
  j_altar: { t: 'Altar Inscription', x: "The carving is worn almost flat, but the crystal set into the stone still hums against your palm.\n\nA ring of standing figures holds something up to a spiral in the sea. Below them, a second ring of figures — underwater — holds up the same thing from beneath.\n\nSomeone listened to the deep long before the Array did." },
  j_uwruins: { t: 'Relic Tablet', x: "Carved rows of waves, each smaller than the last, and at the end a flat line. Above the flat line: a single tower standing in the open sea, with a light at its top.\n\nThe builders drowned their own temple on purpose. The lower pillars were cut to stand under water." },
  j_frost: { t: 'Frozen Camp', x: "The hatch is two hundred paces up-slope, under the red mast. Hale's people left in a hurry and never came back for the deep-dive gear.\n\nIf you are reading this without a coat, go back to your boat. The cold here kills quicker than thirst." },
  j_lab: { t: 'Laboratory Records', x: "Pressure suit prototype: rated to the trench floor. Twin-tank rebreather: three minutes plus. Both schematics are in the locker with KEYCARD B.\n\nFinal entry: 'The Warden is not a myth. Sonar shows a single animal, forty metres, circling the vault. It ignores the drones. It does not ignore divers.'" },
  j_mist: { t: 'Scratched Stone', x: "The fog never lifts here. The stones are warm.\n\nSomeone has scratched words into the tallest one, over and over, in a hand that gets shakier each line:\n\nIT IS NOT ANGRY. IT IS WAITING FOR AN ANSWER.\n\nUnder the stones: plating schematics, sealed in wax. Whoever left them wanted the next builder to last." },
  j_maw: { t: 'Ashen Offering', x: "Burned timbers from a dozen ships are stacked around the shrine like firewood. The Dread Tide brings its prizes here.\n\nA page nailed to the pillar: 'Vane says the mountain is the sea's own forge and we are its hammer. I say we are just thieves on a hot rock. The trench is right there beneath us and it sings at night. I am deserting at the next landfall.'" },
  j_w1: { t: 'Waterlogged Page', x: "…took on water faster than the pumps could clear. The shark followed us for three days before that. It was never hungry. It just kept taking pieces off the hull, like it was pulling a thread." },
  j_w4: { t: "Log of the 'Gull'", x: "Ran from a black-sailed brig for a night and a day. Their gunners are poor at range but they close fast and they board. If you cannot outrun them, cut down the boarders — a ship without a crew is anyone's ship." },
  j_cargo: { t: 'Cargo Manifest: MV Halden', x: "Hold 2: forty crates, titanium fittings, for 'Array Core, refit'.\nHold 3: circuit assemblies, sealed.\n\nHandwritten at the bottom: 'Refit cancelled. Core not responding. Captain says we wait here for instructions.'\n\nThey waited too long." },
  j_boat4: { t: 'Deserter\'s Note', x: "Stole the skiff off the Dread Tide at the dark of the moon. Eight guns a side and Vane at the wheel — do not fight her with a bow and a prayer. Ballistas. Plating. A captured ship of your own if you can manage it." },
  j_vault: { t: 'Vault Recorder', x: "This is Hale. If the vault is open, you got past the Warden, and you are braver than my whole staff.\n\nKEYCARD C is yours. Take the three to the Core. The console will ask you one question: restore the old reply, or go silent.\n\nI changed the reply. It was me. I wanted to know what the Choir would say if we asked it something new. It answered with the Long Tide.\n\nPut it back. Please." },
  j_core: { t: 'Core Operations Log', x: "ARRAY CORE — STATUS: DORMANT\nReply signal: MODIFIED (unauthorised)\nSea state index: CRITICAL\n\nInsert three keycards to restore the original reply.\n\nA note taped to the console, in a different hand: 'If you made it this far on a raft, you have already done the hard part.'" },
};

export const RADIO = [
  { t: 'Automated loop', x: '"…Station Meridian, automated. Evacuation complete. Engine schematics available at central terminal. Bearing south-west of the green island. This message repeats…"', reveal: ['meridian', 'm_station'] },
  { t: 'Old mayday', x: '"Mayday, mayday, motor vessel Halden, we are taking water by the stern, position north of the pirate hold, cargo is — " The recording loops. It is years old.', reveal: ['cargo'] },
  { t: 'Pirate chatter', x: '"…tithe ships back to the Hold by dark. Vane wants the eastern passage shut. Anything on a raft, you sink it or you bring it in." Laughter, then static.', reveal: ['blackwater', 'm_fort'] },
  { t: 'Backup beacon', x: '"Frostfang laboratory, backup power at nine percent. Hatch unlocked. Deep-dive stores intact. Far north. Dress warmly." A synthetic voice, perfectly calm.', reveal: ['frostfang', 'm_lab'] },
  { t: 'Deep sensor ping', x: 'Not a voice. A slow pulse, rising from below the range of hearing, with a pressure reading attached: the trench floor, south-east. Something metal is down there.', reveal: ['vault'] },
  { t: 'Carrier wave', x: 'One clear tone from the far north-east, steady as a held breath. Under it, much lower, something answers — a single note, patient, enormous.', reveal: ['core'] },
];

// c: condition (prog, raft) -> [have, need] or boolean
const cnt = (k) => (p) => p.counts[k] || 0;
export const QUESTS = [
  // Stage 1
  { id: 'debris', s: 1, main: 1, t: 'Flotsam', d: 'Grab 8 pieces of floating debris (walk to the raft edge and interact).', c: (p) => [cnt('debris')(p), 8], r: { wood: 4, fiber: 4 } },
  { id: 'hook', s: 1, main: 1, t: 'A longer reach', d: 'Craft a Throwing Hook and reel in debris with it.', c: (p) => [(p.flags.craft_hook ? 1 : 0) + (p.counts.hooked ? 1 : 0), 2], r: { wood: 4, rope: 1 } },
  { id: 'eat', s: 1, main: 1, t: 'Food and water', d: 'Eat something and drink something.', c: (p) => [(p.flags.ate ? 1 : 0) + (p.flags.drank ? 1 : 0), 2], r: { flask_full: 1, coconut: 2 } },
  { id: 'hammer', s: 1, main: 1, t: 'Room to stand', d: 'Craft a Build Hammer and expand the raft to 6 foundations.', c: (p, r) => [Math.min(6, r.nTiles), 6], r: { wood: 6, scrap: 2 } },
  { id: 'chest', s: 1, main: 1, t: 'Somewhere to keep it', d: 'Build a Storage Chest.', c: (p) => !!p.counts.built_chest, r: { scrap: 2, rope: 2 } },
  { id: 'shark', s: 1, main: 1, t: 'First blood', d: 'Craft a spear and strike a shark.', c: (p) => !!p.flags.sharkhit, r: { bandage: 2, wood: 4 } },
  // Stage 2
  { id: 'tiles12', s: 2, main: 1, t: 'A proper deck', d: 'Expand the raft to 12 foundations.', c: (p, r) => [Math.min(12, r.nTiles), 12], r: { wood: 10, rope: 2 } },
  { id: 'purifier', s: 2, main: 1, t: 'Fresh water', d: 'Build a Water Purifier.', c: (p) => !!p.counts.built_purifier, r: { flask: 1, scrap: 2 } },
  { id: 'grill', s: 2, main: 1, t: 'Hot meal', d: 'Build a Cooking Grill and cook something on it.', c: (p) => [(p.counts.built_grill ? 1 : 0) + (p.counts.cooked ? 1 : 0), 2], r: { raw_fish: 2, stone: 4 } },
  { id: 'tools', s: 2, main: 1, t: 'Tools of the trade', d: 'Craft a Stone Axe and a Fishing Rod.', c: (p) => [(p.flags.craft_axe_stone ? 1 : 0) + (p.flags.craft_rod ? 1 : 0), 2], r: { rope: 3, stone: 3 } },
  { id: 'island', s: 2, main: 1, t: 'Landfall', d: 'Discover an island. One lies to the north-east of where you were wrecked.', c: (p) => [Math.min(1, cnt('islands')(p)), 1], r: { stone: 6, cloth: 2 } },
  { id: 'sail', s: 2, main: 1, t: 'Catch the wind', d: 'Build a Sail.', c: (p) => !!p.counts.built_sail, r: { rope: 3, cloth: 2 } },
  { id: 'bench', s: 2, main: 1, t: 'Workshop', d: 'Build a Workbench.', c: (p) => !!p.counts.built_bench, r: { scrap: 4 } },
  { id: 'shelter', s: 2, t: 'A roof and a bed', d: 'Build a Thatch Roof and a Hammock, then sleep through a night.', c: (p) => [(p.counts.built_roof ? 1 : 0) + (p.counts.built_bed ? 1 : 0) + (p.counts.sleep ? 1 : 0), 3], r: { cloth: 3, wood: 8 } },
  { id: 'ashore', s: 2, t: 'Camp ashore', d: 'Craft a Campfire Kit and a Lean-to Kit and place both on an island.', c: (p) => [(p.counts.camp_campfire ? 1 : 0) + (p.counts.camp_leanto ? 1 : 0), 2], r: { cooked_fish: 2, rope: 2 } },
  { id: 'fisher', s: 2, t: 'Patient hands', d: 'Catch 4 fish with the rod.', c: (p) => [cnt('fish')(p), 4], r: { rope: 2, cooked_fish: 2 } },
  { id: 'camp', s: 2, t: 'Not the first', d: 'Find the castaway camp on Coconut Cay.', c: (p) => !!p.flags.poi_m_cay, r: { bandage: 1, coconut: 3 } },
  // Stage 3
  { id: 'wheel', s: 3, main: 1, t: 'Take the helm', d: 'Build a Steering Wheel and steer the raft.', c: (p) => [(p.counts.built_wheel ? 1 : 0) + (p.counts.helm ? 1 : 0), 2], r: { cloth: 3, rope: 3 } },
  { id: 'islands3', s: 3, main: 1, t: 'Wider waters', d: 'Discover 3 islands.', c: (p) => [Math.min(3, cnt('islands')(p)), 3], r: { ingot: 2, glass: 1 } },
  { id: 'forge', s: 3, main: 1, t: 'Iron age', d: 'Build a Forge and smelt an Iron Ingot. Ore veins are found on rocky islands — bring a pickaxe.', c: (p) => [(p.counts.built_forge ? 1 : 0) + (p.flags.craft_ingot ? 1 : 0), 2], r: { ore: 4, wood: 6 } },
  { id: 'settle', s: 3, main: 1, t: 'Empty houses', d: 'Find the abandoned village on Verdant Reach.', c: (p) => !!p.flags.poi_m_village, r: { seed: 3, cloth: 2 } },
  { id: 'nav', s: 3, main: 1, t: 'Charts and stars', d: 'Build a Chart Table.', c: (p) => !!p.counts.built_navtable, r: { glass: 1, ingot: 1 } },
  { id: 'dive', s: 3, main: 1, t: 'Below the surface', d: 'Craft a Diving Mask and loot a sunken shipwreck.', c: (p) => [(p.flags.craft_mask ? 1 : 0) + Math.min(1, cnt('wrecks')(p)), 2], r: { scrap: 5, pearl: 1 } },
  { id: 'radio', s: 3, t: 'Voices on the water', d: 'Find a radio schematic, build a Radio Receiver and listen to a transmission.', c: (p) => [(p.bps.radio ? 1 : 0) + (p.counts.built_radio ? 1 : 0) + Math.min(1, p.radio), 3], r: { circuit: 1 } },
  { id: 'cave', s: 3, t: 'What the diver hid', d: 'Find the hidden cave on Verdant Reach.', c: (p) => !!p.flags.loot_c_cave, r: { glass: 2 } },
  { id: 'patrol', s: 3, t: 'Black sails', d: 'Survive being spotted by a pirate patrol.', c: (p) => !!p.counts.piratespotted, r: { arrow: 12 } },
  { id: 'boar', s: 3, t: 'Hunter', d: 'Hunt a wild boar.', c: (p) => !!p.counts.kill_boar, r: { cooked_meat: 1, hide: 1 } },
  // Stage 4
  { id: 'storey', s: 4, main: 1, t: 'Second storey', d: 'Build an Upper Floor and Stairs.', c: (p, r) => [(r.topLevel >= 1 ? 1 : 0) + (p.counts.built_stairs ? 1 : 0), 2], r: { wood: 12, ingot: 2 } },
  { id: 'station', s: 4, main: 1, t: 'Station Meridian', d: 'Reach the research station in the south-west and access its terminal.', c: (p) => !!p.flags.key_a, r: { circuit: 2 } },
  { id: 'engine', s: 4, main: 1, t: 'Under power', d: 'Build an Engine and run it.', c: (p) => [(p.counts.built_engine ? 1 : 0) + (p.counts.engine ? 1 : 0), 2], r: { wood: 15 } },
  { id: 'defend', s: 4, main: 1, t: 'Teeth of your own', d: 'Build a Ballista Turret.', c: (p) => !!p.counts.built_turret, r: { arrow: 12, ingot: 2 } },
  { id: 'arms', s: 4, main: 1, t: 'Iron in hand', d: 'Craft an Iron Spear and a Plated Vest.', c: (p) => [(p.flags.craft_spear_metal ? 1 : 0) + (p.flags.craft_armor ? 1 : 0), 2], r: { bandage: 2 } },
  { id: 'crew', s: 4, main: 1, t: 'Repel boarders', d: 'Defeat a pirate crew or sink a pirate ship.', c: (p) => [Math.min(1, cnt('derelict')(p) + cnt('kill_ship')(p)), 1], r: { gold: 8, titanium: 1 } },
  { id: 'deepdive', s: 4, main: 1, t: 'Dangerous water', d: 'Craft an Oxygen Tank and loot 3 underwater sites.', c: (p) => [(p.flags.craft_tank ? 1 : 0) + Math.min(3, cnt('wrecks')(p)), 4], r: { titanium: 2, circuit: 1 } },
  { id: 'storm', s: 4, t: 'Weathered', d: 'Survive a major storm.', c: (p) => !!p.counts.stormsurvived, r: { cloth: 4, rope: 4 } },
  { id: 'hold', s: 4, t: "Captain's chest", d: "Raid the pirate stronghold on Blackwater Hold and open the captain's chest.", c: (p) => !!p.flags.loot_c_fort, r: { gold: 10 } },
  { id: 'xmarks', s: 4, t: 'X marks the spot', d: 'Follow the treasure map to the buried treasure.', c: (p) => !!p.flags.loot_buried, r: { pearl: 2 } },
  // Stage 5
  { id: 'base40', s: 5, main: 1, t: 'Floating home', d: 'Grow the raft to 40 foundations.', c: (p, r) => [Math.min(40, r.nTiles), 40], r: { ingot: 6, wood: 20 } },
  { id: 'rooms', s: 5, main: 1, t: 'Rooms with a purpose', d: 'Enclose your base: 12 walls or windows, 6 roofs or upper floors, 3 storage chests.', c: (p, r) => { let w = 0, f = 0, c = 0; for (const k of r.pieces.values()) { if (k.slot === 'E' && k.type !== 'railing') w++; if (k.slot === 'R' || (k.slot === 'T' && k.l > 0)) f++; if (k.type === 'chest') c++; } return [Math.min(12, w) + Math.min(6, f) + Math.min(3, c), 21]; }, r: { glass: 4, cloth: 4 } },
  { id: 'farm', s: 5, main: 1, t: 'Self-sufficient', d: 'Build 2 Planters and an Electric Purifier, and harvest a crop.', c: (p, r) => [Math.min(2, r.devicesOf('planter').length) + (r.devicesOf('purifier2').length ? 1 : 0) + (p.counts.farm ? 1 : 0), 4], r: { seed: 4, circuit: 1 } },
  { id: 'capture', s: 5, main: 1, t: 'A ship of your own', d: 'Defeat a pirate crew, board their ship and capture it at the helm.', c: (p) => !!p.counts.capture, r: { gold: 15, arrow: 20 } },
  { id: 'islands7', s: 5, main: 1, t: 'Cartographer', d: 'Discover 7 islands.', c: (p) => [Math.min(7, cnt('islands')(p)), 7], r: { titanium: 3 } },
  { id: 'plating', s: 5, main: 1, t: 'Stronger stuff', d: 'Lay 6 Plated Foundations.', c: (p, r) => { let n = 0; for (const k of r.pieces.values()) if (k.type === 'foundation_r') n++; return [Math.min(6, n), 6]; }, r: { ingot: 6 } },
  { id: 'lab', s: 5, main: 1, t: 'The cold laboratory', d: 'Find the hidden laboratory on Frostfang Isle, far to the north. Bring a coat.', c: (p) => !!p.flags.key_b, r: { titanium: 3, circuit: 2 } },
  { id: 'stones', s: 5, t: 'The Listening Stones', d: 'Find what waits in the fog of Mistveil, far to the west.', c: (p) => !!p.flags.loot_c_mist, r: { crystal: 1 } },
  { id: 'whale', s: 5, t: 'Old travellers', d: 'Meet a migrating whale.', c: (p) => !!p.counts.whale, r: { pearl: 1 } },
  // Stage 6
  { id: 'suit', s: 6, main: 1, t: 'Rated for the floor', d: 'Craft a Pressure Suit.', c: (p) => !!p.flags.craft_suit, r: { crystal: 1 } },
  { id: 'vault', s: 6, main: 1, t: 'The pressure vault', d: 'Dive the Abyssal Trench in the south-east and open the vault on its floor.', c: (p) => !!p.flags.key_c, r: { titanium: 6 } },
  { id: 'all', s: 6, main: 1, t: 'Every shore', d: 'Discover all 9 islands.', c: (p) => [Math.min(9, cnt('islands')(p)), 9], r: { gold: 20 } },
  { id: 'fortress', s: 6, main: 1, t: 'Floating fortress', d: 'Build a fortress: 70 foundations, a Fortress Beacon and 2 Ballista Turrets.', c: (p, r) => [Math.min(70, r.nTiles) + (r.devicesOf('beacon').length ? 1 : 0) + Math.min(2, r.devicesOf('turret').length), 73], r: { crystal: 2, titanium: 6 } },
  { id: 'dread', s: 6, main: 1, t: 'The Dread Tide', d: "Sink Captain Vane's galleon off The Maw, or take her crew.", c: (p) => !!p.flags.boss_down, r: { gold: 30 } },
  { id: 'core', s: 6, main: 1, t: 'The answer', d: 'Bring all three keycards to the Array Core in the far north-east.', c: (p) => !!p.flags.ending, r: {} },
  { id: 'warden', s: 6, t: 'Warden of the Trench', d: 'Slay the creature that guards the vault.', c: (p) => !!p.counts.kill_eel, r: { pearl: 4 } },
];

export class Progress {
  constructor() { G.prog = this; this.reset(); }
  reset() { this.stage = 1; this.flags = {}; this.bps = {}; this.looted = {}; this.revealed = {}; this.counts = {}; this.done = {}; this.journals = []; this.radio = 0; this.radioT = 0; this.track = null; this.camps = []; this.explored = new Array(72 * 72).fill(0); }
  inc(k, n = 1) { this.counts[k] = (this.counts[k] || 0) + n; this.check = true; }
  setFlag(f) {
    if (this.flags[f]) return; this.flags[f] = 1; this.check = true;
    if (f.startsWith('key_')) G.ui.banner('Keycard ' + f.slice(4).toUpperCase() + ' acquired', `${['key_a', 'key_b', 'key_c'].filter((k) => this.flags[k]).length} of 3 Array keycards`);
    if (f === 'treasure_map') { G.ui.banner('Treasure map found', 'Something is buried on Sunken Crown, to the south'); const m = G.world.reveal('m_dig'); G.world.reveal('crown'); }
  }
  unlockBP(id) { if (this.bps[id]) return; this.bps[id] = 1; this.check = true; G.ui.banner('Schematic found', BLUEPRINTS[id]); G.audio.sfx('unlock'); G.ui.dirty = true; }
  unlocked(r) { return this.stage >= r.stage && (!r.bp || this.bps[r.bp]); }
  lockReason(r) { if (this.stage < r.stage) return `Reach stage ${r.stage}: ${STAGES[r.stage]}`; if (r.bp && !this.bps[r.bp]) return 'Find: ' + BLUEPRINTS[r.bp]; return ''; }
  questState(q) { const v = q.c(this, G.raft); return Array.isArray(v) ? { have: v[0], need: v[1], ok: v[0] >= v[1] } : { have: v ? 1 : 0, need: 1, ok: !!v }; }
  active() { return QUESTS.filter((q) => q.s <= this.stage && !this.done[q.id]); }
  update(dt) {
    this.radioT += dt;
    this.tick = (this.tick || 0) + dt;
    if (!this.check && this.tick < 1.5) return;
    this.check = false; this.tick = 0;
    for (const q of QUESTS) {
      if (q.s > this.stage || this.done[q.id]) continue;
      if (this.questState(q).ok) {
        this.done[q.id] = 1; G.player.give(q.r, true);
        const rw = Object.entries(q.r).map(([k, n]) => `${ITEMS[k].icon}${n}`).join(' ');
        G.ui.banner('Quest complete: ' + q.t, rw ? 'Reward: ' + rw : ''); G.audio.sfx('quest'); G.ui.dirty = true;
      }
    }
    if (this.stage < 6 && QUESTS.every((q) => q.s !== this.stage || !q.main || this.done[q.id])) {
      this.stage++; this.check = true;
      const news = [...Object.values(PIECES).filter((p) => p.stage === this.stage && !p.bp).map((p) => p.name)].slice(0, 6).join(', ');
      G.ui.banner(`Stage ${this.stage}: ${STAGES[this.stage]}`, news ? 'Unlocked: ' + news + '…' : 'New recipes unlocked'); G.audio.sfx('stage'); G.ui.dirty = true; emit('stage', this.stage);
    }
  }
  serialize() { return { stage: this.stage, flags: this.flags, bps: this.bps, looted: this.looted, revealed: this.revealed, counts: this.counts, done: this.done, journals: this.journals, radio: this.radio, track: this.track, camps: this.camps, explored: this.explored.join('') }; }
  load(d) { this.reset(); for (const k of ['stage', 'flags', 'bps', 'looted', 'revealed', 'counts', 'done', 'journals', 'radio', 'track', 'camps']) if (d[k] !== undefined) this[k] = d[k]; if (d.explored) this.explored = d.explored.split('').map(Number); }
}

export class Story {
  constructor() {
    G.story = this; const p = G.prog;
    on('debris', () => G.prog.inc('debris'));
    on('hooked', () => G.prog.inc('hooked'));
    on('craft', (id) => { G.prog.flags['craft_' + id] = 1; G.prog.inc('crafts'); });
    on('built', (type) => G.prog.inc('built_' + type));
    on('consume', (id) => { const it = ITEMS[id]; if (it.hunger) G.prog.setFlag('ate'); if (it.thirst) G.prog.setFlag('drank'); });
    on('drink', () => G.prog.setFlag('drank'));
    on('discover', (isl) => { G.prog.inc('islands'); G.ui.banner('Discovered: ' + isl.name, { tropical: 'A scrap of sand and palms', jungle: 'Dense jungle climbs toward a waterfall', rocky: 'Bare rock streaked with rust', pirate: 'Smoke rises behind a palisade', station: 'White modules and a silent dish', ruins: 'Broken pillars above the tideline', snow: 'Ice, pines and a bitter wind', strange: 'The fog here does not move', volcanic: 'The mountain glows from within' }[isl.biome]); G.audio.sfx('discover'); });
    on('poi', (m) => { G.prog.setFlag('poi_' + m.id); G.ui.toast(`${m.icon} Found: ${m.name}`); G.audio.sfx('discover'); });
    on('kill', (kind, sub) => { G.prog.inc('kill_' + kind); if (kind === 'ship' && sub === 'boss') G.prog.setFlag('boss_down'); if (kind === 'eel') G.prog.setFlag('eel_dead'); });
    on('derelict', (s) => { G.prog.inc('derelict'); if (s.boss) G.prog.setFlag('boss_down'); });
    on('loot', (id) => { G.prog.setFlag('loot_' + id); if (/^(w\d|cargo|uwcave|uwruins)$/.test(id)) G.prog.inc('wrecks'); });
    on('sharkhit', () => G.prog.setFlag('sharkhit'));
    for (const e of ['fish', 'sleep', 'stormsurvived', 'capture', 'farm', 'helm', 'engine', 'whale', 'piratespotted']) on(e, () => G.prog.inc(e));
    on('cooked', () => G.prog.inc('cooked'));
    on('camp', (t) => G.prog.inc('camp_' + t));
  }
  read(id, quiet) {
    const j = JOURNALS[id]; if (!j) return;
    const p = G.prog; if (!p.journals.includes(id)) { p.journals.push(id); p.check = true; }
    G.ui.reader(j.t, j.x); G.audio.sfx('page');
  }
  radioPending() { const p = G.prog; return p.radio < RADIO.length && p.radio < Math.max(1, (p.stage - 2) * 2) && p.radioT > (p.radio ? 150 : 5); }
  listen() {
    const p = G.prog;
    if (!this.radioPending()) { G.ui.toast(p.radio >= RADIO.length ? 'Only the carrier wave now.' : 'Static. Try again later — signals carry further as you travel.'); G.audio.sfx('static'); return; }
    const r = RADIO[p.radio++]; p.radioT = 0; p.check = true;
    for (const id of r.reveal) G.world.reveal(id);
    G.audio.sfx('static'); G.ui.reader('📻 ' + r.t, r.x + '\n\n(A new location has been marked on your map.)');
  }
  useCore() {
    const p = G.prog, n = ['key_a', 'key_b', 'key_c'].filter((k) => p.flags[k]).length;
    if (p.flags.ending) { G.ui.reader('Array Core', 'ARRAY CORE — STATUS: ACTIVE\nReply signal: ORIGINAL\nSea state index: FALLING\n\nThe tower hums. Far below, the note continues, and it no longer sounds like a question.'); return; }
    if (n < 3) { G.ui.reader('Array Core', `The console has three keycard slots.\n\nYou hold ${n} of 3.\n\n${p.flags.key_a ? '✔' : '✖'} Keycard A — Station Meridian terminal\n${p.flags.key_b ? '✔' : '✖'} Keycard B — Frostfang laboratory\n${p.flags.key_c ? '✔' : '✖'} Keycard C — Trench pressure vault`); return; }
    p.setFlag('ending'); G.env.setWeather('clear', 600); G.audio.sfx('stage');
    G.ui.fade(() => {}, 'The Core wakes.');
    setTimeout(() => G.ui.reader('The Answer', "You slot the third card home.\n\nThe tower's light climbs from pale blue to white, and a tone rolls out across the water — the old reply, the one the sea has been waiting years to hear.\n\nFor a long moment nothing changes. Then the swell under the platform eases, like a held breath let go. On the horizon the storm line that has followed you since the wreck simply… comes apart.\n\nDeep in the trench, the Choir holds its note. It does not sound angry. It never was.\n\nYou came here on four planks and a length of rope. You are leaving on a fortress.\n\nThe sea is yours to wander. Storms will still come — but the Long Tide is over.\n\n— THE END —\n\n(You can keep playing: build, explore and finish any remaining quests.)"), 2600);
  }
}
