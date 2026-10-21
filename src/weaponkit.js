// ============================================================================
//  DUNGEON WORLD  -  weaponkit: weapons built from parts, in Dungeon Heart's
//  code-built style. A spec (type, head, material, guard, grip, pommel, sizes,
//  colors) becomes a model held grip-at-origin, blade up (+y), as its swords
//  are; the same spec gives its name and its numbers in a fight.
// ============================================================================
import { THREE, std, mesh, sph, TEX, V3 } from './engine.js';

const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const cyl = (a, b, h, s = 12) => new THREE.CylinderGeometry(a, b, h, s);
function extrude(pts, depth, bevel = 0.012) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -depth / 2);
  return g;
}
const mirror = half => [...half, ...half.slice().reverse().map(([x, y]) => [-x, y])];

// ---------------------------------------------------------------- the parts on offer
// cls: who wields it (0 warrior, 1 mage, 2 hunter)
export const TYPES = [
  { id: 'sword', name: 'SWORD', cls: 0, heads: ['straight', 'leaf', 'curved', 'serrated'], dmg: 1, spd: 1, reach: 1 },
  { id: 'greatsword', name: 'GREATSWORD', cls: 0, heads: ['straight', 'leaf', 'flamberge', 'cleaver'], dmg: 1.45, spd: 0.7, reach: 1.25 },
  { id: 'dagger', name: 'DAGGER', cls: 0, heads: ['straight', 'curved', 'kris', 'needle'], dmg: 0.6, spd: 1.6, reach: 0.7 },
  { id: 'axe', name: 'AXE', cls: 0, heads: ['single', 'double', 'bearded', 'crescent'], dmg: 1.3, spd: 0.8, reach: 1 },
  { id: 'hammer', name: 'HAMMER', cls: 0, heads: ['block', 'maul', 'spiked', 'anvil'], dmg: 1.6, spd: 0.6, reach: 1.05 },
  { id: 'mace', name: 'MACE', cls: 0, heads: ['flanged', 'ball', 'star', 'lantern'], dmg: 1.2, spd: 0.85, reach: 0.95 },
  { id: 'staff', name: 'STAFF', cls: 1, heads: ['orb', 'crescent', 'claw', 'lantern'], dmg: 1, spd: 1, reach: 1 },
  { id: 'wand', name: 'WAND', cls: 1, heads: ['gem', 'star', 'twist', 'skull'], dmg: 0.7, spd: 1.5, reach: 0.9 },
  { id: 'bow', name: 'BOW', cls: 2, heads: ['recurve', 'longbow', 'flat', 'horned'], dmg: 1, spd: 1, reach: 1 },
  { id: 'crossbow', name: 'CROSSBOW', cls: 2, heads: ['light', 'heavy', 'repeater', 'siege'], dmg: 1.5, spd: 0.6, reach: 1.2 },
];
export const HERO_NAME = ['WARRIOR', 'MAGE', 'HUNTER'];
export const typeOf = spec => TYPES.find(x => x.id === spec.type) || TYPES[0];
export const clsOf = spec => typeOf(spec).cls;
export const isMelee = spec => clsOf(spec) === 0;
export const MATERIALS = [
  { id: 'steel', name: 'STEEL', color: '#c8d0da', metalness: 1, roughness: 0.25, dmg: 1 },
  { id: 'iron', name: 'IRON', color: '#7d838a', metalness: 0.8, roughness: 0.55, dmg: 0.9 },
  { id: 'bronze', name: 'BRONZE', color: '#c48a4a', metalness: 0.9, roughness: 0.35, dmg: 0.95 },
  { id: 'gold', name: 'GOLD', color: '#f0b73c', metalness: 1, roughness: 0.2, dmg: 1.05 },
  { id: 'obsidian', name: 'OBSIDIAN', color: '#2a2238', metalness: 0.3, roughness: 0.15, dmg: 1.15 },
  { id: 'bone', name: 'BONE', color: '#e6dccb', metalness: 0, roughness: 0.6, dmg: 0.85 },
  { id: 'jade', name: 'JADE', color: '#4fb07a', metalness: 0.2, roughness: 0.2, dmg: 1 },
  { id: 'crystal', name: 'CRYSTAL', color: '#b48cff', glow: '#7a3cff', metalness: 0.2, roughness: 0.1, dmg: 1.2 },
  { id: 'ember', name: 'EMBER', color: '#ff8a3a', glow: '#ff4a10', metalness: 0.6, roughness: 0.3, dmg: 1.25 },
  { id: 'frost', name: 'FROST', color: '#bfe8ff', glow: '#4ab0ff', metalness: 0.5, roughness: 0.15, dmg: 1.2 },
];
export const GUARDS = ['none', 'bar', 'cross', 'wings', 'ring', 'upswept'];
export const GRIPS = ['leather', 'wrapped', 'wood', 'bone', 'chain'];
export const POMMELS = ['none', 'ball', 'disc', 'spike', 'gem', 'ring'];
export const ACCENTS = [['#ff3b3b', 'RUBY'], ['#3b8cff', 'SAPPHIRE'], ['#4fd36a', 'EMERALD'], ['#ffd23b', 'TOPAZ'], ['#c25cff', 'AMETHYST'], ['#ffffff', 'DIAMOND'], ['#ff8c2a', 'AMBER'], ['#1b1a1d', 'ONYX']];
export const GRIP_COLORS = [['#5a3a22', 'BROWN'], ['#1e1e24', 'BLACK'], ['#7a1c22', 'RED'], ['#1e2c5a', 'BLUE'], ['#2c4a20', 'GREEN'], ['#6a4426', 'OAK'], ['#efe4c8', 'IVORY'], ['#f0b73c', 'GOLD']];

