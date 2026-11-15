// Sharks, fish, ambient sea life and land animals.
import * as THREE from 'three';
import { G, clamp, lerp, damp, lerpAngle, angDiff, rand, pick, emit, TAU } from './util.js';
import { makeShark, makeDolphin, makeWhale, makeTurtle, makeRay, makeEel, makeBoar, makeCrab, makeGull, fishGeometry, mesh, sphG } from './models.js';
import { waveHeight } from './env.js';
import { terrainHeight, TRENCH, islandAt } from './world.js';
import { TS, DECK } from './raft.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

// Generic swimmer steering: turn toward a point, move forward, stay between seabed and surface.
function swimTo(s, tx, ty, tz, speed, dt, turn = 2.2) {
  const dx = tx - s.pos.x, dz = tz - s.pos.z, dy = ty - s.pos.y, hd = Math.hypot(dx, dz);
  s.yaw = lerpAngle(s.yaw, Math.atan2(dx, dz), Math.min(1, turn * dt));
  s.pitch = damp(s.pitch, clamp(Math.atan2(dy, hd + 0.01), -0.8, 0.8), 3, dt);
  s.speed = damp(s.speed, speed, 2.5, dt);
  const cp = Math.cos(s.pitch);
  s.pos.x += Math.sin(s.yaw) * cp * s.speed * dt; s.pos.z += Math.cos(s.yaw) * cp * s.speed * dt; s.pos.y += Math.sin(s.pitch) * s.speed * dt;
  const top = waveHeight(s.pos.x, s.pos.z) - (s.minDepth || 0.7), bot = terrainHeight(s.pos.x, s.pos.z) + (s.clear || 1.2);
  if (bot > top) { // too shallow: turn back toward deeper water
    s.pos.x -= Math.sin(s.yaw) * cp * s.speed * dt * 1.5; s.pos.z -= Math.cos(s.yaw) * cp * s.speed * dt * 1.5; s.yaw += 2.5 * dt; s.blocked = true;
  } else s.blocked = false;
  s.pos.y = clamp(s.pos.y, Math.min(bot, top), top);
  return hd;
}
function place(s, t) {
  s.g.position.copy(s.pos); s.g.rotation.set(-s.pitch, s.yaw, 0, 'YXZ');
  if (s.g.tail) s.g.tail.rotation[s.fluke ? 'x' : 'y'] = Math.sin(t * (2 + s.speed * 1.3) + s.seed) * 0.45;
}

