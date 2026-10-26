// ============================================================================
//  DUNGEON WORLD  -  combat: the hero's attacks (the mage's bolts and blink),
//  the monsters roaming the land (Dungeon Heart's models, picked by biome,
//  each kind with its own telegraphed way of fighting), their shots, health
//  bars, damage, XP, levels and healing.
// ============================================================================
import { THREE, scene, camera, TEX, V3 } from './engine.js';
import { buildMonster } from './dh/models.js';
import { kay, makeKaySkeleton, makeGoblin, IS_GOB } from './kayhero.js';
import * as D from './dh/data.js';
import { burst, ring, number } from './fx.js';
import { sfx } from './audio.js';
import { CH } from './gen.js';

// ---------------------------------------------------------------- the hero's numbers
export const stats = { hp: 30, maxHp: 30, xp: 0, level: 1, kills: 0, dead: 0 };
export const xpToNext = () => 18 + stats.level * 10;
// the hero's buffs that touch every blow (battle shout, bestial wrath...): set by the abilities each frame
export const heroBuff = { dmg: 1 };
export const heroDamage = (mult = 1) => {
  mult *= heroBuff.dmg;
  const base = 5 + stats.level * 1.5;
  const crit = Math.random() < 0.12;
  return { d: Math.max(1, Math.round(base * mult * (0.85 + Math.random() * 0.3) * (crit ? 2 : 1))), crit };
};
// a monster's health, made to match what a hero of its level hits for: the hero's base blow at that level times
// what an on-level weapon adds (its item level), over about six seconds of plain auto-attacks, for an average
// monster (a slime a little less, a skeleton a little more, the big ones a lot more)
export const monHp = (type, lvl) => Math.max(8, Math.round((5 + lvl * 1.5) * (1 + (lvl - 1) * 0.05) * 6 * (0.6 + D.MON_BASE_HP[type] / 15)));
export function gainXp(n, onLevel) {
  stats.xp += n;
  while (stats.xp >= xpToNext()) { stats.xp -= xpToNext(); stats.level++; stats.maxHp += 6; stats.hp = stats.maxHp; onLevel && onLevel(stats.level); }
}

// ---------------------------------------------------------------- monsters
// per type: speed (blocks a second), the body's radius and height, flying, how far it sees, and how it
// fights: melee (walks up, winds up, strikes), hop (slimes bounce at you), swoop (bats dive from the air),
// pounce (spiders crouch and leap), phase (ghosts blink behind you), shot (imps, sprites and wisps keep
// their distance and throw), charge (crabs rush in a line)
export const KIND = {
  [D.M_SLIME]: { spd: 6.4, r: 1.8, h: 2.6, fly: 0, see: 28, atk: 'hop' },
  [D.M_BAT]: { spd: 12, r: 1.2, h: 1.6, fly: 1, see: 36, atk: 'swoop', hover: 7 },
  [D.M_SKEL]: { spd: 8, r: 1.2, h: 4.4, fly: 0, see: 36, atk: 'melee' },
  [D.M_SPIDER]: { spd: 10.4, r: 1.8, h: 1.8, fly: 0, see: 30, atk: 'pounce' },
  [D.M_GHOST]: { spd: 7.2, r: 1.6, h: 4, fly: 1, see: 40, atk: 'phase', hover: 3.2 },
  [D.M_IMP]: { spd: 10, r: 1.2, h: 3, fly: 0, see: 32, atk: 'shot', shot: { color: '#ff7a2a', spd: 32, range: 20, cd: 2.4 } },
  [D.M_FIRESPRITE]: { spd: 9, r: 1.2, h: 2.4, fly: 1, see: 32, atk: 'shot', shot: { color: '#ffb340', spd: 38, range: 16, cd: 1.5 } },
  [D.M_WISP]: { spd: 8, r: 1.2, h: 2.4, fly: 1, see: 36, atk: 'shot', shot: { color: '#b0f0ff', spd: 46, range: 26, cd: 2.6 } },
  [D.M_HELLCRAB]: { spd: 6.8, r: 2, h: 2.2, fly: 0, see: 28, atk: 'charge' },
  [D.M_VBAT]: { spd: 13, r: 1.4, h: 1.8, fly: 1, see: 40, atk: 'swoop', hover: 7 },
  [D.M_GOBLIN]: { spd: 9.5, r: 1.1, h: 3.2, fly: 0, see: 34, atk: 'melee' },
  [D.M_GOBARCHER]: { spd: 9, r: 1.1, h: 3.2, fly: 0, see: 40, atk: 'shot', shot: { color: '#d8c890', spd: 52, range: 26, cd: 2.2 } },
  [D.M_BANDIT]: { spd: 9, r: 1.2, h: 4.3, fly: 0, see: 36, atk: 'melee' },
  [D.M_POACHER]: { spd: 8.5, r: 1.2, h: 4.3, fly: 0, see: 44, atk: 'shot', shot: { color: '#c8b080', spd: 60, range: 30, cd: 2.6 } },
};
const HERO_MID = 2.6;      // the hero's middle above its feet
const REGEN_AFTER = 6, REGEN_EVERY = 1.2;   // seconds unhurt before healing starts; seconds per point
// who lives where: forest, snow, desert, swamp, lava, crystal
const BY_BIOME = [
  [D.M_SLIME, D.M_SLIME, D.M_BAT, D.M_SPIDER, D.M_GOBLIN, D.M_GOBLIN, D.M_GOBARCHER, D.M_BANDIT, D.M_POACHER],
  [D.M_SKEL, D.M_SKEL, D.M_BAT, D.M_GHOST, D.M_GOBLIN, D.M_GOBARCHER],
  [D.M_HELLCRAB, D.M_HELLCRAB, D.M_SKEL, D.M_VBAT, D.M_BANDIT, D.M_BANDIT, D.M_POACHER],
  [D.M_GHOST, D.M_SLIME, D.M_SPIDER, D.M_VBAT, D.M_GOBLIN, D.M_GOBLIN],
  [D.M_IMP, D.M_IMP, D.M_FIRESPRITE, D.M_HELLCRAB],
  [D.M_WISP, D.M_WISP, D.M_GHOST, D.M_SPIDER],
];
const MAX_NEAR = 9, SPAWN_MIN = 48, SPAWN_MAX = 104, DESPAWN = 192;
const barMats = {
  back: new THREE.SpriteMaterial({ color: '#000000', transparent: true, opacity: 0.6, depthWrite: false, depthTest: false }),
  fill: new THREE.SpriteMaterial({ color: '#5ce65c', transparent: true, opacity: 0.95, depthWrite: false, depthTest: false }),
};
const shotGeo = new THREE.SphereGeometry(0.5, 10, 7);
const camRight = new THREE.Vector3();

