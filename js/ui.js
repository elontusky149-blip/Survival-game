// HUD, menus, map, crafting/build/inventory panels.
import { G, clamp, fmtTime, emit } from './util.js';
import { ITEMS, RECIPES, PIECES, STAGES, BLUEPRINTS, costText } from './items.js';
import { WEATHER } from './env.js';
import { ISLANDS, WORLD_R, terrainHeight } from './world.js';
import { QUESTS, JOURNALS, RADIO } from './quests.js';

const $ = (s, r = document) => r.querySelector(s);
const MAPW = 3700; // half extent shown on the map

export class UI {
  constructor() {
    G.ui = this;
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    document.body.classList.toggle('touch', this.touch);
    this.root = $('#ui');
    this.root.innerHTML = `
    <div id="hud" class="hide">
      <div class="bars">
        ${[['hp', '❤️', '#e5484d'], ['hunger', '🍖', '#f5a524'], ['thirst', '💧', '#3b9eff'], ['stamina', '⚡', '#7ad66d'], ['oxygen', '🫧', '#7fe7f5']].map(([k, i, c]) => `<div class="bar" id="b-${k}"><i>${i}</i><div class="tr"><div class="fl" style="background:${c}"></div></div></div>`).join('')}
        <div class="chips"><div class="chip" id="c-temp">🌡️ 24°</div><div class="chip hide" id="c-shel">🏠 Sheltered</div><div class="chip hide" id="c-warn"></div></div>
      </div>
      <canvas id="compass" width="760" height="68"></canvas>
      <div class="topr">
        <div class="row"><div class="chip" id="c-day">Day 1 · 07:30</div><div class="chip" id="c-wx">☀️ Clear</div></div>
        <div class="row"><div class="chip" id="c-wind">💨 3 kn</div><div class="chip" id="c-raft">🛟 100%</div></div>
        <div id="quest"></div>
      </div>
      <div id="cross"></div>
      <div id="toasts"></div><div id="pickups"></div>
      <div id="banner"><h2></h2><p></p></div>
      <div id="hint" class="hide"></div>
      <div id="prompt" class="hide"></div>
      <div id="hotbar"></div>
      <div id="topbtn">${[['inv', '🎒'], ['craft', '🛠️'], ['build', '🔨'], ['map', '🗺️'], ['log', '📜'], ['pause', '⏸️']].map(([k, i]) => `<button class="ib" data-open="${k}" title="${k}">${i}</button>`).join('')}</div>
      <div id="touch" class="${this.touch ? '' : 'hide'}">
        <div id="joy"><b></b></div>
        <div class="tb" id="tb-act" data-btn="act">✊</div><div class="tb" id="tb-jump" data-btn="jump">⤒</div>
        <div class="tb hide" id="tb-use" data-btn="use">✋</div><div class="tb hide" id="tb-down" data-btn="down">⤓</div>
        <div class="tb" id="tb-sprint" data-btn="sprint">🏃</div><div class="tb hide" id="tb-rot" data-btn="rot">⟳</div>
      </div>
    </div>
    <div id="vig"></div><div id="cold"></div>
    <div id="shade" class="hide"><div id="panel"><div id="ptabs"></div><div id="pbody"></div></div></div>
    <div id="reader" class="hide"><div class="pg"><h3></h3><div class="rt"></div><button class="btn" data-act="closeReader">Close</button></div></div>
    <div id="death" class="hide"><h2>YOU DIED</h2><p></p><button class="btn pri" data-act="respawn">Wake on the raft</button></div>
    <div id="title" class="title hide"><h1>SALTBORNE</h1><div class="sub">Explore · Survive · Build</div>
      <button class="btn pri hide" data-act="continue">Continue</button><button class="btn" data-act="new">New Game</button><button class="btn" data-act="howto">How to Play</button>
      <small>Wrecked on four planks in an endless sea. Gather what drifts past, build a floating home, and find out why the ocean will not rest.</small></div>
    <div id="fade"></div>`;
    this.el = {}; for (const e of this.root.querySelectorAll('[id]')) this.el[e.id] = e;
    this.panel = null; this.craftTab = 'craft'; this.selSlot = null; this.chest = null; this.mapZoom = 1; this.dirty = true; this.toasts = []; this.bannerQ = []; this.bannerT = 0; this.vig = 0; this.lastToast = {};
    this.cctx = this.el.compass.getContext('2d');
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('input', (e) => this.onInput(e));
  }

