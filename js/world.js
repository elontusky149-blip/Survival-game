// Terrain, islands, vegetation, resource nodes, points of interest.
import * as THREE from 'three';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';
import { G, clamp, lerp, smoothstep, noise2, fbm, mulberry32, emit, rand } from './util.js';
import { mat, tex } from './textures.js';
import { mesh, boxG, cylG, sphG, coneG, colMat, geo, makeShip, hullGeometry } from './models.js';
import { waveHeight } from './env.js';
import { ITEMS } from './items.js';

export const ISLANDS = [
  { id: 'cay', name: 'Coconut Cay', x: 250, z: -320, r: 105, peak: 16, biome: 'tropical', seed: 11 },
  { id: 'verdant', name: 'Verdant Reach', x: -820, z: -560, r: 290, peak: 85, biome: 'jungle', seed: 23 },
  { id: 'ironback', name: 'Ironback Rock', x: 900, z: 540, r: 185, peak: 110, biome: 'rocky', seed: 37 },
  { id: 'blackwater', name: 'Blackwater Hold', x: 1650, z: -900, r: 225, peak: 40, biome: 'pirate', seed: 41 },
  { id: 'meridian', name: 'Station Meridian', x: -1500, z: 900, r: 205, peak: 32, biome: 'station', seed: 53 },
  { id: 'crown', name: 'Sunken Crown', x: 300, z: 1700, r: 195, peak: 30, biome: 'ruins', seed: 67 },
  { id: 'frostfang', name: 'Frostfang Isle', x: -400, z: -2550, r: 275, peak: 140, biome: 'snow', seed: 71 },
  { id: 'mistveil', name: 'Mistveil', x: -2400, z: -700, r: 170, peak: 38, biome: 'strange', seed: 83 },
  { id: 'maw', name: 'The Maw', x: 2500, z: 1500, r: 235, peak: 120, biome: 'volcanic', seed: 97, crater: true },
];
export const TRENCH = { ax: 1450, az: 2150, bx: 3050, bz: 650 };
export const WORLD_R = 3600;
// raised sandbanks so the first wrecks are reachable without a tank
const SHOALS = [{ x: -260, z: 400, r: 95, h: -12 }, { x: 640, z: -40, r: 95, h: -15 }, { x: -350, z: 1250, r: 100, h: -19 }];

function distSeg(x, z, s) {
  const vx = s.bx - s.ax, vz = s.bz - s.az;
  const t = clamp(((x - s.ax) * vx + (z - s.az) * vz) / (vx * vx + vz * vz), 0, 1);
  return Math.hypot(x - (s.ax + vx * t), z - (s.az + vz * t));
}
export function seabedHeight(x, z) {
  let h = -30 - fbm(x / 420, z / 420, 3, 7) * 50 + (noise2(x / 37, z / 37, 3) - 0.5) * 3;
  for (const s of SHOALS) { const sd = Math.hypot(x - s.x, z - s.z); if (sd < s.r) h = lerp(h, s.h + (noise2(x / 14, z / 14, 4) - 0.5) * 2, smoothstep(s.r, s.r * 0.45, sd)); }
  const d = distSeg(x, z, TRENCH);
  if (d < 460) h -= smoothstep(460, 70, d) * 175;
  return h;
}
function islandRaw(isl, x, z) {
  const dx = x - isl.x, dz = z - isl.z, d = Math.hypot(dx, dz);
  const nx = dx / (d || 1), nz = dz / (d || 1);
  const rr = isl.r * (0.8 + 0.42 * noise2(nx * 1.6 + isl.seed * 13.1, nz * 1.6 + isl.seed * 7.7, isl.seed));
  const t = 1 - d / rr;
  let h;
  if (t < 0.12) h = t * 16;
  else {
    const n = fbm(x / (isl.r * 0.36), z / (isl.r * 0.36), 4, isl.seed + 3), u = t - 0.12;
    h = 1.92 + Math.pow(u, 1.35) * isl.peak * (0.3 + 1.5 * n * n) + n * u * 14;
    h += (noise2(x / 9, z / 9, isl.seed) - 0.5) * Math.min(1.2, u * 8);
  }
  if (isl.crater) { const cd = d / (isl.r * 0.2); if (cd < 1.5) h = lerp(h, isl.peak * 0.42 + cd * cd * 9, smoothstep(1.5, 0.75, cd)); }
  for (const f of isl.flats) {
    const fd = Math.hypot(x - f.x, z - f.z);
    if (fd < f.R * 1.8) h = lerp(h, f.h, smoothstep(f.R * 1.8, f.R, fd));
  }
  const w = smoothstep(-0.95, -0.35, t);
  return w <= 0 ? null : { h, w };
}
function analyticHeight(x, z) {
  const sb = seabedHeight(x, z);
  for (const isl of ISLANDS) {
    if (Math.abs(x - isl.x) > isl.half || Math.abs(z - isl.z) > isl.half) continue;
    const r = islandRaw(isl, x, z);
    if (r) return lerp(sb, r.h, r.w);
  }
  return sb;
}
// Height queries use the island mesh grid so feet always match the rendered ground.
export function terrainHeight(x, z) {
  for (const isl of ISLANDS) {
    if (!isl.heights || Math.abs(x - isl.x) >= isl.half || Math.abs(z - isl.z) >= isl.half) continue;
    const N = isl.N, gx = ((x - isl.x + isl.half) / (isl.half * 2)) * N, gz = ((z - isl.z + isl.half) / (isl.half * 2)) * N;
    const ix = Math.min(N - 1, Math.floor(gx)), iz = Math.min(N - 1, Math.floor(gz)), fx = gx - ix, fz = gz - iz;
    const H = isl.heights, n1 = N + 1;
    const a = H[iz * n1 + ix], b = H[(iz + 1) * n1 + ix], c = H[(iz + 1) * n1 + ix + 1], d = H[iz * n1 + ix + 1];
    return fx + fz < 1 ? a + (d - a) * fx + (b - a) * fz : c + (b - c) * (1 - fx) + (d - c) * (1 - fz);
  }
  return seabedHeight(x, z);
}
export function islandAt(x, z, pad = 1.6) {
  for (const isl of ISLANDS) if (Math.hypot(x - isl.x, z - isl.z) < isl.r * pad) return isl;
  return null;
}

const BIOME = {
  tropical: { grass: [0.33, 0.56, 0.2], rock: [0.5, 0.47, 0.42] },
  jungle: { grass: [0.15, 0.4, 0.13], rock: [0.38, 0.38, 0.33] },
  rocky: { grass: [0.4, 0.44, 0.28], rock: [0.45, 0.42, 0.39] },
  pirate: { grass: [0.5, 0.49, 0.24], rock: [0.46, 0.4, 0.33] },
  station: { grass: [0.34, 0.46, 0.3], rock: [0.48, 0.48, 0.47] },
  ruins: { grass: [0.26, 0.47, 0.22], rock: [0.5, 0.48, 0.4] },
  snow: { grass: [0.86, 0.9, 0.95], rock: [0.42, 0.44, 0.48] },
  strange: { grass: [0.24, 0.42, 0.47], rock: [0.3, 0.27, 0.4] },
  volcanic: { grass: [0.17, 0.15, 0.14], rock: [0.11, 0.1, 0.1] },
};
const _col = new THREE.Color();
function groundColor(h, slope, biome, x, z, out) {
  const n = noise2(x / 6, z / 6, 5), n2 = noise2(x / 31, z / 31, 9);
  if (h < 0.4) {
    // seabed: sand fading into deep blue so shallows glow turquoise through the water
    const f = smoothstep(0.4, -26, h);
    out.setRGB(lerp(0.86, 0.03, f), lerp(0.8, 0.2, Math.pow(f, 1.3)), lerp(0.6, 0.27, Math.pow(f, 1.6)));
    const d2 = smoothstep(-30, -120, h);
    out.multiplyScalar((0.9 + n * 0.2) * (1 - d2 * 0.6));
    return out;
  }
  const B = BIOME[biome] || BIOME.tropical;
  const sand = biome === 'volcanic' ? [0.2, 0.19, 0.2] : biome === 'snow' ? [0.72, 0.74, 0.76] : [0.88, 0.8, 0.58];
  const g = smoothstep(1.6, 3.4, h + n * 1.2);
  out.setRGB(lerp(sand[0], B.grass[0], g), lerp(sand[1], B.grass[1], g), lerp(sand[2], B.grass[2], g));
  const rk = smoothstep(0.55, 0.95, slope + n * 0.2) * g;
  out.lerp(_col.setRGB(B.rock[0], B.rock[1], B.rock[2]), rk);
  if (biome !== 'snow' && h > 70) out.lerp(_col.setRGB(0.5, 0.5, 0.5), smoothstep(70, 95, h));
  if (biome === 'volcanic') out.lerp(_col.setRGB(0.9, 0.25, 0.05), smoothstep(0.5, 1, n2) * 0.25);
  out.multiplyScalar(0.82 + n * 0.26 + n2 * 0.1);
  return out;
}

export const NODES = {
  palm: { name: 'Palm', mode: 'chop', hp: 55, r: 0.4, yield: { wood: [3, 5], fiber: [2, 4], coconut: [0, 2] }, hand: { coconut: [1, 1], fiber: [1, 2] }, handLabel: 'Shake palm' },
  tree: { name: 'Jungle Tree', mode: 'chop', hp: 85, r: 0.55, yield: { wood: [5, 8], fiber: [1, 3] } },
  pine: { name: 'Pine', mode: 'chop', hp: 70, r: 0.45, yield: { wood: [4, 7] } },
  bush: { name: 'Berry Bush', mode: 'hand', yield: { berries: [2, 4], fiber: [1, 2] } },
  mango: { name: 'Mango Shrub', mode: 'hand', yield: { mango: [1, 3] } },
  pebble: { name: 'Loose Stones', mode: 'hand', yield: { stone: [2, 3] } },
  sandp: { name: 'Fine Sand', mode: 'hand', yield: { sand: [2, 4] } },
  potato: { name: 'Wild Potato', mode: 'hand', yield: { seed: [1, 3] } },
  rock: { name: 'Boulder', mode: 'mine', hp: 60, r: 1.0, yield: { stone: [4, 7] }, slow: true },
  orev: { name: 'Iron Vein', mode: 'mine', hp: 80, r: 0.9, yield: { ore: [3, 5], stone: [1, 2] }, slow: true },
  tiv: { name: 'Titanium Vein', mode: 'mine', tier: 2, hp: 120, r: 0.9, yield: { ti_ore: [2, 4] }, slow: true },
  cryst: { name: 'Resonant Crystal', mode: 'mine', hp: 70, r: 0.5, yield: { crystal: [1, 2] }, slow: true },
  scrapp: { name: 'Scrap Heap', mode: 'hand', yield: { scrap: [2, 4], circuit: [0, 1] }, slow: true },
  clam: { name: 'Giant Clam', mode: 'hand', yield: { pearl: [0, 1], sand: [1, 2] } },
  weed: { name: 'Kelp', mode: 'hand', yield: { seaweed: [1, 2], fiber: [1, 2] } },
};

