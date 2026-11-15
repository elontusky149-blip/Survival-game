// Procedural canvas textures so the game ships with no external art assets.
import * as THREE from 'three';
import { mulberry32 } from './util.js';

const cache = {};
function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}
function finish(c, rep = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function speckle(g, size, rnd, n, cols, minR, maxR, alpha) {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * (0.4 + rnd() * 0.6);
    g.fillStyle = cols[(rnd() * cols.length) | 0];
    const r = minR + rnd() * (maxR - minR);
    g.beginPath();
    g.arc(rnd() * size, rnd() * size, r, 0, 7);
    g.fill();
  }
  g.globalAlpha = 1;
}

const makers = {
  wood(dark) {
    const [c, g] = canvas(256), rnd = mulberry32(dark ? 9 : 5);
    const base = dark ? [92, 62, 38] : [150, 106, 66];
    g.fillStyle = `rgb(${base})`;
    g.fillRect(0, 0, 256, 256);
    const planks = 4, ph = 256 / planks;
    for (let p = 0; p < planks; p++) {
      const sh = 0.82 + rnd() * 0.36;
      g.fillStyle = `rgb(${base.map((v) => (v * sh) | 0)})`;
      g.fillRect(0, p * ph, 256, ph);
      for (let i = 0; i < 70; i++) {
        g.globalAlpha = 0.07 + rnd() * 0.13;
        g.strokeStyle = rnd() > 0.5 ? '#2a1a0c' : '#e2c090';
        g.lineWidth = 0.6 + rnd() * 1.4;
        const y = p * ph + rnd() * ph;
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(80, y + rnd() * 5 - 2.5, 170, y + rnd() * 5 - 2.5, 256, y);
        g.stroke();
      }
      g.globalAlpha = 0.5;
      g.fillStyle = '#1c1008';
      for (let k = 0; k < 2; k++) {
        const kx = rnd() * 256, ky = p * ph + 10 + rnd() * (ph - 20);
        g.beginPath(); g.ellipse(kx, ky, 4 + rnd() * 4, 2 + rnd() * 2, 0, 0, 7); g.fill();
      }
      g.globalAlpha = 0.85;
      g.fillStyle = '#1a0f07';
      g.fillRect(0, p * ph, 256, 2.5);
      const sx = rnd() * 256;
      g.fillRect(sx, p * ph, 2.5, ph);
      g.globalAlpha = 1;
      g.fillStyle = '#3b3b3b';
      for (const nx of [sx + 9, sx - 9]) { g.beginPath(); g.arc((nx + 256) % 256, p * ph + ph / 2, 2.2, 0, 7); g.fill(); }
    }
    return finish(c);
  },
  wood_dark() { return makers.wood(true); },
  bark() {
    const [c, g] = canvas(128), rnd = mulberry32(21);
    g.fillStyle = '#6b5440'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 26; i++) {
      g.globalAlpha = 0.35 + rnd() * 0.3;
      g.fillStyle = rnd() > 0.5 ? '#3d2e20' : '#8a7058';
      g.fillRect(0, i * 5 + rnd() * 3, 128, 1.5 + rnd() * 2);
    }
    speckle(g, 128, rnd, 200, ['#2f2318', '#9c8468'], 0.5, 1.6, 0.4);
    return finish(c);
  },
  sand() {
    const [c, g] = canvas(256), rnd = mulberry32(3);
    g.fillStyle = '#d9d9d9'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, rnd, 5000, ['#ffffff', '#bdbdbd', '#a8a8a8', '#eeeeee'], 0.4, 1.5, 0.5);
    speckle(g, 256, rnd, 60, ['#c2c2c2', '#f4f4f4'], 6, 22, 0.12);
    return finish(c);
  },
  rock() {
    const [c, g] = canvas(256), rnd = mulberry32(8);
    g.fillStyle = '#8b8b8b'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, rnd, 180, ['#6f6f6f', '#a5a5a5', '#7c7c7c'], 6, 26, 0.3);
    speckle(g, 256, rnd, 2500, ['#555', '#c4c4c4', '#999'], 0.5, 2, 0.5);
    g.strokeStyle = '#3d3d3d';
    for (let i = 0; i < 22; i++) {
      g.globalAlpha = 0.25 + rnd() * 0.3; g.lineWidth = 0.6 + rnd();
      let x = rnd() * 256, y = rnd() * 256;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += rnd() * 40 - 20; y += rnd() * 40 - 20; g.lineTo(x, y); }
      g.stroke();
    }
    g.globalAlpha = 1;
    return finish(c);
  },
  leaf() {
    const [c, g] = canvas(128), rnd = mulberry32(13);
    g.fillStyle = '#3f8f3a'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 64; i++) {
      g.globalAlpha = 0.25; g.strokeStyle = i % 2 ? '#1f5a22' : '#7fc65e'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(i * 2 + rnd() * 2, 0); g.lineTo(i * 2 + rnd() * 2, 128); g.stroke();
    }
    g.globalAlpha = 0.6; g.fillStyle = '#b6dc7e'; g.fillRect(62, 0, 3, 128);
    g.globalAlpha = 1;
    return finish(c);
  },
  thatch() {
    const [c, g] = canvas(128), rnd = mulberry32(31);
    g.fillStyle = '#b89a55'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 500; i++) {
      g.globalAlpha = 0.35 + rnd() * 0.3;
      g.strokeStyle = ['#8a6f35', '#d8c078', '#6f5626', '#c7ab63'][(rnd() * 4) | 0];
      g.lineWidth = 0.8 + rnd();
      const x = rnd() * 128, y = rnd() * 128;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd() * 6 - 3, y + 10 + rnd() * 14); g.stroke();
    }
    g.globalAlpha = 1;
    return finish(c);
  },
  cloth() {
    const [c, g] = canvas(128), rnd = mulberry32(41);
    g.fillStyle = '#e4dcc6'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 128; i += 2) {
      g.globalAlpha = 0.08 + rnd() * 0.06; g.fillStyle = '#6e654e';
      g.fillRect(i, 0, 1, 128); g.fillRect(0, i, 128, 1);
    }
    speckle(g, 128, rnd, 30, ['#b9ac8a', '#cfc4a4'], 5, 18, 0.18);
    g.globalAlpha = 0.5; g.fillStyle = '#9a8c6b'; g.fillRect(0, 62, 128, 2);
    g.globalAlpha = 1;
    return finish(c);
  },
  metal() {
    const [c, g] = canvas(128), rnd = mulberry32(51);
    g.fillStyle = '#8d9499'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 300; i++) {
      g.globalAlpha = 0.1; g.strokeStyle = rnd() > 0.5 ? '#fff' : '#30363a';
      const y = rnd() * 128; g.beginPath(); g.moveTo(0, y); g.lineTo(128, y + rnd() * 2 - 1); g.stroke();
    }
    speckle(g, 128, rnd, 50, ['#7a4a2a', '#5c3a22'], 2, 9, 0.22);
    g.globalAlpha = 0.8; g.fillStyle = '#4a5055';
    for (const [x, y] of [[8, 8], [120, 8], [8, 120], [120, 120]]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    return finish(c);
  },
  panel() {
    const [c, g] = canvas(128), rnd = mulberry32(61);
    g.fillStyle = '#d5dadd'; g.fillRect(0, 0, 128, 128);
    speckle(g, 128, rnd, 40, ['#a9b0b4', '#8c7a5c'], 3, 14, 0.15);
    g.strokeStyle = '#8d979d'; g.lineWidth = 2; g.strokeRect(1, 1, 126, 126);
    g.fillStyle = '#e07b1f'; g.fillRect(0, 100, 128, 8);
    return finish(c);
  },
  stonebrick() {
    const [c, g] = canvas(256), rnd = mulberry32(71);
    g.fillStyle = '#8f8a7a'; g.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 8; r++) for (let q = 0; q < 4; q++) {
      const sh = 0.8 + rnd() * 0.35;
      g.fillStyle = `rgb(${(143 * sh) | 0},${(138 * sh) | 0},${(122 * sh) | 0})`;
      g.fillRect(q * 64 + (r % 2) * 32 - 32, r * 32, 62, 30);
      g.fillRect(q * 64 + (r % 2) * 32 - 32 + 256, r * 32, 62, 30);
    }
    speckle(g, 256, rnd, 1500, ['#5e5a4e', '#b5b09e'], 0.5, 2, 0.45);
    speckle(g, 256, rnd, 60, ['#4f6b3a', '#5f7a45'], 4, 14, 0.25);
    return finish(c);
  },
  // tiling grayscale detail multiplied onto vertex-coloured terrain
  terrain() {
    const [c, g] = canvas(256), rnd = mulberry32(81);
    g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, rnd, 260, ['#b4b4b4', '#eaeaea', '#c2c2c2'], 5, 20, 0.3);
    speckle(g, 256, rnd, 6000, ['#fff', '#9c9c9c', '#bbb'], 0.4, 1.5, 0.45);
    return finish(c);
  },
  waternoise() {
    // tileable smooth noise for water detail normals
    const size = 128, [c, g] = canvas(size), img = g.createImageData(size, size), rnd = mulberry32(91);
    const grid = 8, vals = [];
    for (let o = 0; o < 3; o++) { const n = grid << o; vals[o] = Array.from({ length: n * n }, () => rnd()); }
    const s = (o, x, y) => {
      const n = grid << o, fx = (x / size) * n, fy = (y / size) * n;
      const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const ux = tx * tx * (3 - 2 * tx), uy = ty * ty * (3 - 2 * ty);
      const v = (a, b) => vals[o][((b % n) * n) + (a % n)];
      return v(ix, iy) * (1 - ux) * (1 - uy) + v(ix + 1, iy) * ux * (1 - uy) + v(ix, iy + 1) * (1 - ux) * uy + v(ix + 1, iy + 1) * ux * uy;
    };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const v = s(0, x, y) * 0.55 + s(1, x, y) * 0.3 + s(2, x, y) * 0.15;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return finish(c, 1, false);
  },
};

