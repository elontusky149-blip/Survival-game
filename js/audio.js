// Fully synthesised audio: ambience loops, one-shot effects and sparse music.
import { G, clamp, rand, pick } from './util.js';

export class Audio {
  constructor() { G.audio = this; this.ctx = null; this.musicT = 50; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = G.settings.vol;
    this.filter = c.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 20000;
    this.master.connect(this.filter); this.filter.connect(c.destination);
    // noise buffers
    const len = c.sampleRate * 3, wb = c.createBuffer(1, len, c.sampleRate), bb = c.createBuffer(1, len, c.sampleRate), w = wb.getChannelData(0), b = bb.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const r = Math.random() * 2 - 1; w[i] = r; last = (last + 0.02 * r) / 1.02; b[i] = last * 3.5; }
    this.white = wb; this.brown = bb;
    const loop = (buf, type, freq, q = 0.7) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.master); s.start(); return { g, f }; };
    this.ocean = loop(this.brown, 'lowpass', 700); this.surf = loop(this.white, 'bandpass', 1400, 0.5); this.wind = loop(this.white, 'bandpass', 520, 1.4);
    this.rain = loop(this.white, 'highpass', 3200); this.under = loop(this.brown, 'lowpass', 180); this.eng = loop(this.brown, 'bandpass', 95, 6); this.fallsL = loop(this.white, 'bandpass', 900, 0.4);
  }
  setVolume(v) { if (this.master) this.master.gain.value = v; }
  env(node, t, a, d, peak) { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    this.env(g, t, 0.01, dur, vol); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, type, freq, vol = 0.3, q = 1, slide = 0, delay = 0, buf) {
    const c = this.ctx, t = c.currentTime + delay, s = c.createBufferSource(); s.buffer = buf || this.white; s.loopStart = Math.random() * 2; const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur); f.Q.value = q;
    const g = c.createGain(); this.env(g, t, 0.006, dur, vol); s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  }
  sfx(name, v = 1) {
    if (!this.ctx || v <= 0.01) return;
    const T = (...a) => this.tone(...a), N = (...a) => this.noise(...a);
    switch (name) {
      case 'ui': T(660, 0.05, 'triangle', 0.08); break;
      case 'pickup': T(520, 0.07, 'triangle', 0.14); T(780, 0.09, 'triangle', 0.12, 0, 0.06); break;
      case 'craft': N(0.07, 'bandpass', 1800, 0.25, 2); N(0.07, 'bandpass', 1300, 0.22, 2, 0, 0.12); T(440, 0.12, 'triangle', 0.1, 0, 0.22); break;
      case 'build': N(0.08, 'lowpass', 900, 0.5, 1); T(140, 0.1, 'square', 0.12, -60); N(0.06, 'lowpass', 700, 0.35, 1, 0, 0.14); break;
      case 'break': N(0.35, 'lowpass', 1200, 0.5 * v, 0.7, -900); T(90, 0.3, 'sawtooth', 0.12 * v, -50); break;
      case 'crunch': N(0.18, 'bandpass', 700, 0.5, 1.5, -400); T(110, 0.15, 'sawtooth', 0.1, -60); break;
      case 'creak': T(rand(140, 220), 0.5, 'sawtooth', 0.045 * v, rand(-60, 60)); break;
      case 'swing': N(0.16, 'bandpass', 900, 0.16, 1.2, 1200); break;
      case 'hit': N(0.09, 'lowpass', 1400, 0.4 * v, 1); T(160, 0.1, 'square', 0.1 * v, -80); break;
      case 'chop': N(0.07, 'bandpass', 1100, 0.45, 2); T(190, 0.09, 'square', 0.1, -90); break;
      case 'mine': N(0.05, 'highpass', 2600, 0.35, 1); T(880, 0.06, 'square', 0.06, -300); break;
      case 'hurt': T(220, 0.22, 'sawtooth', 0.16, -110); N(0.1, 'lowpass', 700, 0.25); break;
      case 'bite': N(0.22, 'bandpass', 500, 0.6, 1.2, -300); T(80, 0.25, 'sawtooth', 0.2, -40); break;
      case 'splash': N(0.5, 'bandpass', 1300, 0.4 * v, 0.6, -900); break;
      case 'plop': N(0.14, 'bandpass', 800, 0.25, 2, -500); break;
      case 'jump': N(0.08, 'lowpass', 500, 0.12); break;
      case 'climb': N(0.25, 'bandpass', 900, 0.25, 0.8, -500); T(120, 0.1, 'square', 0.06, 0, 0.15); break;
      case 'throw': N(0.25, 'bandpass', 700, 0.18, 1, 1500); break;
      case 'bow': T(240, 0.12, 'triangle', 0.18 * v, -150); N(0.12, 'highpass', 2500, 0.12 * v, 1, 2000); break;
      case 'cannon': N(0.9, 'lowpass', 400, 0.9 * v, 0.6, -330, 0, this.brown); T(60, 0.5, 'sine', 0.5 * v, -30); break;
      case 'paddle': N(0.35, 'bandpass', 900, 0.2, 0.7, -500); break;
      case 'sail': N(0.4, 'lowpass', 600, 0.3, 0.6, 500); break;
      case 'eat': N(0.07, 'bandpass', 1200, 0.2, 3); N(0.07, 'bandpass', 1000, 0.2, 3, 0, 0.16); break;
      case 'drink': for (let i = 0; i < 3; i++) T(300 + i * 60, 0.09, 'sine', 0.14, 120, i * 0.13); break;
      case 'sizzle': N(0.8, 'highpass', 4200, 0.12, 0.5); break;
      case 'chest': T(180, 0.12, 'square', 0.07, 60); N(0.2, 'lowpass', 700, 0.25, 1, 0, 0.05); break;
      case 'page': N(0.22, 'highpass', 3000, 0.13, 0.5, -1500); break;
      case 'static': N(1.1, 'bandpass', 2400, 0.16, 0.4, rand(-1000, 1500)); T(rand(700, 1200), 0.4, 'sine', 0.03, rand(-300, 300), 0.3); break;
      case 'unlock': [523, 659, 784].forEach((f, i) => T(f, 0.2, 'triangle', 0.13, 0, i * 0.09)); break;
      case 'quest': [587, 740, 880, 1175].forEach((f, i) => T(f, 0.25, 'triangle', 0.13, 0, i * 0.1)); break;
      case 'stage': [392, 523, 659, 784, 1047].forEach((f, i) => T(f, 0.5, 'triangle', 0.14, 0, i * 0.14)); break;
      case 'discover': [440, 554, 659].forEach((f, i) => T(f, 0.6, 'sine', 0.13, 0, i * 0.16)); break;
      case 'alarm': T(520, 0.18, 'square', 0.08); T(390, 0.25, 'square', 0.08, 0, 0.2); break;
      case 'engine': N(0.5, 'lowpass', 300, 0.4, 2, 200, 0, this.brown); break;
      case 'gull': T(1500, 0.16, 'sawtooth', 0.025, -500); T(1650, 0.2, 'sawtooth', 0.02, -600, 0.2); break;
      case 'boar': T(120, 0.35, 'sawtooth', 0.14, -40); break;
      case 'whale': T(160, 2.2, 'sine', 0.14, 140); T(240, 1.8, 'sine', 0.08, -90, 1.2); break;
      case 'dolphin': for (let i = 0; i < 4; i++) T(2200 + rand(0, 900), 0.08, 'sine', 0.04, 700, i * 0.11); break;
    }
  }
  step(surf) { if (!this.ctx) return; const f = { wood: ['lowpass', 520, 0.3], sand: ['bandpass', 1600, 0.1], grass: ['bandpass', 2400, 0.08], water: ['bandpass', 1100, 0.2] }[surf]; this.noise(0.07, f[0], f[1] * rand(0.85, 1.15), f[2], 1.2, surf === 'water' ? -500 : 0); if (surf === 'wood') this.tone(95, 0.06, 'sine', 0.1, -30); }
  thunder(dist) { if (!this.ctx) return; const v = clamp(1.1 - dist / 700, 0.25, 1), dl = dist / 340; this.noise(2.6, 'lowpass', 260, 0.9 * v, 0.5, -200, dl, this.brown); this.noise(0.5, 'lowpass', 1400, 0.35 * v, 0.6, -1100, dl); }
  update(dt) {
    const c = this.ctx; if (!c) return;
    const env = G.env, pl = G.player, t = c.currentTime, set = (n, v) => n.g.gain.setTargetAtTime(v, t, 0.4);
    const uw = env.underwater, play = G.state === 'play';
    const swell = 0.5 + 0.5 * Math.sin(G.clock * 0.55) * Math.sin(G.clock * 0.21);
    set(this.ocean, uw ? 0.02 : 0.16 + env.waveScale * 0.09 + swell * 0.07);
    set(this.surf, uw ? 0 : (0.012 + env.waveScale * 0.012) * (0.4 + swell));
    set(this.wind, uw ? 0 : clamp(env.windSpeed / 26, 0, 1) * 0.3 * (0.8 + 0.2 * Math.sin(G.clock * 0.9)));
    this.wind.f.frequency.setTargetAtTime(380 + env.windSpeed * 26 + Math.sin(G.clock * 0.7) * 80, t, 0.5);
    set(this.rain, uw ? 0 : env.rain * (pl && pl.sheltered ? 0.07 : 0.14));
    set(this.under, uw ? 0.5 : 0);
    set(this.eng, play && G.raft.engines > 0 ? 0.35 * clamp(1 - (pl.pos.distanceTo(G.raft.group.position) - G.raft.radius) / 40, 0, 1) : 0);
    const f = G.world.falls; set(this.fallsL, f && !uw ? 0.14 * clamp(1 - Math.hypot(pl.pos.x - f.x, pl.pos.z - f.z) / 70, 0, 1) : 0);
    this.filter.frequency.setTargetAtTime(uw ? 520 : 20000, t, 0.15);
    if (!play) return;
    // raft creaks with the swell
    this.creakT = (this.creakT || 3) - dt * (0.4 + env.waveScale * 0.6);
    if (this.creakT <= 0 && pl.platform === G.raft && !uw) { this.creakT = rand(2.5, 7); this.sfx('creak', 0.6 + env.waveScale * 0.3); }
    if (uw && Math.random() < dt * 0.8) this.tone(rand(300, 900), 0.08, 'sine', 0.03, 300);
    // sparse music: a slow chord swell every few minutes in calm moments
    this.musicT -= dt;
    if (this.musicT <= 0) {
      this.musicT = rand(150, 260);
      if (!env.isStorm && !G.ents.dangerNear()) {
        const roots = pick([[220, 277.2, 329.6, 415.3], [196, 246.9, 293.7, 392], [174.6, 220, 261.6, 349.2], [146.8, 220, 293.7, 370]]);
        for (let k = 0; k < 3; k++) roots.forEach((fr, i) => {
          const tt = t + k * 7 + i * 0.5, o = c.createOscillator(), g = c.createGain(); o.type = i % 2 ? 'sine' : 'triangle'; o.frequency.value = fr * (k === 1 ? 1.122 : k === 2 ? 0.891 : 1) * (uw ? 0.5 : 1);
          g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.035, tt + 3); g.gain.exponentialRampToValueAtTime(0.0001, tt + 9.5); o.connect(g); g.connect(this.master); o.start(tt); o.stop(tt + 10);
        });
      }
    }
  }
}
