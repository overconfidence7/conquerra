# Claude Code: Session 9 (M3: the map lab, the art test bench, candidate maps)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his art (`art/incoming/`), his browser and a deploy.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

This session builds the **map lab**: a behind-the-scenes page where Nate picks a seed and a few knobs and sees the real illustrated map, its quality checks, a gallery of seeds and a quick bot simulation. It also builds the **art test bench**, where every art batch gets judged. These are the first steps toward random maps (M5) and the **map builder**, which Nate has decided is a player feature (after online play in M4). So build the lab's pieces to be reused.

## Read first, in this order
1. `CLAUDE.md` (hard rules)
2. `PROGRESS.md` (the last three entries)
3. `docs/07-map-tooling.md` (the whole plan, the guardrails and the art test bench)
4. `docs/decisions.md`, newest lines at the bottom. Especially the Oct 3 lines on map tooling, and the Oct 4 lines on the map builder and on the map lab living on the preview.
5. `docs/map-data.md`, and `docs/rules-reference.md` §12 (the map)
6. `docs/06-art-direction.md` (House borders and blending) and the art redo list in `PROGRESS.md`
7. `docs/sim-results-m3-bots.md` (10-player games run long)

## Step 0: sync
1. Run `git --no-optional-locks status`. Nate's folder is behind `main`: the orchestrator pushed docs and this prompt.
2. If anything local is uncommitted, stash it and check it against `main`, as in session 6.
3. Run `git pull` and `pnpm install`. Work on `main` and push to `main`.
4. If `art/incoming/` has new files (Nate may redo `tree-conifer-1`/`-2` or the rock, snow and hills textures), run `pnpm art:import` and commit the result.

## Part A: the map lab (`?lab=maps`)
**Where it lives (decided):**
- On the private preview at `conquerra.overconfidenceonline.com/?lab=maps`, behind the same Access sign-in. It also works under `pnpm dev`.
- It's never linked from the lobby.
- Its code is **loaded only when opened**, so the game's start-up size and speed don't change. Measure the game's bundle before and after.
- Write down, in `docs/07-map-tooling.md`, how it gets removed or switched off for the public launch.

