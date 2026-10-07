# Claude Code: Session 17 (M3: the Marshal, a hard bot level with personalities)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his browser and a deploy.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**Why this session:** Nate's test game on Wyrmland against 5 Captains lasted 12 turns; he ran away with it, and nobody teamed up against him. He asked for bots with **different personalities and play styles**, mixed at random so a table of 5 feels different, and a **hardest level**, built separately from the Captain, that learns from the sims **which behaviours win**. In session 18 your own leaders and captured leaders will plan with this brain too, so build it to be reused.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit and push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

The parts are in priority order. **Part 5 ends with the deploy, so the session is complete there.**

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: the orchestrator's review of session 16, Nate's play test of sessions 11–15, and "Things to test after session 18"
3. **`docs/04-design-additions.md` §11 (the Marshal and personalities: the decisions)**, §2 (diplomacy and the bots' deal logic), §8 (spies), §0 (simple to play, deep to master)
4. **`docs/sim-results-s16.md`** ("Why nobody ganged up on Nate": the findings and five ideas)
5. `docs/decisions.md`, newest lines at the bottom
6. The bots: `packages/bots/src/board.ts` (`readBoard`, `runawayLeader`), `captain.ts`, `diplomacy.ts`, `cards.ts`, `generals.ts`, `fallen.ts`, `recruit.ts`
7. The simulator: `apps/sim/src/cli.ts` (`--mix`, seat kinds, `captain-no-<priority>`) and `apps/sim/scripts/s16-runaway.ts`

## Step 0: sync, the red tests, and the Far names
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **`main` is red** (GitHub's run on `7dff410`): two tests with random inputs failed. Neither is a game bug.
   - **`packages/engine/test/replay-fog.test.ts:306`** (the fog-leak check): fast-check's case `["{T", 5]` (seed string `"{T"`, 5 players). On turn 4, player `p2` gets a vision event at step 38 that holds both the spy's end-of-turn report (`t08`, `t13`, `t19`, seen by the spy) and the fog closing in after an uprising (a Fate card) turned `p2`'s `t35` neutral (`t28`, `t29`, `t37`). The test treats an event as either a spy report or ordinary sight, so it fails. The orchestrator checked: the revealed land matches `spyIntel` exactly, so nothing leaks. Fix it properly: either give the spy report its own vision event (its own step, after the turn's last land change), or teach the test about mixed events. Prefer the first if the replay reads better that way. **Add `"{T", 5` as a fixed regression case.**
   - **`packages/engine/test/spies.test.ts:442`** (`expected 6 to be greater than 10` fooled spies): the bar depends on luck. Give that property a fixed seed (or force enough fooled cases), so it can't fail by chance.
   - **The rule from now on:** property tests keep their random inputs (they find real problems), and every failing case they find becomes a fixed regression test.
3. **Province names at Far zoom pile up** (`docs/art/screens/s16-zoomed-out.png`: on Wyrmland the plaques cover the map). Nate disliked exactly this clutter. At Far, show **only the names that fit without overlapping** (larger provinces first), smaller, and with no plaque where the plaque would cover land. Tapping a territory still lights its province with the full plaque. Check Wyrmland and Embervale on desktop and a 384 px phone.
4. **Commit and push.**

## Guardrails (all parts)
- **The hard rules in `CLAUDE.md`:**
  - the engine stays pure and deterministic (seeded randomness only)
  - every engine change has tests, and the determinism test passes
  - balance values live in `packages/content`
  - clients only get `viewFor`
- **The Marshal never cheats.** It judges only from what a person in its seat could know: its own view and memory, what the replays showed it, and public facts (who's still in, who knocked out whom, how many Spoils cards each holds, deals and Oathbreaker marks, the Chronicle). No pooled sight between bots: partners don't share what they see unless that becomes a deal type every player can use (don't add it in this session). Extend the fog tests so the Marshal's planning can be checked against a view with everything it shouldn't know removed (same orders).
- **Personality is play style, never extra power.** Every personality plays by the same rules and gold.
- **Keep the Captain exactly as it is.** It's the medium level and the sims' yardstick, and its fingerprint test must still pass. The Recruit stays easy.
- **Explainable:** every deal answer still has one plain reason, in the personality's own voice where it fits ("Peace suits me; my walls aren't finished.").
- **Speed:** the Marshal's planning for one seat stays well under 50 ms a turn on average at 10 players on Wyrmland (turns will run on Cloudflare in M4). Report the average and the worst.
- **Simple to play:** nothing changes for the player except the lobby's bot level.

## Part 1: the Marshal and six personalities
- **A new bot, the Marshal,** in `packages/bots`, built **separately from the Captain**. It may start from the Captain's board reading (`readBoard`) and judgement, but changes go into the Marshal's own code, not the Captain's.
- **Personalities as data** (weights and switches in `packages/content`, one block each), so they're tuned without code changes. The first six (refine them, and add one if the sims show a winning style that isn't covered):
  - **The Conqueror:** picks one front and masses there, outmanoeuvres the armies in front of it, holds its other borders with just enough.
  - **The Blitzer:** expands as fast as it can every turn, chains everything it can, defends little.
  - **The Turtle:** slow and sure; forts, culture and markets first, expands only into safe land, then strikes late with a big army.
  - **The Schemer:** lives on deals: truces it means to break at the right moment, joint wars that serve itself, and spies. It breaks deals only when the gain is worth the Oathbreaker penalty, as today.
  - **The Opportunist:** a vulture; hits whoever just fought, the weakened and the overstretched, and the leader's exposed flank.
  - **The Merchant:** trades, markets and peace early, then a rich late push.
- Each game mixes personalities **at random from the game's seed** (no two the same until all six are used).
- **The plan is reusable:** the Marshal's planner should be able to plan for "the whole realm" or for one task (an army, a front, the realm's building), from one player's view, so session 18's leaders can call it with a scope and a purse.
- **Tests:** each personality's signature shows up in play (for example, the Turtle builds more forts and culture by turn 10; the Blitzer holds more land by turn 8 and loses more of it), determinism, no cheating (the fog check above), and the Captain's fingerprint.
- **Commit and push.**

## Part 2: learn what wins
- **A tournament in the sim:** personalities against each other and against Captains, on Embervale (4), the Twin Realms (6), Wyrmland (6 and 8) and Greatmarch (10), at least 300 games per table, everything on. Add a `marshal-<personality>` seat kind for `--mix`.
- **Measure behaviours, not just wins.** For every seat and game, record things like: land by turns 5, 10 and 15; how many fronts it fought on; how concentrated its armies were; when it first built a fort, a market, culture; gold spent on troops vs buildings vs culture vs spies; deals made and broken; joint wars joined; how often it attacked the leader.
- **Find what wins:** which behaviours go with winning (compare winners with the rest of their table, and each behaviour's win rate), at each table size and map size. Use plain statistics; keep it explainable.
- **Build it in:** the winning behaviours go into the Marshal's shared judgement, under every personality (a Turtle that wins more is still a Turtle). Then re-run the tournament to show the gain.
- Write it all up in `docs/sim-results-m3-marshal.md`: what wins, in plain words, with the numbers.
- **Commit and push.**

## Part 3: stopping a runaway (Nate's game)
Session 16 found the cause: under fog, each Captain counts only the land it sees or remembers, so on a big map it spotted a runaway in 21% of its turns, 8.6 turns late. The Marshal must do much better **without cheating**. Try the ideas in `docs/sim-results-s16.md`:
1. **Estimate land it can't see** from public facts and what it has watched happen (the land it saw a rival take in the replays, players knocked out and by whom, Spoils counts, the size of the armies it has met).
2. **React to pace, not only size:** a rival that took the most land over the last few turns is a threat before it holds 40% of the map.
3. **A lower bar on big maps and big tables.**
4. **Joint wars against the leader come early and stick:** Marshals propose and accept them readily, and actually attack.
- **A stronger stand-in for a person:** session 16's "fast expander" won only 16%; Nate won in 12 turns. Build a tougher stand-in (for example, the best Marshal personality playing with fog off, which sees everything as a sharp person piecing things together would), and test the Marshals against it on Wyrmland at 6 players: how early do they spot it, how many joint wars, and how often does it still win (fair is 17%)? Compare with the Captains in the same seat.
- Keep the Fallen's rules as they are (rule changes go to Nate in the balance pass); report how often they turn on the runaway.
- **Commit and push.**

## Part 4: the lobby, and making the Marshal the default if it's better
- **Bots:** Recruit (easy), Captain, **Marshal (hard)**. The lobby line says what each is like.
- **Personalities in the game:** they're hidden while you play (you learn them by how they play), and **revealed at the end of the game** on the game-over screen ("Lady Morwen, the Turtle"). Add a lobby option "Show personalities" (off by default) for people who want to know.
- **Mixed tables:** the lobby can mix levels ("2 Marshals and 3 Captains") with a simple control, or offer just one level for all bots if that's much simpler (say which you chose).
- **The Marshal becomes the default** if it clearly beats the Captain (for example, one Marshal of each personality at a table of Captains wins well above its fair share, and a table of Marshals holds the strong stand-in to near its fair share). Report the numbers either way; if it isn't better yet, keep the Captain as the default and say what's missing.
- **The Fallen bots and bot takeover** (later, for quitters in M4) can use the Marshal; switch the Fallen bots over only if the sims show it's better.
- **Tests,** including saves keeping each bot's level and personality.
- **Commit and push.**

## Part 5: sims, write-up, screenshots, deploy
- **The headline numbers** in `docs/sim-results-m3-marshal.md`:
  - one Marshal (each personality) against Captains: win rates at 4, 6 and 10 players
  - a table of Marshals vs a table of Captains: game length, the three runaway measures, seat fairness
  - the strong stand-in against Marshals and against Captains: its win rate, and how early it was spotted
  - the Marshal's planning speed (average and worst, 10 players on Wyrmland)
- **Rules reference:** the bot levels and personalities.
- **Screenshots** (desktop and a 384 px phone), in `docs/art/screens/s17-*.png`: the lobby's bot choice, the game-over screen revealing personalities, and Wyrmland at Far with the uncluttered names.
- `pnpm deploy:preview` passes its lock check.
- **Commit and push.**

## Out of scope
- **Session 18:** leaders you delegate to (your named Leader and a Steward, budgets and purses, the big command list), which will call the Marshal's planner.
- **Session 19:** bigger maps (about 160 and 200 territories) and the balance pass, including any rule changes (such as letting the Fallen act sooner).
- **Session 20:** the polish pass and art batch 4.
- **Not in this session:** shared sight between partners, changes to the Captain or the Recruit.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`. **Run the full `pnpm test` twice before your last push** (property tests use random inputs), and ask Nate to check the repo's Actions page for your last commit (`gh` isn't installed on his computer).
- `docs/sim-results-m3-marshal.md`, the screenshots, and `pnpm deploy:preview` with its lock check.
- **Nate isn't play-testing until after session 18.** Instead of asking him to play, add what to try to **"Things to test after session 18"** in `PROGRESS.md`: for example, a 6-player Wyrmland game against Marshals ("try to run away: do they team up on you, and when?"), and whether the personalities feel different.
- `PROGRESS.md` (with "Claude Code sessions completed" bumped to **17**), `docs/decisions.md`, `docs/rules-reference.md` and `docs/04-design-additions.md` (if anything changed) are updated in simple language.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the personalities as built (one line each), and any you added or merged
- what wins, in five lines or fewer
- the Marshal against the Captain, and against the strong stand-in, with numbers
- whether the Marshal is now the default
- the Marshal's planning speed
- the two red tests: what you changed
- the screenshot paths
