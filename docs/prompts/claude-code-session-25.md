# Claude Code: Session 25 (M3: bots and balance, part two: walls that pay back, and the seat rule)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It runs long sims (19 workers), takes screenshots and deploys.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session is the last two balance items of M3, both Nate's calls (Oct 11):**
1. **Walls must pay back the investment.** A wall costs about 39 gold a territory (culture 5 and a fort). Today it lends its spare troops to every attack, but bot walls fall 19 times in 20 because they're thinly held, and Nate wants a wall to be "a good strategic option". His design: **a stacking defense bonus**, every territory connected in a wall adding to the defence of each of its territories. The orchestrator's worry: an uncapped stack on a big wall a person has stocked with troops could be untakeable, and the Turtle Marshal is already the strongest personality. **So: build it with a cap, size it with the sims against stop rules, and ship the setting that passes.**
2. **The seat rule.** A weak capital spot (the ones with a start bonus) goes to a bot before a person. The start bonus stays and still shows.

**Nate is playing his test list alongside this session** ("Things to test after session 24" in `PROGRESS.md`). If `PROGRESS.md` has an entry "Nate's play test after session 24" when you start or when you pull, read it first: his notes on walls and weak spots outrank the defaults below. If it isn't there, use the defaults and say so in the summary.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit, run the deploy (where the part says so), push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

