# Claude Code: Session 35 (M5 part eight: launch polish: the big-table screens, the install flow, a last voice pass, the open-graph tags, the load test)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs Wrangler (logged in there), `wrangler dev` with the table harness, his browser, his phone (for the install flow: Nate does those steps, you prepare them) and deploys. Note: **GitHub Actions is not running on push right now** (a billing notice on Nate's account; his step). Until it is, the full `pnpm test` twice before the last push is the only check there is: don't skip it.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session is everything a stranger meets, before the doors open** (`docs/11-launch-plan.md` §2, §8 and §9): the screens at big tables (three things the orchestrator's reviews found), the installed app on Android and iPhone, a last pass over every line a player reads, the open-graph tags for shared links (ready for session 36, when Access comes off and chat apps can read them), and a load test of 20 tables at once on the preview. Step 0 carries two of Nate's balance calls from 34b's review. Sign-in and Workers Paid are session 36, the purchase and the site's front page 37: don't start them.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit, run the deploy (where the part says so), push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

**The parts are in priority order; Parts 1, 2 and 3 each end with a deploy,** so the session is complete at any of those boundaries. Whatever isn't reached goes to the next session; say what's left. Nate may be playing the preview while you work, so every deploy must be a working build, and **a game already running on the server must survive a deploy**.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: "Oct 20: Orchestrator review of session 34b" (Nate's calls, for Step 0; the three screen items), "Oct 20: Orchestrator review of session 34" (the screens), and **every "Nate's play test" entry after session 34b** (his solo notes outrank anything below)
3. `docs/11-launch-plan.md` §2 (the 35 row), §8, §9; `docs/10-online-plan.md` ("M4 as built", the harness)
4. `docs/voice-guide.md` and `docs/voice/` (Nate's picks: the voice pass is against these), `docs/04-design-additions.md` §13 (voice and chat, the panels), `docs/06-art-direction.md`, `docs/09-polish-and-effects-plan.md`
5. `docs/sim-results-m5-scale.md` (34b: the layouts, by spot; the band by table size), `docs/sim-results-m3-balance.md` ("The seat rule")
6. `docs/infra-cloudflare.md` (Access, the Free plan's limits: 100,000 requests a day, 13,000 GB-s of room time), `docs/decisions.md` (the Oct 20 lines at the bottom)
7. The code: `packages/content/data/maps/layout-versions.json` and `src/bigTables.ts` (layout version 2, `LAYOUT_VERSION`), `packages/engine/src/setup.ts` (`layoutFor`, the seat rule: `weak`, `dealSeats`), `packages/content/data/random-maps.json` (the band by table size), `packages/mapgen/src/randomId.ts` and `seed.ts` (version 7), `apps/sim/scripts/s34b-layouts.ts`, `s34b-confirm.ts`, `s34b-pin.ts` (the search and the pin), `packages/mapgen/scripts/krakenmere-max.ts`, `apps/web/src/ui/PlayersPanel.tsx` (the Houses panel), `GameScreen.tsx` (the right column), `apps/web/src/ui/useLayout.ts` and `logic/layout.ts` (phone and desktop), `apps/web/src/render/pixi/info.ts` (the pills at Far), `apps/web/index.html` and `vite.config.ts` (the manifest, the icons), `apps/web/src/ui/Lobby.tsx` (where an Install line goes), `apps/web/server/online.ts` (the invite route, for the open-graph tags), `apps/web/scripts/table-harness.mjs` and `big-table-harness.mjs`, `packages/content/test/voice.test.ts` and `voiceScan.ts` (what the voice test reads)

## Step 0: sync and Nate's two balance calls
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **Nate's solo notes after 34b** in `PROGRESS.md`: do the small ones here; list the rest for the orchestrator.
3. **The band above 12 seats is 6.0 (Nate's call, Oct 20):** random map version 8 (`random-maps.json`: the band by table size, 4.0 to 12 seats, 6.0 above; versions 2 to 7 still build theirs), so a 300 seats 20 (34b: 35 of 50 seeds pass at 6.0) and the 400 as now; **Krakenmere to 14** with a layout found as 34b did (`krakenmere-max.ts` at 6.0, then the search and the fresh-games check, pinned as layout version 3 beside version 2; 34b: at 14 the most even layout is 5.71 times). The lobby's and the Worker's seat counts follow. Say the seeds that pass at 20 on the 300 at 6.0 (`packages/mapgen/scripts/try-random.ts`), and the by-exposure table from one 50-map run (`s30-sims.ts --random 300:all:50 20 --seed s35`).
4. **The strong spots go to bots first too (Nate's call, Oct 20; unsaid anywhere in the game).** The seat rule deals a layout's `harder` spots to bots first; now a layout can also mark **`strong`** spots (the ones the simulator says win more than twice their fair share: from 34b's fresh-games tables in `docs/sims/s34b-*`, for every pinned layout of Rootholm and Krakenmere at 8 to 20, and the maps' own 10-seat layouts where version 2 kept them), and `dealSeats` gives bots the strong spots first, then the weak ones, then deals people the rest at random. Content: the marks in `layout-versions.json` (a new layout version where a layout gains marks, so a running game keeps its deal); a test that a person never sits on a marked spot while a bot is at the table, and that with no bots nothing changes. **Standard fog on the 4-player tables is byte for byte the same** (the digest; no 4-player layout gains a mark). No line anywhere says it.
5. **The start-up bundle sits at 396.8 KB against 400.0.** The allowance stays **400.0 KB**; the install line in the lobby is a few bytes; the open-graph tags live in the HTML and the Worker, not the bundle.
6. **Commit, deploy, push.** (Run the full `pnpm test` before this and every push.)

## Guardrails (all parts)
- **Standard-fog games on the twelve official maps at their 4-player tables are byte for byte the same** after every part: the `--digest 4 20 --seed s30d` run gives `dc8962d4f8ba3bc6`; the Captain fingerprint `232617a30b1f8b47` and the seeded sim (`pnpm sim --games 40 --players 6 --map wyrmland --bots marshal --seed o35`) unchanged.
- **Only `viewFor` leaves the room** (`fog-wire.test.ts`); the open-graph route says only what the invite already says to anyone with the link (the host's name, the map's name, the seats).
- **Every line a player reads in the voice** (`docs/voice-guide.md`); Part 2 is that pass.
- **Nothing heavy in the Worker's handlers** (the open-graph route is a string; the Free plan's 10 ms).
- **The lobby stays decluttered**: the Install line appears only where the app isn't installed, and once dismissed stays away.

## Part 1: the screens at big tables (the first deploy)
1. **The desktop's Houses panel folds past ten rows:** with more than ten Houses the right-hand column runs below the fold and the Leaders panel with it (34's and 34b's screenshots: the Leaders panel cut off, nothing saying the column scrolls). Show the people and the top bots by land, then "and 10 more" that opens the rest (the phone's rule, `docs/04-design-additions.md` §13: no territory counts), so the Leaders panel keeps its place on a 1080-pixel-tall screen with 20 Houses. The chat's House list and the Propose-a-deal list the same.
2. **The phone's Houses panel when you're knocked out:** it draws over the watcher's box ("You're out, so you watch the map") and its "and 12 more" sits on the Next turn button (`docs/art/screens/s34-houses-phone.jpg`). The panel yields to the watcher's box (or the box moves under it), and nothing overlaps a button.
3. **A 400 at Far is a wall of pills** (33b's `s33b-random400-far.jpg`, 34's `s34-random400-16-far.jpg`): past a territory count or a zoom level, the pills thin out at Far (a realm's total on its biggest territory, or only capitals and fronts, as the design's "readable at a glance" asks; the Near and Mid views unchanged), with the info layer still carrying the state (effects and the painting never do). A screenshot of a 400 at Far before and after, and of Embervale at Far unchanged.
4. **Write-up:** `docs/04-design-additions.md` §13 (the panel's fold on a desktop), `docs/09-polish-and-effects-plan.md` (the pills at Far), `docs/decisions.md`. **Tests:** the panel's fold at 11 and 20 Houses, the pills' rule by count. **Deploy. Commit and push.**

## Part 2: the voice pass and the install flow (the second deploy)
1. **A last pass over every line a player reads** (`voiceScan.ts` lists where they live: the lobby, the folds, the panels, the reports, the toasts, the errors, the tutorials, the Rules fold's text, the rules reference, the bots' and the leaders' lines): read them against `docs/voice-guide.md` and Nate's picks in `docs/voice/`; fix what isn't in the voice (sarcasm where the words do exact work: none in rules, tooltips, odds, errors; no semicolons, dashes or arrows; never the word "champs"); list in `docs/voice/lines-for-nate-s35.md` the twenty lines a stranger meets first (the lobby's, the guided first game's, turn 1's report, the first chat line) with one alternative each for Nate to pick from, and ship the current ones. The voice test keeps passing.
2. **The installed app:** the manifest and the icons exist (`vite.config.ts`). Add **an Install line in the lobby** under the version label: on Android (Chrome's `beforeinstallprompt`) a button that opens the prompt ("Install Conquerra: it opens like an app."); on an iPhone a two-line hint (Share, then Add to Home Screen) since Safari has no prompt; nothing when the app is already installed (`display-mode: standalone`) or after Dismiss (localStorage). The installed app's start page is the lobby, its colour the lobby's, its icon the maskable one; a push arrives in the installed app (session 28's push, re-checked installed). **Nate's steps, written in the summary:** install on his Android, open from the home screen, play a turn, get a push; the same on an iPhone if he has one at hand.
3. **Write-up:** `docs/rules-reference.md` (an "Install" line in plain words), `docs/11-launch-plan.md` §8 and §9 BUILT lines, `docs/voice/lines-for-nate-s35.md`, `docs/decisions.md`. **Tests:** the Install line's three states, the words in the voice. **Deploy. Commit and push.**

## Part 3: the open-graph tags and the load test (the third deploy)
1. **Open-graph tags** on the game's page and on an invite link (`/?join=<code>`): a title, a description ("Nate invites you to a game of Conquerra on Rootholm, 8 seats" from the table's host name, map and size, by a small Worker route that fills the HTML's tags for a crawler's request; the lobby's tags otherwise), an image (a 1200 by 630 painting of the lobby's map, one static file in `public/`, under 300 KB), the twitter card tags. **Known now: Cloudflare Access blocks a crawler's fetch**, so chat apps won't show the preview until session 36 retires Access; build and test it with `wrangler dev` (curl the invite route with a crawler's user agent, read the tags) and say so in the summary. Nothing in the tags that isn't already public to anyone with the link.
2. **The load test: 20 tables at once on the preview.** `big-table-harness.mjs` (or a new `load-test.mjs`) makes 20 tables from Nate's sign-in (the Access cookie from his Chrome; the daily cap of 20 tables is exactly the budget, so make them in one run and resign them all after), each with bots (a mix of 4-seat Embervale and 10-seat Rootholm tables), plays three turns on each with lock-in early, and measures: the time from the last lock-in to the update on each table, the Worker's handlers' CPU and the rooms' CPU from `wrangler tail`, any 1102 or 1027, and the day's request count against the Free plan's 100,000. Then resign and leave every table (none in Nate's list). **The bar:** a turn's update under 2 s on every table while all 20 run, no error codes; if the Worker's handlers go over 10 ms anywhere, say where (36's paid plan lifts it, but the room should be doing the work).
3. **Write-up:** `docs/10-online-plan.md` (the load test's numbers), `docs/11-launch-plan.md` §9 BUILT (the tags, waiting on 36), `docs/infra-cloudflare.md` (the tags' route, the load test's method), `docs/decisions.md`. **Tests:** the tags' route (a crawler's request gets the table's words, a person's gets the page), the harness's own checks. **Deploy. Commit and push.**

## Part 4 (can slip): the lobby for a newcomer, re-read
1. Open the preview in a fresh browser profile (no saved games, nothing learned): read the lobby top to bottom as a stranger would (Learn open, "Or jump in", the random-map card, the Online block's words that still speak of a guest list, which 36 changes). Fix what reads wrong in the voice; list what waits for 36 (the sign-in words) and 37 (the front page). **Commit and push.**

## Last: the test list
- **"Things to test after session 35"** in `PROGRESS.md`, most important first: install on the phone and play a turn from the home screen (a push arrives in the installed app); a 20-seat table on the phone when knocked out (the Houses panel and the watcher's box); a 400 at Far; a game on Krakenmere at 10 (which spot did you get? by the new rule a person never gets the strongest); the twenty lines in `docs/voice/lines-for-nate-s35.md` (your picks); carry over what Nate hasn't tried.
- `PROGRESS.md` (sessions completed: 35), `docs/decisions.md`.
- **Commit and push.**

## Out of scope (sessions 36 and after)
- Sign-in in the Worker, Workers Paid, accounts in D1, Access retired, the open-graph preview seen in a chat app (36); the purchase, the front page, terms and privacy (37); battle royale (38); new castle spots on the 200s (a map session, if Nate asks); the random 80's layout rule (after the friends' play test).

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass; everything is committed and pushed to `main`. **Run the full `pnpm test` before every push and twice before your last push** (GitHub's checks aren't running: this is the check).
- Standard fog unchanged after each part: the digest `dc8962d4f8ba3bc6`, the Captain fingerprint `232617a30b1f8b47`, the seeded sim identical before and after. The honesty and fog-wire tests pass.
- The start-up bundle within the allowance (400.0 KB); the lock check passes on every deploy; running games survive each deploy.
- Screenshots in `docs/art/screens/s35-*`: a 20-House desktop game with the Leaders panel in view; the phone's Houses panel when knocked out; a 400 at Far before and after; the lobby's Install line in its Android and iPhone forms; a 20-table load test's numbers in the write-up.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which parts were finished and which slipped
- Step 0: what Nate's notes changed (one line each); the band at 6.0 (the seeds at 20 on a 300, Krakenmere's 14-seat layout's numbers); the strong spots marked per layout (the list) and the seat rule's test
- the three screens, in a line each, with the screenshots named
- the voice pass: how many lines changed, and the twenty for Nate
- the install flow: what Nate does on his phone, step by step
- the open-graph tags (and that Access hides them until 36); the load test's numbers
- the digest, the fingerprint and the seeded sim, unchanged
- the deployed version
