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
**Phase: M3 (depth and balance). Sessions 7–10 are done. Next: art batch 3 in Gemini (`docs/prompts/gemini-art-session-03.md`), then session 11: the big visual upgrade, judged on the art test bench, and the six new maps made official.**

Claude Code sessions completed: **10** (a new orchestrator prompt is due after sessions 3, 6, 9, ...)

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