export function randomSpec(rnd = Math.random) {
  const pick = a => a[Math.floor(rnd() * a.length)];
  const t = pick(TYPES);
  return { type: t.id, head: pick(t.heads), material: pick(MATERIALS).id, guard: pick(GUARDS), grip: pick(GRIPS), pommel: pick(POMMELS),
    accent: Math.floor(rnd() * ACCENTS.length), gripColor: Math.floor(rnd() * GRIP_COLORS.length), length: 0.8 + rnd() * 0.5, width: 0.8 + rnd() * 0.5, name: '' };
}
export const defaultSpec = () => ({ type: 'sword', head: 'straight', material: 'steel', guard: 'cross', grip: 'leather', pommel: 'ball', accent: 0, gripColor: 0, length: 1, width: 1, name: '' });

// ---------------------------------------------------------------- names
const ADJ = { steel: 'STEEL', iron: 'IRON', bronze: 'BRONZE', gold: 'GILDED', obsidian: 'BLACK', bone: 'BONE', jade: 'JADE', crystal: 'PRISM', ember: 'EMBER', frost: 'FROST' };
const NOUN = { sword: ['BLADE', 'SWORD', 'EDGE'], greatsword: ['CLAYMORE', 'GREATSWORD', 'SLAB'], dagger: ['DAGGER', 'FANG', 'STING'], axe: ['AXE', 'CLEAVER', 'HEWER'], hammer: ['HAMMER', 'MAUL', 'CRUSHER'], mace: ['MACE', 'MORNINGSTAR', 'SCEPTER'],
  staff: ['STAFF', 'ROD', 'CROOK'], wand: ['WAND', 'SPRIG', 'FINGER'], bow: ['BOW', 'LONGBOW', 'STRINGSONG'], crossbow: ['CROSSBOW', 'ARBALEST', 'BOLTER'] };
