# Claude Code: Session 21 (M3: the polish pass — art batch 4, effects, a cinematic replay, a living map, menus with weight)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`). It imports art from `art/incoming/` (which exists only there), needs his browser (screenshots, a GIF, the frame rate) and deploys. **Don't run the Gemini art chat alongside this session** (it reads and writes `art/incoming/`).

**You run every command yourself, including the art import (`pnpm art:import`, in Part 1); Nate doesn't need to run anything.** The import comes right after the importer learns the black-background effects art (Part 1, item 1), so the smoke, flame and dust pieces come out with soft edges instead of black boxes.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer. Explain choices in plain language and keep setup steps copy-paste simple.

**This session is the polish pass.** Nate (Oct 6): "I want this game to look like a large development team with a good budget made it, so visuals are important. Special effects would be a fun add too for the playback portion of the game." The plan is `docs/09-polish-and-effects-plan.md`; this prompt turns it into parts. Art batch 4 (42 pieces: all the effects, the key art, the specialists and spies, the redo pieces) has been waiting in `art/incoming/` since Oct 7.

**Commit and push after each part.** Nate's plan has usage limits, and this is a long session with many parts. If you can tell you're getting close:
1. stop at the end of a part
2. commit, run the deploy (Part 2 onward), push
3. note exactly where you stopped in `PROGRESS.md`
4. write the summary

**The parts are in priority order (most visible first), and each from Part 2 on ends with a deploy, so the session is complete at any part boundary.** Whatever isn't reached becomes session 21b; say what's left. **Nate plays his 20d test list in parallel on the preview**, so every deploy must be a working build (the full test suite runs inside `pnpm deploy:preview`).

