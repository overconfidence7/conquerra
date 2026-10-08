# Claude Code: Session 20c (M3: mass and sweep, the security blanket, and leaders with personalities)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his browser (screenshots) and a deploy. **Run it before session 20b** (Nate's call, Oct 8).

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session comes from Nate's reading of session 20's results.** Session 20 made leaders finish in a median of 3 turns and called the slow positions "real fights where the rivals' armies match ours" that "slip a strike because the remnant's army moves in round 1". Nate says that's the wrong picture of the late game: with most of the map, our recruiting dwarfs theirs, so the remnant's army should never be as big as ours at the point of contact; and an army that moves away should run into our troops wherever it goes. The fix is in how leaders (and Marshals) **move**: mass everything in one place with a Leader, then **sweep everywhere the remnant is and everywhere it could get to**, with a **security blanket** of transfers through our own land so anything they take is taken straight back. That is a great many orders a turn, and that's intended. He also wants leaders to carry **personalities** for life.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit and push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

The parts are in priority order. **Part 4 ends with the deploy, so the session is complete there.** If time is short, leader personalities' play style (Part 3, item 2) can slip to 20b with the name-and-voice part kept; say so.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: session 20's entry and the orchestrator's review, and **"Nate's second note"** in `docs/04-design-additions.md` §15 (this session's design)
3. `docs/decisions.md`, the Oct 7–8 lines at the bottom
4. `docs/sim-results-m3-leaders.md`, the session 20 section: the mop-up fixtures, "Never hoarding, and orders a turn", and the one-change table (what was tried and dropped, and why Nate disagrees with the test, not the result)
5. `docs/rules-reference.md` §4 (orders: there's no limit on transfers or attacks a turn), §13 (bots), §14–15 (leaders)
6. The code: `packages/bots/src/marshal/` (`plan.ts`, `leaders.ts`, `judge.ts`), `packages/bots/src/generals.ts`, `packages/content/data/personalities.json`, the mop-up fixtures in `packages/bots/test/fixtures/mopup/` and `apps/sim/scripts/s20-mopup.ts`, `s20-leaders.ts`

## Step 0: sync
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **Don't import art batch 4** (session 21 does).
3. **Commit and push** anything Step 0 changed.

## Guardrails (all parts)
- **The hard rules in `CLAUDE.md`:** the engine stays pure and deterministic; every engine change has tests and the determinism test passes; balance values live in `packages/content`; clients only get `viewFor`.
- **Bots and leaders never cheat:** they judge only from their own view and memory. The sweep covers where a remnant *could* go, worked out from the map and what the leader can see; it never uses hidden positions. Keep the no-pooled-sight and hidden-changes tests passing.
- **Keep the Captain unchanged** (its fingerprint tests) and **the Recruit easy.**
- **Planning time:** Nate says slower is fine ("it will always be faster than people putting in orders"), but the 50 ms limit for all bots together at 10 players stands. Report the new numbers.
- **The opening and middle game don't change:** the half-map-by-turn-10 and halfway-leader measures from `docs/sim-results-m3-balance.md` and session 20's tables stay where they are or improve; the headline (one Marshal against Captains) doesn't drop.
- **Every claim gets numbers:** 300 games a line at least (500 for headline lines), seats rotated; the mop-up fixtures (20, and the wide set of 180) before and after.

## Part 1: mass and sweep, with the security blanket
Design: `04-design-additions.md` §15, "Nate's second note". This replaces session 20's finishing where the remnant still has an army.
1. **Field everything.** When finishing (Clean up, or Run the military past `cleanUpShare`), the leader turns its whole purse into troops every turn **at the recruit sites nearest the fight** (barracks, full provinces, the capital), not spread across the realm. Measure: the share of the purse recruited within 2 steps of the remnant's land.
2. **Mass.** It brings every spare troop (all but the 1 that holds each territory, and the capital guard) to **one staging territory with a Leader** next to the remnant, by chains of transfers through our own land, as many hops as needed in one turn (the rules allow it). Spare troops left behind count against it: measure "spare troops more than 3 steps from any rival" at the end of the leader's orders (should be near zero while finishing).
3. **Sweep.** From the staging point it sweeps **every territory the remnant holds and every territory the remnant could reach next turn** (their land, plus any territory of ours or neutral touching their land and their possible moves), in chains, strongest first, with the Leader on the main chain. Orders it can't afford or can't reach are left for the security blanket.
4. **The security blanket.** Every turn while finishing, it also writes chains of **transfers through our own land along every route the remnant could slip into**: troops moved into our territories that touch theirs, and into the territories behind those, so anything they take is retaken the same turn by the troops already arriving. Where our territory borders theirs with 1 troop, a transfer lands there. This is where the order count comes from; don't cap it below what the purse and troops allow (raise any order cap in the planner; the queue has none).
5. **The ring, for small remnants:** a rival down to 1–3 territories with a small army still gets session 20's ring (recruit next to them, close in from every side the same turn). Pick ring or mass-and-sweep by what ends it sooner.
6. **Test on the mop-up fixtures** (20, and the wide set of 180): **turns to finish, before and after**, the Leader and the Marshal; the share of positions where the remnant retook any territory after the finish began (Nate's "got away" cases: target under 10%); orders a turn while finishing. Target: **median 2 turns, 90% within 3, none past 5**; where a position still misses, trace it (as session 20 did) and say exactly why in the write-up.
- **Commit and push.**

## Part 2: defensible pauses, sweeps before the attack, and using the bots' Leaders
1. **Defensible pauses:** as a leader (or Marshal) advances or sweeps, each chain ends on **defensible ground** (a choke point, a fort, a territory with few rival-facing borders, or a province it has just completed) so no rival army gets behind its lines. Session 17 built "end chains on defensible ground" for the Marshal; make sure the leaders' commands use it too, and that it holds during Expand, Push, Command this front and Run the military.
2. **A sweep of our own land before the attack:** at the start of each turn's plan, if any rival army the leader can see could reach our interior (a territory of ours it could take that isn't on the front), the plan begins with **a chain of transfers through our own land leading up to the front** that catches anything creeping in: troops move into the exposed territories and on toward the front, so a rival that steps in is retaken by the troops arriving behind. Then the attack. ("Attack first, then sweep the exposed areas" is fine where the attack is the bigger need; both happen every turn where it matters.) Measure: territories of ours retaken within one turn of being lost, before and after; land lost a turn.
3. **Keep troops near the action:** reinforcements march as many hops as they need in one turn (session 20's "multi-hop marches" measured win rate and found no gain; the aim here is troops at the front, not a win-rate change). Measure: the average distance of spare troops from the nearest rival army, before and after.
4. **The bots' Leaders are used:** every Marshal moves its Leader with its main effort (the biggest chain or the staging point when finishing), and uses its +20% and its timing tricks there. Session 20's "Leader rides along" test (no win-rate gain) doesn't decide this: Nate wants the Leader on the map with the main effort. Measure the Leader's share of turns on the main chain, before and after, and the win rate (it must not fall).
5. **Captured leaders work together:** a captured Leader on Clean up or Report to joins the senior's sweep (its army is part of the mass; it takes a share of the sweep's chains with its own Leader bonus), rather than taking a separate rival with no purse. The Marshal does the same with the leaders it captures.
6. **Tests:** chains end on defensible ground (a property test over random positions); the pre-attack sweep fires when and only when a visible rival army can reach our interior; the Leader is on the main chain; captured leaders join the mass; determinism; the Captain's fingerprint.
- **Commit and push.**

## Part 3: leaders with personalities
Design: §15, "Leaders with personalities". Nate (Oct 8): a personality changes **how the leader plays**, the same way the Marshal's personalities do.
1. **In the lobby:** next to your Leader's name, a personality choice: **Neutral** (today's style, the default), **the Conqueror, the Blitzer, the Opportunist, the Schemer**; next to your Steward's name: **Neutral, the Turtle, the Merchant**. Remembered on your device like the names. One tap each on a phone. The bots' Leaders and Stewards carry their Marshal's personality.
2. **How it plays:** the leader's commands run through `planMarshal` with that personality's block from `personalities.json` (its weights and switches) instead of the neutral `leaders` block, under the command's scope and purse. The Steward's personalities shape what Run the realm buys (the Turtle forts and culture first, the Merchant markets first). Check each one's effect with a delegating seat against Marshals (300 games, Embervale 4 and Wyrmland 6): none should be much stronger than Neutral (within 3 points), and each should be visibly different (what it buys, how it chains).
3. **For life:** a leader keeps its personality when it's captured and works for the player who knocked its House out, and in saves (a migration; old saves get Neutral). The Leaders panel shows it ("Aldric, the Conqueror"), the report and Chronicle use its voice from `talk.ts`'s personality lines where a leader speaks ("Took Ashfell and Pinemark; Morwen's lot ran").
4. **Tests:** the lobby choice reaches the engine; a captured leader keeps its personality; saves migrate; the planner uses the personality's block; the fingerprint of a Neutral leader is unchanged from session 20.
- **Commit and push.**

