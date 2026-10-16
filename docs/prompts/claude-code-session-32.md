# Claude Code: Session 32 (M5 part three: bots that explore under blackout)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs the simulator with its 19 workers (the sims below are the point of the session), Wrangler (logged in there), his browser and deploys.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session makes "bots never cheat" true under blackout fog.** Blackout (session 30) hides land a player has never seen: no terrain, no name, no borders between two unknown lands, no provinces, no tapping it. The game itself is identical either way, so the bots play exactly the same games as with standard fog, because they read the map's shape (`indexMap(ctx.map)`) directly. A person under blackout can't. Nate's standing call is **bots never cheat**, and his call on Oct 16 was to fix this before scale and safety. So: **every bot, leader, Steward, Fallen seat, spy plan and deal judgment reads only the land its seat has seen, the bots learn to explore, and the sims show they're still worth playing against.** The Rules fold's label "(the bots still know the lay of the land)" comes off at the end. The plan is `docs/11-launch-plan.md` §2 and §6 and the design `docs/04-design-additions.md` §9 (blackout) and §8 (fog). Random-map balance is session 33 and scale, abuse limits and the map lab's switch are 34: don't start them.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit, run the deploy (where the part says so), push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

**The parts are in priority order; Parts 1 to 3 each end with a deploy,** so the session is complete at any of those boundaries. Whatever isn't reached becomes session 32b; say what's left. Nate may be playing the preview while you work, so every deploy must be a working build, and **a game already running on the server must survive a deploy.** Long sims run in the background (19 workers) while you go on.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: "Oct 16: Orchestrator review of session 31" (the nits for Step 0), and **every "Nate's play test" entry after session 31** (his solo notes outrank anything below)
3. `docs/04-design-additions.md` §9 (blackout: what a person sees and can't), §8 (fog, last seen), §4 (the bots: the Captain, the Marshal, "bots never cheat"), §12 (leaders), **`docs/11-launch-plan.md`** §2 (the order), §6 (blackout)
4. `docs/rules-reference.md` §11 (fog and blackout: the exact rules of what is seen when), the Spies and Leaders sections
5. `docs/sim-results-m3-marshal.md` and `docs/sim-results-m3-balance.md` ("The seat rule", the fairness bar: by seat within ±5 of fair at 300 games, the delegating seat on Wyrmland 6), `docs/sim-results-m5-random-maps.md` (blackout's session 30 run: game for game the same as standard fog, which is the problem)
6. `docs/decisions.md`, the Oct 15 to 16 lines at the bottom
7. The code: `packages/engine/src/view.ts` (`viewFor`, the `unknown` mark, `LastSeen`), `packages/engine/src/mapIndex.ts` (`indexMap`, `allDistances`), `packages/bots/src/board.ts` (`readBoard`: the one place the Captain and the generals read the map), `packages/bots/src/marshal/` (`plan.ts`, `sweep.ts`, `judge.ts`, `memory.ts`, `realm.ts`, `home.ts`, `leaders.ts`, `talk.ts`), `recruit.ts`, `captain.ts`, `generals.ts`, `delegateSeat.ts`, `fallen.ts`, `spies.ts`, `diplomacy.ts` (every `ctx.map` and `indexMap(` in the bots package: there are about twenty), `apps/sim/scripts/s30-sims.ts` (`--fog blackout`, `--digest`), `apps/sim/src/cli.ts`, `apps/web/test/fog-wire.test.ts`
8. `docs/voice-guide.md` (for the one or two new lines a player reads)

## Step 0: sync and the fixes from the review
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **Nate's solo notes after 31** in `PROGRESS.md`: do the small ones here; list the rest for the orchestrator.
3. **Lesson 2's trip (the orchestrator fell into it):** after **Recruit here** in the territory panel, the panel stays in "Recruit at…" mode, so the next map taps (to march from Mistbury) moved the recruit to Larkfell instead of selecting Mistbury. **Recruit here from the territory panel adds the order and returns to the territory panel;** the round Recruit button keeps today's retargeting mode with Done. (Nate can overrule.) Check lesson 2's hints still read right.
4. **The guided first game pauses the clock while a card is up** (single player already has pause); the clock runs again when the third card is answered or the guide is skipped. **The hint notice is skipped** when the goal card is on screen (desktop) or the Goal tab is open (phone): the card's "This turn" line already says it. The guide's cards on the phone sit clear of the panel's text (the Recruit card covered the Army tab's lines, the Lock in card covered "+ Somewhere else").
5. **A failed random seed rerolls by itself (Nate's call, Oct 16):** Reroll (and the lobby's fresh seed on a reload) keeps rolling until a seed makes a fair map, and the words shown are the ones that worked, so a player never sees "That seed didn't make a fair map" from a roll; a seed someone **types** still gets its six tries and then the line (it's their seed). Cap the rolling at 12 seeds, then the line. The sim's "seeds that made a map" column stays as a measure.
6. **The start-up bundle sits at 469.7 KB against 470.1.** Bounded item: if the content package can validate its JSON at build time (a build step or a test that runs the Zod schemas) and export plain typed data, take Zod out of the start-up code and say the new number; if that takes more than an hour or touches the engine's rules loading, leave it, say so, and the allowance stays **470.1 KB** for this session (the bots load with the game, not the lobby).
7. **Commit, deploy, push.** (Run the full `pnpm test` before this and every push.)

## Guardrails (all parts)
- **The engine stays pure and unchanged in behaviour:** no new rules, no engine special case for bots. `viewFor` already says what a seat has seen; the bots work from that. If the view needs one more field for honesty (say, which borders of a known territory lead into the unknown), add it for everyone (a person's page may use it too), with a fog-wire test case, and nothing about the unknown side.
- **Standard fog games are byte for byte the same before and after.** With standard fog nothing is unknown, so the known map equals the whole map and every bot must give the same orders. Prove it three ways: the `--digest` run (240 games, `dc8962d4f8ba3bc6` as in sessions 30 and 31), the Captain fingerprint, and the same seeded sim at the commit before and after (`pnpm sim --games 40 --players 6 --map wyrmland --bots marshal --seed o32`). The orchestrator will re-run these.
- **Honesty is tested, not promised:** a "scrambled unknown" property test: for a seat under blackout, take its view, then build a second map with everything about the unknown land changed (terrain, names, provinces, borders between two unknown lands, even extra unknown territories) and run every bot (Recruit, Captain, Marshal with each personality, the generals, the delegating seat, the Fallen, the spies, the deals judge): **the orders, the deal answers and the lines must be identical.** Random maps and the twelve, several seeds, several turns in.
- **Balance values in `packages/content`** (an explore weight, a scout's price threshold, how many turns a bot waits before pushing into cloud).
- **Every new line a player reads** in the voice (`docs/voice-guide.md`); no sarcasm in the Rules fold.
- **The start-up bundle** within 2 KB of Step 0's number.

## Part 1: the known map, and every bot on it (the first deploy)
1. **`knownMap(ctx.map, view)`** in the bots package (or beside `indexMap` in the engine if the generals and the room's lines want it too): a `MapIndex` over the territories the seat has seen (`detail` not `unknown`): their terrain, names, provinces, and the borders where **at least one end is known** (a person sees a border from known land into the cloud, so the bot may know "something is there", never what). Unknown land has no terrain, no province membership, no neighbours of its own. Cached per view like `indexMap` is per map.
2. **Every reader moves to it:** `readBoard` (the Captain, the generals), the Marshal's plan, sweep, judge, memory, realm, home and leaders, the delegating seat, the Recruit, the Fallen (its events land only on known land), spies (travel only over known land; a report lifts the cloud as it does for a person), diplomacy (land estimates from what's known; "running away with the map" from known land, as `landEstimates` already does from the view). `allDistances` and `MAX_HOPS` chains over known land only: a chain stops at the edge of the known, as a person's taps must.
3. **Province goals with cloud in them:** a province the seat holds "2 of ?" (members unknown) is valued by its known members; the realm's "finish the province" command doesn't chase members it can't see.
4. **Tests:** the scrambled-unknown property test above; standard fog unchanged (the digest, the fingerprint, the seeded sim); a unit test that `knownMap` under standard fog is the whole map; the fog-wire test passes (and fails on a planted leak: try one yourself and restore it). **Then a baseline blackout sim, in the background:** 300 all-Marshal games on Embervale 4 and Wyrmland 6 with `--fog blackout`, by seat against fair, turns, within 40, and the same with standard fog for the pair. Expect blackout to be worse here (the bots now blunder at the cloud's edge: that's Part 2's job). **Deploy. Commit and push.**

## Part 2: the scout's drive (the second deploy)
1. **Exploring is worth something under blackout:** a known territory whose borders lead into the cloud is a **frontier**; taking or standing on one reveals its neighbours. Give the Captain's land value and the Marshal's judge an explore term (content: `explore.weight`) that is zero under standard fog (so nothing changes there) and counts the unknown borders a target opens. Chains end on a frontier when the next hop is cloud. Early on, the Marshal buys **Scouts** (vision +1) or a watchtower a turn or two sooner under blackout (content: `explore.scoutTurn`), and spies travel toward the cloud when there's no rival to watch.
2. **Nothing reckless:** a bot doesn't march its capital's garrison into cloud; the garrison rules in `home.ts` hold; an explore move is a normal move or attack with the usual odds (a neighbour is always known, so the odds are real); the drive fades as the cloud does.
3. **Leaders and the delegating seat:** "Expand toward X" aims at a known place; the Steward's realm works the known realm; a missed turn under blackout is run from the seat's own view (it already is).
4. **Sims, in the background (the numbers decide):** 300 all-Marshal games on **Embervale 4** and **Wyrmland 6** under blackout, and the same two under standard fog from Part 1's run, in `docs/sim-results-m5-blackout.md`: by seat against fair (**the bar: every seat within ±5 of fair under blackout, as the balance sessions hold it**), average turns and within 40 (blackout within about 3 turns of standard), the share of games with a comeback, and **the explore pace** (the turn by which a Marshal has seen half the map, and the whole map, on each: new in the sim's summary). Then **the delegating seat on Wyrmland 6 under blackout** (`s23-tables.ts`'s way, 300 games: a person's leaders against dealt Marshals): no worse than its standard number within ±0.2. If a bar is missed, tune the explore weight and the scout turn (three settings, say what each did) before anything else; if it's still missed, say so with the numbers and leave the label on (Part 3 says what it says then). Blackout with Marshals of each personality in turn (`--mix marshal-<personality>,marshal,marshal,marshal`) for the Turtle and the Opportunist at least: neither more than 0.2 × fair off its standard number.
5. **Tests:** the explore term is zero under standard fog (the digest again); a blackout seat's orders never name unknown land; the scout purchase under blackout on a seeded game. **Deploy. Commit and push.**

## Part 3: the label comes off, the words, the write-up (the third deploy)
1. **The Rules fold's Blackout line** becomes "Blackout: the map is hidden until you explore it. The bots explore too." (only if Part 2's bars are met; otherwise it keeps "(the bots still know the lay of the land)" and `PROGRESS.md` says why). The rules reference §11 says what the bots know under blackout in one paragraph, in plain words, including what they still do that a person can't (nothing, if Part 1 holds; perfect recall of "last seen" is what a person has too).
2. **A bot's line about the cloud** (optional, one line, the chat's rules from session 29): a Marshal that just revealed a stretch may say so in the table chat once a game ("Nothing but cloud past the river, until today."), written from its own replay, never naming unknown land. Skip it if the chat's limits make it awkward.
3. **Write-up:** `docs/11-launch-plan.md` (BUILT lines under §6, the order's line for 32), `docs/04-design-additions.md` §9 (a BUILT line: the known map, the scout's drive), `docs/rules-reference.md` §11, `docs/sim-results-m5-blackout.md`, `docs/decisions.md` (one line per decision), `docs/sim-results-m3-marshal.md` (a pointer). **Deploy. Commit and push.**

## Part 4 (can slip to 32b): a picture of what a bot knew
1. **In the map lab** (dev only; session 34 switches the lab off in production): "A seat's known map at turn N" for a saved blackout game: the known land painted, the cloud as the page draws it, the explore frontier marked, and the seat's orders that turn. One screenshot in `docs/art/screens/s32-known-map.jpg`, so Nate can see the bots are playing the same game he is. **Commit and push.**

## Last: the test list
- **"Things to test after session 32"** in `PROGRESS.md`, most important first: a blackout game against Marshals on Embervale (do the bots look like they're exploring? do they still find you?); a blackout game on a random 120; Step 0's fixes (Recruit here, the guided game's clock, the hint notice on the phone); carry over what Nate hasn't tried.
- `PROGRESS.md` (sessions completed: 32), `docs/decisions.md`.
- **Commit and push.**

## Out of scope (sessions 33 and after)
- **Random-map balance** (33, Nate's call Oct 16: a graded head start by exposure rank, with the 100-maps-a-size sim; don't touch the random layouts' bonus here beyond Step 0's reroll); bigger tables and the sim's numbers for them, the map lab off in production, abuse limits (34); launch polish and a load test (35); sign-in and Workers Paid (36); the purchase and the site (37); a top-tier bot above the Marshal (later).

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass; everything is committed and pushed to `main`. **Run the full `pnpm test` before every push and twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- Standard fog unchanged: the `--digest` run gives `dc8962d4f8ba3bc6`, the Captain fingerprint and the twelve maps' fingerprints hold, the seeded sim is identical before and after. The scrambled-unknown test passes for every bot kind.
- The blackout sims in `docs/sim-results-m5-blackout.md` with the bars above, and the delegating seat's number.
- The start-up bundle within 2 KB of Step 0's number; the lock check passes on every deploy; running games survive each deploy.
- A blackout game against Marshals played on the preview by you (a few turns, in Nate's Chrome, on the desktop; the phone is Nate's), with a screenshot of the Rules fold's new line.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which parts were finished and which slipped (for 32b)
- Step 0: the bundle before and after (and whether Zod moved), what Nate's notes changed (one line each)
- the known map in one paragraph (what a bot knows under blackout, and what it doesn't)
- the sim table: Embervale 4 and Wyrmland 6, standard against blackout, by seat, turns, within 40, explore pace; the delegating seat; the personalities
- the digest and the fingerprints, unchanged
- the deployed version
