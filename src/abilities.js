// ============================================================================
//  DUNGEON WORLD  -  abilities: each hero's basic attack and three abilities,
//  after Dungeon Heart's talents. The warrior's sword, charge, whirlwind and
//  ground slam; the mage's bolt, blink, frost nova and meteor; the hunter's
//  arrow, roll, multishot and arrow rain. Cooldowns, aiming, hits.
// ============================================================================
import { THREE, scene, camera, TEX, V3 } from './engine.js';
import { heroDamage, heroBuff, aimPoint, stats } from './combat.js';
import { TAMEABLE } from './pet.js';
import { PLAIN_TIME } from './weaponkit.js';
import { burst, ring, slash } from './fx.js';
import { sfx } from './audio.js';

const BOLT = '#9ad8ff', FIRE = '#ff8a2a', FROST = '#9fe6ff', ARROW = '#e8d8b0';
// the way the camera looks, flat; or, with a monster focused (clicked on), the way to it
let monstersRef = null;
const camFlat = p => { const f = monstersRef && monstersRef.focus; if (f && monstersRef.list.includes(f)) { const d = new V3(f.pos.x - p.pos.x, 0, f.pos.z - p.pos.z); if (d.length() > 0.5) return d.normalize(); } const d = new V3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw)); return d; };
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

