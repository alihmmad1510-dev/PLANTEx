// PLANET X: first playable build. A cartoon-style building game.
// The Cosmic Bomb is a fictional cartoon device. It is not a real weapon and has no real-world function.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = s => document.querySelector(s);
const SAVE_KEY = 'planetx_save_v1';
const R = 10;                                   // planet radius
const LOW_END = (navigator.hardwareConcurrency || 4) <= 4;

const CFG = {
  bank: [   // [income per second at this level, cost to reach it]
    { name: 'Small Bank', income: 1, cost: 0 },
    { name: 'Larger Bank', income: 3, cost: 100 },
    { name: 'Futuristic Bank', income: 8, cost: 500 },
    { name: 'Advanced Bank', income: 20, cost: 2500 },
    { name: 'Premium Cosmic Bank', income: 60, cost: 12000 },
  ],
  city: [   // [income multiplier, cost to reach it]
    { name: 'Outpost', mult: 1, cost: 0 },
    { name: 'Village', mult: 1.25, cost: 150 },
    { name: 'Town', mult: 1.6, cost: 800 },
    { name: 'City', mult: 2.1, cost: 4000 },
    { name: 'Metropolis', mult: 2.8, cost: 20000 },
  ],
  deviceBase: 10, deviceMult: 5, deviceMax: 6,  // price to go from level L to L+1 = base * mult^(L-1)
  shipBase: 10, shipMult: 3, shipMax: 5,        // 10, 30, 90, 270
  powerEvents: [
    { at: 100, id: 'cosmetic', text: 'Cosmetic effects unlocked' },
    { at: 500, id: 'space', text: 'Special space event unlocked' },
    { at: 1000, id: 'planet', text: 'Planet Blast event unlocked (cartoon)' },
    { at: 10000, id: 'system', text: 'Solar System event unlocked (cartoon)' },
    { at: 100000, id: 'galaxy', text: 'Galaxy event unlocked (cartoon)' },
  ],
  dests: [
    { id: 'moon', name: 'Moon Grove', ship: 1, bank: 1, power: 0, secs: 15,
      yields: { co2: [2, 5], h2o: [3, 7] }, goal: { res: 'h2o', n: 6 }, bonus: 100 },
    { id: 'frost', name: 'Frost Ring', ship: 2, bank: 1, power: 0, secs: 25,
      yields: { h2: [2, 6], o2: [4, 9] }, goal: { res: 'o2', n: 10 }, bonus: 300 },
    { id: 'caves', name: 'Crystal Caves', ship: 3, bank: 3, power: 0, secs: 40,
      yields: { crystal: [1, 3], co2: [3, 8] }, goal: { res: 'crystal', n: 3 }, bonus: 1000 },
    { id: 'reef', name: 'Nebula Reef', ship: 4, bank: 4, power: 500, secs: 60,
      yields: { crystal: [2, 5], h2: [4, 10] }, goal: { res: 'h2', n: 15 }, bonus: 3000 },
  ],
  daily: [
    { t: 'coins', n: 100 }, { t: 'res', k: 'h2o', n: 5 }, { t: 'coins', n: 200 }, { t: 'gems', n: 5 },
    { t: 'res', k: 'co2', n: 8 }, { t: 'coins', n: 500 }, { t: 'res', k: 'crystal', n: 2 },
  ],
};

const RES = {
  co2: { name: 'CO₂' }, h2o: { name: 'H₂O' }, h2: { name: 'H₂' }, o2: { name: 'O₂' }, crystal: { name: 'Crystals' },
};
const TYPES = {
  ocean:  { name: 'Ocean Planet',  base: '#0b3d91', mid: '#2a9df4', spot: '#f2e6b0' },
  lava:   { name: 'Lava Planet',   base: '#1a0d0a', mid: '#ff6a1a', spot: '#ffd27a' },
  nature: { name: 'Nature Planet', base: '#1f6b2e', mid: '#4caf50', spot: '#c9b26b' },
  mystic: { name: 'Mystic Planet', base: '#2a0b4a', mid: '#9b5cff', spot: '#ffd1ff' },
};
const ACCENTS = ['#7bd3ff', '#8dff9a', '#ffd166', '#ff8fd8', '#b388ff', '#ff5e5e'];
const DEV_NAMES = ['Spark', 'Nova', 'Flare', 'Pulse', 'Aurora', 'Nebula Core'];

const SKINS = {          // gem-unlocked bomb colours
  gold: { name: 'Golden Bomb', gems: 10, color: '#ffd166' },
  rose: { name: 'Rose Bomb', gems: 10, color: '#ff8fd8' },
  sky: { name: 'Sky Bomb', gems: 10, color: '#7bd3ff' },
  mint: { name: 'Mint Bomb', gems: 10, color: '#8dff9a' },
  violet: { name: 'Violet Bomb', gems: 10, color: '#b388ff' },
  moon: { name: 'Moon Bomb', gems: 10, color: '#f4f7ff' },
};
const SHIP_NAMES = ['Scout', 'Explorer', 'Voyager', 'Nova Liner', 'Star Cruiser'];
const TITLES = { bank: 'Bank', city: 'City', device: 'Cosmic Bomb', ship: 'Spaceship', explore: 'Explore',
  daily: 'Daily Rewards', settings: 'Settings' };

// ---------- helpers ----------
const fmt = n => { n = Math.floor(n); return n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
  : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : n.toLocaleString('en-US'); };
const fmt1 = n => n < 10 ? n.toFixed(1) : fmt(n);
let toastT;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms);
}
function floatText(x, y, text) {
  const d = document.createElement('div'); d.className = 'float'; d.textContent = text;
  d.style.left = x + 'px'; d.style.top = y + 'px'; $('#floats').appendChild(d);
  setTimeout(() => d.remove(), 1100);
}
function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const dkey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---------- save ----------
function fresh() {
  return { created: false, name: '', type: 'ocean', accent: ACCENTS[0], money: 30, gems: 0, power: 0,
    bank: 1, city: 1, device: 1, ship: 1, skin: null, owned: [], res: { co2: 0, h2o: 0, h2: 0, o2: 0, crystal: 0 },
    daily: { last: '', day: 0 }, visited: {}, fired: [], last: Date.now(), sound: true, fx: !LOW_END };
}
function load() {
  const base = fresh();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return base;
    const d = JSON.parse(raw);
    return { ...base, ...d, res: { ...base.res, ...(d.res || {}) }, daily: { ...base.daily, ...(d.daily || {}) } };
  } catch (e) {
    console.error('Save data unreadable, starting fresh.', e);
    toast('Saved data could not be read. Starting a new planet.', 4000);
    return base;
  }
}
let S = load();
function save(msg = 'Saved') {
  S.last = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
    flashSave(msg);
  } catch (e) { console.error('Save failed', e); flashSave('Save failed'); }
}
let saveFlashT;
function flashSave(msg) {
  const el = $('#saveInd'); el.textContent = '✓ ' + msg; el.classList.add('on');
  clearTimeout(saveFlashT); saveFlashT = setTimeout(() => el.classList.remove('on'), 1500);
}