export function tex(name) {
  if (!cache[name]) cache[name] = makers[name]();
  return cache[name];
}

const mats = {};
export function mat(name, opts = {}) {
  const key = name + JSON.stringify(opts);
  if (mats[key]) return mats[key];
  const defs = {
    wood: { map: tex('wood'), bumpMap: tex('wood'), bumpScale: 0.6, roughness: 0.85 },
    wood_dark: { map: tex('wood_dark'), bumpMap: tex('wood_dark'), bumpScale: 0.6, roughness: 0.9 },
    bark: { map: tex('bark'), roughness: 1 },
    rock: { map: tex('rock'), bumpMap: tex('rock'), bumpScale: 0.8, roughness: 0.95, flatShading: true },
    leaf: { map: tex('leaf'), roughness: 0.8, side: THREE.DoubleSide },
    thatch: { map: tex('thatch'), roughness: 1, side: THREE.DoubleSide },
    cloth: { map: tex('cloth'), roughness: 0.95, side: THREE.DoubleSide },
    metal: { map: tex('metal'), roughness: 0.45, metalness: 0.75 },
    panel: { map: tex('panel'), roughness: 0.6, metalness: 0.2 },
    stonebrick: { map: tex('stonebrick'), bumpMap: tex('stonebrick'), bumpScale: 0.5, roughness: 0.95 },
    rope: { color: 0xb09868, roughness: 1 },
    glass: { color: 0x9fd6e8, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.4 },
    gold: { color: 0xffc940, roughness: 0.3, metalness: 0.9, emissive: 0x6b4a00, emissiveIntensity: 0.5 },
    dark: { color: 0x22262a, roughness: 0.8 },
    plain: { roughness: 0.85 },
  };
  const m = new THREE.MeshStandardMaterial({ ...(defs[name] || defs.plain), ...opts });
  mats[key] = m;
  return m;
}
