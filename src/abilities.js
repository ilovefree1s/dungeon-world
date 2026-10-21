// ============================================================================
//  DUNGEON WORLD  -  abilities: each hero's basic attack and three abilities,
//  after Dungeon Heart's talents. The warrior's sword, charge, whirlwind and
//  ground slam; the mage's bolt, blink, frost nova and meteor; the hunter's
//  arrow, roll, multishot and arrow rain. Cooldowns, aiming, hits.
// ============================================================================
import { THREE, scene, camera, TEX, V3 } from './engine.js';
import { heroDamage, aimPoint, stats } from './combat.js';
import { burst, ring } from './fx.js';
import { sfx } from './audio.js';

const BOLT = '#9ad8ff', FIRE = '#ff8a2a', FROST = '#9fe6ff', ARROW = '#e8d8b0';
// the way the camera looks, flat
const camFlat = p => { const d = new V3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw)); return d; };
// the way the stick or keys push, else the way the camera looks (a shove from a monster doesn't count)
let inputRef = null;
const moveDir = p => {
  const i = inputRef; if (!i || Math.hypot(i.mx, i.my) < 0.2) return camFlat(p);
  const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
  const d = new V3(-s * -i.my + c * i.mx, 0, -c * -i.my - s * i.mx); return d.normalize();
};
// the hero turns toward where it aims
const faceTo = (p, dir) => { p.aimFace = Math.atan2(dir.x, dir.z); };
// every monster within r of a point (and, with cosMin, within an arc of a direction)
function around(monsters, x, y, z, r, dir = null, cosMin = -2) {
  const out = [];
  for (const m of monsters.list) {
    const dx = m.pos.x - x, dz = m.pos.z - z, d = Math.hypot(dx, dz);
    if (d > r + m.k.r || Math.abs(m.pos.y + m.k.h * 0.5 - y) > r) continue;
    if (dir && d > 0.1 && (dx * dir.x + dz * dir.z) / d < cosMin) continue;
    out.push(m);
  }
  return out;
}
const hitAll = (ctx, list, mult, from, stun = 0) => {
  for (const m of list) {
    const { d, crit } = heroDamage(mult * (m.frz > 0 ? 1.5 : 1));
    const dir = new V3(m.pos.x - from.x, 0, m.pos.z - from.z).normalize();
    ctx.monsters.hit(m, d, crit, dir);
    if (stun && m.hp > 0) m.frz = Math.max(m.frz || 0, stun);
  }
  return list.length;
};

