// node tools/builder.mjs: builds dist/builder.html, the hunter builder (a prototype page) in one file
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const alias = { name: 'three-addons', setup(b) { b.onResolve({ filter: /^three\/addons\// }, a => ({ path: path.join(root, 'node_modules/three/examples/jsm', a.path.slice('three/addons/'.length)) })); } };
const js = (await esbuild.build({ bundle: true, minify: true, write: false, plugins: [alias], target: 'es2020', format: 'esm', logLevel: 'warning', loader: { '.glb': 'binary', '.gltf': 'text' }, entryPoints: [path.join(root, 'src/builder.js')] })).outputFiles[0].text;
const html = fs.readFileSync(path.join(root, 'src/builder.html'), 'utf8') + `\n<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>\n`;
fs.writeFileSync(path.join(root, 'dist/builder.html'), html);
console.log('dist/builder.html', (html.length / 1024).toFixed(0), 'KB');
