# Claude Code: Session 15 (M3: Nate's diplomacy calls, right of passage, spies, the culture ladder, then "Govern this province")

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his browser and a deploy.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session:**
1. **Nate's calls after session 14** (Step 0): a harsher Oathbreaker, a "Diplomacy: On/Off" lobby switch, and three small fixes.
2. **Right of passage's moves** (moved from session 14).
3. **Spies** (Nate's design from Oct 2, with the open details he settled on Oct 6).
4. **A richer culture ladder:** two new specialists, Rangers and the Standard-bearer.
5. **"Govern this province"**, a fifth general instruction, only if there's room.

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit and push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

The parts are in priority order. **Part 4 ends with the deploy, so the session is complete there.** Part 5 ("Govern this province") is extra: start it only if you have room for it and a second deploy; otherwise it moves to session 16.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md` (the last two entries: session 14, and the orchestrator's review with Nate's calls)
3. `docs/04-design-additions.md`:
   - §8 (fog and spies: **the design and Nate's Oct 6 decisions**)
   - §5 (culture: **the new ladder**)
   - §2 (diplomacy: as built, and Nate's calls after session 14)
   - §4 (generals: **"Govern this province", first-version defaults**)
   - §0 (simple to play, deep to master)
4. `docs/decisions.md`, newest lines at the bottom
5. `docs/rules-reference.md` (§3 the turn, §6 armies and specialists, §7 culture, §8 unrest, the fog and last-seen rules, generals, §20 diplomacy)
6. `docs/sim-results-m3-diplomacy.md`
7. The engine's vision and last-seen memory code (`packages/engine/src/vision.ts`, `sightings.ts`, `view.ts`), and the diplomacy code from session 14

## Step 0: sync, then Nate's calls
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. If `art/incoming/` has new files, run `pnpm art:import` and commit the result.
3. **Play-test notes:** if Nate pasted notes from sessions 11–14, fix anything small and clearly broken first. List anything bigger in your summary.
4. **A harsher Oathbreaker (Nate):** about double the fine and the unrest. In `rules.diplomacy.oathbreaker`: `fineBase` 4, `finePerSize` 1.4, `unrestPerSize` 0.8 (the mark still lasts 5 turns). Check that the attack warning and the Captain's "is breaking worth it" judgement use the new numbers.
5. **"Diplomacy: On/Off" in the lobby (Nate),** on by default, next to the Fate deck switch. Off means no Propose, no offers and no deals; the bots play exactly as with diplomacy off in the sim (the fingerprint test). Store it in the game settings so saves keep it.
6. **Small fixes from the screenshots:**
   - The offer card's promise line reads "Handshake: free; breaking it costs (Oathbreaker)". Make it say what breaking costs in plain words, for example "Handshake: free. Breaking it brings the Oathbreaker mark, about 16 gold and unrest."
   - In `s14-warning.png`, the Players panel still showed a binding pact that the screenshot script had removed from the view. Check that the panel updates when a deal ends or expires in a real game. Fix it if it's a real bug.
   - The Oathbreaker badge pushes the player's name onto two lines in the Players panel ("Lady / Morwen"). Keep the name on one line (the badge can sit under it or shrink).
7. Update `docs/rules-reference.md` §20 for the new numbers and the switch.
8. **Commit and push.**

## Guardrails (all parts)
- **The hard rules in `CLAUDE.md`:**
  - the engine stays pure and deterministic (seeded randomness only)
  - every engine change has tests, and the determinism test passes
  - balance values live in `packages/content`
  - clients only get `viewFor`
- **Saves:** bump the game-state version with a migration if the game's shape changes (spies, Govern progress), and keep the session 13 save fixture loading. Add a session 14 fixture too.
- **Fog is the heart of spies:**
  - A spy's intel arrives only through `viewFor`.
  - **A fooled player's view must look exactly like real intel:** nothing in the data the client gets may reveal that it's false.
  - **What you see directly always wins over spy intel.** Your own land and the land bordering it are always shown as they truly are, so a fooled spy can never touch the odds preview, and "guaranteed" still always wins.
  - Other players never see your spies on the map. Bots judge only from their own view, including any false intel they were fed.
  - Extend the fog-leak property tests to cover spies, including fooled ones.
- **Simple to play:**
  - A basic turn is still about 6 taps on a 384 px phone (run `tap-count.mjs`).
  - Sending a spy to a province: about 3 taps after hiring.
  - Nothing new shows until you hire a spy or a culture level unlocks something.
- **Military first, culture light:** culture still unlocks only specialists. No tree, no new resource. Gold is the only resource.
- **Game length:** up to 30–40 turns (Nate). Report what this session's systems do to it. Don't change rules for length; the balance pass (session 16) has bots offer fewer truces at big tables.
- **The start-up bundle** is 493.9 KB. Load the new screens only when they're first needed. Report the size before and after.

## Part 1: right of passage's moves
Defaults are in `04-design-additions.md` §2. The deal is already stored and expires; the moves are what's missing.
- While the deal lasts, your armies may move through the partner's land, but can't stop or fight there. A chained move may pass through it to your own land, or to an attack beyond.
- A move through land that changed hands stops at your last territory before it.
- **Bots** use passage when it opens a front they want, and judge passage offers like any other deal. Letting a runaway through is a no ("You're running away with the map. I won't let you through."), and so is letting through someone who's attacking a partner of theirs.
- **Screens:** the Passage card in Propose (drop "soon"); passage land on the map where you can see it (readable at every zoom, in the info layer); moving through it shows in the draft and in the replay.
- **Tests:** passing through, never stopping there, a chain beyond it, land that changed hands, expiry, the bots' judgement, determinism.
- **Commit and push.**

## Part 2: spies
The design is in `04-design-additions.md` §8, with Nate's Oct 6 decisions (every number in `packages/content`):
- **Hiring:** 8 gold, 1 gold upkeep, **up to 5** spies. Hired at your capital or a barracks. A spy is its own piece, not part of an army.
- **Travel:** **2 territories a turn.** While a spy is in a province no single player holds whole, the fog lifts **2 territories** around it.
- **Infiltrating a province:** entering a province one player holds whole is an attempt to infiltrate it. While a spy stays in, the fog stays lifted on the whole province every turn, until the spy is killed or recalled, or the defence changes (then the contest is run again).
- **Defending:** only a player who holds a whole province can defend it, by stationing spies in it. Defenders hold their post and block other spies.
- **Spy against spy** (at most 3 spies a side in one province): each attacking spy beyond the first cancels one defender. What's left decides:
  - **0:** infiltrates (sees the true province)
  - **1:** blocked (the spy comes home)
  - **2:** killed (all the attacking spies in that attempt die)
  - **3:** **fooled.** The attacker thinks it got in, but sees false information close to the truth: the owner is right, but troops, culture, Leaders and positions are wrong or moved. The attacker isn't told. The false picture is generated from the true state with the game's seeded randomness, and is written into the attacker's last-seen memory.
- **Recall:** the spy is back at your capital at the start of the next turn.
- **The defender is told** when an incoming spy is blocked or killed ("A spy was caught in Old March"), **never when it's fooled.**
- **Spies don't affect combat.** They're only about information.
- **Bots:**
  - The Captain hires a spy or two when it has gold to spare. It infiltrates the province of its main target or the runaway leader, and stations defenders in a whole province a rival borders.
  - It judges from what its spies show it, false intel included.
  - The Recruit doesn't use spies.
- **Screens:**
  - Hire a spy from Hire (capital or barracks).
  - Tap a spy, then a province to send it to, or **Recall**.
  - A defender's post shows on the province.
  - Your spies show on the map (only to you), with a small eye on each infiltrated province.
  - Report lines say what happened in plain words ("Your spy slipped into the Oak Downs", "Your spy was turned back at Old March", "Your spy was killed in Rush March").
  - A fooled spy's report reads exactly like an infiltration.
- **Tests:**
  - every row of the spy-against-spy table, including the design's four examples (2 vs 1 killed; 2 vs 3 infiltrates; 3 vs 2 killed; 1 vs 2 infiltrates)
  - travel and its fog lift
  - infiltration lasting until the defence changes
  - recall, the cap, upkeep (and unrest when you can't pay)
  - fooled intel: deterministic, close to the truth, the owner right, never leaking through the view
  - direct sight beating spy intel
  - the defender's messages
  - bots
  - determinism, and the save migration
- **Commit and push.**

## Part 3: the culture ladder
Defaults are in `04-design-additions.md` §5 (numbers in `rules.specialists`). The ladder uses the total culture you hold in the province, as today:
- **Culture 4: Rangers** (9 gold, upkeep 1). When this army attacks, forest, hills and swamp defend like plains. Mountains still count. It's Siege's counterpart for terrain.
- **Culture 6: Standard-bearer** (12 gold, upkeep 1). This army attacks 10% stronger. Two in one army don't stack.
- The odds preview includes both.
- **The territory card's culture line** names what's unlocked and the next step ("Culture 4 in Pinemark: Rangers. Next: Standard-bearer at 6"). The Hire menu shows locked specialists with the culture they need.
- **Bots:** the Captain hires them with its existing judgement: Rangers for a forest or hill front, a Standard-bearer for a big push.
- **Art:** use a placeholder icon in the same style for now. Add the two portraits to the art list under "Tier 3: later" (never as a new `##` section after a batch: a test counts that file's names).
- **Tests:** the unlock thresholds, each effect in combat and in the preview, no stacking, the bots, determinism.
- **Commit and push.**

## Part 4: sims, write-up, screenshots, deploy, play test
- **Sims** (`docs/sim-results-m3-spies.md`): at 4, 6 and 10 players (500 games each), compare with and without spies (a `--spies on|off` switch for the sim), on:
  - game length, the three runaway measures, seat fairness
  - spies hired per game, and how often attempts infiltrate, are blocked, killed or fooled
  - how often the new specialists are hired
  - passage deals per game
  - Tune so spies are worth a little gold, not a must-buy.
- **Rules reference:** right of passage in §20, new sections for spies and the culture ladder (§6 and §7 too), and "Not in yet".
- **Screenshots** (desktop and a 384 px phone), in `docs/art/screens/s15-*.png`:
  - the Diplomacy switch in the lobby
  - passage land on the map, and a move through it
  - a spy on the move with its fog lift
  - an infiltrated province with its eye
  - the report lines for a spy caught
  - the Hire menu with Rangers and the Standard-bearer (one locked)
  - the culture line on the territory card
- `pnpm deploy:preview` passes its lock check.
- **Commit and push.**

## Part 5 (only if there's room): "Govern this province"
Defaults are in `04-design-additions.md` §4:
- A fifth instruction for any general (your Leader or a captured one) standing in a province where you hold most of the land.
- The general's army stays in the province and defends it, as "Hold here" does across the whole province.
- **It keeps 25% of the province's income** (its territories and its holding bonus) and spends it on the province the same turn: a fort on the most threatened frontier territory first, else culture where the province is most exposed, else troops at the general's territory. The rest goes home as usual.
- **No second pot for the player to track:** what it can't spend yet is held toward the next purchase and shown only as progress on the province ("A fort at Pinemark: 5 of 10 gold"). If the general leaves the province or is lost, that progress goes home.
- One line on the Leader card and in the report: "Your Leader governs Old March: kept 3 gold, raised culture in Pinemark."
- **Generals never spend your own gold.** The share is the province's own income.
- The Captain may use it for a captured general in a province it holds safely.
- **Tests,** then `pnpm deploy:preview` again. **Commit and push.**
- If there isn't room, write in your summary that it moves to session 16.

## Out of scope
- **Session 16:** balance pass (bots offer fewer truces at big tables, runaways, game length up to 30–40 turns, seat fairness, the Fallen's and the decks' length cost), and "Govern this province" if Part 5 didn't fit.
- **M4:** online with friends, deals between people, multiplayer pause by vote.
- **M5:** tutorials (including spies and treaties) and scenarios.
- **Not planned:** shared vision between partners; spies that sabotage or affect combat.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`. **Run the full `pnpm test` before your last push**, not just the package you changed. Ask Nate to check the repo's Actions page for your last commit (`gh` isn't installed on his computer).
- Screenshots as listed, `docs/sim-results-m3-spies.md`, and `pnpm deploy:preview` with its lock check.
- **Then ask Nate to play on the preview:**
  1. **Laptop, 4 players on Embervale, Captain bots:**
     - break a handshake truce and check the harsher Oathbreaker
     - get right of passage from a neighbour and march through to a rival
     - hire a spy and send it into a province a rival holds whole
     - raise culture to 4 in a province and hire Rangers for a forest attack
  2. **Laptop, a second game with Diplomacy Off:** does it feel faster?
  3. **Phone, 6 players on the Twin Realms:** send and recall a spy, and count the taps.
  4. Do spies feel worth their gold? Did you ever suspect you'd been fooled?
  5. How many turns did each game take?

  Record what he says.
- `PROGRESS.md` (with "Claude Code sessions completed" bumped to **15**), `docs/decisions.md`, `docs/rules-reference.md` and `docs/04-design-additions.md` (if anything changed) are updated in simple language.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- spies as built (one short paragraph), and any defaults you changed and why
- spy outcomes (infiltrated, blocked, killed, fooled per game) and what spies do to length and runaways
- how often Rangers and Standard-bearers are hired
- whether "Govern this province" was built or moves to session 16
- tap counts (basic turn, send a spy) and the start-up bundle, before and after
- the screenshot paths
- what Nate said after playing
