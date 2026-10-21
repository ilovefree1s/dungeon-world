// ============================================================================
//  DUNGEON WORLD  -  combat: the hero's attacks (the mage's bolts and blink),
//  the monsters roaming the land (Dungeon Heart's models, picked by biome),
//  health, damage, XP and levels.
// ============================================================================
import { THREE, scene, camera, TEX, V3 } from './engine.js';
import { buildMonster } from './dh/models.js';
import * as D from './dh/data.js';
import { burst, ring, number } from './fx.js';
import { sfx } from './audio.js';
import { CH } from './gen.js';

// ---------------------------------------------------------------- the hero's numbers
export const stats = { hp: 30, maxHp: 30, xp: 0, level: 1, kills: 0, dead: 0 };
export const xpToNext = () => 18 + stats.level * 10;
export const heroDamage = (mult = 1) => {
  const base = 5 + stats.level * 1.5;
  const crit = Math.random() < 0.12;
  return { d: Math.max(1, Math.round(base * mult * (0.85 + Math.random() * 0.3) * (crit ? 2 : 1))), crit };
};
export function gainXp(n, onLevel) {
  stats.xp += n;
  while (stats.xp >= xpToNext()) { stats.xp -= xpToNext(); stats.level++; stats.maxHp += 6; stats.hp = stats.maxHp; onLevel && onLevel(stats.level); }
}

// ---------------------------------------------------------------- monsters
// per type: speed (blocks a second), the body's radius and height, flying, how it attacks
const KIND = {
  [D.M_SLIME]: { spd: 6.4, r: 1.8, h: 2.6, fly: 0, see: 28 },
  [D.M_BAT]: { spd: 12, r: 1.2, h: 1.6, fly: 1, see: 36 },
  [D.M_SKEL]: { spd: 8, r: 1.2, h: 4.4, fly: 0, see: 36 },
  [D.M_SPIDER]: { spd: 10.4, r: 1.8, h: 1.8, fly: 0, see: 30 },
  [D.M_GHOST]: { spd: 7.2, r: 1.6, h: 4, fly: 1, see: 40 },
  [D.M_IMP]: { spd: 10, r: 1.2, h: 3, fly: 0, see: 32 },
  [D.M_FIRESPRITE]: { spd: 9, r: 1.2, h: 2.4, fly: 1, see: 32 },
  [D.M_WISP]: { spd: 8, r: 1.2, h: 2.4, fly: 1, see: 36 },
  [D.M_HELLCRAB]: { spd: 6.8, r: 2, h: 2.2, fly: 0, see: 28 },
  [D.M_VBAT]: { spd: 13, r: 1.4, h: 1.8, fly: 1, see: 40 },
};
// who lives where: forest, snow, desert, swamp, lava, crystal
const BY_BIOME = [
  [D.M_SLIME, D.M_SLIME, D.M_BAT, D.M_SPIDER],
  [D.M_SKEL, D.M_SKEL, D.M_BAT, D.M_GHOST],
  [D.M_HELLCRAB, D.M_HELLCRAB, D.M_SKEL, D.M_VBAT],
  [D.M_GHOST, D.M_SLIME, D.M_SPIDER, D.M_VBAT],
  [D.M_IMP, D.M_IMP, D.M_FIRESPRITE, D.M_HELLCRAB],
  [D.M_WISP, D.M_WISP, D.M_GHOST, D.M_SPIDER],
];
const MAX_NEAR = 10, SPAWN_MIN = 48, SPAWN_MAX = 104, DESPAWN = 192;

