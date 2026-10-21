#!/usr/bin/env python3
"""Plays the game in headless Chromium (software WebGL: SwiftShader) in a PC-size window and checks it.

  python3 tests/play.py [--out shots] [--phone] [--quick]

Serves the repo, loads index.html (three.js comes from node_modules instead of the CDN: npm i),
picks a hero, walks, jumps, swims, visits every biome by day and the woods by night, and saves
screenshots. Fails on any page error, on a hero that can't move, or on chunks that never arrive.
"""
import argparse, functools, http.server, json, os, pathlib, sys, threading, time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument('--out', default=str(ROOT / 'shots'))
ap.add_argument('--phone', action='store_true', help='an iPhone-size touch screen instead of a 1152 x 648 PC window')
ap.add_argument('--page', default='index.html')
ap.add_argument('--quick', action='store_true')
ap.add_argument('--flat', action='store_true', help='a flat meadow with no trees or monsters of its own')
args = ap.parse_args()
out = pathlib.Path(args.out); out.mkdir(parents=True, exist_ok=True)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{srv.server_address[1]}/'

THREE = ROOT / 'node_modules/three'
def cdn(route):
    url = route.request.url
    rel = url.split('three@0.160.0/', 1)[1]
    f = THREE / rel
    if not f.exists():
        return route.fulfill(status=404, body='')
    route.fulfill(path=str(f), content_type='application/javascript')

errors, logs = [], []
fails = []
def check(ok, what):
    print(('  ok  ' if ok else '  FAIL') + ' ' + what)
    if not ok: fails.append(what)

