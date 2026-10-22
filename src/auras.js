// the weapon auras: each one its own build, not a recolored cloud of dots.
//   flame     tongues of fire born all over the blade, rising toward the world's up (points with their own size, lean and color)
//   lightning jagged forking bolts with a hot white core and a light-blue glow, an ion haze that flashes with them, sparks
//   water     ribbons of water spiralling round the blade, beads forming on the steel and running down it to fall, splashes
//   wind      helix streaks racing around the blade, with leaves caught in the gust
//   frost     a blizzard of snow whipping round the blade, glinting, with a few ice crystals growing and shattering on it
//   shadow    tongues of black and violet rising off the blade (the black darkens what is behind), purple wisps, motes
//   holy      two counter-rotating rune rings, light rays, golden motes drifting up, a soft halo
// everything lives in the weapon's own frame; the things that care which way the world's up is (embers, drops,
// snow, wisps) read it from the group's world quaternion each frame.
import { THREE } from './engine.js';

// ---------------------------------------------------------------- textures (drawn once, on canvases)
const TX = {};
const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
// a tileable noise: a sum of sines at whole-number frequencies tiles by construction
function noiseTex() {
  if (TX.noise) return TX.noise;
  const S = 128, img = new Uint8ClampedArray(S * S * 4), waves = [];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 10; k++) waves.push([Math.round(1 + rnd() * 4), Math.round(1 + rnd() * 4), rnd() * 6.28, 1 / (k * 0.6 + 1)]);
  let lo = 1e9, hi = -1e9; const v = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let s = 0; for (const [a, b, p, w] of waves) s += Math.sin((a * x + b * y) / S * 6.2832 + p) * w;
    v[y * S + x] = s; if (s < lo) lo = s; if (s > hi) hi = s;
  }
  for (let i = 0; i < S * S; i++) { const g = Math.round((v[i] - lo) / (hi - lo) * 255); img[i * 4] = img[i * 4 + 1] = img[i * 4 + 2] = g; img[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(img, S, S); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return TX.noise = t;
}
const softTex = () => TX.soft || (TX.soft = canvas(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }));
const emberTex = () => TX.ember || (TX.ember = canvas(32, 32, (x, w, h) => { const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.15)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }));
// a four-pointed glint
const glintTex = () => TX.glint || (TX.glint = canvas(64, 64, (x, w, h) => { x.fillStyle = '#fff'; x.translate(32, 32); for (let k = 0; k < 2; k++) { x.beginPath(); x.moveTo(0, -30); x.quadraticCurveTo(2, -2, 30, 0); x.quadraticCurveTo(2, 2, 0, 30); x.quadraticCurveTo(-2, 2, -30, 0); x.quadraticCurveTo(-2, -2, 0, -30); x.fill(); x.rotate(Math.PI / 4); x.scale(0.5, 0.5); } }));
// a drop: round head, a short tail
const dropTex = () => TX.drop || (TX.drop = canvas(32, 32, (x, w, h) => { const g = x.createRadialGradient(16, 20, 0, 16, 20, 9); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(16, 2); x.quadraticCurveTo(26, 18, 16, 29); x.quadraticCurveTo(6, 18, 16, 2); x.fill(); }));
const leafTex = () => TX.leaf || (TX.leaf = canvas(32, 32, (x, w, h) => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(4, 28); x.quadraticCurveTo(4, 6, 28, 4); x.quadraticCurveTo(26, 28, 4, 28); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(5, 27); x.lineTo(26, 6); x.stroke(); }));
// a strip of runes, gold on nothing, to wrap around a ring
const runeTex = () => TX.rune || (TX.rune = canvas(1024, 64, (x, w, h) => {
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  x.strokeStyle = '#fff'; x.lineWidth = 6; x.lineCap = 'round'; x.lineJoin = 'round';
  for (let g = 0; g < 32; g++) {
    const ox = g * 32 + 6, n = 2 + Math.floor(rnd() * 3);
    x.beginPath();
    for (let s = 0; s < n; s++) { const a = [ox + rnd() * 20, 10 + rnd() * 44], b = [ox + rnd() * 20, 10 + rnd() * 44]; x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); if (rnd() < 0.5) x.lineTo(ox + rnd() * 20, 10 + rnd() * 44); }
    x.stroke();
    if (rnd() < 0.4) { x.beginPath(); x.arc(ox + 10, 32, 3 + rnd() * 4, 0, 7); x.stroke(); }
  }
  // a line under them, like a band
  x.lineWidth = 2; x.beginPath(); x.moveTo(0, 60); x.lineTo(w, 60); x.moveTo(0, 4); x.lineTo(w, 4); x.stroke();
}));

