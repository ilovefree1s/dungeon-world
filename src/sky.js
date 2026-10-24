// ============================================================================
//  DUNGEON WORLD  -  sky: day and night. A round sun and moon, stars, blocky
//  clouds, and the light, fog and sky colors through the day.
// ============================================================================
import { THREE, scene, camera, hemi, sun, view } from './engine.js';

export const DAY_LEN = 600; // seconds for a whole day
export const sky = { t: 0.32, speed: 1, day: 1, night: 0, sunDir: new THREE.Vector3(), lightDir: new THREE.Vector3() };

const C = c => new THREE.Color(c);
const uni = {
  topCol: { value: C('#3a8ee6') }, horCol: { value: C('#b7dcff') }, groundCol: { value: C('#6a7f96') },
  sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: C('#fff2c8') }, night: { value: 0 }, dusk: { value: 0 }, time: { value: 0 }, phase: { value: 0.5 },
};
const dome = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), new THREE.ShaderMaterial({
  uniforms: uni, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
  fragmentShader: `
    uniform vec3 topCol, horCol, groundCol, sunDir, sunCol; uniform float night, dusk, time, phase; varying vec3 vDir;
    // where on a disc around the direction c the view direction d falls: (x, y) on the disc, in units of its size
    vec2 onDisc(vec3 d, vec3 c, float size, out float front){
      vec3 up = abs(c.y) < 0.99 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0);
      vec3 u = normalize(cross(up, c)), v = cross(c, u);
      float f = dot(d, c); front = step(0.0, f);
      return vec2(dot(d,u), dot(d,v)) / max(f, 1e-4) / size;
    }
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1,0)), f.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
    void main(){
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 col = mix(horCol, topCol, pow(clamp(h, 0.0, 1.0), 0.55));
      col = mix(col, groundCol, clamp(-h * 3.0, 0.0, 1.0));
      float sd = max(dot(d, sunDir), 0.0);
      // (a soft warmth around the sun, wide and low at dusk)
      col += sunCol * (pow(sd, 12.0) * 0.16 * (1.0 - night) + pow(sd, 3.0) * 0.14 * dusk);
      // (nothing in the sky but the discs brighter than this: the bloom pass picks up anything over 0.9 and smears it)
      col = min(col, vec3(0.82));
      vec3 s = floor(d * 240.0);
      float r = fract(sin(dot(s, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      float stars = step(0.9972, r) * night * clamp(h * 4.0, 0.0, 1.0) * (0.45 + 0.3 * fract(r * 91.0));
      stars *= 0.65 + 0.35 * sin(time * (1.5 + fract(r * 57.0) * 3.0) + r * 40.0);   // (they twinkle)
      col += vec3(stars);
      // ---- the sun: a round disc, darker toward its rim, a corona and slow rays around it; bigger and redder low down
      float fs; float R = 0.045 * (1.0 + 0.3 * dusk);
      vec2 qs = onDisc(d, sunDir, R, fs); float rs = length(qs);
      float vis = fs * smoothstep(-0.06, 0.02, sunDir.y);   // (it sets below the land, not into the night)
      vec3 sunC = mix(vec3(1.0, 0.9, 0.62), vec3(1.0, 0.5, 0.22), dusk);
      float ang = atan(qs.y, qs.x);
      float rays = (0.5 + 0.5 * sin(ang * 9.0 + time * 0.15)) * (0.5 + 0.5 * sin(ang * 14.0 - time * 0.11));
      float corona = exp(-max(rs - 1.0, 0.0) * 1.1) * 0.22 + exp(-max(rs - 1.0, 0.0) * 0.25) * 0.08 + rays * exp(-max(rs - 1.0, 0.0) * 0.55) * 0.07;
      col = min(col + sunC * corona * vis * step(1.0, rs), vec3(0.88));
      float sdisc = 1.0 - smoothstep(0.95, 1.02, rs);
      vec3 face = sunC * (0.86 + 0.1 * (1.0 - rs * rs)) * (1.0 - 0.06 * fbm(qs * 3.0 + time * 0.05));
      // (the disc alone is let past the cap: small enough that the bloom only rings it)
      col = mix(col, face * 2.2, sdisc * vis);
      // ---- the moon: a round disc with its seas and craters, lit from one side by its phase, a cool halo
      float fm; vec2 qm = onDisc(d, -sunDir, 0.042, fm); float rm = length(qm);
      float mvis = fm * night;
      col += vec3(0.55, 0.62, 0.8) * (exp(-max(rm - 1.0, 0.0) * 1.3) * 0.12 + exp(-max(rm - 1.0, 0.0) * 0.3) * 0.05) * mvis * step(1.0, rm);
      if (rm < 1.03) {
        vec3 n = vec3(qm, sqrt(max(0.0, 1.0 - rm * rm)));
        float pa = phase * 6.2832; vec3 L = vec3(sin(pa), 0.15, -cos(pa));
        float lit = smoothstep(-0.08, 0.12, dot(n, normalize(L)));
        float seas = smoothstep(0.42, 0.7, fbm(qm * 1.6 + 3.0));
        float crater = 0.0;
        for (int i = 0; i < 7; i++) { vec2 c = vec2(h21(vec2(float(i), 1.0)), h21(vec2(float(i), 2.0))) * 1.5 - 0.75; float cr = 0.08 + 0.12 * h21(vec2(float(i), 3.0));
          float dd = length(qm - c) / cr; crater += (smoothstep(0.75, 1.0, dd) - smoothstep(1.0, 1.15, dd)) * 0.5 - (1.0 - smoothstep(0.0, 0.85, dd)) * 0.18; }
        float alb = 0.86 - seas * 0.22 + crater * 0.25 + (fbm(qm * 9.0) - 0.5) * 0.08;
        vec3 mc = vec3(0.86, 0.88, 0.93) * alb * (0.1 + 0.9 * lit) * (0.88 + 0.12 * n.z);
        float mdisc = 1.0 - smoothstep(0.96, 1.02, rm);
        col = mix(col, min(mc, vec3(0.93)), mdisc * mvis);
      }

      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
dome.renderOrder = -10; dome.frustumCulled = false;
scene.add(dome);

// ---------------------------------------------------------------- clouds
// each cloud is a cluster of flattened low-poly puffs along a long footprint, biggest in the
// middle, their undersides more or less level; one instanced mesh for all of them
const NCLOUD = 40, TILE = 1440;
const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.5, transparent: true, opacity: 0.92, fog: false, flatShading: true });
const cloudBase = [], puffs = [];
{
  let s = 12345; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < NCLOUD; i++) {
    const w = 36 + r() * 92, d = 24 + r() * 50, h = 10 + r() * 8;
    const n = 5 + Math.floor(r() * 5);
    const list = [];
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n - 0.5 + (r() - 0.5) * 0.15;          // along the cloud
      const bulge = 1 - Math.abs(u) * 1.3;                           // fat in the middle, thin at the ends
      const rx = (0.55 + bulge * 0.6 + r() * 0.3) * h, rz = rx * (0.7 + r() * 0.5), ry = rx * (0.55 + r() * 0.25);
      list.push({ ox: u * w, oz: (r() - 0.5) * d * 0.6, oy: ry * 0.45 + r() * 2, rx, ry, rz, turn: r() * 6.28 });
    }
    // (a couple of small puffs riding on top)
    for (let k = 0; k < 2; k++) { const rx = h * (0.35 + r() * 0.25); list.push({ ox: (r() - 0.5) * w * 0.5, oz: (r() - 0.5) * d * 0.3, oy: h * 0.9 + rx * 0.3, rx, ry: rx * 0.7, rz: rx * 0.9, turn: r() * 6.28 }); }
    cloudBase.push({ x: r() * TILE, z: r() * TILE, y: 224 + r() * 36, list });
    puffs.push(...list);
  }
}
const clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), cloudMat, puffs.length);
clouds.frustumCulled = false;
scene.add(clouds);
const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
function placeClouds(px, pz, t) {
  const drift = t * 4.4;
  let i = 0;
  for (const c of cloudBase) {
    const x = ((c.x + drift - px) % TILE + TILE) % TILE - TILE / 2 + px;
    const z = ((c.z - pz) % TILE + TILE) % TILE - TILE / 2 + pz;
    for (const p of c.list) {
      pv.set(x + p.ox, c.y + p.oy, z + p.oz); sv.set(p.rx, p.ry, p.rz); q0.setFromAxisAngle(yAxis, p.turn);
      clouds.setMatrixAt(i++, m4.compose(pv, q0, sv));
    }
  }
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
  { const t0 = sky.t; sky.t = (sky.t + dt * sky.speed / DAY_LEN) % 1; if (sky.t < t0) sky.days = (sky.days || 0) + 1; }
  uni.time.value += dt;
  // (the moon's phase goes round every eight days: full on the fourth night)
  uni.phase.value = (((sky.days || 0) + sky.t) / 8 + 0.5) % 1;
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
  cloudMat.color.copy(tmp2.set('#2a3458').lerp(tmp.set('#ffffff'), day)).lerp(K.duskHor, dusk * 0.4); cloudMat.emissive.copy(cloudMat.color);
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
