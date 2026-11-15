// Player: third-person controller, survival stats, tools, building, interaction.
import * as THREE from 'three';
import { G, clamp, lerp, damp, lerpAngle, rand, emit, TAU } from './util.js';
import { makeHumanoid, animateHumanoid, makeHeld, mesh, sphG, colMat } from './models.js';
import { waveHeight } from './env.js';
import { terrainHeight, NODES, rollLoot, islandAt } from './world.js';
import { ITEMS, PIECES, RECIPES, costText } from './items.js';
import { TS, LH, DECK, Raft } from './raft.js';

export class Inventory {
  constructor(n = 32) { this.slots = new Array(n).fill(null); }
  count(id) { let c = 0; for (const s of this.slots) if (s && s.id === id) c += s.n; return c; }
  has(cost) { for (const k in cost) if (this.count(k) < cost[k]) return false; return true; }
  freeSlots() { return this.slots.filter((s) => !s).length; }
  add(id, n = 1) {
    const st = ITEMS[id].stack;
    for (const s of this.slots) if (n > 0 && s && s.id === id && s.n < st) { const k = Math.min(n, st - s.n); s.n += k; n -= k; }
    for (let i = 0; i < this.slots.length && n > 0; i++) if (!this.slots[i]) { const k = Math.min(n, st); this.slots[i] = { id, n: k }; n -= k; }
    G.ui && (G.ui.dirty = true);
    return n;
  }
  remove(id, n = 1) {
    for (let i = this.slots.length - 1; i >= 0 && n > 0; i--) { const s = this.slots[i]; if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) this.slots[i] = null; } }
    G.ui && (G.ui.dirty = true);
    return n === 0;
  }
  pay(cost) { if (!this.has(cost)) return false; for (const k in cost) this.remove(k, cost[k]); return true; }
}

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _ray = new THREE.Ray();

