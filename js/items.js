// Item, recipe and build-piece data.
export const STAGES = ['', 'Stranded', 'Survival', 'Exploration', 'Advanced Survival', 'Master Builder', 'Endgame'];

// type: res | food | drink | tool | gear | med
export const ITEMS = {
  wood: { name: 'Plank', icon: '🪵', type: 'res', desc: 'Driftwood. The base of everything.' },
  fiber: { name: 'Palm Fiber', icon: '🌿', type: 'res', desc: 'Leaves and fronds. Twist into rope or weave into cloth.' },
  rope: { name: 'Rope', icon: '🪢', type: 'res', desc: 'Twisted palm fiber.' },
  stone: { name: 'Stone', icon: '🪨', type: 'res', desc: 'Found on beaches and rocky ground.' },
  scrap: { name: 'Scrap', icon: '🔩', type: 'res', desc: 'Salvaged metal bits.' },
  sand: { name: 'Sand', icon: '⏳', type: 'res', desc: 'Smelt into glass, or use as planter soil.' },
  ore: { name: 'Iron Ore', icon: '⛏️', type: 'res', desc: 'Mine from rusty veins with a pickaxe. Smelt at a forge.' },
  ingot: { name: 'Iron Ingot', icon: '🧱', type: 'res', desc: 'Smelted iron.' },
  glass: { name: 'Glass', icon: '🔷', type: 'res', desc: 'Smelted from sand.' },
  cloth: { name: 'Cloth', icon: '🧵', type: 'res', desc: 'Woven fiber for sails and clothing.' },
  hide: { name: 'Hide', icon: '🟫', type: 'res', desc: 'Tough animal hide.' },
  tooth: { name: 'Shark Tooth', icon: '🦷', type: 'res', desc: 'Proof you won.' },
  ti_ore: { name: 'Titanium Ore', icon: '💠', type: 'res', desc: 'Rare. Found on cold peaks and deep underwater.' },
  titanium: { name: 'Titanium', icon: '⬜', type: 'res', desc: 'Light, strong, rust-proof.' },
  circuit: { name: 'Circuit Board', icon: '📟', type: 'res', desc: 'Salvaged electronics from wrecks and stations.' },
  pearl: { name: 'Pearl', icon: '⚪', type: 'res', desc: 'From deep clams.' },
  crystal: { name: 'Resonant Crystal', icon: '🔮', type: 'res', desc: 'It hums when the tide turns.' },
  gold: { name: 'Doubloon', icon: '🪙', type: 'res', desc: 'Pirate gold.' },
  seed: { name: 'Seed Potato', icon: '🥔', type: 'food', hunger: 8, cook: 'potato', desc: 'Eat raw, bake on a grill, or plant in a planter.' },

  coconut: { name: 'Coconut', icon: '🥥', type: 'food', hunger: 10, thirst: 16, desc: 'Food and drink in one.' },
  mango: { name: 'Mango', icon: '🥭', type: 'food', hunger: 14, thirst: 8 },
  berries: { name: 'Berries', icon: '🫐', type: 'food', hunger: 7, thirst: 4 },
  seaweed: { name: 'Seaweed', icon: '🥬', type: 'food', hunger: 5 },
  raw_fish: { name: 'Raw Fish', icon: '🐟', type: 'food', hunger: 9, cook: 'cooked_fish', desc: 'Better cooked.' },
  cooked_fish: { name: 'Grilled Fish', icon: '🍣', type: 'food', hunger: 32 },
  raw_meat: { name: 'Raw Meat', icon: '🥩', type: 'food', hunger: 8, hp: -6, cook: 'cooked_meat', desc: 'Cook it first.' },
  cooked_meat: { name: 'Roast Meat', icon: '🍖', type: 'food', hunger: 46, hp: 6 },
  shark_meat: { name: 'Shark Steak', icon: '🦈', type: 'food', hunger: 8, hp: -6, cook: 'cooked_shark' },
  cooked_shark: { name: 'Grilled Shark', icon: '🍢', type: 'food', hunger: 55, hp: 10 },
  potato: { name: 'Baked Potato', icon: '🍠', type: 'food', hunger: 30 },

  flask: { name: 'Empty Flask', icon: '🧴', type: 'res', desc: 'Fill at a purifier, rain collector or freshwater pool.' },
  flask_full: { name: 'Water Flask', icon: '💧', type: 'drink', thirst: 45, gives: 'flask' },
  bandage: { name: 'Bandage', icon: '🩹', type: 'med', hp: 35 },

  hook: { name: 'Throwing Hook', icon: '🪝', type: 'tool', stack: 1, desc: 'Throw at floating debris and reel it in.' },
  paddle: { name: 'Paddle', icon: '🏏', type: 'tool', stack: 1, desc: 'Row the raft where you are facing.' },
  hammer: { name: 'Build Hammer', icon: '🔨', type: 'tool', stack: 1, desc: 'Hold to build, repair and remove raft parts.' },
  axe_stone: { name: 'Stone Axe', icon: '🪓', type: 'tool', stack: 1, dmg: 14, chop: 1 },
  axe_metal: { name: 'Iron Axe', icon: '🪓', type: 'tool', stack: 1, dmg: 22, chop: 2.2 },
  pick_stone: { name: 'Stone Pickaxe', icon: '⛏️', type: 'tool', stack: 1, dmg: 12, mine: 1 },
  pick_metal: { name: 'Iron Pickaxe', icon: '⚒️', type: 'tool', stack: 1, dmg: 18, mine: 2.2 },
  spear: { name: 'Wooden Spear', icon: '🗡️', type: 'tool', stack: 1, dmg: 18, reach: 3.4 },
  spear_metal: { name: 'Iron Spear', icon: '🔱', type: 'tool', stack: 1, dmg: 32, reach: 3.6 },
  harpoon: { name: 'Titanium Harpoon', icon: '🔱', type: 'tool', stack: 1, dmg: 55, reach: 4 },
  cutlass: { name: 'Cutlass', icon: '⚔️', type: 'tool', stack: 1, dmg: 38, reach: 2.8, desc: 'Taken from a pirate.' },
  bow: { name: 'Bow', icon: '🏹', type: 'tool', stack: 1, desc: 'Needs arrows.' },
  arrow: { name: 'Arrow', icon: '➶', type: 'res' },
  rod: { name: 'Fishing Rod', icon: '🎣', type: 'tool', stack: 1, desc: 'Cast into water. Reel when the float dips.' },
  torch: { name: 'Torch', icon: '🔥', type: 'tool', stack: 1, dmg: 8, desc: 'Light and warmth while held.' },

  mask: { name: 'Diving Mask', icon: '🥽', type: 'gear', stack: 1, desc: 'Passive: +20s oxygen, clearer vision underwater.' },
  flippers: { name: 'Flippers', icon: '🩴', type: 'gear', stack: 1, desc: 'Passive: swim much faster.' },
  tank: { name: 'Oxygen Tank', icon: '🫧', type: 'gear', stack: 1, desc: 'Passive: +90s oxygen. Safe to 80m.' },
  tank_adv: { name: 'Twin Tank', icon: '🫧', type: 'gear', stack: 1, desc: 'Passive: +200s oxygen.' },
  dive_light: { name: 'Dive Light', icon: '🔦', type: 'gear', stack: 1, desc: 'Passive: lights up the deep and the night.' },
  suit: { name: 'Pressure Suit', icon: '🤿', type: 'gear', stack: 1, desc: 'Passive: survive trench pressure and cold water.' },
  coat: { name: 'Hide Coat', icon: '🧥', type: 'gear', stack: 1, desc: 'Passive: keeps out the cold.' },
  armor: { name: 'Plated Vest', icon: '🦺', type: 'gear', stack: 1, desc: 'Passive: take 35% less damage.' },
  sextant: { name: 'Sextant', icon: '🧭', type: 'gear', stack: 1, desc: 'Passive: compass shows every discovered island.' },
};
for (const k in ITEMS) { ITEMS[k].id = k; if (!ITEMS[k].stack) ITEMS[k].stack = ITEMS[k].type === 'res' || ITEMS[k].type === 'food' ? 50 : 10; if (ITEMS[k].stack === 1) ITEMS[k].stack = 1; }

