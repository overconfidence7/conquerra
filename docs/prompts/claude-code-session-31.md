# Claude Code: Session 31 (M5 part two: tutorials and the guided first game)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs Wrangler (logged in there), his browser and deploys, and the simulator with its 19 workers for Step 0's sim.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session teaches the game.** M5 (the public launch) started with session 30 (random maps, blackout). Now: **seven tutorials, each a short saved game that teaches one thing, and a guided first turn for a new player.** Strangers will meet these before anything else, so every word is in the game's voice and every step is checked by a test that plays it. The plan is `docs/11-launch-plan.md` §7 and the design `docs/04-design-additions.md` §10 ("Tutorials"). Sign-in, the purchase and bigger tables are later sessions: don't start them.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit, run the deploy (where the part says so), push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

**The parts are in priority order; Parts 1 to 3 each end with a deploy,** so the session is complete at any of those boundaries. Whatever isn't reached becomes session 31b; say what's left. Nate may be playing the preview while you work, so every deploy must be a working build, and **a game already running on the server must survive a deploy.**

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: "Oct 16: Orchestrator review of session 30" (the nits for Step 0, the start bonus call, the blackout label), and **every "Nate's play test" entry after session 30** (his solo notes outrank anything below)
3. **`docs/11-launch-plan.md`** §7 (tutorials and the first game), §1 (what's free: the three maps and the tutorials), **`docs/04-design-additions.md` §10** (tutorials: a saved game with goals and hints; subjects: chaining attacks, recruiting, culture, buildings, cards, treaties, generals), §0 (simple to play, deep to master)
4. `docs/rules-reference.md` (every rule a tutorial teaches, in the words the game already uses), `docs/voice-guide.md` (every hint and goal in the voice; none of the hard-rule breaks; no sarcasm in a hint, it's doing exact work)
5. `docs/sim-results-m5-random-maps.md` (the start bonus and the band, for Step 0), `docs/sim-results-m3-balance.md` ("The seat rule", session 23's bonus sizes)
6. `docs/decisions.md`, the Oct 15 to 16 lines at the bottom
7. The code: `packages/engine/src/saved.ts` (`SaveFile`, `SAVE_VERSION`, `STATE_VERSION`, the migrations), `apps/web/src/host/saves.ts` (the slots, Save to a file, Load a file) and `hostCore.ts` / `localGame.ts` (single player's host: a tutorial is a single-player game with a goal), `apps/web/src/ui/Lobby.tsx` and `LobbyFolds.tsx` (where "Learn" goes), `Saves.tsx`, `Cards.tsx` and `Toasts.tsx` (a goal card, a hint), `HintButton.tsx`, `TurnReport.tsx`, `packages/content/` (data JSON with Zod schemas: tutorials are content), `packages/mapgen/src/random.ts` and `seed.ts` (the band and the harder spots, for Step 0), `apps/sim/scripts/s30-sims.ts` (the 100-maps-a-size sim), `packages/engine/src/setup.ts` (the seat rule, the start bonus)

## Step 0: sync and the fixes from the review
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **Room in the start-up bundle:** it sits at its allowance (499.1 KB). Find at least **15 KB** before adding anything: the Random map panel, the Rules fold's insides and the saves dialog load after the lobby's first paint (as the Online block's insides already do); say what moved and the new number. **This session's allowance: within 2 KB of the number after your trim.**
3. **Random maps' harder spots get a start bonus** (the orchestrator's call from the sim; Nate can overrule): the spots a random layout marks as harder get **+4 troops** at the start (the official maps' middle, session 23), and the exposure band at generation tightens from 5.5 to **4.0**. Then **re-run the 100-maps-a-size sim** in the background (the `s30-sims.ts` way, by exposure rank) and put the new table in `docs/sim-results-m5-random-maps.md`. If a size is still outside ±5 by exposure, say so and try the band at 3.0 for that size only (the sim's numbers, not a feeling).
4. **Blackout's label:** the Rules fold's Blackout line says "Blackout: the map is hidden until you explore it (the bots still know the lay of the land)" until the bots learn to explore (session 32, Nate's call). Tactical view stops drawing rivers through cloud.
5. **Small:** the "Update ready" toast stays up after Update now with the newest build already running (hide it once the running build is the newest); the lobby forgets "Random map" across a reload (remember it with the other settings, with a fresh seed each time); a 200 map on a phone takes up to 30 s: a "Making the map…" line with progress, and the build off the main thread as online already does; crescent seeds fail about half the time (tune the crescent's knobs until at least 7 of 8 pass, as the other shapes do); a person's withdrawn offer says who withdrew.
6. **Nate's solo notes after 30** in `PROGRESS.md`: do the small ones here; list the rest for the orchestrator.
7. **Commit, deploy, push.** (Run the full `pnpm test` before this and every push.)

## Guardrails (all parts)
- **A tutorial is content, not code:** each one is a file in `packages/content/data/tutorials/` with a Zod schema: the recipe that makes its saved game (a map among the free three, the seed, the opponents, the scripted orders that bring the game to the lesson's start), the goal (a predicate from a small fixed set), the hints (one a turn, at most four), the lesson's words, and the solution (the scripted orders that reach the goal). **A test plays every tutorial's solution against the current engine and checks the goal is met within its turns**, so a rule change that breaks a tutorial fails the build, and the saved game is rebuilt from the recipe (never hand-edited state).
- **The engine stays pure;** goal predicates live beside the saves code in the web app (or a tiny `packages/content` module), read `viewFor` only, and are deterministic. **No new rules, no special cases in the engine for tutorials.**
- **Every word in the voice** (the voice test reads the tutorials' JSON): plain and exact in goals and hints, warmth allowed in the lesson's opening and closing lines, never sarcasm at the player. **Under 25 words a hint, under 40 a goal.**
- **Taps:** a tutorial's turn takes no more taps than a normal turn; the goal card and the hints never block the map (a card you can fold, a hint as the quiet notice).
- **Single player only, offline, free:** tutorials never touch the server; the three free maps only (Embervale, The Shattered Isles, Wyrmland), against a Recruit (the Captain for the last two).
- **The start-up bundle** within 2 KB of Step 0's number; the tutorials' data and screens load only when Learn is opened.

## Part 1: the tutorial machinery and the first three (the first deploy)
1. **"Learn"** in the lobby, under Start (a fold like the others, folded by default after the first visit): the seven tutorials in order, each a line (its name, one sentence, "about 5 minutes", a tick when done; done is remembered on the device), and "The guided first game" (Part 3). Tapping one starts it like Continue starts a save.
2. **In a tutorial game:** a **goal card** (top left on desktop, the sheet's first tab on the phone) with the lesson's one-paragraph opening, the goal in one line, and the turn count ("by turn 3"); **one hint a turn**, as the quiet notice, from the file; the turn report's first line is the goal's state ("Goal: Highmouth is yours. Done." or "Goal: not yet, 2 turns left"). **Done:** a card with the closing line and "Next lesson" / "Back to the lobby"; **Missed:** "Try again" (the same saved game) or "Back". No scores, no timers (the clock shows "No timer").
3. **The first three tutorials** (the simplest first; the names are Nate's to rename):
   - **"Take the field"** (chaining attacks): you hold a capital with 12 next to three neutral 1s; the goal: hold all three by turn 2; the hints teach that an attack's survivors march on (the chain) and the odds preview.
   - **"Raise an army"** (recruiting and upkeep): 20 gold, the goal: 20 troops at the capital by turn 2 with gold left for upkeep; the hints teach Recruit, the price, upkeep's first free territories.
   - **"Build and grow"** (culture and buildings): a province half held; the goal: culture 1 in it and a market finished by turn 4; the hints teach Culture, Spend, the Steward's realm.
4. **Tests:** the schema, every tutorial's solution reaches its goal (the engine test above), the hints' count and length, the voice test, done-state remembered, the lobby's Learn fold. **Deploy. Commit and push.** Screenshots: Learn, a goal card (desktop and phone), the Done card.

## Part 2: the other four (the second deploy)
1. **"Hold the wall"** (walls): culture 4 and a fort in place; the goal: raise the wall and hold it against a Captain's attack by turn 4; the hints teach what a wall does and lends.
2. **"Fate and Spoils"** (cards): a hand of two Spoils and a Fate mission in progress; the goal: collect the third Spoils and finish the mission by turn 4.
3. **"Make a deal"** (treaties and deals): a Captain next door with a truce on offer; the goal: a truce agreed and kept for two turns, then a trade; the hints teach the Deals panel, handshake against binding, and the Oathbreaker mark.
4. **"Your leaders"** (commands and budgets): the goal: give your Leader a command and your Steward a budget, then let them take a province by turn 4; the hints teach the Leaders panel, the purse, and the council's question (one is scripted to appear).
5. **Tests as Part 1.** **Deploy. Commit and push.** Screenshots: two of the four on the phone.

## Part 3: the guided first game (the third deploy)
1. **A new player's first single-player game** (no save slots used, no tutorial done, a device flag) gets **three prompts** on turn 1, each a small card pointing at the thing ("This is your capital. Tap it."; "Recruit here: 2 gold a troop."; "Lock in when you're ready. Everyone's orders happen at once."), skippable with one tap ("Skip the guide"), never shown again (the flag). The prompts wait for the tap they ask for; nothing else is blocked.
2. **After turn 1:** one line in the turn report ("Your first turn's report: what you saw, what happened, and what your leaders say.") and nothing more. The guide ends.
3. **Tests:** the flag, the three prompts in order, skip, never again; the voice test. **Deploy. Commit and push.** Screenshots: the three prompts on the phone.

## Part 4 (can slip to 31b): scenarios' first step, and the lobby for a newcomer
1. **A scenario is a tutorial without hints:** the same file format with `kind: "scenario"`, one example ("The Siege of Highmouth": a fixed Embervale start with a goal in 10 turns), listed under Learn as "Scenarios". A player's "Save to a file" already exports a game; a scenario file imports the same way.
2. **The lobby for someone who has never played:** Learn open by default on a first visit, the Start button's line "Or jump in: a 4-player game on Embervale", nothing else moved. **Commit and push.**

## Last: the write-up, the test list
- `docs/11-launch-plan.md`: BUILT lines under §7. `docs/rules-reference.md` ("Learn": the tutorials in one paragraph, the guided first game; the voice test reads it). `docs/04-design-additions.md` §10: a BUILT line. `docs/decisions.md`: one line per decision. `docs/sim-results-m5-random-maps.md`: Step 0's table.
- **"Things to test after session 31"** in `PROGRESS.md`, most important first (each tutorial on the phone; the guided first game in a fresh browser profile; the start bonus on a random map; what Nate's notes changed). Carry over what he hasn't tried.
- `PROGRESS.md` (sessions completed: 31), `docs/decisions.md`.
- **Commit and push.**

## Out of scope (sessions 32 and after)
- Bots that explore under blackout (32, with sims); bigger tables, the map lab off in production, abuse limits (33); launch polish (34); sign-in and Workers Paid (35); the purchase and the site (36); more scenarios (after 1.0).

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass; everything is committed and pushed to `main`. **Run the full `pnpm test` before every push and twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- Every tutorial's solution reaches its goal in the engine test; the twelve maps' fingerprints unchanged; the same seeded sims before and after on the twelve (Step 0 changes only random maps' setup); the start-up bundle within 2 KB of Step 0's trimmed number; the lock check passes on every deploy.
- The seven tutorials and the guided first game have been played on the preview (the session, in Nate's Chrome, on the desktop; the phone is Nate's).
- Every deploy a working build with running games surviving it; the docs and the test list above.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which parts were finished and which slipped (for 31b)
- Step 0: the bundle before and after the trim and what moved; the random-map sim's new table (by exposure, each size) with the bonus and the band
- the tutorial format in one paragraph (the file, the goal predicates, the test that plays each solution)
- the seven tutorials: name, goal, turns, which map, and how long each took you to play
- what Nate's notes changed (one line each)
- the deployed version
