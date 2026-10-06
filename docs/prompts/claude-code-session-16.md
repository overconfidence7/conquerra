# Claude Code: Session 16 (M3: Nate's play-test fixes)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It needs his art originals, his browser and a deploy.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session is Nate's play test of sessions 11–15** (recorded in `PROGRESS.md`): the controls, a sharp map at every zoom, provinces on demand, orders along a path, culture wiped on capture, the Spoils rework, a Chronicle so nothing is missed, and the end-of-game power graph. The bigger changes he asked for come next: the Marshal and bot personalities (17), leaders you delegate to (18), bigger maps and the balance pass (19), and the polish pass (20).

**Commit and push after each part.** Nate's plan has usage limits. If you can tell you're getting close:
1. stop at the end of a part
2. commit and push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

The parts are in priority order. **Part 5 ends with the deploy, so the session is complete there.** Part 6 is extra: do it only if there's room for it and a second deploy; otherwise it moves to session 20.

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: **"Nate's play test of sessions 11–15"** (his 16 notes, in his words), then the entries before it
3. `docs/04-design-additions.md` **§12 (controls and map clarity: the decisions for this session)**, §5 (culture wiped on capture), §6 (the Spoils rework), and §0 (simple to play, deep to master)
4. `docs/decisions.md`, newest lines at the bottom
5. `docs/rules-reference.md` (§6 armies, §7 culture, §14 generals, §18 Spoils, §19 Fate, §16 the Fallen)
6. The renderer: `apps/web/src/render/pixi/world.ts` (the Far image and the baked tiles), `PixiMapRenderer.ts`, `info.ts`, `labels.ts`, and `apps/web/src/map/camera.ts`
7. The art registry: `packages/art/src/registry.ts` (the stored size of each piece)

## Step 0: sync
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **Don't import art batch 4 in this session,** even if it's in `art/incoming/`: session 20 does it with the polish pass. (Part 2 re-imports today's art at a bigger size; that's different.)

## Guardrails (all parts)
- **The hard rules in `CLAUDE.md`:**
  - the engine stays pure and deterministic (seeded randomness only)
  - every engine change has tests, and the determinism test passes
  - balance values live in `packages/content`
  - clients only get `viewFor`
- **Saves:** if the game's shape changes, bump the version with a migration; the session 13 and 14 fixtures keep loading.
- **Simple to play:** a basic turn is still about 6 taps on a 384 px phone (run `tap-count.mjs`). Report the taps for a path order too.
- **Fog:** the Chronicle and the province highlight show only what you were allowed to see.
- **Phones:** Nate plays on an Android phone. Check every visual change at 384 px, and watch memory and frame rate in Part 2.

