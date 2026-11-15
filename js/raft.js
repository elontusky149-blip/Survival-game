// The raft: grid-based building, devices, sailing physics.
import * as THREE from 'three';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';
import { G, clamp, lerp, damp, noise2, emit, rand } from './util.js';
import { mat } from './textures.js';
import { mesh, boxG, cylG, sphG, coneG, colMat, geo } from './models.js';
import { waveHeight } from './env.js';
import { terrainHeight, WORLD_R } from './world.js';
import { PIECES, ITEMS } from './items.js';

export const TS = 2, LH = 2.6, DECK = 0.28;
const H = LH - 0.16;
const B = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const M = (...g) => mergeGeometries(g);

function partDefs(type) {
  switch (type) {
    case 'foundation': return [[B(TS - 0.03, 0.14, TS - 0.03, 0, DECK - 0.07, 0), 'wood'],
      [M(...[-0.65, 0, 0.65].map((z) => new THREE.CylinderGeometry(0.17, 0.17, TS - 0.02, 7).rotateZ(Math.PI / 2).translate(0, 0.04, z))), 'wood_dark']];
    case 'foundation_r': return [[B(TS - 0.03, 0.14, TS - 0.03, 0, DECK - 0.07, 0), 'wood'],
      [M(B(TS, 0.3, 0.1, 0, 0.08, TS / 2 - 0.05), B(TS, 0.3, 0.1, 0, 0.08, -TS / 2 + 0.05), B(0.1, 0.3, TS, TS / 2 - 0.05, 0.08, 0), B(0.1, 0.3, TS, -TS / 2 + 0.05, 0.08, 0), B(TS - 0.2, 0.2, TS - 0.2, 0, 0, 0)), 'metal']];
    case 'floor': return [[B(TS, 0.14, TS, 0, DECK - 0.07, 0), 'wood'], [M(B(TS, 0.12, 0.12, 0, DECK - 0.2, 0.6), B(TS, 0.12, 0.12, 0, DECK - 0.2, -0.6)), 'wood_dark']];
    case 'wall': return [[B(TS - 0.2, H, 0.1, 0, DECK + H / 2, TS / 2 - 0.05), 'wood'],
      [M(B(0.12, H, 0.14, TS / 2 - 0.06, DECK + H / 2, TS / 2 - 0.05), B(0.12, H, 0.14, -TS / 2 + 0.06, DECK + H / 2, TS / 2 - 0.05)), 'wood_dark']];
    case 'doorway': return [[M(B(0.4, H, 0.1, 0.74, DECK + H / 2, TS / 2 - 0.05), B(0.4, H, 0.1, -0.74, DECK + H / 2, TS / 2 - 0.05), B(1.1, 0.4, 0.1, 0, DECK + H - 0.2, TS / 2 - 0.05)), 'wood'],
      [M(B(0.12, H, 0.14, TS / 2 - 0.06, DECK + H / 2, TS / 2 - 0.05), B(0.12, H, 0.14, -TS / 2 + 0.06, DECK + H / 2, TS / 2 - 0.05)), 'wood_dark']];
    case 'window': return [[M(B(TS - 0.2, 0.9, 0.1, 0, DECK + 0.45, TS / 2 - 0.05), B(TS - 0.2, 0.44, 0.1, 0, DECK + H - 0.22, TS / 2 - 0.05), B(0.3, H - 1.34, 0.1, 0.75, DECK + 0.9 + (H - 1.34) / 2, TS / 2 - 0.05), B(0.3, H - 1.34, 0.1, -0.75, DECK + 0.9 + (H - 1.34) / 2, TS / 2 - 0.05)), 'wood'],
      [M(B(0.12, H, 0.14, TS / 2 - 0.06, DECK + H / 2, TS / 2 - 0.05), B(0.12, H, 0.14, -TS / 2 + 0.06, DECK + H / 2, TS / 2 - 0.05)), 'wood_dark'],
      [B(1.2, H - 1.34, 0.03, 0, DECK + 0.9 + (H - 1.34) / 2, TS / 2 - 0.05), 'glass']];
    case 'railing': return [[M(B(0.08, 1, 0.08, 0.92, DECK + 0.5, TS / 2 - 0.06), B(0.08, 1, 0.08, -0.92, DECK + 0.5, TS / 2 - 0.06), B(0.08, 1, 0.08, 0, DECK + 0.5, TS / 2 - 0.06), B(TS, 0.07, 0.1, 0, DECK + 1, TS / 2 - 0.06)), 'wood_dark'],
      [B(TS, 0.035, 0.035, 0, DECK + 0.55, TS / 2 - 0.06), 'rope']];
    case 'wall_m': return [[B(TS - 0.1, H, 0.1, 0, DECK + H / 2, TS / 2 - 0.05), 'metal'],
      [M(B(TS, 0.12, 0.14, 0, DECK + 0.06, TS / 2 - 0.05), B(TS, 0.12, 0.14, 0, DECK + H - 0.06, TS / 2 - 0.05), B(0.12, H, 0.14, TS / 2 - 0.06, DECK + H / 2, TS / 2 - 0.05), B(0.12, H, 0.14, -TS / 2 + 0.06, DECK + H / 2, TS / 2 - 0.05)), 'dark']];
    case 'pillar': return [[B(0.2, LH - 0.14, 0.2, -TS / 2 + 0.1, DECK + (LH - 0.14) / 2, -TS / 2 + 0.1), 'wood_dark']];
    case 'stairs': {
      const steps = [];
      for (let k = 0; k < 7; k++) steps.push(B(TS * 0.9, 0.08, TS / 7 + 0.06, 0, DECK + ((k + 1) / 7) * LH - 0.04, -TS / 2 + (k + 0.5) * (TS / 7)));
      const len = Math.hypot(TS, LH), ang = Math.atan2(LH, TS);
      const st = [-1, 1].map((sx) => new THREE.BoxGeometry(0.1, 0.16, len).rotateX(-ang).translate(sx * (TS * 0.45), DECK + LH / 2 - 0.1, 0));
      return [[M(...steps), 'wood'], [M(...st), 'wood_dark']];
    }
    case 'roof': return [[B(TS + 0.16, 0.2, TS + 0.16, 0, DECK + LH + 0.02, 0), 'thatch'], [M(B(TS, 0.1, 0.1, 0, DECK + LH - 0.12, 0), B(0.1, 0.1, TS, 0, DECK + LH - 0.12, 0)), 'wood_dark']];
  }
  return [];
}
const INSTANCED = ['foundation', 'foundation_r', 'floor', 'wall', 'doorway', 'window', 'railing', 'wall_m', 'pillar', 'stairs', 'roof'];
const BLOCKING = { wall: 1, window: 1, wall_m: 1, railing: 1 };
const SUPPORTS = { wall: 1, window: 1, wall_m: 1, doorway: 1 };