  // ---------- small feedback ----------
  toast(msg) {
    const now = performance.now(); if (this.lastToast[msg] && now - this.lastToast[msg] < 2500) return; this.lastToast[msg] = now;
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
    setTimeout(() => d.remove(), 3800);
  }
  pickup(msg) { const d = document.createElement('div'); d.className = 'pk'; d.textContent = msg; this.el.pickups.appendChild(d); while (this.el.pickups.children.length > 5) this.el.pickups.firstChild.remove(); setTimeout(() => d.remove(), 2600); }
  banner(t, s = '') { this.bannerQ.push([t, s]); }
  flash(a) { this.vig = Math.max(this.vig, a); }
  setPrompt(p) {
    const txt = p ? p.text : ''; if (txt === this.promptTxt) return; this.promptTxt = txt;
    const el = this.el.prompt; el.classList.toggle('hide', !txt);
    if (txt) el.innerHTML = this.touch ? txt : `<kbd>${p.key === 'jump' ? 'SPACE' : 'E'}</kbd>${txt}`;
    this.el['tb-use'].classList.toggle('hide', !txt || (p && p.key === 'jump'));
  }
  fade(cb, text = '') { const f = this.el.fade; f.textContent = text; f.classList.add('on'); G.input.blocked = true; setTimeout(() => { cb(); setTimeout(() => { f.classList.remove('on'); G.input.blocked = !!this.panel; }, 900); }, 900); }
  showDeath(why) { this.close(); this.el.death.querySelector('p').textContent = why; this.el.death.classList.remove('hide'); G.input.blocked = true; document.exitPointerLock && document.exitPointerLock(); }
  reader(t, x) { const r = this.el.reader; r.querySelector('h3').textContent = t; r.querySelector('.rt').textContent = x; r.classList.remove('hide'); G.input.blocked = true; document.exitPointerLock && document.exitPointerLock(); }
  showTitle(hasSave) { this.el.title.classList.remove('hide'); this.el.hud.classList.add('hide'); this.el.title.querySelector('[data-act=continue]').classList.toggle('hide', !hasSave); }
  startHud() { this.el.title.classList.add('hide'); this.el.hud.classList.remove('hide'); this.dirty = true; }

