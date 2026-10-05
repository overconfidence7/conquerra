# Claude Code: Session 9 (M3: Nate's play-test fixes: combat bug, recruiting, culture, map clarity, buildings)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his art, his browser and a deploy.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

Nate played a full game and found real problems:
- an attack of 35 against 1 that failed
- recruits that only ever landed in his capital or one other place, with no way to choose how many
- culture that didn't seem to matter
- borders and passes that hide what's connected
- provinces you can't make out
- buildings that look like ghosts

**This session fixes all of them.** The map lab moves to session 10 and the big visual upgrade to session 11. Do the parts in order: the engine and rules first, then what's on screen.

## Read first, in this order
1. `CLAUDE.md` (hard rules)
2. `PROGRESS.md` (the last three entries, especially "Nate's play test of session 8")
3. `docs/decisions.md`, newest lines at the bottom (the Oct 4 evening lines on combat, recruiting, culture, connections and buildings)
4. `docs/08-visual-upgrade-plan.md` (the orchestrator's visual review; this session is its "Session 9" step)
5. `docs/rules-reference.md`:
   - §4 (orders)
   - §7 (culture)
   - §8 (gold)
   - §9 (combat)
   - §10 (buildings)
   - §12 (the map)
6. `docs/06-art-direction.md` (borders and readability rules) and `docs/map-data.md`

## Step 0: sync
1. Run `git --no-optional-locks status`. Nate's folder is behind `main`: the orchestrator pushed docs and this prompt.
2. If anything local is uncommitted, stash it and check it against `main`, as in session 6.
3. Run `git pull` and `pnpm install`. Work on `main` and push to `main`.
4. If `art/incoming/` has new files, run `pnpm art:import` and commit the result.

## Part A: the combat bug (engine, first)
**Found by the orchestrator:**
- `resolve.ts` rolls luck on `exp.expectedDefenderLosses`, which `expectBattle` has already **capped at the defender's troop count**.
- So 35 against 1 rolls "about 1 loss, ±30%", and that rounds down to 0 some of the time. The attack fails, even though the odds preview says "guaranteed".
- In 300 bot games, about **5% of attacks with 8 times the defenders or more failed** this way.
- The attacker's side has the same flaw.

**The fix:**
- Roll on the **uncapped** expected losses, then cap the result.
- Keep the "both sides wiped out" rule as it is.

**Tests:**
- **Property test:** for any battle and luck level, an attack the preview calls "guaranteed" always captures, and one it calls "impossible" never does.
- 35 against 1 always wins at every luck level.
- Determinism still holds.

**Sim:** this changes every battle, so re-run the standard set in Part G after the other rule changes.

## Part B: orders that didn't happen explain themselves
- **The turn report says which order and why, in plain words.** For example:
  > "Your attack from Greyrest on Ashfell was called off: by the time it came up, Ashfell held 14 troops (you planned for 1), so 'Only if still stronger' stopped it."

  Do this for every fizzle reason in `resolve.ts`, and add a test that each reason has a sentence.
- **A battle's line shows both armies and both sides' losses** (it may already). When the attacker loses, say why in one line: "They held: hills and a fort."
- **Settings → "Save this game"** downloads a small file: the setup, the seed and every turn's orders. Single player only, so the full state is fine.
  - `pnpm sim --replay <file>` replays it turn by turn and prints the events.
  - Then Nate can attach a strange game and we can see exactly what happened.

## Part C: recruiting (rule change decided by Nate)
- **Where you can recruit:**
  - your **capital**
  - any **barracks**
  - **any territory in a province you fully hold** (new)
- **Choosing the place:**
  - Recruit goes to the territory you have selected, if it's a recruit site.
  - When Recruit is open, every site you can use glows on the map.
  - If the selected territory can't recruit, the panel says why ("Recruit at your capital, a barracks, or anywhere in a province you hold completely") and offers the nearest site with one tap.
- **Choosing how many:**
  - Recruit gets the same chip row as attacks: **All, 3/4, 1/2, 1/4** of your gold, with an exact number under More.
  - The default stays **All**, so a typical turn doesn't gain taps.
  - You can queue several recruit orders to split troops across sites.
  - Recruit orders in the queue can be edited (place and amount).
- **Barracks:** still recruit and hire specialists. Hiring stays at the capital and barracks only.
- Both bots use the new rule. Count the taps for a typical turn again.
- Update `docs/rules-reference.md`.

## Part D: culture becomes "loyal land" (rule change decided by Nate)
Culture needs its own military job, and players need to see it.
- **What each culture level gives on that territory:**
  - **defense +5% per level** (so +25% at level 5)
  - protection from unrest and (later) events, as now
  - specialist unlocks in the province, as now
  - the small gold bonus, as now
- **Rules:** all numbers go in `packages/content`. Defense stacks with terrain and forts by multiplying.
- You may tune the defense step between 4% and 8% in the sim, and the costs, if the sim says culture is still never worth buying. Report what you chose and why.
- **On screen:**
  - **Culture pips** (small laurels) on the troop pill at Mid and Near.
  - The territory card explains it in one line per effect: "Culture 2: defends +10%, shrugs off 30% of unrest, unlocks Siege in Pinemark."
  - The Culture button's draft shows what the next level adds.
  - "0 of 5" becomes "No culture yet: raising it costs 4 gold".
- **Captain** invests in culture where it pays: capitals, choke points and frontier land it means to hold. Keep it simple.
- **Tests:** the defense math, the preview matches the engine, and a captured territory keeps its culture.

## Part E: map clarity (map maker and renderer)
1. **No more hairline borders.**
   - Measured by the orchestrator: Embervale has 8 land borders under a quarter of the usual length (the shortest is 4.4 map units against a typical 88). Greatmarch has 13 (the shortest is 0.6).
   - Give the map maker a **minimum shared border length**. Below it, either widen the contact by moving cells, or the two territories are simply not neighbours. Your choice; explain it.
   - Add a `checkMap` check for it.
2. **Passes wide enough to see.** Today passes are 9–31 map units wide.
   - Give them a minimum width that reads at Mid zoom, with a visible road and a small gate or cairn sprite (drawn in code until session 11's art arrives).
   - Add a `checkMap` check for it.
3. **Rebuild Embervale and Greatmarch** and bump `MAPGEN_VERSION`.
   - Keep the same sizes and character; re-run the map checks.
   - Update `docs/maps/*.png`, `docs/map-data.md` and the rules (§12).
4. **Show connections when you select a territory.**
   - Every neighbour gets a small link mark across the shared border: a gilded chevron, or the sea lane lit up.
   - Neighbours you can attack, and the kind of border (river, pass, sea lane), are marked.
   - Not cluttered: only for the selected territory.
5. **Clearer territory edges at every zoom:** a crisp ink line with a light halo, including inside one House's land and between neutral lands.
6. **Provinces you can see:**
   - Province borders get their own style (a gilded double line, distinct from territory edges and House bands).
   - Each province gets a **plaque**: name, bonus, and how much of it you hold, for example "Pinemark +3 · you hold 3 of 5" (just "+3" if you hold none).
   - The plaque shows at Mid and Far; at Near it shrinks or fades.
   - Province names must never cover army pills.
7. **Check Tactical view really is flat** House colours with every detail. The saved `embervale-tactical.png` looks like the painted map. Fix it if needed and retake the screenshot.

## Part F: buildings that stand on the map
- **Size:** draw building sprites about **twice today's size** (today `BUILDING_SIZE = 26`), on a soft ground shadow like the capital's, at the territory's site, never hidden under the pill.
- **Under construction:**
  - The ghost look goes: no 45% opacity.
  - Show the building with a code-drawn scaffold and a slightly desaturated tint, plus a small hourglass on the pill icon ("ready next turn").
  - Nate will make proper construction art in session 11.
- **On the troop pill:** the building icon is solid.
- **Remembered (fogged):** buildings stay greyed, as now.
- Check all four buildings on every ground type at Far, Mid and Near.

## Part G: wording, then the sim
- **Panel and card wording:**
  - plain words and icons instead of dense grey lines; for example, "Pinemark (+3 if you hold it all) · plains, defense ×1, +2 gold" becomes icon rows
  - Keep the phone sheet readable at 384 px wide.
- **Simulator**, after Parts A, C and D: 1,000 games at 2, 4, 6 and 10 players (Captain), plus the mixed tables, compared with session 8 (`docs/sim-results-m3-bots.md`). Report:
  - game length and the share inside 15–25 turns
  - seat fairness
  - runaways
  - how often culture is bought, and where
  - recruits by site type (capital, barracks, province)
- Write it up as `docs/sim-results-m3-fixes.md`.
- **Don't change rules beyond what's above.** If something goes badly off target, describe it and give Nate options.

## Out of scope
- **Session 10:** the map lab, bigger maps (60–120 territories) and new land shapes (`docs/07-map-tooling.md`, "Session 10 scope").
- **Session 11:** the big visual upgrade and Nate's new art batch: pines, textures, mountain ranges, construction sprites, plaques (`docs/08-visual-upgrade-plan.md`).
- **Session 12:** generals, captured generals, the Fallen, and Captains ganging up on a runaway leader.
- **Later:** card decks, diplomacy, spies, culture unlocks, the balance pass.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`.
- **Screenshots** in `docs/art/screens/`, desktop and phone where it matters:
  - a selected territory with its neighbour links (one with a pass and one with a sea lane)
  - province borders and plaques at Mid and Far
  - all four buildings, finished and under construction, at Mid and Near
  - the recruit chips with recruit sites glowing
  - the culture card
  - a turn report with a plain-words "called off" line
  - Tactical view
  - the rebuilt map previews
- `docs/sim-results-m3-fixes.md` is written, and the tap count is reported.
- `pnpm deploy:preview` passes its lock check.
- Then ask Nate to:
  1. tap **Update now**
  2. play a game against Captains
  3. check that he can see what's connected and where provinces are
  4. recruit in a province he holds fully, choosing the amount
  5. build a fort and see it stand on the map
  6. read the culture card
  7. use "Save this game" once

  Record what he says.
- `PROGRESS.md`, `docs/decisions.md` and `docs/rules-reference.md` are updated in simple language, with "Claude Code sessions completed" bumped to 9.

## End the session with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the combat fix in one sentence, and how often lopsided attacks failed before and after
- the culture numbers you chose, and how often bots buy it now
- the sim table (before and after this session) and the tap count
- the hairline-border and pass-width numbers before and after the rebuild
- the screenshot paths
- what Nate said after playing
