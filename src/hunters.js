// ============================================================================
//  DUNGEON WORLD  -  the hunter's new looks (a prototype): five hunters built
//  on one finer body (thighs and shins, forearms, a neck, a face), each with a
//  palette of skin, hair, main and accent colors. The rig keeps the old
//  hero's names (body, legs, arms, head, cape, bow, string, quiver) so the
//  game's animation drives these as it drove the old one.
// ============================================================================
import * as THREE from 'three';

const V3 = THREE.Vector3, TAU = Math.PI * 2;
const MATS = new Map();
const mat = (color, o = {}) => {
  const k = color + JSON.stringify(o);
  if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o }));
  return MATS.get(k);
};
const glow = c => { const k = 'glow' + c; if (!MATS.has(k)) MATS.set(k, new THREE.MeshBasicMaterial({ color: c })); return MATS.get(k); };
const mesh = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o; };
const sph = (r, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
const cap = (r, l, s = 12) => new THREE.CapsuleGeometry(r, l, 5, s);
const cyl = (a, b, h, s = 14) => new THREE.CylinderGeometry(a, b, h, s);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const cone = (r, h, s = 10) => new THREE.ConeGeometry(r, h, s);
const lathe = (pts, s = 22) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), s);
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
// a round-cornered box: a box with its corners pulled in toward a sphere
function rbox(x, y, z, r = 0.3, seg = 3) {
  const g = new THREE.BoxGeometry(x, y, z, seg, seg, seg), p = g.attributes.position, v = new V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = new V3(v.x / (x / 2), v.y / (y / 2), v.z / (z / 2)), s = n.clone().normalize().multiplyScalar(Math.SQRT2 * 0.82);
    n.lerp(s.clampLength(0, 1), r);
    p.setXYZ(i, n.x * x / 2, n.y * y / 2, n.z * z / 2);
  }
  g.computeVertexNormals(); return g;
}
// a cloth sheet hanging from y=0 down, curved around the back; jag: a torn hem
function cloth(w, h, { curve = 0.9, flare = 0.3, jag = 0, tails = 0 } = {}) {
  const g = new THREE.PlaneGeometry(w, h, 10, 12); g.translate(0, -h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i); const t = -y / h;
    x *= 1 + t * flare;
    let yy = y;
    if (t > 0.92 && jag) yy += (Math.abs(Math.sin(x * 23)) * jag);
    if (t > 0.85 && tails) yy -= Math.max(0, Math.cos(x * Math.PI / (w * (1 + flare)) * 2)) * tails;
    p.setXYZ(i, x, yy, -x * x * curve);
  }
  g.computeVertexNormals(); return g;
}