  // ---------- panels ----------
  open(name) {
    if (G.state !== 'play' || G.player.dead) return;
    if (this.panel === name) return this.close();
    this.panel = name; this.selSlot = null; if (name !== 'chest') this.chest = null;
    this.el.shade.classList.remove('hide'); G.input.blocked = true; G.paused = name === 'pause';
    document.exitPointerLock && document.exitPointerLock();
    this.render(); G.audio.sfx('ui');
  }
  close() { if (!this.panel) return; const was = this.panel; this.panel = null; this.chest = null; this.el.shade.classList.add('hide'); G.input.blocked = !this.el.reader.classList.contains('hide'); if (was === 'pause') { G.paused = false; G.saveSettings(); } }
  openChest(d) { this.chest = d; this.panel = null; this.open('chest'); this.chest = d; this.render(); }
  openCraft() { this.craftTab = 'craft'; if (this.panel !== 'craft') this.open('craft'); }
  openMap() { if (this.panel !== 'map') this.open('map'); }
  render() {
    const tabs = [['inv', '🎒 Inventory'], ['craft', '🛠️ Craft'], ['build', '🔨 Build'], ['map', '🗺️ Map'], ['log', '📜 Journal'], ['pause', '⚙️ Menu']];
    if (this.panel === 'chest') tabs.unshift(['chest', '📦 Chest']);
    this.el.ptabs.innerHTML = tabs.map(([k, l]) => `<button data-open="${k}" class="${k === this.panel ? 'on' : ''}">${l}</button>`).join('') + '<button class="x" data-act="close">✕</button>';
    const b = this.el.pbody, st = b.scrollTop;
    b.innerHTML = this['r_' + this.panel]();
    b.scrollTop = this.keepScroll ? st : 0; this.keepScroll = false;
    if (this.panel === 'map') this.drawMap();
  }
  slotHTML(s, cont, i, key) {
    const sel = cont === 'h' ? i === G.player.sel : this.selSlot && this.selSlot.cont === cont && this.selSlot.i === i;
    return `<div class="slot ${sel ? (cont === 'h' ? 'sel' : 'pick') : ''}" data-slot="${cont}:${i}">${key ? `<span class="k">${key}</span>` : ''}${s ? `${ITEMS[s.id].icon}${s.n > 1 ? `<span class="n">${s.n}</span>` : ''}` : ''}</div>`;
  }
  arr(cont) { return cont === 'c' ? this.chest.slots : G.player.inv.slots; }
  detailHTML() {
    const ss = this.selSlot; if (!ss) return `<div class="detail"><div class="tx"><span>Tap an item to select it, then tap another slot to move it. The first row is your hotbar.</span></div></div>`;
    const s = this.arr(ss.cont)[ss.i]; if (!s) return '<div class="detail"></div>';
    const it = ITEMS[s.id], eat = ['food', 'drink', 'med'].includes(it.type) && ss.cont === 'p';
    const stat = [it.hunger ? `🍖+${it.hunger}` : '', it.thirst ? `💧+${it.thirst}` : '', it.hp ? `❤️${it.hp > 0 ? '+' : ''}${it.hp}` : '', it.dmg ? `⚔️${it.dmg}` : ''].filter(Boolean).join('  ');
    return `<div class="detail"><div class="ic">${it.icon}</div><div class="tx"><b>${it.name}${s.n > 1 ? ' ×' + s.n : ''}</b><span>${it.desc || ''} ${stat}</span></div>
      ${eat ? `<button class="btn pri" data-act="use">${it.type === 'drink' ? 'Drink' : it.type === 'med' ? 'Use' : 'Eat'}</button>` : ''}
      ${this.chest ? `<button class="btn" data-act="xfer">${ss.cont === 'c' ? 'Take' : 'Store'}</button>` : ''}
      <button class="btn" data-act="drop">Discard</button></div>`;
  }
  r_inv() {
    const s = G.player.inv.slots;
    return `<div class="sec">Hotbar</div><div class="grid">${s.slice(0, 8).map((k, i) => this.slotHTML(k, 'p', i, i + 1)).join('')}</div>
      <div class="sec">Backpack</div><div class="grid">${s.slice(8).map((k, i) => this.slotHTML(k, 'p', i + 8)).join('')}</div>${this.detailHTML()}`;
  }
  r_chest() {
    if (!this.chest) return '';
    const s = G.player.inv.slots;
    return `<div class="sec">Storage chest</div><div class="grid">${this.chest.slots.map((k, i) => this.slotHTML(k, 'c', i)).join('')}</div>
      <div class="sec">Your items</div><div class="grid">${s.map((k, i) => this.slotHTML(k, 'p', i, i < 8 ? i + 1 : '')).join('')}</div>${this.detailHTML()}`;
  }
  costHTML(cost) { const inv = G.player.inv; return `<span class="cost">${Object.entries(cost).map(([k, n]) => `<span class="${inv.count(k) >= n ? 'ok' : 'no'}" title="${ITEMS[k].name}">${ITEMS[k].icon}${inv.count(k)}/${n}</span>`).join('')}</span>`; }
  stationNear(st) { return !st || G.raft.nearStation(st, G.player.pos, 6); }
  r_craft() {
    const pr = G.prog, inv = G.player.inv;
    let h = `<div class="subtabs"><button class="btn ${this.craftTab === 'craft' ? 'on' : ''}" data-ctab="craft">Recipes</button><button class="btn ${this.craftTab === 'tech' ? 'on' : ''}" data-ctab="tech">Technology tree</button>
      <span class="chip">Stage ${pr.stage}: ${STAGES[pr.stage]}</span>${this.stationNear('bench') && G.raft.devicesOf('bench').length ? '<span class="chip">🛠️ Workbench in reach</span>' : ''}${this.stationNear('forge') && G.raft.devicesOf('forge').length ? '<span class="chip">🌋 Forge in reach</span>' : ''}</div>`;
    if (this.craftTab === 'craft') {
      const cats = {};
      for (const r of RECIPES) if (pr.unlocked(r)) (cats[r.cat] = cats[r.cat] || []).push(r);
      for (const [c, list] of Object.entries(cats)) {
        h += `<div class="sec">${c}</div>`;
        for (const r of list) {
          const it = ITEMS[r.out], near = this.stationNear(r.station), can = near && inv.has(r.cost);
          h += `<div class="rc"><div class="ic">${it.icon}</div><div class="tx"><b>${it.name}${r.n > 1 ? ' ×' + r.n : ''}</b> ${inv.count(r.out) ? `<span class="tag">have ${inv.count(r.out)}</span>` : ''}<small>${this.costHTML(r.cost)}${r.station ? ` · ${near ? '' : 'needs '}${PIECES[r.station].name}${near ? '' : ' nearby'}` : ''}</small></div><button class="btn ${can ? 'pri' : ''}" ${can ? '' : 'disabled'} data-craft="${r.id}">Craft</button></div>`;
        }
      }
    } else {
      for (let s = 1; s <= 6; s++) {
        h += `<div class="sec">Stage ${s} · ${STAGES[s]} ${pr.stage >= s ? '✔' : '🔒'}</div><div class="bgrid">`;
        const all = [...RECIPES.filter((r) => r.stage === s).map((r) => ({ ic: ITEMS[r.out].icon, nm: ITEMS[r.out].name, r, kind: r.station ? PIECES[r.station].name : 'By hand' })), ...Object.values(PIECES).filter((p) => p.stage === s).map((p) => ({ ic: p.icon, nm: p.name, r: p, kind: 'Raft: ' + p.cat }))];
        for (const a of all) { const ok = pr.unlocked(a.r); h += `<div class="bp ${ok ? '' : 'lock'}"><span class="ic">${ok ? a.ic : '🔒'}</span><b>${a.nm}</b><small>${a.kind}</small><small>${ok ? costText(a.r.cost) : pr.lockReason(a.r)}</small></div>`; }
        h += '</div>';
      }
    }
    return h;
  }
  r_build() {
    const pr = G.prog, b = G.player.build, inv = G.player.inv;
    if (!inv.count('hammer')) return `<div class="detail"><div class="ic">🔨</div><div class="tx"><b>You need a Build Hammer</b><span>Craft one from 3 planks and 1 rope in the Craft tab, then hold it to build.</span></div></div>`;
    let h = `<div class="subtabs"><button class="btn ${!b.type && !b.remove ? 'on' : ''}" data-build="">🔧 Repair mode</button><button class="btn ${b.remove ? 'on' : ''}" data-build="!remove">🗑️ Remove mode</button><span class="chip">Raft: ${G.raft.nTiles} foundations · ${Math.round(G.raft.condition * 100)}%</span></div>`;
    const cats = {};
    for (const p of Object.values(PIECES)) (cats[p.cat] = cats[p.cat] || []).push(p);
    for (const [c, list] of Object.entries(cats)) {
      h += `<div class="sec">${c}</div><div class="bgrid">`;
      for (const p of list) {
        const ok = pr.unlocked(p);
        h += `<button class="bp ${ok ? '' : 'lock'} ${b.type === p.id ? 'sel' : ''}" ${ok ? `data-build="${p.id}"` : ''}><span class="ic">${ok ? p.icon : '🔒'}</span><b>${p.name}</b><small>${ok ? this.costHTML(p.cost) : pr.lockReason(p)}</small>${ok && p.desc ? `<small>${p.desc}</small>` : ''}</button>`;
      }
      h += '</div>';
    }
    return h;
  }
  r_map() {
    const tr = G.prog.track && G.world.markers.find((m) => m.id === G.prog.track);
    return `<div class="subtabs"><button class="btn" data-act="zoom">🔍 Zoom ${this.mapZoom > 1 ? 'out' : 'in'}</button><span class="chip">${tr ? `Tracking: ${tr.icon} ${tr.name}` : 'Tap a marker to track it on the compass'}</span>${tr ? '<button class="btn" data-act="untrack">Clear</button>' : ''}</div><canvas id="mapc" width="900" height="900"></canvas>`;
  }
  r_log() {
    const pr = G.prog;
    let h = `<div class="subtabs"><span class="chip">Stage ${pr.stage} of 6 · ${STAGES[pr.stage]}</span><span class="chip">🗝️ Keycards: ${['a', 'b', 'c'].map((k) => (pr.flags['key_' + k] ? k.toUpperCase() : '–')).join(' ')}</span><span class="chip">Day ${G.env.day}</span></div>`;
    const act = QUESTS.filter((q) => q.s <= pr.stage && !pr.done[q.id]);
    h += '<div class="sec">Objectives</div>' + (act.length ? '' : '<div class="qrow"><b>All current objectives complete.</b></div>');
    for (const q of act) { const s = pr.questState(q); h += `<div class="qrow"><b>${q.t}</b>${q.main ? '' : '<span class="tag">optional</span>'}<small>${q.d}</small><div class="pb"><i style="width:${(s.have / s.need) * 100}%"></i></div></div>`; }
    if (pr.stage < 6) h += `<div class="sec">Next stage: ${STAGES[pr.stage + 1]}</div><div class="qrow"><small>Complete every non-optional objective of the current stage to advance and unlock new recipes.</small></div>`;
    h += `<div class="sec">Journals found (${pr.journals.length}/${Object.keys(JOURNALS).length})</div>` + (pr.journals.map((id) => `<div class="jr" data-journal="${id}">📜 ${JOURNALS[id].t}</div>`).join('') || '<div class="qrow"><small>Notes and logs you find while exploring are kept here.</small></div>');
    if (pr.radio) h += '<div class="sec">Radio log</div>' + RADIO.slice(0, pr.radio).map((r, i) => `<div class="jr" data-radio="${i}">📻 ${r.t}</div>`).join('');
    const bps = Object.keys(pr.bps); if (bps.length) h += '<div class="sec">Schematics</div>' + bps.map((b) => `<div class="qrow"><small>📐 ${BLUEPRINTS[b]}</small></div>`).join('');
    const done = QUESTS.filter((q) => pr.done[q.id]); if (done.length) h += `<div class="sec">Completed (${done.length})</div>` + done.map((q) => `<div class="qrow done"><b>✔ ${q.t}</b></div>`).join('');
    return h;
  }
  r_pause() {
    const s = G.settings;
    return `<div class="subtabs"><button class="btn pri" data-act="close">▶ Resume</button><button class="btn" data-act="save">💾 Save now</button><button class="btn" data-act="quit">Save & quit to title</button></div>
      <div class="sec">Settings</div>
      <div class="set"><label>Graphics quality</label>${['low', 'med', 'high'].map((q) => `<button class="btn ${s.quality === q ? 'pri' : ''}" data-q="${q}">${q === 'med' ? 'Medium' : q[0].toUpperCase() + q.slice(1)}</button>`).join('')}</div>
      <div class="set"><label>Look sensitivity</label><input type="range" min="0.3" max="2.5" step="0.1" value="${s.sens}" data-set="sens"></div>
      <div class="set"><label>Camera distance</label><input type="range" min="0.6" max="1.8" step="0.1" value="${s.camDist}" data-set="camDist"></div>
      <div class="set"><label>Volume</label><input type="range" min="0" max="1" step="0.05" value="${s.vol}" data-set="vol"></div>
      <div class="set"><label>Invert look Y</label><button class="btn ${s.invY ? 'pri' : ''}" data-act="invy">${s.invY ? 'On' : 'Off'}</button></div>
      <div class="sec">How to play</div>${this.helpHTML()}`;
  }
  helpHTML() {
    return this.touch ? `<div class="help"><p><b>Move</b> — drag the left side of the screen</p><p><b>Look</b> — drag the right side</p><p><b>✊ Action</b> — use the item in your hand: swing, throw the hook, paddle, shoot, eat, place a raft piece</p><p><b>✋ Interact</b> — appears when something is in reach: grab debris, open chests, use devices</p><p><b>⤒ / ⤓</b> — jump, swim up / dive down</p><p><b>🏃</b> — toggle sprint</p><p><b>Hotbar</b> — tap a slot to hold that item</p><p><b>Build</b> — hold the hammer, pick a piece from 🔨, aim, press ✊. ⟳ rotates.</p><p><b>Survive</b> — watch hunger, thirst and temperature. Sleep at night in a hammock.</p></div>`
      : `<div class="help"><p><b>W A S D</b> — move · <b>Mouse</b> — look (click the view to capture)</p><p><b>Left click</b> — use held item: swing, throw hook (hold to reel), paddle, shoot, eat, place piece</p><p><b>E</b> — interact: grab debris, open, use devices</p><p><b>Space</b> — jump / swim up · <b>C</b> — dive down · <b>Shift</b> — sprint</p><p><b>1–8 / wheel</b> — hotbar</p><p><b>Tab</b> inventory · <b>F</b> craft · <b>B</b> build · <b>M</b> map · <b>J</b> journal · <b>Esc</b> menu</p><p><b>Build</b> — hold the hammer, choose a piece with B, aim, click. <b>R</b> rotates, <b>X</b> toggles remove mode.</p><p><b>Survive</b> — watch hunger, thirst and temperature. Sleep at night in a hammock.</p></div>`;
  }

