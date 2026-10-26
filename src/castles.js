// ============================================================================
//  DUNGEON WORLD  -  castles and forts: a stronghold in about every other
//  560 x 560 stretch of the world, in every land, on ground leveled for it
//  (gen.js picks the places and flattens them; this builds them). Three kinds:
//  a stone skeleton keep (curtain walls with battlements, corner towers, a
//  gatehouse, a keep), a bandit fort (a log palisade, watchtowers on stilts,
//  a longhouse) and a goblin warcamp (a spiked palisade hung with skulls,
//  huts, a totem). Walls and towers block the way; the gate lets you in.
//  Inside: a garrison of ten or more and their chief, who's bigger, tougher
//  and carries something good. Clear it for the chest by the fire; it fills
//  again after ten minutes.
// ============================================================================
import { THREE, scene, V3 } from './engine.js';
import { burst } from './fx.js';
import { stats } from './combat.js';
import * as D from './dh/data.js';
import { hash, mat, mesh, campfire, tent, crate, barrel, banner, chest } from './camps.js';

const BUILD_R = 300, DROP_R = 520, FILL_R = 170, REFILL = 600, S = 34, GATE = 11;
const STYLES = {
  keep: { name: 'SKELETON KEEP', sub: 'the dead keep their walls', melee: [D.M_SKEL], ranged: [D.M_SKEL], chief: 'SKELETON LORD', flag: '#5a3a8a', roof: '#3a3348' },
  fort: { name: 'BANDIT FORT', sub: 'a den of cutthroats', melee: [D.M_BANDIT], ranged: [D.M_POACHER], chief: 'BANDIT CHIEF', flag: '#b8322a', roof: '#6a3a22' },
  warcamp: { name: 'GOBLIN WARCAMP', sub: 'the goblins have dug in', melee: [D.M_GOBLIN], ranged: [D.M_GOBARCHER], chief: 'GOBLIN WARBOSS', flag: '#5a8a2a', roof: '#5a4a2a' },
};
const STYLE_KEYS = ['keep', 'fort', 'warcamp'];
const LIGHT = (() => { const l = new THREE.PointLight('#ffa050', 0, 60, 1.5); scene.add(l); return l; })();

// many copies of one shape, as one instanced mesh
function inst(geo, m, list) {
  const im = new THREE.InstancedMesh(geo, m, list.length), M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  list.forEach(([x, y, z, ry = 0, sx = 1, sy = 1, sz = 1], i) => { e.set(0, ry, 0); q.setFromEuler(e); M4.compose(new V3(x, y, z), q, new V3(sx, sy, sz)); im.setMatrixAt(i, M4); });
  im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
  return im;
}
// the four sides of the square, as segments [x0, z0, x1, z1], with the gate's gap in the front (+z) side
function walls() {
  return [[-S, -S, S, -S], [S, -S, S, S], [-S, S, -S, -S], [-S, S, -GATE / 2, S], [GATE / 2, S, S, S]];
}
const along = ([x0, z0, x1, z1], step, f) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / step)), a = Math.atan2(x1 - x0, z1 - z0); for (let i = 0; i <= n; i++) { const t = i / n; f(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, a, L); } };