// ---------------------------------------------------------------- the kits
export const KITS = [
  // ---- warrior
  { name: 'WARRIOR', attack: { name: 'SWING', cd: 0.45, cdOf: p => 0.45 / (p.forged ? p.forged.spd : 1), use(ctx) {
      const p = ctx.player, dir = camFlat(p), f = p.forged;
      faceTo(p, dir); p.swingT = 0; p.whirl = false;
      sfx('swing');
      // (a weapon from the forge sets the swing's damage, speed and reach)
      ctx.later(0.16, () => { const n = hitAll(ctx, around(ctx.monsters, p.pos.x + dir.x * 1.5, p.pos.y + 2, p.pos.z + dir.z * 1.5, f ? f.reach : 4.6, dir, 0.3), 1.5 * (f ? f.dmg : 1), p.pos); if (n) sfx('hit'); });
    } },
    abilities: [
      { name: 'CHARGE', glyph: '➤', cd: 5, use(ctx) {
          const p = ctx.player, dir = camFlat(p);
          faceTo(p, dir); p.dash = { t: 0.28, dx: dir.x, dz: dir.z, spd: 54, roll: false, hit: new Set() }; p.invT = Math.max(p.invT, 0.3);
          sfx('roll'); burst(p.pos.x, p.pos.y + 1, p.pos.z, '#ffd8a0', 10, 8, 1.2, true, 0.4);
          p.dash.onTouch = m => { if (p.dash.hit.has(m)) return; p.dash.hit.add(m); hitAll(ctx, [m], 1.8, p.pos, 0.6); };
        } },
      { name: 'WHIRL', glyph: '✺', cd: 7, use(ctx) {
          const p = ctx.player; p.swingT = 0; p.whirl = true; p.swingLen = 0.7;
          sfx('swing');
          ctx.later(0.2, () => { if (hitAll(ctx, around(ctx.monsters, p.pos.x, p.pos.y + 2, p.pos.z, 5.5), 1.4, p.pos)) sfx('hit'); });
          ctx.later(0.5, () => { if (hitAll(ctx, around(ctx.monsters, p.pos.x, p.pos.y + 2, p.pos.z, 5.5), 1.4, p.pos)) sfx('hit'); });
          ring(p.pos.x, p.pos.y + 0.3, p.pos.z, '#ffd8a0', 1, 6, 0.5);
        } },
      { name: 'SLAM', glyph: '⯆', cd: 10, use(ctx) {
          const p = ctx.player;
          if (p.onGround) { p.vel.y = 22; p.onGround = false; }
          p.slamming = true; p.invT = Math.max(p.invT, 0.4);
          sfx('roll');
          p.onLand = () => {
            p.slamming = false;
            ring(p.pos.x, p.pos.y + 0.2, p.pos.z, '#ffb060', 1, 14, 0.6); burst(p.pos.x, p.pos.y + 0.5, p.pos.z, '#c8b090', 24, 12, 1.8, false, 0.7);
            sfx('slam'); ctx.shake(0.5);
            hitAll(ctx, around(ctx.monsters, p.pos.x, p.pos.y + 1, p.pos.z, 7.5), 2.2, p.pos, 2);
          };
        } },
    ] },
  // ---- mage
  { name: 'MAGE', attack: { name: 'BOLT', cd: 0.34, use(ctx) {
      const p = ctx.player, from = p.pos.clone(); from.y += 3.8;
      const dir = ctx.aim(from); faceTo(p, dir); p.castT = 0;
      from.addScaledVector(dir, 1.8);
      ctx.bolts.fire(from, dir, BOLT, { speed: 68 });
      sfx('cast');
    } },
    abilities: [
      { name: 'BLINK', glyph: '⟿', cd: 4, use(ctx) {
          const p = ctx.player, dir = moveDir(p), from = p.pos.clone();
          if (!p.blink(dir.x, dir.z)) { sfx('nope'); return false; }
          burst(from.x, from.y + 3, from.z, BOLT, 14, 12, 1.6, true, 0.5); burst(p.pos.x, p.pos.y + 3, p.pos.z, BOLT, 14, 12, 1.6, true, 0.5);
          sfx('blink');
        } },
      { name: 'NOVA', glyph: '❄', cd: 9, use(ctx) {
          const p = ctx.player; p.castT = 0;
          ring(p.pos.x, p.pos.y + 0.3, p.pos.z, FROST, 1, 13, 0.6); burst(p.pos.x, p.pos.y + 2, p.pos.z, '#cfeeff', 30, 14, 1.6, true, 0.7, 2);
          sfx('blink');
          for (const m of around(ctx.monsters, p.pos.x, p.pos.y + 2, p.pos.z, 12)) { m.frz = 3.2; m.vel.set(0, m.vel.y, 0); }
          hitAll(ctx, around(ctx.monsters, p.pos.x, p.pos.y + 2, p.pos.z, 12), 0.5, p.pos);
        } },
      { name: 'METEOR', glyph: '☄', cd: 12, use(ctx) {
          const p = ctx.player, from = p.pos.clone(); from.y += 3.8;
          const dir = ctx.aim(from); faceTo(p, dir); p.castT = 0;
          const at = ctx.aimAt.clone();
          // it falls from the sky onto the spot, a moment after the sign appears
          ring(at.x, at.y + 0.3, at.z, FIRE, 0.5, 7, 1.0);
          sfx('cast');
          ctx.later(0.7, () => {
            const start = at.clone(); start.y += 40; start.x -= dir.x * 12; start.z -= dir.z * 12;
            const d = at.clone().sub(start).normalize();
            ctx.bolts.fire(start, d, FIRE, { speed: 70, big: true, onEnd: pos => {
              ring(pos.x, pos.y + 0.3, pos.z, FIRE, 1, 16, 0.6); burst(pos.x, pos.y + 1, pos.z, FIRE, 30, 16, 2.2, true, 0.8);
              burst(pos.x, pos.y + 1, pos.z, '#3a2a20', 16, 10, 2, false, 0.9);
              sfx('slam'); ctx.shake(0.6);
              hitAll(ctx, around(ctx.monsters, pos.x, pos.y + 1, pos.z, 8), 2.8, pos);
            } });
          });
        } },
    ] },
  // ---- hunter
  { name: 'HUNTER', attack: { name: 'SHOOT', cd: 0.3, use(ctx) {
      const p = ctx.player, from = p.pos.clone(); from.y += 3.6;
      const dir = ctx.aim(from); faceTo(p, dir); p.castT = 0;
      from.addScaledVector(dir, 1.8);
      ctx.bolts.fire(from, dir, ARROW, { speed: 96, arrow: true });
      sfx('shoot');
    } },
    abilities: [
      { name: 'ROLL', glyph: '↻', cd: 3, use(ctx) {
          const p = ctx.player, dir = moveDir(p);
          faceTo(p, dir); p.dash = { t: 0.42, dx: dir.x, dz: dir.z, spd: 30, roll: true, hit: new Set() }; p.invT = Math.max(p.invT, 0.5);
          sfx('roll');
        } },
      { name: 'MULTI', glyph: '⋔', cd: 6, use(ctx) {
          const p = ctx.player, from = p.pos.clone(); from.y += 3.6;
          const dir = ctx.aim(from); faceTo(p, dir); p.castT = 0;
          from.addScaledVector(dir, 1.8);
          for (let i = -2; i <= 2; i++) {
            const a = i * 0.16, d = new V3(dir.x * Math.cos(a) - dir.z * Math.sin(a), dir.y, dir.x * Math.sin(a) + dir.z * Math.cos(a)).normalize();
            ctx.bolts.fire(from.clone(), d, ARROW, { speed: 96, arrow: true, mult: 0.8 });
          }
          sfx('shoot');
        } },
      { name: 'RAIN', glyph: '⇣', cd: 12, use(ctx) {
          const p = ctx.player, from = p.pos.clone(); from.y += 3.6;
          const dir = ctx.aim(from); faceTo(p, dir); p.castT = 0;
          const at = ctx.aimAt.clone();
          ring(at.x, at.y + 0.3, at.z, ARROW, 0.5, 7, 0.9);
          sfx('shoot');
          for (let i = 0; i < 20; i++) ctx.later(0.35 + i * 0.04, () => {
            const a = Math.random() * 6.28, r = Math.random() * 5;
            const s = new V3(at.x + Math.cos(a) * r, at.y + 26, at.z + Math.sin(a) * r);
            ctx.bolts.fire(s, new V3(0.05 * (Math.random() - 0.5), -1, 0.05 * (Math.random() - 0.5)).normalize(), ARROW, { speed: 70, arrow: true, mult: 0.7 });
          });
        } },
    ] },
];