**The parts are in priority order; Parts 2 and 3 end with a deploy,** so the session is complete at either boundary. Whatever isn't reached becomes session 25b; say what's left. Nate may be playing the preview while you work, so every deploy must be a working build.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: "Oct 11: Orchestrator review of session 23" and "... of session 24", and any "Nate's play test after session 24" entry
3. `docs/04-design-additions.md` §16 (Walls), especially the last block "Walls that pay back, and weak spots go to bots first"
4. `docs/decisions.md`, the Oct 10 to 11 lines at the bottom (Nate's calls after 23; "The start bonus, as built")
5. `docs/sim-results-m3-walls.md` (why walls fall today: thin garrisons, attackers that wait until they're big enough), `docs/sim-results-m3-balance.md` ("Fair seats (session 20b)" and "The start bonus (session 23)"), `docs/sim-results-m3-leaders.md` ("Session 23": the delegating seat's numbers, the Steward's plan tried for the Marshal)
6. The code: `packages/engine/src/walls.ts` and `combat.ts` (the defence multipliers: `fortMult`, `cultureDefense`), `resolve.ts` (`wallLend`, `expect`), `preview.ts` (the odds preview must count whatever the engine counts), `setup.ts` (`pickCapitals`, the seat shuffle, `startBonus`), `packages/content/data/rules.json` (`walls`, `buildings.fort`), `packages/content/src/schemas.ts` (the walls rules), the bots' attack judgement (where the Marshal and the Captain count a wall's garrison before attacking), `apps/sim/scripts/s20d-walls.ts`, `s23-tables.ts`, `s18-variant.ts`, `apps/web/src/host/localGame.ts` and `apps/web/src/ui/Lobby.tsx` (how a new game is set up)

## Step 0: sync and the small fixes from the review
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **A sound credit:** the wind recording's page asks to be credited as "Bashar from Skirmish.io", not "Bashar3A". Change the author in `packages/sound/data/credits.json`, re-run `pnpm sound:import` (or whatever rewrites `docs/sound/credits.md` from it), and check Settings → Credits.
3. **Settings on the phone is a long scroll now.** Fold the three volume sliders under the Sound row: tap the row to open them (closed by default; Mute stays visible). No change on the desktop if it fits there; keep the tap count for the common case (Mute: 2 taps).
4. **Commit and push.** (Run the full `pnpm test` before this and every push.)

## Guardrails (all parts)
- **Engine rules:** `packages/engine` stays pure and deterministic; the determinism test passes; every balance number lives in `packages/content` (`rules.json` with its Zod schema), never in code.
- **"Guaranteed" always wins:** whatever the engine counts, the odds preview counts. The guarantee property test must cover the wall bonus (extend it).
- **Fair and readable:** anyone who sees part of a wall already sees all of it and its garrison (`view.walls`); the bonus is part of that. The card, the side panel and the attack panel say it in plain words. No new resource, no new control in the game screen.
- **Saves:** new rule fields are optional and default to "off" (0), so an old save's rules keep playing as they were; bump the state version only if you must. the saved-game tests (`packages/engine/test/saves.test.ts`) and the mop-up fixtures (`packages/bots/test/fixtures/mopup/`) must still pass unchanged; if Nate has put a save in `docs/sims/nate-games/` by then, `pnpm sim --replay` of it must match its recorded history.
- **Pinned tests:** the Captain's fingerprint (`232617a30b1f8b47`) and any other pinned test change when behaviour changes: **re-pin in the same commit** as the change, and say which commit.
- **Sims run in the background** on this machine (19 workers) while you keep working. 300 games a table; report the seed. **Every number you report comes from a run you did this session;** paste the raw output into `docs/sims/s25-*.txt`.
- **Bots judge from their own view only** (fog respected), and they count the bonus the way the preview does.

## Part 1: the wall bonus, as a rule (off by default until Part 2 sizes it)
1. **The rule**, in `rules.json` under `walls`: `stackPerTerritory` (default 0.10) and `stackMax` (default 0.40; `null` means uncapped), both optional (missing = 0, no bonus). **What it does:** a walled territory defends at `× (1 + min(stackMax, stackPerTerritory × (wall size − 1)))`, where the wall size is the number of connected walled territories of that House (the same connectivity `walls.ts` uses for lending). One territory alone gets nothing; five or more get the cap. On top of the fort's ×1.6 and culture 5's ×1.3, and the shared defenders. **Orchestrator defaults, which the sims can change:** Siege cuts the fort's bonus only (the wall bonus stands: it's the prize for going all the way); the bonus applies to every attack on the wall in a turn, with the losses as today.
2. **Where it goes:** `combat.ts` takes the wall size (or the multiplier) as one more field, like `culture`; `resolve.ts` fills it from the wall; `preview.ts` the same; the bots' expectation goes through the same `expect`, so they count it without new code (check that they do).
3. **On screen:** the "Walled" line on the card, the side panel and the attack panel gets the bonus in words: "Walled: 10 defend (with Pinemark and Ashfell), +20% for 3 walled". The odds preview counts it. The culture and fort buttons' "Completes a wall" can add "(+10% for each walled neighbour)" once, where it fits; don't bloat the card.
4. **Tests:** the multiplier for walls of 1, 2, 3, 5 and 8 territories, capped and uncapped; the preview matches the engine; the guarantee property test with walls of several sizes; losses unchanged; an older save (the fields missing from its rules) gets no bonus, and the saved-game tests pass unchanged.
5. **A sim script** `apps/sim/scripts/s25-walls.ts` that takes `--rules walls.stackPerTerritory=0.1,walls.stackMax=0.4` (reuse the CLI's `--rules` parsing) and reports, per table: **(a) the payback:** a delegating seat whose Steward walls (`+walls39`, as `s20d-walls.ts` / session 20b measured it) against one that never walls (`+nowalls`), at a table of Marshals: win rates; **(b)** walls built a game, walled territory-turns holding more than 1 troop, attacks on walls a game and the share the wall **held**; **(c)** game length and the halfway leader's win rate at an all-Marshal table; **(d)** each personality's win rate at an all-Marshal table (the Turtle above all); **(e)** the delegating seat (Leader 80 / Steward 20) × fair. (c) to (e) exist in `s23-tables.ts`: call into the same code rather than copying it.
6. With the defaults **off** (0), run the baseline on Embervale 4, Wyrmland 6 and Rootholm 8 (300 games each, your seed) and keep the output: this is "before". The all-bot games must be identical to session 23's at the same seed (the rule is off), so the fingerprint doesn't change yet.
7. **Commit and push** (no deploy: nothing changes for the player yet).

## Part 2: size it with the sims, then ship it (the first deploy)
1. **The sweep,** the same three tables and seed, 300 games each, in the background:
   - A: `0.05` capped at `0.20`
   - B: `0.10` capped at `0.40` (the orchestrator's pick to beat)
   - C: `0.10` uncapped (Nate's design as stated; the comparison)
   - D: `0.15` capped at `0.60`
   Run B first so you can keep working on Part 3 while the rest run.
2. **The stop rules.** A setting passes when, on every table: all-Marshal games are **no more than 2 turns longer** than "before" (about 23 / 41 / 44 today); **no personality is above 2.0 × fair** and the Turtle is not up by more than 0.25 over "before" (1.74 on Wyrmland 6 today); the delegating seat stays **within 0.85 to 1.2 × fair** or no worse than "before"; the halfway leader's win rate is not up more than 5 points. **The payback it has to show:** the walling seat's edge over the non-walling seat grows (session 20b: 29.6 against 26.0 on Embervale, 19.0 against 15.4 on Wyrmland), and walls hold a larger share of the attacks on them (about 1 in 20 today). 300 games is about ±2.5 points, so call a difference inside that "noise".
3. **Pick the strongest setting that passes** (prefer B; take A if B fails; take D only if B passes with room and the payback is still small). If nothing passes, ship nothing and bring Nate the table. If C (uncapped) passes everywhere too, say so: Nate decides whether he wants the cap at all.
4. **Then the bots' habits with it on,** briefly: do the Marshals wall in the right places (the Turtle, the Merchant after its markets), do your Steward's walls come sooner or bigger, and do the bots now keep more than 1 troop inside a wall (the `wallGarrison` your Leader keeps is 4; if a wall now pays, a Marshal keeping a small reserve inside one is a one-number change, worth one run, not a redesign). Any change here is measured against the same stop rules.
5. Set the picked numbers as the defaults in `rules.json`, **re-pin the fingerprints in the same commit**, run the full `pnpm test` twice, and write the run-by-run table into `docs/sim-results-m3-walls.md` under a new heading "Walls that pay back (session 25)".
6. **Deploy** (`pnpm deploy:preview`, with its lock check). **Commit and push.**

## Part 3: the seat rule (the second deploy)
1. **Who is a person:** `NewGameOptions.players[]` gets `bot?: boolean` (people are the default); `localGame.ts` marks its bot seats; the sims mark every seat a bot **except** the delegating seat, which stands in for a person (`seatRule` on the tournament spec, so both ways can be measured).
2. **The rule, in `createGame`:** after the seeded shuffle of seats, if the map's layout for this table size has weak spots (the slots with a start bonus), deal those slots to bot seats first, people last, keeping the shuffle's order otherwise. **A table of bots only is dealt exactly as before** (a test: the same seed, the same capitals, so the all-bot sims and the fingerprint don't move). If there are more weak spots than bots, the people left over get the weak spots with their head start, as today.
3. **"Used only when every other spot is taken":** today every pinned layout has exactly as many spots as players, so this half of the rule is already true by construction; say so in the write-up, and leave a note for the map maker (M5, random maps) and for tables that spread capitals without a pinned layout (no weak marking there).
4. **The lobby:** one row under the advanced options, "Harder spots: bots first (default) / anyone", so Nate can still test a weak spot himself. The game's setup carries the choice (saves replay as they were played).
5. **Measure the delegating seat both ways** on the six tables of session 23 (Embervale 4, Wyrmland 6, Rootholm 8, Moon Coast 6, Crownlands 8, Ashwing 7; seed s23p2b and your own), with the Part 2 wall bonus on: random spots as before, and with the seat rule. Report both; the "before" numbers in `docs/sim-results-m3-leaders.md` stay comparable through the random-spot run.
6. **Tests:** the dealing (weak slots to bots first, the bot-only table unchanged, more weak spots than bots, a layout with no weak spots), the lobby's choice in the setup, a save that replays.
7. Screenshots: the card's "Walled" line with the bonus (desktop and phone), the attack panel's odds at a walled target, the lobby row.
8. **Deploy. Commit and push.**

## Part 4 (can slip to 25b): the Steward's plan for the Marshal, re-tested with the bonus
Session 23 tried the Steward's plan for the Marshal six ways and left it off (weaker Marshals, longer games, every personality a waller). With a wall that pays, try **the one best setting from session 23** (`judgement.realmPlan`, the variant that came closest) on Wyrmland 6 and Rootholm 8, 300 games, against the same stop rules and Nate's rule that **the Marshal must be at least as good as your leaders**. Adopt it only if it passes everywhere; otherwise leave it off and record the numbers. **Commit and push** (deploy if it's adopted).

## Last: the write-up, the test list
- `docs/sim-results-m3-walls.md` ("Walls that pay back (session 25)": the sweep table, the setting shipped and why, the bots' habits), `docs/sim-results-m3-balance.md` ("The seat rule (session 25)": the delegating seat both ways), `docs/sim-results-m3-leaders.md` if Part 4 ran.
- `docs/04-design-additions.md` §16: a BUILT block for session 25. `docs/rules-reference.md`: walls (the bonus, one or two sentences) and the lobby row. `docs/decisions.md`: one line per decision (the setting, siege, the seat rule's shape, Part 4's outcome).
- **"Things to test after session 25"** in `PROGRESS.md`, most important first (for example: build a wall of 3 and hold it against a Marshal: did it feel worth 120 gold? Read the "Walled … +20%" line and the odds at a walled target: clear? Start new games on Wyrmland 6: do you ever get the "harder spot" notice now (you shouldn't, unless you set "anyone")?). Carry over what Nate hasn't tried from "after session 24".
- `PROGRESS.md` (sessions completed: 25; the Phase line: **M3 is done** once Nate's play test on 25 is in, then what comes next is decided after he plays), `docs/decisions.md`.
- **Commit and push.**

## Out of scope
- A top-tier bot built from Nate's games; sharper Opportunist and Schemer leaders (later, with it).
- The map maker moving weak capital spots (M5, random maps).
- Walls across water, walls that give gold, any wall effect beyond defence.
- Art batch 5, sound upgrades (Nate's bench notes go to the orchestrator), M4.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass; everything is committed and pushed to `main`. **Run the full `pnpm test` before every push and twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- The determinism test passes; the fingerprints are re-pinned in the commits that changed behaviour; the saved-game tests and the mop-up fixtures pass unchanged.
- The shipped wall bonus passed every stop rule on all three tables, with the raw runs in `docs/sims/s25-*.txt`.
- The all-bot tables are dealt exactly as before the seat rule.
- Every deploy a working build; the final `pnpm deploy:preview` with its lock check; the screenshots and the docs above.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which parts were finished and which slipped (for 25b)
- the sweep table (A to D against the stop rules, all three tables), the setting shipped, and the payback it shows
- the delegating seat both ways on the six tables
- Part 4's outcome, if it ran
- which commits re-pinned which fingerprints
- whether Nate's play-test notes were in `PROGRESS.md` when you started, and which defaults you used if not
- the start-up bundle, planning time side by side (before and after), the deployed version
