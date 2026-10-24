// ============================================================================
//  DUNGEON WORLD  -  the hunter builder (a prototype page): five looks for the
//  hunter on a turntable, each with skin, hair, main and accent colors, shown
//  standing, walking or drawing the bow.
// ============================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LOOKS, SKINS, HAIRS, MAINS, ACCENTS, buildHunterLook } from './hunters.js';

const $ = id => document.getElementById(id);
const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
const key = new THREE.DirectionalLight('#fff1d8', 2.4); key.position.set(3, 6, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -1 }); scene.add(key);
const rim = new THREE.DirectionalLight('#9fc8ff', 1.6); rim.position.set(-4, 3, -5); scene.add(rim);
scene.add(new THREE.HemisphereLight('#cfe6ff', '#3a2c20', 0.5));
// a mossy stone dais under the hero
const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.18, 48), new THREE.MeshStandardMaterial({ color: '#3a4a2e', roughness: 0.95 }));
dais.position.y = -0.09; dais.receiveShadow = true; scene.add(dais);
const rimStone = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.06, 8, 64), new THREE.MeshStandardMaterial({ color: '#6a6458', roughness: 0.8 }));
rimStone.rotation.x = Math.PI / 2; rimStone.position.y = 0.0; scene.add(rimStone);

const state = { look: 'ranger', pal: {}, anim: 'idle', spin: true, yaw: 0.5 };
try { const s = JSON.parse(localStorage.getItem('dw-hunter-builder')); if (s && LOOKS.some(l => l.id === s.look)) Object.assign(state, { look: s.look, pal: s.pal || {} }); } catch (e) { }
const save = () => { try { localStorage.setItem('dw-hunter-builder', JSON.stringify({ look: state.look, pal: state.pal })); } catch (e) { } };
let hero = null;
function rebuild() {
  if (hero) { scene.remove(hero); hero.traverse(o => o.geometry && o.geometry.dispose()); }
  hero = buildHunterLook(state.look, state.pal);
  scene.add(hero);
  renderUI(); save();
}
const palOf = () => ({ ...LOOKS.find(l => l.id === state.look).pal, ...state.pal });

// ---------------------------------------------------------------- the panel
function renderUI() {
  const L = LOOKS.find(l => l.id === state.look), P = palOf();
  for (const b of document.querySelectorAll('.look')) b.setAttribute('aria-pressed', b.dataset.id === state.look);
  $('lookName').textContent = L.name; $('lookBlurb').textContent = L.blurb;
  const row = (id, list, cur, isIndex) => {
    $(id).innerHTML = list.map((c, i) => `<button class="sw" style="--c:${c}" aria-label="${c}" aria-pressed="${isIndex ? i === cur : c === cur}" data-v="${isIndex ? i : c}"></button>`).join('');
  };
  row('swSkin', SKINS, P.skin, true); row('swHair', HAIRS, P.hair, true); row('swMain', MAINS, P.main, false); row('swAccent', ACCENTS, P.accent, false);
  for (const b of document.querySelectorAll('.anim')) b.setAttribute('aria-pressed', b.dataset.a === state.anim);
  $('code').textContent = `${L.name} · skin ${P.skin + 1} · hair ${P.hair + 1} · main ${P.main} · accent ${P.accent}`;
}
$('looks').innerHTML = LOOKS.map((l, i) => `<button class="look" data-id="${l.id}"><span class="n">${i + 1}</span><span class="t">${l.name}</span></button>`).join('');
$('looks').addEventListener('click', e => { const b = e.target.closest('.look'); if (!b) return; state.look = b.dataset.id; state.pal = {}; rebuild(); });
const bindRow = (id, k, isIndex) => $(id).addEventListener('click', e => { const b = e.target.closest('.sw'); if (!b) return; state.pal[k] = isIndex ? +b.dataset.v : b.dataset.v; rebuild(); });
bindRow('swSkin', 'skin', true); bindRow('swHair', 'hair', true); bindRow('swMain', 'main', false); bindRow('swAccent', 'accent', false);
$('anims').addEventListener('click', e => { const b = e.target.closest('.anim'); if (!b) return; state.anim = b.dataset.a; animT = 0; renderUI(); });
$('reset').addEventListener('click', () => { state.pal = {}; rebuild(); });
$('shuffle').addEventListener('click', () => {
  const r = a => Math.floor(Math.random() * a.length);
  state.pal = { skin: r(SKINS), hair: r(HAIRS), main: MAINS[r(MAINS)], accent: ACCENTS[r(ACCENTS)] }; rebuild();
});
$('copy').addEventListener('click', async () => {
  const t = $('code').textContent;
  try { await navigator.clipboard.writeText(t); $('copy').textContent = 'COPIED'; }
  catch (e) { const r = document.createRange(); r.selectNodeContents($('code')); getSelection().removeAllRanges(); getSelection().addRange(r); $('copy').textContent = 'SELECTED'; }
  setTimeout(() => $('copy').textContent = 'COPY', 1400);
});
addEventListener('keydown', e => { const n = +e.key; if (n >= 1 && n <= 5) { state.look = LOOKS[n - 1].id; state.pal = {}; rebuild(); } });

// drag to turn
let drag = null;
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, yaw: state.yaw }; state.spin = false; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if (drag) state.yaw = drag.yaw + (e.clientX - drag.x) * 0.012; });
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('dblclick', () => { state.spin = true; });

// ---------------------------------------------------------------- motion
// (the game's own hero motion for the bow, so a look moves here as it will there)
let animT = 0;
function animate(u, t, dt) {
  const walking = state.anim === 'walk', shooting = state.anim === 'shoot';
  const walk = t * 9, move = walking ? 1 : 0, w = Math.sin(walk) * move;
  u.legs[0].rotation.x = w * 0.7; u.legs[1].rotation.x = -w * 0.7;
  u.body.position.y = Math.abs(Math.cos(walk)) * 0.06 * move + Math.sin(t * 2) * 0.012;
  if (u.cape) u.cape.rotation.x = 0.1 + move * 0.22 + Math.sin(t * 5 + walk) * 0.04;
  u.head.rotation.y = Math.sin(t * 0.7) * 0.08;
  u.arms[0].rotation.set(-w * 0.5 - 0.2, 0, 0.06);
  u.arms[1].rotation.set(w * 0.5 - 0.3, 0, -0.06); u.arms[1].position.z = 0;
  const pos = u.string.geometry.attributes.position;
  if (shooting) {
    animT = (animT + dt / 1.4) % 1;
    const k = animT;
    u.arms[0].rotation.set(-1.55, 0.25, 0);
    u.arms[1].rotation.set(-1.45, -0.2, 0);
    const pull = k < 0.6 ? k / 0.6 : Math.max(0, 1 - (k - 0.6) / 0.15);
    u.arms[1].position.z = -pull * 0.25;
    pos.setZ(1, u.stringZ - pull * 0.35);
  } else pos.setZ(1, u.stringZ);
  pos.needsUpdate = true;
}

function resize() {
  const r = canvas.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  // (frame the whole hero, a little more room on a tall phone screen)
  const d = camera.aspect < 0.8 ? 9.2 : 7.4;
  camera.position.set(0, 1.55, d); camera.lookAt(0, 1.15, 0); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
let last = performance.now();
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = now / 1000;
  if (state.spin && !reduce) state.yaw += dt * 0.45;
  if (hero) { hero.rotation.y = state.yaw; animate(hero.userData, t, dt); }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
rebuild(); resize(); requestAnimationFrame(frame);
window.__hb = { state, rebuild, LOOKS };
