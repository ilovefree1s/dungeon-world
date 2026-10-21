// ============================================================================
//  DUNGEON HEART  -  armor and helmets by rarity, like the weapons: plain for
//  common and uncommon, polished with blue for rare, dark and runed with
//  purple for epic, and four legendary looks (flame, frost, void, sun) with
//  moving parts. Also the pieces the hero wears to show off rare and better.
// ============================================================================
import { THREE, std, mesh, sph, TEX, TAU, V3 } from './engine.js';
import { LEG, glowMat, sprite, extrude } from './weapons.js';

const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const cyl = (a, b, h, s = 12) => new THREE.CylinderGeometry(a, b, h, s);
const half = r => new THREE.SphereGeometry(r, 16, 10, 0, TAU, 0, Math.PI / 2);
// (profiles are written top to bottom; a lathe faces out when built bottom to top)
const lathe = pts => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)).reverse(), 24);

// the materials for a rarity: the main surface, the trim, a glowing core
export function kit(cls, rar, tier) {
  const d = tier & 3, L = LEG[d];
  const k = { d, L, rar };
  const plate = [['#7d838a', 0.7, 0.6], ['#a9b1ba', 0.85, 0.4], ['#e6edf5', 1, 0.14], ['#2e2a40', 1, 0.22]];
  const cloth = ['#7a6a58', '#4a5a7a', '#1e3a8a', '#3a1858'];
  const hide = ['#6a4426', '#5a4a2a', '#3a2a1a', '#221830'];
  if (rar < 4) {
    if (cls === 0) { const [c, m, r] = plate[rar]; k.base = std({ color: c, metalness: m, roughness: r, envMapIntensity: rar >= 2 ? 1.3 : 0.7 }); }
    else k.base = std({ color: (cls === 1 ? cloth : hide)[rar], roughness: cls === 1 ? 0.75 : 0.6 });
  } else {
    k.base = d === 1 ? new THREE.MeshPhysicalMaterial({ color: '#9fd8f0', emissive: '#2a90d0', emissiveIntensity: 0.25, roughness: 0.12, clearcoat: 1, metalness: 0 })
      : d === 2 ? std({ color: '#141020', metalness: cls === 1 ? 0.2 : 0.9, roughness: 0.2 })
      : d === 0 ? std({ color: cls === 1 ? '#8a1a0a' : '#3a1a10', metalness: cls === 1 ? 0 : 0.8, roughness: 0.3, emissive: '#5a1000', emissiveIntensity: 0.6 })
      : std({ color: cls === 1 ? '#f4ecd8' : '#ffd860', metalness: cls === 1 ? 0.1 : 1, roughness: 0.15, emissive: '#a06000', emissiveIntensity: 0.3, envMapIntensity: 1.5 });
  }
  k.trim = rar === 0 ? std({ color: '#5a3a22', roughness: 0.8 }) : rar === 1 ? std({ color: '#3f6a32', roughness: 0.8 })
    : rar === 2 ? std({ color: '#d0dae8', metalness: 1, roughness: 0.2 }) : rar === 3 ? std({ color: '#3a2a50', metalness: 1, roughness: 0.25 })
    : std({ color: d === 2 ? '#2a2038' : '#ffcf5a', metalness: 1, roughness: 0.18, envMapIntensity: 1.5 });
  k.core = rar === 2 ? std({ color: '#4aa0ff', emissive: '#2a7aff', emissiveIntensity: 1.8, roughness: 0.2 })
    : rar === 3 ? std({ color: '#c070ff', emissive: '#a040ff', emissiveIntensity: 2.2, roughness: 0.2 })
    : std({ color: L.b, emissive: L.a, emissiveIntensity: 2.6, roughness: 0.15 });
  return k;
}
// the legendary motion: embers rise, ice circles, void sparks spin, sun sparkles drift up
export function legendBits(g, k, center, radius, height, n = 6, haloK = 3.2) {
  const { d, L } = k, bits = [];
  for (let i = 0; i < n; i++) {
    const b = d === 1 ? mesh(new THREE.OctahedronGeometry(0.05), k.base, false) : sprite(d === 0 ? TEX.flame : TEX.spark, i & 1 ? L.b : L.a, d === 0 ? 0.32 : 0.24);
    if (d === 1) b.scale.y = 2.2;
    g.add(b); bits.push(b);
  }
  const halo = sprite(TEX.soft, L.light, radius * haloK, 0.32); halo.position.copy(center); g.add(halo);
  return t => {
    halo.material.opacity = (0.26 + Math.sin(t * 3) * 0.1) * (haloK < 3 ? 0.5 : 1);
    k.core.emissiveIntensity = 2.2 + Math.sin(t * 4) * 0.8;
    bits.forEach((b, i) => {
      const a = t * 1.6 + i * TAU / n, q = (t * 0.45 + i / n) % 1;
      if (d === 1) { b.position.set(center.x + Math.cos(a) * radius, center.y + Math.sin(a * 2) * 0.1, center.z + Math.sin(a) * radius); b.rotation.y = a; }
      else if (d === 2) { b.position.set(center.x + Math.cos(-a) * radius, center.y + Math.sin(a) * 0.15, center.z + Math.sin(-a) * radius); b.material.opacity = 0.6 + Math.sin(t * 7 + i) * 0.4; }
      else { b.position.set(center.x + Math.cos(a) * radius * 0.8, center.y - height * 0.3 + q * height, center.z + Math.sin(a) * radius * 0.5); b.material.opacity = Math.sin(q * Math.PI); }
    });
  };
}
export function orbitRing(g, k, y, r, tilt = 0) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 8, 48), glowMat(k.L.a, 0.85)); ring.position.y = y; g.add(ring);
  return t => ring.rotation.set(Math.PI / 2 + Math.sin(t * 0.9) * 0.35 + tilt, t * 1.2, 0);
}