const EPITHET = ['OF THE WOODS', 'OF DAWN', 'OF THE DEEP', 'OF EMBERS', 'OF WINTER', 'OF THE TOWER', 'OF THE BOG', 'OF STORMS', 'OF THE KING', 'OF OLD'];
export function nameOf(spec, rnd = Math.random) {
  const pick = a => a[Math.floor(rnd() * a.length)];
  const n = pick(NOUN[spec.type]);
  return rnd() < 0.5 ? `${ADJ[spec.material]} ${n}` : `${n} ${pick(EPITHET)}`;
}
// ---------------------------------------------------------------- numbers
// damage and speed as multipliers of the warrior's plain swing, reach in blocks
export function statsOf(spec) {
  const t = TYPES.find(x => x.id === spec.type) || TYPES[0], m = MATERIALS.find(x => x.id === spec.material) || MATERIALS[0];
  const dmg = t.dmg * m.dmg * (0.8 + spec.length * 0.2) * (0.85 + spec.width * 0.15);
  const spd = t.spd / (0.75 + spec.length * 0.15 + spec.width * 0.1);
  const reach = 4.6 * t.reach * (0.7 + spec.length * 0.3);
  // (for staffs and bows the reach is how fast the shot flies)
  const shot = t.reach * (0.8 + spec.length * 0.2);
  return { dmg: +dmg.toFixed(2), spd: +spd.toFixed(2), reach: +reach.toFixed(1), shot: +shot.toFixed(2), glow: !!m.glow, cls: t.cls, color: ACCENTS[spec.accent % ACCENTS.length][0] };
}

