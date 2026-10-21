// ============================================================================
//  DUNGEON WORLD  -  shapepad: draw the blade (or the head) yourself. Two ways:
//  POINTS, where you drag the corners of the outline (click an edge to add one,
//  double-click a corner to take it away), and DRAW, where you trace the
//  silhouette freehand and it's cleaned up into an outline. With MIRROR on,
//  you shape the right half and the left follows.
// ============================================================================
import { fullOutline } from './weaponkit.js';

export class ShapePad {
  constructor(canvas, onChange) {
    this.c = canvas; this.x = canvas.getContext('2d'); this.onChange = onChange;
    this.shape = null; this.mode = 'points'; this.drag = -1; this.stroke = null;
    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    canvas.addEventListener('pointerup', e => this.up(e)); canvas.addEventListener('pointercancel', e => this.up(e));
    canvas.addEventListener('dblclick', e => this.dbl(e));
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  set(shape, mode) { this.shape = shape; if (mode) this.mode = mode; this.draw(); }
  // the pad: x across the middle (-1 .. 1), y up from a base line near the bottom (0 .. 1)
  size() { const r = this.c.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1); if (this.c.width !== Math.round(r.width * dpr)) { this.c.width = Math.round(r.width * dpr); this.c.height = Math.round(r.height * dpr); } return [r.width, r.height, dpr]; }
  // (margins all round: the widest corner and the base line stay well inside the box)
  toPx(p, w, h) { return [w / 2 + p[0] * w * 0.36, h - 28 - p[1] * (h - 56)]; }
  toPt(px, py, w, h) { return [Math.max(-1, Math.min(1, (px - w / 2) / (w * 0.36))), Math.max(0, Math.min(1, (h - 28 - py) / (h - 56)))]; }
  local(e) { const r = this.c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r.width, r.height]; }
  handles() { return this.shape ? this.shape.pts : []; }
  // ---------------------------------------------------------------- input
  down(e) {
    if (!this.shape) return;
    e.preventDefault(); this.c.setPointerCapture(e.pointerId);
    const [px, py, w, h] = this.local(e);
    if (this.mode === 'draw') { this.stroke = [[px, py]]; this.draw(); return; }
    // a corner to drag?
    const H = this.handles();
    let best = -1, bd = 14;
    H.forEach((p, i) => { const [hx, hy] = this.toPx(p, w, h); const d = Math.hypot(hx - px, hy - py); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { this.drag = best; return; }
    // an edge to split?
    const n = H.length;
    for (let i = 0; i < (this.shape.mirror ? n - 1 : n); i++) {
      const a = this.toPx(H[i], w, h), b = this.toPx(H[(i + 1) % n], w, h);
      const d = distToSeg(px, py, a, b);
      if (d < 10) { H.splice(i + 1, 0, this.toPt(px, py, w, h)); this.drag = i + 1; this.changed(); return; }
    }
  }
  move(e) {
    if (!this.shape) return;
    const [px, py, w, h] = this.local(e);
    if (this.mode === 'draw') { if (this.stroke) { this.stroke.push([px, py]); this.draw(); } return; }
    if (this.drag < 0) return;
    let p = this.toPt(px, py, w, h);
    if (this.shape.mirror && p[0] < 0) p[0] = 0;
    this.shape.pts[this.drag] = p;
    this.changed(true);
  }
  up(e) {
    if (this.mode === 'draw' && this.stroke) { this.finishStroke(); this.stroke = null; return; }
    if (this.drag >= 0) { this.drag = -1; this.changed(); }
  }
  // a corner in the middle of every edge (the longest ones first, up to 24 corners)
  addPoints() {
    if (!this.shape) return;
    const H = this.shape.pts, n = H.length, closed = !this.shape.mirror;
    const edges = [];
    for (let i = 0; i < (closed ? n : n - 1); i++) { const a = H[i], b = H[(i + 1) % n]; edges.push([Math.hypot(a[0] - b[0], (a[1] - b[1]) * 1.5), i]); }
    edges.sort((x, y) => y[0] - x[0]);
    const take = edges.slice(0, Math.min(edges.length, Math.max(1, 24 - n))).map(e => e[1]).sort((x, y) => y - x);
    for (const i of take) { const a = H[i], b = H[(i + 1) % n]; H.splice(i + 1, 0, [+((a[0] + b[0]) / 2).toFixed(3), +((a[1] + b[1]) / 2).toFixed(3)]); }
    this.changed();
  }
  dbl(e) {
    if (!this.shape || this.mode !== 'points') return;
    const [px, py, w, h] = this.local(e), H = this.handles();
    if (H.length <= 3) return;
    const i = H.findIndex(p => { const [hx, hy] = this.toPx(p, w, h); return Math.hypot(hx - px, hy - py) < 14; });
    if (i >= 0) { H.splice(i, 1); this.changed(); }
  }
  changed(live = false) { this.draw(); this.onChange && this.onChange(this.shape, live); }
  // ---------------------------------------------------------------- a freehand stroke -> an outline
  finishStroke() {
    const [, , w, h] = this.local({ clientX: 0, clientY: 0 });
    let s = this.stroke;
    if (s.length < 8) { this.draw(); return; }
    s = simplify(s, 3);
    const pts = s.map(([px, py]) => this.toPt(px, py, w, h));
    if (this.shape.mirror) {
      // the width of what you drew at each height, from the base to the tip, as the right half
      const poly = pts.map(([x, y]) => [Math.abs(x), y]);
      const ymin = Math.min(...poly.map(p => p[1])), ymax = Math.max(...poly.map(p => p[1]));
      const half = [];
      const N = 16;
      for (let i = 0; i <= N; i++) {
        const y = ymin + (ymax - ymin) * i / N;
        let xm = 0;
        for (let k = 0; k < poly.length; k++) {
          const a = poly[k], b = poly[(k + 1) % poly.length];
          if ((a[1] <= y && b[1] >= y) || (b[1] <= y && a[1] >= y)) { const t = b[1] === a[1] ? 0 : (y - a[1]) / (b[1] - a[1]); xm = Math.max(xm, a[0] + (b[0] - a[0]) * t); }
        }
        half.push([+xm.toFixed(3), +y.toFixed(3)]);
      }
      // (it comes to a point at the tip; drop the dead flat bits)
      half[half.length - 1][0] = Math.min(half[half.length - 1][0], 0.02);
      this.shape.pts = simplify(half.map(([x, y]) => [x * 200, y * 300]), 2.5).map(([x, y]) => [+(x / 200).toFixed(3), +(y / 300).toFixed(3)]);
    } else {
      // the outline as drawn, closed, shaved of the wobble
      let out = pts.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]);
      if (out.length > 40) out = simplify(out.map(([x, y]) => [x * 200, y * 300]), 3).map(([x, y]) => [+(x / 200).toFixed(3), +(y / 300).toFixed(3)]);
      if (out.length >= 3) this.shape.pts = out;
    }
    this.changed();
  }
  // ---------------------------------------------------------------- drawing the pad
  draw() {
    const [w, h, dpr] = this.size(), x = this.x;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.roundRect(0, 0, w, h, 14); x.fill();
    // the spine and the base line
    x.strokeStyle = 'rgba(255,240,220,.18)'; x.lineWidth = 1; x.setLineDash([4, 5]);
    x.beginPath(); x.moveTo(w / 2, 20); x.lineTo(w / 2, h - 20); x.stroke();
    x.beginPath(); x.moveTo(w * 0.1, h - 28); x.lineTo(w * 0.9, h - 28); x.stroke();
    // the widest the blade can go
    x.beginPath(); x.moveTo(w * 0.14, 28); x.lineTo(w * 0.14, h - 28); x.moveTo(w * 0.86, 28); x.lineTo(w * 0.86, h - 28); x.stroke();
    x.setLineDash([]);
    x.font = '900 10px Nunito, sans-serif'; x.fillStyle = 'rgba(255,240,220,.4)'; x.textAlign = 'center';
    x.fillText('GRIP', w / 2, h - 12); x.fillText('TIP', w / 2, 16);
    if (!this.shape) return;
    const full = fullOutline(this.shape);
    if (full.length >= 3) {
      x.beginPath(); full.forEach((p, i) => { const [px, py] = this.toPx(p, w, h); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.closePath();
      x.fillStyle = 'rgba(200,208,218,.55)'; x.fill(); x.strokeStyle = '#ffffff'; x.lineWidth = 1.5; x.stroke();
    }
    if (this.mode === 'points') {
      this.handles().forEach(p => { const [px, py] = this.toPx(p, w, h); x.beginPath(); x.arc(px, py, 5, 0, 7); x.fillStyle = '#ffc93c'; x.fill(); x.strokeStyle = '#3a1c00'; x.lineWidth = 1.5; x.stroke(); });
    } else if (this.stroke) {
      x.beginPath(); this.stroke.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py));
      x.strokeStyle = '#9fe0ff'; x.lineWidth = 2.5; x.lineJoin = 'round'; x.stroke();
    }
  }
}
function distToSeg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)) : 0;
  return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t));
}
// Ramer-Douglas-Peucker: fewer points, the same look
function simplify(pts, eps) {
  if (pts.length <= 2) return pts;
  let maxD = 0, idx = 0;
  const a = pts[0], b = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) { const d = distToSeg(pts[i][0], pts[i][1], a, b); if (d > maxD) { maxD = d; idx = i; } }
  if (maxD > eps) { const l = simplify(pts.slice(0, idx + 1), eps), r = simplify(pts.slice(idx), eps); return l.slice(0, -1).concat(r); }
  return [a, b];
}
