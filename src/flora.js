// ============================================================================
//  DUNGEON WORLD  -  flora: the low-poly trees, rocks and bushes (faceted
//  icosahedron crowns, chunky trunks, angular rocks), merged into one mesh per
//  chunk, and the grass: thousands of instanced blades that sway in the wind
//  and bend away from whoever walks through.
// ============================================================================
import { THREE } from './engine.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const C = (r, g, b) => [r, g, b];
// a piece: geometry already placed in the plant's own frame (y up from the ground), with a color
function piece(geo, color, glow = false) { return { geo, color, glow }; }
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const dodeca = r => new THREE.DodecahedronGeometry(r, 0);
const cyl = (a, b, h, s = 6) => new THREE.CylinderGeometry(a, b, h, s);
const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
const at = (g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.scale(s, s, s); g.translate(x, y, z); return g; };
const jitter = (c, r) => c.map(v => Math.max(0, Math.min(255, v * (1 + (r() - 0.5) * 0.18))));
const rngOf = seed => { let s = Math.floor(seed * 1e6) >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

// each kind: pieces, and a trunk radius the hero bumps into (0: walk through)
export const KINDS = [
  { name: 'oak', r: 0.8, build(rn) { const p = [], h = 6 + rn() * 2.5, g = jitter(C(62, 160, 52), rn), g2 = jitter(C(104, 184, 60), rn);
      p.push(piece(at(cyl(0.4, 0.6, h, 6), 0, h / 2, 0), C(112, 76, 44)));
      p.push(piece(at(ico(2.1 + rn() * 0.6, 1), 0, h + 1.2, 0, rn(), rn(), rn()), g));
      p.push(piece(at(ico(1.5 + rn() * 0.5, 1), 1.2, h + 2.0, 0.5, rn(), rn()), g2));
      p.push(piece(at(ico(1.4 + rn() * 0.5, 1), -1.1, h + 1.8, -0.4, rn(), rn()), g)); return p; } },
  { name: 'birch', r: 0.5, build(rn) { const p = [], h = 7 + rn() * 2, g = jitter(C(120, 196, 70), rn);
      p.push(piece(at(cyl(0.28, 0.4, h, 6), 0, h / 2, 0), C(226, 222, 212)));
      p.push(piece(at(ico(1.7 + rn() * 0.5, 1), 0, h + 1.1, 0, rn(), rn()), g)); p.push(piece(at(ico(1.2, 1), 0.3, h + 2.6, 0.2, rn(), rn()), jitter(g, rn))); return p; } },
  { name: 'pine', r: 0.7, build(rn) { const p = [], h = 2.5 + rn() * 1.5, dark = jitter(C(40, 100, 66), rn), snow = C(230, 240, 248);
      p.push(piece(at(cyl(0.35, 0.5, h + 2, 6), 0, (h + 2) / 2, 0), C(96, 64, 40)));
      for (let i = 0; i < 4; i++) { const y = h + i * 2.1, r = 3.2 - i * 0.62; p.push(piece(at(cone(r, 2.8, 7), 0, y + 1.4, 0, 0, rn()), i % 2 && rn() < 0.6 ? snow : dark)); }
      return p; } },
  { name: 'cactus', r: 0.6, build(rn) { const p = [], h = 3 + rn() * 2.5, g = jitter(C(70, 150, 66), rn);
      p.push(piece(at(cyl(0.6, 0.7, h, 7), 0, h / 2, 0), g)); p.push(piece(at(ico(0.65, 0), 0, h, 0), g));
      if (rn() < 0.8) { const s = rn() < 0.5 ? -1 : 1; p.push(piece(at(cyl(0.4, 0.4, 1.6, 6), s * 1.1, h * 0.5, 0, 0, 0, Math.PI / 2), g)); p.push(piece(at(cyl(0.4, 0.45, 2.2, 6), s * 1.7, h * 0.5 + 1.1, 0), g)); }
      return p; } },
  { name: 'willow', r: 0.9, build(rn) { const p = [], h = 4.5 + rn() * 2, g = jitter(C(84, 118, 52), rn);
      p.push(piece(at(cyl(0.5, 0.8, h, 6), 0, h / 2, 0), C(72, 58, 40)));
      const crown = ico(2.6 + rn() * 0.6, 1); crown.scale(1, 0.7, 1); p.push(piece(at(crown, 0, h + 1.2, 0, 0, rn()), g));
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283, r = 2.2 + rn() * 0.6; p.push(piece(at(cone(0.35, 2.6 + rn() * 1.5, 5), Math.cos(a) * r, h - 0.2, Math.sin(a) * r, Math.PI), jitter(g, rn))); }
      return p; } },
  { name: 'char', r: 0.6, build(rn) { const p = [], h = 3.5 + rn() * 2, d = C(36, 30, 34);
      p.push(piece(at(cyl(0.3, 0.5, h, 5), 0, h / 2, 0), d));
      const s = rn() < 0.5 ? -1 : 1; p.push(piece(at(cyl(0.18, 0.28, 2.4, 5), s * 0.9, h - 0.3, 0, 0, 0, s * 0.9), d)); p.push(piece(at(cyl(0.14, 0.22, 1.8, 5), -s * 0.6, h - 1.2, 0.3, 0.4, 0, -s * 1.1), d));
      if (rn() < 0.6) p.push(piece(at(ico(0.22, 0), s * 1.6, h + 0.5, 0), C(255, 140, 40), true)); return p; } },
  { name: 'spire', r: 0.9, build(rn) { const p = [], h = 5 + rn() * 5; const o = new THREE.OctahedronGeometry(1.2, 0); o.scale(1, h / 2.4, 1);
      p.push(piece(at(o, 0, h / 2, 0, 0, rn()), C(46, 36, 66))); p.push(piece(at(ico(0.5, 0), 0.4, h * 0.45, 0.5), C(255, 104, 24), true)); return p; } },
  { name: 'crystal', r: 0.8, build(rn) { const p = [], n = 2 + Math.floor(rn() * 3);
      for (let i = 0; i < n; i++) { const h = 2.5 + rn() * 4, o = new THREE.OctahedronGeometry(0.7, 0); o.scale(1, h / 1.4, 1); const a = rn() * 6.283, r = i ? 0.9 + rn() : 0; p.push(piece(at(o, Math.cos(a) * r, h / 2, Math.sin(a) * r, (rn() - 0.5) * 0.5, rn(), (rn() - 0.5) * 0.5), i ? C(196, 120, 255) : C(216, 150, 255), true)); }
      p.push(piece(at(dodeca(1.2), 0, 0.2, 0), C(98, 74, 146))); return p; } },
  { name: 'pale', r: 0.6, build(rn) { const p = [], h = 4 + rn() * 2; p.push(piece(at(cyl(0.35, 0.5, h, 6), 0, h / 2, 0), C(214, 204, 232)));
      p.push(piece(at(ico(1.9 + rn() * 0.5, 1), 0, h + 1.2, 0, rn(), rn()), jitter(C(236, 132, 214), rn))); p.push(piece(at(ico(1.1, 1), 0.8, h + 2.2, 0.3), jitter(C(250, 170, 230), rn))); return p; } },
  { name: 'boulder', r: 1.1, build(rn) { const p = []; p.push(piece(at(dodeca(1.5 + rn() * 0.8), 0, 0.6, 0, rn(), rn(), rn()), jitter(C(126, 132, 128), rn))); if (rn() < 0.6) p.push(piece(at(dodeca(0.8 + rn() * 0.5), 1.4, 0.3, 0.6, rn(), rn()), jitter(C(118, 124, 120), rn))); return p; } },
  { name: 'snowrock', r: 1.1, build(rn) { const p = []; p.push(piece(at(dodeca(1.5 + rn() * 0.8), 0, 0.6, 0, rn(), rn(), rn()), jitter(C(140, 150, 160), rn))); p.push(piece(at(ico(1.1, 0), 0, 1.7, 0), C(238, 244, 252))); return p; } },
  { name: 'mesa_rock', r: 1.0, build(rn) { const p = []; p.push(piece(at(dodeca(1.3 + rn() * 0.7), 0, 0.5, 0, rn(), rn()), jitter(C(214, 146, 92), rn))); return p; } },
  { name: 'bush', r: 0, build(rn) { const p = []; p.push(piece(at(ico(1.2 + rn() * 0.5, 1), 0, 0.8, 0, rn(), rn()), jitter(C(74, 150, 60), rn))); p.push(piece(at(ico(0.9, 1), 0.9, 0.6, 0.4), jitter(C(96, 170, 66), rn))); if (rn() < 0.5) p.push(piece(at(ico(0.18, 0), 0.3, 1.6, 0.5), C(236, 58, 64))); return p; } },
  { name: 'deadbush', r: 0, build(rn) { const p = []; for (let i = 0; i < 5; i++) { const a = rn() * 6.283; p.push(piece(at(cyl(0.05, 0.08, 1.2 + rn(), 4), Math.cos(a) * 0.3, 0.6, Math.sin(a) * 0.3, (rn() - 0.5) * 0.8, 0, (rn() - 0.5) * 0.8), C(150, 112, 66))); } return p; } },
  { name: 'reeds', r: 0, build(rn) { const p = []; for (let i = 0; i < 7; i++) { const a = rn() * 6.283, r = rn() * 0.8; p.push(piece(at(cyl(0.06, 0.1, 1.8 + rn() * 1.2, 4), Math.cos(a) * r, 1, Math.sin(a) * r, (rn() - 0.5) * 0.3, 0, (rn() - 0.5) * 0.3), jitter(C(120, 146, 66), rn))); } return p; } },
];

