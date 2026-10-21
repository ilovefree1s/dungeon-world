// ============================================================================
//  DUNGEON HEART  -  shields (the mage's orb, the hunter's quiver), boots,
//  gloves and trinkets by rarity, the same way as weapons and armor: plain,
//  then blue, then purple, then four legendary looks (flame, frost, void,
//  sun) that move. And the bits the hero wears to show rare and better.
// ============================================================================
import { THREE, std, mesh, sph, TEX, TAU, V3 } from './engine.js';
import { glowMat, sprite, extrude } from './weapons.js';
import { kit, legendBits, orbitRing } from './armor.js';

const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const cyl = (a, b, h, s = 12) => new THREE.CylinderGeometry(a, b, h, s);
const cap = (r, l, s = 8) => new THREE.CapsuleGeometry(r, l, 4, s);
const wood = () => std({ color: '#7a5030', roughness: 0.8 });
const leather = () => std({ color: '#5a3a22', roughness: 0.75 });
const iron = () => std({ color: '#7d838a', metalness: 0.7, roughness: 0.55 });
const done = (g, ticks) => { g.userData.tick = t => ticks.forEach(f => f(t)); return g; };

// ---------------------------------------------------------------- shields, orbs, quivers
export function buildShield(cls, rar, tier = 0) {
  const g = new THREE.Group(), k = kit(cls === 0 ? 0 : 0, rar, tier), ticks = [];
  if (cls === 1) return orb(g, k, rar, ticks);
  if (cls === 2) return quiver(g, k, rar, ticks);
  if (rar <= 1) { // a wooden round shield, iron rim and boss
    const face = mesh(cyl(0.55, 0.55, 0.08, 24), rar ? std({ color: '#3f6a32', roughness: 0.8 }) : wood()); face.rotation.x = Math.PI / 2; g.add(face);
    for (let i = -2; i <= 2; i++) { const pl = mesh(box(0.012, 1.0 - Math.abs(i) * 0.12, 0.01), std({ color: '#3a2414' }), false); pl.position.set(i * 0.2, 0, 0.045); g.add(pl); }
    const rim = mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 28), iron()); g.add(rim);
    const boss = mesh(sph(0.13, 12, 8), iron()); boss.position.z = 0.05; boss.scale.z = 0.6; g.add(boss);
    return done(g, ticks);
  }
  // a kite (rare), a spiked heater (epic) or a legendary heater
  const kite = rar === 2;
  const pts = kite ? [[-0.45, 0.45], [0, 0.6], [0.45, 0.45], [0.35, -0.1], [0, -0.75], [-0.35, -0.1]]
    : [[-0.52, 0.52], [0.52, 0.52], [0.5, -0.05], [0.25, -0.5], [0, -0.72], [-0.25, -0.5], [-0.5, -0.05]];
  const face = mesh(extrude(pts, 0.08, 0.04), k.base); g.add(face);
  const rimShape = new THREE.Mesh(extrude(pts.map(([x, y]) => [x * 1.08, y * 1.06]), 0.05, 0.02), k.trim); rimShape.position.z = -0.03; g.add(rimShape);
  if (rar === 2) { // a blue cross and a sapphire
    const v = mesh(box(0.12, 0.9, 0.03), k.core, false); v.position.set(0, -0.05, 0.07); g.add(v);
    const h = mesh(box(0.6, 0.12, 0.03), k.core, false); h.position.set(0, 0.2, 0.07); g.add(h);
  }
  if (rar === 3) { // spikes and a glowing rune
    for (const [x, y] of [[-0.5, 0.5], [0.5, 0.5], [0, -0.72], [-0.5, -0.05], [0.5, -0.05]]) { const c = mesh(new THREE.ConeGeometry(0.05, 0.24, 6), k.trim); c.position.set(x * 1.12, y * 1.1, 0); c.rotation.z = Math.atan2(-x, y); g.add(c); }
    const r = mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 6), k.core, false); r.position.set(0, 0.05, 0.07); g.add(r);
    const sp = sprite(TEX.spark, '#d08aff', 0.25); g.add(sp); ticks.push(t => { sp.position.set(Math.sin(t * 2) * 0.4, Math.cos(t * 1.4) * 0.4, 0.15); sp.material.opacity = 0.5 + Math.sin(t * 6) * 0.4; });
  }
  const gem = mesh(new THREE.OctahedronGeometry(rar >= 4 ? 0.14 : 0.1), k.core); gem.position.set(0, 0.12, 0.09); gem.scale.z = 0.5; g.add(gem);
  if (rar >= 4) {
    const { d } = k;
    if (d === 0) for (const s of [-1, 1]) { const w = mesh(extrude([[0, 0], [0.3 * s, 0.25], [0.55 * s, 0.6], [0.4 * s, 0.35], [0.45 * s, 0.5], [0.2 * s, 0.15]], 0.03), k.trim); w.position.set(0.4 * s, 0.25, -0.02); g.add(w); }
    if (d === 1) for (let i = 0; i < 7; i++) { const a = Math.PI * (0.15 + i * 0.12), c = mesh(new THREE.OctahedronGeometry(0.06), k.base); c.scale.y = 3; c.position.set(Math.cos(a) * 0.62, 0.15 + Math.sin(a) * 0.55, 0); c.rotation.z = a - Math.PI / 2; g.add(c); }
    if (d === 2) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 8, 36), glowMat(k.L.a, 0.9)); ring.position.set(0, 0.1, 0.12); g.add(ring); ticks.push(t => { ring.rotation.set(Math.sin(t) * 0.5, Math.cos(t * 0.8) * 0.5, t); }); }
    if (d === 3) for (let i = 0; i < 12; i++) { const a = i * TAU / 12, c = mesh(new THREE.ConeGeometry(0.03, i & 1 ? 0.18 : 0.3, 4), k.core, false); c.position.set(Math.cos(a) * 0.3, 0.12 + Math.sin(a) * 0.3, 0.1); c.rotation.z = a - Math.PI / 2; g.add(c); }
    ticks.push(legendBits(g, k, new V3(0, 0, 0.1), 0.6, 1.0));
  }
  return done(g, ticks);
}
function orb(g, k, rar, ticks) {
  const stand = rar <= 1 ? wood() : k.trim;
  const base = mesh(cyl(0.22, 0.3, 0.16, 14), stand); base.position.y = -0.48; g.add(base);
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3, c = mesh(new THREE.ConeGeometry(0.035, 0.32, 6), stand); c.position.set(Math.cos(a) * 0.24, -0.32, Math.sin(a) * 0.24); c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(c); }
  const col = rar === 0 ? '#d8e4e8' : rar === 1 ? '#a8e0a0' : null;
  const m = col ? new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.6, metalness: 0 })
    : rar >= 4 ? new THREE.MeshPhysicalMaterial({ color: k.d === 2 ? '#1a0e2a' : k.L.a, emissive: k.L.a, emissiveIntensity: k.d === 2 ? 0.6 : 1.1, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.92 })
    : new THREE.MeshPhysicalMaterial({ color: k.core.color, emissive: k.core.emissive, emissiveIntensity: 0.9, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.9 });
  const ball = mesh(sph(0.36, 24, 18), m); g.add(ball);
  if (rar >= 2) { const inner = sprite(TEX.soft, rar === 2 ? '#7ab8ff' : rar === 3 ? '#d08aff' : k.L.light, 0.8, 0.7); g.add(inner); ticks.push(t => { inner.material.opacity = 0.5 + Math.sin(t * 3) * 0.2; }); }
  if (rar >= 3) { const sh = [0, 1, 2].map(() => { const s = mesh(new THREE.OctahedronGeometry(0.05), k.core, false); s.scale.y = 2; g.add(s); return s; });
    ticks.push(t => sh.forEach((s, i) => { const a = t * 2 + i * TAU / 3; s.position.set(Math.cos(a) * 0.5, Math.sin(a * 2) * 0.1, Math.sin(a) * 0.5); })); }
  if (rar >= 4) { if (k.d === 2) ticks.push(orbitRing(g, k, 0, 0.5)); ticks.push(legendBits(g, k, new V3(0, 0.05, 0), 0.45, 0.9)); }
  return done(g, ticks);
}
function quiver(g, k, rar, ticks) {
  const body = rar <= 1 ? leather() : rar >= 4 ? k.base : std({ color: rar === 2 ? '#3a2a1a' : '#221830', roughness: 0.55 });
  g.add(mesh(cyl(0.22, 0.17, 1.0, 14), body));
  for (const y of [0.38, -0.3]) { const b = mesh(cyl(0.23, 0.23, 0.08, 14), rar === 0 ? std({ color: '#3a2414' }) : k.trim); b.position.y = y; g.add(b); }
  const fl = rar <= 1 ? std({ color: '#f2ece0', roughness: 0.8 }) : k.core;
  for (let i = 0; i < 5; i++) { const x = -0.12 + i * 0.06, z = (i & 1) * 0.07 - 0.03;
    const s = mesh(cyl(0.015, 0.015, 0.4, 5), std({ color: '#c8a070' })); s.position.set(x, 0.62, z); g.add(s);
    const f = mesh(box(0.1, 0.18, 0.015), fl, rar < 2); f.position.set(x, 0.76, z); g.add(f); }
  if (rar >= 2) { const gem = mesh(new THREE.OctahedronGeometry(0.07), k.core); gem.position.set(0, 0.05, 0.2); gem.scale.z = 0.5; g.add(gem); }
  if (rar === 3) for (let i = 0; i < 3; i++) { const c = mesh(new THREE.ConeGeometry(0.035, 0.16, 6), k.trim); c.position.set(0, -0.15 + i * 0.22, -0.2); c.rotation.x = -Math.PI / 2; g.add(c); }
  if (rar >= 4) ticks.push(legendBits(g, k, new V3(0, 0.6, 0), 0.3, 1.0));
  g.rotation.z = 0.35;
  return done(g, ticks);
}

