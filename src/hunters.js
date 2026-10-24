// ============================================================================
//  DUNGEON WORLD  -  the hunter's new looks (concepts): five hunters on one
//  finer body, every piece of it smooth and jointed (shoulder, elbow, hand;
//  hip, knee, foot), dressed in materials with a weave, a grain or a nap,
//  inked with a thin outline and a rim of light. Capes, coat tails, scarves
//  and hair hang on a little spring chain each, so they swing as you run and
//  settle when you stop; faces blink, and squint down the arrow.
//
//  The rig keeps the old hero's names (body, legs, arms, head, cape, bow,
//  string, quiver) so the game's motion still drives it; tickHunter(root, dt,
//  motion) runs the cloth, hair and faces.
// ============================================================================
import * as THREE from 'three';
import { sculptBody } from './sculpt.js';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const cl = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- textures
// small grey pictures, tiled: they shade a material's color (map) and give it a feel (bump)
function rnd(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function noiseField(n, seed, cells) {
  const r = rnd(seed), g = Array.from({ length: cells * cells }, r);
  const at = (x, y) => g[((y % cells + cells) % cells) * cells + ((x % cells + cells) % cells)];
  return (x, y) => { const fx = x / n * cells, fy = y / n * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy; };
}
const TEXS = {};
function tex(kind) {
  if (TEXS[kind]) return TEXS[kind];
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const x2 = c.getContext('2d'), img = x2.createImageData(N, N), d = img.data;
  const n1 = noiseField(N, 7, 8), n2 = noiseField(N, 13, 32), n3 = noiseField(N, 29, 64);
  const fbm = (x, y) => n1(x, y) * 0.5 + n2(x, y) * 0.32 + n3(x, y) * 0.18;
  const nf = noiseField(N, 41, kind === 'fur' ? 22 : 64), nm = noiseField(N, 5, 128);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 1;
    if (kind === 'weave') { const w = (Math.sin(x * 1.57) * 0.5 + 0.5) * ((x >> 2) + (y >> 2) & 1 ? 1 : 0.6) + (Math.sin(y * 1.57) * 0.5 + 0.5) * ((x >> 2) + (y >> 2) & 1 ? 0.6 : 1); v = 0.8 + w * 0.07 + (fbm(x, y) - 0.5) * 0.16; }
    else if (kind === 'leather') { const f = fbm(x, y); v = 0.72 + f * 0.3 - Math.max(0, n3(x * 3, y * 3) - 0.78) * 0.9; }
    else if (kind === 'fur' || kind === 'hair') { v = 0.62 + 0.38 * nf(x * (kind === 'fur' ? 2.4 : 6), y * 0.35) * (0.7 + 0.3 * n1(x, y)); }
    else if (kind === 'metal') { v = 0.82 + 0.12 * nm(x * 0.05, y * 4) + (n1(x, y) - 0.5) * 0.08; }
    else if (kind === 'wood') { const g = Math.sin(y * 0.11 + fbm(x, y) * 9); v = 0.74 + g * 0.1 + n3(x, y * 0.2) * 0.12; }
    else if (kind === 'skin') { v = 0.94 + (fbm(x, y) - 0.5) * 0.1; }
    const i = (y * N + x) * 4, b = cl(v, 0, 1) * 255; d[i] = d[i + 1] = d[i + 2] = b; d[i + 3] = 255;
  }
  // stitches and scratches
  if (kind === 'leather') { const r = rnd(3); x2.putImageData(img, 0, 0); x2.strokeStyle = 'rgba(30,20,12,.35)'; x2.lineWidth = 1; for (let i = 0; i < 26; i++) { x2.beginPath(); const sx = r() * N, sy = r() * N; x2.moveTo(sx, sy); x2.lineTo(sx + (r() - 0.5) * 40, sy + (r() - 0.5) * 18); x2.stroke(); } }
  else x2.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (TEXS[kind] = t);
}

// ---------------------------------------------------------------- materials
// a rim of light on every hero material (the edge turned from you glows a little), set from the page
export const RIM = { value: new THREE.Color('#ffe2b8').multiplyScalar(0.32) };
function rimmed(m) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uRim = RIM;
    sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
      'outgoingLight += uRim * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'hunter-rim';
  return m;
}
const MATS = new Map();
// kind: cloth | leather | fur | metal | skin | hair | wood | gem (shiny) | dark (matte)
function M(kind, color, o = {}) {
  const k = kind + color + JSON.stringify(o);
  if (MATS.has(k)) return MATS.get(k);
  const col = new THREE.Color(color), lite = col.clone().lerp(new THREE.Color('#ffffff'), 0.35);
  const base = { color: col, roughness: 0.7 };
  const p = {
    cloth: { roughness: 0.88, sheen: 0.8, sheenColor: lite, sheenRoughness: 0.45, map: tex('weave'), bumpMap: tex('weave'), bumpScale: 1.4, rep: 3 },
    leather: { roughness: 0.52, clearcoat: 0.18, clearcoatRoughness: 0.5, map: tex('leather'), bumpMap: tex('leather'), bumpScale: 2, rep: 2 },
    fur: { roughness: 1, sheen: 1, sheenColor: lite, sheenRoughness: 0.6, map: tex('fur'), bumpMap: tex('fur'), bumpScale: 4, rep: 2 },
    metal: { metalness: 0.92, roughness: 0.3, map: tex('metal'), rep: 1 },
    skin: { roughness: 0.55, sheen: 0.35, sheenColor: new THREE.Color('#ff9a80'), sheenRoughness: 0.5, map: tex('skin'), rep: 1 },
    hair: { roughness: 0.42, sheen: 0.9, sheenColor: lite, sheenRoughness: 0.3, map: tex('hair'), bumpMap: tex('hair'), bumpScale: 2, rep: 2 },
    wood: { roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4, map: tex('wood'), bumpMap: tex('wood'), bumpScale: 1, rep: 1 },
    gem: { roughness: 0.15, clearcoat: 1, metalness: 0.1 },
    dark: { roughness: 0.95 },
  }[kind] || {};
  const { rep, ...rest } = p;
  const m = rimmed(new THREE.MeshPhysicalMaterial({ ...base, ...rest, ...o }));
  if (rep && m.map) { m.map = m.map.clone(); m.map.repeat.set(rep, rep); m.map.needsUpdate = true; if (m.bumpMap) { m.bumpMap = m.map; } }
  MATS.set(k, m); return m;
}
const glow = (c, k = 1) => { const key = 'glow' + c + k; if (!MATS.has(key)) MATS.set(key, new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) })); return MATS.get(key); };
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
const mix = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();

// ---------------------------------------------------------------- shapes
const mesh = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o; };
const sph = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const cyl = (a, b, h, s = 16) => new THREE.CylinderGeometry(a, b, h, s);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const cone = (r, h, s = 10) => new THREE.ConeGeometry(r, h, s);
const tor = (r, t, a = TAU, s = 18) => new THREE.TorusGeometry(r, t, 6, s, a);
const lathe = (pts, s = 26, p0 = 0, pl = TAU) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y)), s, p0, pl);
// a limb: a capsule that tapers from r0 at its top (y 0) to r1 at its foot (y -len), one smooth piece
function limb(r0, r1, len, s = 16) {
  const pts = [];
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI / 2; pts.push([r1 * Math.cos(a), -len + r1 * Math.sin(a)]); }
  for (let i = 1; i <= 6; i++) { const a = i / 6 * Math.PI / 2; pts.push([r0 * Math.cos(a), r0 * Math.sin(a)]); }
  return lathe(pts, s);
}
// a box with rounded corners
function rbox(x, y, z, r = 0.5, seg = 4) {
  const g = new THREE.BoxGeometry(x, y, z, seg, seg, seg), p = g.attributes.position, v = new V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = new V3(v.x / (x / 2), v.y / (y / 2), v.z / (z / 2));
    const s = n.clone().normalize().multiplyScalar(Math.SQRT2 * 0.8);
    n.lerp(new V3(Math.sign(n.x) * Math.min(Math.abs(n.x), Math.abs(s.x) || 1), Math.sign(n.y) * Math.min(Math.abs(n.y), Math.abs(s.y) || 1), Math.sign(n.z) * Math.min(Math.abs(n.z), Math.abs(s.z) || 1)), r);
    p.setXYZ(i, n.x * x / 2, n.y * y / 2, n.z * z / 2);
  }
  g.computeVertexNormals(); return g;
}

