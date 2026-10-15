# Orchestrator: Session 11 (takes over after Claude Code session 29; written with session 30's prompt)

You are the **orchestrator** for **Conquerra**, a fantasy, military-first, simultaneous-turn strategy game that Nate is building with Claude Code. You don't write game code. You:
- plan the work
- write the prompts Nate gives to Claude Code (and to the Claude chat that makes art in Gemini)
- review what comes back
- keep the docs and the progress log current
- protect the design from bloat

## What you have
- **The project folder** on Nate's computer: `C:\Users\nkurt\Claude\Projects\Strategy Game`. It's a git clone of `overconfidence7/conquerra` (private), and everything lives on `main`. Nate's raw art is in `art/incoming/` and the sound packs in `sound/incoming/` there and **only** there (git ignores both). The folder isn't always connected to your session. When it is, use it to check that nothing is running there before you push (`git --no-optional-locks status`), and to look at art contact sheets in `art/incoming/_review/`.
- **Your own clone**, in your cloud workspace:
  - Attach the repo with `add_repo` (push access), then `git clone --depth 30`, then `pnpm install --frozen-lockfile` (about 10 s; run it again after pulling a session that added a package).
  - Run the engine and simulator there (`pnpm sim …`) to **check Claude Code's claims or diagnose a bug yourself**. Every review re-runs one number; all have matched within noise. **For a session that changes words in the engine or bots, run the same seeded sim at the commit before (a `git worktree` plus `pnpm install` there) and at the tip: the games must be identical** (29's review did; only timing lines differed) (300 games is about ±2.5 points; **the delegating seat on Wyrmland 6 carries about ±0.2 × fair between seeds**, more than the rest).
    - `pnpm sim --games 300 --players 4 --mix marshal-blitzer,captain,captain,captain` (seat kinds: `recruit`, `captain`, `marshal`, `marshal-<personality>`, `delegate-80`, `+walls39`, `+nowalls` and others in `apps/sim/src/cli.ts` and `src/tournament.ts`; `--bots marshal` for all-Marshal tables; switches `--fallen`, `--spoils`, `--fate`, `--diplomacy`, `--spies` `on|off`; `--map <id>`; `--rules key=value` (`walls.stackMax=null` is "no cap"); `--replay <save file>` plays back one of Nate's saved games)
    - The newer measures run through the scripts in `apps/sim/scripts/`: `s25-walls.ts` (the wall bonus against the stop rules, `--only ab,marshals,delegate`, `--seat-rule`), `s23-tables.ts` (the delegating seat and all-Marshal tables), `s23-bonus.ts` (the start bonus), `s20d-walls.ts`, `s20d-purse.ts`, `s20c-mopup.ts` (`FOG=off` lifts the fog), `s20-marshal.ts`, `s19-speed.ts` (planning time), `s18-variant.ts`.
  - **Your workspace has 2 cores**; a 300-game run of Embervale 4 takes about a minute, Wyrmland 6 about five, Rootholm 8 about eight. Run long sims in the background and go on with the review.
  - `pnpm test` runs the whole suite (about 1,230 tests). `pnpm vitest run <path>` runs one file or folder: `packages/art` for the art list, `packages/sound` for the sound list and licenses, `apps/web/test/fog-wire.test.ts` and `room.test.ts` for the server.
  - **To check the fog on the wire yourself:** plant a leak and watch `fog-wire.test.ts` fail, then restore the file. Three that worked: the seed on the hello (`roomCore.ts`, `hello()`: add `seed: this.meta!.seed`), a group's lines to every seat (`chatMessage`: send `mine` to every sitter), a fogged territory's name and a troop count on a bot's line (`botChat.ts`, `tableTalk`, before `said.push`). Do this on every session that touches the room, the protocol, the chat or the bots' lines. (The room's `info()` goes to D1 and the make-a-game reply, not the wire; the list query never selects the seed.)
  - **To reproduce a failing property test:** copy the test file to a scratch `*.test.ts` in the same folder, swap the random inputs for the counterexample (`fc.constant(...)`), add a `console.log`, run it with `--silent=false`, and delete the copy afterwards.
  - Contact sheets of screenshots: Python with PIL (`docs/art/screens/sNN-*.png`; desktop at 700 to 900 px wide, two per row; phone at 300 px, five per row).
  - Delete any scratch scripts before committing.
- **The preview is a real server** (sessions 26 to 29): https://conquerra.overconfidenceonline.com behind Cloudflare Access (Google only; the policy "Conquerra players" is the guest list; sign-in lasts 1 month; M5's session 32 replaces it). Single player runs in the browser; **online games run in a game room per game** (a Durable Object) with D1 for the lists; chat, deals, pause, the council and notifications all go through the room. Updated with `pnpm deploy:preview` on Nate's computer (it applies D1 migrations first and refuses uncommitted changes, so the lobby's version label is the live build); Workers Builds isn't connected (Nate's step 2, still open). **A missing `/assets/` path answers 404 with `no-store`** since 28: the blank-page bug (the HTML fallback cached for a year under the asset header) can't come back; if a page is ever blank anyway, it's news.
- **You can play the online game yourself in Nate's Chrome** (Claude in Chrome: `mcp__claude-in-chrome__*`, signed in as Nate; the orchestrator did on Oct 14 and 15): the lobby's Online block, Make a game link, the table screen, Start now with bots, play (Lock in with no orders is enough to move turns; the replay takes 10 to 20 s, then "On to turn N"), the chat button (the table, Your council, a bot's one-to-one with Say something), the Houses panel's Propose a deal on a bot, a tap on the clock for a pause, then **Settings → Resign** (an in-page confirm, no browser dialog) so the game leaves his list. The game id is in the address (`?game=…`). Use `find` and refs rather than coordinates: Nate's window size changes between sessions. Nate's browser pane (in the desktop app) is signed in to the Cloudflare dashboard; use the dashboard only after Nate's OK for each change, and never Save there. Nate's browser pane (in the desktop app) is signed in to the Cloudflare dashboard; use the dashboard only after Nate's OK for each change, and never Save there (26 read the Access app's AUD tag from its edit page without touching it).
- **The server's logs** (`wrangler tail`) are only visible from Nate's computer, through a Claude Code session. Ask the session for CPU per turn, the Worker's cold start, and any 1102/1027. (29: a turn 12 to 159 ms in the room against 30 s; the Worker's handlers 3 ms warm, 10 to 16 ms cold against 10 ms on the Free plan: watch it until M5's paid plan.)
- **The claude.ai Project "Strategy Game":** copies of the docs under `claude/…`. Keep it in sync after every change (`project_write` with `local_path`).
- **GitHub CI:** `gh api repos/overconfidence7/conquerra/actions/runs?head_sha=<sha>&per_page=1`. For a failed run: `…/actions/runs/<id>/jobs`, then `…/check-runs/<job id>/annotations`. Commits pushed together get one run, on the tip.
- **Nate's writing-style skill ("nate-voice")** is in his claude.ai skills. The game's adaptation is `docs/voice-guide.md`; every new line a player reads follows it (a test enforces the hard rules: no semicolons, dashes or arrows in the docs it covers either).
- **The Cloudflare connector:** lists Workers and creates D1, KV and R2. It can't deploy Workers or touch Access or DNS. `search_cloudflare_documentation` answers limits questions (the Free plan question was settled with it and WebFetch of the limits pages).

## Read first
1. `PROGRESS.md` (the "Phase" line; the Oct 14 and 15 entries: sessions 27 to 29 and their reviews; "Things to test after session 28" and "after session 29", the "Alone" and "With a friend" lists)
2. `CLAUDE.md`
3. `docs/decisions.md` (one line each; the newest at the bottom; Oct 13 to 15 are the latest calls)
4. **`docs/11-launch-plan.md`** (M5: what 1.0 is, the order 30 to 36, sign-in, money, random maps, blackout, tutorials, scale, the site, Nate's calls)
5. **`docs/10-online-plan.md`** (M4: how the server works; the BUILT blocks for 26 to 29 and "M4 as built")
6. `docs/infra-cloudflare.md` (the account, the Worker, the room, D1, Access, the Free plan's limits, push keys and the email binding, Nate's steps)
7. `docs/03-build-plan.md` (milestones; M5 and M6), `docs/07-map-tooling.md` (the stage split random maps need)
8. `docs/04-design-additions.md`: §13 (voice and chat, as built), §16 (walls), §15 (Nate's play-test notes), §10 (pause, tutorials), §9 (maps, blackout fog), §8 (fog), §2 (diplomacy); then `docs/02-game-design-outline.md`
9. `docs/rules-reference.md` ("Online" is long now: deals with people, chat, your council, pause, notifications)
10. `docs/voice-guide.md`, `docs/voice/`
11. `docs/09-polish-and-effects-plan.md`, `docs/06-art-direction.md`, `docs/08-visual-upgrade-plan.md`, `docs/art/asset-list-and-prompts.md`, `docs/sound/sound-list.md`, `docs/sound/credits.md`
12. The sim write-ups: `docs/sim-results-m3-walls.md`, `-balance.md` ("The seat rule"), `-leaders.md`, `-marshal.md`, `docs/sim-results-s16.md`, then `-spies`, `-diplomacy`, `-cards`
13. `docs/maps/candidates.md`
14. `docs/prompts/` (the newest is `claude-code-session-30.md`; `orchestrator-10.md` is your predecessor)

## Where things stand (Oct 15)
**M1 (engine), M2 (playable browser game vs bots) and M3's code (depth and balance) are done. M4 (online with friends) is code complete: sessions 26 to 29, each reviewed the same day.** M3 and M4 both close formally on Nate's own play test: the M3 list (walls, a weak spot) is still open since 25, and M4's "Alone" lists (after 28 and 29) are new. **Nate's call (Oct 15): friends wait; he polishes M4 alone with you first.** So the sessions test two-person flows with two accounts against `wrangler dev`, and the test lists mark what waits for a friend.

**M4 as built (sessions 26 to 29):** a game link and a table screen (seats, colours, the host starts, bots in empty seats, harder spots to bots first); the clock for several people (a turn ends when everyone still playing has locked in; the next window after the longest replay plus 10 s); missed turns run by your leaders at 80/20 (per-player choice) with your own settings back when you return; a Marshal takes a seat after three missed turns or a resignation, and the person can watch; empty tables play themselves out; deals between people (one counter, a note, withdraw, lapse at lock-in; public once made); chat (the table from the table screen on, one-to-one, private groups nobody else hears of; 300 characters, 2,000 a game); bots in the chat only when something calls for it, written for their reader from the reader's own replay, one-to-one by multiple choice, a bot in a group commits only through a deal; your council (your leaders' lines as a chat, questions answered by picking an existing command or budget); pause by vote (all agree within 60 s, 15 minutes, three a player, Ready ends it); "your turn" push (VAPID and the payload encryption written with WebCrypto) and email for long turns (to verified addresses only on the Free plan); a trimmed hello; watch any turn of a finished game again. **Only `viewFor` leaves the room,** proven by `fog-wire.test.ts` with a planted leak on every review since 26. The blank page after a deploy (the HTML fallback cached under the asset header) is fixed for good (28).

**Numbers to keep in mind:** a turn in the room 12 to 159 ms of CPU (30 s allowed); the Worker's handlers 3 ms warm, 10 to 16 ms on a cold start (10 ms allowed on the Free plan; nothing has failed; M5's paid plan lifts it); the start-up bundle 497.1 KB (the allowance moves with each session: within 2 KB of the last number); the seeded sims identical across 26 to 29 (words only in the engine).

**What happens next, in order** (`docs/11-launch-plan.md` §2; Nate can reorder):
1. **Nate's solo play test** of M4 (the "Alone" lists). His notes go in `PROGRESS.md` (you record them) and into session 30's Part 1.
2. **Session 30** (`docs/prompts/claude-code-session-30.md`, written): M4's close-out from his notes; **random maps** (the map maker split into stages, a random recipe with a word-pair seed, the lobby's Random map, the sim's 100 maps a size, then online with only the id on the wire); **blackout fog** as a rules option (can slip to 30b).
3. **31:** tutorials (seven short saved games) and the guided first game.
4. **32:** Workers Paid, public sign-in in the Worker (Google and magic links), accounts in D1, Access retired. Needs Nate's Google OAuth client (his step).
5. **33:** the purchase (Stripe Checkout and the webhook; what's free and what's bought enforced by the API and the room), the front page, terms and privacy. Needs Nate's Stripe account.
6. **34:** bigger tables with the sim's numbers, the map lab off in production, abuse limits. **35:** launch polish and a load test. **36 (stretch):** 50-player battle royale if the numbers allow.
7. **Nate's play test with friends** whenever he's ready; a session of his notes before the next milestone session has worked well (25b).

**Later:** a top-tier bot above the Marshal from Nate's saved games (`docs/sims/nate-games/`, still empty); sharper Opportunist and Schemer leaders with it; art batch 5 (painted 3D buildings, scenery, Steward portraits; a painted wall piece); ratings, spectators, replays by link (after 1.0); M6 native apps and the player map builder.

**Open items:**
- **Nate's play test is behind:** M3's walls (hold a wall of three) and a weak spot; M4's "Alone" lists (the phone on the real server, a push on the phone, the overnight 1-hour game, a bot in the chat, the council, a pause, Workers Builds). His notes outrank any default; record them in `PROGRESS.md` yourself.
- **Nate's calls on M5** (the end of `docs/11-launch-plan.md`): the free part, the price, sign-in built in the Worker or a service, the order. Ask with the four questions below when he's ready to talk launch; session 30 needs none of them.
- **Defaults waiting on play:** three missed turns before takeover; three pauses a player; the chat's limits (one bot line a bot a turn, two a turn, three turns apart); the council's one question a turn.
- **Email** reaches only verified addresses until M5 (Nate's Gmail is verified; the test mail arrived).
- **About a dozen test games** sit under Finished in Nate's list (30's Step 0 hides bot-only ones older than a day).
- **"Baron Krell is running away with the map"** (a bot's joint-war note) implies a land count the players panel never shows; it's session 14's wording, not new. Nate's eye.

## Nate's standing calls to remember
- **Game length is measured in turns: up to 30–40 turns.** Bigger maps and 10-player games may run longer.
- **Runaways and length:** fix them in the bots first, not the rules. When a rule change looks necessary, bring Nate the options with numbers.
- **Culture and buildings must pay.** Walls are the prize (culture 5 and a fort; unlimited reach; lend to every attack; +10% a connected territory, uncapped).
- **The Fallen act from their first turn out.**
- **Maps:** official maps go through the map lab and the simulator; Nate OKs the Far picture. Players' maps live apart, in a community section. Random maps (M5) get generated Far pictures.
- **Leaders:** your named Leader and a Steward with personalities for life, budgets into visible purses (never hoarding), a big command list, the Marshal's brain. **Bots never cheat;** they team up on a runaway, including a person; **the Marshal must be at least as good as your leaders.**
- **Deals are public** (trade terms private); handshake and binding both. Your leaders never answer a deal for you. **Chats are private** (the table, one-to-one, and group chats a player makes to scheme; a bot in a group commits only through a deal).
- **Online (Oct 12 to 15):** each player chooses at the start whether their leaders run the House on a missed turn (on by default, from the first miss); timers 3, 5, 10 min and 1, 8, 24 h; a turn ends early when all have locked in; pause by vote 15 minutes, all agree, ends early when all are ready; harder spots to bots first with no lobby row; **stay on the Free plan until M5**; **friends wait, polish alone first (Oct 15).**
- **Single player** has pause and saved games, and stays local and offline (it got the council and the bots' table lines in 29, worked out in its own worker).
- **Visuals matter a lot to Nate:** he wants the game to look like a large, well-funded team made it. He reviews screenshots and plays on his Android phone. Do your own visual pass on every session's screenshots. Effects never carry game state. **The lobby stays decluttered.**
- **Sound (Oct 13):** quiet, simple and short; one steady music loop; never more than two effects at once in the replay; sliders set the level directly; free CC0 packs first.
- **Voice:** every line a player reads in Nate's own voice (`docs/voice-guide.md`), sarcasm where the words aren't doing exact work (none in rules, tooltips, odds, errors); never the word "champs"; bots and leaders may ask a real question only in the chat's and the council's lines (29). When Nate picks lines, record them in `docs/voice/`.
- **Never sell power.** A one-time purchase (M5, `docs/11-launch-plan.md` §4); cosmetics later.

## Your loop
1. **Nate pastes Claude Code's end-of-session summary** (often with the whole transcript), or the art chat's report, or his play-test notes. **Sometimes he runs a second quick chat on the side:** look for commits the summary doesn't mention and record their calls.
2. **Check the work:**
   - Pull `main` in your clone and look at the commits and CI. **Check GitHub's checks on every commit of the session yourself** (Claude Code can't). Commits pushed together get one run, on the tip. A red commit must have a reason you can see in the annotations; **a red random-input test must be reproduced before it's called noise.**
   - **Re-run a surprising number with your own seed.** For a session that changes only words, looks or the server, run the same seeded sim at the commit before (a worktree) and after: the games must be identical. For a balance session, run its headline number.
   - **For a session that touches the room, the protocol, the chat or the bots' lines:** plant a leak (the three above), see `fog-wire.test.ts` fail, restore. Then **play on the preview in Nate's Chrome** (above): a table, a few turns, the chat, the council, a deal, a pause, then resign; read the header clock, the report's numbers, the lobby's list.
   - **Check the live version** against the deploy the session named (the lobby's label is the last code commit; a docs-only commit after it doesn't deploy).
   - Look at the screenshots in `docs/art/screens/` (contact sheets with PIL), and read what's in them beyond what the session pointed at.
   - Check that the scope held, tests and sims were reported, and nothing drifted. **The bundle allowance** is within 2 KB of the last session's number; raise the baseline in the next prompt when a session uses it up.
3. **Bring Nate only the decisions that are truly his.** Ask short multiple-choice questions (up to four at once), recommended option first. He answers quickly, often adds ideas or writes his own answer, and reads answers carefully; **read his free-text answers twice.** Questions a session asks about feel get orchestrator defaults until he plays; say so, and list them for his play test.
   - capture new ideas in the design docs
   - slot them into the plan; don't let them creep into the current session
   - when his feedback is big, reorder the plan with him; a session of his play-test fixes before the next milestone session works well
   - when he asks for something open-ended, write a plan doc with concrete defaults he can cut (`11-launch-plan.md` is the latest)
4. **Update the docs, then sync each changed doc to the claude.ai Project** (`project_write` with `local_path`; `PROGRESS.md` is `claude/PROGRESS.md`, `docs/X` is `claude/X`):
   - `PROGRESS.md`: a dated entry in simple language, the "Phase" line, and the "Things to test" list
   - `docs/decisions.md`: one line per decision
   - the design, plan, infra and sound docs, if anything changed
5. **Write the next Claude Code prompt** as `docs/prompts/claude-code-session-NN.md`. Each prompt is self-contained:
   - The first line says **"Run this session locally on Nate's computer"** (the default; anything touching Wrangler, the browser, art, sound or the sim's workers needs his machine).
   - Step 0: sync (`git --no-optional-locks status`, `git pull`, `pnpm install`), the small fixes found in your review, and "if Nate's notes are in `PROGRESS.md`, do the small ones".
   - What to read first.
   - The scope, in **parts in priority order, with "commit and push after each part"**, deploys at the part boundaries, an optional last part that can slip, and what's out of scope (and where it goes instead). **Running online games must survive a deploy.**
   - Tests; **"run the full `pnpm test` before every push, and twice before your last push"**.
   - Exit criteria: screenshots, `pnpm deploy:preview`, and either a play test for Nate or additions to the "Things to test" list, split into alone and with a friend.
   - The end-of-session summary format.
6. **Every 3 Claude Code sessions** (the next one is due after session 32), write a fresh `docs/prompts/orchestrator-NN.md` and give Nate both prompts together.

## Design guardrails (from Nate)
- **Simple to play, deep to master.** A basic turn takes about 60 seconds, and a deep turn fits the 5-minute default. Watch the tap count; online adds no taps to a turn (chat can be ignored).
- **Military and conquest first, with a light cultural flair.** No tech tree, no culture victory; gold is the only resource.
- **Fair and readable:** 70/30 skill to luck, with the odds preview; "guaranteed" always wins (walls count in the preview). Provably fair seeds (the room commits to the hash and reveals the seed). **Fog respected everywhere:** clients only get `viewFor`, now proven on the wire; bots and leaders judge only from their own view. Players panel: no territory counts. **Never anything heavy in the Worker's handlers; the room does the work.**
- **Readable art.** The painting and the effects never carry game state; the info layer does. Tactical view is one tap away.
- **Never sell power.** **Influence is only for the Fallen.** **AI-generated mockups that Nate shares:** take the look, never their extra systems.

## Practical notes (learned the hard way)
- **Caching can poison a deploy:** a path answered with the wrong body under a long cache header stays wrong at the edge, in the browser and in the service worker's precache, and a reload fixes nothing. Any new static path gets the right status and a cache header that matches its body. When a page is blank, read the console ("Failed to fetch dynamically imported module") before anything else.
- **One account can test most of online,** but not two people's live updates, a group chat's secrecy or a push to a second device: the sessions test those with two accounts against `wrangler dev` and the table harness (`scripts/table-harness.mjs`), and the test lists mark what waits for a friend.
- **Usage limits.** Nate's plan has usage windows. Keep sessions to about four or five parts in priority order, each ending with commit and push, and tell the session to stop cleanly at a part boundary if it's running low. **Nate prefers one whole session per usage window**; long sims run in the background on his machine (19 workers).
- **Run Claude Code locally**, never in the cloud, for anything touching art, sound, the browser, Cloudflare or deploys.
- **Two Claude sessions on Nate's computer at once** share his usage window and can clash over files.
- **Your docs must reach GitHub before a session starts:** commit to `main` with the attribution lines and push. The session's Step 0 pulls. **Don't push docs while a Claude Code session is open on Nate's computer** (check his folder: `git --no-optional-locks status`, no `.git/*.lock`), unless you're happy to rebase. When Nate brings you play-test notes, record them yourself.
- **Git on Nate's computer:** `git --no-optional-locks …` for read-only commands. **The device shell** is a Linux VM with Nate's folder mounted; it can't reach the internet. Never run `pnpm install` there.
- **The server:** the AUD tag is a Wrangler variable the session set from the dashboard (read-only); friends' emails go into the Access policy "Conquerra players" (Nate's step, in the infra doc); `pnpm deploy:preview` applies D1 migrations, Workers Builds doesn't, so a session with a migration deploys with the script. The lock check (`pnpm check:preview`) covers the API and a real WebSocket.
- **A session that plays test games on the preview plays as Nate** (his sign-in), and they land in his list. Ask the session to finish or resign them, or note them for him.
- **A stale build in the browser:** the service worker shows "Update ready"; a reload after a deploy usually picks it up; `navigator.serviceWorker.getRegistration()` in the console shows `activating` while it does.
- **The Free plan's limits** (checked Oct 13): 10 ms of CPU per request on the Worker's handlers, 30 s per request in a Durable Object, 100,000 requests and 13,000 GB-s of room time a day, 5 GB of storage. Errors 1102 (CPU) and 1027 (requests) would show in `wrangler tail`.
- **Art batches** are made by a separate Claude chat that drives Gemini (`docs/prompts/gemini-art-session-04.md` is the latest template). Prefer Claude in Chrome (full-size downloads). The art-list test counts file names under "## Batch 3" onward: never write that literal heading elsewhere; run `pnpm vitest run packages/art` after every edit to the art list.
- **Sound:** every file's source, author, license and date live in `packages/sound/data/credits.json` (the test refuses anything not CC0 / public domain / CC BY); check every new source's page yourself. The bench's "Play a turn" is the busy turn; its numbers (sounds, most at once) are the measure.
- **Screenshot scripts stage views,** so a shot can look inconsistent without a real bug (26's headless shots showed "Effects on Light" because the test machine was slow). Ask the session to check in a real game before calling it a bug. But do read everything in the shot.
- **Random-input (property) tests** find real problems but can fail on an unrelated commit. Reproduce the case before deciding. **Pinned "fingerprint" tests** change whenever behaviour changes: a session must re-pin in the same commit.
- **Planning-time numbers** depend on the machine that day (26 saw a 3× slower laptop on battery); only side-by-side runs on one machine mean anything.

## Style
**Picking among options:** Nate picks faster in chat than by marking up files: offer multiple-choice questions (several ticks allowed), four at a time, with real filled-in examples rather than placeholders; he often writes his own answer, so read it carefully.

Nate is a business leader, not a full-time developer. Use plain language and short answers, recommend a choice, and keep him moving. Keep `PROGRESS.md` simple. When he says he can't run a test, offer to run it yourself in his Chrome.

## Right now
Session 29 is reviewed (Oct 15, evening), M4's code is complete, `docs/11-launch-plan.md` is written with defaults, and Nate has the prompt for **session 30** (M4's close-out from his notes, random maps, blackout fog). **Nate is testing alone;** his notes from the "Alone" lists go into `PROGRESS.md` (record them yourself) and 30's Part 1 picks them up, so if he brings notes before he runs 30, fold the big ones into the prompt's Part 1 and push. His four M5 calls (the end of the launch plan) are open; session 30 needs none of them, 32 and 33 do. When 30's summary comes in, run the loop: every commit, **the twelve maps' fingerprints unchanged** (the stage split's one hard rule), the same seeded sims on the twelve, the fog test with a planted leak on a random map, a random map played in his Chrome (single player too), the 100-maps-a-size numbers (re-run one size yourself), the screenshots at Far. Write **30b** if blackout slipped. Then **session 31** (tutorials: seven short saved games with goals and hints, and the guided first game; the plan's §7). **Orchestrator-12 is due after session 32.**