export class Castles {
  constructor(world, monsters, player, bodies, rollLoot) {
    Object.assign(this, { world, monsters, player, bodies, rollLoot });
    this.list = new Map(); this.t = 0;
  }
  get(c) {
    if (!this.list.has(c.k)) { const r = hash(Math.floor(c.x), Math.floor(c.z), 91); this.list.set(c.k, { ...c, style: STYLE_KEYS[Math.floor(c.r * 3)], turn: Math.floor(r() * 4) * Math.PI / 2, rnd: r, built: null, members: [], kills: 0, size: 0, clearedAt: -1, greeted: false }); }
    return this.list.get(c.k);
  }
  // castle space to the world: rotated by its turn, around its middle
  toWorld(c, x, z) { const s = Math.sin(c.turn), co = Math.cos(c.turn); return [c.x + x * co + z * s, c.z - x * s + z * co]; }
  build(c) {
    const w = this.world, y0 = w.ground(c.x, c.z);
    if (y0 === null || y0 === undefined) return;
    const st = STYLES[c.style], root = new THREE.Group(), r = hash(Math.floor(c.x), Math.floor(c.z), 92);
    root.position.set(c.x, y0, c.z); root.rotation.y = c.turn;
    const add = (o, x, z, ry = 0) => { o.position.set(x, o.position.y, z); o.rotation.y = ry; root.add(o); return o; };
    const post = (x, z, rad) => { const [wx, wz] = this.toWorld(c, x, z); w.addCollider(wx, wz, rad); };
    const WS = walls();
    if (c.style === 'keep') {
      // curtain walls of stone with battlements
      const stone = mat('#8a8680'), dark = mat('#6a6660'), wallH = 9;
      for (const s of WS) { const [x0, z0, x1, z1] = s, L = Math.hypot(x1 - x0, z1 - z0), wl = mesh(new THREE.BoxGeometry(2.2, wallH, L), stone); wl.position.y = wallH / 2; add(wl, (x0 + x1) / 2, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0)); along(s, 1.6, (x, z) => post(x, z, 1.4)); }
      const merl = []; for (const s of WS) along(s, 2.4, (x, z, a) => merl.push([x, wallH + 0.6, z, a]));
      root.add(inst(new THREE.BoxGeometry(2.4, 1.2, 1.2), dark, merl));
      // corner towers with pointed roofs, a gatehouse
      for (const [x, z] of [[-S, -S], [S, -S], [-S, S], [S, S]]) { const t = mesh(new THREE.CylinderGeometry(4.6, 5.2, 16, 10), stone); t.position.y = 8; add(t, x, z); const roof = mesh(new THREE.ConeGeometry(5.8, 7, 10), mat(st.roof)); roof.position.y = 19.5; add(roof, x, z); post(x, z, 5.4); }
      for (const s of [-1, 1]) { const g = mesh(new THREE.CylinderGeometry(3, 3.4, 13, 8), stone); g.position.y = 6.5; add(g, s * (GATE / 2 + 2.6), S); post(s * (GATE / 2 + 2.6), S, 3.6); const roof = mesh(new THREE.ConeGeometry(3.8, 5, 8), mat(st.roof)); roof.position.y = 15.5; add(roof, s * (GATE / 2 + 2.6), S); }
      const lintel = mesh(new THREE.BoxGeometry(GATE + 2, 3, 2.6), dark); lintel.position.y = 10; add(lintel, 0, S);
      // the keep
      const keep = mesh(new THREE.BoxGeometry(16, 18, 14), stone); keep.position.y = 9; add(keep, 0, -14);
      const kroof = mesh(new THREE.ConeGeometry(12.5, 8, 4), mat(st.roof)); kroof.position.y = 22; kroof.rotation.y = Math.PI / 4; add(kroof, 0, -14, Math.PI / 4);
      const door = mesh(new THREE.PlaneGeometry(4, 6), mat('#1a1410')); door.position.y = 3; add(door, 0, -6.95);
      for (let x = -8; x <= 8; x += 2) { post(x, -7, 1.3); post(x, -21, 1.3); } for (let z = -21; z <= -7; z += 2) { post(-8, z, 1.3); post(8, z, 1.3); }
      for (const [x, z] of [[-6, 10], [7, 12], [-14, -2], [14, 0], [-20, 20]]) add(r() < 0.5 ? crate() : barrel(), x, z, r() * 6);
    } else {
      // a palisade of sharpened logs
      const wood = mat(c.style === 'fort' ? '#7a5230' : '#6a4a2a'), tip = mat('#a88a5a'), logs = [], tips = [];
      for (const s of WS) along(s, 1.15, (x, z) => { const h = 7.5 + r() * 1.6; logs.push([x, h / 2, z, r() * 6, 1, h / 8, 1]); tips.push([x, h + 0.7, z]); post(x, z, 0.9); });
      root.add(inst(new THREE.CylinderGeometry(0.55, 0.6, 8, 7), wood, logs));
      root.add(inst(new THREE.ConeGeometry(0.58, 1.4, 7), tip, tips));
      // watchtowers on stilts at the corners and by the gate
      const towerAt = (x, z) => { const g = new THREE.Group(); for (const [a, b] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) { const p = mesh(new THREE.CylinderGeometry(0.3, 0.35, 11, 6), wood); p.position.set(a, 5.5, b); g.add(p); }
        const plat = mesh(new THREE.BoxGeometry(5.2, 0.5, 5.2), wood); plat.position.y = 11; g.add(plat);
        for (const [a, b, ry] of [[0, -2.5, 0], [0, 2.5, 0], [-2.5, 0, Math.PI / 2], [2.5, 0, Math.PI / 2]]) { const rail = mesh(new THREE.BoxGeometry(5.2, 1.2, 0.3), wood); rail.position.set(a, 11.8, b); rail.rotation.y = ry; g.add(rail); }
        const roof = mesh(new THREE.ConeGeometry(4.4, 3.4, 4), mat(st.roof)); roof.position.y = 15; roof.rotation.y = Math.PI / 4; g.add(roof);
        add(g, x, z); post(x, z, 3); };
      for (const [x, z] of [[-S, -S], [S, -S], [-S, S], [S, S], [-GATE / 2 - 3, S - 3], [GATE / 2 + 3, S - 3]]) towerAt(x, z);
      if (c.style === 'fort') {
        // a longhouse at the back
        const lh = new THREE.Group(), body = mesh(new THREE.BoxGeometry(20, 6, 10), wood); body.position.y = 3; lh.add(body);
        const rg = new THREE.CylinderGeometry(7.4, 7.4, 21, 3, 1, true); rg.rotateZ(Math.PI / 2); const rf = mesh(rg, mat(st.roof, { side: THREE.DoubleSide })); rf.position.y = 8.2; rf.scale.set(1, 0.55, 0.78); lh.add(rf);
        const d = mesh(new THREE.PlaneGeometry(3, 4.4), mat('#1a1410')); d.position.set(0, 2.2, 5.02); lh.add(d);
        add(lh, 0, -18); for (let x = -10; x <= 10; x += 2) { post(x, -13, 1.2); post(x, -23, 1.2); } for (let z = -23; z <= -13; z += 2) { post(-10, z, 1.2); post(10, z, 1.2); }
        for (const [x, z] of [[-12, 8], [12, 6], [-20, -4], [18, -6], [6, 14]]) add(r() < 0.5 ? crate() : barrel(), x, z, r() * 6);
      } else {
        // huts and a totem hung with skulls
        for (const [x, z, a] of [[-16, -16, 0.6], [14, -18, -0.5], [-20, 4, 1.4], [20, 2, -1.4]]) { const t = tent(['#5a4a2a', '#4a5a2a', '#6a4a2a'], r); t.scale.setScalar(1.7); add(t, x, z, a); post(x, z, 3.2); }
        const totem = new THREE.Group(), pole = mesh(new THREE.CylinderGeometry(0.6, 0.8, 10, 7), wood); pole.position.y = 5; totem.add(pole);
        for (let i = 0; i < 3; i++) { const sk = mesh(new THREE.SphereGeometry(0.7, 7, 6), mat('#e8e0cc')); sk.position.set(0, 4 + i * 2.2, 0.7); totem.add(sk); }
        const horns = mesh(new THREE.TorusGeometry(1.4, 0.18, 5, 10, Math.PI), mat('#e8e0cc')); horns.position.y = 10.4; totem.add(horns);
        add(totem, 0, -6); post(0, -6, 1);
        // skulls on the palisade
        const sk = []; for (const s of WS) along(s, 6, (x, z) => sk.push([x, 9.3, z])); root.add(inst(new THREE.SphereGeometry(0.55, 6, 5), mat('#e8e0cc'), sk));
      }
    }
    // the fire in the yard, banners by the gate
    const fire = campfire(); fire.scale.setScalar(1.6); add(fire, 0, 8);
    for (const s of [-1, 1]) { const b = banner(st.flag); b.scale.setScalar(1.5); add(b, s * (GATE / 2 + 0.5), S + 3); }
    scene.add(root);
    c.built = { root, fire, y: y0 };
  }
  unbuild(c) {
    if (!c.built) return;
    scene.remove(c.built.root); c.built.root.traverse(o => { if (o.isInstancedMesh) o.dispose(); else if (o.geometry) o.geometry.dispose(); });
    this.world.removeColliders((x, z) => Math.hypot(x - c.x, z - c.z) < S * 1.6);
    c.built = null;
  }
  // the garrison: ten to fourteen about the yard, a third of them shooting, and the chief by the keep
  fill(c) {
    const st = STYLES[c.style], w = this.world, n = 10 + Math.floor(Math.random() * 5);
    c.members = []; c.kills = 0;
    const spawn = (type, x, z, roam) => { const [wx, wz] = this.toWorld(c, x, z), gy = w.ground(wx, wz); const m = this.monsters.spawn(type, wx, gy ?? c.built.y, wz); m.castle = c; m.roam = roam; m.home.set(wx, 0, wz); m.campHome = m.home.clone(); c.members.push(m); return m; };
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * (S * 1.5), z = -4 + (Math.random() - 0.5) * (S * 1.3);
      spawn(i % 3 === 0 ? st.ranged[0] : st.melee[0], x, z, 7);
    }
    const chief = spawn(st.melee[0], 0, -4, 3);
    chief.elite = true; chief.name = st.chief; chief.lvl += 2;
    chief.maxHp = chief.hp = Math.round(chief.maxHp * 5); chief.atk = Math.round(chief.atk * 1.7);
    chief.root.scale.multiplyScalar(1.4); chief.k = { ...chief.k, r: chief.k.r * 1.4, h: chief.k.h * 1.4 };
    c.size = c.members.length;
  }
  // the chief carries something good
  boost(m, loot) {
    if (!m.elite) return loot;
    const more = this.rollLoot({ ...m, lvl: m.lvl });
    loot.items.push(...more.items); loot.gold = (loot.gold || 0) + 25 + stats.level * 6;
    if (loot.weapon || more.weapon) { const wpn = loot.weapon || more.weapon; wpn.rarity = Math.random() < 0.3 ? 'legendary' : 'epic'; loot.weapon = wpn; }
    return loot;
  }
  fell(m) {
    const c = m.castle; if (!c) return;
    c.kills++;
    if (c.kills >= c.size && c.built) {
      c.clearedAt = this.t; c.members = [];
      const [x, z] = this.toWorld(c, 3, 2), y = c.built.y, ch = chest(); ch.scale.setScalar(1.4);
      const fake = { root: ch, pos: new V3(x, y, z), k: { r: 1.5, h: 2 }, lvl: Math.max(1, stats.level + 2), name: 'CHEST' };
      ch.position.copy(fake.pos); scene.add(ch);
      const loot = this.rollLoot(fake);
      for (let i = 0; i < 3; i++) { const more = this.rollLoot(fake); if (!loot.weapon && more.weapon) loot.weapon = more.weapon; loot.items.push(...more.items); loot.gold = (loot.gold || 0) + (more.gold || 0); }
      if (loot.weapon && loot.weapon.rarity !== 'legendary') loot.weapon.rarity = 'epic';
      loot.gold = (loot.gold || 0) + 40 + stats.level * 10;
      this.bodies.fall(fake, loot);
      burst(x, y + 2, z, '#ffd45a', 40, 10, 1.6, true, 1);
      if (this.onCleared) this.onCleared(c, STYLES[c.style].name);
    }
  }
  update(dt) {
    this.t += dt;
    const g = this.world.gen; if (!g || !g.castleIn) return;
    const p = this.player.pos, CC = g.CASTLE_CELL, i0 = Math.floor(p.x / CC), j0 = Math.floor(p.z / CC), t = performance.now() / 1000;
    let nearest = null, nd = 1e9;
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      const site = g.castleIn(i, j); if (!site) continue;
      const c = this.get(site), d = Math.hypot(c.x - p.x, c.z - p.z);
      if (!c.built && d < BUILD_R && this.world.loaded(c.x, c.z)) this.build(c);
      if (c.built && d > DROP_R) this.unbuild(c);
      if (!c.built) continue;
      if (d < nd) { nd = d; nearest = c; }
      const alive = c.members.filter(m => this.monsters.list.includes(m));
      const cleared = c.clearedAt >= 0 && this.t - c.clearedAt < REFILL;
      if (d < FILL_R && !cleared && alive.length === 0) { c.clearedAt = -1; this.fill(c); }
      // (the yard rises as one; when the fight's done they go back to their posts)
      if (alive.some(m => m.state === 'chase')) for (const m of alive) { if (m.state !== 'chase' && m.pos.distanceTo(p) < 90) m.state = 'chase'; }
      for (const m of alive) if (m.state === 'wander' && m.campHome && m.home.distanceTo(m.campHome) > 1) m.home.copy(m.campHome);
      // (a banner across the screen the first time you come to its gate)
      if (d < 70 && !c.greeted && !cleared) { c.greeted = true; if (this.onEnter) this.onEnter(STYLES[c.style].name, STYLES[c.style].sub); }
      if (d > 140) c.greeted = false;
      const fl = c.built.fire.userData.flames; fl.forEach((f, k) => f.scale.set(1, 0.8 + 0.35 * Math.sin(t * (9 + k * 2.3) + k), 1));
    }
    if (nearest) { const [x, z] = this.toWorld(nearest, 0, 8); LIGHT.position.set(x, nearest.built.y + 5, z); LIGHT.intensity = 18 * (0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3)); } else LIGHT.intensity = 0;
  }
}