export class Monsters {
  constructor(world, player) {
    this.world = world; this.player = player; this.list = []; this.spawnT = 2; this.timer = 0;
    this.hooks = { hurt: null, level: null, dead: null };
  }
  spawn(type, x, y, z) {
    const root = buildMonster(type, 1 + Math.floor(stats.level / 3));
    root.scale.multiplyScalar(1.24);
    root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    scene.add(root);
    const k = KIND[type];
    const m = { type, k, root, pos: new V3(x, y, z), vel: new V3(), home: new V3(x, y, z), face: Math.random() * 6.28, seed: Math.random() * 10,
      hp: D.MON_BASE_HP[type] * 3 + stats.level * 2, atk: D.MON_BASE_ATK[type] + Math.floor(stats.level / 2), state: 'wander', t: Math.random() * 2, atkCd: 0, flash: 0, frz: 0, kb: new V3(), onGround: false, moving: false, bob: Math.random() * 6 };
    m.maxHp = m.hp;
    this.list.push(m);
    return m;
  }
  // a new monster somewhere out of sight, in the biome it stands in
  trySpawn() {
    const p = this.player.pos, w = this.world;
    let near = 0; for (const m of this.list) if (m.pos.distanceTo(p) < 140) near++;
    if (near >= MAX_NEAR) return;
    for (let tries = 0; tries < 6; tries++) {
      const a = Math.random() * Math.PI * 2, d = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
      const x = Math.floor(p.x + Math.cos(a) * d) + 0.5, z = Math.floor(p.z + Math.sin(a) * d) + 0.5;
      if (!w.loaded(x, z)) continue;
      // (not in front of the camera: they appear behind you and off to the sides)
      const fx = -Math.sin(this.player.yaw), fz = -Math.cos(this.player.yaw);
      if (((x - p.x) * fx + (z - p.z) * fz) / d > 0.3 && d < 80) continue;
      const g = w.groundY(x, z);
      if (g < 0 || w.water(x, g + 1, z) || w.lava(x, g + 1, z) || w.lava(x, g, z)) continue;
      const biome = w.gen.column(Math.floor(x), Math.floor(z)).biome;
      const types = BY_BIOME[biome], type = types[Math.floor(Math.random() * types.length)];
      this.spawn(type, x, g + 1 + (KIND[type].fly ? 5 : 0), z);
      return;
    }
  }
  remove(m) { scene.remove(m.root); m.root.traverse(o => o.geometry && o.geometry.dispose()); this.list.splice(this.list.indexOf(m), 1); }
  // the hero's bolt or blade lands on one
  hit(m, dmg, crit, dir) {
    m.hp -= dmg; m.flash = 0.18; m.state = 'chase';
    m.kb.set(dir.x * 14, 0, dir.z * 14);
    const c = m.pos.clone(); c.y += m.k.h * 0.6;
    number(c.x, c.y + 1.2, c.z, dmg, crit ? 'crit' : '');
    burst(c.x, c.y, c.z, crit ? '#ffd45a' : '#ffffff', crit ? 10 : 6, 8, 1, true, 0.35);
    sfx(crit ? 'crit' : 'hit');
    if (m.hp <= 0) {
      burst(c.x, c.y, c.z, '#ffffff', 14, 12, 1.8, false, 0.6);
      ring(m.pos.x, m.pos.y + 0.1, m.pos.z, '#ffe08a', 0.8, 5, 0.4);
      sfx('kill');
      stats.kills++;
      gainXp(3 + D.MON_BASE_XP[m.type], this.hooks.level);
      this.remove(m);
      return true;
    }
    return false;
  }
  // a monster's bite
  bite(m) {
    const p = this.player;
    if (p.invT > 0 || stats.hp <= 0) return;
    stats.hp = Math.max(0, stats.hp - m.atk);
    p.invT = 0.7; p.hurtT = 0.4;
    const dx = p.pos.x - m.pos.x, dz = p.pos.z - m.pos.z, l = Math.hypot(dx, dz) || 1;
    p.vel.x += dx / l * 18; p.vel.z += dz / l * 18; p.vel.y = Math.max(p.vel.y, 8);
    number(p.pos.x, p.pos.y + 5.2, p.pos.z, m.atk, 'hurt');
    this.hooks.hurt && this.hooks.hurt();
    if (stats.hp <= 0) this.hooks.dead && this.hooks.dead();
  }
  update(dt) {
    const w = this.world, p = this.player, hero = p.pos, t = performance.now() / 1000;
    this.timer += dt * 60;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && !this.world.flat) { this.spawnT = 1.4; this.trySpawn(); }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i], k = m.k;
      const d = m.pos.distanceTo(hero);
      if (d > DESPAWN) { this.remove(m); continue; }
      if (!w.loaded(m.pos.x, m.pos.z)) continue;
      m.t -= dt; m.atkCd -= dt;
      const frozen = m.frz > 0; if (frozen) m.frz -= dt;
      // what it wants
      const alive = stats.hp > 0;
      if (m.state === 'wander') {
        if (alive && d < k.see) { m.state = 'chase'; }
        else if (m.t <= 0) { m.t = 2 + Math.random() * 3; const a = Math.random() * 6.28, r = Math.random() * 16; m.goal = new V3(m.home.x + Math.cos(a) * r, 0, m.home.z + Math.sin(a) * r); m.rest = Math.random() < 0.4; }
      } else if (m.state === 'chase') {
        if (!alive || d > k.see * 2.2 || m.pos.distanceTo(m.home) > 120) { m.state = 'wander'; m.t = 0; m.home.copy(m.pos); }
        m.goal = hero; m.rest = false;
      }
      // move toward the goal
      let gx = 0, gz = 0, want = 0;
      if (m.goal && !m.rest) {
        gx = m.goal.x - m.pos.x; gz = m.goal.z - m.pos.z;
        const l = Math.hypot(gx, gz);
        const stop = m.state === 'chase' ? k.r + 1.8 : 1.2;
        if (l > stop) { gx /= l; gz /= l; want = k.spd * (m.state === 'chase' ? 1 : 0.45); } else { gx = gz = 0; if (m.state === 'wander') m.rest = true; }
      }
      if (frozen) want = 0;
      const acc = 1 - Math.exp(-8 * dt);
      m.vel.x += (gx * want + m.kb.x - m.vel.x) * acc; m.vel.z += (gz * want + m.kb.z - m.vel.z) * acc;
      m.kb.multiplyScalar(Math.exp(-9 * dt));
      // ground monsters: step, fall, stay out of the water; flyers hover
      const nx = m.pos.x + m.vel.x * dt, nz = m.pos.z + m.vel.z * dt;
      if (k.fly) {
        const g = w.groundY(nx, nz, m.pos.y + 12);
        const hover = g + 5.2 + Math.sin(t * 2 + m.bob) * 0.8;
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
      // biting
      if (m.state === 'chase' && alive && !frozen && d < k.r + 3 && m.atkCd <= 0 && Math.abs(m.pos.y - hero.y) < 6) {
        m.atkCd = 1.1; m.lunge = 0.3;
        this.bite(m);
      }
      m.lunge = Math.max(0, (m.lunge || 0) - dt);
      // the look of it
      const hs = Math.hypot(m.vel.x, m.vel.z);
      m.moving = hs > 0.5;
      if (hs > 0.5) { const tf = Math.atan2(m.vel.x, m.vel.z); let dd = tf - m.face; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); m.face += dd * (1 - Math.exp(-10 * dt)); }
      else if (m.state === 'chase') { const tf = Math.atan2(hero.x - m.pos.x, hero.z - m.pos.z); let dd = tf - m.face; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); m.face += dd * (1 - Math.exp(-6 * dt)); }
      m.root.position.copy(m.pos);
      if (m.lunge > 0) { const a = Math.sin(m.lunge / 0.3 * Math.PI); m.root.position.x += Math.sin(m.face) * a * 1.2; m.root.position.z += Math.cos(m.face) * a * 1.2; }
      m.root.rotation.y = m.face;
      if (!frozen) m.root.userData.anim(t, { moving: m.moving, seed: m.seed, timer: Math.floor(this.timer + m.seed * 20), attack: m.lunge > 0 });
      // hit: a white flash; frozen: an icy tint
      if (m.flash > 0) { m.flash -= dt; m.root.userData.flash(m.flash > 0 ? 1 : (frozen ? 0.5 : 0), m.flash > 0 ? '#ffffff' : '#8ad8ff'); m.wasFrz = frozen; }
      else if (frozen !== !!m.wasFrz) { m.root.userData.flash(frozen ? 0.5 : 0, '#8ad8ff'); m.wasFrz = frozen; }
    }
  }
}

