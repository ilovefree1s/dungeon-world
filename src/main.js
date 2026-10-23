// ============================================================================
//  DUNGEON WORLD  -  main: the world, the hero, the sky, the screens and the
//  loop. Stage 1: walk an endless block world in six biomes, day and night.
// ============================================================================
import { THREE, renderer, scene, camera, resize, render, setQuality, view, IS_TOUCH, QUALITY } from './engine.js';
import { World } from './world.js';
import { Player } from './player.js';
import { sky, updateSky, clock } from './sky.js';
import { readInput, takeLook, menuKeys, initTouch, onFirstInput, input, lockMouse, unlockMouse, mouseLocked } from './input.js';
import { startAudio, sfx, setSfx, setMusic, audioState } from './audio.js';
import { BIOME_NAME, BIOME_SUB, CH } from './gen.js';
import { Monsters, Bolts, stats, xpToNext, pickMonster } from './combat.js';
import { Abilities, KITS } from './abilities.js';
import { forge, openForge, closeForge, equippedSpec, takeLoot } from './forge.js';
import { Bodies, rollDrop } from './loot.js';
import { statsOf, plainStats, dpsOf, hitOf } from './weaponkit.js';
import { Turntable } from './turntable.js';
import { AURA_VIEW } from './auras.js';
import { VERSION } from './version.js';
import { CharSheet } from './charsheet.js';
import { burst, ring, stepFx } from './fx.js';
import { grassUniforms } from './flora.js';
import { updateAmbience } from './ambience.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
};
const SAVE_KEY = 'dungeonworld.save.v1', OPT_KEY = 'dungeonworld.opts.v1';
let save = null; try { save = JSON.parse(ls.get(SAVE_KEY)); } catch (e) { }
let opts = {}; try { opts = JSON.parse(ls.get(OPT_KEY)) || {}; } catch (e) { }
if (Q.has('fresh')) { save = null; }

// ---------------------------------------------------------------- options
const UI = { state: 'title', autoQ: opts.quality === undefined || opts.quality < 0, quality: 1, cls: save ? save.cls : 0 };
UI.quality = Q.has('q') ? +Q.get('q') : UI.autoQ ? (IS_TOUCH ? 1 : 2) : opts.quality;
if (Q.has('q')) UI.autoQ = false;
audioState.music = opts.music ?? 0.45; audioState.sfx = opts.sfx ?? 0.8;
input.mouseSpeed = opts.mouse ?? 1;
// the mouse: a cursor (the default on a PC: drag to look, click to fight or loot) or captured (click the world, Esc lets go)
// (any machine with a mouse, touch screen or not; a save from before the cursor was the default is reset once)
input.cursorMode = opts.cursorV === 2 ? (opts.cursor ?? true) : matchMedia('(pointer:fine)').matches;
document.documentElement.classList.toggle('cursor', input.cursorMode);
setSfx(audioState.sfx);
function saveOpts() { ls.set(OPT_KEY, JSON.stringify({ quality: UI.autoQ ? -1 : UI.quality, music: audioState.music, sfx: audioState.sfx, mouse: input.mouseSpeed, cursor: input.cursorMode, cursorV: 2 })); }
setQuality(UI.quality);

// ---------------------------------------------------------------- the world and the hero
const seed = Q.has('seed') ? (+Q.get('seed') || 1) : save ? save.seed : 1;
const world = new World(seed, Q.has('flat'), !Q.has('blocks'));
const player = new Player(world);
player.onHurt = () => { sfx('hurt'); $('hurt').style.opacity = 1; setTimeout(() => $('hurt').style.opacity = 0, 250); };
player.setClass(UI.cls);
let start = save && save.seed === seed ? [save.x, save.y, save.z] : world.spawnPoint();
player.place(...start);
if (save && save.seed === seed) { player.yaw = save.yaw ?? player.yaw; sky.t = save.t ?? sky.t; }
if (save && save.level) { stats.level = save.level; stats.xp = save.xp || 0; stats.maxHp = 30 + (stats.level - 1) * 6; stats.hp = Math.min(stats.maxHp, save.hp || stats.maxHp); stats.kills = save.kills || 0; }
const spawn = start.slice();

