// ============================================================================
//  DUNGEON WORLD  -  input: keyboard and mouse, the touch stick, swipes to look
//  around and the jump button, and PS5 / Xbox controllers (Dungeon Heart's
//  layout: left stick moves, the right stick looks, A / cross jumps).
// ============================================================================
export const input = {
  mx: 0, my: 0,          // move: -1..1 (my: -1 is forward)
  lookX: 0, lookY: 0,    // look this frame (radians, from swipes and the mouse)
  lookRX: 0, lookRY: 0,  // look rate (the right stick, the turn keys)
  jump: false, jumpEdge: false, sprint: false, atk: false, atkEdge: false, useEdge: false, abEdge: [false, false, false],
  menuEdge: [], lastDevice: 'kb', stickX: 0, stickY: 0, stickId: null,
  mouseSpeed: 1, zoom: 0, wantLock: null, onLockChange: null,
  cursorMode: false, cursor: { x: 0, y: 0, in: false }, clickAt: null, rclickAt: null, bothHeld: false, turnWith: false, autoAtk: false, dragging: false,
};
const keys = {};
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', KeyD: 'right',
  ArrowLeft: 'turnL', ArrowRight: 'turnR', Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint',
  KeyJ: 'atk', KeyZ: 'atk', Digit1: 'ab0', KeyK: 'ab0', Digit2: 'ab1', KeyQ: 'ab1', KeyL: 'ab1', Digit3: 'ab2', KeyE: 'ab2',
  Escape: 'pause', KeyP: 'pause', Enter: 'ok', NumpadEnter: 'ok', KeyF: 'use', KeyC: 'char', KeyB: 'bags', KeyI: 'bags' };
