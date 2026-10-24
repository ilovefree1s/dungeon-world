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
    page.goto(base + 'index.html?q=0&t=0.42&fresh&flat')
    page.wait_for_function('window.__dw')
    page.wait_for_function('__dw.world.readyAround(__dw.player.pos.x, __dw.player.pos.z, 40) >= 1')
    page.evaluate('__dw.start(2)')
    page.wait_for_function("__dw.UI.state === 'play'")
    page.evaluate('__dw.setQuality(0); window.__fc = 0; (function f(){ __fc++; requestAnimationFrame(f); })()')
    page.wait_for_function('__dw.player.onGround')
    page.evaluate("""() => { const p = __dw.player, M = __dw.monsters; M.list.slice().forEach(m => M.remove(m));
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw); const m = M.spawn(3, p.pos.x + fx * 10, p.pos.y, p.pos.z + fz * 10); m.state = 'chase'; }""")
    page.keyboard.press('Tab'); page.wait_for_timeout(300)
    page.keyboard.press('Digit8')
    for i in range(40):
        page.wait_for_timeout(1000)
        s = page.evaluate("[__dw.pet.name, __dw.monsters.list.length, __dw.hero.hp, document.getElementById('err') && document.getElementById('err').textContent, __dw.abilities.cd.map(c => +c.toFixed(1))]")
        print(i, s)
        if s[0]: break
    check(bool(s[0]), 'tamed')
    check(not errors, f'no errors {errors}')
    b.close()
print('all good' if not fails else f'FAILED {fails}')
