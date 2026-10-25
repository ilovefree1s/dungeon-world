// ============================================================================
//  DUNGEON WORLD  -  the hunter's pet: TAME BEAST on a wild slime, bat or
//  spider (Dungeon Heart's three) turns it into a friend in a red bandana,
//  with a name. It trots at your heel, joins your fights (biting what you
//  target, or whatever's biting you), and is kept between visits. One at a
//  time: taming another lets the old one go.
// ============================================================================
import { THREE, scene, V3 } from './engine.js';
import { buildPet, PET_NAMES } from './dh/pets.js';
import { stats, heroBuff, KIND as MKIND } from './combat.js';
import { buildMonster } from './dh/models.js';
import { kay, makeGoblin, IS_GOB } from './kayhero.js';
import { burst, ring, number } from './fx.js';
import { sfx } from './audio.js';
import * as D from './dh/data.js';

const KEY = 'dw-pet-v1';
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
// anything but the big ones (golem, slime king, demon, wraith, inferno) can be tamed: a slime, bat or spider becomes
// one of Dungeon Heart's own pets in a bandana; anything else keeps its own shape
const BOSSES = new Set([D.M_GOLEM, D.M_SLIMEKING, 15, 16, 17]);
export const TAMEABLE = new Proxy({}, { get: (_, t) => !BOSSES.has(+t) && +t > 0 });
const CUTE = { [D.M_SLIME]: 1, [D.M_BAT]: 2, [D.M_SPIDER]: 4 };
const KIND = new Proxy({ 1: { spd: 15, fly: 0, scale: 1.7 }, 2: { spd: 18, fly: 1, scale: 1.6 }, 4: { spd: 17, fly: 0, scale: 1.7 } },
  { get: (o, t) => o[t] || { spd: 16, fly: MKIND[t] && MKIND[t].fly ? 1 : 0, scale: 1.24 } });

