// ============================================================================
//  DUNGEON WORLD  -  loot: a fallen monster leaves its body on the ground for
//  a while, and some of them carry a weapon rolled at random (the forge's
//  parts, a name, a material that may glow). Look at a body and click (or
//  press F) to see what it dropped; take it into the forge's saved weapons,
//  wield it on the spot, or leave it.
// ============================================================================
import { THREE, scene, camera, TEX, V3 } from './engine.js';
import { randomSpec, nameOf, statsOf, TYPES, MATERIALS, AURAS, RARITIES, rarityOf, clsOf, HERO_NAME } from './weaponkit.js';
import { burst, ring } from './fx.js';
import { stats } from './combat.js';
import { rollArmor, rollPotion, rollGold } from './inventory.js';

const BODY_LIFE = 45, REACH = 10, LOOK = 0.98;
const markMat = new THREE.SpriteMaterial({ map: TEX.soft, color: '#ffd45a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
const ray = new THREE.Vector3(), tmp = new THREE.Vector3();

// what a monster had on it, all at its level: gold nearly always, now and then a weapon, a piece of armor, a potion
export function rollLoot(m, heroCls) {
  const ilvl = m.lvl || stats.level, items = [];
  const weapon = Math.random() < 0.22 ? rollDrop(m, heroCls) : null;
  if (Math.random() < 0.28) items.push(rollArmor(ilvl));
  if (Math.random() < 0.2) items.push(rollPotion(ilvl));
  const gold = Math.random() < 0.85 ? rollGold(ilvl) : 0;
  return weapon || items.length || gold ? { weapon, items, gold } : null;
}
export const hasLoot = b => !!(b.loot && (b.loot.weapon || b.loot.items.length || b.loot.gold));
export const bestRarity = loot => { let best = -1; if (loot.weapon) best = RARITIES.indexOf(rarityOf(loot.weapon)); for (const it of loot.items) best = Math.max(best, RARITIES.findIndex(r => r.id === it.rarity)); return RARITIES[Math.max(0, best)]; };
// a weapon a monster carried, at its level
export function rollDrop(m, heroCls) {
  const spec = randomSpec(); spec.ilvl = m.lvl || stats.level;
  // (more often than not, something your hero can use)
  if (Math.random() < 0.6) { const mine = TYPES.filter(t => t.cls === heroCls); const t = mine[Math.floor(Math.random() * mine.length)]; spec.type = t.id; spec.head = t.heads[Math.floor(Math.random() * t.heads.length)]; }
  // its rarity: mostly common, a legendary now and then, the odds shifting up with your level
  const lv = Math.min(30, stats.level);
  const w = [50 - lv * 1.2, 27, 14 + lv * 0.4, 7 + lv * 0.4, 2 + lv * 0.4];
  let r = Math.random() * w.reduce((a, b) => a + b, 0), ri = 0; for (; ri < w.length - 1; ri++) { r -= w[ri]; if (r < 0) break; }
  spec.rarity = RARITIES[ri].id;
  // a rarer one is better made: glowing metal from rare up (always, from epic), an aura from uncommon up (always, legendary)
  const glow = MATERIALS.filter(x => x.glow), plain = MATERIALS.filter(x => !x.glow);
  const glowy = ri >= 3 || (ri === 2 && Math.random() < 0.5) || (ri === 1 && Math.random() < 0.15);
  const pool = glowy ? glow : plain; spec.material = pool[Math.floor(Math.random() * pool.length)].id;
  if (ri === 0 || (ri < 4 && Math.random() > [0, 0.3, 0.6, 0.85][ri])) spec.aura = 'none';
  spec.name = nameOf(spec);
  return spec;
}

export class Bodies {
  constructor(player) { this.player = player; this.list = []; this.target = null; }
  // a monster fell: its model stays, tipped over on the ground
  fall(m, loot) {
    const root = m.root;
    root.userData.flash && root.userData.flash(0);
    root.rotation.z = (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    root.position.copy(m.pos); root.position.y += m.k.r * 0.6;
    // (a flyer that dies in the air drops: the body falls to the ground and lies there)
    const w = this.player.world, g = w && w.poly ? w.ground(m.pos.x, m.pos.z) : null;
    const b = { root, pos: m.pos.clone(), t: 0, loot, mark: null, h: m.k.h, r: m.k.r, vy: 0, floor: g !== null && g !== undefined ? g : m.pos.y };
    if (loot) { const rr = bestRarity(loot); b.mark = new THREE.Sprite(markMat.clone()); b.mark.material.color.set(rr.color); b.mark.scale.setScalar(2.6 + RARITIES.indexOf(rr) * 0.5); b.mark.position.set(b.pos.x, b.pos.y + 3.5, b.pos.z); scene.add(b.mark); b.color = rr.color; }
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
      if (b.pos.y > b.floor + 0.01) {
        b.vy -= 40 * dt; b.pos.y = Math.max(b.floor, b.pos.y + b.vy * dt);
        b.root.position.y = b.pos.y + b.r * 0.6;
        if (b.pos.y <= b.floor) { b.vy = 0; burst(b.pos.x, b.pos.y + 0.3, b.pos.z, '#c8b090', 8, 5, 1.2, false, 0.5); }
      }
      if (b.t > BODY_LIFE || b.pos.distanceTo(p) > 220) { if (b.t > BODY_LIFE - 1.2 && b.root.userData.fade) b.root.userData.fade(Math.max(0, BODY_LIFE - b.t) / 1.2); if (b.t > BODY_LIFE) this.remove(b); continue; }
      if (b.mark) { b.mark.position.y = b.pos.y + 3.5 + Math.sin(b.t * 3) * 0.3; b.mark.material.opacity = 0.7 + 0.3 * Math.sin(b.t * 5); if (Math.random() < dt * 2) burst(b.pos.x, b.pos.y + 1.5, b.pos.z, b.color || '#ffe08a', 3, 2, 0.8, true, 0.5, 1); }
      if (!hasLoot(b) || fighting) continue;
      tmp.set(b.pos.x, b.pos.y + 1.2, b.pos.z).sub(camera.position);
      const dist = tmp.length(); if (dist > REACH + 8 || b.pos.distanceTo(p) > REACH) continue;
      const cos = tmp.normalize().dot(ray);
      if (cos > bd) { bd = cos; best = b; }
    }
    this.target = best;
  }
  // the body with loot under a screen point, within reach, if any
  pickAt(x, y, w, h) {
    const f = (h / 2) / Math.tan(camera.fov * Math.PI / 360), p = this.player.pos;
    let best = null, bd = 1e9;
    for (const b of this.list) {
      if (!hasLoot(b) || b.pos.distanceTo(p) > REACH + 4) continue;
      tmp.set(b.pos.x, b.pos.y + 1.2, b.pos.z); const dist = tmp.distanceTo(camera.position);
      tmp.project(camera); if (tmp.z > 1) continue;
      const sx = (tmp.x + 1) / 2 * w, sy = (1 - tmp.y) / 2 * h, r = Math.max(16, 2.2 * f / dist);
      if (Math.hypot(sx - x, sy - y) < r && dist < bd) { bd = dist; best = b; }
    }
    return best;
  }
  // what the loot panel shows for a drop
  describe(spec) {
    const t = TYPES.find(x => x.id === spec.type), m = MATERIALS.find(x => x.id === spec.material), a = AURAS.find(x => x.id === spec.aura), st = statsOf(spec);
    const rr = rarityOf(spec);
    return { name: spec.name, line: `${m ? m.name : ''} ${t ? t.name : ''}${a && a.id !== 'none' ? ' · ' + a.name + ' AURA' : ''} · FOR THE ${HERO_NAME[clsOf(spec)]}`, rarity: rr, stats: st, cls: clsOf(spec) };
  }
  // taken: a little show, and the body keeps lying there without its mark
  // something taken: a little show; when nothing's left the mark goes
  took(b) { ring(b.pos.x, b.pos.y + 0.2, b.pos.z, '#ffe08a', 0.6, 5, 0.5); burst(b.pos.x, b.pos.y + 1.5, b.pos.z, '#fff2c0', 18, 8, 1.4, true, 0.7); if (!hasLoot(b) && b.mark) { scene.remove(b.mark); b.mark = null; } }
}