## Part 1: controls and rules
- **The Leader goes with the attack (Nate #1):**
  - When you draft an attack or move from the Leader's territory, the Leader goes with the army **by default**, with one tap to leave it home (not hidden under More).
  - **It stays with the army through a chain:** a chained attack carries the Leader on to each next step, as long as it's with the troops that move on.
  - Report and replay lines follow the Leader correctly.
- **"Initiative" and "Wait" (Nate #2):** replace the oddly shaped bubbles with two plain buttons that say **Initiative** and **Wait**, in the same style as the other buttons. The full explanation shows on hover (desktop) and long-press (phone).
- **Room at the map's edges (Nate #3):** fully zoomed out, the whole map must be visible clear of the menus on desktop (right column, bottom panels) and on a phone (top bar, action bar). Give the camera a margin for the panels, so you can pan any part of the map into clear view at every zoom.
- **Colours (Nate #5):** player 1 (you) is **red** (Gules) by default, and the lobby lets you pick your House colour; the bots take the rest. Keep it in saves. (Online games, where each player picks, come in M4.)
- **Culture is lost when land changes hands (Nate #14):** a captured territory's culture drops to 0; its buildings stay (a fort keeps standing for the new owner, as today). Update the odds preview, the bots' valuation of culture, the card's text, the rules reference and the tests. Run a quick sim (4 and 6 players, 300 games) and report what it does to length.
- **Spy upkeep only while away (Nate, Oct 6):** a spy costs nothing a turn in your own land (at home or guarding a province), and 1 gold a turn while it's travelling or inside land you don't hold. Numbers in `packages/content`. Update the Hire line, the rules reference and the tests.
- **Commit and push.**

## Part 2: sharp at every zoom, and provinces on demand
- **The blurry zoom (Nate #6):** "we have high-resolution pictures that are shrunk down, so they should still look good, but everything is blurry when zooming in." The orchestrator found two causes:
  1. **The map is painted once at a fixed detail level:** `PixiMapRenderer.ts` sets the tiles to `sqrt(budget / map area)` pixels per map unit (about 1.75 on desktop and 1.3 on a phone for Wyrmland, with a 14M / 8M pixel budget). At full zoom the screen needs about 4–6 device pixels per unit, so the painting is stretched about three times.
  2. **The art is stored small:** the registry keeps trees at 192 px, mountains and buildings at 256, castles at 384 and ground textures at 512, though Nate's originals are 2048 px.
- **The fix:**
  - **Paint sharper tiles where you're looking:** keep today's Far image and Mid tiles, and add a **Near level** painted on demand at about 2.5–3× the Mid detail (matched to the screen, capped by `devicePixelRatio`), only for the tiles on screen, kept in a small least-recently-used cache with a memory cap (tighter on phones). It paints a few tiles a frame, nearest the centre first, with the Mid tile showing until it's ready, as today. Pick the numbers by measuring.
  - **Store the art bigger:** raise the registry sizes (about 2×: trees 384, mountains and buildings 512, castles 768, figures 512, ground textures 1024) and re-run `pnpm art:import` from Nate's originals. Make sure mipmaps are on for sprites and textures, so they stay smooth zoomed out.
  - **Load time:** the art download will grow. Keep it as WebP, report the before/after total, and load the bigger versions after the game is on screen if the first paint slows down.
  - **Measure:** paint time, texture memory and replay frame rate on desktop and a 384 px phone profile (the existing perf scripts), before and after. Keep the phone at 50+ fps.
  - **Before/after pictures** at Near zoom (a capital, a forest edge, a mountain range, a coastline), desktop and phone, in `docs/art/screens/compare/`.
- **Provinces on demand (Nate #4):** "countries are still hard to see and the names clutter the map."
  - Province names no longer sit on the map at Mid and Near. At Far, the plaques stay as today.
  - **Tapping any territory** (yours or not, including fogged land) **lights up the border of its whole province** with a clear, bright band (readable over every House colour, in the info layer) and shows the province's name and bonus on a plaque there, until you tap elsewhere.
  - The territory card's province chip says the same ("The Oak Downs +3: you hold 2 of 5").
- **Commit and push.**

## Part 3: orders along a path (Nate #8)
- Select the territory you're coming from, then pick a destination further away (a long-press, or a "Path" button in the attack panel: your choice, explain it). The game offers:
  - **Shortest way:** the fewest steps to the destination.
  - **Full sweep:** a path that snakes back and forth to take every territory between the start and the destination that the army can reach (a sensible region: the territories closer to the line between them than a set distance, in an order that never doubles back further than it must).
- A box says what it will add ("7 orders: take 6 territories, end at Old March") and shows the path on the map. **Confirm** adds them as one chain to your queue; each step can still be edited or deleted.
- The chain uses the existing chain rules: amounts as shares ("Follow through"), the Leader going along, right of passage, and binding pacts (a path never crosses one). Your own and partners' land is walked through, not attacked.
- Tests for both path kinds (on small made-up maps and a real map), and the tap count.
- **Commit and push.**

## Part 4: the Spoils rework, the Chronicle, and why nobody ganged up
- **The Spoils rework (Nate #10)** (`04-design-additions.md` §6; numbers in `rules.spoils`):

| Set | Windfall |
|---|---|
| Three Swords | 8 troops, spread over your most threatened territories, and 4 gold |
| Three Towers | a finished fort on land you choose, 2 troops there, and 4 gold |
| Three Laurels | +1 culture on 3 territories in a province you choose, and 4 gold |
| **One of each (the best)** | 6 troops spread over your front, a finished building of your choice (fort, market, barracks or watchtower) on land you choose, and 10 gold |

  - **Explain it on screen:** the card stack says "Collect three: three alike, or one of each (best)". The Spoils sheet always shows the table above, with the set you can make lit. The report says what a set gave.
  - The bots' choices follow (one of each when they can). Quick sim (300 games, 4 and 6 players) for length.
- **The Chronicle (Nate #13):** a log of every turn you can open at any time (a button in the top bar or the left rail; a tab on the phone): battles you saw, Fate events (yours, those on your land, those you saw, and "something stirs" ones), the Fallen's events, deals made and broken, spies' reports, your leaders' work. Each line can be tapped to show the place on the map. It reads from what you were allowed to see.
- **Louder Fate and Fallen moments now** (the full effects come in session 20): an event on your land gets a clear banner in the replay with the camera on it and a line at the top of the report; the Fallen aiming at you says so ("The Fallen have turned on you: a plague in Old March").
- **Why nobody ganged up on Nate (#13):** he ran away with a Wyrmland game against 5 Captains, and he saw no joint wars against him and no Fallen events aimed at him.
  - Check whether the Captains' runaway rule and the Fallen's targeting see a person the same way as a bot, and whether under fog they could tell he was leading.
  - A sim with one "fast expander" seat (the Captain with its caution turned down, or the best stand-in for a person you can make) against 5 Captains on Wyrmland: how often do joint wars against that seat form, and when? How often do the Fallen target it?
  - Fix it if it's a bug. If it's a judgement problem, write down what you found for session 17 (the Marshal), and don't redesign the Captain here.
  - If Nate saved that game to a file, use it.
- **Commit and push.**

## Part 5: write-up, screenshots, deploy, play test
- **Rules reference:** update everything this session changed, and "Not in yet".
- **Screenshots** (desktop and a 384 px phone), in `docs/art/screens/s16-*.png`:
  - an attack with the Leader going along, and the Initiative/Wait buttons
  - fully zoomed out with the whole map clear of the menus
  - a province lit up after tapping a territory
  - Near zoom before and after (from Part 2)
  - a path order's confirm box (both kinds)
  - the Spoils sheet with its table
  - the Chronicle open
  - the lobby's colour choice
- `pnpm deploy:preview` passes its lock check.
- **Commit and push.**

## Part 6 (only if there's room): the end of the game (Nate #11)
- The game-over screen gets a **line graph of each House's power by turn** (land held, as a share of the map, is a good measure; make it readable for up to 10 Houses: House colours with their patterns, the winner's line strongest), recorded each turn in the game (and in saves).
- **Awards,** worked out from the game: Best Military (most battles won), Best Culture (most culture raised), Master Builder (most buildings finished), Spymaster (most infiltrations), Diplomat (most deals kept), Survivor (held out longest against the winner), and a few more if they're fun. Show the winner of each with their portrait.
- Fog: at the end of the game everything is revealed, so the graph shows everyone.
- Tests, then `pnpm deploy:preview` again. **Commit and push.**
- If there isn't room, say so: it moves to session 20.

## Out of scope
- **Session 17:** the Marshal, a new hard bot level with personalities (`04-design-additions.md` §11).
- **Session 18:** leaders you delegate to: your named Leader and a Steward, budgets and purses, the big command list (§4).
- **Session 19:** bigger maps (about 160 and 200 territories) and the balance pass.
- **Session 20:** the polish pass (`docs/09-polish-and-effects-plan.md`) and art batch 4's import.
- **M4:** online with friends, colours chosen by each player, deals between people.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`. **Run the full `pnpm test` before your last push.** Ask Nate to check the repo's Actions page for your last commit (`gh` isn't installed on his computer).
- Screenshots and before/after pictures as listed, and `pnpm deploy:preview` with its lock check.
- **Then ask Nate to play on the preview:**
  1. **Laptop, 6 players on Wyrmland, Captain bots, you in red:**
     - zoom all the way in: is it sharp now? Zoom all the way out: can you see everything?
     - tap a few territories you don't own: do the provinces read clearly?
     - make a path order both ways
     - attack with your Leader and chain on
     - turn in one of each in Spoils
     - open the Chronicle after a few turns: did anything happen to you that you'd have missed?
  2. **Phone:** the same zoom checks, and how smooth it feels.
  3. How many turns did the game take?

  Record what he says.
- `PROGRESS.md` (with "Claude Code sessions completed" bumped to **16**), `docs/decisions.md`, `docs/rules-reference.md` and `docs/04-design-additions.md` (if anything changed) are updated in simple language.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- each of Nate's notes handled this session, one line each, and any you couldn't do
- the zoom fix: detail levels, memory and frame rate on a phone, the art download size, before and after
- why nobody ganged up on Nate: what you found and what you fixed
- the sims for culture wiped on capture and the Spoils rework (length)
- tap counts (basic turn, path order) and the start-up bundle, before and after
- whether Part 6 was built
- the screenshot paths
- what Nate said after playing