class Shark {
  constructor(scene, kind, home) {
    this.kind = kind; this.home = home; this.g = makeShark(kind); scene.add(this.g);
    this.g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    const S = { white: { hp: 170, bite: 24, sp: 6.8, r: 1.5 }, tiger: { hp: 115, bite: 18, sp: 6.2, r: 1.3 }, reef: { hp: 55, bite: 9, sp: 5, r: 0.9 } }[kind];
    Object.assign(this, S); this.maxHp = S.hp; this.pos = new THREE.Vector3(); this.yaw = rand(TAU); this.pitch = 0; this.speed = 2; this.seed = rand(10);
    this.state = 'circle'; this.t = 0; this.cool = 0; this.ang = rand(TAU); this.dead = false; this.respawn = 0; this.nextRaft = rand(110, 170); this.angry = false;
    if (home) this.pos.set(home.x + rand(-8, 8), home.y, home.z + rand(-8, 8)); else this.spawnNearRaft();
  }
  spawnNearRaft() { const r = G.raft.group.position, a = rand(TAU); this.pos.set(r.x + Math.sin(a) * 70, -6, r.z + Math.cos(a) * 70); this.state = 'circle'; }
  damage(d, by) {
    if (this.dead) return;
    this.hp -= d; this.angry = true; G.ents.puff(this.pos.x, this.pos.y, this.pos.z, 0xaa1111, 6); if (by === 'player') emit('sharkhit');
    if (this.hp <= 0) { this.dead = true; this.respawn = G.clock + (this.home ? 360 : 170); this.t = 0; this.target = null; emit('kill', 'shark', this.kind); if (G.player.pos.distanceTo(this.pos) < 30) G.player.give(this.kind === 'reef' ? { shark_meat: 1, tooth: 1 } : { shark_meat: 3, tooth: 2 }); return; }
    if (this.state === 'biteraft' || this.hp < this.maxHp * 0.4 || this.kind === 'white') { this.state = 'retreat'; this.t = rand(7, 12); this.target = null; }
    else if (this.kind !== 'white') this.state = 'hunt';
  }
  update(dt, t) {
    const pl = G.player, raft = G.raft, rp = raft.group.position;
    if (this.dead) {
      if (this.g.visible) { this.t += dt; this.g.rotation.z = Math.min(Math.PI, this.t * 1.5); this.pos.y -= dt * 0.8; this.g.position.copy(this.pos); if (this.t > 6) this.g.visible = false; }
      if (t > this.respawn) { this.dead = false; this.hp = this.maxHp; this.g.visible = true; this.g.rotation.z = 0; this.angry = false; if (this.home) this.pos.set(this.home.x, this.home.y, this.home.z); else this.spawnNearRaft(); }
      return;
    }
    this.cool -= dt;
    const dPl = this.pos.distanceTo(pl.pos), swimmer = pl.swimming && !pl.dead;
    const aggro = this.kind === 'white' ? 34 : this.kind === 'tiger' ? 24 : this.angry ? 18 : 0;
    if (swimmer && dPl < aggro && this.cool <= 0 && this.state !== 'retreat' && this.state !== 'biteraft') this.state = 'hunt';
    switch (this.state) {
      case 'hunt': {
        if (!swimmer || dPl > aggro * 1.8) { this.state = 'circle'; break; }
        swimTo(this, pl.pos.x, pl.pos.y + 0.6, pl.pos.z, this.sp, dt, 2.8);
        if (dPl < this.r + 0.7) { pl.hurt(this.bite, 'shark'); G.audio.sfx('bite'); G.ents.puff(pl.pos.x, pl.pos.y + 1, pl.pos.z, 0xaa1111, 8); this.state = 'retreat'; this.t = rand(3.5, 6); this.cool = rand(5, 8); }
        break;
      }
      case 'retreat': {
        this.t -= dt;
        const ax = this.pos.x - (this.home ? this.home.x : rp.x), az = this.pos.z - (this.home ? this.home.z : rp.z), al = Math.hypot(ax, az) || 1;
        swimTo(this, this.pos.x + (ax / al) * 20, this.home ? this.home.y : -9, this.pos.z + (az / al) * 20, this.sp * 0.8, dt);
        if (this.t <= 0) this.state = 'circle';
        break;
      }
      case 'biteraft': {
        const p = this.target;
        if (!p || !raft.pieces.has(p.key)) { this.state = 'retreat'; this.t = 6; this.target = null; break; }
        raft.worldOf(p, _v, -0.5);
        const d = swimTo(this, _v.x, _v.y - 0.3, _v.z, d0(this.pos, _v) < 3 ? 1 : this.sp * 0.7, dt, 3);
        if (d < 2.2) {
          this.speed = 0.3; this.t -= dt; this.chew = (this.chew || 0) + dt;
          if (this.chew > 9.5) { this.chew = 0; this.state = 'retreat'; this.t = 8; this.target = null; this.nextRaft = rand(150, 260); break; } this.g.rotation.z = Math.sin(t * 16) * 0.25;
          if (this.t <= 0) { this.t = 1.15; G.audio.sfx('crunch'); G.ents.puff(_v.x, 0.3, _v.z, 0x8a6a40, 4); if (raft.damage(p, 10, 'shark')) { G.ui.toast('🦈 The shark tore off a foundation!'); this.state = 'retreat'; this.t = 10; this.target = null; this.chew = 0; this.nextRaft = rand(150, 260); } }
        }
        break;
      }
      default: { // circle
        if (this.home) {
          this.ang += dt * 0.25; const r = this.kind === 'reef' ? 9 : 14;
          swimTo(this, this.home.x + Math.sin(this.ang) * r, this.home.y + Math.sin(this.ang * 2.3) * 2, this.home.z + Math.cos(this.ang) * r, 2.2, dt);
        } else {
          const R = raft.radius + 11; this.ang += (dt * 2.6) / R;
          const tx = rp.x + raft.cx + Math.sin(this.ang) * R, tz = rp.z + raft.cz + Math.cos(this.ang) * R;
          const far = Math.hypot(tx - this.pos.x, tz - this.pos.z);
          swimTo(this, tx, -0.75, tz, far > 25 ? 7.5 : 3, dt);
          if (far > 160) this.spawnNearRaft();
          this.nextRaft -= dt * (G.env.day < 2 ? 0.75 : 1);
          if (this.nextRaft <= 0) {
            this.nextRaft = rand(150, 260); this.chew = 0;
            if (!raft.hasBeacon && !this.blocked) { const c = raft.edgeFoundations().filter((p) => !raft.pieces.get(`C${p.i},${p.j},0`)); const all = c.length ? c : raft.edgeFoundations(); if (all.length && raft.nTiles > 1) { this.target = pick(all); this.state = 'biteraft'; this.t = 1.5; G.ui.toast('🦈 A shark is attacking the raft! Hit it!'); G.audio.sfx('alarm'); emit('sharkattack'); } }
          }
        }
      }
    }
    place(this, t);
  }
}
const d0 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

