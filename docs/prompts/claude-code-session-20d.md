# Claude Code: Session 20d (M3: no hoarding for real, a sweep that covers the fog, and the Steward's walls)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his browser (screenshots) and a deploy. A short session: four parts, each ending with commit and push.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session comes from Nate's play test of session 20b's build.** Three things: his Leader on Run the military **still hoarded gold turn over turn** and recruited less than it could, so the clean-up dragged (once the remnant was coming back before he stepped in); the finish's **sweep skipped territories in the fog**; and his Steward, mostly good, should **build with a plan and wall up fast**, working with the Leader. Session 20 claimed "never hoard" was done (unspent gold 1.5–2.0 a turn in the sims); it didn't hold in his game, so this session measures it the way he plays.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit and push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

The parts are in priority order. **Part 4 ends with the deploy, so the session is complete there.** If time is short, the Steward–Leader coordination (Part 3, item 3) can slip to session 22; say so.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: the orchestrator's review of 20c and 20b, "The orchestrator's own checks", and **"Nate's play test of session 20b's build"** (this session's reason)
3. `docs/decisions.md`, the Oct 9 lines at the bottom
4. **`docs/04-design-additions.md` §15, "Nate's third note"** (this session's design), plus "Nate's second note" and §16 (Walls)
5. `docs/sim-results-m3-leaders.md` (sessions 20 and 20c: never hoarding, the mop-up fixtures, mass and sweep), `docs/sim-results-m3-walls.md`
6. `docs/rules-reference.md` §7 (culture: several levels a turn are allowed), §10, §14, §24 (walls)
7. The code: `packages/bots/src/marshal/` (`sweep.ts`, `plan.ts`, `leaders.ts`, `steward.ts`, `home.ts`), `packages/bots/src/generals.ts`, `apps/sim/scripts/s20c-mopup.ts`, `s20-leaders.ts`

## Step 0: sync
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **Don't import art batch 4** (session 21 does).
3. **Commit and push** anything Step 0 changed.

## Guardrails (all parts)
- **The hard rules in `CLAUDE.md`:** the engine stays pure and deterministic; every engine change has tests and the determinism test passes; balance values live in `packages/content`; clients only get `viewFor`.
- **Bots and leaders never cheat:** the sweep covers fogged land because the remnant *could* be there (worked out from the map and what's remembered), never because the planner peeked. Keep the no-pooled-sight and hidden-changes tests passing.
- **Keep the Captain unchanged** and **the Recruit easy.**
- **The opening and middle game don't change:** the half-map-by-turn-10 and halfway-leader measures stay where they are; the headline (one Marshal against Captains) doesn't drop.
- **Planning time:** the 50 ms limit for all bots together at 10 players stands; report finishing turns separately (they ran about 290 ms in 20c; a finishing turn is rare, but say what it is now).
- **Every claim gets numbers:** 300 games a line at least; the mop-up fixtures (20 and the wide set) and Nate's positions before and after.

## Part 1: no hoarding, measured the way Nate plays
Nate's picture: on Run the military with a real budget (he gives 50–80% of his income on a big map), the purse should be **empty or nearly empty at the end of every turn's orders**, with the gold turned into troops wherever recruiting is possible, and the troops marching to the fight. In 20b's build his Leader kept gold turn over turn.
1. **Find out why**, by tracing a Run the military leader through 10 turns of a delegating game on Wyrmland 6 and Rootholm 9, turn by turn: what the purse held at the start, what it spent, what it kept, and the reason the planner had (no recruit site? the finish's "sites that can't be lost this turn" rule? saving for something? an order cap? the order of the queue?). Write the trace up in plain language in the summary.
2. **Fix each cause.** Rules that stand: the purse is spent on troops **every turn it can recruit anywhere** (the capital, barracks, full provinces: all of them, not only the "safe" ones; a site that might fall still gets its recruits if there's nowhere safer); a "saving for" reason is rare, named, and shown in the panel ("Saving 14 gold for the fort at Galeholt"); recruits march toward the fight the same turn where the rules allow.
3. **Measure:** unspent gold at the end of each turn's orders as a **share of the purse** (not just gold), by turn, on Wyrmland 6 and Rootholm 9 at budgets of 20%, 50% and 80% (300 games each), before and after. Also play 10 turns of a Wyrmland 6 delegating game in the browser (Leader on Run the military at 50%) and check the panel's purse by eye each turn, since the sims said this was fixed once already. Target: **under 10% of the purse unspent on 9 turns in 10**, and never more than one troop's cost unspent when a recruit site exists. Also the mop-up fixtures' turns to finish (they should not get slower).
4. **Tests:** a property test over random positions: a military leader with gold and any recruit site ends the plan with less than one troop's cost unspent unless a named reason is set.
- **Commit and push.**

## Part 2: the sweep covers the fog
Session 20c's sweep covers the remnant's known land and what its armies could reach; fogged land near the remnant was "visited last" and in Nate's game wasn't visited at all.
1. **The sweep's set** is: every territory the remnant **is in** (seen), **might be in** (fogged land it could hold: anything of theirs we remember, plus fogged land connected to it that a remnant army could have reached since we last saw it), and **could move to** next turn from any of those. All of it is swept, in chains, strongest first, the fogged parts included; the blanket covers our land touching any of it.
2. **Orders:** if that means more orders, that's intended (Nate). Raise any cap that stops it; keep the shared-tree blanket from 20c so the count stays sane.
3. **Measure:** on the mop-up fixtures and the wide set, with fog on: turns to finish, "got away", and a new count: **territories the remnant held that the sweep never ordered an attack on** (should be near zero). Compare with fog off to show the sweep is now as complete under fog as without it.
4. **Tests:** the sweep's set includes remembered-but-fogged land and its reachable neighbours; no order targets land the planner has no reason to think the remnant could be in (no cheating); determinism.
- **Commit and push.**

## Part 3: the Steward builds with a plan, and walls up fast
Nate: "mostly doing well", but with a plan: **markets and other buildings in the centre** of the realm; **forts wherever we may want a wall, now or eventually, and at choke points**; when its purse allows, **a push to wall up as fast as possible**; and when building defences is the best thing to do in the moment, **everything goes into it**.
1. **Where to build:** Run the realm scores territories by **interior-ness** (steps from any border) and **choke-ness** (passes, fords, narrow necks: `docs/07-map-tooling.md`'s choke points, and any territory whose capture would cut the realm). Markets and barracks go to the interior; forts go to choke points and to **wall candidates**: the capital's province and any province it holds entirely that borders a rival.
2. **Wall up fast:** culture can be raised **several levels in one territory in one turn** (`rules.culture`: check that the engine allows it and the queue accepts it; if it's one level a turn today, that's a rule to raise with a test, and say so). So a Steward with the gold can take a territory from culture 0 to 5 and add a fort in a single turn (31 + 8 gold), and a whole wall system over a province in one turn if the purse holds enough. When the realm is threatened (a rival army within 2 steps of the capital's province, or a runaway on the map), Run the realm **spends everything on the wall** until it stands; otherwise it builds the wall over a few turns alongside markets.
3. **The two leaders together** (can slip): when a Steward is on Run the realm and a Leader on Run the military, the Steward walls the province the Leader is holding or staging in (its plan is visible to the Steward: same player, same view), and the Leader keeps **a real garrison inside the wall** (spare troops stationed in the walled territories rather than 1 each), since the wall lends spare troops. The Marshal does the same with its own realm plan.
4. **Measure:** turn of the first wall (Steward on Run the realm, delegating seat, Wyrmland 6 and Rootholm 8), walls per game, the share of walled territories with more than 1 troop, win rate of the delegating seat before and after (it must stay about fair against Marshals), and whether walled cores get attacked at all (attacks on walled territories per game; Nate couldn't see one in play).
5. **Tests:** interior and choke scoring on a known map; a threatened Steward with 40 gold walls the capital in one turn; the Leader garrisons the wall; the Captain unchanged.
- **Commit and push.**

## Part 4: write-up, screenshots, deploy
- **`docs/sim-results-m3-leaders.md`:** a session 20d section: the hoarding trace in plain language (what was keeping gold and why), the unspent-share table before and after, the fog sweep's numbers (turns, got away, never-ordered territories, fog on against off), the Steward's wall numbers.
- **Rules reference:** §14 (no hoarding, the sweep under fog, the Steward's plan), §7 if the culture rule changed, §24.
- **Design additions §15:** a BUILT block under "Nate's third note".
- **Screenshots** (desktop and a 384 px phone), `docs/art/screens/s20d-*.png`: the Leaders panel with an empty purse after orders ("Purse 0g · 50% of income · 41 orders this turn"); a finishing turn's queue reaching into fogged land; a Steward walling a province in one turn (the queue's culture and fort orders); a wall with a garrison inside it.
- `pnpm deploy:preview` passes its lock check.
- **"Things to test after session 20d"** in `PROGRESS.md`, most important first (for example: Run the military with 50–80% for ten turns: is the purse empty every turn? Clean up against a rival with fogged land: does the sweep go in after them? Give your Steward 50% when a Marshal masses near your capital: does a wall go up in a turn or two, with troops inside? Did anyone ever attack your wall?). Carry over the open items from "after session 20b" that Nate hasn't tried (the phone, a 160 map, Embervale with 4, Conquest on a 200 map, the Fallen's loudness).
- **Commit and push.**

## Out of scope
- **Session 21:** the polish pass (plus Step 0's service-worker fix and the three nits from the orchestrator's checks). **Session 22:** the language pass, the start bonus, the Marshal adopting the Merchant's lesson. **Later:** a top-tier bot above the Marshal, and the review of Nate's saved games that feeds it (not this session).
- Not in this session: new commands, new rules beyond the culture-levels-a-turn check, art, sound.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`. **Run the full `pnpm test` twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- Unspent purse under 10% on 9 turns in 10; the sweep's never-ordered count near zero under fog; the mop-up fixtures no slower; the delegating seat still about fair; the headline not weaker; the Captain unchanged.
- The write-up, screenshots and `pnpm deploy:preview` with its lock check.
- **"Things to test after session 20d" is complete and ordered.**
- `PROGRESS.md` (sessions completed: 20d), `docs/decisions.md`, `docs/rules-reference.md` and `docs/04-design-additions.md` updated in simple language.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the hoarding trace: what was keeping the gold, in one or two plain sentences per cause, and the unspent-share table before and after
- the fog sweep: turns to finish, got away, never-ordered territories, fog on against off
- the Steward: turn of the first wall, walls a game, garrisoned walls, attacks on walls, the delegating seat's win rate
- whether the culture rule (levels a turn) had to change
- planning time (ordinary turns and finishing turns)
- the screenshot paths, and anything that slipped
