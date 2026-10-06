# Claude Code: Session 16 (M3: Nate's play-test fixes, art batch 4 in, then the balance pass)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his art, his browser and a deploy.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session:**
1. **Nate's play test of sessions 11–15:** fix what he found.
2. **Art batch 4 in:** register every piece, teach the importer the new black-background effects art, and put the drop-in pieces in the game. The effects themselves come in session 17.
3. **Spy upkeep only while away** (Nate, Oct 6).
4. **The balance pass:** shorter big games with bots that offer fewer truces, runaways, seat fairness, and a speed check before M4.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit and push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

The parts are in priority order. **Part 4 ends with the deploy, so the session is complete there.**

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: the last entries, especially **"Nate's play test of sessions 11–15"** (the orchestrator records it before this session runs; if it isn't there, ask Nate for his notes before Part 1), and the orchestrator's review of session 15
3. `docs/decisions.md`, newest lines at the bottom
4. The sim write-ups: `docs/sim-results-m3-spies.md`, `docs/sim-results-m3-diplomacy.md`, `docs/sim-results-m3-cards.md`, `docs/sim-results-m3-generals.md`
5. `docs/04-design-additions.md` §0 (simple to play, deep to master), §2 (diplomacy, including Nate's calls after session 14), §8 (spies, including the upkeep change)
6. `docs/art/asset-list-and-prompts.md` (Tier 3, "Batch 4") and `docs/09-polish-and-effects-plan.md` ("How it's built": the importer rule)
7. `packages/bots/src/diplomacy.ts` and `captain.ts`, and `apps/sim/src/cli.ts`

## Step 0: sync
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. Check what's in `art/incoming/` and `art/incoming/_review/` (batch 4's contact sheets). Don't import yet: Part 2 does it.
3. **Commit and push** if anything changed.

## Guardrails (all parts)
- **The hard rules in `CLAUDE.md`:**
  - the engine stays pure and deterministic (seeded randomness only)
  - every engine change has tests, and the determinism test passes
  - balance values live in `packages/content`
  - clients only get `viewFor`
- **Nate's standing calls on balance:**
  - **Game length is measured in turns: up to 30–40.** Bigger maps and 10-player games may run longer.
  - **Fix runaways and length in the bots first, not the rules.** If a rule change looks necessary, don't make it: put the options and their sim numbers in your summary for Nate.
  - Keep the Fallen's comebacks (Nate kept their +3 turns at 10 players on purpose).
- **Keep the Captain explainable:** every deal answer still has its one plain reason, and its play with diplomacy off stays as recorded unless you change it on purpose (then re-record the fingerprint and say why).
- **The Recruit stays easy.** A new player should beat three Recruits on Embervale most of the time.
- **Saves:** if the game's shape changes, bump the version with a migration; the session 13 and 14 fixtures keep loading.
- **Simple to play:** a basic turn is still 6 taps on a 384 px phone (run `tap-count.mjs`).

## Part 1: Nate's play-test fixes
- Fix what Nate found in his play test of sessions 11–15 (in `PROGRESS.md`), smallest and clearest first. Each fix gets a test where it can.
- Anything big or that needs a design call: list it in your summary with a recommendation, and don't build it.
- **Commit and push.**

## Part 2: art batch 4 in, and spy upkeep
- **Register every batch 4 name** in `packages/art/src/registry.ts`, and move the list in `docs/art/asset-list-and-prompts.md` out of Tier 3 into its own `## Batch 4` section after Batch 3. Update the art-list test so it counts Batch 3 and Batch 4 (it reads from the `## Batch 3` heading onward today).
- **Teach the importer the black-background effects art:** `fx-` pieces marked "black" in the list are painted on pure black. Turn brightness into transparency and keep the colour (premultiplied, so smoke and flames have soft edges with no dark fringe). Magenta `fx-` pieces are cut out as usual. Test both with small made-up images, as the magenta tests do.
- **Run `pnpm art:import`.** Then the drop-in pieces go straight into the game:
  - `terrain-hills`, `tree-conifer-1` and `-2`, `scaffold`, `bridge-wood`
  - the icons and figures for Rangers, the Standard-bearer and the spy (replacing the placeholders; the spy's map badge uses the new art)
  - Judge them on the art bench (`?lab=bench`): before/after pictures in `docs/art/screens/compare/` (the `compare.ts` script), at Far, Mid and Near, desktop and phone. If a piece looks worse than today's, keep today's and say so.
- **Everything else in batch 4** (effects, key art, the scenery additions, the windmill parts) is registered and imported but **not used yet:** session 17 builds the polish pass with it. If some pieces are missing, note which.
- If no batch 4 art has arrived, do the registry and importer work, skip the import, and say so.
- **Spy upkeep only while away (Nate):** a spy costs nothing a turn while it's in your own land (at home or guarding a province), and 1 gold a turn while it's travelling or inside land you don't hold. Numbers in `packages/content`. Update the Hire menu's line, the rules reference and the tests. Re-run the mixed spies/no-spies Captain tables (4 and 6 players, 500 games) and report.
- **Commit and push.**

## Part 3: the balance pass
Measure first, change the bots, then measure again (500 games each, with every system on unless noted). The numbers to beat, from session 15 (4 / 6 / 10 players): **27.1 / 36.1 / 44.9 turns; 92% / 69% / 35% within 40; halfway leader wins 75% / 66% / 71%.**
1. **Fewer truces at big tables (Nate's call):**
   - Bots offer fewer truces when many players are left, and stop offering "we don't even share a border, so peace costs me nothing" truces (they only pad the count).
   - Bots offer shorter truces (2 turns) unless they have a reason for longer.
   - Look at what else keeps big tables slow (for example, bots sitting behind truces while a weak neighbour is there to take). Fix it in the bots.
   - Report length, within-40 and deals per game before and after.
2. **Runaways:** the halfway leader still wins 66–75% of games. Look at why (the leader's growth by turn, how often joint wars against it form and work, whether bots under fog see it in time) and improve the bots' answer to it. Don't hand the leader's rivals free power.
3. **Seat fairness:** check every map at its suggested table sizes (500 games each). Any seat more than about 5 points from fair: find out why (the capital layout, a choke point) and fix it in the map's capital layouts, with Nate's OK on the before/after picture if the map looks different.
4. **The cost in turns of each system** (one table, 4 / 6 / 10 players): the Fallen, Spoils, Fate, diplomacy and spies, each switched off on its own against everything on. This tells Nate what each system costs in length, so he can choose later.
5. **The Recruit stays easy:** a seat of "best Captain play" against three Recruits on Embervale should win most games. Report the rate.
- **Speed check before M4** (online, where turns run on Cloudflare): CPU per turn (resolving and all bots planning) at 10 players on Wyrmland and on the Ringsea with every system on, average and worst; replay length; and the frame rate of the replay on a 384 px phone profile. Report anything slow, with the cause.
- Put every number in `docs/sim-results-m3-balance.md`, with a short "what changed and why" at the top.
- **Commit and push.**

## Part 4: write-up, screenshots, deploy, play test
- **Rules reference:** update anything the balance pass or the fixes changed, and "Not in yet".
- **An M3 checklist** at the end of `docs/sim-results-m3-balance.md`: each M3 item in `docs/03-build-plan.md` marked done, partly done (what's missing) or moved, so the orchestrator can close M3 after session 17.
- **Screenshots:** the batch 4 drop-in pieces in the game (desktop and a 384 px phone), in `docs/art/screens/s16-*.png`, plus the before/after pictures from Part 2.
- `pnpm deploy:preview` passes its lock check.
- **Commit and push.**

## Out of scope
- **Session 17, the polish pass** (`docs/09-polish-and-effects-plan.md`): the effects layer, the cinematic replay, the living map, menus with weight, the title and game-over art, and the scenery additions (narrow peaks, diagonal ridges, side cliffs, forest-edge bushes, glades, paper grain, turning windmills). Don't start any of it, even if there's time; spend spare time on the balance pass.
- **M4:** online with friends, deals between people, multiplayer pause by vote.
- **M5:** tutorials and scenarios, random maps, blackout fog.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`. **Run the full `pnpm test` before your last push.** Ask Nate to check the repo's Actions page for your last commit (`gh` isn't installed on his computer).
- `docs/sim-results-m3-balance.md` with the M3 checklist, the screenshots and before/after pictures, and `pnpm deploy:preview` with its lock check.
- **Then ask Nate to play on the preview:**
  1. **Laptop, 6 players on the Twin Realms, Captain bots, everything on:** how many turns did it take, and did the bots feel smarter about the leader?
  2. **Laptop, 4 players on Embervale against Recruits:** still easy?
  3. **Phone:** do the new hills, pines, scaffold and bridge look right? The Rangers, Standard-bearer and spy pieces?
  4. Anything from his play test that still feels off.

  Record what he says.
- `PROGRESS.md` (with "Claude Code sessions completed" bumped to **16**), `docs/decisions.md`, `docs/rules-reference.md` and `docs/04-design-additions.md` (if anything changed) are updated in simple language.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- Nate's fixes (one line each), and anything big you listed instead
- batch 4: what went in, what's waiting for session 17, what was missing or kept back
- the balance table: length, within 40, halfway leader, comebacks, before and after (4 / 6 / 10 players)
- the cost in turns of each system
- the Recruit's win rate, seat fairness, the speed check
- any rule changes you'd suggest (not made), with numbers
- the screenshot paths
- what Nate said after playing
