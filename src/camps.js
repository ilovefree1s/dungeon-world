// ============================================================================
//  DUNGEON WORLD  -  camps: goblin and bandit camps scattered through the
//  world (the same places for the same world), each a campfire with a real
//  flickering light, tents facing it, logs to sit on, crates, barrels and a
//  banner, and a band of fighters around the fire. Come near and they're
//  there; anger one and the whole camp comes; clear it and a chest is left
//  by the fire. A cleared camp fills up again after a while.
// ============================================================================
import { THREE, scene, V3 } from './engine.js';
import { burst } from './fx.js';
import { stats } from './combat.js';
import * as D from './dh/data.js';

const CELL = 300, BUILD_R = 230, DROP_R = 420, FILL_R = 150, REFILL = 300;
// (a camp's people, by kind: mostly fighters, one or two who shoot)
export const KINDS = {
  goblin: { melee: D.M_GOBLIN, ranged: D.M_GOBARCHER, tent: ['#6a5a3a', '#4a5a2a', '#7a4a2a'], flag: '#5a8a2a', name: 'GOBLIN CAMP' },
  bandit: { melee: D.M_BANDIT, ranged: D.M_POACHER, tent: ['#8a2a2a', '#a8946a', '#5a4a3a'], flag: '#b8322a', name: 'BANDIT CAMP' },
};
// which kind lives in each land (0 woods, 1 mountains, 2 sands, 3 bog, 4 cinder, 5 prism)
const BY_BIOME = [['goblin', 'bandit'], ['goblin'], ['bandit'], ['goblin'], ['bandit'], ['bandit']];

export const hash = (a, b, s) => { let h = (a * 374761393 + b * 668265263 + s * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return () => ((h = (Math.imul(h ^ (h >>> 15), 2246822519) + 0x6D2B79F5) >>> 0) / 4294967296); };
const M = {};
export const mat = (c, o = {}) => M[c + JSON.stringify(o)] || (M[c + JSON.stringify(o)] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true, ...o }));
export const mesh = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o; };

// two lights shared by the nearest camps' fires (a fixed number, so nothing has to recompile when camps come and go)
const LIGHTS = [0, 1].map(() => { const l = new THREE.PointLight('#ff9a40', 0, 46, 1.6); scene.add(l); return l; });

