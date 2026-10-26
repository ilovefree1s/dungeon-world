// ============================================================================
//  DUNGEON WORLD  -  world: the chunks around the hero. They are built by
//  workers (genworker.js), turned into meshes a couple a frame, and dropped
//  again far behind you. Also answers "what block is here?" for walking.
// ============================================================================
import { THREE, scene, view } from './engine.js';
import { createGen, CH, WH, SEA, isSolid, isWater, isLava, isLeaf, STONE, LAVA } from './gen.js';
import { buildFlora, buildGrass } from './flora.js';

// (the blocks' colors are written as sRGB bytes: turn them linear in the shader)
function linearColors(m) {
  m.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_COLOR\nvColor.rgb = pow(vColor.rgb, vec3(2.2));\n#endif'); };
  return m;
}
export const MAT = {
  solid: linearColors(new THREE.MeshLambertMaterial({ vertexColors: true })),
  land: linearColors(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide })),
  flora: linearColors(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })),
  glow: linearColors(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.9, 1.9, 1.9) })),
  water: linearColors(new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.74, shininess: 48, specular: new THREE.Color('#6a86a8'), depthWrite: false })),
};
const UNLOADED = 255;
const key = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);

export class World {
  constructor(seed, flat = false, poly = true) {
    this.seed = seed; this.flat = flat; this.poly = poly;
    this.grassDensity = 0.5; this.grassRange = 2; // (chunks of grass around the hero; set by the quality)
    this.gen = createGen(seed, flat);
    this.chunks = new Map();       // key -> { cx, cz, vox, group, state }
    this.group = new THREE.Group(); scene.add(this.group);
    this.inbox = [];               // finished chunks waiting for their meshes
    this.inflight = 0;
    this.jobId = 0;
    this.stats = { built: 0, genMs: 0, meshMs: 0, tris: 0, workers: 0 };
    this.workers = [];
    const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));
    try {
      for (let i = 0; i < n; i++) {
        const url = globalThis.__DW_WORKER_URL || new URL('./genworker.js', import.meta.url);
        const w = new Worker(url, globalThis.__DW_WORKER_URL ? undefined : { type: 'module' });
        w.onmessage = e => { this.inflight--; w.busy--; this.inbox.push(e.data); };
        w.onerror = e => { console.warn('chunk worker failed, building on the main thread', e.message); this.dropWorkers(); };
        w.postMessage({ type: 'init', seed, flat });
        w.busy = 0;
        this.workers.push(w);
      }
    } catch (e) { console.warn('no workers', e); this.dropWorkers(); }
    this.stats.workers = this.workers.length;
  }
  dropWorkers() {
    for (const w of this.workers) w.terminate();
    this.workers = []; this.stats.workers = 0;
    // (anything they were building is asked for again)
    for (const c of this.chunks.values()) if (c.state === 1) { this.chunks.delete(key(c.cx, c.cz)); }
    this.inflight = 0;
  }
  // ---------------------------------------------------------------- blocks
  get(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0) return STONE;
    if (y >= WH) return 0;
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH), c = this.chunks.get(key(cx, cz));
    if (!c || !c.vox) return UNLOADED;
    return c.vox[(y * CH + (z - cz * CH)) * CH + (x - cx * CH)];
  }
  solid(x, y, z) { const id = this.get(x, y, z); return id === UNLOADED || isSolid(id); }
  // (the camera passes through leaves: a tree's crown never hides the hero)
  camBlock(x, y, z) { const id = this.get(x, y, z); return id !== UNLOADED && isSolid(id) && !isLeaf(id); }
  water(x, y, z) { return isWater(this.get(x, y, z)); }
  lava(x, y, z) { return isLava(this.get(x, y, z)); }
  loaded(x, z) { const c = this.chunks.get(key(Math.floor(x / CH), Math.floor(z / CH))); return !!(c && (c.vox || c.hf)); }
  // the top solid block under a point (or -1)
  groundY(x, z, from = WH - 1) { for (let y = Math.min(WH - 1, Math.floor(from)); y >= 0; y--) if (this.solid(x, y, z)) return y; return -1; }

  // ---------------------------------------------------------------- loading
  // ask for the chunks in view distance around (px, pz), nearest first (and those ahead of the camera)
  update(px, pz, fx = 0, fz = 0) {
    const R = view.viewDist, rc = Math.ceil(R / CH) + 1;
    const pcx = Math.floor(px / CH), pcz = Math.floor(pz / CH);
    const want = [];
    for (let dz = -rc; dz <= rc; dz++) for (let dx = -rc; dx <= rc; dx++) {
      const cx = pcx + dx, cz = pcz + dz;
      const mx = cx * CH + CH / 2 - px, mz = cz * CH + CH / 2 - pz, d = Math.hypot(mx, mz);
      if (d > R + CH * 0.75) continue;
      if (this.chunks.has(key(cx, cz))) continue;
      // (chunks behind you count as a little farther)
      const ahead = d > 1 ? (mx * fx + mz * fz) / d : 1;
      want.push([d - ahead * 24, cx, cz]);
    }
    want.sort((a, b) => a[0] - b[0]);
    const cap = this.workers.length ? this.workers.length * 2 : 1;
    for (const [, cx, cz] of want) {
      if (this.workers.length) {
        if (this.inflight >= cap) break;
        const w = this.workers.reduce((a, b) => (a.busy <= b.busy ? a : b));
        w.busy++; this.inflight++;
        w.postMessage({ type: 'gen', id: ++this.jobId, cx, cz, poly: this.poly });
        this.chunks.set(key(cx, cz), { cx, cz, vox: null, group: null, state: 1 });
      } else {
        // (no workers: one chunk a frame here)
        const t = performance.now();
        const c = this.poly ? this.gen.polyChunk(cx, cz) : this.gen.chunk(cx, cz);
        this.stats.genMs = performance.now() - t;
        this.chunks.set(key(cx, cz), { cx, cz, vox: null, group: null, state: 1 });
        this.inbox.push(c);
        break;
      }
    }
    // turn finished chunks into meshes (a few a frame: uploading them is the cost)
    const t0 = performance.now();
    let n = 0;
    while (this.inbox.length && (n < 1 || performance.now() - t0 < 4) && n < 4) { this.build(this.inbox.shift(), px, pz); n++; }
    // drop far ones; grass only near the hero
    const gcx = Math.floor(px / CH), gcz = Math.floor(pz / CH);
    for (const [k, c] of this.chunks) {
      if (c.state !== 2) continue;
      const d = Math.hypot(c.cx * CH + CH / 2 - px, c.cz * CH + CH / 2 - pz);
      if (d > R + CH * 2) { this.unload(k, c); continue; }
      if (this.poly && c.grassSpots) {
        const near = Math.abs(c.cx - gcx) <= this.grassRange && Math.abs(c.cz - gcz) <= this.grassRange;
        if (near && !c.grass && this.grassDensity > 0) { c.grass = buildGrass(c.grassSpots, this.grassDensity, 0, 0); if (c.grass) { c.group.add(c.grass); c.grass.updateMatrixWorld(true); } else c.grassSpots = null; }
        else if (!near && c.grass) { c.group.remove(c.grass); c.grass.dispose(); c.grass = null; }
      }
    }
  }
  // the grass follows the quality: how thick, how far
  setGrass(density, range) {
    if (density === this.grassDensity && range === this.grassRange) return;
    this.grassDensity = density; this.grassRange = range;
    for (const c of this.chunks.values()) if (c.grass) { c.group.remove(c.grass); c.grass.dispose(); c.grass = null; }
  }
  build(d, px, pz) {
    const k = key(d.cx, d.cz), c = this.chunks.get(k);
    if (!c) return; // (unloaded while it was being built)
    const t = performance.now();
    c.vox = d.vox || null; c.hf = d.hf || null; c.state = 2;
    const g = new THREE.Group();
    g.position.set(d.cx * CH, 0, d.cz * CH);
    const sphere = new THREE.Sphere(new THREE.Vector3(CH / 2, d.top / 2, CH / 2), Math.hypot(CH / 2, CH / 2, d.top / 2) + 12);
    for (const kind of ['solid', 'glow', 'water']) {
      const b = d[kind];
      if (!b.i.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(b.p, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(b.n, 3, true));
      geo.setAttribute('color', new THREE.BufferAttribute(b.c, 3, true));
      geo.setIndex(new THREE.BufferAttribute(b.i, 1));
      geo.boundingSphere = sphere;
      const m = new THREE.Mesh(geo, kind === 'solid' && d.poly ? MAT.land : MAT[kind]);
      m.matrixAutoUpdate = false;
      if (kind === 'solid') { m.castShadow = true; m.receiveShadow = true; }
      if (kind === 'water') m.renderOrder = 2;
      g.add(m);
      this.stats.tris += b.i.length / 3;
    }
    if (d.poly) {
      // the trees and rocks, and the trunks to walk around; the grass comes when the hero is near
      c.trees0 = d.trees;
      const f = buildFlora(this.cleared(d.trees, d.cx * CH, d.cz * CH), MAT.flora, MAT.glow);
      for (const m of f.meshes) { m.userData.flora = true; g.add(m); }
      c.trunks = f.trunks; c.grassSpots = d.grass.length ? d.grass : null; c.grass = null;
    }
    g.updateMatrixWorld(true);
    g.matrixAutoUpdate = false;
    this.group.add(g);
    c.group = g;
    this.stats.built++;
    this.stats.meshMs = performance.now() - t;
  }
  // clearings (a camp's ground): no trees or rocks inside them, in chunks built now or later
  cleared(list, ox, oz) {
    if (!this.clearings || !this.clearings.length) return list;
    const out = [];
    for (let i = 0; i < list.length; i += 6) {
      const x = list[i + 1] + ox, z = list[i + 3] + oz;
      if (this.clearings.some(c => (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r)) continue;
      for (let j = 0; j < 6; j++) out.push(list[i + j]);
    }
    return out;
  }
  clearAround(x, z, r) {
    (this.clearings ||= []).push({ x, z, r });
    for (const c of this.chunks.values()) {
      if (!c.group || !c.trees0) continue;
      const ox = c.cx * CH, oz = c.cz * CH;
      if (x + r < ox || x - r > ox + CH || z + r < oz || z - r > oz + CH) continue;
      for (const m of [...c.group.children]) if (m.userData.flora) { c.group.remove(m); m.dispose && m.dispose(); }
      const f = buildFlora(this.cleared(c.trees0, ox, oz), MAT.flora, MAT.glow);
      for (const m of f.meshes) { m.userData.flora = true; c.group.add(m); }
      c.trunks = f.trunks; c.group.updateMatrixWorld(true);
    }
  }
  unload(k, c) {
    if (c.group) {
      c.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); else if (o.geometry && o.geometry.index) { this.stats.tris -= (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; o.geometry.dispose(); } });
      this.group.remove(c.group);
    }
    this.chunks.delete(k);
  }
  // ---------------------------------------------------------------- the low-poly land
  // the ground's height under a point (the same triangles the mesh shows), or null where no chunk is yet
  ground(x, z) {
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH), c = this.chunks.get(key(cx, cz));
    if (!c || !c.hf) return null;
    const PV = CH / 2 + 1, lx = (x - cx * CH) / 2, lz = (z - cz * CH) / 2;
    const i = Math.min(PV - 2, Math.floor(lx)), j = Math.min(PV - 2, Math.floor(lz)), fx = lx - i, fz = lz - j, k = j * PV + i, H = c.hf;
    const h00 = H[k], h10 = H[k + 1], h01 = H[k + PV], h11 = H[k + PV + 1];
    if ((i + j) & 1) { // the diagonal from (0,0) to (1,1)
      return fx > fz ? h00 + (h10 - h00) * fx + (h11 - h10) * fz : h00 + (h01 - h00) * fz + (h11 - h01) * fx;
    }
    // the diagonal from (1,0) to (0,1)
    return fx + fz < 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }
  // the trunks within reach of a point: [x, z, r] triples from this chunk and its neighbors
  trunksNear(x, z) {
    const out = [];
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const c = this.chunks.get(key(cx + dx, cz + dz)); if (c && c.trunks) out.push([c.trunks, (cx + dx) * CH, (cz + dz) * CH]); }
    return out;
  }
  // pushed out of any trunk: returns [x, z] moved clear
  clearOfTrunks(x, z, rad) {
    for (const [T, ox, oz] of this.trunksNear(x, z)) for (let i = 0; i < T.length; i += 3) {
      const tx = ox + T[i], tz = oz + T[i + 1], r = T[i + 2] + rad, dx = x - tx, dz = z - tz, d = Math.hypot(dx, dz);
      if (d < r) { const k = (r - d) / (d || 1); x += dx * k || r; z += dz * k; }
    }
    return [x, z];
  }
  // water (or lava) over the land here: the sea's surface where the ground dips under it
  seaAt(x, z) { const g = this.ground(x, z); return g !== null && g < SEA + 0.86; }
  lavaAt(x, z) { return this.seaAt(x, z) && this.gen.column(Math.floor(x), Math.floor(z)).pick === LAVA; }
  // how many of the chunks within r of a point are ready
  readyAround(px, pz, r = 48) {
    let need = 0, have = 0;
    const rc = Math.ceil(r / CH);
    for (let dz = -rc; dz <= rc; dz++) for (let dx = -rc; dx <= rc; dx++) {
      const cx = Math.floor(px / CH) + dx, cz = Math.floor(pz / CH) + dz;
      if (Math.hypot(cx * CH + CH / 2 - px, cz * CH + CH / 2 - pz) > r + CH) continue;
      need++; const c = this.chunks.get(key(cx, cz)); if (c && c.state === 2) have++;
    }
    return have / Math.max(1, need);
  }
  counts() { let ready = 0, pending = 0; for (const c of this.chunks.values()) c.state === 2 ? ready++ : pending++; return { ready, pending, inbox: this.inbox.length }; }
  // a good place to start: dry land near the middle of the first woods
  spawnPoint() {
    const [sx, sz] = this.gen.site(0, 0);
    for (let r = 0; r < 200; r += 3) for (let a = 0; a < 16; a++) {
      const x = Math.round(sx + Math.cos(a / 16 * Math.PI * 2) * r), z = Math.round(sz + Math.sin(a / 16 * Math.PI * 2) * r);
      const c = this.gen.column(x, z);
      if (c.h > SEA + 4 && c.biome === 0) return [x + 0.5, c.h + 1, z + 0.5];
    }
    return [sx, 120, sz];
  }
}