// ---------------------------------------------------------------- running them
export class Abilities {
  constructor(ctx) {
    this.ctx = ctx; this.cd = [0, 0, 0]; this.atkCd = 0; this.timers = [];
    ctx.later = (t, f) => this.timers.push({ t, f });
    ctx.aimAt = new V3();
    ctx.aim = from => { const to = aimPoint(ctx.world, ctx.monsters, from); ctx.aimAt.copy(to); const d = to.sub(from); if (d.length() < 1) return camFlat(ctx.player); return d.normalize(); };
  }
  kit() { return KITS[this.ctx.player.cls] || KITS[0]; }
  update(dt, inp) {
    inputRef = inp;
    const ctx = this.ctx, p = ctx.player, kit = this.kit();
    this.atkCd -= dt; for (let i = 0; i < 3; i++) this.cd[i] -= dt;
    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; if ((t.t -= dt) <= 0) { this.timers.splice(i, 1); t.f(); } }
    if (stats.hp <= 0 || ctx.frozen) { inp.atkEdge = false; inp.abEdge.fill(false); return; }
    const busy = p.dash || (p.swingT >= 0 && p.whirl);
    if ((inp.atkEdge || inp.atk) && this.atkCd <= 0 && !busy) { this.atkCd = kit.attack.cdOf ? kit.attack.cdOf(p) : kit.attack.cd; kit.attack.use(ctx); }
    inp.atkEdge = false;
    for (let i = 0; i < 3; i++) {
      if (!inp.abEdge[i]) continue;
      inp.abEdge[i] = false;
      if (this.cd[i] > 0 || busy) { sfx('nope'); continue; }
      const ab = kit.abilities[i];
      if (ab.use(ctx) !== false) this.cd[i] = ab.cd;
    }
  }
  // for the HUD: each slot's name, key and how much of its cooldown is left (0..1)
  slots() { const kit = this.kit(); return kit.abilities.map((a, i) => ({ name: a.name, glyph: a.glyph, left: Math.max(0, this.cd[i] / a.cd) })); }
  reset() { this.cd.fill(0); this.atkCd = 0; this.timers.length = 0; }
}