// ---------------------------------------------------------------- geometry helpers
// two crossed vertical planes filling the box, with some room above it for things that rise
function crossedPlanes(bx, up = 0, side = 0, centered = false) {
  const [x0, x1, y0, y1, z0, z1] = bx;
  const w = Math.max(x1 - x0, z1 - z0) + side * 2, h = (y1 - y0) + up, cx = centered ? 0 : (x0 + x1) / 2, cz = centered ? 0 : (z0 + z1) / 2, cy = y0 + h / 2;
  const a = new THREE.PlaneGeometry(w, h), b = new THREE.PlaneGeometry(w, h);
  b.rotateY(Math.PI / 2);
  a.translate(cx, cy, cz); b.translate(cx, cy, cz);
  // merge by hand (no addons): 2 planes, 4 verts each
  const pos = new Float32Array(24), uv = new Float32Array(16), nor = new Float32Array(24), idx = [];
  pos.set(a.attributes.position.array, 0); pos.set(b.attributes.position.array, 12);
  uv.set(a.attributes.uv.array, 0); uv.set(b.attributes.uv.array, 8);
  nor.set(a.attributes.normal.array, 0); nor.set(b.attributes.normal.array, 12);
  for (const i of a.index.array) idx.push(i); for (const i of b.index.array) idx.push(i + 4);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(idx);
  return g;
}
// a flat ring in the xz plane with uv.x running around it
function ringGeo(r, w, segs = 48) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const a = i / segs * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    pos.push(c * (r - w / 2), 0, s * (r - w / 2), c * (r + w / 2), 0, s * (r + w / 2));
    uv.push(i / segs * 4, 0, i / segs * 4, 1);
    if (i < segs) { const v = i * 2; idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
// a ribbon along a helix around the box, uv.x along it
// (wild: { amp, freq, ph } lets the radius swell and shrink along the way, so a streak swings out from the blade and back)
function helixGeo(bx, turns, phase, w, segs = 64, rScale = 1, wild = null) {
  const [x0, x1, y0, y1, z0, z1] = bx, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r0 = (Math.max(x1 - x0, z1 - z0) / 2 + 0.07) * rScale;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, a = phase + t * turns * Math.PI * 2, y = y0 - 0.05 + t * (y1 - y0 + 0.1);
    const r = wild ? r0 * (1 + wild.amp * Math.max(0, Math.sin(t * wild.freq * Math.PI * 2 + wild.ph))) : r0;
    const c = Math.cos(a), s = Math.sin(a);
    pos.push(cx + c * r, y - w / 2, cz + s * r, cx + c * r, y + w / 2, cz + s * r);
    uv.push(t, 0, t, 1);
    if (i < segs) { const v = i * 2; idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
// real snowflakes: six arms of thin bars with side branches leaving at 60 degrees, and a hexagonal heart.
//   stellar: arms with two pairs of broad branches. dendrite: arms with many fine branches, each branched again.
//   fern: long arms crowded with fine branches. sectored: a hexagonal plate with six short arms and ridges
function flakeGeo(style) {
  const key = 'flake_' + style; if (TX[key]) return TX[key];
  const pos = [];
  // a bar from (x0,y0) to (x1,y1) of width w, as two triangles
  const bar = (x0, y0, x1, y1, w) => { const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2; pos.push(x0 + nx, y0 + ny, 0, x1 + nx, y1 + ny, 0, x1 - nx, y1 - ny, 0, x0 + nx, y0 + ny, 0, x1 - nx, y1 - ny, 0, x0 - nx, y0 - ny, 0); };
  const hex = r => { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, b = (i + 1) / 6 * Math.PI * 2; pos.push(0, 0, 0, Math.cos(a) * r, Math.sin(a) * r, 0, Math.cos(b) * r, Math.sin(b) * r, 0); } };
  const cfg = {
    stellar: { armW: 0.09, heart: 0.16, branches: [[0.45, 0.32, 0.07], [0.72, 0.22, 0.06]], tip: 0.08, sub: 0 },
    dendrite: { armW: 0.06, heart: 0.1, branches: [[0.25, 0.22, 0.045], [0.42, 0.26, 0.045], [0.58, 0.22, 0.04], [0.74, 0.16, 0.035], [0.88, 0.1, 0.03]], tip: 0, sub: 1 },
    fern: { armW: 0.05, heart: 0.08, branches: [[0.18, 0.2, 0.035], [0.3, 0.24, 0.035], [0.42, 0.26, 0.035], [0.54, 0.24, 0.03], [0.66, 0.2, 0.03], [0.78, 0.15, 0.025], [0.9, 0.09, 0.02]], tip: 0, sub: 1 },
    sectored: { armW: 0.07, heart: 0.42, branches: [[0.62, 0.18, 0.05]], tip: 0.1, sub: 0, plate: true },
  }[style] || { armW: 0.08, heart: 0.14, branches: [[0.5, 0.3, 0.06]], tip: 0.08, sub: 0 };
  hex(cfg.heart);
  if (cfg.plate) { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; bar(0, 0, Math.cos(a) * cfg.heart * 0.95, Math.sin(a) * cfg.heart * 0.95, 0.03); } }
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    bar(0, 0, ca, sa, cfg.armW);
    if (cfg.tip) { for (const s of [-1, 1]) { const b = a + s * Math.PI / 3; bar(ca * 0.92, sa * 0.92, ca * 0.92 + Math.cos(b) * cfg.tip, sa * 0.92 + Math.sin(b) * cfg.tip, cfg.armW * 0.7); } }
    for (const [t, len, w] of cfg.branches) for (const s of [-1, 1]) {
      const b = a + s * Math.PI / 3, bx = ca * t, by = sa * t, ex = bx + Math.cos(b) * len, ey = by + Math.sin(b) * len;
      bar(bx, by, ex, ey, w);
      if (cfg.sub) for (const u of [0.45, 0.8]) for (const s2 of [-1, 1]) { const c = b + s2 * Math.PI / 3, px = bx + (ex - bx) * u, py = by + (ey - by) * u; bar(px, py, px + Math.cos(c) * len * 0.3, py + Math.sin(c) * len * 0.3, w * 0.6); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return TX[key] = g;
}
// a six-pointed ice crystal, flat, with a hexagonal heart
function crystalGeo() {
  if (TX.crystal) return TX.crystal;
  const pts = [];
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = i % 2 ? 0.32 : 1; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  // notches: a tiny hexagon hole in the heart reads as a snowflake's center
  const hole = new THREE.Path(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.26; hole[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 0.14, Math.sin(a) * 0.14); }
  shape.holes.push(hole);
  return TX.crystal = new THREE.ShapeGeometry(shape, 1);
}

// ---------------------------------------------------------------- shader materials
const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// (vFace: 1 when the sheet faces the camera, 0 edge-on; a sheet that fades with it never shows as a line)
const VS_FACE = `varying vec2 vUv; varying float vFace; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal); vFace = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`;
const sheetFaced = (frag, uniforms, blending = THREE.AdditiveBlending) => new THREE.ShaderMaterial({ vertexShader: VS_FACE, fragmentShader: frag, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending });
const sheet = (frag, uniforms, blending = THREE.AdditiveBlending) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: frag, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending });
const FLAME_FS = `
uniform sampler2D tN; uniform float uT, uPow, uAsp; varying vec2 vUv; varying float vFace;
void main(){
  // two layers of noise rising at different speeds, pinched toward the blade's center line, thinning upward
  float n1 = texture2D(tN, vec2(vUv.x * 1.3 * uAsp, vUv.y * 0.7 - uT * 0.9)).r;
  float n2 = texture2D(tN, vec2(vUv.x * 2.6 * uAsp + 0.37, vUv.y * 1.5 - uT * 1.7)).r;
  float n = n1 * 0.6 + n2 * 0.4;
  float cx = abs(vUv.x * 2.0 - 1.0);
  float body = (1.0 - cx * cx) * (1.0 - vUv.y * 0.55);
  float f = body * 1.35 - 0.55 + (n - 0.5) * 1.6 * (0.4 + vUv.y);
  float a = smoothstep(0.0, 0.35, f) * (0.55 + 0.45 * uPow) * min(1.0, uPow) * smoothstep(0.05, 0.6, vFace);
  // heat ramp: white core, yellow, orange, deep red at the tips
  vec3 col = mix(vec3(1.0, 0.95, 0.75), vec3(1.0, 0.75, 0.2), smoothstep(0.9, 0.5, f));
  col = mix(col, vec3(1.0, 0.35, 0.05), smoothstep(0.55, 0.15, f));
  col = mix(col, vec3(0.6, 0.08, 0.02), smoothstep(0.2, 0.0, f));
  gl_FragColor = vec4(col * a * 1.3, a);
}`;
const SMOKE_FS = `
uniform sampler2D tN; uniform float uT, uPow, uAsp; uniform vec3 uCol; varying vec2 vUv;
void main(){
  float n1 = texture2D(tN, vec2(vUv.x * 0.9 * uAsp + uT * 0.05, vUv.y * 0.6 - uT * 0.35)).r;
  float n2 = texture2D(tN, vec2(vUv.x * 1.9 * uAsp - 0.2, vUv.y * 1.1 - uT * 0.6)).r;
  float n = n1 * 0.55 + n2 * 0.45;
  float cx = abs(vUv.x * 2.0 - 1.0);
  float body = (1.0 - cx * cx * 0.7) * (1.0 - vUv.y * 0.6);
  float f = body * 1.2 - 0.5 + (n - 0.5) * 1.7;
  float a = smoothstep(0.0, 0.5, f) * (0.5 + 0.4 * uPow) * min(1.0, uPow);
  // the heart of the smoke goes black; the fringe is the given colour
  vec3 col = mix(uCol, vec3(0.0), smoothstep(0.2, 0.8, f));
  gl_FragColor = vec4(col, a * 0.9);
}`;
const WATER_FS = `
uniform sampler2D tN; uniform float uT, uPow, uAsp; varying vec2 vUv;
void main(){
  float n1 = texture2D(tN, vec2(vUv.x * 2.0 * uAsp + uT * 0.1, vUv.y * 1.6 + uT * 0.55)).r;
  float n2 = texture2D(tN, vec2(vUv.x * 3.5 * uAsp - uT * 0.07, vUv.y * 2.8 + uT * 0.9)).r;
  float n = n1 * 0.55 + n2 * 0.45;
  float cx = abs(vUv.x * 2.0 - 1.0);
  float edge = 1.0 - smoothstep(0.55, 1.0, cx);
  float cap = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
  // ridges of the ripple catch the light as thin bright bands
  float ridge = smoothstep(0.52, 0.6, n) * smoothstep(0.7, 0.62, n);
  float a = edge * cap * (0.25 + 0.45 * smoothstep(0.35, 0.75, n)) * (0.5 + 0.5 * uPow) * min(1.0, uPow);
  // the drops' blue: a deep blue body, a lighter sky blue where it ripples, the ridges a pale blue rather than white
  vec3 col = mix(vec3(0.12, 0.42, 1.0), vec3(0.35, 0.69, 1.0), n) + ridge * vec3(0.45, 0.72, 1.0);
  gl_FragColor = vec4(col * (a + ridge * 0.4), a + ridge * edge * cap * 0.5);
}`;
const RAYS_FS = `
uniform sampler2D tN; uniform float uT, uPow, uAsp; varying vec2 vUv;
void main(){
  // vertical streaks that drift sideways, fading out upward and at the sides
  float n = texture2D(tN, vec2(vUv.x * 4.0 * uAsp + uT * 0.06, 0.2 + uT * 0.02)).r;
  float n2 = texture2D(tN, vec2(vUv.x * 9.0 * uAsp - uT * 0.04, 0.7)).r;
  float ray = smoothstep(0.45, 0.8, n * 0.6 + n2 * 0.4);
  float cx = abs(vUv.x * 2.0 - 1.0);
  float a = ray * (1.0 - cx * cx) * (1.0 - vUv.y * vUv.y) * (0.35 + 0.35 * uPow) * min(1.0, uPow);
  gl_FragColor = vec4(vec3(1.0, 0.9, 0.6) * a, a);
}`;
const HAZE_FS = `
uniform sampler2D tN; uniform float uT, uPow, uAsp, uFlash; varying vec2 vUv;
void main(){
  float n = texture2D(tN, vec2(vUv.x * 2.0 * uAsp + uT * 0.4, vUv.y * 1.5 - uT * 0.9)).r;
  float cx = abs(vUv.x * 2.0 - 1.0);
  float a = (1.0 - cx * cx) * smoothstep(0.3, 0.8, n) * (0.15 + 0.55 * uFlash) * (0.4 + 0.6 * uPow) * min(1.0, uPow);
  gl_FragColor = vec4(vec3(0.5, 0.8, 1.0) * a, a);
}`;
const HELIX_FS = `
uniform float uT, uPow, uPhase; uniform vec3 uCol; varying vec2 vUv;
void main(){
  // streaks racing along the ribbon: a few bright pulses with soft heads and long tails
  float x = vUv.x * 3.0 - uT * 1.6 + uPhase;
  float p = fract(x);
  float streak = smoothstep(0.0, 0.08, p) * smoothstep(0.75, 0.2, p);
  float ey = 1.0 - abs(vUv.y * 2.0 - 1.0);
  float a = streak * ey * (0.6 + 0.5 * uPow) * min(1.0, uPow);
  gl_FragColor = vec4(uCol * a, a);
}`;
const RING_FS = `
uniform sampler2D tR; uniform float uT, uPow; uniform vec3 uCol; varying vec2 vUv;
void main(){
  float r = texture2D(tR, vec2(vUv.x + uT * 0.05, vUv.y)).r;
  float pulse = 0.75 + 0.25 * sin(uT * 3.0 + vUv.x * 12.0);
  float a = r * pulse * (0.6 + 0.4 * uPow) * min(1.0, uPow);
  gl_FragColor = vec4(uCol * a * 2.0, min(1.0, a * 1.6));
}`;

// ---------------------------------------------------------------- flame particles: points with their own size and alpha
// (the tip of each tongue points the way the flames rise as the camera sees it, plus its own small lean)
// (a point's size on screen is its world size in true perspective: the projection's focal length times the
// render's height in pixels, over its distance. whoever renders tells the auras the height: AURA_VIEW.h)
export const AURA_VIEW = { h: 600 };
const FIRE_PTS_VS = `attribute float aSize, aAlpha, aRot; attribute vec3 aColor; uniform vec3 uUpL; uniform float uH; varying vec3 vCol; varying float vA, vR;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * projectionMatrix[1][1] * uH * 0.5 / max(0.5, -mv.z);
  vec3 uv3 = normalize(mat3(modelViewMatrix) * uUpL); float fl = clamp(length(uv3.xy) * 2.0, 0.0, 1.0);
  vCol = aColor; vA = aAlpha; vR = atan(-uv3.x, uv3.y) * fl + aRot; gl_Position = projectionMatrix * mv; }`;
// (each tongue leans its own way: the texture lookup is turned by the point's angle)
const FIRE_PTS_FS = `uniform sampler2D tM; varying vec3 vCol; varying float vA, vR;
void main(){ vec2 c = gl_PointCoord - 0.5; float cs = cos(vR), sn = sin(vR); vec2 q = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs) + 0.5;
  float m = texture2D(tM, q).a; gl_FragColor = vec4(vCol * m * vA, m * vA); }`;
// a tongue of flame: a round base narrowing to a licking point, with a ragged edge, brightest low down
const tongueTex = () => TX.tongue || (TX.tongue = canvas(128, 128, (x, w, h) => {
  x.clearRect(0, 0, w, h);
  // the silhouette: a teardrop, its tip bent a little, with a few notches up the sides
  x.save(); x.translate(64, 0);
  x.beginPath(); x.moveTo(0, 8);
  x.bezierCurveTo(10, 30, 36, 60, 34, 90); x.bezierCurveTo(32, 112, 12, 124, 0, 124); x.bezierCurveTo(-12, 124, -34, 112, -34, 90); x.bezierCurveTo(-36, 62, -14, 34, -6, 20); x.bezierCurveTo(-4, 14, -2, 10, 0, 8);
  x.closePath();
  // soft edge: paint the shape blurred a few times, then its bright heart
  x.shadowColor = '#fff'; x.shadowBlur = 10; x.fillStyle = 'rgba(255,255,255,0.55)'; x.fill(); x.fill();
  x.shadowBlur = 0;
  const g = x.createRadialGradient(0, 96, 4, 0, 84, 50); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fill();
  x.restore();
}));
// a streak: a soft line, bright in the middle, for water running along the blade
const streakTex = () => TX.streak || (TX.streak = canvas(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 1, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(32, 32, 7, 30, 0, 0, 6.3); x.fill(); }));
// a cloud of points with their own size, alpha, color and lean (the flame's shader), for any of these
function pointCloud(g, N, tex, tipDir) {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N), rot = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1)); geo.setAttribute('aRot', new THREE.BufferAttribute(rot, 1));
  const mat = new THREE.ShaderMaterial({ vertexShader: FIRE_PTS_VS, fragmentShader: FIRE_PTS_FS, uniforms: { tM: { value: tex }, uUpL: { value: tipDir || new THREE.Vector3(0, 1, 0) }, uH: { value: AURA_VIEW.h } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  mat.userData.auraPts = true;
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; g.add(pts);
  return { pos, col, size, alpha, rot, geo, mat, pts, N, flush() { for (const k of ['position', 'aColor', 'aSize', 'aAlpha', 'aRot']) geo.attributes[k].needsUpdate = true; } };
}
// ---------------------------------------------------------------- particles (a cloud of points that knows which way is down)
function cloud(g, N, { size, tex, colors, blending = THREE.AdditiveBlending, opacity = 1 }) {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), life = new Float32Array(N), max = new Float32Array(N), vel = new Float32Array(N * 3), ph = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending, opacity, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; g.add(pts);
  const c0 = new THREE.Color(colors[0]), c1 = new THREE.Color(colors[1]), cc = new THREE.Color();
  return { pos, col, life, max, vel, ph, N, geo, mat, c0, c1, cc, pts,
    paint(i, k, fade) { this.cc.copy(this.c0).lerp(this.c1, k).multiplyScalar(Math.max(0, fade)); this.col[i * 3] = this.cc.r; this.col[i * 3 + 1] = this.cc.g; this.col[i * 3 + 2] = this.cc.b; },
    flush() { this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true; } };
}
const rnd = Math.random;
const inBox = (c, i, bx) => { const [x0, x1, y0, y1, z0, z1] = bx; c.pos[i * 3] = x0 + rnd() * (x1 - x0); c.pos[i * 3 + 1] = y0 + rnd() * (y1 - y0); c.pos[i * 3 + 2] = z0 + rnd() * (z1 - z0); };
const jitter = (c, i, s) => { c.vel[i * 3] = (rnd() - 0.5) * s; c.vel[i * 3 + 1] = (rnd() - 0.5) * s; c.vel[i * 3 + 2] = (rnd() - 0.5) * s; };

// ---------------------------------------------------------------- the auras
const upW = new THREE.Vector3(0, 1, 0), qW = new THREE.Quaternion(), upL = new THREE.Vector3();
export function attachAura(g, kind, bx, power = 1, size = 1, speed = 1, extra = {}) {
  power = Math.max(0.05, Math.min(3, power));
  const [x0, x1, y0, y1, z0, z1] = bx, span = Math.max(0.1, y1 - y0), wide = Math.max(x1 - x0, z1 - z0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const build = BUILD[kind];
  if (!build) return () => {};
  const before = new Set(g.children);
  const parts = build(g, bx, power, { span, wide, cx, cz, size: Math.max(0.3, Math.min(3, size)), speed: Math.max(0.05, Math.min(3, speed)), crystal: extra.crystal || 'simple' });
  for (const o of g.children) if (!before.has(o)) o.traverse(c => { c.userData.aura = true; });
  const ptMats = []; g.traverse(o => { if (o.material && o.material.userData && o.material.userData.auraPts) ptMats.push(o.material); });
  let last = -1;
  return t => {
    const dt = last < 0 ? 0.016 : Math.min(0.05, t - last); last = t;
    g.getWorldQuaternion(qW); upL.copy(upW).applyQuaternion(qW.invert());
    for (const m of ptMats) m.uniforms.uH.value = AURA_VIEW.h;
    parts(t, dt, upL);
  };
}

const BUILD = {
  // ---------------------------------------------------------------- FLAME (particles)
  // tongues of flame born all over the blade, rising toward the world's up, swelling then shrinking as they cool from
  // white to yellow to orange to a red that fades out; the same from any side, and they rise off a tilted blade
  flame(g, bx, power, { span, wide, cx, cz }) {
    // one slider for the fire: power runs 0.45 .. 2.95, and the tongues' size runs with it from 0.65 .. 1.55
    const tongue = 0.65 + Math.max(0, Math.min(1, (power - 0.45) / 2.5)) * 0.9;
    const [x0, x1, y0, y1, z0, z1] = bx;
    const N = Math.round((30 + span * 70) * Math.min(2, power));
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N), rot = new Float32Array(N);
    const life = new Float32Array(N), max = new Float32Array(N), vel = new Float32Array(N * 3), base = new Float32Array(N), ph = new Float32Array(N);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1)); geo.setAttribute('aRot', new THREE.BufferAttribute(rot, 1));
    const mat = new THREE.ShaderMaterial({ vertexShader: FIRE_PTS_VS, fragmentShader: FIRE_PTS_FS, uniforms: { tM: { value: tongueTex() }, uUpL: { value: new THREE.Vector3(0, 1, 0) }, uH: { value: AURA_VIEW.h } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    mat.userData.auraPts = true;
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; g.add(pts);
    const rise = 0.9 + power * 0.5, h = 0.25 + span * 0.35 * Math.min(1.5, power);
    const spawn = i => {
      // born on the blade's skin, a few inside it
      const o = i * 3, face = rnd();
      pos[o] = x0 + rnd() * (x1 - x0); pos[o + 1] = y0 + rnd() * (y1 - y0); pos[o + 2] = face < 0.5 ? z0 - 0.01 : z1 + 0.01;
      if (rnd() < 0.3) pos[o] = rnd() < 0.5 ? x0 - 0.01 : x1 + 0.01;
      max[i] = (0.35 + rnd() * 0.4) * (h / 0.6); life[i] = 0;
      vel[o] = (rnd() - 0.5) * 0.25; vel[o + 1] = 0; vel[o + 2] = (rnd() - 0.5) * 0.25;
      base[i] = (0.14 + rnd() * 0.12 + 0.03 * Math.min(1, power)) * tongue; ph[i] = rnd() * 6.28; rot[i] = (rnd() - 0.5) * 0.7;
    };
    for (let i = 0; i < N; i++) { spawn(i); life[i] = rnd() * max[i]; }
    const c = new THREE.Color(), hot = new THREE.Color('#fff6d0'), yel = new THREE.Color('#ffd040'), ora = new THREE.Color('#ff6a10'), red = new THREE.Color('#8a1a04');
    return (t, dt, up) => {
      mat.uniforms.uUpL.value.copy(up);
      for (let i = 0; i < N; i++) {
        life[i] += dt; if (life[i] >= max[i]) spawn(i);
        const k = life[i] / max[i], o = i * 3, sw = Math.sin(t * 7 + ph[i]) * 0.18;
        // up it goes, faster as it heats, swaying a little
        const v = rise * (0.6 + k * 0.8);
        pos[o] += (vel[o] + up.x * v + sw * (1 - Math.abs(up.x))) * dt; pos[o + 1] += (vel[o + 1] + up.y * v) * dt; pos[o + 2] += (vel[o + 2] + up.z * v + sw * (1 - Math.abs(up.z)) * 0.5) * dt;
        // size: swells then shrinks away
        size[i] = base[i] * (0.5 + 1.4 * Math.sin(Math.min(1, k * 1.15) * Math.PI)) * (k > 0.6 ? 1 - (k - 0.6) * 1.5 : 1) * Math.max(0, 1 - Math.max(0, k - 0.85) * 6.6);
        // color: white at birth, yellow, orange, then red and gone
        if (k < 0.2) c.copy(hot).lerp(yel, k / 0.2); else if (k < 0.5) c.copy(yel).lerp(ora, (k - 0.2) / 0.3); else c.copy(ora).lerp(red, (k - 0.5) / 0.5);
        col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
        alpha[i] = Math.min(1, k * 6) * (1 - k * k) * (0.7 + 0.3 * Math.min(1, power));
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aColor.needsUpdate = true; geo.attributes.aSize.needsUpdate = true; geo.attributes.aAlpha.needsUpdate = true;
    };
  },
  // ---------------------------------------------------------------- LIGHTNING
  lightning(g, bx, power, { span, wide, cx, cz }) {
    // thin bolts that strike: each one races from its start to its end in a few hundredths of a second
    // (the forks lighting as the leader passes their joint), holds a beat flickering, then is gone; a pause, the next
    // power doesn't change a bolt's look: it brings more of them, and sooner. above 1, extra strikes run at once
    const slots = Math.max(1, Math.round(1 + Math.max(0, power - 1) * 1.5));
    const bolts = makeBolts(g, slots + 1, 0.7 * Math.min(1, Math.max(0.3, span / 1.1)), true);   // (drawn over the steel)
    const hazeU = { tN: { value: noiseTex() }, uT: { value: 0 }, uPow: { value: 0.35 }, uAsp: { value: 1 }, uFlash: { value: 0 } };
    const haze = new THREE.Mesh(crossedPlanes(bx, 0.06, 0.05), sheet(HAZE_FS, hazeU)); haze.frustumCulled = false; g.add(haze);
    const sparks = cloud(g, Math.round(9 * power), { size: 0.035 + 0.02 * Math.min(1, span), tex: glintTex(), colors: ['#ffffff', '#8ab8ff'] });
    const spawn = i => { inBox(sparks, i, bx); sparks.max[i] = 0.15 + rnd() * 0.25; sparks.life[i] = 0; jitter(sparks, i, 2.6); };
    for (let i = 0; i < sparks.N; i++) { spawn(i); sparks.life[i] = rnd() * sparks.max[i]; }
    // a strike, like the real thing: a stepped leader creeps along in jerks, dim and thin; when it reaches the end the
    // return stroke lights the whole channel at once, brightest of all; then a couple of dimmer re-strikes flicker
    // down the same channel before it goes dark; and a dark gap before the next one (shorter the more power)
    const LEADER = 0.22, STROKE = 0.06, TAIL = 0.3;
    const gap = () => (0.6 + rnd() * 1.2) / (0.5 + 0.5 * Math.min(power, 1)) / (power > 1 ? 1 + (power - 1) * 0.5 : 1);
    const lanes = []; for (let i = 0; i < slots; i++) lanes.push({ strike: null, wait: 0.3 + i * 0.5 + rnd() * 0.5 });
    // a glow around the blade: a column of soft, camera-facing blobs along its length (so it reads the same from any
    // side, with no hard edge), light blue, additive. nothing at the slider's bottom, growing with power, flaring
    // with each stroke. the steel itself only takes a faint blue tint
    const bm = g.userData.bladeMat, e0 = bm && bm.emissive ? bm.emissive.clone() : null, i0 = bm ? bm.emissiveIntensity || 0 : 0, charge = new THREE.Color('#8ec8ff');
    const glows = [], NG = Math.max(3, Math.round(span / 0.12)), gw = wide + 0.3, gh = span / NG * 2.4;
    const glowMat = new THREE.SpriteMaterial({ map: softTex(), color: '#6ab8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < NG; i++) { const sp = new THREE.Sprite(glowMat); sp.position.set(cx, bx[2] + span * (i + 0.5) / NG, cz); sp.scale.set(gw, gh, 1); sp.userData.aura = true; g.add(sp); glows.push(sp); }
    let flash = 0;
    const lines = [];
    return (t, dt) => {
      hazeU.uT.value = t;
      lines.length = 0; let bright = 0;
      if (e0) { const k = Math.min(1, power * 0.12 + flash * 0.3); bm.emissive.copy(e0).lerp(charge, k); bm.emissiveIntensity = Math.max(i0, power * 0.08 + flash * 0.3); }
      glowMat.opacity = Math.min(1, (power <= 1 ? power * 0.22 : 0.22 + (power - 1) * 0.2) * (1 + flash * 1.5));
      for (const lane of lanes) {
        if (!lane.strike && (lane.wait -= dt) <= 0) {
          lane.strike = { ...genBolt(bx, power), age: 0, steps: [], restrikes: [0.08 + rnd() * 0.08, 0.17 + rnd() * 0.1] };
          let k = 0; while (k < 1) { k = Math.min(1, k + 0.08 + rnd() * 0.22); lane.strike.steps.push(k); }
        }
        const S = lane.strike; if (!S) continue;
        S.age += dt;
        const n = S.main.length - 1;
        if (S.age < LEADER) {
          const si = Math.min(S.steps.length - 1, Math.floor(S.age / LEADER * S.steps.length));
          const upto = Math.max(1, Math.round(S.steps[si] * n));
          lines.push({ pts: S.main.slice(0, upto + 1), ws: S.ws.map(w => w * 0.5) });
          for (const f of S.forks) if (f.at <= upto - 1) lines.push({ pts: f.pts, w: 0.3 });
          bright = Math.max(bright, 0.35 + rnd() * 0.1);
        } else {
          const a = S.age - LEADER;
          if (a > STROKE + TAIL) { lane.strike = null; lane.wait = gap(); continue; }
          lines.push({ pts: S.main, ws: S.ws });
          for (const f of S.forks) lines.push({ pts: f.pts, w: 0.6 });
          if (a < STROKE) { bright = Math.max(bright, 1.4); flash = 1; }
          else {
            let b = Math.exp(-(a - STROKE) * 9) * 0.9;
            for (const r of S.restrikes) { const d = a - STROKE - r; if (d >= 0 && d < 0.04) b = Math.max(b, 0.8); }
            bright = Math.max(bright, b);
          }
        }
      }
      bolts.drawLines(lines, bright);
      flash = Math.max(0, flash - dt * 5); hazeU.uFlash.value = Math.max(flash, bright * 0.5);
      const S = sparks;
      for (let i = 0; i < S.N; i++) {
        S.life[i] += dt; if (S.life[i] >= S.max[i]) spawn(i);
        const k = S.life[i] / S.max[i], o = i * 3;
        S.pos[o] += S.vel[o] * dt; S.pos[o + 1] += S.vel[o + 1] * dt; S.pos[o + 2] += S.vel[o + 2] * dt;
        S.paint(i, k, (1 - k) * (1 - k) * (0.5 + flash * 0.8));
      }
      S.flush();
    };
  },
  // ---------------------------------------------------------------- WATER
  // two ribbons of water spiralling round the blade and slowly turning; beads of water forming on the steel, creeping
  // down it, letting go and falling, with a splash where they land
  water(g, bx, power, { span, wide, cx, cz }) {
    const [x0, x1, y0, y1, z0, z1] = bx;
    const ribbons = [];
    for (let i = 0; i < 2; i++) {
      // (lighter: the ribbons run at under half strength, and the second winds the other way and turns the other way)
      const u = { tN: { value: noiseTex() }, uT: { value: 0 }, uPow: { value: power * 0.4 }, uAsp: { value: 4 } };
      const m = new THREE.Mesh(helixGeo(bx, (2.2 + i * 0.4) * (i ? -1 : 1), i * Math.PI, 0.07 + 0.03 * power, 96, 1.1 + i * 0.15), sheet(WATER_FS, u)); m.frustumCulled = false; m.userData.dir = i ? -1 : 1; g.add(m); ribbons.push({ m, u });
    }
    const pivot = new THREE.Vector3(cx, 0, cz);
    const N = Math.round((30 + span * 60) * Math.min(2, power));
    const P = pointCloud(g, N, tongueTex()), life = new Float32Array(N), max = new Float32Array(N), vel = new Float32Array(N * 3), base = new Float32Array(N);
    const spawn = i => { const o = i * 3; P.pos[o] = x0 + rnd() * (x1 - x0); P.pos[o + 1] = y0 + rnd() * (y1 - y0); P.pos[o + 2] = rnd() < 0.5 ? z0 - 0.01 : z1 + 0.01; if (rnd() < 0.3) P.pos[o] = rnd() < 0.5 ? x0 - 0.01 : x1 + 0.01; max[i] = 0.9 + rnd() * 0.9; life[i] = 0; vel[o] = vel[o + 1] = vel[o + 2] = 0; base[i] = 0.035 + rnd() * 0.035; };
    for (let i = 0; i < N; i++) { spawn(i); life[i] = rnd() * max[i]; }
    const rings = [];
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(ringGeo(0.06, 0.03, 20), new THREE.MeshBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.userData.k = 1; m.frustumCulled = false; g.add(m); rings.push(m); }
    const c = new THREE.Color(), pale = new THREE.Color('#e4f6ff'), blue = new THREE.Color('#5ab0ff');
    return (t, dt, up) => {
      for (const r of ribbons) { r.u.uT.value = t; r.m.position.copy(pivot); r.m.rotation.y = t * 1.2 * power * r.m.userData.dir; r.m.position.sub(pivot.clone().applyAxisAngle(upW, r.m.rotation.y)); }
      P.mat.uniforms.uUpL.value.copy(up);   // (a drop's round end is down, its point up)
      for (let i = 0; i < N; i++) {
        life[i] += dt; const k = life[i] / max[i], o = i * 3;
        if (k >= 1) { if (rnd() < 0.5) { const m = rings.find(r => r.userData.k >= 1); if (m) { m.userData.k = 0; m.position.set(P.pos[o], P.pos[o + 1], P.pos[o + 2]); m.quaternion.copy(qW); } } spawn(i); continue; }
        // it beads up, creeps down the steel, then lets go and falls
        const g0 = k < 0.45 ? 0.25 : 7 * (k - 0.45);
        vel[o] -= up.x * g0 * dt; vel[o + 1] -= up.y * g0 * dt; vel[o + 2] -= up.z * g0 * dt;
        P.pos[o] += vel[o] * dt; P.pos[o + 1] += vel[o + 1] * dt; P.pos[o + 2] += vel[o + 2] * dt;
        P.size[i] = base[i] * (0.5 + Math.min(1, k * 3)) * (k > 0.45 ? 1.25 : 1);
        c.copy(pale).lerp(blue, Math.min(1, k * 1.5)); P.col[o] = c.r; P.col[o + 1] = c.g; P.col[o + 2] = c.b;
        P.alpha[i] = Math.min(1, k * 4) * (k > 0.8 ? 1 - (k - 0.8) * 5 : 1) * (0.6 + 0.4 * Math.min(1, power)); P.rot[i] = 0;
      }
      P.flush();
      for (const m of rings) { if (m.userData.k >= 1) { m.material.opacity = 0; continue; } m.userData.k += dt * 2.2; const kk = m.userData.k; m.scale.setScalar(0.5 + kk * 2.5); m.material.opacity = (1 - kk) * 0.6; }
    };
  },
  // ---------------------------------------------------------------- WIND
  wind(g, bx, power, { span, wide, cx, cz, speed }) {
    const streaks = [];
    // (the slider runs 0 .. 1.2: at the top, four big streaks and ten small; down from there, fewer and fainter)
    const n = Math.max(1, Math.round(power * 3.33));
    for (let i = 0; i < n; i++) {
      const u = { uT: { value: 0 }, uPow: { value: power }, uPhase: { value: i / n * 3 }, uCol: { value: new THREE.Color(i % 2 ? '#e8fff6' : '#c8ecff') } };
      const wild = i % 2 ? { amp: 0.8 + rnd() * 1.2, freq: 0.5 + rnd() * 0.7, ph: rnd() * 6.28 } : null;
      const m = new THREE.Mesh(helixGeo(bx, 1.6 + i * 0.3, i / n * Math.PI * 2, (0.05 + 0.015 * power) * 0.7, 72, 1 + i * 0.12, wild), sheet(HELIX_FS, u)); m.frustumCulled = false; g.add(m); streaks.push(m);
    }
    // and a flock of smaller ones, thinner and quicker: half racing up the blade, half racing down
    const small = Math.round(power * 8.3);
    for (let i = 0; i < small; i++) {
      const dir = i % 2 ? -1 : 1;
      const u = { uT: { value: 0 }, uPow: { value: power * 0.8 }, uPhase: { value: rnd() * 3 }, uCol: { value: new THREE.Color(i % 3 ? '#dffff4' : '#eaf6ff') } };
      const wild = rnd() < 0.7 ? { amp: 0.6 + rnd() * 2.4, freq: 0.4 + rnd() * 1.2, ph: rnd() * 6.28 } : null;
      const m = new THREE.Mesh(helixGeo(bx, (1.2 + rnd() * 1.6) * (rnd() < 0.5 ? -1 : 1), rnd() * Math.PI * 2, (0.018 + 0.006 * power) * 0.7, 72, 0.9 + rnd() * 0.5, wild), sheet(HELIX_FS, u)); m.frustumCulled = false; m.userData.dir = dir * (1.3 + rnd() * 0.8); g.add(m); streaks.push(m);
    }
    // a wider, fainter sleeve of air
    const sleeveU = { tN: { value: noiseTex() }, uT: { value: 0 }, uPow: { value: power * 0.5 }, uAsp: { value: 1 }, uFlash: { value: 0.3 } };
    const sleeve = new THREE.Mesh(crossedPlanes(bx, 0.15, 0.12), sheet(HAZE_FS, sleeveU)); sleeve.material.uniforms.uFlash.value = 0.25; sleeve.frustumCulled = false; g.add(sleeve);
    const leaves = cloud(g, Math.round(10 * power), { size: 0.11, tex: leafTex(), colors: ['#8ad66a', '#c8b24a'], blending: THREE.NormalBlending, opacity: 0.95 });
    const spawn = i => { inBox(leaves, i, bx); leaves.max[i] = 1.2 + rnd() * 1.2; leaves.life[i] = 0; leaves.ph[i] = rnd() * 6.28; leaves.vel[i * 3] = 0.3 + rnd() * 0.5; };
    for (let i = 0; i < leaves.N; i++) { spawn(i); leaves.life[i] = rnd() * leaves.max[i]; }
    const r0 = wide / 2 + 0.12, pivot = new THREE.Vector3(cx, (bx[2] + bx[3]) / 2, cz);
    for (const m of streaks) { m.userData.ph = rnd() * 10; m.userData.spd = 1 + rnd() * 0.8; m.userData.flick = rnd() * 6.28; }
    let gust = 1, clock = 0;
    return (t0, dt0) => {
      // (its own clock, so the SPEED slider slows or quickens all of it together)
      const dt = dt0 * speed; clock += dt; const t = clock;
      // it blows in gusts: everything races and brightens, then eases; the whole cloud of streaks sways with it
      gust = 0.55 + 0.45 * Math.max(0, Math.sin(t * 1.3) + 0.5 * Math.sin(t * 3.7) + 0.3 * Math.sin(t * 7.1));
      const swayX = Math.sin(t * 1.1) * 0.12 * gust, swayZ = Math.cos(t * 0.8) * 0.12 * gust;
      for (const m of streaks) {
        const d = m.userData; d.ph += dt * d.spd * (0.6 + 1.2 * gust) * (d.dir || 1);
        m.material.uniforms.uT.value = d.ph;
        // each streak flickers on its own, strongest in a gust
        m.material.uniforms.uPow.value = power * (0.5 + 0.5 * gust) * (0.55 + 0.45 * Math.sin(t * 5 + d.flick));
        m.rotation.set(swayX, 0, swayZ); m.position.copy(pivot).sub(pivot.clone().applyEuler(m.rotation));
      }
      sleeveU.uT.value = t * 3; sleeveU.uFlash.value = 0.15 + 0.3 * gust;
      const L = leaves;
      for (let i = 0; i < L.N; i++) {
        L.life[i] += dt; if (L.life[i] >= L.max[i]) spawn(i);
        const k = L.life[i] / L.max[i], o = i * 3, a = L.ph[i] + t * (5 + L.vel[o] * 3) * (0.5 + gust), r = r0 + 0.1 * Math.sin(t * 3 + L.ph[i]) + k * (0.15 + 0.3 * gust);
        L.pos[o] = cx + Math.cos(a) * r; L.pos[o + 2] = cz + Math.sin(a) * r; L.pos[o + 1] += (0.35 + 0.6 * gust) * dt; if (L.pos[o + 1] > bx[3] + 0.15) L.pos[o + 1] = bx[2];
        L.paint(i, i % 2 ? 1 : 0, Math.sin(k * Math.PI) * 0.9);
      }
      L.flush();
    };
  },
  // ---------------------------------------------------------------- FROST
  // (crystal: the flake's shape. simple: the six-pointed star. stellar, dendrite, fern, sectored: real snowflakes,
  // six arms with branches, see flakeGeo. mixed: every flake its own kind)
  crystals(g, bx, power, { span, wide, cx, cz, crystal = 'simple' }) {
    const [x0, x1, y0, y1, z0, z1] = bx;
    const N = Math.round(14 * power) + 4;
    const flat = true;
    const KINDS = ['stellar', 'dendrite', 'fern', 'sectored'];
    const geoOf = k => k === 'simple' ? crystalGeo() : flakeGeo(k);
    const geo = crystal === 'mixed' ? geoOf(KINDS[0]) : geoOf(crystal);
    const iceMat = new THREE.MeshBasicMaterial({ color: '#eaf8ff', transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false });
    const rimMat = new THREE.MeshBasicMaterial({ color: '#2a78d8', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    // (mixed: four kinds, each its own instanced pair; the flakes are dealt round them)
    const sets = (crystal === 'mixed' ? KINDS : [crystal]).map(k => { const gk = geoOf(k); const ice = new THREE.InstancedMesh(gk, iceMat, N), rim = new THREE.InstancedMesh(gk, rimMat, N); ice.frustumCulled = rim.frustumCulled = false; rim.renderOrder = 1; ice.renderOrder = 2; g.add(rim); g.add(ice); return { ice, rim }; });
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    const ice = sets[0].ice, rim = sets[0].rim;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler();
    const cr = []; // each crystal: where, which way it faces, how big, where in its life
    const seedOne = c => {
      c.p = [x0 + rnd() * (x1 - x0), y0 + rnd() * span, z0 + rnd() * (z1 - z0)]; c.e = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
      c.s = (0.09 + rnd() * 0.1) * (0.7 + 0.3 * power); c.max = 1.6 + rnd() * 2; c.life = 0; c.spin = (rnd() - 0.5) * 0.6;
    };
    for (let i = 0; i < N; i++) { const c = {}; seedOne(c); c.life = rnd() * c.max; cr.push(c); }
    const snow = cloud(g, Math.round(30 * power), { size: 0.05, tex: softTex(), colors: ['#ffffff', '#bfe8ff'] });
    const spawnS = i => { inBox(snow, i, [x0 - 0.1, x1 + 0.1, y0, y1 + 0.1, z0 - 0.1, z1 + 0.1]); snow.max[i] = 1 + rnd() * 1.2; snow.life[i] = 0; snow.ph[i] = rnd() * 6.28; };
    for (let i = 0; i < snow.N; i++) { spawnS(i); snow.life[i] = rnd() * snow.max[i]; }
    const glints = cloud(g, Math.round(8 * power) + 2, { size: 0.12, tex: glintTex(), colors: ['#ffffff', '#ffffff'] });
    for (let i = 0; i < glints.N; i++) { inBox(glints, i, bx); glints.ph[i] = rnd() * 6.28; glints.max[i] = 0.5 + rnd(); }
    const mistU = { tN: { value: noiseTex() }, uT: { value: 0 }, uPow: { value: power * 0.25 }, uAsp: { value: 1 }, uFlash: { value: 0.05 } };
    const mist = new THREE.Mesh(crossedPlanes(bx, 0.05, 0.1), sheet(HAZE_FS, mistU)); mist.frustumCulled = false; g.add(mist);
    return (t, dt, up) => {
      mistU.uT.value = t * 0.3;
      for (let i = 0; i < N; i++) {
        const c = cr[i]; c.life += dt; if (c.life >= c.max) seedOne(c);
        const k = c.life / c.max;
        // grows quickly, holds, then shatters (shrinks fast at the end)
        const grow = k < 0.2 ? k / 0.2 : k > 0.9 ? (1 - k) / 0.1 : 1;
        const s = c.s * grow * (1 + 0.05 * Math.sin(t * 4 + i));
        E.set(c.e[0], c.e[1] + t * c.spin, c.e[2]); Q.setFromEuler(E); P.set(c.p[0], c.p[1], c.p[2]); S.set(s, s, s * 0.3);
        M.compose(P, Q, S);
        const mine = sets[i % sets.length];
        for (const st of sets) { if (st !== mine) { st.ice.setMatrixAt(i, hide); st.rim.setMatrixAt(i, hide); } }
        mine.ice.setMatrixAt(i, M); S.multiplyScalar(1.3); M.compose(P, Q, S); mine.rim.setMatrixAt(i, M);
      }
      for (const st of sets) { st.ice.instanceMatrix.needsUpdate = true; st.rim.instanceMatrix.needsUpdate = true; }
      const SN = snow;
      for (let i = 0; i < SN.N; i++) {
        SN.life[i] += dt; if (SN.life[i] >= SN.max[i]) spawnS(i);
        const k = SN.life[i] / SN.max[i], o = i * 3;
        SN.pos[o] += (Math.sin(t * 2 + SN.ph[i]) * 0.12 - up.x * 0.22) * dt; SN.pos[o + 1] += (-up.y * 0.22) * dt; SN.pos[o + 2] += (Math.cos(t * 2 + SN.ph[i]) * 0.12 - up.z * 0.22) * dt;
        SN.paint(i, k, Math.sin(k * Math.PI) * 0.8);
      }
      SN.flush();
      const G = glints;
      for (let i = 0; i < G.N; i++) { const k = (t * G.max[i] + G.ph[i]) % 1; G.paint(i, 0, Math.max(0, Math.sin(k * Math.PI) ** 6)); }
      G.flush();
    };
  },
  // ---------------------------------------------------------------- FROST: snow whipping round the blade in a cold whirl, thick with flakes, glinting
  frost(g, bx, power, opts) {
    const { span, wide, cx, cz } = opts;
    // (with a little of the frost's crystals and glints underneath it)
    const frostTick = BUILD.crystals(g, bx, 0.2, opts);
    const [x0, x1, y0, y1, z0, z1] = bx, N = Math.round((140 + span * 200) * Math.min(2, power));
    const P = pointCloud(g, N, softTex()), ang = new Float32Array(N), rad = new Float32Array(N), y = new Float32Array(N), w = new Float32Array(N), ph = new Float32Array(N), big = new Float32Array(N);
    const r0 = wide / 2 + 0.05;
    for (let i = 0; i < N; i++) { ang[i] = rnd() * 6.28; rad[i] = r0 + rnd() * rnd() * 0.5; y[i] = y0 - 0.1 + rnd() * (span + 0.2); w[i] = (2 + rnd() * 4) * (rnd() < 0.5 ? 1 : -1); ph[i] = rnd() * 6.28; big[i] = rnd() < 0.15 ? 1 : 0; }
    const glints = cloud(g, Math.round(8 * power) + 2, { size: 0.12, tex: glintTex(), colors: ['#ffffff', '#ffffff'] });
    for (let i = 0; i < glints.N; i++) { inBox(glints, i, bx); glints.ph[i] = rnd() * 6.28; glints.max[i] = 0.5 + rnd(); }
    const c = new THREE.Color(), white = new THREE.Color('#ffffff'), blue = new THREE.Color('#9fd0ff');
    return (t, dt, up) => {
      for (let i = 0; i < N; i++) {
        const o = i * 3;
        ang[i] += w[i] * dt; y[i] += (Math.sin(t * 1.7 + ph[i]) * 0.3 - up.y * 0.15) * dt; if (y[i] < y0 - 0.15) y[i] = y1 + 0.15; if (y[i] > y1 + 0.2) y[i] = y0 - 0.1;
        const r = rad[i] + 0.06 * Math.sin(t * 3 + ph[i]);
        P.pos[o] = cx + Math.cos(ang[i]) * r; P.pos[o + 1] = y[i]; P.pos[o + 2] = cz + Math.sin(ang[i]) * r;
        P.size[i] = big[i] ? 0.12 : 0.05 + 0.02 * Math.sin(t * 5 + ph[i]);
        c.copy(white).lerp(blue, big[i] ? 0.1 : 0.5); P.col[o] = c.r; P.col[o + 1] = c.g; P.col[o + 2] = c.b;
        P.alpha[i] = (0.4 + 0.4 * Math.sin(ang[i] * 3 + ph[i])) * (0.5 + 0.5 * Math.min(1, power)); P.rot[i] = 0;
      }
      P.flush();
      const G = glints;
      for (let i = 0; i < G.N; i++) { const k = (t * G.max[i] + G.ph[i]) % 1; G.paint(i, 0, Math.max(0, Math.sin(k * Math.PI) ** 6)); }
      G.flush();
      frostTick(t, dt, up);
    };
  },
  // ---------------------------------------------------------------- SHADOW
  // ---------------------------------------------------------------- SHADOW
  // like the fire's tongues, rising off the blade: half of them black (darkening what's behind), half violet, with
  // the wisps and motes of the first shadow
  shadow(g, bx, power, { span, wide, cx, cz }) {
    const [x0, x1, y0, y1, z0, z1] = bx;
    // one slider: power runs 0.05 .. 2.9, and the tongues' size runs with it up to 2.05
    const tongue = 0.5 + Math.max(0, Math.min(1, (power - 0.05) / 2.85)) * 1.55;
    const mk = (N, black) => {
      const P = pointCloud(g, N, tongueTex()), life = new Float32Array(N), max = new Float32Array(N), vel = new Float32Array(N * 3), base = new Float32Array(N), rot = new Float32Array(N);
      if (black) { P.mat.blending = THREE.NormalBlending; P.mat.fragmentShader = `uniform sampler2D tM; varying vec3 vCol; varying float vA, vR;
void main(){ vec2 c = gl_PointCoord - 0.5; float cs = cos(vR), sn = sin(vR); vec2 q = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs) + 0.5; float m = texture2D(tM, q).a; gl_FragColor = vec4(vCol, m * vA); }`; P.mat.needsUpdate = true; P.pts.renderOrder = 1; }
      const spawn = i => { const o = i * 3; P.pos[o] = x0 + rnd() * (x1 - x0); P.pos[o + 1] = y0 + rnd() * (y1 - y0); P.pos[o + 2] = rnd() < 0.5 ? z0 - 0.01 : z1 + 0.01; if (rnd() < 0.3) P.pos[o] = rnd() < 0.5 ? x0 - 0.01 : x1 + 0.01; max[i] = 0.5 + rnd() * 0.6; life[i] = 0; vel[o] = (rnd() - 0.5) * 0.25; vel[o + 1] = 0; vel[o + 2] = (rnd() - 0.5) * 0.25; base[i] = (0.14 + rnd() * 0.12) * tongue; rot[i] = (rnd() - 0.5) * 0.7; };
      for (let i = 0; i < N; i++) { spawn(i); life[i] = rnd() * max[i]; }
      return { P, life, max, vel, base, rot, N, black };
    };
    const n = Math.round((20 + span * 40) * Math.min(2, power));
    const clouds = [mk(n, true), mk(n, false)];
    const c = new THREE.Color(), ink = new THREE.Color('#06030c'), ink2 = new THREE.Color('#1a0a2e'), vio = new THREE.Color('#c070ff'), vio2 = new THREE.Color('#4a1090');
    const rise = 0.7 + power * 0.4;
    // the wisps and motes
    const wisps = [];
    for (let i = 0; i < 3; i++) {
      const u = { uT: { value: 0 }, uPow: { value: power }, uPhase: { value: i }, uCol: { value: new THREE.Color('#b060ff') } };
      const m = new THREE.Mesh(helixGeo(bx, 1.2 + i * 0.4, i * 2.1, 0.03, 64, 1.1 + i * 0.15), sheet(HELIX_FS, u)); m.frustumCulled = false; g.add(m); wisps.push(m);
    }
    const motes = cloud(g, Math.round(24 * power), { size: 0.07, tex: softTex(), colors: ['#d08cff', '#5a1aa0'] });
    const spawnM = i => { inBox(motes, i, bx); motes.max[i] = 0.8 + rnd() * 1; motes.life[i] = 0; jitter(motes, i, 0.3); motes.ph[i] = rnd() * 6.28; };
    for (let i = 0; i < motes.N; i++) { spawnM(i); motes.life[i] = rnd() * motes.max[i]; }
    return (t, dt, up) => {
      for (const m of wisps) m.material.uniforms.uT.value = -t * 0.6;
      for (const C of clouds) {
        const { P, life, max, vel, base, rot, N, black } = C;
        P.mat.uniforms.uUpL.value.copy(up);
        for (let i = 0; i < N; i++) {
          life[i] += dt; if (life[i] >= max[i]) { const o = i * 3; P.pos[o] = x0 + rnd() * (x1 - x0); P.pos[o + 1] = y0 + rnd() * (y1 - y0); P.pos[o + 2] = rnd() < 0.5 ? z0 - 0.01 : z1 + 0.01; life[i] = 0; max[i] = 0.5 + rnd() * 0.6; vel[o] = (rnd() - 0.5) * 0.25; vel[o + 2] = (rnd() - 0.5) * 0.25; base[i] = (0.14 + rnd() * 0.12) * tongue; }
          const k = life[i] / max[i], o = i * 3, sw = Math.sin(t * 6 + i) * 0.15, v = rise * (0.6 + k * 0.8);
          P.pos[o] += (vel[o] + up.x * v + sw * (1 - Math.abs(up.x))) * dt; P.pos[o + 1] += up.y * v * dt; P.pos[o + 2] += (vel[o + 2] + up.z * v + sw * 0.5 * (1 - Math.abs(up.z))) * dt;
          P.size[i] = base[i] * (0.5 + 1.4 * Math.sin(Math.min(1, k * 1.15) * Math.PI)) * (k > 0.6 ? 1 - (k - 0.6) * 1.5 : 1) * Math.max(0, 1 - Math.max(0, k - 0.85) * 6.6);
          if (black) c.copy(ink).lerp(ink2, k); else c.copy(vio).lerp(vio2, k);
          P.col[o] = c.r; P.col[o + 1] = c.g; P.col[o + 2] = c.b;
          P.alpha[i] = Math.min(1, k * 6) * (1 - k * k) * (black ? 0.85 : 0.7 + 0.3 * Math.min(1, power)); P.rot[i] = rot[i];
        }
        P.flush();
      }
      const Mo = motes;
      for (let i = 0; i < Mo.N; i++) {
        Mo.life[i] += dt; if (Mo.life[i] >= Mo.max[i]) spawnM(i);
        const k = Mo.life[i] / Mo.max[i], o = i * 3, sw = Math.sin(t * 3 + Mo.ph[i]) * 0.3;
        Mo.pos[o] += (Mo.vel[o] * 0.4 - up.x * 0.35 * k + sw * 0.2) * dt; Mo.pos[o + 1] += (Mo.vel[o + 1] * 0.4 - up.y * 0.35 * k) * dt; Mo.pos[o + 2] += (Mo.vel[o + 2] * 0.4 - up.z * 0.35 * k + sw * 0.2) * dt;
        Mo.paint(i, k, Math.sin(k * Math.PI) * 0.9);
      }
      Mo.flush();
    };
  },
  // ---------------------------------------------------------------- HOLY
  holy(g, bx, power, { span, wide, cx, cz }) {
    const [x0, x1, y0, y1, z0, z1] = bx;
    const r = wide / 2 + 0.1 + 0.04 * power;
    const rings = [];
    for (let i = 0; i < 2; i++) {
      const u = { tR: { value: runeTex() }, uT: { value: 0 }, uPow: { value: power }, uCol: { value: new THREE.Color(i ? '#ffe9a0' : '#ffffff') } };
      const m = new THREE.Mesh(ringGeo(r * (1 + i * 0.3), 0.09 + 0.03 * power, 48), sheet(RING_FS, u)); m.frustumCulled = false; m.position.set(cx, y0 + span * (i ? 0.25 : 0.72), cz); m.rotation.x = i ? -0.3 : 0.25; g.add(m); rings.push(m);
    }
    const raysU = { tN: { value: noiseTex() }, uT: { value: 0 }, uPow: { value: power }, uAsp: { value: 1 } };
    const rays = new THREE.Mesh(crossedPlanes(bx, 0.3 + 0.3 * power, 0.12 + 0.08 * power), sheet(RAYS_FS, raysU)); rays.frustumCulled = false; g.add(rays);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: '#ffcf70', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.25 + 0.15 * power }));
    halo.position.set(cx, y0 + span / 2, cz); halo.scale.set(wide + 0.6, span + 0.6, 1); g.add(halo);
    const motes = cloud(g, Math.round(26 * power), { size: 0.06, tex: glintTex(), colors: ['#ffffff', '#ffc040'] });
    const spawn = i => { inBox(motes, i, [x0 - 0.1, x1 + 0.1, y0 - 0.05, y1, z0 - 0.1, z1 + 0.1]); motes.max[i] = 1.2 + rnd() * 1.2; motes.life[i] = 0; motes.ph[i] = rnd() * 6.28; };
    for (let i = 0; i < motes.N; i++) { spawn(i); motes.life[i] = rnd() * motes.max[i]; }
    return (t, dt, up) => {
      rings[0].material.uniforms.uT.value = t; rings[1].material.uniforms.uT.value = -t * 0.8;
      rings[0].rotation.y = t * 0.6; rings[1].rotation.y = -t * 0.45;
      raysU.uT.value = t;
      halo.material.opacity = (0.25 + 0.15 * power) * (0.85 + 0.15 * Math.sin(t * 2));
      const Mo = motes;
      for (let i = 0; i < Mo.N; i++) {
        Mo.life[i] += dt; if (Mo.life[i] >= Mo.max[i]) spawn(i);
        const k = Mo.life[i] / Mo.max[i], o = i * 3;
        Mo.pos[o] += (up.x * 0.18 + Math.sin(t * 2 + Mo.ph[i]) * 0.05) * dt; Mo.pos[o + 1] += up.y * 0.18 * dt; Mo.pos[o + 2] += (up.z * 0.18 + Math.cos(t * 2 + Mo.ph[i]) * 0.05) * dt;
        Mo.paint(i, k, Math.sin(k * Math.PI) * (0.5 + 0.5 * Math.max(0, Math.sin(t * 5 + Mo.ph[i]))));
      }
      Mo.flush();
    };
  },
};

// ---------------------------------------------------------------- bolts
// n jagged paths of up to 9 segments plus forks branching off them; each segment two crossed quads;
// a thin hot core, a violet glow around it
function makeBolts(g, n, sc = 1, overSteel = false) {
  const SEG = 9, FORK = 4, Q = n * (SEG + FORK * 3) * 2;   // (quads: two per segment, one for each crossed strip)
  const make = (w, color, opacity) => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(Q * 4 * 3), idx = new Uint16Array(Q * 6);
    for (let q = 0; q < Q; q++) { const v = q * 4, o = q * 6; idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v; idx[o + 4] = v + 2; idx[o + 5] = v + 3; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
    // (over the steel: each vertex is pulled a hair toward the camera, so the blade's own surface doesn't hide the
    // bolt, but a body in front of the blade still does)
    const mat = overSteel
      ? new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(color) }, uO: { value: opacity } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
          vertexShader: `void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); mv.xyz -= normalize(mv.xyz) * 0.12; gl_Position = projectionMatrix * mv; }`,
          fragmentShader: `uniform vec3 uCol; uniform float uO; void main(){ gl_FragColor = vec4(uCol * uO, uO); }` })
      : new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    if (overSteel) { m.renderOrder = 5; Object.defineProperty(mat, 'opacity', { get() { return mat.uniforms.uO.value; }, set(v) { mat.uniforms.uO.value = v; } }); }
    m.frustumCulled = false; g.add(m);
    return { m, pos, w };
  };
  const core = make(0.012 * sc, '#ffffff', 1), mid = make(0.026 * sc, '#c8ecff', 0.5), glow = make(0.06 * sc, '#4aa8ff', 0.22);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3(), U = new THREE.Vector3(), V = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
  function seg(layer, q, a, b, wk = 1) {
    A.copy(a); B.copy(b); D.subVectors(B, A).normalize();
    const w = layer.w * wk;
    U.crossVectors(D, Math.abs(D.z) < 0.9 ? Z : X).normalize().multiplyScalar(w); V.crossVectors(D, U).normalize().multiplyScalar(w);
    const P = layer.pos; let o = q * 24;
    const put = (p, off, sgn) => { P[o++] = p.x + off.x * sgn; P[o++] = p.y + off.y * sgn; P[o++] = p.z + off.z * sgn; };
    put(A, U, 1); put(B, U, 1); put(B, U, -1); put(A, U, -1);
    put(A, V, 1); put(B, V, 1); put(B, V, -1); put(A, V, -1);
  }
  const pts = [], tmp = new THREE.Vector3();
  return { n, draw(count, bx, power) {
    const [x0, x1, y0, y1, z0, z1] = bx, wx = x1 - x0, wz = z1 - z0, span = y1 - y0;
    core.pos.fill(0); mid.pos.fill(0); glow.pos.fill(0);
    let q = 0;
    const put = (a, b, wk) => { seg(core, q, a, b, wk); seg(mid, q, a, b, wk); seg(glow, q, a, b, wk); q += 2; };
    for (let b = 0; b < count; b++) {
      // along the blade: from somewhere low to somewhere high, jittering across it; now and then it arcs
      // out to the side and comes back; forks split off two or three of its joints
      pts.length = 0;
      const ya = y0 + rnd() * span * 0.4, yb = Math.min(y1 + 0.08, ya + span * (0.35 + rnd() * 0.6));
      const arcAt = rnd() < 0.6 ? 2 + Math.floor(rnd() * 5) : -1, arcDir = rnd() < 0.5 ? -1 : 1, arcR = 0.14 + rnd() * 0.24 * (0.5 + power * 0.5);
      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG;
        // on the surface of the head, not inside it (a hammer's head would hide them)
        let x = x0 + rnd() * wx, z = z0 + rnd() * wz;
        if (rnd() < 0.5) x = (rnd() < 0.5 ? x0 - 0.02 : x1 + 0.02); else z = (rnd() < 0.5 ? z0 - 0.02 : z1 + 0.02);
        if (arcAt >= 0 && Math.abs(i - arcAt) <= 1) { const k = 1 - Math.abs(i - arcAt) * 0.5; x += arcDir * arcR * k; z += (rnd() - 0.5) * 0.12 * k; }
        pts.push(new THREE.Vector3(x, ya + (yb - ya) * t, z));
      }
      for (let i = 0; i < SEG; i++) put(pts[i], pts[i + 1], 1);
      // forks: shorter, thinner branches leaving a joint and wandering off sideways
      const nf = 1 + Math.floor(rnd() * FORK);
      for (let f = 0; f < nf; f++) {
        const j = 1 + Math.floor(rnd() * (SEG - 1)); let a = pts[j].clone();
        const dx = (rnd() - 0.5) * 0.5, dz = (rnd() - 0.5) * 0.5, dy = (rnd() - 0.3) * 0.3;
        const len = 2 + Math.floor(rnd() * 2);
        for (let s = 0; s < len; s++) { tmp.set(a.x + dx * (0.4 + rnd() * 0.6) * 0.5, a.y + dy * 0.5 + (rnd() - 0.5) * 0.08, a.z + dz * (0.4 + rnd() * 0.6) * 0.5); put(a, tmp, 0.6 - s * 0.15); a = tmp.clone(); }
      }
    }
    core.m.geometry.attributes.position.needsUpdate = true; mid.m.geometry.attributes.position.needsUpdate = true; glow.m.geometry.attributes.position.needsUpdate = true;
    const k = Math.min(1, 0.5 + power * 0.5);
    core.m.material.opacity = (0.7 + rnd() * 0.3) * k; mid.m.material.opacity = (0.4 + rnd() * 0.3) * k; glow.m.material.opacity = (0.25 + rnd() * 0.2) * k;
  },
  // any polylines at all: [{ pts: [Vector3...], w }] (w scales the width; or ws, one width per segment), drawn on the same three layers
  drawLines(lines, bright = 1) {
    core.pos.fill(0); mid.pos.fill(0); glow.pos.fill(0);
    let q = 0;
    for (const L of lines) for (let i = 0; i + 1 < L.pts.length && q + 2 <= Q; i++) { const wk = L.ws ? L.ws[i] : (L.w || 1); seg(core, q, L.pts[i], L.pts[i + 1], wk); seg(mid, q, L.pts[i], L.pts[i + 1], wk); seg(glow, q, L.pts[i], L.pts[i + 1], wk); q += 2; }
    core.m.geometry.attributes.position.needsUpdate = true; mid.m.geometry.attributes.position.needsUpdate = true; glow.m.geometry.attributes.position.needsUpdate = true;
    core.m.material.opacity = 0.95 * bright; mid.m.material.opacity = 0.55 * bright; glow.m.material.opacity = 0.3 * bright;
  } };
}
// one bolt's shape, kept as data: the main line low to high along the head's skin (arcing out now and then)
// and its forks, each noting which joint it leaves from
function genBolt(bx, power, extraForks = 0) {
  const SEG = 9, [x0, x1, y0, y1, z0, z1] = bx, wx = x1 - x0, wz = z1 - z0, span = y1 - y0;
  // (the bolt runs in the blade's middle plane and is drawn over the steel, never hidden by it, so one channel
  // reads the same from either side and edge-on)
  const main = [], zc = (z0 + z1) / 2, zf = zc;
  const ya = y0 + rnd() * span * 0.4, yb = Math.min(y1 + 0.08, ya + span * (0.35 + rnd() * 0.6));
  const arcAt = rnd() < 0.6 ? 2 + Math.floor(rnd() * 5) : -1, arcDir = rnd() < 0.5 ? -1 : 1, arcR = 0.14 + rnd() * 0.24 * (0.5 + power * 0.5);
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    let x = x0 - 0.02 + rnd() * (wx + 0.04), z = zf + (rnd() - 0.5) * 0.02;
    if (arcAt >= 0 && Math.abs(i - arcAt) <= 1) { const k = 1 - Math.abs(i - arcAt) * 0.5; x += arcDir * arcR * k; }
    main.push(new THREE.Vector3(x, ya + (yb - ya) * t, z));
  }
  const forks = [], nf = 1 + Math.floor(rnd() * 2) + extraForks;
  for (let f = 0; f < nf; f++) {
    const j = 1 + Math.floor(rnd() * (SEG - 1)); let a = main[j].clone(); const pts = [a];
    const dx = (rnd() - 0.5) * 0.5, dy = (rnd() - 0.3) * 0.3, len = 2 + Math.floor(rnd() * 2);
    for (let s = 0; s < len; s++) { a = new THREE.Vector3(a.x + dx * (0.4 + rnd() * 0.6) * 0.5, a.y + dy * 0.5 + (rnd() - 0.5) * 0.08, a.z + (rnd() - 0.5) * 0.01); pts.push(a); }
    forks.push({ at: j, pts });
  }
  const ws = []; for (let i = 0; i < SEG; i++) ws.push(1.1 - 0.65 * (i / (SEG - 1)));
  return { main, forks, ws };
}
