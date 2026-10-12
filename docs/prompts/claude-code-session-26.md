# Claude Code: Session 26 (M4: online with friends, part one: the server)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs Wrangler (logged in there), his browser and deploys.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session starts M4: the game moves onto a server so friends can play together.** The plan with Nate's calls is `docs/10-online-plan.md`; this session is its "26: the server skeleton": **one person plays an online game against bots, end to end, on the preview, from a phone and a laptop, and can close the tab and come back.** Friends, invite links, deals between people, pause by vote and chat are sessions 27 to 29: don't start them.

**The one design rule that makes this tractable:** the browser already talks to its game through a contract (`apps/web/src/host/protocol.ts`) and a Web Worker that runs `HostCore`. Online, **the same messages travel over a WebSocket to a game room on the server**, which runs the same `HostCore`, the same engine and the same bots. The UI keeps its shape; only its wire changes. **Single player stays exactly as it is:** local, offline, no sign-in.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit, run the deploy (where the part says so), push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

**The parts are in priority order; Parts 2 and 3 end with a deploy,** so the session is complete at either boundary. Whatever isn't reached becomes session 26b; say what's left. Nate may be playing the preview while you work, so every deploy must be a working build, and **single player on the preview must never break.**

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: "Oct 12: Orchestrator review of session 25" and any "Nate's play test" entries after session 24 or 25
3. **`docs/10-online-plan.md`** (the whole plan; §2, §3 and §8 are this session; "Nate's calls" at the end)
4. `docs/infra-cloudflare.md` (what Nate's Cloudflare account has; the Access app; the Worker `conquerra`)
5. `docs/03-build-plan.md` (M4), `docs/decisions.md` (the Oct 11 to 12 lines at the bottom)
6. The code: `apps/web/src/host/protocol.ts` (the contract), `hostCore.ts` (everything the host does, in one place), `worker.ts` (the Web Worker that forwards the page's requests; the timer lives there), `localHost.ts` and `localGame.ts` (how the page talks to the host today, how a game is set up, bots, saves), `saves.ts` (the save store), `apps/web/wrangler.jsonc` (the Worker that serves static files today), `apps/web/scripts/check-preview.mjs` (the lock check), `packages/engine/src/view.ts` (`viewFor`), the fog tests in `packages/engine/test/` (the pattern for the fog-on-the-wire test)
7. Cloudflare's docs for Durable Objects (SQLite storage, alarms, the WebSocket **Hibernation API**), D1 (migrations), Workers static assets with a Worker script, and Access (verifying the `Cf-Access-Jwt-Assertion` JWT against the team's certs)

## Step 0: sync, the wall cap, Nate's nits
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **The wall bonus loses its cap (Nate, Oct 12):** `rules.walls.stackMax: null` in `rules.json`; the card, the attack panel and the "Completes a wall" hint drop "at most +40%" wherever they say it; `docs/rules-reference.md` (the walls paragraph) and `docs/sim-results-m3-walls.md` (one line: shipped uncapped on Nate's call) updated; the wall-bonus tests keep both the capped and uncapped cases (the capped one as a rule that can be set); **re-pin whatever changes in the same commit** (the all-bot sims were identical capped and uncapped at the sweep's seeds, so expect no fingerprint change, but check). A 10-game sim before and after should differ only where a wall of five or more was attacked.
3. If `PROGRESS.md` has Nate's play-test notes after 24 or 25 with small fixes in them (wording, a sound to mute, a slider), do the ones that take minutes; list the rest for the orchestrator.
4. **Commit and push.** (Run the full `pnpm test` before this and every push.)

## Guardrails (all parts)
- **Only `viewFor` leaves the room.** The server never sends a client anything but the map and rules once, then that player's `viewFor` and fog-trimmed replay each turn, as `protocol.ts` already says. A test enforces it (Part 2).
- **The engine stays pure;** it runs unchanged in the Worker. No `Date.now()` or `Math.random()` in `packages/engine`; the room supplies time and seeds the way `HostCore` does today (its `now` argument).
- **Provably fair:** the room commits to the seed's hash at the start (in the game's first message) and reveals the seed at game over.
- **Single player untouched:** the local Web Worker path keeps working offline; the lobby's local games, pause and saves don't change. The start-up bundle stays within 2 KB of 492.6 KB (the online client code loads with the Online block or the game screen, not the lobby's first paint).
- **Sign-in is Access, nothing else:** the Worker trusts a request only with a valid Access JWT (team domain `keel-nkurtz.cloudflareaccess.com`, the app's AUD tag as a Wrangler variable `ACCESS_AUD`); the email in it is the account. No sign-up form, no passwords. The lock check (`pnpm check:preview`) must still pass: every path, the API and the WebSocket included, redirects without a session.
- **Plain language and copy-paste steps** for everything only Nate can do (the Paid plan, the AUD tag, Workers Builds): write them in `docs/infra-cloudflare.md` as a numbered list and tell him in the summary.
- **Costs:** nothing beyond Workers Paid ($5/month). No R2 this session; D1 on its free tier.

## Part 1: the server runs a game (no deploy yet)
1. **The Worker gains a script.** `apps/web/wrangler.jsonc` gets `main` (a new `apps/web/server/` entry, or a new package `apps/server` if the build is cleaner: your call, say why), keeping the static assets as they are so the game is served as today. Bindings: the Durable Object `GameRoom` (SQLite-backed, with its migration), D1 `conquerra_db`, the `ACCESS_AUD` variable. Create the D1 database with Wrangler (the name from `docs/infra-cloudflare.md`); D1 migrations in the repo (`users`: id, email, name, colour, created; `games`: id, map, settings as JSON, status, host user, created, turn; `seats`: game, seat, user or bot kind, colour, name).
2. **`GameRoom`:** one per game; runs `HostCore` with a save store on its own SQLite storage (the game is saved every turn as today's autosave is); the turn clock on a Durable Object alarm (today's `worker.ts` timer, moved); WebSockets through the Hibernation API; one connection per seat (a second connection from the same account replaces the first). It speaks `protocol.ts`: the page's requests in, `HostUpdate`s out, each client getting only its own view. **Bots plan in the room**, as the Web Worker does today. Log the CPU time of each turn's resolution and planning (a `console.log` the session reads in `wrangler tail`).
3. **The API** on the Worker: create a game (map, bots, settings; the caller is seated as the person; the rest bots), list my games, open a game (returns the WebSocket). Every route verifies the Access JWT first (a small module with its own test, using a key pair the test makes).
4. **The client's remote host:** `apps/web/src/host/remoteHost.ts`, the same interface the page uses for the local host, over a WebSocket, with reconnect (backoff, then a fresh "where are we" request so a refresh or a lost connection lands you in the planning window with your queue, or in the replay you missed). The page shouldn't know which host it has.
5. **Tests:** the room's logic in-process (the way `hostCore` is tested today, with a memory store): a game created, orders in, the clock expiring, the turn resolved, each seat's update; the JWT check (good token, bad audience, expired, missing); the D1 schema (a migration applied in a test if the Workers test pool is in reach in an hour; otherwise a script you run against `wrangler dev` and paste into the summary). Run it under `wrangler dev` locally and play a turn with the headless-Chrome helper, as sessions 21 and 24 did.
6. **Commit and push.**

## Part 2: the lobby's Online block, and the first online game on the preview (the first deploy)
1. **The lobby** gets an **Online** block under the local game: "New online game" (the same map, bots and timer choices; timers 3, 5, 10 minutes and long turns of 1, 8 and 24 hours; no "No timer") and "Your online games" (name, map, turn, whose turn it is waiting on; Continue opens it). The per-player choice from the plan, **"If I miss a turn with no orders, my leaders run my House"** (on by default), sits with the seat; build the setting and its effect now (the queue as left goes in; with nothing queued and the choice on, the Leader and Steward play the turn at 80/20, and the card says "Your leaders ran your House this turn"), since it's what makes a turn end when the clock runs out and the person is gone. **A turn ends early when everyone has locked in** (with one person and bots, that's the person).
2. **The game screen online:** the clock from the room (the deadline, not a local countdown that drifts), lock in, the replay, then the next window **after the replay's length plus 10 s** for everyone (one person: the same rule, so it's tested now). Pause is hidden online (pause by vote is session 28). "Leave this game" keeps the game on the server.
3. **The fog-on-the-wire test:** a room with two people and bots, a listener on one seat recording every message; for every turn, assert the messages equal `viewFor` for that seat and the fog-trimmed replay, and that no territory, troop count or leader outside that view appears anywhere in them (including chat-free notices). Model it on the engine's fog tests.
4. **Measure:** CPU per turn in the room on Embervale 4 and Rootholm 8 against Marshals (from the logs), the size of a turn's messages to one client, the start-up bundle.
5. **Deploy** (`pnpm deploy:preview`, with its lock check; the deploy now creates the Durable Object migration and applies the D1 migration: put both in the script or say the one extra command). **Nate's steps first:** Workers Paid on; the AUD tag (write where to find it). **Then Nate plays an online game against Marshals on the preview, phone and laptop, closes the tab mid-replay and comes back.** Screenshots: the Online block (desktop and phone), the game screen with the server clock, "Your online games".
6. **Commit and push.**