function rockGeo(seed, r = 1, detail = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 0.72 + 0.55 * noise2(x * 1.3 + seed * 3.1 + y, z * 1.3 + seed + y * 0.7, seed);
    p.setXYZ(i, x * k, y * k * 0.8, z * k);
  }
  g.computeVertexNormals();
  return g;
}
function palmGeos() {
  const tr = new THREE.CylinderGeometry(0.14, 0.26, 7, 6, 6); tr.translate(0, 3.5, 0);
  let p = tr.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 7; p.setX(i, p.getX(i) + y * y * 1.3); }
  tr.computeVertexNormals();
  const pos = [], uv = [], idx = [];
  for (let f = 0; f < 9; f++) {
    const a = (f / 9) * Math.PI * 2 + (f % 2) * 0.3, ca = Math.cos(a), sa = Math.sin(a), lift = 0.45 - (f % 3) * 0.22, L = 3.4;
    const base = pos.length / 3;
    for (let k = 0; k <= 5; k++) {
      const l = (k / 5) * L, w = 0.52 * Math.sin(Math.PI * ((k / 5) * 0.92 + 0.06));
      const cx = 1.3 + ca * l, cz = sa * l, cy = 7 + l * lift - l * l * 0.17;
      pos.push(cx - sa * w, cy - 0.12, cz + ca * w, cx, cy, cz, cx + sa * w, cy - 0.12, cz - ca * w);
      uv.push(0, k / 5, 0.5, k / 5, 1, k / 5);
      if (k < 5) { const b = base + k * 3; idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5); }
    }
  }
  const fr = new THREE.BufferGeometry();
  fr.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fr.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  fr.setIndex(idx); fr.computeVertexNormals();
  const nuts = mergeGeometries([0, 1, 2].map((i) => new THREE.SphereGeometry(0.16, 6, 5).translate(1.3 + Math.cos(i * 2.1) * 0.22, 6.75, Math.sin(i * 2.1) * 0.22)));
  return [[tr, mat('bark')], [fr, mat('leaf')], [nuts, colMat(0x5a4326)]];
}
function partsFor(type) {
  switch (type) {
    case 'palm': return palmGeos();
    case 'tree': {
      const tr = new THREE.CylinderGeometry(0.28, 0.45, 6, 6).translate(0, 3, 0);
      const can = mergeGeometries([[0, 6.8, 0, 2.7], [1.5, 5.6, 0.6, 2], [-1.2, 5.8, -1, 2.1], [0.2, 5.4, 1.6, 1.8]].map(([x, y, z, r], i) => rockGeo(i + 4, r, 0).translate(x, y, z)));
      return [[tr, mat('bark', { color: 0x9a8a78 })], [can, colMat(0x2f6f2a, { flatShading: true })]];
    }
    case 'pine': {
      const tr = new THREE.CylinderGeometry(0.16, 0.3, 3, 6).translate(0, 1.5, 0);
      const can = mergeGeometries([[2.2, 2.1, 3.4], [1.7, 1.9, 4.9], [1.1, 1.8, 6.3]].map(([r, h, y]) => new THREE.ConeGeometry(r, h * 1.4, 7).translate(0, y, 0)));
      return [[tr, mat('bark')], [can, colMat(0x2c5540, { flatShading: true })]];
    }
    case 'bush': return [[rockGeo(2, 0.8, 1).scale(1, 0.75, 1).translate(0, 0.4, 0), colMat(0x3f7a33, { flatShading: true })],
      [mergeGeometries([0, 1, 2, 3, 4, 5].map((i) => new THREE.SphereGeometry(0.07, 5, 4).translate(Math.cos(i * 1.1) * 0.62, 0.45 + (i % 3) * 0.18, Math.sin(i * 1.1) * 0.62))), colMat(0x5a3fb0)]];
    case 'mango': return [[rockGeo(5, 1.0, 1).scale(1, 0.9, 1).translate(0, 0.7, 0), colMat(0x5a8f2f, { flatShading: true })],
      [mergeGeometries([0, 1, 2, 3, 4].map((i) => new THREE.SphereGeometry(0.11, 6, 5).translate(Math.cos(i * 1.3) * 0.8, 0.55 + (i % 3) * 0.25, Math.sin(i * 1.3) * 0.8)), false), colMat(0xf0a020)]];
    case 'pebble': return [[mergeGeometries([[0, 0, 0.28], [0.4, 0.2, 0.2], [-0.3, 0.35, 0.22]].map(([x, z, r], i) => rockGeo(i + 9, r, 0).translate(x, r * 0.4, z))), mat('rock')]];
    case 'sandp': return [[new THREE.SphereGeometry(0.7, 8, 5).scale(1, 0.3, 1), colMat(0xf3ead0)]];
    case 'potato': return [[mergeGeometries([0, 1, 2].map((i) => new THREE.PlaneGeometry(0.7, 0.6).rotateY(i * 1.05).translate(0, 0.3, 0))), colMat(0x4f9a3a, { side: THREE.DoubleSide })]];
    case 'rock': return [[rockGeo(1, 1.2, 1).translate(0, 0.5, 0), mat('rock')]];
    case 'orev': return [[rockGeo(3, 1.1, 1).translate(0, 0.5, 0), mat('rock', { color: 0xc98a5c })]];
    case 'tiv': return [[rockGeo(6, 1.1, 1).translate(0, 0.5, 0), mat('rock', { color: 0xbfd4ee, metalness: 0.5, roughness: 0.5 })]];
    case 'cryst': return [[mergeGeometries([[0, 0, 0, 1.6], [0.35, 0.4, 0.1, 1.0], [-0.3, -0.35, -0.2, 1.2], [0.1, -0.2, 0.4, 0.8]].map(([x, rx, rz, h]) => new THREE.ConeGeometry(0.22, h, 5).translate(0, h / 2, 0).rotateX(rx).rotateZ(rz).translate(x, 0, 0))),
      new THREE.MeshStandardMaterial({ color: 0x7ff4ff, emissive: 0x2bbfe0, emissiveIntensity: 1.6, roughness: 0.2, flatShading: true })]];
    case 'scrapp': return [[mergeGeometries([[0, 0.15, 0, 0.9, 0.3, 0.6, 0.3], [0.3, 0.4, 0.1, 0.5, 0.25, 0.5, 1.1], [-0.3, 0.3, -0.2, 0.3, 0.6, 0.3, 0.6]].map(([x, y, z, w, h, d, r]) => new THREE.BoxGeometry(w, h, d).rotateY(r).translate(x, y, z))), mat('metal', { color: 0xb08a6a })]];
    case 'clam': return [[mergeGeometries([new THREE.SphereGeometry(0.5, 8, 5, 0, 6.3, 0, 1.5).scale(1, 0.5, 0.8), new THREE.SphereGeometry(0.5, 8, 5, 0, 6.3, 0, 1.5).scale(1, 0.5, 0.8).rotateX(2.4).translate(0, 0.15, -0.3)]), colMat(0xc9b0d8, { side: THREE.DoubleSide })]];
    case 'weed': return [[mergeGeometries([0, 1, 2].map((i) => new THREE.PlaneGeometry(0.5, 3.4, 1, 4).translate(0, 1.7, 0).rotateY(i * 1.05))), colMat(0x4a6a2a, { side: THREE.DoubleSide })]];
    case 'coral': return [[mergeGeometries([[0, 0, 0, 0.9], [0.3, 0.5, 0.2, 0.6], [-0.25, -0.4, 0.3, 0.7], [0.1, -0.3, -0.5, 0.5], [-0.2, 0.4, -0.4, 0.55]].map(([x, rx, rz, h]) => new THREE.CylinderGeometry(0.1, 0.05, h, 5).translate(0, h / 2, 0).rotateX(rx).rotateZ(rz).translate(x, 0, 0))), colMat(0xffffff, { flatShading: true })]];
    case 'coral2': return [[rockGeo(12, 0.7, 1).scale(1, 0.6, 1).translate(0, 0.2, 0), colMat(0xffffff, { flatShading: true })]];
    default: return [];
  }
}

