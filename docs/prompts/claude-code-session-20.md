# Claude Code: Session 20 (M3: leaders that finish the job, the Marshal plays like a person, controls)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his browser (screenshots) and a deploy.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session comes from Nate's play test** (Rootholm, 200 territories, 9 Marshals). The game's length is right and the Marshals team up on him; what let him down was the end: with 95% of the map and three rivals left, his Leader on "Run the military" **hoarded gold, moved troops away from the fighting and wrote few orders**, and a 2-territory rival won back a chunk of the map over four turns. Nate writes 50+ orders a turn; all his leaders together wrote about 20. The Marshal shares the leaders' brain, so bot games drag at the end for the same reason (bot games on the big maps run to the 60-turn cap). Fix the brain, add the commands he asked for, and give him the two controls he wants.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit and push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

The parts are in priority order. **Part 4 ends with the deploy, so the session is complete there.** If time is short, "Report to <leader>" (in Part 1) and the sweep rework (Part 3) are the pieces that can slip to session 20b; say so.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: the orchestrator's review of session 19 and **"Nate's play test after session 19"** (what this session fixes), then "Things to test after session 20" at the end (you'll write it)
3. `docs/decisions.md`, the Oct 7 lines at the bottom
4. **`docs/04-design-additions.md` §15** (this session's design: leaders that finish, the Marshal's playbook, controls) and §4 (leaders), §11 (the Marshal)
5. `docs/sim-results-m3-balance.md` Part 1 (why the delegating player beat the Marshals, and what was changed), and the orchestrator's note in `PROGRESS.md` that the delegating player is **back above fair on the finished code** (1.19× on Embervale, 1.50× on Wyrmland 6) because culture pays now and the Steward buys it while the Marshals don't
6. `docs/rules-reference.md` §13 (bots), §14–15 (leaders), §4 (orders, the path order)
7. The code: `packages/bots/src/marshal/` (`plan.ts`, `leaders.ts`, `steward.ts`, `judge.ts`), `packages/bots/src/generals.ts`, `packages/engine/src/leaders.ts`, and the leaders' screens in `apps/web`

## Step 0: sync
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **Don't import art batch 4** (session 21 does).
3. **Commit and push** anything Step 0 changed.

## Guardrails (all parts)
- **The hard rules in `CLAUDE.md`:** the engine stays pure and deterministic (seeded randomness only); every engine change has tests and the determinism test passes; balance values live in `packages/content`; clients only get `viewFor`.
- **Bots and leaders never cheat:** they judge only from their own view and memory. "Anticipate and counter" reads the armies they can see, nothing more. Keep the no-pooled-sight and hidden-changes tests passing.
- **Keep the Captain unchanged** (its fingerprint tests) and **the Recruit easy.** Personality stays play style, never extra power.
- **Game length is measured in turns** (Nate: up to 30–40; bigger tables longer). Fixing the ending must not shorten the opening or the middle: the halfway-leader and half-map-by-turn-10 measures from `docs/sim-results-m3-balance.md` stay where they are or improve.
- **Saves:** migrate if the game's shape changes; the old fixtures keep loading.
- **Every claim gets numbers:** 300 games a line at least (500 for headline lines), seats rotated.
- **Taps:** a basic turn stays 6 taps on a 384 px phone; report the taps of every new command.

## Part 1: leaders that finish the job
Design: `04-design-additions.md` §15 "Leaders that finish the job".