## Part 3: deploys from GitHub, and the online polish (the second deploy)
1. **Workers Builds:** connect the repo so a push to `main` builds and deploys the Worker (Cloudflare's Git integration, as the main site does): write Nate's steps (the GitHub authorization is his); set the build command and the root; make sure a docs-only push is harmless; keep `pnpm deploy:preview` as the manual fallback. Check one deploy made this way shows its version at the top of the lobby.
2. **The small things an online game needs that single player never did:** the players panel marks who's a person (no counts, as always); a notice when the room reconnects you; the game list's "waiting on" line; an online game at game over writes its result to D1 and reveals the seed.
3. **Deploy. Commit and push.**

## Part 4 (can slip to 26b): the long-turn clock
Long turns (1, 8, 24 hours) hold through the Durable Object's hibernation: the alarm fires with nobody connected, the turn resolves, and the next window opens; a person who returns a day later lands in the replay they missed. A test with a fake clock; one real check with a 1-hour game left for an hour. **Commit and push** (deploy if it's in).

## Last: the write-up, the test list
- `docs/10-online-plan.md`: a BUILT block for session 26 (what's on the server, the message shapes, the CPU per turn, what Nate had to do). `docs/infra-cloudflare.md`: the M4 section brought up to date (the Worker now has a script, the DO, D1, the variables, Workers Builds), and Nate's numbered steps.
- `docs/rules-reference.md`: a short "Online" section (the clock, lock-in, the missed-turn choice, reconnecting). `docs/decisions.md`: one line per decision (where the server code lives, the DO's storage shape, the clock rules as built, anything the plan said that you changed and why).
- **"Things to test after session 26"** in `PROGRESS.md`, most important first (an online game on the phone, closing the tab mid-replay, the lobby's Online block, the missed-turn choice, a 1-hour game left overnight). Carry over what Nate hasn't tried from "after session 25".
- `PROGRESS.md` (the Phase line: M4 started; sessions completed: 26), `docs/decisions.md`.
- **Commit and push.**

## Out of scope (sessions 27 to 29)
- Invite links, friends' seats and colours, several people's clocks, bot takeover, resign (27).
- Deals between people, pause by vote, chat for people (28); chat for bots and leaders, notifications (29).
- R2, spectators, public sign-up, payments (M5 and after).

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass; everything is committed and pushed to `main`. **Run the full `pnpm test` before every push and twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- The fog-on-the-wire test passes; the JWT check has tests; the room's logic has tests.
- Single player on the preview unchanged; the start-up bundle within 2 KB of 492.6 KB; the lock check passes with the API and the WebSocket in.
- Nate has played an online game against Marshals on the preview from a phone and a laptop, closed the tab mid-game and come back.
- Every deploy a working build; the docs and Nate's steps above.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which parts were finished and which slipped (for 26b)
- where the server code lives and why; the DO's storage shape; the exact message flow for one turn (one paragraph)
- CPU per turn in the room (Embervale 4, Rootholm 8), a turn's message size, the start-up bundle
- what Nate did himself (Paid plan, AUD tag, Workers Builds) and what's still his to do
- the deployed version, and whether it came from Workers Builds or `pnpm deploy:preview`
- anything in `docs/10-online-plan.md` you built differently, and why
