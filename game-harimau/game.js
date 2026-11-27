"use strict";

const WORLD_W = 3840;
const WORLD_H = 3840;
const SAVE_KEY = "harimau-petualang-v1";
const BEST_KEY = "harimau-petualang-best";
const TILE = 64;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
const mini = document.getElementById("minimap");
const mctx = mini.getContext("2d", { alpha: false });
const wrap = document.getElementById("game-wrap");

const els = {
  hud: document.getElementById("hud"),
  live: document.getElementById("live"),
  hpFill: document.getElementById("hp-fill"),
  stamFill: document.getElementById("stam-fill"),
  xpFill: document.getElementById("xp-fill"),
  hpText: document.getElementById("hp-text"),
  stamText: document.getElementById("stam-text"),
  xpText: document.getElementById("xp-text"),
  level: document.getElementById("level-label"),
  quests: document.getElementById("quest-list"),
  score: document.getElementById("score-text"),
  hint: document.getElementById("move-hint"),
  joy: document.getElementById("joystick"),
  knob: document.getElementById("joy-knob"),
  action: document.getElementById("btn-action"),
  toast: document.getElementById("toast"),
  title: document.getElementById("title-screen"),
  pause: document.getElementById("pause-screen"),
  dialog: document.getElementById("dialog-screen"),
  inv: document.getElementById("inv-screen"),
  over: document.getElementById("over-screen"),
  mute: document.getElementById("btn-mute"),
  continue: document.getElementById("btn-continue"),
  start: document.getElementById("btn-start"),
  titleRekor: document.getElementById("title-rekor"),
  dialogName: document.getElementById("dialog-name"),
  dialogText: document.getElementById("dialog-text"),
  dialogActions: document.getElementById("dialog-actions"),
  invList: document.getElementById("inv-list"),
  overScore: document.getElementById("over-score"),
};

let viewW = 800, viewH = 600;
let state = "title";
let raf = 0;
let lastT = 0;
let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (e) => {
  reduced = e.matches;
});

const cam = { x: 0, y: 0, sx: 0, sy: 0 };
const keys = { x: 0, y: 0 };
const joy = { on: false, id: null, x: 0, y: 0, ox: 0, oy: 0 };
let lastDirX = 1, lastDirY = 0;
let hintHidden = false;
let actionMode = "pounce";
let toastTimer = 0;
let announceTimer = 0;
let lastAnnounce = "";
let saveAcc = 0;
let combatTimer = 0;
const inputAxis = { up: 0, down: 0, left: 0, right: 0 };

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(x, y) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0);
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function rand(rng, a, b) { return a + rng() * (b - a); }
function irand(rng, a, b) { return (a + Math.floor(rng() * (b - a + 1))) | 0; }
function xpNeeded(lv) { return Math.round(36 + lv * 28 + lv * lv * 4); }

let ac = null;
let muted = false;
try { muted = localStorage.getItem("harimau-mute") === "1"; } catch (e) { muted = false; }

function ensureAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
  }
  if (ac.state === "suspended") ac.resume();
  return ac;
}
function beep(freq, dur, type, vol, slide) {
  if (muted) return;
  const a = ensureAudio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type || "sine";
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), a.currentTime + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(vol || 0.08, a.currentTime + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur + 0.02);
}
function sfx(name) {
  if (muted) return;
  if (name === "pounce") beep(180, 0.16, "square", 0.05, 90);
  else if (name === "catch") { beep(520, 0.1, "sine", 0.07); setTimeout(() => beep(740, 0.16, "sine", 0.06), 70); }
  else if (name === "hit") beep(140, 0.12, "sawtooth", 0.05, 70);
  else if (name === "hurt") beep(220, 0.18, "square", 0.06, 90);
  else if (name === "pick") beep(660, 0.12, "triangle", 0.06);
  else if (name === "heal") { beep(400, 0.1, "sine", 0.05); setTimeout(() => beep(600, 0.16, "sine", 0.05), 80); }
  else if (name === "level") {
    beep(392, 0.12, "triangle", 0.07);
    setTimeout(() => beep(523, 0.12, "triangle", 0.07), 100);
    setTimeout(() => beep(784, 0.22, "triangle", 0.08), 200);
  } else if (name === "talk") beep(480, 0.08, "triangle", 0.04);
  else if (name === "ui") beep(330, 0.05, "sine", 0.03);
  else if (name === "win") { beep(523, 0.12, "triangle", 0.06); setTimeout(() => beep(659, 0.2, "triangle", 0.07), 120); }
}
function syncMuteBtn() {
  els.mute.setAttribute("aria-pressed", muted ? "true" : "false");
  els.mute.textContent = muted ? "Senyap" : "Suara";
  els.mute.setAttribute("aria-label", muted ? "Nyalakan suara" : "Matikan suara");
}

const river = [];
const crossings = [];
const paths = [];
const solids = [];
const decals = [];
const trees = [];
const rocks = [];
const bushes = [];
let items = [];
let deer = [];
let boars = [];
let snakes = [];
let particles = [];
let floaters = [];
let butterflies = [];
const npc = { x: 1880, y: 2360, anim: 0, name: "Kakaktua Kiko" };
const stump = { x: 1880, y: 2378 };
const spawn = { x: 1960, y: 2520 };

function distToSeg(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby || 1), 0, 1);
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}
function distToRiver(x, y) {
  let best = 1e9;
  for (let i = 1; i < river.length; i++) {
    const d = distToSeg(x, y, river[i - 1].x, river[i - 1].y, river[i].x, river[i].y);
    if (d < best) best = d;
  }
  return best;
}
function nearCrossing(x, y) {
  for (const c of crossings) if (Math.hypot(x - c.x, y - c.y) < c.r) return true;
  return false;
}
function inWater(x, y) {
  if (nearCrossing(x, y)) return false;
  return distToRiver(x, y) < 52;
}
function blockedAt(x, y, r, leap) {
  if (x < r + 8 || y < r + 8 || x > WORLD_W - r - 8 || y > WORLD_H - r - 8) return true;
  if (!leap && inWater(x, y)) return true;
  for (const o of solids) {
    if (Math.abs(o.x - x) > r + o.r + 2 || Math.abs(o.y - y) > r + o.r + 2) continue;
    if (Math.hypot(x - o.x, y - o.y) < r + o.r) return true;
  }
  return false;
}
function tryMove(ent, dx, dy, leap) {
  const r = ent.r;
  const nx = ent.x + dx, ny = ent.y + dy;
  if (!blockedAt(nx, ent.y, r, leap)) ent.x = nx;
  else if (!blockedAt(ent.x + dx * 0.5, ent.y, r, leap)) ent.x += dx * 0.5;
  if (!blockedAt(ent.x, ny, r, leap)) ent.y = ny;
  else if (!blockedAt(ent.x, ent.y + dy * 0.5, r, leap)) ent.y += dy * 0.5;
  ent.x = clamp(ent.x, r + 8, WORLD_W - r - 8);
  ent.y = clamp(ent.y, r + 8, WORLD_H - r - 8);
}
function isClear(x, y, r) {
  if (blockedAt(x, y, r, false)) return false;
  if (Math.hypot(x - spawn.x, y - spawn.y) < 140) return false;
  if (Math.hypot(x - npc.x, y - npc.y) < 90) return false;
  return true;
}
function findSpot(rng, x0, y0, x1, y1, r, tries) {
  for (let i = 0; i < (tries || 40); i++) {
    const x = rand(rng, x0, x1), y = rand(rng, y0, y1);
    if (isClear(x, y, r)) return { x, y };
  }
  return null;
}

