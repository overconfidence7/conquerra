# Claude Code: Session 9b (finish session 9: culture, bots that handle a runaway, map clarity, buildings)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his art, his browser and a deploy.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**Session 9 stopped at Nate's usage limit.** Parts A–C of `docs/prompts/claude-code-session-09.md` are done, and Part D (culture) is half done; everything is committed on `main`. **This session finishes all of session 9 in one go.**

**Commit and push after each part below**, so nothing is lost if the session is cut off. If you can tell you're close to the usage limit:
1. stop at the end of a part
2. commit and push
3. note in `PROGRESS.md` exactly where you stopped
4. write the summary

## Read first
1. `CLAUDE.md`
2. `docs/prompts/claude-code-session-09.md`, Parts D–G (the full brief, with the orchestrator's measurements; this prompt adds to it)
3. `git log --oneline -6`, to see what session 9 committed
4. The last three entries of `PROGRESS.md`, and the newest lines of `docs/decisions.md`
5. `docs/08-visual-upgrade-plan.md`, `docs/06-art-direction.md` (border and readability rules) and `docs/map-data.md`

## Step 0: sync
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. If `art/incoming/` has new files, run `pnpm art:import` and commit the result.

## What the orchestrator measured (400 Captain games per step, seed m2)
| 4 players | Avg turns | One player on half the map by turn 10 |
|---|---|---|
| Session 8 (`4dd3ba2`) | 23.9 | 54% |
| + combat fix (`16bcb84`) | 20.2 | 80% |
| + province recruiting (`acca11d`) | 18.6 | 85% |
| + culture (`afc0296`) | 19.3 | 80% |

6 players moved the same way: 48% → 64% → 73% → 66%.

Most of the runaway jump comes from the combat fix. Attacks now work as they should, so games are faster and more decisive. The fix stays.

**Nate's calls (Oct 5):**
- **Runaways are a bot strategy problem**, not an engine or chaining problem. The bots should account for a player pulling ahead, as people do. The counterweight goes in the bots (Part 2); no rule brakes.
- **Game length in real time:** his game against Recruit bots took about 30 minutes, which is too short. His targets are **single player 45–90 minutes** and **a live online game (5-minute timer) 2 hours or more**.
  - Don't change rules for this now: cards, generals, diplomacy, bigger maps (session 10) and smarter opponents will lengthen games.
  - The sim write-up should add a rough real-time estimate: turns × a typical single-player turn of about 1.5 minutes, plus the replay.

## Part 1: finish culture ("loyal land")
1. **Tune it.** Captains that buy culture win only 37.7% against Captains that don't (50% is fair).
   - Use the flags you added to try a defense step of 4–8% per level, and cheaper costs (for example 3, 4, 6, 8, 10).
   - Also check whether the Captain's choice of *where* to buy is the problem: only capitals and choke points, and only when it isn't short of troops at the front.
   - Pick the setting where buyers do at least as well as non-buyers, without making culture a must-buy (keep it under about 55%).
   - If nothing in that range works, report options for Nate rather than going outside it.
2. **Show it:**
   - culture pips (small laurels) on the troop pill at Mid and Near
   - the territory card's line per effect ("Culture 2: defends +10%, shrugs off 30% of unrest, unlocks Siege in Pinemark")
   - "No culture yet: raising it costs 4 gold"
   - the Culture button's draft showing what the next level adds
3. Update `docs/rules-reference.md` §7 and §9.
4. **Commit and push.**

## Part 2: bots that account for a player pulling ahead
1. **Gang up on a runaway leader.** When one rival is clearly running away with the map, Captains make it the main target:
   - "Clearly running away" means it looks to hold around 40% of the land, or far more than anyone else.
   - Priority on their fronts with that rival.
   - No attacks on weak neighbours that only help the leader.
   - Garrisons on the shared front kept honest.
2. **Defend against a fast attacker.** When a rival has been taking several territories a turn (chaining) along a Captain's border, the Captain reinforces that front and its choke points, instead of carrying on with its own expansion elsewhere.
3. **Fog-fair:**
   - Captains judge all of this only from their own view and "last seen" memory. The players panel shows no territory counts, so they estimate; they never read the real state.
   - The same rule applies to every seat; nobody gangs up on Nate because he's human.
4. Keep it simple and explainable, with a scenario test for each behaviour. Generals (session 12) will reuse this logic.
5. **Commit and push.**

## Part 3: the sim and the write-up
- **Standard set:** 1,000 games at 2, 4, 6 and 10 players (Captain), plus the mixed tables, against session 8's numbers in `docs/sim-results-m3-bots.md`.
- **Add two clearer runaway measures** next to the turn-10 one:
  - how often the player leading at the **halfway point** goes on to win
  - how often the eventual winner was **not** the leader at turn 10 (comebacks)
- **Report:**
  - game length, the share inside 15–25 turns, and the rough real-time estimate
  - seat fairness
  - all three runaway measures, before and after Part 2
  - culture purchases and where they go
  - recruits by site type (capital, barracks, full province)
  - lopsided attacks that failed (should stay 0)
- Write it up as `docs/sim-results-m3-fixes.md`, including the orchestrator's table above.
- **No other rule changes.** If something is badly off target, describe it and give Nate options.
- **Commit and push.**

## Part 4: map clarity (Part E of session 9)
The orchestrator measured:
- **Embervale:** 8 land borders under a quarter of the usual length (the shortest is 4.4 map units against a typical 88), and passes 12–23 units wide.
- **Greatmarch:** 13 short borders (the shortest is 0.6), and passes 9–31 units wide.

The work:
1. **No hairline borders:** a minimum shared border length in the map maker (widen the contact, or they aren't neighbours; explain your choice), plus a `checkMap` check.
2. **Passes wide enough to see at Mid zoom**, with a road and a code-drawn gate or cairn, plus a `checkMap` check.
3. **Rebuild Embervale and Greatmarch** with `MAPGEN_VERSION` 2:
   - same sizes and character
   - updated `docs/maps/*.png`, `docs/map-data.md` and the rules (§12)
   - a quick sim (400 games at 4 and 10 players) to confirm the new maps play about the same
4. **Neighbour link marks:**
   - When a territory is selected, every neighbour gets a small gilded chevron across the shared border, or its sea lane lights up.
   - The border type (river, pass, sea lane) is marked.
   - Only for the selected territory, so the map stays uncluttered.
5. **Clearer territory edges** at every zoom: a crisp ink line with a light halo, including inside one House's land and between neutral lands.
6. **Provinces you can see:**
   - Province borders get their own style (a gilded double line).
   - Each province gets a plaque: "Pinemark +3 · you hold 3 of 5" (just "+3" if you hold none), shown at Mid and Far.
   - Province names never cover army pills.
7. **Tactical view:** make sure it really is flat House colours (the saved screenshot looks painted). Retake it.
8. **Commit and push.**

## Part 5: buildings and panel wording (Parts F and G of session 9)
1. **Buildings stand on the map:**
   - About twice today's size (`BUILDING_SIZE = 26`), on a ground shadow like the capital's, never hidden under the pill.
   - **Under construction:** a code-drawn scaffold with a slightly desaturated tint, and an hourglass on the pill icon. No 45% transparency.
   - Once built, a solid pill icon.
   - Check all four buildings on every ground at Far, Mid and Near.
2. **Panel wording:** the army panel and territory card use plain words and icon rows instead of dense grey text, readable on a 384 px-wide phone.
3. **Commit and push.**

## Out of scope
- **Session 10:** the map lab, bigger maps (60–120 territories) and new land shapes.
- **Session 11:** the big visual upgrade and Nate's new art (pines, textures, mountain ranges, construction sprites, plaque art).
- **Session 12 onward:** generals, the Fallen, card decks, diplomacy, spies, the balance pass.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`.
- **Screenshots** in `docs/art/screens/`, desktop and phone where it matters:
  - the recruit panel with glowing sites
  - the culture card and pips
  - a turn report with a plain-words "called off" line
  - neighbour links (one with a pass, one with a sea lane)
  - province borders and plaques at Mid and Far
  - all four buildings, finished and under construction, at Mid and Near
  - the reworded army panel and territory card
  - Tactical view
  - the rebuilt map previews
- `pnpm deploy:preview` passes its lock check (once, at the end).
- Then ask Nate to:
  1. tap **Update now**
  2. play a game against Captains
  3. recruit in a province he holds completely, choosing the amount
  4. try an overwhelming attack
  5. read the culture card
  6. check that he can see what's connected, where provinces are and what they're worth
  7. build a fort and see it stand on the map
  8. use "Save this game" once

  Record what he says, including how long the game took.
- `PROGRESS.md` (one entry for all of session 9, with "Claude Code sessions completed" bumped to **9**), `docs/decisions.md` and `docs/rules-reference.md` (§4, §7, §9, §12) are updated in simple language.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the culture numbers chosen, and the buyer-vs-non-buyer win rate
- the sim table (session 8 → now), with the real-time estimate
- the three runaway measures with and without Part 2
- the border and pass numbers before and after the rebuild
- the screenshot paths
- what Nate said, and how long his game took