class Eel {
  constructor(scene) {
    this.g = makeEel(); scene.add(this.g); this.g.visible = false;
    const cx = (TRENCH.ax + TRENCH.bx) / 2, cz = (TRENCH.az + TRENCH.bz) / 2;
    this.home = { x: cx + 30, z: cz - 20, y: terrainHeight(cx + 30, cz - 20) + 14 };
    this.pos = new THREE.Vector3(this.home.x, this.home.y, this.home.z); this.yaw = 0; this.pitch = 0; this.speed = 2; this.seed = 1; this.clear = 4; this.minDepth = 30;
    this.hp = this.maxHp = 650; this.r = 3; this.cool = 0; this.dead = false; this.trail = []; this.ang = 0; this.kind = 'eel';
  }
  damage(d) { if (this.dead) return; this.hp -= d; G.ents.puff(this.pos.x, this.pos.y, this.pos.z, 0x35e0ff, 8); if (this.hp <= 0) { this.dead = true; this.g.visible = false; emit('kill', 'eel'); G.player.give({ pearl: 4, crystal: 3, titanium: 4 }); G.ui.banner('The Warden of the Trench is slain', 'The deep falls silent.'); } }
  update(dt, t) {
    if (this.dead || G.prog.flags.eel_dead) { this.g.visible = false; return; }
    const pl = G.player, d = this.pos.distanceTo(pl.pos);
    this.g.visible = d < 260; if (!this.g.visible) return;
    this.cool -= dt;
    if (pl.swimming && pl.pos.y < -55 && d < 110 && !pl.dead) {
      swimTo(this, pl.pos.x, pl.pos.y, pl.pos.z, this.cool > 0 ? 2 : 5.6, dt, 1.6);
      if (d < 4.5 && this.cool <= 0) { pl.hurt(34, 'deep'); G.audio.sfx('bite'); this.cool = 3.2; }
      if (!this.warned) { this.warned = true; G.ui.toast('⚠️ Something enormous is moving in the dark…'); G.audio.sfx('alarm'); }
    } else { this.ang += dt * 0.12; swimTo(this, this.home.x + Math.sin(this.ang) * 40, this.home.y + Math.sin(this.ang * 3) * 8, this.home.z + Math.cos(this.ang) * 40, 2.4, dt, 1); this.warned = false; }
    // body segments follow the head's trail
    this.trail.unshift({ x: this.pos.x, y: this.pos.y, z: this.pos.z }); if (this.trail.length > 220) this.trail.pop();
    this.g.position.set(0, 0, 0); this.g.rotation.set(0, 0, 0);
    let acc = 0, k = 0;
    this.g.segs.forEach((s, i) => {
      const want = i * 1.7;
      while (k < this.trail.length - 2 && acc < want) { acc += Math.hypot(this.trail[k].x - this.trail[k + 1].x, this.trail[k].y - this.trail[k + 1].y, this.trail[k].z - this.trail[k + 1].z); k++; }
      const a = this.trail[Math.min(k, this.trail.length - 1)], b = this.trail[Math.max(0, Math.min(k, this.trail.length - 1) - 1)];
      s.position.set(a.x, a.y, a.z); s.rotation.set(0, Math.atan2(b.x - a.x, b.z - a.z) || this.yaw, 0);
    });
  }
}

