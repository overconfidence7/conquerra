# Claude Code: Session 3 (Milestone 2, part 2: the map maker and real geography)

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer: explain choices in plain language and keep setup steps copy-paste simple.

Session 2 made the game playable in the browser. Nate's direction since then:
- **Maps should play like War.app or a good Risk map:** organic borders, seas and lakes, mountain ranges, rivers, and real choke points (`docs/04-design-additions.md` §9).
- **The look is a richly painted world under a gilded interface** ("Gilded Atlas", `docs/06-art-direction.md`; the target mockup is `docs/art/reference-mockup.png`).
  - The painted graphics engine is **session 4**; the menus, replay, timer and phone work are **session 5**.
  - **This session builds the map maker and the map data that the painted world will need.**

## Read first, in this order
1. `CLAUDE.md` (hard rules)
2. `PROGRESS.md` (including the orchestrator's notes after session 2)
3. `docs/04-design-additions.md` §9 (maps), §8 (fog) and §0 (simple to play)
4. `docs/06-art-direction.md` (so the data you produce fits the painted renderer and the info layer) and `docs/art/reference-mockup.png`
5. `docs/rules-reference.md`
6. `docs/03-build-plan.md` (the M2 section)
7. `docs/decisions.md` (newest lines at the bottom)

## Step 0: housekeeping
Commit the orchestrator's doc updates as they are: `PROGRESS.md`, `docs/decisions.md`, `docs/03-build-plan.md`, `docs/04-design-additions.md`, `docs/06-art-direction.md`, `docs/art/` and this prompt ("Docs: art direction v0.2, session 3 prompt"). Create `art/incoming/` with a short README saying it's where Nate drops AI art using the names in `docs/art/asset-list-and-prompts.md`. Don't process any art yet; that's session 4.

## Part A: the map maker (seeded, deterministic)
Build it as its own small package (`packages/mapgen`), or as a clearly separated module in `packages/content`. Your call; explain it.
- **Same seed, same map.** Use the project's seeded PRNG: no `Math.random()`, and no Node-only APIs in the generator. Later it must run in the browser or on the server for on-the-spot random maps (M5).
- **Inputs:** seed, territory count, province count, player range, and style knobs (amount of water, number of mountain ranges, number of choke points).
- **What it produces:**
  - **Land and water:** a natural coastline with bays and peninsulas, a sea or two, a few lakes, and maybe an island chain. Water is never a territory.
  - **Impassable mountain ranges,** each crossed by one or more **passes** (the existing `pass` border type).
  - **Territories:** organic, irregular shapes of reasonably even size, grouped into provinces. Territories border only where they actually touch.
  - **Rivers** that flow from high ground to the sea or a lake and run along territory borders (the existing `river` border type).
  - **Sea lanes:** a few drawn crossings over water. Add a `sea` border type, with its attack penalty in `rules.json`.
  - **Choke points by design:** passes, narrow land bridges or single sea lanes where a small army can hold off a big one.
  - **Capital slots** spread fairly for the player range.
  - **Biomes for the painting:** a fine-grained terrain field (grass, farmland, forest, hills, rock/snow, swamp, sand, shallow/deep water) that agrees with each territory's game terrain type. The painted renderer will blend textures from this.
  - **Decoration placements:** where trees, peaks, hills, villages and towns go, plus the capital castle site and where a building sprite sits in each territory. Placements are seeded, avoid label points and water, and stay within their biome.
  - **A label point** inside each territory, with enough clear space for a banner.
- **Map checks** (reject the map, or retry with the next seed, if any fail):
  - every territory can reach every other
  - no slivers or giant blobs
  - each province has a sensible size
  - capital slots are fair (similar distance to neighbours and similar nearby income)
  - the map has a minimum number of choke points
- **Map data:** extend the map schema (Zod) with territory outlines, water and mountain shapes, river lines, sea lanes, label points, the biome field (compact: a low-resolution grid or polygons, your call) and the decoration placements. **The engine still only uses the territory graph**; the rest is for drawing.

## Part B: rebuild the two test maps
- **Embervale** (about 40 territories, suits 4–6 players) and **Greatmarch** (about 80, suits 8–10), made with the map maker and given fantasy place names.
- Keep the territory counts close to today's, so balance stays comparable.
- Export a quick **preview image** of each to `docs/maps/` (flat biome colors, borders, rivers, passes, sea lanes and capital slots; a debug view, not the final art).
- Re-run the sim: 1,000 games at 2, 4 and 6 players on Embervale, and 200 at 10 players in Conquest mode on Greatmarch. Report game length, seat fairness, and what the choke points changed. If length drifts outside 15–25 turns, tune `rules.json` (not code) and say what changed.

## Part C: keep the game playable on the new maps
- Update the current SVG map to draw the new geometry simply: territory outlines, water, mountain ranges, rivers, passes and sea lanes. Plain, readable shapes are fine here; **don't style it**, because session 4 replaces this renderer with the painted one.
- The game screen gets the map geometry from the local game host when the game starts, not by importing it from `@conquerra/content`. (The lobby can still list maps by name.) This keeps blackout fog possible later.

## Part D: two small changes from Nate
1. New attacks start with **"Only if still stronger"** switched on; one tap turns it off. Update the tap count.
2. When you're knocked out: two buttons, **"Watch to the end"** (bots keep playing; you see the full map and each turn's report, with a skip-ahead) and **"See the result"** (today's behavior).

## Out of scope (don't build)
The painted renderer, WebGL, art processing, pan and zoom (session 4); the menu redesign, animated replay, timer, phone layout, installable app and deployment (session 5); random maps in the lobby; blackout fog; anything from M3.

## Tests
- Map maker: the same seed gives byte-identical output; the map checks pass on both test maps; sea lanes and passes come through as the right border types in the engine's graph; decorations never sit in water or on label points.
- Engine: the `sea` border penalty works in combat and in the odds preview.
- Web: the default preset and the knocked-out choice.
- The determinism test still passes.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass.
- Check the GitHub CI result yourself. If the GitHub command-line tool isn't installed and logged in, ask Nate at the start of the session to run `winget install GitHub.cli` and then `gh auth login`.
- Both maps are rebuilt, previewed in `docs/maps/`, and playable to the end of a game in the browser.
- `docs/rules-reference.md` covers water, mountains, passes, sea lanes and choke points in plain language.
- `docs/decisions.md` and `PROGRESS.md` are updated in simple language, with "Claude Code sessions completed" bumped to 3.
- Committed and pushed with clear messages.

## End the session with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the paths to the map previews
- for each map: territories, provinces, choke points, sea lanes, and the sim results
- the new tap count for a typical turn
- anything about the map data the painted renderer (session 4) will need that you weren't sure about
