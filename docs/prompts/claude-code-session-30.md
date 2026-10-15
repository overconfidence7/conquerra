# Claude Code: Session 30 (M4's close-out, then M5 part one: random maps and blackout fog)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs Wrangler (logged in there), his browser and deploys, and the simulator with its 19 workers.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**M4 (online with friends) is code complete** (sessions 26 to 29); Nate is testing it alone for now. **This session closes M4 from his notes and starts M5 (the public launch) with the two gameplay pieces that need no launch decision: random maps, and the blackout fog option.** The plan is `docs/11-launch-plan.md` (§5 and §6) and `docs/07-map-tooling.md` (the stage split). Sign-in, the purchase and tutorials are later sessions: don't start them.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit, run the deploy (where the part says so), push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

**The parts are in priority order; Parts 1 to 3 each end with a deploy,** so the session is complete at any of those boundaries. Whatever isn't reached becomes session 30b; say what's left. Nate may be playing the preview while you work, so every deploy must be a working build, and **a game already running on the server must survive a deploy** (a map's geometry is never stored with a game; a random map is rebuilt from its seed and recipe at a pinned generator version).

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: "Oct 15: Orchestrator review of session 29" (the nits for Step 0), and **every "Nate's play test" entry after session 29** (his solo notes: they outrank anything below)
3. **`docs/11-launch-plan.md`** (§1 what 1.0 is, §2 the order, §5 random maps, §6 blackout fog, "Nate's calls"), **`docs/07-map-tooling.md`** (the pipeline, the stage split, the guardrails)
4. `docs/04-design-additions.md` §9 (maps: real geography, blackout fog), §8 (fog and spies), `docs/06-art-direction.md` (standard fog is mist, blackout is thick painted clouds), `docs/maps/candidates.md` (how the twelve were chosen), `docs/sim-results-m3-balance.md` ("The seat rule")
5. `docs/decisions.md`, the Oct 14 to 15 lines at the bottom
6. `docs/rules-reference.md` ("Maps", "Fog", the lobby)
7. The code: `packages/mapgen/src/` (`index.ts`: `generateMap`, `MAPGEN_VERSION`; `recipes.ts`: `recipeFor`, `SIZES`; `configs.ts`: the twelve maps' recipes, `startBonus` and `capitals`; `checks.ts`: `checkMap`, `fairness`, `exposureOf`; `shapes.ts`, `masks.ts`; `names`), `apps/web/src/lab/maps/MapLab.tsx` (the map lab makes a map from a recipe already), `packages/engine/src/setup.ts` (the seat rule, `seatRule: "botsFirst"`), `view.ts` and `vision.ts` (`fogged`, "last seen"), `apps/web/src/map/` (the renderer, the fog mist), `apps/web/server/maps.json` and `pnpm server-maps` (the slim maps), `apps/web/src/host/roomCore.ts` (`loadMap`), `apps/web/src/ui/Lobby.tsx` and `LobbyFolds.tsx` (Map and Rules), `apps/sim/src/cli.ts` (`--map`), `apps/web/test/fog-wire.test.ts`

## Step 0: sync and the fixes from the review
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **A lapsed offer in a bot's chat:** the bot's note stays with nothing to say the offer is gone. Mark it ("(lapsed at lock-in)" under the note, quiet style), and the same for a person's.
3. **The Finished list:** Nate's holds about a dozen test games. Hide bot-only games (no other person at the table) older than a day, and add "Clear finished" (hides the rest for you; the games stay on the server).
4. **The Worker's cold start** (10 to 16 ms against the Free plan's 10 on a first request): find what the Worker loads at start-up that the API doesn't need on every request (the slim maps' JSON is the likely one: 253 KB parsed at import), load it lazily or only in the room, and measure a cold request before and after (`wrangler tail` after a deploy; report both).
5. **Nate's solo notes after 29** in `PROGRESS.md`: do the small ones here; the bigger ones are Part 1.
6. **Commit and push.** (Run the full `pnpm test` before this and every push.)