// ---------------------------------------------------------------- combat
const monsters = new Monsters(world, player);
const bolts = new Bolts(world, monsters);
monsters.hooks.hurt = () => player.onHurt();
monsters.hooks.level = lv => { sfx('levelup'); ring(player.pos.x, player.pos.y + 0.1, player.pos.z, '#ffe08a', 1, 10, 0.7); burst(player.pos.x, player.pos.y + 3, player.pos.z, '#ffe9a0', 20, 10, 1.6, true, 0.8); banner('LEVEL ' + lv, 'stronger, and all healed up'); };
let deadT = 0;
monsters.hooks.dead = () => { sfx('death'); deadT = 2.6; banner('YOU FELL', 'back to the woods...'); player.invT = 9; if (player.model.userData.fade) player.model.userData.fade(0.4); };
const ctx = { player, world, monsters, bolts, shake: k => { player.shake = Math.max(player.shake || 0, k); } };
const abilities = new Abilities(ctx);
// the fallen: bodies stay a while, some with a weapon on them
const bodies = new Bodies(player);
monsters.hooks.fallen = m => bodies.fall(m, rollDrop(m, player.cls));
let lootBody = null;
const lootView = new Turntable($('lootGl'));
function openLoot(b) {
  lootBody = b; const d = bodies.describe(b.spec);
  // the rarity colors the name and the frame; the picture turns on its stand
  $('lootT').textContent = d.rarity.id === 'common' ? 'IT DROPPED' : `A ${d.rarity.name} DROP`;
  $('lootRarity').textContent = d.rarity.name; $('lootRarity').style.color = d.rarity.color;
  $('lootName').textContent = d.name; $('lootName').style.color = d.rarity.color; $('lootName').style.textShadow = `0 5px 0 rgba(0,0,0,.55), 0 0 24px ${d.rarity.color}66`;
  $('loot').querySelector('.panel').style.boxShadow = `inset 0 0 0 2px ${d.rarity.color}, 0 24px 60px rgba(0,0,0,.55), 0 0 40px ${d.rarity.color}44`;
  $('loot').hidden = false; lootView.show(b.spec);
  $('lootLine').textContent = d.line;
  // each number beside what the hero of that class wields now (the plain weapon if nothing's forged): up in green, down in red
  const have = equippedSpec(d.cls), cur = have ? statsOf(have) : plainStats(d.cls);
  // (less is better for the time between swings: its arrow goes the other way)
  const row = (label, a, b, pre = 'x', post = '', lessIsBetter = false) => { const dlt = +(a - b).toFixed(2), good = lessIsBetter ? -dlt : dlt; const col = good > 0 ? '#5ce65c' : good < 0 ? '#ff6a55' : 'var(--dim)'; const arrow = good > 0 ? '▲' : good < 0 ? '▼' : '='; return `<div><span style="display:inline-block;width:72px;text-align:left">${label}</span> ${pre}${a}${post} <b style="color:${col}">${arrow} ${dlt > 0 ? '+' : ''}${dlt || ''}</b> <span style="color:var(--dim);font-weight:700">(now ${pre}${b}${post})</span></div>`; };
  $('lootStats').innerHTML = row('DPS', dpsOf(d.stats, d.cls, stats.level), dpsOf(cur, d.cls, stats.level), '') + row('HIT', Math.round(hitOf(d.stats, d.cls, stats.level)), Math.round(hitOf(cur, d.cls, stats.level)), '') + row(d.stats.cls === 0 ? 'SWING' : 'SHOT', d.stats.time, cur.time, '', 's', true) + (d.stats.cls !== 0 ? row('SHOT SPD', d.stats.shot, cur.shot) : '')
    + `<div class="small" style="margin-top:6px">${have ? 'AGAINST ' + (have.name || 'YOUR FORGED WEAPON') : 'AGAINST THE PLAIN ONE'}</div>`;
  $('lootWield').textContent = d.cls === player.cls ? 'TAKE & WIELD' : `TAKE & WIELD (AS THE ${['WARRIOR', 'MAGE', 'HUNTER'][d.cls]})`;
  unlockMouse(); UI.state = 'loot'; sfx(d.rarity.id === 'legendary' ? 'legend' : d.rarity.id === 'common' ? 'pickup' : 'rare');
}
// the character sheet and the bags (C and B, or the buttons by the menu's)
const sheet = new CharSheet(player);
function openSheet(tab) { if (UI.state !== 'play') return; unlockMouse(); UI.state = 'char'; sheet.show(tab); }
sheet.onClose = () => { if (UI.state === 'char') UI.state = 'play'; };
sheet.onForge = () => { sheet.close(); forgeFrom = 'play'; UI.state = 'forge'; openForge(); };
$('charBtn').addEventListener('click', () => openSheet('char'));
$('bagsBtn').addEventListener('click', () => openSheet('bags'));
function closeLoot() { UI.state = 'play'; $('loot').hidden = true; lootBody = null; lootView.stop(); }
$('lootWield').addEventListener('click', () => { if (!lootBody) return; takeLoot(lootBody.spec, true); bodies.took(lootBody); sfx('legend'); closeLoot(); });
$('lootTake').addEventListener('click', () => { if (!lootBody) return; takeLoot(lootBody.spec, false); bodies.took(lootBody); sfx('pickup'); closeLoot(); });
$('lootLeave').addEventListener('click', () => { sfx('nope'); closeLoot(); });
function heroCombat(dt, inp, frozen) {
  ctx.frozen = frozen;
  // a body in your sights: a click or F looks at what it dropped instead of swinging
  bodies.update(dt, monsters.list.some(m => m.state === 'chase' && m.pos.distanceTo(player.pos) < 16));
  $('lootHint').hidden = !bodies.target || input.cursorMode;
  if (!input.cursorMode && bodies.target && (inp.atkEdge || inp.useEdge)) { inp.atkEdge = false; inp.useEdge = false; openLoot(bodies.target); return; }
  if (input.cursorMode) {
    const gl = $('gl'), w = gl.clientWidth, h = gl.clientHeight;
    // the right button turns the hero with the camera
    if (inp.turnWith) { player.aimFace = player.yaw + Math.PI; inp.turnWith = false; }
    // what's under the cursor shapes it: a sword over a monster, a hand over loot
    if (inp.cursor.in) { const m = pickMonster(monsters, inp.cursor.x, inp.cursor.y, w, h); const b = m ? null : bodies.pickAt(inp.cursor.x, inp.cursor.y, w, h); gl.style.cursor = m ? 'crosshair' : b ? 'pointer' : 'default'; }
    // the left click targets: a monster is focused (attacks aim at it), a body with loot is looked at, the ground clears the focus
    if (inp.clickAt) {
      const c = inp.clickAt; inp.clickAt = null;
      const m = pickMonster(monsters, c.x, c.y, w, h);
      if (m) monsters.focus = m;
      else { const b = bodies.pickAt(c.x, c.y, w, h); if (b) { openLoot(b); return; } monsters.focus = null; inp.autoAtk = false; }
    }
    // the right click attacks: on a monster, it's focused and auto-attack starts (another right click stops it);
    // on nothing, with a focus, auto-attack toggles; with none, one swing where you look
    if (inp.rclickAt) {
      const c = inp.rclickAt; inp.rclickAt = null;
      const m = pickMonster(monsters, c.x, c.y, w, h);
      if (m && m !== monsters.focus) { monsters.focus = m; inp.autoAtk = true; }
      else if (monsters.focus) inp.autoAtk = !inp.autoAtk;
      else inp.atkEdge = true;
    }
    // auto-attack ends with its target
    if (inp.autoAtk && !monsters.focus) inp.autoAtk = false;
    // F looks at the loot you're near, as before
    if (bodies.target && inp.useEdge) { inp.useEdge = false; openLoot(bodies.target); return; }
  }
  inp.useEdge = false;
  abilities.update(dt, inp);
}
function respawn() {
  stats.hp = stats.maxHp;
  player.place(spawn[0], spawn[1] + 1, spawn[2]); placed = false;
  if (player.model.userData.fade) player.model.userData.fade(1);
  player.invT = 2;
}
if (Q.has('t')) sky.t = +Q.get('t');
let placed = !!(save && save.seed === seed); // (a new hero still has to find its footing)
// put the hero on open ground once its chunk is here
function settle() {
  const p = player.pos;
  if (world.poly) {
    // the nearest dry, clear spot on the low-poly land
    for (let r = 0; r < 30; r += 1.5) for (let a = 0; a < Math.max(1, r * 4); a++) {
      const x = p.x + Math.cos(a / Math.max(1, r * 4) * Math.PI * 2) * r, z = p.z + Math.sin(a / Math.max(1, r * 4) * Math.PI * 2) * r;
      const g = world.ground(x, z);
      if (g === null || world.seaAt(x, z)) continue;
      const [cx2, cz2] = world.clearOfTrunks(x, z, 1.2);
      if (cx2 !== x || cz2 !== z) continue;
      player.place(x, g + 0.1, z); return true;
    }
    return false;
  }
  for (let r = 0; r < 24; r++) for (let a = 0; a < Math.max(1, r * 6); a++) {
    const x = Math.floor(p.x + Math.cos(a / Math.max(1, r * 6) * Math.PI * 2) * r) + 0.5, z = Math.floor(p.z + Math.sin(a / Math.max(1, r * 6) * Math.PI * 2) * r) + 0.5;
    const g = world.groundY(x, z);
    if (g < 0 || world.water(x, g + 1, z) || world.lava(x, g + 1, z) || world.lava(x, g, z)) continue;
    // (on the ground, not up in a tree)
    if (!player.hits(x, g + 1, z) && world.gen.column(Math.floor(x), Math.floor(z)).h >= g - 2) { player.place(x, g + 1, z); return true; }
  }
  return false;
}

