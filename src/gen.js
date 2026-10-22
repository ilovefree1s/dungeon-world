// ============================================================================
//  DUNGEON WORLD  -  gen: the endless block world. Biomes, heights, trees and
//  the meshes of one chunk (32 x 32 columns, 96 blocks high). No imports, no
//  three.js: it runs in a worker (genworker.js) and on the main thread.
// ============================================================================
// (a block is half a hero-stride across: the land is twice as fine as the heroes' own scale)
export const CH = 32, WH = 192, SEA = 48;
export const FOREST = 0, SNOW = 1, DESERT = 2, SWAMP = 3, LAVA = 4, CRYSTAL = 5;
export const BIOME_NAME = ['WHISPERWOOD', 'FROSTPEAK REACH', 'SUNSCORCH DUNES', 'MIREHOLLOW BOG', 'CINDERWASTE', 'PRISM HIGHLANDS'];
export const BIOME_SUB = ['the green woods', 'the frozen mountains', 'the burning sands', 'the sunken marsh', 'the ash and fire', 'the shining cliffs'];

// ---------------------------------------------------------------- blocks
// [id]: color, kind (1 solid, 2 glowing solid, 3 small decoration, 4 glowing decoration, 5 water, 6 lava)
export const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, SNOWB = 5, ICE = 6, SST1 = 7, SST2 = 8, SST3 = 9,
  MUDGRASS = 10, MUD = 11, ASH = 12, BASALT = 13, MAGMA = 14, PRISMMOSS = 15, PURPLESTONE = 16, CRYSTALB = 17,
  WOOD = 18, LEAVES = 19, PINE = 20, SNOWLEAF = 21, CACTUS = 22, SWAMPWOOD = 23, SWAMPLEAF = 24, CHARWOOD = 25,
  PALEWOOD = 26, PALELEAF = 27, MOSSSTONE = 28, LEAVES2 = 29, OBSIDIAN = 30,
  TUFT = 40, FLOWER_R = 41, FLOWER_Y = 42, FLOWER_B = 43, DEADBUSH = 44, MUSHROOM = 45, GLOWSHROOM = 46, SHARD = 47,
  EMBER = 48, REED = 49, PEBBLE = 50, FERN = 51,
  WATER = 60, LAVAL = 61;
const COL = new Uint8Array(256 * 3), KIND = new Uint8Array(256), DW = new Float32Array(256), DH = new Float32Array(256);
function def(id, rgb, kind, w = 1, h = 1) { COL.set(rgb, id * 3); KIND[id] = kind; DW[id] = w; DH[id] = h; }
def(GRASS, [92, 170, 60], 1); def(DIRT, [128, 88, 56], 1); def(STONE, [124, 124, 130], 1); def(SAND, [224, 200, 140], 1);
def(SNOWB, [238, 244, 252], 1); def(ICE, [160, 210, 244], 1); def(SST1, [214, 146, 92], 1); def(SST2, [186, 112, 72], 1); def(SST3, [232, 180, 118], 1);
def(MUDGRASS, [92, 112, 50], 1); def(MUD, [86, 70, 50], 1); def(ASH, [104, 94, 96], 1); def(BASALT, [66, 58, 66], 1);
def(MAGMA, [255, 104, 24], 2); def(PRISMMOSS, [96, 200, 196], 1); def(PURPLESTONE, [98, 74, 146], 1); def(CRYSTALB, [196, 120, 255], 2);
def(WOOD, [112, 76, 44], 1); def(LEAVES, [62, 150, 48], 1); def(LEAVES2, [104, 176, 52], 1); def(PINE, [40, 94, 62], 1); def(SNOWLEAF, [222, 236, 244], 1);
def(CACTUS, [70, 146, 64], 1); def(SWAMPWOOD, [70, 56, 40], 1); def(SWAMPLEAF, [74, 102, 44], 1); def(CHARWOOD, [34, 30, 32], 1);
def(PALEWOOD, [214, 204, 232], 1); def(PALELEAF, [236, 132, 214], 1); def(MOSSSTONE, [106, 122, 100], 1); def(OBSIDIAN, [46, 36, 66], 1);
def(TUFT, [110, 184, 64], 3, 0.99, 0.61); def(FERN, [64, 140, 54], 3, 1.26, 0.95);
def(FLOWER_R, [236, 58, 64], 3, 0.54, 0.95); def(FLOWER_Y, [252, 212, 56], 3, 0.54, 0.85); def(FLOWER_B, [110, 140, 252], 3, 0.54, 1.04);
def(DEADBUSH, [150, 112, 66], 3, 0.90, 0.85); def(MUSHROOM, [224, 64, 52], 3, 0.76, 0.80); def(GLOWSHROOM, [120, 255, 210], 4, 0.65, 0.95);
def(SHARD, [220, 150, 255], 4, 0.47, 1.52); def(EMBER, [255, 140, 40], 4, 0.47, 0.49); def(REED, [120, 146, 66], 3, 0.32, 1.80);
def(PEBBLE, [130, 128, 132], 3, 1.08, 0.57);
def(WATER, [40, 110, 170], 5); def(LAVAL, [255, 90, 20], 6);
export const isSolid = id => KIND[id] === 1 || KIND[id] === 2;
export const isWater = id => KIND[id] === 5;
export const isLava = id => KIND[id] === 6;
const LEAFY = new Set([19, 20, 21, 24, 27, 29]);
export const isLeaf = id => LEAFY.has(id);
// (which ones block the faces of their neighbors)
const OPAQUE = new Uint8Array(256); for (let i = 0; i < 256; i++) OPAQUE[i] = KIND[i] === 1 || KIND[i] === 2 ? 1 : 0;

