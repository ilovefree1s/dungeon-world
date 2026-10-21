// node tools/artifact.mjs: builds dist/play.html, the whole game in one page (three.js, the modules and
// the chunk worker bundled in) for the claude.ai artifact. The music is published beside it as
// music/dungeon_echoes.mp3. (index.html, for GitHub Pages, stays plain modules: python3 build.py)
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const alias = {
  name: 'three-addons',
  setup(b) { b.onResolve({ filter: /^three\/addons\// }, a => ({ path: path.join(root, 'node_modules/three/examples/jsm', a.path.slice('three/addons/'.length)) })); },
};
const common = { bundle: true, minify: true, write: false, plugins: [alias], target: 'es2020', logLevel: 'warning' };
const worker = (await esbuild.build({ ...common, entryPoints: [path.join(root, 'src/genworker.js')], format: 'iife' })).outputFiles[0].text;
const main = (await esbuild.build({ ...common, entryPoints: [path.join(root, 'src/main.js')], format: 'esm' })).outputFiles[0].text;
const head = fs.readFileSync(path.join(root, 'src/head.html'), 'utf8');
const esc = s => s.replace(/<\/script/gi, '<\\/script');
const html = head + `
<div id="boot" style="position:fixed;inset:0;display:grid;place-items:center;background:#0b0908;color:#ffc93c;font:900 28px 'Luckiest Guy',Nunito,sans-serif;z-index:99;letter-spacing:.04em">LOADING THE WORLD...</div>
<script>window.__DW_WORKER_URL = URL.createObjectURL(new Blob([${JSON.stringify(esc(worker))}], { type: 'text/javascript' }));</script>
<script type="module">${esc(main)}</script>
</body>
</html>
`;
fs.mkdirSync(path.join(root, 'dist/music'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/play.html'), html);
fs.copyFileSync(path.join(root, 'music/dungeon_echoes.mp3'), path.join(root, 'dist/music/dungeon_echoes.mp3'));
console.log('dist/play.html', (html.length / 1024).toFixed(0), 'KB');