// ---------------------------------------------------------------- the props
export function campfire() {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, s = mesh(new THREE.DodecahedronGeometry(0.42 + (i % 3) * 0.06, 0), mat('#7a7670')); s.position.set(Math.cos(a) * 1.5, 0.25, Math.sin(a) * 1.5); s.rotation.set(i, i * 2, 0); g.add(s); }
  for (let i = 0; i < 4; i++) { const l = mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.4, 6), mat('#5a3a1e')); l.rotation.set(Math.PI / 2 - 0.5, i * Math.PI / 4, 0, 'YXZ'); l.position.y = 0.55; g.add(l); }
  const ash = mesh(new THREE.CircleGeometry(1.3, 12), mat('#2a2220')); ash.rotation.x = -Math.PI / 2; ash.position.y = 0.06; g.add(ash);
  // the flames: a few glowing tongues that flicker
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.45 - i * 0.05, 1.6 + (i % 2) * 0.4, 6), new THREE.MeshBasicMaterial({ color: i < 2 ? '#ffd45a' : i < 4 ? '#ff8a2a' : '#ff4a1a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    f.position.set((i - 2) * 0.22, 0.95, ((i * 7) % 3 - 1) * 0.2); g.add(f); flames.push(f);
  }
  g.userData.flames = flames;
  return g;
}
export function tent(colors, r) {
  const g = new THREE.Group(), c = colors[Math.floor(r() * colors.length)], w = 3.6 + r() * 1.2, L = 4.4 + r() * 1.4, h = 3 + r() * 0.6;
  // an A-frame: a triangular prism of cloth, a dark doorway, two poles, ropes pegged out
  const geo = new THREE.CylinderGeometry(w * 0.58, w * 0.58, L, 3, 1, true); geo.rotateZ(Math.PI / 2); geo.rotateX(Math.PI / 6);
  const cloth = mesh(geo, mat(c, { side: THREE.DoubleSide })); cloth.scale.y = h / (w * 0.87); cloth.position.y = h * 0.4; g.add(cloth);
  const door = mesh(new THREE.CircleGeometry(w * 0.32, 3), mat('#1a1410')); door.rotation.set(0, Math.PI / 2, Math.PI / 2); door.position.set(L / 2 + 0.02, h * 0.36, 0); door.scale.set(1.3, 1, 1); g.add(door);
  for (const s of [-1, 1]) { const p = mesh(new THREE.CylinderGeometry(0.08, 0.08, h * 1.15, 5), mat('#4a3420')); p.position.set(s * L / 2, h * 0.55, 0); g.add(p); }
  const patch = mesh(new THREE.PlaneGeometry(0.9, 0.7), mat('#3a3020', { side: THREE.DoubleSide })); patch.position.set(0.4, h * 0.55, w * 0.27); patch.rotation.x = -0.55; g.add(patch);
  return g;
}
export const crate = () => { const g = new THREE.Group(), b = mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), mat('#8a6a3a')); b.position.y = 0.6; g.add(b); for (const y of [0.15, 1.05]) { const s = mesh(new THREE.BoxGeometry(1.46, 0.14, 1.46), mat('#5a4020')); s.position.y = y; g.add(s); } return g; };
export const barrel = () => { const g = new THREE.Group(), b = mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.5, 10), mat('#7a5230')); b.position.y = 0.75; g.add(b); for (const y of [0.25, 1.25]) { const h = mesh(new THREE.TorusGeometry(0.64, 0.05, 4, 12), mat('#3a3a3a', { metalness: 0.6 })); h.rotation.x = Math.PI / 2; h.position.y = y; g.add(h); } return g; };
const logSeat = () => { const l = mesh(new THREE.CylinderGeometry(0.45, 0.5, 3, 7), mat('#6a4424')); l.rotation.z = Math.PI / 2; l.position.y = 0.45; const g = new THREE.Group(); g.add(l); return g; };
export function banner(color) {
  const g = new THREE.Group(), p = mesh(new THREE.CylinderGeometry(0.1, 0.12, 6, 6), mat('#4a3420')); p.position.y = 3; g.add(p);
  const f = mesh(new THREE.PlaneGeometry(1.8, 1.3, 4, 1), mat(color, { side: THREE.DoubleSide })); f.position.set(0.95, 5.1, 0); g.add(f); g.userData.flag = f;
  const skull = mesh(new THREE.SphereGeometry(0.28, 6, 5), mat('#e8e0cc')); skull.position.y = 6.1; g.add(skull);
  return g;
}
const bedroll = c => { const b = mesh(new THREE.CapsuleGeometry(0.4, 1.6, 3, 8), mat(c)); b.rotation.z = Math.PI / 2; b.scale.y = 0.45; b.position.y = 0.18; const g = new THREE.Group(); g.add(b); return g; };
// a chest left by the fire of a cleared camp
export function chest() {
  const g = new THREE.Group(), b = mesh(new THREE.BoxGeometry(1.6, 0.9, 1.1), mat('#7a4a22')); b.position.y = 0.45; g.add(b);
  const lid = mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.6, 8, 1, false, 0, Math.PI), mat('#8a5a2a')); lid.rotation.z = Math.PI / 2; lid.position.y = 0.9; g.add(lid);
  for (const x of [-0.6, 0.6]) { const s = mesh(new THREE.BoxGeometry(0.14, 1.5, 1.16), mat('#c8963c', { metalness: 0.7, roughness: 0.4 })); s.position.set(x, 0.75, 0); g.add(s); }
  const lock = mesh(new THREE.BoxGeometry(0.26, 0.3, 0.1), mat('#ffd45a', { metalness: 0.8, roughness: 0.3 })); lock.position.set(0, 0.8, 0.58); g.add(lock);
  g.userData.die = () => { }; // (it stays as it is: a body that doesn't fall over)
  return g;
}

