# Claude Code: Session 14 (M3: Nate's calls on the decks, then preset diplomacy)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his browser and a deploy.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session:**
1. **Nate's three calls after session 13** (Step 0): the bigger Spoils rewards come back, Continue keeps your queued orders, and the first Fate draw comes later.
2. **Preset diplomacy** (Nate, Oct 6): truces, trades, joint wars and right of passage, as handshake deals or binding pacts, with **bots that accept or decline for reasons they can explain in one plain line**.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit and push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

The parts are in priority order. **Part 4 ends with the deploy, so the session is complete there.** Part 5 (right of passage) is extra: start it only if you have room for it and a second deploy; otherwise it moves to session 15.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md` (the last two entries: session 13, and the orchestrator's review with Nate's calls)
3. `docs/04-design-additions.md` §2 (diplomacy: **Nate's decisions and the first-version defaults for this session**), §4 (generals), §6 (cards: Nate's calls after session 13) and §0 (simple to play, deep to master)
4. `docs/02-game-design-outline.md` §8 (diplomacy: handshake and binding, the Oathbreaker penalty)
5. `docs/decisions.md`, newest lines at the bottom
6. `docs/rules-reference.md` (§3 the turn, §7 culture's protection, §8 unrest, generals, §17 saved games, §18–19 the decks)
7. `packages/bots/src/board.ts` (`readBoard`, `runawayLeader`), `captain.ts` and `generals.ts`: the bots' judgement that diplomacy builds on
8. `packages/engine/src/saved.ts` (the save format and its migrations)

## Step 0: sync, then Nate's calls
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. If `art/incoming/` has new files, run `pnpm art:import` and commit the result.
3. **Play-test notes:** if Nate pasted notes from sessions 11, 12 or 13, fix anything small and clearly broken first. List anything bigger in your summary.
4. **Spoils go back to the bigger rewards (Nate):** in `rules.spoils`, three Swords **8 troops**, three Towers a fort + **3 troops**, one of each **4 troops + 6 gold**. Laurels are unchanged.
5. **The first Fate draw comes at the end of turn 3 (Nate),** so the opening turns stay quiet. Add the number to `rules.fate` (for example `firstDrawTurn: 3`), with a test. Missions and events both wait.
6. **Continue keeps your queued orders (Nate):** orders you'd queued but not locked in are kept with the autosave (save them as the queue changes, without slowing the game), and Continue puts them back. Test it: queue, close, Continue, and the same orders are there.
7. **Phone fix:** on a 384 px phone, the Save game dialog's "Save to a file" button squeezes its label into a narrow column beside its explanation (`docs/art/screens/s13-save-slots-phone.png`). Put the explanation under the label, or drop it on a phone. Check "Load a file" too.
8. **Re-run the deck sims** with the new numbers (4, 6 and 10 players, 500 games, no decks vs both decks) and add a short "After Nate's calls" section at the top of `docs/sim-results-m3-cards.md`: length, the three runaway measures and "decided by the decks". Update `docs/rules-reference.md` §18–19.
9. **Commit and push.**

## Guardrails (all parts)
- **The hard rules in `CLAUDE.md`:**
  - the engine stays pure and deterministic (seeded randomness only)
  - every engine change has tests, and the determinism test passes
  - balance values live in `packages/content`
  - clients only get `viewFor`
- **Saves and replays:** offers, answers and deals must be part of what's saved and replayed (for example `propose` and `answer` orders that take no slot, as `instruct` does), so a saved game and `pnpm sim --replay` reproduce exactly. Bump the game-state version with a migration (a game saved before diplomacy carries on with no deals), and keep the session 13 save fixture loading.
- **Keep negotiation a host action:** in single player the host asks each bot to answer during planning. In M4 the same offers and answers will travel between people, so don't tie them to the bots.
- **Fog:** deals are public, but nothing else leaks. Everyone knows who has a deal with whom; the terms of a trade go only to the two sides. Truce borders and passage land show on the map only where you can see them. Bots judge offers only from their own view.
- **Simple to play:**
  - A basic turn is still about 6 taps on a 384 px phone (run `tap-count.mjs`).
  - Proposing a plain truce takes **4 taps or fewer** from the Players panel, and accepting an offer is **1 tap** once it's open.
  - Nothing new shows until there's an offer or a deal, apart from **Propose** in the Players panel.
  - Players panel: still no territory counts.
- **Military first:** deals shape the war; they don't replace it. Gold is still the only resource.
- **Game length:** up to 30–40 turns (Nate). Report what diplomacy does to it, but don't change rules just for length; the balance pass (session 16) looks at it.
- **The start-up bundle** is 489.9 KB. Load the diplomacy screens only when they're first needed. Report the size before and after.

## Part 1: deals in the engine
Defaults are in `04-design-additions.md` §2 (put every number in `packages/content`, under something like `rules.diplomacy`):
- **The re-confirm rule:**
  - Both sides confirm during the same planning phase.
  - The deal starts as the turn resolves, before any move.
  - An offer nobody confirmed lapses when the turn resolves.
  - Any attack between the two players during the replay voids every open offer between them.
- **The deal cards:**
  - **Truce:** named borders, a whole province, or everywhere between you. For 2–8 turns (3 by default), or "until Player X is knocked out" (8 turns at most).
  - **Trade:** gold now, gold each turn (5 turns at most), or land (no capitals; at most 3 territories; the land must border the receiver's). The giver's troops step back to its own neighbouring land, one of the receiver's troops moves in from its strongest neighbour, buildings stay, and culture goes as on conquest. A missed payment breaks the deal.
  - **Joint war:** both name the same third player for 2–6 turns (4 by default), with a truce between the partners while it lasts. Attacking your partner, or a truce with the target, breaks it. Partners don't share what they see.
  - **Right of passage:** store it now (so saves don't change again), but its moves come in Part 5.
- **Handshake and binding:**
  - **Handshake:** free. Breaking one brings a public **Oathbreaker** mark (5 turns), a gold fine and unrest on your land next to the player you wronged (culture protects), all scaled by the deal's size (land covered, turns, gold traded; "until X is knocked out" counts as big).
  - **Binding:** each side pays gold up front, more for longer and bigger deals. Attacks across it can't be queued, and any that would cross it the turn it starts are called off with a report line. Gold owed each turn is taken automatically. It can't be broken.
- **Limits:** every deal expires (8 turns at most). One deal of each kind between the same two players at a time. A knocked-out player's deals end; the Fallen don't make deals.
- **The view:** who has which deal with whom, for everyone; trade terms only for the two sides; Oathbreaker marks for everyone.
- **Report and replay lines** for a deal starting, ending, being broken and an attack called off, in plain words.
- **Tests:**
  - the re-confirm rule, including an attack in the replay voiding open offers
  - each deal card: starting, running, expiring
  - breaking a handshake deal: the mark, the fine and the unrest, scaled by size
  - a binding pact blocks the attack and takes payments
  - trades of land: troops step back and in, capitals refused
  - knocked-out players' deals end
  - fog: trade terms and unseen borders don't leak
  - the save migration and the session 13 fixture
  - determinism
- **Commit and push.**

## Part 2: the bots' judgement
**Nate's requirement: strong, explainable logic behind every yes and no.**
- **Answering an offer,** from the bot's own view only, with **one plain reason line** for every answer. The judgement weighs:
  - its fronts, and where its armies are needed ("I need my army in the west")
  - who's ahead, by the Captain's runaway rule ("You're running away with the map")
  - what the deal frees up or costs (troops held on that border, gold)
  - its trust in the proposer ("You broke our truce at Old March")
- **Never help a runaway leader:** no truce that frees it to grow, no trade that gives it land. Always open to a joint war against one.
- **Counteroffers:** when an offer is close, the bot may counter once (more gold, a shorter truce), with its reason.
- **Trust:** a score per player. It drops a lot when that player breaks a deal with the bot, a little when a joint war falls through, and climbs slowly with deals kept. An Oathbreaker mark lowers every bot's trust in that player. It's part of the saved game.
- **Proposing:** the Captain proposes a truce on a front it can't afford, a joint war against a runaway, and a trade when it's short of gold or wants land that completes a province. Bots make deals with each other too, in a fixed order so games stay deterministic. Don't let them flood the player with offers (a cap per turn in `packages/content`).
- **Keeping its word:** bots honour deals, except that the Captain may break a handshake deal when the gain clearly outweighs the penalty (a capital it's sure to take, or the win), and it says so.
- **The Recruit:** simpler rules. It takes a truce when it's weaker and refuses when it's stronger, and it never proposes trades.
- **Generals respect every deal:** a general never attacks across a truce or breaks a deal, and "Raid a rival" can't name a partner.
- **Keep the Captain's play unchanged with diplomacy off:** its fingerprint test should still pass.
- **Tests:** the reason lines for each kind of answer; never helping a runaway; trust going down and up; the counteroffer; generals respecting deals; the Recruit's rules; determinism with bots making deals with each other.
- **Commit and push.**

## Part 3: the screens
- **Propose:** tap a player in the Players panel, then **Propose**. The deal cards (Truce, Trade, Joint war; Passage shows as "coming soon" until Part 5) come with sensible defaults filled in. Change the terms if you like, pick **Handshake** or **Binding** (with its gold cost shown), and **Send**.
  - A truce's borders: everywhere by default; picking a province or borders on the map is optional.
  - A trade's land: picked on the map.
- **Answers:** a bot's answer appears at once, with its reason line. A counteroffer opens as the same card with the changes marked.
- **Offers to you:** a small toast as planning starts ("Lady Morwen offers a truce"). Tap to open it, then **Accept**, **Counter** or **Decline**. An unanswered offer lapses when the turn resolves.
- **Deals on screen:**
  - **The Players panel:** a small mark between players for each deal (a seal on a binding one), how many turns are left, and the Oathbreaker mark.
  - **The map:** truce borders and passage land, where you can see them. Make them readable at every zoom, in the info layer (the painting never carries game state).
  - **Orders:** an attack across a binding pact can't be queued (the reason shows); one across a handshake truce shows a warning ("This breaks your truce with Lady Morwen: Oathbreaker, about 8 gold and unrest").
  - **Replay and report:** deals starting, ending and breaking; attacks called off.
- **Phone and desktop** both. Check the tap counts.
- **Tests:** the web logic (proposals, answers, the warning, what shows when).
- **Commit and push.**

## Part 4: sims, write-up, screenshots, deploy, play test
- **Sims** (`docs/sim-results-m3-diplomacy.md`), with a `--diplomacy on|off` switch:
  - **Acceptance rates** on a fixed set of offers to the Captain, sorted beforehand into good, neutral and bad for the bot (for example: a truce when it's fighting on two fronts; a fair gold trade; a truce that frees the runaway leader). As a rough guide, good offers should mostly be accepted, bad ones rarely, and neutral ones somewhere between. Report the rates and say if they're far off.
  - **At 4, 6 and 10 players (500 games each), diplomacy off vs on:** game length, the three runaway measures, seat fairness, deals made and broken per game, and how many were joint wars against the leader.
  - **Ten sample reason lines** from real sim games, so Nate can judge whether they read as strong logic.
  - Tune the numbers (in `packages/content`) so bots aren't pushovers or walls.
- **Rules reference:** a new diplomacy section in `docs/rules-reference.md`; update "Not in yet".
- **Screenshots** (desktop and a 384 px phone), in `docs/art/screens/s14-*.png`:
  - the Propose card for a truce
  - a bot's answer with its reason (a decline and an accept)
  - an offer to you, opened
  - the Players panel with a binding pact and an Oathbreaker mark
  - a truce border on the map
  - the warning on an attack across a handshake truce
- `pnpm deploy:preview` passes its lock check.
- **Commit and push.**

## Part 5 (only if there's room): right of passage
- Your armies may move through a partner's land while the deal lasts, but can't stop or fight there. A chained move may pass through it to your land or an attack beyond.
- A move through land that changed hands stops at your last territory before it.
- The bots use it when it opens a front they want, and judge passage offers like any other deal (letting a runaway through is a no).
- The Propose card for passage, and passage land on the map.
- **Tests,** then `pnpm deploy:preview` again. **Commit and push.**
- If there isn't room, write in your summary that it moves to session 15.

## Out of scope
- **Session 15:** spies, culture unlocks, and the "Govern this province" general instruction (and right of passage if Part 5 didn't fit).
- **Session 16:** balance pass (runaways, game length, seat fairness, the Fallen's and the decks' length cost).
- **M4:** deals between people online, and multiplayer pause by vote.
- **M5:** tutorials (one teaches treaties) and scenarios.
- **Not planned:** shared vision between partners, team victories (only in team modes set up at the start).

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`. **Run the full `pnpm test` before your last push**, not just the package you changed. Ask Nate to check the repo's Actions page for your last commit (`gh` isn't installed on his computer).
- Screenshots as listed, `docs/sim-results-m3-diplomacy.md`, the "After Nate's calls" section in `docs/sim-results-m3-cards.md`, and `pnpm deploy:preview` with its lock check.
- **Then ask Nate to play on the preview:**
  1. **Laptop, 4 players on Embervale, Captain bots:**
     - propose a truce to the bot next to you; if it says no, read its reason
     - propose a joint war against whoever is leading
     - make a binding pact, then try to attack across it
     - break a handshake truce and watch the Oathbreaker mark, the fine and the unrest
     - trade gold for a territory
     - close the tab mid-turn with orders queued, then press Continue
  2. **Phone, 6 players on the Twin Realms:** answer an offer from a bot's toast; propose a truce and count the taps; check that Fate stays quiet for the first three turns.
  3. Do the bots' reasons sound like strong logic? Are they too easy or too stubborn?
  4. How many turns did each game take?

  Record what he says.
- `PROGRESS.md` (with "Claude Code sessions completed" bumped to **14**), `docs/decisions.md`, `docs/rules-reference.md` and `docs/04-design-additions.md` (if anything changed) are updated in simple language.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the deal cards as built (one line each), with any defaults you changed and why
- acceptance rates (good, neutral, bad) and three sample reason lines
- sim numbers with diplomacy off and on: length, runaways, deals and breaks per game
- the deck sims after Nate's calls (length and "decided by the decks")
- tap counts (basic turn, propose a truce, accept) and the start-up bundle, before and after
- whether right of passage was built or moves to session 15
- the screenshot paths
- what Nate said after playing
