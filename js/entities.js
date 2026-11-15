// Debris, hook, projectiles, pirates, pirate ships, turrets, storm damage and ocean events.
import * as THREE from 'three';
import { G, clamp, lerp, damp, lerpAngle, angDiff, rand, pick, emit, TAU } from './util.js';
import { makeHumanoid, animateHumanoid, makeHeld, makeShip, mesh, boxG, cylG, sphG, colMat } from './models.js';
import { mat } from './textures.js';
import { waveHeight } from './env.js';
import { terrainHeight, islandAt, rollLoot, ISLANDS, WORLD_R } from './world.js';
import { TS, LH, DECK, currentAt } from './raft.js';
import { Creatures } from './creatures.js';
import { ITEMS } from './items.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const FWD = new THREE.Vector3(0, 0, 1);
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const DEBRIS = {
  plank: { label: 'Grab plank', loot: () => ({ wood: Math.random() < 0.3 ? 2 : 1 }), w: 44 },
  leaf: { label: 'Grab palm fronds', loot: () => ({ fiber: Math.random() < 0.4 ? 2 : 1 }), w: 30 },
  bit: { label: 'Grab scrap', loot: () => ({ scrap: 1 }), w: 11 },
  barrel: { label: 'Open barrel', loot: () => { const o = { wood: 2 }; const ex = pick([{ rope: 1 }, { scrap: 2 }, { coconut: 2 }, { flask_full: 1 }, { seed: 1 }, { stone: 2 }, { fiber: 3 }, { coconut: 1, scrap: 1 }, { raw_fish: 1 }, { cloth: 1 }]); return Object.assign(o, ex); }, w: 13 },
  crate: { label: 'Open crate', loot: () => rollLoot(pick([{ scrap: [3, 5], rope: [1, 3], arrow: [3, 6] }, { ingot: [1, 2], cloth: [1, 2], bandage: 1 }, { wood: [5, 8], stone: [3, 5], flask_full: 1 }, { cooked_fish: 2, coconut: 2, seed: 2 }])), w: 2 },
};
function debrisMesh(type) {
  const g = new THREE.Group();
  if (type === 'plank') mesh(boxG(1.5, 0.08, 0.3), 'wood', 0, 0, 0, g);
  else if (type === 'leaf') { mesh(boxG(1.3, 0.03, 0.5), 'leaf', 0, 0.02, 0, g, false); mesh(boxG(1.0, 0.03, 0.4), 'leaf', 0.1, 0.04, 0.2, g, false).rotation.y = 0.8; }
  else if (type === 'bit') { mesh(boxG(0.45, 0.1, 0.35), 'metal', 0, 0, 0, g); mesh(boxG(0.5, 0.06, 0.5), 'wood_dark', 0, -0.05, 0, g); }
  else if (type === 'barrel') { const b = mesh(cylG(0.4, 0.4, 0.95, 10), 'wood', 0, 0.05, 0, g); b.rotation.z = Math.PI / 2; for (const x of [-0.3, 0.3]) mesh(cylG(0.42, 0.42, 0.06, 10), 'metal', x, 0.05, 0, g).rotation.z = Math.PI / 2; }
  else { mesh(boxG(0.95, 0.75, 0.95), 'wood', 0, 0.12, 0, g); mesh(boxG(1, 0.1, 1), 'wood_dark', 0, 0.5, 0, g); }
  return g;
}

