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
KINDS = [
  (3, 'skeleton', 10, 'wind'),
  (1, 'slime', 10, 'hop'),
  (2, 'bat', 12, 'dive'),
  (4, 'spider', 9, 'leap'),
  (5, 'ghost', 14, 'phase'),
  (7, 'imp', 14, 'shot'),
  (10, 'fire sprite', 12, 'shot'),
  (12, 'wisp', 16, 'shot'),
  (13, 'hell crab', 12, 'rush'),
  (11, 'vampire bat', 12, 'dive'),
]
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
    page.evaluate('__dw.start(0)')
    page.wait_for_function("__dw.UI.state === 'play'")
    page.evaluate('__dw.setQuality(0); window.__fc = 0; (function f(){ __fc++; requestAnimationFrame(f); })()')
    page.wait_for_function('__dw.player.onGround')
    def frames(n):
        for _ in range(n):
            page.evaluate('window.__f0 = __fc'); page.wait_for_function('__fc - __f0 >= 1'); page.evaluate(WATCH)
    for type, name, dist, way in KINDS:
        page.evaluate(SPAWN, [type, dist]); frames(2)
        hp0 = page.evaluate('__dw.hero.hp')
        # up to ~8 seconds of frames (the test's frames are slow; the game clamps dt)
        hurt = False
        for _ in range(16):
            frames(10)
            if page.evaluate('__dw.hero.hp') < hp0: hurt = True; break
        seen = page.evaluate('window.__seen')
        check(hurt, f"{name}: hurts the hero ({hp0} -> {page.evaluate('__dw.hero.hp')})")
        check(seen.get(way), f"{name}: fights its way ({way}; seen {sorted(seen)})")
        page.evaluate('__dw.player.pos.copy(__dw.player.pos)')
    # a health bar once it is hit, and the hero heals when the fight is over
    page.evaluate(SPAWN, [3, 30])
    page.evaluate("(() => { const m = __dw.monsters.list[0]; m.state = 'wander'; m.k = { ...m.k, see: 0 }; __dw.monsters.hit(m, 1, false, new __dw.THREE.Vector3(1, 0, 0)); })()"); frames(2)
    check(page.evaluate('(() => { const m = __dw.monsters.list[0]; return !!(m.bar && m.bar.visible && m.bar.userData.fill.scale.x < 3.5); })()'), 'a hit monster shows a health bar, part gone')
    page.evaluate('__dw.hero.hp = 10; __dw.monsters.calm = 100')
    frames(20)
    check(page.evaluate('__dw.hero.hp') > 10, f"the hero heals when left alone (10 -> {page.evaluate('__dw.hero.hp')})")
    # loot: a slain monster leaves a body; one with a drop opens the panel with a turning picture and the numbers
    page.evaluate(SPAWN, [1, 6])
    page.evaluate("(async () => { const m = __dw.monsters.list[0]; m.state = 'wander'; m.k = { ...m.k, see: 0 }; const K = await import('./src/weaponkit.js'); window.__spec = K.randomSpec(); __dw.monsters.hit(m, 9999, false, new __dw.THREE.Vector3(1, 0, 0)); })()"); frames(2)
    check(page.evaluate('__dw.bodies.list.length') >= 1, 'a slain monster leaves a body')
    page.evaluate("(async () => { const I = await import('./src/inventory.js'); const b = __dw.bodies.list[0]; const w = window.__spec; w.rarity = 'epic'; w.name = 'TEST BLADE'; w.ilvl = 3; b.loot = { weapon: w, items: [I.rollArmor(3), I.rollPotion(3)], gold: 7 }; __dw.openLoot(b); })()"); frames(3)
    check(page.evaluate("!document.getElementById('lootBox').hidden"), 'the loot window opens')
    page.hover('#lootList button'); frames(2)
    check(page.evaluate("!document.getElementById('lootTip').hidden && document.getElementById('lootTip').textContent.includes('TEST BLADE') && document.getElementById('lootTip').textContent.includes('EPIC') && document.getElementById('lootTip').textContent.includes('DPS')"), 'hovering a square shows its name, rarity and numbers')
    page.screenshot(path='/tmp/claude-0/-home-claude/f81b322e-a194-5631-a1cc-c393b7fe31c4/scratchpad/lootui.png')
    check(page.evaluate("document.querySelectorAll('#lootList button').length") == 4, 'the loot list shows the weapon, the armor, the potion and the gold')
    page.evaluate("document.getElementById('lootAll').click()"); frames(2)
    check(page.evaluate("__dw.UI.state === 'play' && __dw.forge.saved.some(w => w.name === 'TEST BLADE')"), 'TAKE ALL puts the weapon among the saved ones and closes the window')
    check(page.evaluate("(async () => { const I = await import('./src/inventory.js'); return I.inv.items.some(i => i.kind === 'armor') && I.inv.items.some(i => i.kind === 'potion') && I.inv.gold >= 7; })()"), 'and the armor, the potion and the gold into the bags')
    # the character sheet and the bags
    page.evaluate("__dw.openSheet('char')"); frames(3)
    check(page.evaluate("__dw.UI.state === 'char' && !document.getElementById('char').hidden && document.querySelectorAll('#csSlots .cslot').length === 8 && document.getElementById('csGl').width > 0"), 'C opens the character sheet: eight gear slots and the hero on the stand')
    page.evaluate("document.getElementById('tabBags').click()"); frames(2)
    n = page.evaluate("document.querySelectorAll('#bagGrid .bslot:not(.empty)').length")
    check(n >= page.evaluate('__dw.forge.saved.length') and n >= 3, f'the bags show the saved weapons and the items ({n})')
    page.evaluate("document.querySelector('#bagGrid .bslot:not(.empty)').click()"); frames(3)
    check(page.evaluate("!document.getElementById('bagDetail').hidden && document.getElementById('bagName').textContent.length > 0 && document.getElementById('bagGl').width > 0"), 'a bag slot shows its weapon, turning, with its numbers')
    page.evaluate("document.getElementById('bagWield').hidden || document.getElementById('bagWield').click()"); frames(2)
    check(page.evaluate("__dw.forge.equipped.some(i => i >= 0)"), 'WIELD from the bags equips it')
    page.evaluate("(() => { const el = [...document.querySelectorAll('#bagGrid .bslot:not(.empty)')].find(e => (e.title || '').match(/HELM|HOOD|CROWN|CAP|PAULDRONS|MANTLE|SPAULDERS|BREASTPLATE|TUNIC|HAUBERK|ROBE|GAUNTLETS|GLOVES|GRIPS|GREAVES|LEGGINGS|KILT|BOOTS|SABATONS|TREADS/)); el && el.click(); })()"); frames(2)
    hp0 = page.evaluate('__dw.hero.maxHp')
    page.evaluate("document.getElementById('bagUse').click()"); frames(2)
    check(page.evaluate("(async () => { const I = await import('./src/inventory.js'); return Object.keys(I.inv.equipped).length >= 1; })()"), 'EQUIP from the bags puts the armor on')
    page.evaluate("__dw.sheet.close()"); frames(2)
    check(page.evaluate("__dw.UI.state === 'play'"), 'and closing returns to play')
    b.close()
check(not errors, 'no page errors' + (': ' + '; '.join(errors[:3]) if errors else ''))
print('ALL OK' if not fails else f'{len(fails)} FAILED')
sys.exit(1 if fails else 0)
