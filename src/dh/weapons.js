// ============================================================================
//  DUNGEON HEART  -  weapons: every sword, staff and bow, by rarity.
//  Common and uncommon are plain iron and wood. Rare is polished with a blue
//  glow, epic is dark and runed with purple light, and each legendary is its
//  own thing (flame, frost, void or sun) with moving parts.
//  Built standing up: the grip at y = 0, the business end up (+y). A bow's
//  belly faces +z and its string runs at z = -0.1 (point 1 is the nock).
// ============================================================================
import { THREE, std, mesh, sph, TEX, TAU, V3 } from './engine.js';

const RAR_GLOW = ['#000000', '#000000', '#3a8cff', '#b15cff', '#ffa53a'];
// legendary looks: 0 flame, 1 frost, 2 void, 3 sun
export const LEG = [
  { a: '#ff5a1a', b: '#ffd23a', metal: '#3a1a10', light: '#ff7a2a' },
  { a: '#5ad8ff', b: '#e8fbff', metal: '#a8d8f0', light: '#7ad8ff' },
  { a: '#a040ff', b: '#ff5ae0', metal: '#141020', light: '#b060ff' },
  { a: '#ffc23a', b: '#fff6c8', metal: '#f0e0b0', light: '#ffd27a' },
];
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const cyl = (a, b, h, s = 12) => new THREE.CylinderGeometry(a, b, h, s);
export const glowMat = (c, o = 0.85) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
export function sprite(map, color, size, o = 0.9) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size); return s;
}
// a flat blade from its outline (x across, y along), beveled
export function extrude(pts, depth, bevel = 0.012) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -depth / 2);
  return g;
}
const mirror = half => [...half, ...half.slice().reverse().map(([x, y]) => [-x, y])];

export function buildWeapon(cls, rar, tier = 0) {
  const g = new THREE.Group();
  g.userData = { ticks: [], glowK: [0.35, 0.5, 1, 1.25, 1.6][rar] || 1 };
  if (cls === 0) sword(g, rar, tier); else if (cls === 1) staff(g, rar, tier); else bow(g, rar, tier);
  g.userData.tick = t => { for (const f of g.userData.ticks) f(t); };
  return g;
}