class LandAnimal {
  constructor(scene, kind, x, z) {
    this.kind = kind; this.g = kind === 'boar' ? makeBoar() : makeCrab(); scene.add(this.g);
    this.g.traverse((o) => { if (o.isMesh) o.castShadow = kind === 'boar'; });
    this.home = { x, z }; this.pos = new THREE.Vector3(x, terrainHeight(x, z), z); this.yaw = rand(TAU);
    this.hp = this.maxHp = kind === 'boar' ? 55 : 10; this.r = kind === 'boar' ? 0.8 : 0.4; this.t = 0; this.cool = 0; this.state = 'idle'; this.dead = false; this.respawn = 0; this.tx = x; this.tz = z;
  }
  damage(d) {
    if (this.dead) return; this.hp -= d; G.ents.puff(this.pos.x, this.pos.y + 0.5, this.pos.z, 0xaa1111, 4);
    if (this.hp <= 0) { this.dead = true; this.respawn = G.clock + 400; this.g.rotation.z = 1.5; emit('kill', this.kind); G.player.give(this.kind === 'boar' ? { raw_meat: 2, hide: Math.random() < 0.6 ? 2 : 1 } : { raw_meat: 1 }); this.t = 0; }
    else if (this.kind === 'boar') { this.state = 'charge'; this.t = 4; } else { this.state = 'flee'; this.t = 4; }
  }
  update(dt, t) {
    const pl = G.player, d = d0(this.pos, pl.pos);
    if (this.dead) { this.t += dt; if (this.t > 8) this.g.visible = false; if (t > this.respawn && d > 60) { this.dead = false; this.hp = this.maxHp; this.g.visible = true; this.g.rotation.z = 0; this.pos.set(this.home.x, 0, this.home.z); this.state = 'idle'; } return; }
    this.g.visible = d < 170; if (d > 170) return;
    this.cool -= dt; this.t -= dt;
    let sp = 0;
    const onLand = !pl.swimming && !pl.platform && !pl.dead;
    if (this.kind === 'boar') {
      if (this.state === 'idle' && onLand && d < 9 && this.cool <= 0) { this.state = 'charge'; this.t = 3.5; G.audio.sfx('boar'); }
      if (this.state === 'charge') { this.tx = pl.pos.x; this.tz = pl.pos.z; sp = 6.3; if (d < 1.5 && this.cool <= 0) { pl.hurt(13, 'boar'); this.cool = 2.4; this.state = 'idle'; this.t = 2; } if (this.t <= 0 || !onLand || d > 30) { this.state = 'idle'; this.cool = 3; } }
    } else if (onLand && d < 4) { this.state = 'flee'; this.t = 2; }
    if (this.state === 'flee') { this.tx = this.pos.x * 2 - pl.pos.x; this.tz = this.pos.z * 2 - pl.pos.z; sp = this.kind === 'boar' ? 5 : 2.6; if (this.t <= 0) this.state = 'idle'; }
    if (this.state === 'idle') { if (this.t <= 0) { this.t = rand(2, 6); const a = rand(TAU), r = rand(2, this.kind === 'boar' ? 14 : 5); this.tx = this.home.x + Math.sin(a) * r; this.tz = this.home.z + Math.cos(a) * r; } sp = d0(this.pos, { x: this.tx, z: this.tz }) > 0.6 ? (this.kind === 'boar' ? 1.5 : 0.9) : 0; }
    if (sp > 0) {
      this.yaw = lerpAngle(this.yaw, Math.atan2(this.tx - this.pos.x, this.tz - this.pos.z), Math.min(1, 6 * dt));
      const nx = this.pos.x + Math.sin(this.yaw) * sp * dt, nz = this.pos.z + Math.cos(this.yaw) * sp * dt, h = terrainHeight(nx, nz);
      if (h > 0.3 && h - this.pos.y < 1) { this.pos.x = nx; this.pos.z = nz; } else this.t = 0;
      G.world.collide(this.pos, this.r * 0.6);
    }
    this.pos.y = terrainHeight(this.pos.x, this.pos.z);
    this.g.position.copy(this.pos); this.g.rotation.y = this.kind === 'crab' ? this.yaw + Math.PI / 2 : this.yaw;
    if (this.g.legs) this.g.legs.forEach((l, i) => { l.rotation.x = sp > 0 ? Math.sin(t * (6 + sp * 2) + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.6 : 0; });
  }
}

export class Creatures {
  constructor(scene) {
    this.scene = scene; this.sharks = []; this.land = []; this.targets = [];
    this.stalker = null; this.stalkerAt = 75;
    for (const s of G.world.sharkSpots) this.sharks.push(new Shark(scene, s.kind, s));
    this.eel = new Eel(scene);
    for (const b of G.world.boarSpots) this.land.push(new LandAnimal(scene, 'boar', b.x, b.z));
    this.crabs = [0, 1, 2, 3].map(() => { const c = new LandAnimal(scene, 'crab', 0, -9999); c.g.visible = false; c.idle = true; return c; });
    // fish schools
    this.schools = [];
    const cols = [0xffb347, 0x4dd0e1, 0xf06292, 0xfff176, 0x9ccc65, 0xb0bec5];
    for (let s = 0; s < 6; s++) {
      const n = 26, im = new THREE.InstancedMesh(fishGeometry(), new THREE.MeshStandardMaterial({ color: cols[s], roughness: 0.4, side: THREE.DoubleSide }), n);
      im.frustumCulled = false; scene.add(im);
      this.schools.push({ im, n, c: new THREE.Vector3(0, -500, 0), yaw: rand(TAU), off: Array.from({ length: n }, () => [rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(TAU), rand(0.6, 1.4)]), t: 0, scale: 0.7 + s * 0.12 });
    }
    // ambient
    this.dolphins = [0, 1, 2].map((i) => ({ g: makeDolphin(), ph: i * 1.3, off: i * 5 }));
    this.dolphins.forEach((d) => { d.g.visible = false; scene.add(d.g); }); this.dolT = 0; this.dolPos = new THREE.Vector3(); this.dolDir = 0;
    this.whale = { g: makeWhale(), t: 0, pos: new THREE.Vector3(), yaw: 0 }; this.whale.g.visible = false; scene.add(this.whale.g);
    this.spout = mesh(sphG(0.5, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }), 0, 0, 0, scene, false); this.spout.visible = false;
    this.turtles = [0, 1].map(() => ({ g: makeTurtle(), pos: new THREE.Vector3(0, -500, 0), yaw: rand(TAU), pitch: 0, speed: 0.8, seed: rand(9), t: 0, minDepth: 0.5, clear: 0.8 }));
    this.rays = [0, 1].map(() => ({ g: makeRay(), pos: new THREE.Vector3(0, -500, 0), yaw: rand(TAU), pitch: 0, speed: 1.2, seed: rand(9), t: 0, minDepth: 2, clear: 1 }));
    [...this.turtles, ...this.rays].forEach((a) => scene.add(a.g));
    this.gulls = [0, 1, 2, 3, 4].map((i) => ({ g: makeGull(), a: i * 1.3, r: 14 + i * 5, h: 16 + i * 3 })); this.gulls.forEach((g) => scene.add(g.g));
    this.gullC = new THREE.Vector3();
  }
  callDolphins() { const r = G.raft.group.position, a = rand(TAU); this.dolT = 38; this.dolDir = a + Math.PI / 2; this.dolPos.set(r.x + Math.sin(a) * 30, 0, r.z + Math.cos(a) * 30); }
  callWhale() { const p = G.player.pos, a = rand(TAU); this.whale.t = 70; this.whale.yaw = a + 1.9; this.whale.pos.set(p.x + Math.sin(a) * 110, -3, p.z + Math.cos(a) * 110); this.whale.seen = false; }
  callPack() { const r = G.raft.group.position; for (let i = 0; i < 2; i++) { const s = new Shark(this.scene, 'tiger', null); s.temp = G.clock + 150; s.nextRaft = 1e9; const a = rand(TAU); s.pos.set(r.x + Math.sin(a) * 45, -5, r.z + Math.cos(a) * 45); this.sharks.push(s); } }