// ---------------------------------------------------------------- the body
// o: { skin, legMat, bootMat, torsoMat, armMat, foreMat, handMat, slim, tallBoots }
function rig(o) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const S = o.slim ? 0.92 : 1, legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(0.16 * s * S, 0.76, 0);
    const thigh = mesh(cap(0.135 * S, 0.22), o.legMat); thigh.position.y = -0.17; leg.add(thigh);
    const shin = mesh(cap(0.115 * S, 0.2), o.tallBoots ? o.bootMat : o.legMat); shin.position.y = -0.45; leg.add(shin);
    const knee = mesh(sph(0.12 * S, 12, 10), o.legMat); knee.position.set(0, -0.31, 0.02); leg.add(knee);
    const boot = mesh(rbox(0.24, 0.17, 0.38, 0.55), o.bootMat); boot.position.set(0, -0.68, 0.06); leg.add(boot);
    const cuff = mesh(cyl(0.135, 0.125, 0.09), o.cuffMat || o.bootMat); cuff.position.y = o.tallBoots ? -0.3 : -0.55; leg.add(cuff);
    body.add(leg); legs.push(leg);
  }
  const hips = mesh(cyl(0.29 * S, 0.3 * S, 0.22), o.legMat); hips.position.y = 0.82; body.add(hips);
  const torso = mesh(lathe([[0.001, 0.0], [0.27, 0.0], [0.29, 0.12], [0.33, 0.34], [0.34, 0.5], [0.3, 0.6], [0.17, 0.66], [0.001, 0.67]]), o.torsoMat);
  torso.scale.set(1.05 * S, 1, 0.78); torso.position.y = 0.86; body.add(torso);
  const neck = mesh(cyl(0.095, 0.11, 0.16), o.skin); neck.position.y = 1.56; body.add(neck);
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(0.41 * s * S, 1.38, 0);
    const sh = mesh(sph(0.125, 14, 10), o.armMat); arm.add(sh);
    const up = mesh(cap(0.095, 0.2), o.armMat); up.position.y = -0.16; arm.add(up);
    const fore = mesh(cap(0.088, 0.18), o.foreMat || o.armMat); fore.position.y = -0.4; arm.add(fore);
    const hand = mesh(sph(0.1, 12, 10), o.handMat); hand.position.y = -0.57; hand.scale.set(0.9, 1.05, 0.85); arm.add(hand);
    body.add(arm); arms.push(arm);
  }
  const head = new THREE.Group(); head.position.y = 1.8; body.add(head);
  const skull = mesh(sph(0.27, 24, 18), o.skin); skull.scale.set(1, 1.06, 0.98); head.add(skull);
  const jaw = mesh(sph(0.2, 16, 12), o.skin); jaw.position.set(0, -0.1, 0.06); jaw.scale.set(1, 0.8, 0.95); head.add(jaw);
  root.userData = { body, legs, arms, head, torso, hips };
  return root;
}
// a face: eyes (whites, irises, a glint), brows, a nose, a mouth
function face(head, { eye = '#3a2a1c', brow = '#3a2418', glowEyes = null, ears = 'round', skin, earLen = 0.22 }) {
  for (const s of [-1, 1]) {
    if (glowEyes) { const e = new THREE.Mesh(sph(0.04, 10, 8), glow(glowEyes)); e.position.set(0.095 * s, 0.03, 0.245); e.scale.set(1.3, 0.6, 0.6); head.add(e); continue; }
    const w = mesh(sph(0.055, 12, 10), mat('#f6f2ea', { roughness: 0.3 })); w.position.set(0.095 * s, 0.03, 0.225); w.scale.set(1, 1.1, 0.55); head.add(w);
    const i = mesh(sph(0.036, 10, 8), mat(eye, { roughness: 0.2 })); i.position.set(0.095 * s, 0.025, 0.252); i.scale.z = 0.5; head.add(i);
    const g = new THREE.Mesh(sph(0.011, 6, 5), glow('#ffffff')); g.position.set(0.085 * s, 0.045, 0.27); head.add(g);
    const b = mesh(box(0.1, 0.022, 0.03), mat(brow)); b.position.set(0.1 * s, 0.1, 0.24); b.rotation.z = -0.12 * s; head.add(b);
    if (ears === 'round') { const e = mesh(sph(0.06, 10, 8), skin); e.position.set(0.265 * s, 0.0, 0.0); e.scale.set(0.5, 1, 0.8); head.add(e); }
    if (ears === 'elf') { const e = mesh(cone(0.055, earLen, 8), skin); e.position.set(0.28 * s + 0.07 * s, 0.05, -0.02); e.rotation.z = -1.15 * s; e.rotation.x = -0.25; e.scale.z = 0.45; head.add(e); }
  }
  const nose = mesh(sph(0.04, 10, 8), skin); nose.position.set(0, -0.04, 0.27); nose.scale.set(0.8, 1, 0.9); head.add(nose);
  const mouth = mesh(box(0.08, 0.014, 0.02), mat('#7a3a30')); mouth.position.set(0, -0.12, 0.25); head.add(mouth);
}
// hair: 'short' | 'long' | 'braid' | 'pony' | 'top' (only what shows from under a hat or hood)
function hair(head, style, m) {
  if (style === 'none') return;
  const cap0 = mesh(new THREE.SphereGeometry(0.285, 22, 14, 0, TAU, 0, Math.PI * 0.5), m); cap0.position.y = 0.02; cap0.rotation.x = -0.25; cap0.scale.set(1.02, 1.05, 1.02); head.add(cap0);
  const fringe = mesh(new THREE.SphereGeometry(0.29, 18, 8, -0.9, 1.8, Math.PI * 0.32, Math.PI * 0.12), m); fringe.position.y = 0.02; head.add(fringe);
  if (style === 'top') return;
  const back = mesh(sph(0.27, 16, 12), m); back.position.set(0, -0.02, -0.08); back.scale.set(1.04, 1, 0.9); head.add(back);
  if (style === 'long') {
    const g = cloth(0.5, 0.75, { curve: 1.4, flare: 0.25 }); const h = mesh(g, mat(m.color.getStyle ? '#' + m.color.getHexString() : '#333', { side: THREE.DoubleSide, roughness: 0.6 }));
    h.position.set(0, 0.05, -0.2); h.rotation.x = 0.12; head.add(h);
    for (const s of [-1, 1]) { const l = mesh(cap(0.06, 0.35, 8), m); l.position.set(0.24 * s, -0.25, 0.04); l.rotation.z = 0.08 * s; head.add(l); }
  }
  if (style === 'braid' || style === 'pony') {
    const n = style === 'braid' ? 6 : 1;
    if (n === 1) { const p = mesh(cap(0.08, 0.45, 10), m); p.position.set(0, -0.2, -0.33); p.rotation.x = 0.35; head.add(p); const tie = mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 12), mat('#c83a2a')); tie.position.set(0, 0.0, -0.28); tie.rotation.x = 1.2; head.add(tie); }
    else for (let i = 0; i < n; i++) { const b = mesh(sph(0.075 - i * 0.006, 10, 8), m); b.position.set(Math.sin(i * 1.7) * 0.015, -0.05 - i * 0.1, -0.3 - i * 0.03); b.scale.y = 1.25; head.add(b); }
  }
}
// the bow, in the left hand: kinds 'recurve' | 'long' | 'bone' | 'dark' | 'wrapped'
function makeBow(arm, kind, wood, accent) {
  const bow = new THREE.Group(); bow.position.set(0, -0.57, 0.05); arm.add(bow);
  const L = kind === 'long' ? 0.95 : 0.78;
  const pts = kind === 'recurve' || kind === 'dark'
    ? [[-L, -0.16], [-L * 0.8, -0.06], [-L * 0.45, 0.1], [0, 0.17], [L * 0.45, 0.1], [L * 0.8, -0.06], [L, -0.16]]
    : [[-L, -0.1], [-L * 0.5, 0.1], [0, 0.17], [L * 0.5, 0.1], [L, -0.1]];
  const curve = new THREE.CatmullRomCurve3(pts.map(([y, z]) => new V3(0, y, z)));
  const limb = new THREE.TubeGeometry(curve, 28, kind === 'long' ? 0.032 : 0.04, 7);
  { const p = limb.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 1 - Math.abs(y) / L * 0.5; p.setX(i, p.getX(i) * k); p.setZ(i, (p.getZ(i) - 0) * 1); } }
  bow.add(mesh(limb, wood));
  const grip = mesh(cyl(0.05, 0.05, 0.2, 8), accent); grip.position.z = 0.17; bow.add(grip);
  if (kind === 'bone') for (const s of [-1, 1]) { const t = mesh(cone(0.045, 0.2, 7), mat('#efe6d2', { roughness: 0.5 })); t.position.set(0, s * L, -0.12); t.rotation.x = s > 0 ? 0.6 : Math.PI - 0.6; bow.add(t); }
  if (kind === 'long') for (const s of [-1, 1]) { const leaf = mesh(sph(0.07, 10, 6), accent); leaf.scale.set(0.3, 1.6, 0.8); leaf.position.set(0, s * L * 0.55, 0.14); bow.add(leaf); }
  if (kind === 'wrapped') for (let i = -3; i <= 3; i++) { if (!i) continue; const r = mesh(new THREE.TorusGeometry(0.045, 0.012, 5, 10), accent); const u = (i / 3) * 0.8 * 0.5 + 0.5, p = curve.getPoint(u); r.position.copy(p); r.rotation.x = Math.PI / 2; bow.add(r); }
  const sz = pts[0][1];
  const strGeo = new THREE.BufferGeometry().setFromPoints([new V3(0, -L, sz), new V3(0, 0, sz), new V3(0, L, sz)]);
  const string = new THREE.Line(strGeo, new THREE.LineBasicMaterial({ color: kind === 'dark' ? accent.color : '#ece4d0' })); bow.add(string);
  bow.rotation.set(Math.PI / 2, 0, 0);
  return { bow, string, stringZ: sz };
}
function quiverOn(body, leather, fletch, x = 0.16, tilt = -0.4) {
  const q = new THREE.Group(); q.position.set(x, 1.22, -0.36); q.rotation.z = tilt; q.rotation.x = 0.15; body.add(q);
  q.add(mesh(cyl(0.12, 0.1, 0.72, 12), leather));
  const rim = mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 14), fletch); rim.rotation.x = Math.PI / 2; rim.position.y = 0.36; q.add(rim);
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; const ar = mesh(cyl(0.012, 0.012, 0.45, 4), mat('#c8a070')); ar.position.set(Math.cos(a) * 0.05, 0.5, Math.sin(a) * 0.05); q.add(ar); const f = mesh(box(0.05, 0.13, 0.008), fletch); f.position.set(Math.cos(a) * 0.05, 0.66, Math.sin(a) * 0.05); f.rotation.y = a; q.add(f); }
  return q;
}
const strap = (body, m, w = 0.07, flip = 1) => { const s = mesh(box(w, 0.95, 0.04), m); s.position.set(0, 1.18, 0); s.rotation.z = 0.72 * flip; s.scale.z = 1; const g = new THREE.Group(); g.add(s); const front = s.clone(); front.position.z = 0.27; const backS = s.clone(); backS.position.z = -0.27; g.remove(s); g.add(front, backS); body.add(g); return g; };
const belt = (body, m, buckle) => { const b = mesh(cyl(0.31, 0.31, 0.08, 22), m); b.position.y = 0.92; b.scale.z = 0.8; body.add(b); const k = mesh(rbox(0.1, 0.08, 0.04, 0.4), buckle); k.position.set(0, 0.92, 0.25); body.add(k); };
const pouch = (body, m, x) => { const p = mesh(rbox(0.12, 0.13, 0.08, 0.5), m); p.position.set(x, 0.86, 0.2); p.rotation.y = x * 1.4; body.add(p); };

