// ============================================================================
//  DUNGEON WORLD  -  player: Dungeon Heart's hero out in the open. Walking,
//  running, jumping, stepping up single blocks, swimming, and the third-person
//  camera that follows (and keeps out of the hills).
// ============================================================================
import { THREE, scene, camera, TEX, V3 } from './engine.js';
import { buildHero, equipHeroWeapon, animHero } from './dh/models.js';
import { buildForged, statsOf, clsOf } from './weaponkit.js';
import { SEA } from './gen.js';
const SEA_TOP = SEA + 0.86; // (the sea's surface)

// (a block is half a stride: the hero stands 5.2 blocks tall, steps up 2 and jumps 6)
const HW = 0.96, HH = 5.2;          // the hero's box: half its width, its height (blocks)
const WALK = 15, RUN = 23, SWIM = 8.4;
const GRAV = 68, JUMP_V = 28.8;
export const HERO_SCALE = 2.56;     // (Dungeon Heart's heroes are 2.15 tall in its units)
const STEP = 2;                     // (how many blocks the hero steps up without a jump)

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = new V3(); this.vel = new V3();
    this.onGround = false; this.inWater = false; this.headUnder = false;
    this.face = 0;               // which way the hero faces (radians, 0 = +z)
    this.walk = 0; this.move = 0;
    this.yaw = Math.PI * 0.25; this.pitch = 0.32; this.camDist = 20;
    this.camPos = new V3(); this.camFocus = new V3();
    this.lastLook = -10; this.visY = 0; this.hurtT = 0; this.coyote = 0; this.jumpBuf = 0;
    this.castT = -1; this.invT = 0; this.aimFace = null;
    this.swingT = -1; this.whirl = false; this.swingLen = 0.3; this.dash = null; this.slamming = false; this.onLand = null;
    this.cls = -1; this.model = null;
    // a soft round shadow under the hero (always there, even with the real shadows off)
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshBasicMaterial({ map: TEX.shadow, transparent: true, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.renderOrder = 1; scene.add(this.blob);
  }
  setClass(cls) {
    if (this.model) { scene.remove(this.model); this.model.traverse(o => o.geometry && o.geometry.dispose()); }
    this.cls = cls;
    const m = buildHero(cls);
    equipHeroWeapon(m, cls, 1, 0);
    m.scale.multiplyScalar(HERO_SCALE / 2.15);
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    // (the shine from the environment map dims at night; remember each material's own)
    this.mats = [];
    m.traverse(o => { if (o.isMesh && o.material && o.material.envMapIntensity !== undefined) { const ms = [].concat(o.material); for (const mm of ms) { if (mm.userData.env0 === undefined) mm.userData.env0 = mm.envMapIntensity; this.mats.push(mm); } } });
    scene.add(m);
    this.model = m;
    this.applyForged();
  }
  // weapons from the forge, one per hero (null: back to Dungeon Heart's own)
  equipForged(spec, cls = spec ? clsOf(spec) : this.cls) {
    this.forgedSpecs ||= [null, null, null];
    this.forgedSpecs[cls] = spec;
    this.applyForged();
  }
  applyForged() {
    const spec = this.forgedSpecs ? this.forgedSpecs[this.cls] : null;
    this.forged = spec ? statsOf(spec) : null;
    const u = this.model && this.model.userData, hold = u && [u.sword, u.staff, u.bow][this.cls];
    if (!hold) return;
    if (!spec) { equipHeroWeapon(this.model, this.cls, 1, 0); return; }
    for (const c of [...hold.children]) hold.remove(c);
    const w = buildForged(spec);
    if (this.cls === 0) w.rotation.x = Math.PI / 2;
    hold.add(w);
    u.wtick = w.userData.tick; u.glowK = 1;
    if (this.cls === 0) { u.bladeMat = w.userData.bladeMat; u.bladeBase = u.bladeMat.emissive.clone(); u.bladeBaseI = u.bladeMat.emissiveIntensity; }
    if (this.cls === 1) { u.orbMat = w.userData.orbMat; u.orb = w.userData.orb; }
    if (this.cls === 2) { u.string = w.userData.string; u.stringZ = w.userData.stringZ; }
  }
  place(x, y, z) { this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.visY = y; this.snapCam = true; }
  // ---------------------------------------------------------------- collisions
  // does the hero's box at (x, y, z) touch a solid block?
  hits(x, y, z) {
    const w = this.world;
    const x0 = Math.floor(x - HW), x1 = Math.floor(x + HW), z0 = Math.floor(z - HW), z1 = Math.floor(z + HW);
    const y0 = Math.floor(y), y1 = Math.floor(y + HH - 0.001);
    for (let yy = y0; yy <= y1; yy++) for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++) if (w.solid(xx, yy, zz)) return true;
    return false;
  }
  // move along one axis, stepping up a single block when walking into one
  moveAxis(ax, d) {
    const p = this.pos;
    const steps = Math.ceil(Math.abs(d) / 0.3);
    const sd = d / Math.max(1, steps);
    for (let i = 0; i < steps; i++) {
      const nx = ax === 0 ? p.x + sd : p.x, ny = ax === 1 ? p.y + sd : p.y, nz = ax === 2 ? p.z + sd : p.z;
      if (!this.hits(nx, ny, nz)) { p.set(nx, ny, nz); continue; }
      if (ax === 1) {
        // land on the block (or bump your head)
        if (sd < 0) { p.y = Math.floor(p.y + sd) + 1; this.onGround = true; } else p.y = Math.floor(p.y + sd + HH - 0.001) - HH - 0.001; // (the head just under the block it hit)
        this.vel.y = 0;
        return false;
      }
      // a step up: on the ground (or swimming), up to STEP blocks, with room overhead
      if ((this.onGround || this.inWater) && this.vel.y <= 0.5) {
        let ok = false;
        for (let s = 1; s <= STEP && !ok; s++) {
          const up = Math.floor(p.y) + s + 0.001;
          if (up - p.y <= STEP + 0.05 && !this.hits(nx, up, nz) && !this.hits(p.x, up, p.z)) { p.set(nx, up, nz); this.stepped = true; ok = true; }
        }
        if (ok) continue;
      }
      if (ax === 0) this.vel.x = 0; else this.vel.z = 0;
      return false;
    }
    return true;
  }
  // ---------------------------------------------------------------- a frame
  // ---------------------------------------------------------------- the land, either way
  // (the low-poly land is a height under each point; the block land is blocks)
  surfaceAt(x, z) { const w = this.world; if (w.poly) { const g = w.ground(x, z); return g === null ? null : g; } const g = w.groundY(x, z); return g < 0 ? null : g + 1; }
  waterAt(x, y, z) { const w = this.world; return w.poly ? (y < SEA_TOP && w.seaAt(x, z)) : w.water(x, y, z); }
  lavaAt(x, y, z) { const w = this.world; return w.poly ? (y < SEA_TOP && w.lavaAt(x, z)) : w.lava(x, y, z); }
  update(dt, inp, look, frozen) {
    if (this.world.poly) return this.updatePoly(dt, inp, look, frozen);
    const w = this.world, p = this.pos;
    // the camera: swipes and the mouse turn it; the right stick and turn keys at a steady rate
    const [lx, ly] = look;
    if (lx || ly || inp.lookRX || inp.lookRY) this.lastLook = performance.now() / 1000;
    this.yaw -= lx + inp.lookRX * 2.6 * dt;
    this.pitch = Math.max(-0.35, Math.min(1.25, this.pitch + ly + inp.lookRY * 1.8 * dt));
    if (frozen) { this.placeCamera(dt); return; }
    // which way to go: the stick is relative to the camera
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    const fwdX = -sinY, fwdZ = -cosY, rtX = cosY, rtZ = -sinY;
    const mx = inp.mx, my = inp.my, mag = Math.min(1, Math.hypot(mx, my));
    let wx = fwdX * -my + rtX * mx, wz = fwdZ * -my + rtZ * mx;
    const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
    // water: feet and head
    const feetW = w.water(p.x, p.y + 0.8, p.z), chestW = w.water(p.x, p.y + 2.8, p.z);
    this.inWater = feetW; this.headUnder = w.water(p.x, p.y + 3.8, p.z);
    const speed = (this.inWater && chestW ? SWIM : inp.sprint || mag > 0.95 ? RUN : WALK) * mag;
    const accel = this.onGround || this.inWater ? 14 : 5;
    const k = 1 - Math.exp(-accel * dt);
    this.vel.x += (wx * speed - this.vel.x) * k;
    this.vel.z += (wz * speed - this.vel.z) * k;
    // a charge or a roll: straight ahead at its own speed, the ground no matter
    if (this.dash) {
      const D = this.dash; D.t -= dt;
      this.vel.x = D.dx * D.spd; this.vel.z = D.dz * D.spd;
      if (D.t <= 0) { this.dash = null; this.vel.x *= 0.3; this.vel.z *= 0.3; }
    }
    // jumping (a moment's grace after leaving a ledge, and a press just before landing still counts)
    if (inp.jumpEdge) this.jumpBuf = 0.14;
    inp.jumpEdge = false;
    this.jumpBuf -= dt; this.coyote -= dt;
    if (this.onGround) this.coyote = 0.1;
    if (chestW) {
      // swimming: float up to the surface, jump to climb out
      this.vel.y += (inp.jump ? 18 : this.headUnder ? 10 : -4) * dt * 3;
      this.vel.y *= Math.exp(-3 * dt);
      if (!this.headUnder && inp.jump && this.vel.y < 12 && this.wallAhead(wx, wz)) this.vel.y = 17;
      this.vel.y = Math.max(-10, Math.min(12, this.vel.y));
    } else {
      if (this.jumpBuf > 0 && this.coyote > 0) { this.vel.y = JUMP_V; this.jumpBuf = 0; this.coyote = 0; this.onGround = false; this.jumped = true; }
      // (let go of jump early for a short hop)
      if (!inp.jump && this.vel.y > 8 && this.jumped) this.vel.y -= GRAV * 1.2 * dt;
      this.vel.y -= GRAV * dt;
      if (this.vel.y < -80) this.vel.y = -80;
    }
    // lava: it throws you out
    if (w.lava(p.x, p.y + 0.6, p.z)) { this.vel.y = 30; this.hurtT = 0.6; this.onHurt && this.onHurt(); }
    this.hurtT = Math.max(0, this.hurtT - dt); this.invT = Math.max(0, this.invT - dt);
    if (this.castT >= 0) { this.castT += dt / 0.38; if (this.castT >= 1) this.castT = -1; }
    if (this.swingT >= 0) { this.swingT += dt / (this.whirl ? this.swingLen : 0.3); if (this.swingT >= 1) { this.swingT = -1; this.whirl = false; } }
    // move, one axis at a time
    const wasGround = this.onGround;
    this.onGround = false; this.stepped = false;
    this.moveAxis(0, this.vel.x * dt);
    this.moveAxis(2, this.vel.z * dt);
    this.moveAxis(1, this.vel.y * dt);
    if (this.onGround) this.jumped = false;
    if (this.onGround && !wasGround && this.onLand) { const f = this.onLand; this.onLand = null; f(); }
    // (stay stuck to the ground walking down a single step)
    if (!this.onGround && wasGround && this.vel.y <= 0 && !this.inWater) {
      if (this.hits(p.x, p.y - STEP - 0.05, p.z) && !this.hits(p.x, p.y - 0.02, p.z)) {
        let y = p.y; while (!this.hits(p.x, y - 0.05, p.z) && y > p.y - STEP - 0.1) y -= 0.05;
        p.y = Math.floor(y + 0.01); if (this.hits(p.x, p.y, p.z)) p.y += 1; this.onGround = true; this.vel.y = 0;
      }
    }
    // stuck inside a block (a chunk arriving around you, say): climb out
    if (this.hits(p.x, p.y, p.z)) { p.y = Math.floor(p.y) + 1; this.vel.y = Math.max(0, this.vel.y); }
    if (p.y < -20) { const g = w.groundY(p.x, p.z); p.y = g + 1; this.vel.y = 0; }
    this.aboveGround = p.y - (w.groundY(p.x, p.z, p.y + 1) + 1);
    // face where you walk
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.aimFace !== null) {
      let d = this.aimFace - this.face; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.face += d * (1 - Math.exp(-20 * dt));
      if (this.castT < 0) this.aimFace = null;
    } else if (hs > 0.4 && mag > 0.05) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      let d = target - this.face; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.face += d * (1 - Math.exp(-14 * dt));
    }
    // (left alone a moment while running ahead, the camera swings round behind you)
    const now = performance.now() / 1000;
    if (mag > 0.3 && now - this.lastLook > 1.2 && -my > 0.2) {
      const want = this.face + Math.PI;
      let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-0.9 * dt)) * Math.min(1, -my);
    }
    this.animate(dt, hs);
    this.placeCamera(dt);
  }
  // the hero on the low-poly land: the ground is a height, slopes are walked, steep ones climbed only by
  // jumping, trunks are bumped around, the sea is swum
  updatePoly(dt, inp, look, frozen) {
    const w = this.world, p = this.pos;
    const [lx, ly] = look;
    if (lx || ly || inp.lookRX || inp.lookRY) this.lastLook = performance.now() / 1000;
    this.yaw -= lx + inp.lookRX * 2.6 * dt;
    this.pitch = Math.max(-0.35, Math.min(1.25, this.pitch + ly + inp.lookRY * 1.8 * dt));
    if (frozen) { this.placeCamera(dt); return; }
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    const fwdX = -sinY, fwdZ = -cosY, rtX = cosY, rtZ = -sinY;
    const mx = inp.mx, my = inp.my, mag = Math.min(1, Math.hypot(mx, my));
    let wx = fwdX * -my + rtX * mx, wz = fwdZ * -my + rtZ * mx;
    const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
    const g0 = w.ground(p.x, p.z);
    if (g0 === null) { this.placeCamera(dt); return; } // (the land under you isn't here yet)
    const sea = w.seaAt(p.x, p.z);
    this.inWater = sea && p.y + 0.8 < SEA_TOP; const chestW = sea && p.y + 2.8 < SEA_TOP; this.headUnder = sea && p.y + 3.8 < SEA_TOP;
    const speed = (this.inWater && chestW ? SWIM : inp.sprint || mag > 0.95 ? RUN : WALK) * mag;
    const accel = this.onGround || this.inWater ? 14 : 5;
    const k = 1 - Math.exp(-accel * dt);
    this.vel.x += (wx * speed - this.vel.x) * k;
    this.vel.z += (wz * speed - this.vel.z) * k;
    if (this.dash) { const D = this.dash; D.t -= dt; this.vel.x = D.dx * D.spd; this.vel.z = D.dz * D.spd; if (D.t <= 0) { this.dash = null; this.vel.x *= 0.3; this.vel.z *= 0.3; } }
    // jumping
    if (inp.jumpEdge) this.jumpBuf = 0.14;
    inp.jumpEdge = false;
    this.jumpBuf -= dt; this.coyote -= dt;
    if (this.onGround) this.coyote = 0.1;
    if (chestW) {
      this.vel.y += (inp.jump ? 18 : this.headUnder ? 10 : -4) * dt * 3;
      this.vel.y *= Math.exp(-3 * dt);
      this.vel.y = Math.max(-10, Math.min(12, this.vel.y));
    } else {
      if (this.jumpBuf > 0 && this.coyote > 0) { this.vel.y = JUMP_V; this.jumpBuf = 0; this.coyote = 0; this.onGround = false; this.jumped = true; }
      if (!inp.jump && this.vel.y > 8 && this.jumped) this.vel.y -= GRAV * 1.2 * dt;
      this.vel.y -= GRAV * dt;
      if (this.vel.y < -80) this.vel.y = -80;
    }
    if (this.lavaAt(p.x, p.y + 0.6, p.z)) { this.vel.y = 30; this.hurtT = 0.6; this.onHurt && this.onHurt(); }
    this.hurtT = Math.max(0, this.hurtT - dt); this.invT = Math.max(0, this.invT - dt);
    if (this.castT >= 0) { this.castT += dt / 0.38; if (this.castT >= 1) this.castT = -1; }
    if (this.swingT >= 0) { this.swingT += dt / (this.whirl ? this.swingLen : 0.3); if (this.swingT >= 1) { this.swingT = -1; this.whirl = false; } }
    // move: a step that would climb more than STEP blocks is a wall (jump it); trunks push you off
    const wasGround = this.onGround;
    let nx = p.x + this.vel.x * dt, nz = p.z + this.vel.z * dt;
    [nx, nz] = w.clearOfTrunks(nx, nz, HW);
    const gn = w.ground(nx, nz);
    if (gn !== null) {
      const rise = gn - p.y;
      if (rise > STEP + 0.3 && this.onGround) { this.vel.x *= -0.1; this.vel.z *= -0.1; }
      else if (rise > 0.3 && !this.onGround && this.vel.y < 0 && gn - p.y > STEP) { /* (a cliff face in the air: slide down it) */ }
      else { p.x = nx; p.z = nz; }
    } else { p.x = nx; p.z = nz; }
    p.y += this.vel.y * dt;
    const g = w.ground(p.x, p.z);
    this.onGround = false;
    if (g !== null && p.y <= g) { p.y = g; if (this.vel.y < 0) this.vel.y = 0; this.onGround = true; this.stepped = wasGround && g - (g0) > 0.4; }
    if (this.onGround) this.jumped = false;
    if (this.onGround && !wasGround && this.onLand) { const f = this.onLand; this.onLand = null; f(); }
    this.aboveGround = g !== null ? p.y - g : 0;
    // face where you walk (or where you aim)
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.aimFace !== null) { let d = this.aimFace - this.face; d = Math.atan2(Math.sin(d), Math.cos(d)); this.face += d * (1 - Math.exp(-20 * dt)); if (this.castT < 0) this.aimFace = null; }
    else if (hs > 0.4 && mag > 0.05) { const target = Math.atan2(this.vel.x, this.vel.z); let d = target - this.face; d = Math.atan2(Math.sin(d), Math.cos(d)); this.face += d * (1 - Math.exp(-14 * dt)); }
    const now = performance.now() / 1000;
    if (mag > 0.3 && now - this.lastLook > 1.2 && -my > 0.2) { const want = this.face + Math.PI; let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * (1 - Math.exp(-0.9 * dt)) * Math.min(1, -my); }
    this.animate(dt, hs);
    this.placeCamera(dt);
  }
  // the mage's blink: a leap ahead through the air, as far as the way is clear (up to 9 blocks)
  blink(dx, dz) {
    if (this.world.poly) {
      // along the ground, over any dip, stopping at a wall of land taller than a jump
      const p = this.pos, from = p.clone();
      let x = p.x, y = p.y, z = p.z, n = 0;
      for (let d = 1; d <= 18; d += 1) {
        const nx = from.x + dx * d, nz = from.z + dz * d, g = this.world.ground(nx, nz);
        if (g === null) break;
        if (g > y + 6) break;
        x = nx; z = nz; y = Math.max(y, g); n = d;
      }
      if (n < 3) return false;
      [x, z] = this.world.clearOfTrunks(x, z, HW);
      p.set(x, y, z); this.visY = y; this.vel.set(dx * 8, 2, dz * 8); this.invT = Math.max(this.invT, 0.35); this.snapCam = false;
      return true;
    }
    const p = this.pos, from = p.clone();
    let x = p.x, y = p.y, z = p.z, n = 0;
    for (let d = 1; d <= 18; d += 1) {
      const nx = from.x + dx * d, nz = from.z + dz * d;
      let ny = y;
      if (this.hits(nx, ny, nz)) { ny = Math.floor(y) + 1.001; if (this.hits(nx, ny, nz)) ny = Math.floor(y) + 2.001; if (this.hits(nx, ny, nz)) break; }
      x = nx; y = ny; z = nz; n = d;
    }
    if (n < 3) return false;
    p.set(x, y, z); this.visY = y; this.vel.set(dx * 8, 2, dz * 8); this.invT = Math.max(this.invT, 0.35); this.snapCam = false;
    return true;
  }
  wallAhead(wx, wz) { const p = this.pos; if (this.world.poly) { const g = this.world.ground(p.x + wx * 1.6, p.z + wz * 1.6); return g !== null && g > p.y + 1; } return this.world.solid(p.x + wx * 1.6, p.y + 1, p.z + wz * 1.6) || this.world.solid(p.x + wx * 1.6, p.y + 2.4, p.z + wz * 1.6); }
  animate(dt, hs) {
    const m = this.model, p = this.pos;
    if (!m) return;
    // (the model eases up a step instead of popping)
    this.visY += (p.y - this.visY) * (this.stepped || Math.abs(p.y - this.visY) < 2.4 ? 1 - Math.exp(-18 * dt) : 1);
    if (Math.abs(p.y - this.visY) > 3) this.visY = p.y;
    const swimming = this.inWater && this.waterAt(p.x, p.y + 2.8, p.z);
    m.position.set(p.x, this.visY - (swimming ? 2.2 : 0), p.z);
    m.rotation.y = this.face;
    this.move += (Math.min(1, hs / WALK) - this.move) * (1 - Math.exp(-10 * dt));
    this.walk += dt * (4 + hs * 1.15);
    const t = performance.now() / 1000;
    const rolling = this.dash && this.dash.roll ? Math.max(0.01, this.dash.t / 0.42) : 0;
    animHero(m, t, { walk: this.walk, move: this.onGround || swimming ? this.move : 0.15, roll: rolling, swing: this.swingT, cast: this.castT, whirl: this.whirl });
    if (this.slamming && !this.onGround) { const u0 = m.userData; u0.arms[0].rotation.x = -2.8; u0.arms[1].rotation.x = -2.8; u0.body.rotation.x = 0.3; }
    const u = m.userData;
    if (!this.onGround && !swimming && !rolling && !this.slamming) {
      // in the air: knees up, arms out
      const k = Math.max(-1, Math.min(1, this.vel.y / 20));
      u.legs[0].rotation.x = -0.6 - k * 0.2; u.legs[1].rotation.x = 0.25 - k * 0.3;
      u.arms[0].rotation.z = -0.5; u.arms[1].rotation.z = 0.5 + 0.1;
    } else { u.arms[0].rotation.z = 0; }
    if (swimming) { u.body.rotation.x = 0.5 * this.move; u.arms[0].rotation.x = -2.2 + Math.sin(this.walk) * 0.8; u.arms[1].rotation.x = -2.2 - Math.sin(this.walk) * 0.8; }
    // the hurt flash
    if (u.flash) u.flash(this.hurtT > 0 ? (Math.sin(t * 40) > 0 ? 0.8 : 0) : 0, '#ff5a2a');
    // the shadow on the ground below
    const gs = this.surfaceAt(p.x, p.z), gy = gs === null ? p.y - 1 : gs - 1;
    const h = p.y - (gy + 1);
    this.blob.position.set(p.x, gy + 1.03, p.z);
    this.blob.material.opacity = Math.max(0, 0.75 - h * 0.04);
    this.blob.scale.setScalar(1 + Math.min(1, h * 0.025));
  }
  // ---------------------------------------------------------------- the camera
  placeCamera(dt) {
    const p = this.pos;
    const fy = this.visY + 4.8;
    if (this.snapCam) this.camFocus.set(p.x, fy, p.z);
    else this.camFocus.lerp(new V3(p.x, fy, p.z), 1 - Math.exp(-14 * dt));
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = new V3(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
    // pull in when a hill or a tree is between the hero and the camera
    let dist = this.camDist;
    for (let d = 1.2; d <= this.camDist; d += 0.5) {
      const x = this.camFocus.x + dir.x * d, y = this.camFocus.y + dir.y * d, z = this.camFocus.z + dir.z * d;
      if (this.world.poly) { const g = this.world.ground(x, z); if (g !== null && y < g + 1.2) { dist = Math.max(2, d - 0.9); break; } }
      else if (this.world.camBlock(x, y, z) || this.world.camBlock(x, y - 0.6, z)) { dist = Math.max(2, d - 0.9); break; }
    }
    // (the camera eases back out, but snaps in)
    this.curDist = this.snapCam || dist < (this.curDist || dist) ? dist : this.curDist + (dist - this.curDist) * (1 - Math.exp(-4 * dt));
    this.camPos.copy(this.camFocus).addScaledVector(dir, this.curDist);
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 1.6); const k = this.shake * 0.5; this.camPos.x += (Math.random() - 0.5) * k; this.camPos.y += (Math.random() - 0.5) * k; this.camPos.z += (Math.random() - 0.5) * k; }
    camera.position.copy(this.camPos);
    camera.lookAt(this.camFocus.x, this.camFocus.y + 0.4, this.camFocus.z);
    this.snapCam = false;
    // the hero fades a little when the camera is right on top of it
    const a = this.curDist < 4.4 ? 0.35 : 1;
    if (this.model && this.model.userData.fade && a !== this.alpha) { this.model.userData.fade(a); this.alpha = a; }
  }
  // the hero's shine follows the light of day
  dayLight(k) { if (this.mats) for (const m of this.mats) m.envMapIntensity = m.userData.env0 * k; }
}