// ---------------------------------------------------------------- HUD
const BIOME_COL = ['#5cae3c', '#e8f2fb', '#e0c48c', '#5c7032', '#ff6a1e', '#b47cff'];
let biomeNow = -1, biomeSeen = -1, biomeT = 0, bannerT = 0;
function banner(t, s) { $('bannerT').textContent = t; $('bannerS').textContent = s; $('banner').classList.add('on'); bannerT = 3.2; }
const compass = $('compass');
const abSlots = [...document.querySelectorAll('#abil .slot')];
const marks = [['N', 0], ['E', 90], ['S', 180], ['W', 270], ['·', 45], ['·', 135], ['·', 225], ['·', 315]];
compass.innerHTML = marks.map(([t]) => `<span class="${t === 'N' ? 'n' : ''}">${t}</span>`).join('') + '<span class="tw" title="the Tower">◆</span>';
const cspans = [...compass.children];
function updateHud(dt) {
  // the compass: north is -z; the tower stands at the world's middle (0, 0)
  const head = ((-player.yaw * 180 / Math.PI) % 360 + 540) % 360; // (degrees the camera looks: 0 north, 90 east)
  const W = compass.clientWidth;
  const place = (el, deg) => { let d = ((deg - head + 540) % 360) - 180; el.style.left = (W / 2 + d * W / 200) + 'px'; el.style.opacity = Math.abs(d) < 100 ? 1 : 0; };
  marks.forEach((m, i) => place(cspans[i], m[1]));
  const p = player.pos;
  place(cspans[8], (Math.atan2(-p.x, p.z) * 180 / Math.PI + 360) % 360);
  $('hpfill').style.width = (stats.hp / stats.maxHp * 100) + '%'; $('hpT').textContent = `${stats.hp}/${stats.maxHp}`;
  $('xpfill').style.width = (stats.xp / xpToNext() * 100) + '%'; $('lvT').textContent = 'LV ' + stats.level;
  $('clockT').textContent = clock();
  // the swing timer shows while it's running or auto-attack is on
  { const sw = abilities.swing(); const el = $('swing'); el.classList.toggle('on', sw.left > 0 || input.autoAtk); el.firstElementChild.style.width = (sw.left * 100) + '%'; el.lastElementChild.textContent = (input.autoAtk ? 'AUTO · ' : '') + sw.time.toFixed(1) + 's'; }
  abilities.slots().forEach((sl, i) => { const el = abSlots[i]; if (el.dataset.n !== sl.name) { el.dataset.n = sl.name; el.querySelector('.n').textContent = sl.name; el.querySelector('.g').textContent = sl.glyph; } el.querySelector('.cd').style.height = (sl.left * 100) + '%'; el.classList.toggle('ready', sl.left <= 0); });
  $('sunIcon').textContent = sky.night > 0.5 ? '☾' : '☀';
  // the biome you're in: its name in the corner, a banner the first time each visit
  biomeT -= dt;
  if (biomeT <= 0) {
    biomeT = 0.3;
    const b = world.gen.column(Math.floor(p.x), Math.floor(p.z)).biome;
    if (b !== biomeNow) { biomeNow = b; biomeSince = 0; }
  }
  biomeSince += dt;
  if (biomeNow !== biomeSeen && biomeSince > 0.8 && UI.state === 'play') {
    biomeSeen = biomeNow;
    $('whereName').textContent = BIOME_NAME[biomeNow];
    $('whereDot').style.background = BIOME_COL[biomeNow];
    banner(BIOME_NAME[biomeNow], BIOME_SUB[biomeNow]);
  }
  if (bannerT > 0 && (bannerT -= dt) <= 0) $('banner').classList.remove('on');
  // (blue when the camera itself is under the water: its surface sits at 0.86 of the block)
  const cp = camera.position, cw = world.water(cp.x, cp.y, cp.z) && (cp.y % 1 < 0.86 || world.water(cp.x, cp.y + 1, cp.z));
  $('under').style.opacity = cw ? 1 : 0;
}
let biomeSince = 0;
// the hint for looking around, until you've done it
let hintT = 0, looked = false, compiled = false;

