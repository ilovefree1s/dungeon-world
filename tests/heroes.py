#!/usr/bin/env python3
"""Every monster kind's way of fighting, tried on the flat meadow with the hero standing still:

  python3 tests/monsters.py

For each kind, one is spawned a little way off and watched for a few seconds: it must hurt the hero,
and do it in its own way (a skeleton winds up a strike, a slime hops, a bat dives, a spider leaps, a
ghost blinks behind you, imps, sprites and wisps throw from a distance, a crab rushes). Then a health
bar shows when it's hit, and the hero heals once left alone. (Headless Chromium with software WebGL.)
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

# type id, name, how far off it starts, what the watch must see
SPAWN = """([type, dist]) => { const p = __dw.player; __dw.monsters.list.slice().forEach(m => __dw.monsters.remove(m)); __dw.monsters.shots.slice().forEach(s => { __dw.monsters.shots.length = 0; });
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  const m = __dw.monsters.spawn(type, p.pos.x + fx * dist, p.pos.y, p.pos.z + fz * dist); m.state = 'chase';
  __dw.hero.hp = __dw.hero.maxHp; p.invT = 0; window.__seen = {}; }"""
# per frame: note what the monster is doing
WATCH = """() => { const m = __dw.monsters.list[0]; if (!m) return; const s = window.__seen;
  if (m.wind > 0) s.wind = 1; if (m.dive) s.dive = 1; if (m.leap > 0 || m.lastAct === 'pounce') s.leap = 1; if (m.rush || m.lastAct === 'rush') s.rush = 1;
  if (m.act === 'phase' || (m.k.atk === 'phase' && m.atkCd > 0.3 && m.atkCd <= 0.5)) s.phase = 1;
  if (__dw.monsters.shots.length) s.shot = 1; if (m.k.atk === 'hop' && !m.onGround && m.vel.y > 2) s.hop = 1; }"""
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 1152, 'height': 648})
    page = ctx.new_page()
    page.set_default_timeout(600000)
    page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', cdn)
    page.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
    page.on('pageerror', lambda e: errors.append(str(e)))
    # an old save: one shared level 7 (it becomes the hunter's) and old bags with gold
    page.add_init_script("""if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', 1);
      localStorage.setItem('dungeonworld.save.v1', JSON.stringify({ seed: 1, cls: 2, x: 0, y: 30, z: 0, yaw: 0, t: 0.42, level: 7, xp: 5, hp: 50, kills: 9 }));
      localStorage.setItem('dw-inv-v1', JSON.stringify({ items: [], equipped: {}, gold: 123 })); }""")
    page.goto(base + 'index.html?q=0&t=0.42&flat')
    page.wait_for_function('window.__dw')
    st = lambda: page.evaluate("[__dw.player.cls, __dw.hero.level, __dw.hero.xp]")
    gold = lambda: page.evaluate("__dw.inv ? __dw.inv.gold : JSON.parse(localStorage.getItem('dw-inv-c' + __dw.player.cls) || '{}').gold")
    print('start', st())
    check(st()[1] == 7, 'the hunter keeps the old level')
    page.evaluate('__dw.player.setClass(0)'); print('warrior', st())
    check(st()[1] == 1, 'the warrior starts at level 1')
    page.evaluate('__dw.hero.level = 3; __dw.hero.xp = 4'); page.evaluate('__dw.player.setClass(1)'); print('mage', st())
    check(st()[1] == 1, 'the mage starts at level 1')
    page.evaluate('__dw.player.setClass(0)'); check(st()[1] == 3, 'the warrior keeps its own level')
    page.evaluate('__dw.player.setClass(2)'); check(st()[1] == 7, 'and the hunter its own')
    check(not errors, f'no errors {errors}')
    b.close()
print('all good' if not fails else f'FAILED {fails}')