// ---------------------------------------------------------------- the five
export const LOOKS = [
  { id: 'ranger', name: 'RANGER', blurb: 'Hooded cloak, leather vest, a quiver of grey-fletched arrows. The road warden.',
    pal: { skin: 1, hair: 2, main: '#3f6a2a', accent: '#a87a3a' } },
  { id: 'huntress', name: 'WILD HUNTRESS', blurb: 'Wolf-pelt hood, war paint and a bone bow. Hunts what hunts her.',
    pal: { skin: 2, hair: 3, main: '#6a4a32', accent: '#d8c8b0' } },
  { id: 'sentinel', name: 'ELVEN SENTINEL', blurb: 'Leaf pauldrons, a silver circlet, a longbow taller than she is.',
    pal: { skin: 0, hair: 5, main: '#2f6b5a', accent: '#c8d4dc' } },
  { id: 'trapper', name: 'TRAPPER', blurb: 'Wide hat, duster coat, a bandolier of tricks. Knows every snare.',
    pal: { skin: 3, hair: 1, main: '#7a5a3a', accent: '#b8322a' } },
  { id: 'stalker', name: 'SHADOW STALKER', blurb: 'A deep cowl, a masked face, eyes that glow. Never seen first.',
    pal: { skin: 1, hair: 0, main: '#2a2434', accent: '#8a5cff' } },
];
export const SKINS = ['#f3d2b8', '#eab48a', '#c98a5e', '#9a6440', '#6a4028', '#b8c8a0'];
export const HAIRS = ['#1e1a1c', '#4a2e1c', '#7a4a26', '#b8442a', '#d8b060', '#e8e4dc', '#5a7ab8'];
export const MAINS = ['#3f6a2a', '#2f6b5a', '#6a4a32', '#7a5a3a', '#2a2434', '#3a4a6a', '#6a2a2a', '#5a5a5a'];
export const ACCENTS = ['#a87a3a', '#d8c8b0', '#c8d4dc', '#b8322a', '#8a5cff', '#f0b73c', '#4ac8a0', '#e86a9a'];

