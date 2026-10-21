// the chunk builder, off the main thread: a chunk's blocks and meshes are made here and handed back
import { createGen } from './gen.js';
let gen = null;
onmessage = e => {
  const m = e.data;
  if (m.type === 'init') { gen = createGen(m.seed, m.flat); return; }
  if (m.type === 'gen') {
    const c = gen.chunk(m.cx, m.cz);
    c.id = m.id;
    const t = [c.vox.buffer];
    for (const k of ['solid', 'glow', 'water']) for (const a of ['p', 'n', 'c', 'i']) t.push(c[k][a].buffer);
    postMessage(c, t);
  }
};