## Read first, in this order
1. `CLAUDE.md`
2. `PROGRESS.md`: "The orchestrator's own checks of the test list" (Oct 9: the service worker, the three nits), session 20d and its review (the Spoils card overlap)
3. **`docs/09-polish-and-effects-plan.md`** (the whole plan: the rules every effect follows, the sections, "How it's built")
4. `docs/06-art-direction.md`, `docs/08-visual-upgrade-plan.md` (how the map is drawn today: Far / Mid / Near, the info layer, the scenery rules)
5. `docs/art/batch-4-report.md` (what was made, the compromises: 1024 px pieces, `fx-crack` runs diagonally, `fx-dust-2` is a vortex) and `docs/art/asset-list-and-prompts.md` ("Working in Gemini", Tier 3 → "Batch 4", and **the note about the art-list test**)
6. `docs/decisions.md`, the Oct 9–10 lines at the bottom (Nate's walls look, "make the buildings more 3D so they pop like the wall")
7. `docs/rules-reference.md` §10 (the replay), §24 (walls)
8. The code: `packages/art/src/import.ts` and `registry.ts`, `apps/web/src/replay/`, `apps/web/src/render/` (the map layers, the walls drawn in code from session 20b), `apps/web/src/ui/UpdatePrompt.tsx`, `apps/web/vite.config.ts` (the PWA block), `apps/web/scripts/s19-perf.mjs` (the phone frame-rate check), `s20d-shots.mjs` (the screenshot pattern)

## Step 0: sync and the small fixes from the review
1. Run `git --no-optional-locks status`, then `git pull` and `pnpm install`. Work on `main` and push to `main`.
2. **The preview served a stale build.** On Oct 9 the orchestrator's browser pane opened the preview on a build from before session 15, and a plain reload didn't update it; only unregistering the service worker and clearing its cache brought up the current build. Anyone who visited before (a phone especially) may be stuck. Find out why the update path fails behind Cloudflare Access: the likely cause is the service worker's update fetch (`reg.update()` in `UpdatePrompt.tsx`) getting Access's sign-in redirect instead of `sw.js` once the login cookie has expired, and failing silently. Then:
   - when the update check is redirected or fails, show a slim notice: "Sign in again to get the latest version" (a link to the preview's root), instead of nothing;
   - on every load, also compare the running build (`__BUILD__`) with a small `version.json` fetched with `cache: "no-store"` and credentials; if it differs and no update is waiting after a few seconds, show "A new version is ready: reload";
   - make sure the version is visible on the lobby's first screen (it's in Settings and, per `build.d.ts`, the lobby: check it is where a player sees it without opening anything).
   - Test it: deploy, open the preview in a browser that has an old service worker (the orchestrator will check from the browser pane), and say in the summary what you saw.
3. **Check that art batch 4 is there** before changing any code: compare `art/incoming/` with the file names in `docs/art/batch-4-report.md` (42 pieces) and say in one line what's present and anything missing. Don't import yet (Part 1 does it once the importer handles the black-background pieces).
4. **Three nits** from the orchestrator's checks: the exact-amount budget box keeps showing the typed number (99) after it's capped (show the capped value); the lobby's Autosave says "Nothing yet" right after a finished game (say "Last game finished", or keep the last autosave until a new game starts); the path box's "Shortest way / Full sweep" buttons have no accessible names (give them names).
5. **The Spoils card's text overlaps its "1 mission" line** in the Leaders panel (`docs/art/screens/s20d-leaders.png`): fix the layout at both widths.
6. **Commit and push.** (Run the full `pnpm test` before this and every push: session 20d pushed two red commits because a pinned test was only re-pinned later.)

## Guardrails (all parts)
- **The hard rules in `CLAUDE.md`.** Effects live in the web app only; the engine doesn't change.
- **Effects never carry game state** (`09` §"The rules every effect follows"): the info layer (pills, borders, the report, the Chronicle) still tells the whole truth; a player on "Effects: Off" loses nothing but the show.
- **Fog respected:** a fogged event is the same soft "something stirs" pulse whatever it was; no colour, shape or sound hints at it. Keep the fogged-replay tests passing and add one for effects.
- **Deterministic:** every effect is seeded from the game's seed, the turn and the event, and driven by the replay's clock, so "Watch again" looks the same, and pause, scrub and Skip work. **No `Math.random()` in effects; no frame-by-frame simulation that can't be rewound.** Build the particles in-house on PixiJS's `ParticleContainer` (decided Oct 6); **no off-the-shelf emitter, no tweening library**; pixi-filters v6 (MIT) is allowed for the few filters named in the plan.
- **The replay's length doesn't change** (its cap and median stay); effects play inside each beat.
- **Frame rate:** at least **50 fps on Full** in the replay on the 384 px phone profile (`s19-perf.mjs`; today 39–43 fps, so the replay must get faster, not only prettier); **Light** halves the particles and drops shake and flashes; a phone that drops under about 50 fps moves to Light by itself and says so once; "Reduce motion" starts on Light. Measure after every part and report before → after.
- **Start-up bundle unchanged** (about 486 KB, gzip 149): the effects, their recipes and the fx art load with the game screen, not the lobby. The key art for the title screen is the exception (it is the lobby); keep it small (webp, one size for phones).
- **Art is imported, never hand-edited:** `pnpm art:import` from `art/incoming/`; the importer's rules are code with tests (`pnpm vitest run packages/art`).
- **Keep the tap counts** (a basic turn 6 taps); no new controls in this session.
- **Screenshots after every part** (desktop and 384 px phone), `docs/art/screens/s21-*.png`, from real saves (the 20d saves are fine) — and a short GIF of one turn's replay at the end.

## Part 1: art batch 4 in (the importer learns `fx-` art; key art; specialists and spies; the redo pieces)
1. **The importer learns black-background art** (`09` §"How it's built"): `fx-` pieces painted on pure black (`fx-smoke-*`, `fx-dust-*`, `fx-flame-*`, `fx-impact`, `fx-splash`, `fx-wisp-*`, `fx-lightning-*`, `fx-crack`) become sprites whose **brightness is transparency** with the colour kept (so smoke and flame have soft edges with no fringe), and they're flagged for additive or screen blending in the registry. Magenta-background `fx-` pieces (`fx-coin`, `fx-arrow`, `fx-stone`, `fx-rock-*`, `fx-leaf`, `fx-wheat`, `fx-scroll`, `fx-storm-cloud`, `fx-birds`, the windmill body and sails) are cut out as usual. Tests for both rules on small synthetic images.
2. **Register every batch-4 name** (`docs/art/batch-4-report.md` lists them by file name) and **import**. Check the contact sheets the importer writes; note anything that came out wrong (the report's compromises: `fx-crack` diagonal, rotate in code; `fx-dust-2` a vortex; the 1024 px pieces).
3. **The art list:** move the "Batch 4" block out of "Tier 3: later" into its own section **after** the "## Batch 3" section, so the art-list test counts it (read the test's note in the list first: **never write the literal heading text "## Batch 3" anywhere else in the file**, and the names it can't find must stay under Tier 3). Run `pnpm vitest run packages/art`.
4. **Put the drop-in pieces in the game:** the redone `terrain-hills`, `tree-conifer-1/-2` (compare with the old blue ones on the bench, `?lab=bench`; keep whichever reads better at game size and say which), `scaffold`, `bridge-wood`; the specialists' icons and figures (`icon-rangers`, `icon-standard-bearer`, `icon-spy`; `figure-rangers`, `figure-standard-bearer`, `figure-spy`) where the game draws specialists and spies today; the windmill (body and sails) as a landmark; `art-title` behind the lobby and `art-victory` / `art-defeat` on the game-over screen, static for now (Part 6 animates them).
5. Screenshots: the bench with the new pieces, the lobby with the key art, game over (victory and defeat), a map at Mid with the new hills and conifers.
- **Commit and push.**

## Part 2: the effects layer, armies on the move, battles, a capital falling, a knock-out (and the first deploy)
1. **The effects layer** (`09` §"How it's built"): a pooled particle system on `ParticleContainer` (normal, additive and screen blending), **recipes as data** (`packages/content` is for balance; put the recipes in `apps/web/src/replay/fx/recipes.ts` or JSON next to it with a Zod schema: which textures, how many, how they move and fade, how they scale with troop counts), driven by the replay timeline's progress. **The setting "Effects: Full / Light / Off"** in Settings (remembered on the device), the auto-Light rule and "Reduce motion".
2. **Armies on the move** (`09` §2): the House-tinted `figure-army` with its banner, bobbing as it walks, the troop pill beside it; cavalry faster with more dust; ships (`ship`) on sea lanes with a wake; the order arrow unrolling ahead like an inked campaign line and fading behind; dust (`fx-dust`) with terrain flavour (snow powder, mud flecks, a splash at a ford); right of passage in white stitches.
3. **Battles** (`09` §3): the clash at the border where the armies meet; dust and smoke, steel glints and sparks (code), arrow volleys from the defender (`fx-arrow`; from the walls behind a fort or a wall); a Siege stone (`fx-stone`, `fx-impact`); the size of the fight shows; a light shake on big battles (not on Light). **Results:** captured (the old banner topples, the new is raised, the colour ripples along the border band, a gold shimmer), held (the shield flashes, the attackers fall back in smoke), losses float up as two small ink-and-gold numbers; **a capital falls** (push-in, smoke columns and embers, the banner change, a title card, pull-out); **a House knocked out** (its banner burns away, its land washes to the conqueror's colour, "House Vert is no more").
4. **Tests:** the recipe schema; determinism (the same seed and event give the same particle positions at the same replay time); fogged events get the generic pulse; "Effects: Off" leaves the info layer identical (a pixel-free test on the scene graph is enough).
5. **Frame rate** before and after on the phone profile; the replay's median length; the start-up bundle.
6. Screenshots: an army marching, a battle mid-clash, a capture, a capital falling, a knock-out (desktop and phone).
- **Commit, `pnpm deploy:preview`, push.**

## Part 3: buildings that pop (Nate's 3D buildings) and walls that match
Nate (Oct 9, on seeing the walls): **"make the buildings more 3D so they pop like the wall."** The walls from session 20b stand off the land (shadow, face, lit top); the buildings (fort, barracks, market, scaffold, the capital) still sit flat.
1. **In code, the way the walls were done:** a ground shadow, a base plinth and a lit side that follow the map's one light direction, so a fort, barracks, market and the capital read as solid objects standing on the land, at every zoom; the scaffold too. The painted sprites stay (art batch 5 can paint 3D versions later; this must look right now).
2. **Consistency:** the same light direction and shadow softness as the walls and the scenery; nothing may hide the troop pill or the info layer.
3. Screenshots: a walled province with a fort and a market inside it at Near, Mid and Far; the phone at Mid.
- **Commit, `pnpm deploy:preview`, push.**

## Part 4: the cinematic replay; building, gold and Spoils; Fate, the Fallen, deals and spies
1. **The cinematic replay** (`09` §1): letterbox bars, a soft vignette and a warmer grade easing in over half a second as the replay starts and out as it ends; the camera moving like a camera (eased pans, a gentle push-in on big moments, a slow pull-out at the end of the turn); **title cards** for the moments that matter ("Galeholt falls to House Gules", "House Vert is no more", "Lady Morwen breaks the truce"), at most one or two a turn. **Skip still skips**, and the replay's cap stands.
2. **Building, recruiting, gold, Spoils** (`09` §4): recruits march out of the gate with a puff and their number pops; the scaffold rises as building starts and drops away in sawdust with a glint when it's done; culture raised as golden laurel leaves with a glow ring; gold at the start of the turn as a few coins flying to the counter, which rolls up; Spoils fanning out and bursting into the windfall.
3. **Fate and the Fallen** (`09` §5, the table: one short signature per event, under fog the generic pulse). Nate (Oct 7): the events themselves are fine; make them **visible**.
4. **Diplomacy and spies** (`09` §6): the scroll and the seal on a deal, the truce border in white stitches, two banners crossing on a joint war; a broken deal (the scroll tears, a red crack along the truce border, the Oathbreaker brand on the portrait); the hooded spy figure fading in and out, the eye over an infiltrated province, the "caught" stamp.
5. Tests: title cards only for the listed moments and never for a fogged one; the camera never leaves the player's visible area.
6. Screenshots: the letterboxed replay with a title card; laurels rising; a Fate event's signature; a deal sealed; a spy caught (desktop and phone).
- **Commit, `pnpm deploy:preview`, push.**

## Part 5: the living map (always on, quiet)
`09` §7: a gentle shimmer on water and breathing foam along the coasts; boats bobbing on sea lanes; clouds (`cloud-*`) drifting at Far and Mid with shadows on the land; chimney smoke from villages, towns and capitals; windmills turning; flags fluttering on capitals; the lighthouse beam at Mid; birds now and then; fog mist drifting. All of it pauses when the tab is hidden, goes to Light with "Reduce motion", and costs under 5 fps on the phone at Mid (measure it; if it costs more, thin it until it doesn't).
- Screenshots (and the GIF below can start here).
- **Commit, `pnpm deploy:preview`, push.**

## Part 6 (can slip to 21b): menus with weight, the title screen, game over
`09` §8: Lock in (the wax seal stamps down with a press and gold flecks; the timer glows like an ember in its last 10 seconds); "Turn 8" sweeping across with the compass emblem; panels easing in and out, buttons pressing, the gold trim's slow glint on hover (desktop); numbers rolling; the report's lines coming in one by one; the title screen's key art with slow drifting clouds (parallax); game over with embers (defeat) or petals (victory). Nothing here may slow a basic turn: every animation is short and interruptible.
- **Commit, `pnpm deploy:preview`, push.**

## Last: the write-up, the GIF, the test list
- **`docs/09-polish-and-effects-plan.md`:** a BUILT line under each section that's done (and "not yet" where it isn't); the numbers (fps before → after on Full and Light, the particle budget, the replay's median length, the bundle).
- **`docs/06-art-direction.md`:** the effects' rules (blending, light direction, the 3D building treatment) in a short section; `docs/art/asset-list-and-prompts.md`: batch 4 marked imported; what batch 5 should paint (3D buildings, the scenery additions, Steward portraits).
- **`docs/rules-reference.md` §10** if the replay's behaviour changed in any way a player would notice (title cards, the Effects setting).
- **A GIF of one turn's replay** (desktop, about 10–15 seconds, under 5 MB), `docs/art/screens/s21-replay.gif`, with a battle and a capture in it.
- **"Things to test after session 21"** in `PROGRESS.md`, most important first (for example: watch a whole replay on the phone on Full: smooth? did it ever drop to Light and say so? Is the replay as readable as before: can you still tell what happened without the effects? Turn Effects Off: is anything missing? Does "Watch again" look identical? Do the buildings pop like the walls? Is the title screen's art right?). Carry over what Nate hasn't tried from "after session 20d".
- `PROGRESS.md` (sessions completed: 21), `docs/decisions.md`.
- **Commit and push.**

## Out of scope
- **Session 22: the language pass** (every piece of writing in Nate's voice; the bots' and leaders' voices, §13). Write title cards and notices in plain words now; 22 gives them their final voice.
- **Session 23: bots and balance** (the start bonus, the Marshal adopting the Merchant's lesson and the Steward's plan, a remnant judged honestly under fog, idle Steward gold handed back). Nothing in the bots or the engine changes in this session.
- **Sound:** its own session after 23. Don't add @pixi/sound yet.
- **Art batch 5** (3D buildings painted, the scenery additions, Steward portraits): a Gemini art chat later; this session draws in code.
- New controls, new rules, the map builder.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass; everything is committed and pushed to `main`. **Run the full `pnpm test` before every push and twice before your last push**, and ask Nate to check the repo's Actions page for your last commit.
- The replay at 50 fps or better on Full on the phone profile (or Light engaged automatically and reported); the replay's median length unchanged; the start-up bundle unchanged (within 5 KB).
- Every deploy a working build; the final `pnpm deploy:preview` with its lock check; the stale-build fix verified in a browser with an old service worker.
- Screenshots for every part reached, the GIF, and the docs above.

## End with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- which parts were finished and which slipped (for 21b)
- fps on the phone profile before → after (Full and Light), the particle budget, the replay's median length, the bundle sizes
- what the stale-build check showed (Step 0) and what you changed
- art: anything in batch 4 that came out wrong or was left out, and the conifer choice
- the screenshot paths and the GIF
- the deployed version