  update(dt) {
    const t = G.clock, pl = G.player, P = pl.pos;
    // stalker shark arrives a little after the game begins
    if (!this.stalker && G.playTime > this.stalkerAt) { this.stalker = new Shark(this.scene, 'white', null); this.sharks.push(this.stalker); G.ui.toast('🦈 A fin cuts the water nearby…'); emit('sharkseen'); }
    this.targets.length = 0;
    for (let i = this.sharks.length - 1; i >= 0; i--) {
      const s = this.sharks[i];
      if (s.temp && t > s.temp && s.state !== 'hunt') { this.scene.remove(s.g); this.sharks.splice(i, 1); continue; }
      if (s.home && d0(s.pos, P) > 240) { s.g.visible = false; continue; }
      if (!s.dead) s.g.visible = true;
      s.update(dt, t); if (!s.dead) this.targets.push(s);
    }
    this.eel.update(dt, t); if (this.eel.g.visible && !this.eel.dead) this.targets.push(this.eel);
    for (const a of this.land) { a.update(dt, t); if (!a.dead && a.g.visible) this.targets.push(a); }
    // crabs appear on the beach around the player
    const gy = terrainHeight(P.x, P.z);
    for (const c of this.crabs) {
      if (c.idle || d0(c.pos, P) > 60) {
        c.idle = true; c.g.visible = false;
        if (!pl.platform && gy > 0 && gy < 12 && Math.random() < dt * 0.4) { const a = rand(TAU), r = rand(14, 30), x = P.x + Math.sin(a) * r, z = P.z + Math.cos(a) * r, h = terrainHeight(x, z); if (h > 0.5 && h < 2.6) { c.home = { x, z }; c.pos.set(x, h, z); c.idle = false; c.dead = false; c.hp = 10; c.g.visible = true; c.g.rotation.z = 0; c.state = 'idle'; } }
        continue;
      }
      c.update(dt, t); if (c.dead && c.t > 8) c.idle = true; if (!c.dead) this.targets.push(c);
    }
    this.updateSchools(dt, t, P);
    this.updateAmbient(dt, t, P);
  }