// ---------------------------------------------------------------- bolts
const boltGeo = new THREE.SphereGeometry(0.56, 12, 8);
export class Bolts {
  constructor(world, monsters) { this.world = world; this.monsters = monsters; this.list = []; }
  // opts: speed, arrow (a shaft, no glow), big (a meteor), mult (damage), onEnd(pos) when it lands
  fire(from, dir, color = '#9ad8ff', opts = {}) {
    const g = new THREE.Group();
    const sz = opts.big ? 2.6 : opts.arrow ? 0.55 : 1;
    const core = new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), opts.arrow ? 0 : 0.6) }));
    core.scale.set(sz, sz, opts.arrow ? 5 : sz);
    g.add(core);
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
        if (this.world.solid(b.pos.x, b.pos.y, b.pos.z) || b.pos.y < 0) { if (b.onEnd) b.onEnd(b.pos); else burst(b.pos.x, b.pos.y, b.pos.z, b.color, 6, 8, 1.2, true, 0.3); gone = true; break; }
        for (const m of this.monsters.list) {
          const cy = m.pos.y + m.k.h * 0.5;
          if (Math.hypot(b.pos.x - m.pos.x, (b.pos.y - cy) * 0.8, b.pos.z - m.pos.z) < m.k.r + b.r) {
            if (b.onEnd) { b.onEnd(b.pos); gone = true; break; }
            const { d, crit } = heroDamage(b.mult * (m.frz > 0 ? 1.5 : 1));
            this.monsters.hit(m, d, crit, b.vel.clone().normalize());
            gone = true; break;
          }
        }
      }
      if (gone || b.t > b.life) { scene.remove(b.g); b.g.traverse(o => o.material && o.material.dispose()); this.list.splice(i, 1); continue; }
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
    if (world.solid(tmp.x, tmp.y, tmp.z)) return tmp.clone();
  }
  return camera.position.clone().addScaledVector(ray, 120);
}
