// Procedural models: humanoids, ships, sea life, held tools.
import * as THREE from 'three';
import { mat, tex } from './textures.js';
import { clamp, lerp } from './util.js';

const geoCache = {};
export function geo(key, make) { return geoCache[key] || (geoCache[key] = make()); }
export const boxG = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cylG = (rt, rb, h, s = 8) => geo(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
export const sphG = (r, w = 10, h = 8) => geo(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
export const capG = (r, l) => geo(`k${r},${l}`, () => new THREE.CapsuleGeometry(r, l, 3, 8));
export const coneG = (r, h, s = 8) => geo(`o${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));

export function mesh(g, m, x = 0, y = 0, z = 0, parent, shadow = true) {
  const o = new THREE.Mesh(g, typeof m === 'string' ? mat(m) : m);
  o.position.set(x, y, z);
  o.castShadow = shadow; o.receiveShadow = true;
  if (parent) parent.add(o);
  return o;
}
export const colMat = (c, o = {}) => mat('plain', { color: c, ...o });

// ---------- humanoid ----------
export function makeHumanoid(o = {}) {
  const skin = colMat(o.skin ?? 0xc68e62), shirt = colMat(o.shirt ?? 0x6f7a63), pants = colMat(o.pants ?? 0x4d4636);
  const hairM = colMat(o.hair ?? 0x2e2118), boot = colMat(0x2b241d);
  const root = new THREE.Group();
  const pelvis = new THREE.Group(); pelvis.position.y = 0.94; root.add(pelvis);
  mesh(boxG(0.34, 0.2, 0.22), pants, 0, 0, 0, pelvis);
  const torso = new THREE.Group(); torso.position.y = 0.08; pelvis.add(torso);
  const chest = mesh(capG(0.165, 0.3), shirt, 0, 0.3, 0, torso); chest.scale.set(1.18, 1, 0.82);
  mesh(boxG(0.36, 0.06, 0.2), colMat(0x3a2c1c), 0, 0.03, 0, torso); // belt
  const head = new THREE.Group(); head.position.y = 0.66; torso.add(head);
  mesh(cylG(0.055, 0.06, 0.1), skin, 0, -0.04, 0, head);
  const skull = mesh(sphG(0.125, 12, 10), skin, 0, 0.1, 0, head); skull.scale.set(0.95, 1.1, 1);
  const hair = mesh(geo('hair', () => new THREE.SphereGeometry(0.133, 12, 8, 0, 6.3, 0, 1.75)), hairM, 0, 0.115, -0.012, head); hair.scale.set(0.97, 1.08, 1.02);
  if (o.beard !== false) { const b = mesh(sphG(0.09, 8, 6), hairM, 0, 0.035, 0.06, head); b.scale.set(1.05, 0.7, 0.75); }
  mesh(boxG(0.03, 0.03, 0.03), skin, 0, 0.09, 0.125, head); // nose
  for (const sx of [-1, 1]) mesh(sphG(0.016, 6, 4), colMat(0x1a1a1a), sx * 0.045, 0.125, 0.112, head, false);
  if (o.hat === 'bandana') { const b = mesh(geo('band', () => new THREE.SphereGeometry(0.137, 12, 6, 0, 6.3, 0, 1.25)), colMat(o.hatColor ?? 0x8c1f1f), 0, 0.125, 0, head); b.scale.set(1, 1.05, 1.04); }
  if (o.hat === 'tricorn') { mesh(cylG(0.24, 0.26, 0.03, 3), colMat(0x16130f), 0, 0.2, 0, head); mesh(cylG(0.11, 0.13, 0.1, 10), colMat(0x16130f), 0, 0.25, 0, head); }
  if (o.pack) { mesh(boxG(0.3, 0.38, 0.16), colMat(0x5d5138), 0, 0.32, -0.2, torso); mesh(boxG(0.26, 0.1, 0.12), colMat(0x6d6145), 0, 0.56, -0.19, torso); }
  const arm = (sx) => {
    const sh = new THREE.Group(); sh.position.set(sx * 0.245, 0.5, 0); torso.add(sh);
    mesh(sphG(0.07, 8, 6), shirt, 0, 0, 0, sh);
    mesh(capG(0.052, 0.2), o.sleeves === false ? skin : shirt, 0, -0.15, 0, sh);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    mesh(capG(0.044, 0.2), skin, 0, -0.13, 0, el);
    const hand = new THREE.Group(); hand.position.y = -0.29; el.add(hand);
    mesh(sphG(0.05, 8, 6), skin, 0, 0, 0, hand);
    return { sh, el, hand };
  };
  const leg = (sx) => {
    const hip = new THREE.Group(); hip.position.set(sx * 0.1, -0.06, 0); pelvis.add(hip);
    mesh(capG(0.078, 0.26), pants, 0, -0.2, 0, hip);
    const knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee);
    mesh(capG(0.058, 0.28), o.shorts ? skin : pants, 0, -0.2, 0, knee);
    mesh(boxG(0.1, 0.08, 0.24), boot, 0, -0.42, 0.045, knee);
    return { hip, knee };
  };
  const h = { root, pelvis, torso, head, aL: arm(-1), aR: arm(1), lL: leg(-1), lR: leg(1), phase: 0 };
  h.held = new THREE.Group(); h.aR.hand.add(h.held);
  return h;
}

// mode: idle | move | swim | helm | dead ; speed 0..1.5 ; atk 0..1 swing progress (0 = none)
export function animateHumanoid(h, mode, dt, speed = 0, atk = 0, t = 0) {
  const { pelvis, torso, head, aL, aR, lL, lR } = h;
  const k = 1 - Math.exp(-14 * dt);
  const set = (obj, x, y = 0, z = 0) => { obj.rotation.x = lerp(obj.rotation.x, x, k); obj.rotation.y = lerp(obj.rotation.y, y, k); obj.rotation.z = lerp(obj.rotation.z, z, k); };
  let py = 0.94, prx = 0;
  if (mode === 'move') {
    h.phase += dt * (5.5 + speed * 5.5);
    const s = Math.sin(h.phase), c = Math.cos(h.phase), amp = 0.5 + speed * 0.35;
    set(lL.hip, s * amp); set(lR.hip, -s * amp);
    set(lL.knee, Math.max(0, -c) * amp * 1.5); set(lR.knee, Math.max(0, c) * amp * 1.5);
    set(aL.sh, -s * amp * 0.8, 0, 0.08); set(aR.sh, s * amp * 0.8, 0, -0.08);
    set(aL.el, -0.3 - speed * 0.5); set(aR.el, -0.3 - speed * 0.5);
    set(torso, 0.06 + speed * 0.1, s * 0.08); set(head, -0.04);
    py = 0.94 + Math.abs(c) * 0.035;
  } else if (mode === 'swim') {
    h.phase += dt * (2.5 + speed * 4);
    const s = Math.sin(h.phase), c = Math.cos(h.phase);
    prx = 1.25;
    set(lL.hip, s * 0.4); set(lR.hip, -s * 0.4); set(lL.knee, 0.25 + c * 0.2); set(lR.knee, 0.25 - c * 0.2);
    set(aL.sh, -2.6 + s * 0.9, 0, 0.25 + c * 0.3); set(aR.sh, -2.6 - s * 0.9, 0, -0.25 + c * 0.3);
    set(aL.el, -0.3); set(aR.el, -0.3); set(torso, 0); set(head, -0.9);
  } else if (mode === 'tread') {
    h.phase += dt * 3.5;
    const s = Math.sin(h.phase), c = Math.cos(h.phase);
    set(lL.hip, s * 0.35); set(lR.hip, -s * 0.35); set(lL.knee, 0.5 + c * 0.2); set(lR.knee, 0.5 - c * 0.2);
    set(aL.sh, -0.5, 0, 1.0 + s * 0.3); set(aR.sh, -0.5, 0, -1.0 - s * 0.3);
    set(aL.el, -0.5); set(aR.el, -0.5); set(torso, 0); set(head, 0);
  } else if (mode === 'helm') {
    set(lL.hip, 0); set(lR.hip, 0); set(lL.knee, 0); set(lR.knee, 0);
    set(aL.sh, -1.25, 0, 0.15); set(aR.sh, -1.25, 0, -0.15); set(aL.el, -0.25); set(aR.el, -0.25); set(torso, 0.08); set(head, 0);
  } else if (mode === 'dead') {
    prx = -1.5; py = 0.25;
    set(lL.hip, 0.1); set(lR.hip, -0.15); set(lL.knee, 0.3); set(lR.knee, 0);
    set(aL.sh, 0, 0, 1.2); set(aR.sh, 0, 0, -1.0); set(aL.el, 0); set(aR.el, 0); set(torso, 0); set(head, 0.3);
  } else {
    const b = Math.sin(t * 1.6) * 0.02;
    set(lL.hip, 0); set(lR.hip, 0); set(lL.knee, 0); set(lR.knee, 0);
    set(aL.sh, 0.04 + b, 0, 0.09); set(aR.sh, 0.04 - b, 0, -0.09); set(aL.el, -0.12); set(aR.el, -0.25);
    set(torso, b * 0.6); set(head, 0);
  }
  if (atk > 0 && mode !== 'dead') {
    // overhead-to-forward strike with the right arm
    const a = atk < 0.35 ? atk / 0.35 : 1 - (atk - 0.35) / 0.65;
    aR.sh.rotation.x = lerp(-0.4, -2.3, a) + (atk > 0.35 ? (1 - a) * 1.2 : 0);
    aR.el.rotation.x = -0.5 * a;
    torso.rotation.y = -0.35 * a;
  }
  pelvis.position.y = lerp(pelvis.position.y, py, k);
  pelvis.rotation.x = lerp(pelvis.rotation.x, prx, k);
}

// ---------- tools held in the hand ----------
export function makeHeld(id) {
  const g = new THREE.Group();
  const wood = mat('wood_dark'), metal = mat('metal'), stone = colMat(0x77777a), ti = colMat(0xd9e2ea, { metalness: 0.8, roughness: 0.3 });
  const shaft = (len, r = 0.022) => mesh(cylG(r, r, len, 6), wood, 0, 0, 0, g);
  const spearLike = (tipM, len) => { const s = shaft(len); s.rotation.x = Math.PI / 2; s.position.z = len * 0.25; const t = mesh(coneG(0.04, 0.26, 6), tipM, 0, 0, len * 0.75 + 0.1, g); t.rotation.x = Math.PI / 2; };
  switch (id) {
    case 'spear': spearLike(stone, 1.9); break;
    case 'spear_metal': spearLike(metal, 2.0); break;
    case 'harpoon': spearLike(ti, 2.2); break;
    case 'axe_stone': case 'axe_metal': { const s = shaft(0.65); s.rotation.x = Math.PI / 2; s.position.z = 0.22; mesh(boxG(0.04, 0.2, 0.14), id === 'axe_metal' ? metal : stone, 0, 0.07, 0.5, g); break; }
    case 'pick_stone': case 'pick_metal': { const s = shaft(0.7); s.rotation.x = Math.PI / 2; s.position.z = 0.24; const hd = mesh(boxG(0.04, 0.42, 0.06), id === 'pick_metal' ? metal : stone, 0, 0, 0.56, g); hd.rotation.z = 0; break; }
    case 'hammer': { const s = shaft(0.45); s.rotation.x = Math.PI / 2; s.position.z = 0.16; mesh(boxG(0.09, 0.2, 0.09), wood, 0, 0, 0.38, g); break; }
    case 'paddle': { const s = shaft(1.3); s.rotation.x = Math.PI / 2; s.position.z = 0.4; mesh(boxG(0.2, 0.03, 0.45), mat('wood'), 0, 0, 1.15, g); break; }
    case 'hook': { const t = mesh(geo('hookT', () => new THREE.TorusGeometry(0.09, 0.016, 6, 10, 4.2)), metal, 0, 0, 0.14, g); t.rotation.y = Math.PI / 2; mesh(cylG(0.012, 0.012, 0.2, 5), mat('rope'), 0, 0, 0, g).rotation.x = Math.PI / 2; break; }
    case 'bow': { const b = mesh(geo('bowT', () => new THREE.TorusGeometry(0.42, 0.018, 5, 14, 2.4)), wood, 0, 0, -0.3, g); b.rotation.set(0, Math.PI / 2, -1.2 + Math.PI / 2); mesh(cylG(0.004, 0.004, 0.78, 4), mat('rope'), 0, 0, 0.0, g); break; }
    case 'rod': { const s = shaft(2.2, 0.014); s.rotation.x = Math.PI / 2 - 0.5; s.position.set(0, 0.5, 0.9); break; }
    case 'torch': { const s = shaft(0.5); s.rotation.x = Math.PI / 2; s.position.z = 0.18; const f = mesh(sphG(0.08, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffa030 }), 0, 0, 0.5, g, false); f.scale.z = 1.6; const l = new THREE.PointLight(0xff9a3c, 14, 16, 1.6); l.position.z = 0.5; g.add(l); break; }
    case 'cutlass': { mesh(boxG(0.02, 0.07, 0.75), metal, 0, 0, 0.45, g); mesh(boxG(0.12, 0.03, 0.04), mat('gold'), 0, 0, 0.07, g); break; }
    default: break;
  }
  g.rotation.x = Math.PI / 2; // tools point forward from a hanging hand
  return g;
}

// ---------- ships ----------
export function hullGeometry(len, beam, depth, rise = 1) {
  const nu = 16, nv = 10, pos = [], uv = [], idx = [];
  const W = (s) => (beam / 2) * (s < 0.3 ? lerp(0.72, 1, s / 0.3) : Math.pow(Math.cos(((s - 0.3) / 0.7) * Math.PI * 0.5), 0.75));
  const top = (s) => depth * 0.45 + Math.pow(Math.abs(s - 0.45) * 2, 2) * 0.6 * rise;
  for (let i = 0; i <= nu; i++) {
    const s = i / nu, w = Math.max(W(s), 0.02), t = top(s), z = (s - 0.5) * len;
    const dp = depth * (0.75 + 0.25 * Math.sin(s * Math.PI));
    for (let j = 0; j <= nv; j++) {
      const th = (j / nv) * Math.PI;
      pos.push(-w * Math.cos(th), t - dp * Math.pow(Math.sin(th), 0.7), z + (s > 0.8 ? (1 - Math.sin(th)) * 0 : 0));
      uv.push((s * len) / 3, j / nv * 2);
    }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b = a + nv + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  // transom
  const c0 = pos.length / 3; pos.push(0, top(0) - depth * 0.3, -len / 2); uv.push(0, 0);
  for (let j = 0; j < nv; j++) idx.push(c0, j, j + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  g.userData = { W, top };
  return g;
}
function deckGeometry(len, hull, drop, shrink = 0.94) {
  const { W, top } = hull.userData, nu = 16, pos = [], uv = [], idx = [];
  for (let i = 0; i <= nu; i++) {
    const s = i / nu, w = W(s) * shrink, z = (s - 0.5) * len, y = top(s) - drop;
    pos.push(-w, y, z, w, y, z); uv.push(0, z / 2, w, z / 2);
  }
  for (let i = 0; i < nu; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function sailGeometry(w, h) {
  const g = new THREE.PlaneGeometry(w, h, 8, 8), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (w / 2), y = p.getY(i) / (h / 2); p.setZ(i, (1 - x * x) * (1 - y * y * 0.6) * w * 0.16); }
  g.computeVertexNormals();
  return g;
}

// size: 0 dinghy, 1 sloop, 2 brig, 3 galleon. Returns group + deck info (local coords, +z = bow).
export function makeShip(size, o = {}) {
  const S = [{ len: 7, beam: 2.6, depth: 1.5 }, { len: 17, beam: 5.4, depth: 3.2 }, { len: 25, beam: 7.2, depth: 4 }, { len: 36, beam: 10, depth: 5.2 }][size];
  const g = new THREE.Group();
  const hullM = mat('wood_dark', { side: THREE.DoubleSide, color: o.tint ?? 0xffffff });
  const hg = hullGeometry(S.len, S.beam, S.depth, size ? 1 : 0.4);
  mesh(hg, hullM, 0, 0, 0, g);
  const drop = size ? 0.75 : 0.35;
  const deckY = S.depth * 0.45 - drop + 0.05;
  mesh(deckGeometry(S.len, hg, drop), mat('wood', { side: THREE.DoubleSide }), 0, 0, 0, g);
  const info = { group: g, deckY, halfW: S.beam * 0.4, z0: -S.len * 0.42, z1: S.len * 0.3, len: S.len, beam: S.beam, sails: [], cannons: [] };
  if (size === 0) {
    mesh(boxG(S.beam * 0.8, 0.08, 0.5), 'wood', 0, deckY + 0.3, -0.8, g);
    mesh(boxG(S.beam * 0.7, 0.08, 0.5), 'wood', 0, deckY + 0.3, 1.2, g);
    if (o.mast) { mesh(cylG(0.07, 0.09, 4.5, 6), 'wood_dark', 0, deckY + 2.2, 0.4, g); const b = mesh(cylG(0.04, 0.04, 2.6, 5), 'wood_dark', 0, deckY + 3.6, 0.4, g); b.rotation.z = Math.PI / 2; const s = mesh(sailGeometry(2.4, 2.6), mat('cloth', { color: 0xb5ad98 }), 0, deckY + 2.3, 0.45, g); s.rotation.z = 0.08; }
    return info;
  }
  const sailM = mat('cloth', { color: o.sail ?? 0x5a5560 });
  const masts = size === 1 ? [[0.05, 13]] : size === 2 ? [[-0.2, 15], [0.18, 17]] : [[-0.27, 17], [0.02, 22], [0.27, 18]];
  for (const [f, h] of masts) {
    const z = f * S.len;
    mesh(cylG(0.16 + size * 0.04, 0.24 + size * 0.05, h, 8), 'wood_dark', 0, deckY + h / 2, z, g);
    const tiers = size === 1 ? 1 : 2;
    for (let t = 0; t < tiers; t++) {
      const sw = S.beam * (1.35 - t * 0.3), sh = h * (tiers === 1 ? 0.62 : 0.36), sy = deckY + h * (tiers === 1 ? 0.56 : 0.34 + t * 0.4);
      const yard = mesh(cylG(0.08, 0.08, sw * 1.06, 6), 'wood_dark', 0, sy + sh / 2, z + 0.25, g); yard.rotation.z = Math.PI / 2;
      const sl = mesh(sailGeometry(sw, sh), sailM, 0, sy, z + 0.3, g); info.sails.push(sl);
    }
    mesh(boxG(0.7, 0.5, 0.7), 'wood_dark', 0, deckY + h * 0.78, z, g); // crow's nest
  }
  if (o.flag !== false) {
    const [f, h] = masts[masts.length > 1 ? 1 : 0];
    const fl = mesh(geo('flag', () => new THREE.PlaneGeometry(1.8, 1.1)), mat('plain', { color: o.flagColor ?? 0x111114, side: THREE.DoubleSide }), 0.95, deckY + h + 0.4, f * S.len, g);
    info.flag = fl;
    mesh(sphG(0.22, 8, 6), colMat(0xe8e4d8), 0.95, deckY + h + 0.45, f * S.len + 0.02, g, false).scale.set(1, 1, 0.1);
  }
  const bs = mesh(cylG(0.08, 0.14, S.len * 0.3, 6), 'wood_dark', 0, deckY + 1.1, S.len * 0.52, g); bs.rotation.x = 1.25;
  // stern cabin
  const cw = S.beam * 0.62, cl = S.len * 0.2;
  mesh(boxG(cw, 1.8, cl), 'wood_dark', 0, deckY + 0.9, -S.len * 0.5 + cl / 2 + 0.6, g);
  for (const sx of [-1, 1]) mesh(boxG(0.5, 0.5, 0.06), new THREE.MeshStandardMaterial({ color: 0xffc66b, emissive: 0xffa53a, emissiveIntensity: 1.2 }), sx * cw * 0.25, deckY + 1.0, -S.len * 0.5 + cl + 0.61, g, false);
  mesh(boxG(cw + 0.2, 0.12, cl + 0.2), 'wood', 0, deckY + 1.86, -S.len * 0.5 + cl / 2 + 0.6, g);
  info.z0 = -S.len * 0.5 + cl + 1.2;
  info.cabinTop = { y: deckY + 1.95, z0: -S.len * 0.5 + 0.7, z1: -S.len * 0.5 + cl + 0.5, halfW: cw / 2 };
  // cannons
  const nc = size + 1;
  for (let i = 0; i < nc; i++) for (const sx of [-1, 1]) {
    const z = lerp(info.z0 + 2, info.z1 - 1, nc === 1 ? 0.5 : i / (nc - 1));
    const c = mesh(cylG(0.16, 0.2, 1.5, 8), colMat(0x1b1d20, { metalness: 0.7, roughness: 0.4 }), sx * S.beam * 0.36, deckY + 0.45, z, g);
    c.rotation.z = sx * Math.PI / 2;
    mesh(boxG(0.5, 0.3, 0.6), 'wood_dark', sx * (S.beam * 0.36 - 0.3), deckY + 0.2, z, g);
    info.cannons.push(new THREE.Vector3(sx * S.beam * 0.45, deckY + 0.5, z));
  }
  // helm + loot chest positions
  const wz = info.z0 + 0.6;
  const wh = mesh(geo('shipwheel', () => new THREE.TorusGeometry(0.4, 0.045, 6, 12)), 'wood', 0, deckY + 1.0, wz, g);
  mesh(boxG(0.16, 0.9, 0.16), 'wood_dark', 0, deckY + 0.45, wz - 0.1, g);
  info.helm = new THREE.Vector3(0, deckY, wz + 0.7);
  mesh(boxG(1.0, 0.6, 0.65), 'wood', 0, deckY + 0.3, info.z1 - 1.5, g);
  mesh(boxG(1.04, 0.1, 0.69), mat('gold'), 0, deckY + 0.62, info.z1 - 1.5, g);
  info.chest = new THREE.Vector3(0, deckY, info.z1 - 2.6);
  // boarding ladder
  for (const sx of [-1, 1]) for (let r = 0; r < 6; r++) mesh(boxG(0.06, 0.05, 0.6), 'wood', sx * (S.beam * 0.5 + 0.02), deckY + 0.6 - r * 0.42, 0, g, false);
  return info;
}

// ---------- marine life ----------
export function makeMarine(o) {
  const { len, girth, top, belly } = o;
  const g = new THREE.Group();
  const geoB = new THREE.CylinderGeometry(1, 1, len, 12, 12, false);
  geoB.rotateX(Math.PI / 2);
  const p = geoB.attributes.position, col = new Float32Array(p.count * 3), ct = new THREE.Color(top), cb = new THREE.Color(belly), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const s = p.getZ(i) / len + 0.5; // 0 tail .. 1 nose
    let r = Math.pow(Math.sin(Math.PI * Math.pow(clamp(s * 0.94 + 0.03, 0, 1), o.shape ?? 0.75)), 0.8) * girth;
    if (o.beak && s > 0.9) r *= 0.55;
    const x = p.getX(i), y = p.getY(i);
    p.setXYZ(i, x * r * (o.flat ?? 0.85), y * r, p.getZ(i));
    c.copy(cb).lerp(ct, clamp(y * 2.5 + 0.55, 0, 1));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geoB.setAttribute('color', new THREE.BufferAttribute(col, 3)); geoB.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
  mesh(geoB, m, 0, 0, 0, g);
  const finM = new THREE.MeshStandardMaterial({ color: top, roughness: 0.6, side: THREE.DoubleSide });
  const tri = (a, b, cc) => { const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...cc], 3)); tg.computeVertexNormals(); return tg; };
  if (o.dorsal !== 0) { g.dorsal = mesh(tri([0, girth * 0.8, len * 0.12], [0, girth * 0.8, -len * 0.1], [0, girth * (1.9 * (o.dorsal ?? 1)), -len * 0.09]), finM, 0, 0, 0, g); }
  for (const sx of [-1, 1]) mesh(tri([sx * girth * 0.6, -girth * 0.3, len * 0.2], [sx * girth * 0.6, -girth * 0.3, len * 0.05], [sx * girth * 2.1, -girth * 0.9, len * 0.0]), finM, 0, 0, 0, g);
  const tail = new THREE.Group(); tail.position.z = -len * 0.46; g.add(tail);
  if (o.fluke) { mesh(tri([0, 0, 0.1], [-girth * 1.7, 0, -len * 0.13], [0, 0, -len * 0.06]), finM, 0, 0, 0, tail); mesh(tri([0, 0, 0.1], [girth * 1.7, 0, -len * 0.13], [0, 0, -len * 0.06]), finM, 0, 0, 0, tail); }
  else { mesh(tri([0, 0, 0.1], [0, girth * 1.7, -len * 0.14], [0, 0, -len * 0.05]), finM, 0, 0, 0, tail); mesh(tri([0, 0, 0.1], [0, -girth * 1.2, -len * 0.11], [0, 0, -len * 0.05]), finM, 0, 0, 0, tail); }
  for (const sx of [-1, 1]) mesh(sphG(0.03, 5, 4), colMat(0x050505), sx * girth * 0.5, girth * 0.2, len * 0.36, g, false).scale.setScalar(Math.max(1, girth * 2));
  g.tail = tail; g.bodyMat = m;
  return g;
}
export const makeShark = (kind) => makeMarine({
  white: { len: 5.2, girth: 0.62, top: 0x5b6670, belly: 0xe9edf0 },
  tiger: { len: 4.2, girth: 0.5, top: 0x6a6652, belly: 0xdcd8c4 },
  reef: { len: 2.3, girth: 0.28, top: 0x70797c, belly: 0xe2e2dc },
}[kind]);
export const makeDolphin = () => makeMarine({ len: 2.6, girth: 0.3, top: 0x5f7387, belly: 0xcfd8de, fluke: true, beak: true, dorsal: 0.75, shape: 0.85 });
export const makeWhale = () => makeMarine({ len: 19, girth: 2.4, top: 0x2f3e4d, belly: 0x9aa7b0, fluke: true, dorsal: 0.25, shape: 0.6, flat: 1 });

export function makeTurtle() {
  const g = new THREE.Group();
  const sh = mesh(sphG(0.5, 10, 8), colMat(0x4d6b3a), 0, 0, 0, g); sh.scale.set(0.85, 0.38, 1.05);
  const bl = mesh(sphG(0.46, 8, 6), colMat(0xc9c08a), 0, -0.06, 0, g); bl.scale.set(0.8, 0.25, 1);
  mesh(sphG(0.13, 8, 6), colMat(0x6f8a52), 0, 0.02, 0.6, g);
  g.flips = [];
  for (const [sx, sz, l] of [[-1, 1, 0.5], [1, 1, 0.5], [-1, -1, 0.3], [1, -1, 0.3]]) {
    const f = new THREE.Group(); f.position.set(sx * 0.36, -0.03, sz * 0.32); g.add(f);
    const m = mesh(boxG(l, 0.04, 0.18), colMat(0x6f8a52), sx * l / 2, 0, 0, f); m.rotation.y = -sx * sz * 0.4; g.flips.push(f);
  }
  return g;
}
export function makeRay() {
  const g = new THREE.Group();
  const s = new THREE.Shape(); s.moveTo(0, 1); s.quadraticCurveTo(0.5, 0.5, 1.5, 0.1); s.quadraticCurveTo(0.6, -0.4, 0, -0.8); s.quadraticCurveTo(-0.6, -0.4, -1.5, 0.1); s.quadraticCurveTo(-0.5, 0.5, 0, 1);
  const eg = geo('ray', () => { const e = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 6 }); e.rotateX(Math.PI / 2); return e; });
  mesh(eg, colMat(0x394650), 0, 0, 0, g);
  const t = mesh(cylG(0.02, 0.005, 1.8, 5), colMat(0x2b343c), 0, -0.05, -1.6, g); t.rotation.x = Math.PI / 2;
  return g;
}
export function makeEel() {
  const g = new THREE.Group(); g.segs = [];
  const dm = colMat(0x10161c, { roughness: 0.4 }), gm = new THREE.MeshStandardMaterial({ color: 0x3df2ff, emissive: 0x2ad8ff, emissiveIntensity: 2.5 });
  for (let i = 0; i < 14; i++) {
    const r = i === 0 ? 1.5 : 1.35 * (1 - i / 16);
    const s = mesh(sphG(1, 10, 8), dm, 0, 0, -i * 1.7, g); s.scale.set(r * 0.8, r, 1.5);
    if (i > 0) for (const sx of [-1, 1]) mesh(sphG(0.12, 5, 4), gm, sx * 0.75, 0.2, 0, s, false);
    g.segs.push(s);
  }
  const head = g.segs[0];
  for (const sx of [-1, 1]) mesh(sphG(0.16, 6, 5), new THREE.MeshStandardMaterial({ color: 0xff5533, emissive: 0xff3311, emissiveIntensity: 3 }), sx * 0.62, 0.45, 0.6, head, false);
  for (let i = 0; i < 7; i++) { const tt = mesh(coneG(0.07, 0.4, 4), colMat(0xe8e2cc), (i - 3) * 0.2, -0.35, 0.85, head, false); tt.rotation.x = Math.PI; }
  const lure = mesh(sphG(0.2, 6, 5), gm, 0, 1.6, 1.3, head, false);
  const l = new THREE.PointLight(0x35e0ff, 60, 40, 1.5); lure.add(l);
  return g;
}
export function makeBoar() {
  const g = new THREE.Group(), m = colMat(0x4a3a2e);
  const b = mesh(capG(0.3, 0.6), m, 0, 0.55, 0, g); b.rotation.x = Math.PI / 2; b.scale.set(1, 1, 1.1);
  mesh(sphG(0.22, 8, 6), m, 0, 0.6, 0.62, g).scale.set(0.9, 0.9, 1.3);
  mesh(cylG(0.08, 0.1, 0.16, 6), colMat(0x8a6a5a), 0, 0.55, 0.9, g).rotation.x = Math.PI / 2;
  for (const sx of [-1, 1]) { mesh(coneG(0.025, 0.14, 4), colMat(0xeee8d5), sx * 0.1, 0.56, 0.86, g, false).rotation.x = -0.6; mesh(coneG(0.06, 0.12, 4), m, sx * 0.14, 0.82, 0.55, g, false); }
  g.legs = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const l = new THREE.Group(); l.position.set(sx * 0.18, 0.4, sz * 0.32); g.add(l); mesh(cylG(0.06, 0.045, 0.4, 5), m, 0, -0.2, 0, l); g.legs.push(l); }
  return g;
}
export function makeCrab() {
  const g = new THREE.Group(), m = colMat(0xc24a2a);
  mesh(sphG(0.2, 8, 6), m, 0, 0.14, 0, g).scale.set(1.3, 0.5, 1);
  for (const sx of [-1, 1]) { mesh(sphG(0.08, 6, 4), m, sx * 0.3, 0.16, 0.16, g); for (let i = 0; i < 3; i++) { const l = mesh(cylG(0.015, 0.015, 0.26, 4), m, sx * 0.3, 0.08, -0.1 + i * 0.1, g, false); l.rotation.z = sx * 1.0; } }
  return g;
}
export function makeGull() {
  const g = new THREE.Group(), w = colMat(0xf2f2ee, { side: THREE.DoubleSide });
  mesh(sphG(0.12, 6, 5), w, 0, 0, 0, g).scale.set(0.8, 0.8, 2);
  g.wings = [];
  for (const sx of [-1, 1]) { const p = new THREE.Group(); g.add(p); mesh(geo('gw', () => new THREE.PlaneGeometry(0.7, 0.22)), w, sx * 0.36, 0, 0, p, false).rotation.x = -Math.PI / 2; g.wings.push(p); }
  return g;
}
export function fishGeometry() {
  return geo('fish', () => {
    const g = new THREE.BufferGeometry();
    const v = [0, 0, 0.3, 0, 0.1, 0, 0.04, 0, 0, 0, -0.1, 0, -0.04, 0, 0, 0, 0, -0.18, 0, 0.1, -0.3, 0, -0.1, -0.3];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1, 5, 2, 1, 5, 3, 2, 5, 4, 3, 5, 1, 4, 5, 6, 7]);
    g.computeVertexNormals();
    return g;
  });
}
export { tex };
