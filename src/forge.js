// ============================================================================
//  DUNGEON WORLD  -  forge: the weapon builder screen. Pick a type, a head, a
//  material, a guard, a grip and a pommel, set the size and the colors, name
//  it, save it, and hand it to the warrior. The preview turns in its own small
//  renderer so the world behind keeps its frame rate.
// ============================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TYPES, MATERIALS, GUARDS, GRIPS, POMMELS, ACCENTS, GRIP_COLORS, AURAS, HAFTS, HERO_NAME, clsOf, hasHaft, canDraw, presetShape, randomSpec, defaultSpec, nameOf, statsOf, buildForged } from './weaponkit.js';
import { ShapePad } from './shapepad.js';
import { sfx } from './audio.js';

const $ = id => document.getElementById(id);
const KEY = 'dungeonworld.forge.v1';
const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
// equipped: one saved weapon's index per hero (warrior, mage, hunter), -1 for its own
export const forge = { saved: [], equipped: [-1, -1, -1], spec: defaultSpec(), open: false, onEquip: null, onClose: null };
try { const d = JSON.parse(ls.get(KEY)); if (d) { forge.saved = d.saved || []; forge.equipped = Array.isArray(d.equipped) ? d.equipped : [d.equipped ?? -1, -1, -1]; if (d.spec) forge.spec = d.spec; } } catch (e) { }
function persist() { ls.set(KEY, JSON.stringify({ saved: forge.saved, equipped: forge.equipped, spec: forge.spec })); }
export const equippedSpec = cls => forge.equipped[cls] >= 0 && forge.saved[forge.equipped[cls]] ? forge.saved[forge.equipped[cls]] : null;