// ---------------------------------------------------------------- swords
function sword(g, rar, tier) {
  const u = g.userData;
  const wood = std({ color: '#6a4426', roughness: 0.8 }), iron = std({ color: '#7d838a', metalness: 0.7, roughness: 0.6 });
  if (rar <= 1) {
    // plain: a straight iron blade, a bar guard, a wooden grip
    const steel = rar ? std({ color: '#b4bcc6', metalness: 0.9, roughness: 0.35 }) : std({ color: '#8f959c', metalness: 0.75, roughness: 0.55 });
    g.add(mesh(cyl(0.045, 0.05, 0.3, 8), rar ? std({ color: '#3f5a32', roughness: 0.8 }) : wood));
    const pm = mesh(sph(0.065, 8, 6), iron); pm.position.y = -0.18; g.add(pm);
    const gd = mesh(box(0.36, 0.06, 0.08), iron); gd.position.y = 0.17; g.add(gd);
    const bl = mesh(extrude(mirror([[0.055, 0.2], [0.055, 1.18], [0, 1.36]]), 0.025), steel); g.add(bl);
    u.bladeMat = steel;
    return;
  }
  if (rar === 2) {
    // rare: polished, a curved silver guard, a blue fuller and a sapphire
    const steel = std({ color: '#e6edf5', metalness: 1, roughness: 0.14, envMapIntensity: 1.3 });
    const silver = std({ color: '#c8d4e8', metalness: 1, roughness: 0.2 });
    const blue = std({ color: '#4aa0ff', emissive: '#2a7aff', emissiveIntensity: 1.6, roughness: 0.2 });
    g.add(mesh(cyl(0.045, 0.05, 0.32, 10), std({ color: '#1e2c5a', roughness: 0.6 })));
    const pm = mesh(new THREE.OctahedronGeometry(0.08), blue); pm.position.y = -0.2; g.add(pm);
    for (const s of [-1, 1]) { const arm = mesh(cyl(0.025, 0.04, 0.26, 8), silver); arm.position.set(0.13 * s, 0.2, 0); arm.rotation.z = s * 1.15; g.add(arm); const tip = mesh(sph(0.04, 8, 6), blue); tip.position.set(0.25 * s, 0.26, 0); g.add(tip); }
    const gm = mesh(sph(0.06, 10, 8), blue); gm.position.set(0, 0.19, 0.035); g.add(gm);
    g.add(mesh(extrude(mirror([[0.035, 0.18], [0.075, 0.24], [0.07, 1.2], [0, 1.45]]), 0.03), steel));
    for (const z of [-0.026, 0.026]) { const f = mesh(box(0.022, 0.9, 0.006), blue, false); f.position.set(0, 0.72, z); g.add(f); }
    u.bladeMat = steel;
    return;
  }
  if (rar === 3) {
    // epic: a dark, serrated blade with purple edges and runes, a winged guard
    const dark = std({ color: '#2e2a40', metalness: 1, roughness: 0.22, envMapIntensity: 1.2 });
    const purple = std({ color: '#c070ff', emissive: '#a040ff', emissiveIntensity: 2.2, roughness: 0.2 });
    const half = [[0.04, 0.18], [0.1, 0.26]];
    for (let i = 0; i < 6; i++) half.push([0.1 - i * 0.004, 0.36 + i * 0.16], [0.075 - i * 0.004, 0.42 + i * 0.16]);
    half.push([0.07, 1.34], [0, 1.62]);
    const shape = mirror(half);
    g.add(mesh(extrude(shape, 0.035), dark));
    const edge = new THREE.Mesh(extrude(shape.map(([x, y]) => [x * 1.22, y * 1.02 - 0.01]), 0.012, 0.004), glowMat('#c070ff', 0.9)); g.add(edge);
    for (let i = 0; i < 5; i++) for (const z of [-0.03, 0.03]) { const r = mesh(box(0.035, 0.07, 0.006), purple, false); r.position.set(0, 0.42 + i * 0.2, z); r.rotation.z = (i & 1) ? 0.5 : -0.5; g.add(r); }
    for (const s of [-1, 1]) { const w = mesh(extrude([[0, 0], [0.34 * s, 0.14], [0.28 * s, 0.03], [0.4 * s, -0.05], [0.12 * s, -0.04]], 0.04), dark); w.position.y = 0.17; g.add(w); }
    const gm = mesh(new THREE.OctahedronGeometry(0.075), purple); gm.position.set(0, 0.18, 0.04); g.add(gm);
    g.add(mesh(cyl(0.045, 0.05, 0.32, 10), std({ color: '#2a1a3a', roughness: 0.6 })));
    const pm = mesh(new THREE.OctahedronGeometry(0.08), purple); pm.position.y = -0.21; g.add(pm);
    const sp = [sprite(TEX.spark, '#d08aff', 0.25), sprite(TEX.spark, '#ff8af0', 0.18)];
    sp.forEach(s => g.add(s));
    u.ticks.push(t => sp.forEach((s, i) => { const a = t * 2.2 + i * Math.PI; s.position.set(Math.cos(a) * 0.18, 0.5 + ((t * 0.5 + i * 0.5) % 1) * 1.0, Math.sin(a) * 0.18); s.material.opacity = 0.5 + Math.sin(t * 6 + i) * 0.4; }));
    u.bladeMat = dark;
    return;
  }
  // legendary
  const L = LEG[tier & 3], d = tier & 3;
  const core = std({ color: L.b, emissive: L.a, emissiveIntensity: 2.6, roughness: 0.15 });
  const metal = std({ color: L.metal, metalness: 1, roughness: 0.2, envMapIntensity: 1.4 });
  const gold = std({ color: '#ffcf5a', metalness: 1, roughness: 0.18, envMapIntensity: 1.5 });
  let shape;
  if (d === 0) { // flame: a wavy blade of embers
    const half = [[0.05, 0.2], [0.13, 0.28]];
    for (let i = 0; i < 7; i++) half.push([0.12 + Math.sin(i * 1.6) * 0.04, 0.42 + i * 0.2]);
    half.push([0.05, 1.86], [0, 2.0]);
    shape = mirror(half).map(([x, y]) => [x + Math.sin(y * 4) * 0.03, y]);
  } else if (d === 1) { // frost: a long crystal shard
    shape = mirror([[0.05, 0.2], [0.15, 0.4], [0.11, 1.0], [0.14, 1.3], [0.06, 1.75], [0, 2.05]]);
  } else if (d === 2) { // void: a broad black cleaver
    shape = mirror([[0.05, 0.18], [0.16, 0.26], [0.17, 1.5], [0.08, 1.7], [0.13, 1.82], [0, 2.0]]);
  } else { // sun: a broad holy blade
    shape = mirror([[0.05, 0.2], [0.16, 0.3], [0.12, 0.5], [0.12, 1.55], [0.17, 1.65], [0, 2.0]]);
  }
  shape = shape.map(([x, y]) => [x * 1.3, y]);
  const bladeM = d === 1 ? new THREE.MeshPhysicalMaterial({ color: '#bff0ff', emissive: '#3ab8ff', emissiveIntensity: 1.2, roughness: 0.05, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.88 })
    : d === 2 ? std({ color: '#0e0b16', metalness: 1, roughness: 0.15, envMapIntensity: 1.5 })
    : d === 0 ? std({ color: '#5a1a08', emissive: '#ff4a10', emissiveIntensity: 1.3, metalness: 0.6, roughness: 0.3 })
    : std({ color: '#ffd860', metalness: 1, roughness: 0.12, emissive: '#ff9a10', emissiveIntensity: 0.8, envMapIntensity: 1.6 });
  g.add(mesh(extrude(shape, 0.04), bladeM));
  const edge = new THREE.Mesh(extrude(shape.map(([x, y]) => [x * 1.25, y * 1.015 - 0.01]), 0.014, 0.004), glowMat(L.a, 1)); g.add(edge);
  // the core line down the blade
  for (const z of [-0.035, 0.035]) { const c = mesh(box(0.035, 1.45, 0.006), core, false); c.position.set(0, 0.95, z); g.add(c); }
  // a soft aura the shape of the blade
  const aura = new THREE.Mesh(extrude(shape.map(([x, y]) => [x * 2.1, y * 1.05 - 0.05]), 0.004, 0.002), glowMat(L.a, 0.22)); g.add(aura);
  // the guard: each legendary its own
  const gm2 = d === 2 ? metal : gold;
  if (d === 0) { // dragon wings swept up along the blade
    for (const s of [-1, 1]) {
      const w = mesh(extrude([[0.04 * s, -0.02], [0.3 * s, 0.06], [0.52 * s, 0.32], [0.44 * s, 0.24], [0.4 * s, 0.42], [0.3 * s, 0.2], [0.22 * s, 0.34], [0.16 * s, 0.14], [0.04 * s, 0.1]], 0.05), gm2); w.position.y = 0.14; g.add(w);
      const horn = mesh(new THREE.ConeGeometry(0.035, 0.3, 6), core); horn.position.set(0.5 * s, 0.6, 0); horn.rotation.z = -0.4 * s; g.add(horn);
    }
  } else if (d === 1) { // ice crystals bursting out of the guard
    for (let i = 0; i < 6; i++) { const s = i < 3 ? -1 : 1, k = i % 3; const c = mesh(new THREE.OctahedronGeometry(0.07), bladeM); c.scale.set(0.8, 3 - k * 0.6, 0.8); c.position.set(s * (0.14 + k * 0.1), 0.2 + k * 0.05, 0); c.rotation.z = s * (1.1 - k * 0.3); g.add(c); }
    const bar = mesh(box(0.44, 0.08, 0.1), metal); bar.position.y = 0.16; g.add(bar);
  } else if (d === 2) { // black thorns with glowing tips
    for (let i = 0; i < 6; i++) { const s = i < 3 ? -1 : 1, k = i % 3; const c = mesh(new THREE.ConeGeometry(0.04, 0.42 - k * 0.08, 6), metal); c.position.set(s * (0.16 + k * 0.08), 0.12 + k * 0.1, 0); c.rotation.z = -s * (1.9 - k * 0.45); g.add(c); const tp = mesh(sph(0.03, 8, 6), core); tp.position.set(s * (0.34 + k * 0.08), 0.06 + k * 0.17 + k * 0.05, 0); g.add(tp); }
    const bar = mesh(box(0.34, 0.09, 0.1), metal); bar.position.y = 0.16; g.add(bar);
  } else { // a sunburst behind the guard
    const disc = mesh(cyl(0.2, 0.2, 0.05, 24), gold); disc.rotation.x = Math.PI / 2; disc.position.y = 0.2; g.add(disc);
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; const r = mesh(new THREE.ConeGeometry(0.035, i & 1 ? 0.22 : 0.36, 4), i & 1 ? core : gold); r.position.set(Math.cos(a) * 0.3, 0.2 + Math.sin(a) * 0.3, -0.02); r.rotation.z = a - Math.PI / 2; g.add(r); }
  }
  const gem = mesh(new THREE.OctahedronGeometry(0.11), core); gem.position.set(0, 0.18, 0.05); gem.scale.z = 0.6; g.add(gem);
  g.add(mesh(cyl(0.05, 0.055, 0.36, 10), std({ color: d === 2 ? '#1a1024' : '#3a1e10', roughness: 0.5 })));
  const pm = mesh(new THREE.OctahedronGeometry(0.1), core); pm.position.y = -0.24; g.add(pm);
  const halo = sprite(TEX.soft, L.light, 1.2, 0.35); halo.position.y = 1.0; halo.scale.set(0.9, 2.4, 1); g.add(halo);
  // what moves: embers rise / ice shards circle / void rings turn / sun rays pulse
  const bits = [];
  for (let i = 0; i < 5; i++) {
    let b;
    if (d === 0) b = sprite(TEX.flame, i & 1 ? '#ffb02e' : '#ff5a1a', 0.34);
    else if (d === 1) { b = mesh(new THREE.OctahedronGeometry(0.06), bladeM, false); b.scale.y = 2.2; }
    else if (d === 2) b = sprite(TEX.spark, i & 1 ? '#ff5ae0' : '#a040ff', 0.3);
    else b = sprite(TEX.spark, '#fff2b0', 0.32);
    bits.push(b); g.add(b);
  }
  if (d === 2 || d === 3) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.018, 8, 40), glowMat(L.a, 0.9)); ring.position.y = 1.1; g.add(ring); bits.ring = ring;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.014, 8, 36), glowMat(L.b, 0.8)); ring2.position.y = 1.6; g.add(ring2); bits.ring2 = ring2;
  }
  u.ticks.push(t => {
    halo.material.opacity = 0.28 + Math.sin(t * 3) * 0.1;
    core.emissiveIntensity = 2.2 + Math.sin(t * 5) * 0.8;
    bits.forEach((b, i) => {
      const k = (t * 0.45 + i / bits.length) % 1, a = t * 1.8 + i * TAU / bits.length;
      if (d === 0) { b.position.set(Math.sin(a * 2) * 0.12, 0.4 + k * 1.8, Math.cos(a) * 0.06); b.material.opacity = Math.sin(k * Math.PI); b.scale.setScalar(0.34 * (1 - k * 0.6)); }
      else if (d === 1) { b.position.set(Math.cos(a) * 0.32, 0.6 + i * 0.28, Math.sin(a) * 0.32); b.rotation.y = a; }
      else if (d === 2) { b.position.set(Math.cos(-a) * 0.3, 0.5 + i * 0.3, Math.sin(-a) * 0.3); b.material.opacity = 0.6 + Math.sin(t * 7 + i) * 0.4; }
      else { b.position.set(Math.cos(a) * (0.25 + k * 0.3), 0.3 + k * 1.7, Math.sin(a) * 0.1); b.material.opacity = Math.sin(k * Math.PI); }
    });
    if (bits.ring) { bits.ring.rotation.set(Math.PI / 2 + Math.sin(t) * 0.4, t * 1.5, 0); bits.ring2.rotation.set(Math.PI / 2 - Math.sin(t * 1.3) * 0.5, -t * 2, 0); }
  });
  u.bladeMat = bladeM;
}