## Part 4: write-up, screenshots, deploy
- **`docs/sim-results-m3-leaders.md`**: a session 20c section: the mop-up fixtures before and after (turns to finish, "got away" share, orders a turn while finishing, troops left behind); the pre-attack sweep's effect (retakes within a turn, land lost); spare troops' distance from the action; the Marshal's Leader on the main chain and the win rate; captured leaders joining the mass; each leader personality's effect; planning time at 10 players (one Marshal, all bots; the limit is 50 ms).
- **Rules reference:** §14 (finishing as mass-and-sweep, the security blanket, personalities in the lobby), §13 (the Marshal's Leader and captured leaders), and "Not in yet".
- **Design additions §15:** a BUILT block under "Nate's second note".
- **Screenshots** (desktop and a 384 px phone), `docs/art/screens/s20c-*.png`: the lobby's personality choice; a finishing turn's queue (the mass, the sweep and the blanket, with the order count); the Leaders panel showing "Aldric, the Conqueror"; a pre-attack sweep drawn on the map.
- `pnpm deploy:preview` passes its lock check.
- **"Things to test after session 20c"** in `PROGRESS.md`, most important first (for example: hold 75% of Wyrmland and watch the finish: does it mass in one place, sweep everywhere, and catch anything that moves? How many orders did it write? Give your Leader the Conqueror and your Steward the Turtle: can you tell? Capture a Leader with a personality: does it keep it?). Carry over what Nate hasn't tried yet.
- **Commit and push.**

## Out of scope
- **Session 20b:** Walls and fair seats (runs after this one).
- **Session 21:** the polish pass. **Session 22:** the language pass (leader voices get their full treatment there). **M4:** online play.
- Not in this session: new rules, new commands beyond what's listed, Steward portraits, sound.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`. **Run the full `pnpm test` twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- The mop-up fixtures: median 2 turns, 90% within 3, none past 5 (or a traced reason for each miss); "got away" under 10%; the opening and middle unchanged; the headline not weaker; the Captain unchanged.
- The write-up, screenshots and `pnpm deploy:preview` with its lock check.
- **"Things to test after session 20c" is complete and ordered.**
- `PROGRESS.md` (sessions completed: 20c), `docs/decisions.md`, `docs/rules-reference.md` and `docs/04-design-additions.md` updated in simple language.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the mop-up fixtures before and after (turns, "got away", orders a turn while finishing, troops left behind)
- the pre-attack sweep's numbers, and spare troops' distance from the action
- the Marshal's Leader on the main chain and its win rate; captured leaders in the mass
- each leader personality's effect (a small table)
- planning time at 10 players
- the screenshot paths, and anything that slipped to 20b
