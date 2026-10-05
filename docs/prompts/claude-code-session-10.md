# Claude Code: Session 10 (M3: bigger maps in new shapes, the map lab, the art test bench)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his art, his browser and a deploy.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**Nate's direction:** maps should be **bigger** and **more imaginative**, not one big round landmass: island chains, twin continents, a fantasy-shaped land, with clear provinces. This session gives the map maker new shapes and sizes, builds the **map lab** (where maps get made, judged and simulated) and the **art test bench**, and finds **candidate maps** for Nate to choose from.

**Commit and push after each part.** Session 9 hit Nate's usage limit once. If you can tell you're getting close:
1. stop at the end of a part
2. commit and push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

The parts are in priority order.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md` (the last three entries, including Nate's play test of session 9 if it's there)
3. `docs/07-map-tooling.md`, especially "Session 10 scope", the guardrails and "Decided (Oct 4): the builder is for players"
4. `docs/decisions.md`, newest lines at the bottom (map size, game length in turns, map lab on the preview)
5. `docs/map-data.md`, `docs/rules-reference.md` §12, and `docs/08-visual-upgrade-plan.md` (session 11 is judged on your bench)
6. `docs/sim-results-m3-fixes.md` (current game lengths)

## Step 0: sync
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. If `art/incoming/` has new files, run `pnpm art:import` and commit the result.
3. If Nate's play test of session 9 (in `PROGRESS.md` or pasted by Nate) found anything small and clearly broken, fix that first. List anything bigger in your summary.

## Targets to keep in mind
- **Game length is measured in turns (Nate, Oct 5).** Games may run **up to 30–40 turns** (this replaces the old 15–25 target). Today, with Captain bots: 4 players about 21 turns on Embervale, 6 players about 28, 10 players about 35 on Greatmarch.
- **Map sizes (Nate, Oct 4):** keep Embervale (40 territories) as the quick map; new maps are **60–120 territories**.
- **Guardrails:**
  - same seed, same map
  - the renderer never has a special case for one map
  - every map passes `checkMap`
  - the existing maps' output must not change: a test compares them

## Part 1: land shapes and bigger maps (map maker)
- **A `shape` knob in `MapGenOptions`:**
  - `continent` (today's behaviour, and the default)
  - `archipelago` (many islands joined by sea lanes; every island gets one)
  - `twinContinents` (two large landmasses with a few sea lanes and maybe a narrow land bridge)
  - `inlandSea` (land ringing a central sea)
  - `crescent`
  - `mask` (land grows inside a silhouette)
- **Masks:**
  - Ship two or three built-in silhouettes drawn as simple outlines in code, for example a dragon, a shield and a crown.
  - Make it easy to add more. Later, Nate could draw one as a black-and-white image.
- **Bigger maps, up to 120 territories:**
  - Provinces scale with size, and capitals stay fair for every player count the map claims.
  - Measure generation time and the renderer at 120 territories on a phone (CPU slowed 4x): paint time and frame rate.
  - Lower the painting resolution on big maps if needed, as the renderer already does.
- **All of `checkMap` still applies:**
  - no hairline borders
  - wide passes
  - every island reachable
  - fair capitals
- **Tests:**
  - every shape builds and passes checks across many seeds
  - the same seed gives the same map
  - Embervale and Greatmarch are unchanged
- **Commit and push.**

## Part 2: the map lab (`?lab=maps`, on the private preview)
- **Where it lives:** behind the same Access sign-in. Its code is **loaded only when opened** (measure the game's start-up bundle before and after). It's never linked from the lobby. Write down how it's switched off for the public launch.
- **Recipe panel:** seed, shape, size and every knob, with plain labels, plus "Start from Embervale / Greatmarch".
- **Generate** in a background worker: time taken, every attempt and why it failed.
- **Preview:**
  - the **real game renderer** (painting, info layer, provinces and plaques, Far / Mid / Near, Tactical)
  - toggles for names, choke points and capitals at a chosen player count
- **Checks panel:** `checkMap` in plain words, a fairness table for each player count, and territory size spread.
- **"Sim this map":**
  - a few hundred Captain games in a worker at a chosen player count, with a progress bar
  - shows length (with the share inside 30–40 turns), seat wins, the runaway measures, and the share of battles across passes and sea lanes
  - Move the simulator's pure core where both can use it if needed.
- **Seed gallery:** 12 seeds side by side, with pass/fail badges and "next 12".
- **Export:**
  - "Copy recipe" (JSON for `configs.ts`)
  - "Save image"
  - a "How to make a seed an official map" section in `docs/07-map-tooling.md`
- **Ready for the builder:** the preview, checks panel, fairness table and gallery each take a finished map as input. The player map builder (after M4) reuses them. No editing yet.
- **Tests:**
  - the lab's map equals `generateMap` in Node (hash)
  - the recipe round-trips
  - the lab isn't in the game's start-up bundle
- **Commit and push.**

## Part 3: the art test bench (`?lab=bench`)
- **House-on-ground grid:** every House over every ground, at Far, Mid and Near (fold in `?lab=houses`).
- **Ground sampler:** every pair of grounds touching, plus a coast and a river through hills.
- **Sprite sheet:** every tree, peak, hill, settlement, building (built and under construction) and figure, at game size, on each ground, with House tints.
- **The new map symbols** (neighbour chevrons, pass gate, plaques, culture laurels), so session 11 can replace them with art.
- `pnpm map-check bench` saves the set to `docs/art/screens/bench/`. These are the "before" images for session 11.
- Make the known redo items easy to see: the pines that look like bushes, and the rock, snow and hills textures with big built-in shapes.
- **Commit and push.**

## Part 4: candidate maps for Nate
Use the lab, or the same code from the command line, to find **at least six** candidates across shapes and sizes. Suggestions:
- a 60-territory archipelago for 4–6 players
- 80-territory twin continents for 4–8
- a 100-territory inland sea for 6–10
- a 120-territory mask map for 8–10
- a crescent
- one more of your choice

Each must:
- pass the checks and look like a real place
- have clear provinces
- have a quick Captain sim (200 games at its suggested player counts) that lands inside the new **up to 30–40 turns** range

Also note what map shape does to game length and runaways (information for the balance pass).

Write `docs/maps/candidates.md`: one Far screenshot each, its recipe, checks, sim numbers and a one-line "why this one". Nate picks which become official, so don't add them to `MAP_CONFIGS` yet. **Commit and push.**

## Out of scope
- **Session 11:** the big visual upgrade and Nate's new art batch.
- **Map editing:** the builder (after M4), and splitting the map maker into stages (M5). Don't make either harder.
- Rule and bot changes.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`.
- **Screenshots** in `docs/art/screens/`:
  - the lab overview, the checks panel, the seed gallery, a finished "Sim this map"
  - one Far view per shape
  - the bench set in `docs/art/screens/bench/`
- `docs/maps/candidates.md` is written. Report the bundle size, generation times and big-map phone performance.
- `pnpm deploy:preview` passes its lock check, and the check also covers `/?lab=maps` (redirects to the sign-in when you're not signed in).
- Then ask Nate to:
  1. open `conquerra.overconfidenceonline.com/?lab=maps` on his laptop
  2. try a few shapes and seeds
  3. run "Sim this map" once
  4. pick his favourite candidates

  Record what he says.
- `PROGRESS.md` (with "Claude Code sessions completed" bumped to **10**), `docs/decisions.md`, `docs/07-map-tooling.md` and `docs/map-data.md` are updated in simple language.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the lab address and how to use it in three lines
- generation times, bundle size before and after, and big-map phone performance
- the candidates in one line each (shape, size, players, average turns)
- what shape does to game length
- the screenshot paths
- what Nate said and which candidates he picked
