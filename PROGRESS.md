# Conquerra: Progress Log

*Plain-language record of where the project stands. Every session reads this first and adds a short entry at the end. Newest entries at the bottom.*

## How we work
- **Nate** decides what the game is and approves each step.
- **The orchestrator** (a Cowork session) plans the work, writes the prompts for Claude Code, reviews what comes back, and keeps this file and the design docs up to date.
- **Claude Code** writes the code, one milestone at a time, and ends every session with: what's done, what's next, and questions for Nate.
- **Every 3 Claude Code sessions**, the orchestrator writes a fresh orchestrator prompt (so a new orchestrator session can pick up cleanly) along with the next Claude Code prompt.

## Where things live
- Code and docs: `C:\Users\nkurt\Claude\Projects\Strategy Game` (and GitHub `overconfidence7/conquerra` once connected)
- Design: `docs/02-game-design-outline.md`, plus the newer ideas in `docs/04-design-additions.md`
- Build plan: `docs/03-build-plan.md`
- Decisions: `docs/decisions.md`
- Website (later): conquerra.overconfidenceonline.com

## Status right now
**Phase: M3 (depth and balance). Sessions 7–19 are done. Next: Nate's play test (the list is under "Things to test after session 19"); then session 20, the polish pass.**

Claude Code sessions completed: **19** (a new orchestrator prompt is due after sessions 3, 6, 9, 12, 15, 18, ...)

---

## Log

### Oct 1: Research and first design
- Researched Risk, War.app, Diplomacy, Supremacy 1914, Polytopia and others: what players love and the top complaints.
- Interviewed Nate; wrote the design outline v0.1 and the build plan.
- Picked hosting: Nate's existing Cloudflare account.

### Oct 2: Name, setup, early prototype
- Name chosen: **Conquerra**. Domain: overconfidenceonline.com. GitHub: overconfidence7.
- Claude (the planner, not Claude Code) built an early engine prototype ahead of plan:
  - turn system with order queues and backups, combat, economy, fog, a basic bot, and a simulator
  - 37 tests; 3,000 bot games with no crashes
  - It's in the folder, but it was built before the v0.2 design changes below. Nate will decide whether Claude Code keeps it as a starting point or starts fresh.
- **Correction from Nate:** the planner shouldn't write code. From here on, Claude Code writes code and the orchestrator writes prompts.
- **Correction from Nate:** turns are **5 minutes** to set orders, followed by a shared "what happened" replay where each player sees the results in their own visible area. (v0.1 assumed multi-day turns.)
- Nate shared a big batch of new ideas: easy-click diplomacy with counteroffers, contingency presets, generals you give instructions to, military vs. culture, three kinds of cards, and an event/mission deck. These are captured in `docs/04-design-additions.md`, with open decisions.
- Waiting on: Nate connecting GitHub, then a round of questions, then the kickoff prompts.

### Oct 2 (later): Decisions
- Turn timer: 5 minutes by default; longer timers available for extended campaigns.
- Troops: **troops + specialists**. How players get specialists is still open.
- Culture stays light. The game is military and conquest first, with cultural flair; it is not Civilization.
- Claude Code will review the early prototype and decide whether to keep it, change it, or start over.
- GitHub is connected, but the `conquerra` repo still needs to be created.
- More decisions:
  - Specialists come from gold at a barracks, with light culture unlocks and occasional free Spoils cards.
  - Your Leader is a general: you can control it directly or give it standing instructions. Captured leaders become your generals.
  - Cards: map bonuses, plus a Spoils deck and a Fate deck.
  - Fate: everyone draws one card per turn. Events land anywhere on the board, mostly mild with a few extreme ones; missions go to whoever drew them.
- Build plan milestones revised for v0.2.
- Kickoff prompts written: `docs/prompts/claude-code-session-01.md` and `docs/prompts/orchestrator-01.md`.
- GitHub repo is live: `overconfidence7/conquerra` (code, docs and prompts pushed).
- Checked Nate's Cloudflare account (no changes made):
  - The domain, Google login (via Cloudflare Access) and the pieces we need are already familiar territory from Keel and Curse of Stats.
  - Nothing to set up until M2 (an optional private preview) or M4 (the real backend).
  - Plan to switch to the $5/month Workers plan at M4.
  - Details in `docs/infra-cloudflare.md`.
- New design: fog of war and spies (`docs/04-design-additions.md` §8).
  - With fog on (the default), you only see details on your own and neighboring land; the rest of the map shows just outlines and bonuses.
  - Spies can sneak into whole countries to see inside. Whoever holds an entire country can station up to 3 spies at its capital to block, kill or fool incoming spies.
  - Spies are planned for M3.

### Oct 2: Claude Code session 1 (Milestone 1 done)
- Connected this folder to GitHub without losing anything. Restored the CI check and the newer `CLAUDE.md` from the repo.
- Reviewed the planner's prototype: kept the solid foundation (fair luck, turn order, backups) and rebuilt the parts the v0.2 design changed. Write-up: `docs/05-prototype-review.md`.
- The engine now has:
  - **troops + specialists** (cavalry, siege, scouts, engineers, healers; up to 2 per army)
  - **light culture** (one number per territory: income, protection, specialist unlocks; the conqueror keeps it)
  - **five one-tap presets** for backups
  - the **v0.2 fog rule** and a **fog-trimmed replay** with "surface details"
  - the **turn timer** and turn limit settings
- The Recruit bot uses all of it.
- **Games now last about 22–24 turns** (target 15–25; the prototype ran 80–110). 3,000 bot games, no crashes, fair seats.
- **Speed:** a turn takes under 1 ms of computer time on average. The plan to move to the $5/month Cloudflare plan at M4 stands.
- Plain-language rules: `docs/rules-reference.md`. Numbers: `docs/sim-results-m1.md`.
- 70 automated tests, all passing.

### Oct 2: Orchestrator review of session 1
- Checked the work: it matches the design and stays inside M1. GitHub's automatic checks pass.
- Nate's calls:
  - Specialists are **lost** when their army dies.
  - A fallen **Leader comes back for free** on its owner's next turn. Knock a player out and you get their Leader as a general (built in M3).
  - **Big games:** maps list the player counts they suit, and the lobby suggests Conquest mode for 8+ players.
  - Engineers finish any building instantly; recruiting more than you can afford buys what you can pay for.
  - At the end of M2, put the game online privately at conquerra.overconfidenceonline.com so Nate can play on his phone.
- M2 is split in two: session 2 builds a playable game in the browser; session 3 adds the replay, timer, phone layout and the private preview.
- Next prompt: `docs/prompts/claude-code-session-02.md`.

### Oct 2: Claude Code session 2 (M2, part 1: the game is playable in a browser)
- Housekeeping: committed the orchestrator's docs and added a line-endings setting (`.gitattributes`). The repo was already clean, so nothing else changed.
- Engine updates:
  - Fallen **Leaders come back for free** at the end of the turn they fell: at the capital, or the strongest territory if the capital is gone. The 15-gold "Raise Leader" order is gone.
  - The game records **who knocked each player out**, ready for M3's generals.
  - Each map lists the **player counts it suits** (Embervale 4–6), and the lobby suggests **Conquest for 8+ players**.
  - Re-ran the simulator: games still last about 24 turns, seats are still fair, and 10-player Conquest ends on turn 20.
- **The browser game** (`apps/web`): a lobby, the game screen and a game-over screen. You play against 1–5 bots on Embervale.
  - Tap your territory, tap a neighbour, and you have an attack, with the odds shown before you add it. "Just enough" picks a sensible troop count, and presets are one tap each.
  - One-tap recruit (defaults to all your gold), hire, build, raise culture and retreat. Leader controls: lead an army (+20%), Seize the Initiative, Lie in Wait.
  - The order list shows the order things will happen, lets you delete or reorder, and shows the gold left.
  - **Lock in** plays the turn and shows a plain-text report of what you could see. Fighting in the fog is summed up in one line.
  - The game runs in a background "host" inside the browser, and the screen only ever gets your fogged view. In M4 we swap that host for the real server.
- **A typical early turn takes 10 taps** (recruit, two attacks with presets, lock in).
- How to play it: see "How to play it locally" in the README (`pnpm dev`).
- 93 automated tests pass (18 new for the web app), and GitHub's checks now build the web game too.

### Oct 2: Orchestrator review of session 2
- Checked the work: it matches the plan, the screen only ever sees your own fogged view, and GitHub's checks pass.
- New direction from Nate: **maps should look and play like War.app or a good Risk map.** That means organic borders, seas and lakes, mountain ranges, rivers, and real choke points. Written up in `docs/04-design-additions.md` §9.
- Nate's calls:
  - The map rebuild comes **next** (session 3), before the phone work, since tap sizes and zoom depend on the map. M2 is now three sessions.
  - **Random maps** and **"blackout" fog** (you see nothing past your borders until you explore) come later with the big game modes. We build so they're easy to add.
  - Attacks start with **"Only if still stronger"** switched on.
  - When you're knocked out, choose **"Watch to the end"** or **"See the result."**
- Saved for session 4 (phone polish): Claude Code's ideas to tuck two presets behind "More" and merge hire and build into one "Spend" button, plus odds that account for your earlier queued orders.
- Next prompt: `docs/prompts/claude-code-session-03.md`.
- **Art direction, take two ("Gilded Atlas"):** Nate found the first style too simple and shared a mockup of the look he wants: a richly painted world with navy-and-gold menus. The new direction (`docs/06-art-direction.md`) keeps that look but fits it to our game (gold only, no research, troops + specialists).
  - **Readability:** a clean info layer always sits on top of the painting (House borders, troop banners, building and specialist icons). Zooming out flattens the map toward plain colors, and a one-tap "Tactical view" removes the painting entirely.
  - **Art:** AI-generated. Nate makes it with the prompt pack in `docs/art/asset-list-and-prompts.md` and drops it into `art/incoming/`. The game uses placeholders until it arrives.
  - **M2 is now four sessions:** 3 map maker, 4 painted map, 5 menus, replay, timer, phone and private preview.
- **Art style settled:** Nate compared his realistic mockup with two Gemini versions and chose **illustrated, with relief lighting**. It's a storybook-painted map, made deeper with hill and mountain shading from a height map, under the gilded navy-and-gold menus. It suits random maps, keeps AI art consistent and reads well on phones. From the Gemini version we take the glowing House borders, troop pills, tap cards, specialist figures on the map, event pop-ups and a players panel. The art prompt pack now uses the illustrated style.

### Oct 2: Claude Code session 3 (M2, part 2: the map maker and real geography)
- Housekeeping: committed the orchestrator's docs (twice, as the art direction moved to v0.3 "illustrated" mid-session) and added `art/incoming/` for Nate's art.
- **The map maker** (`packages/mapgen`): give it a seed and some sizes, and it makes a whole map. The same seed always gives the same map.
  - natural coastlines with bays and peninsulas, a sea, lakes and islands
  - impassable mountain ranges with passes, and rivers running downhill to the sea
  - sea lanes over water, with a new `sea` border (attacks across one are weaker)
  - territories of about even size grouped into provinces, and fair capital spots for every table size
  - everything the illustrated map will need: outlines, a ground-type grid, a height map for hill shading, label points, and where trees, peaks, villages, towns, castles and buildings go
  - every map is checked (connected, no slivers, sensible provinces, fair capitals, enough choke points), and a failing map is thrown away for the next seed
- **Embervale and Greatmarch were rebuilt** with it (same sizes as before). Previews: `docs/maps/embervale.png` and `docs/maps/greatmarch.png`.
- **Simulator** (`docs/sim-results-m2-maps.md`): no crashes, seats still fair. Games run 1–2 turns longer at 4–6 players (typical game 24–25 turns), because bots are cautious around passes and sea lanes. Changing the rules didn't help, so the rules are unchanged; teaching the bots to fight for choke points belongs in M3.
- **The browser game** draws the new maps simply (outlines, water, mountains, rivers, passes, sea lanes) and offers both maps. The game screen now gets the map from the game host, not from the code.
- **Nate's two changes:** attacks start with "Only if still stronger" on (a typical turn is now **8 taps**, was 10), and when you're knocked out you choose **Watch to the end** or **See the result**.
- Plain-language rules for water, mountains, passes, sea lanes and choke points: `docs/rules-reference.md` §12. Map data notes for session 4: `docs/map-data.md`.
- 127 automated tests pass (34 new).

### Oct 2: Orchestrator review of session 3
- Checked the work: both maps look like real geography, the scope held, and GitHub's checks pass.
- Nate's calls:
  - Games at 4–6 players run about a turn long. We'll fix that with **smarter bots in M3**, not rule changes.
  - **Generated place names stay**; Nate can rename any of them.
  - **"Last seen" intel:** fog shows what you last saw there, marked "?" with its age. Built in session 4.
  - The players panel **won't show territory counts**; you scout to learn how big rivals are.
- Next prompt: `docs/prompts/claude-code-session-04.md`. Three Claude Code sessions are done, so there's also a fresh orchestrator prompt: `docs/prompts/orchestrator-02.md`.

### Oct 2: Claude Code session 4 (M2, part 3: the illustrated map)
- Housekeeping: committed the orchestrator's docs and the session 4 prompt.
- **"Last seen" intel** (engine): each player remembers what they last saw on every territory (owner, troops, building, and when). Fogged land now shows that memory marked "?", and the tap card says how old it is ("Seen 2 turns ago") or "Unexplored". It never holds anything you couldn't have seen, and a fooled spy (M3) can write into it later. Rules: `docs/rules-reference.md` §11.
- **The illustrated map** replaces the plain one (the panels are unchanged):
  - the painted world: blended ground, hill and mountain shading lit from the upper left, darker impassable ranges with peaks, shallows fading to deep water, rivers that widen toward the sea, passes with a road, curved sea lanes with a ship, and trees, peaks, hills, villages, towns and castles where the map maker put them
  - the info layer on top: glowing House borders, troop pills with banners, crowns, buildings, specialists, culture dots, capital plaques, gold selection glow, gold-trimmed order arrows and the four-pip odds badge
  - fog: greyed, darkened land with drifting mist, showing only last-seen markers
  - Far / Mid / Near zoom with smooth fades, wheel, drag, pinch, double tap, and the hover / tap-and-hold card
  - **Tactical view** (one tap): flat House colours with every detail. Browsers without WebGL get a plain version automatically.
- **Art:** Nate's first four textures (grass, farmland, forest, hills) are already in the game. Everything else uses placeholders painted in code. `pnpm art:import` brings in new art by file name and reports what's missing.
- **Names:** any place can be renamed in `packages/mapgen/names/<map>.json` (then `pnpm build-maps`).
- **Speed** (phone emulation with the processor slowed 4x): 60 frames a second while panning at every zoom on both maps; the map appears about 2.2–2.4 seconds after pressing Start.
- Full games played to the end on a laptop and in phone emulation (with Tactical view on).
- Screenshots: `docs/art/screens/`. 159 automated tests pass (32 new).

### Oct 2: Orchestrator review of session 4
- Checked the work: it matches the plan, GitHub's checks pass, and the screenshots look like a real illustrated atlas.
- Small things to fix in session 5:
  - In the fog, one territory showed **your own colour with "0?"**, probably an old memory of land you lost.
  - Region names run over army markers at Mid zoom.
  - At Far zoom on a laptop the map only fills about two-thirds of the screen.