// ---------------------------------------------------------------- cloth and hair
// a sheet hung from its top edge, its rows on a spring chain: running lifts it back, turning swings it aside,
// a breeze ripples it; it settles when you stop. dir -1 hangs behind (a cape), +1 in front (a coat's front panel)
class Sheet {
  constructor(w, h, mat, o = {}) {
    this.o = { sx: 8, sy: 14, curve: 0.9, flare: 0.3, jag: 0, tails: 0, dir: -1, base: 0.1, lift: 0.7, swing: 0.5, stiff: 1, wind: 1, ...o };
    const { sx, sy } = this.o;
    this.w = w; this.h = h; this.R = sy;
    this.geo = new THREE.PlaneGeometry(w, h, sx, sy);
    this.rest = Float32Array.from(this.geo.attributes.position.array);
    this.mesh = mesh(this.geo, mat); this.mesh.userData.noInk = true;
    this.a = new Float32Array(sy + 1).fill(this.o.base); this.va = new Float32Array(sy + 1);
    this.b = new Float32Array(sy + 1); this.vb = new Float32Array(sy + 1);
    this.ys = new Float32Array(sy + 1); this.zs = new Float32Array(sy + 1); this.xs = new Float32Array(sy + 1);
    this.seed = Math.random() * 10;
    this.step(0, { speed: 0, turn: 0, t: 0 });
  }
  step(dt, m) {
    const o = this.o, R = this.R, seg = this.h / R, t = m.t + this.seed;
    dt = Math.min(dt, 1 / 30);
    for (let j = 1; j <= R; j++) {
      const d = j / R;
      const ta = o.base + d * 0.1 + m.speed * o.lift * d * (1 + 0.25 * Math.sin(t * 7 - j * 0.6)) + o.wind * (0.03 + m.speed * 0.04) * Math.sin(t * 2.3 - j * 0.5) * d;
      const tb = -m.turn * o.swing * d + o.wind * 0.04 * Math.sin(t * 1.6 + j * 0.4) * d;
      const k = 70 * o.stiff * (1 - d * 0.55), c = 7;
      if (dt > 0) { this.va[j] += ((ta - this.a[j]) * k - this.va[j] * c) * dt; this.a[j] += this.va[j] * dt; this.vb[j] += ((tb - this.b[j]) * k * 0.8 - this.vb[j] * c) * dt; this.b[j] += this.vb[j] * dt; }
      else { this.a[j] = ta; this.b[j] = tb; }
      this.a[j] = Math.max(this.a[j], o.base * 0.5);
      this.ys[j] = this.ys[j - 1] - seg * Math.cos(this.a[j]);
      this.zs[j] = this.zs[j - 1] + o.dir * seg * Math.sin(this.a[j]);
      this.xs[j] = this.xs[j - 1] + seg * Math.sin(this.b[j]);
    }
    const p = this.geo.attributes.position, rs = this.rest, sx1 = o.sx + 1;
    for (let i = 0; i < p.count; i++) {
      const j = Math.floor(i / sx1), d = j / R, x0 = rs[i * 3];
      let x = x0 * (1 + d * o.flare), y = this.ys[j];
      if (d > 0.9 && o.jag) y += Math.abs(Math.sin(x0 * 23 + 1.3)) * o.jag * (d - 0.9) * 10;
      if (d > 0.8 && o.tails) y -= Math.max(0, Math.cos(x0 / (this.w / 2) * Math.PI)) * o.tails * (d - 0.8) * 5;
      const z = this.zs[j] - o.dir * x0 * x0 * o.curve * (1 - d * 0.4);
      p.setXYZ(i, x + this.xs[j], y, z);
    }
    p.needsUpdate = true; this.geo.computeVertexNormals();
  }
}
// a chain of beads (a braid, a ponytail, a tassel) on the same springs
class Chain {
  constructor(parent, n, r0, r1, len, mat, o = {}) {
    this.o = { dir: -1, base: 0.35, lift: 0.6, swing: 0.6, ...o };
    this.n = n; this.seg = len / n; this.beads = []; this.a = new Float32Array(n + 1).fill(this.o.base); this.va = new Float32Array(n + 1); this.b = new Float32Array(n + 1); this.vb = new Float32Array(n + 1);
    this.g = new THREE.Group(); parent.add(this.g); this.seed = Math.random() * 10;
    for (let i = 0; i < n; i++) { const r = r0 + (r1 - r0) * i / (n - 1 || 1); const b = mesh(sph(r, 12, 10), mat); b.scale.y = 1.35; this.g.add(b); this.beads.push(b); }
    this.step(0, { speed: 0, turn: 0, t: 0 });
  }
  step(dt, m) {
    const o = this.o, t = m.t + this.seed; dt = Math.min(dt, 1 / 30);
    let y = 0, z = 0, x = 0;
    for (let j = 1; j <= this.n; j++) {
      const d = j / this.n, ta = o.base + m.speed * o.lift * d + 0.04 * Math.sin(t * 2 + j), tb = -m.turn * o.swing * d + 0.05 * Math.sin(t * 1.4 + j * 0.7);
      if (dt > 0) { this.va[j] += ((ta - this.a[j]) * 55 * (1 - d * 0.5) - this.va[j] * 6) * dt; this.a[j] += this.va[j] * dt; this.vb[j] += ((tb - this.b[j]) * 45 - this.vb[j] * 6) * dt; this.b[j] += this.vb[j] * dt; }
      else { this.a[j] = ta; this.b[j] = tb; }
      y -= this.seg * Math.cos(this.a[j]); z += o.dir * this.seg * Math.sin(this.a[j]); x += this.seg * Math.sin(this.b[j]);
      const bd = this.beads[j - 1]; bd.position.set(x, y, z); bd.rotation.x = -o.dir * this.a[j];
    }
  }
}

