// ============================================================================
//  DUNGEON WORLD  -  fx: bursts of sparks, rings on the ground and floating
//  damage numbers, in Dungeon Heart's style (view.js's burst and ring).
// ============================================================================
import { THREE, scene, camera, TEX, TAU, view } from './engine.js';

const partMats = {};
function partMat(color, add) {
  const k = color + (add ? 'a' : 'n');
  return partMats[k] || (partMats[k] = new THREE.SpriteMaterial({ map: TEX.soft, color, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
}
const parts = [];
export function burst(x, y, z, color, n = 10, spd = 5, size = 0.9, add = false, life = 0.6, grav = 6) {
  const cap = view.quality >= 2 ? 500 : 220;
  for (let i = 0; i < n && parts.length < cap; i++) {
    const m = partMat(color, add).clone();
    const s = new THREE.Sprite(m); s.position.set(x, y, z);
    const a = Math.random() * TAU, v = spd * (0.4 + Math.random());
    parts.push({ s, vx: Math.cos(a) * v, vy: Math.random() * spd * 0.8, vz: Math.sin(a) * v, t: 0, life: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8), grav, floor: y - 1.5 });
    scene.add(s);
  }
}
const rings = [];
export function ring(x, y, z, color, r0 = 0.5, r1 = 6, life = 0.5) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); scene.add(m);
  rings.push({ m, r0, r1, life, t: 0 });
}
// a sweep of the blade: a flat crescent on the ground around (x, z), facing dir (dx, dz), as wide as the swing reaches
// and as far round as it cuts (arc, radians; a whole turn for the whirlwind, which spins as it fades)
const slashes = [];
export function slash(x, y, z, dx, dz, radius, arc, color = '#ffe0a0', life = 0.32, spin = 0) {
  const c = Math.atan2(-dz, dx), mk = (r0, r1, op) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48, 1, c - arc / 2, arc), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); scene.add(m); return m; };
  const body = mk(radius * 0.25, radius, 0.32), edge = mk(radius * 0.93, radius * 1.02, 0.9);
  slashes.push({ ms: [body, edge], ops: [0.32, 0.9], t: 0, life, spin, cx: x, cz: z });
}
// floating numbers over the world (Dungeon Heart's .num)
const nums = [];
let numBox = null;
export function number(x, y, z, text, cls = '') {
  if (!numBox) numBox = document.getElementById('nums');
  if (!numBox || nums.length > 40) return;
  const el = document.createElement('div');
  el.className = 'num ' + cls; el.textContent = text; numBox.appendChild(el);
  nums.push({ el, p: new THREE.Vector3(x, y, z), t: 0, life: 0.9, vy: 4.4 });
}
const pv = new THREE.Vector3();
export function stepFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt;
    const k = p.t / p.life;
    if (k >= 1) { scene.remove(p.s); p.s.material.dispose(); parts.splice(i, 1); continue; }
    p.vy -= p.grav * dt;
    p.s.position.x += p.vx * dt; p.s.position.y = Math.max(p.floor, p.s.position.y + p.vy * dt); p.s.position.z += p.vz * dt;
    p.s.scale.setScalar(p.size * (1 + k)); p.s.material.opacity = 1 - k;
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.t += dt; const k = r.t / r.life;
    if (k >= 1) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); rings.splice(i, 1); continue; }
    const s = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k)); r.m.scale.set(s, s, s); r.m.material.opacity = 0.9 * (1 - k);
  }
  for (let i = slashes.length - 1; i >= 0; i--) {
    const S = slashes[i]; S.t += dt; const k = S.t / S.life;
    if (k >= 1) { for (const m of S.ms) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } slashes.splice(i, 1); continue; }
    const g = 0.75 + 0.25 * (1 - (1 - Math.min(1, k * 2.5)) ** 2);
    S.ms.forEach((m, j) => { m.scale.set(g, g, 1); m.material.opacity = S.ops[j] * (1 - k * k); if (S.spin) m.rotation.z += S.spin * dt; });
  }
  for (let i = nums.length - 1; i >= 0; i--) {
    const n = nums[i]; n.t += dt;
    const k = n.t / n.life;
    if (k >= 1) { n.el.remove(); nums.splice(i, 1); continue; }
    n.p.y += n.vy * dt; n.vy -= 6 * dt;
    pv.copy(n.p).project(camera);
    if (pv.z > 1) { n.el.style.display = 'none'; continue; }
    n.el.style.display = '';
    n.el.style.left = ((pv.x + 1) / 2 * view.w) + 'px'; n.el.style.top = ((1 - pv.y) / 2 * view.h) + 'px';
    n.el.style.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
  }
}