## Guardrails (all parts)
- **The map maker stays pure and seeded** (same seed and recipe, same map, at the same `MAPGEN_VERSION`); the renderer reads only geometry; every map passes `checkMap` before it's used (`docs/07-map-tooling.md`).
- **The wire never carries map geometry:** an online game on a random map carries the seed, the recipe and the generator version; every page and the room build the map themselves. Extend `fog-wire.test.ts` to a table on a random map and keep it passing.
- **Balance values live in `packages/content`;** the engine's fog stays in the engine; blackout is a rules option, off by default; **the existing maps and the existing fog play exactly as before** (the same seeded sims before and after on the twelve maps; the fingerprint tests unchanged).
- **The seat rule** deals harder spots to bots first on random maps too, from `fairness` (no hand-tuned `startBonus` on a random map: say in the summary whether the sims want one, with numbers, for the orchestrator).
- **Single player first:** random maps and blackout work offline; the start-up bundle **gets a new allowance: within 2 KB of 497.1 KB** (the map maker loads with the lobby's Map fold or the game, not at start-up; say where it landed).
- **Every line a player reads** follows `docs/voice-guide.md` (the voice test).

## Part 1: M4's close-out (deploy if anything changed)
1. **Nate's solo play-test notes** from "Things to test after session 28" and "after session 29": the online ones first, then the rest, in the order he wrote them; each a small commit. If there are none in `PROGRESS.md`, say so and go on.
2. **"M4 as built"** in `docs/10-online-plan.md` §9 gets a last line with what Nate's test changed. **Deploy if anything changed. Commit and push.**

## Part 2: random maps in single player (the second deploy)
1. **The stage split:** `generateMap` runs in stages, each with its own random stream made from the seed plus the stage's name (land and height, water and ranges, rivers, territories, provinces, capitals, ground, places, names, checks), as `docs/07-map-tooling.md` describes. **The twelve official maps come out identical** (a test compares each map's `mapFingerprint` before and after the split: re-pin nothing; if a map changes, the split is wrong). `MAPGEN_VERSION` stays 2 unless the output changes, in which case say why.
2. **A random recipe:** `randomRecipe(size, shape, seed)` picks the knobs the way the twelve were tuned (`configs.ts`: provinces, lakes, ranges, lanes, rivers, choke points, roughness by size and shape), with `SIZES` 40, 80, 120, 200 and the shapes the maker has (`LAND_SHAPES` and the masks: island, archipelago, twin continents, crescent, inland sea; the picture masks like the dragon stay official-only). **Checks and rerolls:** `checkMap` plus `fairness` (the capitals' spread within what the twelve show) at generation; up to five rerolls of the seed's suffix; then a plain line ("That seed didn't make a fair map. Try another.").
3. **The seed as words:** a seed shows as two words ("quiet-heron") from a short list (about 300 words, in the content package) so anyone can type it; the recipe's size and shape are part of the id ("80-crescent-quiet-heron"); the same id always makes the same map at the same version.
4. **The lobby:** "Random map" at the end of Change map: size, shape, the seed (shown; Reroll; a box to type one), a thumbnail from `mapPreviewSvg`; the Opponents dropdown's counts follow the size. The map fold's description line says what you get ("80 territories, a crescent, seed quiet-heron"). Saves and Continue carry the recipe (a save stores the id and the version and rebuilds the map; a save made at an older generator version says so plainly).
5. **The painting:** the renderer paints it as it paints the twelve (names from the maker's lists; a generated Far picture; the House colours as usual). Look at ten random maps at each size in the map lab and fix what looks wrong (a label on water, a capital on an island with no lane, a range cutting a province) in the maker, not the renderer.
6. **The sim:** `--map random:<id>` and `--random <size>:<shape>:<n>` (n seeds in a row). Run **100 random maps a size** (4 players at 40 and 80, 6 at 120, 8 at 200), one game each, all Marshals, in the background with the workers, and report win rates by seat against fair (±5 is the bar from the seat rule's write-up) and the average turns to a win. If a size misses the bar, say what the fairness check should tighten (the orchestrator decides).
7. **Tests:** the twelve unchanged, the stage streams independent (changing the names' seed changes no border), a recipe's id round-trips, rerolls stop at five, the seat rule on a random map, a save that rebuilds. **Deploy. Commit and push.** Screenshots: the Random map fold, three random maps at Far (40, 80, 200), one at Near.

## Part 3: random maps online (the third deploy)
1. **A table on a random map:** the table keeps the map id (the recipe and the version), the room builds its slim map from it (`loadMap` for `random:` ids; never stored in D1 beyond the id), every page builds its own from the same id and checks the version (as the twelve's `mapVersion` works now). The lists show "Random, 80 territories" with the seed.
2. **The fog test** on a random map (three people, a dozen turns): every message is still only `viewFor`; the start carries the id and the version, never geometry.
3. **A deploy mid-game** on a random map: the game survives (the version pin), with a test.
4. **Deploy. Commit and push.** Check live: a table on a random 80 with bots, three turns, close and reopen the tab.

## Part 4 (can slip to 30b): the blackout fog option
1. **The rule:** `settings.fog: "blackout"` beside on and off (the content's schema; the lobby's Rules fold says "Blackout: the map is hidden until you explore it"). In `viewFor`, a territory nobody of yours has ever seen is `unknown` (no terrain, no name, no owner, no borders); once seen it behaves as standard fog ("last seen"). Seen means adjacent to your land, in a scout's, watchtower's or spy's sight, or crossed by your army, as fog works now. The bots play from their own views as always (no change to their code; they see less).
2. **The look:** `unknown` paints as thick painted clouds over the sea colour (the art direction), no labels, no borders; the minimap the same; the Far picture shows only what's known. Effects never carry game state.
3. **The sim:** `--fog blackout`; 300 games all-Marshal on Embervale 4 and Wyrmland 6 against standard fog: games must still end in 30 to 40 turns and the seat rule's win rates stay within the bar; if the bots stall (they can't find anyone), say so with the numbers rather than changing the bots this session.
4. **Tests:** `unknown` never carries a name or terrain, a seen territory stays seen, the determinism test, the fog test online with blackout on, the fingerprints unchanged with blackout off. **Deploy. Commit and push.** Screenshots: a blackout game at turn 1 and turn 8.

## Last: the write-up, the test list
- `docs/07-map-tooling.md`: a BUILT block (the stages, the random recipe, the id, the checks and rerolls, the sim's numbers). `docs/11-launch-plan.md`: BUILT lines under §5 and §6. `docs/rules-reference.md` ("Maps": random maps and the seed; "Fog": blackout). `docs/decisions.md`: one line per decision. `docs/sim-results-m5-random-maps.md`: the numbers.
- **"Things to test after session 30"** in `PROGRESS.md`, most important first (a random map at each size in single player; the seed typed on the phone; a random map online; blackout at turn 1; what Nate's notes changed). Carry over what he hasn't tried.
- `PROGRESS.md` (sessions completed: 30), `docs/decisions.md`.
- **Commit and push.**

## Out of scope (sessions 31 and after)
- Tutorials and the first game (31); sign-in and Workers Paid (32); the purchase and the site (33); bigger tables, the map lab off, abuse limits (34); the player map builder (M6).

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass; everything is committed and pushed to `main`. **Run the full `pnpm test` before every push and twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- The twelve maps' fingerprints unchanged; the same seeded sims before and after on the twelve; the fog test passes on a random map; the start-up bundle within 2 KB of 497.1 KB; the lock check passes on every deploy.
- A random map has been played in single player and on the preview; the 100-maps-a-size sim is in the write-up with its numbers.
- Every deploy a working build with running games surviving it; the docs and the test list above.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which parts were finished and which slipped (for 30b)
- what Nate's notes changed (one line each)
- the stage split in one paragraph (what proves the twelve are unchanged), the random recipe and the id's shape
- the random-map sim: win rates by seat against fair at each size, average turns; whether a start bonus is wanted
- blackout: how `unknown` is kept out of the wire, and the sim's turns and win rates against standard fog
- the Worker's cold start before and after, CPU per turn in the room, the start-up bundle
- the deployed version