// the monster under a screen point (x, y in pixels; w, h the canvas size), if any: by its projected size
const prj = new THREE.Vector3();
export function pickMonster(monsters, x, y, w, h) {
  let best = null, bd = 1e9;
  const f = (h / 2) / Math.tan(camera.fov * Math.PI / 360);
  for (const m of monsters.list) {
    prj.set(m.pos.x, m.pos.y + m.k.h * 0.6, m.pos.z);
    const dist = prj.distanceTo(camera.position); if (dist > 120) continue;
    prj.project(camera); if (prj.z > 1) continue;
    const sx = (prj.x + 1) / 2 * w, sy = (1 - prj.y) / 2 * h, r = Math.max(14, Math.max(m.k.r, m.k.h * 0.6) * f / dist * 1.3);
    const d = Math.hypot(sx - x, sy - y);
    if (d < r && dist < bd) { bd = dist; best = m; }
  }
  return best;
}
export class Monsters {
  constructor(world, player) {
    this.world = world; this.player = player; this.list = []; this.spawnT = 2; this.timer = 0;
    this.hooks = { hurt: null, level: null, dead: null, fallen: null, armor: null, absorb: null };
    this.shots = [];                 // what the ranged ones throw
    this.focus = null;               // the one clicked on: attacks aim at it
    this.focusRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color: '#ff6a55', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.focusRing.rotation.x = -Math.PI / 2; this.focusRing.visible = false; scene.add(this.focusRing);
    this.calm = 0; this.regenAcc = 0; // seconds since the hero was last hurt; healing in progress
  }
  spawn(type, x, y, z) {
    // (the skeletons are KayKit's, once its models are in)
    if (IS_GOB(type) && !kay.ready) type = D.M_SKEL;   // (goblins and bandits once their models are in)
    const kk = (type === D.M_SKEL || IS_GOB(type)) && kay.ready;
    const root = !kk ? buildMonster(type, 1 + Math.floor(stats.level / 3)) : type === D.M_SKEL ? makeKaySkeleton(KIND[type].h * 0.95) : makeGoblin(type, KIND[type].h);
    if (!kk) root.scale.multiplyScalar(1.24);
    root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    scene.add(root);
    const k = KIND[type];
    // (every monster is near your level, wherever you are: the lands are all mixed up, so the danger goes with you)
    const lvl = Math.max(1, stats.level + Math.floor(Math.random() * 3) - 1);
    const m = { type, k, root, name: D.MON_NAME[type] || 'MONSTER', lvl, pos: new V3(x, y, z), vel: new V3(), home: new V3(x, y, z), face: Math.random() * 6.28, seed: Math.random() * 10,
      hp: monHp(type, lvl), atk: D.MON_BASE_ATK[type] + Math.floor(lvl * 0.8), state: 'wander', t: Math.random() * 2, atkCd: 1 + Math.random(), flash: 0, frz: 0, kb: new V3(), onGround: false, moving: false, bob: Math.random() * 6,
      wind: 0, act: null, lastAct: null, daze: 0, hopCd: 0, leap: 0, dive: null, rush: null, barT: 0, bar: null, tint: '' };
    m.maxHp = m.hp;
    this.list.push(m);
    return m;
  }
  // a health bar over a hurt monster, for a few seconds after each hit
  showBar(m) {
    m.barT = 4;
    if (!m.bar) {
      const g = new THREE.Group();
      const back = new THREE.Sprite(barMats.back); back.scale.set(3.8, 0.55, 1);
      const fill = new THREE.Sprite(barMats.fill.clone()); fill.center.set(0, 0.5); fill.scale.set(3.5, 0.38, 1);
      g.add(back, fill); g.userData.fill = fill; scene.add(g); m.bar = g;
    }
    const f = Math.max(0, m.hp / m.maxHp);
    m.bar.userData.fill.scale.x = 3.5 * f;
    m.bar.userData.fill.material.color.set(f > 0.5 ? '#5ce65c' : f > 0.25 ? '#ffc93c' : '#ff4a3c');
    m.bar.visible = true;
  }
  // a new monster somewhere out of sight, in the biome it stands in
  trySpawn() {
    const p = this.player.pos, w = this.world;
    let near = 0; for (const m of this.list) if (m.pos.distanceTo(p) < 100) near++;
    if (near >= MAX_NEAR) return;
    for (let tries = 0; tries < 6; tries++) {
      const a = Math.random() * Math.PI * 2, d = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
      const x = Math.floor(p.x + Math.cos(a) * d) + 0.5, z = Math.floor(p.z + Math.sin(a) * d) + 0.5;
      if (!w.loaded(x, z)) continue;
      // (not in front of the camera: they appear behind you and off to the sides)
      const fx = -Math.sin(this.player.yaw), fz = -Math.cos(this.player.yaw);
      if (((x - p.x) * fx + (z - p.z) * fz) / d > 0.3 && d < 60) continue;
      let gy;
      if (w.poly) { const g = w.ground(x, z); if (g === null || w.seaAt(x, z)) continue; gy = g; }
      else { const g = w.groundY(x, z); if (g < 0 || w.water(x, g + 1, z) || w.lava(x, g + 1, z) || w.lava(x, g, z)) continue; gy = g + 1; }
      const biome = w.gen.column(Math.floor(x), Math.floor(z)).biome;
      const types = BY_BIOME[biome], type = types[Math.floor(Math.random() * types.length)];
      this.spawn(type, x, gy + (KIND[type].fly ? 5 : 0), z);
      return;
    }
  }
  remove(m) {
    scene.remove(m.root); m.root.traverse(o => o.geometry && o.geometry.dispose());
    if (m.bar) { scene.remove(m.bar); m.bar.userData.fill.material.dispose(); }
    this.list.splice(this.list.indexOf(m), 1);
  }
  // the hero's bolt or blade lands on one
  hit(m, dmg, crit, dir) {
    if (m.taming) return;   // (being tamed: blows hold off)
    m.hp -= dmg; m.flash = 0.18; m.state = 'chase';
    m.kb.set(dir.x * 14, 0, dir.z * 14);
    if (crit && m.wind > 0) { m.wind = 0; m.act = null; m.atkCd = Math.max(m.atkCd, 0.8); }   // a critical hit breaks a wind-up
    if (m.hp > 0) this.showBar(m);
    const c = m.pos.clone(); c.y += m.k.h * 0.6;
    number(c.x, c.y + 1.2, c.z, dmg, crit ? 'crit' : '');
    burst(c.x, c.y, c.z, crit ? '#ffd45a' : '#ffffff', crit ? 10 : 6, 8, 1, true, 0.35);
    sfx(crit ? 'crit' : 'hit');
    if (m.hp <= 0) {
      this.spawnT = Math.max(this.spawnT, 10);
      burst(c.x, c.y, c.z, '#ffffff', 14, 12, 1.8, false, 0.6);
      ring(m.pos.x, m.pos.y + 0.1, m.pos.z, '#ffe08a', 0.8, 5, 0.4);
      sfx('kill');
      stats.kills++;
      gainXp(3 + D.MON_BASE_XP[m.type] + Math.max(0, (m.lvl || 1) - 1), this.hooks.level);
      // (the body may stay on the ground, with whatever it carried: the fallen hook takes the model)
      if (this.hooks.fallen && this.hooks.fallen(m)) { if (m.bar) { scene.remove(m.bar); m.bar.userData.fill.material.dispose(); } this.list.splice(this.list.indexOf(m), 1); }
      else this.remove(m);
      return true;
    }
    return false;
  }
  // the hero takes a blow from a point (a bite, a shot, a charge); shove is how hard it throws him
  hurt(dmg, fx, fz, shove = 18) {
    const p = this.player;
    if (p.invT > 0 || stats.hp <= 0) return false;
    if (this.hooks.absorb) { dmg = this.hooks.absorb(dmg); if (dmg <= 0) { number(p.pos.x, p.pos.y + 5.2, p.pos.z, 'ABSORB', ''); p.invT = 0.4; return false; } }
    const cut = this.hooks.armor ? this.hooks.armor() : 0;   // (worn armor turns part of it aside)
    dmg = Math.max(1, Math.round(dmg * (1 - cut)));
    stats.hp = Math.max(0, stats.hp - dmg);
    this.calm = 0; this.regenAcc = 0;
    p.invT = 0.7; p.hurtT = 0.4;
    const dx = p.pos.x - fx, dz = p.pos.z - fz, l = Math.hypot(dx, dz) || 1;
    p.vel.x += dx / l * shove; p.vel.z += dz / l * shove; p.vel.y = Math.max(p.vel.y, shove * 0.45);
    number(p.pos.x, p.pos.y + 5.2, p.pos.z, dmg, 'hurt');
    this.hooks.hurt && this.hooks.hurt();
    if (stats.hp <= 0) this.hooks.dead && this.hooks.dead();
    return true;
  }
  // a monster's bite
  bite(m, mult = 1, shove = 18) { return this.hurt(Math.round(m.atk * mult), m.pos.x, m.pos.z, shove); }
  // is the hero within reach of this monster (flat distance, and near enough in height)?
  inReach(m, d, reach, dy = 6) { return d < m.k.r + reach && Math.abs(m.pos.y - this.player.pos.y) < dy; }
  // a wind-up: the monster stands still and glows for a moment, then does the act
  windUp(m, act, secs) { m.wind = secs; m.act = act; m.lunge = 0; burst(m.pos.x, m.pos.y + m.k.h * 0.7, m.pos.z, '#ffb040', 4, 3, 0.8, true, 0.3, 0); }
  // what a ranged one throws: a glowing ball that flies at where the hero is now
  throwAt(m) {
    const p = this.player, s = m.k.shot;
    const from = new V3(m.pos.x, m.pos.y + m.k.h * 0.7, m.pos.z);
    const dir = new V3(p.pos.x, p.pos.y + HERO_MID, p.pos.z).sub(from).normalize();
    const g = new THREE.Group();
    g.add(new THREE.Mesh(shotGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(s.color).lerp(new THREE.Color('#ffffff'), 0.5) })));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: s.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); glow.scale.setScalar(3.6); g.add(glow);
    g.position.copy(from); scene.add(g);
    this.shots.push({ g, pos: from, vel: dir.multiplyScalar(s.spd), t: 0, color: s.color, dmg: m.atk, m });
    m.lunge = 0.3; sfx('cast');
  }
  updateShots(dt) {
    const p = this.player, w = this.world;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const b = this.shots[i]; b.t += dt;
      b.pos.addScaledVector(b.vel, dt);
      const gnd = w.poly ? w.ground(b.pos.x, b.pos.z) : null;
      const hitGround = w.poly ? (gnd !== null && b.pos.y < gnd) : w.solid(b.pos.x, b.pos.y, b.pos.z);
      const toHero = Math.hypot(b.pos.x - p.pos.x, (b.pos.y - p.pos.y - HERO_MID) * 0.7, b.pos.z - p.pos.z);
      let gone = hitGround || b.t > 3 || b.pos.y < 0;
      if (!gone && toHero < 2.4 && stats.hp > 0) { this.hurt(b.dmg, b.pos.x - b.vel.x, b.pos.z - b.vel.z, 10); gone = true; }
      if (gone) { burst(b.pos.x, b.pos.y, b.pos.z, b.color, 8, 7, 1.2, true, 0.35); scene.remove(b.g); b.g.traverse(o => o.material && o.material.dispose()); this.shots.splice(i, 1); continue; }
      b.g.position.copy(b.pos);
      if (Math.random() < 0.5) burst(b.pos.x, b.pos.y, b.pos.z, b.color, 1, 1, 1, true, 0.25, 0);
    }
  }
  update(dt) {
    this.updateShots(dt);
    // the focused one: a ring at its feet, until it dies or is far away
    if (this.focus && (!this.list.includes(this.focus) || this.focus.pos.distanceTo(this.player.pos) > 90)) this.focus = null;
    this.focusRing.visible = !!this.focus;
    if (this.focus) { const m = this.focus; this.focusRing.position.set(m.pos.x, m.pos.y + 0.12, m.pos.z); const sc = m.k.r * 1.4; this.focusRing.scale.set(sc, sc, sc); this.focusRing.material.opacity = 0.6 + 0.3 * Math.sin(performance.now() / 150); }
    // healing, once the fight has been over a while
    if (stats.hp > 0 && stats.hp < stats.maxHp) {
      this.calm += dt;
      if (this.calm > REGEN_AFTER) { this.regenAcc += dt; while (this.regenAcc >= REGEN_EVERY && stats.hp < stats.maxHp) { this.regenAcc -= REGEN_EVERY; stats.hp++; } }
    }
    const w = this.world, p = this.player, hero = p.pos, t = performance.now() / 1000;
    this.timer += dt * 60;
    this.spawnT -= dt;
    // new ones wander in (one every 3.5 s or so, ahead of you too once they're far enough), never while you're in a fight, and a kill buys 10 s of quiet
    if (this.spawnT <= 0 && !this.world.flat) { this.spawnT = 3.5; if (!this.list.some(m => m.state === 'chase')) this.trySpawn(); }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i], k = m.k;
      const d = m.pos.distanceTo(hero);
      if (d > DESPAWN) { this.remove(m); continue; }
      if (!w.loaded(m.pos.x, m.pos.z)) continue;
      m.t -= dt; m.atkCd -= dt; m.hopCd -= dt; m.daze = Math.max(0, m.daze - dt); m.leap = Math.max(0, m.leap - dt);
      const frozen = m.frz > 0; if (frozen) m.frz -= dt;
      // bleeds and stings: damage every so often until they run out
      if (m.dots && m.dots.length) { for (let j = m.dots.length - 1; j >= 0; j--) { const D2 = m.dots[j]; D2.t -= dt; D2.acc += dt; if (D2.acc >= D2.every) { D2.acc -= D2.every; if (this.hit(m, D2.dmg, false, new V3())) break; } if (D2.t <= 0) m.dots.splice(j, 1); } if (!this.list.includes(m)) continue; }
      if (m.slow > 0) m.slow -= dt;
      // what it wants
      const alive = stats.hp > 0;
      if (m.state === 'wander') {
        if (alive && d < k.see) { m.state = 'chase'; }
        else if (m.t <= 0) { m.t = 2 + Math.random() * 3; const a = Math.random() * 6.28, r = Math.random() * (m.roam ?? 16); m.goal = new V3(m.home.x + Math.cos(a) * r, 0, m.home.z + Math.sin(a) * r); m.rest = Math.random() < 0.4; }
      } else if (m.state === 'chase') {
        if (!alive || d > k.see * 2.2 || m.pos.distanceTo(m.home) > 120) { m.state = 'wander'; m.t = 0; m.home.copy(m.pos); m.wind = 0; m.act = null; }
        m.goal = hero; m.rest = false;
      }
      const chasing = m.state === 'chase' && alive && !frozen;
      const toHero = { x: (hero.x - m.pos.x) / (d || 1), z: (hero.z - m.pos.z) / (d || 1) };
      // a wind-up ends in the act it was for
      if (m.wind > 0) {
        m.wind -= dt;
        if (m.wind <= 0) {
          const act = m.act; m.act = null; m.lastAct = act;
          if (frozen || !alive) { /* nothing: it was stopped */ }
          else if (act === 'strike') { if (this.inReach(m, d, 3.8)) this.bite(m); m.lunge = 0.3; m.atkCd = 1.3; }
          else if (act === 'throw') { this.throwAt(m); m.atkCd = k.shot.cd; }
          else if (act === 'pounce') { const sp = Math.min(30, Math.max(14, d / 0.55)); m.vel.set(toHero.x * sp, 15, toHero.z * sp); m.leap = 0.9; m.onGround = false; m.atkCd = 2.4; sfx('roll'); }
          else if (act === 'rush') { m.rush = { t: 0.75, x: toHero.x, z: toHero.z, hit: false }; m.atkCd = 3.2; sfx('roar'); }
          else if (act === 'phase') {
            // gone, and back again right behind the hero
            const bx = hero.x + Math.sin(p.yaw) * 4.5, bz = hero.z + Math.cos(p.yaw) * 4.5;
            burst(m.pos.x, m.pos.y + k.h * 0.5, m.pos.z, '#b08cff', 12, 6, 1.4, true, 0.5, 0);
            m.pos.x = bx; m.pos.z = bz; m.home.copy(m.pos); m.vel.set(0, 0, 0);
            burst(bx, m.pos.y + k.h * 0.5, bz, '#b08cff', 12, 6, 1.4, true, 0.5, 0); sfx('blink');
            m.atkCd = 0.5;
          }
        }
      }
      // move toward the goal (each kind in its way)
      let gx = 0, gz = 0, want = 0;
      if (m.goal && !m.rest) {
        gx = m.goal.x - m.pos.x; gz = m.goal.z - m.pos.z;
        const l = Math.hypot(gx, gz);
        let stop = m.state === 'chase' ? k.r + 1.8 : 1.2;
        if (k.atk === 'shot' && m.state === 'chase') stop = k.shot.range * 0.62;
        if (k.atk === 'swoop' && m.state === 'chase') stop = 6;
        // spiders and crabs hang back out of reach until they're ready to leap or rush
        if ((k.atk === 'pounce' || k.atk === 'charge') && m.state === 'chase' && m.atkCd > 0.2 && m.leap <= 0 && !m.rush) stop = k.r + 5.5;
        if (l > stop) { gx /= l; gz /= l; want = k.spd * (m.state === 'chase' ? 1 : 0.45); }
        else if (k.atk === 'shot' && m.state === 'chase' && l < k.shot.range * 0.35) { gx = -gx / l; gz = -gz / l; want = k.spd * 0.7; }   // too close: back off
        else { gx = gz = 0; if (m.state === 'wander') m.rest = true; }
      }
      if (frozen || m.wind > 0 || m.daze > 0) want = 0;
      if (m.slow > 0) want *= 0.45;
      // choosing an attack
      if (chasing && m.wind <= 0 && m.atkCd <= 0 && m.daze <= 0) {
        switch (k.atk) {
          case 'melee': if (this.inReach(m, d, 3.2)) this.windUp(m, 'strike', 0.4); break;
          case 'shot': if (d < k.shot.range && d > 3) this.windUp(m, 'throw', 0.5); break;
          case 'pounce': if (d > 4 && d < 12 && m.onGround && Math.abs(m.pos.y - hero.y) < 4) this.windUp(m, 'pounce', 0.45); break;
          case 'charge': if (d > 5 && d < 18 && Math.abs(m.pos.y - hero.y) < 4) this.windUp(m, 'rush', 0.55); break;
          case 'phase': if (d < 24 && d > 6) this.windUp(m, 'phase', 0.35); break;
          case 'swoop': if (d < 16 && !m.dive) { const tgt = new V3(hero.x, hero.y + HERO_MID, hero.z); m.dive = { t: 1.1, dir: tgt.sub(m.pos).normalize(), hit: false }; m.atkCd = 2.4; } break;
        }
      }
      // slimes only move by hopping
      if (k.atk === 'hop') {
        if (want > 0 && m.onGround && m.hopCd <= 0 && !frozen) {
          const big = m.state === 'chase';
          m.vel.set(gx * want * (big ? 1.7 : 1), big ? 14 : 9, gz * want * (big ? 1.7 : 1)); m.onGround = false; m.hopCd = big ? 0.75 : 1.2;
        }
        want = 0; gx = gz = 0;   // (no walking)
      }
      // a crab's rush and a spider's leap carry it on their own
      if (m.rush) {
        m.rush.t -= dt; want = 0;
        m.vel.x = m.rush.x * 26; m.vel.z = m.rush.z * 26;
        if (!m.rush.hit && this.inReach(m, d, 2.8, 5)) { m.rush.hit = true; if (this.bite(m, 1.5, 26)) { sfx('slam'); } }
        if (m.rush.t <= 0 || m.rush.hit) { m.rush = null; m.daze = 0.9; m.vel.x *= 0.2; m.vel.z *= 0.2; }
      }
      if (m.leap > 0) {
        want = 0;
        if (this.inReach(m, d, 2.6, 5) && m.atkCd > 1.5) { m.leap = 0; this.bite(m, 1.3, 20); }
      }
      const acc = 1 - Math.exp(-8 * dt);
      if (!(k.atk === 'hop' && !m.onGround) && !m.rush && m.leap <= 0) { m.vel.x += (gx * want + m.kb.x - m.vel.x) * acc; m.vel.z += (gz * want + m.kb.z - m.vel.z) * acc; }
      m.kb.multiplyScalar(Math.exp(-9 * dt));
      // ground monsters: step, fall, stay out of the water; flyers hover
      const nx = m.pos.x + m.vel.x * dt, nz = m.pos.z + m.vel.z * dt;
      if (w.poly) {
        // the low-poly land: a height to walk on (or hover over), the sea to keep out of
        if (k.fly && m.dive) {
          // a bat's dive: straight along its line, then the dive is over and it climbs back
          m.dive.t -= dt;
          m.pos.addScaledVector(m.dive.dir, 24 * dt);
          const g = w.ground(m.pos.x, m.pos.z);
          if (!m.dive.hit && this.inReach(m, d, 2.4, 3.5)) { m.dive.hit = true; this.bite(m, 1, 14); }
          if (m.dive.t <= 0 || m.dive.hit || (g !== null && m.pos.y < g + 0.8)) { m.dive = null; m.vel.set(0, 0, 0); }
        } else if (k.fly) {
          const g = w.ground(nx, nz);
          if (g !== null) { m.pos.x = nx; m.pos.z = nz; m.pos.y += (g + (k.hover || 5.2) + Math.sin(t * 2 + m.bob) * 0.8 - m.pos.y) * (1 - Math.exp(-3 * dt)); }
        } else {
          const g = w.ground(nx, nz);
          if (g !== null && !w.seaAt(nx, nz) && g - m.pos.y < 2.6) { const [cx2, cz2] = w.clearOfTrunks(nx, nz, k.r * 0.6); m.pos.x = cx2; m.pos.z = cz2; }
          else { m.vel.x *= -0.2; m.vel.z *= -0.2; if (m.state === 'wander') m.t = 0; }
          m.vel.y -= 60 * dt;
          const gh = w.ground(m.pos.x, m.pos.z);
          let ny = m.pos.y + m.vel.y * dt;
          if (gh !== null && ny <= gh) { ny = gh; m.vel.y = 0; m.onGround = true; } else m.onGround = false;
          m.pos.y = ny;
        }
      } else if (k.fly && m.dive) {
        m.dive.t -= dt;
        m.pos.addScaledVector(m.dive.dir, 24 * dt);
        if (!m.dive.hit && this.inReach(m, d, 2.4, 3.5)) { m.dive.hit = true; this.bite(m, 1, 14); }
        if (m.dive.t <= 0 || m.dive.hit || w.solid(m.pos.x, m.pos.y, m.pos.z)) { m.dive = null; m.vel.set(0, 0, 0); }
      } else if (k.fly) {
        const g = w.groundY(nx, nz, m.pos.y + 12);
        const hover = g + (k.hover || 5.2) + Math.sin(t * 2 + m.bob) * 0.8;
        m.pos.x = nx; m.pos.z = nz;
        m.pos.y += (hover - m.pos.y) * (1 - Math.exp(-3 * dt));
      } else {
        const fy = m.pos.y;
        const blockedAt = (x, z) => w.solid(x, fy + 0.1, z) || w.solid(x, fy + 1, z) || w.solid(x, fy + 2, z);
        // (a step of one block or two)
        const stepAt = (x, z) => { for (let s = 1; s <= 2; s++) if (!w.solid(x, fy + s + 0.1, z) && !w.solid(x, fy + s + 1.1, z) && !w.solid(x, fy + s + 2.1, z)) return s; return 0; };
        const wet = (x, z) => w.water(x, fy + 0.2, z) || w.lava(x, fy + 0.2, z) || w.water(x, fy - 0.8, z);
        let mx = nx, mz = m.pos.z;
        if (!wet(mx, mz)) { if (!blockedAt(mx, mz)) m.pos.x = mx; else { const st = stepAt(mx, mz); if (st) { m.pos.x = mx; m.pos.y += st; } else m.vel.x = 0; } } else m.vel.x = 0;
        mx = m.pos.x; mz = nz;
        if (!wet(mx, mz)) { if (!blockedAt(mx, mz)) m.pos.z = mz; else { const st = stepAt(mx, mz); if (st) { m.pos.z = mz; m.pos.y += st; } else m.vel.z = 0; } } else m.vel.z = 0;
        // gravity
        m.vel.y -= 60 * dt;
        let ny = m.pos.y + m.vel.y * dt;
        if (w.solid(m.pos.x, ny, m.pos.z)) { ny = Math.floor(ny) + 1; m.vel.y = 0; m.onGround = true; } else m.onGround = false;
        m.pos.y = ny;
        if (m.pos.y < 0) { this.remove(m); continue; }
      }
      // the warrior's charge runs them down
      if (p.dash && p.dash.onTouch && d < k.r + 2.2 && Math.abs(m.pos.y - hero.y) < 5) p.dash.onTouch(m);
      // biting, for the kinds that bite on touch (skeletons wind up a strike, bats bite in the dive)
      if (chasing && k.atk !== 'melee' && k.atk !== 'swoop' && m.wind <= 0 && !m.rush && m.leap <= 0 && m.atkCd <= 0 && this.inReach(m, d, 3)) {
        m.atkCd = k.atk === 'hop' ? 0.9 : 1.1; m.lunge = 0.3;
        this.bite(m);
      }
      m.lunge = Math.max(0, (m.lunge || 0) - dt);
      // the health bar over its head
      if (m.bar) {
        if ((m.barT -= dt) <= 0) m.bar.visible = false;
        else {
          m.bar.position.set(m.pos.x, m.pos.y + k.h * 1.24 + 1.1, m.pos.z);
          // (the fill grows from the bar's left end: offset along the camera's right, so it holds from any angle)
          camRight.setFromMatrixColumn(camera.matrixWorld, 0);
          m.bar.userData.fill.position.copy(camRight).multiplyScalar(-1.75);
        }
      }
      // the look of it
      const hs = Math.hypot(m.vel.x, m.vel.z);
      m.moving = hs > 0.5;
      if (hs > 0.5) { const tf = Math.atan2(m.vel.x, m.vel.z); let dd = tf - m.face; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); m.face += dd * (1 - Math.exp(-10 * dt)); }
      else if (m.state === 'chase') { const tf = Math.atan2(hero.x - m.pos.x, hero.z - m.pos.z); let dd = tf - m.face; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); m.face += dd * (1 - Math.exp(-6 * dt)); }
      m.root.position.copy(m.pos);
      if (m.lunge > 0) { const a = Math.sin(m.lunge / 0.3 * Math.PI); m.root.position.x += Math.sin(m.face) * a * 1.2; m.root.position.z += Math.cos(m.face) * a * 1.2; }
      m.root.rotation.y = m.face;
      if (!frozen) m.root.userData.anim(t, { moving: m.moving, seed: m.seed, timer: Math.floor(this.timer + m.seed * 20), attack: m.lunge > 0, chase: m.state === 'chase', wind: m.wind > 0, hurt: m.flash > 0.1 });
      // hit: a white flash; winding up: an orange glow; frozen: an icy tint
      if (m.flash > 0) m.flash -= dt;
      const tint = m.flash > 0 ? 'hit' : m.wind > 0 ? 'wind' : frozen ? 'frz' : '';
      if (tint !== m.tint) {
        m.tint = tint;
        if (tint === 'hit') m.root.userData.flash(1, '#ffffff');
        else if (tint === 'wind') m.root.userData.flash(0.7, '#ffb040');
        else if (tint === 'frz') m.root.userData.flash(0.5, '#8ad8ff');
        else m.root.userData.flash(0);
      }
      // (a wind-up shivers)
      if (m.wind > 0) { m.root.position.x += Math.sin(t * 60) * 0.12; m.root.position.z += Math.cos(t * 53) * 0.12; }
    }
  }
}