export function buildHunterLook(id, pal) {
  const L = LOOKS.find(l => l.id === id) || LOOKS[0];
  pal = { ...L.pal, ...pal };
  const skin = mat(SKINS[pal.skin] ?? SKINS[1], { roughness: 0.6 }), hairM = mat(HAIRS[pal.hair] ?? HAIRS[1], { roughness: 0.55 });
  const main = mat(pal.main), mainD = mat(shade(pal.main, 0.7)), accent = mat(pal.accent, { roughness: 0.5 });
  const leather = mat('#5a3a22'), leatherD = mat('#3a2616'), metal = mat('#c8ccd4', { metalness: 0.9, roughness: 0.3 });
  let root, u;
  return ({ ranger, huntress, sentinel, trapper, stalker })[L.id]();

  function done(extra) { Object.assign(root.userData, { weapon: 'bow' }, extra); root.traverse(o => { if (o.isMesh) o.castShadow = true; }); root.scale.setScalar(1.06); return root; }
  // ---- each look
  function ranger() {
    root = rig({ skin, legMat: mat('#4a3a28'), bootMat: leather, torsoMat: main, armMat: mainD, foreMat: leather, handMat: leatherD, tallBoots: true, cuffMat: leatherD }); u = root.userData;
    const { body, head, arms } = u;
    face(head, { skin, brow: HAIRS[pal.hair] }); hair(head, 'top', hairM);
    const vest = mesh(rbox(0.56, 0.5, 0.12, 0.5), leather); vest.position.set(0, 1.14, 0.2); body.add(vest);
    for (let i = 0; i < 3; i++) { const t = mesh(box(0.06, 0.02, 0.02), accent); t.position.set(0, 1.0 + i * 0.12, 0.27); body.add(t); }
    belt(body, leatherD, metal); pouch(body, leather, -0.2); pouch(body, leather, 0.22);
    strap(body, leatherD, 0.06);
    // the hood: a shell over the head and a drape down the neck
    const hood = mesh(new THREE.SphereGeometry(0.33, 22, 16, 0, TAU, 0, Math.PI * 0.6), main); hood.position.set(0, 0.04, -0.03); hood.rotation.x = -0.35; head.add(hood);
    const rim = mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 26, Math.PI * 1.2), mainD); rim.position.set(0, 0.05, 0.12); rim.rotation.set(0.15, 0, -Math.PI * 0.1 + Math.PI * -0.0); rim.rotation.z = -0.3; head.add(rim);
    const tip = mesh(cone(0.15, 0.38, 12), main); tip.position.set(0, 0.06, -0.33); tip.rotation.x = -2.1; head.add(tip);
    const mantle = mesh(lathe([[0.001, 0.3], [0.2, 0.28], [0.4, 0.1], [0.5, -0.12]]), main); mantle.position.y = 1.42; mantle.scale.z = 0.8; body.add(mantle);
    const cape = mesh(cloth(0.8, 1.2, { curve: 1, flare: 0.35, jag: 0.06 }), mat(pal.main, { side: THREE.DoubleSide })); cape.position.set(0, 1.46, -0.3); body.add(cape);
    for (const a of arms) { const br = mesh(cyl(0.1, 0.095, 0.16), accent); br.position.y = -0.42; a.add(br); }
    const quiver = quiverOn(body, leather, mat('#d8d0c0'));
    return done({ cape, quiver, ...makeBow(arms[0], 'recurve', mat('#7a4a22'), accent) });
  }
  function huntress() {
    root = rig({ skin, legMat: mat('#5a3c26'), bootMat: mat(pal.accent, { roughness: 0.95 }), torsoMat: mat('#6a4a32'), armMat: skin, foreMat: mat('#8a6a4a'), handMat: skin, slim: true }); u = root.userData;
    const { body, head, arms } = u;
    face(head, { skin, brow: HAIRS[pal.hair], eye: '#5a7a3a' }); hair(head, 'braid', hairM);
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const p = new THREE.Mesh(box(0.1, 0.018, 0.01), mat('#2a2a3a')); p.position.set(0.12 * s, -0.04 - i * 0.04, 0.262); p.rotation.y = 0.35 * s; head.add(p); }
    // the top: a wrap of fur, the waist bare where the torso shows the main color (a short tunic)
    const wrap = mesh(lathe([[0.001, 0.0], [0.3, 0.0], [0.35, 0.18], [0.33, 0.32], [0.001, 0.33]]), main); wrap.position.y = 1.12; wrap.scale.z = 0.8; body.add(wrap);
    // the wolf pelt: a wolf's head as the hood, its fur down the back
    const fur = mat(pal.accent, { roughness: 0.95 }), furD = mat(shade(pal.accent, 0.75), { roughness: 0.95 });
    const wolf = new THREE.Group(); wolf.position.set(0, 0.2, -0.02); head.add(wolf);
    const crown = mesh(new THREE.SphereGeometry(0.31, 20, 14, 0, TAU, 0, Math.PI * 0.5), furD); crown.rotation.x = -0.2; wolf.add(crown);
    const snout = mesh(rbox(0.2, 0.13, 0.3, 0.6), furD); snout.position.set(0, 0.12, 0.28); snout.rotation.x = 0.35; wolf.add(snout);
    const nose = mesh(sph(0.04, 8, 6), mat('#1a1414')); nose.position.set(0, 0.06, 0.44); wolf.add(nose);
    for (const s of [-1, 1]) {
      const ear = mesh(cone(0.08, 0.2, 4), furD); ear.position.set(0.17 * s, 0.3, -0.02); ear.rotation.z = -0.3 * s; wolf.add(ear);
      const e = new THREE.Mesh(sph(0.025, 8, 6), glow('#ffd45a')); e.position.set(0.09 * s, 0.2, 0.25); wolf.add(e);
      for (let i = 0; i < 2; i++) { const t = mesh(cone(0.018, 0.07, 5), mat('#f0ead8')); t.position.set(0.05 * s + i * 0.02 * s, 0.0, 0.36); t.rotation.x = Math.PI; wolf.add(t); }
    }
    const pelt = mesh(cloth(0.7, 1.05, { curve: 1.2, flare: 0.25, jag: 0.12 }), mat(shade(pal.accent, 0.85), { side: THREE.DoubleSide, roughness: 0.95 })); pelt.position.set(0, 1.62, -0.3); body.add(pelt);
    // a ruff of fur over the shoulders
    for (let i = 0; i < 14; i++) { const a = (i / 13 - 0.5) * Math.PI * 1.4; const t = mesh(cone(0.08, 0.22, 6), i % 2 ? fur : furD); t.position.set(Math.sin(a) * 0.36, 1.48, Math.cos(a) * 0.24 - 0.06); t.rotation.set(Math.cos(a) * 1.9, 0, -Math.sin(a) * 1.9); body.add(t); }
    // bone necklace
    const neck = mesh(new THREE.TorusGeometry(0.16, 0.012, 5, 18), leatherD); neck.position.set(0, 1.5, 0.04); neck.rotation.x = 1.3; body.add(neck);
    for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.35; const t = mesh(cone(0.022, 0.09, 5), mat('#efe6d2')); t.position.set(Math.sin(a) * 0.17, 1.42, 0.14 + Math.cos(a) * 0.04); t.rotation.x = Math.PI; body.add(t); }
    // wraps on the forearms, a loincloth, fur-topped boots
    for (const a of arms) for (let i = 0; i < 3; i++) { const r = mesh(new THREE.TorusGeometry(0.09, 0.018, 5, 12), leatherD); r.position.y = -0.33 - i * 0.07; r.rotation.x = Math.PI / 2; a.add(r); }
    belt(body, leatherD, mat('#efe6d2'));
    for (const z of [1, -1]) { const lc = mesh(cloth(0.26, 0.42, { curve: 0, flare: 0.1, jag: 0.05 }), mat('#6a4a32', { side: THREE.DoubleSide })); lc.position.set(0, 0.9, 0.24 * z); body.add(lc); }
    for (const l of u.legs) { const f = mesh(cyl(0.16, 0.14, 0.14, 10), furD); f.position.y = -0.5; l.add(f); }
    const quiver = quiverOn(body, mat('#6a4a32'), mat('#2a2a2a'), -0.16, 0.4);
    return done({ cape: pelt, quiver, ...makeBow(arms[0], 'bone', mat('#e6dccb', { roughness: 0.5 }), leatherD) });
  }
  function sentinel() {
    const silver = mat(pal.accent, { metalness: 0.85, roughness: 0.28 });
    root = rig({ skin, legMat: mat(shade(pal.main, 0.55)), bootMat: mat('#3a3a40'), torsoMat: main, armMat: mainD, foreMat: silver, handMat: mat('#3a3a40'), slim: true, tallBoots: true, cuffMat: silver }); u = root.userData;
    const { body, head, arms } = u;
    face(head, { skin, brow: HAIRS[pal.hair], eye: '#2a8a6a', ears: 'elf', earLen: 0.26 }); hair(head, 'long', hairM);
    const circ = mesh(new THREE.TorusGeometry(0.285, 0.016, 6, 30), silver); circ.position.set(0, 0.1, 0); circ.rotation.x = Math.PI / 2 - 0.25; head.add(circ);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), glow('#5ce6b0')); gem.position.set(0, 0.17, 0.28); head.add(gem);
    // a breastplate with a leaf on it, a sash, layered leaf pauldrons
    const plate = mesh(rbox(0.5, 0.36, 0.14, 0.6), silver); plate.position.set(0, 1.26, 0.17); body.add(plate);
    const leaf = mesh(sph(0.07, 10, 6), mat('#4ac8a0', { roughness: 0.4 })); leaf.scale.set(0.5, 1.4, 0.3); leaf.position.set(0, 1.27, 0.25); body.add(leaf);
    const sash = mesh(box(0.08, 0.8, 0.03), accent); sash.position.set(0, 1.0, 0.27); sash.rotation.z = -0.6; body.add(sash);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const p = mesh(sph(0.15 - i * 0.02, 14, 8), i % 2 ? silver : main); p.scale.set(1.2, 0.35, 0.9); p.position.set(0.42 * s, 1.47 - i * 0.07, 0); p.rotation.z = -0.5 * s; body.add(p); }
    // a long two-tailed cape, a skirt of panels
    const cape = mesh(cloth(0.78, 1.45, { curve: 0.9, flare: 0.3, tails: 0.18 }), mat(pal.main, { side: THREE.DoubleSide })); cape.position.set(0, 1.5, -0.3); body.add(cape);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.25; const pnl = mesh(box(0.16, 0.36, 0.02), i % 2 ? mainD : main); pnl.position.set(Math.sin(a) * 0.29, 0.72, Math.cos(a) * 0.23); pnl.rotation.y = a; pnl.rotation.x = 0.12 * Math.cos(a); body.add(pnl); }
    belt(body, silver, mat('#4ac8a0'));
    const quiver = quiverOn(body, mainD, silver, 0.12, -0.25);
    return done({ cape, quiver, ...makeBow(arms[0], 'long', mat('#e8e4dc', { roughness: 0.4 }), silver) });
  }
  function trapper() {
    root = rig({ skin, legMat: mat('#4a4038'), bootMat: leatherD, torsoMat: mat('#d8c8a8'), armMat: main, foreMat: main, handMat: leather, tallBoots: true }); u = root.userData;
    const { body, head, arms } = u;
    face(head, { skin, brow: HAIRS[pal.hair] }); hair(head, 'short', hairM);
    // a stubble beard on the jaw
    const beard = mesh(sph(0.21, 16, 10, 0, TAU, Math.PI * 0.45, Math.PI * 0.4), hairM); beard.position.set(0, -0.06, 0.04); head.add(beard);
    // the hat, goggles on its brim
    const hatM = mat(shade(pal.main, 0.8), { roughness: 0.85 });
    const brim = mesh(cyl(0.48, 0.5, 0.035, 28), hatM); brim.position.y = 0.2; brim.rotation.x = -0.1; head.add(brim);
    const crown = mesh(cyl(0.25, 0.28, 0.26, 20), hatM); crown.position.y = 0.33; crown.rotation.x = -0.1; head.add(crown);
    const band = mesh(cyl(0.285, 0.285, 0.05, 20), accent); band.position.y = 0.24; band.rotation.x = -0.1; head.add(band);
    for (const s of [-1, 1]) { const g = mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 14), metal); g.position.set(0.08 * s, 0.31, 0.23); head.add(g); const l = new THREE.Mesh(new THREE.CircleGeometry(0.05, 14), mat('#7ac8e8', { metalness: 0.5, roughness: 0.1 })); l.position.set(0.08 * s, 0.31, 0.235); head.add(l); }
    // a bandana around the neck
    const bandana = mesh(cone(0.2, 0.2, 3), accent); bandana.position.set(0, 1.47, 0.14); bandana.rotation.set(Math.PI, 0, 0); bandana.scale.z = 0.4; body.add(bandana);
    const knot = mesh(new THREE.TorusGeometry(0.15, 0.04, 6, 16), accent); knot.position.y = 1.55; knot.rotation.x = Math.PI / 2; body.add(knot);
    // the duster: an open coat from the shoulders to the shins, a collar
    const coat = new THREE.Group(); body.add(coat);
    const back = mesh(lathe([[0.25, 0.0], [0.36, 0.3], [0.37, 0.75], [0.42, 1.3], [0.48, 1.55]], 22), mat(pal.main, { side: THREE.DoubleSide }));
    back.geometry = new THREE.LatheGeometry([[0.36, 0.0], [0.35, 0.3], [0.33, 0.55], [0.3, 0.75], [0.36, 1.0], [0.44, 1.25]].map(([r, y]) => new THREE.Vector2(r, -y)), 24, Math.PI * 0.12, Math.PI * 1.76);
    back.position.y = 1.5; back.scale.z = 0.82; coat.add(back);
    const collar = mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 20, Math.PI * 1.4), mainD); collar.position.set(0, 1.52, -0.02); collar.rotation.set(Math.PI / 2 + 0.3, 0, Math.PI * 0.8); body.add(collar);
    // the bandolier, its little pouches and vials
    const bd = strap(body, leatherD, 0.09, -1);
    for (let i = 0; i < 4; i++) { const v = mesh(cyl(0.025, 0.025, 0.09, 8), mat(['#5ce65c', '#ff6a3a', '#5ab0ff', '#ffd45a'][i], { roughness: 0.2 })); v.position.set(-0.2 + i * 0.13, 1.42 - i * 0.12, 0.29); v.rotation.z = -0.72; body.add(v); }
    belt(body, leatherD, metal); pouch(body, leather, -0.24);
    const trap = mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 16), metal); trap.position.set(0.27, 0.86, 0.12); trap.rotation.y = 1.2; body.add(trap);
    // the pack: a bedroll on top
    const pack = mesh(rbox(0.42, 0.42, 0.22, 0.5), leather); pack.position.set(0, 1.15, -0.36); body.add(pack);
    const roll = mesh(cyl(0.09, 0.09, 0.5, 14), mat('#8a7a5a')); roll.rotation.z = Math.PI / 2; roll.position.set(0, 1.42, -0.38); body.add(roll);
    const quiver = quiverOn(body, leatherD, mat('#c83a2a'), 0.24, -0.5);
    return done({ cape: back, quiver, ...makeBow(arms[0], 'wrapped', mat('#5a3a1c'), accent) });
  }
  function stalker() {
    const dark = mat(pal.main, { roughness: 0.85 }), darker = mat(shade(pal.main, 0.6), { roughness: 0.9 });
    root = rig({ skin, legMat: darker, bootMat: mat('#16141a'), torsoMat: dark, armMat: darker, foreMat: dark, handMat: mat('#16141a'), slim: true, tallBoots: true }); u = root.userData;
    const { body, head, arms } = u;
    // the face hidden: a mask over the lower face, the cowl's shadow, two glowing eyes
    face(head, { skin, glowEyes: pal.accent, ears: 'none' });
    const mask = mesh(new THREE.SphereGeometry(0.29, 20, 12, -1.6, 3.2, Math.PI * 0.5, Math.PI * 0.4), darker); mask.position.set(0, 0.0, 0.0); head.add(mask);
    const cowl = mesh(new THREE.SphereGeometry(0.36, 22, 16, 0, TAU, 0, Math.PI * 0.62), dark); cowl.position.set(0, 0.05, -0.05); cowl.rotation.x = -0.45; head.add(cowl);
    const peak = mesh(cone(0.2, 0.3, 12), dark); peak.position.set(0, 0.24, 0.12); peak.rotation.x = 0.9; peak.scale.z = 0.5; head.add(peak);
    const shadow = new THREE.Mesh(sph(0.2, 10, 8), mat('#08060c', { roughness: 1 })); shadow.position.set(0, 0.1, 0.15); shadow.scale.set(1.2, 0.5, 0.5); head.add(shadow);
    // straps crossing the chest, wrapped arms, a tattered short cape, a dagger at each hip
    strap(body, mat('#16141a'), 0.06, 1); strap(body, mat('#16141a'), 0.06, -1);
    for (const a of arms) for (let i = 0; i < 5; i++) { const r = mesh(new THREE.TorusGeometry(0.093, 0.014, 5, 12), mat('#3a3440')); r.position.y = -0.3 - i * 0.05; r.rotation.set(Math.PI / 2, 0, 0.25); a.add(r); }
    const cape = mesh(cloth(0.85, 0.95, { curve: 1.2, flare: 0.45, jag: 0.16 }), mat(shade(pal.main, 0.8), { side: THREE.DoubleSide, roughness: 0.9 })); cape.position.set(0, 1.5, -0.3); body.add(cape);
    const mantle = mesh(lathe([[0.001, 0.3], [0.22, 0.27], [0.42, 0.06], [0.48, -0.1]]), darker); mantle.position.y = 1.42; mantle.scale.z = 0.8; body.add(mantle);
    belt(body, mat('#16141a'), mat(pal.accent, { emissive: pal.accent, emissiveIntensity: 0.6 }));
    for (const s of [-1, 1]) { const d = new THREE.Group(); d.position.set(0.3 * s, 0.86, 0.04); d.rotation.z = 0.5 * s; body.add(d); d.add(mesh(cyl(0.025, 0.025, 0.12, 6), mat('#2a2430'))); const bl = mesh(cone(0.035, 0.26, 4), metal); bl.position.y = -0.18; bl.rotation.x = Math.PI; bl.scale.z = 0.3; d.add(bl); }
    const quiver = quiverOn(body, darker, mat(pal.accent, { emissive: pal.accent, emissiveIntensity: 0.8 }), 0.14, -0.3);
    const bowAccent = mat(pal.accent, { emissive: pal.accent, emissiveIntensity: 0.9 });
    return done({ cape, quiver, ...makeBow(arms[0], 'dark', mat('#1e1a24', { roughness: 0.4 }), bowAccent) });
  }
}