// ---------------------------------------------------------------- the model
export function buildForged(spec) {
  const g = new THREE.Group();
  const t = TYPES.find(x => x.id === spec.type) || TYPES[0], mat = MATERIALS.find(x => x.id === spec.material) || MATERIALS[0];
  const L = spec.length, W = spec.width;
  const metal = std({ color: mat.color, metalness: mat.metalness, roughness: mat.roughness, envMapIntensity: 1.1, emissive: mat.glow || '#000000', emissiveIntensity: mat.glow ? 0.9 : 0 });
  const iron = std({ color: '#8a9098', metalness: 0.85, roughness: 0.4, envMapIntensity: 0.8 });
  const accent = ACCENTS[spec.accent % ACCENTS.length][0];
  const gem = std({ color: accent, emissive: accent, emissiveIntensity: 0.7, roughness: 0.15, metalness: 0.1 });
  const gripCol = GRIP_COLORS[spec.gripColor % GRIP_COLORS.length][0];
  const gripMat = std({ color: gripCol, roughness: spec.grip === 'bone' ? 0.6 : 0.8, metalness: spec.grip === 'chain' ? 0.7 : 0 });
  const ranged = spec.type === 'bow' || spec.type === 'crossbow';
  // the grip: longer for two-handed things
  const two = spec.type === 'greatsword' || spec.type === 'hammer' || (spec.type === 'axe' && spec.head === 'double');
  const gl = (two ? 0.62 : spec.type === 'dagger' ? 0.26 : 0.34) * (0.8 + L * 0.2);
  g.userData.gripLen = ranged ? 0.3 : gl;
  if (ranged) { /* (the bow's own grip sits on its limbs) */ }
  else if (spec.grip === 'wrapped') { for (let i = 0; i < Math.round(gl / 0.06); i++) { const r = mesh(cyl(0.05, 0.05, 0.045, 10), gripMat); r.position.y = -gl / 2 + 0.03 + i * 0.06; r.rotation.y = i * 0.5; g.add(r); } }
  else if (spec.grip === 'chain') { for (let i = 0; i < Math.round(gl / 0.07); i++) { const r = mesh(new THREE.TorusGeometry(0.04, 0.014, 6, 10), gripMat); r.position.y = -gl / 2 + 0.035 + i * 0.07; r.rotation.y = i * Math.PI / 2; r.rotation.x = Math.PI / 2; g.add(r); } g.add(mesh(cyl(0.03, 0.03, gl, 8), iron)); }
  else { const gr = mesh(cyl(0.045, 0.05, gl, 10), gripMat); g.add(gr); if (spec.grip === 'wood' || spec.grip === 'bone') { const band = mesh(cyl(0.055, 0.055, 0.04, 10), iron); band.position.y = -gl / 2 + 0.05; g.add(band); } }
  const top = gl / 2, bottom = -gl / 2;
  // the pommel
  const pm = ranged ? 'none' : spec.pommel;
  if (pm === 'ball') { const p = mesh(sph(0.07, 10, 8), iron); p.position.y = bottom - 0.03; g.add(p); }
  else if (pm === 'disc') { const p = mesh(cyl(0.09, 0.09, 0.05, 14), iron); p.position.y = bottom - 0.03; g.add(p); }
  else if (pm === 'spike') { const p = mesh(new THREE.ConeGeometry(0.06, 0.2, 8), iron); p.position.y = bottom - 0.1; p.rotation.x = Math.PI; g.add(p); }
  else if (pm === 'gem') { const p = mesh(new THREE.OctahedronGeometry(0.08), gem); p.position.y = bottom - 0.06; g.add(p); const c = mesh(cyl(0.06, 0.06, 0.03, 10), iron); c.position.y = bottom; g.add(c); }
  else if (pm === 'ring') { const p = mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 16), iron); p.position.y = bottom - 0.06; g.add(p); }
  // the guard (not on hammers, maces and axes: they get a collar)
  const gd = spec.guard, bladed = spec.type === 'sword' || spec.type === 'greatsword' || spec.type === 'dagger';
  if (ranged) { /* (no collar) */ }
  else if (bladed) {
    const gw = 0.36 * W * (spec.type === 'dagger' ? 0.7 : spec.type === 'greatsword' ? 1.3 : 1);
    if (gd === 'bar') { const b = mesh(box(gw, 0.06, 0.08), iron); b.position.y = top + 0.02; g.add(b); }
    else if (gd === 'cross') { const b = mesh(box(gw * 1.15, 0.07, 0.07), iron); b.position.y = top + 0.02; g.add(b); for (const s of [-1, 1]) { const e = mesh(sph(0.05, 8, 6), iron); e.position.set(s * gw * 0.57, top + 0.02, 0); g.add(e); } const c = mesh(sph(0.05, 10, 8), gem); c.position.set(0, top + 0.02, 0.05); c.scale.z = 0.6; g.add(c); }
    else if (gd === 'wings') { for (const s of [-1, 1]) { const w = mesh(extrude([[0, 0], [gw * 0.6, 0.12], [gw * 0.7, 0.3], [gw * 0.35, 0.08], [0.04, 0.1]], 0.05), iron); w.position.set(0, top - 0.02, 0); w.scale.x = s; g.add(w); } const c = mesh(sph(0.045, 10, 8), gem); c.position.set(0, top + 0.03, 0.04); g.add(c); }
    else if (gd === 'ring') { const r = mesh(new THREE.TorusGeometry(gw * 0.4, 0.025, 8, 24), iron); r.position.y = top + 0.02; r.rotation.x = Math.PI / 2; g.add(r); const b = mesh(box(gw * 0.9, 0.05, 0.06), iron); b.position.y = top + 0.02; g.add(b); }
    else if (gd === 'upswept') { for (const s of [-1, 1]) { const a = mesh(cyl(0.025, 0.04, gw * 0.7, 8), iron); a.position.set(s * gw * 0.3, top + 0.12, 0); a.rotation.z = s * 1.1; g.add(a); const tip = mesh(sph(0.035, 8, 6), gem); tip.position.set(s * gw * 0.58, top + 0.25, 0); g.add(tip); } }
    const collar = mesh(cyl(0.06, 0.055, 0.05, 12), iron); collar.position.y = top; g.add(collar);
  } else {
    const collar = mesh(cyl(0.065, 0.055, 0.08, 12), iron); collar.position.y = top; g.add(collar);
    if (gd !== 'none') { const b = mesh(cyl(0.085, 0.085, 0.04, 12), iron); b.position.y = top + 0.05; g.add(b); }
  }
  // ---- the business end
  const y0 = ranged ? 0 : top + 0.04;
  let blade = null;
  if (spec.type === 'sword' || spec.type === 'greatsword' || spec.type === 'dagger') {
    const len = (spec.type === 'sword' ? 1.2 : spec.type === 'greatsword' ? 1.7 : 0.6) * L, hw = (spec.type === 'greatsword' ? 0.085 : spec.type === 'dagger' ? 0.045 : 0.06) * W;
    let pts;
    switch (spec.head) {
      case 'leaf': pts = mirror([[hw * 0.7, 0], [hw * 1.4, len * 0.55], [hw * 0.9, len * 0.85], [0, len]]); break;
      case 'curved': pts = [[-hw, 0], [hw, 0], [hw * 1.2, len * 0.5], [hw * 2.2, len * 0.8], [hw * 1.4, len], [hw * 0.2, len * 0.9], [-hw * 0.8, len * 0.5]]; break;
      case 'serrated': { const h = [[hw, 0]]; for (let i = 1; i <= 7; i++) { h.push([hw * (i % 2 ? 1.5 : 0.9), len * (i / 8)]); } h.push([0, len]); pts = mirror(h); break; }
      case 'flamberge': { const h = []; for (let i = 0; i <= 10; i++) h.push([hw * (1 + 0.5 * Math.sin(i * 1.3)), len * (i / 11)]); h.push([0, len]); pts = mirror(h); break; }
      case 'cleaver': pts = mirror([[hw * 0.8, 0], [hw * 1.6, len * 0.15], [hw * 1.6, len * 0.9], [hw * 0.6, len], [0, len]]); break;
      case 'kris': { const h = []; for (let i = 0; i <= 8; i++) h.push([hw * (1.1 + 0.6 * Math.sin(i * 1.6)), len * (i / 9)]); h.push([0, len]); pts = mirror(h); break; }
      case 'needle': pts = mirror([[hw * 0.9, 0], [hw * 0.4, len * 0.5], [0, len]]); break;
      default: pts = mirror([[hw, 0], [hw, len * 0.86], [0, len]]);
    }
    blade = mesh(extrude(pts, spec.type === 'greatsword' ? 0.04 : 0.025), metal); blade.position.y = y0; g.add(blade);
    // a fuller down the middle, in the accent's color on the fancier blades
    if (spec.head === 'straight' || spec.head === 'leaf') for (const z of [-0.02, 0.02]) { const f = mesh(box(hw * 0.4, len * 0.6, 0.006), gem, false); f.position.set(0, y0 + len * 0.42, z); g.add(f); }
    g.userData.tipY = y0 + len;
  } else if (spec.type === 'axe') {
    const haft = mesh(cyl(0.04, 0.045, 0.8 * L, 10), gripMat); haft.position.y = y0 + 0.4 * L; g.add(haft);
    const hy = y0 + 0.62 * L, hw = 0.32 * W, hh = 0.42 * W;
    const head = (s) => { const pts = spec.head === 'bearded' ? [[0, hh * 0.3], [hw * 0.35, hh * 0.5], [hw, hh * 0.6], [hw * 1.05, -hh * 0.5], [hw * 0.5, -hh * 0.75], [hw * 0.2, -hh * 0.2], [0, -hh * 0.3]]
      : spec.head === 'crescent' ? [[0, hh * 0.35], [hw * 0.6, hh * 0.7], [hw * 1.1, 0], [hw * 0.6, -hh * 0.7], [0, -hh * 0.35], [hw * 0.45, 0]]
      : [[0, hh * 0.4], [hw * 0.5, hh * 0.55], [hw, hh * 0.3], [hw * 1.05, -hh * 0.4], [hw * 0.5, -hh * 0.55], [0, -hh * 0.4]];
      const m = mesh(extrude(pts, 0.05), metal); m.position.y = hy; m.scale.x = s; return m; };
    g.add(head(1)); if (spec.head === 'double') g.add(head(-1));
    const cap = mesh(cyl(0.055, 0.055, hh * 0.9, 10), iron); cap.position.y = hy; g.add(cap);
    const tip = mesh(new THREE.ConeGeometry(0.035, 0.16, 8), iron); tip.position.y = y0 + 0.8 * L + 0.08; g.add(tip);
    g.userData.tipY = y0 + 0.8 * L;
  } else if (spec.type === 'hammer') {
    const haft = mesh(cyl(0.045, 0.05, 0.85 * L, 10), gripMat); haft.position.y = y0 + 0.42 * L; g.add(haft);
    const hy = y0 + 0.72 * L, hw = 0.5 * W, hh = 0.22 * W;
    let head;
    if (spec.head === 'maul') head = mesh(cyl(hh * 1.1, hh * 1.1, hw * 1.1, 14), metal), head.rotation.z = Math.PI / 2;
    else if (spec.head === 'anvil') { head = mesh(box(hw * 1.2, hh * 1.4, hh * 1.2), metal); const h2 = mesh(box(hw * 0.7, hh * 0.6, hh * 1.4), metal); h2.position.y = hy + hh * 1.0; g.add(h2); }
    else head = mesh(box(hw, hh * 1.2, hh * 1.2), metal);
    head.position.y = hy; g.add(head);
    if (spec.head === 'spiked') for (const s of [-1, 1]) { const sp = mesh(new THREE.ConeGeometry(hh * 0.4, hh * 0.9, 8), iron); sp.position.set(s * (hw / 2 + hh * 0.4), hy, 0); sp.rotation.z = -s * Math.PI / 2; g.add(sp); }
    for (const s of [-1, 1]) { const band = mesh(box(0.03, hh * 1.3, hh * 1.3), iron); band.position.set(s * hw * 0.3, hy, 0); g.add(band); }
    const j = mesh(sph(0.045, 10, 8), gem); j.position.set(0, hy, hh * 0.65); j.scale.z = 0.5; g.add(j);
    g.userData.tipY = hy + hh;
  } else if (spec.type === 'mace') {
    const haft = mesh(cyl(0.04, 0.045, 0.7 * L, 10), gripMat); haft.position.y = y0 + 0.35 * L; g.add(haft);
    const hy = y0 + 0.72 * L, r = 0.16 * W;
    if (spec.head === 'ball') { const c = mesh(sph(r * 1.1, 14, 10), metal); c.position.y = hy; g.add(c); }
    else if (spec.head === 'star') { const c = mesh(sph(r * 0.8, 12, 8), metal); c.position.y = hy; g.add(c); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, b = (i % 2) * 0.9 - 0.45; const sp = mesh(new THREE.ConeGeometry(r * 0.25, r * 0.9, 6), iron); sp.position.set(Math.cos(a) * Math.cos(b) * r * 1.0, hy + Math.sin(b) * r, Math.sin(a) * Math.cos(b) * r * 1.0); sp.lookAt(0, hy, 0); sp.rotateX(-Math.PI / 2); g.add(sp); } }
    else if (spec.head === 'lantern') { const c = mesh(new THREE.OctahedronGeometry(r * 1.2, 0), gem); c.position.y = hy; g.add(c); for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; const rib = mesh(box(0.03, r * 2.2, 0.03), metal); rib.position.set(Math.cos(a) * r * 0.9, hy, Math.sin(a) * r * 0.9); g.add(rib); } const lt = new THREE.PointLight(accent, 0, 6, 2); g.add(lt); }
    else { const c = mesh(cyl(r * 0.5, r * 0.5, r * 2, 10), metal); c.position.y = hy; g.add(c); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const fl = mesh(extrude([[0, -r], [r * 1.1, -r * 0.5], [r * 1.2, r * 0.5], [0, r]], 0.03), metal); fl.position.set(0, hy, 0); fl.rotation.y = a; fl.translateX(r * 0.3); g.add(fl); } }
    const tip = mesh(new THREE.ConeGeometry(0.04, 0.14, 8), iron); tip.position.y = hy + r * 1.3; g.add(tip);
    g.userData.tipY = hy + r * 1.3;
  }
  else if (spec.type === 'staff' || spec.type === 'wand') {
    // the mage's: the shaft is the grip's wood, the head holds the gem that lights the bolts
    const wand = spec.type === 'wand';
    const shaft = (wand ? 0.7 : 1.6) * L;
    const pole = mesh(cyl(0.04, 0.055, shaft, 8), gripMat); pole.position.y = y0 + shaft / 2; g.add(pole);
    const hy = y0 + shaft, r = (wand ? 0.1 : 0.15) * W;
    const orbMat = std({ color: accent, emissive: accent, emissiveIntensity: 1.4, roughness: 0.1, metalness: 0.1 });
    g.userData.orbMat = orbMat;
    let orb;
    if (spec.head === 'orb' || spec.head === 'gem') { orb = mesh(spec.head === 'gem' ? new THREE.OctahedronGeometry(r * 1.2) : sph(r, 14, 10), orbMat, false); orb.position.y = hy + r * 0.9; const cup = mesh(cyl(r * 0.7, 0.05, r * 0.8, 8), metal); cup.position.y = hy + r * 0.2; g.add(cup); }
    else if (spec.head === 'crescent') { const c = mesh(new THREE.TorusGeometry(r * 1.6, r * 0.25, 8, 20, Math.PI * 1.3), metal); c.position.y = hy + r * 1.4; c.rotation.z = Math.PI * 0.85; g.add(c); orb = mesh(sph(r * 0.7, 12, 8), orbMat, false); orb.position.y = hy + r * 1.4; }
    else if (spec.head === 'claw') { for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3, c = mesh(new THREE.ConeGeometry(r * 0.3, r * 2.4, 6), metal); c.position.set(Math.cos(a) * r * 0.7, hy + r * 1.1, Math.sin(a) * r * 0.7); c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(c); } orb = mesh(new THREE.OctahedronGeometry(r * 0.9), orbMat, false); orb.position.y = hy + r * 1.6; }
    else if (spec.head === 'lantern') { for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; const rib = mesh(box(0.025, r * 2.6, 0.025), metal); rib.position.set(Math.cos(a) * r * 1.1, hy + r * 1.4, Math.sin(a) * r * 1.1); g.add(rib); } const cap = mesh(cyl(r * 1.3, r * 1.3, 0.05, 8), metal); cap.position.y = hy + r * 2.7; g.add(cap); orb = mesh(sph(r * 0.8, 12, 8), orbMat, false); orb.position.y = hy + r * 1.4; }
    else if (spec.head === 'star') { orb = mesh(new THREE.OctahedronGeometry(r * 1.1), orbMat, false); orb.position.y = hy + r * 1.2; for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; const sp = mesh(new THREE.ConeGeometry(r * 0.25, r * 1.1, 5), metal); sp.position.set(Math.cos(a) * r * 1.1, hy + r * 1.2, Math.sin(a) * r * 1.1); sp.lookAt(0, hy + r * 1.2, 0); sp.rotateX(-Math.PI / 2); g.add(sp); } }
    else if (spec.head === 'twist') { for (const ph of [0, Math.PI]) { const pts = []; for (let i = 0; i <= 12; i++) { const y = i / 12 * r * 2.6, a = ph + y * 9; pts.push(new V3(Math.cos(a) * r * 0.5, hy + y, Math.sin(a) * r * 0.5)); } g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.02, 6), metal)); } orb = mesh(sph(r * 0.6, 12, 8), orbMat, false); orb.position.y = hy + r * 2.8; }
    else { const sk = mesh(sph(r * 1.1, 12, 10), std({ color: '#e6dccb', roughness: 0.6 })); sk.position.y = hy + r * 1.1; g.add(sk); for (const s of [-1, 1]) { const e = mesh(sph(r * 0.3, 8, 6), orbMat, false); e.position.set(s * r * 0.45, hy + r * 1.2, r * 0.85); g.add(e); } orb = mesh(sph(r * 0.5, 10, 8), orbMat, false); orb.position.y = hy + r * 2.4; }
    g.add(orb); g.userData.orb = orb;
    const l = new THREE.PointLight(accent, 0, 8, 2); l.position.y = hy + r; g.add(l);
    g.userData.tipY = hy + r * 3;
    g.userData.tick = t => { orb.rotation.y = t * 1.2; orb.position.y += Math.sin(t * 3) * 0.002; };
  } else if (spec.type === 'bow' || spec.type === 'crossbow') {
    // the hunter's: limbs along y, the string behind at z = stringZ, drawn back when shooting (as Dungeon Heart's)
    const cross = spec.type === 'crossbow';
    const H = (cross ? 0.5 : spec.head === 'longbow' ? 1.0 : 0.78) * L;
    const pts = spec.head === 'recurve' || spec.head === 'horned' ? [[0, -H, -0.02], [0, -H * 0.8, 0.06], [0, -H * 0.45, 0.16], [0, 0, 0.2], [0, H * 0.45, 0.16], [0, H * 0.8, 0.06], [0, H, -0.02]]
      : [[0, -H, -0.1], [0, -H * 0.47, 0.12], [0, 0, 0.18], [0, H * 0.47, 0.12], [0, H, -0.1]];
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new V3(...p)));
    const limbMat = spec.head === 'flat' || spec.head === 'longbow' ? gripMat : metal;
    const thick = (cross ? 0.045 : spec.head === 'flat' ? 0.05 : 0.038) * W;
    const limbs = mesh(new THREE.TubeGeometry(curve, 28, thick, 7), limbMat); g.add(limbs);
    const end = spec.head === 'recurve' || spec.head === 'horned' ? -0.02 : -0.1;
    if (spec.head === 'horned') for (const s of [-1, 1]) { const c = mesh(new THREE.ConeGeometry(0.05, 0.22, 6), metal); c.position.set(0, s * (H + 0.08), end); c.rotation.x = s > 0 ? 0 : Math.PI; g.add(c); }
    else for (const s of [-1, 1]) { const c = mesh(cyl(0.03, 0.03, 0.08, 6), metal); c.position.set(0, s * H, end + 0.02); g.add(c); }
    if (cross) {
      // the stock, forward of the limbs
      const stock = mesh(box(0.08 * W, 0.07, 0.9 * L), gripMat); stock.position.set(0, 0, 0.45 * L - 0.1); g.add(stock);
      const rail = mesh(box(0.03, 0.02, 0.8 * L), metal); rail.position.set(0, 0.045, 0.4 * L - 0.1); g.add(rail);
      if (spec.head === 'repeater') { const mag = mesh(box(0.1, 0.16, 0.3), metal); mag.position.set(0, 0.12, 0.25); g.add(mag); }
      if (spec.head === 'siege' || spec.head === 'heavy') { const brace = mesh(box(0.14 * W, 0.04, 0.06), metal); brace.position.set(0, -0.03, 0.05); g.add(brace); }
      const trig = mesh(box(0.02, 0.08, 0.03), metal); trig.position.set(0, -0.07, 0.55 * L); g.add(trig);
    } else { const grip = mesh(cyl(0.055, 0.055, 0.24, 8), gripMat); grip.position.z = 0.19; g.add(grip); }
    const gm = mesh(new THREE.OctahedronGeometry(0.06), gem); gm.position.set(0, 0, 0.25); g.add(gm);
    const strGeo = new THREE.BufferGeometry().setFromPoints([new V3(0, -H, end), new V3(0, 0, end), new V3(0, H, end)]);
    const string = new THREE.Line(strGeo, new THREE.LineBasicMaterial({ color: mat.glow ? mat.glow : '#ece4d0' }));
    g.add(string); g.userData.string = string; g.userData.stringZ = end;
    g.userData.tipY = H; g.userData.ranged = true;
  }
  // a soft glow around the glowing materials
  if (mat.glow) {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: mat.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 }));
    halo.position.y = (y0 + g.userData.tipY) / 2; halo.scale.set(0.9, g.userData.tipY - y0 + 0.4, 1); g.add(halo);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData.bladeMat = metal;
  if (!g.userData.tick) g.userData.tick = null;
  g.userData.spec = spec;
  return g;
}
