// ============================================================================
//  DUNGEON WORLD  -  loot: a fallen monster leaves its body on the ground for
//  a while, and some of them carry a weapon rolled at random (the forge's
//  parts, a name, a material that may glow). Look at a body and click (or
//  press F) to see what it dropped; take it into the forge's saved weapons,
//  wield it on the spot, or leave it.
// ============================================================================
import { THREE, scene, camera, TEX, V3 } from './engine.js';
import { randomSpec, nameOf, statsOf, TYPES, MATERIALS, AURAS, clsOf, HERO_NAME } from './weaponkit.js';
import { burst, ring } from './fx.js';
import { stats } from './combat.js';

const BODY_LIFE = 45, REACH = 10, LOOK = 0.98;
const markMat = new THREE.SpriteMaterial({ map: TEX.soft, color: '#ffd45a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
const ray = new THREE.Vector3(), tmp = new THREE.Vector3();

// what a monster had on it: nothing most of the time; a weapon, likelier the stronger it was and the higher your level
export function rollDrop(m, heroCls) {
  const chance = Math.min(0.75, 0.3 + (m.maxHp || 10) * 0.004 + stats.level * 0.015);
  if (Math.random() > chance) return null;
  const spec = randomSpec();
  // (more often than not, something your hero can use)
  if (Math.random() < 0.6) { const mine = TYPES.filter(t => t.cls === heroCls); const t = mine[Math.floor(Math.random() * mine.length)]; spec.type = t.id; spec.head = t.heads[Math.floor(Math.random() * t.heads.length)]; }
  // plain materials are common, glowing ones rare; auras rarer still
  const glow = MATERIALS.filter(x => x.glow), plain = MATERIALS.filter(x => !x.glow);
  spec.material = (Math.random() < 0.12 + stats.level * 0.01 ? glow : plain)[Math.floor(Math.random() * (Math.random() < 0.12 + stats.level * 0.01 ? glow.length : plain.length))].id;
  if (Math.random() > 0.25 + stats.level * 0.015) spec.aura = 'none';
  spec.name = nameOf(spec);
  return spec;
}

export class Bodies {
  constructor(player) { this.player = player; this.list = []; this.target = null; }
  // a monster fell: its model stays, tipped over on the ground
  fall(m, spec) {
    const root = m.root;
    root.userData.flash && root.userData.flash(0);
    root.rotation.z = (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    root.position.copy(m.pos); root.position.y += m.k.r * 0.6;
    const b = { root, pos: m.pos.clone(), t: 0, spec, mark: null, h: m.k.h };
    if (spec) { b.mark = new THREE.Sprite(markMat); b.mark.scale.setScalar(2.6); b.mark.position.set(b.pos.x, b.pos.y + 3.5, b.pos.z); scene.add(b.mark); }
    this.list.push(b);
    return true;
  }
  remove(b) {
    scene.remove(b.root); b.root.traverse(o => o.geometry && o.geometry.dispose());
    if (b.mark) scene.remove(b.mark);
    const i = this.list.indexOf(b); if (i >= 0) this.list.splice(i, 1);
  }
  // the one near the crosshair and within reach, if any
  // (fighting: while a monster is after you nearby, a click is a swing, never a look at the loot)
  update(dt, fighting = false) {
    const p = this.player.pos;
    camera.getWorldDirection(ray);
    let best = null, bd = LOOK;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i]; b.t += dt;
      if (b.t > BODY_LIFE || b.pos.distanceTo(p) > 220) { if (b.t > BODY_LIFE - 1.2 && b.root.userData.fade) b.root.userData.fade(Math.max(0, BODY_LIFE - b.t) / 1.2); if (b.t > BODY_LIFE) this.remove(b); continue; }
      if (b.mark) { b.mark.position.y = b.pos.y + 3.5 + Math.sin(b.t * 3) * 0.3; b.mark.material.opacity = 0.7 + 0.3 * Math.sin(b.t * 5); if (Math.random() < dt * 2) burst(b.pos.x, b.pos.y + 1.5, b.pos.z, '#ffe08a', 3, 2, 0.8, true, 0.5, 1); }
      if (!b.spec || fighting) continue;
      tmp.set(b.pos.x, b.pos.y + 1.2, b.pos.z).sub(camera.position);
      const dist = tmp.length(); if (dist > REACH + 8 || b.pos.distanceTo(p) > REACH) continue;
      const cos = tmp.normalize().dot(ray);
      if (cos > bd) { bd = cos; best = b; }
    }
    this.target = best;
  }
  // what the loot panel shows for a drop
  describe(spec) {
    const t = TYPES.find(x => x.id === spec.type), m = MATERIALS.find(x => x.id === spec.material), a = AURAS.find(x => x.id === spec.aura), st = statsOf(spec);
    return { name: spec.name, line: `${m ? m.name : ''} ${t ? t.name : ''}${a && a.id !== 'none' ? ' · ' + a.name + ' AURA' : ''} · FOR THE ${HERO_NAME[clsOf(spec)]}`, rare: !!(m && m.glow), stats: st, cls: clsOf(spec) };
  }
  // taken: a little show, and the body keeps lying there without its mark
  took(b) { ring(b.pos.x, b.pos.y + 0.2, b.pos.z, '#ffe08a', 0.6, 5, 0.5); burst(b.pos.x, b.pos.y + 1.5, b.pos.z, '#fff2c0', 18, 8, 1.4, true, 0.7); if (b.mark) { scene.remove(b.mark); b.mark = null; } b.spec = null; }
}
