// ============================================================================
//  DUNGEON WORLD  -  input: keyboard and mouse, the touch stick, swipes to look
//  around and the jump button, and PS5 / Xbox controllers (Dungeon Heart's
//  layout: left stick moves, the right stick looks, A / cross jumps).
// ============================================================================
export const input = {
  mx: 0, my: 0,          // move: -1..1 (my: -1 is forward)
  lookX: 0, lookY: 0,    // look this frame (radians, from swipes and the mouse)
  lookRX: 0, lookRY: 0,  // look rate (the right stick, the turn keys)
  jump: false, jumpEdge: false, sprint: false,
  menuEdge: [], lastDevice: 'kb', stickX: 0, stickY: 0, stickId: null,
  mouseSpeed: 1, zoom: 0, wantLock: null, onLockChange: null,
};
const keys = {};
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', KeyD: 'right',
  ArrowLeft: 'turnL', ArrowRight: 'turnR', KeyQ: 'turnL', KeyE: 'turnR', Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Escape: 'pause', KeyP: 'pause', Enter: 'ok', NumpadEnter: 'ok' };
let onAny = () => { };
export function onFirstInput(f) { onAny = f; }
const MENU_KEYS = { up: 'up', down: 'down', left: 'left', right: 'right', turnL: 'left', turnR: 'right', jump: 'ok', ok: 'ok', pause: 'pause' };
addEventListener('keydown', e => {
  const k = KEYMAP[e.code];
  if (!k) return;
  e.preventDefault();
  onAny(); input.lastDevice = 'kb';
  if (!keys[k]) { keys[k] = 1; if (k === 'jump') input.jumpEdge = true; if (MENU_KEYS[k]) input.menuEdge.push(MENU_KEYS[k]); }
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) { keys[k] = 0; e.preventDefault(); } });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; input.stickX = input.stickY = 0; });
addEventListener('touchstart', () => { document.documentElement.classList.add('touchy'); input.lastDevice = 'touch'; }, { capture: true, passive: true });
if (matchMedia('(pointer:coarse)').matches) document.documentElement.classList.add('touchy');

