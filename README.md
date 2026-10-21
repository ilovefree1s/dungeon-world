# Dungeon World

An open world of blocks for the browser, built on the look and the heroes of
[Dungeon Heart](https://github.com/ilovefree1s/Dungeon-heart). Walk out of the dungeon and
into endless land: woods, frozen peaks, dunes, bog, ash fields and crystal cliffs.

**Play:** https://ilovefree1s.github.io/dungeon-world/

## Stage 1 (this one): the world
- Endless land in chunks of 32 x 32 blocks, 96 high, built in a background worker so the
  frame never waits for them, and dropped again far behind you.
- Six biomes in regions about 300 blocks across. You start in the middle of the woods and
  every other biome borders it:
  | Biome | Land | Trees and things |
  |---|---|---|
  | Whisperwood | rolling hills, stepped cliffs, lakes, beaches | oaks, birches, mossy boulders, flowers |
  | Frostpeak Reach | ridged mountains, frozen lakes | snowy pines, rocks |
  | Sunscorch Dunes | dunes, banded mesas with sheer sides, oases | cactus, dead bushes |
  | Mirehollow Bog | low land half under water | willows with hanging strands, reeds, glowing mushrooms |
  | Cinderwaste | jagged ash, lava pools, glowing veins | burnt trees, obsidian spires, embers |
  | Prism Highlands | terraced cliffs, lakes | glowing crystal spires, pale pink trees |
- Your Dungeon Heart hero (warrior, mage or hunter, made by Dungeon Heart's own `models.js`)
  walks, runs, jumps about three blocks, steps up single blocks, swims, and gets thrown out
  of lava. A third-person camera follows, slips through leaves and pulls in before hills.
- Day and night: a ten-minute day, a square sun and moon, stars, drifting block clouds;
  glowing crystal, magma and mushrooms light up the dark.
- A compass with a marker for the tower at the world's middle (a later stage), the biome's
  name as you enter it, a menu for hero, graphics, music and sounds. Your place is saved.

## Controls
| | Keyboard and mouse | Controller | Phone |
|---|---|---|---|
| Move | WASD | left stick / d-pad | the stick |
| Look | drag the mouse, Q / E, ← → | right stick | swipe the screen |
| Jump | Space | A / ✕ | JUMP |
| Run | Shift (the stick pushed all the way runs too) | B / ○ | push the stick to its edge |
| Menu | Esc, P | Start | the ☰ button |

## Next stages
3D combat and roaming monsters; gear, talents and pets; villages and merchants; dungeon
entrances into Dungeon Heart-style floors; the Tower King's tower at the center; gliding,
boats and mounts.

## How it works
- `src/gen.js`: the world's rules with no drawing: noise, biome regions, heights, trees, and
  a chunk's blocks and meshes (faces only where they show, with ambient occlusion).
  `src/genworker.js` runs it in workers.
- `src/world.js`: which chunks to load (nearest first, ahead of the camera before behind),
  their meshes (three draw calls each: blocks, glowing blocks, water), and block lookups.
- `src/player.js`: the hero's movement and collisions, the camera. `src/sky.js`: day and night.
- `src/engine.js`: the renderer in Dungeon Heart's style (ACES, soft shadows, bloom) and the
  helpers its models use. `src/dh/` holds Dungeon Heart's model files, copied unchanged.
- `src/input.js`: keyboard, mouse, touch and controllers. `src/audio.js` and
  `music/dungeon_echoes.mp3` come from Dungeon Heart.
- Graphics: Fast / Good / Best (pixel ratio, shadows, bloom, how far you see). Phones start
  on Good and step down by themselves if the frame rate stays under 40, until you pick one.
- `src/head.html` is the page; `python3 build.py` writes `index.html` from it (three.js 0.160
  from jsDelivr, as in Dungeon Heart). `node tools/artifact.mjs` builds `dist/play.html`, the
  whole game in one page, for the claude.ai artifact.
- Tests: `npm i`, then `python3 tests/play.py` plays it in headless Chromium at phone size:
  walks, jumps, turns, swims, visits every biome by day and night, opens the menu, and saves
  screenshots to `shots/`. `?debug` shows frame time, chunks and triangles; `?seed=N` picks
  another world, `?fresh` ignores the save.