  updateSchools(dt, t, P) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    for (const s of this.schools) {
      if (d0(s.c, P) > 70 || s.c.y < -400) { // relocate near the player
        const a = rand(TAU), r = rand(12, 45), x = P.x + Math.sin(a) * r, z = P.z + Math.cos(a) * r, bot = terrainHeight(x, z);
        if (bot > -2.5) { s.im.visible = false; continue; }
        s.c.set(x, Math.max(bot + 1.5, rand(-9, -2)), z); s.im.visible = true;
      }
      s.t -= dt; if (s.t <= 0) { s.t = rand(3, 7); s.yawT = rand(TAU); }
      s.yaw = lerpAngle(s.yaw, s.yawT || 0, dt * 0.6);
      const nx = s.c.x + Math.sin(s.yaw) * dt * 1.3, nz = s.c.z + Math.cos(s.yaw) * dt * 1.3;
      if (terrainHeight(nx, nz) < s.c.y - 1) { s.c.x = nx; s.c.z = nz; } else s.yawT = s.yaw + Math.PI;
      for (let i = 0; i < s.n; i++) {
        const o = s.off[i], ph = t * o[4] + o[3];
        p.set(s.c.x + o[0] * 3 + Math.sin(ph) * 1.2, s.c.y + o[1] * 1.2 + Math.sin(ph * 1.3) * 0.3, s.c.z + o[2] * 3 + Math.cos(ph) * 1.2);
        q.setFromEuler(e.set(0, s.yaw + Math.cos(ph) * 0.6, 0)); sc.setScalar(s.scale * (0.7 + (i % 4) * 0.15)); m.compose(p, q, sc); s.im.setMatrixAt(i, m);
      }
      s.im.instanceMatrix.needsUpdate = true;
    }
  }

  updateAmbient(dt, t, P) {
    // dolphins leaping alongside
    if (this.dolT > 0) {
      this.dolT -= dt; const rv = G.raft.vel; this.dolPos.x += (Math.sin(this.dolDir) * 5 + rv.x * 0.5) * dt; this.dolPos.z += (Math.cos(this.dolDir) * 5 + rv.z * 0.5) * dt;
      this.dolphins.forEach((d) => { const ph = t * 1.5 + d.ph, y = Math.sin(ph) * 1.9 - 0.6; d.g.visible = true; d.g.position.set(this.dolPos.x + Math.cos(this.dolDir) * d.off, waveHeight(this.dolPos.x, this.dolPos.z) + y, this.dolPos.z - Math.sin(this.dolDir) * d.off); d.g.rotation.set(-Math.cos(ph) * 0.8, this.dolDir, 0, 'YXZ'); d.g.tail.rotation.x = Math.sin(t * 9) * 0.4; });
      if (this.dolT <= 0) this.dolphins.forEach((d) => (d.g.visible = false));
    }
    // whale
    const w = this.whale;
    if (w.t > 0) {
      w.t -= dt; w.pos.x += Math.sin(w.yaw) * 2.6 * dt; w.pos.z += Math.cos(w.yaw) * 2.6 * dt;
      const ph = t * 0.35, y = Math.sin(ph) * 2.8 - 2.6; w.g.visible = true; w.g.position.set(w.pos.x, y, w.pos.z); w.g.rotation.set(-Math.cos(ph) * 0.18, w.yaw, 0, 'YXZ'); w.g.tail.rotation.x = Math.sin(t * 1.4) * 0.35;
      const sp = Math.sin(ph) > 0.8; this.spout.visible = sp; if (sp) { this.spout.position.set(w.pos.x + Math.sin(w.yaw) * 5, y + 3.5 + ((t * 3) % 2), w.pos.z + Math.cos(w.yaw) * 5); this.spout.scale.set(1, 3, 1); }
      if (!w.seen && d0(w.pos, P) < 90) { w.seen = true; emit('whale'); G.ui.toast('🐋 A great whale surfaces nearby'); G.audio.sfx('whale'); }
      if (w.t <= 0) { w.g.visible = false; this.spout.visible = false; }
    }
    // turtles and rays drift around shallow water near the player
    for (const a of [...this.turtles, ...this.rays]) {
      const isT = !!a.g.flips;
      if (d0(a.pos, P) > 90 || a.pos.y < -400) { const an = rand(TAU), r = rand(20, 60), x = P.x + Math.sin(an) * r, z = P.z + Math.cos(an) * r, bot = terrainHeight(x, z); if (bot < -3 && bot > -40) { a.pos.set(x, isT ? -1.5 : bot + 1.2, z); a.g.visible = true; } else { a.g.visible = false; continue; } }
      a.t -= dt; if (a.t <= 0 || a.blocked) { a.t = rand(4, 9); a.tx = a.pos.x + rand(-25, 25); a.tz = a.pos.z + rand(-25, 25); }
      swimTo(a, a.tx, isT ? -1.2 + Math.sin(t * 0.3 + a.seed) : terrainHeight(a.pos.x, a.pos.z) + 1.3, a.tz, isT ? 0.9 : 1.4, dt, 0.8);
      a.g.position.copy(a.pos); a.g.rotation.set(-a.pitch, a.yaw, isT ? 0 : Math.sin(t + a.seed) * 0.15, 'YXZ');
      if (isT) a.g.flips.forEach((f, i) => (f.rotation.z = Math.sin(t * 2 + i) * 0.5));
    }
    // gulls circle the raft, or the nearest island when ashore
    const isl = islandAt(P.x, P.z, 1.3); const c = isl && !G.player.platform ? _v.set(P.x, 0, P.z) : G.raft.group.position;
    this.gullC.lerp(_v2.set(c.x, 0, c.z), Math.min(1, dt * 0.5));
    const hide = G.env.isStorm || G.env.light < 0.25;
    this.gulls.forEach((g) => { g.a += (dt * 5.5) / g.r; g.g.visible = !hide; g.g.position.set(this.gullC.x + Math.sin(g.a) * g.r, g.h + Math.sin(g.a * 3) * 1.5, this.gullC.z + Math.cos(g.a) * g.r); g.g.rotation.y = g.a + Math.PI / 2; g.g.wings.forEach((wg, i) => (wg.rotation.z = (i ? -1 : 1) * Math.sin(t * 5 + g.a * 9) * 0.5)); });
    if (!hide && Math.random() < dt * 0.05) G.audio.sfx('gull');
  }
}
