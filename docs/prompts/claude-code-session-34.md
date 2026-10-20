# Claude Code: Session 34 (M5 part six: scale and safety: bigger tables, abuse limits, the map lab off in production)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs the simulator with its 19 workers, Wrangler (logged in there), `wrangler dev` with the table harness, his browser and deploys.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session is scale and safety, before strangers** (`docs/11-launch-plan.md` §2 and §8). Three things:
1. **Bigger tables:** up to **10 people and 20 seats** on the 200-territory maps (Krakenmere, Rootholm) and the random 300s and 400s, with the sim's numbers before the limit moves (M4's number: 22 to 38 ms a turn at a table of 4; the room has 30 s; session 33b: 243 ms a turn with 10 Marshals on a 400).
2. **Abuse limits:** a report button on a chat line (it reaches Nate's email), a block list, a daily cap on the tables a player can host, and limits on what a page can ask the room for. Sign-in rate limits wait for session 36 (sign-in is Access until then).
3. **The map lab off in production** (a build flag; on in `wrangler dev`).

**Every balance value lives in `packages/content`**, standard-fog games on the twelve official maps stay byte for byte the same (nothing here should move the fingerprints; if something must, stop and say so), and every claim comes with the sim that shows it. Launch polish (the install flow, the open-graph preview, the voice pass, the load test) is session 35; sign-in and Workers Paid are 36: don't start them.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit, run the deploy (where the part says so), push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

**The parts are in priority order; Parts 1, 2 and 3 each end with a deploy,** so the session is complete at any of those boundaries. Whatever isn't reached goes to the next session; say what's left. Nate may be playing the preview while you work, so every deploy must be a working build, and **a game already running on the server must survive a deploy** (a random map pins its version and its try; a running game keeps its map and its seats). Long sims run in the background (19 workers) while you go on.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: "Oct 19: Orchestrator review of session 33b" (Nate's calls, for Step 0), and **every "Nate's play test" entry after session 33b** (his solo notes outrank anything below)
3. `docs/11-launch-plan.md` §8 (scale and safety: what this session builds) and §2; `docs/10-online-plan.md` ("M4 as built": the room, the table, seats, the chat's limits, the harness)
4. `docs/sim-results-m5-random-maps.md` (session 33b: 300 and 400, the CPU per turn, the turns at 10 players, the seeds that fail), `docs/sim-results-m3-balance.md` ("The seat rule"), `docs/sim-results-m3-diplomacy.md` (the runaway rule: bots team up on a leader)
5. `docs/04-design-additions.md` §2 (diplomacy, deals are public), §13 (voice and chat, as built: the chat's limits), §9 (maps), `docs/06-art-direction.md` (the Houses' colours), `docs/infra-cloudflare.md` (the Free plan's limits, the email binding, D1)
6. `docs/voice-guide.md` (every new line a player reads), `docs/decisions.md` (the Oct 19 lines at the bottom)
7. The code: `apps/web/server/online.ts` (the Worker's routes: make a table, join, the lists; the bots' bounds), `apps/web/src/host/roomCore.ts` (`createTable`, `start`, seats, the chat and its rate limit, `hello`), `roomMaps.ts`, `protocol.ts`, `apps/web/src/ui/OnlineBlock.tsx`, `TableScreen.tsx`, `Lobby.tsx` (the opponents' count, the remembered map), `RandomMap.tsx` (the seed and the picture), `apps/web/src/ui/` (the Houses panel, the chat panel), `packages/content/data/maps/krakenmere.json` and `rootholm.json` (`capitalSlots`: 28 and 32; `capitalLayouts` for 2 to 10), `packages/mapgen/src/capitals.ts` (the layout search, the exposure band), `randomId.ts` (`RANDOM_PLAYERS`), `packages/engine/src/setup.ts` (the seat rule), `apps/sim/src/tournament.ts` and `apps/sim/scripts/s30-sims.ts` (`--random`, the CPU-per-turn line), `apps/web/scripts/table-harness.mjs` (several accounts against `wrangler dev`), `apps/web/src/lab/` (the map lab, the sound bench, the House lab, the known-map page: `?lab=`), the email binding's sender (session 29's "your turn" email)

## Step 0: sync and the fixes from the review
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **Nate's solo notes after 33b** in `PROGRESS.md`: do the small ones here; list the rest for the orchestrator.
3. **The lobby keeps the last random map (Nate's call, Oct 19).** Today, when Random is the remembered map, every visit to the lobby rolls a new seed and builds it (a 400 costs a phone 10 to 20 seconds of work just for opening the lobby). Keep the last seed and its picture (and its try) across visits; roll a new seed only on Reroll, or when a game was started with that seed (single player or a table made), so the next visit offers a fresh one. A typed seed stays typed. Test: the lobby reopened shows the same seed and builds nothing.
4. **The start-up bundle sits at 398.2 KB against 399.0.** The allowance is **400.0 KB** for this session (the opponents' list to 19 and the Houses' colours add a little). Anything heavier (the report dialog, the block list's panel) loads with the game screen or the table, not the lobby.
5. **Commit, deploy, push.** (Run the full `pnpm test` before this and every push.)

## Guardrails (all parts)
- **Standard-fog games on the twelve official maps are byte for byte the same** after every part: the `--digest 4 20 --seed s30d` run gives `dc8962d4f8ba3bc6`, the Captain fingerprint `232617a30b1f8b47`, and the same seeded sim at the commit before and after (`pnpm sim --games 40 --players 6 --map wyrmland --bots marshal --seed o34`). New capital layouts for 11 to 20 players are added beside the existing ones, never in their place; a map's geometry doesn't change (the map lab's fingerprint of each official map is the same).
- **Only `viewFor` leaves the room** (`apps/web/test/fog-wire.test.ts` with its planted-leak discipline): a report, a block, a bigger table carry nothing of anyone else's view. A 20-seat table's hello is still one seat's view.
- **Bots never cheat** (`apps/sim/test/blackout-honest.test.ts` keeps passing) and never anything heavy in the Worker's handlers: the room does the work, and the Free plan's 10 ms on the handlers holds (session 29's numbers: 3 ms warm, 6 to 16 ms cold).
- **Every new line a player reads** in the voice (`docs/voice-guide.md`): the report dialog, the block list, the limits' refusals ("You've made 20 tables today. Tomorrow."), no sarcasm in errors.
- **The lobby stays decluttered** (Nate): the opponents' count grows to 19 on the big maps; nothing else new in the lobby.

## Part 1: bigger tables (the first deploy)
1. **Seats:** a table of up to **20 seats** on Krakenmere, Rootholm and the random 300s and 400s (their `maxPlayers` 20; the smaller maps keep theirs), and up to **10 people** at any table (the rest bots, the seat rule as now: harder spots to bots first). The lobby's opponents' count runs to the map's maximum minus one; the table screen shows the seats in two columns on a desktop and a scrolling list on a phone; the Houses panel in the game shows 20 rows on a desktop and, on a phone, the people and the top bots with "and 12 more" that opens the rest (design: `docs/04-design-additions.md` §13's panel rules, no territory counts).
2. **Capital layouts for 11 to 20 players:** the official 200s have 28 and 32 capital slots and layouts to 10; make layouts for 12, 14, 16, 18 and 20 (and 11, 13, 15, 17, 19 by the nearest even layout minus the most exposed spots, or their own: say which) with the map maker's capitals stage (the exposure band 4.0, the same search the randoms use with 60 starts), pinned into the map files beside the old ones; Nate OKs nothing here (the picture doesn't change). The random 300s and 400s: `RANDOM_PLAYERS` to 20 (300: up to 16, say, if the layout search fails too often at 20; 400: 20), and the share of seeds that pass at 12, 16 and 20 players (`scripts/try-random.ts`): if more than three in ten fail at 20, say so and propose the band.
3. **Twenty House colours:** the Houses' palette has 10; a 20-seat table needs 20 Houses a person can tell apart on the map (the realm wash, the pills) and in the panel (the shields). Extend the palette to 20 in `docs/06-art-direction.md`'s spirit (dark and light pairs, or a second row with a two-tone shield), names for the new Houses (House Sanguine, House Verdigris...: the heraldic tincture style the ten have), and a screenshot of a 20-seat table at Far and Mid for Nate's eye. Colour never carries game state alone (the pills say whose).
4. **The sims, in the background (the bars decide):** `pnpm sim --games 100 --players 20 --map rootholm --bots marshal --seed s34` and the same on Krakenmere; `s30-sims.ts --random 400:all:50 20 --seed s34` and `300:all:50 16`; and 12 players on each. Report: turns (average, within 40, within 60; Classic and Conquest), by seat and by exposure against fair (**±5** of fair at 20 seats is a wide bar: fair is 5%, so also say the furthest seat's share of fair), the runaway rule's effect (how often the leader after turn 10 wins; the bots teaming up), the Fallen's share of events, and **CPU per turn** (the sim's line: the average and the worst turn with 20 Marshals; **the bar: the worst turn under 5 s**, the room's limit is 30 s). If a 20-seat Classic on a 200 runs past 60 turns on average, say so: Conquest is suggested from 8 players already; Nate's rule allows bigger tables to run longer.
5. **Live:** `wrangler dev` with the table harness: a 20-seat table with 10 people (ten harness accounts) and 10 bots on Rootholm, three turns: the clock, lock-in early, the replay in step on every page, the chat with ten people, the table's list rows; the room's turn time from `wrangler tail`'s numbers in dev (say the CPU of a turn). Then on the preview in Nate's Chrome: a 20-seat table with bots on a random 400 (the table screen, the Houses panel, turn 1's time) and resign.
6. **Write-up:** `docs/11-launch-plan.md` §8 a BUILT line; `docs/10-online-plan.md` "M4 as built" the table's new size; `docs/06-art-direction.md` the twenty Houses; `docs/sim-results-m5-scale.md` (new: the tables, the CPU, the turns, the reading); `docs/rules-reference.md` ("Online": tables of up to 20); `docs/decisions.md`. **Tests:** the layouts pinned (each official 200's new layouts build the same spots), the seat rule at 20, the table at 20 seats and 10 people in the room's tests, the panel's words, the colours distinct (a test on contrast between every pair in the palette), the twenty Houses' names in the voice. **Deploy. Commit and push.**

## Part 2: abuse limits (the second deploy)
1. **Report a line:** on any chat line from another person (the table, a one-to-one, a group), a Report action (long press on a phone, a small button on hover on a desktop) with one reason picked from a short list (abuse, spam, cheating, other) and an optional line of words; it goes to **Nate's email** through the email binding (the game id, the table, who, the line, the reason, the time; nothing else of the game), rate limited (three reports a player a day; a line can be reported once by a person). The reporter sees "Reported. Nate reads these." in the voice. Reports also land in D1 (`reports`: a migration) so a session can list them later.
2. **A block list:** Settings → Blocked players: block a person from a chat line's menu or from the Houses panel; a blocked person's chat lines (table, one-to-one, group) don't reach you (the room filters by the reader's block list, so nothing of theirs travels to your page: fog-wire style), their offers still do (deals are the game, Nate's rule) with the name as always; unblock from Settings. The list lives in D1 by user (`blocks`), read by the room on hello; the blocked person is never told. A block outlives the game.
3. **Caps in the Worker and the room:** a player hosts at most **20 tables a day** (the Worker counts by user and day in D1; the 21st gets "You've made 20 tables today. Tomorrow." in the voice); a page's room messages beyond a sane rate (say 30 a 10-second window, the chat's own limit inside it) are dropped with one notice; joins by invite code beyond 10 a minute an IP are refused in the Worker (no sign-in rate limits: Access signs in until 36). All of it measured in the handlers (well under 10 ms warm; the room does the counting where it can).
4. **Write-up:** `docs/11-launch-plan.md` §8 BUILT lines; `docs/10-online-plan.md` (the room's new messages); `docs/rules-reference.md` "Online" (report, block, the caps, in plain words); `docs/infra-cloudflare.md` (the two tables, the email's shape); `docs/decisions.md`. **Tests:** the room's filter (a blocked person's line never reaches the reader: a fog-wire style test with a planted bypass that fails), the report's email body (nothing of the game but the line), the caps (the 21st table, the 31st message), the words in the voice. **Deploy (a migration: `pnpm deploy:preview` applies it). Commit and push.**

## Part 3: the map lab off in production (the third deploy)
1. The map lab (`?lab=...`, the known-map page from 32 among it) behind a build flag: on in `wrangler dev` and `pnpm dev`, off in the deployed build (the route answers the lobby; nothing of the lab in the production bundle, so the start-up bundle may shrink: say by how much). The random-map build (the lobby's picture) is not the lab and stays.
2. **Write-up:** `docs/11-launch-plan.md` §8 BUILT, `docs/07-map-tooling.md` (how to open the lab now), `docs/decisions.md`. **Tests:** the production build has no lab route; the dev build does. **Deploy. Commit and push.**

## Part 4 (can slip): the Turtle under blackout, as a dealt seat
1. Session 33b's Blitzer runs read the dealt Turtle seats at 12.4% under blackout against 21.3% with standard fog (900 games; a different measure from session 33's fixed Turtle seat, which met its bar at 900 games: 18.5% against 22.8%). Run the dealt measure on purpose: `tournament.ts --table embervale:4 --seats marshal,marshal,marshal,marshal --games 900 --fog blackout|on --seed s34`, every seat dealt, and read each personality's dealt number under both. If the Turtle's two numbers are more than 5 points apart, one more knob in its `blackout` block (three settings at most, the same bar, nothing with standard fog). `docs/sim-results-m5-blackout.md` gains the table either way. **Commit and push.**

## Last: the test list
- **"Things to test after session 34"** in `PROGRESS.md`, most important first: a 20-seat table with bots on Rootholm (the table screen, the Houses panel on the phone, can you tell the Houses apart at Far?); a table with a friend where you block them and they write (later, with a friend); a report sent (does the email arrive?); the lobby reopened with a random 400 remembered (no build); carry over what Nate hasn't tried.
- `PROGRESS.md` (sessions completed: 34), `docs/decisions.md`.
- **Commit and push.**

## Out of scope (sessions 35 and after)
- Launch polish and the load test of 20 tables (35); sign-in, Workers Paid, sign-in rate limits (36); the purchase and the site (37); battle royale (38); the random 80's layout rule (a later balance pass, Nate's call); a top-tier bot above the Marshal (later).

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass; everything is committed and pushed to `main`. **Run the full `pnpm test` before every push and twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- Standard fog unchanged after each part: the digest `dc8962d4f8ba3bc6`, the Captain fingerprint `232617a30b1f8b47`, the seeded sim identical before and after. The honesty test and the fog-wire test pass, the latter with the new messages covered.
- The sim's numbers for 12 and 20 seats on the 200s and the big randoms: turns, by seat, CPU per turn (the worst turn under 5 s).
- The start-up bundle within the allowance (400.0 KB); the lock check passes on every deploy; running games survive each deploy.
- Played on the preview in Nate's Chrome: a 20-seat table with bots on a random 400 (screenshots: the table screen, the Houses panel, the map at Far with 20 Houses) and a report sent to Nate's email from a test table; both tables resigned.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which parts were finished and which slipped
- Step 0: what Nate's notes changed (one line each), the lobby's remembered map in a line
- the sim table: 12 and 20 seats on Krakenmere, Rootholm, a random 300 and 400: turns, by seat, by exposure, CPU per turn
- the harness: 10 people at a 20-seat table in dev (the turn's time)
- the twenty Houses (the names and the colours), with the screenshots named
- the abuse limits: what each does and its numbers
- the digest, the fingerprint and the seeded sim, unchanged (or exactly what changed and why, if a part had to)
- the deployed version