// each kind comes in a few variants, built once (merged geometry with sRGB vertex colors, like the land's),
// and a chunk draws its plants as one InstancedMesh per kind and variant (a handful of draw calls, no building)
const VARIANTS = 3, variantCache = new Map();
function variant(ki, vi) {
  const key = ki * 8 + vi;
  if (variantCache.has(key)) return variantCache.get(key);
  const kind = KINDS[ki], rn = rngOf(0.1 + ki * 0.37 + vi * 0.61), solid = [], glow = [];
  for (const pc of kind.build(rn)) {
    const g = pc.geo.index ? pc.geo.toNonIndexed() : pc.geo;
    const n = g.attributes.position.count, col = new Uint8Array(n * 3);
    for (let k = 0; k < n; k++) { col[k * 3] = pc.color[0]; col[k * 3 + 1] = pc.color[1]; col[k * 3 + 2] = pc.color[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3, true)); g.deleteAttribute('uv');
    (pc.glow ? glow : solid).push(g);
  }
  const merge = arr => { if (!arr.length) return null; const m = mergeGeometries(arr); m.computeVertexNormals(); m.computeBoundingSphere(); for (const g of arr) g.dispose(); return m; };
  const v = { solid: merge(solid), glow: merge(glow) };
  variantCache.set(key, v);
  return v;
}
// one chunk's plants: [kind, x, y, z, scale, turn] x n -> { meshes: [{ mesh, glow }], trunks }
export function buildFlora(list, solidMat, glowMat) {
  const groups = new Map(), trunks = [];
  for (let i = 0; i < list.length; i += 6) {
    const ki = list[i], kind = KINDS[ki];
    if (!kind) continue;
    const x = list[i + 1], y = list[i + 2], z = list[i + 3], s = list[i + 4], turn = list[i + 5];
    const vi = Math.floor(((turn * 7.3) % 1) * VARIANTS), key = ki * 8 + vi;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push([x, y, z, s, turn]);
    if (kind.r) trunks.push(x, z, kind.r * s);
  }
  const meshes = [], M = new THREE.Matrix4(), q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  for (const [key, list2] of groups) {
    const v = variant(Math.floor(key / 8), key % 8);
    for (const part of ['solid', 'glow']) {
      if (!v[part]) continue;
      const m = new THREE.InstancedMesh(v[part], part === 'glow' ? glowMat : solidMat, list2.length);
      list2.forEach(([x, y, z, s, turn], k) => { P.set(x, y, z); q.setFromAxisAngle(Y, turn); S.setScalar(s); m.setMatrixAt(k, M.compose(P, q, S)); const t = 0.9 + ((turn * 3.1) % 1) * 0.2; c.setRGB(t, t * (0.97 + ((turn * 5.7) % 1) * 0.06), t); m.setColorAt(k, c); });
      m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
      if (part === 'solid') { m.castShadow = true; m.receiveShadow = true; }
      m.frustumCulled = false;
      meshes.push(m);
    }
  }
  return { meshes, trunks: Float32Array.from(trunks) };
}

