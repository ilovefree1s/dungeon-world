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
import { loadKay } from './kayhero.js';
import { Camps } from './camps.js';
import { Castles } from './castles.js';
import { Abilities, KITS, meleeReach } from './abilities.js';
import { forge, openForge, closeForge, equippedSpec, takeLoot } from './forge.js';
import { Bodies, rollLoot, bestRarity } from './loot.js';
import { classArmor, inv, loadInv, addItem, addGold, equipItem, gearTotals, armorCut, GLYPH_ITEM, SLOT_NAME } from './inventory.js';
import { randomSpec, statsOf, plainStats, dpsOf, hitOf, RARITIES, setLevelSource } from './weaponkit.js';
import { Turntable } from './turntable.js';
import { AURA_VIEW } from './auras.js';
import { VERSION } from './version.js';
import { CharSheet } from './charsheet.js';
import { Pet } from './pet.js';
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
// the hunter's KayKit ranger: loaded in the background, swapped in when it's ready
loadKay().then(() => { if (player.cls >= 0) { const f = player.face; player.setClass(2); player.face = f; } }).catch(e => console.warn('the ranger did not load', e));
let start = save && save.seed === seed ? [save.x, save.y, save.z] : world.spawnPoint();
player.place(...start);
if (save && save.seed === seed) { player.yaw = save.yaw ?? player.yaw; sky.t = save.t ?? sky.t; }
// three heroes, each with a level, XP, health and kills of their own (a save from before they were kept apart is the hunter's)
const heroSaves = save && save.heroes ? save.heroes : save && save.level ? { 2: { level: save.level, xp: save.xp || 0, hp: save.hp, kills: save.kills || 0 } } : {};
let heroCls = -1;
function stashHero() { if (heroCls >= 0) heroSaves[heroCls] = { level: stats.level, xp: stats.xp, hp: stats.hp, kills: stats.kills }; }
function loadHeroStats(cls) {
  const h = heroSaves[cls] || { level: 1, xp: 0, kills: 0 };
  stats.level = h.level || 1; stats.xp = h.xp || 0; stats.kills = h.kills || 0;
  stats.maxHp = 30 + (stats.level - 1) * 6; stats.hp = Math.min(stats.maxHp, h.hp || stats.maxHp);
}
loadHeroStats(UI.cls);
const spawn = start.slice();