function buildWorld() {
  river.length = 0;
  crossings.length = 0;
  paths.length = 0;
  solids.length = 0;
  decals.length = 0;
  trees.length = 0;
  rocks.length = 0;
  bushes.length = 0;
  const rng = mulberry32(20261127);

  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const x = t * WORLD_W;
    const y = 1640 + Math.sin(t * Math.PI * 2.15) * 210 + Math.sin(t * 7.3) * 70;
    river.push({ x, y });
  }
  function riverAt(x) {
    let best = river[0], bd = 1e9;
    for (const p of river) {
      const d = Math.abs(p.x - x);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  const c1 = riverAt(1920);
  const c2 = riverAt(860);
  crossings.push({ x: c1.x, y: c1.y, r: 78 }, { x: c2.x, y: c2.y, r: 70 });

  paths.push(
    { a: { x: 1960, y: 2520 }, b: { x: 1900, y: 2000 }, w: 70 },
    { a: { x: 1900, y: 2000 }, b: { x: c1.x, y: c1.y + 40 }, w: 64 },
    { a: { x: c1.x, y: c1.y - 40 }, b: { x: 1400, y: 1200 }, w: 58 },
    { a: { x: 1400, y: 1200 }, b: { x: 760, y: 1000 }, w: 58 },
    { a: { x: 1900, y: 2000 }, b: { x: 2600, y: 1320 }, w: 58 },
    { a: { x: 1960, y: 2520 }, b: { x: 3000, y: 2860 }, w: 54 }
  );

  function addTree(x, y, v, s) {
    const tr = { type: "tree", x, y, variant: v, scale: s, r: 12 * s };
    trees.push(tr);
    solids.push({ x, y, r: tr.r });
  }
  function addRock(x, y, s) {
    const o = { type: "rock", x, y, scale: s, r: 14 * s };
    rocks.push(o);
    solids.push({ x, y, r: o.r });
  }

  for (let i = 0; i < 220; i++) {
    const edge = i % 4;
    let x, y;
    if (edge === 0) { x = rand(rng, 30, WORLD_W - 30); y = rand(rng, 20, 120); }
    else if (edge === 1) { x = rand(rng, 30, WORLD_W - 30); y = rand(rng, WORLD_H - 120, WORLD_H - 20); }
    else if (edge === 2) { x = rand(rng, 20, 120); y = rand(rng, 30, WORLD_H - 30); }
    else { x = rand(rng, WORLD_W - 120, WORLD_W - 20); y = rand(rng, 30, WORLD_H - 30); }
    addTree(x, y, irand(rng, 0, 3), rand(rng, 0.9, 1.35));
  }

  for (let i = 0; i < 260; i++) {
    const x = rand(rng, 160, WORLD_W - 160);
    const y = rand(rng, 160, WORLD_H - 160);
    if (Math.hypot(x - spawn.x, y - spawn.y) < 280) continue;
    if (Math.hypot(x - npc.x, y - npc.y) < 160) continue;
    if (distToRiver(x, y) < 100) continue;
    if (x > 560 && x < 980 && y > 780 && y < 1220 && rng() < 0.55) continue;
    let onPath = false;
    for (const p of paths) if (distToSeg(x, y, p.a.x, p.a.y, p.b.x, p.b.y) < p.w * 0.7) onPath = true;
    if (onPath) continue;
    addTree(x, y, irand(rng, 0, 4), rand(rng, 0.75, 1.4));
  }

  for (let i = 0; i < 70; i++) {
    const spt = findSpot(rng, 180, 180, WORLD_W - 180, WORLD_H - 180, 16, 20);
    if (spt) addRock(spt.x, spt.y, rand(rng, 0.7, 1.25));
  }
  for (let i = 0; i < 90; i++) {
    const spt = findSpot(rng, 180, 180, WORLD_W - 180, WORLD_H - 180, 10, 16);
    if (spt) bushes.push({ x: spt.x, y: spt.y, scale: rand(rng, 0.7, 1.2), variant: irand(rng, 0, 2) });
  }
  for (let i = 0; i < 140; i++) {
    decals.push({
      x: rand(rng, 80, WORLD_W - 80),
      y: rand(rng, 80, WORLD_H - 80),
      kind: rng() < 0.5 ? "fern" : "flower",
      rot: rand(rng, 0, Math.PI * 2),
      scale: rand(rng, 0.6, 1.2),
      hue: rand(rng, 0, 1),
    });
  }
  for (const c of crossings) {
    for (let i = 0; i < 7; i++) {
      decals.push({
        x: c.x + Math.cos((i / 7) * Math.PI * 2) * rand(rng, 6, 36),
        y: c.y + Math.sin((i / 7) * Math.PI * 2) * rand(rng, 4, 24),
        kind: "stone",
        scale: rand(rng, 0.7, 1.1),
        rot: 0,
        hue: 0,
      });
    }
  }
}
function resetActors(savedItems) {
  items = [];
  deer = [];
  boars = [];
  snakes = [];
  particles = [];
  floaters = [];
  butterflies = [];
  const rng = mulberry32(99);

  function pack(n, x0, y0, x1, y1, r, extra) {
    let placed = 0, guard = 0;
    while (placed < n && guard++ < n * 40) {
      const spt = findSpot(rng, x0, y0, x1, y1, r, 8);
      if (!spt) continue;
      extra(spt);
      placed++;
    }
  }

  pack(8, 1500, 1800, 2500, 2300, 16, (s) => deer.push(makeDeer(s.x, s.y)));
  pack(6, 2200, 1000, 3100, 1600, 16, (s) => deer.push(makeDeer(s.x, s.y)));
  pack(5, 700, 1900, 1400, 2500, 16, (s) => deer.push(makeDeer(s.x, s.y)));
  pack(3, 2500, 2500, 3500, 3500, 18, (s) => boars.push(makeBoar(s.x, s.y)));
  pack(2, 2800, 1800, 3500, 2400, 18, (s) => boars.push(makeBoar(s.x, s.y)));
  pack(3, 400, 2400, 1300, 3300, 12, (s) => snakes.push(makeSnake(s.x, s.y)));
  pack(2, 2600, 600, 3500, 1400, 12, (s) => snakes.push(makeSnake(s.x, s.y)));
  pack(10, 200, 200, WORLD_W - 200, WORLD_H - 200, 10, (s) =>
    items.push({ id: "m" + items.length, kind: "mangga", x: s.x, y: s.y, r: 12 })
  );
  pack(8, 200, 200, WORLD_W - 200, WORLD_H - 200, 10, (s) =>
    items.push({ id: "p" + items.length, kind: "pisang", x: s.x, y: s.y, r: 12 })
  );

  const taken = new Set(savedItems || []);
  const emasSpots = [{ x: 720, y: 980, id: "emas1" }, { x: 640, y: 1120, id: "emas2" }];
  for (const e of emasSpots) {
    if (taken.has(e.id)) continue;
    if (!isClear(e.x, e.y, 12)) {
      const spt = findSpot(rng, 560, 860, 980, 1220, 12, 30);
      if (!spt) continue;
      items.push({ id: e.id, kind: "emas", x: spt.x, y: spt.y, r: 14 });
    } else items.push({ id: e.id, kind: "emas", x: e.x, y: e.y, r: 14 });
  }

  for (let i = 0; i < 8; i++) {
    const spt = findSpot(rng, 200, 200, WORLD_W - 200, WORLD_H - 200, 4, 20);
    if (spt) butterflies.push({ x: spt.x, y: spt.y, t: rand(rng, 0, 20), hue: rng() });
  }
}

function makeDeer(x, y) {
  return { x, y, r: 15, vx: 0, vy: 0, state: "graze", t: Math.random() * 8, anim: Math.random() * 10, facing: 1, hp: 1 };
}
function makeBoar(x, y) {
  return { x, y, r: 18, vx: 0, vy: 0, state: "wander", t: Math.random() * 4, anim: 0, facing: 1, hp: 40, maxHp: 40, hitId: -1 };
}
function makeSnake(x, y) {
  return { x, y, r: 12, vx: 0, vy: 0, state: "slither", t: Math.random() * 4, anim: 0, facing: 1, hp: 22, maxHp: 22, hitId: -1, ang: Math.random() * 6 };
}

const player = {
  x: spawn.x, y: spawn.y, r: 16, facing: 1, anim: 0, moving: false,
  pouncing: false, pounceT: 0, pdx: 1, pdy: 0, pounceId: 0,
  hp: 100, maxHp: 100, stam: 80, maxStam: 80, atk: 16,
  level: 1, xp: 0, xpNext: xpNeeded(1), score: 0, speed: 210,
  invuln: 0, flash: 0, stamDelay: 0,
};
let inventory = { mangga: 0, pisang: 0, emas: 0, rusa: 0, babi: 0 };
let collectedIds = [];
let quests = {
  rusa: { accepted: false, done: false, need: 5, progress: 0 },
  emas: { accepted: false, done: false, need: 1, progress: 0 },
  babi: { accepted: false, done: false, need: 3, progress: 0 },
};
let allDone = false;

function newGame() {
  Object.assign(player, {
    x: spawn.x, y: spawn.y, facing: 1, anim: 0, moving: false,
    pouncing: false, pounceT: 0, pdx: 1, pdy: 0, pounceId: 0,
    hp: 100, maxHp: 100, stam: 80, maxStam: 80, atk: 16,
    level: 1, xp: 0, xpNext: xpNeeded(1), score: 0, speed: 210,
    invuln: 0, flash: 0, stamDelay: 0,
  });
  inventory = { mangga: 0, pisang: 0, emas: 0, rusa: 0, babi: 0 };
  collectedIds = [];
  quests = {
    rusa: { accepted: false, done: false, need: 5, progress: 0 },
    emas: { accepted: false, done: false, need: 1, progress: 0 },
    babi: { accepted: false, done: false, need: 3, progress: 0 },
  };
  allDone = false;
  hintHidden = false;
  els.hint.classList.remove("hide");
  resetActors([]);
  cam.x = player.x - viewW / 2;
  cam.y = player.y - viewH / 2;
  saveGame();
}

function saveGame() {
  try {
    const data = {
      player: {
        x: player.x, y: player.y, facing: player.facing,
        hp: player.hp, maxHp: player.maxHp, stam: player.stam, maxStam: player.maxStam,
        atk: player.atk, level: player.level, xp: player.xp, xpNext: player.xpNext,
        score: player.score, speed: player.speed,
      },
      inventory, collectedIds, quests, allDone,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    const best = readBest();
    if (player.score > best.score || player.level > best.level) {
      localStorage.setItem(BEST_KEY, JSON.stringify({
        score: Math.max(best.score, player.score),
        level: Math.max(best.level, player.level),
        rusa: Math.max(best.rusa || 0, inventory.rusa),
      }));
    }
  } catch (err) { /* ignore quota */ }
}
function readBest() {
  try { return Object.assign({ score: 0, level: 1, rusa: 0 }, JSON.parse(localStorage.getItem(BEST_KEY) || "{}")); }
  catch (e) { return { score: 0, level: 1, rusa: 0 }; }
}
function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}
function loadGame() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!data || !data.player) return false;
    Object.assign(player, data.player, { pouncing: false, pounceT: 0, invuln: 0, flash: 0, stamDelay: 0, moving: false });
    inventory = Object.assign({ mangga: 0, pisang: 0, emas: 0, rusa: 0, babi: 0 }, data.inventory);
    collectedIds = data.collectedIds || [];
    quests = Object.assign({
      rusa: { accepted: false, done: false, need: 5, progress: 0 },
      emas: { accepted: false, done: false, need: 1, progress: 0 },
      babi: { accepted: false, done: false, need: 3, progress: 0 },
    }, data.quests);
    allDone = !!data.allDone;
    resetActors(collectedIds);
    player.hp = clamp(player.hp, 1, player.maxHp);
    cam.x = player.x - viewW / 2;
    cam.y = player.y - viewH / 2;
    hintHidden = true;
    els.hint.classList.add("hide");
    return true;
  } catch (e) { return false; }
}