// ---------------------------------------------------------------- boots
export function buildBoots(rar, tier = 0) {
  const g = new THREE.Group(), k = kit(0, rar, tier), ticks = [];
  const sh = new THREE.Shape(); sh.moveTo(-0.18, 0.45); sh.lineTo(0.12, 0.45); sh.lineTo(0.12, 0.0); sh.quadraticCurveTo(0.45, -0.02, 0.48, -0.18); sh.lineTo(0.48, -0.28); sh.lineTo(-0.22, -0.28); sh.lineTo(-0.2, 0.0); sh.lineTo(-0.18, 0.45);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 10 });
  const mat = rar <= 1 ? leather() : k.base;
  for (const s of [-1, 1]) {
    const bt = new THREE.Group();
    bt.add(mesh(geo, mat));
    const cuff = mesh(box(0.38, 0.1, 0.32), rar === 0 ? std({ color: '#3a2414' }) : k.trim); cuff.position.set(-0.03, 0.45, 0.1); bt.add(cuff);
    const sole = mesh(box(0.74, 0.06, 0.3), std({ color: '#2a1a10', roughness: 0.9 })); sole.position.set(0.13, -0.3, 0.1); bt.add(sole);
    if (rar >= 2) { const toe = mesh(box(0.2, 0.16, 0.3), k.trim); toe.position.set(0.38, -0.18, 0.1); bt.add(toe); const gem = mesh(new THREE.OctahedronGeometry(0.06), k.core); gem.position.set(-0.03, 0.3, 0.27); gem.scale.z = 0.5; bt.add(gem); }
    if (rar === 3) for (let j = 0; j < 2; j++) { const c = mesh(new THREE.ConeGeometry(0.035, 0.18, 6), k.trim); c.position.set(-0.22, 0.25 - j * 0.2, 0.1); c.rotation.z = Math.PI / 2; bt.add(c); }
    if (rar >= 4 && (k.d === 0 || k.d === 3)) { const w = mesh(extrude([[0, 0], [-0.15, 0.2], [-0.4, 0.3], [-0.25, 0.12], [-0.38, 0.1], [-0.15, 0.02]], 0.02), k.core); w.position.set(-0.18, 0.32, 0.3); bt.add(w); }
    bt.position.set(s * 0.12, 0, s * 0.22 - 0.1); bt.rotation.y = -0.9;
    g.add(bt);
  }
  if (rar >= 4) { if (k.d === 2) ticks.push(orbitRing(g, k, 0.1, 0.55)); ticks.push(legendBits(g, k, new V3(0, 0, 0), 0.5, 0.8)); }
  return done(g, ticks);
}

