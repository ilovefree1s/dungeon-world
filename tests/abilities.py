#!/usr/bin/env python3
"""Every hero's attack and three abilities, tried on a flat meadow against three slimes in a row:

  python3 tests/abilities.py

Checks that each attack hurts the nearest slime, that each ability does what it says (hurts, freezes,
moves the hero) and that nothing throws. (Headless Chromium with software WebGL, as tests/play.py.)
"""
import functools, http.server, pathlib, sys, threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{srv.server_address[1]}/'
THREE = ROOT / 'node_modules/three'
def cdn(route):
    rel = route.request.url.split('three@0.160.0/', 1)[1]
    f = THREE / rel
    route.fulfill(path=str(f), content_type='application/javascript') if f.exists() else route.fulfill(status=404, body='')
fails, errors = [], []
def check(ok, what):
    print(('  ok  ' if ok else '  FAIL') + ' ' + what)
    if not ok: fails.append(what)

# three slimes ahead of the hero at 4, 8 and 12 blocks, toothless
SPAWN = """(() => { const p = __dw.player; __dw.monsters.list.slice().forEach(m => __dw.monsters.remove(m)); const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  for (const d of [4, 8, 12]) { const m = __dw.monsters.spawn(1, p.pos.x + fx * d, p.pos.y, p.pos.z + fz * d); m.atk = 0; } __dw.hero.hp = __dw.hero.maxHp; })()"""
# what each ability must do: 'hurt' (some slime loses hp), 'move' (the hero moves over 8 blocks), 'freeze' (slimes get frz), 'kill'
EXPECT = [
  ('WARRIOR', [('CHARGE', 'hurt move'), ('WHIRL', 'hurt'), ('SLAM', 'hurt')]),
  ('MAGE', [('BLINK', 'move'), ('NOVA', 'hurt freeze'), ('METEOR', 'hurt')]),
  ('HUNTER', [('ROLL', 'move'), ('MULTI', 'hurt'), ('RAIN', 'hurt')]),
]
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 1152, 'height': 648})
    page = ctx.new_page()
    page.set_default_timeout(600000)
    page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', cdn)
    page.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base + 'index.html?q=0&t=0.42&fresh&flat')
    page.wait_for_function('window.__dw')
    page.wait_for_function('__dw.world.readyAround(__dw.player.pos.x, __dw.player.pos.z, 40) >= 1')
    page.evaluate('__dw.start(0)')
    page.wait_for_function("__dw.UI.state === 'play'")
    page.evaluate('__dw.setQuality(0); window.__fc = 0; (function f(){ __fc++; requestAnimationFrame(f); })()')
    def frames(n):
        page.evaluate('window.__f0 = __fc'); page.wait_for_function(f'__fc - __f0 >= {n}')
    for cls, (name, abils) in enumerate(EXPECT):
        page.evaluate(f'__dw.player.setClass({cls}); __dw.abilities.reset()'); frames(2)
        page.wait_for_function('__dw.player.onGround')
        page.evaluate(SPAWN); frames(2)
        hp0 = page.evaluate('__dw.monsters.list.map(m => m.hp)')
        page.evaluate('__dw.input.atkEdge = true'); frames(12)
        hp1 = page.evaluate('__dw.monsters.list.map(m => m.hp)')
        check(len(hp1) < 3 or min(hp1) < min(hp0), f"{name}: the attack hurts a slime ({hp0} -> {hp1})")
        for i, (aname, want) in enumerate(abils):
            page.evaluate(SPAWN); frames(2)
            hp0 = page.evaluate('__dw.monsters.list.map(m => m.hp)'); p0 = page.evaluate('__dw.player.pos.toArray()')
            got = page.evaluate(f'__dw.abilities.slots()[{i}].name')
            page.evaluate(f'__dw.input.abEdge[{i}] = true'); frames(6)
            frz = page.evaluate('__dw.monsters.list.map(m => m.frz)')
            frames(40 if aname == 'RAIN' else 24)
            hp1 = page.evaluate('__dw.monsters.list.map(m => m.hp)'); p1 = page.evaluate('__dw.player.pos.toArray()')
            moved = ((p1[0] - p0[0]) ** 2 + (p1[2] - p0[2]) ** 2) ** 0.5
            hurt = len(hp1) < 3 or sum(hp1) < sum(hp0)   # (monsters now have health to match the hero: a skill hurts, it needn't kill)
            res = { 'hurt': hurt, 'move': moved > 8, 'freeze': any(f > 0 for f in frz) }
            ok = got == aname and all(res[w] for w in want.split())
            check(ok, f"{name} {i + 1} {got}: {want} ({hp0} -> {hp1}, moved {moved:.1f}, frozen {sum(1 for f in frz if f > 0)})")
        cd = page.evaluate('__dw.abilities.slots().map(s => +s.left.toFixed(2))')
        check(cd[2] > 0, f'{name}: the last ability is on cooldown after use ({cd})')
        # the six more on the bar (4 to 9): each with a target, each does what it says
        check(page.evaluate('__dw.abilities.slots().length') == 9, f'{name}: nine skills on the bar')
        for i in range(3, 9):
            page.evaluate(SPAWN); frames(2)
            page.evaluate('__dw.monsters.focus = __dw.monsters.list[0]; __dw.abilities.reset(); __dw.player.buffs = {}')
            n0 = page.evaluate('__dw.monsters.list.length'); hp0 = page.evaluate('__dw.monsters.list.map(m => m.hp)')
            got = page.evaluate(f'__dw.abilities.slots()[{i}].name')
            page.evaluate(f'__dw.input.abEdge[{i}] = true'); frames(4)
            st = page.evaluate('(() => { const ms = __dw.monsters.list; return { buffs: Object.keys(__dw.player.buffs), dots: ms.some(m => m.dots && m.dots.length), frz: ms.some(m => m.frz > 0), slow: ms.some(m => m.slow > 0), wrath: __dw.pet.wrath > 0, pet: __dw.pet.name }; })()')
            frames(60)
            hp1 = page.evaluate('__dw.monsters.list.map(m => m.hp)'); n1 = page.evaluate('__dw.monsters.list.length')
            did = st['buffs'] or st['dots'] or st['frz'] or st['slow'] or st['wrath'] or n1 < n0 or (hp1 and hp0 and min(hp1) < min(hp0)) or page.evaluate('!!__dw.pet.name')
            check(bool(did), f'{name} {i + 1} {got}: does something ({st}, {hp0} -> {hp1})')
            page.evaluate('__dw.abilities.reset()')
        if name == 'HUNTER':
            check(page.evaluate('!!__dw.pet.name'), f"the hunter's TAME made a pet of a slime ({page.evaluate('__dw.pet.name')})")
    b.close()
for e in errors: print('  page error:', e)
check(not errors, 'no page errors')
if fails: print('FAILED:', len(fails)); sys.exit(1)
print('all good')
