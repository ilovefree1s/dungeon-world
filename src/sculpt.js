// ============================================================================
//  DUNGEON WORLD  -  sculpted bodies: a hero's whole body as one smooth surface
//  (a distance field of rounded shapes melted into one another: shoulders flow
//  into arms, the jaw into the neck, a nose and a brow shaped out of the head),
//  turned into a mesh (surface nets), and bound to a skeleton with soft
//  weights so elbows and knees bend like flesh, not like a toy's pins.
//
//  The skeleton keeps the old rig's joints and names (body, legs, knees, arms,
//  elbows, hands, head) so everything hung on the old rig hangs on this one.
// ============================================================================
import * as THREE from 'three';

// ---------------------------------------------------------------- distance functions
function roundCone(px, py, pz, ax, ay, az, bx, by, bz, r1, r2) {
  const bax = bx - ax, bay = by - ay, baz = bz - az, l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = px - ax, pay = py - ay, paz = pz - az, y = pax * bax + pay * bay + paz * baz, z = y - l2;
  const qx = pax * l2 - bax * y, qy = pay * l2 - bay * y, qz = paz * l2 - baz * y, x2 = qx * qx + qy * qy + qz * qz;
  const y2 = y * y * l2, z2 = z * z * l2, k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
function ellipsoid(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = px - cx, y = py - cy, z = pz - cz;
  const ax = x / rx, ay = y / ry, az = z / rz, bx = ax / rx, by = ay / ry, bz = az / rz;
  const k0 = Math.sqrt(ax * ax + ay * ay + az * az), k1 = Math.sqrt(bx * bx + by * by + bz * bz);
  return k1 === 0 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
}
function roundBox(px, py, pz, cx, cy, cz, bx, by, bz, r) {
  const qx = Math.abs(px - cx) - bx + r, qy = Math.abs(py - cy) - by + r, qz = Math.abs(pz - cz) - bz + r;
  const mx = qx > 0 ? qx : 0, my = qy > 0 ? qy : 0, mz = qz > 0 ? qz : 0;
  return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

// ---------------------------------------------------------------- the body's shapes
// bones: 0 body (the root: torso, hips), 1 head, 2/3 thigh L/R, 4/5 shin, 6/7 foot, 8/9 upper arm, 10/11 forearm, 12/13 hand
// regions: what each shape is dressed in: skin, torso, leg, shin, boot, arm, fore, hand
function shapes(o) {
  const S = o.slim ? 0.93 : 1, P = [];
  const add = (bone, region, k, f, bound) => P.push({ bone, region, k, f, bound });
  // the torso: chest, waist and hips melted together
  add(0, 'torso', 0.1, (x, y, z) => ellipsoid(x, y, z, 0, 1.24, 0, 0.345 * S, 0.27, 0.25), [0, 1.24, 0, 0.4]);
  add(0, 'torso', 0.12, (x, y, z) => ellipsoid(x, y, z, 0, 1.0, 0, 0.29 * S, 0.22, 0.215), [0, 1.0, 0, 0.35]);
  add(0, 'leg', 0.1, (x, y, z) => ellipsoid(x, y, z, 0, 0.8, -0.01, 0.31 * S, 0.17, 0.225), [0, 0.8, 0, 0.34]);
  // a collar of the trapezius, the neck
  add(0, 'torso', 0.08, (x, y, z) => ellipsoid(x, y, z, 0, 1.45, -0.02, 0.27 * S, 0.1, 0.16), [0, 1.45, 0, 0.3]);
  add(0, 'skin', 0.07, (x, y, z) => roundCone(x, y, z, 0, 1.5, -0.01, 0, 1.78, 0.0, 0.1, 0.088), [0, 1.64, 0, 0.2]);
  // the head: skull, jaw, cheeks, brow, nose, chin, lips, ears
  const H = 1.86, low = o.mask ? 'mask' : o.beard ? 'beard' : 'skin';
  add(1, 'skin', 0.06, (x, y, z) => ellipsoid(x, y, z, 0, H + 0.01, -0.005, 0.27, 0.285, 0.265), [0, H, 0, 0.32]);
  add(1, low, 0.07, (x, y, z) => ellipsoid(x, y, z, 0, H - 0.1, 0.06, 0.205, 0.165, 0.19), [0, H - 0.1, 0.06, 0.24]);
  for (const s of [-1, 1]) add(1, low, 0.04, (x, y, z) => ellipsoid(x, y, z, 0.13 * s, H - 0.06, 0.17, 0.075, 0.06, 0.06), [0.13 * s, H - 0.06, 0.17, 0.1]);
  add(1, 'skin', 0.035, (x, y, z) => ellipsoid(x, y, z, 0, H + 0.075, 0.2, 0.2, 0.045, 0.07), [0, H + 0.075, 0.2, 0.22]);
  add(1, o.mask ? 'mask' : 'skin', 0.025, (x, y, z) => roundCone(x, y, z, 0, H + 0.02, 0.255, 0, H - 0.045, 0.29, 0.02, 0.034), [0, H - 0.01, 0.27, 0.08]);
  add(1, low, 0.03, (x, y, z) => ellipsoid(x, y, z, 0, H - 0.2, 0.15, 0.06, 0.045, 0.05), [0, H - 0.2, 0.15, 0.08]);
  add(1, o.beard ? 'skin' : low, 0.02, (x, y, z) => ellipsoid(x, y, z, 0, H - 0.11, 0.232, 0.05, 0.022, 0.025), [0, H - 0.11, 0.232, 0.06]);
  for (const s of [-1, 1]) {
    if (o.ears === 'elf') add(1, 'skin', 0.03, (x, y, z) => roundCone(x, y, z, 0.25 * s, H + 0.0, -0.02, 0.43 * s, H + 0.13, -0.08, 0.045, 0.008), [0.34 * s, H + 0.06, -0.05, 0.14]);
    else if (o.ears !== 'none') add(1, 'skin', 0.025, (x, y, z) => ellipsoid(x, y, z, 0.262 * s, H, -0.01, 0.03, 0.062, 0.045), [0.262 * s, H, 0, 0.08]);
  }
  for (const [i, s] of [[0, -1], [1, 1]]) {
    const ax = 0.4 * s * S, hx = 0.155 * s * S;
    // shoulder (a deltoid), upper arm, elbow, forearm, hand, thumb
    add(8 + i, 'arm', 0.07, (x, y, z) => ellipsoid(x, y, z, ax * 0.97, 1.38, 0, 0.12, 0.12, 0.12), [ax, 1.38, 0, 0.15]);
    add(8 + i, 'arm', 0.05, (x, y, z) => roundCone(x, y, z, ax, 1.36, 0, ax, 1.11, 0, 0.098, 0.082), [ax, 1.24, 0, 0.2]);
    add(10 + i, 'fore', 0.05, (x, y, z) => roundCone(x, y, z, ax, 1.11, 0, ax, 0.84, 0, 0.084, 0.064), [ax, 0.97, 0, 0.2]);
    add(12 + i, 'hand', 0.035, (x, y, z) => ellipsoid(x, y, z, ax, 0.78, 0.005, 0.07, 0.085, 0.055), [ax, 0.78, 0, 0.11]);
    add(12 + i, 'hand', 0.02, (x, y, z) => roundCone(x, y, z, ax - 0.045 * s, 0.8, 0.035, ax - 0.06 * s, 0.75, 0.065, 0.027, 0.022), [ax - 0.05 * s, 0.78, 0.05, 0.07]);
    // thigh, knee, shin, calf, foot
    add(2 + i, 'leg', 0.07, (x, y, z) => roundCone(x, y, z, hx, 0.8, 0, hx, 0.42, 0.01, 0.14 * S, 0.105 * S), [hx, 0.61, 0, 0.25]);
    add(4 + i, o.tall ? 'boot' : 'shin', 0.05, (x, y, z) => roundCone(x, y, z, hx, 0.42, 0.01, hx, 0.1, 0, 0.108 * S, 0.084 * S), [hx, 0.26, 0, 0.22]);
    add(4 + i, o.tall ? 'boot' : 'shin', 0.05, (x, y, z) => ellipsoid(x, y, z, hx, 0.3, -0.035, 0.09 * S, 0.11, 0.075), [hx, 0.3, -0.03, 0.13]);
    add(6 + i, 'boot', 0.05, (x, y, z) => roundBox(x, y, z, hx, 0.065, 0.055, 0.11, 0.075, 0.18, 0.06), [hx, 0.065, 0.055, 0.24]);
  }
  return P;
}
// (bone rest positions, as the old rig's joints: body at the origin)
function joints(o) {
  const S = o.slim ? 0.93 : 1, J = [];
  J[0] = [null, 0, 0, 0]; J[1] = [0, 0, 1.86, 0];
  for (const [i, s] of [[0, -1], [1, 1]]) {
    J[2 + i] = [0, 0.155 * s * S, 0.78, 0]; J[4 + i] = [2 + i, 0, -0.36, 0]; J[6 + i] = [4 + i, 0, -0.33, 0];
    J[8 + i] = [0, 0.4 * s * S, 1.39, 0]; J[10 + i] = [8 + i, 0, -0.28, 0]; J[12 + i] = [10 + i, 0, -0.28, 0];
  }
  return J;
}

// ---------------------------------------------------------------- the mesh
const CACHE = new Map();
export const REGIONS = ['skin', 'torso', 'leg', 'shin', 'boot', 'arm', 'fore', 'hand', 'mask', 'beard'];
function buildGeometry(o) {
  const key = `${o.slim ? 1 : 0}|${o.tall ? 1 : 0}|${o.ears || 'round'}|${o.mask ? 1 : 0}|${o.beard ? 1 : 0}`;
  if (CACHE.has(key)) return CACHE.get(key);
  const P = shapes(o);
  const field = (x, y, z) => {
    let d = 1e9;
    for (let i = 0; i < P.length; i++) { const p = P[i], b = p.bound, dx = x - b[0], dy = y - b[1], dz = z - b[2], db = Math.sqrt(dx * dx + dy * dy + dz * dz) - b[3]; if (db > d + p.k) continue; const f = p.f(x, y, z), k = p.k, hh = k - Math.abs(d - f); d = hh > 0 ? Math.min(d, f) - hh * hh * 0.25 / k : Math.min(d, f); }
    return d;
  };
  // sample on a grid
  const h = 0.0118, x0 = -0.62, y0 = -0.04, z0 = -0.38, nx = Math.ceil(1.24 / h) + 1, ny = Math.ceil(2.32 / h) + 1, nz = Math.ceil(0.82 / h) + 1;
  const F = new Float32Array(nx * ny * nz), id = (i, j, k) => i + nx * (j + ny * k);
  // (a coarse pass first: fine samples are only taken near the surface)
  const cs = 4, cx = Math.ceil(nx / cs) + 1, cy = Math.ceil(ny / cs) + 1, cz = Math.ceil(nz / cs) + 1, CF = new Float32Array(cx * cy * cz);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) CF[i + cx * (j + cy * k)] = field(x0 + i * cs * h, y0 + j * cs * h, z0 + k * cs * h);
  const far = cs * h * 1.9;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = CF[Math.round(i / cs) + cx * (Math.round(j / cs) + cy * Math.round(k / cs))];
    F[id(i, j, k)] = Math.abs(c) > far ? c : field(x0 + i * h, y0 + j * h, z0 + k * h);
  }
  // surface nets: one vertex in each cell the surface passes through, at the mean of the edge crossings
  const cellV = new Int32Array(nx * ny * nz).fill(-1), pos = [];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let m = 0;
    for (let c = 0; c < 8; c++) { v[c] = F[id(i + C[c][0], j + C[c][1], k + C[c][2])]; if (v[c] < 0) m |= 1 << c; }
    if (m === 0 || m === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t; n++;
    }
    cellV[id(i, j, k)] = pos.length / 3;
    pos.push(x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (k + sz / n) * h);
  }
  // a quad across each grid edge the surface crosses
  const idx = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, b, c, a, c, d); else idx.push(a, d, c, a, c, b); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const f0 = F[id(i, j, k)] < 0;
    if (f0 !== (F[id(i + 1, j, k)] < 0)) quad(cellV[id(i, j - 1, k - 1)], cellV[id(i, j, k - 1)], cellV[id(i, j, k)], cellV[id(i, j - 1, k)], f0);
    if (f0 !== (F[id(i, j + 1, k)] < 0)) quad(cellV[id(i - 1, j, k - 1)], cellV[id(i - 1, j, k)], cellV[id(i, j, k)], cellV[id(i, j, k - 1)], f0);
    if (f0 !== (F[id(i, j, k + 1)] < 0)) quad(cellV[id(i - 1, j - 1, k)], cellV[id(i, j - 1, k)], cellV[id(i, j, k)], cellV[id(i - 1, j, k)], f0);
  }
  // each vertex: pulled onto the surface, its normal from the field, its bone weights, its region
  const N = pos.length / 3, nor = new Float32Array(N * 3), skI = new Uint16Array(N * 4), skW = new Float32Array(N * 4), reg = new Uint8Array(N);
  const e = 0.003, bd = new Float32Array(14);
  for (let q = 0; q < N; q++) {
    let x = pos[q * 3], y = pos[q * 3 + 1], z = pos[q * 3 + 2];
    for (let it = 0; it < 1; it++) {
      const d = field(x, y, z), gx = field(x + e, y, z) - field(x - e, y, z), gy = field(x, y + e, z) - field(x, y - e, z), gz = field(x, y, z + e) - field(x, y, z - e), gl = Math.hypot(gx, gy, gz) || 1;
      x -= d * gx / gl; y -= d * gy / gl; z -= d * gz / gl;
      if (it === 0) { nor[q * 3] = gx / gl; nor[q * 3 + 1] = gy / gl; nor[q * 3 + 2] = gz / gl; }
    }
    pos[q * 3] = x; pos[q * 3 + 1] = y; pos[q * 3 + 2] = z;
    bd.fill(1e9); let best = 1e9, own = 0;
    for (const p of P) { const d = p.f(x, y, z); if (d < bd[p.bone]) bd[p.bone] = d; if (d < best) { best = d; own = p; } }
    let rg = own.region;
    // (a mask or a beard is drawn on the face by where a point is, so its edge runs clean)
    if ((o.mask || o.beard) && own.bone <= 1 && y > 1.58) {
      if (rg === 'mask' || rg === 'beard') rg = 'skin';
      if (o.mask && y < 1.865 && z > -0.03) rg = 'mask';
      if (o.beard && y < 1.815 && z > 0.0 && !(Math.abs(x) < 0.055 && y > 1.73 && y < 1.77) && !(y > 1.79 && z > 0.24)) rg = 'beard';
    }
    reg[q] = REGIONS.indexOf(rg);
    const ws = []; for (let b = 0; b < 14; b++) if (bd[b] < 1e8) ws.push([b, Math.exp(-(bd[b] - best) / 0.022)]);
    ws.sort((a, b) => b[1] - a[1]); const top = ws.slice(0, 4), sum = top.reduce((s, w) => s + w[1], 0);
    top.forEach(([b, w], k) => { skI[q * 4 + k] = b; skW[q * 4 + k] = w / sum; });
  }
  // the triangles sorted by region (one material each)
  const byR = REGIONS.map(() => []);
  for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2]; const r = reg[a] === reg[b] || reg[a] === reg[c] ? reg[a] : reg[b]; byR[r].push(a, b, c); }
  const g = new THREE.BufferGeometry(), all = [];
  byR.forEach((list, r) => { if (list.length) g.addGroup(all.length, list.length, r); all.push(...list); });
  g.setIndex(all);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  // (a texture coordinate wrapped round the body: around for u, up for v)
  const uv = new Float32Array(N * 2); for (let q = 0; q < N; q++) { uv[q * 2] = Math.atan2(pos[q * 3], pos[q * 3 + 2]) / Math.PI * 1.5; uv[q * 2 + 1] = pos[q * 3 + 1] * 2.2; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skI, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skW, 4));
  g.computeBoundingSphere();
  CACHE.set(key, g);
  return g;
}

// the body: a skinned mesh and its bones, named as the old rig's parts
export function sculptBody(o, mats) {
  const geo = buildGeometry(o);
  const J = joints(o), bones = J.map(() => new THREE.Bone());
  J.forEach(([parent, x, y, z], i) => { bones[i].position.set(x, y, z); if (parent !== null) bones[parent].add(bones[i]); });
  const mesh = new THREE.SkinnedMesh(geo, REGIONS.map(r => mats[r] || mats.skin));
  mesh.add(bones[0]); bones[0].updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  return { mesh, bones, body: bones[0], head: bones[1], legs: [bones[2], bones[3]], knees: [bones[4], bones[5]], feet: [bones[6], bones[7]], arms: [bones[8], bones[9]], elbows: [bones[10], bones[11]], hands: [bones[12], bones[13]] };
}
export { buildGeometry };