// ---------------------------------------------------------------- gloves
export function buildGloves(rar, tier = 0) {
  const g = new THREE.Group(), k = kit(0, rar, tier), ticks = [];
  const skin = rar === 0 ? std({ color: '#b8a888', roughness: 0.9 }) : rar === 1 ? leather() : k.base;
  const hand = new THREE.Group();
  hand.add(mesh(box(0.42, 0.42, 0.16), skin));
  for (let i = 0; i < 4; i++) { const f = mesh(cap(0.055, 0.22 - Math.abs(i - 1.5) * 0.04, 6), skin); f.position.set(-0.15 + i * 0.1, 0.34 - Math.abs(i - 1.5) * 0.02, 0); hand.add(f);
    if (rar === 3 || (rar >= 4 && k.d !== 3)) { const c = mesh(new THREE.ConeGeometry(0.04, 0.14, 6), rar === 3 ? k.trim : k.core); c.position.set(-0.15 + i * 0.1, 0.55 - Math.abs(i - 1.5) * 0.04, 0); hand.add(c); } }
  const th = mesh(cap(0.06, 0.18, 6), skin); th.position.set(0.26, 0.04, 0.03); th.rotation.z = -0.8; hand.add(th);
  const cuff = mesh(cyl(0.3, 0.23, 0.3, 14), rar === 0 ? skin : rar === 1 ? std({ color: '#3f6a32', roughness: 0.8 }) : k.trim); cuff.position.y = -0.34; cuff.scale.z = 0.55; hand.add(cuff);
  if (rar === 0) for (let i = 0; i < 3; i++) { const w = mesh(box(0.44, 0.03, 0.18), std({ color: '#8a7a5a', roughness: 1 })); w.position.set(0, -0.12 + i * 0.12, 0); w.rotation.z = 0.2; hand.add(w); }
  if (rar >= 2) { const kn = mesh(box(0.44, 0.08, 0.06), k.trim); kn.position.set(0, 0.16, 0.09); hand.add(kn);
    for (let i = 0; i < (rar >= 4 ? 4 : 1); i++) { const gem = mesh(new THREE.OctahedronGeometry(rar >= 4 ? 0.045 : 0.07), k.core); gem.position.set(rar >= 4 ? -0.15 + i * 0.1 : 0, rar >= 4 ? 0.16 : -0.02, rar >= 4 ? 0.13 : 0.1); gem.scale.z = 0.5; hand.add(gem); } }
  hand.rotation.z = 0.25;
  g.add(hand);
  if (rar >= 4) { if (k.d === 2) ticks.push(orbitRing(g, k, 0, 0.45)); ticks.push(legendBits(g, k, new V3(0, 0.1, 0), 0.42, 0.9)); }
  return done(g, ticks);
}