let onAny = () => { };
export function onFirstInput(f) { onAny = f; }
const MENU_KEYS = { up: 'up', down: 'down', left: 'left', right: 'right', turnL: 'left', turnR: 'right', jump: 'ok', ok: 'ok', pause: 'pause', char: 'char', bags: 'bags' };
addEventListener('keydown', e => {
  const k = KEYMAP[e.code];
  if (!k) return;
  e.preventDefault();
  onAny(); input.lastDevice = 'kb';
  if (!keys[k]) { keys[k] = 1; if (k === 'jump') input.jumpEdge = true; if (k === 'atk') input.atkEdge = true; if (k === 'use') input.useEdge = true; if (k.startsWith('ab')) input.abEdge[+k[2]] = true; if (MENU_KEYS[k]) input.menuEdge.push(MENU_KEYS[k]); }
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
  const btn = (id, flag, edge) => {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', e => { e.preventDefault(); onAny(); input.lastDevice = 'touch'; input[flag] = 1; input[edge] = true; el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch (x) { } });
    const up = () => { input[flag] = 0; el.classList.remove('on'); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
  };
  btn('tJump', 'tJump', 'jumpEdge'); btn('tAtk', 'tAtk', 'atkEdge');
  // the ability bar: a tap fires one
  document.querySelectorAll('#abil .slot').forEach((el, i) => {
    el.addEventListener('pointerdown', e => { e.preventDefault(); onAny(); input.abEdge[i] = true; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 120); });
    el.addEventListener('contextmenu', e => e.preventDefault());
  });
  // swipes on the open screen (or a mouse drag) turn the camera.
  // a mouse has two ways to work (input.cursorMode): captured (click the world and every movement looks; Esc lets go)
  // or a cursor (the pointer stays: left-drag orbits the camera, right-drag turns you with it, both buttons held
  // walk you forward, and a plain click picks what's under it: a monster to fight, a body to loot)
  const looks = new Map();
  let mouseButtons = 0;
  canvas.addEventListener('pointerdown', e => {
    onAny();
    if (e.pointerType === 'mouse') {
      if (!input.cursorMode) {
        // on a PC, a click in the world captures the mouse (Esc lets it go)
        if (input.wantLock && input.wantLock()) { lockMouse(canvas); return; }
        if (mouseLocked()) { if (e.button === 0) { input.mAtk = 1; input.atkEdge = true; } else if (e.button === 2) input.abEdge[0] = true; return; }
      } else {
        mouseButtons |= (1 << e.button); input.bothHeld = (mouseButtons & 3) === 3;
        looks.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, touch: false, button: e.button, moved: 0, t0: performance.now(), turn: e.button === 2 });
        try { canvas.setPointerCapture(e.pointerId); } catch (x) { }
        return;
      }
    }
    looks.set(e.pointerId, { x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' });
    try { canvas.setPointerCapture(e.pointerId); } catch (x) { }
  });
  canvas.addEventListener('pointermove', e => {
    input.cursor.x = e.clientX; input.cursor.y = e.clientY; input.cursor.in = true;
    const l = looks.get(e.pointerId);
    if (!l || mouseLocked()) return;
    // (a finger turns a little faster than a mouse: the screen is small)
    const k = l.touch ? 0.0085 : 0.0055 * input.mouseSpeed;
    if (l.moved !== undefined) { l.moved += Math.abs(e.clientX - l.x) + Math.abs(e.clientY - l.y); if (l.moved > 6) input.dragging = true; }   // (a real drag: the cursor hides while it lasts)
    input.lookX += (e.clientX - l.x) * k; input.lookY += (e.clientY - l.y) * k;
    if (l.turn) input.turnWith = true;   // (the right button: the hero turns with the camera)
    l.x = e.clientX; l.y = e.clientY;
  });
  canvas.addEventListener('pointerleave', () => { input.cursor.in = false; });
  const lend = e => {
    const l = looks.get(e.pointerId); looks.delete(e.pointerId);
    if (e.pointerType === 'mouse' && input.cursorMode) {
      mouseButtons &= ~(1 << e.button); input.bothHeld = (mouseButtons & 3) === 3; if (!mouseButtons) input.dragging = false;
      // a click that didn't drag: pick what's under the cursor (left), or the first ability (right)
      // a click that didn't drag: the left picks what's under the cursor (a target, loot); the right attacks it (auto-attack)
      if (l && l.moved !== undefined && l.moved < 6 && performance.now() - l.t0 < 400) { if (l.button === 0) input.clickAt = { x: e.clientX, y: e.clientY }; else if (l.button === 2) input.rclickAt = { x: e.clientX, y: e.clientY }; }
      return;
    }
    if (e.button === 0) input.mAtk = 0;
  };
  canvas.addEventListener('pointerup', lend); canvas.addEventListener('pointercancel', lend); canvas.addEventListener('lostpointercapture', lend);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  // the captured mouse: every movement turns the camera
  document.addEventListener('mousemove', e => {
    if (!mouseLocked() || input.lookOff) return; // (lookOff: a menu is open)
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
  // A / cross jumps, X / square attacks, B / circle blinks or rolls, the sticks' clicks, LT and RB run
  // A / cross jumps, X / square attacks, B / circle, Y / triangle and LB the three abilities, RB, LT and the sticks' clicks run
  const now = { jump: on(0), atk: on(2), ab0: on(1), ab1: on(3), ab2: on(4), sprint: on(10) || on(6) || on(5) || on(7), up: on(12) || ay < -0.5, down: on(13) || ay > 0.5, left: on(14) || ax < -0.5, right: on(15) || ax > 0.5, start: on(9), back: on(1), ok: on(0) || on(2) };
  const menuMap = { up: 'up', down: 'down', left: 'left', right: 'right', start: 'pause', ok: 'ok', back: 'back' };
  for (const k in now) if (now[k] && !padPrev[k]) {
    onAny(); input.lastDevice = 'pad';
    if (k === 'jump') input.jumpEdge = true;
    if (k === 'atk') input.atkEdge = true;
    if (k.startsWith('ab')) input.abEdge[+k[2]] = true;
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
  if (input.bothHeld && input.cursorMode) { input.my = -1; input.mx = dx > 0.3 ? 1 : dx < -0.3 ? -1 : 0; }
  input.lookRX = (keys.turnR ? 1 : 0) - (keys.turnL ? 1 : 0) + (p ? p.rx : 0);
  input.lookRY = p ? p.ry : 0;
  input.jump = !!(keys.jump || input.tJump || (p && p.now.jump));
  input.sprint = !!(keys.sprint || (p && p.now.sprint));
  input.atk = !!(keys.atk || input.tAtk || input.mAtk || input.autoAtk || (p && p.now.atk));
  return input;
}
export function takeLook() { const x = input.lookX, y = input.lookY; input.lookX = input.lookY = 0; return [x, y]; }
export function menuKeys() { pollPad(); const k = input.menuEdge; input.menuEdge = []; return k; }
