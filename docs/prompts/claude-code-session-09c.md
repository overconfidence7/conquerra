# Claude Code: Session 9c (map clarity and buildings)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his art, his browser and a deploy.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

This is the last part of session 9: **Parts E and F** of `docs/prompts/claude-code-session-09.md`, plus the panel wording from Part G.
- **Already done:** sessions 9 and 9b did the combat fix, plain-words reports, "Save this game", recruiting, culture, and the bots ganging up on a runaway leader.
- **Keep to this scope:** no rule or bot changes.

## Read first
1. `CLAUDE.md`
2. `docs/prompts/claude-code-session-09.md`, **Parts E, F and G** (the full brief, including the orchestrator's measurements)
3. `docs/08-visual-upgrade-plan.md` ("What the orchestrator found" and "Session 9: clarity fixes")
4. The last three entries of `PROGRESS.md` (including what Nate said after session 9b), and the newest lines of `docs/decisions.md`
5. `docs/06-art-direction.md` (border and readability rules) and `docs/map-data.md`

## Step 0: sync
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. If `art/incoming/` has new files, run `pnpm art:import` and commit the result.
3. If Nate reported anything after 9b that is a quick fix in this scope, do it first. Anything else goes in your summary.

## The work
Do these as written in session 9's prompt.

**Part E: map clarity**
1. **No hairline borders:** a minimum shared border length in the map maker, plus a `checkMap` check.
2. **Passes wide enough to see**, with a road and a code-drawn gate, plus a `checkMap` check.
3. **Rebuild Embervale and Greatmarch** with `MAPGEN_VERSION` 2:
   - same sizes and character
   - updated `docs/maps/*.png`, `docs/map-data.md` and the rules (§12)
   - re-run a quick sim (400 games at 4 and 10 players) to confirm the new maps play about the same
4. **Neighbour link marks** when a territory is selected, showing the border type.
5. **Clearer territory edges** at every zoom.
6. **Province borders and plaques:** "Pinemark +3 · you hold 3 of 5"; names never cover army pills.
7. **Tactical view** really flat (retake its screenshot).

**Part F: buildings that stand on the map**
- About twice the size, on a ground shadow.
- A code-drawn scaffold while under construction (no transparency), with an hourglass on the pill icon.
- A solid pill icon once built.
- Check all four buildings on every ground at Far, Mid and Near.

**Part G: panel wording**
- The army panel and territory card use plain words and icon rows instead of dense grey text.
- Readable on a 384 px-wide phone.

Report the hairline-border and pass-width numbers before and after the rebuild. The orchestrator measured:
- **Embervale:** 8 land borders under a quarter of the usual length (the shortest is 4.4 map units against a typical 88), and passes 12–23 units wide.
- **Greatmarch:** 13 short borders (the shortest is 0.6), and passes 9–31 units wide.

## Out of scope
- **Session 10:** the map lab, bigger maps and new land shapes.
- **Session 11:** the big visual upgrade and new art (pines, textures, mountain ranges, construction sprites, plaque art).

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`.
- **Screenshots** in `docs/art/screens/`, desktop and phone where it matters:
  - neighbour links (one with a pass, one with a sea lane)
  - province borders and plaques at Mid and Far
  - all four buildings, finished and under construction, at Mid and Near
  - the reworded army panel and territory card
  - Tactical view
  - the rebuilt map previews
- `pnpm deploy:preview` passes its lock check.
- Then ask Nate to:
  1. tap **Update now**
  2. play a game
  3. say whether he can now see what's connected, where provinces are and what they're worth, and whether buildings look like they're really there

  Record what he says.
- `PROGRESS.md` (with "Claude Code sessions completed" bumped to **9**), `docs/decisions.md` and `docs/rules-reference.md` §12 are updated in simple language.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the border and pass numbers before and after the rebuild
- the quick sim on the rebuilt maps
- the screenshot paths
- what Nate said
