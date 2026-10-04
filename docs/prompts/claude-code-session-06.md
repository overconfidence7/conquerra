# Claude Code: Session 6 (Milestone 2, finish: real art, polish, and the private preview goes live)

**Run this session locally, in Claude Code on Nate's Windows computer, in the project folder** (`C:\Users\nkurt\Claude\Projects\Strategy Game`), not in the cloud. It needs three things only that computer has: Nate's art in `art/incoming/` (kept out of git), his browser for `npx wrangler login`, and a real connection to Cloudflare and the domain.

You are the lead developer on **Conquerra**, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer: explain choices in plain language and keep setup steps copy-paste simple.

Session 5 built the gilded menus, the replay, the timer, the phone layout and the installable app. It ran in the cloud, so it never saw Nate's art and couldn't put the preview online. **This session finishes M2:**
1. bring in all of Nate's art and judge it in the game
2. small polish fixes
3. put the private preview online, so Nate can play on his phone

## Read first, in this order
1. `CLAUDE.md` (hard rules)
2. `PROGRESS.md`, especially the last three entries (session 5, and the orchestrator's reviews)
3. `docs/06-art-direction.md`, especially "Borders and ownership" and "Making the pieces blend"
4. `docs/art/asset-list-and-prompts.md` (every file name, and the current style line)
5. `docs/infra-cloudflare.md` and the "private preview" section of `README.md`
6. `docs/decisions.md` (newest lines at the bottom)

## Step 0: get the computer in sync (do this carefully)
Nate's folder still has **uncommitted copies of the orchestrator's Oct 3 docs**. They're already on GitHub `main` in merged form, together with all of session 5 (merged from the branch `claude/conquerra-m2-menus-replay-timer-kk82dr`).
1. `git --no-optional-locks status` to see the state. If a stale `.git/index.lock` exists and no git process is running, delete it.
2. Keep the local copies as a backup: `git stash push -u -m "Oct 3 docs, superseded by main"`. Then `git pull` (it should fast-forward to `main`) and `pnpm install`.
3. Check nothing was lost: compare the stash with `main` for `docs/06-art-direction.md`, `docs/07-map-tooling.md`, `docs/art/asset-list-and-prompts.md`, `docs/03-build-plan.md`, `docs/decisions.md` and `PROGRESS.md`.
   - Every line from the stash should be on `main` (main has more, from session 5 and the merge).
   - If anything's missing, add it back and say so in the summary.
   - If all is there, drop the stash.
4. Delete the old remote branch: `git push origin --delete claude/conquerra-m2-menus-replay-timer-kk82dr`.
5. **Work on `main` and push to `main`** for the rest of the session (no side branches).
6. If the GitHub command-line tool isn't installed, give Nate the two commands (`winget install GitHub.cli`, then `gh auth login`) and carry on; it's optional.

## Part A: Nate's art (all of Tier 1 and Tier 2, about 80 files)
1. Run `pnpm art:import`. Report in plain language what was imported, what's missing and anything rejected. Make sure every name in the art list is recognised, including:
   - the figures, villages, towns, capitals and buildings
   - the ship, bridge and clouds
   - the shield and banner bases
   - the 13 icons, the emblem, the wax seal and the frame corner
   - `leader-01…10` and the five vistas
   - Tinted pieces (figures, banners, shields, flags) still need their tint masks.
2. **Wire the real art into the menus** wherever session 5 used placeholders:
   - the emblem in the top bar and app icons (re-run the app-icon script from the real emblem)
   - the wax seal on Lock in
   - the frame corners on the gilded frame
   - the 13 icons in the action bar, army panel and cards
   - Leader portraits in the players panel and Leader card
   - vistas on the territory card, by terrain
3. **Judge it in the game, not in the importer.** Look at Far, Mid and Near on both maps, plus the menus, and tell Nate plainly what doesn't fit. Known from the reviews:
   - `tree-conifer-1` and `-2` came out as round bushes rather than pines.
   - `tree-broadleaf-3` had a smudge.
   - The rock, snow and hills textures have big built-in shadows.
   - Grass repeats visibly.
   - The Oct 3 batch used a more semi-realistic style line than the Oct 2 batch, so check that the two batches sit together after colour matching.

   Fix with the importer's colour matching and evening-out first. Only list pieces for Nate to redo when tuning can't save them.
4. Commit the processed art ("Art: Nate's Tier 1 and Tier 2 batches").

## Part B: polish
1. **Desktop Leader card:** its text runs into the bottom bar (`ui-desktop.png`). It must fit, or the right column must scroll.
2. **Army panel:** the hint line at the bottom is clipped.
3. **Replay camera:** when an event happens off screen, ease the camera there and back (from session 5's "next" list). Keep it gentle; Skip still works at any moment.
4. Anything else you notice that a player would trip over in the first five minutes. Keep it small.

## Part C: screenshots and real speed
- Retake every screenshot in `docs/art/screens/` with the real art: `pnpm map-check` and `pnpm ui-check`, on this computer's real GPU.
- Re-run the performance check from session 4 (phone emulation, CPU slowed 4x) on both maps, and report:
  - time to first map
  - frames per second while panning at each zoom
  - memory
- The real art will be heavier than the placeholders. If Greatmarch drops below about 50 fps, shrink textures or simplify Far rather than drop art.

## Part D: put the private preview online
**Already done (by the orchestrator, Oct 4):** the Cloudflare Access app "Conquerra" exists on `conquerra.overconfidenceonline.com`:
- Google sign-in only
- policy "Conquerra players" (Nate's email only)
- 1-month session

Don't create another one; don't change it.

1. Ask Nate to run `npx wrangler login` (or run it for him; a browser opens and he clicks **Allow**).
2. `pnpm deploy:preview`. It runs the tests, builds, uploads, and checks the lock.
3. **Check the lock yourself** and report what you saw:
   - A request to `https://conquerra.overconfidenceonline.com` with no login must redirect to the Cloudflare Access sign-in (`keel-nkurtz.cloudflareaccess.com`), never return the game.
   - `wrangler deployments list` works.
   - There is **no** `conquerra.<account>.workers.dev` address (it must not answer).
4. Update the README's one-time steps: step 3 (the Access app) is done; keep the text short for adding friends later (add their email to the "Conquerra players" policy).
5. Then hand over to Nate for his test. On his phone:
   - open the address in Chrome and sign in with Google
   - install the app
   - start a game with a 1-minute timer and let one turn run out
   - play a few turns

   He can tell the orchestrator what he finds; you don't need to wait for it.

## Out of scope (don't build)
- **M3:** generals, Spoils and Fate decks, diplomacy, the Fallen, spies, culture unlocks, smarter bots, the balance pass, the map lab.
- **M4:** online play, accounts, the server, push notifications, deploying from GitHub, Workers Paid.
- Tier 3 art (title art, game-over art, faction castles).

## Tests
- Art import: every name in the art list is recognised; tinted pieces get masks; re-running it is safe.
- Replay camera: the camera plan comes from the replay timeline (outside the renderer) and is tested; fogged events never move the camera somewhere that reveals more than the pulse.
- The determinism test still passes. Keep CI green.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and everything is committed and pushed to `main`.
- The preview is live behind Access, with the lock checked as above.
- Screenshots and performance numbers are retaken with the real art.
- `PROGRESS.md`, `docs/decisions.md` and `docs/infra-cloudflare.md` are updated in simple language, with "Claude Code sessions completed" bumped to 6.

## End the session with this summary, for Nate to paste to the orchestrator
**Done / Next / Questions for Nate / Risks**, under one page. Also include:
- the preview address, and confirmation of what the lock check showed
- the screenshot paths and performance numbers
- art: what worked, what tuning fixed, and which pieces (if any) Nate should regenerate, in priority order
- whether the stash check in Step 0 found anything missing
