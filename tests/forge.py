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
    check(n == 24, f'every aura builds and ticks on a blade, a staff and a bow ({n})')
    check(page.evaluate("document.querySelectorAll('#fAura button').length") == 8, 'eight aura choices')
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
        check(not hp or hp[0] < 14, f'and the hero shoots with it ({hp})')
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
