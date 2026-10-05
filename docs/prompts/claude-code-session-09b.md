# Claude Code: Session 9b (finish culture, bots gang up on the leader, the sim write-up, deploy)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his browser and a deploy.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**Session 9 stopped at Nate's usage limit.** Parts A–C of `docs/prompts/claude-code-session-09.md` are done, and Part D (culture) is half done; everything is committed on `main`.

The rest is split into two shorter sessions so neither runs out:
- **9b (this one):** finish culture, make bots gang up on a runaway leader, run the sim, write it up, and deploy so Nate can play the fixes.
- **9c (next):** map clarity and buildings (Parts E and F).

Keep this session tight: no work from Parts E or F.

## Read first
1. `CLAUDE.md`
2. `docs/prompts/claude-code-session-09.md`, Parts D and G (the full brief; this prompt narrows it)
3. `git log --oneline -6`, to see what session 9 committed
4. The last three entries of `PROGRESS.md`, and the newest lines of `docs/decisions.md`

## Step 0: sync
Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.

## What the orchestrator measured (400 Captain games per step, seed m2)
| 4 players | Avg turns | One player on half the map by turn 10 |
|---|---|---|
| Session 8 (`4dd3ba2`) | 23.9 | 54% |
| + combat fix (`16bcb84`) | 20.2 | 80% |
| + province recruiting (`acca11d`) | 18.6 | 85% |
| + culture (`afc0296`) | 19.3 | 80% |

6 players moved the same way: 48% → 64% → 73% → 66%.

**In short:** most of the runaway jump comes from the combat fix. Attacks now work as they should, so games are faster and more decisive (70% of 4-player games land inside 15–25 turns, up from 59%). The fix stays.

**Nate's view (Oct 5):** runaways are a **bot strategy** problem, not an engine or chaining problem. The bots should account for a player who is pulling ahead, as people do. So the counterweight goes in the bots now (Part 2). No rule brakes; those stay on file for the balance pass.

**Game length, in real time (Nate, Oct 5):** his game against Recruit bots took about 30 minutes, which is too short. His targets are **single player 45–90 minutes** and **a live online game (5-minute timer) 2 hours or more**. Don't change rules for this now: cards, generals, diplomacy, bigger maps (session 10) and smarter opponents will all lengthen games. But from now on the sim write-up should also give a rough real-time estimate (turns × a typical single-player turn of about 1.5 minutes, plus the replay), so we can track it.

## Part 1: finish culture ("loyal land")
1. **Tune it.** Captains that buy culture win only 37.7% against Captains that don't (50% is fair).
   - Use the flags you added to try a defense step of 4–8% per level, and cheaper costs (for example 3, 4, 6, 8, 10).
   - Also check whether the Captain's choice of *where* to buy is the problem: only capitals and choke points, and only when it's not short of troops at the front.
   - Pick the setting where culture-buying Captains do at least as well as non-buyers, without making culture a must-buy (keep it under about 55%).
   - If nothing in that range works, stop and report options for Nate rather than going outside it.
2. **Show it:**
   - culture pips (small laurels) on the troop pill at Mid and Near
   - the territory card's line per effect ("Culture 2: defends +10%, shrugs off 30% of unrest, unlocks Siege in Pinemark")
   - "No culture yet: raising it costs 4 gold"
   - the Culture button's draft showing what the next level adds
3. Update `docs/rules-reference.md` §7 and §9.

## Part 2: Captains gang up on a runaway leader (Nate's call, moved up from session 12)
- When one rival is clearly running away with the map, Captains treat that rival as the main target, as people do.
  - "Clearly running away" means it looks to hold around 40% of the land, or far more than anyone else.
  - Priority on their fronts with that rival.
  - No attacks on weak neighbours that only help the leader.
  - Garrisons on the shared front kept honest.
- **Fog-fair:** a Captain judges this only from its own view and "last seen" memory. The players panel shows no territory counts, so it estimates. It never reads the real state.
- **Nobody gangs up on the player because they're human.** It's the same rule for every seat.
- **Defend against a fast attacker too.** When a rival has been taking several territories a turn (chaining) along a Captain's border, the Captain reinforces that front and its choke points, instead of carrying on with its own expansion elsewhere.
- Keep it simple and explainable, and add a scenario test for each behaviour.
- Generals (session 12) will reuse the same logic.

## Part 3: the sim and the write-up (Part G of session 9)
- **Standard set:** 1,000 games at 2, 4, 6 and 10 players (Captain), plus the mixed tables, against session 8's numbers in `docs/sim-results-m3-bots.md`.
- **Add two clearer runaway measures** next to the turn-10 one, since games are shorter now:
  - how often the player leading at the **halfway point** of the game goes on to win
  - how often the eventual winner was **not** the leader at turn 10 (comebacks)
- **Report:**
  - game length and the share inside 15–25 turns
  - seat fairness
  - all three runaway measures, before and after the gang-up
  - culture purchases and where they go
  - recruits by site type (capital, barracks, full province)
  - lopsided attacks that failed (should stay 0)
- Write it up as `docs/sim-results-m3-fixes.md`, including the orchestrator's table above.
- **No other rule changes.** If something is badly off target, describe it and give Nate options.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`.
- **Screenshots** in `docs/art/screens/`:
  - the recruit panel with glowing sites
  - the culture card and culture pips
  - a turn report with a plain-words "called off" line
- **Docs, in simple language:**
  - `docs/rules-reference.md` (§4 recruiting, §7 culture, §9 combat), `docs/decisions.md`
  - a `PROGRESS.md` entry covering session 9 so far (Parts A–D and the gang-up). Leave "Claude Code sessions completed" at 8 until 9c is done.
- `pnpm deploy:preview` passes its lock check.
- Then ask Nate to:
  1. tap **Update now**
  2. play a game against Captains
  3. recruit in a province he holds completely, choosing the amount
  4. try an overwhelming attack
  5. read the culture card
  6. use "Save this game" once

  Record what he says.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the culture numbers you chose, and the buyer-vs-non-buyer win rate
- the sim table (session 8 → now)
- the three runaway measures with and without the gang-up
- the screenshot paths
- what Nate said
