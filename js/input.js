// Keyboard, mouse (pointer lock) and touch input.
import { G, clamp } from './util.js';

export class Input {
  constructor(canvas) {
    G.input = this; this.canvas = canvas;
    this.keys = {}; this.mx = 0; this.mz = 0; this.lookX = 0; this.lookY = 0;
    this.jump = false; this.jumpP = false; this.down = false; this.sprint = false; this.act = false; this.actP = false; this.useP = false; this.rotP = false;
    this.blocked = false; this.locked = false; this.sprintToggle = false; this.joy = null; this.lookId = null; this.tb = {};
    addEventListener('keydown', (e) => this.key(e, true)); addEventListener('keyup', (e) => this.key(e, false));
    addEventListener('blur', () => { this.keys = {}; this.act = false; });
    canvas.addEventListener('mousedown', (e) => this.mouse(e, true)); addEventListener('mouseup', (e) => this.mouse(e, false));
    addEventListener('mousemove', (e) => { if (this.blocked || G.state !== 'play') return; if (this.locked || this.dragLook) { const s = 0.0023 * G.settings.sens; this.lookX += e.movementX * s; this.lookY += e.movementY * s * (G.settings.invY ? -1 : 1); } });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => { if (this.blocked || G.state !== 'play') return; const p = G.player; p.sel = (p.sel + (e.deltaY > 0 ? 1 : 7)) % 8; }, { passive: true });
    document.addEventListener('pointerlockerror', () => { this.noLock = true; });
    document.addEventListener('pointerlockchange', () => { const was = this.locked; this.locked = document.pointerLockElement === canvas; if (was && !this.locked && G.state === 'play' && !G.ui.panel && !this.blocked && !G.player.dead) G.ui.open('pause'); });
    // touch
    const T = document.getElementById('touch');
    const opts = { passive: false };
    document.addEventListener('touchstart', (e) => this.touch(e, 0), opts); document.addEventListener('touchmove', (e) => this.touch(e, 1), opts);
    document.addEventListener('touchend', (e) => this.touch(e, 2), opts); document.addEventListener('touchcancel', (e) => this.touch(e, 2), opts);
    this.joyEl = document.getElementById('joy');
  }
  key(e, d) {
    if (e.target && (e.target.tagName === 'INPUT')) return;
    const c = e.code;
    if (G.state !== 'play') return;
    if (d && !e.repeat) {
      const ui = G.ui, map = { Tab: 'inv', KeyI: 'inv', KeyF: 'craft', KeyB: 'build', KeyM: 'map', KeyJ: 'log', KeyP: 'pause' };
      if (c === 'Escape') { if (!ui.el.reader.classList.contains('hide')) ui.el.reader.querySelector('button').click(); else if (ui.panel) ui.close(); else if (!this.locked) ui.open('pause'); e.preventDefault(); return; }
      if (map[c] && !G.player.dead && ui.el.reader.classList.contains('hide')) { ui.open(map[c]); e.preventDefault(); return; }
      if (!this.blocked) {
        if (c === 'Space') this.jumpP = true; if (c === 'KeyE') this.useP = true; if (c === 'KeyR') this.rotP = true;
        if (c === 'KeyX') { const b = G.player.build; b.remove = !b.remove; if (b.remove) b.type = null; ui.toast(b.remove ? 'Remove mode' : 'Repair mode'); }
        if (/^Digit[1-8]$/.test(c)) { G.player.sel = +c[5] - 1; }
      }
    }
    if (c === 'Tab' || c === 'Space') e.preventDefault();
    this.keys[c] = d;
  }
  mouse(e, d) {
    if (G.state !== 'play') return;
    if (d && e.target === this.canvas && !this.blocked) {
      if (!this.locked && !G.ui.touch) {
        this.dragLook = true;
        if (!this.noLock) { // the first click only captures the mouse; it must not also swing or eat
          try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { this.noLock = true; }); } catch (_) { this.noLock = true; }
          return;
        }
      }
      if (e.button === 0) { this.act = true; this.actP = true; } if (e.button === 2) this.useP = true;
    }
    if (!d) { if (e.button === 0) this.act = false; this.dragLook = false; }
  }
  touch(e, phase) {
    if (G.state !== 'play') return;
    const inUI = (t) => t.target.closest && t.target.closest('#shade,#reader,#death,#title,#hotbar,#topbtn,#quest');
    for (const t of e.changedTouches) {
      const btn = t.target.closest && t.target.closest('[data-btn]');
      if (phase === 0) {
        if (inUI(t)) continue;
        e.preventDefault();
        if (btn) { const b = btn.dataset.btn; this.tb[t.identifier] = b; btn.classList.add('on'); this.press(b, true); continue; }
        if (this.blocked) continue;
        if (t.clientX < innerWidth * 0.42 && !this.joy) { this.joy = { id: t.identifier, x: t.clientX, y: t.clientY }; this.joyEl.style.display = 'block'; this.joyEl.style.left = t.clientX + 'px'; this.joyEl.style.top = t.clientY + 'px'; this.joyEl.firstElementChild.style.transform = ''; }
        else if (this.lookId == null) { this.lookId = t.identifier; this.lx = t.clientX; this.ly = t.clientY; }
      } else if (phase === 1) {
        if (this.joy && t.identifier === this.joy.id) { e.preventDefault(); let dx = t.clientX - this.joy.x, dy = t.clientY - this.joy.y; const l = Math.hypot(dx, dy), m = 55; if (l > m) { dx *= m / l; dy *= m / l; } this.jx = dx / m; this.jz = -dy / m; this.joyEl.firstElementChild.style.transform = `translate(${dx}px,${dy}px)`; }
        else if (t.identifier === this.lookId) { e.preventDefault(); const s = 0.0052 * G.settings.sens; this.lookX += (t.clientX - this.lx) * s; this.lookY += (t.clientY - this.ly) * s * (G.settings.invY ? -1 : 1); this.lx = t.clientX; this.ly = t.clientY; }
      } else {
        const b = this.tb[t.identifier];
        if (b) { delete this.tb[t.identifier]; const el = document.querySelector(`[data-btn="${b}"]`); if (el && b !== 'sprint') el.classList.remove('on'); this.press(b, false); }
        if (this.joy && t.identifier === this.joy.id) { this.joy = null; this.jx = this.jz = 0; this.joyEl.style.display = 'none'; }
        if (t.identifier === this.lookId) this.lookId = null;
      }
    }
  }
  press(b, d) {
    if (this.blocked && d) return;
    if (b === 'act') { this.tAct = d; if (d) this.actP = true; }
    else if (b === 'jump') { this.tJump = d; if (d) this.jumpP = true; }
    else if (b === 'down') this.tDown = d;
    else if (b === 'use') { if (d) this.useP = true; }
    else if (b === 'rot') { if (d) this.rotP = true; }
    else if (b === 'sprint' && d) { this.sprintToggle = !this.sprintToggle; document.getElementById('tb-sprint').classList.toggle('on', this.sprintToggle); }
  }
  // call at the start of each frame
  poll() {
    const k = this.keys;
    if (this.blocked) { this.mx = this.mz = 0; this.jump = this.down = this.sprint = this.act = false; this.jumpP = this.actP = this.useP = this.rotP = false; this.lookX = this.lookY = 0; this.tAct = this.tJump = this.tDown = false; return; }
    this.mx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + (this.jx || 0);
    this.mz = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + (this.jz || 0);
    this.jump = !!k.Space || !!this.tJump; this.down = !!k.KeyC || !!this.tDown;
    this.sprint = !!(k.ShiftLeft || k.ShiftRight) || (this.sprintToggle && Math.hypot(this.mx, this.mz) > 0.85);
    if (this.tAct !== undefined && G.ui.touch) this.act = !!this.tAct;
    this.lookX = clamp(this.lookX, -0.5, 0.5); this.lookY = clamp(this.lookY, -0.5, 0.5);
  }
  endFrame() { this.jumpP = this.actP = this.useP = this.rotP = false; this.lookX = this.lookY = 0; }
}
