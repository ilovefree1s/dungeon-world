// ============================================================================
//  DUNGEON WORLD  -  the hunter in the game: KayKit's ranger (Kay Lousberg,
//  www.kaylousberg.com, CC0) with KayKit's animations: idle with the bow, walk,
//  run holding the bow, a dodge for the roll, a jump, the bow drawn and loosed
//  for each shot (straight up for the rain of arrows), an aiming stance while
//  auto-attacking. Longer, sturdier legs than the pack's own (set in the
//  hunter builder). The models come from assets/kaykit (fetched beside
//  index.html, or packed into the one-file build as window.__KAY).
// ============================================================================
import { THREE } from './engine.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { makeFlashable } from './dh/models.js';

const V3 = THREE.Vector3;
const FILES = ['Ranger.glb', 'Knight.glb', 'Rig_Medium_General.glb', 'Rig_Medium_MovementBasic.glb', 'Rig_Medium_MovementAdvanced.glb', 'Rig_Medium_CombatRanged.glb', 'Rig_Medium_CombatMelee.glb', 'bow_withString.glb', 'arrow_bow.glb', 'sword_1handed.glb', 'shield_badge_color.glb', 'Mage.glb', 'staff.glb', 'Rig_Medium_Special.glb', 'Skeleton_Minion.glb', 'Skeleton_Warrior.glb', 'Skeleton_Rogue.glb', 'Skeleton_Mage.glb', 'Skeleton_Blade.glb', 'Skeleton_Axe.glb', 'Skeleton_Staff.glb', 'Skeleton_Shield_Small_A.glb', 'Skeleton_Crossbow.glb', 'Basic_Goblin.glb', 'Goblin_Warrior.glb', 'Goblin_Archer.glb', 'Goblin_Rusty_Shiv.glb', 'Goblin_Notched_Shortsword.glb', 'Goblin_Recurve_Shortbow.glb', 'Bandit_Thug.glb', 'Bandit_Scavenger.glb', 'Bandit_Poacher.glb', 'Bandit_Spiked_Club.glb', 'Bandit_Broken_Bottle.glb', 'Bandit_Crossbow.glb'];
export const SHAPE = { leg: 1.5, thick: 1.19, head: 0.7 };
async function bytes(name) {
  const packed = window.__KAY && window.__KAY[name];
  if (packed) { const s = atob(packed), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b.buffer; }
  const r = await fetch('assets/kaykit/' + name); if (!r.ok) throw new Error('could not load ' + name); return r.arrayBuffer();
}
// (with no createImageBitmap the loader reads a model's pictures through an <img>: nothing else is fetched)
const parse = buf => new Promise((ok, no) => { const cib = self.createImageBitmap; try { self.createImageBitmap = undefined; } catch (e) { } new GLTFLoader().parse(buf, '', ok, no); try { self.createImageBitmap = cib; } catch (e) { } });
let assets = null;
export const kay = { ready: false };
export function loadKay() {
  if (assets) return assets;
  return (assets = (async () => {
    const [ranger, knight, gen, mov, adv, ranged, melee, bow, arrow, sword, shield, mage, staff, special, skMin, skWar, skRog, skMag, skBlade, skAxe, skStaff, skShield, skXbow, gBasic, gWar, gArch, gShiv, gSword, gBow, bThug, bScav, bPoach, bClub, bBottle, bXbow] = await Promise.all(FILES.map(f => bytes(f).then(parse)));
    kay.models = { 2: ranger.scene, 0: knight.scene, 1: mage.scene }; kay.staff = staff.scene; kay.bow = bow.scene; kay.arrow = arrow.scene; kay.sword = sword.scene; kay.shield = shield.scene;
    kay.clips = [...gen.animations, ...mov.animations, ...adv.animations, ...ranged.animations, ...melee.animations, ...special.animations];
    kay.skel = { minion: skMin.scene, warrior: skWar.scene, rogue: skRog.scene, mage: skMag.scene };
    kay.gob = { basic: gBasic.scene, warrior: gWar.scene, archer: gArch.scene, shiv: gShiv.scene, sword: gSword.scene, bow: gBow.scene,
      thug: bThug.scene, scavenger: bScav.scene, poacher: bPoach.scene, club: bClub.scene, bottle: bBottle.scene, xbow: bXbow.scene };
    kay.skelGear = { blade: skBlade.scene, axe: skAxe.scene, staff: skStaff.scene, shield: skShield.scene, xbow: skXbow.scene };
    kay.ready = true;
    return kay;
  })());
}
const CLIPS = {
  2: { idle: 'Ranged_Bow_Idle', aim: 'Ranged_Bow_Aiming_Idle', walk: 'Walking_A', run: 'Running_HoldingBow', jump: 'Jump_Idle', swim: 'Walking_C',
    dodge: 'Dodge_Forward', shoot: 'Ranged_Bow_Release', up: 'Ranged_Bow_Release_Up', hit: 'Hit_A', die: 'Death_A' },
  0: { idle: 'Idle_A', aim: 'Melee_Blocking', block: 'Melee_Blocking', walk: 'Walking_A', run: 'Running_A', jump: 'Jump_Idle', swim: 'Walking_C', dodge: 'Dodge_Forward',
    s0: 'Melee_1H_Attack_Slice_Diagonal', s1: 'Melee_1H_Attack_Slice_Horizontal', s2: 'Melee_1H_Attack_Chop', s3: 'Melee_1H_Attack_Stab',
    spin: 'Melee_2H_Attack_Spinning', slam: 'Melee_1H_Attack_Jump_Chop', bash: 'Melee_Block_Attack', hit: 'Hit_A', die: 'Death_A' },
  1: { idle: 'Idle_B', aim: 'Ranged_Magic_Spellcasting', walk: 'Walking_B', run: 'Running_B', jump: 'Jump_Idle', swim: 'Walking_C', dodge: 'Dodge_Forward',
    shoot: 'Ranged_Magic_Shoot', nova: 'Ranged_Magic_Summon', up: 'Ranged_Magic_Raise', hit: 'Hit_A', die: 'Death_A' },
};
const ONCE = ['dodge', 'shoot', 'nova', 'up', 'hit', 'die', 's0', 's1', 's2', 's3', 'slam', 'bash'];
// a new hero (2 the ranger, 0 the knight), as tall as the hero it replaces
export function makeKayHero(height, cls = 2) {
  const model = SkeletonUtils.clone(kay.models[cls]), root = new THREE.Group(); root.add(model);
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  model.updateMatrixWorld(true);
  const box = new THREE.Box3(); model.traverse(o => { if (o.isSkinnedMesh) { o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
  const s = height / (box.max.y - box.min.y); model.scale.setScalar(s); model.position.y = -box.min.y * s;
  const bone = n => model.getObjectByName(n) || model.getObjectByName(n.replace(/\./g, ''));
  const B = { head: bone('head'), ul: [bone('upperleg.l'), bone('upperleg.r')], ll: [bone('lowerleg.l'), bone('lowerleg.r')], ft: [bone('foot.l'), bone('foot.r')], slot: [bone('handslot.l'), bone('handslot.r')] };
  model.updateMatrixWorld(true);
  const legLen = B.ul[0].getWorldPosition(new V3()).distanceTo(B.ft[0].getWorldPosition(new V3())) / root.scale.y;
  // the bow (the pack's, or a forged one in its place) and an arrow in the drawing hand
  // the ranger: the bow in the left hand, an arrow in the right; the knight: the sword in the right, the shield on the left
  const hold = new THREE.Group(), arrow = kay.arrow.clone(); arrow.visible = false;
  if (cls === 2) { B.slot[0].add(hold); hold.add(kay.bow.clone()); B.slot[1].add(arrow); }
  else if (cls === 0) { B.slot[1].add(hold); hold.add(kay.sword.clone()); B.slot[0].add(kay.shield.clone()); }
  else { B.slot[1].add(hold); hold.add(kay.staff.clone()); }
  makeFlashable(root);
  const mixer = new THREE.AnimationMixer(model), act = {}, CLIP = CLIPS[cls];
  for (const k in CLIP) { const c = kay.clips.find(c => c.name === CLIP[k]); if (c) act[k] = mixer.clipAction(c); }
  for (const k of ONCE) if (act[k]) { act[k].setLoop(THREE.LoopOnce, 1); act[k].clampWhenFinished = true; }
  act.idle.play();
  const rest = []; model.traverse(o => { if (o.isBone) rest.push([o, o.quaternion.clone()]); });
  Object.assign(root.userData, { kay: true, model, mixer, act, cur: 'idle', base: 'idle', one: null, oneT: 0, B, legLen, baseY: model.position.y, rest, hold, arrow, lastCast: -1, lastSwing: -1, cls, own: () => (cls === 2 ? kay.bow : cls === 0 ? kay.sword : kay.staff).clone() });
  return root;
}
// a forged weapon in a KayKit hand (null: the pack's own), laid as the pack's own lies: the forge builds every weapon
// along +y (a blade or head up; a bow's limbs up and down, its belly toward +z); the pack's sword and staff lie along +y
// too, its bow along z with its belly toward -x. A staff is gripped 40% up, a wand near its end; sized as the pack's own
export function holdForged(root, w, spec) {
  const u = root.userData, h = u.hold;
  for (const c of [...h.children]) h.remove(c);
  u.wtick = w ? w.userData.tick : null;   // (a forged weapon's aura and glow run on its tick)
  if (!w) { h.add(u.own()); return; }
  const len = o => { const s = new THREE.Box3().setFromObject(o).getSize(new V3()); return Math.max(s.x, s.y, s.z); };
  const type = spec && spec.type, g = new THREE.Group(), refLen = len(u.own());
  if (type === 'bow' || type === 'crossbow') g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V3(0, -1, 0), new V3(0, 0, 1), new V3(-1, 0, 0)));
  const bb = new THREE.Box3().setFromObject(w), hgt = bb.max.y - bb.min.y;
  if (type === 'staff') w.position.y = -(bb.min.y + 0.4 * hgt);
  else if (type === 'wand') w.position.y = -(bb.min.y + 0.12 * hgt);
  g.scale.setScalar(refLen / len(w) * (type === 'wand' ? 0.6 : 1));
  g.add(w); h.add(g);
  // (an aura's sparks are sized in the world, not by the weapon's scale: sized here to how much bigger or smaller the
  // weapon is in this hand than in the old heroes', 2.56 times its own size)
  root.updateMatrixWorld(true);
  const k = w.getWorldScale(new V3()).x / root.getWorldScale(new V3()).x / 2.56;
  w.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.uK) o.material.uniforms.uK.value = k; });
}
// each frame: which motion, crossfaded; one-shots (a shot, a dodge) over it; then the proportions
export function animKay(root, dt, s) {
  const u = root.userData, A = u.act;
  // a new shot starts a loosing of the string (straight up for the rain)
  if (s.cast >= 0 && (u.lastCast < 0 || s.cast < u.lastCast)) { const k = s.castKind; if (u.cls === 1) playOnce(u, k === 'nova' ? 'nova' : k === 'meteor' ? 'up' : 'shoot', k === 'bolt' ? 0.5 : 0.7); else playOnce(u, k === 'rain' ? 'up' : 'shoot', 0.55); }
  u.lastCast = s.cast;
  if (s.roll > 0 && u.one !== 'dodge') playOnce(u, 'dodge', 0.42);
  // the knight: a swing of the sword (four cuts in turn), the whirlwind spinning, the slam leaping down on them
  if (u.cls === 0) {
    const sw = s.swing ?? -1;
    if (sw >= 0 && (u.lastSwing < 0 || sw < u.lastSwing)) { if (s.whirl) playOnce(u, 'spin', 0.6); else playOnce(u, 's' + ((s.swingN || 0) % 4), 0.5); }
    u.lastSwing = sw;
    if (s.slam && u.one !== 'slam') playOnce(u, 'slam', 0.7);
  }
  const still = s.block ? 'block' : s.aiming ? 'aim' : 'idle';
  const base = s.swim ? 'swim' : s.air && !s.slam ? 'jump' : s.speed > 0.55 ? 'run' : s.speed > 0.08 ? 'walk' : (u.act[still] ? still : 'idle');
  if (u.one) { u.oneT -= dt; if (u.oneT <= 0) { const a = A[u.one]; u.one = null; to(u, base, 0.15, a); } }
  else if (base !== u.cur) to(u, base, 0.2);
  // (the walk and run keep step with the ground the hero covers)
  if (A.walk) A.walk.timeScale = Math.max(0.6, s.speed / 0.35);
  if (A.run) A.run.timeScale = Math.max(0.8, s.speed * 1.05);
  for (const [b, q] of u.rest) b.quaternion.copy(q);
  u.mixer.update(dt);
  if (u.wtick) u.wtick(performance.now() / 1000);
  u.arrow.visible = u.cls === 2 && !!u.one && (u.one === 'shoot' || u.one === 'up') && u.oneT > 0.3;
  const B = u.B, k = SHAPE.leg, t = SHAPE.thick;
  for (let i = 0; i < 2; i++) { B.ul[i].scale.set(t, k, t); B.ft[i].scale.set(1 / t, 1 / k, 1 / t); }
  B.head.scale.setScalar(SHAPE.head);
  u.model.position.y = u.baseY + u.legLen * (k - 1);
}
function to(u, name, fade, from) {
  const a = u.act[name], b = from || u.act[u.cur];
  if (!a) return;
  a.reset().play(); if (b && b !== a) a.crossFadeFrom(b, fade, false);
  u.cur = name;
}
function playOnce(u, name, secs) {
  const a = u.act[name]; if (!a) return;
  a.timeScale = a.getClip().duration / secs;
  to(u, name, 0.06); u.one = name; u.oneT = secs;
}

