# Claude Code: Session 13 (M3: pause and saved games, then the Spoils and Fate decks)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his browser and a deploy.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session:**
1. **Single-player pause and saved games** (Nate, Oct 6): pause the turn timer, and a game that saves itself every turn, with **Continue** in the lobby and a few save slots.
2. **The two card decks** decided on Oct 2:
   - **Spoils**, earned by conquest and turned in as sets for a windfall.
   - **Fate**, one automatic draw a turn: events on the map, or a mission for you.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit and push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

The parts are in priority order.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md` (the last three entries: session 12, the orchestrator's review and Nate's calls)
3. `docs/04-design-additions.md` §6 (cards: the decisions and **the first-version defaults for this session**), §10 (pause, saved games, tutorials) and §0 (simple to play, deep to master)
4. `docs/decisions.md`, newest lines at the bottom
5. `docs/rules-reference.md` (especially §3 the turn, §7 culture's protection, §16 the Fallen and their world events, which Fate events reuse)
6. `apps/web/src/host/localGame.ts` (today's "Save this game": setup, seed and every turn's orders)

## Step 0: sync
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. If `art/incoming/` has new files, run `pnpm art:import` and commit the result.
3. **Play-test notes:** if Nate pasted notes from sessions 11 or 12, fix anything small and clearly broken first. List anything bigger in your summary.
4. **Small polish item:** the Fallen screen still shows the player's gold in the top bar. Hide it, or show Influence there instead.

## Guardrails (all parts)
- **The hard rules in `CLAUDE.md`:**
  - the engine stays pure and deterministic (seeded randomness only)
  - every engine change has tests, and the determinism test passes
  - balance values live in `packages/content`
  - clients only get `viewFor`
- **Provably fair:** every Fate draw and Spoils mark comes from the game's seeded randomness, so a saved game replays exactly.
- **Fog:** under fog, a Fate event you can't see shows only as a surface detail ("something stirs in Northreach"). Bots judge cards only from their own view.
- **Simple to play:**
  - A basic turn is still about 6 taps on a 384 px phone (run `tap-count.mjs`).
  - The Fate draw needs **no tap**.
  - Turning in a Spoils set takes **2 taps**.
  - Nothing new shows until you have a card or a mission.
- **Fair and readable:** 70/30 skill to luck. Report how often the decks decided a game (below), and keep "guaranteed" odds honest: a Fate event can't make a "guaranteed" attack fail.
- **Game length:** up to 30–40 turns (Nate). Report what the decks do to it.
- **The start-up bundle:** it grew by 24 KB in session 12. Load the new screens (cards, the Fallen, captured generals) only when they're first needed, if that's simple. Report before and after.

## Part 1: single-player pause and saved games
- **Pause:**
  - With a turn timer on, a **Pause** button (top bar) stops the clock; the timer shows "Paused". Planning can go on while paused, or the map dims: your choice, explain it.
  - Without a timer, there's nothing to pause; don't show the button.
  - Multiplayer pause by vote comes in M4. Don't build it now, but keep pause a host action, so the vote can wrap it later.
- **Saved games (on the device):**
  - **Autosave** at the start of every turn's planning. The lobby gets **Continue** (map, turn number, when it was saved).
  - **Save slots:** a few named slots (Settings → Save game / Load game), each showing map, players, turn and date.
  - **"Save to a file" / "Load a file":** today's "Save this game" (for bug reports) grows into this. The file still works with `pnpm sim --replay`.
  - **Choose a save format that survives updates.**
    - Today's file replays every turn's orders, which breaks as soon as the rules change.
    - Store a snapshot of the game as it stands, with a **format version**. Add a small migration when the format changes, or a plain message ("This save is from an older version and can't be loaded").
    - Add a test that loads a save made at the start of this session, so future sessions keep it working.
    - Explain the choice in plain words.
  - Saves stay in the browser (IndexedDB) and never leave the device. Wrap storage so a private window or a full disk shows a plain message instead of breaking the game.
  - **These are the foundation for tutorials** (M5: a saved game with goals and hints). Keep the format easy to load from a file shipped with the game.
- **Tests:**
  - save, load and continue give exactly the same game as playing straight through
  - autosave every turn
  - an old-format save loads or says why it can't
  - pause stops the timer
- **Commit and push.**

## Part 2: the Spoils deck
Defaults are in `04-design-additions.md` §6 (put every number in `packages/content`):
- **Earning:**
  - One Spoils card at the end of any turn you took at least one territory (at most one a turn).
  - Each card shows one of three marks: **Sword**, **Tower** or **Laurel** (seeded draw).
- **Sets of three:**
  - **Three alike** give a big windfall of that kind:
    - Sword: troops at your capital
    - Tower: a free fort with a small garrison on land you choose
    - Laurel: culture in a province you hold
  - **One of each** gives troops and gold.
  - **Windfalls don't grow** with each set turned in (unlike Risk).
- **Hand limit 5:** at 5 cards you must turn in a set that turn. Make that impossible to miss, with a sensible automatic choice if the timer runs out.
- **Turning in is an order** that resolves with the turn's other orders. Use the order queue and the report wording you already have.
- **What others see:** opponents see how many Spoils cards you hold, not which marks (for the bots too).
- **On screen:** a small card stack on your Leader card with its count. Tap it to see your cards and, when you have a set, turn it in (2 taps). The windfall shows in the replay and the report.
- **Bots:** the Captain turns in sets well (a Tower set for a threatened front, a Laurel set for a province it means to hold), reusing its existing judgement.
- **Tests:**
  - earned only on a turn you took land
  - the marks are seeded
  - each set's windfall
  - the hand limit
  - fog (marks hidden)
  - determinism
- **Commit and push.**

## Part 3: the Fate deck
Defaults are in `04-design-additions.md` §6:
- **Every player draws one Fate card a turn,** automatically at the start of planning. It's shown as a line in the report or a small toast, with no tap.
- **About 7 in 10 are events.**
  - They land on a **random spot on the board** (seeded), not necessarily near the player who drew them, and **use the world-event engine from session 12** (the Fallen's events are built as data for this).
  - Most are mild, good or bad; a few are strong.
  - Make a short, flavourful list (about 10–14 events) that only uses things the game already has: troops, gold, borders, culture, buildings. Examples: a bountiful harvest, a flooded ford (a river border closed for a turn), a wandering band that joins whoever holds the land, a fire that damages a building under construction, a plague.
  - **Caps:**
    - culture's protection applies
    - no event takes a capital or knocks a player out
    - one Fate event per territory per turn
  - **What players see:** the holder of the land always sees the event. Others see it in full only if they can see the land; otherwise it's a surface detail.
- **About 3 in 10 are missions,** for the drawer: a goal with a deadline and a reward (offensive, defensive or culture).
  - Make about 8–10, all checkable from the game state. Examples: "Take any territory in Old March within 3 turns: +8 gold"; "Hold Ravencrest for 2 turns: +1 culture there"; "Win a battle across a pass: a free Siege".
  - **At most 2 open at once;** a third draw becomes an event instead.
  - Missions show on your Leader card with their deadline, and the target glows on the map when you tap one.
- **Lobby switch:** "Fate deck: on/off", on by default.
- **The Fallen keep their own event menu** (Nate, Oct 6). Influence doesn't move into Fate draws.
- **Bots:** the Captain gives open missions a modest pull in its planning (don't let it chase bad ones).
- **Tests:**
  - one draw per player per turn
  - the events/missions split
  - seeded and provably fair
  - every cap
  - fog surface details
  - a mission completes, expires and pays out
  - the switch
  - determinism
- **Commit and push.**

## Part 4: sims, write-up, screenshots, deploy, play test
- **Sims** (`docs/sim-results-m3-cards.md`): at 4, 6 and 10 players (500 games each), compare **no decks / Spoils only / Spoils + Fate** on:
  - game length
  - the three runaway measures
  - seat fairness
  - **how often the decks decided a game:** for example, the winner's share of good Fate events, and games where the eventual winner took the lead on a turn they turned in a set
  - Tune the numbers (in `packages/content`) so the decks add colour without becoming the main way to win.
- **Rules reference:** update `docs/rules-reference.md` (pause and saves, Spoils, Fate; update "Not in yet").
- **Screenshots** (desktop and a 384 px phone):
  - Continue in the lobby, and the save slots
  - the Spoils hand with a set ready
  - a Fate event in the replay and the report
  - an open mission on the Leader card with its target lit
  - the paused timer
- `pnpm deploy:preview` passes its lock check.
- **Commit and push.**

## Out of scope
- **Session 14:** preset diplomacy, with bots that judge treaties with strong, explainable logic (`04-design-additions.md` §2).
- **Session 15:** spies, culture unlocks, and the "Govern this province" general instruction.
- **Session 16:** balance pass.
- **M4:** multiplayer pause by vote.
- **M5:** tutorials and scenarios. Part 1's save format is their foundation.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`. **Run the full `pnpm test` before your last push**, not just the package you changed: session 12 pushed one commit with a failing test. Ask Nate to check the repo's Actions page for your last commit (`gh` isn't installed on his computer).
- Screenshots as listed, `docs/sim-results-m3-cards.md`, and `pnpm deploy:preview` with its lock check.
- **Then ask Nate to play on the preview:**
  1. **Laptop, 4 players on Embervale, with a 5-minute timer:**
     - pause mid-turn, then close the tab
     - reopen the game and press **Continue**
     - save to a slot, play on, then load the slot
  2. **Phone, 6 players on the Twin Realms:** collect Spoils and turn in a set. Try to finish a Fate mission.
  3. Do the Fate events feel fair and readable? Do they ever feel like they decided the game?
  4. Tell you how many turns each game took.

  Record what he says.
- `PROGRESS.md` (with "Claude Code sessions completed" bumped to **13**), `docs/decisions.md`, `docs/rules-reference.md` and `docs/04-design-additions.md` (if anything changed) are updated in simple language.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the save format and why, in two lines
- the Spoils and Fate lists as built (one line each), with any defaults you changed and why
- sim numbers: length, runaways and "decided by the decks", with and without
- tap counts and the start-up bundle, before and after
- the screenshot paths
- what Nate said after playing