// ---------- pirates ----------
class Pirate {
  constructor(ents, o) {
    this.ents = ents; this.captain = !!o.captain; this.ranged = !!o.ranged;
    this.h = makeHumanoid({ skin: pick([0xc68e62, 0x9a6a44, 0xdba77e, 0x7a5236]), shirt: this.captain ? 0x7a1c1c : pick([0x3d3f4a, 0x5a4a3a, 0x2f4a4a, 0x6a6a62]), pants: 0x2a2622, hat: this.captain ? 'tricorn' : 'bandana', hatColor: pick([0x8c1f1f, 0x1f3f8c, 0x222222]), beard: Math.random() < 0.7 });
    this.h.held.add(makeHeld(this.ranged ? 'bow' : 'cutlass'));
    this.h.root.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    ents.scene.add(this.h.root);
    this.pos = new THREE.Vector3(); this.local = new THREE.Vector3(); this.platform = o.platform || null; this.home = o.home || null; this.station = o.station || null;
    this.hp = this.maxHp = this.captain ? 170 : 70; this.dmg = this.captain ? 15 : 8; this.r = 0.7; this.yaw = rand(TAU);
    this.cd = rand(1, 2); this.atk = 0; this.dead = false; this.deadT = 0; this.sp = 0; this.wanderT = 0; this.kind = 'pirate'; this.idleT = 0;
    if (this.platform) this.local.copy(o.station); else this.pos.set(o.x, terrainHeight(o.x, o.z), o.z);
  }
  damage(d) {
    if (this.dead) return;
    this.hp -= d; this.alert = 12; G.ents.puff(this.pos.x, this.pos.y + 1.2, this.pos.z, 0xaa1111, 5);
    if (this.hp <= 0) {
      this.dead = true; this.deadT = 0; emit('kill', 'pirate', this.captain ? 'captain' : '');
      const loot = { gold: Math.round(rand(1, this.captain ? 8 : 3)) }; if (Math.random() < 0.6) loot.scrap = 1; if (Math.random() < 0.4) loot.arrow = 3; if (Math.random() < 0.3) loot.rope = 1; if (Math.random() < 0.12) loot.bandage = 1; if (this.captain || Math.random() < 0.07) loot.cutlass = 1;
      if (G.player.pos.distanceTo(this.pos) < 40) G.player.give(loot);
    }
  }
  update(dt, t) {
    const pl = G.player, pf = this.platform;
    if (pf) this.pos.copy(this.local).applyMatrix4(pf.group.matrixWorld);
    const d = this.pos.distanceTo(pl.pos);
    this.h.root.visible = d < 320;
    if (this.dead) { this.deadT += dt; animateHumanoid(this.h, 'dead', dt); this.h.root.position.copy(this.pos); if (this.deadT > 4) this.h.root.position.y -= (this.deadT - 4) * 0.4; return; }
    if (d > 320) return;
    this.cd -= dt; if (this.alert > 0) this.alert -= dt;
    const same = pf ? pl.platform === pf : !pl.platform && !pl.swimming;
    const aggro = !pl.dead && (d < (this.alert > 0 ? 60 : 26));
    let mode = 'idle'; this.sp = 0;
    let tx = null, tz = null, speed = 0;
    if (aggro && same && !(this.ranged && d > 7 && d < 24)) { // close in
      if (pf) { tx = pl.local.x; tz = pl.local.z; } else { tx = pl.pos.x; tz = pl.pos.z; }
      speed = d > 1.5 ? (this.captain ? 3.4 : 3.9) : 0;
    } else if (!aggro && !pf && this.home) { // wander around camp
      this.wanderT -= dt; if (this.wanderT <= 0) { this.wanderT = rand(3, 9); const a = rand(TAU), r = rand(0, this.home.r); this.wx = this.home.x + Math.sin(a) * r; this.wz = this.home.z + Math.cos(a) * r; }
      if (Math.hypot(this.wx - this.pos.x, this.wz - this.pos.z) > 1) { tx = this.wx; tz = this.wz; speed = 1.3; }
    } else if (!aggro && pf && this.station && pf !== G.raft) { if (Math.hypot(this.station.x - this.local.x, this.station.z - this.local.z) > 0.5) { tx = this.station.x; tz = this.station.z; speed = 1.5; } }
    if (pf === G.raft && !same) { this.idleT += dt; if (this.idleT > 25) { this.dead = true; this.deadT = 5; this.h.root.visible = false; G.audio.sfx('splash'); return; } } else this.idleT = 0;
    if (aggro) this.yaw = lerpAngle(this.yaw, Math.atan2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z), Math.min(1, 8 * dt));
    if (speed > 0) {
      if (pf) {
        const dx = tx - this.local.x, dz = tz - this.local.z, l = Math.hypot(dx, dz) || 1, nx = this.local.x + (dx / l) * speed * dt, nz = this.local.z + (dz / l) * speed * dt;
        const ok = pf.surfaceAt(nx, nz, this.local.y + 0.3) != null && (!pf.canMove || pf.canMove(this.local.x, this.local.z, nx, nz, this.local.y));
        if (ok) { this.local.x = nx; this.local.z = nz; const sy = pf.surfaceAt(nx, nz, this.local.y + 0.3); if (sy != null) this.local.y = sy; }
        if (!aggro) this.yaw = Math.atan2(dx, dz) + pf.group.rotation.y;
        this.pos.copy(this.local).applyMatrix4(pf.group.matrixWorld);
      } else {
        const dx = tx - this.pos.x, dz = tz - this.pos.z, l = Math.hypot(dx, dz) || 1, nx = this.pos.x + (dx / l) * speed * dt, nz = this.pos.z + (dz / l) * speed * dt, h = terrainHeight(nx, nz);
        if (h > -0.4 && h - this.pos.y < 1.1) { this.pos.x = nx; this.pos.z = nz; }
        G.world.collide(this.pos, 0.35); this.pos.y = terrainHeight(this.pos.x, this.pos.z);
        if (!aggro) this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), Math.min(1, 6 * dt));
      }
      mode = 'move'; this.sp = speed;
    } else if (!pf) this.pos.y = terrainHeight(this.pos.x, this.pos.z);
    // attacks
    if (this.atk > 0) { const b = this.atk; this.atk -= dt; if (b > 0.33 && this.atk <= 0.33 && d < 2.4 && !pl.dead) { pl.hurt(this.dmg, 'pirate'); G.audio.sfx('hit'); } }
    else if (aggro && this.cd <= 0) {
      if (same && d < 1.9) { this.atk = 0.6; this.cd = this.captain ? 1.3 : 1.8; G.audio.sfx('swing'); }
      else if (this.ranged && d < 38 && d > 4) {
        this.cd = rand(2.8, 4);
        _v.copy(pl.pos).setY(pl.pos.y + 1.1); if (pl.platform && pl.platform.vel) _v.addScaledVector(pl.platform.vel, d / 30);
        _v.x += rand(-1, 1) * d * 0.035; _v.z += rand(-1, 1) * d * 0.035; _v.y += d * d * 0.0039;
        _v2.copy(this.pos).setY(this.pos.y + 1.5); _v.sub(_v2).normalize();
        this.ents.shootArrow(_v2, _v, 11, 'pirate'); this.atk = 0.4; G.audio.sfx('bow', 0.4);
      }
    }
    animateHumanoid(this.h, mode, dt, this.sp / 6, this.atk > 0 ? 1 - this.atk / 0.6 : 0, t);
    this.h.root.position.copy(this.pos); this.h.root.rotation.y = this.yaw;
  }
  dispose() { this.ents.scene.remove(this.h.root); }
}

