# Claude Code: Session 20b (M3: Walls, and fair seats on every map)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his browser (the map lab and screenshots) and a deploy. **Run it after session 20** (it builds on 20's leaders and Marshal).

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session:** two things from Nate's play test and session 19's findings. **Walls** is Nate's idea for making culture and building worth going all the way on ("troops still felt like they were worth way more"): max out a territory and it gets a wall; walls join up and share their spare defenders. **Fair seats:** session 19 found that among equal bots the capital spot swings win rates from 0% to 76% on every map; it fixed Embervale at 4 players and built the search tools. Do the rest before friends play online (M4).

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit and push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

The parts are in priority order. **Part 4 ends with the deploy, so the session is complete there.** If time is short, the exposure-aware fairness check in the map maker (Part 3, item 3) is the piece that can slip to a later session; say so.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: "Nate's play test after session 19", the session 20 entry and its review, and "Things to test after session 20"
3. `docs/decisions.md`, the Oct 7 lines at the bottom
4. **`docs/04-design-additions.md` §16 (Walls: the orchestrator's defaults, which Nate can change)**, §7 culture and §10 buildings in `docs/rules-reference.md`, §9 combat (the odds preview and "guaranteed must always win")
5. **`docs/sim-results-m3-balance.md`, "Seat fairness: a finding that touches every map"** and "Pinned for Embervale with 4 players"; `apps/sim/scripts/s19-fair-seats.ts`, `s19-fair-all.ts`, `s19-spots.ts`; `docs/sims/s19-spots*.txt`
6. `docs/07-map-tooling.md` (recipes, `capitals` per table size, the fairness check, making a map official) and `docs/maps/candidates.md`
7. The code: `packages/engine/src/combat.ts`, `preview.ts`, `resolve.ts`, `economy.ts`; the map maker's fairness check; `packages/bots/src/marshal/steward.ts`

## Step 0: sync, and session 20's leftovers
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **Don't import art batch 4** (session 21 does).
3. Session 20 left nothing behind. Two small things from its review:
   - **The offer card warns when a deal would stop a finish:** when a rival your leader is finishing offers a truce (or you propose one), the card says "A truce with Baron Krell would stop Aldric finishing them". Diplomacy stays yours; the leader never refuses for you. A test.
   - **Two harnesses, two numbers:** `s20-marshal.ts` gives all-in delegating (`delegate-100`) 34.6% against Marshals on Embervale 4 and `s19-lines.ts` gives 42.6% (500 games each). Find what differs in how the two set the seat up (the Steward's share on a crowded table? the seed rotation?), make them agree, and note the true number in the write-up. Don't chase the number itself: Nate has decided what to do about it (see `PROGRESS.md`, the review of session 20).
4. **Commit and push.**

## Guardrails (all parts)
- **The hard rules in `CLAUDE.md`:** the engine stays pure and deterministic; every engine change has tests and the determinism test passes; balance values live in `packages/content` (`rules.walls.*`); clients only get `viewFor`.
- **Fair and readable:** "guaranteed" must always win, so the odds preview must know a wall's shared garrison (§16: anyone who can see any part of a wall sees its garrison). Fog is respected everywhere else.
- **Military first, light culture:** Walls is defence only. No gold from walls, no new resource, no new building.
- **Keep the Captain unchanged** (its fingerprint tests; it doesn't build walls) and the Recruit easy.
- **Saves:** migrate if the game's shape changes; the old fixtures keep loading.
- **Every claim gets numbers:** 300 games a line at least (500 for headline lines), seats rotated.

## Part 1: Walls in the engine, and the sims decide the limits
Design: `04-design-additions.md` §16. Build it as written, with every number in `packages/content` (`rules.walls`: `culture` 5, `needsFort` true, `reach` 3, `lendAll` true, `oneBattleATurn` true).
1. **Walled:** a territory with culture 5 and a fort is walled at the end of the turn its last piece finishes. Touching walled territories form one wall (a connected set). A captured, traded or rebelled territory leaves its wall at once (culture drops to 0).
2. **Shared defenders:** when a walled territory is attacked, every other territory in the same wall within `reach` steps lends its spare troops (all but 1) to the defence; each territory lends to one battle a turn (the first attacked in the replay's order); losses fall on the attacked territory first, then the lenders in proportion; Siege engines cut the fort's bonus as today and not the shared defenders. Walls never attack.
3. **The odds preview and `viewFor`:** a wall and its shared garrison are visible to anyone who can see any part of the wall ("Walled: 10 defend"); the preview uses that number; "guaranteed" still always wins (extend the existing guarantee test with walls). Under full fog, no wall is shown.
4. **The sims:** add `--walls on|off` and a `s20b-walls.ts` script. Measure, 500 games a line on Embervale 4, Wyrmland 6 and Rootholm 8 (Marshal tables; the Steward and the Marshal build walls, Part 2, so do Part 2's bot work before the final numbers, or run the sims twice):
   - how many walls get built, by whom and when (turn of the first wall)
   - a seat that walls its core against one that doesn't (win rate)
   - game length and the runaway measures (half the map after turn 10, the halfway leader wins, comebacks) with walls on and off
   - **does a walled runaway become impossible to stop?** (the halfway leader's win rate with walls on, and the share of its land walled)
   - **the limits as one-change tests:** `reach` 2 / 3 / unlimited; lending all spare troops against half; one battle a turn against any number. **Pick the fairest set that still makes walls worth building and record it as "pending Nate's pick"**, with a small table in your summary.
5. **Tests:** walled when and only when complete; walls join and split correctly; the lend rule (Nate's example: three walled territories with 4 troops each, one attacked: the attacker faces 10); one battle a turn; losses shared; the wall falls with the land; Siege leaves the garrison alone; the preview matches the engine; fog (a player who sees no part of the wall sees nothing); determinism; saves migrate.
- **Commit and push.**

## Part 2: Walls on screen, and the bots build them
1. **On the map:** the wall drawn around the outside of the whole walled footprint, in the House's colour, with battlements at Mid and Near (drawn in code for now; an art piece can replace it in a later batch). It reads at every zoom and never hides the troop pill. A remembered wall in the fog is greyed like a remembered building.
2. **The card and the panel:** "Walled: 10 defend (with Pinemark and Ashfell)" on the territory card; before you buy the last piece, the culture and build panels say "Completes a wall". The odds preview shows the shared garrison.
3. **The Steward** (Run the realm, Build up this province) finishes a wall where a territory is nearly there and the land is worth holding (the capital, a choke point, the core of a province it holds); the **Marshal** builds walls in its own style (the Turtle most, the Blitzer least); the Captain doesn't.
4. **Final sim numbers** for Part 1's table, with the bots building.
5. **Tests:** the wall ring follows captures; the card's numbers match the engine; the Steward's wall-finishing fires only where it should.
- **Commit and push.**

## Part 3: fair seats on every map
Session 19 pinned a fairer 4-player layout for Embervale by trying all 43 paper-fair layouts (100 games each). The big maps have tens of thousands of layouts, so:
1. **A smarter search** (`apps/sim/scripts/s20b-fair-seats.ts`): start from the map maker's layout, measure each spot's win rate (300 games, Marshal tables), then swap the strongest and weakest spots for other capital-eligible spots, keep a swap when the spread between spots shrinks, and repeat until it stops improving or a time budget runs out (say 15 minutes a map and table size). Run it for **every official map at its suggested table sizes** (the table in `docs/sim-results-m3-balance.md`, Part 5). Pin each result in the map's recipe (`capitals: {n: [...]}`) and rebuild only that line of the map (as session 19 did for Embervale). Tests that replay fixed games keep the old capitals.
2. **Report the spread before and after** for every map and table size (best and worst spot, fair), 300 games a line.
3. **An exposure-aware fairness check in the map maker** (can slip): besides distance to the nearest rival and gold within 2 steps, score each capital spot's exposure (borders it must hold, rival capitals within 4 steps, land closer to it than to any rival) and require the layout's spots to be within a band of each other. Check it agrees with the sims' spot win rates on the maps you've measured (it should rank the weak spots low).
4. **If a map's best layout is still uneven** (a spot under half of fair after the search), the rule option is **a start bonus for the weaker spots** (a few troops or gold, set in the recipe). Don't build it; list the maps that would need it with numbers for Nate.
5. **Tests:** the pinned layouts load and pass the paper check; the search script is deterministic for a seed.
- **Commit and push.**

## Part 4: write-up, screenshots, deploy
- **`docs/sim-results-m3-walls.md`:** what Walls does in play, the limits table (pending Nate's pick), who builds them and when, length and runaways with walls on and off, the walled-runaway check.
- **`docs/sim-results-m3-balance.md`:** a "Fair seats (session 20b)" section with the before/after spread table, and the maps that would still need a start bonus.
- **Rules reference:** a new §24 Walls, §7 and §10 cross-references, the fair-seats note in §2 (setting up), and "Not in yet".
- **Design additions §16:** a BUILT block. **`docs/07-map-tooling.md` and `docs/maps/candidates.md`:** the search and the pinned layouts.
- **Screenshots** (desktop and a 384 px phone), `docs/art/screens/s20b-*.png`: a single walled territory; a joined wall around five; the card and the odds preview on a walled territory; a remembered wall in the fog.
- `pnpm deploy:preview` passes its lock check.
- **"Things to test after session 20b"** in `PROGRESS.md`, most important first (for example: wall your capital's province on Wyrmland and let a Marshal hit it; does "Walled: N defend" match what happened? Does a wall feel worth 39 gold a territory? Can you still break a walled runaway? Did your starting spot feel fair on a 160 map?). Carry over anything from "after session 20" Nate hasn't tried.
- **Commit and push.**

## Out of scope
- **Session 21:** the polish pass (a painted wall piece can join art batch 5; the code-drawn wall stands until then).
- **Session 22:** the language pass. **M4:** online play.
- Not in this session: walls that give gold or sight, a second building slot, the start bonus (listed, not built), the Recruit's strength (revisit once seats are fair).

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`. **Run the full `pnpm test` twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- Walls in the engine, on screen and in the bots, with the limits table pending Nate's pick; the pinned layouts for every official map at its suggested sizes with the before/after spread; the write-ups, screenshots and `pnpm deploy:preview` with its lock check.
- **"Things to test after session 20b" is complete and ordered.**
- `PROGRESS.md` (with "Claude Code sessions completed" bumped to **20b**, or 21 if you prefer counting it), `docs/decisions.md`, `docs/rules-reference.md`, `docs/04-design-additions.md`, `docs/07-map-tooling.md` and `docs/maps/candidates.md` updated in simple language.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the Walls limits table (reach, lend all or half, one battle a turn), your pick marked, pending Nate's
- who builds walls and when; a walling seat against a non-walling one; length and runaways with walls on and off; the walled-runaway check
- the fair-seats spread before and after, every map and table size; the maps that would still need a start bonus
- whether the exposure check agrees with the sims
- the screenshot paths, and anything that slipped