// ---------- economy ----------
const bankCfg = () => CFG.bank[S.bank - 1];
const cityCfg = () => CFG.city[S.city - 1];
const devMult = () => 1 + 0.5 * (S.device - 1);
const income = () => bankCfg().income * cityCfg().mult * devMult();
const nextBankCost = () => S.bank < CFG.bank.length ? CFG.bank[S.bank].cost : null;
const nextCityCost = () => S.city < CFG.city.length ? CFG.city[S.city].cost : null;
const devCost = () => S.device < CFG.deviceMax ? Math.round(CFG.deviceBase * CFG.deviceMult ** (S.device - 1)) : null;
const shipCost = () => S.ship < CFG.shipMax ? Math.round(CFG.shipBase * CFG.shipMult ** (S.ship - 1)) : null;
const canVisit = d => S.ship >= d.ship && S.bank >= d.bank && S.power >= d.power;

function pay(cost, fn, msg) {
  if (cost == null) return;
  if (S.money < cost) return toast('Not enough coins yet');
  S.money -= cost; fn(); done(msg);
}
function done(msg) { syncWorld(); save(msg); refreshHUD(); renderPanel(true); }
function checkPower() {
  for (const ev of CFG.powerEvents) {
    if (S.power >= ev.at && !S.fired.includes(ev.id)) {
      S.fired.push(ev.id); S.gems += 5; worldEvent(ev.id);
      toast(`⭐ Power ${fmt(ev.at)}: ${ev.text} (+5 gems)`, 4000);
    }
  }
}

// ---------- daily rewards (7-day cycle, local date) ----------
function dailyState() {
  const today = dkey(new Date()), yest = dkey(new Date(Date.now() - 864e5));
  const claimable = S.daily.last !== today;
  const next = claimable ? (S.daily.last === yest ? (S.daily.day % 7) + 1 : 1) : S.daily.day;
  return { claimable, next };
}
function rewardText(r) {
  return r.t === 'coins' ? `${r.n} coins` : r.t === 'gems' ? `${r.n} gems` : `${r.n} ${RES[r.k].name}`;
}
function claimDaily() {
  const st = dailyState();
  if (!st.claimable) return;
  const r = CFG.daily[st.next - 1];
  if (r.t === 'coins') S.money += r.n; else if (r.t === 'gems') S.gems += r.n; else S.res[r.k] += r.n;
  S.daily = { last: dkey(new Date()), day: st.next };
  done('Reward claimed');
  toast(`Day ${st.next} reward: ${rewardText(r)}`);
}

// ---------- trips ----------
let trip = null;   // { d, t, dur, yx }
function startTrip(id) {
  const d = CFG.dests.find(x => x.id === id);
  if (!d || trip || !canVisit(d)) return toast('That destination is locked or busy');
  trip = { d, t: 0, dur: d.secs * (1 - 0.1 * (S.ship - 1)), yx: 1 + 0.25 * (S.ship - 1) };
  setTravel(true); closePanel();
  $('#tname').textContent = 'Travelling to ' + d.name;
  $('#travel').classList.add('on');
}
function updateTrip(dt) {
  trip.t += dt;
  $('#tbar').style.width = Math.min(100, trip.t / trip.dur * 100) + '%';
  if (trip.t >= trip.dur) finishTrip();
}
function finishTrip() {
  const { d, yx } = trip; trip = null;
  $('#travel').classList.remove('on'); setTravel(false);
  const got = {};
  for (const [k, [lo, hi]] of Object.entries(d.yields)) {
    const n = Math.max(1, Math.round((lo + Math.random() * (hi - lo)) * yx));
    got[k] = n; S.res[k] += n;
  }
  let line = `Back from ${d.name}: ` + Object.entries(got).map(([k, n]) => `+${n} ${RES[k].name}`).join(', ');
  if ((got[d.goal.res] || 0) >= d.goal.n) { S.money += d.bonus; line += ` • Mission complete! +${fmt(d.bonus)} coins`; }
  S.visited[d.id] = (S.visited[d.id] || 0) + 1;
  done('Trip complete'); toast(line, 5000);
}

// ---------- panels ----------
let panelKey = null, lastPanel = '';
const btn = (a, label, cost, arg = '') => `<button class="big" data-act="${a}" data-arg="${arg}" ${cost != null && S.money >= cost ? '' : 'disabled'}>${label}<small>${cost != null ? 'Cost ' + fmt(cost) + ' coins' : ''}</small></button>`;
const skinsHTML = () => [{ key: '', name: 'Automatic (follows level)', gems: 0 },
  ...Object.entries(SKINS).map(([k, v]) => ({ key: k, name: v.name, gems: v.gems }))].map(s => {
    const eq = (S.skin || '') === s.key, owned = !s.key || S.owned.includes(s.key);
    const action = eq ? '<span class="hint">✓ Equipped</span>'
      : owned ? `<button class="big" data-act="equip" data-arg="${s.key}">Equip</button>`
      : `<button class="big" data-act="unlock" data-arg="${s.key}" ${S.gems >= s.gems ? '' : 'disabled'}>Unlock for ${s.gems} gems</button>`;
    return `<div class="card"><b>${s.name}</b>${action}</div>`;
  }).join('');