// ---------------------------------------------------------------- combat
const monsters = new Monsters(world, player);
const bolts = new Bolts(world, monsters);
monsters.hooks.hurt = () => player.onHurt();
monsters.hooks.level = lv => { sfx('levelup'); ring(player.pos.x, player.pos.y + 0.1, player.pos.z, '#ffe08a', 1, 10, 0.7); burst(player.pos.x, player.pos.y + 3, player.pos.z, '#ffe9a0', 20, 10, 1.6, true, 0.8); banner('LEVEL ' + lv, 'stronger, and all healed up'); };
let deadT = 0;
monsters.hooks.dead = () => { sfx('death'); deadT = 2.6; banner('YOU FELL', 'back to the woods...'); player.invT = 9; if (player.model.userData.fade) player.model.userData.fade(0.4); };
const TAB_RANGE = 45, tabSeen = new Set();
function tabTarget() {
  const near = monsters.list.filter(m => m.hp > 0 && m.pos.distanceTo(player.pos) <= TAB_RANGE).sort((a, b) => a.pos.distanceTo(player.pos) - b.pos.distanceTo(player.pos));
  if (!near.length) { sayError('No enemies in range'); return; }
  const f = monsters.focus;
  if (!f || !near.includes(f)) tabSeen.clear();
  if (f) tabSeen.add(f);
  for (const m of [...tabSeen]) if (!near.includes(m)) tabSeen.delete(m);
  let next = !f || !near.includes(f) ? near[0] : near.find(m => !tabSeen.has(m));
  if (!next) { tabSeen.clear(); tabSeen.add(f); next = near.find(m => m !== f) || f; }
  monsters.focus = next;
}
const pet = new Pet(player, world, monsters);
const ctx = { player, world, monsters, bolts, pet, say: (m, c) => sayError(m, c), shake: k => { player.shake = Math.max(player.shake || 0, k); } };
const abilities = new Abilities(ctx);
// the red line at the top of the screen, the MMO way, for what you can't do right now (shown at most once a second or so)
let errT = 0, errLast = '', errAt = 0;
function sayError(msg, color) { const now = performance.now(); if (msg === errLast && now - errAt < 1400) return; errLast = msg; errAt = now; $('err').textContent = msg; $('err').style.color = color || ''; $('err').classList.add('on'); errT = 1.6; if (!color) sfx('nope'); }
// the cursors in play: a sword (its point is the hot spot), a red one over a monster, a loot bag over a fallen one with a drop
const svgCursor = (svg, x, y, fallback) => `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${x} ${y}, ${fallback}`;
const swordSvg = (blade, edge, glow) => `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>${glow ? `<path d='M2 2 L6 3 L21 18 L18 21 L3 6 Z' fill='none' stroke='${glow}' stroke-width='4' stroke-linejoin='round' opacity='.55'/>` : ''}<path d='M2 2 L6 3 L21 18 L18 21 L3 6 Z' fill='${blade}' stroke='#1a1210' stroke-width='1.4' stroke-linejoin='round'/><path d='M3 3 L20 20' stroke='${edge}' stroke-width='1' opacity='.8'/><path d='M15 23 L23 15 L25 17 L17 25 Z' fill='#c8962c' stroke='#1a1210' stroke-width='1.3' stroke-linejoin='round'/><path d='M21 21 L27 27' stroke='#5a3a22' stroke-width='3.4' stroke-linecap='round'/><path d='M21 21 L27 27' stroke='#1a1210' stroke-width='5' stroke-linecap='round' opacity='.35'/><circle cx='28' cy='28' r='2.4' fill='#ffd45a' stroke='#1a1210' stroke-width='1.2'/></svg>`;
const bagSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M10 9 Q16 4 22 9' fill='none' stroke='#1a1210' stroke-width='2.6'/><path d='M10 9 Q16 5 22 9' fill='none' stroke='#c8962c' stroke-width='1.4'/><path d='M8 11 Q4 26 16 29 Q28 26 24 11 Z' fill='#8a5a2e' stroke='#1a1210' stroke-width='1.5' stroke-linejoin='round'/><path d='M9 12 L23 12' stroke='#ffd45a' stroke-width='2'/><circle cx='16' cy='21' r='3.2' fill='#ffd45a' stroke='#1a1210' stroke-width='1.1'/></svg>`;
const CURSOR = { idle: svgCursor(swordSvg('#dfe6ee', '#ffffff', null), 1, 1, 'default'), foe: svgCursor(swordSvg('#ff8a7a', '#ffe0d8', '#ff3020'), 1, 1, 'crosshair'), loot: svgCursor(bagSvg, 16, 16, 'pointer') };
// a weapon with no item level of its own (a forged one) is at your level; worn armor turns blows aside and its
// stamina adds health (two a point)
setLevelSource(() => stats.level);
// (each hero's own armor, before any worn: the warrior's plate turns aside about 45% of a blow, the hunter's leather
// about 20%, the mage's robes nothing)
monsters.hooks.armor = () => armorCut(gearTotals().armor + classArmor(player.cls, stats.level), stats.level);
// a shield block takes most of a blow; an ice barrier soaks blows until it's spent
monsters.hooks.absorb = dmg => { const B = player.buffs || {}; if (B.block) dmg = Math.round(dmg * 0.3); if (B.absorb) { const t = Math.min(B.absorb.left, dmg); B.absorb.left -= t; dmg -= t; } return dmg; };
let gearHp = 0;
// switching heroes: the one leaving keeps its level and bags; the one arriving brings theirs
function swapHero(cls) {
  if (cls === heroCls) return;
  stashHero(); heroCls = cls;
  loadHeroStats(cls); loadInv(cls); gearHp = 0; applyGearHp();
  monsters.focus = null; input.autoAtk = false;
}
{ const setClass = player.setClass.bind(player); player.setClass = c => { swapHero(c); return setClass(c); }; }
function applyGearHp() { const want = gearTotals().stam * 2; stats.maxHp += want - gearHp; gearHp = want; stats.hp = Math.min(stats.hp, stats.maxHp); }
inv.onGear = () => applyGearHp();
swapHero(player.cls);
// the fallen: bodies stay a while, some with a weapon on them
const bodies = new Bodies(player);
monsters.hooks.fallen = m => { camps.fell(m); castles.fell(m); return bodies.fall(m, castles.boost(m, rollLoot(m, player.cls))); };
// goblin and bandit camps about the world
const camps = new Camps(world, monsters, player, bodies, m => rollLoot(m, player.cls));
camps.onCleared = (c, name) => { banner(name + ' CLEARED', 'they left a chest by the fire'); sfx('legend'); };
// castles and forts, in every land
const castles = new Castles(world, monsters, player, bodies, m => rollLoot(m, player.cls));
castles.onCleared = (c, name) => { banner(name + ' CLEARED', 'a chest waits by the fire'); sfx('legend'); };
castles.onEnter = (name, sub) => banner(name, sub);
let lootBody = null;
// the loot window, the MMO way: a small frame by the body with a square for each thing it carried. hover a square
// to see what it is (against what you have), click to take it, shift-click to take and wear or wield it
function lootEntries(b) {
  const L = b.loot, out = [];
  if (L.weapon) out.push({ kind: 'weapon', it: L.weapon });
  for (const it of L.items) out.push({ kind: it.kind, it });
  if (L.gold) out.push({ kind: 'gold', it: { name: `${L.gold} GOLD`, rarity: 'common' } });
  return out;
}
const WEAPON_GLYPH = ['⚔', '🪄', '🏹'];
const glyphOf = e => e.kind === 'weapon' ? WEAPON_GLYPH[bodies.describe(e.it).cls] : e.kind === 'gold' ? '🪙' : GLYPH_ITEM[e.kind === 'armor' ? e.it.slot : 'potion'];
const rarityOfIt = it => RARITIES.find(r => r.id === it.rarity) || RARITIES[0];
// is it better than what's worn (for the little green arrow)
function isUpgrade(e) {
  if (e.kind === 'armor') { const cur = inv.equipped[e.it.slot]; return !cur || e.it.armor + e.it.stam * 2 > cur.armor + cur.stam * 2; }
  if (e.kind === 'weapon') { const d = bodies.describe(e.it); if (d.cls !== player.cls) return false; const have = equippedSpec(d.cls), cur = have ? statsOf(have) : plainStats(d.cls); return dpsOf(d.stats, d.cls, stats.level) > dpsOf(cur, d.cls, stats.level); }
  return false;
}
function tipFor(e) {
  const it = e.it, rr = rarityOfIt(it);
  const row = (label, a, bb, post = '', lessIsBetter = false) => { const dlt = +(a - bb).toFixed(2), good = lessIsBetter ? -dlt : dlt; const col = good > 0 ? '#5ce65c' : good < 0 ? '#ff6a55' : 'var(--dim)'; return `<div>${label} <b>${a}${post}</b> <span style="color:${col}">${good > 0 ? '▲' : good < 0 ? '▼' : '='} ${dlt > 0 ? '+' : ''}${dlt || ''}</span></div>`; };
  let h = `<div class="tn" style="color:${rr.color}">${it.name}</div>`;
  if (e.kind === 'gold') return h + '<div class="tl">Coin of the realm</div><div class="th">CLICK TO TAKE</div>';
  h += `<div class="tr" style="color:${rr.color}">${rr.name} · ITEM LEVEL ${it.ilvl || stats.level}</div>`;
  if (e.kind === 'weapon') {
    const d = bodies.describe(it), have = equippedSpec(d.cls), cur = have ? statsOf(have) : plainStats(d.cls);
    h += `<div class="tl">${d.line}</div>` + row('DPS', dpsOf(d.stats, d.cls, stats.level), dpsOf(cur, d.cls, stats.level)) + row('HIT', Math.round(hitOf(d.stats, d.cls, stats.level)), Math.round(hitOf(cur, d.cls, stats.level))) + row(d.cls === 0 ? 'SWING' : 'SHOT', d.stats.time, cur.time, 's', true);
    if (d.stats.aura && d.stats.aura !== 'none') h += `<div style="color:#b48cff">${d.stats.aura.toUpperCase()} AURA</div>`;
    h += `<div class="th">${d.cls !== player.cls ? 'FOR THE ' + ['WARRIOR', 'MAGE', 'HUNTER'][d.cls] + ' · ' : ''}CLICK TO TAKE · SHIFT-CLICK TO WIELD</div>`;
  } else if (e.kind === 'armor') {
    const cur = inv.equipped[it.slot] || { armor: 0, stam: 0 };
    h += `<div class="tl">${SLOT_NAME[it.slot]} ARMOR</div>` + row('ARMOR', it.armor, cur.armor) + row('STAMINA', it.stam, cur.stam) + `<div class="th">CLICK TO TAKE · SHIFT-CLICK TO EQUIP</div>`;
  } else if (e.kind === 'potion') h += `<div class="tl">Heals ${Math.round(it.heal * 100)}% of your health</div><div class="th">CLICK TO TAKE</div>`;
  return h;
}
function placeBox(x, y) {
  const box = $('lootBox'), w = 236, h = box.offsetHeight || 140;
  box.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 24)) + 'px';
  box.style.top = Math.max(60, Math.min(innerHeight - h - 90, y - 30)) + 'px';
}
function openLoot(b) {
  lootBody = b;
  if (!input.cursorMode) unlockMouse();
  $('lootBox').hidden = false;
  const best = bestRarity(b.loot);
  sfx(best.id === 'legendary' ? 'legend' : best.id === 'common' ? 'pickup' : 'rare');
  showLoot();
  // (by the cursor when there is one, else left of the middle of the screen)
  if (input.cursor && input.cursor.in) placeBox(input.cursor.x, input.cursor.y); else placeBox(innerWidth * 0.18, innerHeight * 0.32);
}
function showLoot() {
  const b = lootBody; if (!b) return;
  const E = lootEntries(b);
  if (!E.length) { closeLoot(); return; }
  const best = bestRarity(b.loot);
  $('lootT').textContent = b.name || 'LOOT';
  $('lootBox').style.boxShadow = `inset 0 0 0 1px ${best.id === 'common' ? 'var(--line)' : best.color}, 0 10px 30px rgba(0,0,0,.5)`;
  $('lootList').innerHTML = '';
  E.forEach(e => {
    const el = document.createElement('button'); el.type = 'button';
    el.style.setProperty('--rc', rarityOfIt(e.it).color);
    el.innerHTML = glyphOf(e) + (e.kind === 'gold' ? `<i>${b.loot.gold}</i>` : e.it.count > 1 ? `<i>${e.it.count}</i>` : '');
    if (isUpgrade(e)) el.classList.add('up');
    el.addEventListener('mouseenter', () => { const t = $('lootTip'); t.innerHTML = tipFor(e); t.style.setProperty('--rc', rarityOfIt(e.it).color); t.hidden = false; const r = el.getBoundingClientRect(); t.style.left = Math.min(innerWidth - 250, r.right + 10) + 'px'; t.style.top = Math.max(8, Math.min(innerHeight - t.offsetHeight - 8, r.top - 6)) + 'px'; });
    el.addEventListener('mouseleave', () => { $('lootTip').hidden = true; });
    el.addEventListener('pointerdown', ev => { el._touch = ev.pointerType !== 'mouse'; });
    el.addEventListener('click', ev => { if (!lootBody) return;
      // (on a touch screen the first tap shows what it is, the second takes it)
      if (el._touch && !el._armed) { for (const o of $('lootList').children) o._armed = false; el._armed = true; el.dispatchEvent(new Event('mouseenter')); $('lootTip').innerHTML += '<div class="th" style="color:var(--gold)">TAP AGAIN TO TAKE</div>'; return; } const use = ev.shiftKey && (e.kind === 'weapon' || e.kind === 'armor'); if (takeOne(e, use)) { bodies.took(lootBody); sfx(use ? 'rare' : 'pickup'); $('lootTip').hidden = true; showLoot(); } });
    $('lootList').appendChild(el);
  });
  $('lootAll').hidden = E.length < 2;
}
// take one thing off the body (wear/wield it if asked); false if there was no room
function takeOne(e, use) {
  const L = lootBody.loot;
  if (e.kind === 'weapon') { takeLoot(e.it, use); L.weapon = null; }
  else if (e.kind === 'gold') { addGold(L.gold); L.gold = 0; sfx('coin'); }
  else { if (!addItem(e.it)) { sayError('YOUR BAGS ARE FULL'); return false; } L.items.splice(L.items.indexOf(e.it), 1); if (use && e.kind === 'armor') equipItem(e.it.id); }
  return true;
}
// the character sheet and the bags (C and B, or the buttons by the menu's)
const sheet = new CharSheet(player);
function openSheet(tab) { if (UI.state !== 'play') return; unlockMouse(); UI.state = 'char'; sheet.show(tab); }
sheet.onClose = () => { if (UI.state === 'char') UI.state = 'play'; };
sheet.onForge = () => { sheet.close(); forgeFrom = 'play'; UI.state = 'forge'; openForge(); };
$('charBtn').addEventListener('click', () => openSheet('char'));
$('bagsBtn').addEventListener('click', () => openSheet('bags'));
function closeLoot() { $('lootBox').hidden = true; $('lootTip').hidden = true; lootBody = null; }
$('lootAll').addEventListener('click', () => { if (!lootBody) return; for (const e of lootEntries(lootBody)) if (!takeOne(e, false)) break; bodies.took(lootBody); sfx('pickup'); showLoot(); });
$('lootLeave').addEventListener('click', () => { sfx('nope'); closeLoot(); });
function heroCombat(dt, inp, frozen) {
  ctx.frozen = frozen;
  // (walk away from the body and its loot window closes)
  if (lootBody && (lootBody.pos.distanceTo(player.pos) > 20 || !bodies.list.includes(lootBody))) closeLoot();
  // a body in your sights: a click or F looks at what it dropped instead of swinging
  bodies.update(dt, monsters.list.some(m => m.state === 'chase' && m.pos.distanceTo(player.pos) < 16));
  const nearB = lootBody ? null : bodies.nearest();
  $('lootHint').hidden = !nearB;
  if (nearB) { const t = IS_TOUCH ? 'IT DROPPED SOMETHING · TAP HERE TO LOOT' : 'IT DROPPED SOMETHING · CLICK IT OR PRESS F'; if ($('lootHint').textContent !== t) $('lootHint').textContent = t; }
  if (inp.useEdge && !lootBody && nearB) { inp.useEdge = false; openLoot(nearB); return; }
  // TAB: the nearest enemy; pressed again, the next one in range not yet picked, round and round
  if (inp.tabEdge) { inp.tabEdge = false; tabTarget(); }
  if (!input.cursorMode && bodies.target && (inp.atkEdge || inp.useEdge)) { inp.atkEdge = false; inp.useEdge = false; openLoot(bodies.target); return; }
  if (input.cursorMode) {
    const gl = $('gl'), w = gl.clientWidth, h = gl.clientHeight;
    // the right button turns the hero with the camera
    if (inp.turnWith) { player.aimFace = player.yaw + Math.PI; inp.turnWith = false; }
    // what's under the cursor shapes it: a sword over a monster, a hand over loot
    if (inp.dragging && document.pointerLockElement) gl.style.cursor = 'none';   // (looking around: no cursor in the way)
    else if (inp.cursor.in) { const m = pickMonster(monsters, inp.cursor.x, inp.cursor.y, w, h); const b = m ? null : bodies.pickAt(inp.cursor.x, inp.cursor.y, w, h); gl.style.cursor = m ? CURSOR.foe : b ? CURSOR.loot : CURSOR.idle; }
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
      // (on a fallen one with loot, the right click opens it too)
      const lb = m ? null : bodies.pickAt(c.x, c.y, w, h);
      if (lb) { openLoot(lb); return; }
      if (m && m !== monsters.focus) { monsters.focus = m; inp.autoAtk = true; }
      else if (monsters.focus) inp.autoAtk = !inp.autoAtk;
      else inp.atkEdge = true;
    }
    // auto-attack ends with its target
    if (inp.autoAtk && !monsters.focus) inp.autoAtk = false;
    player.aiming = inp.autoAtk && !!monsters.focus;
    // and it only swings when the target is in range (else it waits, and says so now and then); in range, every
    // class turns to face it as the swing timer comes up and strikes (the swing and the shot aim at the target)
    if (inp.autoAtk && !inp.atkHeld) {
      const m = monsters.focus, p = player.pos, d = Math.hypot(m.pos.x - p.x, m.pos.z - p.z);
      const reach = player.cls === 0 ? meleeReach(player) + m.k.r : 42;
      if (d > reach) { inp.atk = false; if (abilities.atkCd <= 0) sayError('OUT OF RANGE'); }
      else player.aimFace = Math.atan2(m.pos.x - p.x, m.pos.z - p.z);
    }
  }
  inp.useEdge = false;
  abilities.update(dt, inp);
}
function respawn() {
  setTimeout(() => pet.recall(), 50);
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
// what each skill does, for the tooltip over its button
const ABIL_DESC = {
  CHARGE: 'Dash forward, striking every enemy in your path.', WHIRL: 'Spin with your weapon, hitting every enemy around you.', SLAM: 'Leap and slam the ground, damaging and knocking back enemies nearby.',
  HEROIC: 'Your next swing (within 8 seconds) hits for 2.4 times the damage.', REND: 'A wounding strike that makes your target bleed for 6 seconds.', THROW: 'Hurl an axe at a distant target.',
  BLOCK: 'Raise your shield: take far less damage for 5 seconds.', SHOUT: 'A battle cry: deal 25% more damage for 12 seconds.', '2ND WIND': 'Recover 5% of your health every second for 8 seconds.',
  BLINK: 'Teleport a short way forward.', NOVA: 'A burst of frost that damages and freezes enemies around you.', METEOR: 'Call down a meteor that crashes into the ground ahead.',
  FIREBALL: 'A heavy ball of fire at your target.', MISSILES: 'Five arcane missiles in quick succession.', 'ICE LANCE': 'A fast shard of ice; deals much more to frozen enemies.',
  CHAIN: 'Lightning that leaps from enemy to enemy.', POLYMORPH: 'Turn your target into a harmless sheep for 8 seconds.', BARRIER: 'A shield that absorbs damage equal to 35% of your health.',
  ROLL: 'Roll quickly out of harm’s way.', MULTI: 'Loose a fan of arrows at the enemies in front of you.', RAIN: 'A rain of arrows over an area.',
  AIMED: 'A slow, carefully aimed shot that hits very hard.', STING: 'A poisoned arrow that deals damage over 8 seconds.', CONCUSS: 'An arrow that dazes the target and slows it for 6 seconds.',
  'RAPID FIRE': 'Shoot 60% faster for 10 seconds.', TAME: 'Tame a beast to fight at your side as your pet.', WRATH: 'Your pet hits much harder for 10 seconds.',
};
abSlots.forEach((el, i) => {
  const show = () => {
    const sl = abilities.slots()[i]; if (!sl) return;
    const t = $('abTip');
    t.innerHTML = `<div class="tn" style="color:var(--gold)">${sl.name}</div><div class="tr" style="color:var(--dim)">KEY ${i + 1} · COOLDOWN ${sl.cd}s${sl.left > 0 ? ' · READY IN ' + Math.ceil(sl.left * sl.cd) + 's' : ''}</div><div>${ABIL_DESC[sl.name] || ''}</div>`;
    t.hidden = false;
    const r = el.getBoundingClientRect(), w = t.offsetWidth, h = t.offsetHeight;
    t.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    t.style.top = Math.max(8, r.top - h - 10) + 'px';
  };
  el.addEventListener('mouseenter', e => { if (!IS_TOUCH) show(); });
  el.addEventListener('mouseleave', () => { $('abTip').hidden = true; });
  // (touch: hold a skill for half a second to read it)
  let hold = 0;
  el.addEventListener('touchstart', () => { clearTimeout(hold); hold = setTimeout(show, 500); }, { passive: true });
  for (const ev of ['touchend', 'touchcancel']) el.addEventListener(ev, () => { clearTimeout(hold); setTimeout(() => { $('abTip').hidden = true; }, 1200); }, { passive: true });
});
$('lootHint').addEventListener('click', () => { const b = bodies.nearest(); if (b && UI.state === 'play') openLoot(b); });
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
  $('xpfill').style.width = (stats.xp / xpToNext() * 100) + '%'; $('lvT').textContent = 'LV ' + stats.level; $('pName').textContent = ['WARRIOR', 'MAGE', 'HUNTER'][player.cls];
  if (errT > 0 && (errT -= dt) <= 0) $('err').classList.remove('on');
  // the target's frame: the focused monster's name, level and health, lit AUTO while auto-attacking
  { const P = pet.p, show = !!P && player.cls === 2; $('petframe').hidden = !show;
    if (show) { $('petName').textContent = P.name.toUpperCase(); $('petState').textContent = P.down > 0 ? `DOWN ${Math.ceil(P.down)}s` : ''; $('pethpfill').style.width = (P.hp / P.maxHp * 100) + '%'; $('pethpT').textContent = `${Math.ceil(P.hp)}/${P.maxHp}`; } }
  { const m = monsters.focus; $('tframe').hidden = !m; if (m) { $('tName').textContent = m.name; $('tLv').textContent = 'LV ' + m.lvl; $('thpfill').style.width = Math.max(0, m.hp / m.maxHp * 100) + '%'; $('thpT').textContent = `${Math.max(0, Math.ceil(m.hp))}/${m.maxHp}`; $('tAuto').hidden = !input.autoAtk; } }
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
// (the cursor scheme locks the pointer only while you drag the camera: letting go isn't a reason for the menu)
input.onLockChange = locked => { document.documentElement.classList.toggle('locked', locked && !input.cursorMode); if (!locked && UI.state === 'play' && !input.cursorMode) openMenu(); };
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
      if (k === 'pause' && lootBody) closeLoot();
      else if (k === 'pause') openMenu();
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
  ls.set(SAVE_KEY, JSON.stringify({ seed, cls: UI.cls, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +player.yaw.toFixed(3), t: +sky.t.toFixed(4), level: stats.level, xp: stats.xp, hp: stats.hp, kills: stats.kills, heroes: (stashHero(), heroSaves) }));
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
  if (UI.state === 'play') { monsters.update(dt); bolts.update(dt); pet.update(dt, input.autoAtk); camps.update(dt); castles.update(dt); }
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
  world, player, sky, UI, input, view, renderer, scene, camera, THREE, monsters, bolts, hero: stats, abilities, forge, randomSpec, camps, castles, bodies, openLoot, closeLoot, sheet, openSheet, pet,
  start(cls = 0) { pickHero(cls); },
  teleport(x, z) { player.place(x + 0.5, 90, z + 0.5); placed = false; },
  setQuality(q) { UI.autoQ = false; UI.quality = q; setQuality(q); },
  stats() { const c = world.counts(); return { ...c, ...world.stats, fps, frameMs, worstMs, state: UI.state, placed, pos: player.pos.toArray(), onGround: player.onGround, tris: renderer.info.render.triangles, calls: renderer.info.render.calls, quality: UI.quality, biome: biomeNow, monsters: monsters.list.length, hp: stats.hp, level: stats.level, kills: stats.kills }; },
};