// ---------------------------------------------------------------- the skeletons (KayKit Skeletons, CC0)
// four kinds, each with its own gear; they rise out of the ground when they appear, shamble about, run at you, chop,
// flinch when struck and fall apart when they die. anim(t, s) is the monsters' own way of being moved
const SKEL_KINDS = [['minion', ['blade', null]], ['warrior', ['axe', 'shield']], ['rogue', ['blade', 'xbow']], ['mage', ['staff', null]]];
const SKEL_CLIP = { idle: 'Skeletons_Idle', walk: 'Skeletons_Walking', run: 'Running_A', attack: 'Melee_1H_Attack_Chop', attack2: 'Melee_1H_Attack_Slice_Diagonal',
  wind: 'Melee_Block', hit: 'Hit_A', die: 'Skeletons_Death', rise: 'Skeletons_Awaken_Floor', taunt: 'Skeletons_Taunt' };
export function makeKaySkeleton(height) {
  const [kind, [rh, lh]] = SKEL_KINDS[Math.floor(Math.random() * SKEL_KINDS.length)];
  const model = SkeletonUtils.clone(kay.skel[kind]), root = new THREE.Group(); root.add(model);
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  model.updateMatrixWorld(true);
  const box = new THREE.Box3(); model.traverse(o => { if (o.isSkinnedMesh) { o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
  const sc = height / (box.max.y - box.min.y); model.scale.setScalar(sc); model.position.y = -box.min.y * sc;
  const bone = n => model.getObjectByName(n) || model.getObjectByName(n.replace(/\./g, ''));
  const sr = bone('handslot.r'), sl = bone('handslot.l');
  if (rh && sr) sr.add(kay.skelGear[rh].clone());
  if (lh && sl) sl.add(kay.skelGear[lh].clone());
  makeFlashable(root);
  const mixer = new THREE.AnimationMixer(model), act = {};
  for (const k in SKEL_CLIP) { const c = kay.clips.find(c => c.name === SKEL_CLIP[k]); if (c) act[k] = mixer.clipAction(c); }
  for (const k of ['attack', 'attack2', 'hit', 'die', 'rise', 'taunt']) if (act[k]) { act[k].setLoop(THREE.LoopOnce, 1); act[k].clampWhenFinished = true; }
  const u = root.userData;
  Object.assign(u, { kay: true, mixer, act, cur: null, one: null, oneT: 0, lastT: -1, wasAtk: false, swing: 0 });
  const go = (name, fade = 0.2) => { const a = act[name]; if (!a || u.cur === name) return; a.reset().play(); if (u.cur && act[u.cur]) a.crossFadeFrom(act[u.cur], fade, false); u.cur = name; };
  const once = (name, secs) => { const a = act[name]; if (!a) return; a.timeScale = a.getClip().duration / secs; u.cur = null; go(name, 0.08); u.one = name; u.oneT = secs; };
  // (rising from the ground as it appears)
  once('rise', 1.4);
  u.anim = (t, s) => {
    const dt = u.lastT < 0 ? 0 : Math.min(0.1, t - u.lastT); u.lastT = t;
    if (s.attack && !u.wasAtk) once((u.swing++ & 1) ? 'attack2' : 'attack', 0.45);
    u.wasAtk = !!s.attack;
    if (s.hurt && !u.one) once('hit', 0.35);
    if (u.one) { u.oneT -= dt; if (u.oneT <= 0) u.one = null; }
    if (!u.one) go(s.wind ? 'wind' : s.moving ? (s.chase ? 'run' : 'walk') : 'idle');
    if (act.run) act.run.timeScale = 0.9;
    u.mixer.update(dt);
  };
  // fallen: it falls apart and lies there (the bodies keep ticking it)
  u.die = () => { u.one = null; u.cur = 'die'; u.anim = () => { }; mixer.stopAllAction(); const a = act.die; if (a) { a.timeScale = 1; a.reset().play(); } };
  u.tickDead = dt => u.mixer.update(dt);
  return root;
}

// ---------------------------------------------------------------- the goblins (a free goblin pack: rigged, not animated)
// so they're moved here, in code: each limb pointed where a walk, a run, a chop or a bow-draw puts it (in the goblin's
// own frame: +z ahead, +y up, its left at +x), from the shoulders and hips down
// (and the bandits, from the same maker, on the same skeleton: a thug with a spiked club, a scavenger with a broken bottle,
// a poacher with a crossbow)
const GOB_KINDS = { 18: [['basic', 'shiv'], ['warrior', 'sword']], 19: [['archer', 'bow']], 20: [['thug', 'club'], ['scavenger', 'bottle']], 21: [['poacher', 'xbow']] };
export const IS_GOB = t => t >= 18 && t <= 21;
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _a = new V3(), _b = new V3(), _c = new V3();
function point(bone, child, dir, modelQ) {
  if (bone.userData.copies) for (const [b, c] of bone.userData.copies) point1(b, c, dir, modelQ);
  point1(bone, child, dir, modelQ);
}
function point1(bone, child, dir, modelQ) {
  bone.updateMatrixWorld(true);
  const p = bone.getWorldPosition(_a), cdir = child.getWorldPosition(_b).sub(p).normalize();
  const want = _c.copy(dir).normalize().applyQuaternion(modelQ);
  _q.setFromUnitVectors(cdir, want);
  const wq = bone.getWorldQuaternion(_q2).premultiply(_q);
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wq));
  bone.updateMatrixWorld(true);
}
export function makeGoblin(type, height) {
  const opts = GOB_KINDS[type], [kind, gear] = opts[window.__dwGobPick ?? Math.floor(Math.random() * opts.length)];
  const model = SkeletonUtils.clone(kay.gob[kind]), root = new THREE.Group(); root.add(model);
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  model.updateMatrixWorld(true);
  const box = new THREE.Box3(); model.traverse(o => { if (o.isSkinnedMesh) { o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
  const sc = height / (box.max.y - box.min.y); model.scale.setScalar(sc); const baseY = -box.min.y * sc; model.position.y = baseY;
  const bone = n => model.getObjectByName(n) || model.getObjectByName(n.replace(/\./g, ''));
  const B = { ua: [bone('upper_arm.L'), bone('upper_arm.R')], fa: [bone('forearm.L'), bone('forearm.R')], hd: [bone('hand.L'), bone('hand.R')],
    th: [bone('thigh.L'), bone('thigh.R')], sh: [bone('shin.L'), bone('shin.R')], ft: [bone('foot.L'), bone('foot.R')], spine: bone('spine.001') || bone('spine'), chest: bone('spine.003') };
  const w = kay.gob[gear].clone(); (gear === 'bow' ? B.hd[0] : B.hd[1]).add(w); w.userData.gear = gear;
  const xbow = gear === 'xbow';
  makeFlashable(root);
  // (each limb's next bone is its own child, not a same-named bone of another copy)
  // (a converted model may slip a helper node between a bone and the next: look two deep)
  const kid = (b, n) => { if (!b) return null; const m = n.replace(/\./g, ''); for (const c of b.children) { if (c.name === n || c.name === m) return c; for (const g of c.children) if (g.name === n || g.name === m) return g; } return null; };
  for (let i = 0; i < 2; i++) { const L = i ? 'R' : 'L';
    B.fa[i] = kid(B.ua[i], 'forearm.' + L) || B.fa[i]; B.hd[i] = kid(B.fa[i], 'hand.' + L) || B.hd[i];
    B.sh[i] = kid(B.th[i], 'shin.' + L) || B.sh[i]; B.ft[i] = kid(B.sh[i], 'foot.' + L) || B.ft[i]; }
  (gear === 'bow' ? B.hd[0] : B.hd[1]).add(w);
  // (and a converted model can nest its copies of a bone one inside another, upper_armL_1 > _2 > _3 > upper_armL, each
  // mesh bound to its own: the outermost is the one to turn, so every copy inside it turns too)
  const base = n => n.replace(/_\d+$/, ''), top = b => { if (!b) return b; while (b.parent && b.parent.isBone !== undefined && base(b.parent.name) === base(b.name)) b = b.parent; return b; };
  for (const k of ['ua', 'fa', 'hd', 'th', 'sh', 'ft']) B[k] = B[k].map(top);
  const rest = []; model.traverse(o => { if (o.isBone) rest.push([o, o.quaternion.clone()]); });
  // (some of these models carry a copy of the skeleton per piece: every copy of a limb is pointed the same way)
  const named = {}; for (const [b] of rest) (named[b.name] ||= []).push(b);
  for (const [pa, ch] of [['ua', 'fa'], ['fa', 'hd'], ['th', 'sh'], ['sh', 'ft']]) for (let i = 0; i < 2; i++) {
    const p0 = B[pa][i], c0 = B[ch][i]; if (!p0 || !c0) continue;
    p0.userData.copies = named[p0.name].filter(b => b !== p0).map(b => [b, kid(b, c0.name)]).filter(([, c]) => c);
  }
  const firstOf = {}, dups = [];
  for (const [b, q] of rest) { if (firstOf[b.name]) dups.push([b, firstOf[b.name][0], q, firstOf[b.name][1].clone().invert()]); else firstOf[b.name] = [b, q]; }
  const u = root.userData;
  Object.assign(u, { gob: true, model, B, rest, phase: Math.random() * 6, lastT: -1, atkT: -1, wasAtk: false, hurtT: 0, archer: gear === 'bow' || xbow, xbow, w });
  const mq = new THREE.Quaternion(), V = (x, y, z) => new V3(x, y, z);
  u.anim = (t, s) => {
    const dt = u.lastT < 0 ? 0 : Math.min(0.1, t - u.lastT); u.lastT = t;
    for (const [b, q] of u.rest) b.quaternion.copy(q);
    const spd = s.moving ? (s.chase ? 1.6 : 1) : 0;
    u.phase += dt * (s.moving ? (s.chase ? 13 : 8) : 0);
    if (s.attack && !u.wasAtk) u.atkT = 0; u.wasAtk = !!s.attack;
    if (u.atkT >= 0) { u.atkT += dt / (u.archer ? 0.6 : 0.42); if (u.atkT >= 1) u.atkT = -1; }
    if (s.hurt) u.hurtT = 0.25; u.hurtT = Math.max(0, u.hurtT - dt);
    const ph = u.phase, sw = Math.sin(ph) * Math.min(1, spd) * (s.chase ? 0.75 : 0.5);
    // the body: a bob as it steps, a hunch when it runs, a flinch back when struck, a lean into a swing
    model.position.y = baseY + Math.abs(Math.cos(ph)) * 0.05 * sc * Math.min(1, spd);
    model.rotation.x = (s.chase && s.moving ? 0.18 : 0) - u.hurtT * 1.2 + (u.atkT >= 0 && !u.archer ? Math.sin(u.atkT * Math.PI) * 0.25 : 0);
    model.updateMatrixWorld(true); model.getWorldQuaternion(mq);
    // legs: each thigh swings, the knee bends as the leg comes through
    for (let i = 0; i < 2; i++) {
      const a = i ? -sw : sw, knee = Math.max(0, Math.sin(ph + (i ? Math.PI : 0) - 0.9)) * 0.9 * Math.min(1, spd) + 0.1;
      point(B.th[i], B.sh[i], V(0, -Math.cos(a), Math.sin(a)), mq);
      point(B.sh[i], B.ft[i], V(0, -Math.cos(a - knee), Math.sin(a - knee)), mq);
    }
    // arms: down at the sides, swinging against the legs; the weapon hand a little forward
    const side = [1, -1];
    for (let i = 0; i < 2; i++) {
      const a = i ? sw : -sw;
      point(B.ua[i], B.fa[i], V(0.32 * side[i], -Math.cos(a) * 0.95, Math.sin(a) + 0.05), mq);
      point(B.fa[i], B.hd[i], V(0.12 * side[i], -0.75, 0.55 + Math.sin(a) * 0.4), mq);
    }
    // a strike: the weapon arm (right) up and back, then down and through; an archer: bow arm out, string hand to the chin
    const k = u.atkT, wind = s.wind;
    if (u.xbow && (k >= 0 || wind)) {
      // (the crossbow raised to the shoulder in both hands)
      point(B.ua[1], B.fa[1], V(-0.2, 0.0, 1), mq); point(B.fa[1], B.hd[1], V(0.25, 0.05, 1), mq);
      point(B.ua[0], B.fa[0], V(0.15, -0.1, 1), mq); point(B.fa[0], B.hd[0], V(-0.45, 0.0, 0.8), mq);
    } else if (u.archer && (k >= 0 || wind)) {
      const pull = k < 0 ? 0.6 : k < 0.7 ? k / 0.7 : 1 - (k - 0.7) / 0.3;
      point(B.ua[0], B.fa[0], V(0.15, 0.08, 1), mq); point(B.fa[0], B.hd[0], V(0.05, 0.08, 1), mq);
      point(B.ua[1], B.fa[1], V(-0.55, 0.1, 0.6 - pull * 0.4), mq); point(B.fa[1], B.hd[1], V(0.8, 0.15, 0.35 - pull * 0.3), mq);
    } else if (!u.archer && (k >= 0 || wind)) {
      const up = k < 0 ? 1 : k < 0.35 ? 1 : Math.max(0, 1 - (k - 0.35) / 0.25);
      const ua = V(-0.25, 0.95 * up - 0.4 * (1 - up), 0.15 * up + 0.95 * (1 - up)), fa = V(-0.1, 0.6 * up - 0.7 * (1 - up), -0.6 * up + 0.7 * (1 - up));
      point(B.ua[1], B.fa[1], ua, mq); point(B.fa[1], B.hd[1], fa, mq);
    }
  };
  return root;
}