// ---------------------------------------------------------------- touch and mouse
export function initTouch(canvas) {
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  const move = e => {
    const r = stick.getBoundingClientRect();
    let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    input.stickX = dx; input.stickY = dy; knob.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
  };
  stick.addEventListener('pointerdown', e => { e.preventDefault(); onAny(); input.lastDevice = 'touch'; input.stickId = e.pointerId; stick.setPointerCapture(e.pointerId); move(e); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === input.stickId) move(e); });
  const end = e => { if (e.pointerId === input.stickId) { input.stickId = null; input.stickX = input.stickY = 0; knob.style.transform = ''; } };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end); stick.addEventListener('lostpointercapture', end);
  const jb = document.getElementById('tJump');
  jb.addEventListener('pointerdown', e => { e.preventDefault(); onAny(); input.lastDevice = 'touch'; input.tJump = 1; input.jumpEdge = true; jb.classList.add('on'); try { jb.setPointerCapture(e.pointerId); } catch (x) { } });
  const up = () => { input.tJump = 0; jb.classList.remove('on'); };
  jb.addEventListener('pointerup', up); jb.addEventListener('pointercancel', up); jb.addEventListener('lostpointercapture', up);
  jb.addEventListener('contextmenu', e => e.preventDefault());
  // swipes on the open screen (or a mouse drag) turn the camera
  const looks = new Map();
  canvas.addEventListener('pointerdown', e => {
    onAny();
    // on a PC, a click in the world captures the mouse (Esc lets it go)
    if (e.pointerType === 'mouse' && input.wantLock && input.wantLock()) { lockMouse(canvas); return; }
    if (mouseLocked()) return;
    looks.set(e.pointerId, { x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' });
    try { canvas.setPointerCapture(e.pointerId); } catch (x) { }
  });
  canvas.addEventListener('pointermove', e => {
    const l = looks.get(e.pointerId);
    if (!l || mouseLocked()) return;
    // (a finger turns a little faster than a mouse: the screen is small)
    const k = l.touch ? 0.0085 : 0.0055 * input.mouseSpeed;
    input.lookX += (e.clientX - l.x) * k; input.lookY += (e.clientY - l.y) * k;
    l.x = e.clientX; l.y = e.clientY;
  });
  const lend = e => looks.delete(e.pointerId);
  canvas.addEventListener('pointerup', lend); canvas.addEventListener('pointercancel', lend); canvas.addEventListener('lostpointercapture', lend);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  // the captured mouse: every movement turns the camera
  document.addEventListener('mousemove', e => {
    if (!mouseLocked()) return;
    input.lastDevice = 'kb';
    input.lookX += e.movementX * 0.0024 * input.mouseSpeed;
    input.lookY += e.movementY * 0.0024 * input.mouseSpeed;
  });
  // the scroll wheel brings the camera nearer or farther
  canvas.addEventListener('wheel', e => { e.preventDefault(); input.zoom += Math.sign(e.deltaY); }, { passive: false });
  document.addEventListener('pointerlockchange', () => { input.onLockChange && input.onLockChange(mouseLocked()); });
}
export const mouseLocked = () => !!document.pointerLockElement;
export function lockMouse(canvas = document.getElementById('gl')) {
  if (mouseLocked() || !canvas.requestPointerLock) return;
  try {
    // (raw movement where the browser has it: no mouse acceleration)
    const p = canvas.requestPointerLock({ unadjustedMovement: true });
    if (p && p.catch) p.catch(() => { try { const q = canvas.requestPointerLock(); q && q.catch && q.catch(() => { }); } catch (x) { } });
  } catch (x) { }
}
export function unlockMouse() { if (mouseLocked()) document.exitPointerLock(); }

// ---------------------------------------------------------------- controllers
let padPrev = {};
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (const p of pads) if (p && p.connected) { gp = p; break; }
  if (!gp) return null;
  const b = gp.buttons, on = n => !!(b[n] && (b[n].pressed || b[n].value > 0.5));
  const dz = v => Math.abs(v) > 0.18 ? (v - Math.sign(v) * 0.18) / 0.82 : 0;
  const ax = dz(gp.axes[0] || 0), ay = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
  const now = { jump: on(0), sprint: on(1) || on(10) || on(7), up: on(12) || ay < -0.5, down: on(13) || ay > 0.5, left: on(14) || ax < -0.5, right: on(15) || ax > 0.5, start: on(9), back: on(1), ok: on(0) || on(2) };
  const menuMap = { up: 'up', down: 'down', left: 'left', right: 'right', start: 'pause', ok: 'ok', back: 'back' };
  for (const k in now) if (now[k] && !padPrev[k]) {
    onAny(); input.lastDevice = 'pad';
    if (k === 'jump') input.jumpEdge = true;
    if (menuMap[k]) input.menuEdge.push(menuMap[k]);
  }
  padPrev = now;
  return { now, ax, ay, rx, ry, dpx: (on(15) ? 1 : 0) - (on(14) ? 1 : 0), dpy: (on(13) ? 1 : 0) - (on(12) ? 1 : 0) };
}

// once a frame: what the hero is asked to do
export function readInput() {
  const p = pollPad();
  let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  if (p) { dx += p.ax + p.dpx; dy += p.ay + p.dpy; }
  dx += input.stickX; dy += input.stickY;
  const l = Math.hypot(dx, dy);
  input.mx = l > 1 ? dx / l : dx; input.my = l > 1 ? dy / l : dy;
  if (l < 0.12) input.mx = input.my = 0;
  input.lookRX = (keys.turnR ? 1 : 0) - (keys.turnL ? 1 : 0) + (p ? p.rx : 0);
  input.lookRY = p ? p.ry : 0;
  input.jump = !!(keys.jump || input.tJump || (p && p.now.jump));
  input.sprint = !!(keys.sprint || (p && p.now.sprint));
  return input;
}
export function takeLook() { const x = input.lookX, y = input.lookY; input.lookX = input.lookY = 0; return [x, y]; }
export function menuKeys() { pollPad(); const k = input.menuEdge; input.menuEdge = []; return k; }
