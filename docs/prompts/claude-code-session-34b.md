# Claude Code: Session 34b (M5 part seven: balance for the big tables: the 200s' layouts by the simulator, 20 seats with a looser band, the Merchant and the Blitzer under blackout)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs the simulator with its 19 workers (the sims are the session), Wrangler (logged in there), his browser and deploys.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session is balance, decided by numbers; no new feature.** Session 34 found three things (`docs/sim-results-m5-scale.md`, `docs/sim-results-m5-blackout.md`), and Nate's calls (Oct 20) are:
1. **The official 200s' capital layouts are uneven at every table size**, their own 10-seat ones too: on Krakenmere at 10 one spot wins 50% of games among equal Marshals (fair 10%), on Rootholm 10 one wins 28%, on Krakenmere 12 one 41%, on Rootholm 20 one 16% (fair 5%). The smaller maps had this pass in session 20b (a search with the simulator from each map's own capital spots) and session 23 (a start bonus on the weak spots). **Do the same for the 200s at 8 to 20 seats.**
2. **The big tables go to 20 seats:** the random 400s (and 300s where the seeds allow) to 20, and Krakenmere as far as its castle spots allow, **with a looser fairness band above 12 seats** (the 5.5 of version 2, or whatever the seeds need). **The rule that the less fair spots go to bots first stays, and is said nowhere in the game** (no lobby line, no card, no rules text: it's something we do in the background).
3. **The Merchant and the Blitzer under blackout** are past the 5-point bar in the dealt measure since the Turtle's fix (the Merchant 22.9% against 30.6% with standard fog, the Blitzer 34.6% against 28.0%). Tune them the same way, in their `blackout` blocks.

**Every balance value lives in `packages/content`**; standard-fog games on the twelve official maps at their **4-player** tables stay byte for byte the same (the digest); a layout change at 8 to 20 seats on the 200s changes those games on purpose, with Nate's say-so given here, and any pinned fingerprint that covers them is re-pinned in the same commit with the reason. Every claim comes with the sim that shows it. Launch polish is session 35: don't start it.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit, run the deploy (where the part says so), push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

**The parts are in priority order; Parts 1 and 2 each end with a deploy,** so the session is complete at either boundary. Whatever isn't reached goes to the next session; say what's left. Nate may be playing the preview while you work, so every deploy must be a working build, and **a game already running on the server must survive a deploy** (a game pins its map's version and its layout: a running game keeps its spots). Long sims run in the background (19 workers) while you go on.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: "Oct 20: Orchestrator review of session 34" (Nate's calls), and **every "Nate's play test" entry after session 34** (his solo notes outrank anything below)
3. **`docs/sim-results-m5-scale.md`** (session 34: by spot on the 200s, the turns, the CPU, the seeds that pass at 12, 16 and 20), **`docs/sim-results-m3-balance.md`** ("The seat rule", session 20b's layout search and its table, session 23's start bonus: how the smaller maps were done and what the bars were), `docs/sim-results-m5-random-maps.md` (33b: the band, the grade, the income head start), `docs/sim-results-m5-blackout.md` (33, 34: the personalities' blocks and the dealt measure)
4. `docs/07-map-tooling.md` (layouts, the paper check, the exposure band, `s20b-fair-seats.ts`), `docs/04-design-additions.md` §9 and §11, `docs/11-launch-plan.md` §2 (the 34b row) and §8
5. `docs/decisions.md`, the Oct 20 lines at the bottom
6. The code: `packages/content/data/maps/big-tables.json` and `src/bigTables.ts` (session 34's layouts beside the map files), `krakenmere.json` and `rootholm.json` (`capitalSlots`, `capitalLayouts` with their `bonus`), `packages/mapgen/src/capitals.ts` (the layout search, `exposureOf`, the band), `checks.ts`, `random.ts` and `randomId.ts` (`RANDOM_PLAYERS`, version 6's big-table recipe), `seed.ts` (`RANDOM_VERSIONS`), `packages/content/data/random-maps.json`, `packages/engine/src/setup.ts` (the seat rule, `bonus`), `apps/sim/scripts/s20b-fair-seats.ts` and `s20b-pin-seats.ts` (the search and the pin), `s23-bonus.ts` and `s23-apply-bonus.ts` (the start bonus by spot), `s30-sims.ts` (by spot or by exposure, CPU per turn), `apps/sim/src/tournament.ts` (`--tweak`, the dealt measure), `packages/content/data/personalities.json` (the `blackout` blocks), `packages/bots/src/marshal/plan.ts` (`forFog`)

## Step 0: sync
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **Nate's solo notes after 34** in `PROGRESS.md`: do the small ones here; list the rest for the orchestrator.
3. **The start-up bundle sits at 396.7 KB against 400.0.** Nothing here belongs in the start-up code; the allowance stays **400.0 KB**.
4. **Commit and push** (no deploy needed for Step 0 alone unless a note's fix wants one).

## Guardrails (all parts)
- **The twelve maps' 4-player standard-fog games are byte for byte the same:** the `--digest 4 20 --seed s30d` run gives `dc8962d4f8ba3bc6` after every part. **The Captain fingerprint** `232617a30b1f8b47` and the seeded sim (`pnpm sim --games 40 --players 6 --map wyrmland --bots marshal --seed o34b`) are the same unless Part 1's layouts cover a table they play; if they do, re-pin in the same commit and say which tables moved and why (the reason is Part 1 itself).
- **A layout is pinned only when it's fairer on fresh games** (session 20b's rule): the search's games and the proof's games are different seeds.
- **A running game keeps its layout:** the pin is a new layout version beside the old one (as `big-tables.json` already sits beside the maps), and a game records which it used.
- **Balance values in `packages/content`** (the layouts, the bonuses, the band by table size, the personalities' blocks), with Zod schemas; the content-equals-its-schema test keeps passing.
- **Bots never cheat** (`apps/sim/test/blackout-honest.test.ts` keeps passing), and **the seat rule is unsaid**: nothing new a player reads anywhere in this session except the lobby's seat counts.

## Part 1: the 200s' layouts, chosen with the simulator (the first deploy)
1. **Tables:** Rootholm at 8, 10, 12, 16 and 20; Krakenmere at 8, 10, 12 and 13 (and higher in Part 2). For each: start from the map's current layout (its own for 8 and 10, session 34's for the rest), measure every spot's share of wins (all Marshals with personalities dealt, 300 games a layout, the same game seeds for every layout, `s20b-fair-seats.ts` or its heir), and search as session 20b did: move the most uneven spots (one at a time, then two) to other capital spots that pass the paper check and the exposure band, keep a move when the gap between the best and the worst spot shrinks, within a budget (say 10 layouts a table; about an hour a table on 19 workers at 200 territories, so run the tables in parallel and in the background from the start). Then the map's own layout and the best one on **fresh games (300 each)**; **pin the best only where it's at least 5 points fairer** (the gap between the best and the worst spot).
2. **The start bonus by spot** on the pinned layout (session 23's way, `s23-bonus.ts`): +2 to +6 on the spots under half of fair until they're within reach, measured on fresh games; the seat rule deals those spots to bots first as now.
3. **The bars, read beside each other:** the best spot's share **under 2 × fair** and the worst **above half of fair** on fresh games; if a table can't reach that from the map's own spots, ship the fairest found and say so with the numbers (the spots are what they are: session 20b's finding). Turns and CPU per turn don't move (say they didn't).
4. **Write-up:** `docs/sim-results-m5-scale.md` gains "Session 34b: the 200s' layouts" (before and after by spot, each table, what was pinned, the bonuses); `docs/07-map-tooling.md` (where the layouts live now, how to re-run); `docs/decisions.md`. **Tests:** each pinned layout builds the same spots (a pin), the old layouts still build (a running game), the bonus applies on turn 1, the seat rule with the new spots. **Deploy. Commit and push.**

## Part 2: 20 seats with a looser band (the second deploy)
1. **Random maps, version 7:** `RANDOM_PLAYERS` to 20 on the 400s and, where the seeds allow, the 300s; **above 12 seats the exposure band loosens** (content: a band by table size: 4.0 to 12 seats, 5.5 above, or whatever the seeds need: measure with `packages/mapgen/scripts/try-random.ts` at 16 and 20 on both sizes and every shape; the bar for the band: **at least seven in ten seeds pass at 20** on the 400, the archipelago allowed to stay capped at its own number if it can't). The grade and the income head start as in versions 5 and 6 (the most exposed spots get the most). The lobby's seat count follows; **nothing is said about fairness or the seat rule anywhere** (the random-map card keeps its one line on the head start).
2. **Krakenmere as far as its castle spots allow** with the looser band (session 34: at 14 one spot was 5.7 times as exposed as the safest, and from 18 two capitals touch, which is the hard stop): the layouts found as in Part 1 (the search, fresh games, the bonus), pinned beside the others; say the new maximum (17, if the touching pairs are the only limit) and the lobby follows.
3. **The sims:** `s30-sims.ts --random 400:all:50 20 --seed s34b` (and 300 at 20 if it ships): by exposure against fair (fair 5%; say the furthest rank's share of fair, since ±5 is a wide bar at 20), the harder spots' wins (the seat rule's bots), turns (average, within 40, within 60), the explore pace under blackout, and **CPU per turn with 20 Marshals on a 400** (the session 34 number at 16 was 4.42 s at the worst turn against the 5 s bar: **if 20 goes over 5 s, say so and stop at the seat count that stays under**; the room's limit is 30 s, the bar is ours). Krakenmere at its new maximum the same (`pnpm sim --players N --map krakenmere`).
4. **Live:** a 20-seat table with bots on a random 400 on the preview in Nate's Chrome (the table screen, turn 1's time, the first turn played, the room's CPU from `wrangler tail`: session 34 saw 17.8 s of CPU making a 16-seat 400's table against 30 s, so **measure the table's making at 20 and, if it's over 22 s, say so**: the next lever is a smaller layout search in the room, which already builds the try it's told); then Resign.
5. **Write-up:** `docs/sim-results-m5-scale.md` gains "Session 34b: 20 seats" (the seeds at each band, the tables, the CPU); `docs/sim-results-m5-random-maps.md` (version 7 in a line); `docs/11-launch-plan.md` §8 a BUILT line; `docs/04-design-additions.md` §9; `docs/decisions.md`. **Tests:** version 7 pinned (one cheap seed a size), versions 2 to 6 still build theirs, the band by table size, the seat counts in the lobby and the Worker's bots line. **Deploy. Commit and push.**

## Part 3 (can slip): the Merchant and the Blitzer under blackout
1. The dealt measure (`tournament.ts --table embervale:4 --seats marshal,marshal,marshal,marshal --games 900 --fog blackout|on --seed s34b`), every personality's number under both, before any change (session 34's table is the start: the Merchant 7.7 apart, the Blitzer 6.6).
2. **One knob each, three settings at most, in their `blackout` blocks** (`personalities.json`; read in `forFog`, nothing scattered): the Merchant builds under blackout like the Turtle now does, or spends more of its purse on troops early (it's the builder the Turtle presses earlier); the Blitzer pauses its chains at the cloud's edge or scouts less (it never pauses a chain, and the cloud rewards whoever reaches it first). **The bar: each within 5 points of its standard number in the dealt measure, and the Turtle stays inside its 3.5** (the knobs interact: re-read all six after each try). Nothing changes with standard fog (the fingerprint and the digest say so).
3. **Write-up:** `docs/sim-results-m5-blackout.md` gains "Session 34b: the Merchant and the Blitzer" (the table before and after, the shipped values); `docs/decisions.md`. **Tests:** the overrides apply only under blackout. **Commit and push** (a deploy if Part 2's isn't the last code).

## Last: the test list
- **"Things to test after session 34b"** in `PROGRESS.md`, most important first: a game on Krakenmere at 10 from the lobby (does the table feel fairer? which spot did you get?); a 20-seat table with bots on a random 400 on the phone (the build, turn 1, the Houses panel); a blackout game with the personalities shown against a Merchant and a Blitzer; carry over what Nate hasn't tried.
- `PROGRESS.md` (sessions completed: 34b), `docs/decisions.md`.
- **Commit and push.**

## Out of scope (sessions 35 and after)
- Launch polish (35): the desktop's Houses panel folding past ten rows so the Leaders panel keeps its place, the phone's Houses panel over the watcher's box, a 400 at Far as a wall of pills, the install flow, the open-graph preview, the voice pass, the load test; sign-in and Workers Paid (36); the purchase and the site (37); battle royale (38); the random 80's layout rule (after the friends' play test, Nate's call).

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass; everything is committed and pushed to `main`. **Run the full `pnpm test` before every push and twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- The digest `dc8962d4f8ba3bc6` after every part; the Captain fingerprint and the seeded sim unchanged, or re-pinned in the same commit with the tables that moved named.
- The by-spot tables for the 200s before and after on fresh games; the seeds at each band at 16 and 20; the CPU per turn with 20 Marshals on a 400; the dealt table under blackout before and after (Part 3).
- The start-up bundle within the allowance (400.0 KB); the lock check passes on every deploy; running games survive each deploy (a game keeps its layout).
- Played on the preview in Nate's Chrome: a 20-seat table with bots on a random 400 (the table's making time from `wrangler tail`, turn 1, a screenshot), resigned.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which parts were finished and which slipped
- Step 0: what Nate's notes changed (one line each)
- the by-spot table for each 200-map table: before and after, pinned or kept, the bonuses
- the seeds that pass at 16 and 20 at each band, the shipped band, Krakenmere's new maximum
- the CPU per turn at 20 Marshals on a 400 and the table's making time live
- the dealt table under blackout (Part 3), if reached
- the digest, the fingerprint and the seeded sim: unchanged, or exactly what was re-pinned and why
- the deployed version
