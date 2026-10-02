# Claude Code: Session 2 (Milestone 2, part 1: a playable game in the browser)

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer: explain choices in plain language and keep setup steps copy-paste simple.

Session 1 finished Milestone 1 (engine v0.2, Recruit bot, simulator). This session starts M2, a game Nate can play in his browser against bots. M2 is split across two sessions; this is the first.

## Read first, in this order
1. `CLAUDE.md` (hard rules)
2. `PROGRESS.md` (where we are, including the orchestrator's review of session 1)
3. `docs/rules-reference.md` (how the engine plays today)
4. `docs/04-design-additions.md` §0 (the "simple to play, deep to master" test) and §3 (presets)
5. `docs/03-build-plan.md` (architecture and the M2 section)
6. `docs/decisions.md` (the newest lines at the bottom matter)

## Step 0: housekeeping (do this first)
1. The orchestrator updated these docs in the folder and they aren't committed yet: `PROGRESS.md`, `docs/decisions.md`, `docs/03-build-plan.md`, `docs/04-design-additions.md` and this prompt. Commit them as they are ("Docs: orchestrator review of session 1, session 2 prompt").
2. `git status` also shows several files changed only by Windows line endings. Add a `.gitattributes` (`* text=auto eol=lf`), run `git add --renormalize .`, confirm that no real content changed, and commit. `git status` should then be clean.

## Part A: small engine updates (with tests; the determinism test must still pass)
1. **Leaders come back on their own.** A fallen Leader returns for free at the start of its owner's next turn: at the capital, or at the player's strongest territory (most troops) if the capital is lost. Remove the 15-gold "Raise Leader" order and its rule value. Seize the Initiative and Lie in Wait cooldowns carry over unchanged. Add a public-to-self `leaderReturned` event, and filter it in the replay like the other events.
2. **Eliminated Leaders:** when a player is eliminated, record who eliminated them (`eliminatedBy`). Don't build the general pool; that's M3. Just store the fact so M3 can use it.
3. **Map player ranges:** each map already has `minPlayers` and `maxPlayers`. Add `recommendedPlayers` (a range, about 6–7 territories per player). Add a small engine or content helper, `suggestedMode(playerCount)`, that returns Conquest for 8+ players and Classic otherwise. The lobby will use it as a default the host can change.
4. Re-run the sim (1,000 games at 2, 4 and 6 players, plus 200 at 10 players in Conquest mode). Confirm the game-length target still holds, and update `docs/sim-results-m1.md` only if the numbers moved noticeably.

## Part B: the browser game (`apps/web`)
Build with **React + Vite + TypeScript, Zustand for state, and SVG for the map**, as the build plan says. Single player only: you plus 1–5 Recruit bots, on Embervale. Everything runs in the browser; there is no server yet.

**The client must behave as if a server exists.** The UI only ever reads `viewFor(...)` and `replayFor(...)` for the human player, never the full game state, even though the full state lives in the same browser. Keep the engine and bots behind one small "local game host" module (a Web Worker is fine), so M4 can swap it for the real server without touching the UI.

**Screens (no more than these):**
- **Lobby:** map, number of bots, luck, fog on/off, victory mode (defaulting from `suggestedMode`). One "Start" button.
- **Game:** the map, a context panel for the selected territory, the order queue, and a "Lock in" button.
- **Game over:** winner, turns played, "Play again."

**The map:**
- Draw territory shapes from each territory's `x, y` point. Voronoi cells clipped to the map edge (d3-delaunay) are a good default, but use your judgment.
- Draw province outlines and the special borders (river, pass).
- On each territory show the owner's color, the troop number and specialist badges.
- Fogged territories look clearly fogged: terrain and value only, nothing else.
- Make it readable at phone width; session 3 does the phone polish, but don't paint us into a corner.

**The order builder** (the heart of this session). The goal is that **a basic turn takes about 60 seconds.**
- Tap your territory, then tap a neighbour, and you have a move or attack. Troops default to "all but 1," with a quick slider or stepper.
- The **odds badge** (guaranteed / likely / possible / impossible) appears before the order is added, using the engine's preview.
- **Preset chips** on the order: one tap each, with the plain-language description from `PRESETS`. Custom conditions are not in M2.
- The territory panel has one-tap actions: Recruit (amount stepper, defaulting to as many as you can afford), Hire specialist, Build, Raise culture, Retreat.
- Leader controls: move with an army, Seize the Initiative, Lie in Wait.
- The order queue shows the orders in sequence, lets you delete or reorder them, and shows the gold left after queued spending.
- "Lock in" resolves the turn (bots plan their own orders). Then show a **simple text log** of the turn from `replayFor`, with fogged events as surface details, and move to the next turn. The animated replay is session 3.

**Measure the 60-second goal:** count the taps for a typical early turn (recruit, two attacks with presets, lock in) and report it.

## Out of scope (don't build)
The animated replay, the turn timer countdown, an installable (PWA) app, phone polish, deployment or anything on Cloudflare, accounts, a server, spies, Spoils/Fate cards, diplomacy, generals, the Fallen, factions, and art beyond "clean and readable." No new screens beyond the three above.

## Tests
- Engine tests for the Leader return, `eliminatedBy` and `suggestedMode`.
- A few tests for the web app's order-builder logic (what goes in the queue, gold left, default troop counts). Keep the logic out of components where possible so it's easy to test.
- Add `pnpm --filter web build` to CI.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and the determinism test passes.
- `pnpm dev` (or a single command) opens the game, and a full game against bots can be played to the end on a laptop.
- The README has a copy-paste "How to play it locally" section for Nate (Windows).
- `docs/rules-reference.md` is updated for the Leader change.
- `docs/decisions.md` and `PROGRESS.md` are updated in simple language, with "Claude Code sessions completed" bumped to 2.
- Committed and pushed to `overconfidence7/conquerra` with clear messages. If the GitHub command-line tool isn't installed, tell Nate the one command to install it (`winget install GitHub.cli`) rather than skipping the CI check.

## End the session with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the tap count for a typical turn
- 3–5 things Nate should try when he plays it
- anything you would cut or simplify on the game screen