// ---------------------------------------------------------------- noise
function hash3(x, y, z, s) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function rngOf(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function simplex(seed) {
  const r = rngOf(seed), p = new Uint8Array(256), perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const GX = [1, -1, 1, -1, 1, -1, 0, 0], GY = [1, 1, -1, -1, 0, 0, 1, -1];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return (xin, yin) => {
    const s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s), t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, tt;
    tt = 0.5 - x0 * x0 - y0 * y0; if (tt > 0) { const g = perm[ii + perm[jj]] & 7; tt *= tt; n += tt * tt * (GX[g] * x0 + GY[g] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1; if (tt > 0) { const g = perm[ii + i1 + perm[jj + j1]] & 7; tt *= tt; n += tt * tt * (GX[g] * x1 + GY[g] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2; if (tt > 0) { const g = perm[ii + 1 + perm[jj + 1]] & 7; tt *= tt; n += tt * tt * (GX[g] * x2 + GY[g] * y2); }
    return 70 * n;
  };
}
function fbm(n, x, z, oct) { let a = 1, f = 1, s = 0, m = 0; for (let o = 0; o < oct; o++) { s += a * n(x * f, z * f); m += a; a *= 0.5; f *= 2.03; } return s / m; }
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
// mostly flat steps with steep rises between them: cliffs
// (in the heroes' units: heights are doubled after blending)
function terrace(h, step) { const f = h / step, i = Math.floor(f), t = f - i; return (i + clamp01((t - 0.72) / 0.28)) * step; }

// ---------------------------------------------------------------- the world
export const REGION = 1000; // (the size of a biome region: a few minutes' walk across)
export function createGen(seed = 1, flat = false) {
  const nA = simplex(seed * 7 + 1), nB = simplex(seed * 7 + 2), nC = simplex(seed * 7 + 3), nD = simplex(seed * 7 + 4), nW = simplex(seed * 7 + 5), nT = simplex(seed * 7 + 6);
  // biome regions: a jittered grid of sites; the one at 0,0 is the woods where you start, and its eight
  // neighbors hold every other biome, so all of them are a short walk away
  const ring = [SNOW, DESERT, SWAMP, LAVA, CRYSTAL, FOREST, DESERT, SWAMP];
  const rot = Math.floor(hash3(seed, 1, 2, 3) * 5);
  const ringPos = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  function biomeOfCell(i, j) {
    if (i === 0 && j === 0) return FOREST;
    if (Math.abs(i) <= 1 && Math.abs(j) <= 1) {
      const k = ringPos.findIndex(p => p[0] === i && p[1] === j);
      return ring[(k + rot) % 8];
    }
    // farther out: random, with the woods a little more common
    const h = hash3(i, j, seed, 11);
    return h < 0.24 ? FOREST : Math.floor((h - 0.24) / 0.76 * 5) + 1;
  }
  function siteX(i, j) { return (i + 0.2 + 0.6 * hash3(i, j, seed, 21)) * REGION; }
  function siteZ(i, j) { return (j + 0.2 + 0.6 * hash3(i, j, seed, 22)) * REGION; }
  const BLEND = 110;
  const wts = new Float32Array(6);
  // the biome weights at a column (into wts); returns the strongest
  function weights(x, z) {
    const wx = x + 140 * nW(x / 640, z / 640), wz = z + 140 * nW(x / 640 + 41.3, z / 640 + 17.7);
    const ci = Math.floor(wx / REGION), cj = Math.floor(wz / REGION);
    let d1 = 1e9;
    const ds = [], bs = [];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = ci + di, j = cj + dj, dx = siteX(i, j) - wx, dz = siteZ(i, j) - wz, d = Math.sqrt(dx * dx + dz * dz);
      ds.push(d); bs.push(biomeOfCell(i, j)); if (d < d1) d1 = d;
    }
    wts.fill(0);
    let sum = 0;
    for (let k = 0; k < 9; k++) {
      const t = 1 - (ds[k] - d1) / BLEND;
      if (t <= 0) continue;
      const w = t * t * (3 - 2 * t);
      wts[bs[k]] += w; sum += w;
    }
    let best = 0;
    for (let b = 0; b < 6; b++) { wts[b] /= sum; if (wts[b] > wts[best]) best = b; }
    return best;
  }
  function heightOf(b, x, z) {
    switch (b) {
      case FOREST: {
        // rolling meadows, a few bluffs
        let h = 31 + 7 * fbm(nA, x / 150, z / 150, 3) + 1.6 * fbm(nB, x / 40, z / 40, 2);
        const c = nC(x / 170, z / 170);
        if (c > 0.3) h += 8 * clamp01((c - 0.3) * 3);
        if (c > 0.42) h = h + (terrace(h, 4) - h) * clamp01((c - 0.42) * 5);
        const lake = nD(x / 140, z / 140); if (lake < -0.45) h -= 14 * clamp01((-0.45 - lake) * 4);
        return h;
      }
      case SNOW: {
        const r = 1 - Math.abs(fbm(nA, x / 190, z / 190, 3)); // ridges
        let h = 33 + 34 * r * r * r + 4 * fbm(nB, x / 26, z / 26, 2);
        const c = nC(x / 90, z / 90); if (c > 0.3) h = h + (terrace(h, 5) - h) * clamp01((c - 0.3) * 4);
        const lake = nD(x / 120, z / 120); if (lake < -0.5) h -= 16 * clamp01((-0.5 - lake) * 4);
        return h;
      }
      case DESERT: {
        let h = 28 + 3.2 * Math.abs(nB(x / 38, z / 60)) + 1.5 * nA(x / 90, z / 90);
        const m = nC(x / 120 + 100, z / 120); if (m > 0.28) h += 14 * clamp01((m - 0.28) * 7); // mesas
        const o = nD(x / 110, z / 110); if (o < -0.55) h -= 10 * clamp01((-0.55 - o) * 5); // an oasis
        return h;
      }
      case SWAMP: return 23.4 + 2.4 * fbm(nA, x / 34, z / 34, 2) + 1.1 * nB(x / 9, z / 9) + 3 * clamp01(nC(x / 80, z / 80));
      case LAVA: {
        let h = 28 + 11 * Math.abs(fbm(nA, x / 70, z / 70, 3)) + 1.6 * nB(x / 6, z / 6);
        const p = nD(x / 60, z / 60); if (p > 0.3) h -= 12 * clamp01((p - 0.3) * 4); // lava pools
        const s = nC(x / 40, z / 40); if (s > 0.5) h += 10 * clamp01((s - 0.5) * 5); // spikes of rock
        return h;
      }
      case CRYSTAL: {
        let h = terrace(32 + 18 * fbm(nA, x / 100, z / 100, 3), 4) + 0.6 * nB(x / 12, z / 12);
        const l = nD(x / 120, z / 120); if (l < -0.5) h -= 13 * clamp01((-0.5 - l) * 4);
        return h;
      }
    }
    return 30;
  }
  const FLAT_BASE = [30, 34, 29, 23.4, 29, 32]; // (each biome's plain, in the heroes' units)
  const out = { h: 0, biome: 0, pick: 0, water: 0 };
  // one column: its height (the top solid block's y), the biome, the biome its surface shows
  // (dithered between neighbors at a border), the liquid over it
  function column(x, z) {
    if (flat) { out.h = 60; out.hf = 60; out.biome = 0; out.pick = 0; return out; } // (a flat meadow, for tests)
    const best = weights(x, z);
    let h = 0, base = 0;
    for (let b = 0; b < 6; b++) if (wts[b] > 0.002) { h += wts[b] * heightOf(b, x, z); base += wts[b] * FLAT_BASE[b]; }
    // plains: broad regions where the land settles to its biome's level, with the gentlest of rolls;
    // the hills and cliffs are what stands between them
    const plain = clamp01((nW(x / 420 + 7.3, z / 420 + 3.1) + 0.25) * 2.0);
    if (plain > 0) h += (base + 1.2 * fbm(nB, x / 80, z / 80, 2) - h) * plain;
    out.hf = Math.max(6, Math.min(WH - 20, h * 2)); // (the land's true height, for the low-poly skin)
    h = Math.max(6, Math.min(WH - 20, Math.floor(h * 2)));
    let pick = best;
    if (wts[best] < 0.98) { let r = hash3(x, 0, z, seed + 5) * 0.999, acc = 0; for (let b = 0; b < 6; b++) { acc += wts[b]; if (r < acc) { pick = b; break; } } }
    out.h = h; out.biome = best; out.pick = pick;
    return out;
  }

  // ---------------------------------------------------------------- a chunk's blocks
  const M = 10, GW = CH + 2 * M;          // (the columns around a chunk, for trees reaching over its edge)
  const P = CH + 2;                       // (the blocks: the chunk and a ring of its neighbors' for the faces)
  const colH = new Int16Array(GW * GW), colB = new Uint8Array(GW * GW), colP = new Uint8Array(GW * GW);
  const V = new Uint8Array(P * P * WH);
  const at = (x, y, z) => (y * P + (z + 1)) * P + (x + 1);
  let top = 0;
  function put1(x, y, z, id, over = false) {
    if (x < -1 || x > CH || z < -1 || z > CH || y < 1 || y >= WH) return;
    const i = at(x, y, z);
    if (!over && V[i] && !isWater(V[i]) && KIND[V[i]] !== 3 && KIND[V[i]] !== 4) return;
    V[i] = id; if (y > top) top = y;
  }
  function fillColumn(x, z, h, pick) {
    const stone = pick === DESERT ? -1 : pick === LAVA ? BASALT : pick === CRYSTAL ? PURPLESTONE : STONE;
    let topB, sub;
    const under = h < SEA;
    switch (pick) {
      case FOREST: topB = h <= SEA + 2 ? SAND : GRASS; sub = h <= SEA + 2 ? SAND : DIRT; break;
      case SNOW: topB = under ? DIRT : (h > 58 ? SNOWB : SNOWB); sub = h > 88 ? STONE : DIRT; break;
      case DESERT: topB = SAND; sub = SAND; break;
      case SWAMP: topB = under ? MUD : MUDGRASS; sub = MUD; break;
      case LAVA: topB = under ? BASALT : ASH; sub = BASALT; break;
      default: topB = under ? PURPLESTONE : PRISMMOSS; sub = PURPLESTONE;
    }
    for (let y = 1; y <= h; y++) {
      let id;
      if (y === h) id = topB;
      else if (y >= h - 6) id = sub;
      else if (stone < 0) id = [SST1, SST2, SST3, SST1, SST3][((y * 7 + (y >> 2)) % 5)]; // banded rock
      else id = stone;
      V[at(x, y, z)] = id;
    }
    V[at(x, 0, z)] = STONE;
    if (pick === LAVA && !under && hash3(x, h, z, seed + 9) < 0.05) V[at(x, h, z)] = MAGMA;
    // (glowing veins in the rock of the ash lands, seen on their cliffs)
    if (pick === LAVA) for (let y = Math.max(1, h - 16); y < h; y++) if (hash3(x, y, z, seed + 19) < 0.06) V[at(x, y, z)] = MAGMA;
    if (under) {
      const liq = pick === LAVA ? LAVAL : WATER;
      for (let y = h + 1; y <= SEA; y++) V[at(x, y, z)] = liq;
      if (pick === SNOW) V[at(x, SEA, z)] = ICE;
    }
    if (h > top) top = Math.max(h, SEA);
  }
  // ---- the trees and rocks, one per 5 x 5 cell at most
  function tree(kind, x, h, z, r) {
    const b = h + 1;
    // (the trees are drawn in the heroes' units: every block of theirs is a 2 x 2 x 2 cube of the land's)
    const put = (ax, ay, az, id, over) => { const dx = ax - x, dy = ay - b, dz = az - z; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) put1(x + 2 * dx + i, b + 2 * dy + j, z + 2 * dz + k, id, over); };
    if (kind === 'oak' || kind === 'birch') {
      const th = 4 + Math.floor(r() * 3), leaf = kind === 'oak' ? LEAVES : LEAVES2;
      for (let y = 0; y < th; y++) put(x, b + y, z, WOOD, true);
      const R = 2.3 + r() * 0.9, cy = b + th;
      for (let dy = -2; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        const d = dx * dx + dz * dz + dy * dy * 1.6;
        if (d < R * R && hash3(x + dx, cy + dy, z + dz, 77) > (d > (R - 1) * (R - 1) ? 0.25 : 0)) put(x + dx, cy + dy, z + dz, leaf);
      }
    } else if (kind === 'pine') {
      const th = 7 + Math.floor(r() * 4);
      for (let y = 0; y < th; y++) put(x, b + y, z, WOOD, true);
      for (let y = 2; y <= th + 1; y++) {
        const k = (th + 1 - y), R = Math.min(3, 0.6 + k * 0.42) * (y % 2 ? 1 : 0.8);
        for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dz * dz <= R * R) {
          if (!dx && !dz && y <= th) continue;
          put(x + dx, b + y, z + dz, hash3(x + dx, b + y, z + dz, 5) < 0.4 || y === th + 1 ? SNOWLEAF : PINE);
        }
      }
    } else if (kind === 'cactus') {
      const th = 2 + Math.floor(r() * 3);
      for (let y = 0; y < th; y++) put(x, b + y, z, CACTUS, true);
      if (th >= 3 && r() < 0.7) { const s = r() < 0.5 ? -1 : 1, ax = r() < 0.5; const ox = ax ? s : 0, oz = ax ? 0 : s; put(x + ox, b + 1, z + oz, CACTUS); put(x + ox, b + 2, z + oz, CACTUS); }
    } else if (kind === 'willow') {
      const th = 4 + Math.floor(r() * 3);
      for (let y = 0; y < th; y++) put(x, b + y, z, SWAMPWOOD, true);
      const R = 3.2 + r() * 0.8, cy = b + th;
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) for (let dy = -1; dy <= 1; dy++) {
        const d = dx * dx + dz * dz + dy * dy * 6;
        if (d < R * R) {
          put(x + dx, cy + dy, z + dz, SWAMPLEAF);
          // (hanging strands at the rim)
          if (dy === -1 && d > (R - 1.4) * (R - 1.4) && hash3(x + dx, 3, z + dz, 31) < 0.45) { const n = 1 + Math.floor(hash3(x + dx, 4, z + dz, 32) * 3); for (let k = 1; k <= n; k++) put(x + dx, cy - 1 - k, z + dz, SWAMPLEAF); }
        }
      }
    } else if (kind === 'char') {
      const th = 3 + Math.floor(r() * 3);
      for (let y = 0; y < th; y++) put(x, b + y, z, CHARWOOD, true);
      const s = r() < 0.5 ? 1 : -1; put(x + s, b + th - 1, z, CHARWOOD); put(x + s, b + th, z, CHARWOOD);
      put(x, b + th - 2, z - s, CHARWOOD);
      if (r() < 0.6) put(x - s, b + th - 1, z + s, EMBER);
    } else if (kind === 'spire') {
      const th = 4 + Math.floor(r() * 6);
      for (let y = 0; y < th; y++) { put(x, b + y, z, hash3(x, b + y, z, 3) < 0.18 ? MAGMA : OBSIDIAN, true); if (y < th / 2) { put(x + 1, b + y, z, BASALT); put(x, b + y, z + 1, BASALT); } }
    } else if (kind === 'crystal') {
      const th = 4 + Math.floor(r() * 5);
      for (let y = 0; y < th; y++) put(x, b + y, z, CRYSTALB, true);
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) { const ox = r() < 0.5 ? -1 : 1, oz = Math.floor(r() * 3) - 1, sh = 1 + Math.floor(r() * (th - 2)); for (let y = 0; y < sh; y++) put(x + ox, b + y, z + oz, CRYSTALB); }
    } else if (kind === 'pale') {
      const th = 4 + Math.floor(r() * 2);
      for (let y = 0; y < th; y++) put(x, b + y, z, PALEWOOD, true);
      const cy = b + th;
      for (let dy = -1; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dz * dz + dy * dy * 1.4 < 6) put(x + dx, cy + dy, z + dz, PALELEAF);
    } else if (kind === 'boulder' || kind === 'snowrock') {
      const R = 1.2 + r() * 0.9, m = kind === 'boulder' ? MOSSSTONE : STONE;
      for (let dy = 0; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dz * dz + dy * dy * 1.5 < R * R) put(x + dx, h + dy, z + dz, kind === 'snowrock' && dy >= 1 && dx * dx + dz * dz + (dy + 1) * (dy + 1) * 1.5 >= R * R ? SNOWB : m, true);
    } else if (kind === 'mesa_rock') {
      for (let y = 0; y < 2; y++) put(x, b + y, z, SST2, true);
    }
  }
  const TREES = [ // per biome: [chance per cell, kinds]
    [0.62, ['oak', 'oak', 'oak', 'birch', 'boulder']],
    [0.42, ['pine', 'pine', 'pine', 'snowrock']],
    [0.13, ['cactus', 'cactus', 'mesa_rock']],
    [0.4, ['willow', 'willow', 'oak']],
    [0.16, ['char', 'spire', 'char']],
    [0.24, ['crystal', 'crystal', 'pale']],
  ];
  function decorate(x, h, z, pick, wx, wz) {
    if (h < SEA) return;
    const r = hash3(wx, 5, wz, seed + 3);
    let d = 0;
    switch (pick) {
      case FOREST: d = h <= SEA + 1 ? 0 : r < 0.16 ? TUFT : r < 0.2 ? FERN : r < 0.215 ? FLOWER_R : r < 0.23 ? FLOWER_Y : r < 0.24 ? FLOWER_B : r < 0.245 ? PEBBLE : 0; break;
      case SNOW: d = r < 0.012 ? PEBBLE : 0; break;
      case DESERT: d = r < 0.012 ? DEADBUSH : r < 0.017 ? PEBBLE : 0; break;
      case SWAMP: d = r < 0.08 ? REED : r < 0.13 ? TUFT : r < 0.15 ? MUSHROOM : r < 0.165 ? GLOWSHROOM : 0; break;
      case LAVA: d = r < 0.02 ? EMBER : r < 0.03 ? PEBBLE : 0; break;
      case CRYSTAL: d = r < 0.05 ? SHARD : r < 0.1 ? TUFT : 0; break;
    }
    if (d) put1(x, h + 1, z, d);
  }

  // ---------------------------------------------------------------- meshing
  // faces: normal, corners (counter-clockwise seen from outside), the two axes along the face
  const FACES = [
    [1, 0, 0, [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], 1, 2],
    [-1, 0, 0, [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], 1, 2],
    [0, 1, 0, [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], 0, 2],
    [0, -1, 0, [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], 0, 2],
    [0, 0, 1, [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], 0, 1],
    [0, 0, -1, [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], 0, 1],
  ];
  const AO = [0.5, 0.68, 0.84, 1];
  function buf(n) { return { p: new Float32Array(n * 3), n: new Int8Array(n * 3), c: new Uint8Array(n * 3), i: new Uint32Array(n * 1.5), nv: 0, ni: 0 }; }
  function grow(b) {
    const p = new Float32Array(b.p.length * 2); p.set(b.p); b.p = p;
    const n = new Int8Array(b.n.length * 2); n.set(b.n); b.n = n;
    const c = new Uint8Array(b.c.length * 2); c.set(b.c); b.c = c;
    const i = new Uint32Array(b.i.length * 2); i.set(b.i); b.i = i;
  }
  const B = { solid: buf(40000), glow: buf(8000), water: buf(8000) };
  function quad(b, ps, nx, ny, nz, r, g, bl, ao) {
    if ((b.nv + 4) * 3 > b.p.length) grow(b);
    const v = b.nv;
    for (let k = 0; k < 4; k++) {
      const o = (v + k) * 3, a = ao ? ao[k] : 1;
      b.p[o] = ps[k * 3]; b.p[o + 1] = ps[k * 3 + 1]; b.p[o + 2] = ps[k * 3 + 2];
      b.n[o] = nx * 127; b.n[o + 1] = ny * 127; b.n[o + 2] = nz * 127;
      b.c[o] = Math.min(255, r * a); b.c[o + 1] = Math.min(255, g * a); b.c[o + 2] = Math.min(255, bl * a);
    }
    const flip = ao && ao[0] + ao[2] < ao[1] + ao[3];
    const I = b.i, o = b.ni;
    if (flip) { I[o] = v + 1; I[o + 1] = v + 2; I[o + 2] = v + 3; I[o + 3] = v + 1; I[o + 4] = v + 3; I[o + 5] = v; }
    else { I[o] = v; I[o + 1] = v + 1; I[o + 2] = v + 2; I[o + 3] = v; I[o + 4] = v + 2; I[o + 5] = v + 3; }
    b.nv += 4; b.ni += 6;
  }
  const solidAt = (x, y, z) => y < 0 ? 1 : y >= WH ? 0 : OPAQUE[V[at(x, y, z)]];
  const ps = new Float32Array(12), ao = new Float32Array(4), d3 = [0, 0, 0];
  function shade(id, wx, wy, wz) {
    const v = 0.9 + 0.2 * hash3(wx, wy, wz, 13);
    return v;
  }
  const WATER_COL = [[52, 126, 186], [70, 140, 196], [44, 150, 170], [72, 112, 70], [255, 96, 24], [80, 150, 220]];
  function mesh(cx, cz) {
    for (const k in B) { B[k].nv = 0; B[k].ni = 0; }
    const ox = cx * CH, oz = cz * CH;
    for (let y = 1; y <= top + 1 && y < WH; y++) for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) {
      const id = V[at(x, y, z)];
      if (!id) continue;
      const k = KIND[id], wx = ox + x, wz = oz + z;
      let r = COL[id * 3], g = COL[id * 3 + 1], bl = COL[id * 3 + 2];
      if (k === 1 || k === 2) {
        const s = shade(id, wx, y, wz);
        // (the grass and leaves: a gentle drift of color across the land)
        if (id === GRASS || id === LEAVES || id === LEAVES2) { const t = nT(wx / 60, wz / 60) * 0.12; r *= 1 - t; g *= 1 + t * 0.4; }
        r *= s; g *= s; bl *= s;
        const out = k === 2 ? B.glow : B.solid;
        for (let f = 0; f < 6; f++) {
          const F = FACES[f], nx = F[0], ny = F[1], nz = F[2];
          if (solidAt(x + nx, y + ny, z + nz)) continue;
          const C = F[3], ta = F[4], tb = F[5];
          for (let c = 0; c < 4; c++) {
            const cc = C[c];
            ps[c * 3] = x + cc[0]; ps[c * 3 + 1] = y + cc[1]; ps[c * 3 + 2] = z + cc[2];
            if (k === 1) {
              // ambient occlusion: the blocks touching this corner in the layer in front of the face
              const lx = x + nx, ly = y + ny, lz = z + nz;
              d3[0] = 0; d3[1] = 0; d3[2] = 0; d3[ta] = cc[ta] ? 1 : -1;
              const s1 = solidAt(lx + d3[0], ly + d3[1], lz + d3[2]);
              const e0 = d3[0], e1 = d3[1], e2 = d3[2];
              d3[0] = 0; d3[1] = 0; d3[2] = 0; d3[tb] = cc[tb] ? 1 : -1;
              const s2 = solidAt(lx + d3[0], ly + d3[1], lz + d3[2]);
              const cr = solidAt(lx + d3[0] + e0, ly + d3[1] + e1, lz + d3[2] + e2);
              ao[c] = AO[s1 && s2 ? 0 : 3 - s1 - s2 - cr];
            }
          }
          quad(out, ps, nx, ny, nz, r, g, bl, k === 1 ? ao : null);
        }
      } else if (k === 3 || k === 4) {
        // a little box standing on the block below (grass, flowers, shards...)
        const w = DW[id] * (0.85 + 0.3 * hash3(wx, y, wz, 4)), hh = DH[id] * (0.8 + 0.4 * hash3(wx, y, wz, 6));
        const jx = (hash3(wx, y, wz, 7) - 0.5) * 0.4, jz = (hash3(wx, y, wz, 8) - 0.5) * 0.4;
        const x0 = x + 0.5 - w / 2 + jx, z0 = z + 0.5 - w / 2 + jz, out = k === 4 ? B.glow : B.solid;
        const s = 0.85 + 0.3 * hash3(wx, y, wz, 9);
        for (let f = 0; f < 6; f++) {
          if (f === 3) continue;
          const F = FACES[f], C = F[3];
          for (let c = 0; c < 4; c++) { const cc = C[c]; ps[c * 3] = x0 + cc[0] * w; ps[c * 3 + 1] = y + cc[1] * hh; ps[c * 3 + 2] = z0 + cc[2] * w; }
          // (the lower corners of the sides darker: they stand in the grass)
          for (let c = 0; c < 4; c++) ao[c] = f === 2 || C[c][1] ? 1 : 0.62;
          quad(out, ps, F[0], F[1], F[2], r * s, g * s, bl * s, k === 3 ? ao : null);
        }
      } else if (k === 5 || k === 6) {
        const above = V[at(x, y + 1, z)];
        if (above && !(KIND[above] === 3 || KIND[above] === 4)) continue;
        const lava = k === 6, ty = y + (lava ? 0.82 : 0.86);
        ps[0] = x; ps[1] = ty; ps[2] = z; ps[3] = x; ps[4] = ty; ps[5] = z + 1; ps[6] = x + 1; ps[7] = ty; ps[8] = z + 1; ps[9] = x + 1; ps[10] = ty; ps[11] = z;
        const wc = WATER_COL[colP[(z + M) * GW + x + M]];
        if (lava) { const s = 0.85 + 0.3 * nT(wx / 6, wz / 6); quad(B.glow, ps, 0, 1, 0, 255 * s, 90 * s + 30, 20, null); }
        else quad(B.water, ps, 0, 1, 0, wc[0], wc[1], wc[2], null);
      }
    }
  }
  const take = b => ({ p: b.p.slice(0, b.nv * 3), n: b.n.slice(0, b.nv * 3), c: b.c.slice(0, b.nv * 3), i: b.nv > 65535 ? b.i.slice(0, b.ni) : Uint16Array.from(b.i.subarray(0, b.ni)) });

  // ---------------------------------------------------------------- a whole chunk
  function chunk(cx, cz) {
    V.fill(0); top = SEA;
    const ox = cx * CH - M, oz = cz * CH - M;
    for (let z = 0; z < GW; z++) for (let x = 0; x < GW; x++) {
      const c = column(ox + x, oz + z), i = z * GW + x;
      colH[i] = c.h; colB[i] = c.biome; colP[i] = c.pick;
    }
    for (let z = -1; z <= CH; z++) for (let x = -1; x <= CH; x++) { const i = (z + M) * GW + x + M; fillColumn(x, z, colH[i], colP[i]); }
    // trees: one candidate per 5 x 5 cell, from every cell whose tree could reach into this chunk
    const C5 = 10, i0 = Math.floor((ox) / C5), i1 = Math.floor((ox + GW - 1) / C5), j0 = Math.floor(oz / C5), j1 = Math.floor((oz + GW - 1) / C5);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const tx = i * C5 + Math.floor(hash3(i, j, seed, 41) * C5), tz = j * C5 + Math.floor(hash3(i, j, seed, 42) * C5);
      const lx = tx - ox, lz = tz - oz;
      if (lx < 0 || lz < 0 || lx >= GW || lz >= GW) continue;
      const gi = lz * GW + lx, h = colH[gi], b = colP[gi];
      if (h <= SEA || flat) continue;
      const [p, kinds] = TREES[b];
      const r0 = hash3(i, j, seed, 43);
      // (fewer trees in the meadows: a slow noise thins the woods)
      const dens = b === FOREST ? p * clamp01(0.35 + nC(tx / 70 + 9, tz / 70) * 1.3) : p;
      if (r0 > dens) continue;
      // (no tree on a cliff edge)
      const hx = colH[gi + (lx < GW - 1 ? 1 : 0)], hz = colH[gi + (lz < GW - 1 ? GW : 0)];
      if (Math.abs(hx - h) > 2 || Math.abs(hz - h) > 2) continue;
      const r = rngOf((i * 73856093) ^ (j * 19349663) ^ seed);
      tree(kinds[Math.floor(r() * kinds.length)], tx - cx * CH, h, tz - cz * CH, r);
    }
    for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) { const i = (z + M) * GW + x + M; decorate(x, colH[i], z, colP[i], cx * CH + x, cz * CH + z); }
    mesh(cx, cz);
    // the chunk's own blocks, kept for walking on (x fastest, then z, then y)
    const vox = new Uint8Array(CH * CH * WH);
    for (let y = 0; y < WH; y++) for (let z = 0; z < CH; z++) { const s = at(0, y, z); vox.set(V.subarray(s, s + CH), (y * CH + z) * CH); }
    return { cx, cz, vox, top: top + 2, solid: take(B.solid), glow: take(B.glow), water: take(B.water) };
  }
  // ---------------------------------------------------------------- the low-poly land
  // A chunk as a faceted skin: a 16 x 16 grid of cells (one per hero stride, two blocks), each two flat
  // triangles colored by the land they're on and how steep they are; water where the land dips under
  // the sea; the trees, rocks and grass as placements for the main thread to build from its kits.
  const PN = CH / 2, PV = PN + 1;
  const SURF = [ // per biome: flat ground, steep ground (rock), underwater ground
    [[96, 176, 62], [118, 118, 124], [224, 200, 140]], [[238, 244, 252], [132, 140, 150], [160, 170, 180]], [[228, 204, 142], [214, 146, 92], [210, 190, 140]],
    [[96, 118, 52], [86, 70, 50], [70, 60, 44]], [[106, 96, 98], [58, 52, 60], [48, 40, 46]], [[96, 200, 196], [98, 74, 146], [90, 70, 130]]];
  const POLY_TREES = [
    [0.95, ['oak', 'oak', 'oak', 'birch', 'bush', 'bush', 'boulder']], [0.6, ['pine', 'pine', 'pine', 'snowrock']], [0.22, ['cactus', 'cactus', 'mesa_rock', 'deadbush', 'deadbush']],
    [0.6, ['willow', 'willow', 'oak', 'reeds', 'reeds']], [0.28, ['char', 'spire', 'char', 'boulder']], [0.4, ['crystal', 'crystal', 'pale', 'boulder']]];
  const NOT_TREE = new Set(['boulder', 'snowrock', 'mesa_rock', 'bush', 'deadbush', 'reeds']);