1. **Never hoard without a named reason.** A leader on a military command (Run the military, Command this front, Expand, Push, Raid, Defend, Hold) spends its whole purse on troops and attacks every turn, unless it's saving for something it can name: a fort it has asked the Steward for, or one more turn to afford a decisive attack it has picked. The Leaders panel says "Saving 14 gold for the attack on Galeholt" or spends. Add a sim measure: **gold left unspent in military purses at the end of each turn** (average, and the share of turns with more than one troop's worth unspent).
2. **Many orders, at the fight.** Run the military writes as many orders as the realm needs: chains, recruits at every useful site marching to the fronts, and marches between fronts. It never moves troops away from a live front except toward another front. Measure **orders written a turn** by a Leader on Run the military against a Marshal planning the same seat: they should match or exceed it.
3. **Finish them.** When a rival is down to a handful of territories (`rules.leaders.finish.territories`, say 6, or under a share of ours), the leader goes and ends them: either **recruit around the remnant and close in from every side** the same turn so nothing escapes, or **mass on one territory with the Leader and sweep every territory in chains**, guessing where the remnant will run (their nearest friendly land, the richest empty land) and covering those exits. Pick whichever ends it sooner from what the leader can see. Test it on **mop-up fixtures:** build 20 seeded positions where one seat holds 85–95% of the map with two or three small rivals (make them with the sim from real games at the moment a player passes 85%), and measure **turns to finish** with a Leader on Run the military (and, for Part 2, with a Marshal in the seat). Target: finished in **2 turns or fewer in most fixtures, never more than 4**, on Embervale, Wyrmland and Rootholm.
4. **"Clean up"** (new command): appears in the command list once you hold about **75% of the map** (`rules.leaders.cleanUpShare`), for any Leader. Every leader on Clean up works together: they split the remaining rivals between them, encircle, sweep in chains and cover the exits. **Run the military does the same unasked** at that point. The panel says "Finishing them off: Lady Morwen (3 territories left)". The report and Chronicle tell it ("Your Leader, Aldric, finished House Azure").
5. **"Push back <player>"** (new command): pick one rival. The leader takes that rival's weakly held land, breaks their chains, keeps clear of their big stacks until it can beat them, and never touches anyone else except to pass through. One plain reason a turn in the panel.
6. **Anticipate and counter:** leaders (and, in Part 2, Marshals) look at the rival armies they can see and guess their next move (which weak territory of ours they'd take, which chain they'd run), and block it where it makes sense: a few troops into the exposed territory, a fort asked of the Steward, or a strike on the stack first. Measure it: against a table of Marshals, a Leader on Run the military with and without it (win rate, land lost per turn).
7. **"Report to <leader>"** (new command, can slip): a leader works under another. A reporting Leader's army is directed by its senior (a Run the military, Expand or Command this front leader) and its budget flows into the senior's purse each turn; a reporting Steward does the same under a Run the realm Steward. The panel shows "Reports to Aldric"; the senior's orders carry the junior's portrait when it's the junior's army moving. Take back and a new command end the arrangement.
8. **Budgets cap at 100%:** the share chips only offer what's left; the exact-amount box caps at the remaining income; the panel shows "Budgets: 80% of income" at the top. Saves over 100% are trimmed in roster order on load (a migration or a load-time fix, with a test).
9. **Tests:** no-hoard (a military leader's purse ends the turn under one troop's cost unless a named reason is set), the mop-up fixtures (turns to finish), Clean up appears at the threshold and the leaders split rivals, Push back never touches a third party, Report to moves the budget, budgets never exceed 100%, saves migrate, determinism.
- **Commit and push.**

## Part 2: the Marshal plays like a person, and finishes games
Design: `04-design-additions.md` §15 "The Marshal plays like a person". The Marshal and the leaders share `planMarshal`, so Part 1's finishing, no-hoard and anticipate-and-counter apply to it; this part is the rest of Nate's playbook and the culture gap.

1. **Build like the Steward:** every Marshal buys culture and buildings the way the Steward's Run the realm does (where a level pays back, on land it means to keep; forts where an army masses; markets where they pay), in its own style (`personalities.json`: the Turtle and Merchant more, the Blitzer least). This is the gap the orchestrator found: a fully delegating player (`delegate-80`) wins **29.8% against Marshals on Embervale (fair 25%) and 25.0% on Wyrmland 6 (fair 16.7%)** today. Target: **about fair on both** (within 3 points), with `delegate-100` no higher than 1.2× fair.
2. **Hold what matters:** after taking a choke point or a province, fortify it and attack again once two turns of its income are in. Fortifying ahead of a threat cost wins in session 17 (it held troops back); try it again now that culture pays and forts are a Steward's job, as a one-change test. Keep it only if it doesn't cost wins.
3. **Pick the best region:** once the realm is big enough (say a third of the map), work out which part of the map has the best bonuses and terrain within reach, drive the others out of it, fortify it, then move carefully through the rest. One-change test, keep it if it wins.
4. **Finish games:** with Part 1's finishing in the Marshal, bot games should stop dragging. Measure the median length and the share of games at the 60-turn cap on Wyrmland 6–8 and Rootholm 8–10 before and after. The opening and middle stay as they are (the half-map-by-turn-10 and halfway-leader measures in `docs/sim-results-m3-balance.md` don't get worse).
5. **Re-run the headline:** one Marshal of each personality against Captains at 4 and 6 players, the strong stand-in on Wyrmland 6, and `delegate-80`/`delegate-100` against Marshals on Embervale 4 and Wyrmland 6 (500 games a line). No table gets weaker.
- **Commit and push.**

## Part 3: controls
Design: `04-design-additions.md` §15 "Controls".