export class Camps {
  constructor(world, monsters, player, bodies, rollLoot) {
    Object.assign(this, { world, monsters, player, bodies, rollLoot });
    this.camps = new Map(); this.t = 0;
  }
  // the camp in a cell of the world, if there is one (always the same for the same world)
  campAt(cx, cz) {
    const k = cx + ',' + cz;
    if (this.camps.has(k)) return this.camps.get(k);
    const r = hash(cx, cz, this.world.seed || 1);
    let c = null;
    if (r() < 0.45 && Math.abs(cx) + Math.abs(cz) > 0) {   // (never in the cell where the world begins)
      const x = (cx + 0.5) * CELL + (r() - 0.5) * CELL * 0.5, z = (cz + 0.5) * CELL + (r() - 0.5) * CELL * 0.5;
      c = { k, x, z, r, seed: r(), built: null, members: [], kills: 0, clearedAt: -1, kind: null };
    }
    this.camps.set(k, c);
    return c;
  }
  // the props, once the land under the camp is there
  build(c) {
    const w = this.world;
    // (on level ground only: try a few spots in the cell for one where the land within 16 is fairly flat)
    if (!c.sited) {
      c.sited = true; const rr = hash(Math.floor(c.x), Math.floor(c.z), 3); let ok = false;
      for (let tries = 0; tries < 10 && !ok; tries++) {
        const x = tries ? c.x + (rr() - 0.5) * CELL * 0.6 : c.x, z = tries ? c.z + (rr() - 0.5) * CELL * 0.6 : c.z;
        let lo = 1e9, hi = -1e9, bad = false;
        for (let i = 0; i < 13 && !bad; i++) { const a = i / 12 * 6.28, d = i ? 16 : 0, g = w.ground(x + Math.cos(a) * d, z + Math.sin(a) * d); if (g === null || g === undefined || w.seaAt(x + Math.cos(a) * d, z + Math.sin(a) * d)) bad = true; else { lo = Math.min(lo, g); hi = Math.max(hi, g); } }
        if (!bad && hi - lo < 3 && !(w.gen.castleNear && w.gen.castleNear(x, z, 40))) { c.x = x; c.z = z; ok = true; }
      }
      if (!ok) { c.none = true; return false; }
    }
    if (c.none) return false;
    const g0 = w.ground(c.x, c.z);
    if (g0 === null || g0 === undefined) return false;
    const r = hash(c.k.length, Math.floor(c.seed * 1e6), 7);
    if (!c.kind) { const col = w.gen.column(Math.floor(c.x), Math.floor(c.z)), opts = BY_BIOME[col.biome] || ['bandit']; c.kind = opts[Math.floor(r() * opts.length)]; }
    // (the trees and rocks cleared from the camp's ground)
    if (!c.clearedLand) { c.clearedLand = true; w.clearAround(c.x, c.z, 28); }
    const K = KINDS[c.kind], root = new THREE.Group(), place = (o, dx, dz, turn = 0) => { dx *= 1.35; dz *= 1.35; const gy = w.ground(c.x + dx, c.z + dz); o.position.set(c.x + dx, (gy ?? g0) - 0.1, c.z + dz); o.rotation.y = turn; o.scale.setScalar(1.6); root.add(o); return o; };
    const fire = place(campfire(), 0, 0);
    // tents round the fire, their doors facing it
    const nt = 2 + Math.floor(r() * 2), a0 = r() * 6.28;
    for (let i = 0; i < nt; i++) { const a = a0 + i * (6.28 / nt) + (r() - 0.5) * 0.4, d = 11 + r() * 3; place(tent(K.tent, r), Math.cos(a) * d, Math.sin(a) * d, -a + Math.PI); }
    for (let i = 0; i < 3; i++) { const a = a0 + (i + 0.5) * (6.28 / nt) + 0.3, d = 4.2; place(logSeat(), Math.cos(a) * d, Math.sin(a) * d, -a + Math.PI / 2); }
    for (let i = 0; i < 4; i++) { const a = r() * 6.28, d = 7 + r() * 9; place(r() < 0.5 ? crate() : barrel(), Math.cos(a) * d, Math.sin(a) * d, r() * 6); }
    for (let i = 0; i < 2; i++) { const a = r() * 6.28, d = 6.5 + r() * 2; place(bedroll(K.tent[0]), Math.cos(a) * d, Math.sin(a) * d, r() * 6); }
    c.flag = place(banner(K.flag), 0, -7.5).userData.flag;
    scene.add(root);
    c.built = { root, fire, y: g0 };
    return true;
  }
  unbuild(c) { if (!c.built) return; scene.remove(c.built.root); c.built.root.traverse(o => o.geometry && o.geometry.dispose()); c.built = null; }
  // the band round the fire: four to six, one or two of them shooting; a little stronger than those out alone
  fill(c) {
    const K = KINDS[c.kind], n = 4 + Math.floor(Math.random() * 3), w = this.world;
    c.members = []; c.kills = 0; c.size = n;
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.28 + Math.random() * 0.5, d = 7 + Math.random() * 6, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, gy = w.ground(x, z);
      const m = this.monsters.spawn(i < 2 && n > 4 ? K.ranged : i === 0 ? K.ranged : K.melee, x, (gy ?? c.built.y), z);
      m.camp = c; m.roam = 5; m.home.set(c.x + Math.cos(a) * d * 0.8, 0, c.z + Math.sin(a) * d * 0.8); m.campHome = m.home.clone();
      c.members.push(m);
    }
  }
  // a camper fell: when the last one does, the camp is cleared and a chest is left by the fire
  fell(m) {
    const c = m.camp; if (!c) return;
    c.kills++;
    if (c.kills >= c.size && c.built) {
      c.clearedAt = this.t; c.members = [];
      const ch = chest(), y = c.built.y;
      const fake = { root: ch, pos: new V3(c.x + 4.2, y, c.z + 0.8), k: { r: 1.1, h: 1.6 }, lvl: Math.max(1, stats.level + 1) };
      ch.position.copy(fake.pos); ch.rotation.y = Math.random() * 6; scene.add(ch);
      // (a chest holds more than a body: a few rolls of loot, a little better)
      const loot = this.rollLoot(fake);
      for (let i = 0; i < 2; i++) { const more = this.rollLoot(fake); if (!loot.weapon && more.weapon) loot.weapon = more.weapon; loot.items.push(...more.items); loot.gold = (loot.gold || 0) + (more.gold || 0); }
      loot.gold = (loot.gold || 0) + 10 + stats.level * 4;
      this.bodies.fall(fake, loot);
      burst(fake.pos.x, y + 1.5, fake.pos.z, '#ffd45a', 30, 8, 1.4, true, 0.9);
      if (this.onCleared) this.onCleared(c, KINDS[c.kind].name);
    }
  }
  update(dt) {
    this.t += dt;
    const p = this.player.pos, pcx = Math.floor(p.x / CELL), pcz = Math.floor(p.z / CELL), t = performance.now() / 1000;
    const near = [];
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const c = this.campAt(pcx + dx, pcz + dz); if (!c) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (!c.built && !c.none && d < BUILD_R && this.world.loaded(c.x, c.z) && this.world.loaded(c.x + 16, c.z + 16) && this.world.loaded(c.x - 16, c.z - 16)) this.build(c);
      if (c.built && d > DROP_R) this.unbuild(c);
      if (!c.built) continue;
      near.push([d, c]);
      // (fill it when you come near, unless it's freshly cleared; despawned campers come back)
      const alive = c.members.filter(m => this.monsters.list.includes(m));
      const cleared = c.clearedAt >= 0 && this.t - c.clearedAt < REFILL;
      if (d < FILL_R && !cleared && alive.length === 0) { c.clearedAt = -1; this.fill(c); }
      // anger one and the camp comes; once the fight's over they go back to the fire
      if (alive.some(m => m.state === 'chase')) for (const m of alive) { if (m.state !== 'chase' && m.pos.distanceTo(p) < 60) m.state = 'chase'; }
      for (const m of alive) if (m.state === 'wander' && m.campHome && m.home.distanceTo(m.campHome) > 1) m.home.copy(m.campHome);
      // the fire flickers, the banner waves
      const fl = c.built.fire.userData.flames;
      fl.forEach((f, i) => { f.scale.set(1, 0.8 + 0.35 * Math.sin(t * (9 + i * 2.3) + i) + 0.15 * Math.sin(t * 23 + i * 5), 1); f.rotation.y = t * (0.6 + i * 0.3); });
      if (Math.random() < dt * 6) burst(c.x + (Math.random() - 0.5), c.built.y + 2.6, c.z + (Math.random() - 0.5), Math.random() < 0.5 ? '#ffb040' : '#ff6a20', 1, 1.5, 0.3, true, 0.9, -3);
      if (c.flag) { const pa = c.flag.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i) + 0.9; pa.setZ(i, Math.sin(t * 4 - x * 2.4) * 0.18 * x); } pa.needsUpdate = true; }
    }
    // the two lights go to the nearest fires
    near.sort((a, b) => a[0] - b[0]);
    LIGHTS.forEach((l, i) => { const e = near[i]; if (!e) { l.intensity = 0; return; } const c = e[1]; l.position.set(c.x, c.built.y + 3.2, c.z); l.intensity = 14 * (0.85 + 0.15 * Math.sin(t * 13 + i) * Math.sin(t * 7.3 + i * 2)); });
  }
}