const PANELS = {
  bank: () => {
    const nx = CFG.bank[S.bank], c = nextBankCost();
    return `<p>${bankCfg().name}, Level ${S.bank}</p><div class="big-num">+${fmt1(income())}/s</div>` +
      (nx ? `<p>Next: ${nx.name} gives +${fmt1(nx.income * cityCfg().mult * devMult())}/s</p>` + btn('bank', `Upgrade to Lv ${S.bank + 1}`, c)
        : '<p>Maximum bank level reached.</p>');
  },
  city: () => {
    const nx = CFG.city[S.city], c = nextCityCost();
    return `<p>${cityCfg().name}, Level ${S.city}</p><p>Income multiplier <b>x${cityCfg().mult}</b></p>` +
      (nx ? `<p>Next: ${nx.name} gives x${nx.mult}. New buildings and roads appear.</p>` + btn('city', `Upgrade to Lv ${S.city + 1}`, c)
        : '<p>Maximum city level reached.</p>');
  },
  device: () => {
    const c = devCost();
    return `<p>${DEV_NAMES[S.device - 1]}, Level ${S.device} of ${CFG.deviceMax}</p>
      <p>Income multiplier <b>x${devMult().toFixed(1)}</b> • Power <b>${fmt(S.power)}</b></p>
      <p class="hint">A cartoon Cosmic Bomb. Upgrades add stripes and glow, and their cost goes to Power.</p>` +
      (c != null ? btn('device', `Upgrade to Lv ${S.device + 1}`, c) : '<p>Maximum level reached.</p>') +
      '<p class="lbl" style="margin-top:14px">Looks (gems)</p>' + skinsHTML() +
      '<p class="lbl" style="margin-top:14px">Power milestones</p>' +
      CFG.powerEvents.map(e => `<div class="row2 ${S.power >= e.at ? 'done' : ''}"><span>${fmt(e.at)}</span><span>${e.text}</span></div>`).join('');
  },
  ship: () => {
    const c = shipCost();
    return `<p>${SHIP_NAMES[S.ship - 1]}, Level ${S.ship} of ${CFG.shipMax}</p>
      <p>Trip time x${(1 - 0.1 * (S.ship - 1)).toFixed(1)} • Resource yield +${25 * (S.ship - 1)}%</p>` +
      (c != null ? btn('ship', `Upgrade ship to Lv ${S.ship + 1}`, c) : '<p>Maximum ship level reached.</p>');
  },
  explore: () => (trip ? '<p class="hint">A trip is in progress…</p>' : '') + CFG.dests.map(d => {
    const ok = canVisit(d), dur = Math.round(d.secs * (1 - 0.1 * (S.ship - 1)));
    return `<div class="card"><b>${d.name}</b> <span class="hint">visited ${S.visited[d.id] || 0}×</span>
      <small>${ok ? `${dur}s trip • Mission: collect ${d.goal.n} ${RES[d.goal.res].name} • Bonus ${fmt(d.bonus)} coins`
        : `Unlocks at Ship Lv ${d.ship}, Bank Lv ${d.bank}${d.power ? ', Power ' + fmt(d.power) : ''}`}</small>
      <button data-act="travel" data-arg="${d.id}" ${ok && !trip ? '' : 'disabled'}>${ok ? 'Launch' : 'Locked'}<small></small></button></div>`;
  }).join(''),
  daily: () => {
    const st = dailyState();
    return `<div class="days">${CFG.daily.map((r, i) => {
      const n = i + 1, isDone = st.claimable ? n < st.next : n <= st.next, now = st.claimable && n === st.next;
      return `<div class="day ${isDone ? "done" : ""} ${now ? 'now' : ''}"><b>Day ${n}</b><small>${rewardText(r)}</small></div>`;
    }).join('')}</div>` +
      `<button class="big" data-act="claim" ${st.claimable ? '' : 'disabled'}>${st.claimable ? 'Claim day ' + st.next : 'Come back tomorrow'}<small>${st.claimable ? rewardText(CFG.daily[st.next - 1]) : ''}</small></button>`;
  },
  settings: () => `
    <button class="big" data-act="fx">Effects: ${S.fx ? 'High' : 'Low (saves battery)'}</button>
    <button class="big" data-act="planet">Change planet look</button>
    <button class="big" data-act="reset" style="background:#5a1c2a">Reset progress</button>
    <details class="credits"><summary>Credits and licenses</summary>
      <p>PLANET X is an original game project. We respect the rights of creators. If any copyrighted material is unintentionally included, we will review it and remove or replace it where appropriate. We aim to use original designs and properly licensed assets.</p>
      <p>Three.js, MIT License.</p></details>`,
};
function openPanel(k) {
  panelKey = k; lastPanel = ''; $('#ptitle').textContent = TITLES[k];
  $('#panel').classList.add('on'); renderPanel(true);
}
function closePanel() { panelKey = null; $('#panel').classList.remove('on'); }
function renderPanel(force) {
  if (!panelKey) return;
  const html = PANELS[panelKey]();
  if (force || html !== lastPanel) { lastPanel = html; $('#pbody').innerHTML = html; }
}
function act(a, arg) {
  if (a === 'bank') return pay(nextBankCost(), () => S.bank++, 'Bank upgraded');
  if (a === 'city') return pay(nextCityCost(), () => S.city++, 'City upgraded');
  if (a === 'device') { const c = devCost(); return pay(c, () => { S.device++; S.power += c; checkPower(); }, 'Cosmic Bomb upgraded'); }
  if (a === 'ship') return pay(shipCost(), () => S.ship++, 'Spaceship upgraded');
  if (a === 'equip') { S.skin = arg || null; return done('Look changed'); }
  if (a === 'unlock') {
    const sk = SKINS[arg];
    if (!sk) return;
    if (S.gems < sk.gems) return toast('Not enough gems yet');
    S.gems -= sk.gems; S.owned.push(arg); S.skin = arg;
    return done('Look unlocked');
  }
  if (a === 'travel') return startTrip(arg);
  if (a === 'claim') return claimDaily();
  if (a === 'fx') { S.fx = !S.fx; save('Saved'); return renderPanel(true); }
  if (a === 'planet') { closePanel(); return showCreate(); }
  if (a === 'reset') {
    if (confirm('Erase all PLANET X progress on this device?')) { localStorage.removeItem(SAVE_KEY); location.reload(); }
  }
}

// ---------- HUD ----------
function refreshHUD() {
  $('#planetName').textContent = S.name || 'Unnamed planet';
  $('#money').textContent = fmt(S.money);
  $('#gems').textContent = fmt(S.gems);
  $('#power').textContent = fmt(S.power);
  $('#bankLv').textContent = S.bank;
  $('#cityLv').textContent = S.city;
  $('#inc').textContent = `+${fmt1(income())}/s`;
  for (const k in RES) $('#r-' + k).textContent = fmt(S.res[k]);
  $('[data-open="daily"]').classList.toggle('ping', dailyState().claimable);
}