function sailGeo(w, h) {
  const g = new THREE.PlaneGeometry(w, h, 6, 6), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (w / 2), y = p.getY(i) / (h / 2); p.setZ(i, (1 - x * x) * (1 - y * y * 0.6) * w * 0.17); }
  g.computeVertexNormals(); return g;
}
const glow = (c, i = 1.5) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i });

function makeDevice(type) {
  const g = new THREE.Group(), u = (g.userData = {});
  const Y = DECK;
  switch (type) {
    case 'chest': mesh(boxG(1.1, 0.6, 0.7), 'wood', 0, Y + 0.3, 0, g); mesh(boxG(1.14, 0.14, 0.74), 'wood_dark', 0, Y + 0.67, 0, g); mesh(boxG(0.14, 0.2, 0.04), 'metal', 0, Y + 0.55, 0.37, g); break;
    case 'bed': {
      for (const sz of [-0.9, 0.9]) mesh(cylG(0.06, 0.07, 1.5, 6), 'wood_dark', 0, Y + 0.75, sz, g);
      const hm = mesh(geo('hammock', () => { const p = new THREE.PlaneGeometry(0.9, 1.7, 4, 8); const a = p.attributes.position; for (let i = 0; i < a.count; i++) { const y = a.getY(i) / 0.85, x = a.getX(i) / 0.45; a.setZ(i, -(1 - y * y) * 0.45 - (1 - x * x) * 0.12); } p.computeVertexNormals(); return p; }), 'cloth', 0, Y + 1.25, 0, g);
      hm.rotation.x = -Math.PI / 2; break;
    }
    case 'lantern': mesh(cylG(0.04, 0.05, 1.5, 6), 'wood_dark', 0, Y + 0.75, 0, g); mesh(boxG(0.3, 0.04, 0.04), 'wood_dark', 0.13, Y + 1.5, 0, g); u.lamp = mesh(boxG(0.18, 0.24, 0.18), glow(0xffb45a, 0.1), 0.26, Y + 1.32, 0, g, false); u.lit = true; break;
    case 'grill': mesh(cylG(0.5, 0.56, 0.55, 10), 'rock', 0, Y + 0.27, 0, g); mesh(cylG(0.46, 0.46, 0.04, 10), 'dark', 0, Y + 0.58, 0, g);
      u.fire = mesh(coneG(0.2, 0.4, 6), new THREE.MeshBasicMaterial({ color: 0xff8a2a }), 0, Y + 0.55, 0, g, false); u.fire.visible = false;
      u.food = [0, 1, 2].map((i) => { const f = mesh(boxG(0.22, 0.06, 0.12), colMat(0xd98c6a), Math.cos(i * 2.1) * 0.22, Y + 0.63, Math.sin(i * 2.1) * 0.22, g, false); f.visible = false; return f; }); break;
    case 'purifier': mesh(boxG(0.9, 0.5, 0.9), 'wood', 0, Y + 0.25, 0, g); mesh(geo('dome', () => new THREE.SphereGeometry(0.42, 12, 8, 0, 6.3, 0, 1.57)), 'glass', 0, Y + 0.5, 0, g, false); mesh(cylG(0.1, 0.08, 0.16, 8), 'metal', 0.55, Y + 0.08, 0, g); break;
    case 'purifier2': mesh(cylG(0.45, 0.45, 1.3, 12), 'metal', 0, Y + 0.65, 0, g); mesh(cylG(0.3, 0.3, 0.5, 12), 'glass', 0, Y + 1.55, 0, g, false); mesh(boxG(0.3, 0.3, 0.5), 'panel', 0.5, Y + 0.4, 0, g); mesh(cylG(0.04, 0.04, 0.9, 6), 'metal', 0.5, Y + 1, 0, g); break;
    case 'collector': for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(cylG(0.04, 0.04, 1.3, 5), 'wood_dark', sx * 0.6, Y + 0.65, sz * 0.6, g);
      mesh(geo('funnel', () => new THREE.ConeGeometry(0.85, 0.55, 4, 1, true).rotateX(Math.PI).rotateY(Math.PI / 4)), 'cloth', 0, Y + 1.05, 0, g); mesh(cylG(0.28, 0.25, 0.5, 10), 'wood', 0, Y + 0.25, 0, g); break;
    case 'net': mesh(geo('netf', () => M(B(1.9, 0.1, 0.1, 0, 0, 0.9), B(1.9, 0.1, 0.1, 0, 0, -0.9), B(0.1, 0.1, 1.9, 0.9, 0, 0), B(0.1, 0.1, 1.9, -0.9, 0, 0))), 'wood_dark', 0, Y + 0.3, 0, g);
      mesh(geo('netm', () => new THREE.PlaneGeometry(1.8, 1.8, 8, 8).rotateX(-Math.PI / 2)), new THREE.MeshBasicMaterial({ color: 0xcdbb8a, wireframe: true }), 0, Y + 0.28, 0, g, false);
      u.catch = mesh(boxG(0.5, 0.25, 0.5), 'wood', 0, Y + 0.4, 0, g); u.catch.visible = false; break;
    case 'planter': mesh(boxG(1.3, 0.4, 1.3), 'wood', 0, Y + 0.2, 0, g); mesh(boxG(1.15, 0.06, 1.15), colMat(0x3a2a1c), 0, Y + 0.4, 0, g);
      u.plant = mesh(geo('sprout', () => M(...[0, 1, 2].map((i) => new THREE.PlaneGeometry(0.8, 0.8).translate(0, 0.4, 0).rotateY(i * 1.05)))), colMat(0x4f9a3a, { side: THREE.DoubleSide }), 0, Y + 0.42, 0, g); u.plant.visible = false; break;
    case 'bench': mesh(boxG(1.5, 0.1, 0.8), 'wood', 0, Y + 0.85, 0, g); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(boxG(0.1, 0.85, 0.1), 'wood_dark', sx * 0.65, Y + 0.42, sz * 0.32, g);
      mesh(boxG(0.3, 0.12, 0.2), 'metal', -0.4, Y + 0.96, 0, g); mesh(boxG(0.06, 0.06, 0.5), 'wood_dark', 0.3, Y + 0.93, 0.1, g).rotation.y = 0.5; mesh(boxG(1.5, 0.7, 0.06), 'wood', 0, Y + 1.3, -0.37, g); break;
    case 'forge': mesh(boxG(1.2, 0.9, 1.2), 'stonebrick', 0, Y + 0.45, 0, g); mesh(cylG(0.25, 0.35, 1.3, 8), 'stonebrick', 0, Y + 1.5, -0.25, g); u.glow = mesh(boxG(0.5, 0.35, 0.06), glow(0xff5a14, 1.8), 0, Y + 0.45, 0.6, g, false); break;
    case 'sail': case 'sail2': {
      const big = type === 'sail2', h = big ? 7.2 : 5.4, w = big ? 3.5 : 2.5, sh = big ? 4.6 : 3.3;
      mesh(cylG(0.08, 0.11, h, 7), 'wood_dark', 0, Y + h / 2, 0, g); mesh(cylG(0.05, 0.05, w + 0.2, 6), 'wood_dark', 0, Y + h - 0.4, 0.14, g).rotation.z = Math.PI / 2;
      mesh(cylG(0.05, 0.05, w + 0.2, 6), 'wood_dark', 0, Y + h - 0.4 - sh, 0.14, g).rotation.z = Math.PI / 2;
      const pivot = new THREE.Group(); pivot.position.set(0, Y + h - 0.4, 0.16); g.add(pivot);
      mesh(sailGeo(w, sh), mat('cloth', big ? { color: 0xe8c9a0 } : {}), 0, -sh / 2, 0, pivot); u.cloth = pivot; break;
    }
    case 'anchor': mesh(cylG(0.25, 0.25, 0.5, 8), 'wood_dark', 0, Y + 0.45, 0, g).rotation.z = Math.PI / 2; mesh(boxG(0.7, 0.4, 0.12), 'wood', 0, Y + 0.2, 0.25, g); mesh(boxG(0.7, 0.4, 0.12), 'wood', 0, Y + 0.2, -0.25, g);
      u.hook = mesh(geo('anch', () => M(B(0.08, 0.7, 0.08, 0, 0.35, 0), new THREE.TorusGeometry(0.3, 0.05, 5, 10, Math.PI).rotateZ(Math.PI))), 'metal', 0.5, Y + 0.1, 0, g); break;
    case 'wheel': mesh(boxG(0.3, 1, 0.3), 'wood_dark', 0, Y + 0.5, 0, g);
      u.wheel = mesh(geo('whl', () => M(new THREE.TorusGeometry(0.42, 0.045, 6, 14), ...[0, 1, 2, 3].map((i) => new THREE.BoxGeometry(1.02, 0.05, 0.05).rotateZ(i * 0.785)))), 'wood', 0, Y + 1.1, 0.2, g); break;
    case 'navtable': mesh(boxG(1.3, 0.08, 0.9), 'wood', 0, Y + 0.8, 0, g); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(boxG(0.08, 0.8, 0.08), 'wood_dark', sx * 0.55, Y + 0.4, sz * 0.36, g);
      mesh(boxG(1, 0.01, 0.65), colMat(0xe6d6a8), 0, Y + 0.85, 0, g, false); mesh(sphG(0.14, 10, 8), colMat(0x3a78b8), 0.42, Y + 1.02, -0.2, g); break;
    case 'radio': mesh(boxG(0.8, 0.5, 0.4), 'metal', 0, Y + 0.95, 0, g); mesh(boxG(0.9, 0.7, 0.6), 'wood', 0, Y + 0.35, 0, g); mesh(cylG(0.015, 0.015, 1.8, 4), 'metal', 0.3, Y + 2.05, 0, g, false);
      u.dial = mesh(boxG(0.3, 0.14, 0.02), glow(0x64ffb4, 1.2), -0.15, Y + 1, 0.21, g, false); break;
    case 'engine': mesh(boxG(1, 0.8, 1.2), 'metal', 0, Y + 0.4, 0, g); mesh(cylG(0.12, 0.12, 1.1, 8), 'dark', 0.3, Y + 1.3, -0.3, g); mesh(cylG(0.3, 0.3, 0.5, 10), 'panel', -0.15, Y + 0.95, 0.1, g);
      u.light = mesh(sphG(0.06, 6, 5), glow(0xff2a1a, 2), 0.35, Y + 0.85, 0.5, g, false); break;
    case 'turret': mesh(cylG(0.35, 0.45, 0.8, 8), 'wood_dark', 0, Y + 0.4, 0, g); u.head = new THREE.Group(); u.head.position.y = Y + 1; g.add(u.head);
      mesh(boxG(0.14, 0.14, 1.6), 'wood', 0, 0, 0.3, u.head); mesh(boxG(1.4, 0.06, 0.08), 'wood_dark', 0, 0.05, 0.9, u.head); mesh(boxG(0.3, 0.3, 0.4), 'metal', 0, -0.05, -0.2, u.head); break;
    case 'beacon': mesh(cylG(0.25, 0.45, 4, 8), 'metal', 0, Y + 2, 0, g); mesh(cylG(0.5, 0.5, 0.15, 8), 'dark', 0, Y + 4, 0, g); u.lamp = mesh(cylG(0.32, 0.32, 0.6, 10), glow(0x9ff8ff, 2.5), 0, Y + 4.4, 0, g, false); mesh(coneG(0.5, 0.4, 8), 'dark', 0, Y + 4.9, 0, g); u.lit = true; break;
  }
  g.traverse((o) => { if (o.isMesh && o.castShadow !== false) o.castShadow = true; });
  return g;
}

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s1 = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler(), _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