1. **Enter confirms, Esc cancels:** with an attack or move box open, **Enter** confirms it as shown (amount, Leader goes/stays, Initiative/Wait as set) and **Esc** cancels; the buttons stay for changing anything. Also Enter on the path box's highlighted choice and on a command menu's highlighted item. A small "↵" hint on the confirm button on a laptop (not on a phone). Never steal Enter from a text field (the leader name, the exact-amount box).
2. **The full sweep reworked:** the sweep leaves no unclaimed land between the two points: it clears a **band about 3 territories wide** along the way (`rules.path.sweepWidth`), and branches out further where that completes a province; it still never attacks a partner. The box says how many orders it adds and how many territories it takes. Check it on Wyrmland and Rootholm: a sweep across the map should leave no pocket of unclaimed land in its band. Keep the tap counts (4 shortest, 5 sweep).
3. **Tests:** key handling (Enter confirms exactly what's shown; Esc cancels; a text field keeps Enter), the sweep's band (no unclaimed territory within the band between the two points; branches only to complete a province; never a partner's land), the order count in the box matches what's queued.
- **Commit and push.**

## Part 4: write-up, screenshots, deploy
- **`docs/sim-results-m3-leaders.md`**: a session 20 section: unspent purse gold before and after; orders a turn (Leader on Run the military against a Marshal in the same seat); the mop-up fixtures' turns to finish (before, after; Leader and Marshal); Clean up and Push back in play; anticipate-and-counter's effect; `delegate-80`/`delegate-100` against Marshals before and after (Embervale 4, Wyrmland 6); the Marshal's new behaviours as one-change tests; game length and the 60-cap share on the big maps before and after; the headline re-run.
- **Rules reference:** §14 (the new commands, no-hoard, the 100% cap, Enter/Esc), §4 (the sweep), §13 (the Marshal's playbook), and "Not in yet".
- **Design additions §15:** a BUILT block with what was settled while building.
- **Screenshots** (desktop and a 384 px phone), `docs/art/screens/s20-*.png`: the command menu with Clean up and Push back; a leader "Finishing them off" in the panel; Report to in the panel; the budget chips showing only what's left; the attack box with the ↵ hint (desktop); a full sweep's band drawn on Wyrmland.
- `pnpm deploy:preview` passes its lock check.
- **"Things to test after session 20"** in `PROGRESS.md`, most important first, for example: hold 75% of a map and watch Clean up (or Run the military) finish it in a turn or two; give a Leader "Push back" on the rival that annoys you; set a second Leader to report to the first; check your budget chips stop at 100%; Enter to confirm attacks for a whole turn (how many fewer mouse trips?); a full sweep across Wyrmland; a delegated game against Marshals (does your delegating still beat them?); do the Marshals finish their own games faster now? Carry over what Nate hasn't tried yet: the phone, a 160 map, Embervale with 4, getting knocked out once (the Fallen's first turn), Conquest's 20-turn default on a 200 map.
- **Commit and push.**

## Out of scope
- **Session 20b:** Walls (`04-design-additions.md` §16) and fair capital spots on every map.
- **Session 21:** the polish pass (effects, cinematic replay, art batch 4; Fate and the Fallen made visible).
- **Session 22:** the language pass. **M4:** online play, chat.
- Not in this session: new rules beyond the two leader thresholds (`finish.territories`, `cleanUpShare`) and the sweep width; Steward portraits; sound.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`. **Run the full `pnpm test` twice before your last push** (property tests use random inputs), and ask Nate to check the repo's Actions page for your last commit (`gh` isn't installed on his computer).
- The mop-up fixtures finish in 2 turns or fewer in most cases (never more than 4); `delegate-80` within 3 points of fair against Marshals on Embervale 4 and Wyrmland 6; no headline table weaker; the Captain's fingerprint unchanged.
- The write-up, screenshots and `pnpm deploy:preview` with its lock check.
- **"Things to test after session 20" is complete and ordered.**
- `PROGRESS.md` (with "Claude Code sessions completed" bumped to **20**), `docs/decisions.md`, `docs/rules-reference.md` and `docs/04-design-additions.md` are updated in simple language.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the mop-up fixtures: turns to finish before and after (Leader and Marshal)
- unspent purse gold and orders a turn, before and after
- `delegate-80` and `delegate-100` against Marshals, before and after, both maps
- the Marshal's one-change tests (hold what matters, best region): kept or not, with numbers
- game length and the 60-cap share on the big maps, before and after
- the headline re-run (one Marshal against Captains; the strong stand-in)
- the taps of each new command, and the screenshot paths
- anything that slipped to 20b