// ---------- planet look ----------
function applyPlanet() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d'), T = TYPES[S.type] || TYPES.ocean;
  const rnd = rng(hash((S.name || 'Planet X') + S.type));
  g.fillStyle = T.base; g.fillRect(0, 0, 1024, 512);
  const lava = S.type === 'lava';
  for (let i = 0; i < (lava ? 60 : 150); i++) {
    const x = rnd() * 1024, y = rnd() * 512, r = 20 + rnd() * 90, col = rnd() < 0.5 ? T.mid : T.spot;
    g.globalAlpha = lava ? 0.35 : 0.6;
    for (const ox of [-1024, 0, 1024]) {                 // wrap blobs across the seam
      const gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, r);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x + ox, y, r, 0, Math.PI * 2); g.fill();
    }
  }
  g.globalAlpha = 1;
  if (lava) {                                             // glowing cracks
    g.strokeStyle = T.spot; g.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
      let x = rnd() * 1024, y = rnd() * 512; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 12; s++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 40; g.lineTo(x, y); }
      g.stroke();
    }
  }
  g.fillStyle = S.accent;                                 // personal accent sparkles
  for (let i = 0; i < 220; i++) { g.beginPath(); g.arc(rnd() * 1024, rnd() * 512, 0.8 + rnd() * 1.8, 0, Math.PI * 2); g.fill(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  planetMesh.material.map?.dispose();
  planetMesh.material.map = tex; planetMesh.material.needsUpdate = true;
  atmo.material.color.set(S.accent);
  buildScenery();
}

// ---------- 3D world ----------
let renderer, scene, camera, controls, stars, raycaster, planetG, planetMesh, atmo;
let bankG, cityG, deviceG, glow, ringG, coreG, padG, shipG, shipBody;
let clickables = [];
let sceneryG = null;
let particles = [], shake = 0, shipDrop = 0, travelOn = false, time = 0;
const built = { bank: 0, city: 0, ship: 0 };

function M(geo, color, x = 0, y = 0, z = 0, emissive = null, ei = 0) {
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.25,
    emissive: emissive || '#000000', emissiveIntensity: ei }));
  m.position.set(x, y, z);
  m.castShadow = !LOW_END; m.receiveShadow = !LOW_END;
  return m;
}
function surface(obj, lat, lon, h = 0, parent = null) {   // flat ground: lon -> x, lat -> -z
  obj.position.set(lon * R, h, -lat * R);
  obj.quaternion.identity();
  (parent || planetG).add(obj);
  return obj;
}

