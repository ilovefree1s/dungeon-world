#!/usr/bin/env python3
"""The forge: opens it from the menu, builds a random weapon, saves and wields it, checks the warrior holds it
and swings with its numbers, loads a saved one, deletes one, and takes a screenshot (shots/forge.png).

  python3 tests/forge.py
"""
import functools, http.server, pathlib, sys, threading
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
out = ROOT / 'shots'; out.mkdir(exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{srv.server_address[1]}/'
THREE = ROOT / 'node_modules/three'
def cdn(route):
    f = THREE / route.request.url.split('three@0.160.0/', 1)[1]
    route.fulfill(path=str(f), content_type='application/javascript') if f.exists() else route.fulfill(status=404, body='')
fails, errors = [], []
def check(ok, what):
    print(('  ok  ' if ok else '  FAIL') + ' ' + what)
    if not ok: fails.append(what)
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    page = b.new_context(viewport={'width': 1152, 'height': 720}).new_page()
    page.set_default_timeout(600000)
    page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', cdn)
    page.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
    page.on('pageerror', lambda e: errors.append(str(e)))
    # (a shader that fails to compile only logs; count that as an error too)
    page.on('console', lambda m: errors.append(m.text[:300]) if m.type == 'error' or 'WebGLProgram' in m.text or 'Shader Error' in m.text else None)
    page.goto(base + 'index.html?q=0&t=0.42&fresh&flat')
    page.wait_for_function('window.__dw')
    page.wait_for_function('__dw.world.readyAround(__dw.player.pos.x, __dw.player.pos.z, 40) >= 1')
    page.evaluate('window.__fc = 0; (function f(){ __fc++; requestAnimationFrame(f); })()')
    def frames(n):
        page.evaluate('window.__f0 = __fc'); page.wait_for_function(f'__fc - __f0 >= {n}')
    # from the title screen, before any hero is picked
    page.evaluate("document.getElementById('forgeBtnTitle').click()"); frames(3)
    check(page.evaluate("__dw.UI.state") == 'forge' and page.evaluate("document.getElementById('title').hidden"), 'the forge opens from the title screen')
    page.evaluate("document.getElementById('fClose').click()"); frames(2)
    check(page.evaluate("__dw.UI.state") == 'title' and not page.evaluate("document.getElementById('title').hidden"), 'and BACK returns to the title screen')
    page.evaluate('__dw.start(0)')
    page.wait_for_function("__dw.UI.state === 'play'")
    def frames(n):
        page.evaluate('window.__f0 = __fc'); page.wait_for_function(f'__fc - __f0 >= {n}')
    page.evaluate("document.getElementById('menuBtn').click()"); frames(2)
    page.evaluate("document.getElementById('forgeBtn').click()"); frames(3)
    check(page.evaluate("__dw.UI.state") == 'forge' and not page.evaluate("document.getElementById('forge').hidden"), 'the forge opens from the menu')
    check(page.evaluate("document.querySelectorAll('#fType button').length") == 10, 'ten weapon types to pick from')
    # every type, every head, every material builds without an error
    n = page.evaluate("""(async () => { const K = await import('./src/weaponkit.js'); let n = 0;
      for (const t of K.TYPES) for (const h of t.heads) for (const m of K.MATERIALS) { const s = K.defaultSpec(); s.type = t.id; s.head = h; s.material = m.id; s.guard = K.GUARDS[n % 6]; s.grip = K.GRIPS[n % 5]; s.pommel = K.POMMELS[n % 6]; K.buildForged(s); n++; } return n; })()""")
    check(n == 400, f'every type, head and material combination builds ({n})')
    n = page.evaluate("""(async () => { const K = await import('./src/weaponkit.js'); let n = 0;
      for (const a of K.AURAS) for (const t of ['sword', 'staff', 'bow']) { const s = K.defaultSpec(); s.type = t; s.head = K.TYPES.find(x => x.id === t).heads[0]; s.aura = a.id; const g = K.buildForged(s); if (a.id !== 'none' && !g.userData.tick) throw new Error('no aura tick'); if (g.userData.tick) { g.userData.tick(1); g.userData.tick(1.05); } n++; } return n; })()""")
    check(n == 33, f'every aura builds and ticks on a blade, a staff and a bow ({n})')
    check(page.evaluate("document.querySelectorAll('#fAura button').length") == 11, 'eleven aura choices')
    # drawing the blade: POINTS (drag a corner) and DRAW (trace a silhouette)
    page.evaluate("[...document.querySelectorAll('#fType button')].find(b => b.dataset.v === 'sword').click()"); frames(2)
    page.evaluate("[...document.querySelectorAll('#fShape button')].find(b => b.dataset.v === 'points').click()"); frames(2)
    sh = page.evaluate('__dw.forge.spec.shape')
    check(sh and sh['mirror'] and len(sh['pts']) >= 3 and not page.evaluate("document.getElementById('fPadWrap').hidden"), f'POINTS starts from the preset blade ({len(sh["pts"]) if sh else 0} corners) and shows the pad')
    st0 = page.evaluate('__dw.player.forged') or {}
    box = page.evaluate("(() => { const r = document.getElementById('fPad').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
    # the second corner sits at (x, y) in pad units: drag it out to the right
    px = page.evaluate("(() => { const p = __dw.forge.spec.shape.pts[1], r = document.getElementById('fPad').getBoundingClientRect(); return [r.left + r.width / 2 + p[0] * r.width * 0.42, r.top + r.height - 16 - p[1] * (r.height - 32)]; })()")
    page.mouse.move(px[0], px[1]); page.mouse.down(); page.mouse.move(px[0] + 60, px[1], steps=6); page.mouse.up(); frames(2)
    sh2 = page.evaluate('__dw.forge.spec.shape')
    check(sh2['pts'][1][0] > sh['pts'][1][0] + 0.2, f'dragging a corner widens the blade ({sh["pts"][1][0]} -> {sh2["pts"][1][0]})')
    page.evaluate("[...document.querySelectorAll('#fShape button')].find(b => b.dataset.v === 'draw').click()"); frames(2)
    cx, top, bot = box[0] + box[2] / 2, box[1] + 24, box[1] + box[3] - 20
    page.mouse.move(cx, top); page.mouse.down()
    for k in range(1, 21):
        tt = k / 20; page.mouse.move(cx + box[2] * 0.3 * (1 - abs(tt - 0.5) * 2) ** 0.6 * (1 if k < 20 else 0.2), top + (bot - top) * tt, steps=2)
    page.mouse.move(cx, bot); page.mouse.up(); frames(2)
    sh3 = page.evaluate('__dw.forge.spec.shape')
    check(len(sh3['pts']) >= 4 and max(p[0] for p in sh3['pts']) > 0.5, f'a traced silhouette becomes a wide leaf blade ({len(sh3["pts"])} corners, widest {max(p[0] for p in sh3["pts"]):.2f})')
    # the eraser carves a bite out of the edge; SMOOTH rounds the corners
    page.evaluate("document.getElementById('fErase').click()"); frames(2)
    ne0 = page.evaluate('__dw.forge.spec.shape.pts.length')
    ex = page.evaluate("(() => { const p = __dw.forge.spec.shape.pts, r = document.getElementById('fPad').getBoundingClientRect(); const q = p[Math.floor(p.length / 2)]; return [r.left + r.width / 2 + q[0] * r.width * 0.36, r.top + r.height - 28 - q[1] * (r.height - 56)]; })()")
    page.mouse.move(ex[0] + 10, ex[1]); page.mouse.down(); page.mouse.move(ex[0] - 10, ex[1] - 20, steps=5); page.mouse.up(); frames(2)
    ne1 = page.evaluate('__dw.forge.spec.shape.pts.length')
    er = page.evaluate('__dw.forge.spec.shape')
    check(er['mirror'] is False and ne1 >= 3 and max(p[0] for p in er['pts']) > 0.1, f'the eraser rubs a bite out of the blade and leaves a full outline ({ne0} -> {ne1} corners)')
    page.evaluate("document.getElementById('fSmooth').click()"); frames(1)
    check(page.evaluate('__dw.forge.spec.shape.pts.length') != ne1, 'SMOOTH rounds the corners')
    page.evaluate("[...document.querySelectorAll('#fShape button')].find(b => b.dataset.v === 'points').click()"); frames(1)
    n0 = page.evaluate('__dw.forge.spec.shape.pts.length')
    page.evaluate("document.getElementById('fMorePts').click()"); frames(1)
    check(page.evaluate('__dw.forge.spec.shape.pts.length') > n0, f'+ MORE CORNERS adds corners ({n0} -> {page.evaluate("__dw.forge.spec.shape.pts.length")})')
    page.evaluate("document.getElementById('fSpin').click()"); frames(1)
    check(page.evaluate("document.getElementById('fSpin').textContent") == 'STILL', 'the spin toggle stops the preview turning')
    page.evaluate("document.getElementById('fSpin').click()"); frames(1)
    # FLIP turns it upside down: what was at the tip is now at the grip
    top0 = page.evaluate('(() => { const p = __dw.forge.spec.shape.pts; return p.reduce((m, q) => Math.max(m, q[1]), 0); })()')
    wTip0 = page.evaluate('(() => { const p = __dw.forge.spec.shape.pts; const t = p.reduce((m, q) => Math.max(m, q[1]), 0); return p.filter(q => q[1] > t - 0.05).reduce((m, q) => Math.max(m, Math.abs(q[0])), 0); })()')
    page.evaluate("document.getElementById('fFlip').click()"); frames(1)
    wGrip1 = page.evaluate('(() => { const p = __dw.forge.spec.shape.pts; return p.filter(q => q[1] < 0.05).reduce((m, q) => Math.max(m, Math.abs(q[0])), 0); })()')
    check(abs(wGrip1 - wTip0) < 0.02, f'FLIP turns the blade upside down (tip width {wTip0:.2f} is now the grip width {wGrip1:.2f})')
    page.evaluate("document.getElementById('fFlip').click()"); frames(1)
    # (the eraser left a full outline: fold it, then open it again)
    if not page.evaluate('__dw.forge.spec.shape.mirror'): page.evaluate("document.getElementById('fMirror').click()"); frames(1)
    page.evaluate("document.getElementById('fMirror').click()"); frames(1)
    check(not page.evaluate('__dw.forge.spec.shape.mirror') and page.evaluate('__dw.forge.spec.shape.pts.length') >= 6, 'MIRROR off opens the whole outline for editing')
    page.evaluate("[...document.querySelectorAll('#fType button')].find(b => b.dataset.v === 'hammer').click()"); frames(1)
    page.evaluate("[...document.querySelectorAll('#fHaft button')].find(b => b.dataset.v === 'steel').click()"); frames(1)
    page.evaluate("[...document.querySelectorAll('#fShape button')].find(b => b.dataset.v === 'points').click()"); frames(2)
    check(page.evaluate('__dw.forge.spec.haft') == 'steel' and page.evaluate('!!__dw.forge.spec.shape') and not page.evaluate("document.getElementById('fHaftRow').hidden"), 'a hammer takes a steel haft and a drawn head')
    page.evaluate("[...document.querySelectorAll('#fShape button')].find(b => b.dataset.v === 'preset').click()"); frames(1)
    check(page.evaluate('__dw.forge.spec.shape') is None, 'PRESET goes back to the stock head')
    page.evaluate("document.getElementById('fRandom').click()"); frames(2)
    name = page.evaluate("document.getElementById('fName').value")
    check(len(name) > 2, f'random gives a named weapon ({name})')
    page.evaluate("[...document.querySelectorAll('#fType button')].find(b => b.dataset.v === 'hammer').click()"); frames(2)
    check(page.evaluate("document.querySelectorAll('#fHead button').length") == 4 and page.evaluate("document.getElementById('fGuardRow').hidden"), 'picking a hammer changes the heads and hides the guard row')
    page.screenshot(path=str(out / 'forge.png'))
    page.evaluate("document.getElementById('fWield').click()"); frames(2)
    held = page.evaluate("(() => { const u = __dw.player.model.userData; return u.sword.children.length && !!u.sword.children[0].userData.spec; })()")
    check(held, 'SAVE & WIELD puts it in the warrior\'s hand')
    st = page.evaluate('__dw.player.forged')
    check(st and st['dmg'] > 1.2 and st['spd'] < 0.9, f'a hammer hits harder and slower ({st})')
    check(page.evaluate("document.querySelectorAll('#fSaved .fchip').length") == 1 and page.evaluate("document.querySelector('#fSaved .fchip').classList.contains('eq')"), 'it shows in the saved list as wielded')
    page.evaluate("document.getElementById('fSave').click()"); frames(1)
    check(page.evaluate("document.querySelectorAll('#fSaved .fchip').length") == 2, 'SAVE adds another')
    page.evaluate("document.querySelectorAll('#fSaved .fchip .del')[1].click()"); frames(1)
    check(page.evaluate("document.querySelectorAll('#fSaved .fchip').length") == 1, 'the × deletes it')
    # a staff for the mage, a bow for the hunter: wielding one switches to that hero
    for typ, cls, hold, what in (('staff', 1, 'staff', 'orbMat'), ('crossbow', 2, 'bow', 'string')):
        page.evaluate(f"[...document.querySelectorAll('#fType button')].find(b => b.dataset.v === '{typ}').click()"); frames(2)
        page.evaluate("document.getElementById('fRandom').click(); [...document.querySelectorAll('#fType button')].find(b => b.dataset.v === '%s').click()" % typ); frames(2)
        page.evaluate("document.getElementById('fWield').click()"); frames(3)
        ok = page.evaluate(f"(() => {{ const p = __dw.player, u = p.model.userData; return p.cls === {cls} && u.{hold}.children.length === 1 && !!u.{hold}.children[0].userData.spec && !!u.{what}; }})()")
        check(ok, f'SAVE & WIELD a {typ} hands it to hero {cls} ({hold} in hand)')
        page.evaluate("document.getElementById('fClose').click()"); frames(1); page.evaluate("document.getElementById('resume').click()"); frames(1)
        page.wait_for_function('__dw.player.onGround')
        page.evaluate('__dw.monsters.spawn(1, __dw.player.pos.x - Math.sin(__dw.player.yaw) * 8, __dw.player.pos.y, __dw.player.pos.z - Math.cos(__dw.player.yaw) * 8).atk = 0'); frames(2)
        page.evaluate('__dw.input.atkEdge = true'); frames(14)
        hp = page.evaluate('__dw.monsters.list.map(m => m.hp)')
        check(not hp or hp[0] < 14, f'and the hero shoots with it ({hp})' + ('' if (not hp or hp[0] < 14) else '  debug: ' + str(page.evaluate('[__dw.player.pitch, __dw.player.yaw, __dw.player.camDist, __dw.abilities.ctx.aimAt.toArray(), __dw.monsters.list.map(m => m.pos.toArray()), __dw.player.pos.toArray(), __dw.abilities.atkCd, __dw.UI.state, __dw.abilities.ctx.frozen, __dw.player.onGround]'))))
        page.evaluate('__dw.monsters.list.slice().forEach(m => __dw.monsters.remove(m))')
        page.evaluate("document.getElementById('menuBtn').click()"); frames(1); page.evaluate("document.getElementById('forgeBtn').click()"); frames(2)
    check(page.evaluate("document.querySelectorAll('#fSaved .fchip.eq').length") == 3, 'three weapons wielded, one per hero')
    page.evaluate("document.getElementById('fClose').click()"); frames(2)
    check(page.evaluate("__dw.UI.state") == 'menu', 'BACK returns to the menu')
    page.evaluate("document.getElementById('resume').click()"); frames(2)
    # it survives a reload
    page.reload(); page.wait_for_function('window.__dw')
    page.wait_for_function('__dw.world.readyAround(__dw.player.pos.x, __dw.player.pos.z, 40) >= 1')
    page.evaluate('__dw.start(0)'); page.wait_for_function("__dw.UI.state === 'play'")
    page.evaluate('window.__fc = 0; (function f(){ __fc++; requestAnimationFrame(f); })()')
    held = page.evaluate("(() => { const p = __dw.player; const h = []; for (const c of [0, 1, 2]) { p.setClass(c); const u = p.model.userData, hold = [u.sword, u.staff, u.bow][c]; h.push(hold.children.length === 1 && !!hold.children[0].userData.spec); } p.setClass(0); return h; })()")
    check(all(held), f'every hero still holds its forged weapon after a reload ({held})')
    page.evaluate("__dw.player.pitch = 0.1; __dw.player.camDist = 9"); frames(3)
    page.screenshot(path=str(out / 'forge-held.png'))
    b.close()
for e in errors: print('  page error:', e)
check(not errors, 'no page errors')
if fails: print('FAILED:', len(fails)); sys.exit(1)
print('all good')