// ---------------------------------------------------------------- grass
// a blade: a thin tapered strip, four verts; uv.y says how far up the blade a vertex is (the sway bends the top)
const bladeGeo = (() => {
  const g = new THREE.BufferGeometry();
  const w = 0.26, h = 1.35;
  g.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, w * 0.45, h * 0.6, 0, -w * 0.45, h * 0.6, 0, 0, h, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 0.6, 0, 0.6, 0.5, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3, 3, 2, 4]);
  g.computeVertexNormals();
  return g;
})();
export const grassUniforms = { uTime: { value: 0 }, uHero: { value: new THREE.Vector3() }, uMon: { value: [new THREE.Vector3(0, -999, 0), new THREE.Vector3(0, -999, 0), new THREE.Vector3(0, -999, 0), new THREE.Vector3(0, -999, 0)] } };
const grassMat = new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide, vertexColors: false });
grassMat.onBeforeCompile = sh => {
  sh.uniforms.uTime = grassUniforms.uTime; sh.uniforms.uHero = grassUniforms.uHero; sh.uniforms.uMon = grassUniforms.uMon;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uTime; uniform vec3 uHero; uniform vec3 uMon[4];\nvarying float vShade;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      // the blade's root in the world, the bend up its length
      vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float k = uv.y * uv.y;
      // the wind: a slow wave across the land and a flutter
      float w = sin(uTime * 1.6 + root.x * 0.35 + root.z * 0.2) * 0.35 + sin(uTime * 3.1 + root.z * 0.9) * 0.12;
      transformed.x += w * k * 0.9; transformed.z += cos(uTime * 1.3 + root.x * 0.5) * 0.18 * k;
      // whoever walks through pushes it aside
      vec3 who[5]; who[0] = uHero; who[1] = uMon[0]; who[2] = uMon[1]; who[3] = uMon[2]; who[4] = uMon[3];
      for (int i = 0; i < 5; i++) { vec2 d = root.xz - who[i].xz; float l = length(d); float push = clamp((3.2 - l) / 3.2, 0.0, 1.0) * step(abs(root.y - who[i].y), 4.0); transformed.xz += normalize(d + 0.001) * push * 1.6 * k; transformed.y -= push * 0.5 * k; }
      vShade = 0.72 + 0.28 * uv.y;`)
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vShade;')
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vShade;');
};
const GRASS_COL = [[0.33, 0.68, 0.22], [0.38, 0.5, 0.2], [0.35, 0.78, 0.74]]; // (forest, bog, crystal lands)
// a chunk's grass: an InstancedMesh for the spots whose number is under the density (0 .. 1)
export function buildGrass(spots, density, ox, oz) {
  const n = spots.length / 5;
  let count = 0; for (let i = 0; i < n; i++) if (spots[i * 5 + 3] < density) count++;
  if (!count) return null;
  const m = new THREE.InstancedMesh(bladeGeo, grassMat, count);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const r = spots[i * 5 + 3]; if (r >= density) continue;
    const pick = spots[i * 5 + 4], base = GRASS_COL[pick === 0 ? 0 : pick === 3 ? 1 : 2];
    p.set(ox + spots[i * 5], spots[i * 5 + 1] - 0.05, oz + spots[i * 5 + 2]);
    q.setFromAxisAngle(Y, r * 97); s.setScalar(0.8 + ((r * 13) % 1) * 0.6);
    m.setMatrixAt(k, M.compose(p, q, s));
    const v = 0.85 + ((r * 31) % 1) * 0.3; c.setRGB(base[0] * v, base[1] * v, base[2] * v);
    m.setColorAt(k, c); k++;
  }
  m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
  m.frustumCulled = false; m.receiveShadow = true;
  return m;
}