  // ---------- events ----------
  onClick(e) {
    const t = e.target.closest('[data-open],[data-act],[data-slot],[data-craft],[data-build],[data-ctab],[data-journal],[data-radio],[data-q],[data-hot]') || (e.target.id === 'mapc' ? e.target : null) || (e.target.id === 'shade' ? e.target : null) || (e.target.closest('#quest') ? this.el.quest : null);
    if (!t) return;
    const d = t.dataset, pl = G.player;
    if (t.id === 'shade') return this.close();
    if (t.id === 'quest') return this.open('log');
    if (t.id === 'mapc') return this.mapClick(e);
    if (d.open) return this.open(d.open);
    if (d.hot !== undefined) { pl.sel = +d.hot; this.dirty = true; return; }
    if (d.ctab) { this.craftTab = d.ctab; return this.render(); }
    if (d.journal) return G.story.read(d.journal);
    if (d.radio) { const r = RADIO[+d.radio]; return this.reader('📻 ' + r.t, r.x); }
    if (d.q) { G.settings.quality = d.q; G.applyQuality(); return this.render(); }
    if (d.craft) return this.craft(d.craft);
    if (d.build !== undefined) {
      const b = pl.build; b.remove = d.build === '!remove'; b.type = b.remove ? null : d.build || null;
      const hi = pl.inv.slots.findIndex((s) => s && s.id === 'hammer');
      if (hi >= 8) { const tmp = pl.inv.slots[pl.sel]; pl.inv.slots[pl.sel] = pl.inv.slots[hi]; pl.inv.slots[hi] = tmp; } else if (hi >= 0) pl.sel = hi;
      this.dirty = true; this.close(); this.toast(b.remove ? 'Remove mode: aim at a piece and use the hammer' : b.type ? `Placing: ${PIECES[b.type].name}` : 'Repair mode: use the hammer near damaged parts'); return;
    }
    if (d.slot) {
      const [cont, i] = d.slot.split(':'); const idx = +i;
      if (cont === 'h') { pl.sel = idx; this.dirty = true; return; }
      const ss = this.selSlot;
      if (ss && (ss.cont !== cont || ss.i !== idx)) {
        const a = this.arr(ss.cont), b = this.arr(cont), s = a[ss.i], o = b[idx];
        if (s && o && s.id === o.id && ITEMS[s.id].stack > 1) { const k = Math.min(s.n, ITEMS[s.id].stack - o.n); o.n += k; s.n -= k; if (s.n <= 0) a[ss.i] = null; } else { a[ss.i] = o; b[idx] = s; }
        this.selSlot = null; G.audio.sfx('ui');
      } else if (ss) this.selSlot = null; else if (this.arr(cont)[idx]) this.selSlot = { cont, i: idx };
      this.dirty = true; this.keepScroll = true; return this.render();
    }
    switch (d.act) {
      case 'close': this.close(); break;
      case 'closeReader': this.el.reader.classList.add('hide'); G.input.blocked = !!this.panel || !this.el.death.classList.contains('hide'); break;
      case 'respawn': this.el.death.classList.add('hide'); G.input.blocked = false; pl.respawn(); break;
      case 'use': if (this.selSlot) { pl.consume(this.selSlot.i); if (!pl.inv.slots[this.selSlot.i]) this.selSlot = null; this.keepScroll = true; this.render(); } break;
      case 'drop': if (this.selSlot) { this.arr(this.selSlot.cont)[this.selSlot.i] = null; this.selSlot = null; this.dirty = true; this.keepScroll = true; this.render(); } break;
      case 'xfer': if (this.selSlot && this.chest) {
        const from = this.arr(this.selSlot.cont), to = this.selSlot.cont === 'c' ? pl.inv.slots : this.chest.slots, s = from[this.selSlot.i]; let n = s.n; const st = ITEMS[s.id].stack;
        for (const o of to) if (n > 0 && o && o.id === s.id && o.n < st) { const k = Math.min(n, st - o.n); o.n += k; n -= k; }
        for (let k = this.selSlot.cont === 'c' ? 0 : 0; k < to.length && n > 0; k++) if (!to[k]) { const q = Math.min(n, st); to[k] = { id: s.id, n: q }; n -= q; }
        if (n <= 0) { from[this.selSlot.i] = null; this.selSlot = null; } else { s.n = n; this.toast('No room'); }
        this.dirty = true; this.keepScroll = true; this.render();
      } break;
      case 'zoom': this.mapZoom = this.mapZoom > 1 ? 1 : 3; this.render(); break;
      case 'untrack': G.prog.track = null; this.render(); break;
      case 'save': G.save(); this.toast('Game saved'); break;
      case 'quit': G.save(); location.reload(); break;
      case 'invy': G.settings.invY = !G.settings.invY; this.render(); break;
      case 'continue': G.start(true); break;
      case 'new': if (!G.hasSave() || confirm('Start a new game? Your current save will be replaced.')) G.start(false); break;
      case 'howto': this.reader('How to Play', this.helpHTML().replace(/<\/p>/g, '\n').replace(/<[^>]+>/g, '') + '\nYour goal: gather drifting debris, expand the raft, find islands, and follow the journals you discover. Objectives are listed in the Journal.'); break;
    }
  }
  onInput(e) { const k = e.target.dataset.set; if (k) { G.settings[k] = +e.target.value; if (k === 'vol') G.audio.setVolume(G.settings.vol); } }
  craft(id) {
    const r = RECIPES.find((k) => k.id === id), pl = G.player, inv = pl.inv;
    if (!r || !G.prog.unlocked(r) || !this.stationNear(r.station) || !inv.has(r.cost)) return;
    if (inv.freeSlots() === 0 && !(inv.count(r.out) && ITEMS[r.out].stack > 1)) return this.toast('Inventory full');
    inv.pay(r.cost); inv.add(r.out, r.n); emit('craft', r.out); G.audio.sfx('craft'); this.pickup(`${ITEMS[r.out].icon} +${r.n}`);
    this.dirty = true; this.keepScroll = true; this.render();
  }

