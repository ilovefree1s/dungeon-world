// ============================================================================
//  DUNGEON WORLD  -  sky: day and night. A square sun and moon, stars, blocky
//  clouds, and the light, fog and sky colors through the day.
// ============================================================================
import { THREE, scene, camera, hemi, sun, view } from './engine.js';

export const DAY_LEN = 600; // seconds for a whole day
export const sky = { t: 0.32, speed: 1, day: 1, night: 0, sunDir: new THREE.Vector3(), lightDir: new THREE.Vector3() };

const C = c => new THREE.Color(c);
const uni = {
  topCol: { value: C('#3a8ee6') }, horCol: { value: C('#b7dcff') }, groundCol: { value: C('#6a7f96') },
  sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: C('#fff2c8') }, night: { value: 0 }, dusk: { value: 0 },
};
const dome = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), new THREE.ShaderMaterial({
  uniforms: uni, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
  fragmentShader: `
    uniform vec3 topCol, horCol, groundCol, sunDir, sunCol; uniform float night, dusk; varying vec3 vDir;
    // a square disc facing you: the blocky sun and moon
    float squareDisc(vec3 d, vec3 c, float size){
      vec3 up = abs(c.y) < 0.99 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0);
      vec3 u = normalize(cross(up, c)), v = cross(c, u);
      float f = dot(d, c); if (f <= 0.0) return 0.0;
      vec2 q = vec2(dot(d,u), dot(d,v)) / f;
      return step(max(abs(q.x), abs(q.y)), size);
    }
    void main(){
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 col = mix(horCol, topCol, pow(clamp(h, 0.0, 1.0), 0.55));
      col = mix(col, groundCol, clamp(-h * 3.0, 0.0, 1.0));
      float sd = max(dot(d, sunDir), 0.0);
      // (a soft warmth around the sun, and a disc no brighter than white: anything brighter would bloom
      // into a glare across the screen whenever the sun is ahead of you)
      col += sunCol * (pow(sd, 12.0) * 0.16 * (1.0 - night) + pow(sd, 3.0) * 0.14 * dusk);
      col = mix(col, vec3(1.0, 0.97, 0.88), squareDisc(d, sunDir, 0.05) * (1.0 - night * 0.9));
      col = mix(col, vec3(0.9, 0.93, 1.0), squareDisc(d, -sunDir, 0.04) * night);
      col = min(col, vec3(1.0));
      vec3 s = floor(d * 240.0);
      float r = fract(sin(dot(s, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      col += vec3(step(0.9972, r) * night * clamp(h * 4.0, 0.0, 1.0) * (0.6 + 0.4 * fract(r * 91.0)));
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
dome.renderOrder = -10; dome.frustumCulled = false;
scene.add(dome);

// ---------------------------------------------------------------- clouds
const NCLOUD = 40, TILE = 1440;
const cloudMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.88, fog: false });
const clouds = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cloudMat, NCLOUD * 2);
clouds.frustumCulled = false;
const cloudBase = [];
{
  let s = 12345; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < NCLOUD; i++) {
    const w = 36 + r() * 92, d = 28 + r() * 68;
    cloudBase.push({ x: r() * TILE, z: r() * TILE, y: 224 + r() * 36, w, d, h: 8 + r() * 6 });
    // (a second, smaller box on top of each)
    cloudBase.push({ x: 0, z: 0, y: 0, w: w * (0.4 + r() * 0.3), d: d * (0.4 + r() * 0.3), h: 6, top: true, ox: (r() - 0.5) * w * 0.4, oz: (r() - 0.5) * d * 0.4 });
  }
}
scene.add(clouds);
const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
function placeClouds(px, pz, t) {
  const drift = t * 4.4;
  let prev = null;
  cloudBase.forEach((c, i) => {
    if (c.top) {
      pv.set(prev.x + c.ox, prev.y + prev.h / 2 + c.h / 2, prev.z + c.oz);
    } else {
      const x = ((c.x + drift - px) % TILE + TILE) % TILE - TILE / 2 + px;
      const z = ((c.z - pz) % TILE + TILE) % TILE - TILE / 2 + pz;
      pv.set(x, c.y, z); prev = { x, y: c.y, z, h: c.h };
    }
    sv.set(c.w, c.h, c.d);
    clouds.setMatrixAt(i, m4.compose(pv, q0, sv));
  });
  clouds.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- the light through the day
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const K = {
  dayTop: C('#3d8fe8'), nightTop: C('#0a1434'), dayHor: C('#b9dcff'), nightHor: C('#22305e'), duskHor: C('#ff9a5a'),
  sunDay: C('#fff2d6'), sunDusk: C('#ffae66'), moon: C('#9fb6ff'),
  hemiSkyDay: C('#cfe6ff'), hemiSkyNight: C('#6a7ec8'), hemiGrDay: C('#5a4a36'), hemiGrNight: C('#2c2c46'),
};
const tmp = new THREE.Color(), tmp2 = new THREE.Color();
export function updateSky(dt, focus) {
  sky.t = (sky.t + dt * sky.speed / DAY_LEN) % 1;
  const a = (sky.t - 0.25) * Math.PI * 2;
  const sd = sky.sunDir.set(Math.cos(a), Math.sin(a), 0.32).normalize();
  const s = sd.y;
  const day = sm(-0.14, 0.22, s), dusk = Math.max(0, 1 - Math.abs(s) / 0.28) * (1 - sm(0.2, 0.3, s));
  sky.day = day; sky.night = 1 - day;
  uni.sunDir.value.copy(sd); uni.night.value = 1 - day; uni.dusk.value = dusk;
  uni.topCol.value.copy(K.nightTop).lerp(K.dayTop, day);
  tmp.copy(K.nightHor).lerp(K.dayHor, day).lerp(K.duskHor, dusk * 0.55);
  uni.horCol.value.copy(tmp);
  uni.groundCol.value.copy(tmp).multiplyScalar(0.7);
  uni.sunCol.value.copy(K.sunDay).lerp(K.sunDusk, dusk);
  scene.fog.color.copy(tmp);
  scene.fog.near = view.viewDist * 0.5; scene.fog.far = view.viewDist * 0.96;
  // the sun by day, the moon by night: one light, so the shaders never change
  const moonUp = s < -0.05;
  sky.lightDir.copy(moonUp ? sd.clone().negate() : sd);
  if (sky.lightDir.y < 0.12) sky.lightDir.y = 0.12; // (low light still lands on the ground)
  sky.lightDir.normalize();
  if (moonUp) { sun.color.copy(K.moon); sun.intensity = 0.95 * sm(0.05, 0.25, -s); }
  else { sun.color.copy(K.sunDay).lerp(K.sunDusk, dusk); sun.intensity = 2.3 * sm(-0.04, 0.14, s); }
  hemi.color.copy(K.hemiSkyNight).lerp(K.hemiSkyDay, day);
  hemi.groundColor.copy(K.hemiGrNight).lerp(K.hemiGrDay, day);
  hemi.intensity = 0.95 + 0.05 * day;
  cloudMat.color.copy(tmp2.set('#2a3458').lerp(tmp.set('#ffffff'), day)).lerp(K.duskHor, dusk * 0.4);
  // light and shadow follow the hero (snapped, so the shadows don't shimmer as you walk)
  const snap = 4;
  const fx = Math.round(focus.x / snap) * snap, fz = Math.round(focus.z / snap) * snap;
  sun.target.position.set(fx, focus.y, fz);
  sun.position.set(fx + sky.lightDir.x * 280, focus.y + sky.lightDir.y * 280, fz + sky.lightDir.z * 280);
  dome.position.copy(camera.position);
  placeClouds(focus.x, focus.z, performance.now() / 1000);
}
// (the time of day as a clock: 0 midnight, 0.5 noon)
export function clock() { const m = Math.floor(sky.t * 24 * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