with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])
    if not args.phone:
        ctx = b.new_context(viewport={'width': 1152, 'height': 648})
    else:
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
    page = ctx.new_page()
    # (software rendering is slow, a PC-size window slower still: be patient)
    page.set_default_timeout(240000)
    page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', cdn)
    page.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: (errors if m.type == 'error' else logs).append(m.text))
    q = 'q=1&t=0.42&fresh&debug' + ('&flat' if args.flat else '')
    page.goto(base + args.page + '?' + q)
    page.wait_for_function('window.__dw', timeout=60000)
    t0 = time.time()
    page.wait_for_function('__dw.world.readyAround(__dw.player.pos.x, __dw.player.pos.z, 64) >= 1', timeout=180000)
    load_s = time.time() - t0
    print(f'world around spawn built in {load_s:.1f}s (software rendering, test machine)')
    page.wait_for_timeout(800)
    page.screenshot(path=str(out / '01-title.png'))
    st = page.evaluate('__dw.stats()')
    print('stats at title', json.dumps({k: st[k] for k in ('ready', 'pending', 'workers', 'genMs', 'tris')}))
    check(st['workers'] >= 1, 'chunks are built by workers')

    page.evaluate('__dw.start(0)')
    page.wait_for_function("__dw.UI.state === 'play'", timeout=60000)
    page.wait_for_function('__dw.player.onGround', timeout=600000)
    check(True, 'the hero stands on the ground at the start')
    page.screenshot(path=str(out / '02-start.png'))

    # (the moving tests run on FAST graphics: software rendering is slow, and they wait for frames, not seconds)
    page.evaluate('__dw.setQuality(0)')
    page.evaluate('window.__fc = 0; (function f(){ __fc++; requestAnimationFrame(f); })()')
    def frames(n, timeout=900000):
        page.evaluate('window.__f0 = __fc')
        page.wait_for_function(f'__fc - __f0 >= {n}', timeout=timeout)
    # walk with the touch stick: try a few directions (a tree may stand in the way of one)
    best = 0
    for turn in range(3):
        p0 = page.evaluate('__dw.player.pos.toArray()')
        if args.phone: page.evaluate('__dw.input.stickY = -1')
        else: page.keyboard.down('w')
        frames(60)
        if args.phone: page.evaluate('__dw.input.stickY = 0')
        else: page.keyboard.up('w')
        frames(5)
        p1 = page.evaluate('__dw.player.pos.toArray()')
        moved = ((p1[0] - p0[0]) ** 2 + (p1[2] - p0[2]) ** 2) ** 0.5
        best = max(best, moved)
        if moved > 8: break
        page.evaluate('__dw.input.lookX += 1.6')
        frames(3)
    check(best > 8, f'{"the stick" if args.phone else "W"} walks the hero ({best:.1f} blocks in 60 frames)')
    page.screenshot(path=str(out / '03-walked.png'))
    # jump
    page.wait_for_function('__dw.player.onGround', timeout=30000)
    y0 = page.evaluate('__dw.player.pos.y')
    if args.phone: page.evaluate('__dw.input.jumpEdge = true; __dw.input.tJump = 1')
    else: page.keyboard.down('Space')
    page.evaluate('window.__top = 0; (function f(){ __top = Math.max(__top, __dw.player.pos.y); if (__fc - __f0 < 60) requestAnimationFrame(f); })()')
    frames(40)
    page.evaluate('__dw.input.tJump = 0')
    if not args.phone: page.keyboard.up('Space')
    top = page.evaluate('__top')
    check(2 < top - y0 < 9, f'the jump button jumps ({top - y0:.2f} blocks high)')
    page.wait_for_function('__dw.player.onGround', timeout=30000)
    check(True, 'the hero lands again')
    # a swipe turns the camera
    yaw0 = page.evaluate('__dw.player.yaw')
    page.evaluate('__dw.input.lookX += 0.8')
    frames(2)
    yaw1 = page.evaluate('__dw.player.yaw')
    check(abs(yaw1 - yaw0) > 0.5, 'a swipe turns the camera')
    if not args.phone:
        # the scroll wheel zooms; a click in the world captures the mouse (where the headless browser allows it)
        d0 = page.evaluate('__dw.player.camDist')
        page.mouse.move(576, 324); page.mouse.wheel(0, 300); frames(3)
        d1 = page.evaluate('__dw.player.camDist')
        check(d1 > d0, f'the scroll wheel pulls the camera back ({d0:.1f} -> {d1:.1f})')
        page.mouse.wheel(0, -300); frames(3)
        page.mouse.click(576, 324); frames(5)
        print('  info pointer lock in headless Chromium:', page.evaluate('!!document.pointerLockElement'))
        page.evaluate('document.pointerLockElement && document.exitPointerLock()'); frames(5)
        if page.evaluate('__dw.UI.state') == 'menu': page.evaluate("document.getElementById('resume').click()")
    page.evaluate('__dw.setQuality(1)')

    # ---- the mage's combat: bolts, a blink, a bite
    page.evaluate("document.getElementById('menuBtn').click()"); frames(2)
    page.evaluate("[...document.querySelectorAll('#segHero button')][1].click()"); frames(2)
    page.evaluate("document.getElementById('resume').click()"); frames(2)
    page.evaluate('__dw.setQuality(0)')
    check(page.evaluate('__dw.player.cls') == 1, 'the menu switches the hero to the mage')
    page.wait_for_function('__dw.player.onGround', timeout=600000)
    # a slime 8 blocks ahead, where the camera looks
    # (a tree may stand in the way: turn and try again)
    spawn_js = """(() => { const p = __dw.player, w = __dw.world; const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      __dw.monsters.list.slice().forEach(m => __dw.monsters.remove(m));
      for (let d = 14; d >= 8; d--) { const x = p.pos.x + fx * d, z = p.pos.z + fz * d; const g = w.groundY(x, z); if (g >= 0 && !w.water(x, g + 1, z) && Math.abs(g + 1 - p.pos.y) < 5) { __dw.monsters.spawn(1, x, g + 1, z); return; } }
      __dw.monsters.spawn(1, p.pos.x + fx * 10, p.pos.y, p.pos.z + fz * 10); })()"""
    hit = False
    for turn in range(4):
        page.evaluate(spawn_js); frames(2)
        hp0 = page.evaluate('__dw.monsters.list[0].hp')
        for i in range(5):
            page.evaluate('__dw.input.atkEdge = true'); frames(14)
            if page.evaluate('__dw.monsters.list.length === 0 || __dw.monsters.list[0].hp < ' + str(hp0)): hit = True; break
        if hit: break
        page.evaluate('__dw.player.yaw += Math.PI / 2'); frames(3)
    check(hit, f'the mage\'s bolts hit a slime ahead (hp {hp0} -> {page.evaluate("__dw.monsters.list.length ? __dw.monsters.list[0].hp : \"dead\"")})')
    for i in range(10):
        if page.evaluate('__dw.hero.kills') > 0: break
        page.evaluate('__dw.input.atkEdge = true'); frames(14)
    check(page.evaluate('__dw.hero.kills') > 0, 'the slime dies and counts as a kill')
    check(page.evaluate('__dw.hero.xp') > 0, 'killing it gives XP')
    page.screenshot(path=str(out / '05-mage.png'))
    # the blink
    moved = 0
    for turn in range(4):
        p0 = page.evaluate('__dw.player.pos.toArray()')
        page.evaluate('__dw.input.abEdge[0] = true'); frames(4)
        p1 = page.evaluate('__dw.player.pos.toArray()')
        moved = ((p1[0] - p0[0]) ** 2 + (p1[2] - p0[2]) ** 2) ** 0.5
        if moved > 1.5: break
        page.evaluate('__dw.player.yaw += Math.PI / 2; __dw.player.vel.set(0, 0, 0)'); frames(140)
    check(moved > 3, f'the blink leaps ahead ({moved:.1f} blocks)')
    # a bite: a slime right next to the hero
    page.evaluate('__dw.monsters.spawn(1, __dw.player.pos.x + 2.4, __dw.player.pos.y, __dw.player.pos.z)')
    page.wait_for_function('__dw.hero.hp < __dw.hero.maxHp', timeout=600000)
    check(True, f'a slime bites the hero (hp {page.evaluate("__dw.hero.hp")}/{page.evaluate("__dw.hero.maxHp")})')
    page.evaluate('__dw.monsters.list.slice().forEach(m => __dw.monsters.remove(m))')
    page.evaluate("document.getElementById('menuBtn').click()"); frames(2)
    page.evaluate("[...document.querySelectorAll('#segHero button')][0].click()"); frames(2)
    page.evaluate("document.getElementById('resume').click()"); frames(2)
    page.evaluate('__dw.setQuality(1)')

    # every biome: the middle of its region
    sites = page.evaluate('''(() => { const g = __dw.world.gen, out = []; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const [x, z] = g.site(i, j); out.push([g.biomeOfCell(i, j), Math.round(x), Math.round(z)]); } return out; })()''')
    names = ['forest', 'snow', 'desert', 'swamp', 'lava', 'crystal']
    seen = set()
    for bio, x, z in sites:
        if bio in seen or (args.quick and bio not in (0, 4)): continue
        seen.add(bio)
        page.evaluate(f'__dw.teleport({x}, {z}); __dw.sky.t = 0.4')
        t1 = time.time()
        page.wait_for_function('__dw.world.readyAround(__dw.player.pos.x, __dw.player.pos.z, 48) >= 1', timeout=180000)
        page.wait_for_function('__dw.player.onGround || __dw.player.inWater', timeout=30000)
        page.wait_for_timeout(1200)
        b2 = page.evaluate('__dw.stats().biome')
        check(b2 == bio, f'{names[bio]}: arrived in {names[b2] if b2 >= 0 else b2} ({time.time() - t1:.1f}s to build)')
        page.evaluate('__dw.player.pitch = 0.42')
        page.wait_for_timeout(500)
        page.screenshot(path=str(out / f'10-{names[bio]}.png'))
    check(len(seen) == 6 or args.quick, 'all six biomes sit next to the starting woods')

    # night in the lava fields and the crystal lands, and the woods
    for bio in (4, 5, 0):
        x, z = next((x, z) for bb, x, z in sites if bb == bio)
        page.evaluate(f'__dw.teleport({x}, {z}); __dw.sky.t = 0.02')
        page.wait_for_function('__dw.world.readyAround(__dw.player.pos.x, __dw.player.pos.z, 48) >= 1', timeout=180000)
        page.wait_for_timeout(1500)
        page.screenshot(path=str(out / f'20-night-{names[bio]}.png'))
        if args.quick: break
    page.evaluate('__dw.sky.t = 0.27')
    page.wait_for_timeout(600)
    page.screenshot(path=str(out / '21-dawn.png'))

    # swimming: find water near the start and drop in
    w = page.evaluate('''(() => { const g = __dw.world.gen; const [sx, sz] = g.site(0, 0); for (let r = 0; r < 260; r += 4) for (let a = 0; a < 24; a++) { const x = Math.round(sx + Math.cos(a / 24 * 6.283) * r), z = Math.round(sz + Math.sin(a / 24 * 6.283) * r); const c = g.column(x, z); if (c.h < 40 && c.biome === 0) { let open = true; for (let dz = -10; dz <= 10 && open; dz += 5) for (let dx = -10; dx <= 10; dx += 5) if (g.column(x + dx, z + dz).h > 42) { open = false; break; } if (open) return [x, z]; } } return null; })()''')
    if w:
        page.evaluate(f'__dw.sky.t = 0.45; __dw.player.place({w[0]} + 0.5, 60, {w[1]} + 0.5)')
        page.wait_for_function('__dw.world.readyAround(__dw.player.pos.x, __dw.player.pos.z, 32) >= 1', timeout=120000)
        page.wait_for_function('__dw.player.inWater || __dw.player.onGround', timeout=600000)
        frames(3)
        st = page.evaluate('({ y: __dw.player.pos.y, w: __dw.player.inWater })')
        check(st['w'], f'the hero swims in a lake (y {st["y"]:.1f})')
        page.screenshot(path=str(out / '30-swim.png'))

    # the menu
    page.evaluate("document.getElementById('menuBtn').click()")
    page.wait_for_timeout(300)
    page.screenshot(path=str(out / '40-menu.png'))
    check(page.evaluate("__dw.UI.state") == 'menu', 'the menu opens')
    page.evaluate("document.getElementById('resume').click()")

    # cost per frame (JavaScript only: the GPU here is software)
    page.wait_for_timeout(2500)
    st = page.evaluate('__dw.stats()')
    print('stats', json.dumps({k: st[k] for k in ('ready', 'pending', 'tris', 'calls', 'frameMs', 'worstMs', 'fps', 'genMs', 'meshMs', 'quality', 'monsters')}))
    check(st['pending'] < 40, 'chunks keep arriving')
    print('monsters roaming now:', st['monsters'])
    b.close()

errors = [e for e in errors if 'fonts.g' not in e]
for e in errors: print('  page error:', e)
check(not errors, 'no page errors')
print('screenshots in', out)
if fails:
    print('FAILED:', len(fails)); sys.exit(1)
print('all good')