// ---------------------------------------------------------------- trinkets
export function buildTrinket(rar, tier = 0) {
  const g = new THREE.Group(), k = kit(0, rar, tier), ticks = [];
  const cord = mesh(new THREE.TorusGeometry(0.3, rar >= 2 ? 0.03 : 0.022, 8, 24, Math.PI * 1.3), rar <= 1 ? std({ color: '#6a4426', roughness: 0.9 }) : k.trim);
  cord.rotation.z = -Math.PI * 0.15 + Math.PI / 2 - Math.PI * 0.5; cord.position.y = 0.2; g.add(cord);
  if (rar === 0) { const c = mesh(cyl(0.15, 0.15, 0.06, 10), wood()); c.rotation.x = Math.PI / 2; c.position.y = -0.18; g.add(c); }
  else if (rar === 1) { const t = mesh(new THREE.ConeGeometry(0.07, 0.3, 8), std({ color: '#efe4cc', roughness: 0.5 })); t.position.y = -0.22; t.rotation.z = Math.PI; g.add(t); const b = mesh(sph(0.06, 8, 6), std({ color: '#5fa04a' })); b.position.y = -0.04; g.add(b); }
  else if (rar === 2) { const f = mesh(cyl(0.18, 0.18, 0.05, 20), k.trim); f.rotation.x = Math.PI / 2; f.position.y = -0.2; g.add(f); const gem = mesh(new THREE.OctahedronGeometry(0.12), k.core); gem.position.set(0, -0.2, 0.05); gem.scale.z = 0.5; g.add(gem); }
  else if (rar === 3) { const star = mesh(extrude(Array.from({ length: 10 }, (_, i) => { const a = i * Math.PI / 5 + Math.PI / 2, r = i & 1 ? 0.1 : 0.24; return [Math.cos(a) * r, Math.sin(a) * r]; }), 0.04), k.base); star.position.y = -0.22; g.add(star);
    const gem = mesh(new THREE.OctahedronGeometry(0.07), k.core); gem.position.set(0, -0.22, 0.05); g.add(gem); }
  else {
    const c = new V3(0, -0.25, 0), d = k.d;
    if (d === 0) { const f = mesh(extrude([[0, 0.25], [0.1, 0.1], [0.12, -0.1], [0.05, -0.25], [0, -0.32], [-0.05, -0.25], [-0.12, -0.1], [-0.1, 0.1]], 0.03), k.core); f.position.copy(c); g.add(f); }
    if (d === 1) for (let i = 0; i < 6; i++) { const a = i * TAU / 6, s = mesh(new THREE.OctahedronGeometry(0.05), k.base); s.scale.y = 3.5; s.position.set(c.x + Math.cos(a) * 0.1, c.y + Math.sin(a) * 0.1, 0); s.rotation.z = a - Math.PI / 2; g.add(s); }
    if (d === 2) { const o = mesh(sph(0.14, 16, 12), k.base); o.position.copy(c); g.add(o); const e = mesh(sph(0.06, 10, 8), k.core); e.position.set(c.x, c.y, 0.12); g.add(e); ticks.push(orbitRing(g, k, c.y, 0.24)); }
    if (d === 3) { const s = mesh(cyl(0.14, 0.14, 0.05, 20), k.trim); s.rotation.x = Math.PI / 2; s.position.copy(c); g.add(s);
      for (let i = 0; i < 10; i++) { const a = i * TAU / 10, r = mesh(new THREE.ConeGeometry(0.03, 0.14, 4), k.core, false); r.position.set(Math.cos(a) * 0.2, c.y + Math.sin(a) * 0.2, 0); r.rotation.z = a - Math.PI / 2; g.add(r); } }
    const gem = mesh(new THREE.OctahedronGeometry(0.07), k.core); gem.position.set(c.x, c.y, 0.07); g.add(gem);
    ticks.push(legendBits(g, k, c, 0.32, 0.7));
  }
  return done(g, ticks);
}