// ---------------------------------------------------------------- screens
const heroes = [...document.querySelectorAll('.hero')];
let focusI = UI.cls;
function focusHero(i) { focusI = (i + 3) % 3; heroes.forEach((h, k) => h.classList.toggle('focus', k === focusI)); }
focusHero(UI.cls);
heroes.forEach((h, i) => h.addEventListener('click', () => pickHero(i)));
let wantStart = -1;
function pickHero(i) {
  startAudio();
  focusHero(i);
  if (player.cls !== i) player.setClass(i);
  UI.cls = i;
  wantStart = i;
  // (on a PC the click that picks the hero also captures the mouse for looking around)
  if (!IS_TOUCH && world.readyAround(player.pos.x, player.pos.z, Math.min(64, view.viewDist)) >= 1) lockMouse();
  $('loadT').textContent = 'ALMOST THERE...';
}
function beginPlay() {
  UI.state = 'play';
  $('title').hidden = true; $('hud').hidden = false; $('touch').hidden = false;
  player.pitch = 0.55;
  player.yaw = player.face + Math.PI;
  hintT = 0;
  writeSave();
}
let menuAt = 0;
function openMenu() {
  if (UI.state !== 'play') return;
  menuAt = performance.now();
  unlockMouse();
  UI.state = 'menu'; $('menu').hidden = false; syncMenu();
  menuFocus = [...document.querySelectorAll('#menu button')].indexOf($('resume'));
  markMenuFocus();
}
function closeMenu() { UI.state = 'play'; $('menu').hidden = true; writeSave(); }
// the forge: opened from the menu; what it makes goes into the warrior's hand
// (from the title screen too, so you can forge before you pick a hero; closing returns where you came from)
let forgeFrom = 'menu';
$('forgeBtn').addEventListener('click', () => { forgeFrom = 'menu'; UI.state = 'forge'; $('menu').hidden = true; openForge(); });
$('forgeBtnTitle').addEventListener('click', () => { startAudio(); forgeFrom = 'title'; UI.state = 'forge'; $('title').hidden = true; openForge(); });
forge.onClose = () => { if (forgeFrom === 'title') { UI.state = 'title'; $('title').hidden = false; } else if (forgeFrom === 'play') { UI.state = 'play'; } else { UI.state = 'menu'; $('menu').hidden = false; syncMenu(); } };
// (wielding something made for another hero switches to that hero, so you see it in hand)
forge.onEquip = (spec, cls) => { player.equipForged(spec, cls); if (spec && player.cls !== cls) { player.setClass(cls); UI.cls = cls; abilities.reset(); focusHero(cls); } };
for (let c = 0; c < 3; c++) player.equipForged(equippedSpec(c), c);
$('menuBtn').addEventListener('click', openMenu);
$('resume').addEventListener('click', () => { closeMenu(); if (!IS_TOUCH) lockMouse(); });
// the mouse: captured by a click in the world while you play; letting it go (Esc) opens the menu
input.wantLock = () => UI.state === 'play' && !mouseLocked() && !input.cursorMode;
input.onLockChange = locked => { document.documentElement.classList.toggle('locked', locked); if (!locked && UI.state === 'play') openMenu(); };
function syncMenu() {
  const on = (seg, v) => [...$(seg).children].forEach(b => b.classList.toggle('on', +b.dataset.v === v));
  on('segHero', UI.cls); on('segQ', UI.autoQ ? -1 : UI.quality); on('segM', audioState.music > 0 ? 1 : 0); on('segS', audioState.sfx > 0 ? 1 : 0); on('segMouse', input.mouseSpeed); on('segCursor', input.cursorMode ? 1 : 0);
  const p = player.pos;
  $('where2').textContent = `${BIOME_NAME[biomeNow] || ''} · ${Math.round(p.x)}, ${Math.round(p.z)} · ${QUALITY[UI.quality].name} graphics`;
}
const seg = (id, f) => $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; f(+b.dataset.v); saveOpts(); syncMenu(); sfx('pickup'); });
seg('segHero', v => { if (v !== player.cls) { player.setClass(v); UI.cls = v; abilities.reset(); } });
seg('segQ', v => { if (v < 0) { UI.autoQ = true; } else { UI.autoQ = false; UI.quality = v; setQuality(v); } });
seg('segM', v => setMusic(v ? 0.45 : 0));
seg('segS', v => setSfx(v ? 0.8 : 0));
seg('segMouse', v => { input.mouseSpeed = v; });
seg('segCursor', v => { input.cursorMode = !!v; document.documentElement.classList.toggle('cursor', input.cursorMode); if (input.cursorMode) unlockMouse(); });
// (the menus by controller and keyboard: a focus that moves, ok presses it)
let menuFocus = 0;
function markMenuFocus() { const bs = [...document.querySelectorAll('#menu button')]; bs.forEach((b, i) => b.classList.toggle('focus', i === menuFocus && input.lastDevice !== 'touch')); }
function menuStep() {
  const ks = menuKeys();
  for (const k of ks) {
    if (UI.state === 'title') {
      if (k === 'left' || k === 'up') focusHero(focusI - 1);
      else if (k === 'right' || k === 'down') focusHero(focusI + 1);
      else if (k === 'ok') pickHero(focusI);
    } else if (UI.state === 'play') {
      if (k === 'pause') openMenu();
      else if (k === 'char') openSheet('char');
      else if (k === 'bags') openSheet('bags');
    } else if (UI.state === 'char') {
      if (k === 'pause' || k === 'back' || k === 'char' || k === 'bags') sheet.close();
    } else if (UI.state === 'forge') {
      if (k === 'pause' || k === 'back') closeForge();
    } else if (UI.state === 'loot') {
      if (k === 'pause' || k === 'back') closeLoot();
    } else if (UI.state === 'menu') {
      const bs = [...document.querySelectorAll('#menu button')];
      // (the Esc that let the mouse go has already opened this menu: it doesn't close it again)
      if ((k === 'pause' || k === 'back') && performance.now() - menuAt > 350) { closeMenu(); continue; }
      if (k === 'left' || k === 'up') menuFocus = (menuFocus - 1 + bs.length) % bs.length;
      else if (k === 'right' || k === 'down') menuFocus = (menuFocus + 1) % bs.length;
      else if (k === 'ok') bs[menuFocus].click();
      markMenuFocus();
    }
  }
  // (jump presses in a menu are not jumps)
  if (UI.state !== 'play') input.jumpEdge = false;
}

