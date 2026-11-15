// Shared helpers: math, seeded random, noise.
import * as THREE from 'three';

export const G = {}; // global game state hub; modules attach themselves here

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const TAU = Math.PI * 2;
export function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export const lerpAngle = (a, b, t) => a + angDiff(a, b) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function h2(ix, iz, seed) {
  let n = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function noise2(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = h2(ix, iz, seed), b = h2(ix + 1, iz, seed);
  const c = h2(ix, iz + 1, seed), d = h2(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
export function fbm(x, z, oct = 4, seed = 0) {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < oct; i++) {
    v += noise2(x * f, z * f, seed + i * 17) * amp;
    tot += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return v / tot;
}

export const V = () => new THREE.Vector3();
export const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export function fmtTime(h) {
  const hh = Math.floor(h) % 24, mm = Math.floor((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// Tiny event bus used for progression tracking.
const listeners = {};
export function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }
export function emit(ev, a, b) { const l = listeners[ev]; if (l) for (const fn of l) fn(a, b); }