// ---------------------------------------------------------------- on the hero (rare and better)
// hands: cuffs and knuckle gems; feet: cuffs and toe caps; chest: the trinket's pendant
export function heroHands(rar, tier) {
  if (rar < 2) return null;
  const k = kit(0, rar, tier), out = [], ticks = [];
  for (let s = 0; s < 2; s++) {
    const g = new THREE.Group();
    const cuff = mesh(new THREE.TorusGeometry(0.115, 0.03, 8, 18), k.trim); cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.44; g.add(cuff);
    const gem = mesh(new THREE.OctahedronGeometry(0.045), k.core); gem.position.set(0, -0.58, 0.1); g.add(gem);
    if (rar === 3) for (let i = 0; i < 2; i++) { const c = mesh(new THREE.ConeGeometry(0.025, 0.12, 5), k.trim); c.position.set(-0.04 + i * 0.08, -0.62, 0.08); c.rotation.x = Math.PI * 0.7; g.add(c); }
    if (rar >= 4) ticks.push(legendBits(g, k, new V3(0, -0.58, 0.05), 0.14, 0.4, 3, 1.2));
    out.push(g);
  }
  out.tick = t => ticks.forEach(f => f(t));
  return out;
}
export function heroFeet(rar, tier) {
  if (rar < 2) return null;
  const k = kit(0, rar, tier), out = [], ticks = [];
  for (let s = 0; s < 2; s++) {
    const g = new THREE.Group();
    const cuff = mesh(cyl(0.16, 0.16, 0.07, 14), k.trim); cuff.position.y = -0.56; g.add(cuff);
    const toe = mesh(box(0.25, 0.1, 0.12), k.base); toe.position.set(0, -0.66, 0.22); g.add(toe);
    const gem = mesh(new THREE.OctahedronGeometry(0.04), k.core); gem.position.set(0, -0.55, 0.16); g.add(gem);
    if (rar >= 4) ticks.push(legendBits(g, k, new V3(0, -0.72, 0.05), 0.16, 0.5, 3, 1.4));
    out.push(g);
  }
  out.tick = t => ticks.forEach(f => f(t));
  return out;
}
export function heroPendant(rar, tier) {
  if (rar < 2) return null;
  const p = buildTrinket(rar, tier);
  p.scale.setScalar(0.42); p.position.set(0, 1.42, 0.33);
  return p;
}