// ---------------------------------------------------------------- staffs (the orb follows the mage's talents)
function staff(g, rar, tier) {
  const u = g.userData;
  const orbMat = new THREE.MeshStandardMaterial({ color: '#9ad8ff', emissive: '#4ab0ff', emissiveIntensity: 1.4, roughness: 0.1 });
  u.orbMat = orbMat;
  if (rar <= 1) {
    const wood = std({ color: rar ? '#7a5030' : '#6a4426', roughness: 0.85 });
    const p = mesh(cyl(0.045, 0.06, 2.0, 7), wood); p.position.y = 0.35; g.add(p);
    const knob = mesh(sph(0.1, 8, 6), wood); knob.position.y = 1.36; knob.scale.y = 1.2; g.add(knob);
    if (rar) { const wrap = mesh(cyl(0.065, 0.065, 0.22, 8), std({ color: '#3f6a32', roughness: 0.9 })); wrap.position.y = 0.1; g.add(wrap); }
    const orb = mesh(sph(rar ? 0.08 : 0.065, 10, 8), orbMat, false); orb.position.y = 1.5; g.add(orb); u.orb = orb;
    return;
  }
  if (rar === 2) {
    const wood = std({ color: '#3a2618', roughness: 0.6 }), silver = std({ color: '#d0dae8', metalness: 1, roughness: 0.2 });
    const p = mesh(cyl(0.05, 0.06, 2.0, 10), wood); p.position.y = 0.35; g.add(p);
    for (const y of [-0.3, 0.3, 0.9, 1.25]) { const b = mesh(cyl(0.068, 0.068, 0.05, 12), silver); b.position.y = y; g.add(b); }
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3, c = mesh(new THREE.ConeGeometry(0.035, 0.36, 6), silver); c.position.set(Math.cos(a) * 0.1, 1.48, Math.sin(a) * 0.1); c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(c); }
    const orb = mesh(new THREE.OctahedronGeometry(0.15), orbMat, false); orb.position.y = 1.55; orb.scale.y = 1.4; g.add(orb); u.orb = orb;
    u.ticks.push(t => { orb.rotation.y = t * 1.5; });
    return;
  }
  if (rar === 3) {
    // twisted dark wood, a floating crystal and shards
    const wood = std({ color: '#2a1838', roughness: 0.5 }), purple = std({ color: '#c070ff', emissive: '#a040ff', emissiveIntensity: 2, roughness: 0.2 });
    for (const ph of [0, Math.PI]) {
      const pts = []; for (let i = 0; i <= 24; i++) { const y = -0.65 + i * 2.0 / 24, a = ph + y * 5; pts.push(new V3(Math.cos(a) * 0.045, y, Math.sin(a) * 0.045)); }
      g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.04, 6), wood));
    }
    const vein = new THREE.Mesh(cyl(0.012, 0.012, 1.9, 4), glowMat('#c070ff', 0.8)); vein.position.y = 0.35; g.add(vein);
    const ring = mesh(new THREE.TorusGeometry(0.17, 0.03, 8, 24), purple); ring.position.y = 1.42; ring.rotation.x = Math.PI / 2; g.add(ring);
    const orb = mesh(new THREE.OctahedronGeometry(0.17), orbMat, false); orb.position.y = 1.72; orb.scale.y = 1.5; g.add(orb); u.orb = orb;
    const shards = [0, 1, 2].map(() => { const s = mesh(new THREE.OctahedronGeometry(0.05), purple, false); s.scale.y = 2; g.add(s); return s; });
    u.ticks.push(t => { orb.position.y = 1.72 + Math.sin(t * 2) * 0.05; orb.rotation.y = t * 2; shards.forEach((s, i) => { const a = t * 2.4 + i * TAU / 3; s.position.set(Math.cos(a) * 0.3, 1.72 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.3); }); });
    return;
  }
  const L = LEG[tier & 3], d = tier & 3;
  const core = std({ color: L.b, emissive: L.a, emissiveIntensity: 2.6, roughness: 0.15 });
  const shaft = d === 1 ? new THREE.MeshPhysicalMaterial({ color: '#bff0ff', emissive: '#2a90d0', emissiveIntensity: 0.6, roughness: 0.05, clearcoat: 1 })
    : d === 2 ? std({ color: '#100c18', metalness: 0.8, roughness: 0.2 }) : std({ color: d === 0 ? '#c88a2a' : '#f4e8c8', metalness: 1, roughness: 0.18, envMapIntensity: 1.5 });
  const p = mesh(cyl(0.05, 0.065, 2.2, 12), shaft); p.position.y = 0.45; g.add(p);
  for (const y of [-0.4, 0.4, 1.2]) { const b = mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 16), core); b.position.y = y; b.rotation.x = Math.PI / 2; g.add(b); }
  const head = new THREE.Group(); head.position.y = 1.85; head.scale.setScalar(1.45); g.add(head);
  const orb = mesh(sph(0.2, 18, 14), orbMat, false); head.add(orb); u.orb = orb;
  const halo = sprite(TEX.soft, L.light, 1.4, 0.45); head.add(halo);
  const bits = [];
  if (d === 0) { // phoenix: golden wings and fire
    for (const s of [-1, 1]) { const w = mesh(extrude([[0, -0.1], [0.25 * s, 0.05], [0.55 * s, 0.4], [0.42 * s, 0.12], [0.6 * s, 0.18], [0.35 * s, -0.05], [0.5 * s, -0.12], [0.1 * s, -0.25]], 0.03), core); head.add(w); }
    for (let i = 0; i < 6; i++) { const f = sprite(TEX.flame, i & 1 ? '#ffb02e' : '#ff5a1a', 0.4); head.add(f); bits.push(f); }
  } else if (d === 1) { // glacier: a cluster of ice spikes and circling shards
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6, c = mesh(new THREE.ConeGeometry(0.06, 0.5, 6), shaft); c.position.set(Math.cos(a) * 0.16, 0.05, Math.sin(a) * 0.16); c.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); head.add(c); }
    for (let i = 0; i < 5; i++) { const s = mesh(new THREE.OctahedronGeometry(0.05), shaft, false); s.scale.y = 2; head.add(s); bits.push(s); }
  } else if (d === 2) { // void: rings around a dark heart
    orb.scale.setScalar(1.1);
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.34 + i * 0.07, 0.016, 8, 40), glowMat(i & 1 ? L.b : L.a, 0.9)); head.add(r); bits.push(r); }
  } else { // sun: a crescent cradling the sun, stars around it
    const moon = mesh(new THREE.TorusGeometry(0.32, 0.05, 10, 30, Math.PI * 1.2), std({ color: '#ffe9a0', metalness: 1, roughness: 0.15 })); moon.rotation.z = -Math.PI * 0.1 - Math.PI / 2 - 0.3; moon.position.y = -0.05; head.add(moon);
    for (let i = 0; i < 5; i++) { const s = mesh(new THREE.OctahedronGeometry(0.06), core, false); head.add(s); bits.push(s); }
  }
  u.ticks.push(t => {
    halo.material.opacity = 0.35 + Math.sin(t * 3) * 0.12;
    core.emissiveIntensity = 2.2 + Math.sin(t * 4) * 0.8;
    bits.forEach((b, i) => {
      const a = t * 1.6 + i * TAU / bits.length, k = (t * 0.6 + i / bits.length) % 1;
      if (d === 0) { b.position.set(Math.sin(a * 3) * 0.1, k * 0.7, Math.cos(a) * 0.08); b.material.opacity = Math.sin(k * Math.PI); }
      else if (d === 1) { b.position.set(Math.cos(a) * 0.45, Math.sin(a * 2) * 0.1, Math.sin(a) * 0.45); b.rotation.y = a; }
      else if (d === 2) b.rotation.set(t * (0.8 + i * 0.5), t * (1.1 - i * 0.3), i);
      else { b.position.set(Math.cos(a) * 0.5, Math.sin(a) * 0.5, Math.sin(a * 2) * 0.1); b.rotation.y = t * 3; }
    });
  });
}