export class Player {
  constructor(scene, camera) {
    G.player = this;
    this.scene = scene; this.cam = camera;
    this.h = makeHumanoid({ pack: true, shorts: true, sleeves: false });
    this.h.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.h.root);
    this.pos = new THREE.Vector3(1, 1, 1); this.vel = new THREE.Vector3(); this.local = new THREE.Vector3();
    this.yaw = 0; this.camYaw = 0.6; this.camPitch = 0.25; this.camDist = 5;
    this.inv = new Inventory(32); this.sel = 0;
    this.build = { type: null, rot: 0, remove: false };
    this.light = new THREE.PointLight(0xdfefff, 0, 34, 1.4); scene.add(this.light);
    this.floatM = mesh(sphG(0.09, 8, 6), colMat(0xe23a2a), 0, 0, 0, scene, false); this.floatM.visible = false;
    this.line = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: 0xe8e8e8 }));
    this.line.frustumCulled = false; this.line.visible = false; scene.add(this.line);
    this.reset();
  }
  reset() {
    this.hp = 100; this.hunger = 85; this.thirst = 80; this.stamina = 100; this.oxygen = 30; this.temp = 24;
    this.platform = null; this.onGround = false; this.swimming = false; this.headUnder = false; this.helm = null; this.dead = false;
    this.atk = 0; this.cd = 0; this.fish = null; this.hurtT = 0; this.heldId = undefined; this.sheltered = false;
    this.inv.slots.fill(null); this.sel = 0;
    this.attach(G.raft, new THREE.Vector3(1, DECK, 1));
  }
  attach(pf, local) { this.platform = pf; this.local.copy(local); this.vel.set(0, 0, 0); this.onGround = true; this.pos.copy(local).applyMatrix4(pf.group.matrixWorld); this.pfYaw = pf.group.rotation.y; }
  detach() { if (this.platform && this.platform.vel) { this.vel.x += this.platform.vel.x; this.vel.z += this.platform.vel.z; } this.platform = null; }
  get held() { const s = this.inv.slots[this.sel]; return s ? ITEMS[s.id] : null; }
  hasGear(id) { return this.inv.count(id) > 0; }
  get maxO2() { return 30 + (this.hasGear('mask') ? 20 : 0) + (this.hasGear('tank') ? 90 : 0) + (this.hasGear('tank_adv') ? 200 : 0); }
  get depthLimit() { return this.hasGear('suit') ? 500 : this.hasGear('tank_adv') ? 120 : this.hasGear('tank') ? 80 : 32; }

  hurt(d, cause) {
    if (this.dead || d <= 0) return;
    if (this.hasGear('armor') && cause !== 'env') d *= 0.65;
    this.hp -= d; this.hurtT = 0.5;
    if (cause !== 'env' || Math.random() < 0.05) G.audio.sfx('hurt');
    G.ui.flash(cause === 'env' ? 0.25 : 0.6);
    if (this.hp <= 0) this.die(cause);
  }
  die(cause) {
    this.dead = true; this.hp = 0; this.helm = null; this.fish = null; this.deadT = 0;
    const why = { shark: 'Taken by a shark.', pirate: 'Cut down by pirates.', cannon: 'Caught in cannon fire.', deep: 'Something in the deep found you.', boar: 'Gored by a boar.' }[cause]
      || (this.oxygen <= 0 ? 'You drowned.' : this.thirst <= 0 ? 'You died of thirst.' : this.hunger <= 0 ? 'You starved.' : this.temp < 10 ? 'You froze.' : 'You did not survive.');
    emit('death', cause);
    G.ui.showDeath(why);
  }
  respawn() {
    const raft = G.raft; let t = null;
    for (const p of raft.pieces.values()) if (p.slot === 'T' && p.l === 0 && !raft.pieces.get(`C${p.i},${p.j},0`)) { t = p; break; }
    if (!t) t = [...raft.pieces.values()].find((p) => p.slot === 'T');
    for (let i = 8; i < this.inv.slots.length; i++) { const s = this.inv.slots[i]; if (s && ITEMS[s.id].type === 'res' && ITEMS[s.id].stack > 1) { s.n -= Math.floor(s.n * 0.3); } }
    this.hp = 60; this.hunger = Math.max(this.hunger, 50); this.thirst = Math.max(this.thirst, 50); this.stamina = 100; this.oxygen = this.maxO2; this.temp = 24; this.dead = false;
    this.attach(raft, new THREE.Vector3(t.i * TS, t.l * LH + DECK, t.j * TS));
    G.env.time = (G.env.time + 3) % 24; G.ui.dirty = true;
  }

  consume(idx) {
    const s = this.inv.slots[idx]; if (!s) return false;
    const it = ITEMS[s.id];
    if (!['food', 'drink', 'med'].includes(it.type)) return false;
    if (it.type === 'med' && this.hp >= 100) { G.ui.toast('Already at full health'); return false; }
    if (it.hunger) this.hunger = clamp(this.hunger + it.hunger, 0, 100);
    if (it.thirst) this.thirst = clamp(this.thirst + it.thirst, 0, 100);
    if (it.hp) { if (it.hp < 0) this.hurt(-it.hp, 'env'); else this.hp = clamp(this.hp + it.hp, 0, 100); }
    s.n--; if (s.n <= 0) this.inv.slots[idx] = null;
    if (it.gives) this.inv.add(it.gives, 1);
    G.audio.sfx(it.type === 'drink' ? 'drink' : 'eat'); G.ui.dirty = true; emit('consume', it.id);
    return true;
  }
  give(loot, quiet) {
    const parts = [];
    for (const [id, n] of Object.entries(loot)) { const left = this.inv.add(id, n); if (n - left > 0) parts.push(`${ITEMS[id].icon} +${n - left}`); if (left > 0) G.ui.toast('Inventory full!'); emit('gain', id, n - left); }
    if (parts.length && !quiet) G.ui.pickup(parts.join('  '));
    return parts.length > 0;
  }

  // ---------- main update ----------
  update(dt) {
    const I = G.input, env = G.env;
    if (this.dead) { this.deadT += dt; animateHumanoid(this.h, 'dead', dt); this.updateCamera(dt, I); return; }
    this.cd = Math.max(0, this.cd - dt); this.hurtT = Math.max(0, this.hurtT - dt);

    // camera look
    this.camYaw -= I.lookX; this.camPitch = clamp(this.camPitch + I.lookY, -1.2, 1.35);
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    let mx = I.mx, mz = I.mz; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    // world-space wish direction (camera relative)
    let wx = fx * mz - fz * mx, wz = fz * mz + fx * mx;
    const moving = ml > 0.08;

    // carried by platform
    if (this.platform) {
      const pf = this.platform;
      this.pos.copy(this.local).applyMatrix4(pf.group.matrixWorld);
      const dy = pf.group.rotation.y - this.pfYaw; this.pfYaw = pf.group.rotation.y;
      if (dy) { this.yaw += dy; this.camYaw += dy; }
    }
    const waterH = waveHeight(this.pos.x, this.pos.z), ground = terrainHeight(this.pos.x, this.pos.z);

    if (this.helm) this.updateHelm(dt, I, mx, mz);
    else if (this.platform) this.movePlatform(dt, I, wx, wz, moving, waterH);
    else this.moveWorld(dt, I, wx, wz, moving, waterH, ground);

    // face direction
    if (!this.helm) {
      if (this.atk > 0 || this.fish || (this.held && this.held.id === 'bow' && I.act) || (this.build.type && this.held && this.held.id === 'hammer')) this.yaw = lerpAngle(this.yaw, this.camYaw, 1 - Math.exp(-18 * dt));
      else if (moving) this.yaw = lerpAngle(this.yaw, Math.atan2(wx, wz), 1 - Math.exp(-11 * dt));
    }

    this.updateActions(dt, I);
    this.updateSurvival(dt, waterH);
    this.updateInteract(dt, I);

    // model
    const sp = Math.hypot(this.vel.x, this.vel.z);
    let mode = 'idle';
    if (this.helm) mode = 'helm';
    else if (this.swimming) mode = sp > 0.5 || Math.abs(this.vel.y) > 0.6 ? 'swim' : 'tread';
    else if (this.moveSp > 0.4) mode = 'move';
    animateHumanoid(this.h, mode, dt, clamp((this.moveSp || sp) / 6.5, 0, 1.2), this.atk > 0 ? 1 - this.atk / this.atkLen : 0, G.clock);
    this.h.root.position.copy(this.pos);
    if (this.swimming && mode !== 'swim') this.h.root.position.y += 0.0;
    this.h.root.rotation.y = this.yaw;
    this.updateHeld();
    this.updateCamera(dt, I);
  }

  updateHelm(dt, I, mx, mz) {
    const raft = G.raft, d = this.helm;
    raft.steer = -mx; if (Math.abs(mz) > 0.3) raft.throttle = clamp(raft.throttle + mz * dt * 0.8, -0.3, 1);
    _v.set(d.i * TS, d.l * LH + DECK, d.j * TS);
    const a = (d.r * Math.PI) / 2; _v.x -= Math.sin(a) * 0.75; _v.z -= Math.cos(a) * 0.75;
    this.local.copy(_v); this.pos.copy(this.local).applyMatrix4(raft.group.matrixWorld);
    this.yaw = raft.yaw + a; this.vel.set(0, 0, 0); this.moveSp = 0; this.swimming = false; this.onGround = true;
    if (I.useP || I.jumpP) { this.helm = null; raft.steer = 0; I.useP = false; G.ui.toast('Left the helm'); }
  }

  movePlatform(dt, I, wx, wz, moving, waterH) {
    const pf = this.platform, L = this.local;
    this.swimming = false;
    const sprint = I.sprint && moving && this.stamina > 1 && this.onGround;
    const speed = (sprint ? 6.4 : 4.1) * (this.hunger < 8 || this.thirst < 8 ? 0.7 : 1);
    if (sprint) this.stamina -= dt * 11;
    this.sprinting = sprint;
    // wish direction into platform space (yaw only)
    const py = pf.group.rotation.y, c = Math.cos(py), s = Math.sin(py);
    const lx = wx * c - wz * s, lz = wx * s + wz * c;
    const k = 1 - Math.exp(-12 * dt);
    this.vel.x = lerp(this.vel.x, moving ? lx * speed : 0, k); this.vel.z = lerp(this.vel.z, moving ? lz * speed : 0, k);
    let nx = L.x + this.vel.x * dt, nz = L.z + this.vel.z * dt;
    if (pf.canMove) { if (!pf.canMove(L.x, L.z, nx, L.z, L.y)) { nx = L.x; this.vel.x = 0; } if (!pf.canMove(nx, L.z, nx, nz, L.y)) { nz = L.z; this.vel.z = 0; } }
    else if (pf.blocked && pf.blocked(nx, nz)) { nx = L.x; nz = L.z; }
    L.x = nx; L.z = nz;
    if (this.onGround && I.jumpP) { this.vel.y = 5.4; this.onGround = false; G.audio.sfx('jump'); }
    if (!this.onGround) { this.vel.y -= 16 * dt; L.y += this.vel.y * dt; }
    const sy = pf.surfaceAt(L.x, L.z, L.y);
    if (sy == null) { // stepped off the edge
      this.pos.copy(L).applyMatrix4(pf.group.matrixWorld);
      const vy = this.vel.y; this.vel.set(wx * speed * (moving ? 1 : 0), vy, wz * speed * (moving ? 1 : 0));
      this.detach(); this.onGround = false; this.moveSp = 0; return;
    }
    if (this.onGround) { if (sy < L.y - 0.6) this.onGround = false; else L.y = sy; }
    else if (L.y <= sy && this.vel.y <= 0) { L.y = sy; this.vel.y = 0; this.onGround = true; }
    this.pos.copy(L).applyMatrix4(pf.group.matrixWorld);
    this.moveSp = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && this.moveSp > 1) this.step(dt, 'wood');
  }

  moveWorld(dt, I, wx, wz, moving, waterH, ground) {
    const P = this.pos, depth = waterH - P.y;
    const wasSwim = this.swimming;
    this.swimming = depth > 1.2 && ground < waterH - 1.2 || (wasSwim && depth > 0.9 && ground < waterH - 0.9);
    if (this.swimming && !wasSwim && this.vel.y < -4) G.audio.sfx('splash');
    if (this.swimming) {
      const fl = this.hasGear('flippers') ? 1.7 : 1;
      const sprint = I.sprint && moving && this.stamina > 1;
      const speed = (sprint ? 4.3 : 2.9) * fl;
      if (sprint) this.stamina -= dt * 9;
      const under = depth > 1.75;
      let vy = 0;
      if (I.jump) vy += 2.6 * fl; if (I.down) vy -= 2.6 * fl;
      if (!I.jump && !I.down && !moving && under) vy += 1.0; // idle swimmers drift back up
      // looking up/down while swimming forward steers the dive
      if (moving && I.mz > 0.2 && (under || this.camPitch > 0.35)) vy += -Math.sin(this.camPitch) * speed * I.mz * 0.9;
      const k = 1 - Math.exp(-4 * dt);
      this.vel.x = lerp(this.vel.x, moving ? wx * speed : 0, k); this.vel.z = lerp(this.vel.z, moving ? wz * speed : 0, k);
      this.vel.y = lerp(this.vel.y, vy, k);
      // float back toward the surface when idle near it
      const surfY = waterH - 1.38;
      if (!I.down && vy >= 0 && P.y > surfY - 0.9) { P.y = damp(P.y, surfY, 5, dt); this.vel.y *= 0.8; }
      P.x += this.vel.x * dt; P.z += this.vel.z * dt; P.y += this.vel.y * dt;
      if (P.y > surfY + 0.05) { P.y = surfY + 0.05; if (this.vel.y > 0) this.vel.y = 0; }
      const g2 = terrainHeight(P.x, P.z);
      if (P.y < g2) { P.y = g2; if (this.vel.y < 0) this.vel.y = 0; }
      G.world.collide(P, 0.4);
      this.onGround = false; this.moveSp = Math.hypot(this.vel.x, this.vel.z, this.vel.y);
      // climb onto platforms
      for (const pf of G.platforms) {
        if (Math.abs(P.x - pf.group.position.x) > 60 || Math.abs(P.z - pf.group.position.z) > 60) continue;
        _m.copy(pf.group.matrixWorld).invert(); _v.copy(P).applyMatrix4(_m);
        if (_v.y < -2.6 || _v.y > 1) continue;
        const cp = pf.climb && pf.climb(_v.x, _v.z);
        if (cp) {
          this.climbPf = pf;
          const toward = moving && ((cp.x - _v.x) * (wx * Math.cos(pf.group.rotation.y) - wz * Math.sin(pf.group.rotation.y)) + (cp.z - _v.z) * (wx * Math.sin(pf.group.rotation.y) + wz * Math.cos(pf.group.rotation.y))) >= -0.05;
          if ((I.jump || toward) && this.vel.y > -1.5 && depth < 2.4) { this.attach(pf, cp); G.audio.sfx('climb'); this.swimming = false; return; }
        }
      }
      return;
    }
    // on foot
    const wading = depth > 0.45;
    const sprint = I.sprint && moving && this.stamina > 1 && this.onGround && !wading;
    const speed = (sprint ? 6.6 : 4.2) * (wading ? 0.6 : 1) * (this.hunger < 8 || this.thirst < 8 ? 0.7 : 1);
    if (sprint) this.stamina -= dt * 11;
    this.sprinting = sprint;
    const k = 1 - Math.exp(-(this.onGround ? 12 : 2.5) * dt);
    this.vel.x = lerp(this.vel.x, moving ? wx * speed : 0, k); this.vel.z = lerp(this.vel.z, moving ? wz * speed : 0, k);
    let nx = P.x + this.vel.x * dt, nz = P.z + this.vel.z * dt;
    if (this.onGround) { // refuse to walk up cliffs
      const hs = Math.hypot(nx - P.x, nz - P.z);
      if (hs > 1e-4) { const rise = terrainHeight(P.x + ((nx - P.x) / hs) * 0.7, P.z + ((nz - P.z) / hs) * 0.7) - ground; if (rise > 0.95) { nx = P.x; nz = P.z; this.vel.x *= 0.5; this.vel.z *= 0.5; } }
    }
    P.x = nx; P.z = nz;
    G.world.collide(P, 0.35);
    if (this.onGround && I.jumpP) { this.vel.y = 5.6; this.onGround = false; G.audio.sfx('jump'); }
    this.vel.y -= 17 * dt; P.y += this.vel.y * dt;
    const g2 = terrainHeight(P.x, P.z);
    if (P.y <= g2 + 0.02 || (this.onGround && P.y - g2 < 0.55 && this.vel.y <= 0)) {
      if (!this.onGround && this.vel.y < -14) this.hurt((-this.vel.y - 14) * 5, 'env');
      P.y = g2; this.vel.y = 0; this.onGround = true;
    } else this.onGround = false;
    // land on platforms
    if (this.vel.y <= 0.5) for (const pf of G.platforms) {
      if (Math.abs(P.x - pf.group.position.x) > 60 || Math.abs(P.z - pf.group.position.z) > 60) continue;
      _m.copy(pf.group.matrixWorld).invert(); _v.copy(P).applyMatrix4(_m);
      const sy = pf.surfaceAt(_v.x, _v.z, _v.y + 0.35);
      if (sy != null && _v.y <= sy + 0.1 && _v.y >= sy - 0.75) { _v.y = sy; this.attach(pf, _v); break; }
    }
    this.moveSp = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && this.moveSp > 1) this.step(dt, wading ? 'water' : g2 < 3 ? 'sand' : 'grass');
  }
  step(dt, surf) { this.stepT = (this.stepT || 0) - dt * (this.sprinting ? 1.5 : 1); if (this.stepT <= 0) { this.stepT = 0.42; G.audio.step(surf); } }

  // ---------- survival ----------
  updateSurvival(dt, waterH) {
    const env = G.env, P = this.pos;
    const act = this.sprinting || (this.swimming && this.moveSp > 3.4) ? 1.6 : 1;
    this.hunger = Math.max(0, this.hunger - (dt * 100 * act) / (18 * 60));
    this.thirst = Math.max(0, this.thirst - (dt * 100 * act * (this.temp > 36 ? 1.8 : 1)) / (13.5 * 60));
    if (!this.sprinting) this.stamina = Math.min(100, this.stamina + dt * (this.hunger > 15 && this.thirst > 15 ? 15 : 6));
    this.stamina = Math.max(0, this.stamina);
    if (this.hunger <= 0) this.hurt(dt * 0.7, 'env'); if (this.thirst <= 0) this.hurt(dt * 1.0, 'env');
    if (this.hunger > 45 && this.thirst > 45 && this.hp < 100 && this.hurtT <= 0) this.hp = Math.min(100, this.hp + dt * 0.6);
    // oxygen & pressure
    const headDepth = waterH - (P.y + 1.55);
    this.headUnder = this.swimming && headDepth > 0.12;
    const mo = this.maxO2;
    if (this.headUnder) { this.oxygen -= dt; if (this.oxygen <= 0) { this.oxygen = 0; this.hurt(dt * 9, 'env'); } if (headDepth > this.depthLimit) { this.hurt(dt * (3 + (headDepth - this.depthLimit) * 0.25), 'env'); this.pressureWarn = true; } else this.pressureWarn = false; }
    else { this.oxygen = Math.min(mo, this.oxygen + dt * mo * 0.4); this.pressureWarn = false; }
    this.oxygen = Math.min(this.oxygen, mo);
    // shelter & temperature
    this.sheltered = false;
    if (this.platform === G.raft) this.sheltered = G.raft.sheltered(this.local.x, this.local.z, this.local.y);
    else for (const s of G.world.shelters) if (Math.hypot(s.x - P.x, s.z - P.z) < 2.2) this.sheltered = true;
    let t = env.tempAmbient;
    if (this.swimming) t -= this.hasGear('suit') ? 1 : t < 12 ? 16 : 5;
    else if (env.rain > 0.2 && !this.sheltered) t -= 4 * env.rain;
    if (this.sheltered) t += 3;
    if (this.hasGear('coat') && t < 22) t += Math.min(20, 22 - t);
    if (this.held && this.held.id === 'torch' && !this.swimming) t += 6;
    let warm = 0;
    if (this.platform === G.raft) for (const d of G.raft.devs) if ((d.type === 'grill' && d.hot) || d.type === 'forge') warm = Math.max(warm, 1 - d.wpos.distanceTo(P) / 6);
    for (const w of G.world.warmSpots || []) warm = Math.max(warm, 1 - Math.hypot(w.x - P.x, w.z - P.z) / 7);
    if (warm > 0 && t < 26) t += Math.min(26 - t, warm * 30);
    const lv = G.world.lava;
    if (lv) { const d = Math.hypot(P.x - lv.x, P.z - lv.z); if (d < lv.r * 3) t += (1 - d / (lv.r * 3)) * 40; if (d < lv.r && P.y < lv.y + 1.5) this.hurt(dt * 45, 'env'); }
    this.temp = damp(this.temp, t, 0.12, dt);
    if (this.temp < 9) this.hurt(dt * (9 - this.temp) * 0.14, 'env');
    if (this.temp > 44) this.hurt(dt * (this.temp - 44) * 0.2, 'env');
    // dive light
    const dark = env.light < 0.3 || (this.headUnder && headDepth > 18);
    this.light.intensity = damp(this.light.intensity, dark && this.hasGear('dive_light') ? 60 : 0, 4, dt);
    this.light.position.set(P.x + Math.sin(this.yaw) * 0.6, P.y + 1.7, P.z + Math.cos(this.yaw) * 0.6);
  }

  // ---------- held tool visuals ----------
  updateHeld() {
    const id = this.held && this.held.type === 'tool' ? this.held.id : null;
    if (id !== this.heldId) { this.heldId = id; this.h.held.clear(); if (id) this.h.held.add(makeHeld(id)); }
  }

  // ---------- actions ----------
  updateActions(dt, I) {
    const it = this.held;
    if (this.atk > 0) {
      const before = this.atk; this.atk -= dt;
      if (before > this.atkLen * 0.55 && this.atk <= this.atkLen * 0.55) this.strike();
    }
    if (this.fish) this.updateFishing(dt, I);
    const hammer = it && it.id === 'hammer';
    if (hammer && !this.helm && this.platformIsRaftNear()) this.updateBuild(I); else { G.raft.showGhost(null); this.buildInfo = null; }
    if (G.ents.hookOut && (!it || it.id !== 'hook')) G.ents.cancelHook();
    if (this.helm || this.cd > 0) return;
    if (I.rotP) this.build.rot = (this.build.rot + 1) % 4;
    if (!it) { if (I.actP) this.swing(0.4); return; }
    switch (it.id) {
      case 'hammer': if (I.actP) this.doBuild(); break;
      case 'hook': if (I.actP && !G.ents.hookOut) { this.throwDir(_v); _v.y += 0.45; _v.normalize(); G.ents.throwHook(_v2.copy(this.pos).setY(this.pos.y + 1.5), _v); this.swing(0.4, true); G.audio.sfx('throw'); } G.ents.reeling = I.act && G.ents.hookOut; break;
      case 'paddle': if (I.act && this.platform === G.raft) { G.raft.paddle.set(Math.sin(this.camYaw) * 2.0, 0, Math.cos(this.camYaw) * 2.0); G.raft.paddleT = 0.25; this.stamina = Math.max(0, this.stamina - dt * 3); if (this.atk <= 0) { this.swing(0.7, true); G.audio.sfx('paddle'); } emit('paddle'); } break;
      case 'bow': if (I.actP) { if (this.inv.count('arrow') < 1) { G.ui.toast('No arrows'); this.cd = 0.4; break; } this.inv.remove('arrow', 1); _v2.copy(this.pos).setY(this.pos.y + 1.5); this.aimDir(_v2, _v, 34); G.ents.shootArrow(_v2.addScaledVector(_v, 0.5), _v, 34, 'player'); this.cd = 0.75; G.audio.sfx('bow'); } break;
      case 'rod': if (I.actP) this.fishAction(); break;
      default:
        if (it.type === 'tool') { if (I.actP || (I.act && this.atk <= 0)) this.swing(it.id.startsWith('spear') || it.id === 'harpoon' ? 0.42 : 0.5); }
        else if (I.actP && ['food', 'drink', 'med'].includes(it.type)) { this.consume(this.sel); this.cd = 0.35; }
        else if (I.actP && it.type === 'place') this.placeKit(it.id);
    }
  }
  placeKit(id) {
    this.cd = 0.4;
    const x = this.pos.x + Math.sin(this.camYaw) * 1.9, z = this.pos.z + Math.cos(this.camYaw) * 1.9, h = terrainHeight(x, z);
    if (this.platform || this.swimming || h < 0.7 || Math.abs(h - this.pos.y) > 1.2) { G.ui.toast('Place this on dry, level ground'); return; }
    G.world.addCamp({ t: id, x, z, r: this.camYaw + Math.PI }, true);
    const s = this.inv.slots[this.sel]; s.n--; if (s.n <= 0) this.inv.slots[this.sel] = null; G.ui.dirty = true;
    G.audio.sfx('build'); emit('camp', id); G.ui.toast(id === 'campfire' ? '🔥 Campfire lit' : '⛺ Lean-to raised');
  }
  cookLabel(d, name) { const done = d.cook.filter((c) => c.done).length; if (done) return `Take cooked food (${done})`; const raw = this.rawFood(); if (raw != null && d.cook.length < 3) return `Cook ${ITEMS[this.inv.slots[raw].id].name}`; return d.cook.length ? 'Cooking…' : `${name} (need raw food)`; }
  cookAt(d) {
    const done = d.cook.filter((c) => c.done);
    if (done.length) { const g = {}; for (const c of done) g[c.id] = (g[c.id] || 0) + 1; for (let i = d.cook.length - 1; i >= 0; i--) if (d.cook[i].done) d.cook.splice(i, 1); this.give(g); for (const c of done) emit('cooked', c.id); return; }
    const raw = this.rawFood(); if (raw == null || d.cook.length >= 3) { G.ui.toast(d.cook.length ? 'Still cooking' : 'You have nothing to cook'); return; }
    const s = this.inv.slots[raw]; d.cook.push({ id: s.id, t: 16 }); s.n--; if (s.n <= 0) this.inv.slots[raw] = null; G.ui.dirty = true; G.audio.sfx('sizzle');
  }
  sleepAt() {
    const t = G.env.time;
    if (t > 6 && t < 19) { G.ui.toast('You can only sleep at night'); return; }
    if (G.ents.dangerNear()) { G.ui.toast('Not safe to sleep now'); return; }
    G.ui.fade(() => { G.env.sleepTo(6.5); this.hunger = Math.max(8, this.hunger - 16); this.thirst = Math.max(8, this.thirst - 20); this.hp = Math.min(100, this.hp + 45); this.stamina = 100; emit('sleep'); }, 'You sleep until dawn…');
  }
  platformIsRaftNear() { return this.platform === G.raft || (this.swimming && this.pos.distanceTo(G.raft.group.position) < G.raft.radius + 6); }
  throwDir(out) { const cp = Math.cos(this.camPitch); return out.set(Math.sin(this.camYaw) * cp, -Math.sin(this.camPitch), Math.cos(this.camYaw) * cp).normalize(); }
  // direction from `org` to whatever the crosshair is on, with a little aim assist and drop compensation
  aimDir(org, out, speed) {
    const f = this.throwDir(_v3), cp = this.cam.position; let best = null, ba = 0.075;
    for (const t of G.ents.targetList()) {
      const tx = t.pos.x - cp.x, ty = t.pos.y + (t.kind === 'pirate' ? 1 : 0.2) - cp.y, tz = t.pos.z - cp.z, d = Math.hypot(tx, ty, tz);
      if (d > 70 || d < 1) continue; const a = Math.acos(Math.min(1, (tx * f.x + ty * f.y + tz * f.z) / d)) - Math.atan2(t.r, d) * 0.6;
      if (a < ba) { ba = a; best = t; }
    }
    if (best) out.set(best.pos.x, best.pos.y + (best.kind === 'pirate' ? 1 : 0.2), best.pos.z); else out.copy(cp).addScaledVector(f, 55);
    out.sub(org); const d = out.length(); out.y += (4.5 * d * d) / (speed * speed); return out.normalize();
  }
  swing(len, quiet) { if (this.atk > 0) return; this.atk = this.atkLen = len; this.quietSwing = quiet; this.stamina = Math.max(0, this.stamina - 3); if (!quiet) G.audio.sfx('swing'); }
  strike() {
    if (this.quietSwing) return;
    const it = this.held, dmg = (it && it.dmg) || 5, reach = (it && it.reach) || 2.3;
    const dir = _v.set(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const org = _v2.copy(this.pos).setY(this.pos.y + 1.1);
    if (G.ents.melee(org, dir, reach, dmg * (this.stamina < 5 ? 0.6 : 1))) { G.audio.sfx('hit'); return; }
    // resource nodes
    const probe = _v3.copy(this.pos).addScaledVector(dir, 1.3);
    const n = G.world.nearestNode(probe, 2.4, (k) => k.def.mode !== 'hand');
    if (!n) return;
    const d = n.def, tool = it || {};
    if (d.mode === 'chop' && !tool.chop) { G.ui.toast('Needs an axe'); return; }
    if (d.mode === 'mine' && !tool.mine) { G.ui.toast('Needs a pickaxe'); return; }
    if (d.tier === 2 && tool.mine < 2) { G.ui.toast('Needs an iron pickaxe'); return; }
    const pow = d.mode === 'chop' ? tool.chop : tool.mine;
    n.hp -= 22 * pow; G.audio.sfx(d.mode === 'chop' ? 'chop' : 'mine');
    G.ents.puff(n.x, n.y + 1.2, n.z, d.mode === 'chop' ? 0x8a6a40 : 0x999999, 5);
    if (n.hp <= 0) { this.give(rollLoot(d.yield)); G.world.killNode(n); emit('harvest', n.type); }
  }

  // ---------- fishing ----------
  fishAction() {
    if (!this.fish) {
      const dir = _v.set(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
      let ok = null;
      for (const d of [9, 7, 5, 3.5]) { const x = this.pos.x + dir.x * d, z = this.pos.z + dir.z * d; if (terrainHeight(x, z) < -0.8 && !G.raftTileAtWorld(x, z)) { ok = { x, z }; break; } }
      if (!ok) { G.ui.toast('Cast toward open water'); this.cd = 0.4; return; }
      this.fish = { x: ok.x, z: ok.z, t: rand(4, 11) * (G.env.rain > 0.3 ? 0.6 : 1), bite: 0 };
      this.swing(0.5, true); G.audio.sfx('throw'); this.cd = 0.5;
    } else if (this.fish.bite > 0) {
      const deep = terrainHeight(this.fish.x, this.fish.z) < -25, r = Math.random();
      const loot = r < 0.72 ? { raw_fish: deep && Math.random() < 0.4 ? 2 : 1 } : r < 0.82 ? { scrap: 1 } : r < 0.9 ? { seaweed: 2 } : r < 0.96 ? { rope: 1 } : { pearl: 1 };
      this.give(loot); emit('fish', Object.keys(loot)[0]); G.audio.sfx('splash'); this.fish = null; this.cd = 0.5;
    } else { this.fish = null; this.cd = 0.4; G.ui.toast('Reeled in too early'); }
    this.floatM.visible = this.line.visible = !!this.fish;
  }
  updateFishing(dt, I) {
    const f = this.fish;
    if (!this.held || this.held.id !== 'rod' || this.swimming || Math.hypot(f.x - this.pos.x, f.z - this.pos.z) > 16) { this.fish = null; this.floatM.visible = this.line.visible = false; return; }
    if (f.bite > 0) { f.bite -= dt; if (f.bite <= 0) { this.fish = null; this.floatM.visible = this.line.visible = false; G.ui.toast('It got away…'); return; } }
    else { f.t -= dt; if (f.t <= 0) { f.bite = 1.7; G.audio.sfx('bite'); G.ui.toast('🎣 A bite! Reel in!'); } }
    const y = waveHeight(f.x, f.z) + (f.bite > 0 ? -0.12 + Math.sin(G.clock * 30) * 0.06 : 0.04);
    this.floatM.position.set(f.x, y, f.z); this.floatM.visible = this.line.visible = true;
    const p = this.line.geometry.attributes.position; this.h.held.getWorldPosition(_v); p.setXYZ(0, _v.x, _v.y + 1.4, _v.z); p.setXYZ(1, f.x, y, f.z); p.needsUpdate = true;
  }

  // ---------- building ----------
  updateBuild(I) {
    const raft = G.raft, b = this.build;
    if (!b.type && !b.remove) { raft.showGhost(null); this.buildInfo = { repair: true }; return; }
    // aim point on the build plane, in raft local space
    const pl = this.platform === raft ? raft.levelOf(this.local.y) : 0;
    const def = b.type ? PIECES[b.type] : null;
    const planeY = (def && def.kind === 'tile' ? 0 : pl) * LH + DECK;
    _m.copy(raft.group.matrixWorld).invert();
    const cp = Math.cos(this.camPitch);
    _ray.origin.copy(this.cam.position).applyMatrix4(_m);
    _ray.direction.set(Math.sin(this.camYaw) * cp, -Math.sin(this.camPitch), Math.cos(this.camYaw) * cp).transformDirection(_m);
    const me = _v2.copy(this.pos).applyMatrix4(_m);
    let lx, lz; const t = (planeY - _ray.origin.y) / _ray.direction.y;
    if (_ray.direction.y < -0.02 && t > 0) { lx = _ray.origin.x + _ray.direction.x * t; lz = _ray.origin.z + _ray.direction.z * t; }
    if (lx === undefined || Math.hypot(lx - me.x, lz - me.z) > 6.5) {
      const fy = this.camYaw - raft.yaw; lx = me.x + Math.sin(fy) * 2.2; lz = me.z + Math.cos(fy) * 2.2;
    }
    if (b.remove) {
      raft.showGhost(null);
      this.buildInfo = { remove: true, target: raft.pieceNear(lx, lz, pl) };
      return;
    }
    let o = raft.probe(b.type, lx, lz, pl, b.rot);
    if (def.kind === 'tile' && !o.ok && o.why === 'Occupied') { // aim past the deck edge: slide outward to the first open cell
      const fy = this.camYaw - raft.yaw, sx = Math.sin(fy), sz = Math.cos(fy);
      for (let k = 1; k <= 8 && !o.ok && o.why === 'Occupied'; k++) o = raft.probe(b.type, lx + sx * k * 0.7, lz + sz * k * 0.7, pl, b.rot);
    }
    o.afford = this.inv.has(def.cost);
    raft.showGhost(b.type, o);
    this.buildInfo = { place: o, type: b.type, lx, lz, pl };
  }
  doBuild() {
    const raft = G.raft, bi = this.buildInfo; if (!bi) return;
    this.cd = 0.25;
    if (bi.repair) {
      const l = _v.copy(this.pos).applyMatrix4(_m.copy(raft.group.matrixWorld).invert());
      let best = null, bd = 3.2;
      for (const p of raft.pieces.values()) if (p.hp < p.maxHp) { const d = Math.hypot(p.i * TS - l.x, p.j * TS - l.z) + Math.abs(p.l - raft.levelOf(l.y)) * 2; if (d < bd) { bd = d; best = p; } }
      if (!best) { G.ui.toast('Open the Build menu to choose a piece'); return; }
      if (!this.inv.pay({ wood: 1 })) { G.ui.toast('Repair needs 🪵1'); return; }
      best.hp = best.maxHp; raft.rebuild(); this.swing(0.4, true); G.audio.sfx('build'); G.ui.toast('Repaired ' + PIECES[best.type].name); emit('repair');
      return;
    }
    if (bi.remove) {
      const p = bi.target; if (!p) { G.ui.toast('Nothing to remove here'); return; }
      if (p.slot === 'T' && p.l === 0 && raft.nTiles <= 1) { G.ui.toast('Cannot remove the last foundation'); return; }
      const me = _v.copy(this.pos).applyMatrix4(_m.copy(raft.group.matrixWorld).invert());
      if (p.slot === 'T' && Math.round(me.x / TS) === p.i && Math.round(me.z / TS) === p.j && raft.levelOf(me.y) === p.l && this.platform === raft) { G.ui.toast("You're standing on it"); return; }
      if (p.type === 'chest' && p.slots.some((s) => s)) { G.ui.toast('Empty the chest first'); return; }
      const refund = {}; for (const [k, n] of Object.entries(PIECES[p.type].cost)) { const r = Math.floor(n / 2); if (r) refund[k] = r; }
      raft.remove(p); this.give(refund); G.audio.sfx('break'); this.swing(0.4, true);
      return;
    }
    const o = bi.place, def = PIECES[bi.type];
    if (!o.ok) { G.ui.toast(o.why || "Can't build there"); return; }
    if (!this.inv.pay(def.cost)) { G.ui.toast('Need ' + costText(def.cost)); return; }
    if (o.upgrade) raft.remove(o.upgrade, true);
    raft.add({ type: bi.type, i: o.i, j: o.j, l: o.l, r: o.r });
    this.swing(0.4, true); G.audio.sfx('build'); G.ui.dirty = true;
  }

  // ---------- interaction ----------
  updateInteract(dt, I) {
    this.intT = (this.intT || 0) - dt;
    if (this.intT <= 0 || I.useP) { this.intT = 0.12; this.target = this.helm ? null : this.findTarget(); }
    const t = this.target;
    G.ui.setPrompt(this.helm ? 'Leave helm' : t ? t.label : this.climbHint());
    if (I.useP && t && !this.helm) { t.use(); this.target = null; this.intT = 0; }
  }
  climbHint() {
    if (!this.swimming) return null;
    for (const pf of G.platforms) { if (pf.group.position.distanceToSquared(this.pos) > 3600) continue; _v.copy(this.pos).applyMatrix4(_m.copy(pf.group.matrixWorld).invert()); if (_v.y > -2.6 && pf.climb && pf.climb(_v.x, _v.z)) return { text: 'Climb aboard', key: 'jump' }; }
    return null;
  }
  findTarget() {
    const P = this.pos, raft = G.raft; let best = null, bd = 1e9;
    const eye = _v3.copy(P).setY(P.y + 1); const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    const score = (pos, r) => { const dx = pos.x - eye.x, dy = pos.y - eye.y, dz = pos.z - eye.z, d = Math.hypot(dx, dy, dz); if (d > r) return 1e9; const facing = d > 0.6 ? (dx * fx + dz * fz) / d : 1; return d - facing * 0.8; };
    const consider = (pos, r, label, use) => { const s = score(pos, r); if (s < bd) { bd = s; best = { label: { text: typeof label === 'function' ? label() : label }, use }; } };
    // raft devices
    if (P.distanceToSquared(raft.group.position) < (raft.radius + 6) ** 2) for (const d of raft.devs) consider(d.wpos, 2.5, () => this.deviceLabel(d), () => this.useDevice(d));
    // world objects
    for (const it of G.world.interactables) {
      if (Math.abs(it.pos.x - P.x) > 8 || Math.abs(it.pos.z - P.z) > 8) continue;
      if (it.kind === 'dig' && (!G.prog.flags.treasure_map || G.prog.looted[it.id])) continue;
      if (it.kind === 'camp') { consider(it.pos, it.r, it.label, it.use); continue; }
      consider(it.pos, it.r, () => (G.prog.looted[it.id] && it.kind !== 'journal' && it.kind !== 'water' && it.kind !== 'core' ? 'Empty' : it.label()), () => this.useWorld(it));
    }
    // gatherable nodes
    const n = G.world.nearestNode(P, 2.6, (k) => k.def.mode === 'hand' || (k.def.hand && !k.picked));
    if (n) { _v.set(n.x, n.y + 0.6, n.z); consider(_v, 3, n.def.mode === 'hand' ? 'Gather ' + n.def.name : n.def.handLabel, () => this.gather(n)); }
    for (const e of G.ents.interactables(P)) consider(e.pos, e.r, e.label, e.use);
    return best;
  }
  gather(n) {
    if (n.dead) return;
    if (n.def.mode === 'hand') { this.give(rollLoot(n.def.yield)); G.world.killNode(n, n.type === 'pebble' || n.type === 'sandp' ? 300 : 420); }
    else { this.give(rollLoot(n.def.hand)); n.picked = true; }
    G.audio.sfx('pickup'); emit('harvest', n.type); this.swing(0.35, true);
  }
  useWorld(it) {
    const pr = G.prog;
    if (it.kind === 'water') { this.thirst = Math.min(100, this.thirst + 55); const e = this.inv.count('flask'); if (e) { this.inv.remove('flask', e); this.inv.add('flask_full', e); G.ui.toast(`Filled ${e} flask${e > 1 ? 's' : ''}`); } G.audio.sfx('drink'); emit('drink'); return; }
    if (it.kind === 'journal') { G.story.read(it.journal); return; }
    if (it.kind === 'core') { G.story.useCore(); return; }
    if (pr.looted[it.id]) { G.ui.toast('Nothing left here'); return; }
    if (it.need && !pr.flags[it.need]) { G.ui.toast('You need something to find this…'); return; }
    const loot = rollLoot(it.loot || {});
    if (this.inv.freeSlots() < Math.min(3, Object.keys(loot).length) && Object.keys(loot).some((k) => this.inv.count(k) === 0)) { G.ui.toast('Make room in your inventory first'); return; }
    pr.looted[it.id] = 1; if (it.lid) it.lid.rotation.x = -1.3; if (it.xm) it.xm.visible = false;
    G.audio.sfx('chest'); this.give(loot);
    if (it.bp) pr.unlockBP(it.bp);
    if (it.flag) pr.setFlag(it.flag);
    if (it.journal) G.story.read(it.journal, true);
    emit('loot', it.id, it);
    G.world.applyLooted();
  }
  deviceLabel(d) {
    const n = PIECES[d.type].name;
    switch (d.type) {
      case 'chest': return 'Open ' + n;
      case 'bed': return 'Sleep';
      case 'grill': return this.cookLabel(d, 'Grill');
      case 'purifier': case 'purifier2': case 'collector': return d.water >= 1 ? `Drink / fill flask (${Math.floor(d.water)}💧)` : (d.type === 'collector' ? 'Rain collector (empty)' : 'Distilling water…');
      case 'net': return d.caught.length ? `Empty net (${d.caught.length})` : 'Collection net (empty)';
      case 'planter': return d.grow < 0 ? (this.inv.count('seed') ? 'Plant seed potato' : 'Planter (need seed potato)') : d.grow >= 1 ? 'Harvest potatoes' : `Growing… ${Math.round(d.grow * 100)}%`;
      case 'bench': case 'forge': return 'Use ' + n;
      case 'sail': case 'sail2': return d.open ? 'Furl sail' : 'Open sail';
      case 'anchor': return d.down ? 'Raise anchor' : 'Drop anchor';
      case 'wheel': return 'Take the helm';
      case 'navtable': return 'Study charts';
      case 'radio': return G.story.radioPending() ? 'Listen: incoming transmission' : 'Radio (static)';
      case 'engine': return d.on ? 'Stop engine' : d.fuel > 0 ? `Start engine (fuel ${Math.ceil(d.fuel)})` : 'Fuel engine with planks';
      case 'turret': return 'Ballista (automatic)';
      case 'lantern': case 'beacon': return n;
    }
    return n;
  }
  rawFood() {
    const s = this.inv.slots[this.sel]; if (s && ITEMS[s.id].cook) return this.sel;
    for (let i = 0; i < this.inv.slots.length; i++) { const k = this.inv.slots[i]; if (k && ITEMS[k.id].cook) return i; }
    return null;
  }
  useDevice(d) {
    const raft = G.raft, ui = G.ui;
    switch (d.type) {
      case 'chest': ui.openChest(d); G.audio.sfx('chest'); break;
      case 'bed': this.sleepAt(); break;
      case 'grill': this.cookAt(d); break;
      case 'purifier': case 'purifier2': case 'collector': {
        if (d.water < 1) { ui.toast(d.type === 'collector' ? 'Empty. It fills when it rains.' : 'Not ready yet'); break; }
        if (this.thirst < 80) { this.thirst = Math.min(100, this.thirst + 45); d.water -= 1; G.audio.sfx('drink'); emit('drink'); }
        else if (this.inv.count('flask')) { this.inv.remove('flask', 1); this.inv.add('flask_full', 1); d.water -= 1; ui.toast('Filled a flask'); G.audio.sfx('drink'); }
        else ui.toast('Not thirsty. Craft a flask to store water.');
        break;
      }
      case 'net': if (d.caught.length) { const g = {}; for (const id of d.caught) g[id] = (g[id] || 0) + 1; d.caught = []; this.give(g); G.audio.sfx('pickup'); } break;
      case 'planter': if (d.grow < 0) { if (this.inv.remove('seed', 1)) { d.grow = 0; G.audio.sfx('pickup'); emit('plant'); } } else if (d.grow >= 1) { d.grow = -1; this.give({ seed: 3 }); emit('farm'); } break;
      case 'bench': ui.openCraft('bench'); break;
      case 'forge': ui.openCraft('forge'); break;
      case 'sail': case 'sail2': d.open = !d.open; raft.refreshStats(); G.audio.sfx('sail'); break;
      case 'anchor': d.down = !d.down; raft.refreshStats(); G.audio.sfx('splash'); ui.toast(d.down ? '⚓ Anchor dropped' : 'Anchor raised'); break;
      case 'wheel': this.helm = d; G.input.useP = false; ui.toast('Steer left/right. Forward/back sets engine throttle.'); emit('helm'); break;
      case 'navtable': ui.openMap(); break;
      case 'radio': G.story.listen(); break;
      case 'engine':
        if (d.on) d.on = false;
        else { if (d.fuel <= 0) { const w = Math.min(10, this.inv.count('wood')); if (!w) { ui.toast('Needs planks for fuel'); break; } this.inv.remove('wood', w); d.fuel = w; } d.on = true; emit('engine'); }
        raft.refreshStats(); G.audio.sfx('engine'); break;
    }
  }

  // ---------- camera ----------
  updateCamera(dt, I) {
    const raft = G.raft;
    let want = 5 * G.settings.camDist;
    if (this.helm) want = 9 + raft.radius * 1.3; else if (this.held && this.held.id === 'hammer' && (this.build.type || this.build.remove)) want = 7;
    this.camDist = damp(this.camDist, want, 4, dt);
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const tx = this.pos.x, ty = this.pos.y + 1.55 + (this.swimming ? -0.5 : 0), tz = this.pos.z;
    const c = this.cam.position;
    // shoulder offset so the crosshair is not hidden by the character
    const ox = Math.cos(this.camYaw) * -0.55, oz = -Math.sin(this.camYaw) * -0.55;
    c.set(tx - Math.sin(this.camYaw) * cp * this.camDist + ox, ty + sp * this.camDist, tz - Math.cos(this.camYaw) * cp * this.camDist + oz);
    const g = terrainHeight(c.x, c.z) + 0.4; if (c.y < g) c.y = g;
    if (!this.swimming && !this.headUnder) { const wh = waveHeight(c.x, c.z) + 0.25; if (c.y < wh && this.pos.y > wh - 1.2) c.y = wh; }
    this.cam.lookAt(_v.set(tx + ox + Math.sin(this.camYaw) * cp * 12, ty - sp * 12 + 0.2, tz + oz + Math.cos(this.camYaw) * cp * 12));
  }

  serialize() { return { pos: this.pos.toArray(), onRaft: this.platform === G.raft, local: this.local.toArray(), hp: this.hp, hunger: this.hunger, thirst: this.thirst, stamina: this.stamina, temp: this.temp, inv: this.inv.slots, sel: this.sel, camYaw: this.camYaw }; }
  load(d) {
    this.hp = d.hp; this.hunger = d.hunger; this.thirst = d.thirst; this.stamina = d.stamina; this.temp = d.temp ?? 24; this.sel = d.sel || 0; this.camYaw = d.camYaw || 0;
    this.inv.slots = d.inv.map((s) => (s && ITEMS[s.id] ? { id: s.id, n: s.n } : null)); while (this.inv.slots.length < 32) this.inv.slots.push(null);
    this.dead = false; this.helm = null; this.fish = null; this.oxygen = this.maxO2;
    if (d.onRaft) { const l = new THREE.Vector3().fromArray(d.local); if (G.raft.surfaceAt(l.x, l.z, l.y + 0.3) == null) this.respawnOnRaft(); else this.attach(G.raft, l); }
    else { this.platform = null; this.pos.fromArray(d.pos); this.vel.set(0, 0, 0); if (this.pos.y < terrainHeight(this.pos.x, this.pos.z)) this.pos.y = terrainHeight(this.pos.x, this.pos.z); }
  }
  respawnOnRaft() { const t = [...G.raft.pieces.values()].find((p) => p.slot === 'T' && p.l === 0); this.attach(G.raft, new THREE.Vector3(t.i * TS, DECK, t.j * TS)); }
}
