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
const FILES = ['Ranger.glb', 'Rig_Medium_General.glb', 'Rig_Medium_MovementBasic.glb', 'Rig_Medium_MovementAdvanced.glb', 'Rig_Medium_CombatRanged.glb', 'bow_withString.glb', 'arrow_bow.glb'];
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
    const [ranger, gen, mov, adv, ranged, bow, arrow] = await Promise.all(FILES.map(f => bytes(f).then(parse)));
    kay.ranger = ranger; kay.bow = bow.scene; kay.arrow = arrow.scene;
    kay.clips = [...gen.animations, ...mov.animations, ...adv.animations, ...ranged.animations];
    kay.ready = true;
    return kay;
  })());
}
const CLIP = { idle: 'Ranged_Bow_Idle', aim: 'Ranged_Bow_Aiming_Idle', walk: 'Walking_A', run: 'Running_HoldingBow', jump: 'Jump_Idle', swim: 'Walking_C',
  dodge: 'Dodge_Forward', shoot: 'Ranged_Bow_Release', up: 'Ranged_Bow_Release_Up', draw: 'Ranged_Bow_Draw', hit: 'Hit_A', die: 'Death_A' };
// a new ranger, as tall as the hero it replaces
export function makeKayHero(height) {
  const model = SkeletonUtils.clone(kay.ranger.scene), root = new THREE.Group(); root.add(model);
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  model.updateMatrixWorld(true);
  const box = new THREE.Box3(); model.traverse(o => { if (o.isSkinnedMesh) { o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
  const s = height / (box.max.y - box.min.y); model.scale.setScalar(s); model.position.y = -box.min.y * s;
  const bone = n => model.getObjectByName(n) || model.getObjectByName(n.replace(/\./g, ''));
  const B = { head: bone('head'), ul: [bone('upperleg.l'), bone('upperleg.r')], ll: [bone('lowerleg.l'), bone('lowerleg.r')], ft: [bone('foot.l'), bone('foot.r')], slot: [bone('handslot.l'), bone('handslot.r')] };
  model.updateMatrixWorld(true);
  const legLen = B.ul[0].getWorldPosition(new V3()).distanceTo(B.ft[0].getWorldPosition(new V3())) / root.scale.y;
  // the bow (the pack's, or a forged one in its place) and an arrow in the drawing hand
  const hold = new THREE.Group(); B.slot[0].add(hold); hold.add(kay.bow.clone());
  const arrow = kay.arrow.clone(); B.slot[1].add(arrow); arrow.visible = false;
  makeFlashable(root);
  const mixer = new THREE.AnimationMixer(model), act = {};
  for (const k in CLIP) { const c = kay.clips.find(c => c.name === CLIP[k]); if (c) act[k] = mixer.clipAction(c); }
  for (const k of ['dodge', 'shoot', 'up', 'hit', 'die', 'draw']) if (act[k]) { act[k].setLoop(THREE.LoopOnce, 1); act[k].clampWhenFinished = true; }
  act.idle.play();
  const rest = []; model.traverse(o => { if (o.isBone) rest.push([o, o.quaternion.clone()]); });
  Object.assign(root.userData, { kay: true, model, mixer, act, cur: 'idle', base: 'idle', one: null, oneT: 0, B, legLen, baseY: model.position.y, rest, hold, bowLen: bowLength(hold), arrow, lastCast: -1 });
  return root;
}
const bowLength = g => { const b = new THREE.Box3().setFromObject(g), s = b.getSize(new V3()); return Math.max(s.x, s.y, s.z); };
// a forged bow in the ranger's hand (null: the pack's own): turned so its long side lies as the pack's bow's does
export function holdForged(root, w) {
  const u = root.userData, h = u.hold;
  for (const c of [...h.children]) h.remove(c);
  if (!w) { h.add(kay.bow.clone()); return; }
  const ref = kay.bow.clone(), rb = new THREE.Box3().setFromObject(ref).getSize(new V3()), wb = new THREE.Box3().setFromObject(w).getSize(new V3());
  const axis = s => s.x >= s.y && s.x >= s.z ? new V3(1, 0, 0) : s.y >= s.z ? new V3(0, 1, 0) : new V3(0, 0, 1);
  const g = new THREE.Group(); g.quaternion.setFromUnitVectors(axis(wb), axis(rb));
  g.scale.setScalar(Math.max(rb.x, rb.y, rb.z) / Math.max(wb.x, wb.y, wb.z));
  g.add(w); h.add(g);
}
// each frame: which motion, crossfaded; one-shots (a shot, a dodge) over it; then the proportions
export function animKay(root, dt, s) {
  const u = root.userData, A = u.act;
  // a new shot starts a loosing of the string (straight up for the rain)
  if (s.cast >= 0 && (u.lastCast < 0 || s.cast < u.lastCast)) playOnce(u, s.castKind === 'rain' ? 'up' : 'shoot', 0.55);
  u.lastCast = s.cast;
  if (s.roll > 0 && u.one !== 'dodge') playOnce(u, 'dodge', 0.42);
  const base = s.swim ? 'swim' : s.air ? 'jump' : s.speed > 0.55 ? 'run' : s.speed > 0.08 ? 'walk' : s.aiming ? 'aim' : 'idle';
  if (u.one) { u.oneT -= dt; if (u.oneT <= 0) { const a = A[u.one]; u.one = null; to(u, base, 0.15, a); } }
  else if (base !== u.cur) to(u, base, 0.2);
  // (the walk and run keep step with the ground the hero covers)
  if (A.walk) A.walk.timeScale = Math.max(0.6, s.speed / 0.35);
  if (A.run) A.run.timeScale = Math.max(0.8, s.speed * 1.05);
  for (const [b, q] of u.rest) b.quaternion.copy(q);
  u.mixer.update(dt);
  u.arrow.visible = !!u.one && (u.one === 'shoot' || u.one === 'up') && u.oneT > 0.3;
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
