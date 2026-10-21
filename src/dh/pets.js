// ============================================================================
//  DUNGEON HEART  -  pets: the hunter's tamed slime, bat and spider, cuter and
//  friendlier than the wild ones: big shiny eyes, a smile, a red bandana.
// ============================================================================
import { THREE, std, mesh, sph, TAU, V3 } from './engine.js';

const cap = (r, l, s = 8) => new THREE.CapsuleGeometry(r, l, 4, s);
const white = () => std({ color: '#ffffff', roughness: 0.15 });
const pupil = () => std({ color: '#1a1420', roughness: 0.1 });
const shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });
// big cartoon eyes on a face pointing +z
function cuteEyes(parent, x, y, z, r) {
  for (const s of [-1, 1]) {
    const e = mesh(sph(r, 14, 10), white(), false); e.position.set(x * s, y, z); e.scale.z = 0.55; parent.add(e);
    const p = mesh(sph(r * 0.62, 12, 8), pupil(), false); p.position.set(x * s, y - r * 0.08, z + r * 0.32); p.scale.z = 0.5; parent.add(p);
    const h = new THREE.Mesh(sph(r * 0.22, 8, 6), shine); h.position.set(x * s + r * 0.25, y + r * 0.28, z + r * 0.5); parent.add(h);
  }
}
function smile(parent, y, z, r, col = '#5a1a2a') {
  const m = mesh(new THREE.TorusGeometry(r, r * 0.22, 6, 12, Math.PI), std({ color: col, roughness: 0.5 }), false); m.position.set(0, y, z); m.rotation.z = Math.PI; parent.add(m);
}
function blush(parent, x, y, z, r) {
  for (const s of [-1, 1]) { const b = new THREE.Mesh(sph(r, 10, 6), new THREE.MeshBasicMaterial({ color: '#ff8aa0', transparent: true, opacity: 0.55 })); b.position.set(x * s, y, z); b.scale.z = 0.3; parent.add(b); }
}
// a red bandana tied round the neck (the sign it's yours)
function bandana(parent, y, r, z0 = 0) {
  const red = std({ color: '#d0302a', roughness: 0.6, side: THREE.DoubleSide });
  const band = mesh(new THREE.TorusGeometry(r, r * 0.12, 8, 24), red); band.rotation.x = Math.PI / 2; band.position.set(0, y, z0); parent.add(band);
  const tri = new THREE.Shape(); tri.moveTo(-r * 0.55, 0); tri.lineTo(r * 0.55, 0); tri.lineTo(0, -r * 0.75);
  const flap = mesh(new THREE.ShapeGeometry(tri), red); flap.position.set(0, y, z0 + r * 1.02); flap.rotation.x = 0.25; parent.add(flap);
  for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(sph(r * 0.06, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })); d.position.set((i - 1.5) * r * 0.22, y - r * 0.18 - (i & 1) * r * 0.15, z0 + r * 1.06); parent.add(d); }
}

