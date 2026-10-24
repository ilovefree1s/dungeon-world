// ============================================================================
//  DUNGEON WORLD  -  KayKit's ranger (Kay Lousberg, www.kaylousberg.com, CC0),
//  for comparing with the sculpted hunters: the model, its idle / walk / run
//  from the pack's animations, the pack's bow in its left hand, and a bow draw
//  of our own laid over the idle (the free pack has none): the arms placed by
//  solving for the elbows, the bow held upright.
// ============================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import rangerGlb from '../assets/kaykit/Ranger.glb';
import generalGlb from '../assets/kaykit/Rig_Medium_General.glb';
import moveGlb from '../assets/kaykit/Rig_Medium_MovementBasic.glb';
import bowGltf from '../assets/kaykit/bow_withString.glb';
import arrowGltf from '../assets/kaykit/arrow_bow.glb';
import rangedGlb from '../assets/kaykit/Rig_Medium_CombatRanged.glb';
import moveAdvGlb from '../assets/kaykit/Rig_Medium_MovementAdvanced.glb';

const V3 = THREE.Vector3;
// (the page may not fetch anything, not even the model's own embedded pictures: with no createImageBitmap the loader
// reads them through an <img> instead of a fetch)
const parse = data => new Promise((ok, no) => { const cib = self.createImageBitmap; try { self.createImageBitmap = undefined; } catch (e) { } new GLTFLoader().parse(data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data, '', ok, no); try { self.createImageBitmap = cib; } catch (e) { } });
let loaded = null;
export function loadKayKit() {
  if (loaded) return loaded;
  return (loaded = (async () => {
    const [ranger, gen, mov, bow, arrow, ranged, adv] = await Promise.all([parse(rangerGlb), parse(generalGlb), parse(moveGlb), parse(bowGltf), parse(arrowGltf), parse(rangedGlb), parse(moveAdvGlb)]);
    const root = new THREE.Group(), model = ranger.scene; root.add(model);
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    // (sized to stand as tall as our hunters)
    model.updateMatrixWorld(true);
    const box = new THREE.Box3();
    model.traverse(o => { if (o.isSkinnedMesh) { o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
    const h = box.max.y - box.min.y;
    model.scale.setScalar(2.3 / h); model.position.y = -box.min.y * 2.3 / h;
    const bone = n => model.getObjectByName(n) || model.getObjectByName(n.replace(/\./g, ''));
    const B = { hips: bone('hips'), spine: bone('spine'), chest: bone('chest'), head: bone('head'),
      ul: [bone('upperleg.l'), bone('upperleg.r')], ll: [bone('lowerleg.l'), bone('lowerleg.r')], ft: [bone('foot.l'), bone('foot.r')], ua: [bone('upperarm.l'), bone('upperarm.r')], la: [bone('lowerarm.l'), bone('lowerarm.r')], wr: [bone('wrist.l'), bone('wrist.r')], hand: [bone('hand.l'), bone('hand.r')], slot: [bone('handslot.l'), bone('handslot.r')] };
    const mixer = new THREE.AnimationMixer(model), clips = [...gen.animations, ...mov.animations, ...ranged.animations, ...adv.animations], act = {};
    for (const [k, n] of [['idle', 'Ranged_Bow_Idle'], ['walk', 'Walking_A'], ['run', 'Running_HoldingBow'], ['draw', 'Ranged_Bow_Draw'], ['aim', 'Ranged_Bow_Aiming_Idle'], ['release', 'Ranged_Bow_Release']]) { const c = clips.find(c => c.name === n); if (c) act[k] = mixer.clipAction(c); }
    for (const k of ['draw', 'release']) { act[k].setLoop(THREE.LoopOnce, 1); act[k].clampWhenFinished = true; }
    act.idle.play();
    const rest = []; model.traverse(o => { if (o.isBone) rest.push([o, o.quaternion.clone()]); });
    const bowM = bow.scene; B.slot[0].add(bowM);
    const arrowM = arrow.scene; B.slot[1].add(arrowM); arrowM.visible = false;
    model.updateMatrixWorld(true);
    const legLen = B.ul[0].getWorldPosition(new V3()).distanceTo(B.ft[0].getWorldPosition(new V3()));
    return { root, model, mixer, act, B, bowM, arrowM, rest, cur: 'idle', baseY: model.position.y, legLen, shape: { leg: 1, thick: 1, head: 1 } };
  })());
}
// a two-bone limb reaching a point in the world, its elbow toward the pole (world): turns each bone from where it
// points now to where it should, whatever way the rig's bones were laid out
function reach(up, low, end, T, pole) {
  const S = up.getWorldPosition(new V3()), E0 = low.getWorldPosition(new V3()), W0 = end.getWorldPosition(new V3());
  const l1 = S.distanceTo(E0), l2 = E0.distanceTo(W0);
  const d = T.clone().sub(S), dist = Math.min(Math.max(d.length(), 0.01), l1 + l2 - 0.001), dn = d.normalize();
  const a = (l1 * l1 + dist * dist - l2 * l2) / (2 * dist), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const pd = pole.clone().addScaledVector(dn, -pole.dot(dn)).normalize();
  const E = S.clone().addScaledVector(dn, a).addScaledVector(pd, hh), W = S.clone().addScaledVector(dn, dist);
  const turn = (bone, from, to) => {
    const q = new THREE.Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
    const wq = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(q);
    const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    bone.quaternion.copy(pq.multiply(wq)); bone.updateMatrixWorld(true);
  };
  turn(up, E0.clone().sub(S), E.clone().sub(S));
  const E1 = low.getWorldPosition(new V3()), W1 = end.getWorldPosition(new V3());
  turn(low, W1.clone().sub(E1), W.clone().sub(E1));
}
// the pack's own motions: idle with the bow, walk, run holding the bow; the shot is draw, a moment's aim, release, again
export function tickKayKit(K, dt, anim) {
  let want = anim === 'walk' ? 'walk' : anim === 'run' ? 'run' : anim === 'shoot' ? (K.shot || 'draw') : 'idle';
  if (anim === 'shoot') {
    const a = K.act[want];
    K.shotT = (K.shotT || 0) + dt;
    const done = a.getClip().duration * (want === 'aim' ? 0.6 : 1);
    if (K.cur === want && K.shotT > done) { want = K.shot = { draw: 'aim', aim: 'release', release: 'draw' }[want]; }
    else if (K.cur !== want && !K.shot) K.shot = want;
  } else K.shot = null;
  if (want !== K.cur) { const a = K.act[want], b = K.act[K.cur]; a.reset().play(); a.crossFadeFrom(b, want === 'release' || want === 'aim' ? 0.08 : 0.2, false); K.cur = want; K.shotT = 0; }
  K.mixer.update(dt);
  // proportions: the legs stretched along their bones (the feet kept their own size), thickened, the head scaled;
  // the whole body raised so the longer legs still reach the ground
  const sh = K.shape, k = sh.leg, t = sh.thick, B = K.B;
  for (let i = 0; i < 2; i++) { B.ul[i].scale.set(t, k, t); B.ll[i].scale.set(1, 1, 1); B.ft[i].scale.set(1 / t, 1 / k, 1 / t); }
  B.head.scale.setScalar(sh.head);
  K.model.position.y = K.baseY + K.legLen * (k - 1);
  K.arrowM.visible = K.cur === 'draw' || K.cur === 'aim';
}