// ---------------------------------------------------------------- armor (the item)
export function buildArmor(cls, rar, tier = 0) {
  const g = new THREE.Group(), k = kit(cls, rar, tier), ticks = [];
  // the body: a breastplate, a robe or a vest
  if (cls === 0) {
    const t = mesh(lathe([[0.001, 0.5], [0.2, 0.48], [0.4, 0.42], [0.47, 0.2], [0.44, -0.05], [0.38, -0.28], [0.41, -0.42], [0.001, -0.42]]), k.base); t.scale.z = 0.62; g.add(t);
  } else if (cls === 1) {
    const t = mesh(lathe([[0.001, 0.5], [0.18, 0.48], [0.36, 0.38], [0.34, 0.0], [0.42, -0.4], [0.56, -0.85], [0.001, -0.85]]), k.base); t.scale.z = 0.7; g.add(t);
    const mantle = mesh(new THREE.ConeGeometry(0.52, 0.32, 20, 1, true), k.base); mantle.position.y = 0.38; mantle.scale.z = 0.75; g.add(mantle);
  } else {
    const t = mesh(lathe([[0.001, 0.5], [0.2, 0.47], [0.38, 0.4], [0.42, 0.15], [0.4, -0.2], [0.42, -0.45], [0.001, -0.45]]), k.base); t.scale.z = 0.62; g.add(t);
    const fur = mesh(new THREE.TorusGeometry(0.22, 0.08, 8, 18), std({ color: rar >= 3 ? '#2a2430' : '#8a7a62', roughness: 1 })); fur.rotation.x = Math.PI / 2; fur.position.y = 0.48; fur.scale.y = 0.8; g.add(fur);
    const strap = mesh(box(0.08, 1.0, 0.04), k.trim); strap.position.set(0, 0.02, 0.27); strap.rotation.z = 0.6; g.add(strap);
  }
  const by = cls === 1 ? 0.0 : -0.33, br = cls === 1 ? 0.36 : 0.41;
  const belt = mesh(new THREE.CylinderGeometry(br, br, 0.1, 22, 1, true), rar === 1 ? k.trim : std({ color: '#3a2618', roughness: 0.8 })); belt.position.y = by; belt.scale.z = cls === 1 ? 0.72 : 0.66; g.add(belt);
  // shoulders
  const shoulders = [];
  for (const s of [-1, 1]) {
    const p = mesh(half(cls === 1 ? 0.21 : 0.25), cls === 1 && rar < 2 ? k.base : (rar >= 2 ? k.base : k.trim)); p.position.set(0.38 * s, 0.3, 0); p.rotation.z = -0.75 * s; p.scale.set(1, 0.75, 0.95); g.add(p); shoulders.push(p);
  }
  if (rar >= 2) { // trims and a gem
    for (const [y, r] of [[0.5, 0.2], [by, br + 0.01]]) { const ring = mesh(new THREE.TorusGeometry(r, 0.03, 8, 28), k.trim); ring.rotation.x = Math.PI / 2; ring.position.y = y; ring.scale.y = 0.66; g.add(ring); }
    shoulders.forEach((p, i) => { const rim = mesh(new THREE.TorusGeometry(0.23, 0.025, 6, 20), k.trim); rim.position.copy(p.position); rim.rotation.set(Math.PI / 2, (i ? -1 : 1) * 0.75, 0); g.add(rim); });
    const gem = mesh(new THREE.OctahedronGeometry(rar >= 4 ? 0.13 : 0.09), k.core); gem.position.set(0, 0.16, cls === 1 ? 0.27 : 0.3); gem.scale.z = 0.5; g.add(gem);
  }
  if (rar === 3) { // runes in a V and spiked shoulders
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const r = mesh(box(0.04, 0.09, 0.01), k.core, false); r.position.set(s * (0.08 + i * 0.07), 0.05 - i * 0.08, 0.29 - i * 0.01); r.rotation.z = s * 0.6; g.add(r); }
    shoulders.forEach((p, i) => { for (let j = 0; j < 2; j++) { const c = mesh(new THREE.ConeGeometry(0.04, 0.22, 6), k.trim); c.position.set(p.position.x * 1.15, 0.5, -0.05 + j * 0.1); c.rotation.z = (i ? -1 : 1) * 0.4; g.add(c); } });
    const sp = sprite(TEX.spark, '#d08aff', 0.22); g.add(sp);
    ticks.push(t => { const a = t * 2; sp.position.set(Math.cos(a) * 0.5, 0.1 + Math.sin(t * 3) * 0.3, Math.sin(a) * 0.35); sp.material.opacity = 0.5 + Math.sin(t * 6) * 0.4; });
  }
  if (rar >= 4) legendArmor(g, k, shoulders, ticks, new V3(0, 0.1, 0), 0.62);
  g.userData.tick = t => ticks.forEach(f => f(t));
  return g;
}
// the legendary touches, for the item and the hero alike
function legendArmor(g, k, shoulders, ticks, center, radius, haloK) {
  const { d } = k;
  if (d === 0) shoulders.forEach((p, i) => { const h = mesh(new THREE.ConeGeometry(0.05, 0.32, 6), k.core); h.position.set(p.position.x * 1.05, p.position.y + 0.18, p.position.z); h.rotation.z = (i ? -1 : 1) * 0.5; g.add(h); });
  if (d === 1) shoulders.forEach((p, i) => { for (let j = 0; j < 3; j++) { const c = mesh(new THREE.OctahedronGeometry(0.06), k.base); c.scale.y = 3; c.position.set(p.position.x * (1 + j * 0.08), p.position.y + 0.15, p.position.z - 0.1 + j * 0.1); c.rotation.z = (i ? -1 : 1) * (0.3 + j * 0.25); g.add(c); } });
  if (d === 2) ticks.push(orbitRing(g, k, center.y, radius, 0.2));
  if (d === 3) { const halo = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.75, 0.02, 8, 40), glowMat(k.L.b, 0.8)); halo.position.set(center.x, center.y + radius * 0.6, center.z - 0.35); g.add(halo);
    for (let i = 0; i < 10; i++) { const a = i * TAU / 10, r = mesh(new THREE.ConeGeometry(0.03, 0.2, 4), k.core, false); r.position.set(center.x + Math.cos(a) * radius * 0.92, center.y + radius * 0.6 + Math.sin(a) * radius * 0.92, center.z - 0.35); r.rotation.z = a - Math.PI / 2; g.add(r); }
    ticks.push(t => { halo.rotation.z = t * 0.5; }); }
  ticks.push(legendBits(g, k, center, radius, 1.2, 6, haloK));
}

