# Map Tooling: the map maker, random maps and the map builder

*Written Oct 3 (orchestrator), after Nate raised a custom map builder as a future add-on. Nothing here is built yet; this is the plan and the guardrails so today's work doesn't close any doors.*

## The short answer
**Yes, random maps and a map builder should share one foundation, but not one schedule.** What they share is the map maker's pipeline, its quality checks and the renderer. The builder's screens are a separate, later job. So the order is:

1. **Map lab** (early M3, dev-only): a page where you pick a seed and a few knobs and see the real illustrated map, its quality checks and a gallery of seeds. It costs little, helps Nate curate maps now, and doubles as the art test bench (below).
2. **Random maps** (M5): split the map maker into stages that can be re-run on their own, then offer "Random map" in the lobby.
3. **Map builder** (after M4's online play; M6 or sooner): screens for editing each stage by hand, on top of the same pipeline. **Decided Oct 4: it's a player feature from the start**, not just a tool for Nate.

Each step reuses most of the one before it. Building the builder first would mean building the pipeline split anyway, with a much bigger interface on top, before we know what random maps need.

## What's shared
| Piece | Random maps use it to… | The builder uses it to… |
|---|---|---|
| **The cell mesh** (the map is made of ~thousands of small cells) | grow land, territories and provinces | paint land, water, terrain and territories cell by cell, so every border still comes out smooth and shared |
| **Outline code** (one shared line between neighbours, no gaps) | draw borders, coasts and ranges | the same, after every edit, so hand-made borders always render correctly |
| **Quality checks** (`checks.ts`: connected, no slivers, fair capitals, choke points) | throw away a bad map and try the next seed | show live warnings ("Capital 3 is two steps closer to gold than Capital 5") |
| **Placement** (decorations, label points, building and castle sites) | dress the map | re-dress only the part you just edited |
| **Names** | name everything | name everything, with your overrides kept |
| **The renderer** | draw it | preview it exactly as players will see it |

## How the pipeline should change (M5)
Today `generateMap` runs every step in one pass with one shared random stream. That's fine for fixed maps, but it means changing one early step reshuffles everything after it.

- **Stages:** land and height → water and mountain ranges → rivers → territories → provinces → capitals → ground types → places and decorations → names → checks.
- **Each stage gets its own random stream**, made from the seed plus the stage's name. Changing the territories then doesn't re-roll every tree on the map.
- **Pins:** any stage's result can be pinned with hand edits. A random map has no pins. A hand-made map is a recipe (seed and knobs) plus its pins, and the later stages re-run around them.
- **Saved maps keep the finished result too.** A published map stores its full geometry, so a later map-maker update never changes a map people already play. (The existing `MAPGEN_VERSION` number tracks this.)

## How this answers the blending and border question
- **Maps are data, never pictures.** Whether a map is generated or built by hand, it ends up as the same thing: outlines, a ground-type grid, a height map and decoration spots. The renderer paints all of it with the same textures, lighting and sprites. So blending gets solved **once, in the renderer**, and every map (ours, random or custom) gets the fix.
- **Borders are always computed, never drawn freehand.** In the builder you assign cells to territories (or split, merge and nudge), and the outline code redraws the shared line. That's what keeps the House border rules in `06-art-direction.md` working on any map.
- **The builder paints ground types, not images.** Nobody pastes a picture into a map; you paint "forest" and the renderer decides how forest meets grass.

## Guardrails from now on (all sessions)
- The map maker stays pure and seeded (same seed, same map), like the engine.
- The renderer reads only `geometry` and never has special cases for one map.
- Every map, ours or generated, passes `checkMap` before it's used.
- New art is judged on the art test bench, not just on Embervale.

## The art test bench (part of the map lab)
- **House-on-ground grid:** each House colour's border and tint over each ground type, at Far, Mid and Near.
- **Ground sampler:** a small generated map where every pair of ground types touches (forest next to sand, snow next to swamp, and so on), plus a coast and a river through hills.
- **Seed gallery:** 12 random maps side by side.
- Every new art batch gets checked here, and the screenshots go in `docs/art/screens/bench/`.

## Decided (Oct 4): the builder is for players
Nate chose a player feature from the start. What that adds on top of the shared pipeline:
- **Playable online:** player maps are saved online (D1 for the listing, R2 for the map data) and can be picked in the lobby by friends, then publicly. So it follows M4.
- **Quality and fairness gate:** a map can only be played after `checkMap` passes (connected, no slivers, fair capitals for each player count it claims, enough choke points). The builder shows the failures as live warnings.
- **Undo**, and a layout that works on a laptop first. Phone editing can come later; playing a player map works everywhere.
- **Light moderation:** map and place names go through a word filter, with a way to report a map.
- The map lab (session 9) is still the first step: its preview, checks panel and seed gallery become the builder's core.

## Session 10 scope (planned Oct 4): the map lab, bigger maps, new shapes
Moved from session 9 to 10, because Nate's play-test fixes come first. Nate's direction (Oct 4): maps should be **bigger** and **more imaginative**, not one big round landmass, with clear provinces.
- **Map lab** at `?lab=maps` on the private preview, behind Access, loaded only when opened, never linked from the lobby.
  - **Recipe panel:** seed plus every `MapGenOptions` knob.
  - **Generate in a worker:** shows its attempts and why each failed.
  - **Preview:** the real renderer, with name, choke-point and capital toggles.
  - **Checks panel and fairness table**, and territory size spread.
  - **"Sim this map":** a few hundred Captain games in a worker, showing length, seat wins, runaways and pass/sea battles.
  - **Gallery:** 12 seeds side by side.
  - **Export:** "Copy recipe" and "Save image".
  - Its pieces take a finished map as input, so the player map builder can reuse them.
- **Land shapes:** a new knob for the overall shape:
  - one continent (today)
  - an archipelago (many islands joined by sea lanes)
  - twin continents
  - an inland sea
  - a crescent
  - a **shape mask**: a silhouette image, such as a dragon or a shield, that the land grows into
- **Sizes:** keep Embervale (40) as the quick map; new maps of 60–120 territories, with provinces sized to match.
- **Art test bench** at `?lab=bench` (as described above). The session 11 visual upgrade is judged on it.
- **Candidate maps:**
  - several new maps in different shapes and sizes, each with checks, a quick sim and a screenshot, in `docs/maps/candidates.md`
  - Nate picks which become official
  - Also check whether map shape changes 10-player game length (Captains on Greatmarch average about 40 turns).


## The map lab (built in session 10)
**Where:** `conquerra.overconfidenceonline.com/?lab=maps`, behind the same Access sign-in as the rest of the preview. It's never linked from the lobby. Locally: `pnpm build`, `pnpm --filter web preview`, then `http://localhost:4173/?lab=maps`.

**In three lines:**
1. On the left, pick a **shape**, a **size** and a **seed** (or 🎲), then **Make this map**. Every other knob is under "All settings", with a plain label.
2. The middle shows the map exactly as the game draws it. Use Far / Mid / Near, Tactical, and the Names, Choke points and Capitals toggles (and how many players). Click a territory to see its neighbours.
3. On the right: why earlier tries failed, the checks, fair capitals for every player count, territory sizes, and **Sim this map** (pick players and games). **Seed gallery** shows 12 seeds side by side; click one to open it.

**What each part does:**
- **Making a map** happens in a background worker, so the page never freezes. It shows how long it took, which try passed, and why each earlier try was rejected. The **fingerprint** is a short code for the whole map: the same recipe always gives the same fingerprint, here or in `pnpm try-maps` (a test checks this).
- **Checks:** `checkMap`, one plain line per rule (connected, even sizes, room for banners, provinces, fair capitals, no hairlines, wide passes, sea lanes, choke points), with the numbers behind each.
- **Fair capitals:** for each player count, how many borders apart the capitals are and how even the gold near each one is.
- **Sim this map:** a few hundred all-Captain games in a worker (the same code as `pnpm sim`, now in `packages/simcore`), with a progress bar. It shows average length and the share of games within 40 turns and inside 30–40, seat wins, the three runaway measures, and how many battles go through passes and across sea lanes.
- **Seed gallery:** the next 12 seeds with this recipe (each allowed 8 tries), with a pass / "passes on try N" / fail badge. "Next 12" and "Previous 12" page through.
- **Copy recipe** puts the recipe on the clipboard as JSON, ready for `configs.ts`. **Paste recipe** reads one back. **Save image** downloads a picture of the map as it's shown.
- The address keeps the shape, size and seed, so a link opens the same map. Extras for scripts and screenshots: `full=1` (just the map), `capitals=0`, `names=0`, `chokes=1`, `tactical=1`, `players=6`, `preset=greatmarch`, `tab=gallery`.

**Ready for the player map builder:** the preview (`MapPreview`), the checks panel, the fairness table, the size chart and the gallery each take a finished map, not a recipe (`apps/web/src/lab/maps/`). The plain-words checks, fairness rows and size spread are pure functions in `packages/mapgen/src/report.ts`. The builder (after M4) can show all of them for a map drawn by hand. Nothing in the lab edits a map yet.

**Kept out of the game's start-up:** the lab is only loaded when `?lab=maps` is opened. The page the game loads first was 442.4 KB (136.9 KB compressed) before the lab and is 442.7 KB (137.1 KB) after: only the few lines that pick the page. The lab itself is a separate 44 KB file plus a 192 KB worker. A test follows every import from the game's entry and fails if any lab or map-maker code is reached; `pnpm bundle-size` (run by `pnpm deploy:preview`) checks the built files the same way.

**Switching it off for the public launch:** build with `VITE_LABS=off` (for example `VITE_LABS=off pnpm build`, or set it in the launch deploy script). The switch in `apps/web/src/main.tsx` is then false when the game is built, so the map lab and the art test bench aren't in the build at all, and `?lab=...` just opens the lobby. Until then, the preview's Access sign-in keeps them private, and `pnpm check:preview` confirms `/?lab=maps` and `/?lab=bench` redirect to the sign-in.

## The art test bench (built in session 10)
**Where:** `?lab=bench` on the private preview (the old `?lab=houses` opens it too). Five parts, chosen at the top; Far / Mid / Near, ⤢ (fit), Tactical and Names work as in the lab.
- **Houses on grounds:** one row per House (all 10), one column per ground (grass, farmland, forest, hills, rock, snow, swamp, sand). Each tile has that ground's usual trees, hills, peaks or village, a troop pill, House borders and tint; each row's first tile is the House's capital, and Azure's row (yours) shows culture laurels 0–5.
- **Grounds:** all 28 pairs of grounds meeting along a wavy line (each tile is named "left | right"), then a row of coasts running down to a beach and the sea, with a river through hills.
- **Sprites:** one row per ground, each row in a different House's colours. Columns: conifers, broadleaf trees, peaks, hills, villages and towns (every variant, left to right), the four buildings, the four being built (scaffold), and a capital with an army and all five specialists (the figures show at Near). Everything at true game size.
- **Map symbols:** Embervale, with a territory next to a pass selected: the neighbour chevrons, the pass gate, a sea lane, province plaques, culture laurels (1–5), a market, barracks and watchtower, a fort being built, and two specialists.
- **Redo list & colours:** the known redo items, big: the rock, snow and hills textures tiled as the game tiles them (their big built-in shapes repeat), the same at Mid, and the trees at 4x size (`tree-conifer-1` and `-2` read as round bushes, not pines). Then the House colours for normal and colour-blind vision (folded in from the old `?lab=houses`).

**How it works:** the first three parts are made-up maps (plain map data built in `apps/web/src/lab/bench/benchMaps.ts` from a grid of tiles), drawn by the game's own renderer exactly like a real map, so new art is judged at true size and with the real blending, borders and markers. The renderer has no special cases for them.

**Saving the set:** `pnpm build`, `pnpm --filter web preview`, then `pnpm map-check bench`. It saves 20 pictures to `docs/art/screens/bench-after/` (each part at Far, Mid and Near, close-ups of the trees, peaks, buildings, scaffolds, army, the river and coast, plus `redo-list.png` and `house-colours.png`). Session 10's "before" set stays in `docs/art/screens/bench/` (`BENCH_OUT=bench` retakes it). `BENCH_PARTS=houses,symbols` takes just those parts, and `BENCH_OUT=<folder>` saves somewhere else (handy while tuning).

**Session 11 additions:**
- The redo sheet shows every batch 3 piece at 3x game size on a ground it goes on, or "not in yet: today's drawing" while it's missing. The "Trees at 4x" row is no longer cut off.
- Side-by-side before/after pictures of every bench shot, plus Greatmarch and the Ringsea at Far and Mid, are in `docs/art/screens/compare/`.
- `node apps/web/scripts/shot.mjs <map> <out.png> [far|mid|near|<px>] [x,y]` takes a quick look at a real map in a game (`NOUI=1` hides the menus, `SELECT=1` selects your capital, `FOLD=1` folds the desktop dock, `LAB=1` draws the map's recipe in the lab instead).
- `node apps/web/scripts/tap-count.mjs` counts the taps for a basic turn on a 384 px phone.

## When art batch 3 arrives (it arrived for session 12; kept as the recipe for the next batch)
1. Nate runs `docs/prompts/gemini-art-session-03.md`; the files land in `art/incoming/` (old versions of redone files in `art/incoming/_old/`).
2. `pnpm art:import`. The report should list no unknown files except `mask-dragon.png` (the dragon outline is a map shape, not art).
3. `pnpm build`, `pnpm --filter web preview`, then `pnpm map-check bench`: every new piece shows up on the bench's redo sheet and in place on the map. Nothing else needs changing: each piece already has its placement rule and falls back to today's drawing until it arrives.
4. **Wyrmland's dragon:** `pnpm --filter @conquerra/mapgen mask art/incoming/mask-dragon.png wyrm "The Wyrm"` (the path is from the repo root; the script now crops the picture to the drawing, so empty paper doesn't become sea), add it to `IMAGE_MASKS` in `packages/mapgen/src/masks.ts`, try seeds of Wyrmland's recipe until one reads as a dragon at Far and passes every check, show Nate the Far picture, then point Wyrmland's recipe at the new mask and seed in `configs.ts`, `pnpm build-maps`, and run 200-game sims at 6, 8 and 10 players.
5. **Before/after pictures:** move the old `bench-after/` aside, `pnpm map-check bench`, then `pnpm --filter @conquerra/art exec tsx scripts/compare.ts <old folder> <new folder> <out folder> "Before" "After" bench-` (use full paths). For real maps: build once with the old art (`git stash` the art folder), take shots with `shot.mjs`, restore the new art, build, take the same shots, and compare the two folders.

## Session 12: Wyrmland and the Crownlands re-seeded (Nate's OK, Oct 6)
- **Wyrmland** now grows into Gemini's dragon outline (`masks/dragon.json`, made with the mask script; the hand-drawn dragon is gone), seed `mask-120-6`, suggested for 6–8 players. Out of 30 seeds every one read as a dragon. Seed 6 was the clearest at Far: a horned head, a gap between neck and wing, separate legs and a curled tail, no stray islets. It was also the shortest of the four best in 8-player games. It passes every check: 4 passes, 6 sea lanes, 11 choke points, 26 river borders.
- **The Crownlands** now uses seed `mask-100-9`: a clean five-point crown with 5 rivers (21 river borders; the old seed had none), 7 passes, 4 sea lanes, 11 choke points. 34 of 40 seeds had 3 or more rivers; the old seed was simply unlucky.
- Captain games, 200 each (the Fallen off, so only the map differs; `apps/sim/scripts/seed-sim.ts`):

| Map | 6 players | 8 players | 10 players |
|---|---|---|---|
| Wyrmland, old → new | 33.0 → 37.3 turns | 36.7 → 38.5 | 39.2 → 41.9 (only 50% within 40) |
| The Crownlands, old → new | 35.4 → 32.9 | n/a | 38.0 → 39.3 |

  The new dragon's long neck and tail mean long marches, so Wyrmland now suggests 6–8 players.
- The other six official maps are byte-for-byte unchanged (a test checks every official map against its recipe).

## Trying other seeds for an official map (session 12)
`pnpm --filter @conquerra/mapgen try-seeds <mapId> <seed prefix> <first> <how many> --out <folder>` makes the map's exact recipe with other seeds (for example `crownlands mask-100- 1 40`) and prints, for each, which try passed the checks and how many rivers, passes, sea lanes and choke points it has, plus a debug picture. To see a seed the way the game draws it: `LAB=1 SEED=<seed> node apps/web/scripts/shot.mjs <mapId> out.png fit` (with the built game running).

## How to make a seed an official map
1. In the lab, find a map you like (the gallery helps) and make sure every check passes and "Sim this map" looks right at the player counts it suits.
2. Give it a name and an id under "All settings" (the id is lower case, like `stormcoast`).
3. Press **Copy recipe** and paste it into `MAP_CONFIGS` in `packages/mapgen/src/configs.ts` (inside the `[ ... ]`, after the last map, with a comma).
4. Run `pnpm build-maps`. It writes the map into `packages/content/data/maps/<id>.json` and a picture into `docs/maps/`, and the map appears in the lobby (`catalog.json`). Two lines need adding once per new map: the import in `packages/content/src/maps.ts` (for tests and the simulator) and the loader in `packages/content/src/loadMap.ts` (the game fetches each map only when a game on it starts).
5. Optionally rename places in `packages/mapgen/names/<id>.json`, then run `pnpm build-maps` again.
6. Run `pnpm test`: it checks the committed map is exactly what the recipe makes and that it passes every check.
7. Commit. From then on the map never changes unless its recipe or the map maker does (the test catches that).

**How long things take** (Nate's laptop, Chrome): making a 60-territory map 1–3 s, a 100-territory one about 1.5–5 s, a 120-territory one 3–20 s (big archipelagos and crescents need the most tries; Node is about twice as fast). "Sim this map": 100 ten-player games on a 100-territory map in about 20 s. The gallery: about 2 s a map at 100 territories.

**Big maps on a phone** (emulated mid-range phone, CPU slowed 4x, `pnpm map-check labperf`, `docs/art/screens/perf-big.json`): a 120-territory map shows its first picture in 4.4–6.9 s and is fully painted in 6.1–7.1 s, against 4.5 and 6.0 s for Greatmarch measured the same way. Panning runs at 46–81 frames a second. The painting resolution already drops on big maps to keep memory near 47 MB (1.1–1.75 pixels per map unit instead of 2.2 on Greatmarch), so no change was needed.

## Session 19: bigger maps, and fair seats by simulation
- **New silhouettes in code** (`packages/mapgen/src/masks.ts`): `phoenix`, `kraken` and `worldtree` (the tree of life), drawn with `sym(width, ...right half)`, which mirrors the right half's points. Thin parts get rounded away by the coast: keep arms, roots and inlets at least about 8 units wide in the 0–100-high box.
- **Trying a shape:** `pnpm --filter @conquerra/mapgen try-maps --shapes mask --mask kraken --sizes 200 --seeds 12 --out <folder>` (a one-line error, such as an unknown mask, is now printed instead of an empty failure; `DEBUG_MAPS=1` prints the full error). Twelve pictures side by side: `node apps/web/scripts/s19-gallery.mjs <folder> <out.png> "<title>"` (`docs/maps/s19/gallery-*.png`).
- **Drawing a candidate in the game's own renderer:** `LAB=1 RECIPE='<recipe json>' node apps/web/scripts/shot.mjs embervale out.png fit` (with the built game running).
- **Starting a recipe at the try that passed:** a map that passed its checks on try N of seed S is made, byte for byte, by seed `S#N` on its first try (only the map's label changes), so the tests that rebuild every official map stay quick (`mask-160-12#21` for Ashwing).
- **Fair seats:** the map maker's fairness check (every capital about as far from its nearest rival; about as much gold within 2 steps) isn't enough: among equal bots some capital spots win far more often than others on every map (`docs/sim-results-m3-balance.md`, Part 4). Sims now record each seat's capital (`SeatStats.capital`).
  - `npx tsx apps/sim/scripts/s19-spots.ts <map:players> [games]`: each capital spot's win rate.
  - `npx tsx apps/sim/scripts/s19-fair-all.ts <map:players>`: every layout of the map's capital spots that passes the paper check, played by equal bots; the fairest ones checked again (fine for small maps: Embervale at 4 has 43).
  - `npx tsx apps/sim/scripts/s19-fair-seats.ts <map:players>`: a quicker search that moves the strongest and weakest spot one at a time.
  - A recipe pins what's found: `capitals: { 4: ["t02", "t20", "t28", "t37"] }` (by player count; the spots must be the map's own capital spots, which have the castles and plains). Only `capitalLayouts` changes in the map file.

## Session 20b: fair seats on every official map
- **The search:** `npx tsx apps/sim/scripts/s20b-fair-seats.ts <map:players> [games=300] [budget] [checkGames=300]`. It starts from the map's own layout for that table size and measures each capital spot's win rate (tables of Marshals; the same games for every layout, so layouts are compared fairly). Then it tries moving the **weakest** spot, then the **strongest**, to other capital spots of the map (only layouts that pass the paper check), nearest first, the least exposed spot first for a weak one and the most exposed first for a strong one, and keeps the first move that shrinks the spread between the best and the worst spot. It repeats until nothing helps or `budget` layouts have been measured, then checks the start and the best layout again on fresh games and prints the recipe line. The search itself is `apps/sim/src/fairSeats.ts` (pure apart from the games; tested for determinism).
- **The exposure check** (`exposureOf` in `packages/mapgen/src/checks.ts`): besides distance to the nearest rival and gold within 2 steps, each capital spot's **room** (land closer to it than to any rival, within 4 steps), **front** (the territories just outside that land: the borders it must hold) and **rivals** (rival capitals within 4 steps); `exposure = (front + 3 × rivals) / room`, lower is safer, and a layout passes when every spot is within 2× the safest one. How well it agrees with the sims is in `docs/sim-results-m3-balance.md` ("Fair seats (session 20b)"); the map maker doesn't require it yet.
- **Pinning:** as session 19 did for Embervale, the result goes in the map's recipe (`capitals: {n: [...]}` in `configs.ts`) and only the `capitalLayouts` line of the map file changes. Raw outputs: `docs/sims/s20b-fair-<map><players>.txt`.