const TREE_ID = { oak: 0, birch: 1, pine: 2, cactus: 3, willow: 4, char: 5, spire: 6, crystal: 7, pale: 8, boulder: 9, snowrock: 10, mesa_rock: 11, bush: 12, deadbush: 13, reeds: 14 };
  const hfs = new Float32Array(PV * PV), pks = new Uint8Array(PV * PV), bms = new Uint8Array(PV * PV);
  function polyChunk(cx, cz) {
    for (const k in B) { B[k].nv = 0; B[k].ni = 0; }
    const ox = cx * CH, oz = cz * CH;
    for (let j = 0; j < PV; j++) for (let i = 0; i < PV; i++) { const c = column(ox + i * 2, oz + j * 2), k = j * PV + i; hfs[k] = c.hf + 1; pks[k] = c.pick; bms[k] = c.biome; }
    const col = [0, 0, 0];
    const face = (ax, ay, az, bx, by, bz, qx, qy, qz, k0, k1, k2) => {
      // the face's slope from its normal, its color from the land under it
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = qx - ax, vy = qy - ay, vz = qz - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz) || 1;
      const up = ny / nl, pick = pks[k0], ymin = Math.min(ay, by, qy), ymid = (ay + by + qy) / 3;
      const S = SURF[pick];
      let c = up < 0.62 ? S[1] : ymin < SEA + 1.6 ? S[2] : S[0];
      // dirt paths and worn ground wind through the woods and the bog
      const wx = ox + (ax + bx + qx) / 3, wz = oz + (az + bz + qz) / 3;
      if (c === S[0] && (pick === FOREST || pick === SWAMP) && Math.abs(nD(wx / 90 + 3, wz / 90)) < 0.045) c = pick === FOREST ? [156, 118, 76] : [86, 70, 50];
      const v = 0.93 + 0.14 * hash3(Math.round(wx * 2), Math.round(ymid), Math.round(wz * 2), 17), t = nT(wx / 40, wz / 40) * 0.08;
      col[0] = Math.min(255, c[0] * v * (1 - t)); col[1] = Math.min(255, c[1] * v * (1 + t * 0.5)); col[2] = Math.min(255, c[2] * v);
      // (magma veins through the ash lands glow)
      const glow = pick === LAVA && up < 0.62 && hash3(Math.round(wx), 0, Math.round(wz), 19) < 0.18;
      const out = glow ? B.glow : B.solid;
      if (glow) { col[0] = 255; col[1] = 104; col[2] = 24; }
      if ((out.nv + 3) * 3 > out.p.length) grow(out);
      const o = out.nv * 3, P = out.p, N = out.n, Cc = out.c;
      P[o] = ax; P[o + 1] = ay; P[o + 2] = az; P[o + 3] = bx; P[o + 4] = by; P[o + 5] = bz; P[o + 6] = qx; P[o + 7] = qy; P[o + 8] = qz;
      for (let k = 0; k < 3; k++) { N[o + k * 3] = nx / nl * 127; N[o + k * 3 + 1] = ny / nl * 127; N[o + k * 3 + 2] = nz / nl * 127; Cc[o + k * 3] = col[0]; Cc[o + k * 3 + 1] = col[1]; Cc[o + k * 3 + 2] = col[2]; }
      const I = out.i, io = out.ni; I[io] = out.nv; I[io + 1] = out.nv + 1; I[io + 2] = out.nv + 2;
      out.nv += 3; out.ni += 3;
    };
    let top = 0;
    for (let j = 0; j < PN; j++) for (let i = 0; i < PN; i++) {
      const k = j * PV + i, x0 = i * 2, x1 = x0 + 2, z0 = j * 2, z1 = z0 + 2;
      const h00 = hfs[k], h10 = hfs[k + 1], h01 = hfs[k + PV], h11 = hfs[k + PV + 1];
      top = Math.max(top, h00, h10, h01, h11);
      // (the diagonal alternates, so slopes don't stripe)
      if ((i + j) & 1) { face(x0, h00, z0, x0, h01, z1, x1, h11, z1, k, k + PV, k + PV + 1); face(x0, h00, z0, x1, h11, z1, x1, h10, z0, k, k + PV + 1, k + 1); }
      else { face(x0, h00, z0, x0, h01, z1, x1, h10, z0, k, k + PV, k + 1); face(x1, h10, z0, x0, h01, z1, x1, h11, z1, k + 1, k + PV, k + PV + 1); }
      // water over the dips
      if (Math.min(h00, h10, h01, h11) < SEA + 0.86) {
        const wy = SEA + 0.86, pick = pks[k], wc = WATER_COL[pick];
        ps[0] = x0; ps[1] = wy; ps[2] = z0; ps[3] = x0; ps[4] = wy; ps[5] = z1; ps[6] = x1; ps[7] = wy; ps[8] = z1; ps[9] = x1; ps[10] = wy; ps[11] = z0;
        if (pick === LAVA) quad(B.glow, ps, 0, 1, 0, 255, 100, 24, null); else quad(B.water, ps, 0, 1, 0, wc[0], wc[1], wc[2], null);
      }
    }
    // trees and rocks: one candidate per 10 x 10 cell, on dry, flattish ground
    const trees = [];
    const C5 = 7, i0 = Math.floor(ox / C5), i1 = Math.floor((ox + CH - 1) / C5), j0 = Math.floor(oz / C5), j1 = Math.floor((oz + CH - 1) / C5);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const tx = i * C5 + Math.floor(hash3(i, j, seed, 41) * C5), tz = j * C5 + Math.floor(hash3(i, j, seed, 42) * C5);
      if (tx < ox || tz < oz || tx >= ox + CH || tz >= oz + CH) continue;
      const c = column(tx, tz), h = c.hf + 1, b = c.pick;
      if (h <= SEA + 1.5) continue;
      const [p, kinds] = POLY_TREES[b];
      const r0 = hash3(i, j, seed, 43);
      const dens = b === FOREST ? p * clamp01(0.45 + nC(tx / 70 + 9, tz / 70) * 1.3) : p;
      if (r0 > dens) continue;
      const hx = column(tx + 3, tz).hf + 1, hz = column(tx, tz + 3).hf + 1;
      if (Math.abs(hx - h) > 3.2 || Math.abs(hz - h) > 3.2) continue;
      const kind = kinds[Math.floor(hash3(i, j, seed, 44) * kinds.length)];
      // (trees: giants, eight times the size, and only three in eight of the spots the ground would take; rocks and bushes as they are)
      const tree = !NOT_TREE.has(kind);
      if (tree && hash3(i, j, seed, 47) < 0.625) continue;
      trees.push(TREE_ID[kind], tx - ox + 0.5, Math.min(h, hx, hz) - 0.3, tz - oz + 0.5, (0.7 + hash3(i, j, seed, 45) * 0.5) * (tree ? 8 : 1), hash3(i, j, seed, 46) * 6.283);
    }
    // grass: where the ground is grassy and gentle, a spot every other block, each with a number to thin by
    const grass = [];
    for (let z = 0; z < CH; z += 2) for (let x = 0; x < CH; x += 2) {
      const i = x >> 1, j = z >> 1, k = j * PV + i, pick = pks[k];
      if (pick !== FOREST && pick !== SWAMP && pick !== CRYSTAL) continue;
      const h = hfs[k];
      if (h < SEA + 2 || Math.abs(hfs[k + 1] - h) > 1.4 || Math.abs(hfs[k + PV] - h) > 1.4) continue;
      const r = hash3(ox + x, 3, oz + z, 51);
      if (r > 0.96) continue;
      for (let n = 0; n < 4; n++) {
        const gx = x + hash3(ox + x, n, oz + z, 52) * 2, gz = z + hash3(ox + x, n + 9, oz + z, 53) * 2;
        const fx = gx / 2 - i, fz = gz / 2 - j;
        const gy = h + (hfs[k + 1] - h) * fx + (hfs[k + PV] - h) * fz;
        grass.push(gx, gy, gz, hash3(ox + x, n + 20, oz + z, 54), pick);
      }
    }
    return { cx, cz, poly: true, hf: hfs.slice(), top: top + 2, solid: take(B.solid), glow: take(B.glow), water: take(B.water), trees: Float32Array.from(trees), grass: Float32Array.from(grass) };
  }
  return { column, chunk, polyChunk, weights: (x, z) => { const b = weights(x, z); return { best: b, w: Array.from(wts) }; }, site: (i, j) => [siteX(i, j), siteZ(i, j)], biomeOfCell };
}