function makeNebula() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d'), rnd = rng(99);
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#05061a'); sky.addColorStop(0.6, '#1b1450'); sky.addColorStop(1, '#3a1d5c');
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
  for (const [x, y, r, col] of [[280, 170, 230, '#6a3cff'], [700, 120, 200, '#2aa8ff'], [560, 330, 260, '#ff5fb0']]) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.35; g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 700; i++) {
    g.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`;
    g.beginPath(); g.arc(rnd() * 1024, rnd() * 512, rnd() < 0.05 ? 1.6 : 0.6, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeDaySky() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d'), rnd = rng(7);
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#2f8fe0'); sky.addColorStop(0.6, '#8fd0ff'); sky.addColorStop(1, '#d9f2ff');
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 14; i++) {
    const x = rnd() * 1024, y = 60 + rnd() * 180, s = 40 + rnd() * 60;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(x + k * s * 0.5 - s, y + (k % 2) * 8, s * 0.7, s * 0.3, 0, 0, Math.PI * 2); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function initWorld() {
  renderer = new THREE.WebGLRenderer({ canvas: $('#c'), antialias: !LOW_END, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, LOW_END ? 1 : 2));
  renderer.shadowMap.enabled = !LOW_END;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  scene = new THREE.Scene();
  scene.background = makeDaySky();
  scene.fog = new THREE.Fog('#cfeeff', 40, 120);
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 800);
  camera.position.set(0, 9, 32);
  controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, enablePan: false, minDistance: 16, maxDistance: 46 });
  scene.add(new THREE.HemisphereLight('#cfe8ff', '#3c6b2c', 1.1));
  const sun = new THREE.DirectionalLight('#fff6e6', 3.4);
  sun.position.set(20, 30, 14); sun.castShadow = !LOW_END;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 });
  scene.add(sun);

  const N = LOW_END ? 500 : 1400, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = 150 + Math.random() * 300;
    pos.set([s * Math.cos(th) * r, u * r, s * Math.sin(th) * r], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.2, transparent: true, opacity: 0.85 }));
  stars.visible = false;
  scene.add(stars);

  planetG = new THREE.Group(); scene.add(planetG);
  planetMesh = new THREE.Mesh(new THREE.CircleGeometry(28, LOW_END ? 48 : 96).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ roughness: 0.85 }));
  planetMesh.receiveShadow = !LOW_END;
  planetG.add(planetMesh);
  atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.1, 48, 32), new THREE.MeshBasicMaterial({ transparent: true,
    opacity: 0.2, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  atmo.visible = false;
  planetG.add(atmo);

  bankG = surface(new THREE.Group(), 0.05, 0.35); bankG.userData.action = 'bank';
  cityG = surface(new THREE.Group(), 0.0, -0.32); cityG.userData.action = 'city';
  padG = surface(new THREE.Group(), -0.25, 0.5, 0);
  padG.add(M(new THREE.CylinderGeometry(1.8, 1.9, 0.1, 32), '#2c3e50', 0, 0.05, 0, '#3fe08f', 0.4));
  const hangar = new THREE.Group();
  hangar.add(M(new THREE.BoxGeometry(2.4, 1.3, 2.0), '#8fa3c0', 0, 0.65, 0));
  hangar.add(M(new THREE.BoxGeometry(2.7, 0.15, 2.3), '#3a4766', 0, 1.35, 0));
  hangar.add(M(new THREE.BoxGeometry(1.4, 0.9, 0.06), '#1b2236', 0, 0.45, 1.03));
  hangar.add(M(new THREE.BoxGeometry(2.0, 0.08, 0.08), S.accent, 0, 1.0, 1.06, S.accent, 1.2));
  hangar.position.set(-2.8, 0, 0); hangar.userData.action = 'ship';
  padG.add(hangar);
  shipG = surface(new THREE.Group(), -0.25, 0.5, 0.12); shipG.userData.action = 'ship';
  deviceG = surface(new THREE.Group(), 0.72, 0); deviceG.userData.action = 'device';
  glow = new THREE.Mesh(new THREE.SphereGeometry(2.2, 32, 20), new THREE.MeshBasicMaterial({ transparent: true,
    opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.y = 1.7;
  ringG = new THREE.Group(); ringG.position.y = 1.7;
  coreG = new THREE.Group(); coreG.position.y = 0;
  deviceG.add(glow, ringG, coreG);
  clickables = [bankG, cityG, deviceG, shipG, hangar, ...buildLayout()];

  buildRooms();
  raycaster = new THREE.Raycaster();
  const cvs = renderer.domElement;
  let down = null;
  cvs.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  cvs.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
    down = null;
    if (moved > 8 || dt > 400) return;
    const a = pick(e.clientX, e.clientY);
    if (['bank', 'city', 'ship', 'explore', 'daily'].includes(a)) openPanel(a);
    else if (a === 'device') tapStar(e.clientX, e.clientY);
  });
  let look = null;
  cvs.addEventListener('pointerdown', e => { look = { x: e.clientX, y: e.clientY }; });
  cvs.addEventListener('pointermove', e => {
    if (!walk.on || !look) return;
    walk.yaw -= (e.clientX - look.x) * 0.006;                  // full 360 degrees
    walk.pitch = clamp(walk.pitch - (e.clientY - look.y) * 0.004, -1.2, 1.2);
    look = { x: e.clientX, y: e.clientY };
  });
  cvs.addEventListener('pointerup', () => { look = null; });
  cvs.addEventListener('pointercancel', () => { look = null; });
  window.addEventListener('resize', resize);
  resize();
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
function pick(x, y) {
  const r = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
  const hits = raycaster.intersectObjects([planetMesh, ...clickables], true);
  if (!hits.length) return null;                        // the planet itself blocks buildings behind it
  for (let o = hits[0].object; o; o = o.parent) if (o.userData.action) return o.userData.action;
  return null;
}

const coreColor = () => (S.skin && SKINS[S.skin] ? SKINS[S.skin].color : ACCENTS[S.device - 1]);
// The Cosmic Bomb: a cartoon rocket-bomb built from simple shapes. One fin per 120 degrees,
// a porthole, stripes that grow with each level, and a halo ring from level 4.
function buildCore(lv, col) {
  coreG.clear();
  coreG.add(M(new THREE.CylinderGeometry(0.9, 0.9, 2.4, 24), '#f4f7ff', 0, 1.6, 0));
  coreG.add(M(new THREE.ConeGeometry(0.9, 1.1, 24), col, 0, 3.15, 0, col, 0.2));
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    const fin = M(new THREE.BoxGeometry(0.9, 1.1, 0.15), col, Math.cos(a) * 0.95, 0.6, Math.sin(a) * 0.95);
    fin.rotation.y = -a; coreG.add(fin);
  }
  coreG.add(M(new THREE.SphereGeometry(0.32, 16, 12), '#1b2b4a', 0, 2.0, 0.92, col, 1.0));
  for (const y of lv >= 2 ? [1.0, 2.2] : [1.6]) {
    const stripe = M(new THREE.TorusGeometry(0.91, 0.06, 8, 32), col, 0, y, 0, col, 0.6);
    stripe.rotation.x = Math.PI / 2; coreG.add(stripe);
  }
  if (lv >= 4) {
    const halo = M(new THREE.TorusGeometry(1.35, 0.05, 8, 40), col, 0, 0.5, 0, col, 1.0);
    halo.rotation.x = Math.PI / 2; coreG.add(halo);
  }
}

const BANK_COL = ['#9fb3cf', '#5fa8ff', '#b388ff', '#ffb347', '#ff6fb1'];
function buildBank(lv) {
  bankG.clear(); bankG.userData.crystal = null;
  const col = BANK_COL[lv - 1], w = 1.4 + 0.35 * lv, h = 1 + 0.45 * lv, acc = S.accent;
  bankG.add(M(new THREE.BoxGeometry(w, h, w), col, 0, h / 2, 0));
  bankG.add(M(new THREE.BoxGeometry(w * 0.3, 0.6, 0.06), '#1b2236', 0, 0.3, w / 2 + 0.03));
  if (lv >= 2) {
    const n = lv + 1;
    for (let i = 0; i < n; i++) bankG.add(M(new THREE.CylinderGeometry(0.08, 0.08, h * 0.9, 8), '#f5f7ff',
      -w / 2 + (i + 0.5) * w / n, h * 0.45, w / 2 + 0.08));
  }
  if (lv >= 3) { const roof = M(new THREE.ConeGeometry(w * 0.75, 0.9, 4), acc, 0, h + 0.45, 0); roof.rotation.y = Math.PI / 4; bankG.add(roof); }
  if (lv >= 4) { const ring = M(new THREE.TorusGeometry(w * 0.62, 0.05, 8, 40), acc, 0, h * 0.6, 0, acc, 1.5); ring.rotation.x = Math.PI / 2; bankG.add(ring); }
  if (lv >= 5) { const cr = M(new THREE.OctahedronGeometry(0.5), acc, 0, h + 1.9, 0, acc, 1.2); bankG.userData.crystal = cr; bankG.add(cr); }
}

const CITY_N = [1, 3, 5, 8, 12];
function buildCity(lv) {
  cityG.clear();
  cityG.add(M(new THREE.BoxGeometry(6.4, 0.06, 0.9), '#2b3550', 0, 0.03, 0));
  const rnd = rng(42), palette = ['#e8eefc', '#9fd4ff', '#ffe3a3', '#c6b6ff'];
  for (let i = 0; i < CITY_N[lv - 1]; i++) {
    const x = -2.4 + (i % 4) * 1.6, z = 1.0 + Math.floor(i / 4) * 1.3;
    const h = 0.7 + rnd() * (0.6 + 0.3 * lv);
    cityG.add(M(new THREE.BoxGeometry(1, h, 1), palette[Math.floor(rnd() * 4)], x, h / 2, z));
    if (i % 3 === 0) cityG.add(M(new THREE.ConeGeometry(0.35, 0.8, 8), '#4fd18b', x + 0.75, 0.4, z + 0.5));
  }
}

function buildShip(lv) {
  shipG.clear();
  const b = new THREE.Group(); shipG.add(b); shipBody = b;
  const hull = ['#dfe7f5', '#8fd3ff', '#ffd166', '#c9a3ff', '#ffffff'][lv - 1], acc = S.accent, len = 1.2 + 0.25 * lv;
  b.add(M(new THREE.CapsuleGeometry(0.4, len, 6, 12).rotateX(Math.PI / 2), hull, 0, 0.9, 0));
  b.add(M(new THREE.SphereGeometry(0.28, 16, 10), '#1b2b4a', 0, 1.1, len * 0.35, acc, 0.8));
  if (lv >= 2) b.add(M(new THREE.BoxGeometry(1 + 0.45 * lv, 0.06, 0.7), hull, 0, 0.9, -0.1));
  for (const x of lv >= 3 ? [-0.35, 0.35] : [0])
    b.add(M(new THREE.CylinderGeometry(0.18, 0.24, 0.5, 10).rotateX(Math.PI / 2), '#555f78', x, 0.9, -len / 2 - 0.25, acc, 1));
  if (lv >= 4) {
    b.add(M(new THREE.BoxGeometry(0.06, 0.55, 0.5), acc, 0, 1.3, -len / 2 + 0.1, acc, 1.5));
    b.add(M(new THREE.BoxGeometry(0.1, 0.08, len * 0.8), acc, 0.42, 0.9, 0, acc, 1.5));
  }
  if (lv >= 5) b.add(M(new THREE.TorusGeometry(0.9, 0.05, 8, 40), acc, 0, 0.9, 0.2, acc, 1.5));
}

function syncDevice() {
  const lv = S.device, col = coreColor();
  deviceG.scale.setScalar(1 + 0.05 * (lv - 1));
  coreG.scale.set(1, 2.2, 1);
  glow.position.y = ringG.position.y = 3.6;
  glow.material.color.set(col);
  glow.material.opacity = 0.1 + 0.03 * lv;
  ringG.clear();
  buildCore(lv, col);
  for (let i = 0; i < lv - 1; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2 + 0.5 * i, 0.05, 8, 64), new THREE.MeshBasicMaterial({ color: col }));
    ring.rotation.x = Math.PI / 2 + 0.35 * i;
    ringG.add(ring);
  }
}
function syncWorld() {
  if (built.bank !== S.bank) { buildBank(S.bank); built.bank = S.bank; }
  if (built.city !== S.city) { buildCity(S.city); built.city = S.city; }
  if (built.ship !== S.ship) { buildShip(S.ship); built.ship = S.ship; }
  syncDevice();
}
function setTravel(on) { travelOn = on; shipG.visible = !on; if (!on) shipDrop = 1; }

function burst(pos, color, count) {
  const n = S.fx ? count : Math.ceil(count / 3);
  const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), v = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
      .multiplyScalar(3 + Math.random() * 6);
    p.set([pos.x, pos.y, pos.z], i * 3); v.set([d.x, d.y, d.z], i * 3);
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(g, mat);
  scene.add(pts);
  particles.push({ pts, g, mat, p, v, age: 0, life: 1.3 });
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i]; q.age += dt;
    for (let k = 0; k < q.p.length; k++) { q.p[k] += q.v[k] * dt; q.v[k] *= 0.97; }
    q.g.attributes.position.needsUpdate = true;
    q.mat.opacity = Math.max(0, 1 - q.age / q.life);
    if (q.age >= q.life) { scene.remove(q.pts); q.g.dispose(); q.mat.dispose(); particles.splice(i, 1); }
  }
}
function worldEvent(id) {
  const p = deviceG.getWorldPosition(new THREE.Vector3());
  const n = { cosmetic: 2, space: 3, planet: 5, system: 7, galaxy: 10 }[id] || 2;
  const cols = ['#ff8fd8', '#7bd3ff', '#ffd166', '#8dff9a', '#b388ff'];
  for (let i = 0; i < n; i++) burst(p, cols[i % cols.length], 160);
  if (['planet', 'system', 'galaxy'].includes(id)) shake = 1.0;

}
// soft light ring that expands from the star core on every tap
let shockwaves = [];
function shockwave(color) {
  const p = deviceG.getWorldPosition(new THREE.Vector3());
  const m = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.8, 48), new THREE.MeshBasicMaterial({ color, transparent: true,
    opacity: 1, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.copy(p);
  const n = p.clone().sub(planetG.getWorldPosition(new THREE.Vector3())).normalize();
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  scene.add(m); shockwaves.push({ m, age: 0 });
}
function updateShockwaves(dt) {
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i]; s.age += dt;
    const k = s.age / 0.7;
    s.m.scale.setScalar(1 + k * 6);
    s.m.material.opacity = Math.max(0, 1 - k);
    if (k >= 1) { scene.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); shockwaves.splice(i, 1); }
  }
}
let lastTap = 0;
function tapStar(x, y) {
  const now = performance.now();
  if (now - lastTap < 600) return;
  lastTap = now;
  const reward = Math.max(1, Math.round(income() * 2));
  S.money += reward;
  burst(deviceG.getWorldPosition(new THREE.Vector3()), ACCENTS[S.device - 1], 120);
  shockwave(ACCENTS[S.device - 1]);
  floatText(x, y, '+' + fmt(reward));
}

function updateWorld(dt) {
  time += dt;
  stars.rotation.y += dt * (travelOn ? 1.2 : 0.01);
  shake = Math.max(0, shake - dt);
  planetG.position.set((Math.random() - 0.5) * shake * 0.6, 0, (Math.random() - 0.5) * shake * 0.6);
  glow.scale.setScalar(1 + 0.06 * Math.sin(time * 3));
  coreG.rotation.y += dt * 0.8;
  ringG.rotation.y += dt * 0.6;
  if (bankG.userData.crystal) bankG.userData.crystal.rotation.y += dt * 1.5;
  if (shipDrop > 0 && shipBody) { shipBody.position.y = 5 * shipDrop; shipDrop = Math.max(0, shipDrop - dt * 0.6); }
  updateParticles(dt);
  updateShockwaves(dt);
  if (walk.on) updateWalk(dt); else controls.update();
  renderer.render(scene, camera);
}

// ---------- enter the planet: loading screen, then walk on the surface ----------
function enterPlanet() {
  const el = $('#loading');
  el.innerHTML = 'Building your planet…';
  el.classList.remove('hide');
  setTimeout(() => { el.classList.add('hide'); setWalk(true); }, 1200);
}

// ---------- create / edit planet ----------
function showCreate() {
  $('#pname').value = S.name;
  $('#createBtn').textContent = S.created ? 'Save planet' : 'Create planet';
  markCreate();
  $('#create').classList.add('on');
}
function hideCreate() { $('#create').classList.remove('on'); }
function markCreate() {
  document.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('on', b.dataset.type === S.type));
  document.querySelectorAll('[data-acc]').forEach(b => b.classList.toggle('on', b.dataset.acc === S.accent));
}
function setupUI() {
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openPanel(b.dataset.open));
  $('#pclose').onclick = closePanel;
  $('#walkBtn').onclick = () => setWalk(!walk.on);
  $('#panel').onclick = e => { if (e.target.id === 'panel') closePanel(); };
  $('#pbody').onclick = e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) act(b.dataset.act, b.dataset.arg); };
  $('#types').innerHTML = Object.entries(TYPES).map(([k, t]) =>
    `<button data-type="${k}"><span class="sw" style="background:${t.mid}"></span>${t.name}</button>`).join('');
  $('#accents').innerHTML = ACCENTS.map(c => `<button class="acc" data-acc="${c}" style="background:${c}" aria-label="glow ${c}"></button>`).join('');
  $('#types').onclick = e => { const b = e.target.closest('[data-type]'); if (!b) return; S.type = b.dataset.type; applyPlanet(); markCreate(); };
  $('#accents').onclick = e => { const b = e.target.closest('[data-acc]'); if (!b) return; S.accent = b.dataset.acc; applyPlanet(); markCreate(); };
  $('#pname').oninput = e => { S.name = e.target.value.trim().slice(0, 20) || 'My Planet'; applyPlanet(); refreshHUD(); };
  $('#createBtn').onclick = () => {
    const first = !S.created;
    S.created = true;
    S.name = $('#pname').value.trim().slice(0, 20) || 'My Planet';
    hideCreate(); save(first ? 'Planet created' : 'Saved'); refreshHUD(); applyPlanet();
    if (first) enterPlanet();
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) save('Saved'); });
  window.addEventListener('pagehide', () => save('Saved'));
}

// ---------- rooms: fenced zones with a floor and a neon sign ----------
function buildRooms() {
  const ROOMS = [
    { name: 'BANK PLAZA', lat: 0.05, lon: 0.35, w: 7, d: 6, col: '#5fa8ff' },
    { name: 'CITY BLOCK', lat: 0, lon: -0.32, w: 9, d: 5, col: '#8dff9a' },
    { name: 'HANGAR BAY', lat: -0.25, lon: 0.5, w: 6, d: 6, col: '#ffd166' },
  ];
  for (const r of ROOMS) {
    const g = surface(new THREE.Group(), r.lat, r.lon, 0);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#2c3446', roughness: 0.35, metalness: 0.25 }));
    floor.position.y = 0.02; floor.receiveShadow = !LOW_END; g.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: r.col, emissive: r.col, emissiveIntensity: 0.25, roughness: 0.35, metalness: 0.25 });
    for (const [x, z, bw, bd] of [[0, -r.d / 2, r.w, 0.12], [0, r.d / 2, r.w, 0.12], [-r.w / 2, 0, 0.12, r.d], [r.w / 2, 0, 0.12, r.d]]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.6, bd), wallMat);
      wall.position.set(x, 0.3, z); wall.castShadow = !LOW_END; g.add(wall);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65),
      new THREE.MeshBasicMaterial({ map: signTex(r.name, r.col), side: THREE.DoubleSide }));
    sign.position.set(0, 1.4, -r.d / 2); g.add(sign);
  }
}

// ---------- layout: a road from the launch pad to the city, and signboards on the walk ----------
function signTex(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0b1020'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = color; g.lineWidth = 8; g.strokeRect(4, 4, 248, 120);
  g.fillStyle = color; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function buildLayout() {
  const roadG = new THREE.Group(); planetG.add(roadG);
  const a = [-0.25, 0.5], b = [0, -0.32], steps = 40;      // launch pad -> city
  const heading = Math.atan2(b[1] - a[1], -(b[0] - a[0]));   // flat ground: z = -lat
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const tile = M(new THREE.BoxGeometry(0.7, 0.04, 0.9), '#3a4352');
    surface(tile, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0.02, roadG);
    tile.rotation.y = heading;
  }
  const out = [];
  const SIGNS = [['EXPLORE', '#ff8fd8', 0.12, -0.05, 'explore'], ['DAILY', '#ffd166', -0.12, 0.45, 'daily']];
  for (const [text, col, lat, lon, act] of SIGNS) {
    const g = new THREE.Group();
    g.add(M(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), '#444c5e', 0, 0.8, 0));
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9),
      new THREE.MeshBasicMaterial({ map: signTex(text, col), side: THREE.DoubleSide }));
    panel.position.set(0, 1.8, 0); g.add(panel);
    g.userData.action = act;
    surface(g, lat, lon, 0);
    out.push(g);
  }
  return out;
}

// ---------- scenery (things you can walk past) ----------
const LANDMARKS = [[0.05, 0.35], [0, -0.32], [0.72, 0], [-0.25, 0.5]];
const nearLandmark = (lat, lon) => LANDMARKS.some(([a, b]) => Math.hypot(lat - a, (lon - b) * Math.cos(lat)) < 0.18);
function buildScenery() {
  if (sceneryG) { planetG.remove(sceneryG); sceneryG.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); }
  sceneryG = new THREE.Group(); planetG.add(sceneryG);
  const kind = S.type, rnd = rng(hash((S.name || 'x') + kind + 'scenery'));
  const geo = { nature: new THREE.ConeGeometry(0.35, 1.4, 6), ocean: new THREE.DodecahedronGeometry(0.35),
    lava: new THREE.DodecahedronGeometry(0.4), mystic: new THREE.OctahedronGeometry(0.45) }[kind];
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.6,
    color: { nature: '#2e8b3e', ocean: '#d9c58a', lava: '#2a1a16', mystic: '#c9a0ff' }[kind],
    emissive: kind === 'mystic' || kind === 'lava' ? S.accent : '#000000',
    emissiveIntensity: kind === 'mystic' ? 0.6 : kind === 'lava' ? 0.3 : 0 });
  for (let i = 0; i < 70; i++) {
    const lat = Math.asin(rnd() * 1.6 - 0.8), lon = rnd() * Math.PI * 2;
    if (nearLandmark(lat, lon)) continue;
    const m = new THREE.Mesh(geo, mat);
    m.scale.setScalar(0.6 + rnd() * 0.8);
    surface(m, lat, lon, kind === 'nature' ? 0.7 : 0.3, sceneryG);
  }
}

// ---------- walk mode: stand on the planet, look 360 degrees, walk around ----------
const walk = { on: false, lat: 0, lon: 0.05, yaw: 0, pitch: -0.15 };
const keys = {};
const joy = { x: 0, y: 0 };
const KEY_F = ['w', 'arrowup'], KEY_B = ['s', 'arrowdown'], KEY_L = ['a', 'arrowleft'], KEY_R = ['d', 'arrowright'];
const held = list => list.some(k => keys[k]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function basis() {                         // flat ground: up = y, east = +x, north = -z
  return { U: new THREE.Vector3(0, 1, 0), E: new THREE.Vector3(1, 0, 0), N: new THREE.Vector3(0, 0, -1) };
}
function updateWalk(dt) {
  const f = (held(KEY_F) ? 1 : 0) - (held(KEY_B) ? 1 : 0) + joy.y;
  const s = (held(KEY_R) ? 1 : 0) - (held(KEY_L) ? 1 : 0) + joy.x;
  const b0 = basis(), cy = Math.cos(walk.yaw), sy = Math.sin(walk.yaw);
  const hd = b0.N.clone().multiplyScalar(cy).addScaledVector(b0.E, sy);     // heading
  const rt = b0.E.clone().multiplyScalar(cy).addScaledVector(b0.N, -sy);    // right
  const mv = hd.multiplyScalar(f).addScaledVector(rt, s);
  if (mv.lengthSq() > 0) {
    if (mv.length() > 1) mv.normalize();
    const d = 5 * dt;                                                      // units per second
    walk.lat = clamp(walk.lat + mv.dot(b0.N) * d / R, -2.6, 2.6);
    walk.lon += mv.dot(b0.E) * d / R;
  }
  const edge = Math.hypot(walk.lon * R, walk.lat * R);     // keep the player on the ground
  if (edge > 24) { walk.lon *= 24 / edge; walk.lat *= 24 / edge; }
  planetG.updateMatrixWorld(true);
  const b = basis();
  const h2 = b.N.clone().multiplyScalar(Math.cos(walk.yaw)).addScaledVector(b.E, Math.sin(walk.yaw));
  const dir = h2.multiplyScalar(Math.cos(walk.pitch)).addScaledVector(b.U, Math.sin(walk.pitch));
  const eye = new THREE.Vector3(walk.lon * R, 1.7, -walk.lat * R);
  const up = b.U.clone(), look = dir;
  camera.up.copy(up);
  camera.position.copy(eye);
  camera.lookAt(eye.clone().add(look));
}
function setWalk(on) {
  walk.on = on;
  document.body.classList.toggle('walking', on);
  $('#walkBtn').textContent = on ? '🛰 Fly view' : '🚶 Walk';
  controls.enabled = !on;
  camera.near = on ? 0.05 : 0.1; camera.updateProjectionMatrix();
  if (on) {
    Object.assign(walk, { lat: 0.02, lon: 0.15, yaw: Math.PI / 2, pitch: -0.2 });   // facing the bank
    closePanel();
    toast('Drag to look around. Walk with the stick or W A S D.', 3500);
  } else {
    camera.up.set(0, 1, 0); camera.position.set(0, 9, 32);
    controls.target.set(0, 0, 0); controls.update();
  }
}
// on-screen stick for touch devices
const joyEl = $('#joy'), knob = $('#knob');
let joyId = null, joyBox = null;
function moveJoy(e) {
  const max = joyBox.width / 2;
  let dx = e.clientX - (joyBox.left + max), dy = e.clientY - (joyBox.top + max);
  const d = Math.hypot(dx, dy), k = d > max ? max / d : 1;
  dx *= k; dy *= k;
  joy.x = dx / max; joy.y = -dy / max;
  knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}
function endJoy(e) {
  if (e.pointerId !== joyId) return;
  joyId = null; joy.x = 0; joy.y = 0;
  knob.style.transform = 'translate(-50%, -50%)';
}
joyEl.addEventListener('pointerdown', e => { joyId = e.pointerId; joyBox = joyEl.getBoundingClientRect(); joyEl.setPointerCapture(e.pointerId); moveJoy(e); });
joyEl.addEventListener('pointermove', e => { if (e.pointerId === joyId) moveJoy(e); });
joyEl.addEventListener('pointerup', endJoy);
joyEl.addEventListener('pointercancel', endJoy);
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// ---------- main loop ----------
let lastT = performance.now(), hudT = 0, panelT = 0, saveT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (S.created) S.money += income() * dt;
  if (trip) updateTrip(dt);
  updateWorld(dt);
  hudT += dt; if (hudT > 0.25) { hudT = 0; refreshHUD(); }
  panelT += dt; if (panelT > 1) { panelT = 0; renderPanel(); }
  saveT += dt; if (saveT > 15) { saveT = 0; save('Auto-saved'); }
  requestAnimationFrame(frame);
}

function boot() {
  window.PLANETX_STARTED = true;
  try {
    initWorld();
  } catch (e) {
    console.error(e);
    $('#loading').innerHTML = 'PLANET X needs a WebGL-capable browser. Please try another browser or device.';
    return;
  }
  setupUI();
  applyPlanet();
  syncWorld();
  if (S.created) {
    const away = Math.min(4 * 3600, (Date.now() - S.last) / 1000);
    if (away > 30) { const g = income() * away; S.money += g; toast(`Welcome back! Offline earnings +${fmt(g)}`, 4000); }
  }
  refreshHUD();
  if (S.created) enterPlanet();
  else { $('#loading').classList.add('hide'); showCreate(); }
  lastT = performance.now();
  requestAnimationFrame(frame);
}
boot();