function announce(msg) {
  if (msg === lastAnnounce && announceTimer > 0) return;
  lastAnnounce = msg;
  announceTimer = 1.2;
  els.live.textContent = msg;
}
function toast(msg, dur) {
  els.toast.hidden = false;
  els.toast.textContent = msg;
  toastTimer = dur || 1.6;
  announce(msg);
}
function addXP(n) {
  player.xp += n;
  player.score += n;
  let ups = 0;
  while (player.xp >= player.xpNext) {
    player.xp -= player.xpNext;
    player.level++;
    player.maxHp += 14;
    player.maxStam += 6;
    player.atk += 4;
    player.hp = player.maxHp;
    player.stam = player.maxStam;
    player.xpNext = xpNeeded(player.level);
    ups++;
  }
  if (ups) { toast("Naik Level " + player.level + "!"); sfx("level"); }
  updateHud();
}
function heal(hp, stam) {
  player.hp = clamp(player.hp + (hp || 0), 0, player.maxHp);
  player.stam = clamp(player.stam + (stam || 0), 0, player.maxStam);
  if (hp) floater(player.x, player.y - 30, "+" + hp + " nyawa", "#9eef7a");
  sfx("heal");
  updateHud();
}
function hurt(dmg, from) {
  if (player.invuln > 0 || player.pouncing) return;
  player.hp = Math.max(0, player.hp - dmg);
  player.invuln = 0.9;
  player.flash = 0.3;
  combatTimer = 4;
  sfx("hurt");
  floater(player.x, player.y - 28, "-" + dmg, "#ff8b7a");
  cam.sx = reduced ? 0 : (from && from.x < player.x ? 7 : -7);
  cam.sy = reduced ? 0 : 4;
  updateHud();
  announce("Tertabrak, nyawa " + Math.ceil(player.hp));
  if (player.hp <= 0) gameOver();
}
function floater(x, y, text, color) {
  floaters.push({ x, y, text, color, t: 1.1 });
}
function burst(x, y, color, n, speed) {
  const c = n || 14;
  for (let i = 0; i < c; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (speed || 80) * (0.4 + Math.random());
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20,
      life: 0.5 + Math.random() * 0.5, color, size: 3 + Math.random() * 4, kind: "spark",
    });
  }
}
function leaves(x, y) {
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    particles.push({
      x, y, vx: Math.cos(a) * 50, vy: Math.sin(a) * 40 - 30,
      life: 0.7 + Math.random() * 0.4, color: Math.random() < 0.5 ? "#7dcd4d" : "#d6e35a",
      size: 5, kind: "leaf", rot: Math.random() * 6,
    });
  }
}

function refreshAxis() {
  keys.x = (inputAxis.right ? 1 : 0) - (inputAxis.left ? 1 : 0);
  keys.y = (inputAxis.down ? 1 : 0) - (inputAxis.up ? 1 : 0);
}
function setKey(code, down) {
  const on = down ? 1 : 0;
  if (code === "ArrowUp" || code === "KeyW") inputAxis.up = on;
  if (code === "ArrowDown" || code === "KeyS") inputAxis.down = on;
  if (code === "ArrowLeft" || code === "KeyA") inputAxis.left = on;
  if (code === "ArrowRight" || code === "KeyD") inputAxis.right = on;
  refreshAxis();
}
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
  if (e.repeat) { setKey(e.code, true); return; }
  setKey(e.code, true);
  if (e.code === "KeyM") { toggleMute(); return; }
  if (state === "title") {
    if (e.code === "Enter" || e.code === "Space") {
      if (hasSave()) continueGame();
      else startFresh();
    }
    return;
  }
  if (state === "pause" && (e.code === "Escape" || e.code === "KeyP" || e.code === "Enter")) { resumeGame(); return; }
  if (state === "inventory" && (e.code === "KeyI" || e.code === "Escape")) { closeInv(); return; }
  if (state === "dialog" && (e.code === "Space" || e.code === "Enter" || e.code === "KeyE" || e.code === "KeyJ")) {
    const first = els.dialogActions.querySelector("button");
    if (first) first.click();
    return;
  }
  if (state === "over" && (e.code === "Enter" || e.code === "Space")) { retryGame(); return; }
  if (state !== "play") return;
  if (e.code === "Escape" || e.code === "KeyP") pauseGame();
  else if (e.code === "KeyI") openInv();
  else if (e.code === "Space" || e.code === "KeyJ" || e.code === "KeyE" || e.code === "KeyK") doAction();
});
window.addEventListener("keyup", (e) => setKey(e.code, false));

