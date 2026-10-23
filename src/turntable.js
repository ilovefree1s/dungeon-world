// ============================================================================
//  DUNGEON WORLD  -  turntable: a small renderer that shows one forged weapon
//  turning on a canvas (the loot panel's picture; the forge has its own with
//  the drag and the drawing pad). Built once per canvas, started and stopped
//  as the panel opens and closes.
// ============================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildForged } from './weaponkit.js';
import { AURA_VIEW } from './auras.js';

export class Turntable {
  constructor(canvas) {
    this.canvas = canvas; this.renderer = null; this.model = null; this.raf = 0; this.turn = 0; this.last = 0;
  }
  init() {
    if (this.renderer) return;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    const s = this.scene = new THREE.Scene();
    s.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(r), 0.04).texture;
    s.add(new THREE.HemisphereLight('#ffe8cc', '#241c18', 0.9));
    const sun = new THREE.DirectionalLight('#fff1d8', 2); sun.position.set(2, 4, 3); s.add(sun);
    const rim = new THREE.DirectionalLight('#9fd8ff', 0.8); rim.position.set(-3, 1, -2); s.add(rim);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  }
  show(spec) { return this.showModel(buildForged(spec)); }
  // any model; tick(t) runs each frame (a hero's idle); turning is slow and only a little by default
  showModel(model, tick = null, opts = {}) {
    this.init();
    this.clear();
    const m = this.model = model; this.tick = tick; this.opts = opts;
    const bb = new THREE.Box3(), tb = new THREE.Box3();
    m.updateMatrixWorld(true);
    m.traverse(o => { if (o.isMesh && !o.userData.aura && !o.isPoints && !o.isSprite && o.geometry) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); tb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); bb.union(tb); } });
    const size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    m.position.set(-c.x, -c.y, -c.z);
    this.scene.add(m);
    const span = Math.max(size.y, size.z * 1.2, size.x * 1.2);
    this.camera.position.set(0, 0.1, span * (opts.dist ?? 1.75) + 0.6); this.camera.lookAt(0, 0, 0);
    this.size();
    cancelAnimationFrame(this.raf); this.last = 0;
    const frame = now => {
      const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016; this.last = now;
      this.turn += dt * (this.opts.spin ?? 0.8);
      if (this.opts.sway === false) m.rotation.set(0, (this.opts.face || 0) + Math.sin(this.turn) * (this.opts.wobble ?? 0), 0);
      else m.rotation.set(0.15, this.turn, Math.sin(now / 1000 * 0.5) * 0.08);
      AURA_VIEW.h = this.renderer.domElement.height;
      if (this.tick) this.tick(now / 1000);
      if (m.userData.tick) m.userData.tick(now / 1000);
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }
  size() {
    const c = this.canvas, w = c.clientWidth || 300, h = c.clientHeight || 220;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  clear() {
    if (this.model) { this.scene.remove(this.model); this.model.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); }); this.model = null; }
  }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; this.clear(); }
}