export function buildPet(type) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  let anim;
  if (type === 1) { // the slime: a glossy blob with a leaf sprout
    const m = new THREE.MeshPhysicalMaterial({ color: '#3cc08a', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2, emissive: '#0e4a30', emissiveIntensity: 0.15, envMapIntensity: 0.5 });
    const blob = mesh(sph(0.9, 32, 24), m); blob.scale.set(1.15, 0.85, 1.1); blob.position.y = 0.78; body.add(blob);
    const hl = new THREE.Mesh(sph(0.2, 12, 8), new THREE.MeshBasicMaterial({ color: '#f0fff8', transparent: true, opacity: 0.55 })); hl.position.set(-0.4, 1.3, 0.35); hl.scale.set(1, 0.45, 0.7); body.add(hl);
    cuteEyes(body, 0.32, 0.98, 0.82, 0.2); smile(body, 0.62, 0.95, 0.1); blush(body, 0.55, 0.66, 0.86, 0.11);
    const stem = mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.25, 6), std({ color: '#3a8a3a' })); stem.position.y = 1.6; body.add(stem);
    for (const s of [-1, 1]) { const lf = mesh(sph(0.14, 10, 6), std({ color: '#5fc84a', roughness: 0.5 })); lf.position.set(0.12 * s, 1.72, 0); lf.scale.set(1.4, 0.35, 0.8); lf.rotation.z = -0.5 * s; body.add(lf); }
    bandana(body, 0.42, 0.95);
    anim = (t, s) => { const b = Math.abs(Math.sin(t * (s.moving ? 10 : 3))); body.scale.set(1 + (1 - b) * 0.08, 0.92 + b * 0.12, 1 + (1 - b) * 0.08); body.position.y = s.moving ? b * 0.25 : 0; };
  } else if (type === 2) { // the bat: a fluffy round body, big ears, little fangs
    body.position.y = 1.6;
    const fur = std({ color: '#7a5a8a', roughness: 0.85 }), belly = std({ color: '#c8a8c8', roughness: 0.9 });
    const b = mesh(sph(0.55, 18, 14), fur); body.add(b);
    const bl = mesh(sph(0.4, 14, 10), belly); bl.position.set(0, -0.08, 0.25); bl.scale.set(1, 1, 0.6); body.add(bl);
    for (let i = 0; i < 5; i++) { const tuft = mesh(sph(0.12, 8, 6), fur); tuft.position.set((i - 2) * 0.1, 0.5, 0.05 - Math.abs(i - 2) * 0.04); body.add(tuft); }
    for (const s of [-1, 1]) { const ear = mesh(new THREE.ConeGeometry(0.16, 0.42, 8), fur); ear.position.set(0.28 * s, 0.6, 0); ear.rotation.z = -0.3 * s; body.add(ear);
      const inner = mesh(new THREE.ConeGeometry(0.09, 0.3, 8), std({ color: '#ff9ab0', roughness: 0.6 })); inner.position.set(0.28 * s, 0.58, 0.06); inner.rotation.z = -0.3 * s; body.add(inner); }
    cuteEyes(body, 0.2, 0.12, 0.46, 0.15); blush(body, 0.34, -0.06, 0.45, 0.08);
    for (const s of [-1, 1]) { const f = mesh(new THREE.ConeGeometry(0.035, 0.09, 4), white()); f.position.set(0.05 * s, -0.16, 0.52); f.rotation.x = Math.PI; body.add(f); }
    const wingM = std({ color: '#5a3a6a', roughness: 0.6, side: THREE.DoubleSide });
    const wings = [];
    for (const s of [-1, 1]) {
      const wg = new THREE.Group(); wg.position.set(0.42 * s, 0.05, 0); body.add(wg);
      const sh = new THREE.Shape(); sh.moveTo(0, 0.1); sh.quadraticCurveTo(0.6, 0.45, 1.1, 0.2); sh.quadraticCurveTo(0.95, 0, 0.9, -0.2); sh.quadraticCurveTo(0.65, -0.05, 0.5, -0.3); sh.quadraticCurveTo(0.3, -0.1, 0, -0.2);
      const geo = new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI / 2);
      const w = mesh(geo, wingM); w.scale.x = s; wg.add(w); wings.push(wg);
    }
    bandana(body, -0.32, 0.42);
    anim = (t, s) => { const f = Math.sin(t * 14) * 0.8; wings[0].rotation.z = f; wings[1].rotation.z = -f; body.position.y = 1.6 + Math.sin(t * 4) * 0.15; };
  } else { // the spider: round and fuzzy, two big eyes and four small ones, spots
    body.position.y = 0.55;
    const fur = std({ color: '#5a4a3a', roughness: 0.9 }), spot = std({ color: '#ffb84a', roughness: 0.6 });
    const abd = mesh(sph(0.62, 18, 14), fur); abd.position.set(0, 0.25, -0.5); body.add(abd);
    for (const [x, y, z] of [[0, 0.75, -0.45], [-0.3, 0.6, -0.65], [0.3, 0.6, -0.65], [0, 0.45, -1.0]]) { const sp = mesh(sph(0.1, 8, 6), spot); sp.position.set(x, y, z); sp.scale.y = 0.5; body.add(sp); }
    const head = mesh(sph(0.42, 16, 12), fur); head.position.set(0, 0.2, 0.25); body.add(head);
    cuteEyes(body, 0.15, 0.32, 0.6, 0.13);
    for (const s of [-1, 1]) for (const k of [0, 1]) { const e = mesh(sph(0.045, 8, 6), pupil(), false); e.position.set((0.07 + k * 0.14) * s, 0.52 + k * 0.03, 0.55 - k * 0.06); body.add(e); }
    smile(body, 0.07, 0.62, 0.07); blush(body, 0.28, 0.1, 0.57, 0.06);
    const legs = [];
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const lg = new THREE.Group(); lg.position.set(0.3 * s, 0.15, 0.25 - i * 0.25); body.add(lg);
      const up = mesh(cap(0.05, 0.4, 6), fur); up.position.set(0.25 * s, 0.15, 0); up.rotation.z = -1.0 * s; lg.add(up);
      const lo = mesh(cap(0.045, 0.45, 6), fur); lo.position.set(0.55 * s, -0.12, 0); lo.rotation.z = 0.5 * s; lg.add(lo);
      legs.push({ lg, i, s });
    }
    bandana(body, 0.0, 0.36, 0.25);
    anim = (t, s) => { for (const L of legs) L.lg.rotation.y = s.moving ? Math.sin(t * 14 + L.i * 1.6 + (L.s > 0 ? Math.PI : 0)) * 0.35 : 0; body.position.y = 0.55 + (s.moving ? Math.abs(Math.sin(t * 14)) * 0.05 : Math.sin(t * 2) * 0.02); };
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData.anim = anim;
  return g;
}
export const PET_NAMES = { 1: ['Gloop', 'Squish', 'Jelly', 'Bubbles', 'Wobble'], 2: ['Flappy', 'Nibbles', 'Echo', 'Fang', 'Batsy'], 4: ['Itsy', 'Webster', 'Fuzz', 'Eight', 'Spinny'] };