// ---------- pirate ships ----------
const SHIPS = [
  { id: 's1', size: 1, crew: 3, hp: 300, route: [[1650, -1380], [2130, -900], [1650, -420], [1170, -900]], name: 'Sloop' },
  { id: 's2', size: 1, crew: 3, hp: 300, route: [[1250, 150], [1500, -250], [1950, 50], [1500, 620]], name: 'Sloop' },
  { id: 's3', size: 2, crew: 5, hp: 620, route: [[2000, -1500], [2600, -1900], [2300, -2400], [1500, -1900]], name: 'Brig' },
  { id: 's4', size: 2, crew: 5, hp: 620, route: [[1500, 1100], [1100, 1500], [1700, 2100], [2100, 1300]], name: 'Brig' },
  { id: 's5', size: 3, crew: 8, hp: 1400, route: [[2500, 950], [3050, 1500], [2500, 2050], [1950, 1500]], name: 'the Dread Tide', boss: true },
];
class Ship {
  constructor(ents, def) {
    this.ents = ents; this.def = def; this.id = def.id; this.size = def.size; this.boss = !!def.boss;
    this.info = makeShip(def.size, def.boss ? { sail: 0x5a0f0f, tint: 0x8a7a7a } : {});
    this.group = this.info.group; ents.scene.add(this.group); this.group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    this.hp = this.maxHp = def.hp; this.state = 'patrol'; this.wp = 0; this.yaw = 0; this.speed = 0; this.vel = new THREE.Vector3();
    this.cannonCd = rand(3, 6); this.attackT = 0; this.lostT = 0; this.sink = 0; this.crew = []; this.name = def.id; this.fixed = false;
    this.group.position.set(def.route[0][0], 0, def.route[0][1]);
    this.maxSp = [0, 5.4, 4.9, 4.5][def.size];
    this.spawnCrew(def.crew);
    this.chestId = 'ship_' + def.id;
  }
  spawnCrew(n) {
    const I = this.info;
    for (let i = 0; i < n; i++) {
      const st = new THREE.Vector3(rand(-1, 1) * I.halfW * 0.7, I.deckY, lerp(I.z0 + 1.5, I.z1 - 1, n === 1 ? 0.5 : i / (n - 1)));
      const p = new Pirate(this.ents, { platform: this, station: st, ranged: i % 2 === 1, captain: this.boss && i === 0 });
      p.ship = this; this.crew.push(p); this.ents.pirates.push(p);
    }
  }
  get alive() { return this.crew.filter((c) => !c.dead && c.platform === this).length; }
  // platform interface
  surfaceAt(lx, lz, ly) { const I = this.info; if (this.state === 'sinking') return null; if (Math.abs(lx) < I.halfW && lz > I.z0 - 0.3 && lz < I.z1 && ly > I.deckY - 1.2) return I.deckY; return null; }
  climb(lx, lz) { const I = this.info; if (this.state === 'sinking') return null; if (Math.abs(lx) < I.beam / 2 + 2 && lz > I.z0 - 1 && lz < I.z1 + 1) return new THREE.Vector3(clamp(lx, -I.halfW + 0.5, I.halfW - 0.5), I.deckY, clamp(lz, I.z0 + 0.4, I.z1 - 0.6)); return null; }
  damage(d, by) {
    if (this.state === 'sinking' || this.state === 'ally') return;
    this.hp -= d; if (this.state === 'patrol') { this.state = 'chase'; this.lostT = 0; }
    if (this.hp <= 0) this.startSink();
  }
  startSink() {
    this.state = 'sinking'; this.sink = 0; G.audio.sfx('break'); emit('kill', 'ship', this.boss ? 'boss' : this.size);
    for (const c of this.crew) if (!c.dead && c.platform === this) { c.dead = true; c.deadT = 3; }
    if (G.player.platform === this) G.player.detach();
    const p = this.group.position;
    for (let i = 0; i < 2 + this.size * 2; i++) this.ents.spawnDebris('crate', p.x + rand(-8, 8), p.z + rand(-8, 8), this.boss ? { titanium: [3, 5], gold: [8, 14], circuit: [1, 3], crystal: [0, 2] } : { gold: [3, 7], scrap: [2, 5], ingot: [0, 2], rope: [1, 3], arrow: [2, 6] }, 400);
    G.ui.banner(this.boss ? 'The Dread Tide is sunk!' : 'Pirate ship sunk', 'Salvage floats on the water');
  }
  update(dt, t) {
    const gp = this.group.position, pl = G.player, raft = G.raft, rp = raft.group.position, I = this.info;
    const dPl = d2(gp, pl.pos);
    this.group.visible = dPl < 2600;
    if (this.state === 'sinking') { this.sink += dt; gp.y = -this.sink * 0.7; this.group.rotation.set(0.1 * this.sink * 0.3, this.yaw, Math.min(0.9, this.sink * 0.09), 'YXZ'); if (this.sink > 16) { this.group.visible = false; this.state = 'gone'; this.respawn = G.clock + (this.boss ? 1e9 : 1500); } this.group.updateMatrixWorld(true); return; }
    if (this.state === 'gone') { if (G.clock > this.respawn && dPl > 900) this.reset(); return; }
    let tx, tz, want = 0;
    const crew = this.alive;
    if (crew === 0 && this.state !== 'ally' && this.state !== 'derelict') { this.state = 'derelict'; emit('derelict', this); if (dPl < 300) G.ui.toast('The pirate crew is beaten. Their ship lies adrift — board it!'); }
    const target = pl.platform === this ? null : pl.pos;
    switch (this.state) {
      case 'patrol': {
        const w = this.def.route[this.wp]; tx = w[0]; tz = w[1]; want = 3;
        if (Math.hypot(tx - gp.x, tz - gp.z) < 40) this.wp = (this.wp + 1) % this.def.route.length;
        if (!pl.dead && dPl < 250 && G.prog.stage >= 2 && islandAt(pl.pos.x, pl.pos.z, 1.05) == null) { this.state = 'chase'; this.attackT = 0; G.ui.banner('Pirates!', `A pirate ${this.def.name.replace('the ', '')} has spotted you`); G.audio.sfx('alarm'); emit('piratespotted'); }
        break;
      }
      case 'chase': {
        if (pl.dead || dPl > 460) { this.lostT += dt; if (this.lostT > 12) { this.state = 'patrol'; this.lostT = 0; } } else this.lostT = 0;
        this.attackT += dt;
        const boarding = this.attackT > 38 && pl.platform === raft && crew > 1;
        const ring = boarding ? raft.radius + I.beam * 0.5 + 2.5 : 42 + this.size * 6;
        // circle the raft broadside-on
        const ax = gp.x - rp.x, az = gp.z - rp.z, al = Math.hypot(ax, az) || 1, a0 = Math.atan2(ax, az) + (boarding ? 0.25 : 0.5);
        tx = rp.x + Math.sin(a0) * ring; tz = rp.z + Math.cos(a0) * ring;
        want = al > ring + 30 ? this.maxSp : boarding && al < ring + 4 ? Math.hypot(raft.vel.x, raft.vel.z) : this.maxSp * 0.6;
        // cannons
        this.cannonCd -= dt;
        if (this.cannonCd <= 0 && al < 120 && !pl.dead && !boarding) {
          this.cannonCd = rand(4.2, 6.5) / Math.sqrt(this.size);
          const side = (ax * Math.cos(this.yaw) - az * Math.sin(this.yaw)) > 0 ? -1 : 1;
          const cs = I.cannons.filter((c) => Math.sign(c.x) === side); const c = pick(cs.length ? cs : I.cannons);
          _v.copy(c).applyMatrix4(this.group.matrixWorld);
          const err = 2.5 + al * 0.07; _v2.set(rp.x + raft.cx + raft.vel.x * 1.5 + rand(-err, err), 0.3, rp.z + raft.cz + raft.vel.z * 1.5 + rand(-err, err));
          if (pl.platform !== raft && Math.random() < 0.5) _v2.set(pl.pos.x + rand(-err, err), 0.3, pl.pos.z + rand(-err, err));
          this.ents.fireCannon(_v, _v2, 'pirate');
        }
        // boarding
        if (boarding && al < ring + 6) {
          this.boardCd = (this.boardCd || 0) - dt;
          if (this.boardCd <= 0) { this.boardCd = 4; const c = this.crew.find((k) => !k.dead && k.platform === this && !k.ranged) || this.crew.find((k) => !k.dead && k.platform === this); const edge = raft.edgeFoundations(); if (c && edge.length && this.crew.filter((k) => !k.dead && k.platform === raft).length < 3) { let best = edge[0], bd = 1e9; for (const e of edge) { raft.worldOf(e, _v); const dd = d2(_v, gp); if (dd < bd) { bd = dd; best = e; } } c.platform = raft; c.local.set(best.i * TS, DECK, best.j * TS); c.alert = 30; G.ui.toast('☠️ Pirates are boarding the raft!'); G.audio.sfx('climb'); emit('boarded'); } }
        }
        break;
      }
      case 'ally': { // follows astern of the raft
        const fx = Math.sin(raft.yaw), fz = Math.cos(raft.yaw); tx = rp.x - fx * (34 + raft.radius) + fz * 14; tz = rp.z - fz * (34 + raft.radius) - fx * 14;
        const dd = Math.hypot(tx - gp.x, tz - gp.z); want = dd > 10 ? Math.min(this.maxSp + 2.5, dd * 0.3) : 0;
        this.cannonCd -= dt;
        if (this.cannonCd <= 0) { this.cannonCd = 5; let foe = null, fd = 150; for (const s of this.ents.ships) if (s !== this && (s.state === 'chase' || s.state === 'patrol') && d2(s.group.position, gp) < fd) { fd = d2(s.group.position, gp); foe = s; } if (foe) { _v.copy(pick(I.cannons)).applyMatrix4(this.group.matrixWorld); _v2.copy(foe.group.position).setY(1.5); _v2.x += rand(-4, 4); _v2.z += rand(-4, 4); this.ents.fireCannon(_v, _v2, 'ally'); } }
        break;
      }
      default: want = 0; // derelict
    }
    // steering with island avoidance
    if (want > 0 && tx !== undefined) {
      let desired = Math.atan2(tx - gp.x, tz - gp.z);
      const look = 45 + this.size * 10, ahx = gp.x + Math.sin(this.yaw) * look, ahz = gp.z + Math.cos(this.yaw) * look;
      if (terrainHeight(ahx, ahz) > -5 || terrainHeight(gp.x + Math.sin(this.yaw) * 18, gp.z + Math.cos(this.yaw) * 18) > -5) { const isl = islandAt(ahx, ahz, 2.2); if (isl) { const away = Math.atan2(gp.x - isl.x, gp.z - isl.z); desired = away + (angDiff(away, this.yaw) > 0 ? 1.1 : -1.1); want = Math.min(want, 2.5); } }
      this.yaw += clamp(angDiff(this.yaw, desired), -1, 1) * (0.5 - this.size * 0.07) * dt;
    }
    if (this.state !== 'sinking') { // never ram through the raft
      const rx = gp.x - (rp.x + raft.cx), rz = gp.z - (rp.z + raft.cz), rl = Math.hypot(rx, rz) || 1, min = raft.radius + I.beam * 0.5 + 1.5;
      if (rl < min) { gp.x += (rx / rl) * (min - rl) * Math.min(1, dt * 3); gp.z += (rz / rl) * (min - rl) * Math.min(1, dt * 3); want = Math.min(want, 1); }
      else if (rl < min + 14 && this.state === 'chase' && (rx * Math.sin(this.yaw) + rz * Math.cos(this.yaw)) < 0) this.yaw += (angDiff(this.yaw, Math.atan2(rx, rz)) > 0 ? 1 : -1) * 0.5 * dt;
    }
    this.speed = damp(this.speed, want, 0.5, dt);
    this.vel.set(Math.sin(this.yaw) * this.speed, 0, Math.cos(this.yaw) * this.speed);
    const nx = gp.x + this.vel.x * dt, nz = gp.z + this.vel.z * dt;
    if (terrainHeight(nx, nz) < -3.5) { gp.x = nx; gp.z = nz; } else this.speed *= 0.9;
    const h = waveHeight(gp.x, gp.z), hf = waveHeight(gp.x + Math.sin(this.yaw) * I.len * 0.4, gp.z + Math.cos(this.yaw) * I.len * 0.4), hs = waveHeight(gp.x + Math.cos(this.yaw) * I.beam, gp.z - Math.sin(this.yaw) * I.beam);
    gp.y = damp(gp.y, h * 0.6 + 0.1, 3, dt);
    this.group.rotation.set(clamp((h - hf) * 0.05, -0.12, 0.12), this.yaw, clamp((hs - h) * 0.07, -0.15, 0.15) + Math.sin(t * 0.7 + this.size) * 0.02, 'YXZ');
    for (const s of I.sails) s.scale.y = damp(s.scale.y, this.state === 'derelict' ? 0.25 : 1, 1, dt);
    if (I.flag) I.flag.rotation.y = Math.sin(t * 3) * 0.3;
    this.group.updateMatrixWorld(true);
  }
  reset() {
    for (const c of this.crew) { c.dispose(); const k = this.ents.pirates.indexOf(c); if (k >= 0) this.ents.pirates.splice(k, 1); }
    this.crew = []; this.hp = this.maxHp; this.state = 'patrol'; this.wp = 0; this.group.visible = true; this.group.position.set(this.def.route[0][0], 0, this.def.route[0][1]); this.group.rotation.set(0, 0, 0);
    this.spawnCrew(this.def.crew); delete G.prog.looted[this.chestId];
  }
  capture(silent) {
    this.state = 'ally'; for (const s of this.info.sails) s.material = mat('cloth'); if (this.info.flag) this.info.flag.material = mat('plain', { color: 0x2f7fd0, side: THREE.DoubleSide });
    if (!silent) { G.ui.banner('Vessel captured', 'It will follow your raft and fight beside you'); emit('capture', this); }
  }
}

