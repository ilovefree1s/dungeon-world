#!/usr/bin/env python3
"""Builds index.html: the page (src/head.html), the import map for three.js, and the game's modules (as in Dungeon Heart)."""
import pathlib
root = pathlib.Path(__file__).parent
head = (root / 'src/head.html').read_text()
tail = '''
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>
<div id="boot" style="position:fixed;inset:0;display:grid;place-items:center;background:#0b0908;color:#ffc93c;font:900 28px 'Luckiest Guy',Nunito,sans-serif;z-index:99;letter-spacing:.04em">LOADING THE WORLD...</div>
<script type="module">
const fail = e => {
  const b = document.getElementById('boot') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'boot' }));
  b.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:#0b0908;color:#ffd8c0;font:700 18px Nunito,sans-serif;z-index:99;padding:24px;text-align:center';
  b.innerHTML = '<div><div style="font:900 30px Luckiest Guy,Nunito,sans-serif;color:#ff6a55;margin-bottom:12px">THE WORLD WOULD NOT OPEN</div>'
    + (/webgl/i.test(String(e)) ? 'This browser or device has 3D graphics (WebGL) turned off. Try Chrome, Safari or Edge.' : 'Something went wrong: ' + String(e && e.message || e).replace(/</g, '&lt;'))
    + '<br><br>Reload the page to try again.</div>';
};
import('./src/main.js').catch(fail);
</script>
</body>
</html>
'''
(root / 'index.html').write_text(head + tail)
print('index.html', len(head + tail), 'bytes')