// ---------------------------------------------------------------- helmets (the item)
export function buildHelmet(rar, tier = 0) {
  const g = new THREE.Group(), k = kit(0, rar, tier), ticks = [];
  if (rar === 0) {
    const leather = std({ color: '#6a4426', roughness: 0.75 });
    g.add(mesh(new THREE.SphereGeometry(0.44, 18, 12, 0, TAU, 0, Math.PI / 1.9), leather));
    const band = mesh(new THREE.TorusGeometry(0.43, 0.04, 8, 24), std({ color: '#4a2e1a', roughness: 0.8 })); band.rotation.x = Math.PI / 2; band.position.y = 0.0; g.add(band);
    g.userData.tick = () => { }; return g;
  }
  const dome = mesh(new THREE.SphereGeometry(0.45, 20, 12, 0, TAU, 0, Math.PI / 1.85), k.base); g.add(dome);
  const rim = mesh(new THREE.TorusGeometry(0.44, 0.04, 8, 28), k.trim); rim.rotation.x = Math.PI / 2; rim.position.y = -0.04; g.add(rim);
  if (rar === 1) { const f = mesh(extrude([[0, 0], [0.06, 0.2], [0.02, 0.45], [-0.04, 0.2]], 0.01), std({ color: '#5fa04a', roughness: 0.8 })); f.position.set(0.3, 0.25, -0.1); f.rotation.z = -0.5; g.add(f); }
  if (rar >= 2) {
    const nose = mesh(box(0.08, 0.2, 0.06), k.trim); nose.position.set(0, -0.06, 0.44); g.add(nose);
    const gem = mesh(new THREE.OctahedronGeometry(0.07), k.core); gem.position.set(0, 0.16, 0.42); gem.scale.z = 0.5; g.add(gem);
  }
  if (rar === 2) for (let i = 0; i < 6; i++) { const p = mesh(sph(0.07, 8, 6), k.core); p.position.set(0, 0.46 + Math.sin(i / 5 * Math.PI) * 0.08, 0.2 - i * 0.1); p.scale.set(0.6, 1.2, 1); g.add(p); }
  if (rar >= 3) { // horns and a glowing visor slit
    for (const s of [-1, 1]) {
      const c = new THREE.CatmullRomCurve3([new V3(0.36 * s, 0.15, 0), new V3(0.58 * s, 0.32, 0), new V3(0.62 * s, 0.6, -0.05), new V3(0.52 * s, 0.82, -0.12)]);
      g.add(mesh(new THREE.TubeGeometry(c, 12, 0.05, 6), rar >= 4 && k.d !== 2 ? k.trim : std({ color: '#d8ccb4', roughness: 0.5 })));
      const tip = mesh(new THREE.ConeGeometry(0.05, 0.14, 6), k.core); tip.position.set(0.52 * s, 0.86, -0.12); g.add(tip);
    }
    const slit = mesh(box(0.42, 0.05, 0.04), k.core, false); slit.position.set(0, 0.04, 0.43); g.add(slit);
  }
  if (rar >= 4) legendHelm(g, k, 0.42, 0.5, ticks);
  g.userData.tick = t => ticks.forEach(f => f(t));
  return g;
}
function legendHelm(g, k, top, r, ticks, haloK = 3.2) {
  const { d } = k;
  if (d === 1) for (let i = 0; i < 8; i++) { const a = i * TAU / 8, c = mesh(new THREE.ConeGeometry(0.05, 0.32 + (i & 1) * 0.14, 6), k.base); c.position.set(Math.cos(a) * r * 0.85, top - 0.05, Math.sin(a) * r * 0.85); c.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); g.add(c); }
  if (d === 2) ticks.push(orbitRing(g, k, top + 0.35, r * 0.7, -0.5));
  if (d === 3) { for (const s of [-1, 1]) { const w = mesh(extrude([[0, 0], [0.25 * s, 0.12], [0.45 * s, 0.4], [0.3 * s, 0.25], [0.32 * s, 0.38], [0.15 * s, 0.15]], 0.03), k.trim); w.position.set(0.38 * s, top - 0.3, 0); g.add(w); }
    for (let i = 0; i < 9; i++) { const a = Math.PI * (0.1 + i * 0.1), c = mesh(new THREE.ConeGeometry(0.03, 0.22, 4), k.core, false); c.position.set(Math.cos(a) * r * 0.75, top + 0.05 + Math.sin(a) * r * 0.55, -0.15); c.rotation.z = a - Math.PI / 2; g.add(c); } }
  ticks.push(legendBits(g, k, new V3(0, top + 0.2, 0), r * 0.75, 0.8, 5, haloK));
}