// station: null (hands) | bench | forge
export const RECIPES = [
  { out: 'rope', n: 1, cost: { fiber: 2 }, stage: 1, cat: 'Materials' },
  { out: 'hook', n: 1, cost: { wood: 2, rope: 1 }, stage: 1, cat: 'Tools' },
  { out: 'hammer', n: 1, cost: { wood: 3, rope: 1 }, stage: 1, cat: 'Tools' },
  { out: 'paddle', n: 1, cost: { wood: 4 }, stage: 1, cat: 'Tools' },
  { out: 'spear', n: 1, cost: { wood: 5, rope: 1 }, stage: 1, cat: 'Weapons' },
  { out: 'flask', n: 1, cost: { scrap: 2 }, stage: 1, cat: 'Survival' },
  { out: 'bandage', n: 1, cost: { fiber: 4 }, stage: 1, cat: 'Survival' },

  { out: 'cloth', n: 1, cost: { fiber: 4 }, stage: 2, cat: 'Materials' },
  { out: 'axe_stone', n: 1, cost: { wood: 3, stone: 2, rope: 1 }, stage: 2, cat: 'Tools' },
  { out: 'pick_stone', n: 1, cost: { wood: 3, stone: 3, rope: 1 }, stage: 2, cat: 'Tools' },
  { out: 'rod', n: 1, cost: { wood: 4, rope: 3, scrap: 1 }, stage: 2, cat: 'Tools' },
  { out: 'torch', n: 1, cost: { wood: 2, fiber: 2 }, stage: 2, cat: 'Tools' },
  { out: 'bow', n: 1, cost: { wood: 5, rope: 3 }, stage: 2, cat: 'Weapons' },
  { out: 'arrow', n: 6, cost: { wood: 2, stone: 1 }, stage: 2, cat: 'Weapons' },

  { out: 'ingot', n: 1, cost: { ore: 2, wood: 1 }, stage: 3, station: 'forge', cat: 'Materials' },
  { out: 'glass', n: 1, cost: { sand: 2, wood: 1 }, stage: 3, station: 'forge', cat: 'Materials' },
  { out: 'axe_metal', n: 1, cost: { ingot: 3, wood: 3, rope: 2 }, stage: 3, station: 'bench', cat: 'Tools' },
  { out: 'pick_metal', n: 1, cost: { ingot: 3, wood: 3, rope: 2 }, stage: 3, station: 'bench', cat: 'Tools' },
  { out: 'spear_metal', n: 1, cost: { ingot: 2, wood: 4, rope: 2 }, stage: 3, station: 'bench', cat: 'Weapons' },
  { out: 'mask', n: 1, cost: { glass: 1, rope: 2, scrap: 2 }, stage: 3, station: 'bench', cat: 'Diving' },
  { out: 'flippers', n: 1, cost: { scrap: 4, rope: 2, hide: 1 }, stage: 3, station: 'bench', cat: 'Diving' },
  { out: 'sextant', n: 1, cost: { ingot: 2, glass: 1 }, stage: 3, station: 'bench', cat: 'Gear' },
  { out: 'coat', n: 1, cost: { hide: 3, cloth: 3 }, stage: 3, station: 'bench', cat: 'Gear' },

  { out: 'tank', n: 1, cost: { ingot: 5, glass: 1, scrap: 4 }, stage: 3, station: 'bench', bp: 'diving', cat: 'Diving' },
  { out: 'dive_light', n: 1, cost: { ingot: 2, glass: 1, circuit: 1 }, stage: 4, station: 'bench', cat: 'Diving' },
  { out: 'armor', n: 1, cost: { hide: 2, ingot: 4, rope: 2 }, stage: 4, station: 'bench', cat: 'Gear' },
  { out: 'titanium', n: 1, cost: { ti_ore: 2, wood: 2 }, stage: 4, station: 'forge', cat: 'Materials' },
  { out: 'harpoon', n: 1, cost: { titanium: 3, ingot: 2, rope: 3 }, stage: 4, station: 'bench', bp: 'harpoon', cat: 'Weapons' },

  { out: 'tank_adv', n: 1, cost: { titanium: 4, circuit: 2, glass: 2 }, stage: 5, station: 'bench', bp: 'deep', cat: 'Diving' },
  { out: 'suit', n: 1, cost: { titanium: 6, cloth: 4, circuit: 3, glass: 2 }, stage: 5, station: 'bench', bp: 'deep', cat: 'Diving' },
];
RECIPES.forEach((r) => (r.id = r.out));