// ---------------------------------------------------------------- bolts
const boltGeo = new THREE.SphereGeometry(0.56, 12, 8);
// an arrow: a wooden shaft, a steel head, feathers at the tail (built once, cloned per shot; +z is the way it flies)
const arrowMats = {
  wood: new THREE.MeshLambertMaterial({ color: '#8a6238' }), steel: new THREE.MeshStandardMaterial({ color: '#e4ecf4', metalness: 0.9, roughness: 0.18, emissive: '#9fd8ff', emissiveIntensity: 0.55 }),   // (a shiny tip, with a little glint of its own, so the arrow shows in flight)
  feather: new THREE.MeshLambertMaterial({ color: '#e8e4d8', side: THREE.DoubleSide }), feather2: new THREE.MeshLambertMaterial({ color: '#c8402e', side: THREE.DoubleSide }),
};
let arrowProto = null;
function buildArrow() {
  if (arrowProto) return arrowProto.clone();
  const g = new THREE.Group(), L = 2.6;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, L, 6), arrowMats.wood); shaft.rotation.x = Math.PI / 2; g.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 4), arrowMats.steel); head.rotation.x = Math.PI / 2; head.position.z = L / 2 + 0.18; g.add(head);
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: '#dff4ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); glint.scale.setScalar(1.1); glint.position.z = L / 2 + 0.25; g.add(glint);
  const nock = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 6), arrowMats.steel); nock.rotation.x = Math.PI / 2; nock.position.z = -L / 2; g.add(nock);
  // three vanes, flat quarter-arcs sticking out of the shaft near the tail
  const vane = new THREE.PlaneGeometry(0.42, 0.2); vane.rotateY(Math.PI / 2); vane.translate(0, 0.14, -L / 2 + 0.3);
  for (let i = 0; i < 3; i++) { const v = new THREE.Mesh(vane, i ? arrowMats.feather : arrowMats.feather2); v.rotation.z = i * Math.PI * 2 / 3; g.add(v); }
  arrowProto = g;
  return g.clone();
}
export class Bolts {
  constructor(world, monsters) { this.world = world; this.monsters = monsters; this.list = []; }
  // opts: speed, arrow (a shaft, no glow), big (a meteor), mult (damage), onEnd(pos) when it lands
  fire(from, dir, color = '#9ad8ff', opts = {}) {
    const g = opts.arrow ? buildArrow() : new THREE.Group();
    const sz = opts.big ? 2.6 : 1;
    if (!opts.arrow) { const core = new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.6) })); core.scale.setScalar(sz); g.add(core); }
    let glow = null;
    if (!opts.arrow) { glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); glow.scale.setScalar(4.4 * sz); g.add(glow); }
    g.position.copy(from);
    g.lookAt(from.clone().add(dir));
    scene.add(g);
    this.list.push({ g, glow, pos: from.clone(), vel: dir.clone().multiplyScalar(opts.speed || 68), t: 0, color, r: opts.big ? 2.5 : 1, mult: opts.mult || 1, big: !!opts.big, arrow: !!opts.arrow, onEnd: opts.onEnd || null, life: opts.big ? 4 : 1.8 });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i]; b.t += dt;
      const steps = 4; let gone = false;
      for (let s = 0; s < steps && !gone; s++) {
        b.pos.addScaledVector(b.vel, dt / steps);
        // (a monster first, then the ground: a point-blank shot at one standing at your feet lands on it)
        for (const m of this.monsters.list) {
          const cy = m.pos.y + m.k.h * 0.5;
          if (Math.hypot(b.pos.x - m.pos.x, (b.pos.y - cy) * 0.8, b.pos.z - m.pos.z) < m.k.r + b.r) {
            if (b.onEnd) { b.onEnd(b.pos); gone = true; break; }
            const { d, crit } = heroDamage(b.mult * (m.frz > 0 ? 1.5 : 1));
            this.monsters.hit(m, d, crit, b.vel.clone().normalize());
            gone = true; break;
          }
        }
        if (gone) break;
        const gnd = this.world.poly ? this.world.ground(b.pos.x, b.pos.z) : null;
        if ((this.world.poly ? (gnd !== null && b.pos.y < gnd) : this.world.solid(b.pos.x, b.pos.y, b.pos.z)) || b.pos.y < 0) { if (b.onEnd) b.onEnd(b.pos); else burst(b.pos.x, b.pos.y, b.pos.z, b.color, 6, 8, 1.2, true, 0.3); gone = true; break; }
      }
      if (gone || b.t > b.life) { scene.remove(b.g); if (!b.arrow) b.g.traverse(o => o.material && o.material.dispose()); this.list.splice(i, 1); continue; }
      b.g.position.copy(b.pos);
      if (b.glow) b.glow.scale.setScalar(4.4 * (b.big ? 2.6 : 1) + Math.sin(b.t * 30) * 0.6);
      if (!b.arrow && Math.random() < (b.big ? 1 : 0.6)) burst(b.pos.x, b.pos.y, b.pos.z, b.color, b.big ? 3 : 1, b.big ? 3 : 1.2, b.big ? 2.4 : 1.1, true, 0.3, 0);
    }
  }
}