// the one to aim a single-target skill at: the target if it's alive and in range, else the nearest in front
function target(ctx, range) {
  const p = ctx.player, f = ctx.monsters.focus;
  if (f && ctx.monsters.list.includes(f) && f.pos.distanceTo(p.pos) < range + f.k.r) return f;
  const dir = camFlat(p); let best = null, bd = range;
  for (const m of ctx.monsters.list) { const dx = m.pos.x - p.pos.x, dz = m.pos.z - p.pos.z, d = Math.hypot(dx, dz); if (d < bd && (dx * dir.x + dz * dir.z) / (d || 1) > 0.4) { bd = d; best = m; } }
  return best;
}
const noTarget = ctx => { ctx.say && ctx.say('NO TARGET IN RANGE'); return false; };
// a buff on the hero: name, seconds, and anything it carries
const buff = (p, k, t, v = {}) => { p.buffs[k] = { t, ...v }; };
// damage over time on a monster: total over seconds, a tick a second
const dot = (m, total, secs, color) => { (m.dots ||= []).push({ t: secs, every: 1, acc: 0, dmg: Math.max(1, Math.round(total / secs)) }); burst(m.pos.x, m.pos.y + m.k.h * 0.6, m.pos.z, color, 8, 4, 1, true, 0.5); };
const fireAt = (ctx, m, color, opts) => { const p = ctx.player, from = p.pos.clone(); from.y += 3.6; const to = new V3(m.pos.x, m.pos.y + m.k.h * 0.5, m.pos.z), d = to.sub(from).normalize(); faceTo(p, d); ctx.bolts.fire(from.clone().addScaledVector(d, 1.8), d, color, opts); return d; };
// how far the warrior's swing reaches (a forged weapon's own reach, or the plain sword's), and the whirlwind
export const meleeReach = p => (p.forged ? p.forged.reach : 4.6) * 1.5;
const WHIRL_R = 9;
// ---------------------------------------------------------------- the kits
export const KITS = [
  // ---- warrior
  { name: 'WARRIOR', attack: { name: 'SWING', cd: 1.5, cdOf: p => p.forged ? p.forged.time : PLAIN_TIME[0], use(ctx) {
      const p = ctx.player, dir = camFlat(p), f = p.forged;
      faceTo(p, dir); p.swingT = 0; p.whirl = false; p.swingN = (p.swingN | 0) + 1;
      sfx('swing');
      // (a weapon from the forge sets the swing's damage, speed and reach)
      const heroic = p.buffs.heroic ? 2.4 : 1; if (heroic > 1) { delete p.buffs.heroic; burst(p.pos.x + dir.x * 2, p.pos.y + 2.5, p.pos.z + dir.z * 2, '#ffb040', 14, 8, 1.4, true, 0.5); }
      // (the cut sweeps a wide arc in front, as far as meleeReach, and the ground shows it)
      ctx.later(0.2, () => { const R = meleeReach(p); slash(p.pos.x, p.pos.y + 0.35, p.pos.z, dir.x, dir.z, R, 2.5, heroic > 1 ? '#ffb040' : '#ffe8b0');
        const n = hitAll(ctx, around(ctx.monsters, p.pos.x, p.pos.y + 2, p.pos.z, R, dir, 0.25), 1.5 * heroic * (f ? f.dmg : 1), p.pos); if (n) sfx(heroic > 1 ? 'crit' : 'hit'); });
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
          // (two turns of the blade, each cutting everything within WHIRL_R, a spinning disc on the ground showing how far)
          for (const at of [0.2, 0.5]) ctx.later(at, () => { slash(p.pos.x, p.pos.y + 0.35, p.pos.z, 1, 0, WHIRL_R, Math.PI * 2, '#ffd8a0', 0.4, 9); ring(p.pos.x, p.pos.y + 0.3, p.pos.z, '#ffd8a0', WHIRL_R * 0.6, WHIRL_R, 0.35);
            if (hitAll(ctx, around(ctx.monsters, p.pos.x, p.pos.y + 2, p.pos.z, WHIRL_R), 1.4, p.pos)) sfx('hit'); });
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
      // ---- six more
      { name: 'HEROIC', glyph: '✦', cd: 5, use(ctx) { const p = ctx.player; buff(p, 'heroic', 8); sfx('block'); ring(p.pos.x, p.pos.y + 0.2, p.pos.z, '#ffb040', 0.5, 3, 0.4); } },
      { name: 'REND', glyph: '🩸', cd: 8, use(ctx) { const p = ctx.player, f = p.forged, m = target(ctx, (f ? f.reach : 4.6) + 2); if (!m) return noTarget(ctx); faceTo(p, new V3(m.pos.x - p.pos.x, 0, m.pos.z - p.pos.z).normalize()); p.swingT = 0; p.swingN = (p.swingN | 0) + 1; sfx('swing'); const { d } = heroDamage(4.5 * (f ? f.dmg : 1)); dot(m, d, 6, '#c8202a'); } },
      { name: 'THROW', glyph: '🪓', cd: 9, use(ctx) { const m = target(ctx, 40); if (!m) return noTarget(ctx); const f = ctx.player.forged; ctx.player.swingT = 0; fireAt(ctx, m, '#c8c8d0', { speed: 70, mult: 1.6 * (f ? f.dmg : 1), arrow: true }); sfx('swing'); } },
      { name: 'BLOCK', glyph: '🛡', cd: 14, use(ctx) { const p = ctx.player; buff(p, 'block', 5); sfx('block'); ring(p.pos.x, p.pos.y + 0.2, p.pos.z, '#9fd8ff', 0.5, 5, 0.6); } },
      { name: 'SHOUT', glyph: '📯', cd: 22, use(ctx) { const p = ctx.player; buff(p, 'dmgUp', 12, { mult: 1.25 }); sfx('roar'); ring(p.pos.x, p.pos.y + 0.2, p.pos.z, '#ffd45a', 1, 12, 0.7); } },
      { name: '2ND WIND', glyph: '❤', cd: 40, use(ctx) { const p = ctx.player; buff(p, 'hot', 8, { per: stats.maxHp * 0.05 }); sfx('drink'); burst(p.pos.x, p.pos.y + 3, p.pos.z, '#7cff8a', 16, 6, 1.2, true, 0.8); } },
    ] },
  // ---- mage
  { name: 'MAGE', attack: { name: 'BOLT', cd: 1.8, cdOf: p => p.forged ? p.forged.time : PLAIN_TIME[1], use(ctx) {
      const p = ctx.player, from = p.pos.clone(), f = p.forged; from.y += 3.8;
      const dir = ctx.aim(from); faceTo(p, dir); p.castT = 0; p.castKind = 'bolt';
      // (a staff from the forge: its gem's color, its damage, how fast the bolt flies)
      // (the bolt leaves the staff as the thrust lands; a monster on the move is re-aimed at then)
      ctx.later(0.14, () => { const d2 = ctx.aim(from); ctx.bolts.fire(from.clone().addScaledVector(d2, 1.8), d2, f ? f.color : BOLT, { speed: 68 * (f ? f.shot : 1), mult: f ? f.dmg : 1 }); sfx('cast'); });
    } },
    abilities: [
      { name: 'BLINK', glyph: '⟿', cd: 4, use(ctx) {
          const p = ctx.player, dir = moveDir(p), from = p.pos.clone();
          if (!p.blink(dir.x, dir.z)) { sfx('nope'); return false; }
          burst(from.x, from.y + 3, from.z, BOLT, 14, 12, 1.6, true, 0.5); burst(p.pos.x, p.pos.y + 3, p.pos.z, BOLT, 14, 12, 1.6, true, 0.5);
          sfx('blink');
        } },
      { name: 'NOVA', glyph: '❄', cd: 9, use(ctx) {
          const p = ctx.player; p.castT = 0; p.castKind = 'nova';
          ring(p.pos.x, p.pos.y + 0.3, p.pos.z, FROST, 1, 13, 0.6); burst(p.pos.x, p.pos.y + 2, p.pos.z, '#cfeeff', 30, 14, 1.6, true, 0.7, 2);
          sfx('blink');
          for (const m of around(ctx.monsters, p.pos.x, p.pos.y + 2, p.pos.z, 12)) { m.frz = 3.2; m.vel.set(0, m.vel.y, 0); }
          hitAll(ctx, around(ctx.monsters, p.pos.x, p.pos.y + 2, p.pos.z, 12), 0.5, p.pos);
        } },
      { name: 'METEOR', glyph: '☄', cd: 12, use(ctx) {
          const p = ctx.player, from = p.pos.clone(); from.y += 3.8;
          const dir = ctx.aim(from); faceTo(p, dir); p.castT = 0; p.castKind = 'meteor';
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
      // ---- six more
      { name: 'FIREBALL', glyph: '🔥', cd: 6, use(ctx) { const m = target(ctx, 50); if (!m) return noTarget(ctx); const p = ctx.player, f = p.forged; p.castT = 0; p.castKind = 'bolt'; fireAt(ctx, m, FIRE, { speed: 55, mult: 2.6 * (f ? f.dmg : 1) }); sfx('cast'); } },
      { name: 'MISSILES', glyph: '✧', cd: 9, use(ctx) { const m = target(ctx, 50); if (!m) return noTarget(ctx); const p = ctx.player, f = p.forged; p.castT = 0; p.castKind = 'bolt'; for (let i = 0; i < 5; i++) ctx.later(i * 0.16, () => { if (ctx.monsters.list.includes(m)) { fireAt(ctx, m, '#d08cff', { speed: 80, mult: 0.7 * (f ? f.dmg : 1) }); sfx('shoot'); } }); } },
      { name: 'ICE LANCE', glyph: '❆', cd: 4, use(ctx) { const m = target(ctx, 50); if (!m) return noTarget(ctx); const p = ctx.player, f = p.forged; p.castT = 0; p.castKind = 'bolt'; fireAt(ctx, m, FROST, { speed: 90, mult: (m.frz > 0 ? 2.4 : 0.9) * (f ? f.dmg : 1) }); sfx('blink'); } },
      { name: 'CHAIN', glyph: '⚡', cd: 10, use(ctx) { let m = target(ctx, 45); if (!m) return noTarget(ctx); const p = ctx.player, f = p.forged, hit = new Set(); p.castT = 0; p.castKind = 'bolt'; let from = p.pos.clone(); from.y += 3.6;
          for (let j = 0; j < 4 && m; j++) { hit.add(m); const to = new V3(m.pos.x, m.pos.y + m.k.h * 0.5, m.pos.z); burst(to.x, to.y, to.z, '#9fe0ff', 12, 8, 1.2, true, 0.4); for (let k = 0; k <= 6; k++) { const q = from.clone().lerp(to, k / 6); burst(q.x + (Math.random() - 0.5) * 0.6, q.y + (Math.random() - 0.5) * 0.6, q.z + (Math.random() - 0.5) * 0.6, '#cfefff', 1, 1, 0.8, true, 0.25, 0); }
            hitAll(ctx, [m], 1.4 * (f ? f.dmg : 1) * Math.pow(0.8, j), from); from = to; let nb = null, nd = 14; for (const o of ctx.monsters.list) { if (hit.has(o)) continue; const d = o.pos.distanceTo(to); if (d < nd) { nd = d; nb = o; } } m = nb; }
          sfx('crit'); } },
      { name: 'POLYMORPH', glyph: '🐑', cd: 18, use(ctx) { const m = target(ctx, 40); if (!m) return noTarget(ctx); m.frz = 8; m.state = 'wander'; if (ctx.monsters.focus === m) { ctx.monsters.focus = null; } burst(m.pos.x, m.pos.y + m.k.h * 0.6, m.pos.z, '#ffb0e0', 20, 6, 1.4, true, 0.7); sfx('blink'); } },
      { name: 'BARRIER', glyph: '💠', cd: 24, use(ctx) { const p = ctx.player; buff(p, 'absorb', 15, { left: Math.round(stats.maxHp * 0.35) }); sfx('block'); ring(p.pos.x, p.pos.y + 0.2, p.pos.z, FROST, 0.5, 5, 0.6); } },
    ] },
  // ---- hunter
  { name: 'HUNTER', attack: { name: 'SHOOT', cd: 1.6, cdOf: p => p.forged ? p.forged.time : PLAIN_TIME[2], use(ctx) {
      const p = ctx.player, from = p.pos.clone(), f = p.forged; from.y += 3.6;
      const dir = ctx.aim(from); faceTo(p, dir); p.castT = 0; p.castKind = 'shot';
      // (the arrow flies when the string is loosed)
      ctx.later(0.16, () => { const d2 = ctx.aim(from); ctx.bolts.fire(from.clone().addScaledVector(d2, 1.8), d2, ARROW, { speed: 96 * (f ? f.shot : 1), arrow: true, mult: f ? f.dmg : 1 }); sfx('shoot'); });
    } },
    abilities: [
      { name: 'ROLL', glyph: '↻', cd: 3, use(ctx) {
          const p = ctx.player, dir = moveDir(p);
          faceTo(p, dir); p.dash = { t: 0.42, dx: dir.x, dz: dir.z, spd: 30, roll: true, hit: new Set() }; p.invT = Math.max(p.invT, 0.5);
          sfx('roll');
        } },
      { name: 'MULTI', glyph: '⋔', cd: 6, use(ctx) {
          const p = ctx.player, f = p.forged, R = 50;
          // up to three targets: yours first, then the nearest others in (or near) range; fewer than three and
          // the spare arrows go to them in turn (one target takes all three), loosed a beat apart
          const first = target(ctx, R), picks = first ? [first] : [];
          ctx.monsters.list.filter(m => m !== first && m.hp > 0 && m.pos.distanceTo(p.pos) < R + m.k.r)
            .sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos)).slice(0, 3 - picks.length).forEach(m => picks.push(m));
          p.castT = 0; p.castKind = 'multi';
          if (picks.length) {
            for (let i = 0; i < 3; i++) { const m = picks[i % picks.length];
              ctx.later(i * 0.07, () => { if (ctx.monsters.list.includes(m)) { fireAt(ctx, m, ARROW, { speed: 110, arrow: true, mult: 0.8 * (f ? f.dmg : 1) }); sfx('shoot'); } }); }
            return;
          }
          // (nothing near: a fan of three where you look)
          const from = p.pos.clone(); from.y += 3.6;
          const dir = ctx.aim(from); faceTo(p, dir); from.addScaledVector(dir, 1.8);
          for (let i = -1; i <= 1; i++) {
            const a = i * 0.16, d = new V3(dir.x * Math.cos(a) - dir.z * Math.sin(a), dir.y, dir.x * Math.sin(a) + dir.z * Math.cos(a)).normalize();
            ctx.bolts.fire(from.clone(), d, ARROW, { speed: 96, arrow: true, mult: 0.8 * (f ? f.dmg : 1) });
          }
          sfx('shoot');
        } },
      { name: 'RAIN', glyph: '⇣', cd: 12, use(ctx) {
          const p = ctx.player, from = p.pos.clone(); from.y += 3.6;
          const dir = ctx.aim(from); faceTo(p, dir); p.castT = 0; p.castKind = 'rain';
          const at = ctx.aimAt.clone();
          ring(at.x, at.y + 0.3, at.z, ARROW, 0.5, 7, 0.9);
          sfx('shoot');
          for (let i = 0; i < 20; i++) ctx.later(0.35 + i * 0.04, () => {
            const a = Math.random() * 6.28, r = Math.random() * 5;
            const s = new V3(at.x + Math.cos(a) * r, at.y + 26, at.z + Math.sin(a) * r);
            ctx.bolts.fire(s, new V3(0.05 * (Math.random() - 0.5), -1, 0.05 * (Math.random() - 0.5)).normalize(), ARROW, { speed: 70, arrow: true, mult: 0.7 });
          });
        } },
      // ---- six more
      { name: 'AIMED', glyph: '🎯', cd: 7, use(ctx) { const m = target(ctx, 60); if (!m) return noTarget(ctx); const p = ctx.player, f = p.forged; p.castT = 0; p.castKind = 'shot'; ctx.later(0.3, () => { if (ctx.monsters.list.includes(m)) { fireAt(ctx, m, '#ffd45a', { speed: 130, arrow: true, mult: 3 * (f ? f.dmg : 1) }); sfx('crit'); } }); } },
      { name: 'STING', glyph: '🐍', cd: 7, use(ctx) { const m = target(ctx, 50); if (!m) return noTarget(ctx); const p = ctx.player, f = p.forged; p.castT = 0; p.castKind = 'shot'; fireAt(ctx, m, '#5ce65c', { speed: 96, arrow: true, mult: 0.4 * (f ? f.dmg : 1) }); const { d } = heroDamage(4 * (f ? f.dmg : 1)); dot(m, d, 8, '#5ce65c'); sfx('shoot'); } },
      { name: 'CONCUSS', glyph: '💫', cd: 9, use(ctx) { const m = target(ctx, 50); if (!m) return noTarget(ctx); const p = ctx.player, f = p.forged; p.castT = 0; p.castKind = 'shot'; fireAt(ctx, m, '#9fd8ff', { speed: 96, arrow: true, mult: 0.6 * (f ? f.dmg : 1) }); m.slow = 6; m.frz = Math.max(m.frz || 0, 1.2); sfx('shoot'); } },
      { name: 'RAPID FIRE', glyph: '⏩', cd: 30, use(ctx) { const p = ctx.player; buff(p, 'haste', 10, { mult: 1.6 }); sfx('roar'); ring(p.pos.x, p.pos.y + 0.2, p.pos.z, '#ffd45a', 0.5, 6, 0.6); } },
      { name: 'TAME', glyph: '🐾', cd: 5, use(ctx) { const m = target(ctx, 40); if (!m) return noTarget(ctx); if (!TAMEABLE[m.type]) { ctx.say && ctx.say('THAT ONE IS TOO MIGHTY TO TAME'); return false; } m.taming = true; const p = ctx.player; p.castT = 0; p.castKind = 'rain'; m.frz = 3; ring(m.pos.x, m.pos.y + 0.2, m.pos.z, '#ffd45a', 0.5, 4, 2.4); sfx('blink');
          ctx.later(2.4, () => { m.taming = false; if (!ctx.monsters.list.includes(m) || stats.hp <= 0) return; const name = ctx.pet && ctx.pet.tame(m); if (name) ctx.say && ctx.say(`${name.toUpperCase()} IS YOURS`, '#ffd45a'); }); } },
      { name: 'WRATH', glyph: '🐺', cd: 25, use(ctx) { if (!ctx.pet || !ctx.pet.p) { ctx.say && ctx.say('YOU HAVE NO PET'); return false; } ctx.pet.wrath = 10; sfx('roar'); } },
    ] },
];

// ---------------------------------------------------------------- running them
export class Abilities {
  constructor(ctx) {
    this.ctx = ctx; this.cd = new Array(9).fill(0); this.atkCd = 0; this.timers = []; ctx.player.buffs = {};
    ctx.later = (t, f) => this.timers.push({ t, f }); monstersRef = ctx.monsters;
    ctx.aimAt = new V3();
    ctx.aim = from => { const to = aimPoint(ctx.world, ctx.monsters, from); ctx.aimAt.copy(to); const d = to.sub(from); if (d.length() < 1) return camFlat(ctx.player); return d.normalize(); };
  }
  kit() { return KITS[this.ctx.player.cls] || KITS[0]; }
  update(dt, inp) {
    inputRef = inp;
    const ctx = this.ctx, p = ctx.player, kit = this.kit();
    this.atkCd -= dt; for (let i = 0; i < 9; i++) this.cd[i] -= dt;
    // the buffs run down; a heal over time heals; the damage buffs set the multiplier every blow takes
    const B = p.buffs; for (const k in B) { B[k].t -= dt; if (k === 'hot' && B[k].t > 0) stats.hp = Math.min(stats.maxHp, stats.hp + B[k].per * dt); if (B[k].t <= 0 || (k === 'absorb' && B[k].left <= 0)) delete B[k]; }
    heroBuff.dmg = (B.dmgUp ? B.dmgUp.mult : 1);
    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; if ((t.t -= dt) <= 0) { this.timers.splice(i, 1); t.f(); } }
    if (stats.hp <= 0 || ctx.frozen) { inp.atkEdge = false; inp.abEdge.fill(false); return; }
    const busy = p.dash || (p.swingT >= 0 && p.whirl);
    if ((inp.atkEdge || inp.atk) && this.atkCd <= 0 && !busy) { this.atkCd = (kit.attack.cdOf ? kit.attack.cdOf(p) : kit.attack.cd) / (B.haste ? B.haste.mult : 1); kit.attack.use(ctx); }
    inp.atkEdge = false;
    for (let i = 0; i < 9; i++) {
      if (!inp.abEdge[i] || !kit.abilities[i]) { inp.abEdge[i] = false; continue; }
      inp.abEdge[i] = false;
      if (this.cd[i] > 0 || busy) { sfx('nope'); continue; }
      const ab = kit.abilities[i];
      if (ab.use(ctx) !== false) this.cd[i] = ab.cd;
    }
  }
  // for the HUD: each slot's name, key and how much of its cooldown is left (0..1)
  // the swing timer: how far the basic attack's time between swings has run (0 ready .. 1 just swung), and the time itself
  swing() { const kit = this.kit(), p = this.ctx.player, t = kit.attack.cdOf ? kit.attack.cdOf(p) : kit.attack.cd; return { left: Math.max(0, this.atkCd / t), time: t }; }
  slots() { const kit = this.kit(); return kit.abilities.map((a, i) => ({ name: a.name, glyph: a.glyph, cd: a.cd, left: Math.max(0, this.cd[i] / a.cd) })); }
  reset() { this.cd.fill(0); this.atkCd = 0; this.timers.length = 0; }
}