// ---------------------------------------------------------------- ink
// a thin dark line around each piece: the piece drawn again a hair larger, inside out, in a deep shade of its color
export const INK = { value: 0.0021 };
const INKS = new Map();
function inkMat(c) {
  const k = c.getHexString();
  if (INKS.has(k)) return INKS.get(k);
  const m = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(0.16).lerp(new THREE.Color('#120c08'), 0.55), side: THREE.BackSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.uW = INK;
    sh.vertexShader = 'uniform float uW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      #ifdef USE_SKINNING
        vec3 inkN = objectNormal;
      #else
        vec3 inkN = normal;
      #endif
      mvPosition.xyz += normalize(normalMatrix * inkN) * uW * max(1.0, -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;`);
  };
  m.customProgramCacheKey = () => 'hunter-ink';
  INKS.set(k, m); return m;
}
function ink(root) {
  root.updateMatrixWorld(true);
  const list = [];
  root.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || o.userData.noInk || o.userData.ink || !o.material || o.material.isMeshBasicMaterial || o.material.side === THREE.DoubleSide) return;
    const gp = o.geometry.parameters || {};
    if (o.geometry.type === 'LatheGeometry' && ((gp.points[0].x > 0.01 || gp.points[gp.points.length - 1].x > 0.01) || gp.phiLength < TAU - 0.01)) return;
    if (o.geometry.type === 'SphereGeometry' && (gp.thetaLength < Math.PI - 0.01 || gp.phiLength < TAU - 0.01)) return;
    if (o.geometry.type === 'TorusGeometry' && gp.arc < TAU - 0.01) return;
    o.geometry.computeBoundingSphere();
    const s = o.getWorldScale(new V3()); if (o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z) < 0.035) return;
    list.push(o);
  });
  const inks = [];
  for (const o of list) { const k = new THREE.Mesh(o.geometry, inkMat(o.material.color)); k.userData.ink = true; k.castShadow = false; k.raycast = () => { }; o.add(k); inks.push(k); }
  // the sculpted body: one outline, skinned to the same bones
  const sk = root.userData.skinned;
  if (sk) { const k = new THREE.SkinnedMesh(sk.geometry, inkMat(new THREE.Color('#5a3a28'))); k.frustumCulled = false; k.castShadow = false; k.userData.ink = true; sk.parent.add(k); k.bind(sk.skeleton, sk.bindMatrix); inks.push(k); }
  root.userData.inks = inks;
}
export function setInk(root, on) { for (const k of root.userData.inks || []) k.visible = on; }

// ---------------------------------------------------------------- the body
// o: { skin, leg, boot, torso, arm, fore, hand, slim, tall (boots to the knee), cuff, ears }: one sculpted, skinned body
function rig(o) {
  const root = new THREE.Group();
  const B = sculptBody({ slim: o.slim, tall: o.tall, ears: o.ears, mask: !!o.mask, beard: !!o.beard }, { mask: o.mask, beard: o.beard, skin: o.skin, torso: o.torso, leg: o.leg, shin: o.leg, boot: o.boot, arm: o.arm, fore: o.fore || o.arm, hand: o.hand });
  root.add(B.mesh);
  const S = o.slim ? 0.93 : 1;
  // a cuff where the boot ends
  for (const k of B.knees) { const r = mesh(tor(o.tall ? 0.112 * S : 0.09 * S, 0.022, TAU, 22), o.cuff || o.boot); r.rotation.x = Math.PI / 2; r.position.y = o.tall ? -0.03 : -0.24; k.add(r); }
  root.userData = { body: B.body, legs: B.legs, arms: B.arms, knees: B.knees, elbows: B.elbows, hands: B.hands, head: B.head, skinned: B.mesh, sculpted: true, sims: [], motes: null };
  return root;
}
// a face: eyes with lids that blink and squint, brows, a nose, a mouth
function face(u, o) {
  const head = u.head, skin = o.skin, F = { lids: [], brows: [], blinkT: 2 + Math.random() * 2, blink: 0 };
  for (const s of [-1, 1]) {
    if (o.glowEyes) { const e = new THREE.Mesh(sph(0.042, 12, 8), glow(o.glowEyes, 1.6)); e.position.set(0.095 * s, 0.03, 0.245); e.scale.set(1.4, 0.55, 0.6); e.rotation.z = 0.25 * s; head.add(e); continue; }
    const eg = new THREE.Group(); eg.position.set(0.093 * s, 0.03, 0.238); head.add(eg);
    const w = mesh(sph(0.058, 16, 12), M('gem', '#f6f2ea')); w.scale.set(1, 1.08, 0.55); w.userData.noInk = true; eg.add(w);
    const ir = mesh(sph(0.038, 14, 10), M('gem', o.eye || '#3a2a1c')); ir.position.z = 0.026; ir.scale.z = 0.5; eg.add(ir);
    const pu = new THREE.Mesh(sph(0.018, 10, 8), glow('#0a0606')); pu.position.z = 0.038; pu.scale.z = 0.5; eg.add(pu);
    const gl = new THREE.Mesh(sph(0.009, 6, 5), glow('#ffffff')); gl.position.set(-0.012 * s, 0.016, 0.046); eg.add(gl);
    // the upper lid: a shell of skin over the eye that drops to blink
    const lid = mesh(new THREE.SphereGeometry(0.064, 16, 10, 0, TAU, 0, Math.PI * 0.5), skin); lid.scale.set(1.04, 0.3, 0.62); lid.rotation.x = -0.25; lid.position.y = 0.012; lid.userData.noInk = true; eg.add(lid); F.lids.push(lid);
    const lash = mesh(tor(0.06, 0.008, Math.PI, 14), M('dark', '#1a1210')); lash.scale.set(1.05, 1, 0.6); lash.position.set(0, 0.012, 0.012); lash.userData.noInk = true; eg.add(lash); F.lids.push(lash);
    const bg = new THREE.Group(); bg.position.set(0.095 * s, 0.092, 0.268); head.add(bg); bg.userData.s = s; F.brows.push(bg);
    const br = mesh(limb(0.019, 0.012, 0.11, 8), M('hair', o.brow || '#3a2418')); br.rotation.z = Math.PI / 2 * s; br.position.x = -0.055 * s; br.userData.noInk = true; bg.add(br); bg.rotation.x = -0.2;
    if (u.sculpted) { /* (the ears are part of the head) */ }
    else if (o.ears === 'elf') { const e = mesh(cone(0.06, o.earLen || 0.26, 10), skin); e.position.set(0.33 * s, 0.06, -0.03); e.rotation.set(-0.3, 0, -1.2 * s); e.scale.z = 0.42; head.add(e); }
    else if (o.ears !== 'none') { const e = mesh(sph(0.062, 12, 10), skin); e.position.set(0.262 * s, 0.0, -0.01); e.scale.set(0.45, 1, 0.8); head.add(e); }
  }
  if (!u.sculpted) { const nose = mesh(sph(0.042, 14, 10), skin); nose.position.set(0, -0.035, 0.27); nose.scale.set(0.75, 0.95, 0.85); nose.userData.noInk = true; head.add(nose); }
  const mouth = mesh(tor(0.045, 0.011, Math.PI * 0.7, 12), M('skin', o.lip || '#9a4a3c')); mouth.rotation.z = Math.PI + Math.PI * 0.15; mouth.position.set(0, -0.1, 0.262); mouth.scale.set(1, o.smile ?? 0.5, 0.6); mouth.userData.noInk = true; if (!o.noMouth) head.add(mouth);
  u.face = F;
}
// hair: 'top' (what shows under a hood or hat), 'short', 'long' (strands on springs), 'braid', 'pony'
function hair(u, style, m) {
  const head = u.head;
  if (style === 'none') return;
  const top = mesh(new THREE.SphereGeometry(0.288, 26, 16, 0, TAU, 0, Math.PI * 0.52), m); top.position.y = 0.025; top.rotation.x = -0.28; top.scale.set(1.03, 1.06, 1.03); head.add(top);
  if (style === 'top') return;
  const back = mesh(sph(0.275, 20, 14), m); back.position.set(0, 0.0, -0.07); back.scale.set(1.04, 1.02, 0.92); head.add(back);
  for (const s of [-1, 1]) { const sb = mesh(cone(0.06, 0.18, 8), m); sb.position.set(0.255 * s, -0.08, 0.06); sb.rotation.z = Math.PI; sb.scale.z = 0.6; head.add(sb); }
  if (style === 'long') {
    const hm = M('hair', '#' + m.color.getHexString(), { side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const a = (i / 4 - 0.5) * 1.9, sh = new Sheet(0.17, 0.62 + (2 - Math.abs(i - 2)) * 0.06, hm, { sx: 2, sy: 10, curve: 1.6, flare: 0.1, base: 0.18, lift: 0.9, swing: 0.7, stiff: 0.8 });
      sh.mesh.position.set(Math.sin(a) * 0.22, 0.02, -0.12 + Math.cos(a) * -0.06); sh.mesh.rotation.y = a * 0.55;
      head.add(sh.mesh); u.sims.push(sh);
    }
  }
  if (style === 'braid') { const c = new Chain(head, 8, 0.075, 0.05, 0.62, m, { base: 0.25 }); c.g.position.set(0, -0.08, -0.27); u.sims.push(c); const tie = mesh(tor(0.04, 0.014), M('leather', '#b8442a')); c.beads[7].add(tie); tie.rotation.x = Math.PI / 2; }
  if (style === 'pony') { const c = new Chain(head, 6, 0.085, 0.045, 0.5, m, { base: 0.5 }); c.g.position.set(0, 0.08, -0.29); u.sims.push(c); }
}
// a bow in the left hand: 'recurve' | 'long' | 'bone' | 'dark' | 'wrapped'
function makeBow(u, kind, limbM, gripM, accent) {
  const bow = new THREE.Group(); bow.position.set(0, -0.05, 0.04); u.hands[0].add(bow);
  const L = kind === 'long' ? 0.98 : 0.8;
  const prof = kind === 'recurve' || kind === 'dark' || kind === 'bone'
    ? [[-L, -0.2], [-L * 0.86, -0.07], [-L * 0.6, 0.08], [-L * 0.25, 0.16], [0, 0.18], [L * 0.25, 0.16], [L * 0.6, 0.08], [L * 0.86, -0.07], [L, -0.2]]
    : [[-L, -0.12], [-L * 0.55, 0.08], [0, 0.17], [L * 0.55, 0.08], [L, -0.12]];
  const curve = new THREE.CatmullRomCurve3(prof.map(([y, z]) => new V3(0, y, z)));
  const g = new THREE.TubeGeometry(curve, 40, kind === 'long' ? 0.034 : 0.042, 8);
  { const p = g.attributes.position, c = new V3(); for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 1 - Math.pow(Math.abs(y) / L, 2) * 0.55; c.set(0, y, curve.getPoint(cl(y / (2 * L) + 0.5, 0, 1)).z); p.setX(i, p.getX(i) * k * 0.8); p.setZ(i, c.z + (p.getZ(i) - c.z) * k); } g.computeVertexNormals(); }
  bow.add(mesh(g, limbM));
  const grip = mesh(cyl(0.05, 0.05, 0.22, 12), gripM); grip.position.z = 0.18; bow.add(grip);
  for (const s of [-1, 1]) { const r = mesh(tor(0.05, 0.012), accent); r.rotation.x = Math.PI / 2; r.position.set(0, s * 0.12, 0.18); bow.add(r); }
  if (kind === 'bone') for (const s of [-1, 1]) { const t = mesh(cone(0.05, 0.24, 8), M('gem', '#efe6d2', { roughness: 0.4 })); t.position.set(0, s * (L + 0.04), -0.24); t.rotation.x = s > 0 ? -0.5 : Math.PI + 0.5; bow.add(t); }
  if (kind === 'recurve') for (const s of [-1, 1]) { const t = mesh(sph(0.04, 10, 8), accent); t.position.set(0, s * L, -0.2); bow.add(t); }
  if (kind === 'long') { for (const s of [-1, 1]) { const leaf = mesh(sph(0.08, 12, 8), accent); leaf.scale.set(0.3, 1.8, 0.8); leaf.position.set(0, s * L * 0.62, 0.11); leaf.rotation.x = -s * 0.5; bow.add(leaf); }
    for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(box(0.012, 0.03, 0.01), glow('#5ce6b0', 1.4)); const p = curve.getPoint(0.2 + i * 0.12); r.position.set(0.03, p.y, p.z); bow.add(r); } }
  if (kind === 'wrapped') for (let i = 1; i < 12; i++) { if (i > 4 && i < 8) continue; const p = curve.getPoint(i / 12); const r = mesh(tor(0.046, 0.011, TAU, 10), accent); r.position.copy(p); r.rotation.x = Math.PI / 2 + (i - 6) * 0.08; bow.add(r); }
  if (kind === 'dark') { const edge = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.012, 5), glow(accent.color.getStyle(), 1.4)); edge.position.x = 0.03; bow.add(edge); }
  const sz = prof[0][1];
  const strGeo = new THREE.BufferGeometry().setFromPoints([new V3(0, -L, sz), new V3(0, 0, sz), new V3(0, L, sz)]);
  const string = new THREE.Line(strGeo, new THREE.LineBasicMaterial({ color: kind === 'dark' ? accent.color : '#ece4d0' })); bow.add(string);
  bow.rotation.set(Math.PI / 2, 0, 0);
  // the arrow on the string while drawing (in the right hand)
  const nock = new THREE.Group(); u.hands[1].add(nock); nock.visible = false;
  const shaft = mesh(cyl(0.012, 0.012, 0.95, 6), M('wood', '#c8a070')); shaft.position.y = -0.47; nock.add(shaft);
  const head = mesh(cone(0.03, 0.09, 4), M('metal', '#c8ccd4')); head.position.y = -0.98; head.rotation.x = Math.PI; nock.add(head);
  for (let i = 0; i < 3; i++) { const f = mesh(box(0.004, 0.12, 0.05), M('cloth', u.fletch || '#e8e0d0')); f.position.y = -0.06; f.rotation.y = i / 3 * TAU; f.translateZ(0.025); f.userData.noInk = true; nock.add(f); }
  return { bow, string, stringZ: sz, nock };
}
function quiverOn(u, m, rimM, fletch, x = 0.16, tilt = -0.4) {
  const q = new THREE.Group(); q.position.set(x, 1.2, -0.34); q.rotation.z = tilt; q.rotation.x = 0.15; u.body.add(q);
  q.add(mesh(cyl(0.12, 0.1, 0.72, 16), m));
  for (const y of [-0.3, 0.33]) { const r = mesh(tor(0.122, 0.02, TAU, 20), rimM); r.rotation.x = Math.PI / 2; r.position.y = y; q.add(r); }
  const strapQ = mesh(box(0.035, 0.6, 0.13), rimM); strapQ.position.set(0, 0, 0.02); strapQ.scale.z = 0.9; q.add(strapQ);
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const ar = mesh(cyl(0.011, 0.011, 0.42, 5), M('wood', '#c8a070')); ar.position.set(Math.cos(a) * 0.055, 0.52, Math.sin(a) * 0.055); ar.rotation.z = Math.cos(a) * 0.08; q.add(ar); for (let k = 0; k < 2; k++) { const f = mesh(box(0.006, 0.13, 0.05), M('cloth', fletch)); f.position.set(Math.cos(a) * 0.055, 0.68, Math.sin(a) * 0.055); f.rotation.y = a + k * Math.PI / 2; f.userData.noInk = true; q.add(f); } }
  return q;
}
const across = (u, m, w = 0.07, flip = 1, z = 1) => { const g = new THREE.Group(); for (const zz of [0.265, -0.27]) { const s = mesh(rbox(w, 0.98, 0.035, 0.4), m); s.position.set(0, 1.19, zz * z); s.rotation.z = 0.7 * flip; g.add(s); } u.body.add(g); return g; };
const belt = (u, m, buckle, y = 0.92) => { const b = mesh(cyl(0.305, 0.305, 0.075, 30), m); b.position.y = y; b.scale.z = 0.8; u.body.add(b); const k = mesh(rbox(0.1, 0.08, 0.035, 0.5), buckle); k.position.set(0, y, 0.25); u.body.add(k); };
const pouch = (u, m, x, flap) => { const g = new THREE.Group(); g.position.set(x, 0.85, Math.sqrt(Math.max(0, 0.09 - x * x)) * 0.8 + 0.02); g.rotation.y = x * 1.6; const p = mesh(rbox(0.12, 0.13, 0.08, 0.6), m); g.add(p); const f = mesh(rbox(0.125, 0.05, 0.085, 0.6), flap || m); f.position.y = 0.05; g.add(f); u.body.add(g); };

// ---------------------------------------------------------------- the five
export const LOOKS = [
  { id: 'ranger', name: 'RANGER', blurb: 'A road warden in a hooded cloak and a stitched jerkin, a recurve bow with horn tips.',
    pal: { skin: 1, hair: 2, main: '#3f6a2a', accent: '#a87a3a' } },
  { id: 'huntress', name: 'WILD HUNTRESS', blurb: 'A wolf’s head for a hood, war paint, a bone bow. Hunts what hunts her.',
    pal: { skin: 2, hair: 3, main: '#6a4a32', accent: '#d8c8b0' } },
  { id: 'sentinel', name: 'ELVEN SENTINEL', blurb: 'Leaf pauldrons, a silver circlet, a rune-lit longbow taller than she is.',
    pal: { skin: 0, hair: 5, main: '#2f6b5a', accent: '#c8d4dc' } },
  { id: 'trapper', name: 'TRAPPER', blurb: 'Wide hat, long duster, a bandolier of vials. Knows every snare in the woods.',
    pal: { skin: 3, hair: 1, main: '#7a5a3a', accent: '#b8322a' } },
  { id: 'stalker', name: 'SHADOW STALKER', blurb: 'A deep cowl, a masked face, eyes that glow. You never see it first.',
    pal: { skin: 1, hair: 0, main: '#2a2434', accent: '#8a5cff' } },
];
export const SKINS = ['#f3d2b8', '#eab48a', '#c98a5e', '#9a6440', '#6a4028', '#b8c8a0'];
export const HAIRS = ['#1e1a1c', '#4a2e1c', '#7a4a26', '#b8442a', '#d8b060', '#e8e4dc', '#5a7ab8'];
export const MAINS = ['#3f6a2a', '#2f6b5a', '#6a4a32', '#7a5a3a', '#2a2434', '#3a4a6a', '#6a2a2a', '#5a5a5a'];
export const ACCENTS = ['#a87a3a', '#d8c8b0', '#c8d4dc', '#b8322a', '#8a5cff', '#f0b73c', '#4ac8a0', '#e86a9a'];

export function buildHunterLook(id, pal) {
  const L = LOOKS.find(l => l.id === id) || LOOKS[0];
  pal = { ...L.pal, ...pal };
  const skinC = SKINS[pal.skin] ?? SKINS[1], hairC = HAIRS[pal.hair] ?? HAIRS[1];
  const skin = M('skin', skinC), hairM = M('hair', hairC);
  const main = M('cloth', pal.main), mainD = M('cloth', shade(pal.main, 0.68)), mainCape = M('cloth', pal.main, { side: THREE.DoubleSide });
  const accentC = M('cloth', pal.accent), accentL = M('leather', pal.accent), accentMetal = M('metal', pal.accent);
  const leather = M('leather', '#6a4428'), leatherD = M('leather', '#3e2816'), brass = M('metal', '#c8963c'), steel = M('metal', '#c8ccd4');
  let root, u;
  root = ({ ranger, huntress, sentinel, trapper, stalker })[L.id]();
  Object.assign(root.userData, { weapon: 'bow', look: L.id });
  root.traverse(o => { if (o.isMesh && !o.userData.ink) { o.castShadow = true; o.receiveShadow = true; } });
  ink(root);
  root.scale.setScalar(1.06);
  return root;

  function ranger() {
    root = rig({ skin, leg: M('cloth', '#4a3a28'), boot: leather, torso: mainD, arm: main, fore: leather, hand: leatherD, tall: true, cuff: leatherD }); u = root.userData;
    const { body, head } = u; u.fletch = '#d8d0c0';
    face(u, { skin, brow: hairC, eye: '#4a6a2a', smile: 0.35 }); hair(u, 'top', hairM);
    // the jerkin: leather over the tunic, stitched down the front, laced at the collar
    const jer = mesh(lathe([[0.3, 0.84], [0.315, 0.98], [0.345, 1.16], [0.35, 1.3], [0.32, 1.4]], 30, -1.25, 2.5), leather); jer.scale.set(1.05, 1, 0.8); body.add(jer);
    for (let i = 0; i < 6; i++) { const st = mesh(box(0.008, 0.035, 0.01), accentC); st.position.set(-0.06, 0.92 + i * 0.08, 0.282 - Math.max(0, i - 3) * 0.01); st.userData.noInk = true; body.add(st); const st2 = st.clone(); st2.position.x = 0.06; body.add(st2); }
    for (let i = 0; i < 3; i++) { const lc = mesh(box(0.13, 0.012, 0.012), accentC); lc.position.set(0, 1.26 + i * 0.05, 0.27); lc.rotation.z = (i % 2 ? 1 : -1) * 0.35; lc.userData.noInk = true; body.add(lc); }
    belt(u, leatherD, brass); pouch(u, leather, -0.2, leatherD); pouch(u, leather, 0.22, leatherD);
    across(u, leatherD, 0.06);
    // a knife strapped to the right thigh
    const kn = new THREE.Group(); kn.position.set(0.1, -0.16, 0.02); kn.rotation.z = 0.1; u.legs[1].add(kn);
    kn.add(mesh(rbox(0.06, 0.2, 0.035, 0.5), leatherD)); const hilt = mesh(cyl(0.018, 0.018, 0.09, 8), M('wood', '#5a3a1c')); hilt.position.y = 0.14; kn.add(hilt);
    const sb = mesh(tor(0.14, 0.018, TAU, 20), leatherD); sb.rotation.x = Math.PI / 2; sb.position.y = -0.1; u.legs[1].add(sb);
    // the hood: a cowl with a deep rim, a peak at the back, a drape down the neck
    const hood = mesh(new THREE.SphereGeometry(0.345, 28, 18, 0, TAU, 0, Math.PI * 0.7), mainCape); hood.position.set(0, 0.03, -0.05); hood.rotation.x = -0.72; head.add(hood);
    const rim = mesh(tor(0.31, 0.035, Math.PI * 1.3, 26), mainD); rim.position.set(0, 0.0, 0.06); rim.rotation.set(-0.62, 0, -Math.PI * 0.15); rim.scale.set(1.04, 1.1, 1); head.add(rim);
    const tip = mesh(cone(0.15, 0.4, 14), main); tip.position.set(0, 0.06, -0.33); tip.rotation.x = -2.15; head.add(tip);
    const mantle = mesh(lathe([[0.12, 0.3], [0.24, 0.27], [0.42, 0.1], [0.5, -0.14]], 30), main); mantle.position.y = 1.42; mantle.scale.z = 0.82; body.add(mantle);
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; const d = mesh(cone(0.045, 0.08, 4), main); d.position.set(Math.sin(a) * 0.5, 1.26, Math.cos(a) * 0.41); d.rotation.x = Math.PI; d.userData.noInk = true; body.add(d); }
    const clasp = mesh(rbox(0.07, 0.07, 0.03, 0.6), brass); clasp.position.set(0, 1.62, 0.17); body.add(clasp);
    const cape = new Sheet(0.82, 1.22, mainCape, { jag: 0.05, base: 0.12, lift: 0.75 }); cape.mesh.position.set(0, 1.5, -0.3); body.add(cape.mesh); u.sims.push(cape);
    for (const e of u.elbows) { const br = mesh(cyl(0.093, 0.085, 0.16, 16), accentL); br.position.y = -0.12; e.add(br); for (const y of [-0.06, -0.17]) { const r = mesh(tor(0.09, 0.012), leatherD); r.rotation.x = Math.PI / 2; r.position.y = y; r.userData.noInk = true; e.add(r); } }
    for (const k of u.knees) for (let i = 0; i < 4; i++) { const x = mesh(box(0.16, 0.012, 0.012), leatherD); x.position.set(0, -0.04 - i * 0.06, 0.1); x.rotation.z = (i % 2 ? 1 : -1) * 0.5; x.userData.noInk = true; k.add(x); }
    const quiver = quiverOn(u, leather, leatherD, '#d8d0c0');
    return Object.assign(root, { userData: Object.assign(u, { cape: cape.mesh, quiver, ...makeBow(u, 'recurve', M('wood', '#7a4a22'), leatherD, brass) }) });
  }
  function huntress() {
    const fur = M('fur', pal.accent), furD = M('fur', shade(pal.accent, 0.72)), hide = M('leather', '#7a5638');
    root = rig({ skin, leg: hide, boot: furD, torso: skin, arm: skin, fore: skin, hand: skin, slim: true, cuff: fur }); u = root.userData;
    const { body, head } = u; u.fletch = '#2a2a2a';
    face(u, { skin, brow: hairC, eye: '#6a8a2a', smile: 0.2 }); hair(u, 'braid', hairM);
    // war paint: two stripes under each eye, one down the chin
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const p = new THREE.Mesh(box(0.1, 0.016, 0.01), glow('#20202e')); p.position.set(0.125 * s, -0.035 - i * 0.04, 0.262 - i * 0.005); p.rotation.set(0, 0.42 * s, -0.12 * s); head.add(p); }
    const chin = new THREE.Mesh(box(0.016, 0.07, 0.01), glow('#20202e')); chin.position.set(0, -0.17, 0.235); chin.rotation.x = -0.35; head.add(chin);
    // feathers tied in the hair
    for (const s of [-1, 1]) { const f = mesh(new THREE.SphereGeometry(0.05, 8, 6), M('cloth', s > 0 ? '#e8e0d0' : '#b8442a')); f.scale.set(0.25, 1.6, 0.8); f.position.set(0.24 * s, 0.0, -0.12); f.rotation.z = 0.5 * s; head.add(f); }
    // a hide top and a fur wrap over the chest
    const top = mesh(lathe([[0.29, 1.1], [0.335, 1.2], [0.345, 1.32], [0.3, 1.42]], 30), main); top.scale.set(1.05, 1, 0.8); body.add(top);
    const skirt = mesh(lathe([[0.29, 0.66], [0.3, 0.78], [0.3, 0.9], [0.29, 0.98]], 30), hide); skirt.scale.set(1.05, 1, 0.8); body.add(skirt);
    // the wolf: its head as the hood, its pelt down the back
    const wolf = new THREE.Group(); wolf.position.set(0, 0.2, -0.02); head.add(wolf);
    const crown = mesh(new THREE.SphereGeometry(0.315, 26, 16, 0, TAU, 0, Math.PI * 0.52), furD); crown.rotation.x = -0.22; wolf.add(crown);
    const brow = mesh(rbox(0.36, 0.1, 0.16, 0.7), furD); brow.position.set(0, 0.08, 0.2); wolf.add(brow);
    const snout = mesh(rbox(0.19, 0.13, 0.3, 0.7), furD); snout.position.set(0, 0.07, 0.36); snout.rotation.x = 0.28; wolf.add(snout);
    const muz = mesh(rbox(0.15, 0.08, 0.16, 0.7), fur); muz.position.set(0, 0.02, 0.44); muz.rotation.x = 0.28; wolf.add(muz);
    const nose = mesh(sph(0.04, 10, 8), M('gem', '#1a1414')); nose.position.set(0, 0.07, 0.52); wolf.add(nose);
    for (const s of [-1, 1]) {
      const ear = mesh(cone(0.085, 0.22, 4), furD); ear.position.set(0.17 * s, 0.3, -0.02); ear.rotation.set(-0.15, 0, -0.32 * s); wolf.add(ear);
      const inner = mesh(cone(0.05, 0.15, 4), M('skin', '#d89a8a')); inner.position.set(0.17 * s, 0.29, 0.015); inner.rotation.set(-0.15, 0, -0.32 * s); inner.userData.noInk = true; wolf.add(inner);
      const e = new THREE.Mesh(sph(0.026, 8, 6), glow('#ffd45a', 1.3)); e.position.set(0.1 * s, 0.13, 0.27); e.scale.set(1.3, 0.6, 0.6); wolf.add(e);
      for (let i = 0; i < 3; i++) { const t = mesh(cone(0.016, 0.075, 6), M('gem', '#f0ead8')); t.position.set((0.035 + i * 0.022) * s, -0.04, 0.46 - i * 0.04); t.rotation.x = Math.PI; t.userData.noInk = true; wolf.add(t); }
      const paw = new THREE.Group(); paw.position.set(0.2 * s, 1.52, 0.18); body.add(paw);
      const pl = mesh(limb(0.06, 0.05, 0.26, 10), fur); pl.rotation.x = -0.2; paw.add(pl);
      for (let i = 0; i < 3; i++) { const c = mesh(cone(0.012, 0.05, 5), M('gem', '#f0ead8')); c.position.set((i - 1) * 0.025, -0.3, 0.05); c.rotation.x = Math.PI - 0.4; c.userData.noInk = true; paw.add(c); }
    }
    const pelt = new Sheet(0.72, 1.12, M('fur', shade(pal.accent, 0.85), { side: THREE.DoubleSide }), { jag: 0.12, base: 0.14, lift: 0.65, curve: 1.2 }); pelt.mesh.position.set(0, 1.66, -0.3); body.add(pelt.mesh); u.sims.push(pelt);
    // a ruff of fur over the shoulders, a tooth necklace
    for (let i = 0; i < 20; i++) { const a = (i / 19 - 0.5) * Math.PI * 1.5; const t = mesh(cone(0.075, 0.24, 7), i % 2 ? fur : furD); t.position.set(Math.sin(a) * 0.37, 1.47, Math.cos(a) * 0.25 - 0.06); t.rotation.set(Math.cos(a) * 1.95, 0, -Math.sin(a) * 1.95); t.userData.noInk = true; body.add(t); }
    const cord = mesh(tor(0.17, 0.01, TAU, 24), leatherD); cord.position.set(0, 1.5, 0.05); cord.rotation.x = 1.25; cord.userData.noInk = true; body.add(cord);
    for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.3; const t = mesh(cone(0.02, 0.1, 6), M('gem', '#efe6d2')); t.position.set(Math.sin(a) * 0.17, 1.39 + Math.abs(i - 3) * 0.012, 0.18 + Math.cos(a) * 0.04); t.rotation.x = Math.PI; t.userData.noInk = true; body.add(t); }
    for (const e of u.elbows) for (let i = 0; i < 4; i++) { const r = mesh(tor(0.082, 0.016, TAU, 14), leatherD); r.position.y = -0.04 - i * 0.05; r.rotation.set(Math.PI / 2, 0, 0.3); r.userData.noInk = true; e.add(r); }
    for (const a of u.arms) { const band = mesh(tor(0.1, 0.02), M('metal', '#c8963c')); band.rotation.x = Math.PI / 2; band.position.y = -0.14; band.userData.noInk = true; a.add(band); }
    belt(u, leatherD, M('gem', '#efe6d2'), 0.95);
    for (const z of [1, -1]) { const lc = new Sheet(0.26, 0.42, M('leather', '#6a4a32', { side: THREE.DoubleSide }), { dir: z, sx: 3, sy: 6, curve: 0, flare: 0.1, jag: 0.06, base: 0.02, lift: 0.5, swing: 0.4 }); lc.mesh.position.set(0, 0.92, 0.25 * z); body.add(lc.mesh); u.sims.push(lc); }
    const quiver = quiverOn(u, M('leather', '#6a4a32'), furD, '#2a2a2a', -0.16, 0.4);
    return Object.assign(root, { userData: Object.assign(u, { cape: pelt.mesh, quiver, ...makeBow(u, 'bone', M('gem', '#e6dccb', { roughness: 0.45 }), leatherD, M('leather', '#b8442a')) }) });
  }
  function sentinel() {
    const silver = M('metal', pal.accent), leafC = M('cloth', mix(pal.main, '#7ae0b0', 0.35));
    root = rig({ skin, leg: M('cloth', shade(pal.main, 0.5)), boot: M('leather', '#34343a'), torso: main, arm: mainD, fore: silver, hand: M('leather', '#34343a'), slim: true, tall: true, cuff: silver, ears: 'elf' }); u = root.userData;
    const { body, head } = u; u.fletch = '#e8f4ee';
    face(u, { skin, brow: hairC, eye: '#2a9a7a', ears: 'elf', earLen: 0.28, smile: 0.3 }); hair(u, 'long', hairM);
    const circ = mesh(tor(0.285, 0.014, TAU, 40), silver); circ.position.set(0, 0.1, 0); circ.rotation.x = Math.PI / 2 - 0.25; head.add(circ);
    const setting = mesh(new THREE.OctahedronGeometry(0.045), silver); setting.position.set(0, 0.17, 0.28); setting.scale.set(1, 1.3, 0.5); head.add(setting);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.03), glow('#5ce6b0', 1.5)); gem.position.set(0, 0.17, 0.3); gem.scale.y = 1.3; head.add(gem);
    // a breastplate with filigree and a leaf, a sash, layered leaf pauldrons
    const plate = mesh(lathe([[0.31, 1.0], [0.34, 1.16], [0.35, 1.3], [0.32, 1.42]], 30, -1.15, 2.3), silver); plate.scale.set(1.06, 1, 0.82); body.add(plate);
    for (const s of [-1, 1]) { const f = mesh(tor(0.08, 0.008, Math.PI * 1.2, 16), M('metal', '#e8d8a0')); f.position.set(0.09 * s, 1.24, 0.29); f.rotation.z = s > 0 ? 0.6 : Math.PI - 0.6 + Math.PI * 0.2; f.userData.noInk = true; body.add(f); }
    const leaf = mesh(sph(0.07, 12, 8), M('gem', '#4ac8a0')); leaf.scale.set(0.5, 1.5, 0.3); leaf.position.set(0, 1.26, 0.3); body.add(leaf);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const p = mesh(sph(0.16 - i * 0.022, 16, 10), i % 2 ? silver : leafC); p.scale.set(1.25, 0.32, 0.95); p.position.set(0.4 * s, 1.5 - i * 0.075, 0); p.rotation.z = -0.55 * s; body.add(p); const vein = mesh(box(0.008, 0.008, 0.2), M('metal', '#e8d8a0')); vein.position.copy(p.position).add(new V3(0, 0.04, 0)); vein.rotation.z = -0.55 * s; vein.userData.noInk = true; body.add(vein); }
    const cape = new Sheet(0.8, 1.5, mainCape, { tails: 0.2, base: 0.1, lift: 0.8, flare: 0.32 }); cape.mesh.position.set(0, 1.52, -0.3); body.add(cape.mesh); u.sims.push(cape);
    for (const z of [1, -1]) { const sk = new Sheet(0.4, 0.46, M('cloth', z > 0 ? pal.main : shade(pal.main, 0.8), { side: THREE.DoubleSide }), { dir: z, sx: 4, sy: 6, curve: 1.1, flare: 0.3, base: 0.04, lift: 0.5, tails: z > 0 ? 0.04 : 0 }); sk.mesh.position.set(0, 0.86, 0.22 * z); body.add(sk.mesh); u.sims.push(sk); }
    belt(u, silver, M('gem', '#4ac8a0'), 0.9);
    for (const e of u.elbows) for (let i = 0; i < 2; i++) { const f = mesh(tor(0.08, 0.008, TAU, 16), M('metal', '#e8d8a0')); f.rotation.x = Math.PI / 2; f.position.y = -0.05 - i * 0.14; f.userData.noInk = true; e.add(f); }
    const quiver = quiverOn(u, mainD, silver, '#e8f4ee', 0.12, -0.25);
    return Object.assign(root, { userData: Object.assign(u, { cape: cape.mesh, quiver, ...makeBow(u, 'long', M('wood', '#e8e0cc', { roughness: 0.35 }), M('leather', '#34343a'), silver) }) });
  }
  function trapper() {
    root = rig({ skin, leg: M('cloth', '#4a4038'), boot: leatherD, torso: M('cloth', '#d8c8a8'), arm: main, fore: main, hand: leather, tall: true, beard: hairM }); u = root.userData;
    const { body, head } = u; u.fletch = '#c83a2a';
    face(u, { skin, brow: hairC, eye: '#3a5a7a', smile: 0.15 }); hair(u, 'short', hairM);
    // stubble and a moustache
    for (const s of [-1, 1]) { const mo = mesh(limb(0.022, 0.012, 0.09, 8), hairM); mo.position.set(0.012 * s, -0.07, 0.29); mo.rotation.z = (Math.PI / 2 + 0.35) * s; mo.userData.noInk = true; head.add(mo); }
    // the hat, a band, a feather, goggles on the brim
    const hatM = M('leather', shade(pal.main, 0.85));
    const hat = new THREE.Group(); hat.position.y = 0.2; hat.rotation.x = -0.12; head.add(hat);
    const brim = mesh(lathe([[0.001, 0.02], [0.5, 0.0], [0.52, 0.035], [0.49, 0.03], [0.001, 0.045]], 36), hatM); hat.add(brim);
    { const p = brim.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z); if (r > 0.3) p.setY(i, p.getY(i) + Math.pow(Math.abs(x) / 0.5, 2) * 0.09); } brim.geometry.computeVertexNormals(); }
    const crown = mesh(lathe([[0.27, 0.0], [0.26, 0.18], [0.22, 0.27], [0.001, 0.25]], 30), hatM); hat.add(crown);
    const dent = mesh(box(0.04, 0.04, 0.3), M('leather', shade(pal.main, 0.6))); dent.position.y = 0.26; dent.userData.noInk = true; hat.add(dent);
    const band = mesh(cyl(0.275, 0.272, 0.05, 30), accentC); band.position.y = 0.04; hat.add(band);
    const fth = mesh(sph(0.05, 8, 6), M('cloth', '#e8e0d0')); fth.scale.set(0.25, 2.2, 0.9); fth.position.set(0.24, 0.15, -0.08); fth.rotation.z = -0.7; hat.add(fth);
    for (const s of [-1, 1]) { const g = mesh(tor(0.058, 0.02, TAU, 16), brass); g.position.set(0.075 * s, 0.11, 0.23); g.rotation.x = -0.4; hat.add(g); const l = new THREE.Mesh(new THREE.CircleGeometry(0.048, 16), M('gem', '#7ac8e8', { metalness: 0.3 })); l.position.set(0.075 * s, 0.11, 0.24); l.rotation.x = -0.4; hat.add(l); }
    const gstrap = mesh(tor(0.276, 0.012, TAU, 30), leatherD); gstrap.rotation.x = Math.PI / 2; gstrap.position.y = 0.09; gstrap.userData.noInk = true; hat.add(gstrap);
    // the bandana and its knot, a tail of it blowing back
    const bandana = mesh(cone(0.2, 0.2, 3), accentC); bandana.position.set(0, 1.5, 0.15); bandana.rotation.set(Math.PI + 0.2, 0, 0); bandana.scale.z = 0.4; body.add(bandana);
    const knot = mesh(tor(0.14, 0.04, TAU, 18), accentC); knot.position.y = 1.58; knot.rotation.x = Math.PI / 2; body.add(knot);
    const tail = new Sheet(0.09, 0.4, M('cloth', pal.accent, { side: THREE.DoubleSide }), { sx: 1, sy: 6, curve: 0, base: 0.3, lift: 1.1, swing: 0.8, flare: 0.3 }); tail.mesh.position.set(-0.06, 1.6, -0.15); body.add(tail.mesh); u.sims.push(tail);
    // the duster: a back panel and two front panels, open down the middle, swinging as you walk; a collar
    const coatM = M('leather', pal.main, { side: THREE.DoubleSide, roughness: 0.62 });
    const back = new Sheet(0.86, 1.15, coatM, { sx: 8, sy: 12, curve: 0.75, flare: 0.28, base: 0.08, lift: 0.55, swing: 0.4, jag: 0.02 }); back.mesh.position.set(0, 1.42, -0.27); body.add(back.mesh); u.sims.push(back);
    for (const s of [-1, 1]) { const fr = new Sheet(0.28, 1.0, coatM, { dir: 1, sx: 3, sy: 10, curve: -0.6, flare: 0.25, base: 0.04, lift: 0.3, swing: 0.4 }); fr.mesh.position.set(0.2 * s, 1.3, 0.24); fr.mesh.rotation.y = 0.35 * s; body.add(fr.mesh); u.sims.push(fr); }
    const shoulders = mesh(lathe([[0.12, 0.2], [0.3, 0.12], [0.43, -0.02], [0.44, -0.12]], 30), main); shoulders.position.y = 1.4; shoulders.scale.z = 0.82; body.add(shoulders);
    const collar = mesh(tor(0.2, 0.06, Math.PI * 1.5, 20), mainD); collar.position.set(0, 1.57, -0.02); collar.rotation.set(Math.PI / 2 + 0.35, 0, Math.PI * 0.75); body.add(collar);
    // the bandolier with its vials, a bear trap at the hip, a pack with a bedroll
    across(u, leatherD, 0.09, -1);
    const vials = ['#5ce65c', '#ff6a3a', '#5ab0ff', '#ffd45a'];
    for (let i = 0; i < 4; i++) { const v = mesh(cyl(0.026, 0.026, 0.1, 10), M('gem', vials[i])); v.position.set(-0.2 + i * 0.12, 1.42 - i * 0.115, 0.29); v.rotation.z = -0.7; body.add(v); const cork = mesh(cyl(0.02, 0.02, 0.03, 8), M('wood', '#a87a4a')); cork.position.y = 0.06; v.add(cork); }
    belt(u, leatherD, brass); pouch(u, leather, -0.24, leatherD);
    const trap = new THREE.Group(); trap.position.set(0.3, 0.84, 0.1); trap.rotation.set(0, 1.3, 0.2); body.add(trap);
    trap.add(mesh(tor(0.1, 0.018, TAU, 18), steel)); for (let i = 0; i < 8; i++) { const t = mesh(cone(0.012, 0.04, 4), steel); const a = i / 8 * TAU; t.position.set(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.02); t.rotation.set(Math.PI / 2, 0, 0); t.userData.noInk = true; trap.add(t); }
    const pack = mesh(rbox(0.42, 0.42, 0.22, 0.6), leather); pack.position.set(0, 1.12, -0.36); body.add(pack);
    const roll = mesh(cyl(0.09, 0.09, 0.52, 18), M('cloth', '#8a7a5a')); roll.rotation.z = Math.PI / 2; roll.position.set(0, 1.4, -0.38); body.add(roll);
    for (const x of [-0.15, 0.15]) { const t = mesh(tor(0.095, 0.012, TAU, 14), leatherD); t.rotation.y = Math.PI / 2; t.position.set(x, 1.4, -0.38); t.userData.noInk = true; body.add(t); }
    const quiver = quiverOn(u, leatherD, brass, '#c83a2a', 0.26, -0.55);
    return Object.assign(root, { userData: Object.assign(u, { cape: back.mesh, quiver, ...makeBow(u, 'wrapped', M('wood', '#5a3a1c'), leatherD, accentL) }) });
  }
  function stalker() {
    const dark = M('cloth', pal.main), darker = M('cloth', shade(pal.main, 0.55)), black = M('leather', '#16141a'), glowA = M('gem', pal.accent, { emissive: pal.accent, emissiveIntensity: 1.2 });
    root = rig({ skin, leg: darker, boot: black, torso: dark, arm: darker, fore: dark, hand: black, slim: true, tall: true, cuff: black, ears: 'none', mask: M('cloth', '#26222c') }); u = root.userData;
    const { body, head } = u; u.fletch = pal.accent;
    face(u, { skin, glowEyes: pal.accent, ears: 'none', noMouth: true });
    // the mask over the lower face, the cowl, its shadow
    const cowl = mesh(new THREE.SphereGeometry(0.37, 28, 18, 0, TAU, 0, Math.PI * 0.72), M('cloth', pal.main, { side: THREE.DoubleSide })); cowl.position.set(0, 0.04, -0.08); cowl.rotation.x = -1.0; head.add(cowl);
    const peak = mesh(cone(0.22, 0.3, 14), dark); peak.position.set(0, 0.25, 0.12); peak.rotation.x = 1.05; peak.scale.z = 0.45; head.add(peak);
    const shadow = new THREE.Mesh(sph(0.2, 12, 8), M('dark', '#06040a')); shadow.position.set(0, 0.12, 0.13); shadow.scale.set(1.25, 0.45, 0.55); shadow.userData.noInk = true; head.add(shadow);
    // straps crossing the chest with a rune at the cross, wrapped forearms, a tattered cape, two long scarf tails
    across(u, black, 0.06, 1); across(u, black, 0.06, -1);
    const rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), glow(pal.accent, 1.5)); rune.position.set(0, 1.19, 0.3); body.add(rune);
    for (const e of u.elbows) for (let i = 0; i < 5; i++) { const r = mesh(tor(0.08, 0.013, TAU, 14), M('cloth', '#3a3440')); r.position.y = -0.02 - i * 0.045; r.rotation.set(Math.PI / 2, 0, 0.28); r.userData.noInk = true; e.add(r); }
    const cape = new Sheet(0.88, 1.0, M('cloth', shade(pal.main, 0.8), { side: THREE.DoubleSide }), { jag: 0.16, flare: 0.5, base: 0.12, lift: 0.9 }); cape.mesh.position.set(0, 1.5, -0.3); body.add(cape.mesh); u.sims.push(cape);
    for (const s of [-1, 1]) { const sc = new Sheet(0.1, 0.75 + (s > 0 ? 0.12 : 0), M('cloth', shade(pal.main, 0.45), { side: THREE.DoubleSide }), { sx: 1, sy: 10, curve: 0, base: 0.25, lift: 1.3, swing: 1, flare: 0.25, jag: 0.03 }); sc.mesh.position.set(0.07 * s, 1.6, -0.18); body.add(sc.mesh); u.sims.push(sc); }
    const mantle = mesh(lathe([[0.1, 0.3], [0.22, 0.27], [0.42, 0.06], [0.48, -0.12]], 30), darker); mantle.position.y = 1.42; mantle.scale.z = 0.82; body.add(mantle);
    belt(u, black, glowA);
    for (const s of [-1, 1]) { const d = new THREE.Group(); d.position.set(0.3 * s, 0.86, 0.04); d.rotation.z = 0.5 * s; body.add(d); d.add(mesh(cyl(0.024, 0.024, 0.12, 8), M('leather', '#2a2430'))); const g = mesh(box(0.1, 0.02, 0.03), M('metal', '#4a4458')); g.position.y = -0.06; d.add(g); const bl = mesh(cone(0.035, 0.28, 4), steel); bl.position.y = -0.21; bl.rotation.x = Math.PI; bl.scale.z = 0.3; d.add(bl); }
    // motes of shadow drifting up from the cloak
    const N = 40, pg = new THREE.BufferGeometry(), pp = new Float32Array(N * 3);
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    const motes = new THREE.Points(pg, new THREE.PointsMaterial({ color: pal.accent, size: 0.05, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    motes.userData.seed = Array.from({ length: N }, () => [Math.random() * TAU, 0.25 + Math.random() * 0.3, Math.random()]); motes.frustumCulled = false; body.add(motes); u.motes = motes;
    const quiver = quiverOn(u, darker, glowA, pal.accent, 0.14, -0.3);
    return Object.assign(root, { userData: Object.assign(u, { cape: cape.mesh, quiver, ...makeBow(u, 'dark', M('wood', '#1e1a24', { roughness: 0.35 }), black, glowA) }) });
  }
}

// ---------------------------------------------------------------- motion
// m: { speed (0 still .. 1 walk .. 2 run), turn (radians a second), t, draw (0..1 how far the string is pulled, or -1) }
export function tickHunter(root, dt, m) {
  const u = root.userData;
  for (const s of u.sims) s.step(dt, m);
  const F = u.face;
  if (F) {
    F.blinkT -= dt; if (F.blinkT < 0) { F.blink = 0.16; F.blinkT = 2.2 + Math.random() * 3.5; }
    F.blink = Math.max(0, F.blink - dt);
    const b = F.blink > 0 ? Math.sin(F.blink / 0.16 * Math.PI) : 0, aim = m.draw >= 0 ? Math.min(1, m.draw * 2) : 0;
    F.lids.forEach((l, i) => { const eye = Math.floor(i / 2), squint = eye === 0 ? aim * 0.7 : aim * 0.25; const k = Math.max(b, squint); if (l.geometry.type === 'SphereGeometry') { l.scale.y = 0.3 + k * 0.78; l.rotation.x = -0.25 + k * 0.6; } else l.position.y = 0.012 - k * 0.055; });
    for (const br of F.brows) br.rotation.z = br.userData.s * (-0.18 * aim + 0.06 * Math.sin(m.t * 0.9));
  }
  if (u.motes) {
    const p = u.motes.geometry.attributes.position, S = u.motes.userData.seed;
    for (let i = 0; i < S.length; i++) { const [a, r, o] = S[i], k = (m.t * 0.25 + o) % 1; p.setXYZ(i, Math.cos(a + k * 2) * r * (1 + k), 0.2 + k * 1.6, Math.sin(a + k * 2) * r * 0.8 - 0.25); }
    p.needsUpdate = true; u.motes.material.opacity = 0.7;
  }
}
// the whole body's pose: walk / run cycles with knees and elbows, and the bow draw
export function poseHunter(root, t, m) {
  const u = root.userData, sp = m.speed, run = Math.max(0, sp - 1);
  const ph = t * (8 + run * 4), w = Math.sin(ph) * Math.min(1, sp);
  const swing = 0.6 + run * 0.35;
  u.legs[0].rotation.x = w * swing; u.legs[1].rotation.x = -w * swing;
  u.knees[0].rotation.x = Math.max(0, -Math.sin(ph - 0.9)) * (0.9 + run * 0.6) * Math.min(1, sp) + 0.04;
  u.knees[1].rotation.x = Math.max(0, Math.sin(ph - 0.9)) * (0.9 + run * 0.6) * Math.min(1, sp) + 0.04;
  u.body.position.y = Math.abs(Math.cos(ph)) * (0.05 + run * 0.06) * Math.min(1, sp) + Math.sin(t * 2) * 0.012 * (1 - Math.min(1, sp));
  u.body.rotation.set(run * 0.18, 0, Math.sin(ph) * 0.03 * Math.min(1, sp));
  u.head.rotation.set(-run * 0.12, Math.sin(t * 0.7) * 0.08 * (1 - Math.min(1, sp)), 0);
  const breathe = Math.sin(t * 2) * 0.02;
  u.arms[0].rotation.set(-w * (0.45 + run * 0.4) - 0.12, 0, 0.12 + breathe);
  u.arms[1].rotation.set(w * (0.45 + run * 0.4) - 0.12, 0, -0.12 - breathe);
  u.elbows[0].rotation.set(-0.25 - run * 0.9 - Math.max(0, -w) * 0.3, 0, 0);
  u.elbows[1].rotation.set(-0.25 - run * 0.9 - Math.max(0, w) * 0.3, 0, 0);
  u.arms[1].position.z = 0;
  const pos = u.string.geometry.attributes.position;
  if (m.draw >= 0) {
    const k = m.draw;
    // the bow arm straight out, the drawing elbow out to the side and folding back to the cheek
    const pull = k < 0.6 ? k / 0.6 : Math.max(0, 1 - (k - 0.6) / 0.08);
    u.body.rotation.y = -0.45; u.head.rotation.set(0, 0.42, 0);
    u.arms[0].rotation.set(-1.5, 0.45, 0); u.elbows[0].rotation.set(0, 0, 0);
    u.arms[1].rotation.set(-1.45, -0.15 + pull * 0.35, 0.2 + pull * 0.55);
    u.elbows[1].rotation.set(0, 0, -0.35 - pull * 1.9);
    pos.setZ(1, u.stringZ - pull * 0.42);
    u.nock.visible = k < 0.66;
    if (u.nock.visible) {
      root.updateMatrixWorld(true);
      const grip = u.bow.localToWorld(new V3(0, 0, 0.18)), hp = u.hands[1].getWorldPosition(new V3());
      const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, -1, 0), grip.sub(hp).normalize());
      u.nock.quaternion.copy(u.hands[1].getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
    }
    u.legs[0].rotation.x = -0.25; u.legs[1].rotation.x = 0.25; u.knees[0].rotation.x = 0.12; u.knees[1].rotation.x = 0.2;
  } else { pos.setZ(1, u.stringZ); u.nock.visible = false; }
  pos.needsUpdate = true;
}