export class Pet {
  constructor(player, world, monsters) {
    this.player = player; this.world = world; this.monsters = monsters;
    this.p = null; this.wrath = 0;
    try { const s = JSON.parse(ls.get(KEY)); if (s && s.type) this.make(s.type, s.name, player.pos.clone()); } catch (e) { }
  }
  get name() { return this.p ? this.p.name : null; }
  save() { ls.set(KEY, JSON.stringify(this.p ? { type: this.p.type, name: this.p.name } : null)); }
  make(type, name, at) {
    this.dismiss(true);
    const gob = IS_GOB(type), root = CUTE[type] ? buildPet(CUTE[type]) : gob && kay.ready ? makeGoblin(type, type >= 20 ? 3.6 : 3.2) : buildMonster(gob ? D.M_SKEL : type, 1 + Math.floor(stats.level / 3)); root.scale.multiplyScalar(KIND[type].scale);
    root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    scene.add(root);
    const maxHp = 40 + stats.level * 12;
    this.p = { type, name, root, pos: at.clone(), face: 0, biteCd: 0, seed: Math.random() * 10, moving: false, hp: maxHp, maxHp, hurtCd: 1.5, calm: 0, down: 0 };
    this.save();
  }
  dismiss(quiet = false) {
    if (!this.p) return;
    scene.remove(this.p.root); this.p.root.traverse(o => o.geometry && o.geometry.dispose());
    this.p = null; if (!quiet) this.save();
  }
  // a wild one becomes yours
  tame(m) {
    if (!TAMEABLE[m.type]) return false; const type = m.type;
    const names = PET_NAMES[CUTE[type] || 1], name = names[Math.floor(Math.random() * names.length)];
    const at = m.pos.clone();
    this.monsters.remove(m);
    this.make(type, name, at);
    ring(at.x, at.y + 0.2, at.z, '#ffd45a', 0.6, 8, 0.7); burst(at.x, at.y + 1.5, at.z, '#ff8aa0', 24, 8, 1.6, true, 0.8);
    sfx('legend');
    return name;
  }
  // when the hero has fallen and stands up again, the pet comes back to their side
  recall() { const P = this.p; if (P) { P.pos.copy(this.player.pos); P.pos.x += 2; P.down = 0; P.hp = P.maxHp; } }
  update(dt, autoAtk) {
    const P = this.p; if (!P) return;
    // (only the hunter's: while you play another hero it waits out of sight)
    P.maxHp = 40 + stats.level * 12; P.hp = Math.min(P.hp, P.maxHp);
    // (fallen: it lies low a while, then comes back to your side at half its health)
    if (P.down > 0) { P.down -= dt; P.root.visible = false; if (P.down <= 0) { P.hp = Math.ceil(P.maxHp / 2); P.pos.copy(this.player.pos); P.pos.x += 2; } return; }
    P.root.visible = this.player.cls === 2; if (!P.root.visible) { P.pos.copy(this.player.pos); return; }
    const hero = this.player.pos, w = this.world, k = KIND[P.type], t = performance.now() / 1000;
    this.wrath = Math.max(0, this.wrath - dt); P.biteCd -= dt;
    // what it's after: your target while you fight it, else whatever's hunting you nearby
    let foe = this.monsters.focus && this.monsters.list.includes(this.monsters.focus) && (autoAtk || this.monsters.focus.state === 'chase') ? this.monsters.focus : null;
    if (!foe) { let bd = 18; for (const m of this.monsters.list) { if (m.state !== 'chase') continue; const d = m.pos.distanceTo(hero); if (d < bd) { bd = d; foe = m; } } }
    let gx, gz, stop;
    if (foe) { gx = foe.pos.x; gz = foe.pos.z; stop = foe.k.r + 1.4; }
    else { const side = Math.sin(this.player.face + Math.PI * 0.75), back = Math.cos(this.player.face + Math.PI * 0.75); gx = hero.x + side * 3.2; gz = hero.z + back * 3.2; stop = 1.2; }
    // far behind (a jump, a teleport): it catches up at once
    if (Math.hypot(hero.x - P.pos.x, hero.z - P.pos.z) > 60) { P.pos.copy(hero); P.pos.x += 2; }
    const dx = gx - P.pos.x, dz = gz - P.pos.z, d = Math.hypot(dx, dz);
    P.moving = d > stop;
    if (P.moving) { const sp = Math.min(d - stop, k.spd * (foe ? 1 : d > 10 ? 1.4 : 0.8) * dt); P.pos.x += dx / d * sp; P.pos.z += dz / d * sp; P.face = Math.atan2(dx, dz); }
    else if (foe) P.face = Math.atan2(dx, dz);
    const g = w.poly ? w.ground(P.pos.x, P.pos.z) : null;
    if (g !== null && g !== undefined) P.pos.y += ((g + (k.fly ? 3.4 + Math.sin(t * 3 + P.seed) * 0.4 : 0)) - P.pos.y) * Math.min(1, dt * 12);
    // what it's fighting fights back; out of a fight it heals
    if (foe && !P.moving) { P.calm = 0; P.hurtCd -= dt; if (P.hurtCd <= 0) { P.hurtCd = 1.6 + Math.random() * 0.6; const d = Math.max(1, Math.round((foe.atk || 3) * (0.6 + Math.random() * 0.4))); P.hp -= d; number(P.pos.x, P.pos.y + 2.4, P.pos.z, d);
      if (P.hp <= 0) { P.hp = 0; P.down = 20; P.root.visible = false; burst(P.pos.x, P.pos.y + 1, P.pos.z, '#c8b8a8', 18, 6, 1.2, false, 0.8); return; } } }
    else { P.calm += dt; if (P.calm > 4 && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.05 * dt); }
    // the bite: a share of the hero's own blow, twice as hard in a bestial wrath
    if (foe && !P.moving && P.biteCd <= 0) {
      P.biteCd = 1.5; P.lunge = 0.25;
      const dmg = Math.max(1, Math.round((5 + stats.level * 1.5) * 0.45 * (this.wrath > 0 ? 2 : 1) * (0.85 + Math.random() * 0.3)));
      sfx('bite');
      this.monsters.hit(foe, dmg, false, new V3(dx / (d || 1), 0, dz / (d || 1)));
    }
    P.lunge = Math.max(0, (P.lunge || 0) - dt);
    P.root.position.copy(P.pos);
    if (P.lunge > 0) { const a = Math.sin(P.lunge / 0.25 * Math.PI) * 0.8; P.root.position.x += Math.sin(P.face) * a; P.root.position.z += Math.cos(P.face) * a; }
    P.root.rotation.y = P.face;
    if (P.root.userData.anim) P.root.userData.anim(t, { moving: P.moving, seed: P.seed, timer: Math.floor(t * 4 + P.seed * 20), attack: P.lunge > 0 });
    if (this.wrath > 0 && Math.random() < dt * 8) burst(P.pos.x, P.pos.y + 1.2, P.pos.z, '#ff4a3c', 2, 2, 0.8, true, 0.4);
  }
}