// ---------------------------------------------------------------- bows
function bow(g, rar, tier) {
  const u = g.userData;
  const H = rar === 4 ? 0.95 : rar === 3 ? 0.85 : 0.75;
  let limb, strCol = '#ece4d0', tips = null, curve;
  const recurve = rar >= 2;
  const pts = recurve
    ? [[0, -H, -0.02], [0, -H * 0.8, 0.06], [0, -H * 0.45, 0.16], [0, 0, 0.2], [0, H * 0.45, 0.16], [0, H * 0.8, 0.06], [0, H, -0.02]]
    : [[0, -H, -0.1], [0, -H * 0.47, 0.12], [0, 0, 0.18], [0, H * 0.47, 0.12], [0, H, -0.1]];
  curve = new THREE.CatmullRomCurve3(pts.map(p => new V3(...p)));
  const L = LEG[tier & 3], d = tier & 3;
  if (rar <= 1) limb = std({ color: rar ? '#8a5a2a' : '#7a4a22', roughness: 0.7 });
  else if (rar === 2) { limb = std({ color: '#3a2416', roughness: 0.45 }); strCol = '#9fd0ff'; tips = std({ color: '#d0dae8', metalness: 1, roughness: 0.2 }); }
  else if (rar === 3) { limb = std({ color: '#2a1838', metalness: 0.5, roughness: 0.3 }); strCol = '#e0a0ff'; tips = std({ color: '#c070ff', emissive: '#a040ff', emissiveIntensity: 2 }); }
  else {
    limb = d === 1 ? new THREE.MeshPhysicalMaterial({ color: '#bff0ff', emissive: '#2a90d0', emissiveIntensity: 0.7, roughness: 0.05, clearcoat: 1 })
      : d === 2 ? std({ color: '#100c18', metalness: 0.8, roughness: 0.2 }) : std({ color: d === 0 ? '#d8902a' : '#fff0c0', metalness: 1, roughness: 0.15, emissive: d === 0 ? '#a02a00' : '#a07000', emissiveIntensity: 0.4 });
    strCol = L.b; tips = std({ color: L.b, emissive: L.a, emissiveIntensity: 2.6 });
  }
  g.add(mesh(new THREE.TubeGeometry(curve, 28, rar >= 3 ? 0.05 : 0.038, 7), limb));
  // the grip
  const grip = mesh(cyl(0.055, 0.055, 0.24, 8), std({ color: rar === 1 ? '#3f6a32' : rar >= 3 ? '#1a1024' : '#4a2e1a', roughness: 0.8 })); grip.position.z = 0.19; g.add(grip);
  const end = recurve ? -0.02 : -0.1;
  if (tips) for (const s of [-1, 1]) { const c = mesh(new THREE.ConeGeometry(0.045, 0.18, 6), tips); c.position.set(0, s * (H + 0.06), end); c.rotation.x = s > 0 ? 0 : Math.PI; g.add(c); }
  if (rar >= 2) { const gm = mesh(new THREE.OctahedronGeometry(0.06), rar === 2 ? std({ color: '#4aa0ff', emissive: '#2a7aff', emissiveIntensity: 1.8 }) : tips); gm.position.set(0, 0, 0.25); g.add(gm); }
  if (rar === 3) for (let i = 0; i < 4; i++) { const y = (i < 2 ? -1 : 1) * (0.3 + (i & 1) * 0.25) * H; const sp = mesh(new THREE.ConeGeometry(0.025, 0.14, 5), tips); sp.position.copy(curve.getPoint(0.5 + y / H / 2)); sp.position.z += 0.06; sp.rotation.x = Math.PI / 2; g.add(sp); }
  // the string: three points, the middle one is drawn back when shooting
  const strGeo = new THREE.BufferGeometry().setFromPoints([new V3(0, -H, end), new V3(0, 0, end), new V3(0, H, end)]);
  const string = new THREE.Line(strGeo, new THREE.LineBasicMaterial({ color: strCol, transparent: rar >= 3, blending: rar >= 3 ? THREE.AdditiveBlending : THREE.NormalBlending }));
  g.add(string); u.string = string; u.stringZ = end;
  if (rar < 4) {
    if (rar === 3) { const sp = sprite(TEX.spark, '#d08aff', 0.22); g.add(sp); u.ticks.push(t => { const k = (t * 0.6) % 1; sp.position.copy(curve.getPoint(k)); sp.material.opacity = Math.sin(k * Math.PI); }); }
    return;
  }
  // legendary: glowing outline along the limbs, a halo at the grip and things that move
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.075, 7), glowMat(L.a, 0.45)));
  const halo = sprite(TEX.soft, L.light, 1.0, 0.4); halo.position.z = 0.2; g.add(halo);
  if (d === 0 || d === 3) for (const s of [-1, 1]) { // wings off the limbs
    const w = mesh(extrude([[0, 0], [0.05, 0.25 * s], [0.02, 0.5 * s], [0.12, 0.42 * s], [0.1, 0.18 * s]], 0.02), tips); w.rotation.y = -Math.PI / 2; w.position.set(0, s * H * 0.5, 0.2); g.add(w);
  }
  const bits = [];
  for (let i = 0; i < 6; i++) {
    const b = d === 1 ? mesh(new THREE.OctahedronGeometry(0.045), limb, false) : sprite(d === 0 ? TEX.flame : TEX.spark, i & 1 ? L.b : L.a, d === 0 ? 0.3 : 0.24);
    if (d === 1) b.scale.y = 2;
    g.add(b); bits.push(b);
  }
  u.ticks.push(t => {
    halo.material.opacity = 0.3 + Math.sin(t * 3) * 0.12;
    tips.emissiveIntensity = 2.2 + Math.sin(t * 5) * 0.8;
    bits.forEach((b, i) => {
      const k = (t * 0.35 + i / bits.length) % 1;
      if (d === 1) { const a = t * 1.5 + i; b.position.set(Math.cos(a) * 0.12, (k - 0.5) * 2 * H, 0.15 + Math.sin(a) * 0.12); b.rotation.y = a; }
      else { b.position.copy(curve.getPoint(k)); b.position.x += Math.sin(t * 4 + i) * 0.05; if (b.material) b.material.opacity = Math.sin(k * Math.PI); }
    });
  });
}