export function currentAt(x, z, out) {
  const a = noise2(x / 1300 + 5, z / 1300 + 9, 77) * Math.PI * 4 + 5.6;
  let cx = Math.sin(a) * 0.28, cz = Math.cos(a) * 0.28;
  const d = Math.hypot(x, z);
  if (d > WORLD_R) { const k = Math.min(3, (d - WORLD_R) / 120); cx -= (x / d) * k; cz -= (z / d) * k; }
  return out.set(cx, 0, cz);
}

export class Raft {
  constructor(scene) {
    G.raft = this;
    this.group = new THREE.Group(); scene.add(this.group);
    this.pieces = new Map();
    this.vel = new THREE.Vector3(); this.yaw = 0; this.yawVel = 0; this.steer = 0; this.throttle = 1;
    this.paddle = new THREE.Vector3(); this.paddleT = 0;
    this.inst = {}; this.devGroup = new THREE.Group(); this.group.add(this.devGroup);
    this.lights = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffb060, 0, 22, 1.5); this.group.add(l); return l; });
    this.ghost = new THREE.Group(); this.ghost.visible = false; this.group.add(this.ghost);
    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0x55ff88, transparent: true, opacity: 0.45, depthWrite: false });
    this.ghostCache = {}; this.condition = 1; this.aground = false; this.fixed = false; this.name = 'raft';
    this.reset();
  }
  reset() {
    for (const p of [...this.pieces.values()]) if (p.obj) this.devGroup.remove(p.obj);
    this.pieces.clear();
    for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) this.add({ type: 'foundation', i, j, l: 0, r: 0 }, true);
    this.group.position.set(0, 0, 0); this.yaw = 0; this.vel.set(0, 0, 0);
    this.rebuild();
  }

  // ----- slots -----
  static kindSlot(kind) { return kind === 'tile' || kind === 'floor' ? 'T' : kind === 'edge' ? 'E' : kind === 'pillar' ? 'P' : kind === 'roof' ? 'R' : 'C'; }
  key(s, i, j, l, r) { return s === 'E' ? `E${i},${j},${l},${r}` : `${s}${i},${j},${l}`; }
  get(s, i, j, l, r) { return this.pieces.get(this.key(s, i, j, l, r)); }
  tile(i, j, l) { return this.pieces.get(`T${i},${j},${l}`); }
  edge(i, j, l, r) { if (r === 2) { j--; r = 0; } else if (r === 3) { i--; r = 1; } return this.pieces.get(`E${i},${j},${l},${r}`); }
  add(p, silent) {
    const def = PIECES[p.type], s = Raft.kindSlot(def.kind);
    if (s === 'E') { if (p.r === 2) { p.j--; p.r = 0; } else if (p.r === 3) { p.i--; p.r = 1; } }
    p.slot = s; p.key = this.key(s, p.i, p.j, p.l, p.r); p.maxHp = def.hp || 150; if (p.hp == null) p.hp = p.maxHp;
    this.pieces.set(p.key, p);
    if (def.kind === 'device') {
      p.obj = makeDevice(p.type); p.obj.position.set(p.i * TS, p.l * LH, p.j * TS); p.obj.rotation.y = (p.r * Math.PI) / 2; this.devGroup.add(p.obj);
      p.wpos = new THREE.Vector3();
      if (p.type === 'chest' && !p.slots) p.slots = new Array(16).fill(null);
      if (p.type === 'grill' && !p.cook) p.cook = [];
      if ((p.type === 'purifier' || p.type === 'purifier2' || p.type === 'collector') && p.water == null) p.water = 0;
      if ((p.type === 'sail' || p.type === 'sail2') && p.open == null) p.open = true;
      if (p.type === 'net' && !p.caught) p.caught = [];
      if (p.type === 'engine' && p.fuel == null) { p.fuel = 0; p.on = false; }
      if (p.type === 'planter' && p.grow == null) p.grow = -1;
    }
    if (!silent) { this.rebuild(); emit('built', p.type, p); }
    return p;
  }
  remove(p, silent) {
    this.pieces.delete(p.key);
    if (p.obj) this.devGroup.remove(p.obj);
    if (G.player && G.player.helm === p) G.player.helm = null;
    if (!silent) { this.cleanup(); this.rebuild(); }
  }
  // drop anything that lost its supporting tile
  cleanup() {
    let again = true;
    while (again) {
      again = false;
      for (const p of [...this.pieces.values()]) {
        let ok = true;
        if (p.slot === 'T' && p.l > 0) ok = !!this.tile(p.i, p.j, p.l - 1);
        else if (p.slot === 'C' || p.slot === 'R') ok = !!this.tile(p.i, p.j, p.l);
        else if (p.slot === 'E') ok = !!(this.tile(p.i, p.j, p.l) || (p.r === 0 ? this.tile(p.i, p.j + 1, p.l) : this.tile(p.i + 1, p.j, p.l)));
        else if (p.slot === 'P') ok = !!(this.tile(p.i, p.j, p.l) || this.tile(p.i - 1, p.j, p.l) || this.tile(p.i, p.j - 1, p.l) || this.tile(p.i - 1, p.j - 1, p.l));
        if (!ok) { this.pieces.delete(p.key); if (p.obj) this.devGroup.remove(p.obj); again = true; }
      }
    }
  }
  supported(i, j, l) { // can a floor/roof rest above tile (i,j,l)?
    if (!this.tile(i, j, l)) return false;
    for (let r = 0; r < 4; r++) { const e = this.edge(i, j, l, r); if (e && SUPPORTS[e.type]) return true; }
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (this.pieces.get(`P${i + a},${j + b},${l}`)) return true;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.tile(i + a, j + b, l + 1) || this.pieces.get(`R${i + a},${j + b},${l}`)) return true;
    return false;
  }

  // ----- rendering -----
  rebuild() {
    const counts = {};
    for (const p of this.pieces.values()) if (INSTANCED.includes(p.type)) counts[p.type] = (counts[p.type] || 0) + 1;
    for (const type of INSTANCED) {
      const n = counts[type] || 0; let set = this.inst[type];
      if (n && (!set || set.cap < n)) {
        if (set) for (const m of set.meshes) { this.group.remove(m); m.dispose(); }
        const cap = Math.max(32, n * 2);
        set = this.inst[type] = { cap, meshes: partDefs(type).map(([g, m]) => { const im = new THREE.InstancedMesh(g, mat(m), cap); im.castShadow = m !== 'glass'; im.receiveShadow = true; im.frustumCulled = false; this.group.add(im); return im; }) };
      }
      if (set) for (const m of set.meshes) m.count = 0;
    }
    let nT = 0, hp = 0, mx = 0, minI = 0, maxI = 0, minJ = 0, maxJ = 0, top = 0;
    this.sailPow = 0; this.hasWheel = false; this.anchored = false; this.engines = 0; this.devs = [];
    for (const p of this.pieces.values()) {
      if (p.slot === 'T') { nT++; minI = Math.min(minI, p.i); maxI = Math.max(maxI, p.i); minJ = Math.min(minJ, p.j); maxJ = Math.max(maxJ, p.j); top = Math.max(top, p.l); }
      hp += p.hp; mx += p.maxHp;
      const set = this.inst[p.type];
      if (set) {
        _m4.compose(_v.set(p.i * TS, p.l * LH, p.j * TS), _q.setFromAxisAngle(UP, (p.r * Math.PI) / 2), _s1);
        const dmg = 1 - p.hp / p.maxHp; _c.setRGB(1 - dmg * 0.45, 1 - dmg * 0.7, 1 - dmg * 0.7);
        for (const m of set.meshes) { m.setMatrixAt(m.count, _m4); m.setColorAt(m.count, _c); m.count++; }
      } else if (p.obj) this.devs.push(p);
    }
    for (const type of INSTANCED) { const set = this.inst[type]; if (set) for (const m of set.meshes) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } }
    this.nTiles = nT; this.condition = mx ? hp / mx : 1; this.topLevel = top;
    this.cx = ((minI + maxI) / 2) * TS; this.cz = ((minJ + maxJ) / 2) * TS;
    this.radius = Math.hypot((maxI - minI + 1) * TS, (maxJ - minJ + 1) * TS) / 2;
    this.bounds = { minI, maxI, minJ, maxJ };
    this.refreshStats();
  }
  refreshStats() {
    this.sailPow = 0; this.hasWheel = false; this.anchored = false; this.engines = 0; this.hasNav = false; this.hasBeacon = false;
    for (const d of this.devs) {
      if (d.type === 'sail' && d.open) this.sailPow += 1; if (d.type === 'sail2' && d.open) this.sailPow += 2.2;
      if (d.type === 'wheel') this.hasWheel = true; if (d.type === 'anchor' && d.down) this.anchored = true;
      if (d.type === 'engine' && d.on && d.fuel > 0) this.engines++;
      if (d.type === 'navtable') this.hasNav = true; if (d.type === 'beacon') this.hasBeacon = true;
    }
  }

  // ----- platform interface -----
  surfaceAt(lx, lz, ly) {
    const i = Math.round(lx / TS), j = Math.round(lz / TS);
    let best = null;
    for (let l = this.topLevel + 1; l >= 0; l--) {
      const base = l * LH + DECK;
      if (this.tile(i, j, l) && base <= ly + 0.55) { best = base; }
      const c = this.pieces.get(`C${i},${j},${l}`);
      if (c && c.type === 'stairs') {
        const fx = lx - i * TS, fz = lz - j * TS, a = [fz, fx, -fz, -fx][c.r];
        const sy = base + clamp(((a + TS / 2) / TS) * 1.12, 0, 1) * LH;
        if (sy <= ly + 0.6 && (best == null || sy > best)) best = sy;
      }
      if (best != null) return best;
    }
    return null;
  }
  levelOf(ly) { return Math.max(0, Math.round((ly - DECK) / LH)); }
  // can the player step from one local position to another? (walls, railings, bulky devices)
  canMove(ax, az, bx, bz, ly) {
    const l = this.levelOf(ly), i0 = Math.round(ax / TS), j0 = Math.round(az / TS), i1 = Math.round(bx / TS), j1 = Math.round(bz / TS);
    const onStairs = (i, j) => { const c = this.pieces.get(`C${i},${j},${l}`) || (l > 0 && this.pieces.get(`C${i},${j},${l - 1}`)); return c && c.type === 'stairs'; };
    if ((i0 !== i1 || j0 !== j1) && !onStairs(i0, j0) && !onStairs(i1, j1)) {
      const r = i1 > i0 ? 1 : i1 < i0 ? 3 : j1 > j0 ? 0 : 2, e = this.edge(i0, j0, l, r);
      if (e && BLOCKING[e.type] && (this.tile(i0, j0, l) || this.tile(i1, j1, l))) return false;
    }
    // near-wall margin so the body does not clip through
    const fx = bx - i1 * TS, fz = bz - j1 * TS, mg = TS / 2 - 0.22;
    if (!onStairs(i1, j1)) {
      if (fz > mg) { const e = this.edge(i1, j1, l, 0); if (e && BLOCKING[e.type] && bz > az) return false; }
      if (fz < -mg) { const e = this.edge(i1, j1, l, 2); if (e && BLOCKING[e.type] && bz < az) return false; }
      if (fx > mg) { const e = this.edge(i1, j1, l, 1); if (e && BLOCKING[e.type] && bx > ax) return false; }
      if (fx < -mg) { const e = this.edge(i1, j1, l, 3); if (e && BLOCKING[e.type] && bx < ax) return false; }
    }
    const c = this.pieces.get(`C${i1},${j1},${l}`);
    if (c && c.obj && !['net', 'lantern', 'anchor'].includes(c.type)) {
      const d0 = Math.hypot(ax - c.i * TS, az - c.j * TS), d1 = Math.hypot(bx - c.i * TS, bz - c.j * TS);
      if (d1 < 0.62 && d1 < d0) return false;
    }
    return true;
  }
  climb(lx, lz) {
    const i = Math.round(lx / TS), j = Math.round(lz / TS);
    let best = null, bd = 1.7;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      if (!this.tile(i + a, j + b, 0)) continue;
      const cx = clamp(lx, (i + a) * TS - 0.7, (i + a) * TS + 0.7), cz = clamp(lz, (j + b) * TS - 0.7, (j + b) * TS + 0.7), d = Math.hypot(cx - lx, cz - lz);
      if (d < bd) { bd = d; best = new THREE.Vector3(cx, DECK, cz); }
    }
    return best;
  }
  sheltered(lx, lz, ly) { const i = Math.round(lx / TS), j = Math.round(lz / TS), l = this.levelOf(ly); return !!(this.tile(i, j, l + 1) || this.pieces.get(`R${i},${j},${l}`)); }
  toLocal(w, out) { return out.copy(w).applyMatrix4(_m4.copy(this.group.matrixWorld).invert()); }
  worldOf(p, out, dy = 0.5) { return out.set(p.i * TS, p.l * LH + DECK + dy, p.j * TS).applyMatrix4(this.group.matrixWorld); }

  // ----- building -----
  // returns {ok, i,j,l,r, why} for placing `type` at a local-space aim point
  probe(type, lx, lz, pl, rot) {
    const def = PIECES[type], i = Math.round(lx / TS), j = Math.round(lz / TS), fx = lx / TS - i, fz = lz / TS - j;
    const o = { ok: false, i, j, l: pl, r: rot, why: '' };
    const T = (a, b, l) => this.tile(a, b, l);
    switch (def.kind) {
      case 'tile': {
        o.l = 0; o.r = 0;
        const ex = T(i, j, 0);
        if (ex) { if (type === 'foundation_r' && ex.type === 'foundation') { o.ok = true; o.upgrade = ex; } else o.why = 'Occupied'; break; }
        if (!(T(i + 1, j, 0) || T(i - 1, j, 0) || T(i, j + 1, 0) || T(i, j - 1, 0))) { o.why = 'Must touch the raft'; break; }
        o.ok = true; break;
      }
      case 'floor': o.l = pl + 1; o.r = 0;
        if (T(i, j, o.l)) o.why = 'Occupied'; else if (this.pieces.get(`R${i},${j},${pl}`)) o.why = 'Roof in the way'; else if (!T(i, j, pl)) o.why = 'Needs a floor below';
        else if ((this.pieces.get(`C${i},${j},${pl}`) || {}).type === 'stairs') o.why = 'Stairs need headroom'; else if (!this.supported(i, j, pl)) o.why = 'Needs a wall or pillar below'; else o.ok = true; break;
      case 'roof': o.r = 0;
        if (this.pieces.get(`R${i},${j},${pl}`) || T(i, j, pl + 1)) o.why = 'Occupied'; else if (!T(i, j, pl)) o.why = 'Needs a floor below';
        else if ((this.pieces.get(`C${i},${j},${pl}`) || {}).type === 'stairs') o.why = 'Stairs need headroom'; else if (!this.supported(i, j, pl)) o.why = 'Needs a wall or pillar below'; else o.ok = true; break;
      case 'edge': o.r = Math.abs(fz) > Math.abs(fx) ? (fz > 0 ? 0 : 2) : fx > 0 ? 1 : 3;
        if (!T(i, j, pl)) o.why = 'Needs a floor'; else if (this.edge(i, j, pl, o.r)) o.why = 'Occupied'; else o.ok = true; break;
      case 'pillar': o.i = i + (fx > 0 ? 1 : 0); o.j = j + (fz > 0 ? 1 : 0); o.r = 0;
        if (!T(i, j, pl)) o.why = 'Needs a floor'; else if (this.pieces.get(`P${o.i},${o.j},${pl}`)) o.why = 'Occupied'; else o.ok = true; break;
      case 'stairs':
        if (!T(i, j, pl)) o.why = 'Needs a floor'; else if (this.pieces.get(`C${i},${j},${pl}`)) o.why = 'Occupied'; else if (T(i, j, pl + 1) || this.pieces.get(`R${i},${j},${pl}`)) o.why = 'Needs headroom'; else o.ok = true; break;
      default:
        if (!T(i, j, pl)) o.why = 'Needs a floor'; else if (this.pieces.get(`C${i},${j},${pl}`)) o.why = 'Occupied';
        else if (['sail', 'sail2', 'beacon'].includes(type) && (T(i, j, pl + 1) || this.pieces.get(`R${i},${j},${pl}`))) o.why = 'Needs open sky';
        else if (['net', 'anchor', 'engine'].includes(type) && pl !== 0) o.why = 'Must be at water level'; else o.ok = true;
    }
    return o;
  }
  showGhost(type, o) {
    if (!type) { this.ghost.visible = false; return; }
    if (this.ghostType !== type) {
      this.ghost.clear(); this.ghostType = type;
      let gg = this.ghostCache[type];
      if (!gg) {
        gg = this.ghostCache[type] = new THREE.Group();
        if (INSTANCED.includes(type)) for (const [g] of partDefs(type)) gg.add(new THREE.Mesh(g, this.ghostMat));
        else { const d = makeDevice(type); d.traverse((m) => { if (m.isMesh) { m.material = this.ghostMat; m.castShadow = false; } if (m.isLight) m.visible = false; }); gg.add(d); }
      }
      this.ghost.add(gg);
    }
    this.ghost.visible = true;
    let { i, j, r } = o; const kind = PIECES[type].kind;
    this.ghost.position.set(i * TS, o.l * LH + (kind === 'tile' && o.upgrade ? 0.02 : 0), j * TS); this.ghost.rotation.y = (r * Math.PI) / 2;
    this.ghostMat.color.setHex(o.ok && o.afford ? 0x55ff88 : o.ok ? 0xffd24a : 0xff5544);
  }
  // nearest removable/repairable piece to a local point on a level
  pieceNear(lx, lz, pl) {
    let best = null, bd = 1.5;
    for (const p of this.pieces.values()) {
      if (p.l !== pl && !(p.slot === 'T' && p.l === pl + 1) && !(p.slot === 'R' && p.l === pl)) continue;
      let x = p.i * TS, z = p.j * TS, bias = 0.55;
      if (p.slot === 'E') { if (p.r === 0) z += TS / 2; else x += TS / 2; bias = 0; }
      else if (p.slot === 'P') { x -= TS / 2; z -= TS / 2; bias = 0; }
      else if (p.slot === 'C') bias = 0.2;
      else if (p.slot === 'R' || p.l === pl + 1) bias = 0.8;
      const d = Math.hypot(lx - x, lz - z) + bias;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  damage(p, dmg, cause) {
    if (!this.pieces.has(p.key)) return false;
    if ((p.type === 'wall_m' || p.type === 'foundation_r') && cause !== 'cannon') dmg *= 0.15;
    p.hp -= dmg;
    if (p.hp <= 0) {
      if (p.slot === 'T' && p.l === 0 && this.nTiles <= 1) { p.hp = 1; this.rebuild(); return false; }
      this.remove(p); emit('raftlost', p, cause);
      return true;
    }
    this.rebuild(); return false;
  }
  edgeFoundations() {
    const out = [];
    for (const p of this.pieces.values()) if (p.slot === 'T' && p.l === 0 && p.type === 'foundation') {
      const n = (this.tile(p.i + 1, p.j, 0) ? 1 : 0) + (this.tile(p.i - 1, p.j, 0) ? 1 : 0) + (this.tile(p.i, p.j + 1, 0) ? 1 : 0) + (this.tile(p.i, p.j - 1, 0) ? 1 : 0);
      if (n < 4) out.push(p);
    }
    return out;
  }
  devicesOf(type) { return this.devs.filter((d) => d.type === type); }
  nearStation(type, wpos, range = 5) { for (const d of this.devs) if (d.type === type && d.wpos.distanceTo(wpos) < range) return true; return false; }

  // ----- simulation -----
  update(dt) {
    const env = G.env, gp = this.group.position;
    // devices
    let lit = [];
    const night = env.light < 0.45;
    for (const d of this.devs) {
      const u = d.obj.userData;
      d.wpos.set(d.i * TS, d.l * LH + DECK + 0.7, d.j * TS).applyMatrix4(this.group.matrixWorld);
      switch (d.type) {
        case 'purifier': d.water = Math.min(4, d.water + dt / 40); break;
        case 'purifier2': d.water = Math.min(12, d.water + dt / 10); break;
        case 'collector': if (env.rain > 0.05 && !this.tile(d.i, d.j, d.l + 1)) d.water = Math.min(6, d.water + (dt * env.rain) / 14); break;
        case 'grill': {
          let any = false;
          d.cook.forEach((c, k) => { if (c.t > 0) { c.t -= dt; any = true; if (c.t <= 0) { c.id = ITEMS[c.id].cook; c.done = true; if (G.audio) G.audio.sfx('sizzle'); } } u.food[k].visible = true; u.food[k].material.color.setHex(c.done ? 0x6b3a1c : 0xd98c6a); });
          for (let k = d.cook.length; k < 3; k++) u.food[k].visible = false;
          u.fire.visible = any; d.hot = any; if (any) { u.fire.scale.y = 1 + Math.sin(G.clock * 12) * 0.25; lit.push(d); } break;
        }
        case 'planter': if (d.grow >= 0 && d.grow < 1) d.grow = Math.min(1, d.grow + (dt / 170) * (1 + env.rain)); u.plant.visible = d.grow >= 0; if (d.grow >= 0) u.plant.scale.setScalar(0.25 + d.grow * 0.9); break;
        case 'sail': case 'sail2': u.cloth.scale.y = damp(u.cloth.scale.y, d.open ? 1 : 0.12, 5, dt); u.cloth.scale.z = d.open ? 0.7 + Math.min(1.2, env.windSpeed / 12) + Math.sin(G.clock * 3 + d.i) * 0.08 : 0.2; break;
        case 'anchor': u.hook.visible = !d.down; break;
        case 'wheel': u.wheel.rotation.z = damp(u.wheel.rotation.z, -this.steer * 1.4, 6, dt); break;
        case 'net': u.catch.visible = d.caught.length > 0; break;
        case 'lantern': case 'beacon': u.lamp.material.emissiveIntensity = night ? (d.type === 'beacon' ? 3.5 : 2.2) : 0.15; if (night) lit.push(d); break;
        case 'engine': if (d.on && d.fuel > 0) { d.fuel -= dt / 28; d.obj.position.y = d.l * LH + Math.sin(G.clock * 40) * 0.012; if (d.fuel <= 0) { d.on = false; d.fuel = 0; this.refreshStats(); G.ui.toast('⚙️ Engine out of fuel'); } } u.light.material.emissive.setHex(d.on ? 0x2aff4a : 0xff2a1a); break;
        case 'forge': u.glow.material.emissiveIntensity = 1.2 + Math.sin(G.clock * 6) * 0.5; break;
        case 'radio': u.dial.material.emissiveIntensity = G.story && G.story.radioPending() ? 1.5 + Math.sin(G.clock * 8) * 1.2 : 0.6; break;
      }
    }
    // assign the few real lights to the lit devices nearest the player
    if (G.player) { const pp = G.player.pos; lit.sort((a, b) => a.wpos.distanceToSquared(pp) - b.wpos.distanceToSquared(pp)); }
    this.lights.forEach((l, k) => { const d = lit[k]; if (d) { l.position.set(d.i * TS, d.l * LH + DECK + (d.type === 'beacon' ? 4.4 : 1.4), d.j * TS); l.intensity = d.type === 'beacon' ? 120 : 22 + Math.sin(G.clock * 9 + k) * 2; l.color.setHex(d.type === 'beacon' ? 0x9ff8ff : 0xffb060); l.distance = d.type === 'beacon' ? 70 : 22; } else l.intensity = 0; });

    // propulsion
    const fwdx = Math.sin(this.yaw), fwdz = Math.cos(this.yaw), mass = 1 + this.nTiles / 150;
    const wind = env.windVec(_v), ws = env.windSpeed || 1, wf = clamp(ws / 7, 0.45, 2.1);
    let tx = 0, tz = 0;
    if (this.sailPow > 0) {
      const sp = 2.5 * Math.sqrt(this.sailPow) * wf;
      if (this.hasWheel) { const k = 0.62 + 0.38 * ((wind.x * fwdx + wind.z * fwdz) / ws); tx += fwdx * sp * k; tz += fwdz * sp * k; }
      else { tx += (wind.x / ws) * sp * 0.85; tz += (wind.z / ws) * sp * 0.85; }
    }
    if (this.engines > 0) { const sp = 5.6 * Math.sqrt(this.engines) * (G.player && G.player.helm ? this.throttle : 1); tx += fwdx * sp; tz += fwdz * sp; }
    if (this.paddleT > 0) { this.paddleT -= dt; tx += this.paddle.x; tz += this.paddle.z; }
    tx /= mass; tz /= mass;
    const cur = currentAt(gp.x, gp.z, _v2);
    tx += cur.x + wind.x * 0.012; tz += cur.z + wind.z * 0.012;
    if (this.anchored) { tx = 0; tz = 0; }
    this.vel.x = damp(this.vel.x, tx, this.anchored ? 1.6 : 0.55, dt); this.vel.z = damp(this.vel.z, tz, this.anchored ? 1.6 : 0.55, dt);
    this.yawVel = damp(this.yawVel, (G.player && G.player.helm ? this.steer : 0) * 0.5 / (1 + this.nTiles / 220), 2.5, dt);
    this.yaw += this.yawVel * dt;

    // shoreline: stop when the hull would ground
    let px = 0, pz = 0, hitN = 0;
    const cs = Math.cos(this.yaw), sn = Math.sin(this.yaw), ccx = gp.x + this.cx * cs + this.cz * sn, ccz = gp.z - this.cx * sn + this.cz * cs, R = this.radius + 0.5;
    for (let k = 0; k < 9; k++) {
      const a = (k / 8) * Math.PI * 2, sx = k === 8 ? ccx : ccx + Math.cos(a) * R, sz = k === 8 ? ccz : ccz + Math.sin(a) * R;
      if (terrainHeight(sx + this.vel.x * 0.5, sz + this.vel.z * 0.5) > -0.75) { px += ccx - sx; pz += ccz - sz; hitN++; }
    }
    this.aground = hitN > 0;
    if (hitN) {
      const pl = Math.hypot(px, pz);
      if (pl > 0.01) { px /= pl; pz /= pl; const vn = this.vel.x * px + this.vel.z * pz; if (vn < 0) { this.vel.x -= px * vn; this.vel.z -= pz * vn; } gp.x += px * dt * 0.8; gp.z += pz * dt * 0.8; }
      else this.vel.set(0, 0, 0);
      this.vel.multiplyScalar(Math.exp(-2 * dt));
    }
    gp.x += this.vel.x * dt; gp.z += this.vel.z * dt;

    // ride the waves
    const ext = Math.max(1.6, this.radius * 0.7);
    const hc = waveHeight(ccx, ccz), hf = waveHeight(ccx + fwdx * ext, ccz + fwdz * ext), hb = waveHeight(ccx - fwdx * ext, ccz - fwdz * ext);
    const hr = waveHeight(ccx + fwdz * ext, ccz - fwdx * ext), hl = waveHeight(ccx - fwdz * ext, ccz + fwdx * ext);
    gp.y = damp(gp.y, (hc * 2 + hf + hb + hr + hl) / 6, 6, dt);
    const pitch = clamp(Math.atan2(hb - hf, ext * 2) * 0.75, -0.2, 0.2), roll = clamp(Math.atan2(hr - hl, ext * 2) * 0.75, -0.2, 0.2);
    this.pitch = damp(this.pitch || 0, pitch, 4, dt); this.roll = damp(this.roll || 0, roll, 4, dt);
    this.group.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
    this.group.updateMatrixWorld(true);
  }

  serialize() {
    const ps = [];
    for (const p of this.pieces.values()) {
      const o = { t: p.type, i: p.i, j: p.j, l: p.l, r: p.r, hp: Math.round(p.hp) };
      for (const k of ['slots', 'cook', 'water', 'open', 'down', 'caught', 'fuel', 'on', 'grow']) if (p[k] !== undefined) o[k] = p[k];
      ps.push(o);
    }
    return { x: this.group.position.x, z: this.group.position.z, yaw: this.yaw, ps };
  }
  load(d) {
    for (const p of [...this.pieces.values()]) if (p.obj) this.devGroup.remove(p.obj);
    this.pieces.clear();
    for (const o of d.ps) { if (!PIECES[o.t]) continue; const p = { type: o.t, i: o.i, j: o.j, l: o.l, r: o.r, hp: o.hp }; for (const k of ['slots', 'cook', 'water', 'open', 'down', 'caught', 'fuel', 'on', 'grow']) if (o[k] !== undefined) p[k] = o[k]; this.add(p, true); }
    if (!this.pieces.size) this.add({ type: 'foundation', i: 0, j: 0, l: 0, r: 0 }, true);
    this.group.position.set(d.x, 0, d.z); this.yaw = d.yaw || 0; this.vel.set(0, 0, 0);
    this.rebuild(); this.group.rotation.set(0, this.yaw, 0, 'YXZ'); this.group.updateMatrixWorld(true);
  }
}
