# Claude Code: Session 5 (Milestone 2, part 4: menus, replay, timer, phone and the private preview)

*Saved from the prompt Nate pasted into the session. The orchestrator's Oct 3 doc updates (its review of session 4 in PROGRESS.md, the new "Borders and ownership" and "Making the pieces blend" sections of 06-art-direction.md, docs/07-map-tooling.md and the Tier 2 file names in the art list) had not reached GitHub when session 5 started, so the session worked from this prompt alone.*

You are the lead developer on Conquerra, a fantasy, military-first strategy game. Players set queued orders in a 5-minute window, then everyone watches a shared replay of what they can see. The owner is Nate, who directs the project but isn't a full-time developer: explain choices in plain language and keep setup steps copy-paste simple.

Session 4 built the illustrated map. This session finishes M2: the gilded navy-and-gold menus, the animated replay, the turn timer, the phone layout, the installable app, and a private preview at `conquerra.overconfidenceonline.com` so Nate can play on his phone. M2's exit is "Nate plays full games against bots on phone and laptop."

Nate has finished his current art batch: the rest of the map art and Tier 2 (icons, Leader portraits, territory card art). Use real art wherever it exists and good placeholders for anything missing.

## Read first, in this order
1. `CLAUDE.md` (hard rules)
2. `PROGRESS.md` (including the orchestrator's review of session 4)
3. `docs/06-art-direction.md`: the "Borders and ownership" and "Making the pieces blend" sections (new Oct 3), then "Menus", "Desktop layout" and "Phone layout", plus the menu look in `docs/art/reference-mockup.png`. Take its look only, never its extra systems (other resources, research, pause or fast-forward, spy or diplomacy buttons).
4. `docs/art/asset-list-and-prompts.md` (Tier 2 file names)
5. `docs/04-design-additions.md` §1 (turn flow and replay) and §8 (fog and the replay), and `docs/rules-reference.md` (the turn and fog sections)
6. `docs/infra-cloudflare.md` (the M2 private preview)
7. `docs/03-build-plan.md` (the M2 section) and `docs/decisions.md` (newest lines at the bottom)
8. `docs/07-map-tooling.md` (skim: the guardrails, so nothing this session makes random maps or a map builder harder later)

## Step 0: housekeeping and art
1. Commit the orchestrator's doc updates as they are ("Docs: orchestrator review of session 4, session 5 prompt").
2. Run `pnpm art:import`. Commit the processed art ("Art: Nate's batch 2 and 3").
3. Look at the imported art in the game, not just in the importer report. Tell Nate in plain language about anything that doesn't fit, such as wrong angle, a smudge, a seam that shows, or a texture that repeats visibly. Known from the orchestrator's review:
   - `tree-conifer-1` and `-2` are round bushes, not pines.
   - `tree-broadleaf-3` has a blurry smudge in the top right.
   - Rock, snow and hills textures have big built-in shadows.
4. Importer improvement: make the art match.
   - An optional step for ground textures that evens out large-scale light and dark areas (keeping the small detail), so built-in shading repeats less and stops fighting the relief lighting.
   - Colour matching: nudge each ground texture toward a target colour, brightness and contrast for its ground type (a small palette kept with the art list), and give sprites of one family (trees, mountains, villages) the same treatment, so pieces from different AI batches sit together.
   - Turn these on where they help, and show a before and after.
5. Natural edges between ground types (`06-art-direction.md`, "Making the pieces blend"): ragged, noise-shaped edges instead of blurred squares, rock and snow following height, a thin sand band on coasts, and one final colour grade over the painted world. Sprites get a soft contact shadow down and to the right. Fringe pieces (bushes at forest edges) are a nice-to-have.

## Part A: fixes from the session 4 review
1. Possible "last seen" bug. In `embervale-fog-last-seen.png`, Roseridge (deep in the fog) shows the player's own Azure with "0?". Find out why. A territory never holds 0 troops. When you lose land, your memory should record the capture you saw (you see your own land fall). Fix it in the engine with a test.
2. Region names at Mid zoom run over army markers (Thornreach and Moonreach in `embervale-mid.png`). Markers always win: fade or dodge province names where they would cover a marker.
3. Far zoom on a laptop leaves a wide empty border. "Fit map" should fill the screen (allowing for the menus), and the pan limits shouldn't show large empty margins.
4. House colours: replace Celeste with Teal. Pick a teal that's clearly different from Azure and Vert at Far zoom and in Tactical view, including under a colourblind simulation (deuteranopia and protanopia). Save a small swatch image of all ten Houses (normal and simulated) to `docs/art/screens/houses.png`.
5. Lighter fog: a soft, pale haze with the painted land showing faintly through it (desaturated, only lightly darkened), plus the drifting mist. It must still be obvious at a glance which land you can't see. Far zoom's extra dimming shouldn't stack into a dark blanket.
6. House borders, per "Borders and ownership" in `06-art-direction.md`. Today each realm's glow is stroked centred on the line, so where two Houses meet the colours overlap and one wins, the glow spills onto water, and the flat tint muddies the ground (Gules over hills reads brown).
   - Each House's band sits inside its own land (masked by its own fill), so a shared border shows both colours side by side with a thin ink line between.
   - Replace the flat tint with an edge wash that fades inward about 15 map units; keep the stronger tint at Far zoom and the flat Tactical view.
   - Tint so the House hue survives every ground type.
   - Selection: a pulsing gold double rule just outside the House band, so it can't be mistaken for Or or Argent.
   - Remembered land: a faint dashed line in the last-seen owner's colour.
   - Save `docs/art/screens/house-on-ground.png`: every House's border and wash over every ground type at Mid zoom, plus a close-up of two Houses meeting.
   - Use only the map's outlines (no per-map tweaks), so this works unchanged on random maps later.

## Part B: the gilded menus (`apps/web`)
Follow `06-art-direction.md` (palette, fonts, frames, layouts). Build one reusable gold-trimmed frame and use it everywhere.
- Top bar: logo emblem · gold (+N per turn) · Turn N and the timer · settings.
- Players panel: House shield (colour plus pattern), name, Leader portrait, and whether they're still in. No territory counts, troops or gold (decided).
- Action bar: big round icon buttons (Move/Attack, Recruit, Hire, Build, Culture, Retreat), plus the army panel, the order queue and the Lock in wax seal. Keep it at 8 taps or fewer for a typical turn. Count it again and report the number. Tuck the less-used presets behind "More". You may merge Hire and Build into one "Spend" button if testing shows it's faster.
- Territory card: the tap card from session 4 in the gilded frame, with vista art picked by terrain, and the same "?" and "Seen N turns ago" rules for fogged land.
- Leader portrait card for your own Leader: its location, and whether it's leading an army.
- Event pop-ups: short gilded toasts during and after the replay ("Gules captures Oakcrest"). Fogged events show only surface details ("A battle in Northreach").
- Turn report: the session 2 text log restyled, grouped by what matters to you first (your losses and gains, then what you saw, then surface details).
- Minimap: a small Tactical-style overview with your view rectangle. Tap it to jump there. Fog rules apply.
- Lobby and game-over screens get the same treatment (simple is fine; the title art is Tier 3).

## Part C: the animated replay
- After Lock in, the turn plays out on the map from `replayFor` only, so it's fog-safe by construction: armies march along their arrows; each battle shows a short clash with the result; captured land changes colour; recruits and buildings pop in; fogged events show as a brief pulse on the province with a surface-detail toast.
- Pacing: a typical turn's replay lasts about 10–20 seconds, in step order. Skip jumps to the end; Watch again is in the turn report. No pause, play or speed controls (decided).
- Keep replay timing and sequencing logic outside the renderer, with tests. The renderer only animates what it's given.

## Part D: the turn timer
- The host keeps a countdown from the game's timer setting (5 minutes by default; the lobby offers 1, 3, 5 and 10 minutes, plus "No timer" for relaxed solo play).
- When time runs out, your current orders lock in automatically, exactly as if you had pressed Lock in.
- Warnings: the timer turns gold at 1 minute and red at 15 seconds. When you lock in early, bots lock in immediately and the turn resolves.
- The engine still doesn't keep time; this lives in the host, which M4 replaces with the server.

## Part E: the phone layout
- The map is full screen with a compact top bar and the action bar at the bottom.
- Panels (order queue, army, turn report, territory card) open as a bottom sheet you can drag between half and full height.
- The minimap and players panel are toggles.
- Touch targets are at least 44 px. Check portrait 412×915 and a small phone (360×740). Landscape just has to work.

## Part F: the installable app
- Add `vite-plugin-pwa`: an app manifest (name, navy/gold colours, emblem icon at the required sizes) and offline caching so single player works with no connection after the first visit.
- Make updates safe: a new version shows a small "Update ready" prompt rather than breaking a game in progress.
- Not in scope: push notifications (M4).

## Part G: the private preview (`conquerra.overconfidenceonline.com`)
Static hosting only; there's no server code yet. The details are in `docs/infra-cloudflare.md`.
1. Deploy with Wrangler from Nate's computer: a Worker that serves the built web app as static assets, plus `pnpm deploy:preview`. Deploying automatically from GitHub waits until M4.
2. Don't create any public address: set `workers_dev = false` and turn off preview URLs. The only way in is the custom domain, behind Access.
3. Nate's one-time steps, as numbered copy-paste steps (pause and ask him to do them): `npx wrangler login`; in the Cloudflare dashboard, Zero Trust → Access → Applications → Add an application → Self-hosted, named "Conquerra", domain `conquerra.overconfidenceonline.com`, the existing Google login, and a policy allowing only `nkurtz@gmail.com`. Create the Access application before the domain goes live, so it's never open even briefly.
4. Then deploy and check the lock: an unauthenticated request must get the Cloudflare Access login, never the game. Report what you checked.
5. Add a short "How to update the preview" section to the README (one command).

## If time runs short
Work in this order, and move whatever's left to session 6 with a note in the summary: 1. Part A, including the House borders (Step 0.5 may move to session 6; the colour matching in step 0.4 may not). 2. the timer 3. the replay 4. the menus 5. the phone layout 6. the private preview 7. the installable app. The preview matters more than polish, because Nate's real-phone test is what proves M2.

## Out of scope (don't build)
- M3: generals and standing instructions, Spoils and Fate decks, diplomacy, the Fallen, spies, culture unlocks, smarter bots, the balance pass.
- M4: online play, accounts, the Durable Object backend, push notifications, deploying from GitHub, Workers Paid.
- M5: random maps in the lobby, blackout fog, the 50-player mode.
- Tier 3 art (title screen art, game-over art, faction castles).

## Tests
- Fixes: last-seen memory for lost land (engine, with the determinism test still passing), and label-versus-marker priority.
- Replay: sequencing and timing from a list of events. A fogged event never reveals names or numbers.
- Timer: auto-lock on expiry, warning thresholds, and "No timer".
- Tap count: a scripted typical turn stays at 8 taps or fewer.
- Keep CI green. GitHub's CI can't run WebGL, so renderer and UI code must at least build and typecheck there.

## Exit criteria
- `pnpm test`, `pnpm typecheck` and the web build pass, and the work is committed and pushed.
- A full game is played to the end on laptop and in phone emulation, using the replay, the timer (including one auto-lock) and the bottom sheet.
- The preview is live at `conquerra.overconfidenceonline.com` behind Access, has no `workers.dev` address, and installs as an app from Chrome.
- Screenshots in `docs/art/screens/`: desktop (full game screen, replay mid-battle, turn report, players panel, territory card); phone (main screen, bottom sheet open, timer in its red state); plus `houses.png`, `house-on-ground.png`, the fog before and after, and the art matching before and after.
- Re-run `pnpm art:import` at the end in case more art arrived, and retake any screenshots it changes.
- `docs/rules-reference.md` (the timer and the replay), `docs/decisions.md` and `PROGRESS.md` are updated in simple language, with "Claude Code sessions completed" bumped to 5.

## End-of-session summary
Done / Next / Questions for Nate / Risks, under one page, plus: the preview address and what Nate should try first on his phone; the screenshot paths; the tap count for a typical turn; art feedback (what looked off, and which missing or weak pieces to make next, in priority order); anything moved to session 6.