export class Ents {
  constructor(scene) {
    G.ents = this; this.scene = scene;
    this.debris = []; this.debT = 2; this.driftA = rand(TAU);
    this.arrows = []; this.balls = []; this.puffs = [];
    this.arrowG = new THREE.CylinderGeometry(0.018, 0.018, 0.9, 5).rotateX(Math.PI / 2); this.arrowM = mat('wood_dark');
    this.ballG = new THREE.SphereGeometry(0.24, 8, 6); this.ballM = colMat(0x15171a, { metalness: 0.6, roughness: 0.5 });
    this.puffG = new THREE.SphereGeometry(0.16, 5, 4);
    // hook
    this.hook = mesh(sphG(0.13, 6, 5), 'metal', 0, 0, 0, scene); this.hook.visible = false; this.hookOut = false; this.hookVel = new THREE.Vector3(); this.hookFloat = false; this.hooked = []; this.reeling = false;
    this.rope = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: 0xcdb88a }));
    this.rope.frustumCulled = false; this.rope.visible = false; scene.add(this.rope);
    this.creatures = new Creatures(scene);
    this.pirates = []; this.ships = SHIPS.map((d) => new Ship(this, d));
    for (const c of G.world.pirateCamps) this.spawnCamp(c);
    this.raider = null;
    this.stormT = 8; this.stormWarned = false; this.eventT = 200; this.turretCd = new Map(); this.lastWeather = 'clear';
    this.flare = mesh(cylG(0.05, 0.05, 14, 5), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.7 }), 0, 0, 0, scene, false); this.flare.visible = false;
  }
  spawnCamp(c) {
    c.members = [];
    for (let i = 0; i < c.n; i++) { const a = rand(TAU), r = rand(2, c.r); const p = new Pirate(this, { x: c.x + Math.sin(a) * r, z: c.z + Math.cos(a) * r, home: c, ranged: i % 3 === 2, captain: c.captain && i === 0 }); p.camp = c; c.members.push(p); this.pirates.push(p); }
  }
  dangerNear() {
    const P = G.player.pos;
    for (const p of this.pirates) if (!p.dead && p.pos.distanceTo(P) < 40) return true;
    for (const s of this.ships) if (s.state === 'chase' && d2(s.group.position, P) < 300) return true;
    return false;
  }

  // ---------- debris ----------
  spawnDebris(type, x, z, loot, life = 150) {
    const g = debrisMesh(type); g.position.set(x, 0, z); g.rotation.y = rand(TAU); this.scene.add(g);
    const d = { type, g, x, z, loot, life, seed: rand(10), pos: g.position };
    this.debris.push(d); return d;
  }
  takeDebris(d, silent) {
    const k = this.debris.indexOf(d); if (k < 0) return null;
    this.debris.splice(k, 1); this.scene.remove(d.g);
    const loot = d.loot ? rollLoot(d.loot) : DEBRIS[d.type].loot();
    if (!silent) { G.player.give(loot); G.audio.sfx('pickup'); emit('debris', d.type); if (d.flare) this.flare.visible = false; }
    return loot;
  }
  updateDebris(dt) {
    const raft = G.raft, rp = raft.group.position, P = G.player.pos;
    this.driftA += dt * 0.01;
    const dvx = Math.sin(this.driftA) * 0.95, dvz = Math.cos(this.driftA) * 0.95;
    this.debT -= dt;
    const nearLand = islandAt(rp.x, rp.z, 1.25);
    if (this.debT <= 0 && this.debris.length < (nearLand ? 6 : 22)) {
      this.debT = rand(1.0, 2.4);
      // spawn upstream of the raft so things float toward it
      let rx = dvx - raft.vel.x * 0.9, rz = dvz - raft.vel.z * 0.9; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
      const lat = rand(-13, 13) * (1 + raft.radius / 12), dist = rand(22, 42) + raft.radius, x = rp.x - rx * dist + rz * lat, z = rp.z - rz * dist - rx * lat;
      if (terrainHeight(x, z) < -2) { let r = Math.random() * 100, type = 'plank'; for (const [k, v] of Object.entries(DEBRIS)) { if (r < v.w) { type = k; break; } r -= v.w; } this.spawnDebris(type, x, z); }
    }
    const nets = raft.devs.filter((d) => d.type === 'net' && d.caught.length < 12);
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]; d.life -= dt;
      if (!d.hooked) { const c = currentAt(d.x, d.z, _v); d.x += (c.x + dvx) * dt; d.z += (c.z + dvz) * dt; }
      const y = waveHeight(d.x, d.z); d.g.position.set(d.x, y - 0.03, d.z); d.g.rotation.z = Math.sin(G.clock * 1.2 + d.seed) * 0.12; d.g.rotation.x = Math.cos(G.clock * 0.9 + d.seed) * 0.1;
      const far = Math.hypot(d.x - rp.x, d.z - rp.z);
      if ((d.life <= 0 && far > 14) || far > (d.keep ? 200 : 60 + raft.radius) || terrainHeight(d.x, d.z) > -0.4) { if (!d.keep || d.life <= 0) { this.debris.splice(i, 1); this.scene.remove(d.g); if (d.flare) this.flare.visible = false; continue; } }
      for (const n of nets) if (!d.hooked && !d.loot && Math.hypot(d.x - n.wpos.x, d.z - n.wpos.z) < 1.5) { const loot = this.takeDebris(d, true); for (const [id, k] of Object.entries(loot)) for (let q = 0; q < k; q++) n.caught.push(id); emit('netcatch'); break; }
      if (d.flare) this.flare.position.set(d.x, y + 7, d.z);
    }
  }

  // ---------- hook ----------
  throwHook(org, dir) { this.hook.position.copy(org); this.hookVel.copy(dir).multiplyScalar(17); this.hookOut = true; this.hookFloat = false; this.hooked.length = 0; this.hook.visible = this.rope.visible = true; }
  cancelHook() { for (const d of this.hooked) d.hooked = false; this.hooked.length = 0; this.hookOut = false; this.hook.visible = this.rope.visible = false; this.reeling = false; }
  updateHook(dt) {
    if (!this.hookOut) return;
    const pl = G.player, h = this.hook.position;
    _v.copy(pl.pos).setY(pl.pos.y + 1.2);
    if (!this.hookFloat) {
      this.hookVel.y -= 14 * dt; h.addScaledVector(this.hookVel, dt);
      if (h.y <= waveHeight(h.x, h.z)) { this.hookFloat = true; G.audio.sfx('plop'); this.puff(h.x, h.y + 0.1, h.z, 0xffffff, 4); }
      if (h.y < terrainHeight(h.x, h.z) + 0.1) this.hookFloat = true;
    } else {
      if (this.reeling) { _v2.copy(_v).sub(h); _v2.y = 0; const l = _v2.length(); if (l > 0.01) h.addScaledVector(_v2, Math.min(1, (7.5 * dt) / l)); }
      h.y = waveHeight(h.x, h.z) + 0.02;
      for (const d of this.debris) if (!d.hooked && Math.hypot(d.x - h.x, d.z - h.z) < 1.7) { d.hooked = true; this.hooked.push(d); G.audio.sfx('plop'); }
      for (const d of this.hooked) { d.x = damp(d.x, h.x, 8, dt); d.z = damp(d.z, h.z, 8, dt); }
      const dist = Math.hypot(h.x - _v.x, h.z - _v.z);
      if (dist < 2.1 && this.reeling) { for (const d of [...this.hooked]) this.takeDebris(d); if (this.hooked.length) emit('hooked'); this.cancelHook(); return; }
      if (dist > 34) { this.cancelHook(); return; }
    }
    const p = this.rope.geometry.attributes.position; pl.h.held.getWorldPosition(_v3); p.setXYZ(0, _v3.x, _v3.y, _v3.z); p.setXYZ(1, h.x, h.y, h.z); p.needsUpdate = true;
  }

  // ---------- projectiles ----------
  shootArrow(org, dir, dmg, owner, speed = 34) {
    const m = new THREE.Mesh(this.arrowG, this.arrowM); m.position.copy(org); this.scene.add(m);
    this.arrows.push({ m, vel: dir.clone().multiplyScalar(speed), dmg, owner, life: 4 });
  }
  fireCannon(org, target, owner) {
    const m = new THREE.Mesh(this.ballG, this.ballM); m.position.copy(org); this.scene.add(m);
    const dist = Math.hypot(target.x - org.x, target.z - org.z), T = Math.max(0.9, dist / 30), g = 12;
    const vel = new THREE.Vector3((target.x - org.x) / T, (target.y - org.y) / T + 0.5 * g * T, (target.z - org.z) / T);
    this.balls.push({ m, vel, owner, life: 8, g });
    G.audio.sfx('cannon', clamp(1 - d2(org, G.player.pos) / 300, 0.15, 1)); this.puff(org.x, org.y, org.z, 0xdddddd, 8);
  }
  updateProjectiles(dt) {
    const pl = G.player, raft = G.raft;
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i], p = a.m.position; a.life -= dt; a.vel.y -= 9 * dt;
      const steps = 2; let hit = false;
      for (let s = 0; s < steps && !hit; s++) {
        p.addScaledVector(a.vel, dt / steps);
        if (a.owner === 'pirate') { if (!pl.dead && Math.hypot(p.x - pl.pos.x, p.z - pl.pos.z) < 0.5 && p.y > pl.pos.y && p.y < pl.pos.y + 1.9) { pl.hurt(a.dmg, 'pirate'); hit = true; } }
        else {
          for (const t of this.targetList()) { const ty = t.pos.y + (t.kind === 'pirate' ? 1 : 0.3); if (Math.hypot(p.x - t.pos.x, p.y - ty, p.z - t.pos.z) < t.r + 0.35) { t.damage(a.dmg, a.owner); hit = true; G.audio.sfx('hit', 0.6); break; } }
          if (!hit) for (const sh of this.ships) if (sh.state !== 'gone' && sh.state !== 'sinking' && sh.state !== 'ally' && sh.state !== 'derelict') { _v.copy(p).applyMatrix4(_m.copy(sh.group.matrixWorld).invert()); if (Math.abs(_v.x) < sh.info.beam / 2 && Math.abs(_v.z) < sh.info.len / 2 && _v.y > -2 && _v.y < sh.info.deckY + 2.2) { sh.damage(a.owner === 'turret' ? 42 : 5, a.owner); hit = true; this.puff(p.x, p.y, p.z, 0x8a6a40, 5); break; } }
        }
        if (p.y < terrainHeight(p.x, p.z) || p.y < waveHeight(p.x, p.z) - 0.4) hit = true;
      }
      a.m.lookAt(_v.copy(p).add(a.vel));
      if (hit || a.life <= 0) { this.scene.remove(a.m); this.arrows.splice(i, 1); }
    }
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i], p = b.m.position; b.life -= dt; b.vel.y -= b.g * dt; p.addScaledVector(b.vel, dt);
      let boom = false;
      if (b.owner === 'pirate') {
        raft.toLocal(p, _v);
        const ti = Math.round(_v.x / TS), tj = Math.round(_v.z / TS), lv = raft.levelOf(Math.max(DECK, _v.y));
        if (b.vel.y < 0 && _v.y < raft.topLevel * LH + DECK + 2.4 && _v.y > -0.5) {
          for (let l = raft.topLevel; l >= 0 && !boom; l--) if (_v.y <= l * LH + DECK + 0.4 || l === 0) {
            const tl = raft.tile(ti, tj, l) || raft.pieces.get(`R${ti},${tj},${l}`);
            if (tl && _v.y <= l * LH + DECK + (tl.slot === 'R' ? LH + 0.3 : 0.4)) {
              boom = true; raft.damage(tl, 38, 'cannon');
              for (let r = 0; r < 4; r++) { const e = raft.edge(ti, tj, l, r); if (e && Math.random() < 0.5) raft.damage(e, 45, 'cannon'); }
              const c = raft.pieces.get(`C${ti},${tj},${l}`); if (c && (c.type === 'sail' || c.type === 'sail2') && Math.random() < 0.3) raft.damage(c, 80, 'cannon');
              emit('cannonhit');
            }
          }
        }
      } else for (const sh of this.ships) if (sh.state === 'chase' || sh.state === 'patrol') { _v.copy(p).applyMatrix4(_m.copy(sh.group.matrixWorld).invert()); if (Math.abs(_v.x) < sh.info.beam / 2 + 0.5 && Math.abs(_v.z) < sh.info.len / 2 && _v.y < sh.info.deckY + 2.5 && _v.y > -2) { sh.damage(70, 'ally'); boom = true; } }
      const wh = waveHeight(p.x, p.z);
      if (!boom && (p.y < wh || p.y < terrainHeight(p.x, p.z))) { boom = true; this.puff(p.x, wh + 0.3, p.z, 0xffffff, 10); G.audio.sfx('splash', clamp(1 - d2(p, pl.pos) / 80, 0, 1)); }
      else if (boom) { this.puff(p.x, p.y, p.z, 0x8a6a40, 10); G.audio.sfx('break', clamp(1.2 - d2(p, pl.pos) / 60, 0.2, 1)); }
      if (boom && b.owner === 'pirate' && !pl.dead) { const dd = p.distanceTo(_v2.copy(pl.pos).setY(pl.pos.y + 1)); if (dd < 3.2) pl.hurt(24 * (1 - dd / 4), 'cannon'); }
      if (boom || b.life <= 0) { this.scene.remove(b.m); this.balls.splice(i, 1); }
    }
  }
  targetList() { const l = this.creatures.targets.slice(); for (const p of this.pirates) if (!p.dead && p.h.root.visible) l.push(p); return l; }
  melee(org, dir, reach, dmg) {
    let best = null, bd = 1e9;
    for (const t of this.targetList()) {
      const dx = t.pos.x - org.x, dz = t.pos.z - org.z, dy = t.pos.y + (t.kind === 'pirate' ? 1 : 0.2) - org.y, d = Math.hypot(dx, dy, dz);
      if (d > reach + t.r) continue; const hd = Math.hypot(dx, dz);
      if (hd > 0.5 && (dx * dir.x + dz * dir.z) / hd < 0.3) continue;
      if (d < bd) { bd = d; best = t; }
    }
    if (best) { best.damage(dmg, 'player'); return true; }
    return false;
  }
  puff(x, y, z, color, n = 5) {
    for (let i = 0; i < n && this.puffs.length < 90; i++) {
      const m = new THREE.Mesh(this.puffG, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })); m.position.set(x, y, z); this.scene.add(m);
      this.puffs.push({ m, v: new THREE.Vector3(rand(-1.6, 1.6), rand(0.6, 3), rand(-1.6, 1.6)), life: rand(0.4, 0.8) });
    }
  }

  // ---------- turrets ----------
  updateTurrets(dt) {
    const raft = G.raft;
    for (const d of raft.devs) {
      if (d.type !== 'turret') continue;
      let cd = (this.turretCd.get(d.key) || 0) - dt; let best = null, bd = 60, by = 0;
      for (const p of this.pirates) if (!p.dead && p.h.root.visible) { const dd = p.pos.distanceTo(d.wpos); if (dd < bd) { bd = dd; best = p; by = 1; } }
      if (!best) for (const s of this.creatures.sharks) if (!s.dead && s.pos.y > -2.5 && (s.state === 'biteraft' || s.state === 'hunt')) { const dd = s.pos.distanceTo(d.wpos); if (dd < 16 && dd < bd) { bd = dd; best = s; by = 0; } }
      if (!best) for (const s of this.ships) if (s.state === 'chase') { const dd = d2(s.group.position, d.wpos); if (dd < 75 && dd < bd + 20) { bd = dd; best = { pos: s.group.position }; by = 1.5; } }
      if (best) {
        _v.copy(best.pos).setY(best.pos.y + by).sub(d.wpos); const dist = _v.length(); _v.y += dist * dist * 0.0021; _v.normalize();
        const head = d.obj.userData.head; head.rotation.y = lerpAngle(head.rotation.y, Math.atan2(_v.x, _v.z) - raft.yaw - (d.r * Math.PI) / 2, Math.min(1, dt * 6)); head.rotation.x = -Math.asin(clamp(_v.y, -1, 1));
        if (cd <= 0) { cd = 2.4; this.shootArrow(_v2.copy(d.wpos).setY(d.wpos.y + 0.6).addScaledVector(_v, 1), _v, 40, 'turret', 46); G.audio.sfx('bow', 0.7); }
      }
      this.turretCd.set(d.key, cd);
    }
  }

  // ---------- storms & events ----------
  updateStorm(dt) {
    const env = G.env, raft = G.raft;
    if (env.weather !== this.lastWeather) {
      if (['storm', 'tropical', 'hurricane'].includes(this.lastWeather) && !G.player.dead) emit('stormsurvived', this.lastWeather);
      this.lastWeather = env.weather; this.stormWarned = false;
    }
    if (!env.isStorm) return;
    this.stormT -= dt;
    if (this.stormT > 0) return;
    const pow = { storm: 1, tropical: 1.7, hurricane: 2.7 }[env.weather]; this.stormT = rand(9, 15) / Math.sqrt(pow);
    const cands = [];
    for (const p of raft.pieces.values()) {
      const exposed = !(raft.tile(p.i, p.j, p.l + 1) || raft.pieces.get(`R${p.i},${p.j},${p.l}`));
      let w = 0;
      if (p.type === 'sail' || p.type === 'sail2') w = p.open ? 6 : 1; else if (p.slot === 'R') w = 3; else if (p.slot === 'E') w = exposed ? 2.5 : 0.6; else if (p.slot === 'T' && p.l === 0) w = 0.5; else if (p.slot === 'T') w = 1; else if (p.slot === 'C' && exposed && ['collector', 'lantern', 'planter', 'net'].includes(p.type)) w = 1.2;
      if (w) cands.push([p, w]);
    }
    if (!cands.length) return;
    let tot = 0; for (const c of cands) tot += c[1]; let r = Math.random() * tot, tgt = cands[0][0]; for (const c of cands) { r -= c[1]; if (r <= 0) { tgt = c[0]; break; } }
    const lost = raft.damage(tgt, rand(9, 17) * pow, 'storm'); G.audio.sfx('creak');
    if (lost) G.ui.toast('🌀 The storm ripped away a ' + (tgt.type.startsWith('sail') ? 'sail' : 'piece of the raft') + '!');
    else if (!this.stormWarned) { this.stormWarned = true; G.ui.toast('⛈️ The storm is battering the raft. Furl sails, repair with the hammer.'); }
  }
  updateEvents(dt) {
    const env = G.env, raft = G.raft, rp = raft.group.position, pr = G.prog;
    this.eventT -= dt;
    if (this.eventT > 0 || G.player.dead) return;
    this.eventT = rand(140, 250);
    const deep = terrainHeight(rp.x, rp.z) < -20, opts = [];
    if (deep) opts.push('supply', 'supply', 'dolphins', 'whale', 'vessel');
    if (env.day >= 2 && !env.isStorm) opts.push('squall', 'swell');
    if (env.day >= 6 && Math.random() < 0.3) opts.push('hurricane');
    if (pr.stage >= 3 && deep && !this.raider && !this.ships.some((s) => s.state === 'chase')) opts.push('raid', 'raid');
    if (deep && env.night > 0.5 && pr.stage >= 2) opts.push('pack');
    if (!opts.length) return;
    const ev = pick(opts), a = rand(TAU);
    switch (ev) {
      case 'supply': { const d = this.spawnDebris('crate', rp.x + Math.sin(a) * rand(55, 90), rp.z + Math.cos(a) * rand(55, 90), { ingot: [1, 3], rope: [2, 4], cloth: [1, 3], flask_full: 1, cooked_fish: [1, 2], arrow: [4, 8], circuit: [0, 1] }, 260); d.keep = true; d.flare = true; this.flare.visible = true; G.ui.toast('📦 A supply crate is drifting nearby. Look for the red marker.'); break; }
      case 'dolphins': this.creatures.callDolphins(); G.ui.toast('🐬 Dolphins race alongside the raft'); G.audio.sfx('dolphin'); break;
      case 'whale': this.creatures.callWhale(); break;
      case 'vessel': { const x = rp.x + Math.sin(a) * 120, z = rp.z + Math.cos(a) * 120; if (terrainHeight(x, z) < -5) { const d = this.spawnDebris('crate', x, z, { wood: [8, 14], scrap: [4, 7], rope: [2, 4], cloth: [2, 3], gold: [1, 4] }, 320); d.keep = true; const s = makeShip(0, {}); s.group.scale.setScalar(0.9); d.g.clear(); d.g.add(s.group); d.label = 'Search drifting supply boat'; G.ui.toast('🛶 An abandoned supply boat drifts on the horizon'); } break; }
      case 'squall': env.setWeather('storm', rand(90, 150)); G.ui.banner('Sudden squall', 'The sky turns black without warning'); break;
      case 'swell': env.setWeather('swell', rand(70, 110)); G.ui.banner('Great swells', 'Mountains of water roll in from the deep'); break;
      case 'hurricane': env.setWeather('hurricane', rand(100, 150)); G.ui.banner('HURRICANE', 'Furl your sails and hold on'); G.audio.sfx('alarm'); break;
      case 'raid': this.spawnRaider(a); break;
      case 'pack': this.creatures.callPack(); G.ui.toast('🦈 Shapes circle beneath the raft…'); break;
    }
    emit('event', ev);
  }
  spawnRaider(a) {
    const rp = G.raft.group.position, x = rp.x + Math.sin(a) * 330, z = rp.z + Math.cos(a) * 330;
    if (terrainHeight(x, z) > -8 || islandAt(x, z, 1.6)) return;
    const s = new Ship(this, { id: 'raider', size: 1, crew: 3, hp: 280, route: [[x, z]], name: 'raider' });
    s.state = 'chase'; s.yaw = a + Math.PI; s.raider = true; this.ships.push(s); this.raider = s;
    G.ui.banner('Pirate raiders!', 'A sloop is bearing down on your raft'); G.audio.sfx('alarm'); emit('piratespotted');
  }

  interactables(P) {
    const out = [];
    for (const d of this.debris) if (Math.abs(d.x - P.x) < 4 && Math.abs(d.z - P.z) < 4) out.push({ pos: d.pos, r: d.loot ? 4 : 3.1, label: d.label || DEBRIS[d.type].label, use: () => this.takeDebris(d) });
    for (const s of this.ships) {
      if (s.state !== 'derelict' && s.state !== 'ally') continue; if (d2(s.group.position, P) > 40) continue;
      if (!G.prog.looted[s.chestId]) out.push({ pos: _v.copy(s.info.chest).applyMatrix4(s.group.matrixWorld).clone().setY(s.group.position.y + s.info.deckY + 0.8), r: 2.6, label: "Loot the ship's hold", use: () => { G.prog.looted[s.chestId] = 1; G.audio.sfx('chest'); G.player.give(rollLoot(s.boss ? { gold: [30, 40], titanium: [6, 8], circuit: [3, 5], crystal: 3, cutlass: 1 } : s.size === 2 ? { gold: [14, 20], ingot: [5, 8], cloth: [4, 6], arrow: 12, circuit: [1, 2] } : { gold: [7, 12], ingot: [2, 4], rope: [4, 6], cloth: [2, 4], arrow: 8 })); emit('shiploot', s); } });
      if (s.state === 'derelict') out.push({ pos: _v.copy(s.info.helm).applyMatrix4(s.group.matrixWorld).clone().setY(s.group.position.y + s.info.deckY + 1), r: 2.4, label: 'Capture this vessel', use: () => s.capture() });
    }
    return out;
  }

  update(dt) {
    const t = G.clock;
    this.updateDebris(dt); this.updateHook(dt);
    for (const s of this.ships) s.update(dt, t);
    if (this.raider && (this.raider.state === 'gone' || (this.raider.state === 'patrol'))) { const r = this.raider; if (r.state === 'patrol' && d2(r.group.position, G.player.pos) > 500) { r.crew.forEach((c) => { c.dispose(); const k = this.pirates.indexOf(c); if (k >= 0) this.pirates.splice(k, 1); }); this.scene.remove(r.group); this.ships.splice(this.ships.indexOf(r), 1); const pi = G.platforms.indexOf(r); if (pi >= 0) G.platforms.splice(pi, 1); this.raider = null; } else if (r.state === 'gone') { this.ships.splice(this.ships.indexOf(r), 1); const pi = G.platforms.indexOf(r); if (pi >= 0) G.platforms.splice(pi, 1); this.raider = null; } }
    for (const s of this.ships) if (!G.platforms.includes(s)) G.platforms.push(s);
    for (let i = this.pirates.length - 1; i >= 0; i--) {
      const p = this.pirates[i]; p.update(dt, t);
      if (p.dead && p.deadT > 9) { p.dispose(); this.pirates.splice(i, 1); if (p.camp) { p.camp.deadAt = G.clock; } }
    }
    // camps repopulate long after being cleared, once the player has left
    for (const c of G.world.pirateCamps) if (c.members.every((m) => m.dead) && c.deadAt && G.clock - c.deadAt > 900 && Math.hypot(c.x - G.player.pos.x, c.z - G.player.pos.z) > 400) { c.deadAt = 0; this.spawnCamp(c); }
    this.creatures.update(dt);
    this.updateProjectiles(dt); this.updateTurrets(dt); this.updateStorm(dt); this.updateEvents(dt);
    for (let i = this.puffs.length - 1; i >= 0; i--) { const p = this.puffs[i]; p.life -= dt; p.v.y -= 5 * dt; p.m.position.addScaledVector(p.v, dt); p.m.material.opacity = Math.max(0, p.life * 1.5); if (p.life <= 0) { this.scene.remove(p.m); p.m.material.dispose(); this.puffs.splice(i, 1); } }
  }
  serialize() { return { ships: this.ships.filter((s) => !s.raider).map((s) => ({ id: s.id, x: s.group.position.x, z: s.group.position.z, yaw: s.yaw, hp: s.hp, state: ['chase'].includes(s.state) ? 'patrol' : s.state, wp: s.wp, crew: s.alive })) }; }
  load(d) {
    if (!d || !d.ships) return;
    for (const o of d.ships) {
      const s = this.ships.find((k) => k.id === o.id); if (!s) continue;
      s.group.position.set(o.x, 0, o.z); s.yaw = o.yaw; s.hp = o.hp; s.wp = o.wp || 0;
      if (o.state === 'gone' || o.state === 'sinking') { s.state = 'gone'; s.group.visible = false; s.respawn = s.boss ? 1e9 : G.clock + 900; s.crew.forEach((c) => { c.dead = true; c.deadT = 20; c.h.root.visible = false; }); }
      else { s.crew.forEach((c, i) => { if (i >= o.crew) { c.dead = true; c.deadT = 20; c.h.root.visible = false; } }); if (o.state === 'ally') { s.state = 'derelict'; s.capture(true); } else s.state = o.state === 'derelict' ? 'derelict' : 'patrol'; }
    }
  }
}