- **Nate's second art batch** (18 files: the rest of the ground and water textures, mountains, hills and trees) arrived after the session. It's on-style. To redo: `tree-conifer-1` and `-2` (round bushes, not pines) and `tree-broadleaf-3` (a smudge). Rock, snow and hills textures have big built-in shadows that repeat. The prompt pack now asks for flat, even lighting.
- Nate's calls:
  - The seventh House colour becomes **Teal** (Celeste looked like Azure).
  - **Lighter fog**: a soft haze you can see the land through.
  - Raw art stays out of GitHub; Nate backs it up to **Google Drive**.
  - **Session 5 waits for the art batch Nate is generating now**, so the menus use real icons and portraits.
- Next prompt: `docs/prompts/claude-code-session-05.md`.

### Oct 3: Map builder idea, and making the art blend
- Nate raised a **custom map builder** as a future add-on, and asked how the art will blend and how House borders will show.
- **Map builder:** it shares a real foundation with random maps (the map maker's cells, outlines, quality checks, placement and the renderer), so they're planned together but built in order: a dev-only **map lab** early in M3, **random maps** in M5 (after splitting the map maker into stages that can be re-run and pinned), then the **builder** in M6 or sooner. Plan: `docs/07-map-tooling.md`.
- **Blending:** every map is data that one renderer paints, so blending gets fixed once and works for every map. Session 5 adds colour matching in the art importer, natural edges between ground types, and one final colour grade.
- **Borders:** the session 4 screenshots showed the glow straddling the line (where two Houses meet, one colour wins), spilling onto water, and the flat tint muddying the ground. New rules in `docs/06-art-direction.md`: each House's band sits inside its own land, an edge wash instead of a flat fill, tints that keep the House colour true, and a selection style that can't be mistaken for a House. Added to session 5 Part A, with a House-on-every-ground check image.
- Question for Nate: is the builder for him only (a desktop tool) or for players too?

### Oct 3: Art session 2 (Gemini): Tier 1 and Tier 2 art finished
- Claude drove Gemini through Chrome and reviewed every image before keeping it. **44 new files** are in `art/incoming/` (79 in total), each listed in `_source-map.txt`:
  - **Tier 1:** figure-cavalry, -siege, -scouts, -engineers, -healers, banner-flag, ship, bridge, cloud-1..3.
  - **Tier 2:** shield-base, banner-base, 13 icons (crown, gold, culture, troops, fort, market, barracks, watchtower, cavalry, siege, scouts, engineers, healers), emblem, seal, frame-corner, leader-01..10 (navy backgrounds) and five vistas (city, valley, forest, mountain, harbor).
- **Rejected:** a flag with a fort wall blended in from a reference image, a ship with a tiny fort tower on it, a bridge with a ghost ship under the arch, and a cloud with a stray orb. The last two were fixed by asking Gemini to remove the stray piece. Rejects are in `art/incoming/_review/rejected/` or left unused in Downloads.
- **Small compromises:** the bottom coin in `icon-gold` fades slightly into the background (invisible at 24px). `icon-barracks` is a touch more cartoon-like than the others. Most figures are at a lower camera angle than 45°, matching `figure-army`. Vistas are 16:9 (Gemini's widest), so the importer trims a little off the top and bottom to make 2:1.
- **Lessons** (now in the prompt pack): pick reference images that don't share subjects with the new image, name the last subject in each prompt ("no ship"), review the downloaded file rather than the preview, scrub Gemini's corner watermark from PNG downloads, and start a new chat every 8–10 images.
- `docs/art/asset-list-and-prompts.md` now has the current semi-realistic style line and the prompts that worked (the project copy is updated too).
- Next: run `pnpm art:import` and check the results in the game (session 5).

### Oct 3: Claude Code session 5 (M2, part 4: menus, replay, timer, phone, installable app, preview)
- **Missing inputs:** the orchestrator's Oct 3 doc updates and Nate's art batches 2 and 3 weren't on GitHub, so this session worked from the pasted prompt (saved as `docs/prompts/claude-code-session-05.md`) and the 4 textures already in the game. Everything else uses painted placeholders, including new ones for Leader portraits, card vistas and the wax seal.
- **The "Azure 0?" bug:** two engine bugs together. A battle that killed everyone on both sides left the defender holding land with 0 troops, and your memory never noted land you lost. Now the last defender holds with 1 troop, and you remember who took your land. Both have tests.
- **Map fixes:**
  - "Fit map" fills the screen around the menus, with open sea painted beyond the edges.
  - Province names fade where an army marker sits.
  - **Teal replaces Celeste**, checked with colourblind simulations (`houses.png`).
  - Fog is a pale haze you can see the land through.
  - House borders: each House's band sits inside its own land, with an ink line between neighbours and a soft wash inward. Selection is a pulsing gold double rule; remembered land has a dashed outline (`house-on-ground.png`).
  - Natural ground edges, beaches on the coasts, rock and snow on high ground, one colour grade, and soft shadows under trees, peaks and towns.
- **Art import makes the art match:** it evens out baked-in light and dark patches and nudges colours toward a small palette (`packages/art/src/palette.ts`); before/after in `art-matching-before-after.png`. It also no longer deletes art when run on a computer that doesn't have the originals.
- **Turn timer:** 1, 3, 5 or 10 minutes, or No timer. It turns gold at 1 minute and red at 15 seconds. When it runs out, your orders lock in as they are. It's kept by the game host (the server in M4), not the rules.
- **Animated replay:** after Lock in, armies march, battles clash and show the result, land changes colour, and recruits pop in. Fog shows only a pulse and "A battle in Northreach". About 10–20 seconds. Skip, and Watch again from the report.
- **Gilded menus:** top bar (gold +N per turn, turn, timer), Houses panel (shield, Leader portrait, in or out), round action buttons, army panel, order queue, wax seal, territory card with vista, Leader card, pop-ups, a grouped turn report, minimap, and gilded lobby and game-over screens.
  - Recruit is now one tap and Hire and Build became "Spend", so **a typical turn takes 7 taps** (was 8).
- **Phone:** full-screen map, action bar at the bottom, and a bottom sheet you drag between half and full. Checked at 412×915 and 360×740.
- **Installable app:** installs from Chrome, works offline for single player, and shows "Update ready" instead of reloading mid-game.
- **Private preview:** `pnpm deploy:preview` uploads the game, then checks that the site still asks for the Google sign-in. There's no public workers.dev address. Nate's one-time steps are in the README. This cloud session couldn't reach Cloudflare or the domain, so it isn't live yet.
- Full games played to the end on a laptop screen and in phone emulation, each with a real timer auto-lock (`pnpm ui-check play`). 198 automated tests pass (39 new). Screenshots: `docs/art/screens/ui-*.png` and the map shots.

### Oct 4: Orchestrator review of session 5
- Checked the work: GitHub's checks pass, the scope held, and the new screens look good (gilded menus, replay, phone layout). A typical turn is now **7 taps**.
- **Lesson: session 5 ran in the cloud**, so it couldn't see Nate's art (it stays on his computer, out of GitHub) or reach Cloudflare. It also worked on a side branch. From now on, sessions that need the art, the browser or Cloudflare run **locally on Nate's computer**.
- Tidied up:
  - Merged the Oct 3 docs (art direction, map tooling, the art list), which were still sitting uncommitted on Nate's computer, with session 5's docs, and moved everything onto `main`.
  - **Created the Cloudflare Access lock** ("Conquerra": Google sign-in only, policy "Conquerra players" = Nate's email, sign-in lasts a month). Nothing is online yet: no Conquerra Worker exists.
- Nate's call: **keep Purpure**. Azure and Purpure look alike to colourblind players, but their banner patterns tell them apart.
- Small things for session 6: the Leader card's text runs into the bottom bar on desktop, and the army panel's hint line is clipped.
- Next prompt: `docs/prompts/claude-code-session-06.md` (run it in Claude Code on Nate's computer, not in the cloud).

### Oct 4: Claude Code session 6 (M2 finish: real art, polish, the preview goes live)
- **Computer in sync:** Nate's old local doc copies were checked line by line against `main`. Nothing was lost, except that the saved session 5 prompt was a shortened copy, so the orchestrator's full original was put back. Old side branch deleted. Work is on `main` again.
- **Nate's art is in:** all 79 files of Tier 1 and Tier 2 imported, nothing missing or rejected. The menus now use the real emblem (top bar and app icons), wax seal, gold frame corners, the icons (action bar, army panel, territory card), Leader portraits and the vistas.
- **Art fixes made by the importer** (no redraws needed):
  - Gemini's backgrounds are lighter pinks than pure magenta, which left ghost squares behind clouds and a hill, and pink edges around many pieces. Both are fixed.
  - The `tree-broadleaf-3` smudge is removed automatically.
  - Clouds are made cool white.
  - Grass, rock, snow and water are evened out more.
  - The open sea no longer shows a repeating grid.
- **Still worth redoing (Nate):** the two pine clusters (`tree-conifer-1`, `-2`) still read as round bushes; tuning can't change shapes. Lower priority: the rock, snow and hills textures still have big built-in shapes (mostly hidden under mountains and hills).
- **A real freeze, found and fixed:** on the third or fourth turn the replay could lock the page up. The map was redrawing all its borders about 30 times a second during the replay. It now redraws only when something changes. Whole games now play to the end on laptop and phone.
- **Polish:**
  - The desktop Leader card fits, and the army panel's hint isn't clipped.
  - The round buttons show Nate's icons, with the Recruit count as a badge.
  - "Lock in" sits on a ribbon under the seal's star.
  - The phone replay bar stays on one line, and "1 troop" is no longer "1 troops".
- **Replay camera:** when a battle, fogged battle or fallen Leader happens off screen, the camera glides there (never zooming), holds, and glides back at the end. Skip, or moving the map yourself, stops it. For fogged events it aims only at the pulse.
- **Speed** (phone emulation, CPU slowed 4x, real art, this laptop's Intel GPU): the map appears in about 2.1 s (Embervale) and 2.2 s (Greatmarch). This laptop's Chrome holds every page, even a blank one, at 30 fps. With that cap lifted, panning runs at 215–315 fps at every zoom, so there's lots of room. Memory: 52–85 MB.
- **Private preview: uploaded, but not reachable yet.** Wrangler is logged in and `pnpm deploy:preview` uploaded the game. Cloudflare confirms there's no workers.dev address and no preview addresses, and the custom domain is attached with a certificate. But the domain's nameservers still have no `conquerra` record after 25+ minutes, so the address doesn't open for anyone (safe: the game isn't exposed). The lock check therefore couldn't confirm the Google sign-in yet. Nate needs to look in the Cloudflare dashboard (steps in the session summary), then run `pnpm check:preview`.
- 210 automated tests pass (12 new). Screenshots retaken: `docs/art/screens/`.

### Oct 4: Orchestrator review of session 6 (the preview is live)
- Checked the work: GitHub's checks pass, all of Nate's art is in, and the game looks like the Gilded Atlas we aimed for.
- **The preview is online and locked.** The missing DNS record turned out to be a delay: an hour later the `conquerra` record was in Cloudflare's DNS list and the address answered. The orchestrator checked it from the browser on Nate's computer:
  - without a sign-in, every page and file redirects to the Cloudflare sign-in, so nothing of the game loads
  - signed in as Nate (Google), the game loads
  - `conquerra.nkurtz.workers.dev` shows "nothing here", so there's no back door
- Small things for the next session: the army panel's bottom row (Recruit −, 12, +) is still cut off on desktop.
- Art for Nate to redo when he has time: `tree-conifer-1` and `-2` (still round bushes), then the rock, snow and hills textures.
- **Next:** Nate plays on his phone (sign in, install the app, a game with a 1-minute timer). That closes M2. Then session 7 starts M3.
- Six Claude Code sessions are done, so there's a fresh orchestrator prompt: `docs/prompts/orchestrator-03.md`.

### Oct 4: Nate's phone test, and the plan for M3
- **On Nate's phone:** the app installed fine and the timer locked his orders in when it ran out. But the installed app showed the **desktop layout** instead of the phone one.
- **Nate's new ideas, now decided:**
  - **Chained attacks:** win at B, and the same army can attack on from B in a later order that turn. No limit on hops, but each hop waits its turn in the order queue, so rivals can react in between.
  - **Amounts as shares:** send All, 3/4, 1/2 or 1/4 of the army (or "Just enough") rather than typing a troop number, because a chained army's size isn't known until its battle is over.
- **Plan:** session 7 fixes the phone layout, builds chaining and shares, and fixes the army panel's clipped row. Then M3 in this order: smarter bots and the map lab; generals and the Fallen; the Spoils and Fate card decks; diplomacy; spies and culture unlocks; a balance pass.
- Next prompt: `docs/prompts/claude-code-session-07.md` (run it locally).

### Oct 4: Claude Code session 7 (M2 wrap-up: phone layout, chained attacks, amounts as shares)
- **Phone layout:** the game used to pick the phone layout only from the page width. Chrome's "Desktop site" setting, or turning the phone sideways, reports a wider page, so a phone could get the desktop layout. Now a phone-sized touch screen always gets the phone layout, whatever width the page claims (tested for Desktop site, sideways and the installed app). **Settings → Layout** (Auto / Phone / Desktop) lets you force either, and it's remembered on the device.
- **Diagnostics view (hidden):** tap the version line in Settings or the lobby 5 times (or add `?debug=layout`). It shows what the phone reports and which layout it picked and why. **Copy all** copies it for pasting.
- **Updates reach the installed app:** it now checks for a new version when it opens, when you switch back to it, and every 30 minutes, then shows "Update ready".
- **Chained attacks:** an army that moved in or captured can push on from there in a later order the same turn. Each hop waits for its own turn in the round-robin, so rivals act in between. Every hop leaves 1 troop behind. If a hop fails, later hops from land you don't hold fizzle (or run their backup). Follow through is the automatic version and steps aside if you queue your own hop.
- **Amounts as shares:** moves and attacks send Just enough, All, 3/4, 1/2 or 1/4 of the army that's there when the order plays (an exact number is under More). A first attack starts on Just enough; a hop and a move start on All.
- **On the map:** after you queue an attack, its target shows a faint "≈18" (the army expected to arrive). Tap a neighbour of it to queue the next hop. Chain arrows show hop numbers ①②③, and a hop's odds say "estimate".
- **A typical turn is now 6 taps** (was 7). A turn with one chained hop is also 6.
- **Desktop army panel:** it grows up over the map instead of being cut off; the Recruit −/+ row shows in full.
- **Simulator (1,000 games each):** chaining shortens 4–6 player games by about a turn (4 players: 25.9 → 24.9 turns). Seats stay fair. Runaways (one player with half the map by turn 10) rise a little: 40% → 45% at 4 players, 24% → 27% at 6. 10-player games are still about 36 turns. Details and options: `docs/sim-results-m2-chaining.md`. No rules were changed for balance.
- 240 automated tests pass (30 new). Screenshots: `docs/art/screens/ui-chain-desktop.png`, `ui-chain-phone.png`, `ui-share-chips.png`, `ui-share-chips-phone.png`, `ui-diagnostics.png`, and `ui-desktop.png` (retaken).
- **Nate's phone check (after the deploy):** the installed app updated (version c20f39b). Its diagnostics showed the cause: Chrome's **"Desktop site"** mode was on, so the phone reported a desktop computer with a 980px-wide page on a 384px screen. The new check picked the phone layout anyway, but in Desktop site mode everything is drawn for a 980px page and shrunk to fit. Once Nate turned Desktop site off, the phone layout looked right. Queuing a chain on the phone worked, with hop numbers and the "≈" marker.

### Oct 4: Orchestrator review of session 7 (M2 is done)
- Checked the work: GitHub's checks pass, the scope held, and the screenshots show the chain (numbered hops, "≈" arrival markers), the share chips, and the desktop army panel no longer cut off. **M2 is done:** Nate has played full games against bots on his laptop and his phone.
- **Phone:** the tiny-looking menus and the main menu not filling the screen came from Chrome's "Desktop site" setting too. With it off, everything looks right. The game will show a one-line tip when it detects Desktop site.
- **Nate's calls:**
  - The survivors of a failed attack fall back and can't attack again that turn.
  - Runaways: no rule change for now. We'll look again after the smarter bots and in the balance pass.
  - 10-player games (about 36 turns): wait for the smarter bots and the balance pass. Conquest stays the lobby's suggestion for 8+.
  - **New idea: the fog lifts during the replay.** As your army takes a territory, you start seeing around it right then, so you can watch a chain push into the fog. Anything you see along the way goes into your "last seen" memory.
  - **The map builder is for players from the start** (not just Nate). That means saving, sharing and playing each other's maps, with automatic fairness checks. It still comes after online play.
- **M3 grows by one session:** 8 the fog lifts during the replay, plus smarter bots · 9 the map lab · 10 generals and the Fallen · 11 Spoils and Fate decks · 12 diplomacy · 13 spies and culture unlocks · 14 balance pass.
- Next prompt: `docs/prompts/claude-code-session-08.md` (run it locally).

### Oct 4: Claude Code session 8 (M3 start: the fog lifts during the replay, smarter bots)
- **The fog lifts during the replay.** What you can see is now worked out step by step through the turn. Take a territory and the fog fades off the land around it right then, so you can watch a chain push into land you couldn't see. Lose one and the land around it fogs over from that moment. Everything you saw along the way goes into your "last seen" memory ("Seen last turn" on the next turn).
  - **The replay rule, narrowed:** someone else's action shows in full only if you could see its land *at the moment it happened*. Land that only came into view later in the turn doesn't count any more (the old rule used "visible at the start or end of the turn"), so a few things that used to show now don't.
  - It's worked out from the turn's event log, the record the server will keep in M4. A test checks every replay event and every revealed territory against the real game at that moment.
  - On screen: the fog fades in about a third of a second, the replay ends exactly on the new turn's map, the camera follows a chain off screen (and your own battles beat a fogged pulse for its attention), and the turn report has "What came out of the fog".
  - Turn speed, measured back to back: 0.22 → 0.30 ms on average at 4 players, 0.53 → 0.67 ms at 10. Still well under a millisecond.
- **Captain bot, the new default** (Lobby → Bots: Recruit (easy) / Captain). It plays only from its own view and holds passes cheaply, gathers a real army before breaking through, lands where the far side is weak, finishes weakened rivals (one spearhead in the endgame), defends its capital, and chains on into the fog. The full list is in `docs/rules-reference.md` §13.
  - It wins **37%** of games against three Recruits (fair: 25%) and **77%** head to head.
  - All-Captain games: **4 players 24.0 turns, 6 players 25.0** (both on target now; were 24.9 and 26.0). 2 players: 22.3. 10 players got longer: 36 → 40.
  - **Runaways got more common** (one player on half the map by turn 10: 45% → 55% at 4 players, 27% → 46% at 6). No rules changed; options for Nate are in `docs/sim-results-m3-bots.md`.
  - Bots take about 3.5 ms a turn for nine Captains at 10 players (worst 27 ms, on a laptop running slow).
- **Desktop site tip:** if Chrome's Desktop site is on (a phone drawing a page much wider than its screen), a one-line tip in the lobby and the game says how to turn it off. You can dismiss it, and the phone remembers.
- 269 automated tests pass (29 new). Screenshots: `docs/art/screens/ui-replay-fog-1.png`, `-2.png`, `-3.png`, `ui-replay-fog-phone-2.png`, `ui-lobby-bots.png`, `ui-desktop-site-tip.png`.

### Oct 4: Orchestrator review of session 8
- Checked the work: GitHub's checks pass, the scope held, and the screenshots show the fog clearing around each capture during the replay, the lobby's new Bots row and the Desktop site tip.
- **Nate's calls:**
  - **Runaways:** Captain bots made early runaways more common (6 players: 27% → 46% of games with one player on half the map by turn 10). The fix is in the bots, not the rules: in session 10, Captains (and generals, which use the same brain) gang up on whoever is running away with the map, as people do. Rule brakes stay on file for the balance pass.
  - The smarter bot keeps the name **Captain**.
  - **The map lab lives on the private preview** (only Nate can sign in), so he can use it from his laptop. It's hidden at public launch.

### Oct 4: Nate's play test of session 8, and a new plan
Nate played a full game (against Recruit bots; Captains next). What he found, and what the orchestrator dug up:
- **An attack of 35 against 1 failed. That's a real bug.** The game worked out "about 1 loss" for the defender before rolling the luck, so a hopeless defender could survive by rounding. In 300 bot games, about 1 in 20 attacks with 8 times the troops or more failed. It's fixed first thing in session 9, with a test that a "guaranteed" attack always wins.
- **Recruits only landed in the capital or one other place.** That was the rule: recruit at your capital or a barracks. **Nate's call:** also anywhere in a province you hold completely. And you choose how many (All, 3/4, 1/2, 1/4 or an exact number).
- **Culture didn't seem to matter.** It didn't: a market earns about 4 times more per gold, and culture's other effects were invisible. **Nate's call: "loyal land".** Each level makes that territory defend about 5% better, on top of the protection and specialist unlocks, and the game shows and explains it.
- **You can't tell what's connected.** Some neighbours share only a sliver of border (Embervale has 8, Greatmarch 13, one almost a single point), and passes are drawn very narrow. Session 9 makes the map maker stop doing that, rebuilds both maps, and marks every neighbour when you select a territory.
- **Provinces aren't clear.** They get their own border style and a plaque: "Pinemark +3 · you hold 3 of 5".
- **Buildings look like ghosts.** They were drawn small, and see-through while being built. They'll be twice the size and stand on the ground like the capital.
- **Maps should be bigger and more imaginative** (islands, twin continents, a fantasy-shaped land), not one round blob. **Nate's call:** keep a 40-territory quick map; new maps of 60–120.
- **"The visuals need to be cleaned up and improved."** The orchestrator's review and the three-step plan are in `docs/08-visual-upgrade-plan.md`.

**New session order (Nate's call):**
- 9: play-test fixes and clarity
- 10: map lab, bigger maps and new shapes, art test bench
- 11: big visual upgrade (with a new art batch from Nate)
- 12: generals, the Fallen, and bots ganging up on a runaway leader
- 13: card decks
- 14: diplomacy
- 15: spies and culture unlocks
- 16: balance pass

Next prompt: `docs/prompts/claude-code-session-09.md` (run it locally). A fresh orchestrator prompt comes after session 9.

### Oct 5: Claude Code session 9, part 1 (stopped at the usage limit)
- **Done and pushed:**
  - **The combat bug is fixed.** Luck is now rolled on the full expected losses, so an overwhelming attack always wins: lopsided attacks that failed went from 5.3% to 0.
  - **Every order that didn't happen says which one and why**, in plain words. A failed attack says why the defence held ("They held: hills and a fort").
  - **Settings → Save this game** makes a small file that `pnpm sim --replay` plays back exactly.
  - **Recruiting:** at your capital, a barracks, or anywhere in a province you hold completely. You choose how many with the same chips as attacks, and every place you can recruit lights up. A typical turn is still 6 taps.
  - **Culture defends:** +5% per level. Half done: not yet tuned or shown on the map.
- **What the orchestrator found:** the jump in runaways comes mostly from the combat fix. Attacks finally work, so games are faster (4 players: 23.9 → about 19 turns) and more decisive (one player on half the map by turn 10: 54% → 80%).
- **Nate's calls:**
  - Runaways are a **bot strategy** problem, not an engine or chaining one. The bots should account for a player pulling ahead. The "gang up on the leader" behaviour moves up into session 9b, along with bots defending against a fast attacker.
  - **Game length in real time:** his game against Recruit bots took about 30 minutes, which is too short. His targets are **single player 45–90 minutes** and **a live online game 2 hours or more**. No rule change now: cards, generals, diplomacy, bigger maps and smarter opponents will all lengthen games. The sim write-ups will start estimating real time.
- **The rest of session 9 is one session, 9b**, for Nate's next usage window (his call): finish culture, bots that handle a runaway, the sim write-up, map clarity, buildings, then one deploy. It commits after every part, so nothing is lost if it's cut off.
- Next prompt: `docs/prompts/claude-code-session-09b.md` (run it locally).

### Oct 5: Claude Code session 9 complete (9 and 9b: play-test fixes, bots that handle a runaway, map clarity, buildings)
Session 9 stopped at the usage limit after the combat fix, plain-words "called off" lines, Save this game and province recruiting (see the entry above). Session 9b finished the rest in one go, committing after each part.
- **Culture ("loyal land"), tuned and shown:**
  - Each level makes that territory defend **6% better** (+30% at level 5), and raising it costs **3, 4, 6, 8, 10** gold (was 4, 6, 8, 10, 12).
  - The size of the bonus barely mattered in the sim; **where the Captain bought it was the problem.** It now buys only at its capital or a choke point it holds, with a rival army next door and enough troops there for the bonus to be worth the gold. Captains that buy culture now win **50%** against Captains that don't (was 37.7%): a fair buy, not a must-buy.
  - On screen: small gold laurels on the troop pill (one per level, Mid and Near). The card says "Culture 2: defends +12%, shrugs off 30% of unrest, +1 gold, unlocks Siege and Engineers in Old March", or "No culture yet: raising it costs 3 gold". The panel and the Culture button say what the next level adds.
- **Bots that handle a player pulling ahead** (they judge everything from their own view; the same rule for every seat):
  - **Gang up on a runaway leader:** a rival that looks to hold about 40% of the land (or far more than anyone else) becomes the main target; those fronts keep honest garrisons; no attacks on weaker rivals who are holding the leader off.
  - **Turn on a fast attacker:** bots now see what their seat watched in last turn's replay. A rival that took 2+ of their territories becomes the target (its chain is thinly held), and they recruit and march troops to that front instead of grabbing neutral land nearby.
  - A first version that just dug in cut runaways too, but Recruit bots then beat the Captain far more often, so it was dropped. The Captain is now stronger against Recruits than at the start of the session (33.5% at a table of 1 Captain + 3 Recruits; 92% head to head).
- **Simulator** (1,000 games each; `docs/sim-results-m3-fixes.md`):
  - Average turns, session 8 → now: 2 players 22.3 → 19.3, 4 players 24.0 → 20.8, 6 players 25.0 → 27.7, 10 players 39.8 → 35.1.
  - **Real time, roughly** (1.5 minutes a turn plus half a minute of replay): single player about 39 / 42 / 55 / 70 minutes; online with the 5-minute timer up to 1.8 / 1.9 / 2.5 / 3.2 hours. 4-player games are still a little under Nate's targets.
  - **Runaways** (4 players): one player on half the map by turn 10: 82% at the start of the session → 38% now. Part 2's bots account for about a third of that (49% → 38% on the same maps); the rebuilt Embervale for the rest (its 4-player capitals start a border closer). The leader at halfway still wins 83% of the time, and 20% of games are comebacks.
  - Seats are fair; lopsided attacks that failed: 0 of about 330,000.
  - Recruits: about a quarter of all troops are now recruited in fully held provinces.
- **Map clarity:**
  - **No hairline borders:** the map maker now gives the corner to a third neighbour when two territories barely touch (they stop being neighbours), or widens the contact if it can't. Embervale's shortest border went from 4.4 to 24 map units, Greatmarch's from 0.6 to 22.9 (a typical one is about 90). `checkMap` now rejects any map with one.
  - **Passes are wide:** 36–45 units on Embervale (were 12 and 23) and 29–50 on Greatmarch (were 9–31), each with a road and a gate symbol you can see at Mid zoom. Also a `checkMap` check.
  - **Both maps rebuilt** (map maker v2) from the same seeds: same coasts, lakes, islands and ranges, a few more passes, and **new place names** (names now come from their own random sequence, so they won't change again when shapes do). They play about the same length.
  - **Select a territory and every neighbour is marked:** a gilded chevron across the shared border (red core: you'd attack, blue: you'd move), blue ripples for a river, a stone arch for a pass, and its sea lanes light up.
  - **Every territory edge** is a crisp ink line with a light halo, at every zoom. **Province borders** are a gilded double line, and each province has a plaque: "Old March +4 · you hold 4 of 6" (just "+4" if you hold none of it), at Far and Mid. Plaques and province names never cover an army.
  - **Tactical view** really is flat House colours. The old screenshot looked painted because the capture script clicked "fit the whole map" instead; it's fixed and retaken.
- **Buildings stand on the map:** about twice the size, on a ground shadow like the capital's, and they step aside so the army marker never covers them. Being built: a wooden scaffold and a slightly washed-out building (no see-through ghost), and the pill's icon stays solid with a small hourglass.
- **Plainer panel and card:** the army panel's grey line is now chips ("Plains, defends ×1", "+2 gold a turn", "Old March +4 if you hold all 6 · you hold 3"), and the card is one plain sentence per row with its icon ("Held by Lady Morwen", "12 troops", "Fort, being built (ready next turn)"). Checked on a 384 px phone.
- **Deployed** to the private preview (version `7af998a7`); the lock check passed.
- 302 automated tests pass. Screenshots (`docs/art/screens/`): `ui-recruit-sites.png` (+ `-phone`), `ui-culture-card.png`, `ui-culture-pips.png`, `ui-report-called-off.png`, `ui-links-pass.png`, `ui-links-sea.png`, `ui-provinces-mid.png`, `ui-provinces-far.png`, `ui-buildings-mid.png`, `ui-buildings-near.png`, `ui-buildings-board-staged-mid.png` / `-near.png` (all four built and being built, staged by editing the page's view, since only forts are ever "being built" between turns), `ui-army-panel.png` (+ `-phone`), `ui-territory-card.png` (+ `-phone`), `ui-tactical.png`, `embervale-tactical.png`, and the map previews `docs/maps/embervale.png`, `greatmarch.png`. `pnpm ui-check clarity` retakes them.
- **Nate's play test:** asked to play after the deploy (results below once he has).

### Oct 5: Orchestrator review of session 9
- Checked the work: GitHub's checks pass, all five parts landed, and the screenshots look right:
  - province plaques with "you hold 4 of 6"
  - chevrons on every neighbour, with pass gates
  - buildings standing on the map
  - a truly flat Tactical view
- **Nate's calls:**
  - The rebuilt Embervale's closer start (4-player capitals 3 borders apart, was 4) is fine: it's the quick map, and the bigger maps give more room.
  - **Game length is measured in turns, not minutes** (minutes are hard to judge with bots), and **games may run up to 30–40 turns**. This replaces the 15–25 target.
- Still to come: Nate's play test of session 9.
- Nine Claude Code sessions are done, so there's a fresh orchestrator prompt: `docs/prompts/orchestrator-04.md`.
- Next prompt: `docs/prompts/claude-code-session-10.md` (run it locally): bigger maps in new shapes, the map lab, the art test bench, candidate maps.

### Oct 5: Claude Code session 10 (M3: bigger maps in new shapes, the map lab, the art test bench)
No new art had arrived and Nate's session 9 play test isn't in yet, so there was nothing to fix first. All four parts are done, each committed and pushed.
- **New land shapes** (map maker): one continent (as before, and still the default), an **archipelago** (every island joined by a sea lane), **twin continents** (with sea lanes and sometimes a narrow land bridge), land ringing an **inland sea**, a **crescent**, and a **silhouette**: the land grows inside a drawn outline. Three come built in: a dragon, a shield and a crown. Nate can add his own by drawing a black-and-white picture (`pnpm --filter @conquerra/mapgen mask picture.png wolf "The Wolf"`).
  - **Sizes 40 to 120 territories**, with provinces scaled to match (about 4.5 territories each) and fair capitals for every player count a map claims.
  - **Embervale and Greatmarch are exactly the same** (a test checks, byte for byte).
  - Two fixes along the way: a stuck "hairline border" now joins the mountain range or becomes a cove, instead of throwing the map away (big maps hit this a lot); and the capital search does the same work in half the time.
  - **Making a map:** 60 territories 0.5–3 s, 100 territories 1.5–5 s, 120 territories 1.5–20 s (crescents and big archipelagos need the most tries). The browser is about as fast as the command line.
- **The map lab** at `conquerra.overconfidenceonline.com/?lab=maps` (behind the same sign-in, never linked from the lobby):
  - pick a shape, size and seed, or start from Embervale or Greatmarch; every setting has a plain label
  - it makes the map in the background, saying how long it took and why each earlier try failed
  - it shows the map with the game's own painting, at Far, Mid and Near, with Tactical view and toggles for names, choke points and capitals (for any player count)
  - the checks in plain words, a fair-capitals table, a territory-size chart
  - **Sim this map**: a few hundred Captain games with a progress bar, showing length, seat wins, runaways and where the battles happen
  - a **seed gallery** (12 at a time), and Copy recipe, Paste recipe and Save image
  - A link to the lab always carries the full recipe, so it opens exactly the same map.
  - **The game itself didn't get heavier:** what loads before the lobby went from 442.4 to 442.7 KB. The lab loads only when opened. For the public launch, build with `VITE_LABS=off` and the lab isn't in the game at all.
  - The lab's pieces each take a finished map, ready for the player map builder after M4.
- **Big maps on a phone** (emulated mid-range phone, CPU slowed 4x): a 120-territory map paints in 6.1–7.1 s (Greatmarch: 6.0 s measured the same way) and pans at 46–81 frames a second. It already paints at lower detail on big maps, so nothing needed changing.
- **The art test bench** at `?lab=bench` (it replaces `?lab=houses`), drawn by the game's own renderer at true size:
  - every House on every ground
  - every pair of grounds meeting, plus coasts and a river through hills
  - every tree, peak, hill, village, town, building (built and being built) and figure on every ground
  - the map symbols (neighbour chevrons, pass gate, plaques, culture laurels)
  - a "redo list" sheet: the rock, snow and hills textures with their big repeating shapes, and the pines that look like bushes
  - `pnpm map-check bench` saved 20 "before" pictures for session 11 in `docs/art/screens/bench/`.
- **Six candidate maps** for Nate (`docs/maps/candidates.md`, one Far picture each, 200 Captain games at each end of the suggested player range):
  - The Shattered Isles (archipelago, 60, 4–6 players): 28 / 37 turns
  - The Twin Realms (twin continents, 80, 4–8): 24 / 30
  - The Moon Coast (crescent, 80, 4–8): 27 / 31
  - The Ringsea (inland sea, 100, 6–10): 36 / 39
  - The Crownlands (crown, 100, 6–10): 35 / 38
  - Wyrmland (dragon, 120, 6–8): 32 / 37. Wyrmland needed 2 mountain ranges instead of 4; with 4 it ran 44–45 turns.
  - All pass every check, and none is in the lobby until Nate picks.
- **What shape does to length:**
  - Mountain passes are the biggest lever: fewer passes, shorter games.
  - Two halves or a long thin land end sooner (Twin Realms 9 turns shorter than a plain continent at 4 players).
  - Islands make 6-player games much longer (+12 turns).
  - At 10 players, 100-territory maps land inside 30–40 turns; 120-territory maps run 41–45.
- The simulator's core is now shared by `pnpm sim`, the lab and the candidate script (`packages/simcore`). `pnpm sim` reports the new target (within 40 turns, and inside 30–40).
- 337 automated tests pass (35 new). Deployed to the private preview (version `fcee6083`); the lock check passed, including `/?lab=maps` and `/?lab=bench`.
- **Screenshots** (`docs/art/screens/`):
  - the lab: `lab-overview.png`, `lab-checks.png`, `lab-gallery.png`, `lab-sim-running.png`, `lab-sim.png`
  - one Far view per shape: `shape-continent.png`, `shape-archipelago.png`, `shape-twinContinents.png`, `shape-crescent.png`, `shape-inlandSea.png`, `shape-crown.png`, `shape-dragon.png`, `shape-shield.png`
  - the bench set in `bench/`, and big-map phone numbers in `perf-big.json`
- **Nate's check of the lab:** asked after the deploy (his notes and picks go below once he's tried it).

### Oct 5: Orchestrator review of session 10
- **Checked the work:**
  - GitHub's checks pass on every commit, all four parts landed, and the engine and the existing maps didn't change.
  - Re-ran the most surprising number: on the Twin Realms, 4-player games take 24.4 turns, against 34.3 on a plain continent of the same size. It matches.
  - Looked at the Far view of every shape, the lab and the bench pictures. The isles, the twin continents, the crescent and the ring look like real places, and the crown reads well enough. **The dragon doesn't read as a dragon** (it looks like a lumpy continent).
  - One small bug: the bench's redo sheet cuts off its "Trees at 4x" row. It's fixed in session 11.
- **Nate's calls:**
  - **All six candidates become official maps:** the Shattered Isles, the Twin Realms, the Moon Coast, the Ringsea, the Crownlands and Wyrmland.
  - **The dragon:** Gemini draws a chunky black dragon outline in the next art batch, and session 11 rebuilds Wyrmland from it.
  - **10-player games may use 120-territory maps** even though they run about 41–45 turns. Wyrmland is suggested for 6–10.
  - **Mountain-range defaults stay as they are.** Range counts are tuned map by map (Wyrmland keeps 2).
- **Still to come:** Nate's play test of session 9, and his look at the map lab.
- **Next:**
  1. **Art batch 3** (about 20 images): Nate runs `docs/prompts/gemini-art-session-03.md` in a Claude chat that drives Gemini. It covers the redone pines and the hills, rock and snow textures, the dragon outline, mountain ridges, sea cliffs, a pass gate, scaffolding, a wooden bridge, four landmarks and a plaque frame. The list is at the end of `docs/art/asset-list-and-prompts.md`.
  2. **Session 11** (`docs/prompts/claude-code-session-11.md`, run it locally): the new art on the map, the six new maps in the lobby, the renderer pass (House colours, forests, a softer Far view), a roomier desktop layout, and before/after pictures on the bench.

### Oct 5: Claude Code session 11 (M3: the big visual upgrade, and six new official maps)
**Art batch 3 hadn't been made yet** (nothing new in `art/incoming/` or Downloads), so every new piece was built and placed by its rule, and keeps today's drawing until `pnpm art:import` brings the art in. There were no play-test notes to fix first. All five parts are done, each committed and pushed.
- **Six new official maps.** The Shattered Isles, the Twin Realms, the Moon Coast, the Ringsea, the Crownlands and Wyrmland are in the lobby (eight maps), with recipes exactly as in `docs/maps/candidates.md`.
  - **Wyrmland keeps today's hand-drawn dragon** (seed `mask-120-2`), suggested for 6–10 players. It gets rebuilt from Gemini's outline when batch 3 arrives (the steps are in `docs/07-map-tooling.md`).
  - Wyrmland, 200 Captain games each: **6 players 32.9 turns** (84% within 40), **8 players 36.9** (75%), **10 players 39.7** (61%; 6% reached the 60-turn cap).
  - The Crownlands came out with no rivers (the crown's land never gives one a long enough downhill run). It passes every check, it's just drier.
  - **Each map loads only when a game on it starts**, so the game's start-up didn't grow: 442.6 KB before, 445.7 KB after the whole session (+3.1 KB). Embervale and Greatmarch are cached for offline play as before; the newer maps are cached the first time they're played.
  - Tests check every official map is exactly what its recipe makes and passes the checks, that Embervale and Greatmarch are unchanged, and that the lobby lists eight maps.
- **Two small fixes:** the bench's redo sheet now shows its "Trees at 4x" row, and a province plaque at the map's edge slides in to stay on screen (it was cutting off the dragon picture's left side).
- **New painting, placed by rules from the map data** (`scenery.ts`; seeded from the map, no map file changes, tested on all eight maps):
  - **Mountain ranges read as ranges:** chains along each range's middle line, wide ridges where it runs across the screen, stacked peaks where it runs up and down, and every pass left open with its road. Today's peaks stand in for the ridge art.
  - **A gatehouse on every pass road** (the gate symbol then shows at Far).
  - **Sea cliffs** on straight, high, open stretches of coast, never by a sea lane's landing, and **a soft painted surf line** on every coast (that part is already visible).
  - **Bridges at river crossings:** stone ones now (there were none before), wooden ones on streams and farmland once that art is in.
  - **A few landmarks per map** (about one per 15 territories): lighthouses, windmills, standing stones and ruins, never on a capital, a building site, a pass, or under a pill or plaque.
  - The scaffold art over buildings being built, and the plaque frame under province plaques.
- **The painting pass:**
  - **House colours never muddy the ground:** the tint is now painted by the map's shader, which greys the ground's own colour and then lays the House colour on at its own brightness. Gold stays gold on grass, and red stays red on forest. Every House is checked on every ground on the bench.
  - **Forests:** pines higher up and in the north, broadleaf lower and in the south, with a few open glades.
  - **A softer, more painterly Far view** (one painted atlas), with borders, pills and plaques still crisp.
  - **Tactical view** checked: truly flat House colours.
- **Desktop menus:** one compact panel for the selected territory (bottom left, only as tall as its contents), the right column for the players and your Leader, and a dock (minimap and orders) that folds to a slim bar. The seal and the timer always show. There's now one type scale, and the round buttons' labels are bigger. **The phone is unchanged: a basic turn is still 6 taps on a 384 px screen.**
- **Phone performance** (emulated mid-range phone, CPU slowed 4x, measured back to back with the old version): Greatmarch paints in **3.88 s (was 3.64)**, and the 120-territory maps in **3.49–3.74 s (were 3.42–3.69)**. Panning runs at **54–56 frames a second, unchanged**. To keep it there, the scenery is worked out while the art downloads.
- **Pictures:**
  - before/after side by side: `docs/art/screens/compare/` (every bench shot, plus `greatmarch-far/-mid` and `ringsea-far/-mid`)
  - the "after" bench set: `docs/art/screens/bench-after/`
  - the game: `ui-desktop.png`, `ui-desktop-selected.png`, `ui-selected-panel.png`, `ui-desktop-folded.png`, `ui-phone.png`, `ui-phone-small.png`
  - the dragon: `shape-dragon.png` (still today's dragon)
- 432 automated tests pass. Deployed to the private preview (version `2fda17a7`); the lock check passed.
- **Asked Nate to play on the preview** (Ringsea on his phone, Twin Realms on his laptop, the lobby's eight maps, one game on Wyrmland). His notes go below once he's played.

### Oct 5: Orchestrator review of session 11
- **Checked the work:**
  - All five parts landed, the engine and bots didn't change, and Embervale and Greatmarch are unchanged.
  - Re-ran 10-player games on Wyrmland: 40.9 turns (session 11 said 39.7), and about 6% reach the 60-turn cap. It matches.
  - Looked at the before/after pictures: gold no longer turns mustard on grass, the map has more room on desktop, and the Far view is a little softer. Without batch 3 the change is modest.
  - **A failing test on `main`:** session 11's "Ideas for batch 4" list at the end of the art file was counted by a test that checks the art list against the game, so GitHub's checks failed. The list moved under "Tier 3: later" in the same file, and all 432 tests pass again. (Two other red marks were GitHub failing to start, not real failures.)
- **For Nate to look at when he plays:** at Mid zoom a House's colour now shows mostly along the edges of its land (the whole land is filled at Far), and the new desktop panel's last row sits right at the bottom of the window.
- **Nate's calls:**
  - **Session 12:** art batch 3 first, then **generals, captured generals and the Fallen**, as planned. If it runs short, the Fallen moves to session 13.
  - **Generals:** Nate likes both ideas. Session 12 builds **a general that leads one army** with a standing instruction (Hold here, Defend this border, Push toward, Raid a rival). **"Govern this province"** (keep a share of its income to build it up) is on file as a later instruction, planned for session 15.
  - **Captured generals command only:** no +20% fighting bonus, and you keep at most 2.
  - **The Crownlands gets another try for rivers:** new seeds of the same crown, shown to Nate before it changes.
  - The desktop dock keeps today's behaviour (starts open, remembers your choice).
- **Still to come:** Nate's play tests of sessions 9 and 11, his look at the map lab, and art batch 3.
- **Next:**
  1. Art batch 3 in Gemini (`docs/prompts/gemini-art-session-03.md`). **Do this before session 12.**
  2. Session 12 (`docs/prompts/claude-code-session-12.md`, run it locally).

### Oct 6: Art batch 3 made in Gemini
- A Claude chat drove Gemini and made all 20 pieces; they're in `art/incoming/`, ready for session 12 to import:
  - redone pines and hills, rock and snow textures (the old ones are in `_old/`)
  - the dragon outline for Wyrmland (one solid shape with an S-neck and a curled tail; it reads as a dragon at 160 pixels)
  - three ridges, three sea cliffs, a pass gate, scaffolding, a wooden bridge, four landmarks and the plaque frame
- **Compromises:**
  - The pines are steep-angle fir clusters rather than straight overhead; they read as pines at game size.
  - The new hills texture is slightly finer at the top, and the rock texture has faint dusty streaks.
  - A paler chalk cliff is there as an alternative (`_review/_alt/cliff-3-chalk.png`).
- Lessons for prompting Gemini are recorded in `docs/art/asset-list-and-prompts.md`. The big one: Gemini fakes "seamless" textures by repeating a small patch, so we ask for a vast scene and crop.
- Next: session 12 (`docs/prompts/claude-code-session-12.md`).

### Oct 6: Claude Code session 12 (M3: art batch 3 in, generals, captured generals and the Fallen)
All five parts are done, each committed and pushed. There were no play-test notes to fix first.
- **Art batch 3 is in, all 19 pieces.** Nothing kept today's drawing: pines, hills/rock/snow textures, ridges, sea cliffs, the pass gatehouse, scaffolding, the wooden bridge, four landmarks and the plaque frame.
  - **Tuned on the bench:**
    - the scaffold is sized to the building (it stood over a capital);
    - landmarks stay inside one territory (a windmill sat where three borders meet).
  - **Worth another go in batch 4** (in the art file, under Tier 3):
    - the hills texture looks like brown dirt at Near;
    - the new pines are bluer than the broadleaf trees;
    - a lower scaffold would show the building through it;
    - the wooden bridge is small and dark.
  - **Pictures:** before/after in `docs/art/screens/compare/`; the new bench set in `bench-after/`.
- **Desktop panel fix:** at 1440×900 the selected-territory panel faded out its own last row, because the frame's corner pieces hang 5 px below it. Fixed.
- **Wyrmland and the Crownlands re-seeded (Nate's OK):**
  - **Wyrmland** grows into Gemini's dragon, seed `mask-120-6`, now suggested for 6–8 players. Games run longer: 6 players 37.3 turns (was 33.0), 8 players 38.5 (36.7), 10 players 41.9 (39.2).
  - **The Crownlands** (`mask-100-9`) now has 5 rivers. 6 players 32.9 turns (was 35.4), 10 players 39.3 (38.0).
  - The other six maps are unchanged. Pictures: `docs/maps/session12/` and `docs/art/screens/s12-wyrmland-far.png`, `s12-crownlands-far.png`.
- **Generals:** your Leader can take a standing instruction (Hold here, Defend this border, Push toward a place, Raid a rival).
  - **How it works:**
    - It writes its army's orders each turn with the Captain's brain, from your view only.
    - It never spends gold.
    - Its orders sit at the top of your queue with its portrait.
    - Giving its army an order of your own takes control back for the turn.
  - **On screen:** select its land, then **Command**: 3 taps at most. **The basic turn is still 6 taps** on a 384 px phone.
  - **Sim** (one general seat against Captains, from turn 6): Hold, Push and Raid win about as often as a plain Captain; Defend wins less (it parks the army on a border).
  - **Dumb things found and fixed:** it emptied the capital, walked into stronger armies, and sent a lone Leader to march.
  - The Captain plays exactly as before (checked over 12,187 orders).
- **Captured generals:** knock a player out and their Leader joins you at your capital. It commands only: no +20% and no timing tricks. You keep two, it's gone for good if its land falls, and its portrait shows on its army.
- **The Fallen:** knocked-out players earn Influence and spend it on Plague, Storm, Uprising, Mercenaries and Famine.
  - **Caps:** no capitals, nobody knocked out, one event per player per turn, cooldowns, and culture protects.
  - **What they see:** who holds what, with no troop numbers.
  - **Tuning:** the first numbers made 6-player games 10 turns longer, so I tuned them down. All numbers are in `rules.fallen`.
  - **500 games each, without → with the Fallen:**
    - 4 players: 20.8 → 21.0 turns, comebacks 19 → 20%
    - 6 players: 27.7 → 29.8 turns, comebacks 37 → 41%
    - 10 players: 35.2 → 38.3 turns, comebacks 52 → 55%
  - **Risk:** at 10 players, games within 40 turns drop from 79% to 65%.
  - Details: `docs/sim-results-m3-generals.md`.
- **Rules:** `docs/rules-reference.md` §14–16.
- **Screenshots** (desktop and 384 px phone) are in `docs/art/screens/s12-*.png`:
  - the Command panel
  - the queue with a general's orders
  - a captured general
  - "You are one of the Fallen" and the Fallen panel
  - a plague in the replay and the report
- **Tests and deploy:** 488 automated tests pass. The start-up bundle is 469.6 KB (was 445.7). Deployed to the private preview (version `b9d9ac0d`); the lock check passed.
- **Asked Nate to play on the preview:**
  - Twin Realms on the laptop with a Push general
  - Ringsea on the phone with a captured general
  - some Fallen events
  - the new art and the two maps
  - how many turns each game took

  His notes go below once he's played.

### Oct 6: Orchestrator review of session 12
- **Checked the work:**
  - GitHub's checks pass on the last commit (two in-between failures were fixed within the session).
  - Re-ran the Fallen at 6 players: 27.9 → 29.7 turns, matching session 12's 27.7 → 29.8.
  - The pictures look right: real pines, Wyrmland clearly a dragon (especially on the minimap), the Crownlands with 5 rivers, and clean Command, queue and Fallen screens.
  - A small polish item: the Fallen screen still shows gold in the top bar.
- **Nate's new ideas (captured in `docs/04-design-additions.md` §2 and §10, and slotted into the plan):**
  - **Single-player pause and saved games:** the first part of session 13.
  - **Multiplayer pause by vote** (one asks, the rest agree or decline): M4.
  - **Tutorials** (short games already in progress that teach one thing: chaining, recruiting, culture, buildings, cards, treaties) and **scenarios:** before the public launch (M5), built on saved games.
  - **Bots with strong logic for accepting or declining treaties:** a requirement for session 14.
- **Nate's calls:**
  - The Fallen stay as tuned (about +3 turns at 10 players, for more comebacks); revisit in the balance pass.
  - The Fallen keep their own event menu; Fate events reuse the same engine.
  - Wyrmland is suggested for 6–8 players.
- **Twelve Claude Code sessions are done,** so there's a fresh orchestrator prompt: `docs/prompts/orchestrator-05.md`.
- **Still to come:** Nate's play tests of sessions 11 and 12 (generals, captured generals, the Fallen, the new art).
- **Next:** session 13 (`docs/prompts/claude-code-session-13.md`, run it locally).

### Oct 6: Claude Code session 13 (M3: pause and saved games, the Spoils and Fate decks)
All four parts are done, each committed and pushed. There were no play-test notes from sessions 11 or 12 to fix first. Small polish: the Fallen's top bar now shows Influence instead of gold.
- **Pause (single player):** with a timer on, a round button next to it stops the clock and the timer reads "Paused". You can keep planning while paused (the map dims a little); nothing locks in until you resume. Without a timer there's no button. Pause is a host action, so M4's pause by vote can wrap it.
- **Saved games:**
  - The game saves itself at the start of every turn's planning. The lobby shows **Continue** (map, players, turn, when).
  - Settings → **Save game** (3 slots, each with map, players, turn and date, or **Save to a file**) and **Load game** (the autosave, a slot, or **Load a file**).
  - **The format, in plain words:** a save is now a snapshot of the game as it stands, with a version number, instead of a list of every turn's orders, so it keeps loading after the rules change. When the game's own shape changes, a small built-in update brings old saves up to date; anything else says plainly why it can't load. A save made at the start of this session is loaded by the tests, so future sessions keep it working.
  - Save files still play back move by move with `pnpm sim --replay` (old "Save this game" files too).
  - Saves stay on the device. A private window or a full disk gets a plain message, and the game goes on.
  - Queued orders you hadn't locked in aren't saved: Continue starts that turn fresh.
- **The Spoils deck:** a card at the end of any turn you took land (one a turn), marked Sword, Tower or Laurel.
  - Three alike or one of each turn in for a windfall: Swords 6 troops at your capital, Towers a fort + 1 troop, Laurels +1 culture on up to 3 territories in a province, one of each 3 troops + 5 gold. **Tuned down** from the first numbers (8 troops, fort + 3, 4 troops + 6 gold), which made games about 3 turns longer.
  - A small card stack on your Leader card (by the map buttons on a phone): tap it, then a set, **2 taps**. At 5 cards it glows red and the sensible set is already first in your queue.
  - Others see only how many cards you hold.
- **The Fate deck:** everyone draws one card a turn as the turn ends, so it's in the report when you plan (no tap).
  - About 7 in 10 are events landing anywhere on the map (14 cards: harvest, wandering band, pilgrims, master masons, hidden hoard, veterans, flooded ford, rockslide, squalls, fire, fever, blight, plague, uprising).
  - About 3 in 10 are missions for you (10 cards), shown on your Leader card with their deadline. Tap one to light up its target.
  - Caps: never a capital, never knocks anyone out, one Fate event per territory a turn, and culture protects. Because Fate lands between turns, it can never make a "guaranteed" attack fail.
  - Under fog you see "something stirs in Northreach".
  - Lobby switch: **Fate deck On/Off** (on by default). The Fallen keep their own menu.
- **Bots:** the Captain turns sets in where they help (a fort on its hottest front, culture where it holds), and gives missions a modest pull, never chasing one it can't win.
- **Sims (500 games each, no decks → both decks):**
  - **Length:** 4 players 21.0 → 22.9 turns, 6 players 29.8 → 31.0, 10 players 38.3 → 39.6.
  - **Runaways:** unchanged. Comebacks: 20 → 23%, 41 → 42%, 55 → 51%.
  - **Decided by the decks? No:**
    - the winner takes the lead on a Spoils turn as often as chance says;
    - it gets fewer good Fate events than its land would draw;
    - its net Fate luck is under 1 event a game.
  - Details: `docs/sim-results-m3-cards.md`.
- **Taps:** a basic turn is still 6 taps on a 384 px phone; Command is still 3.
- **Start-up bundle:** 469.6 KB → 489.9 KB (gzip 144.8 → 150.8).
  - The decks' rules and wording, saved games and the new lobby added about 35 KB.
  - Loading the Save/Load dialog, the cards sheet, the knocked-out screens, "keep two generals" and the Command menu only when first needed took 14.5 KB back out.
- **Rules:** `docs/rules-reference.md` §3 (pause), §17 (saved games), §18 (Spoils), §19 (Fate).
- **Screenshots** (desktop and 384 px phone) are in `docs/art/screens/s13-*.png`:
  - Continue in the lobby, and the save and load slots
  - the paused timer
  - the Spoils hand with a set ready
  - a mission on the Leader card with its target lit
  - a Fate event in the replay and the report
- **Tests and deploy:** 556 automated tests pass. Deployed to the private preview (version `78afdff9`); the lock check passed.
- **Asked Nate to play on the preview** (laptop: pause, close, Continue, slots; phone: Spoils and a mission; do Fate events feel fair; how many turns). His notes go below once he's played.

### Oct 6: Orchestrator review of session 13
- **Checked the work:**
  - GitHub's checks pass on all five session 13 commits, including the last one (`1f69398`).
  - Re-ran 4 players with both decks (500 games): 22.9 turns, 97.6% within 40, "winner took the lead on a set turn" 28% vs 27% by chance, winner's good Fate events 58% vs 60% of the land. All match session 13's numbers exactly.
  - The screenshots look right: Continue in the lobby, the save and load slots, the paused timer, the Spoils hand, a mission on the Leader card, Fate in the replay and the report.
  - One small layout fault: on a phone, the "Save to a file" button squeezes its label into a narrow column next to its explanation. Fixed in session 14's Step 0.
- **Nate's calls:**
  - **Spoils go back to the bigger rewards:** three Swords 8 troops, three Towers a fort + 3 troops, one of each 4 troops + 6 gold (Laurels unchanged). Games run about 1–2 turns longer; the balance pass looks at length.
  - **Continue keeps the orders you'd queued** but hadn't locked in, so a phone closing the tab doesn't cost a planned turn.
  - **The first Fate draw comes later:** at the end of turn 3 (a number in `packages/content`), so the opening turns stay quiet.
- **Nate's calls on diplomacy (session 14):**
  - **All four kinds of deal in the first version:** truces (named borders, a province, or everywhere between you; for some turns or until a player is knocked out), trades (gold, land, or gold paid over several turns), joint wars ("you hit X, I hit Y") and right of passage.
  - **Deals are public:** everyone sees who has a deal with whom; the terms of trades stay private.
  - **Both kinds of promise:** handshake deals (free, breakable, with an Oathbreaker penalty) and binding pacts (cost gold up front; the game blocks the attack).
- **Still to come:** Nate's play tests of sessions 11, 12 and 13.
- **Next:** session 14 (`docs/prompts/claude-code-session-14.md`, run it locally). Right of passage is its last part; if the session runs short, it moves to session 15.

### Oct 6: Claude Code session 14 (M3: Nate's calls on the decks, then diplomacy)
Parts 1–4 are done, each committed and pushed. **Right of passage's moves (Part 5) move to session 15**: the card shows "soon", and passage deals are already stored, so saves won't change again. There were no play-test notes from sessions 11–13 to fix first.
- **Nate's three calls (Step 0):**
  - **Spoils are back to the bigger rewards:** three Swords 8 troops, three Towers a fort + 3, one of each 4 troops + 6 gold.
  - **The first Fate draw comes at the end of turn 3,** so nothing from Fate happens before turn 4's planning.
  - **Continue keeps the orders you'd queued.** They're saved in the background a moment after you stop changing them, and at once when the tab closes or the phone puts it away. Tested in the browser: queue, reload, Continue, same orders.
  - **Phone fix:** "Save to a file" and "Load a file" now put their explanation under the label.
  - **Deck sims:** games run about 1 turn longer than with session 13's smaller numbers (4 players 23.6, 6 players 31.8, 10 players 40.8 turns). The decks still don't decide games. Details are at the top of `docs/sim-results-m3-cards.md`.
- **Diplomacy, as built:**
  - **Making a deal:**
    - Tap a rival in the Players panel, then **Propose a deal**. A plain truce is ready to send: **4 taps** on a phone.
    - The bot answers at once with one plain reason ("I need my army in the east."), or sends a counteroffer with the changes marked.
    - Offers to you come as a small toast as planning starts, with the bot's reason for asking. Accepting takes **1 tap**.
  - **The cards:**
    - **Truce:** everywhere, a province, or borders picked on the map. 2–8 turns, or until someone is knocked out.
    - **Trade:** gold now, gold each turn, or land picked on the map. The giver's troops step back and one of the receiver's moves in.
    - **Joint war:** against the same rival, with peace between the partners while it lasts.
  - **Handshake or binding:**
    - **Handshake:** free. Breaking it brings a public Oathbreaker mark, a fine and unrest, scaled by the deal's size. A truce everywhere for 3 turns is about 8 gold.
    - **Binding:** costs gold up front, and the game won't let either side attack across it.
  - **What shows where:**
    - The Players panel shows a mark for each deal (a seal on a binding one), its turns left, and the Oathbreaker mark.
    - Truce borders are drawn on the map as a white stitched band, with gold studs on a binding pact.
    - An attack across a handshake truce warns what breaking it costs.
    - The report and replay say when deals start, end and break.
  - **The re-confirm rule:** both sides must confirm in the same planning phase, and the deal starts before any move. Unconfirmed offers lapse, and an attack between the two voids them.
  - **Saves and replays:** offers and answers are orders, so a saved game and `pnpm sim --replay` reproduce exactly. A game saved before diplomacy carries on with no deals, and the session 13 save still loads.
- **The bots:**
  - Every answer comes with its strongest reason: fronts, who's ahead, what the deal costs, or trust ("You broke our truce at Old March.").
  - They never help a runaway (or the clear leader as far as they can tell), and they always join a war against one.
  - **Trust** comes from the record of how past deals ended, so it's part of every save.
  - The Captain proposes joint wars against a runaway, truces on fronts it can't afford, and land-for-gold trades. Bots also make deals with each other.
  - They keep their word, except that the Captain breaks a handshake deal for a capital it's sure to take, and says so.
  - The Recruit takes a truce only when it's weaker and never offers trades.
  - With diplomacy off, the Captain plays exactly as before (a test checks it).
- **Acceptance rates** on offers sorted beforehand: good **94%**, neutral **26%** (and 70% countered), bad **2%**.
  - The bad ones it accepts are mostly truces from a runaway it can't see under fog.
- **Sims (500 games, diplomacy off → on):**
  - **Length:** 4 players 23.6 → 27.8 turns, 6 players 31.8 → 36.4, 10 players 40.8 → **47.4** (only 27% of 10-player games end within 40).
  - **Runaways:** comebacks 25 → 36%, 45 → 51%, 55 → 62%.
  - **Deals per game:** 10.5, 21.6 and 62.1 made; 0.8, 2.4 and 5.1 broken; joint wars on the land leader 1.8, 3.4 and 4.6.
  - Rules weren't changed for length, as asked: it's for the balance pass. Options are in `docs/sim-results-m3-diplomacy.md`.
- **Taps (384 px phone):** a basic turn is still **6**, proposing a truce **4**, accepting an offer **1**. Command is still 3.
- **Start-up bundle:** 489.9 KB → **493.9 KB** (gzip 150.8 → 152.2).
  - The deal card loads when first used.
  - The turn report's wording and the game-over screen now load when first needed. That paid for almost all of diplomacy.
- **Rules:** `docs/rules-reference.md` §20 (diplomacy), plus §17–19 for Continue, Spoils and Fate.
- **Screenshots** (desktop and 384 px phone), in `docs/art/screens/s14-*.png`:
  - the Propose card
  - a decline and an accept with their reasons
  - an offer to you (its toast, and opened)
  - the Players panel with a binding pact and an Oathbreaker mark
  - a truce border on the map
  - the warning on an attack across a truce
- **Tests and deploy:** 612 automated tests pass. Deployed to the private preview (version `6e48e323`); the lock check passed.
- **Asked Nate to play on the preview:**
  - **Laptop, 4 players on Embervale:** propose a truce, a joint war on the leader, and a binding pact; break a handshake truce; trade gold for land; close the tab mid-turn and press Continue.
  - **Phone, 6 players on the Twin Realms:** answer a bot's offer, count the taps for a truce, and check that Fate stays quiet for three turns.
  - Do the bots' reasons sound like strong logic? Are they too easy or too stubborn? How many turns did each game take?

  His notes go below once he's played.

### Oct 6: Orchestrator review of session 14
- **Checked the work:**
  - GitHub's checks pass on all seven session 14 commits, including the last one (`e5e7d52`).
  - Re-ran 4 players with diplomacy on (500 games): 27.8 turns, 90.6% within 40, 36% comebacks, 10.5 deals a game. All match session 14's numbers exactly.
  - The screenshots look right: the Propose card, answers with reasons, the offer toast, the Players panel marks, white stitched truce borders on the map, and the warning on an attack across a handshake truce. Three small things go into session 15's Step 0:
    - the offer card's "breaking it costs (Oathbreaker)" reads oddly
    - in the warning screenshot, the Players panel still showed a binding pact that the screenshot script had removed: check that the panel updates when a deal ends
    - the Oathbreaker badge pushes a player's name onto two lines in the panel
- **Nate's calls:**
  - **Game length with diplomacy:** the balance pass (session 16) has bots offer fewer truces at big tables, and session 15 adds a lobby switch, "Diplomacy: On/Off".
  - **A harsher Oathbreaker:** about double the fine and the unrest.
  - **Spies use the orchestrator's defaults:** 8 gold + 1 upkeep, up to 5, travel 2 territories a turn, recall brings one home next turn, the defender is told of blocked and killed spies but never of a fooled one.
  - **A richer culture ladder:** culture still unlocks only specialists. New at culture 4 in a province, **Rangers** (forest, hills and swamp defend like plains against them); at 6, the **Standard-bearer** (attacks 10% stronger). These are the orchestrator's defaults; Nate can change them after playing.
- **Session 15's order:** Step 0 (the Oathbreaker, the switch, the small fixes), right of passage's moves, spies, the culture ladder, then sims, screenshots and the deploy. "Govern this province" is last and moves to session 16 if the session runs short.
- **Still to come:** Nate's play tests of sessions 11–14.
- **Next:** session 15 (`docs/prompts/claude-code-session-15.md`, run it locally). After it, a fresh orchestrator prompt is due.


### Oct 6: Claude Code session 15 (M3: Nate's diplomacy calls, right of passage, spies, the culture ladder)
All five parts are done, each committed and pushed, including Part 5 ("Govern this province"). There were no play-test notes from sessions 11–14 to fix first, and no new art in `art/incoming/`.
- **Nate's calls (Step 0):**
  - **A harsher Oathbreaker:** fine 4 + 1.4 per size, unrest 0.8 per size (about double). A 3-turn truce everywhere now costs about 17 gold and 7 troops to break. The Captain uses the same numbers, so it now breaks mostly small deals.
  - **"Diplomacy: On/Off"** in the lobby, next to the Fate deck. Off: no Propose, no offers, no deals; the bots play exactly as with diplomacy off in the sim.
  - **Small fixes:** the offer card says what breaking costs ("Breaking it brings the Oathbreaker mark, about 17 gold and unrest"); the Oathbreaker badge moved to the House line, so names stay on one line. The Players panel bug in the s14 screenshot wasn't real (the panel showed the truce the script had just added); a test now checks a deal's mark goes when it ends.
- **Right of passage, as built:** select your army, tap land beyond the partner's land: one order marches through up to 3 of their territories to your own land or a fight beyond, never stopping or fighting there. Land on the way that changed hands stops it at your last territory before it. Passage land shows on the map as a white stitched ring; the arrow and the replay follow the way. Bots ask for passage toward a rival they want a front with but don't border, march through it, and refuse it to a runaway or anyone attacking their partner ("You're running away with the map. I won't let you through.").
- **Spies, as built:** hire one at your capital or a barracks (8 gold, 1 a turn, up to 5). Send it to a province (3 taps) or Recall it. Spies act between turns: they travel 2 territories, lift the fog 2 around them where nobody holds the province whole, and try to get into a province someone holds whole. The spy-against-spy table is exactly Nate's (in, blocked, killed, fooled). A fooled spy brings back a false picture close to the truth that looks exactly like the real thing; what you see yourself always wins. The defender hears of blocked and killed spies, never fooled ones. Only you see your spies (a small eye, shield or hood badge on the map).
- **The culture ladder:** Rangers at culture 4 in a province (forest, hills and swamp defend like plains against them), the Standard-bearer at 6 (attacks 10% stronger, no stacking). In the odds preview, the Hire menu (locked ones greyed with the culture they need) and the card's culture line ("Culture 4 in Pinemark: Rangers. Next: Standard-bearer at 6"). Placeholder icons until the art comes (Tier 3 in the art list).
- **Sims (500 games, spies off → on):** length 28.0 → 27.1 turns (4 players), 36.2 → 36.1 (6), 46.4 → 44.9 (10); runaways and seat fairness about the same. Spy attempts per game 6.6 / 10.3 / 31.6, nearly all infiltrations, some blocked; bots never kill or fool each other (one spy each). Tuned the Captain to one spy: Captains with spies now win 47% / 51% against Captains without (was 40%). Rangers in 26% / 50% / 67% of games, Standard-bearers in 16% / 39% / 60%. Details: `docs/sim-results-m3-spies.md`.
- **Taps (384 px phone):** a basic turn is still **6**; hire a spy 3, send a spy **3**; Command 3, propose a truce 4, accept 1.
- **Start-up bundle:** 493.9 KB → **441.1 KB** (gzip 152.2 → 135.1), with everything this session added: the game screen now loads when the game starts (fetched quietly once the lobby shows).
- **"Govern this province" (Part 5), as built:** a fifth instruction for a general in a province where you hold most of the land. Its army holds the province; it keeps a quarter of the province's own income and spends it there the same turn (a fort where it's threatened, else culture, else troops). No second pot: what it's saving shows only as progress ("A fort at Pinemark: 5 of 8 gold"), and goes home if the general leaves or is lost. The report says "Your Leader governs Old March: kept 3 gold, raised culture in Pinemark." The Captain uses it for a captured general in a province it holds safely.
- **Saves:** game state version 7 (spies, then governing), with migrations; the session 13 save and a new session 14 save both load.
- **Screenshots** (desktop and 384 px phone), in `docs/art/screens/s15-*.png`: the Diplomacy switch, passage land and a march through it, a spy on the move, an infiltrated province with its eye, the spy report lines, the Hire menu with Rangers and the Standard-bearer, the culture line on the card.
- **Tests and deploy:** 685 automated tests pass. Deployed twice to the private preview: after Part 4 (version `7f30f6f5`) and after Part 5 (version `ac2e0173`); the lock check passed both times. Nate: please check the repo's Actions page for the last commit.
- **Asked Nate to play on the preview:**
  - **Laptop, 4 players on Embervale, Captain bots:** break a handshake truce (the harsher Oathbreaker); get right of passage from a neighbour and march through to a rival; hire a spy and send it into a province a rival holds whole; raise culture to 4 in a province and hire Rangers for a forest attack.
  - **Laptop, a second game with Diplomacy Off:** does it feel faster?
  - **Phone, 6 players on the Twin Realms:** send and recall a spy, and count the taps.
  - Do spies feel worth their gold? Did you ever suspect you'd been fooled? How many turns did each game take?

  His notes go below once he's played.

### Oct 6: Orchestrator review of session 15
- **Checked the work:**
  - GitHub's checks pass on all seven session 15 commits.
  - Re-ran 4 players with everything on (500 games): 27.2 turns (session 15 reported 27.1 before "Govern this province" went in), 92% within 40, spies infiltrating 6.0 times a game and blocked 0.7, 10.5 deals and 0.6 passage deals a game. All in line.
  - The screenshots look right: the Diplomacy switch in the lobby, passage land in white stitches with the march drawn through it, the spy's hood badge and the eye over an infiltrated province, the spy report lines, the Hire menu with Rangers and a locked Standard-bearer, and the culture line naming the next unlock.
  - The start-up bundle fell from 493.9 to 441.1 KB (the game screen now loads when a game starts).
- **Nate's calls:**
  - **Spy upkeep only while away:** free in your own land (at home or guarding a province), 1 gold a turn while travelling or inside someone else's land. Session 16.
  - **He plays sessions 11–15 before the balance pass,** so his notes go into session 16.
  - **Art batch 4 now,** and **a polish pass:** Nate wants the game to look like a large team with a good budget made it, with special effects in the replay. The orchestrator wrote the plan, `docs/09-polish-and-effects-plan.md`:
    - a cinematic replay (letterbox, golden-hour grade, a camera that pushes in on big moments, title cards like "Galeholt falls to House Gules")
    - armies that march as soldiers with dust, ships that bob, battles in smoke with arrow volleys and siege stones, banners raised over captured land, burning capitals
    - an effect for every Fate event, the Fallen's events, deals (a scroll and wax seal; a torn scroll and a red crack for a broken deal) and spies
    - a living map (moving water, drifting clouds and their shadows, chimney smoke, turning windmills, birds)
    - menus with weight (the seal stamps, numbers roll, the timer glows), and real title and game-over art
    - an "Effects: Full / Light / Off" setting; effects never carry game state, fit inside the replay's timing and respect fog
  - The art is **batch 4**, about 50 pieces (Tier 3 of the art list; `docs/prompts/gemini-art-session-04.md` drives Gemini). Soft effects are painted on pure black and the importer will turn brightness into transparency.
  - **The code is session 17,** after the balance pass. Sound is listed in the plan for Nate to decide.
  - **What comes after M3 is decided after he plays.**
- **Fifteen Claude Code sessions are done,** so there's a fresh orchestrator prompt: `docs/prompts/orchestrator-06.md`.
- **Next:** Nate plays on the preview and runs the Gemini session; then session 16 (`docs/prompts/claude-code-session-16.md`, run it locally), with his notes added by the orchestrator first.

### Oct 6: Nate's play test of sessions 11–15
Nate played a full game on Wyrmland against 5 Captain bots. His notes, in his words where it matters:
1. **Leaders and attacks:** the Leader should go with the attacking army by default ("right now I have to click More"), easy to switch off. After the first move the Leader drops off, so it can't carry on through a chain with the troops; it should.
2. **"Seize the Initiative" and "Lie in Wait"** sit in oddly shaped bubbles. Make them buttons that just say "Initiative" and "Wait", with more on hover.
3. **More open space at the map's edges:** fully zoomed out, menus cover playable land.
4. **Provinces are still hard to see, and their names clutter the map.** Instead: tap any territory (yours or not) to light up the border of its whole province and show its name and bonus then.
5. **Player 1 should be red by default,** and players choose colours when setting up a multiplayer game.
6. **Zooming in still looks bad:** "we have high-resolution pictures that are shrunk down, so they should still look good, but everything is blurry when zooming in."
7. **Bots should have different personalities and play styles** (aggressive and focused on one front; all-out expansion with no defence; super-defensive, building culture and defence; deals it can break and lots of spies…), mixed at random so a table of 5 feels different. Maybe a separate, hardest bot level; see if it wins more.
8. **Orders along a path:** click where you're coming from and where you're going; take the shortest path or the "complete path" that snakes back and forth to take every territory in between; a box says how many orders that adds, and you confirm.
9. **The leaders don't seem to do much with the orders I give them.** Instead of the tax idea: give each a share or an exact amount of gold each turn, and they use it to carry out their orders. See the orders they set, mixed in with yours or (a toggle) after yours. They should make several orders where it fits: building, or attacking or moving in a chain.
10. **Spoils don't make sense:** one of each should give the most. Small troop rewards in scattered places are fine; culture or buildings would be nice too; always some gold.
11. **A power line graph at the end,** with awards (best culture, best military and so on).
12. **The game was too short:** Wyrmland, 5 bots, 12 turns, the last 3 a mop-up. The bots weren't hard enough, or culture and diplomacy didn't matter enough.
13. **Fate events need more fanfare** and a way to see what happened; it's very easy to miss them. The same for the Fallen. "I ran away with the game; I'd assume the others would team up against me and the Fallen would target me, but I noticed no extra resistance."
14. **Buildings in captured land should stay** (a fort someone built), **but culture should be wiped** when land changes hands.
15. **"I played the whole game without building a building or doing any culture."** Idea: two leaders from the start, one for culture and one for the military. Name your own Leader at the start, and command it the same as a captured one, so taking over two players gives three military leaders and up to three culture leaders, and gold is drawn away from your own recruiting to delegate. They should be very good at it. A military command: **"expand our empire in this direction"** toward a target territory: rapidly taking easy, undefended land by chaining, or slowly pushing the border where it's contested, not in a straight line, securing provinces on the way.
16. **Map size:** Wyrmland felt right for 6 players but on the small side; go much bigger for larger battles and longer games.

**Nate's calls on the plan (Oct 6):**
- **Mechanics first:** 16 his fixes (controls, sharp zoom, provinces on demand, red by default and choosing colours, orders along a path, culture wiped on capture, the Spoils rework, the Chronicle, the end-of-game graph); **17** the Marshal and bot personalities; **18** leaders you delegate to; **19** bigger maps (about 160 and 200 territories) and the balance pass; **20** the polish pass (effects). (Nate agreed leaders, then bots; the orchestrator put the Marshal first because Nate wants leaders to plan at the Marshal's level.)
- **Leaders keep a visible purse** and can save up. A larger command list, with menus inside menus if needed. You can tell a leader to do anything, up to running your whole military, not just the land it stands on. Your own and captured leaders plan at the Marshal's level.
- **The Marshal is a new hard level** with personalities, built separately from the Captain. Analyse the sims to find which behaviours win, and build those into it.
- **Bigger maps:** about 160 and 200 territories.
- Details: `docs/04-design-additions.md` §4 (leaders), §5 (culture wiped on capture), §6 (the Spoils rework), §11 (the Marshal), §12 (controls and map clarity).

**On graphics engines (Nate asked):** the game already uses **PixiJS v8**, the leading free, open-source (MIT) 2D engine for the web. Switching (Phaser, or a 3D engine like Three.js) would mean a rewrite and be heavier on phones. Instead:
- **pixi-filters** (MIT; v6 for PixiJS v8) comes in with the polish pass: shockwaves, glow, bloom, light rays, colour grading.
- **@pixi/sound** (MIT; v6 for PixiJS v8) if Nate wants sound.
- **Particles and effects are built in-house** on PixiJS's own fast particle container. Off-the-shelf emitters simulate frame by frame with random numbers, so a replay's effects couldn't be scrubbed, skipped or played again identically. Ours are worked out from the replay's clock and the game's seed.
- **The blurry zoom is ours to fix, not an engine's:** the whole map is painted once at about 1.75 pixels per map unit on desktop (1.3 on a phone) for Wyrmland, and fully zoomed in that's stretched about three times. The art is also stored small (trees 192 px, castles 384 px) though the originals are 2048 px. Session 16 paints sharper tiles where you're looking and keeps the art bigger.

### Oct 6: Claude Code session 16 (M3: Nate's play-test fixes)
All six parts are done (Part 6, the end of the game, too), each committed and pushed. No art batch 4 was imported (that's session 20).
- **Controls and rules (Part 1):**
  - **Your Leader goes with the attack** by default: "Leader goes (+20%) / Stays home" sits right under the troop chips. It **carries on through a chain** (each hop you add from where it lands takes it on, and so does Follow through). The report says "with 10 troops and your Leader".
  - **Initiative and Wait** are now plain buttons (under More…). Hover on a laptop, or press and hold on a phone, for the full explanation. (The odd bubbles were the buttons accidentally picking up the Leader card's layout.)
  - **Room at the map's edges:** the game measures its menus, and fully zoomed out the whole map sits clear of them, on a laptop and a phone. You can pan any edge into the clear part at every zoom.
  - **You are red (Gules) by default**, and the lobby lets you pick any of the ten House colours (remembered on your device and kept in saves). The bots take the rest.
  - **Culture is lost when land changes hands** (a capture, a trade, or rebels); buildings stay. The card says "Lost if you take it" on a rival's land. Games are as long as before (4 players 27.9 → 27.7 turns, 6 players 37.1 → 37.4; 300 games each).
  - **Spy upkeep only while away:** free at home or guarding a province, 1 gold a turn while travelling or in land you don't hold.
- **Sharp at every zoom (Part 2):**
  - When you zoom in, the land where you're looking is painted again at up to 3 times the detail (in about a quarter of a second). The art is also kept twice as big: those bigger copies load after the map is on screen, so the first paint isn't slower.
  - Side-by-side before/after pictures: `docs/art/screens/compare/s16-near-{capital,forest,mountain,coast}-{desktop,phone}.png`. The phone pictures went from blocky to clean.
  - **Speed** (phone emulation, processor slowed 4×): panning 95–101 → 97–102 frames a second; laptop 130–184 → 121–154. Texture memory 51 → 88–95 MB. The phone's replay ran at 35 frames a second before and 39–43 after (the marker layout got cheaper), still under the 50 goal; the rest is in how the replay redraws its lines, which the polish pass rebuilds anyway.
  - **Art download:** 2.7 MB at first (unchanged), plus 3.0 MB of bigger copies afterwards.
  - **Provinces on demand:** province names on the land only at Far zoom. Tap any territory (yours, a rival's, fogged) and its whole province lights up with a bright band and its plaque. The card says "The Oak Downs +3: you hold 2 of 5".
- **Orders along a path (Part 3):** select your land, **Path…**, tap where to go. The box offers the **shortest way** or the **full sweep** (it takes everything in between), draws the chain on the map and says "9 orders: take 8 territories, end at Wildstead". Confirm adds ordinary hops you can change. It never attacks anyone you have a deal with. Taps on a phone: 4 (shortest), 5 (sweep).
- **Spoils, the Chronicle, and ganging up (Part 4):**
  - **Spoils rework:** every set gives gold, and **one of each is the best** (6 troops over your front, a building of your choice, 10 gold). The Spoils sheet always shows the table, with the sets you can make lit. Games are no longer (27.7 → 27.5, 37.4 → 36.7).
  - **The Chronicle:** every turn so far, newest first, with what touched you on top. It holds only what you saw; fog fighting is grouped ("Battles in Mistreach ×3"). Tap a line to see the place. Button in the top bar (laptop) or the scroll button by the map buttons (phone). It's kept with saved games.
  - **Louder Fate and Fallen:** an event on your land gets a big banner, the replay camera goes there, and it's the first line of the report: "The Fallen have turned on you: a plague in Old March."
  - **Why nobody ganged up on Nate:** not a bug. People and bots are judged the same way, and the Fallen do target a runaway once there are Fallen. The problem is fog: each Captain counts only the land it sees or remembers, so on Wyrmland it recognised a runaway in only 21% of its turns (100% with fog off), about 8–9 turns late, and joint wars against the runaway fell from 4.3 to 0.6 a game. The ideas for the Marshal (session 17) are in `docs/sim-results-s16.md`. Nate's game wasn't saved to a file, so a "fast expander" bot stood in for him.
- **The end of the game (Part 6):** the game-over screen has a **power graph** (each House's share of the map by turn, House colours with their banner patterns, winner strongest) and **awards** with portraits: Best Military, Best Culture, Master Builder, Spymaster, Diplomat, Survivor, plus Iron Wall, Kingslayer, Fortune's Favourite, Quartermaster and Oathbreaker. Nobody sees any land counts until the game ends.
- **Taps (384 px phone):** a basic turn is still **6**. Path order 4 (shortest) or 5 (sweep). Command 3, propose a truce 4, accept 1, hire a spy 3, send a spy 3.
- **Start-up bundle:** 441.1 → 451.4 KB (gzip 135.1 → 138.1).
- **Saves:** game state version 9 (House colours, then the game's record), with migrations. The session 13 and 14 saves still load.
- **Screenshots** (desktop and 384 px phone), in `docs/art/screens/s16-*.png`: the lobby colour choice, fully zoomed out, an attack with the Leader, Initiative/Wait (phone, with its explanation), a lit province, both path boxes, the Spoils sheet, the Chronicle, the game-over graph and the awards. Scripts: `s16-shots.mjs`, `s16-over.mjs`, `s16-zoom.mjs`.
- **Tests and deploy:** 722 automated tests pass. Deployed twice to the private preview: after Part 5 (version `558bb993`) and after Part 6 (version `a7a4ebf6`). The lock check passed both times. Nate: please check the repo's Actions page for the last commit.
- **Asked Nate to play on the preview:**
  - **Laptop, 6 players on Wyrmland, Captain bots, you in red:** zoom all the way in (sharp now?) and all the way out (can you see everything?); tap a few territories you don't own (do provinces read clearly?); make a path order both ways; attack with your Leader and chain on; turn in one of each in Spoils; open the Chronicle after a few turns (did anything happen to you that you'd have missed?); look at the graph and awards at the end.
  - **Phone:** the same zoom checks, and how smooth it feels.
  - How many turns did the game take?

  His notes go below once he's played.

### Oct 6: Orchestrator review of session 16
- **Checked the work:**
  - GitHub's checks pass on Parts 1–6, but **the last commit (`7dff410`, only `PROGRESS.md`) failed:** two tests that use random inputs failed on that run.
    - **The fog-leak check** (`replay-fog.test.ts`) found a case (seed `"{T"`, 5 players, turn 4): a spy's end-of-turn report and an uprising on the same player's land land on the same step, and the test can't tell a mixed event from ordinary sight. The orchestrator reproduced it: the revealed land matches the spy's real report exactly, so **it's not a leak**, but the test (or how the two are grouped) needs fixing.
    - **A spy test's pass bar** ("at least 10 fooled spies seen") depends on luck: 6 on that run.
    - Neither is a game bug, but `main` shows red until they're fixed. Session 17's Step 0.
  - **Zoom is sharp now:** the before/after pictures at Near show a crisp castle, walls and trees where they were soft.
  - The screenshots look right: the colour picker, the attack with "Leader goes (+20%)" and "Stays home", Initiative/Wait, a lit province, both path boxes with the numbered chain, the Spoils table, the Chronicle, the power graph and awards.
  - **One new problem, from the zoomed-out picture:** on Wyrmland at Far zoom, the province plaques pile on top of each other across the whole map (the clutter Nate disliked). Session 17's Step 0: fewer, smaller, non-overlapping names at Far.
  - **Why nobody ganged up on Nate:** not a bug. Under fog each Captain counts only the land it sees or remembers, so on a big map it spotted a runaway in only 21% of its turns, 8.6 turns late (100% at once with fog off); joint wars against the runaway fell from 4.3 to 0.6 a game. The Fallen do target a runaway, but only once someone is knocked out. This is the Marshal's first job (`docs/sim-results-s16.md`).
- **Session 16's questions, answered with defaults** (Nate can change them when he plays):
  - the Chronicle as a scroll button by the phone's map buttons: keep it
  - the phone replay's frame rate (39–43, goal 50): acceptable until the polish pass rebuilds the replay
  - the 11 awards (Oathbreaker tongue-in-cheek): keep them
- **Nate's call:** his next play test comes **after session 18.** The things to try collect in the list below.

### Oct 6–7: Claude Code session 17 (M3: the Marshal, a hard bot level with personalities)
All five parts are done, each committed and pushed. Nate added two notes during the session (below).
- **Step 0, the red tests and the Far names:**
  - **The fog-leak check** failed because the spies' end-of-turn report was fogging over land again that the turn's own sightings had already fogged (an uprising had just taken that land from the player). Nothing leaked. The report now leaves that land alone. The failing case (seed `"{T"`, 5 players) is a fixed regression case.
  - **The spy test's "at least 10 fooled" bar** now has four fixed cases that are always fooled (20 fooled views on their own), so it can't fail by luck.
  - The rule from now on: property tests keep random inputs, and every failing case they find becomes a fixed test.
  - **Province names at Far:** small, with a dark rim and no plaque, only where they fit (bigger provinces first, never over an army, another name or the screen's edge); tap a territory for its full plaque as before. The old painted names are gone. Checked on Wyrmland and Embervale, desktop and phone.
- **The Marshal (Part 1):** a new bot built beside the Captain (the Captain is unchanged: its fingerprint test passes, and a new one pins it with everything on). Six personalities as data in `packages/content/data/personalities.json`, dealt from each game's seed:
  - **the Conqueror:** one front at a time
  - **the Blitzer:** all-out expansion
  - **the Turtle:** forts, culture and markets, a late strike
  - **the Schemer:** deals it may break, and spies
  - **the Opportunist:** hits whoever just fought
  - **the Merchant:** markets from turn 1, then a rich push

  Each answers deals in its own voice ("Peace suits me; my walls aren't finished."). It never cheats: tests show that hidden changes, or a view stripped to what a person could know, give the same orders, and that bots never pool what they see. Its planner takes a scope (the realm, one army, one front, or building) and a purse, for session 18's leaders.
- **What wins (Part 2):** a parallel tournament (`pnpm tournament`, about 30,000 games in all) recorded each seat's behaviours. Winners grow fastest early, lose the least land early, attack more than one rival, and spend on troops before buildings. Tests that change one thing at a time showed what really causes wins:
  - **attacking hard** (chaining whenever the next hop is likely to win, every spare troop in): 25% → 31% on Embervale, 14% → 30% on Wyrmland
  - **not holding troops back:** holding them back cost 6 points
  - **a hard first 14 turns** on big maps
  - **choosing targets on what you know**, not on guesses about the fog

  All of that is built in under every personality. One Marshal against Captains went from 22% to 33–35% on Embervale (fair 25%) and from 19% to 25–28% on Wyrmland 6 (fair 17%).
- **Nate's notes during the session:**
  1. **Make culture and buildings worth doing.** The sims agree they don't pay yet (culture on safe land loses games; markets make no difference). That's a rule change, so it's for the balance pass (session 19), with the numbers.
  2. **Marshals should go for whole provinces, end on defensible ground, and read the border.** The first two are built in (no cost on average). Reading the border and fortifying ahead of threats was tried and is off for now: it holds troops back and cost 2–3 points. Worth another try once forts and culture are worth more.
- **Stopping a runaway (Part 3):** the Marshal estimates land it can't see (from what it remembers and who knocked out whom), watches pace, uses a lower bar at 6+ players, and proposes joint wars at once that stick. The strong stand-in for a person (the Conqueror playing with fog off) on Wyrmland at 6 players:
  - it wins **35% against Captains, 24% against Marshals** (fair 17%)
  - Marshals name it **half a turn** after it truly runs away (Captains: 8.5 turns late)
  - their first joint war against it comes on **turn 10** (Captains: turn 29)

  The Fallen are unchanged; they do turn on the runaway once they exist.
- **The lobby (Part 4):** Recruit (easy), Captain (medium), **Marshal (hard, now the default)**, and **Mixed** ("2 Marshals and 3 Captains", with − and +). Personalities are hidden while you play and revealed at the end ("Baron Krell wins", with "Marshal, the Schemer" underneath, and in the Houses panel). "Show personalities" in the lobby (off by default) shows them all along. Saves keep each bot's level, personality and memory.
- **Headline numbers (Part 5):**
  - One Marshal against Captains: **35% at 4 players** (fair 25%), **25% at 6** (17%), **11% at 10** (10%).
  - Tables of Marshals play about as long as Captains at 6 and 10 players. At 4 players on Embervale they snowball: half the map by turn 10 in 70% of games, about 21 turns a game (Captains: 28). A balance-pass question.
  - Planning speed: **0.4 ms a turn on average, worst 5 ms** (10 players, Wyrmland; the limit is 50 ms).
  - Write-up: `docs/sim-results-m3-marshal.md`.
- **Screenshots** (desktop and 384 px phone), in `docs/art/screens/`:
  - `s17-lobby-bots*.png`: the lobby's bot choice
  - `s17-game-over-winner*.png` and `s17-game-over-personalities*.png`: the game-over screen revealing personalities
  - `s17-far-wyrmland*.png` and `s17-far-embervale*.png`: zoomed out, with the uncluttered names
- **Tests and deploy:** 741 automated tests pass (the full run twice, as property tests use random inputs). Deployed to the private preview (version `49f5dfd1`); the lock check passed. Nate: please check the repo's Actions page for the last commit.

### Oct 7: Orchestrator review of session 17
- **Checked the work:**
  - GitHub's checks pass on all seven session 17 commits, so `main` is green again (the two red tests are fixed: the spies' report no longer fogs land a second time, with the failing case kept as a fixed test, and the spy test can't fail by luck).
  - Re-ran one Marshal (the Blitzer) against 3 Captains on Embervale, 300 games: it won **39.0%** (session 17 reported 41.3%; within the ±2.5-point wobble of 300 games).
  - The screenshots look right: province names at Far are small, plaque-free and no longer pile up on Wyrmland; the lobby's bot choice with Mixed ("2 Marshals and 3 Captains") and "Show personalities"; the game-over screen revealing each bot ("Marshal, the Turtle").
- **What session 17 found wins** (built into every personality): attack hard and chain whenever the next hop is likely to win; don't hold troops back on quiet fronts; expand hardest in the first 14 turns on big maps; choose targets on what you know. **Culture and buildings don't pay back yet.**
- **The Marshal is now the default bot level.** One Marshal beats Captains about 1.4 times its fair share; it spots a runaway half a turn after it happens (Captains: 8.5 turns late) and the first joint war against it comes on turn 10 (Captains: turn 29). Planning takes 0.4 ms a turn (worst 5 ms).
- **Art batch 4 is made:** 42 of about 50 pieces (all effects, key art, the specialists and spies, the redo pieces; of the scenery additions only one narrow peak, when Gemini's daily limit ran out). The report is `docs/art/batch-4-report.md`; its lessons are in the art list. The built-in browser downloads half-size images (1024 px), so `terrain-hills` is 768 px.
- **Nate's calls (Oct 7):**
  - **Culture and buildings must pay:** the balance pass (session 19) tests more income per culture level, bigger markets and cheaper forts, and Nate picks.
  - **The 4-player snowball** (Marshals: half of Embervale by turn 10 in 70% of games, about 21 turns): **bots first** (Marshals gang up sooner at small tables); rule changes only with numbers for Nate.
  - **The Fallen act from their first turn out:** "the goal is to keep people knocked out still engaged in the game so everyone is still having fun; that could also help the balance." Session 19.

### Oct 7: Claude Code session 18 (M3: leaders you delegate to)
All four parts are done, each committed and pushed. Art batch 4 wasn't imported (that's session 20).
- **Two leaders from the start (Part 1):** your **Leader** (military, on the map, +20%) and your **Steward** (culture, buildings, forts, the economy; never on the map, can't be lost).
  - **Names:** you name your Leader in the lobby (a name is filled in); the Steward's name is optional. Bots' leaders get names from the game's seed.
  - **Purses:** each leader has a purse: its budget (a share of your income, or an exact amount) goes in as income comes in, it saves up, it pays for its leader's orders, you can take it back in one tap, and purses pay your upkeep before anyone deserts.
  - **Defaults:** your Steward starts on **Run the realm with 20%**; your Leader has no command and no budget until you give it one.
  - **Captured leaders:** knocking a player out gives you their Leader and Steward, up to 4 of each kind (your own included).
  - **Govern is gone;** old saves come up to date (a governing general's saved gold goes into its purse). A real session 17 save is a new test fixture.
- **They plan with the Marshal (Part 2):** every command goes through the Marshal's planner with its scope and the leader's purse, from your view only, and writes several orders where it fits.
  - **Expand our empire in this direction** (Nate's): pick a target. It chains fast through empty land, is careful where rival armies stand (only where what arrives would hold), takes whole provinces on the way, and holds at the target.
  - Also: Command this front, Run the military, Hold, Defend, Push, Raid; and the Steward's Run the realm, Build up, Fortify, Raise culture, Grow the economy.
  - **Your orders come first:** an order of yours takes that army (or a place you build on) back from the leader for the turn.
  - The Captain plays exactly as before (checked against session 17's code).
- **The sims** (`docs/sim-results-m3-leaders.md`, 300 games a line):
  - **A player who hands everything to their leaders** (80% to the Leader, 20% to the Steward) wins **1.48 times its fair share against Marshals on Embervale, 1.46 on Wyrmland**: the leaders are at least as good as a Marshal. Half and half does badly (0.35–0.5×): buildings don't pay yet.
  - **The default Steward** builds now: about 2.5 times the forts by turn 10, and markets the Captain never builds. On Wyrmland it pays for itself (a Captain with it wins 18.3%, without 17.3%); on Embervale it costs wins (16% against 23%), because small games end before buildings pay back. The first version of Run the realm also bought culture for its income and did much worse (11%), so it now buys urgent forts, markets, a barracks where needed, and culture only where it protects.
  - **Orders:** a Leader running the military writes about 7–8 orders a turn, the Steward 1–2 every few turns (it saves up).
  - **Speed:** 0.7 ms a turn on average (worst 6.3 ms) at 10 players on Wyrmland; with all 8 leaders commanded, 3.2 ms (worst 8.1 ms). The limit is 50 ms.
- **The screens (Part 3):**
  - **The lobby:** name fields for your Leader and Steward.
  - **The Leaders panel** (laptop: the right column; phone: the Leaders sheet, from your Leader's portrait by the map buttons): every leader with its portrait (Stewards show the House shield with a quill), name, what it's doing, purse, budget and orders this turn.
  - **Controls:** Command, Budget (0/10/20/30/50% chips or an exact amount) and Take back. While a leader is open, its target glows and the provinces it works in get a gold band.
  - **The queue:** leaders' orders show with their portraits, with **"Leaders' orders: Mixed in / After mine"** in Settings and at the top of the queue. The top bar shows the purses' total next to your gold.
- **Taps** on a 384 px phone, from your Leader's portrait:
  - the basic turn is still **6**
  - Expand toward **4**, Command this front **5** (one province), Run the military **3**, Hold **3**, Raid **4**
  - Run the realm **4**, Grow the economy **4**, Build up / Fortify / Raise culture **5**
  - a budget **3** (your Leader) or **4** (your Steward)
  - (On a laptop, one fewer each.)
- **Start-up bundle:** 462.1 → 474.1 KB (gzip 141.6 → 145.1).
- **Saves:** game state version 10, with a migration; the session 13, 14 and 17 saves load.
- **Screenshots** (desktop and 384 px phone), `docs/art/screens/s18-*.png`: `lobby-names`, `leaders-panel`, `command-menu` (Steward), `command-military`, `expand` (the target glowing, the way outlined), `budget`, `queue-mixed`. Script: `apps/web/scripts/s18-shots.mjs`.
- **Tests and deploy:** 772 automated tests pass (the full run twice, as property tests use random inputs). Deployed to the private preview (version `2b6282f3`); the lock check passed. Nate: please check the repo's Actions page for the last commit.

### Oct 7: Orchestrator review of session 18
- **Checked the work:**
  - GitHub's checks pass on all four session 18 commits.
  - The screenshots look right: the lobby's name fields, the Leaders panel (Aldric expanding toward Northdale with a 12-gold purse and 7 orders this turn; Odo the Steward running the realm), the command menus, the Expand target outlined on the map, the budget chips (0–50% or an exact amount), and the leaders' orders in your queue with their portraits under "Mixed in / After mine".
  - **One surprising number, re-run and confirmed:** a player who hands everything to their leaders (Leader on "Run the military" with 80%, Steward on "Run the realm" with 20%) **beats a table of Marshals 37.0% of the time on Embervale (fair 25%)**, exactly as session 18 reported. The leaders plan with the Marshal's own brain on less gold, so either the leaders' way of planning is better than the Marshal's, or a delegating player gets an edge a Marshal doesn't. **Session 19 finds out**, and the Marshal must play at least as well as your leaders.
- **Session 18's questions, orchestrator's defaults until Nate plays after session 19:**
  - the default Steward share stays at 20% for now; the balance pass makes buildings and culture pay and then sets the default where it helps
  - "Expand our empire in this direction" stays careful where rival armies stand (Nate judges it in his play test)
  - leaders' orders stay "Mixed in" by default
- **Nate's call (Oct 7):** his next play test comes **after session 19**, once the balance pass is in. The list below is now "Things to test after session 19".
- **Eighteen Claude Code sessions are done,** so there's a fresh orchestrator prompt: `docs/prompts/orchestrator-07.md`.
- **Next:** session 19 (`docs/prompts/claude-code-session-19.md`, run it locally), then Nate's play test.

### Oct 7: Claude Code session 19 (M3: the balance pass, and bigger maps)
All five parts are done, each committed and pushed. Art batch 4 wasn't imported (session 20). Full write-up: `docs/sim-results-m3-balance.md`.
- **Step 0:** the "keep or let go" dialog lists captured Stewards too (they used to go by default without a choice).
- **Why a delegating player beat the Marshals (Part 1):** not diplomacy and not the Leader's +20%. The Marshal queued its purchases before its attacks (each order takes a round, so rivals moved first), bought cavalry on a whim, and in its all-out opening left one troop at home: on Embervale, where capitals are 3 steps apart, **14% of Marshals were knocked out on turn 1** (a delegating player's starting gold stayed home as troops, by accident). Now the Marshal queues troops and attacks first, skips the whim cavalry, and keeps a **guard at its capital** (half of any rival army within 3 steps, and half its stack for the first 3 turns). A player who hands everything to their leaders now wins 20% against Marshals on Embervale (fair 25%; was 30–37%) and 1.09× fair on Wyrmland (was 1.46×). One Marshal beats Captains more often on every table (Embervale 32% → 40%, Greatmarch 11% → 21%).
- **Culture and buildings that pay (Part 2), pending Nate's pick:** three levers tested alone and in pairs. All but quick forts make building pay on big maps; on a 4-player Embervale nothing makes 20% on buildings pay before the game is decided; bigger or cheaper markets made the Merchant too strong. **Picked: culture +1 gold a turn a level** (was +½). Your Steward's default is now **20% with room, 10% on a crowded table** (12 or fewer territories a player), and "Run the realm" buys culture where it pays.
- **The Fallen, the snowball, runaways (Part 3):** a knocked-out player starts with **8 Influence** (9+ on the first turn out: a storm, a famine or mercenaries), the dialog and panel say what you can do this very turn, and Fallen bots strike the biggest realm on their first turn. **The 4-player snowball is gone, from the bots alone:** half the map by turn 10 in 71% → 30% of games, 21 → 29 turns, comebacks 22% → 45%. The capital's opening guard now holds on every table (knocked out by turn 6: 15–24% → 1–2%); the halfway leader wins 47–79% (was 59–87%). Stronger gang-ups and an earlier runaway reading made no difference; catch-up rules are listed as options only.
- **Bigger maps (Part 4), Nate's OK:** **Ashwing** (a phoenix, 160, 6–8 players), **The Sundered Crowns** (twin continents, 160, 6–8), **Krakenmere** (a kraken, 200, 8–10) and **Rootholm** (a tree of life, 200, 8–10; redrawn after Nate said the first looked like a uvula). The lobby says who each map suits. On a phone they paint in 3.5–4.4 s and pan at 74–105 fps; the replay at 10 players is 43–44 fps (goal 50, the polish pass) and memory 225–263 MB (a fix is suggested).
- **A finding that touches every map:** among equal bots, **the capital spot decides a lot** (Embervale 4: one spot won 53%, another 1%). Earlier sessions measured seats by number, which are shuffled, so it stayed hidden. Embervale's 4-player capitals were re-chosen with the simulator (now 13–38%); the other maps are listed for a later session.
- **Nate's notes during the session:** both 160 maps official, Krakenmere official, the tree redrawn ("more of a tree of life look") and then OK'd; **long bot games are fine** ("all of my runs on the maps, even big ones, go for significantly less turns than your tests").
- **Screenshots** (desktop and 384 px phone), `docs/art/screens/s19-*.png`: each new map at Far and Mid, the Fallen's choice and their first turn out. Galleries and Far pictures: `docs/maps/s19/`.
- **Start-up bundle:** 474.1 → 476.6 KB (gzip 145.1 → 146.0); each new map loads only when picked (413–552 KB compressed).
- **Tests and deploy:** 844 automated tests pass (the full run twice). Deployed to the private preview (version `36e80125`); the lock check passed. Nate: please check the repo's Actions page for the last commit.
- **Questions for Nate:** keep culture +1 a level, or another lever (table in the write-up)? Should Conquest's 20-turn default grow on the 160–200 maps? Make the Recruit weaker still (a new player wins 46% against three)? Fairer capital spots for the other maps next (a later session)?

### Things to test after session 19 (Nate's next play test)
*The orchestrator adds to this list after each session. Laptop: 6 players on Wyrmland, you in red; phone: the same checks where they apply.*
- **From session 19 (the balance pass and bigger maps), most important first:**
  1. **Embervale against 3 Marshals:** does the game last longer (the sims say about 29 turns, was 21), and does someone run away less? Does anyone get knocked out in the first few turns (they shouldn't now)?
  2. **A 6–8 player game on a new ~160 map** (Ashwing or The Sundered Crowns): how many turns, does the size feel right for big battles, and do the neck (Ashwing) and the strait (Sundered Crowns) matter?
  3. **Does culture or building now feel worth it?** Culture gives +1 gold a turn a level now. Raise culture on safe land early and see if it pays; watch what your Steward builds on its own. (The three levers are in the write-up if you'd pick another.)
  4. **Get knocked out on purpose once** and try the Fallen's first turn: is it obvious what you can do straight away? Did your event land, and did it feel worth staying for?
  5. **Try to run away against Marshals** on Wyrmland: do they team up on you, and when?
  6. **An 8–10 player game on Krakenmere or Rootholm** (the lobby defaults to Conquest, 20 turns, at 8+ players): is 20 turns enough on a 200 map? On the phone: is it smooth enough?
  7. **Your starting spot:** did it feel fair? (Sims found some capital spots much stronger; Embervale's 4-player spots were re-chosen.)
  8. **Never touch your Steward** on Embervale with 4 (it starts at 10% there) and on Wyrmland (20%): does it feel like the right amount?
- **From session 16:**
  - zoom all the way in (sharp?) and all the way out (everything visible clear of the menus? the province names readable, not piled up?)
  - tap territories you don't own: does the province light up clearly, with its name and bonus?
  - a path order, both Shortest way and Full sweep
  - attack with your Leader and chain on (it should go along by default and stay with the army)
  - the Initiative and Wait buttons (hover, or press and hold on the phone)
  - pick a House colour in the lobby
  - capture land that had culture (it should drop to 0; buildings stay)
  - Spoils: is it clear now, and does one of each feel like the best?
  - the Chronicle after a few turns: did anything happen to you that you'd have missed? Do Fate and the Fallen feel loud enough?
  - the power graph and the awards at the end
  - spies cost gold only while away
  - on the phone: how smooth do panning and the replay feel?
- **From session 17 (the Marshal):**
  - a 6-player Wyrmland game against Marshals (the lobby's default now): **try to run away.** Do they team up on you, and when? (A Marshal offers the others a joint war against you as soon as it reads you as running away; the sims say about turn 10.) Do the offers you get say so?
  - **do the personalities feel different?** Guess each bot's personality while you play, then check at the end (the game-over screen reveals them: "Marshal, the Turtle"). Or turn on "Show personalities" in the lobby.
  - a **Mixed** table ("2 Marshals and 3 Captains"): can you tell which are which?
  - are Marshals **too hard**, or just right? (One Marshal beats Captains about 1.4 times as often as its fair share.)
  - fully zoomed out on Wyrmland: are the province names readable and no longer piled up?
  - on Embervale with 3 Marshals: do games end too fast? (The sims say about 21 turns.)
- **How many turns did the game take?**
- **From session 18 (leaders you delegate to):**
  - **name your Leader** in the lobby (and your Steward if you like); do the names show in the Leaders panel and the report?
  - give your Leader **"Expand our empire in this direction"** toward somewhere 4–6 steps away, with a budget (say 30%), and watch it for a few turns: does it race through empty land, slow down where rivals stand, take whole provinces on the way, and stop when it gets there?
  - **never touch your Steward** for a few turns: what did it build? Then give it a **bigger budget** (30–50%) and see what it builds. Does 20% feel right as the default, or should it start lower?
  - **"Run the military"** for a few turns while you only do the diplomacy: is it as good as you'd hope?
  - **capture a player** and command their Leader and Steward (try "Command this front" on a captured Leader)
  - the **"Leaders' orders: Mixed in / After mine"** switch: which reads better?
  - **Take back** a purse and spend it yourself the same turn
  - change or delete one of a leader's orders in the queue (it's yours to edit)
  - on the phone: open the Leaders sheet from your Leader's portrait; is everything reachable in a few taps?
