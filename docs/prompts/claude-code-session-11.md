# Claude Code: Session 11 (M3: the big visual upgrade, and six new official maps)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his new art, his browser and a deploy.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**Nate's direction:** visuals matter a lot to him. He said "the visuals still need to be cleaned up and improved", and he plays on his Android phone as well as his laptop. Session 9 fixed clarity; session 10 built the **art test bench** (`?lab=bench`) and saved the "before" pictures. This session:
- brings in his **third art batch**
- makes the map **look like a painted atlas**: pines that look like pines, mountain ranges that read as ranges, coasts with cliffs and surf, House colours that never muddy the ground
- gives the desktop map **more room**
- puts the **six candidate maps** into the lobby

Everything is judged on the bench, before and after.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit and push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

The parts are in priority order.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md` (the last three entries, including the orchestrator's review of session 10 and Nate's calls)
3. `docs/08-visual-upgrade-plan.md` (the whole thing: what Nate saw, what the orchestrator found, session 11's list)
4. `docs/06-art-direction.md` (the two layers, zoom levels, borders and ownership, performance targets)
5. `docs/art/asset-list-and-prompts.md`, the "Batch 3" section at the end (the new file names and what each piece is for)
6. `docs/07-map-tooling.md`: "How to make a seed an official map" and "The art test bench"
7. `docs/maps/candidates.md`
8. `docs/decisions.md`, newest lines at the bottom

## Step 0: sync
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **Check `art/incoming/`.**
   - Nate's batch 3 should be there: redone `tree-conifer-1`/`-2`, `terrain-hills`, `-rock`, `-snow`; new `mask-dragon`, `ridge-1..3`, `cliff-1..3`, `pass-gate`, `scaffold`, `bridge-wood`, `landmark-*`, `frame-plaque`.
   - Old versions of the redone files are in `art/incoming/_old/`.
   - **List what's there and what's missing.** Anything missing keeps today's drawing; don't stop for it.
3. If Nate pasted play-test notes from session 9 or the lab, fix anything small and clearly broken first. List anything bigger in your summary.

## Guardrails (all parts)
- **The painting never carries game state.** The info layer (borders, pills, plaques, chevrons, icons) reads at every zoom, and Tactical view (flat House colours) is one tap away and stays truly flat.
- **No special cases for one map.** Every new piece (ridges, cliffs, landmarks, gates) is placed by general rules from the map data.
  - **Same map, same painting:** placement is seeded from the map, never `Math.random()`.
  - **Existing maps' data must not change** (the test that compares them stays green). Prefer deciding placement in the renderer from the map data over adding fields to the map files.
- **Performance stays where it is:** Greatmarch and a 120-territory map on the emulated phone (CPU slowed 4x, `pnpm map-check labperf`). Report before/after paint time and frame rate. The start-up bundle doesn't grow by more than a few KB: new maps load only when picked.
- **Phone:** nothing gets harder. A basic turn is still about 6 taps, checked on a 384 px screen.
- **Engine, rules and bots don't change.**

## Part 1: new art in, the six new maps official, two small fixes
1. **Register batch 3** in `packages/art/src/registry.ts` (the new names and kinds; `frame-plaque` is wide). Run `pnpm art:import` and check the report: no unknowns except `mask-dragon`.
2. **The dragon outline.** Turn `art/incoming/mask-dragon.png` into the dragon silhouette with `pnpm --filter @conquerra/mapgen mask` (it replaces the hand-drawn `dragon` in `src/masks.ts`).
   - Then remake Wyrmland's recipe (2 mountain ranges) with it, trying seeds in the lab, until it **reads as a dragon at Far zoom** and passes every check.
   - Show Nate the Far picture before making it official.
   - If the outline is missing or doesn't work as land, keep today's Wyrmland and say why.
3. **Make all six candidates official** (Nate, Oct 5), following "How to make a seed an official map": the Shattered Isles, the Twin Realms, the Moon Coast, the Ringsea, the Crownlands and Wyrmland.
   - **Wyrmland's suggested players become 6–10** (Nate allows 120-territory maps for 10 players even though they run about 41–45 turns).
   - Keep the recipes exactly as in `docs/maps/candidates.md`, except Wyrmland's new mask and seed.
   - The lobby lists all eight maps with size and suggested players.
   - **New maps' data loads only when the game starts**, not at start-up (measure the bundle).
   - Run a 200-game Captain sim of the new Wyrmland at 6, 8 and 10 players and report it.
4. **Fixes:**
   - The bench's **redo sheet** cuts off its "Trees at 4x" row (the canvas is too short), so the pines never show there. Fix it.
   - `shape-dragon.png` crops the map's left edge.
5. **Tests:**
   - every official map's file equals what its recipe makes, and passes the checks
   - Embervale and Greatmarch are unchanged
   - the lobby lists eight maps
6. **Commit and push.**

## Part 2: the new art on the map
Bring each new piece in, check it on the bench at Far, Mid and Near on several grounds, and adjust size and placement there.
- **Pines and textures:** they should simply look right once imported. Check the forest edges and the hills, rock and snow at Far: no repeating shapes.
- **Mountain ranges as ranges:** draw ranges as overlapping chains of `ridge-*` along the range line, with single `mountain-*` peaks at the ends and as fill.
  - Passes stay **clearly open:** the road and the gap read at Mid and Far.
  - The `pass-gate` sprite stands on each pass road. The info layer's gate symbol stays at Far.
- **Coasts:** `cliff-*` along suitable stretches of high or rocky coast, following the coastline and never covering a sea lane's landing. Use a soft painted surf line where waves meet the land. Beaches stay sand.
- **Buildings being built:** `scaffold` over the washed-out building (it replaces today's drawn scaffold). The hourglass on the pill stays.
- **Bridges:** `bridge-wood` for some river crossings, chosen by general rules (smaller rivers, farmland), next to the stone `bridge`.
- **Landmarks:**
  - a few per map (about one per 15 territories), seeded from the map, on grounds that suit them: lighthouses on coasts, windmills on farmland, standing stones on grass or hills, ruins anywhere
  - never on a capital, a building spot, a pass, or under a pill or plaque
  - decoration only: no game effect, no name, nothing on the card
- **Province plaques** sit on `frame-plaque`, with the text unchanged and readable at Far and Mid.
- **Commit and push.**

## Part 3: the renderer pass (painting)
- **House washes:** tune each House's tint strength and colour so none muddies the ground. **Or (gold)** turns grassland a muddy yellow at Mid today. Judge with the bench's House-on-ground grid at Far, Mid and Near. Keep every House easy to tell apart, including for colour-blind players (the redo sheet's colour check).
- **Forests:** clusters with edges and the odd clearing, not uniform blobs; pines higher up and in the north, broadleaf lower and in the south (or whatever rule reads best). Seeded from the map.
- **The Far view:** softer and more painterly (the whole map should look like one painted atlas), while borders, plaques and pills stay crisp.
- **Tactical view:** check it is truly flat House colours, with no painting showing through.
- **Commit and push.**

## Part 4: menus (desktop first; the phone must not get worse)
Today, on desktop, the right column and the bottom dock cover nearly half the screen, and the army panel is wide but mostly empty.
- **Merge the territory card and the army panel** into one compact panel for the selected territory: who holds it, troops, terrain and gold chips, province, buildings, culture, then the actions. Plain sentences and icons, as in session 9.
- **A collapsible dock:** the order queue and turn controls fold down to a slim bar, so the map gets the room. The turn timer and the "end turn" button always show.
- **Clearer type sizes:** one scale for titles, body and small print, readable on a laptop at 100% zoom.
- **Phone:** keep today's layout unless a change is clearly better. Check on a 384 px screen, and count the taps for a basic turn (still about 6).
- **Commit and push.**

## Part 5: judge it, deploy, play test
- `pnpm map-check bench` saves the "after" set to `docs/art/screens/bench-after/` (keep the "before" set). Make **side-by-side before/after pictures** of each bench part, plus a Far and Mid view of Greatmarch and the Ringsea (`docs/art/screens/compare/`). Look at them yourself and fix anything that got worse.
- Retake the game screenshots (`pnpm ui-check`) on desktop and phone, including the new merged panel and the folded dock.
- `pnpm deploy:preview` passes its lock check.
- **Commit and push.**

## Out of scope
- **Session 12:** generals, captured generals, the Fallen.
- **Later:** new rules, bot changes, map editing (the builder comes after M4), new menus beyond the merged panel and dock, sound.
- **New art beyond batch 3:** list anything you wish you had for Nate's next batch, with what it's for.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`.
- **Screenshots:** the before/after set in `docs/art/screens/compare/`, the after bench set, the game on desktop and phone, and the new Wyrmland at Far.
- **Numbers:** paint time and frame rate on the emulated phone (Greatmarch and a 120-territory map, before and after), and the start-up bundle before and after.
- `pnpm deploy:preview` passes its lock check.
- **Then ask Nate to play** on the preview:
  1. On his **phone**, a 6-player game on the **Ringsea**. Check that the pines, ranges, passes, coasts and his House colour look right at Far, Mid and Near, and that Tactical view is one tap away and flat.
  2. On his **laptop**, a 4-player game on the **Twin Realms**. Does the map feel roomier with the merged panel and the folded dock? Are any words too small?
  3. Open the lobby and check all eight maps are there. Start one game on **Wyrmland** and say whether it reads as a dragon.
  4. Tell you how many turns each game took, and anything that looks off.

  Record what he says.
- `PROGRESS.md` (with "Claude Code sessions completed" bumped to **11**), `docs/decisions.md`, `docs/08-visual-upgrade-plan.md` (mark what's done), `docs/06-art-direction.md` (if a rule changed), `docs/07-map-tooling.md` and `docs/map-data.md` are updated in simple language.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which batch 3 pieces were used, and any that didn't work (and why)
- the new Wyrmland: its seed, its checks and its 6/8/10-player sim numbers
- the phone performance and bundle numbers, before and after
- the screenshot paths, the before/after pictures first
- art you'd like in the next batch
- what Nate said after playing