// ---------------------------------------------------------------- what the hero wears (rare and better)
// on the body: shoulder guards, a gem, the legendary touches
export function heroArmor(cls, rar, tier) {
  if (rar < 2) return null;
  const g = new THREE.Group(), k = kit(cls, rar, tier), ticks = [];
  const sh = [];
  for (const s of [-1, 1]) {
    const p = mesh(half(0.17), k.base); p.position.set(0.47 * s, 1.33, 0); p.rotation.z = -0.5 * s; p.scale.set(1, 0.7, 1); g.add(p); sh.push(p);
    const rim = mesh(new THREE.TorusGeometry(0.165, 0.02, 6, 20), k.trim); rim.position.set(0.47 * s, 1.33, 0); rim.rotation.set(Math.PI / 2, -0.5 * s, 0); g.add(rim);
    if (rar === 3) for (let j = 0; j < 2; j++) { const c = mesh(new THREE.ConeGeometry(0.04, 0.22, 6), k.trim); c.position.set(0.52 * s, 1.45, -0.06 + j * 0.12); c.rotation.z = -0.6 * s; g.add(c); }
  }
  const gem = mesh(new THREE.OctahedronGeometry(rar >= 4 ? 0.08 : 0.06), k.core); gem.position.set(0, 1.18, 0.35); gem.scale.z = 0.5; g.add(gem);
  if (rar >= 4) legendArmor(g, k, sh, ticks, new V3(0, 1.05, 0), 0.6, 1.6);
  g.userData.tick = t => ticks.forEach(f => f(t));
  return g;
}
// on the head: a circlet and gem, horns for epic, a crown or halo for legendary
export function heroHelm(cls, rar, tier) {
  if (rar < 2) return null;
  const g = new THREE.Group(), k = kit(0, rar, tier), ticks = [];
  const y = cls === 1 ? 0.24 : 0.04, r = cls === 1 ? 0.33 : 0.31;
  const ring = mesh(new THREE.TorusGeometry(r, 0.03, 8, 28), k.trim); ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring);
  const gem = mesh(new THREE.OctahedronGeometry(0.06), k.core); gem.position.set(0, y + 0.03, r + 0.01); gem.scale.z = 0.5; g.add(gem);
  if (rar === 3 || (rar >= 4 && k.d === 0)) for (const s of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3([new V3(r * s, y + 0.02, 0), new V3((r + 0.15) * s, y + 0.15, 0), new V3((r + 0.17) * s, y + 0.38, -0.04), new V3((r + 0.08) * s, y + 0.52, -0.1)]);
    g.add(mesh(new THREE.TubeGeometry(c, 10, 0.04, 6), rar >= 4 ? k.core : std({ color: '#d8ccb4', roughness: 0.5 })));
  }
  if (rar >= 4) legendHelm(g, k, (cls === 1 ? 1.0 : 0.32), r + 0.05, ticks, 1.8);
  g.userData.tick = t => ticks.forEach(f => f(t));
  return g;
}