export const BLUEPRINTS = {
  radio: 'Radio Receiver schematic',
  diving: 'Oxygen Tank schematic',
  engine: 'Raft Engine schematic',
  harpoon: 'Titanium Harpoon schematic',
  deep: 'Deep Dive equipment schematics',
  fortress: 'Fortress plating schematics',
};

// kind: tile (ground foundation) | floor (upper floor) | roof | edge | pillar | stairs | device
export const PIECES = {
  foundation: { name: 'Foundation', icon: '🟫', kind: 'tile', cost: { wood: 2, fiber: 2 }, stage: 1, hp: 100, cat: 'Structure' },
  foundation_r: { name: 'Plated Foundation', icon: '🛡️', kind: 'tile', cost: { wood: 2, ingot: 1 }, stage: 4, hp: 400, cat: 'Structure', desc: 'Sharks cannot bite through it. Place over open water or on an existing foundation.' },
  pillar: { name: 'Pillar', icon: '🏛️', kind: 'pillar', cost: { wood: 2 }, stage: 2, hp: 80, cat: 'Structure', desc: 'Supports a floor or roof above.' },
  wall: { name: 'Wall', icon: '🧱', kind: 'edge', cost: { wood: 3 }, stage: 2, hp: 100, cat: 'Structure' },
  doorway: { name: 'Doorway', icon: '🚪', kind: 'edge', cost: { wood: 3 }, stage: 2, hp: 100, cat: 'Structure' },
  window: { name: 'Window', icon: '🪟', kind: 'edge', cost: { wood: 3, glass: 1 }, stage: 3, hp: 100, cat: 'Structure' },
  railing: { name: 'Railing', icon: '🪜', kind: 'edge', cost: { wood: 1, rope: 1 }, stage: 2, hp: 60, cat: 'Structure' },
  wall_m: { name: 'Iron Wall', icon: '⬛', kind: 'edge', cost: { ingot: 2, wood: 1 }, stage: 5, bp: 'fortress', hp: 400, cat: 'Structure', desc: 'Shrugs off storms and cannon fire.' },
  roof: { name: 'Thatch Roof', icon: '🛖', kind: 'roof', cost: { wood: 2, fiber: 4 }, stage: 2, hp: 80, cat: 'Structure', desc: 'Shelter from rain, sun and cold.' },
  floor: { name: 'Upper Floor', icon: '⬜', kind: 'floor', cost: { wood: 3 }, stage: 3, hp: 100, cat: 'Structure', desc: 'A second storey. Needs a wall or pillar below.' },
  stairs: { name: 'Stairs', icon: '📶', kind: 'stairs', cost: { wood: 6 }, stage: 3, hp: 100, cat: 'Structure' },

  chest: { name: 'Storage Chest', icon: '📦', kind: 'device', cost: { wood: 6, scrap: 2 }, stage: 1, cat: 'Living' },
  bed: { name: 'Hammock', icon: '🛏️', kind: 'device', cost: { wood: 6, fiber: 8, rope: 2 }, stage: 2, cat: 'Living', desc: 'Sleep through the night.' },
  lantern: { name: 'Lantern', icon: '🏮', kind: 'device', cost: { wood: 2, scrap: 1, fiber: 2 }, stage: 2, cat: 'Living' },
  grill: { name: 'Cooking Grill', icon: '🍳', kind: 'device', cost: { wood: 4, stone: 4, scrap: 2 }, stage: 2, cat: 'Survival', desc: 'Cooks raw food. Warm to stand beside.' },
  purifier: { name: 'Water Purifier', icon: '🚰', kind: 'device', cost: { wood: 6, fiber: 4, scrap: 3 }, stage: 2, cat: 'Survival', desc: 'Slowly distils sea water.' },
  collector: { name: 'Rain Collector', icon: '🌧️', kind: 'device', cost: { wood: 4, cloth: 2, scrap: 2 }, stage: 2, cat: 'Survival', desc: 'Fills up when it rains.' },
  net: { name: 'Collection Net', icon: '🕸️', kind: 'device', cost: { wood: 4, rope: 6 }, stage: 2, cat: 'Survival', desc: 'Catches debris that drifts into it.' },
  planter: { name: 'Planter', icon: '🪴', kind: 'device', cost: { wood: 6, fiber: 4, sand: 2 }, stage: 3, cat: 'Survival', desc: 'Grow seed potatoes into food.' },
  purifier2: { name: 'Electric Purifier', icon: '⚗️', kind: 'device', cost: { ingot: 6, glass: 3, circuit: 1 }, stage: 4, cat: 'Survival', desc: 'Fast, large fresh water supply.' },

  bench: { name: 'Workbench', icon: '🛠️', kind: 'device', cost: { wood: 10, stone: 4, scrap: 4, rope: 2 }, stage: 2, cat: 'Crafting', desc: 'Unlocks advanced tool recipes.' },
  forge: { name: 'Forge', icon: '🌋', kind: 'device', cost: { stone: 12, scrap: 4, wood: 4 }, stage: 3, cat: 'Crafting', desc: 'Smelts ore, sand and titanium.' },

  sail: { name: 'Sail', icon: '⛵', kind: 'device', cost: { wood: 6, rope: 4, cloth: 3 }, stage: 2, cat: 'Sailing', desc: 'Catches wind. Toggle open or furled.' },
  anchor: { name: 'Anchor', icon: '⚓', kind: 'device', cost: { stone: 6, rope: 4, scrap: 2 }, stage: 2, cat: 'Sailing', desc: 'Holds the raft in place.' },
  wheel: { name: 'Steering Wheel', icon: '☸️', kind: 'device', cost: { wood: 8, rope: 4, scrap: 4 }, stage: 3, cat: 'Sailing', desc: 'Take the helm and steer.' },
  sail2: { name: 'Great Sail', icon: '🚩', kind: 'device', cost: { wood: 10, rope: 8, cloth: 8, ingot: 2 }, stage: 3, cat: 'Sailing', desc: 'Twice the pull of a basic sail.' },
  navtable: { name: 'Chart Table', icon: '🗺️', kind: 'device', cost: { wood: 8, ingot: 2, glass: 1, cloth: 2 }, stage: 3, cat: 'Sailing', desc: 'Charts far more of the sea around you.' },
  radio: { name: 'Radio Receiver', icon: '📻', kind: 'device', cost: { ingot: 4, circuit: 2, scrap: 6 }, stage: 3, bp: 'radio', cat: 'Sailing', desc: 'Picks up transmissions and marks them on your map.' },
  engine: { name: 'Engine', icon: '⚙️', kind: 'device', cost: { ingot: 10, circuit: 2, scrap: 8 }, stage: 4, bp: 'engine', cat: 'Sailing', desc: 'Burns planks. Powerful thrust in any wind.' },

  turret: { name: 'Ballista Turret', icon: '🎯', kind: 'device', cost: { wood: 10, ingot: 6, rope: 6 }, stage: 4, cat: 'Defence', desc: 'Automatically fires on sharks, boarders and pirate ships.' },
  beacon: { name: 'Fortress Beacon', icon: '🗼', kind: 'device', cost: { titanium: 6, glass: 4, circuit: 3, crystal: 2 }, stage: 5, bp: 'fortress', cat: 'Defence', desc: 'A great light. Sharks keep their distance.' },
};
for (const k in PIECES) PIECES[k].id = k;

export const costText = (cost) => Object.entries(cost).map(([k, n]) => `${ITEMS[k].icon}${n}`).join(' ');