**Layout (laptop first; on a phone it just mustn't break):**

**Recipe (left panel):**
- The seed and every map maker knob in `MapGenOptions`: territories, provinces, player ranges, water, seas, lakes, island chains, mountain ranges, sea lanes, rivers, minimum choke points, and so on.
- Plain-language labels.
- "Start from Embervale / Greatmarch" buttons.

**Generate:**
- Runs in a background worker and shows how long it took.
- The map maker throws away seeds that fail its checks ("embervale#2"). Show each attempt and why it failed.

**Preview (centre):**
- The **real game renderer**: the same painting, info layer, Far / Mid / Near zoom and Tactical view, with nothing special for the lab.
- Toggles:
  - territory and province names
  - choke points highlighted: passes, sea lanes and narrow land bridges
  - capitals for a chosen player count, from the map's capital layouts

**Checks (right panel):**
- `checkMap` in plain language, pass or fail with the numbers: connected, slivers, province sizes, choke points, sea lanes.
- A **fairness table** for each player count the map claims: distance to the nearest rival and income nearby, for each capital.
- Territory size spread.

**Sim this map:**
- Runs a few hundred Captain games on this map at a chosen player count, in a worker, with a progress bar.
- Shows:
  - average and median length
  - share inside 15–25 turns
  - seat wins
  - the runaway check
  - the share of battles crossing a pass or sea lane
- Reuse the simulator's code. If parts of it are tied to Node, move the pure core somewhere both can use.

**Seed gallery:**
- 12 seeds from the same knobs side by side (small Far views) with a pass/fail badge each. Click one to open it, or show the next 12.

**Export:**
- "Copy recipe" copies the options as JSON, ready for `packages/mapgen/src/configs.ts`.
- "Save image" saves a PNG of the current view.
- Add a short "How to make a seed an official map" section to `docs/07-map-tooling.md`: Nate tells Claude Code, which adds the recipe to `MAP_CONFIGS`, a names file and `pnpm build-maps`.

**Ready for the builder:**
- Build the preview, checks panel, fairness table and gallery as separate pieces that take a finished map (map data plus geometry) as input.
- The player map builder will reuse them on top of a staged map maker (M5). Don't build any editing yet.
- Don't change `generateMap`'s output for existing seeds (the committed maps must still match).

**Tests:**
- The lab's map for a seed and recipe is identical to `generateMap` run in Node (compare a hash).
- The recipe form round-trips (form → options → JSON → form).
- The checks panel's wording matches `checkMap`'s results.
- The lab code isn't in the game's start-up bundle.
- Report generation time in the browser for an Embervale-size and a Greatmarch-size map.

## Part B: the art test bench (`?lab=bench`, or a tab in the lab)
As planned in `docs/07-map-tooling.md`, with the real renderer:
- **House-on-ground grid:** every House colour's border and tint over every ground type at Far, Mid and Near. Fold the existing `?lab=houses` page into it.
- **Ground sampler:** a small map where every pair of ground types touches (forest next to sand, snow next to swamp, and so on), plus a coast and a river through hills. Generated or hand-made test data, your choice, as long as the real renderer paints it.
- **Sprite sheet:** every tree, peak, hill, settlement and specialist figure at game size on each ground, with House tints on the figures.
- `pnpm map-check bench` saves these to `docs/art/screens/bench/`.
- Make sure the outstanding redo items are easy to see in the bench shots, so Nate can see why they're on the list: `tree-conifer-1`/`-2` (round bushes, not pines), and the rock, snow and hills textures (big built-in shapes). If Nate's redone files have arrived, show them instead.

## Part C: candidate maps (for Nate to choose from)
Use the lab (or the same code from the command line) to find candidates. No rule changes.
- **Up to 3 Embervale-size maps (40 territories, 4–6 players):** they must pass the checks, look like real geography, and have a quick sim of 4 and 6 players that's on target.
- **Up to 3 Greatmarch-size maps (80 territories, 8–10 players):** in particular, check whether **map shape changes 10-player game length**. Captain games on Greatmarch average about 40 turns. Do some 80-territory shapes (more passes, more sea lanes, more central land, fewer dead ends) play shorter? Report what you find, as information for the session 14 balance pass.
- Write `docs/maps/candidates.md`: one screenshot each, its recipe, its checks and sim numbers, and a one-line "why this one". Nate picks which, if any, become official maps. Don't add them to `MAP_CONFIGS` yet.

## Out of scope
- **Map editing** (the builder): after M4, on a staged map maker.
- **Random maps in the lobby, and splitting the map maker into stages:** M5. Don't do anything that makes them harder.
- **Session 10:** generals, captured generals, the Fallen, and Captains ganging up on a runaway leader.
- **Session 14:** rule changes for runaways or game length.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`.
- **Screenshots** in `docs/art/screens/`:
  - the lab overview (recipe, preview and checks)
  - the choke point and capitals toggles
  - the seed gallery
  - a finished "Sim this map"
  - the bench images in `docs/art/screens/bench/`
- `docs/maps/candidates.md` is written. The game's bundle size and the map generation times are reported.
- `pnpm deploy:preview` passes its lock check, and the check also covers `/?lab=maps` (it must redirect to the sign-in when you're not signed in).
- Then ask Nate to:
  1. open `conquerra.overconfidenceonline.com/?lab=maps` on his laptop
  2. try a few seeds and knobs
  3. run "Sim this map" once
  4. look at the candidates and say which, if any, he likes

  Record what he says.
- `PROGRESS.md`, `docs/decisions.md` and `docs/07-map-tooling.md` are updated in simple language, with "Claude Code sessions completed" bumped to 9.

## End the session with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the lab address and how to use it in three lines
- generation times, and the game's bundle size before and after
- the candidates, in one line each, and what you learned about map shape and 10-player game length
- the screenshot paths
- what Nate said after trying the lab
