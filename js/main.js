// Bootstrap, main loop, save/load.
import * as THREE from 'three';
import { G, clamp, on } from './util.js';
import { Env } from './env.js';
import { World } from './world.js';
import { Raft, TS } from './raft.js';
import { Player } from './player.js';
import { Ents } from './entities.js';
import { Progress, Story } from './quests.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { Audio } from './audio.js';

const SAVE = 'saltborne.save.v1', SETT = 'saltborne.settings';
G.settings = Object.assign({ quality: matchMedia('(pointer: coarse)').matches ? 'low' : 'med', sens: 1, vol: 0.7, camDist: 1, invY: false }, JSON.parse(localStorage.getItem(SETT) || '{}'));
G.saveSettings = () => localStorage.setItem(SETT, JSON.stringify(G.settings));
G.clock = 0; G.playTime = 0; G.state = 'boot'; G.paused = false;

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: G.settings.quality !== 'low', powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.25, 9500);
G.renderer = renderer; G.scene = scene; G.camera = camera;

function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.fov = innerWidth < innerHeight ? 74 : 62; camera.updateProjectionMatrix(); }
G.applyQuality = () => {
  const q = G.settings.quality;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q === 'low' ? 1 : q === 'med' ? 1.5 : 2));
  renderer.shadowMap.enabled = q !== 'low';
  if (G.env) { G.env.sun.castShadow = q !== 'low'; G.env.sun.shadow.mapSize.set(q === 'high' ? 4096 : 2048, q === 'high' ? 4096 : 2048); if (G.env.sun.shadow.map) { G.env.sun.shadow.map.dispose(); G.env.sun.shadow.map = null; } G.env.buildWater(q); }
  scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  resize(); G.saveSettings();
};
addEventListener('resize', resize);

new Progress();
const env = new Env(scene);
const world = new World(scene);
const raft = new Raft(scene);
G.platforms = [raft, ...world.platforms];
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
G.raftTileAtWorld = (x, z) => { raft.toLocal(_a.set(x, 0, z), _b); return raft.tile(Math.round(_b.x / TS), Math.round(_b.z / TS), 0); };
const player = new Player(scene, camera);
const ents = new Ents(scene);
new Story();
const ui = new UI();
const input = new Input(canvas);
const audio = new Audio();
G.applyQuality();
world.applyLooted();

// ---------- save / load ----------
G.hasSave = () => !!localStorage.getItem(SAVE);
G.save = () => {
  if (G.state !== 'play' || player.dead) return;
  try {
    localStorage.setItem(SAVE, JSON.stringify({ v: 1, clock: G.clock, playTime: G.playTime, env: { time: env.time, day: env.day, weather: env.weather, weatherT: env.weatherT }, prog: G.prog.serialize(), raft: raft.serialize(), player: player.serialize(), ents: ents.serialize(), build: player.build }));
  } catch (e) { console.warn('save failed', e); }
};
function load() {
  const d = JSON.parse(localStorage.getItem(SAVE));
  G.clock = d.clock || 0; G.playTime = d.playTime || 0;
  env.time = d.env.time; env.day = d.env.day; env.weather = d.env.weather in { clear: 1, breezy: 1, overcast: 1, drizzle: 1, rain: 1, fog: 1 } ? d.env.weather : 'overcast'; env.weatherT = d.env.weatherT || 120;
  G.prog.load(d.prog); raft.load(d.raft); player.load(d.player); ents.load(d.ents);
  if (d.build) Object.assign(player.build, d.build);
  world.applyLooted();
  if (G.playTime > 75) ents.creatures.stalkerAt = G.playTime + 20;
}
G.start = (cont) => {
  audio.init();
  if (!cont) { localStorage.removeItem(SAVE); sessionStorage.setItem('saltborne.new', '1'); location.reload(); return; }
  try { load(); } catch (e) { console.error(e); ui.toast('Save could not be loaded — starting fresh'); }
  begin();
};
function begin() {
  G.state = 'play'; ui.startHud(); input.blocked = false;
  if (G.playTime < 2) {
    player.inv.add('flask_full', 1); player.inv.add('coconut', 1);
    const tips = ui.touch
      ? ['Wrecked. Four planks and the open sea.', 'Walk to the raft edge. When debris drifts close, tap ✋ to grab it.', 'Open 🛠️ to craft a Throwing Hook, then a Build Hammer.', 'Your objectives are tracked on the right. Tap them for details.']
      : ['Wrecked. Four planks and the open sea.', 'Click the view to look around. Walk to the raft edge and press E to grab drifting debris.', 'Press F to craft a Throwing Hook, then a Build Hammer.', 'Objectives are tracked on the right. Press J for details, Esc for controls.'];
    tips.forEach((t, i) => setTimeout(() => G.state === 'play' && ui.toast(t), 800 + i * 5200));
  }
}
let saveT = 0;
addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });
addEventListener('pagehide', () => G.save());
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, () => audio.init(), { passive: true });

// ---------- main loop ----------
function step(dt) {
  G.clock += dt; G.playTime += dt;
  input.poll();
  raft.update(dt);
  player.update(dt);
  ents.update(dt);
  world.update(dt);
  env.update(dt, camera);
  G.prog.update(dt);
  ui.update(dt);
  audio.update(dt);
  input.endFrame();
  saveT += dt; if (saveT > 40) { saveT = 0; G.save(); }
}
G.step = step;
const timer = new THREE.Clock();
let menuA = 0.8;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, timer.getDelta());
  if (G.state === 'play' && !G.paused) {
    step(dt);
  } else if (G.state !== 'play') {
    // title screen: slow orbit around the drifting raft
    G.clock += dt; menuA += dt * 0.05;
    raft.update(dt);
    const rp = raft.group.position;
    camera.position.set(rp.x + 1 + Math.sin(menuA) * 11, 3.4 + Math.sin(menuA * 2) * 0.6, rp.z + 1 + Math.cos(menuA) * 11);
    camera.lookAt(rp.x + 1, 1.2, rp.z + 1);
    player.h.root.position.copy(player.local).applyMatrix4(raft.group.matrixWorld); player.h.root.rotation.y = raft.yaw + 0.6;
    world.updateSeabed(rp.x, rp.z);
    env.update(dt, camera); audio.update(dt);
  }
  renderer.render(scene, camera);
}

window.G = G;
G.state = 'menu';
document.getElementById('boot').style.opacity = 0; setTimeout(() => document.getElementById('boot').remove(), 700);
if (sessionStorage.getItem('saltborne.new')) { sessionStorage.removeItem('saltborne.new'); begin(); }
else ui.showTitle(G.hasSave());
frame();