// where a bolt should go: along the camera's view, at a monster near the crosshair if there is one,
// else at the block it hits, else far out
const ray = new THREE.Vector3(), tmp = new THREE.Vector3();
export function aimPoint(world, monsters, from) {
  camera.getWorldDirection(ray);
  if (monsters.focus && monsters.list.includes(monsters.focus)) { const m = monsters.focus; return new V3(m.pos.x, m.pos.y + m.k.h * 0.5, m.pos.z); }
  let best = null, bd = 0.96;
  for (const m of monsters.list) {
    tmp.set(m.pos.x, m.pos.y + m.k.h * 0.5, m.pos.z).sub(camera.position);
    const dist = tmp.length(); if (dist > 120) continue;
    const cos = tmp.normalize().dot(ray);
    if (cos > bd) { bd = cos; best = m; }
  }
  if (best) return new V3(best.pos.x, best.pos.y + best.k.h * 0.5, best.pos.z);
  // the block the view hits
  for (let d = 4; d < 120; d += 0.5) {
    tmp.copy(camera.position).addScaledVector(ray, d);
    if (world.poly) { const g = world.ground(tmp.x, tmp.z); if (g !== null && tmp.y < g) return tmp.clone(); }
    else if (world.solid(tmp.x, tmp.y, tmp.z)) return tmp.clone();
  }
  return camera.position.clone().addScaledVector(ray, 120);
}