// ---------------------------------------------------------------- the preview
let renderer = null, scene = null, camera = null, model = null, raf = 0, last = 0, turn = 0, dragging = false, spin = 1;
function initPreview() {
  if (renderer) return;
  const canvas = $('forgeGl');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.add(new THREE.HemisphereLight('#ffe8cc', '#241c18', 0.9));
  const sun = new THREE.DirectionalLight('#fff1d8', 2); sun.position.set(2, 4, 3); scene.add(sun);
  const rim = new THREE.DirectionalLight('#9fd8ff', 0.8); rim.position.set(-3, 1, -2); scene.add(rim);
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  // a drag turns it; left alone it turns by itself
  let lx = 0;
  canvas.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (dragging) { turn += (e.clientX - lx) * 0.01; lx = e.clientX; } });
  const up = () => { dragging = false; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
}
function sizePreview() {
  const c = $('forgeGl'), w = c.clientWidth || 300, h = c.clientHeight || 300;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
function rebuild() {
  if (model) { scene.remove(model); model.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); }); }
  model = buildForged(forge.spec);
  // (centered on its length, so long and short weapons both fill the view)
  // (framed by its whole box, so a crossbow's stock and a greatsword's length both fit)
  // (the aura doesn't count: flames rising off the tip shouldn't zoom the blade out)
  const bb = new THREE.Box3(), tb = new THREE.Box3();
  model.updateMatrixWorld(true);
  model.traverse(o => { if (o.isMesh && !o.userData.aura && !o.isPoints && !o.isSprite && o.geometry) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); tb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); bb.union(tb); } });
  const size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
  model.position.set(-c.x, -c.y, -c.z);
  scene.add(model);
  const span = Math.max(size.y, size.z * 1.2, size.x * 1.2);
  camera.position.set(0, 0.1, span * 1.75 + 0.6); camera.lookAt(0, 0, 0);
  const st = statsOf(forge.spec);
  $('forgeStats').innerHTML = (st.aura !== 'none' ? `<b>AURA</b> ${st.aura.toUpperCase()} ` : '') + `<b>FOR THE</b> ${HERO_NAME[st.cls]} <b>DAMAGE</b> ${Math.round(st.dmg * 100)}% <b>SPEED</b> ${Math.round(st.spd * 100)}% ` + (st.cls === 0 ? `<b>REACH</b> ${st.reach} blocks` : `<b>SHOT</b> ${Math.round(st.shot * 100)}%`) + (st.glow ? ' <b>GLOWS</b>' : '');
}
function frame(now) {
  if (!forge.open) return;
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!dragging) turn += dt * 0.6 * spin;
  if (model) { model.rotation.y = turn; model.rotation.z = Math.sin(now / 1000 * 0.5) * 0.1; if (model.userData.tick) model.userData.tick(now / 1000); }
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- the controls
function seg(id, items, cur, onPick) {
  const el = $(id); el.innerHTML = '';
  items.forEach((it, i) => {
    const b = document.createElement('button'); b.type = 'button';
    const [val, label, color] = Array.isArray(it) ? it : [it, it.toUpperCase ? it.toUpperCase() : it, null];
    b.textContent = label; b.dataset.v = val;
    if (color) { b.style.setProperty('--sw', color); b.classList.add('sw'); }
    if (val === cur || i === cur) b.classList.add('on');
    b.addEventListener('click', () => { onPick(val, i); sfx('pickup'); render(); });
    el.appendChild(b);
  });
}
function render() {
  const s = forge.spec, t = TYPES.find(x => x.id === s.type) || TYPES[0];
  if (!t.heads.includes(s.head)) s.head = t.heads[0];
  seg('fType', TYPES.map(x => [x.id, x.name]), s.type, v => { s.type = v; });
  seg('fHead', t.heads.map(h => [h, h.toUpperCase()]), s.head, v => { s.head = v; });
  seg('fMat', MATERIALS.map(m => [m.id, m.name, m.color]), s.material, v => { s.material = v; });
  const bladed = s.type === 'sword' || s.type === 'greatsword' || s.type === 'dagger', ranged = s.type === 'bow' || s.type === 'crossbow';
  $('fGuardRow').hidden = !bladed; $('fPommelRow').hidden = ranged; $('fHiltRow').hidden = ranged; $('fGuardSizeRow').hidden = !bladed; $('fPommelSizeRow').hidden = ranged;
  seg('fGuard', GUARDS.map(x => [x, x.toUpperCase()]), s.guard, v => { s.guard = v; });
  $('fHaftRow').hidden = !hasHaft(s);
  seg('fHaft', HAFTS.map(([id, n, c]) => [id, n, c]), s.haft || 'oak', v => { s.haft = v; });
  seg('fGrip', GRIPS.map(x => [x, x.toUpperCase()]), s.grip, v => { s.grip = v; });
  seg('fPommel', POMMELS.map(x => [x, x.toUpperCase()]), s.pommel, v => { s.pommel = v; });
  seg('fAccent', ACCENTS.map(([c, n]) => [n, n, c]), s.accent, (v, i) => { s.accent = i; });
  seg('fAura', AURAS.map(a => [a.id, a.name, a.color || null]), s.aura || 'none', v => { s.aura = v; });
  seg('fGripCol', GRIP_COLORS.map(([c, n]) => [n, n, c]), s.gripColor, (v, i) => { s.gripColor = i; });
  // the shape: the preset head, or your own (dragged corners or a freehand trace)
  const drawable = canDraw(s);
  $('fShapeRow').hidden = !drawable; $('fPadWrap').hidden = !drawable || !s.shape;
  $('forge').querySelector('.panel').classList.toggle('drawing', drawable && !!s.shape);
  if (renderer) sizePreview();
  if (!drawable) s.shape = null;
  seg('fShape', [['preset', 'OFF'], ['points', 'DRAG CORNERS'], ['draw', 'FREEHAND'], ['erase', 'ERASER']], s.shape ? shapeMode : 'preset', v => {
    if (v === 'preset') { s.shape = null; }
    else { if (!s.shape) s.shape = presetShape(s); shapeMode = v; }
  });
  $('fHeadRow').hidden = drawable && !!s.shape;
  if (s.shape) { pad.set(s.shape, shapeMode); $('fMirror').classList.toggle('on', !!s.shape.mirror); $('fPadHint').textContent = shapeMode === 'draw' ? 'TRACE THE SILHOUETTE IN ONE STROKE' : shapeMode === 'erase' ? 'RUB OUT WHATEVER YOU DRAG OVER' : 'DRAG THE CORNERS · CLICK AN EDGE TO ADD ONE · DOUBLE-CLICK ONE TO REMOVE IT'; }
  $('fLen').value = s.length; $('fHilt').value = s.gripSize ?? s.hilt ?? 1; $('fGuardSize').value = s.guardSize ?? s.hilt ?? 1; $('fPommelSize').value = s.pommelSize ?? s.hilt ?? 1; $('fWid').value = s.width; $('fPow').value = s.auraPower ?? 1;
  $('fPowRow').hidden = !s.aura || s.aura === 'none';
  $('fName').value = s.name || '';
  // the saved ones
  const list = $('fSaved'); list.innerHTML = '';
  if (!forge.saved.length) list.innerHTML = '<span class="small">NOTHING SAVED YET. FORGE ONE AND SAVE IT.</span>';
  forge.saved.forEach((w, i) => {
    const c = clsOf(w), eq = forge.equipped[c] === i;
    const chip = document.createElement('div'); chip.className = 'fchip' + (eq ? ' eq' : '');
    chip.innerHTML = `<button type="button" class="load"><i>${HERO_NAME[c][0]}</i>${w.name || 'UNNAMED'}</button><button type="button" class="eqb">${eq ? 'WIELDED' : 'WIELD'}</button><button type="button" class="del" aria-label="Delete">×</button>`;
    chip.querySelector('.load').addEventListener('click', () => { forge.spec = JSON.parse(JSON.stringify(w)); sfx('pickup'); render(); });
    chip.querySelector('.eqb').addEventListener('click', () => { forge.equipped[c] = i; persist(); sfx('rare'); forge.onEquip && forge.onEquip(w, c); render(); });
    chip.querySelector('.del').addEventListener('click', () => {
      forge.saved.splice(i, 1);
      for (let k = 0; k < 3; k++) { if (forge.equipped[k] === i) { forge.equipped[k] = -1; forge.onEquip && forge.onEquip(null, k); } else if (forge.equipped[k] > i) forge.equipped[k]--; }
      persist(); sfx('nope'); render();
    });
    list.appendChild(chip);
  });
  persist();
  rebuild();
}
let wired = false, pad = null, shapeMode = 'points';
function wire() {
  if (wired) return; wired = true;
  pad = new ShapePad($('fPad'), (shape, live) => { rebuild(); if (!live) persist(); });
  // upside down: the tip becomes the grip end. A mirrored profile is kept mirrored, just read from the other end
  $('fFlip').addEventListener('click', () => {
    const sh = forge.spec.shape; if (!sh) return;
    sh.pts = sh.pts.map(([x, y]) => [x, +(1 - y).toFixed(3)]);
    if (sh.mirror) sh.pts.reverse();
    sfx("pickup"); render();
  });
  $('fMirror').addEventListener('click', () => {
    const sh = forge.spec.shape; if (!sh) return;
    if (sh.mirror) { // open it up: the whole outline becomes editable
      sh.pts = [...sh.pts, ...sh.pts.slice().reverse().map(([x, y]) => [-x, y])]; sh.mirror = false;
    } else { // fold it: keep the right half
      sh.pts = sh.pts.filter(p => p[0] >= 0).sort((a, b) => a[1] - b[1]); if (sh.pts.length < 3) sh.pts = presetShape(forge.spec).pts; sh.mirror = true;
    }
    sfx('pickup'); render();
  });
  $('fShapeReset').addEventListener('click', () => { forge.spec.shape = presetShape(forge.spec); sfx('pickup'); render(); });
  $('fSmooth').addEventListener('click', () => { if (!forge.spec.shape) return; pad.smooth(); sfx('pickup'); });
  $('fBrush').addEventListener('input', e => { pad.brush = +e.target.value; pad.draw(); });
  $('fMorePts').addEventListener('click', () => { if (shapeMode !== 'points') { shapeMode = 'points'; render(); } pad.addPoints(); sfx('pickup'); });
  $('fSpin').addEventListener('click', () => { spin = spin ? 0 : 1; $('fSpin').classList.toggle('on', !!spin); $('fSpin').textContent = spin ? 'SPINNING' : 'STILL'; });
  $('fLen').addEventListener('input', e => { forge.spec.length = +e.target.value; rebuild(); });
  $('fHilt').addEventListener('input', e => { forge.spec.gripSize = +e.target.value; rebuild(); });
  $('fGuardSize').addEventListener('input', e => { forge.spec.guardSize = +e.target.value; rebuild(); });
  $('fPommelSize').addEventListener('input', e => { forge.spec.pommelSize = +e.target.value; rebuild(); });
  $('fWid').addEventListener('input', e => { forge.spec.width = +e.target.value; rebuild(); });
  $('fPow').addEventListener('input', e => { forge.spec.auraPower = +e.target.value; rebuild(); });
  $('fName').addEventListener('input', e => { forge.spec.name = e.target.value.toUpperCase().slice(0, 28); });
  $('fDice').addEventListener('click', () => { forge.spec.name = nameOf(forge.spec); $('fName').value = forge.spec.name; sfx('pickup'); });
  $('fRandom').addEventListener('click', () => { forge.spec = randomSpec(); forge.spec.name = nameOf(forge.spec); sfx('pickup'); render(); });
  $('fSave').addEventListener('click', () => {
    if (!forge.spec.name) forge.spec.name = nameOf(forge.spec);
    if (forge.saved.length >= 16) forge.saved.shift();
    forge.saved.push(JSON.parse(JSON.stringify(forge.spec)));
    sfx('rare'); render();
  });
  $('fWield').addEventListener('click', () => {
    if (!forge.spec.name) forge.spec.name = nameOf(forge.spec);
    const copy = JSON.parse(JSON.stringify(forge.spec));
    forge.saved.push(copy); if (forge.saved.length > 16) forge.saved.shift();
    const c = clsOf(copy);
    forge.equipped[c] = forge.saved.length - 1; persist();
    sfx('rare'); forge.onEquip && forge.onEquip(copy, c); render();
  });
  $('fUnequip').addEventListener('click', () => { const c = clsOf(forge.spec); forge.equipped[c] = -1; persist(); forge.onEquip && forge.onEquip(null, c); sfx('pickup'); render(); });
  $('fClose').addEventListener('click', closeForge);
  addEventListener('resize', () => { if (forge.open) sizePreview(); });
  // the grip between the preview and the pad: drag it to trade pad room for a bigger preview
  {
    const panel = $('fSplit').closest('.panel'), split = $('fSplit');
    const saved = +localStorage.getItem('dw-forge-split'); if (saved) panel.style.setProperty('--fgl', saved + 'px');
    let y0 = 0, h0 = 0;
    split.addEventListener('pointerdown', e => { y0 = e.clientY; h0 = $('forgeGl').clientHeight; split.setPointerCapture(e.pointerId); e.preventDefault(); });
    split.addEventListener('pointermove', e => {
      if (!split.hasPointerCapture(e.pointerId)) return;
      const total = Math.min(830, innerHeight * 0.94 - 140);
      const hh = Math.round(Math.max(120, Math.min(total - 220, h0 + (e.clientY - y0))));
      panel.style.setProperty('--fgl', hh + 'px'); sizePreview(); render(); pad && pad.draw();
    });
    split.addEventListener('pointerup', () => { localStorage.setItem('dw-forge-split', String($('forgeGl').clientHeight)); });
  }
}
export function openForge() {
  wire(); initPreview();
  forge.open = true; $('forge').hidden = false;
  sizePreview(); render();
  last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
}
export function closeForge() {
  forge.open = false; $('forge').hidden = true; cancelAnimationFrame(raf); persist();
  forge.onClose && forge.onClose();
}