const KEY = (x, z) => (Math.floor(x / 8) + 2048) * 4096 + (Math.floor(z / 8) + 2048);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class World {
  static ISL(id) { return ISLANDS.find((i) => i.id === id); }
  constructor(scene) {
    G.world = this;
    this.scene = scene;
    this.nodes = []; this.nodeGrid = new Map(); this.colGrid = new Map();
    this.interactables = []; this.markers = []; this.sharkSpots = []; this.pirateCamps = []; this.boarSpots = []; this.floaters = [];
    this.animated = []; this.platforms = []; this.fires = []; this.shelters = [];
    this.terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex('terrain'), roughness: 0.95, metalness: 0 });
    this.terrainMat.map.repeat.set(1, 1);
    for (const isl of ISLANDS) { isl.half = isl.r * 2.45; isl.flats = []; isl.group = new THREE.Group(); scene.add(isl.group); this.defineSites(isl); }
    for (const isl of ISLANDS) this.buildIsland(isl);
    this.buildDepthMap();
    this.buildSeabed();
    for (const isl of ISLANDS) { this.buildSites(isl); this.populate(isl); }
    this.buildOceanSites();
    this.finishInstances();
  }

  // ---------- registration helpers ----------
  addCollider(x, z, r) {
    const gy = terrainHeight(x, z);
    const c = { x, z, r, top: gy < -3 ? gy + 11 : 1e9 }; // underwater obstacles do not block swimmers far above
    for (let ix = Math.floor((x - r) / 8); ix <= Math.floor((x + r) / 8); ix++) for (let iz = Math.floor((z - r) / 8); iz <= Math.floor((z + r) / 8); iz++) {
      const k = (ix + 2048) * 4096 + iz + 2048; let l = this.colGrid.get(k); if (!l) this.colGrid.set(k, (l = [])); l.push(c);
    }
  }
  addInteract(o) { o.pos = o.pos || new THREE.Vector3(o.x, o.y, o.z); o.r = o.r || 2.6; this.interactables.push(o); return o; }
  addMarker(id, name, icon, x, z, hidden = true) { this.markers.push({ id, name, icon, x, z, hidden }); }
  reveal(id) { const m = this.markers.find((k) => k.id === id); if (m && !G.prog.revealed[id]) { G.prog.revealed[id] = 1; return m; } return null; }
  ground(x, z) { return terrainHeight(x, z); }

  // push a circle out of trunks/rocks/buildings; returns true if it touched something
  collide(pos, rad) {
    let hit = false;
    const cx = Math.floor(pos.x / 8), cz = Math.floor(pos.z / 8);
    for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iz = cz - 1; iz <= cz + 1; iz++) {
      const k = (ix + 2048) * 4096 + iz + 2048;
      const cl = this.colGrid.get(k);
      if (cl) for (const c of cl) if (pos.y < c.top) hit = push(pos, c.x, c.z, c.r + rad) || hit;
      const nl = this.nodeGrid.get(k);
      if (nl) for (const n of nl) if (!n.dead && n.def.r && Math.abs(pos.y - n.y) < 4) hit = push(pos, n.x, n.z, n.def.r * n.s + rad) || hit;
    }
    return hit;
  }
  nearestNode(pos, range, filter) {
    let best = null, bd = range * range;
    const cx = Math.floor(pos.x / 8), cz = Math.floor(pos.z / 8), rc = Math.ceil(range / 8);
    for (let ix = cx - rc; ix <= cx + rc; ix++) for (let iz = cz - rc; iz <= cz + rc; iz++) {
      const nl = this.nodeGrid.get((ix + 2048) * 4096 + iz + 2048); if (!nl) continue;
      for (const n of nl) {
        if (n.dead || (filter && !filter(n))) continue;
        const d = (n.x - pos.x) ** 2 + (n.z - pos.z) ** 2 + ((n.y - pos.y) * 0.5) ** 2;
        if (d < bd) { bd = d; best = n; }
      }
    }
    return best;
  }

  // ---------- island definition ----------
  defineSites(isl) {
    const P = (deg, f) => { const a = (deg * Math.PI) / 180; return { x: isl.x + Math.sin(a) * isl.r * f, z: isl.z + Math.cos(a) * isl.r * f }; };
    const flat = (deg, f, R, h, keep) => { const p = P(deg, f); const nat = islandRaw(isl, p.x, p.z); const s = { x: p.x, z: p.z, R, h: keep || !nat ? h : Math.max(3.2, nat.h) }; isl.flats.push(s); return s; }; // sites sit at the natural ground level so they do not carve pits
    const S = (isl.sites = {});
    switch (isl.id) {
      case 'cay': S.camp = flat(200, 0.35, 9, 4); break;
      case 'verdant': S.village = flat(120, 0.42, 22, 7); S.falls = flat(300, 0.3, 11, 14); S.cave = flat(30, 0.45, 9, 9); break;
      case 'ironback': S.mine = flat(250, 0.4, 9, 12); S.mast = flat(80, 0.4, 7, 9); break;
      case 'blackwater': S.fort = flat(270, 0.3, 30, 8); S.lookout = flat(100, 0.45, 7, 12); break;
      case 'meridian': S.station = flat(40, 0.3, 28, 7); S.dish = flat(200, 0.4, 9, 12); break;
      case 'crown': S.temple = flat(180, 0.2, 20, 8); S.dig = flat(330, 0.62, 6, 2.6, true); break;
      case 'frostfang': S.lab = flat(150, 0.45, 12, 14); S.camp = flat(170, 0.66, 7, 4); break;
      case 'mistveil': S.ring = flat(0, 0.05, 18, 9); break;
      case 'maw': S.shrine = flat(220, 0.5, 9, 10); break;
    }
  }

  buildIsland(isl) {
    const N = (isl.N = clamp(Math.round(isl.r * 0.6), 90, 150)), n1 = N + 1, size = isl.half * 2;
    const H = new Float32Array(n1 * n1), pos = new Float32Array(n1 * n1 * 3), col = new Float32Array(n1 * n1 * 3), uv = new Float32Array(n1 * n1 * 2);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = isl.x - isl.half + (i / N) * size, z = isl.z - isl.half + (j / N) * size;
      H[j * n1 + i] = analyticHeight(x, z);
    }
    isl.heights = H;
    const cell = size / N, c = new THREE.Color();
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const k = j * n1 + i, x = isl.x - isl.half + i * cell, z = isl.z - isl.half + j * cell, h = H[k];
      const hx = H[j * n1 + Math.min(N, i + 1)] - H[j * n1 + Math.max(0, i - 1)], hz = H[Math.min(N, j + 1) * n1 + i] - H[Math.max(0, j - 1) * n1 + i];
      const slope = Math.hypot(hx, hz) / (2 * cell);
      groundColor(h, slope, isl.biome, x, z, c);
      pos.set([x - isl.x, h, z - isl.z], k * 3); col.set([c.r, c.g, c.b], k * 3); uv.set([x / 3.5, z / 3.5], k * 2);
    }
    const idx = new Uint32Array(N * N * 6); let q = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * n1 + i, b = (j + 1) * n1 + i, cc = (j + 1) * n1 + i + 1, d = j * n1 + i + 1;
      idx[q++] = a; idx[q++] = b; idx[q++] = d; idx[q++] = b; idx[q++] = cc; idx[q++] = d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, this.terrainMat); m.position.set(isl.x, 0, isl.z); m.receiveShadow = true;
    this.scene.add(m); isl.mesh = m;
    isl.peakH = 0; for (let i = 0; i < H.length; i++) if (H[i] > isl.peakH) isl.peakH = H[i];
    this.addMarker(isl.id, isl.name, '🏝️', isl.x, isl.z);
  }

  // coarse world depth map: lets the ocean shader draw shallows and surf, and calms waves near shore
  buildDepthMap() {
    const N = (this.dmN = 1024), W = (this.dmW = 3800), d = new Float32Array(N * N).fill(-24), px = (W * 2) / N;
    for (const isl of ISLANDS) {
      const i0 = Math.max(0, Math.floor((isl.x - isl.half + W) / px)), i1 = Math.min(N - 1, Math.ceil((isl.x + isl.half + W) / px));
      const j0 = Math.max(0, Math.floor((isl.z - isl.half + W) / px)), j1 = Math.min(N - 1, Math.ceil((isl.z + isl.half + W) / px));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) d[j * N + i] = clamp(terrainHeight(-W + (i + 0.5) * px, -W + (j + 0.5) * px), -24, 8);
    }
    this.depth = d;
    const u8 = new Uint8Array(N * N); for (let i = 0; i < d.length; i++) u8[i] = Math.round(((d[i] + 24) / 32) * 255);
    this.depthTex = new THREE.DataTexture(u8, N, N, THREE.RedFormat, THREE.UnsignedByteType);
    this.depthTex.magFilter = this.depthTex.minFilter = THREE.LinearFilter; this.depthTex.needsUpdate = true;
  }
  depthAt(x, z) {
    const N = this.dmN, W = this.dmW, gx = ((x + W) / (W * 2)) * N - 0.5, gz = ((z + W) / (W * 2)) * N - 0.5;
    const ix = Math.floor(gx), iz = Math.floor(gz); if (ix < 0 || iz < 0 || ix >= N - 1 || iz >= N - 1) return -24;
    const fx = gx - ix, fz = gz - iz, D = this.depth, k = iz * N + ix;
    return (D[k] * (1 - fx) + D[k + 1] * fx) * (1 - fz) + (D[k + N] * (1 - fx) + D[k + N + 1] * fx) * fz;
  }
  buildSeabed() {
    const N = (this.sbN = 72), g = new THREE.PlaneGeometry(1, 1, N, N); g.rotateX(-Math.PI / 2);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array((N + 1) * (N + 1) * 3), 3));
    this.seabed = new THREE.Mesh(g, this.terrainMat); this.seabed.frustumCulled = false; this.seabed.receiveShadow = true;
    this.scene.add(this.seabed); this.sbCx = 1e9; this.sbCz = 1e9;
  }
  updateSeabed(px, pz) {
    const cell = 6, cx = Math.round(px / (cell * 4)) * cell * 4, cz = Math.round(pz / (cell * 4)) * cell * 4;
    if (cx === this.sbCx && cz === this.sbCz) return;
    this.sbCx = cx; this.sbCz = cz;
    const N = this.sbN, g = this.seabed.geometry, p = g.attributes.position, c = g.attributes.color, uv = g.attributes.uv, col = new THREE.Color();
    let k = 0;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++, k++) {
      const x = cx + (i - N / 2) * cell, z = cz + (j - N / 2) * cell;
      let h = seabedHeight(x, z);
      for (const isl of ISLANDS) if (Math.abs(x - isl.x) < isl.half && Math.abs(z - isl.z) < isl.half) { h -= 0.6; break; }
      p.setXYZ(k, x, h, z); groundColor(h, 0, 'tropical', x, z, col); c.setXYZ(k, col.r, col.g, col.b); uv.setXY(k, x / 3.5, z / 3.5);
    }
    p.needsUpdate = c.needsUpdate = uv.needsUpdate = true; g.computeVertexNormals();
  }

  // ---------- vegetation & resource nodes ----------
  addNode(type, x, z, s = 1, isl = null, y = null) {
    const def = NODES[type];
    const n = { id: this.nodes.length, type, def, x, z, y: y ?? terrainHeight(x, z), s, rot: (x * 12.9898 + z * 78.233) % 6.28, hp: def.hp || 1, dead: false, respawn: 0, isl };
    this.nodes.push(n);
    const k = KEY(x, z); let l = this.nodeGrid.get(k); if (!l) this.nodeGrid.set(k, (l = [])); l.push(n);
    const pk = (isl ? isl.id : 'sea') + '|' + type; (this.pending[pk] = this.pending[pk] || []).push(n);
    return n;
  }
  addDecor(type, x, y, z, s, color, isl) { const pk = (isl ? isl.id : 'sea') + '|' + type; (this.pendingDecor[pk] = this.pendingDecor[pk] || []).push({ x, y, z, s, color, rot: (x * 3.3 + z * 1.7) % 6.28 }); }
  get pending() { return this._pending || (this._pending = {}); }
  get pendingDecor() { return this._pd || (this._pd = {}); }

  populate(isl) {
    const rnd = mulberry32(isl.seed * 977 + 5), b = isl.biome;
    const tries = Math.floor((Math.PI * isl.r * isl.r) / 58);
    const clearOf = (x, z, pad) => { for (const f of isl.flats) if (Math.hypot(x - f.x, z - f.z) < f.R * pad) return false; return true; };
    for (let i = 0; i < tries; i++) {
      const a = rnd() * 6.283, d = Math.sqrt(rnd()) * isl.r * 1.2, x = isl.x + Math.sin(a) * d, z = isl.z + Math.cos(a) * d;
      const h = terrainHeight(x, z); if (h < 0.9) continue;
      if (!clearOf(x, z, 1.15)) continue;
      const slope = Math.hypot(terrainHeight(x + 2, z) - h, terrainHeight(x, z + 2) - h) / 2;
      const beach = h < 2.8, steep = slope > 0.7, r = rnd(), s = 0.8 + rnd() * 0.5;
      let t = null;
      const pickT = (tbl) => { let acc = 0; for (const [ty, p] of tbl) { acc += p; if (r < acc) return ty; } return null; };
      if (steep) t = pickT(b === 'rocky' || b === 'volcanic' ? [['rock', 0.06], ['orev', 0.05], ['tiv', b === 'volcanic' ? 0.02 : 0]] : b === 'snow' ? [['rock', 0.05], ['tiv', 0.035], ['orev', 0.02]] : [['rock', 0.05]]);
      else if (beach) t = pickT({ tropical: [['palm', 0.13], ['pebble', 0.05], ['sandp', 0.05]], jungle: [['palm', 0.1], ['pebble', 0.03], ['sandp', 0.03]], rocky: [['pebble', 0.07], ['sandp', 0.03], ['palm', 0.02], ['rock', 0.03]], pirate: [['palm', 0.12], ['pebble', 0.03], ['sandp', 0.03]], station: [['pebble', 0.05], ['sandp', 0.03], ['rock', 0.02]], ruins: [['palm', 0.1], ['pebble', 0.04], ['sandp', 0.04]], snow: [['pebble', 0.05], ['rock', 0.03]], strange: [['pebble', 0.04], ['cryst', 0.012], ['sandp', 0.03]], volcanic: [['pebble', 0.05], ['rock', 0.04], ['sandp', 0.02]] }[b]);
      else t = pickT({
        tropical: [['palm', 0.27], ['bush', 0.09], ['mango', 0.05], ['rock', 0.03], ['pebble', 0.02]],
        jungle: [['tree', 0.3], ['palm', 0.07], ['bush', 0.06], ['mango', 0.04], ['rock', 0.025], ['potato', 0.015]],
        rocky: [['rock', 0.1], ['orev', 0.05], ['bush', 0.03], ['tree', h < 30 ? 0.05 : 0], ['pebble', 0.03]],
        pirate: [['palm', 0.12], ['bush', 0.05], ['rock', 0.04], ['orev', 0.012], ['mango', 0.02]],
        station: [['pine', 0.1], ['bush', 0.05], ['rock', 0.05], ['scrapp', 0.008]],
        ruins: [['tree', 0.16], ['bush', 0.07], ['rock', 0.05], ['mango', 0.03], ['potato', 0.012]],
        snow: [['pine', h < 70 ? 0.16 : 0.03], ['rock', 0.06], ['tiv', h > 25 ? 0.022 : 0], ['orev', 0.02]],
        strange: [['cryst', 0.035], ['rock', 0.05], ['tree', 0.07], ['bush', 0.04]],
        volcanic: [['rock', 0.09], ['orev', 0.05], ['tiv', 0.025], ['cryst', 0.006]],
      }[b]);
      if (t) this.addNode(t, x, z, t === 'palm' ? 0.85 + rnd() * 0.45 : s, isl);
    }
    // reef ring
    const cols = [0xff6f61, 0xffb347, 0xf78fb3, 0x9b59b6, 0x4dd0e1, 0xfff176, 0xe57373];
    const rt = Math.floor(isl.r * (b === 'snow' ? 2 : 11));
    for (let i = 0; i < rt; i++) {
      const a = rnd() * 6.283, d = isl.r * (0.85 + rnd() * 0.85), x = isl.x + Math.sin(a) * d, z = isl.z + Math.cos(a) * d, h = terrainHeight(x, z);
      if (h > -2.2 || h < -17) continue;
      const tall = h < -4.6;
      const patch = noise2(x / 22, z / 22, isl.seed + 40); if (patch < 0.42) continue;
      const r = rnd();
      if (r < 0.62) this.addDecor(r < 0.4 ? 'coral' : 'coral2', x, h, z, 0.8 + rnd() * 1.3, cols[(rnd() * cols.length) | 0], isl);
      else if (r < 0.86 && tall) this.addNode('weed', x, z, 0.7 + rnd() * 0.8, isl);
      else if (r < 0.9) this.addNode('clam', x, z, 0.8 + rnd() * 0.4, isl);
    }
    if (b === 'jungle' || b === 'ruins') for (let i = 0; i < 5; i++) { const a = rnd() * 6.283, d = isl.r * (0.3 + rnd() * 0.3); this.boarSpots.push({ x: isl.x + Math.sin(a) * d, z: isl.z + Math.cos(a) * d }); }
  }

  finishInstances() {
    for (const [pk, list] of Object.entries(this.pending)) {
      const type = pk.split('|')[1], parts = partsFor(type), meshes = parts.map(([g, m]) => { const im = new THREE.InstancedMesh(g, m, list.length); im.castShadow = !['sandp', 'potato', 'weed', 'clam'].includes(type); im.receiveShadow = true; im.frustumCulled = false; this.scene.add(im); return im; });
      list.forEach((n, i) => { n.meshes = meshes; n.idx = i; this.setNodeMatrix(n); });
      meshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); m.frustumCulled = true; });
    }
    for (const [pk, list] of Object.entries(this.pendingDecor)) {
      const type = pk.split('|')[1], [[g, m]] = partsFor(type), im = new THREE.InstancedMesh(g, m, list.length), c = new THREE.Color();
      list.forEach((d, i) => { _m.compose(_p.set(d.x, d.y, d.z), _q.setFromEuler(_e.set(0, d.rot, 0)), _s.setScalar(d.s)); im.setMatrixAt(i, _m); im.setColorAt(i, c.set(d.color)); });
      im.computeBoundingSphere(); im.frustumCulled = true; im.receiveShadow = true; this.scene.add(im);
    }
    this._pending = null; this._pd = null;
  }
  setNodeMatrix(n) {
    if (n.dead) _m.copy(ZERO); else _m.compose(_p.set(n.x, n.y - 0.08, n.z), _q.setFromEuler(_e.set(0, n.rot, 0)), _s.setScalar(n.s));
    for (const m of n.meshes) { m.setMatrixAt(n.idx, _m); m.instanceMatrix.needsUpdate = true; }
  }
  killNode(n, time = 420) { n.dead = true; n.respawn = G.clock + (n.def.slow ? time * 1.8 : time); this.setNodeMatrix(n); }

  // ---------- structure builders ----------
  chest(g, id, x, z, ry, loot, o = {}) {
    const y = o.y ?? terrainHeight(x, z), c = new THREE.Group(); c.position.set(x, y, z); c.rotation.y = ry; g.add(c);
    mesh(boxG(0.95, 0.5, 0.6), o.metal ? 'metal' : 'wood', 0, 0.25, 0, c);
    const lid = new THREE.Group(); lid.position.set(0, 0.5, -0.3); c.add(lid);
    mesh(boxG(0.99, 0.16, 0.64), o.metal ? 'panel' : 'wood_dark', 0, 0.08, 0.3, lid); mesh(boxG(0.14, 0.2, 0.04), mat('gold'), 0, 0.02, 0.62, lid);
    const it = this.addInteract({ id, kind: 'chest', x, y: y + 0.4, z, r: o.r || 2.8, lid, loot, bp: o.bp, flag: o.flag, journal: o.journal, need: o.need, label: () => (o.label || 'Open chest') });
    if (!o.noCol) this.addCollider(x, z, 0.5);
    return it;
  }
  journal(g, id, x, z, o = {}) {
    const y = o.y ?? terrainHeight(x, z);
    const b = mesh(cylG(0.32, 0.36, 0.7, 8), 'wood_dark', x, y + 0.35, z, g);
    mesh(boxG(0.3, 0.05, 0.4), colMat(0xe8dcb8), x, y + 0.73, z, g).rotation.y = 0.5;
    this.addInteract({ id, kind: 'journal', x, y: y + 0.6, z, journal: id, label: () => 'Read journal' });
    this.addCollider(x, z, 0.4);
    return b;
  }
  hut(g, x, z, ry, ruined = false) {
    const y = terrainHeight(x, z), h = new THREE.Group(); h.position.set(x, y, z); h.rotation.y = ry; g.add(h);
    mesh(boxG(4.2, 0.25, 4.2), 'wood', 0, 0.55, 0, h);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(cylG(0.12, 0.14, 3.4, 6), 'wood_dark', sx * 1.9, 1.3, sz * 1.9, h);
    mesh(boxG(4, 2.2, 0.12), 'wood', 0, 1.75, -1.95, h); mesh(boxG(0.12, 2.2, 4), 'wood', -1.95, 1.75, 0, h);
    if (!ruined) mesh(boxG(0.12, 2.2, 4), 'wood', 1.95, 1.75, 0, h);
    const rf = mesh(coneG(3.6, 2.2, 4), 'thatch', 0, ruined ? 3.6 : 4, 0, h); rf.rotation.y = Math.PI / 4; if (ruined) rf.rotation.z = 0.25;
    this.addCollider(x, z, 2.5);
    return h;
  }
  campfire(g, x, z, lit = false) {
    const y = terrainHeight(x, z);
    for (let i = 0; i < 7; i++) mesh(sphG(0.16, 5, 4), 'rock', x + Math.cos(i * 0.9) * 0.55, y + 0.08, z + Math.sin(i * 0.9) * 0.55, g);
    for (let i = 0; i < 3; i++) { const l = mesh(cylG(0.06, 0.06, 0.8, 5), colMat(0x241a12), x, y + 0.14, z, g); l.rotation.set(Math.PI / 2, 0, i * 1.05); }
    if (lit) { const f = mesh(coneG(0.22, 0.6, 6), new THREE.MeshBasicMaterial({ color: 0xff8c2a }), x, y + 0.45, z, g, false); const l = new THREE.PointLight(0xff8a3a, 30, 22, 1.6); l.position.set(x, y + 1, z); g.add(l); this.animated.push((t) => { f.scale.y = 1 + Math.sin(t * 11) * 0.2; l.intensity = 26 + Math.sin(t * 13) * 6; }); }
    this.warmSpots = this.warmSpots || []; if (lit) this.warmSpots.push({ x, z });
  }
  pillar(g, x, z, h, broken) {
    const y = terrainHeight(x, z);
    mesh(cylG(0.5, 0.55, h, 10), 'stonebrick', x, y + h / 2 - 0.2, z, g); mesh(boxG(1.4, 0.35, 1.4), 'stonebrick', x, y + 0.1, z, g);
    if (!broken) mesh(boxG(1.3, 0.3, 1.3), 'stonebrick', x, y + h - 0.1, z, g);
    this.addCollider(x, z, 0.75);
  }
  module(g, x, z, ry, w = 8, d = 5) {
    const y = terrainHeight(x, z), m = new THREE.Group(); m.position.set(x, y, z); m.rotation.y = ry; g.add(m);
    mesh(boxG(w, 3, d), 'panel', 0, 1.9, 0, m); mesh(boxG(w + 0.3, 0.3, d + 0.3), 'metal', 0, 3.5, 0, m);
    for (let i = -1; i <= 1; i += 2) for (let j = -1; j <= 1; j += 2) mesh(cylG(0.14, 0.14, 0.6, 6), 'metal', (i * w) / 2.3, 0.2, (j * d) / 2.4, m);
    mesh(boxG(1.1, 2.1, 0.08), 'dark', 0, 1.5, d / 2 + 0.02, m);
    mesh(boxG(w * 0.5, 0.5, 0.06), new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x3aa8c8, emissiveIntensity: 0.5 }), w * 0.2, 2.4, -d / 2 - 0.02, m, false);
    const n = Math.max(1, Math.round(w / 3.5)), cs = Math.cos(ry), sn = Math.sin(ry);
    for (let i = 0; i < n; i++) { const lx = n === 1 ? 0 : lerp(-w / 2 + d / 2, w / 2 - d / 2, i / (n - 1)); this.addCollider(x + cs * lx, z - sn * lx, d / 2 + 0.2); }
    return m;
  }

  buildSites(isl) {
    const g = isl.group, S = isl.sites, th = terrainHeight;
    const J = (id, x, z) => this.journal(g, id, x, z);
    switch (isl.id) {
      case 'cay': {
        const c = S.camp, y = th(c.x, c.z);
        const tent = mesh(coneG(1.8, 2.2, 4), mat('cloth', { color: 0xc9b58a }), c.x - 3, y + 1.1, c.z + 1, g); tent.rotation.y = 0.6; this.addCollider(c.x - 3, c.z + 1, 1.4);
        this.campfire(g, c.x, c.z);
        this.chest(g, 'c_cay', c.x + 2.6, c.z - 1.5, 0.7, { rope: [3, 4], scrap: [3, 5], flask: 1, seed: 2, stone: [3, 5] });
        J('j_cay', c.x + 1, c.z + 3);
        this.addMarker('m_cay', 'Castaway Camp', '⛺', c.x, c.z);
        break;
      }
      case 'verdant': {
        const v = S.village;
        [[-8, -6, 0.3, false], [7, -8, -0.4, true], [9, 5, 2.4, false], [-7, 8, 1.2, true], [0, 13, 3.1, false]].forEach(([dx, dz, r, ru]) => this.hut(g, v.x + dx, v.z + dz, r, ru));
        const wy = th(v.x, v.z); mesh(cylG(1.1, 1.2, 0.9, 12), 'stonebrick', v.x, wy + 0.4, v.z, g); mesh(cylG(0.85, 0.85, 0.1, 12), colMat(0x1d4a5c), v.x, wy + 0.7, v.z, g, false); this.addCollider(v.x, v.z, 1.3);
        this.addInteract({ id: 'well', kind: 'water', x: v.x, y: wy + 1, z: v.z + 1.2, label: () => 'Drink from well' });
        this.chest(g, 'c_village', v.x + 9, v.z + 6.5, 2.4, { cloth: [3, 5], seed: [3, 4], arrow: [6, 10], rope: [2, 4], cooked_fish: 2 }, { noCol: true });
        J('j_village', v.x - 3, v.z - 3);
        for (let i = 0; i < 6; i++) this.addNode('potato', v.x + 14 + (i % 3) * 1.6, v.z - 4 + Math.floor(i / 3) * 1.6, 1, isl);
        this.addMarker('m_village', 'Abandoned Village', '🛖', v.x, v.z);
        this.buildFalls(isl, S.falls);
        // hidden cave: horseshoe of boulders
        const cv = S.cave;
        for (let i = 0; i < 9; i++) { const a = 0.9 + (i / 8) * 4.5, rx = cv.x + Math.cos(a) * 5, rz = cv.z + Math.sin(a) * 5; const s = 2.6 + (i % 3) * 0.7; mesh(geo('bigrock' + (i % 3), () => rockGeo(20 + (i % 3), 1, 1)), 'rock', rx, th(rx, rz) + s * 0.6, rz, g).scale.setScalar(s); this.addCollider(rx, rz, s * 0.85); }
        for (let i = 0; i < 4; i++) { const rx = cv.x + Math.cos(i * 1.7) * 2.5, rz = cv.z + Math.sin(i * 1.7) * 2.5; mesh(geo('bigrock1', () => rockGeo(21, 1, 1)), 'rock', rx, th(rx, rz) + 5.6, rz, g).scale.set(3.6, 1.5, 3.6); }
        this.chest(g, 'c_cave', cv.x - 1, cv.z + 0.5, 1.2, { gold: [8, 12], ingot: [3, 4], pearl: 2, arrow: 8 }, { bp: 'diving' });
        J('j_cave', cv.x + 1.5, cv.z - 1);
        this.addMarker('m_cave', 'Hidden Cave', '🕳️', cv.x, cv.z);
        break;
      }
      case 'ironback': {
        const m = S.mine, y = th(m.x, m.z);
        for (const sx of [-1, 1]) mesh(boxG(0.3, 2.8, 0.3), 'wood_dark', m.x + sx * 1.3, y + 1.4, m.z, g);
        mesh(boxG(3.2, 0.3, 0.3), 'wood_dark', m.x, y + 2.8, m.z, g);
        mesh(geo('bigrock0', () => rockGeo(20, 1, 1)), 'rock', m.x, y + 1.5, m.z - 3.5, g).scale.set(5, 4, 3.5); this.addCollider(m.x, m.z - 3.5, 3.4);
        mesh(boxG(2.4, 2.6, 0.1), colMat(0x050505), m.x, y + 1.3, m.z - 0.3, g, false);
        for (let i = 0; i < 5; i++) this.addNode('orev', m.x + Math.cos(i * 1.4 + 1) * 5.5, m.z + 2 + Math.sin(i * 1.4 + 1) * 3.5, 1, isl);
        this.chest(g, 'c_mine', m.x + 2.6, m.z + 1.2, -0.6, { ingot: [5, 7], circuit: 1, rope: 3, scrap: [4, 6] });
        J('j_mine', m.x - 2.6, m.z + 1.5);
        this.addMarker('m_mine', 'Old Mine', '⛏️', m.x, m.z);
        const t = S.mast, ty = th(t.x, t.z);
        const tw = mesh(cylG(0.12, 0.3, 16, 6), 'metal', t.x, ty + 5, t.z, g); tw.rotation.z = 0.9; tw.position.y = ty + 3;
        this.addNode('scrapp', t.x + 2, t.z + 1, 1, isl); this.addNode('scrapp', t.x - 1.5, t.z - 2, 1, isl); this.addNode('scrapp', t.x + 4, t.z - 2, 1, isl);
        break;
      }
      case 'blackwater': {
        const f = S.fort, R = 19, posts = [];
        for (let i = 0; i < 96; i++) { const a = (i / 96) * Math.PI * 2; if (a > 1.35 && a < 1.8) continue; posts.push([f.x + Math.cos(a) * R, f.z + Math.sin(a) * R]); }
        const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.34, 4.4, 5), mat('wood_dark'), posts.length);
        posts.forEach(([x, z], i) => { _m.compose(_p.set(x, th(x, z) + 2.1, z), _q.identity(), _s.set(1, 1, 1)); im.setMatrixAt(i, _m); this.addCollider(x, z, 0.7); });
        im.castShadow = true; im.frustumCulled = false; g.add(im);
        this.hut(g, f.x - 8, f.z - 7, 0.4); this.hut(g, f.x + 9, f.z - 5, -0.6); this.hut(g, f.x - 6, f.z + 9, 2.2);
        this.campfire(g, f.x, f.z, true);
        for (const [dx, dz] of [[-15, 12], [14, 12]]) { const x = f.x + dx, z = f.z + dz, y = th(x, z); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(cylG(0.14, 0.16, 7, 6), 'wood_dark', x + sx, y + 3.5, z + sz, g); mesh(boxG(3, 0.2, 3), 'wood', x, y + 6, z, g); mesh(coneG(2.6, 1.6, 4), 'thatch', x, y + 9, z, g).rotation.y = 0.78; this.addCollider(x, z, 1.5); }
        this.chest(g, 'c_fort', f.x + 3, f.z - 11, 0, { gold: [18, 24], scrap: 8, rope: 6, arrow: 12, cutlass: 1 }, { bp: 'harpoon', flag: 'treasure_map', label: "Open captain's chest" });
        J('j_fort', f.x - 3, f.z - 11);
        this.pirateCamps.push({ id: 'fort', x: f.x, z: f.z, r: 17, n: 6, captain: true });
        this.addMarker('m_fort', 'Pirate Stronghold', '☠️', f.x, f.z);
        const l = S.lookout; this.campfire(g, l.x, l.z, true); this.pirateCamps.push({ id: 'lookout', x: l.x, z: l.z, r: 5, n: 2 });
        this.chest(g, 'c_lookout', l.x + 2, l.z + 1.5, 1, { gold: [4, 7], arrow: 8, cooked_meat: 2 });
        break;
      }
      case 'meridian': {
        const s = S.station;
        this.module(g, s.x - 9, s.z - 6, 0.2, 10, 5); this.module(g, s.x + 8, s.z - 8, -0.5, 8, 5); this.module(g, s.x + 10, s.z + 7, 1.4, 8, 5); this.module(g, s.x - 8, s.z + 9, 2.9, 6, 5);
        const y = th(s.x, s.z);
        for (let i = 0; i < 4; i++) { const p = mesh(boxG(2.6, 0.08, 1.6), colMat(0x12234a, { metalness: 0.6, roughness: 0.25 }), s.x - 4 + i * 2.9, y + 1, s.z + 17, g); p.rotation.x = -0.5; mesh(cylG(0.06, 0.06, 1, 5), 'metal', s.x - 4 + i * 2.9, y + 0.5, s.z + 17, g); }
        // central console (terminal)
        mesh(boxG(1.6, 1.1, 0.7), 'panel', s.x, y + 0.55, s.z, g);
        const scr = mesh(boxG(1.3, 0.7, 0.06), new THREE.MeshStandardMaterial({ color: 0x64ffb4, emissive: 0x22cc77, emissiveIntensity: 1.3 }), s.x, y + 1.5, s.z - 0.2, g, false); scr.rotation.x = -0.25;
        this.addCollider(s.x, s.z, 1);
        this.addInteract({ id: 'console_meridian', kind: 'console', x: s.x, y: y + 1, z: s.z + 1, bp: 'engine', flag: 'key_a', journal: 'j_meridian_log', loot: { circuit: 2 }, label: () => 'Access station terminal' });
        this.chest(g, 'c_station1', s.x - 9, s.z - 2, 0.2, { circuit: [3, 4], glass: [3, 5], ingot: [3, 5], bandage: 2 }, { metal: true });
        this.chest(g, 'c_station2', s.x + 12, s.z + 3, 1.4, { circuit: [2, 3], titanium: 2, scrap: [6, 9], flask_full: 2 }, { metal: true });
        J('j_meridian', s.x + 5, s.z - 4);
        for (let i = 0; i < 4; i++) this.addNode('scrapp', s.x - 14 + i * 9, s.z + 14 - (i % 2) * 28, 1, isl);
        this.addMarker('m_station', 'Research Station', '🛰️', s.x, s.z);
        const d = S.dish, dy = th(d.x, d.z);
        mesh(cylG(0.5, 0.8, 4, 8), 'metal', d.x, dy + 2, d.z, g); const dish = mesh(geo('dish', () => new THREE.SphereGeometry(4, 16, 8, 0, 6.3, 0, 0.9)), mat('panel', { side: THREE.DoubleSide }), d.x, dy + 8.5, d.z, g); dish.rotation.x = Math.PI - 0.7; dish.position.y = dy + 8;
        this.addCollider(d.x, d.z, 1.2);
        J('j_dish', d.x + 2.5, d.z + 1);
        break;
      }
      case 'crown': {
        const t = S.temple;
        for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; this.pillar(g, t.x + Math.cos(a) * 13, t.z + Math.sin(a) * 13, i % 4 === 1 ? 2.2 : 5.5, i % 4 === 1); }
        for (let i = 0; i < 12; i += 3) { const a = ((i + 0.5) / 12) * 6.283; const lt = mesh(boxG(7.4, 0.6, 1.2), 'stonebrick', t.x + Math.cos(a) * 13, th(t.x, t.z) + 5.6, t.z + Math.sin(a) * 13, g); lt.rotation.y = -a + Math.PI / 2; }
        const y = th(t.x, t.z);
        mesh(boxG(5, 0.5, 5), 'stonebrick', t.x, y + 0.2, t.z, g); mesh(boxG(2, 1.1, 1.2), 'stonebrick', t.x, y + 1, t.z, g);
        const cr = mesh(coneG(0.3, 1.1, 5), new THREE.MeshStandardMaterial({ color: 0x7ff4ff, emissive: 0x2bbfe0, emissiveIntensity: 2 }), t.x, y + 2.1, t.z, g, false);
        this.animated.push((tt) => { cr.rotation.y = tt; cr.position.y = y + 2.1 + Math.sin(tt * 1.3) * 0.12; });
        this.addCollider(t.x, t.z, 1.5);
        this.addInteract({ id: 'altar', kind: 'console', x: t.x, y: y + 1.2, z: t.z + 1.6, loot: { crystal: 2 }, journal: 'j_altar', label: () => 'Examine altar' });
        this.addMarker('m_temple', 'Ancient Ruins', '🏛️', t.x, t.z);
        const d = S.dig, dy = th(d.x, d.z);
        const xm = new THREE.Group(); xm.position.set(d.x, dy + 0.06, d.z); g.add(xm);
        for (const r of [0.78, -0.78]) { const b = mesh(boxG(2.2, 0.05, 0.35), colMat(0x7a1c12), 0, 0, 0, xm, false); b.rotation.y = r; }
        this.addInteract({ id: 'buried', kind: 'dig', x: d.x, y: dy + 0.5, z: d.z, xm, need: 'treasure_map', loot: { gold: [28, 36], pearl: 4, titanium: 4, crystal: 1 }, label: () => 'Dig up buried treasure' });
        this.addMarker('m_dig', 'Buried Treasure', '❌', d.x, d.z);
        break;
      }
      case 'frostfang': {
        const l = S.lab, y = th(l.x, l.z);
        this.module(g, l.x - 6, l.z - 3, 0.3, 6, 4.5);
        mesh(cylG(1.5, 1.7, 0.4, 12), 'metal', l.x + 3, y + 0.2, l.z + 2, g); mesh(cylG(1.1, 1.1, 0.12, 12), mat('panel'), l.x + 3, y + 0.45, l.z + 2, g);
        mesh(boxG(0.2, 0.2, 1.4), colMat(0xd03020), l.x + 3, y + 0.55, l.z + 2, g, false);
        this.addInteract({ id: 'hatch', kind: 'console', x: l.x + 3, y: y + 0.8, z: l.z + 2, r: 3, bp: 'deep', flag: 'key_b', journal: 'j_lab', loot: { circuit: 3, titanium: 3, glass: 2 }, label: () => 'Open laboratory hatch' });
        const mt = mesh(cylG(0.08, 0.2, 12, 5), 'metal', l.x - 2, y + 6, l.z + 6, g); const beacon = mesh(sphG(0.2, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff2a1a }), l.x - 2, y + 12.2, l.z + 6, g, false);
        this.animated.push((t) => { beacon.visible = (t % 2) < 1; });
        this.addMarker('m_lab', 'Hidden Laboratory', '🧪', l.x, l.z);
        const c = S.camp; this.campfire(g, c.x, c.z, true);
        this.chest(g, 'c_frost', c.x + 2, c.z + 1, 0.4, { coat: 1, cooked_meat: 3, wood: [8, 12], bandage: 2 });
        J('j_frost', c.x - 2, c.z + 1.5);
        break;
      }
      case 'mistveil': {
        const r = S.ring, y = th(r.x, r.z), em = new THREE.MeshStandardMaterial({ color: 0x1a1f2e, emissive: 0x4a2bd8, emissiveIntensity: 0.9, roughness: 0.3 });
        for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.283, x = r.x + Math.cos(a) * 12, z = r.z + Math.sin(a) * 12; const mo = mesh(boxG(1.4, 7 + (i % 3) * 1.5, 0.8), em, x, th(x, z) + 3.2, z, g); mo.rotation.y = -a; this.addCollider(x, z, 1); }
        const orb = mesh(sphG(0.8, 14, 10), new THREE.MeshStandardMaterial({ color: 0xb9a8ff, emissive: 0x7a55ff, emissiveIntensity: 2.5 }), r.x, y + 3, r.z, g, false);
        const pl = new THREE.PointLight(0x8866ff, 60, 50, 1.6); pl.position.set(r.x, y + 3, r.z); g.add(pl);
        this.animated.push((t) => { orb.position.y = y + 3 + Math.sin(t * 0.8) * 0.5; em.emissiveIntensity = 0.7 + Math.sin(t * 1.7) * 0.4; });
        this.chest(g, 'c_mist', r.x + 3, r.z - 2, 0.9, { crystal: [3, 4], titanium: 3, gold: 6 }, { bp: 'fortress', metal: true });
        J('j_mist', r.x - 3, r.z + 2);
        this.addMarker('m_ring', 'The Listening Stones', '🗿', r.x, r.z);
        break;
      }
      case 'maw': {
        const lavaY = th(isl.x, isl.z) + 1.2;
        const lava = mesh(geo('lava', () => new THREE.CircleGeometry(isl.r * 0.16, 24).rotateX(-Math.PI / 2)), new THREE.MeshBasicMaterial({ color: 0xff5a14 }), isl.x, lavaY, isl.z, g, false);
        const ll = new THREE.PointLight(0xff5a1a, 900, 260, 1.4); ll.position.set(isl.x, lavaY + 12, isl.z); g.add(ll);
        this.animated.push((t) => { lava.material.color.setRGB(1, 0.3 + Math.sin(t * 0.9) * 0.08, 0.06); });
        this.lava = { x: isl.x, z: isl.z, r: isl.r * 0.16, y: lavaY };
        const s = S.shrine;
        for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283; this.pillar(g, s.x + Math.cos(a) * 6, s.z + Math.sin(a) * 6, 4, i === 2); }
        this.chest(g, 'c_maw', s.x, s.z, 0, { titanium: [5, 7], crystal: 3, gold: [10, 15], circuit: 3 }, { metal: true });
        J('j_maw', s.x + 2.5, s.z + 1);
        this.addMarker('m_maw', 'Ashen Shrine', '🌋', s.x, s.z);
        break;
      }
    }
  }

  buildFalls(isl, f) {
    const g = isl.group, th = terrainHeight, y = th(f.x, f.z);
    // cliff stack behind the pool (towards island centre)
    const dx = isl.x - f.x, dz = isl.z - f.z, dl = Math.hypot(dx, dz), ux = dx / dl, uz = dz / dl;
    const cx = f.x + ux * 9, cz = f.z + uz * 9, H = 17;
    for (let i = 0; i < 7; i++) { const off = (i - 3) * 3.2, x = cx - uz * off + ux * Math.abs(off) * 0.25, z = cz + ux * off + uz * Math.abs(off) * 0.25; const s = 5.5 - Math.abs(i - 3) * 0.7; const r = mesh(geo('bigrock' + (i % 3), () => rockGeo(20 + (i % 3), 1, 1)), 'rock', x, y + H * 0.42, z, g); r.scale.set(s, H * 0.62, s); this.addCollider(x, z, s * 0.8); }
    const wt = tex('waternoise').clone(); wt.needsUpdate = true; wt.repeat.set(1, 3);
    const wm = new THREE.MeshStandardMaterial({ color: 0xcfefff, map: wt, transparent: true, opacity: 0.85, emissive: 0x6fb4d8, emissiveIntensity: 0.25, roughness: 0.2, side: THREE.DoubleSide });
    const fall = mesh(geo('fallp', () => new THREE.PlaneGeometry(3.4, H)), wm, cx - ux * 4.6, y + H / 2, cz - uz * 4.6, g, false);
    fall.rotation.y = Math.atan2(-ux, -uz);
    const pool = mesh(geo('pool', () => new THREE.CircleGeometry(7, 20).rotateX(-Math.PI / 2)), new THREE.MeshStandardMaterial({ color: 0x2f8fa8, transparent: true, opacity: 0.8, roughness: 0.1 }), f.x, y + 0.18, f.z, g, false);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; mesh(geo('bigrock2', () => rockGeo(22, 1, 1)), 'rock', f.x + Math.cos(a) * 7.4, y + 0.2, f.z + Math.sin(a) * 7.4, g).scale.setScalar(0.8 + (i % 3) * 0.3); }
    // river ribbon following the slope down to the sea
    const pts = []; let x = f.x - ux * 7, z = f.z - uz * 7;
    for (let i = 0; i < 160; i++) {
      const h = th(x, z); pts.push([x, h, z]); if (h < 0.2) break;
      let gx = th(x + 2, z) - th(x - 2, z), gz = th(x, z + 2) - th(x, z - 2); const gl = Math.hypot(gx, gz);
      if (gl < 0.02) { gx = -ux; gz = -uz; } else { gx = -gx / gl * 0.7 - ux * 0.3; gz = -gz / gl * 0.7 - uz * 0.3; }
      const l2 = Math.hypot(gx, gz); x += (gx / l2) * 3; z += (gz / l2) * 3;
    }
    if (pts.length > 2) {
      const pos = [], uv = [], idx = [];
      pts.forEach(([px, py, pz], i) => {
        const [nx, , nz] = pts[Math.min(pts.length - 1, i + 1)], [qx, , qz] = pts[Math.max(0, i - 1)];
        let tx = nx - qx, tz = nz - qz; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const hl = Math.max(th(px - tz * 1.6, pz + tx * 1.6), py), hr = Math.max(th(px + tz * 1.6, pz - tx * 1.6), py);
        pos.push(px - tz * 1.6, hl + 0.14, pz + tx * 1.6, px + tz * 1.6, hr + 0.14, pz - tx * 1.6); uv.push(0, i * 0.4, 1, i * 0.4);
        if (i < pts.length - 1) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
      });
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); rg.setIndex(idx); rg.computeVertexNormals();
      const rt = tex('waternoise').clone(); rt.needsUpdate = true;
      const rm = new THREE.MeshStandardMaterial({ color: 0x4aa8c0, map: rt, transparent: true, opacity: 0.75, roughness: 0.15 });
      const rv = new THREE.Mesh(rg, rm); rv.receiveShadow = true; g.add(rv);
      this.animated.push((t) => { rt.offset.y = -t * 0.5; });
    }
    this.animated.push((t) => { wt.offset.y = t * 1.4; });
    this.addInteract({ id: 'pool', kind: 'water', x: f.x - ux * 5, y: y + 0.8, z: f.z - uz * 5, r: 5, label: () => 'Drink fresh water' });
    this.falls = { x: f.x, z: f.z };
    this.addMarker('m_falls', 'Verdant Falls', '💦', f.x, f.z);
  }

  // ---------- ocean sites ----------
  buildOceanSites() {
    const g = new THREE.Group(); this.scene.add(g); this.oceanGroup = g;
    const wreck = (id, x, z, size, loot, o = {}) => {
      const y = terrainHeight(x, z), w = new THREE.Group(); w.position.set(x, y + 1.4 * size, z); w.rotation.set(0.12, x * 0.01, 0.5 + (x % 3) * 0.1); g.add(w);
      const S = [null, { len: 17, beam: 5.4, depth: 3.2 }, { len: 26, beam: 7.5, depth: 4.2 }][size];
      mesh(hullGeometry(S.len, S.beam, S.depth), mat('wood_dark', { side: THREE.DoubleSide, color: 0x7d8f7a }), 0, 0, 0, w);
      const ms = mesh(cylG(0.2, 0.3, S.len * 0.7, 6), mat('wood_dark', { color: 0x7d8f7a }), 2, 2, 1, w); ms.rotation.set(1.2, 0, 0.4);
      const ms2 = mesh(cylG(0.2, 0.28, 6, 6), mat('wood_dark', { color: 0x7d8f7a }), 0, 3.5, -S.len * 0.2, w); ms2.rotation.z = -0.2;
      this.addCollider(x, z, S.beam * 0.45);
      const cx = x + S.beam * 0.9, cz = z + 2;
      this.chest(g, id, cx, cz, 0.4, loot, { label: 'Open sunken chest', bp: o.bp, journal: o.journal, r: 3.2 });
      for (let i = 0; i < 3; i++) this.addNode('scrapp', x + Math.cos(i * 2.1 + 1) * (S.beam + 2), z + Math.sin(i * 2.1 + 1) * (S.len * 0.4), 1.2);
      this.addMarker(id, o.name || 'Shipwreck', '⚓', x, z);
      this.sharkSpots.push({ x, z, y: y + 5, kind: o.shark || 'tiger' });
    };
    wreck('w1', -260, 400, 1, { scrap: [5, 8], ingot: [2, 3], gold: [3, 5], rope: 4 }, { shark: 'reef', journal: 'j_w1' });
    wreck('w2', 640, -40, 1, { scrap: [6, 9], circuit: 1, gold: [4, 7], glass: 2 }, { shark: 'reef' });
    wreck('w3', -1150, 150, 2, { ingot: [5, 7], circuit: [2, 3], gold: [8, 12], pearl: 2 });
    wreck('w4', 1320, -340, 2, { ingot: [4, 6], gold: [10, 14], titanium: 2, arrow: 12 }, { name: "Wreck of the 'Gull'", journal: 'j_w4' });
    wreck('w5', -350, 1250, 1, { scrap: 8, circuit: 2, gold: [5, 8], pearl: 1 });
    wreck('w6', 1900, 480, 2, { titanium: [3, 4], circuit: [3, 4], gold: [12, 16], crystal: 1 });
    // sunken cargo vessel
    {
      const x = 1180, z = -1380, y = terrainHeight(x, z), w = new THREE.Group(); w.position.set(x, y + 3, z); w.rotation.set(0.05, 0.7, 0.28); g.add(w);
      mesh(hullGeometry(52, 12, 8, 0.3), mat('metal', { side: THREE.DoubleSide, color: 0x8a6a52 }), 0, 0, 0, w);
      mesh(boxG(8, 8, 7), mat('panel', { color: 0xa8a090 }), 0, 6, -18, w);
      const cc = [0xb23a2a, 0x2a6ab2, 0x3a8a4a, 0xc9a02a];
      for (let i = 0; i < 8; i++) mesh(boxG(2.6, 2.6, 6), colMat(cc[i % 4], { metalness: 0.4 }), -3 + (i % 2) * 6, 4.2 + (i > 5 ? 2.6 : 0), -6 + Math.floor(i / 2) * 6.6, w);
      this.addCollider(x, z, 6);
      this.chest(g, 'cargo', x + 10, z + 4, 0.2, { circuit: [5, 6], titanium: [3, 4], ingot: [7, 9], glass: 4 }, { metal: true, label: 'Open cargo locker', journal: 'j_cargo', r: 3.2 });
      for (let i = 0; i < 5; i++) this.addNode('scrapp', x + Math.cos(i * 1.3) * 13, z + Math.sin(i * 1.3) * 13, 1.3);
      this.addMarker('cargo', "Cargo Vessel 'Halden'", '🚢', x, z);
      this.sharkSpots.push({ x, z, y: y + 8, kind: 'tiger' }, { x: x + 20, z: z - 10, y: y + 10, kind: 'tiger' });
    }
    // underwater cave off Verdant Reach
    {
      const v = ISLANDS[1], a = 3.9; let d = v.r * 1.05, x, z, y;
      do { d += 6; x = v.x + Math.sin(a) * d; z = v.z + Math.cos(a) * d; y = terrainHeight(x, z); } while (y > -13 && d < v.r * 2);
      for (let i = 0; i < 8; i++) { const an = 0.6 + (i / 7) * 5, rx = x + Math.cos(an) * 5.5, rz = z + Math.sin(an) * 5.5; mesh(geo('bigrock' + (i % 3), () => rockGeo(20 + (i % 3), 1, 1)), 'rock', rx, terrainHeight(rx, rz) + 2, rz, g).scale.setScalar(3.4); this.addCollider(rx, rz, 2.6); }
      mesh(geo('bigrock1', () => rockGeo(21, 1, 1)), 'rock', x, y + 6.5, z, g).scale.set(8, 2, 8);
      this.chest(g, 'uwcave', x, z, 1, { pearl: [4, 5], gold: [6, 9], crystal: 1 }, { label: 'Open barnacled chest', r: 3 });
      for (let i = 0; i < 4; i++) this.addNode('clam', x + Math.cos(i * 1.6) * 3, z + Math.sin(i * 1.6) * 3, 1);
      this.addMarker('uwcave', 'Underwater Cave', '🫧', x, z);
    }
    // drowned ruins off Sunken Crown
    {
      const c = ISLANDS[5], a = 1.3; let d = c.r * 1.05, x, z, y;
      do { d += 6; x = c.x + Math.sin(a) * d; z = c.z + Math.cos(a) * d; y = terrainHeight(x, z); } while (y > -16 && d < c.r * 2);
      for (let i = 0; i < 10; i++) { const px = x + ((i % 5) - 2) * 5, pz = z + (i < 5 ? -4 : 4); this.pillar(g, px, pz, i % 3 === 0 ? 2.5 : 6, i % 3 === 0); }
      mesh(boxG(22, 0.6, 1.4), 'stonebrick', x, terrainHeight(x, z - 4) + 6.1, z - 4, g);
      this.chest(g, 'uwruins', x, z, 0, { crystal: [3, 4], gold: [10, 14], pearl: 2 }, { label: 'Open relic coffer', journal: 'j_uwruins', r: 3 });
      this.addMarker('uwruins', 'Drowned Ruins', '🏛️', x, z);
      this.sharkSpots.push({ x, z, y: y + 6, kind: 'tiger' });
    }
    // trench vault
    {
      const x = (TRENCH.ax + TRENCH.bx) / 2, z = (TRENCH.az + TRENCH.bz) / 2, y = terrainHeight(x, z);
      mesh(geo('vault', () => new THREE.SphereGeometry(7, 16, 8, 0, 6.3, 0, 1.57)), mat('metal', { color: 0x6f7f8a }), x, y, z, g);
      const ring = mesh(geo('vring', () => new THREE.TorusGeometry(7.4, 0.25, 6, 28).rotateX(Math.PI / 2)), new THREE.MeshStandardMaterial({ color: 0x35e0ff, emissive: 0x35e0ff, emissiveIntensity: 2.5 }), x, y + 0.6, z, g, false);
      const pl = new THREE.PointLight(0x35e0ff, 300, 70, 1.5); pl.position.set(x, y + 9, z); g.add(pl);
      this.addCollider(x, z, 7);
      this.addInteract({ id: 'vault', kind: 'console', x: x + 8.2, y: y + 1.2, z, r: 3.5, flag: 'key_c', journal: 'j_vault', loot: { crystal: 4, titanium: 8, pearl: 4 }, label: () => 'Open pressure vault' });
      for (let i = 0; i < 10; i++) { const nx = x + Math.cos(i * 0.9) * (14 + (i % 3) * 9), nz = z + Math.sin(i * 0.9) * (14 + (i % 3) * 9); this.addNode(i % 2 ? 'cryst' : 'tiv', nx, nz, 1.3); }
      this.addMarker('vault', 'Trench Vault', '🔒', x, z);
      this.vault = { x, y, z };
    }
    // drifting abandoned boats
    const boat = (id, x, z, loot, o = {}) => {
      const s = makeShip(0, { mast: o.mast }); s.group.position.set(x, 0, z); s.group.rotation.y = x * 0.013; g.add(s.group);
      this.floaters.push({ g: s.group, x, z, roll: 0.12 });
      this.addInteract({ id, kind: 'chest', x, y: 0.6, z, r: 4.2, loot, bp: o.bp, journal: o.journal, label: () => 'Search abandoned boat' });
      this.addMarker(id, 'Abandoned Boat', '🛶', x, z);
    };
    boat('boat1', -150, 95, { rope: [3, 4], scrap: [4, 5], wood: [6, 8], flask_full: 1, coconut: 2 }, { bp: 'radio', journal: 'j_boat1', mast: true });
    boat('boat2', 760, -620, { cloth: [3, 4], rope: 4, cooked_fish: 2, scrap: 5, arrow: 6 }, {});
    boat('boat3', -1380, -1200, { ingot: 3, circuit: 1, bandage: 2, glass: 2 }, { mast: true });
    boat('boat4', 1500, 1250, { titanium: 2, gold: [5, 8], circuit: 2 }, { journal: 'j_boat4' });
    // the Array Core: a floating research platform far to the north-east
    {
      const x = 2850, z = -2650, p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
      mesh(cylG(13, 13, 0.6, 6), 'metal', 0, 2.2, 0, p); mesh(cylG(12.4, 12.4, 0.1, 6), mat('panel'), 0, 2.52, 0, p);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 + 0.52; mesh(cylG(1.6, 1.6, 4.5, 10), colMat(0xc9a02a, { metalness: 0.3 }), Math.cos(a) * 10.5, 0, Math.sin(a) * 10.5, p); }
      mesh(cylG(2.2, 3, 9, 8), 'panel', 0, 7, 0, p); mesh(cylG(0.3, 0.3, 14, 6), 'metal', 0, 18, 0, p);
      const core = mesh(sphG(1.6, 16, 12), new THREE.MeshStandardMaterial({ color: 0x9ff8ff, emissive: 0x35e0ff, emissiveIntensity: 1.2 }), 0, 13.5, 0, p, false);
      const cl = new THREE.PointLight(0x35e0ff, 50, 120, 1.5); cl.position.set(0, 14, 0); p.add(cl);
      for (let r = 0; r < 7; r++) mesh(boxG(1, 0.08, 0.1), 'metal', 0, 2.3 - r * 0.4, 13.1, p, false);
      this.animated.push((t) => { const on = G.prog && G.prog.flags.ending; core.material.emissiveIntensity = (on ? 4 : 1.2) + Math.sin(t * (on ? 5 : 1.2)) * 0.5; cl.intensity = on ? 140 : 50; core.rotation.y = t * 0.4; });
      const plat = {
        group: p, fixed: true, name: 'core', vel: new THREE.Vector3(),
        surfaceAt(lx, lz, ly) { const d = Math.hypot(lx, lz); if (d < 11.6 && d > 3.2 && ly > 1.6) return 2.58; return null; },
        blocked(lx, lz) { return Math.hypot(lx, lz) < 3.4; },
        climb(lx, lz) { const d = Math.hypot(lx, lz); if (d < 15.5 && d > 10) { const k = 10.2 / d; return new THREE.Vector3(lx * k, 2.58, lz * k); } return null; },
      };
      p.updateMatrixWorld(true); this.platforms.push(plat); this.core = plat;
      this.addInteract({ id: 'core', kind: 'core', x, y: 3.6, z: z + 4.2, r: 3.2, label: () => 'Access the Array Core' });
      this.addInteract({ id: 'j_core', kind: 'journal', x: x + 5, y: 3.4, z: z - 5, journal: 'j_core', label: () => 'Read final log' });
      mesh(boxG(0.4, 0.06, 0.5), colMat(0xe8dcb8), 5, 2.62, -5, p, false);
      this.addMarker('core', 'The Array Core', '📡', x, z);
    }
  }

  // ---------- player-built camps on land ----------
  addCamp(c, fresh) {
    const g = this.oceanGroup, y = terrainHeight(c.x, c.z);
    if (fresh) G.prog.camps.push(c);
    if (c.t === 'campfire') {
      for (let i = 0; i < 7; i++) mesh(sphG(0.16, 5, 4), 'rock', c.x + Math.cos(i * 0.9) * 0.55, y + 0.08, c.z + Math.sin(i * 0.9) * 0.55, g);
      for (let i = 0; i < 3; i++) { const l = mesh(cylG(0.06, 0.06, 0.8, 5), colMat(0x241a12), c.x, y + 0.14, c.z, g); l.rotation.set(Math.PI / 2, 0, i * 1.05); }
      const f = mesh(coneG(0.22, 0.6, 6), new THREE.MeshBasicMaterial({ color: 0xff8c2a }), c.x, y + 0.45, c.z, g, false);
      const l = new THREE.PointLight(0xff8a3a, 26, 20, 1.6); l.position.set(c.x, y + 1, c.z); g.add(l);
      this.animated.push((t) => { f.scale.y = 1 + Math.sin(t * 11 + c.x) * 0.2; });
      (this.warmSpots = this.warmSpots || []).push({ x: c.x, z: c.z });
      const fire = { cook: c.cook || (c.cook = []) }; this.fires.push(fire);
      this.addInteract({ id: 'camp' + this.interactables.length, kind: 'camp', x: c.x, y: y + 0.6, z: c.z, r: 2.6, label: () => G.player.cookLabel(fire, 'Campfire'), use: () => G.player.cookAt(fire) });
      this.addCollider(c.x, c.z, 0.5);
    } else {
      const s = new THREE.Group(); s.position.set(c.x, y, c.z); s.rotation.y = c.r; g.add(s);
      const rf = mesh(boxG(2.6, 0.08, 2.9), 'thatch', 0, 1.05, -0.55, s); rf.rotation.x = 0.75;
      for (const sx of [-1.25, 1.25]) { mesh(cylG(0.05, 0.06, 2.1, 5), 'wood_dark', sx, 1.0, 0.4, s); const b = mesh(cylG(0.05, 0.05, 2.9, 5), 'wood_dark', sx, 1.0, -0.5, s); b.rotation.x = 0.75 + Math.PI / 2; }
      mesh(cylG(0.05, 0.05, 2.6, 5), 'wood_dark', 0, 2.0, 0.42, s).rotation.z = Math.PI / 2;
      mesh(boxG(1.9, 0.1, 0.8), 'leaf', 0, 0.06, -0.3, s);
      this.shelters.push({ x: c.x, z: c.z });
      this.addInteract({ id: 'camp' + this.interactables.length, kind: 'camp', x: c.x, y: y + 0.7, z: c.z, r: 2.6, label: () => 'Sleep in lean-to', use: () => G.player.sleepAt() });
    }
  }
  loadCamps() { if (this.campsLoaded) return; this.campsLoaded = true; for (const c of G.prog.camps) this.addCamp(c, false); }

  // ---------- per-frame ----------
  update(dt) {
    const p = G.player.pos;
    this.updateSeabed(p.x, p.z);
    const t = G.clock;
    for (const fn of this.animated) fn(t);
    for (const f of this.fires) for (const c of f.cook) if (c.t > 0) { c.t -= dt; if (c.t <= 0) { c.id = ITEMS[c.id].cook; c.done = true; G.audio.sfx('sizzle'); } }
    for (const f of this.floaters) {
      const h = waveHeight(f.x, f.z);
      f.g.position.y = h - 0.1; f.g.rotation.z = Math.sin(t * 0.8 + f.x) * f.roll; f.g.rotation.x = Math.cos(t * 0.6 + f.z) * f.roll * 0.6;
    }
    // respawn a few nodes per frame
    this._ri = ((this._ri || 0) + 40) % this.nodes.length;
    for (let i = 0; i < 40; i++) { const n = this.nodes[(this._ri + i) % this.nodes.length]; if (n.dead && t > n.respawn && Math.hypot(n.x - p.x, n.z - p.z) > 40) { n.dead = false; n.hp = n.def.hp || 1; n.picked = false; this.setNodeMatrix(n); } }
    // discovery
    this._dt = (this._dt || 0) + dt;
    if (this._dt > 0.5) {
      this._dt = 0;
      for (const isl of ISLANDS) if (!G.prog.revealed[isl.id + '_v'] && Math.hypot(p.x - isl.x, p.z - isl.z) < isl.r * 1.15) { G.prog.revealed[isl.id + '_v'] = 1; G.prog.revealed[isl.id] = 1; emit('discover', isl); }
      for (const m of this.markers) if (!G.prog.revealed[m.id + '_v'] && m.icon !== '🏝️' && Math.hypot(p.x - m.x, p.z - m.z) < 45) { G.prog.revealed[m.id + '_v'] = 1; G.prog.revealed[m.id] = 1; emit('poi', m); }
    }
  }
  applyLooted() {
    for (const it of this.interactables) if (G.prog.looted[it.id]) { if (it.lid) it.lid.rotation.x = -1.3; if (it.xm) it.xm.visible = false; }
    for (const it of this.interactables) if (it.kind === 'dig') it.xm.visible = !!G.prog.flags.treasure_map && !G.prog.looted[it.id];
  }
}
function push(pos, cx, cz, r) {
  const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r || d2 < 1e-6) return false;
  const d = Math.sqrt(d2), k = (r - d) / d;
  pos.x += dx * k; pos.z += dz * k;
  return true;
}
export function rollLoot(tbl) {
  const out = {};
  for (const [id, v] of Object.entries(tbl)) { const n = Array.isArray(v) ? Math.round(rand(v[0], v[1])) : v; if (n > 0) out[id] = n; }
  return out;
}
