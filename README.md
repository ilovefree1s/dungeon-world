# Dungeon World

An open world of blocks for the browser, built on the look and the heroes of
[Dungeon Heart](https://github.com/ilovefree1s/Dungeon-heart). Walk out of the dungeon and
into endless land: woods, frozen peaks, dunes, bog, ash fields and crystal cliffs.

**Play:** https://ilovefree1s.github.io/dungeon-world/

Made for a PC first (keyboard and mouse, or a controller); phones work too.

## Stage 2 (in progress): fighting
- **Nine skills a hero**, on a bar of nine at the bottom (keys 1 to 9), after Dungeon Heart's talents and the MMO
  classes. The first three are below; the six more:
  | | 4 | 5 | 6 | 7 | 8 | 9 |
  |---|---|---|---|---|---|---|
  | Warrior | **Heroic**: the next swing hits more than twice as hard | **Rend**: a bleed on the target | **Throw**: an axe at a far target | **Block**: shield up, blows land at a third | **Shout**: a quarter more damage for 12 s | **2nd Wind**: heal over 8 s |
  | Mage | **Fireball**: a big, slow bolt | **Missiles**: five quick arcane bolts | **Ice Lance**: quick, near triple on the frozen | **Chain**: lightning leaping to four foes | **Polymorph**: the target stands harmless for 8 s | **Barrier**: ice soaks blows |
  | Hunter | **Aimed**: a slow, triple shot | **Sting**: poison over 8 s | **Concuss**: a dazed, slowed target | **Rapid Fire**: shots 60% quicker for 10 s | **Tame**: a wild slime, bat or spider becomes your pet | **Wrath**: your pet bites twice as hard |
  Single-target skills go at your target (or the nearest monster in front).
- **The hunter's pet** (Dungeon Heart's cute ones, in a red bandana, with a name): it trots at your heel, joins your
  fights (biting your target, or whatever's after you), comes back when you stand up from a fall, and stays with you
  between visits. Taming another lets the old one go.
- Every hero has a basic attack and three abilities, after Dungeon Heart's talents:
  | | Attack | 1 | 2 | 3 |
  |---|---|---|---|---|
  | Warrior | a sword swing in an arc ahead | **Charge**: a dash that runs down and stuns everything in its path | **Whirlwind**: two spinning cuts all around | **Ground Slam**: a leap and a shockwave that stuns |
  | Mage | a bolt where the camera looks | **Blink**: a leap ahead through the air | **Frost Nova**: freezes all around you (frozen monsters take half again as much) | **Meteor**: a fireball crashes where you aim |
  | Hunter | an arrow, fast and straight | **Roll**: a dodge, untouchable while it lasts | **Multishot**: a fan of five arrows | **Arrow Rain**: a volley falls on where you aim |
  Attacks and abilities aim where the camera looks; a monster near the crosshair draws them in.
  The ability bar at the bottom shows each one's cooldown.
- **The Forge** (on the title screen and in the menu): build a weapon from parts, and the hero it's for wields it.
  Ten types: sword, greatsword, dagger, axe, hammer and mace for the warrior; staff and wand
  for the mage; bow and crossbow for the hunter. Four heads each, ten materials (three of them
  glow), guards, grips, pommels, gem and grip colors, length (the blade or head alone), width,
  and sizes for the grip, the guard and the pommel, each its own. Each build has its
  numbers: every weapon has a time between swings or shots, 1.0 s for a dagger up to 3.5 s for the
  heaviest two-handers (length, width and a fat drawn blade slow it, rarity quickens it), and a hit's
  damage grows with that time, so a hammer lands hard and seldom and a dagger nicks fast; longer
  reaches farther; a wand casts fast and light, a crossbow shoots hard
  and slow; a staff's gem colors the mage's bolts. Name it (or roll one), save up to sixteen,
  wield one per hero; they stay in hand across reloads.
  **Draw the shape yourself** (DRAW IT: DRAG CORNERS or FREEHAND, on blades, on axe, hammer
  and mace heads, and on a staff's or wand's head, where the drawing stands in metal round the
  gem; the pad appears under the preview): drag the corners of the outline (click an edge to add one, double-click to remove), or
  trace the silhouette freehand and it's cleaned into an outline; MIRROR shapes one half and
  reflects it, or off, the whole outline. The drawing's area and length count: a fat blade hits
  harder and swings slower, a short one reaches less. Hafts and shafts (axes, hammers, maces,
  staffs, wands) have their own material, wood or any metal.
  An **aura** rides the blade, the staff's head or the bow's limbs: flame, lightning, water,
  wind, frost, shadow or holy (one cloud of particles per weapon, a single draw call), only on
  the part that does the work (a hammer's head, a mace's ball, a staff's crown), with a power
  slider for how thick it burns; it colors the mage's bolts.
- Monsters from Dungeon Heart roam each land and come for you when they see you: slimes, bats
  and spiders in the woods; skeletons and ghosts in the snow; hell crabs in the dunes; ghosts and
  vampire bats in the bog; imps and fire sprites in the ash; wisps in the crystal lands.
  Each kind fights its own way, and every attack is telegraphed (an orange glow and a shiver
  before it lands, so there's time to step away; a critical hit breaks the wind-up):
  | | |
  |---|---|
  | Skeleton | walks up and winds up a strike; step back and it misses |
  | Slime | bounces at you in hops; bites when it lands on you |
  | Bat, vampire bat | circles overhead, then dives through you and climbs back |
  | Spider | hangs back out of reach, crouches, and leaps the gap |
  | Ghost | vanishes and reappears right behind you |
  | Imp, fire sprite, wisp | keep their distance and throw fire, flame and light that you can dodge; they back off if you close in |
  | Hell crab | shakes, then rushes in a straight line, hitting hard; dazed for a moment after |
- **Every monster is near your level** (one under to one over), wherever you go: the lands are all mixed up, so the
  danger and the loot go with you. Everything a monster drops is at its level (the item level): a higher item level
  hits harder or guards better. Their health is matched to a hero of their level: about four or five plain swings for an average one, fewer with a better weapon.
- **Loot besides weapons**: gold nearly always, and now and then **armor** for the six gear slots (head, shoulders,
  chest, hands, legs, feet; cloth, leather, mail or plate; armor turns part of each blow aside, stamina adds two
  health a point) and **healing potions** (drink them from the bags). The loot window lists everything a body
  carried: pick one to see it against what you have, take it, wear or wield it, or TAKE ALL.
- **Loot**: a fallen monster's body stays on the ground a while, and some of them carry a weapon
  (a glint marks one): rolled at random from the Forge's parts, likelier the tougher the monster
  and the higher your level, more often one your hero can use. Every drop has a rarity, common
  to legendary (white, green, blue, purple, gold; the odds shift up with your level), and the
  rarer it is the harder it hits, the quicker it swings, the farther it reaches, and the better
  it's made (glowing metals, an aura). Look at the body and click (or press F): a panel shows the
  weapon turning, its rarity and name, and each of its numbers against what you wield now (up in
  green, down in red); take it into the Forge's saved weapons, wield it on the spot, or leave it. (While a monster is hunting you nearby, a
  click is a swing, not a look.)
- Health, damage numbers, XP and levels (each level: more health, harder bolts). A health bar
  shows over a monster you've hurt; left alone for a few seconds, you heal. Falling in a fight
  puts you back at the start of the woods, nothing lost.

## Stage 1: the world
- A low-poly toy-diorama land: a faceted heightfield with vertex colors (grass, dirt paths, sand
  by the water, rock on the steep faces, snow, ash, prism moss), giant low-poly trees (eight times
  a hero's scale, trunks like towers, crowns far overhead, spaced out), rocks and bushes
  (icosahedron crowns, chunky trunks, angular rocks, a different kit per biome), and thousands of
  instanced grass blades that sway in the wind and bend away from whoever walks through. Broad
  plains with the hills and cliffs between them. Built in chunks of 32 x 32 in a background
  worker so the frame never waits, and dropped again far behind you. (The block land is still in
  the code behind `?blocks`, for digging underground later.)
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
- Day and night: a ten-minute day, a square sun and moon, stars, drifting puffy clouds;
  glowing crystal, magma and mushrooms light up the dark.
- A compass with a marker for the tower at the world's middle (a later stage), the biome's
  name as you enter it, a menu for hero, graphics, music and sounds. Your place is saved.

- **Character sheet and bags** (C and B, or the two buttons by the menu's): the sheet shows your
  hero turning on a stand with what's in hand, the gear slots (gear itself is a later stage; the
  hands hold what the Forge gave), and the numbers: health, experience, kills, DPS (what the
  auto-attack does a second), the hit, the time between swings, the aura. The bags are sixteen
  slots holding the weapons you've forged or found, each bordered in its rarity; click one for its
  picture and numbers against what you wield, then wield it, take it to the Forge, or drop it.

## Controls
| | Keyboard and mouse | Controller | Phone |
|---|---|---|---|
| Move | WASD | left stick / d-pad | the stick |
| Look | drag with the mouse (left-drag orbits the camera, right-drag turns you with it, both buttons held walk you forward), Q / E, ← → | right stick | swipe the screen |
| Zoom | the scroll wheel | | |
| Target | left click a monster (your attacks aim at it until it falls; a click on the ground lets it go) | | |
| Attack | right click a monster: auto-attack on the weapon's swing timer until it falls (right click again stops); right click elsewhere or J swings where you look | X / ▢ | ATTACK |
| Look at loot | left click a fallen monster, or F near one | X / ▢ | ATTACK |
| Skills 1 to 9 | 1 to 9 (or K, Q, E for the first three; right click too with the captured mouse) | B / ○, Y / △, LB (the first three) | the skill bar |
| Target nearest enemy | Tab (again: cycles the enemies in range) | | the next one in range |
| Jump | Space | A / ✕ | JUMP |
| Run | Shift (the stick pushed all the way runs too) | RB, LT or a stick's click | push the stick to its edge |
| Menu | Esc, P | Start | the ☰ button |
| Character sheet, bags | C, B | | the buttons by the ☰ |

Mouse speed (slow, normal, fast) is in the menu, and so is the mouse's way of working: **Cursor** (the
above, the default on a PC) or **Captured** (click the world to capture the mouse and every movement
looks around, left click attacks, Esc lets go).

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
- `src/abilities.js`: the three heroes' kits (attacks, abilities, cooldowns, aiming).
  `src/heroanim.js`: their attack animations, keyframed poses of the whole body (wind-up, strike,
  recovery) laid over Dungeon Heart's walk: a four-swing cycle (slash, backhand, overhead chop, thrust), the whirl, the slam and its
  landing crouch; the staff thrust, the nova fling, the meteor raised to the sky; the archer's
  side-on draw and release, the multishot sweep, the rain aimed upward. The bolt and the arrow
  leave on the strike frame.
- `src/weaponkit.js`: weapons from parts (the model, the name, the numbers); `src/forge.js`:
  the forge screen, with its own small renderer for the turning preview.
- `src/combat.js`: the monsters (where they live, how they wander, chase and bite), the
  hero's bolts and aim, health, XP and levels. `src/loot.js`: the fallen's bodies and what they drop; `src/inventory.js`: armor, potions, gold; `src/pet.js`: the hunter's pet; `src/charsheet.js`: the character sheet and the bags;
  `src/turntable.js`: the turning pictures (a weapon, the hero). `src/fx.js`: sparks, rings and damage numbers.
- `src/engine.js`: the renderer in Dungeon Heart's style (ACES, soft shadows, bloom) and the
  helpers its models use. `src/dh/` holds Dungeon Heart's model files, copied unchanged.
- `src/input.js`: keyboard, mouse, touch and controllers. `src/audio.js` and
  `music/dungeon_echoes.mp3` come from Dungeon Heart.
- Graphics: Fast / Good / Best (pixel ratio, shadows, bloom, how far you see). A PC starts on
  Best, a phone on Good; either steps down by itself if the frame rate stays under 40, until you
  pick one.
- `src/head.html` is the page; `python3 build.py` writes `index.html` from it (three.js 0.160
  from jsDelivr, as in Dungeon Heart). `node tools/artifact.mjs` builds `dist/play.html`, the
  whole game in one page, for the claude.ai artifact.
- Tests: `npm i`, then `python3 tests/play.py` plays it in headless Chromium in a PC window
  (`--phone` for an iPhone-size touch screen): walks with W, jumps with Space, turns, zooms with
  the wheel, casts bolts at a slime as the mage, blinks, gets bitten, swims,
  `python3 tests/abilities.py` tries every hero's attack and abilities on a flat meadow (`?flat`)
  against three slimes, `python3 tests/monsters.py` lets one of each monster kind at the hero and
  checks it fights its own way (and that health bars and healing work), and `python3 tests/forge.py` builds all 400 type / head / material
  combinations, wields one per hero and reloads. It also visits every biome by day and night, opens the menu, and saves
  screenshots to `shots/`. `?debug` shows frame time, chunks and triangles; `?seed=N` picks
  another world, `?fresh` ignores the save.