function joyStart(e) {
  if (state !== "play") return;
  if (joy.on) return;
  joy.on = true;
  joy.id = e.pointerId;
  const rect = els.joy.getBoundingClientRect();
  joy.ox = rect.left + rect.width / 2;
  joy.oy = rect.top + rect.height / 2;
  const dx0 = e.clientX - joy.ox, dy0 = e.clientY - joy.oy;
  if (Math.hypot(dx0, dy0) > rect.width * 0.7) {
    joy.ox = e.clientX;
    joy.oy = e.clientY;
  }
  try { els.joy.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  joyMove(e);
}
function joyMove(e) {
  if (!joy.on || e.pointerId !== joy.id) return;
  const max = 54;
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
  const m = Math.hypot(dx, dy);
  if (m > max) { dx = (dx / m) * max; dy = (dy / m) * max; }
  joy.x = dx / max;
  joy.y = dy / max;
  els.knob.style.transform = "translate(" + dx + "px," + dy + "px)";
}
function joyEnd(e) {
  if (!joy.on || (e && e.pointerId !== joy.id)) return;
  joy.on = false;
  joy.id = null;
  joy.x = 0;
  joy.y = 0;
  els.knob.style.transform = "translate(0,0)";
}
els.joy.addEventListener("pointerdown", (e) => { e.preventDefault(); joyStart(e); });
els.joy.addEventListener("pointermove", joyMove);
els.joy.addEventListener("pointerup", joyEnd);
els.joy.addEventListener("pointercancel", joyEnd);

wrap.addEventListener("pointerdown", (e) => {
  if (state !== "play") return;
  if (e.target.closest("button, .overlay, .overlay-card, .dialog-card, .top-actions, #btn-action")) return;
  const rect = wrap.getBoundingClientRect();
  const x = e.clientX - rect.left;
  if (x < viewW * 0.55) {
    e.preventDefault();
    joyStart(e);
  }
});
wrap.addEventListener("pointermove", joyMove);
wrap.addEventListener("pointerup", joyEnd);
wrap.addEventListener("pointercancel", joyEnd);
wrap.addEventListener("contextmenu", (e) => e.preventDefault());
function nearestOf(list, range) {
  let best = null, bd = range;
  for (const o of list) {
    if (o.dead || o.state === "caught") continue;
    const d = dist(player, o);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function nearestItem(range) {
  let best = null, bd = range;
  for (const o of items) {
    const d = dist(player, o);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function updateActionMode() {
  let mode = "pounce", label = "Terkam";
  if (dist(player, npc) < 74) { mode = "talk"; label = "Bicara"; }
  else if (nearestItem(56)) { mode = "pick"; label = "Ambil"; }
  if (mode !== actionMode) {
    actionMode = mode;
    els.action.textContent = label;
    els.action.setAttribute("aria-label", label);
    els.action.classList.toggle("talk", mode === "talk");
    els.action.classList.toggle("pick", mode === "pick");
  }
}
function doAction() {
  if (state !== "play") return;
  updateActionMode();
  if (actionMode === "talk") openDialog();
  else if (actionMode === "pick") pickItem(nearestItem(56));
  else pounce();
}
function pounce() {
  if (player.pouncing) return;
  if (player.stam < 16) {
    toast("Stamina kurang!", 0.9);
    sfx("ui");
    return;
  }
  player.stam -= 16;
  player.stamDelay = 0.55;
  player.pouncing = true;
  player.pounceT = 0;
  player.pounceId++;
  const prey = nearestOf(deer, 170) || nearestOf(boars, 150) || nearestOf(snakes, 140);
  if (prey) {
    const a = Math.atan2(prey.y - player.y, prey.x - player.x);
    player.pdx = Math.cos(a);
    player.pdy = Math.sin(a);
  } else {
    const m = Math.hypot(lastDirX, lastDirY) || 1;
    player.pdx = lastDirX / m;
    player.pdy = lastDirY / m;
  }
  if (Math.abs(player.pdx) > 0.1) player.facing = player.pdx < 0 ? -1 : 1;
  sfx("pounce");
  updateHud();
}
function hitPounce() {
  for (const d of deer) {
    if (d.state === "caught") continue;
    if (dist(player, d) < player.r + d.r + 18) catchDeer(d);
  }
  for (const b of boars) hitEnemy(b, player.atk);
  for (const s of snakes) hitEnemy(s, player.atk);
}
function catchDeer(d) {
  d.state = "caught";
  d.t = 0.55;
  inventory.rusa++;
  if (quests.rusa.accepted && !quests.rusa.done) {
    quests.rusa.progress = Math.min(quests.rusa.need, inventory.rusa);
  }
  const xp = 20;
  addXP(xp);
  floater(d.x, d.y - 20, "Tertangkap! +" + xp + " XP", "#ffe08a");
  leaves(d.x, d.y);
  burst(d.x, d.y, "#fff4a8", 16, 90);
  sfx("catch");
  announce("Rusa tertangkap. Total " + inventory.rusa);
  if (Math.random() < 0.4) {
    inventory.mangga++;
    floater(d.x + 16, d.y - 36, "Mangga!", "#ffb24a");
  }
  updateHud();
  saveGame();
}
function hitEnemy(e, dmg) {
  if (e.dead || e.hitId === player.pounceId) return;
  if (dist(player, e) > player.r + e.r + 16) return;
  e.hitId = player.pounceId;
  e.hp -= dmg;
  e.t = 0.2;
  const a = Math.atan2(e.y - player.y, e.x - player.x);
  tryMove(e, Math.cos(a) * 28, Math.sin(a) * 28, false);
  burst(e.x, e.y, "#f0d48a", 8, 70);
  leaves(e.x, e.y);
  sfx("hit");
  floater(e.x, e.y - 22, "-" + dmg, "#fff");
  if (e.hp <= 0) defeatEnemy(e);
}
function defeatEnemy(e) {
  e.dead = true;
  e.t = 0.5;
  leaves(e.x, e.y);
  burst(e.x, e.y, "#c8e68a", 18, 100);
  if (e.maxHp >= 40) {
    inventory.babi++;
    if (quests.babi.accepted && !quests.babi.done) {
      quests.babi.progress = Math.min(quests.babi.need, quests.babi.progress + 1);
    }
    addXP(32);
    floater(e.x, e.y - 30, "Babi hutan undur! +32 XP", "#ffe08a");
    if (Math.random() < 0.5) inventory.pisang++;
    announce("Babi hutan undur");
  } else {
    addXP(16);
    floater(e.x, e.y - 30, "Ular undur! +16 XP", "#c8f0a8");
  }
  updateHud();
  saveGame();
}
function pickItem(it) {
  if (!it) return;
  if (it.kind === "mangga") { inventory.mangga++; floater(it.x, it.y, "Mangga", "#ffb24a"); }
  if (it.kind === "pisang") { inventory.pisang++; floater(it.x, it.y, "Pisang", "#ffe36a"); }
  if (it.kind === "emas") {
    inventory.emas++;
    collectedIds.push(it.id);
    if (quests.emas.accepted && !quests.emas.done) quests.emas.progress = 1;
    floater(it.x, it.y, "Buah Emas!", "#ffe08a");
    toast("Buah Emas ditemukan!");
    sfx("win");
  } else sfx("pick");
  addXP(it.kind === "emas" ? 25 : 4);
  burst(it.x, it.y, it.kind === "emas" ? "#ffe08a" : "#ffd36a", 12, 70);
  items = items.filter((o) => o !== it);
  updateHud();
  saveGame();
}
function useItem(kind) {
  if (kind === "mangga" && inventory.mangga > 0) {
    inventory.mangga--;
    heal(28, 0);
    saveGame();
    return true;
  }
  if (kind === "pisang" && inventory.pisang > 0) {
    inventory.pisang--;
    heal(18, 22);
    saveGame();
    return true;
  }
  if (kind === "emas") {
    toast("Bawa Buah Emas ini ke Kiko.");
    return false;
  }
  return false;
}

function openDialog() {
  sfx("talk");
  state = "dialog";
  els.dialog.hidden = false;
  els.dialogName.textContent = "Kakaktua Kiko";
  const q = quests;
  let text, actions;
  if (!q.rusa.accepted) {
    text = "Halo, harimau kecil! Aku Kiko, penjaga hutan ini. Rusa di padang rumput sudah terlalu ramai. Bantu Kiko tangkap 5 rusa ya — terkaman lembut saja, tanpa kekerasan.";
    actions = [
      { label: "Terima misi", fn: () => { q.rusa.accepted = true; closeDialog(); toast("Misi baru: Tangkap 5 rusa"); updateHud(); saveGame(); } },
      { label: "Nanti dulu", fn: closeDialog },
    ];
  } else if (!q.rusa.done && q.rusa.progress < q.rusa.need) {
    text = "Sudah " + q.rusa.progress + " dari " + q.rusa.need + " rusa. Cari mereka di padang rumput utara sini, atau di hutan timur.";
    actions = [{ label: "Siap!", fn: closeDialog }];
  } else if (!q.rusa.done) {
    text = "Hebat! Kamu tangkas sekali. Sebagai ucapan terima kasih, Kiko memberimu buah dan pengalaman. Berikutnya: ada Buah Emas di kebun barat, seberang sungai. Lewat batu penyeberangan di tengah atau di barat sungai.";
    actions = [{ label: "Terima kasih, Kiko", fn: () => {
      q.rusa.done = true; q.emas.accepted = true;
      if (inventory.emas > 0) q.emas.progress = 1;
      inventory.mangga += 2;
      addXP(40);
      closeDialog(); toast("Misi baru: Cari Buah Emas"); saveGame();
    } }];
  } else if (!q.emas.done && q.emas.progress < 1) {
    text = "Buah Emas masih menunggu di kebun barat, lewat seberang sungai. Ikuti jalan tanah, lalu seberangi batu di air.";
    actions = [{ label: "Aku cari ya", fn: closeDialog }];
  } else if (!q.emas.done) {
    text = "Sinarnya masih hangat! Terima kasih. Terakhir: tiga babi hutan merusak semak di tenggara. Usir mereka dengan terkamanmu. Mereka hanya lari, kok — hutan tetap damai.";
    actions = [{ label: "Aku usir mereka", fn: () => {
      q.emas.done = true; q.babi.accepted = true;
      addXP(50);
      player.maxHp += 10; player.hp = player.maxHp;
      closeDialog(); toast("Misi baru: Usir 3 babi hutan"); updateHud(); saveGame();
    } }];
  } else if (!q.babi.done && q.babi.progress < q.babi.need) {
    text = "Babi hutan ada di semak tenggara. Sudah undur " + q.babi.progress + " dari " + q.babi.need + ".";
    actions = [{ label: "Lanjut", fn: closeDialog }];
  } else if (!q.babi.done) {
    text = "Kamu pelindung hutan sekarang! Kiko bangga padamu. Jelajahi terus, kumpulkan buah, dan jaga damai di sini. Pakailah mahkota daun ini — tanda sahabat hutan.";
    actions = [{ label: "Terima kasih!", fn: () => {
      q.babi.done = true; allDone = true;
      addXP(80);
      player.maxHp += 12; player.hp = player.maxHp;
      closeDialog(); toast("Semua misi selesai!"); sfx("win"); updateHud(); saveGame();
    } }];
  } else {
    text = "Hutan damai berkatmu. Istirahat di sini kapan saja, atau jelajahi lagi. Buah di tanah akan tumbuh kembali pelan-pelan.";
    actions = [{ label: "Sampai jumpa, Kiko", fn: closeDialog }];
  }
  els.dialogText.textContent = text;
  els.dialogActions.innerHTML = "";
  for (const a of actions) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn " + (a === actions[0] ? "primary" : "ghost");
    b.textContent = a.label;
    b.addEventListener("click", a.fn);
    els.dialogActions.appendChild(b);
  }
}
function closeDialog() {
  els.dialog.hidden = true;
  if (state === "dialog") state = "play";
}

function wanderTowards(ent, dt, speed, ax, ay) {
  const m = Math.hypot(ax, ay) || 1;
  tryMove(ent, (ax / m) * speed * dt, (ay / m) * speed * dt, false);
  if (Math.abs(ax) > 0.1) ent.facing = ax < 0 ? -1 : 1;
  ent.anim += dt * 10;
}
function aiDeer(d, dt) {
  if (d.state === "caught") { d.t -= dt; return; }
  d.t -= dt;
  const dpl = dist(d, player);
  if (dpl < 160 || (player.pouncing && dpl < 220)) {
    d.state = "flee";
    d.t = 0.6;
    wanderTowards(d, dt, 195, d.x - player.x, d.y - player.y);
    return;
  }
  if (d.state === "flee" && d.t > 0) {
    wanderTowards(d, dt, 170, d.x - player.x, d.y - player.y);
    return;
  }
  if (d.t <= 0) {
    d.state = Math.random() < 0.55 ? "walk" : "graze";
    d.t = 0.8 + Math.random() * 2;
    const a = Math.random() * Math.PI * 2;
    d.vx = Math.cos(a);
    d.vy = Math.sin(a);
  }
  if (d.state === "walk") wanderTowards(d, dt, 70, d.vx, d.vy);
  else d.anim += dt * 3;
}
function aiBoar(b, dt) {
  if (b.dead) { b.t -= dt; return; }
  b.t -= dt;
  b.anim += dt * 8;
  const dpl = dist(b, player);
  if (dpl < 28 && b.state !== "stun") hurt(14, b);
  if (dpl < 170 && b.state !== "stun") {
    b.state = "charge";
    wanderTowards(b, dt, 155, player.x - b.x, player.y - b.y);
    return;
  }
  if (b.t <= 0) {
    b.state = "wander";
    b.t = 1 + Math.random() * 2;
    const a = Math.random() * Math.PI * 2;
    b.vx = Math.cos(a); b.vy = Math.sin(a);
  }
  wanderTowards(b, dt, 55, b.vx, b.vy);
}
function aiSnake(s, dt) {
  if (s.dead) { s.t -= dt; return; }
  s.anim += dt * 8;
  s.t -= dt;
  const dpl = dist(s, player);
  if (dpl < 24) hurt(10, s);
  if (dpl < 130) {
    wanderTowards(s, dt, 120, player.x - s.x, player.y - s.y);
    s.ang = Math.atan2(player.y - s.y, player.x - s.x);
    return;
  }
  if (s.t <= 0) {
    s.t = 1.2 + Math.random();
    s.ang += (Math.random() * 2 - 1);
  }
  wanderTowards(s, dt, 50, Math.cos(s.ang), Math.sin(s.ang));
}

function respawnTick(dt) {
  if (Math.random() > dt * 0.35) return;
  const liveD = deer.filter((d) => d.state !== "caught").length;
  if (liveD < 12) {
    const box = Math.random() < 0.5 ? [1500, 1800, 2500, 2300] : [2200, 1000, 3100, 1600];
    const spt = findSpot(() => Math.random(), box[0], box[1], box[2], box[3], 16, 12);
    if (spt && dist(spt, player) > 260) deer.push(makeDeer(spt.x, spt.y));
  }
  const liveB = boars.filter((b) => !b.dead).length;
  if (liveB < 3) {
    const spt = findSpot(() => Math.random(), 2500, 2500, 3500, 3500, 18, 10);
    if (spt && dist(spt, player) > 300) boars.push(makeBoar(spt.x, spt.y));
  }
  if (items.filter((i) => i.kind !== "emas").length < 10 && Math.random() < 0.4) {
    const spt = findSpot(() => Math.random(), 200, 200, WORLD_W - 200, WORLD_H - 200, 10, 10);
    if (spt && dist(spt, player) > 240) {
      items.push({ id: "r" + Date.now(), kind: Math.random() < 0.5 ? "mangga" : "pisang", x: spt.x, y: spt.y, r: 12 });
    }
  }
}

function updatePlayer(dt) {
  if (player.invuln > 0) player.invuln -= dt;
  if (player.flash > 0) player.flash -= dt;
  if (combatTimer > 0) combatTimer -= dt;
  if (player.pouncing) {
    player.pounceT += dt;
    tryMove(player, player.pdx * 560 * dt, player.pdy * 560 * dt, true);
    player.anim += dt * 18;
    hitPounce();
    if (player.pounceT > 0.28) player.pouncing = false;
  } else {
    let ix = keys.x + joy.x;
    let iy = keys.y + joy.y;
    const m = Math.hypot(ix, iy);
    if (m > 1) { ix /= m; iy /= m; }
    player.moving = m > 0.12;
    if (player.moving) {
      lastDirX = ix; lastDirY = iy;
      if (Math.abs(ix) > 0.15) player.facing = ix < 0 ? -1 : 1;
      player.anim += dt * 13;
      tryMove(player, ix * player.speed * dt, iy * player.speed * dt, false);
      if (!hintHidden) { hintHidden = true; els.hint.classList.add("hide"); }
    } else player.anim += dt * 2.5;
    if (player.stamDelay > 0) player.stamDelay -= dt;
    else if (player.stam < player.maxStam) {
      player.stam = clamp(player.stam + 18 * dt, 0, player.maxStam);
    }
    if (combatTimer <= 0 && player.hp < player.maxHp) {
      player.hp = clamp(player.hp + 1.2 * dt, 0, player.maxHp);
    }
  }
}
function updateCam(dt) {
  const tx = clamp(player.x - viewW / 2, 0, Math.max(0, WORLD_W - viewW));
  const ty = clamp(player.y - viewH / 2, 0, Math.max(0, WORLD_H - viewH));
  const k = 1 - Math.pow(0.0008, dt);
  if (state === "title") {
    const cx = npc.x - viewW / 2 + Math.sin(performance.now() / 3000) * 40;
    const cy = npc.y - viewH / 2 + 40;
    cam.x = lerp(cam.x, clamp(cx, 0, Math.max(0, WORLD_W - viewW)), k * 0.4);
    cam.y = lerp(cam.y, clamp(cy, 0, Math.max(0, WORLD_H - viewH)), k * 0.4);
  } else {
    cam.x = lerp(cam.x, tx, k);
    cam.y = lerp(cam.y, ty, k);
  }
  cam.x += cam.sx;
  cam.y += cam.sy;
  cam.sx *= reduced ? 0 : 0.85;
  cam.sy *= reduced ? 0 : 0.85;
}

function startFresh() {
  ensureAudio();
  sfx("ui");
  newGame();
  enterPlay();
}
function continueGame() {
  ensureAudio();
  sfx("ui");
  if (!loadGame()) newGame();
  enterPlay();
}
function enterPlay() {
  state = "play";
  els.title.hidden = true;
  els.pause.hidden = true;
  els.dialog.hidden = true;
  els.inv.hidden = true;
  els.over.hidden = true;
  els.hud.hidden = false;
  updateHud();
  announce("Petualangan dimulai");
}
function pauseGame() {
  if (state !== "play") return;
  state = "pause";
  els.pause.hidden = false;
  joyEnd({ pointerId: joy.id });
  saveGame();
}
function resumeGame() {
  els.pause.hidden = true;
  if (state === "pause") state = "play";
  lastT = performance.now();
}
function goTitle() {
  saveGame();
  state = "title";
  els.hud.hidden = true;
  els.pause.hidden = true;
  els.dialog.hidden = true;
  els.inv.hidden = true;
  els.over.hidden = true;
  els.title.hidden = false;
  refreshTitle();
}
function gameOver() {
  state = "over";
  player.pouncing = false;
  els.over.hidden = false;
  els.overScore.textContent = "Skor " + Math.floor(player.score) + " · Level " + player.level;
  saveGame();
  announce("Kamu pingsan");
}
function retryGame() {
  player.x = spawn.x;
  player.y = spawn.y;
  player.hp = Math.max(40, Math.round(player.maxHp * 0.7));
  player.stam = player.maxStam;
  player.invuln = 1.2;
  player.pouncing = false;
  els.over.hidden = true;
  state = "play";
  updateHud();
  saveGame();
  toast("Kamu bangun di dekat Kiko");
}
function openInv() {
  if (state !== "play" && state !== "pause") return;
  renderInv();
  els.inv.hidden = false;
  els.pause.hidden = true;
  state = "inventory";
}
function closeInv() {
  els.inv.hidden = true;
  if (state === "inventory") state = "play";
}
function renderInv() {
  const rows = [
    { kind: "mangga", name: "Mangga", desc: "Memulihkan 28 nyawa.", n: inventory.mangga, use: true },
    { kind: "pisang", name: "Pisang", desc: "Memulihkan 18 nyawa dan 22 stamina.", n: inventory.pisang, use: true },
    { kind: "emas", name: "Buah Emas", desc: "Benda misi. Bawa ke Kakaktua Kiko.", n: inventory.emas, use: false },
    { kind: "rusa", name: "Rusa tertangkap", desc: "Hasil buruan lembutmu.", n: inventory.rusa, use: false },
    { kind: "babi", name: "Babi hutan diusir", desc: "Hutan sedikit lebih damai.", n: inventory.babi, use: false },
  ];
  els.invList.innerHTML = "";
  for (const r of rows) {
    const div = document.createElement("div");
    div.className = "inv-item";
    div.innerHTML = '<div class="meta"><strong>' + r.name + " × " + r.n + "</strong><span>" + r.desc + "</span></div>";
    if (r.use) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn primary";
      b.textContent = "Pakai";
      b.disabled = r.n <= 0;
      b.addEventListener("click", () => { if (useItem(r.kind)) renderInv(); updateHud(); });
      div.appendChild(b);
    }
    els.invList.appendChild(div);
  }
}
function toggleMute() {
  muted = !muted;
  try { localStorage.setItem("harimau-mute", muted ? "1" : "0"); } catch (e) { /* ignore */ }
  if (!muted) ensureAudio();
  syncMuteBtn();
  sfx("ui");
}
function refreshTitle() {
  const best = readBest();
  const bits = [];
  if (best.score) bits.push("Rekor skor " + Math.floor(best.score));
  if (best.level > 1) bits.push("Level tertinggi " + best.level);
  if (best.rusa) bits.push(best.rusa + " rusa");
  els.titleRekor.textContent = bits.join(" · ");
  if (hasSave()) {
    els.continue.hidden = false;
    els.start.textContent = "Main baru";
    els.start.classList.remove("primary");
    els.start.classList.add("ghost");
    els.continue.classList.add("primary");
    els.continue.classList.remove("ghost");
  } else {
    els.continue.hidden = true;
    els.start.textContent = "Mulai petualangan";
    els.start.classList.add("primary");
    els.start.classList.remove("ghost");
  }
}
function updateHud() {
  const hpP = clamp(player.hp / player.maxHp, 0, 1) * 100;
  const stP = clamp(player.stam / player.maxStam, 0, 1) * 100;
  const xpP = clamp(player.xp / player.xpNext, 0, 1) * 100;
  els.hpFill.style.width = hpP + "%";
  els.stamFill.style.width = stP + "%";
  els.xpFill.style.width = xpP + "%";
  els.hpText.textContent = Math.ceil(player.hp) + "/" + player.maxHp;
  els.stamText.textContent = Math.ceil(player.stam) + "/" + player.maxStam;
  els.xpText.textContent = Math.floor(player.xp) + "/" + player.xpNext;
  els.level.textContent = "Level " + player.level + (allDone ? " · Pelindung" : "");
  els.score.textContent = Math.floor(player.score);
  const qhtml = [];
  const addQ = (q, label) => {
    if (!q.accepted) return;
    const done = q.done;
    const prog = done ? "selesai" : (q.progress + "/" + q.need);
    qhtml.push('<li class="' + (done ? "done" : "") + '">' + label + ' <span class="q-prog">' + prog + "</span></li>");
  };
  addQ(quests.rusa, "Tangkap rusa");
  addQ(quests.emas, "Cari Buah Emas");
  addQ(quests.babi, "Usir babi hutan");
  if (!qhtml.length) qhtml.push("<li>Bicara dengan Kakaktua Kiko</li>");
  els.quests.innerHTML = qhtml.join("");
}

els.start.addEventListener("click", startFresh);
els.continue.addEventListener("click", continueGame);
document.getElementById("btn-pause").addEventListener("click", pauseGame);
document.getElementById("btn-resume").addEventListener("click", resumeGame);
document.getElementById("btn-pause-inv").addEventListener("click", openInv);
document.getElementById("btn-to-title").addEventListener("click", goTitle);
document.getElementById("btn-inv").addEventListener("click", openInv);
document.getElementById("btn-inv-close").addEventListener("click", closeInv);
document.getElementById("btn-retry").addEventListener("click", retryGame);
document.getElementById("btn-over-title").addEventListener("click", goTitle);
els.mute.addEventListener("click", toggleMute);
els.action.addEventListener("click", (e) => { e.preventDefault(); doAction(); });
els.action.addEventListener("pointerdown", (e) => e.stopPropagation());
function onScreen(x, y, pad) {
  pad = pad || 90;
  return x > cam.x - pad && y > cam.y - pad && x < cam.x + viewW + pad && y < cam.y + viewH + pad;
}
function grassColor(tx, ty) {
  const h = hash(tx, ty);
  const v = (h & 255) / 255;
  const r = 42 + v * 30, g = 118 + v * 40, b = 48 + v * 18;
  return "rgb(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + ")";
}
function strokeRiver() {
  ctx.beginPath();
  for (let i = 0; i < river.length; i++) {
    if (i === 0) ctx.moveTo(river[i].x, river[i].y);
    else ctx.lineTo(river[i].x, river[i].y);
  }
  ctx.stroke();
}
function drawGround() {
  const x0 = Math.floor(cam.x / TILE) - 1;
  const y0 = Math.floor(cam.y / TILE) - 1;
  const x1 = Math.ceil((cam.x + viewW) / TILE) + 1;
  const y1 = Math.ceil((cam.y + viewH) / TILE) + 1;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      ctx.fillStyle = grassColor(tx, ty);
      ctx.fillRect(tx * TILE, ty * TILE, TILE + 0.5, TILE + 0.5);
      const h = hash(tx * 13, ty * 7);
      if ((h & 7) === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath();
        ctx.ellipse(tx * TILE + (h % 50), ty * TILE + ((h >> 5) % 50), 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const p of paths) {
    ctx.strokeStyle = "#c3a05c";
    ctx.lineWidth = p.w;
    ctx.beginPath();
    ctx.moveTo(p.a.x, p.a.y);
    ctx.lineTo(p.b.x, p.b.y);
    ctx.stroke();
    ctx.strokeStyle = "#d8b873";
    ctx.lineWidth = p.w * 0.55;
    ctx.beginPath();
    ctx.moveTo(p.a.x, p.a.y);
    ctx.lineTo(p.b.x, p.b.y);
    ctx.stroke();
  }
  const t = performance.now() / 1000;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1c6a78";
  ctx.lineWidth = 108;
  strokeRiver();
  ctx.strokeStyle = "#2b93a3";
  ctx.lineWidth = 82;
  strokeRiver();
  ctx.strokeStyle = "#48b8c2";
  ctx.lineWidth = 48;
  strokeRiver();
  if (!reduced) {
    ctx.strokeStyle = "rgba(210,255,255,0.28)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = 0; i < river.length; i++) {
      const p = river[i];
      const ox = Math.sin(t * 1.6 + i * 0.4) * 8;
      const oy = Math.cos(t * 1.2 + i * 0.35) * 4;
      if (i === 0) ctx.moveTo(p.x + ox, p.y + oy);
      else ctx.lineTo(p.x + ox, p.y + oy);
    }
    ctx.stroke();
  }
}
function drawDecal(d) {
  if (!onScreen(d.x, d.y, 40)) return;
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.rot || 0);
  const s = d.scale || 1;
  if (d.kind === "fern") {
    ctx.fillStyle = "#2f7a38";
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(i * 4 * s, -6 * s, 4 * s, 10 * s, i * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (d.kind === "flower") {
    ctx.fillStyle = d.hue < 0.5 ? "#f0c3d8" : "#ffe27a";
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 4 * s, Math.sin(a) * 4 * s, 3 * s, 3 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff3a8";
    ctx.beginPath();
    ctx.arc(0, 0, 2 * s, 0, Math.PI * 2);
    ctx.fill();
  } else if (d.kind === "stone") {
    ctx.fillStyle = "#b9b4a6";
    ctx.beginPath();
    ctx.ellipse(0, 0, 16 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.ellipse(-3, -2, 6 * s, 3 * s, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
function drawBush(b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  const s = b.scale;
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 6, 16 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = b.variant === 1 ? "#2a7a3a" : "#3c9244";
  ctx.beginPath();
  ctx.ellipse(-8 * s, 0, 12 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(8 * s, 0, 12 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(0, -6 * s, 11 * s, 11 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(180,255,160,0.25)";
  ctx.beginPath();
  ctx.ellipse(-4 * s, -6 * s, 5 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function drawRock(r) {
  ctx.save();
  ctx.translate(r.x, r.y);
  const s = r.scale;
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(0, 8 * s, 16 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8b8680";
  ctx.beginPath();
  ctx.ellipse(0, 0, 18 * s, 13 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b7b3ad";
  ctx.beginPath();
  ctx.ellipse(-4 * s, -4 * s, 8 * s, 5 * s, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function drawTree(tr) {
  ctx.save();
  ctx.translate(tr.x, tr.y);
  const s = tr.scale;
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 18 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tr.variant === 3 ? "#7a5a22" : "#6a4420";
  ctx.beginPath();
  ctx.moveTo(-6 * s, 8);
  ctx.lineTo(-4 * s, -18 * s);
  ctx.lineTo(4 * s, -18 * s);
  ctx.lineTo(6 * s, 8);
  ctx.closePath();
  ctx.fill();
  if (tr.variant === 4) {
    ctx.strokeStyle = "#2f6a28";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(0, -10 * s);
    ctx.quadraticCurveTo(16 * s, 0, 10 * s, 16 * s);
    ctx.moveTo(2 * s, -8 * s);
    ctx.quadraticCurveTo(-14 * s, 4, -8 * s, 18 * s);
    ctx.stroke();
  }
  const greens = ["#2e8a3c", "#247a34", "#3aa04a", "#1f6a30", "#4aad4e"];
  ctx.fillStyle = greens[tr.variant % greens.length];
  if (tr.variant === 3) {
    ctx.fillStyle = "#3f9a2e";
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.45;
      ctx.ellipse(Math.cos(a) * 8 * s, -28 * s + Math.sin(a) * 4 * s, 6 * s, 16 * s, a, 0, Math.PI * 2);
    }
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(0, -28 * s, 26 * s, 20 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(-16 * s, -20 * s, 16 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(16 * s, -20 * s, 16 * s, 14 * s, 0, 0, Math.PI * 2);
    if (tr.variant % 2 === 0) ctx.ellipse(0, -40 * s, 16 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(200,255,170,0.18)";
    ctx.beginPath();
    ctx.ellipse(-8 * s, -34 * s, 10 * s, 7 * s, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
function drawFruit(it, t) {
  ctx.save();
  ctx.translate(it.x, it.y + (reduced ? 0 : Math.sin(t * 3 + it.x) * 2));
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 10, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (it.kind === "mangga") {
    ctx.fillStyle = "#f0a020";
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 11, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd36a";
    ctx.beginPath();
    ctx.ellipse(-2, -3, 3, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a8a28";
    ctx.beginPath();
    ctx.ellipse(3, -11, 4, 2.5, -0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (it.kind === "pisang") {
    ctx.strokeStyle = "#f2d04a";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 2, 7, -0.4, 1.6);
    ctx.stroke();
    ctx.strokeStyle = "#ffe98a";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(-4, 2, 7, -0.2, 1.5);
    ctx.stroke();
  } else {
    const glow = 0.5 + Math.sin(t * 4) * 0.25;
    ctx.fillStyle = "rgba(255, 220, 80," + (0.25 + glow * 0.25) + ")";
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd24a";
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff6c0";
    ctx.beginPath();
    ctx.arc(-2, -2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
function drawStump() {
  ctx.save();
  ctx.translate(stump.x, stump.y);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8a6230";
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c9a36a";
  ctx.beginPath();
  ctx.ellipse(0, -4, 16, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8a6230";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, -4, 8, 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
function drawNpc(t) {
  const bob = reduced ? 0 : Math.sin(t * 3) * 2;
  ctx.save();
  ctx.translate(npc.x, npc.y + bob);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(0, 16, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff8e8";
  ctx.beginPath();
  ctx.ellipse(0, 4, 9, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2c14a";
  ctx.beginPath();
  ctx.ellipse(0, 8, 7, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f0a020";
  ctx.beginPath();
  ctx.moveTo(-2, -12);
  ctx.quadraticCurveTo(-2, -24, 2, -28 + Math.sin(t * 5) * 1.5);
  ctx.quadraticCurveTo(8, -20, 4, -12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff8e8";
  ctx.beginPath();
  ctx.arc(0, -8, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f0a020";
  ctx.beginPath();
  ctx.moveTo(6, -8);
  ctx.lineTo(14, -6);
  ctx.lineTo(6, -4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1a1208";
  ctx.beginPath();
  ctx.arc(2, -9, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(2.5, -9.5, 0.5, 0, Math.PI * 2);
  ctx.fill();
  const ready = quests.rusa.accepted && (
    (quests.rusa.progress >= 5 && !quests.rusa.done) ||
    (quests.emas.progress >= 1 && !quests.emas.done) ||
    (quests.babi.progress >= 3 && !quests.babi.done)
  );
  const showMark = !quests.rusa.accepted || ready;
  if (showMark) {
    ctx.fillStyle = "#ffd24a";
    ctx.font = "bold 16px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ready ? "!" : "?", 0, -36);
  }
  ctx.restore();
}
function drawTiger(p, t) {
  ctx.save();
  ctx.translate(p.x, p.y);
  const sh = p.pouncing ? 1.15 : 1;
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 12, 18 * sh, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  if (p.invuln > 0 && Math.floor(t * 16) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.scale(p.facing, 1);
  const walk = p.moving || p.pouncing ? 1 : 0;
  const bob = reduced ? 0 : Math.sin(p.anim) * 2.2 * walk + Math.sin(t * 3) * 0.4 * (1 - walk);
  ctx.translate(0, bob - (p.pouncing ? 7 : 0));
  if (p.pouncing) ctx.scale(1.2, 0.86);
  ctx.save();
  ctx.translate(-18, 0);
  const tw = reduced ? -0.5 : Math.sin(p.anim * 0.9) * (walk ? 0.5 : 0.18) - 0.55;
  ctx.rotate(tw);
  ctx.strokeStyle = "#e88912";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-10, -12, -6, -22);
  ctx.stroke();
  ctx.strokeStyle = "#3a2212";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-5, -18);
  ctx.lineTo(-6, -22);
  ctx.stroke();
  ctx.restore();
  const leg = reduced ? 0 : Math.sin(p.anim) * 5 * walk;
  function paw(x, y, off) {
    ctx.fillStyle = "#e07a12";
    ctx.beginPath();
    ctx.ellipse(x, y + off, 4.2, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  paw(-8, 9, -leg);
  paw(6, 9, leg);
  ctx.fillStyle = "#f4a024";
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff3d6";
  ctx.beginPath();
  ctx.ellipse(3, 4, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3a2212";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  [[-4, -6, -6, 4], [2, -7, 1, 5], [8, -5, 7, 3]].forEach((seg) => {
    ctx.beginPath();
    ctx.moveTo(seg[0], seg[1]);
    ctx.quadraticCurveTo((seg[0] + seg[2]) / 2 - 2, (seg[1] + seg[3]) / 2, seg[2], seg[3]);
    ctx.stroke();
  });
  paw(-2, 10, leg * 0.8);
  paw(10, 10, -leg * 0.8);
  ctx.fillStyle = "#f4a024";
  ctx.beginPath();
  ctx.ellipse(12, -10, 13, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  function ear(x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = "#f4a024";
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f3b4b4";
    ctx.beginPath();
    ctx.ellipse(0, 1, 2.4, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ear(5, -20, -0.4);
  ear(20, -18, 0.25);
  ctx.fillStyle = "#fff3d6";
  ctx.beginPath();
  ctx.ellipse(16, -6, 7, 5.5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e07a7a";
  ctx.beginPath();
  ctx.ellipse(20, -7, 2.2, 1.6, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1208";
  ctx.beginPath();
  ctx.arc(12, -12, 1.8, 0, Math.PI * 2);
  ctx.arc(18, -13, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(12.6, -12.6, 0.7, 0, Math.PI * 2);
  ctx.arc(18.6, -13.6, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1a1208";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(18, -5, 3, 0.15, 1.15);
  ctx.stroke();
  if (allDone) {
    ctx.fillStyle = "#3d8a34";
    ctx.beginPath();
    ctx.ellipse(12, -22, 10, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f0c14b";
    ctx.beginPath();
    ctx.moveTo(12, -28);
    ctx.lineTo(15, -22);
    ctx.lineTo(9, -22);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
function drawDeer(d) {
  if (d.state === "caught") {
    ctx.save();
    ctx.globalAlpha = Math.max(0, d.t / 0.55);
    ctx.translate(d.x, d.y);
    ctx.fillStyle = "#fff4a8";
    ctx.beginPath();
    ctx.arc(0, -10, 18 * (1.2 - d.t), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(0, 10, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(d.facing, 1);
  const bob = reduced ? 0 : Math.sin(d.anim) * (d.state === "graze" ? 0.4 : 1.8);
  ctx.translate(0, bob);
  ctx.fillStyle = "#b07a3a";
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f3e2c4";
  ctx.beginPath();
  ctx.ellipse(2, 3, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f3e2c4";
  ctx.beginPath();
  ctx.arc(-2, -2, 1.6, 0, Math.PI * 2);
  ctx.arc(4, -3, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8a5a28";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  const lg = Math.sin(d.anim) * 3;
  ctx.beginPath();
  ctx.moveTo(-6, 6); ctx.lineTo(-7, 13 + lg);
  ctx.moveTo(2, 6); ctx.lineTo(4, 13 - lg);
  ctx.stroke();
  ctx.fillStyle = "#b07a3a";
  ctx.beginPath();
  ctx.ellipse(12, -8, 7, 6.5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f3e2c4";
  ctx.beginPath();
  ctx.ellipse(15, -6, 3.5, 3, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5a3a1a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(10, -13); ctx.lineTo(8, -20); ctx.lineTo(11, -18);
  ctx.moveTo(14, -13); ctx.lineTo(15, -21); ctx.lineTo(17, -17);
  ctx.stroke();
  ctx.fillStyle = "#1a1208";
  ctx.beginPath();
  ctx.arc(14, -9, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function drawBoar(b) {
  if (b.dead) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, b.t / 0.5);
    ctx.translate(b.x, b.y);
    ctx.fillStyle = "#dfe9a8";
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, 11, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(b.facing, 1);
  ctx.fillStyle = "#5a3a28";
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7a5640";
  ctx.beginPath();
  ctx.ellipse(10, -2, 8, 7, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e8c8b0";
  ctx.beginPath();
  ctx.ellipse(16, 0, 5, 4, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f3efe6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 2); ctx.lineTo(19, -2);
  ctx.moveTo(16, 3); ctx.lineTo(19, 6);
  ctx.stroke();
  ctx.fillStyle = "#1a1208";
  ctx.beginPath();
  ctx.arc(12, -4, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (b.hp < b.maxHp) {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(b.x - 12, b.y - 24, 24, 4);
    ctx.fillStyle = "#e85d4c";
    ctx.fillRect(b.x - 12, b.y - 24, 24 * clamp(b.hp / b.maxHp, 0, 1), 4);
  }
}
function drawSnake(s) {
  if (s.dead) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, s.t / 0.5);
    ctx.translate(s.x, s.y);
    ctx.fillStyle = "#c8e68a";
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(s.ang || 0);
  for (let i = 6; i >= 0; i--) {
    const ox = -i * 6;
    const oy = Math.sin(s.anim + i * 0.7) * 4;
    ctx.fillStyle = i % 2 ? "#3d9a4a" : "#2e7a38";
    ctx.beginPath();
    ctx.ellipse(ox, oy, i === 0 ? 6.5 : 5, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#1a1208";
  ctx.beginPath();
  ctx.arc(2, -1.5, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e85d4c";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(11, Math.sin(s.anim * 2) * 2);
  ctx.stroke();
  ctx.restore();
  if (s.hp < s.maxHp) {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(s.x - 10, s.y - 18, 20, 3);
    ctx.fillStyle = "#e85d4c";
    ctx.fillRect(s.x - 10, s.y - 18, 20 * clamp(s.hp / s.maxHp, 0, 1), 3);
  }
}
function drawButter(b, t) {
  ctx.save();
  const x = b.x + Math.sin(t * 0.7 + b.t) * 28;
  const y = b.y + Math.cos(t * 0.9 + b.t) * 16;
  ctx.translate(x, y);
  ctx.fillStyle = b.hue < 0.5 ? "#f3c14a" : "#e8a0d0";
  const w = reduced ? 5 : 5 + Math.sin(t * 10 + b.t) * 3;
  ctx.beginPath();
  ctx.ellipse(-w, 0, w, 4, -0.4, 0, Math.PI * 2);
  ctx.ellipse(w, 0, w, 4, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function drawParticles(dt, t) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 40 * dt;
    if (!onScreen(p.x, p.y, 20)) continue;
    ctx.globalAlpha = clamp(p.life / 0.6, 0, 1);
    ctx.fillStyle = p.color;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.kind === "leaf") {
      ctx.rotate((p.rot || 0) + t);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t -= dt;
    f.y -= 22 * dt;
    if (f.t <= 0) { floaters.splice(i, 1); continue; }
    ctx.globalAlpha = clamp(f.t / 0.4, 0, 1);
    ctx.fillStyle = f.color;
    ctx.font = "bold 13px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }
}
function drawRays(t) {
  if (reduced) return;
  ctx.save();
  ctx.translate(viewW * 0.8, -20);
  ctx.fillStyle = "rgba(255, 230, 140, 0.045)";
  for (let i = 0; i < 6; i++) {
    const a = -0.9 + i * 0.22 + Math.sin(t * 0.15) * 0.05;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 1400, Math.sin(a) * 1400);
    ctx.lineTo(Math.cos(a + 0.08) * 1400, Math.sin(a + 0.08) * 1400);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
function drawVignette() {
  const g = ctx.createRadialGradient(viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.35, viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(8,20,10,0.38)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, viewH);
}
function drawMinimap() {
  const w = mini.width, h = mini.height;
  mctx.fillStyle = "#1c4a28";
  mctx.fillRect(0, 0, w, h);
  const sx = w / WORLD_W, sy = h / WORLD_H;
  mctx.strokeStyle = "#2b93a3";
  mctx.lineWidth = 4;
  mctx.beginPath();
  for (let i = 0; i < river.length; i++) {
    const p = river[i];
    if (i === 0) mctx.moveTo(p.x * sx, p.y * sy);
    else mctx.lineTo(p.x * sx, p.y * sy);
  }
  mctx.stroke();
  mctx.strokeStyle = "#c3a05c";
  mctx.lineWidth = 2;
  for (const p of paths) {
    mctx.beginPath();
    mctx.moveTo(p.a.x * sx, p.a.y * sy);
    mctx.lineTo(p.b.x * sx, p.b.y * sy);
    mctx.stroke();
  }
  mctx.fillStyle = "#fff8e8";
  mctx.beginPath();
  mctx.arc(npc.x * sx, npc.y * sy, 3, 0, Math.PI * 2);
  mctx.fill();
  for (const it of items) {
    if (it.kind !== "emas") continue;
    mctx.fillStyle = "#ffd24a";
    mctx.beginPath();
    mctx.arc(it.x * sx, it.y * sy, 3.2, 0, Math.PI * 2);
    mctx.fill();
  }
  mctx.fillStyle = "#f4a024";
  const px = player.x * sx, py = player.y * sy;
  mctx.save();
  mctx.translate(px, py);
  mctx.rotate(Math.atan2(lastDirY, lastDirX));
  mctx.beginPath();
  mctx.moveTo(6, 0);
  mctx.lineTo(-4, 4);
  mctx.lineTo(-4, -4);
  mctx.closePath();
  mctx.fill();
  mctx.restore();
  mctx.strokeStyle = "rgba(255,255,255,0.45)";
  mctx.lineWidth = 1;
  mctx.strokeRect(cam.x * sx, cam.y * sy, viewW * sx, viewH * sy);
}

function drawWorld(t, dt) {
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawGround();
  for (const d of decals) drawDecal(d);
  for (const it of items) if (onScreen(it.x, it.y, 30)) drawFruit(it, t);
  const drawList = [];
  drawList.push({ y: stump.y, fn: drawStump });
  drawList.push({ y: npc.y + 8, fn: () => drawNpc(t) });
  for (const b of bushes) if (onScreen(b.x, b.y, 40)) drawList.push({ y: b.y, fn: () => drawBush(b) });
  for (const r of rocks) if (onScreen(r.x, r.y, 40)) drawList.push({ y: r.y, fn: () => drawRock(r) });
  for (const tr of trees) if (onScreen(tr.x, tr.y, 80)) drawList.push({ y: tr.y, fn: () => drawTree(tr) });
  for (const d of deer) if (onScreen(d.x, d.y, 40) || d.state === "caught") drawList.push({ y: d.y, fn: () => drawDeer(d) });
  for (const b of boars) if (onScreen(b.x, b.y, 40) || b.dead) drawList.push({ y: b.y, fn: () => drawBoar(b) });
  for (const s of snakes) if (onScreen(s.x, s.y, 40) || s.dead) drawList.push({ y: s.y, fn: () => drawSnake(s) });
  drawList.push({ y: player.y, fn: () => drawTiger(player, t) });
  drawList.sort((a, b) => a.y - b.y);
  for (const d of drawList) d.fn();
  for (const b of butterflies) if (onScreen(b.x, b.y, 50)) drawButter(b, t);
  drawParticles(dt, t);
  ctx.restore();
  drawRays(t);
  drawVignette();
  if (state !== "title") drawMinimap();
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = wrap.clientWidth || window.innerWidth;
  const h = wrap.clientHeight || window.innerHeight;
  viewW = Math.max(1, w);
  viewH = Math.max(1, h);
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = clamp((now - lastT) / 1000, 0, 0.05);
  lastT = now;
  const t = now / 1000;
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) els.toast.hidden = true;
  }
  if (announceTimer > 0) announceTimer -= dt;
  if (state === "play") {
    updatePlayer(dt);
    for (const d of deer) aiDeer(d, dt);
    for (const b of boars) aiBoar(b, dt);
    for (const s of snakes) aiSnake(s, dt);
    deer = deer.filter((d) => d.state !== "caught" || d.t > 0);
    boars = boars.filter((b) => !b.dead || b.t > 0);
    snakes = snakes.filter((s) => !s.dead || s.t > 0);
    respawnTick(dt);
    updateActionMode();
    saveAcc += dt;
    if (saveAcc > 8) { saveAcc = 0; saveGame(); }
    if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) updateHud();
  } else if (state === "title") {
    for (const d of deer) aiDeer(d, dt);
    npc.anim += dt;
  }
  updateCam(dt);
  drawWorld(t, dt);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (state === "play") pauseGame();
    saveGame();
  } else {
    lastT = performance.now();
    if (!raf) raf = requestAnimationFrame(loop);
  }
});
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 80));

buildWorld();
resetActors([]);
resize();
cam.x = npc.x - viewW / 2;
cam.y = npc.y - viewH / 2 + 40;
syncMuteBtn();
refreshTitle();
updateHud();
lastT = performance.now();
raf = requestAnimationFrame(loop);
