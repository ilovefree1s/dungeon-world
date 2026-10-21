// ============================================================================
//  DUNGEON WORLD  -  engine: the renderer, in Dungeon Heart's style (ACES tone
//  mapping, soft shadows, environment light for the heroes, bloom), set up for
//  an open world, and the helpers Dungeon Heart's models are built with.
// ============================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
export { THREE };

export const V3 = THREE.Vector3;
export const TAU = Math.PI * 2;
export const IS_TOUCH = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('gl');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#a9d4ff', 120, 240);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

export const camera = new THREE.PerspectiveCamera(60, 1, 0.3, 900);
export const hemi = new THREE.HemisphereLight('#cfe6ff', '#4a3c2c', 0.9);
scene.add(hemi);
export const sun = new THREE.DirectionalLight('#fff1d8', 2.2);
sun.castShadow = true;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
export const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// quality: 0 fast, 1 good, 2 best (pixel ratio, shadows, bloom, how far you see)
export const QUALITY = [
  { name: 'FAST', pr: 1, shadow: 0, bloom: false, view: 128 },
  { name: 'GOOD', pr: 1.5, shadow: 1024, bloom: false, view: 176 },
  { name: 'BEST', pr: 2, shadow: 2048, bloom: true, view: IS_TOUCH ? 208 : 256 },
];
export const view = { w: 1, h: 1, quality: 1, viewDist: 176, shadowR: 68 };
export function resize() {
  const w = innerWidth, h = innerHeight;
  view.w = w; view.h = h;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  camera.aspect = w / h;
  // (an upright phone sees more around it with a taller view)
  camera.fov = camera.aspect < 0.8 ? 72 : camera.aspect < 1.2 ? 66 : 60;
  camera.updateProjectionMatrix();
}
export function setQuality(level) {
  const q = QUALITY[level];
  view.quality = level;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pr));
  renderer.shadowMap.enabled = q.shadow > 0;
  sun.castShadow = q.shadow > 0;
  if (q.shadow) {
    if (sun.shadow.mapSize.x !== q.shadow) { sun.shadow.mapSize.set(q.shadow, q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    view.shadowR = q.shadow > 1024 ? 96 : 60;
    Object.assign(sun.shadow.camera, { left: -view.shadowR, right: view.shadowR, top: view.shadowR, bottom: -view.shadowR, near: 1, far: 520 });
    sun.shadow.camera.updateProjectionMatrix();
  }
  view.bloomOn = q.bloom;
  view.viewDist = q.view;
  scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
  resize();
}
export function render() { if (view.bloomOn) composer.render(); else renderer.render(scene, camera); }

// ---------------------------------------------------------------- textures
export function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function glowTex(stops, size = 128) {
  const [c, x] = cnv(size, size), h = size / 2, g = x.createRadialGradient(h, h, 0, h, h, h);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const TEX = {
  flame: glowTex([[0, 'rgba(255,250,220,1)'], [0.25, 'rgba(255,190,80,.95)'], [0.55, 'rgba(255,90,20,.45)'], [1, 'rgba(255,40,0,0)']]),
  soft: glowTex([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]),
  ring: (() => { const [c, x] = cnv(128, 128); x.strokeStyle = '#fff'; x.lineWidth = 10; x.beginPath(); x.arc(64, 64, 52, 0, TAU); x.stroke(); return new THREE.CanvasTexture(c); })(),
  shadow: glowTex([[0, 'rgba(0,0,0,.55)'], [0.6, 'rgba(0,0,0,.25)'], [1, 'rgba(0,0,0,0)']]),
  spark: glowTex([[0, 'rgba(255,255,255,1)'], [0.15, 'rgba(255,255,255,.9)'], [0.4, 'rgba(255,255,255,.15)'], [1, 'rgba(255,255,255,0)']], 64),
};
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---------------------------------------------------------------- the helpers Dungeon Heart's models use
export function std(o) { return new THREE.MeshStandardMaterial(o); }
export function mesh(geo, mat, cast = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; return m; }
export const sph = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
// (Dungeon Heart lights glowing things with a pool of real lights; out here the sun and the sky do it,
// and a GlowLight is only a marker for later stages)
export class GlowLight extends THREE.Object3D {
  constructor(color, intensity = 1, distance = 0, decay = 2) { super(); this.isGlowLight = true; this.color = new THREE.Color(color); this.intensity = intensity; this.distance = distance; this.decay = decay; }
}