// ---------------------------------------------------------------- saving
function writeSave() {
  if (UI.state === 'title') return;
  const p = player.pos;
  ls.set(SAVE_KEY, JSON.stringify({ seed, cls: UI.cls, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +player.yaw.toFixed(3), t: +sky.t.toFixed(4), level: stats.level, xp: stats.xp, hp: stats.hp, kills: stats.kills }));
}
let saveT = 0;
addEventListener('pagehide', writeSave);
document.addEventListener('visibilitychange', () => { if (document.hidden) writeSave(); last = performance.now(); });

// ---------------------------------------------------------------- the loop
let last = performance.now(), fpsT = 0, fpsN = 0, slow = 0, frameMs = 0, worstMs = 0;
const dbgOn = Q.has('debug');
if (dbgOn) $('dbg').hidden = false;
const fwd = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.1) dt = 0.1;
  const t0 = performance.now();
  menuStep();
  input.lookOff = UI.state !== 'play';
  const inp = readInput();
  const look = takeLook();
  // the scroll wheel: nearer or farther
  if (input.zoom) { player.camDist = Math.max(8, Math.min(40, player.camDist + input.zoom * 2.4)); input.zoom = 0; }
  if (look[0] || look[1] || inp.lookRX) { if (!looked && UI.state === 'play') { looked = true; } }
  const p = player.pos;
  // the hero waits until the ground under it has arrived
  const ready = world.readyAround(p.x, p.z, 20) >= 1;
  if (ready && !placed) placed = settle();
  if (UI.state === 'title') {
    // the title: the camera circles the hero while the world builds
    player.yaw += dt * 0.12; player.pitch = 0.22;
    player.update(dt, inp, [0, 0], true);
    if (player.model) { player.animate(dt, 0); player.face = player.yaw + Math.PI * 0.85; }
    const prog = world.readyAround(p.x, p.z, Math.min(64, view.viewDist));
    // (the land's and the plants' shaders are built now, on the title screen, not as a hitch on the first step)
    if (!compiled && prog >= 0.6) { compiled = true; try { renderer.compile(scene, camera); } catch (e) { } }
    $('loadFill').style.width = Math.round(prog * 100) + '%';
    if (prog >= 1 && wantStart < 0) $('loadT').textContent = IS_TOUCH ? 'TAP A HERO TO BEGIN' : 'PICK A HERO TO BEGIN';
    if (wantStart >= 0 && placed && prog >= 0.9) { wantStart = -1; beginPlay(); }
  } else if (UI.state === 'play') {
    const wasGround = player.onGround, vy = player.vel.y;
    // (the hero moves in steps of a 60th of a second at most, so jumps come out the same at any frame rate)
    const n = Math.min(6, Math.ceil(dt * 60 - 0.01));
    for (let i = 0; i < n; i++) player.update(dt / n, inp, i ? [0, 0] : look, !ready || !placed);
    if (player.jumped && wasGround && !player.onGround) sfx('roll');
    heroCombat(dt, inp, !ready || !placed);
    if (deadT > 0 && (deadT -= dt) <= 0) respawn();
    if (!wasGround && player.onGround && vy < -18) sfx('slam');
    hintT += dt;
    $('hint').style.opacity = !looked && hintT > 2 && hintT < 14 ? 1 : 0;
    if ((saveT += dt) > 5) { saveT = 0; writeSave(); }
  } else {
    player.update(dt, { ...inp, mx: 0, my: 0, jump: false, sprint: false, lookRX: 0, lookRY: 0 }, [0, 0], true);
  }
  fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  world.update(p.x, p.z, fwd.x, fwd.z);
  AURA_VIEW.h = renderer.domElement.height;   // (the auras' particles size themselves to the render)
  if (UI.state === 'play') { monsters.update(dt); bolts.update(dt); }
  stepFx(dt);
  // the grass: the wind, and who walks through it
  grassUniforms.uTime.value = performance.now() / 1000;
  grassUniforms.uHero.value.copy(p);
  for (let i = 0; i < 4; i++) { const m = monsters.list[i]; if (m) grassUniforms.uMon.value[i].copy(m.pos); else grassUniforms.uMon.value[i].set(0, -999, 0); }
  world.setGrass(QUALITY[UI.quality].grass, QUALITY[UI.quality].grassRange);
  // the world's sounds
  if (audioState.started) updateAmbience(dt, sky.day, biomeNow < 0 ? 0 : biomeNow, world.poly ? (world.seaAt(p.x + 6, p.z) || world.seaAt(p.x - 6, p.z) || world.seaAt(p.x, p.z + 6) || world.seaAt(p.x, p.z - 6)) : false, Math.hypot(player.vel.x, player.vel.z), UI.state === 'play');
  updateSky(dt, p);
  player.dayLight(0.25 + 0.75 * sky.day);
  if (UI.state !== 'title') updateHud(dt);
  frameMs = performance.now() - t0;
  render();
  adapt(dt, performance.now() - t0);
  if (dbgOn && (fpsN % 10 === 0)) {
    const c = world.counts(), i = renderer.info.render;
    $('dbg').textContent = `fps ${fps.toFixed(0)}  js ${frameMs.toFixed(1)}ms  worst ${worstMs.toFixed(0)}ms\nchunks ${c.ready} (+${c.pending}) tris ${(i.triangles / 1000).toFixed(0)}k calls ${i.calls}\n${QUALITY[UI.quality].name} view ${view.viewDist} pr ${renderer.getPixelRatio().toFixed(2)} workers ${world.stats.workers}\n${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  ${clock()}`;
  }
}
// adaptive quality: step down when the frame rate stays low (only if the player has not picked)
let fps = 60, worstWindow = 0;
function adapt(dt, ms) {
  fpsT += dt; fpsN++;
  worstWindow = Math.max(worstWindow, ms);
  if (fpsT < 2) return;
  fps = fpsN / fpsT; worstMs = worstWindow;
  fpsT = 0; fpsN = 0; worstWindow = 0;
  if (!UI.autoQ || document.hidden || UI.state !== 'play') return;
  if (fps < 40) slow++; else slow = 0;
  if (slow >= 2 && UI.quality > 0) { UI.quality--; setQuality(UI.quality); slow = 0; }
}

// ---------------------------------------------------------------- start
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 200));
initTouch($('gl'));
$('ver').textContent = VERSION;
onFirstInput(startAudio);
resize();
requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
document.getElementById('boot')?.remove();

// a hook for testing
window.__dw = {
  world, player, sky, UI, input, view, renderer, scene, camera, THREE, monsters, bolts, hero: stats, abilities, forge, bodies, openLoot, closeLoot, sheet, openSheet,
  start(cls = 0) { pickHero(cls); },
  teleport(x, z) { player.place(x + 0.5, 90, z + 0.5); placed = false; },
  setQuality(q) { UI.autoQ = false; UI.quality = q; setQuality(q); },
  stats() { const c = world.counts(); return { ...c, ...world.stats, fps, frameMs, worstMs, state: UI.state, placed, pos: player.pos.toArray(), onGround: player.onGround, tris: renderer.info.render.triangles, calls: renderer.info.render.calls, quality: UI.quality, biome: biomeNow, monsters: monsters.list.length, hp: stats.hp, level: stats.level, kills: stats.kills }; },
};