  // ---------- map ----------
  islandImage(isl) {
    if (isl.img) return isl.img;
    const n = 64, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'), img = g.createImageData(n, n);
    const pal = { tropical: [96, 170, 78], jungle: [44, 118, 52], rocky: [128, 122, 110], pirate: [150, 146, 84], station: [110, 140, 104], ruins: [88, 140, 80], snow: [232, 238, 244], strange: [84, 130, 150], volcanic: [58, 50, 48] }[isl.biome];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const h = terrainHeight(isl.x - isl.half + ((i + 0.5) / n) * isl.half * 2, isl.z - isl.half + ((j + 0.5) / n) * isl.half * 2), k = (j * n + i) * 4;
      let r = 0, gg = 0, b = 0, a = 0;
      if (h > 2.6) { const s = clamp(0.75 + h / 160, 0, 1.3); r = pal[0] * s; gg = pal[1] * s; b = pal[2] * s; a = 255; } else if (h > 0) { r = 226; gg = 208; b = 150; a = 255; } else if (h > -7) { r = 70; gg = 180; b = 190; a = 170; }
      img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = a;
    }
    g.putImageData(img, 0, 0); return (isl.img = c);
  }
  mapXform() { const P = G.player.pos, z = this.mapZoom, cx = z > 1 ? clamp(P.x, -MAPW + MAPW / z, MAPW - MAPW / z) : 0, cz = z > 1 ? clamp(P.z, -MAPW + MAPW / z, MAPW - MAPW / z) : 0, sc = (900 * z) / (MAPW * 2); return { sc, X: (x) => 450 + (x - cx) * sc, Y: (zz) => 450 + (zz - cz) * sc }; }
  drawMap() {
    const cv = $('#mapc'); if (!cv) return; const g = cv.getContext('2d'), pr = G.prog, { sc, X, Y } = this.mapXform();
    g.fillStyle = '#12496b'; g.fillRect(0, 0, 900, 900);
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1;
    for (let k = -3500; k <= 3500; k += 500) { g.beginPath(); g.moveTo(X(k), 0); g.lineTo(X(k), 900); g.moveTo(0, Y(k)); g.lineTo(900, Y(k)); g.stroke(); }
    for (const isl of ISLANDS) if (pr.revealed[isl.id]) g.drawImage(this.islandImage(isl), X(isl.x - isl.half), Y(isl.z - isl.half), isl.half * 2 * sc, isl.half * 2 * sc);
    // fog of war
    const cs = (MAPW * 2) / 72; g.fillStyle = 'rgba(6,16,26,.62)';
    for (let j = 0; j < 72; j++) for (let i = 0; i < 72; i++) if (!pr.explored[j * 72 + i]) g.fillRect(X(-MAPW + i * cs) - 0.5, Y(-MAPW + j * cs) - 0.5, cs * sc + 1, cs * sc + 1);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    this.mapHits = [];
    for (const m of G.world.markers) {
      if (!pr.revealed[m.id]) continue;
      const x = X(m.x), y = Y(m.z); if (x < -20 || y < -20 || x > 920 || y > 920) continue;
      const isl = m.icon === '🏝️', vis = pr.revealed[m.id + '_v'];
      if (!isl || !vis) { g.font = (isl ? 22 : 20) + 'px system-ui'; g.fillText(isl ? '❔' : m.icon, x, y); }
      g.font = (isl ? '600 16px' : '13px') + ' system-ui'; g.fillStyle = pr.track === m.id ? '#ffb347' : vis ? '#fff' : '#b8c8d4'; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 3;
      const label = vis || !isl ? m.name : 'Unknown island'; g.strokeText(label, x, y + (isl ? (m.r || 0) : 0) + 18); g.fillText(label, x, y + 18);
      if (pr.track === m.id) { g.strokeStyle = '#ffb347'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 16, 0, 7); g.stroke(); }
      this.mapHits.push({ x, y, id: m.id });
    }
    for (const s of G.ents.ships) { const p = s.group.position; if (s.state === 'gone' || Math.hypot(p.x - G.player.pos.x, p.z - G.player.pos.z) > 600) continue; g.font = '18px system-ui'; g.fillText(s.state === 'ally' ? '⛵' : s.state === 'derelict' ? '🚣' : '☠️', X(p.x), Y(p.z)); }
    const rp = G.raft.group.position; g.font = '22px system-ui'; g.fillText('🛟', X(rp.x), Y(rp.z));
    const P = G.player.pos, a = Math.atan2(Math.sin(G.player.camYaw), -Math.cos(G.player.camYaw));
    g.save(); g.translate(X(P.x), Y(P.z)); g.rotate(a); g.fillStyle = '#ff4d3d'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -11); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke(); g.restore();
    g.fillStyle = '#fff'; g.font = '700 16px system-ui'; g.fillText('N', 880, 20); g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '12px system-ui'; g.fillText('500 m grid', 850, 885);
  }
  mapClick(e) {
    const cv = e.target, r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 900, y = ((e.clientY - r.top) / r.height) * 900;
    let best = null, bd = 34; for (const h of this.mapHits || []) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } }
    if (best) { G.prog.track = best.id; this.render(); G.audio.sfx('ui'); }
  }
  explore(dt) {
    this.expT = (this.expT || 0) - dt; if (this.expT > 0) return; this.expT = 0.6;
    const P = G.player.pos, pr = G.prog, onRaft = G.player.platform === G.raft;
    const rad = 230 + (onRaft && G.raft.hasNav ? 380 : 0) + (G.player.hasGear('sextant') ? 120 : 0) + clamp(P.y, 0, 150) * 3;
    const cs = (MAPW * 2) / 72, ci = Math.floor((P.x + MAPW) / cs), cj = Math.floor((P.z + MAPW) / cs), n = Math.ceil(rad / cs);
    for (let j = cj - n; j <= cj + n; j++) for (let i = ci - n; i <= ci + n; i++) if (i >= 0 && j >= 0 && i < 72 && j < 72 && Math.hypot(i - ci, j - cj) * cs <= rad) pr.explored[j * 72 + i] = 1;
    for (const isl of ISLANDS) if (!pr.revealed[isl.id] && Math.hypot(P.x - isl.x, P.z - isl.z) < rad + isl.r) { pr.revealed[isl.id] = 1; this.toast('🏝️ Land sighted! Check your map.'); }
  }

  // ---------- per-frame ----------
  update(dt) {
    const pl = G.player, env = G.env, raft = G.raft, el = this.el;
    this.explore(dt);
    const set = (k, v, mx = 100) => { const b = el['b-' + k]; b.firstElementChild.nextElementSibling.firstElementChild.style.width = clamp((v / mx) * 100, 0, 100) + '%'; b.classList.toggle('low', v / mx < 0.2); };
    set('hp', pl.hp); set('hunger', pl.hunger); set('thirst', pl.thirst); set('stamina', pl.stamina);
    const mo = pl.maxO2; set('oxygen', pl.oxygen, mo); el['b-oxygen'].classList.toggle('hide', !pl.headUnder && pl.oxygen >= mo - 0.5);
    this.slow = (this.slow || 0) - dt;
    if (this.slow <= 0) {
      this.slow = 0.33;
      const t = Math.round(pl.temp); el['c-temp'].textContent = `${t < 10 ? '🥶' : t > 40 ? '🥵' : '🌡️'} ${t}°C`; el['c-temp'].style.color = t < 10 ? '#8fd0ff' : t > 40 ? '#ff8a6b' : '';
      el['c-shel'].classList.toggle('hide', !pl.sheltered);
      const warn = pl.pressureWarn ? '⚠️ Crushing pressure!' : pl.thirst <= 0 ? '⚠️ Dying of thirst' : pl.hunger <= 0 ? '⚠️ Starving' : pl.temp < 9 ? '⚠️ Freezing' : pl.temp > 44 ? '⚠️ Burning up' : '';
      el['c-warn'].classList.toggle('hide', !warn); el['c-warn'].textContent = warn; el['c-warn'].style.color = '#ff8a6b';
      el['c-day'].textContent = `Day ${env.day} · ${fmtTime(env.time)}`;
      const W = WEATHER[env.weather]; el['c-wx'].textContent = `${env.night > 0.6 && env.weather === 'clear' ? '🌙' : W.icon} ${W.label}`;
      const rel = ((Math.atan2(Math.sin(env.windDir), -Math.cos(env.windDir)) - Math.atan2(Math.sin(pl.camYaw), -Math.cos(pl.camYaw))) * 180) / Math.PI;
      el['c-wind'].innerHTML = `💨 ${Math.round(env.windSpeed * 1.94)} kn <span style="display:inline-block;transform:rotate(${rel}deg)">↑</span>`;
      const sp = Math.hypot(raft.vel.x, raft.vel.z) * 1.94;
      el['c-raft'].textContent = `🛟 ${Math.round(raft.condition * 100)}% · ${sp.toFixed(1)} kn${raft.anchored ? ' ⚓' : ''}`; el['c-raft'].style.color = raft.condition < 0.6 ? '#ff8a6b' : '';
      this.renderQuest();
      if (this.panel === 'map') this.drawMap();
      el.cold.style.opacity = pl.temp < 12 ? clamp((12 - pl.temp) / 10, 0, 0.8) : 0;
      el['tb-down'].classList.toggle('hide', !pl.swimming);
      const building = pl.held && pl.held.id === 'hammer';
      el['tb-rot'].classList.toggle('hide', !(building && pl.build.type));
      const it = pl.held; el['tb-act'].textContent = it ? it.icon : '✊';
    }
    // build hint
    const bi = pl.buildInfo, hint = el.hint;
    let ht = '', bad = false;
    if (bi && pl.held && pl.held.id === 'hammer') {
      if (bi.place) { const o = bi.place, def = PIECES[bi.type]; bad = !o.ok || !o.afford; ht = !o.ok ? `${def.name}: ${o.why}` : !o.afford ? `${def.name}: need ${costText(def.cost)}` : `Place ${def.name}  ${costText(def.cost)}`; }
      else if (bi.remove) ht = bi.target ? `Remove ${PIECES[bi.target.type].name} (refund half)` : 'Remove mode: aim at a piece';
      else if (bi.repair && raft.condition < 0.995) ht = 'Repair mode: 🪵1 per repair';
    } else if (pl.helm) ht = `Helm · throttle ${Math.round(raft.throttle * 100)}% · sails ${raft.sailPow > 0 ? 'set' : 'furled'}`;
    if (ht !== this.hintTxt) { this.hintTxt = ht; hint.textContent = ht; hint.classList.toggle('hide', !ht); }
    hint.classList.toggle('bad', bad);
    // banners
    this.bannerT -= dt;
    if (this.bannerT <= 0 && el.banner.classList.contains('on')) { el.banner.classList.remove('on'); this.bannerT = 0.6; this.bannerGap = true; }
    else if (this.bannerT <= 0 && this.bannerQ.length) { const [t, s] = this.bannerQ.shift(); el.banner.querySelector('h2').textContent = t; el.banner.querySelector('p').textContent = s; el.banner.classList.add('on'); this.bannerT = 3.6; }
    this.vig = Math.max(0, this.vig - dt * 1.4); el.vig.style.opacity = Math.max(this.vig, pl.hp < 25 ? 0.25 + Math.sin(G.clock * 4) * 0.1 : 0);
    if (this.dirty) { this.dirty = false; this.renderHotbar(); if (this.panel && this.panel !== 'map' && this.panel !== 'pause' && this.panel !== 'log') { this.keepScroll = true; this.render(); } }
    this.drawCompass();
  }
  renderHotbar() { const pl = G.player; this.el.hotbar.innerHTML = pl.inv.slots.slice(0, 8).map((s, i) => `<div class="slot ${i === pl.sel ? 'sel' : ''}" data-hot="${i}">${this.touch ? '' : `<span class="k">${i + 1}</span>`}${s ? `${ITEMS[s.id].icon}${s.n > 1 ? `<span class="n">${s.n}</span>` : ''}` : ''}</div>`).join(''); this.lastSel = pl.sel; }
  renderQuest() {
    const pr = G.prog, act = pr.active().sort((a, b) => (b.main || 0) - (a.main || 0) || b.s - a.s).slice(0, this.touch ? 2 : 3);
    const h = `<h4>Stage ${pr.stage} · ${STAGES[pr.stage]}</h4>` + (act.map((q) => { const s = pr.questState(q); return `<div class="q"><b>${q.t} ${s.need > 1 ? `<span>(${s.have}/${s.need})</span>` : ''}</b><span>${q.d}</span></div>`; }).join('') || '<div class="q"><span>The sea is yours. Keep building.</span></div>');
    if (h !== this.questH) { this.questH = h; this.el.quest.innerHTML = h; }
    if (this.lastSel !== G.player.sel) this.renderHotbar();
  }
  drawCompass() {
    const g = this.cctx, W = 760, H = 68, pl = G.player, P = pl.pos;
    const head = Math.atan2(Math.sin(pl.camYaw), -Math.cos(pl.camYaw)); // 0 = north, clockwise
    g.clearRect(0, 0, W, H); g.textAlign = 'center'; g.textBaseline = 'middle';
    const ppr = W / (Math.PI * 0.9), X = (b) => { let d = b - head; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return W / 2 + d * ppr; };
    for (let i = 0; i < 24; i++) {
      const b = (i / 24) * Math.PI * 2, x = X(b); if (x < 30 || x > W - 30) continue;
      const fade = 1 - Math.abs(x - W / 2) / (W / 2); g.globalAlpha = clamp(fade * 1.6, 0, 1);
      if (i % 3 === 0) { g.fillStyle = i === 0 ? '#ff7a66' : '#fff'; g.font = (i % 6 === 0 ? '700 24px' : '16px') + ' system-ui'; g.fillText(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][i / 3], x, 26); }
      else { g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x - 1, 20, 2, 12); }
    }
    const mark = (wx, wz, icon, col) => { const d = Math.hypot(wx - P.x, wz - P.z); if (d < 6) return; const x = X(Math.atan2(wx - P.x, -(wz - P.z))); if (x < 30 || x > W - 30) return; g.globalAlpha = clamp((1 - Math.abs(x - W / 2) / (W / 2)) * 1.8, 0, 1); g.font = '22px system-ui'; g.fillText(icon, x, 46); g.font = '12px system-ui'; g.fillStyle = col || '#fff'; g.fillText(d > 999 ? (d / 1000).toFixed(1) + 'km' : Math.round(d) + 'm', x, 62); };
    const rp = G.raft.group.position; if (pl.platform !== G.raft) mark(rp.x, rp.z, '🛟');
    const pr = G.prog;
    if (pr.track) { const m = G.world.markers.find((k) => k.id === pr.track); if (m) mark(m.x, m.z, m.icon, '#ffb347'); }
    if (pl.hasGear('sextant')) for (const isl of ISLANDS) if (pr.revealed[isl.id] && pr.track !== isl.id) mark(isl.x, isl.z, '🏝️');
    if (G.ents.flare.visible) mark(G.ents.flare.position.x, G.ents.flare.position.z, '📦', '#ff8a6b');
    g.globalAlpha = 1; g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(W / 2, 4); g.lineTo(W / 2 - 7, -6 + 4); g.lineTo(W / 2 + 7, -2); g.fill(); g.fillRect(W / 2 - 1, 0, 2, 12);
  }
}
