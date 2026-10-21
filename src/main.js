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
import { Monsters, Bolts, stats, xpToNext } from './combat.js';
import { Abilities, KITS } from './abilities.js';
import { forge, openForge, closeForge, equippedSpec } from './forge.js';
import { burst, ring, stepFx } from './fx.js';

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
setSfx(audioState.sfx);
function saveOpts() { ls.set(OPT_KEY, JSON.stringify({ quality: UI.autoQ ? -1 : UI.quality, music: audioState.music, sfx: audioState.sfx, mouse: input.mouseSpeed })); }
setQuality(UI.quality);

// ---------------------------------------------------------------- the world and the hero
const seed = Q.has('seed') ? (+Q.get('seed') || 1) : save ? save.seed : 1;
const world = new World(seed, Q.has('flat'));
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
function heroCombat(dt, inp, frozen) {
  ctx.frozen = frozen;
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
let hintT = 0, looked = false;

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
  player.pitch = 0.3;
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
$('forgeBtn').addEventListener('click', () => { UI.state = 'forge'; $('menu').hidden = true; openForge(); });
forge.onClose = () => { UI.state = 'menu'; $('menu').hidden = false; syncMenu(); };
// (wielding something made for another hero switches to that hero, so you see it in hand)
forge.onEquip = (spec, cls) => { player.equipForged(spec, cls); if (spec && player.cls !== cls) { player.setClass(cls); UI.cls = cls; abilities.reset(); } };
for (let c = 0; c < 3; c++) player.equipForged(equippedSpec(c), c);
$('menuBtn').addEventListener('click', openMenu);
$('resume').addEventListener('click', () => { closeMenu(); if (!IS_TOUCH) lockMouse(); });
// the mouse: captured by a click in the world while you play; letting it go (Esc) opens the menu
input.wantLock = () => UI.state === 'play' && !mouseLocked();
input.onLockChange = locked => { document.documentElement.classList.toggle('locked', locked); if (!locked && UI.state === 'play') openMenu(); };
function syncMenu() {
  const on = (seg, v) => [...$(seg).children].forEach(b => b.classList.toggle('on', +b.dataset.v === v));
  on('segHero', UI.cls); on('segQ', UI.autoQ ? -1 : UI.quality); on('segM', audioState.music > 0 ? 1 : 0); on('segS', audioState.sfx > 0 ? 1 : 0); on('segMouse', input.mouseSpeed);
  const p = player.pos;
  $('where2').textContent = `${BIOME_NAME[biomeNow] || ''} · ${Math.round(p.x)}, ${Math.round(p.z)} · ${QUALITY[UI.quality].name} graphics`;
}
const seg = (id, f) => $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; f(+b.dataset.v); saveOpts(); syncMenu(); sfx('pickup'); });
seg('segHero', v => { if (v !== player.cls) { player.setClass(v); UI.cls = v; abilities.reset(); } });
seg('segQ', v => { if (v < 0) { UI.autoQ = true; } else { UI.autoQ = false; UI.quality = v; setQuality(v); } });
seg('segM', v => setMusic(v ? 0.45 : 0));
seg('segS', v => setSfx(v ? 0.8 : 0));
seg('segMouse', v => { input.mouseSpeed = v; });
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
    } else if (UI.state === 'forge') {
      if (k === 'pause' || k === 'back') closeForge();
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
  if (UI.state === 'play') { monsters.update(dt); bolts.update(dt); }
  stepFx(dt);
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
onFirstInput(startAudio);
resize();
requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
document.getElementById('boot')?.remove();

// a hook for testing
window.__dw = {
  world, player, sky, UI, input, view, renderer, scene, THREE, monsters, bolts, hero: stats, abilities,
  start(cls = 0) { pickHero(cls); },
  teleport(x, z) { player.place(x + 0.5, 90, z + 0.5); placed = false; },
  setQuality(q) { UI.autoQ = false; UI.quality = q; setQuality(q); },
  stats() { const c = world.counts(); return { ...c, ...world.stats, fps, frameMs, worstMs, state: UI.state, placed, pos: player.pos.toArray(), onGround: player.onGround, tris: renderer.info.render.triangles, calls: renderer.info.render.calls, quality: UI.quality, biome: biomeNow, monsters: monsters.list.length, hp: stats.hp, level: stats.level, kills: stats.kills }; },
};
